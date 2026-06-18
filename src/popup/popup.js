const SETTINGS_KEY = "storePilotSettings";
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
  privacyGroups: Array.from(document.querySelectorAll("[data-popup-section='privacy']")),
  themeChoices: Array.from(document.querySelectorAll("[data-theme-choice]"))
};

let isPopupFillAllRunning = false;
let fillAllStatusPollId = 0;
let isPopupMediaRunning = false;

function applyTheme(theme) {
  const normalized = ["system", "light", "dark"].includes(theme) ? theme : "system";

  if (normalized === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = normalized;
  }

  elements.themeChoices.forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === normalized));
  });
}

async function getSettings() {
  const stored = await storePilotStorageLocalGet(SETTINGS_KEY);
  return {
    theme: "system",
    showAdvancedFillActions: false,
    ...(stored[SETTINGS_KEY] || {})
  };
}

async function updateSettings(patch) {
  const settings = {
    ...(await getSettings()),
    ...patch
  };

  await storePilotStorageLocalSet({ [SETTINGS_KEY]: settings });
  return settings;
}

function applySettings(settings = {}) {
  const normalized = {
    theme: "system",
    showAdvancedFillActions: false,
    ...settings
  };

  applyTheme(normalized.theme);
  elements.fillCurrentLanguage.hidden = !Boolean(normalized.showAdvancedFillActions);
}

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

function bindMediaUploadButton(button, kind) {
  button.addEventListener("click", async () => {
    if (isPopupMediaRunning || isPopupFillAllRunning || button.disabled) return;

    setPopupMediaRunning(true, t("uploadingMedia", "Uploading media..."));
    setStatus(t("uploadingMedia", "Uploading media..."));

    try {
      showActionResult(await uploadMediaFromPopup(kind));
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

elements.themeChoices.forEach(button => {
  button.addEventListener("click", async () => {
    const settings = await updateSettings({ theme: button.dataset.themeChoice });
    applySettings(settings);
  });
});

storePilotStorageOnChangedAddListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes[SETTINGS_KEY]) {
    applySettings(changes[SETTINGS_KEY].newValue);
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

(async () => {
  storePilotApplyI18n();
  applySettings(await getSettings());
  await updateDashboardSectionUi();
  await refreshSummary();
  await updateDashboardSectionUi();
  await updateOpenPanelButtonState();
  await refreshFillAllStatus();
})();
