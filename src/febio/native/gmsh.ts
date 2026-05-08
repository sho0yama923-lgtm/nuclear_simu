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

export function buildGmshBaselineNativeMesh(nativeMesh) {
  const msh = serializeNativeMeshToGmshV2(nativeMesh);
  return convertGmshMshToNativeMesh(parseGmshMshV2(msh), nativeMesh);
}
