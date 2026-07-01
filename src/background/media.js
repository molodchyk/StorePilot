(function () {
  const MAX_PARALLEL_LOCALIZED_SCREENSHOT_WORKERS = 6;
  const PARALLEL_LOCALIZED_SCREENSHOT_WORKER_READY_TIMEOUT_MS = 90000;
  const PARALLEL_LOCALIZED_SCREENSHOT_WORKER_READY_POLL_MS = 1000;
  const PARALLEL_LOCALIZED_SCREENSHOT_PARENT_UPDATE_TIMEOUT_MS = 1500;
  const PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD = "clearThenUpload";
  const PARALLEL_LOCALIZED_SCREENSHOT_MODE_REPLACE = "replace";
  const PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_ONLY = "clearOnly";
  const PARALLEL_LOCALIZED_SCREENSHOT_MODE_UPLOAD_ONLY = "uploadOnly";
  const PARALLEL_LOCALIZED_SCREENSHOT_MUTATION_SUCCESS_COOLDOWN_MS = 750;
  const PARALLEL_LOCALIZED_SCREENSHOT_MUTATION_ERROR_COOLDOWN_MS = 4000;
  const PARALLEL_LOCALIZED_SCREENSHOT_MUTATION_LEASE_TIMEOUT_MS = 120000;
  const PARALLEL_LOCALIZED_SCREENSHOT_ABORT_GRACE_MS = 120000;
  const PARALLEL_LOCALIZED_SCREENSHOT_LOG_STORAGE_KEY = "storePilotParallelLocalizedScreenshotLogs";
  const PARALLEL_LOCALIZED_SCREENSHOT_STORED_LOG_LIMIT = 5;
  const localizedScreenshotParallelRuns = new Map();

  function text(key, fallback, substitutions) {
    return typeof storePilotText === "function" ? storePilotText(key, fallback, substitutions) : substitutions
      ? substitutions.reduce((message, value, index) => message.replace(`$${index + 1}`, value), fallback)
      : fallback;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function setBackgroundTimer(callback, ms) {
    const timer = setTimeout(callback, ms);
    if (timer && typeof timer.unref === "function") {
      timer.unref();
    }
    return timer;
  }

  function normalizeParallelLocalizedScreenshotLocale(value) {
    const normalized = typeof storePilotNormalizeLocaleCode === "function"
      ? storePilotNormalizeLocaleCode(value)
      : String(value || "").trim().replace(/-/g, "_");
    return String(normalized || "").trim().replace(/-/g, "_").toLowerCase();
  }

  function normalizeAssignedParallelLocales(assignedLocales) {
    if (!Array.isArray(assignedLocales)) return [];

    const seen = new Set();
    const normalizedLocales = [];
    for (const locale of assignedLocales) {
      const normalizedLocale = normalizeParallelLocalizedScreenshotLocale(locale);
      if (!normalizedLocale || seen.has(normalizedLocale)) continue;
      seen.add(normalizedLocale);
      normalizedLocales.push(normalizedLocale);
    }
    return normalizedLocales;
  }

  function normalizeParallelLocalizedScreenshotMode(value) {
    const normalized = String(value || "")
      .trim()
      .replace(/[\s_-]+/g, "")
      .toLowerCase();

    if (["replace", "fullreplace", "legacy"].includes(normalized)) {
      return PARALLEL_LOCALIZED_SCREENSHOT_MODE_REPLACE;
    }
    if (["clear", "clearonly", "delete", "deleteonly"].includes(normalized)) {
      return PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_ONLY;
    }
    if (["upload", "uploadonly", "send", "sendonly"].includes(normalized)) {
      return PARALLEL_LOCALIZED_SCREENSHOT_MODE_UPLOAD_ONLY;
    }
    return PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD;
  }

  function getParallelLocalizedScreenshotOperationForMode(mode) {
    const normalizedMode = normalizeParallelLocalizedScreenshotMode(mode);
    if (normalizedMode === PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_ONLY) return "clearOnly";
    if (normalizedMode === PARALLEL_LOCALIZED_SCREENSHOT_MODE_UPLOAD_ONLY) return "uploadOnly";
    return "replace";
  }

  function getRequestedParallelLocalizedScreenshotWorkerCount(workerCount = 2) {
    return Math.min(
      Math.max(Number.parseInt(String(workerCount || 2), 10) || 2, 1),
      MAX_PARALLEL_LOCALIZED_SCREENSHOT_WORKERS
    );
  }

  function getParallelLocalizedScreenshotLocales(files) {
    return Object.entries(files && files.localizedScreenshots || {})
      .filter(([_locale, localeFiles]) => (localeFiles || []).length)
      .map(([locale]) => locale)
      .sort((left, right) => normalizeParallelLocalizedScreenshotLocale(left).localeCompare(normalizeParallelLocalizedScreenshotLocale(right)));
  }

  function countParallelLocalizedScreenshotFiles(files, locales) {
    const localizedScreenshots = files && files.localizedScreenshots || {};
    return locales.reduce((sum, locale) => {
      const matchedLocale = Object.keys(localizedScreenshots)
        .find(candidate => normalizeParallelLocalizedScreenshotLocale(candidate) === normalizeParallelLocalizedScreenshotLocale(locale));
      const localeFiles = matchedLocale ? localizedScreenshots[matchedLocale] || [] : [];
      return sum + Math.min(localeFiles.length, 5);
    }, 0);
  }

  function countParallelLocalizedScreenshotFilesForLocale(files, locale) {
    return countParallelLocalizedScreenshotFiles(files, [locale]);
  }

  function splitParallelLocalizedScreenshotLocales(locales, workerCount = 2) {
    const uniqueLocales = Array.from(new Set((locales || [])
      .map(locale => normalizeParallelLocalizedScreenshotLocale(locale))
      .filter(Boolean)));
    if (!uniqueLocales.length) return [];

    const normalizedWorkerCount = Math.min(getRequestedParallelLocalizedScreenshotWorkerCount(workerCount), uniqueLocales.length);
    const baseSize = Math.floor(uniqueLocales.length / normalizedWorkerCount);
    const extraCount = uniqueLocales.length % normalizedWorkerCount;
    const chunks = [];
    let offset = 0;

    for (let index = 0; index < normalizedWorkerCount; index++) {
      const size = baseSize + (index < extraCount ? 1 : 0);
      chunks.push(uniqueLocales.slice(offset, offset + size));
      offset += size;
    }

    return chunks.filter(chunk => chunk.length);
  }

  function buildParallelLocalizedScreenshotPlan(files, options = {}) {
    const allLocales = getParallelLocalizedScreenshotLocales(files);
    let runLocales = allLocales;
    const skipped = [];
    const assignedLocales = normalizeAssignedParallelLocales(options.assignedLocales);

    if (Array.isArray(options.assignedLocales)) {
      const assignedSet = new Set(assignedLocales);
      runLocales = allLocales.filter(locale => assignedSet.has(normalizeParallelLocalizedScreenshotLocale(locale)));
      const foundSet = new Set(runLocales.map(locale => normalizeParallelLocalizedScreenshotLocale(locale)));
      skipped.push(...assignedLocales
        .filter(locale => !foundSet.has(locale))
        .map(locale => `${locale}: assigned locale has no localized screenshot files`));
    } else {
      const normalizedStartLocale = normalizeParallelLocalizedScreenshotLocale(options.startLocale || options.localizedScreenshotsStartLocale || "");
      if (normalizedStartLocale) {
        const startIndex = allLocales.findIndex(locale => normalizeParallelLocalizedScreenshotLocale(locale) === normalizedStartLocale);
        if (startIndex < 0) {
          return {
            ok: false,
            message: `start locale ${options.startLocale || options.localizedScreenshotsStartLocale} was not found in localized screenshot files`,
            locales: [],
            chunks: [],
            skipped,
            totalScreenshots: 0,
            workerCount: 0
          };
        }
        if (startIndex > 0) {
          skipped.push(`${startIndex} locale(s) before start locale ${options.startLocale || options.localizedScreenshotsStartLocale}`);
        }
        runLocales = allLocales.slice(startIndex);
      }
    }

    const normalizedRunLocales = runLocales.map(normalizeParallelLocalizedScreenshotLocale).filter(Boolean);
    const chunks = splitParallelLocalizedScreenshotLocales(normalizedRunLocales, options.workerCount);

    return {
      ok: true,
      locales: normalizedRunLocales,
      chunks,
      skipped,
      totalScreenshots: countParallelLocalizedScreenshotFiles(files, normalizedRunLocales),
      workerCount: chunks.length
    };
  }

  function filterLocalizedScreenshotFilesForAssignedLocales(files, assignedLocales) {
    const assignedSet = new Set(normalizeAssignedParallelLocales(assignedLocales));
    const localizedScreenshots = {};

    for (const [locale, localeFiles] of Object.entries(files && files.localizedScreenshots || {})) {
      if (!assignedSet.has(normalizeParallelLocalizedScreenshotLocale(locale))) continue;
      localizedScreenshots[locale] = Array.from(localeFiles || []);
    }

    return {
      storeIcon: null,
      screenshots: [],
      localizedScreenshots,
      smallPromo: null,
      marqueePromo: null
    };
  }

  function createParallelLocalizedScreenshotRunId() {
    return `localized-screenshots-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function createParallelLocalizedScreenshotLogPayload(run) {
    const actionLog = Array.isArray(run && run.actionLog)
      ? run.actionLog.slice().sort((left, right) => left.epochMs - right.epochMs || left.sequence - right.sequence)
      : [];
    return {
      exportedAt: new Date().toISOString(),
      run: createParallelLocalizedScreenshotRunSnapshot(run),
      actionLog
    };
  }

  async function getStoredParallelLocalizedScreenshotLogs() {
    if (typeof storePilotStorageLocalGet !== "function") return {};
    try {
      const stored = await storePilotStorageLocalGet(PARALLEL_LOCALIZED_SCREENSHOT_LOG_STORAGE_KEY);
      const value = stored && stored[PARALLEL_LOCALIZED_SCREENSHOT_LOG_STORAGE_KEY];
      return value && typeof value === "object" ? value : {};
    } catch (_error) {
      return {};
    }
  }

  async function persistParallelLocalizedScreenshotLog(run) {
    if (!run || !run.runId || typeof storePilotStorageLocalSet !== "function") return;

    try {
      const logs = await getStoredParallelLocalizedScreenshotLogs();
      logs[run.runId] = {
        runId: run.runId,
        parentTabId: run.parentTabId || 0,
        parentUrl: run.parentUrl || "",
        updatedAt: Date.now(),
        filename: `storepilot-localized-screenshot-log-${run.runId}.json`,
        log: createParallelLocalizedScreenshotLogPayload(run)
      };

      const keepRunIds = Object.values(logs)
        .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0))
        .slice(0, PARALLEL_LOCALIZED_SCREENSHOT_STORED_LOG_LIMIT)
        .map(item => item.runId)
        .filter(Boolean);
      const keepSet = new Set(keepRunIds);
      for (const runId of Object.keys(logs)) {
        if (!keepSet.has(runId)) {
          delete logs[runId];
        }
      }

      await storePilotStorageLocalSet({
        [PARALLEL_LOCALIZED_SCREENSHOT_LOG_STORAGE_KEY]: logs
      });
    } catch (_error) {
      // Export persistence is diagnostic-only; upload correctness must not depend on it.
    }
  }

  async function getStoredParallelLocalizedScreenshotLog(sender, runId = "") {
    const logs = await getStoredParallelLocalizedScreenshotLogs();
    if (runId && logs[runId]) {
      return logs[runId];
    }

    const parentTabId = sender && sender.tab && sender.tab.id;
    return Object.values(logs)
      .filter(item => !parentTabId || item.parentTabId === parentTabId)
      .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0))[0] || null;
  }

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
    for (const entry of gate.queue.splice(0)) {
      settleParallelLocalizedScreenshotMutationRequest(entry, {
        ok: false,
        aborted: true,
        message: text("operationStopped", "Stopped.")
      });
    }
  }

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
    const sample = {
      elapsedMs,
      completedLocales: counts.completedLocales,
      failedLocales: counts.failedLocales,
      skippedLocales: counts.skippedLocales,
      remainingLocales: counts.remainingLocales,
      uploadedScreenshots: counts.uploadedScreenshots,
      totalLocales: counts.totalLocales
    };
    const lastSample = run.timeline[run.timeline.length - 1];
    const changed = !lastSample ||
      lastSample.completedLocales !== sample.completedLocales ||
      lastSample.failedLocales !== sample.failedLocales ||
      lastSample.skippedLocales !== sample.skippedLocales ||
      lastSample.remainingLocales !== sample.remainingLocales ||
      lastSample.uploadedScreenshots !== sample.uploadedScreenshots;
    const terminal = ["completed", "failed", "aborted"].includes(run.status);
    const stale = !lastSample || sample.elapsedMs - lastSample.elapsedMs >= 2000;

    if (!lastSample || changed || stale || (terminal && lastSample.elapsedMs !== sample.elapsedMs)) {
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
        : progressIsAudit
          ? Number(progress.totalLocales || 0)
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
      const auditedLocales = Number.isFinite(worker.auditedLocales)
        ? worker.auditedLocales
        : progressIsAudit
          ? Number(progress.completedLocales || 0)
          : 0;
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
        ? (run.preClearedLocales || []).length
        : 0,
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
      canResume: !isParallelLocalizedScreenshotRunActiveStatus(run) && resumeLocales.length > 0,
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

  function normalizePathParts(path) {
    return String(path || "")
      .replace(/\\/g, "/")
      .split("/")
      .map(part => part.trim())
      .filter(Boolean);
  }

  async function getFileFromProjectPath(rootHandle, storedPath) {
    const pathParts = normalizePathParts(storedPath);
    if (pathParts[0] === rootHandle.name) {
      pathParts.shift();
    }

    if (!pathParts.length) {
      throw new Error(`Invalid media path: ${storedPath}`);
    }

    let handle = rootHandle;
    for (const part of pathParts.slice(0, -1)) {
      handle = await handle.getDirectoryHandle(part);
    }

    return (await handle.getFileHandle(pathParts[pathParts.length - 1])).getFile();
  }

  function hasResolvedMediaFiles(files, kind = "") {
    if (!files) return false;
    if ((!kind || kind === "storeIcon") && files.storeIcon) return true;
    if (!kind || kind === "screenshots") {
      if ((files.screenshots || []).length) return true;
    }
    if (!kind || kind === "localizedScreenshots") {
      if (Object.values(files.localizedScreenshots || {}).some(localeFiles => (localeFiles || []).length)) return true;
    }
    if ((!kind || kind === "smallPromo") && files.smallPromo) return true;
    if ((!kind || kind === "marqueePromo") && files.marqueePromo) return true;
    return false;
  }

  function filterLocalizedScreenshotFilesForProject(files, project) {
    const listingLocales = new Set(Object.keys(project && project.listings || {})
      .map(locale => typeof storePilotNormalizeLocaleCode === "function" ? storePilotNormalizeLocaleCode(locale) : locale));
    const localizedScreenshots = Object.fromEntries(Object.entries(files.localizedScreenshots || {})
      .filter(([locale, localeFiles]) => {
        const normalizedLocale = typeof storePilotNormalizeLocaleCode === "function" ? storePilotNormalizeLocaleCode(locale) : locale;
        return listingLocales.has(normalizedLocale) && (localeFiles || []).length;
      })
      .map(([locale, localeFiles]) => [locale, Array.from(localeFiles || [])]));

    return {
      ...files,
      localizedScreenshots
    };
  }

  async function resolveMediaFilesForActiveProject(requestAccess = false, kind = "", dashboardUrl = "") {
    const state = await storePilotGetProjectsState();
    const resolved = typeof storePilotResolveProjectForDashboard === "function"
      ? await storePilotResolveProjectForDashboard({ url: dashboardUrl })
      : {};
    const project = resolved.project ||
      state.projects.find(candidate => candidate.id === state.activeProjectId) ||
      state.projects[0] ||
      null;

    if (!project) {
      return { ok: false, message: text("noActiveProject", "No active project") };
    }

    if (!project.mediaAssets) {
      return { ok: false, message: text("mediaAssetsNotScanned", "Not scanned") };
    }

    const storedMediaFiles = typeof storePilotGetProjectMediaFiles === "function"
      ? await storePilotGetProjectMediaFiles(project.id)
      : null;
    const filteredStoredMediaFiles = typeof storePilotFilterMediaFilesByKind === "function"
      ? storePilotFilterMediaFilesByKind(storedMediaFiles, kind)
      : storedMediaFiles;
    const projectFilteredStoredMediaFiles = filteredStoredMediaFiles
      ? filterLocalizedScreenshotFilesForProject(filteredStoredMediaFiles, project)
      : filteredStoredMediaFiles;

    if (hasResolvedMediaFiles(projectFilteredStoredMediaFiles, kind)) {
      return {
        ok: true,
        projectName: project.name,
        files: projectFilteredStoredMediaFiles
      };
    }

    const directoryHandle = await storePilotGetProjectHandle(project.id);
    if (!directoryHandle) {
      return { ok: false, message: text("reimportProjectFolderForMediaUpload", "Re-import the project folder so StorePilot can store the media files for upload.") };
    }

    if (!(await storePilotCanReadHandle(directoryHandle, requestAccess))) {
      return { ok: false, message: text("folderPermissionNeeded", "Folder permission is needed before reading media files.") };
    }

    const screenshots = [];
    const localizedScreenshots = {};
    const wantedStoreIcon = !kind || kind === "storeIcon";
    const wantedScreenshots = !kind || kind === "screenshots";
    const wantedLocalizedScreenshots = !kind || kind === "localizedScreenshots";
    const wantedSmallPromo = !kind || kind === "smallPromo";
    const wantedMarqueePromo = !kind || kind === "marqueePromo";

    const storeIcon = wantedStoreIcon && project.mediaAssets.storeIcon
      ? await getFileFromProjectPath(directoryHandle, project.mediaAssets.storeIcon.path)
      : null;

    for (const asset of wantedScreenshots ? project.mediaAssets.screenshots || [] : []) {
      screenshots.push(await getFileFromProjectPath(directoryHandle, asset.path));
    }

    const listingLocales = new Set(Object.keys(project.listings || {})
      .map(locale => typeof storePilotNormalizeLocaleCode === "function" ? storePilotNormalizeLocaleCode(locale) : locale));
    for (const [locale, assets] of Object.entries(wantedLocalizedScreenshots ? project.mediaAssets.localizedScreenshots || {} : {})) {
      const normalizedLocale = typeof storePilotNormalizeLocaleCode === "function" ? storePilotNormalizeLocaleCode(locale) : locale;
      if (!listingLocales.has(normalizedLocale)) continue;
      localizedScreenshots[locale] = [];
      for (const asset of assets || []) {
        localizedScreenshots[locale].push(await getFileFromProjectPath(directoryHandle, asset.path));
      }
      if (!localizedScreenshots[locale].length) {
        delete localizedScreenshots[locale];
      }
    }

    const smallPromo = wantedSmallPromo && project.mediaAssets.smallPromo
      ? await getFileFromProjectPath(directoryHandle, project.mediaAssets.smallPromo.path)
      : null;
    const marqueePromo = wantedMarqueePromo && project.mediaAssets.marqueePromo
      ? await getFileFromProjectPath(directoryHandle, project.mediaAssets.marqueePromo.path)
      : null;

    return {
      ok: true,
      projectName: project.name,
      files: {
        storeIcon,
        screenshots,
        localizedScreenshots,
        smallPromo,
        marqueePromo
      }
    };
  }

  async function getActiveDashboardTab(sender) {
    if (sender && sender.tab && sender.tab.id) {
      return sender.tab;
    }

    const tabs = await storePilotTabsQuery({ active: true, currentWindow: true });
    return tabs && tabs[0];
  }

  async function storePilotUploadMediaToDashboard(sender, requestAccess = false, kind = "", options = {}) {
    const tab = await getActiveDashboardTab(sender);
    if (!tab || !tab.id) {
      return { ok: false, message: text("noActiveTab", "No active tab.") };
    }

    const resolved = await resolveMediaFilesForActiveProject(requestAccess, kind, tab.url || "");
    if (!resolved.ok) return resolved;

    return storePilotTabsSendMessage(tab.id, {
      type: "storepilot-upload-media-assets",
      files: resolved.files,
      kind,
      projectName: resolved.projectName,
      options
    });
  }

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

  function scheduleParallelLocalizedScreenshotAbortFinalizer(run) {
    if (!run || run.abortFinalizerTimer) return;

    run.abortFinalizerTimer = setBackgroundTimer(() => {
      Promise.resolve()
        .then(async () => {
          run.abortFinalizerTimer = 0;
          if (!run.abortRequested || !isParallelLocalizedScreenshotRunActiveStatus(run)) return;

          for (const worker of run.workers || []) {
            if (isParallelWorkerTerminal(worker)) continue;

            worker.status = "aborted";
            worker.elapsedMs = worker.startedAt ? Date.now() - worker.startedAt : Number(worker.elapsedMs || 0);
            worker.finishedAt = worker.startedAt ? worker.startedAt + worker.elapsedMs : Date.now();
            worker.message = text("parallelLocalizedScreenshotsAbortTimeout", "Abort completed after waiting for worker tabs.");
            const resumeSet = new Set([
              ...(worker.failedLocaleList || []),
              ...getParallelLocalizedScreenshotWorkerRetryLocales(worker, run)
            ].filter(Boolean));
            worker.failedLocaleList = Array.from(resumeSet);
            worker.failedLocales = worker.failedLocaleList.length;

            for (const locale of worker.failedLocaleList) {
              updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
                status: "aborted",
                operation: worker.operation || "",
                workerId: worker.workerId,
                phase: run.phase || "",
                message: worker.message
              });
            }
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

      const completedStatus = worker.operation === "clearOnly" &&
        run.mode === PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD &&
        run.phase === "clearing"
        ? "cleared"
        : "completed";
      const auditedSet = new Set(worker.auditedLocaleList || []);
      for (const locale of worker.completedLocaleList) {
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

      run.totalLocales = plan.locales.length;
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
      const localeStatusState = createParallelLocalizedScreenshotLocaleStatusState(resolved.files, plan.locales);
      run.localeStatusOrder = localeStatusState.order;
      run.localeStatuses = localeStatusState.statuses;
      for (const locale of run.preClearedLocales) {
        updateParallelLocalizedScreenshotLocaleStatus(run, locale, {
          status: "cleared",
          operation: "clearOnly",
          workerId: "",
          phase: "clearedBeforeResume",
          message: "localized screenshots cleared in a previous run; upload still needed"
        });
      }

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
        existingStatus.status === "cleared";
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
      return {
        ok: false,
        message: text("parallelLocalizedScreenshotsRunning", "Parallel localized screenshot upload is running."),
        run: createParallelLocalizedScreenshotRunSnapshot(run)
      };
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
      parallelMode: options.parallelMode || requestedOptions.parallelMode || run.mode || PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD,
      closeSuccessfulWorkers: requestedOptions.closeSuccessfulWorkers !== false && run.closeSuccessfulWorkers !== false
    });
  }

  async function storePilotRetryParallelLocalizedScreenshotFailed(sender, runId = "", options = {}) {
    const run = getParallelLocalizedScreenshotRunForSender(sender, runId);
    const fallbackLocales = normalizeAssignedParallelLocales(options.assignedLocales);
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
    if (run.abortRequested || run.manualAbortRequested || ["aborting", "aborted"].includes(run.status)) {
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
      worker.auditedLocales = Math.max(Number(worker.auditedLocales || 0), progressCompletedLocales);
      worker.auditTotalLocales = Math.max(Number(worker.auditTotalLocales || 0), progressTotalLocales);
      worker.completedLocales = Math.max(
        Number.isFinite(worker.completedLocales) ? worker.completedLocales : 0,
        progressTotalLocales
      );
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

  globalThis.storePilotUploadMediaToDashboard = storePilotUploadMediaToDashboard;
  globalThis.storePilotStartParallelLocalizedScreenshotUpload = storePilotStartParallelLocalizedScreenshotUpload;
  globalThis.storePilotAbortParallelLocalizedScreenshotUpload = storePilotAbortParallelLocalizedScreenshotUpload;
  globalThis.storePilotResumeParallelLocalizedScreenshotUpload = storePilotResumeParallelLocalizedScreenshotUpload;
  globalThis.storePilotRetryParallelLocalizedScreenshotFailed = storePilotRetryParallelLocalizedScreenshotFailed;
  globalThis.storePilotRetryParallelLocalizedScreenshotWorkerTab = storePilotRetryParallelLocalizedScreenshotWorkerTab;
  globalThis.storePilotHandleLocalizedScreenshotProgress = storePilotHandleLocalizedScreenshotProgress;
  globalThis.storePilotHandleLocalizedScreenshotActionLog = storePilotHandleLocalizedScreenshotActionLog;
  globalThis.storePilotRequestLocalizedScreenshotMutation = storePilotRequestLocalizedScreenshotMutation;
  globalThis.storePilotReleaseLocalizedScreenshotMutation = storePilotReleaseLocalizedScreenshotMutation;
  globalThis.storePilotGetParallelLocalizedScreenshotRun = storePilotGetParallelLocalizedScreenshotRun;
  globalThis.storePilotGetParallelLocalizedScreenshotLog = storePilotGetParallelLocalizedScreenshotLog;
  globalThis.storePilotSplitParallelLocalizedScreenshotLocales = splitParallelLocalizedScreenshotLocales;
  globalThis.storePilotBuildParallelLocalizedScreenshotPlan = buildParallelLocalizedScreenshotPlan;
  globalThis.storePilotFilterLocalizedScreenshotFilesForAssignedLocales = filterLocalizedScreenshotFilesForAssignedLocales;
  globalThis.storePilotFormatParallelLocalizedScreenshotElapsed = formatParallelLocalizedScreenshotElapsed;
  globalThis.storePilotCreateParallelLocalizedScreenshotRunSnapshot = createParallelLocalizedScreenshotRunSnapshot;
  globalThis.storePilotNormalizeParallelLocalizedScreenshotMode = normalizeParallelLocalizedScreenshotMode;
})();
