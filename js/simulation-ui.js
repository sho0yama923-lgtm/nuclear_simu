// -----------------------------------------------------------------------------
// rendering
// -----------------------------------------------------------------------------
function describeDisplayedResultLegacyDebug(result) {
  const solverInfo = describeSolverMetadata(result.solverMetadata);
  const normalizedSource = String(solverInfo.source || "").toLowerCase();
  const isMock =
    solverInfo.solverMode === "febio" &&
    (normalizedSource.includes("mock") ||
      normalizedSource.includes("bridge") ||
      normalizedSource.includes("stub"));
  const isFebioSolved = solverInfo.solverMode === "febio" && !isMock;

  if (isMock) {
    return {
      title: "FEBio mock",
      short: "FEBio mock",
      pillClass: "source-mock",
      detail: "FEBio 実解析ではなく bridge mock の結果を表示中",
    };
  }

  if (isFebioSolved) {
    return {
      title: "FEBio結果",
      short: "FEBio",
      pillClass: "source-febio",
      detail:
        solverInfo.note === "imported external result"
          ? `FEBio 由来の外部結果を表示中 (${solverInfo.label})`
          : `FEBio の結果を表示中 (${solverInfo.label})`,
    };
  }

  return {
    title: "軽量JS近似",
    short: "簡易版",
    pillClass: "source-lightweight",
    detail: "ブラウザ内の軽量近似シミュレーション結果を表示中",
  };
}

window.__NUCLEAR_SIMU_DEBUG__ = {
  ...(window.__NUCLEAR_SIMU_DEBUG__ || {}),
  describeDisplayedResultLegacy: describeDisplayedResultLegacyDebug,
};

function renderDisplayModeBanner(result) {
  if (!elements.displayModeBanner) {
    return;
  }
  const displayInfo = describeDisplayedResult(result);
  elements.displayModeBanner.innerHTML = `
    <span class="label-pill display-mode-pill ${displayInfo.pillClass}">${displayInfo.title}</span>
    <span>${displayInfo.detail}</span>
  `;
}

function renderSummary(result) {
  const caseMeta = CASE_DESCRIPTIONS[result.caseName];
  const solverInfo = describeSolverMetadata(result.solverMetadata);
  const displayInfo = describeDisplayedResult(result);
  elements.summaryBand.innerHTML = `
    <div>
      <p class="eyebrow">最新実行</p>
      <h2>${result.caseName} / ${result.classification}</h2>
      <p><span class="label-pill display-mode-pill ${displayInfo.pillClass}">${displayInfo.title}</span></p>
      <p class="lede">
        核-細胞質損傷 ${formatNumber(result.damage.nc)} | 細胞-ディッシュ損傷 ${formatNumber(
          result.damage.cd,
        )} | 膜損傷 ${formatNumber(result.damage.membrane)}
      </p>
      <p class="summary-note">${caseMeta.label} | ${caseMeta.summary}</p>
      <p class="summary-note">${displayInfo.detail}</p>
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
  const solverSource = result.solverMetadata?.source || result.externalResult?.source || "";
  const isFebioDriven =
    solverSource === "febio-cli" ||
    solverSource === "febio-import" ||
    solverSource === "convert_febio_output.mjs" ||
    Boolean(result.externalResult?.outputMapping);

  if (isFebioDriven) {
    const cellDelta = subtract(entry.cell, cellRest);
    const baseY = Math.max(0, getWorldZ(cellDelta));
    const cellX = clamp(cellDelta.x, -params.Lc * 0.22, params.Lc * 0.22);
    const domeHeight = params.Hc * clamp(1 - (entry.damageMembrane || 0) * 0.06 - (entry.membraneStrain || 0) * 0.015, 0.84, 1.02);
    const halfWidth = params.Lc / 2;
    const nucleusCenter = { x: entry.nucleus.x, y: entry.nucleus.y };
    const boundary = nucleusBoundary(params, nucleusCenter);

    return {
      cellX,
      baseY,
      domeHeight,
      halfWidth,
      nucleus: nucleusCenter,
      pipette: entry.pipette ? { x: entry.pipette.x, y: entry.pipette.y } : boundary.point,
      pipetteCenter: entry.pipetteCenter ? { x: entry.pipetteCenter.x, y: entry.pipetteCenter.y } : null,
      pipetteAxis: { x: 0, y: 1 },
      boundary: boundary.point,
      boundaryNormal: boundary.outward,
      boundaryTangent: boundary.tangent,
      phase: entry.phase,
      time: entry.time,
      damageNc: entry.damageNc || 0,
      damageCd: entry.damageCd || 0,
      damageMembrane: entry.damageMembrane || 0,
      membraneStress: entry.membraneStress || 0,
      holdForce: entry.holdForce || 0,
      tangentialOffset: entry.tangentialOffset || 0,
      domePoints: buildDomePoints(cellX, baseY, halfWidth, domeHeight),
    };
  }

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
  const displayInfo = describeDisplayedResult(result);
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
  context.fillText(`表示: ${displayInfo.short}`, margin.left + 6, margin.top + 84);
  context.fillText("x-z section (dish z = 0)", margin.left + 6, margin.top + 106);
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
function renderLatestLegacy(result) {
  appState.latest = result;
  stopPlayback();
  const lastFrame = result.history.length - 1;
  elements.playbackSlider.max = String(lastFrame);
  elements.playbackSlider.value = String(lastFrame);
  renderSummary(result);
  renderDisplayModeBanner(result);
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

function executeCaseLegacy(caseName) {
  const params = collectParams();
  const result = runSimulation(caseName, params, appState.ui.solverMode);
  appState.ui.selectedCase = caseName;
  appState.ui.selectedMode = "case";
  elements.sweepCase.value = caseName;
  appState.comparisonRuns = [result];
  syncRunButtons();
  renderLatest(result);
}

function executeAllCasesLegacy() {
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

function executeSweepLegacy() {
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

function bindButtonsLegacy() {
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
  elements.febioRun?.addEventListener("click", async () => {
    try {
      await runFebioViaBridge();
    } catch (error) {
      console.error(error);
    }
  });
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

// -----------------------------------------------------------------------------
// FEBio-first UI overrides
// -----------------------------------------------------------------------------
function describeDisplayedResult(result) {
  if (isPhysicalMainResult(result)) {
    const solverInfo = describeSolverMetadata(result.solverMetadata);
    return {
      title: "FEBio result",
      short: "FEBio",
      pillClass: "source-febio",
      detail:
        solverInfo.note === "imported external result"
          ? `imported physical FEBio result (${solverInfo.label})`
          : `physical FEBio result (${solverInfo.label})`,
    };
  }

  return {
    title: "awaiting FEBio result",
    short: "awaiting",
    pillClass: "source-awaiting",
    detail: "export ready / awaiting FEBio result",
  };
};

var shouldRenderAsMainResult = function shouldRenderAsMainResult(result) {
  return isPhysicalMainResult(result);
};

renderDisplayModeBanner = function renderDisplayModeBanner(result) {
  if (!elements.displayModeBanner) {
    return;
  }
  const displayInfo = describeDisplayedResult(result);
  elements.displayModeBanner.innerHTML = `
    <span class="label-pill display-mode-pill ${displayInfo.pillClass}">${displayInfo.title}</span>
    <span>${displayInfo.detail}</span>
  `;
};

function clearResultVisuals(message) {
  const placeholder = `<p class="subtle">${message}</p>`;
  elements.classificationCard.innerHTML = placeholder;
  elements.eventLog.innerHTML = placeholder;
  elements.metricsTable.innerHTML = placeholder;
  elements.timelineTable.innerHTML = placeholder;
  elements.localBreakdown.innerHTML = placeholder;
  elements.stressChart.innerHTML = placeholder;
  elements.motionChart.innerHTML = placeholder;
  elements.comparisonTable.innerHTML = `<p class="subtle">physical FEBio result only</p>`;
  elements.sweepResults.innerHTML = `<p class="subtle">deprecated in main FEBio path</p>`;
}

function formatDigestMatch(value) {
  return value === true ? "yes" : value === false ? "no" : "pending";
}

function renderRunCard(run) {
  const provenance = run.resultProvenance || {};
  const physical = shouldRenderAsMainResult(run);
  if (physical) {
    return `
      <div class="comparison-card">
        <strong>${run.caseName}</strong>
        <span class="label-pill ${OUTCOME_STYLES[run.classification]}">${run.classification}</span>
        <span class="subtle">parameterDigest ${run.parameterDigest || "n/a"}</span>
        <span class="subtle">source ${provenance.source || run.solverMetadata?.source || "n/a"}</span>
        <span class="subtle">digestMatch ${formatDigestMatch(provenance.digestMatch)}</span>
        <span class="subtle">export ${provenance.exportTimestamp || "n/a"} | import ${provenance.importTimestamp || "n/a"}</span>
        <span class="subtle">firstFailure ${run.firstFailureSite || "n/a"} | mechanism ${run.dominantMechanism || "n/a"}</span>
      </div>
    `;
  }
  return `
    <div class="comparison-card">
      <strong>${run.caseName || appState.ui.selectedCase || "case"}</strong>
      <span class="label-pill info">awaiting import</span>
      <span class="subtle">parameterDigest ${run.parameterDigest || provenance.parameterDigest || "n/a"}</span>
      <span class="subtle">source ${provenance.source || run.solverMetadata?.source || "febio-export-ready"}</span>
      <span class="subtle">digestMatch ${formatDigestMatch(provenance.digestMatch)}</span>
      <span class="subtle">export ${provenance.exportTimestamp || "n/a"} | import ${provenance.importTimestamp || "n/a"}</span>
    </div>
  `;
}

function buildCurrentExportContext(caseName = appState.ui.selectedCase || "C") {
  const params = collectParams();
  const spec = buildFebioInputSpec(caseName, params, buildSimulationInput(caseName, params));
  return buildFebioRunBundle(spec);
}

function normalizeFebioActionUi() {
  elements.runCaseA && (elements.runCaseA.textContent = "ケースA");
  elements.runCaseB && (elements.runCaseB.textContent = "ケースB");
  elements.runCaseC && (elements.runCaseC.textContent = "ケースC");
  elements.resetDefaults && (elements.resetDefaults.textContent = "既定値に戻す");
  elements.importResult && (elements.importResult.textContent = "結果JSON読込");
  elements.exportFebioJson && (elements.exportFebioJson.textContent = "入力JSON保存");
  elements.exportFebioXml && (elements.exportFebioXml.textContent = "FEBio入力(.feb)保存");
  if (elements.febioRun) {
    elements.febioRun.textContent = appState.febioBridge?.busy ? "FEBio実行中..." : "FEBio実行";
    elements.febioRun.title = "FEBio を実行して結果を読み込み、表示まで行います";
  }
  elements.runAll?.remove();
  elements.runSweep?.remove();
  elements.exportFebioHandoff?.remove();
  elements.solverMode?.closest(".inline-select")?.remove();

  const sectionTitles = Array.from(document.querySelectorAll(".simulation-toolbar .action-section-title"));
  if (sectionTitles[0]) sectionTitles[0].textContent = "ケース選択";
  if (sectionTitles[1]) sectionTitles[1].textContent = "実行";
  if (sectionTitles[2]) sectionTitles[2].textContent = "出力";
  if (sectionTitles[3]) sectionTitles[3].textContent = "状態";
}

function updateActionAvailability(exportContext) {
  const hasValidationErrors = Boolean(exportContext?.canonicalSpec?.validationReport && !exportContext.canonicalSpec.validationReport.valid);
  const hasMeshErrors = Boolean(exportContext?.templateData?.geometry?.meshValidation && !exportContext.templateData.geometry.meshValidation.valid);
  const bridgeBusy = Boolean(appState.febioBridge?.busy);
  [elements.exportFebioJson, elements.exportFebioXml, elements.exportFebioHandoff, elements.febioRun].forEach((button) => {
    if (button) {
      button.disabled = hasValidationErrors || hasMeshErrors || bridgeBusy;
    }
  });
  if (elements.febioRun) {
    elements.febioRun.textContent = bridgeBusy ? "FEBio実行中..." : "FEBio実行";
  }
  normalizeFebioActionUi();
}

var renderAwaitingResult = function renderAwaitingResult(exportContext = null) {
  const context = exportContext || appState.exportContext || null;
  appState.latest = null;
  const digest = context?.parameterDigest || "n/a";
  const exportTime = context?.exportTimestamp || "not exported yet";
  const validation = context?.canonicalSpec?.validationReport || context?.validationReport || null;
  const meshValidation = context?.templateData?.geometry?.meshValidation || context?.meshValidation || null;
  const validationText =
    validation && validation.valid
      ? "validation: ok"
      : validation
        ? `validation errors: ${validation.errorCount}`
        : "validation: not yet checked";
  const meshText =
    meshValidation && meshValidation.valid
      ? "mesh validation: ok"
      : meshValidation
        ? "mesh validation: failed"
        : "mesh validation: not yet checked";
  const importWarning = appState.exportContext?.lastImportWarning
    ? `<p class="summary-note">${appState.exportContext.lastImportWarning}</p>`
    : "";
  const bridgeStage = appState.febioBridge?.runStage || "idle";
  const bridgeDetail = appState.febioBridge?.runDetail || "awaiting user action";
  const bridgeUpdatedAt = appState.febioBridge?.lastUpdatedAt || "n/a";
  const bridgeError = appState.febioBridge?.lastError
    ? `<p class="summary-note status-note is-error">${appState.febioBridge.lastError}</p>`
    : "";
  elements.summaryBand.innerHTML = `
    <div>
      <p class="eyebrow">export ready</p>
      <h2>${appState.ui.selectedCase || "C"} / awaiting FEBio result</h2>
      <p><span class="label-pill display-mode-pill source-awaiting">awaiting FEBio result</span></p>
      <p class="summary-note status-note ${appState.febioBridge?.runTone || ""}">current step: ${bridgeStage}</p>
      <p class="summary-note">detail: ${bridgeDetail}</p>
      <p class="summary-note">solver source: febio-cli expected</p>
      <p class="summary-note">parameter digest: ${digest}</p>
      <p class="summary-note">export time: ${exportTime}</p>
      <p class="summary-note">${validationText}</p>
      <p class="summary-note">${meshText}</p>
      <p class="summary-note">result provenance: waiting for imported physical FEBio output</p>
      <p class="summary-note">export ready: ${context?.exportReady ? "yes" : "no"}</p>
      <p class="summary-note">last status update: ${bridgeUpdatedAt}</p>
      ${importWarning}
      ${bridgeError}
    </div>
    <div class="summary-grid">
      <div class="summary-card">
        <strong>${bridgeStage}</strong>
        <span class="subtle">current FEBio step</span>
      </div>
      <div class="summary-card">
        <strong>${digest}</strong>
        <span class="subtle">parameter digest</span>
      </div>
      <div class="summary-card">
        <strong>${appState.febioBridge?.statusText || "bridge: unknown"}</strong>
        <span class="subtle">bridge status</span>
      </div>
    </div>
  `;
  renderDisplayModeBanner(null);
  clearResultVisuals("export ready / awaiting FEBio result");
  stopPlayback();
  updateActionAvailability(context);
};

renderSummary = function renderSummary(result) {
  if (!shouldRenderAsMainResult(result)) {
    renderAwaitingResult(appState.exportContext);
    return;
  }
  const caseMeta = CASE_DESCRIPTIONS[result.caseName];
  const solverInfo = describeSolverMetadata(result.solverMetadata);
  const displayInfo = describeDisplayedResult(result);
  const provenance = result.resultProvenance || {};
  elements.summaryBand.innerHTML = `
    <div>
      <p class="eyebrow">latest physical FEBio result</p>
      <h2>${result.caseName} / ${result.classification}</h2>
      <p><span class="label-pill display-mode-pill ${displayInfo.pillClass}">${displayInfo.title}</span></p>
      <p class="lede">
        核-細胞質損傷 ${formatNumber(result.damage.nc)} | 細胞-ディッシュ損傷 ${formatNumber(result.damage.cd)} | 膜損傷 ${formatNumber(result.damage.membrane)}
      </p>
      <p class="summary-note">${caseMeta.label} | ${caseMeta.summary}</p>
      <p class="summary-note">${displayInfo.detail}</p>
      <p class="summary-note">solver source: ${solverInfo.label}</p>
      <p class="summary-note">parameter digest: ${result.parameterDigest || "n/a"}</p>
      <p class="summary-note">export time: ${provenance.exportTimestamp || "n/a"} | import time: ${provenance.importTimestamp || "n/a"}</p>
      <p class="summary-note">result provenance: ${provenance.source || solverInfo.source}</p>
      <p class="summary-note">digest match: ${formatDigestMatch(provenance.digestMatch)}</p>
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
        <strong>${formatNumber(result.contactAngle, 1)} deg</strong>
        <span class="subtle">接触角</span>
      </div>
      <div class="summary-card">
        <strong>${formatNumber(result.holdStiffnessEffective)}</strong>
        <span class="subtle">有効保持剛性</span>
      </div>
    </div>
  `;
};

renderComparison = function renderComparison() {
  if (!appState.comparisonRuns.length) {
    elements.comparisonTable.innerHTML = "<p>physical FEBio result comparison will appear after importing matched results.</p>";
    return;
  }
  elements.comparisonTable.innerHTML = `
    <div class="comparison-grid">
      ${appState.comparisonRuns.map((run) => renderRunCard(run)).join("")}
    </div>
  `;
};

renderSweep = function renderSweep() {
  if (!appState.sweepRuns.length) {
    elements.sweepResults.innerHTML = "<p>sweep is legacy/deprecated in the main physical FEBio path.</p>";
    return;
  }
  elements.sweepResults.innerHTML = `
    <div class="sweep-grid">
      ${appState.sweepRuns
        .map((run) => `
          <div class="sweep-card">
            <strong>${run.parameter || "parameter"} = ${formatNumber(run.value || 0)}</strong>
            <span class="label-pill info">${run.status || "awaiting import"}</span>
            <span class="subtle">parameterDigest ${run.parameterDigest || "n/a"}</span>
            <span class="subtle">source ${run.resultProvenance?.source || run.solverMetadata?.source || "n/a"}</span>
            <span class="subtle">digestMatch ${formatDigestMatch(run.resultProvenance?.digestMatch)}</span>
          </div>
        `)
        .join("")}
    </div>
  `;
};

renderLatest = function renderLatest(result) {
  if (!shouldRenderAsMainResult(result)) {
    renderAwaitingResult(appState.exportContext);
    return;
  }
  appState.latest = result;
  stopPlayback();
  const lastFrame = result.history.length - 1;
  elements.playbackSlider.max = String(Math.max(lastFrame, 0));
  elements.playbackSlider.value = String(Math.max(lastFrame, 0));
  renderSummary(result);
  renderDisplayModeBanner(result);
  renderClassification(result);
  renderEvents(result);
  renderMetrics(result);
  renderTimeline(result);
  renderLocalBreakdown(result);
  renderCharts(result);
  renderComparison();
  renderSweep();
  renderPlaybackFrame(Math.max(lastFrame, 0));
};

executeCase = function executeCase(caseName) {
  appState.ui.selectedCase = caseName;
  appState.ui.selectedMode = "case";
  elements.sweepCase.value = caseName;
  appState.comparisonRuns = [];
  appState.sweepRuns = [];
  syncRunButtons();
  appState.exportContext = buildCurrentExportContext(caseName);
  renderAwaitingResult(appState.exportContext);
};

executeAllCases = function executeAllCases() {
  appState.ui.selectedMode = "all";
  syncRunButtons();
  appState.comparisonRuns = ["A", "B", "C"].map((caseName) => {
    const context = buildCurrentExportContext(caseName);
    return {
      caseName,
      parameterDigest: context.parameterDigest,
      solverMetadata: { solverMode: "febio", source: "febio-export-ready" },
      resultProvenance: {
        source: "febio-export-ready",
        parameterDigest: context.parameterDigest,
        exportTimestamp: context.exportTimestamp,
        importTimestamp: null,
        digestMatch: null,
      },
      isPhysicalFebioResult: false,
    };
  });
  appState.exportContext = buildCurrentExportContext(appState.ui.selectedCase || "C");
  appState.exportContext.lastImportWarning = "run-all is deprecated in the main physical FEBio path";
  renderAwaitingResult(appState.exportContext);
};

executeSweep = function executeSweep() {
  appState.ui.selectedMode = "sweep";
  syncRunButtons();
  appState.exportContext = buildCurrentExportContext(appState.ui.selectedCase || "C");
  appState.sweepRuns = [
    {
      parameter: elements.sweepParameter.value || "n/a",
      value: Number(elements.sweepStart.value || 0),
      status: "awaiting import",
      parameterDigest: appState.exportContext.parameterDigest,
      solverMetadata: { solverMode: "febio", source: "febio-export-ready" },
      resultProvenance: {
        source: "febio-export-ready",
        parameterDigest: appState.exportContext.parameterDigest,
        exportTimestamp: appState.exportContext.exportTimestamp,
        importTimestamp: null,
        digestMatch: null,
      },
    },
  ];
  appState.exportContext.lastImportWarning = "parameter sweep is deprecated in the main physical FEBio path";
  renderAwaitingResult(appState.exportContext);
};

bindButtons = function bindButtons() {
  if (elements.solverMode) {
    elements.solverMode.innerHTML = `<option value="febio">FEBio</option>`;
    elements.solverMode.value = "febio";
    elements.solverMode.disabled = true;
  }
  window.__markFebioButtonPointer = function __markFebioButtonPointer() {
    if (typeof setFebioRunStage === "function") {
      setFebioRunStage("pointer detected", "FEBio Run button received pointer input", "is-busy");
    }
    if (typeof setFebioBridgeStatus === "function") {
      setFebioBridgeStatus("bridge: click detected", "is-busy");
    }
    if (typeof window.__runFebioFromButton === "function") {
      setTimeout(() => {
        window.__runFebioFromButton();
      }, 0);
    }
  };
  window.__runFebioFromButton = async function __runFebioFromButton() {
    try {
      if (appState?.febioBridge?.dispatching) {
        return;
      }
      if (appState?.febioBridge) {
        appState.febioBridge.dispatching = true;
      }
      if (appState?.febioBridge) {
        appState.febioBridge.runClickCount = (appState.febioBridge.runClickCount || 0) + 1;
      }
      if (typeof setFebioRunStage === "function") {
        setFebioRunStage("button pressed", "dispatching FEBio run from UI", "is-busy");
      }
      await runFebioViaBridge();
    } catch (error) {
      console.error(error);
    } finally {
      if (appState?.febioBridge) {
        appState.febioBridge.dispatching = false;
      }
    }
  };
  elements.runCaseA.addEventListener("click", () => executeCase("A"));
  elements.runCaseB.addEventListener("click", () => executeCase("B"));
  elements.runCaseC.addEventListener("click", () => executeCase("C"));
  elements.runAll.addEventListener("click", executeAllCases);
  elements.runSweep.addEventListener("click", executeSweep);
  elements.exportFebioJson?.addEventListener("click", exportCurrentCaseAsFebioJson);
  elements.exportFebioXml?.addEventListener("click", () => exportFebioXml());
  elements.exportFebioHandoff?.addEventListener("click", () => exportFebioHandoffBundle());
  if (elements.febioRun) {
    elements.febioRun.onclick = window.__runFebioFromButton;
    elements.febioRun.onpointerdown = window.__markFebioButtonPointer;
  }
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
    executeCase(appState.ui.selectedCase || "C");
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
  elements.runAll.disabled = true;
  elements.runSweep.disabled = true;
  elements.runAll.title = "deprecated in main FEBio path";
  elements.runSweep.title = "deprecated in main FEBio path";
};

function initialize() {
  organizeWorkspaceLayout();
  normalizeFebioActionUi();
  populateFields();
  bindFieldListeners();
  fillSweepControls();
  bindButtons();
  normalizeFebioActionUi();
  syncRunButtons();
  syncSolverModeControl();
  refreshFebioBridgeStatus();
  try {
    document.addEventListener(
      "click",
      (event) => {
        const target = event?.target;
        const label = [
          target?.tagName || "unknown",
          target?.id ? `#${target.id}` : "",
          target?.textContent ? `:${String(target.textContent).trim().slice(0, 24)}` : "",
        ].join("");
        if (typeof setFebioBridgeStatus === "function") {
          setFebioBridgeStatus(`bridge: click ${label}`, "is-busy");
        }
      },
      true,
    );
  } catch (error) {
    console.error(error);
  }
  renderComparison();
  renderSweep();
  executeCase("C");
  try {
    const search = window?.location?.search || "";
    if (search && typeof URLSearchParams === "function") {
      const params = new URLSearchParams(search);
      if (params.get("autorun") === "febio-run") {
        setTimeout(() => {
          if (typeof window.__runFebioFromButton === "function") {
            window.__runFebioFromButton();
          }
        }, 150);
      }
    }
  } catch (error) {
    console.error(error);
  }
}

if (!window.__NUCLEAR_SIMU_SKIP_AUTO_INIT__) {
  initialize();
}

