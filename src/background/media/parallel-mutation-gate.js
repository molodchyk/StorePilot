function isParallelLocalizedScreenshotMutationGateEnabled(run) {
  return Boolean(run && run.mutationGate && run.mutationGate.enabled);
}

function createParallelLocalizedScreenshotMutationGate(workerCount = 1, options = {}) {
  const enabled = Number(workerCount || 0) > 1 && options.parallelMutationGate !== false;
  return {
    enabled,
    queue: [],
    currentLease: null,
    leaseSequence: 0,
    nextAvailableAt: 0,
    lastReleaseAt: 0,
    lastOutcome: "",
    successCooldownMs: Number.isFinite(Number(options.successCooldownMs))
      ? Math.max(0, Number(options.successCooldownMs))
      : PARALLEL_LOCALIZED_SCREENSHOT_MUTATION_SUCCESS_COOLDOWN_MS,
    errorCooldownMs: Number.isFinite(Number(options.errorCooldownMs))
      ? Math.max(0, Number(options.errorCooldownMs))
      : PARALLEL_LOCALIZED_SCREENSHOT_MUTATION_ERROR_COOLDOWN_MS,
    leaseTimeoutMs: Number.isFinite(Number(options.leaseTimeoutMs))
      ? Math.max(1000, Number(options.leaseTimeoutMs))
      : PARALLEL_LOCALIZED_SCREENSHOT_MUTATION_LEASE_TIMEOUT_MS,
    aborted: false,
    grantTimer: 0
  };
}

function getParallelLocalizedScreenshotMutationGateSnapshot(run, now = Date.now()) {
  const gate = run && run.mutationGate;
  if (!gate) {
    return {
      enabled: false,
      queuedCount: 0,
      currentLease: null,
      nextAvailableInMs: 0,
      successCooldownMs: PARALLEL_LOCALIZED_SCREENSHOT_MUTATION_SUCCESS_COOLDOWN_MS,
      errorCooldownMs: PARALLEL_LOCALIZED_SCREENSHOT_MUTATION_ERROR_COOLDOWN_MS,
      lastOutcome: ""
    };
  }

  const currentLease = gate.currentLease
    ? {
      leaseId: gate.currentLease.leaseId,
      workerId: gate.currentLease.workerId,
      tabId: gate.currentLease.tabId,
      action: gate.currentLease.action,
      locale: gate.currentLease.locale,
      screenshotSlot: gate.currentLease.screenshotSlot,
      targetSlot: gate.currentLease.targetSlot,
      attempt: gate.currentLease.attempt,
      grantedAtMs: gate.currentLease.grantedAtMs,
      elapsedMs: Math.max(0, now - gate.currentLease.grantedAtMs),
      expiresInMs: Math.max(0, gate.currentLease.expiresAtMs - now)
    }
    : null;

  return {
    enabled: Boolean(gate.enabled),
    queuedCount: gate.queue.length,
    currentLease,
    nextAvailableInMs: Math.max(0, gate.nextAvailableAt - now),
    successCooldownMs: gate.successCooldownMs,
    errorCooldownMs: gate.errorCooldownMs,
    lastOutcome: gate.lastOutcome || "",
    lastReleaseAt: gate.lastReleaseAt || 0
  };
}

function normalizeParallelLocalizedScreenshotMutationRequest(request = {}) {
  return {
    action: request.action || "",
    locale: normalizeParallelLocalizedScreenshotLocale(request.locale || ""),
    localeIndex: Number(request.localeIndex || 0),
    totalLocales: Number(request.totalLocales || 0),
    localeScreenshotCount: Number(request.localeScreenshotCount || 0),
    attempt: Number(request.attempt || 0),
    screenshotSlot: Number(request.screenshotSlot || 0),
    targetSlot: Number(request.targetSlot || 0),
    visibleBefore: Number.isFinite(Number(request.visibleBefore)) ? Number(request.visibleBefore) : null,
    fileName: request.fileName || "",
    fileSize: Number(request.fileSize || 0),
    fileType: request.fileType || "",
    buttonLabel: request.buttonLabel || "",
    message: request.message || ""
  };
}

function appendParallelLocalizedScreenshotGateLog(run, worker, request, stage, details = {}) {
  if (!run || !worker) return;
  appendParallelLocalizedScreenshotActionLog(run, worker, [{
    runId: run.runId,
    workerId: worker.workerId,
    operation: worker.operation || "",
    locale: request && request.locale || "",
    localeIndex: request && request.localeIndex || 0,
    totalLocales: request && request.totalLocales || 0,
    localeScreenshotCount: request && request.localeScreenshotCount || 0,
    action: request && request.action || "",
    stage,
    attempt: request && request.attempt || 0,
    screenshotSlot: request && request.screenshotSlot || 0,
    targetSlot: request && request.targetSlot || 0,
    visibleBefore: request && request.visibleBefore,
    buttonLabel: request && request.buttonLabel || "",
    fileName: request && request.fileName || "",
    fileSize: request && request.fileSize || 0,
    fileType: request && request.fileType || "",
    method: "mutation-gate",
    ...details
  }], worker.tabId || 0);
}

function getParallelLocalizedScreenshotMutationWorker(run, sender, workerId = "") {
  if (!run) return null;
  const senderTabId = sender && sender.tab && sender.tab.id;
  return run.workers.find(candidate => (
    candidate.workerId === workerId ||
    (senderTabId && candidate.tabId === senderTabId)
  )) || null;
}

function settleParallelLocalizedScreenshotMutationRequest(entry, response) {
  if (!entry || entry.settled) return;
  entry.settled = true;
  entry.resolve(response);
}

function scheduleParallelLocalizedScreenshotMutationGate(run) {
  const gate = run && run.mutationGate;
  if (!gate || !gate.enabled || gate.currentLease || gate.aborted) return;
  if (!gate.queue.length) return;

  const now = Date.now();
  const waitMs = Math.max(0, gate.nextAvailableAt - now);
  if (waitMs > 0) {
    if (!gate.grantTimer) {
      gate.grantTimer = setBackgroundTimer(() => {
        gate.grantTimer = 0;
        scheduleParallelLocalizedScreenshotMutationGate(run);
      }, waitMs);
    }
    return;
  }

  const entry = gate.queue.shift();
  if (!entry || entry.settled) {
    scheduleParallelLocalizedScreenshotMutationGate(run);
    return;
  }

  if (run.abortRequested) {
    settleParallelLocalizedScreenshotMutationRequest(entry, {
      ok: false,
      aborted: true,
      message: text("operationStopped", "Stopped.")
    });
    scheduleParallelLocalizedScreenshotMutationGate(run);
    return;
  }

  const grantedAtMs = Date.now();
  const lease = {
    leaseId: `${run.runId}-lease-${++gate.leaseSequence}`,
    runId: run.runId,
    workerId: entry.worker.workerId,
    tabId: entry.worker.tabId,
    action: entry.request.action,
    locale: entry.request.locale,
    screenshotSlot: entry.request.screenshotSlot,
    targetSlot: entry.request.targetSlot,
    attempt: entry.request.attempt,
    requestedAtMs: entry.requestedAtMs,
    grantedAtMs,
    expiresAtMs: grantedAtMs + gate.leaseTimeoutMs
  };
  gate.currentLease = lease;
  entry.worker.currentMutationLease = lease;
  entry.worker.mutationGateWaiting = false;
  appendParallelLocalizedScreenshotGateLog(run, entry.worker, entry.request, "gate-grant", {
    leaseId: lease.leaseId,
    waitMs: grantedAtMs - entry.requestedAtMs,
    queueDepth: gate.queue.length,
    cooldownMs: 0
  });
  sendParallelLocalizedScreenshotRunUpdate(run);

  setBackgroundTimer(() => {
    if (!gate.currentLease || gate.currentLease.leaseId !== lease.leaseId) return;
    gate.lastOutcome = "lease-timeout";
    gate.lastReleaseAt = Date.now();
    gate.nextAvailableAt = gate.lastReleaseAt + gate.errorCooldownMs;
    appendParallelLocalizedScreenshotGateLog(run, entry.worker, entry.request, "gate-timeout", {
      leaseId: lease.leaseId,
      outcome: "lease-timeout",
      durationMs: gate.lastReleaseAt - lease.grantedAtMs,
      cooldownMs: gate.errorCooldownMs
    });
    gate.currentLease = null;
    if (entry.worker.currentMutationLease && entry.worker.currentMutationLease.leaseId === lease.leaseId) {
      entry.worker.currentMutationLease = null;
    }
    sendParallelLocalizedScreenshotRunUpdate(run);
    scheduleParallelLocalizedScreenshotMutationGate(run);
  }, gate.leaseTimeoutMs + 50);

  settleParallelLocalizedScreenshotMutationRequest(entry, {
    ok: true,
    gateEnabled: true,
    leaseId: lease.leaseId,
    grantedAtMs,
    waitMs: grantedAtMs - entry.requestedAtMs,
    queuedCount: gate.queue.length,
    currentLease: lease
  });
}

function abortParallelLocalizedScreenshotMutationGate(run) {
  const gate = run && run.mutationGate;
  if (!gate) return;
  gate.aborted = true;
  if (gate.currentLease) {
    const lease = gate.currentLease;
    const worker = (run.workers || []).find(candidate => candidate.workerId === lease.workerId);
    const releasedAtMs = Date.now();
    appendParallelLocalizedScreenshotGateLog(run, worker, {
      action: lease.action,
      locale: lease.locale,
      screenshotSlot: lease.screenshotSlot,
      targetSlot: lease.targetSlot,
      attempt: lease.attempt
    }, "gate-abort", {
      leaseId: lease.leaseId,
      outcome: "aborted",
      durationMs: releasedAtMs - Number(lease.grantedAtMs || releasedAtMs),
      cooldownMs: 0
    });
    gate.lastOutcome = "aborted";
    gate.lastReleaseAt = releasedAtMs;
    gate.nextAvailableAt = releasedAtMs;
    gate.currentLease = null;
    if (worker && worker.currentMutationLease && worker.currentMutationLease.leaseId === lease.leaseId) {
      worker.currentMutationLease = null;
    }
  }
  for (const entry of gate.queue.splice(0)) {
    settleParallelLocalizedScreenshotMutationRequest(entry, {
      ok: false,
      aborted: true,
      message: text("operationStopped", "Stopped.")
    });
  }
}

function resetAbortedParallelLocalizedScreenshotMutationGateForRetry(run) {
  const gate = run && run.mutationGate;
  if (!gate || !gate.aborted) return;

  if (gate.grantTimer && typeof clearTimeout === "function") {
    clearTimeout(gate.grantTimer);
  }
  gate.grantTimer = 0;
  for (const entry of gate.queue.splice(0)) {
    settleParallelLocalizedScreenshotMutationRequest(entry, {
      ok: false,
      aborted: true,
      message: text("operationStopped", "Stopped.")
    });
  }
  gate.currentLease = null;
  gate.aborted = false;
  gate.nextAvailableAt = Date.now();
  gate.lastOutcome = "retry-reset";
}
