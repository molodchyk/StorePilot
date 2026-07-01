async function storePilotHandleLocalizedScreenshotProgress(sender, message) {
  const run = message && message.runId ? localizedScreenshotParallelRuns.get(message.runId) : null;
  if (!run) {
    return { ok: false, message: text("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.") };
  }

  const senderTabId = sender && sender.tab && sender.tab.id;
  const worker = run.workers.find(candidate => (
    candidate.workerId === message.workerId ||
    (senderTabId && candidate.tabId === senderTabId)
  ));
  if (!worker) {
    return { ok: false, message: text("parallelLocalizedScreenshotsNoWorker", "No parallel localized screenshot worker found.") };
  }

  const progress = message.progress || {};
  if (run.abortRequested) {
    worker.status = "aborting";
    worker.progress = {
      ...progress,
      tabId: senderTabId || worker.tabId,
      workerId: worker.workerId,
      runId: run.runId
    };
    worker.currentLocale = progress.locale || worker.currentLocale || "";
    worker.phase = progress.phase || worker.phase || "";
    worker.lastUpdatedAt = Date.now();
    await sendParallelLocalizedScreenshotRunUpdate(run);
    return {
      ok: false,
      aborted: true,
      message: text("operationStopped", "Stopped.")
    };
  }

  const progressCompletedLocales = Number(progress.completedLocales || 0);
  const progressFailedLocales = Number(progress.failedLocales || 0);
  const progressSkippedLocales = Number(progress.skippedLocales || 0);
  const progressUploadedScreenshots = Number(progress.uploadedScreenshots || 0);
  const progressTotalLocales = Number(progress.totalLocales || 0);
  const progressAuditedLocales = Number(progress.auditedLocales || (isParallelLocalizedScreenshotAuditPhase(progress.phase) ? progress.completedLocales || 0 : 0));
  const progressIsAudit = isParallelLocalizedScreenshotAuditPhase(progress.phase);
  worker.status = run.abortRequested ? "aborting" : "running";
  worker.progress = {
    ...progress,
    tabId: senderTabId || worker.tabId,
    workerId: worker.workerId,
    runId: run.runId
  };
  worker.currentLocale = progress.locale || worker.currentLocale || "";
  worker.phase = progress.phase || worker.phase || "";
  worker.lastUpdatedAt = Date.now();
  if (progressIsAudit) {
    worker.auditedLocales = Math.max(Number(worker.auditedLocales || 0), progressAuditedLocales);
    worker.auditTotalLocales = Math.max(Number(worker.auditTotalLocales || 0), progressTotalLocales);
    worker.completedLocales = Math.max(Number(worker.completedLocales || 0), progressCompletedLocales);
    worker.failedLocales = Math.max(Number(worker.failedLocales || 0), progressFailedLocales);
    worker.skippedLocales = Math.max(Number(worker.skippedLocales || 0), progressSkippedLocales);
    worker.uploadedScreenshots = Math.max(Number(worker.uploadedScreenshots || 0), progressUploadedScreenshots);
  } else {
    worker.completedLocales = progressCompletedLocales;
    worker.failedLocales = progressFailedLocales;
    worker.skippedLocales = progressSkippedLocales;
    worker.uploadedScreenshots = progressUploadedScreenshots;
  }
  if (progress.locale) {
    updateParallelLocalizedScreenshotLocaleStatus(run, progress.locale, {
      status: getParallelLocalizedScreenshotProgressLocaleStatus(worker, progress),
      operation: worker.operation || "",
      workerId: worker.workerId,
      phase: progress.phase || "",
      totalScreenshots: Number(progress.localeScreenshotCount || 0) ||
        (run.localeStatuses &&
          run.localeStatuses[normalizeParallelLocalizedScreenshotLocale(progress.locale)] &&
          run.localeStatuses[normalizeParallelLocalizedScreenshotLocale(progress.locale)].totalScreenshots) ||
        0,
      message: progress.phase || ""
    });
  }
  await sendParallelLocalizedScreenshotRunUpdate(run);

  return { ok: true };
}

async function storePilotHandleLocalizedScreenshotActionLog(sender, message) {
  const run = message && message.runId ? localizedScreenshotParallelRuns.get(message.runId) : null;
  if (!run) {
    return { ok: false, message: text("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.") };
  }

  const senderTabId = sender && sender.tab && sender.tab.id;
  const worker = run.workers.find(candidate => (
    candidate.workerId === message.workerId ||
    (senderTabId && candidate.tabId === senderTabId)
  ));
  if (!worker) {
    return { ok: false, message: text("parallelLocalizedScreenshotsNoWorker", "No parallel localized screenshot worker found.") };
  }

  const appended = appendParallelLocalizedScreenshotActionLog(run, worker, message.events || [], senderTabId || 0);
  await persistParallelLocalizedScreenshotLog(run);
  return {
    ok: true,
    appended: appended.length,
    actionLogCount: Array.isArray(run.actionLog) ? run.actionLog.length : 0
  };
}

async function storePilotRequestLocalizedScreenshotMutation(sender, message) {
  const run = message && message.runId ? localizedScreenshotParallelRuns.get(message.runId) : null;
  if (!run) {
    return { ok: false, message: text("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.") };
  }

  const worker = getParallelLocalizedScreenshotMutationWorker(run, sender, message.workerId || "");
  if (!worker) {
    return { ok: false, message: text("parallelLocalizedScreenshotsNoWorker", "No parallel localized screenshot worker found.") };
  }

  if (run.abortRequested) {
    return { ok: false, aborted: true, message: text("operationStopped", "Stopped.") };
  }
  if (!isParallelLocalizedScreenshotMutationGateEnabled(run)) {
    return { ok: true, gateEnabled: false, leaseId: "", waitMs: 0, queuedCount: 0 };
  }

  const gate = run.mutationGate;
  const request = normalizeParallelLocalizedScreenshotMutationRequest(message.request || message);
  const requestedAtMs = Date.now();
  worker.mutationGateWaiting = true;
  worker.mutationGateWaitingSince = requestedAtMs;
  worker.mutationGateRequest = request;
  appendParallelLocalizedScreenshotGateLog(run, worker, request, "gate-request", {
    waitMs: 0,
    queueDepth: gate.queue.length,
    cooldownMs: Math.max(0, gate.nextAvailableAt - requestedAtMs)
  });
  await persistParallelLocalizedScreenshotLog(run);
  await sendParallelLocalizedScreenshotRunUpdate(run);

  return new Promise(resolve => {
    gate.queue.push({
      worker,
      request,
      requestedAtMs,
      resolve,
      settled: false
    });
    scheduleParallelLocalizedScreenshotMutationGate(run);
  });
}

async function storePilotReleaseLocalizedScreenshotMutation(sender, message) {
  const run = message && message.runId ? localizedScreenshotParallelRuns.get(message.runId) : null;
  if (!run) {
    return { ok: false, message: text("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.") };
  }

  const worker = getParallelLocalizedScreenshotMutationWorker(run, sender, message.workerId || "");
  if (!worker) {
    return { ok: false, message: text("parallelLocalizedScreenshotsNoWorker", "No parallel localized screenshot worker found.") };
  }

  const gate = run.mutationGate;
  if (!gate || !gate.enabled) {
    return { ok: true, gateEnabled: false };
  }

  const leaseId = message.leaseId || "";
  const lease = gate.currentLease;
  const request = normalizeParallelLocalizedScreenshotMutationRequest(message.request || message);
  const now = Date.now();
  const currentLeaseMatches = Boolean(lease && lease.leaseId === leaseId);
  const outcome = message.outcome || "unknown";
  const successful = ["added", "removed", "cleared", "already-clear", "ok", "success"].includes(outcome);
  const cooldownMs = successful ? gate.successCooldownMs : gate.errorCooldownMs;

  appendParallelLocalizedScreenshotGateLog(run, worker, request, currentLeaseMatches ? "gate-release" : "gate-release-stale", {
    leaseId,
    outcome,
    visibleBefore: Number.isFinite(Number(message.visibleBefore)) ? Number(message.visibleBefore) : request.visibleBefore,
    visibleAfter: Number.isFinite(Number(message.visibleAfter)) ? Number(message.visibleAfter) : null,
    addedCount: Number.isFinite(Number(message.addedCount)) ? Number(message.addedCount) : null,
    removedCount: Number.isFinite(Number(message.removedCount)) ? Number(message.removedCount) : null,
    durationMs: Number.isFinite(Number(message.durationMs)) ? Number(message.durationMs) : lease ? now - lease.grantedAtMs : null,
    errorMessage: message.errorMessage || "",
    message: message.message || "",
    cooldownMs,
    queueDepth: gate.queue.length
  });

  if (currentLeaseMatches) {
    gate.currentLease = null;
    gate.lastOutcome = outcome;
    gate.lastReleaseAt = now;
    gate.nextAvailableAt = now + cooldownMs;
  }
  if (worker.currentMutationLease && worker.currentMutationLease.leaseId === leaseId) {
    worker.currentMutationLease = null;
  }
  worker.mutationGateWaiting = false;
  worker.mutationGateRequest = null;

  await sendParallelLocalizedScreenshotRunUpdate(run);
  await persistParallelLocalizedScreenshotLog(run);
  scheduleParallelLocalizedScreenshotMutationGate(run);

  return {
    ok: true,
    gateEnabled: true,
    released: currentLeaseMatches,
    cooldownMs,
    queuedCount: gate.queue.length
  };
}

function storePilotGetParallelLocalizedScreenshotRun(sender, runId = "") {
  const run = getParallelLocalizedScreenshotRunForSender(sender, runId);
  return run
    ? { ok: true, run: createParallelLocalizedScreenshotRunSnapshot(run) }
    : { ok: false, message: text("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.") };
}

async function storePilotGetParallelLocalizedScreenshotLog(sender, runId = "") {
  const run = getParallelLocalizedScreenshotRunForSender(sender, runId);
  if (run) {
    await persistParallelLocalizedScreenshotLog(run);
    return {
      ok: true,
      filename: `storepilot-localized-screenshot-log-${run.runId}.json`,
      log: createParallelLocalizedScreenshotLogPayload(run)
    };
  }

  const storedLog = await getStoredParallelLocalizedScreenshotLog(sender, runId);
  if (storedLog && storedLog.log) {
    return {
      ok: true,
      filename: storedLog.filename || `storepilot-localized-screenshot-log-${storedLog.runId || runId || "latest"}.json`,
      log: storedLog.log,
      restored: true
    };
  }

  return { ok: false, message: text("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.") };
}
