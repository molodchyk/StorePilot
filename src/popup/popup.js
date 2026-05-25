const SETTINGS_KEY = "storePilotSettings";

const elements = {
  summary: document.getElementById("summary"),
  status: document.getElementById("status"),
  projectSelect: document.getElementById("projectSelect"),
  importFolder: document.getElementById("importFolder"),
  listingFiles: document.getElementById("listingFiles"),
  listingFolderFallback: document.getElementById("listingFolderFallback"),
  syncProject: document.getElementById("syncProject"),
  fillField: document.getElementById("fillField"),
  copyText: document.getElementById("copyText"),
  openOptions: document.getElementById("openOptions"),
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
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
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

  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
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

async function refreshSummary() {
  const { projects, activeProjectId } = await storePilotGetProjectsState();
  const activeProject = projects.find(project => project.id === activeProjectId) || projects[0] || null;
  const count = activeProject ? storePilotGetProjectLocaleCount(activeProject) : 0;

  renderProjectSelect(projects, activeProject && activeProject.id);
  elements.summary.textContent = activeProject
    ? `${count} listing locale${count === 1 ? "" : "s"} in ${activeProject.name}`
    : "No projects yet";
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToActiveTab(type) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    return { ok: false, message: "No active tab." };
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, { type });
  } catch (_error) {
    return {
      ok: false,
      message: "Open a Chrome Web Store Developer Dashboard page first."
    };
  }
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
});

elements.syncProject.addEventListener("click", () => {
  syncActiveProject(true).catch(error => {
    console.error(error);
    setStatus(`Sync failed: ${error.message}`, true);
  });
});

elements.fillField.addEventListener("click", async () => {
  const result = await sendToActiveTab("storepilot-fill");
  setStatus(result.message || (result.ok ? "Filled." : "Could not fill."), !result.ok);
});

elements.copyText.addEventListener("click", async () => {
  const result = await sendToActiveTab("storepilot-copy");
  setStatus(result.message || (result.ok ? "Copied." : "Could not copy."), !result.ok);
});

elements.openOptions.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

elements.themeChoices.forEach(button => {
  button.addEventListener("click", async () => {
    const settings = await updateSettings({ theme: button.dataset.themeChoice });
    applyTheme(settings.theme);
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
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
  await syncActiveProject(false);
})();
