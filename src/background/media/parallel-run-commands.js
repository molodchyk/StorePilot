async function storePilotStartParallelLocalizedScreenshotUpload(sender, requestAccess = false, options = {}) {
  const requestedParentTabId = Number(options.parentTabId || 0);
  const requestedParentUrl = String(options.parentUrl || "");
  const activeTab = await getActiveDashboardTab(sender);
  const tab = requestedParentTabId && requestedParentUrl
    ? { id: requestedParentTabId, url: requestedParentUrl }
    : activeTab;
  if (!tab || !tab.id) {
    return { ok: false, message: text("noActiveTab", "No active tab.") };
  }
  if (typeof storePilotIsListingDashboardUrl === "function" && !storePilotIsListingDashboardUrl(tab.url || "")) {
    return { ok: false, message: text("listingActionsOnlyOnListingPage", "Listing actions are only available on the Store listing page.") };
  }

  const parallelMode = normalizeParallelLocalizedScreenshotMode(options.parallelMode || options.mode || "");
  const run = {
    runId: createParallelLocalizedScreenshotRunId(),
    status: "starting",
    parentTabId: tab.id,
    parentUrl: tab.url || "",
    startedAt: Date.now(),
    closeSuccessfulWorkers: options.closeSuccessfulWorkers !== false,
    abortRequested: false,
    mode: parallelMode,
    phase: "starting",
    totalLocales: 0,
    totalScreenshots: 0,
    initialSkipped: [],
    initialSkippedLocales: 0,
    message: text("parallelLocalizedScreenshotsStarting", "Starting parallel localized screenshot upload."),
    timeline: [],
    actionLog: [],
    mutationGate: null,
    parallelAuditAfterRun: false,
    requestedOptions: {
      workerCount: getRequestedParallelLocalizedScreenshotWorkerCount(options.workerCount || 2),
      parallelMode,
      localizedScreenshotsStartLocale: options.localizedScreenshotsStartLocale || options.startLocale || "",
      assignedLocales: normalizeAssignedParallelLocales(options.assignedLocales),
      preClearedLocales: normalizeAssignedParallelLocales(options.preClearedLocales),
      closeSuccessfulWorkers: options.closeSuccessfulWorkers !== false
    },
    manualAbortRequested: false,
    resumeLocaleList: [],
    workers: []
  };

  localizedScreenshotParallelRuns.set(run.runId, run);

  continueParallelLocalizedScreenshotUpload(run, requestAccess, options)
    .catch(error => {
      failParallelLocalizedScreenshotRun(run, error.message || String(error));
      sendParallelLocalizedScreenshotRunUpdate(run);
    });

  return {
    ok: true,
    message: text("parallelLocalizedScreenshotsStarting", "Starting parallel localized screenshot upload."),
    run: createParallelLocalizedScreenshotRunSnapshot(run)
  };
}

async function storePilotAbortParallelLocalizedScreenshotUpload(sender, runId = "") {
  const run = getParallelLocalizedScreenshotRunForSender(sender, runId);
  if (!run) {
    return { ok: false, message: text("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.") };
  }

  run.abortRequested = true;
  run.manualAbortRequested = true;
  run.status = "aborting";
  run.message = text("operationStopped", "Stopped.");
  abortParallelLocalizedScreenshotMutationGate(run);
  run.resumeLocaleList = getParallelLocalizedScreenshotResumeLocales(run);
  scheduleParallelLocalizedScreenshotAbortFinalizer(run);

  for (const worker of run.workers || []) {
    if (isParallelWorkerTerminal(worker)) continue;
    worker.status = "aborting";
    worker.message = text("fillAllAbortRequested", "Abort requested. StorePilot stops after the current dashboard step.");
    const resumeSet = new Set(getParallelLocalizedScreenshotWorkerRetryLocales(worker, run));
    worker.failedLocaleList = Array.from(resumeSet);
    worker.failedLocales = worker.failedLocaleList.length;
  }
  for (const locale of run.resumeLocaleList) {
    const normalizedLocale = normalizeParallelLocalizedScreenshotLocale(locale);
    const existingStatus = run.localeStatuses && run.localeStatuses[normalizedLocale];
    const keepCleared = run.mode === PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD &&
      existingStatus &&
      isClearOnlyStatusThatNeedsUpload(existingStatus);
    updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
      status: keepCleared ? "cleared" : "aborted",
      operation: keepCleared ? "clearOnly" : "",
      workerId: keepCleared ? existingStatus.workerId || "" : "",
      phase: run.phase || "",
      message: keepCleared
        ? "localized screenshots cleared; upload still needed"
        : text("fillAllAbortRequested", "Abort requested. StorePilot stops after the current dashboard step.")
    });
  }

  await Promise.all(run.workers
    .filter(worker => !isParallelWorkerTerminal(worker) && worker.tabId)
    .map(worker => storePilotTabsSendMessage(worker.tabId, {
      type: "storepilot-abort-operation"
    }).catch(() => null)));
  await sendParallelLocalizedScreenshotRunUpdate(run);

  return {
    ok: true,
    message: text("fillAllAbortRequested", "Abort requested. StorePilot stops after the current dashboard step."),
    run: createParallelLocalizedScreenshotRunSnapshot(run)
  };
}

async function storePilotResumeParallelLocalizedScreenshotUpload(sender, runId = "", options = {}) {
  const run = getParallelLocalizedScreenshotRunForSender(sender, runId);
  if (!run) {
    return { ok: false, message: text("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.") };
  }
  if (isParallelLocalizedScreenshotRunActiveStatus(run)) {
    if (run.abortRequested || run.status === "aborting") {
      await forceStopParallelLocalizedScreenshotRunForResume(run);
    } else {
      return {
        ok: false,
        message: text("parallelLocalizedScreenshotsRunning", "Parallel localized screenshot upload is running."),
        run: createParallelLocalizedScreenshotRunSnapshot(run)
      };
    }
  }

  const requestedOptions = run.requestedOptions || {};
  const resumeLocales = normalizeAssignedParallelLocales(
    options.assignedLocales && options.assignedLocales.length
      ? options.assignedLocales
      : run.resumeLocaleList && run.resumeLocaleList.length
        ? run.resumeLocaleList
        : getParallelLocalizedScreenshotResumeLocales(run)
  );
  if (!resumeLocales.length) {
    return {
      ok: false,
      message: text("parallelLocalizedScreenshotsNoResumeLocales", "No unfinished localized screenshot locales to resume."),
      run: createParallelLocalizedScreenshotRunSnapshot(run)
    };
  }
  const resumeSet = new Set(resumeLocales);
  const preClearedLocales = getParallelLocalizedScreenshotClearedNeedsUploadLocales(run)
    .filter(locale => resumeSet.has(locale));

  await closeParallelLocalizedScreenshotTerminalWorkerTabs(run);

  return storePilotStartParallelLocalizedScreenshotUpload(sender, false, {
    parentTabId: run.parentTabId,
    parentUrl: run.parentUrl,
    workerCount: Math.min(
      getRequestedParallelLocalizedScreenshotWorkerCount(options.workerCount || requestedOptions.workerCount || (run.workers || []).length || 1),
      resumeLocales.length
    ),
    assignedLocales: resumeLocales,
    preClearedLocales,
    contextLocales: run.localeStatusOrder || [],
    contextLocaleStatuses: run.localeStatuses || {},
    parallelMode: options.parallelMode || requestedOptions.parallelMode || run.mode || PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD,
    closeSuccessfulWorkers: requestedOptions.closeSuccessfulWorkers !== false && run.closeSuccessfulWorkers !== false
  });
}

async function storePilotRetryParallelLocalizedScreenshotFailed(sender, runId = "", options = {}) {
  const run = getParallelLocalizedScreenshotRunForSender(sender, runId);
  const fallbackLocales = normalizeAssignedParallelLocales(options.assignedLocales);
  if (run && run.manualAbortRequested && run.mode === PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD) {
    return {
      ok: false,
      message: text("parallelLocalizedScreenshotsUseResumeAfterAbort", "Use Resume run after an aborted coordinated localized screenshot run."),
      run: createParallelLocalizedScreenshotRunSnapshot(run)
    };
  }
  const runFailedLocales = run
    ? getParallelLocalizedScreenshotFailedLocales(run)
    : fallbackLocales;
  const failedLocales = runFailedLocales.length ? runFailedLocales : fallbackLocales;
  if (!failedLocales.length) {
    return {
      ok: false,
      message: text("parallelLocalizedScreenshotsNoFailedLocales", "No failed localized screenshot locales to retry."),
      run: run ? createParallelLocalizedScreenshotRunSnapshot(run) : null
    };
  }
  const failedSet = new Set(failedLocales);
  const preClearedLocales = run
    ? getParallelLocalizedScreenshotClearedNeedsUploadLocales(run).filter(locale => failedSet.has(locale))
    : [];

  if (run) {
    await closeParallelLocalizedScreenshotTerminalWorkerTabs(run);
  }

  return storePilotStartParallelLocalizedScreenshotUpload(sender, false, {
    parentTabId: run ? run.parentTabId : options.parentTabId,
    parentUrl: run ? run.parentUrl : options.parentUrl,
    workerCount: Math.min(
      getRequestedParallelLocalizedScreenshotWorkerCount(options.workerCount || (run && run.workers && run.workers.length) || 1),
      failedLocales.length
    ),
    assignedLocales: failedLocales,
    preClearedLocales,
    contextLocales: run ? run.localeStatusOrder || [] : [],
    contextLocaleStatuses: run ? run.localeStatuses || {} : {},
    parallelMode: options.parallelMode || options.mode || (run && run.mode) || PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD,
    closeSuccessfulWorkers: run ? run.closeSuccessfulWorkers : options.closeSuccessfulWorkers !== false
  });
}

async function storePilotRetryParallelLocalizedScreenshotWorkerTab(sender, runId = "", workerId = "", options = {}) {
  const senderTabId = sender && sender.tab && sender.tab.id;
  const forceFreshTab = Boolean(options && (options.freshTab || options.forceFreshTab || options.fromMaster));
  const run = runId && localizedScreenshotParallelRuns.has(runId)
    ? localizedScreenshotParallelRuns.get(runId)
    : Array.from(localizedScreenshotParallelRuns.values())
      .reverse()
      .find(candidate => (candidate.workers || []).some(worker => senderTabId && worker.tabId === senderTabId));

  if (!run) {
    return { ok: false, message: text("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.") };
  }

  const worker = (run.workers || []).find(candidate => (
    candidate.workerId === workerId ||
    (senderTabId && candidate.tabId === senderTabId)
  ));
  if (!worker) {
    return { ok: false, message: text("parallelLocalizedScreenshotsNoWorker", "No parallel localized screenshot worker found.") };
  }
  if (run.status === "aborting" || (run.abortRequested && isParallelLocalizedScreenshotRunActiveStatus(run))) {
    return {
      ok: false,
      aborted: true,
      message: text("operationStopped", "Stopped."),
      run: createParallelLocalizedScreenshotRunSnapshot(run)
    };
  }
  if (["opening", "running", "aborting"].includes(worker.status)) {
    return { ok: false, message: "Localized screenshot worker is already running." };
  }

  const retryOperation = getParallelLocalizedScreenshotWorkerRetryOperation(run, worker);
  const retryLocales = getParallelLocalizedScreenshotWorkerRetryLocales(worker, run, retryOperation);
  if (!retryLocales.length) {
    return {
      ok: false,
      message: text("parallelLocalizedScreenshotsNoFailedLocales", "No failed localized screenshot locales to retry."),
      run: createParallelLocalizedScreenshotRunSnapshot(run)
    };
  }

  const resolved = await resolveMediaFilesForActiveProject(false, "localizedScreenshots", run.parentUrl || "");
  if (!resolved.ok) {
    return {
      ok: false,
      message: resolved.message,
      run: createParallelLocalizedScreenshotRunSnapshot(run)
    };
  }

  if (forceFreshTab || worker.closed || !worker.tabId) {
    if (forceFreshTab && worker.tabId && !worker.closed) {
      await storePilotTabsRemove(worker.tabId).catch(() => null);
      worker.closed = true;
    }
    const workerTab = await storePilotTabsCreate({ url: run.parentUrl, active: false });
    worker.tabId = workerTab && workerTab.id;
  }

  worker.status = "opening";
  worker.closed = false;
  worker.operation = retryOperation;
  worker.assignedLocales = retryLocales;
  worker.totalScreenshots = countParallelLocalizedScreenshotFiles(resolved.files, retryLocales);
  worker.progress = null;
  worker.currentLocale = "";
  worker.phase = "retrying unfinished locales";
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
  worker.message = forceFreshTab
    ? "Retrying unfinished localized screenshot locales in a fresh worker tab."
    : "Retrying unfinished localized screenshot locales in this tab.";

  run.status = "running";
  run.abortRequested = false;
  run.fatalError = false;
  run.finishedAt = 0;
  run.phase = "retrying";
  run.message = worker.message;
  for (const locale of retryLocales) {
    updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
      status: retryOperation === "clearOnly" ? "pendingClear" : retryOperation === "uploadOnly" ? "pendingUpload" : "pending",
      operation: retryOperation,
      workerId: worker.workerId,
      phase: run.phase,
      message: "retrying in visible worker tab"
    });
  }

  await sendParallelLocalizedScreenshotRunUpdate(run);
  runParallelLocalizedScreenshotWorker(run, worker, resolved.files, resolved.projectName)
    .catch(error => handleParallelLocalizedScreenshotWorkerError(run, worker, error));

  return {
    ok: true,
    message: worker.message,
    run: createParallelLocalizedScreenshotRunSnapshot(run)
  };
}
