import { PINNED_OPERATION_KEYS } from "./types.js";

/**
 * SOURCE OF TRUTH: canonical parameter defaults and editable field groups.
 *
 * Responsibility: define editable field groups and default parameter values.
 * Owns: FIELD_GROUPS, DEFAULTS, normalizeFieldEntry.
 * Does NOT own: validation rules, FEBio export mapping, result normalization.
 * Primary entrypoints: FIELD_GROUPS, DEFAULTS, normalizeFieldEntry, createDefaultParams.
 * Depends on: src/model/types.ts.
 */

export function normalizeFieldEntry(entry) {
  const [key, label, value, meta = {}] = entry;
  return {
    key,
    label,
    value,
    type: meta.type || (typeof value === "number" ? "number" : "text"),
    options: meta.options || [],
    step: meta.step ?? 0.01,
    hint: meta.hint || "",
  };
}

export function buildFieldGroups() {
  const geometry = [
    ["Ln", "nucleus width [um]", 28],
    ["Hn", "nucleus height [um]", 18],
    ["Lc", "cytoplasm width [um]", 52],
    ["Hc", "cytoplasm height [um]", 34],
    ["xn", "nucleus center x [um]", 0],
    ["yn", "nucleus center z [um]", 17],
    ["rp", "pipette radius [um]", 6.5],
    ["xp", "puncture x [um]", 4.5],
    ["zp", "puncture z [um]", 8.5],
  ];

  const material = [
    ["En", "nucleus Young modulus [kPa]", 20],
    ["nun", "nucleus Poisson ratio [-]", 0.34],
    ["etan", "nucleus viscosity [kPa*s]", 4.2],
    ["alpha_nonlinear", "nucleus nonlinear alpha [-]", 0.12],
    ["Ec", "cytoplasm Young modulus [kPa]", 7.5],
    ["nuc", "cytoplasm Poisson ratio [-]", 0.41],
    ["etac", "cytoplasm viscosity [kPa*s]", 5.6],
    ["Tm", "membrane tension [internal]", 4.7],
    ["sig_m_crit", "membrane critical stress [internal]", 1.55],
    ["sig_m_crit_top", "membrane critical stress top [internal]", 1.05],
    ["sig_m_crit_side", "membrane critical stress side [internal]", 1.55],
    ["sig_m_crit_basal", "membrane critical stress basal [internal]", 1.85],
  ];

  const interfaces = [
    ["Kn_nc", "nucleus-cytoplasm normal stiffness", 1.35],
    ["Kt_nc", "nucleus-cytoplasm tangential stiffness", 1.05],
    ["sig_nc_crit", "nucleus-cytoplasm critical normal stress", 0.78],
    ["tau_nc_crit", "nucleus-cytoplasm critical shear stress", 0.58],
    ["Gc_nc", "nucleus-cytoplasm fracture energy", 0.28],
    ["Kn_cd", "cell-dish normal stiffness", 1.55],
    ["Kt_cd", "cell-dish tangential stiffness", 1.25],
    ["sig_cd_crit", "cell-dish critical normal stress", 0.95],
    ["tau_cd_crit", "cell-dish critical shear stress", 0.65],
    ["Gc_cd", "cell-dish fracture energy", 0.35],
    [
      "adhesionPattern",
      "adhesion pattern",
      "uniform",
      {
        type: "select",
        options: [
          ["uniform", "uniform"],
          ["center_strong", "center_strong"],
          ["edge_strong", "edge_strong"],
          ["random_patchy", "random_patchy"],
        ],
      },
    ],
    ["adhesionSeed", "adhesion seed", 17, { step: 1 }],
  ];

  const operation = [
    ["Fhold", "hold force [internal]", 20],
    ["P_hold", "hold pressure [internal]", 0.7],
    ["dz_lift", "lift z [um]", 8],
    ["dx_inward", "inward x [um]", 4],
    ["ds_tangent", "tangent y [um]", 7.5],
    ["dx_outward", "outward x [um]", 3],
    ["mu_p", "pipette friction [-]", 0.26],
    ["contact_tol", "capture tolerance [um]", 2.2],
  ];

  const pinnedGeometry = geometry.filter(([key]) => PINNED_OPERATION_KEYS.includes(key));

  return {
    geometry: geometry.filter(([key]) => !PINNED_OPERATION_KEYS.includes(key)),
    material,
    interfaces,
    operation: [...pinnedGeometry, ...operation],
  };
}

export function createDefaultParams(fieldGroups) {
  return Object.fromEntries(
    Object.values(fieldGroups)
      .flat()
      .map((entry) => {
        const field = normalizeFieldEntry(entry);
        return [field.key, field.value];
      }),
  );
}

export const FIELD_GROUPS = buildFieldGroups();
export const DEFAULTS = createDefaultParams(FIELD_GROUPS);
