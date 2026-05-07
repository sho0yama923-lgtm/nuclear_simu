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
  return NC_REGIONS.some((region) => {
    const state = getLocalNcState(result, region);
    return hasNativeNcStateSignal(state);
  });
}

function hasNativeNcStateSignal(state) {
  return (
    String(state?.provenance || "").includes("native") ||
    String(state?.sourceNormal || "").includes("native") ||
    String(state?.sourceDamage || "").includes("native") ||
    String(state?.sourceShear || "").includes("native")
  );
}

function maxNcDamage(result) {
  return Math.max(
    result?.damage?.nc || 0,
    ...NC_REGIONS.map((region) => getLocalNcState(result, region).damage || 0),
  );
}

function maxNativeNcDamage(result) {
  const nativeDamages = NC_REGIONS
    .map((region) => getLocalNcState(result, region))
    .filter((state) => hasNativeNcStateSignal(state))
    .map((state) => state.damage || 0);
  return nativeDamages.length ? Math.max(...nativeDamages, 0) : 0;
}

function hasPressureDrivenSuctionResponse(result) {
  const response = result?.suctionPressureResponse || {};
  return response.active === true || response.normalDisplacementActive === true;
}

function isGlobalFanoutDamage(state) {
  const detail = state?.sourceDamageDetail || {};
  return (
    detail.fanoutFallback === true ||
    detail.regionScope === "global" ||
    detail.payloadRegion === "__global"
  );
}

function reliableCdDamage(result) {
  const states = Object.values(result?.localCd || {});
  const reliableStates = states.filter((state) => !isGlobalFanoutDamage(state));
  if (reliableStates.length) {
    return Math.max(...reliableStates.map((state) => state?.damage || 0), 0);
  }
  return states.length ? 0 : result?.damage?.cd || 0;
}

function hasReliableCdFirstFailure(result) {
  const site = String(result?.firstFailureSite || "");
  if (!site.startsWith("cd:")) {
    return false;
  }
  const region = site.slice(3);
  const state = result?.localCd?.[region];
  return state ? !isGlobalFanoutDamage(state) : true;
}

function hasReliableCdDamageStart(result) {
  return Object.values(result?.localCd || {}).some(
    (state) => state?.firstFailureTime != null && !isGlobalFanoutDamage(state),
  );
}

export function buildDetachmentEvidence(result) {
  const nativePreferred = hasNativeNcSignal(result);
  const ncDamage = maxNcDamage(result);
  const nativeDamage = maxNativeNcDamage(result);
  const pressureDrivenSuctionResponse = hasPressureDrivenSuctionResponse(result);
  const nativeNcAvailability = result?.nativeNcInterfaceEvidence || {};
  const geometryRatio =
    result?.detachmentMetrics?.contactAreaRatio ??
    result?.contactAreaRatio ??
    result?.interfaceAreaRatio ??
    1;
  const relativeDisplacement =
    result?.detachmentMetrics?.relativeNucleusDisplacement ??
    result?.displacements?.nucleus ??
    0;
  const nativeNcFailureActive = nativeDamage >= CLASSIFICATION_THRESHOLDS.detachmentStartDamage;
  const proxyGeometryActive = geometryRatio <= 0.6;
  const proxyDisplacementActive = relativeDisplacement >= CLASSIFICATION_THRESHOLDS.detachmentDisplacement;
  const start = nativeNcFailureActive || proxyGeometryActive || proxyDisplacementActive;
  const complete =
    nativeDamage >= CLASSIFICATION_THRESHOLDS.detachmentCompleteDamage &&
    (geometryRatio <= CLASSIFICATION_THRESHOLDS.detachmentAreaRatio ||
      relativeDisplacement >= CLASSIFICATION_THRESHOLDS.detachmentDisplacement * 1.5);
  const primarySource = nativeNcFailureActive
    ? "native-nc-interface"
    : proxyDisplacementActive
      ? "proxy-displacement"
      : proxyGeometryActive
        ? "proxy-contact-area"
        : pressureDrivenSuctionResponse
          ? "pressure-response-only"
          : "none";

  return {
    start,
    complete,
    primarySource,
    nativePreferred,
    mode: nativePreferred ? "native" : "proxy-fallback-explicit",
    pressureDrivenSuctionResponse: {
      active: pressureDrivenSuctionResponse,
      source: result?.suctionPressureResponse?.source || "unavailable",
      observedNodeCount: result?.suctionPressureResponse?.observedNodeCount ?? null,
      normalDisplacementActive: result?.suctionPressureResponse?.normalDisplacementActive === true,
    },
    nativeNcInterfaceFailure: {
      active: nativeNcFailureActive,
      damage: nativeDamage,
      startThreshold: CLASSIFICATION_THRESHOLDS.detachmentStartDamage,
      completeThreshold: CLASSIFICATION_THRESHOLDS.detachmentCompleteDamage,
      source: nativePreferred ? "native-local-nc" : "unavailable",
      outputAvailable: nativeNcAvailability.available ?? nativePreferred,
      unavailableReason: nativePreferred || nativeNcAvailability.available === true
        ? ""
        : nativeNcAvailability.reason || "native nucleus-cytoplasm interface failure evidence is unavailable in the normalized result",
      details: nativeNcAvailability.details || null,
    },
    sharedNodeNcObservation: {
      available: result?.sharedNodeNcEvidence?.available === true,
      source: result?.sharedNodeNcEvidence?.source || "unavailable",
      compatibleWithSharedNodeCoupling: result?.sharedNodeNcEvidence?.compatibleWithSharedNodeCoupling === true,
      observedNodeCount: result?.sharedNodeNcEvidence?.observedNodeCount ?? 0,
      maxRelativeNormalDisplacement: result?.sharedNodeNcEvidence?.maxRelativeNormalDisplacement ?? 0,
      maxRelativeShearDisplacement: result?.sharedNodeNcEvidence?.maxRelativeShearDisplacement ?? 0,
      maxSharedDisplacement: result?.sharedNodeNcEvidence?.maxSharedDisplacement ?? 0,
      interpretation: result?.sharedNodeNcEvidence?.interpretation || "",
    },
    proxyDisplacement: {
      active: proxyDisplacementActive,
      value: relativeDisplacement,
      threshold: CLASSIFICATION_THRESHOLDS.detachmentDisplacement,
      source: "detachmentMetrics.relativeNucleusDisplacement",
    },
    proxyGeometry: {
      active: proxyGeometryActive,
      contactAreaRatio: geometryRatio,
      startThreshold: 0.6,
      completeThreshold: CLASSIFICATION_THRESHOLDS.detachmentAreaRatio,
      source: "detachmentMetrics.contactAreaRatio",
    },
    interpretation: nativeNcFailureActive
      ? "detachment is backed by native nucleus-cytoplasm interface damage"
      : ncDamage >= CLASSIFICATION_THRESHOLDS.detachmentStartDamage || start
        ? "detachment is proxy-derived; do not read it as native nucleus-cytoplasm interface failure"
        : pressureDrivenSuctionResponse
          ? "pressure response is active without detachment-start evidence"
          : "no detachment evidence is active",
  };
}

export function findEarliestLocalFailure(result) {
  const candidates = [];
  const nativeNcCandidates = [];
  Object.entries(result?.localNc || {}).forEach(([region, state]) => {
    if (state?.firstFailureTime != null) {
      const candidate = {
        time: state.firstFailureTime,
        site: `nc:${region}`,
        mode: state.firstFailureMode || "shear",
      };
      if (hasNativeNcStateSignal(state)) {
        nativeNcCandidates.push(candidate);
      }
      candidates.push(candidate);
    }
  });
  if (nativeNcCandidates.length) {
    nativeNcCandidates.sort((left, right) => left.time - right.time);
    return { site: nativeNcCandidates[0].site, mode: nativeNcCandidates[0].mode };
  }
  Object.entries(result?.localCd || {}).forEach(([region, state]) => {
    if (isGlobalFanoutDamage(state)) {
      return;
    }
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
  const evidence = buildDetachmentEvidence(result);

  return {
    start: evidence.start,
    complete: evidence.complete,
    nativePreferred: evidence.nativePreferred,
    pressureDrivenSuctionResponse: evidence.pressureDrivenSuctionResponse.active,
    geometryRatio: evidence.proxyGeometry.contactAreaRatio,
    relativeDisplacement: evidence.proxyDisplacement.value,
    mode: evidence.mode,
    primarySource: evidence.primarySource,
    evidence,
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
    hasReliableCdFirstFailure({ ...result, firstFailureSite }) ||
    reliableCdDamage(result) > (result?.damage?.nc || 0) * 0.65
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
  result.detachmentEvidence = buildDetachmentEvidence(result);
  result.classification = classifyRun(result);
  result.dominantMechanism = determineDominantMechanism(result);
  result.detachmentEvidence = buildDetachmentEvidence(result);
  if (classificationSource) {
    result.classificationSource = classificationSource;
  }
  return result;
}

export function classifyRun(result) {
  const detachment = assessDetachment(result);
  const ncStart = result?.events?.ncDamageStart?.time ?? Infinity;
  const cdStart = hasReliableCdDamageStart(result) ? result?.events?.cdDamageStart?.time ?? Infinity : Infinity;
  const tipSlipTime = result?.events?.tipSlip?.time ?? Infinity;
  const pressureDrivenCapture = detachment.pressureDrivenSuctionResponse;
  const cdDamage = reliableCdDamage(result);

  if (!result?.captureEstablished && !pressureDrivenCapture) {
    return "missed_target";
  }

  if (tipSlipTime < 2.3) {
    return "early_slip";
  }

  if (
    !result?.captureMaintained &&
    !pressureDrivenCapture &&
    (result?.damage?.nc || 0) < 0.28 &&
    (result?.damage?.cd || 0) < 0.16 &&
    (result?.damage?.membrane || 0) < 0.22
  ) {
    return "insufficient_hold";
  }

  if (
    cdDamage > CLASSIFICATION_THRESHOLDS.cellDishDamage ||
    cdStart < ncStart ||
    hasReliableCdFirstFailure(result) ||
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

  if (!result?.captureMaintained && !pressureDrivenCapture) {
    return "insufficient_hold";
  }

  return "no_capture_general";
}
