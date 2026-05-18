import { buildRefinedFebioGeometry, validateFebioMesh } from "../mesh/index.ts";
import { buildGmshBaselineNativeMesh } from "./gmsh.ts";

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
  if (spec.geometry?.meshMode === "s10-top-pipette-reference") {
    return buildTopPipetteReferenceMesh(spec);
  }
  const nativeMesh = refineNativeNucleusCytoplasmCoupling(refineNativeCellDishGeometry(applyNativeSolverSurfaceConventions(buildRefinedFebioGeometry(geometryForNativeMesh(spec)), spec)), spec);
  if (spec.geometry?.meshMode === "s10-gmsh-baseline") {
    return buildGmshBaselineNativeMesh(nativeMesh);
  }
  return nativeMesh;
}

function buildTopPipetteReferenceMesh(spec = {}) {
  const cellWidth = spec.geometry?.cytoplasm?.width ?? 52;
  const cellHeight = spec.geometry?.cytoplasm?.height ?? 34;
  const nucleusWidth = spec.geometry?.nucleus?.width ?? 28;
  const nucleusHeight = spec.geometry?.nucleus?.height ?? 18;
  const nucleusCenterX = spec.geometry?.nucleus?.center?.x ?? 0;
  const nucleusCenterZ = spec.geometry?.nucleus?.center?.z ?? 17;
  const pipetteRadius = spec.geometry?.pipette?.radius ?? 6.5;
  const cellLeft = -cellWidth / 2;
  const cellRight = cellWidth / 2;
  const cellTop = cellHeight;
  const nucleusLeft = nucleusCenterX - nucleusWidth / 2;
  const nucleusRight = nucleusCenterX + nucleusWidth / 2;
  const nucleusBottom = nucleusCenterZ - nucleusHeight / 2;
  const nucleusTop = nucleusCenterZ + nucleusHeight / 2;
  const dishBottom = -Math.max(cellHeight * 0.08, 1);
  const patchHalfWidth = Math.min(pipetteRadius, nucleusWidth * 0.25);
  const patchLeft = Math.max(nucleusLeft, nucleusCenterX - patchHalfWidth);
  const patchRight = Math.min(nucleusRight, nucleusCenterX + patchHalfWidth);
  const pipetteBottom = nucleusTop;
  const pipetteTop = cellTop + Math.max(pipetteRadius * 2, 6);
  const yMin = -0.5;
  const yMax = 0.5;

  let nextNodeId = 1;
  let nextElementId = 1;
  let nextFacetId = 1;
  const nodes = [];
  const elements = [];
  const nodeByKey = new Map();

  function node(material, x, y, z) {
    const key = `${material}|${[x, y, z].map((value) => Number(value).toPrecision(15)).join("|")}`;
    const existing = nodeByKey.get(key);
    if (existing) return existing;
    const id = nextNodeId++;
    nodes.push(buildNode(id, x, y, z));
    nodeByKey.set(key, id);
    return id;
  }

  function addBox(material, x0, x1, z0, z1) {
    if (!(x1 > x0) || !(z1 > z0)) return null;
    const ids = [
      node(material, x0, yMin, z0),
      node(material, x1, yMin, z0),
      node(material, x1, yMax, z0),
      node(material, x0, yMax, z0),
      node(material, x0, yMin, z1),
      node(material, x1, yMin, z1),
      node(material, x1, yMax, z1),
      node(material, x0, yMax, z1),
    ];
    const element = buildHex(nextElementId++, material, ids);
    elements.push(element);
    return element;
  }

  function facet(nodesForFacet) {
    return buildFacet(nextFacetId++, nodesForFacet);
  }

  const xCuts = [cellLeft, nucleusLeft, patchLeft, patchRight, nucleusRight, cellRight];
  const elementSets = { cytoplasm: [], nucleus: [], pipette: [], dish: [] };
  const cytoplasmBottom = [];
  const cytoplasmTopOverNucleus = [];
  const nucleusElements = [];
  const dishElements = [];

  for (let index = 0; index < xCuts.length - 1; index += 1) {
    const x0 = xCuts[index];
    const x1 = xCuts[index + 1];
    const bottom = addBox("cytoplasm", x0, x1, 0, nucleusBottom);
    const top = addBox("cytoplasm", x0, x1, nucleusTop, cellTop);
    if (bottom) {
      elementSets.cytoplasm.push(bottom.id);
      cytoplasmBottom.push(bottom);
    }
    if (top) {
      elementSets.cytoplasm.push(top.id);
      if (x0 >= nucleusLeft && x1 <= nucleusRight) cytoplasmTopOverNucleus.push(top);
    }
    if (x1 <= nucleusLeft || x0 >= nucleusRight) {
      const side = addBox("cytoplasm", x0, x1, nucleusBottom, nucleusTop);
      if (side) elementSets.cytoplasm.push(side.id);
    }
    const dish = addBox("dish", x0, x1, dishBottom, 0);
    if (dish) {
      elementSets.dish.push(dish.id);
      dishElements.push(dish);
    }
  }

  [[nucleusLeft, patchLeft], [patchLeft, patchRight], [patchRight, nucleusRight]].forEach(([x0, x1]) => {
    const element = addBox("nucleus", x0, x1, nucleusBottom, nucleusTop);
    if (element) {
      elementSets.nucleus.push(element.id);
      nucleusElements.push(element);
    }
  });

  const pipetteLower = addBox("pipette", patchLeft, patchRight, pipetteBottom, cellTop);
  const pipetteUpper = addBox("pipette", patchLeft, patchRight, cellTop, pipetteTop);
  [pipetteLower, pipetteUpper].filter(Boolean).forEach((element) => elementSets.pipette.push(element.id));

  function bottomFace(element) { return [element.nodes[0], element.nodes[3], element.nodes[2], element.nodes[1]]; }
  function topFace(element) { return [element.nodes[4], element.nodes[5], element.nodes[6], element.nodes[7]]; }
  function topFaceNegativeZ(element) { return [element.nodes[4], element.nodes[7], element.nodes[6], element.nodes[5]]; }
  function leftFaceNegativeX(element) { return [element.nodes[0], element.nodes[4], element.nodes[7], element.nodes[3]]; }
  function rightFaceNegativeX(element) { return [element.nodes[1], element.nodes[5], element.nodes[6], element.nodes[2]]; }
  function leftFacePositiveX(element) { return [element.nodes[0], element.nodes[3], element.nodes[7], element.nodes[4]]; }
  function rightFacePositiveX(element) { return [element.nodes[1], element.nodes[2], element.nodes[6], element.nodes[5]]; }

  const nucleusLeftElement = nucleusElements[0];
  const nucleusPatchElement = nucleusElements[1];
  const nucleusRightElement = nucleusElements[2];
  const topCytoLeft = cytoplasmTopOverNucleus[0];
  const topCytoPatch = cytoplasmTopOverNucleus[1];
  const topCytoRight = cytoplasmTopOverNucleus[2];
  const middleLeftCyto = elements.find((element) => element.material === "cytoplasm" && nodeById({ nodes }, element.nodes[1])?.x === nucleusLeft && nodeById({ nodes }, element.nodes[1])?.z === nucleusBottom);
  const middleRightCyto = elements.find((element) => element.material === "cytoplasm" && nodeById({ nodes }, element.nodes[0])?.x === nucleusRight && nodeById({ nodes }, element.nodes[0])?.z === nucleusBottom);

  const suctionPatchFacet = facet(topFaceNegativeZ(nucleusPatchElement));
  const pipetteMouthFacet = facet(bottomFace(pipetteLower));
  const cellDishFacets = cytoplasmBottom.map((element) => facet(bottomFace(element)));
  const dishContactFacets = dishElements.map((element) => facet(topFace(element)));
  const nucleusTopFacets = nucleusElements.map((element) => facet(topFace(element)));
  const cytoplasmTopNcFacets = [topCytoLeft, topCytoPatch, topCytoRight].filter(Boolean).map((element) => facet(bottomFace(element)));
  const nucleusBottomFacets = nucleusElements.map((element) => facet(bottomFace(element)));

  const surfaces = {
    nucleus_interface_surface: [
      facet(leftFaceNegativeX(nucleusLeftElement)),
      facet(rightFaceNegativeX(nucleusRightElement)),
      ...nucleusTopFacets,
      ...nucleusBottomFacets,
    ],
    nucleus_interface_left_surface: [facet(leftFaceNegativeX(nucleusLeftElement))],
    nucleus_interface_right_surface: [facet(rightFaceNegativeX(nucleusRightElement))],
    nucleus_interface_top_surface: nucleusTopFacets,
    nucleus_interface_bottom_surface: nucleusBottomFacets,
    cytoplasm_interface_surface: [
      facet(rightFacePositiveX(middleLeftCyto)),
      facet(leftFacePositiveX(middleRightCyto)),
      ...cytoplasmTopNcFacets,
      ...cytoplasmBottom.filter((element) => {
        const x0 = nodeById({ nodes }, element.nodes[0])?.x;
        const x1 = nodeById({ nodes }, element.nodes[1])?.x;
        return x0 >= nucleusLeft && x1 <= nucleusRight;
      }).map((element) => facet(topFace(element))),
    ],
    cytoplasm_interface_left_surface: [facet(rightFacePositiveX(middleLeftCyto))],
    cytoplasm_interface_right_surface: [facet(leftFacePositiveX(middleRightCyto))],
    cytoplasm_interface_top_surface: cytoplasmTopNcFacets,
    cytoplasm_interface_bottom_surface: cytoplasmBottom.filter((element) => {
      const x0 = nodeById({ nodes }, element.nodes[0])?.x;
      const x1 = nodeById({ nodes }, element.nodes[1])?.x;
      return x0 >= nucleusLeft && x1 <= nucleusRight;
    }).map((element) => facet(topFace(element))),
    cell_dish_surface: cellDishFacets,
    dish_contact_surface: dishContactFacets,
    cell_dish_left_surface: cellDishFacets.filter((_, index) => index === 0),
    cell_dish_center_surface: cellDishFacets.filter((_, index) => index > 0 && index < cellDishFacets.length - 1),
    cell_dish_right_surface: cellDishFacets.filter((_, index) => index === cellDishFacets.length - 1),
    dish_contact_left_surface: dishContactFacets.filter((_, index) => index === 0),
    dish_contact_center_surface: dishContactFacets.filter((_, index) => index > 0 && index < dishContactFacets.length - 1),
    dish_contact_right_surface: dishContactFacets.filter((_, index) => index === dishContactFacets.length - 1),
    pipette_suction_surface: [suctionPatchFacet],
    pipette_suction_patch: [suctionPatchFacet],
    pipette_contact_surface: [pipetteMouthFacet],
    pipette_mouth_surface: [pipetteMouthFacet],
    pipette_mouth_patch: [pipetteMouthFacet],
  };

  const nodesForElements = (ids) => [...new Set(elements.filter((element) => ids.includes(element.id)).flatMap((element) => element.nodes))].sort((a, b) => a - b);
  const facetNodes = (facets) => [...new Set((facets || []).flatMap((entry) => entry.nodes || []))].sort((a, b) => a - b);
  const nodeSets = {
    nucleus: nodesForElements(elementSets.nucleus),
    cytoplasm: nodesForElements(elementSets.cytoplasm),
    dish_fixed_nodes: facetNodes(dishElements.map((element) => ({ nodes: bottomFace(element) }))),
    pipette_contact_nodes: facetNodes([pipetteMouthFacet]),
    pipette_suction_nodes: facetNodes([suctionPatchFacet]),
    pipette_suction_patch_nodes: facetNodes([suctionPatchFacet]),
    pipette_mouth_patch_nodes: facetNodes([pipetteMouthFacet]),
    nc_left_nucleus_nodes: facetNodes(surfaces.nucleus_interface_left_surface),
    nc_right_nucleus_nodes: facetNodes(surfaces.nucleus_interface_right_surface),
    nc_top_nucleus_nodes: facetNodes(surfaces.nucleus_interface_top_surface),
    nc_bottom_nucleus_nodes: facetNodes(surfaces.nucleus_interface_bottom_surface),
    nc_left_cytoplasm_nodes: facetNodes(surfaces.cytoplasm_interface_left_surface),
    nc_right_cytoplasm_nodes: facetNodes(surfaces.cytoplasm_interface_right_surface),
    nc_top_cytoplasm_nodes: facetNodes(surfaces.cytoplasm_interface_top_surface),
    nc_bottom_cytoplasm_nodes: facetNodes(surfaces.cytoplasm_interface_bottom_surface),
    cd_left_cell_nodes: facetNodes(surfaces.cell_dish_left_surface),
    cd_center_cell_nodes: facetNodes(surfaces.cell_dish_center_surface),
    cd_right_cell_nodes: facetNodes(surfaces.cell_dish_right_surface),
  };

  return {
    meshMode: "s10-top-pipette-reference",
    bounds: {
      cellLeft,
      cellRight,
      cellTop,
      nucleusLeft,
      nucleusRight,
      nucleusBottom,
      nucleusTop,
      dishBottom,
      pipetteLeft: patchLeft,
      pipetteRight: patchRight,
      pipetteContactX: nucleusCenterX,
      pipetteBottom,
      pipetteTop,
      pipetteContactZ: pipetteBottom,
    },
    refinements: {
      topPipetteReference: {
        mode: "image-guided-top-suction",
        axis: "z",
        pressureSurface: "pipette_suction_patch",
        patchXRange: [patchLeft, patchRight],
        patchZ: nucleusTop,
      },
      localSuctionPatch: {
        mode: "s10-top-pipette-reference",
        pressureSurface: "pipette_suction_patch",
        legacySurface: "pipette_suction_surface",
        centeredOnPipetteAxis: true,
        patchXRange: [patchLeft, patchRight],
        patchHeight: patchRight - patchLeft,
        declaredPressure: Number.isFinite(Number(spec.loads?.suctionPressure?.value)) ? Number(spec.loads.suctionPressure.value) : null,
        ncTopRefined: true,
      },
      pipetteSuctionSurface: {
        mode: "top-nucleus-patch",
        pressureSurface: "pipette_suction_patch",
        legacySurface: "pipette_suction_surface",
        studioCompatibleWinding: false,
      },
      pipetteMouthPatch: {
        mode: "s10-top-pipette-reference",
        mouthSurface: "pipette_mouth_surface",
        mouthPatchSurface: "pipette_mouth_patch",
        alignedWithSuctionPatch: true,
        patchXRange: [patchLeft, patchRight],
      },
      nucleusCytoplasmCoupling: {
        mode: "separated-contact-native-comparison",
        contactFreeForceTransfer: false,
        separatedContactComparison: true,
      },
      cellDishBands: {
        mode: "image-guided-five-band",
        splitX: xCuts,
        dishContactSurfaceSplit: true,
      },
    },
    nodes: nodes.sort((a, b) => a.id - b.id),
    elements: elements.sort((a, b) => a.id - b.id),
    surfaces,
    nodeSets,
    elementSets,
    surfacePairs: {
      nucleus_cytoplasm_pair: { name: "nucleus_cytoplasm_pair", primary: "cytoplasm_interface_surface", secondary: "nucleus_interface_surface" },
      nucleus_cytoplasm_left_pair: { name: "nucleus_cytoplasm_left_pair", primary: "cytoplasm_interface_left_surface", secondary: "nucleus_interface_left_surface" },
      nucleus_cytoplasm_right_pair: { name: "nucleus_cytoplasm_right_pair", primary: "cytoplasm_interface_right_surface", secondary: "nucleus_interface_right_surface" },
      nucleus_cytoplasm_top_pair: { name: "nucleus_cytoplasm_top_pair", primary: "cytoplasm_interface_top_surface", secondary: "nucleus_interface_top_surface" },
      nucleus_cytoplasm_bottom_pair: { name: "nucleus_cytoplasm_bottom_pair", primary: "cytoplasm_interface_bottom_surface", secondary: "nucleus_interface_bottom_surface" },
      cell_dish_pair: { name: "cell_dish_pair", primary: "cell_dish_surface", secondary: "dish_contact_surface" },
      pipette_nucleus_pair: { name: "pipette_nucleus_pair", primary: "nucleus_interface_right_surface", secondary: "pipette_contact_surface" },
      pipette_cell_pair: { name: "pipette_cell_pair", primary: "pipette_suction_surface", secondary: "pipette_contact_surface" },
    },
  };
}

function applyNativeSolverSurfaceConventions(mesh, spec = {}) {
  const pipetteCellPair =
    spec.contacts?.pipetteCell?.pairRole === "rigid-primary"
      ? { name: "pipette_cell_pair", primary: "pipette_contact_surface", secondary: "pipette_suction_surface" }
      : { name: "pipette_cell_pair", primary: "pipette_suction_surface", secondary: "pipette_contact_surface" };
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
      pipette_cell_pair: pipetteCellPair,
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

function refineNativeNucleusCytoplasmCoupling(mesh, spec = {}) {
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
  const useSeparatedNcContact = spec.contacts?.nucleusCytoplasm?.meshCouplingMode === "separated-contact";
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
  const ncCytoplasmNodes = useSeparatedNcContact
    ? [
        buildNode(73, nucleusLeft, yMin, nucleusBottom),
        buildNode(74, nucleusRight, yMin, nucleusBottom),
        buildNode(75, nucleusRight, yMax, nucleusBottom),
        buildNode(76, nucleusLeft, yMax, nucleusBottom),
        buildNode(77, nucleusLeft, yMin, nucleusTop),
        buildNode(78, nucleusRight, yMin, nucleusTop),
        buildNode(79, nucleusRight, yMax, nucleusTop),
        buildNode(80, nucleusLeft, yMax, nucleusTop),
      ]
    : [];
  const c = useSeparatedNcContact
    ? { n45: 73, n46: 74, n47: 75, n48: 76, n49: 77, n50: 78, n51: 79, n52: 80 }
    : { n45: 45, n46: 46, n47: 47, n48: 48, n49: 49, n50: 50, n51: 51, n52: 52 };
  const replacedIds = new Set([1, 2, 5]);
  const existingNodes = (mesh.nodes || []).filter((node) => node.id < 9 || node.id > 16);
  const elements = (mesh.elements || []).filter((element) => !replacedIds.has(element.id));
  const coupledElements = [
    buildHex(1, "cytoplasm", [1, 2, 3, 4, 65, c.n45, c.n48, 66]),
    buildHex(2, "nucleus", [45, 46, 47, 48, 49, 50, 51, 52]),
    buildHex(5, "cytoplasm", [33, 34, 35, 36, c.n46, 69, 70, c.n47]),
    buildHex(10, "cytoplasm", [65, c.n45, c.n48, 66, 67, c.n49, c.n52, 68]),
    buildHex(11, "cytoplasm", [67, c.n49, c.n52, 68, 5, 6, 7, 8]),
    buildHex(12, "cytoplasm", [c.n46, 69, 70, c.n47, c.n50, 71, 72, c.n51]),
    buildHex(13, "cytoplasm", [c.n50, 71, 72, c.n51, 37, 38, 39, 40]),
  ];

  const suctionSurface =
    spec.contacts?.pipetteCell?.suctionSurfaceMode === "cell-outer-right"
      ? [buildFacet(20, [69, 70, 72, 71])]
      : [buildFacet(20, [46, 50, 51, 47])];
  const coupledMesh = {
    ...mesh,
    refinements: {
      ...(mesh.refinements || {}),
      nucleusCytoplasmCoupling: {
        mode: useSeparatedNcContact ? "separated-contact-native-comparison" : "in-place-current-native-shared-nodes",
        contactFreeForceTransfer: !useSeparatedNcContact,
        separatedContactComparison: useSeparatedNcContact,
      },
      pipetteSuctionSurface: {
        mode: spec.contacts?.pipetteCell?.suctionSurfaceMode || "nucleus-right",
        studioCompatibleWinding: spec.contacts?.pipetteCell?.suctionSurfaceMode === "cell-outer-right",
      },
    },
    nodes: [...existingNodes, ...splitNodes, ...ncCytoplasmNodes].sort((a, b) => a.id - b.id),
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
        buildFacet(6, [c.n45, c.n48, c.n52, c.n49]),
        buildFacet(7, [c.n46, c.n50, c.n51, c.n47]),
        buildFacet(8, [c.n45, c.n46, c.n47, c.n48]),
        buildFacet(9, [c.n49, c.n52, c.n51, c.n50]),
      ],
      cytoplasm_interface_left_surface: [buildFacet(10, [c.n45, c.n48, c.n52, c.n49])],
      cytoplasm_interface_right_surface: [buildFacet(11, [c.n46, c.n47, c.n51, c.n50])],
      cytoplasm_interface_top_surface: [buildFacet(12, [c.n49, c.n52, c.n51, c.n50])],
      cytoplasm_interface_bottom_surface: [buildFacet(13, [c.n45, c.n46, c.n47, c.n48])],
      pipette_suction_surface: suctionSurface,
    },
    nodeSets: {
      ...mesh.nodeSets,
      nc_left_nucleus_nodes: [45, 48, 49, 52],
      nc_right_nucleus_nodes: [46, 47, 50, 51],
      nc_top_nucleus_nodes: [49, 50, 51, 52],
      nc_bottom_nucleus_nodes: [45, 46, 47, 48],
      nc_left_cytoplasm_nodes: [c.n45, c.n48, c.n49, c.n52],
      nc_right_cytoplasm_nodes: [c.n46, c.n47, c.n50, c.n51],
      nc_top_cytoplasm_nodes: [c.n49, c.n50, c.n51, c.n52],
      nc_bottom_cytoplasm_nodes: [c.n45, c.n46, c.n47, c.n48],
      pipette_suction_nodes: [...new Set(suctionSurface.flatMap((facet) => facet.nodes || []))].sort((a, b) => a - b),
    },
    elementSets: {
      ...mesh.elementSets,
      cytoplasm: [1, 5, 6, 7, 10, 11, 12, 13],
      nucleus: [2],
    },
  };
  return applyLocalSuctionPatchRefinement(coupledMesh, spec);
}

function applyLocalSuctionPatchRefinement(mesh, spec = {}) {
  if (!["s10-local-suction-patch", "s10-gmsh-baseline", "s10-pipette-nc-refined"].includes(spec.geometry?.meshMode)) return mesh;
  if (spec.contacts?.pipetteCell?.suctionSurfaceMode === "cell-outer-right") return mesh;

  const nucleusLeft = mesh.bounds?.nucleusLeft;
  const nucleusRight = mesh.bounds?.nucleusRight;
  const nucleusBottom = mesh.bounds?.nucleusBottom;
  const nucleusTop = mesh.bounds?.nucleusTop;
  const right = mesh.bounds?.cellRight;
  const pipetteZ = spec.geometry?.pipette?.tip?.z ?? mesh.bounds?.pipetteBottom;
  if (![nucleusLeft, nucleusRight, nucleusBottom, nucleusTop, right, pipetteZ].every(Number.isFinite)) return mesh;

  const yMin = -0.5;
  const yMax = 0.5;
  const nucleusHeight = nucleusTop - nucleusBottom;
  const patchHeight = Math.min(Math.max((spec.geometry?.pipette?.radius || 0) * 1.0, nucleusHeight * 0.25), nucleusHeight * 0.5);
  const patchBottom = Math.max(nucleusBottom, Math.min(pipetteZ - patchHeight / 2, nucleusTop - patchHeight));
  const patchTop = Math.min(nucleusTop, patchBottom + patchHeight);
  const patchNodes = [
    buildNode(81, nucleusLeft, yMin, patchBottom),
    buildNode(82, nucleusRight, yMin, patchBottom),
    buildNode(83, nucleusRight, yMax, patchBottom),
    buildNode(84, nucleusLeft, yMax, patchBottom),
    buildNode(85, nucleusLeft, yMin, patchTop),
    buildNode(86, nucleusRight, yMin, patchTop),
    buildNode(87, nucleusRight, yMax, patchTop),
    buildNode(88, nucleusLeft, yMax, patchTop),
  ];
  const nucleusElements = [
    buildHex(2, "nucleus", [45, 46, 47, 48, 81, 82, 83, 84]),
    buildHex(14, "nucleus", [81, 82, 83, 84, 85, 86, 87, 88]),
    buildHex(15, "nucleus", [85, 86, 87, 88, 49, 50, 51, 52]),
  ];
  const leftBottomFacet = buildFacet(28, [45, 81, 84, 48]);
  const leftPatchBandFacet = buildFacet(29, [81, 85, 88, 84]);
  const leftTopFacet = buildFacet(30, [85, 49, 52, 88]);
  const rightBottomFacet = buildFacet(20, [46, 82, 83, 47]);
  const suctionPatchFacet = buildFacet(24, [82, 86, 87, 83]);
  const rightTopFacet = buildFacet(25, [86, 50, 51, 87]);
  const useSeparatedNcContact = mesh.refinements?.nucleusCytoplasmCoupling?.separatedContactComparison === true;
  const c = useSeparatedNcContact
    ? { n46: 74, n47: 75, n50: 78, n51: 79 }
    : { n46: 46, n47: 47, n50: 50, n51: 51 };
  const cytoplasmPatchNodes = useSeparatedNcContact
    ? [
        buildNode(89, nucleusRight, yMin, patchBottom),
        buildNode(90, nucleusRight, yMax, patchBottom),
        buildNode(91, nucleusRight, yMin, patchTop),
        buildNode(92, nucleusRight, yMax, patchTop),
        buildNode(93, right, yMin, patchBottom),
        buildNode(94, right, yMax, patchBottom),
        buildNode(95, right, yMin, patchTop),
        buildNode(96, right, yMax, patchTop),
      ]
    : [];
  const cytoplasmRightElements = useSeparatedNcContact
    ? [
        buildHex(12, "cytoplasm", [c.n46, 69, 70, c.n47, 89, 93, 94, 90]),
        buildHex(16, "cytoplasm", [89, 93, 94, 90, 91, 95, 96, 92]),
        buildHex(17, "cytoplasm", [91, 95, 96, 92, c.n50, 71, 72, c.n51]),
      ]
    : [];
  const cytoplasmRightFacets = useSeparatedNcContact
    ? [
        buildFacet(11, [c.n46, c.n47, 90, 89]),
        buildFacet(26, [89, 90, 92, 91]),
        buildFacet(27, [91, 92, c.n51, c.n50]),
      ]
    : null;
  const replacedElementIds = useSeparatedNcContact ? [2, 12, 14, 15, 16, 17] : [2, 14, 15];
  const newNodeIds = new Set([...patchNodes, ...cytoplasmPatchNodes].map((node) => node.id));
  const existingNodes = (mesh.nodes || []).filter((node) => !newNodeIds.has(node.id));
  const elements = (mesh.elements || []).filter((element) => !replacedElementIds.includes(element.id));
  const pressureValue = Number(spec.loads?.suctionPressure?.value);

  const refinedMesh = {
    ...mesh,
    refinements: {
      ...(mesh.refinements || {}),
      localSuctionPatch: {
        mode: "s10-local-suction-patch",
        pressureSurface: "pipette_suction_patch",
        legacySurface: "pipette_suction_surface",
        centeredOnPipetteAxis: true,
        patchZRange: [patchBottom, patchTop],
        patchHeight,
        declaredPressure: Number.isFinite(pressureValue) ? pressureValue : null,
        ncRightRefined: useSeparatedNcContact,
      },
      pipetteSuctionSurface: {
        ...(mesh.refinements?.pipetteSuctionSurface || {}),
        mode: "local-nucleus-side-patch",
        pressureSurface: "pipette_suction_patch",
        legacySurface: "pipette_suction_surface",
        studioCompatibleWinding: false,
      },
    },
    nodes: [...existingNodes, ...patchNodes, ...cytoplasmPatchNodes].sort((a, b) => a.id - b.id),
    elements: [...elements, ...nucleusElements, ...cytoplasmRightElements].sort((a, b) => a.id - b.id),
    surfaces: {
      ...mesh.surfaces,
      nucleus_interface_left_surface: [leftBottomFacet, leftPatchBandFacet, leftTopFacet],
      nucleus_interface_right_surface: [rightBottomFacet, suctionPatchFacet, rightTopFacet],
      ...(cytoplasmRightFacets ? { cytoplasm_interface_right_surface: cytoplasmRightFacets } : {}),
      pipette_suction_surface: [rightBottomFacet, suctionPatchFacet, rightTopFacet],
      pipette_suction_patch: [suctionPatchFacet],
    },
    nodeSets: {
      ...mesh.nodeSets,
      nucleus: [45, 46, 47, 48, 49, 50, 51, 52, 81, 82, 83, 84, 85, 86, 87, 88],
      nc_left_nucleus_nodes: [45, 48, 49, 52, 81, 84, 85, 88],
      nc_right_nucleus_nodes: [46, 47, 50, 51, 82, 83, 86, 87],
      ...(useSeparatedNcContact ? { nc_right_cytoplasm_nodes: [74, 75, 78, 79, 89, 90, 91, 92] } : {}),
      pipette_suction_nodes: [82, 83, 86, 87],
      pipette_suction_patch_nodes: [82, 83, 86, 87],
    },
    elementSets: {
      ...mesh.elementSets,
      nucleus: [2, 14, 15],
      ...(useSeparatedNcContact ? { cytoplasm: [1, 5, 6, 7, 10, 11, 12, 13, 16, 17] } : {}),
    },
  };
  return applyPipetteMouthPatchRefinement(refinedMesh, spec);
}

function applyPipetteMouthPatchRefinement(mesh, spec = {}) {
  if (spec.geometry?.meshMode !== "s10-pipette-nc-refined") return mesh;
  const patchRange = mesh.refinements?.localSuctionPatch?.patchZRange || [];
  const patchBottom = Number(patchRange[0]);
  const patchTop = Number(patchRange[1]);
  const leftBottom = nodeById(mesh, 17);
  const rightBottom = nodeById(mesh, 18);
  const rightTop = nodeById(mesh, 23);
  const leftTop = nodeById(mesh, 24);
  if (![patchBottom, patchTop, leftBottom?.x, rightBottom?.x, leftBottom?.y, leftTop?.y].every(Number.isFinite)) return mesh;

  const xLeft = leftBottom.x;
  const xRight = rightBottom.x;
  const yMin = leftBottom.y;
  const yMax = leftTop.y;
  const zBottom = leftBottom.z;
  const zTop = rightTop.z;
  const pipetteNodes = [
    buildNode(97, xLeft, yMin, patchBottom),
    buildNode(98, xRight, yMin, patchBottom),
    buildNode(99, xRight, yMax, patchBottom),
    buildNode(100, xLeft, yMax, patchBottom),
    buildNode(101, xLeft, yMin, patchTop),
    buildNode(102, xRight, yMin, patchTop),
    buildNode(103, xRight, yMax, patchTop),
    buildNode(104, xLeft, yMax, patchTop),
  ];
  const pipetteElements = [
    buildHex(3, "pipette", [17, 18, 19, 20, 97, 98, 99, 100]),
    buildHex(18, "pipette", [97, 98, 99, 100, 101, 102, 103, 104]),
    buildHex(19, "pipette", [101, 102, 103, 104, 21, 22, 23, 24]),
  ];
  const mouthBottomFacet = buildFacet(31, [17, 97, 100, 20]);
  const mouthPatchFacet = buildFacet(32, [97, 101, 104, 100]);
  const mouthTopFacet = buildFacet(33, [101, 21, 24, 104]);
  const existingNodes = (mesh.nodes || []).filter((node) => !pipetteNodes.some((newNode) => newNode.id === node.id));
  const elements = (mesh.elements || []).filter((element) => ![3, 18, 19].includes(element.id));

  return {
    ...mesh,
    refinements: {
      ...(mesh.refinements || {}),
      pipetteMouthPatch: {
        mode: "s10-pipette-nc-refined",
        mouthSurface: "pipette_mouth_surface",
        mouthPatchSurface: "pipette_mouth_patch",
        legacySurface: "pipette_contact_surface",
        alignedWithSuctionPatch: true,
        patchZRange: [patchBottom, patchTop],
        fullZRange: [zBottom, zTop],
      },
    },
    nodes: [...existingNodes, ...pipetteNodes].sort((a, b) => a.id - b.id),
    elements: [...elements, ...pipetteElements].sort((a, b) => a.id - b.id),
    surfaces: {
      ...mesh.surfaces,
      pipette_contact_surface: [mouthBottomFacet, mouthPatchFacet, mouthTopFacet],
      pipette_mouth_surface: [mouthBottomFacet, mouthPatchFacet, mouthTopFacet],
      pipette_mouth_patch: [mouthPatchFacet],
    },
    nodeSets: {
      ...mesh.nodeSets,
      pipette_contact_nodes: [17, 20, 21, 24, 97, 100, 101, 104],
      pipette_mouth_patch_nodes: [97, 100, 101, 104],
    },
    elementSets: {
      ...mesh.elementSets,
      pipette: [3, 18, 19],
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
    localSuctionPatch: "pipette_suction_patch",
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
  pipette_suction_patch: "-x",
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
  { name: "pipette_cell", pair: "pipette_cell_pair", expected: "same" },
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

function scale(vector, factor) {
  return vector.map((value) => value * factor);
}

function magnitude(vector) {
  return Math.hypot(vector?.[0] || 0, vector?.[1] || 0, vector?.[2] || 0);
}

function nodePointMap(mesh = {}) {
  return new Map((mesh.nodes || []).map((node) => [node.id, [node.x, node.y, node.z]]));
}

function facetNormal(facet, points) {
  const nodes = (facet?.nodes || []).map((id) => points.get(id)).filter(Boolean);
  if (nodes.length < 3) return [0, 0, 0];
  return normalize(cross(subtract(nodes[1], nodes[0]), subtract(nodes[2], nodes[0])));
}

function facetCentroid(facet, points) {
  const nodes = (facet?.nodes || []).map((id) => points.get(id)).filter(Boolean);
  if (!nodes.length) return [0, 0, 0];
  const total = nodes.reduce((acc, node) => add(acc, node), [0, 0, 0]);
  return scale(total, 1 / nodes.length);
}

function facetArea(facet, points) {
  const nodes = (facet?.nodes || []).map((id) => points.get(id)).filter(Boolean);
  if (nodes.length < 3) return 0;
  const firstTriangle = magnitude(cross(subtract(nodes[1], nodes[0]), subtract(nodes[2], nodes[0]))) / 2;
  const secondTriangle = nodes.length > 3
    ? magnitude(cross(subtract(nodes[2], nodes[0]), subtract(nodes[3], nodes[0]))) / 2
    : 0;
  return firstTriangle + secondTriangle;
}

function surfaceArea(mesh, surfaceName) {
  const points = nodePointMap(mesh);
  return (mesh.surfaces?.[surfaceName] || []).reduce((total, facet) => total + facetArea(facet, points), 0);
}

function surfaceNormal(mesh, surfaceName) {
  const points = nodePointMap(mesh);
  const facets = mesh.surfaces?.[surfaceName] || [];
  if (!facets.length) return null;
  const total = facets.reduce((acc, facet) => add(acc, facetNormal(facet, points)), [0, 0, 0]);
  return normalize(total);
}

function surfaceCentroid(mesh, surfaceName) {
  const points = nodePointMap(mesh);
  const facets = mesh.surfaces?.[surfaceName] || [];
  if (!facets.length) return null;
  const total = facets.reduce((acc, facet) => add(acc, facetCentroid(facet, points)), [0, 0, 0]);
  return scale(total, 1 / facets.length);
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

function expectedSurfaceNormal(mesh, surfaceName) {
  if (surfaceName === "pipette_suction_surface" && mesh.refinements?.pipetteSuctionSurface?.mode === "cell-outer-right") {
    return "+x";
  }
  if (
    ["pipette_suction_surface", "pipette_suction_patch", "pipette_contact_surface"].includes(surfaceName) &&
    mesh.refinements?.topPipetteReference?.axis === "z"
  ) {
    return "-z";
  }
  return EXPECTED_SURFACE_NORMALS[surfaceName];
}

function buildSurfaceNormalDiagnostics(mesh) {
  const surfaceNames = Object.keys(EXPECTED_SURFACE_NORMALS)
    .filter((surfaceName) => surfaceName !== "pipette_suction_patch" || mesh.surfaces?.pipette_suction_patch?.length);
  const entries = Object.fromEntries(
    surfaceNames.map((surfaceName) => {
      const normal = surfaceNormal(mesh, surfaceName);
      const actual = axisLabel(normal);
      const expected = expectedSurfaceNormal(mesh, surfaceName);
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
      const pair = check.pair ? mesh.surfacePairs?.[check.pair] : null;
      const primaryName = pair?.primary || check.primary;
      const secondaryName = pair?.secondary || check.secondary;
      const primaryNormal = surfaceNormal(mesh, primaryName);
      const secondaryNormal = surfaceNormal(mesh, secondaryName);
      const primaryCentroid = surfaceCentroid(mesh, primaryName);
      const secondaryCentroid = surfaceCentroid(mesh, secondaryName);
      const normalDot = primaryNormal && secondaryNormal ? dot(primaryNormal, secondaryNormal) : null;
      const opposed = normalDot != null && normalDot < -0.75;
      const same = normalDot != null && normalDot > 0.75;
      const centroidDelta = primaryCentroid && secondaryCentroid ? subtract(secondaryCentroid, primaryCentroid) : null;
      const signedNormalGap = centroidDelta && primaryNormal ? dot(centroidDelta, primaryNormal) : null;
      const normalOffset = signedNormalGap == null || !primaryNormal ? null : scale(primaryNormal, signedNormalGap);
      const tangentialOffset = centroidDelta && normalOffset ? subtract(centroidDelta, normalOffset) : null;
      return [
        check.name,
        {
          primary: primaryName,
          secondary: secondaryName,
          activePrimary: primaryName,
          activeSecondary: secondaryName,
          pair: check.pair || null,
          primaryNormal: axisLabel(primaryNormal),
          secondaryNormal: axisLabel(secondaryNormal),
          dot: normalDot,
          primaryCentroid,
          secondaryCentroid,
          centroidDelta,
          signedNormalGap,
          normalGapMagnitude: signedNormalGap == null ? null : Math.abs(signedNormalGap),
          tangentialOffset,
          tangentialOffsetMagnitude: tangentialOffset ? magnitude(tangentialOffset) : null,
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
  const activeSuctionSurface = mesh.refinements?.pipetteSuctionSurface?.pressureSurface || COORDINATE_CONVENTION.pressure.suctionSurface;
  const suction = surfaceNormal(mesh, activeSuctionSurface);
  const suctionNormal = axisLabel(suction);
  const suctionSurfaceMode = mesh.refinements?.pipetteSuctionSurface?.mode || "nucleus-right";
  const expectedSuctionNormal = suctionSurfaceMode === "cell-outer-right"
    ? "+x"
    : mesh.refinements?.topPipetteReference?.axis === "z"
      ? "-z"
    : COORDINATE_CONVENTION.pressure.currentSuctionNormal;
  const suctionCentroid = surfaceCentroid(mesh, activeSuctionSurface);
  const mouthCentroid = surfaceCentroid(mesh, COORDINATE_CONVENTION.pressure.rigidMouthSurface);
  const centroidDelta = suctionCentroid && mouthCentroid ? subtract(mouthCentroid, suctionCentroid) : null;
  const signedNormalGap = centroidDelta && suction ? dot(centroidDelta, suction) : null;
  const normalOffset = signedNormalGap == null || !suction ? null : scale(suction, signedNormalGap);
  const tangentialOffset = centroidDelta && normalOffset ? subtract(centroidDelta, normalOffset) : null;
  const tangentialOffsetMagnitude = tangentialOffset ? magnitude(tangentialOffset) : null;
  const maxTangentialOffsetForReady = 0.1;
  const couplingReady =
    suctionNormal === expectedSuctionNormal &&
    tangentialOffsetMagnitude != null &&
    tangentialOffsetMagnitude <= maxTangentialOffsetForReady;
  const localPatchSurface = mesh.refinements?.localSuctionPatch?.pressureSurface || null;
  const localPatchFacets = localPatchSurface ? mesh.surfaces?.[localPatchSurface] || [] : [];
  const localPatchNodeIds = [...new Set(localPatchFacets.flatMap((facet) => facet.nodes || []))].sort((a, b) => a - b);
  const localPatchArea = localPatchSurface ? surfaceArea(mesh, localPatchSurface) : null;
  const declaredPressure = Number(mesh.refinements?.localSuctionPatch?.declaredPressure);
  const localPatch = localPatchSurface ? {
    surface: localPatchSurface,
    legacySurface: mesh.refinements?.localSuctionPatch?.legacySurface || COORDINATE_CONVENTION.pressure.suctionSurface,
    area: localPatchArea,
    centroid: surfaceCentroid(mesh, localPatchSurface),
    normal: surfaceNormal(mesh, localPatchSurface),
    normalAxis: axisLabel(surfaceNormal(mesh, localPatchSurface)),
    nodeCount: localPatchNodeIds.length,
    faceCount: localPatchFacets.length,
    nodeIds: localPatchNodeIds,
    faceIds: localPatchFacets.map((facet) => facet.id).sort((a, b) => a - b),
    pressure: Number.isFinite(declaredPressure) ? declaredPressure : null,
    pressureResultant: Number.isFinite(declaredPressure) && Number.isFinite(localPatchArea)
      ? Math.abs(declaredPressure) * localPatchArea
      : null,
    relationToPipetteMouth: "centered on pipette axis and evaluated against pipette_contact_surface centroid",
  } : null;
  return {
    suctionSurface: activeSuctionSurface,
    legacySuctionSurface: COORDINATE_CONVENTION.pressure.suctionSurface,
    localSuctionPatch: localPatch,
    surfaceOwnership: COORDINATE_CONVENTION.pressure.surfaceOwnership,
    rigidMouthSurface: COORDINATE_CONVENTION.pressure.rigidMouthSurface,
    suctionSurfaceMode,
    suctionNormal,
    expectedSuctionNormal,
    negativePressureEffect: mesh.refinements?.topPipetteReference?.axis === "z"
      ? "negative pressure on the top suction patch is intended to pull toward +z, into the pipette above the cell"
      : suctionSurfaceMode === "cell-outer-right"
      ? "diagnostic outer-cell comparison uses FEBioStudio-compatible +x facet winding; pressure sign is not the final S7-E suction convention"
      : COORDINATE_CONVENTION.pressure.negativePressureEffect,
    couplingReadiness: {
      ready: couplingReady,
      suctionCentroid,
      rigidMouthCentroid: mouthCentroid,
      centroidDelta,
      signedNormalGap,
      normalGapMagnitude: signedNormalGap == null ? null : Math.abs(signedNormalGap),
      tangentialOffset,
      tangentialOffsetMagnitude,
      maxTangentialOffsetForReady,
      interpretation: couplingReady
        ? "active pipette suction pressure surface is normal-aligned and tangentially colocated with the rigid mouth surface"
        : "active pipette suction pressure surface is not tangentially colocated with the rigid mouth surface; pressure can be declared while contact/reaction channels remain inactive"
    },
    valid: suctionNormal === expectedSuctionNormal,
    warnings:
      suctionNormal === expectedSuctionNormal
        ? []
        : [`${activeSuctionSurface} normal is ${suctionNormal}; expected ${expectedSuctionNormal}`],
  };
}

function surfaceNodeSignature(facets = []) {
  return facets
    .map((facet) => [...(facet.nodes || [])].sort((a, b) => a - b).join(","))
    .sort()
    .join("|");
}

function buildSurfaceOverlapDiagnostics(mesh) {
  const surfaceEntries = Object.entries(mesh.surfaces || {});
  const signatures = new Map();
  surfaceEntries.forEach(([name, facets]) => {
    const signature = surfaceNodeSignature(facets);
    if (!signature) return;
    const names = signatures.get(signature) || [];
    names.push(name);
    signatures.set(signature, names);
  });
  const duplicateNodeSets = [...signatures.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([nodeSignature, names]) => ({ nodeSignature, surfaces: names }));
  const pipetteSuctionOverlaps = duplicateNodeSets
    .filter((entry) => entry.surfaces.includes("pipette_suction_surface"))
    .flatMap((entry) => entry.surfaces.filter((name) => name !== "pipette_suction_surface"));
  return {
    duplicateNodeSets,
    pipetteSuctionOverlaps,
    pipetteSuctionSeparatedFromNucleusRight: !pipetteSuctionOverlaps.includes("nucleus_interface_right_surface"),
  };
}

function coordinateKeyForNode(node) {
  return node ? [node.x, node.y, node.z].map((value) => Number(value).toPrecision(15)).join(",") : "";
}

function buildDuplicateCoordinateDiagnostics(mesh) {
  const byCoordinate = new Map();
  (mesh.nodes || []).forEach((node) => {
    const key = coordinateKeyForNode(node);
    const entries = byCoordinate.get(key) || [];
    entries.push(node.id);
    byCoordinate.set(key, entries);
  });
  const groups = [...byCoordinate.entries()]
    .filter(([, nodeIds]) => nodeIds.length > 1)
    .map(([coordinate, nodeIds]) => ({ coordinate, nodeIds: [...nodeIds].sort((a, b) => a - b) }));
  return {
    groupCount: groups.length,
    nodeCount: groups.reduce((total, group) => total + group.nodeIds.length, 0),
    groups,
    nativeIdRecovery: mesh.gmsh?.nativeIdRecovery || "",
    note: groups.length
      ? "duplicate-coordinate native nodes are intentional at material/contact boundaries; Gmsh imports may renumber them, so template native-id recovery is required for baseline comparisons"
      : "no duplicate-coordinate native nodes detected",
  };
}

function countByKey(items = [], key) {
  return items.reduce((counts, item) => {
    const value = item?.[key] || "unknown";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function pairNodesByCoordinate(mesh, nucleusSetName, cytoplasmSetName) {
  const nodesById = new Map((mesh.nodes || []).map((node) => [node.id, node]));
  const cytoplasmByCoordinate = new Map();
  (mesh.nodeSets?.[cytoplasmSetName] || []).forEach((nodeId) => {
    const node = nodesById.get(nodeId);
    if (!node) return;
    const entries = cytoplasmByCoordinate.get(coordinateKeyForNode(node)) || [];
    entries.push(nodeId);
    cytoplasmByCoordinate.set(coordinateKeyForNode(node), entries);
  });
  return (mesh.nodeSets?.[nucleusSetName] || []).flatMap((nucleusNodeId) => {
    const nucleusNode = nodesById.get(nucleusNodeId);
    const candidates = nucleusNode ? cytoplasmByCoordinate.get(coordinateKeyForNode(nucleusNode)) || [] : [];
    return candidates.map((cytoplasmNodeId) => ({ nucleusNodeId, cytoplasmNodeId }));
  });
}

function buildNcRegionMeshDiagnostics(mesh) {
  const regions = ["left", "right", "top", "bottom"];
  const byRegion = Object.fromEntries(regions.map((region) => {
    const nucleusSurface = `nucleus_interface_${region}_surface`;
    const cytoplasmSurface = `cytoplasm_interface_${region}_surface`;
    const nucleusNodeSet = `nc_${region}_nucleus_nodes`;
    const cytoplasmNodeSet = `nc_${region}_cytoplasm_nodes`;
    const nodePairs = pairNodesByCoordinate(mesh, nucleusNodeSet, cytoplasmNodeSet);
    return [region, {
      nucleusSurface,
      cytoplasmSurface,
      nucleusFaceCount: (mesh.surfaces?.[nucleusSurface] || []).length,
      cytoplasmFaceCount: (mesh.surfaces?.[cytoplasmSurface] || []).length,
      nucleusNodeCount: (mesh.nodeSets?.[nucleusNodeSet] || []).length,
      cytoplasmNodeCount: (mesh.nodeSets?.[cytoplasmNodeSet] || []).length,
      nodePairMappingCount: nodePairs.length,
      nodePairs,
      solverActiveFaceReady: (mesh.surfaces?.[nucleusSurface] || []).length > 0 && (mesh.surfaces?.[cytoplasmSurface] || []).length > 0,
    }];
  }));
  return {
    byRegion,
    totalNodePairMappingCount: Object.values(byRegion).reduce((total, region) => total + region.nodePairMappingCount, 0),
    solverActiveRegions: regions.filter((region) => byRegion[region].solverActiveFaceReady),
  };
}

function buildMeshLevelDiagnostics(mesh) {
  const faceCountsBySurface = Object.fromEntries(
    Object.entries(mesh.surfaces || {}).map(([name, facets]) => [name, (facets || []).length]),
  );
  return {
    meshMode: mesh.meshMode || "",
    elementCount: (mesh.elements || []).length,
    nodeCount: (mesh.nodes || []).length,
    faceCount: Object.values(faceCountsBySurface).reduce((total, count) => total + count, 0),
    elementCountByMaterial: countByKey(mesh.elements || [], "material"),
    faceCountBySurface: faceCountsBySurface,
    ncRegionDiagnostics: buildNcRegionMeshDiagnostics(mesh),
    duplicateCoordinateDiagnostics: buildDuplicateCoordinateDiagnostics(mesh),
    gmsh: mesh.gmsh || null,
  };
}

export function validateNativeMesh(mesh) {
  const base = validateFebioMesh(mesh);
  const surfaceNormals = buildSurfaceNormalDiagnostics(mesh);
  const contactPairs = buildContactPairDiagnostics(mesh);
  const pressure = buildPressureDiagnostics(mesh);
  const surfaceOverlaps = buildSurfaceOverlapDiagnostics(mesh);
  const meshLevel = buildMeshLevelDiagnostics(mesh);
  return {
    ...base,
    coordinateConvention: COORDINATE_CONVENTION,
    surfaceNormalDiagnostics: surfaceNormals,
    contactPairDiagnostics: contactPairs,
    pressureDiagnostics: pressure,
    surfaceOverlapDiagnostics: surfaceOverlaps,
    meshLevelDiagnostics: meshLevel,
    conventionWarnings: [
      ...surfaceNormals.warnings,
      ...contactPairs.warnings,
      ...pressure.warnings,
    ],
  };
}
