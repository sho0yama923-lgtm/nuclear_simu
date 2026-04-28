import { cloneNativeValue as clone, digestNativeCaseSpec, normalizeNativeCaseSpec, validateNativeCaseSpec } from "./caseSpec.ts";
import { buildNativeInterfaces } from "./interfaces.ts";
import { buildNativeMesh, validateNativeMesh } from "./mesh.ts";
import { buildNativeLogOutputs, buildNativeOutputs } from "./outputs.ts";

function computeCenter(mesh, setName) {
  const elementIds = new Set(mesh.elementSets?.[setName] || []);
  const nodeIds = new Set();
  (mesh.elements || []).forEach((element) => {
    if (elementIds.has(element.id)) (element.nodes || []).forEach((id) => nodeIds.add(id));
  });
  const nodes = (mesh.nodes || []).filter((node) => nodeIds.has(node.id));
  if (!nodes.length) return [0, 0, 0];
  const total = nodes.reduce((acc, node) => [acc[0] + node.x, acc[1] + node.y, acc[2] + node.z], [0, 0, 0]);
  return total.map((value) => value / nodes.length);
}

function buildViscoelasticMaterial(name, domain, source, id) {
  return {
    id,
    name,
    type: "viscoelastic",
    domain,
    elastic: { E: source.E, nu: source.nu },
    viscous: { implemented: true, eta: source.eta, g1: 0.35, t1: 1.2 },
    optionalNonlinear: { implemented: false, alpha: source.alphaNonlinear ?? null }
  };
}

function buildContacts(spec, mesh) {
  return {
    pipetteNucleus: {
      type: spec.contacts.pipetteNucleus.type,
      status: "omitted after shared-node nucleus-cytoplasm coupling; pipette-cell pressure/contact remains solver-active",
      solverActive: false,
      inactiveReason: "shared-node force transfer removed the stabilizer requirement",
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
        slipDistance: Math.max(Math.min(spec.geometry.pipette.radius * 0.05, 0.3), 0.08)
      }
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
      friction: spec.contacts.pipetteCell.friction
    }
  };
}

function buildSolverFacingLogOutputs(outputs) {
  const logOutputs = buildNativeLogOutputs(outputs);
  const activeFaceData = new Set([
    "cell_dish_interface_surface",
    "pipette_cell_contact_surface",
    "pipette_contact_surface",
  ]);
  return {
    ...logOutputs,
    faceData: (logOutputs.faceData || []).filter((entry) => activeFaceData.has(entry.name)),
    plotfileSurfaceData: [],
  };
}

function buildInterfaceRegions() {
  return {
    localNc: {
      left: { nucleusNodeSet: "nc_left_nucleus_nodes", cytoplasmNodeSet: "nc_left_cytoplasm_nodes" },
      right: { nucleusNodeSet: "nc_right_nucleus_nodes", cytoplasmNodeSet: "nc_right_cytoplasm_nodes" },
      top: { nucleusNodeSet: "nc_top_nucleus_nodes", cytoplasmNodeSet: "nc_top_cytoplasm_nodes" },
      bottom: { nucleusNodeSet: "nc_bottom_nucleus_nodes", cytoplasmNodeSet: "nc_bottom_cytoplasm_nodes" }
    },
    localCd: {
      left: { cellNodeSet: "cd_left_cell_nodes" },
      center: { cellNodeSet: "cd_center_cell_nodes" },
      right: { cellNodeSet: "cd_right_cell_nodes" }
    }
  };
}

function buildBoundary(spec, mesh) {
  const liftController = 101;
  const inwardController = 102;
  return {
    fixed: [
      {
        name: "dish_fixed",
        nodeSet: spec.boundary.fixedNodeSet,
        dofs: ["x", "y", "z"],
        nodeIds: clone(mesh.nodeSets?.[spec.boundary.fixedNodeSet] || [])
      }
    ],
    prescribed: [
      { name: "pipette_lift_z", nodeSet: "pipette_contact_nodes", dof: "z", value: spec.boundary.pipetteMotion.liftZ, loadController: liftController, mode: "relative" },
      { name: "pipette_inward_x", nodeSet: "pipette_contact_nodes", dof: "x", value: spec.boundary.pipetteMotion.inwardX, loadController: inwardController, mode: "relative" },
      { name: "pipette_tangent_y", nodeSet: "pipette_contact_nodes", dof: "y", value: spec.boundary.pipetteMotion.tangentY, loadController: 103, mode: "relative" }
    ],
    notes: ["native-only case boundary path"]
  };
}

function buildLoads(spec) {
  const loadController = spec.loads.suctionPressure.loadController;
  const holdController = spec.loads.holdForceProxy.loadController;
  return {
    nodal: [
      {
        name: "hold_force_proxy",
        surface: "pipette_contact_surface",
        value: spec.loads.holdForceProxy.value,
        loadController: holdController,
        status: "proxy-load / not pressure-driven"
      }
    ],
    pressure: [
      {
        name: spec.loads.suctionPressure.name,
        surface: spec.loads.suctionPressure.surface,
        value: spec.loads.suctionPressure.value,
        magnitude: spec.loads.suctionPressure.magnitude,
        loadController,
        status: "solver-active pressure-driven suction / native-only",
        direction: "inward-negative-pressure",
        unit: spec.loads.suctionPressure.unit
      }
    ],
    controllers: [
      { id: 101, name: "lift_ramp", points: [[0, 0], [2, 0], [3, 1], [5, 1]] },
      { id: 102, name: "inward_ramp", points: [[0, 0], [3, 0], [4, 1], [5, 1]] },
      { id: loadController, name: "suction_pressure_curve", unit: spec.loads.suctionPressure.unit, points: clone(spec.loads.suctionPressure.curve) }
    ],
    notes: ["pressure load is sourced directly from native case loads.suctionPressure"]
  };
}

export function buildNativeFebioModel(nativeCaseSpec = {}) {
  const spec = normalizeNativeCaseSpec(nativeCaseSpec);
  const validationReport = validateNativeCaseSpec(spec);
  const mesh = buildNativeMesh(spec);
  const meshValidation = validateNativeMesh(mesh);
  const interfaces = buildNativeInterfaces(spec, mesh);
  const outputs = buildNativeOutputs(spec, mesh);
  const logOutputs = buildSolverFacingLogOutputs(outputs);
  const parameterDigest = digestNativeCaseSpec(spec);

  return {
    status: {
      buildMode: "febio-native-only",
      isPlaceholder: false,
      meshValidated: meshValidation.valid,
      interfaceValidated: interfaces.nucleusCytoplasm.validation?.valid ?? false,
      source: "febio-native-case",
      notes: [
        "built from febio_cases/native source JSON",
        "native-only path bypasses UI/canonical/template adapter entrypoints",
        "FEBio CLI/Studio confirmation remains required for solver run validation"
      ]
    },
    caseName: spec.caseName,
    parameterDigest,
    coordinateSystem: { unitSystem: spec.unitSystem, length: "um", force: "nN", time: "s", stress: "kPa" },
    effectiveNativeSpec: clone(spec),
    validationReport,
    exportReady: Boolean(validationReport.valid && meshValidation.valid),
    geometry: {
      mesh,
      meshValidation,
      nucleus: { shape: "ellipse", width: spec.geometry.nucleus.width, height: spec.geometry.nucleus.height, center: clone(spec.geometry.nucleus.center) },
      cytoplasm: { shape: "cap", width: spec.geometry.cytoplasm.width, height: spec.geometry.cytoplasm.height, dishZ: 0 },
      membrane: { attachment: "cytoplasm_outer_surface", model: "cortex_proxy", status: "implemented-proxy", thresholds: {} },
      pipette: { radius: spec.geometry.pipette.radius, puncture: clone(spec.geometry.pipette.puncture || spec.geometry.pipette.tip), tip: clone(spec.geometry.pipette.tip) }
    },
    materials: {
      nucleus: buildViscoelasticMaterial("nucleus", "nucleus", spec.materials.nucleus, 1),
      cytoplasm: buildViscoelasticMaterial("cytoplasm", "cytoplasm", spec.materials.cytoplasm, 2),
      dish: { id: 3, name: "dish", type: spec.materials.dish.type, domain: "dish", elastic: { E: spec.materials.dish.E, v: spec.materials.dish.nu } },
      pipette: {
        id: 4,
        name: "pipette_rigid",
        type: "rigid body",
        domain: "pipette",
        density: spec.materials.pipette.density,
        centerOfMass: computeCenter(mesh, "pipette"),
        elastic: { E: spec.materials.pipette.E, v: spec.materials.pipette.nu }
      },
      membrane: { id: 5, name: "membrane", type: "cortex_proxy", status: "implemented-proxy", tension: 4.7 }
    },
    interfaces,
    contact: buildContacts(spec, mesh),
    interfaceRegions: buildInterfaceRegions(),
    boundary: buildBoundary(spec, mesh),
    loads: buildLoads(spec),
    steps: clone(spec.steps),
    outputs,
    logOutputs,
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
          "febio_interface_cell_dish.csv"
        ]
      }
    },
    discreteCohesive: {
      nucleusCytoplasm: { type: "discrete-cohesive-springs", status: "implemented-sidecar / not solver-primary" }
    }
  };
}
