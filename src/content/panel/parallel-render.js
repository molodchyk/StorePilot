function getParallelLocalizedScreenshotRetryLocales(run) {
  const failedLocales = [];
  const normalize = value => typeof normalizeLocale === "function"
    ? normalizeLocale(value)
    : String(value || "").replace(/-/g, "_").toLowerCase();

  for (const status of run && run.localeStatuses || []) {
    if (status && (status.status === "failed" || status.status === "aborted")) {
      failedLocales.push(status.locale);
    }
  }

  if (!failedLocales.length) {
    for (const worker of run && run.workers || []) {
      if ((worker.failedLocaleList || []).length) {
        failedLocales.push(...worker.failedLocaleList);
        continue;
      }

      if (worker.status === "failed" || worker.status === "aborted") {
        const skippedSet = new Set((worker.skippedLocaleList || []).map(normalize));
        for (const locale of worker.assignedLocales || []) {
          if (!skippedSet.has(normalize(locale))) {
            failedLocales.push(locale);
          }
        }
      }
    }
  }

  const seen = new Set();
  return failedLocales
    .map(normalize)
    .filter(locale => {
      if (!locale || seen.has(locale)) return false;
      seen.add(locale);
      return true;
    });
}

function getParallelLocalizedScreenshotResumeLocales(run) {
  const normalize = value => typeof normalizeLocale === "function"
    ? normalizeLocale(value)
    : String(value || "").replace(/-/g, "_").toLowerCase();
  const resumeLocales = Array.isArray(run && run.resumeLocales)
    ? run.resumeLocales.slice()
    : [];
  const skippedLocales = new Set();
  const completedLocales = new Set();

  for (const status of run && run.localeStatuses || []) {
    const locale = normalize(status && status.locale || "");
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
    const workerCompleted = new Set((worker.completedLocaleList || []).map(normalize));
    const workerSkipped = new Set((worker.skippedLocaleList || []).map(normalize));
    const completedNeedsUpload = run &&
      run.mode === "clearThenUpload" &&
      worker.operation === "clearOnly";
    for (const localeValue of worker.assignedLocales || []) {
      const locale = normalize(localeValue);
      if (!locale || skippedLocales.has(locale) || workerSkipped.has(locale)) continue;
      if (completedLocales.has(locale) || (!completedNeedsUpload && workerCompleted.has(locale))) continue;
      resumeLocales.push(locale);
    }
  }

  const seen = new Set();
  return resumeLocales
    .map(normalize)
    .filter(locale => {
      if (!locale || seen.has(locale)) return false;
      seen.add(locale);
      return true;
    });
}


function getParallelLocalizedScreenshotModeChoices() {
  return [
    {
      mode: "coordinated",
      label: "Coordinated replace",
      description: "Clear assigned locales first, then upload them. Best default when rebuilding a whole range."
    },
    {
      mode: "replace",
      label: "Per-locale replace",
      description: "Clear and upload one locale at a time. Easier to inspect, but less coordinated."
    },
    {
      mode: "clear",
      label: "Clear only",
      description: "Only delete localized screenshots. Use before a separate upload-only run."
    },
    {
      mode: "upload",
      label: "Upload only",
      description: "Add missing screenshots without clearing. Useful for continuing an already-clean range."
    }
  ];
}

function getParallelLocalizedScreenshotUploadOptions(panel, status) {
  return new Promise(resolve => {
    const existing = panel.querySelector(".storepilot-parallel-mode-picker");
    if (existing) existing.remove();

    const picker = document.createElement("div");
    const titleElement = document.createElement("div");
    const form = document.createElement("div");
    const workerLabel = document.createElement("label");
    const workerInput = document.createElement("input");
    const startLabel = document.createElement("label");
    const startInput = document.createElement("input");
    const choices = document.createElement("div");
    const actions = document.createElement("div");
    const startButton = createButton("Start parallel run", () => {
      cleanup();
      resolve({
        workerCount: Math.min(Math.max(Number.parseInt(workerInput.value, 10) || 2, 1), 6),
        parallelMode: selectedMode,
        localizedScreenshotsStartLocale: startInput.value.trim(),
        closeSuccessfulWorkers: true
      });
    });
    const cancelButton = createButton("Cancel", () => {
      cleanup();
      resolve(null);
    });
    let selectedMode = "coordinated";

    function cleanup() {
      document.removeEventListener("keydown", onKeyDown);
      picker.remove();
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        cleanup();
        resolve(null);
      }
    }

    function selectMode(mode) {
      selectedMode = mode;
      Array.from(choices.querySelectorAll("button")).forEach(button => {
        button.setAttribute("aria-pressed", button.dataset.mode === selectedMode ? "true" : "false");
      });
    }

    picker.className = "storepilot-parallel-mode-picker";
    titleElement.className = "storepilot-parallel-mode-picker-title";
    form.className = "storepilot-parallel-mode-form";
    choices.className = "storepilot-parallel-mode-choices";
    actions.className = "storepilot-parallel-mode-actions";
    titleElement.textContent = "Parallel localized screenshots";

    workerLabel.textContent = "Workers";
    workerInput.type = "number";
    workerInput.min = "1";
    workerInput.max = "6";
    workerInput.step = "1";
    workerInput.value = "2";

    startLabel.textContent = "Start locale";
    startInput.type = "text";
    startInput.placeholder = "Optional";
    startInput.value = typeof getCurrentDashboardLocale === "function" ? getCurrentDashboardLocale() || "" : "";

    for (const choice of getParallelLocalizedScreenshotModeChoices()) {
      const button = createButton("", () => selectMode(choice.mode));
      const label = document.createElement("span");
      const description = document.createElement("span");
      button.className = "storepilot-parallel-mode-choice";
      button.dataset.mode = choice.mode;
      button.setAttribute("aria-pressed", choice.mode === selectedMode ? "true" : "false");
      label.className = "storepilot-parallel-mode-choice-label";
      description.className = "storepilot-parallel-mode-choice-description";
      label.textContent = choice.label;
      description.textContent = choice.description;
      button.append(label, description);
      choices.append(button);
    }

    actions.append(startButton, cancelButton);
    form.append(workerLabel, workerInput, startLabel, startInput);
    picker.append(titleElement, form, choices, actions);
    panel.insertBefore(picker, status);
    document.addEventListener("keydown", onKeyDown);
    workerInput.focus();
  });
}

function createParallelLocalizedScreenshotBoard() {
  const board = document.createElement("div");
  const titleElement = document.createElement("div");
  const summary = document.createElement("div");
  const chart = document.createElement("div");
  const localeStatuses = document.createElement("div");
  const workers = document.createElement("div");
  const boardActions = document.createElement("div");
  const abortParallelButton = createButton(localize("abortParallelLocalizedScreenshots", "Abort parallel run"), async () => {
    const run = getParallelLocalizedScreenshotRunState();
    if (!run || !run.runId) {
      status.textContent = localize("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.");
      return;
    }
    if (typeof window.confirm === "function") {
      const confirmed = window.confirm(localize(
        "abortParallelLocalizedScreenshotsConfirm",
        "Abort the parallel localized screenshot run? Worker tabs finish the current dashboard action, then StorePilot can resume unfinished locales."
      ));
      if (!confirmed) return;
    }

    const response = await storePilotRuntimeSendMessage({
      type: "storepilot-abort-localized-screenshot-parallel-upload",
      runId: run.runId
    });
    if (response && response.run) {
      updateParallelLocalizedScreenshotRunState(response.run);
    }
    status.textContent = response && response.message || localize("fillAllAbortRequested", "Abort requested. StorePilot stops after the current dashboard step.");
  });
  const resumeRunButton = createButton(localize("resumeLocalizedScreenshotsRun", "Resume run"), async () => {
    const run = getParallelLocalizedScreenshotRunState();
    if (!run || !run.runId) {
      status.textContent = localize("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.");
      return;
    }

    const resumeLocales = getParallelLocalizedScreenshotResumeLocales(run);
    if (!resumeLocales.length) {
      status.textContent = localize("parallelLocalizedScreenshotsNoResumeLocales", "No unfinished localized screenshot locales to resume.");
      return;
    }

    const requestedOptions = run.requestedOptions || {};
    const requestedWorkerCount = Number.parseInt(String(
      requestedOptions.workerCount || run.workerCount || (run.workers || []).length || 1
    ), 10) || 1;
    const response = await storePilotRuntimeSendMessage({
      type: "storepilot-resume-localized-screenshot-parallel-upload",
      runId: run.runId,
      options: {
        assignedLocales: resumeLocales,
        workerCount: Math.min(Math.max(requestedWorkerCount, 1), resumeLocales.length),
        parallelMode: requestedOptions.parallelMode || run.mode || "clearThenUpload",
        closeSuccessfulWorkers: requestedOptions.closeSuccessfulWorkers !== false && run.closeSuccessfulWorkers !== false
      }
    });
    if (response && response.run) {
      updateParallelLocalizedScreenshotRunState(response.run);
    }
    status.textContent = response && response.message || localize("parallelLocalizedScreenshotsStarting", "Starting parallel localized screenshot upload.");
  });
  const retryFailedButton = createButton(localize("retryFailedLocalizedScreenshots", "Retry failed locales"), async () => {
    const run = getParallelLocalizedScreenshotRunState();
    if (!run || !run.runId) {
      status.textContent = localize("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.");
      return;
    }

    const response = await storePilotRuntimeSendMessage({
      type: "storepilot-retry-localized-screenshot-parallel-failed",
      runId: run.runId,
      options: {
        assignedLocales: getParallelLocalizedScreenshotRetryLocales(run),
        workerCount: run.workerCount || (run.workers || []).length || 1,
        parallelMode: run.mode || "clearThenUpload",
        closeSuccessfulWorkers: run.closeSuccessfulWorkers !== false
      }
    });
    if (response && response.run) {
      updateParallelLocalizedScreenshotRunState(response.run);
    }
    status.textContent = response && response.message || localize("parallelLocalizedScreenshotsNoFailedLocales", "No failed localized screenshot locales to retry.");
  });
  const downloadLogButton = createButton(localize("downloadLocalizedScreenshotLog", "Download log"), async () => {
    const run = getParallelLocalizedScreenshotRunState();
    if (!run || !run.runId) {
      status.textContent = localize("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.");
      return;
    }

    const response = await storePilotRuntimeSendMessage({
      type: "storepilot-get-localized-screenshot-parallel-log",
      runId: run.runId
    });
    if (response && response.ok && response.log) {
      downloadJsonFile(response.filename, response.log);
      status.textContent = localize("localizedScreenshotLogDownloaded", "Localized screenshot log downloaded.");
      return;
    }
    status.textContent = response && response.message || localize("parallelLocalizedScreenshotsNoRun", "No parallel localized screenshot run found.");
  });

  board.className = "storepilot-parallel-board";
  titleElement.className = "storepilot-parallel-board-title";
  summary.className = "storepilot-parallel-board-summary";
  chart.className = "storepilot-parallel-chart";
  localeStatuses.className = "storepilot-parallel-locales";
  workers.className = "storepilot-parallel-workers";
  boardActions.className = "storepilot-parallel-board-actions";
  titleElement.textContent = localize("parallelLocalizedScreenshotsTitle", "Parallel localized screenshots");
  abortParallelButton.dataset.storepilotAction = "abort-localizedScreenshotsParallel";
  abortParallelButton.className = "storepilot-danger";
  resumeRunButton.dataset.storepilotAction = "resume-localizedScreenshotsParallel";
  retryFailedButton.dataset.storepilotAction = "retry-localizedScreenshotsParallel";
  downloadLogButton.dataset.storepilotAction = "download-localizedScreenshotsParallelLog";
  abortParallelButton.hidden = true;
  resumeRunButton.hidden = true;
  retryFailedButton.hidden = true;
  downloadLogButton.hidden = true;
  board.hidden = true;
  boardActions.append(abortParallelButton, resumeRunButton, retryFailedButton, downloadLogButton);
  board.append(titleElement, summary, chart, localeStatuses, workers, boardActions);
  return board;
}

function createLocalizedScreenshotWorkerProgressBoard() {
  const board = document.createElement("div");
  const titleElement = document.createElement("div");
  const summary = document.createElement("div");
  const chart = document.createElement("div");
  const actions = document.createElement("div");
  const retryButton = createButton(localize("retryLocalizedScreenshotWorker", "Retry this worker"), async () => {
    if (typeof retryLocalizedScreenshotWorkerFromPanel === "function") {
      await retryLocalizedScreenshotWorkerFromPanel();
    }
  });

  board.className = "storepilot-localized-worker-board";
  titleElement.className = "storepilot-localized-worker-title";
  summary.className = "storepilot-localized-worker-summary";
  chart.className = "storepilot-localized-worker-chart storepilot-parallel-chart";
  actions.className = "storepilot-localized-worker-actions";
  retryButton.dataset.storepilotAction = "retry-localizedScreenshotWorker";
  retryButton.hidden = true;
  titleElement.textContent = localize("localizedScreenshotWorkerProgressTitle", "Localized screenshot progress");
  board.hidden = true;
  actions.append(retryButton);
  board.append(titleElement, summary, chart, actions);
  return board;
}
