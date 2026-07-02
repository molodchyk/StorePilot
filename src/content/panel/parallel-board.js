function getParallelLocaleStatusLabel(status) {
  const labels = {
    pending: "pending",
    pendingClear: "pending clear",
    pendingUpload: "pending upload",
    clearing: "clearing",
    cleared: "cleared",
    auditing: "auditing",
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
