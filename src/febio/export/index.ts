import { buildSimulationInput, COORDINATE_SYSTEM_SPEC } from "../../model/schema.ts";
import { structuredCloneSafe } from "../../model/types.ts";
import { buildNucleusCytoplasmInterfaceSpec } from "../interfaces/nucleusCytoplasm.ts";
import { buildRefinedFebioGeometry, validateFebioMesh } from "../mesh/index.ts";

/**
 * SOURCE OF TRUTH: FEBio export assembly and public export entrypoints.
 *
 * Responsibility: assemble FEBio template data, XML, and export bundles from canonical input.
 * Owns: buildFebioTemplateData, serializeFebioTemplateToXml, buildFebioRunBundle, buildFebioInputSpec.
 * Does NOT own: canonical parameter defaults, result normalization, UI rendering.
 * Primary entrypoints: buildFebioTemplateData, serializeFebioTemplateToXml, buildFebioRunBundle, buildFebioInputSpec.
 * Depends on: src/model/schema.ts, src/febio/mesh/index.ts, src/febio/interfaces/nucleusCytoplasm.ts.
 */

function buildViscoelasticMaterialSpec(name, domain, elastic, viscous, optionalNonlinear = null) {
  return {
    name,
    type: "viscoelastic",
    domain,
    elastic,
    viscous: {
      implemented: true,
      eta: viscous.eta,
      g1: 0.35,
      t1: 1.2,
    },
    optionalNonlinear: optionalNonlinear && optionalNonlinear.alpha != null
      ? { implemented: false, alpha: optionalNonlinear.alpha }
      : { implemented: false, alpha: null },
  };
}

function buildMembraneModelSpec(inputSpec) {
  if (inputSpec.membraneModel === "shell_membrane_placeholder") {
    return {
      type: "shell_membrane_placeholder",
      status: "partial-shell-placeholder",
      tension: inputSpec.membrane.Tm,
      thresholds: structuredCloneSafe(inputSpec.membrane),
      notes: ["membrane shell remains planned; cortex proxy stays active in the main flow"],
    };
  }

  return {
    type: "cortex_proxy",
    status: "implemented-proxy",
    tension: inputSpec.membrane.Tm,
    thresholds: structuredCloneSafe(inputSpec.membrane),
    notes: ["effective membrane proxy remains active until shell export becomes solver-primary"],
  };
}

function buildCellDishInterfaceSpec(inputSpec, mesh) {
  return {
    type: "tied-elastic",
    status: "partial-cohesive-ready / tied-elastic-active",
    mode: "solver-primary tied-contact",
    surfacePair: mesh.surfacePairs.cell_dish_pair,
    normalStiffness: inputSpec.interfaces.Kn_cd,
    tangentialStiffness: inputSpec.interfaces.Kt_cd,
    criticalNormalStress: inputSpec.interfaces.sig_cd_crit,
    criticalShearStress: inputSpec.interfaces.tau_cd_crit,
    fractureEnergy: inputSpec.interfaces.Gc_cd,
    nativeObservation: {
      normal: "native-face-data-preferred",
      shear: "proxy-fallback-explicit",
      damage: "native-face-data-preferred",
    },
  };
}

function buildPipetteContactSpec(inputSpec, mesh) {
  return {
    pipetteNucleus: {
      type: "sticky",
      status: "solver-active capture-hold contact",
      mode: "capture-hold",
      tolerance: 0.2,
      searchTolerance: inputSpec.operation.contact_tol,
      searchRadius: Math.max(inputSpec.geometry.rp * 2.2, 1.5),
      surfacePair: mesh.surfacePairs.pipette_nucleus_pair,
      penalty: Math.max(inputSpec.interfaces.Kn_nc * 0.45, 0.2),
      symmetricStiffness: 0,
      autoPenalty: 1,
      friction: Math.max(inputSpec.operation.mu_p, 0),
      maxTraction: Math.max(inputSpec.operation.Fhold * 0.05, 0.25),
      snapTolerance: Math.max(Math.min(inputSpec.geometry.rp * 0.03, 0.18), 0.05),
      releaseCondition: {
        type: "traction-or-slip-threshold",
        tractionLimit: Math.max(inputSpec.operation.Fhold * 0.05, 0.25),
        slipDistance: Math.max(Math.min(inputSpec.geometry.rp * 0.05, 0.3), 0.08),
        note: "modeled with sticky release approximation until a dedicated hold-release law is available",
      },
    },
    pipetteCell: {
      type: "sliding-elastic",
      status: "solver-active secondary contact",
      mode: "secondary-contact-proxy",
      tolerance: 0.2,
      searchTolerance: inputSpec.operation.contact_tol * 1.2,
      searchRadius: Math.max(inputSpec.geometry.rp * 2.5, 1.5),
      surfacePair: mesh.surfacePairs.pipette_cell_pair,
      penalty: Math.max(inputSpec.interfaces.Kn_cd * 0.45, 0.25),
      symmetricStiffness: 0,
      autoPenalty: 1,
      friction: Math.max(inputSpec.operation.mu_p * 0.35, 0),
    },
  };
}

function buildExpectedFebioOutputs(caseName) {
  const normalized = String(caseName || "A").toUpperCase();
  return {
    feb: `case_${normalized}.feb`,
    log: `case_${normalized}.log`,
    xplt: `case_${normalized}.xplt`,
    resultJson: `case_${normalized}_result.json`,
  };
}

function buildDetachmentOutputContract() {
  return {
    evaluation: "damage-plus-geometry",
    preferredSource: "native-first / proxy-assisted fallback",
    events: ["detachmentStart", "detachmentComplete"],
    metrics: ["contactAreaRatio", "relativeNucleusDisplacement"],
    payloadPath: "normalizedResult.events",
  };
}

function buildAspirationOutputContract(inputSpec, mesh) {
  const mouthPlaneX = mesh.bounds?.pipetteRight ?? inputSpec.geometry.xp;
  return {
    name: "pipette_aspiration_length",
    metric: "L(t)",
    unit: "um",
    status: "native-or-postprocessed-contract",
    preferredSource: "native-node-displacement",
    payloadPath: "aspiration.length",
    historyPath: "history[].aspirationLength",
    peakPath: "peaks.peakAspirationLength",
    reference: {
      surface: "pipette_contact_surface",
      nodeSet: "pipette_contact_nodes",
      mouthPlaneX,
      inwardAxis: "-x",
      sectionPlane: "x-z",
    },
    definition:
      "Clamp to >=0 the projected distance from the pipette mouth plane to the most inward aspirated nucleus/cytoplasm node.",
    mapsTo: ["history[].aspirationLength", "aspiration.length", "peaks.peakAspirationLength"],
    notes: [
      "This is the pressure-L(t) comparison metric for micropipette aspiration.",
      "Until FEBio xplt extraction is available, the converter may compute L(t) from declared node displacement logs and records provenance explicitly.",
    ],
  };
}

function buildBoundarySpec(inputSpec, mesh) {
  return {
    fixed: [
      {
        name: "dish_fixed",
        nodeSet: "dish_fixed_nodes",
        dofs: ["x", "y", "z"],
        nodeIds: structuredCloneSafe(mesh.nodeSets?.dish_fixed_nodes || []),
      },
    ],
    prescribed: [
      {
        name: "pipette_lift_z",
        nodeSet: "pipette_contact_nodes",
        dof: "z",
        value: inputSpec.operation.dz_lift,
        loadController: 101,
        mode: "relative",
      },
      {
        name: "pipette_inward_x",
        nodeSet: "pipette_contact_nodes",
        dof: "x",
        value: inputSpec.operation.dx_inward,
        loadController: 102,
        mode: "relative",
      },
      {
        name: "pipette_tangent_y",
        nodeSet: "pipette_contact_nodes",
        dof: "y",
        value: inputSpec.operation.ds_tangent,
        loadController: 103,
        mode: "relative",
      },
    ],
    notes: [
      "dish fixed boundary is solver-active in the XML baseline",
      "pipette motion remains prescribed positioning and is separate from solver-active suction pressure",
    ],
  };
}

function buildLoadSpec(inputSpec) {
  const suctionPressure = Math.abs(inputSpec.operation.P_hold || 0);
  return {
    nodal: [
      {
        name: "hold_force_proxy",
        surface: "pipette_contact_surface",
        value: inputSpec.operation.Fhold,
        loadController: 201,
        status: "proxy-load / not pressure-driven",
      },
    ],
    pressure: [
      {
        name: "pipette_suction_pressure",
        surface: "pipette_contact_surface",
        value: -suctionPressure,
        magnitude: suctionPressure,
        loadController: 202,
        status: "solver-active pressure-driven suction",
        direction: "inward-negative-pressure",
        unit: "kPa",
      },
    ],
    controllers: [
      { id: 101, name: "lift_ramp", points: [[0, 0], [1, 0], [2, 1], [5, 1]] },
      { id: 102, name: "inward_ramp", points: [[0, 0], [3, 0], [4, 1], [5, 1]] },
      { id: 202, name: "suction_pressure_curve", unit: "kPa", points: [[0, 0], [1, 1], [2, 1], [5, 1]] },
    ],
    notes: [
      "P_hold is serialized as a solver-active pressure magnitude on the pipette contact surface.",
      "Fhold remains a hold-force proxy for continuity and is separate from suction pressure.",
    ],
  };
}

function buildFaceDataOutputSpec(name, file, surface, currentCoverage = {}) {
  return {
    name,
    file,
    surface,
    logfileData: "contact gap;contact pressure",
    logfileFields: ["contact gap", "contact pressure"],
    optionalExternalFields: [
      "contact traction",
      "traction x",
      "traction y",
      "traction z",
      "tangential traction",
      "shear traction",
    ],
    currentCoverage: {
      normal: currentCoverage.normal || "native-face-data-preferred",
      damage: currentCoverage.damage || "native-face-data-preferred",
      shear: currentCoverage.shear || "proxy-fallback-explicit",
    },
    notes: [
      "Current standard FEBio logfile face_data export is limited to contact gap/contact pressure in this path.",
      "Tangential traction remains optional external payload or plotfile-side data until the export/bridge path grows native traction logging.",
    ],
  };
}

function buildPlotfileSurfaceTractionSpec(name, surface, interfaceGroup, region, sectionAxes) {
  return {
    name,
    variable: "contact traction",
    surface,
    interfaceGroup,
    region,
    alias: `${name}_contact_traction`,
    payloadPath: `plotfileSurfaceData.${interfaceGroup}.${region}`,
    preferredSource: "native-plotfile-contact-traction",
    sectionAxes: structuredCloneSafe(sectionAxes),
    notes: [
      "Standard FEBio path can bridge solver-native tangential traction from the plotfile contact traction variable.",
      "Bridge payloads should write per-step traction data to the declared payloadPath so converter/import can prefer it over shear proxy fallback.",
    ],
  };
}

function buildInterfaceRegions() {
  return {
    localNc: {
      left: { nucleusNodeSet: "nc_left_nucleus_nodes", cytoplasmNodeSet: "nc_left_cytoplasm_nodes" },
      right: { nucleusNodeSet: "nc_right_nucleus_nodes", cytoplasmNodeSet: "nc_right_cytoplasm_nodes" },
      top: { nucleusNodeSet: "nc_top_nucleus_nodes", cytoplasmNodeSet: "nc_top_cytoplasm_nodes" },
      bottom: { nucleusNodeSet: "nc_bottom_nucleus_nodes", cytoplasmNodeSet: "nc_bottom_cytoplasm_nodes" },
    },
    localCd: {
      left: { cellNodeSet: "cd_left_cell_nodes" },
      center: { cellNodeSet: "cd_center_cell_nodes" },
      right: { cellNodeSet: "cd_right_cell_nodes" },
    },
  };
}

function buildNodeDataOutputSpec(name, file, nodeSet, mapsTo) {
  return {
    name,
    file,
    nodeSet,
    data: "ux;uy;uz",
    mapsTo,
    preferredSource: "native-node-displacement",
  };
}

function buildRigidBodyOutputSpec() {
  return {
    name: "pipette_rigid_body",
    file: "febio_rigid_pipette.csv",
    data: "x;y;z;Fx;Fy;Fz",
    item: "pipette",
    mapsTo: ["history[].pipette", "history[].pipetteCenter", "history[].holdForce", "peaks.peakHoldForce"],
  };
}

function buildCanonicalLogOutputs(outputs) {
  return {
    nodeData: [
      buildNodeDataOutputSpec("nucleus_nodes", "febio_nucleus_nodes.csv", "nucleus", [
        "history[].nucleus",
        "displacements.nucleus",
        "aspiration.length",
      ]),
      buildNodeDataOutputSpec("cytoplasm_nodes", "febio_cytoplasm_nodes.csv", "cytoplasm", [
        "history[].cell",
        "displacements.cell",
        "aspiration.length",
      ]),
      buildNodeDataOutputSpec("pipette_contact_nodes", "febio_pipette_contact_nodes.csv", "pipette_contact_nodes", [
        "history[].pipette",
        "aspiration.reference",
      ]),
    ],
    rigidBodyData: [buildRigidBodyOutputSpec()],
    faceData: structuredCloneSafe(outputs.faceData || []),
    plotfileSurfaceData: structuredCloneSafe(outputs.plotfileSurfaceData || []),
    aspiration: structuredCloneSafe(outputs.aspiration || null),
  };
}

function serializeStickyPenaltyRampComments(stabilization = {}) {
  return (stabilization.ramp || []).map(
    (entry) =>
      `    <!-- ramp ${entry.step}: normalPenalty=${Number(entry.normalPenalty || 0).toFixed(6)} tangentialPenalty=${Number(entry.tangentialPenalty || 0).toFixed(6)} frictionProxy=${Number(entry.frictionProxy || 0).toFixed(6)} -->`,
  );
}

function serializeNumber(value) {
  return Number(value || 0).toFixed(6);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function nodeIdsForElementSet(mesh = {}, setName) {
  const elementIds = new Set(mesh.elementSets?.[setName] || []);
  const ids = new Set();
  (mesh.elements || []).forEach((element) => {
    if (elementIds.has(element.id)) {
      (element.nodes || []).forEach((id) => ids.add(id));
    }
  });
  return [...ids].sort((a, b) => a - b);
}

function resolveNodeIds(mesh = {}, setName) {
  return mesh.nodeSets?.[setName] || nodeIdsForElementSet(mesh, setName);
}

function computeElementCenter(mesh = {}, setName) {
  const ids = resolveNodeIds(mesh, setName);
  const nodes = (mesh.nodes || []).filter((node) => ids.includes(node.id));
  if (!nodes.length) return [0, 0, 0];
  const totals = nodes.reduce(
    (acc, node) => [acc[0] + Number(node.x || 0), acc[1] + Number(node.y || 0), acc[2] + Number(node.z || 0)],
    [0, 0, 0],
  );
  return totals.map((value) => value / nodes.length);
}

function serializeMeshToXml(mesh = {}) {
  const nodeLines = (mesh.nodes || []).map(
    (node) => `      <node id="${node.id}">${serializeNumber(node.x)},${serializeNumber(node.y)},${serializeNumber(node.z)}</node>`,
  );
  const materialElementGroups = Object.entries(mesh.elementSets || {}).flatMap(([material, ids]) => {
    const idSet = new Set(ids || []);
    const elements = (mesh.elements || []).filter((element) => idSet.has(element.id));
    return [
    `    <Elements type="${elements[0]?.type || "hex8"}" name="${material}">`,
    ...elements.map((element) => `      <elem id="${element.id}">${(element.nodes || []).join(",")}</elem>`),
    "    </Elements>",
    ];
  });
  const surfaceLines = Object.entries(mesh.surfaces || {}).flatMap(([name, facets]) => [
    `    <Surface name="${name}">`,
    ...(facets || []).map((facet) => `      <${facet.type || "quad4"} id="${facet.id}">${(facet.nodes || []).join(",")}</${facet.type || "quad4"}>`),
    "    </Surface>",
  ]);
  const surfacePairLines = Object.values(mesh.surfacePairs || {}).flatMap((pair) => [
    `    <SurfacePair name="${pair.name}">`,
    `      <primary>${pair.primary}</primary>`,
    `      <secondary>${pair.secondary}</secondary>`,
    "    </SurfacePair>",
  ]);
  const nodeSetLines = {
    ...Object.fromEntries(
      Object.keys(mesh.elementSets || {}).map((name) => [`${name}_nodes`, nodeIdsForElementSet(mesh, name)]),
    ),
    ...(mesh.nodeSets || {}),
    all_nodes_set: (mesh.nodes || []).map((node) => node.id),
    deformable_nodes_set: (mesh.nodes || [])
      .filter((node) => !resolveNodeIds(mesh, "pipette").includes(node.id))
      .map((node) => node.id),
  };

  return [
    "  <Mesh>",
    "    <Nodes name=\"all_nodes\">",
    ...nodeLines,
    "    </Nodes>",
    ...materialElementGroups,
    ...surfaceLines,
    ...Object.entries(nodeSetLines).flatMap(([name, ids]) => [
      `    <NodeSet name="${name}">${(ids || []).join(",")}</NodeSet>`,
    ]),
    ...surfacePairLines,
    "  </Mesh>",
  ];
}

function serializeMaterialsToXml(materials = {}) {
  return [
    "  <Material>",
    ...Object.values(materials).filter((material) => material.domain).map((material) => [
      `    <material id="${material.id}" name="${material.name}" type="${material.type}">`,
      material.type === "viscoelastic" && material.elastic
        ? `      <elastic type="neo-Hookean">`
        : null,
      material.elastic ? `        <E>${serializeNumber(material.elastic.E)}</E>` : null,
      material.elastic ? `        <v>${serializeNumber(material.elastic.v ?? material.elastic.nu)}</v>` : null,
      material.type === "viscoelastic" && material.elastic
        ? `      </elastic>`
        : null,
      material.viscous ? `      <g1>${serializeNumber(material.viscous.g1)}</g1>` : null,
      material.viscous ? `      <t1>${serializeNumber(material.viscous.t1)}</t1>` : null,
      material.viscous ? `      <!-- viscosity eta=${serializeNumber(material.viscous.eta)} -->` : null,
      material.density != null ? `      <density>${serializeNumber(material.density)}</density>` : null,
      material.centerOfMass ? `      <center_of_mass>${material.centerOfMass.map(serializeNumber).join(",")}</center_of_mass>` : null,
      material.tension != null ? `      <tension>${serializeNumber(material.tension)}</tension>` : null,
      "    </material>",
    ].filter(Boolean)).flat(),
    "  </Material>",
  ];
}

function serializeMeshDomainsToXml(materials = {}) {
  return [
    "  <MeshDomains>",
    ...Object.values(materials)
      .filter((material) => material.domain)
      .map((material) => `    <SolidDomain name="${escapeXml(material.domain)}" mat="${escapeXml(material.name)}" />`),
    "  </MeshDomains>",
  ];
}

function serializeBoundaryToXml(boundary = {}) {
  return [
    "  <Boundary>",
    ...(boundary.fixed || []).flatMap((entry) => [
      `    <bc name="${entry.name}" node_set="${entry.nodeSet}" type="zero displacement">`,
      ...(entry.dofs || []).map((dof) => `      <${dof}_dof>1</${dof}_dof>`),
      "    </bc>",
    ]),
    "    <bc name=\"section_plane_lock\" node_set=\"deformable_nodes_set\" type=\"zero displacement\">",
    "      <y_dof>1</y_dof>",
    "    </bc>",
    "  </Boundary>",
  ];
}

function buildLoadControllerIdMap(loads = {}) {
  return new Map((loads.controllers || []).map((entry, index) => [entry.id, index + 1]));
}

function serializeLoadsToXml(loads = {}) {
  const controllerIdMap = buildLoadControllerIdMap(loads);
  return [
    "  <Loads>",
    ...(loads.nodal || []).map(
      (entry) =>
        `    <!-- nodal_load ${entry.name} surface=${entry.surface} lc=${entry.loadController} status=${entry.status} value=${serializeNumber(entry.value)} -->`,
    ),
    ...(loads.pressure || []).flatMap((entry) => [
      `    <surface_load name="${entry.name}" surface="${entry.surface}" type="pressure">`,
      `      <pressure lc="${controllerIdMap.get(entry.loadController) || entry.loadController}">${serializeNumber(entry.value)}</pressure>`,
      `      <!-- status=${entry.status} unit=${entry.unit || "kPa"} direction=${entry.direction || "normal"} magnitude=${serializeNumber(entry.magnitude ?? Math.abs(entry.value || 0))} -->`,
      "    </surface_load>",
    ]),
    "  </Loads>",
    "  <LoadData>",
    ...(loads.controllers || []).map((entry, index) => [
      `    <load_controller id="${index + 1}" name="${entry.name}" type="loadcurve">`,
      "      <interpolate>LINEAR</interpolate>",
      "      <extend>CONSTANT</extend>",
      "      <points>",
      ...(entry.points || []).map((point) => `        <point>${serializeNumber(point[0])}, ${serializeNumber(point[1])}</point>`),
      "      </points>",
      "    </load_controller>",
    ]).flat(),
    "  </LoadData>",
  ];
}

function serializeStepLoadsToXml(stepName, loads = {}, controllerIdMap = new Map()) {
  if (stepName === "approach") {
    return [];
  }

  return [
    "    <Loads>",
    ...(loads.pressure || []).flatMap((entry) => [
      `      <surface_load name="${entry.name}_${escapeXml(stepName)}" surface="${entry.surface}" type="pressure">`,
      `        <pressure lc="${controllerIdMap.get(entry.loadController) || entry.loadController}">${serializeNumber(entry.value)}</pressure>`,
      `        <!-- active-step pressure source=${entry.name} status=${entry.status} -->`,
      "      </surface_load>",
    ]),
    "    </Loads>",
  ];
}

function serializeLogfileToXml(outputs = {}, mesh = {}) {
  return [
    "    <logfile>",
    ...(outputs.nodeData || []).map(
      (entry) => {
        const itemIds = resolveNodeIds(mesh, entry.nodeSet);
        return `      <node_data name="${entry.name}" file="${entry.file}" data="${entry.data || "ux;uy;uz"}" delim=",">${itemIds.join(",")}</node_data>`;
      },
    ),
    ...(outputs.rigidBodyData || []).map(
      (entry) => `      <rigid_body_data name="${entry.name}" file="${entry.file}" data="${entry.data || "x;y;z;Fx;Fy;Fz"}" delim=",">4</rigid_body_data>`,
    ),
    ...(outputs.faceData || []).map(
      (entry) =>
        `      <face_data name="${entry.name}" file="${entry.file}" data="${entry.logfileData || "contact gap;contact pressure"}" delim="," surface="${entry.surface}" />`,
    ),
    outputs.aspiration
      ? `      <!-- derived_data name="${outputs.aspiration.name}" metric="${outputs.aspiration.metric}" unit="${outputs.aspiration.unit}" payload="${outputs.aspiration.payloadPath}" source="${outputs.aspiration.preferredSource}" -->`
      : null,
    "    </logfile>",
  ].filter(Boolean);
}

function serializeCellDishContactToXml(cellDish = {}) {
  return [
    `    <contact name="cell_dish_interface" type="${cellDish.type}" surface_pair="${cellDish.surfacePair?.name || "cell_dish_pair"}">`,
    `      <penalty>${serializeNumber(cellDish.normalStiffness)}</penalty>`,
    "      <tolerance>0.050000</tolerance>",
    `      <!-- cohesive-ready normalStiffness=${serializeNumber(cellDish.normalStiffness)} tangentialStiffness=${serializeNumber(cellDish.tangentialStiffness)} -->`,
    `      <!-- cohesive-ready criticalNormalStress=${serializeNumber(cellDish.criticalNormalStress)} criticalShearStress=${serializeNumber(cellDish.criticalShearStress)} fractureEnergy=${serializeNumber(cellDish.fractureEnergy)} -->`,
    "    </contact>",
  ];
}

function serializeSlidingContactToXml(name, spec = {}) {
  return [
    `    <contact name="${escapeXml(name)}" type="${escapeXml(spec.type || "sliding-elastic")}" surface_pair="${escapeXml(spec.surfacePair?.name || "")}">`,
    `      <penalty>${serializeNumber(spec.penalty || 1)}</penalty>`,
    `      <auto_penalty>${spec.autoPenalty ? 1 : 0}</auto_penalty>`,
    "      <two_pass>0</two_pass>",
    "      <laugon>0</laugon>",
    `      <tolerance>${serializeNumber(spec.tolerance || 0.2)}</tolerance>`,
    `      <search_tol>${serializeNumber(spec.searchTolerance || 0.01)}</search_tol>`,
    `      <search_radius>${serializeNumber(spec.searchRadius || 1)}</search_radius>`,
    `      <symmetric_stiffness>${spec.symmetricStiffness ? 1 : 0}</symmetric_stiffness>`,
    `      <fric_coeff>${serializeNumber(spec.friction || 0)}</fric_coeff>`,
    `      <!-- status=${escapeXml(spec.status || "n/a")} mode=${escapeXml(spec.mode || "n/a")} -->`,
    "    </contact>",
  ];
}

function serializeStickyContactToXml(name, spec = {}) {
  return [
    `    <contact name="${escapeXml(name)}" type="sticky" surface_pair="${escapeXml(spec.surfacePair?.name || "")}">`,
    `      <penalty>${serializeNumber(spec.penalty || 1)}</penalty>`,
    "      <laugon>0</laugon>",
    `      <tolerance>${serializeNumber(spec.tolerance || 0.2)}</tolerance>`,
    "      <minaug>0</minaug>",
    "      <maxaug>10</maxaug>",
    `      <search_tolerance>${serializeNumber(spec.searchTolerance || 0.01)}</search_tolerance>`,
    `      <max_traction>${serializeNumber(spec.maxTraction || 0)}</max_traction>`,
    `      <snap_tol>${serializeNumber(spec.snapTolerance || 0.1)}</snap_tol>`,
    `      <!-- solver-active pipette capture-hold contact status=${escapeXml(spec.status || "n/a")} friction=${serializeNumber(spec.friction || 0)} releaseTraction=${serializeNumber(spec.releaseCondition?.tractionLimit || spec.maxTraction || 0)} slipDistance=${serializeNumber(spec.releaseCondition?.slipDistance || 0)} -->`,
    "    </contact>",
  ];
}

function serializeCanonicalSpec(inputSpec) {
  return {
    caseName: inputSpec.caseName,
    params: structuredCloneSafe(inputSpec.params),
    parameterDigest: inputSpec.parameterDigest,
    coordinates: structuredCloneSafe(inputSpec.coordinates || COORDINATE_SYSTEM_SPEC),
    geometry: structuredCloneSafe(inputSpec.geometry),
    material: structuredCloneSafe(inputSpec.material),
    interfaces: structuredCloneSafe(inputSpec.interfaces),
    membrane: structuredCloneSafe(inputSpec.membrane),
    membraneModel: inputSpec.membraneModel,
    operation: structuredCloneSafe(inputSpec.operation),
    adhesionPattern: inputSpec.adhesionPattern,
    adhesionSeed: inputSpec.adhesionSeed,
    validationReport: structuredCloneSafe(inputSpec.validationReport),
    parameterTable: structuredCloneSafe(inputSpec.parameterTable),
  };
}

export function buildFebioTemplateData(inputSpec) {
  const mesh = buildRefinedFebioGeometry(inputSpec);
  const meshValidation = validateFebioMesh(mesh);
  const membraneModel = buildMembraneModelSpec(inputSpec);
  const nucleusCytoplasm = buildNucleusCytoplasmInterfaceSpec(inputSpec, mesh);
  const cellDish = buildCellDishInterfaceSpec(inputSpec, mesh);
  const contact = buildPipetteContactSpec(inputSpec, mesh);
  const boundary = buildBoundarySpec(inputSpec, mesh);
  const loads = buildLoadSpec(inputSpec);
  const outputs = {
    faceData: [
      buildFaceDataOutputSpec(
        "nucleus_cytoplasm_interface_surface",
        "febio_interface_nucleus_cytoplasm.csv",
        "nucleus_interface_surface",
      ),
      buildFaceDataOutputSpec(
        "nucleus_cytoplasm_left_surface",
        "febio_interface_nc_left.csv",
        "nucleus_interface_left_surface",
      ),
      buildFaceDataOutputSpec(
        "nucleus_cytoplasm_right_surface",
        "febio_interface_nc_right.csv",
        "nucleus_interface_right_surface",
      ),
      buildFaceDataOutputSpec(
        "nucleus_cytoplasm_top_surface",
        "febio_interface_nc_top.csv",
        "nucleus_interface_top_surface",
      ),
      buildFaceDataOutputSpec(
        "nucleus_cytoplasm_bottom_surface",
        "febio_interface_nc_bottom.csv",
        "nucleus_interface_bottom_surface",
      ),
      buildFaceDataOutputSpec(
        "cell_dish_interface_surface",
        "febio_interface_cell_dish.csv",
        "cell_dish_surface",
      ),
      buildFaceDataOutputSpec(
        "cell_dish_left_surface",
        "febio_interface_cd_left.csv",
        "cell_dish_left_surface",
      ),
      buildFaceDataOutputSpec(
        "cell_dish_center_surface",
        "febio_interface_cd_center.csv",
        "cell_dish_center_surface",
      ),
      buildFaceDataOutputSpec(
        "cell_dish_right_surface",
        "febio_interface_cd_right.csv",
        "cell_dish_right_surface",
      ),
      buildFaceDataOutputSpec(
        "pipette_contact_surface",
        "febio_pipette_contact.csv",
        "pipette_contact_surface",
        {
          normal: "native-face-data-preferred",
          damage: "proxy-fallback-explicit",
          shear: "not-used",
        },
      ),
    ],
    plotfileSurfaceData: [
      buildPlotfileSurfaceTractionSpec(
        "nucleus_cytoplasm_left_surface",
        "nucleus_interface_left_surface",
        "localNc",
        "left",
        { normal: "x", tangential: "z" },
      ),
      buildPlotfileSurfaceTractionSpec(
        "nucleus_cytoplasm_right_surface",
        "nucleus_interface_right_surface",
        "localNc",
        "right",
        { normal: "x", tangential: "z" },
      ),
      buildPlotfileSurfaceTractionSpec(
        "nucleus_cytoplasm_top_surface",
        "nucleus_interface_top_surface",
        "localNc",
        "top",
        { normal: "z", tangential: "x" },
      ),
      buildPlotfileSurfaceTractionSpec(
        "nucleus_cytoplasm_bottom_surface",
        "nucleus_interface_bottom_surface",
        "localNc",
        "bottom",
        { normal: "z", tangential: "x" },
      ),
      buildPlotfileSurfaceTractionSpec(
        "cell_dish_left_surface",
        "cell_dish_left_surface",
        "localCd",
        "left",
        { normal: "z", tangential: "x" },
      ),
      buildPlotfileSurfaceTractionSpec(
        "cell_dish_center_surface",
        "cell_dish_center_surface",
        "localCd",
        "center",
        { normal: "z", tangential: "x" },
      ),
      buildPlotfileSurfaceTractionSpec(
        "cell_dish_right_surface",
        "cell_dish_right_surface",
        "localCd",
        "right",
        { normal: "z", tangential: "x" },
      ),
    ],
    detachment: buildDetachmentOutputContract(),
    aspiration: buildAspirationOutputContract(inputSpec, mesh),
  };
  const logOutputs = buildCanonicalLogOutputs(outputs);

  return {
    status: {
      buildMode: mesh.meshMode || "refined",
      isPlaceholder: false,
      meshValidated: meshValidation.valid,
      interfaceValidated: nucleusCytoplasm.validation?.valid ?? false,
      membraneModel: membraneModel.type,
      notes: [
        ...membraneModel.notes,
        ...nucleusCytoplasm.notes,
        "nucleus/cytoplasm viscoelastic terms are serialized as a single-branch FEBio viscoelastic approximation",
        "nucleus/cytoplasm is solver-primary as a sticky cohesive approximation; cell-dish remains tied-elastic-active",
        "release-test step is disabled in the main flow until the hold/release law is stabilized",
        "main-flow inward manipulation is split into staged targets to reduce the first-step jacobian collapse risk",
        "discrete cohesive spring sidecar sets are exported for future solver-primary cohesive activation",
        "P_hold is solver-active suction pressure; prescribed pipette motion remains positioning control",
        "pipette-nucleus and pipette-cell contact pairs are solver-active in the main flow",
        "aspiration length L(t) is declared as a native-or-postprocessed output contract",
      ],
    },
    parameterDigest: inputSpec.parameterDigest,
    coordinateSystem: structuredCloneSafe(inputSpec.coordinates || COORDINATE_SYSTEM_SPEC),
    geometry: {
      mesh,
      meshValidation,
      nucleus: {
        shape: "ellipse",
        width: inputSpec.geometry.Ln,
        height: inputSpec.geometry.Hn,
        center: { x: inputSpec.geometry.xn, z: inputSpec.geometry.yn },
      },
      cytoplasm: {
        shape: "cap",
        width: inputSpec.geometry.Lc,
        height: inputSpec.geometry.Hc,
        dishZ: 0,
      },
      membrane: {
        attachment: "cytoplasm_outer_surface",
        model: membraneModel.type,
        status: membraneModel.status,
        thresholds: structuredCloneSafe(membraneModel.thresholds),
      },
      pipette: {
        radius: inputSpec.geometry.rp,
        puncture: { x: inputSpec.geometry.xp, z: inputSpec.geometry.zp },
      },
    },
    materials: {
      nucleus: {
        id: 1,
        ...buildViscoelasticMaterialSpec(
          "nucleus",
          "nucleus",
          { E: inputSpec.material.En, nu: inputSpec.material.nun },
          { eta: inputSpec.material.etan },
          { alpha: inputSpec.material.alpha_nonlinear },
        ),
      },
      cytoplasm: {
        id: 2,
        ...buildViscoelasticMaterialSpec(
          "cytoplasm",
          "cytoplasm",
          { E: inputSpec.material.Ec, nu: inputSpec.material.nuc },
          { eta: inputSpec.material.etac },
        ),
      },
      dish: {
        id: 3,
        name: "dish",
        type: "neo-Hookean",
        domain: "dish",
        elastic: { E: 250, v: 0.3 },
      },
      pipette: {
        id: 4,
        name: "pipette_rigid",
        type: "rigid body",
        domain: "pipette",
        density: 1,
        centerOfMass: computeElementCenter(mesh, "pipette"),
        elastic: { E: 600, v: 0.25 },
      },
      membrane: {
        id: 5,
        name: "membrane",
        type: membraneModel.type,
        status: membraneModel.status,
        tension: membraneModel.tension,
      },
    },
    interfaces: {
      nucleusCytoplasm,
      cellDish,
    },
    contact,
    interfaceRegions: buildInterfaceRegions(),
    boundary,
    loads,
    steps: [
      { id: 1, name: "approach" },
      { id: 2, name: "hold" },
      { id: 3, name: "lift" },
      { id: 4, name: "manipulation-1" },
      { id: 5, name: "manipulation-2" },
    ],
    outputs,
    logOutputs,
    discreteCohesive: {
      nucleusCytoplasm: {
        type: "discrete-cohesive-springs",
        status: "implemented-sidecar / not solver-primary",
      },
    },
  };
}

export function serializeFebioTemplateToXml(templateData) {
  const nucleusCytoplasm = templateData.interfaces.nucleusCytoplasm;
  const stabilization = nucleusCytoplasm.stabilization || {};
  const mesh = templateData.geometry?.mesh || {};
  const logfileOutputs = templateData.logOutputs || {};
  const controllerIdMap = buildLoadControllerIdMap(templateData.loads);
  const plotfileSurfaceTractionXml = (templateData.outputs?.plotfileSurfaceData || [])
    .map(
      (entry) =>
        `      <var type="${entry.variable}" surface="${entry.surface}"/>`,
    )
    .join("\n");
  const stepMotion = new Map([
    ["approach", { x: 0, z: -0.35, steps: 60 }],
    ["hold", { x: 0, z: 0, steps: 40 }],
    ["lift", { x: 0, z: templateData.boundary?.prescribed?.find((entry) => entry.name === "pipette_lift_z")?.value || 0, steps: 60, zController: 101 }],
    ["manipulation-1", { x: -((templateData.boundary?.prescribed?.find((entry) => entry.name === "pipette_inward_x")?.value || 0) * 0.45), z: 0, steps: 90, xController: 102 }],
    ["manipulation-2", { x: -((templateData.boundary?.prescribed?.find((entry) => entry.name === "pipette_inward_x")?.value || 0) * 0.55), z: 0, steps: 100, xController: 102 }],
  ]);
  const stepXml = (templateData.steps || []).flatMap((step, index) => {
    const motion = stepMotion.get(step.name) || { x: 0, z: 0, steps: 25 };
    const stepSize = motion.steps ? 1 / motion.steps : 0.04;
    return [
      `    <step id="${step.id || index + 1}" name="${escapeXml(step.name)}">`,
      "    <Control>",
      "      <analysis>static</analysis>",
      `      <time_steps>${Number(motion.steps || 25).toFixed(0)}</time_steps>`,
      `      <step_size>${serializeNumber(stepSize)}</step_size>`,
      "      <plot_level>PLOT_MAJOR_ITRS</plot_level>",
      "      <output_level>OUTPUT_MAJOR_ITRS</output_level>",
      "      <solver>",
      "        <symmetric_stiffness>0</symmetric_stiffness>",
      "      </solver>",
      "    </Control>",
      "    <Rigid>",
      "      <rigid_bc type=\"rigid_displacement\">",
      "        <rb>pipette_rigid</rb>",
      "        <dof>x</dof>",
      `        <value${motion.xController ? ` lc="${controllerIdMap.get(motion.xController) || motion.xController}"` : ""}>${serializeNumber(motion.x)}</value>`,
      "        <relative>1</relative>",
      "      </rigid_bc>",
      "      <rigid_bc type=\"rigid_displacement\">",
      "        <rb>pipette_rigid</rb>",
      "        <dof>z</dof>",
      `        <value${motion.zController ? ` lc="${controllerIdMap.get(motion.zController) || motion.zController}"` : ""}>${serializeNumber(motion.z)}</value>`,
      "        <relative>1</relative>",
      "      </rigid_bc>",
      "    </Rigid>",
      ...serializeStepLoadsToXml(step.name, templateData.loads, controllerIdMap),
      "    </step>",
    ];
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<febio_spec version="4.0">',
    '  <Module type="solid" />',
    ...serializeMaterialsToXml(templateData.materials),
    ...serializeMeshToXml(mesh),
    ...serializeMeshDomainsToXml(templateData.materials),
    ...serializeBoundaryToXml(templateData.boundary),
    "  <Contact>",
    '    <contact name="nucleus_cytoplasm_interface" type="sticky" surface_pair="nucleus_cytoplasm_pair">',
    "      <!-- solver-primary cohesive approximation -->",
    `      <penalty>${Number(nucleusCytoplasm.penalty.Kn).toFixed(6)}</penalty>`,
    `      <tolerance>${Number(nucleusCytoplasm.tolerance || stabilization.searchTolerance || 0).toFixed(6)}</tolerance>`,
    `      <search_tolerance>${Number(stabilization.searchTolerance || nucleusCytoplasm.tolerance || 0).toFixed(6)}</search_tolerance>`,
    `      <laugon>${stabilization.augmentation?.enabled ? 1 : 0}</laugon>`,
    `      <minaug>${Number(stabilization.augmentation?.minPasses || 0).toFixed(0)}</minaug>`,
    `      <maxaug>${Number(stabilization.augmentation?.maxPasses || 0).toFixed(0)}</maxaug>`,
    `      <max_traction>${Number(nucleusCytoplasm.cohesiveApproximation.maxTraction || nucleusCytoplasm.criticalNormalStress || 0).toFixed(6)}</max_traction>`,
    `      <snap_tol>${Number(nucleusCytoplasm.cohesiveApproximation.snapTolerance).toFixed(6)}</snap_tol>`,
    `      <!-- cohesive criticalNormalStress=${Number(templateData.interfaces.nucleusCytoplasm.criticalNormalStress).toFixed(6)} -->`,
    ...serializeStickyPenaltyRampComments(stabilization).map((line) => line.replace("    <!--", "      <!--")),
    "    </contact>",
    ...serializeCellDishContactToXml(templateData.interfaces.cellDish),
    ...(templateData.contact?.pipetteNucleus?.type === "sticky"
      ? serializeStickyContactToXml("pipette_nucleus_contact", templateData.contact.pipetteNucleus)
      : serializeSlidingContactToXml("pipette_nucleus_contact", templateData.contact?.pipetteNucleus)),
    ...serializeSlidingContactToXml("pipette_cell_contact", templateData.contact?.pipetteCell),
    "  </Contact>",
    "  <Rigid>",
    "    <rigid_bc type=\"rigid_fixed\">",
    "      <rb>pipette_rigid</rb>",
    "      <Ry_dof>1</Ry_dof>",
    "      <Ru_dof>1</Ru_dof>",
    "      <Rv_dof>1</Rv_dof>",
    "      <Rw_dof>1</Rw_dof>",
    "    </rigid_bc>",
    "  </Rigid>",
    ...serializeLoadsToXml(templateData.loads),
    "  <Step>",
    ...stepXml,
    "  </Step>",
    "  <Output>",
    ...serializeLogfileToXml(logfileOutputs, mesh),
    '    <plotfile type="febio">',
    '      <var type="displacement" />',
    '      <var type="stress" />',
    '      <var type="contact force" />',
    '      <var type="reaction forces" />',
    ...(plotfileSurfaceTractionXml ? [plotfileSurfaceTractionXml] : []),
    "    </plotfile>",
    "  </Output>",
    "  <!-- cohesive discrete sidecar (not solver-active yet)",
    '  <DiscreteSet name="nucleus_cytoplasm_left_springs">',
    "  </DiscreteSet>",
    "  discrete_material nucleus_cytoplasm_left_springs_material type=nonlinear spring",
    "  load_controller 300 points=",
    "  -->",
    "</febio_spec>",
  ].join("\n");
}

export function buildFebioRunBundle(inputSpec) {
  const febioTemplateData = inputSpec.febioTemplateData || buildFebioTemplateData(inputSpec);
  const febXml = serializeFebioTemplateToXml(febioTemplateData);
  const exportReady = Boolean(inputSpec.validationReport?.valid && febioTemplateData.geometry.meshValidation.valid);

  return {
    parameterDigest: inputSpec.parameterDigest,
    canonicalSpec: serializeCanonicalSpec(inputSpec),
    templateData: febioTemplateData,
    febXml,
    expectedOutputs: buildExpectedFebioOutputs(inputSpec.caseName),
    eventContract: {
      detachment: structuredCloneSafe(febioTemplateData.outputs.detachment),
    },
    validation: {
      mesh: structuredCloneSafe(febioTemplateData.geometry.meshValidation),
      nucleusCytoplasm: structuredCloneSafe(febioTemplateData.interfaces.nucleusCytoplasm.validation),
    },
    exportTimestamp: new Date().toISOString(),
    exportReady,
    solverMetadata: {
      solverMode: "febio",
      source: "febio-export-bundle",
    },
  };
}

export function buildFebioInputSpec(caseName, params, inputSpec = buildSimulationInput(caseName, params)) {
  return {
    ...inputSpec,
    febioTemplateData: buildFebioTemplateData(inputSpec),
    solverMetadata: {
      solverMode: "febio",
      source: "febio-export-bundle",
    },
  };
}
