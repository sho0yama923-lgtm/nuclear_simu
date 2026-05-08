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

function parseArgs(argv) {
  const args = {
    casePath: "febio_cases/native/S10_local_suction_patch.native.json",
    outDir: "generated/gmsh_baseline",
    gmsh: process.env.GMSH || "gmsh",
    runGmsh: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--case") args.casePath = argv[++i];
    else if (arg === "--out-dir") args.outDir = argv[++i];
    else if (arg === "--gmsh") args.gmsh = argv[++i];
    else if (arg === "--run-gmsh") args.runGmsh = true;
  }
  return args;
}

async function loadNativeModule() {
  const distPath = path.resolve("generated/dist/febio/native/index.js");
  const sourcePath = path.resolve("src/febio/native/index.ts");
  const modulePath = fs.existsSync(distPath) ? distPath : sourcePath;
  return import(pathToFileURL(modulePath).href);
}

const args = parseArgs(process.argv.slice(2));
const native = await loadNativeModule();
const caseSpec = readJson(path.resolve(args.casePath));
const mesh = native.buildNativeMesh(caseSpec);
const msh = native.serializeNativeMeshToGmshV2(mesh);
const geo = native.buildGmshBaselineGeo(mesh, { mshPath: "native-baseline.msh" });
const parsed = native.parseGmshMshV2(msh);
const roundTrip = native.convertGmshMshToNativeMesh(parsed, mesh);
const validation = native.validateNativeMesh(roundTrip);
const outDir = path.resolve(args.outDir);

writeFile(path.join(outDir, "native-baseline.mesh.json"), JSON.stringify(mesh, null, 2));
writeFile(path.join(outDir, "native-baseline.geo"), geo);
writeFile(path.join(outDir, "native-baseline.msh"), msh);
writeFile(path.join(outDir, "native-baseline.roundtrip.mesh.json"), JSON.stringify(roundTrip, null, 2));
writeFile(path.join(outDir, "native-baseline.validation.json"), JSON.stringify(validation, null, 2));

let gmshResult = { requested: args.runGmsh, skipped: !args.runGmsh };
if (args.runGmsh) {
  try {
    const stdout = execFileSync(args.gmsh, [
      "-3",
      "-format",
      "msh2",
      path.join(outDir, "native-baseline.geo"),
      "-o",
      path.join(outDir, "native-baseline.gmsh.msh"),
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    gmshResult = { requested: true, exitCode: 0, stdout };
  } catch (error) {
    gmshResult = {
      requested: true,
      exitCode: error.status ?? 1,
      stdout: error.stdout?.toString() || "",
      stderr: error.stderr?.toString() || error.message,
    };
  }
  writeFile(path.join(outDir, "native-baseline.gmsh-result.json"), JSON.stringify(gmshResult, null, 2));
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
