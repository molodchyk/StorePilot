const SETTINGS_KEY = "storePilotSettings";
const POPUP_STATE_KEY = "storePilotPopupState";
const FILL_ALL_STATUS_STORAGE_KEY = "storePilotFillAllStatus";
var STOREPILOT_API = globalThis.browser || globalThis.chrome;
const STOREPILOT_IS_FIREFOX = typeof globalThis.browser !== "undefined";

function t(key, fallback, substitutions) {
  return storePilotText(key, fallback, substitutions);
}

if (STOREPILOT_IS_FIREFOX && STOREPILOT_API.tabs && STOREPILOT_API.runtime) {
  STOREPILOT_API.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    const ownOrigin = new URL(STOREPILOT_API.runtime.getURL("")).origin;
    const url = tab && tab.url ? tab.url : "";
    if (!isDeveloperDashboardUrl(url) || url.startsWith(ownOrigin)) {
      window.close();
    }
  }).catch(() => {});
}

const elements = {
  summary: document.getElementById("summary"),
  status: document.getElementById("status"),
  projectSelect: document.getElementById("projectSelect"),
  localeSelect: document.getElementById("localeSelect"),
  importFolder: document.getElementById("importFolder"),
  listingFiles: document.getElementById("listingFiles"),
  listingFolderFallback: document.getElementById("listingFolderFallback"),
  syncProject: document.getElementById("syncProject"),
  fillField: document.getElementById("fillField"),
  fillCurrentLanguage: document.getElementById("fillCurrentLanguage"),
  fillAllLanguages: document.getElementById("fillAllLanguages"),
  abortFillAll: document.getElementById("abortFillAll"),
  copyText: document.getElementById("copyText"),
  diagnosePage: document.getElementById("diagnosePage"),
  openOptions: document.getElementById("openOptions"),
  diagnostics: document.getElementById("diagnostics"),
  diagnosticsText: document.getElementById("diagnosticsText"),
  themeChoices: Array.from(document.querySelectorAll("[data-theme-choice]"))
};

let isPopupFillAllRunning = false;
let fillAllStatusPollId = 0;

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
  const stored = await STOREPILOT_API.storage.local.get(SETTINGS_KEY);
  return {
    theme: "system",
    ...(stored[SETTINGS_KEY] || {})
  };
}

async function updateSettings(patch) {
  const settings = {
    ...(await getSettings()),
    ...patch
  };

  await STOREPILOT_API.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

async function getPopupState() {
  const stored = await STOREPILOT_API.storage.local.get(POPUP_STATE_KEY);
  return {
    selectedLocaleByProject: {},
    ...(stored[POPUP_STATE_KEY] || {})
  };
}

async function updatePopupState(patch) {
  const state = {
    ...(await getPopupState()),
    ...patch
  };

  await STOREPILOT_API.storage.local.set({ [POPUP_STATE_KEY]: state });
  return state;
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

function isDeveloperDashboardUrl(url = "") {
  return /^https:\/\/(chrome\.google\.com\/webstore\/devconsole|chromewebstore\.google\.com\/devconsole)\//.test(url);
}

function isExtensionsGalleryBlockedError(errorText = "") {
  return /extensions gallery cannot be scripted/i.test(errorText);
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
  elements.syncProject.disabled = !activeProject || !activeProject.hasFolderHandle;
  elements.syncProject.title = activeProject && !activeProject.hasFolderHandle
    ? t("reimportFolderToRefresh", "This project was imported from a browser file picker. Re-import the project folder to refresh it.")
    : "";
}

function formatConfidence(value) {
  if (value === "high") return t("confidenceHigh", "high");
  if (value === "medium") return t("confidenceMedium", "medium");
  if (value === "low") return t("confidenceLow", "low");
  return value || "";
}

async function renderLocaleSelect(project) {
  const locales = Object.keys(project && project.listings ? project.listings : {})
    .sort((a, b) => a.localeCompare(b));
  const popupState = await getPopupState();
  const savedLocale = project && popupState.selectedLocaleByProject[project.id];
  const selectedLocale = locales.includes(savedLocale)
    ? savedLocale
    : (locales.includes("en") ? "en" : locales[0] || "");

  elements.localeSelect.replaceChildren(...locales.map(locale => {
    const option = document.createElement("option");
    option.value = locale;
    option.textContent = locale;
    option.selected = locale === selectedLocale;
    return option;
  }));

  elements.localeSelect.disabled = !locales.length;
  elements.copyText.disabled = !locales.length;
}

async function refreshSummary() {
  const { projects, activeProjectId } = await storePilotGetProjectsState();
  const activeProject = projects.find(project => project.id === activeProjectId) || projects[0] || null;
  const count = activeProject ? storePilotGetProjectLocaleCount(activeProject) : 0;
  const updatedAt = activeProject ? storePilotFormatDisplayTimestamp(activeProject.lastSyncedAt) : t("never", "Never");

  renderProjectSelect(projects, activeProject && activeProject.id);
  await renderLocaleSelect(activeProject);
  elements.summary.textContent = activeProject
    ? t("popupSummary", "$1 listing locale(s) in $2. Last updated on $3.", [String(count), activeProject.name, updatedAt])
    : t("noProjectsYet", "No projects yet");
}

async function updateDashboardRestrictionNotice() {
  if (STOREPILOT_IS_FIREFOX) {
    return;
  }

  const tab = await getActiveTab();

  if (!tab || !isDeveloperDashboardUrl(tab.url || "")) {
    return;
  }

  elements.fillField.disabled = true;
  elements.fillCurrentLanguage.disabled = true;
  elements.fillAllLanguages.disabled = true;
  setStatus(t("chromeBlocksDashboard", "Chrome blocks StorePilot from reading the Chrome Web Store page, so the current dashboard locale cannot be detected. Select the locale here and use Copy text."), false);
}

async function copySelectedLocaleFromPopup() {
  const project = await storePilotGetActiveProject();
  const locale = elements.localeSelect.value;
  const text = project && project.listings ? project.listings[locale] : "";

  if (!text) {
    return {
      ok: false,
      message: t("noListingTextSelected", "No listing text selected to copy.")
    };
  }

  await navigator.clipboard.writeText(text);
  return {
    ok: true,
    message: t("copiedLocaleFromProject", "Copied $1 from $2.", [locale, project.name])
  };
}

async function importListings(files) {
  const result = await storePilotImportListingFiles(files);

  if (!result.total) {
    setStatus(t("noLocaleListingFilesSelected", "No locale listing files selected."), true);
    return;
  }

  await refreshSummary();
  setStatus(t("importedSkipped", "Imported $1; skipped $2.", [String(result.imported), String(result.skipped.length)]), result.imported === 0);
  return result;
}

async function importFolder() {
  if (!window.showDirectoryPicker) {
    elements.listingFolderFallback.click();
    return;
  }

  try {
    const directoryHandle = await window.showDirectoryPicker({
      id: "storepilot-listing-folder",
      mode: "read"
    });
    const result = await storePilotImportListingDirectory(directoryHandle);

    if (!result.total) {
      setStatus(t("noLocaleListingFolderFound", "No locale listing folder found."), true);
      return;
    }

    await refreshSummary();
    setStatus(
      t("importedIntoConfidence", "Imported $1 into $2 ($3 confidence).", [String(result.imported), result.project.name, formatConfidence(result.confidence)]),
      result.imported === 0
    );
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus(t("folderImportCanceled", "Folder import canceled."));
      return;
    }

    console.error(error);
    setStatus(t("importFailed", "Import failed: $1", [error.message]), true);
  }
}

async function syncActiveProject(requestAccess = true) {
  const { activeProjectId } = await storePilotGetProjectsState();
  if (!activeProjectId) return;

  const result = await storePilotSyncProject(activeProjectId, requestAccess);
  await refreshSummary();
  if (requestAccess || result.ok) {
    setStatus(result.message, !result.ok && requestAccess);
  }
}

async function getActiveTab() {
  const [tab] = await STOREPILOT_API.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function injectContentScript(tabId) {
  await STOREPILOT_API.scripting.executeScript({
    target: { tabId },
    files: ["src/content/dashboard-helper.js"]
  });
}

async function sendToActiveTab(type) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    return { ok: false, message: t("noActiveTab", "No active tab.") };
  }

  const diagnostics = {
    action: type,
    tabId: tab.id,
    url: tab.url || "",
    expectedDashboardUrl: isDeveloperDashboardUrl(tab.url || "")
  };

  if (!diagnostics.expectedDashboardUrl) {
    return {
      ok: false,
      message: t("notDashboardPage", "The active tab is not a Chrome Web Store Developer Dashboard page."),
      diagnostics
    };
  }

  try {
    const response = await STOREPILOT_API.tabs.sendMessage(tab.id, { type });
    return { ...response, diagnostics: { ...diagnostics, contentScript: t("contentScriptAlreadyConnected", "already connected"), response } };
  } catch (error) {
    diagnostics.initialMessageError = formatError(error);

    try {
      await injectContentScript(tab.id);
      diagnostics.injection = t("injectionSucceeded", "succeeded");
      const response = await STOREPILOT_API.tabs.sendMessage(tab.id, { type });
      return { ...response, diagnostics: { ...diagnostics, response } };
    } catch (injectionError) {
      diagnostics.injectionError = formatError(injectionError);
      const isGalleryBlocked = isExtensionsGalleryBlockedError(diagnostics.injectionError);

      return {
        ok: false,
        message: isGalleryBlocked
          ? t("chromeBlocksFillActions", "Chrome blocks extensions from scripting the Chrome Web Store dashboard. Fill actions cannot run here; use Copy text and paste manually.")
          : t("couldNotConnectDashboard", "StorePilot could not connect to this dashboard tab. Open Diagnostics for the exact Chrome error."),
        diagnostics
      };
    }
  }
}

function setPopupFillAllRunning(isRunning) {
  isPopupFillAllRunning = isRunning;
  elements.fillAllLanguages.disabled = isRunning;
  elements.abortFillAll.hidden = !isRunning;
  elements.abortFillAll.disabled = false;

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
  const stored = await STOREPILOT_API.storage.local.get(FILL_ALL_STATUS_STORAGE_KEY);
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

function handleFileSelection(event) {
  const importer = event.target === elements.listingFolderFallback
    ? storePilotImportListingFileList
    : importListings;

  importer(event.target.files).then(async result => {
    await refreshSummary();
    if (!result.total) {
      setStatus(t("noLocaleListingFilesFound", "No locale listing files were found."), true);
      return;
    }

    setStatus(event.target === elements.listingFolderFallback && result.project
      ? t("importedInto", "Imported $1 into $2.", [String(result.imported), result.project.name])
      : t("importedSkipped", "Imported $1; skipped $2.", [String(result.imported), String(result.skipped.length)]), result.imported === 0);
  }).catch(error => {
    console.error(error);
    setStatus(t("importFailed", "Import failed: $1", [error.message]), true);
  });
  event.target.value = "";
}

elements.importFolder.addEventListener("click", importFolder);
elements.listingFiles.addEventListener("change", handleFileSelection);
elements.listingFolderFallback.addEventListener("change", handleFileSelection);

elements.projectSelect.addEventListener("change", async event => {
  await storePilotSetActiveProject(event.target.value);
  await refreshSummary();
  setStatus(t("projectSelected", "Project selected."));
  await updateDashboardRestrictionNotice();
});

elements.localeSelect.addEventListener("change", async event => {
  const project = await storePilotGetActiveProject();
  if (!project) return;

  const state = await getPopupState();
  await updatePopupState({
    selectedLocaleByProject: {
      ...state.selectedLocaleByProject,
      [project.id]: event.target.value
    }
  });
  setStatus(t("localeSelected", "Locale selected: $1.", [event.target.value]));
});

elements.syncProject.addEventListener("click", () => {
  if (elements.syncProject.disabled) {
    setStatus(t("cannotAutoSync", "This project cannot auto-sync in this browser. Re-import the project folder to refresh listings."));
    return;
  }

  syncActiveProject(true).catch(error => {
    console.error(error);
    setStatus(t("syncFailed", "Sync failed: $1", [error.message]), true);
  });
});

elements.fillField.addEventListener("click", async () => {
  const result = await sendToActiveTab("storepilot-fill");
  showActionResult(result);
});

elements.fillCurrentLanguage.addEventListener("click", async () => {
  const result = await sendToActiveTab("storepilot-fill-current-language");
  showActionResult(result);
});

elements.fillAllLanguages.addEventListener("click", async () => {
  if (isPopupFillAllRunning) return;

  setPopupFillAllRunning(true);
  setStatus(t("fillingAllLanguages", "Filling all languages..."));

  try {
    const result = await sendToActiveTab("storepilot-fill-all-languages");
    showActionResult(result);
  } finally {
    setPopupFillAllRunning(false);
  }
});

elements.abortFillAll.addEventListener("click", async () => {
  elements.abortFillAll.disabled = true;
  const result = await sendToActiveTab("storepilot-abort-fill-all");
  if (result.ok) {
    setStatus(result.message || t("stopRequested", "Stop requested."));
  } else {
    await refreshFillAllStatus();
    if (!isPopupFillAllRunning) {
      setStatus(t("fillAllNotRunning", "Fill all is not running."));
      return;
    }
    elements.abortFillAll.disabled = false;
    setStatus(result.message || t("couldNotStopFillAll", "Could not stop fill all."), true);
  }
});

elements.copyText.addEventListener("click", async () => {
  const result = await copySelectedLocaleFromPopup();
  showActionResult(result);
});

elements.diagnosePage.addEventListener("click", () => {
  diagnoseActiveTab().catch(error => {
    setStatus(t("diagnosticsFailedWithError", "Diagnostics failed: $1", [formatError(error)]), true);
    setDiagnostics({ error: formatError(error) });
  });
});

elements.openOptions.addEventListener("click", () => {
  STOREPILOT_API.runtime.openOptionsPage();
});

elements.themeChoices.forEach(button => {
  button.addEventListener("click", async () => {
    const settings = await updateSettings({ theme: button.dataset.themeChoice });
    applyTheme(settings.theme);
  });
});

STOREPILOT_API.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes[SETTINGS_KEY]) {
    applyTheme(changes[SETTINGS_KEY].newValue && changes[SETTINGS_KEY].newValue.theme);
  }

  if (changes[STOREPILOT_PROJECTS_STORAGE_KEY] || changes[STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY]) {
    refreshSummary();
  }

  if (changes[FILL_ALL_STATUS_STORAGE_KEY]) {
    applyFillAllStatus(changes[FILL_ALL_STATUS_STORAGE_KEY].newValue);
  }
});

if (STOREPILOT_API.runtime && STOREPILOT_API.runtime.onMessage) {
  STOREPILOT_API.runtime.onMessage.addListener(message => {
    if (!message || message.type !== "storepilot-fill-all-progress") {
      return;
    }

    applyFillAllStatus(message.status || {
      running: isPopupFillAllRunning,
      message: message.message || t("fillingAllLanguages", "Filling all languages...")
    });
  });
}

(async () => {
  storePilotApplyI18n();
  applyTheme((await getSettings()).theme);
  await refreshSummary();
  await updateDashboardRestrictionNotice();
  await refreshFillAllStatus();
  await syncActiveProject(false);
})();
