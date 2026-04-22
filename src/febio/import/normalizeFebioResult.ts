import {
  CD_REGIONS,
  MEMBRANE_REGIONS,
  NC_REGIONS,
  structuredCloneSafe,
} from "../../model/types.ts";
import {
  buildSimulationInput,
  deriveMembraneStateFromLocalNc,
  initializeLocalState,
  initializeMembraneState,
  summarizeLocalDamage,
} from "../../model/schema.ts";
import { assessDetachment, classifyRun, determineDominantMechanism } from "../../results/classification.ts";

/**
 * SOURCE OF TRUTH: FEBio result normalization for canonical import.
 *
 * Responsibility: normalize FEBio and FEBio-like result payloads into the canonical result shape.
 * Owns: normalizeFebioResult, importFebioResult.
 * Does NOT own: FEBio export assembly, schema defaults, UI display rules.
 * Primary entrypoints: normalizeFebioResult, importFebioResult.
 * Depends on: src/model/schema.ts, src/results/classification.ts.
 */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildSolverMetadata(overrides = {}) {
  return {
    solverMode: "febio",
    source: "febio-import",
    note: "",
    ...overrides,
  };
}

function pickFiniteNumber(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function toRegionEntries(source, regions) {
  if (!source) {
    return [];
  }
  if (Array.isArray(source)) {
    return source
      .filter((entry) => entry && regions.includes(entry.region))
      .map((entry) => [entry.region, entry]);
  }
  return regions
    .filter((region) => source[region])
    .map((region) => [region, source[region]]);
}

function deriveDamageFromRegionMetrics(regionSource) {
  const explicitDamage = pickFiniteNumber(
    regionSource?.damage,
    regionSource?.damageRatio,
    regionSource?.failureRatio,
    regionSource?.debondedFraction,
    regionSource?.contactLoss,
  );
  if (explicitDamage != null) {
    return clamp(explicitDamage, 0, 1);
  }

  const contactFraction = pickFiniteNumber(
    regionSource?.contactFraction,
    regionSource?.contactRatio,
    regionSource?.bondedFraction,
  );
  if (contactFraction != null) {
    return clamp(1 - contactFraction, 0, 1);
  }

  return null;
}

function buildNativeLocalState(result, regions) {
  const nativeSource =
    result?.localNcNative ||
    result?.nativeLocalNc ||
    result?.nativeFaceData?.localNc ||
    result?.faceData?.localNc ||
    result?.nativeFaceData?.nucleusCytoplasmRegions ||
    result?.faceData?.nucleusCytoplasmRegions ||
    null;

  if (!nativeSource) {
    return null;
  }

  const nativeState = initializeLocalState(regions);
  let hasNativeMetrics = false;

  toRegionEntries(nativeSource, regions).forEach(([region, regionSource]) => {
    const normalStress = pickFiniteNumber(
      regionSource?.normalStress,
      regionSource?.contactPressure,
      regionSource?.pressure,
      regionSource?.tractionNormal,
      regionSource?.normalTraction,
    );
    const shearStress = pickFiniteNumber(
      regionSource?.shearStress,
      regionSource?.shearTraction,
      regionSource?.tractionTangential,
      regionSource?.tangentialTraction,
    );
    const peakNormal = pickFiniteNumber(
      regionSource?.peakNormal,
      regionSource?.maxNormalStress,
      regionSource?.peakContactPressure,
      normalStress,
    );
    const peakShear = pickFiniteNumber(
      regionSource?.peakShear,
      regionSource?.maxShearStress,
      regionSource?.peakShearTraction,
      shearStress,
    );
    const damage = deriveDamageFromRegionMetrics(regionSource);

    if (normalStress == null && shearStress == null && peakNormal == null && peakShear == null && damage == null) {
      return;
    }

    hasNativeMetrics = true;
    nativeState[region] = {
      ...nativeState[region],
      normalStress: normalStress ?? nativeState[region].normalStress,
      shearStress: shearStress ?? nativeState[region].shearStress,
      peakNormal: peakNormal ?? nativeState[region].peakNormal,
      peakShear: peakShear ?? nativeState[region].peakShear,
      damage: damage ?? nativeState[region].damage,
      firstFailureTime: regionSource?.firstFailureTime ?? nativeState[region].firstFailureTime,
      firstFailureMode: regionSource?.firstFailureMode ?? nativeState[region].firstFailureMode,
      provenance: regionSource?.provenance || "native-face-data-preferred",
    };
  });

  return hasNativeMetrics ? nativeState : null;
}

function mergeLocalState(regions, source, nativeFallbackSource = null) {
  const merged = initializeLocalState(regions);
  regions.forEach((region) => {
    if (nativeFallbackSource?.[region]) {
      merged[region] = {
        ...merged[region],
        ...nativeFallbackSource[region],
      };
    }
    if (source?.[region]) {
      merged[region] = {
        ...merged[region],
        ...source[region],
      };
    }
  });
  return merged;
}

function mergeMembraneState(source, localNc, membraneSpec) {
  const derived = deriveMembraneStateFromLocalNc(localNc, membraneSpec);
  const merged = initializeMembraneState(MEMBRANE_REGIONS);
  MEMBRANE_REGIONS.forEach((region) => {
    merged[region] = {
      ...merged[region],
      ...derived[region],
      ...(source?.[region] || {}),
    };
  });
  return merged;
}

function normalizeDetachmentMetrics(result, history = []) {
  const latestHistory = history[history.length - 1] || null;
  const explicitMetrics = result?.detachmentMetrics || {};
  const historyMetrics = latestHistory?.detachmentMetrics || {};
  const nativeFaceMetrics = result?.nativeFaceData || result?.faceData || {};
  const regionMetrics = toRegionEntries(
    nativeFaceMetrics.nucleusCytoplasmRegions || nativeFaceMetrics.localNc,
    NC_REGIONS,
  );
  const regionContactFractions = regionMetrics
    .map(([, regionSource]) =>
      pickFiniteNumber(regionSource?.contactFraction, regionSource?.contactRatio, regionSource?.bondedFraction))
    .filter((value) => value != null);
  const nativeContactAreaRatio =
    pickFiniteNumber(nativeFaceMetrics.contactAreaRatio, nativeFaceMetrics.interfaceContactAreaRatio) ??
    (regionContactFractions.length
      ? regionContactFractions.reduce((sum, value) => sum + value, 0) / regionContactFractions.length
      : null);
  const nativeRelativeDisplacement = pickFiniteNumber(
    nativeFaceMetrics.relativeNucleusDisplacement,
    nativeFaceMetrics.nucleusRelativeDisplacement,
  );
  const contactAreaRatio =
    explicitMetrics.contactAreaRatio ??
    result?.contactAreaRatio ??
    nativeContactAreaRatio ??
    historyMetrics.contactAreaRatio ??
    latestHistory?.contactAreaRatio ??
    1;
  const relativeNucleusDisplacement =
    explicitMetrics.relativeNucleusDisplacement ??
    result?.relativeNucleusDisplacement ??
    nativeRelativeDisplacement ??
    result?.displacements?.nucleus ??
    historyMetrics.relativeNucleusDisplacement ??
    latestHistory?.relativeNucleusDisplacement ??
    latestHistory?.displacements?.nucleus ??
    0;

  return {
    contactAreaRatio,
    relativeNucleusDisplacement,
    provenance:
      explicitMetrics.provenance ||
      (nativeContactAreaRatio != null || nativeRelativeDisplacement != null ? "native-face-data-preferred" : null) ||
      historyMetrics.provenance ||
      (contactAreaRatio < 1 || relativeNucleusDisplacement > 0 ? "proxy/native" : "damage-only-fallback"),
  };
}

function buildDerivedDetachmentEvent(key, time, assessment, source) {
  const detail =
    key === "detachmentComplete"
      ? `derived detachment completion (${assessment.mode}, damage+geometry)`
      : `derived detachment start (${assessment.mode}, damage+geometry)`;
  return {
    time,
    detail,
    source,
  };
}

function buildExplicitDetachmentEvent(key, candidate, defaultSource, fallbackTime = null) {
  if (candidate == null) {
    return null;
  }

  if (typeof candidate === "number" || typeof candidate === "string") {
    const time = pickFiniteNumber(candidate) ?? fallbackTime;
    if (time == null) {
      return null;
    }
    return {
      time,
      detail:
        key === "detachmentComplete"
          ? "explicit detachment completion (damage+geometry contract)"
          : "explicit detachment start (damage+geometry contract)",
      source: defaultSource,
    };
  }

  if (typeof candidate !== "object") {
    return null;
  }

  const time =
    pickFiniteNumber(
      candidate.time,
      candidate.at,
      candidate.stepTime,
      candidate.timestamp,
      candidate.timeValue,
    ) ?? fallbackTime;

  if (time == null) {
    return null;
  }

  return {
    time,
    detail:
      candidate.detail ||
      candidate.note ||
      candidate.reason ||
      (key === "detachmentComplete"
        ? "explicit detachment completion (damage+geometry contract)"
        : "explicit detachment start (damage+geometry contract)"),
    source: candidate.source || candidate.provenance || defaultSource,
  };
}

function extractExplicitDetachmentEvents(result) {
  const scanCandidates = (key, candidates) => {
    for (const candidate of candidates) {
      const normalized = buildExplicitDetachmentEvent(key, candidate.value, candidate.source, candidate.fallbackTime);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  };

  const history = Array.isArray(result?.history) ? result.history : [];
  const startCandidates = [
    { value: result?.events?.detachmentStart, source: "payload-events" },
    { value: result?.detachmentStart, source: "payload-root" },
    { value: result?.detachment?.start, source: "payload-detachment-object" },
    { value: result?.detachment?.startTime, source: "payload-detachment-object" },
    { value: result?.detachmentEvents?.start, source: "payload-detachment-events" },
    { value: result?.nativeFaceData?.detachmentStart, source: "native-face-data" },
    { value: result?.nativeFaceData?.detachmentStartTime, source: "native-face-data" },
    { value: result?.faceData?.detachmentStart, source: "native-face-data" },
    { value: result?.faceData?.detachmentStartTime, source: "native-face-data" },
    ...history.map((entry) => ({
      value: entry?.events?.detachmentStart || entry?.detachmentStart || entry?.detachment?.start || entry?.detachment?.startTime,
      source: "history-explicit",
      fallbackTime: entry?.time ?? null,
    })),
  ];
  const completeCandidates = [
    { value: result?.events?.detachmentComplete, source: "payload-events" },
    { value: result?.detachmentComplete, source: "payload-root" },
    { value: result?.detachment?.complete, source: "payload-detachment-object" },
    { value: result?.detachment?.completeTime, source: "payload-detachment-object" },
    { value: result?.detachmentEvents?.complete, source: "payload-detachment-events" },
    { value: result?.nativeFaceData?.detachmentComplete, source: "native-face-data" },
    { value: result?.nativeFaceData?.detachmentCompleteTime, source: "native-face-data" },
    { value: result?.faceData?.detachmentComplete, source: "native-face-data" },
    { value: result?.faceData?.detachmentCompleteTime, source: "native-face-data" },
    ...history.map((entry) => ({
      value:
        entry?.events?.detachmentComplete ||
        entry?.detachmentComplete ||
        entry?.detachment?.complete ||
        entry?.detachment?.completeTime,
      source: "history-explicit",
      fallbackTime: entry?.time ?? null,
    })),
  ];

  return {
    detachmentStart: scanCandidates("detachmentStart", startCandidates),
    detachmentComplete: scanCandidates("detachmentComplete", completeCandidates),
  };
}

function supplementDetachmentEvents(result) {
  result.events ??= {};
  const explicitEvents = extractExplicitDetachmentEvents(result);
  let detachmentStart = explicitEvents.detachmentStart || null;
  let detachmentComplete = explicitEvents.detachmentComplete || null;

  for (const entry of result.history || []) {
    const assessment = assessDetachment(entry);
    if (!detachmentStart && assessment.start) {
      detachmentStart = buildDerivedDetachmentEvent(
        "detachmentStart",
        entry.time ?? null,
        assessment,
        "history-derived",
      );
    }
    if (!detachmentComplete && assessment.complete) {
      detachmentComplete = buildDerivedDetachmentEvent(
        "detachmentComplete",
        entry.time ?? null,
        assessment,
        "history-derived",
      );
    }
    if (detachmentStart && detachmentComplete) {
      break;
    }
  }

  const currentAssessment = assessDetachment(result);
  const fallbackTime = result.history?.[result.history.length - 1]?.time ?? null;
  if (!detachmentStart && currentAssessment.start) {
    detachmentStart = buildDerivedDetachmentEvent(
      "detachmentStart",
      fallbackTime,
      currentAssessment,
      "final-state-derived",
    );
  }
  if (!detachmentComplete && currentAssessment.complete) {
    detachmentComplete = buildDerivedDetachmentEvent(
      "detachmentComplete",
      fallbackTime,
      currentAssessment,
      "final-state-derived",
    );
  }
  if (!detachmentStart && detachmentComplete) {
    detachmentStart = buildDerivedDetachmentEvent(
      "detachmentStart",
      detachmentComplete.time ?? fallbackTime,
      currentAssessment,
      "complete-state-backfill",
    );
  }

  if (detachmentStart) {
    result.events.detachmentStart = detachmentStart;
  }
  if (detachmentComplete) {
    result.events.detachmentComplete = detachmentComplete;
  }
}

function normalizeHistoryEntries(history, inputSpec) {
  return (history || []).map((entry) => {
    const nativeLocalNc = buildNativeLocalState(entry, NC_REGIONS);
    const normalized = {
      ...entry,
      localNc: mergeLocalState(NC_REGIONS, entry.localNc, nativeLocalNc),
      localCd: mergeLocalState(CD_REGIONS, entry.localCd),
    };
    normalized.membraneRegions = mergeMembraneState(
      entry.membraneRegions,
      normalized.localNc,
      inputSpec.membrane || {},
    );
    normalized.damageNc ??= summarizeLocalDamage(normalized.localNc, NC_REGIONS);
    normalized.damageCd ??= summarizeLocalDamage(normalized.localCd, CD_REGIONS);
    normalized.damageMembrane ??= Math.max(
      ...MEMBRANE_REGIONS.map((region) => normalized.membraneRegions?.[region]?.damage || 0),
      0,
    );
    normalized.detachmentMetrics = normalizeDetachmentMetrics(normalized);
    return normalized;
  });
}

export function normalizeFebioResult(rawResult, inputSpec) {
  const result = rawResult ? { ...rawResult } : {};
  const nativeLocalNc = buildNativeLocalState(result, NC_REGIONS);
  result.caseName ??= inputSpec.caseName;
  result.params ??= structuredCloneSafe(inputSpec.params);
  result.schedule ??= inputSpec.schedule;
  result.events ??= {};
  result.history = normalizeHistoryEntries(result.history, inputSpec);
  result.peaks ??= {};
  result.damage ??= {};
  result.localNc = mergeLocalState(NC_REGIONS, result.localNc, nativeLocalNc);
  result.localCd = mergeLocalState(CD_REGIONS, result.localCd);
  result.membraneRegions = mergeMembraneState(result.membraneRegions, result.localNc, inputSpec.membrane || {});
  result.damage.nc ??= summarizeLocalDamage(result.localNc, NC_REGIONS);
  result.damage.cd ??= summarizeLocalDamage(result.localCd, CD_REGIONS);
  result.damage.membrane ??= Math.max(
    ...MEMBRANE_REGIONS.map((region) => result.membraneRegions?.[region]?.damage || 0),
    0,
  );
  result.displacements ??= { cell: 0, nucleus: 0, tangentCell: 0, tangentNucleus: 0 };
  result.detachmentMetrics = normalizeDetachmentMetrics(result, result.history);
  result.captureEstablished ??= true;
  result.captureMaintained ??= true;
  result.firstFailureSite ??= "none";
  result.firstFailureMode ??= "none";
  result.parameterDigest ??= inputSpec.parameterDigest;
  result.validationReport ??= inputSpec.validationReport;
  result.parameterTable ??= inputSpec.parameterTable;
  result.isPhysicalFebioResult = Boolean(result.isPhysicalFebioResult);
  result.solverMetadata = buildSolverMetadata(result.solverMetadata || {});
  supplementDetachmentEvents(result);
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
    detachmentEvents: {
      start: normalized.events.detachmentStart?.source || null,
      complete: normalized.events.detachmentComplete?.source || null,
    },
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
