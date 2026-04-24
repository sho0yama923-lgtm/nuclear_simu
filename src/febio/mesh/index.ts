/**
 * SOURCE OF TRUTH: FEBio mesh generation for the current solver-active debug path.
 *
 * Responsibility: define the mesh structure, node sets, surfaces, and surface pairs used by FEBio export.
 * Owns: buildRefinedFebioGeometry, validateFebioMesh.
 * Does NOT own: interface material laws, XML serialization, result import.
 * Primary entrypoints: buildRefinedFebioGeometry, validateFebioMesh.
 * Depends on: src/model/schema.ts for geometry values only.
 */

const REQUIRED_ELEMENT_SETS = ["nucleus", "cytoplasm", "dish", "pipette"];
const REQUIRED_NODE_SETS = [
  "dish_fixed_nodes",
  "pipette_contact_nodes",
  "nc_left_nucleus_nodes",
  "nc_right_nucleus_nodes",
  "nc_top_nucleus_nodes",
  "nc_bottom_nucleus_nodes",
  "nc_left_cytoplasm_nodes",
  "nc_right_cytoplasm_nodes",
  "nc_top_cytoplasm_nodes",
  "nc_bottom_cytoplasm_nodes",
  "cd_left_cell_nodes",
  "cd_center_cell_nodes",
  "cd_right_cell_nodes",
];
const REQUIRED_SURFACES = [
  "nucleus_interface_surface",
  "nucleus_interface_left_surface",
  "nucleus_interface_right_surface",
  "nucleus_interface_top_surface",
  "nucleus_interface_bottom_surface",
  "cytoplasm_interface_surface",
  "cytoplasm_interface_left_surface",
  "cytoplasm_interface_right_surface",
  "cytoplasm_interface_top_surface",
  "cytoplasm_interface_bottom_surface",
  "cell_dish_surface",
  "dish_contact_surface",
  "cell_dish_left_surface",
  "cell_dish_center_surface",
  "cell_dish_right_surface",
  "pipette_suction_surface",
  "pipette_contact_surface",
];
const REQUIRED_SURFACE_PAIRS = {
  nucleus_cytoplasm_pair: {
    primary: "cytoplasm_interface_surface",
    secondary: "nucleus_interface_surface",
  },
  cell_dish_pair: {
    primary: "cell_dish_surface",
    secondary: "dish_contact_surface",
  },
  pipette_nucleus_pair: {
    primary: "nucleus_interface_right_surface",
    secondary: "pipette_contact_surface",
  },
  pipette_cell_pair: {
    primary: "pipette_suction_surface",
    secondary: "pipette_contact_surface",
  },
};

function buildQuad(id, nodes) {
  return { id, type: "quad4", nodes };
}

export function buildRefinedFebioGeometry(inputSpec) {
  const left = -inputSpec.geometry.Lc / 2;
  const right = inputSpec.geometry.Lc / 2;
  const top = inputSpec.geometry.Hc;
  const nucleusLeft = inputSpec.geometry.xn - inputSpec.geometry.Ln / 2;
  const nucleusRight = inputSpec.geometry.xn + inputSpec.geometry.Ln / 2;
  const nucleusBottom = inputSpec.geometry.yn - inputSpec.geometry.Hn / 2;
  const nucleusTop = inputSpec.geometry.yn + inputSpec.geometry.Hn / 2;
  const dishBottom = -Math.max(inputSpec.geometry.Hc * 0.08, 1);
  const nucleusHalfThickness = 0.25;
  const pipetteHalfThickness = 0.2;
  const pipetteLength = Math.max(inputSpec.geometry.rp * 2, 6);
  const pipetteLeft = inputSpec.geometry.xp;
  const pipetteRight = inputSpec.geometry.xp + pipetteLength;
  const pipetteBottom = Math.max(0, inputSpec.geometry.zp - inputSpec.geometry.rp);
  const pipetteTop = Math.min(top, inputSpec.geometry.zp + inputSpec.geometry.rp);

  return {
    meshMode: inputSpec.geometry.meshMode || "refined",
    bounds: {
      cellLeft: left,
      cellRight: right,
      cellTop: top,
      nucleusLeft,
      nucleusRight,
      nucleusBottom,
      nucleusTop,
      dishBottom,
      pipetteLeft,
      pipetteRight,
      pipetteContactX: pipetteLeft,
      pipetteBottom,
      pipetteTop,
    },
    nodes: [
      { id: 1, x: left, y: -0.5, z: 0 },
      { id: 2, x: nucleusLeft, y: -0.5, z: 0 },
      { id: 3, x: nucleusLeft, y: 0.5, z: 0 },
      { id: 4, x: left, y: 0.5, z: 0 },
      { id: 5, x: left, y: -0.5, z: top },
      { id: 6, x: nucleusLeft, y: -0.5, z: top },
      { id: 7, x: nucleusLeft, y: 0.5, z: top },
      { id: 8, x: left, y: 0.5, z: top },
      { id: 9, x: nucleusLeft, y: -nucleusHalfThickness, z: nucleusBottom },
      { id: 10, x: nucleusRight, y: -nucleusHalfThickness, z: nucleusBottom },
      { id: 11, x: nucleusRight, y: nucleusHalfThickness, z: nucleusBottom },
      { id: 12, x: nucleusLeft, y: nucleusHalfThickness, z: nucleusBottom },
      { id: 13, x: nucleusLeft, y: -nucleusHalfThickness, z: nucleusTop },
      { id: 14, x: nucleusRight, y: -nucleusHalfThickness, z: nucleusTop },
      { id: 15, x: nucleusRight, y: nucleusHalfThickness, z: nucleusTop },
      { id: 16, x: nucleusLeft, y: nucleusHalfThickness, z: nucleusTop },
      { id: 17, x: pipetteLeft, y: -pipetteHalfThickness, z: pipetteBottom },
      { id: 18, x: pipetteRight, y: -pipetteHalfThickness, z: pipetteBottom },
      { id: 19, x: pipetteRight, y: pipetteHalfThickness, z: pipetteBottom },
      { id: 20, x: pipetteLeft, y: pipetteHalfThickness, z: pipetteBottom },
      { id: 21, x: pipetteLeft, y: -pipetteHalfThickness, z: pipetteTop },
      { id: 22, x: pipetteRight, y: -pipetteHalfThickness, z: pipetteTop },
      { id: 23, x: pipetteRight, y: pipetteHalfThickness, z: pipetteTop },
      { id: 24, x: pipetteLeft, y: pipetteHalfThickness, z: pipetteTop },
      { id: 25, x: left, y: -0.5, z: dishBottom },
      { id: 26, x: right, y: -0.5, z: dishBottom },
      { id: 27, x: right, y: 0.5, z: dishBottom },
      { id: 28, x: left, y: 0.5, z: dishBottom },
      { id: 29, x: left, y: -0.5, z: 0 },
      { id: 30, x: right, y: -0.5, z: 0 },
      { id: 31, x: right, y: 0.5, z: 0 },
      { id: 32, x: left, y: 0.5, z: 0 },
      { id: 33, x: nucleusRight, y: -0.5, z: 0 },
      { id: 34, x: right, y: -0.5, z: 0 },
      { id: 35, x: right, y: 0.5, z: 0 },
      { id: 36, x: nucleusRight, y: 0.5, z: 0 },
      { id: 37, x: nucleusRight, y: -0.5, z: top },
      { id: 38, x: right, y: -0.5, z: top },
      { id: 39, x: right, y: 0.5, z: top },
      { id: 40, x: nucleusRight, y: 0.5, z: top },
      { id: 41, x: nucleusLeft, y: -0.5, z: 0 },
      { id: 42, x: nucleusRight, y: -0.5, z: 0 },
      { id: 43, x: nucleusRight, y: 0.5, z: 0 },
      { id: 44, x: nucleusLeft, y: 0.5, z: 0 },
      { id: 45, x: nucleusLeft, y: -0.5, z: nucleusBottom },
      { id: 46, x: nucleusRight, y: -0.5, z: nucleusBottom },
      { id: 47, x: nucleusRight, y: 0.5, z: nucleusBottom },
      { id: 48, x: nucleusLeft, y: 0.5, z: nucleusBottom },
      { id: 49, x: nucleusLeft, y: -0.5, z: nucleusTop },
      { id: 50, x: nucleusRight, y: -0.5, z: nucleusTop },
      { id: 51, x: nucleusRight, y: 0.5, z: nucleusTop },
      { id: 52, x: nucleusLeft, y: 0.5, z: nucleusTop },
      { id: 53, x: nucleusLeft, y: -0.5, z: top },
      { id: 54, x: nucleusRight, y: -0.5, z: top },
      { id: 55, x: nucleusRight, y: 0.5, z: top },
      { id: 56, x: nucleusLeft, y: 0.5, z: top },
    ],
    elements: [
      { id: 1, type: "hex8", material: "cytoplasm", nodes: [1, 2, 3, 4, 5, 6, 7, 8] },
      { id: 2, type: "hex8", material: "nucleus", nodes: [9, 10, 11, 12, 13, 14, 15, 16] },
      { id: 3, type: "hex8", material: "pipette", nodes: [17, 18, 19, 20, 21, 22, 23, 24] },
      { id: 4, type: "hex8", material: "dish", nodes: [25, 26, 27, 28, 29, 30, 31, 32] },
      { id: 5, type: "hex8", material: "cytoplasm", nodes: [33, 34, 35, 36, 37, 38, 39, 40] },
      { id: 6, type: "hex8", material: "cytoplasm", nodes: [41, 42, 43, 44, 45, 46, 47, 48] },
      { id: 7, type: "hex8", material: "cytoplasm", nodes: [49, 50, 51, 52, 53, 54, 55, 56] },
    ],
    surfaces: {
      nucleus_interface_surface: [
        buildQuad(1, [9, 13, 16, 12]),
        buildQuad(2, [10, 11, 15, 14]),
        buildQuad(3, [13, 14, 15, 16]),
        buildQuad(4, [9, 12, 11, 10]),
      ],
      nucleus_interface_left_surface: [buildQuad(2, [9, 13, 16, 12])],
      nucleus_interface_right_surface: [buildQuad(3, [10, 11, 15, 14])],
      nucleus_interface_top_surface: [buildQuad(4, [13, 14, 15, 16])],
      nucleus_interface_bottom_surface: [buildQuad(5, [9, 12, 11, 10])],
      cytoplasm_interface_surface: [
        buildQuad(6, [2, 3, 7, 6]),
        buildQuad(7, [33, 37, 40, 36]),
        buildQuad(8, [45, 46, 47, 48]),
        buildQuad(9, [49, 52, 51, 50]),
      ],
      cytoplasm_interface_left_surface: [buildQuad(10, [2, 3, 7, 6])],
      cytoplasm_interface_right_surface: [buildQuad(11, [33, 37, 40, 36])],
      cytoplasm_interface_top_surface: [buildQuad(12, [49, 52, 51, 50])],
      cytoplasm_interface_bottom_surface: [buildQuad(13, [45, 46, 47, 48])],
      cell_dish_surface: [
        buildQuad(14, [1, 2, 3, 4]),
        buildQuad(15, [41, 42, 43, 44]),
        buildQuad(16, [33, 34, 35, 36]),
      ],
      dish_contact_surface: [buildQuad(12, [29, 30, 31, 32])],
      cell_dish_left_surface: [buildQuad(17, [1, 2, 3, 4])],
      cell_dish_center_surface: [buildQuad(18, [41, 42, 43, 44])],
      cell_dish_right_surface: [buildQuad(19, [33, 34, 35, 36])],
      pipette_suction_surface: [buildQuad(20, [10, 14, 15, 11])],
      pipette_contact_surface: [buildQuad(16, [17, 20, 24, 21])],
    },
    nodeSets: {
      nc_left_nucleus_nodes: [9, 12, 13, 16],
      nc_right_nucleus_nodes: [10, 11, 14, 15],
      nc_top_nucleus_nodes: [13, 14, 15, 16],
      nc_bottom_nucleus_nodes: [9, 10, 11, 12],
      nc_left_cytoplasm_nodes: [2, 3, 6, 7],
      nc_right_cytoplasm_nodes: [33, 36, 37, 40],
      nc_top_cytoplasm_nodes: [49, 50, 51, 52],
      nc_bottom_cytoplasm_nodes: [45, 46, 47, 48],
      cd_left_cell_nodes: [1, 4],
      cd_center_cell_nodes: [41, 42, 43, 44],
      cd_right_cell_nodes: [34, 35],
      dish_fixed_nodes: [25, 26, 27, 28],
      pipette_contact_nodes: [17, 20, 21, 24],
    },
    elementSets: {
      cytoplasm: [1, 5, 6, 7],
      nucleus: [2],
      pipette: [3],
      dish: [4],
    },
    surfacePairs: {
      nucleus_cytoplasm_pair: {
        name: "nucleus_cytoplasm_pair",
        primary: "cytoplasm_interface_surface",
        secondary: "nucleus_interface_surface",
      },
      cell_dish_pair: {
        name: "cell_dish_pair",
        primary: "cell_dish_surface",
        secondary: "dish_contact_surface",
      },
      pipette_nucleus_pair: {
        name: "pipette_nucleus_pair",
        primary: "nucleus_interface_right_surface",
        secondary: "pipette_contact_surface",
      },
      pipette_cell_pair: {
        name: "pipette_cell_pair",
        primary: "pipette_suction_surface",
        secondary: "pipette_contact_surface",
      },
    },
  };
}

export function validateFebioMesh(mesh) {
  const invalidElements = [];
  const aspectRatioWarnings = [];
  const nodeIds = new Set((mesh.nodes || []).map((node) => node.id));
  const elementIds = new Set((mesh.elements || []).map((element) => element.id));
  const surfaces = mesh.surfaces || {};
  const surfacePairs = mesh.surfacePairs || {};
  const requiredDomains = {};
  const requiredNodeSets = {};
  const requiredSurfaces = {};
  const requiredSurfacePairs = {};

  if (!mesh.nodes?.length || !mesh.elements?.length) {
    invalidElements.push("mesh requires nodes and elements");
  }

  (mesh.elements || []).forEach((element) => {
    const missingNode = (element.nodes || []).find((nodeId) => !nodeIds.has(nodeId));
    if (missingNode != null) {
      invalidElements.push(`element ${element.id} references missing node ${missingNode}`);
    }
  });

  REQUIRED_ELEMENT_SETS.forEach((setName) => {
    const ids = mesh.elementSets?.[setName];
    const hasEntries = Array.isArray(ids) && ids.length > 0;
    requiredDomains[setName] = hasEntries ? "present" : "missing";
    if (!hasEntries) {
      invalidElements.push(`${setName} element set must be non-empty`);
      return;
    }
    const missingElement = ids.find((elementId) => !elementIds.has(elementId));
    if (missingElement != null) {
      invalidElements.push(`${setName} element set references missing element ${missingElement}`);
    }
  });

  REQUIRED_NODE_SETS.forEach((setName) => {
    const ids = mesh.nodeSets?.[setName];
    const hasEntries = Array.isArray(ids) && ids.length > 0;
    requiredNodeSets[setName] = hasEntries ? "present" : "missing";
    if (!hasEntries) {
      invalidElements.push(`${setName} node set must be non-empty`);
      return;
    }
    const missingNode = ids.find((nodeId) => !nodeIds.has(nodeId));
    if (missingNode != null) {
      invalidElements.push(`${setName} node set references missing node ${missingNode}`);
    }
  });

  REQUIRED_SURFACES.forEach((surfaceName) => {
    const facets = surfaces[surfaceName];
    const hasFacets = Array.isArray(facets) && facets.length > 0;
    requiredSurfaces[surfaceName] = hasFacets;
    if (!hasFacets) {
      invalidElements.push(`${surfaceName} surface must be present and non-empty`);
      return;
    }
    facets.forEach((facet, index) => {
      const missingNode = (facet.nodes || []).find((nodeId) => !nodeIds.has(nodeId));
      if (missingNode != null) {
        invalidElements.push(`${surfaceName} facet ${index} references missing node ${missingNode}`);
      }
    });
  });

  Object.entries(REQUIRED_SURFACE_PAIRS).forEach(([pairName, requirement]) => {
    const pair = surfacePairs[pairName];
    const pairState = {
      present: Boolean(pair),
      primary: pair?.primary === requirement.primary,
      secondary: pair?.secondary === requirement.secondary,
      surfacesReady: Boolean(requiredSurfaces[requirement.primary] && requiredSurfaces[requirement.secondary]),
    };
    requiredSurfacePairs[pairName] = pairState;
    if (!pairState.present) {
      invalidElements.push(`${pairName} surface pair must be present`);
      return;
    }
    if (!pairState.primary) {
      invalidElements.push(`${pairName} primary surface must be ${requirement.primary}`);
    }
    if (!pairState.secondary) {
      invalidElements.push(`${pairName} secondary surface must be ${requirement.secondary}`);
    }
    if (!pairState.surfacesReady) {
      invalidElements.push(`${pairName} must reference non-empty required surfaces`);
    }
  });

  return {
    valid: invalidElements.length === 0,
    invalidElements,
    aspectRatioWarnings,
    requiredDomains,
    requiredNodeSets,
    requiredSurfaces,
    requiredSurfacePairs,
  };
}
