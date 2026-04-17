import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const args = {
    runDir: "",
    inputJson: "",
    outFile: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if ((token === "--run-dir" || token === "-r") && next) {
      args.runDir = next;
      index += 1;
    } else if ((token === "--input-json" || token === "-i") && next) {
      args.inputJson = next;
      index += 1;
    } else if ((token === "--out-file" || token === "-o") && next) {
      args.outFile = next;
      index += 1;
    }
  }

  if (!args.runDir || !args.inputJson) {
    throw new Error("Usage: node scripts/convert_febio_output.mjs --run-dir <dir> --input-json <file> [--out-file <file>]");
  }

  return args;
}

function createElementStub() {
  return {
    value: "",
    innerHTML: "",
    textContent: "",
    width: 0,
    height: 0,
    className: "",
    files: [],
    style: {},
    parentNode: { insertAdjacentElement() {} },
    appendChild() {},
    insertAdjacentElement() {},
    remove() {},
    closest() {
      return {
        querySelector() {
          return { replaceChildren() {} };
        },
        parentNode: { insertBefore() {} },
        classList: { add() {} },
      };
    },
    querySelector() {
      return null;
    },
    addEventListener() {},
    getContext() {
      return {};
    },
    click() {},
  };
}

function loadSimulationModule(projectRoot) {
  const source = [
    fs.readFileSync(path.join(projectRoot, "simulation.js"), "utf8"),
    fs.readFileSync(path.join(projectRoot, "js", "simulation-febio.js"), "utf8"),
  ].join("\n");
  const documentStub = {
    querySelector() {
      return createElementStub();
    },
    createElement() {
      return createElementStub();
    },
  };

  const sandbox = {
    console,
    document: documentStub,
    window: { document: documentStub },
    Blob: function Blob(parts, opts) {
      this.parts = parts;
      this.opts = opts;
    },
    URL: {
      createObjectURL() {
        return "blob:mock";
      },
      revokeObjectURL() {},
    },
    structuredClone: globalThis.structuredClone,
    setTimeout,
    clearTimeout,
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {},
    performance: { now() { return 0; } },
    FileReader: function FileReader() {},
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "simulation.js" });
  return sandbox;
}

function parseLogDataFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const snapshots = [];
  let current = null;
  let timeFallback = 0;

  const flush = () => {
    if (current && current.records.length) {
      snapshots.push(current);
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const timeMatch = line.match(/(?:\*?\s*Time\s*=)\s*([-+0-9.eE]+)/i);
    if (timeMatch) {
      flush();
      current = { time: Number(timeMatch[1]), records: [] };
      continue;
    }

    if (/^Data Record/i.test(line) || /^\*/.test(line) || /^=/i.test(line)) {
      continue;
    }

    const fields = line.split(/[,\s]+/).filter(Boolean);
    if (fields.length >= 2 && /^[-+0-9.eE]+$/.test(fields[0])) {
      if (!current) {
        current = { time: timeFallback, records: [] };
      }
      current.records.push(fields.map(Number));
      continue;
    }

    if (/^End/i.test(line)) {
      flush();
      timeFallback += 1;
    }
  }

  flush();
  return snapshots;
}

function averageRecordColumns(snapshot) {
  if (!snapshot || !snapshot.records.length) {
    return [];
  }
  const width = snapshot.records[0].length - 1;
  const sums = new Array(width).fill(0);
  snapshot.records.forEach((record) => {
    for (let index = 0; index < width; index += 1) {
      sums[index] += Number(record[index + 1] || 0);
    }
  });
  return sums.map((value) => value / snapshot.records.length);
}

function maxAbsColumn(snapshot, columnIndex) {
  if (!snapshot || !snapshot.records.length) {
    return 0;
  }
  return snapshot.records.reduce(
    (maxValue, record) => Math.max(maxValue, Math.abs(Number(record[columnIndex + 1] || 0))),
    0,
  );
}

function nearestSnapshot(series, time) {
  if (!series.length) {
    return null;
  }
  let best = series[0];
  let bestDistance = Math.abs(series[0].time - time);
  for (let index = 1; index < series.length; index += 1) {
    const distance = Math.abs(series[index].time - time);
    if (distance < bestDistance) {
      best = series[index];
      bestDistance = distance;
    }
  }
  return best;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function createLocalRegionState() {
  return {
    normalStress: 0,
    shearStress: 0,
    damage: 0,
    peakNormal: 0,
    peakShear: 0,
    firstFailureTime: null,
    firstFailureMode: null,
  };
}

function createMembraneRegionState() {
  return {
    stress: 0,
    damage: 0,
    threshold: 0,
    peakStress: 0,
    firstFailureTime: null,
  };
}

function buildSnapshotsByName(runDir, logOutputs) {
  const lookup = {};
  for (const spec of logOutputs.nodeData || []) {
    lookup[spec.name] = parseLogDataFile(path.join(runDir, spec.file));
  }
  for (const spec of logOutputs.rigidBodyData || []) {
    lookup[spec.name] = parseLogDataFile(path.join(runDir, spec.file));
  }
  return lookup;
}

function buildOutputMappingSummary(templateData) {
  return {
    displacementSources: {
      nucleusNodes: {
        logfile: "febio_nucleus_nodes.csv",
        mapsTo: ["history[].nucleus", "displacements.nucleus"],
      },
      cytoplasmNodes: {
        logfile: "febio_cytoplasm_nodes.csv",
        mapsTo: ["history[].cell", "displacements.cell"],
      },
      rigidPipette: {
        logfile: "febio_rigid_pipette.csv",
        mapsTo: [
          "history[].pipette",
          "history[].holdForce",
          "peaks.peakContactForce",
          "captureEstablished",
          "captureMaintained",
        ],
      },
    },
    localNc: Object.fromEntries(
      Object.entries(templateData.interfaceRegions.localNc).map(([region, mapping]) => [
        region,
        {
          nucleusLogfile: `febio_${mapping.nucleusNodeSet.replace(/_nodes$/, "")}.csv`,
          cytoplasmLogfile: `febio_${mapping.cytoplasmNodeSet.replace(/_nodes$/, "")}.csv`,
          mapsTo: [
            `localNc.${region}.normalStress`,
            `localNc.${region}.shearStress`,
            `localNc.${region}.damage`,
            `localNc.${region}.peakNormal`,
            `localNc.${region}.peakShear`,
          ],
        },
      ]),
    ),
    localCd: Object.fromEntries(
      Object.entries(templateData.interfaceRegions.localCd).map(([region, mapping]) => [
        region,
        {
          cellLogfile: `febio_${mapping.cellNodeSet.replace(/_nodes$/, "")}.csv`,
          mapsTo: [
            `localCd.${region}.normalStress`,
            `localCd.${region}.shearStress`,
            `localCd.${region}.damage`,
            `localCd.${region}.peakNormal`,
            `localCd.${region}.peakShear`,
          ],
        },
      ]),
    ),
    derived: {
      membraneRegions: {
        source: "proxy from localNc",
        mapsTo: ["membraneRegions.top_neck", "membraneRegions.side", "membraneRegions.basal"],
      },
      firstFailure: {
        source: "earliest localNc/localCd/membrane proxy failure time",
        mapsTo: ["firstFailureSite", "firstFailureMode"],
      },
      classification: {
        source: "classifyRun(normalizedResult)",
        mapsTo: ["classification", "dominantMechanism"],
      },
    },
  };
}

function getRigidPipetteState(snapshot, fallbackPosition) {
  const values = averageRecordColumns(snapshot);
  const x = Number.isFinite(values[0]) ? values[0] : fallbackPosition.x;
  const z = Number.isFinite(values[1]) ? values[1] : fallbackPosition.y;
  const forceX = Number.isFinite(values[2]) ? values[2] : 0;
  const forceZ = Number.isFinite(values[3]) ? values[3] : 0;
  return {
    position: { x, z },
    reaction: { x: forceX, z: forceZ },
  };
}

function getPipetteTipOffsetZ(templateData, inputSpec) {
  const centerOfMass = templateData?.materials?.pipette?.center_of_mass;
  if (!centerOfMass) {
    return 0;
  }
  const pipetteTop =
    (templateData?.geometry?.cytoplasm?.height ?? inputSpec.geometry.Hc) +
    Math.max(inputSpec.geometry.Hn * 0.8, inputSpec.geometry.rp * 3);
  const initialTipZ = centerOfMass[2] * 2 - pipetteTop;
  return centerOfMass[2] - initialTipZ;
}

function computeRegionInterfaceState(region, leftSeries, rightSeries, params, crits) {
  const state = createLocalRegionState();
  const timeline = [];
  const times = Array.from(
    new Set([...leftSeries.map((entry) => entry.time), ...rightSeries.map((entry) => entry.time)]),
  ).sort((a, b) => a - b);

  times.forEach((time) => {
    const left = averageRecordColumns(nearestSnapshot(leftSeries, time));
    const right = averageRecordColumns(nearestSnapshot(rightSeries, time));
    const deltaUx = Math.abs((left[0] || 0) - (right[0] || 0));
    const deltaUz = Math.abs((left[1] || 0) - (right[1] || 0));
    const normalDisplacement = region === "top" || region === "bottom" ? deltaUz : deltaUx;
    const shearDisplacement = region === "top" || region === "bottom" ? deltaUx : deltaUz;
    const normalStress = crits.Kn * normalDisplacement;
    const shearStress = crits.Kt * shearDisplacement;
    const phi = Math.sqrt(
      (normalStress / Math.max(crits.sigCrit, 1e-6)) ** 2 +
      (shearStress / Math.max(crits.tauCrit, 1e-6)) ** 2,
    );
    const damage = clamp01(phi <= 1 ? 0 : (phi - 1) / Math.max(crits.gc, 0.05));

    state.normalStress = normalStress;
    state.shearStress = shearStress;
    state.damage = Math.max(state.damage, damage);
    state.peakNormal = Math.max(state.peakNormal, normalStress);
    state.peakShear = Math.max(state.peakShear, shearStress);
    if (state.firstFailureTime === null && phi >= 1) {
      state.firstFailureTime = time;
      state.firstFailureMode = shearStress >= normalStress ? "shear" : "normal";
    }
    timeline.push({ time, normalStress, shearStress, damage });
  });

  return { state, timeline };
}

function computeCellDishRegionState(regionSeries, params, crits) {
  const state = createLocalRegionState();
  const timeline = [];
  regionSeries.forEach((snapshot) => {
    const values = averageRecordColumns(snapshot);
    const normalDisplacement = Math.abs(values[1] || 0);
    const shearDisplacement = Math.abs(values[0] || 0);
    const normalStress = crits.Kn * normalDisplacement;
    const shearStress = crits.Kt * shearDisplacement;
    const phi = Math.sqrt(
      (normalStress / Math.max(crits.sigCrit, 1e-6)) ** 2 +
      (shearStress / Math.max(crits.tauCrit, 1e-6)) ** 2,
    );
    const damage = clamp01(phi <= 1 ? 0 : (phi - 1) / Math.max(crits.gc, 0.05));

    state.normalStress = normalStress;
    state.shearStress = shearStress;
    state.damage = Math.max(state.damage, damage);
    state.peakNormal = Math.max(state.peakNormal, normalStress);
    state.peakShear = Math.max(state.peakShear, shearStress);
    if (state.firstFailureTime === null && phi >= 1) {
      state.firstFailureTime = snapshot.time;
      state.firstFailureMode = shearStress >= normalStress ? "shear" : "normal";
    }
    timeline.push({ time: snapshot.time, normalStress, shearStress, damage });
  });
  return { state, timeline };
}

function buildMembraneProxy(localNc, membraneSpec) {
  const regions = {
    top_neck: createMembraneRegionState(),
    side: createMembraneRegionState(),
    basal: createMembraneRegionState(),
  };
  regions.top_neck.threshold = membraneSpec.sig_m_crit_top;
  regions.side.threshold = membraneSpec.sig_m_crit_side;
  regions.basal.threshold = membraneSpec.sig_m_crit_basal;

  regions.top_neck.stress = localNc.top.peakNormal + localNc.top.peakShear * 0.35;
  regions.side.stress = Math.max(localNc.left.peakShear, localNc.right.peakShear) * 0.8;
  regions.basal.stress = localNc.bottom.peakNormal * 0.6;

  Object.values(regions).forEach((region) => {
    region.peakStress = region.stress;
    region.damage = clamp01(region.stress / Math.max(region.threshold, 1e-6) - 1);
    if (region.damage > 0) {
      region.firstFailureTime = 0;
    }
  });

  return regions;
}

function buildHistoryFromSnapshots(
  sandbox,
  inputSpec,
  templateData,
  nucleusSeries,
  cellSeries,
  rigidSeries,
  localNcTimeline,
  localCdTimeline,
) {
  const params = inputSpec.params;
  const nucleusRest = sandbox.getNucleusRest(params);
  const cellRest = sandbox.getCellRest(params);
  const pipetteTipOffsetZ = getPipetteTipOffsetZ(templateData, inputSpec);
  const times = Array.from(
    new Set([
      ...nucleusSeries.map((entry) => entry.time),
      ...cellSeries.map((entry) => entry.time),
      ...rigidSeries.map((entry) => entry.time),
    ]),
  ).sort((a, b) => a - b);

  return times.map((time) => {
    const nucleusValues = averageRecordColumns(nearestSnapshot(nucleusSeries, time));
    const cellValues = averageRecordColumns(nearestSnapshot(cellSeries, time));
    const target = inputSpec.schedule.targetAt(Math.min(time, inputSpec.schedule.phaseEnds.total));
    const rigidState = getRigidPipetteState(nearestSnapshot(rigidSeries, time), target.pos);
    const holdForce = Math.hypot(rigidState.reaction.x, rigidState.reaction.z);
    const ncState = {};
    const cdState = {};

    Object.keys(localNcTimeline).forEach((region) => {
      const entry =
        nearestSnapshotFromTimeline(localNcTimeline[region], time) ||
        localNcTimeline[region][localNcTimeline[region].length - 1];
      ncState[region] = entry
        ? {
            normalStress: entry.normalStress,
            shearStress: entry.shearStress,
            damage: entry.damage,
            peakNormal: entry.normalStress,
            peakShear: entry.shearStress,
          }
        : createLocalRegionState();
    });
    Object.keys(localCdTimeline).forEach((region) => {
      const entry =
        nearestSnapshotFromTimeline(localCdTimeline[region], time) ||
        localCdTimeline[region][localCdTimeline[region].length - 1];
      cdState[region] = entry
        ? {
            normalStress: entry.normalStress,
            shearStress: entry.shearStress,
            damage: entry.damage,
            peakNormal: entry.normalStress,
            peakShear: entry.shearStress,
          }
        : createLocalRegionState();
    });
    const membraneRegions = buildMembraneProxy(ncState, inputSpec.membrane);
    const damageNc = Math.max(...Object.values(ncState).map((state) => state.damage), 0);
    const damageCd = Math.max(...Object.values(cdState).map((state) => state.damage), 0);
    const damageMembrane = Math.max(...Object.values(membraneRegions).map((state) => state.damage), 0);
    const membraneStress = Math.max(...Object.values(membraneRegions).map((state) => state.stress), 0);

    return {
      time,
      phase: target.phase,
      pipette: sandbox.makeSectionPoint(rigidState.position.x, rigidState.position.z - pipetteTipOffsetZ),
      pipetteCenter: sandbox.makeSectionPoint(rigidState.position.x, rigidState.position.z),
      pipetteReaction: { x: rigidState.reaction.x, y: rigidState.reaction.z },
      nucleus: sandbox.makeSectionPoint(sandbox.getSectionX(nucleusRest) + (nucleusValues[0] || 0), sandbox.getWorldZ(nucleusRest) + (nucleusValues[1] || 0)),
      cell: sandbox.makeSectionPoint(sandbox.getSectionX(cellRest) + (cellValues[0] || 0), sandbox.getWorldZ(cellRest) + (cellValues[1] || 0)),
      localNc: ncState,
      localCd: cdState,
      tangentNucleus: 0,
      tangentCell: 0,
      membraneRegions,
      damageNc,
      damageCd,
      damageMembrane,
      membraneDamage: damageMembrane,
      membraneStress,
      membraneStrain: membraneStress / Math.max(inputSpec.membrane.sig_m_crit || 1, 1e-6),
      holdForce,
      tangentialOffset: 0,
    };
  });
}

function nearestSnapshotFromTimeline(timeline, time) {
  if (!timeline.length) {
    return null;
  }
  let best = timeline[0];
  let bestDistance = Math.abs(best.time - time);
  for (let index = 1; index < timeline.length; index += 1) {
    const distance = Math.abs(timeline[index].time - time);
    if (distance < bestDistance) {
      best = timeline[index];
      bestDistance = distance;
    }
  }
  return best;
}

function buildResultFromLogs(sandbox, payload, runDir) {
  const caseName = payload.inputSpec?.caseName || "A";
  const params = payload.inputSpec?.params || payload.params || {};
  const inputSpec = sandbox.buildSimulationInput(caseName, params);
  const febioInputSpec = sandbox.buildFebioInputSpec(caseName, params, inputSpec);
  const templateData = febioInputSpec.febioTemplateData;
  const logs = buildSnapshotsByName(runDir, templateData.logOutputs || {});
  const outputMapping = buildOutputMappingSummary(templateData);

  const nucleusSeries = logs.nucleus_nodes || [];
  const cellSeries = logs.cytoplasm_nodes || [];
  const rigidSeries = logs.pipette_rigid_body || [];

  const localNc = {
    right: createLocalRegionState(),
    left: createLocalRegionState(),
    top: createLocalRegionState(),
    bottom: createLocalRegionState(),
  };
  const localCd = {
    left: createLocalRegionState(),
    center: createLocalRegionState(),
    right: createLocalRegionState(),
  };
  const localNcTimeline = {};
  const localCdTimeline = {};

  for (const region of ["left", "right", "top", "bottom"]) {
    const mapped = templateData.interfaceRegions.localNc[region];
    const computed = computeRegionInterfaceState(
      region,
      logs[mapped.nucleusNodeSet] || [],
      logs[mapped.cytoplasmNodeSet] || [],
      params,
      templateData.interfaces.nucleusCytoplasm,
    );
    localNc[region] = computed.state;
    localNcTimeline[region] = computed.timeline;
  }

  for (const region of ["left", "center", "right"]) {
    const mapped = templateData.interfaceRegions.localCd[region];
    const computed = computeCellDishRegionState(
      logs[mapped.cellNodeSet] || [],
      params,
      templateData.interfaces.cellDish,
    );
    localCd[region] = computed.state;
    localCdTimeline[region] = computed.timeline;
  }

  const membraneRegions = buildMembraneProxy(localNc, inputSpec.membrane);
  const lastNucleus = averageRecordColumns(nucleusSeries[nucleusSeries.length - 1]);
  const lastCell = averageRecordColumns(cellSeries[cellSeries.length - 1]);
  const maxNucleusDisp = nucleusSeries.reduce(
    (maxValue, snapshot) => Math.max(maxValue, Math.hypot(...averageRecordColumns(snapshot).slice(0, 2))),
    0,
  );
  const maxCellDisp = cellSeries.reduce(
    (maxValue, snapshot) => Math.max(maxValue, Math.hypot(...averageRecordColumns(snapshot).slice(0, 2))),
    0,
  );
  const maxContactForce = rigidSeries.reduce((maxValue, snapshot) => {
    const values = averageRecordColumns(snapshot);
    return Math.max(maxValue, Math.hypot(values[2] || 0, values[3] || 0));
  }, 0);

  const damage = {
    nc: Math.max(...Object.values(localNc).map((state) => state.damage), 0),
    cd: Math.max(...Object.values(localCd).map((state) => state.damage), 0),
    membrane: Math.max(...Object.values(membraneRegions).map((state) => state.damage), 0),
  };

  const result = {
    caseName,
    params: sandbox.structuredClone(params),
    schedule: inputSpec.schedule,
    history: buildHistoryFromSnapshots(
      sandbox,
      inputSpec,
      templateData,
      nucleusSeries,
      cellSeries,
      rigidSeries,
      localNcTimeline,
      localCdTimeline,
    ),
    events: {},
    damage,
    peaks: {
      peakNcNormal: Math.max(...Object.values(localNc).map((state) => state.peakNormal), 0),
      peakNcShear: Math.max(...Object.values(localNc).map((state) => state.peakShear), 0),
      peakCdNormal: Math.max(...Object.values(localCd).map((state) => state.peakNormal), 0),
      peakCdShear: Math.max(...Object.values(localCd).map((state) => state.peakShear), 0),
      peakContactForce: maxContactForce,
      peakHoldForce: maxContactForce,
      peakMembraneStrain: Math.max(...Object.values(membraneRegions).map((state) => state.stress), 0),
      peakCytoplasmStress: Math.max(...Object.values(localCd).map((state) => state.peakNormal), 0),
      peakMomentProxy: maxContactForce * Math.abs(params.xp || 0),
    },
    localNc,
    localCd,
    membraneRegions,
    displacements: {
      nucleus: Math.hypot(lastNucleus[0] || 0, lastNucleus[1] || 0),
      cell: Math.hypot(lastCell[0] || 0, lastCell[1] || 0),
      tangentCell: 0,
      tangentNucleus: 0,
    },
    captureEstablished: maxContactForce > 0.05,
    captureMaintained: maxContactForce > 0.05,
    solverMetadata: sandbox.buildSolverMetadata("febio", {
      source: "febio-cli",
      note: "converted from FEBio logfile output",
    }),
    externalResult: {
      source: "febio-cli",
      runDirectory: runDir,
      inputJson: payload,
      outputMapping,
    },
  };

  if (Object.values(localNc).some((state) => state.firstFailureTime !== null)) {
    const firstNcTime = Math.min(...Object.values(localNc).filter((state) => state.firstFailureTime !== null).map((state) => state.firstFailureTime));
    result.events.ncDamageStart = { time: firstNcTime, detail: "nc interface failure started in FEBio output" };
  }
  if (Object.values(localCd).some((state) => state.firstFailureTime !== null)) {
    const firstCdTime = Math.min(...Object.values(localCd).filter((state) => state.firstFailureTime !== null).map((state) => state.firstFailureTime));
    result.events.cdDamageStart = { time: firstCdTime, detail: "cell-dish detachment started in FEBio output" };
  }
  if (Object.values(membraneRegions).some((state) => state.damage > 0)) {
    result.events.membraneDamageStart = { time: 0, detail: "membrane proxy threshold reached" };
  }
  if (!result.captureEstablished) {
    result.events.tipSlip = { time: 0, detail: "no effective pipette reaction force detected" };
  }

  const earliest = sandbox.findEarliestLocalFailure(result);
  result.firstFailureSite = earliest.site;
  result.firstFailureMode = earliest.mode;
  result.dominantMechanism = sandbox.determineDominantMechanism({
    ...result,
    dominantMechanism: "insufficient_capture",
  });
  result.classification = sandbox.classifyRun(result);
  return sandbox.normalizeSimulationResult(result, inputSpec);
}

const args = parseArgs(process.argv.slice(2));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const sandbox = loadSimulationModule(projectRoot);
const runDir = path.resolve(args.runDir);
const inputPayload = JSON.parse(fs.readFileSync(path.resolve(args.inputJson), "utf8"));
const normalizedResult = buildResultFromLogs(sandbox, inputPayload, runDir);
const outputPath =
  args.outFile || path.join(runDir, `case_${normalizedResult.caseName}_result.json`);

fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      normalizedResult,
      solverMetadata: normalizedResult.solverMetadata,
      outputMapping: normalizedResult.externalResult?.outputMapping || null,
      generatedAt: new Date().toISOString(),
      source: "convert_febio_output.mjs",
    },
    null,
    2,
  ),
  "utf8",
);

console.log(outputPath);
