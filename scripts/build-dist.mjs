import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(projectRoot, "src");
const distRoot = path.join(projectRoot, "dist");

async function walk(current) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(target)));
    } else {
      files.push(target);
    }
  }
  return files;
}

function rewriteImports(sourceText) {
  return sourceText.replace(/from "([^"]+)\.ts"/g, 'from "$1.js"').replace(/from '([^']+)\.ts'/g, "from '$1.js'");
}

async function build() {
  await fs.rm(distRoot, { recursive: true, force: true });
  await fs.mkdir(distRoot, { recursive: true });
  const files = await walk(srcRoot);
  for (const file of files) {
    const relative = path.relative(srcRoot, file);
    const outputPath = path.join(distRoot, relative).replace(/\.ts$/g, ".js");
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });
    const content = await fs.readFile(file, "utf8");
    await fs.writeFile(outputPath, rewriteImports(content), "utf8");
  }
}

await build();
