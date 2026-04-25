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
    { step: "approach", normalPenalty: normalPenalty * 0.4, tangentialPenalty: tangentialPenalty * 0.25, frictionProxy: frictionProxy * 0.35 },
    { step: "hold", normalPenalty: normalPenalty * 0.7, tangentialPenalty: tangentialPenalty * 0.55, frictionProxy: frictionProxy * 0.7 },
    { step: "lift", normalPenalty, tangentialPenalty, frictionProxy }
  ];
}

function validateNucleusCytoplasm(spec) {
  const ramp = spec.stabilization?.ramp || [];
  const monotonicRamp = ramp.every((entry, index) => {
    if (index === 0) return true;
    const previous = ramp[index - 1];
    return entry.normalPenalty >= previous.normalPenalty && entry.tangentialPenalty >= previous.tangentialPenalty;
  });
  const warnings = monotonicRamp ? [] : ["stabilization ramp is not monotonic"];
  return {
    valid: warnings.length === 0,
    warnings,
    diagnostics: {
      monotonicRamp,
      rampSteps: ramp.map((entry) => entry.step),
      normalPenaltyRatio: spec.penalty.Kn / Math.max(spec.normalStiffness, 1e-6),
      tangentialPenaltyRatio: spec.penalty.Kt / Math.max(spec.tangentialStiffness, 1e-6)
    }
  };
}

export function buildNativeInterfaces(spec, mesh) {
  const nc = spec.contacts.nucleusCytoplasm;
  const pipetteNucleus = spec.contacts.pipetteNucleus;
  const normalPenalty = buildPenalty(nc.normalStiffness, nc.criticalNormalStress, nc.fractureEnergy);
  const tangentialPenalty = buildPenalty(nc.tangentialStiffness, nc.criticalShearStress, nc.fractureEnergy);
  const frictionProxy = clamp(0.12 + (pipetteNucleus.friction || 0) * 0.25, 0.12, 0.28);
  const nucleusCytoplasm = {
    type: nc.type,
    status: "partial-true-cohesive / sticky-active",
    mode: "solver-primary cohesive-approximation",
    surfacePair: mesh.surfacePairs.nucleus_cytoplasm_pair,
    normalStiffness: nc.normalStiffness,
    tangentialStiffness: nc.tangentialStiffness,
    criticalNormalStress: nc.criticalNormalStress,
    criticalShearStress: nc.criticalShearStress,
    fractureEnergy: nc.fractureEnergy,
    penalty: { Kn: normalPenalty, Kt: tangentialPenalty },
    tolerance: 0.08,
    stabilization: {
      searchTolerance: 0.08,
      symmetricStiffness: false,
      augmentation: { enabled: true, minPasses: 0, maxPasses: 12 },
      ramp: buildPenaltyRamp(normalPenalty, tangentialPenalty, frictionProxy)
    },
    cohesiveApproximation: {
      penalty: normalPenalty,
      tangentialPenalty,
      maxTraction: clamp(Math.max(nc.criticalNormalStress * 0.55, nc.criticalShearStress * 0.7), 0.03, 0.25),
      snapTolerance: clamp((nc.fractureEnergy / Math.max(nc.criticalNormalStress, 0.05)) * 0.28, 0.02, 0.25),
      frictionProxy
    },
    nativeObservation: {
      normal: "native-face-data-preferred",
      shear: "proxy-fallback-explicit",
      damage: "native-face-data-preferred",
      detachment: "damage-plus-geometry"
    },
    notes: ["native-only sticky cohesive approximation"]
  };
  nucleusCytoplasm.validation = validateNucleusCytoplasm(nucleusCytoplasm);
  if (nucleusCytoplasm.validation.valid) nucleusCytoplasm.status += " / stabilization-validated";

  const cellDishSpec = spec.contacts.cellDish;
  return {
    nucleusCytoplasm,
    cellDish: {
      type: cellDishSpec.type,
      status: "partial-cohesive-ready / tied-elastic-active",
      mode: "solver-primary tied-contact",
      surfacePair: mesh.surfacePairs.cell_dish_pair,
      normalStiffness: cellDishSpec.normalStiffness,
      tangentialStiffness: cellDishSpec.tangentialStiffness,
      criticalNormalStress: cellDishSpec.criticalNormalStress,
      criticalShearStress: cellDishSpec.criticalShearStress,
      fractureEnergy: cellDishSpec.fractureEnergy,
      nativeObservation: {
        normal: "native-face-data-preferred",
        shear: "proxy-fallback-explicit",
        damage: "native-face-data-preferred"
      }
    }
  };
}
