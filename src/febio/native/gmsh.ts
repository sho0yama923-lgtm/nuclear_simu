const GMSH_ELEMENT_TYPES = {
  quad4: 3,
  hex8: 5,
};

const NATIVE_ELEMENT_TYPES = new Map([
  [3, { type: "quad4", nodeCount: 4, dimension: 2 }],
  [5, { type: "hex8", nodeCount: 8, dimension: 3 }],
]);

const DEFAULT_PHYSICAL_GROUP_REGISTRY = {
  3: {
    cytoplasm: 1,
    nucleus: 2,
    pipette: 3,
    dish: 4,
  },
  2: {
    cell_dish_surface: 101,
    cell_dish_left_surface: 102,
    cell_dish_center_surface: 103,
    cell_dish_right_surface: 104,
    dish_contact_surface: 105,
    dish_contact_left_surface: 106,
    dish_contact_center_surface: 107,
    dish_contact_right_surface: 108,
    nucleus_interface_surface: 109,
    nucleus_interface_left_surface: 110,
    nucleus_interface_right_surface: 111,
    nucleus_interface_top_surface: 112,
    nucleus_interface_bottom_surface: 113,
    cytoplasm_interface_surface: 114,
    cytoplasm_interface_left_surface: 115,
    cytoplasm_interface_right_surface: 116,
    cytoplasm_interface_top_surface: 117,
    cytoplasm_interface_bottom_surface: 118,
    pipette_suction_surface: 119,
    pipette_suction_patch: 120,
    pipette_contact_surface: 121,
    pipette_mouth_surface: 122,
    pipette_mouth_patch: 123,
  },
};

const GMSH_PYTHON_API_EDIT_GUIDE = [
  "Edit guide:",
  "- geometry.gmshPythonApi.coordinateAliases controls readable coordinate handles in generated .geo/.py output.",
  "  Example: pipetteZBottom -> Z_10p5 means points using pipetteZBottom move when that alias target changes.",
  "- geometry.gmshPythonApi.transfiniteCurveDivisions controls block edge subdivision count in generated Python API output.",
  "  Increase it to refine every transfinite curve uniformly; keep it at 2 to preserve one hex per block edge.",
  "- DEFAULT_PHYSICAL_GROUP_REGISTRY controls stable Gmsh Physical Group IDs for FEBio-facing names.",
  "  Change IDs only as a deliberate compatibility migration because .msh parsing depends on these names.",
  "- buildProjectGmshBlockLayout is the readable geometry map: cytoplasm/nucleus/pipette/dish boxes and partitions.",
  "  It documents the intended editing model; low-level tag emission below still preserves native round-trip IDs.",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function quoteGmshName(name) {
  return String(name || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseNumber(value, context) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`invalid numeric value for ${context}: ${value}`);
  return parsed;
}

function parseInteger(value, context) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) throw new Error(`invalid integer value for ${context}: ${value}`);
  return parsed;
}

function collectPhysicalGroups(mesh, registry = DEFAULT_PHYSICAL_GROUP_REGISTRY) {
  const namesByDimension = {
    3: new Set(Object.keys(mesh.elementSets || {})),
    2: new Set(Object.keys(mesh.surfaces || {})),
  };
  return [3, 2].flatMap((dimension) => {
    const names = namesByDimension[dimension];
    const fixedGroups = Object.entries(registry[dimension] || {})
      .filter(([name]) => names.has(name))
      .map(([name, id]) => ({ dimension, name, id }));
    const nextFallbackId = Math.max(0, ...fixedGroups.map((group) => group.id), ...Object.values(registry[dimension] || {})) + 1;
    const fallbackGroups = [...names]
      .filter((name) => registry[dimension]?.[name] == null)
      .sort((a, b) => a.localeCompare(b))
      .map((name, index) => ({ dimension, name, id: nextFallbackId + index }));
    return [...fixedGroups, ...fallbackGroups];
  });
}

function pythonString(value) {
  return JSON.stringify(String(value || ""));
}

function formatGmshNumber(value) {
  return Number(value).toPrecision(15).replace(/\.?0+$/, "");
}

function coordinateVariableName(axis, value) {
  const normalized = formatGmshNumber(value)
    .replace(/^-/, "n")
    .replace(/\./g, "p");
  return `${axis}_${normalized}`;
}

function coordinateVariableKey(axis, value) {
  return `${axis}:${formatGmshNumber(value)}`;
}

function coordinateKey(node) {
  return [node.x, node.y, node.z].map((value) => Number(value).toPrecision(15)).join(",");
}

class Box {
  constructor(id, material, center, size) {
    this.id = id;
    this.material = material;
    this.center = { ...center };
    this.size = { ...size };
  }

  get left() { return this.center.x - this.size.width / 2; }
  get right() { return this.center.x + this.size.width / 2; }
  get front() { return this.center.y - this.size.depth / 2; }
  get back() { return this.center.y + this.size.depth / 2; }
  get bottom() { return this.center.z - this.size.height / 2; }
  get top() { return this.center.z + this.size.height / 2; }

  containsPoint(point) {
    return (
      point.x > this.left &&
      point.x < this.right &&
      point.y > this.front &&
      point.y < this.back &&
      point.z > this.bottom &&
      point.z < this.top
    );
  }
}

function blockFromBox(box, options = {}) {
  return {
    id: options.id || box.id,
    material: options.material || box.material,
    box,
  };
}

function axisMin(box, axis) {
  if (axis === "x") return box.left;
  if (axis === "y") return box.front;
  if (axis === "z") return box.bottom;
  throw new Error(`unsupported box axis ${axis}`);
}

function axisMax(box, axis) {
  if (axis === "x") return box.right;
  if (axis === "y") return box.back;
  if (axis === "z") return box.top;
  throw new Error(`unsupported box axis ${axis}`);
}

function centerFromBounds(bounds) {
  return {
    x: (bounds.x[0] + bounds.x[1]) / 2,
    y: (bounds.y[0] + bounds.y[1]) / 2,
    z: (bounds.z[0] + bounds.z[1]) / 2,
  };
}

function sizeFromBounds(bounds) {
  return {
    width: bounds.x[1] - bounds.x[0],
    depth: bounds.y[1] - bounds.y[0],
    height: bounds.z[1] - bounds.z[0],
  };
}

function partition({ id, material, box, splitAt = {}, exclude = [] }) {
  const axes = ["x", "y", "z"];
  const axisCuts = Object.fromEntries(axes.map((axis) => {
    const labeledCuts = (splitAt[axis] || [])
      .map(([label, value]) => ({ label, value: Number(typeof value === "function" ? value() : value) }))
      .filter((cut) => Number.isFinite(cut.value) && cut.value > axisMin(box, axis) && cut.value < axisMax(box, axis))
      .sort((a, b) => a.value - b.value);
    return [axis, [
      { label: `${axis}_min`, value: axisMin(box, axis) },
      ...labeledCuts,
      { label: `${axis}_max`, value: axisMax(box, axis) },
    ]];
  }));

  const blocks = [];
  for (let ix = 0; ix < axisCuts.x.length - 1; ix += 1) {
    for (let iy = 0; iy < axisCuts.y.length - 1; iy += 1) {
      for (let iz = 0; iz < axisCuts.z.length - 1; iz += 1) {
        const bounds = {
          x: [axisCuts.x[ix].value, axisCuts.x[ix + 1].value],
          y: [axisCuts.y[iy].value, axisCuts.y[iy + 1].value],
          z: [axisCuts.z[iz].value, axisCuts.z[iz + 1].value],
        };
        const center = centerFromBounds(bounds);
        if (exclude.some((excludedBox) => excludedBox.containsPoint(center))) continue;
        blocks.push(blockFromBox(
          new Box(
            [id, axisCuts.x[ix + 1].label, axisCuts.y[iy + 1].label, axisCuts.z[iz + 1].label].join("_"),
            material,
            center,
            sizeFromBounds(bounds),
          ),
        ));
      }
    }
  }
  return blocks;
}

function boxFromMaterial(mesh, material, fallbackId = material) {
  const materialElements = (mesh.elements || []).filter((element) => element.material === material);
  const nodeIds = new Set(materialElements.flatMap((element) => element.nodes || []));
  const nodes = (mesh.nodes || []).filter((node) => nodeIds.has(node.id));
  if (!nodes.length) return null;
  const bounds = {
    x: [Math.min(...nodes.map((node) => node.x)), Math.max(...nodes.map((node) => node.x))],
    y: [Math.min(...nodes.map((node) => node.y)), Math.max(...nodes.map((node) => node.y))],
    z: [Math.min(...nodes.map((node) => node.z)), Math.max(...nodes.map((node) => node.z))],
  };
  return new Box(fallbackId, material, centerFromBounds(bounds), sizeFromBounds(bounds));
}

function buildProjectGmshBlockLayout(mesh, options = {}) {
  /*
   * Human-editable geometry map.
   *
   * This is the place to make the native Gmsh model read like the physical setup:
   * - cytoplasmBox defines the outer cell/cytoplasm bounding box.
   * - nucleusBox defines the nucleus bounding box.
   * - cytoplasmPartition splits cytoplasm at nucleus left/right/top/bottom planes.
   * - pipetteBox and dishBox keep the rigid pipette and dish as named boxes.
   *
   * Changing split planes changes which named block bands exist conceptually.
   * Changing coordinateAliases in case JSON changes the readable names emitted
   * into generated .geo/.py files, without editing generated Python directly.
   */
  const cytoplasmBox = boxFromMaterial(mesh, "cytoplasm", "cytoplasm");
  const nucleusBox = boxFromMaterial(mesh, "nucleus", "nucleus");
  const pipetteBox = boxFromMaterial(mesh, "pipette", "pipette");
  const dishBox = boxFromMaterial(mesh, "dish", "dish");
  const cytoplasmPartition = cytoplasmBox && nucleusBox
    ? partition({
      id: "cytoplasm",
      material: "cytoplasm",
      box: cytoplasmBox,
      splitAt: {
        x: [
          ["nucleus_left", () => nucleusBox.left],
          ["nucleus_right", () => nucleusBox.right],
        ],
        z: [
          ["nucleus_bottom", () => nucleusBox.bottom],
          ["nucleus_top", () => nucleusBox.top],
        ],
      },
      exclude: [nucleusBox],
    })
    : [];

  return {
    boxes: {
      cytoplasm: cytoplasmBox,
      nucleus: nucleusBox,
      pipette: pipetteBox,
      dish: dishBox,
    },
    blocks: [
      ...cytoplasmPartition,
      ...(nucleusBox ? [blockFromBox(nucleusBox)] : []),
      ...(pipetteBox ? [blockFromBox(pipetteBox)] : []),
      ...(dishBox ? [blockFromBox(dishBox)] : []),
    ],
    coordinateAliases: options.coordinateAliases || {},
  };
}

function buildNodeRemap(parsedNodes = [], templateNodes = []) {
  if (!templateNodes.length) return new Map(parsedNodes.map((node) => [node.id, node.id]));
  const templateByCoordinate = new Map(templateNodes.map((node) => [coordinateKey(node), node.id]));
  return new Map(parsedNodes.map((node) => [node.id, templateByCoordinate.get(coordinateKey(node)) ?? node.id]));
}

function nodeSignature(nodes = []) {
  return [...nodes].sort((a, b) => a - b).join(",");
}

function buildElementIdLookup(templateMesh = {}) {
  const lookup = new Map();
  (templateMesh.elements || []).forEach((element) => {
    lookup.set(`${element.material}:${nodeSignature(element.nodes)}`, element.id);
  });
  return lookup;
}

function buildFacetIdLookup(templateMesh = {}) {
  const lookup = new Map();
  Object.entries(templateMesh.surfaces || {}).forEach(([surfaceName, facets]) => {
    (facets || []).forEach((facet) => {
      lookup.set(`${surfaceName}:${nodeSignature(facet.nodes)}`, facet.id);
    });
  });
  return lookup;
}

function hasDuplicateCoordinates(nodes = []) {
  const seen = new Set();
  return nodes.some((node) => {
    const key = coordinateKey(node);
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}

function coordinateMultiset(nodes = []) {
  const counts = new Map();
  nodes.forEach((node) => {
    const key = coordinateKey(node);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function sameCoordinateMultiset(a = [], b = []) {
  return JSON.stringify(coordinateMultiset(a)) === JSON.stringify(coordinateMultiset(b));
}

export function serializeNativeMeshToGmshV2(mesh, options = {}) {
  const physicalGroups = collectPhysicalGroups(mesh);
  const physicalIds = new Map(physicalGroups.map((group) => [`${group.dimension}:${group.name}`, group.id]));
  const lines = [
    "$MeshFormat",
    "2.2 0 8",
    "$EndMeshFormat",
    "$PhysicalNames",
    String(physicalGroups.length),
    ...physicalGroups.map((group) => `${group.dimension} ${group.id} "${quoteGmshName(group.name)}"`),
    "$EndPhysicalNames",
    "$Nodes",
    String((mesh.nodes || []).length),
    ...(mesh.nodes || []).map((node) => `${node.id} ${node.x} ${node.y} ${node.z}`),
    "$EndNodes",
  ];

  const elementRows = [];
  (mesh.elements || []).forEach((element) => {
    const physicalId = physicalIds.get(`3:${element.material}`);
    if (!physicalId) return;
    elementRows.push({
      id: element.id,
      elementType: GMSH_ELEMENT_TYPES[element.type],
      tags: [physicalId, physicalId, element.id],
      nodes: element.nodes || [],
    });
  });
  let nextSurfaceElementId = Math.max(0, ...(mesh.elements || []).map((element) => element.id)) + 1;
  Object.entries(mesh.surfaces || {}).forEach(([surfaceName, facets]) => {
    const physicalId = physicalIds.get(`2:${surfaceName}`);
    (facets || []).forEach((facet) => {
      elementRows.push({
        id: nextSurfaceElementId++,
        elementType: GMSH_ELEMENT_TYPES[facet.type],
        tags: [physicalId, physicalId, facet.id],
        nodes: facet.nodes || [],
      });
    });
  });

  lines.push(
    "$Elements",
    String(elementRows.length),
    ...elementRows.map((row) => [
      row.id,
      row.elementType,
      row.tags.length,
      ...row.tags,
      ...row.nodes,
    ].join(" ")),
    "$EndElements",
  );
  if (options.trailingNewline === false) return lines.join("\n");
  return `${lines.join("\n")}\n`;
}

export function parseGmshMshV2(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const physicalNames = new Map();
  const nodes = [];
  const elements = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === "$MeshFormat") {
      const version = lines[i + 1]?.split(/\s+/)[0];
      if (version !== "2.2") throw new Error(`unsupported gmsh mesh format ${version || "(missing)"}`);
      i += 2;
    } else if (line === "$PhysicalNames") {
      const count = parseInteger(lines[++i], "PhysicalNames count");
      for (let n = 0; n < count; n += 1) {
        const match = lines[++i].match(/^(\d+)\s+(\d+)\s+"(.*)"$/);
        if (!match) throw new Error(`invalid PhysicalNames row: ${lines[i]}`);
        const dimension = parseInteger(match[1], "physical dimension");
        const id = parseInteger(match[2], "physical id");
        physicalNames.set(`${dimension}:${id}`, match[3].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
      }
    } else if (line === "$Nodes") {
      const count = parseInteger(lines[++i], "Nodes count");
      for (let n = 0; n < count; n += 1) {
        const parts = lines[++i].split(/\s+/);
        nodes.push({
          id: parseInteger(parts[0], "node id"),
          x: parseNumber(parts[1], "node x"),
          y: parseNumber(parts[2], "node y"),
          z: parseNumber(parts[3], "node z"),
        });
      }
    } else if (line === "$Elements") {
      const count = parseInteger(lines[++i], "Elements count");
      for (let n = 0; n < count; n += 1) {
        const parts = lines[++i].split(/\s+/);
        const id = parseInteger(parts[0], "element id");
        const elementType = parseInteger(parts[1], "element type");
        const tagCount = parseInteger(parts[2], "element tag count");
        const tags = parts.slice(3, 3 + tagCount).map((value) => parseInteger(value, "element tag"));
        const nodesForElement = parts.slice(3 + tagCount).map((value) => parseInteger(value, "element node"));
        elements.push({ id, elementType, tags, nodes: nodesForElement });
      }
    }
  }
  return { format: "gmsh-msh-v2-ascii", physicalNames, nodes, elements };
}

export function convertGmshMshToNativeMesh(parsed, templateMesh = {}) {
  if (
    (templateMesh.nodes || []).length > 0 &&
    (parsed.nodes || []).length === (templateMesh.nodes || []).length &&
    hasDuplicateCoordinates(templateMesh.nodes || []) &&
    sameCoordinateMultiset(parsed.nodes || [], templateMesh.nodes || [])
  ) {
    return {
      ...clone(templateMesh),
      meshMode: "gmsh-baseline",
      gmsh: {
        format: parsed.format,
        physicalGroupCount: parsed.physicalNames.size,
        source: "gmsh-v2-ascii",
        nativeIdRecovery: "template-preserved-for-duplicate-coordinate-baseline",
      },
    };
  }
  const surfaces = {};
  const elementSets = {};
  const elements = [];
  const nodeRemap = buildNodeRemap(parsed.nodes || [], templateMesh.nodes || []);
  const elementIdLookup = buildElementIdLookup(templateMesh);
  const facetIdLookup = buildFacetIdLookup(templateMesh);
  (parsed.elements || []).forEach((entry) => {
    const definition = NATIVE_ELEMENT_TYPES.get(entry.elementType);
    if (!definition) return;
    if (entry.nodes.length !== definition.nodeCount) {
      throw new Error(`gmsh element ${entry.id} type ${entry.elementType} expected ${definition.nodeCount} nodes`);
    }
    const physicalName = parsed.physicalNames.get(`${definition.dimension}:${entry.tags[0]}`);
    if (!physicalName) throw new Error(`gmsh element ${entry.id} references unknown physical group ${entry.tags[0]}`);
    const remappedNodes = entry.nodes.map((nodeId) => nodeRemap.get(nodeId) ?? nodeId);
    if (definition.dimension === 3) {
      const nativeId = elementIdLookup.get(`${physicalName}:${nodeSignature(remappedNodes)}`) ?? entry.tags[2] ?? entry.id;
      elements.push({ id: nativeId, type: definition.type, material: physicalName, nodes: remappedNodes });
      elementSets[physicalName] = [...(elementSets[physicalName] || []), nativeId];
    } else if (definition.dimension === 2) {
      const nativeId = facetIdLookup.get(`${physicalName}:${nodeSignature(remappedNodes)}`) ?? entry.tags[2] ?? entry.id;
      surfaces[physicalName] = [...(surfaces[physicalName] || []), { id: nativeId, type: definition.type, nodes: remappedNodes }];
    }
  });
  return {
    ...clone(templateMesh),
    meshMode: "gmsh-baseline",
    nodes: (parsed.nodes || [])
      .map((node) => ({ ...node, id: nodeRemap.get(node.id) ?? node.id }))
      .sort((a, b) => a.id - b.id),
    elements: elements.sort((a, b) => a.id - b.id),
    surfaces,
    elementSets,
    gmsh: {
      format: parsed.format,
      physicalGroupCount: parsed.physicalNames.size,
      source: "gmsh-v2-ascii",
    },
  };
}

export function buildGmshBaselineGeo(mesh, options = {}) {
  const mshPath = options.mshPath || "native-baseline.msh";
  const lines = [
    "// Gmsh baseline companion for the FEBio native mesh.",
    "// The current S10 foundation preserves native node/element ids by round-tripping a v2 ASCII MSH file.",
    `Merge "${quoteGmshName(mshPath)}";`,
    'Mesh.MshFileVersion = 2.2;',
    "",
    "// Physical group names expected by the native converter:",
    ...collectPhysicalGroups(mesh).map((group) => `// ${group.dimension} ${group.id} ${group.name}`),
  ];
  return `${lines.join("\n")}\n`;
}

const HEX_FACE_NODES = [
  [0, 3, 2, 1],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [1, 2, 6, 5],
  [2, 3, 7, 6],
  [3, 0, 4, 7],
];

function makeEdgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function makeFaceKey(nodes = []) {
  return [...nodes].sort((a, b) => a - b).join(":");
}

export function buildEditableGmshBlockGeo(mesh, options = {}) {
  const characteristicLength = Number.isFinite(Number(options.characteristicLength))
    ? Number(options.characteristicLength)
    : 1;
  const surfaceNameByFaceKey = new Map();
  Object.entries(mesh.surfaces || {}).forEach(([surfaceName, facets]) => {
    (facets || []).forEach((facet) => {
      const key = makeFaceKey(facet.nodes || []);
      if (!surfaceNameByFaceKey.has(key)) surfaceNameByFaceKey.set(key, []);
      surfaceNameByFaceKey.get(key).push(surfaceName);
    });
  });

  const lines = [
    "// Editable Gmsh block geometry generated from the FEBio native mesh.",
    "// This is the first hand-editable bridge: each native hex is represented as transfinite geometry.",
    "// Keep Physical Volume and Physical Surface names aligned with native mesh names.",
    "Mesh.MshFileVersion = 2.2;",
    "Mesh.SaveAll = 0;",
    "Mesh.RecombineAll = 1;",
    "",
  ];

  (mesh.nodes || []).forEach((node) => {
    lines.push(`Point(${node.id}) = {${formatGmshNumber(node.x)}, ${formatGmshNumber(node.y)}, ${formatGmshNumber(node.z)}, ${formatGmshNumber(characteristicLength)}};`);
  });
  lines.push("");

  const edgeIds = new Map();
  const surfaceIds = new Map();
  const surfaceIdsByName = new Map();
  const volumeIdsByMaterial = new Map();
  let nextLineId = 10000;
  let nextSurfaceId = 20000;

  function lineRef(a, b) {
    const key = makeEdgeKey(a, b);
    let edge = edgeIds.get(key);
    if (!edge) {
      edge = { id: nextLineId++, from: a, to: b };
      edgeIds.set(key, edge);
      lines.push(`Line(${edge.id}) = {${a}, ${b}};`);
    }
    return edge.from === a && edge.to === b ? edge.id : -edge.id;
  }

  function surfaceForFace(faceNodes, ownerElementId) {
    const key = makeFaceKey(faceNodes);
    let surface = surfaceIds.get(key);
    if (!surface) {
      const loopId = nextSurfaceId;
      const surfaceId = nextSurfaceId++;
      const refs = [
        lineRef(faceNodes[0], faceNodes[1]),
        lineRef(faceNodes[1], faceNodes[2]),
        lineRef(faceNodes[2], faceNodes[3]),
        lineRef(faceNodes[3], faceNodes[0]),
      ];
      lines.push(`Curve Loop(${loopId}) = {${refs.join(", ")}};`);
      lines.push(`Plane Surface(${surfaceId}) = {${loopId}}; // owner element ${ownerElementId}`);
      lines.push(`Transfinite Surface {${surfaceId}};`);
      lines.push(`Recombine Surface {${surfaceId}};`);
      surface = { id: surfaceId, names: surfaceNameByFaceKey.get(key) || [] };
      surfaceIds.set(key, surface);
      surface.names.forEach((name) => {
        const ids = surfaceIdsByName.get(name) || [];
        ids.push(surfaceId);
        surfaceIdsByName.set(name, ids);
      });
    }
    return surface.id;
  }

  lines.push("");
  (mesh.elements || []).forEach((element) => {
    if (element.type !== "hex8") return;
    const faceSurfaceIds = HEX_FACE_NODES.map((face) => surfaceForFace(face.map((index) => element.nodes[index]), element.id));
    const surfaceLoopId = 30000 + element.id;
    lines.push(`Surface Loop(${surfaceLoopId}) = {${faceSurfaceIds.join(", ")}};`);
    lines.push(`Volume(${element.id}) = {${surfaceLoopId}};`);
    lines.push(`Transfinite Volume {${element.id}} = {${element.nodes.join(", ")}};`);
    lines.push(`Recombine Volume {${element.id}};`);
    const volumeIds = volumeIdsByMaterial.get(element.material) || [];
    volumeIds.push(element.id);
    volumeIdsByMaterial.set(element.material, volumeIds);
  });

  lines.push("");
  [...edgeIds.values()].forEach((edge) => {
    lines.push(`Transfinite Curve {${edge.id}} = 2;`);
  });
  lines.push("");

  [...volumeIdsByMaterial.entries()].forEach(([material, ids]) => {
    lines.push(`Physical Volume("${quoteGmshName(material)}") = {${ids.join(", ")}};`);
  });
  [...surfaceIdsByName.entries()].forEach(([surfaceName, ids]) => {
    lines.push(`Physical Surface("${quoteGmshName(surfaceName)}") = {${[...new Set(ids)].join(", ")}};`);
  });
  lines.push("");

  return `${lines.join("\n")}\n`;
}

export function buildParametricEditableGmshBlockGeo(mesh, options = {}) {
  const characteristicLength = Number.isFinite(Number(options.characteristicLength))
    ? Number(options.characteristicLength)
    : 1;
  const editingLayout = buildProjectGmshBlockLayout(mesh, options);
  const surfaceNameByFaceKey = new Map();
  Object.entries(mesh.surfaces || {}).forEach(([surfaceName, facets]) => {
    (facets || []).forEach((facet) => {
      const key = makeFaceKey(facet.nodes || []);
      if (!surfaceNameByFaceKey.has(key)) surfaceNameByFaceKey.set(key, []);
      surfaceNameByFaceKey.get(key).push(surfaceName);
    });
  });

  const { coordinateValues, aliases, coordinateExpression } = collectParametricCoordinateExpressions(mesh, editingLayout.coordinateAliases);

  const lines = [
    "// Parametric editable Gmsh block geometry generated from the FEBio native mesh.",
    "// This keeps the current quad/hex block topology, but exposes rectangle/block coordinates as variables.",
    "// Edit source of truth: febio_cases/native/*.native.json geometry.gmshPythonApi.",
    "// Alias effect: changing an alias target changes every Point that references that alias.",
    "// Topology/Physical names remain generator-owned to preserve native round-trip validation.",
    ...GMSH_PYTHON_API_EDIT_GUIDE.map((line) => `// ${line}`),
    "Mesh.MshFileVersion = 2.2;",
    "Mesh.SaveAll = 0;",
    "Mesh.RecombineAll = 1;",
    "",
    "lc = " + formatGmshNumber(characteristicLength) + ";",
    "",
    "// Coordinate planes used by the rectangular block layout.",
  ];

  Object.entries(coordinateValues).forEach(([axis, values]) => {
    values.forEach((value) => {
      lines.push(`${coordinateVariableName(axis, value)} = ${formatGmshNumber(value)};`);
    });
  });
  lines.push(
    "",
    "// Coordinate aliases from native case JSON / generator options.",
  );
  aliases.forEach((alias) => {
    lines.push(`${alias.name} = ${coordinateVariableName(alias.axis, alias.value)};`);
  });
  lines.push(
    "",
  );

  (mesh.nodes || []).forEach((node) => {
    lines.push(`Point(${node.id}) = {${coordinateExpression("X", node.x)}, ${coordinateExpression("Y", node.y)}, ${coordinateExpression("Z", node.z)}, lc};`);
  });
  lines.push("");

  const edgeIds = new Map();
  const surfaceIds = new Map();
  const surfaceIdsByName = new Map();
  const volumeIdsByMaterial = new Map();
  let nextLineId = 10000;
  let nextSurfaceId = 20000;

  function lineRef(a, b) {
    const key = makeEdgeKey(a, b);
    let edge = edgeIds.get(key);
    if (!edge) {
      edge = { id: nextLineId++, from: a, to: b };
      edgeIds.set(key, edge);
      lines.push(`Line(${edge.id}) = {${a}, ${b}};`);
    }
    return edge.from === a && edge.to === b ? edge.id : -edge.id;
  }

  function surfaceForFace(faceNodes, ownerElementId) {
    const key = makeFaceKey(faceNodes);
    let surface = surfaceIds.get(key);
    if (!surface) {
      const loopId = nextSurfaceId;
      const surfaceId = nextSurfaceId++;
      const refs = [
        lineRef(faceNodes[0], faceNodes[1]),
        lineRef(faceNodes[1], faceNodes[2]),
        lineRef(faceNodes[2], faceNodes[3]),
        lineRef(faceNodes[3], faceNodes[0]),
      ];
      lines.push(`Curve Loop(${loopId}) = {${refs.join(", ")}};`);
      lines.push(`Plane Surface(${surfaceId}) = {${loopId}}; // owner element ${ownerElementId}`);
      lines.push(`Transfinite Surface {${surfaceId}};`);
      lines.push(`Recombine Surface {${surfaceId}};`);
      surface = { id: surfaceId, names: surfaceNameByFaceKey.get(key) || [] };
      surfaceIds.set(key, surface);
      surface.names.forEach((name) => {
        const ids = surfaceIdsByName.get(name) || [];
        ids.push(surfaceId);
        surfaceIdsByName.set(name, ids);
      });
    }
    return surface.id;
  }

  lines.push("");
  (mesh.elements || []).forEach((element) => {
    if (element.type !== "hex8") return;
    const faceSurfaceIds = HEX_FACE_NODES.map((face) => surfaceForFace(face.map((index) => element.nodes[index]), element.id));
    const surfaceLoopId = 30000 + element.id;
    lines.push(`Surface Loop(${surfaceLoopId}) = {${faceSurfaceIds.join(", ")}};`);
    lines.push(`Volume(${element.id}) = {${surfaceLoopId}};`);
    lines.push(`Transfinite Volume {${element.id}} = {${element.nodes.join(", ")}};`);
    lines.push(`Recombine Volume {${element.id}};`);
    const volumeIds = volumeIdsByMaterial.get(element.material) || [];
    volumeIds.push(element.id);
    volumeIdsByMaterial.set(element.material, volumeIds);
  });

  lines.push("");
  [...edgeIds.values()].forEach((edge) => {
    lines.push(`Transfinite Curve {${edge.id}} = 2;`);
  });
  lines.push("");

  [...volumeIdsByMaterial.entries()].forEach(([material, ids]) => {
    lines.push(`Physical Volume("${quoteGmshName(material)}") = {${ids.join(", ")}};`);
  });
  [...surfaceIdsByName.entries()].forEach(([surfaceName, ids]) => {
    lines.push(`Physical Surface("${quoteGmshName(surfaceName)}") = {${[...new Set(ids)].join(", ")}};`);
  });
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function normalizeCoordinateAliases(aliases = {}) {
  const isPythonIdentifier = (name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
  if (Array.isArray(aliases)) {
    return aliases.map((entry) => ({
      name: String(entry?.name || ""),
      axis: String(entry?.axis || "").toUpperCase(),
      value: Number(entry?.value),
    })).filter((entry) => isPythonIdentifier(entry.name) && ["X", "Y", "Z"].includes(entry.axis) && Number.isFinite(entry.value));
  }
  return Object.entries(aliases || {}).map(([name, entry]) => ({
    name,
    axis: String(entry?.axis || "").toUpperCase(),
    value: Number(entry?.value),
  })).filter((entry) => isPythonIdentifier(entry.name) && ["X", "Y", "Z"].includes(entry.axis) && Number.isFinite(entry.value));
}

function collectParametricCoordinateExpressions(mesh, aliases = {}) {
  const coordinateValues = {
    X: [...new Set((mesh.nodes || []).map((node) => node.x))].sort((a, b) => a - b),
    Y: [...new Set((mesh.nodes || []).map((node) => node.y))].sort((a, b) => a - b),
    Z: [...new Set((mesh.nodes || []).map((node) => node.z))].sort((a, b) => a - b),
  };
  const normalizedAliases = normalizeCoordinateAliases(aliases)
    .filter((entry) => coordinateValues[entry.axis].some((value) => coordinateVariableKey(entry.axis, value) === coordinateVariableKey(entry.axis, entry.value)));
  const aliasByCoordinate = new Map(normalizedAliases.map((entry) => [coordinateVariableKey(entry.axis, entry.value), entry.name]));
  return {
    coordinateValues,
    aliases: normalizedAliases,
    coordinateExpression(axis, value) {
      return aliasByCoordinate.get(coordinateVariableKey(axis, value)) || coordinateVariableName(axis, value);
    },
  };
}

function collectBlockTopology(mesh) {
  const surfaceNameByFaceKey = new Map();
  Object.entries(mesh.surfaces || {}).forEach(([surfaceName, facets]) => {
    (facets || []).forEach((facet) => {
      const key = makeFaceKey(facet.nodes || []);
      if (!surfaceNameByFaceKey.has(key)) surfaceNameByFaceKey.set(key, []);
      surfaceNameByFaceKey.get(key).push(surfaceName);
    });
  });

  const edges = [];
  const edgeIds = new Map();
  const surfaces = [];
  const surfaceIds = new Map();
  const surfaceIdsByName = new Map();
  const volumes = [];
  const volumeIdsByMaterial = new Map();
  let nextLineId = 10000;
  let nextSurfaceId = 20000;

  function lineRef(a, b) {
    const key = makeEdgeKey(a, b);
    let edge = edgeIds.get(key);
    if (!edge) {
      edge = { id: nextLineId++, from: a, to: b };
      edgeIds.set(key, edge);
      edges.push(edge);
    }
    return edge.from === a && edge.to === b ? edge.id : -edge.id;
  }

  function surfaceForFace(faceNodes, ownerElementId) {
    const key = makeFaceKey(faceNodes);
    let surface = surfaceIds.get(key);
    if (!surface) {
      const loopId = nextSurfaceId;
      const surfaceId = nextSurfaceId++;
      const refs = [
        lineRef(faceNodes[0], faceNodes[1]),
        lineRef(faceNodes[1], faceNodes[2]),
        lineRef(faceNodes[2], faceNodes[3]),
        lineRef(faceNodes[3], faceNodes[0]),
      ];
      surface = { id: surfaceId, loopId, refs, ownerElementId, names: surfaceNameByFaceKey.get(key) || [] };
      surfaceIds.set(key, surface);
      surfaces.push(surface);
      surface.names.forEach((name) => {
        const ids = surfaceIdsByName.get(name) || [];
        ids.push(surfaceId);
        surfaceIdsByName.set(name, ids);
      });
    }
    return surface.id;
  }

  (mesh.elements || []).forEach((element) => {
    if (element.type !== "hex8") return;
    const faceSurfaceIds = HEX_FACE_NODES.map((face) => surfaceForFace(face.map((index) => element.nodes[index]), element.id));
    volumes.push({ id: element.id, material: element.material, nodes: element.nodes || [], surfaceLoopId: 30000 + element.id, surfaceIds: faceSurfaceIds });
    const volumeIds = volumeIdsByMaterial.get(element.material) || [];
    volumeIds.push(element.id);
    volumeIdsByMaterial.set(element.material, volumeIds);
  });

  return {
    edges,
    surfaces,
    volumes,
    surfaceIdsByName,
    volumeIdsByMaterial,
  };
}

export function buildGmshPythonApiBlockScript(mesh, options = {}) {
  const requestedTransfiniteCurveDivisions = Number(options.transfiniteCurveDivisions);
  const transfiniteCurveDivisions = Number.isInteger(requestedTransfiniteCurveDivisions) && requestedTransfiniteCurveDivisions >= 2
    ? requestedTransfiniteCurveDivisions
    : 2;
  const outputMshPath = String(options.outputMshPath || "native-python-api-block.msh").split(/[\\/]/).filter(Boolean).pop() || "native-python-api-block.msh";
  const editingLayout = buildProjectGmshBlockLayout(mesh, options);
  const { coordinateValues, aliases, coordinateExpression } = collectParametricCoordinateExpressions(mesh, editingLayout.coordinateAliases);
  const topology = collectBlockTopology(mesh);
  const physicalGroups = collectPhysicalGroups(mesh, options.physicalGroupRegistry || DEFAULT_PHYSICAL_GROUP_REGISTRY);
  const physicalIdsByName = new Map(physicalGroups.map((group) => [`${group.dimension}:${group.name}`, group.id]));

  const lines = [
    "# Generated Gmsh Python API block mesh for the FEBio native mesh.",
    "# DO NOT EDIT: regenerate from the native case JSON / generator options.",
    ...GMSH_PYTHON_API_EDIT_GUIDE.map((line) => `# ${line}`),
    "from pathlib import Path",
    "import sys",
    "",
    "for base in [Path(__file__).resolve(), Path.cwd().resolve()]:",
    "    for parent in [base, *base.parents]:",
    "        candidate = parent / \".tools\" / \"python-gmsh\"",
    "        if candidate.exists():",
    "            sys.path.insert(0, str(candidate))",
    "            break",
    "",
    "try:",
    "    import gmsh",
    "except ModuleNotFoundError as exc:",
    "    raise SystemExit(\"Python package 'gmsh' is required. Install the gmsh Python API matching the CLI before running this script.\") from exc",
    "",
    "SCRIPT_DIR = Path(__file__).resolve().parent",
    "OUT_MSH = SCRIPT_DIR / " + pythonString(outputMshPath),
    "TRANSFINITE_CURVE_DIVISIONS = " + String(transfiniteCurveDivisions),
    "",
    "def require_existing_entity_tags(dimension, name, tags):",
    "    existing = {tag for _, tag in gmsh.model.getEntities(dimension)}",
    "    missing = [tag for tag in tags if tag not in existing]",
    "    if missing:",
    "        raise SystemExit(f\"Physical Group {dimension}:{name} references missing entity tag(s): {missing}\")",
    "    return tags",
    "",
    "# Coordinate planes used by the rectangular block layout.",
  ];

  Object.entries(coordinateValues).forEach(([axis, values]) => {
    values.forEach((value) => {
      lines.push(`${coordinateVariableName(axis, value)} = ${formatGmshNumber(value)}`);
    });
  });
  lines.push(
    "",
    "# Coordinate aliases from native case JSON / generator options.",
  );
  aliases.forEach((alias) => {
    lines.push(`${alias.name} = ${coordinateVariableName(alias.axis, alias.value)}`);
  });
  lines.push(
    "",
    "PHYSICAL_VOLUMES = {",
  );
  [...topology.volumeIdsByMaterial.entries()].forEach(([material, ids]) => {
    lines.push(`    ${pythonString(material)}: ${JSON.stringify(ids)},`);
  });
  lines.push(
    "}",
    "PHYSICAL_SURFACES = {",
  );
  [...topology.surfaceIdsByName.entries()].forEach(([surfaceName, ids]) => {
    lines.push(`    ${pythonString(surfaceName)}: ${JSON.stringify([...new Set(ids)])},`);
  });
  lines.push(
    "}",
    "PHYSICAL_GROUP_IDS = {",
    "    3: {",
  );
  [...topology.volumeIdsByMaterial.keys()].forEach((material) => {
    lines.push(`        ${pythonString(material)}: ${physicalIdsByName.get(`3:${material}`)},`);
  });
  lines.push(
    "    },",
    "    2: {",
  );
  [...topology.surfaceIdsByName.keys()].forEach((surfaceName) => {
    lines.push(`        ${pythonString(surfaceName)}: ${physicalIdsByName.get(`2:${surfaceName}`)},`);
  });
  lines.push(
    "    },",
    "}",
    "",
    "gmsh.initialize([arg for arg in sys.argv if arg != \"--gui\"])",
    "gmsh.model.add(\"febio_native_parametric_block\")",
    "gmsh.option.setNumber(\"Mesh.MshFileVersion\", 2.2)",
    "gmsh.option.setNumber(\"Mesh.SaveAll\", 0)",
    "gmsh.option.setNumber(\"Mesh.RecombineAll\", 1)",
    "",
  );

  (mesh.nodes || []).forEach((node) => {
    lines.push(`gmsh.model.geo.addPoint(${coordinateExpression("X", node.x)}, ${coordinateExpression("Y", node.y)}, ${coordinateExpression("Z", node.z)}, 0, ${node.id})`);
  });
  lines.push("");
  topology.edges.forEach((edge) => {
    lines.push(`gmsh.model.geo.addLine(${edge.from}, ${edge.to}, ${edge.id})`);
  });
  lines.push("");
  topology.surfaces.forEach((surface) => {
    lines.push(`gmsh.model.geo.addCurveLoop(${JSON.stringify(surface.refs)}, ${surface.loopId})`);
    lines.push(`gmsh.model.geo.addPlaneSurface([${surface.loopId}], ${surface.id})  # owner element ${surface.ownerElementId}`);
  });
  lines.push("");
  topology.volumes.forEach((volume) => {
    lines.push(`gmsh.model.geo.addSurfaceLoop(${JSON.stringify(volume.surfaceIds)}, ${volume.surfaceLoopId})`);
    lines.push(`gmsh.model.geo.addVolume([${volume.surfaceLoopId}], ${volume.id})`);
  });
  lines.push(
    "",
    "gmsh.model.geo.synchronize()",
    "",
  );
  topology.edges.forEach((edge) => {
    lines.push(`gmsh.model.mesh.setTransfiniteCurve(${edge.id}, TRANSFINITE_CURVE_DIVISIONS)`);
  });
  topology.surfaces.forEach((surface) => {
    lines.push(`gmsh.model.mesh.setTransfiniteSurface(${surface.id})`);
    lines.push(`gmsh.model.mesh.setRecombine(2, ${surface.id})`);
  });
  topology.volumes.forEach((volume) => {
    lines.push(`gmsh.model.mesh.setTransfiniteVolume(${volume.id}, ${JSON.stringify(volume.nodes)})`);
    lines.push(`gmsh.model.mesh.setRecombine(3, ${volume.id})`);
  });
  lines.push(
    "",
    "for name, tags in PHYSICAL_VOLUMES.items():",
    "    group = gmsh.model.addPhysicalGroup(3, require_existing_entity_tags(3, name, tags), PHYSICAL_GROUP_IDS[3][name])",
    "    gmsh.model.setPhysicalName(3, group, name)",
    "for name, tags in PHYSICAL_SURFACES.items():",
    "    group = gmsh.model.addPhysicalGroup(2, require_existing_entity_tags(2, name, tags), PHYSICAL_GROUP_IDS[2][name])",
    "    gmsh.model.setPhysicalName(2, group, name)",
    "",
    "gmsh.model.mesh.generate(3)",
    "gmsh.write(str(OUT_MSH))",
    "if \"--gui\" in sys.argv:",
    "    gmsh.fltk.run()",
    "gmsh.finalize()",
    "print(OUT_MSH)",
    "",
  );

  return `${lines.join("\n")}\n`;
}

export function buildGmshBaselineNativeMesh(nativeMesh) {
  const msh = serializeNativeMeshToGmshV2(nativeMesh);
  return convertGmshMshToNativeMesh(parseGmshMshV2(msh), nativeMesh);
}
