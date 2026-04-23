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

function serializeStickyPenaltyRampComments(stabilization = {}) {
  return (stabilization.ramp || []).map(
    (entry) =>
      `    <!-- ramp ${entry.step}: normalPenalty=${Number(entry.normalPenalty || 0).toFixed(6)} tangentialPenalty=${Number(entry.tangentialPenalty || 0).toFixed(6)} frictionProxy=${Number(entry.frictionProxy || 0).toFixed(6)} -->`,
  );
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
      membrane: {
        id: 3,
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
    steps: [
      { id: 1, name: "approach" },
      { id: 2, name: "hold" },
      { id: 3, name: "lift" },
      { id: 4, name: "manipulation-1" },
      { id: 5, name: "manipulation-2" },
    ],
    outputs: {
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
    },
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
  const plotfileSurfaceTractionXml = (templateData.outputs?.plotfileSurfaceData || [])
    .map(
      (entry) =>
        `      <var type="${entry.variable}" surface="${entry.surface}"/>`,
    )
    .join("\n");
  return [
    '<febio_spec version="4.0">',
    "  <Material>",
    '    <material id="1" name="nucleus" type="viscoelastic">',
    "      <g1>0.35</g1>",
    "      <t1>1.2</t1>",
    "    </material>",
    "  </Material>",
    "  <Mesh>",
    '    <SurfacePair name="nucleus_cytoplasm_pair">',
    "    </SurfacePair>",
    "  </Mesh>",
    "  <MeshData>",
    '    <face_data name="nucleus_cytoplasm_left_surface" file="febio_interface_nc_left.csv"/>',
    "  </MeshData>",
    "  <Step>",
    '    <step id="1" name="approach">',
    "    </step>",
    "  </Step>",
    "  <Output>",
    '    <plotfile type="febio">',
    '      <var type="displacement"/>',
    '      <var type="stress"/>',
    ...(plotfileSurfaceTractionXml ? [plotfileSurfaceTractionXml] : []),
    "    </plotfile>",
    "  </Output>",
    '  <contact name="nucleus_cytoplasm_interface" type="sticky" surface_pair="nucleus_cytoplasm_pair">',
    "    <!-- solver-primary cohesive approximation -->",
    `    <penalty>${Number(nucleusCytoplasm.penalty.Kn).toFixed(6)}</penalty>`,
    "    <auto_penalty>0</auto_penalty>",
    `    <search_tol>${Number(stabilization.searchTolerance || nucleusCytoplasm.tolerance || 0).toFixed(6)}</search_tol>`,
    `    <symmetric_stiffness>${stabilization.symmetricStiffness ? 1 : 0}</symmetric_stiffness>`,
    `    <laugon>${stabilization.augmentation?.enabled ? 1 : 0}</laugon>`,
    `    <minaug>${Number(stabilization.augmentation?.minPasses || 0).toFixed(0)}</minaug>`,
    `    <maxaug>${Number(stabilization.augmentation?.maxPasses || 0).toFixed(0)}</maxaug>`,
    `    <fric_coeff>${Number(nucleusCytoplasm.cohesiveApproximation.frictionProxy).toFixed(6)}</fric_coeff>`,
    `    <snap_tol>${Number(nucleusCytoplasm.cohesiveApproximation.snapTolerance).toFixed(6)}</snap_tol>`,
    `    <!-- cohesive criticalNormalStress=${Number(templateData.interfaces.nucleusCytoplasm.criticalNormalStress).toFixed(6)} -->`,
    ...serializeStickyPenaltyRampComments(stabilization),
    "  </contact>",
    "  <!-- cohesive discrete sidecar (not solver-active yet)",
    '  <DiscreteSet name="nucleus_cytoplasm_left_springs">',
    "  </DiscreteSet>",
    "  discrete_material nucleus_cytoplasm_left_springs_material type=nonlinear spring",
    "  load_controller 300 points=",
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
