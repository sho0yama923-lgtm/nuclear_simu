/* Legacy field bootstrap retained only as migration history.
   The stabilized field/schema path starts below with buildFieldGroups().
const FIELD_GROUPS = {
  geometry: [
    ["Ln", "核の長径", 28],
    ["Hn", "核の短径", 18],
    ["Lc", "細胞幅", 52],
    ["Hc", "細胞高さ", 34],
    ["xn", "核中心 x", 0],
    ["yn", "核中心 y", 17],
    ["rp", "ピペット半径", 6.5],
    ["xp", "作用点 x", 4.5],
    ["yp", "作用点 y", 8.5],
  ],
  material: [
    ["En", "核ヤング率", 20],
    ["nun", "核ポアソン比", 0.34],
    ["etan", "核粘性", 4.2],
    ["alpha_nonlinear", "核非線形係数", 0.12],
    ["Ec", "細胞質ヤング率", 7.5],
    ["nuc", "細胞質ポアソン比", 0.41],
    ["etac", "細胞質粘性", 5.6],
    ["Tm", "膜張力", 4.7],
    ["sig_m_crit", "膜破断応力", 1.55],
    ["sig_m_crit_top", "膜破断応力 top_neck", 1.05],
    ["sig_m_crit_side", "膜破断応力 side", 1.55],
    ["sig_m_crit_basal", "膜破断応力 basal", 1.85],
  ],
  interfaces: [
    ["Kn_nc", "核-細胞質 法線剛性", 1.35],
    ["Kt_nc", "核-細胞質 せん断剛性", 1.05],
    ["sig_nc_crit", "核-細胞質 法線閾値", 0.78],
    ["tau_nc_crit", "核-細胞質 せん断閾値", 0.58],
    ["Gc_nc", "核-細胞質 破壊エネルギー", 0.28],
    ["Kn_cd", "細胞-ディッシュ 法線剛性", 1.55],
    ["Kt_cd", "細胞-ディッシュ せん断剛性", 1.25],
    ["sig_cd_crit", "細胞-ディッシュ 法線閾値", 0.95],
    ["tau_cd_crit", "細胞-ディッシュ せん断閾値", 0.65],
    ["Gc_cd", "細胞-ディッシュ 破壊エネルギー", 0.35],
    [
      "adhesionPattern",
      "接着分布",
      "uniform",
      {
        type: "select",
        options: [
          ["uniform", "uniform"],
          ["center_strong", "center_strong"],
          ["edge_strong", "edge_strong"],
          ["random_patchy", "random_patchy"],
        ],
      },
    ],
    ["adhesionSeed", "接着 seed", 17, { step: 1 }],
  ],
  operation: [
    ["Fhold", "保持力", 20],
    ["P_hold", "保持圧", 0.7],
    ["dz_lift", "引き上げ量", 8],
    ["dx_inward", "重心側移動量", 4],
    ["ds_tangent", "接線移動量", 7.5],
    ["dx_outward", "外向き移動量", 3],
    ["mu_p", "ピペット摩擦", 0.26],
    ["contact_tol", "捕捉許容距離", 2.2],
  ],
};

function normalizeFieldEntry(entry) {
  const [key, label, value, meta = {}] = entry;
  return {
    key,
    label,
    value,
    type: meta.type || (typeof value === "number" ? "number" : "text"),
    options: meta.options || [],
    step: meta.step ?? 0.01,
    hint: meta.hint || "",
  };
}

const DEFAULTS = Object.fromEntries(
  Object.values(FIELD_GROUPS)
    .flat()
    .map((entry) => {
      const field = normalizeFieldEntry(entry);
      return [field.key, field.value];
    }),
);

FIELD_GROUPS.geometry = FIELD_GROUPS.geometry.map((entry) =>
  entry[0] === "xp"
    ? ["xp", "穿刺位置 x", entry[2], { hint: "核中心を通る横線を x 軸とした x 座標" }]
    : entry[0] === "yp"
      ? ["yp", "穿刺位置 y", entry[2], { hint: "同じ座標系での y 座標。核外縁ではなく核内点も指定可能" }]
      : entry,
);

FIELD_GROUPS.geometry = FIELD_GROUPS.geometry.map((entry) =>
  entry[0] === "yp"
    ? ["zp", "穿刺位置 z", entry[2], { hint: "設定値は x と z のみを使用。内部では回転対称な同等点として y 相当へ写像" }]
    : entry,
);

FIELD_GROUPS.geometry = FIELD_GROUPS.geometry.map((entry) =>
  entry[0] === "xp"
    ? ["xp", "穿刺位置 x", entry[2], { hint: "上面図では核中心を通る水平線上の x 座標として扱います" }]
    : entry[0] === "zp"
      ? ["zp", "穿刺高さ z", entry[2], { hint: "断面図での穿刺高さ。上面図では中央水平線上の同等点へ対応づけます" }]
      : entry,
);

if ("yp" in DEFAULTS && !("zp" in DEFAULTS)) {
  DEFAULTS.zp = DEFAULTS.yp;
  delete DEFAULTS.yp;
}

const TOP_OPERATION_KEYS = new Set(["xp", "zp"]);
const prioritizedOperationEntries = FIELD_GROUPS.geometry.filter(([key]) => TOP_OPERATION_KEYS.has(key));
FIELD_GROUPS.geometry = FIELD_GROUPS.geometry.filter(([key]) => !TOP_OPERATION_KEYS.has(key));
FIELD_GROUPS.operation = [...prioritizedOperationEntries, ...FIELD_GROUPS.operation];
FIELD_GROUPS.operation = FIELD_GROUPS.operation.map((entry) =>
  entry[0] === "xp"
    ? ["xp", "\u7a7f\u523a\u4f4d\u7f6e x", entry[2], { hint: "\u4e0a\u9762\u56f3\u3067\u306f\u6838\u4e2d\u5fc3\u3092\u901a\u308b\u6c34\u5e73\u7dda\u4e0a\u306e x \u5ea7\u6a19\u3068\u3057\u3066\u6271\u3044\u307e\u3059" }]
    : entry[0] === "zp"
      ? ["zp", "\u7a7f\u523a\u9ad8\u3055 z", entry[2], { hint: "\u65ad\u9762\u56f3\u3067\u306e\u7a7f\u523a\u9ad8\u3055\u3002\u4e0a\u9762\u56f3\u3067\u306f\u4e2d\u592e\u6c34\u5e73\u7dda\u4e0a\u306e\u540c\u7b49\u70b9\u3078\u5bfe\u5fdc\u3065\u3051\u307e\u3059" }]
      : entry,
);

function overrideFieldEntries(entries, overrides) {
  return entries.map((entry) => {
    const [key, label, value, meta = {}] = entry;
    const override = overrides[key];
    if (!override) {
      return entry;
    }
    return [
      key,
      override.label || label,
      value,
      {
        ...meta,
        ...(override.hint ? { hint: override.hint } : {}),
      },
    ];
  });
}

FIELD_GROUPS.geometry = overrideFieldEntries(FIELD_GROUPS.geometry, {
  Ln: {
    label: "\u6838\u5e45 x",
    hint: "\u65ad\u9762 x-z \u9762\u3067\u306e\u6838\u5e45\u3002\u4e0a\u9762\u56f3\u306e xy \u9762\u3067\u3082\u540c\u3058\u4ee3\u8868\u5f84\u3068\u3057\u3066\u4f7f\u3044\u307e\u3059",
  },
  Hn: {
    label: "\u6838\u9ad8\u3055 z",
    hint: "\u30c7\u30a3\u30c3\u30b7\u30e5\u9762\u3092 z = 0 \u3068\u3057\u305f\u3068\u304d\u306e\u65ad\u9762\u65b9\u5411\u306e\u6838\u306e\u9ad8\u3055\u3067\u3059",
  },
  Lc: {
    label: "\u7d30\u80de\u5e45 x",
    hint: "\u65ad\u9762 x-z \u9762\u3067\u306e\u7d30\u80de\u5e45\u3067\u3059",
  },
  Hc: {
    label: "\u7d30\u80de\u9ad8\u3055 z",
    hint: "\u30c7\u30a3\u30c3\u30b7\u30e5\u9762\u3092 z = 0 \u3068\u3057\u305f\u3068\u304d\u306e\u7d30\u80de\u4e0a\u65b9\u5411\u306e\u9ad8\u3055\u3067\u3059",
  },
  xn: {
    label: "\u6838\u4e2d\u5fc3 x",
    hint: "\u4e0a\u9762\u56f3 xy \u5ea7\u6a19\u7cfb\u306e x \u5ea7\u6a19\u3067\u3059",
  },
  yn: {
    label: "\u6838\u4e2d\u5fc3 z",
    hint: "\u30c7\u30a3\u30c3\u30b7\u30e5\u9ad8\u3055 0 \u3092\u57fa\u6e96\u306b\u3057\u305f\u6838\u4e2d\u5fc3\u306e z \u5ea7\u6a19\u3067\u3059",
  },
  rp: {
    label: "\u30d4\u30da\u30c3\u30c8\u534a\u5f84",
    hint: "\u30d4\u30da\u30c3\u30c8\u5148\u7aef\u306e\u6709\u52b9\u534a\u5f84\u3067\u3059",
  },
});

FIELD_GROUPS.operation = overrideFieldEntries(FIELD_GROUPS.operation, {
  dz_lift: {
    label: "\u5f15\u304d\u4e0a\u3052\u91cf z",
    hint: "\u65ad\u9762 x-z \u9762\u3067\u306e z \u65b9\u5411\u5f15\u304d\u4e0a\u3052\u91cf\u3067\u3059",
  },
  dx_inward: {
    label: "\u91cd\u5fc3\u5074\u79fb\u52d5 x",
    hint: "\u4e0a\u9762\u56f3 xy \u9762\u3067\u306e x \u65b9\u5411\u79fb\u52d5\u3067\u3059",
  },
  ds_tangent: {
    label: "\u63a5\u7dda\u79fb\u52d5 y",
    hint: "\u4e0a\u9762\u56f3 xy \u9762\u3067 x \u3068\u76f4\u4ea4\u3059\u308b y \u65b9\u5411\u79fb\u52d5\u3067\u3059",
  },
  dx_outward: {
    label: "\u5916\u65b9\u5411\u79fb\u52d5 x",
    hint: "\u4e0a\u9762\u56f3 xy \u9762\u3067\u91cd\u5fc3\u5074\u3068\u53cd\u5bfe\u5411\u304d\u306e x \u79fb\u52d5\u3067\u3059",
  },
});

const GEOMETRY_SCHEMA_KEYS = ["Ln", "Hn", "Lc", "Hc", "xn", "yn", "rp", "xp", "zp"];
const OPERATION_SCHEMA_KEYS = FIELD_GROUPS.operation
  .map(([key]) => key)
  .filter((key) => !TOP_OPERATION_KEYS.has(key));

*/

// -----------------------------------------------------------------------------
// field/schema layer
// -----------------------------------------------------------------------------

const PINNED_OPERATION_KEYS = ["xp", "zp"];

function normalizeFieldEntry(entry) {
  const [key, label, value, meta = {}] = entry;
  return {
    key,
    label,
    value,
    type: meta.type || (typeof value === "number" ? "number" : "text"),
    options: meta.options || [],
    step: meta.step ?? 0.01,
    hint: meta.hint || "",
  };
}

function buildFieldGroups() {
  const geometry = [
    ["Ln", "\u6838\u5e45 x", 28, { hint: "\u65ad\u9762 x-z \u9762\u3067\u306e\u6838\u5e45\u3002\u4e0a\u9762\u56f3 xy \u9762\u3067\u306f\u4ee3\u8868\u5f84\u3068\u3057\u3066\u6271\u3044\u307e\u3059" }],
    ["Hn", "\u6838\u9ad8\u3055 z", 18, { hint: "\u30c7\u30a3\u30c3\u30b7\u30e5\u9762\u3092 z = 0 \u3068\u3057\u305f\u3068\u304d\u306e\u6838\u306e\u9ad8\u3055\u3067\u3059" }],
    ["Lc", "\u7d30\u80de\u5e45 x", 52, { hint: "\u65ad\u9762 x-z \u9762\u3067\u306e\u7d30\u80de\u5e45\u3067\u3059" }],
    ["Hc", "\u7d30\u80de\u9ad8\u3055 z", 34, { hint: "\u30c7\u30a3\u30c3\u30b7\u30e5\u9762\u3092 z = 0 \u3068\u3057\u305f\u3068\u304d\u306e\u7d30\u80de\u306e\u9ad8\u3055\u3067\u3059" }],
    ["xn", "\u6838\u4e2d\u5fc3 x", 0, { hint: "\u4e0a\u9762\u56f3 xy \u5ea7\u6a19\u7cfb\u306e x \u5ea7\u6a19\u3067\u3059" }],
    ["yn", "\u6838\u4e2d\u5fc3 z", 17, { hint: "\u30c7\u30a3\u30c3\u30b7\u30e5\u9762\u3092 z = 0 \u3068\u3057\u305f\u3068\u304d\u306e\u6838\u4e2d\u5fc3 z \u5ea7\u6a19\u3067\u3059" }],
    ["rp", "\u30d4\u30da\u30c3\u30c8\u534a\u5f84", 6.5, { hint: "\u30d4\u30da\u30c3\u30c8\u5148\u7aef\u306e\u6709\u52b9\u534a\u5f84\u3067\u3059" }],
    ["xp", "\u7a7f\u523a\u4f4d\u7f6e x", 4.5, { hint: "\u4e0a\u9762\u56f3\u3067\u306e x \u5ea7\u6a19\u3002\u5185\u90e8 solver \u306e hold \u70b9\u306b\u76f4\u63a5\u53cd\u6620\u3057\u307e\u3059" }],
    ["zp", "\u7a7f\u523a\u9ad8\u3055 z", 8.5, { hint: "\u65ad\u9762 x-z \u9762\u3067\u306e z \u5ea7\u6a19\u3067\u3059" }],
  ];
  const material = [
    ["En", "En", 3.0],
    ["nun", "nu_n", 0.4],
    ["etan", "eta_n", 5.0],
    ["alpha_nonlinear", "alpha_nonlinear", 0.1],
    ["Ec", "Ec", 1.0],
    ["nuc", "nu_c", 0.45],
    ["etac", "eta_c", 3.0],
    ["Tm", "Tm", 0.2],
    ["sig_m_crit", "sig_m_crit", 1.0],
    ["sig_m_crit_top", "sig_m_crit_top", 0.8],
    ["sig_m_crit_side", "sig_m_crit_side", 1.0],
    ["sig_m_crit_basal", "sig_m_crit_basal", 1.2],
  ];
  const interfaces = [
    ["Kn_nc", "Kn_nc", 1.0],
    ["Kt_nc", "Kt_nc", 0.8],
    ["sig_nc_crit", "sig_nc_crit", 0.4],
    ["tau_nc_crit", "tau_nc_crit", 0.25],
    ["Gc_nc", "Gc_nc", 0.1],
    ["Kn_cd", "Kn_cd", 3.0],
    ["Kt_cd", "Kt_cd", 2.0],
    ["sig_cd_crit", "sig_cd_crit", 2.0],
    ["tau_cd_crit", "tau_cd_crit", 1.0],
    ["Gc_cd", "Gc_cd", 1.0],
    ["adhesionPattern", "adhesionPattern", "uniform", { type: "select", options: [["uniform", "uniform"], ["center_strong", "center_strong"], ["edge_strong", "edge_strong"], ["random_patchy", "random_patchy"]] }],
    ["adhesionSeed", "adhesionSeed", 17, { step: 1 }],
  ];
  const operation = [
    ["Fhold", "\u4fdd\u6301\u529b", 20],
    ["P_hold", "\u4fdd\u6301\u5727", 0.7],
    ["dz_lift", "\u5f15\u304d\u4e0a\u3052\u91cf z", 8, { hint: "\u65ad\u9762 x-z \u9762\u3067\u306e z \u65b9\u5411\u79fb\u52d5\u3067\u3059" }],
    ["dx_inward", "\u91cd\u5fc3\u5074\u79fb\u52d5 x", 4, { hint: "\u4e0a\u9762\u56f3 xy \u9762\u3067\u306e -x \u79fb\u52d5\u3067\u3059" }],
    ["ds_tangent", "\u63a5\u7dda\u79fb\u52d5 y", 7.5, { hint: "\u4e0a\u9762\u56f3 xy \u9762\u3067\u306e +y \u79fb\u52d5\u3067\u3059" }],
    ["dx_outward", "\u5916\u65b9\u5411\u79fb\u52d5 x", 3, { hint: "\u4e0a\u9762\u56f3 xy \u9762\u3067\u306e +x \u79fb\u52d5\u3067\u3059" }],
    ["mu_p", "\u30d4\u30da\u30c3\u30c8\u6469\u64e6", 0.26],
    ["contact_tol", "\u6355\u6349\u8a31\u5bb9\u8ddd\u96e2", 2.2],
  ];
  const pinnedGeometry = geometry.filter(([key]) => PINNED_OPERATION_KEYS.includes(key));
  return {
    geometry: geometry.filter(([key]) => !PINNED_OPERATION_KEYS.includes(key)),
    material,
    interfaces,
    operation: [...pinnedGeometry, ...operation],
  };
}

function createDefaultParams(fieldGroups) {
  return Object.fromEntries(
    Object.values(fieldGroups)
      .flat()
      .map((entry) => {
        const field = normalizeFieldEntry(entry);
        return [field.key, field.value];
      }),
  );
}

const FIELD_GROUPS = buildFieldGroups();
const DEFAULTS = createDefaultParams(FIELD_GROUPS);
const GEOMETRY_SCHEMA_KEYS = ["Ln", "Hn", "Lc", "Hc", "xn", "yn", "rp", "xp", "zp"];
const OPERATION_SCHEMA_KEYS = FIELD_GROUPS.operation
  .map(([key]) => key)
  .filter((key) => !PINNED_OPERATION_KEYS.includes(key));

// World coordinates exposed to the user and external solver adapters:
// - top view is the x-y plane centered on the nucleus
// - section view is the x-z plane
// - dish height is z = 0
// Internal reduced-order state still stores the section vertical axis in `.y`
// for historical reasons, so `.y` in the solver corresponds to world `z`.
const COORDINATE_SYSTEM_SPEC = {
  topViewPlane: "xy",
  sectionPlane: "xz",
  heightAxis: "z",
  heightOrigin: "dish_top_at_z0",
  legacyInternalVerticalAxis: "y_means_world_z",
};

function getWorldZ(point) {
  return point.y;
}

function setWorldZ(point, z) {
  point.y = z;
  return point;
}

function makeSectionPoint(x, z) {
  return { x, y: z };
}

function getSectionX(point) {
  return point.x;
}

const NUMERICS = {
  dt: 0.04,
  phase0Duration: 1.5,
  phase1Duration: 1.6,
  phase2Duration: 1.2,
  phase3Duration: 2.1,
  phase4Duration: 0.9,
  dampingNucleus: 8.5,
  dampingCell: 11.5,
  holdStiffness: 0.82,
  bulkNucleus: 0.4,
  bulkCell: 0.18,
  compressivePenalty: 3.2,
  damageRateNc: 0.21,
  damageRateCd: 0.18,
  damageRateMembrane: 0.12,
  damageProgressThreshold: 0.5,
  nucleusMobility: 4.2,
  cellMobility: 1.8,
};

const APP_SCHEMA_VERSION = "2026.04-solver-abstraction";
const SOLVER_MODES = ["lightweight", "febio"];
const NC_REGIONS = ["right", "left", "top", "bottom"];
const CD_REGIONS = ["left", "center", "right"];
const MEMBRANE_REGIONS = ["top_neck", "side", "basal"];

const CASE_DESCRIPTIONS = {
  A: {
    label: "inward-driven shear",
    summary: "重心側へ引いて核-細胞質界面の局所せん断を直接評価します。",
  },
  B: {
    label: "tangential moment-driven detachment",
    summary: "面外接線移動による回転モーメントで反対側界面の損傷を評価します。",
  },
  C: {
    label: "mixed strategy",
    summary: "重心側微小移動のあとに面外接線を加える複合戦略です。",
  },
};

const OUTCOME_STYLES = {
  nucleus_detached: "success",
  cell_attached_to_tip: "warn",
  deformation_only: "warn",
  missed_target: "danger",
  insufficient_hold: "warn",
  early_slip: "danger",
  no_capture_general: "danger",
};

const METRIC_KEYS = [
  ["peakNucleusStress", "核の最大応力代理指標"],
  ["peakCytoplasmStress", "細胞質の最大応力代理指標"],
  ["peakMembraneStress", "膜の最大応力代理指標"],
  ["peakMembraneStrain", "膜の最大ひずみ代理指標"],
  ["peakNcNormal", "核-細胞質 法線応力最大値"],
  ["peakNcShear", "核-細胞質 せん断応力最大値"],
  ["peakCdNormal", "細胞-ディッシュ 法線応力最大値"],
  ["peakCdShear", "細胞-ディッシュ せん断応力最大値"],
  ["peakHoldForce", "保持力最大値"],
  ["peakContactAngle", "接触角最大値"],
  ["peakHoldStiffnessEffective", "有効保持剛性最大値"],
];

const COLORS = {
  nucleus: "#c16d46",
  cytoplasm: "#5f9194",
  membrane: "#d23737",
  pipette: "#69419b",
  nc: "#b45732",
  cd: "#2b6d73",
  membraneStress: "#8b2f2f",
  displacement: "#6d4f8a",
  cellDisp: "#2d7f85",
  nucleusDisp: "#bb623b",
  dish: "#dfd1b0",
  dishLine: "#bda883",
};

const elements = {
  scene: document.querySelector("#scene"),
  topView: document.querySelector("#top-view"),
  playbackToggle: document.querySelector("#playback-toggle"),
  playbackReset: document.querySelector("#playback-reset"),
  playbackSlider: document.querySelector("#playback-slider"),
  playbackStatus: document.querySelector("#playback-status"),
  summaryBand: document.querySelector("#summary-band"),
  classificationCard: document.querySelector("#classification-card"),
  eventLog: document.querySelector("#event-log"),
  metricsTable: document.querySelector("#metrics-table"),
  timelineTable: document.querySelector("#timeline-table"),
  stressChart: document.querySelector("#stress-chart"),
  motionChart: document.querySelector("#motion-chart"),
  comparisonTable: document.querySelector("#comparison-table"),
  sweepResults: document.querySelector("#sweep-results"),
  localBreakdown: document.querySelector("#local-breakdown"),
  sweepParameter: document.querySelector("#sweep-parameter"),
  sweepStart: document.querySelector("#sweep-start"),
  sweepEnd: document.querySelector("#sweep-end"),
  sweepSteps: document.querySelector("#sweep-steps"),
  sweepCase: document.querySelector("#sweep-case"),
  solverMode: document.querySelector("#solver-mode"),
  exportFebioJson: document.querySelector("#export-febio-json"),
  exportFebioXml: document.querySelector("#export-febio-xml"),
  exportFebioHandoff: document.querySelector("#export-febio-handoff"),
  importResult: document.querySelector("#import-result"),
  importResultFile: document.querySelector("#import-result-file"),
  runCaseA: document.querySelector("#run-case-a"),
  runCaseB: document.querySelector("#run-case-b"),
  runCaseC: document.querySelector("#run-case-c"),
  runAll: document.querySelector("#run-all"),
  runSweep: document.querySelector("#run-sweep"),
  resetDefaults: document.querySelector("#reset-defaults"),
};

const appState = {
  params: structuredClone(DEFAULTS),
  latest: null,
  comparisonRuns: [],
  sweepRuns: [],
  ui: {
    selectedCase: "C",
    selectedMode: "case",
    solverMode: "lightweight",
  },
  playback: {
    frameIndex: 0,
    isPlaying: false,
    rafId: null,
    lastTimestamp: 0,
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(vector, factor) {
  return { x: vector.x * factor, y: vector.y * factor };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function lengthOf(vector) {
  return Math.hypot(vector.x, vector.y);
}

function normalize(vector) {
  const length = lengthOf(vector) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function rotate90(vector) {
  return { x: -vector.y, y: vector.x };
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  return value.toFixed(digits);
}

function setActiveClass(element, isActive) {
  if (!element) {
    return;
  }
  if (element.classList && typeof element.classList.toggle === "function") {
    element.classList.toggle("is-active", isActive);
  } else {
    const classNames = String(element.className || "")
      .split(/\s+/)
      .filter(Boolean)
      .filter((name) => name !== "is-active");
    if (isActive) {
      classNames.push("is-active");
    }
    element.className = classNames.join(" ");
  }
  element.setAttribute?.("aria-pressed", isActive ? "true" : "false");
}

function syncRunButtons() {
  const isCaseMode = appState.ui.selectedMode === "case";
  setActiveClass(elements.runCaseA, isCaseMode && appState.ui.selectedCase === "A");
  setActiveClass(elements.runCaseB, isCaseMode && appState.ui.selectedCase === "B");
  setActiveClass(elements.runCaseC, isCaseMode && appState.ui.selectedCase === "C");
  setActiveClass(elements.runAll, appState.ui.selectedMode === "all");
  setActiveClass(elements.runSweep, appState.ui.selectedMode === "sweep");
}

function syncSolverModeControl() {
  if (elements.solverMode) {
    elements.solverMode.value = appState.ui.solverMode;
  }
}

function getCellRest(params) {
  // Internal `.y` is the section vertical axis, which corresponds to world z.
  return makeSectionPoint(0, params.Hc * 0.52);
}

function getNucleusRest(params) {
  // Internal `.y` is the section vertical axis, which corresponds to world z.
  return makeSectionPoint(params.xn, params.yn);
}

function createField(containerId, entries) {
  const container = document.querySelector(`#${containerId}`);
  container.innerHTML = "";
  entries.forEach((entry) => {
    const field = normalizeFieldEntry(entry);
    const wrapper = document.createElement("label");
    if (field.type === "select") {
      wrapper.innerHTML = `
        <span>${field.label}</span>
        <select id="field-${field.key}">
          ${field.options
            .map(([optionValue, optionLabel]) => {
              const selected = optionValue === field.value ? "selected" : "";
              return `<option value="${optionValue}" ${selected}>${optionLabel}</option>`;
            })
            .join("")}
        </select>
        ${field.hint ? `<small class="field-hint">${field.hint}</small>` : ""}
      `;
    } else {
      wrapper.innerHTML = `
        <span>${field.label}</span>
        <input id="field-${field.key}" type="${field.type}" step="${field.step}" value="${field.value}" />
        ${field.hint ? `<small class="field-hint">${field.hint}</small>` : ""}
      `;
    }
    container.appendChild(wrapper);
  });
}

function setControlGroupTitle(containerId, title) {
  const heading = document.querySelector(`#${containerId}`)?.closest(".control-group")?.querySelector("h2");
  if (heading) {
    heading.textContent = title;
  }
}

function organizeWorkspaceLayout() {
  document.querySelector(".controls > .panel-header")?.remove();
  document.querySelector(".subcanvas-copy")?.remove();

  const canvasPanel = document.querySelector(".canvas-panel");
  const legend = canvasPanel?.querySelector(".legend");
  let simulationActions = canvasPanel?.querySelector(".simulation-actions");
  if (!simulationActions && legend) {
    simulationActions = document.createElement("div");
    simulationActions.className = "simulation-actions";
    legend.insertAdjacentElement("afterend", simulationActions);
  }

  const runGroup = elements.runCaseA?.closest(".control-group");
  if (simulationActions && runGroup) {
    runGroup.classList.add("simulation-toolbar");
    runGroup.querySelector("h2")?.replaceChildren("実行");
    elements.runCaseA.textContent = "ケースA";
    elements.runCaseB.textContent = "ケースB";
    elements.runCaseC.textContent = "ケースC";
    elements.runAll.textContent = "全ケース実行";
    elements.runSweep.textContent = "パラメータスイープ";
    elements.resetDefaults.textContent = "初期値に戻す";
    elements.exportFebioJson.textContent = "FEBio JSON保存";
    if (!elements.exportFebioXml && elements.exportFebioJson.parentNode) {
      const exportXmlButton = elements.exportFebioJson.cloneNode(true);
      exportXmlButton.id = "export-febio-xml";
      exportXmlButton.textContent = "FEBio XML保存";
      elements.exportFebioJson.insertAdjacentElement("afterend", exportXmlButton);
      elements.exportFebioXml = exportXmlButton;
    }
    if (!elements.exportFebioHandoff && elements.exportFebioJson.parentNode) {
      const exportHandoffButton = elements.exportFebioJson.cloneNode(true);
      exportHandoffButton.id = "export-febio-handoff";
      exportHandoffButton.textContent = "FEBio引き渡し一式";
      (elements.exportFebioXml || elements.exportFebioJson).insertAdjacentElement("afterend", exportHandoffButton);
      elements.exportFebioHandoff = exportHandoffButton;
    }
    elements.importResult.textContent = "結果読込";
    runGroup.querySelector(".inline-select span")?.replaceChildren("ソルバ");
    simulationActions.appendChild(runGroup);
  }

  if (simulationActions && elements.summaryBand) {
    simulationActions.appendChild(elements.summaryBand);
  }

  document.querySelector(".hero")?.remove();

  if (elements.topView) {
    elements.topView.width = 520;
    elements.topView.height = 420;
  }
}

function organizeControlGroups() {
  const operationGroup = document.querySelector("#operation-fields")?.closest(".control-group");
  const geometryGroup = document.querySelector("#geometry-fields")?.closest(".control-group");
  if (operationGroup && geometryGroup && operationGroup.parentNode === geometryGroup.parentNode) {
    geometryGroup.parentNode.insertBefore(operationGroup, geometryGroup);
  }

  setControlGroupTitle("operation-fields", "操作");
  setControlGroupTitle("geometry-fields", "形状");
  setControlGroupTitle("material-fields", "材料");
  setControlGroupTitle("interface-fields", "界面");
}

function populateFields() {
  createField("geometry-fields", FIELD_GROUPS.geometry);
  createField("material-fields", FIELD_GROUPS.material);
  createField("interface-fields", FIELD_GROUPS.interfaces);
  createField("operation-fields", FIELD_GROUPS.operation);
  organizeControlGroups();
  setControlGroupTitle("operation-fields", "\u64cd\u4f5c");
  setControlGroupTitle("geometry-fields", "\u5f62\u72b6");
  setControlGroupTitle("material-fields", "\u6750\u6599");
  setControlGroupTitle("interface-fields", "\u754c\u9762");
}

function bindFieldListeners() {
  Object.values(FIELD_GROUPS)
    .flat()
    .map(normalizeFieldEntry)
    .forEach((field) => {
      const input = document.querySelector(`#field-${field.key}`);
      input.addEventListener(field.type === "select" ? "change" : "input", () => {
        appState.params[field.key] = field.type === "select" ? input.value : Number(input.value);
        if (field.key === "adhesionPattern" && input.value !== "random_patchy") {
          document.querySelector("#field-adhesionSeed").value = appState.params.adhesionSeed;
        }
        syncSweepDefaults();
      });
    });
}

function numericParamKeys() {
  return Object.values(FIELD_GROUPS)
    .flat()
    .map(normalizeFieldEntry)
    .filter((field) => typeof DEFAULTS[field.key] === "number")
    .map((field) => field.key);
}

function setFieldValues(values) {
  Object.entries(values).forEach(([key, value]) => {
    const input = document.querySelector(`#field-${key}`);
    if (input) {
      input.value = value;
    }
  });
}

function resetDefaults() {
  appState.params = structuredClone(DEFAULTS);
  setFieldValues(DEFAULTS);
  syncSweepDefaults();
}

function fillSweepControls() {
  elements.sweepParameter.innerHTML = numericParamKeys()
    .map((key) => `<option value="${key}">${key}</option>`)
    .join("");
  elements.sweepParameter.value = "tau_nc_crit";
  syncSweepDefaults();
  elements.sweepParameter.addEventListener("change", syncSweepDefaults);
}

function syncSweepDefaults() {
  const parameter = elements.sweepParameter.value || "tau_nc_crit";
  const current = Number(appState.params[parameter]);
  elements.sweepStart.value = formatNumber(current * 0.7);
  elements.sweepEnd.value = formatNumber(current * 1.3);
}

function collectParams() {
  return structuredClone(appState.params);
}

function splitParamsByRole(params) {
  return {
    geometry: Object.fromEntries(GEOMETRY_SCHEMA_KEYS.map((key) => [key, params[key]])),
    material: Object.fromEntries(FIELD_GROUPS.material.map(([key]) => [key, params[key]])),
    interfaces: Object.fromEntries(FIELD_GROUPS.interfaces.map(([key]) => [key, params[key]])),
    operation: Object.fromEntries(OPERATION_SCHEMA_KEYS.map((key) => [key, params[key]])),
  };
}

function buildSolverMetadata(solverMode, overrides = {}) {
  return {
    solverMode,
    source: overrides.source || solverMode,
    generatedAt: overrides.generatedAt || new Date().toISOString(),
    version: overrides.version || APP_SCHEMA_VERSION,
    ...overrides,
  };
}

function describeSolverMetadata(solverMetadata = {}) {
  const solverMode = solverMetadata.solverMode || "lightweight";
  const source = solverMetadata.source || solverMode;
  const normalizedSource = String(source).toLowerCase();
  const isFebioMock =
    solverMode === "febio" &&
    (normalizedSource.includes("mock") || normalizedSource.includes("bridge") || normalizedSource.includes("stub"));
  const isImported = normalizedSource.includes("import");

  return {
    solverMode,
    source,
    label: isFebioMock ? "FEBio bridge (mock)" : source,
    note: isFebioMock ? "not yet solved by FEBio" : isImported ? "imported external result" : "",
  };
}

// Model layer: solver-independent input schema used by both lightweight JS and FEBio bridge flows.
function buildSimulationInput(caseName, params) {
  const normalizedParams = { ...structuredClone(DEFAULTS), ...structuredClone(params) };
  const groups = splitParamsByRole(normalizedParams);
  return {
    caseName,
    params: normalizedParams,
    coordinates: structuredClone(COORDINATE_SYSTEM_SPEC),
    geometry: groups.geometry,
    material: groups.material,
    interfaces: groups.interfaces,
    membrane: {
      Tm: normalizedParams.Tm,
      sig_m_crit: normalizedParams.sig_m_crit,
      sig_m_crit_top: normalizedParams.sig_m_crit_top,
      sig_m_crit_side: normalizedParams.sig_m_crit_side,
      sig_m_crit_basal: normalizedParams.sig_m_crit_basal,
    },
    operation: groups.operation,
    adhesionPattern: normalizedParams.adhesionPattern || "uniform",
    adhesionSeed: normalizedParams.adhesionSeed ?? 17,
    schedule: buildSchedule(caseName, normalizedParams),
  };
}

function serializeSchedule(schedule) {
  return {
    phaseEnds: structuredClone(schedule.phaseEnds),
    axes: structuredClone(schedule.axes),
  };
}

function serializeControl(target) {
  return {
    phase: target.phase,
    pos: { x: target.pos.x, y: target.pos.y },
    operation: structuredClone(target.operation || {}),
  };
}

function normalizeSimulationResult(rawResult, inputSpec) {
  const result = rawResult ? { ...rawResult } : {};
  result.caseName ??= inputSpec.caseName;
  result.params ??= structuredClone(inputSpec.params);
  result.schedule ??= inputSpec.schedule;
  result.history ??= [];
  result.events ??= {};
  result.damage ??= { nc: 0, cd: 0, membrane: 0 };
  result.peaks ??= {};
  result.localNc ??= initializeLocalState(NC_REGIONS);
  result.localCd ??= initializeLocalState(CD_REGIONS);
  result.membraneRegions ??= initializeMembraneState(MEMBRANE_REGIONS);
  result.displacements ??= { cell: 0, nucleus: 0, tangentCell: 0, tangentNucleus: 0 };
  result.firstFailureSite ??= "none";
  result.firstFailureMode ??= "none";
  result.dominantMechanism ??= "insufficient_capture";
  result.classification ??= "no_capture_general";
  result.coordinates ??= structuredClone(inputSpec.coordinates || COORDINATE_SYSTEM_SPEC);
  result.inputSpec = {
    ...structuredClone({
      caseName: inputSpec.caseName,
      params: inputSpec.params,
      coordinates: inputSpec.coordinates,
      geometry: inputSpec.geometry,
      material: inputSpec.material,
      interfaces: inputSpec.interfaces,
      membrane: inputSpec.membrane,
      operation: inputSpec.operation,
      adhesionPattern: inputSpec.adhesionPattern,
      adhesionSeed: inputSpec.adhesionSeed,
    }),
    schedule: serializeSchedule(inputSpec.schedule),
  };
  result.solverMetadata = {
    ...buildSolverMetadata(result.solverMetadata?.solverMode || appState.ui.solverMode || "lightweight"),
    ...(result.solverMetadata || {}),
  };
  return result;
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed, salt) {
  const mixed = hashString(`${seed}:${salt}`);
  return ((mixed % 10000) + 0.5) / 10000;
}

function getAdhesionProfile(params) {
  const pattern = params.adhesionPattern || "uniform";
  const seed = params.adhesionSeed ?? 17;
  const base = {
    left: { stiffness: 1, strength: 1 },
    center: { stiffness: 1, strength: 1 },
    right: { stiffness: 1, strength: 1 },
  };
  if (pattern === "center_strong") {
    base.left = { stiffness: 0.84, strength: 0.88 };
    base.center = { stiffness: 1.32, strength: 1.28 };
    base.right = { stiffness: 0.84, strength: 0.88 };
  } else if (pattern === "edge_strong") {
    base.left = { stiffness: 1.2, strength: 1.18 };
    base.center = { stiffness: 0.78, strength: 0.82 };
    base.right = { stiffness: 1.2, strength: 1.18 };
  } else if (pattern === "random_patchy") {
    ["left", "center", "right"].forEach((region) => {
      const stiffness = 0.72 + seededUnit(seed, `${region}:k`) * 0.86;
      const strength = 0.74 + seededUnit(seed, `${region}:s`) * 0.82;
      base[region] = { stiffness, strength };
    });
  }
  return base;
}

function getMembraneThresholds(params) {
  return {
    top_neck: params.sig_m_crit_top ?? params.sig_m_crit,
    side: params.sig_m_crit_side ?? params.sig_m_crit,
    basal: params.sig_m_crit_basal ?? params.sig_m_crit,
  };
}

function initializeLocalState(regions) {
  return Object.fromEntries(
    regions.map((region) => [
      region,
      {
        normalStress: 0,
        shearStress: 0,
        damage: 0,
        peakNormal: 0,
        peakShear: 0,
        firstFailureTime: null,
        firstFailureMode: null,
      },
    ]),
  );
}

function initializeMembraneState(regions) {
  return Object.fromEntries(
    regions.map((region) => [
      region,
      {
        stress: 0,
        damage: 0,
        threshold: 0,
        peakStress: 0,
        firstFailureTime: null,
      },
    ]),
  );
}

function getPunctureOffsetX(params) {
  const rx = params.Ln / 2;
  return clamp(params.xp, -rx * 0.92, rx * 0.92);
}

function getPunctureHeight(params) {
  const ry = params.Hn / 2;
  return clamp(params.zp ?? ry * 0.35, -ry * 0.92, ry * 0.92);
}

function getPunctureSite(params, nucleusCenter) {
  const rx = params.Ln / 2;
  const ry = params.Hn / 2;
  const punctureOffset = getPunctureOffsetX(params);
  const localY = getPunctureHeight(params);
  const xAtHeight =
    rx * Math.sqrt(Math.max(0, 1 - (localY * localY) / Math.max(ry * ry, 1e-6)));
  const localX = clamp(punctureOffset, -xAtHeight, xAtHeight);
  const local = { x: localX, y: localY };
  const radialNorm = Math.sqrt(
    (local.x * local.x) / Math.max(rx * rx, 1e-6) + (local.y * local.y) / Math.max(ry * ry, 1e-6),
  );
  const surfaceLocal =
    radialNorm > 1e-6
      ? { x: local.x / radialNorm, y: local.y / radialNorm }
      : { x: 0, y: ry };

  const surfacePoint = {
    x: getSectionX(nucleusCenter) + surfaceLocal.x,
    y: getWorldZ(nucleusCenter) + surfaceLocal.y,
  };
  const point = makeSectionPoint(getSectionX(nucleusCenter) + local.x, getWorldZ(nucleusCenter) + local.y);
  const normal = normalize({
    x: surfaceLocal.x / Math.max(rx * rx, 1e-6),
    y: surfaceLocal.y / Math.max(ry * ry, 1e-6),
  });

  return {
    point,
    surfacePoint,
    local,
    surfaceLocal,
    outward: normal,
    inward: scale(normal, -1),
    tangent: normalize(rotate90(normal)),
  };
}

function nucleusBoundary(params, nucleusCenter) {
  return getPunctureSite(params, nucleusCenter);
}

function topViewAxes(params) {
  const punctureOffset = getPunctureOffsetX(params);
  return {
    punctureOffset,
    inwardSign: -1,
    outwardSign: 1,
    tangentSign: 1,
  };
}

function buildSchedule(caseName, params) {
  const total =
    NUMERICS.phase0Duration +
    NUMERICS.phase1Duration +
    NUMERICS.phase2Duration +
    NUMERICS.phase3Duration +
    NUMERICS.phase4Duration;
  const baseNucleus = getNucleusRest(params);
  const boundary = nucleusBoundary(params, baseNucleus);
  const axes = topViewAxes(params);
  const precontact = makeSectionPoint(getSectionX(boundary.point), getWorldZ(boundary.point) + params.rp + 3.2);
  const hold = makeSectionPoint(getSectionX(boundary.point), getWorldZ(boundary.point));
  const lift = makeSectionPoint(getSectionX(hold), getWorldZ(hold) + params.dz_lift);
  const inward = makeSectionPoint(getSectionX(lift) + axes.inwardSign * params.dx_inward, getWorldZ(lift));
  const tangential = makeSectionPoint(getSectionX(lift), getWorldZ(lift));
  const outward = makeSectionPoint(getSectionX(lift) - axes.inwardSign * params.dx_outward, getWorldZ(lift));
  const combinedInward = makeSectionPoint(getSectionX(lift) + axes.inwardSign * params.dx_inward * 0.55, getWorldZ(lift));
  const combinedTangent = params.ds_tangent * 0.85;

  const phaseEnds = {
    phase0: NUMERICS.phase0Duration,
    phase1: NUMERICS.phase0Duration + NUMERICS.phase1Duration,
    phase2: NUMERICS.phase0Duration + NUMERICS.phase1Duration + NUMERICS.phase2Duration,
    phase3:
      NUMERICS.phase0Duration +
      NUMERICS.phase1Duration +
      NUMERICS.phase2Duration +
      NUMERICS.phase3Duration,
    total,
  };

  return {
    phaseEnds,
    holdPosition: hold,
    axes,
    targetAt(time) {
      if (time < phaseEnds.phase0) {
        return {
          phase: "approach",
          pos: {
            x: lerp(precontact.x, hold.x, time / phaseEnds.phase0),
            y: lerp(precontact.y, hold.y, time / phaseEnds.phase0),
          },
          operation: { lift: 0, inward: 0, tangent: 0 },
        };
      }
      if (time < phaseEnds.phase1) {
        return { phase: "hold", pos: hold, operation: { lift: 0, inward: 0, tangent: 0 } };
      }
      if (time < phaseEnds.phase2) {
        const t = (time - phaseEnds.phase1) / (phaseEnds.phase2 - phaseEnds.phase1);
        return {
          phase: "lift",
          pos: { x: lerp(hold.x, lift.x, t), y: lerp(hold.y, lift.y, t) },
          operation: { lift: params.dz_lift * t, inward: 0, tangent: 0 },
        };
      }
      if (time < phaseEnds.phase3) {
        const t = (time - phaseEnds.phase2) / (phaseEnds.phase3 - phaseEnds.phase2);
        if (caseName === "A") {
          return {
            phase: "inward",
            pos: { x: lerp(lift.x, inward.x, t), y: lerp(lift.y, inward.y, t) },
            operation: { lift: params.dz_lift, inward: params.dx_inward * t, tangent: 0 },
          };
        }
        if (caseName === "B") {
          return {
            phase: "tangential",
            pos: { x: lerp(lift.x, tangential.x, t), y: lerp(lift.y, tangential.y, t) },
            operation: { lift: params.dz_lift, inward: 0, tangent: params.ds_tangent * t },
          };
        }
        if (t < 0.5) {
          const inwardT = t / 0.5;
          return {
            phase: "mixed-inward",
            pos: {
              x: lerp(lift.x, combinedInward.x, inwardT),
              y: lerp(lift.y, combinedInward.y, inwardT),
            },
            operation: {
              lift: params.dz_lift,
              inward: params.dx_inward * 0.55 * inwardT,
              tangent: 0,
            },
          };
        }
        const tangentT = (t - 0.5) / 0.5;
        return {
          phase: "mixed-tangential",
          pos: combinedInward,
          operation: {
            lift: params.dz_lift,
            inward: params.dx_inward * 0.55,
            tangent: combinedTangent * tangentT,
          },
        };
      }
      const t = clamp((time - phaseEnds.phase3) / (phaseEnds.total - phaseEnds.phase3), 0, 1);
      const from = caseName === "B" ? tangential : caseName === "A" ? inward : combinedInward;
      const releaseStart =
        caseName === "B"
          ? { lift: params.dz_lift, inward: 0, tangent: params.ds_tangent }
          : caseName === "A"
            ? { lift: params.dz_lift, inward: params.dx_inward, tangent: 0 }
            : { lift: params.dz_lift, inward: params.dx_inward * 0.55, tangent: combinedTangent };
      return {
        phase: "release-test",
        pos: { x: lerp(from.x, outward.x, t), y: lerp(from.y, outward.y, t) },
        operation: {
          lift: lerp(releaseStart.lift, params.dz_lift * 1.08, t),
          inward: lerp(releaseStart.inward, 0, t),
          tangent: lerp(releaseStart.tangent, releaseStart.tangent * 0.35, t),
        },
      };
    },
  };
}

function maybeMarkEvent(eventMap, key, time, detail) {
  if (!eventMap[key]) {
    eventMap[key] = { time, detail };
  }
}

function updateDamage(current, phi, rate, gc, dt) {
  if (phi <= 1) {
    return current;
  }
  return clamp(current + (dt * rate * (phi - 1)) / Math.max(0.08, gc), 0, 0.999);
}

function cloneLocalInterfaceState(source) {
  return Object.fromEntries(
    Object.entries(source).map(([region, value]) => [
      region,
      {
        normalStress: value.normalStress,
        shearStress: value.shearStress,
        damage: value.damage,
        peakNormal: value.peakNormal,
        peakShear: value.peakShear,
        firstFailureTime: value.firstFailureTime,
        firstFailureMode: value.firstFailureMode,
      },
    ]),
  );
}

function cloneMembraneState(source) {
  return Object.fromEntries(
    Object.entries(source).map(([region, value]) => [
      region,
      {
        stress: value.stress,
        damage: value.damage,
        threshold: value.threshold,
        peakStress: value.peakStress,
        firstFailureTime: value.firstFailureTime,
      },
    ]),
  );
}

function updateInterfaceRegion(regionState, normalStress, shearStress, crits, gc, rate, dt, time) {
  regionState.normalStress = normalStress;
  regionState.shearStress = shearStress;
  regionState.peakNormal = Math.max(regionState.peakNormal, normalStress);
  regionState.peakShear = Math.max(regionState.peakShear, shearStress);
  const phi = Math.sqrt(
    (normalStress / Math.max(crits.normal, 1e-6)) ** 2 +
      (shearStress / Math.max(crits.shear, 1e-6)) ** 2,
  );
  regionState.damage = updateDamage(regionState.damage, phi, rate, gc, dt);
  if (regionState.firstFailureTime === null && phi >= 1) {
    regionState.firstFailureTime = time;
    regionState.firstFailureMode = shearStress >= normalStress ? "shear" : "normal";
  }
  return { phi, damage: regionState.damage, mode: regionState.firstFailureMode };
}

function updateMembraneRegion(regionState, stress, threshold, dt, time) {
  regionState.stress = stress;
  regionState.threshold = threshold;
  regionState.peakStress = Math.max(regionState.peakStress, stress);
  const phi = stress / Math.max(threshold, 1e-6);
  regionState.damage = updateDamage(regionState.damage, phi, NUMERICS.damageRateMembrane, 0.35, dt);
  if (regionState.firstFailureTime === null && phi >= 1) {
    regionState.firstFailureTime = time;
  }
  return { phi, damage: regionState.damage };
}

function findEarliestLocalFailure(result) {
  const candidates = [];
  Object.entries(result.localNc).forEach(([region, state]) => {
    if (state.firstFailureTime !== null) {
      candidates.push({
        time: state.firstFailureTime,
        site: `nc:${region}`,
        mode: state.firstFailureMode || "shear",
      });
    }
  });
  Object.entries(result.localCd).forEach(([region, state]) => {
    if (state.firstFailureTime !== null) {
      candidates.push({
        time: state.firstFailureTime,
        site: `cd:${region}`,
        mode: state.firstFailureMode || "shear",
      });
    }
  });
  Object.entries(result.membraneRegions).forEach(([region, state]) => {
    if (state.firstFailureTime !== null) {
      candidates.push({
        time: state.firstFailureTime,
        site: `membrane:${region}`,
        mode: "membrane",
      });
    }
  });
  if (result.events.tipSlip) {
    candidates.push({
      time: result.events.tipSlip.time,
      site: "pipette:hold",
      mode: "slip",
    });
  }
  if (!candidates.length) {
    return { site: "none", mode: "none" };
  }
  candidates.sort((left, right) => left.time - right.time);
  return { site: candidates[0].site, mode: candidates[0].mode };
}

function determineDominantMechanism(result) {
  if (
    ["missed_target", "insufficient_hold", "early_slip", "no_capture_general"].includes(
      result.classification,
    )
  ) {
    return "insufficient_capture";
  }
  if (result.firstFailureSite?.startsWith("membrane:")) {
    return "membrane_rupture";
  }
  if (
    result.firstFailureSite?.startsWith("cd:") ||
    result.damage.cd > result.damage.nc * 0.65
  ) {
    return "dish_detachment";
  }
  if (result.caseName === "B" || result.peaks.peakMomentProxy > result.peaks.peakNcShear * 0.95) {
    return "rotational_moment";
  }
  return "local_shear";
}

function classifyRun(result) {
  const ncStart = result.events.ncDamageStart?.time ?? Infinity;
  const cdStart = result.events.cdDamageStart?.time ?? Infinity;
  const tipSlipTime = result.events.tipSlip?.time ?? Infinity;
  if (!result.captureEstablished) {
    return "missed_target";
  }
  if (tipSlipTime < NUMERICS.phase0Duration + NUMERICS.phase1Duration + NUMERICS.phase2Duration * 0.3) {
    return "early_slip";
  }
  if (
    !result.captureMaintained &&
    result.damage.nc < 0.28 &&
    result.damage.cd < 0.16 &&
    result.damage.membrane < 0.22
  ) {
    return "insufficient_hold";
  }
  if (
    result.damage.cd > 0.28 ||
    cdStart < ncStart ||
    result.firstFailureSite.startsWith("cd:") ||
    result.dominantMechanism === "dish_detachment"
  ) {
    return "cell_attached_to_tip";
  }
  if (
    result.damage.nc > 0.36 &&
    result.damage.cd < 0.2 &&
    result.captureMaintained &&
    (result.membraneRegions.top_neck.damage > 0.18 || result.events.membraneDamageStart)
  ) {
    return "nucleus_detached";
  }
  if (result.peaks.peakMembraneStrain > 0.14 || result.peaks.peakCytoplasmStress > 0.32) {
    return "deformation_only";
  }
  if (!result.captureMaintained) {
    return "insufficient_hold";
  }
  return "no_capture_general";
}

// -----------------------------------------------------------------------------
// legacy solver section
// -----------------------------------------------------------------------------
// Retained only as a historical reference during the stabilization pass.
// The active production path is runSimulation() -> runLightweightSimulation()/runFebioSimulation().
function runSimulationLegacyBaseline(caseName, params) {
  throw new Error("Legacy baseline solver is retired. Use runLightweightSimulation instead.");
  const schedule = buildSchedule(caseName, params);
  const totalTime = schedule.phaseEnds.total;
  const steps = Math.ceil(totalTime / NUMERICS.dt);
  const cellRest = getCellRest(params);
  const nucleusRest = getNucleusRest(params);
  const relativeRest = subtract(nucleusRest, cellRest);

  const state = {
    pipette: { x: schedule.targetAt(0).pos.x, y: schedule.targetAt(0).pos.y, slipped: false },
    nucleus: { ...nucleusRest },
    cell: { ...cellRest },
    velocityNucleus: { x: 0, y: 0 },
    velocityCell: { x: 0, y: 0 },
    tangentNucleus: 0,
    tangentCell: 0,
    velocityTangentNucleus: 0,
    velocityTangentCell: 0,
    damageNc: 0,
    damageCd: 0,
    damageMembrane: 0,
    captureEstablished: false,
    captureMaintained: false,
    events: {},
    history: [],
  };

  const nucleusArea = Math.PI * (params.Ln / 2) * (params.Hn / 2);
  const cellArea = Math.max(params.Lc * params.Hc * 0.74, 1);
  const peaks = {
    peakNucleusStress: 0,
    peakCytoplasmStress: 0,
    peakMembraneStress: 0,
    peakMembraneStrain: 0,
    peakNcNormal: 0,
    peakNcShear: 0,
    peakCdNormal: 0,
    peakCdShear: 0,
    peakHoldForce: 0,
  };

  let lastBoundary = nucleusBoundary(params, state.nucleus);

  for (let step = 0; step <= steps; step += 1) {
    const time = step * NUMERICS.dt;
    const target = schedule.targetAt(time);
    const operation = target.operation || { lift: 0, inward: 0, tangent: 0 };
    state.pipette.x = target.pos.x;
    state.pipette.y = target.pos.y;

    const boundary = nucleusBoundary(params, state.nucleus);
    lastBoundary = boundary;
    const tip = { x: state.pipette.x, y: state.pipette.y };
    const contact = boundary.point;
    const contactDistance = lengthOf(subtract(contact, tip));

    if (!state.captureEstablished && !state.pipette.slipped) {
      if (contactDistance <= params.contact_tol + params.rp * 0.5) {
        state.captureEstablished = true;
        maybeMarkEvent(state.events, "captureEstablished", time, "ピペット保持が成立しました。");
      }
    }

    let holdForceVector = { x: 0, y: 0 };
    let holdTangentialForce = 0;
    let holdForceMag = 0;
    if (state.captureEstablished && !state.pipette.slipped) {
      const springVector = subtract(tip, contact);
      holdForceVector = scale(springVector, NUMERICS.holdStiffness * (1 + params.P_hold));
      holdTangentialForce =
        NUMERICS.holdStiffness * (1 + params.P_hold) * (operation.tangent - state.tangentNucleus);
      holdForceMag = Math.hypot(lengthOf(holdForceVector), holdTangentialForce);
      peaks.peakHoldForce = Math.max(peaks.peakHoldForce, holdForceMag);

      const allowableHold =
        params.Fhold * (1 + params.mu_p * 0.6) * (1 - state.damageMembrane * 0.25);
      if (holdForceMag > allowableHold && time > schedule.phaseEnds.phase1 * 0.8) {
        state.pipette.slipped = true;
        maybeMarkEvent(state.events, "tipSlip", time, "保持力が滑り限界を超えました。");
        holdForceVector = { x: 0, y: 0 };
        holdTangentialForce = 0;
        holdForceMag = 0;
      }
    }

    const relative = subtract(subtract(state.nucleus, state.cell), relativeRest);
    const relVelocity = subtract(state.velocityNucleus, state.velocityCell);
    const relativeTangential = state.tangentNucleus - state.tangentCell;
    const relVelocityTangential = state.velocityTangentNucleus - state.velocityTangentCell;
    const deltaNormal = Math.max(0, dot(relative, boundary.outward));
    const deltaShear = relativeTangential;
    const manipOffset = subtract(tip, schedule.holdPosition);
    const driveLift = Math.max(operation.lift, Math.max(0, getWorldZ(manipOffset)));
    const driveInward = Math.max(0, operation.inward);
    const driveTangent = Math.abs(operation.tangent);

    const sigmaNc =
      ((1 - state.damageNc) * params.Kn_nc * (deltaNormal + 0.32 * driveLift)) /
      Math.max(1, params.Hn * 0.18);
    const tauNc =
      ((1 - state.damageNc) *
        params.Kt_nc *
        (Math.abs(deltaShear) + 0.72 * driveInward + 0.26 * driveTangent)) /
      Math.max(1, params.Ln * 0.14);
    const phiNc = Math.sqrt(
      (sigmaNc / Math.max(params.sig_nc_crit, 1e-6)) ** 2 +
        (tauNc / Math.max(params.tau_nc_crit, 1e-6)) ** 2,
    );

    const interfaceForceNc = add(
      scale(boundary.outward, -(1 - state.damageNc) * params.Kn_nc * deltaNormal),
      scale(boundary.inward, -(1 - state.damageNc) * params.Kt_nc * relative.x * 0.22),
    );
    const dampingForceNc = scale(relVelocity, -0.18 * (params.etan + params.etac));
    const compressiveNc = scale(
      boundary.outward,
      -NUMERICS.compressivePenalty * Math.min(0, dot(relative, boundary.outward)),
    );
    const totalNcForce = add(add(interfaceForceNc, dampingForceNc), compressiveNc);
    const tangentialInterfaceForceNc =
      -(1 - state.damageNc) * params.Kt_nc * deltaShear -
      0.18 * (params.etan + params.etac) * relVelocityTangential;

    const deltaCd = subtract(state.cell, cellRest);
    const sigmaCd =
      ((1 - state.damageCd) * params.Kn_cd * (Math.max(0, deltaCd.y) + 0.12 * driveLift)) /
      Math.max(1, params.Hc * 0.22);
    const tauCd =
      ((1 - state.damageCd) *
        params.Kt_cd *
        (Math.abs(deltaCd.x) + 0.18 * driveInward + 0.55 * driveTangent)) /
      Math.max(1, params.Lc * 0.18);
    const phiCd = Math.sqrt(
      (sigmaCd / Math.max(params.sig_cd_crit, 1e-6)) ** 2 +
        (tauCd / Math.max(params.tau_cd_crit, 1e-6)) ** 2,
    );

    const adhesionForce = {
      x: -(1 - state.damageCd) * params.Kt_cd * deltaCd.x,
      y: -(1 - state.damageCd) * params.Kn_cd * Math.max(0, deltaCd.y),
    };
    const tangentialAdhesionForce =
      -(1 - state.damageCd) * params.Kt_cd * state.tangentCell -
      params.etac * state.velocityTangentCell * 0.04;
    const dishPenalty = Math.min(0, state.cell.y - params.Hc * 0.48);
    const compressionDish = { x: 0, y: -NUMERICS.compressivePenalty * dishPenalty };
    const cellBulk = {
      x: -NUMERICS.bulkCell * params.Ec * deltaCd.x - params.etac * state.velocityCell.x * 0.05,
      y: -NUMERICS.bulkCell * params.Ec * deltaCd.y - params.etac * state.velocityCell.y * 0.05,
    };
    const nucleusBulkDisp = subtract(state.nucleus, nucleusRest);
    const nucleusBulk = {
      x:
        -NUMERICS.bulkNucleus * params.En * nucleusBulkDisp.x -
        params.etan * state.velocityNucleus.x * 0.05,
      y:
        -NUMERICS.bulkNucleus * params.En * nucleusBulkDisp.y -
        params.etan * state.velocityNucleus.y * 0.05,
    };
    const nucleusBulkTangential =
      -NUMERICS.bulkNucleus * params.En * state.tangentNucleus -
      params.etan * state.velocityTangentNucleus * 0.05;
    const cellBulkTangential =
      -NUMERICS.bulkCell * params.Ec * state.tangentCell -
      params.etac * state.velocityTangentCell * 0.05;

    const membraneStrain =
      Math.abs(deltaCd.x) / Math.max(params.Lc, 1) +
      Math.max(0, deltaCd.y) / Math.max(params.Hc, 1) +
      0.45 * Math.abs(relative.x) / Math.max(params.Ln, 1) +
      0.7 * Math.max(0, relative.y) / Math.max(params.Hn, 1) +
      0.22 * Math.abs(relativeTangential) / Math.max(params.Ln, 1) +
      0.035 * driveTangent +
      0.06 * holdForceMag;
    const membraneStress =
      params.Tm * membraneStrain +
      0.2 * Math.abs(dot(holdForceVector, boundary.outward)) +
      0.08 * Math.abs(dot(holdForceVector, boundary.inward)) +
      0.14 * Math.abs(holdTangentialForce);
    const membraneForce = {
      x:
        -params.Tm *
        (deltaCd.x / Math.max(params.Lc, 1) + 0.2 * relative.x / Math.max(params.Ln, 1)),
      y:
        -params.Tm *
        (deltaCd.y / Math.max(params.Hc, 1) +
          0.3 * Math.max(0, relative.y) / Math.max(params.Hn, 1)),
    };

    if (membraneStress >= params.sig_m_crit && state.captureEstablished) {
      maybeMarkEvent(state.events, "membraneDamageStart", time, "膜または皮質層の破断が始まりました。");
    }

    if (state.captureEstablished) {
      if (phiNc >= 1) {
        maybeMarkEvent(state.events, "ncDamageStart", time, "核-細胞質界面の損傷が始まりました。");
      }
      if (phiCd >= 1) {
        maybeMarkEvent(state.events, "cdDamageStart", time, "細胞-ディッシュ界面の損傷が始まりました。");
      }
      state.damageNc = updateDamage(
        state.damageNc,
        phiNc,
        NUMERICS.damageRateNc,
        params.Gc_nc,
        NUMERICS.dt,
      );
      state.damageCd = updateDamage(
        state.damageCd,
        phiCd,
        NUMERICS.damageRateCd,
        params.Gc_cd,
        NUMERICS.dt,
      );
      state.damageMembrane = updateDamage(
        state.damageMembrane,
        membraneStress / Math.max(params.sig_m_crit, 1e-6),
        NUMERICS.damageRateMembrane,
        0.35,
        NUMERICS.dt,
      );
    }

    if (state.damageNc >= NUMERICS.damageProgressThreshold) {
      maybeMarkEvent(state.events, "ncDamageProgress", time, "核-細胞質界面損傷が進展閾値を超えました。");
    }
    if (state.damageCd >= NUMERICS.damageProgressThreshold) {
      maybeMarkEvent(state.events, "cdDamageProgress", time, "細胞-ディッシュ界面損傷が進展閾値を超えました。");
    }
    if (state.damageMembrane >= NUMERICS.damageProgressThreshold) {
      maybeMarkEvent(state.events, "membraneDamageProgress", time, "膜損傷が進展閾値を超えました。");
    }

    const forceOnNucleus = add(holdForceVector, add(totalNcForce, nucleusBulk));
    const forceOnCell = add(
      add(add(scale(totalNcForce, -1), adhesionForce), cellBulk),
      add(membraneForce, compressionDish),
    );
    const forceOnNucleusTangential =
      holdTangentialForce + tangentialInterfaceForceNc + nucleusBulkTangential;
    const forceOnCellTangential =
      -tangentialInterfaceForceNc + tangentialAdhesionForce + cellBulkTangential;

    state.velocityNucleus = scale(forceOnNucleus, 1 / NUMERICS.dampingNucleus);
    state.velocityCell = scale(forceOnCell, 1 / NUMERICS.dampingCell);
    state.velocityTangentNucleus = forceOnNucleusTangential / NUMERICS.dampingNucleus;
    state.velocityTangentCell = forceOnCellTangential / NUMERICS.dampingCell;
    state.nucleus = add(state.nucleus, scale(state.velocityNucleus, NUMERICS.dt * NUMERICS.nucleusMobility));
    state.cell = add(state.cell, scale(state.velocityCell, NUMERICS.dt * NUMERICS.cellMobility));
    state.tangentNucleus +=
      state.velocityTangentNucleus * NUMERICS.dt * NUMERICS.nucleusMobility;
    state.tangentCell += state.velocityTangentCell * NUMERICS.dt * NUMERICS.cellMobility;

    if (!state.pipette.slipped && state.captureEstablished) {
      state.captureMaintained = true;
    }

    const nucleusStress = lengthOf(add(holdForceVector, totalNcForce)) / nucleusArea;
    const cytoplasmStress = lengthOf(subtract(forceOnCell, adhesionForce)) / cellArea;
    peaks.peakNucleusStress = Math.max(peaks.peakNucleusStress, nucleusStress);
    peaks.peakCytoplasmStress = Math.max(peaks.peakCytoplasmStress, cytoplasmStress);
    peaks.peakMembraneStress = Math.max(peaks.peakMembraneStress, membraneStress);
    peaks.peakMembraneStrain = Math.max(peaks.peakMembraneStrain, membraneStrain);
    peaks.peakNcNormal = Math.max(peaks.peakNcNormal, sigmaNc);
    peaks.peakNcShear = Math.max(peaks.peakNcShear, tauNc);
    peaks.peakCdNormal = Math.max(peaks.peakCdNormal, sigmaCd);
    peaks.peakCdShear = Math.max(peaks.peakCdShear, tauCd);

    state.history.push({
      time,
      phase: target.phase,
      pipette: { ...tip },
      nucleus: { ...state.nucleus },
      cell: { ...state.cell },
      sigmaNc,
      tauNc,
      sigmaCd,
      tauCd,
      membraneStress,
      membraneStrain,
      damageNc: state.damageNc,
      damageCd: state.damageCd,
      damageMembrane: state.damageMembrane,
      holdForce: holdForceMag,
      tangentialDrive: driveTangent,
      tangentialOffset: state.tangentNucleus,
    });
  }

  const result = {
    caseName,
    params: structuredClone(params),
    schedule,
    history: state.history,
    events: state.events,
    damage: {
      nc: state.damageNc,
      cd: state.damageCd,
      membrane: state.damageMembrane,
    },
    peaks,
    captureEstablished: state.captureEstablished,
    captureMaintained: state.captureMaintained && !state.pipette.slipped,
    finalState: {
      pipette: { x: state.pipette.x, y: state.pipette.y, slipped: state.pipette.slipped },
      cell: state.cell,
      nucleus: state.nucleus,
      boundary: lastBoundary,
    },
    displacements: {
      cell: lengthOf(subtract(state.cell, cellRest)),
      nucleus: lengthOf(subtract(state.nucleus, nucleusRest)),
    },
  };
  result.classification = classifyRun(result);
  return result;
}

// This weighting layer is the main hand-off point to a future FEM model:
// replace these heuristics with segment tractions sampled from the mesh.
function buildNcRegionWeights(punctureSide, oppositeSide, driveLiftN, driveInwardN, driveTangentN, momentProxy) {
  const weights = {
    right: { normal: 0.88, shear: 0.82 },
    left: { normal: 0.88, shear: 0.82 },
    top: { normal: 0.98 + 0.4 * driveLiftN, shear: 0.78 + 0.2 * driveTangentN },
    bottom: { normal: 0.68 + 0.18 * driveInwardN, shear: 0.6 },
  };
  weights[punctureSide] = {
    normal: 0.92 + 0.18 * driveInwardN,
    shear: 0.76 + 0.2 * driveInwardN,
  };
  weights[oppositeSide] = {
    normal: 0.84 + 0.42 * momentProxy + 0.12 * driveLiftN,
    shear: 0.86 + 0.58 * momentProxy + 0.18 * driveInwardN,
  };
  weights.top.normal += 0.18 * momentProxy;
  return weights;
}

// FEM handoff point: replace reduced-order adhesion weighting with FEBio cohesive/contact
// tractions sampled over left/center/right dish patches.
function buildCdRegionWeights(punctureSide, driveLiftN, driveInwardN, driveTangentN, momentProxy) {
  const peelSide = punctureSide === "right" ? "left" : "right";
  const weights = {
    left: { normal: 0.9, shear: 0.84 },
    center: { normal: 1.04 + 0.35 * driveLiftN, shear: 0.74 + 0.12 * driveInwardN },
    right: { normal: 0.9, shear: 0.84 },
  };
  weights[peelSide] = {
    normal: 0.82 + 0.56 * momentProxy + 0.16 * driveLiftN,
    shear: 0.9 + 0.4 * momentProxy + 0.14 * driveTangentN,
  };
  weights[punctureSide] = {
    normal: 0.82 + 0.15 * driveLiftN,
    shear: 0.86 + 0.18 * driveInwardN,
  };
  return weights;
}

// FEM handoff point: replace the regional membrane proxy with FEBio shell/membrane stress
// sampled and aggregated into top_neck / side / basal output bins.
function buildMembraneStressByRegion(membraneStress, deltaCd, params, driveLiftN, driveInwardN, driveTangentN, momentProxy) {
  return {
    top_neck: membraneStress * (1.08 + 0.52 * driveLiftN + 0.42 * momentProxy),
    side: membraneStress * (0.82 + 0.18 * driveInwardN + 0.3 * driveTangentN),
    basal:
      membraneStress *
      (0.64 + 0.18 * driveLiftN + 0.18 * Math.abs(deltaCd.x) / Math.max(params.Lc, 1)),
  };
}

function computeCaptureState(state, contactDistance, params, time) {
  if (!state.captureEstablished && !state.pipette.slipped && contactDistance <= params.contact_tol + params.rp * 0.5) {
    state.captureEstablished = true;
    maybeMarkEvent(state.events, "captureEstablished", time, "ピペット保持が成立しました。");
  }
  return { captureEstablished: state.captureEstablished };
}

function computeHoldMechanics({ state, tip, contact, boundary, params, schedule, operation, time, peaks }) {
  const pipetteAxis = { x: 0, y: -1 };
  const surfaceInward = scale(boundary.outward, -1);
  const contactAngleRadians = Math.acos(clamp(dot(pipetteAxis, surfaceInward), -1, 1));
  const contactAngle = (contactAngleRadians * 180) / Math.PI;
  const angleFactor = clamp(Math.cos(contactAngleRadians) ** 2, 0.2, 1);
  const contactDistance = lengthOf(subtract(contact, tip));
  const contactAreaFactor = clamp(
    0.55 + params.rp * 0.045 + Math.max(0, params.contact_tol + params.rp * 0.55 - contactDistance) * 0.18,
    0.45,
    1.85,
  );

  let holdForceVector = { x: 0, y: 0 };
  let holdTangentialForce = 0;
  let holdForceMag = 0;
  let holdStiffnessEffective = 0;

  if (state.captureEstablished && !state.pipette.slipped) {
    holdStiffnessEffective = NUMERICS.holdStiffness * (1 + params.P_hold) * angleFactor * contactAreaFactor;
    holdForceVector = scale(subtract(tip, contact), holdStiffnessEffective);
    holdTangentialForce = holdStiffnessEffective * (operation.tangent - state.tangentNucleus);
    holdForceMag = Math.hypot(lengthOf(holdForceVector), holdTangentialForce);
    peaks.peakHoldForce = Math.max(peaks.peakHoldForce, holdForceMag);
    peaks.peakContactAngle = Math.max(peaks.peakContactAngle, contactAngle);
    peaks.peakHoldStiffnessEffective = Math.max(peaks.peakHoldStiffnessEffective, holdStiffnessEffective);

    const allowableHold =
      params.Fhold *
      (1 + params.mu_p * 0.55) *
      (0.45 + 0.55 * angleFactor + 0.35 * contactAreaFactor) *
      (1 - state.damageMembrane * 0.2);
    if (holdForceMag > allowableHold && time > schedule.phaseEnds.phase1 * 0.8) {
      state.pipette.slipped = true;
      maybeMarkEvent(state.events, "tipSlip", time, `保持が滑脱しました。angle=${formatNumber(contactAngle, 1)}`);
      holdForceVector = { x: 0, y: 0 };
      holdTangentialForce = 0;
      holdForceMag = 0;
    }
  }

  state.contactAngle = contactAngle;
  state.holdStiffnessEffective = holdStiffnessEffective;
  return {
    pipetteAxis,
    contactAngle,
    holdForceVector,
    holdTangentialForce,
    holdForceMag,
    holdStiffnessEffective,
  };
}

// FEM handoff point: replace reduced-order regional estimate with FEBio interface traction
// and cohesive damage mapped back into the localNc schema.
function computeNcResponse({ state, params, relativeRest, boundary, tip, schedule, operation, peaks, punctureSide, oppositeSide }) {
  const relative = subtract(subtract(state.nucleus, state.cell), relativeRest);
  const relVelocity = subtract(state.velocityNucleus, state.velocityCell);
  const relativeTangential = state.tangentNucleus - state.tangentCell;
  const relVelocityTangential = state.velocityTangentNucleus - state.velocityTangentCell;
  const manipOffset = subtract(tip, schedule.holdPosition);
  const driveLift = Math.max(operation.lift, Math.max(0, getWorldZ(manipOffset)));
  const driveInward = Math.max(0, operation.inward);
  const driveTangent = Math.abs(operation.tangent);
  const driveLiftN = clamp(driveLift / Math.max(params.dz_lift, 1), 0, 2);
  const driveInwardN = clamp(driveInward / Math.max(params.dx_inward, 1), 0, 2);
  const driveTangentN = clamp(driveTangent / Math.max(params.ds_tangent, 1), 0, 2);
  const punctureN = Math.abs(schedule.axes.punctureOffset) / Math.max(params.Ln / 2, 1);
  const momentProxy = clamp(0.58 * driveTangentN + 0.24 * driveLiftN + 0.28 * punctureN * (driveInwardN + 0.1), 0, 2.2);
  peaks.peakMomentProxy = Math.max(peaks.peakMomentProxy, momentProxy);

  const deltaNormal = Math.max(0, dot(relative, boundary.outward));
  const deltaShear = relativeTangential;
  const strainN = lengthOf(relative) / Math.max(params.Ln, params.Hn, 1) + 0.16 * driveInwardN + 0.08 * driveTangentN;
  const nucleusHardening = 1 + params.alpha_nonlinear * strainN * strainN;
  const enEff = params.En * nucleusHardening;
  const sigmaNc =
    ((1 - state.damageNc) * params.Kn_nc * nucleusHardening * (deltaNormal + 0.28 * driveLift)) /
    Math.max(1, params.Hn * 0.18);
  const tauNc =
    ((1 - state.damageNc) *
      params.Kt_nc *
      nucleusHardening *
      (Math.abs(deltaShear) + 0.74 * driveInward + 0.34 * driveTangent)) /
    Math.max(1, params.Ln * 0.14);
  const ncWeights = buildNcRegionWeights(punctureSide, oppositeSide, driveLiftN, driveInwardN, driveTangentN, momentProxy);
  const interfaceForceNc = add(
    scale(boundary.outward, -(1 - state.damageNc) * params.Kn_nc * deltaNormal),
    scale(boundary.inward, -(1 - state.damageNc) * params.Kt_nc * relative.x * 0.22),
  );
  const dampingForceNc = scale(relVelocity, -0.18 * (params.etan + params.etac));
  const compressiveNc = scale(boundary.outward, -NUMERICS.compressivePenalty * Math.min(0, dot(relative, boundary.outward)));
  const totalNcForce = add(add(interfaceForceNc, dampingForceNc), compressiveNc);
  const tangentialInterfaceForceNc =
    -(1 - state.damageNc) * params.Kt_nc * deltaShear -
    0.18 * (params.etan + params.etac) * relVelocityTangential;

  return {
    relative,
    relativeTangential,
    driveLift,
    driveInward,
    driveTangent,
    driveLiftN,
    driveInwardN,
    driveTangentN,
    momentProxy,
    enEff,
    sigmaNc,
    tauNc,
    ncWeights,
    totalNcForce,
    tangentialInterfaceForceNc,
  };
}

// FEM handoff point: replace reduced-order adhesion peel estimate with FEBio cohesive/contact
// traction mapped back into the localCd left/center/right schema.
function computeCdResponse({ state, params, cellRest, driveLift, driveInward, driveTangent, driveLiftN, driveInwardN, driveTangentN, punctureSide, momentProxy }) {
  const deltaCd = subtract(state.cell, cellRest);
  const sigmaCd =
    ((1 - state.damageCd) * params.Kn_cd * (Math.max(0, getWorldZ(deltaCd)) + 0.14 * driveLift)) /
    Math.max(1, params.Hc * 0.22);
  const tauCd =
    ((1 - state.damageCd) * params.Kt_cd * (Math.abs(deltaCd.x) + 0.2 * driveInward + 0.58 * driveTangent)) /
    Math.max(1, params.Lc * 0.18);
  const cdWeights = buildCdRegionWeights(punctureSide, driveLiftN, driveInwardN, driveTangentN, momentProxy);
  const adhesionForce = {
    x: -(1 - state.damageCd) * params.Kt_cd * deltaCd.x,
    y: -(1 - state.damageCd) * params.Kn_cd * Math.max(0, getWorldZ(deltaCd)),
  };
  const tangentialAdhesionForce =
    -(1 - state.damageCd) * params.Kt_cd * state.tangentCell - params.etac * state.velocityTangentCell * 0.04;
  const compressionDish = {
    x: 0,
    y: -NUMERICS.compressivePenalty * Math.min(0, getWorldZ(state.cell) - params.Hc * 0.48),
  };
  const cellBulk = {
    x: -NUMERICS.bulkCell * params.Ec * deltaCd.x - params.etac * state.velocityCell.x * 0.05,
    y: -NUMERICS.bulkCell * params.Ec * deltaCd.y - params.etac * state.velocityCell.y * 0.05,
  };
  const cellBulkTangential =
    -NUMERICS.bulkCell * params.Ec * state.tangentCell - params.etac * state.velocityTangentCell * 0.05;

  return {
    deltaCd,
    sigmaCd,
    tauCd,
    cdWeights,
    adhesionForce,
    tangentialAdhesionForce,
    compressionDish,
    cellBulk,
    cellBulkTangential,
  };
}

// FEM handoff point: replace the membrane proxy with shell/membrane stress from FEBio and
// map the sampled output back into membraneRegions.
function computeMembraneResponse({ state, params, deltaCd, relative, relativeTangential, driveTangent, holdForceMag, holdForceVector, holdTangentialForce, boundary, driveLiftN, driveInwardN, driveTangentN, momentProxy }) {
  const membraneStrain =
    Math.abs(deltaCd.x) / Math.max(params.Lc, 1) +
    Math.max(0, getWorldZ(deltaCd)) / Math.max(params.Hc, 1) +
    0.45 * Math.abs(relative.x) / Math.max(params.Ln, 1) +
    0.7 * Math.max(0, getWorldZ(relative)) / Math.max(params.Hn, 1) +
    0.24 * Math.abs(relativeTangential) / Math.max(params.Ln, 1) +
    0.035 * driveTangent +
    0.06 * holdForceMag;
  const membraneStress =
    params.Tm * membraneStrain +
    0.2 * Math.abs(dot(holdForceVector, boundary.outward)) +
    0.08 * Math.abs(dot(holdForceVector, boundary.inward)) +
    0.14 * Math.abs(holdTangentialForce);
  const membraneRegions = buildMembraneStressByRegion(
    membraneStress,
    deltaCd,
    params,
    driveLiftN,
    driveInwardN,
    driveTangentN,
    momentProxy,
  );
  const membraneForce = {
    x: -params.Tm * (deltaCd.x / Math.max(params.Lc, 1) + 0.2 * relative.x / Math.max(params.Ln, 1)),
    y:
      -params.Tm *
      (getWorldZ(deltaCd) / Math.max(params.Hc, 1) +
        0.3 * Math.max(0, getWorldZ(relative)) / Math.max(params.Hn, 1)),
  };
  return { membraneStrain, membraneStress, membraneRegions, membraneForce };
}

function updateLocalDamage({ state, params, sigmaNc, tauNc, sigmaCd, tauCd, ncWeights, cdWeights, membraneRegions, membraneThresholds, adhesionProfile, time }) {
  if (state.captureEstablished) {
    NC_REGIONS.forEach((region) => {
      const response = updateInterfaceRegion(
        state.localNc[region],
        sigmaNc * ncWeights[region].normal,
        tauNc * ncWeights[region].shear,
        { normal: params.sig_nc_crit, shear: params.tau_nc_crit },
        params.Gc_nc,
        NUMERICS.damageRateNc,
        NUMERICS.dt,
        time,
      );
      if (!state.events.ncDamageStart && response.phi >= 1) {
        maybeMarkEvent(state.events, "ncDamageStart", time, `核-細胞質界面 ${region} で ${response.mode} 破断開始`);
      }
    });
    CD_REGIONS.forEach((region) => {
      const adhesion = adhesionProfile[region];
      const response = updateInterfaceRegion(
        state.localCd[region],
        sigmaCd * cdWeights[region].normal * adhesion.stiffness,
        tauCd * cdWeights[region].shear * adhesion.stiffness,
        { normal: params.sig_cd_crit * adhesion.strength, shear: params.tau_cd_crit * adhesion.strength },
        params.Gc_cd,
        NUMERICS.damageRateCd,
        NUMERICS.dt,
        time,
      );
      if (!state.events.cdDamageStart && response.phi >= 1) {
        maybeMarkEvent(state.events, "cdDamageStart", time, `細胞-ディッシュ界面 ${region} で ${response.mode} 破断開始`);
      }
    });
    MEMBRANE_REGIONS.forEach((region) => {
      const response = updateMembraneRegion(state.membraneRegions[region], membraneRegions[region], membraneThresholds[region], NUMERICS.dt, time);
      if (!state.events.membraneDamageStart && response.phi >= 1) {
        maybeMarkEvent(state.events, "membraneDamageStart", time, `膜 ${region} で破断開始`);
      }
    });
  }

  state.damageNc = Math.max(...NC_REGIONS.map((region) => state.localNc[region].damage));
  state.damageCd = Math.max(...CD_REGIONS.map((region) => state.localCd[region].damage));
  state.damageMembrane = Math.max(...MEMBRANE_REGIONS.map((region) => state.membraneRegions[region].damage));

  if (!state.events.ncDamageProgress) {
    const region = NC_REGIONS.find((entry) => state.localNc[entry].damage >= NUMERICS.damageProgressThreshold);
    if (region) maybeMarkEvent(state.events, "ncDamageProgress", time, `核-細胞質界面 ${region} の損傷が進行`);
  }
  if (!state.events.cdDamageProgress) {
    const region = CD_REGIONS.find((entry) => state.localCd[entry].damage >= NUMERICS.damageProgressThreshold);
    if (region) maybeMarkEvent(state.events, "cdDamageProgress", time, `細胞-ディッシュ界面 ${region} の損傷が進行`);
  }
  if (!state.events.membraneDamageProgress) {
    const region = MEMBRANE_REGIONS.find((entry) => state.membraneRegions[entry].damage >= NUMERICS.damageProgressThreshold);
    if (region) maybeMarkEvent(state.events, "membraneDamageProgress", time, `膜 ${region} の損傷が進行`);
  }

  return {
    damageNc: state.damageNc,
    damageCd: state.damageCd,
    damageMembrane: state.damageMembrane,
  };
}

function finalizeSimulationResult({ caseName, inputSpec, state, cellRest, nucleusRest, lastBoundary, peaks }) {
  const result = {
    caseName,
    params: structuredClone(inputSpec.params),
    schedule: inputSpec.schedule,
    history: state.history,
    events: state.events,
    damage: { nc: state.damageNc, cd: state.damageCd, membrane: state.damageMembrane },
    peaks,
    captureEstablished: state.captureEstablished,
    captureMaintained: state.captureMaintained && !state.pipette.slipped,
    finalState: {
      pipette: { x: state.pipette.x, y: state.pipette.y, slipped: state.pipette.slipped },
      cell: state.cell,
      nucleus: state.nucleus,
      boundary: lastBoundary,
    },
    displacements: {
      cell: lengthOf(subtract(state.cell, cellRest)),
      nucleus: lengthOf(subtract(state.nucleus, nucleusRest)),
      tangentCell: Math.abs(state.tangentCell),
      tangentNucleus: Math.abs(state.tangentNucleus),
    },
    localNc: cloneLocalInterfaceState(state.localNc),
    localCd: cloneLocalInterfaceState(state.localCd),
    membraneRegions: cloneMembraneState(state.membraneRegions),
    contactAngle: state.contactAngle,
    holdStiffnessEffective: state.holdStiffnessEffective,
    solverMetadata: buildSolverMetadata("lightweight", {
      source: "lightweight-js-surrogate",
    }),
  };
  const firstFailure = findEarliestLocalFailure(result);
  result.firstFailureSite = firstFailure.site;
  result.firstFailureMode = firstFailure.mode;
  result.classification = "no_capture_general";
  result.dominantMechanism = determineDominantMechanism(result);
  result.classification = classifyRun(result);
  result.dominantMechanism = determineDominantMechanism(result);
  return result;
}

// Solver layer: current reduced-order solver kept intact as the lightweight backend.
function runLightweightSimulation(caseName, params, inputSpec = buildSimulationInput(caseName, params)) {
  const schedule = inputSpec.schedule;
  params = structuredClone(inputSpec.params);
  const totalTime = schedule.phaseEnds.total;
  const steps = Math.ceil(totalTime / NUMERICS.dt);
  const cellRest = getCellRest(params);
  const nucleusRest = getNucleusRest(params);
  const relativeRest = subtract(nucleusRest, cellRest);
  const adhesionProfile = getAdhesionProfile(params);
  const membraneThresholds = getMembraneThresholds(params);
  const punctureSide = schedule.axes.punctureOffset >= 0 ? "right" : "left";
  const oppositeSide = punctureSide === "right" ? "left" : "right";
  const state = {
    pipette: { x: schedule.targetAt(0).pos.x, y: schedule.targetAt(0).pos.y, slipped: false },
    nucleus: { ...nucleusRest },
    cell: { ...cellRest },
    velocityNucleus: { x: 0, y: 0 },
    velocityCell: { x: 0, y: 0 },
    tangentNucleus: 0,
    tangentCell: 0,
    velocityTangentNucleus: 0,
    velocityTangentCell: 0,
    damageNc: 0,
    damageCd: 0,
    damageMembrane: 0,
    captureEstablished: false,
    captureMaintained: false,
    localNc: initializeLocalState(NC_REGIONS),
    localCd: initializeLocalState(CD_REGIONS),
    membraneRegions: initializeMembraneState(MEMBRANE_REGIONS),
    contactAngle: 0,
    holdStiffnessEffective: 0,
    events: {},
    history: [],
  };
  const nucleusArea = Math.PI * (params.Ln / 2) * (params.Hn / 2);
  const cellArea = Math.max(params.Lc * params.Hc * 0.74, 1);
  const peaks = {
    peakNucleusStress: 0,
    peakCytoplasmStress: 0,
    peakMembraneStress: 0,
    peakMembraneStrain: 0,
    peakNcNormal: 0,
    peakNcShear: 0,
    peakCdNormal: 0,
    peakCdShear: 0,
    peakHoldForce: 0,
    peakContactAngle: 0,
    peakHoldStiffnessEffective: 0,
    peakMomentProxy: 0,
  };
  let lastBoundary = nucleusBoundary(params, state.nucleus);

  for (let step = 0; step <= steps; step += 1) {
    const time = step * NUMERICS.dt;
    const target = schedule.targetAt(time);
    const operation = target.operation || { lift: 0, inward: 0, tangent: 0 };
    state.pipette.x = target.pos.x;
    state.pipette.y = target.pos.y;

    const boundary = nucleusBoundary(params, state.nucleus);
    lastBoundary = boundary;
    const tip = { x: state.pipette.x, y: state.pipette.y };
    const contact = boundary.point;
    const contactDistance = lengthOf(subtract(contact, tip));
    const pipetteAxis = { x: 0, y: -1 };
    const surfaceInward = scale(boundary.outward, -1);
    const contactAngleRadians = Math.acos(clamp(dot(pipetteAxis, surfaceInward), -1, 1));
    const contactAngle = (contactAngleRadians * 180) / Math.PI;
    const angleFactor = clamp(Math.cos(contactAngleRadians) ** 2, 0.2, 1);
    const contactAreaFactor = clamp(
      0.55 + params.rp * 0.045 + Math.max(0, params.contact_tol + params.rp * 0.55 - contactDistance) * 0.18,
      0.45,
      1.85,
    );

    if (!state.captureEstablished && !state.pipette.slipped && contactDistance <= params.contact_tol + params.rp * 0.5) {
      state.captureEstablished = true;
      maybeMarkEvent(state.events, "captureEstablished", time, "ピペット保持が成立しました。");
    }

    let holdForceVector = { x: 0, y: 0 };
    let holdTangentialForce = 0;
    let holdForceMag = 0;
    let holdStiffnessEffective = 0;
    if (state.captureEstablished && !state.pipette.slipped) {
      holdStiffnessEffective = NUMERICS.holdStiffness * (1 + params.P_hold) * angleFactor * contactAreaFactor;
      holdForceVector = scale(subtract(tip, contact), holdStiffnessEffective);
      holdTangentialForce = holdStiffnessEffective * (operation.tangent - state.tangentNucleus);
      holdForceMag = Math.hypot(lengthOf(holdForceVector), holdTangentialForce);
      peaks.peakHoldForce = Math.max(peaks.peakHoldForce, holdForceMag);
      peaks.peakContactAngle = Math.max(peaks.peakContactAngle, contactAngle);
      peaks.peakHoldStiffnessEffective = Math.max(peaks.peakHoldStiffnessEffective, holdStiffnessEffective);
      const allowableHold =
        params.Fhold *
        (1 + params.mu_p * 0.55) *
        (0.45 + 0.55 * angleFactor + 0.35 * contactAreaFactor) *
        (1 - state.damageMembrane * 0.2);
      if (holdForceMag > allowableHold && time > schedule.phaseEnds.phase1 * 0.8) {
        state.pipette.slipped = true;
        maybeMarkEvent(state.events, "tipSlip", time, `保持限界を超えて滑脱しました。angle=${formatNumber(contactAngle, 1)}`);
        holdForceVector = { x: 0, y: 0 };
        holdTangentialForce = 0;
        holdForceMag = 0;
      }
    }
    state.contactAngle = contactAngle;
    state.holdStiffnessEffective = holdStiffnessEffective;

    const relative = subtract(subtract(state.nucleus, state.cell), relativeRest);
    const relVelocity = subtract(state.velocityNucleus, state.velocityCell);
    // Tangential motion is treated as a hidden out-of-plane DOF so the UI can stay
    // 2D while Case B/C still accumulate rotational/shear effects internally.
    const relativeTangential = state.tangentNucleus - state.tangentCell;
    const relVelocityTangential = state.velocityTangentNucleus - state.velocityTangentCell;
    const manipOffset = subtract(tip, schedule.holdPosition);
    const driveLift = Math.max(operation.lift, Math.max(0, manipOffset.y));
    const driveInward = Math.max(0, operation.inward);
    const driveTangent = Math.abs(operation.tangent);
    const driveLiftN = clamp(driveLift / Math.max(params.dz_lift, 1), 0, 2);
    const driveInwardN = clamp(driveInward / Math.max(params.dx_inward, 1), 0, 2);
    const driveTangentN = clamp(driveTangent / Math.max(params.ds_tangent, 1), 0, 2);
    const punctureN = Math.abs(schedule.axes.punctureOffset) / Math.max(params.Ln / 2, 1);
    const momentProxy = clamp(0.58 * driveTangentN + 0.24 * driveLiftN + 0.28 * punctureN * (driveInwardN + 0.1), 0, 2.2);
    peaks.peakMomentProxy = Math.max(peaks.peakMomentProxy, momentProxy);

    const deltaNormal = Math.max(0, dot(relative, boundary.outward));
    const deltaShear = relativeTangential;
    const strainN = lengthOf(relative) / Math.max(params.Ln, params.Hn, 1) + 0.16 * driveInwardN + 0.08 * driveTangentN;
    const nucleusHardening = 1 + params.alpha_nonlinear * strainN * strainN;
    const enEff = params.En * nucleusHardening;
    const sigmaNc = ((1 - state.damageNc) * params.Kn_nc * nucleusHardening * (deltaNormal + 0.28 * driveLift)) / Math.max(1, params.Hn * 0.18);
    const tauNc = ((1 - state.damageNc) * params.Kt_nc * nucleusHardening * (Math.abs(deltaShear) + 0.74 * driveInward + 0.34 * driveTangent)) / Math.max(1, params.Ln * 0.14);
    const sigmaCd =
      ((1 - state.damageCd) * params.Kn_cd * (Math.max(0, getWorldZ(subtract(state.cell, cellRest))) + 0.14 * driveLift)) /
      Math.max(1, params.Hc * 0.22);
    const tauCd = ((1 - state.damageCd) * params.Kt_cd * (Math.abs(subtract(state.cell, cellRest).x) + 0.2 * driveInward + 0.58 * driveTangent)) / Math.max(1, params.Lc * 0.18);
    const ncWeights = buildNcRegionWeights(punctureSide, oppositeSide, driveLiftN, driveInwardN, driveTangentN, momentProxy);
    const cdWeights = buildCdRegionWeights(punctureSide, driveLiftN, driveInwardN, driveTangentN, momentProxy);

    const interfaceForceNc = add(scale(boundary.outward, -(1 - state.damageNc) * params.Kn_nc * deltaNormal), scale(boundary.inward, -(1 - state.damageNc) * params.Kt_nc * relative.x * 0.22));
    const dampingForceNc = scale(relVelocity, -0.18 * (params.etan + params.etac));
    const compressiveNc = scale(boundary.outward, -NUMERICS.compressivePenalty * Math.min(0, dot(relative, boundary.outward)));
    const totalNcForce = add(add(interfaceForceNc, dampingForceNc), compressiveNc);
    const tangentialInterfaceForceNc = -(1 - state.damageNc) * params.Kt_nc * deltaShear - 0.18 * (params.etan + params.etac) * relVelocityTangential;

    const deltaCd = subtract(state.cell, cellRest);
    const adhesionForce = {
      x: -(1 - state.damageCd) * params.Kt_cd * deltaCd.x,
      y: -(1 - state.damageCd) * params.Kn_cd * Math.max(0, getWorldZ(deltaCd)),
    };
    const tangentialAdhesionForce = -(1 - state.damageCd) * params.Kt_cd * state.tangentCell - params.etac * state.velocityTangentCell * 0.04;
    const compressionDish = {
      x: 0,
      y: -NUMERICS.compressivePenalty * Math.min(0, getWorldZ(state.cell) - params.Hc * 0.48),
    };
    const cellBulk = { x: -NUMERICS.bulkCell * params.Ec * deltaCd.x - params.etac * state.velocityCell.x * 0.05, y: -NUMERICS.bulkCell * params.Ec * deltaCd.y - params.etac * state.velocityCell.y * 0.05 };
    const nucleusBulkDisp = subtract(state.nucleus, nucleusRest);
    const nucleusBulk = { x: -NUMERICS.bulkNucleus * enEff * nucleusBulkDisp.x - params.etan * state.velocityNucleus.x * 0.05, y: -NUMERICS.bulkNucleus * enEff * nucleusBulkDisp.y - params.etan * state.velocityNucleus.y * 0.05 };
    const nucleusBulkTangential = -NUMERICS.bulkNucleus * enEff * state.tangentNucleus - params.etan * state.velocityTangentNucleus * 0.05;
    const cellBulkTangential = -NUMERICS.bulkCell * params.Ec * state.tangentCell - params.etac * state.velocityTangentCell * 0.05;

    const membraneStrain =
      Math.abs(deltaCd.x) / Math.max(params.Lc, 1) +
      Math.max(0, getWorldZ(deltaCd)) / Math.max(params.Hc, 1) +
      0.45 * Math.abs(relative.x) / Math.max(params.Ln, 1) +
      0.7 * Math.max(0, getWorldZ(relative)) / Math.max(params.Hn, 1) +
      0.24 * Math.abs(relativeTangential) / Math.max(params.Ln, 1) +
      0.035 * driveTangent +
      0.06 * holdForceMag;
    const membraneStress = params.Tm * membraneStrain + 0.2 * Math.abs(dot(holdForceVector, boundary.outward)) + 0.08 * Math.abs(dot(holdForceVector, boundary.inward)) + 0.14 * Math.abs(holdTangentialForce);
    const membraneRegions = buildMembraneStressByRegion(membraneStress, deltaCd, params, driveLiftN, driveInwardN, driveTangentN, momentProxy);
    const membraneForce = {
      x: -params.Tm * (deltaCd.x / Math.max(params.Lc, 1) + 0.2 * relative.x / Math.max(params.Ln, 1)),
      y:
        -params.Tm *
        (getWorldZ(deltaCd) / Math.max(params.Hc, 1) +
          0.3 * Math.max(0, getWorldZ(relative)) / Math.max(params.Hn, 1)),
    };

    if (state.captureEstablished) {
      NC_REGIONS.forEach((region) => {
        const response = updateInterfaceRegion(state.localNc[region], sigmaNc * ncWeights[region].normal, tauNc * ncWeights[region].shear, { normal: params.sig_nc_crit, shear: params.tau_nc_crit }, params.Gc_nc, NUMERICS.damageRateNc, NUMERICS.dt, time);
        if (!state.events.ncDamageStart && response.phi >= 1) {
          maybeMarkEvent(state.events, "ncDamageStart", time, `核-細胞質界面の ${region} 領域で ${response.mode} 損傷が開始しました。`);
        }
      });
      CD_REGIONS.forEach((region) => {
        const adhesion = adhesionProfile[region];
        const response = updateInterfaceRegion(state.localCd[region], sigmaCd * cdWeights[region].normal * adhesion.stiffness, tauCd * cdWeights[region].shear * adhesion.stiffness, { normal: params.sig_cd_crit * adhesion.strength, shear: params.tau_cd_crit * adhesion.strength }, params.Gc_cd, NUMERICS.damageRateCd, NUMERICS.dt, time);
        if (!state.events.cdDamageStart && response.phi >= 1) {
          maybeMarkEvent(state.events, "cdDamageStart", time, `細胞-ディッシュ界面の ${region} 領域で ${response.mode} 損傷が開始しました。`);
        }
      });
      MEMBRANE_REGIONS.forEach((region) => {
        const response = updateMembraneRegion(state.membraneRegions[region], membraneRegions[region], membraneThresholds[region], NUMERICS.dt, time);
        if (!state.events.membraneDamageStart && response.phi >= 1) {
          maybeMarkEvent(state.events, "membraneDamageStart", time, `膜/皮質の ${region} 領域で破断が開始しました。`);
        }
      });
    }

    state.damageNc = Math.max(...NC_REGIONS.map((region) => state.localNc[region].damage));
    state.damageCd = Math.max(...CD_REGIONS.map((region) => state.localCd[region].damage));
    state.damageMembrane = Math.max(...MEMBRANE_REGIONS.map((region) => state.membraneRegions[region].damage));
    if (!state.events.ncDamageProgress) {
      const region = NC_REGIONS.find((entry) => state.localNc[entry].damage >= NUMERICS.damageProgressThreshold);
      if (region) maybeMarkEvent(state.events, "ncDamageProgress", time, `核-細胞質界面の ${region} 領域損傷が進展閾値を超えました。`);
    }
    if (!state.events.cdDamageProgress) {
      const region = CD_REGIONS.find((entry) => state.localCd[entry].damage >= NUMERICS.damageProgressThreshold);
      if (region) maybeMarkEvent(state.events, "cdDamageProgress", time, `細胞-ディッシュ界面の ${region} 領域損傷が進展閾値を超えました。`);
    }
    if (!state.events.membraneDamageProgress) {
      const region = MEMBRANE_REGIONS.find((entry) => state.membraneRegions[entry].damage >= NUMERICS.damageProgressThreshold);
      if (region) maybeMarkEvent(state.events, "membraneDamageProgress", time, `膜/皮質の ${region} 領域損傷が進展閾値を超えました。`);
    }

    const forceOnNucleus = add(holdForceVector, add(totalNcForce, nucleusBulk));
    const forceOnCell = add(add(add(scale(totalNcForce, -1), adhesionForce), cellBulk), add(membraneForce, compressionDish));
    const forceOnNucleusTangential = holdTangentialForce + tangentialInterfaceForceNc + nucleusBulkTangential;
    const forceOnCellTangential = -tangentialInterfaceForceNc + tangentialAdhesionForce + cellBulkTangential;
    state.velocityNucleus = scale(forceOnNucleus, 1 / NUMERICS.dampingNucleus);
    state.velocityCell = scale(forceOnCell, 1 / NUMERICS.dampingCell);
    state.velocityTangentNucleus = forceOnNucleusTangential / NUMERICS.dampingNucleus;
    state.velocityTangentCell = forceOnCellTangential / NUMERICS.dampingCell;
    state.nucleus = add(state.nucleus, scale(state.velocityNucleus, NUMERICS.dt * NUMERICS.nucleusMobility));
    state.cell = add(state.cell, scale(state.velocityCell, NUMERICS.dt * NUMERICS.cellMobility));
    state.tangentNucleus += state.velocityTangentNucleus * NUMERICS.dt * NUMERICS.nucleusMobility;
    state.tangentCell += state.velocityTangentCell * NUMERICS.dt * NUMERICS.cellMobility;
    if (!state.pipette.slipped && state.captureEstablished) state.captureMaintained = true;

    const nucleusStress = Math.hypot(lengthOf(add(holdForceVector, totalNcForce)), Math.abs(forceOnNucleusTangential)) / nucleusArea;
    const cytoplasmStress = Math.hypot(lengthOf(subtract(forceOnCell, adhesionForce)), Math.abs(forceOnCellTangential)) / cellArea;
    peaks.peakNucleusStress = Math.max(peaks.peakNucleusStress, nucleusStress);
    peaks.peakCytoplasmStress = Math.max(peaks.peakCytoplasmStress, cytoplasmStress);
    peaks.peakMembraneStress = Math.max(peaks.peakMembraneStress, membraneStress);
    peaks.peakMembraneStrain = Math.max(peaks.peakMembraneStrain, membraneStrain);
    peaks.peakNcNormal = Math.max(...NC_REGIONS.map((region) => state.localNc[region].peakNormal));
    peaks.peakNcShear = Math.max(...NC_REGIONS.map((region) => state.localNc[region].peakShear));
    peaks.peakCdNormal = Math.max(...CD_REGIONS.map((region) => state.localCd[region].peakNormal));
    peaks.peakCdShear = Math.max(...CD_REGIONS.map((region) => state.localCd[region].peakShear));

    state.history.push({
      time,
      phase: target.phase,
      pipette: { ...tip },
      nucleus: { ...state.nucleus },
      cell: { ...state.cell },
      sigmaNc,
      tauNc,
      sigmaCd,
      tauCd,
      membraneStress,
      membraneStrain,
      damageNc: state.damageNc,
      damageCd: state.damageCd,
      damageMembrane: state.damageMembrane,
      holdForce: holdForceMag,
      tangentialDrive: driveTangent,
      tangentialOffset: state.tangentNucleus,
      operation: { ...operation },
      contactAngle,
      holdStiffnessEffective,
      localNc: cloneLocalInterfaceState(state.localNc),
      localCd: cloneLocalInterfaceState(state.localCd),
      membraneRegions: cloneMembraneState(state.membraneRegions),
      momentProxy,
    });
  }

  const result = {
    caseName,
    params: structuredClone(params),
    schedule,
    history: state.history,
    events: state.events,
    damage: { nc: state.damageNc, cd: state.damageCd, membrane: state.damageMembrane },
    peaks,
    captureEstablished: state.captureEstablished,
    captureMaintained: state.captureMaintained && !state.pipette.slipped,
    finalState: {
      pipette: { x: state.pipette.x, y: state.pipette.y, slipped: state.pipette.slipped },
      cell: state.cell,
      nucleus: state.nucleus,
      boundary: lastBoundary,
    },
    displacements: {
      cell: lengthOf(subtract(state.cell, cellRest)),
      nucleus: lengthOf(subtract(state.nucleus, nucleusRest)),
      tangentCell: Math.abs(state.tangentCell),
      tangentNucleus: Math.abs(state.tangentNucleus),
    },
    localNc: cloneLocalInterfaceState(state.localNc),
    localCd: cloneLocalInterfaceState(state.localCd),
    membraneRegions: cloneMembraneState(state.membraneRegions),
    contactAngle: state.contactAngle,
    holdStiffnessEffective: state.holdStiffnessEffective,
  };
  const firstFailure = findEarliestLocalFailure(result);
  result.firstFailureSite = firstFailure.site;
  result.firstFailureMode = firstFailure.mode;
  result.classification = "no_capture_general";
  result.dominantMechanism = determineDominantMechanism(result);
  result.classification = classifyRun(result);
  result.dominantMechanism = determineDominantMechanism(result);
  return result;
}

function createFebioMeshBuilder(thickness) {
  const nodes = [];
  const elements = [];
  const surfaces = {};
  const nodeSets = {};
  const elementSets = {};
  const surfacePairs = {};
  const nodeLookup = new Map();
  let nextElementId = 1;
  let nextSurfaceFacetId = 1;

  function keyForNode(x, y, z, nodeGroup) {
    return [nodeGroup || "global", x, y, z]
      .map((value) => (typeof value === "number" ? Number(value).toFixed(6) : String(value)))
      .join("|");
  }

  function addNode(x, y, z, nodeGroup = "global") {
    const key = keyForNode(x, y, z, nodeGroup);
    if (nodeLookup.has(key)) {
      return nodeLookup.get(key);
    }
    const id = nodes.length + 1;
    nodes.push({ id, x, y, z });
    nodeLookup.set(key, id);
    return id;
  }

  function addToSet(collection, name, ids) {
    if (!name) {
      return;
    }
    if (!collection[name]) {
      collection[name] = new Set();
    }
    ids.forEach((id) => collection[name].add(id));
  }

  function addSurfaceFacet(name, type, nodeIds) {
    if (!name) {
      return;
    }
    if (!surfaces[name]) {
      surfaces[name] = [];
    }
    surfaces[name].push({ id: nextSurfaceFacetId++, type, nodes: nodeIds });
  }

  function addHexBlock(partName, x0, x1, z0, z1, metadata = {}) {
    if (Math.abs(x1 - x0) < 1e-6 || Math.abs(z1 - z0) < 1e-6) {
      return null;
    }
    const y0 = -thickness / 2;
    const y1 = thickness / 2;
    const nodeGroup = metadata.nodeGroup || partName;
    const nodeIds = [
      addNode(x0, y0, z0, nodeGroup),
      addNode(x1, y0, z0, nodeGroup),
      addNode(x1, y1, z0, nodeGroup),
      addNode(x0, y1, z0, nodeGroup),
      addNode(x0, y0, z1, nodeGroup),
      addNode(x1, y0, z1, nodeGroup),
      addNode(x1, y1, z1, nodeGroup),
      addNode(x0, y1, z1, nodeGroup),
    ];
    const element = {
      id: nextElementId++,
      type: "hex8",
      nodes: nodeIds,
      part: partName,
      material: metadata.material || partName,
    };
    elements.push(element);
    addToSet(elementSets, partName, [element.id]);
    addToSet(nodeSets, `${partName}_nodes`, nodeIds);

    const faces = {
      zmin: [nodeIds[0], nodeIds[1], nodeIds[2], nodeIds[3]],
      zmax: [nodeIds[4], nodeIds[5], nodeIds[6], nodeIds[7]],
      xmin: [nodeIds[0], nodeIds[3], nodeIds[7], nodeIds[4]],
      xmax: [nodeIds[1], nodeIds[2], nodeIds[6], nodeIds[5]],
      ymin: [nodeIds[0], nodeIds[1], nodeIds[5], nodeIds[4]],
      ymax: [nodeIds[3], nodeIds[2], nodeIds[6], nodeIds[7]],
    };

    Object.entries(metadata.surfaceNames || {}).forEach(([faceKey, surfaceName]) => {
      const names = Array.isArray(surfaceName) ? surfaceName : [surfaceName];
      names.filter(Boolean).forEach((name) => addSurfaceFacet(name, "quad4", faces[faceKey]));
    });

    return { element, faces, nodeIds };
  }

  function addSurfacePair(name, primary, secondary) {
    surfacePairs[name] = { name, primary, secondary };
  }

  function finalize() {
    addToSet(nodeSets, "all_nodes_set", nodes.map((node) => node.id));
    const pipetteNodeIds = nodeSets.pipette_nodes ? Array.from(nodeSets.pipette_nodes) : [];
    const pipetteNodeLookup = new Set(pipetteNodeIds);
    addToSet(
      nodeSets,
      "deformable_nodes_set",
      nodes.filter((node) => !pipetteNodeLookup.has(node.id)).map((node) => node.id),
    );
    return {
      nodes,
      elements,
      surfaces: Object.fromEntries(
        Object.entries(surfaces).map(([name, facets]) => [name, facets]),
      ),
      nodeSets: Object.fromEntries(
        Object.entries(nodeSets).map(([name, ids]) => [name, Array.from(ids)]),
      ),
      elementSets: Object.fromEntries(
        Object.entries(elementSets).map(([name, ids]) => [name, Array.from(ids)]),
      ),
      surfacePairs,
    };
  }

  return {
    addHexBlock,
    addToNodeSet: (name, ids) => addToSet(nodeSets, name, ids),
    addToElementSet: (name, ids) => addToSet(elementSets, name, ids),
    addSurfacePair,
    finalize,
  };
}

// mesh placeholder: replace coarse block meshing with refined meshing later.
function buildNucleusMesh(builder, inputSpec, bounds) {
  const xCuts = [bounds.nucleusLeft, inputSpec.geometry.xn, bounds.nucleusRight];
  const zCuts = [bounds.nucleusBottom, inputSpec.geometry.yn, bounds.nucleusTop];
  const blocks = [];
  for (let zi = 0; zi < zCuts.length - 1; zi += 1) {
    for (let xi = 0; xi < xCuts.length - 1; xi += 1) {
      const surfaceNames = {};
      if (xi === 0) {
        surfaceNames.xmin = ["nucleus_interface_surface", "nucleus_interface_left_surface"];
      }
      if (xi === xCuts.length - 2) {
        surfaceNames.xmax = ["nucleus_interface_surface", "nucleus_interface_right_surface"];
      }
      if (zi === 0) {
        surfaceNames.zmin = ["nucleus_interface_surface", "nucleus_interface_bottom_surface"];
      }
      if (zi === zCuts.length - 2) {
        surfaceNames.zmax = ["nucleus_interface_surface", "nucleus_interface_top_surface", "nucleus_top_surface"];
      }
      const block = builder.addHexBlock("nucleus", xCuts[xi], xCuts[xi + 1], zCuts[zi], zCuts[zi + 1], {
        material: "nucleus",
        nodeGroup: "nucleus",
        surfaceNames,
      });
      if (block) {
        blocks.push(block);
        if (xi === 0) {
          builder.addToNodeSet("nc_left_nucleus_nodes", block.faces.xmin);
        }
        if (xi === xCuts.length - 2) {
          builder.addToNodeSet("nc_right_nucleus_nodes", block.faces.xmax);
        }
        if (zi === 0) {
          builder.addToNodeSet("nc_bottom_nucleus_nodes", block.faces.zmin);
        }
        if (zi === zCuts.length - 2) {
          builder.addToNodeSet("nc_top_nucleus_nodes", block.faces.zmax);
        }
      }
    }
  }
  return blocks;
}

// mesh placeholder: replace coarse geometry with refined meshing later.
function buildCellMesh(builder, inputSpec, bounds) {
  const xCuts = [bounds.cellLeft, bounds.nucleusLeft, inputSpec.geometry.xn, bounds.nucleusRight, bounds.cellRight];
  const zCuts = [0, bounds.nucleusBottom, inputSpec.geometry.yn, bounds.nucleusTop, bounds.cellTop];
  const blocks = [];
  for (let zi = 0; zi < zCuts.length - 1; zi += 1) {
    for (let xi = 0; xi < xCuts.length - 1; xi += 1) {
      const insideNucleusHole = (xi === 1 || xi === 2) && (zi === 1 || zi === 2);
      if (insideNucleusHole) {
        continue;
      }
      const x0 = xCuts[xi];
      const x1 = xCuts[xi + 1];
      const z0 = zCuts[zi];
      const z1 = zCuts[zi + 1];
      const surfaceNames = {};
      if (zi === 0) {
        const basalRegion =
          xi === 0 ? "left" : xi === xCuts.length - 2 ? "right" : "center";
        surfaceNames.zmin = ["cell_dish_surface", `cell_dish_${basalRegion}_surface`];
      }
      if (zi === zCuts.length - 2) {
        surfaceNames.zmax = "cell_top_surface";
      }
      if (xi === 0 && (zi === 1 || zi === 2)) {
        surfaceNames.xmax = ["cytoplasm_interface_surface", "cytoplasm_interface_left_surface"];
      }
      if (xi === xCuts.length - 2 && (zi === 1 || zi === 2)) {
        surfaceNames.xmin = ["cytoplasm_interface_surface", "cytoplasm_interface_right_surface"];
      }
      if (zi === 0 && (xi === 1 || xi === 2)) {
        surfaceNames.zmax = ["cytoplasm_interface_surface", "cytoplasm_interface_bottom_surface"];
      }
      if (zi === zCuts.length - 2 && (xi === 1 || xi === 2)) {
        surfaceNames.zmin = ["cytoplasm_interface_surface", "cytoplasm_interface_top_surface"];
      }
      const block = builder.addHexBlock("cytoplasm", x0, x1, z0, z1, {
        material: "cytoplasm",
        nodeGroup: "cytoplasm",
        surfaceNames,
      });
      if (block) {
        blocks.push(block);
        if (zi === 0) {
          builder.addToNodeSet("cell_base_nodes", block.nodeIds);
          if (xi === 0) {
            builder.addToNodeSet("cd_left_cell_nodes", block.faces.zmin);
          } else if (xi === xCuts.length - 2) {
            builder.addToNodeSet("cd_right_cell_nodes", block.faces.zmin);
          } else {
            builder.addToNodeSet("cd_center_cell_nodes", block.faces.zmin);
          }
        }
        if (xi === 0 && (zi === 1 || zi === 2)) {
          builder.addToNodeSet("nc_left_cytoplasm_nodes", block.faces.xmax);
        }
        if (xi === xCuts.length - 2 && (zi === 1 || zi === 2)) {
          builder.addToNodeSet("nc_right_cytoplasm_nodes", block.faces.xmin);
        }
        if (zi === 0 && (xi === 1 || xi === 2)) {
          builder.addToNodeSet("nc_bottom_cytoplasm_nodes", block.faces.zmax);
        }
        if (zi === zCuts.length - 2 && (xi === 1 || xi === 2)) {
          builder.addToNodeSet("nc_top_cytoplasm_nodes", block.faces.zmin);
        }
      }
    }
  }
  return blocks;
}

function buildDishGeometry(builder, bounds) {
  const dish = builder.addHexBlock("dish", bounds.cellLeft - 6, bounds.cellRight + 6, -bounds.dishThickness, 0, {
    material: "dish",
    nodeGroup: "dish",
    surfaceNames: {
      zmax: "dish_top_surface",
    },
  });
  if (dish) {
    builder.addToNodeSet("dish_fixed_nodes", dish.nodeIds);
  }
  return dish;
}

function buildPipetteGeometry(builder, inputSpec, bounds) {
  const initialTarget =
    inputSpec.schedule?.targetAt?.(0)?.pos ||
    makeSectionPoint(inputSpec.geometry.xn + inputSpec.geometry.xp, inputSpec.geometry.zp + inputSpec.geometry.rp + 3.2);
  const pipetteCenterX = getSectionX(initialTarget);
  const shaftHalf = Math.max(inputSpec.geometry.rp, 0.8);
  const pipetteTop = bounds.cellTop + Math.max(inputSpec.geometry.Hn * 0.8, inputSpec.geometry.rp * 3);
  const pipette = builder.addHexBlock(
    "pipette",
    pipetteCenterX - shaftHalf,
    pipetteCenterX + shaftHalf,
    getWorldZ(initialTarget),
    pipetteTop,
    {
      material: "pipette",
      nodeGroup: "pipette",
      surfaceNames: {
        zmin: "pipette_contact_surface",
      },
    },
  );
  if (pipette) {
    builder.addToNodeSet("pipette_nodes", pipette.nodeIds);
  }
  return pipette;
}

function buildCoarseFebioGeometry(inputSpec) {
  const thickness = Math.max(0.4, inputSpec.geometry.rp * 0.22);
  const bounds = {
    cellLeft: -inputSpec.geometry.Lc / 2,
    cellRight: inputSpec.geometry.Lc / 2,
    cellTop: inputSpec.geometry.Hc,
    nucleusLeft: inputSpec.geometry.xn - inputSpec.geometry.Ln / 2,
    nucleusRight: inputSpec.geometry.xn + inputSpec.geometry.Ln / 2,
    nucleusBottom: inputSpec.geometry.yn - inputSpec.geometry.Hn / 2,
    nucleusTop: inputSpec.geometry.yn + inputSpec.geometry.Hn / 2,
    dishThickness: Math.max(1.6, inputSpec.geometry.Hc * 0.18),
  };

  bounds.nucleusBottom = clamp(bounds.nucleusBottom, 0.8, Math.max(bounds.cellTop - 1.2, 1));
  bounds.nucleusTop = clamp(bounds.nucleusTop, bounds.nucleusBottom + 0.8, bounds.cellTop - 0.4);
  bounds.nucleusLeft = clamp(bounds.nucleusLeft, bounds.cellLeft + 0.8, bounds.cellRight - 1.6);
  bounds.nucleusRight = clamp(bounds.nucleusRight, bounds.nucleusLeft + 0.8, bounds.cellRight - 0.8);

  const builder = createFebioMeshBuilder(thickness);
  buildNucleusMesh(builder, inputSpec, bounds);
  buildCellMesh(builder, inputSpec, bounds);
  buildDishGeometry(builder, bounds);
  buildPipetteGeometry(builder, inputSpec, bounds);

  builder.addSurfacePair("nucleus_cytoplasm_pair", "cytoplasm_interface_surface", "nucleus_interface_surface");
  builder.addSurfacePair("cell_dish_pair", "cell_dish_surface", "dish_top_surface");
  builder.addSurfacePair("pipette_nucleus_pair", "nucleus_top_surface", "pipette_contact_surface");
  builder.addSurfacePair("pipette_cell_pair", "cell_top_surface", "pipette_contact_surface");

  return {
    thickness,
    bounds,
    ...builder.finalize(),
  };
}

function buildFebioLogOutputs(mesh, templateData) {
  const nodeSetOutputs = [
    ["nucleus_nodes", "febio_nucleus_nodes.csv"],
    ["cytoplasm_nodes", "febio_cytoplasm_nodes.csv"],
    ["nc_left_nucleus_nodes", "febio_nc_left_nucleus.csv"],
    ["nc_right_nucleus_nodes", "febio_nc_right_nucleus.csv"],
    ["nc_top_nucleus_nodes", "febio_nc_top_nucleus.csv"],
    ["nc_bottom_nucleus_nodes", "febio_nc_bottom_nucleus.csv"],
    ["nc_left_cytoplasm_nodes", "febio_nc_left_cytoplasm.csv"],
    ["nc_right_cytoplasm_nodes", "febio_nc_right_cytoplasm.csv"],
    ["nc_top_cytoplasm_nodes", "febio_nc_top_cytoplasm.csv"],
    ["nc_bottom_cytoplasm_nodes", "febio_nc_bottom_cytoplasm.csv"],
    ["cd_left_cell_nodes", "febio_cd_left_cell.csv"],
    ["cd_center_cell_nodes", "febio_cd_center_cell.csv"],
    ["cd_right_cell_nodes", "febio_cd_right_cell.csv"],
  ]
    .filter(([nodeSetName]) => Array.isArray(mesh.nodeSets[nodeSetName]) && mesh.nodeSets[nodeSetName].length > 0)
    .map(([nodeSetName, file]) => ({
      type: "node_data",
      name: nodeSetName,
      file,
      data: "ux;uz;Rx;Rz",
      itemIds: mesh.nodeSets[nodeSetName],
      delimiter: ",",
    }));

  return {
    nodeData: nodeSetOutputs,
    rigidBodyData: [
      {
        type: "rigid_body_data",
        name: "pipette_rigid_body",
        file: "febio_rigid_pipette.csv",
        data: "x;z;Fx;Fz",
        itemIds: [templateData.materials.pipette.id],
        delimiter: ",",
      },
    ],
    faceData: [
      {
        type: "face_data",
        name: "pipette_contact_surface",
        file: "febio_pipette_contact.csv",
        data: "contact gap;contact pressure",
        surface: "pipette_contact_surface",
        delimiter: ",",
      },
    ],
  };
}

// -----------------------------------------------------------------------------
// febio bridge
// -----------------------------------------------------------------------------
// FEM handoff point: this reduced-order template is the handoff boundary for future
// .feb XML serialization and FEBio CLI execution.
// TODO: buildFebioTemplateData -> serializeFebioTemplateToXml -> FEBio CLI execution
// TODO: convert FEBio displacement / cohesive damage / traction / contact outputs into JSON
// TODO: normalizeSimulationResult should remain the single convergence point for lightweight/FEBio outputs
// TODO: add solver comparison mode once FEBio produces real outputs
function buildFebioTemplateData(inputSpec) {
  const schedule = inputSpec.schedule;
  const mesh = buildCoarseFebioGeometry(inputSpec);
  const initialTarget = schedule.targetAt(0).pos;
  const initialPipetteCenter = [
    getSectionX(initialTarget),
    0,
    (getWorldZ(initialTarget) + mesh.bounds.cellTop + Math.max(inputSpec.geometry.Hn * 0.8, inputSpec.geometry.rp * 3)) / 2,
  ];
  const makeStep = (name, phaseKey, label) => ({
    name,
    phase: phaseKey,
    label,
    endTime: schedule.phaseEnds[phaseKey],
    control: serializeControl(schedule.targetAt(schedule.phaseEnds[phaseKey])),
  });
  const stepSequence = [
    makeStep("approach", "phase0", "pipette approach"),
    makeStep("hold", "phase1", "capture / hold"),
    makeStep("lift", "phase2", "vertical lift"),
    makeStep("manipulation", "phase3", "case-specific manipulation"),
    {
      name: "release-test",
      phase: "total",
      label: "release test",
      endTime: schedule.phaseEnds.total,
      control: serializeControl(schedule.targetAt(schedule.phaseEnds.total)),
    },
  ].map((step, index, steps) => {
    const previous = index === 0 ? initialTarget : steps[index - 1].control.pos;
    const deltaX = step.control.pos.x - previous.x;
    const deltaZ = step.control.pos.y - previous.y;
    return {
      ...step,
      duration:
        index === 0
          ? schedule.phaseEnds.phase0
          : Math.max(step.endTime - steps[index - 1].endTime, 1e-6),
      rigidMotion: {
        x: { scale: deltaX, points: [[0, 0], [1, 1]] },
        z: { scale: deltaZ, points: [[0, 0], [1, 1]] },
      },
    };
  });

  const templateData = {
    coordinateSystem: structuredClone(inputSpec.coordinates || COORDINATE_SYSTEM_SPEC),
    geometry: {
      mesh: {
        nodes: mesh.nodes,
        elements: mesh.elements,
        surfaces: mesh.surfaces,
        nodeSets: mesh.nodeSets,
        elementSets: mesh.elementSets,
        surfacePairs: mesh.surfacePairs,
      },
      nucleus: {
        shape: "ellipse",
        width: inputSpec.geometry.Ln,
        height: inputSpec.geometry.Hn,
        center: { x: inputSpec.geometry.xn, z: inputSpec.geometry.yn },
      },
      cytoplasm: {
        shape: "cap",
        width: inputSpec.geometry.Lc,
        height: inputSpec.geometry.Hc,
        dishZ: 0,
      },
      membrane: {
        attachment: "cytoplasm_outer_surface",
        thresholds: {
          global: inputSpec.membrane.sig_m_crit,
          top_neck: inputSpec.membrane.sig_m_crit_top,
          side: inputSpec.membrane.sig_m_crit_side,
          basal: inputSpec.membrane.sig_m_crit_basal,
        },
      },
      dish: {
        type: "rigid_plane",
        heightZ: 0,
      },
      pipette: {
        radius: inputSpec.geometry.rp,
        puncture: { x: inputSpec.geometry.xp, z: inputSpec.geometry.zp },
        axis: "vertical_section_axis",
      },
    },
    materials: {
      nucleus: {
        id: 1,
        name: "nucleus",
        type: "neo-Hookean",
        domain: "nucleus",
        E: inputSpec.material.En,
        v: inputSpec.material.nun,
        eta: inputSpec.material.etan,
        alphaNonlinear: inputSpec.material.alpha_nonlinear,
      },
      cytoplasm: {
        id: 2,
        name: "cytoplasm",
        type: "neo-Hookean",
        domain: "cytoplasm",
        E: inputSpec.material.Ec,
        v: inputSpec.material.nuc,
        eta: inputSpec.material.etac,
      },
      membrane: { id: 3, name: "membrane", type: "membrane-placeholder", domain: null, tension: inputSpec.membrane.Tm },
      dish: { id: 4, name: "dish", type: "neo-Hookean", domain: "dish", E: Math.max(inputSpec.material.Ec * 40, 250), v: 0.3 },
      pipette: {
        id: 5,
        name: "pipette_rigid",
        type: "rigid body",
        domain: "pipette",
        E: Math.max(inputSpec.material.En * 60, 600),
        v: 0.25,
        density: 1,
        center_of_mass: initialPipetteCenter,
        isRigid: true,
      },
    },
    interfaces: {
      nucleusCytoplasm: {
        type: "tied-elastic",
        surfacePair: mesh.surfacePairs.nucleus_cytoplasm_pair,
        Kn: inputSpec.interfaces.Kn_nc,
        Kt: inputSpec.interfaces.Kt_nc,
        sigCrit: inputSpec.interfaces.sig_nc_crit,
        tauCrit: inputSpec.interfaces.tau_nc_crit,
        gc: inputSpec.interfaces.Gc_nc,
        tolerance: 0.2,
      },
      cellDish: {
        type: "tied-elastic",
        surfacePair: mesh.surfacePairs.cell_dish_pair,
        Kn: inputSpec.interfaces.Kn_cd,
        Kt: inputSpec.interfaces.Kt_cd,
        sigCrit: inputSpec.interfaces.sig_cd_crit,
        tauCrit: inputSpec.interfaces.tau_cd_crit,
        gc: inputSpec.interfaces.Gc_cd,
        adhesionPattern: inputSpec.adhesionPattern,
        adhesionSeed: inputSpec.adhesionSeed,
        tolerance: 0.2,
      },
    },
    contact: {
      pipetteNucleus: {
        type: "sticky",
        mode: "capture-hold",
        tolerance: 0.2,
        searchTolerance: inputSpec.operation.contact_tol,
        searchRadius: Math.max(inputSpec.geometry.rp * 2.2, 1.5),
        surfacePair: mesh.surfacePairs.pipette_nucleus_pair,
        penalty: Math.max(inputSpec.interfaces.Kn_nc * 10, 10),
        symmetricStiffness: 0,
        autoPenalty: 1,
        friction: Math.max(inputSpec.operation.mu_p, 0),
        maxTraction: Math.max(inputSpec.operation.Fhold * 0.7, 0.2),
        snapTolerance: Math.max(inputSpec.geometry.rp * 0.25, 0.15),
      },
      pipetteCell: {
        type: "sliding-elastic",
        mode: "secondary-contact-proxy",
        tolerance: 0.2,
        searchTolerance: inputSpec.operation.contact_tol * 1.2,
        searchRadius: Math.max(inputSpec.geometry.rp * 2.5, 1.5),
        surfacePair: mesh.surfacePairs.pipette_cell_pair,
        penalty: Math.max(inputSpec.interfaces.Kn_cd * 8, 8),
        symmetricStiffness: 0,
        autoPenalty: 1,
        friction: Math.max(inputSpec.operation.mu_p * 0.35, 0),
      },
    },
    rigid: {
      pipette: {
        materialName: "pipette_rigid",
        nodeSet: "pipette_nodes",
        fixed: {
          Ry_dof: 1,
          Ru_dof: 1,
          Rv_dof: 1,
          Rw_dof: 1,
        },
      },
    },
    steps: stepSequence,
    outputRequests: [
      { field: "displacement", target: "nodes" },
      { field: "interface damage", target: "cohesive surfaces" },
      { field: "interface traction", target: "cohesive surfaces" },
      { field: "contact force", target: "pipette contact" },
      { field: "membrane stress proxy", target: "membrane regions" },
    ],
  };
  // TODO: buildFebioTemplateData から .feb XML を生成
  // TODO: FEBio CLI 実行
  // TODO: FEBio 出力（変位、界面損傷、接触反力）の JSON 変換
  // TODO: normalizeSimulationResult で lightweight / FEBio の出力を共通化
  // TODO: solver comparison mode の追加
  templateData.interfaceRegions = {
    localNc: {
      left: {
        nucleusNodeSet: "nc_left_nucleus_nodes",
        cytoplasmNodeSet: "nc_left_cytoplasm_nodes",
        nucleusSurface: "nucleus_interface_left_surface",
        cytoplasmSurface: "cytoplasm_interface_left_surface",
      },
      right: {
        nucleusNodeSet: "nc_right_nucleus_nodes",
        cytoplasmNodeSet: "nc_right_cytoplasm_nodes",
        nucleusSurface: "nucleus_interface_right_surface",
        cytoplasmSurface: "cytoplasm_interface_right_surface",
      },
      top: {
        nucleusNodeSet: "nc_top_nucleus_nodes",
        cytoplasmNodeSet: "nc_top_cytoplasm_nodes",
        nucleusSurface: "nucleus_interface_top_surface",
        cytoplasmSurface: "cytoplasm_interface_top_surface",
      },
      bottom: {
        nucleusNodeSet: "nc_bottom_nucleus_nodes",
        cytoplasmNodeSet: "nc_bottom_cytoplasm_nodes",
        nucleusSurface: "nucleus_interface_bottom_surface",
        cytoplasmSurface: "cytoplasm_interface_bottom_surface",
      },
    },
    localCd: {
      left: {
        cellNodeSet: "cd_left_cell_nodes",
        cellSurface: "cell_dish_left_surface",
        dishSurface: "dish_top_surface",
      },
      center: {
        cellNodeSet: "cd_center_cell_nodes",
        cellSurface: "cell_dish_center_surface",
        dishSurface: "dish_top_surface",
      },
      right: {
        cellNodeSet: "cd_right_cell_nodes",
        cellSurface: "cell_dish_right_surface",
        dishSurface: "dish_top_surface",
      },
    },
  };
  templateData.logOutputs = buildFebioLogOutputs(mesh, templateData);
  return templateData;
}
function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatVector(values) {
  return values.map((value) => Number(value).toFixed(6)).join(",");
}

function serializeMaterialXml(material) {
  if (material.type === "rigid body") {
    const centerOfMass = material.center_of_mass || [0, 0, 0];
    return `    <material id="${material.id}" name="${escapeXml(material.name)}" type="rigid body">
      <density>${Number(material.density || 1).toFixed(6)}</density>
      <center_of_mass>${formatVector(centerOfMass)}</center_of_mass>
      <E>${Number(material.E || 0).toFixed(6)}</E>
      <v>${Number(material.v || 0.3).toFixed(6)}</v>
    </material>`;
  }
  return `    <material id="${material.id}" name="${escapeXml(material.name)}" type="${escapeXml(material.type)}">
      <E>${Number(material.E || 0).toFixed(6)}</E>
      <v>${Number(material.v || 0.3).toFixed(6)}</v>
    </material>`;
}

function serializeSurfaceXml(name, facets) {
  return `    <Surface name="${escapeXml(name)}">
${facets
  .map(
    (facet) =>
      `      <${facet.type} id="${facet.id}">${facet.nodes.join(",")}</${facet.type}>`,
  )
  .join("\n")}
    </Surface>`;
}

function serializeTiedContactXml(name, spec) {
  return `    <contact name="${escapeXml(name)}" type="${escapeXml(spec.type)}" surface_pair="${escapeXml(spec.surfacePair.name)}">
      <penalty>${Number(spec.Kn || 1).toFixed(6)}</penalty>
      <tolerance>${Number(spec.tolerance || 0.2).toFixed(6)}</tolerance>
    </contact>`;
}

function serializeSlidingContactXml(name, spec) {
  return `    <contact name="${escapeXml(name)}" type="${escapeXml(spec.type)}" surface_pair="${escapeXml(spec.surfacePair.name)}">
      <penalty>${Number(spec.penalty || 1).toFixed(6)}</penalty>
      <auto_penalty>${spec.autoPenalty ? 1 : 0}</auto_penalty>
      <two_pass>0</two_pass>
      <laugon>0</laugon>
      <tolerance>${Number(spec.tolerance || 0.2).toFixed(6)}</tolerance>
      <search_tol>${Number(spec.searchTolerance || 0.01).toFixed(6)}</search_tol>
      <search_radius>${Number(spec.searchRadius || 1).toFixed(6)}</search_radius>
      <symmetric_stiffness>${spec.symmetricStiffness ? 1 : 0}</symmetric_stiffness>
      <fric_coeff>${Number(spec.friction || 0).toFixed(6)}</fric_coeff>
    </contact>`;
}

function serializeStickyContactXml(name, spec) {
  return `    <contact name="${escapeXml(name)}" type="sticky" surface_pair="${escapeXml(spec.surfacePair.name)}">
      <penalty>${Number(spec.penalty || 1).toFixed(6)}</penalty>
      <laugon>0</laugon>
      <tolerance>${Number(spec.tolerance || 0.2).toFixed(6)}</tolerance>
      <minaug>0</minaug>
      <maxaug>10</maxaug>
      <search_tolerance>${Number(spec.searchTolerance || 0.01).toFixed(6)}</search_tolerance>
      <max_traction>${Number(spec.maxTraction || 0).toFixed(6)}</max_traction>
      <snap_tol>${Number(spec.snapTolerance || 0.1).toFixed(6)}</snap_tol>
    </contact>`;
}

function serializeRigidBoundaryXml(rigidSpec) {
  return `    <rigid_bc type="rigid_fixed">
      <rb>${escapeXml(rigidSpec.materialName)}</rb>
      <Ry_dof>${rigidSpec.fixed?.Ry_dof ? 1 : 0}</Ry_dof>
      <Ru_dof>${rigidSpec.fixed?.Ru_dof ? 1 : 0}</Ru_dof>
      <Rv_dof>${rigidSpec.fixed?.Rv_dof ? 1 : 0}</Rv_dof>
      <Rw_dof>${rigidSpec.fixed?.Rw_dof ? 1 : 0}</Rw_dof>
    </rigid_bc>`;
}

function serializeRigidDisplacementXml(materialName, dof, value) {
  return `      <rigid_bc type="rigid_displacement">
        <rb>${escapeXml(materialName)}</rb>
        <dof>${escapeXml(dof)}</dof>
        <value>${Number(value || 0).toFixed(6)}</value>
        <relative>1</relative>
      </rigid_bc>`;
}

function serializeLogfileSection(logOutputs = {}, materialIdMap = new Map()) {
  const entries = [
    ...(logOutputs.nodeData || []).map(
      (spec) =>
        `      <node_data name="${escapeXml(spec.name)}" file="${escapeXml(spec.file)}" data="${escapeXml(spec.data)}" delim="${escapeXml(spec.delimiter || ",")}">${spec.itemIds.join(",")}</node_data>`,
    ),
    ...(logOutputs.rigidBodyData || []).map(
      (spec) => {
        const remappedIds = (spec.itemIds || []).map((id) => materialIdMap.get(id) || id);
        return `      <rigid_body_data name="${escapeXml(spec.name)}" file="${escapeXml(spec.file)}" data="${escapeXml(spec.data)}" delim="${escapeXml(spec.delimiter || ",")}">${remappedIds.join(",")}</rigid_body_data>`;
      },
    ),
  ];
  if (!entries.length) {
    return "";
  }
  return `    <logfile>\n${entries.join("\n")}\n    </logfile>`;
}

function serializeFebioTemplateToXml(templateData) {
  const mesh = templateData.geometry.mesh;
  const exportMaterials = Object.values(templateData.materials)
    .filter((material) => material.domain)
    .map((material, index) => ({
      ...material,
      exportId: index + 1,
    }));
  const materialIdMap = new Map(exportMaterials.map((material) => [material.id, material.exportId]));
  const materials = exportMaterials
    .map((material) => serializeMaterialXml({ ...material, id: material.exportId }))
    .join("\n");
  const nodesXml = mesh.nodes
    .map((node) => `      <node id="${node.id}">${formatVector([node.x, node.y, node.z])}</node>`)
    .join("\n");
  const elementsByPart = Object.entries(mesh.elementSets).map(([name, ids]) => {
    const partElements = mesh.elements.filter((element) => ids.includes(element.id));
    return `    <Elements type="hex8" name="${escapeXml(name)}">
${partElements
  .map((element) => `      <elem id="${element.id}">${element.nodes.join(",")}</elem>`)
  .join("\n")}
    </Elements>`;
  });
  const surfacesXml = Object.entries(mesh.surfaces).map(([name, facets]) => serializeSurfaceXml(name, facets));
  const nodeSetsXml = Object.entries(mesh.nodeSets).map(
    ([name, ids]) => `    <NodeSet name="${escapeXml(name)}">${ids.join(",")}</NodeSet>`,
  );
  const surfacePairsXml = Object.values(mesh.surfacePairs).map(
    (pair) => `    <SurfacePair name="${escapeXml(pair.name)}">
      <primary>${escapeXml(pair.primary)}</primary>
      <secondary>${escapeXml(pair.secondary)}</secondary>
    </SurfacePair>`,
  );
  const meshDomainsXml = exportMaterials
    .map(
      (material) =>
        `    <SolidDomain name="${escapeXml(material.domain)}" mat="${escapeXml(material.name)}" />`,
    )
    .join("\n");
  const contactXml = [
    serializeTiedContactXml("nucleus_cytoplasm_interface", templateData.interfaces.nucleusCytoplasm),
    serializeTiedContactXml("cell_dish_interface", templateData.interfaces.cellDish),
    templateData.contact.pipetteNucleus.type === "sticky"
      ? serializeStickyContactXml("pipette_nucleus_contact", templateData.contact.pipetteNucleus)
      : serializeSlidingContactXml("pipette_nucleus_contact", templateData.contact.pipetteNucleus),
    serializeSlidingContactXml("pipette_cell_contact", templateData.contact.pipetteCell),
  ].join("\n");
  const rigidRootXml = templateData.rigid?.pipette ? serializeRigidBoundaryXml(templateData.rigid.pipette) : "";
  const stepXml = templateData.steps
    .map((step, index) => {
      return `    <step id="${index + 1}" name="${escapeXml(step.name)}">
    <Control>
      <analysis>static</analysis>
      <time_steps>10</time_steps>
      <step_size>0.1</step_size>
      <plot_level>PLOT_MAJOR_ITRS</plot_level>
      <output_level>OUTPUT_MAJOR_ITRS</output_level>
      <solver>
        <symmetric_stiffness>0</symmetric_stiffness>
      </solver>
    </Control>
    <Rigid>
${serializeRigidDisplacementXml(templateData.rigid.pipette.materialName, "x", step.rigidMotion.x.scale)}
${serializeRigidDisplacementXml(templateData.rigid.pipette.materialName, "z", step.rigidMotion.z.scale)}
    </Rigid>
    </step>`;
    })
    .join("\n");
  const logfileXml = serializeLogfileSection(templateData.logOutputs, materialIdMap);

  return `<?xml version="1.0" encoding="UTF-8"?>
<febio_spec version="4.0">
  <Module type="solid" />
  <Material>
${materials}
  </Material>
  <Mesh>
    <Nodes name="all_nodes">
${nodesXml}
    </Nodes>
${elementsByPart.join("\n")}
${surfacesXml.join("\n")}
${nodeSetsXml.join("\n")}
${surfacePairsXml.join("\n")}
  </Mesh>
  <MeshDomains>
${meshDomainsXml}
  </MeshDomains>
  <Boundary>
    <bc name="fix_dish" node_set="dish_fixed_nodes" type="zero displacement">
      <x_dof>1</x_dof>
      <y_dof>1</y_dof>
      <z_dof>1</z_dof>
    </bc>
    <bc name="support_cell_base_z" node_set="cell_base_nodes" type="zero displacement">
      <z_dof>1</z_dof>
    </bc>
    <bc name="section_plane_lock" node_set="deformable_nodes_set" type="zero displacement">
      <y_dof>1</y_dof>
    </bc>
  </Boundary>
  <Contact>
${contactXml}
  </Contact>
  <Rigid>
${rigidRootXml}
  </Rigid>
  <Step>
${stepXml}
  </Step>
  <Output>
${logfileXml}
    <plotfile type="febio">
      <var type="displacement" />
      <var type="stress" />
      <var type="contact force" />
      <var type="reaction forces" />
    </plotfile>
  </Output>
</febio_spec>`;
}

function exportFebioXmlContent(inputSpec) {
  const templateData = inputSpec.febioTemplateData || buildFebioTemplateData(inputSpec);
  return serializeFebioTemplateToXml(templateData);
}

function buildFebioInputSpec(caseName, params, inputSpec = buildSimulationInput(caseName, params)) {
  return {
    caseName: inputSpec.caseName,
    params: structuredClone(inputSpec.params),
    coordinates: structuredClone(inputSpec.coordinates || COORDINATE_SYSTEM_SPEC),
    geometry: structuredClone(inputSpec.geometry),
    material: structuredClone(inputSpec.material),
    interfaces: structuredClone(inputSpec.interfaces),
    membrane: structuredClone(inputSpec.membrane),
    operation: structuredClone(inputSpec.operation),
    adhesionPattern: inputSpec.adhesionPattern,
    adhesionSeed: inputSpec.adhesionSeed,
    schedule: serializeSchedule(inputSpec.schedule),
    febioTemplateData: buildFebioTemplateData(inputSpec),
    solverMetadata: buildSolverMetadata("febio", {
      source: "FEBio bridge (mock)",
      note: "not yet solved by FEBio",
    }),
  };
}

function exportFebioJson(inputSpec) {
  const febioXml = exportFebioXmlContent(inputSpec);
  const serializedInputSpec = {
    ...structuredClone({
      caseName: inputSpec.caseName,
      params: inputSpec.params,
      coordinates: inputSpec.coordinates,
      geometry: inputSpec.geometry,
      material: inputSpec.material,
      interfaces: inputSpec.interfaces,
      membrane: inputSpec.membrane,
      operation: inputSpec.operation,
      adhesionPattern: inputSpec.adhesionPattern,
      adhesionSeed: inputSpec.adhesionSeed,
    }),
    schedule: serializeSchedule(inputSpec.schedule),
  };
  return JSON.stringify(
    {
      inputSpec: serializedInputSpec,
      febioTemplateData: inputSpec.febioTemplateData || buildFebioTemplateData(inputSpec),
      febioXml,
      febioXmlStub: febioXml,
      handoffManifest: buildFebioHandoffManifest(inputSpec),
      solverMetadata: inputSpec.solverMetadata || buildSolverMetadata("febio", { source: "FEBio bridge (mock)" }),
      uiMetadata: {
        selectedCase: appState.ui.selectedCase,
        selectedMode: appState.ui.selectedMode,
        solverMode: appState.ui.solverMode,
      },
      currentSolverMode: appState.ui.solverMode,
    },
    null,
    2,
  );
}

function importFebioResult(febioResultJson, inputSpec) {
  const baseResult = febioResultJson.baseResult ? { ...febioResultJson.baseResult } : {};
  baseResult.caseName ??= inputSpec.caseName;
  baseResult.params ??= structuredClone(inputSpec.params);
  baseResult.schedule ??= inputSpec.schedule;
  // FEM handoff point: map FEBio cohesive/contact output back into the common
  // app result schema, including localNc/localCd/membraneRegions.
  baseResult.solverMetadata = buildSolverMetadata("febio", {
    source: febioResultJson.mock ? "FEBio bridge (mock)" : "febio-import",
    note: febioResultJson.mock ? "not yet solved by FEBio" : "",
  });
  baseResult.externalResult = febioResultJson;
  return baseResult;
}

function runFebioSimulation(caseName, params, inputSpec = buildSimulationInput(caseName, params)) {
  const febioInputSpec = buildFebioInputSpec(caseName, params, inputSpec);
  const exportedJson = exportFebioJson(febioInputSpec);
  const exportedXml = exportFebioXmlContent(febioInputSpec);
  // Future CLI handoff point: write exportedJson to disk, invoke FEBio CLI, then import converted JSON outputs here.
  const mockBaseResult = runLightweightSimulation(caseName, params, inputSpec);
  return importFebioResult(
    {
      mock: true,
      exportedJson,
      exportedXml,
      templateData: febioInputSpec.febioTemplateData,
      baseResult: mockBaseResult,
    },
    febioInputSpec,
  );
}

// Solver layer: single public dispatch entry used by the UI.
function runSimulation(caseName, params, solverMode = appState.ui.solverMode || "lightweight") {
  const resolvedMode = SOLVER_MODES.includes(solverMode) ? solverMode : "lightweight";
  const inputSpec = buildSimulationInput(caseName, params);
  const rawResult =
    resolvedMode === "febio"
      ? runFebioSimulation(caseName, params, inputSpec)
      : runLightweightSimulation(caseName, params, inputSpec);
  rawResult.solverMetadata ??= buildSolverMetadata(resolvedMode, {
    source: resolvedMode === "febio" ? "FEBio bridge (mock)" : "lightweight-js-surrogate",
    note: resolvedMode === "febio" ? "not yet solved by FEBio" : "",
  });
  return normalizeSimulationResult(rawResult, inputSpec);
}

function downloadTextFile(filename, content, mimeType = "application/json;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadTextFiles(files) {
  files.forEach((file, index) => {
    setTimeout(() => downloadTextFile(file.filename, file.content, file.mimeType), index * 120);
  });
}

function sanitizeFilenameSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "export";
}

function buildFebioHandoffManifest(inputSpec) {
  const caseName = inputSpec.caseName || "C";
  const solverInfo = describeSolverMetadata(inputSpec.solverMetadata || buildSolverMetadata("febio"));
  const baseName = `case_${sanitizeFilenameSegment(caseName)}`;
  return {
    exportType: "febio-handoff-bundle",
    generatedAt: new Date().toISOString(),
    appSchemaVersion: APP_SCHEMA_VERSION,
    caseName,
    selectedSolverMode: appState.ui.solverMode,
    solverMetadata: {
      solverMode: solverInfo.solverMode,
      source: solverInfo.label,
      note: solverInfo.note || "external FEBio solve required",
    },
    files: {
      feb: `${baseName}.feb`,
      inputJson: `febio_${baseName}_input.json`,
      manifestJson: `febio_${baseName}_manifest.json`,
      readmeText: `febio_${baseName}_README.txt`,
    },
    execution: {
      cliScript: "scripts/run_febio_case.ps1",
      commandExample: `powershell -ExecutionPolicy Bypass -File scripts/run_febio_case.ps1 -FebFile ${baseName}.feb`,
      expectedOutputs: [`${baseName}.log`, `${baseName}.xplt`, `${baseName}.feb`],
      note: "The in-app febio mode is still a bridge mock. The exported .feb is intended for external FEBio execution.",
    },
    importBack: {
      supportedNow: "normalized app result JSON",
      nextStep: "convert FEBio outputs into the app result schema before using 結果読込",
    },
    parameterSummary: {
      puncture: { x: inputSpec.geometry.xp, z: inputSpec.geometry.zp },
      hold: { Fhold: inputSpec.operation.Fhold, P_hold: inputSpec.operation.P_hold },
      motion: {
        dz_lift: inputSpec.operation.dz_lift,
        dx_inward: inputSpec.operation.dx_inward,
        ds_tangent: inputSpec.operation.ds_tangent,
        dx_outward: inputSpec.operation.dx_outward,
      },
      adhesionPattern: inputSpec.adhesionPattern,
      adhesionSeed: inputSpec.adhesionSeed,
    },
  };
}

function buildFebioHandoffReadme(manifest) {
  return [
    "FEBio handoff bundle",
    `generatedAt: ${manifest.generatedAt}`,
    `caseName: ${manifest.caseName}`,
    `solver source shown in app: ${manifest.solverMetadata.source}`,
    "",
    "Files in this bundle:",
    `- ${manifest.files.feb}: FEBio input XML`,
    `- ${manifest.files.inputJson}: normalized app input + FEBio template metadata`,
    `- ${manifest.files.manifestJson}: handoff manifest`,
    "",
    "Recommended workflow:",
    "1. Place the downloaded files in one working folder on the FEBio machine.",
    `2. Run: ${manifest.execution.commandExample}`,
    "3. Keep the generated .log / .xplt together with the original .feb for traceability.",
    "4. If you want to bring results back into this app, convert FEBio outputs into the normalized app result JSON schema first.",
    "",
    "Important note:",
    "The browser app can generate FEBio inputs, but the in-app febio solver mode is still a mock bridge and does not run FEBio itself.",
  ].join("\n");
}

function exportCurrentCaseAsFebioJson() {
  const caseName = appState.ui.selectedCase || "C";
  const params = collectParams();
  const febioInputSpec = buildFebioInputSpec(caseName, params);
  // Export bundle = normalized simulation input + FEBio template data + solver metadata.
  downloadTextFile(`febio_case_${caseName}_input.json`, exportFebioJson(febioInputSpec));
}

function exportFebioXml(inputSpec = null) {
  const caseName = inputSpec?.caseName || appState.ui.selectedCase || "C";
  const resolvedInput =
    inputSpec || buildFebioInputSpec(caseName, collectParams(), buildSimulationInput(caseName, collectParams()));
  const xml = exportFebioXmlContent(resolvedInput);
  downloadTextFile(`case_${caseName}.feb`, xml, "application/xml;charset=utf-8");
  return xml;
}

function exportFebioHandoffBundle(inputSpec = null) {
  const caseName = inputSpec?.caseName || appState.ui.selectedCase || "C";
  const params = inputSpec?.params || collectParams();
  const resolvedInput =
    inputSpec || buildFebioInputSpec(caseName, params, buildSimulationInput(caseName, params));
  const baseName = `case_${sanitizeFilenameSegment(caseName)}`;
  const manifest = buildFebioHandoffManifest(resolvedInput);
  const xml = exportFebioXmlContent(resolvedInput);
  const inputJson = exportFebioJson(resolvedInput);
  const readmeText = buildFebioHandoffReadme(manifest);

  downloadTextFiles([
    { filename: `${baseName}.feb`, content: xml, mimeType: "application/xml;charset=utf-8" },
    {
      filename: `febio_${baseName}_input.json`,
      content: inputJson,
      mimeType: "application/json;charset=utf-8",
    },
    {
      filename: `febio_${baseName}_manifest.json`,
      content: JSON.stringify(manifest, null, 2),
      mimeType: "application/json;charset=utf-8",
    },
    {
      filename: `febio_${baseName}_README.txt`,
      content: readmeText,
      mimeType: "text/plain;charset=utf-8",
    },
  ]);

  return manifest;
}

// Imported results are already normalized before they reach the UI state.
function applyImportedResult(result) {
  appState.ui.solverMode = result.solverMetadata?.solverMode || appState.ui.solverMode;
  appState.ui.selectedCase = result.caseName || appState.ui.selectedCase;
  appState.ui.selectedMode = "case";
  appState.comparisonRuns = [result];
  syncRunButtons();
  syncSolverModeControl();
  renderLatest(result);
}

function loadExternalResult(resultJson) {
  const payload = typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson;
  const rawResult = payload.result || payload.normalizedResult || payload.baseResult || payload.febioResult || payload;
  rawResult.solverMetadata ??= payload.solverMetadata;
  const caseName = rawResult.caseName || payload.inputSpec?.caseName || appState.ui.selectedCase || "C";
  const params = rawResult.params || payload.inputSpec?.params || collectParams();
  const inputSpec = buildSimulationInput(caseName, params);
  // External results are normalized through the same schema path as local solver outputs.
  const normalized = normalizeSimulationResult(rawResult, inputSpec);
  applyImportedResult(normalized);
  return normalized;
}

function translateFailureSite(site) {
  const labels = {
    "nc:right": "核-細胞質 right",
    "nc:left": "核-細胞質 left",
    "nc:top": "核-細胞質 top",
    "nc:bottom": "核-細胞質 bottom",
    "cd:left": "細胞-ディッシュ left",
    "cd:center": "細胞-ディッシュ center",
    "cd:right": "細胞-ディッシュ right",
    "membrane:top_neck": "膜 top_neck",
    "membrane:side": "膜 side",
    "membrane:basal": "膜 basal",
    "pipette:hold": "ピペット保持点",
    none: "未発生",
  };
  return labels[site] || site;
}

function translateMechanism(mode) {
  const labels = {
    local_shear: "local_shear",
    rotational_moment: "rotational_moment",
    dish_detachment: "dish_detachment",
    membrane_rupture: "membrane_rupture",
    insufficient_capture: "insufficient_capture",
  };
  return labels[mode] || mode;
}

// -----------------------------------------------------------------------------
// rendering
// -----------------------------------------------------------------------------
function renderSummary(result) {
  const caseMeta = CASE_DESCRIPTIONS[result.caseName];
  const solverInfo = describeSolverMetadata(result.solverMetadata);
  elements.summaryBand.innerHTML = `
    <div>
      <p class="eyebrow">最新実行</p>
      <h2>${result.caseName} / ${result.classification}</h2>
      <p class="lede">
        核-細胞質損傷 ${formatNumber(result.damage.nc)} | 細胞-ディッシュ損傷 ${formatNumber(
          result.damage.cd,
        )} | 膜損傷 ${formatNumber(result.damage.membrane)}
      </p>
      <p class="summary-note">${caseMeta.label} | ${caseMeta.summary}</p>
      <p class="summary-note">solverMode: ${solverInfo.solverMode} | source: ${solverInfo.label}</p>
      ${solverInfo.note ? `<p class="summary-note">${solverInfo.note}</p>` : ""}
    </div>
    <div class="summary-grid">
      <div class="summary-card">
        <strong>${formatNumber(result.peaks.peakHoldForce)}</strong>
        <span class="subtle">保持力最大値</span>
      </div>
      <div class="summary-card">
        <strong>${formatNumber(result.peaks.peakMembraneStress)}</strong>
        <span class="subtle">膜応力最大値</span>
      </div>
      <div class="summary-card">
        <strong>${formatNumber(result.peaks.peakNcShear)}</strong>
        <span class="subtle">核-細胞質せん断応力最大値</span>
      </div>
      <div class="summary-card">
        <strong>${formatNumber(result.peaks.peakCdShear)}</strong>
        <span class="subtle">細胞-ディッシュせん断応力最大値</span>
      </div>
      <div class="summary-card">
        <strong>${formatNumber(result.contactAngle, 1)} deg</strong>
        <span class="subtle">接触角</span>
      </div>
      <div class="summary-card">
        <strong>${formatNumber(result.holdStiffnessEffective)}</strong>
        <span class="subtle">有効保持剛性</span>
      </div>
    </div>
  `;
}

function renderClassification(result) {
  const descriptions = {
    nucleus_detached:
      "核-細胞質界面の損傷が先行し、保持も維持されています。細胞全体ではなく核だけが単離されるモードです。",
    cell_attached_to_tip:
      "細胞-ディッシュ界面の破断または細胞全体の移動が優勢で、核単離よりも細胞全体の持ち上がりが強い状態です。",
    deformation_only:
      "応力とひずみは蓄積したものの、決定的な界面破断には進みませんでした。大変形のみが起きている状態です。",
    missed_target: "保持点が最後まで成立せず、目標への捕捉に失敗した状態です。",
    insufficient_hold: "保持は成立したものの、十分な損傷進展や変位を起こせずに終了した状態です。",
    early_slip: "保持は成立したが、早い段階で滑脱した状態です。",
    no_capture_general: "捕捉に関する失敗要因が複合しており、代表モードに整理しきれない状態です。",
  };
  const caseMeta = CASE_DESCRIPTIONS[result.caseName];

  elements.classificationCard.innerHTML = `
    <span class="label-pill ${OUTCOME_STYLES[result.classification]}">${result.classification}</span>
    <p>${descriptions[result.classification]}</p>
    <span class="label-pill info">${caseMeta.label}</span>
    <p class="summary-note">${caseMeta.summary}</p>
    <div class="event-list">
      <div class="row-card">
        <strong>保持継続</strong>
        <span class="subtle">${result.captureMaintained ? "はい" : "いいえ"}</span>
      </div>
      <div class="row-card">
        <strong>最終核変位</strong>
        <span class="subtle">${formatNumber(result.displacements.nucleus)}</span>
      </div>
      <div class="row-card">
        <strong>最終細胞変位</strong>
        <span class="subtle">${formatNumber(result.displacements.cell)}</span>
      </div>
      <div class="row-card">
        <strong>最初に壊れた場所</strong>
        <span class="subtle">${translateFailureSite(result.firstFailureSite)}</span>
      </div>
      <div class="row-card">
        <strong>最初の破断モード</strong>
        <span class="subtle">${result.firstFailureMode}</span>
      </div>
      <div class="row-card">
        <strong>支配的メカニズム</strong>
        <span class="subtle">${translateMechanism(result.dominantMechanism)}</span>
      </div>
    </div>
  `;
}

function renderEvents(result) {
  const entries = Object.entries(result.events)
    .sort((a, b) => a[1].time - b[1].time)
    .map(
      ([key, value]) => `
        <div class="row-card">
          <strong>${key}</strong>
          <span class="subtle">t = ${formatNumber(value.time)} | ${value.detail}</span>
        </div>
      `,
    );
  elements.eventLog.innerHTML = `
    <div class="event-list">
      ${entries.length ? entries.join("") : "<p>この実行では閾値イベントは発生しませんでした。</p>"}
    </div>
  `;
}

function renderMetrics(result) {
  elements.metricsTable.innerHTML = `
    <div class="metric-list">
      ${METRIC_KEYS.map(
        ([key, label]) => `
          <div class="metric-card">
            <strong>${label}</strong>
            <span class="metric-value">${formatNumber(result.peaks[key])}</span>
          </div>
        `,
      ).join("")}
    </div>
  `;
}

function renderTimeline(result) {
  const rows = [
    ["captureEstablished", "保持成立"],
    ["ncDamageStart", "核-細胞質損傷開始"],
    ["ncDamageProgress", "核-細胞質損傷進展"],
    ["cdDamageStart", "細胞-ディッシュ損傷開始"],
    ["cdDamageProgress", "細胞-ディッシュ損傷進展"],
    ["membraneDamageStart", "膜破断開始"],
    ["tipSlip", "先端滑り"],
  ];
  elements.timelineTable.innerHTML = `
    <div class="timeline-list">
      ${rows
        .map(([key, label]) => {
          const event = result.events[key];
          return `
            <div class="timeline-card">
              <strong>${label}</strong>
              <span class="subtle">${event ? `t = ${formatNumber(event.time)}` : "未発生"}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function heatColor(value) {
  const intensity = clamp(value, 0, 1);
  const red = Math.round(247 - intensity * 36);
  const green = Math.round(231 - intensity * 122);
  const blue = Math.round(212 - intensity * 148);
  return `rgba(${red}, ${green}, ${blue}, 0.78)`;
}

function renderHeatCells(entries, formatter) {
  return entries
    .map(
      ([label, state]) => `
        <div class="heat-cell" style="background:${heatColor(state.damage)}">
          <strong>${label}</strong>
          <span>D=${formatNumber(state.damage)}</span>
          <span>${formatter(state)}</span>
        </div>
      `,
    )
    .join("");
}

function renderLocalBreakdown(result) {
  elements.localBreakdown.innerHTML = `
    <div class="breakdown-grid">
      <section class="breakdown-card">
        <h3>核-細胞質</h3>
        <div class="heatmap">
          <div class="heatmap-row">
            ${renderHeatCells(
              [
                ["left", result.localNc.left],
                ["top", result.localNc.top],
                ["right", result.localNc.right],
              ],
              (state) => `S=${formatNumber(state.shearStress)}`,
            )}
          </div>
          <div class="heatmap-row">
            ${renderHeatCells([["bottom", result.localNc.bottom]], (state) => `N=${formatNumber(state.normalStress)}`)}
          </div>
        </div>
      </section>
      <section class="breakdown-card">
        <h3>細胞-ディッシュ</h3>
        <div class="heatmap">
          <div class="heatmap-row">
            ${renderHeatCells(
              [
                ["left", result.localCd.left],
                ["center", result.localCd.center],
                ["right", result.localCd.right],
              ],
              (state) => `S=${formatNumber(state.shearStress)}`,
            )}
          </div>
          <p class="summary-note">adhesionPattern = ${result.params.adhesionPattern}</p>
        </div>
      </section>
      <section class="breakdown-card">
        <h3>膜/皮質</h3>
        <div class="heatmap">
          <div class="heatmap-row">
            ${renderHeatCells(
              [
                ["top_neck", result.membraneRegions.top_neck],
                ["side", result.membraneRegions.side],
                ["basal", result.membraneRegions.basal],
              ],
              (state) => `T=${formatNumber(state.stress)}`,
            )}
          </div>
          <p class="summary-note">firstFailure = ${translateFailureSite(result.firstFailureSite)}</p>
        </div>
      </section>
    </div>
  `;
}

function polylineFromSeries(series, width, height, xMin, xMax, yMin, yMax, padding) {
  return series
    .map((point) => {
      const x =
        padding + ((point.x - xMin) / Math.max(xMax - xMin, 1e-6)) * (width - padding * 2);
      const y =
        height -
        padding -
        ((point.y - yMin) / Math.max(yMax - yMin, 1e-6)) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

function buildChart(title, datasets, xLabel, yLabel) {
  const width = 680;
  const height = 300;
  const padding = 34;
  const xs = datasets.flatMap((dataset) => dataset.points.map((point) => point.x));
  const ys = datasets.flatMap((dataset) => dataset.points.map((point) => point.y));
  const xMin = Math.min(...xs, 0);
  const xMax = Math.max(...xs, 1);
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys, 1);
  const gridLines = [0.25, 0.5, 0.75, 1].map((fraction) => {
    const y = height - padding - fraction * (height - padding * 2);
    return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="rgba(34,34,34,0.08)" />`;
  });

  return `
    <svg class="svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">
      ${gridLines.join("")}
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(28,24,18,0.25)" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="rgba(28,24,18,0.25)" />
      ${datasets
        .map(
          (dataset) => `
            <polyline
              fill="none"
              stroke="${dataset.color}"
              stroke-width="3"
              points="${polylineFromSeries(dataset.points, width, height, xMin, xMax, yMin, yMax, padding)}"
            />
          `,
        )
        .join("")}
      <text x="${width / 2}" y="${height - 6}" text-anchor="middle" fill="#6d665b" font-size="12">${xLabel}</text>
      <text x="14" y="${height / 2}" transform="rotate(-90 14 ${height / 2})" text-anchor="middle" fill="#6d665b" font-size="12">${yLabel}</text>
    </svg>
    <div class="chart-key">
      ${datasets
        .map(
          (dataset) => `
            <span class="key-item">
              <i class="stroke" style="background:${dataset.color}"></i>
              ${dataset.label}
            </span>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderCharts(result) {
  elements.stressChart.innerHTML = buildChart(
    "応力応答",
    [
      {
        label: "核-細胞質せん断",
        color: COLORS.nc,
        points: result.history.map((entry) => ({ x: entry.time, y: entry.tauNc })),
      },
      {
        label: "細胞-ディッシュせん断",
        color: COLORS.cd,
        points: result.history.map((entry) => ({ x: entry.time, y: entry.tauCd })),
      },
      {
        label: "膜応力",
        color: COLORS.membraneStress,
        points: result.history.map((entry) => ({ x: entry.time, y: entry.membraneStress })),
      },
    ],
    "時間",
    "応力代理指標",
  );

  elements.motionChart.innerHTML = buildChart(
    "移動履歴",
    [
      {
        label: "ピペット y",
        color: COLORS.displacement,
        points: result.history.map((entry) => ({ x: entry.time, y: entry.pipette.y })),
      },
      {
        label: "細胞 y",
        color: COLORS.cellDisp,
        points: result.history.map((entry) => ({ x: entry.time, y: entry.cell.y })),
      },
      {
        label: "核 y",
        color: COLORS.nucleusDisp,
        points: result.history.map((entry) => ({ x: entry.time, y: entry.nucleus.y })),
      },
    ],
    "時間",
    "鉛直位置",
  );
}

function renderComparison() {
  if (!appState.comparisonRuns.length) {
    elements.comparisonTable.innerHTML =
      "<p>ケースA、B、C、または全ケースを実行すると比較結果を表示します。</p>";
    return;
  }
  elements.comparisonTable.innerHTML = `
    <div class="comparison-grid">
      ${appState.comparisonRuns
        .map(
          (run) => `
            <div class="comparison-card">
              <strong>${run.caseName}</strong>
              <span class="label-pill ${OUTCOME_STYLES[run.classification]}">${run.classification}</span>
              <span class="subtle">核-細胞質損傷 ${formatNumber(run.damage.nc)} | 細胞-ディッシュ損傷 ${formatNumber(run.damage.cd)}</span>
              <span class="subtle">核-細胞質せん断最大値 ${formatNumber(run.peaks.peakNcShear)} | 細胞-ディッシュせん断最大値 ${formatNumber(run.peaks.peakCdShear)}</span>
              <span class="subtle">firstFailureSite ${translateFailureSite(run.firstFailureSite)} | firstFailureMode ${run.firstFailureMode}</span>
              <span class="subtle">dominantMechanism ${translateMechanism(run.dominantMechanism)} | adhesionPattern ${run.params.adhesionPattern}</span>
              <span class="subtle">solverMode ${describeSolverMetadata(run.solverMetadata).solverMode} | source ${describeSolverMetadata(run.solverMetadata).label}</span>
              ${
                describeSolverMetadata(run.solverMetadata).note
                  ? `<span class="subtle">${describeSolverMetadata(run.solverMetadata).note}</span>`
                  : ""
              }
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderSweep() {
  if (!appState.sweepRuns.length) {
    elements.sweepResults.innerHTML = "<p>まだスイープは実行されていません。</p>";
    return;
  }
  elements.sweepResults.innerHTML = `
    <div class="sweep-grid">
      ${appState.sweepRuns
        .map(
          (run) => `
            <div class="sweep-card">
              <strong>${run.parameter} = ${formatNumber(run.value)}</strong>
              <span class="label-pill ${OUTCOME_STYLES[run.classification]}">${run.classification}</span>
              <span class="subtle">核-細胞質 ${formatNumber(run.damage.nc)} | 細胞-ディッシュ ${formatNumber(run.damage.cd)} | 膜 ${formatNumber(run.damage.membrane)}</span>
              <span class="subtle">firstFailureSite ${translateFailureSite(run.firstFailureSite)} | dominantMechanism ${translateMechanism(run.dominantMechanism)}</span>
              <span class="subtle">solverMode ${describeSolverMetadata(run.solverMetadata).solverMode} | source ${describeSolverMetadata(run.solverMetadata).label}</span>
              ${
                describeSolverMetadata(run.solverMetadata).note
                  ? `<span class="subtle">${describeSolverMetadata(run.solverMetadata).note}</span>`
                  : ""
              }
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function clampEllipseOffset(offset, limitX, limitY) {
  const normalized =
    (offset.x * offset.x) / Math.max(limitX * limitX, 1e-6) +
    (offset.y * offset.y) / Math.max(limitY * limitY, 1e-6);
  if (normalized <= 1) {
    return offset;
  }
  const factor = 1 / Math.sqrt(normalized);
  return { x: offset.x * factor, y: offset.y * factor };
}

function domeTopY(localX, halfWidth, domeHeight, baseY) {
  const ratio = clamp(localX / Math.max(halfWidth, 1e-6), -1, 1);
  return baseY + domeHeight * Math.sqrt(Math.max(0, 1 - ratio * ratio));
}

function buildDomePoints(centerX, baseY, halfWidth, domeHeight, segments = 60) {
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const x = lerp(centerX - halfWidth, centerX + halfWidth, t);
    points.push({ x, y: domeTopY(x - centerX, halfWidth, domeHeight, baseY) });
  }
  return points;
}

function computeDisplayState(result, entry) {
  const params = result.params;
  const cellRest = getCellRest(params);
  const nucleusRest = getNucleusRest(params);
  const cellDelta = subtract(entry.cell, cellRest);
  const relativeRest = subtract(nucleusRest, cellRest);
  const relativeNow = subtract(entry.nucleus, entry.cell);
  const relativeDelta = subtract(relativeNow, relativeRest);

  const baseY = Math.max(0, cellDelta.y * 0.42 + entry.damageCd * params.Hc * 0.16);
  const cellX = clamp(cellDelta.x * 0.75, -params.Lc * 0.18, params.Lc * 0.18);
  const domeHeight = params.Hc * clamp(1 - entry.damageMembrane * 0.05 - entry.membraneStrain * 0.03, 0.82, 1.03);
  const halfWidth = params.Lc / 2;

  const localNucleusX = clamp(
    params.xn + relativeDelta.x * 1.2,
    -halfWidth + params.Ln / 2 + 2,
    halfWidth - params.Ln / 2 - 2,
  );
  const topAtNucleus = domeTopY(localNucleusX, halfWidth, domeHeight, baseY);
  const lowerBound = baseY + params.Hn / 2 + 1;
  const escapeAllowance =
    result.classification === "nucleus_detached"
      ? clamp((entry.damageNc - 0.28) / 0.55, 0, 1) * (params.Hn * 0.75 + params.dz_lift * 0.35)
      : 0;
  const liftContribution = Math.max(0, entry.pipette.y - result.schedule.holdPosition.y) * 0.22;
  const desiredNucleusY =
    baseY + params.yn + relativeDelta.y * 1.05 + liftContribution + escapeAllowance * 0.35;
  const upperBound = topAtNucleus - params.Hn / 2 - 1 + escapeAllowance;
  const nucleusY = clamp(desiredNucleusY, lowerBound, Math.max(lowerBound, upperBound));
  const nucleusCenter = { x: cellX + localNucleusX, y: nucleusY };

  const boundary = nucleusBoundary(params, nucleusCenter);
  const pipetteOffset = subtract(entry.pipette, result.schedule.holdPosition);
  const shownTip = add(boundary.point, pipetteOffset);
  const pipetteAxis = { x: 0, y: 1 };

  return {
    cellX,
    baseY,
    domeHeight,
    halfWidth,
    nucleus: nucleusCenter,
    pipette: shownTip,
    pipetteAxis,
    boundary: boundary.point,
    boundaryNormal: boundary.outward,
    boundaryTangent: boundary.tangent,
    phase: entry.phase,
    time: entry.time,
    damageNc: entry.damageNc,
    damageCd: entry.damageCd,
    damageMembrane: entry.damageMembrane,
    membraneStress: entry.membraneStress,
    holdForce: entry.holdForce,
    tangentialOffset: entry.tangentialOffset || 0,
    domePoints: buildDomePoints(cellX, baseY, halfWidth, domeHeight),
  };
}

function buildViewport(result, displayHistory) {
  const params = result.params;
  const xs = [];
  const ys = [0];

  displayHistory.forEach((frame) => {
    xs.push(frame.cellX - frame.halfWidth, frame.cellX + frame.halfWidth);
    xs.push(frame.nucleus.x - params.Ln / 2, frame.nucleus.x + params.Ln / 2);
    xs.push(frame.pipette.x - params.rp * 4.5, frame.pipette.x + params.rp * 4.5);

    ys.push(frame.baseY);
    ys.push(frame.baseY + frame.domeHeight);
    ys.push(frame.nucleus.y - params.Hn / 2, frame.nucleus.y + params.Hn / 2);
    ys.push(frame.pipette.y + params.rp * 4.5);
  });

  const minX = Math.min(...xs, -params.Lc * 0.72);
  const maxX = Math.max(...xs, params.Lc * 0.72);
  const topY = Math.max(...ys, params.Hc + params.dz_lift + params.rp * 4.5);
  const xPad = Math.max(params.rp * 3.4, (maxX - minX) * 0.12);
  const minY = -Math.max(params.Hc * 0.24, params.rp * 2.8);
  const maxY = topY + Math.max(params.Hc * 0.18, params.rp * 4);

  return {
    minX: minX - xPad,
    maxX: maxX + xPad,
    minY,
    maxY,
  };
}

function drawTrace(ctx, points, color, worldToCanvas) {
  if (points.length < 2) {
    return;
  }
  ctx.save();
  ctx.beginPath();
  points.forEach((point, index) => {
    const canvasPoint = worldToCanvas(point);
    if (index === 0) {
      ctx.moveTo(canvasPoint.x, canvasPoint.y);
    } else {
      ctx.lineTo(canvasPoint.x, canvasPoint.y);
    }
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([5, 6]);
  ctx.stroke();
  ctx.restore();
}

function drawDome(ctx, frame, worldToCanvas, fillColor) {
  const left = worldToCanvas({ x: frame.cellX - frame.halfWidth, y: frame.baseY });
  const right = worldToCanvas({ x: frame.cellX + frame.halfWidth, y: frame.baseY });
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  frame.domePoints.forEach((point) => {
    const canvasPoint = worldToCanvas(point);
    ctx.lineTo(canvasPoint.x, canvasPoint.y);
  });
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
}

function drawMembrane(ctx, frame, worldToCanvas) {
  ctx.beginPath();
  frame.domePoints.forEach((point, index) => {
    const canvasPoint = worldToCanvas(point);
    if (index === 0) {
      ctx.moveTo(canvasPoint.x, canvasPoint.y);
    } else {
      ctx.lineTo(canvasPoint.x, canvasPoint.y);
    }
  });
  ctx.strokeStyle = COLORS.membrane;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function phaseLabel(phase) {
  const labels = {
    approach: "接近",
    hold: "保持",
    lift: "引き上げ",
    inward: "重心側移動",
    tangential: "接線移動",
    "mixed-inward": "重心側微小移動",
    "mixed-tangential": "接線微小移動",
    "release-test": "解放確認",
  };
  return labels[phase] || phase;
}

function getPlaybackFrame(result, frameIndex) {
  return clamp(frameIndex, 0, result.history.length - 1);
}

function drawScene(result, frameIndex = result.history.length - 1) {
  const context = elements.scene.getContext("2d");
  const width = elements.scene.width;
  const height = elements.scene.height;
  const params = result.params;
  const displayHistory = result.history.map((entry) => computeDisplayState(result, entry));
  const safeIndex = getPlaybackFrame(result, frameIndex);
  const frame = displayHistory[safeIndex];
  const initialFrame = displayHistory[0];
  const viewport = buildViewport(result, displayHistory);
  const margin = { left: 34, right: 24, top: 22, bottom: 34 };
  const worldWidth = Math.max(viewport.maxX - viewport.minX, 1e-6);
  const worldHeight = Math.max(viewport.maxY - viewport.minY, 1e-6);

  const worldToCanvas = (point) => ({
    x: margin.left + ((point.x - viewport.minX) / worldWidth) * (width - margin.left - margin.right),
    y:
      height -
      margin.bottom -
      ((point.y - viewport.minY) / worldHeight) * (height - margin.top - margin.bottom),
  });

  context.clearRect(0, 0, width, height);

  for (let row = 1; row <= 8; row += 1) {
    const yWorld = lerp(viewport.minY, viewport.maxY, row / 9);
    const yCanvas = worldToCanvas({ x: 0, y: yWorld }).y;
    context.beginPath();
    context.moveTo(margin.left, yCanvas);
    context.lineTo(width - margin.right, yCanvas);
    context.strokeStyle = "rgba(76, 58, 24, 0.06)";
    context.lineWidth = 1;
    context.stroke();
  }

  const dishTop = worldToCanvas({ x: viewport.minX, y: 0 }).y;
  context.fillStyle = COLORS.dish;
  context.fillRect(margin.left, dishTop, width - margin.left - margin.right, height - dishTop);
  context.beginPath();
  context.moveTo(margin.left, dishTop);
  context.lineTo(width - margin.right, dishTop);
  context.strokeStyle = COLORS.dishLine;
  context.lineWidth = 2;
  context.stroke();

  const pipetteTrace = displayHistory.slice(0, safeIndex + 1).map((entry) => entry.pipette);
  const nucleusTrace = displayHistory.slice(0, safeIndex + 1).map((entry) => entry.nucleus);
  const cellTrace = displayHistory
    .slice(0, safeIndex + 1)
    .map((entry) => ({ x: entry.cellX, y: entry.baseY + entry.domeHeight * 0.56 }));

  drawTrace(context, pipetteTrace, "rgba(105, 65, 155, 0.32)", worldToCanvas);
  drawTrace(context, nucleusTrace, "rgba(193, 109, 70, 0.48)", worldToCanvas);
  drawTrace(context, cellTrace, "rgba(95, 145, 148, 0.24)", worldToCanvas);

  drawDome(context, frame, worldToCanvas, "rgba(95, 145, 148, 0.24)");
  drawDome(context, frame, worldToCanvas, "rgba(95, 145, 148, 0.08)");
  drawMembrane(context, frame, worldToCanvas);

  const nucleusCanvas = worldToCanvas(frame.nucleus);
  const rx = (params.Ln / worldWidth) * (width - margin.left - margin.right) * 0.5;
  const ry = (params.Hn / worldHeight) * (height - margin.top - margin.bottom) * 0.5;
  if (safeIndex > 0) {
    const initialNucleusCanvas = worldToCanvas(initialFrame.nucleus);
    context.save();
    context.beginPath();
    context.ellipse(initialNucleusCanvas.x, initialNucleusCanvas.y, rx, ry, 0, 0, Math.PI * 2);
    context.strokeStyle = "rgba(193, 109, 70, 0.42)";
    context.lineWidth = 1.8;
    context.setLineDash([6, 5]);
    context.stroke();
    context.restore();

    context.beginPath();
    context.moveTo(initialNucleusCanvas.x, initialNucleusCanvas.y);
    context.lineTo(nucleusCanvas.x, nucleusCanvas.y);
    context.strokeStyle = "rgba(193, 109, 70, 0.5)";
    context.lineWidth = 1.8;
    context.stroke();
  }
  context.beginPath();
  context.ellipse(nucleusCanvas.x, nucleusCanvas.y, rx, ry, 0, 0, Math.PI * 2);
  context.fillStyle = "rgba(193, 109, 70, 0.88)";
  context.fill();

  if (frame.damageMembrane > 0.18 || frame.membraneStress > params.sig_m_crit * 0.7) {
    const hotIndex = Math.round(frame.domePoints.length * 0.66);
    const hotPoint = frame.domePoints[clamp(hotIndex, 0, frame.domePoints.length - 1)];
    const hotCanvas = worldToCanvas(hotPoint);
    context.beginPath();
    context.arc(hotCanvas.x, hotCanvas.y, 9, 0, Math.PI * 2);
    context.fillStyle = "rgba(210, 55, 55, 0.2)";
    context.fill();
    context.beginPath();
    context.arc(hotCanvas.x, hotCanvas.y, 12, -0.95, -0.15);
    context.strokeStyle = COLORS.membrane;
    context.lineWidth = 2.4;
    context.stroke();
  }

  if (frame.holdForce > 0.04) {
    const boundaryCanvas = worldToCanvas(frame.boundary);
    const pipetteCanvas = worldToCanvas(frame.pipette);
    context.beginPath();
    context.moveTo(boundaryCanvas.x, boundaryCanvas.y);
    context.lineTo(pipetteCanvas.x, pipetteCanvas.y);
    context.strokeStyle = COLORS.membrane;
    context.lineWidth = 2;
    context.stroke();
  }

  const shaftDirection =
    lengthOf(frame.pipetteAxis) > 1e-6 ? frame.pipetteAxis : normalize({ x: 0.7, y: 1.0 });
  const tipCanvas = worldToCanvas(frame.pipette);
  const tailCanvas = worldToCanvas(add(frame.pipette, scale(shaftDirection, params.rp * 8.4)));
  const shoulderCanvas = worldToCanvas(add(frame.pipette, scale(shaftDirection, params.rp * 2.9)));
  const mouthNormal = rotate90(shaftDirection);
  const mouthLeft = worldToCanvas(add(frame.pipette, scale(mouthNormal, params.rp * 0.42)));
  const mouthRight = worldToCanvas(add(frame.pipette, scale(mouthNormal, -params.rp * 0.42)));

  context.beginPath();
  context.moveTo(tailCanvas.x, tailCanvas.y);
  context.lineTo(shoulderCanvas.x, shoulderCanvas.y);
  context.lineTo(tipCanvas.x, tipCanvas.y);
  context.strokeStyle = COLORS.pipette;
  context.lineWidth = 7;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();

  context.beginPath();
  context.moveTo(mouthLeft.x, mouthLeft.y);
  context.lineTo(tipCanvas.x, tipCanvas.y);
  context.lineTo(mouthRight.x, mouthRight.y);
  context.strokeStyle = "rgba(105, 65, 155, 0.9)";
  context.lineWidth = 2.4;
  context.stroke();

  context.fillStyle = "#6d665b";
  context.font = "16px sans-serif";
  context.fillText(`ケース ${result.caseName}`, margin.left + 6, margin.top + 18);
  context.fillText(`結果: ${result.classification}`, margin.left + 6, margin.top + 40);
  context.fillText(`フェーズ: ${phaseLabel(frame.phase)}`, margin.left + 6, margin.top + 62);
  context.fillText("x-z section (dish z = 0)", margin.left + 6, margin.top + 84);
  context.textAlign = "right";
  context.fillText(`t = ${formatNumber(frame.time)}`, width - margin.right - 4, margin.top + 18);
  context.textAlign = "left";
}

function drawArrow(ctx, from, to, color) {
  const direction = normalize(subtract(to, from));
  const headA = add(to, scale(direction, -12));
  const normal = rotate90(direction);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(headA.x + normal.x * 5, headA.y + normal.y * 5);
  ctx.lineTo(headA.x - normal.x * 5, headA.y - normal.y * 5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawTopView(result, frameIndex = result.history.length - 1) {
  const ctx = elements.topView.getContext("2d");
  const width = elements.topView.width;
  const height = elements.topView.height;
  const params = result.params;
  const safeIndex = getPlaybackFrame(result, frameIndex);
  const entry = result.history[safeIndex];
  const axes = result.schedule.axes;
  const center = { x: width * 0.42, y: height * 0.54 };
  const nucleusRxy = Math.min(width * 0.18, height * 0.18, params.Ln * 4.2);
  const nucleusRx = nucleusRxy;
  const nucleusRy = nucleusRxy;
  const punctureX =
    center.x + (result.schedule.holdPosition.x / Math.max(params.Ln / 2, 1)) * nucleusRx;
  const puncture = { x: punctureX, y: center.y };
  const scaleXY = Math.min(width, height) * 0.06;
  const actualTip = {
    x:
      puncture.x +
      ((entry.pipette?.x ?? result.schedule.holdPosition.x) - result.schedule.holdPosition.x) /
        Math.max(params.Ln / 2, 1) *
        nucleusRx,
    y: puncture.y,
  };
  const tangentialDisplay =
    (clamp(entry.tangentialOffset || 0, -Math.max(params.ds_tangent, 1) * 1.5, Math.max(params.ds_tangent, 1) * 1.5) /
      Math.max(params.ds_tangent, 1)) *
    scaleXY;
  const tangentialTip = {
    x: actualTip.x,
    y: actualTip.y - axes.tangentSign * tangentialDisplay,
  };

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255, 250, 241, 0.9)";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(76, 58, 24, 0.08)";
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  ctx.beginPath();
  ctx.moveTo(center.x - nucleusRx - 40, center.y);
  ctx.lineTo(center.x + nucleusRx + 50, center.y);
  ctx.moveTo(center.x, center.y + nucleusRy + 34);
  ctx.lineTo(center.x, center.y - nucleusRy - 40);
  ctx.strokeStyle = "rgba(76, 58, 24, 0.14)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(center.x, center.y, nucleusRx, nucleusRy, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(193, 109, 70, 0.18)";
  ctx.fill();
  ctx.strokeStyle = "rgba(193, 109, 70, 0.78)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(puncture.x, puncture.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.pipette;
  ctx.fill();

  drawArrow(ctx, puncture, { x: puncture.x + axes.inwardSign * 56, y: puncture.y }, COLORS.nc);
  drawArrow(ctx, puncture, { x: puncture.x, y: puncture.y - axes.tangentSign * 56 }, COLORS.pipette);
  drawArrow(ctx, puncture, { x: puncture.x + axes.outwardSign * 56, y: puncture.y }, COLORS.cd);

  ctx.beginPath();
  ctx.arc(actualTip.x, actualTip.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.pipette;
  ctx.fill();
  if (Math.abs(actualTip.x - puncture.x) > 1e-3) {
    ctx.beginPath();
    ctx.moveTo(puncture.x, puncture.y);
    ctx.lineTo(actualTip.x, actualTip.y);
    ctx.strokeStyle = "rgba(105, 65, 155, 0.5)";
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }
  if (Math.abs(tangentialTip.y - actualTip.y) > 1e-3) {
    ctx.beginPath();
    ctx.moveTo(actualTip.x, actualTip.y);
    ctx.lineTo(tangentialTip.x, tangentialTip.y);
    ctx.strokeStyle = "rgba(105, 65, 155, 0.65)";
    ctx.lineWidth = 2.2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(tangentialTip.x, tangentialTip.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(105, 65, 155, 0.78)";
    ctx.fill();
  }

  ctx.fillStyle = "#6d665b";
  ctx.font = "14px sans-serif";
  ctx.fillText("xy top view", width * 0.05, 22);
  ctx.fillText("dish height: z = 0", width * 0.05, 40);
  ctx.fillText("x", center.x + nucleusRx + 56, center.y - 6);
  ctx.fillText("y", center.x + 8, center.y - nucleusRy - 20);
  ctx.fillText("inward", puncture.x + axes.inwardSign * 62, puncture.y - 6);
  ctx.fillText("tangent", puncture.x + 8, puncture.y - axes.tangentSign * 62);
  ctx.fillText("outward", puncture.x + axes.outwardSign * 62, puncture.y + 18);
  ctx.fillText(
    `tip x ${formatNumber(entry.pipette?.x ?? result.schedule.holdPosition.x)}, tangent dof ${formatNumber(entry.tangentialOffset || 0)}`,
    width * 0.05,
    height - 18,
  );
}

function updatePlaybackStatus(result, frameIndex) {
  const safeIndex = getPlaybackFrame(result, frameIndex);
  const entry = result.history[safeIndex];
  elements.playbackStatus.innerHTML = `
    <span>フレーム ${safeIndex + 1} / ${result.history.length}</span>
    <span>t = ${formatNumber(entry.time)}</span>
    <span>フェーズ: ${phaseLabel(entry.phase)}</span>
    <span>膜損傷: ${formatNumber(entry.damageMembrane)}</span>
  `;
}

function stopPlayback() {
  appState.playback.isPlaying = false;
  if (appState.playback.rafId !== null) {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(appState.playback.rafId);
    } else {
      clearTimeout(appState.playback.rafId);
    }
    appState.playback.rafId = null;
  }
  appState.playback.lastTimestamp = 0;
  if (elements.playbackToggle) {
    elements.playbackToggle.textContent = "再生";
  }
}

function requestPlaybackFrame(callback) {
  if (typeof requestAnimationFrame === "function") {
    return requestAnimationFrame(callback);
  }
  return setTimeout(() => callback(Date.now()), 60);
}

function renderPlaybackFrame(frameIndex) {
  if (!appState.latest) {
    return;
  }
  const safeIndex = getPlaybackFrame(appState.latest, frameIndex);
  appState.playback.frameIndex = safeIndex;
  elements.playbackSlider.value = String(safeIndex);
  drawScene(appState.latest, safeIndex);
  drawTopView(appState.latest, safeIndex);
  updatePlaybackStatus(appState.latest, safeIndex);
}

function tickPlayback(timestamp) {
  if (!appState.playback.isPlaying || !appState.latest) {
    return;
  }
  if (!appState.playback.lastTimestamp) {
    appState.playback.lastTimestamp = timestamp;
  }
  const elapsed = timestamp - appState.playback.lastTimestamp;
  if (elapsed >= 70) {
    const nextFrame = appState.playback.frameIndex + 1;
    if (nextFrame >= appState.latest.history.length) {
      stopPlayback();
      renderPlaybackFrame(appState.latest.history.length - 1);
      return;
    }
    renderPlaybackFrame(nextFrame);
    appState.playback.lastTimestamp = timestamp;
  }
  appState.playback.rafId = requestPlaybackFrame(tickPlayback);
}

function togglePlayback() {
  if (!appState.latest) {
    return;
  }
  if (appState.playback.isPlaying) {
    stopPlayback();
    return;
  }
  if (appState.playback.frameIndex >= appState.latest.history.length - 1) {
    renderPlaybackFrame(0);
  }
  appState.playback.isPlaying = true;
  appState.playback.lastTimestamp = 0;
  elements.playbackToggle.textContent = "停止";
  appState.playback.rafId = requestPlaybackFrame(tickPlayback);
}

// -----------------------------------------------------------------------------
// UI actions
// -----------------------------------------------------------------------------
function renderLatest(result) {
  appState.latest = result;
  stopPlayback();
  const lastFrame = result.history.length - 1;
  elements.playbackSlider.max = String(lastFrame);
  elements.playbackSlider.value = String(lastFrame);
  renderSummary(result);
  renderClassification(result);
  renderEvents(result);
  renderMetrics(result);
  renderTimeline(result);
  renderLocalBreakdown(result);
  renderCharts(result);
  renderComparison();
  renderSweep();
  renderPlaybackFrame(lastFrame);
}

function executeCase(caseName) {
  const params = collectParams();
  const result = runSimulation(caseName, params, appState.ui.solverMode);
  appState.ui.selectedCase = caseName;
  appState.ui.selectedMode = "case";
  elements.sweepCase.value = caseName;
  appState.comparisonRuns = [result];
  syncRunButtons();
  renderLatest(result);
}

function executeAllCases() {
  const params = collectParams();
  appState.ui.selectedMode = "all";
  appState.comparisonRuns = ["A", "B", "C"].map((caseName) =>
    runSimulation(caseName, params, appState.ui.solverMode),
  );
  const priorities = [
    "nucleus_detached",
    "cell_attached_to_tip",
    "deformation_only",
    "insufficient_hold",
    "early_slip",
    "missed_target",
    "no_capture_general",
  ];
  const latest =
    appState.comparisonRuns
      .slice()
      .sort(
        (left, right) =>
          priorities.indexOf(left.classification) - priorities.indexOf(right.classification),
      )[0] || appState.comparisonRuns[0];
  appState.ui.selectedCase = latest.caseName;
  syncRunButtons();
  renderLatest(latest);
}

function executeSweep() {
  const parameter = elements.sweepParameter.value;
  const start = Number(elements.sweepStart.value);
  const end = Number(elements.sweepEnd.value);
  const steps = Math.max(2, Math.round(Number(elements.sweepSteps.value) || 2));
  const caseName = elements.sweepCase.value || "A";
  const params = collectParams();
  const sweepRuns = [];
  appState.ui.selectedCase = caseName;
  appState.ui.selectedMode = "sweep";

  for (let index = 0; index < steps; index += 1) {
    const value = lerp(start, end, steps === 1 ? 0 : index / (steps - 1));
    const variant = structuredClone(params);
    variant[parameter] = value;
    const result = runSimulation(caseName, variant, appState.ui.solverMode);
    sweepRuns.push({
      parameter,
      value,
      classification: result.classification,
      damage: result.damage,
      firstFailureSite: result.firstFailureSite,
      dominantMechanism: result.dominantMechanism,
      solverMetadata: result.solverMetadata,
    });
  }

  appState.sweepRuns = sweepRuns;
  syncRunButtons();
  renderSweep();
}

function bindButtons() {
  if (elements.solverMode) {
    elements.solverMode.addEventListener("change", () => {
      appState.ui.solverMode = elements.solverMode.value;
    });
  }
  elements.runCaseA.addEventListener("click", () => executeCase("A"));
  elements.runCaseB.addEventListener("click", () => executeCase("B"));
  elements.runCaseC.addEventListener("click", () => executeCase("C"));
  elements.runAll.addEventListener("click", executeAllCases);
  elements.runSweep.addEventListener("click", executeSweep);
  elements.exportFebioJson?.addEventListener("click", exportCurrentCaseAsFebioJson);
  elements.exportFebioXml?.addEventListener("click", () => exportFebioXml());
  elements.exportFebioHandoff?.addEventListener("click", () => exportFebioHandoffBundle());
  elements.importResult?.addEventListener("click", () => {
    elements.importResultFile?.click();
  });
  elements.importResultFile?.addEventListener("change", () => {
    const [file] = elements.importResultFile.files || [];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      loadExternalResult(String(reader.result || ""));
      elements.importResultFile.value = "";
    };
    reader.readAsText(file);
  });
  elements.resetDefaults.addEventListener("click", () => {
    resetDefaults();
    executeCase("C");
  });
  elements.playbackToggle.addEventListener("click", togglePlayback);
  elements.playbackReset.addEventListener("click", () => {
    stopPlayback();
    renderPlaybackFrame(0);
  });
  elements.playbackSlider.addEventListener("input", () => {
    stopPlayback();
    renderPlaybackFrame(Number(elements.playbackSlider.value));
  });
}

function initialize() {
  organizeWorkspaceLayout();
  populateFields();
  bindFieldListeners();
  fillSweepControls();
  bindButtons();
  syncRunButtons();
  syncSolverModeControl();
  renderComparison();
  renderSweep();
  executeCase("C");
}

initialize();
