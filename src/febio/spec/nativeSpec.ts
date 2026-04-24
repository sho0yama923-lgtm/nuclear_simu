/**
 * SOURCE OF TRUTH: FEBio-native JSON defaults, normalization, and validation.
 *
 * Responsibility: normalize and validate FEBio-native solver JSON.
 * Owns: DEFAULT_NATIVE_SPEC, createDefaultFebioNativeSpec, normalizeFebioNativeSpec, validateFebioNativeSpec, digestFebioNativeSpec.
 * Does NOT own: XML template mapping, mesh generation, UI parameter conversion.
 * Primary entrypoints: createDefaultFebioNativeSpec, normalizeFebioNativeSpec, validateFebioNativeSpec.
 * Depends on: docs/febio/FEBIO_NATIVE_SPEC.md.
 */

export const DEFAULT_NATIVE_SPEC = {
  caseName: "S7_direct_force_transfer",
  unitSystem: "um-nN-s",
  geometry: {
    nucleus: { width: 28, height: 18, center: { x: 0, z: 17 } },
    cytoplasm: { width: 52, height: 34 },
    pipette: {
      radius: 6.5,
      puncture: { x: 4.5, z: 8.5 },
      tip: { x: 14, z: 8.5 },
    },
    meshMode: "s7-debug-local-nucleus",
  },
  materials: {
    nucleus: { type: "viscoelastic", E: 20, nu: 0.34, eta: 4.2, alphaNonlinear: 0.12 },
    cytoplasm: { type: "viscoelastic", E: 7.5, nu: 0.41, eta: 5.6 },
    dish: { type: "neo-Hookean", E: 250, nu: 0.3 },
    pipette: { type: "rigid body", density: 1, E: 600, nu: 0.25 },
  },
  contacts: {
    nucleusCytoplasm: {
      type: "sticky",
      normalStiffness: 1.35,
      tangentialStiffness: 1.05,
      criticalNormalStress: 0.78,
      criticalShearStress: 0.58,
      fractureEnergy: 0.28,
    },
    cellDish: {
      type: "tied-elastic",
      normalStiffness: 1.55,
      tangentialStiffness: 1.25,
      criticalNormalStress: 0.95,
      criticalShearStress: 0.65,
      fractureEnergy: 0.35,
    },
    pipetteNucleus: {
      type: "sticky",
      tolerance: 0.2,
      searchTolerance: 2.2,
      friction: 0.26,
      maxTraction: 1,
      snapTolerance: 0.18,
    },
    pipetteCell: {
      type: "sliding-elastic",
      tolerance: 0.2,
      searchTolerance: 2.64,
      friction: 0.091,
    },
  },
  loads: {
    suctionPressure: {
      name: "pipette_suction_pressure",
      surface: "pipette_suction_surface",
      value: -0.7,
      unit: "kPa",
      loadController: 202,
      curve: [[0, 0], [1, 1], [2, 1], [5, 1]],
    },
    holdForceProxy: { value: 20, loadController: 201 },
  },
  boundary: {
    fixedNodeSet: "dish_fixed_nodes",
    pipetteMotion: {
      liftZ: 8,
      inwardX: 4,
      tangentY: 7.5,
    },
  },
  steps: [
    { id: 1, name: "approach" },
    { id: 2, name: "hold" },
    { id: 3, name: "lift" },
    { id: 4, name: "manipulation-1" },
    { id: 5, name: "manipulation-2" },
  ],
  outputs: {
    displacement: true,
    reactionForce: true,
    contactPressure: true,
    contactGap: true,
    contactTraction: true,
    aspirationLength: true,
  },
  diagnostics: {
    targets: [
      "pressure-load-declared",
      "pressure-load-step-active",
      "contact-pair-declared",
      "contact-pressure-nonzero",
      "reaction-force-nonzero",
      "displacement-nonzero",
    ],
  },
};

export function cloneSpecValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function mergeObject(base, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return cloneSpecValue(patch ?? base);
  }
  const merged = cloneSpecValue(base || {});
  Object.entries(patch).forEach(([key, value]) => {
    merged[key] = value && typeof value === "object" && !Array.isArray(value)
      ? mergeObject(merged[key], value)
      : cloneSpecValue(value);
  });
  return merged;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function digestFebioNativeSpec(value) {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fdig_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function normalizeFebioNativeSpec(input = {}) {
  const merged = mergeObject(DEFAULT_NATIVE_SPEC, input);
  merged.caseName = String(merged.caseName || DEFAULT_NATIVE_SPEC.caseName);
  merged.unitSystem = merged.unitSystem || "um-nN-s";
  merged.loads.suctionPressure.value = numberOr(merged.loads.suctionPressure.value, -0.7);
  if (merged.loads.suctionPressure.value > 0) {
    merged.loads.suctionPressure.value *= -1;
  }
  merged.loads.suctionPressure.magnitude = Math.abs(merged.loads.suctionPressure.value);
  return merged;
}

export function createDefaultFebioNativeSpec(overrides = {}) {
  return normalizeFebioNativeSpec(overrides);
}

export function validateFebioNativeSpec(nativeSpec) {
  const errors = [];
  const warnings = [];
  const spec = normalizeFebioNativeSpec(nativeSpec);
  const requiredNumbers = [
    ["geometry.nucleus.width", spec.geometry.nucleus.width],
    ["geometry.nucleus.height", spec.geometry.nucleus.height],
    ["geometry.cytoplasm.width", spec.geometry.cytoplasm.width],
    ["geometry.cytoplasm.height", spec.geometry.cytoplasm.height],
    ["geometry.pipette.radius", spec.geometry.pipette.radius],
    ["materials.nucleus.E", spec.materials.nucleus.E],
    ["materials.cytoplasm.E", spec.materials.cytoplasm.E],
    ["contacts.nucleusCytoplasm.normalStiffness", spec.contacts.nucleusCytoplasm.normalStiffness],
    ["contacts.cellDish.normalStiffness", spec.contacts.cellDish.normalStiffness],
  ];
  requiredNumbers.forEach(([name, value]) => {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
      errors.push(`${name} must be a positive number`);
    }
  });
  if (spec.unitSystem !== "um-nN-s") {
    warnings.push("initial direct path expects unitSystem um-nN-s");
  }
  if (!["s7-debug-local-nucleus", "refined"].includes(spec.geometry.meshMode)) {
    warnings.push("initial direct path expects meshMode s7-debug-local-nucleus or refined");
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    source: "febio-native-spec",
  };
}

export function toLegacyTemplateShape(nativeSpec) {
  const spec = normalizeFebioNativeSpec(nativeSpec);
  return {
    caseName: spec.caseName,
    parameterDigest: digestFebioNativeSpec(spec),
    coordinates: {
      unitSystem: spec.unitSystem,
      length: "um",
      force: "nN",
      time: "s",
      stress: "kPa",
    },
    geometry: {
      Ln: spec.geometry.nucleus.width,
      Hn: spec.geometry.nucleus.height,
      Lc: spec.geometry.cytoplasm.width,
      Hc: spec.geometry.cytoplasm.height,
      xn: spec.geometry.nucleus.center.x,
      yn: spec.geometry.nucleus.center.z,
      rp: spec.geometry.pipette.radius,
      xp: spec.geometry.pipette.tip.x,
      zp: spec.geometry.pipette.tip.z,
      punctureX: spec.geometry.pipette.puncture?.x ?? spec.geometry.pipette.tip.x,
      punctureZ: spec.geometry.pipette.puncture?.z ?? spec.geometry.pipette.tip.z,
      pipetteSuctionSurface: spec.loads.suctionPressure.surface,
      meshMode: spec.geometry.meshMode,
    },
    material: {
      En: spec.materials.nucleus.E,
      nun: spec.materials.nucleus.nu,
      etan: spec.materials.nucleus.eta,
      alpha_nonlinear: spec.materials.nucleus.alphaNonlinear,
      Ec: spec.materials.cytoplasm.E,
      nuc: spec.materials.cytoplasm.nu,
      etac: spec.materials.cytoplasm.eta,
    },
    interfaces: {
      Kn_nc: spec.contacts.nucleusCytoplasm.normalStiffness,
      Kt_nc: spec.contacts.nucleusCytoplasm.tangentialStiffness,
      sig_nc_crit: spec.contacts.nucleusCytoplasm.criticalNormalStress,
      tau_nc_crit: spec.contacts.nucleusCytoplasm.criticalShearStress,
      Gc_nc: spec.contacts.nucleusCytoplasm.fractureEnergy,
      Kn_cd: spec.contacts.cellDish.normalStiffness,
      Kt_cd: spec.contacts.cellDish.tangentialStiffness,
      sig_cd_crit: spec.contacts.cellDish.criticalNormalStress,
      tau_cd_crit: spec.contacts.cellDish.criticalShearStress,
      Gc_cd: spec.contacts.cellDish.fractureEnergy,
    },
    membrane: { Tm: 4.7 },
    membraneModel: "cortex_proxy",
    operation: {
      Fhold: spec.loads.holdForceProxy.value,
      P_hold: Math.abs(spec.loads.suctionPressure.value),
      dz_lift: spec.boundary.pipetteMotion.liftZ,
      dx_inward: spec.boundary.pipetteMotion.inwardX,
      ds_tangent: spec.boundary.pipetteMotion.tangentY,
      mu_p: spec.contacts.pipetteNucleus.friction,
      contact_tol: spec.contacts.pipetteNucleus.searchTolerance,
    },
    params: {},
    validationReport: { valid: true, warnings: [], errors: [] },
  };
}
