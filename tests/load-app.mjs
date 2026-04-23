import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function loadApp() {
  const modulePath = path.resolve(process.cwd(), "generated", "dist", "public-api.js");
  if (!fs.existsSync(modulePath)) {
    throw new Error("generated/dist/public-api.js is missing. Run `node scripts/build-dist.mjs` first.");
  }
  return import(pathToFileURL(modulePath).href);
}
