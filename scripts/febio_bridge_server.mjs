import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const args = {
    host: "127.0.0.1",
    port: 8765,
    outputRoot: "",
    febioExe: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if ((token === "--host" || token === "-h") && next) {
      args.host = next;
      index += 1;
    } else if ((token === "--port" || token === "-p") && next) {
      args.port = Number(next) || args.port;
      index += 1;
    } else if (token === "--output-root" && next) {
      args.outputRoot = next;
      index += 1;
    } else if (token === "--febio-exe" && next) {
      args.febioExe = next;
      index += 1;
    }
  }

  return args;
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(message);
}

const STATIC_CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function safeResolveStaticPath(projectRoot, requestPathname) {
  const pathname = decodeURIComponent(requestPathname || "/");
  if (pathname === "/" || pathname === "/app" || pathname === "/index.html") {
    return path.join(projectRoot, "index.html");
  }
  const relativePath = pathname.replace(/^\/+/, "");
  const resolved = path.resolve(projectRoot, relativePath);
  if (!resolved.startsWith(projectRoot)) {
    return null;
  }
  return resolved;
}

function sendStaticFile(res, filePath) {
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendJson(res, 404, { ok: false, error: "Static file not found" });
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = STATIC_CONTENT_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store, must-revalidate",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(fs.readFileSync(filePath));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${command} exited with code ${code}\n${stdout}${stderr ? `\n${stderr}` : ""}`.trim(),
          ),
        );
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function sanitizeCaseName(value) {
  const text = String(value || "A").trim().toUpperCase();
  return ["A", "B", "C"].includes(text) ? text : "A";
}

function buildCasePaths(outputRoot, caseName) {
  const baseName = `case_${caseName}`;
  const caseDir = path.join(outputRoot, baseName);
  const runDir = path.join(caseDir, "run");
  return {
    baseName,
    caseDir,
    runDir,
    febFile: path.join(caseDir, `${baseName}.feb`),
    inputJson: path.join(caseDir, `febio_${baseName}_input.json`),
    resultJson: path.join(runDir, `${baseName}_result.json`),
    paramsJson: path.join(caseDir, `${baseName}_bridge_params.json`),
  };
}

const args = parseArgs(process.argv.slice(2));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const outputRoot = path.resolve(args.outputRoot || path.join(projectRoot, "febio_exports", "ui_bridge"));
ensureDir(outputRoot);

const bridgeState = {
  busy: false,
  activeCase: null,
  latestByCase: {},
  lastError: "",
  outputRoot,
  startedAt: new Date().toISOString(),
};

async function runFebioCase(caseName, params) {
  const resolvedCase = sanitizeCaseName(caseName);
  const paths = buildCasePaths(outputRoot, resolvedCase);
  fs.rmSync(paths.caseDir, { recursive: true, force: true });
  ensureDir(paths.caseDir);
  ensureDir(paths.runDir);
  fs.writeFileSync(paths.paramsJson, JSON.stringify(params, null, 2), "utf8");

  await runCommand(process.execPath, [
    path.join(scriptDir, "export_febio_case.mjs"),
    "--case",
    resolvedCase,
    "--out-dir",
    paths.caseDir,
    "--params",
    paths.paramsJson,
  ], { cwd: projectRoot });

  const psArgs = [
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(scriptDir, "run_febio_case.ps1"),
    "-FebFile",
    paths.febFile,
    "-OutputDir",
    paths.runDir,
  ];
  if (args.febioExe) {
    psArgs.push("-FebioExe", args.febioExe);
  }

  await runCommand("powershell", psArgs, { cwd: projectRoot });

  const resultPayload = readJson(paths.resultJson);
  if (!resultPayload) {
    throw new Error(`Result JSON was not created: ${paths.resultJson}`);
  }
  bridgeState.latestByCase[resolvedCase] = {
    caseName: resolvedCase,
    paths,
    updatedAt: new Date().toISOString(),
  };
  return {
    caseName: resolvedCase,
    outputRoot,
    paths,
    resultPayload,
  };
}

function buildHealthPayload() {
  return {
    ok: true,
    busy: bridgeState.busy,
    activeCase: bridgeState.activeCase,
    startedAt: bridgeState.startedAt,
    outputRoot: bridgeState.outputRoot,
    latestByCase: bridgeState.latestByCase,
    lastError: bridgeState.lastError,
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || `${args.host}:${args.port}`}`);

    if (req.method === "OPTIONS") {
      sendText(res, 204, "");
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(res, 200, buildHealthPayload());
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/latest") {
      const caseName = sanitizeCaseName(requestUrl.searchParams.get("caseName") || "A");
      const paths = buildCasePaths(outputRoot, caseName);
      const resultPayload = readJson(paths.resultJson);
      if (!resultPayload) {
        sendJson(res, 404, {
          ok: false,
          error: `No FEBio result found for case ${caseName}`,
          caseName,
          outputRoot,
        });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        caseName,
        outputRoot,
        paths,
        resultPayload,
      });
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/run") {
      if (bridgeState.busy) {
        sendJson(res, 409, {
          ok: false,
          error: `Bridge is busy with case ${bridgeState.activeCase || "unknown"}`,
          ...buildHealthPayload(),
        });
        return;
      }
      const body = await readRequestBody(req);
      const caseName = sanitizeCaseName(body.caseName || "A");
      const params = body.params && typeof body.params === "object" ? body.params : {};

      bridgeState.busy = true;
      bridgeState.activeCase = caseName;
      bridgeState.lastError = "";
      try {
        const payload = await runFebioCase(caseName, params);
        bridgeState.busy = false;
        bridgeState.activeCase = null;
        sendJson(res, 200, { ok: true, ...payload });
      } catch (error) {
        bridgeState.busy = false;
        bridgeState.activeCase = null;
        bridgeState.lastError = error instanceof Error ? error.message : String(error);
        sendJson(res, 500, {
          ok: false,
          error: bridgeState.lastError,
          caseName,
          outputRoot,
        });
      }
      return;
    }

    if (req.method === "GET") {
      const staticPath = safeResolveStaticPath(projectRoot, requestUrl.pathname);
      if (staticPath) {
        sendStaticFile(res, staticPath);
        return;
      }
    }

    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(args.port, args.host, () => {
  console.log(
    JSON.stringify(
      {
        ok: true,
        host: args.host,
        port: args.port,
        outputRoot,
      },
      null,
      2,
    ),
  );
});
