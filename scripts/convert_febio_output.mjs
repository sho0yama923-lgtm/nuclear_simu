import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

async function loadCanonicalPublicApi(projectRoot) {
  const sourceApiPath = path.join(projectRoot, "src", "public-api.ts");
  if (fs.existsSync(sourceApiPath)) {
    return import(pathToFileURL(sourceApiPath).href);
  }
  const publicApiPath = path.join(projectRoot, "generated", "dist", "public-api.js");
  if (!fs.existsSync(publicApiPath)) {
    throw new Error("Neither src/public-api.ts nor generated/dist/public-api.js was found. Cannot convert FEBio output.");
  }
  return import(pathToFileURL(publicApiPath).href);
}

function makeSectionPoint(x, worldZ) {
  return { x, y: worldZ };
}

function getSectionX(point) {
  return Number(point?.x || 0);
}

function getWorldZ(point) {
  return Number(point?.z ?? point?.y ?? 0);
}

function getNucleusRest(params = {}) {
  return makeSectionPoint(Number(params.xn || 0), Number(params.yn || 0));
}

function getCellRest(params = {}) {
  return makeSectionPoint(0, Number(params.Hc || 0) / 2);
}

function buildSolverMetadata(modeOrOverrides = {}, maybeOverrides = {}) {
  const overrides = typeof modeOrOverrides === "string"
    ? { solverMode: modeOrOverrides, ...maybeOverrides }
    : modeOrOverrides;
  return {
    solverMode: "febio",
    source: "febio-import",
    note: "",
    ...overrides,
  };
}

async function loadCanonicalRuntime(projectRoot) {
  const api = await loadCanonicalPublicApi(projectRoot);
  return {
    ...api,
    structuredClone: globalThis.structuredClone || ((value) => JSON.parse(JSON.stringify(value))),
    makeSectionPoint,
    getSectionX,
    getWorldZ,
    getNucleusRest,
    getCellRest,
    buildSolverMetadata,
    assessDetachmentExplicit: api.assessDetachment,
    normalizeSimulationResult: api.normalizeFebioResult,
  };
}

function parseFaceDataFields(dataSpec = "") {
  return String(dataSpec || "")
    .split(/[;,]/)
    .map((field) => field.trim().toLowerCase())
    .filter(Boolean);
}

function parseLogDataFile(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const snapshots = [];
  let current = null;
  let timeFallback = 0;
  const dataFields = parseFaceDataFields(options.data);

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
      current = { time: Number(timeMatch[1]), records: [], dataFields };
      continue;
    }

    if (/^Data Record/i.test(line) || /^\*/.test(line) || /^=/i.test(line)) {
      continue;
    }

    const fields = line.split(/[,\s]+/).filter(Boolean);
    if (fields.length >= 2 && /^[-+0-9.eE]+$/.test(fields[0])) {
      if (!current) {
        current = { time: timeFallback, records: [], dataFields };
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

function averageFinite(values) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (!finiteValues.length) {
    return null;
  }
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function pickFiniteNumber(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
}

function createLocalRegionState() {
  return {
    normalStress: 0,
    shearStress: 0,
    damage: 0,
    peakNormal: 0,
    peakShear: 0,
    nativeGap: 0,
    contactFraction: 0,
    minContactFraction: 1,
    sourceNormal: "unavailable",
    sourceDamage: "unavailable",
    sourceShear: "unavailable",
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

function hasNativeFaceRegionObservation(localNc = {}) {
  return Object.values(localNc).some((state) =>
    String(state?.sourceNormal || "").includes("native-face") ||
    String(state?.sourceDamage || "").includes("native-face") ||
    String(state?.sourceShear || "").includes("native-face")
  );
}

function buildDetachmentMetricsFromLocalState(localNc = {}, displacements = {}) {
  const regions = Object.values(localNc);
  const contactAreaRatio =
    averageFinite(regions.map((state) => state?.contactFraction)) ??
    averageFinite(regions.map((state) => (state ? clamp01(1 - (state.damage ?? 0)) : null))) ??
    1;

  return {
    contactAreaRatio: clamp01(contactAreaRatio),
    relativeNucleusDisplacement: Number.isFinite(displacements?.nucleus) ? displacements.nucleus : 0,
    provenance: hasNativeFaceRegionObservation(localNc) ? "native-face-data-preferred" : "proxy-fallback-explicit",
  };
}

function assessDetachmentSnapshot(snapshot, assessDetachmentFn = null) {
  if (typeof assessDetachmentFn === "function") {
    return assessDetachmentFn(snapshot);
  }

  const localNc = snapshot?.localNc || {};
  const nativeDamage = Math.max(
    snapshot?.damage?.nc || 0,
    ...Object.values(localNc).map((state) => state?.damage || 0),
  );
  const geometryRatio = snapshot?.detachmentMetrics?.contactAreaRatio ?? 1;
  const relativeDisplacement =
    snapshot?.detachmentMetrics?.relativeNucleusDisplacement ?? snapshot?.displacements?.nucleus ?? 0;

  return {
    start: nativeDamage >= 0.45 || geometryRatio <= 0.6 || relativeDisplacement >= 0.18,
    complete: nativeDamage >= 0.72 && (geometryRatio <= 0.35 || relativeDisplacement >= 0.27),
    nativePreferred: hasNativeFaceRegionObservation(localNc),
    geometryRatio,
    relativeDisplacement,
    mode: hasNativeFaceRegionObservation(localNc) ? "native" : "proxy-fallback-explicit",
  };
}

function buildDetachmentEvent(key, time, assessment, source = "external-explicit") {
  if (!Number.isFinite(time)) {
    return null;
  }

  const eventLabel = key === "detachmentComplete" ? "detachment complete" : "detachment start";
  return {
    time,
    detail: `${eventLabel} (${assessment.mode}, damage+geometry, areaRatio=${Number(assessment.geometryRatio || 0).toFixed(2)})`,
    source,
  };
}

function attachExplicitDetachmentEvents(result, assessDetachmentFn = null) {
  result.events ??= {};
  let detachmentStart = result.events.detachmentStart || null;
  let detachmentComplete = result.events.detachmentComplete || null;

  for (const entry of result.history || []) {
    const assessment = assessDetachmentSnapshot(entry, assessDetachmentFn);
    if (!detachmentStart && assessment.start) {
      detachmentStart = buildDetachmentEvent("detachmentStart", entry.time, assessment);
    }
    if (!detachmentComplete && assessment.complete) {
      detachmentComplete = buildDetachmentEvent("detachmentComplete", entry.time, assessment);
    }
    if (detachmentStart && detachmentComplete) {
      break;
    }
  }

  if (!detachmentStart || !detachmentComplete) {
    const fallbackTime = result.history?.[result.history.length - 1]?.time ?? 0;
    const assessment = assessDetachmentSnapshot(result, assessDetachmentFn);
    if (!detachmentStart && assessment.start) {
      detachmentStart = buildDetachmentEvent("detachmentStart", fallbackTime, assessment, "external-explicit-final-state");
    }
    if (!detachmentComplete && assessment.complete) {
      detachmentComplete = buildDetachmentEvent(
        "detachmentComplete",
        fallbackTime,
        assessment,
        "external-explicit-final-state",
      );
    }
  }

  if (detachmentStart) {
    result.events.detachmentStart = detachmentStart;
  }
  if (detachmentComplete) {
    result.events.detachmentComplete = detachmentComplete;
  }
  if (detachmentStart || detachmentComplete) {
    result.detachment = {
      evaluation: "damage-plus-geometry",
      start: detachmentStart,
      complete: detachmentComplete,
    };
  }
}

function normalizeInterfaceCriteria(crits = {}) {
  return {
    Kn: Number(crits.normalStiffness ?? crits.Kn ?? 0),
    Kt: Number(crits.tangentialStiffness ?? crits.Kt ?? 0),
    sigCrit: Number(crits.criticalNormalStress ?? crits.sigCrit ?? 0),
    tauCrit: Number(crits.criticalShearStress ?? crits.tauCrit ?? 0),
    gc: Number(crits.fractureEnergy ?? crits.gc ?? 0),
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
  for (const spec of logOutputs.faceData || []) {
    lookup[spec.name] = parseLogDataFile(path.join(runDir, spec.file), { data: spec.data });
  }
  return lookup;
}

function getLogOutputSpecs(templateData) {
  const outputs = templateData.outputs || {};
  const logOutputs = templateData.logOutputs || {};
  return {
    nodeData: logOutputs.nodeData || outputs.nodeData || [],
    rigidBodyData: logOutputs.rigidBodyData || outputs.rigidBodyData || [],
    faceData: logOutputs.faceData || outputs.faceData || [],
    plotfileSurfaceData: logOutputs.plotfileSurfaceData || outputs.plotfileSurfaceData || [],
    aspiration: logOutputs.aspiration || outputs.aspiration || null,
  };
}

function buildOutputMappingSummary(templateData) {
  const logOutputSpecs = getLogOutputSpecs(templateData);
  const faceDataSource = logOutputSpecs.faceData;
  const plotfileSurfaceSource = logOutputSpecs.plotfileSurfaceData;
  const interfaceRegions = templateData.interfaceRegions || { localNc: {}, localCd: {} };
  const faceDataSpecs = Object.fromEntries(
    faceDataSource.map((entry) => [entry.name, entry]),
  );
  const plotfileSurfaceSpecs = plotfileSurfaceSource.reduce((lookup, entry) => {
    const key = `${entry.interfaceGroup || "unknown"}:${entry.region || entry.name}`;
    lookup[key] = entry;
    return lookup;
  }, {});
  const pickFaceSpec = (name) => faceDataSpecs[name] || null;
  const pickPlotfileSurfaceSpec = (interfaceGroup, region) =>
    plotfileSurfaceSpecs[`${interfaceGroup}:${region}`] || null;

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
    aspiration: logOutputSpecs.aspiration
      ? {
          metric: logOutputSpecs.aspiration.metric || "L(t)",
          unit: logOutputSpecs.aspiration.unit || "um",
          source: logOutputSpecs.aspiration.preferredSource || "native-node-displacement",
          payloadPath: logOutputSpecs.aspiration.payloadPath || "aspiration.length",
          historyPath: logOutputSpecs.aspiration.historyPath || "history[].aspirationLength",
          peakPath: logOutputSpecs.aspiration.peakPath || "peaks.peakAspirationLength",
          definition: logOutputSpecs.aspiration.definition || null,
          mapsTo: logOutputSpecs.aspiration.mapsTo || [
            "history[].aspirationLength",
            "aspiration.length",
            "peaks.peakAspirationLength",
          ],
        }
      : {
          metric: "L(t)",
          unit: "um",
          source: "unavailable",
          payloadPath: "aspiration.length",
          historyPath: "history[].aspirationLength",
          peakPath: "peaks.peakAspirationLength",
          definition: null,
          mapsTo: [],
        },
    localNc: Object.fromEntries(
      Object.entries(interfaceRegions.localNc).map(([region, mapping]) => [
        region,
        (() => {
          const faceSpec = pickFaceSpec(`nucleus_cytoplasm_${region}_surface`);
          const plotfileSpec = pickPlotfileSurfaceSpec("localNc", region);
          return {
          faceLogfile: `febio_interface_nc_${region}.csv`,
          nucleusLogfile: `febio_${mapping.nucleusNodeSet.replace(/_nodes$/, "")}.csv`,
          cytoplasmLogfile: `febio_${mapping.cytoplasmNodeSet.replace(/_nodes$/, "")}.csv`,
          source: "native face_data for normal stress/gap/contact fraction and tangential traction when available, node proxy fallback for shear",
          logfileFields: faceSpec?.logfileFields || ["contact gap", "contact pressure"],
          logfileData: faceSpec?.logfileData || "contact gap;contact pressure",
          optionalExternalFields: faceSpec?.optionalExternalFields || [],
          currentCoverage: faceSpec?.currentCoverage || {
            normal: "native-face-data-preferred",
            damage: "native-face-data-preferred",
            shear: "proxy-fallback-explicit",
          },
          standardTangentialBridge: plotfileSpec
            ? {
                variable: plotfileSpec.variable || "contact traction",
                surface: plotfileSpec.surface,
                payloadPath: plotfileSpec.payloadPath,
                preferredSource: plotfileSpec.preferredSource || "native-plotfile-contact-traction",
                sectionAxes: plotfileSpec.sectionAxes || null,
              }
            : null,
          mapsTo: [
            `localNc.${region}.normalStress`,
            `localNc.${region}.shearStress`,
            `localNc.${region}.damage`,
            `localNc.${region}.nativeGap`,
            `localNc.${region}.contactFraction`,
            `localNc.${region}.peakNormal`,
            `localNc.${region}.peakShear`,
          ],
          };
        })(),
      ]),
    ),
    localCd: Object.fromEntries(
      Object.entries(interfaceRegions.localCd).map(([region, mapping]) => [
        region,
        (() => {
          const faceSpec = pickFaceSpec(`cell_dish_${region}_surface`);
          const plotfileSpec = pickPlotfileSurfaceSpec("localCd", region);
          return {
          faceLogfile: `febio_interface_cd_${region}.csv`,
          cellLogfile: `febio_${mapping.cellNodeSet.replace(/_nodes$/, "")}.csv`,
          source: "face_data for normal stress/gap and tangential traction when available, node proxy fallback for shear",
          logfileFields: faceSpec?.logfileFields || ["contact gap", "contact pressure"],
          logfileData: faceSpec?.logfileData || "contact gap;contact pressure",
          optionalExternalFields: faceSpec?.optionalExternalFields || [],
          currentCoverage: faceSpec?.currentCoverage || {
            normal: "native-face-data-preferred",
            damage: "native-face-data-preferred",
            shear: "proxy-fallback-explicit",
          },
          standardTangentialBridge: plotfileSpec
            ? {
                variable: plotfileSpec.variable || "contact traction",
                surface: plotfileSpec.surface,
                payloadPath: plotfileSpec.payloadPath,
                preferredSource: plotfileSpec.preferredSource || "native-plotfile-contact-traction",
                sectionAxes: plotfileSpec.sectionAxes || null,
              }
            : null,
          mapsTo: [
            `localCd.${region}.normalStress`,
            `localCd.${region}.shearStress`,
            `localCd.${region}.damage`,
            `localCd.${region}.peakNormal`,
            `localCd.${region}.peakShear`,
          ],
          };
        })(),
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
      nativeObservation: {
        source: "resultProvenance.dataSources",
        mapsTo: ["resultProvenance.dataSources.localNc", "resultProvenance.dataSources.localCd"],
      },
      classification: {
        source: "classifyRun(normalizedResult)",
        mapsTo: ["classification", "dominantMechanism"],
      },
    },
  };
}

function pickPlotfileSurfaceSeries(payload, interfaceGroup, region) {
  const candidates = [
    payload?.plotfileSurfaceData?.[interfaceGroup]?.[region],
    payload?.bridgeSurfaceData?.[interfaceGroup]?.[region],
    payload?.plotfileContactTraction?.[interfaceGroup]?.[region],
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) {
      return candidate;
    }
  }
  return [];
}

function resolveSectionTangentialAxis(interfaceGroup, region, entry = null) {
  const explicitAxis = entry?.sectionAxes?.tangential || entry?.axes?.tangential || entry?.tangentialAxis;
  if (explicitAxis === "x" || explicitAxis === "z") {
    return explicitAxis;
  }
  if (interfaceGroup === "localNc") {
    return region === "top" || region === "bottom" ? "x" : "z";
  }
  return "x";
}

function readBridgeVectorComponent(vector, axis) {
  if (Array.isArray(vector)) {
    const index = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    const value = Number(vector[index]);
    return Number.isFinite(value) ? value : null;
  }
  if (vector && typeof vector === "object") {
    const value = Number(vector[axis]);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function computeTangentialTractionFromPlotfileBridge(interfaceGroup, region, entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const explicit = pickFiniteNumber(
    entry.tangentialTraction,
    entry.tangentialStress,
    entry.shearTraction,
    entry.shearStress,
    entry.tangentialMagnitude,
    entry.contactTractionMagnitude,
  );
  if (explicit != null) {
    return Math.abs(explicit);
  }

  const vectorSources = [
    entry.contactTraction,
    entry.traction,
    entry.contactTractionVector,
    entry.vector,
  ];
  const tangentialAxis = resolveSectionTangentialAxis(interfaceGroup, region, entry);
  for (const vector of vectorSources) {
    const component = readBridgeVectorComponent(vector, tangentialAxis);
    if (component != null) {
      return Math.abs(component);
    }
  }

  return null;
}

function nearestBridgeEntry(series, time) {
  if (!Array.isArray(series) || !series.length) {
    return null;
  }
  const timedEntries = series.filter((entry) => Number.isFinite(entry?.time));
  if (!timedEntries.length) {
    return series[0];
  }
  return nearestSnapshotFromTimeline(timedEntries, time);
}

function resolveTangentialShearObservation(interfaceGroup, region, faceSnapshot, bridgeSeries, time, fallbackEntry) {
  const bridgeEntry = nearestBridgeEntry(bridgeSeries, time);
  const bridgeShearStress = computeTangentialTractionFromPlotfileBridge(interfaceGroup, region, bridgeEntry);
  if (bridgeShearStress != null) {
    return {
      shearStress: bridgeShearStress,
      sourceShear: "native-plotfile-contact-traction",
    };
  }

  const nativeFaceShearStress = computeTangentialTractionFromFaceSnapshot(faceSnapshot);
  if (nativeFaceShearStress != null) {
    return {
      shearStress: nativeFaceShearStress,
      sourceShear: "native-face-traction",
    };
  }

  return {
    shearStress: fallbackEntry?.shearStress ?? 0,
    sourceShear: "node-displacement-proxy",
  };
}

function getRigidPipetteState(snapshot, fallbackPosition) {
  const values = averageRecordColumns(snapshot);
  const x = Number.isFinite(values[0]) ? values[0] : fallbackPosition.x;
  const z = Number.isFinite(values[2]) ? values[2] : fallbackPosition.y;
  const forceX = Number.isFinite(values[3]) ? values[3] : 0;
  const forceZ = Number.isFinite(values[5]) ? values[5] : 0;
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

function computeAspirationLength(nucleusValues, cellValues) {
  const inwardDisplacements = [
    -(Number(nucleusValues?.[0]) || 0),
    -(Number(cellValues?.[0]) || 0),
  ].filter((value) => Number.isFinite(value));
  return Math.max(0, ...inwardDisplacements);
}

function computeRegionInterfaceState(region, leftSeries, rightSeries, params, crits) {
  const resolved = normalizeInterfaceCriteria(crits);
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
    const normalStress = resolved.Kn * normalDisplacement;
    const shearStress = resolved.Kt * shearDisplacement;
    const phi = Math.sqrt(
      (normalStress / Math.max(resolved.sigCrit, 1e-6)) ** 2 +
      (shearStress / Math.max(resolved.tauCrit, 1e-6)) ** 2,
    );
    const damage = clamp01(phi <= 1 ? 0 : (phi - 1) / Math.max(resolved.gc, 0.05));

    state.normalStress = normalStress;
    state.shearStress = shearStress;
    state.damage = Math.max(state.damage, damage);
    state.peakNormal = Math.max(state.peakNormal, normalStress);
    state.peakShear = Math.max(state.peakShear, shearStress);
    state.nativeGap = Math.max(state.nativeGap, normalDisplacement);
    state.contactFraction = Math.max(0, 1 - damage);
    state.minContactFraction = Math.min(state.minContactFraction, Math.max(0, 1 - damage));
    state.sourceNormal = "node-displacement-proxy";
    state.sourceDamage = "node-displacement-proxy";
    state.sourceShear = "node-displacement-proxy";
    if (state.firstFailureTime === null && phi >= 1) {
      state.firstFailureTime = time;
      state.firstFailureMode = shearStress >= normalStress ? "shear" : "normal";
    }
    timeline.push({
      time,
      normalStress,
      shearStress,
      damage,
      nativeGap: normalDisplacement,
      contactFraction: Math.max(0, 1 - damage),
      sourceNormal: "node-displacement-proxy",
      sourceDamage: "node-displacement-proxy",
      sourceShear: "node-displacement-proxy",
    });
  });

  return { state, timeline };
}

function computeContactFractionFromFaceSnapshot(snapshot, gapScale, tractionThreshold) {
  if (!snapshot?.records?.length) {
    return 0;
  }
  const layout = resolveFaceSnapshotLayout(snapshot);
  let engagedCount = 0;
  snapshot.records.forEach((record) => {
    const gap = Math.abs(Number(record[layout.valueOffset + layout.gapFieldIndex] || 0));
    const pressure = Math.abs(Number(record[layout.valueOffset + layout.pressureFieldIndex] || 0));
    if (pressure >= tractionThreshold || gap <= gapScale * 0.5) {
      engagedCount += 1;
    }
  });
  return engagedCount / snapshot.records.length;
}

function inferFaceSnapshotValueOffsetHeuristic(snapshot) {
  const records = snapshot?.records || [];
  if (!records.length) {
    return 1;
  }

  const hasTwoLeadingIntegerColumns = records.every((record) => {
    const first = Number(record?.[0]);
    const second = Number(record?.[1]);
    return Number.isFinite(first) && Number.isInteger(first) && Number.isFinite(second) && Number.isInteger(second) && record.length >= 4;
  });
  if (hasTwoLeadingIntegerColumns) {
    return 2;
  }

  const hasLeadingEntityId = records.every((record) => {
    const first = Number(record?.[0]);
    return Number.isFinite(first) && Number.isInteger(first) && record.length >= 3;
  });

  return hasLeadingEntityId ? 1 : 0;
}

function pickMostCommonNonNegative(values) {
  if (!values.length) {
    return null;
  }
  const counts = new Map();
  values.forEach((value) => {
    if (!Number.isInteger(value) || value < 0) {
      return;
    }
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  if (!counts.size) {
    return null;
  }
  let bestValue = null;
  let bestCount = -1;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  });
  return bestValue;
}

function resolveFaceSnapshotLayout(snapshot) {
  const records = snapshot?.records || [];
  const dataFields = Array.isArray(snapshot?.dataFields) ? snapshot.dataFields : [];
  const expectedValueCount = dataFields.length || null;
  const inferredOffsets = expectedValueCount
    ? records
      .map((record) => record.length - expectedValueCount)
      .filter((value) => Number.isInteger(value) && value >= 0)
    : [];
  const valueOffset =
    (inferredOffsets.length === records.length && inferredOffsets.length
      ? inferredOffsets[0]
      : pickMostCommonNonNegative(inferredOffsets)) ??
    inferFaceSnapshotValueOffsetHeuristic(snapshot);

  const gapFieldIndex = Math.max(
    0,
    dataFields.findIndex((field) => field.includes("gap")),
  );
  const pressureFieldIndex = (() => {
    const descriptorIndex = dataFields.findIndex(
      (field) => field.includes("pressure") && !field.includes("traction"),
    );
    if (descriptorIndex >= 0) {
      return descriptorIndex;
    }
    return gapFieldIndex === 0 ? 1 : 0;
  })();
  const tangentialFieldIndices = dataFields.length
    ? dataFields
      .map((field, index) => ({ field, index }))
      .filter(({ field }) =>
        (field.includes("traction") || field.includes("tangential") || field.includes("shear")) &&
        !field.includes("pressure"))
      .map(({ index }) => index)
    : [];

  return {
    valueOffset,
    gapFieldIndex,
    pressureFieldIndex,
    tangentialFieldIndices,
  };
}

function inferFaceSnapshotValueOffset(snapshot) {
  return resolveFaceSnapshotLayout(snapshot).valueOffset;
}

function averageFaceSnapshotColumns(snapshot) {
  if (!snapshot?.records?.length) {
    return [];
  }
  const valueOffset = inferFaceSnapshotValueOffset(snapshot);
  const width = Math.max(0, snapshot.records[0].length - valueOffset);
  const sums = new Array(width).fill(0);

  snapshot.records.forEach((record) => {
    for (let index = 0; index < width; index += 1) {
      sums[index] += Number(record[index + valueOffset] || 0);
    }
  });

  return sums.map((value) => value / snapshot.records.length);
}

function computeTangentialTractionFromFaceSnapshot(snapshot) {
  if (!snapshot?.records?.length) {
    return null;
  }
  const layout = resolveFaceSnapshotLayout(snapshot);

  let sawTangentialColumn = false;
  let sumMagnitude = 0;
  let count = 0;

  snapshot.records.forEach((record) => {
    const tangentialValues = layout.tangentialFieldIndices.length
      ? layout.tangentialFieldIndices.map((fieldIndex) => record[layout.valueOffset + fieldIndex])
      : record.slice(layout.valueOffset + 2);
    const tangentialComponents = tangentialValues
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    if (!tangentialComponents.length) {
      return;
    }

    sawTangentialColumn = true;
    sumMagnitude += Math.hypot(...tangentialComponents);
    count += 1;
  });

  if (!sawTangentialColumn || count === 0) {
    return null;
  }

  return sumMagnitude / count;
}

function computeFaceDrivenInterfaceState(region, faceSeries, fallbackState, crits, bridgeSeries = []) {
  const resolved = normalizeInterfaceCriteria(crits);
  if (!faceSeries?.length) {
    return {
      state: {
        ...fallbackState.state,
        sourceNormal: "node-displacement-proxy",
        sourceDamage: "node-displacement-proxy",
        sourceShear: "node-displacement-proxy",
      },
      timeline: fallbackState.timeline.map((entry) => ({
        ...entry,
        sourceNormal: "node-displacement-proxy",
        sourceDamage: "node-displacement-proxy",
        sourceShear: "node-displacement-proxy",
      })),
    };
  }

  const state = {
    ...fallbackState.state,
    sourceNormal: "native-face-pressure",
    sourceDamage: "native-face-gap-pressure",
    sourceShear: "node-displacement-proxy",
  };
  const timeline = [];
  const gapScale = Math.max(resolved.gc / Math.max(resolved.sigCrit, 1e-6), 1e-4);
  const tractionThreshold = Math.max(resolved.sigCrit * 0.05, 1e-6);

  faceSeries.forEach((snapshot) => {
    const layout = resolveFaceSnapshotLayout(snapshot);
    const values = averageFaceSnapshotColumns(snapshot);
    const fallbackEntry =
      nearestSnapshotFromTimeline(fallbackState.timeline, snapshot.time) ||
      fallbackState.timeline[fallbackState.timeline.length - 1] ||
      { shearStress: 0 };
    const normalGap = Math.abs(values[layout.gapFieldIndex] || 0);
    const normalStress = Math.abs(values[layout.pressureFieldIndex] || 0);
    const shearObservation = resolveTangentialShearObservation(
      "localNc",
      region,
      snapshot,
      bridgeSeries,
      snapshot.time,
      fallbackEntry,
    );
    const shearStress = shearObservation.shearStress;
    const shearSource = shearObservation.sourceShear;
    const contactFraction = computeContactFractionFromFaceSnapshot(snapshot, gapScale, tractionThreshold);
    const tractionPhi = normalStress / Math.max(resolved.sigCrit, 1e-6);
    const gapPhi = normalGap / gapScale;
    const damage = clamp01(Math.max(tractionPhi, gapPhi) <= 1 ? 0 : Math.max(tractionPhi, gapPhi) - 1);

    state.normalStress = normalStress;
    state.shearStress = shearStress;
    state.damage = Math.max(state.damage, damage);
    state.peakNormal = Math.max(state.peakNormal, normalStress);
    state.peakShear = Math.max(state.peakShear, shearStress);
    state.nativeGap = normalGap;
    state.contactFraction = contactFraction;
    state.minContactFraction = Math.min(state.minContactFraction, contactFraction);
    if (state.firstFailureTime === null && Math.max(tractionPhi, gapPhi) >= 1) {
      state.firstFailureTime = snapshot.time;
      state.firstFailureMode = "normal";
    }

    timeline.push({
      time: snapshot.time,
      normalStress,
      shearStress,
      damage,
      nativeGap: normalGap,
      contactFraction,
      sourceNormal: "native-face-pressure",
      sourceDamage: "native-face-gap-pressure",
      sourceShear: shearSource,
    });

    state.sourceShear = shearSource;
  });

  return { state, timeline };
}

function computeCellDishRegionState(regionSeries, params, crits) {
  const resolved = normalizeInterfaceCriteria(crits);
  const state = createLocalRegionState();
  const timeline = [];
  regionSeries.forEach((snapshot) => {
    const values = averageRecordColumns(snapshot);
    const normalDisplacement = Math.abs(values[1] || 0);
    const shearDisplacement = Math.abs(values[0] || 0);
    const normalStress = resolved.Kn * normalDisplacement;
    const shearStress = resolved.Kt * shearDisplacement;
    const phi = Math.sqrt(
      (normalStress / Math.max(resolved.sigCrit, 1e-6)) ** 2 +
      (shearStress / Math.max(resolved.tauCrit, 1e-6)) ** 2,
    );
    const damage = clamp01(phi <= 1 ? 0 : (phi - 1) / Math.max(resolved.gc, 0.05));

    state.normalStress = normalStress;
    state.shearStress = shearStress;
    state.damage = Math.max(state.damage, damage);
    state.peakNormal = Math.max(state.peakNormal, normalStress);
    state.peakShear = Math.max(state.peakShear, shearStress);
    state.nativeGap = normalDisplacement;
    state.contactFraction = Math.max(0, 1 - damage);
    state.minContactFraction = Math.min(state.minContactFraction, Math.max(0, 1 - damage));
    state.sourceNormal = "node-displacement-proxy";
    state.sourceDamage = "node-displacement-proxy";
    state.sourceShear = "node-displacement-proxy";
    if (state.firstFailureTime === null && phi >= 1) {
      state.firstFailureTime = snapshot.time;
      state.firstFailureMode = shearStress >= normalStress ? "shear" : "normal";
    }
    timeline.push({
      time: snapshot.time,
      normalStress,
      shearStress,
      damage,
      nativeGap: normalDisplacement,
      contactFraction: Math.max(0, 1 - damage),
      sourceNormal: "node-displacement-proxy",
      sourceDamage: "node-displacement-proxy",
      sourceShear: "node-displacement-proxy",
    });
  });
  return { state, timeline };
}

function computeCellDishRegionStateWithFace(region, regionSeries, faceSeries, crits, bridgeSeries = []) {
  const resolved = normalizeInterfaceCriteria(crits);
  const fallback = computeCellDishRegionState(regionSeries, null, crits);
  if (!faceSeries?.length) {
    fallback.state.sourceNormal = "node-displacement-proxy";
    fallback.state.sourceDamage = "node-displacement-proxy";
    fallback.state.sourceShear = "node-displacement-proxy";
    fallback.timeline = fallback.timeline.map((entry) => ({
      ...entry,
      sourceNormal: "node-displacement-proxy",
      sourceDamage: "node-displacement-proxy",
      sourceShear: "node-displacement-proxy",
    }));
    return fallback;
  }

  const state = {
    ...fallback.state,
    sourceNormal: "native-face-pressure",
    sourceDamage: "native-face-gap-pressure",
    sourceShear: "node-displacement-proxy",
  };
  const timeline = [];
  const gapScale = Math.max(resolved.gc / Math.max(resolved.sigCrit, 1e-6), 1e-4);
  const tractionThreshold = Math.max(resolved.sigCrit * 0.05, 1e-6);

  faceSeries.forEach((snapshot) => {
    const layout = resolveFaceSnapshotLayout(snapshot);
    const values = averageFaceSnapshotColumns(snapshot);
    const fallbackEntry =
      nearestSnapshotFromTimeline(fallback.timeline, snapshot.time) ||
      fallback.timeline[fallback.timeline.length - 1] ||
      { shearStress: 0 };
    const normalGap = Math.abs(values[layout.gapFieldIndex] || 0);
    const normalStress = Math.abs(values[layout.pressureFieldIndex] || 0);
    const shearObservation = resolveTangentialShearObservation(
      "localCd",
      region,
      snapshot,
      bridgeSeries,
      snapshot.time,
      fallbackEntry,
    );
    const shearStress = shearObservation.shearStress;
    const shearSource = shearObservation.sourceShear;
    const contactFraction = computeContactFractionFromFaceSnapshot(snapshot, gapScale, tractionThreshold);
    const tractionPhi = normalStress / Math.max(resolved.sigCrit, 1e-6);
    const gapPhi = normalGap / gapScale;
    const damage = clamp01(Math.max(tractionPhi, gapPhi) <= 1 ? 0 : Math.max(tractionPhi, gapPhi) - 1);

    state.normalStress = normalStress;
    state.shearStress = shearStress;
    state.damage = Math.max(state.damage, damage);
    state.peakNormal = Math.max(state.peakNormal, normalStress);
    state.peakShear = Math.max(state.peakShear, shearStress);
    state.nativeGap = normalGap;
    state.contactFraction = contactFraction;
    state.minContactFraction = Math.min(state.minContactFraction, contactFraction);
    if (state.firstFailureTime === null && Math.max(tractionPhi, gapPhi) >= 1) {
      state.firstFailureTime = snapshot.time;
      state.firstFailureMode = "normal";
    }

    timeline.push({
      time: snapshot.time,
      normalStress,
      shearStress,
      damage,
      nativeGap: normalGap,
      contactFraction,
      sourceNormal: "native-face-pressure",
      sourceDamage: "native-face-gap-pressure",
      sourceShear: shearSource,
    });

    state.sourceShear = shearSource;
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

function summarizeRegionSources(regions) {
  return Object.fromEntries(
    Object.entries(regions).map(([region, state]) => [
      region,
      {
        normal: state.sourceNormal || "unknown",
        damage: state.sourceDamage || "unknown",
        shear: state.sourceShear || "unknown",
      },
    ]),
  );
}

function buildRegionObservationSummary(mappingEntry, state) {
  return {
    actualSources: {
      normal: state?.sourceNormal || "unknown",
      damage: state?.sourceDamage || "unknown",
      shear: state?.sourceShear || "unknown",
    },
    logfileData: mappingEntry?.logfileData || null,
    logfileFields: structuredClone(mappingEntry?.logfileFields || []),
    optionalExternalFields: structuredClone(mappingEntry?.optionalExternalFields || []),
    currentCoverage: structuredClone(mappingEntry?.currentCoverage || null),
    standardTangentialBridge: structuredClone(mappingEntry?.standardTangentialBridge || null),
  };
}

function buildInterfaceObservationSummary(mapping, localNc, localCd, detachmentMetrics) {
  return {
    localNc: Object.fromEntries(
      Object.entries(localNc).map(([region, state]) => [
        region,
        buildRegionObservationSummary(mapping?.localNc?.[region], state),
      ]),
    ),
    localCd: Object.fromEntries(
      Object.entries(localCd).map(([region, state]) => [
        region,
        buildRegionObservationSummary(mapping?.localCd?.[region], state),
      ]),
    ),
    membraneSource: "proxy-from-localNc",
    detachmentSource: detachmentMetrics?.provenance || "unknown",
  };
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
            nativeGap: entry.nativeGap ?? 0,
            contactFraction: entry.contactFraction ?? 0,
            peakNormal: entry.normalStress,
            peakShear: entry.shearStress,
            sourceNormal: entry.sourceNormal || "unknown",
            sourceDamage: entry.sourceDamage || "unknown",
            sourceShear: entry.sourceShear || "unknown",
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
            nativeGap: entry.nativeGap ?? 0,
            contactFraction: entry.contactFraction ?? 0,
            peakNormal: entry.normalStress,
            peakShear: entry.shearStress,
            sourceNormal: entry.sourceNormal || "unknown",
            sourceDamage: entry.sourceDamage || "unknown",
            sourceShear: entry.sourceShear || "unknown",
          }
        : createLocalRegionState();
    });
    const membraneRegions = buildMembraneProxy(ncState, inputSpec.membrane);
    const damageNc = Math.max(...Object.values(ncState).map((state) => state.damage), 0);
    const damageCd = Math.max(...Object.values(cdState).map((state) => state.damage), 0);
    const damageMembrane = Math.max(...Object.values(membraneRegions).map((state) => state.damage), 0);
    const membraneStress = Math.max(...Object.values(membraneRegions).map((state) => state.stress), 0);
    const aspirationLength = computeAspirationLength(nucleusValues, cellValues);
    const detachmentMetrics = buildDetachmentMetricsFromLocalState(ncState, {
      nucleus: Math.hypot(nucleusValues[0] || 0, nucleusValues[1] || 0),
    });

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
      detachmentMetrics,
      aspirationLength,
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

function buildLegacyParamsFromNativeSpec(nativeSpec = {}) {
  return {
    Ln: nativeSpec.geometry?.nucleus?.width,
    Hn: nativeSpec.geometry?.nucleus?.height,
    Lc: nativeSpec.geometry?.cytoplasm?.width,
    Hc: nativeSpec.geometry?.cytoplasm?.height,
    xn: nativeSpec.geometry?.nucleus?.center?.x,
    yn: nativeSpec.geometry?.nucleus?.center?.z,
    rp: nativeSpec.geometry?.pipette?.radius,
    xp: nativeSpec.geometry?.pipette?.tip?.x,
    zp: nativeSpec.geometry?.pipette?.tip?.z,
    En: nativeSpec.materials?.nucleus?.E,
    nun: nativeSpec.materials?.nucleus?.nu,
    etan: nativeSpec.materials?.nucleus?.eta,
    alpha_nonlinear: nativeSpec.materials?.nucleus?.alphaNonlinear,
    Ec: nativeSpec.materials?.cytoplasm?.E,
    nuc: nativeSpec.materials?.cytoplasm?.nu,
    etac: nativeSpec.materials?.cytoplasm?.eta,
    Kn_nc: nativeSpec.contacts?.nucleusCytoplasm?.normalStiffness,
    Kt_nc: nativeSpec.contacts?.nucleusCytoplasm?.tangentialStiffness,
    sig_nc_crit: nativeSpec.contacts?.nucleusCytoplasm?.criticalNormalStress,
    tau_nc_crit: nativeSpec.contacts?.nucleusCytoplasm?.criticalShearStress,
    Gc_nc: nativeSpec.contacts?.nucleusCytoplasm?.fractureEnergy,
    Kn_cd: nativeSpec.contacts?.cellDish?.normalStiffness,
    Kt_cd: nativeSpec.contacts?.cellDish?.tangentialStiffness,
    sig_cd_crit: nativeSpec.contacts?.cellDish?.criticalNormalStress,
    tau_cd_crit: nativeSpec.contacts?.cellDish?.criticalShearStress,
    Gc_cd: nativeSpec.contacts?.cellDish?.fractureEnergy,
    Fhold: nativeSpec.loads?.holdForceProxy?.value,
    P_hold: Math.abs(Number(nativeSpec.loads?.suctionPressure?.value || 0)),
    dz_lift: nativeSpec.boundary?.pipetteMotion?.liftZ,
    dx_inward: nativeSpec.boundary?.pipetteMotion?.inwardX,
    ds_tangent: nativeSpec.boundary?.pipetteMotion?.tangentY,
    mu_p: nativeSpec.contacts?.pipetteNucleus?.friction,
    contact_tol: nativeSpec.contacts?.pipetteNucleus?.searchTolerance,
  };
}

function buildResultFromLogs(sandbox, payload, runDir) {
  const nativeSpec = payload.nativeSpec || payload.inputSpec?.nativeSpec || payload.exportBundle?.nativeSpec || null;
  const nativeTemplateData = payload.templateData || payload.exportBundle?.templateData || null;
  const canonicalSpec = payload.canonicalSpec || payload.inputSpec || payload.exportBundle?.canonicalSpec || null;
  const isNativeDirectInput = Boolean(nativeSpec && nativeTemplateData);
  const caseName = nativeSpec?.caseName || canonicalSpec?.caseName || payload.caseName || "A";
  const params = isNativeDirectInput
    ? buildLegacyParamsFromNativeSpec(nativeSpec)
    : canonicalSpec?.params || payload.params || {};
  const inputSpec = sandbox.buildSimulationInput(caseName, params);
  if (isNativeDirectInput && (payload.parameterDigest || payload.exportBundle?.parameterDigest)) {
    inputSpec.parameterDigest = payload.parameterDigest || payload.exportBundle.parameterDigest;
  } else if (canonicalSpec?.parameterDigest) {
    inputSpec.parameterDigest = canonicalSpec.parameterDigest;
  }
  const templateData = isNativeDirectInput
    ? nativeTemplateData
    : sandbox.buildFebioInputSpec(caseName, params, inputSpec).febioTemplateData;
  const logs = buildSnapshotsByName(runDir, getLogOutputSpecs(templateData));
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
    const fallback = computeRegionInterfaceState(
      region,
      logs[mapped.nucleusNodeSet] || [],
      logs[mapped.cytoplasmNodeSet] || [],
      params,
      templateData.interfaces.nucleusCytoplasm,
    );
    const computed = computeFaceDrivenInterfaceState(
      region,
      logs[`nucleus_cytoplasm_${region}_surface`] || [],
      fallback,
      templateData.interfaces.nucleusCytoplasm,
      pickPlotfileSurfaceSeries(payload, "localNc", region),
    );
    localNc[region] = computed.state;
    localNcTimeline[region] = computed.timeline;
  }

  for (const region of ["left", "center", "right"]) {
    const mapped = templateData.interfaceRegions.localCd[region];
    const computed = computeCellDishRegionStateWithFace(
      region,
      logs[mapped.cellNodeSet] || [],
      logs[`cell_dish_${region}_surface`] || [],
      templateData.interfaces.cellDish,
      pickPlotfileSurfaceSeries(payload, "localCd", region),
    );
    localCd[region] = computed.state;
    localCdTimeline[region] = computed.timeline;
  }

  const membraneRegions = buildMembraneProxy(localNc, inputSpec.membrane);
  const localNcSourceSummary = summarizeRegionSources(localNc);
  const localCdSourceSummary = summarizeRegionSources(localCd);
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
    const rigidState = getRigidPipetteState(snapshot, { x: 0, y: 0 });
    return Math.max(maxValue, Math.hypot(rigidState.reaction.x, rigidState.reaction.z));
  }, 0);
  const displacements = {
    nucleus: Math.hypot(lastNucleus[0] || 0, lastNucleus[1] || 0),
    cell: Math.hypot(lastCell[0] || 0, lastCell[1] || 0),
    tangentCell: 0,
    tangentNucleus: 0,
  };
  const detachmentMetrics = buildDetachmentMetricsFromLocalState(localNc, displacements);
  const history = buildHistoryFromSnapshots(
    sandbox,
    inputSpec,
    templateData,
    nucleusSeries,
    cellSeries,
    rigidSeries,
    localNcTimeline,
    localCdTimeline,
  );
  const peakAspirationLength = history.reduce(
    (maxValue, entry) => Math.max(maxValue, Number(entry.aspirationLength || 0)),
    0,
  );
  const aspiration = {
    length: history.length ? Number(history[history.length - 1].aspirationLength || 0) : 0,
    peakLength: peakAspirationLength,
    unit: outputMapping.aspiration.unit,
    source: outputMapping.aspiration.source,
    pressure: nativeSpec?.loads?.suctionPressure?.magnitude ?? canonicalSpec?.operation?.P_hold ?? params.P_hold ?? null,
    pressureUnit: nativeSpec?.loads?.suctionPressure?.unit || canonicalSpec?.coordinates?.pressureUnit || "kPa",
    mapping: outputMapping.aspiration,
  };
  const interfaceObservationSummary = buildInterfaceObservationSummary(
    outputMapping,
    localNc,
    localCd,
    detachmentMetrics,
  );

  const damage = {
    nc: Math.max(...Object.values(localNc).map((state) => state.damage), 0),
    cd: Math.max(...Object.values(localCd).map((state) => state.damage), 0),
    membrane: Math.max(...Object.values(membraneRegions).map((state) => state.damage), 0),
  };

  const result = {
    caseName,
    params: sandbox.structuredClone(params),
    ...(nativeSpec ? { nativeSpec: sandbox.structuredClone(nativeSpec) } : {}),
    parameterDigest: inputSpec.parameterDigest,
    schedule: inputSpec.schedule,
    history,
    events: {},
    damage,
    peaks: {
      peakNcNormal: Math.max(...Object.values(localNc).map((state) => state.peakNormal), 0),
      peakNcShear: Math.max(...Object.values(localNc).map((state) => state.peakShear), 0),
      peakCdNormal: Math.max(...Object.values(localCd).map((state) => state.peakNormal), 0),
      peakCdShear: Math.max(...Object.values(localCd).map((state) => state.peakShear), 0),
      peakContactForce: maxContactForce,
      peakHoldForce: maxContactForce,
      peakAspirationLength,
      peakMembraneStrain: Math.max(...Object.values(membraneRegions).map((state) => state.stress), 0),
      peakCytoplasmStress: Math.max(...Object.values(localCd).map((state) => state.peakNormal), 0),
      peakMomentProxy: maxContactForce * Math.abs(params.xp || 0),
    },
    localNc,
    localCd,
    membraneRegions,
    displacements,
    detachmentMetrics,
    aspiration,
    captureEstablished: maxContactForce > 0.05,
    captureMaintained: maxContactForce > 0.05,
    isPhysicalFebioResult: true,
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
    interfaceObservation: {
      localNcSource: localNcSourceSummary,
      localCdSource: localCdSourceSummary,
      localNc: interfaceObservationSummary.localNc,
      localCd: interfaceObservationSummary.localCd,
      membraneSource: "proxy-from-localNc",
      detachmentSource: detachmentMetrics.provenance,
    },
    resultProvenance: {
      source: "febio-cli",
      parameterDigest: inputSpec.parameterDigest,
      exportTimestamp: payload.exportBundle?.exportTimestamp || payload.generatedAt || null,
      importTimestamp: new Date().toISOString(),
      digestMatch:
        isNativeDirectInput && (payload.parameterDigest || payload.exportBundle?.parameterDigest)
          ? (payload.parameterDigest || payload.exportBundle.parameterDigest) === inputSpec.parameterDigest
          : canonicalSpec?.parameterDigest
            ? canonicalSpec.parameterDigest === inputSpec.parameterDigest
            : null,
      fileProvenance: {
        runDirectory: runDir,
        inputJsonPath: payload.files?.inputJson || null,
      },
      dataSources: {
        localNc: localNcSourceSummary,
        localCd: localCdSourceSummary,
        aspiration: aspiration.source,
        membrane: "proxy-from-localNc",
        detachment: detachmentMetrics.provenance,
      },
      interfaceObservation: interfaceObservationSummary,
      aspiration,
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

  attachExplicitDetachmentEvents(
    result,
    typeof sandbox.assessDetachmentExplicit === "function"
      ? (snapshot) => sandbox.assessDetachmentExplicit(snapshot)
      : null,
  );

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

async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDir, "..");
  const sandbox = await loadCanonicalRuntime(projectRoot);
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
        isPhysicalFebioResult: true,
        parameterDigest: normalizedResult.parameterDigest,
        canonicalSpec: inputPayload.canonicalSpec || inputPayload.inputSpec || null,
        exportTimestamp: inputPayload.exportBundle?.exportTimestamp || inputPayload.generatedAt || null,
        importTimestamp: new Date().toISOString(),
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
  return outputPath;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  });
}

export {
  attachExplicitDetachmentEvents,
  assessDetachmentSnapshot,
  buildDetachmentMetricsFromLocalState,
  buildOutputMappingSummary,
  computeTangentialTractionFromPlotfileBridge,
  computeTangentialTractionFromFaceSnapshot,
  getRigidPipetteState,
  inferFaceSnapshotValueOffset,
  resolveTangentialShearObservation,
  buildResultFromLogs,
  runCli,
};
