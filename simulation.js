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
  febioRun: document.querySelector("#febio-run"),
  febioView: document.querySelector("#febio-view"),
  febioBridgeStatus: document.querySelector("#febio-bridge-status"),
  displayModeBanner: document.querySelector("#display-mode-banner"),
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
  febioBridge: {
    available: false,
    busy: false,
    statusText: "bridge: unknown",
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
  const canvasHeader = canvasPanel?.querySelector(".panel-header");
  const legend = canvasPanel?.querySelector(".legend");
  let simulationActions = canvasPanel?.querySelector(".simulation-actions");
  if (!simulationActions && legend) {
    simulationActions = document.createElement("div");
    simulationActions.className = "simulation-actions";
    legend.insertAdjacentElement("afterend", simulationActions);
  }
  if (!elements.displayModeBanner && canvasHeader) {
    const banner = document.createElement("div");
    banner.id = "display-mode-banner";
    banner.className = "display-mode-banner subtle";
    banner.textContent = "表示ソース: 未実行";
    canvasHeader.appendChild(banner);
    elements.displayModeBanner = banner;
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
    if (!elements.febioRun && elements.exportFebioJson?.parentNode) {
      const febioRunButton = elements.exportFebioJson.cloneNode(true);
      febioRunButton.id = "febio-run";
      febioRunButton.textContent = "FEBio Run";
      (elements.exportFebioHandoff || elements.exportFebioXml || elements.exportFebioJson).insertAdjacentElement("afterend", febioRunButton);
      elements.febioRun = febioRunButton;
    }
    if (!elements.febioView && elements.exportFebioJson?.parentNode) {
      const febioViewButton = elements.exportFebioJson.cloneNode(true);
      febioViewButton.id = "febio-view";
      febioViewButton.textContent = "FEBio View";
      (elements.febioRun || elements.exportFebioHandoff || elements.exportFebioXml || elements.exportFebioJson).insertAdjacentElement("afterend", febioViewButton);
      elements.febioView = febioViewButton;
    }
    if (!elements.febioBridgeStatus && elements.importResult?.parentNode) {
      const status = document.createElement("div");
      status.id = "febio-bridge-status";
      status.className = "bridge-status subtle";
      status.textContent = "bridge: checking";
      elements.importResult.insertAdjacentElement("afterend", status);
      elements.febioBridgeStatus = status;
    }
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
  result.history = normalizeHistoryEntries(result.history, result, inputSpec);
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

function summarizeLocalDamage(localState, regions) {
  return Math.max(...regions.map((region) => localState?.[region]?.damage || 0), 0);
}

function deriveMembraneStateFromLocalNc(localNc, membraneSpec = {}) {
  const thresholds = getMembraneThresholds(membraneSpec);
  const membraneRegions = initializeMembraneState(MEMBRANE_REGIONS);
  const topNormal = localNc?.top?.peakNormal ?? localNc?.top?.normalStress ?? 0;
  const topShear = localNc?.top?.peakShear ?? localNc?.top?.shearStress ?? 0;
  const leftShear = localNc?.left?.peakShear ?? localNc?.left?.shearStress ?? 0;
  const rightShear = localNc?.right?.peakShear ?? localNc?.right?.shearStress ?? 0;
  const bottomNormal = localNc?.bottom?.peakNormal ?? localNc?.bottom?.normalStress ?? 0;

  membraneRegions.top_neck.threshold = thresholds.top_neck;
  membraneRegions.side.threshold = thresholds.side;
  membraneRegions.basal.threshold = thresholds.basal;

  membraneRegions.top_neck.stress = topNormal + topShear * 0.35;
  membraneRegions.side.stress = Math.max(leftShear, rightShear) * 0.8;
  membraneRegions.basal.stress = bottomNormal * 0.6;

  Object.values(membraneRegions).forEach((region) => {
    region.peakStress = region.stress;
    region.damage = clamp(region.stress / Math.max(region.threshold, 1e-6) - 1, 0, 1);
    if (region.damage > 0) {
      region.firstFailureTime = 0;
    }
  });

  return membraneRegions;
}

function normalizeHistoryEntries(history, result, inputSpec) {
  const membraneSpec = inputSpec.membrane || {
    sig_m_crit: result.params?.sig_m_crit,
    sig_m_crit_top: result.params?.sig_m_crit_top,
    sig_m_crit_side: result.params?.sig_m_crit_side,
    sig_m_crit_basal: result.params?.sig_m_crit_basal,
  };
  return history.map((entry) => {
    const normalized = { ...entry };
    normalized.localNc ??= initializeLocalState(NC_REGIONS);
    normalized.localCd ??= initializeLocalState(CD_REGIONS);
    normalized.membraneRegions ??= deriveMembraneStateFromLocalNc(normalized.localNc, membraneSpec);
    normalized.damageNc ??= summarizeLocalDamage(normalized.localNc, NC_REGIONS);
    normalized.damageCd ??= summarizeLocalDamage(normalized.localCd, CD_REGIONS);
    normalized.damageMembrane ??= Math.max(
      ...MEMBRANE_REGIONS.map((region) => normalized.membraneRegions?.[region]?.damage || 0),
      0,
    );
    normalized.membraneDamage ??= normalized.damageMembrane;
    normalized.membraneStress ??= Math.max(
      ...MEMBRANE_REGIONS.map((region) => normalized.membraneRegions?.[region]?.stress || 0),
      0,
    );
    normalized.membraneStrain ??=
      normalized.membraneStress / Math.max(membraneSpec.sig_m_crit || 1, 1e-6);
    normalized.holdForce ??= Math.hypot(
      normalized.pipetteReaction?.x || 0,
      normalized.pipetteReaction?.y || 0,
    );
    normalized.tangentialOffset ??= normalized.tangentNucleus ?? 0;
    return normalized;
  });
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

