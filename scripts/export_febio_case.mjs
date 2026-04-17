import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const args = {
    caseName: "C",
    outDir: process.cwd(),
    mode: "handoff",
    paramsFile: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if ((token === "--case" || token === "-c") && next) {
      args.caseName = next;
      index += 1;
    } else if ((token === "--out-dir" || token === "-o") && next) {
      args.outDir = next;
      index += 1;
    } else if ((token === "--mode" || token === "-m") && next) {
      args.mode = next;
      index += 1;
    } else if (token === "--params" && next) {
      args.paramsFile = next;
      index += 1;
    }
  }

  return args;
}

function createElementStub() {
  return {
    value: "",
    innerHTML: "",
    textContent: "",
    width: 0,
    height: 0,
    className: "",
    files: [],
    style: {},
    parentNode: { insertAdjacentElement() {} },
    appendChild() {},
    insertAdjacentElement() {},
    remove() {},
    closest() {
      return {
        querySelector() {
          return { replaceChildren() {} };
        },
        parentNode: { insertBefore() {} },
        classList: { add() {} },
      };
    },
    querySelector() {
      return null;
    },
    addEventListener() {},
    getContext() {
      return {};
    },
    click() {},
  };
}

function loadSimulationModule(projectRoot) {
  let source = fs.readFileSync(path.join(projectRoot, "simulation.js"), "utf8");
  source = source.replace(/\ninitialize\(\);\s*$/, "\n");
  const documentStub = {
    querySelector() {
      return createElementStub();
    },
    createElement() {
      return createElementStub();
    },
  };

  const sandbox = {
    console,
    document: documentStub,
    window: { document: documentStub },
    Blob: function Blob(parts, opts) {
      this.parts = parts;
      this.opts = opts;
    },
    URL: {
      createObjectURL() {
        return "blob:mock";
      },
      revokeObjectURL() {},
    },
    structuredClone: globalThis.structuredClone,
    setTimeout,
    clearTimeout,
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {},
    performance: { now() { return 0; } },
    FileReader: function FileReader() {},
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "simulation.js" });
  return sandbox;
}

function writeFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
}

const args = parseArgs(process.argv.slice(2));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const sandbox = loadSimulationModule(projectRoot);
const caseName = String(args.caseName || "C").toUpperCase();
const defaults = sandbox.structuredClone(sandbox.DEFAULTS);
const params = args.paramsFile
  ? { ...defaults, ...JSON.parse(fs.readFileSync(path.resolve(args.paramsFile), "utf8")) }
  : defaults;

const input = sandbox.buildFebioInputSpec(
  caseName,
  params,
  sandbox.buildSimulationInput(caseName, params),
);

const outDir = path.resolve(args.outDir);
const baseName = `case_${caseName}`;
const xml = sandbox.exportFebioXmlContent(input);
const json = sandbox.exportFebioJson(input);
const manifest = sandbox.buildFebioHandoffManifest(input);
const readmeText = sandbox.buildFebioHandoffReadme(manifest);

if (args.mode === "xml") {
  const xmlPath = path.join(outDir, `${baseName}.feb`);
  writeFile(xmlPath, xml);
  console.log(xmlPath);
} else {
  writeFile(path.join(outDir, `${baseName}.feb`), xml);
  writeFile(path.join(outDir, `febio_${baseName}_input.json`), json);
  writeFile(path.join(outDir, `febio_${baseName}_manifest.json`), JSON.stringify(manifest, null, 2));
  writeFile(path.join(outDir, `febio_${baseName}_README.txt`), readmeText);
  console.log(outDir);
}
