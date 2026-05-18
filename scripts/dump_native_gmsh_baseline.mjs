import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function removeFileIfExists(filePath) {
  if (fs.existsSync(filePath)) fs.rmSync(filePath);
}

function parseArgs(argv) {
  const args = {
    casePath: "febio_cases/native/S10_local_suction_patch.native.json",
    outDir: "generated/gmsh_current",
    gmsh: process.env.GMSH || "gmsh",
    runGmsh: false,
    legacyArtifacts: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--case") args.casePath = argv[++i];
    else if (arg === "--out-dir") args.outDir = argv[++i];
    else if (arg === "--gmsh") args.gmsh = argv[++i];
    else if (arg === "--run-gmsh") args.runGmsh = true;
    else if (arg === "--legacy-artifacts") args.legacyArtifacts = true;
  }
  return args;
}

async function loadNativeModule() {
  const distPath = path.resolve("generated/dist/febio/native/index.js");
  const sourcePath = path.resolve("src/febio/native/index.ts");
  const modulePath = fs.existsSync(sourcePath) ? sourcePath : distPath;
  return import(pathToFileURL(modulePath).href);
}

const args = parseArgs(process.argv.slice(2));
const native = await loadNativeModule();
const caseSpec = readJson(path.resolve(args.casePath));
const mesh = native.buildNativeMesh(caseSpec);
const msh = native.serializeNativeMeshToGmshV2(mesh);
const geo = native.buildGmshBaselineGeo(mesh, { mshPath: "mesh.seed.msh" });
const editableGeo = args.legacyArtifacts ? native.buildEditableGmshBlockGeo(mesh) : "";
const parametricGeo = native.buildParametricEditableGmshBlockGeo(mesh, caseSpec.geometry?.gmshPythonApi || {});
const pythonApiScript = native.buildGmshPythonApiBlockScript(mesh, {
  ...(caseSpec.geometry?.gmshPythonApi || {}),
  outputMshPath: "mesh.msh",
});
const parsed = native.parseGmshMshV2(msh);
const roundTrip = native.convertGmshMshToNativeMesh(parsed, mesh);
const validation = native.validateNativeMesh(roundTrip);
const outDir = path.resolve(args.outDir);

if (!args.legacyArtifacts) {
  [
    "native-baseline.mesh.json",
    "native-baseline.geo",
    "native-editable-block.geo",
    "native-parametric-block.geo",
    "native-python-api-block.py",
    "native-baseline.msh",
    "native-baseline.gmsh.msh",
    "native-baseline.roundtrip.mesh.json",
    "native-baseline.validation.json",
    "native-baseline.gmsh-result.json",
    "native-editable-block.gmsh.msh",
    "native-editable-block.roundtrip.mesh.json",
    "native-editable-block.validation.json",
    "native-editable-block.gmsh-result.json",
    "native-parametric-block.gmsh.msh",
    "native-parametric-block.roundtrip.mesh.json",
    "native-parametric-block.validation.json",
    "native-parametric-block.gmsh-result.json",
  ].forEach((fileName) => removeFileIfExists(path.join(outDir, fileName)));
}

writeFile(path.join(outDir, "mesh.source.json"), JSON.stringify(mesh, null, 2));
writeFile(path.join(outDir, "mesh.geo"), parametricGeo);
writeFile(path.join(outDir, "mesh.py"), pythonApiScript);
writeFile(path.join(outDir, "mesh.seed.msh"), msh);
writeFile(path.join(outDir, "mesh.seed.roundtrip.json"), JSON.stringify(roundTrip, null, 2));
writeFile(path.join(outDir, "mesh.seed.validation.json"), JSON.stringify(validation, null, 2));

if (args.legacyArtifacts) {
  writeFile(path.join(outDir, "native-baseline.mesh.json"), JSON.stringify(mesh, null, 2));
  writeFile(path.join(outDir, "native-baseline.geo"), geo);
  writeFile(path.join(outDir, "native-editable-block.geo"), editableGeo);
  writeFile(path.join(outDir, "native-parametric-block.geo"), parametricGeo);
  writeFile(path.join(outDir, "native-python-api-block.py"), pythonApiScript);
  writeFile(path.join(outDir, "native-baseline.msh"), msh);
  writeFile(path.join(outDir, "native-baseline.roundtrip.mesh.json"), JSON.stringify(roundTrip, null, 2));
  writeFile(path.join(outDir, "native-baseline.validation.json"), JSON.stringify(validation, null, 2));
}

let gmshResult = { requested: args.runGmsh, skipped: !args.runGmsh };
if (args.runGmsh) {
  try {
    const stdout = execFileSync(args.gmsh, [
      "-3",
      "-format",
      "msh2",
      path.join(outDir, "mesh.geo"),
      "-o",
      path.join(outDir, "mesh.msh"),
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const parsedMesh = native.parseGmshMshV2(fs.readFileSync(path.join(outDir, "mesh.msh"), "utf8"));
    const currentMesh = native.convertGmshMshToNativeMesh(parsedMesh, mesh);
    const currentValidation = native.validateNativeMesh(currentMesh);
    writeFile(path.join(outDir, "mesh.roundtrip.json"), JSON.stringify(currentMesh, null, 2));
    writeFile(path.join(outDir, "mesh.validation.json"), JSON.stringify(currentValidation, null, 2));
    gmshResult = { requested: true, exitCode: 0, stdout };
  } catch (error) {
    gmshResult = {
      requested: true,
      exitCode: error.status ?? 1,
      stdout: error.stdout?.toString() || "",
      stderr: error.stderr?.toString() || error.message,
    };
  }
  writeFile(path.join(outDir, "mesh.gmsh-result.json"), JSON.stringify(gmshResult, null, 2));

  if (!args.legacyArtifacts) {
    console.log(JSON.stringify({
      outDir,
      caseName: caseSpec.caseName,
      nodes: mesh.nodes.length,
      elements: mesh.elements.length,
      surfaces: Object.keys(mesh.surfaces || {}).length,
      validationValid: validation.valid,
      gmsh: gmshResult,
    }, null, 2));
    process.exit(0);
  }

  writeFile(path.join(outDir, "native-baseline.gmsh-result.json"), JSON.stringify(gmshResult, null, 2));

  let editableGmshResult;
  try {
    const stdout = execFileSync(args.gmsh, [
      "-3",
      "-format",
      "msh2",
      path.join(outDir, "native-editable-block.geo"),
      "-o",
      path.join(outDir, "native-editable-block.gmsh.msh"),
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const editableParsed = native.parseGmshMshV2(fs.readFileSync(path.join(outDir, "native-editable-block.gmsh.msh"), "utf8"));
    const editableMesh = native.convertGmshMshToNativeMesh(editableParsed, mesh);
    const editableValidation = native.validateNativeMesh(editableMesh);
    writeFile(path.join(outDir, "native-editable-block.roundtrip.mesh.json"), JSON.stringify(editableMesh, null, 2));
    writeFile(path.join(outDir, "native-editable-block.validation.json"), JSON.stringify(editableValidation, null, 2));
    editableGmshResult = {
      requested: true,
      exitCode: 0,
      stdout,
      parsedNodeCount: editableParsed.nodes.length,
      parsedElementCount: editableParsed.elements.length,
      validationValid: editableValidation.valid,
    };
  } catch (error) {
    editableGmshResult = {
      requested: true,
      exitCode: error.status ?? 1,
      stdout: error.stdout?.toString() || "",
      stderr: error.stderr?.toString() || error.message,
    };
  }
  writeFile(path.join(outDir, "native-editable-block.gmsh-result.json"), JSON.stringify(editableGmshResult, null, 2));

  let parametricGmshResult;
  try {
    const stdout = execFileSync(args.gmsh, [
      "-3",
      "-format",
      "msh2",
      path.join(outDir, "native-parametric-block.geo"),
      "-o",
      path.join(outDir, "native-parametric-block.gmsh.msh"),
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const parametricParsed = native.parseGmshMshV2(fs.readFileSync(path.join(outDir, "native-parametric-block.gmsh.msh"), "utf8"));
    const parametricMesh = native.convertGmshMshToNativeMesh(parametricParsed, mesh);
    const parametricValidation = native.validateNativeMesh(parametricMesh);
    writeFile(path.join(outDir, "native-parametric-block.roundtrip.mesh.json"), JSON.stringify(parametricMesh, null, 2));
    writeFile(path.join(outDir, "native-parametric-block.validation.json"), JSON.stringify(parametricValidation, null, 2));
    parametricGmshResult = {
      requested: true,
      exitCode: 0,
      stdout,
      parsedNodeCount: parametricParsed.nodes.length,
      parsedElementCount: parametricParsed.elements.length,
      validationValid: parametricValidation.valid,
    };
  } catch (error) {
    parametricGmshResult = {
      requested: true,
      exitCode: error.status ?? 1,
      stdout: error.stdout?.toString() || "",
      stderr: error.stderr?.toString() || error.message,
    };
  }
  writeFile(path.join(outDir, "native-parametric-block.gmsh-result.json"), JSON.stringify(parametricGmshResult, null, 2));

}

console.log(JSON.stringify({
  outDir,
  caseName: caseSpec.caseName,
  nodes: mesh.nodes.length,
  elements: mesh.elements.length,
  surfaces: Object.keys(mesh.surfaces || {}).length,
  validationValid: validation.valid,
  gmsh: gmshResult,
}, null, 2));
