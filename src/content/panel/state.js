let parallelLocalizedScreenshotRunState = null;
let parallelLocalizedScreenshotRenderTimerId = 0;

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

function getParallelTimelineCurrentSample(run, elapsedMs = getPanelParallelRunElapsedMs(run)) {
  const totals = run && run.totals || {};
  const statuses = Array.isArray(run && run.localeStatuses) ? run.localeStatuses : [];
  const totalLocales = Math.max(Number(totals.totalLocales || 0), statuses.length);
  let completedLocales = Math.min(totalLocales, Number(totals.completedLocales || 0));
  let failedLocales = Math.min(
    Math.max(0, totalLocales - completedLocales),
    Number(totals.failedLocales || 0)
  );
  const statusSkippedLocales = statuses.filter(status => status.status === "skipped").length;
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

function getParallelWorkerTimelineCurrentSample(worker, elapsedMs = getPanelParallelWorkerElapsedMs(worker)) {
  const totalLocales = Math.max(0, Number(worker && worker.assignedCount || 0));
  const completedLocales = Math.min(totalLocales, Number(worker && worker.completedLocales || 0));
  const failedLocales = Math.min(
    Math.max(0, totalLocales - completedLocales),
    Number(worker && worker.failedLocales || 0)
  );
  const skippedLocales = Math.min(
    Math.max(0, totalLocales - completedLocales - failedLocales),
    Number(worker && worker.skippedLocales || 0)
  );

  return {
    elapsedMs,
    completedLocales,
    failedLocales,
    skippedLocales,
    remainingLocales: Math.max(0, totalLocales - completedLocales - failedLocales - skippedLocales),
    uploadedScreenshots: Number(worker && worker.uploadedScreenshots || 0),
    totalLocales
  };
}

function getParallelTimelineSamples(run) {
  if (!run) return [];

  const samples = Array.isArray(run.timeline)
    ? run.timeline.map(sample => ({
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

  if (samples[0].elapsedMs > 0) {
    const totalLocales = Number(run.totals && run.totals.totalLocales || samples[0].totalLocales || 0);
    samples.unshift({
      elapsedMs: 0,
      completedLocales: 0,
      failedLocales: 0,
      skippedLocales: 0,
      remainingLocales: totalLocales,
      uploadedScreenshots: 0,
      totalLocales
    });
  }

  return samples;
}

function getParallelWorkerTimelineSamples(worker) {
  if (!worker) return [];

  const samples = Array.isArray(worker.timeline)
    ? worker.timeline.map(sample => ({
      elapsedMs: Number(sample.elapsedMs || 0),
      completedLocales: Number(sample.completedLocales || 0),
      failedLocales: Number(sample.failedLocales || 0),
      skippedLocales: Number(sample.skippedLocales || 0),
      remainingLocales: Number(sample.remainingLocales || 0),
      uploadedScreenshots: Number(sample.uploadedScreenshots || 0),
      totalLocales: Number(sample.totalLocales || worker.assignedCount || 0)
    })).filter(sample => Number.isFinite(sample.elapsedMs))
    : [];

  const liveSample = getParallelWorkerTimelineCurrentSample(worker);
  const lastSample = samples[samples.length - 1];
  if (!lastSample || liveSample.elapsedMs > lastSample.elapsedMs) {
    samples.push(liveSample);
  }

  if (!samples.length) {
    samples.push(liveSample);
  }

  if (samples[0].elapsedMs > 0) {
    samples.unshift({
      elapsedMs: 0,
      completedLocales: 0,
      failedLocales: 0,
      skippedLocales: 0,
      remainingLocales: Number(worker.assignedCount || samples[0].totalLocales || 0),
      uploadedScreenshots: 0,
      totalLocales: Number(worker.assignedCount || samples[0].totalLocales || 0)
    });
  }

  return samples;
}

function createParallelTimelinePolyline(samples, field, xForSample, yForValue, className) {
  const points = samples
    .map(sample => `${xForSample(sample).toFixed(1)},${yForValue(sample[field] || 0).toFixed(1)}`)
    .join(" ");
  return createParallelSvgElement("polyline", {
    class: className,
    points,
    fill: "none",
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

  svg.append(createParallelTimelinePolyline(samples, "remainingLocales", xForSample, yForValue, "storepilot-parallel-chart-remaining"));
  svg.append(createParallelTimelinePolyline(samples, "completedLocales", xForSample, yForValue, "storepilot-parallel-chart-completed"));
  if (samples.some(sample => sample.failedLocales > 0)) {
    svg.append(createParallelTimelinePolyline(samples, "failedLocales", xForSample, yForValue, "storepilot-parallel-chart-failed"));
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

function renderParallelWorkerTimelineChart(container, worker) {
  if (!container) return;
  container.replaceChildren();

  if (!worker) {
    container.hidden = true;
    return;
  }

  const samples = getParallelWorkerTimelineSamples(worker);
  const width = 260;
  const height = 34;
  const padding = { left: 6, right: 6, top: 5, bottom: 5 };
  const maxElapsed = Math.max(1, ...samples.map(sample => sample.elapsedMs));
  const maxLocales = Math.max(1, Number(worker.assignedCount || 0), ...samples.map(sample => sample.totalLocales || 0));
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const xForSample = sample => padding.left + (Math.max(0, sample.elapsedMs) / maxElapsed) * chartWidth;
  const yForValue = value => padding.top + (1 - (Math.max(0, value) / maxLocales)) * chartHeight;
  const svg = createParallelSvgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": `${worker.workerId || "worker"} localized screenshot progress`
  });

  for (const ratio of [0, 1]) {
    const y = padding.top + ratio * chartHeight;
    svg.append(createParallelSvgElement("line", {
      class: "storepilot-parallel-chart-grid",
      x1: padding.left,
      y1: y,
      x2: width - padding.right,
      y2: y
    }));
  }

  svg.append(createParallelTimelinePolyline(samples, "remainingLocales", xForSample, yForValue, "storepilot-parallel-chart-remaining"));
  svg.append(createParallelTimelinePolyline(samples, "completedLocales", xForSample, yForValue, "storepilot-parallel-chart-completed"));
  if (samples.some(sample => sample.failedLocales > 0)) {
    svg.append(createParallelTimelinePolyline(samples, "failedLocales", xForSample, yForValue, "storepilot-parallel-chart-failed"));
  }

  container.hidden = false;
  container.append(svg);
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
  const retryButton = board.querySelector("[data-storepilot-action='retry-localizedScreenshotsParallel']");
  if (!summary || !workers || !abortButton || !retryButton) return;

  if (!run) {
    board.hidden = true;
    summary.replaceChildren();
    if (chart) chart.replaceChildren();
    if (localeStatuses) localeStatuses.replaceChildren();
    workers.replaceChildren();
    abortButton.hidden = true;
    retryButton.hidden = true;
    updateParallelLocalizedScreenshotRenderTimer();
    return;
  }

  const totals = run.totals || {};
  const elapsed = formatPanelParallelElapsed(getPanelParallelRunElapsedMs(run));
  const failedWorkerCount = (run.workers || []).filter(worker => worker.status === "failed" || (worker.failedLocales || 0) > 0).length;
  const hasFailedLocales = failedWorkerCount > 0 || Number(totals.failedLocales || 0) > 0;
  const clearProgress = isParallelClearProgressRun(run);
  const localeProgressVerb = clearProgress ? "cleared" : "completed";
  const screenshotSummary = clearProgress
    ? `clear-only, ${totals.totalScreenshots || 0} source screenshot(s)`
    : `${totals.uploadedScreenshots || 0}/${totals.totalScreenshots || 0} uploaded`;

  board.hidden = false;
  summary.replaceChildren(
    createParallelBoardLine(localize("parallelLocalizedScreenshotsStatus", "Status"), `${run.status || "unknown"} - elapsed ${elapsed}`),
    createParallelBoardLine(localize("parallelLocalizedScreenshotsMode", "Mode"), `${run.mode || "coordinated"}${run.phase ? ` - ${run.phase}` : ""}`),
    createParallelBoardLine(localize("parallelLocalizedScreenshotsLocales", "Locales"), `${totals.completedLocales || 0}/${totals.totalLocales || 0} ${localeProgressVerb}, ${totals.failedLocales || 0} failed, ${totals.skippedLocales || 0} skipped`),
    createParallelBoardLine(localize("parallelLocalizedScreenshotsScreenshots", "Screenshots"), screenshotSummary)
  );

  renderParallelTimelineChart(chart, run);
  renderParallelLocaleStatuses(localeStatuses, run);

  workers.replaceChildren(...(run.workers || []).map(worker => {
    const row = document.createElement("div");
    const title = document.createElement("div");
    const counts = document.createElement("div");
    const workerChart = document.createElement("div");
    const current = document.createElement("div");
    const elapsedLabel = formatPanelParallelElapsed(getPanelParallelWorkerElapsedMs(worker));
    const workerClearProgress = isParallelClearProgressWorker(worker, run);
    const currentText = worker.currentLocale
      ? `${worker.currentLocale}${worker.phase ? ` - ${worker.phase}` : ""}`
      : (worker.phase || worker.message || "");

    row.className = "storepilot-parallel-worker";
    title.className = "storepilot-parallel-worker-title";
    counts.className = "storepilot-parallel-worker-counts";
    workerChart.className = "storepilot-parallel-worker-chart";
    current.className = "storepilot-parallel-worker-current";
    title.textContent = `${worker.workerId}: ${worker.operation || "replace"} - ${worker.status}${worker.closed ? " (closed)" : ""}`;
    counts.textContent = workerClearProgress
      ? `Locales ${worker.completedLocales || 0}/${worker.assignedCount || 0}; clear-only; elapsed ${elapsedLabel}`
      : `Locales ${worker.completedLocales || 0}/${worker.assignedCount || 0}; screenshots ${worker.uploadedScreenshots || 0}/${worker.totalScreenshots || 0}; elapsed ${elapsedLabel}`;
    current.textContent = currentText || "Waiting for progress.";
    renderParallelWorkerTimelineChart(workerChart, worker);
    row.append(title, counts, workerChart, current);
    return row;
  }));

  abortButton.hidden = !isParallelLocalizedScreenshotRunActive(run);
  retryButton.hidden = isParallelLocalizedScreenshotRunActive(run) || !hasFailedLocales;
  updateParallelLocalizedScreenshotRenderTimer();
}

function updateParallelLocalizedScreenshotRunState(run) {
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

function updatePanelMediaUi() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const fillAllRunning = Boolean(isFillingAllLanguages || fillAllStatus.running);
  if (mediaOperationState.running) {
    setPanelMediaButtonsDisabled(true, mediaOperationState.label);
    updatePanelFillAllUi();
    return;
  }

  if (fillAllRunning) {
    setPanelMediaButtonsDisabled(true, localize("fillingAllLanguages", "Filling descriptions..."));
    return;
  }

  if (isParallelLocalizedScreenshotRunActive()) {
    setPanelMediaButtonsDisabled(true, localize("parallelLocalizedScreenshotsRunning", "Parallel localized screenshot upload is running."));
    renderParallelLocalizedScreenshotBoard(panel);
    return;
  }

  for (const button of getPanelMediaButtons(panel)) {
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
