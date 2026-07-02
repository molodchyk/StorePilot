async function preopenParallelLocalizedScreenshotWorkers(run, workerCount = 2) {
  if (!run || run.workers.length) return;

  const count = getRequestedParallelLocalizedScreenshotWorkerCount(workerCount);
  run.phase = "openingWorkers";
  run.message = text("parallelLocalizedScreenshotsOpeningWorkers", "Opening localized screenshot worker tabs.");
  for (let index = 0; index < count; index++) {
    const workerTab = await storePilotTabsCreate({ url: run.parentUrl, active: false });
    run.workers.push({
      workerId: `worker-${index + 1}`,
      tabId: workerTab && workerTab.id,
      status: "preparing",
      closed: false,
      operation: "",
      assignedLocales: [],
      totalScreenshots: 0,
      progress: null,
      message: text("parallelLocalizedScreenshotsResolvingFiles", "Resolving localized screenshot files.")
    });
  }
  await sendParallelLocalizedScreenshotRunUpdate(run);
}

async function openParallelLocalizedScreenshotWorkers(run, chunks, files, operation, phase) {
  run.phase = phase;
  const preopenedWorkers = run.workers.filter(worker => (
    worker.status === "preparing" &&
    !worker.assignedLocales.length &&
    worker.tabId
  ));
  const extraPreopenedWorkers = preopenedWorkers.slice(chunks.length);
  for (const worker of extraPreopenedWorkers) {
    storePilotTabsRemove(worker.tabId).catch(() => null);
    worker.closed = true;
  }
  run.workers = [];

  for (let index = 0; index < chunks.length; index++) {
    const assignedLocales = chunks[index];
    const pendingStatus = operation === "clearOnly"
      ? "pendingClear"
      : operation === "uploadOnly"
        ? "pendingUpload"
        : "pending";
    for (const locale of assignedLocales) {
      updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
        status: pendingStatus,
        operation,
        workerId: `worker-${index + 1}`,
        phase,
        message: ""
      });
    }
    const preopenedWorker = preopenedWorkers[index] || null;
    const workerTab = preopenedWorker
      ? { id: preopenedWorker.tabId }
      : await storePilotTabsCreate({ url: run.parentUrl, active: false });
    run.workers.push({
      workerId: `worker-${index + 1}`,
      tabId: workerTab && workerTab.id,
      status: "opening",
      closed: false,
      operation,
      assignedLocales,
      totalScreenshots: countParallelLocalizedScreenshotFiles(files, assignedLocales),
      progress: null,
      message: ""
    });
  }

  await sendParallelLocalizedScreenshotRunUpdate(run);
}

async function startParallelLocalizedScreenshotPhase(run, chunks, files, projectName, operation, phase) {
  await openParallelLocalizedScreenshotWorkers(run, chunks, files, operation, phase);
  return run.workers.map(worker => runParallelLocalizedScreenshotWorker(run, worker, files, projectName)
    .catch(error => handleParallelLocalizedScreenshotWorkerError(run, worker, error)));
}

function parallelLocalizedScreenshotPhaseHasFailure(run) {
  return run.workers.some(worker => worker.status === "failed" || worker.status === "aborted");
}

function parallelLocalizedScreenshotPhaseHasActiveWorkers(run, operation = "") {
  return (run.workers || []).some(worker => (
    (!operation || worker.operation === operation) &&
    ["preparing", "opening", "running", "aborting"].includes(worker.status)
  ));
}

async function waitForParallelLocalizedScreenshotPhaseWorkers(run, operation = "") {
  while (
    run &&
    !run.abortRequested &&
    parallelLocalizedScreenshotPhaseHasActiveWorkers(run, operation)
  ) {
    await delay(250);
  }
}

function getParallelLocalizedScreenshotWorkerRetryOperation(run, worker) {
  const activeRun = isParallelLocalizedScreenshotRunActiveStatus(run);
  if (run && run.mode === PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD) {
    if (activeRun && ["clearOnly", "uploadOnly"].includes(worker && worker.operation)) {
      return worker.operation;
    }
    return "replace";
  }

  return worker && worker.operation || getParallelLocalizedScreenshotOperationForMode(run && run.mode);
}

async function runParallelLocalizedScreenshotTwoPhase(run, clearChunks, uploadChunks, files, projectName) {
  run.deferFinalize = true;

  try {
    run.status = "running";
    run.message = text("parallelLocalizedScreenshotsClearingPhase", "Clearing localized screenshots before upload.");
    if ((clearChunks || []).length) {
      const clearPromises = await startParallelLocalizedScreenshotPhase(
        run,
        clearChunks,
        files,
        projectName,
        "clearOnly",
        "clearing"
      );
      await Promise.all(clearPromises);
    } else {
      run.phase = "clearing";
      await sendParallelLocalizedScreenshotRunUpdate(run);
    }
    await waitForParallelLocalizedScreenshotPhaseWorkers(run, "clearOnly");

    if (run.abortRequested || parallelLocalizedScreenshotPhaseHasFailure(run)) {
      run.deferFinalize = false;
      finalizeParallelLocalizedScreenshotRunIfDone(run);
      await sendParallelLocalizedScreenshotRunUpdate(run);
      return;
    }

    run.preClearedLocales = normalizeAssignedParallelLocales([
      ...(run.preClearedLocales || []),
      ...getParallelLocalizedScreenshotClearedNeedsUploadLocales(run)
    ]);
    run.initialClearedLocales = run.preClearedLocales.length;
    run.message = text("parallelLocalizedScreenshotsUploadPhase", "Uploading localized screenshots after clear phase.");
    const uploadPromises = await startParallelLocalizedScreenshotPhase(
      run,
      uploadChunks,
      files,
      projectName,
      "uploadOnly",
      "uploading"
    );
    await Promise.all(uploadPromises);
    await waitForParallelLocalizedScreenshotPhaseWorkers(run);
  } catch (error) {
    run.status = "failed";
    run.fatalError = true;
    run.message = error.message || String(error);
  } finally {
    run.deferFinalize = false;
    finalizeParallelLocalizedScreenshotRunIfDone(run);
    await sendParallelLocalizedScreenshotRunUpdate(run);
  }
}

async function continueParallelLocalizedScreenshotUpload(run, requestAccess, options = {}) {
  try {
    run.status = "starting";
    run.phase = "resolvingFiles";
    run.message = text("parallelLocalizedScreenshotsResolvingFiles", "Resolving localized screenshot files.");
    await sendParallelLocalizedScreenshotRunUpdate(run);
    await preopenParallelLocalizedScreenshotWorkers(run, options.workerCount);

    const resolved = await resolveMediaFilesForActiveProject(requestAccess, "localizedScreenshots", run.parentUrl || "");
    if (!resolved.ok) {
      failParallelLocalizedScreenshotRun(run, resolved.message);
      await sendParallelLocalizedScreenshotRunUpdate(run);
      return;
    }

    if (run.abortRequested) {
      failParallelLocalizedScreenshotRun(run, text("operationStopped", "Stopped."), "aborted");
      await sendParallelLocalizedScreenshotRunUpdate(run);
      return;
    }

    run.phase = "planningLocales";
    run.message = text("parallelLocalizedScreenshotsPlanningLocales", "Planning localized screenshot workers.");
    await sendParallelLocalizedScreenshotRunUpdate(run);

    const plan = buildParallelLocalizedScreenshotPlan(resolved.files, {
      workerCount: options.workerCount,
      startLocale: options.startLocale || options.localizedScreenshotsStartLocale || "",
      assignedLocales: options.assignedLocales
    });
    if (!plan.ok) {
      failParallelLocalizedScreenshotRun(run, plan.message);
      await sendParallelLocalizedScreenshotRunUpdate(run);
      return;
    }
    if (!plan.locales.length) {
      failParallelLocalizedScreenshotRun(
        run,
        plan.skipped.length
          ? text("mediaSkipped", "Skipped: $1.", [plan.skipped.join(", ")])
          : text("localizedScreenshotsNoMatchingFiles", "No localized screenshot files match imported listing locales.")
      );
      await sendParallelLocalizedScreenshotRunUpdate(run);
      return;
    }

    const contextLocales = normalizeAssignedParallelLocales(options.contextLocales || []);
    const contextStatusSource = options.contextLocaleStatuses && typeof options.contextLocaleStatuses === "object"
      ? options.contextLocaleStatuses
      : {};
    const displayLocales = contextLocales.length
      ? contextLocales
      : plan.locales;
    run.totalLocales = Math.max(plan.locales.length, displayLocales.length);
    run.totalScreenshots = plan.totalScreenshots;
    run.initialSkipped = plan.skipped;
    run.initialSkippedLocales = countParallelSkippedLocales(plan.skipped);
    const planLocaleSet = new Set(plan.locales.map(normalizeParallelLocalizedScreenshotLocale));
    run.preClearedLocales = normalizeAssignedParallelLocales(options.preClearedLocales || [])
      .filter(locale => planLocaleSet.has(locale));
    run.mutationGate = createParallelLocalizedScreenshotMutationGate(plan.workerCount, {
      parallelMutationGate: options.parallelMutationGate !== false,
      successCooldownMs: options.parallelMutationSuccessCooldownMs,
      errorCooldownMs: options.parallelMutationErrorCooldownMs,
      leaseTimeoutMs: options.parallelMutationLeaseTimeoutMs
    });
    run.parallelAuditAfterRun = options.parallelAuditAfterRun !== false && plan.workerCount > 1;
    const localeStatusState = createParallelLocalizedScreenshotLocaleStatusState(resolved.files, displayLocales);
    run.localeStatusOrder = localeStatusState.order;
    run.localeStatuses = localeStatusState.statuses;
    for (const locale of run.localeStatusOrder) {
      const contextStatus = contextStatusSource[locale] || null;
      if (!contextStatus) continue;
      const shouldPreserve = !planLocaleSet.has(locale) ||
        ["completed", "cleared", PARALLEL_LOCALIZED_SCREENSHOT_STATUS_CLEARED_AUDITED, "skipped"].includes(contextStatus.status);
      if (!shouldPreserve) continue;
      updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
        ...contextStatus,
        locale
      });
    }
    run.initialCompletedLocales = run.localeStatusOrder
      .filter(locale => run.localeStatuses[locale] && run.localeStatuses[locale].status === "completed")
      .length;
    run.initialClearedLocales = run.localeStatusOrder
      .filter(locale => run.localeStatuses[locale] &&
        isParallelLocalizedScreenshotClearedStatusName(run.localeStatuses[locale].status))
      .length;
    for (const locale of run.preClearedLocales) {
      updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
        status: "cleared",
        operation: "clearOnly",
        workerId: "",
        phase: "clearedBeforeResume",
        message: "localized screenshots cleared in a previous run; upload still needed"
      });
    }
    run.initialClearedLocales = run.localeStatusOrder
      .filter(locale => run.localeStatuses[locale] &&
        isParallelLocalizedScreenshotClearedStatusName(run.localeStatuses[locale].status))
      .length;

    if (run.abortRequested) {
      failParallelLocalizedScreenshotRun(run, text("operationStopped", "Stopped."), "aborted");
      await sendParallelLocalizedScreenshotRunUpdate(run);
      return;
    }

    run.status = "running";
    run.phase = "openingWorkers";
    run.message = text("parallelLocalizedScreenshotsOpeningWorkers", "Opening localized screenshot worker tabs.");
    await sendParallelLocalizedScreenshotRunUpdate(run);

    if (run.mode === PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD) {
      const preClearedSet = new Set(run.preClearedLocales || []);
      const clearLocales = plan.locales.filter(locale => !preClearedSet.has(normalizeParallelLocalizedScreenshotLocale(locale)));
      const clearChunks = splitParallelLocalizedScreenshotLocales(clearLocales, plan.workerCount);
      await runParallelLocalizedScreenshotTwoPhase(run, clearChunks, plan.chunks, resolved.files, resolved.projectName);
    } else {
      const operation = getParallelLocalizedScreenshotOperationForMode(run.mode);
      await openParallelLocalizedScreenshotWorkers(run, plan.chunks, resolved.files, operation, run.mode);
      if (run.abortRequested) {
        failParallelLocalizedScreenshotRun(run, text("operationStopped", "Stopped."), "aborted");
        await sendParallelLocalizedScreenshotRunUpdate(run);
        return;
      }
      for (const worker of run.workers) {
        runParallelLocalizedScreenshotWorker(run, worker, resolved.files, resolved.projectName)
          .catch(error => handleParallelLocalizedScreenshotWorkerError(run, worker, error));
      }
    }
  } catch (error) {
    failParallelLocalizedScreenshotRun(run, error.message || String(error));
    await sendParallelLocalizedScreenshotRunUpdate(run);
  }
}
