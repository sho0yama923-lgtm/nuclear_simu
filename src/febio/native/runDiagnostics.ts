/**
 * Responsibility: Summarize active native FEBio CLI run outputs.
 * Owns: FEBio logfile CSV parsing and high-level run response diagnostics.
 * Does NOT own: FEBio export serialization, result normalization, or classification.
 * Primary entrypoints: summarizeNativeFebioRunFiles
 * Depends on: active native logfile output names from outputs.ts/model.ts.
 */

import { summarizeXpltContactForce } from "./xpltDiagnostics.ts";

function parseNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseLogRecords(text = "") {
  const records = [];
  let current = null;
  String(text).split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("*Step")) {
      if (current) records.push(current);
      current = { step: parseNumber(trimmed.split("=").pop()), time: 0, data: "", rows: [] };
    } else if (trimmed.startsWith("*Time") && current) {
      current.time = parseNumber(trimmed.split("=").pop());
    } else if (trimmed.startsWith("*Data") && current) {
      current.data = String(trimmed.split("=").pop() || "").trim();
    } else if (!trimmed.startsWith("*") && current) {
      current.rows.push(trimmed.split(/[,\s]+/).filter(Boolean).map(parseNumber));
    }
  });
  if (current) records.push(current);
  return records;
}

function finalRecord(text = "") {
  return parseLogRecords(text).at(-1) || { step: 0, time: 0, data: "", rows: [] };
}

function maxAbsColumn(record, index) {
  return Math.max(0, ...(record.rows || []).map((row) => Math.abs(row[index] || 0)));
}

function maxDisplacement(record) {
  return Math.max(0, ...(record.rows || []).map((row) => Math.hypot(row[1] || 0, row[2] || 0, row[3] || 0)));
}

function countPattern(text = "", pattern) {
  const matches = String(text).match(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
  return matches ? matches.length : 0;
}

function warningCounts(logText = "") {
  const solverWarnings = countPattern(logText, "Warning:");
  const platformWarnings = countPattern(logText, "Intel MKL WARNING");
  return {
    normalTermination: countPattern(logText, "N O R M A L   T E R M I N A T I O N"),
    warning: solverWarnings,
    platformWarning: platformWarnings,
    error: countPattern(logText, "ERROR"),
    negativeJacobian: countPattern(logText, "Negative jacobian"),
    noForceActing: countPattern(logText, "No force acting"),
    noContactPairs: countPattern(logText, "No contact pairs"),
  };
}

function surfaceContactSummary(text = "") {
  const record = finalRecord(text);
  const finalGap = record.rows.map((row) => row[1] || 0);
  const finalPressure = record.rows.map((row) => row[2] || 0);
  const maxFinalGap = Math.max(0, ...finalGap.map((value) => Math.abs(value)));
  return {
    time: record.time,
    rows: record.rows,
    finalGap,
    finalPressure,
    maxFinalGap,
    maxAbsPressure: maxAbsColumn(record, 2),
    hasLoadBearingPressure: maxAbsColumn(record, 2) > 1e-9,
    hasControlledGap: maxFinalGap <= 0.1,
  };
}

function rigidSummary(text = "") {
  const record = finalRecord(text);
  const row = record.rows[0] || [];
  return {
    time: record.time,
    row,
    position: { x: row[1] || 0, y: row[2] || 0, z: row[3] || 0 },
    reaction: { Fx: row[4] || 0, Fy: row[5] || 0, Fz: row[6] || 0 },
    maxAbsReaction: Math.max(Math.abs(row[4] || 0), Math.abs(row[5] || 0), Math.abs(row[6] || 0)),
    hasReaction: Math.max(Math.abs(row[4] || 0), Math.abs(row[5] || 0), Math.abs(row[6] || 0)) > 1e-9,
  };
}

function displacementSummary(text = "") {
  const record = finalRecord(text);
  return {
    time: record.time,
    maxDisplacement: maxDisplacement(record),
    hasDisplacement: maxDisplacement(record) > 1e-9,
  };
}

export function summarizeNativeFebioRunFiles(files = {}) {
  const warnings = warningCounts(files.log || "");
  const cellDish = surfaceContactSummary(files.cellDish || "");
  const pipetteCell = surfaceContactSummary(files.pipetteCell || "");
  const pipetteContact = surfaceContactSummary(files.pipetteContact || "");
  const rigidPipette = rigidSummary(files.rigidPipette || "");
  const nucleus = displacementSummary(files.nucleus || "");
  const cytoplasm = displacementSummary(files.cytoplasm || "");
  const plotfileContactForce = summarizeXpltContactForce(files.xplt);
  return {
    warnings,
    cellDish,
    pipetteCell,
    pipetteContact,
    rigidPipette,
    nucleus,
    cytoplasm,
    plotfileContactForce,
    gates: {
      warningFree: warnings.warning === 0 && warnings.error === 0 && warnings.negativeJacobian === 0 && warnings.noForceActing === 0 && warnings.noContactPairs === 0,
      cellDishLoadBearing: cellDish.hasLoadBearingPressure,
      cellDishGapControlled: cellDish.hasControlledGap,
      plotfileContactForceActive: plotfileContactForce.hasContactForce === true,
      pipetteInteractionActive: pipetteCell.hasLoadBearingPressure || rigidPipette.hasReaction,
      nucleusCytoplasmMoved: nucleus.hasDisplacement && cytoplasm.hasDisplacement,
    },
  };
}
