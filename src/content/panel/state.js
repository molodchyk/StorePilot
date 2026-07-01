let parallelLocalizedScreenshotRunState = null;
let parallelLocalizedScreenshotRenderTimerId = 0;
let localizedScreenshotWorkerProgressState = null;
let localizedScreenshotWorkerProgressRenderTimerId = 0;
let localizedScreenshotWorkerSelfRetryInFlight = false;
let localizedScreenshotWorkerSelfRetryKey = "";
let localizedScreenshotWorkerIdentity = null;

function isParallelLocalizedScreenshotRunActive(run = parallelLocalizedScreenshotRunState) {
  return Boolean(run && ["starting", "running", "aborting"].includes(run.status));
}

function formatPanelParallelElapsed(elapsedMs) {
  const totalSeconds = Math.max(0, Math.floor(Number(elapsedMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

function getPanelParallelRunElapsedMs(run) {
  if (!run) return 0;
  if (isParallelLocalizedScreenshotRunActive(run) && run.startedAt) {
    return Math.max(0, Date.now() - run.startedAt);
  }
  return Math.max(0, Number(run.elapsedMs || 0));
}

function getPanelParallelWorkerElapsedMs(worker) {
  if (!worker) return 0;
  if (["opening", "running", "aborting"].includes(worker.status) && worker.startedAt) {
    return Math.max(0, Date.now() - worker.startedAt);
  }
  return Math.max(0, Number(worker.elapsedMs || 0));
}

function getParallelLocalizedScreenshotRunState() {
  return parallelLocalizedScreenshotRunState;
}

function isLocalizedScreenshotWorkerRun(runId) {
  const normalizedRunId = String(runId || "");
  return Boolean(
    normalizedRunId &&
    (
      localizedScreenshotWorkerIdentity &&
        localizedScreenshotWorkerIdentity.runId === normalizedRunId ||
      localizedScreenshotWorkerProgressState &&
        localizedScreenshotWorkerProgressState.runId === normalizedRunId
    )
  );
}

function markLocalizedScreenshotWorkerRun(runId, workerId = "") {
  const normalizedRunId = String(runId || "");
  if (!normalizedRunId) return;

  localizedScreenshotWorkerIdentity = {
    runId: normalizedRunId,
    workerId: String(workerId || "")
  };
  if (parallelLocalizedScreenshotRunState && parallelLocalizedScreenshotRunState.runId === normalizedRunId) {
    parallelLocalizedScreenshotRunState = null;
    renderParallelLocalizedScreenshotBoard();
    updatePanelMediaUi();
  }
}

function normalizeParallelLocalizedScreenshotPanelLocale(value) {
  const parts = String(value || "")
    .trim()
    .replace(/-/g, "_")
    .split("_")
    .filter(Boolean);
  return parts
    .map((part, index) => index === 0 ? part.toLowerCase() : part.toUpperCase())
    .join("_");
}

function createParallelBoardLine(label, value) {
  const line = document.createElement("div");
  line.className = "storepilot-parallel-board-line";
  line.textContent = `${label}: ${value}`;
  return line;
}

function createParallelSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function isParallelClearProgressRun(run) {
  const mode = String(run && run.mode || "");
  const phase = String(run && run.phase || "");
  return mode === "clearOnly" || (mode === "clearThenUpload" && phase === "clearing");
}

function isParallelClearProgressWorker(worker, run = parallelLocalizedScreenshotRunState) {
  const operation = String(worker && worker.operation || "");
  return operation === "clearOnly" || isParallelClearProgressRun(run);
}

function isParallelAuditPhaseText(value) {
  return /auditing persisted localized screenshot count/i.test(String(value || ""));
}

function getParallelAuditTotals(run) {
  const workers = Array.isArray(run && run.workers) ? run.workers : [];
  const totals = run && run.totals || {};
  const auditedLocales = Number(totals.auditedLocales || 0) || workers
    .reduce((sum, worker) => sum + Number(worker.auditedLocales || 0), 0);
  const auditTotalLocales = Number(totals.auditTotalLocales || 0) || workers
    .reduce((sum, worker) => {
      const workerAuditTotal = Number(worker.auditTotalLocales || 0);
      if (workerAuditTotal) return sum + workerAuditTotal;
      return sum + (worker.auditedLocales ? Number(worker.completedLocales || worker.assignedCount || 0) : 0);
    }, 0);

  return {
    auditedLocales,
    auditTotalLocales
  };
}

function isParallelRunAuditing(run) {
  return Boolean(run && (
    isParallelAuditPhaseText(run.phase) ||
    (Array.isArray(run.workers) && run.workers.some(worker => isParallelAuditPhaseText(worker.phase)))
  ));
}

function getParallelTimelineCurrentSample(run, elapsedMs = getPanelParallelRunElapsedMs(run)) {
  const totals = run && run.totals || {};
  const statuses = Array.isArray(run && run.localeStatuses) ? run.localeStatuses : [];
  const totalLocales = Math.max(Number(totals.totalLocales || 0), statuses.length);
  let completedLocales = Math.min(totalLocales, Number(totals.completedLocales || 0));
  let failedLocales = Math.min(
    Math.max(0, totalLocales - completedLocales),
    Number(totals.failedLocales || 0)
  );
  const statusSkippedLocales = statuses.length
    ? statuses.filter(status => status.status === "skipped").length
    : Number(totals.skippedLocales || 0);
  let skippedLocales = Math.min(
    Math.max(0, totalLocales - completedLocales - failedLocales),
    statusSkippedLocales
  );

  if (!completedLocales && !failedLocales && !skippedLocales && statuses.length) {
    const countClearedAsComplete = run &&
      run.mode === "clearThenUpload" &&
      run.phase === "clearing";
    completedLocales = statuses.filter(status => (
      status.status === "completed" || (countClearedAsComplete && status.status === "cleared")
    )).length;
    failedLocales = statuses.filter(status => status.status === "failed" || status.status === "aborted").length;
    skippedLocales = statuses.filter(status => status.status === "skipped").length;
  }

  return {
    elapsedMs,
    completedLocales,
    failedLocales,
    skippedLocales,
    remainingLocales: Math.max(0, totalLocales - completedLocales - failedLocales - skippedLocales),
    uploadedScreenshots: Number(totals.uploadedScreenshots || 0),
    totalLocales
  };
}

function getParallelTimelineSamples(run) {
  if (!run) return [];

  const currentPhase = String(run.phase || "");
  let rawSamples = Array.isArray(run.timeline) ? run.timeline : [];
  if (currentPhase && rawSamples.some(sample => String(sample && sample.phase || "") === currentPhase)) {
    rawSamples = rawSamples.filter(sample => String(sample && sample.phase || "") === currentPhase);
  }

  const samples = rawSamples.length
    ? rawSamples.map(sample => ({
      elapsedMs: Number(sample.elapsedMs || 0),
      completedLocales: Number(sample.completedLocales || 0),
      failedLocales: Number(sample.failedLocales || 0),
      skippedLocales: Number(sample.skippedLocales || 0),
      remainingLocales: Number(sample.remainingLocales || 0),
      uploadedScreenshots: Number(sample.uploadedScreenshots || 0),
      totalLocales: Number(sample.totalLocales || run.totals && run.totals.totalLocales || 0)
    })).filter(sample => Number.isFinite(sample.elapsedMs))
    : [];

  const liveSample = getParallelTimelineCurrentSample(run);
  const lastSample = samples[samples.length - 1];
  if (!lastSample || liveSample.elapsedMs > lastSample.elapsedMs) {
    samples.push(liveSample);
  }

  if (!samples.length) {
    samples.push(liveSample);
  }

  const normalizedSamples = normalizeParallelTimelineSamples(samples, run);
  if (normalizedSamples[0] && normalizedSamples[0].elapsedMs > 0) {
    const totalLocales = Number(run.totals && run.totals.totalLocales || samples[0].totalLocales || 0);
    normalizedSamples.unshift({
      elapsedMs: 0,
      completedLocales: 0,
      failedLocales: 0,
      skippedLocales: 0,
      remainingLocales: totalLocales,
      uploadedScreenshots: 0,
      totalLocales
    });
  }

  return normalizedSamples;
}

function normalizeParallelTimelineSamples(samples, run) {
  const totalLocales = Math.max(
    0,
    Number(run && run.totals && run.totals.totalLocales || 0),
    ...samples.map(sample => Number(sample.totalLocales || 0))
  );
  const byElapsedMs = new Map();

  for (const sample of samples.slice().sort((left, right) => left.elapsedMs - right.elapsedMs)) {
    const elapsedMs = Math.max(0, Number(sample.elapsedMs || 0));
    const key = String(elapsedMs);
    const previous = byElapsedMs.get(key);
    const normalized = {
      elapsedMs,
      completedLocales: Math.max(0, Math.min(totalLocales, Number(sample.completedLocales || 0))),
      failedLocales: Math.max(0, Math.min(totalLocales, Number(sample.failedLocales || 0))),
      skippedLocales: Math.max(0, Math.min(totalLocales, Number(sample.skippedLocales || 0))),
      remainingLocales: Math.max(0, Math.min(totalLocales, Number(sample.remainingLocales || 0))),
      uploadedScreenshots: Math.max(0, Number(sample.uploadedScreenshots || 0)),
      totalLocales
    };

    if (!previous) {
      byElapsedMs.set(key, normalized);
      continue;
    }

    byElapsedMs.set(key, {
      ...normalized,
      completedLocales: Math.max(previous.completedLocales, normalized.completedLocales),
      failedLocales: Math.max(previous.failedLocales, normalized.failedLocales),
      skippedLocales: Math.max(previous.skippedLocales, normalized.skippedLocales),
      remainingLocales: Math.min(previous.remainingLocales, normalized.remainingLocales),
      uploadedScreenshots: Math.max(previous.uploadedScreenshots, normalized.uploadedScreenshots)
    });
  }

  const normalizedSamples = Array.from(byElapsedMs.values()).sort((left, right) => left.elapsedMs - right.elapsedMs);
  let completedLocales = 0;
  let failedLocales = 0;
  let skippedLocales = 0;

  return normalizedSamples.map(sample => {
    completedLocales = Math.max(completedLocales, sample.completedLocales);
    failedLocales = Math.max(failedLocales, sample.failedLocales);
    skippedLocales = Math.max(skippedLocales, sample.skippedLocales);
    const cappedCompleted = Math.min(totalLocales, completedLocales);
    const cappedFailed = Math.min(Math.max(0, totalLocales - cappedCompleted), failedLocales);
    const cappedSkipped = Math.min(Math.max(0, totalLocales - cappedCompleted - cappedFailed), skippedLocales);

    return {
      ...sample,
      completedLocales: cappedCompleted,
      failedLocales: cappedFailed,
      skippedLocales: cappedSkipped,
      remainingLocales: Math.max(0, totalLocales - cappedCompleted - cappedFailed - cappedSkipped),
      totalLocales
    };
  });
}

function buildParallelTimelineStepPathData(samples, field, xForSample, yForValue) {
  if (!Array.isArray(samples) || !samples.length) return "";

  const first = samples[0];
  let previousX = xForSample(first);
  let previousY = yForValue(first[field] || 0);
  const parts = [`M ${previousX.toFixed(1)} ${previousY.toFixed(1)}`];

  for (const sample of samples.slice(1)) {
    const nextX = xForSample(sample);
    const nextY = yForValue(sample[field] || 0);

    if (nextX !== previousX) {
      parts.push(`L ${nextX.toFixed(1)} ${previousY.toFixed(1)}`);
    }
    if (nextY !== previousY) {
      parts.push(`L ${nextX.toFixed(1)} ${nextY.toFixed(1)}`);
    }

    previousX = nextX;
    previousY = nextY;
  }

  return parts.join(" ");
}

function createParallelTimelineStepPath(samples, field, xForSample, yForValue, className) {
  return createParallelSvgElement("path", {
    class: className,
    d: buildParallelTimelineStepPathData(samples, field, xForSample, yForValue),
    fill: "none",
    style: "fill: none;",
    "stroke-width": "2.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  });
}

function renderParallelTimelineChart(container, run) {
  if (!container) return;
  container.replaceChildren();

  if (!run) {
    container.hidden = true;
    return;
  }

  const samples = getParallelTimelineSamples(run);
  const width = 300;
  const height = 88;
  const padding = { left: 26, right: 8, top: 8, bottom: 18 };
  const maxElapsed = Math.max(1, ...samples.map(sample => sample.elapsedMs));
  const maxLocales = Math.max(1, Number(run.totals && run.totals.totalLocales || 0), ...samples.map(sample => sample.totalLocales || 0));
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const xForSample = sample => padding.left + (Math.max(0, sample.elapsedMs) / maxElapsed) * chartWidth;
  const yForValue = value => padding.top + (1 - (Math.max(0, value) / maxLocales)) * chartHeight;
  const svg = createParallelSvgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": "Localized screenshot progress over elapsed time"
  });

  for (const ratio of [0, 0.5, 1]) {
    const y = padding.top + ratio * chartHeight;
    svg.append(createParallelSvgElement("line", {
      class: "storepilot-parallel-chart-grid",
      x1: padding.left,
      y1: y,
      x2: width - padding.right,
      y2: y
    }));
  }

  svg.append(createParallelTimelineStepPath(samples, "remainingLocales", xForSample, yForValue, "storepilot-parallel-chart-remaining"));
  svg.append(createParallelTimelineStepPath(samples, "completedLocales", xForSample, yForValue, "storepilot-parallel-chart-completed"));
  if (samples.some(sample => sample.failedLocales > 0)) {
    svg.append(createParallelTimelineStepPath(samples, "failedLocales", xForSample, yForValue, "storepilot-parallel-chart-failed"));
  }

  const startLabel = createParallelSvgElement("text", {
    class: "storepilot-parallel-chart-label",
    x: padding.left,
    y: height - 4
  });
  startLabel.textContent = "0s";
  svg.append(startLabel);

  const endLabel = createParallelSvgElement("text", {
    class: "storepilot-parallel-chart-label storepilot-parallel-chart-label-end",
    x: width - padding.right,
    y: height - 4,
    "text-anchor": "end"
  });
  endLabel.textContent = formatPanelParallelElapsed(maxElapsed);
  svg.append(endLabel);

  const doneLabel = createParallelSvgElement("text", {
    class: "storepilot-parallel-chart-label storepilot-parallel-chart-done-label",
    x: width - padding.right,
    y: Math.max(10, yForValue(samples[samples.length - 1].completedLocales || 0) - 4),
    "text-anchor": "end"
  });
  doneLabel.textContent = "done";
  if (isParallelClearProgressRun(run)) {
    doneLabel.textContent = "cleared";
  }
  svg.append(doneLabel);

  const remainingLabel = createParallelSvgElement("text", {
    class: "storepilot-parallel-chart-label storepilot-parallel-chart-remaining-label",
    x: width - padding.right,
    y: Math.min(height - padding.bottom - 2, yForValue(samples[samples.length - 1].remainingLocales || 0) + 10),
    "text-anchor": "end"
  });
  remainingLabel.textContent = "remaining";
  svg.append(remainingLabel);

  container.hidden = false;
  container.append(svg);
}

function getLocalizedScreenshotWorkerProgressElapsedMs(progress) {
  if (!progress) return 0;
  if (mediaOperationState.running && progress.startedAt) {
    return Math.max(0, Date.now() - progress.startedAt);
  }
  return Math.max(0, Number(progress.elapsedMs || 0));
}

function getLocalizedScreenshotWorkerProgressCounts(progress) {
  const totalLocales = Math.max(0, Number(progress && progress.totalLocales || 0));
  const completedLocales = Math.min(totalLocales, Number(progress && progress.completedLocales || 0));
  const failedLocales = Math.min(
    Math.max(0, totalLocales - completedLocales),
    Number(progress && progress.failedLocales || 0)
  );
  const skippedLocales = Math.min(
    Math.max(0, totalLocales - completedLocales - failedLocales),
    Number(progress && progress.skippedLocales || 0)
  );

  return {
    completedLocales,
    failedLocales,
    skippedLocales,
    remainingLocales: Math.max(0, totalLocales - completedLocales - failedLocales - skippedLocales),
    uploadedScreenshots: Number(progress && progress.uploadedScreenshots || 0),
    totalScreenshots: Number(progress && progress.totalScreenshots || 0),
    totalLocales
  };
}

function isLocalizedScreenshotWorkerClearProgress(progress) {
  return String(progress && progress.operation || "") === "clearOnly";
}

function getLocalizedScreenshotWorkerProgressStatus(progress) {
  const counts = getLocalizedScreenshotWorkerProgressCounts(progress);
  const phase = String(progress && progress.phase || "").toLowerCase();
  if (mediaOperationState.running) return "running";
  if (/hidden|minimized|paused/.test(phase)) return "paused";
  if (counts.completedLocales + counts.failedLocales + counts.skippedLocales < counts.totalLocales) {
    return "incomplete";
  }
  return "finished";
}

function isLocalizedScreenshotWorkerSelfRetryVisible() {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden" && document.hidden !== true;
}

function getLocalizedScreenshotWorkerSelfRetryKey(progress) {
  return [
    progress && progress.runId || "",
    progress && progress.workerId || "",
    progress && progress.locale || "",
    progress && progress.localeIndex || 0,
    progress && progress.completedLocales || 0,
    progress && progress.failedLocales || 0,
    progress && progress.skippedLocales || 0,
    progress && progress.phase || ""
  ].join("|");
}

function requestLocalizedScreenshotWorkerSelfRetryIfVisible() {
  const progress = localizedScreenshotWorkerProgressState;
  if (!progress || mediaOperationState.running || localizedScreenshotWorkerSelfRetryInFlight) return;
  if (!progress.runId || !progress.workerId || typeof storePilotRuntimeSendMessage !== "function") return;
  if (!isLocalizedScreenshotWorkerSelfRetryVisible()) return;

  const phase = String(progress.phase || "").toLowerCase();
  const status = getLocalizedScreenshotWorkerProgressStatus(progress);
  if (status !== "paused" && !/hidden|minimized/.test(phase)) return;

  const retryKey = getLocalizedScreenshotWorkerSelfRetryKey(progress);
  if (retryKey === localizedScreenshotWorkerSelfRetryKey) return;
  localizedScreenshotWorkerSelfRetryKey = retryKey;
  localizedScreenshotWorkerSelfRetryInFlight = true;

  storePilotRuntimeSendMessage({
    type: "storepilot-retry-localized-screenshot-worker-tab",
    runId: progress.runId,
    workerId: progress.workerId,
    options: {
      freshTab: true
    }
  }).then(response => {
    if (response && response.run) {
      updateParallelLocalizedScreenshotRunState(response.run);
    }
    if (!response || !response.ok) {
      localizedScreenshotWorkerSelfRetryKey = "";
    }
  }).catch(() => {
    localizedScreenshotWorkerSelfRetryKey = "";
  }).finally(() => {
    localizedScreenshotWorkerSelfRetryInFlight = false;
  });
}

async function retryLocalizedScreenshotWorkerFromPanel() {
  const progress = localizedScreenshotWorkerProgressState;
  if (!progress || !progress.runId || !progress.workerId || typeof storePilotRuntimeSendMessage !== "function") return;
  if (mediaOperationState.running || localizedScreenshotWorkerSelfRetryInFlight) return;

  localizedScreenshotWorkerSelfRetryInFlight = true;
  try {
    const response = await storePilotRuntimeSendMessage({
      type: "storepilot-retry-localized-screenshot-worker-tab",
      runId: progress.runId,
      workerId: progress.workerId,
      options: {
        freshTab: true
      }
    });
    if (response && response.run) {
      updateParallelLocalizedScreenshotRunState(response.run);
    }
    const panelStatus = document.querySelector(`#${PANEL_ID} .storepilot-status`);
    if (panelStatus) {
      panelStatus.textContent = response && response.message || localize("parallelLocalizedScreenshotsStarting", "Starting parallel localized screenshot upload.");
    }
    if (!response || !response.ok) {
      localizedScreenshotWorkerSelfRetryKey = "";
    }
  } catch (_error) {
    localizedScreenshotWorkerSelfRetryKey = "";
  } finally {
    localizedScreenshotWorkerSelfRetryInFlight = false;
    renderLocalizedScreenshotWorkerProgressBoard();
  }
}

function getParallelWorkerRetryLocalesForPanel(run, worker) {
  if (!worker) return [];

  const assignedLocales = (worker.assignedLocales || [])
    .map(normalizeParallelLocalizedScreenshotPanelLocale)
    .filter(Boolean);
  const completedSet = new Set((worker.completedLocaleList || []).map(normalizeParallelLocalizedScreenshotPanelLocale));
  const skippedSet = new Set((worker.skippedLocaleList || []).map(normalizeParallelLocalizedScreenshotPanelLocale));
  const retrySet = new Set((worker.failedLocaleList || []).map(normalizeParallelLocalizedScreenshotPanelLocale).filter(Boolean));
  const activeClearRetry = isParallelLocalizedScreenshotRunActive(run) &&
    String(run && run.mode || "") === "clearThenUpload" &&
    String(worker.operation || "") === "clearOnly";
  const completedNeedsUpload = String(run && run.mode || "") === "clearThenUpload" &&
    String(worker.operation || "") === "clearOnly" &&
    !activeClearRetry;

  for (const locale of assignedLocales) {
    if (skippedSet.has(locale)) continue;
    if (completedNeedsUpload || !completedSet.has(locale)) {
      retrySet.add(locale);
    }
  }

  return Array.from(retrySet);
}

function isParallelWorkerRetryVisibleOnMaster(run, worker) {
  if (!run || !worker || !worker.workerId) return false;
  if (["preparing", "opening", "running", "aborting", "completed"].includes(String(worker.status || ""))) return false;
  return getParallelWorkerRetryLocalesForPanel(run, worker).length > 0;
}

async function retryParallelLocalizedScreenshotWorkerFromMaster(workerId) {
  const run = getParallelLocalizedScreenshotRunState();
  if (!run || !run.runId || !workerId || typeof storePilotRuntimeSendMessage !== "function") return;

  const panelStatus = document.querySelector(`#${PANEL_ID} .storepilot-status`);
  if (panelStatus) {
    panelStatus.textContent = localize("parallelLocalizedScreenshotsStarting", "Starting parallel localized screenshot upload.");
  }

  try {
    const response = await storePilotRuntimeSendMessage({
      type: "storepilot-retry-localized-screenshot-worker-tab",
      runId: run.runId,
      workerId,
      options: {
        freshTab: true,
        fromMaster: true
      }
    });
    if (response && response.run) {
      updateParallelLocalizedScreenshotRunState(response.run);
    }
    if (panelStatus) {
      panelStatus.textContent = response && response.message || localize("parallelLocalizedScreenshotsStarting", "Starting parallel localized screenshot upload.");
    }
  } catch (error) {
    if (panelStatus) {
      panelStatus.textContent = error && error.message || String(error || "");
    }
  }
}

function createLocalizedScreenshotWorkerProgressSample(progress, phase = "") {
  const counts = getLocalizedScreenshotWorkerProgressCounts(progress);
  return {
    elapsedMs: getLocalizedScreenshotWorkerProgressElapsedMs(progress),
    phase,
    completedLocales: counts.completedLocales,
    failedLocales: counts.failedLocales,
    skippedLocales: counts.skippedLocales,
    remainingLocales: counts.remainingLocales,
    uploadedScreenshots: counts.uploadedScreenshots,
    totalLocales: counts.totalLocales
  };
}

function recordLocalizedScreenshotWorkerProgressSample(progress, phase = "") {
  if (!progress) return null;

  const previous = localizedScreenshotWorkerProgressState;
  const sameRun = previous &&
    previous.runId === progress.runId &&
    previous.workerId === progress.workerId &&
    previous.startedAt === progress.startedAt;
  const timeline = sameRun && Array.isArray(previous.timeline)
    ? previous.timeline.slice()
    : [];
  const sample = createLocalizedScreenshotWorkerProgressSample(progress, phase);
  const lastSample = timeline[timeline.length - 1];
  const changed = !lastSample ||
    lastSample.completedLocales !== sample.completedLocales ||
    lastSample.failedLocales !== sample.failedLocales ||
    lastSample.skippedLocales !== sample.skippedLocales ||
    lastSample.remainingLocales !== sample.remainingLocales ||
    lastSample.uploadedScreenshots !== sample.uploadedScreenshots ||
    lastSample.phase !== sample.phase;
  const stale = !lastSample || sample.elapsedMs - lastSample.elapsedMs >= 2000;

  if (!lastSample || changed || stale) {
    timeline.push(sample);
  }

  if (timeline.length > 120) {
    timeline.splice(0, timeline.length - 120);
  }

  return {
    ...progress,
    phase,
    elapsedMs: sample.elapsedMs,
    timeline,
    lastUpdatedAt: Date.now()
  };
}

function createLocalizedScreenshotWorkerRunForChart(progress) {
  const counts = getLocalizedScreenshotWorkerProgressCounts(progress);
  return {
    status: getLocalizedScreenshotWorkerProgressStatus(progress),
    mode: isLocalizedScreenshotWorkerClearProgress(progress) ? "clearOnly" : "replace",
    phase: progress && progress.operation || "",
    startedAt: progress && progress.startedAt || 0,
    elapsedMs: getLocalizedScreenshotWorkerProgressElapsedMs(progress),
    totals: counts,
    timeline: Array.isArray(progress && progress.timeline) ? progress.timeline : []
  };
}

function renderLocalizedScreenshotWorkerProgressBoard(panel = document.getElementById(PANEL_ID)) {
  if (!panel) return;

  const board = panel.querySelector(".storepilot-localized-worker-board");
  if (!board) return;

  const title = board.querySelector(".storepilot-localized-worker-title");
  const summary = board.querySelector(".storepilot-localized-worker-summary");
  const chart = board.querySelector(".storepilot-localized-worker-chart");
  const retryButton = board.querySelector("[data-storepilot-action='retry-localizedScreenshotWorker']");
  if (!title || !summary || !chart) return;

  const progress = localizedScreenshotWorkerProgressState;
  if (!progress) {
    board.hidden = true;
    summary.replaceChildren();
    chart.replaceChildren();
    if (retryButton) retryButton.hidden = true;
    updateLocalizedScreenshotWorkerProgressRenderTimer();
    return;
  }

  const counts = getLocalizedScreenshotWorkerProgressCounts(progress);
  const elapsed = formatPanelParallelElapsed(getLocalizedScreenshotWorkerProgressElapsedMs(progress));
  const clearProgress = isLocalizedScreenshotWorkerClearProgress(progress);
  const localeProgressVerb = clearProgress ? "cleared" : "completed";
  const screenshotSummary = clearProgress
    ? `clear-only, ${counts.totalScreenshots || 0} source screenshot(s)`
    : `${counts.uploadedScreenshots || 0}/${counts.totalScreenshots || 0} uploaded`;

  board.hidden = false;
  title.textContent = progress.workerId
    ? `${progress.workerId} localized screenshots`
    : localize("localizedScreenshotWorkerProgressTitle", "Localized screenshot progress");
  summary.replaceChildren(
    createParallelBoardLine(localize("parallelLocalizedScreenshotsStatus", "Status"), getLocalizedScreenshotWorkerProgressStatus(progress)),
    createParallelBoardLine(localize("parallelLocalizedScreenshotsLocales", "Locales"), `${counts.completedLocales}/${counts.totalLocales} ${localeProgressVerb}, ${counts.failedLocales} failed, ${counts.skippedLocales} skipped`),
    createParallelBoardLine(localize("parallelLocalizedScreenshotsScreenshots", "Screenshots"), screenshotSummary),
    createParallelBoardLine("Locale", `${Number(progress.localeIndex || 0) + 1}/${progress.totalLocales || 0} - ${progress.locale || ""} (${progress.localeScreenshotCount || 0} expected)`),
    createParallelBoardLine("Elapsed", elapsed),
    createParallelBoardLine("Step", progress.phase || "")
  );
  renderParallelTimelineChart(chart, createLocalizedScreenshotWorkerRunForChart(progress));
  if (retryButton) {
    const hasUnfinishedResponsibility = counts.failedLocales > 0 ||
      counts.completedLocales + counts.skippedLocales < counts.totalLocales;
    retryButton.hidden = mediaOperationState.running ||
      localizedScreenshotWorkerSelfRetryInFlight ||
      !progress.runId ||
      !progress.workerId ||
      !hasUnfinishedResponsibility;
    retryButton.disabled = retryButton.hidden;
  }
  updateLocalizedScreenshotWorkerProgressRenderTimer();
  requestLocalizedScreenshotWorkerSelfRetryIfVisible();
}

function updateLocalizedScreenshotWorkerProgressState(progress, phase = "") {
  if (progress && progress.runId) {
    markLocalizedScreenshotWorkerRun(progress.runId, progress.workerId || "");
  }
  localizedScreenshotWorkerProgressState = recordLocalizedScreenshotWorkerProgressSample(progress, phase);
  if (
    localizedScreenshotWorkerProgressState &&
    parallelLocalizedScreenshotRunState &&
    localizedScreenshotWorkerProgressState.runId === parallelLocalizedScreenshotRunState.runId
  ) {
    parallelLocalizedScreenshotRunState = null;
    renderParallelLocalizedScreenshotBoard();
  }
  renderLocalizedScreenshotWorkerProgressBoard();
}

if (
  typeof window !== "undefined" &&
  typeof window.addEventListener === "function" &&
  typeof document !== "undefined" &&
  typeof document.addEventListener === "function"
) {
  document.addEventListener("visibilitychange", requestLocalizedScreenshotWorkerSelfRetryIfVisible);
  window.addEventListener("focus", requestLocalizedScreenshotWorkerSelfRetryIfVisible);
  window.addEventListener("pageshow", requestLocalizedScreenshotWorkerSelfRetryIfVisible);
}

function updateLocalizedScreenshotWorkerProgressRenderTimer() {
  const active = Boolean(localizedScreenshotWorkerProgressState && mediaOperationState.running);
  if (active && !localizedScreenshotWorkerProgressRenderTimerId) {
    localizedScreenshotWorkerProgressRenderTimerId = window.setInterval(() => {
      renderLocalizedScreenshotWorkerProgressBoard();
    }, 1000);
  } else if (!active && localizedScreenshotWorkerProgressRenderTimerId) {
    window.clearInterval(localizedScreenshotWorkerProgressRenderTimerId);
    localizedScreenshotWorkerProgressRenderTimerId = 0;
  }
}

function getParallelLocaleStatusLabel(status) {
  const labels = {
    pending: "pending",
    pendingClear: "pending clear",
    pendingUpload: "pending upload",
    clearing: "clearing",
    cleared: "cleared",
    uploading: "uploading",
    replacing: "replacing",
    running: "running",
    completed: "completed",
    failed: "failed",
    skipped: "skipped",
    aborted: "aborted"
  };
  return labels[status] || status || "unknown";
}

function renderParallelLocaleStatuses(container, run) {
  if (!container) return;
  container.replaceChildren();

  const statuses = Array.isArray(run && run.localeStatuses) ? run.localeStatuses : [];
  if (!statuses.length) {
    container.hidden = true;
    return;
  }

  for (const status of statuses) {
    const chip = document.createElement("span");
    const statusName = status.status || "pending";
    chip.className = "storepilot-locale-status";
    chip.dataset.status = statusName;
    chip.textContent = status.locale || "";
    chip.title = [
      `${status.locale || ""}: ${getParallelLocaleStatusLabel(statusName)}`,
      status.workerId || "",
      status.phase || "",
      status.message || ""
    ].filter(Boolean).join(" - ");
    container.append(chip);
  }

  container.hidden = false;
}

function updateParallelLocalizedScreenshotRenderTimer() {
  const active = isParallelLocalizedScreenshotRunActive();
  if (active && !parallelLocalizedScreenshotRenderTimerId) {
    parallelLocalizedScreenshotRenderTimerId = window.setInterval(() => {
      renderParallelLocalizedScreenshotBoard();
    }, 1000);
  } else if (!active && parallelLocalizedScreenshotRenderTimerId) {
    window.clearInterval(parallelLocalizedScreenshotRenderTimerId);
    parallelLocalizedScreenshotRenderTimerId = 0;
  }
}

function renderParallelLocalizedScreenshotBoard(panel = document.getElementById(PANEL_ID)) {
  if (!panel) return;

  const board = panel.querySelector(".storepilot-parallel-board");
  if (!board) return;

  const run = parallelLocalizedScreenshotRunState;
  const summary = board.querySelector(".storepilot-parallel-board-summary");
  const chart = board.querySelector(".storepilot-parallel-chart");
  const localeStatuses = board.querySelector(".storepilot-parallel-locales");
  const workers = board.querySelector(".storepilot-parallel-workers");
  const abortButton = board.querySelector("[data-storepilot-action='abort-localizedScreenshotsParallel']");
  const resumeButton = board.querySelector("[data-storepilot-action='resume-localizedScreenshotsParallel']");
  const retryButton = board.querySelector("[data-storepilot-action='retry-localizedScreenshotsParallel']");
  const downloadButton = board.querySelector("[data-storepilot-action='download-localizedScreenshotsParallelLog']");
  if (!summary || !workers || !abortButton || !resumeButton || !retryButton || !downloadButton) return;

  if (!run || isLocalizedScreenshotWorkerRun(run.runId)) {
    board.hidden = true;
    summary.replaceChildren();
    if (chart) chart.replaceChildren();
    if (localeStatuses) localeStatuses.replaceChildren();
    workers.replaceChildren();
    abortButton.hidden = true;
    resumeButton.hidden = true;
    retryButton.hidden = true;
    downloadButton.hidden = true;
    updateParallelLocalizedScreenshotRenderTimer();
    return;
  }

  const totals = run.totals || {};
  const elapsed = formatPanelParallelElapsed(getPanelParallelRunElapsedMs(run));
  const failedWorkerCount = (run.workers || []).filter(worker => worker.status === "failed" || (worker.failedLocales || 0) > 0).length;
  const hasFailedLocales = failedWorkerCount > 0 || Number(totals.failedLocales || 0) > 0;
  const resumeLocales = typeof getParallelLocalizedScreenshotResumeLocales === "function"
    ? getParallelLocalizedScreenshotResumeLocales(run)
    : Array.isArray(run.resumeLocales) ? run.resumeLocales : [];
  const hasResumeLocales = resumeLocales.length > 0;
  const clearProgress = isParallelClearProgressRun(run);
  const auditTotals = getParallelAuditTotals(run);
  const auditing = isParallelRunAuditing(run) ||
    (auditTotals.auditTotalLocales > 0 && auditTotals.auditedLocales < auditTotals.auditTotalLocales);
  const localeProgressVerb = clearProgress
    ? "cleared"
    : auditing && Number(totals.uploadedScreenshots || 0) >= Number(totals.totalScreenshots || 0)
      ? "uploaded"
      : "completed";
  const screenshotSummary = clearProgress
    ? `clear-only, ${totals.totalScreenshots || 0} source screenshot(s)`
    : `${totals.uploadedScreenshots || 0}/${totals.totalScreenshots || 0} uploaded`;
  const mutationGate = run.mutationGate || {};
  const currentLease = mutationGate.currentLease || null;
  const gateSummary = mutationGate.enabled
    ? currentLease
      ? `${currentLease.workerId || "worker"} ${currentLease.action || "media"} ${currentLease.locale || ""}${currentLease.screenshotSlot ? ` #${currentLease.screenshotSlot}` : ""}; ${mutationGate.queuedCount || 0} queued`
      : (mutationGate.nextAvailableInMs || 0) > 0
        ? `cooldown ${Math.ceil((mutationGate.nextAvailableInMs || 0) / 1000)}s; ${mutationGate.queuedCount || 0} queued`
        : `ready; ${mutationGate.queuedCount || 0} queued`
    : "off";
  const statusSummary = auditing
    ? `${run.status || "unknown"} - auditing persisted screenshots - elapsed ${elapsed}`
    : `${run.status || "unknown"} - elapsed ${elapsed}`;
  const summaryLines = [
    createParallelBoardLine(localize("parallelLocalizedScreenshotsStatus", "Status"), statusSummary),
    createParallelBoardLine(localize("parallelLocalizedScreenshotsMode", "Mode"), `${run.mode || "coordinated"}${run.phase ? ` - ${run.phase}` : ""}`),
    createParallelBoardLine(localize("parallelLocalizedScreenshotsLocales", "Locales"), `${totals.completedLocales || 0}/${totals.totalLocales || 0} ${localeProgressVerb}, ${totals.failedLocales || 0} failed, ${totals.skippedLocales || 0} skipped`),
    createParallelBoardLine(localize("parallelLocalizedScreenshotsScreenshots", "Screenshots"), screenshotSummary)
  ];
  if (auditing || auditTotals.auditTotalLocales > 0) {
    summaryLines.push(createParallelBoardLine(
      localize("parallelLocalizedScreenshotsAudit", "Audit"),
      `${auditTotals.auditedLocales || 0}/${auditTotals.auditTotalLocales || totals.completedLocales || totals.totalLocales || 0} verified`
    ));
  }
  summaryLines.push(createParallelBoardLine(localize("parallelLocalizedScreenshotsMutationGate", "Media gate"), gateSummary));

  board.hidden = false;
  summary.replaceChildren(...summaryLines);

  renderParallelTimelineChart(chart, run);
  renderParallelLocaleStatuses(localeStatuses, run);

  workers.replaceChildren(...(run.workers || []).map(worker => {
    const row = document.createElement("div");
    const title = document.createElement("div");
    const counts = document.createElement("div");
    const current = document.createElement("div");
    const workerActions = document.createElement("div");
    const retryWorkerButton = createButton(localize("retryLocalizedScreenshotWorker", "Retry this worker"), async () => {
      retryWorkerButton.disabled = true;
      await retryParallelLocalizedScreenshotWorkerFromMaster(worker.workerId);
    });
    const elapsedLabel = formatPanelParallelElapsed(getPanelParallelWorkerElapsedMs(worker));
    const workerClearProgress = isParallelClearProgressWorker(worker, run);
    const workerAuditTotal = Number(worker.auditTotalLocales || 0) ||
      (worker.auditedLocales ? Number(worker.completedLocales || worker.assignedCount || 0) : 0);
    const workerAuditText = workerAuditTotal
      ? `; audit ${worker.auditedLocales || 0}/${workerAuditTotal}`
      : "";
    const gateText = worker.mutationGateWaiting && worker.mutationGateRequest
      ? `waiting for media gate: ${worker.mutationGateRequest.action || "media"} ${worker.mutationGateRequest.locale || ""}${worker.mutationGateRequest.screenshotSlot ? ` #${worker.mutationGateRequest.screenshotSlot}` : ""}`
      : worker.currentMutationLease
        ? `media gate active: ${worker.currentMutationLease.action || "media"} ${worker.currentMutationLease.locale || ""}${worker.currentMutationLease.screenshotSlot ? ` #${worker.currentMutationLease.screenshotSlot}` : ""}`
        : "";
    const currentText = gateText || (worker.currentLocale
      ? `${worker.currentLocale}${worker.phase ? ` - ${worker.phase}` : ""}`
      : (worker.phase || worker.message || ""));

    row.className = "storepilot-parallel-worker";
    title.className = "storepilot-parallel-worker-title";
    counts.className = "storepilot-parallel-worker-counts";
    current.className = "storepilot-parallel-worker-current";
    workerActions.className = "storepilot-parallel-worker-actions";
    retryWorkerButton.dataset.storepilotAction = "retry-localizedScreenshotsParallelWorker";
    const showWorkerRetry = isParallelWorkerRetryVisibleOnMaster(run, worker);
    title.textContent = `${worker.workerId}: ${worker.operation || "replace"} - ${worker.status}${worker.closed ? " (closed)" : ""}`;
    counts.textContent = workerClearProgress
      ? `Locales ${worker.completedLocales || 0}/${worker.assignedCount || 0}; clear-only${workerAuditText}; elapsed ${elapsedLabel}`
      : `Locales ${worker.completedLocales || 0}/${worker.assignedCount || 0}; screenshots ${worker.uploadedScreenshots || 0}/${worker.totalScreenshots || 0}${workerAuditText}; elapsed ${elapsedLabel}`;
    current.textContent = currentText || "Waiting for progress.";
    if (showWorkerRetry) {
      workerActions.append(retryWorkerButton);
    }
    row.append(title, counts, current, workerActions);
    return row;
  }));

  const activeRun = isParallelLocalizedScreenshotRunActive(run);
  const abortingCanResume = Boolean(run.abortRequested || run.status === "aborting");
  const retryFailedWouldDiscardResumeContext = Boolean(
    run.manualAbortRequested &&
    run.mode === "clearThenUpload"
  );
  abortButton.hidden = !activeRun || abortingCanResume;
  resumeButton.hidden = !hasResumeLocales || (activeRun && !abortingCanResume);
  retryButton.hidden = activeRun || !hasFailedLocales || retryFailedWouldDiscardResumeContext;
  downloadButton.hidden = Number(run.actionLogCount || 0) <= 0;
  updateParallelLocalizedScreenshotRenderTimer();
}

function updateParallelLocalizedScreenshotRunState(run) {
  if (run && isLocalizedScreenshotWorkerRun(run.runId)) {
    parallelLocalizedScreenshotRunState = null;
    renderParallelLocalizedScreenshotBoard();
    updatePanelMediaUi();
    return;
  }
  parallelLocalizedScreenshotRunState = run || null;
  renderParallelLocalizedScreenshotBoard();
  updatePanelMediaUi();
}

function getStoredPanelPosition() {
  try {
    return JSON.parse(window.localStorage.getItem(PANEL_POSITION_STORAGE_KEY) || "null");
  } catch (_error) {
    return null;
  }
}

function savePanelPosition(position) {
  try {
    window.localStorage.setItem(PANEL_POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch (_error) {
    // The panel can still be dragged for this session if page storage is unavailable.
  }
}

function normalizePanelMode(mode) {
  return ["expanded", "minimized", "hidden"].includes(mode) ? mode : "expanded";
}

function getStoredPanelMode() {
  try {
    return normalizePanelMode(window.localStorage.getItem(PANEL_MODE_STORAGE_KEY));
  } catch (_error) {
    return "expanded";
  }
}

function savePanelMode(mode) {
  try {
    window.localStorage.setItem(PANEL_MODE_STORAGE_KEY, normalizePanelMode(mode));
  } catch (_error) {
    // Panel mode is convenience state; the panel can still be controlled this session.
  }
}

function removePanel() {
  if (parallelLocalizedScreenshotRenderTimerId) {
    window.clearInterval(parallelLocalizedScreenshotRenderTimerId);
    parallelLocalizedScreenshotRenderTimerId = 0;
  }
  if (localizedScreenshotWorkerProgressRenderTimerId) {
    window.clearInterval(localizedScreenshotWorkerProgressRenderTimerId);
    localizedScreenshotWorkerProgressRenderTimerId = 0;
  }

  if (panelMediaStateObserver) {
    panelMediaStateObserver.disconnect();
    panelMediaStateObserver = null;
  }

  if (panelViewportClampController) {
    panelViewportClampController.abort();
    panelViewportClampController = null;
  }

  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.remove();
}

function applyPanelMode(panel, mode) {
  if (!panel) return;

  const normalizedMode = normalizePanelMode(mode);
  panel.dataset.panelMode = normalizedMode;

  const toggleButton = panel.querySelector("[data-storepilot-action='toggle-panel-mode']");
  if (toggleButton) {
    const isMinimized = normalizedMode === "minimized";
    toggleButton.textContent = isMinimized ? "+" : "-";
    toggleButton.title = isMinimized
      ? localize("maximizePanel", "Maximize panel")
      : localize("minimizePanel", "Minimize panel");
    toggleButton.setAttribute("aria-label", toggleButton.title);
  }
}

function setPanelMode(panel, mode) {
  const normalizedMode = normalizePanelMode(mode);
  savePanelMode(normalizedMode);

  if (normalizedMode === "hidden") {
    removePanel();
    return;
  }

  applyPanelMode(panel, normalizedMode);
  clampPanelToViewport(panel, false);
}

function getPanelState() {
  const panel = document.getElementById(PANEL_ID);
  const mode = getStoredPanelMode();
  return {
    mode,
    visible: Boolean(panel) && mode !== "hidden",
    minimized: Boolean(panel) && panel.dataset.panelMode === "minimized"
  };
}

function clampPanelPosition(panel, left, top) {
  const margin = 8;
  const rect = panel.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);

  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop)
  };
}

function setPanelPosition(panel, position) {
  if (!position || !Number.isFinite(position.left) || !Number.isFinite(position.top)) return;

  const nextPosition = clampPanelPosition(panel, position.left, position.top);
  panel.style.left = `${nextPosition.left}px`;
  panel.style.top = `${nextPosition.top}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

function applyStoredPanelPosition(panel) {
  setPanelPosition(panel, getStoredPanelPosition());
}

function clampPanelToViewport(panel, savePosition = true) {
  if (!panel || !panel.isConnected) return;

  const rect = panel.getBoundingClientRect();
  const nextPosition = clampPanelPosition(panel, rect.left, rect.top);
  setPanelPosition(panel, nextPosition);
  if (savePosition) {
    savePanelPosition(nextPosition);
  }
}

function bindPanelViewportClamp(panel) {
  if (panelViewportClampController) {
    panelViewportClampController.abort();
  }

  panelViewportClampController = new AbortController();
  let frameId = 0;

  function scheduleClamp() {
    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      clampPanelToViewport(panel);
    });
  }

  window.addEventListener("resize", scheduleClamp, { signal: panelViewportClampController.signal });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleClamp, { signal: panelViewportClampController.signal });
    window.visualViewport.addEventListener("scroll", scheduleClamp, { signal: panelViewportClampController.signal });
  }
}

function bindDashboardSectionWatcher() {
  if (dashboardSectionWatcherId) return;

  let previousUrl = window.location.href;
  dashboardSectionWatcherId = window.setInterval(() => {
    if (window.location.href === previousUrl) return;
    previousUrl = window.location.href;

    if (!isPanelDashboardSection()) {
      removePanel();
      return;
    }

    loadSettings()
      .then(() => loadListings())
      .then(renderPanel)
      .catch(() => {});
  }, 600);
}

function getDashboardMediaState() {
  const screenshotCount = getVisibleMediaImageCount("screenshots");
  const storeIconPresent = hasExistingOrProcessingMedia("storeIcon");
  const smallPromoPresent = hasExistingOrProcessingMedia("smallPromo");
  const marqueePromoPresent = hasExistingOrProcessingMedia("marqueePromo");
  const localizedScreenshotTargetFound = getMediaUploadWidgets("localizedScreenshots").length > 0 ||
    hasClearableMedia("localizedScreenshots");

  return {
    screenshots: screenshotCount,
    localizedScreenshots: getVisibleMediaImageCount("localizedScreenshots"),
    storeIcon: getVisibleMediaImageCount("storeIcon"),
    smallPromo: getVisibleMediaImageCount("smallPromo"),
    marqueePromo: getVisibleMediaImageCount("marqueePromo"),
    clearableScreenshots: hasClearableMedia("screenshots"),
    clearableStoreIcon: hasClearableMedia("storeIcon"),
    clearableSmallPromo: hasClearableMedia("smallPromo"),
    clearableMarqueePromo: hasClearableMedia("marqueePromo"),
    screenshotsLimitReached: screenshotCount >= MAX_DASHBOARD_SCREENSHOTS,
    maxScreenshots: MAX_DASHBOARD_SCREENSHOTS,
    localizedScreenshotTargetFound,
    currentLocale: typeof getCurrentDashboardLocale === "function" ? getCurrentDashboardLocale() : "",
    storeIconPresent,
    smallPromoPresent,
    marqueePromoPresent,
    running: mediaOperationState.running,
    runningLabel: mediaOperationState.label
  };
}

function getPanelMediaButtons(panel = document.getElementById(PANEL_ID)) {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll([
    "[data-storepilot-action='upload-storeIcon']",
    "[data-storepilot-action='upload-screenshots']",
    "[data-storepilot-action='upload-localizedScreenshots']",
    "[data-storepilot-action='upload-localizedScreenshotsParallel']",
    "[data-storepilot-action='upload-smallPromo']",
    "[data-storepilot-action='upload-marqueePromo']",
    "[data-storepilot-action='clear-screenshots']",
    "[data-storepilot-action='clear-storeIcon']",
    "[data-storepilot-action='clear-smallPromo']",
    "[data-storepilot-action='clear-marqueePromo']"
  ].join(",")));
}

function setPanelMediaButtonsDisabled(disabled, title = "") {
  for (const button of getPanelMediaButtons()) {
    button.disabled = disabled;
    button.title = title;
  }
}

function getPanelWorkflowButtons(panel = document.getElementById(PANEL_ID)) {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll([
    "[data-storepilot-action='fill-current']",
    "[data-storepilot-action='fill-all']",
    "[data-storepilot-action='select-category']",
    "[data-storepilot-action='fill-additional-fields']"
  ].join(",")));
}

function setPanelWorkflowButtonsDisabled(disabled, title = "") {
  for (const button of getPanelWorkflowButtons()) {
    button.disabled = disabled;
    button.title = title;
  }
}

function setPanelParallelScreenshotMode(panel, active) {
  if (!panel) return;
  if (active) {
    panel.dataset.parallelLocalizedScreenshotsActive = "true";
  } else {
    delete panel.dataset.parallelLocalizedScreenshotsActive;
  }
}

function updatePanelMediaUi() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const fillAllRunning = Boolean(isFillingAllLanguages || fillAllStatus.running);
  if (mediaOperationState.running) {
    setPanelParallelScreenshotMode(panel, false);
    setPanelMediaButtonsDisabled(true, mediaOperationState.label);
    setPanelWorkflowButtonsDisabled(true, mediaOperationState.label);
    updatePanelFillAllUi();
    return;
  }

  if (fillAllRunning) {
    setPanelParallelScreenshotMode(panel, false);
    setPanelMediaButtonsDisabled(true, localize("fillingAllLanguages", "Filling descriptions..."));
    setPanelWorkflowButtonsDisabled(true, localize("fillingAllLanguages", "Filling descriptions..."));
    return;
  }

  if (isParallelLocalizedScreenshotRunActive()) {
    setPanelParallelScreenshotMode(panel, true);
    setPanelMediaButtonsDisabled(true, localize("parallelLocalizedScreenshotsRunning", "Parallel localized screenshot upload is running."));
    setPanelWorkflowButtonsDisabled(true, localize("parallelLocalizedScreenshotsRunning", "Parallel localized screenshot upload is running."));
    updatePanelFillAllUi();
    renderParallelLocalizedScreenshotBoard(panel);
    return;
  }

  setPanelParallelScreenshotMode(panel, false);
  for (const button of getPanelMediaButtons(panel)) {
    button.disabled = false;
    button.title = "";
  }
  for (const button of getPanelWorkflowButtons(panel)) {
    button.disabled = false;
    button.title = "";
  }

  for (const kind of ["screenshots", "storeIcon", "smallPromo", "marqueePromo"]) {
    const button = panel.querySelector(`[data-storepilot-action='clear-${kind}']`);
    if (!button) continue;

    const hasMedia = hasClearableMedia(kind);
    button.disabled = !hasMedia;
    button.title = hasMedia
      ? ""
      : localize("mediaAlreadyClearKind", "$1 already clear.", [getMediaUploadKindLabel(kind)]);
  }

  for (const kind of ["storeIcon", "smallPromo", "marqueePromo"]) {
    const button = panel.querySelector(`[data-storepilot-action='upload-${kind}']`);
    if (!button) continue;

    const alreadyPresent = hasExistingOrProcessingMedia(kind);
    button.disabled = alreadyPresent;
    button.title = alreadyPresent
      ? localize("mediaAlreadyPresentOrProcessing", "$1 already present or processing.", [getMediaUploadKindLabel(kind)])
      : "";
  }

  const uploadScreenshotsButton = panel.querySelector("[data-storepilot-action='upload-screenshots']");
  if (uploadScreenshotsButton) {
    const screenshotCount = getVisibleMediaImageCount("screenshots");
    const limitReached = screenshotCount >= MAX_DASHBOARD_SCREENSHOTS;
    uploadScreenshotsButton.disabled = limitReached;
    uploadScreenshotsButton.title = limitReached
      ? localize("screenshotsLimitReached", "screenshots: CWS limit of $1 already reached", [String(MAX_DASHBOARD_SCREENSHOTS)])
      : "";
  }

  const uploadLocalizedScreenshotsButton = panel.querySelector("[data-storepilot-action='upload-localizedScreenshots']");
  if (uploadLocalizedScreenshotsButton) {
    const targetFound = getMediaUploadWidgets("localizedScreenshots").length > 0 ||
      hasClearableMedia("localizedScreenshots");
    uploadLocalizedScreenshotsButton.disabled = !targetFound;
    uploadLocalizedScreenshotsButton.title = targetFound
      ? ""
      : localize("localizedScreenshotTargetNotFound", "Localized screenshots upload target not found on this page.");
  }

  const uploadLocalizedScreenshotsParallelButton = panel.querySelector("[data-storepilot-action='upload-localizedScreenshotsParallel']");
  if (uploadLocalizedScreenshotsParallelButton) {
    uploadLocalizedScreenshotsParallelButton.disabled = false;
    uploadLocalizedScreenshotsParallelButton.title = "";
  }

  renderParallelLocalizedScreenshotBoard(panel);
}

async function runExclusiveMediaOperation(label, operation) {
  if (mediaOperationState.running) {
    return {
      ok: true,
      ignored: true,
      message: localize("mediaOperationAlreadyRunning", "Media operation already running: $1.", [mediaOperationState.label])
    };
  }

  mediaOperationState = {
    running: true,
    label,
    abortRequested: false
  };
  updatePanelMediaUi();
  updatePanelFillAllUi();

  try {
    return await operation();
  } finally {
    mediaOperationState = {
      running: false,
      label: "",
      abortRequested: false
    };
    updatePanelMediaUi();
    updatePanelFillAllUi();
  }
}

function bindPanelMediaState(panel) {
  if (panelMediaStateObserver) {
    panelMediaStateObserver.disconnect();
  }

  let frameId = 0;
  function scheduleUpdate() {
    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      updatePanelMediaUi();
    });
  }

  panelMediaStateObserver = new MutationObserver(scheduleUpdate);
  panelMediaStateObserver.observe(document.body || document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "style", "aria-label", "data-image-key"]
  });

  updatePanelMediaUi();
  window.setTimeout(updatePanelMediaUi, 300);
  window.setTimeout(updatePanelMediaUi, 1200);
}

function enablePanelDrag(panel, dragHandle) {
  if (!panel || !dragHandle) return;

  dragHandle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.target.closest("button, select, input, textarea, a")) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    panel.dataset.dragging = "true";
    panel.setPointerCapture(event.pointerId);
    event.preventDefault();

    function movePanel(moveEvent) {
      const nextPosition = clampPanelPosition(
        panel,
        moveEvent.clientX - offsetX,
        moveEvent.clientY - offsetY
      );
      setPanelPosition(panel, nextPosition);
    }

    function stopDragging() {
      delete panel.dataset.dragging;
      savePanelPosition({
        left: panel.getBoundingClientRect().left,
        top: panel.getBoundingClientRect().top
      });
      panel.removeEventListener("pointermove", movePanel);
      panel.removeEventListener("pointerup", stopDragging);
      panel.removeEventListener("pointercancel", stopDragging);
    }

    panel.addEventListener("pointermove", movePanel);
    panel.addEventListener("pointerup", stopDragging);
    panel.addEventListener("pointercancel", stopDragging);
  });
}
