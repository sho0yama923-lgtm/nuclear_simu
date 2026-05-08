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
      surfaceRecord(2, "dish_contact_surface"),
      surfaceRecord(3, "pipette_suction_surface"),
      surfaceRecord(4, "pipette_contact_surface")
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
  assert.equal(model.geometry.meshValidation.pressureDiagnostics.couplingReadiness.ready, false);
  assert.equal(model.geometry.meshValidation.pressureDiagnostics.couplingReadiness.normalGapMagnitude, 0);
  assert.equal(model.geometry.meshValidation.pressureDiagnostics.couplingReadiness.tangentialOffsetMagnitude, 8.5);
  assert.match(model.geometry.meshValidation.pressureDiagnostics.couplingReadiness.interpretation, /not tangentially colocated/);
  assert.equal(model.geometry.meshValidation.contactPairDiagnostics.checks.pipette_cell.aligned, true);
  assert.equal(model.geometry.meshValidation.contactPairDiagnostics.checks.pipette_cell.normalGapMagnitude, 0);
  assert.equal(model.geometry.meshValidation.contactPairDiagnostics.checks.pipette_cell.tangentialOffsetMagnitude, 8.5);
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
  assert.equal(model.loads.pressure.some((entry) => entry.name === "cell_dish_normal_preload"), false);
  assert.equal(model.effectiveNativeSpec.loads.cellDishNormalPreload.enabled, false);

  assert.match(xml, /<Material>/);
  assert.match(xml, /<Mesh>/);
  assert.match(xml, /<Surface name="pipette_suction_surface">/);
  assert.doesNotMatch(xml, /<SurfacePair name="nucleus_cytoplasm_pair">/);
  assert.doesNotMatch(xml, /<contact name="nucleus_cytoplasm/);
  assert.match(xml, /nucleus_cytoplasm_interface omitted/);
  assert.match(xml, /<contact name="cell_dish_interface" type="tied-elastic" surface_pair="cell_dish_pair">/);
  assert.doesNotMatch(xml, /<contact name="pipette_nucleus_contact"/);
  assert.match(xml, /<surface_load name="pipette_suction_pressure" surface="pipette_suction_surface" type="pressure">/);
  assert.doesNotMatch(xml, /cell_dish_normal_preload/);
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

test("native-only normal preload case declares bounded cell-dish preload", async () => {
  const native = await loadNativeModule();
  const cases = [
    { file: "febio_cases/native/S7_normal_preload.native.json", caseName: "S7_normal_preload", tag: "S7-L", value: 0.05, xmlValue: "0\\.050000" },
    { file: "febio_cases/native/S7_normal_preload_high.native.json", caseName: "S7_normal_preload_high", tag: "S7-M", value: 0.1, xmlValue: "0\\.100000" },
    { file: "febio_cases/native/S8_pipette_aligned.native.json", caseName: "S8_pipette_aligned", tag: "S8-B", value: 0.1, xmlValue: "0\\.100000" },
    { file: "febio_cases/native/S8_pipette_capture_hold.native.json", caseName: "S8_pipette_capture_hold", tag: "S8-C", value: 0.1, xmlValue: "0\\.100000" },
    { file: "febio_cases/native/S8_pipette_capture_hold_gentle.native.json", caseName: "S8_pipette_capture_hold_gentle", tag: "S8-D", value: 0.1, xmlValue: "0\\.100000" },
    { file: "febio_cases/native/S8_pipette_cell_reversed_pair.native.json", caseName: "S8_pipette_cell_reversed_pair", tag: "S8-E", value: 0.1, xmlValue: "0\\.100000" },
    { file: "febio_cases/native/S8_pipette_outer_cell_surface.native.json", caseName: "S8_pipette_outer_cell_surface", tag: "S8-G", value: 0.1, xmlValue: "0\\.100000" },
    { file: "febio_cases/native/S8_pipette_outer_cell_surface_gentle.native.json", caseName: "S8_pipette_outer_cell_surface_gentle", tag: "S8-H", value: 0.1, xmlValue: "0\\.100000" },
    { file: "febio_cases/native/S8_pipette_outer_cell_surface_soft_contact.native.json", caseName: "S8_pipette_outer_cell_surface_soft_contact", tag: "S8-I", value: 0.1, xmlValue: "0\\.100000" },
    { file: "febio_cases/native/S8_pipette_outer_cell_surface_low_pressure.native.json", caseName: "S8_pipette_outer_cell_surface_low_pressure", tag: "S8-J", value: 0.1, xmlValue: "0\\.100000" },
    { file: "febio_cases/native/S8_pipette_outer_cell_surface_fine_inward.native.json", caseName: "S8_pipette_outer_cell_surface_fine_inward", tag: "S8-K", value: 0.1, xmlValue: "0\\.100000" },
    { file: "febio_cases/native/S8_pipette_outer_cell_surface_delayed_inward.native.json", caseName: "S8_pipette_outer_cell_surface_delayed_inward", tag: "S8-L", value: 0.1, xmlValue: "0\\.100000" },
    { file: "febio_cases/native/S8_pipette_nucleus_pressure_return.native.json", caseName: "S8_pipette_nucleus_pressure_return", tag: "S8-M", value: 0.1, xmlValue: "0\\.100000" }
  ];
  cases.forEach((entry) => {
    const caseSpec = JSON.parse(fs.readFileSync(path.resolve(entry.file), "utf8"));
    const model = native.buildNativeFebioModel(caseSpec);
    const xml = native.serializeNativeModelToFebioXml(model);

    assert.equal(model.caseName, entry.caseName);
    assert.equal(model.effectiveNativeSpec.outputNameTag, entry.tag);
    assert.equal(model.effectiveNativeSpec.loads.cellDishNormalPreload.enabled, true);
    assert.equal(model.effectiveNativeSpec.loads.cellDishNormalPreload.value, entry.value);
    assert.equal(model.loads.pressure.length, 2);
    assert.equal(model.loads.pressure[1].name, "cell_dish_normal_preload");
    assert.equal(model.loads.pressure[1].surface, "cell_dish_surface");
    assert.equal(model.loads.pressure[1].value, entry.value);
    assert.equal(model.loads.pressure[1].loadController, 203);
    assert.equal(model.loads.controllers.some((controller) => controller.id === 203 && controller.name === "cell_dish_normal_preload_curve"), true);
    assert.match(xml, /<surface_load name="cell_dish_normal_preload" surface="cell_dish_surface" type="pressure">/);
    assert.match(xml, new RegExp(`<pressure lc="4">${entry.xmlValue}<\\/pressure>`));
    assert.match(xml, /active-step pressure source=cell_dish_normal_preload/);
    assert.match(xml, /<load_controller id="4" name="cell_dish_normal_preload_curve" type="loadcurve">/);
  });
});

test("native-only S8 pipette-aligned case closes pre-run coupling readiness", async () => {
  const native = await loadNativeModule();
  const baseline = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S7_normal_preload_high.native.json"), "utf8")),
  );
  const aligned = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_aligned.native.json"), "utf8")),
  );
  const baselineReadiness = baseline.geometry.meshValidation.pressureDiagnostics.couplingReadiness;
  const alignedReadiness = aligned.geometry.meshValidation.pressureDiagnostics.couplingReadiness;

  assert.equal(baselineReadiness.ready, false);
  assert.equal(baselineReadiness.tangentialOffsetMagnitude, 8.5);
  assert.equal(aligned.caseName, "S8_pipette_aligned");
  assert.equal(aligned.effectiveNativeSpec.outputNameTag, "S8-B");
  assert.equal(alignedReadiness.ready, true);
  assert.equal(alignedReadiness.normalGapMagnitude, 0);
  assert.equal(alignedReadiness.tangentialOffsetMagnitude, 0);
  assert.equal(aligned.geometry.meshValidation.contactPairDiagnostics.checks.pipette_cell.tangentialOffsetMagnitude, 0);
  assert.equal(aligned.geometry.meshValidation.conventionWarnings.length, 0);
});

test("native-only S8 capture-hold comparison re-enables bounded pipette nucleus contact", async () => {
  const native = await loadNativeModule();
  const aligned = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_aligned.native.json"), "utf8")),
  );
  const captureHold = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_capture_hold.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(captureHold);

  assert.equal(aligned.contact.pipetteNucleus.solverActive, false);
  assert.equal(captureHold.caseName, "S8_pipette_capture_hold");
  assert.equal(captureHold.effectiveNativeSpec.outputNameTag, "S8-C");
  assert.equal(captureHold.contact.pipetteNucleus.solverActive, true);
  assert.equal(captureHold.contact.pipetteNucleus.status, "solver-active bounded capture-hold comparison");
  assert.equal(captureHold.geometry.meshValidation.pressureDiagnostics.couplingReadiness.ready, true);
  assert.match(xml, /<SurfacePair name="pipette_nucleus_pair">/);
  assert.match(xml, /<contact name="pipette_nucleus_contact" type="sticky" surface_pair="pipette_nucleus_pair">/);
  assert.match(xml, /solver-active pipette capture-hold contact status=solver-active bounded capture-hold comparison/);
});

test("native-only S8 gentle capture-hold comparison keeps active contact with reduced manipulation", async () => {
  const native = await loadNativeModule();
  const gentle = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_capture_hold_gentle.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(gentle);

  assert.equal(gentle.caseName, "S8_pipette_capture_hold_gentle");
  assert.equal(gentle.effectiveNativeSpec.outputNameTag, "S8-D");
  assert.equal(gentle.contact.pipetteNucleus.solverActive, true);
  assert.equal(gentle.geometry.meshValidation.pressureDiagnostics.couplingReadiness.ready, true);
  assert.equal(gentle.boundary.prescribed.find((entry) => entry.name === "pipette_lift_z").value, 2);
  assert.equal(gentle.boundary.prescribed.find((entry) => entry.name === "pipette_inward_x").value, 1);
  assert.equal(gentle.boundary.prescribed.find((entry) => entry.name === "pipette_tangent_y").value, 0);
  assert.match(xml, /<contact name="pipette_nucleus_contact" type="sticky" surface_pair="pipette_nucleus_pair">/);
  assert.match(xml, /<value lc="1">2\.000000<\/value>/);
  assert.match(xml, /<value lc="2">-0\.450000<\/value>/);
  assert.match(xml, /<value lc="2">-0\.550000<\/value>/);
});

test("native-only S8 reversed pipette-cell pair compares rigid-primary contact role", async () => {
  const native = await loadNativeModule();
  const reversed = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_cell_reversed_pair.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(reversed);
  const pair = reversed.geometry.mesh.surfacePairs.pipette_cell_pair;
  const pairDiagnostics = reversed.geometry.meshValidation.contactPairDiagnostics.checks.pipette_cell;

  assert.equal(reversed.caseName, "S8_pipette_cell_reversed_pair");
  assert.equal(reversed.effectiveNativeSpec.outputNameTag, "S8-E");
  assert.equal(reversed.contact.pipetteNucleus.solverActive, true);
  assert.equal(reversed.effectiveNativeSpec.contacts.pipetteCell.pairRole, "rigid-primary");
  assert.equal(pair.primary, "pipette_contact_surface");
  assert.equal(pair.secondary, "pipette_suction_surface");
  assert.equal(pairDiagnostics.primary, "pipette_contact_surface");
  assert.equal(pairDiagnostics.secondary, "pipette_suction_surface");
  assert.equal(pairDiagnostics.aligned, true);
  assert.equal(reversed.geometry.meshValidation.pressureDiagnostics.couplingReadiness.ready, true);
  assert.match(xml, /<SurfacePair name="pipette_cell_pair">\n      <primary>pipette_contact_surface<\/primary>\n      <secondary>pipette_suction_surface<\/secondary>/);
  assert.match(xml, /<surface_load name="pipette_suction_pressure" surface="pipette_suction_surface" type="pressure">/);
});

test("native-only S8 outer cell surface comparison separates suction from nucleus-right surface", async () => {
  const native = await loadNativeModule();
  const gentle = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_capture_hold_gentle.native.json"), "utf8")),
  );
  const outer = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_outer_cell_surface.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(outer);
  const overlap = outer.geometry.meshValidation.surfaceOverlapDiagnostics;

  assert.equal(gentle.geometry.meshValidation.surfaceOverlapDiagnostics.pipetteSuctionOverlaps.includes("nucleus_interface_right_surface"), true);
  assert.equal(outer.caseName, "S8_pipette_outer_cell_surface");
  assert.equal(outer.effectiveNativeSpec.outputNameTag, "S8-G");
  assert.equal(outer.contact.pipetteNucleus.solverActive, false);
  assert.equal(outer.effectiveNativeSpec.contacts.pipetteCell.suctionSurfaceMode, "cell-outer-right");
  assert.deepEqual(outer.geometry.mesh.surfaces.pipette_suction_surface[0].nodes, [69, 70, 72, 71]);
  assert.equal(outer.geometry.mesh.refinements.pipetteSuctionSurface.studioCompatibleWinding, true);
  assert.equal(overlap.pipetteSuctionOverlaps.includes("nucleus_interface_right_surface"), false);
  assert.equal(overlap.pipetteSuctionSeparatedFromNucleusRight, true);
  assert.equal(outer.geometry.meshValidation.surfaceNormalDiagnostics.entries.pipette_suction_surface.actual, "+x");
  assert.equal(outer.geometry.meshValidation.pressureDiagnostics.suctionSurfaceMode, "cell-outer-right");
  assert.equal(outer.geometry.meshValidation.pressureDiagnostics.expectedSuctionNormal, "+x");
  assert.equal(outer.geometry.meshValidation.pressureDiagnostics.couplingReadiness.ready, true);
  assert.equal(outer.geometry.meshValidation.contactPairDiagnostics.checks.pipette_cell.normalGapMagnitude, 0);
  assert.equal(outer.geometry.meshValidation.contactPairDiagnostics.checks.pipette_cell.tangentialOffsetMagnitude, 0);
  assert.equal(outer.loads.pressure.find((entry) => entry.name === "pipette_suction_pressure").surface, "pipette_suction_surface");
  assert.match(xml, /<Surface name="pipette_suction_surface">/);
  assert.match(xml, /<quad4 id="20">69,70,72,71<\/quad4>/);
  assert.match(xml, /<surface_load name="pipette_suction_pressure" surface="pipette_suction_surface" type="pressure">/);
  assert.doesNotMatch(xml, /<contact name="pipette_nucleus_contact"/);
});

test("native-only S8 outer cell gentle comparison preserves Studio winding with reduced motion", async () => {
  const native = await loadNativeModule();
  const gentleOuter = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_outer_cell_surface_gentle.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(gentleOuter);

  assert.equal(gentleOuter.caseName, "S8_pipette_outer_cell_surface_gentle");
  assert.equal(gentleOuter.effectiveNativeSpec.outputNameTag, "S8-H");
  assert.equal(gentleOuter.effectiveNativeSpec.contacts.pipetteCell.suctionSurfaceMode, "cell-outer-right");
  assert.deepEqual(gentleOuter.geometry.mesh.surfaces.pipette_suction_surface[0].nodes, [69, 70, 72, 71]);
  assert.equal(gentleOuter.geometry.meshValidation.surfaceOverlapDiagnostics.pipetteSuctionSeparatedFromNucleusRight, true);
  assert.equal(gentleOuter.geometry.meshValidation.pressureDiagnostics.couplingReadiness.ready, true);
  assert.equal(gentleOuter.boundary.prescribed.find((entry) => entry.name === "pipette_lift_z").value, 1);
  assert.equal(gentleOuter.boundary.prescribed.find((entry) => entry.name === "pipette_inward_x").value, 0.25);
  assert.match(xml, /<quad4 id="20">69,70,72,71<\/quad4>/);
  assert.match(xml, /<value lc="1">1\.000000<\/value>/);
  assert.match(xml, /<value lc="2">-0\.112500<\/value>/);
  assert.match(xml, /<value lc="2">-0\.137500<\/value>/);
});

test("native-only S8 outer cell soft-contact comparison lowers pipette-cell penalty", async () => {
  const native = await loadNativeModule();
  const soft = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_outer_cell_surface_soft_contact.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(soft);

  assert.equal(soft.caseName, "S8_pipette_outer_cell_surface_soft_contact");
  assert.equal(soft.effectiveNativeSpec.outputNameTag, "S8-I");
  assert.equal(soft.contact.pipetteCell.penaltyScale, 0.25);
  assert.ok(Math.abs(soft.contact.pipetteCell.penalty - 1.74375) < 1e-12);
  assert.deepEqual(soft.geometry.mesh.surfaces.pipette_suction_surface[0].nodes, [69, 70, 72, 71]);
  assert.equal(soft.geometry.meshValidation.pressureDiagnostics.couplingReadiness.ready, true);
  assert.match(xml, /<quad4 id="20">69,70,72,71<\/quad4>/);
  assert.match(xml, /<penalty>1\.743750<\/penalty>/);
});

test("native-only S8 outer cell low-pressure comparison preserves contact geometry", async () => {
  const native = await loadNativeModule();
  const lowPressure = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_outer_cell_surface_low_pressure.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(lowPressure);

  assert.equal(lowPressure.caseName, "S8_pipette_outer_cell_surface_low_pressure");
  assert.equal(lowPressure.effectiveNativeSpec.outputNameTag, "S8-J");
  assert.equal(lowPressure.effectiveNativeSpec.contacts.pipetteCell.suctionSurfaceMode, "cell-outer-right");
  assert.equal(lowPressure.effectiveNativeSpec.loads.suctionPressure.value, -0.35);
  assert.equal(lowPressure.contact.pipetteCell.penaltyScale, 1);
  assert.ok(Math.abs(lowPressure.contact.pipetteCell.penalty - 6.975) < 1e-12);
  assert.deepEqual(lowPressure.geometry.mesh.surfaces.pipette_suction_surface[0].nodes, [69, 70, 72, 71]);
  assert.equal(lowPressure.geometry.meshValidation.surfaceOverlapDiagnostics.pipetteSuctionSeparatedFromNucleusRight, true);
  assert.equal(lowPressure.geometry.meshValidation.pressureDiagnostics.couplingReadiness.ready, true);
  assert.equal(lowPressure.boundary.prescribed.find((entry) => entry.name === "pipette_lift_z").value, 1);
  assert.equal(lowPressure.boundary.prescribed.find((entry) => entry.name === "pipette_inward_x").value, 0.25);
  assert.match(xml, /<quad4 id="20">69,70,72,71<\/quad4>/);
  assert.match(xml, /<pressure lc="3">-0\.350000<\/pressure>/);
  assert.match(xml, /<penalty>6\.975000<\/penalty>/);
});

test("native-only S8 fine inward comparison preserves force geometry and refines manipulation steps", async () => {
  const native = await loadNativeModule();
  const fineInward = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_outer_cell_surface_fine_inward.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(fineInward);

  assert.equal(fineInward.caseName, "S8_pipette_outer_cell_surface_fine_inward");
  assert.equal(fineInward.effectiveNativeSpec.outputNameTag, "S8-K");
  assert.equal(fineInward.effectiveNativeSpec.contacts.pipetteCell.suctionSurfaceMode, "cell-outer-right");
  assert.deepEqual(fineInward.geometry.mesh.surfaces.pipette_suction_surface[0].nodes, [69, 70, 72, 71]);
  assert.equal(fineInward.geometry.meshValidation.surfaceOverlapDiagnostics.pipetteSuctionSeparatedFromNucleusRight, true);
  assert.equal(fineInward.geometry.meshValidation.pressureDiagnostics.couplingReadiness.ready, true);
  assert.equal(fineInward.boundary.prescribed.find((entry) => entry.name === "pipette_lift_z").value, 1);
  assert.equal(fineInward.boundary.prescribed.find((entry) => entry.name === "pipette_inward_x").value, 0.25);
  assert.match(xml, /<step id="4" name="manipulation-1">\n    <Control>\n      <analysis>static<\/analysis>\n      <time_steps>360<\/time_steps>\n      <step_size>0\.002778<\/step_size>/);
  assert.match(xml, /<step id="5" name="manipulation-2">\n    <Control>\n      <analysis>static<\/analysis>\n      <time_steps>90<\/time_steps>\n      <step_size>0\.011111<\/step_size>/);
  assert.match(xml, /<value lc="2">-0\.112500<\/value>/);
  assert.match(xml, /<value lc="2">-0\.137500<\/value>/);
  assert.match(xml, /<pressure lc="3">-0\.700000<\/pressure>/);
  assert.match(xml, /<penalty>6\.975000<\/penalty>/);
});

test("native-only S8 delayed inward comparison preserves force geometry and shifts ramp onset", async () => {
  const native = await loadNativeModule();
  const delayedInward = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_outer_cell_surface_delayed_inward.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(delayedInward);

  assert.equal(delayedInward.caseName, "S8_pipette_outer_cell_surface_delayed_inward");
  assert.equal(delayedInward.effectiveNativeSpec.outputNameTag, "S8-L");
  assert.equal(delayedInward.effectiveNativeSpec.contacts.pipetteCell.suctionSurfaceMode, "cell-outer-right");
  assert.deepEqual(delayedInward.geometry.mesh.surfaces.pipette_suction_surface[0].nodes, [69, 70, 72, 71]);
  assert.equal(delayedInward.geometry.meshValidation.surfaceOverlapDiagnostics.pipetteSuctionSeparatedFromNucleusRight, true);
  assert.equal(delayedInward.geometry.meshValidation.pressureDiagnostics.couplingReadiness.ready, true);
  assert.equal(delayedInward.loads.controllers.find((entry) => entry.id === 102).points[1][0], 3.2);
  assert.equal(delayedInward.loads.controllers.find((entry) => entry.id === 102).points[2][0], 4.4);
  assert.match(xml, /<load_controller id="2" name="inward_ramp" type="loadcurve">[\s\S]*<point>3\.200000, 0\.000000<\/point>[\s\S]*<point>4\.400000, 1\.000000<\/point>/);
  assert.match(xml, /<value lc="2">-0\.112500<\/value>/);
  assert.match(xml, /<value lc="2">-0\.137500<\/value>/);
  assert.match(xml, /<pressure lc="3">-0\.700000<\/pressure>/);
  assert.match(xml, /<penalty>6\.975000<\/penalty>/);
});

test("native-only S8 nucleus-pressure return uses the target nucleus-side suction surface", async () => {
  const native = await loadNativeModule();
  const nucleusPressure = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_nucleus_pressure_return.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(nucleusPressure);
  const overlap = nucleusPressure.geometry.meshValidation.surfaceOverlapDiagnostics;

  assert.equal(nucleusPressure.caseName, "S8_pipette_nucleus_pressure_return");
  assert.equal(nucleusPressure.effectiveNativeSpec.outputNameTag, "S8-M");
  assert.equal(nucleusPressure.effectiveNativeSpec.contacts.pipetteCell.suctionSurfaceMode, "nucleus-right");
  assert.deepEqual(nucleusPressure.geometry.mesh.surfaces.pipette_suction_surface[0].nodes, [46, 50, 51, 47]);
  assert.equal(nucleusPressure.geometry.mesh.refinements.pipetteSuctionSurface.mode, "nucleus-right");
  assert.equal(nucleusPressure.geometry.meshValidation.surfaceNormalDiagnostics.entries.pipette_suction_surface.actual, "-x");
  assert.equal(nucleusPressure.geometry.meshValidation.pressureDiagnostics.suctionSurfaceMode, "nucleus-right");
  assert.equal(nucleusPressure.geometry.meshValidation.pressureDiagnostics.expectedSuctionNormal, "-x");
  assert.equal(nucleusPressure.geometry.meshValidation.pressureDiagnostics.couplingReadiness.ready, true);
  assert.deepEqual(nucleusPressure.geometry.mesh.nodeSets.pipette_suction_nodes, [46, 47, 50, 51]);
  assert.equal(nucleusPressure.logOutputs.nodeData.find((entry) => entry.name === "pipette_suction_nodes").nodeSet, "pipette_suction_nodes");
  assert.equal(nucleusPressure.logOutputs.nodeData.find((entry) => entry.name === "nc_right_nucleus_nodes").file, "febio_nc_right_nucleus_nodes.csv");
  assert.equal(nucleusPressure.logOutputs.nodeData.find((entry) => entry.name === "nc_right_cytoplasm_nodes").evidence, "shared-node-nc-displacement");
  assert.equal(overlap.pipetteSuctionOverlaps.includes("nucleus_interface_right_surface"), true);
  assert.equal(overlap.pipetteSuctionSeparatedFromNucleusRight, false);
  assert.equal(nucleusPressure.contact.pipetteNucleus.solverActive, false);
  assert.equal(nucleusPressure.boundary.prescribed.find((entry) => entry.name === "pipette_lift_z").value, 1);
  assert.equal(nucleusPressure.boundary.prescribed.find((entry) => entry.name === "pipette_inward_x").value, 0.25);
  assert.match(xml, /<quad4 id="20">46,50,51,47<\/quad4>/);
  assert.match(xml, /<NodeSet name="pipette_suction_nodes">46,47,50,51<\/NodeSet>/);
  assert.match(xml, /<node_data name="pipette_suction_nodes" file="febio_pipette_suction_nodes\.csv" data="ux;uy;uz" delim="," node_set="pipette_suction_nodes" \/>/);
  assert.match(xml, /<NodeSet name="nc_right_nucleus_nodes">46,47,50,51<\/NodeSet>/);
  assert.match(xml, /<node_data name="nc_right_nucleus_nodes" file="febio_nc_right_nucleus_nodes\.csv" data="ux;uy;uz" delim="," node_set="nc_right_nucleus_nodes" \/>/);
  assert.match(xml, /<node_data name="nc_right_cytoplasm_nodes" file="febio_nc_right_cytoplasm_nodes\.csv" data="ux;uy;uz" delim="," node_set="nc_right_cytoplasm_nodes" \/>/);
  assert.match(xml, /<surface_load name="pipette_suction_pressure" surface="pipette_suction_surface" type="pressure">/);
  assert.doesNotMatch(xml, /<contact name="pipette_nucleus_contact"/);
});

test("native-only S8 NC failure comparison emits solver-active NC outputs", async () => {
  const native = await loadNativeModule();
  const comparison = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_nucleus_nc_failure_compare.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(comparison);

  assert.equal(comparison.caseName, "S8_pipette_nucleus_nc_failure_compare");
  assert.equal(comparison.effectiveNativeSpec.outputNameTag, "S8-W");
  assert.equal(comparison.interfaces.nucleusCytoplasm.solverActive, true);
  assert.equal(comparison.interfaces.nucleusCytoplasm.type, "tied-elastic");
  assert.match(comparison.interfaces.nucleusCytoplasm.status, /solver-active NC comparison/);
  assert.equal(comparison.logOutputs.faceData.some((entry) => entry.name === "nucleus_cytoplasm_right_surface"), true);
  assert.equal(comparison.logOutputs.plotfileSurfaceData.some((entry) => entry.interfaceGroup === "localNc"), true);
  assert.match(xml, /<SurfacePair name="nucleus_cytoplasm_right_pair">/);
  assert.match(xml, /<contact name="nucleus_cytoplasm_right_interface" type="tied-elastic" surface_pair="nucleus_cytoplasm_right_pair">/);
  assert.match(xml, /<face_data name="nucleus_cytoplasm_right_surface" file="febio_interface_nc_right\.csv" data="contact gap;contact pressure" delim="," surface="nucleus_interface_right_surface" \/>/);
  assert.match(xml, /<var type="contact traction" surface="nucleus_interface_right_surface"\/>/);
  assert.match(xml, /<surface_load name="pipette_suction_pressure" surface="pipette_suction_surface" type="pressure">/);
  assert.doesNotMatch(xml, /<contact name="pipette_nucleus_contact"/);
});

test("native-only S8 separated NC comparison duplicates cytoplasm interface nodes", async () => {
  const native = await loadNativeModule();
  const separated = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_nucleus_nc_separated_failure.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(separated);

  assert.equal(separated.caseName, "S8_pipette_nucleus_nc_separated_failure");
  assert.equal(separated.effectiveNativeSpec.outputNameTag, "S8-X");
  assert.equal(separated.geometry.mesh.refinements.nucleusCytoplasmCoupling.mode, "separated-contact-native-comparison");
  assert.deepEqual(separated.interfaces.nucleusCytoplasm.contactRegions, ["left", "right"]);
  assert.deepEqual(separated.geometry.mesh.nodeSets.nc_right_nucleus_nodes, [46, 47, 50, 51]);
  assert.deepEqual(separated.geometry.mesh.nodeSets.nc_right_cytoplasm_nodes, [74, 75, 78, 79]);
  assert.deepEqual(separated.geometry.mesh.surfaces.cytoplasm_interface_right_surface[0].nodes, [74, 75, 79, 78]);
  assert.match(xml, /<NodeSet name="nc_right_cytoplasm_nodes">74,75,78,79<\/NodeSet>/);
  assert.match(xml, /<Surface name="cytoplasm_interface_right_surface">\n      <quad4 id="11">74,75,79,78<\/quad4>/);
  assert.match(xml, /<contact name="nucleus_cytoplasm_right_interface" type="tied-elastic" surface_pair="nucleus_cytoplasm_right_pair">/);
  assert.doesNotMatch(xml, /<contact name="nucleus_cytoplasm_top_interface"/);
  assert.doesNotMatch(xml, /<face_data name="nucleus_cytoplasm_top_surface"/);
});

test("native-only S10 local suction patch exports solver-facing patch diagnostics", async () => {
  const native = await loadNativeModule();
  const localPatch = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S10_local_suction_patch.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(localPatch);
  const pressure = localPatch.geometry.meshValidation.pressureDiagnostics;
  const patch = pressure.localSuctionPatch;

  assert.equal(localPatch.caseName, "S10_local_suction_patch");
  assert.equal(localPatch.effectiveNativeSpec.outputNameTag, "S10-A");
  assert.equal(localPatch.effectiveNativeSpec.geometry.meshMode, "s10-local-suction-patch");
  assert.equal(localPatch.effectiveNativeSpec.loads.suctionPressure.surface, "pipette_suction_patch");
  assert.equal(localPatch.geometry.mesh.refinements.localSuctionPatch.mode, "s10-local-suction-patch");
  assert.equal(localPatch.geometry.mesh.refinements.pipetteSuctionSurface.pressureSurface, "pipette_suction_patch");
  assert.equal(pressure.suctionSurface, "pipette_suction_patch");
  assert.equal(pressure.legacySuctionSurface, "pipette_suction_surface");
  assert.equal(pressure.suctionSurfaceMode, "local-nucleus-side-patch");
  assert.equal(pressure.couplingReadiness.ready, true);
  assert.equal(patch.surface, "pipette_suction_patch");
  assert.equal(patch.legacySurface, "pipette_suction_surface");
  assert.deepEqual(patch.nodeIds, [82, 83, 86, 87]);
  assert.deepEqual(patch.faceIds, [24]);
  assert.equal(patch.nodeCount, 4);
  assert.equal(patch.faceCount, 1);
  assert.equal(patch.normalAxis, "-x");
  assert.deepEqual(patch.centroid, [14, 0, 17]);
  assert.equal(patch.area, 6.5);
  assert.equal(patch.pressure, -0.7);
  assert.equal(patch.pressureResultant, 4.55);
  assert.deepEqual(localPatch.geometry.mesh.nodeSets.pipette_suction_patch_nodes, [82, 83, 86, 87]);
  assert.deepEqual(localPatch.geometry.mesh.nodeSets.pipette_suction_nodes, [82, 83, 86, 87]);
  assert.equal(localPatch.geometry.mesh.surfaces.pipette_suction_surface.length, 3);
  assert.equal(localPatch.geometry.mesh.surfaces.pipette_suction_patch.length, 1);
  assert.equal(localPatch.loads.pressure.find((entry) => entry.name === "pipette_suction_pressure").surface, "pipette_suction_patch");
  assert.equal(localPatch.logOutputs.nodeData.find((entry) => entry.name === "pipette_suction_patch_nodes").nodeSet, "pipette_suction_patch_nodes");
  assert.equal(localPatch.logOutputs.faceData.find((entry) => entry.name === "pipette_cell_contact_surface").surface, "pipette_suction_patch");
  assert.match(xml, /<Surface name="pipette_suction_patch">\n      <quad4 id="24">82,86,87,83<\/quad4>/);
  assert.match(xml, /<NodeSet name="pipette_suction_patch_nodes">82,83,86,87<\/NodeSet>/);
  assert.match(xml, /<surface_load name="pipette_suction_pressure" surface="pipette_suction_patch" type="pressure">/);
  assert.match(xml, /<node_data name="pipette_suction_patch_nodes" file="febio_pipette_suction_patch_nodes\.csv" data="ux;uy;uz" delim="," node_set="pipette_suction_patch_nodes" \/>/);
  assert.match(xml, /<face_data name="pipette_cell_contact_surface" file="febio_pipette_cell_contact\.csv" data="contact gap;contact pressure" delim="," surface="pipette_suction_patch" \/>/);
});

test("native-only S10 NC right refinement splits local contact region around suction patch", async () => {
  const native = await loadNativeModule();
  const refined = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S10_local_suction_patch_nc_right_refined.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(refined);
  const pressure = refined.geometry.meshValidation.pressureDiagnostics;

  assert.equal(refined.caseName, "S10_local_suction_patch_nc_right_refined");
  assert.equal(refined.effectiveNativeSpec.outputNameTag, "S10-B");
  assert.equal(refined.interfaces.nucleusCytoplasm.solverActive, true);
  assert.deepEqual(refined.interfaces.nucleusCytoplasm.contactRegions, ["left", "right"]);
  assert.equal(refined.geometry.mesh.refinements.localSuctionPatch.ncRightRefined, true);
  assert.equal(pressure.localSuctionPatch.surface, "pipette_suction_patch");
  assert.deepEqual(pressure.localSuctionPatch.faceIds, [24]);
  assert.deepEqual(refined.geometry.mesh.nodeSets.nc_left_nucleus_nodes, [45, 48, 49, 52, 81, 84, 85, 88]);
  assert.deepEqual(refined.geometry.mesh.nodeSets.nc_right_nucleus_nodes, [46, 47, 50, 51, 82, 83, 86, 87]);
  assert.deepEqual(refined.geometry.mesh.nodeSets.nc_right_cytoplasm_nodes, [74, 75, 78, 79, 89, 90, 91, 92]);
  assert.deepEqual(refined.geometry.mesh.surfaces.nucleus_interface_left_surface.map((facet) => facet.nodes), [
    [45, 81, 84, 48],
    [81, 85, 88, 84],
    [85, 49, 52, 88],
  ]);
  assert.deepEqual(refined.geometry.mesh.surfaces.nucleus_interface_right_surface.map((facet) => facet.nodes), [
    [46, 82, 83, 47],
    [82, 86, 87, 83],
    [86, 50, 51, 87],
  ]);
  assert.deepEqual(refined.geometry.mesh.surfaces.cytoplasm_interface_right_surface.map((facet) => facet.nodes), [
    [74, 75, 90, 89],
    [89, 90, 92, 91],
    [91, 92, 79, 78],
  ]);
  assert.deepEqual(refined.geometry.mesh.elementSets.cytoplasm, [1, 5, 6, 7, 10, 11, 12, 13, 16, 17]);
  assert.match(xml, /<Surface name="nucleus_interface_left_surface">\n      <quad4 id="28">45,81,84,48<\/quad4>\n      <quad4 id="29">81,85,88,84<\/quad4>\n      <quad4 id="30">85,49,52,88<\/quad4>/);
  assert.match(xml, /<Surface name="cytoplasm_interface_right_surface">\n      <quad4 id="11">74,75,90,89<\/quad4>\n      <quad4 id="26">89,90,92,91<\/quad4>\n      <quad4 id="27">91,92,79,78<\/quad4>/);
  assert.match(xml, /<NodeSet name="nc_left_nucleus_nodes">45,48,49,52,81,84,85,88<\/NodeSet>/);
  assert.match(xml, /<NodeSet name="nc_right_cytoplasm_nodes">74,75,78,79,89,90,91,92<\/NodeSet>/);
  assert.match(xml, /<contact name="nucleus_cytoplasm_right_interface" type="tied-elastic" surface_pair="nucleus_cytoplasm_right_pair">/);
  assert.match(xml, /<surface_load name="pipette_suction_pressure" surface="pipette_suction_patch" type="pressure">/);
  assert.doesNotMatch(xml, /<contact name="nucleus_cytoplasm_top_interface"/);
  assert.doesNotMatch(xml, /<contact name="nucleus_cytoplasm_bottom_interface"/);
});

test("native-only Gmsh baseline round-trips physical groups into the native mesh shape", async () => {
  const native = await loadNativeModule();
  const caseSpec = JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S10_local_suction_patch.native.json"), "utf8"));
  const nativeMesh = native.buildNativeMesh(caseSpec);
  const msh = native.serializeNativeMeshToGmshV2(nativeMesh);
  const parsed = native.parseGmshMshV2(msh);
  const gmshMesh = native.convertGmshMshToNativeMesh(parsed, nativeMesh);
  const validation = native.validateNativeMesh(gmshMesh);
  const geo = native.buildGmshBaselineGeo(nativeMesh, { mshPath: "native-baseline.msh" });

  assert.match(msh, /\$MeshFormat\n2\.2 0 8\n\$EndMeshFormat/);
  assert.match(msh, /2 \d+ "pipette_suction_patch"/);
  assert.match(msh, /2 \d+ "nucleus_interface_right_surface"/);
  assert.match(msh, /3 \d+ "nucleus"/);
  assert.match(geo, /Merge "native-baseline\.msh";/);
  assert.equal(gmshMesh.meshMode, "gmsh-baseline");
  assert.equal(gmshMesh.gmsh.nativeIdRecovery, "template-preserved-for-duplicate-coordinate-baseline");
  assert.equal(gmshMesh.nodes.length, nativeMesh.nodes.length);
  assert.equal(gmshMesh.elements.length, nativeMesh.elements.length);
  assert.deepEqual(gmshMesh.elementSets, nativeMesh.elementSets);
  assert.deepEqual(gmshMesh.surfaces.pipette_suction_patch, nativeMesh.surfaces.pipette_suction_patch);
  assert.deepEqual(gmshMesh.surfaces.nucleus_interface_right_surface, nativeMesh.surfaces.nucleus_interface_right_surface);
  assert.equal(validation.valid, true);
});

test("native-only opt-in Gmsh mesh mode keeps default path separate and exports FEBio XML", async () => {
  const native = await loadNativeModule();
  const caseSpec = JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S10_local_suction_patch.native.json"), "utf8"));
  const gmshSpec = JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S10_gmsh_baseline.native.json"), "utf8"));
  const model = native.buildNativeFebioModel(gmshSpec);
  const bundle = native.buildNativeFebioExport(gmshSpec, { outDir: "tmp" });

  assert.equal(caseSpec.geometry.meshMode, "s10-local-suction-patch");
  assert.equal(gmshSpec.caseName, "S10_gmsh_baseline");
  assert.equal(gmshSpec.outputNameTag, "S10-G");
  assert.equal(model.effectiveNativeSpec.geometry.meshMode, "s10-gmsh-baseline");
  assert.equal(model.geometry.mesh.meshMode, "gmsh-baseline");
  assert.equal(model.geometry.mesh.gmsh.format, "gmsh-msh-v2-ascii");
  assert.equal(model.geometry.meshValidation.valid, true);
  assert.equal(bundle.exportReady, true);
  assert.match(bundle.febXml, /<Surface name="pipette_suction_patch">/);
  assert.match(bundle.febXml, /<surface_load name="pipette_suction_pressure" surface="pipette_suction_patch" type="pressure">/);
});

test("native-only Gmsh NC-right refinement preserves separated contact surfaces", async () => {
  const native = await loadNativeModule();
  const baseline = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S10_local_suction_patch_nc_right_refined.native.json"), "utf8")),
  );
  const gmsh = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S10_gmsh_nc_right_refined.native.json"), "utf8")),
  );
  const xml = native.serializeNativeModelToFebioXml(gmsh);

  assert.equal(gmsh.caseName, "S10_gmsh_nc_right_refined");
  assert.equal(gmsh.effectiveNativeSpec.outputNameTag, "S10-H");
  assert.equal(gmsh.effectiveNativeSpec.geometry.meshMode, "s10-gmsh-baseline");
  assert.equal(gmsh.geometry.mesh.meshMode, "gmsh-baseline");
  assert.equal(gmsh.geometry.mesh.gmsh.nativeIdRecovery, "template-preserved-for-duplicate-coordinate-baseline");
  assert.equal(gmsh.geometry.meshValidation.valid, true);
  assert.deepEqual(gmsh.interfaces.nucleusCytoplasm.contactRegions, ["left", "right"]);
  assert.deepEqual(gmsh.geometry.mesh.surfaces.nucleus_interface_right_surface, baseline.geometry.mesh.surfaces.nucleus_interface_right_surface);
  assert.deepEqual(gmsh.geometry.mesh.surfaces.cytoplasm_interface_right_surface, baseline.geometry.mesh.surfaces.cytoplasm_interface_right_surface);
  assert.deepEqual(gmsh.geometry.mesh.surfaces.pipette_suction_patch, baseline.geometry.mesh.surfaces.pipette_suction_patch);
  assert.equal(gmsh.logOutputs.faceData.some((entry) => entry.name === "nucleus_cytoplasm_right_surface"), true);
  assert.equal(gmsh.logOutputs.faceData.some((entry) => entry.name === "nucleus_cytoplasm_top_surface"), false);
  assert.match(xml, /<Surface name="cytoplasm_interface_right_surface">\n      <quad4 id="11">74,75,90,89<\/quad4>\n      <quad4 id="26">89,90,92,91<\/quad4>\n      <quad4 id="27">91,92,79,78<\/quad4>/);
  assert.match(xml, /<contact name="nucleus_cytoplasm_right_interface" type="tied-elastic" surface_pair="nucleus_cytoplasm_right_pair">/);
  assert.match(xml, /<surface_load name="pipette_suction_pressure" surface="pipette_suction_patch" type="pressure">/);
});

test("native-only S10 pressure scan variants preserve refined local-patch geometry", async () => {
  const native = await loadNativeModule();
  const scanCases = [
    {
      file: "febio_cases/native/S10_local_suction_patch_nc_right_refined_pressure_1p0.native.json",
      caseName: "S10_local_suction_patch_nc_right_refined_pressure_1p0",
      tag: "S10-C",
      pressure: -1,
      resultant: 6.5,
    },
    {
      file: "febio_cases/native/S10_local_suction_patch_nc_right_refined_pressure_1p3.native.json",
      caseName: "S10_local_suction_patch_nc_right_refined_pressure_1p3",
      tag: "S10-D",
      pressure: -1.3,
      resultant: 8.45,
    },
    {
      file: "febio_cases/native/S10_local_suction_patch_nc_right_refined_pressure_1p55.native.json",
      caseName: "S10_local_suction_patch_nc_right_refined_pressure_1p55",
      tag: "S10-E",
      pressure: -1.55,
      resultant: 10.075,
    },
  ];

  for (const entry of scanCases) {
    const model = native.buildNativeFebioModel(JSON.parse(fs.readFileSync(path.resolve(entry.file), "utf8")));
    const xml = native.serializeNativeModelToFebioXml(model);
    const patch = model.geometry.meshValidation.pressureDiagnostics.localSuctionPatch;

    assert.equal(model.caseName, entry.caseName);
    assert.equal(model.effectiveNativeSpec.outputNameTag, entry.tag);
    assert.equal(model.effectiveNativeSpec.loads.suctionPressure.surface, "pipette_suction_patch");
    assert.equal(model.effectiveNativeSpec.loads.suctionPressure.value, entry.pressure);
    assert.equal(model.geometry.mesh.refinements.localSuctionPatch.ncRightRefined, true);
    assert.equal(patch.surface, "pipette_suction_patch");
    assert.equal(patch.area, 6.5);
    assert.equal(patch.pressure, entry.pressure);
    assert.ok(Math.abs(patch.pressureResultant - entry.resultant) < 1e-9);
    assert.deepEqual(patch.faceIds, [24]);
    assert.deepEqual(model.interfaces.nucleusCytoplasm.contactRegions, ["left", "right"]);
    assert.match(xml, /<Surface name="pipette_suction_patch">\n      <quad4 id="24">82,86,87,83<\/quad4>/);
    assert.match(xml, /<surface_load name="pipette_suction_pressure" surface="pipette_suction_patch" type="pressure">/);
    assert.match(xml, /<contact name="nucleus_cytoplasm_right_interface" type="tied-elastic" surface_pair="nucleus_cytoplasm_right_pair">/);
  }
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
  assert.equal(summary.gates.cellDishPressureActive, false);
  assert.equal(summary.gates.cellDishContactForceActive, true);
  assert.equal(summary.gates.cellDishTangentialForceActive, true);
  assert.equal(summary.gates.cellDishNormalSupportActive, false);
  assert.equal(summary.gates.cellDishPressureForceMismatch, true);
  assert.equal(summary.cellDishForce.pressureForceMismatch, true);
  assert.equal(summary.cellDishForce.normalForce, 2.5);
  assert.equal(summary.cellDishForce.tangentialForce, 25);
  assert.equal(summary.cellDishForce.normalToTangentialRatio, 0.1);
  assert.equal(summary.gates.cellDishGapControlled, false);
  assert.equal(summary.pipetteCell.maxAbsPressure, 0.14);
  assert.equal(summary.rigidPipette.reaction.Fx, 1.2);
  assert.equal(summary.pipetteInteraction.pressureActive, true);
  assert.equal(summary.pipetteInteraction.rigidReactionActive, true);
  assert.equal(summary.pipetteInteraction.plotfileForceActive, false);
  assert.equal(summary.gates.pipetteInteractionActive, true);
  assert.equal(summary.gates.pipetteCellPressureActive, true);
  assert.equal(summary.gates.pipetteRigidReactionActive, true);
  assert.equal(summary.gates.pipettePlotfileForceActive, false);
  assert.equal(summary.gates.nucleusCytoplasmMoved, true);
  assert.equal(summary.gates.plotfileContactForceActive, true);
  assert.equal(summary.plotfileContactForce.stateCount, 2);
  assert.equal(summary.plotfileContactForce.maxAbs.x, 25);
  assert.equal(summary.plotfileContactForce.maxAbs.z, 2.5);
  assert.equal(summary.plotfileContactForce.maxAbs.normal, 2.5);
  assert.equal(summary.plotfileContactForce.maxAbs.tangential, 25);
  assert.equal(summary.plotfileContactForce.componentBasis.normalAxis, "z");
  assert.equal(summary.plotfileContactForce.zToXRatio, 0.1);
  assert.equal(summary.plotfileContactForce.normalToTangentialRatio, 0.1);
  assert.equal(summary.plotfileContactForce.surfaceByItemId["1"], "cell_dish_surface");
  assert.equal(summary.plotfileContactForce.surfaceSummaries.cell_dish_surface.hasContactForce, true);
  assert.equal(summary.plotfileContactForce.surfaceSummaries.cell_dish_surface.maxAbs.tangential, 25);
  assert.equal(summary.plotfileContactForce.finalState.rows[0].surface, "cell_dish_surface");
  assert.equal(summary.plotfileContactForce.finalState.rows[0].normalComponent, 2.5);
  assert.equal(summary.plotfileContactForce.finalState.rows[0].tangentialMagnitude, 25);
});

test("native run diagnostics count FEBio warning blocks separately from platform notices", async () => {
  const native = await loadNativeModule();
  const summary = native.summarizeNativeFebioRunFiles({
    log: [
      "Intel MKL WARNING: platform notice",
      " *************************************************************************",
      " *                               WARNING                                 *",
      " * Problem is diverging. Stiffness matrix will now be reformed           *",
      " *************************************************************************",
      " N O R M A L   T E R M I N A T I O N"
    ].join("\n")
  });

  assert.equal(summary.warnings.normalTermination, 1);
  assert.equal(summary.warnings.platformWarning, 1);
  assert.equal(summary.warnings.warning, 1);
  assert.equal(summary.gates.warningFree, false);
});

test("native run diagnostics split pipette plotfile force from pressure and rigid reaction", async () => {
  const native = await loadNativeModule();
  const block = (name, rows) => [
    "*Step  = 1",
    "*Time  = 5",
    `*Data  = ${name}`,
    ...rows
  ].join("\n");
  const summary = native.summarizeNativeFebioRunFiles({
    log: "N O R M A L   T E R M I N A T I O N\n",
    cellDish: block("cell_dish_interface_surface", ["1,0.03,0"]),
    pipetteCell: block("pipette_cell_contact_surface", ["1,0,0"]),
    pipetteContact: block("pipette_contact_surface", ["1,0,0"]),
    rigidPipette: block("pipette_rigid_body", ["4 16.5 0 16.15 0 0 0"]),
    nucleus: block("nucleus_nodes", ["45 -1 0 0"]),
    cytoplasm: block("cytoplasm_nodes", ["45,-1,0,0"]),
    xplt: buildMinimalXpltContactForce([
      { time: 0, rows: [{ itemId: 1, x: 0, y: 0, z: 0 }, { itemId: 3, x: 0, y: 0, z: 0 }] },
      { time: 5, rows: [{ itemId: 1, x: 0, y: 0, z: 0 }, { itemId: 3, x: -3, y: 0, z: 0 }] }
    ])
  });

  assert.equal(summary.gates.pipetteCellPressureActive, false);
  assert.equal(summary.gates.pipetteRigidReactionActive, false);
  assert.equal(summary.gates.pipetteSuctionPlotfileForceActive, true);
  assert.equal(summary.gates.pipettePlotfileForceActive, true);
  assert.equal(summary.gates.pipetteInteractionActive, true);
  assert.equal(summary.pipetteInteraction.maxPressure, 0);
  assert.equal(summary.pipetteInteraction.suctionPlotfileForce.maxAbs.x, 3);
  assert.equal(summary.pipetteInteraction.interpretation, "pipette interaction is active in at least one pressure, rigid-reaction, or plotfile-force channel");
});

test("native run diagnostics separate declared suction pressure resultant from contact outputs", async () => {
  const native = await loadNativeModule();
  const block = (name, rows) => [
    "*Step  = 1",
    "*Time  = 5",
    `*Data  = ${name}`,
    ...rows
  ].join("\n");
  const model = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_capture_hold_gentle.native.json"), "utf8")),
  );
  const summary = native.summarizeNativeFebioRunFiles({
    nativeModel: model,
    log: "N O R M A L   T E R M I N A T I O N",
    xplt: buildMinimalXpltContactForce([{ time: 0, rows: [{ itemId: 1, x: 0, y: 0, z: 0 }, { itemId: 2, x: 0, y: 0, z: 0 }, { itemId: 3, x: 0, y: 0, z: 0 }, { itemId: 4, x: 0, y: 0, z: 0 }] }]),
    cellDish: block("cell_dish_interface_surface", ["1,0,0"]),
    pipetteCell: block("pipette_cell_contact_surface", ["1,0,0"]),
    pipetteContact: block("pipette_contact_surface", ["1,0,0"]),
    rigidPipette: block("pipette_rigid_body", ["4 0 0 0 0 0 0"]),
    nucleus: block("nucleus_nodes", ["1 0 0 0"]),
    cytoplasm: block("cytoplasm_nodes", ["1 0 0 0"])
  });

  assert.equal(summary.pressureLoads.available, true);
  assert.equal(summary.pressureLoads.pipetteSuction.surface, "pipette_suction_surface");
  assert.equal(summary.pressureLoads.pipetteSuction.area, 18);
  assert.equal(summary.pressureLoads.pipetteSuction.resultant, 12.6);
  assert.equal(summary.pressureLoadResponse.pipetteSuction.observedNodeCount, 0);
  assert.equal(summary.gates.pipetteSuctionPressureResponseActive, false);
  assert.equal(summary.gates.pipetteSuctionPressureLoadActive, true);
  assert.equal(summary.gates.pipetteDirectContactOutputActive, false);
  assert.equal(summary.gates.pipetteCellPressureActive, false);
  assert.equal(summary.gates.pipettePlotfileForceActive, false);
  assert.equal(summary.gates.pipetteRigidReactionActive, false);
});

test("native run diagnostics recognize S10 local suction patch as suction pressure load", async () => {
  const native = await loadNativeModule();
  const block = (name, rows) => [
    "*Step  = 1",
    "*Time  = 5",
    `*Data  = ${name}`,
    ...rows
  ].join("\n");
  const model = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S10_local_suction_patch.native.json"), "utf8")),
  );
  const summary = native.summarizeNativeFebioRunFiles({
    nativeModel: model,
    log: "N O R M A L   T E R M I N A T I O N",
    pipetteSuctionPatchNodes: block("pipette_suction_patch_nodes", [
      "82 -0.2 0 0",
      "83 -0.2 0 0",
      "86 -0.3 0 0",
      "87 -0.3 0 0"
    ]),
  });

  assert.equal(summary.pressureLoads.pipetteSuction.surface, "pipette_suction_patch");
  assert.equal(summary.pressureLoads.pipetteSuction.area, 6.5);
  assert.equal(summary.pressureLoads.pipetteSuction.resultant, 4.55);
  assert.deepEqual(summary.pressureLoadResponse.pipetteSuction.nodeIds, [82, 83, 86, 87]);
  assert.deepEqual(summary.pressureLoadResponse.pipetteSuction.sources, ["pipetteSuctionPatch"]);
  assert.equal(summary.pressureLoadResponse.pipetteSuction.observedNodeCount, 4);
  assert.equal(summary.pressureLoadResponse.pipetteSuction.hasNormalDisplacement, true);
  assert.equal(summary.gates.pipetteSuctionPressureLoadActive, true);
  assert.equal(summary.gates.pipetteSuctionPressureResponseActive, true);
});

test("native run diagnostics instrument nucleus-side pressure-load surface displacement separately", async () => {
  const native = await loadNativeModule();
  const block = (name, rows) => [
    "*Step  = 1",
    "*Time  = 5",
    `*Data  = ${name}`,
    ...rows
  ].join("\n");
  const model = native.buildNativeFebioModel(
    JSON.parse(fs.readFileSync(path.resolve("febio_cases/native/S8_pipette_nucleus_pressure_return.native.json"), "utf8")),
  );
  const summary = native.summarizeNativeFebioRunFiles({
    nativeModel: model,
    log: "N O R M A L   T E R M I N A T I O N",
    xplt: buildMinimalXpltContactForce([{ time: 0, rows: [{ itemId: 1, x: 0, y: 0, z: 0 }, { itemId: 2, x: 0, y: 0, z: 0 }, { itemId: 3, x: 0, y: 0, z: 0 }, { itemId: 4, x: 0, y: 0, z: 0 }] }]),
    cellDish: block("cell_dish_interface_surface", ["1,0,0"]),
    pipetteCell: block("pipette_cell_contact_surface", ["1,0,0"]),
    pipetteContact: block("pipette_contact_surface", ["1,0,0"]),
    rigidPipette: block("pipette_rigid_body", ["4 0 0 0 0 0 0"]),
    nucleus: block("nucleus_nodes", ["37 0 0 0"]),
    pipetteSuctionNodes: block("pipette_suction_nodes", [
      "38 -3 0 0.5",
      "39 -3 0 0.5",
      "42 -2.5 0 -0.5",
      "43 -2.5 0 -0.5"
    ]),
    cytoplasm: block("cytoplasm_nodes", [
      "46 -1 0 0"
    ])
  });

  assert.equal(summary.pressureLoadResponse.available, true);
  assert.deepEqual(summary.pressureLoadResponse.pipetteSuction.nodeIds, [46, 47, 50, 51]);
  assert.equal(summary.pressureLoadResponse.pipetteSuction.observedNodeCount, 4);
  assert.deepEqual(summary.pressureLoadResponse.pipetteSuction.sources, ["pipetteSuction"]);
  assert.deepEqual(summary.pressureLoadResponse.pipetteSuction.rows.map((row) => row.rawId), [38, 39, 42, 43]);
  assert.deepEqual(summary.pressureLoadResponse.pipetteSuction.surfaceNormal, [-1, 0, 0]);
  assert.equal(summary.pressureLoadResponse.pipetteSuction.maxDisplacement, Math.hypot(3, 0, 0.5));
  assert.equal(summary.pressureLoadResponse.pipetteSuction.meanNormalDisplacement, 2.75);
  assert.equal(summary.gates.pipetteSuctionPressureLoadActive, true);
  assert.equal(summary.gates.pipetteSuctionPressureResponseActive, true);
  assert.equal(summary.gates.pipetteSuctionNormalDisplacementActive, true);
  assert.equal(summary.gates.pipetteDirectContactOutputActive, false);
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
