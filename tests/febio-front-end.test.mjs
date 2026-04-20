import test from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./load-app.mjs";

test("UI input maps into canonical spec", () => {
  const app = loadApp();
  const spec = app.buildSimulationInput("A", { xp: 6.2, zp: 9.1, En: 4.4, adhesionPattern: "edge_strong" });
  assert.equal(spec.geometry.xp, 6.2);
  assert.equal(spec.geometry.zp, 9.1);
  assert.equal(spec.material.En, 4.4);
  assert.equal(spec.adhesionPattern, "edge_strong");
  assert.ok(spec.validationReport.valid);
  assert.ok(spec.parameterDigest.startsWith("pdig_"));
});

test("canonical spec maps into FEBio template data", () => {
  const app = loadApp();
  const spec = app.buildSimulationInput("A", { Kn_nc: 1.3, Gc_cd: 1.5 });
  const febio = app.buildFebioInputSpec("A", spec.params, spec);
  assert.equal(febio.febioTemplateData.interfaces.nucleusCytoplasm.normalStiffness, 1.3);
  assert.equal(febio.febioTemplateData.interfaces.cellDish.fractureEnergy, 1.5);
  assert.equal(febio.febioTemplateData.materials.nucleus.elastic.E, spec.material.En);
  assert.equal(febio.febioTemplateData.materials.nucleus.viscous.implemented, true);
  assert.equal(febio.febioTemplateData.status.buildMode, "refined");
});

test("template serializes to consistent FEBio XML", () => {
  const app = loadApp();
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
  assert.match(xml, /cohesive-ready criticalNormalStress=/);
  assert.match(xml, /<DiscreteSet name="nucleus_cytoplasm_left_springs">/);
  assert.match(xml, /cohesive discrete sidecar \(not solver-active yet\)/);
  assert.match(xml, /discrete_material nucleus_cytoplasm_left_springs_material type=nonlinear spring/);
  assert.match(xml, /load_controller 300 points=/);
});

test("canonical spec carries membrane model selection", () => {
  const app = loadApp();
  const spec = app.buildSimulationInput("A", { membraneModel: "shell_membrane_placeholder" });
  const febio = app.buildFebioInputSpec("A", spec.params, spec);
  assert.equal(spec.membraneModel, "shell_membrane_placeholder");
  assert.equal(febio.febioTemplateData.status.membraneModel, "shell_membrane_placeholder");
  assert.equal(febio.febioTemplateData.materials.membrane.status, "partial-shell-placeholder");
});

test("parameter digest is stable and changes on parameter change", () => {
  const app = loadApp();
  const first = app.buildSimulationInput("A", { xp: 4.5 });
  const second = app.buildSimulationInput("A", { xp: 4.5 });
  const changed = app.buildSimulationInput("A", { xp: 5.5 });
  assert.equal(first.parameterDigest, second.parameterDigest);
  assert.notEqual(first.parameterDigest, changed.parameterDigest);
});

test("export/import digest match is preserved", () => {
  const app = loadApp();
  const spec = app.buildFebioInputSpec("A", app.DEFAULTS, app.buildSimulationInput("A", app.DEFAULTS));
  const imported = app.importFebioResult(
    {
      normalizedResult: {
        caseName: "A",
        params: spec.params,
        isPhysicalFebioResult: true,
        parameterDigest: spec.parameterDigest,
        solverMetadata: { solverMode: "febio", source: "febio-cli" },
      },
      canonicalSpec: { parameterDigest: spec.parameterDigest },
      importTimestamp: "2026-04-20T00:00:00.000Z",
    },
    spec,
  );
  assert.equal(imported.parameterDigest, spec.parameterDigest);
  assert.equal(imported.resultProvenance.digestMatch, true);
});

test("refined mesh validation report is produced", () => {
  const app = loadApp();
  const spec = app.buildFebioInputSpec("A", app.DEFAULTS, app.buildSimulationInput("A", app.DEFAULTS));
  const report = spec.febioTemplateData.geometry.meshValidation;
  assert.equal(typeof report.valid, "boolean");
  assert.ok(Array.isArray(report.invalidElements));
  assert.ok(Array.isArray(report.aspectRatioWarnings));
});

test("UI helper rejects non-physical result as main display", () => {
  const app = loadApp({ includeUi: true });
  assert.equal(app.shouldRenderAsMainResult({ isPhysicalFebioResult: false }), false);
  assert.equal(app.shouldRenderAsMainResult({ isPhysicalFebioResult: true }), true);
});

test("digest mismatch prevents adopting imported result as main physical result", () => {
  const app = loadApp({ includeUi: true });
  const spec = app.buildFebioInputSpec("A", app.DEFAULTS, app.buildSimulationInput("A", app.DEFAULTS));
  const imported = app.loadExternalResult({
    normalizedResult: {
      caseName: "A",
      params: spec.params,
      isPhysicalFebioResult: true,
      parameterDigest: "pdig_mismatch",
      solverMetadata: { solverMode: "febio", source: "febio-cli" },
    },
    canonicalSpec: {
      caseName: "A",
      params: spec.params,
      parameterDigest: spec.parameterDigest,
    },
    importTimestamp: "2026-04-20T00:00:00.000Z",
  });
  assert.equal(imported.isPhysicalFebioResult, false);
  assert.equal(imported.resultProvenance.digestMatch, false);
});

test("missing digest also prevents adopting imported result as main physical result", () => {
  const app = loadApp({ includeUi: true });
  const imported = app.loadExternalResult({
    normalizedResult: {
      caseName: "A",
      params: app.DEFAULTS,
      isPhysicalFebioResult: true,
      solverMetadata: { solverMode: "febio", source: "febio-cli" },
    },
    canonicalSpec: {
      caseName: "A",
      params: app.DEFAULTS,
    },
    importTimestamp: "2026-04-20T00:00:00.000Z",
  });
  assert.equal(imported.isPhysicalFebioResult, false);
  assert.equal(imported.resultProvenance.digestMatch, false);
});

test("awaiting result display description is used when no physical result exists", () => {
  const app = loadApp({ includeUi: true });
  const display = app.describeDisplayedResult(null);
  assert.equal(display.title, "awaiting FEBio result");
  assert.match(display.detail, /awaiting FEBio result/);
});

test("default FEBio flow does not use lightweight legacy source", () => {
  const app = loadApp();
  const result = app.runSimulation("A", app.DEFAULTS);
  assert.equal(result.solverMetadata.source, "febio-export-ready");
  assert.notEqual(result.solverMetadata.source, "lightweight-js-surrogate");
  assert.equal(result.isPhysicalFebioResult, false);
});

test("legacy lightweight helpers are not in the default app bundle", () => {
  const app = loadApp();
  assert.equal(typeof app.__NUCLEAR_SIMU_LEGACY__, "undefined");
});

test("legacy lightweight helpers exist only when the legacy module is loaded", () => {
  const app = loadApp({ includeLegacy: true });
  assert.equal(typeof app.__NUCLEAR_SIMU_LEGACY__.runLegacySimulation, "function");
  assert.equal(typeof app.__NUCLEAR_SIMU_LEGACY__.describeDisplayedResultLegacy, "function");
});

test("export bundle is not ready when mesh validation fails", () => {
  const app = loadApp();
  const spec = app.buildFebioInputSpec("A", app.DEFAULTS, app.buildSimulationInput("A", app.DEFAULTS));
  spec.febioTemplateData.geometry.meshValidation.valid = false;
  const bundle = app.buildFebioRunBundle(spec);
  assert.equal(bundle.exportReady, false);
});
