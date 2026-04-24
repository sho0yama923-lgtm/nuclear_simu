import { buildNucleusCytoplasmInterfaceSpec } from "../interfaces/nucleusCytoplasm.ts";
import { buildRefinedFebioGeometry, validateFebioMesh } from "../mesh/index.ts";
import {
  cloneSpecValue as clone,
  createDefaultFebioNativeSpec,
  digestFebioNativeSpec,
  normalizeFebioNativeSpec,
  toLegacyTemplateShape,
  validateFebioNativeSpec,
} from "./nativeSpec.ts";

export {
  createDefaultFebioNativeSpec,
  normalizeFebioNativeSpec,
  validateFebioNativeSpec,
} from "./nativeSpec.ts";

/**
 * SOURCE OF TRUTH: FEBio-native spec entrypoint for direct solver-facing export.
 *
 * Responsibility: define, normalize, validate, and map FEBio-native JSON into template data.
 * Owns: createDefaultFebioNativeSpec, normalizeFebioNativeSpec, validateFebioNativeSpec, buildFebioNativeTemplateData.
 * Does NOT own: browser UI parameters, canonical UI conversion, XML serialization, result normalization.
 * Primary entrypoints: createDefaultFebioNativeSpec, buildFebioNativeInputSpec, buildFebioNativeRunBundle.
 * Depends on: docs/febio/FEBIO_NATIVE_SPEC.md, src/febio/mesh/index.ts, src/febio/interfaces/nucleusCytoplasm.ts.
 */

function buildViscoelasticMaterial(name, domain, source, id) {
  return {
    id,
    name,
    type: "viscoelastic",
    domain,
    elastic: { E: source.E, nu: source.nu },
    viscous: { implemented: true, eta: source.eta, g1: 0.35, t1: 1.2 },
    optionalNonlinear: { implemented: false, alpha: source.alphaNonlinear ?? null },
  };
}

function computeCenter(mesh, setName) {
  const elementIds = new Set(mesh.elementSets?.[setName] || []);
  const nodeIds = new Set();
  (mesh.elements || []).forEach((element) => {
    if (elementIds.has(element.id)) {
      (element.nodes || []).forEach((id) => nodeIds.add(id));
    }
  });
  const nodes = (mesh.nodes || []).filter((node) => nodeIds.has(node.id));
  if (!nodes.length) return [0, 0, 0];
  const total = nodes.reduce((acc, node) => [acc[0] + node.x, acc[1] + node.y, acc[2] + node.z], [0, 0, 0]);
  return total.map((value) => value / nodes.length);
}

function buildFaceDataOutputSpec(name, file, surface, currentCoverage = {}) {
  return {
    name,
    file,
    surface,
    logfileData: "contact gap;contact pressure",
    logfileFields: ["contact gap", "contact pressure"],
    optionalExternalFields: ["contact traction", "traction x", "traction y", "traction z", "tangential traction", "shear traction"],
    currentCoverage: {
      normal: currentCoverage.normal || "native-face-data-preferred",
      damage: currentCoverage.damage || "native-face-data-preferred",
      shear: currentCoverage.shear || "proxy-fallback-explicit",
    },
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
    sectionAxes,
  };
}

function buildOutputs(nativeSpec, mesh) {
  const mouthPlaneX = mesh.bounds?.pipetteContactX ?? mesh.bounds?.pipetteLeft ?? nativeSpec.geometry.pipette.tip.x;
  const outputs = {
    faceData: [
      buildFaceDataOutputSpec("nucleus_cytoplasm_interface_surface", "febio_interface_nucleus_cytoplasm.csv", "nucleus_interface_surface"),
      buildFaceDataOutputSpec("nucleus_cytoplasm_left_surface", "febio_interface_nc_left.csv", "nucleus_interface_left_surface"),
      buildFaceDataOutputSpec("nucleus_cytoplasm_right_surface", "febio_interface_nc_right.csv", "nucleus_interface_right_surface"),
      buildFaceDataOutputSpec("nucleus_cytoplasm_top_surface", "febio_interface_nc_top.csv", "nucleus_interface_top_surface"),
      buildFaceDataOutputSpec("nucleus_cytoplasm_bottom_surface", "febio_interface_nc_bottom.csv", "nucleus_interface_bottom_surface"),
      buildFaceDataOutputSpec("cell_dish_interface_surface", "febio_interface_cell_dish.csv", "cell_dish_surface"),
      buildFaceDataOutputSpec("cell_dish_left_surface", "febio_interface_cd_left.csv", "cell_dish_left_surface"),
      buildFaceDataOutputSpec("cell_dish_center_surface", "febio_interface_cd_center.csv", "cell_dish_center_surface"),
      buildFaceDataOutputSpec("cell_dish_right_surface", "febio_interface_cd_right.csv", "cell_dish_right_surface"),
      buildFaceDataOutputSpec("pipette_cell_contact_surface", "febio_pipette_cell_contact.csv", "pipette_suction_surface", {
        damage: "proxy-fallback-explicit",
        shear: "proxy-fallback-explicit",
      }),
      buildFaceDataOutputSpec("pipette_contact_surface", "febio_pipette_contact.csv", "pipette_contact_surface", {
        damage: "proxy-fallback-explicit",
        shear: "not-used",
      }),
    ],
    plotfileSurfaceData: [
      buildPlotfileSurfaceTractionSpec("nucleus_cytoplasm_left_surface", "nucleus_interface_left_surface", "localNc", "left", { normal: "x", tangential: "z" }),
      buildPlotfileSurfaceTractionSpec("nucleus_cytoplasm_right_surface", "nucleus_interface_right_surface", "localNc", "right", { normal: "x", tangential: "z" }),
      buildPlotfileSurfaceTractionSpec("nucleus_cytoplasm_top_surface", "nucleus_interface_top_surface", "localNc", "top", { normal: "z", tangential: "x" }),
      buildPlotfileSurfaceTractionSpec("nucleus_cytoplasm_bottom_surface", "nucleus_interface_bottom_surface", "localNc", "bottom", { normal: "z", tangential: "x" }),
      buildPlotfileSurfaceTractionSpec("cell_dish_left_surface", "cell_dish_left_surface", "localCd", "left", { normal: "z", tangential: "x" }),
      buildPlotfileSurfaceTractionSpec("cell_dish_center_surface", "cell_dish_center_surface", "localCd", "center", { normal: "z", tangential: "x" }),
      buildPlotfileSurfaceTractionSpec("cell_dish_right_surface", "cell_dish_right_surface", "localCd", "right", { normal: "z", tangential: "x" }),
    ],
    detachment: {
      evaluation: "damage-plus-geometry",
      preferredSource: "native-first / proxy-assisted fallback",
      events: ["detachmentStart", "detachmentComplete"],
      metrics: ["contactAreaRatio", "relativeNucleusDisplacement"],
      payloadPath: "normalizedResult.events",
    },
    aspiration: {
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
      definition: "Clamp to >=0 the projected distance from the pipette mouth plane to the most inward aspirated nucleus/cytoplasm node.",
      mapsTo: ["history[].aspirationLength", "aspiration.length", "peaks.peakAspirationLength"],
    },
  };
  return outputs;
}

function buildLogOutputs(outputs) {
  return {
    nodeData: [
      { name: "nucleus_nodes", file: "febio_nucleus_nodes.csv", nodeSet: "nucleus", data: "ux;uy;uz", mapsTo: ["history[].nucleus", "displacements.nucleus", "aspiration.length"] },
      { name: "cytoplasm_nodes", file: "febio_cytoplasm_nodes.csv", nodeSet: "cytoplasm", data: "ux;uy;uz", mapsTo: ["history[].cell", "displacements.cell", "aspiration.length"] },
      { name: "pipette_contact_nodes", file: "febio_pipette_contact_nodes.csv", nodeSet: "pipette_contact_nodes", data: "ux;uy;uz", mapsTo: ["history[].pipette", "aspiration.reference"] },
    ],
    rigidBodyData: [
      { name: "pipette_rigid_body", file: "febio_rigid_pipette.csv", data: "x;y;z;Fx;Fy;Fz", item: "pipette", mapsTo: ["history[].pipette", "history[].pipetteCenter", "history[].holdForce", "peaks.peakHoldForce"] },
    ],
    faceData: clone(outputs.faceData),
    plotfileSurfaceData: clone(outputs.plotfileSurfaceData),
    aspiration: clone(outputs.aspiration),
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

export function buildFebioNativeTemplateData(nativeSpec) {
  const spec = normalizeFebioNativeSpec(nativeSpec);
  const validationReport = validateFebioNativeSpec(spec);
  const legacyShape = toLegacyTemplateShape(spec);
  const mesh = buildRefinedFebioGeometry(legacyShape);
  const meshValidation = validateFebioMesh(mesh);
  const nucleusCytoplasm = buildNucleusCytoplasmInterfaceSpec(legacyShape, mesh);
  const outputs = buildOutputs(spec, mesh);
  const loadController = spec.loads.suctionPressure.loadController || 202;
  const holdController = spec.loads.holdForceProxy.loadController || 201;
  const liftController = 101;
  const inwardController = 102;

  return {
    status: {
      buildMode: "febio-native-direct",
      isPlaceholder: false,
      meshValidated: meshValidation.valid,
      interfaceValidated: nucleusCytoplasm.validation?.valid ?? false,
      membraneModel: "cortex_proxy",
      source: "febio-native-spec",
      notes: [
        "built from FEBio-native spec JSON without UI parameter conversion",
        "S7 direct path uses an explicit coarse local-nucleus debug mesh until the refined native mesh is rebuilt",
        "force-transfer validation requires FEBio CLI/Studio confirmation for each geometry target",
      ],
    },
    parameterDigest: legacyShape.parameterDigest,
    coordinateSystem: legacyShape.coordinates,
    nativeSpec: clone(spec),
    geometry: {
      mesh,
      meshValidation,
      nucleus: {
        shape: "ellipse",
        width: spec.geometry.nucleus.width,
        height: spec.geometry.nucleus.height,
        center: clone(spec.geometry.nucleus.center),
      },
      cytoplasm: {
        shape: "cap",
        width: spec.geometry.cytoplasm.width,
        height: spec.geometry.cytoplasm.height,
        dishZ: 0,
      },
      membrane: {
        attachment: "cytoplasm_outer_surface",
        model: "cortex_proxy",
        status: "implemented-proxy",
        thresholds: {},
      },
      pipette: {
        radius: spec.geometry.pipette.radius,
        puncture: clone(spec.geometry.pipette.puncture || spec.geometry.pipette.tip),
        tip: clone(spec.geometry.pipette.tip),
      },
    },
    materials: {
      nucleus: buildViscoelasticMaterial("nucleus", "nucleus", spec.materials.nucleus, 1),
      cytoplasm: buildViscoelasticMaterial("cytoplasm", "cytoplasm", spec.materials.cytoplasm, 2),
      dish: {
        id: 3,
        name: "dish",
        type: spec.materials.dish.type,
        domain: "dish",
        elastic: { E: spec.materials.dish.E, v: spec.materials.dish.nu },
      },
      pipette: {
        id: 4,
        name: "pipette_rigid",
        type: "rigid body",
        domain: "pipette",
        density: spec.materials.pipette.density,
        centerOfMass: computeCenter(mesh, "pipette"),
        elastic: { E: spec.materials.pipette.E, v: spec.materials.pipette.nu },
      },
      membrane: {
        id: 5,
        name: "membrane",
        type: "cortex_proxy",
        status: "implemented-proxy",
        tension: 4.7,
      },
    },
    interfaces: {
      nucleusCytoplasm,
      cellDish: {
        type: spec.contacts.cellDish.type,
        status: "partial-cohesive-ready / tied-elastic-active",
        mode: "solver-primary tied-contact",
        surfacePair: mesh.surfacePairs.cell_dish_pair,
        normalStiffness: spec.contacts.cellDish.normalStiffness,
        tangentialStiffness: spec.contacts.cellDish.tangentialStiffness,
        criticalNormalStress: spec.contacts.cellDish.criticalNormalStress,
        criticalShearStress: spec.contacts.cellDish.criticalShearStress,
        fractureEnergy: spec.contacts.cellDish.fractureEnergy,
        nativeObservation: {
          normal: "native-face-data-preferred",
          shear: "proxy-fallback-explicit",
          damage: "native-face-data-preferred",
        },
      },
    },
    contact: {
      pipetteNucleus: {
        type: spec.contacts.pipetteNucleus.type,
        status: "solver-active capture-hold contact",
        mode: "capture-hold",
        tolerance: spec.contacts.pipetteNucleus.tolerance,
        searchTolerance: spec.contacts.pipetteNucleus.searchTolerance,
        searchRadius: Math.max(spec.geometry.pipette.radius * 2.2, 1.5),
        surfacePair: mesh.surfacePairs.pipette_nucleus_pair,
        penalty: Math.max(spec.contacts.nucleusCytoplasm.normalStiffness * 0.45, 0.2),
        symmetricStiffness: 0,
        autoPenalty: 1,
        friction: spec.contacts.pipetteNucleus.friction,
        maxTraction: spec.contacts.pipetteNucleus.maxTraction,
        snapTolerance: spec.contacts.pipetteNucleus.snapTolerance,
        releaseCondition: {
          type: "traction-or-slip-threshold",
          tractionLimit: spec.contacts.pipetteNucleus.maxTraction,
          slipDistance: Math.max(Math.min(spec.geometry.pipette.radius * 0.05, 0.3), 0.08),
        },
      },
      pipetteCell: {
        type: spec.contacts.pipetteCell.type,
        status: "solver-active secondary contact",
        mode: "secondary-contact-proxy",
        tolerance: spec.contacts.pipetteCell.tolerance,
        searchTolerance: spec.contacts.pipetteCell.searchTolerance,
        searchRadius: Math.max(spec.geometry.pipette.radius * 2.5, 1.5),
        surfacePair: mesh.surfacePairs.pipette_cell_pair,
        penalty: Math.max(spec.contacts.cellDish.normalStiffness * 0.45, 0.25),
        symmetricStiffness: 0,
        autoPenalty: 1,
        friction: spec.contacts.pipetteCell.friction,
      },
    },
    interfaceRegions: buildInterfaceRegions(),
    boundary: {
      fixed: [
        {
          name: "dish_fixed",
          nodeSet: spec.boundary.fixedNodeSet,
          dofs: ["x", "y", "z"],
          nodeIds: clone(mesh.nodeSets?.[spec.boundary.fixedNodeSet] || []),
        },
      ],
      prescribed: [
        { name: "pipette_lift_z", nodeSet: "pipette_contact_nodes", dof: "z", value: spec.boundary.pipetteMotion.liftZ, loadController: liftController, mode: "relative" },
        { name: "pipette_inward_x", nodeSet: "pipette_contact_nodes", dof: "x", value: spec.boundary.pipetteMotion.inwardX, loadController: inwardController, mode: "relative" },
        { name: "pipette_tangent_y", nodeSet: "pipette_contact_nodes", dof: "y", value: spec.boundary.pipetteMotion.tangentY, loadController: 103, mode: "relative" },
      ],
      notes: ["direct native spec boundary path"],
    },
    loads: {
      nodal: [
        {
          name: "hold_force_proxy",
          surface: "pipette_contact_surface",
          value: spec.loads.holdForceProxy.value,
          loadController: holdController,
          status: "proxy-load / not pressure-driven",
        },
      ],
      pressure: [
        {
          name: spec.loads.suctionPressure.name,
          surface: spec.loads.suctionPressure.surface,
          value: spec.loads.suctionPressure.value,
          magnitude: spec.loads.suctionPressure.magnitude,
          loadController,
          status: "solver-active pressure-driven suction / febio-native-direct",
          direction: "inward-negative-pressure",
          unit: spec.loads.suctionPressure.unit,
        },
      ],
      controllers: [
        { id: liftController, name: "lift_ramp", points: [[0, 0], [1, 0], [2, 1], [5, 1]] },
        { id: inwardController, name: "inward_ramp", points: [[0, 0], [3, 0], [4, 1], [5, 1]] },
        { id: loadController, name: "suction_pressure_curve", unit: spec.loads.suctionPressure.unit, points: clone(spec.loads.suctionPressure.curve) },
      ],
      notes: ["pressure load is sourced directly from FEBio-native spec loads.suctionPressure"],
    },
    steps: clone(spec.steps),
    outputs,
    logOutputs: buildLogOutputs(outputs),
    diagnostics: {
      ...clone(spec.diagnostics),
      validationReport,
      expectedStudioConfirmation: {
        febPath: "set-by-export-cli",
        logPath: "set-by-febio-run",
        resultPath: "set-by-converter",
        outputCsv: [
          "febio_pipette_cell_contact.csv",
          "febio_pipette_contact.csv",
          "febio_rigid_pipette.csv",
          "febio_interface_cell_dish.csv",
        ],
      },
    },
    discreteCohesive: {
      nucleusCytoplasm: {
        type: "discrete-cohesive-springs",
        status: "implemented-sidecar / not solver-primary",
      },
    },
  };
}

export function buildFebioNativeInputSpec(nativeSpec = {}) {
  const normalizedNativeSpec = normalizeFebioNativeSpec(nativeSpec);
  const validationReport = validateFebioNativeSpec(normalizedNativeSpec);
  const febioTemplateData = buildFebioNativeTemplateData(normalizedNativeSpec);
  return {
    caseName: normalizedNativeSpec.caseName,
    unitSystem: normalizedNativeSpec.unitSystem,
    nativeSpec: normalizedNativeSpec,
    parameterDigest: digestFebioNativeSpec(normalizedNativeSpec),
    validationReport,
    febioTemplateData,
    solverMetadata: {
      solverMode: "febio",
      source: "febio-native-direct",
    },
  };
}

export function buildFebioNativeRunBundle(nativeInputSpec, serializer) {
  if (typeof serializer !== "function") {
    throw new Error("buildFebioNativeRunBundle requires serializeFebioTemplateToXml as an explicit dependency");
  }
  const input = nativeInputSpec?.febioTemplateData ? nativeInputSpec : buildFebioNativeInputSpec(nativeInputSpec);
  const febXml = serializer(input.febioTemplateData);
  const exportReady = Boolean(input.validationReport?.valid && input.febioTemplateData.geometry.meshValidation.valid);
  return {
    parameterDigest: input.parameterDigest,
    nativeSpec: clone(input.nativeSpec),
    templateData: input.febioTemplateData,
    febXml,
    expectedOutputs: {
      feb: `${input.caseName}.feb`,
      log: `${input.caseName}.log`,
      xplt: `${input.caseName}.xplt`,
      resultJson: `${input.caseName}_result.json`,
    },
    eventContract: {
      detachment: clone(input.febioTemplateData.outputs.detachment),
    },
    validation: {
      nativeSpec: clone(input.validationReport),
      mesh: clone(input.febioTemplateData.geometry.meshValidation),
      nucleusCytoplasm: clone(input.febioTemplateData.interfaces.nucleusCytoplasm.validation),
    },
    exportTimestamp: new Date().toISOString(),
    exportReady,
    solverMetadata: {
      solverMode: "febio",
      source: "febio-native-direct",
    },
  };
}
