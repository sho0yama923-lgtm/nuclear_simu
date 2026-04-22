import {
  CD_REGIONS,
  MEMBRANE_REGIONS,
  NC_REGIONS,
  structuredCloneSafe,
} from "../../model/types.js";
import {
  buildSimulationInput,
  deriveMembraneStateFromLocalNc,
  initializeLocalState,
  initializeMembraneState,
  summarizeLocalDamage,
} from "../../model/schema.js";
import { classifyRun, determineDominantMechanism } from "../../results/classification.js";

/**
 * SOURCE OF TRUTH: FEBio result normalization for canonical import.
 *
 * Responsibility: normalize FEBio and FEBio-like result payloads into the canonical result shape.
 * Owns: normalizeFebioResult, importFebioResult.
 * Does NOT own: FEBio export assembly, schema defaults, UI display rules.
 * Primary entrypoints: normalizeFebioResult, importFebioResult.
 * Depends on: src/model/schema.ts, src/results/classification.ts.
 */

function buildSolverMetadata(overrides = {}) {
  return {
    solverMode: "febio",
    source: "febio-import",
    note: "",
    ...overrides,
  };
}

function normalizeHistoryEntries(history, result, inputSpec) {
  return (history || []).map((entry) => {
    const normalized = {
      ...entry,
      localNc: entry.localNc || initializeLocalState(NC_REGIONS),
      localCd: entry.localCd || initializeLocalState(CD_REGIONS),
    };
    normalized.membraneRegions =
      entry.membraneRegions || deriveMembraneStateFromLocalNc(normalized.localNc, inputSpec.membrane || {});
    normalized.damageNc ??= summarizeLocalDamage(normalized.localNc, NC_REGIONS);
    normalized.damageCd ??= summarizeLocalDamage(normalized.localCd, CD_REGIONS);
    normalized.damageMembrane ??= Math.max(
      ...MEMBRANE_REGIONS.map((region) => normalized.membraneRegions?.[region]?.damage || 0),
      0,
    );
    return normalized;
  });
}

export function normalizeFebioResult(rawResult, inputSpec) {
  const result = rawResult ? { ...rawResult } : {};
  result.caseName ??= inputSpec.caseName;
  result.params ??= structuredCloneSafe(inputSpec.params);
  result.schedule ??= inputSpec.schedule;
  result.events ??= {};
  result.history = normalizeHistoryEntries(result.history, result, inputSpec);
  result.peaks ??= {};
  result.damage ??= {};
  result.localNc ??= initializeLocalState(NC_REGIONS);
  result.localCd ??= initializeLocalState(CD_REGIONS);
  result.membraneRegions ??= deriveMembraneStateFromLocalNc(result.localNc, inputSpec.membrane || {});
  result.damage.nc ??= summarizeLocalDamage(result.localNc, NC_REGIONS);
  result.damage.cd ??= summarizeLocalDamage(result.localCd, CD_REGIONS);
  result.damage.membrane ??= Math.max(
    ...MEMBRANE_REGIONS.map((region) => result.membraneRegions?.[region]?.damage || 0),
    0,
  );
  result.displacements ??= { cell: 0, nucleus: 0, tangentCell: 0, tangentNucleus: 0 };
  result.captureEstablished ??= true;
  result.captureMaintained ??= true;
  result.firstFailureSite ??= "none";
  result.firstFailureMode ??= "none";
  result.parameterDigest ??= inputSpec.parameterDigest;
  result.validationReport ??= inputSpec.validationReport;
  result.parameterTable ??= inputSpec.parameterTable;
  result.isPhysicalFebioResult = Boolean(result.isPhysicalFebioResult);
  result.solverMetadata = buildSolverMetadata(result.solverMetadata || {});
  result.dominantMechanism = determineDominantMechanism(result);
  result.classification = classifyRun(result);
  return result;
}

export function importFebioResult(febioResultJson, inputSpec) {
  const payload = febioResultJson.normalizedResult || febioResultJson.result || febioResultJson;
  const importedDigest =
    payload.parameterDigest ||
    febioResultJson.parameterDigest ||
    febioResultJson.exportBundle?.parameterDigest ||
    febioResultJson.canonicalSpec?.parameterDigest;
  const digestMatch = Boolean(importedDigest && inputSpec.parameterDigest && importedDigest === inputSpec.parameterDigest);

  const normalized = normalizeFebioResult(
    {
      ...payload,
      caseName: payload.caseName || inputSpec.caseName,
      params: payload.params || structuredCloneSafe(inputSpec.params),
      parameterDigest: importedDigest || inputSpec.parameterDigest,
      isPhysicalFebioResult: Boolean(payload.isPhysicalFebioResult) && digestMatch,
      solverMetadata: buildSolverMetadata({
        source: payload.solverMetadata?.source || (digestMatch ? "febio-cli" : "febio-import-nonphysical"),
        note: digestMatch ? payload.solverMetadata?.note || "" : "parameter digest mismatch or missing digest",
        ...(payload.solverMetadata || {}),
      }),
    },
    inputSpec,
  );

  normalized.resultProvenance = {
    source: normalized.solverMetadata.source,
    parameterDigest: normalized.parameterDigest,
    digestMatch,
    importTimestamp: febioResultJson.importTimestamp || new Date().toISOString(),
    exportTimestamp:
      febioResultJson.exportTimestamp ||
      febioResultJson.exportBundle?.exportTimestamp ||
      febioResultJson.canonicalSpec?.exportTimestamp ||
      null,
    fileProvenance: febioResultJson.fileProvenance || null,
  };

  return normalized;
}

export function normalizeExternalFebioPayload(payload) {
  const rawResult = payload.result || payload.normalizedResult || payload.baseResult || payload.febioResult || payload;
  const canonicalSpec = payload.canonicalSpec || payload.inputSpec || null;
  const caseName = rawResult.caseName || canonicalSpec?.caseName || "C";
  const params = rawResult.params || canonicalSpec?.params || {};
  const inputSpec = buildSimulationInput(caseName, params);
  if (canonicalSpec?.parameterDigest) {
    inputSpec.parameterDigest = canonicalSpec.parameterDigest;
  }
  return importFebioResult(payload, inputSpec);
}
