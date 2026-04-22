import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadApp } from "./load-app.mjs";

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
  assert.equal(febio.febioTemplateData.status.buildMode, "refined");
});

test("template serializes to consistent FEBio XML", async () => {
  const app = await loadApp();
  const spec = app.buildFebioInputSpec("A", app.DEFAULTS, app.buildSimulationInput("A", app.DEFAULTS));
  const xml = app.serializeFebioTemplateToXml(spec.febioTemplateData);
  assert.match(xml, /<febio_spec version="4\.0">/);
  assert.match(xml, /<Material>/);
  assert.match(xml, /<Mesh>/);
  assert.match(xml, /<SurfacePair name="nucleus_cytoplasm_pair">/);
  assert.match(xml, /<step id="1" name="approach">/);
  assert.match(xml, /type="viscoelastic"/);
  assert.match(xml, /<g1>/);
  assert.match(xml, /<t1>/);
  assert.match(xml, /<contact name="nucleus_cytoplasm_interface" type="sticky" surface_pair="nucleus_cytoplasm_pair">/);
  assert.match(xml, /solver-primary cohesive approximation/);
  assert.match(xml, /cohesive criticalNormalStress=/);
  assert.match(xml, /<face_data name="nucleus_cytoplasm_left_surface" file="febio_interface_nc_left\.csv"\/>/);
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

test("refined mesh validation report is produced", async () => {
  const app = await loadApp();
  const spec = app.buildFebioInputSpec("A", app.DEFAULTS, app.buildSimulationInput("A", app.DEFAULTS));
  const report = spec.febioTemplateData.geometry.meshValidation;
  assert.equal(typeof report.valid, "boolean");
  assert.ok(Array.isArray(report.invalidElements));
  assert.ok(Array.isArray(report.aspectRatioWarnings));
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
  const result = {
    captureEstablished: true,
    captureMaintained: true,
    damage: { nc: 0.8, cd: 0.05, membrane: 0.2 },
    localNc: {
      left: { damage: 0.2, provenance: "native-face-data-preferred" },
      top: { damage: 0.82, provenance: "native-face-data-preferred" },
      right: { damage: 0.2, provenance: "native-face-data-preferred" },
      bottom: { damage: 0.2, provenance: "native-face-data-preferred" },
    },
    membraneRegions: { top_neck: { damage: 0.25 } },
    detachmentMetrics: { contactAreaRatio: 0.2, relativeNucleusDisplacement: 0.4 },
    displacements: { nucleus: 0.4 },
    events: {},
    peaks: {},
  };
  assert.equal(app.classifyRun(result), "nucleus_detached");
});

test("default FEBio flow does not use lightweight legacy source", async () => {
  const app = await loadApp();
  const result = app.runSimulation("A", app.DEFAULTS);
  assert.equal(result.solverMetadata.source, "febio-export-ready");
  assert.notEqual(result.solverMetadata.source, "lightweight-js-surrogate");
  assert.equal(result.isPhysicalFebioResult, false);
});

test("docs and governance files exist and stay aligned", () => {
  const agentPath = path.resolve("AGENT.md");
  const progressPath = path.resolve("PROGRESS.md");
  const codebasePath = path.resolve("CODEBASE_STRUCTURE.md");
  const skillPaths = [
    path.resolve(".skills/nucleus-cytoplasm-interface/SKILL.md"),
    path.resolve(".skills/progress-update/SKILL.md"),
    path.resolve(".skills/schema-edit/SKILL.md"),
    path.resolve(".skills/classification-native/SKILL.md"),
  ];

  assert.equal(fs.existsSync(agentPath), true);
  assert.equal(fs.existsSync(progressPath), true);
  assert.equal(fs.existsSync(codebasePath), true);
  skillPaths.forEach((skillPath) => assert.equal(fs.existsSync(skillPath), true));

  const agent = fs.readFileSync(agentPath, "utf8");
  const progress = fs.readFileSync(progressPath, "utf8");
  const codebase = fs.readFileSync(codebasePath, "utf8");

  assert.match(agent, /Skill Usage Rule/);
  assert.match(agent, /src\/model\/schema\.ts/);
  assert.match(agent, /src\/febio\/interfaces\/nucleusCytoplasm\.ts/);
  assert.match(agent, /Code Exploration Constraints/);
  assert.match(agent, /Physics Model Priority/);

  assert.match(progress, /1\. nucleus-cytoplasm cohesive の安定化/);
  assert.match(progress, /2\. `localNc` の native 出力化/);
  assert.match(progress, /3\. classification の native 化/);
  assert.match(progress, /## Update Rules/);
  assert.match(progress, /proxy\/native/);

  assert.match(codebase, /src\/model\/schema\.ts/);
  assert.match(codebase, /src\/febio\/export\/index\.ts/);
  assert.match(codebase, /dist\/browser\/main\.js/);
});
