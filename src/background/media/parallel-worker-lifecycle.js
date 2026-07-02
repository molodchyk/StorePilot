function sendParallelLocalizedScreenshotRunUpdate(run) {
  if (!run || !run.parentTabId) return Promise.resolve(null);

  const updatePromise = storePilotTabsSendMessage(run.parentTabId, {
    type: "storepilot-parallel-localized-screenshot-run-update",
    run: createParallelLocalizedScreenshotRunSnapshot(run)
  }).catch(() => null);
  const timeoutPromise = delay(PARALLEL_LOCALIZED_SCREENSHOT_PARENT_UPDATE_TIMEOUT_MS)
    .then(() => null);
  return Promise.race([updatePromise, timeoutPromise]);
}

function isParallelLocalizedScreenshotRunActiveStatus(run) {
  return Boolean(run && ["starting", "running", "aborting"].includes(run.status));
}

function finalizeParallelLocalizedScreenshotRunIfDone(run) {
  if (!run || !run.workers.length || !run.workers.every(isParallelWorkerTerminal)) return;

  if (run.abortFinalizerTimer) {
    if (typeof clearTimeout === "function") {
      clearTimeout(run.abortFinalizerTimer);
    }
    run.abortFinalizerTimer = 0;
  }
  if (run.fatalError) {
    run.status = "failed";
    run.message = run.message || text("parallelLocalizedScreenshotsFinishedWithFailures", "Parallel localized screenshot upload finished with failures.");
  } else if (run.abortRequested || run.workers.some(worker => worker.status === "aborted")) {
    run.status = "aborted";
    run.message = text("parallelLocalizedScreenshotsAborted", "Parallel localized screenshot upload stopped.");
  } else if (run.workers.some(worker => worker.status === "failed")) {
    run.status = "failed";
    run.message = text("parallelLocalizedScreenshotsFinishedWithFailures", "Parallel localized screenshot upload finished with failures.");
  } else {
    run.status = "completed";
    run.message = text("parallelLocalizedScreenshotsFinished", "Parallel localized screenshot upload finished.");
  }
  run.finishedAt = Date.now();
  persistParallelLocalizedScreenshotLog(run);
}

function failParallelLocalizedScreenshotRun(run, message, status = "failed") {
  if (!run) return;
  run.status = status;
  run.message = message || text("parallelLocalizedScreenshotsFinishedWithFailures", "Parallel localized screenshot upload finished with failures.");
  run.finishedAt = Date.now();
  persistParallelLocalizedScreenshotLog(run);
}

async function sendMessageToWorkerTabWithRetries(worker, message) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < PARALLEL_LOCALIZED_SCREENSHOT_WORKER_READY_TIMEOUT_MS) {
    try {
      return await storePilotTabsSendMessage(worker.tabId, message);
    } catch (error) {
      lastError = error;
      await delay(PARALLEL_LOCALIZED_SCREENSHOT_WORKER_READY_POLL_MS);
    }
  }

  throw lastError || new Error("Worker tab did not become ready.");
}

function getParallelLocalizedScreenshotFailedLocales(run) {
  const failedLocales = [];
  for (const worker of run && run.workers || []) {
    if ((worker.failedLocaleList || []).length) {
      failedLocales.push(...worker.failedLocaleList);
      continue;
    }

    if (worker.status === "failed" || worker.status === "aborted") {
      failedLocales.push(...getParallelLocalizedScreenshotWorkerRetryLocales(worker, run));
    }
  }
  return Array.from(new Set(failedLocales.filter(Boolean)));
}

function getParallelLocalizedScreenshotResumeLocales(run) {
  const resumeLocales = [];
  const skippedLocales = new Set();
  const completedLocales = new Set();

  for (const status of run && run.localeStatuses ? Object.values(run.localeStatuses) : []) {
    const locale = normalizeParallelLocalizedScreenshotLocale(status && status.locale || "");
    if (!locale) continue;
    if (status.status === "skipped") {
      skippedLocales.add(locale);
    } else if (status.status === "completed") {
      completedLocales.add(locale);
    } else {
      resumeLocales.push(locale);
    }
  }

  for (const worker of run && run.workers || []) {
    const workerCompleted = new Set((worker.completedLocaleList || []).map(normalizeParallelLocalizedScreenshotLocale));
    const workerSkipped = new Set((worker.skippedLocaleList || []).map(normalizeParallelLocalizedScreenshotLocale));
    const completedNeedsUpload = isCoordinatedClearWorker(run, worker);
    for (const localeValue of worker.assignedLocales || []) {
      const locale = normalizeParallelLocalizedScreenshotLocale(localeValue);
      if (!locale || skippedLocales.has(locale) || workerSkipped.has(locale)) continue;
      if (completedLocales.has(locale) || (!completedNeedsUpload && workerCompleted.has(locale))) continue;
      resumeLocales.push(locale);
    }
  }

  return Array.from(new Set(resumeLocales.filter(Boolean)));
}

function getParallelLocalizedScreenshotWorkerRetryLocales(worker, run = null, retryOperation = "") {
  if (!worker) return [];
  const completedSet = new Set((worker.completedLocaleList || []).map(normalizeParallelLocalizedScreenshotLocale));
  const skippedSet = new Set((worker.skippedLocaleList || []).map(normalizeParallelLocalizedScreenshotLocale));
  const failedLocales = new Set((worker.failedLocaleList || []).map(normalizeParallelLocalizedScreenshotLocale));
  const completedNeedsUpload = isCoordinatedClearWorker(run, worker) && retryOperation !== "clearOnly";
  for (const localeValue of worker.assignedLocales || []) {
    const locale = normalizeParallelLocalizedScreenshotLocale(localeValue);
    if (!locale) continue;
    if ((completedNeedsUpload || !completedSet.has(locale)) && !skippedSet.has(locale)) {
      failedLocales.add(locale);
    }
  }
  return Array.from(failedLocales).filter(Boolean);
}

async function closeTerminalParallelLocalizedScreenshotWorker(run, worker) {
  const shouldCloseSuccessful = run.closeSuccessfulWorkers && worker.status === "completed";
  const shouldCloseAfterAbort = run.abortRequested && ["completed", "aborted"].includes(worker.status);
  if (!shouldCloseSuccessful && !shouldCloseAfterAbort) return;
  if (worker.closed || !worker.tabId) return;

  try {
    await storePilotTabsRemove(worker.tabId);
    worker.closed = true;
  } catch (error) {
    worker.closeError = error.message || String(error);
  }
}

async function closeParallelLocalizedScreenshotTerminalWorkerTabs(run) {
  if (!run) return;

  await Promise.all((run.workers || []).map(async worker => {
    if (!isParallelWorkerTerminal(worker) || worker.closed || !worker.tabId) return;
    try {
      await storePilotTabsRemove(worker.tabId);
      worker.closed = true;
    } catch (error) {
      worker.closeError = error.message || String(error);
    }
  }));
}

async function closeParallelLocalizedScreenshotWorkerTabsForAbort(run) {
  if (!run) return;

  await Promise.all((run.workers || []).map(async worker => {
    if (!worker || worker.closed || !worker.tabId || worker.tabId === run.parentTabId) return;
    try {
      await storePilotTabsRemove(worker.tabId);
      worker.closed = true;
    } catch (error) {
      worker.closeError = error.message || String(error);
    }
  }));
}

function markParallelLocalizedScreenshotWorkerAbortedForResume(run, worker, message = "") {
  if (!run || !worker || isParallelWorkerTerminal(worker)) return;

  const now = Date.now();
  worker.status = "aborted";
  worker.elapsedMs = worker.startedAt ? now - worker.startedAt : Number(worker.elapsedMs || 0);
  worker.finishedAt = worker.startedAt ? worker.startedAt + worker.elapsedMs : now;
  worker.message = message || text("parallelLocalizedScreenshotsAbortTimeout", "Abort completed after waiting for worker tabs.");
  worker.mutationGateWaiting = false;
  worker.currentMutationLease = null;

  const resumeSet = new Set([
    ...(worker.failedLocaleList || []),
    ...getParallelLocalizedScreenshotWorkerRetryLocales(worker, run)
  ].filter(Boolean));
  worker.failedLocaleList = Array.from(resumeSet);
  worker.failedLocales = worker.failedLocaleList.length;

  for (const locale of worker.failedLocaleList) {
    const normalizedLocale = normalizeParallelLocalizedScreenshotLocale(locale);
    const existingStatus = run.localeStatuses && run.localeStatuses[normalizedLocale];
    const keepCleared = run.mode === PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD &&
      existingStatus &&
      isClearOnlyStatusThatNeedsUpload(existingStatus);
    updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
      status: keepCleared ? getParallelLocalizedScreenshotClearNeedsUploadStatusName(existingStatus) : "aborted",
      operation: keepCleared ? "clearOnly" : worker.operation || "",
      workerId: worker.workerId,
      phase: run.phase || "",
      message: keepCleared
        ? "localized screenshots cleared; upload still needed"
        : worker.message
    });
  }
}

function scheduleParallelLocalizedScreenshotAbortFinalizer(run) {
  if (!run || run.abortFinalizerTimer) return;

  run.abortFinalizerTimer = setBackgroundTimer(() => {
    Promise.resolve()
      .then(async () => {
        run.abortFinalizerTimer = 0;
        if (!run.abortRequested || !isParallelLocalizedScreenshotRunActiveStatus(run)) return;

        for (const worker of run.workers || []) {
          if (isParallelWorkerTerminal(worker)) continue;

          markParallelLocalizedScreenshotWorkerAbortedForResume(run, worker);
          await closeTerminalParallelLocalizedScreenshotWorker(run, worker);
        }

        run.resumeLocaleList = getParallelLocalizedScreenshotResumeLocales(run);
        finalizeParallelLocalizedScreenshotRunIfDone(run);
        await sendParallelLocalizedScreenshotRunUpdate(run);
        await persistParallelLocalizedScreenshotLog(run);
      })
      .catch(error => {
        run.abortFinalizerTimer = 0;
        failParallelLocalizedScreenshotRun(run, error.message || String(error), "failed");
        sendParallelLocalizedScreenshotRunUpdate(run);
      });
  }, PARALLEL_LOCALIZED_SCREENSHOT_ABORT_GRACE_MS);
}

async function forceStopParallelLocalizedScreenshotRunForResume(run) {
  if (!run) return;

  run.abortRequested = true;
  run.manualAbortRequested = true;
  run.status = "aborting";
  run.message = text("operationStopped", "Stopped.");
  if (run.abortFinalizerTimer && typeof clearTimeout === "function") {
    clearTimeout(run.abortFinalizerTimer);
  }
  run.abortFinalizerTimer = 0;
  abortParallelLocalizedScreenshotMutationGate(run);

  for (const worker of run.workers || []) {
    if (isParallelWorkerTerminal(worker)) continue;
    markParallelLocalizedScreenshotWorkerAbortedForResume(
      run,
      worker,
      text("parallelLocalizedScreenshotsResumeClosedWorker", "Worker stopped so unfinished locales can be resumed in a fresh tab.")
    );
    await closeTerminalParallelLocalizedScreenshotWorker(run, worker);
  }

  await closeParallelLocalizedScreenshotWorkerTabsForAbort(run);
  run.resumeLocaleList = getParallelLocalizedScreenshotResumeLocales(run);
  finalizeParallelLocalizedScreenshotRunIfDone(run);
  if (run.status === "aborting") {
    run.status = "aborted";
    run.finishedAt = Date.now();
    run.message = text("parallelLocalizedScreenshotsAborted", "Parallel localized screenshot upload stopped.");
  }
  await sendParallelLocalizedScreenshotRunUpdate(run);
  await persistParallelLocalizedScreenshotLog(run);
}

function shouldRestartParallelLocalizedScreenshotWorker(run, worker, result) {
  if (!run || !worker || run.abortRequested) return false;
  if (!result || !result.hiddenTimeout) return false;
  const restartCount = Number(worker.staleRestartCount || 0);
  return restartCount < PARALLEL_LOCALIZED_SCREENSHOT_STALE_WORKER_RESTART_LIMIT;
}

async function restartParallelLocalizedScreenshotWorkerInFreshTab(run, worker, files, projectName, result) {
  const retryOperation = getParallelLocalizedScreenshotWorkerRetryOperation(run, worker);
  const retryLocales = getParallelLocalizedScreenshotWorkerRetryLocales(worker, run, retryOperation);
  if (!retryLocales.length) return false;
  const carriedCompletedLocaleList = getParallelLocalizedScreenshotCarriedCompletedLocaleList(worker, retryLocales);

  const restartCount = Number(worker.staleRestartCount || 0) + 1;
  const previousTabId = worker.tabId;
  if (previousTabId && !worker.closed) {
    await storePilotTabsRemove(previousTabId).catch(() => null);
  }

  const workerTab = await storePilotTabsCreate({ url: run.parentUrl, active: false });
  worker.tabId = workerTab && workerTab.id;
  worker.closed = false;
  worker.status = "opening";
  worker.operation = retryOperation;
  worker.assignedLocales = retryLocales;
  worker.totalScreenshots = countParallelLocalizedScreenshotFiles(files, retryLocales);
  worker.carriedCompletedLocaleList = carriedCompletedLocaleList;
  worker.carriedCompletedLocales = carriedCompletedLocaleList.length;
  worker.progress = null;
  worker.currentLocale = "";
  worker.phase = "recovering stale worker in a fresh tab";
  worker.completedLocaleList = [];
  worker.failedLocaleList = [];
  worker.skippedLocaleList = [];
  worker.auditedLocaleList = [];
  worker.completedLocales = 0;
  worker.failedLocales = 0;
  worker.skippedLocales = 0;
  worker.auditedLocales = 0;
  worker.uploadedScreenshots = 0;
  worker.startedAt = 0;
  worker.finishedAt = 0;
  worker.elapsedMs = 0;
  worker.currentMutationLease = null;
  worker.mutationGateWaiting = false;
  worker.mutationGateRequest = null;
  worker.staleRestartCount = restartCount;
  worker.message = [
    "Dashboard tab became stale after being hidden/minimized.",
    `Restarting unfinished locales in a fresh worker tab (${restartCount}/${PARALLEL_LOCALIZED_SCREENSHOT_STALE_WORKER_RESTART_LIMIT}).`,
    result && result.message ? result.message : ""
  ].filter(Boolean).join(" ");

  for (const locale of retryLocales) {
    updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
      status: retryOperation === "clearOnly" ? "pendingClear" : retryOperation === "uploadOnly" ? "pendingUpload" : "pending",
      operation: retryOperation,
      workerId: worker.workerId,
      phase: "staleWorkerRestart",
      message: "retrying unfinished localized screenshots in a fresh worker tab"
    });
  }

  run.status = "running";
  run.abortRequested = false;
  run.fatalError = false;
  run.finishedAt = 0;
  run.message = worker.message;
  await sendParallelLocalizedScreenshotRunUpdate(run);
  await runParallelLocalizedScreenshotWorker(run, worker, files, projectName);
  return true;
}

async function runParallelLocalizedScreenshotWorker(run, worker, files, projectName) {
  worker.status = "running";
  worker.startedAt = Date.now();
  await sendParallelLocalizedScreenshotRunUpdate(run);

  if (run.abortRequested) {
    worker.status = "aborted";
    worker.elapsedMs = Date.now() - worker.startedAt;
    worker.finishedAt = worker.startedAt + worker.elapsedMs;
    worker.message = text("operationStopped", "Stopped.");
    finalizeParallelLocalizedScreenshotRunIfDone(run);
    await sendParallelLocalizedScreenshotRunUpdate(run);
    return;
  }

  try {
    const filteredFiles = filterLocalizedScreenshotFilesForAssignedLocales(files, worker.assignedLocales);
    const result = await sendMessageToWorkerTabWithRetries(worker, {
      type: "storepilot-upload-media-assets",
      files: filteredFiles,
      kind: "localizedScreenshots",
      projectName,
      options: {
        assignedLocales: worker.assignedLocales,
        localizedScreenshotsOperation: worker.operation || getParallelLocalizedScreenshotOperationForMode(run.mode),
        parallelRunId: run.runId,
        parallelWorkerId: worker.workerId,
        parallelMutationGateEnabled: isParallelLocalizedScreenshotMutationGateEnabled(run),
        parallelAuditAfterRun: Boolean(run.parallelAuditAfterRun)
      }
    });

    const completedLocaleList = uniqueLocales(result && (result.completed || result.uploaded) || []);
    let failedLocaleList = uniqueLocales(result && result.failed || []);
    const skippedLocaleList = uniqueLocales(result && result.skipped || []);
    const auditedLocaleList = uniqueLocales(result && result.audited || []);
    const uploadedScreenshots = (result && result.uploaded || [])
      .reduce((sum, item) => sum + parseLocalizedUploadedScreenshotCount(item), 0);

    worker.result = result || null;
    worker.completedLocaleList = completedLocaleList;
    worker.failedLocaleList = failedLocaleList;
    worker.skippedLocaleList = skippedLocaleList;
    worker.auditedLocaleList = auditedLocaleList;
    worker.completedLocales = completedLocaleList.length;
    worker.failedLocales = failedLocaleList.length;
    worker.skippedLocales = skippedLocaleList.length;
    worker.auditedLocales = auditedLocaleList.length;
    worker.uploadedScreenshots = uploadedScreenshots || Number(worker.progress && worker.progress.uploadedScreenshots || 0);
    worker.elapsedMs = Number(result && result.elapsedMs || Date.now() - worker.startedAt);
    worker.message = result && result.message || "";

    if (result && result.aborted) {
      worker.status = "aborted";
    } else if (result && result.ok && !failedLocaleList.length) {
      worker.status = "completed";
    } else {
      worker.status = "failed";
    }

    if (worker.status === "failed" || worker.status === "aborted") {
      const completedSet = new Set(worker.completedLocaleList);
      const skippedSet = new Set(worker.skippedLocaleList);
      const unfinishedLocales = worker.assignedLocales
        .filter(locale => !completedSet.has(locale) && !skippedSet.has(locale));
      failedLocaleList = uniqueLocales([...failedLocaleList, ...unfinishedLocales]);
      worker.failedLocaleList = failedLocaleList;
      worker.failedLocales = worker.failedLocaleList.length;
    }

    const auditedSet = new Set(worker.auditedLocaleList || []);

    if (shouldRestartParallelLocalizedScreenshotWorker(run, worker, result)) {
      for (const locale of worker.completedLocaleList) {
        const completedStatus = getParallelLocalizedScreenshotCompletedLocaleStatus(run, worker, auditedSet.has(locale));
        updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
          status: completedStatus,
          operation: worker.operation || "",
          workerId: worker.workerId,
          phase: run.phase || "",
          message: auditedSet.has(locale)
            ? "localized screenshots audited"
            : worker.operation === "clearOnly" ? "localized screenshots cleared" : "localized screenshots uploaded"
        });
      }
      for (const locale of worker.skippedLocaleList) {
        updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
          status: "skipped",
          operation: worker.operation || "",
          workerId: worker.workerId,
          phase: run.phase || "",
          message: worker.message || "skipped"
        });
      }
      const restarted = await restartParallelLocalizedScreenshotWorkerInFreshTab(run, worker, files, projectName, result);
      if (restarted) return;
    }

    for (const locale of worker.completedLocaleList) {
      const completedStatus = getParallelLocalizedScreenshotCompletedLocaleStatus(run, worker, auditedSet.has(locale));
      updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
        status: completedStatus,
        operation: worker.operation || "",
        workerId: worker.workerId,
        phase: run.phase || "",
        message: auditedSet.has(locale)
          ? "localized screenshots audited"
          : worker.operation === "clearOnly" ? "localized screenshots cleared" : "localized screenshots uploaded"
      });
    }
    for (const locale of worker.skippedLocaleList) {
      updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
        status: "skipped",
        operation: worker.operation || "",
        workerId: worker.workerId,
        phase: run.phase || "",
        message: worker.message || "skipped"
      });
    }
    for (const locale of worker.failedLocaleList) {
      updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
        status: worker.status === "aborted" ? "aborted" : "failed",
        operation: worker.operation || "",
        workerId: worker.workerId,
        phase: run.phase || "",
        message: worker.message || "failed"
      });
    }

    worker.finishedAt = worker.startedAt + worker.elapsedMs;
    await closeTerminalParallelLocalizedScreenshotWorker(run, worker);
  } catch (error) {
    worker.status = run.abortRequested ? "aborted" : "failed";
    worker.elapsedMs = Date.now() - worker.startedAt;
    worker.finishedAt = worker.startedAt + worker.elapsedMs;
    worker.message = error.message || String(error);
    worker.failedLocaleList = worker.assignedLocales.slice();
    worker.failedLocales = worker.failedLocaleList.length;
    for (const locale of worker.failedLocaleList) {
      updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
        status: worker.status === "aborted" ? "aborted" : "failed",
        operation: worker.operation || "",
        workerId: worker.workerId,
        phase: run.phase || "",
        message: worker.message || "failed"
      });
    }
  }

  await closeTerminalParallelLocalizedScreenshotWorker(run, worker);
  if (!run.deferFinalize) {
    finalizeParallelLocalizedScreenshotRunIfDone(run);
  }
  await sendParallelLocalizedScreenshotRunUpdate(run);
}

function getParallelLocalizedScreenshotRunForSender(sender, runId = "") {
  if (runId && localizedScreenshotParallelRuns.has(runId)) {
    return localizedScreenshotParallelRuns.get(runId);
  }

  const parentTabId = sender && sender.tab && sender.tab.id;
  return Array.from(localizedScreenshotParallelRuns.values())
    .reverse()
    .find(run => run.parentTabId === parentTabId) || null;
}

function handleParallelLocalizedScreenshotWorkerError(run, worker, error) {
  worker.status = run.abortRequested ? "aborted" : "failed";
  worker.message = error.message || String(error);
  worker.elapsedMs = worker.startedAt ? Date.now() - worker.startedAt : 0;
  worker.finishedAt = worker.startedAt ? worker.startedAt + worker.elapsedMs : Date.now();
  worker.failedLocaleList = worker.assignedLocales.slice();
  worker.failedLocales = worker.failedLocaleList.length;
  for (const locale of worker.failedLocaleList) {
    updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
      status: worker.status === "aborted" ? "aborted" : "failed",
      operation: worker.operation || "",
      workerId: worker.workerId,
      phase: run.phase || "",
      message: worker.message || "failed"
    });
  }
  if (!run.deferFinalize) {
    finalizeParallelLocalizedScreenshotRunIfDone(run);
  }
  sendParallelLocalizedScreenshotRunUpdate(run);
}
