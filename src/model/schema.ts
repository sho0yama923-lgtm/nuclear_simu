import { DEFAULTS, FIELD_GROUPS, normalizeFieldEntry } from "./defaults.ts";
import {
  APP_SCHEMA_VERSION,
  CD_REGIONS,
  COORDINATE_SYSTEM_SPEC,
  MEMBRANE_REGIONS,
  NC_REGIONS,
  structuredCloneSafe,
} from "./types.ts";

/**
 * SOURCE OF TRUTH: canonical parameter schema and normalized simulation input.
 *
 * Responsibility: define canonical parameter grouping, validation, digesting, and normalized input specs.
 * Owns: buildSimulationInput, PARAMETER_SCHEMA, validation, schedule metadata, canonical parameter tables.
 * Does NOT own: FEBio mesh generation, FEBio XML serialization, result classification.
 * Primary entrypoints: buildSimulationInput, buildCanonicalSpec, PARAMETER_SCHEMA.
 * Depends on: src/model/defaults.ts, src/model/types.ts.
 */

export const GEOMETRY_SCHEMA_KEYS = ["Ln", "Hn", "Lc", "Hc", "xn", "yn", "rp", "xp", "zp"];
export const MATERIAL_SCHEMA_KEYS = ["En", "nun", "etan", "alpha_nonlinear", "Ec", "nuc", "etac", "Tm", "sig_m_crit", "sig_m_crit_top", "sig_m_crit_side", "sig_m_crit_basal"];
export const INTERFACE_SCHEMA_KEYS = ["Kn_nc", "Kt_nc", "sig_nc_crit", "tau_nc_crit", "Gc_nc", "Kn_cd", "Kt_cd", "sig_cd_crit", "tau_cd_crit", "Gc_cd"];
export const OPERATION_SCHEMA_KEYS = FIELD_GROUPS.operation.map(([key]) => key);

export function buildParameterSchema(fieldGroups) {
  const meta = {
    Ln: { febioPath: "geometry.nucleus.width", min: 1, max: 500, description: "Nucleus width." },
    Hn: { febioPath: "geometry.nucleus.height", min: 1, max: 500, description: "Nucleus height." },
    Lc: { febioPath: "geometry.cytoplasm.width", min: 1, max: 1000, description: "Cytoplasm width." },
    Hc: { febioPath: "geometry.cytoplasm.height", min: 1, max: 1000, description: "Cytoplasm height." },
    xn: { febioPath: "geometry.nucleus.center.x", min: -500, max: 500, description: "Nucleus center x." },
    yn: { febioPath: "geometry.nucleus.center.z", min: 0, max: 500, description: "Nucleus center z." },
    rp: { febioPath: "geometry.pipette.radius", min: 0.1, max: 100, description: "Pipette radius." },
    xp: { febioPath: "geometry.pipette.puncture.x", min: -500, max: 500, description: "Puncture x." },
    zp: { febioPath: "geometry.pipette.puncture.z", min: 0, max: 500, description: "Puncture z." },
    En: { febioPath: "materials.nucleus.elastic.E", min: 0.001, max: 10000, description: "Nucleus elasticity." },
    nun: { febioPath: "materials.nucleus.elastic.nu", min: 0, max: 0.499, description: "Nucleus Poisson ratio." },
    etan: { febioPath: "materials.nucleus.viscous.eta", min: 0, max: 100000, description: "Nucleus viscosity." },
    alpha_nonlinear: { febioPath: "materials.nucleus.optionalNonlinear.alpha", min: 0, max: 10, description: "Optional nonlinear alpha." },
    Ec: { febioPath: "materials.cytoplasm.elastic.E", min: 0.001, max: 10000, description: "Cytoplasm elasticity." },
    nuc: { febioPath: "materials.cytoplasm.elastic.nu", min: 0, max: 0.499, description: "Cytoplasm Poisson ratio." },
    etac: { febioPath: "materials.cytoplasm.viscous.eta", min: 0, max: 100000, description: "Cytoplasm viscosity." },
    Tm: { febioPath: "materials.membrane.tension", min: 0, max: 1000, description: "Membrane tension proxy." },
    sig_m_crit: { febioPath: "materials.membrane.criticalStress.default", min: 0, max: 1000, description: "Membrane critical stress." },
    sig_m_crit_top: { febioPath: "materials.membrane.criticalStress.top", min: 0, max: 1000, description: "Top membrane critical stress." },
    sig_m_crit_side: { febioPath: "materials.membrane.criticalStress.side", min: 0, max: 1000, description: "Side membrane critical stress." },
    sig_m_crit_basal: { febioPath: "materials.membrane.criticalStress.basal", min: 0, max: 1000, description: "Basal membrane critical stress." },
    Kn_nc: { febioPath: "interfaces.nucleusCytoplasm.normalStiffness", min: 0, max: 10000, description: "NC normal stiffness." },
    Kt_nc: { febioPath: "interfaces.nucleusCytoplasm.tangentialStiffness", min: 0, max: 10000, description: "NC tangential stiffness." },
    sig_nc_crit: { febioPath: "interfaces.nucleusCytoplasm.criticalNormalStress", min: 0, max: 1000, description: "NC critical normal stress." },
    tau_nc_crit: { febioPath: "interfaces.nucleusCytoplasm.criticalShearStress", min: 0, max: 1000, description: "NC critical shear stress." },
    Gc_nc: { febioPath: "interfaces.nucleusCytoplasm.fractureEnergy", min: 0, max: 1000, description: "NC fracture energy." },
    Kn_cd: { febioPath: "interfaces.cellDish.normalStiffness", min: 0, max: 10000, description: "CD normal stiffness." },
    Kt_cd: { febioPath: "interfaces.cellDish.tangentialStiffness", min: 0, max: 10000, description: "CD tangential stiffness." },
    sig_cd_crit: { febioPath: "interfaces.cellDish.criticalNormalStress", min: 0, max: 1000, description: "CD critical normal stress." },
    tau_cd_crit: { febioPath: "interfaces.cellDish.criticalShearStress", min: 0, max: 1000, description: "CD critical shear stress." },
    Gc_cd: { febioPath: "interfaces.cellDish.fractureEnergy", min: 0, max: 1000, description: "CD fracture energy." },
    adhesionPattern: { febioPath: "interfaces.cellDish.adhesionPattern", description: "Adhesion distribution pattern." },
    adhesionSeed: { febioPath: "interfaces.cellDish.adhesionSeed", min: 0, max: 1000000, description: "Adhesion random seed." },
    Fhold: { febioPath: "operation.hold.force", min: 0, max: 1000, description: "Hold force proxy." },
    P_hold: { febioPath: "operation.hold.pressure", min: 0, max: 1000, description: "Hold pressure proxy." },
    dz_lift: { febioPath: "operation.lift.dz", min: -500, max: 500, description: "Lift z." },
    dx_inward: { febioPath: "operation.inward.dx", min: -500, max: 500, description: "Inward x." },
    ds_tangent: { febioPath: "operation.tangent.dy", min: -500, max: 500, description: "Tangential y." },
    dx_outward: { febioPath: "operation.outward.dx", min: -500, max: 500, description: "Outward x." },
    mu_p: { febioPath: "operation.pipette.friction", min: 0, max: 10, description: "Pipette friction." },
    contact_tol: { febioPath: "operation.capture.contactTolerance", min: 0, max: 100, description: "Capture tolerance." },
  };

  const entries = Object.values(fieldGroups)
    .flat()
    .map((entry) => {
      const field = normalizeFieldEntry(entry);
      return [field.key, { ...field, ...(meta[field.key] || {}) }];
    });

  return Object.fromEntries(entries);
}

export const PARAMETER_SCHEMA = buildParameterSchema(FIELD_GROUPS);

function hashString(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildParameterDigest(spec) {
  const canonical = {
    caseName: spec.caseName,
    params: spec.params,
    membraneModel: spec.membraneModel,
    adhesionPattern: spec.adhesionPattern,
    adhesionSeed: spec.adhesionSeed,
  };
  return `pdig_${hashString(JSON.stringify(canonical)).toString(16).padStart(8, "0")}`;
}

function buildValidationReport(params) {
  const errors = [];
  const warnings = [];

  Object.entries(PARAMETER_SCHEMA).forEach(([key, schema]) => {
    const value = params[key];
    if (typeof value === "number" && !Number.isFinite(value)) {
      errors.push(`${key}: not a finite number`);
      return;
    }
    if (schema.min != null && typeof value === "number" && value < schema.min) {
      errors.push(`${key}: below min ${schema.min}`);
    }
    if (schema.max != null && typeof value === "number" && value > schema.max) {
      errors.push(`${key}: above max ${schema.max}`);
    }
  });

  if (params.Hn > params.Hc) {
    warnings.push("nucleus height exceeds cytoplasm height");
  }
  if (params.Ln > params.Lc) {
    warnings.push("nucleus width exceeds cytoplasm width");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function pickParams(keys, merged) {
  return Object.fromEntries(keys.map((key) => [key, merged[key]]));
}

function buildParameterTable(params) {
  return Object.keys(PARAMETER_SCHEMA).map((key) => ({
    key,
    value: params[key],
    febioPath: PARAMETER_SCHEMA[key].febioPath || "",
    description: PARAMETER_SCHEMA[key].description || "",
  }));
}

function resolvePhase(time, phaseEnds) {
  if (time <= phaseEnds.phase0) return "phase0";
  if (time <= phaseEnds.phase1) return "phase1";
  if (time <= phaseEnds.phase2) return "phase2";
  if (time <= phaseEnds.phase3) return "phase3";
  return "phase4";
}

function buildSchedule(caseName, params) {
  const phaseEnds = {
    phase0: 1,
    phase1: 2,
    phase2: 3,
    phase3: 4,
    phase4: 5,
    total: 5,
  };

  return {
    caseName,
    phaseEnds,
    axes: {
      section: "x-z",
      tangential: "y",
    },
    targetAt(time) {
      const phase = resolvePhase(time, phaseEnds);
      const pos = { x: params.xp, y: params.zp };
      const operation = {
        lift: phase === "phase2" || phase === "phase3" || phase === "phase4" ? params.dz_lift : 0,
        inward: phase === "phase3" || phase === "phase4" ? params.dx_inward : 0,
        tangent: phase === "phase4" ? params.ds_tangent : 0,
        outward: 0,
      };
      return { phase, pos, operation };
    },
  };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function initializeLocalState(regions) {
  return Object.fromEntries(
    regions.map((region) => [
      region,
      {
        normalStress: 0,
        shearStress: 0,
        damage: 0,
        peakNormal: 0,
        peakShear: 0,
        nativeGap: 0,
        contactFraction: 1,
        minContactFraction: 1,
        firstFailureTime: null,
        firstFailureMode: null,
        provenance: "proxy-fallback-explicit",
        sourceNormal: "unavailable",
        sourceDamage: "unavailable",
        sourceShear: "unavailable",
      },
    ]),
  );
}

export function initializeMembraneState(regions) {
  return Object.fromEntries(
    regions.map((region) => [
      region,
      {
        stress: 0,
        damage: 0,
        threshold: 0,
        peakStress: 0,
        firstFailureTime: null,
      },
    ]),
  );
}

export function summarizeLocalDamage(localState, regions) {
  return Math.max(...regions.map((region) => localState?.[region]?.damage || 0), 0);
}

export function getMembraneThresholds(params) {
  return {
    top_neck: params.sig_m_crit_top ?? params.sig_m_crit,
    side: params.sig_m_crit_side ?? params.sig_m_crit,
    basal: params.sig_m_crit_basal ?? params.sig_m_crit,
  };
}

export function deriveMembraneStateFromLocalNc(localNc, membraneSpec = {}) {
  const thresholds = getMembraneThresholds(membraneSpec);
  const membraneRegions = initializeMembraneState(MEMBRANE_REGIONS);
  const topNormal = localNc?.top?.peakNormal ?? localNc?.top?.normalStress ?? 0;
  const topShear = localNc?.top?.peakShear ?? localNc?.top?.shearStress ?? 0;
  const leftShear = localNc?.left?.peakShear ?? localNc?.left?.shearStress ?? 0;
  const rightShear = localNc?.right?.peakShear ?? localNc?.right?.shearStress ?? 0;
  const bottomNormal = localNc?.bottom?.peakNormal ?? localNc?.bottom?.normalStress ?? 0;

  membraneRegions.top_neck.threshold = thresholds.top_neck;
  membraneRegions.side.threshold = thresholds.side;
  membraneRegions.basal.threshold = thresholds.basal;

  membraneRegions.top_neck.stress = topNormal + topShear * 0.35;
  membraneRegions.side.stress = Math.max(leftShear, rightShear) * 0.8;
  membraneRegions.basal.stress = bottomNormal * 0.6;

  Object.values(membraneRegions).forEach((region) => {
    region.peakStress = region.stress;
    region.damage = clamp(region.stress / Math.max(region.threshold, 1e-6) - 1, 0, 1);
    if (region.damage > 0) {
      region.firstFailureTime = 0;
    }
  });

  return membraneRegions;
}

export function buildCanonicalSpec(caseName, params = {}) {
  const merged = {
    ...DEFAULTS,
    ...(params || {}),
  };

  const validationReport = buildValidationReport(merged);
  const spec = {
    appSchemaVersion: APP_SCHEMA_VERSION,
    caseName,
    params: structuredCloneSafe(merged),
    coordinates: structuredCloneSafe(COORDINATE_SYSTEM_SPEC),
    geometry: pickParams(GEOMETRY_SCHEMA_KEYS, merged),
    material: pickParams(MATERIAL_SCHEMA_KEYS, merged),
    interfaces: {
      ...pickParams(INTERFACE_SCHEMA_KEYS, merged),
    },
    membrane: {
      Tm: merged.Tm,
      sig_m_crit: merged.sig_m_crit,
      sig_m_crit_top: merged.sig_m_crit_top,
      sig_m_crit_side: merged.sig_m_crit_side,
      sig_m_crit_basal: merged.sig_m_crit_basal,
    },
    membraneModel: merged.membraneModel || "cortex_proxy",
    operation: pickParams(OPERATION_SCHEMA_KEYS, merged),
    adhesionPattern: merged.adhesionPattern || "uniform",
    adhesionSeed: merged.adhesionSeed ?? 17,
    validationReport,
    parameterTable: buildParameterTable(merged),
    schedule: buildSchedule(caseName, merged),
  };

  spec.parameterDigest = buildParameterDigest(spec);
  return spec;
}

export function buildSimulationInput(caseName, params = {}) {
  return buildCanonicalSpec(caseName, params);
}

export { DEFAULTS, FIELD_GROUPS, APP_SCHEMA_VERSION, COORDINATE_SYSTEM_SPEC, NC_REGIONS, CD_REGIONS, MEMBRANE_REGIONS };
