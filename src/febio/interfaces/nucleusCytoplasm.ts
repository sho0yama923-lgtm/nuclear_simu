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

  return {
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
}
