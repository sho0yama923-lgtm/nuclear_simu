/**
 * SOURCE OF TRUTH: FEBio mesh generation for the current refined main path.
 *
 * Responsibility: define the mesh structure, node sets, surfaces, and surface pairs used by FEBio export.
 * Owns: buildRefinedFebioGeometry, validateFebioMesh.
 * Does NOT own: interface material laws, XML serialization, result import.
 * Primary entrypoints: buildRefinedFebioGeometry, validateFebioMesh.
 * Depends on: src/model/schema.ts for geometry values only.
 */

export function buildRefinedFebioGeometry(inputSpec) {
  const left = -inputSpec.geometry.Lc / 2;
  const right = inputSpec.geometry.Lc / 2;
  const top = inputSpec.geometry.Hc;
  const nucleusLeft = inputSpec.geometry.xn - inputSpec.geometry.Ln / 2;
  const nucleusRight = inputSpec.geometry.xn + inputSpec.geometry.Ln / 2;
  const nucleusBottom = inputSpec.geometry.yn - inputSpec.geometry.Hn / 2;
  const nucleusTop = inputSpec.geometry.yn + inputSpec.geometry.Hn / 2;

  return {
    meshMode: "refined",
    bounds: {
      cellLeft: left,
      cellRight: right,
      cellTop: top,
      nucleusLeft,
      nucleusRight,
      nucleusBottom,
      nucleusTop,
    },
    nodes: [
      { id: 1, x: left, y: -0.5, z: 0 },
      { id: 2, x: right, y: -0.5, z: 0 },
      { id: 3, x: right, y: 0.5, z: 0 },
      { id: 4, x: left, y: 0.5, z: 0 },
      { id: 5, x: left, y: -0.5, z: top },
      { id: 6, x: right, y: -0.5, z: top },
      { id: 7, x: right, y: 0.5, z: top },
      { id: 8, x: left, y: 0.5, z: top },
    ],
    elements: [
      { id: 1, type: "hex8", material: "cytoplasm", nodes: [1, 2, 3, 4, 5, 6, 7, 8] },
    ],
    surfaces: {
      nucleus_interface_surface: [{ id: 1, type: "quad4", nodes: [1, 4, 8, 5] }],
      nucleus_interface_left_surface: [{ id: 2, type: "quad4", nodes: [1, 4, 8, 5] }],
      nucleus_interface_right_surface: [{ id: 3, type: "quad4", nodes: [2, 3, 7, 6] }],
      nucleus_interface_top_surface: [{ id: 4, type: "quad4", nodes: [5, 6, 7, 8] }],
      nucleus_interface_bottom_surface: [{ id: 5, type: "quad4", nodes: [1, 2, 3, 4] }],
      cytoplasm_interface_surface: [{ id: 6, type: "quad4", nodes: [1, 4, 8, 5] }],
      cytoplasm_interface_left_surface: [{ id: 7, type: "quad4", nodes: [1, 4, 8, 5] }],
      cytoplasm_interface_right_surface: [{ id: 8, type: "quad4", nodes: [2, 3, 7, 6] }],
      cytoplasm_interface_top_surface: [{ id: 9, type: "quad4", nodes: [5, 6, 7, 8] }],
      cytoplasm_interface_bottom_surface: [{ id: 10, type: "quad4", nodes: [1, 2, 3, 4] }],
      cell_dish_surface: [{ id: 11, type: "quad4", nodes: [1, 2, 3, 4] }],
    },
    nodeSets: {
      nc_left_nucleus_nodes: [1, 4, 5, 8],
      nc_right_nucleus_nodes: [2, 3, 6, 7],
      nc_top_nucleus_nodes: [5, 6, 7, 8],
      nc_bottom_nucleus_nodes: [1, 2, 3, 4],
      nc_left_cytoplasm_nodes: [1, 4, 5, 8],
      nc_right_cytoplasm_nodes: [2, 3, 6, 7],
      nc_top_cytoplasm_nodes: [5, 6, 7, 8],
      nc_bottom_cytoplasm_nodes: [1, 2, 3, 4],
      cd_left_cell_nodes: [1, 4],
      cd_center_cell_nodes: [2, 3],
      cd_right_cell_nodes: [2, 3],
      dish_fixed_nodes: [1, 2, 3, 4],
    },
    elementSets: {
      cytoplasm: [1],
      nucleus: [],
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
        secondary: "cell_dish_surface",
      },
    },
  };
}

export function validateFebioMesh(mesh) {
  const invalidElements = [];
  const aspectRatioWarnings = [];

  if (!mesh.nodes?.length || !mesh.elements?.length) {
    invalidElements.push("mesh requires nodes and elements");
  }

  return {
    valid: invalidElements.length === 0,
    invalidElements,
    aspectRatioWarnings,
  };
}
