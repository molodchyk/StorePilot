(function () {
  const MAX_PARALLEL_LOCALIZED_SCREENSHOT_WORKERS = 6;
  const PARALLEL_LOCALIZED_SCREENSHOT_WORKER_READY_TIMEOUT_MS = 90000;
  const PARALLEL_LOCALIZED_SCREENSHOT_WORKER_READY_POLL_MS = 1000;
  const localizedScreenshotParallelRuns = new Map();

  function text(key, fallback, substitutions) {
    return typeof storePilotText === "function" ? storePilotText(key, fallback, substitutions) : substitutions
      ? substitutions.reduce((message, value, index) => message.replace(`$${index + 1}`, value), fallback)
      : fallback;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

  function splitParallelLocalizedScreenshotLocales(locales, workerCount = 2) {
    const uniqueLocales = Array.from(new Set((locales || [])
      .map(locale => normalizeParallelLocalizedScreenshotLocale(locale))
      .filter(Boolean)));
    if (!uniqueLocales.length) return [];

    const normalizedWorkerCount = Math.min(
      Math.max(Number.parseInt(String(workerCount || 2), 10) || 2, 1),
      MAX_PARALLEL_LOCALIZED_SCREENSHOT_WORKERS,
      uniqueLocales.length
    );
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

  function isParallelWorkerTerminal(worker) {
    return ["completed", "failed", "aborted"].includes(worker && worker.status);
  }

  function getWorkerElapsedMs(worker, now = Date.now()) {
    if (Number.isFinite(worker.elapsedMs)) return worker.elapsedMs;
    if (worker.startedAt) return Math.max(0, now - worker.startedAt);
    return 0;
  }

  function createParallelLocalizedScreenshotRunSnapshot(run) {
    const now = Date.now();
    const workers = run.workers.map(worker => {
      const progress = worker.progress || {};
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

      return {
        workerId: worker.workerId,
        tabId: worker.tabId,
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
        message: worker.message || "",
        elapsedMs: getWorkerElapsedMs(worker, now),
        elapsedLabel: formatParallelLocalizedScreenshotElapsed(getWorkerElapsedMs(worker, now))
      };
    });

    const totals = workers.reduce((summary, worker) => {
      summary.completedLocales += worker.completedLocales;
      summary.failedLocales += worker.failedLocales;
      summary.skippedLocales += worker.skippedLocales;
      summary.uploadedScreenshots += worker.uploadedScreenshots;
      summary.totalScreenshots += worker.totalScreenshots;
      summary.totalLocales += worker.assignedCount;
      return summary;
    }, {
      completedLocales: 0,
      failedLocales: 0,
      skippedLocales: run.initialSkippedLocales || 0,
      uploadedScreenshots: 0,
      totalScreenshots: 0,
      totalLocales: 0
    });

    return {
      runId: run.runId,
      status: run.status,
      parentTabId: run.parentTabId,
      parentUrl: run.parentUrl,
      startedAt: run.startedAt,
      elapsedMs: Math.max(0, now - run.startedAt),
      elapsedLabel: formatParallelLocalizedScreenshotElapsed(Math.max(0, now - run.startedAt)),
      closeSuccessfulWorkers: run.closeSuccessfulWorkers,
      abortRequested: Boolean(run.abortRequested),
      workerCount: workers.length,
      workers,
      totals,
      skipped: run.initialSkipped || [],
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

    return storePilotTabsSendMessage(run.parentTabId, {
      type: "storepilot-parallel-localized-screenshot-run-update",
      run: createParallelLocalizedScreenshotRunSnapshot(run)
    }).catch(() => null);
  }

  function finalizeParallelLocalizedScreenshotRunIfDone(run) {
    if (!run || !run.workers.every(isParallelWorkerTerminal)) return;

    if (run.abortRequested || run.workers.some(worker => worker.status === "aborted")) {
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
        const completedSet = new Set(worker.completedLocaleList || []);
        const skippedSet = new Set(worker.skippedLocaleList || []);
        failedLocales.push(...worker.assignedLocales.filter(locale => !completedSet.has(locale) && !skippedSet.has(locale)));
      }
    }
    return Array.from(new Set(failedLocales.filter(Boolean)));
  }

  async function closeSuccessfulParallelLocalizedScreenshotWorker(run, worker) {
    if (!run.closeSuccessfulWorkers || worker.status !== "completed") return;

    try {
      await storePilotTabsRemove(worker.tabId);
      worker.closed = true;
    } catch (error) {
      worker.closeError = error.message || String(error);
    }
  }

  async function runParallelLocalizedScreenshotWorker(run, worker, files, projectName) {
    worker.status = "running";
    worker.startedAt = Date.now();
    await sendParallelLocalizedScreenshotRunUpdate(run);

    if (run.abortRequested) {
      worker.status = "aborted";
      worker.elapsedMs = Date.now() - worker.startedAt;
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
          parallelRunId: run.runId,
          parallelWorkerId: worker.workerId
        }
      });

      const completedLocaleList = uniqueLocales(result && result.uploaded || []);
      const failedLocaleList = uniqueLocales(result && result.failed || []);
      const skippedLocaleList = uniqueLocales(result && result.skipped || []);
      const uploadedScreenshots = (result && result.uploaded || [])
        .reduce((sum, item) => sum + parseLocalizedUploadedScreenshotCount(item), 0);

      worker.result = result || null;
      worker.completedLocaleList = completedLocaleList;
      worker.failedLocaleList = failedLocaleList;
      worker.skippedLocaleList = skippedLocaleList;
      worker.completedLocales = completedLocaleList.length;
      worker.failedLocales = failedLocaleList.length;
      worker.skippedLocales = skippedLocaleList.length;
      worker.uploadedScreenshots = uploadedScreenshots || Number(worker.progress && worker.progress.uploadedScreenshots || 0);
      worker.elapsedMs = Number(result && result.elapsedMs || Date.now() - worker.startedAt);
      worker.message = result && result.message || "";

      if (result && result.aborted) {
        worker.status = "aborted";
      } else if (result && result.ok && !failedLocaleList.length) {
        worker.status = "completed";
      } else {
        worker.status = "failed";
        if (!worker.failedLocaleList.length) {
          const completedSet = new Set(worker.completedLocaleList);
          const skippedSet = new Set(worker.skippedLocaleList);
          worker.failedLocaleList = worker.assignedLocales
            .filter(locale => !completedSet.has(locale) && !skippedSet.has(locale));
          worker.failedLocales = worker.failedLocaleList.length;
        }
      }

      await closeSuccessfulParallelLocalizedScreenshotWorker(run, worker);
    } catch (error) {
      worker.status = run.abortRequested ? "aborted" : "failed";
      worker.elapsedMs = Date.now() - worker.startedAt;
      worker.message = error.message || String(error);
      worker.failedLocaleList = worker.assignedLocales.slice();
      worker.failedLocales = worker.failedLocaleList.length;
    }

    finalizeParallelLocalizedScreenshotRunIfDone(run);
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

  async function storePilotStartParallelLocalizedScreenshotUpload(sender, requestAccess = false, options = {}) {
    const tab = await getActiveDashboardTab(sender);
    if (!tab || !tab.id) {
      return { ok: false, message: text("noActiveTab", "No active tab.") };
    }
    if (typeof storePilotIsListingDashboardUrl === "function" && !storePilotIsListingDashboardUrl(tab.url || "")) {
      return { ok: false, message: text("listingActionsOnlyOnListingPage", "Listing actions are only available on the Store listing page.") };
    }

    const resolved = await resolveMediaFilesForActiveProject(requestAccess, "localizedScreenshots", tab.url || "");
    if (!resolved.ok) return resolved;

    const plan = buildParallelLocalizedScreenshotPlan(resolved.files, {
      workerCount: options.workerCount,
      startLocale: options.startLocale || options.localizedScreenshotsStartLocale || "",
      assignedLocales: options.assignedLocales
    });
    if (!plan.ok) {
      return { ok: false, message: plan.message };
    }
    if (!plan.locales.length) {
      return {
        ok: false,
        message: plan.skipped.length
          ? text("mediaSkipped", "Skipped: $1.", [plan.skipped.join(", ")])
          : text("localizedScreenshotsNoMatchingFiles", "No localized screenshot files match imported listing locales.")
      };
    }

    const run = {
      runId: createParallelLocalizedScreenshotRunId(),
      status: "starting",
      parentTabId: tab.id,
      parentUrl: tab.url || "",
      startedAt: Date.now(),
      closeSuccessfulWorkers: options.closeSuccessfulWorkers !== false,
      abortRequested: false,
      initialSkipped: plan.skipped,
      initialSkippedLocales: countParallelSkippedLocales(plan.skipped),
      message: "",
      workers: []
    };

    localizedScreenshotParallelRuns.set(run.runId, run);

    for (let index = 0; index < plan.chunks.length; index++) {
      const assignedLocales = plan.chunks[index];
      const workerTab = await storePilotTabsCreate({ url: run.parentUrl, active: false });
      run.workers.push({
        workerId: `worker-${index + 1}`,
        tabId: workerTab && workerTab.id,
        status: "opening",
        closed: false,
        assignedLocales,
        totalScreenshots: countParallelLocalizedScreenshotFiles(resolved.files, assignedLocales),
        progress: null,
        message: ""
      });
    }

    run.status = "running";
    run.message = text("parallelLocalizedScreenshotsStarted", "Parallel localized screenshot upload started.");
    await sendParallelLocalizedScreenshotRunUpdate(run);

    for (const worker of run.workers) {
      runParallelLocalizedScreenshotWorker(run, worker, resolved.files, resolved.projectName).catch(error => {
        worker.status = "failed";
        worker.message = error.message || String(error);
        worker.failedLocaleList = worker.assignedLocales.slice();
        worker.failedLocales = worker.failedLocaleList.length;
        finalizeParallelLocalizedScreenshotRunIfDone(run);
        sendParallelLocalizedScreenshotRunUpdate(run);
      });
    }

    return {
      ok: true,
      message: text(
        "parallelLocalizedScreenshotsStartedSummary",
        "Started parallel localized screenshot upload: $1 worker(s), $2 locale(s), $3 screenshot(s).",
        [String(run.workers.length), String(plan.locales.length), String(plan.totalScreenshots)]
      ),
      run: createParallelLocalizedScreenshotRunSnapshot(run)
    };
  }

  async function storePilotAbortParallelLocalizedScreenshotUpload(sender, runId = "") {
    const run = getParallelLocalizedScreenshotRunForSender(sender, runId);
    if (!run) {
      return { ok: false, message: text("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.") };
    }

    run.abortRequested = true;
    run.status = "aborting";
    run.message = text("operationStopped", "Stopped.");

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

  async function storePilotRetryParallelLocalizedScreenshotFailed(sender, runId = "") {
    const run = getParallelLocalizedScreenshotRunForSender(sender, runId);
    if (!run) {
      return { ok: false, message: text("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.") };
    }

    const failedLocales = getParallelLocalizedScreenshotFailedLocales(run);
    if (!failedLocales.length) {
      return {
        ok: false,
        message: text("parallelLocalizedScreenshotsNoFailedLocales", "No failed localized screenshot locales to retry."),
        run: createParallelLocalizedScreenshotRunSnapshot(run)
      };
    }

    return storePilotStartParallelLocalizedScreenshotUpload(sender, false, {
      workerCount: Math.min(run.workers.length || 1, failedLocales.length),
      assignedLocales: failedLocales,
      closeSuccessfulWorkers: run.closeSuccessfulWorkers
    });
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
    await sendParallelLocalizedScreenshotRunUpdate(run);

    return { ok: true };
  }

  function storePilotGetParallelLocalizedScreenshotRun(sender, runId = "") {
    const run = getParallelLocalizedScreenshotRunForSender(sender, runId);
    return run
      ? { ok: true, run: createParallelLocalizedScreenshotRunSnapshot(run) }
      : { ok: false, message: text("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.") };
  }

  globalThis.storePilotUploadMediaToDashboard = storePilotUploadMediaToDashboard;
  globalThis.storePilotStartParallelLocalizedScreenshotUpload = storePilotStartParallelLocalizedScreenshotUpload;
  globalThis.storePilotAbortParallelLocalizedScreenshotUpload = storePilotAbortParallelLocalizedScreenshotUpload;
  globalThis.storePilotRetryParallelLocalizedScreenshotFailed = storePilotRetryParallelLocalizedScreenshotFailed;
  globalThis.storePilotHandleLocalizedScreenshotProgress = storePilotHandleLocalizedScreenshotProgress;
  globalThis.storePilotGetParallelLocalizedScreenshotRun = storePilotGetParallelLocalizedScreenshotRun;
  globalThis.storePilotSplitParallelLocalizedScreenshotLocales = splitParallelLocalizedScreenshotLocales;
  globalThis.storePilotBuildParallelLocalizedScreenshotPlan = buildParallelLocalizedScreenshotPlan;
  globalThis.storePilotFilterLocalizedScreenshotFilesForAssignedLocales = filterLocalizedScreenshotFilesForAssignedLocales;
  globalThis.storePilotFormatParallelLocalizedScreenshotElapsed = formatParallelLocalizedScreenshotElapsed;
  globalThis.storePilotCreateParallelLocalizedScreenshotRunSnapshot = createParallelLocalizedScreenshotRunSnapshot;
})();
