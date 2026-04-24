import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {
    specFile: "",
    outDir: process.cwd(),
    mode: "handoff",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if ((token === "--spec" || token === "-s") && next) {
      args.specFile = next;
      index += 1;
    } else if ((token === "--out-dir" || token === "-o") && next) {
      args.outDir = next;
      index += 1;
    } else if ((token === "--mode" || token === "-m") && next) {
      args.mode = next;
      index += 1;
    }
  }

  return args;
}

function writeFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
}

async function loadDirectModules(projectRoot) {
  const sourceSpecPath = path.join(projectRoot, "src", "febio", "spec", "index.ts");
  const sourceExportPath = path.join(projectRoot, "src", "febio", "export", "index.ts");
  if (fs.existsSync(sourceSpecPath) && fs.existsSync(sourceExportPath)) {
    const [specModule, exportModule] = await Promise.all([
      import(pathToFileURL(sourceSpecPath).href),
      import(pathToFileURL(sourceExportPath).href),
    ]);
    return { specModule, exportModule };
  }

  const distSpecPath = path.join(projectRoot, "generated", "dist", "febio", "spec", "index.js");
  const distExportPath = path.join(projectRoot, "generated", "dist", "febio", "export", "index.js");
  if (fs.existsSync(distSpecPath) && fs.existsSync(distExportPath)) {
    const [specModule, exportModule] = await Promise.all([
      import(pathToFileURL(distSpecPath).href),
      import(pathToFileURL(distExportPath).href),
    ]);
    return { specModule, exportModule };
  }

  throw new Error("FEBio-native spec or export module was not found. Cannot export a direct FEBio case.");
}

function readJsonFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

function buildDirectManifest(input, bundle, outDir, baseName) {
  return {
    caseName: input.caseName,
    generatedAt: bundle.exportTimestamp,
    parameterDigest: bundle.parameterDigest,
    exportReady: bundle.exportReady,
    solverMetadata: bundle.solverMetadata,
    files: {
      feb: path.join(outDir, `${baseName}.feb`),
      nativeSpecJson: path.join(outDir, `febio_${baseName}_native_spec.json`),
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
    stageS7: {
      purpose: "FEBio-native direct parameter path and force-transfer validation",
      status: "exported-for-febio-native-direct-review",
      checks: [
        "FEBio Studio readability",
        "pressure load active in solver steps",
        "pipette contact pair declaration",
        "cell-dish contact pair declaration",
        "nonzero displacement/contact pressure/reaction force after FEBio run",
      ],
    },
    studioConfirmation: {
      febPath: path.join(outDir, `${baseName}.feb`),
      runDirectory: outDir,
      logPath: path.join(outDir, `${baseName}.log`),
      resultPath: path.join(outDir, `${baseName}_result.json`),
      outputCsv: [
        path.join(outDir, "febio_pipette_contact.csv"),
        path.join(outDir, "febio_rigid_pipette.csv"),
        path.join(outDir, "febio_interface_cell_dish.csv"),
      ],
    },
  };
}

function buildDirectReadme(manifest) {
  return [
    `FEBio-native direct handoff for ${manifest.caseName}`,
    "",
    `Parameter digest: ${manifest.parameterDigest}`,
    `Export ready: ${manifest.exportReady}`,
    "",
    "Stage S7 checks:",
    ...manifest.stageS7.checks.map((check) => `- ${check}`),
    "",
    "Run:",
    `powershell -ExecutionPolicy Bypass -File scripts/run_febio_case.ps1 -FebFile "${manifest.files.feb}"`,
    "",
    "Studio confirmation targets:",
    `- feb: ${manifest.studioConfirmation.febPath}`,
    `- log: ${manifest.studioConfirmation.logPath}`,
    `- result: ${manifest.studioConfirmation.resultPath}`,
    `- output CSV: ${manifest.studioConfirmation.outputCsv.join(", ")}`,
    "",
  ].join("\n");
}

const args = parseArgs(process.argv.slice(2));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const { specModule, exportModule } = await loadDirectModules(projectRoot);
const nativeSpec = args.specFile ? readJsonFile(path.resolve(args.specFile)) : specModule.createDefaultFebioNativeSpec();
const input = specModule.buildFebioNativeInputSpec(nativeSpec);
const bundle = specModule.buildFebioNativeRunBundle(input, exportModule.serializeFebioTemplateToXml);
const outDir = path.resolve(args.outDir);
const baseName = input.caseName.replace(/[^A-Za-z0-9_.-]+/g, "_");
const manifest = buildDirectManifest(input, bundle, outDir, baseName);

if (args.mode === "xml") {
  const xmlPath = path.join(outDir, `${baseName}.feb`);
  writeFile(xmlPath, bundle.febXml);
  console.log(xmlPath);
} else {
  writeFile(path.join(outDir, `${baseName}.feb`), bundle.febXml);
  writeFile(path.join(outDir, `febio_${baseName}_native_spec.json`), JSON.stringify(input.nativeSpec, null, 2));
  writeFile(
    path.join(outDir, `febio_${baseName}_input.json`),
    JSON.stringify(
      {
        caseName: input.caseName,
        nativeSpec: input.nativeSpec,
        parameterDigest: input.parameterDigest,
        templateData: bundle.templateData,
        exportBundle: bundle,
        generatedAt: bundle.exportTimestamp,
        source: "febio-native-direct",
      },
      null,
      2,
    ),
  );
  writeFile(path.join(outDir, `febio_${baseName}_manifest.json`), JSON.stringify(manifest, null, 2));
  writeFile(path.join(outDir, `febio_${baseName}_README.txt`), buildDirectReadme(manifest));
  console.log(outDir);
}
