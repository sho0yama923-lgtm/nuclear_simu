const GMSH_ELEMENT_TYPES = {
  quad4: 3,
  hex8: 5,
};

const NATIVE_ELEMENT_TYPES = new Map([
  [3, { type: "quad4", nodeCount: 4, dimension: 2 }],
  [5, { type: "hex8", nodeCount: 8, dimension: 3 }],
]);

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

function collectPhysicalGroups(mesh) {
  const groups = [];
  Object.keys(mesh.elementSets || {}).forEach((name) => groups.push({ dimension: 3, name }));
  Object.keys(mesh.surfaces || {}).forEach((name) => groups.push({ dimension: 2, name }));
  return groups.map((group, index) => ({ ...group, id: index + 1 }));
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
  const surfaceNameByFaceKey = new Map();
  Object.entries(mesh.surfaces || {}).forEach(([surfaceName, facets]) => {
    (facets || []).forEach((facet) => {
      const key = makeFaceKey(facet.nodes || []);
      if (!surfaceNameByFaceKey.has(key)) surfaceNameByFaceKey.set(key, []);
      surfaceNameByFaceKey.get(key).push(surfaceName);
    });
  });

  const coordinateValues = {
    X: [...new Set((mesh.nodes || []).map((node) => node.x))].sort((a, b) => a - b),
    Y: [...new Set((mesh.nodes || []).map((node) => node.y))].sort((a, b) => a - b),
    Z: [...new Set((mesh.nodes || []).map((node) => node.z))].sort((a, b) => a - b),
  };
  const aliases = new Map([
    [coordinateVariableKey("X", 14), "pipetteMouthX"],
    [coordinateVariableKey("X", 27), "pipetteOuterX"],
    [coordinateVariableKey("Y", -0.2), "pipetteYMin"],
    [coordinateVariableKey("Y", 0.2), "pipetteYMax"],
    [coordinateVariableKey("Z", 10.5), "pipetteZBottom"],
    [coordinateVariableKey("Z", 13.75), "pipettePatchZBottom"],
    [coordinateVariableKey("Z", 20.25), "pipettePatchZTop"],
    [coordinateVariableKey("Z", 23.5), "pipetteZTop"],
  ]);

  function coordinateExpression(axis, value) {
    return aliases.get(coordinateVariableKey(axis, value)) || coordinateVariableName(axis, value);
  }

  const lines = [
    "// Parametric editable Gmsh block geometry generated from the FEBio native mesh.",
    "// This keeps the current quad/hex block topology, but exposes rectangle/block coordinates as variables.",
    "// Edit coordinate variables first; keep Physical Volume and Physical Surface names aligned with native mesh names.",
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
    "// High-value editing handles.",
    "// To thin the visible pipette mouth in the x-z view, move pipetteZBottom / pipetteZTop toward the patch band.",
    "// To shorten or lengthen the rigid pipette barrel, edit pipetteOuterX.",
    "pipetteMouthX = X_14;",
    "pipetteOuterX = X_27;",
    "pipetteYMin = Y_n0p2;",
    "pipetteYMax = Y_0p2;",
    "pipetteZBottom = Z_10p5;",
    "pipettePatchZBottom = Z_13p75;",
    "pipettePatchZTop = Z_20p25;",
    "pipetteZTop = Z_23p5;",
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

export function buildGmshBaselineNativeMesh(nativeMesh) {
  const msh = serializeNativeMeshToGmshV2(nativeMesh);
  return convertGmshMshToNativeMesh(parseGmshMshV2(msh), nativeMesh);
}
