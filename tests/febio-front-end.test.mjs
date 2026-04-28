import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadApp } from "./load-app.mjs";
import {
  attachExplicitDetachmentEvents,
  buildDetachmentMetricsFromLocalState,
  buildOutputMappingSummary,
  computeTangentialTractionFromFaceSnapshot,
  computeTangentialTractionFromPlotfileBridge,
  getRigidPipetteState,
  inferFaceSnapshotValueOffset,
  resolveTangentialShearObservation,
} from "../scripts/convert_febio_output.mjs";

async function loadGeneratedModule(relativePath) {
  const modulePath = path.resolve(process.cwd(), "generated", "dist", ...relativePath.split("/"));
  return import(pathToFileURL(modulePath).href);
}

test("UI input maps into canonical spec", async () => {
  const app = await loadApp();
  const spec = app.buildSimulationInput("A", { xp: 6.2, zp: 9.1, En: 4.4, adhesionPattern: "edge_strong" });
  assert.equal(spec.geometry.xp, 6.2);
  assert.equal(spec.geometry.zp, 9.1);
  assert.equal(spec.material.En, 4.4);
  assert.equal(spec.adhesionPattern, "edge_strong");
  assert.ok(spec.validationReport.valid);
  assert.ok(spec.parameterDigest.startsWith("pdig_"));
});

test("canonical spec maps into FEBio template data", async () => {
  const app = await loadApp();
  const spec = app.buildSimulationInput("A", { Kn_nc: 1.3, Gc_cd: 1.5 });
  const febio = app.buildFebioInputSpec("A", spec.params, spec);
  assert.equal(febio.febioTemplateData.interfaces.nucleusCytoplasm.normalStiffness, 1.3);
  assert.equal(febio.febioTemplateData.interfaces.cellDish.fractureEnergy, 1.5);
  assert.equal(febio.febioTemplateData.materials.nucleus.elastic.E, spec.material.En);
  assert.equal(febio.febioTemplateData.materials.nucleus.viscous.implemented, true);
  assert.equal(febio.febioTemplateData.boundary.fixed[0].nodeSet, "dish_fixed_nodes");
  assert.equal(febio.febioTemplateData.boundary.prescribed.find((entry) => entry.name === "pipette_lift_z").value, spec.operation.dz_lift);
  assert.equal(febio.febioTemplateData.coordinateSystem.unitSystem, "um-s-kPa-nN");
  assert.equal(febio.febioTemplateData.loads.pressure[0].magnitude, spec.operation.P_hold);
  assert.equal(febio.febioTemplateData.loads.pressure[0].value, -spec.operation.P_hold);
  assert.match(febio.febioTemplateData.loads.pressure[0].status, /solver-active pressure-driven suction/);
  assert.equal(febio.febioTemplateData.interfaceRegions.localNc.left.nucleusNodeSet, "nc_left_nucleus_nodes");
  assert.equal(febio.febioTemplateData.outputs.aspiration.metric, "L(t)");
  assert.equal(febio.febioTemplateData.outputs.aspiration.unit, "um");
  assert.equal(febio.febioTemplateData.outputs.aspiration.payloadPath, "aspiration.length");
  assert.equal(febio.febioTemplateData.logOutputs.aspiration.metric, "L(t)");
  assert.equal(febio.febioTemplateData.status.buildMode, "refined");
});

test("canonical FEBio export declares current face-data coverage and optional traction extensions", async () => {
  const app = await loadApp();
  const spec = app.buildFebioInputSpec("A", app.DEFAULTS, app.buildSimulationInput("A", app.DEFAULTS));
  const ncLeft = spec.febioTemplateData.outputs.faceData.find((entry) => entry.name === "nucleus_cytoplasm_left_surface");
  const cdLeft = spec.febioTemplateData.outputs.faceData.find((entry) => entry.name === "cell_dish_left_surface");
  const ncLeftPlotBridge = spec.febioTemplateData.outputs.plotfileSurfaceData.find(
    (entry) => entry.interfaceGroup === "localNc" && entry.region === "left",
  );

  assert.equal(Array.isArray(spec.febioTemplateData.outputs.faceData), true);
  assert.equal(ncLeft.logfileData, "contact gap;contact pressure");
  assert.equal(JSON.stringify(ncLeft.logfileFields), JSON.stringify(["contact gap", "contact pressure"]));
  assert.match(ncLeft.optionalExternalFields.join(" "), /traction x/);
  assert.equal(ncLeft.currentCoverage.normal, "native-face-data-preferred");
  assert.equal(ncLeft.currentCoverage.shear, "proxy-fallback-explicit");
  assert.equal(cdLeft.currentCoverage.damage, "native-face-data-preferred");
  assert.match(ncLeft.notes.join(" "), /Tangential traction remains optional external payload or plotfile-side data/);
  assert.equal(ncLeftPlotBridge.variable, "contact traction");
  assert.equal(ncLeftPlotBridge.payloadPath, "plotfileSurfaceData.localNc.left");
  assert.equal(ncLeftPlotBridge.preferredSource, "native-plotfile-contact-traction");
  assert.equal(spec.febioTemplateData.logOutputs.nodeData.find((entry) => entry.name === "nucleus_nodes").nodeSet, "nucleus");
  assert.equal(spec.febioTemplateData.logOutputs.rigidBodyData[0].name, "pipette_rigid_body");
  assert.equal(spec.febioTemplateData.outputs.aspiration.historyPath, "history[].aspirationLength");
});

test("converter output mapping carries standard face-data coverage and optional traction extensions", () => {
  const mapping = buildOutputMappingSummary({
    interfaceRegions: {
      localNc: {
        left: { nucleusNodeSet: "nc_left_nucleus_nodes", cytoplasmNodeSet: "nc_left_cytoplasm_nodes" },
      },
      localCd: {
        left: { cellNodeSet: "cd_left_cell_nodes" },
      },
    },
    outputs: {
      aspiration: {
        metric: "L(t)",
        unit: "um",
        preferredSource: "native-node-displacement",
        payloadPath: "aspiration.length",
        historyPath: "history[].aspirationLength",
        peakPath: "peaks.peakAspirationLength",
        definition: "test aspiration definition",
        mapsTo: ["history[].aspirationLength", "aspiration.length", "peaks.peakAspirationLength"],
      },
      faceData: [
        {
          name: "nucleus_cytoplasm_left_surface",
          logfileData: "contact gap;contact pressure",
          logfileFields: ["contact gap", "contact pressure"],
          optionalExternalFields: ["traction x", "traction y"],
          currentCoverage: {
            normal: "native-face-data-preferred",
            damage: "native-face-data-preferred",
            shear: "proxy-fallback-explicit",
          },
        },
        {
          name: "cell_dish_left_surface",
          logfileData: "contact gap;contact pressure",
          logfileFields: ["contact gap", "contact pressure"],
          optionalExternalFields: ["traction x", "traction y"],
          currentCoverage: {
            normal: "native-face-data-preferred",
            damage: "native-face-data-preferred",
            shear: "proxy-fallback-explicit",
          },
        },
      ],
      plotfileSurfaceData: [
        {
          interfaceGroup: "localNc",
          region: "left",
          variable: "contact traction",
          surface: "nucleus_interface_left_surface",
          payloadPath: "plotfileSurfaceData.localNc.left",
          preferredSource: "native-plotfile-contact-traction",
          sectionAxes: { normal: "x", tangential: "z" },
        },
        {
          interfaceGroup: "localCd",
          region: "left",
          variable: "contact traction",
          surface: "cell_dish_left_surface",
          payloadPath: "plotfileSurfaceData.localCd.left",
          preferredSource: "native-plotfile-contact-traction",
          sectionAxes: { normal: "z", tangential: "x" },
        },
      ],
    },
  });

  assert.equal(mapping.localNc.left.logfileData, "contact gap;contact pressure");
  assert.equal(JSON.stringify(mapping.localNc.left.logfileFields), JSON.stringify(["contact gap", "contact pressure"]));
  assert.match(mapping.localNc.left.optionalExternalFields.join(" "), /traction x/);
  assert.equal(mapping.localNc.left.currentCoverage.shear, "proxy-fallback-explicit");
  assert.equal(mapping.localNc.left.standardTangentialBridge.payloadPath, "plotfileSurfaceData.localNc.left");
  assert.equal(mapping.localNc.left.standardTangentialBridge.preferredSource, "native-plotfile-contact-traction");
  assert.equal(mapping.localCd.left.currentCoverage.damage, "native-face-data-preferred");
  assert.equal(mapping.localCd.left.standardTangentialBridge.surface, "cell_dish_left_surface");
  assert.equal(mapping.aspiration.metric, "L(t)");
  assert.equal(mapping.aspiration.historyPath, "history[].aspirationLength");
  assert.equal(mapping.aspiration.peakPath, "peaks.peakAspirationLength");
});

test("converter output mapping also reads legacy-compatible coverage metadata", () => {
  const mapping = buildOutputMappingSummary({
    interfaceRegions: {
      localNc: {
        top: { nucleusNodeSet: "nc_top_nucleus_nodes", cytoplasmNodeSet: "nc_top_cytoplasm_nodes" },
      },
      localCd: {
        center: { cellNodeSet: "cd_center_cell_nodes" },
      },
    },
    logOutputs: {
      aspiration: {
        metric: "L(t)",
        unit: "um",
        preferredSource: "native-node-displacement",
        payloadPath: "aspiration.length",
      },
      faceData: [
        {
          name: "nucleus_cytoplasm_top_surface",
          logfileData: "contact gap;contact pressure",
          logfileFields: ["contact gap", "contact pressure"],
          optionalExternalFields: ["contact traction"],
          currentCoverage: {
            normal: "native-face-data-preferred",
            damage: "native-face-data-preferred",
            shear: "bridge-native-preferred",
          },
        },
      ],
      plotfileSurfaceData: [
        {
          interfaceGroup: "localNc",
          region: "top",
          variable: "contact traction",
          surface: "nucleus_interface_top_surface",
          payloadPath: "plotfileSurfaceData.localNc.top",
          preferredSource: "native-plotfile-contact-traction",
          sectionAxes: { normal: "z", tangential: "x" },
        },
      ],
    },
  });

  assert.equal(mapping.localNc.top.currentCoverage.shear, "bridge-native-preferred");
  assert.equal(mapping.localNc.top.standardTangentialBridge.surface, "nucleus_interface_top_surface");
  assert.equal(mapping.localCd.center.standardTangentialBridge, null);
  assert.equal(mapping.aspiration.source, "native-node-displacement");
});

test("template serializes to consistent FEBio XML", async () => {
  const app = await loadApp();
  const spec = app.buildFebioInputSpec("A", app.DEFAULTS, app.buildSimulationInput("A", app.DEFAULTS));
  const xml = app.serializeFebioTemplateToXml(spec.febioTemplateData);
  assert.match(xml, /<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<febio_spec version="4\.0">/);
  assert.match(xml, /<Module type="solid" \/>/);
  assert.match(xml, /<Material>/);
  assert.match(xml, /<Mesh>/);
  assert.match(xml, /<Nodes name="all_nodes">/);
  assert.match(xml, /<Elements type="hex8" name="nucleus">/);
  assert.match(xml, /<Elements type="hex8" name="cytoplasm">/);
  assert.match(xml, /<Elements type="hex8" name="dish">/);
  assert.match(xml, /<Elements type="hex8" name="pipette">/);
  assert.match(xml, /<Surface name="pipette_contact_surface">/);
  assert.match(xml, /<Surface name="pipette_suction_surface">/);
  assert.match(xml, /<SurfacePair name="nucleus_cytoplasm_pair">/);
  assert.match(xml, /<primary>cytoplasm_interface_surface<\/primary>/);
  assert.match(xml, /<secondary>nucleus_interface_surface<\/secondary>/);
  assert.match(xml, /<SurfacePair name="cell_dish_pair">/);
  assert.match(xml, /<secondary>dish_contact_surface<\/secondary>/);
  assert.match(xml, /<SurfacePair name="pipette_nucleus_pair">/);
  assert.match(xml, /<primary>nucleus_interface_right_surface<\/primary>/);
  assert.match(xml, /<secondary>pipette_contact_surface<\/secondary>/);
  assert.match(xml, /<SurfacePair name="pipette_cell_pair">/);
  assert.match(xml, /<primary>pipette_suction_surface<\/primary>/);
  assert.match(xml, /<MeshDomains>/);
  assert.match(xml, /<SolidDomain name="nucleus" mat="nucleus" \/>/);
  assert.match(xml, /<SolidDomain name="pipette" mat="pipette_rigid" \/>/);
  assert.match(xml, /<Boundary>/);
  assert.match(xml, /<bc name="dish_fixed" node_set="dish_fixed_nodes" type="zero displacement">/);
  assert.match(xml, /<z_dof>1<\/z_dof>/);
  assert.match(xml, /<Rigid>/);
  assert.match(xml, /<rb>pipette_rigid<\/rb>/);
  assert.match(xml, /<value lc="1">8\.000000<\/value>/);
  assert.match(xml, /<value lc="2">-1\.800000<\/value>/);
  assert.match(xml, /<value lc="2">-2\.200000<\/value>/);
  assert.match(xml, /<Loads>/);
  assert.match(xml, /nodal_load hold_force_proxy surface=pipette_contact_surface lc=201 status=proxy-load \/ not pressure-driven value=20\.000000/);
  assert.match(xml, /<surface_load name="pipette_suction_pressure" surface="pipette_suction_surface" type="pressure">/);
  assert.match(xml, /<pressure lc="3">-0\.700000<\/pressure>/);
  assert.match(xml, /<LoadData>/);
  assert.match(xml, /<load_controller id="1" name="lift_ramp" type="loadcurve">/);
  assert.match(xml, /<load_controller id="3" name="suction_pressure_curve" type="loadcurve">/);
  assert.match(xml, /<logfile>/);
  assert.match(xml, /<node_data name="nucleus_nodes" file="febio_nucleus_nodes\.csv" data="ux;uy;uz" delim=",">/);
  assert.match(xml, /<rigid_body_data name="pipette_rigid_body" file="febio_rigid_pipette\.csv" data="x;y;z;Fx;Fy;Fz" delim=",">4<\/rigid_body_data>/);
  assert.match(xml, /derived_data name="pipette_aspiration_length" metric="L\(t\)" unit="um" payload="aspiration\.length" source="native-node-displacement"/);
  assert.match(xml, /<step id="1" name="approach">/);
  assert.match(xml, /<step id="2" name="hold">[\s\S]*<surface_load name="pipette_suction_pressure_hold" surface="pipette_suction_surface" type="pressure">/);
  assert.match(xml, /<step id="3" name="lift">[\s\S]*<value lc="1">8\.000000<\/value>/);
  assert.match(xml, /<step id="3" name="lift">[\s\S]*<pressure lc="3">-0\.700000<\/pressure>/);
  assert.match(xml, /<step id="4" name="manipulation-1">[\s\S]*<value lc="2">-1\.800000<\/value>/);
  assert.match(xml, /<Control>/);
  assert.match(xml, /type="viscoelastic"/);
  assert.match(xml, /<elastic type="neo-Hookean">/);
  assert.match(xml, /<E>20\.000000<\/E>/);
  assert.match(xml, /<v>0\.340000<\/v>/);
  assert.match(xml, /viscosity eta=4\.200000/);
  assert.match(xml, /<E>7\.500000<\/E>/);
  assert.match(xml, /<v>0\.410000<\/v>/);
  assert.match(xml, /viscosity eta=5\.600000/);
  assert.match(xml, /<g1>/);
  assert.match(xml, /<t1>/);
  assert.match(xml, /<var type="contact traction" surface="nucleus_interface_left_surface"\/>/);
  assert.match(xml, /<Contact>/);
  assert.match(xml, /<contact name="nucleus_cytoplasm_interface" type="sticky" surface_pair="nucleus_cytoplasm_pair">/);
  assert.match(xml, /<contact name="cell_dish_interface" type="tied-elastic" surface_pair="cell_dish_pair">/);
  assert.match(xml, /<contact name="pipette_nucleus_contact" type="sticky" surface_pair="pipette_nucleus_pair">/);
  assert.match(xml, /<contact name="pipette_cell_contact" type="sliding-elastic" surface_pair="pipette_cell_pair">/);
  assert.match(xml, /<penalty>1\.550000<\/penalty>/);
  assert.match(xml, /fractureEnergy=0\.350000/);
  assert.match(xml, /solver-primary cohesive approximation/);
  assert.match(xml, /<penalty>/);
  assert.match(xml, /<search_tolerance>/);
  assert.match(xml, /<maxaug>12<\/maxaug>/);
  assert.match(xml, /ramp approach: normalPenalty=/);
  assert.match(xml, /cohesive criticalNormalStress=/);
  assert.match(xml, /<face_data name="nucleus_cytoplasm_left_surface" file="febio_interface_nc_left\.csv" data="contact gap;contact pressure" delim="," surface="nucleus_interface_left_surface" \/>/);
  assert.match(xml, /<DiscreteSet name="nucleus_cytoplasm_left_springs">/);
  assert.match(xml, /cohesive discrete sidecar \(not solver-active yet\)/);
  assert.match(xml, /discrete_material nucleus_cytoplasm_left_springs_material type=nonlinear spring/);
  assert.match(xml, /load_controller 300 points=/);
});

test("nucleus-cytoplasm interface uses solver-primary cohesive approximation while cell-dish remains tied", async () => {
  const app = await loadApp();
  const spec = app.buildFebioInputSpec("A", app.DEFAULTS, app.buildSimulationInput("A", app.DEFAULTS));
  assert.equal(spec.febioTemplateData.interfaces.nucleusCytoplasm.type, "sticky");
  assert.match(spec.febioTemplateData.interfaces.nucleusCytoplasm.status, /sticky-active/);
  assert.match(spec.febioTemplateData.interfaces.nucleusCytoplasm.status, /stabilization-validated/);
  assert.equal(spec.febioTemplateData.interfaces.nucleusCytoplasm.stabilization.augmentation.maxPasses, 12);
  assert.equal(spec.febioTemplateData.interfaces.nucleusCytoplasm.stabilization.ramp[0].step, "approach");
  assert.equal(spec.febioTemplateData.interfaces.nucleusCytoplasm.stabilization.ramp[2].step, "lift");
  assert.equal(spec.febioTemplateData.interfaces.nucleusCytoplasm.validation.valid, true);
  assert.equal(spec.febioTemplateData.interfaces.nucleusCytoplasm.validation.diagnostics.monotonicRamp, true);
  assert.equal(spec.febioTemplateData.interfaces.cellDish.type, "tied-elastic");
});

test("default FEBio main flow disables release-test and stages inward manipulation", async () => {
  const app = await loadApp();
  const spec = app.buildFebioInputSpec("A", app.DEFAULTS, app.buildSimulationInput("A", app.DEFAULTS));
  const stepNames = spec.febioTemplateData.steps.map((step) => step.name);
  assert.equal(
    JSON.stringify(stepNames),
    JSON.stringify(["approach", "hold", "lift", "manipulation-1", "manipulation-2"]),
  );
  assert.match(spec.febioTemplateData.status.notes.join(" "), /release-test step is disabled in the main flow/);
  assert.match(spec.febioTemplateData.status.notes.join(" "), /staged targets/);
});

test("canonical spec carries membrane model selection", async () => {
  const app = await loadApp();
  const spec = app.buildSimulationInput("A", { membraneModel: "shell_membrane_placeholder" });
  const febio = app.buildFebioInputSpec("A", spec.params, spec);
  assert.equal(spec.membraneModel, "shell_membrane_placeholder");
  assert.equal(febio.febioTemplateData.status.membraneModel, "shell_membrane_placeholder");
  assert.equal(febio.febioTemplateData.materials.membrane.status, "partial-shell-placeholder");
});

test("parameter digest is stable and changes on parameter change", async () => {
  const app = await loadApp();
  const first = app.buildSimulationInput("A", { xp: 4.5 });
  const second = app.buildSimulationInput("A", { xp: 4.5 });
  const changed = app.buildSimulationInput("A", { xp: 5.5 });
  assert.equal(first.parameterDigest, second.parameterDigest);
  assert.notEqual(first.parameterDigest, changed.parameterDigest);
});

test("export/import digest match is preserved", async () => {
  const app = await loadApp();
  const spec = app.buildFebioInputSpec("A", app.DEFAULTS, app.buildSimulationInput("A", app.DEFAULTS));
  const imported = app.importFebioResult(
    {
      normalizedResult: {
        caseName: "A",
        params: spec.params,
        isPhysicalFebioResult: true,
        parameterDigest: spec.parameterDigest,
        localNc: {
          left: { damage: 0.1, provenance: "native-face-data-preferred" },
          top: { damage: 0.2, provenance: "native-face-data-preferred" },
          right: { damage: 0.1, provenance: "native-face-data-preferred" },
          bottom: { damage: 0.1, provenance: "native-face-data-preferred" },
        },
        solverMetadata: { solverMode: "febio", source: "febio-cli" },
      },
      canonicalSpec: { parameterDigest: spec.parameterDigest },
      importTimestamp: "2026-04-20T00:00:00.000Z",
    },
    spec,
  );
  assert.equal(imported.parameterDigest, spec.parameterDigest);
  assert.equal(imported.resultProvenance.digestMatch, true);
  assert.equal(imported.isPhysicalFebioResult, true);
});

test("FEBio run bundle declares detachment event contract", async () => {
  const app = await loadApp();
  const spec = app.buildFebioInputSpec("A", app.DEFAULTS, app.buildSimulationInput("A", app.DEFAULTS));
  const bundle = app.buildFebioRunBundle(spec);
  assert.equal(bundle.eventContract.detachment.evaluation, "damage-plus-geometry");
  assert.equal(bundle.eventContract.detachment.events[0], "detachmentStart");
  assert.equal(bundle.eventContract.detachment.events[1], "detachmentComplete");
  assert.equal(bundle.eventContract.detachment.metrics[0], "contactAreaRatio");
  assert.equal(bundle.templateData.outputs.detachment.payloadPath, "normalizedResult.events");
  assert.equal(bundle.validation.nucleusCytoplasm.valid, true);
  assert.equal(bundle.validation.nucleusCytoplasm.diagnostics.rampSteps[0], "approach");
});

test("refined mesh validation report is produced", async () => {
  const app = await loadApp();
  const spec = app.buildFebioInputSpec("A", app.DEFAULTS, app.buildSimulationInput("A", app.DEFAULTS));
  const report = spec.febioTemplateData.geometry.meshValidation;
  assert.equal(report.valid, true);
  assert.equal(typeof report.valid, "boolean");
  assert.ok(Array.isArray(report.invalidElements));
  assert.ok(Array.isArray(report.aspectRatioWarnings));
  assert.equal(report.requiredDomains.nucleus, "present");
  assert.equal(report.requiredDomains.cytoplasm, "present");
  assert.equal(report.requiredDomains.dish, "present");
  assert.equal(report.requiredDomains.pipette, "present");
  assert.equal(report.requiredNodeSets.dish_fixed_nodes, "present");
  assert.equal(report.requiredNodeSets.pipette_contact_nodes, "present");
  assert.equal(report.requiredSurfaces.pipette_contact_surface, true);
  assert.equal(report.requiredSurfaces.pipette_suction_surface, true);
  assert.equal(report.requiredSurfacePairs.nucleus_cytoplasm_pair.primary, true);
  assert.equal(report.requiredSurfacePairs.cell_dish_pair.secondary, true);
  assert.equal(spec.febioTemplateData.geometry.mesh.surfacePairs.pipette_cell_pair.primary, "pipette_suction_surface");
  assert.equal(spec.febioTemplateData.geometry.mesh.bounds.pipetteContactX, spec.febioTemplateData.geometry.mesh.bounds.pipetteLeft);
  assert.equal(JSON.stringify(spec.febioTemplateData.geometry.mesh.surfaces.pipette_contact_surface[0].nodes), JSON.stringify([17, 20, 24, 21]));
  assert.equal(JSON.stringify(spec.febioTemplateData.geometry.mesh.surfaces.pipette_suction_surface[0].nodes), JSON.stringify([10, 14, 15, 11]));
});

test("mesh validation rejects missing solver-active domains and required surface pairs", async () => {
  const app = await loadApp();
  const { validateFebioMesh } = await loadGeneratedModule("febio/mesh/index.js");
  const spec = app.buildFebioInputSpec("A", app.DEFAULTS, app.buildSimulationInput("A", app.DEFAULTS));
  const mesh = spec.febioTemplateData.geometry.mesh;
  const report = validateFebioMesh({
    ...mesh,
    elementSets: {
      ...mesh.elementSets,
      nucleus: [],
      pipette: [],
    },
    surfaces: {
      ...mesh.surfaces,
      dish_contact_surface: [],
      pipette_contact_surface: [],
    },
    nodeSets: {
      ...mesh.nodeSets,
      pipette_contact_nodes: [],
    },
    surfacePairs: {
      ...mesh.surfacePairs,
      cell_dish_pair: {
        ...mesh.surfacePairs.cell_dish_pair,
        secondary: "cell_dish_surface",
      },
    },
  });

  assert.equal(report.valid, false);
  assert.match(report.invalidElements.join("\n"), /nucleus element set must be non-empty/);
  assert.match(report.invalidElements.join("\n"), /pipette element set must be non-empty/);
  assert.match(report.invalidElements.join("\n"), /pipette_contact_nodes node set must be non-empty/);
  assert.match(report.invalidElements.join("\n"), /dish_contact_surface surface must be present and non-empty/);
  assert.match(report.invalidElements.join("\n"), /pipette_contact_surface surface must be present and non-empty/);
  assert.match(report.invalidElements.join("\n"), /cell_dish_pair secondary surface must be dish_contact_surface/);
});

test("display helpers prefer physical FEBio results", async () => {
  const app = await loadApp();
  assert.equal(app.shouldRenderAsMainResult({ isPhysicalFebioResult: false }), false);
  assert.equal(app.shouldRenderAsMainResult({ isPhysicalFebioResult: true }), true);
  const display = app.describeDisplayedResult(null);
  assert.equal(display.title, "awaiting FEBio result");
  assert.match(display.detail, /awaiting FEBio result/);
});

test("classification prefers native detachment signals and keeps proxy fallback explicit", async () => {
  const app = await loadApp();
  assert.equal(typeof app.applyRunClassification, "function");
  assert.equal(typeof app.assessDetachment, "function");
  assert.equal(typeof app.findEarliestLocalFailure, "function");
  const result = {
    captureEstablished: true,
    captureMaintained: true,
    damage: { nc: 0.8, cd: 0.05, membrane: 0.2 },
    localNc: {
      left: { damage: 0.2, provenance: "native-face-data-preferred" },
      top: { damage: 0.82, provenance: "native-face-data-preferred", firstFailureTime: 1.4, firstFailureMode: "normal" },
      right: { damage: 0.2, provenance: "native-face-data-preferred" },
      bottom: { damage: 0.2, provenance: "native-face-data-preferred" },
    },
    membraneRegions: { top_neck: { damage: 0.25 } },
    detachmentMetrics: { contactAreaRatio: 0.2, relativeNucleusDisplacement: 0.4 },
    displacements: { nucleus: 0.4 },
    events: { ncDamageStart: { time: 1.4 } },
    peaks: {},
  };
  assert.equal(app.findEarliestLocalFailure(result).site, "nc:top");
  assert.equal(app.applyRunClassification(result, "test-source").classification, "nucleus_detached");
  assert.equal(result.classificationSource, "test-source");
  assert.equal(result.firstFailureSite, "nc:top");
  assert.equal(app.assessDetachment(result).mode, "native");
});

test("import supplements detachment events from native-first history", async () => {
  const app = await loadApp();
  const spec = app.buildSimulationInput("A", app.DEFAULTS);
  const imported = app.importFebioResult(
    {
      normalizedResult: {
        caseName: "A",
        params: spec.params,
        localNc: {
          top: { damage: 0.8, provenance: "native-face-data-preferred" },
        },
        history: [
          {
            time: 1.5,
            localNc: {
              top: { damage: 0.2, provenance: "native-face-data-preferred" },
            },
            displacements: { nucleus: 0.05 },
          },
          {
            time: 2.5,
            localNc: {
              top: { damage: 0.5, provenance: "native-face-data-preferred" },
            },
            detachmentMetrics: { contactAreaRatio: 0.55 },
            displacements: { nucleus: 0.2 },
          },
          {
            time: 3.5,
            localNc: {
              top: { damage: 0.8, provenance: "native-face-data-preferred" },
            },
            detachmentMetrics: { contactAreaRatio: 0.2 },
            displacements: { nucleus: 0.35 },
          },
        ],
      },
    },
    spec,
  );

  assert.equal(imported.events.detachmentStart.time, 2.5);
  assert.equal(imported.events.detachmentComplete.time, 3.5);
  assert.equal(imported.events.detachmentStart.source, "history-derived");
  assert.equal(imported.detachmentMetrics.provenance, "proxy/native");
  assert.equal(imported.classification, "nucleus_detached");
});

test("import preserves explicit detachment events from external payloads", async () => {
  const app = await loadApp();
  const spec = app.buildSimulationInput("A", app.DEFAULTS);
  const imported = app.importFebioResult(
    {
      normalizedResult: {
        caseName: "A",
        params: spec.params,
        detachment: {
          start: { time: 1.75, detail: "external explicit start", source: "external-explicit" },
          complete: 3.25,
        },
        nativeFaceData: {
          relativeNucleusDisplacement: 0.28,
        },
      },
    },
    spec,
  );

  assert.equal(imported.events.detachmentStart.time, 1.75);
  assert.equal(imported.events.detachmentStart.source, "external-explicit");
  assert.equal(imported.events.detachmentComplete.time, 3.25);
  assert.equal(imported.events.detachmentComplete.source, "payload-detachment-object");
  assert.equal(imported.resultProvenance.detachmentEvents.start, "external-explicit");
  assert.equal(imported.resultProvenance.detachmentEvents.complete, "payload-detachment-object");
  assert.equal(imported.classification, "nucleus_detached");
});

test("import preserves converted interface observation coverage metadata", async () => {
  const app = await loadApp();
  const spec = app.buildSimulationInput("A", app.DEFAULTS);
  const imported = app.importFebioResult(
    {
      normalizedResult: {
        caseName: "A",
        params: spec.params,
        interfaceObservation: {
          localNc: {
            left: {
              actualSources: {
                normal: "native-face-pressure",
                damage: "native-face-gap-pressure",
                shear: "native-plotfile-contact-traction",
              },
              standardTangentialBridge: {
                variable: "contact traction",
                payloadPath: "plotfileSurfaceData.localNc.left",
              },
            },
          },
        },
      },
      outputMapping: {
        localNc: {
          left: {
            logfileData: "contact gap;contact pressure",
          },
        },
      },
    },
    spec,
  );

  assert.equal(imported.resultProvenance.interfaceObservation.localNc.left.actualSources.shear, "native-plotfile-contact-traction");
  assert.equal(imported.resultProvenance.outputMapping.localNc.left.logfileData, "contact gap;contact pressure");
});

test("import merges partial localNc payloads without dropping explicit provenance", async () => {
  const app = await loadApp();
  const spec = app.buildSimulationInput("A", app.DEFAULTS);
  const imported = app.importFebioResult(
    {
      normalizedResult: {
        caseName: "A",
        params: spec.params,
        localNc: {
          top: { damage: 0.5, provenance: "native-face-data-preferred" },
        },
      },
    },
    spec,
  );

  assert.equal(imported.localNc.top.provenance, "native-face-data-preferred");
  assert.equal(imported.localNc.left.provenance, "proxy-fallback-explicit");
  assert.equal(imported.localNc.right.damage, 0);
});

test("import derives localNc and detachment metrics from native face-data payloads", async () => {
  const app = await loadApp();
  const spec = app.buildSimulationInput("A", app.DEFAULTS);
  const imported = app.importFebioResult(
    {
      normalizedResult: {
        caseName: "A",
        params: spec.params,
        faceData: {
          contactAreaRatio: 0.42,
          nucleusCytoplasmRegions: [
            {
              region: "left",
              contactPressure: 0.18,
              shearTraction: 0.09,
              damage: 0.12,
            },
            {
              region: "top",
              contactPressure: 0.31,
              shearTraction: 0.27,
              contactFraction: 0.34,
            },
          ],
        },
      },
    },
    spec,
  );

  assert.equal(imported.localNc.left.provenance, "native-face-data-preferred");
  assert.equal(imported.localNc.left.normalStress, 0.18);
  assert.equal(imported.localNc.left.sourceNormal, "native-face-pressure");
  assert.equal(imported.localNc.left.sourceDamage, "native-face-gap-pressure");
  assert.equal(imported.localNc.top.shearStress, 0.27);
  assert.equal(imported.localNc.top.sourceShear, "native-face-traction");
  assert.equal(imported.localNc.top.contactFraction, 0.34);
  assert.ok(Math.abs(imported.localNc.top.damage - 0.66) < 1e-9);
  assert.equal(imported.localNc.right.provenance, "proxy-fallback-explicit");
  assert.equal(imported.detachmentMetrics.contactAreaRatio, 0.42);
  assert.equal(imported.detachmentMetrics.provenance, "native-face-data-preferred");
});

test("import reuses native localNc payload metrics before proxy detachment fallback", async () => {
  const app = await loadApp();
  const spec = app.buildSimulationInput("A", app.DEFAULTS);
  const imported = app.importFebioResult(
    {
      normalizedResult: {
        caseName: "A",
        params: spec.params,
        localNcNative: {
          top: {
            contactPressure: 0.26,
            shearTraction: 0.14,
            contactFraction: 0.24,
            nativeGap: 0.11,
            provenance: "native-face-data-preferred",
          },
          left: {
            contactPressure: 0.12,
            shearTraction: 0.06,
            contactFraction: 0.92,
            nativeGap: 0.01,
            provenance: "native-face-data-preferred",
          },
        },
      },
    },
    spec,
  );

  assert.equal(imported.localNc.top.contactFraction, 0.24);
  assert.equal(imported.localNc.top.nativeGap, 0.11);
  assert.ok(Math.abs(imported.localNc.top.damage - 0.76) < 1e-9);
  assert.equal(imported.localNc.top.sourceShear, "native-face-traction");
  assert.equal(imported.localNc.left.contactFraction, 0.92);
  assert.equal(imported.detachmentMetrics.provenance, "native-face-data-preferred");
  assert.ok(Math.abs(imported.detachmentMetrics.contactAreaRatio - 0.58) < 1e-9);
});

test("import preserves explicit native localNc source labels from converted FEBio payloads", async () => {
  const app = await loadApp();
  const spec = app.buildSimulationInput("A", app.DEFAULTS);
  const imported = app.importFebioResult(
    {
      normalizedResult: {
        caseName: "A",
        params: spec.params,
        localNcNative: {
          top: {
            shearStress: 0.22,
            damage: 0.44,
            sourceNormal: "native-face-pressure",
            sourceDamage: "native-face-gap-pressure",
            sourceShear: "native-face-traction",
            provenance: "native-face-data-preferred",
          },
        },
      },
    },
    spec,
  );

  assert.equal(imported.localNc.top.sourceNormal, "native-face-pressure");
  assert.equal(imported.localNc.top.sourceDamage, "native-face-gap-pressure");
  assert.equal(imported.localNc.top.sourceShear, "native-face-traction");
});

test("import derives localCd from native face-data payloads and keeps source labels", async () => {
  const app = await loadApp();
  const spec = app.buildSimulationInput("A", app.DEFAULTS);
  const imported = app.importFebioResult(
    {
      normalizedResult: {
        caseName: "A",
        params: spec.params,
        faceData: {
          cellDishRegions: [
            {
              region: "left",
              contactPressure: 0.19,
              tangentialTraction: 0.08,
              contactFraction: 0.84,
              provenance: "native-face-data-preferred",
            },
            {
              region: "center",
              contactPressure: 0.28,
              tangentialTraction: 0.11,
              damage: 0.35,
              nativeGap: 0.07,
              provenance: "native-face-data-preferred",
            },
          ],
        },
      },
    },
    spec,
  );

  assert.equal(imported.localCd.left.normalStress, 0.19);
  assert.equal(imported.localCd.left.shearStress, 0.08);
  assert.equal(imported.localCd.left.contactFraction, 0.84);
  assert.ok(Math.abs(imported.localCd.left.damage - 0.16) < 1e-9);
  assert.equal(imported.localCd.left.sourceNormal, "native-face-pressure");
  assert.equal(imported.localCd.left.sourceDamage, "native-face-gap-pressure");
  assert.equal(imported.localCd.left.sourceShear, "native-face-traction");
  assert.equal(imported.localCd.center.nativeGap, 0.07);
  assert.equal(imported.localCd.center.sourceShear, "native-face-traction");
  assert.equal(imported.localCd.right.provenance, "proxy-fallback-explicit");
});

test("import normalizes history localCd native payloads before membrane and damage summaries", async () => {
  const app = await loadApp();
  const spec = app.buildSimulationInput("A", app.DEFAULTS);
  const imported = app.importFebioResult(
    {
      normalizedResult: {
        caseName: "A",
        params: spec.params,
        history: [
          {
            time: 1.25,
            localCdNative: {
              center: {
                contactPressure: 0.24,
                shearTraction: 0.13,
                contactFraction: 0.58,
                provenance: "native-face-data-preferred",
              },
            },
          },
        ],
      },
    },
    spec,
  );

  assert.equal(imported.history[0].localCd.center.normalStress, 0.24);
  assert.equal(imported.history[0].localCd.center.shearStress, 0.13);
  assert.equal(imported.history[0].localCd.center.contactFraction, 0.58);
  assert.ok(Math.abs(imported.history[0].localCd.center.damage - 0.42) < 1e-9);
  assert.equal(imported.history[0].localCd.center.sourceNormal, "native-face-pressure");
  assert.equal(imported.history[0].localCd.center.sourceDamage, "native-face-gap-pressure");
  assert.equal(imported.history[0].localCd.center.sourceShear, "native-face-traction");
  assert.ok(Math.abs(imported.history[0].damageCd - 0.42) < 1e-9);
});

test("external FEBio converter builds native-first detachment metrics from localNc state", () => {
  const detachmentMetrics = buildDetachmentMetricsFromLocalState(
    {
      left: { damage: 0.1, contactFraction: 0.9, sourceDamage: "native-face-gap-pressure" },
      top: { damage: 0.55, contactFraction: 0.45, sourceDamage: "native-face-gap-pressure" },
      right: { damage: 0.2, contactFraction: 0.8, sourceDamage: "native-face-gap-pressure" },
      bottom: { damage: 0.35, contactFraction: 0.65, sourceDamage: "native-face-gap-pressure" },
    },
    { nucleus: 0.31 },
  );

  assert.equal(detachmentMetrics.relativeNucleusDisplacement, 0.31);
  assert.ok(Math.abs(detachmentMetrics.contactAreaRatio - 0.7) < 1e-9);
  assert.equal(detachmentMetrics.provenance, "native-face-data-preferred");
});

test("external FEBio converter reads native tangential traction from face snapshots when available", () => {
  const shear = computeTangentialTractionFromFaceSnapshot({
    records: [
      [1, 0.03, 0.25, 0.3, 0.4],
      [2, 0.02, 0.21, 0.0, 0.5],
    ],
  });

  assert.ok(Math.abs(shear - 0.5) < 1e-9);
});

test("external FEBio converter reads tangential traction from standard plotfile bridge entries", () => {
  assert.equal(
    computeTangentialTractionFromPlotfileBridge("localNc", "left", {
      contactTraction: { x: 0.21, z: 0.48 },
    }),
    0.48,
  );
  assert.equal(
    computeTangentialTractionFromPlotfileBridge("localNc", "top", {
      contactTraction: [0.37, 0, 0.12],
    }),
    0.37,
  );
  assert.equal(
    computeTangentialTractionFromPlotfileBridge("localCd", "center", {
      tangentialTraction: 0.29,
    }),
    0.29,
  );
});

test("external FEBio converter prefers standard plotfile traction bridge over proxy shear fallback", () => {
  const resolved = resolveTangentialShearObservation(
    "localNc",
    "left",
    {
      records: [
        [1, 0.03, 0.25],
        [2, 0.02, 0.21],
      ],
    },
    [
      {
        time: 1.0,
        contactTraction: { x: 0.18, z: 0.44 },
      },
    ],
    1.0,
    { shearStress: 0.05 },
  );

  assert.equal(resolved.sourceShear, "native-plotfile-contact-traction");
  assert.equal(resolved.shearStress, 0.44);
});

test("external FEBio converter supports face snapshots without a leading entity id", () => {
  const snapshot = {
    records: [
      [0.03, 0.25, 0.3, 0.4],
      [0.02, 0.21, 0.0, 0.5],
    ],
  };

  assert.equal(inferFaceSnapshotValueOffset(snapshot), 0);
  assert.ok(Math.abs(computeTangentialTractionFromFaceSnapshot(snapshot) - 0.5) < 1e-9);
});

test("external FEBio converter supports face snapshots with id plus extra metadata columns", () => {
  const snapshot = {
    dataFields: ["contact gap", "contact pressure", "traction x", "traction y"],
    records: [
      [101, 9.5, 0.03, 0.25, 0.3, 0.4],
      [102, 9.7, 0.02, 0.21, 0.0, 0.5],
    ],
  };

  assert.equal(inferFaceSnapshotValueOffset(snapshot), 2);
  assert.ok(Math.abs(computeTangentialTractionFromFaceSnapshot(snapshot) - 0.5) < 1e-9);
});

test("external FEBio converter follows descriptor field order for tangential traction", () => {
  const snapshot = {
    dataFields: ["traction x", "traction y", "contact gap", "contact pressure"],
    records: [
      [101, 9.5, 0.3, 0.4, 0.03, 0.25],
      [102, 9.7, 0.0, 0.5, 0.02, 0.21],
    ],
  };

  assert.equal(inferFaceSnapshotValueOffset(snapshot), 2);
  assert.ok(Math.abs(computeTangentialTractionFromFaceSnapshot(snapshot) - 0.5) < 1e-9);
});

test("external FEBio converter keeps shear native-null when face snapshots have no tangential columns", () => {
  const shear = computeTangentialTractionFromFaceSnapshot({
    records: [
      [1, 0.03, 0.25],
      [2, 0.02, 0.21],
    ],
  });

  assert.equal(shear, null);
});

test("external FEBio converter reads rigid body reaction after position columns", () => {
  const state = getRigidPipetteState(
    {
      time: 5,
      records: [
        [4, -6, 0, 16.15, -7.28, 0, 0],
      ],
    },
    { x: 1, y: 2 },
  );

  assert.deepEqual(state.position, { x: -6, z: 16.15 });
  assert.deepEqual(state.reaction, { x: -7.28, z: 0 });
});

test("external FEBio converter emits explicit detachment events from history", () => {
  const result = {
    history: [
      {
        time: 1.2,
        localNc: {
          left: { damage: 0.1, sourceDamage: "native-face-gap-pressure" },
          top: { damage: 0.25, sourceDamage: "native-face-gap-pressure" },
          right: { damage: 0.1, sourceDamage: "native-face-gap-pressure" },
          bottom: { damage: 0.1, sourceDamage: "native-face-gap-pressure" },
        },
        damage: { nc: 0.25 },
        detachmentMetrics: { contactAreaRatio: 0.82, relativeNucleusDisplacement: 0.06 },
        displacements: { nucleus: 0.06 },
      },
      {
        time: 2.4,
        localNc: {
          left: { damage: 0.2, sourceDamage: "native-face-gap-pressure" },
          top: { damage: 0.52, sourceDamage: "native-face-gap-pressure" },
          right: { damage: 0.2, sourceDamage: "native-face-gap-pressure" },
          bottom: { damage: 0.2, sourceDamage: "native-face-gap-pressure" },
        },
        damage: { nc: 0.52 },
        detachmentMetrics: { contactAreaRatio: 0.58, relativeNucleusDisplacement: 0.2 },
        displacements: { nucleus: 0.2 },
      },
      {
        time: 3.6,
        localNc: {
          left: { damage: 0.25, sourceDamage: "native-face-gap-pressure" },
          top: { damage: 0.78, sourceDamage: "native-face-gap-pressure" },
          right: { damage: 0.25, sourceDamage: "native-face-gap-pressure" },
          bottom: { damage: 0.25, sourceDamage: "native-face-gap-pressure" },
        },
        damage: { nc: 0.78 },
        detachmentMetrics: { contactAreaRatio: 0.22, relativeNucleusDisplacement: 0.34 },
        displacements: { nucleus: 0.34 },
      },
    ],
    localNc: {
      left: { damage: 0.25, sourceDamage: "native-face-gap-pressure" },
      top: { damage: 0.78, sourceDamage: "native-face-gap-pressure" },
      right: { damage: 0.25, sourceDamage: "native-face-gap-pressure" },
      bottom: { damage: 0.25, sourceDamage: "native-face-gap-pressure" },
    },
    damage: { nc: 0.78 },
    detachmentMetrics: { contactAreaRatio: 0.22, relativeNucleusDisplacement: 0.34 },
    displacements: { nucleus: 0.34 },
    events: {},
  };

  attachExplicitDetachmentEvents(result);

  assert.equal(result.events.detachmentStart.time, 2.4);
  assert.equal(result.events.detachmentComplete.time, 3.6);
  assert.equal(result.events.detachmentStart.source, "external-explicit");
  assert.equal(result.detachment.evaluation, "damage-plus-geometry");
});

test("default FEBio flow is native-spec first and does not use lightweight legacy source", async () => {
  const app = await loadApp();
  const result = app.runSimulation({ caseName: "S7_public_native_default", loads: { suctionPressure: { value: -1.4 } } });
  assert.equal(result.solverMetadata.source, "febio-native-export-ready");
  assert.notEqual(result.solverMetadata.source, "lightweight-js-surrogate");
  assert.equal(result.nativeSpec.loads.suctionPressure.value, -1.4);
  assert.equal(result.params && Object.keys(result.params).length, 0);
  assert.ok(result.parameterDigest.startsWith("fdig_"));
  assert.equal(result.isPhysicalFebioResult, false);
});

test("canonical FEBio flow is explicit compatibility path", async () => {
  const app = await loadApp();
  const result = app.runCanonicalSimulation("A", app.DEFAULTS);
  assert.equal(result.solverMetadata.source, "febio-export-ready");
  assert.ok(result.parameterDigest.startsWith("pdig_"));
  assert.equal(result.params.Lc, app.DEFAULTS.Lc);
  assert.equal(result.isPhysicalFebioResult, false);
});

test("FEBio-native direct spec exports XML without UI parameter conversion", async () => {
  const app = await loadApp();
  const nativeSpec = app.createDefaultFebioNativeSpec({
    caseName: "S7_direct_test",
    loads: {
      suctionPressure: { value: -1.2 },
    },
    contacts: {
      nucleusCytoplasm: { normalStiffness: 1.9 },
    },
  });
  const input = app.buildFebioNativeInputSpec(nativeSpec);
  const bundle = app.buildFebioNativeRunBundle(input, app.serializeFebioTemplateToXml);
  const xml = bundle.febXml;

  assert.equal(input.solverMetadata.source, "febio-native-direct");
  assert.equal(input.febioTemplateData.status.buildMode, "febio-native-direct");
  assert.equal(input.febioTemplateData.interfaces.nucleusCytoplasm.normalStiffness, 1.9);
  assert.equal(input.febioTemplateData.loads.pressure[0].value, -1.2);
  assert.equal(input.febioTemplateData.loads.pressure[0].magnitude, 1.2);
  assert.equal(bundle.solverMetadata.source, "febio-native-direct");
  assert.equal(bundle.exportReady, true);
  assert.match(xml, /febio-native-direct/);
  assert.match(xml, /<surface_load name="pipette_suction_pressure" surface="pipette_suction_surface" type="pressure">/);
  assert.match(xml, /<pressure lc="3">-1\.200000<\/pressure>/);
  assert.match(xml, /<contact name="pipette_nucleus_contact" type="sticky" surface_pair="pipette_nucleus_pair">/);
  assert.equal(input.nativeSpec.geometry.nucleus.width, 28);
  assert.equal(input.nativeSpec.geometry.pipette.puncture.x, 4.5);
  assert.equal(input.nativeSpec.geometry.pipette.tip.x, 14);
  assert.equal(input.nativeSpec.geometry.meshMode, "s7-debug-local-nucleus");
  assert.equal(input.nativeSpec.loads.suctionPressure.surface, "pipette_suction_surface");
  assert.equal(input.febioTemplateData.geometry.mesh.bounds.pipetteContactX, 14);
  assert.equal(JSON.stringify(input.febioTemplateData.geometry.mesh.surfaces.pipette_suction_surface[0].nodes), JSON.stringify([10, 14, 15, 11]));
  assert.equal(input.nativeSpec.unitSystem, "um-nN-s");
});

test("docs and governance files exist and stay aligned", () => {
  const agentPath = path.resolve("AGENT.md");
  const progressPath = path.resolve("PROGRESS.md");
  const roadmapPath = path.resolve("docs/ops/ROADMAP.md");
  const codebasePath = path.resolve("docs/CODEBASE_STRUCTURE.md");
  const nativeSpecDocPath = path.resolve("docs/febio/FEBIO_NATIVE_SPEC.md");
  const febioMappingPath = path.resolve("docs/febio/FEBIO_OUTPUT_MAPPING.md");
  const exportScriptPath = path.resolve("scripts/export_febio_case.mjs");
  const directExportScriptPath = path.resolve("scripts/export_febio_direct_case.mjs");
  const convertScriptPath = path.resolve("scripts/convert_febio_output.mjs");
  const skillPaths = [
    path.resolve(".skills/nucleus-cytoplasm-interface/SKILL.md"),
    path.resolve(".skills/progress-update/SKILL.md"),
    path.resolve(".skills/schema-edit/SKILL.md"),
    path.resolve(".skills/classification-native/SKILL.md"),
  ];

  assert.equal(fs.existsSync(agentPath), true);
  assert.equal(fs.existsSync(progressPath), true);
  assert.equal(fs.existsSync(roadmapPath), true);
  assert.equal(fs.existsSync(codebasePath), true);
  assert.equal(fs.existsSync(nativeSpecDocPath), true);
  assert.equal(fs.existsSync(febioMappingPath), true);
  assert.equal(fs.existsSync(exportScriptPath), true);
  assert.equal(fs.existsSync(directExportScriptPath), true);
  assert.equal(fs.existsSync(convertScriptPath), true);
  skillPaths.forEach((skillPath) => assert.equal(fs.existsSync(skillPath), true));

  const agent = fs.readFileSync(agentPath, "utf8");
  const progress = fs.readFileSync(progressPath, "utf8");
  const roadmap = fs.readFileSync(roadmapPath, "utf8");
  const codebase = fs.readFileSync(codebasePath, "utf8");
  const nativeSpecDoc = fs.readFileSync(nativeSpecDocPath, "utf8");
  const febioMapping = fs.readFileSync(febioMappingPath, "utf8");
  const exportScript = fs.readFileSync(exportScriptPath, "utf8");
  const directExportScript = fs.readFileSync(directExportScriptPath, "utf8");
  const convertScript = fs.readFileSync(convertScriptPath, "utf8");

  assert.match(agent, /Skill Usage Rule/);
  assert.match(agent, /src\/model\/schema\.ts/);
  assert.match(agent, /src\/febio\/interfaces\/nucleusCytoplasm\.ts/);
  assert.match(agent, /Code Exploration Constraints/);
  assert.match(agent, /FEBio-native direct parameter path/);
  assert.match(agent, /docs\/ops\/ROADMAP\.md/);

  assert.match(progress, /Stage S6 completed/);
  assert.match(progress, /simulation condition advancement/);
  assert.match(progress, /solver-native load\/contact activation/);
  assert.match(progress, /pressure\/contact load/);
  assert.match(progress, /Milestone S7-A/);
  assert.match(progress, /FEBio-native spec JSON/);
  assert.match(progress, /implemented-infrastructure \/ output-contract-complete/);
  assert.match(progress, /um-s-kPa-nN|um-nN-s|µm-s-kPa-nN/);

  assert.match(roadmap, /Simulation Condition Advancement/);
  assert.match(roadmap, /Stage S1: Solver-active mesh completeness/);
  assert.match(roadmap, /Stage S7: FEBio-native direct parameter path and load\/contact activation validation/);
  assert.match(roadmap, /After S7 Review Gates/);
  assert.match(roadmap, /Compatibility Retirement/);
  assert.match(roadmap, /FEBio-native spec first policy/);
  assert.match(roadmap, /次に編集する具体ファイル/);

  assert.match(codebase, /src\/model\/schema\.ts/);
  assert.match(codebase, /src\/febio\/export\/index\.ts/);
  assert.match(codebase, /src\/febio\/mesh\/index\.ts/);
  assert.match(codebase, /generated\/dist\/browser\/main\.js/);
  assert.match(nativeSpecDoc, /FEBio-native spec JSON/);
  assert.match(nativeSpecDoc, /force-transfer \/ contact activation/);
  assert.match(progress, /cell-dish solver-active contact が未復帰/);
  assert.match(roadmap, /Stage S6: True cohesive\/failure preparation \| completed-with-residual/);
  assert.match(roadmap, /native interface traction \/ damage output/);
  assert.match(roadmap, /CLI\/backend export/);
  assert.match(progress, /load\/contact\/output 成立後に cohesive \/ detachment solver validation/);
  assert.match(febioMapping, /native 接線成分の更新|Native Tangential Update/);
  assert.match(febioMapping, /rows that start directly with face values/);
  assert.doesNotMatch(exportScript, /simulation\.js|simulation-febio|node:vm|vm\.runInContext/);
  assert.doesNotMatch(directExportScript, /buildSimulationInput|buildFebioInputSpec|public-api\.ts|simulation\.js|simulation-febio|node:vm|vm\.runInContext/);
  assert.doesNotMatch(convertScript, /simulation\.js|simulation-febio|node:vm|vm\.runInContext/);
  assert.match(`${exportScript}\n${convertScript}`, /src/);
  assert.match(`${exportScript}\n${convertScript}`, /public-api\.ts/);
  assert.match(directExportScript, /febio-native-direct/);
});
