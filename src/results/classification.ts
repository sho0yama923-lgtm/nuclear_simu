import { CLASSIFICATION_THRESHOLDS, NC_REGIONS } from "../model/types.ts";

/**
 * SOURCE OF TRUTH: canonical run classification and detachment interpretation.
 *
 * Responsibility: classify normalized results with native-first detachment logic.
 * Owns: classifyRun, determineDominantMechanism, detachment assessment helpers.
 * Does NOT own: parameter schema, result normalization, FEBio XML export.
 * Primary entrypoints: classifyRun, determineDominantMechanism.
 * Depends on: src/model/types.ts.
 */

function getLocalNcState(result, region) {
  return result?.localNc?.[region] || {};
}

function hasNativeNcSignal(result) {
  return NC_REGIONS.some((region) => String(getLocalNcState(result, region).provenance || "").includes("native"));
}

function maxNcDamage(result) {
  return Math.max(
    result?.damage?.nc || 0,
    ...NC_REGIONS.map((region) => getLocalNcState(result, region).damage || 0),
  );
}

export function findEarliestLocalFailure(result) {
  const candidates = [];
  Object.entries(result?.localNc || {}).forEach(([region, state]) => {
    if (state?.firstFailureTime != null) {
      candidates.push({
        time: state.firstFailureTime,
        site: `nc:${region}`,
        mode: state.firstFailureMode || "shear",
      });
    }
  });
  Object.entries(result?.localCd || {}).forEach(([region, state]) => {
    if (state?.firstFailureTime != null) {
      candidates.push({
        time: state.firstFailureTime,
        site: `cd:${region}`,
        mode: state.firstFailureMode || "shear",
      });
    }
  });
  Object.entries(result?.membraneRegions || {}).forEach(([region, state]) => {
    if (state?.firstFailureTime != null) {
      candidates.push({
        time: state.firstFailureTime,
        site: `membrane:${region}`,
        mode: "membrane",
      });
    }
  });
  if (result?.events?.tipSlip) {
    candidates.push({
      time: result.events.tipSlip.time,
      site: "pipette:hold",
      mode: "slip",
    });
  }
  if (!candidates.length) {
    return { site: "none", mode: "none" };
  }
  candidates.sort((left, right) => left.time - right.time);
  return { site: candidates[0].site, mode: candidates[0].mode };
}

export function assessDetachment(result) {
  const nativePreferred = hasNativeNcSignal(result);
  const nativeDamage = maxNcDamage(result);
  const geometryRatio =
    result?.detachmentMetrics?.contactAreaRatio ??
    result?.contactAreaRatio ??
    result?.interfaceAreaRatio ??
    1;
  const relativeDisplacement =
    result?.detachmentMetrics?.relativeNucleusDisplacement ??
    result?.displacements?.nucleus ??
    0;

  const start =
    nativeDamage >= CLASSIFICATION_THRESHOLDS.detachmentStartDamage ||
    geometryRatio <= 0.6 ||
    relativeDisplacement >= CLASSIFICATION_THRESHOLDS.detachmentDisplacement;
  const complete =
    nativeDamage >= CLASSIFICATION_THRESHOLDS.detachmentCompleteDamage &&
    (geometryRatio <= CLASSIFICATION_THRESHOLDS.detachmentAreaRatio ||
      relativeDisplacement >= CLASSIFICATION_THRESHOLDS.detachmentDisplacement * 1.5);

  return {
    start,
    complete,
    nativePreferred,
    geometryRatio,
    relativeDisplacement,
    mode: nativePreferred ? "native" : "proxy-fallback-explicit",
  };
}

export function determineDominantMechanism(result) {
  const firstFailureSite =
    result?.firstFailureSite && result.firstFailureSite !== "none"
      ? result.firstFailureSite
      : findEarliestLocalFailure(result).site;

  if (firstFailureSite?.startsWith("membrane:")) {
    return "membrane_rupture";
  }
  if (
    firstFailureSite?.startsWith("cd:") ||
    (result?.damage?.cd || 0) > (result?.damage?.nc || 0) * 0.65
  ) {
    return "dish_detachment";
  }
  if ((result?.peaks?.peakMomentProxy || 0) > (result?.peaks?.peakNcShear || 0) * 0.95) {
    return "rotational_moment";
  }
  return "local_shear";
}

export function applyRunClassification(result, classificationSource = null) {
  const earliestFailure = findEarliestLocalFailure(result);
  if (!result.firstFailureSite || result.firstFailureSite === "none") {
    result.firstFailureSite = earliestFailure.site;
  }
  if (!result.firstFailureMode || result.firstFailureMode === "none") {
    result.firstFailureMode = earliestFailure.mode;
  }
  result.dominantMechanism = determineDominantMechanism(result);
  result.classification = classifyRun(result);
  result.dominantMechanism = determineDominantMechanism(result);
  if (classificationSource) {
    result.classificationSource = classificationSource;
  }
  return result;
}

export function classifyRun(result) {
  const detachment = assessDetachment(result);
  const ncStart = result?.events?.ncDamageStart?.time ?? Infinity;
  const cdStart = result?.events?.cdDamageStart?.time ?? Infinity;
  const tipSlipTime = result?.events?.tipSlip?.time ?? Infinity;

  if (!result?.captureEstablished) {
    return "missed_target";
  }

  if (tipSlipTime < 2.3) {
    return "early_slip";
  }

  if (
    !result?.captureMaintained &&
    (result?.damage?.nc || 0) < 0.28 &&
    (result?.damage?.cd || 0) < 0.16 &&
    (result?.damage?.membrane || 0) < 0.22
  ) {
    return "insufficient_hold";
  }

  if (
    (result?.damage?.cd || 0) > CLASSIFICATION_THRESHOLDS.cellDishDamage ||
    cdStart < ncStart ||
    String(result?.firstFailureSite || "").startsWith("cd:") ||
    result?.dominantMechanism === "dish_detachment"
  ) {
    return "cell_attached_to_tip";
  }

  if (
    detachment.complete ||
    result?.events?.detachmentComplete ||
    result?.events?.detachmentStart
  ) {
    return "nucleus_detached";
  }

  if (
    detachment.start &&
    (result?.damage?.cd || 0) < 0.2 &&
    ((result?.membraneRegions?.top_neck?.damage || 0) > CLASSIFICATION_THRESHOLDS.membraneDamage ||
      result?.events?.membraneDamageStart)
  ) {
    return "nucleus_detached";
  }

  if ((result?.peaks?.peakMembraneStrain || 0) > 0.14 || (result?.peaks?.peakCytoplasmStress || 0) > 0.32) {
    return "deformation_only";
  }

  if (!result?.captureMaintained) {
    return "insufficient_hold";
  }

  return "no_capture_general";
}
