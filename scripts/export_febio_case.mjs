import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

function writeFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
}

async function loadCanonicalPublicApi(projectRoot) {
  const sourceApiPath = path.join(projectRoot, "src", "public-api.ts");
  if (fs.existsSync(sourceApiPath)) {
    return import(pathToFileURL(sourceApiPath).href);
  }
  const publicApiPath = path.join(projectRoot, "generated", "dist", "public-api.js");
  if (fs.existsSync(publicApiPath)) {
    return import(pathToFileURL(publicApiPath).href);
  }
  throw new Error("Neither src/public-api.ts nor generated/dist/public-api.js was found. Cannot export FEBio cases.");
}

function readJsonFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

function buildCanonicalManifest(caseName, input, bundle, outDir) {
  const baseName = `case_${caseName}`;
  return {
    caseName,
    generatedAt: bundle.exportTimestamp,
    parameterDigest: bundle.parameterDigest,
    exportReady: bundle.exportReady,
    solverMetadata: bundle.solverMetadata,
    files: {
      feb: path.join(outDir, `${baseName}.feb`),
      inputJson: path.join(outDir, `febio_${baseName}_input.json`),
      manifest: path.join(outDir, `febio_${baseName}_manifest.json`),
      readme: path.join(outDir, `febio_${baseName}_README.txt`),
    },
    validation: bundle.validation,
    outputs: {
      expected: bundle.expectedOutputs,
      aspiration: input.febioTemplateData?.outputs?.aspiration || null,
      faceData: input.febioTemplateData?.outputs?.faceData || [],
      plotfileSurfaceData: input.febioTemplateData?.outputs?.plotfileSurfaceData || [],
    },
    stageS5: {
      purpose: "sticky cohesive solver validation",
      status: "exported-for-febio-run",
      checks: [
        "FEBio CLI readability",
        "sticky contact stability",
        "interface geometry sanity",
        "declared output availability",
      ],
    },
  };
}

function buildCanonicalReadme(manifest) {
  return [
    `FEBio handoff for case ${manifest.caseName}`,
    "",
    `Parameter digest: ${manifest.parameterDigest}`,
    `Export ready: ${manifest.exportReady}`,
    "",
    "Stage S5 checks:",
    ...manifest.stageS5.checks.map((check) => `- ${check}`),
    "",
    "Run:",
    `powershell -ExecutionPolicy Bypass -File scripts/run_febio_case.ps1 -FebFile "${manifest.files.feb}"`,
    "",
    "Expected output contract:",
    `- aspiration: ${manifest.outputs.aspiration?.payloadPath || "aspiration.length"}`,
    `- face data files: ${manifest.outputs.faceData.map((entry) => entry.file).join(", ")}`,
    `- plotfile surfaces: ${manifest.outputs.plotfileSurfaceData.map((entry) => entry.surface).join(", ")}`,
    "",
  ].join("\n");
}

const args = parseArgs(process.argv.slice(2));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const runtime = await loadCanonicalPublicApi(projectRoot);
const caseName = String(args.caseName || "C").toUpperCase();
const clone = runtime.structuredClone || globalThis.structuredClone || ((value) => JSON.parse(JSON.stringify(value)));
const defaults = clone(runtime.DEFAULTS);
const params = args.paramsFile
  ? { ...defaults, ...readJsonFile(path.resolve(args.paramsFile)) }
  : defaults;

const simulationInput = runtime.buildSimulationInput(caseName, params);
const input = runtime.buildFebioInputSpec(caseName, params, simulationInput);
const bundle = runtime.buildFebioRunBundle(input);

const outDir = path.resolve(args.outDir);
const baseName = `case_${caseName}`;
const xml = bundle.febXml;
const json = JSON.stringify(
  {
    caseName,
    params: input.params,
    parameterDigest: input.parameterDigest,
    canonicalSpec: bundle.canonicalSpec,
    templateData: bundle.templateData,
    exportBundle: bundle,
    generatedAt: bundle.exportTimestamp,
    source: "canonical-public-api",
  },
  null,
  2,
);
const manifest = buildCanonicalManifest(caseName, input, bundle, outDir);
const readmeText = buildCanonicalReadme(manifest);

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
