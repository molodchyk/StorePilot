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
