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
  const ncSolverActive = nc.solverActive === true;
  const ncSolverType = ncSolverActive ? (nc.solverType || nc.type || "tied-elastic") : "conformal-shared-node";
  const ncContactRegions = mesh.refinements?.nucleusCytoplasmCoupling?.separatedContactComparison
    ? ["left", "right"]
    : ["left", "right", "top", "bottom"];
  const normalPenalty = clamp(Math.max(buildPenalty(nc.normalStiffness, nc.criticalNormalStress, nc.fractureEnergy), nc.normalStiffness * 0.85), 0.35, 2.5);
  const tangentialPenalty = clamp(Math.max(buildPenalty(nc.tangentialStiffness, nc.criticalShearStress, nc.fractureEnergy), nc.tangentialStiffness * 0.65), 0.2, 1.8);
  const frictionProxy = clamp(0.12 + (pipetteNucleus.friction || 0) * 0.25, 0.12, 0.28);
  const maxTraction = clamp(Math.max(nc.criticalNormalStress * 2.5, nc.criticalShearStress * 2.5, normalPenalty * 1.4), 1.0, 4.0);
  const snapTolerance = clamp((nc.fractureEnergy / Math.max(nc.criticalNormalStress, 0.05)) * 0.8, 0.18, 0.6);
  const nucleusCytoplasm = {
    type: ncSolverType,
    requestedType: nc.type,
    solverActive: ncSolverActive,
    status: ncSolverActive
      ? "solver-active NC comparison / shared-node baseline preserved separately"
      : "force-transfer-shared-node / cohesive-law-deferred",
    mode: ncSolverActive ? "solver-active NC comparison coupling" : "mesh-conformal force-transfer coupling",
    surfacePair: mesh.surfacePairs.nucleus_cytoplasm_pair,
    localSurfacePairs: Object.fromEntries(
      ncContactRegions.map((region) => [region, mesh.surfacePairs[`nucleus_cytoplasm_${region}_pair`]]),
    ),
    contactRegions: ncContactRegions,
    normalStiffness: nc.normalStiffness,
    tangentialStiffness: nc.tangentialStiffness,
    criticalNormalStress: nc.criticalNormalStress,
    criticalShearStress: nc.criticalShearStress,
    fractureEnergy: nc.fractureEnergy,
    penalty: { Kn: normalPenalty, Kt: tangentialPenalty },
    tolerance: 0.18,
    stabilization: {
      searchTolerance: 0.22,
      symmetricStiffness: false,
      augmentation: { enabled: false, minPasses: 0, maxPasses: 0 },
      ramp: buildPenaltyRamp(normalPenalty, tangentialPenalty, frictionProxy)
    },
    cohesiveApproximation: {
      penalty: normalPenalty,
      tangentialPenalty,
      maxTraction,
      snapTolerance,
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
      status: "solver-active / s7-h reactivated on current native mesh",
      solverActive: true,
      mode: "solver-active cell-dish contact",
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
