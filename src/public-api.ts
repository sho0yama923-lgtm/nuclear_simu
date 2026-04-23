import {
  APP_SCHEMA_VERSION,
  CD_REGIONS,
  COORDINATE_SYSTEM_SPEC,
  DEFAULTS,
  FIELD_GROUPS,
  MEMBRANE_REGIONS,
  NC_REGIONS,
  buildSimulationInput,
} from "./model/index.ts";
import { buildFebioInputSpec, buildFebioRunBundle, buildFebioTemplateData, serializeFebioTemplateToXml } from "./febio/export/index.ts";
import { importFebioResult, normalizeExternalFebioPayload, normalizeFebioResult } from "./febio/import/normalizeFebioResult.ts";
import { applyRunClassification, assessDetachment, classifyRun, determineDominantMechanism } from "./results/classification.ts";

export {
  APP_SCHEMA_VERSION,
  CD_REGIONS,
  COORDINATE_SYSTEM_SPEC,
  DEFAULTS,
  FIELD_GROUPS,
  MEMBRANE_REGIONS,
  NC_REGIONS,
  buildSimulationInput,
  buildFebioInputSpec,
  buildFebioRunBundle,
  buildFebioTemplateData,
  serializeFebioTemplateToXml,
  importFebioResult,
  normalizeExternalFebioPayload,
  normalizeFebioResult,
  applyRunClassification,
  assessDetachment,
  classifyRun,
  determineDominantMechanism,
};

export function shouldRenderAsMainResult(result) {
  return Boolean(result && result.isPhysicalFebioResult === true);
}

export function describeDisplayedResult(result) {
  if (!result) {
    return {
      title: "awaiting FEBio result",
      short: "awaiting result",
      pillClass: "source-awaiting",
      detail: "export ready / awaiting FEBio result",
    };
  }

  const source = String(result?.solverMetadata?.source || "");
  if (result.isPhysicalFebioResult) {
    return {
      title: "FEBio result",
      short: "FEBio",
      pillClass: "source-febio",
      detail: source.includes("import") ? "imported external result" : "physical FEBio result",
    };
  }

  return {
    title: "awaiting FEBio result",
    short: "awaiting result",
    pillClass: "source-awaiting",
    detail: result?.solverMetadata?.note || "export ready / awaiting FEBio result",
  };
}

export function runSimulation(caseName, params = {}) {
  const inputSpec = buildSimulationInput(caseName, params);
  const febioInputSpec = buildFebioInputSpec(caseName, params, inputSpec);
  const bundle = buildFebioRunBundle(febioInputSpec);
  return normalizeFebioResult(
    {
      caseName,
      params: inputSpec.params,
      parameterDigest: inputSpec.parameterDigest,
      isPhysicalFebioResult: false,
      solverMetadata: {
        solverMode: "febio",
        source: "febio-export-ready",
        note: bundle.exportReady ? "awaiting FEBio result" : "export blocked by validation",
      },
      resultProvenance: {
        source: "febio-export-ready",
        parameterDigest: inputSpec.parameterDigest,
        exportTimestamp: bundle.exportTimestamp,
        importTimestamp: null,
        digestMatch: null,
      },
      exportReady: bundle.exportReady,
      validationReport: inputSpec.validationReport,
      meshValidation: febioInputSpec.febioTemplateData?.geometry?.meshValidation || null,
    },
    febioInputSpec,
  );
}
