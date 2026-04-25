import { buildRefinedFebioGeometry, validateFebioMesh } from "../mesh/index.ts";

function geometryForNativeMesh(spec) {
  return {
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
      meshMode: spec.geometry.meshMode || "s7-debug-local-nucleus"
    }
  };
}

export function buildNativeMesh(spec) {
  return applyNativeSolverSurfaceConventions(buildRefinedFebioGeometry(geometryForNativeMesh(spec)));
}

function applyNativeSolverSurfaceConventions(mesh) {
  return {
    ...mesh,
    surfaces: {
      ...mesh.surfaces,
      cell_dish_surface: [
        { ...mesh.surfaces.cell_dish_surface[0], nodes: [1, 4, 3, 2] },
        { ...mesh.surfaces.cell_dish_surface[1], nodes: [41, 44, 43, 42] },
        { ...mesh.surfaces.cell_dish_surface[2], nodes: [33, 36, 35, 34] },
      ],
      cell_dish_left_surface: [{ ...mesh.surfaces.cell_dish_left_surface[0], nodes: [1, 4, 3, 2] }],
      cell_dish_center_surface: [{ ...mesh.surfaces.cell_dish_center_surface[0], nodes: [41, 44, 43, 42] }],
      cell_dish_right_surface: [{ ...mesh.surfaces.cell_dish_right_surface[0], nodes: [33, 36, 35, 34] }],
    },
  };
}

const COORDINATE_CONVENTION = {
  axes: {
    x: {
      meaning: "aspiration/manipulation axis",
      positive: "from cell center toward the pipette/barrel side",
      negative: "from pipette mouth toward cell interior",
    },
    y: {
      meaning: "section thickness / out-of-plane axis",
      positive: "one side of the thin 3D section",
      negative: "opposite side of the thin 3D section",
    },
    z: {
      meaning: "dish-to-apical vertical axis",
      positive: "away from dish / apical",
      negative: "toward dish / basal",
    },
  },
  pressure: {
    suctionSurface: "pipette_suction_surface",
    surfaceOwnership: "deformable-side capture surface",
    rigidMouthSurface: "pipette_contact_surface",
    currentSuctionNormal: "-x",
    negativePressureEffect: "intended to pull toward +x, into the pipette/barrel side",
  },
  contactPairs: {
    nucleus_cytoplasm_pair: { primary: "cytoplasm_interface_surface", secondary: "nucleus_interface_surface" },
    cell_dish_pair: { primary: "cell_dish_surface", secondary: "dish_contact_surface" },
    pipette_nucleus_pair: { primary: "nucleus_interface_right_surface", secondary: "pipette_contact_surface" },
    pipette_cell_pair: { primary: "pipette_suction_surface", secondary: "pipette_contact_surface" },
  },
};

const EXPECTED_SURFACE_NORMALS = {
  nucleus_interface_left_surface: "-x",
  nucleus_interface_right_surface: "+x",
  nucleus_interface_top_surface: "+z",
  nucleus_interface_bottom_surface: "-z",
  cytoplasm_interface_left_surface: "+x",
  cytoplasm_interface_right_surface: "-x",
  cytoplasm_interface_top_surface: "-z",
  cytoplasm_interface_bottom_surface: "+z",
  cell_dish_left_surface: "-z",
  cell_dish_center_surface: "-z",
  cell_dish_right_surface: "-z",
  dish_contact_surface: "+z",
  pipette_suction_surface: "-x",
  pipette_contact_surface: "+x",
};

const PAIR_ALIGNMENT_CHECKS = [
  { name: "nc_left", primary: "cytoplasm_interface_left_surface", secondary: "nucleus_interface_left_surface", expected: "opposed" },
  { name: "nc_right", primary: "cytoplasm_interface_right_surface", secondary: "nucleus_interface_right_surface", expected: "opposed" },
  { name: "nc_top", primary: "cytoplasm_interface_top_surface", secondary: "nucleus_interface_top_surface", expected: "opposed" },
  { name: "nc_bottom", primary: "cytoplasm_interface_bottom_surface", secondary: "nucleus_interface_bottom_surface", expected: "opposed" },
  { name: "cell_dish_left", primary: "cell_dish_left_surface", secondary: "dish_contact_surface", expected: "opposed" },
  { name: "cell_dish_center", primary: "cell_dish_center_surface", secondary: "dish_contact_surface", expected: "opposed" },
  { name: "cell_dish_right", primary: "cell_dish_right_surface", secondary: "dish_contact_surface", expected: "opposed" },
  { name: "pipette_cell", primary: "pipette_suction_surface", secondary: "pipette_contact_surface", expected: "opposed" },
];

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (!length) return [0, 0, 0];
  return vector.map((value) => value / length);
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function nodePointMap(mesh = {}) {
  return new Map((mesh.nodes || []).map((node) => [node.id, [node.x, node.y, node.z]]));
}

function facetNormal(facet, points) {
  const nodes = (facet?.nodes || []).map((id) => points.get(id)).filter(Boolean);
  if (nodes.length < 3) return [0, 0, 0];
  return normalize(cross(subtract(nodes[1], nodes[0]), subtract(nodes[2], nodes[0])));
}

function surfaceNormal(mesh, surfaceName) {
  const points = nodePointMap(mesh);
  const facets = mesh.surfaces?.[surfaceName] || [];
  if (!facets.length) return null;
  const total = facets.reduce((acc, facet) => add(acc, facetNormal(facet, points)), [0, 0, 0]);
  return normalize(total);
}

function axisLabel(normal) {
  if (!normal) return "missing";
  const axes = [
    { name: "x", value: normal[0] },
    { name: "y", value: normal[1] },
    { name: "z", value: normal[2] },
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  if (Math.abs(axes[0].value) < 0.5) return "oblique";
  return `${axes[0].value >= 0 ? "+" : "-"}${axes[0].name}`;
}

function buildSurfaceNormalDiagnostics(mesh) {
  const entries = Object.fromEntries(
    Object.keys(EXPECTED_SURFACE_NORMALS).map((surfaceName) => {
      const normal = surfaceNormal(mesh, surfaceName);
      const actual = axisLabel(normal);
      const expected = EXPECTED_SURFACE_NORMALS[surfaceName];
      return [
        surfaceName,
        {
          normal,
          actual,
          expected,
          matchesConvention: actual === expected,
        },
      ];
    }),
  );
  const warnings = Object.entries(entries)
    .filter(([, entry]) => !entry.matchesConvention)
    .map(([surfaceName, entry]) => `${surfaceName} normal is ${entry.actual}; expected ${entry.expected}`);
  return { entries, warnings };
}

function buildContactPairDiagnostics(mesh) {
  const checks = Object.fromEntries(
    PAIR_ALIGNMENT_CHECKS.map((check) => {
      const primaryNormal = surfaceNormal(mesh, check.primary);
      const secondaryNormal = surfaceNormal(mesh, check.secondary);
      const normalDot = primaryNormal && secondaryNormal ? dot(primaryNormal, secondaryNormal) : null;
      const opposed = normalDot != null && normalDot < -0.75;
      return [
        check.name,
        {
          primary: check.primary,
          secondary: check.secondary,
          primaryNormal: axisLabel(primaryNormal),
          secondaryNormal: axisLabel(secondaryNormal),
          dot: normalDot,
          expected: check.expected,
          aligned: check.expected === "opposed" ? opposed : false,
        },
      ];
    }),
  );
  const warnings = Object.entries(checks)
    .filter(([, entry]) => !entry.aligned)
    .map(([name, entry]) => `${name} surfaces are ${entry.primaryNormal}/${entry.secondaryNormal}; expected opposed normals`);
  return { checks, warnings };
}

function buildPressureDiagnostics(mesh) {
  const suction = surfaceNormal(mesh, COORDINATE_CONVENTION.pressure.suctionSurface);
  const suctionNormal = axisLabel(suction);
  return {
    suctionSurface: COORDINATE_CONVENTION.pressure.suctionSurface,
    surfaceOwnership: COORDINATE_CONVENTION.pressure.surfaceOwnership,
    rigidMouthSurface: COORDINATE_CONVENTION.pressure.rigidMouthSurface,
    suctionNormal,
    expectedSuctionNormal: COORDINATE_CONVENTION.pressure.currentSuctionNormal,
    negativePressureEffect: COORDINATE_CONVENTION.pressure.negativePressureEffect,
    valid: suctionNormal === COORDINATE_CONVENTION.pressure.currentSuctionNormal,
    warnings:
      suctionNormal === COORDINATE_CONVENTION.pressure.currentSuctionNormal
        ? []
        : [`pipette_suction_surface normal is ${suctionNormal}; expected ${COORDINATE_CONVENTION.pressure.currentSuctionNormal}`],
  };
}

export function validateNativeMesh(mesh) {
  const base = validateFebioMesh(mesh);
  const surfaceNormals = buildSurfaceNormalDiagnostics(mesh);
  const contactPairs = buildContactPairDiagnostics(mesh);
  const pressure = buildPressureDiagnostics(mesh);
  return {
    ...base,
    coordinateConvention: COORDINATE_CONVENTION,
    surfaceNormalDiagnostics: surfaceNormals,
    contactPairDiagnostics: contactPairs,
    pressureDiagnostics: pressure,
    conventionWarnings: [
      ...surfaceNormals.warnings,
      ...contactPairs.warnings,
      ...pressure.warnings,
    ],
  };
}
