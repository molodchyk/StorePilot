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
