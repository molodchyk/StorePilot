const SETTINGS_KEY = "storePilotSettings";
var STOREPILOT_API = globalThis.browser || globalThis.chrome;

function t(key, fallback, substitutions) {
  return storePilotText(key, fallback, substitutions);
}

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
  lastUpdatedStatus: document.getElementById("lastUpdatedStatus"),
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
  if (!value) return t("neverSynced", "Never synced");
  return new Date(value).toLocaleString();
}

function formatConfidence(value) {
  if (value === "high") return t("confidenceHigh", "high");
  if (value === "medium") return t("confidenceMedium", "medium");
  if (value === "low") return t("confidenceLow", "low");
  return value || "";
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
  elements.deleteProject.disabled = !projects.length;
}

function renderListings(project) {
  const listings = project && project.listings ? project.listings : {};
  const locales = Object.keys(listings).sort((a, b) => a.localeCompare(b));
  elements.lastUpdatedStatus.textContent = project
    ? t("lastUpdatedOn", "Last updated on $1.", [storePilotFormatDisplayTimestamp(project.lastSyncedAt)])
    : t("lastUpdatedOn", "Last updated on $1.", [t("never", "Never")]);
  elements.summary.textContent = project
    ? t("projectLocalesImported", "$1: $2 locale(s) imported", [project.name, String(locales.length)])
    : t("noActiveProject", "No active project");

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
    preview.textContent = text.split(/\r?\n/).find(Boolean) || t("emptyValue", "(empty)");
    count.textContent = t("charCount", "$1 chars", [text.length.toLocaleString()]);

    row.append(localeCell, preview, count);
    return row;
  }));
}

function renderProjectTable(projects, activeProjectId) {
  elements.projectSummary.textContent = projects.length
    ? t("projectCount", "$1 project(s)", [String(projects.length)])
    : t("noProjects", "No projects");

  if (!projects.length) {
    elements.projectTable.innerHTML = "";
    return;
  }

  elements.projectTable.replaceChildren(...storePilotSortProjects(projects).map(project => {
    const row = document.createElement("button");
    const name = document.createElement("div");
    const details = document.createElement("div");
    const count = document.createElement("div");

    row.className = "project-row";
    row.type = "button";
    row.dataset.projectId = project.id;
    row.setAttribute("aria-pressed", String(project.id === activeProjectId));
    name.className = "project-name";
    details.className = "preview";
    count.className = "count";

    name.textContent = project.name;
    details.textContent = [
      project.id === activeProjectId ? t("selectedProject", "Selected project") : "",
      t("sourceLabel", "Source: $1", [project.sourcePath || t("noSourceFolder", "No source folder")]),
      project.confidence ? t("detectionConfidence", "Detection: $1 confidence", [formatConfidence(project.confidence)]) : "",
      project.hasFolderHandle ? t("refreshSyncEnabled", "Refresh: sync enabled") : t("refreshReimportFolder", "Refresh: re-import folder"),
      t("updatedLabel", "Updated: $1", [storePilotFormatDisplayTimestamp(project.lastSyncedAt)])
    ].filter(Boolean).join(" | ");
    count.textContent = t("localesCount", "$1 locales", [String(storePilotGetProjectLocaleCount(project))]);

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
    setStatus(t("noLocaleListingFilesSelected", "No locale listing files were selected."), true);
    return;
  }

  await renderAll();
  setStatus(
    t("importedSkipped", "Imported $1; skipped $2.", [String(result.imported), String(result.skipped.length)]) +
      (result.skipped.length ? ` ${t("skippedList", "Skipped: $1", [result.skipped.slice(0, 5).join(", ")])}${result.skipped.length > 5 ? "..." : ""}` : ""),
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
      setStatus(t("noLocaleListingFolderFound", "No locale listing folder was found in the selected folder."), true);
      return;
    }

    await renderAll();
    setStatus(
      t("importedIntoFrom", "Imported $1 into $2 from $3 ($4 confidence); skipped $5.", [String(result.imported), result.project.name, result.sourcePath, formatConfidence(result.confidence), String(result.skipped.length)]) +
        (result.candidateCount > 1 ? ` ${t("foundCandidateFolders", "Found $1 candidate folders.", [String(result.candidateCount)])}` : ""),
      result.imported === 0
    );
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus(t("folderImportCanceled", "Folder import canceled."));
      return;
    }

    console.error(error);
    setStatus(t("folderImportFailed", "Folder import failed: $1", [error.message]), true);
  }
}

async function importFolderFileList(files) {
  const result = await storePilotImportListingFileList(files);

  if (!result.total) {
    setStatus(t("noLocaleListingFolderFound", "No locale listing folder was found in the selected folder."), true);
    return;
  }

  await renderAll();
  setStatus(
    t("importedIntoFrom", "Imported $1 into $2 from $3 ($4 confidence); skipped $5.", [String(result.imported), result.project.name, result.sourcePath || t("selectedFiles", "selected files"), formatConfidence(result.confidence) || t("manual", "manual"), String(result.skipped.length)]) +
      (result.candidateCount > 1 ? ` ${t("foundCandidateFolders", "Found $1 candidate folders.", [String(result.candidateCount)])}` : ""),
    result.imported === 0
  );
}

function handleFileSelection(event) {
  const importer = event.target === elements.listingFolderFallback
    ? importFolderFileList
    : importListings;

  importer(event.target.files).catch(error => {
    console.error(error);
    setStatus(t("importFailed", "Import failed: $1", [error.message]), true);
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

elements.projectTable.addEventListener("click", async event => {
  const row = event.target.closest("[data-project-id]");
  if (!row) return;

  await storePilotSetActiveProject(row.dataset.projectId);
  await renderAll();
});

elements.syncProject.addEventListener("click", async () => {
  const project = await storePilotGetActiveProject();
  if (!project || !project.hasFolderHandle) {
    setStatus(t("cannotAutoSync", "This project cannot auto-sync in this browser. Re-import the project folder to refresh listings."), false);
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
    setStatus(t("noSavedFolderPermission", "No projects have saved folder permission. Re-import a project folder to refresh it."), false);
    return;
  }

  const results = await storePilotSyncAllProjects(true);
  await renderAll();
  const synced = results.filter(result => result.ok).length;
  const failed = results.filter(result => result.project && result.project.hasFolderHandle && !result.ok).length;
  setStatus(t("syncedProjectsNeedAttention", "Synced $1 project(s); $2 need attention.", [String(synced), String(failed)]), failed > 0);
});

elements.deleteProject.addEventListener("click", async () => {
  const project = await storePilotGetActiveProject();
  if (!project || !window.confirm(t("deleteProjectConfirm", "Delete StorePilot project \"$1\"?", [project.name]))) return;

  await storePilotDeleteProject(project.id);
  await renderAll();
  setStatus(t("deletedProject", "Deleted $1.", [project.name]));
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
    setStatus(t("importFailed", "Import failed: $1", [error.message]), true);
  });
});

elements.clearListings.addEventListener("click", async () => {
  const project = await storePilotGetActiveProject();
  if (!project || !window.confirm(t("clearListingsConfirm", "Clear listings for \"$1\"?", [project.name]))) return;

  await storePilotUpsertProject({
    ...project,
    listings: {},
    lastSyncedAt: storePilotFormatTimestamp()
  });
  await renderAll();
  setStatus(t("clearedListingsFor", "Cleared listings for $1.", [project.name]));
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
  storePilotApplyI18n();
  applyTheme((await getSettings()).theme);
  await renderAll();
})();
