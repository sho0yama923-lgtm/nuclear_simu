/**
 * SOURCE OF TRUTH: nucleus-cytoplasm interface spec used by the FEBio main path.
 *
 * Responsibility: define the solver-primary nucleus-cytoplasm interface and native/proxy provenance.
 * Owns: buildNucleusCytoplasmInterfaceSpec.
 * Does NOT own: mesh generation, XML assembly for other domains, classification rules.
 * Primary entrypoints: buildNucleusCytoplasmInterfaceSpec.
 * Depends on: src/model/schema.ts, src/febio/mesh/index.ts.
 */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildPenalty(stiffness, criticalStress, fractureEnergy) {
  const stiffnessDriven = Math.max(stiffness * 0.08, 0.03);
  const cohesiveLength = fractureEnergy / Math.max(criticalStress, 0.05);
  const energyDriven = cohesiveLength > 0 ? (criticalStress / cohesiveLength) * 0.18 : 0.03;
  return clamp(Math.max(stiffnessDriven, energyDriven), 0.03, 0.35);
}

function buildPenaltyRamp(normalPenalty, tangentialPenalty, frictionProxy) {
  return [
    {
      step: "approach",
      normalPenalty: normalPenalty * 0.4,
      tangentialPenalty: tangentialPenalty * 0.25,
      frictionProxy: frictionProxy * 0.35,
    },
    {
      step: "hold",
      normalPenalty: normalPenalty * 0.7,
      tangentialPenalty: tangentialPenalty * 0.55,
      frictionProxy: frictionProxy * 0.7,
    },
    {
      step: "lift",
      normalPenalty,
      tangentialPenalty,
      frictionProxy,
    },
  ];
}

function buildRampMonotonicity(ramp = []) {
  let monotonic = true;
  for (let index = 1; index < ramp.length; index += 1) {
    if (
      (ramp[index].normalPenalty || 0) < (ramp[index - 1].normalPenalty || 0) ||
      (ramp[index].tangentialPenalty || 0) < (ramp[index - 1].tangentialPenalty || 0) ||
      (ramp[index].frictionProxy || 0) < (ramp[index - 1].frictionProxy || 0)
    ) {
      monotonic = false;
      break;
    }
  }
  return monotonic;
}

export function validateNucleusCytoplasmInterfaceSpec(spec) {
  const warnings = [];
  const stabilization = spec?.stabilization || {};
  const ramp = stabilization.ramp || [];
  const monotonicRamp = buildRampMonotonicity(ramp);
  const normalPenaltyRatio = (spec?.penalty?.Kn || 0) / Math.max(spec?.normalStiffness || 1e-6, 1e-6);
  const tangentialPenaltyRatio = (spec?.penalty?.Kt || 0) / Math.max(spec?.tangentialStiffness || 1e-6, 1e-6);
  const snapToSearchRatio = (spec?.cohesiveApproximation?.snapTolerance || 0) / Math.max(stabilization.searchTolerance || spec?.tolerance || 1e-6, 1e-6);
  const tractionToCriticalRatio =
    (spec?.cohesiveApproximation?.maxTraction || 0) /
    Math.max(Math.max(spec?.criticalNormalStress || 0, spec?.criticalShearStress || 0.05), 0.05);

  if (!monotonicRamp) {
    warnings.push("stabilization ramp is not monotonic");
  }
  if (normalPenaltyRatio < 0.03 || normalPenaltyRatio > 0.35) {
    warnings.push("normal penalty ratio drifted outside the sticky stabilization band");
  }
  if (tangentialPenaltyRatio < 0.03 || tangentialPenaltyRatio > 0.35) {
    warnings.push("tangential penalty ratio drifted outside the sticky stabilization band");
  }
  if (snapToSearchRatio > 3) {
    warnings.push("snap tolerance is too large relative to search tolerance");
  }
  if ((stabilization.augmentation?.maxPasses || 0) < 6) {
    warnings.push("augmentation max passes are too low for the current sticky stabilization policy");
  }
  if (tractionToCriticalRatio > 0.85) {
    warnings.push("cohesive max traction is too close to the critical traction limit");
  }

  return {
    valid: warnings.length === 0,
    warnings,
    diagnostics: {
      monotonicRamp,
      rampSteps: ramp.map((entry) => entry.step),
      normalPenaltyRatio,
      tangentialPenaltyRatio,
      snapToSearchRatio,
      tractionToCriticalRatio,
    },
  };
}

export function buildNucleusCytoplasmInterfaceSpec(inputSpec, mesh) {
  const normalPenalty = buildPenalty(
    inputSpec.interfaces.Kn_nc,
    inputSpec.interfaces.sig_nc_crit,
    inputSpec.interfaces.Gc_nc,
  );
  const tangentialPenalty = buildPenalty(
    inputSpec.interfaces.Kt_nc,
    inputSpec.interfaces.tau_nc_crit,
    inputSpec.interfaces.Gc_nc,
  );
  const frictionProxy = clamp(0.12 + (inputSpec.operation?.mu_p || 0) * 0.25, 0.12, 0.28);
  const spec = {
    type: "sticky",
    status: "partial-true-cohesive / sticky-active",
    mode: "solver-primary cohesive-approximation",
    surfacePair: mesh.surfacePairs.nucleus_cytoplasm_pair,
    normalStiffness: inputSpec.interfaces.Kn_nc,
    tangentialStiffness: inputSpec.interfaces.Kt_nc,
    criticalNormalStress: inputSpec.interfaces.sig_nc_crit,
    criticalShearStress: inputSpec.interfaces.tau_nc_crit,
    fractureEnergy: inputSpec.interfaces.Gc_nc,
    penalty: {
      Kn: normalPenalty,
      Kt: tangentialPenalty,
    },
    tolerance: 0.08,
    stabilization: {
      searchTolerance: 0.08,
      symmetricStiffness: false,
      augmentation: {
        enabled: true,
        minPasses: 0,
        maxPasses: 12,
      },
      ramp: buildPenaltyRamp(normalPenalty, tangentialPenalty, frictionProxy),
    },
    cohesiveApproximation: {
      penalty: normalPenalty,
      tangentialPenalty,
      maxTraction: clamp(
        Math.max(inputSpec.interfaces.sig_nc_crit * 0.55, inputSpec.interfaces.tau_nc_crit * 0.7),
        0.03,
        0.25,
      ),
      snapTolerance: clamp(
        (inputSpec.interfaces.Gc_nc / Math.max(inputSpec.interfaces.sig_nc_crit, 0.05)) * 0.28,
        0.02,
        0.25,
      ),
      frictionProxy,
    },
    nativeObservation: {
      normal: "native-face-data-preferred",
      shear: "proxy-fallback-explicit",
      damage: "native-face-data-preferred",
      detachment: "damage-plus-geometry",
    },
    notes: [
      "serialized as a sticky-contact cohesive approximation with soft-start stabilization",
      "normal/tangential stiffness and traction limits are preserved for later true cohesive serialization",
      "penalty and friction are ramped through approach/hold before full lift activation",
      "detachment should migrate from proxy-assisted observation toward native cohesive output",
    ],
  };
  spec.validation = validateNucleusCytoplasmInterfaceSpec(spec);
  if (spec.validation.valid) {
    spec.status += " / stabilization-validated";
    spec.notes.push("stabilization validation passed for the sticky cohesive approximation");
  } else {
    spec.status += " / stabilization-review-needed";
    spec.notes.push("stabilization validation reported warnings for the sticky cohesive approximation");
  }
  return spec;
}
