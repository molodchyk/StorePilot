function normalizeParallelLocalizedScreenshotActionLogEvent(event, worker, senderTabId = 0) {
  const epochMs = Number(event && event.epochMs || Date.now());
  return {
    sequence: Number(event && event.sequence || 0),
    epochMs,
    isoTime: event && event.isoTime || new Date(epochMs).toISOString(),
    receivedAtMs: Date.now(),
    receivedAtIso: new Date().toISOString(),
    elapsedMs: Number(event && event.elapsedMs || 0),
    runId: event && event.runId || "",
    workerId: worker && worker.workerId || event && event.workerId || "",
    tabId: senderTabId || worker && worker.tabId || 0,
    operation: event && event.operation || worker && worker.operation || "",
    locale: normalizeParallelLocalizedScreenshotLocale(event && event.locale || ""),
    localeIndex: Number(event && event.localeIndex || 0),
    totalLocales: Number(event && event.totalLocales || 0),
    localeScreenshotCount: Number(event && event.localeScreenshotCount || 0),
    action: event && event.action || "",
    stage: event && event.stage || "",
    attempt: Number(event && event.attempt || 0),
    screenshotSlot: Number(event && event.screenshotSlot || 0),
    targetSlot: Number(event && event.targetSlot || 0),
    visibleBefore: Number.isFinite(Number(event && event.visibleBefore)) ? Number(event.visibleBefore) : null,
    visibleAfter: Number.isFinite(Number(event && event.visibleAfter)) ? Number(event.visibleAfter) : null,
    addedCount: Number.isFinite(Number(event && event.addedCount)) ? Number(event.addedCount) : null,
    removedCount: Number.isFinite(Number(event && event.removedCount)) ? Number(event.removedCount) : null,
    durationMs: Number.isFinite(Number(event && event.durationMs)) ? Number(event.durationMs) : null,
    outcome: event && event.outcome || "",
    method: event && event.method || "",
    buttonLabel: event && event.buttonLabel || "",
    fileName: event && event.fileName || "",
    fileSize: Number(event && event.fileSize || 0),
    fileType: event && event.fileType || "",
    leaseId: event && event.leaseId || "",
    waitMs: Number.isFinite(Number(event && event.waitMs)) ? Number(event.waitMs) : null,
    cooldownMs: Number.isFinite(Number(event && event.cooldownMs)) ? Number(event.cooldownMs) : null,
    queueDepth: Number.isFinite(Number(event && event.queueDepth)) ? Number(event.queueDepth) : null,
    errorMessage: event && event.errorMessage || "",
    message: event && event.message || ""
  };
}

function appendParallelLocalizedScreenshotActionLog(run, worker, events, senderTabId = 0) {
  if (!run || !worker || !Array.isArray(events) || !events.length) return [];

  if (!Array.isArray(run.actionLog)) run.actionLog = [];
  if (!Array.isArray(worker.actionLog)) worker.actionLog = [];
  const normalizedEvents = events
    .map(event => normalizeParallelLocalizedScreenshotActionLogEvent(event, worker, senderTabId))
    .sort((left, right) => left.epochMs - right.epochMs || left.sequence - right.sequence);

  run.actionLog.push(...normalizedEvents);
  worker.actionLog.push(...normalizedEvents);
  run.actionLog.sort((left, right) => left.epochMs - right.epochMs || left.sequence - right.sequence);
  worker.actionLog.sort((left, right) => left.epochMs - right.epochMs || left.sequence - right.sequence);

  if (run.actionLog.length > 10000) {
    run.actionLog.splice(0, run.actionLog.length - 10000);
  }
  if (worker.actionLog.length > 2500) {
    worker.actionLog.splice(0, worker.actionLog.length - 2500);
  }
  return normalizedEvents;
}

function formatParallelLocalizedScreenshotElapsed(elapsedMs) {
  const totalSeconds = Math.max(0, Math.floor(Number(elapsedMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${String(minutes % 60).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

function parseLocalizedResultLocale(value) {
  const match = String(value || "").match(/^([^:]+):/);
  return normalizeParallelLocalizedScreenshotLocale(match ? match[1] : value);
}

function parseLocalizedUploadedScreenshotCount(value) {
  const match = String(value || "").match(/:\s*(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

function uniqueLocales(values) {
  return Array.from(new Set((values || [])
    .map(parseLocalizedResultLocale)
    .filter(Boolean)));
}

function countParallelSkippedLocales(skipped) {
  return (skipped || []).reduce((count, item) => {
    const match = String(item || "").match(/^(\d+) locale\(s\) before start locale\b/);
    return count + (match ? Number(match[1]) : 1);
  }, 0);
}

function isCoordinatedClearWorker(run, worker) {
  return Boolean(run &&
    run.mode === PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD &&
    worker &&
    worker.operation === "clearOnly");
}

function getParallelLocalizedScreenshotClearedNeedsUploadLocales(run) {
  const locales = new Set();

  for (const status of run && run.localeStatuses ? Object.values(run.localeStatuses) : []) {
    const locale = normalizeParallelLocalizedScreenshotLocale(status && status.locale || "");
    if (locale && status.status === "cleared") {
      locales.add(locale);
    }
  }

  for (const worker of run && run.workers || []) {
    if (!isCoordinatedClearWorker(run, worker)) continue;
    for (const locale of worker.completedLocaleList || []) {
      const normalizedLocale = normalizeParallelLocalizedScreenshotLocale(locale);
      if (normalizedLocale) locales.add(normalizedLocale);
    }
  }

  return Array.from(locales);
}

function createParallelLocalizedScreenshotLocaleStatusState(files, locales) {
  const order = [];
  const statuses = {};

  for (const locale of locales || []) {
    const normalizedLocale = normalizeParallelLocalizedScreenshotLocale(locale);
    if (!normalizedLocale || statuses[normalizedLocale]) continue;
    order.push(normalizedLocale);
    statuses[normalizedLocale] = {
      locale: normalizedLocale,
      status: "pending",
      phase: "",
      operation: "",
      workerId: "",
      uploadedScreenshots: 0,
      totalScreenshots: countParallelLocalizedScreenshotFilesForLocale(files, normalizedLocale),
      message: ""
    };
  }

  return { order, statuses };
}

function updateParallelLocalizedScreenshotLocaleStatus(run, locale, patch = {}) {
  const normalizedLocale = normalizeParallelLocalizedScreenshotLocale(locale);
  if (!run || !normalizedLocale) return;

  if (!run.localeStatuses) run.localeStatuses = {};
  if (!run.localeStatusOrder) run.localeStatusOrder = [];
  if (!run.localeStatuses[normalizedLocale]) {
    run.localeStatusOrder.push(normalizedLocale);
    run.localeStatuses[normalizedLocale] = {
      locale: normalizedLocale,
      status: "pending",
      phase: "",
      operation: "",
      workerId: "",
      uploadedScreenshots: 0,
      totalScreenshots: 0,
      message: ""
    };
  }

  run.localeStatuses[normalizedLocale] = {
    ...run.localeStatuses[normalizedLocale],
    ...patch,
    locale: normalizedLocale,
    lastUpdatedAt: Date.now()
  };
}

function getParallelLocalizedScreenshotProgressLocaleStatus(worker, progress) {
  const operation = worker && worker.operation || "";
  const phase = String(progress && progress.phase || "").toLowerCase();

  if (isParallelLocalizedScreenshotAuditPhase(phase)) {
    return "auditing";
  }
  if (/final localized screenshot count|uploaded screenshot|uploading screenshot|upload-only/.test(phase)) {
    return "uploading";
  }
  if (/clearing|clear|delete|remove/.test(phase)) {
    return "clearing";
  }
  if (operation === "clearOnly") return "clearing";
  if (operation === "uploadOnly") return "uploading";
  if (operation === "replace") return "replacing";
  return "running";
}

function isParallelLocalizedScreenshotAuditPhase(phase) {
  return /auditing persisted localized screenshot count/.test(String(phase || "").toLowerCase());
}

function getParallelRunElapsedMs(run, now = Date.now()) {
  if (!run || !run.startedAt) return 0;
  return Math.max(0, (run.finishedAt || now) - run.startedAt);
}

function getParallelLocalizedScreenshotTimelineCounts(run, totals, localeStatuses) {
  const statuses = Array.isArray(localeStatuses) ? localeStatuses : [];
  const totalLocales = Math.max(
    Number(totals && totals.totalLocales || 0),
    Number(run && run.totalLocales || 0),
    statuses.length
  );

  const totalCompletedLocales = Math.min(totalLocales, Number(totals && totals.completedLocales || 0));
  const totalFailedLocales = Math.min(
    Math.max(0, totalLocales - totalCompletedLocales),
    Number(totals && totals.failedLocales || 0)
  );
  const statusSkippedLocales = statuses.filter(item => item.status === "skipped").length;
  const totalSkippedLocales = Math.min(
    Math.max(0, totalLocales - totalCompletedLocales - totalFailedLocales),
    statusSkippedLocales
  );
  const hasWorkerProgress = totalCompletedLocales > 0 || totalFailedLocales > 0 || totalSkippedLocales > 0;

  if (!hasWorkerProgress && statuses.length) {
    const countClearedAsComplete = run &&
      run.mode === PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD &&
      run.phase === "clearing";
    const completedLocales = statuses.filter(item => (
      item.status === "completed" || (countClearedAsComplete && item.status === "cleared")
    )).length;
    const failedLocales = statuses.filter(item => item.status === "failed" || item.status === "aborted").length;
    const skippedLocales = statuses.filter(item => item.status === "skipped").length;

    return {
      completedLocales,
      failedLocales,
      skippedLocales,
      remainingLocales: Math.max(0, totalLocales - completedLocales - failedLocales - skippedLocales),
      uploadedScreenshots: Number(totals && totals.uploadedScreenshots || 0),
      totalLocales
    };
  }

  return {
    completedLocales: totalCompletedLocales,
    failedLocales: totalFailedLocales,
    skippedLocales: totalSkippedLocales,
    remainingLocales: Math.max(0, totalLocales - totalCompletedLocales - totalFailedLocales - totalSkippedLocales),
    uploadedScreenshots: Number(totals && totals.uploadedScreenshots || 0),
    totalLocales
  };
}

function recordParallelLocalizedScreenshotTimelineSample(run, totals, localeStatuses, now = Date.now()) {
  if (!run) return [];

  if (!Array.isArray(run.timeline)) run.timeline = [];
  const elapsedMs = getParallelRunElapsedMs(run, now);
  const counts = getParallelLocalizedScreenshotTimelineCounts(run, totals, localeStatuses);
  const phase = String(run.phase || "");
  const sample = {
    elapsedMs,
    phase,
    completedLocales: counts.completedLocales,
    failedLocales: counts.failedLocales,
    skippedLocales: counts.skippedLocales,
    remainingLocales: counts.remainingLocales,
    uploadedScreenshots: counts.uploadedScreenshots,
    totalLocales: counts.totalLocales
  };
  const lastSample = run.timeline[run.timeline.length - 1];
  if (lastSample && String(lastSample.phase || "") !== phase) {
    run.timeline = [];
  }
  const phaseLastSample = run.timeline[run.timeline.length - 1];
  const changed = !phaseLastSample ||
    phaseLastSample.completedLocales !== sample.completedLocales ||
    phaseLastSample.failedLocales !== sample.failedLocales ||
    phaseLastSample.skippedLocales !== sample.skippedLocales ||
    phaseLastSample.remainingLocales !== sample.remainingLocales ||
    phaseLastSample.uploadedScreenshots !== sample.uploadedScreenshots;
  const terminal = ["completed", "failed", "aborted"].includes(run.status);
  const stale = !phaseLastSample || sample.elapsedMs - phaseLastSample.elapsedMs >= 2000;

  if (!phaseLastSample || changed || stale || (terminal && phaseLastSample.elapsedMs !== sample.elapsedMs)) {
    run.timeline.push(sample);
  }

  if (run.timeline.length > 240) {
    run.timeline.splice(0, run.timeline.length - 240);
  }

  return run.timeline;
}

function isParallelWorkerTerminal(worker) {
  return ["completed", "failed", "aborted"].includes(worker && worker.status);
}

function getWorkerElapsedMs(worker, now = Date.now()) {
  if (Number.isFinite(worker.elapsedMs)) return worker.elapsedMs;
  if (worker.startedAt) return Math.max(0, now - worker.startedAt);
  return 0;
}

function recordParallelLocalizedScreenshotWorkerTimelineSample(worker, snapshotWorker, now = Date.now()) {
  if (!worker || !snapshotWorker) return [];

  if (!Array.isArray(worker.timeline)) worker.timeline = [];
  const totalLocales = Math.max(0, Number(snapshotWorker.assignedCount || 0));
  const completedLocales = Math.min(totalLocales, Number(snapshotWorker.completedLocales || 0));
  const failedLocales = Math.min(
    Math.max(0, totalLocales - completedLocales),
    Number(snapshotWorker.failedLocales || 0)
  );
  const skippedLocales = Math.min(
    Math.max(0, totalLocales - completedLocales - failedLocales),
    Number(snapshotWorker.skippedLocales || 0)
  );
  const sample = {
    elapsedMs: getWorkerElapsedMs(worker, now),
    completedLocales,
    failedLocales,
    skippedLocales,
    remainingLocales: Math.max(0, totalLocales - completedLocales - failedLocales - skippedLocales),
    uploadedScreenshots: Number(snapshotWorker.uploadedScreenshots || 0),
    totalLocales
  };
  const lastSample = worker.timeline[worker.timeline.length - 1];
  const changed = !lastSample ||
    lastSample.completedLocales !== sample.completedLocales ||
    lastSample.failedLocales !== sample.failedLocales ||
    lastSample.skippedLocales !== sample.skippedLocales ||
    lastSample.remainingLocales !== sample.remainingLocales ||
    lastSample.uploadedScreenshots !== sample.uploadedScreenshots;
  const terminal = isParallelWorkerTerminal(worker);
  const stale = !lastSample || sample.elapsedMs - lastSample.elapsedMs >= 2000;

  if (!lastSample || changed || stale || (terminal && lastSample.elapsedMs !== sample.elapsedMs)) {
    worker.timeline.push(sample);
  }

  if (worker.timeline.length > 120) {
    worker.timeline.splice(0, worker.timeline.length - 120);
  }

  return worker.timeline;
}

function createParallelLocalizedScreenshotRunSnapshot(run) {
  const now = Date.now();
  const workers = run.workers.map(worker => {
    const progress = worker.progress || {};
    const progressIsAudit = isParallelLocalizedScreenshotAuditPhase(progress.phase);
    const completedLocales = Number.isFinite(worker.completedLocales)
      ? worker.completedLocales
      : Number(progress.completedLocales || 0);
    const failedLocales = Number.isFinite(worker.failedLocales)
      ? worker.failedLocales
      : Number(progress.failedLocales || 0);
    const skippedLocales = Number.isFinite(worker.skippedLocales)
      ? worker.skippedLocales
      : Number(progress.skippedLocales || 0);
    const uploadedScreenshots = Number.isFinite(worker.uploadedScreenshots)
      ? worker.uploadedScreenshots
      : Number(progress.uploadedScreenshots || 0);
    const progressAuditedLocales = Number(progress.auditedLocales || (progressIsAudit ? progress.completedLocales || 0 : 0));
    const auditedLocales = Number.isFinite(worker.auditedLocales)
      ? worker.auditedLocales
      : progressAuditedLocales;
    const auditTotalLocales = Number.isFinite(worker.auditTotalLocales)
      ? worker.auditTotalLocales
      : progressIsAudit
        ? Number(progress.totalLocales || 0)
        : auditedLocales ? completedLocales : 0;

    const snapshotWorker = {
      workerId: worker.workerId,
      tabId: worker.tabId,
      operation: worker.operation || "",
      status: worker.status,
      closed: Boolean(worker.closed),
      closeable: worker.status === "completed",
      assignedLocales: worker.assignedLocales,
      assignedCount: worker.assignedLocales.length,
      totalScreenshots: worker.totalScreenshots,
      currentLocale: progress.locale || worker.currentLocale || "",
      phase: progress.phase || worker.phase || "",
      completedLocales,
      failedLocales,
      skippedLocales,
      uploadedScreenshots,
      failedLocaleList: worker.failedLocaleList || [],
      skippedLocaleList: worker.skippedLocaleList || [],
      auditedLocaleList: worker.auditedLocaleList || [],
      auditedLocales,
      auditTotalLocales,
      actionLogCount: Array.isArray(worker.actionLog) ? worker.actionLog.length : 0,
      mutationGateWaiting: Boolean(worker.mutationGateWaiting),
      mutationGateWaitingSince: worker.mutationGateWaitingSince || 0,
      mutationGateRequest: worker.mutationGateRequest || null,
      currentMutationLease: worker.currentMutationLease || null,
      message: worker.message || "",
      startedAt: worker.startedAt || 0,
      finishedAt: worker.finishedAt || 0,
      elapsedMs: getWorkerElapsedMs(worker, now),
      elapsedLabel: formatParallelLocalizedScreenshotElapsed(getWorkerElapsedMs(worker, now))
    };
    snapshotWorker.timeline = recordParallelLocalizedScreenshotWorkerTimelineSample(worker, snapshotWorker, now);
    return snapshotWorker;
  });

  const totals = workers.reduce((summary, worker) => {
    summary.completedLocales += worker.completedLocales;
    summary.failedLocales += worker.failedLocales;
    summary.skippedLocales += worker.skippedLocales;
    summary.uploadedScreenshots += worker.uploadedScreenshots;
    summary.auditedLocales += worker.auditedLocales || 0;
    summary.auditTotalLocales += worker.auditTotalLocales || (worker.auditedLocales ? worker.completedLocales : 0);
    if (!run.totalScreenshots) {
    summary.totalScreenshots += worker.totalScreenshots;
    }
    if (!run.totalLocales) {
      summary.totalLocales += worker.assignedCount;
    }
    return summary;
  }, {
    completedLocales: run.mode === PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD && run.phase === "clearing"
      ? Number(run.initialClearedLocales || 0)
      : Number(run.initialCompletedLocales || 0),
    failedLocales: 0,
    skippedLocales: run.initialSkippedLocales || 0,
    uploadedScreenshots: 0,
    auditedLocales: 0,
    auditTotalLocales: 0,
    totalScreenshots: run.totalScreenshots || 0,
    totalLocales: run.totalLocales || 0
  });
  const localeStatuses = (run.localeStatusOrder || [])
    .map(locale => run.localeStatuses && run.localeStatuses[locale])
    .filter(Boolean);
  const timeline = recordParallelLocalizedScreenshotTimelineSample(run, totals, localeStatuses, now);
  const resumeLocales = getParallelLocalizedScreenshotResumeLocales(run);

  return {
    runId: run.runId,
    status: run.status,
    mode: run.mode || PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD,
    phase: run.phase || "",
    parentTabId: run.parentTabId,
    parentUrl: run.parentUrl,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt || 0,
    elapsedMs: getParallelRunElapsedMs(run, now),
    elapsedLabel: formatParallelLocalizedScreenshotElapsed(getParallelRunElapsedMs(run, now)),
    closeSuccessfulWorkers: run.closeSuccessfulWorkers,
    abortRequested: Boolean(run.abortRequested),
    manualAbortRequested: Boolean(run.manualAbortRequested),
    requestedOptions: run.requestedOptions || {},
    preClearedLocales: run.preClearedLocales || [],
    resumeLocales,
    canResume: (!isParallelLocalizedScreenshotRunActiveStatus(run) || run.abortRequested || run.status === "aborting") &&
      resumeLocales.length > 0,
    workerCount: workers.length,
    workers,
    mutationGate: getParallelLocalizedScreenshotMutationGateSnapshot(run, now),
    localeStatuses,
    timeline,
    totals,
    skipped: run.initialSkipped || [],
    actionLogCount: Array.isArray(run.actionLog) ? run.actionLog.length : 0,
    message: run.message || ""
  };
}
