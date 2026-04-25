function serializeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(6) : "0.000000";
}

function escapeXml(value) {
  return String(value ?? "")
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
    if (elementIds.has(element.id)) (element.nodes || []).forEach((id) => ids.add(id));
  });
  return [...ids].sort((a, b) => a - b);
}

function resolveNodeIds(mesh = {}, setName) {
  return mesh.nodeSets?.[setName] || nodeIdsForElementSet(mesh, setName);
}

function serializeMaterialsToXml(materials = {}) {
  return [
    "  <Material>",
    ...Object.values(materials).filter((material) => material.domain).map((material) => [
      `    <material id="${material.id}" name="${material.name}" type="${material.type}">`,
      material.type === "viscoelastic" && material.elastic ? "      <elastic type=\"neo-Hookean\">" : null,
      material.elastic ? `        <E>${serializeNumber(material.elastic.E)}</E>` : null,
      material.elastic ? `        <v>${serializeNumber(material.elastic.v ?? material.elastic.nu)}</v>` : null,
      material.type === "viscoelastic" && material.elastic ? "      </elastic>" : null,
      material.viscous ? `      <g1>${serializeNumber(material.viscous.g1)}</g1>` : null,
      material.viscous ? `      <t1>${serializeNumber(material.viscous.t1)}</t1>` : null,
      material.viscous ? `      <!-- viscosity eta=${serializeNumber(material.viscous.eta)} -->` : null,
      material.density != null ? `      <density>${serializeNumber(material.density)}</density>` : null,
      material.centerOfMass ? `      <center_of_mass>${material.centerOfMass.map(serializeNumber).join(",")}</center_of_mass>` : null,
      "    </material>"
    ].filter(Boolean)).flat(),
    "  </Material>"
  ];
}

function serializeMeshToXml(mesh = {}) {
  const nodeSetLines = {
    ...Object.fromEntries(Object.keys(mesh.elementSets || {}).map((name) => [`${name}_nodes`, nodeIdsForElementSet(mesh, name)])),
    ...(mesh.nodeSets || {}),
    all_nodes_set: (mesh.nodes || []).map((node) => node.id),
    deformable_nodes_set: (mesh.nodes || []).filter((node) => !resolveNodeIds(mesh, "pipette").includes(node.id)).map((node) => node.id)
  };
  return [
    "  <Mesh>",
    "    <Nodes name=\"all_nodes\">",
    ...(mesh.nodes || []).map((node) => `      <node id="${node.id}">${serializeNumber(node.x)},${serializeNumber(node.y)},${serializeNumber(node.z)}</node>`),
    "    </Nodes>",
    ...Object.entries(mesh.elementSets || {}).flatMap(([material, ids]) => {
      const idSet = new Set(ids || []);
      const elements = (mesh.elements || []).filter((element) => idSet.has(element.id));
      return [
        `    <Elements type="${elements[0]?.type || "hex8"}" name="${material}">`,
        ...elements.map((element) => `      <elem id="${element.id}">${(element.nodes || []).join(",")}</elem>`),
        "    </Elements>"
      ];
    }),
    ...Object.entries(mesh.surfaces || {}).flatMap(([name, facets]) => [
      `    <Surface name="${name}">`,
      ...(facets || []).map((facet) => `      <${facet.type || "quad4"} id="${facet.id}">${(facet.nodes || []).join(",")}</${facet.type || "quad4"}>`),
      "    </Surface>"
    ]),
    ...Object.entries(nodeSetLines).map(([name, ids]) => `    <NodeSet name="${name}">${(ids || []).join(",")}</NodeSet>`),
    ...Object.values(mesh.surfacePairs || {}).flatMap((pair) => [
      `    <SurfacePair name="${pair.name}">`,
      `      <primary>${pair.primary}</primary>`,
      `      <secondary>${pair.secondary}</secondary>`,
      "    </SurfacePair>"
    ]),
    "  </Mesh>"
  ];
}

function serializeMeshDomainsToXml(materials = {}) {
  return [
    "  <MeshDomains>",
    ...Object.values(materials).filter((material) => material.domain).map((material) => `    <SolidDomain name="${escapeXml(material.domain)}" mat="${escapeXml(material.name)}" />`),
    "  </MeshDomains>"
  ];
}

function serializeBoundaryToXml(boundary = {}) {
  return [
    "  <Boundary>",
    ...(boundary.fixed || []).flatMap((entry) => [
      `    <bc name="${entry.name}" node_set="${entry.nodeSet}" type="zero displacement">`,
      ...(entry.dofs || []).map((dof) => `      <${dof}_dof>1</${dof}_dof>`),
      "    </bc>"
    ]),
    "    <bc name=\"section_plane_lock\" node_set=\"deformable_nodes_set\" type=\"zero displacement\">",
    "      <y_dof>1</y_dof>",
    "    </bc>",
    "  </Boundary>"
  ];
}

function buildLoadControllerIdMap(loads = {}) {
  return new Map((loads.controllers || []).map((entry, index) => [entry.id, index + 1]));
}

function serializeLoadsToXml(loads = {}) {
  const controllerIdMap = buildLoadControllerIdMap(loads);
  return [
    "  <Loads>",
    ...(loads.nodal || []).map((entry) => `    <!-- nodal_load ${entry.name} surface=${entry.surface} lc=${entry.loadController} status=${entry.status} value=${serializeNumber(entry.value)} -->`),
    ...(loads.pressure || []).flatMap((entry) => [
      `    <surface_load name="${entry.name}" surface="${entry.surface}" type="pressure">`,
      `      <pressure lc="${controllerIdMap.get(entry.loadController) || entry.loadController}">${serializeNumber(entry.value)}</pressure>`,
      `      <!-- status=${entry.status} unit=${entry.unit || "kPa"} direction=${entry.direction || "normal"} magnitude=${serializeNumber(entry.magnitude ?? Math.abs(entry.value || 0))} -->`,
      "    </surface_load>"
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
      "    </load_controller>"
    ]).flat(),
    "  </LoadData>"
  ];
}

function serializeStepLoadsToXml(stepName, loads = {}, controllerIdMap = new Map()) {
  if (stepName === "approach") return [];
  return [
    "    <Loads>",
    ...(loads.pressure || []).flatMap((entry) => [
      `      <surface_load name="${entry.name}_${escapeXml(stepName)}" surface="${entry.surface}" type="pressure">`,
      `        <pressure lc="${controllerIdMap.get(entry.loadController) || entry.loadController}">${serializeNumber(entry.value)}</pressure>`,
      `        <!-- active-step pressure source=${entry.name} status=${entry.status} -->`,
      "      </surface_load>"
    ]),
    "    </Loads>"
  ];
}

function serializeContactToXml(model) {
  const nc = model.interfaces.nucleusCytoplasm;
  const stabilization = nc.stabilization || {};
  const pn = model.contact.pipetteNucleus;
  const pc = model.contact.pipetteCell;
  const cd = model.interfaces.cellDish;
  return [
    "  <Contact>",
    "    <contact name=\"nucleus_cytoplasm_interface\" type=\"sticky\" surface_pair=\"nucleus_cytoplasm_pair\">",
    "      <!-- solver-primary cohesive approximation -->",
    `      <penalty>${serializeNumber(nc.penalty.Kn)}</penalty>`,
    `      <tolerance>${serializeNumber(nc.tolerance || stabilization.searchTolerance || 0)}</tolerance>`,
    `      <search_tolerance>${serializeNumber(stabilization.searchTolerance || nc.tolerance || 0)}</search_tolerance>`,
    `      <laugon>${stabilization.augmentation?.enabled ? 1 : 0}</laugon>`,
    `      <minaug>${Number(stabilization.augmentation?.minPasses || 0).toFixed(0)}</minaug>`,
    `      <maxaug>${Number(stabilization.augmentation?.maxPasses || 0).toFixed(0)}</maxaug>`,
    `      <max_traction>${serializeNumber(nc.cohesiveApproximation.maxTraction || nc.criticalNormalStress || 0)}</max_traction>`,
    `      <snap_tol>${serializeNumber(nc.cohesiveApproximation.snapTolerance)}</snap_tol>`,
    `      <!-- cohesive criticalNormalStress=${serializeNumber(nc.criticalNormalStress)} -->`,
    ...(stabilization.ramp || []).map((entry) => `      <!-- ramp ${entry.step}: normalPenalty=${serializeNumber(entry.normalPenalty)} tangentialPenalty=${serializeNumber(entry.tangentialPenalty)} frictionProxy=${serializeNumber(entry.frictionProxy)} -->`),
    "    </contact>",
    `    <contact name="cell_dish_interface" type="${cd.type}" surface_pair="${cd.surfacePair?.name || "cell_dish_pair"}">`,
    `      <penalty>${serializeNumber(cd.normalStiffness)}</penalty>`,
    "      <tolerance>0.050000</tolerance>",
    `      <!-- cohesive-ready normalStiffness=${serializeNumber(cd.normalStiffness)} tangentialStiffness=${serializeNumber(cd.tangentialStiffness)} -->`,
    `      <!-- cohesive-ready criticalNormalStress=${serializeNumber(cd.criticalNormalStress)} criticalShearStress=${serializeNumber(cd.criticalShearStress)} fractureEnergy=${serializeNumber(cd.fractureEnergy)} -->`,
    "    </contact>",
    `    <contact name="pipette_nucleus_contact" type="sticky" surface_pair="${pn.surfacePair?.name || ""}">`,
    `      <penalty>${serializeNumber(pn.penalty)}</penalty>`,
    "      <laugon>0</laugon>",
    `      <tolerance>${serializeNumber(pn.tolerance)}</tolerance>`,
    "      <minaug>0</minaug>",
    "      <maxaug>10</maxaug>",
    `      <search_tolerance>${serializeNumber(pn.searchTolerance)}</search_tolerance>`,
    `      <max_traction>${serializeNumber(pn.maxTraction)}</max_traction>`,
    `      <snap_tol>${serializeNumber(pn.snapTolerance)}</snap_tol>`,
    `      <!-- solver-active pipette capture-hold contact status=${escapeXml(pn.status)} friction=${serializeNumber(pn.friction)} releaseTraction=${serializeNumber(pn.releaseCondition?.tractionLimit)} slipDistance=${serializeNumber(pn.releaseCondition?.slipDistance)} -->`,
    "    </contact>",
    `    <contact name="pipette_cell_contact" type="${pc.type}" surface_pair="${pc.surfacePair?.name || ""}">`,
    `      <penalty>${serializeNumber(pc.penalty)}</penalty>`,
    `      <auto_penalty>${pc.autoPenalty ? 1 : 0}</auto_penalty>`,
    "      <two_pass>0</two_pass>",
    "      <laugon>0</laugon>",
    `      <tolerance>${serializeNumber(pc.tolerance)}</tolerance>`,
    `      <search_tol>${serializeNumber(pc.searchTolerance)}</search_tol>`,
    `      <search_radius>${serializeNumber(pc.searchRadius)}</search_radius>`,
    `      <symmetric_stiffness>${pc.symmetricStiffness ? 1 : 0}</symmetric_stiffness>`,
    `      <fric_coeff>${serializeNumber(pc.friction)}</fric_coeff>`,
    `      <!-- status=${escapeXml(pc.status)} mode=${escapeXml(pc.mode)} -->`,
    "    </contact>",
    "  </Contact>"
  ];
}

function serializeLogfileToXml(outputs = {}, mesh = {}) {
  return [
    "    <logfile>",
    ...(outputs.nodeData || []).map((entry) => `      <node_data name="${entry.name}" file="${entry.file}" data="${entry.data || "ux;uy;uz"}" delim=",">${resolveNodeIds(mesh, entry.nodeSet).join(",")}</node_data>`),
    ...(outputs.rigidBodyData || []).map((entry) => `      <rigid_body_data name="${entry.name}" file="${entry.file}" data="${entry.data || "x;y;z;Fx;Fy;Fz"}" delim=",">4</rigid_body_data>`),
    ...(outputs.faceData || []).map((entry) => `      <face_data name="${entry.name}" file="${entry.file}" data="${entry.logfileData || "contact gap;contact pressure"}" delim="," surface="${entry.surface}" />`),
    outputs.aspiration ? `      <!-- derived_data name="${outputs.aspiration.name}" metric="${outputs.aspiration.metric}" unit="${outputs.aspiration.unit}" payload="${outputs.aspiration.payloadPath}" source="${outputs.aspiration.preferredSource}" -->` : null,
    "    </logfile>"
  ].filter(Boolean);
}

export function serializeNativeModelToFebioXml(model) {
  const mesh = model.geometry?.mesh || {};
  const controllerIdMap = buildLoadControllerIdMap(model.loads);
  const plotfileSurfaceTractionXml = (model.outputs?.plotfileSurfaceData || []).map((entry) => `      <var type="${entry.variable}" surface="${entry.surface}"/>`).join("\n");
  const lift = model.boundary?.prescribed?.find((entry) => entry.name === "pipette_lift_z")?.value || 0;
  const inward = model.boundary?.prescribed?.find((entry) => entry.name === "pipette_inward_x")?.value || 0;
  const stepMotion = new Map([
    ["approach", { x: 0, z: -0.35, steps: 60 }],
    ["hold", { x: 0, z: 0, steps: 40 }],
    ["lift", { x: 0, z: lift, steps: 60, zController: 101 }],
    ["manipulation-1", { x: -(inward * 0.45), z: 0, steps: 90, xController: 102 }],
    ["manipulation-2", { x: -(inward * 0.55), z: 0, steps: 100, xController: 102 }]
  ]);
  const stepXml = (model.steps || []).flatMap((step, index) => {
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
      ...serializeStepLoadsToXml(step.name, model.loads, controllerIdMap),
      "    </step>"
    ];
  });

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<febio_spec version=\"4.0\">",
    "  <Module type=\"solid\" />",
    ...serializeMaterialsToXml(model.materials),
    ...serializeMeshToXml(mesh),
    ...serializeMeshDomainsToXml(model.materials),
    ...serializeBoundaryToXml(model.boundary),
    ...serializeContactToXml(model),
    "  <Rigid>",
    "    <rigid_bc type=\"rigid_fixed\">",
    "      <rb>pipette_rigid</rb>",
    "      <Ry_dof>1</Ry_dof>",
    "      <Ru_dof>1</Ru_dof>",
    "      <Rv_dof>1</Rv_dof>",
    "      <Rw_dof>1</Rw_dof>",
    "    </rigid_bc>",
    "  </Rigid>",
    ...serializeLoadsToXml(model.loads),
    "  <Step>",
    ...stepXml,
    "  </Step>",
    "  <Output>",
    ...serializeLogfileToXml(model.logOutputs, mesh),
    "    <plotfile type=\"febio\">",
    "      <var type=\"displacement\" />",
    "      <var type=\"stress\" />",
    "      <var type=\"contact force\" />",
    "      <var type=\"reaction forces\" />",
    ...(plotfileSurfaceTractionXml ? [plotfileSurfaceTractionXml] : []),
    "    </plotfile>",
    "  </Output>",
    "  <!-- native-only cohesive discrete sidecar (not solver-active yet) -->",
    "</febio_spec>"
  ].join("\n");
}
