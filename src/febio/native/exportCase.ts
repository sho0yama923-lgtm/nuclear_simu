import { buildNativeFebioModel } from "./model.ts";
import { serializeNativeModelToFebioXml } from "./xml.ts";

function cleanCaseName(name) {
  return String(name || "native_case").replace(/[^A-Za-z0-9_.-]+/g, "_");
}

export function buildNativeFebioExport(caseSpec = {}, options = {}) {
  const model = buildNativeFebioModel(caseSpec);
  const febXml = serializeNativeModelToFebioXml(model);
  const baseName = cleanCaseName(model.caseName);
  const outDir = options.outDir || ".";
  const files = {
    feb: `${outDir}/${baseName}.feb`,
    effectiveNativeSpec: `${outDir}/${baseName}_effective_native_spec.json`,
    nativeModel: `${outDir}/${baseName}_native_model.json`,
    manifest: `${outDir}/${baseName}_manifest.json`,
    readme: `${outDir}/${baseName}_README.txt`,
    expectedLog: `${outDir}/${baseName}.log`,
    expectedXplt: `${outDir}/${baseName}.xplt`,
    expectedResultJson: `${outDir}/${baseName}_result.json`
  };
  const expectedCsv = (model.logOutputs?.faceData || []).map((entry) => `${outDir}/${entry.file}`);
  expectedCsv.push(`${outDir}/febio_rigid_pipette.csv`, `${outDir}/febio_nucleus_nodes.csv`, `${outDir}/febio_cytoplasm_nodes.csv`);
  const manifest = {
    caseName: model.caseName,
    generatedAt: options.generatedAt || new Date().toISOString(),
    parameterDigest: model.parameterDigest,
    exportReady: model.exportReady,
    solverMetadata: { solverMode: "febio", source: "febio-native-only" },
    files,
    expectedArtifacts: {
      logPath: files.expectedLog,
      xpltPath: files.expectedXplt,
      csvOutputPaths: expectedCsv,
      resultJsonPath: files.expectedResultJson
    },
    commands: {
      febioCli: `febio4 -i "${files.feb}"`,
      repositoryRunner: `powershell -ExecutionPolicy Bypass -File scripts/run_febio_case.ps1 -FebFile "${files.feb}"`
    },
    studioConfirmation: {
      febPath: files.feb,
      runDirectory: outDir,
      logPath: files.expectedLog,
      xpltPath: files.expectedXplt,
      resultPath: files.expectedResultJson,
      outputCsv: expectedCsv
    },
    validation: {
      nativeCase: model.validationReport,
      mesh: model.geometry.meshValidation,
      nucleusCytoplasm: model.interfaces.nucleusCytoplasm.validation
    },
    outputs: {
      aspiration: model.outputs.aspiration,
      faceData: model.outputs.faceData,
      plotfileSurfaceData: model.outputs.plotfileSurfaceData
    }
  };
  const readme = [
    `FEBio native-only handoff for ${manifest.caseName}`,
    "",
    `Parameter digest: ${manifest.parameterDigest}`,
    `Export ready: ${manifest.exportReady}`,
    "",
    "Run:",
    manifest.commands.repositoryRunner,
    "",
    "Artifacts:",
    `- feb: ${files.feb}`,
    `- effective native spec: ${files.effectiveNativeSpec}`,
    `- native model: ${files.nativeModel}`,
    `- manifest: ${files.manifest}`,
    `- expected log: ${files.expectedLog}`,
    `- expected xplt: ${files.expectedXplt}`,
    `- expected result JSON: ${files.expectedResultJson}`,
    `- expected CSV: ${expectedCsv.join(", ")}`,
    ""
  ].join("\n");

  return {
    caseName: model.caseName,
    baseName,
    parameterDigest: model.parameterDigest,
    effectiveNativeSpec: model.effectiveNativeSpec,
    nativeModel: model,
    febXml,
    manifest,
    readme,
    exportReady: model.exportReady
  };
}
