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
    nodes.push({ id, x, y, z, nodeGroup });
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
  const stagedInwardMid = makeSectionPoint(getSectionX(lift) - params.dx_inward * 0.45, getWorldZ(lift));
  const stagedCombinedMid = makeSectionPoint(getSectionX(lift) - params.dx_inward * 0.3, getWorldZ(lift));

  const manipulationTargets =
    inputSpec.caseName === "B"
      ? [
          {
            name: "manipulation",
            phase: "phase3",
            label: "case-specific manipulation",
            pos: tangential,
            operation: { lift: params.dz_lift, inward: 0, tangent: params.ds_tangent },
          },
        ]
      : inputSpec.caseName === "C"
        ? [
            {
              name: "manipulation-1",
              phase: "phase3",
              label: "case-specific manipulation (stage 1)",
              pos: stagedCombinedMid,
              operation: {
                lift: params.dz_lift,
                inward: params.dx_inward * 0.3,
                tangent: params.ds_tangent * 0.35,
              },
            },
            {
              name: "manipulation-2",
              phase: "phase3",
              label: "case-specific manipulation (stage 2)",
              pos: combinedInward,
              operation: {
                lift: params.dz_lift,
                inward: params.dx_inward * 0.55,
                tangent: params.ds_tangent * 0.85,
              },
            },
          ]
        : [
            {
              name: "manipulation-1",
              phase: "phase3",
              label: "case-specific manipulation (stage 1)",
              pos: stagedInwardMid,
              operation: {
                lift: params.dz_lift,
                inward: params.dx_inward * 0.45,
                tangent: 0,
              },
            },
            {
              name: "manipulation-2",
              phase: "phase3",
              label: "case-specific manipulation (stage 2)",
              pos: inward,
              operation: {
                lift: params.dz_lift,
                inward: params.dx_inward,
                tangent: 0,
              },
            },
          ];
  const releaseTarget = manipulationTargets[manipulationTargets.length - 1].pos;
  const enableReleaseTest = Boolean(inputSpec.operation?.enableReleaseTest || inputSpec.debug?.enableReleaseTest);
  const releaseOutward = makeSectionPoint(
    getSectionX(releaseTarget) + clamp(params.dx_outward * 0.18, 0.15, 0.6),
    getWorldZ(releaseTarget),
  );

  return {
    initialTarget,
    stepTargets: [
      { name: "approach", phase: "phase0", label: "pipette approach", pos: hold, operation: { lift: 0, inward: 0, tangent: 0 } },
      { name: "hold", phase: "phase1", label: "capture / hold", pos: hold, operation: { lift: 0, inward: 0, tangent: 0 } },
      { name: "lift", phase: "phase2", label: "vertical lift", pos: lift, operation: { lift: params.dz_lift, inward: 0, tangent: 0 } },
      ...manipulationTargets,
      ...(enableReleaseTest
        ? [{
            name: "release-test",
            phase: "total",
            label: "release test",
            pos: releaseOutward,
            operation: { lift: params.dz_lift * 1.02, inward: 0, tangent: 0 },
            previousPos: releaseTarget,
          }]
        : []),
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

// Legacy/fallback mesh builder kept only for debug comparison.
// Main export path must use buildRefinedFebioGeometry().
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

function uniqueSortedCuts(values, minGap = 1e-4) {
  return values
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right)
    .filter((value, index, array) => index === 0 || Math.abs(value - array[index - 1]) > minGap);
}

function buildRefinedNucleusMesh(builder, inputSpec, bounds) {
  const xCuts = uniqueSortedCuts([
    bounds.nucleusLeft,
    inputSpec.geometry.xn - inputSpec.geometry.Ln * 0.18,
    inputSpec.geometry.xn,
    inputSpec.geometry.xn + inputSpec.geometry.Ln * 0.18,
    bounds.nucleusRight,
  ]);
  const zCuts = uniqueSortedCuts([
    bounds.nucleusBottom,
    inputSpec.geometry.yn - inputSpec.geometry.Hn * 0.18,
    inputSpec.geometry.yn,
    inputSpec.geometry.yn + inputSpec.geometry.Hn * 0.18,
    bounds.nucleusTop,
  ]);

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
      if (!block) {
        continue;
      }
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
  return blocks;
}

function buildRefinedCellMesh(builder, inputSpec, bounds) {
  const xCuts = uniqueSortedCuts([
    bounds.cellLeft,
    bounds.nucleusLeft,
    inputSpec.geometry.xn - inputSpec.geometry.Ln * 0.18,
    inputSpec.geometry.xn,
    inputSpec.geometry.xn + inputSpec.geometry.Ln * 0.18,
    bounds.nucleusRight,
    bounds.cellRight,
  ]);
  const zCuts = uniqueSortedCuts([
    0,
    bounds.nucleusBottom,
    inputSpec.geometry.yn - inputSpec.geometry.Hn * 0.18,
    inputSpec.geometry.yn,
    inputSpec.geometry.yn + inputSpec.geometry.Hn * 0.18,
    bounds.nucleusTop,
    bounds.cellTop,
  ]);

  const nucleusHole = {
    x0: bounds.nucleusLeft,
    x1: bounds.nucleusRight,
    z0: bounds.nucleusBottom,
    z1: bounds.nucleusTop,
  };

  const blocks = [];
  for (let zi = 0; zi < zCuts.length - 1; zi += 1) {
    for (let xi = 0; xi < xCuts.length - 1; xi += 1) {
      const x0 = xCuts[xi];
      const x1 = xCuts[xi + 1];
      const z0 = zCuts[zi];
      const z1 = zCuts[zi + 1];
      const insideNucleusHole =
        x0 >= nucleusHole.x0 - 1e-6 &&
        x1 <= nucleusHole.x1 + 1e-6 &&
        z0 >= nucleusHole.z0 - 1e-6 &&
        z1 <= nucleusHole.z1 + 1e-6;
      if (insideNucleusHole) {
        continue;
      }

      const surfaceNames = {};
      if (Math.abs(z0) < 1e-6) {
        const centerX = (x0 + x1) / 2;
        const basalRegion =
          centerX < inputSpec.geometry.xn - inputSpec.geometry.Ln * 0.12
            ? "left"
            : centerX > inputSpec.geometry.xn + inputSpec.geometry.Ln * 0.12
              ? "right"
              : "center";
        surfaceNames.zmin = ["cell_dish_surface", `cell_dish_${basalRegion}_surface`];
      }
      if (Math.abs(z1 - bounds.cellTop) < 1e-6) {
        surfaceNames.zmax = "cell_top_surface";
      }
      if (Math.abs(x1 - bounds.nucleusLeft) < 1e-6 && z0 < bounds.nucleusTop && z1 > bounds.nucleusBottom) {
        surfaceNames.xmax = ["cytoplasm_interface_surface", "cytoplasm_interface_left_surface"];
      }
      if (Math.abs(x0 - bounds.nucleusRight) < 1e-6 && z0 < bounds.nucleusTop && z1 > bounds.nucleusBottom) {
        surfaceNames.xmin = ["cytoplasm_interface_surface", "cytoplasm_interface_right_surface"];
      }
      if (Math.abs(z1 - bounds.nucleusBottom) < 1e-6 && x0 < bounds.nucleusRight && x1 > bounds.nucleusLeft) {
        surfaceNames.zmax = [
          ...(Array.isArray(surfaceNames.zmax) ? surfaceNames.zmax : surfaceNames.zmax ? [surfaceNames.zmax] : []),
          "cytoplasm_interface_surface",
          "cytoplasm_interface_bottom_surface",
        ];
      }
      if (Math.abs(z0 - bounds.nucleusTop) < 1e-6 && x0 < bounds.nucleusRight && x1 > bounds.nucleusLeft) {
        surfaceNames.zmin = [
          ...(Array.isArray(surfaceNames.zmin) ? surfaceNames.zmin : surfaceNames.zmin ? [surfaceNames.zmin] : []),
          "cytoplasm_interface_surface",
          "cytoplasm_interface_top_surface",
        ];
      }

      const block = builder.addHexBlock("cytoplasm", x0, x1, z0, z1, {
        material: "cytoplasm",
        nodeGroup: "cytoplasm",
        surfaceNames,
      });
      if (!block) {
        continue;
      }
      blocks.push(block);
      if (Math.abs(z0) < 1e-6) {
        builder.addToNodeSet("cell_base_nodes", block.nodeIds);
        const centerX = (x0 + x1) / 2;
        if (centerX < inputSpec.geometry.xn - inputSpec.geometry.Ln * 0.12) {
          builder.addToNodeSet("cd_left_cell_nodes", block.faces.zmin);
        } else if (centerX > inputSpec.geometry.xn + inputSpec.geometry.Ln * 0.12) {
          builder.addToNodeSet("cd_right_cell_nodes", block.faces.zmin);
        } else {
          builder.addToNodeSet("cd_center_cell_nodes", block.faces.zmin);
        }
      }
      if (Math.abs(x1 - bounds.nucleusLeft) < 1e-6 && z0 < bounds.nucleusTop && z1 > bounds.nucleusBottom) {
        builder.addToNodeSet("nc_left_cytoplasm_nodes", block.faces.xmax);
      }
      if (Math.abs(x0 - bounds.nucleusRight) < 1e-6 && z0 < bounds.nucleusTop && z1 > bounds.nucleusBottom) {
        builder.addToNodeSet("nc_right_cytoplasm_nodes", block.faces.xmin);
      }
      if (Math.abs(z1 - bounds.nucleusBottom) < 1e-6 && x0 < bounds.nucleusRight && x1 > bounds.nucleusLeft) {
        builder.addToNodeSet("nc_bottom_cytoplasm_nodes", block.faces.zmax);
      }
      if (Math.abs(z0 - bounds.nucleusTop) < 1e-6 && x0 < bounds.nucleusRight && x1 > bounds.nucleusLeft) {
        builder.addToNodeSet("nc_top_cytoplasm_nodes", block.faces.zmin);
      }
    }
  }
  return blocks;
}

function buildRefinedFebioGeometry(inputSpec) {
  const thickness = Math.max(0.6, inputSpec.geometry.rp * 0.28);
  const bounds = {
    cellLeft: -inputSpec.geometry.Lc / 2,
    cellRight: inputSpec.geometry.Lc / 2,
    cellTop: inputSpec.geometry.Hc,
    nucleusLeft: inputSpec.geometry.xn - inputSpec.geometry.Ln / 2,
    nucleusRight: inputSpec.geometry.xn + inputSpec.geometry.Ln / 2,
    nucleusBottom: inputSpec.geometry.yn - inputSpec.geometry.Hn / 2,
    nucleusTop: inputSpec.geometry.yn + inputSpec.geometry.Hn / 2,
    dishThickness: Math.max(1.8, inputSpec.geometry.Hc * 0.2),
  };

  bounds.nucleusBottom = clamp(bounds.nucleusBottom, 0.8, Math.max(bounds.cellTop - 1.2, 1));
  bounds.nucleusTop = clamp(bounds.nucleusTop, bounds.nucleusBottom + 0.8, bounds.cellTop - 0.4);
  bounds.nucleusLeft = clamp(bounds.nucleusLeft, bounds.cellLeft + 0.8, bounds.cellRight - 1.6);
  bounds.nucleusRight = clamp(bounds.nucleusRight, bounds.nucleusLeft + 0.8, bounds.cellRight - 0.8);

  const builder = createFebioMeshBuilder(thickness);
  buildRefinedNucleusMesh(builder, inputSpec, bounds);
  buildRefinedCellMesh(builder, inputSpec, bounds);
  buildDishGeometry(builder, bounds);
  buildPipetteGeometry(builder, inputSpec, bounds);
  builder.addSurfacePair("nucleus_cytoplasm_pair", "cytoplasm_interface_surface", "nucleus_interface_surface");
  builder.addSurfacePair("cell_dish_pair", "cell_dish_surface", "dish_top_surface");
  builder.addSurfacePair("pipette_nucleus_pair", "nucleus_top_surface", "pipette_contact_surface");
  builder.addSurfacePair("pipette_cell_pair", "cell_top_surface", "pipette_contact_surface");
  return {
    meshMode: "refined",
    thickness,
    bounds,
    ...builder.finalize(),
  };
}

function estimateHexVolume(nodesById, element) {
  const points = element.nodes.map((id) => nodesById.get(id)).filter(Boolean);
  if (points.length !== 8) {
    return 0;
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const zs = points.map((point) => point.z);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) * (Math.max(...zs) - Math.min(...zs));
}

function buildElementAdjacency(elements) {
  const nodeToElements = new Map();
  elements.forEach((element) => {
    element.nodes.forEach((nodeId) => {
      if (!nodeToElements.has(nodeId)) {
        nodeToElements.set(nodeId, []);
      }
      nodeToElements.get(nodeId).push(element.id);
    });
  });
  const adjacency = new Map(elements.map((element) => [element.id, new Set()]));
  nodeToElements.forEach((elementIds) => {
    elementIds.forEach((leftId) => {
      elementIds.forEach((rightId) => {
        if (leftId !== rightId) {
          adjacency.get(leftId)?.add(rightId);
        }
      });
    });
  });
  return adjacency;
}

function validateFebioMesh(mesh) {
  const report = {
    valid: true,
    invalidElements: [],
    zeroOrNegativeVolume: [],
    duplicatedNodes: [],
    overlappingNodesAcrossBodies: [],
    disconnectedRegions: [],
    aspectRatioWarnings: [],
    warnings: [],
  };

  const nodesById = new Map(mesh.nodes.map((node) => [node.id, node]));
  const coordinateKeys = new Map();
  mesh.nodes.forEach((node) => {
    const key = `${node.x.toFixed(6)}|${node.y.toFixed(6)}|${node.z.toFixed(6)}`;
    if (coordinateKeys.has(key)) {
      const existingId = coordinateKeys.get(key);
      const existingNode = nodesById.get(existingId);
      if ((existingNode?.nodeGroup || "global") === (node.nodeGroup || "global")) {
        report.duplicatedNodes.push([existingId, node.id]);
      } else {
        report.overlappingNodesAcrossBodies.push({
          ids: [existingId, node.id],
          groups: [existingNode?.nodeGroup || "global", node.nodeGroup || "global"],
        });
      }
    } else {
      coordinateKeys.set(key, node.id);
    }
  });

  mesh.elements.forEach((element) => {
    if (element.type !== "hex8" || element.nodes.length !== 8) {
      report.invalidElements.push(element.id);
      return;
    }
    const volume = estimateHexVolume(nodesById, element);
    if (!(volume > 0)) {
      report.zeroOrNegativeVolume.push(element.id);
    }
    const points = element.nodes.map((id) => nodesById.get(id)).filter(Boolean);
    if (points.length === 8) {
      const spans = [
        Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x)),
        Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y)),
        Math.max(...points.map((point) => point.z)) - Math.min(...points.map((point) => point.z)),
      ].filter((span) => span > 1e-6);
      if (spans.length) {
        const ratio = Math.max(...spans) / Math.min(...spans);
        if (ratio > 12) {
          report.aspectRatioWarnings.push({ elementId: element.id, aspectRatio: ratio });
        }
      }
    }
  });

  const adjacency = buildElementAdjacency(mesh.elements);
  Object.entries(mesh.elementSets).forEach(([name, ids]) => {
    if (!ids.length) {
      return;
    }
    const visited = new Set();
    const queue = [ids[0]];
    while (queue.length) {
      const current = queue.shift();
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      (adjacency.get(current) || []).forEach((neighbor) => {
        if (ids.includes(neighbor) && !visited.has(neighbor)) {
          queue.push(neighbor);
        }
      });
    }
    if (visited.size !== ids.length) {
      report.disconnectedRegions.push({
        elementSet: name,
        connectedCount: visited.size,
        expectedCount: ids.length,
      });
    }
  });

  report.valid =
    !report.invalidElements.length &&
    !report.zeroOrNegativeVolume.length &&
    !report.duplicatedNodes.length &&
    !report.disconnectedRegions.length;
  if (report.overlappingNodesAcrossBodies.length) {
    report.warnings.push("overlapping interface nodes detected across independent bodies");
  }
  if (report.aspectRatioWarnings.length) {
    report.warnings.push("high aspect ratio elements detected");
  }
  return report;
}

function buildFebioLogOutputs(mesh, templateData) {
  const buildFaceLogOutput = (name, file, surface, currentCoverage = {}) => ({
    type: "face_data",
    name,
    file,
    data: "contact gap;contact pressure",
    surface,
    delimiter: ",",
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
  });
  const buildPlotfileSurfaceTraction = (name, surface, interfaceGroup, region, sectionAxes) => ({
    name,
    variable: "contact traction",
    surface,
    interfaceGroup,
    region,
    alias: `${name}_contact_traction`,
    payloadPath: `plotfileSurfaceData.${interfaceGroup}.${region}`,
    preferredSource: "native-plotfile-contact-traction",
    sectionAxes: structuredClone(sectionAxes),
    notes: [
      "Standard FEBio path can bridge solver-native tangential traction from the plotfile contact traction variable.",
      "Bridge payloads should write per-step traction data to the declared payloadPath so converter/import can prefer it over shear proxy fallback.",
    ],
  });

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
      buildFaceLogOutput("pipette_contact_surface", "febio_pipette_contact.csv", "pipette_contact_surface", {
        normal: "native-face-data-preferred",
        damage: "proxy-fallback-explicit",
        shear: "not-used",
      }),
      buildFaceLogOutput("nucleus_cytoplasm_interface_surface", "febio_interface_nucleus_cytoplasm.csv", "nucleus_interface_surface"),
      buildFaceLogOutput("nucleus_cytoplasm_left_surface", "febio_interface_nc_left.csv", "nucleus_interface_left_surface"),
      buildFaceLogOutput("nucleus_cytoplasm_right_surface", "febio_interface_nc_right.csv", "nucleus_interface_right_surface"),
      buildFaceLogOutput("nucleus_cytoplasm_top_surface", "febio_interface_nc_top.csv", "nucleus_interface_top_surface"),
      buildFaceLogOutput("nucleus_cytoplasm_bottom_surface", "febio_interface_nc_bottom.csv", "nucleus_interface_bottom_surface"),
      buildFaceLogOutput("cell_dish_interface_surface", "febio_interface_cell_dish.csv", "cell_dish_surface"),
      buildFaceLogOutput("cell_dish_left_surface", "febio_interface_cd_left.csv", "cell_dish_left_surface"),
      buildFaceLogOutput("cell_dish_center_surface", "febio_interface_cd_center.csv", "cell_dish_center_surface"),
      buildFaceLogOutput("cell_dish_right_surface", "febio_interface_cd_right.csv", "cell_dish_right_surface"),
    ],
    plotfileSurfaceData: [
      buildPlotfileSurfaceTraction(
        "nucleus_cytoplasm_left_surface",
        "nucleus_interface_left_surface",
        "localNc",
        "left",
        { normal: "x", tangential: "z" },
      ),
      buildPlotfileSurfaceTraction(
        "nucleus_cytoplasm_right_surface",
        "nucleus_interface_right_surface",
        "localNc",
        "right",
        { normal: "x", tangential: "z" },
      ),
      buildPlotfileSurfaceTraction(
        "nucleus_cytoplasm_top_surface",
        "nucleus_interface_top_surface",
        "localNc",
        "top",
        { normal: "z", tangential: "x" },
      ),
      buildPlotfileSurfaceTraction(
        "nucleus_cytoplasm_bottom_surface",
        "nucleus_interface_bottom_surface",
        "localNc",
        "bottom",
        { normal: "z", tangential: "x" },
      ),
      buildPlotfileSurfaceTraction(
        "cell_dish_left_surface",
        "cell_dish_left_surface",
        "localCd",
        "left",
        { normal: "z", tangential: "x" },
      ),
      buildPlotfileSurfaceTraction(
        "cell_dish_center_surface",
        "cell_dish_center_surface",
        "localCd",
        "center",
        { normal: "z", tangential: "x" },
      ),
      buildPlotfileSurfaceTraction(
        "cell_dish_right_surface",
        "cell_dish_right_surface",
        "localCd",
        "right",
        { normal: "z", tangential: "x" },
      ),
    ],
  };
}

function buildMembraneModelSpec(inputSpec) {
  const membraneModel = inputSpec.membraneModel || "cortex_proxy";
  if (membraneModel === "shell_membrane_placeholder") {
    return {
      type: "shell_membrane_placeholder",
      status: "partial-shell-placeholder",
      notes: [
        "shell membrane topology is not exported as dedicated shell elements yet",
        "thresholds and tension are preserved for a later shell serializer",
      ],
      tension: inputSpec.membrane.Tm,
      thresholds: {
        global: inputSpec.membrane.sig_m_crit,
        top_neck: inputSpec.membrane.sig_m_crit_top,
        side: inputSpec.membrane.sig_m_crit_side,
        basal: inputSpec.membrane.sig_m_crit_basal,
      },
    };
  }
  return {
    type: "cortex_proxy",
    status: "implemented-proxy",
    notes: ["membrane remains a cortex proxy in the FEBio path"],
    tension: inputSpec.membrane.Tm,
    thresholds: {
      global: inputSpec.membrane.sig_m_crit,
      top_neck: inputSpec.membrane.sig_m_crit_top,
      side: inputSpec.membrane.sig_m_crit_side,
      basal: inputSpec.membrane.sig_m_crit_basal,
    },
  };
}

function deriveRelaxationTime(elasticModulus, viscosity) {
  return Math.max(Number(viscosity || 0) / Math.max(Number(elasticModulus || 0), 1e-6), 1e-4);
}

function deriveRelaxationStrength(elasticModulus, viscosity) {
  const ratio = Number(viscosity || 0) / Math.max(Number(elasticModulus || 0), 1e-6);
  return clamp(ratio / (1 + ratio), 0.05, 0.45);
}

function buildViscoelasticMaterialSpec(name, domain, elastic, viscous, optionalNonlinear = null) {
  const eta = Number(viscous?.eta || 0);
  const hasViscoelasticBranch = eta > 0;
  return {
    name,
    domain,
    status: hasViscoelasticBranch
      ? "implemented-single-branch-viscoelastic / planned-nonlinear"
      : "implemented-elastic / planned-viscoelastic",
    type: hasViscoelasticBranch ? "viscoelastic" : "neo-Hookean",
    febioMaterialType: hasViscoelasticBranch ? "viscoelastic" : "neo-Hookean",
    elastic: {
      model: "neo-Hookean",
      E: elastic.E,
      v: elastic.v,
    },
    viscous: {
      eta,
      implemented: hasViscoelasticBranch,
      febioType: hasViscoelasticBranch ? "single-branch relaxation" : "none",
      relaxationTime: hasViscoelasticBranch ? deriveRelaxationTime(elastic.E, eta) : null,
      relaxationStrength: hasViscoelasticBranch ? deriveRelaxationStrength(elastic.E, eta) : null,
    },
    optionalNonlinear: {
      alpha: Number(optionalNonlinear?.alpha || 0),
      status: Number(optionalNonlinear?.alpha || 0) > 0 ? "planned-not-serialized" : "not-requested",
    },
  };
}

function buildCohesiveApproximation(interfaceSpec, fallbackScale) {
  const normalStiffness = Number(interfaceSpec.normalStiffness || 0);
  const tangentialStiffness = Number(interfaceSpec.tangentialStiffness || 0);
  const criticalNormalStress = Number(interfaceSpec.criticalNormalStress || 0);
  const criticalShearStress = Number(interfaceSpec.criticalShearStress || 0);
  const fractureEnergy = Number(interfaceSpec.fractureEnergy || 0);
  const softStartScale = 0.55;
  return {
    type: "sticky",
    mode: "cohesive-approximation",
    status: "partial-cohesive-approximation",
    penalty: Math.max(normalStiffness * fallbackScale * softStartScale, 0.03),
    tangentialPenalty: Math.max(tangentialStiffness * fallbackScale * softStartScale, 0.03),
    maxTraction: clamp(criticalNormalStress * softStartScale, 0.03, 0.25),
    tangentialLimit: clamp(criticalShearStress * softStartScale, 0.01, 0.2),
    snapTolerance: clamp((fractureEnergy / Math.max(criticalNormalStress, 0.05)) * 0.28, 0.01, 0.12),
    searchTolerance: Math.max(Number(interfaceSpec.tolerance || 0.05), 0.08),
    frictionProxy: clamp((criticalShearStress / Math.max(criticalNormalStress, 1e-6)) * 0.35, 0, 0.75),
    notes: [
      "serialized as a sticky-contact cohesive approximation with soft-start stabilization",
      "normal/tangential stiffness and traction limits are preserved for later true cohesive serialization",
    ],
  };
}

function buildStaticControlForStep(stepName) {
  const defaults = {
    timeSteps: 50,
    stepSize: 0.02,
  };
  if (stepName === "approach" || stepName === "lift") {
    return {
      timeSteps: 60,
      stepSize: 1 / 60,
    };
  }
  if (stepName === "hold") {
    return {
      timeSteps: 40,
      stepSize: 0.025,
    };
  }
  if (stepName === "inward" || stepName === "mixed" || stepName.startsWith("manipulation")) {
    return {
      timeSteps: stepName === "manipulation-1" ? 90 : 100,
      stepSize: stepName === "manipulation-1" ? 1 / 90 : 0.01,
    };
  }
  if (stepName === "release-test") {
    return {
      timeSteps: 60,
      stepSize: 1 / 60,
    };
  }
  return defaults;
}

function buildNodeLookup(mesh) {
  return new Map(mesh.nodes.map((node) => [node.id, node]));
}

function pairNodeSetsByCoordinate(mesh, primarySetName, secondarySetName) {
  const nodeLookup = buildNodeLookup(mesh);
  const primaryIds = mesh.nodeSets[primarySetName] || [];
  const secondaryIds = mesh.nodeSets[secondarySetName] || [];
  const secondaryByCoord = new Map();
  secondaryIds.forEach((id) => {
    const node = nodeLookup.get(id);
    if (!node) {
      return;
    }
    const key = `${node.x.toFixed(6)}|${node.y.toFixed(6)}|${node.z.toFixed(6)}`;
    if (!secondaryByCoord.has(key)) {
      secondaryByCoord.set(key, []);
    }
    secondaryByCoord.get(key).push(id);
  });
  const pairs = [];
  primaryIds.forEach((id) => {
    const node = nodeLookup.get(id);
    if (!node) {
      return;
    }
    const key = `${node.x.toFixed(6)}|${node.y.toFixed(6)}|${node.z.toFixed(6)}`;
    const secondaryMatches = secondaryByCoord.get(key);
    if (!secondaryMatches?.length) {
      return;
    }
    const partnerId = secondaryMatches.shift();
    pairs.push([id, partnerId]);
  });
  return pairs;
}

function buildCohesiveLawPoints(spec, areaScale = 1) {
  const kn = Number(spec.normalStiffness || 0);
  const sig = Math.max(Number(spec.criticalNormalStress || 0), 1e-6);
  const gc = Math.max(Number(spec.fractureEnergy || 0), 1e-6);
  const delta0 = Math.max(sig / Math.max(kn, 1e-6), 1e-4);
  const deltaF = Math.max(delta0 + (2 * gc) / sig, delta0 * 2.5);
  const peakForce = sig * areaScale;
  return [
    [0, 0],
    [delta0, peakForce],
    [deltaF, 0],
    [deltaF * 1.05, 0],
  ];
}

function buildDiscreteCohesiveInterface(mesh, name, spec, regionPairs, idBase = {}) {
  const sets = [];
  const materials = [];
  const loadControllers = [];
  let nextMaterialId = idBase.materialIdStart || 200;
  let nextLoadControllerId = idBase.loadControllerIdStart || 300;
  let nextDiscreteId = idBase.discreteIdStart || 1;

  regionPairs.forEach((regionPair) => {
    const pairs = pairNodeSetsByCoordinate(mesh, regionPair.primaryNodeSet, regionPair.secondaryNodeSet);
    if (!pairs.length) {
      return;
    }
    const setName = `${name}_${regionPair.region}_springs`;
    const discreteElements = pairs.map((pair) => ({
      id: nextDiscreteId++,
      nodes: pair,
    }));
    const areaScale = Math.max(regionPair.areaScale || 1 / pairs.length, 1e-4);
    const loadCurveId = nextLoadControllerId++;
    loadControllers.push({
      id: loadCurveId,
      type: "loadcurve",
      interpolate: "LINEAR",
      extend: "CONSTANT",
      points: buildCohesiveLawPoints(spec, areaScale),
    });
    materials.push({
      id: nextMaterialId++,
      name: `${setName}_material`,
      type: "nonlinear spring",
      measure: "elongation",
      scale: 1,
      forceLoadCurveId: loadCurveId,
      region: regionPair.region,
      status: "implemented-sidecar",
    });
    sets.push({
      name: setName,
      region: regionPair.region,
      elements: discreteElements,
      materialName: `${setName}_material`,
    });
  });

  return {
    type: "discrete-cohesive-springs",
    status: sets.length ? "implemented-sidecar / not solver-primary" : "planned-no-node-pairs",
    sets,
    materials,
    loadControllers,
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
  const mesh = buildRefinedFebioGeometry(inputSpec);
  const meshValidation = validateFebioMesh(mesh);
  const membraneModel = buildMembraneModelSpec(inputSpec);
  const febioTargets = buildFebioRigidTargets(inputSpec);
  const releaseTestEnabled = febioTargets.stepTargets.some((step) => step.name === "release-test");
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
  const discreteCohesive = {
    nucleusCytoplasm: buildDiscreteCohesiveInterface(
      mesh,
      "nucleus_cytoplasm",
      {
        normalStiffness: inputSpec.interfaces.Kn_nc,
        criticalNormalStress: inputSpec.interfaces.sig_nc_crit,
        fractureEnergy: inputSpec.interfaces.Gc_nc,
      },
      [
        { region: "left", primaryNodeSet: "nc_left_nucleus_nodes", secondaryNodeSet: "nc_left_cytoplasm_nodes" },
        { region: "right", primaryNodeSet: "nc_right_nucleus_nodes", secondaryNodeSet: "nc_right_cytoplasm_nodes" },
        { region: "top", primaryNodeSet: "nc_top_nucleus_nodes", secondaryNodeSet: "nc_top_cytoplasm_nodes" },
        { region: "bottom", primaryNodeSet: "nc_bottom_nucleus_nodes", secondaryNodeSet: "nc_bottom_cytoplasm_nodes" },
      ],
      { materialIdStart: 200, loadControllerIdStart: 300, discreteIdStart: 1 },
    ),
    cellDish: buildDiscreteCohesiveInterface(
      mesh,
      "cell_dish",
      {
        normalStiffness: inputSpec.interfaces.Kn_cd,
        criticalNormalStress: inputSpec.interfaces.sig_cd_crit,
        fractureEnergy: inputSpec.interfaces.Gc_cd,
      },
      [
        { region: "left", primaryNodeSet: "cd_left_cell_nodes", secondaryNodeSet: "dish_fixed_nodes" },
        { region: "center", primaryNodeSet: "cd_center_cell_nodes", secondaryNodeSet: "dish_fixed_nodes" },
        { region: "right", primaryNodeSet: "cd_right_cell_nodes", secondaryNodeSet: "dish_fixed_nodes" },
      ],
      { materialIdStart: 400, loadControllerIdStart: 500, discreteIdStart: 1001 },
    ),
  };

  const templateData = {
    status: {
      buildMode: mesh.meshMode || "refined",
      isPlaceholder: false,
      meshValidated: meshValidation.valid,
      membraneModel: membraneModel.type,
      notes: [
        ...membraneModel.notes,
        "nucleus/cytoplasm viscoelastic terms are serialized as a single-branch FEBio viscoelastic approximation",
        "nucleus/cytoplasm is solver-primary as a sticky cohesive approximation; cell-dish remains tied-elastic-active",
        releaseTestEnabled
          ? "release-test step is enabled for debug/validation runs"
          : "release-test step is disabled in the main flow until the hold/release law is stabilized",
        "main-flow inward manipulation is split into staged targets to reduce the first-step jacobian collapse risk",
        "discrete cohesive spring sidecar sets are exported for future solver-primary cohesive activation",
      ],
    },
    parameterDigest: inputSpec.parameterDigest,
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
        thresholds: structuredClone(membraneModel.thresholds),
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
        ...buildViscoelasticMaterialSpec(
          "nucleus",
          "nucleus",
          {
          E: inputSpec.material.En,
          v: inputSpec.material.nun,
          },
          { eta: inputSpec.material.etan },
          { alpha: inputSpec.material.alpha_nonlinear },
        ),
      },
      cytoplasm: {
        id: 2,
        ...buildViscoelasticMaterialSpec(
          "cytoplasm",
          "cytoplasm",
          {
          E: inputSpec.material.Ec,
          v: inputSpec.material.nuc,
          },
          { eta: inputSpec.material.etac },
        ),
      },
      membrane: {
        id: 3,
        name: "membrane",
        type: membraneModel.type,
        domain: null,
        status: membraneModel.status,
        tension: membraneModel.tension,
        thresholds: structuredClone(membraneModel.thresholds),
        notes: [...membraneModel.notes],
      },
      dish: {
        id: 4,
        name: "dish",
        type: "neo-Hookean",
        domain: "dish",
        status: "implemented",
        elastic: {
          E: Math.max(inputSpec.material.Ec * 40, 250),
          v: 0.3,
        },
      },
      pipette: {
        id: 5,
        name: "pipette_rigid",
        type: "rigid body",
        domain: "pipette",
        status: "implemented-rigid",
        elastic: {
          E: Math.max(inputSpec.material.En * 60, 600),
          v: 0.25,
        },
        density: 1,
        center_of_mass: initialPipetteCenter,
        isRigid: true,
      },
    },
    interfaces: {
      nucleusCytoplasm: {
        type: "sticky",
        status: "partial-true-cohesive / sticky-active",
        mode: "solver-primary cohesive-approximation",
        surfacePair: mesh.surfacePairs.nucleus_cytoplasm_pair,
        normalStiffness: inputSpec.interfaces.Kn_nc,
        tangentialStiffness: inputSpec.interfaces.Kt_nc,
        criticalNormalStress: inputSpec.interfaces.sig_nc_crit,
        criticalShearStress: inputSpec.interfaces.tau_nc_crit,
        fractureEnergy: inputSpec.interfaces.Gc_nc,
        penalty: {
          Kn: Math.max(inputSpec.interfaces.Kn_nc * 0.08, 0.03),
          Kt: Math.max(inputSpec.interfaces.Kt_nc * 0.08, 0.03),
        },
        tolerance: 0.08,
        cohesiveApproximation: buildCohesiveApproximation(
          {
            normalStiffness: inputSpec.interfaces.Kn_nc,
            tangentialStiffness: inputSpec.interfaces.Kt_nc,
            criticalNormalStress: inputSpec.interfaces.sig_nc_crit,
            criticalShearStress: inputSpec.interfaces.tau_nc_crit,
            fractureEnergy: inputSpec.interfaces.Gc_nc,
            tolerance: 0.08,
          },
          0.18,
        ),
        maxTraction: clamp(inputSpec.interfaces.sig_nc_crit * 0.55, 0.03, 0.25),
        snapTolerance: clamp(
          (inputSpec.interfaces.Gc_nc / Math.max(inputSpec.interfaces.sig_nc_crit, 0.05)) * 0.28,
          0.01,
          0.12,
        ),
        searchTolerance: 0.08,
        searchRadius: Math.max(inputSpec.geometry.rp * 1.1, 0.7),
        symmetricStiffness: 0,
        autoPenalty: 1,
        friction: clamp(
          (inputSpec.interfaces.tau_nc_crit / Math.max(inputSpec.interfaces.sig_nc_crit, 1e-6)) * 0.35,
          0,
          0.75,
        ),
      },
      cellDish: {
        type: "tied-elastic",
        status: "partial-cohesive-ready / tied-elastic-active",
        surfacePair: mesh.surfacePairs.cell_dish_pair,
        normalStiffness: inputSpec.interfaces.Kn_cd,
        tangentialStiffness: inputSpec.interfaces.Kt_cd,
        criticalNormalStress: inputSpec.interfaces.sig_cd_crit,
        criticalShearStress: inputSpec.interfaces.tau_cd_crit,
        fractureEnergy: inputSpec.interfaces.Gc_cd,
        penalty: {
          Kn: Math.max(inputSpec.interfaces.Kn_cd * 0.12, 0.12),
          Kt: Math.max(inputSpec.interfaces.Kt_cd * 0.12, 0.08),
        },
        adhesionPattern: inputSpec.adhesionPattern,
        adhesionSeed: inputSpec.adhesionSeed,
        tolerance: 0.05,
        cohesiveApproximation: buildCohesiveApproximation(
          {
            normalStiffness: inputSpec.interfaces.Kn_cd,
            tangentialStiffness: inputSpec.interfaces.Kt_cd,
            criticalNormalStress: inputSpec.interfaces.sig_cd_crit,
            criticalShearStress: inputSpec.interfaces.tau_cd_crit,
            fractureEnergy: inputSpec.interfaces.Gc_cd,
            tolerance: 0.05,
          },
          0.12,
        ),
      },
    },
    discreteCohesive,
    contact: {
      pipetteNucleus: {
        type: "sticky",
        status: "partial-releaseable-hold",
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
        snapTolerance: clamp(inputSpec.geometry.rp * 0.03, 0.05, 0.18),
        releaseCondition: {
          type: "traction-or-slip-threshold",
          tractionLimit: Math.max(inputSpec.operation.Fhold * 0.05, 0.25),
          slipDistance: clamp(inputSpec.geometry.rp * 0.05, 0.08, 0.3),
          note: "modeled with sticky release approximation until a dedicated hold-release law is available",
        },
      },
      pipetteCell: {
        type: "sliding-elastic",
        status: "implemented-secondary-contact",
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
    steps: stepSequence.map((step) => ({
      ...step,
      controlSettings: buildStaticControlForStep(step.name),
    })),
    boundaryConditions: [
      { name: "fix_dish", target: "dish_fixed_nodes", type: "zero displacement", dofs: ["x", "y", "z"] },
      { name: "support_cell_base_z", target: "cell_base_nodes", type: "zero displacement", dofs: ["z"] },
      { name: "section_plane_lock", target: "deformable_nodes_set", type: "zero displacement", dofs: ["y"] },
    ],
    outputRequests: [
      { field: "displacement", target: "nodes", status: "implemented", source: "plotfile+node_log" },
      { field: "interface damage", target: "nucleus-cytoplasm", status: "partial-native-gap-pressure", source: "region face_data gap+pressure mapped to localNc damage" },
      { field: "interface traction", target: "nucleus-cytoplasm", status: "implemented-normal / shear-proxy", source: "region face_data pressure for normal, node displacement proxy for shear" },
      { field: "interface damage", target: "cell-dish", status: "partial-proxy", source: "node displacement proxy with face_data gap/pressure assist" },
      { field: "interface traction", target: "cell-dish", status: "partial-face-pressure-proxy", source: "face_data pressure for normal, node displacement proxy for shear" },
      { field: "contact force", target: "pipette contact", status: "implemented", source: "rigid_body_data+face_data" },
      { field: "contact state", target: "pipette-nucleus", status: "partial-proxy", source: "sticky contact pressure/gap proxy" },
      { field: "reaction force", target: "nodes", status: "implemented", source: "node_log" },
      { field: "membrane stress proxy", target: "membrane regions", status: membraneModel.type === "cortex_proxy" ? "implemented-proxy" : "planned-shell", source: membraneModel.type === "cortex_proxy" ? "post-process proxy" : "planned shell output" },
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
  if (material.febioMaterialType === "viscoelastic") {
    // FEBio material choice: viscoelastic wrapper with a neo-Hookean elastic base
    // and a single relaxation branch derived from the UI viscosity parameter.
    return `    <material id="${material.id}" name="${escapeXml(material.name)}" type="viscoelastic">
      <elastic type="neo-Hookean">
        <E>${Number(material.elastic?.E || 0).toFixed(6)}</E>
        <v>${Number(material.elastic?.v || 0.3).toFixed(6)}</v>
      </elastic>
      <g1>${Number(material.viscous?.relaxationStrength || 0).toFixed(6)}</g1>
      <t1>${Number(material.viscous?.relaxationTime || 0).toFixed(6)}</t1>
      <!-- viscosity eta=${Number(material.viscous?.eta || 0).toFixed(6)} -->
      <!-- optionalNonlinear alpha=${Number(material.optionalNonlinear?.alpha || 0).toFixed(6)} status=${escapeXml(material.optionalNonlinear?.status || "n/a")} -->
    </material>`;
  }
  if (material.type === "rigid body") {
    const centerOfMass = material.center_of_mass || [0, 0, 0];
    return `    <material id="${material.id}" name="${escapeXml(material.name)}" type="rigid body">
      <density>${Number(material.density || 1).toFixed(6)}</density>
      <center_of_mass>${formatVector(centerOfMass)}</center_of_mass>
      <E>${Number(material.elastic?.E || 0).toFixed(6)}</E>
      <v>${Number(material.elastic?.v || 0.3).toFixed(6)}</v>
    </material>`;
  }
  return `    <material id="${material.id}" name="${escapeXml(material.name)}" type="${escapeXml(material.type)}">
      <E>${Number(material.elastic?.E || 0).toFixed(6)}</E>
      <v>${Number(material.elastic?.v || 0.3).toFixed(6)}</v>
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

function serializeCohesiveReadyInterfaceXml(name, spec) {
  const approx = spec.cohesiveApproximation || {};
  return `    <contact name="${escapeXml(name)}" type="tied-elastic" surface_pair="${escapeXml(spec.surfacePair.name)}">
      <penalty>${Number(spec.penalty?.Kn || spec.normalStiffness || 1).toFixed(6)}</penalty>
      <tolerance>${Number(spec.tolerance || approx.searchTolerance || 0.2).toFixed(6)}</tolerance>
      <!-- cohesive-ready normalStiffness=${Number(spec.normalStiffness || 0).toFixed(6)} tangentialStiffness=${Number(spec.tangentialStiffness || 0).toFixed(6)} -->
      <!-- cohesive-ready criticalNormalStress=${Number(spec.criticalNormalStress || 0).toFixed(6)} criticalShearStress=${Number(spec.criticalShearStress || 0).toFixed(6)} fractureEnergy=${Number(spec.fractureEnergy || 0).toFixed(6)} -->
      <!-- cohesive-ready mappedPenaltyN=${Number(approx.penalty || spec.penalty?.Kn || 0).toFixed(6)} mappedPenaltyT=${Number(approx.tangentialPenalty || spec.penalty?.Kt || 0).toFixed(6)} mappedMaxTraction=${Number(approx.maxTraction || 0).toFixed(6)} mappedSnapTol=${Number(approx.snapTolerance || 0).toFixed(6)} status=${escapeXml(spec.status || "n/a")} -->
    </contact>`;
}

function serializeStickyCohesiveInterfaceXml(name, spec) {
  const approx = spec.cohesiveApproximation || {};
  return `    <contact name="${escapeXml(name)}" type="sticky" surface_pair="${escapeXml(spec.surfacePair.name)}">
      <penalty>${Number(approx.penalty || spec.penalty?.Kn || spec.normalStiffness || 1).toFixed(6)}</penalty>
      <laugon>0</laugon>
      <tolerance>${Number(spec.tolerance || approx.searchTolerance || 0.05).toFixed(6)}</tolerance>
      <minaug>0</minaug>
      <maxaug>5</maxaug>
      <search_tolerance>${Number(spec.searchTolerance || approx.searchTolerance || 0.05).toFixed(6)}</search_tolerance>
      <max_traction>${Number(spec.maxTraction || approx.maxTraction || spec.criticalNormalStress || 0).toFixed(6)}</max_traction>
      <snap_tol>${Number(spec.snapTolerance || approx.snapTolerance || 0.1).toFixed(6)}</snap_tol>
      <!-- solver-primary cohesive approximation -->
      <!-- cohesive normalStiffness=${Number(spec.normalStiffness || 0).toFixed(6)} tangentialStiffness=${Number(spec.tangentialStiffness || 0).toFixed(6)} -->
      <!-- cohesive criticalNormalStress=${Number(spec.criticalNormalStress || 0).toFixed(6)} criticalShearStress=${Number(spec.criticalShearStress || 0).toFixed(6)} fractureEnergy=${Number(spec.fractureEnergy || 0).toFixed(6)} -->
      <!-- cohesive frictionProxy=${Number(spec.friction || approx.frictionProxy || 0).toFixed(6)} tangentialPenalty=${Number(approx.tangentialPenalty || spec.penalty?.Kt || 0).toFixed(6)} status=${escapeXml(spec.status || "n/a")} -->
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
      <!-- releaseable-hold friction=${Number(spec.friction || 0).toFixed(6)} releaseTraction=${Number(spec.releaseCondition?.tractionLimit || spec.maxTraction || 0).toFixed(6)} slipDistance=${Number(spec.releaseCondition?.slipDistance || 0).toFixed(6)} status=${escapeXml(spec.status || "n/a")} -->
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
    ...(logOutputs.faceData || []).map(
      (spec) =>
        `      <face_data name="${escapeXml(spec.name)}" file="${escapeXml(spec.file)}" data="${escapeXml(spec.data)}" delim="${escapeXml(spec.delimiter || ",")}" surface="${escapeXml(spec.surface)}" />`,
    ),
  ];
  if (!entries.length) {
    return "";
  }
  return `    <logfile>\n${entries.join("\n")}\n    </logfile>`;
}

function serializePlotfileSection(logOutputs = {}) {
  const plotfileVars = [
    '      <var type="displacement" />',
    '      <var type="stress" />',
    '      <var type="contact force" />',
    '      <var type="reaction forces" />',
    ...(logOutputs.plotfileSurfaceData || []).map(
      (spec) => `      <var type="${escapeXml(spec.variable || "contact traction")}" surface="${escapeXml(spec.surface)}" />`,
    ),
  ];
  return `    <plotfile type="febio">
${plotfileVars.join("\n")}
    </plotfile>`;
}

function serializeDiscreteSetXml(discreteSet) {
  return `    <DiscreteSet name="${escapeXml(discreteSet.name)}">
${discreteSet.elements.map((element) => `      <delem id="${element.id}">${element.nodes.join(",")}</delem>`).join("\n")}
    </DiscreteSet>`;
}

function serializeDiscreteMaterialXml(material) {
  return `    <discrete_material id="${material.id}" name="${escapeXml(material.name)}" type="nonlinear spring">
      <scale>${Number(material.scale || 1).toFixed(6)}</scale>
      <measure>${escapeXml(material.measure || "elongation")}</measure>
      <force lc="${material.forceLoadCurveId}">1.0</force>
    </discrete_material>`;
}

function serializeLoadControllerXml(controller) {
  return `    <load_controller id="${controller.id}" type="${escapeXml(controller.type || "loadcurve")}">
      <interpolate>${escapeXml(controller.interpolate || "LINEAR")}</interpolate>
      <extend>${escapeXml(controller.extend || "CONSTANT")}</extend>
      <points>
${controller.points.map((point) => `        <point>${Number(point[0]).toFixed(6)}, ${Number(point[1]).toFixed(6)}</point>`).join("\n")}
      </points>
    </load_controller>`;
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
  const discreteSets = [
    ...(templateData.discreteCohesive?.nucleusCytoplasm?.sets || []),
    ...(templateData.discreteCohesive?.cellDish?.sets || []),
  ];
  const discreteSetsXml = discreteSets.map((set) => serializeDiscreteSetXml(set));
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
  const interfaceXml = [
    templateData.interfaces.nucleusCytoplasm.type === "sticky"
      ? serializeStickyCohesiveInterfaceXml("nucleus_cytoplasm_interface", templateData.interfaces.nucleusCytoplasm)
      : serializeCohesiveReadyInterfaceXml("nucleus_cytoplasm_interface", templateData.interfaces.nucleusCytoplasm),
    templateData.interfaces.cellDish.type === "sticky"
      ? serializeStickyCohesiveInterfaceXml("cell_dish_interface", templateData.interfaces.cellDish)
      : serializeCohesiveReadyInterfaceXml("cell_dish_interface", templateData.interfaces.cellDish),
  ];
  const contactXml = [
    ...interfaceXml,
    templateData.contact.pipetteNucleus.type === "sticky"
      ? serializeStickyContactXml("pipette_nucleus_contact", templateData.contact.pipetteNucleus)
      : serializeSlidingContactXml("pipette_nucleus_contact", templateData.contact.pipetteNucleus),
    serializeSlidingContactXml("pipette_cell_contact", templateData.contact.pipetteCell),
  ].join("\n");
  const rigidRootXml = templateData.rigid?.pipette ? serializeRigidBoundaryXml(templateData.rigid.pipette) : "";
  const stepXml = templateData.steps
    .map((step, index) => {
      const controlSettings = step.controlSettings || { timeSteps: 25, stepSize: 0.04 };
      return `    <step id="${index + 1}" name="${escapeXml(step.name)}">
    <Control>
      <analysis>static</analysis>
      <time_steps>${Number(controlSettings.timeSteps || 25).toFixed(0)}</time_steps>
      <step_size>${Number(controlSettings.stepSize || 0.04).toFixed(6)}</step_size>
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
  const outputStatusXml = templateData.outputRequests
    .map(
      (request) =>
        `      <!-- ${escapeXml(request.field)} | target=${escapeXml(request.target)} | status=${escapeXml(request.status)} | source=${escapeXml(request.source || "n/a")} -->`,
    )
    .join("\n");
  const discreteMaterials = [
    ...(templateData.discreteCohesive?.nucleusCytoplasm?.materials || []),
    ...(templateData.discreteCohesive?.cellDish?.materials || []),
  ];
  const discreteControllers = [
    ...(templateData.discreteCohesive?.nucleusCytoplasm?.loadControllers || []),
    ...(templateData.discreteCohesive?.cellDish?.loadControllers || []),
  ];
  const discreteSidecarXml = discreteMaterials.length
    ? [
        "  <!-- cohesive discrete sidecar (not solver-active yet)",
        ...discreteSets.map((set) => `       set ${set.name} region=${set.region} count=${set.elements.length}`),
        ...discreteMaterials.map(
          (material) =>
            `       discrete_material ${material.name} type=${material.type} lc=${material.forceLoadCurveId} status=${material.status}`,
        ),
        ...discreteControllers.map(
          (controller) =>
            `       load_controller ${controller.id} points=${controller.points.map((point) => `${point[0].toFixed(6)},${point[1].toFixed(6)}`).join(" | ")}`,
        ),
        "  -->",
      ].join("\n")
    : "";

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
${discreteSetsXml.join("\n")}
${surfacePairsXml.join("\n")}
  </Mesh>
  <MeshDomains>
${meshDomainsXml}
  </MeshDomains>
${discreteSidecarXml}
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
${outputStatusXml}
${serializePlotfileSection(templateData.logOutputs)}
  </Output>
</febio_spec>`;
}

function exportFebioXmlContent(inputSpec) {
  const templateData = inputSpec.febioTemplateData || buildFebioTemplateData(inputSpec);
  return serializeFebioTemplateToXml(templateData);
}

function buildExpectedFebioOutputs(caseName) {
  const baseName = `case_${caseName}`;
  return {
    feb: `${baseName}.feb`,
    plot: `${baseName}.xplt`,
    log: `${baseName}.log`,
    resultJson: `${baseName}_result.json`,
    rigidBodyLog: "febio_rigid_pipette.csv",
    interfaceLogs: [
      "febio_interface_nucleus_cytoplasm.csv",
      "febio_interface_cell_dish.csv",
    ],
  };
}

function serializeCanonicalSpec(inputSpec) {
  return {
    caseName: inputSpec.caseName,
    params: structuredClone(inputSpec.params),
    coordinates: structuredClone(inputSpec.coordinates || COORDINATE_SYSTEM_SPEC),
    geometry: structuredClone(inputSpec.geometry),
    material: structuredClone(inputSpec.material),
    interfaces: structuredClone(inputSpec.interfaces),
    membrane: structuredClone(inputSpec.membrane),
    membraneModel: inputSpec.membraneModel || "cortex_proxy",
    operation: structuredClone(inputSpec.operation),
    adhesionPattern: inputSpec.adhesionPattern,
    adhesionSeed: inputSpec.adhesionSeed,
    parameterDigest: inputSpec.parameterDigest,
    validationReport: structuredClone(inputSpec.validationReport),
    parameterTable: structuredClone(inputSpec.parameterTable),
    schedule: serializeSchedule(inputSpec.schedule),
  };
}

function buildFebioRunBundle(inputSpec) {
  const febioTemplateData = inputSpec.febioTemplateData || buildFebioTemplateData(inputSpec);
  const febXml = serializeFebioTemplateToXml(febioTemplateData);
  const exportReady = Boolean(
    inputSpec.validationReport?.valid &&
      febioTemplateData?.geometry?.meshValidation?.valid,
  );
  return {
    parameterDigest: inputSpec.parameterDigest,
    canonicalSpec: serializeCanonicalSpec(inputSpec),
    templateData: febioTemplateData,
    febXml,
    expectedOutputs: buildExpectedFebioOutputs(inputSpec.caseName),
    exportTimestamp: new Date().toISOString(),
    exportReady,
    solverMetadata: inputSpec.solverMetadata || buildSolverMetadata("febio", { source: "febio-export-bundle" }),
  };
}

function buildFebioInputSpec(caseName, params, inputSpec = buildSimulationInput(caseName, params)) {
  return {
    ...inputSpec,
    coordinates: structuredClone(inputSpec.coordinates || COORDINATE_SYSTEM_SPEC),
    febioTemplateData: buildFebioTemplateData(inputSpec),
    solverMetadata: buildSolverMetadata("febio", {
      source: "febio-export-bundle",
    }),
  };
}

function exportFebioJson(inputSpec) {
  const bundle = buildFebioRunBundle(inputSpec);
  return JSON.stringify(
    {
      parameterDigest: bundle.parameterDigest,
      canonicalSpec: bundle.canonicalSpec,
      inputSpec: bundle.canonicalSpec,
      febioTemplateData: bundle.templateData,
      templateData: bundle.templateData,
      febioXml: bundle.febXml,
      febXml: bundle.febXml,
      exportBundle: bundle,
      handoffManifest: buildFebioHandoffManifest(inputSpec),
      solverMetadata: bundle.solverMetadata,
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
  const payload = febioResultJson.normalizedResult || febioResultJson.result || febioResultJson;
  const importedDigest =
    payload.parameterDigest ||
    febioResultJson.parameterDigest ||
    febioResultJson.exportBundle?.parameterDigest ||
    febioResultJson.canonicalSpec?.parameterDigest;
  const digestMatch = Boolean(importedDigest && inputSpec.parameterDigest && importedDigest === inputSpec.parameterDigest);
  const baseResult = { ...payload };
  baseResult.caseName ??= inputSpec.caseName;
  baseResult.params ??= structuredClone(inputSpec.params);
  baseResult.schedule ??= inputSpec.schedule;
  baseResult.parameterDigest ??= importedDigest || inputSpec.parameterDigest;
  baseResult.isPhysicalFebioResult = Boolean(baseResult.isPhysicalFebioResult) && digestMatch;
  // FEM handoff point: map FEBio cohesive/contact output back into the canonical
  // result schema, including localNc/localCd/membraneRegions and provenance.
  baseResult.solverMetadata = buildSolverMetadata("febio", {
    source: baseResult.solverMetadata?.source || (baseResult.isPhysicalFebioResult ? "febio-cli" : "febio-import-nonphysical"),
    digestMatch,
    note: digestMatch ? "" : "parameter digest mismatch or missing digest",
    ...(baseResult.solverMetadata || {}),
  });
  baseResult.resultProvenance = {
    source: baseResult.solverMetadata.source,
    parameterDigest: baseResult.parameterDigest,
    digestMatch,
    importTimestamp: febioResultJson.importTimestamp || new Date().toISOString(),
    exportTimestamp:
      febioResultJson.exportTimestamp ||
      febioResultJson.exportBundle?.exportTimestamp ||
      febioResultJson.canonicalSpec?.exportTimestamp ||
      null,
    fileProvenance: febioResultJson.fileProvenance || null,
  };
  baseResult.externalResult = febioResultJson;
  return baseResult;
}

// Main FEBio-first execution wrapper used by the current UI.
// Legacy lightweight execution has been moved to the optional legacy module.
function runFebioSimulation(caseName, params, inputSpec = buildSimulationInput(caseName, params)) {
  const febioInputSpec = buildFebioInputSpec(caseName, params, inputSpec);
  const bundle = buildFebioRunBundle(febioInputSpec);
  return {
    caseName,
    params: structuredClone(febioInputSpec.params),
    parameterDigest: febioInputSpec.parameterDigest,
    isPhysicalFebioResult: false,
    solverMetadata: buildSolverMetadata("febio", {
      source: "febio-export-ready",
      note: bundle.exportReady ? "awaiting FEBio result" : "export blocked by validation",
    }),
    resultProvenance: {
      source: "febio-export-ready",
      parameterDigest: febioInputSpec.parameterDigest,
      exportTimestamp: bundle.exportTimestamp,
      importTimestamp: null,
      digestMatch: null,
    },
    exportReady: bundle.exportReady,
    validationReport: febioInputSpec.validationReport,
    meshValidation: febioInputSpec.febioTemplateData?.geometry?.meshValidation || null,
  };
}

// FEBio-first main execution path.
// The only supported default flow is:
// UI input -> canonical spec -> FEBio bundle -> imported physical FEBio result.
function runSimulation(caseName, params) {
  const inputSpec = buildSimulationInput(caseName, params);
  const rawResult = runFebioSimulation(caseName, params, inputSpec);
  rawResult.solverMetadata ??= buildSolverMetadata("febio", {
    source: "febio-export-ready",
    note: "awaiting FEBio result",
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
    parameterDigest: inputSpec.parameterDigest,
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
      note: "The main UI path exports and runs FEBio externally, then imports the physical result JSON back into the app.",
    },
    importBack: {
      supportedNow: "normalized physical FEBio result JSON",
      nextStep: "convert FEBio outputs into the canonical app result schema before using 結果読込",
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
    `parameterDigest: ${manifest.parameterDigest}`,
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
    "The browser app is a FEBio front-end. Main results should come from imported physical FEBio outputs only.",
  ].join("\n");
}

function exportCurrentCaseAsFebioJson() {
  const caseName = appState.ui.selectedCase || "C";
  const params = collectParams();
  const febioInputSpec = buildFebioInputSpec(caseName, params);
  appState.exportContext = buildFebioRunBundle(febioInputSpec);
  if (!appState.exportContext.exportReady) {
    if (typeof renderAwaitingResult === "function") {
      renderAwaitingResult(appState.exportContext);
    }
    return null;
  }
  // Export bundle = normalized simulation input + FEBio template data + solver metadata.
  downloadTextFile(`febio_case_${caseName}_input.json`, exportFebioJson(febioInputSpec));
  if (typeof renderAwaitingResult === "function") {
    renderAwaitingResult(appState.exportContext);
  }
  return appState.exportContext;
}

function exportFebioXml(inputSpec = null) {
  const caseName = inputSpec?.caseName || appState.ui.selectedCase || "C";
  const resolvedInput =
    inputSpec || buildFebioInputSpec(caseName, collectParams(), buildSimulationInput(caseName, collectParams()));
  appState.exportContext = buildFebioRunBundle(resolvedInput);
  if (!appState.exportContext.exportReady) {
    if (typeof renderAwaitingResult === "function") {
      renderAwaitingResult(appState.exportContext);
    }
    return "";
  }
  const xml = exportFebioXmlContent(resolvedInput);
  downloadTextFile(`case_${caseName}.feb`, xml, "application/xml;charset=utf-8");
  if (typeof renderAwaitingResult === "function") {
    renderAwaitingResult(appState.exportContext);
  }
  return xml;
}

function exportFebioHandoffBundle(inputSpec = null) {
  const caseName = inputSpec?.caseName || appState.ui.selectedCase || "C";
  const params = inputSpec?.params || collectParams();
  const resolvedInput =
    inputSpec || buildFebioInputSpec(caseName, params, buildSimulationInput(caseName, params));
  appState.exportContext = buildFebioRunBundle(resolvedInput);
  if (!appState.exportContext.exportReady) {
    if (typeof renderAwaitingResult === "function") {
      renderAwaitingResult(appState.exportContext);
    }
    return null;
  }
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

const FEBIO_BRIDGE_DEFAULT_BASE_URL = "http://127.0.0.1:8765";

function resolveFebioBridgeBaseUrl() {
  try {
    const protocol = window?.location?.protocol || "";
    const origin = window?.location?.origin || "";
    if ((protocol === "http:" || protocol === "https:") && origin && origin !== "null") {
      return origin;
    }
  } catch (error) {
    // ignore and fall back to the explicit localhost bridge URL
  }
  return FEBIO_BRIDGE_DEFAULT_BASE_URL;
}

function flushUiFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

function setFebioRunStage(stage, detail = "", tone = "") {
  appState.febioBridge.runStage = stage;
  appState.febioBridge.runDetail = detail || stage;
  appState.febioBridge.runTone = tone;
  appState.febioBridge.lastUpdatedAt = new Date().toISOString();
  if (tone === "is-error") {
    appState.febioBridge.lastError = detail || stage;
  }
  updateFebioRunStatus();
  if (!isPhysicalMainResult(appState.latest) && typeof renderAwaitingResult === "function") {
    renderAwaitingResult(appState.exportContext);
  }
}

function updateFebioRunStatus() {
  if (!elements.febioRunStatus) {
    return;
  }
  const stage = appState.febioBridge?.runStage || "idle";
  const detail = appState.febioBridge?.runDetail || "awaiting user action";
  const updatedAt = appState.febioBridge?.lastUpdatedAt || "n/a";
  elements.febioRunStatus.textContent = `${stage} | ${detail} | ${updatedAt}`;
  elements.febioRunStatus.classList.remove("is-error", "is-busy", "is-ready");
  if (appState.febioBridge?.runTone) {
    elements.febioRunStatus.classList.add(appState.febioBridge.runTone);
  }
}

function setFebioBridgeStatus(text, tone = "") {
  appState.febioBridge.statusText = text;
  if (!elements.febioBridgeStatus) {
    updateFebioRunStatus();
    return;
  }
  elements.febioBridgeStatus.textContent = text;
  elements.febioBridgeStatus.classList.remove("is-error", "is-busy", "is-ready");
  if (tone) {
    elements.febioBridgeStatus.classList.add(tone);
  }
  updateFebioRunStatus();
}

async function fetchFebioBridge(pathname, options = {}) {
  const response = await fetch(`${resolveFebioBridgeBaseUrl()}${pathname}`, {
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
    appState.febioBridge.lastError = payload.lastError || "";
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
  setFebioRunStage("preparing export", `building FEBio bundle for case ${caseName}`, "is-busy");
  await flushUiFrame();
  appState.exportContext = buildFebioRunBundle(buildFebioInputSpec(caseName, params, buildSimulationInput(caseName, params)));
  if (!appState.exportContext.exportReady) {
    setFebioRunStage("export blocked", "validation or mesh checks failed", "is-error");
    if (typeof renderAwaitingResult === "function") {
      renderAwaitingResult(appState.exportContext);
    }
    throw new Error("FEBio export is blocked by validation or mesh errors");
  }
  appState.febioBridge.busy = true;
  setFebioBridgeStatus(`bridge: running case ${caseName}`, "is-busy");
  setFebioRunStage("requesting bridge run", `sending case ${caseName} to FEBio bridge`, "is-busy");
  await flushUiFrame();
  try {
    const payload = await fetchFebioBridge("/run", {
      method: "POST",
      body: JSON.stringify({ caseName, params }),
    });
    setFebioRunStage("importing result", `reading physical FEBio output for case ${caseName}`, "is-busy");
    await flushUiFrame();
    const normalized = loadExternalResult(payload.resultPayload);
    setFebioRunStage("rendering result", `updating the UI with case ${caseName}`, "is-busy");
    await flushUiFrame();
    appState.febioBridge.available = true;
    appState.febioBridge.busy = false;
    setFebioBridgeStatus(`bridge: loaded case ${caseName}`, "is-ready");
    setFebioRunStage("completed", `physical FEBio result loaded for case ${caseName}`, "is-ready");
    return normalized;
  } catch (error) {
    appState.febioBridge.available = false;
    appState.febioBridge.busy = false;
    setFebioBridgeStatus(`bridge: ${error.message}`, "is-error");
    setFebioRunStage("failed", error.message, "is-error");
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
  if (!isPhysicalMainResult(result)) {
    const digestMismatch = result?.resultProvenance?.digestMatch === false;
    appState.exportContext = {
      ...(appState.exportContext || {}),
      lastImportWarning: digestMismatch
        ? "parameter digest mismatch: imported FEBio result was rejected as main result"
        : "non-physical FEBio result was rejected as main result",
      lastImportTimestamp: new Date().toISOString(),
    };
    if (typeof renderAwaitingResult === "function") {
      renderAwaitingResult(appState.exportContext);
    }
    return result;
  }
  appState.ui.solverMode = result.solverMetadata?.solverMode || appState.ui.solverMode;
  appState.ui.selectedCase = result.caseName || appState.ui.selectedCase;
  appState.ui.selectedMode = "case";
  appState.comparisonRuns = [result];
  appState.exportContext = {
    ...(appState.exportContext || {}),
    lastImportTimestamp: result.resultProvenance?.importTimestamp || new Date().toISOString(),
    lastImportWarning: "",
    lastImportedDigest: result.parameterDigest,
    lastImportedSource: result.resultProvenance?.source || result.solverMetadata?.source || "",
  };
  syncRunButtons();
  syncSolverModeControl();
  renderLatest(result);
  return result;
}

function loadExternalResult(resultJson) {
  const payload = typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson;
  const rawResult = payload.result || payload.normalizedResult || payload.baseResult || payload.febioResult || payload;
  rawResult.solverMetadata ??= payload.solverMetadata;
  const canonicalSpec = payload.canonicalSpec || payload.inputSpec || null;
  const caseName = rawResult.caseName || canonicalSpec?.caseName || appState.ui.selectedCase || "C";
  const params = rawResult.params || canonicalSpec?.params || collectParams();
  const inputSpec = buildSimulationInput(caseName, params);
  if (canonicalSpec?.parameterDigest) {
    inputSpec.parameterDigest = canonicalSpec.parameterDigest;
  }
  // External results are normalized through the canonical FEBio path.
  const normalized = normalizeSimulationResult(rawResult, inputSpec);
  const expectedDigest = canonicalSpec?.parameterDigest || appState.exportContext?.parameterDigest || null;
  const importedDigest = normalized.parameterDigest || payload.parameterDigest || null;
  const digestMatch = Boolean(expectedDigest && importedDigest && expectedDigest === importedDigest);
  normalized.isPhysicalFebioResult = Boolean(normalized.isPhysicalFebioResult || payload.isPhysicalFebioResult) && digestMatch;
  normalized.resultProvenance = {
    ...(normalized.resultProvenance || {}),
    parameterDigest: normalized.parameterDigest,
    source: normalized.resultProvenance?.source || normalized.solverMetadata?.source || "febio-import",
    importTimestamp:
      normalized.resultProvenance?.importTimestamp || payload.importTimestamp || new Date().toISOString(),
    exportTimestamp:
      normalized.resultProvenance?.exportTimestamp || payload.exportTimestamp || payload.exportBundle?.exportTimestamp || null,
    digestMatch,
  };
  normalized.solverMetadata = buildSolverMetadata("febio", {
    ...(normalized.solverMetadata || {}),
    source: normalized.solverMetadata?.source || "febio-import",
    note: digestMatch ? normalized.solverMetadata?.note || "imported external result" : "parameter digest mismatch",
  });
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

