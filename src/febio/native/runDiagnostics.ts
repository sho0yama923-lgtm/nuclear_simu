/**
 * Responsibility: Summarize active native FEBio CLI run outputs.
 * Owns: FEBio logfile CSV parsing and high-level run response diagnostics.
 * Does NOT own: FEBio export serialization, result normalization, or classification.
 * Primary entrypoints: summarizeNativeFebioRunFiles
 * Depends on: active native logfile output names from outputs.ts/model.ts.
 */

import { summarizeXpltContactForce } from "./xpltDiagnostics.ts";

const FORCE_EPSILON = 1e-9;
const CELL_DISH_NORMAL_SUPPORT_RATIO = 0.2;

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

function countRegex(text = "", pattern) {
  const matches = String(text).match(pattern);
  return matches ? matches.length : 0;
}

function warningCounts(logText = "") {
  const solverWarnings = countPattern(logText, "Warning:");
  const solverWarningBlocks = countRegex(logText, /\*\s+WARNING\s+\*/g);
  const platformWarnings = countPattern(logText, "Intel MKL WARNING");
  return {
    normalTermination: countPattern(logText, "N O R M A L   T E R M I N A T I O N"),
    warning: solverWarnings + solverWarningBlocks,
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

function parseNativeModel(input) {
  if (!input) return null;
  if (typeof input === "object") return input;
  try {
    return JSON.parse(String(input));
  } catch {
    return null;
  }
}

function pointForNode(mesh, id) {
  const node = (mesh?.nodes || []).find((entry) => entry.id === id);
  return node ? [node.x || 0, node.y || 0, node.z || 0] : null;
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function triangleArea(a, b, c) {
  const vector = cross(subtract(b, a), subtract(c, a));
  return 0.5 * Math.hypot(vector[0], vector[1], vector[2]);
}

function facetArea(mesh, facet = {}) {
  const points = (facet.nodes || []).map((id) => pointForNode(mesh, id)).filter(Boolean);
  if (points.length < 3) return 0;
  let area = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    area += triangleArea(points[0], points[index], points[index + 1]);
  }
  return area;
}

function surfaceArea(mesh, surfaceName) {
  return (mesh?.surfaces?.[surfaceName] || []).reduce((total, facet) => total + facetArea(mesh, facet), 0);
}

function pressureLoadSummary(nativeModelInput) {
  const nativeModel = parseNativeModel(nativeModelInput);
  const mesh = nativeModel?.geometry?.mesh;
  const pressureLoads = nativeModel?.loads?.pressure || [];
  const loads = pressureLoads.map((load) => {
    const area = surfaceArea(mesh, load.surface);
    const pressure = Math.abs(Number(load.value || 0));
    const resultant = pressure * area;
    return {
      name: load.name || "",
      surface: load.surface || "",
      value: Number(load.value || 0),
      magnitude: pressure,
      unit: load.unit || nativeModel?.coordinateSystem?.stress || "kPa",
      area,
      resultant,
      resultantUnit: "nN",
      active: resultant > FORCE_EPSILON,
      interpretation: "pressure resultant is computed from declared surface_load pressure times native mesh surface area"
    };
  });
  const suction = loads.find((load) => load.surface === "pipette_suction_surface") || null;
  return {
    available: Boolean(nativeModel && mesh),
    loads,
    pipetteSuction: suction || {
      name: "",
      surface: "pipette_suction_surface",
      value: 0,
      magnitude: 0,
      unit: "kPa",
      area: 0,
      resultant: 0,
      resultantUnit: "nN",
      active: false,
      interpretation: "pipette suction pressure load was not found in native model"
    }
  };
}

function cellDishForceDiagnostics(cellDish, plotfileContactForce) {
  const hasPressure = cellDish.hasLoadBearingPressure === true;
  const hasContactForce = plotfileContactForce.hasContactForce === true;
  const normalForce = plotfileContactForce.maxAbs?.normal || 0;
  const tangentialForce = plotfileContactForce.maxAbs?.tangential || 0;
  const normalToTangentialRatio = plotfileContactForce.normalToTangentialRatio || 0;
  return {
    pressureForceMismatch: !hasPressure && hasContactForce,
    normalForce,
    tangentialForce,
    normalToTangentialRatio,
    normalSupportThreshold: {
      minMagnitude: FORCE_EPSILON,
      minNormalToTangentialRatio: CELL_DISH_NORMAL_SUPPORT_RATIO
    },
    hasNormalSupport: normalForce > FORCE_EPSILON && normalToTangentialRatio >= CELL_DISH_NORMAL_SUPPORT_RATIO,
    hasTangentialForce: tangentialForce > FORCE_EPSILON,
    interpretation: !hasPressure && hasContactForce
      ? "cell-dish face-data pressure is zero while plotfile contact force is nonzero"
      : ""
  };
}

function plotfileSurfaceForce(plotfileContactForce, surfaceName) {
  return plotfileContactForce?.surfaceSummaries?.[surfaceName] || {
    nonzeroRowCount: 0,
    hasContactForce: false,
    maxAbs: {
      x: 0,
      y: 0,
      z: 0,
      magnitude: 0,
      normal: 0,
      tangential: 0
    }
  };
}

function pipetteInteractionDiagnostics(pipetteCell, pipetteContact, rigidPipette, plotfileContactForce, pressureLoads) {
  const suctionPlotfileForce = plotfileSurfaceForce(plotfileContactForce, "pipette_suction_surface");
  const mouthPlotfileForce = plotfileSurfaceForce(plotfileContactForce, "pipette_contact_surface");
  const pressureActive = pipetteCell.hasLoadBearingPressure === true;
  const mouthPressureActive = pipetteContact.hasLoadBearingPressure === true;
  const suctionPressureLoadActive = pressureLoads?.pipetteSuction?.active === true;
  const rigidReactionActive = rigidPipette.hasReaction === true;
  const suctionPlotfileForceActive = suctionPlotfileForce.hasContactForce === true;
  const mouthPlotfileForceActive = mouthPlotfileForce.hasContactForce === true;
  const plotfileForceActive = suctionPlotfileForceActive || mouthPlotfileForceActive;
  const hasInteraction = pressureActive || mouthPressureActive || rigidReactionActive || plotfileForceActive;
  return {
    pressureActive,
    mouthPressureActive,
    rigidReactionActive,
    suctionPlotfileForceActive,
    mouthPlotfileForceActive,
    plotfileForceActive,
    suctionPressureLoadActive,
    directContactOutputActive: pressureActive || mouthPressureActive || plotfileForceActive,
    hasInteraction,
    maxPressure: pipetteCell.maxAbsPressure || 0,
    maxMouthPressure: pipetteContact.maxAbsPressure || 0,
    suctionPressureLoadResultant: pressureLoads?.pipetteSuction?.resultant || 0,
    suctionPressureLoad: pressureLoads?.pipetteSuction || null,
    maxRigidReaction: rigidPipette.maxAbsReaction || 0,
    suctionPlotfileForce,
    mouthPlotfileForce,
    interpretation: hasInteraction
      ? "pipette interaction is active in at least one pressure, rigid-reaction, or plotfile-force channel"
      : "pipette interaction channels are all inactive: pipette-cell pressure, pipette mouth pressure, rigid reaction, and pipette plotfile contact force are zero"
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
  const pressureLoads = pressureLoadSummary(files.nativeModel || files.model || "");
  const cellDishForce = cellDishForceDiagnostics(cellDish, plotfileContactForce);
  const pipetteInteraction = pipetteInteractionDiagnostics(pipetteCell, pipetteContact, rigidPipette, plotfileContactForce, pressureLoads);
  return {
    warnings,
    cellDish,
    pipetteCell,
    pipetteContact,
    rigidPipette,
    nucleus,
    cytoplasm,
    pressureLoads,
    plotfileContactForce,
    cellDishForce,
    pipetteInteraction,
    gates: {
      warningFree: warnings.warning === 0 && warnings.error === 0 && warnings.negativeJacobian === 0 && warnings.noForceActing === 0 && warnings.noContactPairs === 0,
      cellDishPressureActive: cellDish.hasLoadBearingPressure,
      cellDishContactForceActive: plotfileContactForce.hasContactForce === true,
      cellDishNormalSupportActive: cellDishForce.hasNormalSupport,
      cellDishTangentialForceActive: cellDishForce.hasTangentialForce,
      cellDishPressureForceMismatch: cellDishForce.pressureForceMismatch,
      cellDishLoadBearing: cellDish.hasLoadBearingPressure,
      cellDishGapControlled: cellDish.hasControlledGap,
      plotfileContactForceActive: plotfileContactForce.hasContactForce === true,
      pipetteCellPressureActive: pipetteInteraction.pressureActive,
      pipetteMouthPressureActive: pipetteInteraction.mouthPressureActive,
      pipetteRigidReactionActive: pipetteInteraction.rigidReactionActive,
      pipetteSuctionPlotfileForceActive: pipetteInteraction.suctionPlotfileForceActive,
      pipetteMouthPlotfileForceActive: pipetteInteraction.mouthPlotfileForceActive,
      pipettePlotfileForceActive: pipetteInteraction.plotfileForceActive,
      pipetteSuctionPressureLoadActive: pipetteInteraction.suctionPressureLoadActive,
      pipetteDirectContactOutputActive: pipetteInteraction.directContactOutputActive,
      pipetteInteractionActive: pipetteInteraction.hasInteraction,
      nucleusCytoplasmMoved: nucleus.hasDisplacement && cytoplasm.hasDisplacement,
    },
  };
}
