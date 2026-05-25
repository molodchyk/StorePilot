const SETTINGS_KEY = "storePilotSettings";
const POPUP_STATE_KEY = "storePilotPopupState";
var STOREPILOT_API = globalThis.browser || globalThis.chrome;
const STOREPILOT_IS_FIREFOX = typeof globalThis.browser !== "undefined";

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
  copyText: document.getElementById("copyText"),
  diagnosePage: document.getElementById("diagnosePage"),
  openOptions: document.getElementById("openOptions"),
  diagnostics: document.getElementById("diagnostics"),
  diagnosticsText: document.getElementById("diagnosticsText"),
  themeChoices: Array.from(document.querySelectorAll("[data-theme-choice]"))
};

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
  elements.projectSelect.replaceChildren(...storePilotSortProjects(projects).map(project => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    option.selected = project.id === activeProjectId;
    return option;
  }));

  elements.projectSelect.disabled = !projects.length;
  elements.syncProject.disabled = !projects.length;
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

  renderProjectSelect(projects, activeProject && activeProject.id);
  await renderLocaleSelect(activeProject);
  elements.summary.textContent = activeProject
    ? `${count} listing locale${count === 1 ? "" : "s"} in ${activeProject.name}`
    : "No projects yet";
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
  setStatus("Chrome blocks StorePilot from reading the Chrome Web Store page, so the current dashboard locale cannot be detected. Select the locale here and use Copy text.", false);
}

async function copySelectedLocaleFromPopup() {
  const project = await storePilotGetActiveProject();
  const locale = elements.localeSelect.value;
  const text = project && project.listings ? project.listings[locale] : "";

  if (!text) {
    return {
      ok: false,
      message: "No listing text selected to copy."
    };
  }

  await navigator.clipboard.writeText(text);
  return {
    ok: true,
    message: `Copied ${locale} from ${project.name}.`
  };
}

async function importListings(files) {
  const result = await storePilotImportListingFiles(files);

  if (!result.total) {
    setStatus("No locale listing files selected.", true);
    return;
  }

  await refreshSummary();
  setStatus(`Imported ${result.imported}; skipped ${result.skipped.length}.`, result.imported === 0);
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
      setStatus("No locale listing folder found.", true);
      return;
    }

    await refreshSummary();
    setStatus(
      `Imported ${result.imported} into ${result.project.name} (${result.confidence} confidence).`,
      result.imported === 0
    );
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("Folder import canceled.");
      return;
    }

    console.error(error);
    setStatus(`Import failed: ${error.message}`, true);
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
    return { ok: false, message: "No active tab." };
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
      message: "The active tab is not a Chrome Web Store Developer Dashboard page.",
      diagnostics
    };
  }

  try {
    const response = await STOREPILOT_API.tabs.sendMessage(tab.id, { type });
    return { ...response, diagnostics: { ...diagnostics, contentScript: "already connected", response } };
  } catch (error) {
    diagnostics.initialMessageError = formatError(error);

    try {
      await injectContentScript(tab.id);
      diagnostics.injection = "succeeded";
      const response = await STOREPILOT_API.tabs.sendMessage(tab.id, { type });
      return { ...response, diagnostics: { ...diagnostics, response } };
    } catch (injectionError) {
      diagnostics.injectionError = formatError(injectionError);
      const isGalleryBlocked = isExtensionsGalleryBlockedError(diagnostics.injectionError);

      return {
        ok: false,
        message: isGalleryBlocked
          ? "Chrome blocks extensions from scripting the Chrome Web Store dashboard. Fill actions cannot run here; use Copy text and paste manually."
          : "StorePilot could not connect to this dashboard tab. Open Diagnostics for the exact Chrome error.",
        diagnostics
      };
    }
  }
}

async function diagnoseActiveTab() {
  const result = await sendToActiveTab("storepilot-diagnose");
  setStatus(result.message || (result.ok ? "Diagnostics complete." : "Diagnostics failed."), !result.ok);
  setDiagnostics(result.diagnostics || result);
}

function showActionResult(result) {
  setStatus(result.message || (result.ok ? "Done." : "Failed."), !result.ok);
  setDiagnostics(result.ok ? null : result.diagnostics || result);
}

function handleFileSelection(event) {
  importListings(event.target.files).catch(error => {
    console.error(error);
    setStatus(`Import failed: ${error.message}`, true);
  });
  event.target.value = "";
}

elements.importFolder.addEventListener("click", importFolder);
elements.listingFiles.addEventListener("change", handleFileSelection);
elements.listingFolderFallback.addEventListener("change", handleFileSelection);

elements.projectSelect.addEventListener("change", async event => {
  await storePilotSetActiveProject(event.target.value);
  await refreshSummary();
  setStatus("Project selected.");
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
  setStatus(`Locale selected: ${event.target.value}.`);
});

elements.syncProject.addEventListener("click", () => {
  syncActiveProject(true).catch(error => {
    console.error(error);
    setStatus(`Sync failed: ${error.message}`, true);
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
  const result = await sendToActiveTab("storepilot-fill-all-languages");
  showActionResult(result);
});

elements.copyText.addEventListener("click", async () => {
  const result = await copySelectedLocaleFromPopup();
  showActionResult(result);
});

elements.diagnosePage.addEventListener("click", () => {
  diagnoseActiveTab().catch(error => {
    setStatus(`Diagnostics failed: ${formatError(error)}`, true);
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
});

(async () => {
  applyTheme((await getSettings()).theme);
  await refreshSummary();
  await updateDashboardRestrictionNotice();
  await syncActiveProject(false);
})();
