import * as publicApi from "../public-api.js";

async function loadLegacyScript(relativePath) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL(relativePath, import.meta.url).toString();
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`failed to load ${relativePath}`));
    document.body.appendChild(script);
  });
}

async function bootLegacyUi() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  window.__NUCLEAR_SIMU_PUBLIC_API__ = publicApi;
  await loadLegacyScript("../../simulation.js?v=20260422");
  await loadLegacyScript("../../js/simulation-febio.js?v=20260422");
  await loadLegacyScript("../../js/simulation-ui.js?v=20260422");
}

bootLegacyUi().catch((error) => {
  console.error(error);
});
