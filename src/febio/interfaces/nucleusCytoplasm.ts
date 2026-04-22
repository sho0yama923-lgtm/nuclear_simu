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

export function buildNucleusCytoplasmInterfaceSpec(inputSpec, mesh) {
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
      Kn: Math.max(inputSpec.interfaces.Kn_nc * 0.08, 0.03),
      Kt: Math.max(inputSpec.interfaces.Kt_nc * 0.08, 0.03),
    },
    tolerance: 0.08,
    cohesiveApproximation: {
      penalty: Math.max(inputSpec.interfaces.Kn_nc * 0.08, 0.03),
      tangentialPenalty: Math.max(inputSpec.interfaces.Kt_nc * 0.08, 0.03),
      maxTraction: clamp(inputSpec.interfaces.sig_nc_crit * 0.55, 0.03, 0.25),
      snapTolerance: clamp(
        (inputSpec.interfaces.Gc_nc / Math.max(inputSpec.interfaces.sig_nc_crit, 0.05)) * 0.28,
        0.02,
        0.25,
      ),
      frictionProxy: 0.18,
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
      "detachment should migrate from proxy-assisted observation toward native cohesive output",
    ],
  };
}
