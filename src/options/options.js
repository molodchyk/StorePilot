const SETTINGS_KEY = "storePilotSettings";
var STOREPILOT_API = globalThis.browser || globalThis.chrome;

const elements = {
  importFolder: document.getElementById("importFolder"),
  listingFolderFallback: document.getElementById("listingFolderFallback"),
  listingFiles: document.getElementById("listingFiles"),
  clearListings: document.getElementById("clearListings"),
  syncProject: document.getElementById("syncProject"),
  syncAllProjects: document.getElementById("syncAllProjects"),
  deleteProject: document.getElementById("deleteProject"),
  projectSelect: document.getElementById("projectSelect"),
  projectTable: document.getElementById("projectTable"),
  projectSummary: document.getElementById("projectSummary"),
  listingTable: document.getElementById("listingTable"),
  summary: document.getElementById("summary"),
  importStatus: document.getElementById("importStatus"),
  dropZone: document.getElementById("dropZone"),
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

function setStatus(message, isError = false) {
  elements.importStatus.textContent = message;
  elements.importStatus.classList.toggle("error", isError);
}

function formatSyncTime(value) {
  if (!value) return "Never synced";
  return new Date(value).toLocaleString();
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
    ? "This project was imported from a browser file picker. Re-import the project folder to refresh it."
    : "";
  elements.deleteProject.disabled = !projects.length;
}

function renderListings(project) {
  const listings = project && project.listings ? project.listings : {};
  const locales = Object.keys(listings).sort((a, b) => a.localeCompare(b));
  elements.summary.textContent = project
    ? `${project.name}: ${locales.length} locale${locales.length === 1 ? "" : "s"} imported`
    : "No active project";

  if (!locales.length) {
    elements.listingTable.innerHTML = "";
    return;
  }

  elements.listingTable.replaceChildren(...locales.map(locale => {
    const text = listings[locale] || "";
    const row = document.createElement("div");
    const localeCell = document.createElement("div");
    const preview = document.createElement("div");
    const count = document.createElement("div");

    row.className = "listing-row";
    localeCell.className = "locale";
    preview.className = "preview";
    count.className = "count";

    localeCell.textContent = locale;
    preview.textContent = text.split(/\r?\n/).find(Boolean) || "(empty)";
    count.textContent = `${text.length.toLocaleString()} chars`;

    row.append(localeCell, preview, count);
    return row;
  }));
}

function renderProjectTable(projects, activeProjectId) {
  elements.projectSummary.textContent = projects.length
    ? `${projects.length} project${projects.length === 1 ? "" : "s"}`
    : "No projects";

  if (!projects.length) {
    elements.projectTable.innerHTML = "";
    return;
  }

  elements.projectTable.replaceChildren(...storePilotSortProjects(projects).map(project => {
    const row = document.createElement("div");
    const name = document.createElement("div");
    const details = document.createElement("div");
    const count = document.createElement("div");

    row.className = "project-row";
    name.className = "project-name";
    details.className = "preview";
    count.className = "count";

    name.textContent = `${project.name}${project.id === activeProjectId ? " (active)" : ""}`;
    details.textContent = [
      project.sourcePath || "No source folder",
      project.confidence ? `${project.confidence} confidence` : "",
      project.hasFolderHandle ? "sync enabled" : "re-import folder to refresh",
      formatSyncTime(project.lastSyncedAt)
    ].filter(Boolean).join(" - ");
    count.textContent = `${storePilotGetProjectLocaleCount(project)} locales`;

    row.append(name, details, count);
    return row;
  }));
}

async function renderAll() {
  const { projects, activeProjectId } = await storePilotGetProjectsState();
  const activeProject = projects.find(project => project.id === activeProjectId) || projects[0] || null;

  renderProjectSelect(projects, activeProject && activeProject.id);
  renderListings(activeProject);
  renderProjectTable(projects, activeProject && activeProject.id);
}

async function importListings(files) {
  const result = await storePilotImportListingFiles(files);

  if (!result.total) {
    setStatus("No locale listing files were selected.", true);
    return;
  }

  await renderAll();
  setStatus(
    `Imported ${result.imported}; skipped ${result.skipped.length}.` +
      (result.skipped.length ? ` Skipped: ${result.skipped.slice(0, 5).join(", ")}${result.skipped.length > 5 ? "..." : ""}` : ""),
    result.imported === 0
  );
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
      setStatus("No locale listing folder was found in the selected folder.", true);
      return;
    }

    await renderAll();
    setStatus(
      `Imported ${result.imported} into ${result.project.name} from ${result.sourcePath} (${result.confidence} confidence); skipped ${result.skipped.length}.` +
        (result.candidateCount > 1 ? ` Found ${result.candidateCount} candidate folders.` : ""),
      result.imported === 0
    );
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("Folder import canceled.");
      return;
    }

    console.error(error);
    setStatus(`Folder import failed: ${error.message}`, true);
  }
}

async function importFolderFileList(files) {
  const result = await storePilotImportListingFileList(files);

  if (!result.total) {
    setStatus("No locale listing folder was found in the selected folder.", true);
    return;
  }

  await renderAll();
  setStatus(
    `Imported ${result.imported} into ${result.project.name} from ${result.sourcePath || "selected files"} (${result.confidence || "manual"} confidence); skipped ${result.skipped.length}.` +
      (result.candidateCount > 1 ? ` Found ${result.candidateCount} candidate folders.` : ""),
    result.imported === 0
  );
}

function handleFileSelection(event) {
  const importer = event.target === elements.listingFolderFallback
    ? importFolderFileList
    : importListings;

  importer(event.target.files).catch(error => {
    console.error(error);
    setStatus(`Import failed: ${error.message}`, true);
  });
  event.target.value = "";
}

elements.importFolder.addEventListener("click", importFolder);
elements.listingFolderFallback.addEventListener("change", handleFileSelection);
elements.listingFiles.addEventListener("change", handleFileSelection);

elements.projectSelect.addEventListener("change", async event => {
  await storePilotSetActiveProject(event.target.value);
  await renderAll();
});

elements.syncProject.addEventListener("click", async () => {
  const project = await storePilotGetActiveProject();
  if (!project || !project.hasFolderHandle) {
    setStatus("This project cannot auto-sync in this browser. Re-import the project folder to refresh listings.", false);
    return;
  }

  const result = await storePilotSyncProject(project.id, true);
  await renderAll();
  setStatus(result.message, !result.ok);
});

elements.syncAllProjects.addEventListener("click", async () => {
  const { projects } = await storePilotGetProjectsState();
  const syncableProjects = projects.filter(project => project.hasFolderHandle);

  if (!syncableProjects.length) {
    setStatus("No projects have saved folder permission. Re-import a project folder to refresh it.", false);
    return;
  }

  const results = await storePilotSyncAllProjects(true);
  await renderAll();
  const synced = results.filter(result => result.ok).length;
  const failed = results.filter(result => result.project && result.project.hasFolderHandle && !result.ok).length;
  setStatus(`Synced ${synced} project${synced === 1 ? "" : "s"}; ${failed} need attention.`, failed > 0);
});

elements.deleteProject.addEventListener("click", async () => {
  const project = await storePilotGetActiveProject();
  if (!project || !window.confirm(`Delete StorePilot project "${project.name}"?`)) return;

  await storePilotDeleteProject(project.id);
  await renderAll();
  setStatus(`Deleted ${project.name}.`);
});

elements.dropZone.addEventListener("dragover", event => {
  event.preventDefault();
  elements.dropZone.classList.add("dragging");
});

elements.dropZone.addEventListener("dragleave", () => {
  elements.dropZone.classList.remove("dragging");
});

elements.dropZone.addEventListener("drop", event => {
  event.preventDefault();
  elements.dropZone.classList.remove("dragging");

  importListings(event.dataTransfer.files).catch(error => {
    console.error(error);
    setStatus(`Import failed: ${error.message}`, true);
  });
});

elements.clearListings.addEventListener("click", async () => {
  const project = await storePilotGetActiveProject();
  if (!project || !window.confirm(`Clear listings for "${project.name}"?`)) return;

  await storePilotUpsertProject({
    ...project,
    listings: {},
    lastSyncedAt: storePilotFormatTimestamp()
  });
  await renderAll();
  setStatus(`Cleared listings for ${project.name}.`);
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
    renderAll();
  }
});

(async () => {
  applyTheme((await getSettings()).theme);
  await renderAll();
})();
