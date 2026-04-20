// -----------------------------------------------------------------------------
// legacy / deprecated compatibility module
// -----------------------------------------------------------------------------
// This file is intentionally not loaded by the default UI.
// It exists only for migration/debug workflows that still need the retired
// lightweight surrogate path.

(function attachLegacyModule(globalScope) {
  function runLegacySimulation(caseName, params) {
    const inputSpec = buildSimulationInput(caseName, params);
    const rawResult = runLightweightSimulation(caseName, params, inputSpec);
    rawResult.solverMetadata ??= buildSolverMetadata("lightweight", {
      source: "lightweight-js-surrogate",
      note: "deprecated legacy solver",
    });
    return normalizeSimulationResult(rawResult, inputSpec);
  }

  function describeDisplayedResultLegacy(result) {
    const solverInfo = describeSolverMetadata(result?.solverMetadata || {});
    return {
      title: "legacy/debug",
      short: "legacy",
      pillClass: "source-mock",
      detail: `deprecated debug-only result (${solverInfo.label || "unknown"})`,
    };
  }

  const api = {
    runLegacySimulation,
    describeDisplayedResultLegacy,
  };
  globalScope.__NUCLEAR_SIMU_LEGACY__ = api;
  if (typeof globalThis !== "undefined") {
    globalThis.__NUCLEAR_SIMU_LEGACY__ = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
