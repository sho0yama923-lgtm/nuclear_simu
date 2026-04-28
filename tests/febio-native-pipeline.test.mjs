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

function xpltChunk(id, payload = Buffer.alloc(0)) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(id, 0);
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

function xpltInt(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32LE(value, 0);
  return buffer;
}

function xpltFloat(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeFloatLE(value, 0);
  return buffer;
}

function xpltContactForceRow(itemId, x, y, z) {
  const buffer = Buffer.alloc(20);
  buffer.writeInt32LE(itemId, 0);
  buffer.writeInt32LE(12, 4);
  buffer.writeFloatLE(x, 8);
  buffer.writeFloatLE(y, 12);
  buffer.writeFloatLE(z, 16);
  return buffer;
}

function buildMinimalXpltContactForce(states) {
  const preamble = Buffer.alloc(12);
  preamble.write("BEF\0", 0, "latin1");
  preamble.writeUInt32LE(0x01000000, 4);
  preamble.writeUInt32LE(0, 8);
  const surfaceRecord = (itemId, name) => {
    const nameBuffer = Buffer.from(name, "utf8");
    const payload = Buffer.alloc(4 + nameBuffer.length);
    payload.writeUInt32LE(nameBuffer.length, 0);
    nameBuffer.copy(payload, 4);
    return xpltChunk(0x00310401, Buffer.concat([
      xpltChunk(0x02310401, xpltInt(itemId)),
      xpltChunk(0x04310401, payload)
    ]));
  };
  return Buffer.concat([
    preamble,
    xpltChunk(0x00300401, Buffer.concat([
      surfaceRecord(1, "cell_dish_surface"),
      surfaceRecord(2, "dish_contact_surface")
    ])),
    ...states.map((state) => xpltChunk(0x00000002, Buffer.concat([
      xpltChunk(0x00000102, xpltChunk(0x02000102, xpltFloat(state.time))),
      xpltChunk(0x00000202, xpltChunk(0x00050202, xpltChunk(0x01000202, Buffer.concat([
        xpltChunk(0x02000202, xpltInt(1)),
        xpltChunk(0x03000202, Buffer.concat(state.rows.map((row) => xpltContactForceRow(row.itemId, row.x, row.y, row.z))))
      ]))))
    ])))
  ]);
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
  assert.equal(model.effectiveNativeSpec.outputNameTag, "S7-K");
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
  assert.equal(model.geometry.meshValidation.contactPairDiagnostics.checks.cell_dish_left.normalGapMagnitude, 0);
  assert.equal(model.geometry.meshValidation.contactPairDiagnostics.checks.cell_dish_center.normalGapMagnitude, 0);
  assert.equal(model.geometry.meshValidation.contactPairDiagnostics.checks.cell_dish_right.normalGapMagnitude, 0);
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
  assert.match(xml, /<NodeSet name="nucleus_nodes">45,46,47,48,49,50,51,52<\/NodeSet>/);
  assert.match(xml, /<node_data name="nucleus_nodes" file="febio_nucleus_nodes\.csv" data="ux;uy;uz" delim="," node_set="nucleus_nodes" \/>/);
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
    "S7-K_S7_native_baseline.feb",
    "S7-K_S7_native_baseline_effective_native_spec.json",
    "S7-K_S7_native_baseline_native_model.json",
    "S7-K_S7_native_baseline_manifest.json",
    "S7-K_S7_native_baseline_README.txt"
  ];
  files.forEach((file) => assert.equal(fs.existsSync(path.join(outDir, file)), true));
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "S7-K_S7_native_baseline_manifest.json"), "utf8"));
  assert.equal(manifest.outputNameTag, "S7-K");
  assert.equal(manifest.baseName, "S7-K_S7_native_baseline");
  assert.equal(manifest.solverMetadata.source, "febio-native-only");
  assert.match(manifest.commands.febioCli, /febio4 -i/);
  assert.match(manifest.files.feb, /S7-K_S7_native_baseline\.feb/);
  assert.match(manifest.expectedArtifacts.logPath, /S7-K_S7_native_baseline\.log/);
  assert.match(manifest.expectedArtifacts.xpltPath, /S7-K_S7_native_baseline\.xplt/);
  assert.ok(manifest.expectedArtifacts.csvOutputPaths.some((entry) => entry.endsWith("febio_pipette_cell_contact.csv")));
});

test("native run diagnostics summarize final contact and reaction gates", async () => {
  const native = await loadNativeModule();
  const block = (name, rows) => [
    "*Step  = 1",
    "*Time  = 5",
    `*Data  = ${name}`,
    ...rows
  ].join("\n");
  const summary = native.summarizeNativeFebioRunFiles({
    log: "Intel MKL WARNING: platform notice\nN O R M A L   T E R M I N A T I O N\n",
    cellDish: block("cell_dish_interface_surface", ["1,0.47,0", "2,0.41,0", "3,0.57,0"]),
    pipetteCell: block("pipette_cell_contact_surface", ["1,0.12,0.14"]),
    pipetteContact: block("pipette_contact_surface", ["1,0,0"]),
    rigidPipette: block("pipette_rigid_body", ["4 16.5 0 16.15 1.2 0 4.4"]),
    nucleus: block("nucleus_nodes", ["45 -4 0 -0.5"]),
    cytoplasm: block("cytoplasm_nodes", ["45,-4,0,-0.5"]),
    xplt: buildMinimalXpltContactForce([
      { time: 0, rows: [{ itemId: 1, x: 0, y: 0, z: 0 }] },
      { time: 5, rows: [{ itemId: 1, x: 25, y: 0, z: 2.5 }, { itemId: 2, x: -25, y: 0, z: -2.5 }] }
    ])
  });

  assert.equal(summary.warnings.normalTermination, 1);
  assert.equal(summary.warnings.platformWarning, 1);
  assert.equal(summary.gates.warningFree, true);
  assert.equal(summary.cellDish.maxAbsPressure, 0);
  assert.equal(summary.cellDish.maxFinalGap, 0.57);
  assert.equal(summary.gates.cellDishLoadBearing, false);
  assert.equal(summary.gates.cellDishGapControlled, false);
  assert.equal(summary.pipetteCell.maxAbsPressure, 0.14);
  assert.equal(summary.rigidPipette.reaction.Fx, 1.2);
  assert.equal(summary.gates.pipetteInteractionActive, true);
  assert.equal(summary.gates.nucleusCytoplasmMoved, true);
  assert.equal(summary.gates.plotfileContactForceActive, true);
  assert.equal(summary.plotfileContactForce.stateCount, 2);
  assert.equal(summary.plotfileContactForce.maxAbs.x, 25);
  assert.equal(summary.plotfileContactForce.maxAbs.z, 2.5);
  assert.equal(summary.plotfileContactForce.zToXRatio, 0.1);
  assert.equal(summary.plotfileContactForce.surfaceByItemId["1"], "cell_dish_surface");
  assert.equal(summary.plotfileContactForce.finalState.rows[0].surface, "cell_dish_surface");
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
