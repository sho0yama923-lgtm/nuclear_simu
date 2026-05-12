import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = { caseFile: "", mshFile: "", outDir: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if ((token === "--case" || token === "-c") && next) {
      args.caseFile = next;
      index += 1;
    } else if ((token === "--msh" || token === "-m") && next) {
      args.mshFile = next;
      index += 1;
    } else if ((token === "--out-dir" || token === "-o") && next) {
      args.outDir = next;
      index += 1;
    }
  }
  return args;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
}

const args = parseArgs(process.argv.slice(2));
if (!args.caseFile) throw new Error("--case febio_cases/native/<case>.native.json is required");
if (!args.mshFile) throw new Error("--msh generated/.../<edited>.msh is required");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const nativeModulePath = path.join(projectRoot, "src", "febio", "native", "index.ts");
const nativeModule = await import(pathToFileURL(nativeModulePath).href);

const casePath = path.resolve(args.caseFile);
const mshPath = path.resolve(args.mshFile);
const caseSpec = readJsonFile(casePath);
const templateMesh = nativeModule.buildNativeMesh(caseSpec);
const parsed = nativeModule.parseGmshMshV2(fs.readFileSync(mshPath, "utf8"));
const gmshMesh = nativeModule.convertGmshMshToNativeMesh(parsed, templateMesh);
gmshMesh.meshMode = "gmsh-parametric-edited";
gmshMesh.gmsh = {
  ...(gmshMesh.gmsh || {}),
  sourceFile: mshPath,
  templateCase: caseSpec.caseName,
};
const meshValidation = nativeModule.validateNativeMesh(gmshMesh);

const outDir = path.resolve(args.outDir || path.join(projectRoot, "febio_exports", `${caseSpec.caseName}_gmsh_manual`));
const exportBundle = nativeModule.buildNativeFebioExport(caseSpec, { outDir, meshOverride: gmshMesh });
const baseName = exportBundle.baseName;

writeFile(path.join(outDir, `${baseName}.feb`), exportBundle.febXml);
writeFile(path.join(outDir, `${baseName}_effective_native_spec.json`), JSON.stringify(exportBundle.effectiveNativeSpec, null, 2));
writeFile(path.join(outDir, `${baseName}_native_model.json`), JSON.stringify(exportBundle.nativeModel, null, 2));
writeFile(path.join(outDir, `${baseName}_manifest.json`), JSON.stringify(exportBundle.manifest, null, 2));
writeFile(path.join(outDir, `${baseName}_README.txt`), exportBundle.readme);
writeFile(path.join(outDir, `${baseName}_gmsh_mesh_validation.json`), JSON.stringify(meshValidation, null, 2));

console.log(JSON.stringify({
  outDir,
  caseName: caseSpec.caseName,
  baseName,
  msh: mshPath,
  nodes: gmshMesh.nodes.length,
  elements: gmshMesh.elements.length,
  surfaces: Object.keys(gmshMesh.surfaces || {}).length,
  validationValid: meshValidation.valid,
  exportReady: exportBundle.exportReady,
}, null, 2));
