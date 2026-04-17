function createFebioMeshBuilder(thickness) {
  const nodes = [];
  const elements = [];
  const surfaces = {};
  const nodeSets = {};
  const elementSets = {};
  const surfacePairs = {};
  const nodeLookup = new Map();
  let nextElementId = 1;
  let nextSurfaceFacetId = 1;

  function keyForNode(x, y, z, nodeGroup) {
    return [nodeGroup || "global", x, y, z]
      .map((value) => (typeof value === "number" ? Number(value).toFixed(6) : String(value)))
      .join("|");
  }

  function addNode(x, y, z, nodeGroup = "global") {
    const key = keyForNode(x, y, z, nodeGroup);
    if (nodeLookup.has(key)) {
      return nodeLookup.get(key);
    }
    const id = nodes.length + 1;
    nodes.push({ id, x, y, z });
    nodeLookup.set(key, id);
    return id;
  }

  function addToSet(collection, name, ids) {
    if (!name) {
      return;
    }
    if (!collection[name]) {
      collection[name] = new Set();
    }
    ids.forEach((id) => collection[name].add(id));
  }

  function addSurfaceFacet(name, type, nodeIds) {
    if (!name) {
      return;
    }
    if (!surfaces[name]) {
      surfaces[name] = [];
    }
    surfaces[name].push({ id: nextSurfaceFacetId++, type, nodes: nodeIds });
  }

  function addHexBlock(partName, x0, x1, z0, z1, metadata = {}) {
    if (Math.abs(x1 - x0) < 1e-6 || Math.abs(z1 - z0) < 1e-6) {
      return null;
    }
    const y0 = -thickness / 2;
    const y1 = thickness / 2;
    const nodeGroup = metadata.nodeGroup || partName;
    const nodeIds = [
      addNode(x0, y0, z0, nodeGroup),
      addNode(x1, y0, z0, nodeGroup),
      addNode(x1, y1, z0, nodeGroup),
      addNode(x0, y1, z0, nodeGroup),
      addNode(x0, y0, z1, nodeGroup),
      addNode(x1, y0, z1, nodeGroup),
      addNode(x1, y1, z1, nodeGroup),
      addNode(x0, y1, z1, nodeGroup),
    ];
    const element = {
      id: nextElementId++,
      type: "hex8",
      nodes: nodeIds,
      part: partName,
      material: metadata.material || partName,
    };
    elements.push(element);
    addToSet(elementSets, partName, [element.id]);
    addToSet(nodeSets, `${partName}_nodes`, nodeIds);

    const faces = {
      zmin: [nodeIds[0], nodeIds[3], nodeIds[2], nodeIds[1]],
      zmax: [nodeIds[4], nodeIds[5], nodeIds[6], nodeIds[7]],
      xmin: [nodeIds[0], nodeIds[4], nodeIds[7], nodeIds[3]],
      xmax: [nodeIds[1], nodeIds[2], nodeIds[6], nodeIds[5]],
      ymin: [nodeIds[0], nodeIds[1], nodeIds[5], nodeIds[4]],
      ymax: [nodeIds[3], nodeIds[7], nodeIds[6], nodeIds[2]],
    };

    Object.entries(metadata.surfaceNames || {}).forEach(([faceKey, surfaceName]) => {
      const names = Array.isArray(surfaceName) ? surfaceName : [surfaceName];
      names.filter(Boolean).forEach((name) => addSurfaceFacet(name, "quad4", faces[faceKey]));
    });

    return { element, faces, nodeIds };
  }

  function addSurfacePair(name, primary, secondary) {
    surfacePairs[name] = { name, primary, secondary };
  }

  function finalize() {
    addToSet(nodeSets, "all_nodes_set", nodes.map((node) => node.id));
    const pipetteNodeIds = nodeSets.pipette_nodes ? Array.from(nodeSets.pipette_nodes) : [];
    const pipetteNodeLookup = new Set(pipetteNodeIds);
    addToSet(
      nodeSets,
      "deformable_nodes_set",
      nodes.filter((node) => !pipetteNodeLookup.has(node.id)).map((node) => node.id),
    );
    return {
      nodes,
      elements,
      surfaces: Object.fromEntries(
        Object.entries(surfaces).map(([name, facets]) => [name, facets]),
      ),
      nodeSets: Object.fromEntries(
        Object.entries(nodeSets).map(([name, ids]) => [name, Array.from(ids)]),
      ),
      elementSets: Object.fromEntries(
        Object.entries(elementSets).map(([name, ids]) => [name, Array.from(ids)]),
      ),
      surfacePairs,
    };
  }

  return {
    addHexBlock,
    addToNodeSet: (name, ids) => addToSet(nodeSets, name, ids),
    addToElementSet: (name, ids) => addToSet(elementSets, name, ids),
    addSurfacePair,
    finalize,
  };
}

// mesh placeholder: replace coarse block meshing with refined meshing later.
function buildNucleusMesh(builder, inputSpec, bounds) {
  const xCuts = [bounds.nucleusLeft, inputSpec.geometry.xn, bounds.nucleusRight];
  const zCuts = [bounds.nucleusBottom, inputSpec.geometry.yn, bounds.nucleusTop];
  const blocks = [];
  for (let zi = 0; zi < zCuts.length - 1; zi += 1) {
    for (let xi = 0; xi < xCuts.length - 1; xi += 1) {
      const surfaceNames = {};
      if (xi === 0) {
        surfaceNames.xmin = ["nucleus_interface_surface", "nucleus_interface_left_surface"];
      }
      if (xi === xCuts.length - 2) {
        surfaceNames.xmax = ["nucleus_interface_surface", "nucleus_interface_right_surface"];
      }
      if (zi === 0) {
        surfaceNames.zmin = ["nucleus_interface_surface", "nucleus_interface_bottom_surface"];
      }
      if (zi === zCuts.length - 2) {
        surfaceNames.zmax = ["nucleus_interface_surface", "nucleus_interface_top_surface", "nucleus_top_surface"];
      }
      const block = builder.addHexBlock("nucleus", xCuts[xi], xCuts[xi + 1], zCuts[zi], zCuts[zi + 1], {
        material: "nucleus",
        nodeGroup: "nucleus",
        surfaceNames,
      });
      if (block) {
        blocks.push(block);
        if (xi === 0) {
          builder.addToNodeSet("nc_left_nucleus_nodes", block.faces.xmin);
        }
        if (xi === xCuts.length - 2) {
          builder.addToNodeSet("nc_right_nucleus_nodes", block.faces.xmax);
        }
        if (zi === 0) {
          builder.addToNodeSet("nc_bottom_nucleus_nodes", block.faces.zmin);
        }
        if (zi === zCuts.length - 2) {
          builder.addToNodeSet("nc_top_nucleus_nodes", block.faces.zmax);
        }
      }
    }
  }
  return blocks;
}

// mesh placeholder: replace coarse geometry with refined meshing later.
function buildCellMesh(builder, inputSpec, bounds) {
  const xCuts = [bounds.cellLeft, bounds.nucleusLeft, inputSpec.geometry.xn, bounds.nucleusRight, bounds.cellRight];
  const zCuts = [0, bounds.nucleusBottom, inputSpec.geometry.yn, bounds.nucleusTop, bounds.cellTop];
  const blocks = [];
  for (let zi = 0; zi < zCuts.length - 1; zi += 1) {
    for (let xi = 0; xi < xCuts.length - 1; xi += 1) {
      const insideNucleusHole = (xi === 1 || xi === 2) && (zi === 1 || zi === 2);
      if (insideNucleusHole) {
        continue;
      }
      const x0 = xCuts[xi];
      const x1 = xCuts[xi + 1];
      const z0 = zCuts[zi];
      const z1 = zCuts[zi + 1];
      const surfaceNames = {};
      if (zi === 0) {
        const basalRegion =
          xi === 0 ? "left" : xi === xCuts.length - 2 ? "right" : "center";
        surfaceNames.zmin = ["cell_dish_surface", `cell_dish_${basalRegion}_surface`];
      }
      if (zi === zCuts.length - 2) {
        surfaceNames.zmax = "cell_top_surface";
      }
      if (xi === 0 && (zi === 1 || zi === 2)) {
        surfaceNames.xmax = ["cytoplasm_interface_surface", "cytoplasm_interface_left_surface"];
      }
      if (xi === xCuts.length - 2 && (zi === 1 || zi === 2)) {
        surfaceNames.xmin = ["cytoplasm_interface_surface", "cytoplasm_interface_right_surface"];
      }
      if (zi === 0 && (xi === 1 || xi === 2)) {
        surfaceNames.zmax = ["cytoplasm_interface_surface", "cytoplasm_interface_bottom_surface"];
      }
      if (zi === zCuts.length - 2 && (xi === 1 || xi === 2)) {
        surfaceNames.zmin = ["cytoplasm_interface_surface", "cytoplasm_interface_top_surface"];
      }
      const block = builder.addHexBlock("cytoplasm", x0, x1, z0, z1, {
        material: "cytoplasm",
        nodeGroup: "cytoplasm",
        surfaceNames,
      });
      if (block) {
        blocks.push(block);
        if (zi === 0) {
          builder.addToNodeSet("cell_base_nodes", block.nodeIds);
          if (xi === 0) {
            builder.addToNodeSet("cd_left_cell_nodes", block.faces.zmin);
          } else if (xi === xCuts.length - 2) {
            builder.addToNodeSet("cd_right_cell_nodes", block.faces.zmin);
          } else {
            builder.addToNodeSet("cd_center_cell_nodes", block.faces.zmin);
          }
        }
        if (xi === 0 && (zi === 1 || zi === 2)) {
          builder.addToNodeSet("nc_left_cytoplasm_nodes", block.faces.xmax);
        }
        if (xi === xCuts.length - 2 && (zi === 1 || zi === 2)) {
          builder.addToNodeSet("nc_right_cytoplasm_nodes", block.faces.xmin);
        }
        if (zi === 0 && (xi === 1 || xi === 2)) {
          builder.addToNodeSet("nc_bottom_cytoplasm_nodes", block.faces.zmax);
        }
        if (zi === zCuts.length - 2 && (xi === 1 || xi === 2)) {
          builder.addToNodeSet("nc_top_cytoplasm_nodes", block.faces.zmin);
        }
      }
    }
  }
  return blocks;
}

function buildDishGeometry(builder, bounds) {
  const dish = builder.addHexBlock("dish", bounds.cellLeft - 6, bounds.cellRight + 6, -bounds.dishThickness, 0, {
    material: "dish",
    nodeGroup: "dish",
    surfaceNames: {
      zmax: "dish_top_surface",
    },
  });
  if (dish) {
    builder.addToNodeSet("dish_fixed_nodes", dish.nodeIds);
  }
  return dish;
}

function buildFebioRigidTargets(inputSpec) {
  const params = inputSpec.params || inputSpec;
  const nucleusRest = getNucleusRest(params);
  const boundary = nucleusBoundary(params, nucleusRest);
  const contactPoint = makeSectionPoint(boundary.surfacePoint.x, boundary.surfacePoint.y);
  const precontactGap = clamp(params.rp * 0.08, 0.12, 0.35);
  const initialTarget = makeSectionPoint(getSectionX(contactPoint), getWorldZ(contactPoint) + precontactGap);
  const hold = contactPoint;
  const lift = makeSectionPoint(getSectionX(hold), getWorldZ(hold) + params.dz_lift);
  const inward = makeSectionPoint(getSectionX(lift) - params.dx_inward, getWorldZ(lift));
  const tangential = makeSectionPoint(getSectionX(lift), getWorldZ(lift));
  const combinedInward = makeSectionPoint(getSectionX(lift) - params.dx_inward * 0.55, getWorldZ(lift));
  const outward = makeSectionPoint(getSectionX(lift) + params.dx_outward, getWorldZ(lift));

  const manipulationTarget =
    inputSpec.caseName === "B"
      ? tangential
      : inputSpec.caseName === "C"
        ? combinedInward
        : inward;
  const releaseTarget =
    inputSpec.caseName === "B"
      ? tangential
      : inputSpec.caseName === "C"
        ? combinedInward
        : inward;

  return {
    initialTarget,
    stepTargets: [
      { name: "approach", phase: "phase0", label: "pipette approach", pos: hold, operation: { lift: 0, inward: 0, tangent: 0 } },
      { name: "hold", phase: "phase1", label: "capture / hold", pos: hold, operation: { lift: 0, inward: 0, tangent: 0 } },
      { name: "lift", phase: "phase2", label: "vertical lift", pos: lift, operation: { lift: params.dz_lift, inward: 0, tangent: 0 } },
      {
        name: "manipulation",
        phase: "phase3",
        label: "case-specific manipulation",
        pos: manipulationTarget,
        operation: {
          lift: params.dz_lift,
          inward: inputSpec.caseName === "A" ? params.dx_inward : inputSpec.caseName === "C" ? params.dx_inward * 0.55 : 0,
          tangent: inputSpec.caseName === "B" ? params.ds_tangent : inputSpec.caseName === "C" ? params.ds_tangent * 0.85 : 0,
        },
      },
      {
        name: "release-test",
        phase: "total",
        label: "release test",
        pos: outward,
        operation: { lift: params.dz_lift * 1.02, inward: 0, tangent: 0 },
        previousPos: releaseTarget,
      },
    ],
  };
}

function buildPipetteGeometry(builder, inputSpec, bounds) {
  const febioTargets = buildFebioRigidTargets(inputSpec);
  const initialTarget =
    febioTargets.initialTarget ||
    inputSpec.schedule?.holdPosition ||
    inputSpec.schedule?.targetAt?.(inputSpec.schedule?.phaseEnds?.phase0 || 0)?.pos ||
    inputSpec.schedule?.targetAt?.(0)?.pos ||
    makeSectionPoint(inputSpec.geometry.xn + inputSpec.geometry.xp, inputSpec.geometry.zp + inputSpec.geometry.rp + 3.2);
  const pipetteCenterX = getSectionX(initialTarget);
  const shaftHalf = Math.max(inputSpec.geometry.rp, 0.8);
  const pipetteTop = bounds.cellTop + Math.max(inputSpec.geometry.Hn * 0.8, inputSpec.geometry.rp * 3);
  const pipette = builder.addHexBlock(
    "pipette",
    pipetteCenterX - shaftHalf,
    pipetteCenterX + shaftHalf,
    getWorldZ(initialTarget),
    pipetteTop,
    {
      material: "pipette",
      nodeGroup: "pipette",
      surfaceNames: {
        zmin: "pipette_contact_surface",
      },
    },
  );
  if (pipette) {
    builder.addToNodeSet("pipette_nodes", pipette.nodeIds);
  }
  return pipette;
}

function buildCoarseFebioGeometry(inputSpec) {
  const thickness = Math.max(0.4, inputSpec.geometry.rp * 0.22);
  const bounds = {
    cellLeft: -inputSpec.geometry.Lc / 2,
    cellRight: inputSpec.geometry.Lc / 2,
    cellTop: inputSpec.geometry.Hc,
    nucleusLeft: inputSpec.geometry.xn - inputSpec.geometry.Ln / 2,
    nucleusRight: inputSpec.geometry.xn + inputSpec.geometry.Ln / 2,
    nucleusBottom: inputSpec.geometry.yn - inputSpec.geometry.Hn / 2,
    nucleusTop: inputSpec.geometry.yn + inputSpec.geometry.Hn / 2,
    dishThickness: Math.max(1.6, inputSpec.geometry.Hc * 0.18),
  };

  bounds.nucleusBottom = clamp(bounds.nucleusBottom, 0.8, Math.max(bounds.cellTop - 1.2, 1));
  bounds.nucleusTop = clamp(bounds.nucleusTop, bounds.nucleusBottom + 0.8, bounds.cellTop - 0.4);
  bounds.nucleusLeft = clamp(bounds.nucleusLeft, bounds.cellLeft + 0.8, bounds.cellRight - 1.6);
  bounds.nucleusRight = clamp(bounds.nucleusRight, bounds.nucleusLeft + 0.8, bounds.cellRight - 0.8);

  const builder = createFebioMeshBuilder(thickness);
  buildNucleusMesh(builder, inputSpec, bounds);
  buildCellMesh(builder, inputSpec, bounds);
  buildDishGeometry(builder, bounds);
  buildPipetteGeometry(builder, inputSpec, bounds);

  builder.addSurfacePair("nucleus_cytoplasm_pair", "cytoplasm_interface_surface", "nucleus_interface_surface");
  builder.addSurfacePair("cell_dish_pair", "cell_dish_surface", "dish_top_surface");
  builder.addSurfacePair("pipette_nucleus_pair", "nucleus_top_surface", "pipette_contact_surface");
  builder.addSurfacePair("pipette_cell_pair", "cell_top_surface", "pipette_contact_surface");

  return {
    thickness,
    bounds,
    ...builder.finalize(),
  };
}

function buildFebioLogOutputs(mesh, templateData) {
  const nodeSetOutputs = [
    ["nucleus_nodes", "febio_nucleus_nodes.csv"],
    ["cytoplasm_nodes", "febio_cytoplasm_nodes.csv"],
    ["nc_left_nucleus_nodes", "febio_nc_left_nucleus.csv"],
    ["nc_right_nucleus_nodes", "febio_nc_right_nucleus.csv"],
    ["nc_top_nucleus_nodes", "febio_nc_top_nucleus.csv"],
    ["nc_bottom_nucleus_nodes", "febio_nc_bottom_nucleus.csv"],
    ["nc_left_cytoplasm_nodes", "febio_nc_left_cytoplasm.csv"],
    ["nc_right_cytoplasm_nodes", "febio_nc_right_cytoplasm.csv"],
    ["nc_top_cytoplasm_nodes", "febio_nc_top_cytoplasm.csv"],
    ["nc_bottom_cytoplasm_nodes", "febio_nc_bottom_cytoplasm.csv"],
    ["cd_left_cell_nodes", "febio_cd_left_cell.csv"],
    ["cd_center_cell_nodes", "febio_cd_center_cell.csv"],
    ["cd_right_cell_nodes", "febio_cd_right_cell.csv"],
  ]
    .filter(([nodeSetName]) => Array.isArray(mesh.nodeSets[nodeSetName]) && mesh.nodeSets[nodeSetName].length > 0)
    .map(([nodeSetName, file]) => ({
      type: "node_data",
      name: nodeSetName,
      file,
      data: "ux;uz;Rx;Rz",
      itemIds: mesh.nodeSets[nodeSetName],
      delimiter: ",",
    }));

  return {
    nodeData: nodeSetOutputs,
    rigidBodyData: [
      {
        type: "rigid_body_data",
        name: "pipette_rigid_body",
        file: "febio_rigid_pipette.csv",
        data: "x;z;Fx;Fz",
        itemIds: [templateData.materials.pipette.id],
        delimiter: ",",
      },
    ],
    faceData: [
      {
        type: "face_data",
        name: "pipette_contact_surface",
        file: "febio_pipette_contact.csv",
        data: "contact gap;contact pressure",
        surface: "pipette_contact_surface",
        delimiter: ",",
      },
    ],
  };
}

// -----------------------------------------------------------------------------
// febio bridge
// -----------------------------------------------------------------------------
// FEM handoff point: this reduced-order template is the handoff boundary for future
// .feb XML serialization and FEBio CLI execution.
// TODO: buildFebioTemplateData -> serializeFebioTemplateToXml -> FEBio CLI execution
// TODO: convert FEBio displacement / cohesive damage / traction / contact outputs into JSON
// TODO: normalizeSimulationResult should remain the single convergence point for lightweight/FEBio outputs
// TODO: add solver comparison mode once FEBio produces real outputs
function buildFebioTemplateData(inputSpec) {
  const schedule = inputSpec.schedule;
  const mesh = buildCoarseFebioGeometry(inputSpec);
  const febioTargets = buildFebioRigidTargets(inputSpec);
  const initialTarget = febioTargets.initialTarget;
  const initialPipetteCenter = [
    getSectionX(initialTarget),
    0,
    (getWorldZ(initialTarget) + mesh.bounds.cellTop + Math.max(inputSpec.geometry.Hn * 0.8, inputSpec.geometry.rp * 3)) / 2,
  ];
  const makeStep = (name, phaseKey, label, control) => ({
    name,
    phase: phaseKey,
    label,
    endTime: schedule.phaseEnds[phaseKey],
    control,
  });
  const stepSequence = febioTargets.stepTargets.map((target) => {
    const phaseKey = target.phase;
    return phaseKey === "total"
      ? {
          name: target.name,
          phase: "total",
          label: target.label,
          endTime: schedule.phaseEnds.total,
          control: {
            phase: target.name,
            pos: { x: target.pos.x, y: target.pos.y },
            operation: structuredClone(target.operation || {}),
          },
          previousPos: target.previousPos || target.pos,
        }
      : makeStep(target.name, phaseKey, target.label, {
          phase: target.name,
          pos: { x: target.pos.x, y: target.pos.y },
          operation: structuredClone(target.operation || {}),
        });
  }).map((step, index, steps) => {
    const previous =
      index === 0 ? initialTarget : steps[index - 1].control.pos;
    const from = index === steps.length - 1 && step.previousPos ? step.previousPos : previous;
    const deltaX = step.control.pos.x - from.x;
    const deltaZ = step.control.pos.y - from.y;
    return {
      ...step,
      duration:
        index === 0
          ? schedule.phaseEnds.phase0
          : Math.max(step.endTime - steps[index - 1].endTime, 1e-6),
      rigidMotion: {
        x: { scale: deltaX, points: [[0, 0], [1, 1]] },
        z: { scale: deltaZ, points: [[0, 0], [1, 1]] },
      },
    };
  });

  const templateData = {
    coordinateSystem: structuredClone(inputSpec.coordinates || COORDINATE_SYSTEM_SPEC),
    geometry: {
      mesh: {
        nodes: mesh.nodes,
        elements: mesh.elements,
        surfaces: mesh.surfaces,
        nodeSets: mesh.nodeSets,
        elementSets: mesh.elementSets,
        surfacePairs: mesh.surfacePairs,
      },
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
        thresholds: {
          global: inputSpec.membrane.sig_m_crit,
          top_neck: inputSpec.membrane.sig_m_crit_top,
          side: inputSpec.membrane.sig_m_crit_side,
          basal: inputSpec.membrane.sig_m_crit_basal,
        },
      },
      dish: {
        type: "rigid_plane",
        heightZ: 0,
      },
      pipette: {
        radius: inputSpec.geometry.rp,
        puncture: { x: inputSpec.geometry.xp, z: inputSpec.geometry.zp },
        axis: "vertical_section_axis",
      },
    },
    materials: {
      nucleus: {
        id: 1,
        name: "nucleus",
        type: "neo-Hookean",
        domain: "nucleus",
        E: inputSpec.material.En,
        v: inputSpec.material.nun,
        eta: inputSpec.material.etan,
        alphaNonlinear: inputSpec.material.alpha_nonlinear,
      },
      cytoplasm: {
        id: 2,
        name: "cytoplasm",
        type: "neo-Hookean",
        domain: "cytoplasm",
        E: inputSpec.material.Ec,
        v: inputSpec.material.nuc,
        eta: inputSpec.material.etac,
      },
      membrane: { id: 3, name: "membrane", type: "membrane-placeholder", domain: null, tension: inputSpec.membrane.Tm },
      dish: { id: 4, name: "dish", type: "neo-Hookean", domain: "dish", E: Math.max(inputSpec.material.Ec * 40, 250), v: 0.3 },
      pipette: {
        id: 5,
        name: "pipette_rigid",
        type: "rigid body",
        domain: "pipette",
        E: Math.max(inputSpec.material.En * 60, 600),
        v: 0.25,
        density: 1,
        center_of_mass: initialPipetteCenter,
        isRigid: true,
      },
    },
    interfaces: {
      nucleusCytoplasm: {
        type: "tied-elastic",
        surfacePair: mesh.surfacePairs.nucleus_cytoplasm_pair,
        Kn: Math.max(inputSpec.interfaces.Kn_nc * 0.18, 0.08),
        Kt: Math.max(inputSpec.interfaces.Kt_nc * 0.18, 0.06),
        sigCrit: inputSpec.interfaces.sig_nc_crit,
        tauCrit: inputSpec.interfaces.tau_nc_crit,
        gc: inputSpec.interfaces.Gc_nc,
        tolerance: 0.05,
      },
      cellDish: {
        type: "tied-elastic",
        surfacePair: mesh.surfacePairs.cell_dish_pair,
        Kn: Math.max(inputSpec.interfaces.Kn_cd * 0.12, 0.12),
        Kt: Math.max(inputSpec.interfaces.Kt_cd * 0.12, 0.08),
        sigCrit: inputSpec.interfaces.sig_cd_crit,
        tauCrit: inputSpec.interfaces.tau_cd_crit,
        gc: inputSpec.interfaces.Gc_cd,
        adhesionPattern: inputSpec.adhesionPattern,
        adhesionSeed: inputSpec.adhesionSeed,
        tolerance: 0.05,
      },
    },
    contact: {
      pipetteNucleus: {
        type: "sticky",
        mode: "capture-hold",
        tolerance: 0.2,
        searchTolerance: inputSpec.operation.contact_tol,
        searchRadius: Math.max(inputSpec.geometry.rp * 2.2, 1.5),
        surfacePair: mesh.surfacePairs.pipette_nucleus_pair,
        penalty: Math.max(inputSpec.interfaces.Kn_nc * 0.85, 0.35),
        symmetricStiffness: 0,
        autoPenalty: 1,
        friction: Math.max(inputSpec.operation.mu_p, 0),
        maxTraction: Math.max(inputSpec.operation.Fhold * 0.08, 0.3),
        snapTolerance: clamp(inputSpec.geometry.rp * 0.06, 0.08, 0.45),
      },
      pipetteCell: {
        type: "sliding-elastic",
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
    },
    rigid: {
      pipette: {
        materialName: "pipette_rigid",
        nodeSet: "pipette_nodes",
        fixed: {
          Ry_dof: 1,
          Ru_dof: 1,
          Rv_dof: 1,
          Rw_dof: 1,
        },
      },
    },
    steps: stepSequence,
    outputRequests: [
      { field: "displacement", target: "nodes" },
      { field: "interface damage", target: "cohesive surfaces" },
      { field: "interface traction", target: "cohesive surfaces" },
      { field: "contact force", target: "pipette contact" },
      { field: "membrane stress proxy", target: "membrane regions" },
    ],
  };
  // TODO: buildFebioTemplateData から .feb XML を生成
  // TODO: FEBio CLI 実行
  // TODO: FEBio 出力（変位、界面損傷、接触反力）の JSON 変換
  // TODO: normalizeSimulationResult で lightweight / FEBio の出力を共通化
  // TODO: solver comparison mode の追加
  templateData.interfaceRegions = {
    localNc: {
      left: {
        nucleusNodeSet: "nc_left_nucleus_nodes",
        cytoplasmNodeSet: "nc_left_cytoplasm_nodes",
        nucleusSurface: "nucleus_interface_left_surface",
        cytoplasmSurface: "cytoplasm_interface_left_surface",
      },
      right: {
        nucleusNodeSet: "nc_right_nucleus_nodes",
        cytoplasmNodeSet: "nc_right_cytoplasm_nodes",
        nucleusSurface: "nucleus_interface_right_surface",
        cytoplasmSurface: "cytoplasm_interface_right_surface",
      },
      top: {
        nucleusNodeSet: "nc_top_nucleus_nodes",
        cytoplasmNodeSet: "nc_top_cytoplasm_nodes",
        nucleusSurface: "nucleus_interface_top_surface",
        cytoplasmSurface: "cytoplasm_interface_top_surface",
      },
      bottom: {
        nucleusNodeSet: "nc_bottom_nucleus_nodes",
        cytoplasmNodeSet: "nc_bottom_cytoplasm_nodes",
        nucleusSurface: "nucleus_interface_bottom_surface",
        cytoplasmSurface: "cytoplasm_interface_bottom_surface",
      },
    },
    localCd: {
      left: {
        cellNodeSet: "cd_left_cell_nodes",
        cellSurface: "cell_dish_left_surface",
        dishSurface: "dish_top_surface",
      },
      center: {
        cellNodeSet: "cd_center_cell_nodes",
        cellSurface: "cell_dish_center_surface",
        dishSurface: "dish_top_surface",
      },
      right: {
        cellNodeSet: "cd_right_cell_nodes",
        cellSurface: "cell_dish_right_surface",
        dishSurface: "dish_top_surface",
      },
    },
  };
  templateData.logOutputs = buildFebioLogOutputs(mesh, templateData);
  return templateData;
}
function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatVector(values) {
  return values.map((value) => Number(value).toFixed(6)).join(",");
}

function serializeMaterialXml(material) {
  if (material.type === "rigid body") {
    const centerOfMass = material.center_of_mass || [0, 0, 0];
    return `    <material id="${material.id}" name="${escapeXml(material.name)}" type="rigid body">
      <density>${Number(material.density || 1).toFixed(6)}</density>
      <center_of_mass>${formatVector(centerOfMass)}</center_of_mass>
      <E>${Number(material.E || 0).toFixed(6)}</E>
      <v>${Number(material.v || 0.3).toFixed(6)}</v>
    </material>`;
  }
  return `    <material id="${material.id}" name="${escapeXml(material.name)}" type="${escapeXml(material.type)}">
      <E>${Number(material.E || 0).toFixed(6)}</E>
      <v>${Number(material.v || 0.3).toFixed(6)}</v>
    </material>`;
}

function serializeSurfaceXml(name, facets) {
  return `    <Surface name="${escapeXml(name)}">
${facets
  .map(
    (facet) =>
      `      <${facet.type} id="${facet.id}">${facet.nodes.join(",")}</${facet.type}>`,
  )
  .join("\n")}
    </Surface>`;
}

function serializeTiedContactXml(name, spec) {
  return `    <contact name="${escapeXml(name)}" type="${escapeXml(spec.type)}" surface_pair="${escapeXml(spec.surfacePair.name)}">
      <penalty>${Number(spec.Kn || 1).toFixed(6)}</penalty>
      <tolerance>${Number(spec.tolerance || 0.2).toFixed(6)}</tolerance>
    </contact>`;
}

function serializeSlidingContactXml(name, spec) {
  return `    <contact name="${escapeXml(name)}" type="${escapeXml(spec.type)}" surface_pair="${escapeXml(spec.surfacePair.name)}">
      <penalty>${Number(spec.penalty || 1).toFixed(6)}</penalty>
      <auto_penalty>${spec.autoPenalty ? 1 : 0}</auto_penalty>
      <two_pass>0</two_pass>
      <laugon>0</laugon>
      <tolerance>${Number(spec.tolerance || 0.2).toFixed(6)}</tolerance>
      <search_tol>${Number(spec.searchTolerance || 0.01).toFixed(6)}</search_tol>
      <search_radius>${Number(spec.searchRadius || 1).toFixed(6)}</search_radius>
      <symmetric_stiffness>${spec.symmetricStiffness ? 1 : 0}</symmetric_stiffness>
      <fric_coeff>${Number(spec.friction || 0).toFixed(6)}</fric_coeff>
    </contact>`;
}

function serializeStickyContactXml(name, spec) {
  return `    <contact name="${escapeXml(name)}" type="sticky" surface_pair="${escapeXml(spec.surfacePair.name)}">
      <penalty>${Number(spec.penalty || 1).toFixed(6)}</penalty>
      <laugon>0</laugon>
      <tolerance>${Number(spec.tolerance || 0.2).toFixed(6)}</tolerance>
      <minaug>0</minaug>
      <maxaug>10</maxaug>
      <search_tolerance>${Number(spec.searchTolerance || 0.01).toFixed(6)}</search_tolerance>
      <max_traction>${Number(spec.maxTraction || 0).toFixed(6)}</max_traction>
      <snap_tol>${Number(spec.snapTolerance || 0.1).toFixed(6)}</snap_tol>
    </contact>`;
}

function serializeRigidBoundaryXml(rigidSpec) {
  return `    <rigid_bc type="rigid_fixed">
      <rb>${escapeXml(rigidSpec.materialName)}</rb>
      <Ry_dof>${rigidSpec.fixed?.Ry_dof ? 1 : 0}</Ry_dof>
      <Ru_dof>${rigidSpec.fixed?.Ru_dof ? 1 : 0}</Ru_dof>
      <Rv_dof>${rigidSpec.fixed?.Rv_dof ? 1 : 0}</Rv_dof>
      <Rw_dof>${rigidSpec.fixed?.Rw_dof ? 1 : 0}</Rw_dof>
    </rigid_bc>`;
}

function serializeRigidDisplacementXml(materialName, dof, value) {
  return `      <rigid_bc type="rigid_displacement">
        <rb>${escapeXml(materialName)}</rb>
        <dof>${escapeXml(dof)}</dof>
        <value>${Number(value || 0).toFixed(6)}</value>
        <relative>1</relative>
      </rigid_bc>`;
}

function serializeLogfileSection(logOutputs = {}, materialIdMap = new Map()) {
  const entries = [
    ...(logOutputs.nodeData || []).map(
      (spec) =>
        `      <node_data name="${escapeXml(spec.name)}" file="${escapeXml(spec.file)}" data="${escapeXml(spec.data)}" delim="${escapeXml(spec.delimiter || ",")}">${spec.itemIds.join(",")}</node_data>`,
    ),
    ...(logOutputs.rigidBodyData || []).map(
      (spec) => {
        const remappedIds = (spec.itemIds || []).map((id) => materialIdMap.get(id) || id);
        return `      <rigid_body_data name="${escapeXml(spec.name)}" file="${escapeXml(spec.file)}" data="${escapeXml(spec.data)}" delim="${escapeXml(spec.delimiter || ",")}">${remappedIds.join(",")}</rigid_body_data>`;
      },
    ),
  ];
  if (!entries.length) {
    return "";
  }
  return `    <logfile>\n${entries.join("\n")}\n    </logfile>`;
}

function serializeFebioTemplateToXml(templateData) {
  const mesh = templateData.geometry.mesh;
  const exportMaterials = Object.values(templateData.materials)
    .filter((material) => material.domain)
    .map((material, index) => ({
      ...material,
      exportId: index + 1,
    }));
  const materialIdMap = new Map(exportMaterials.map((material) => [material.id, material.exportId]));
  const materials = exportMaterials
    .map((material) => serializeMaterialXml({ ...material, id: material.exportId }))
    .join("\n");
  const nodesXml = mesh.nodes
    .map((node) => `      <node id="${node.id}">${formatVector([node.x, node.y, node.z])}</node>`)
    .join("\n");
  const elementsByPart = Object.entries(mesh.elementSets).map(([name, ids]) => {
    const partElements = mesh.elements.filter((element) => ids.includes(element.id));
    return `    <Elements type="hex8" name="${escapeXml(name)}">
${partElements
  .map((element) => `      <elem id="${element.id}">${element.nodes.join(",")}</elem>`)
  .join("\n")}
    </Elements>`;
  });
  const surfacesXml = Object.entries(mesh.surfaces).map(([name, facets]) => serializeSurfaceXml(name, facets));
  const nodeSetsXml = Object.entries(mesh.nodeSets).map(
    ([name, ids]) => `    <NodeSet name="${escapeXml(name)}">${ids.join(",")}</NodeSet>`,
  );
  const surfacePairsXml = Object.values(mesh.surfacePairs).map(
    (pair) => `    <SurfacePair name="${escapeXml(pair.name)}">
      <primary>${escapeXml(pair.primary)}</primary>
      <secondary>${escapeXml(pair.secondary)}</secondary>
    </SurfacePair>`,
  );
  const meshDomainsXml = exportMaterials
    .map(
      (material) =>
        `    <SolidDomain name="${escapeXml(material.domain)}" mat="${escapeXml(material.name)}" />`,
    )
    .join("\n");
  const contactXml = [
    serializeTiedContactXml("nucleus_cytoplasm_interface", templateData.interfaces.nucleusCytoplasm),
    serializeTiedContactXml("cell_dish_interface", templateData.interfaces.cellDish),
    templateData.contact.pipetteNucleus.type === "sticky"
      ? serializeStickyContactXml("pipette_nucleus_contact", templateData.contact.pipetteNucleus)
      : serializeSlidingContactXml("pipette_nucleus_contact", templateData.contact.pipetteNucleus),
    serializeSlidingContactXml("pipette_cell_contact", templateData.contact.pipetteCell),
  ].join("\n");
  const rigidRootXml = templateData.rigid?.pipette ? serializeRigidBoundaryXml(templateData.rigid.pipette) : "";
  const stepXml = templateData.steps
    .map((step, index) => {
      return `    <step id="${index + 1}" name="${escapeXml(step.name)}">
    <Control>
      <analysis>static</analysis>
      <time_steps>25</time_steps>
      <step_size>0.04</step_size>
      <plot_level>PLOT_MAJOR_ITRS</plot_level>
      <output_level>OUTPUT_MAJOR_ITRS</output_level>
      <solver>
        <symmetric_stiffness>0</symmetric_stiffness>
      </solver>
    </Control>
    <Rigid>
${serializeRigidDisplacementXml(templateData.rigid.pipette.materialName, "x", step.rigidMotion.x.scale)}
${serializeRigidDisplacementXml(templateData.rigid.pipette.materialName, "z", step.rigidMotion.z.scale)}
    </Rigid>
    </step>`;
    })
    .join("\n");
  const logfileXml = serializeLogfileSection(templateData.logOutputs, materialIdMap);

  return `<?xml version="1.0" encoding="UTF-8"?>
<febio_spec version="4.0">
  <Module type="solid" />
  <Material>
${materials}
  </Material>
  <Mesh>
    <Nodes name="all_nodes">
${nodesXml}
    </Nodes>
${elementsByPart.join("\n")}
${surfacesXml.join("\n")}
${nodeSetsXml.join("\n")}
${surfacePairsXml.join("\n")}
  </Mesh>
  <MeshDomains>
${meshDomainsXml}
  </MeshDomains>
  <Boundary>
    <bc name="fix_dish" node_set="dish_fixed_nodes" type="zero displacement">
      <x_dof>1</x_dof>
      <y_dof>1</y_dof>
      <z_dof>1</z_dof>
    </bc>
    <bc name="support_cell_base_z" node_set="cell_base_nodes" type="zero displacement">
      <z_dof>1</z_dof>
    </bc>
    <bc name="section_plane_lock" node_set="deformable_nodes_set" type="zero displacement">
      <y_dof>1</y_dof>
    </bc>
  </Boundary>
  <Contact>
${contactXml}
  </Contact>
  <Rigid>
${rigidRootXml}
  </Rigid>
  <Step>
${stepXml}
  </Step>
  <Output>
${logfileXml}
    <plotfile type="febio">
      <var type="displacement" />
      <var type="stress" />
      <var type="contact force" />
      <var type="reaction forces" />
    </plotfile>
  </Output>
</febio_spec>`;
}

function exportFebioXmlContent(inputSpec) {
  const templateData = inputSpec.febioTemplateData || buildFebioTemplateData(inputSpec);
  return serializeFebioTemplateToXml(templateData);
}

function buildFebioInputSpec(caseName, params, inputSpec = buildSimulationInput(caseName, params)) {
  return {
    caseName: inputSpec.caseName,
    params: structuredClone(inputSpec.params),
    coordinates: structuredClone(inputSpec.coordinates || COORDINATE_SYSTEM_SPEC),
    geometry: structuredClone(inputSpec.geometry),
    material: structuredClone(inputSpec.material),
    interfaces: structuredClone(inputSpec.interfaces),
    membrane: structuredClone(inputSpec.membrane),
    operation: structuredClone(inputSpec.operation),
    adhesionPattern: inputSpec.adhesionPattern,
    adhesionSeed: inputSpec.adhesionSeed,
    schedule: serializeSchedule(inputSpec.schedule),
    febioTemplateData: buildFebioTemplateData(inputSpec),
    solverMetadata: buildSolverMetadata("febio", {
      source: "FEBio bridge (mock)",
      note: "not yet solved by FEBio",
    }),
  };
}

function exportFebioJson(inputSpec) {
  const febioXml = exportFebioXmlContent(inputSpec);
  const serializedInputSpec = {
    ...structuredClone({
      caseName: inputSpec.caseName,
      params: inputSpec.params,
      coordinates: inputSpec.coordinates,
      geometry: inputSpec.geometry,
      material: inputSpec.material,
      interfaces: inputSpec.interfaces,
      membrane: inputSpec.membrane,
      operation: inputSpec.operation,
      adhesionPattern: inputSpec.adhesionPattern,
      adhesionSeed: inputSpec.adhesionSeed,
    }),
    schedule: serializeSchedule(inputSpec.schedule),
  };
  return JSON.stringify(
    {
      inputSpec: serializedInputSpec,
      febioTemplateData: inputSpec.febioTemplateData || buildFebioTemplateData(inputSpec),
      febioXml,
      febioXmlStub: febioXml,
      handoffManifest: buildFebioHandoffManifest(inputSpec),
      solverMetadata: inputSpec.solverMetadata || buildSolverMetadata("febio", { source: "FEBio bridge (mock)" }),
      uiMetadata: {
        selectedCase: appState.ui.selectedCase,
        selectedMode: appState.ui.selectedMode,
        solverMode: appState.ui.solverMode,
      },
      currentSolverMode: appState.ui.solverMode,
    },
    null,
    2,
  );
}

function importFebioResult(febioResultJson, inputSpec) {
  const baseResult = febioResultJson.baseResult ? { ...febioResultJson.baseResult } : {};
  baseResult.caseName ??= inputSpec.caseName;
  baseResult.params ??= structuredClone(inputSpec.params);
  baseResult.schedule ??= inputSpec.schedule;
  // FEM handoff point: map FEBio cohesive/contact output back into the common
  // app result schema, including localNc/localCd/membraneRegions.
  baseResult.solverMetadata = buildSolverMetadata("febio", {
    source: febioResultJson.mock ? "FEBio bridge (mock)" : "febio-import",
    note: febioResultJson.mock ? "not yet solved by FEBio" : "",
  });
  baseResult.externalResult = febioResultJson;
  return baseResult;
}

function runFebioSimulation(caseName, params, inputSpec = buildSimulationInput(caseName, params)) {
  const febioInputSpec = buildFebioInputSpec(caseName, params, inputSpec);
  const exportedJson = exportFebioJson(febioInputSpec);
  const exportedXml = exportFebioXmlContent(febioInputSpec);
  // Future CLI handoff point: write exportedJson to disk, invoke FEBio CLI, then import converted JSON outputs here.
  const mockBaseResult = runLightweightSimulation(caseName, params, inputSpec);
  return importFebioResult(
    {
      mock: true,
      exportedJson,
      exportedXml,
      templateData: febioInputSpec.febioTemplateData,
      baseResult: mockBaseResult,
    },
    febioInputSpec,
  );
}

// Solver layer: single public dispatch entry used by the UI.
function runSimulation(caseName, params, solverMode = appState.ui.solverMode || "lightweight") {
  const resolvedMode = SOLVER_MODES.includes(solverMode) ? solverMode : "lightweight";
  const inputSpec = buildSimulationInput(caseName, params);
  const rawResult =
    resolvedMode === "febio"
      ? runFebioSimulation(caseName, params, inputSpec)
      : runLightweightSimulation(caseName, params, inputSpec);
  rawResult.solverMetadata ??= buildSolverMetadata(resolvedMode, {
    source: resolvedMode === "febio" ? "FEBio bridge (mock)" : "lightweight-js-surrogate",
    note: resolvedMode === "febio" ? "not yet solved by FEBio" : "",
  });
  return normalizeSimulationResult(rawResult, inputSpec);
}

function downloadTextFile(filename, content, mimeType = "application/json;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadTextFiles(files) {
  files.forEach((file, index) => {
    setTimeout(() => downloadTextFile(file.filename, file.content, file.mimeType), index * 120);
  });
}

function sanitizeFilenameSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "export";
}

function buildFebioHandoffManifest(inputSpec) {
  const caseName = inputSpec.caseName || "C";
  const solverInfo = describeSolverMetadata(inputSpec.solverMetadata || buildSolverMetadata("febio"));
  const baseName = `case_${sanitizeFilenameSegment(caseName)}`;
  return {
    exportType: "febio-handoff-bundle",
    generatedAt: new Date().toISOString(),
    appSchemaVersion: APP_SCHEMA_VERSION,
    caseName,
    selectedSolverMode: appState.ui.solverMode,
    solverMetadata: {
      solverMode: solverInfo.solverMode,
      source: solverInfo.label,
      note: solverInfo.note || "external FEBio solve required",
    },
    files: {
      feb: `${baseName}.feb`,
      inputJson: `febio_${baseName}_input.json`,
      manifestJson: `febio_${baseName}_manifest.json`,
      readmeText: `febio_${baseName}_README.txt`,
    },
    execution: {
      cliScript: "scripts/run_febio_case.ps1",
      commandExample: `powershell -ExecutionPolicy Bypass -File scripts/run_febio_case.ps1 -FebFile ${baseName}.feb`,
      expectedOutputs: [`${baseName}.log`, `${baseName}.xplt`, `${baseName}.feb`],
      note: "The in-app febio mode is still a bridge mock. The exported .feb is intended for external FEBio execution.",
    },
    importBack: {
      supportedNow: "normalized app result JSON",
      nextStep: "convert FEBio outputs into the app result schema before using 結果読込",
    },
    parameterSummary: {
      puncture: { x: inputSpec.geometry.xp, z: inputSpec.geometry.zp },
      hold: { Fhold: inputSpec.operation.Fhold, P_hold: inputSpec.operation.P_hold },
      motion: {
        dz_lift: inputSpec.operation.dz_lift,
        dx_inward: inputSpec.operation.dx_inward,
        ds_tangent: inputSpec.operation.ds_tangent,
        dx_outward: inputSpec.operation.dx_outward,
      },
      adhesionPattern: inputSpec.adhesionPattern,
      adhesionSeed: inputSpec.adhesionSeed,
    },
  };
}

function buildFebioHandoffReadme(manifest) {
  return [
    "FEBio handoff bundle",
    `generatedAt: ${manifest.generatedAt}`,
    `caseName: ${manifest.caseName}`,
    `solver source shown in app: ${manifest.solverMetadata.source}`,
    "",
    "Files in this bundle:",
    `- ${manifest.files.feb}: FEBio input XML`,
    `- ${manifest.files.inputJson}: normalized app input + FEBio template metadata`,
    `- ${manifest.files.manifestJson}: handoff manifest`,
    "",
    "Recommended workflow:",
    "1. Place the downloaded files in one working folder on the FEBio machine.",
    `2. Run: ${manifest.execution.commandExample}`,
    "3. Keep the generated .log / .xplt together with the original .feb for traceability.",
    "4. If you want to bring results back into this app, convert FEBio outputs into the normalized app result JSON schema first.",
    "",
    "Important note:",
    "The browser app can generate FEBio inputs, but the in-app febio solver mode is still a mock bridge and does not run FEBio itself.",
  ].join("\n");
}

function exportCurrentCaseAsFebioJson() {
  const caseName = appState.ui.selectedCase || "C";
  const params = collectParams();
  const febioInputSpec = buildFebioInputSpec(caseName, params);
  // Export bundle = normalized simulation input + FEBio template data + solver metadata.
  downloadTextFile(`febio_case_${caseName}_input.json`, exportFebioJson(febioInputSpec));
}

function exportFebioXml(inputSpec = null) {
  const caseName = inputSpec?.caseName || appState.ui.selectedCase || "C";
  const resolvedInput =
    inputSpec || buildFebioInputSpec(caseName, collectParams(), buildSimulationInput(caseName, collectParams()));
  const xml = exportFebioXmlContent(resolvedInput);
  downloadTextFile(`case_${caseName}.feb`, xml, "application/xml;charset=utf-8");
  return xml;
}

function exportFebioHandoffBundle(inputSpec = null) {
  const caseName = inputSpec?.caseName || appState.ui.selectedCase || "C";
  const params = inputSpec?.params || collectParams();
  const resolvedInput =
    inputSpec || buildFebioInputSpec(caseName, params, buildSimulationInput(caseName, params));
  const baseName = `case_${sanitizeFilenameSegment(caseName)}`;
  const manifest = buildFebioHandoffManifest(resolvedInput);
  const xml = exportFebioXmlContent(resolvedInput);
  const inputJson = exportFebioJson(resolvedInput);
  const readmeText = buildFebioHandoffReadme(manifest);

  downloadTextFiles([
    { filename: `${baseName}.feb`, content: xml, mimeType: "application/xml;charset=utf-8" },
    {
      filename: `febio_${baseName}_input.json`,
      content: inputJson,
      mimeType: "application/json;charset=utf-8",
    },
    {
      filename: `febio_${baseName}_manifest.json`,
      content: JSON.stringify(manifest, null, 2),
      mimeType: "application/json;charset=utf-8",
    },
    {
      filename: `febio_${baseName}_README.txt`,
      content: readmeText,
      mimeType: "text/plain;charset=utf-8",
    },
  ]);

  return manifest;
}

const FEBIO_BRIDGE_BASE_URL = "http://127.0.0.1:8765";

function setFebioBridgeStatus(text, tone = "") {
  appState.febioBridge.statusText = text;
  if (!elements.febioBridgeStatus) {
    return;
  }
  elements.febioBridgeStatus.textContent = text;
  elements.febioBridgeStatus.classList.remove("is-error", "is-busy", "is-ready");
  if (tone) {
    elements.febioBridgeStatus.classList.add(tone);
  }
}

async function fetchFebioBridge(pathname, options = {}) {
  const response = await fetch(`${FEBIO_BRIDGE_BASE_URL}${pathname}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Bridge request failed: ${response.status}`);
  }
  return payload;
}

async function refreshFebioBridgeStatus() {
  try {
    const payload = await fetchFebioBridge("/health", { method: "GET" });
    appState.febioBridge.available = true;
    appState.febioBridge.busy = Boolean(payload.busy);
    const label = payload.busy
      ? `bridge: busy (${payload.activeCase || "running"})`
      : "bridge: ready";
    setFebioBridgeStatus(label, payload.busy ? "is-busy" : "is-ready");
    return payload;
  } catch (error) {
    appState.febioBridge.available = false;
    appState.febioBridge.busy = false;
    setFebioBridgeStatus("bridge: offline", "is-error");
    return null;
  }
}

async function runFebioViaBridge() {
  const caseName = appState.ui.selectedCase || "C";
  const params = collectParams();
  appState.ui.solverMode = "febio";
  syncSolverModeControl();
  appState.febioBridge.busy = true;
  setFebioBridgeStatus(`bridge: running case ${caseName}`, "is-busy");
  try {
    const payload = await fetchFebioBridge("/run", {
      method: "POST",
      body: JSON.stringify({ caseName, params }),
    });
    const normalized = loadExternalResult(payload.resultPayload);
    appState.febioBridge.available = true;
    appState.febioBridge.busy = false;
    setFebioBridgeStatus(`bridge: loaded case ${caseName}`, "is-ready");
    return normalized;
  } catch (error) {
    appState.febioBridge.available = false;
    appState.febioBridge.busy = false;
    setFebioBridgeStatus(`bridge: ${error.message}`, "is-error");
    throw error;
  }
}

async function viewFebioBridgeResult() {
  const caseName = appState.ui.selectedCase || "C";
  setFebioBridgeStatus(`bridge: loading case ${caseName}`, "is-busy");
  try {
    const payload = await fetchFebioBridge(`/latest?caseName=${encodeURIComponent(caseName)}`, {
      method: "GET",
    });
    const normalized = loadExternalResult(payload.resultPayload);
    appState.febioBridge.available = true;
    appState.febioBridge.busy = false;
    setFebioBridgeStatus(`bridge: viewing case ${caseName}`, "is-ready");
    return normalized;
  } catch (error) {
    appState.febioBridge.available = false;
    appState.febioBridge.busy = false;
    setFebioBridgeStatus(`bridge: ${error.message}`, "is-error");
    throw error;
  }
}

// Imported results are already normalized before they reach the UI state.
function applyImportedResult(result) {
  appState.ui.solverMode = result.solverMetadata?.solverMode || appState.ui.solverMode;
  appState.ui.selectedCase = result.caseName || appState.ui.selectedCase;
  appState.ui.selectedMode = "case";
  appState.comparisonRuns = [result];
  syncRunButtons();
  syncSolverModeControl();
  renderLatest(result);
}

function loadExternalResult(resultJson) {
  const payload = typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson;
  const rawResult = payload.result || payload.normalizedResult || payload.baseResult || payload.febioResult || payload;
  rawResult.solverMetadata ??= payload.solverMetadata;
  const caseName = rawResult.caseName || payload.inputSpec?.caseName || appState.ui.selectedCase || "C";
  const params = rawResult.params || payload.inputSpec?.params || collectParams();
  const inputSpec = buildSimulationInput(caseName, params);
  // External results are normalized through the same schema path as local solver outputs.
  const normalized = normalizeSimulationResult(rawResult, inputSpec);
  applyImportedResult(normalized);
  return normalized;
}

function translateFailureSite(site) {
  const labels = {
    "nc:right": "核-細胞質 right",
    "nc:left": "核-細胞質 left",
    "nc:top": "核-細胞質 top",
    "nc:bottom": "核-細胞質 bottom",
    "cd:left": "細胞-ディッシュ left",
    "cd:center": "細胞-ディッシュ center",
    "cd:right": "細胞-ディッシュ right",
    "membrane:top_neck": "膜 top_neck",
    "membrane:side": "膜 side",
    "membrane:basal": "膜 basal",
    "pipette:hold": "ピペット保持点",
    none: "未発生",
  };
  return labels[site] || site;
}

function translateMechanism(mode) {
  const labels = {
    local_shear: "local_shear",
    rotational_moment: "rotational_moment",
    dish_detachment: "dish_detachment",
    membrane_rupture: "membrane_rupture",
    insufficient_capture: "insufficient_capture",
  };
  return labels[mode] || mode;
}

