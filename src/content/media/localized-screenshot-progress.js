let localizedScreenshotActionLogSequence = 0;

function formatLocalizedScreenshotElapsedTime(elapsedMs) {
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

function publishLocalizedScreenshotActionLog(progress, event = {}) {
  if (!progress || !progress.runId || !progress.workerId || typeof storePilotRuntimeSendMessage !== "function") {
    return null;
  }

  const epochMs = Date.now();
  const logEvent = {
    sequence: ++localizedScreenshotActionLogSequence,
    epochMs,
    isoTime: new Date(epochMs).toISOString(),
    elapsedMs: progress.startedAt ? Math.max(0, epochMs - progress.startedAt) : Number(progress.elapsedMs || 0),
    runId: progress.runId || "",
    workerId: progress.workerId || "",
    operation: progress.operation || "",
    locale: progress.locale || "",
    localeIndex: Number(progress.localeIndex || 0),
    totalLocales: Number(progress.totalLocales || 0),
    localeScreenshotCount: Number(progress.localeScreenshotCount || 0),
    ...event
  };

  try {
    const response = storePilotRuntimeSendMessage({
      type: "storepilot-localized-screenshot-action-log",
      runId: progress.runId,
      workerId: progress.workerId,
      events: [logEvent]
    });
    if (response && typeof response.catch === "function") {
      response.catch(() => {});
    }
  } catch (_error) {
    // Action logging must never change upload behavior.
  }

  return logEvent;
}

function createLocalizedScreenshotProgress(entry, localeIndex, totalLocales, stats = {}, overrides = {}) {
  const startedAt = stats.startedAt || overrides.startedAt || Date.now();
  const elapsedMs = Number.isFinite(overrides.elapsedMs)
    ? overrides.elapsedMs
    : Math.max(0, Date.now() - startedAt);

  return {
    localeIndex,
    totalLocales,
    locale: entry && entry.locale || "",
    localeScreenshotCount: entry && entry.files ? entry.files.length : 0,
    completedLocales: stats.completedLocales || 0,
    failedLocales: stats.failedLocales || 0,
    skippedLocales: stats.skippedLocales || 0,
    uploadedScreenshots: stats.uploadedScreenshots || 0,
    totalScreenshots: stats.totalScreenshots || 0,
    operation: stats.operation || overrides.operation || "",
    startedAt,
    elapsedMs,
    runId: stats.runId || overrides.runId || "",
    workerId: stats.workerId || overrides.workerId || "",
    mutationGateEnabled: Boolean(stats.mutationGateEnabled || overrides.mutationGateEnabled),
    ...overrides
  };
}

function formatLocalizedScreenshotProgressStatus(progress, phase) {
  const phaseText = String(phase || "");
  const auditing = /auditing persisted localized screenshot count/i.test(phaseText);
  const runLocaleLine = auditing
    ? `Audit: ${progress.auditedLocales || 0}/${progress.totalLocales} verified, ${progress.failedLocales || 0} failed, ${progress.skippedLocales || 0} skipped`
    : `Run locales: ${progress.completedLocales || 0}/${progress.totalLocales} completed, ${progress.failedLocales || 0} failed, ${progress.skippedLocales || 0} skipped`;

  return [
    "Localized screenshots",
    `Locale: ${progress.localeIndex + 1}/${progress.totalLocales} - ${progress.locale} (${progress.localeScreenshotCount} expected)`,
    runLocaleLine,
    `Screenshots: ${progress.uploadedScreenshots || 0}/${progress.totalScreenshots || 0} uploaded`,
    `Elapsed: ${formatLocalizedScreenshotElapsedTime(progress.elapsedMs || 0)}`,
    `Current step: ${phaseText}`
  ].join("\n");
}

function publishLocalizedScreenshotProgress(progress, phase) {
  if (!progress || !progress.runId || !progress.workerId || typeof storePilotRuntimeSendMessage !== "function") {
    return;
  }

  try {
    const response = storePilotRuntimeSendMessage({
      type: "storepilot-localized-screenshot-progress",
      runId: progress.runId,
      workerId: progress.workerId,
      progress: {
        ...progress,
        phase,
        elapsedMs: Number.isFinite(progress.elapsedMs) ? progress.elapsedMs : 0
      }
    });
    if (response && typeof response.catch === "function") {
      response.catch(() => {});
    }
    if (response && typeof response.then === "function") {
      response.then(result => {
        if (result && result.aborted) {
          mediaOperationState.abortRequested = true;
        }
      }).catch(() => {});
    }
  } catch (_error) {
    // Parallel progress is best-effort; upload correctness is local to the worker.
  }
}

function setLocalizedScreenshotProgress(progress, phase) {
  setMediaOperationProgress(formatLocalizedScreenshotProgressStatus(progress, phase));
  if (typeof updateLocalizedScreenshotWorkerProgressState === "function") {
    updateLocalizedScreenshotWorkerProgressState(progress, phase);
  }
  publishLocalizedScreenshotProgress(progress, phase);
}

function isLocalizedScreenshotMutationGateEnabled(progress) {
  return Boolean(progress && progress.runId && progress.workerId && progress.mutationGateEnabled);
}

async function acquireLocalizedScreenshotMutationLease(progress, request = {}) {
  if (!isLocalizedScreenshotMutationGateEnabled(progress)) {
    return { ok: true, gateEnabled: false, leaseId: "", waitMs: 0 };
  }
  if (typeof storePilotRuntimeSendMessage !== "function") {
    return { ok: false, message: "Localized screenshot mutation gate is unavailable." };
  }

  const action = request.action || "media";
  const slot = request.screenshotSlot || request.targetSlot || 0;
  const label = slot ? `${action} screenshot ${slot}` : action;
  setLocalizedScreenshotProgress(progress, `waiting for media gate: ${label}`);

  const response = await storePilotRuntimeSendMessage({
    type: "storepilot-localized-screenshot-mutation-request",
    runId: progress.runId,
    workerId: progress.workerId,
    request: {
      locale: progress.locale || "",
      localeIndex: Number(progress.localeIndex || 0),
      totalLocales: Number(progress.totalLocales || 0),
      localeScreenshotCount: Number(progress.localeScreenshotCount || 0),
      ...request
    }
  });

  if (!response || !response.ok) {
    return {
      ok: false,
      aborted: Boolean(response && response.aborted),
      message: response && response.message || "Localized screenshot mutation gate did not grant a lease."
    };
  }

  if (response.gateEnabled) {
    setLocalizedScreenshotProgress(progress, `media gate granted: ${label}`);
  }
  return response;
}

async function releaseLocalizedScreenshotMutationLease(progress, lease, request = {}, result = {}) {
  if (!lease || !lease.gateEnabled || !lease.leaseId || !progress || !progress.runId || !progress.workerId) {
    return null;
  }
  if (typeof storePilotRuntimeSendMessage !== "function") {
    return null;
  }

  try {
    return await storePilotRuntimeSendMessage({
      type: "storepilot-localized-screenshot-mutation-release",
      runId: progress.runId,
      workerId: progress.workerId,
      leaseId: lease.leaseId,
      request: {
        locale: progress.locale || "",
        localeIndex: Number(progress.localeIndex || 0),
        totalLocales: Number(progress.totalLocales || 0),
        localeScreenshotCount: Number(progress.localeScreenshotCount || 0),
        ...request
      },
      ...result
    });
  } catch (_error) {
    return null;
  }
}
