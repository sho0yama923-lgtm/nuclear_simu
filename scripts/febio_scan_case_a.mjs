import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_GRID = {
  xp: [3.5, 4.5],
  dz_lift: [8, 12],
  dx_inward: [4, 8],
  Fhold: [16, 24],
  Kn_nc: [0.5, 1.0],
  Kn_cd: [3.0, 5.0],
};

function parseArgs(argv) {
  const args = {
    outDir: "",
    mode: "full",
    limit: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if ((token === "--out-dir" || token === "-o") && next) {
      args.outDir = next;
      index += 1;
    } else if ((token === "--mode" || token === "-m") && next) {
      args.mode = next;
      index += 1;
    } else if (token === "--limit" && next) {
      args.limit = Number(next) || 0;
      index += 1;
    }
  }

  return args;
}

function cartesianProduct(entries) {
  return entries.reduce(
    (accumulator, [key, values]) =>
      accumulator.flatMap((partial) => values.map((value) => ({ ...partial, [key]: value }))),
    [{}],
  );
}

function buildGrid(mode) {
  if (mode === "quick") {
    return {
      xp: [4.5],
      dz_lift: [8, 12],
      dx_inward: [4, 8],
      Fhold: [16, 24],
      Kn_nc: [0.5, 1.0],
      Kn_cd: [3.0, 5.0],
    };
  }
  return DEFAULT_GRID;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: process.env,
    encoding: "utf8",
    stdio: options.stdio || "pipe",
  });

  if (result.status !== 0) {
    const error = new Error(`${command} exited with code ${result.status}`);
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    throw error;
  }

  return result;
}

function classifyScore(result) {
  const byClass = {
    nucleus_detached: 1000,
    deformation_only: 220,
    cell_attached_to_tip: -180,
    insufficient_hold: -260,
    early_slip: -340,
    missed_target: -400,
    no_capture_general: -240,
  };

  const ncLead = result.damage.nc - result.damage.cd;
  const displacementContrast = result.displacements.nucleus - result.displacements.cell;
  const firstNc = String(result.firstFailureSite || "").startsWith("nc:");
  const firstCd = String(result.firstFailureSite || "").startsWith("cd:");

  let score = byClass[result.classification] ?? 0;
  score += ncLead * 220;
  score += displacementContrast * 40;
  score += (result.captureMaintained ? 35 : -80);
  score += firstNc ? 70 : 0;
  score += firstCd ? -90 : 0;
  score += result.dominantMechanism === "local_shear" ? 25 : 0;
  score += result.dominantMechanism === "dish_detachment" ? -45 : 0;
  score += result.peaks.peakContactForce * 2.5;
  return Number(score.toFixed(3));
}

function pickFields(result, params, runId) {
  const score = classifyScore(result);
  return {
    runId,
    score,
    classification: result.classification,
    dominantMechanism: result.dominantMechanism,
    firstFailureSite: result.firstFailureSite,
    firstFailureMode: result.firstFailureMode,
    captureMaintained: Boolean(result.captureMaintained),
    damageNc: Number(result.damage.nc.toFixed(4)),
    damageCd: Number(result.damage.cd.toFixed(4)),
    damageMembrane: Number(result.damage.membrane.toFixed(4)),
    nucleusDisp: Number(result.displacements.nucleus.toFixed(4)),
    cellDisp: Number(result.displacements.cell.toFixed(4)),
    peakContactForce: Number((result.peaks.peakContactForce ?? result.peaks.peakHoldForce ?? 0).toFixed(4)),
    peakNcShear: Number((result.peaks.peakNcShear ?? 0).toFixed(4)),
    peakCdShear: Number((result.peaks.peakCdShear ?? 0).toFixed(4)),
    xp: params.xp,
    dz_lift: params.dz_lift,
    dx_inward: params.dx_inward,
    Fhold: params.Fhold,
    Kn_nc: params.Kn_nc,
    Kn_cd: params.Kn_cd,
  };
}

function toCsv(rows) {
  if (!rows.length) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const escapeValue = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escapeValue(row[header])).join(","))].join("\n");
}

const args = parseArgs(process.argv.slice(2));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const outDir = path.resolve(args.outDir || path.join(projectRoot, "generated", "febio_exports", "case_a_scan"));
const grid = buildGrid(args.mode);
const combinations = cartesianProduct(Object.entries(grid));
const selected = args.limit > 0 ? combinations.slice(0, args.limit) : combinations;

fs.mkdirSync(outDir, { recursive: true });

const summaryRows = [];
const failures = [];

console.log(`Running FEBio Case A scan with ${selected.length} combinations...`);

selected.forEach((overrides, index) => {
  const runId = `run_${String(index + 1).padStart(3, "0")}`;
  const caseDir = path.join(outDir, runId);
  fs.mkdirSync(caseDir, { recursive: true });
  const paramsPath = path.join(caseDir, "params.json");
  fs.writeFileSync(paramsPath, JSON.stringify(overrides, null, 2), "utf8");

  try {
    runCommand(
      "node",
      ["scripts/export_febio_case.mjs", "--case", "A", "--out-dir", caseDir, "--params", paramsPath],
      { cwd: projectRoot, stdio: "ignore" },
    );

    runCommand(
      "powershell",
      [
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "scripts/run_febio_case.ps1",
        "-FebFile",
        path.join(caseDir, "case_A.feb"),
        "-OutputDir",
        path.join(caseDir, "run"),
      ],
      { cwd: projectRoot, stdio: "ignore" },
    );

    const payload = JSON.parse(
      fs.readFileSync(path.join(caseDir, "run", "case_A_result.json"), "utf8"),
    );
    const normalized = payload.normalizedResult;
    const row = pickFields(normalized, { ...normalized.params, ...overrides }, runId);
    summaryRows.push(row);
    console.log(
      `[${index + 1}/${selected.length}] ${runId} -> ${row.classification} score=${row.score.toFixed(1)} xp=${row.xp} dz=${row.dz_lift} dx=${row.dx_inward} Fhold=${row.Fhold} Kn_nc=${row.Kn_nc} Kn_cd=${row.Kn_cd}`,
    );
  } catch (error) {
    failures.push({
      runId,
      overrides,
      message: error.message,
    });
    console.log(`[${index + 1}/${selected.length}] ${runId} -> FAILED`);
  }
});

summaryRows.sort((left, right) => right.score - left.score);

const bestByClass = Object.fromEntries(
  Object.entries(
    summaryRows.reduce((accumulator, row) => {
      accumulator[row.classification] ??= [];
      accumulator[row.classification].push(row);
      return accumulator;
    }, {}),
  ).map(([classification, rows]) => [classification, rows.slice().sort((a, b) => b.score - a.score)[0]]),
);

const summary = {
  generatedAt: new Date().toISOString(),
  caseName: "A",
  mode: args.mode,
  grid,
  combinationsTried: selected.length,
  successfulRuns: summaryRows.length,
  failedRuns: failures.length,
  topResults: summaryRows.slice(0, 10),
  bestByClassification: bestByClass,
  failures,
};

fs.writeFileSync(path.join(outDir, "scan_summary.json"), JSON.stringify(summary, null, 2), "utf8");
fs.writeFileSync(path.join(outDir, "scan_results.csv"), toCsv(summaryRows), "utf8");

console.log(`Summary written to ${path.join(outDir, "scan_summary.json")}`);
