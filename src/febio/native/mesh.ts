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
  return refineNativeNucleusCytoplasmCoupling(refineNativeCellDishGeometry(applyNativeSolverSurfaceConventions(buildRefinedFebioGeometry(geometryForNativeMesh(spec)))));
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
      pipette_contact_surface: [{ ...mesh.surfaces.pipette_contact_surface[0], nodes: [17, 21, 24, 20] }],
    },
    surfacePairs: {
      ...mesh.surfacePairs,
      nucleus_cytoplasm_left_pair: { name: "nucleus_cytoplasm_left_pair", primary: "cytoplasm_interface_left_surface", secondary: "nucleus_interface_left_surface" },
      nucleus_cytoplasm_right_pair: { name: "nucleus_cytoplasm_right_pair", primary: "cytoplasm_interface_right_surface", secondary: "nucleus_interface_right_surface" },
      nucleus_cytoplasm_top_pair: { name: "nucleus_cytoplasm_top_pair", primary: "cytoplasm_interface_top_surface", secondary: "nucleus_interface_top_surface" },
      nucleus_cytoplasm_bottom_pair: { name: "nucleus_cytoplasm_bottom_pair", primary: "cytoplasm_interface_bottom_surface", secondary: "nucleus_interface_bottom_surface" },
    },
  };
}

function nodeById(mesh, id) {
  return (mesh.nodes || []).find((node) => node.id === id);
}

function buildNode(id, x, y, z) {
  return { id, x, y, z };
}

function buildHex(id, material, nodes) {
  return { id, type: "hex8", material, nodes };
}

function buildFacet(id, nodes) {
  return { id, type: "quad4", nodes };
}

function refineNativeCellDishGeometry(mesh) {
  const leftTop = nodeById(mesh, 29);
  const rightTop = nodeById(mesh, 30);
  const leftBottom = nodeById(mesh, 25);
  const rightBottom = nodeById(mesh, 26);
  const nucleusLeft = mesh.bounds?.nucleusLeft;
  const nucleusRight = mesh.bounds?.nucleusRight;
  if (!leftTop || !rightTop || !leftBottom || !rightBottom || !Number.isFinite(nucleusLeft) || !Number.isFinite(nucleusRight)) {
    return mesh;
  }

  const yMin = leftTop.y;
  const yMax = nodeById(mesh, 32)?.y ?? 0.5;
  const zTop = leftTop.z;
  const zBottom = leftBottom.z;
  const xLeft = leftTop.x;
  const xRight = rightTop.x;

  const splitNodes = [
    buildNode(57, nucleusLeft, yMin, zBottom),
    buildNode(58, nucleusLeft, yMax, zBottom),
    buildNode(59, nucleusRight, yMin, zBottom),
    buildNode(60, nucleusRight, yMax, zBottom),
    buildNode(61, nucleusLeft, yMin, zTop),
    buildNode(62, nucleusLeft, yMax, zTop),
    buildNode(63, nucleusRight, yMin, zTop),
    buildNode(64, nucleusRight, yMax, zTop),
  ];

  const nonDishElements = (mesh.elements || []).filter((element) => element.material !== "dish");
  const dishElements = [
    buildHex(4, "dish", [25, 57, 58, 28, 29, 61, 62, 32]),
    buildHex(8, "dish", [57, 59, 60, 58, 61, 63, 64, 62]),
    buildHex(9, "dish", [59, 26, 27, 60, 63, 30, 31, 64]),
  ];
  const dishTopFacets = [
    buildFacet(21, [29, 61, 62, 32]),
    buildFacet(22, [61, 63, 64, 62]),
    buildFacet(23, [63, 30, 31, 64]),
  ];

  return {
    ...mesh,
    refinements: {
      ...(mesh.refinements || {}),
      cellDishBands: {
        mode: "in-place-current-native",
        splitX: [xLeft, nucleusLeft, nucleusRight, xRight],
        dishContactSurfaceSplit: true,
      },
    },
    nodes: [...(mesh.nodes || []), ...splitNodes],
    elements: [...nonDishElements, ...dishElements].sort((a, b) => a.id - b.id),
    surfaces: {
      ...mesh.surfaces,
      dish_contact_surface: dishTopFacets,
      dish_contact_left_surface: [dishTopFacets[0]],
      dish_contact_center_surface: [dishTopFacets[1]],
      dish_contact_right_surface: [dishTopFacets[2]],
    },
    nodeSets: {
      ...mesh.nodeSets,
      dish_fixed_nodes: [25, 26, 27, 28, 57, 58, 59, 60],
      dish_contact_left_nodes: [29, 32, 61, 62],
      dish_contact_center_nodes: [61, 62, 63, 64],
      dish_contact_right_nodes: [30, 31, 63, 64],
    },
    elementSets: {
      ...mesh.elementSets,
      dish: [4, 8, 9],
    },
  };
}

function refineNativeNucleusCytoplasmCoupling(mesh) {
  const left = mesh.bounds?.cellLeft;
  const right = mesh.bounds?.cellRight;
  const nucleusLeft = mesh.bounds?.nucleusLeft;
  const nucleusRight = mesh.bounds?.nucleusRight;
  const bottom = 0;
  const top = mesh.bounds?.cellTop;
  const nucleusBottom = mesh.bounds?.nucleusBottom;
  const nucleusTop = mesh.bounds?.nucleusTop;
  if (![left, right, nucleusLeft, nucleusRight, top, nucleusBottom, nucleusTop].every(Number.isFinite)) return mesh;

  const yMin = -0.5;
  const yMax = 0.5;
  const splitNodes = [
    buildNode(65, left, yMin, nucleusBottom),
    buildNode(66, left, yMax, nucleusBottom),
    buildNode(67, left, yMin, nucleusTop),
    buildNode(68, left, yMax, nucleusTop),
    buildNode(69, right, yMin, nucleusBottom),
    buildNode(70, right, yMax, nucleusBottom),
    buildNode(71, right, yMin, nucleusTop),
    buildNode(72, right, yMax, nucleusTop),
  ];
  const replacedIds = new Set([1, 2, 5]);
  const existingNodes = (mesh.nodes || []).filter((node) => node.id < 9 || node.id > 16);
  const elements = (mesh.elements || []).filter((element) => !replacedIds.has(element.id));
  const coupledElements = [
    buildHex(1, "cytoplasm", [1, 2, 3, 4, 65, 45, 48, 66]),
    buildHex(2, "nucleus", [45, 46, 47, 48, 49, 50, 51, 52]),
    buildHex(5, "cytoplasm", [33, 34, 35, 36, 46, 69, 70, 47]),
    buildHex(10, "cytoplasm", [65, 45, 48, 66, 67, 49, 52, 68]),
    buildHex(11, "cytoplasm", [67, 49, 52, 68, 5, 6, 7, 8]),
    buildHex(12, "cytoplasm", [46, 69, 70, 47, 50, 71, 72, 51]),
    buildHex(13, "cytoplasm", [50, 71, 72, 51, 37, 38, 39, 40]),
  ];

  return {
    ...mesh,
    refinements: {
      ...(mesh.refinements || {}),
      nucleusCytoplasmCoupling: {
        mode: "in-place-current-native-shared-nodes",
        contactFreeForceTransfer: true,
      },
    },
    nodes: [...existingNodes, ...splitNodes].sort((a, b) => a.id - b.id),
    elements: [...elements, ...coupledElements].sort((a, b) => a.id - b.id),
    surfaces: {
      ...mesh.surfaces,
      nucleus_interface_surface: [
        buildFacet(1, [45, 49, 52, 48]),
        buildFacet(2, [46, 47, 51, 50]),
        buildFacet(3, [49, 50, 51, 52]),
        buildFacet(4, [45, 48, 47, 46]),
      ],
      nucleus_interface_left_surface: [buildFacet(2, [45, 49, 52, 48])],
      nucleus_interface_right_surface: [buildFacet(3, [46, 50, 51, 47])],
      nucleus_interface_top_surface: [buildFacet(4, [49, 50, 51, 52])],
      nucleus_interface_bottom_surface: [buildFacet(5, [45, 48, 47, 46])],
      cytoplasm_interface_surface: [
        buildFacet(6, [45, 48, 52, 49]),
        buildFacet(7, [46, 50, 51, 47]),
        buildFacet(8, [45, 46, 47, 48]),
        buildFacet(9, [49, 52, 51, 50]),
      ],
      cytoplasm_interface_left_surface: [buildFacet(10, [45, 48, 52, 49])],
      cytoplasm_interface_right_surface: [buildFacet(11, [46, 47, 51, 50])],
      cytoplasm_interface_top_surface: [buildFacet(12, [49, 52, 51, 50])],
      cytoplasm_interface_bottom_surface: [buildFacet(13, [45, 46, 47, 48])],
      pipette_suction_surface: [buildFacet(20, [46, 50, 51, 47])],
    },
    nodeSets: {
      ...mesh.nodeSets,
      nc_left_nucleus_nodes: [45, 48, 49, 52],
      nc_right_nucleus_nodes: [46, 47, 50, 51],
      nc_top_nucleus_nodes: [49, 50, 51, 52],
      nc_bottom_nucleus_nodes: [45, 46, 47, 48],
      nc_left_cytoplasm_nodes: [45, 48, 49, 52],
      nc_right_cytoplasm_nodes: [46, 47, 50, 51],
      nc_top_cytoplasm_nodes: [49, 50, 51, 52],
      nc_bottom_cytoplasm_nodes: [45, 46, 47, 48],
    },
    elementSets: {
      ...mesh.elementSets,
      cytoplasm: [1, 5, 6, 7, 10, 11, 12, 13],
      nucleus: [2],
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
    nucleus_cytoplasm_left_pair: { primary: "cytoplasm_interface_left_surface", secondary: "nucleus_interface_left_surface" },
    nucleus_cytoplasm_right_pair: { primary: "cytoplasm_interface_right_surface", secondary: "nucleus_interface_right_surface" },
    nucleus_cytoplasm_top_pair: { primary: "cytoplasm_interface_top_surface", secondary: "nucleus_interface_top_surface" },
    nucleus_cytoplasm_bottom_pair: { primary: "cytoplasm_interface_bottom_surface", secondary: "nucleus_interface_bottom_surface" },
    cell_dish_pair: { primary: "cell_dish_surface", secondary: "dish_contact_surface" },
    pipette_nucleus_pair: { primary: "nucleus_interface_right_surface", secondary: "pipette_contact_surface" },
    pipette_cell_pair: { primary: "pipette_suction_surface", secondary: "pipette_contact_surface" },
  },
};

const EXPECTED_SURFACE_NORMALS = {
  nucleus_interface_left_surface: "-x",
  nucleus_interface_right_surface: "-x",
  nucleus_interface_top_surface: "+z",
  nucleus_interface_bottom_surface: "-z",
  cytoplasm_interface_left_surface: "+x",
  cytoplasm_interface_right_surface: "+x",
  cytoplasm_interface_top_surface: "-z",
  cytoplasm_interface_bottom_surface: "+z",
  cell_dish_left_surface: "-z",
  cell_dish_center_surface: "-z",
  cell_dish_right_surface: "-z",
  dish_contact_surface: "+z",
  pipette_suction_surface: "-x",
  pipette_contact_surface: "-x",
};

const PAIR_ALIGNMENT_CHECKS = [
  { name: "nc_left", primary: "cytoplasm_interface_left_surface", secondary: "nucleus_interface_left_surface", expected: "opposed" },
  { name: "nc_right", primary: "cytoplasm_interface_right_surface", secondary: "nucleus_interface_right_surface", expected: "opposed" },
  { name: "nc_top", primary: "cytoplasm_interface_top_surface", secondary: "nucleus_interface_top_surface", expected: "opposed" },
  { name: "nc_bottom", primary: "cytoplasm_interface_bottom_surface", secondary: "nucleus_interface_bottom_surface", expected: "opposed" },
  { name: "cell_dish_left", primary: "cell_dish_left_surface", secondary: "dish_contact_surface", expected: "opposed" },
  { name: "cell_dish_center", primary: "cell_dish_center_surface", secondary: "dish_contact_surface", expected: "opposed" },
  { name: "cell_dish_right", primary: "cell_dish_right_surface", secondary: "dish_contact_surface", expected: "opposed" },
  { name: "pipette_cell", primary: "pipette_suction_surface", secondary: "pipette_contact_surface", expected: "same" },
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
      const same = normalDot != null && normalDot > 0.75;
      return [
        check.name,
        {
          primary: check.primary,
          secondary: check.secondary,
          primaryNormal: axisLabel(primaryNormal),
          secondaryNormal: axisLabel(secondaryNormal),
          dot: normalDot,
          expected: check.expected,
          aligned: check.expected === "opposed" ? opposed : check.expected === "same" ? same : false,
        },
      ];
    }),
  );
  const warnings = Object.entries(checks)
    .filter(([, entry]) => !entry.aligned)
    .map(([name, entry]) => `${name} surfaces are ${entry.primaryNormal}/${entry.secondaryNormal}; expected ${entry.expected} normals`);
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
