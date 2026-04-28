import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = { runDir: "", baseName: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if ((token === "--run-dir" || token === "-r") && next) {
      args.runDir = next;
      index += 1;
    } else if ((token === "--base-name" || token === "-b") && next) {
      args.baseName = next;
      index += 1;
    }
  }
  return args;
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

const args = parseArgs(process.argv.slice(2));
if (!args.runDir) throw new Error("--run-dir febio_exports/<case>/jobs is required");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const nativeModulePath = path.join(projectRoot, "src", "febio", "native", "index.ts");
const nativeModule = await import(pathToFileURL(nativeModulePath).href);
const runDir = path.resolve(args.runDir);
const febFiles = fs.readdirSync(runDir)
  .filter((file) => file.endsWith(".feb"))
  .map((file) => ({ file, mtimeMs: fs.statSync(path.join(runDir, file)).mtimeMs }))
  .sort((a, b) => {
    const tagged = Number(b.file.includes("S7-K_")) - Number(a.file.includes("S7-K_"));
    return tagged || b.mtimeMs - a.mtimeMs || a.file.localeCompare(b.file);
  });
const baseName = args.baseName || path.basename(febFiles[0]?.file || "S7_native_baseline.feb", ".feb");

const summary = nativeModule.summarizeNativeFebioRunFiles({
  log: readIfExists(path.join(runDir, `${baseName}.log`)),
  xplt: fs.existsSync(path.join(runDir, `${baseName}.xplt`)) ? fs.readFileSync(path.join(runDir, `${baseName}.xplt`)) : null,
  cellDish: readIfExists(path.join(runDir, "febio_interface_cell_dish.csv")),
  pipetteCell: readIfExists(path.join(runDir, "febio_pipette_cell_contact.csv")),
  pipetteContact: readIfExists(path.join(runDir, "febio_pipette_contact.csv")),
  rigidPipette: readIfExists(path.join(runDir, "febio_rigid_pipette.csv")),
  nucleus: readIfExists(path.join(runDir, "febio_nucleus_nodes.csv")),
  cytoplasm: readIfExists(path.join(runDir, "febio_cytoplasm_nodes.csv")),
});

console.log(JSON.stringify(summary, null, 2));
