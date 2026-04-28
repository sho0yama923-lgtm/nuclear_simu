import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

async function loadNativeModule() {
  const modulePath = path.resolve(process.cwd(), "generated", "dist", "febio", "native", "index.js");
  return import(pathToFileURL(modulePath).href);
}

test("native-only case builds FEBio model and XML without compatibility entrypoints", async () => {
  const native = await loadNativeModule();
  const casePath = path.resolve("febio_cases/native/S7_baseline.native.json");
  const caseSpec = JSON.parse(fs.readFileSync(casePath, "utf8"));
  const model = native.buildNativeFebioModel(caseSpec);
  const xml = native.serializeNativeModelToFebioXml(model);

  assert.equal(model.status.buildMode, "febio-native-only");
  assert.equal(model.status.source, "febio-native-case");
  assert.equal(model.exportReady, true);
  assert.equal(model.effectiveNativeSpec.caseName, "S7_native_baseline");
  assert.ok(model.parameterDigest.startsWith("fdig_"));
  assert.equal(model.geometry.meshValidation.valid, true);
  assert.equal(model.geometry.meshValidation.coordinateConvention.axes.x.positive, "from cell center toward the pipette/barrel side");
  assert.equal(model.geometry.meshValidation.surfaceNormalDiagnostics.entries.pipette_suction_surface.actual, "-x");
  assert.equal(model.geometry.meshValidation.pressureDiagnostics.suctionSurface, "pipette_suction_surface");
  assert.equal(model.geometry.meshValidation.pressureDiagnostics.surfaceOwnership, "deformable-side capture surface");
  assert.equal(model.geometry.meshValidation.pressureDiagnostics.negativePressureEffect, "intended to pull toward +x, into the pipette/barrel side");
  assert.equal(model.geometry.meshValidation.contactPairDiagnostics.checks.pipette_cell.aligned, true);
  assert.equal(model.geometry.meshValidation.contactPairDiagnostics.checks.nc_left.aligned, true);
  assert.equal(model.geometry.meshValidation.contactPairDiagnostics.checks.cell_dish_left.aligned, true);
  assert.deepEqual(model.geometry.meshValidation.conventionWarnings, []);
  assert.equal(model.geometry.mesh.elementSets.dish.length, 3);
  assert.equal(model.geometry.mesh.surfaces.dish_contact_surface.length, 3);
  assert.equal(model.geometry.mesh.refinements.cellDishBands.mode, "in-place-current-native");
  assert.equal(model.geometry.mesh.refinements.nucleusCytoplasmCoupling.mode, "in-place-current-native-shared-nodes");
  assert.equal(model.interfaces.nucleusCytoplasm.normalStiffness, 1.35);
  assert.equal(model.interfaces.nucleusCytoplasm.type, "conformal-shared-node");
  assert.equal(model.interfaces.nucleusCytoplasm.requestedType, "sticky");
  assert.match(model.interfaces.nucleusCytoplasm.status, /force-transfer-shared-node/);
  assert.equal(model.interfaces.nucleusCytoplasm.localSurfacePairs.right.name, "nucleus_cytoplasm_right_pair");
  assert.equal(model.interfaces.nucleusCytoplasm.penalty.Kn > 1, true);
  assert.equal(model.interfaces.nucleusCytoplasm.cohesiveApproximation.maxTraction > 1, true);
  assert.equal(model.interfaces.nucleusCytoplasm.stabilization.augmentation.enabled, false);
  assert.equal(model.interfaces.cellDish.solverActive, true);
  assert.equal(model.contact.pipetteNucleus.solverActive, false);
  assert.equal(model.loads.pressure[0].value, -0.7);
  assert.equal(model.loads.pressure[0].surface, "pipette_suction_surface");

  assert.match(xml, /<Material>/);
  assert.match(xml, /<Mesh>/);
  assert.match(xml, /<Surface name="pipette_suction_surface">/);
  assert.doesNotMatch(xml, /<SurfacePair name="nucleus_cytoplasm_pair">/);
  assert.doesNotMatch(xml, /<contact name="nucleus_cytoplasm/);
  assert.match(xml, /nucleus_cytoplasm_interface omitted/);
  assert.match(xml, /<contact name="cell_dish_interface" type="tied-elastic" surface_pair="cell_dish_pair">/);
  assert.doesNotMatch(xml, /<contact name="pipette_nucleus_contact"/);
  assert.match(xml, /<surface_load name="pipette_suction_pressure" surface="pipette_suction_surface" type="pressure">/);
  assert.match(xml, /<Boundary>/);
  assert.match(xml, /<Output>/);

  const newPathText = [
    fs.readFileSync(path.resolve("src/febio/native/index.ts"), "utf8"),
    fs.readFileSync(path.resolve("src/febio/native/caseSpec.ts"), "utf8"),
    fs.readFileSync(path.resolve("src/febio/native/model.ts"), "utf8"),
    fs.readFileSync(path.resolve("src/febio/native/xml.ts"), "utf8"),
    fs.readFileSync(path.resolve("src/febio/native/exportCase.ts"), "utf8"),
    fs.readFileSync(path.resolve("scripts/export_febio_native_case.mjs"), "utf8")
  ].join("\n");
  assert.doesNotMatch(newPathText, /toLegacyTemplateShape|buildSimulationInput|buildFebioInputSpec|buildFebioNativeRunBundle|runSimulation|src\/public-api\.ts|generated\/dist|normalizeFebioResult|classification|simulation-febio/);
});

test("native-only export script writes FEBio handoff artifacts", () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "nuclear-simu-native-export-"));
  const printed = execFileSync(
    process.execPath,
    [
      "scripts/export_febio_native_case.mjs",
      "--case",
      "febio_cases/native/S7_baseline.native.json",
      "--out-dir",
      outDir
    ],
    { encoding: "utf8" }
  ).trim();

  assert.equal(printed, outDir);
  const files = [
    "S7_native_baseline.feb",
    "S7_native_baseline_effective_native_spec.json",
    "S7_native_baseline_native_model.json",
    "S7_native_baseline_manifest.json",
    "S7_native_baseline_README.txt"
  ];
  files.forEach((file) => assert.equal(fs.existsSync(path.join(outDir, file)), true));
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "S7_native_baseline_manifest.json"), "utf8"));
  assert.equal(manifest.solverMetadata.source, "febio-native-only");
  assert.match(manifest.commands.febioCli, /febio4 -i/);
  assert.match(manifest.files.feb, /S7_native_baseline\.feb/);
  assert.match(manifest.expectedArtifacts.logPath, /S7_native_baseline\.log/);
  assert.match(manifest.expectedArtifacts.xpltPath, /S7_native_baseline\.xplt/);
  assert.ok(manifest.expectedArtifacts.csvOutputPaths.some((entry) => entry.endsWith("febio_pipette_cell_contact.csv")));
});

test("FEBio path ownership docs freeze legacy paths outside the native-only exporter", () => {
  const activeFiles = fs.readFileSync(path.resolve("ACTIVE_FILES.md"), "utf8");
  const legacyReadme = fs.readFileSync(path.resolve("legacy/README.md"), "utf8");
  const ownership = fs.readFileSync(path.resolve("docs/febio/FEBIO_PATH_OWNERSHIP.md"), "utf8");
  const agent = fs.readFileSync(path.resolve("AGENT.md"), "utf8");
  const codebase = fs.readFileSync(path.resolve("docs/CODEBASE_STRUCTURE.md"), "utf8");
  const workflow = fs.readFileSync(path.resolve("docs/ops/CHANGE_WORKFLOW.md"), "utf8");
  const combined = `${activeFiles}\n${legacyReadme}\n${ownership}\n${agent}\n${codebase}\n${workflow}`;

  assert.match(activeFiles, /Active FEBio Export Path/);
  assert.match(activeFiles, /src\/febio\/native\//);
  assert.match(legacyReadme, /retired FEBio paths/);
  assert.match(ownership, /The only active FEBio export path/);
  assert.match(ownership, /Legacy Freeze/);
  assert.match(ownership, /src\/febio\/spec\//);
  assert.match(ownership, /scripts\/export_febio_direct_case\.mjs/);
  assert.match(ownership, /src\/public-api\.ts/);
  assert.match(ownership, /legacy\/docs\/febio\/PARAMETER_MAPPING\.md/);
  assert.match(ownership, /legacy\/febio_exports\//);
  assert.match(agent, /FEBio Active Path Lock/);
  assert.match(codebase, /Active \/ Legacy FEBio Ownership/);
  assert.match(workflow, /legacy \/ compatibility freeze/);
  assert.match(combined, /src\/febio\/native\//);
  assert.match(combined, /scripts\/export_febio_native_case\.mjs/);
});

test("geometry convention docs define active native coordinate and pressure rules", () => {
  const conventions = fs.readFileSync(path.resolve("docs/febio/GEOMETRY_CONVENTIONS.md"), "utf8");

  assert.match(conventions, /x`: aspiration \/ manipulation axis/);
  assert.match(conventions, /\+x`: from cell center toward the pipette \/ barrel side/);
  assert.match(conventions, /FEBio Quad Winding/);
  assert.match(conventions, /pipette_suction_surface` is the deformable-side capture surface/);
  assert.match(conventions, /Negative suction pressure is intended to pull toward `\+x`/);
  assert.match(conventions, /nucleus_cytoplasm_pair/);
  assert.match(conventions, /conventionWarnings/);
});
