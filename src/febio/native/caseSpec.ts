/**
 * SOURCE OF TRUTH: native-only FEBio case spec loading, normalization, and validation.
 *
 * This path treats febio_cases/native/*.native.json as the source of physical values.
 */

export function cloneNativeValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function getPath(value, path) {
  return path.split(".").reduce((current, key) => (current == null ? undefined : current[key]), value);
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function digestNativeCaseSpec(value) {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fdig_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function normalizeNativeCaseSpec(input = {}) {
  const spec = cloneNativeValue(input);
  spec.caseName = String(spec.caseName || "native_case");
  spec.outputNameTag = spec.outputNameTag == null ? "" : String(spec.outputNameTag);
  spec.unitSystem = spec.unitSystem || "um-nN-s";
  spec.geometry = spec.geometry || {};
  spec.materials = spec.materials || {};
  spec.contacts = spec.contacts || {};
  spec.loads = spec.loads || {};
  spec.boundary = spec.boundary || {};
  spec.steps = Array.isArray(spec.steps) ? spec.steps : [];
  spec.outputs = spec.outputs || {};
  spec.diagnostics = spec.diagnostics || {};

  const pressure = spec.loads.suctionPressure || {};
  pressure.value = numberOr(pressure.value, NaN);
  if (Number.isFinite(pressure.value) && pressure.value > 0) pressure.value *= -1;
  pressure.magnitude = Number.isFinite(pressure.value) ? Math.abs(pressure.value) : NaN;
  spec.loads.suctionPressure = pressure;
  return spec;
}

export function validateNativeCaseSpec(input = {}) {
  const spec = normalizeNativeCaseSpec(input);
  const errors = [];
  const warnings = [];
  const requiredNumbers = [
    "geometry.nucleus.width",
    "geometry.nucleus.height",
    "geometry.nucleus.center.x",
    "geometry.nucleus.center.z",
    "geometry.cytoplasm.width",
    "geometry.cytoplasm.height",
    "geometry.pipette.radius",
    "geometry.pipette.tip.x",
    "geometry.pipette.tip.z",
    "materials.nucleus.E",
    "materials.nucleus.nu",
    "materials.nucleus.eta",
    "materials.cytoplasm.E",
    "materials.cytoplasm.nu",
    "materials.cytoplasm.eta",
    "materials.dish.E",
    "materials.pipette.E",
    "contacts.nucleusCytoplasm.normalStiffness",
    "contacts.nucleusCytoplasm.tangentialStiffness",
    "contacts.nucleusCytoplasm.criticalNormalStress",
    "contacts.nucleusCytoplasm.criticalShearStress",
    "contacts.nucleusCytoplasm.fractureEnergy",
    "contacts.cellDish.normalStiffness",
    "contacts.pipetteNucleus.searchTolerance",
    "contacts.pipetteCell.searchTolerance",
    "loads.suctionPressure.value",
    "boundary.pipetteMotion.liftZ",
    "boundary.pipetteMotion.inwardX"
  ];

  requiredNumbers.forEach((path) => {
    const value = getPath(spec, path);
    if (!Number.isFinite(Number(value))) errors.push(`${path} must be a finite number`);
  });
  if (spec.unitSystem !== "um-nN-s") warnings.push("native-only export currently expects unitSystem um-nN-s");
  if (!spec.loads.suctionPressure?.surface) errors.push("loads.suctionPressure.surface is required");
  if (!spec.boundary.fixedNodeSet) errors.push("boundary.fixedNodeSet is required");
  if (!spec.steps.length) errors.push("steps must include solver steps");
  return { valid: errors.length === 0, errors, warnings, source: "febio-native-case" };
}
