const FILL_ALL_STATUS_STORAGE_KEY = "storePilotFillAllStatus";
var STOREPILOT_API = globalThis.STOREPILOT_API || globalThis.browser || globalThis.chrome;

function t(key, fallback, substitutions) {
  return storePilotText(key, fallback, substitutions);
}

if (STOREPILOT_API) {
  storePilotTabsQuery({ active: true, currentWindow: true }).then(([tab]) => {
    const ownOrigin = new URL(storePilotRuntimeGetUrl("")).origin;
    const url = tab && tab.url ? tab.url : "";
    if (!storePilotIsDeveloperDashboardUrl(url) || url.startsWith(ownOrigin)) {
      window.close();
    }
  }).catch(() => {});
}

const elements = {
  summary: document.getElementById("summary"),
  status: document.getElementById("status"),
  projectSelect: document.getElementById("projectSelect"),
  importFolder: document.getElementById("importFolder"),
  fillCurrentLanguage: document.getElementById("fillCurrentLanguage"),
  fillAllLanguages: document.getElementById("fillAllLanguages"),
  selectCategory: document.getElementById("selectCategory"),
  fillAdditionalFields: document.getElementById("fillAdditionalFields"),
  uploadStoreIcon: document.getElementById("uploadStoreIcon"),
  uploadScreenshots: document.getElementById("uploadScreenshots"),
  uploadLocalizedScreenshots: document.getElementById("uploadLocalizedScreenshots"),
  uploadLocalizedScreenshotsParallel: document.getElementById("uploadLocalizedScreenshotsParallel"),
  uploadGlobalPromoVideo: document.getElementById("uploadGlobalPromoVideo"),
  uploadSmallPromo: document.getElementById("uploadSmallPromo"),
  uploadMarqueePromo: document.getElementById("uploadMarqueePromo"),
  clearStoreIcon: document.getElementById("clearStoreIcon"),
  clearScreenshots: document.getElementById("clearScreenshots"),
  clearSmallPromo: document.getElementById("clearSmallPromo"),
  clearMarqueePromo: document.getElementById("clearMarqueePromo"),
  fillSinglePurpose: document.getElementById("fillSinglePurpose"),
  fillPrivacy: document.getElementById("fillPrivacy"),
  fillDataUsage: document.getElementById("fillDataUsage"),
  diagnosePrivacyPage: document.getElementById("diagnosePrivacyPage"),
  abortFillAll: document.getElementById("abortFillAll"),
  openPanel: document.getElementById("openPanel"),
  utilityActions: document.getElementById("utilityActions"),
  openOptionsShortcut: document.getElementById("openOptionsShortcut"),
  diagnostics: document.getElementById("diagnostics"),
  diagnosticsText: document.getElementById("diagnosticsText"),
  listingGroups: Array.from(document.querySelectorAll("[data-popup-section='listing']")),
  privacyGroups: Array.from(document.querySelectorAll("[data-popup-section='privacy']"))
};

let isPopupFillAllRunning = false;
let fillAllStatusPollId = 0;
let isPopupMediaRunning = false;

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function setDiagnostics(details) {
  if (!details) {
    elements.diagnostics.hidden = true;
    elements.diagnosticsText.textContent = "";
    return;
  }

  elements.diagnostics.hidden = false;
  elements.diagnostics.open = true;
  elements.diagnosticsText.textContent = typeof details === "string"
    ? details
    : JSON.stringify(details, null, 2);
}

function formatError(error) {
  if (!error) return "";
  return error.message || String(error);
}

function getPopupMediaButtons() {
  return [
    elements.uploadStoreIcon,
    elements.uploadScreenshots,
    elements.uploadLocalizedScreenshots,
    elements.uploadLocalizedScreenshotsParallel,
    elements.uploadGlobalPromoVideo,
    elements.uploadSmallPromo,
    elements.uploadMarqueePromo,
    elements.clearStoreIcon,
    elements.clearScreenshots,
    elements.clearSmallPromo,
    elements.clearMarqueePromo
  ].filter(Boolean);
}

function getPopupListingActionControls() {
  return [
    elements.fillCurrentLanguage,
    elements.fillAllLanguages,
    elements.selectCategory,
    elements.fillAdditionalFields,
    elements.uploadStoreIcon,
    elements.uploadScreenshots,
    elements.uploadLocalizedScreenshots,
    elements.uploadLocalizedScreenshotsParallel,
    elements.uploadGlobalPromoVideo,
    elements.uploadSmallPromo,
    elements.uploadMarqueePromo,
    elements.clearStoreIcon,
    elements.clearScreenshots,
    elements.clearSmallPromo,
    elements.clearMarqueePromo
  ].filter(Boolean);
}

function setPopupListingActionsVisible(isVisible) {
  elements.listingGroups.forEach(group => {
    group.hidden = !isVisible;
  });
}

function getPopupPrivacyActionControls() {
  return [
    elements.fillSinglePurpose,
    elements.fillPrivacy,
    elements.fillDataUsage,
    elements.diagnosePrivacyPage
  ].filter(Boolean);
}

function setPopupPrivacyActionsVisible(isVisible) {
  elements.privacyGroups.forEach(group => {
    group.hidden = !isVisible;
  });
}

function syncUtilityActionsVisibility() {
  elements.utilityActions.hidden = Boolean(elements.abortFillAll.hidden && elements.openPanel.hidden);
}

function setPopupMediaRunning(isRunning, title = "") {
  isPopupMediaRunning = isRunning;
  getPopupMediaButtons().forEach(button => {
    button.disabled = isRunning || isPopupFillAllRunning;
    button.title = isRunning ? title : (isPopupFillAllRunning ? t("fillingAllLanguages", "Filling descriptions...") : "");
  });
  elements.fillCurrentLanguage.disabled = isRunning || isPopupFillAllRunning;
  elements.fillAllLanguages.disabled = isRunning || isPopupFillAllRunning;
  elements.selectCategory.disabled = isRunning || isPopupFillAllRunning;
  elements.fillAdditionalFields.disabled = isRunning || isPopupFillAllRunning;
  elements.fillCurrentLanguage.title = title || (isPopupFillAllRunning ? t("fillingAllLanguages", "Filling descriptions...") : "");
  elements.fillAllLanguages.title = title || (isPopupFillAllRunning ? t("fillingAllLanguages", "Filling descriptions...") : "");
  elements.selectCategory.title = title || (isPopupFillAllRunning ? t("fillingAllLanguages", "Filling descriptions...") : "");
  elements.fillAdditionalFields.title = title || (isPopupFillAllRunning ? t("fillingAllLanguages", "Filling descriptions...") : "");
  elements.abortFillAll.hidden = !(isPopupFillAllRunning || isPopupMediaRunning);
  elements.abortFillAll.disabled = false;
  syncUtilityActionsVisibility();
}

function renderProjectSelect(projects, activeProjectId) {
  const activeProject = projects.find(project => project.id === activeProjectId) || null;
  elements.projectSelect.replaceChildren(...storePilotSortProjects(projects).map(project => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    option.selected = project.id === activeProjectId;
    return option;
  }));

  elements.projectSelect.disabled = !projects.length;
}

function formatMediaSummary(projectOrResult) {
  return typeof storePilotFormatMediaSummary === "function"
    ? storePilotFormatMediaSummary(projectOrResult && projectOrResult.mediaAssets)
    : "";
}

function formatPrivacyDocSummary(projectOrResult) {
  return typeof storePilotFormatPrivacyDocSummary === "function"
    ? storePilotFormatPrivacyDocSummary(projectOrResult && projectOrResult.privacyDoc)
    : "";
}

function hasPrivacyDocFile(projectOrResult) {
  return Boolean(projectOrResult && projectOrResult.privacyDoc && projectOrResult.privacyDoc.file);
}

async function refreshSummary() {
  const {
    projects,
    project: activeProject,
    dashboardExtensionId
  } = await resolvePopupProject();
  const count = activeProject ? storePilotGetProjectLocaleCount(activeProject) : 0;
  const updatedAt = activeProject ? storePilotFormatDisplayTimestamp(activeProject.lastSyncedAt) : t("never", "Never");

  renderProjectSelect(projects, activeProject && activeProject.id);
  elements.summary.textContent = activeProject && dashboardExtensionId
    ? t("popupDashboardProjectSummary", "$1 listing locale(s) in $2 for this dashboard item. Last updated on $3.", [String(count), activeProject.name, updatedAt])
    : activeProject
    ? t("popupSummary", "$1 listing locale(s) in $2. Last updated on $3.", [String(count), activeProject.name, updatedAt])
    : t("noProjectsYet", "No projects yet");
  updateMediaActionState().catch(() => {});
  updateOpenPanelButtonState().catch(() => {
    elements.openPanel.hidden = true;
    syncUtilityActionsVisibility();
  });
}

function setPopupFillAllRunning(isRunning) {
  isPopupFillAllRunning = isRunning;
  elements.fillCurrentLanguage.disabled = isRunning || isPopupMediaRunning;
  elements.fillAllLanguages.disabled = isRunning || isPopupMediaRunning;
  elements.selectCategory.disabled = isRunning || isPopupMediaRunning;
  elements.fillAdditionalFields.disabled = isRunning || isPopupMediaRunning;
  elements.fillCurrentLanguage.title = isRunning ? t("fillingAllLanguages", "Filling descriptions...") : "";
  elements.fillAllLanguages.title = isRunning ? t("fillingAllLanguages", "Filling descriptions...") : "";
  elements.selectCategory.title = isRunning ? t("fillingAllLanguages", "Filling descriptions...") : "";
  elements.fillAdditionalFields.title = isRunning ? t("fillingAllLanguages", "Filling descriptions...") : "";
  elements.abortFillAll.hidden = !(isRunning || isPopupMediaRunning);
  elements.abortFillAll.disabled = false;
  syncUtilityActionsVisibility();
  getPopupMediaButtons().forEach(button => {
    button.disabled = isRunning;
    button.title = isRunning ? t("fillingAllLanguages", "Filling descriptions...") : "";
  });
  if (!isRunning && !isPopupMediaRunning) {
    elements.fillCurrentLanguage.disabled = false;
    elements.fillAllLanguages.disabled = false;
    elements.selectCategory.disabled = false;
    elements.fillAdditionalFields.disabled = false;
    elements.fillCurrentLanguage.title = "";
    elements.fillAllLanguages.title = "";
    elements.selectCategory.title = "";
    elements.fillAdditionalFields.title = "";
  }

  if (isRunning) {
    startFillAllStatusPolling();
  } else {
    stopFillAllStatusPolling();
  }
}

function applyFillAllStatus(status) {
  if (!status) return;

  setPopupFillAllRunning(Boolean(status.running));
  if (status.message) {
    setStatus(status.message, false);
  }
}

function startFillAllStatusPolling() {
  if (fillAllStatusPollId) return;

  fillAllStatusPollId = setInterval(() => {
    refreshFillAllStatus().catch(() => {});
  }, 500);
}

function stopFillAllStatusPolling() {
  if (!fillAllStatusPollId) return;

  clearInterval(fillAllStatusPollId);
  fillAllStatusPollId = 0;
}

async function getStoredFillAllStatus() {
  const stored = await storePilotStorageLocalGet(FILL_ALL_STATUS_STORAGE_KEY);
  return stored[FILL_ALL_STATUS_STORAGE_KEY] || null;
}

async function refreshFillAllStatus() {
  const result = await sendToActiveTab("storepilot-get-fill-all-status");

  if (result.ok && result.status) {
    applyFillAllStatus(result.status);
    return;
  }

  const storedStatus = await getStoredFillAllStatus();
  if (storedStatus) {
    applyFillAllStatus(storedStatus);
  }
}

async function diagnoseActiveTab() {
  const result = await sendToActiveTab("storepilot-diagnose");
  setStatus(result.message || (result.ok ? t("diagnosticsComplete", "Diagnostics complete.") : t("diagnosticsFailed", "Diagnostics failed.")), !result.ok);
  setDiagnostics(result.diagnostics || result);
}

function showActionResult(result) {
  const isExpectedStop = Boolean(result && result.aborted);
  setStatus(result.message || (result.ok || isExpectedStop ? t("done", "Done.") : t("failed", "Failed.")), !result.ok && !isExpectedStop);
  setDiagnostics(result.ok || isExpectedStop ? null : result.diagnostics || result);
}

elements.projectSelect.addEventListener("change", async event => {
  const projectId = event.target.value;
  const tab = await getActiveTab().catch(() => null);
  const dashboardExtensionId = tab && typeof storePilotGetDashboardExtensionIdFromUrl === "function"
    ? storePilotGetDashboardExtensionIdFromUrl(tab.url || "")
    : "";

  if (dashboardExtensionId && typeof storePilotBindDashboardProject === "function") {
    const selectedProject = (await storePilotGetProjectsState()).projects.find(project => project.id === projectId);
    await storePilotBindDashboardProject(dashboardExtensionId, projectId, {
      dashboardItemTitle: "",
      source: "manual"
    });
    await sendToActiveTab("storepilot-reload").catch(() => null);
    setStatus(t("dashboardProjectLinked", "Linked this dashboard item to $1.", [selectedProject ? selectedProject.name : t("selectedProject", "Selected project")]));
  } else {
    await storePilotSetActiveProject(projectId);
    setStatus(t("projectSelected", "Project selected."));
  }

  await refreshSummary();
});

elements.fillCurrentLanguage.addEventListener("click", async () => {
  if (isPopupMediaRunning) return;

  const result = await sendToActiveTab("storepilot-fill-current-language");
  showActionResult(result);
});

elements.fillAllLanguages.addEventListener("click", async () => {
  if (isPopupFillAllRunning || isPopupMediaRunning) return;

  setPopupFillAllRunning(true);
  setStatus(t("fillingAllLanguages", "Filling descriptions..."));

  try {
    const result = await sendToActiveTab("storepilot-fill-all-languages");
    showActionResult(result);
  } finally {
    setPopupFillAllRunning(false);
  }
});

elements.selectCategory.addEventListener("click", async () => {
  if (isPopupFillAllRunning || isPopupMediaRunning) return;

  setStatus(t("selectingCategory", "Selecting category..."));
  const result = await sendToActiveTab("storepilot-select-category");
  showActionResult(result);
});

elements.fillAdditionalFields.addEventListener("click", async () => {
  if (isPopupFillAllRunning || isPopupMediaRunning) return;

  setStatus(t("fillingAdditionalFields", "Filling additional fields..."));
  const result = await sendToActiveTab("storepilot-fill-additional-fields");
  showActionResult(result);
});

elements.fillSinglePurpose.addEventListener("click", async () => {
  const result = await sendToActiveTab({
    type: "storepilot-fill-privacy-field",
    key: "single_purpose"
  });
  showActionResult(result);
});

elements.fillPrivacy.addEventListener("click", async () => {
  const result = await sendToActiveTab("storepilot-fill-privacy");
  showActionResult(result);
});

elements.fillDataUsage.addEventListener("click", async () => {
  setStatus(t("fillingDataUsage", "Filling data usage..."));
  const result = await sendToActiveTab("storepilot-fill-data-usage");
  showActionResult(result);
});

elements.diagnosePrivacyPage.addEventListener("click", diagnoseActiveTab);

function getLocalizedScreenshotUploadOptions() {
  if (typeof window.prompt !== "function") {
    return {};
  }

  const mediaState = window.storePilotLastPopupMediaState || {};
  const startLocale = window.prompt(
    t("localizedScreenshotsStartLocalePrompt", "Start at locale (optional; leave empty for first locale)."),
    mediaState.currentLocale || ""
  );
  if (startLocale === null) return null;

  return {
    localizedScreenshotsStartLocale: startLocale.trim()
  };
}

function getParallelLocalizedScreenshotUploadOptions() {
  if (typeof window.prompt !== "function") {
    return {
      workerCount: 2,
      parallelMode: "coordinated",
      localizedScreenshotsStartLocale: "",
      closeSuccessfulWorkers: true
    };
  }

  const workerCountInput = window.prompt(
    t("parallelLocalizedScreenshotsWorkerCountPrompt", "Worker count (1-6; default 2)."),
    "2"
  );
  if (workerCountInput === null) return null;

  const startLocale = window.prompt(
    t("parallelLocalizedScreenshotsStartLocalePrompt", "Start locale (optional; leave empty for all locales)."),
    ""
  );
  if (startLocale === null) return null;

  return {
    workerCount: Math.min(Math.max(Number.parseInt(workerCountInput, 10) || 2, 1), 6),
    parallelMode: "coordinated",
    localizedScreenshotsStartLocale: startLocale.trim(),
    closeSuccessfulWorkers: true
  };
}

async function startParallelLocalizedScreenshotsFromPopup(options) {
  const injection = await sendToActiveTab("storepilot-reload");
  if (!injection.ok) return injection;

  return storePilotRuntimeSendMessage({
    type: "storepilot-start-localized-screenshot-parallel-upload",
    requestAccess: true,
    options
  });
}

function bindMediaUploadButton(button, kind) {
  button.addEventListener("click", async () => {
    if (isPopupMediaRunning || isPopupFillAllRunning || button.disabled) return;

    const options = kind === "localizedScreenshots" ? getLocalizedScreenshotUploadOptions() : {};
    if (options === null) return;

    const uploadMessage = kind === "localizedScreenshots"
      ? t("uploadingLocalizedScreenshots", "Uploading localized screenshots...")
      : kind === "globalPromoVideo"
        ? t("pastingGlobalPromoVideo", "Pasting global promo video...")
        : t("uploadingMedia", "Uploading media...");
    setPopupMediaRunning(true, uploadMessage);
    setStatus(uploadMessage);

    try {
      showActionResult(await uploadMediaFromPopup(kind, options));
    } catch (error) {
      setStatus(t("mediaUploadFailed", "Media upload failed: $1", [formatError(error)]), true);
    } finally {
      await updateMediaActionState().catch(() => {
        setPopupMediaRunning(false);
      });
    }
  });
}

function bindParallelLocalizedScreenshotsButton(button) {
  button.addEventListener("click", async () => {
    if (isPopupMediaRunning || isPopupFillAllRunning || button.disabled) return;

    const options = getParallelLocalizedScreenshotUploadOptions();
    if (options === null) return;

    const message = t("parallelLocalizedScreenshotsStarting", "Starting parallel localized screenshot upload...");
    setPopupMediaRunning(true, message);
    setStatus(message);

    try {
      showActionResult(await startParallelLocalizedScreenshotsFromPopup(options));
    } catch (error) {
      setStatus(t("mediaUploadFailed", "Media upload failed: $1", [formatError(error)]), true);
    } finally {
      await updateMediaActionState().catch(() => {
        setPopupMediaRunning(false);
      });
    }
  });
}

bindMediaUploadButton(elements.uploadStoreIcon, "storeIcon");
bindMediaUploadButton(elements.uploadLocalizedScreenshots, "localizedScreenshots");
bindParallelLocalizedScreenshotsButton(elements.uploadLocalizedScreenshotsParallel);
bindMediaUploadButton(elements.uploadGlobalPromoVideo, "globalPromoVideo");
bindMediaUploadButton(elements.uploadScreenshots, "screenshots");
bindMediaUploadButton(elements.uploadSmallPromo, "smallPromo");
bindMediaUploadButton(elements.uploadMarqueePromo, "marqueePromo");

function bindMediaClearButton(button, kind) {
  button.addEventListener("click", async () => {
    if (isPopupMediaRunning || isPopupFillAllRunning || button.disabled) return;

    setPopupMediaRunning(true, t("clearingMedia", "Clearing media..."));
    setStatus(t("clearingMedia", "Clearing media..."));

    try {
      showActionResult(await clearMediaFromPopup(kind));
    } catch (error) {
      setStatus(t("mediaClearFailed", "Media clear failed: $1", [formatError(error)]), true);
    } finally {
      await updateMediaActionState().catch(() => {
        setPopupMediaRunning(false);
      });
    }
  });
}

bindMediaClearButton(elements.clearScreenshots, "screenshots");
bindMediaClearButton(elements.clearStoreIcon, "storeIcon");
bindMediaClearButton(elements.clearSmallPromo, "smallPromo");
bindMediaClearButton(elements.clearMarqueePromo, "marqueePromo");

elements.abortFillAll.addEventListener("click", async () => {
  elements.abortFillAll.disabled = true;
  const result = await sendToActiveTab("storepilot-abort-operation");
  if (result.ok) {
    setStatus(result.message || t("stopRequested", "Stop requested."));
  } else {
    await refreshFillAllStatus();
    if (!isPopupFillAllRunning && !isPopupMediaRunning) {
      setStatus(result.message || t("noOperationRunning", "No operation is running."));
      return;
    }
    elements.abortFillAll.disabled = false;
    setStatus(result.message || t("couldNotStopFillAll", "Could not stop the operation."), true);
  }
});

elements.openPanel.addEventListener("click", async () => {
  const result = await sendToActiveTab("storepilot-show-panel");
  showActionResult(result);
  if (result.ok) {
    elements.openPanel.hidden = true;
  }
});

function openOptionsPageFromPopup() {
  storePilotRuntimeOpenOptionsPage();
}

elements.openOptionsShortcut.addEventListener("click", openOptionsPageFromPopup);

storePilotStorageOnChangedAddListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes[STOREPILOT_SETTINGS_KEY]) {
    storePilotPopupApplySettings(changes[STOREPILOT_SETTINGS_KEY].newValue, elements);
  }

  if (changes[STOREPILOT_PROJECTS_STORAGE_KEY] || changes[STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY] || changes[STOREPILOT_DASHBOARD_PROJECT_BINDINGS_STORAGE_KEY]) {
    refreshSummary();
  }

  if (changes[FILL_ALL_STATUS_STORAGE_KEY]) {
    applyFillAllStatus(changes[FILL_ALL_STATUS_STORAGE_KEY].newValue);
  }
});

if (STOREPILOT_API) {
  storePilotRuntimeOnMessageAddListener(message => {
    if (!message || message.type !== "storepilot-fill-all-progress") {
      return;
    }

    applyFillAllStatus(message.status || {
      running: isPopupFillAllRunning,
      message: message.message || t("fillingAllLanguages", "Filling descriptions...")
    });
  });
}

async function initializePopup() {
  storePilotApplyI18n();
  storePilotPopupApplySettings(await storePilotPopupGetSettings(), elements);
  await updateDashboardSectionUi();
  await refreshSummary();
  await updateDashboardSectionUi();
  await updateOpenPanelButtonState();
  await refreshFillAllStatus();
}

initializePopup().catch(error => {
  elements.summary.textContent = t("popupInitializationFailed", "Could not load StorePilot projects.");
  setStatus(formatError(error) || t("popupInitializationFailed", "Could not load StorePilot projects."), true);
  setDiagnostics({
    action: "initialize-popup",
    error: formatError(error)
  });
});
