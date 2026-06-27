var STOREPILOT_API = globalThis.STOREPILOT_API || globalThis.browser || globalThis.chrome;

function t(key, fallback, substitutions) {
  return storePilotText(key, fallback, substitutions);
}

const elements = {
  importFolder: document.getElementById("importFolder"),
  listingFolderFallback: document.getElementById("listingFolderFallback"),
  deleteProject: document.getElementById("deleteProject"),
  projectSelect: document.getElementById("projectSelect"),
  projectTable: document.getElementById("projectTable"),
  projectSummary: document.getElementById("projectSummary"),
  privacySummary: document.getElementById("privacySummary"),
  privacyTable: document.getElementById("privacyTable"),
  dataUsageSummary: document.getElementById("dataUsageSummary"),
  dataUsageTable: document.getElementById("dataUsageTable"),
  additionalFieldsSummary: document.getElementById("additionalFieldsSummary"),
  additionalFieldsTable: document.getElementById("additionalFieldsTable"),
  productDetailsCategoryTable: document.getElementById("productDetailsCategoryTable"),
  languageDiagnosticsTable: document.getElementById("languageDiagnosticsTable"),
  mediaSummary: document.getElementById("mediaSummary"),
  mediaTable: document.getElementById("mediaTable"),
  listingTable: document.getElementById("listingTable"),
  summary: document.getElementById("summary"),
  lastUpdatedStatus: document.getElementById("lastUpdatedStatus"),
  importStatus: document.getElementById("importStatus"),
  dropZone: document.getElementById("dropZone"),
  listingsCardValue: document.getElementById("listingsCardValue"),
  listingsCardMeta: document.getElementById("listingsCardMeta"),
  mediaCardValue: document.getElementById("mediaCardValue"),
  mediaCardMeta: document.getElementById("mediaCardMeta"),
  privacyCardValue: document.getElementById("privacyCardValue"),
  privacyCardMeta: document.getElementById("privacyCardMeta"),
  dataUsageCardValue: document.getElementById("dataUsageCardValue"),
  dataUsageCardMeta: document.getElementById("dataUsageCardMeta"),
  additionalFieldsCardValue: document.getElementById("additionalFieldsCardValue"),
  additionalFieldsCardMeta: document.getElementById("additionalFieldsCardMeta"),
  sourceCardValue: document.getElementById("sourceCardValue"),
  sourceCardMeta: document.getElementById("sourceCardMeta"),
  detailTabButtons: Array.from(document.querySelectorAll("[data-detail-tab]")),
  detailPanels: Array.from(document.querySelectorAll("[data-detail-panel]")),
  statusCards: Array.from(document.querySelectorAll("[data-detail-tab-target]")),
  themeModeChoices: Array.from(document.querySelectorAll("[data-theme-mode-choice]")),
  themeModePicker: document.querySelector("[data-theme-mode-picker]"),
  themeStylePicker: document.querySelector("[data-theme-style-picker]"),
  tabShortcutControls: Array.from(document.querySelectorAll("[data-tab-shortcut-setting]")),
  showAdvancedFillActions: document.getElementById("showAdvancedFillActions"),
  resetLocalData: document.getElementById("resetLocalData")
};

let activeTabKeyboardShortcuts = storePilotOptionsDefaultTabKeyboardShortcuts();

function applyOptionsSettings(settings) {
  const normalized = storePilotOptionsNormalizeSettings(settings);
  activeTabKeyboardShortcuts = normalized.tabKeyboardShortcuts;
  storePilotOptionsApplySettings(normalized, elements);
}

function setStatus(message, isError = false) {
  elements.importStatus.textContent = message;
  elements.importStatus.classList.toggle("error", isError);
}

function selectDetailTab(tabName) {
  elements.detailTabButtons.forEach(button => {
    button.setAttribute("aria-selected", String(button.dataset.detailTab === tabName));
  });
  elements.detailPanels.forEach(panel => {
    panel.hidden = panel.dataset.detailPanel !== tabName;
  });
  elements.statusCards.forEach(card => {
    card.setAttribute("aria-current", String(card.dataset.detailTabTarget === tabName));
  });
}

function getSelectedDetailTabIndex() {
  const selectedIndex = elements.detailTabButtons.findIndex(button => button.getAttribute("aria-selected") === "true");
  return selectedIndex >= 0 ? selectedIndex : 0;
}

function selectDetailTabByIndex(index) {
  if (!elements.detailTabButtons.length) return false;

  const tabIndex = ((index % elements.detailTabButtons.length) + elements.detailTabButtons.length) % elements.detailTabButtons.length;
  const button = elements.detailTabButtons[tabIndex];

  selectDetailTab(button.dataset.detailTab);
  button.focus({ preventScroll: true });
  return true;
}

function getNumberShortcutIndex(key) {
  if (/^[1-9]$/.test(key)) return Number(key) - 1;
  if (key === "0") return 9;
  return null;
}

function isEditableShortcutTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest("input, select, textarea")) return true;
  return Boolean(target.closest("[contenteditable]:not([contenteditable='false'])"));
}

function shouldIgnoreDetailTabShortcut(event) {
  return event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    document.body.classList.contains("media-review-open") ||
    isEditableShortcutTarget(event.target);
}

function handleDetailTabKeyboardShortcut(event) {
  if (shouldIgnoreDetailTabShortcut(event)) return;

  const numberShortcutIndex = activeTabKeyboardShortcuts.numbers
    ? getNumberShortcutIndex(event.key)
    : null;
  if (numberShortcutIndex !== null && numberShortcutIndex < elements.detailTabButtons.length) {
    event.preventDefault();
    selectDetailTabByIndex(numberShortcutIndex);
    return;
  }

  const lowerKey = event.key.toLowerCase();
  if (activeTabKeyboardShortcuts.letters && (lowerKey === "w" || lowerKey === "s")) {
    event.preventDefault();
    selectDetailTabByIndex(getSelectedDetailTabIndex() + (lowerKey === "w" ? -1 : 1));
    return;
  }

  if (activeTabKeyboardShortcuts.arrows && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();
    selectDetailTabByIndex(getSelectedDetailTabIndex() + (event.key === "ArrowUp" ? -1 : 1));
  }
}

function formatConfidence(value) {
  if (value === "high") return t("confidenceHigh", "high");
  if (value === "medium") return t("confidenceMedium", "medium");
  if (value === "low") return t("confidenceLow", "low");
  return value || "";
}

function formatFoundMissing(value) {
  return value ? t("yes", "yes") : t("no", "no");
}

function getProjectLocaleCount(project) {
  return project ? storePilotGetProjectLocaleCount(project) : 0;
}

function updateStatusCards(projects, activeProject) {
  const locales = getProjectLocaleCount(activeProject);
  const mediaAssets = activeProject && activeProject.mediaAssets;
  const privacyDoc = activeProject && activeProject.privacyDoc;
  const categoryDoc = activeProject && activeProject.categoryDoc;
  const additionalFieldsDoc = activeProject && activeProject.additionalFieldsDoc;
  const privacyFields = privacyDoc && privacyDoc.file && privacyDoc.file.fields
    ? getPrivacyDocumentFieldKeys(privacyDoc.file.fields)
    : [];
  const dataUsageFields = privacyDoc && privacyDoc.file && privacyDoc.file.fields
    ? getDataUsageFieldKeys(privacyDoc.file.fields)
    : [];
  const additionalFields = additionalFieldsDoc && additionalFieldsDoc.file && additionalFieldsDoc.file.fields
    ? Object.keys(additionalFieldsDoc.file.fields)
    : [];

  elements.listingsCardValue.textContent = t("localesCount", "$1 locales", [String(locales)]);
  elements.listingsCardMeta.textContent = activeProject
    ? [
      t("projectLocalesImported", "$1: $2 locale(s) imported", [activeProject.name, String(locales)]),
      categoryDoc && categoryDoc.file ? t("categoryLabel", "Category: $1", [categoryDoc.file.categoryLabel || t("unknown", "Unknown")]) : ""
    ].filter(Boolean).join(" | ")
    : t("noActiveProject", "No active project");

  if (mediaAssets) {
    const localizedStats = mediaAssets.localizedScreenshotStats || {};
    elements.mediaCardValue.textContent = t("mediaCardValueWithLocalizedScreenshots", "$1/5 global, $2 localized locale(s)", [
      String((mediaAssets.screenshots || []).length),
      String(localizedStats.localeCount || Object.keys(mediaAssets.localizedScreenshots || {}).length)
    ]);
    elements.mediaCardMeta.textContent = [
      `${t("storeIcon", "Store icon")}: ${formatFoundMissing(mediaAssets.storeIcon)}`,
      `${t("localizedScreenshots", "Localized screenshots")}: ${String(localizedStats.screenshotCount || 0)}`,
      `${t("smallPromoTile", "Small promo tile")}: ${formatFoundMissing(mediaAssets.smallPromo)}`,
      `${t("marqueePromoTile", "Marquee promo tile")}: ${formatFoundMissing(mediaAssets.marqueePromo)}`
    ].join(" | ");
  } else {
    elements.mediaCardValue.textContent = t("mediaAssetsNotScanned", "Not scanned");
    elements.mediaCardMeta.textContent = t("reimportFolderToScanMediaAssets", "Re-import the project folder to scan graphic assets.");
  }

  if (privacyDoc && privacyDoc.file) {
    elements.privacyCardValue.textContent = t("privacyFieldsCardValue", "$1 field(s)", [String(privacyFields.length)]);
    elements.privacyCardMeta.textContent = privacyDoc.file.path;
  } else if (privacyDoc) {
    elements.privacyCardValue.textContent = t("privacyDocNoUsableFileShort", "No usable privacy document found.");
    elements.privacyCardMeta.textContent = t("privacyDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
      String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0),
      String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.matched || 0)
    ]);
  } else {
    elements.privacyCardValue.textContent = t("privacyDocNotScanned", "Not scanned");
    elements.privacyCardMeta.textContent = t("reimportFolderToScanPrivacyDoc", "Re-import the project folder to scan the privacy document.");
  }

  if (privacyDoc && privacyDoc.file) {
    elements.dataUsageCardValue.textContent = t("dataUsageFieldsCardValue", "$1 value(s)", [String(dataUsageFields.length)]);
    elements.dataUsageCardMeta.textContent = dataUsageFields.length
      ? privacyDoc.file.path
      : t("dataUsageNoValues", "No data usage values found.");
  } else if (privacyDoc) {
    elements.dataUsageCardValue.textContent = t("privacyDocNoUsableFileShort", "No usable privacy document found.");
    elements.dataUsageCardMeta.textContent = t("privacyDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
      String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0),
      String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.matched || 0)
    ]);
  } else {
    elements.dataUsageCardValue.textContent = t("privacyDocNotScanned", "Not scanned");
    elements.dataUsageCardMeta.textContent = t("reimportFolderToScanDataUsage", "Re-import the project folder to scan data usage disclosures.");
  }

  if (additionalFieldsDoc && additionalFieldsDoc.file) {
    elements.additionalFieldsCardValue.textContent = t("additionalFieldsCardValue", "$1 field(s)", [String(additionalFields.length)]);
    elements.additionalFieldsCardMeta.textContent = additionalFieldsDoc.file.path;
  } else if (additionalFieldsDoc) {
    elements.additionalFieldsCardValue.textContent = t("additionalFieldsDocNoUsableFileShort", "No usable additional fields document found.");
    elements.additionalFieldsCardMeta.textContent = t("additionalFieldsDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
      String(additionalFieldsDoc.candidateCounts && additionalFieldsDoc.candidateCounts.scanned || 0),
      String(additionalFieldsDoc.candidateCounts && additionalFieldsDoc.candidateCounts.matched || 0)
    ]);
  } else {
    elements.additionalFieldsCardValue.textContent = t("additionalFieldsDocNotScanned", "Not scanned");
    elements.additionalFieldsCardMeta.textContent = t("reimportFolderToScanAdditionalFieldsDoc", "Re-import the project folder to scan additional fields.");
  }

  elements.sourceCardValue.textContent = activeProject ? activeProject.name : t("noActiveProject", "No active project");
  elements.sourceCardMeta.textContent = activeProject
    ? [
      activeProject.sourcePath || t("noSourceFolder", "No source folder"),
      activeProject.confidence ? t("detectionConfidence", "Detection: $1 confidence", [formatConfidence(activeProject.confidence)]) : "",
      categoryDoc && categoryDoc.file ? formatCategoryDocSummary(activeProject) : "",
      additionalFieldsDoc && additionalFieldsDoc.file ? formatAdditionalFieldsDocSummary(activeProject) : "",
      t("projectCount", "$1 project(s)", [String(projects.length)])
    ].filter(Boolean).join(" | ")
    : t("importProjectFolder", "Import project/folder");
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
      hasCategoryDocFile(project) ? formatCategoryDocSummary(project) : "",
      hasAdditionalFieldsDocFile(project) ? formatAdditionalFieldsDocSummary(project) : "",
      hasPrivacyDocFile(project) ? formatPrivacyDocSummary(project) : "",
      project.mediaAssets ? formatMediaSummary(project) : "",
      t("refreshReimportFolder", "Refresh: re-import folder"),
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
  updateStatusCards(projects, activeProject);
  renderPrivacyDoc(activeProject);
  renderDataUsageDoc(activeProject);
  renderAdditionalFieldsDoc(activeProject);
  renderProductDetailsCategory(activeProject);
  await renderMediaAssets(activeProject);
  renderListings(activeProject);
  renderLanguageDiagnostics(activeProject);
  renderProjectTable(projects, activeProject && activeProject.id);
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
      (result.candidateCount > 1 ? ` ${t("foundCandidateFolders", "Found $1 candidate folders.", [String(result.candidateCount)])}` : "") +
        (hasPrivacyDocFile(result) ? ` ${formatPrivacyDocSummary(result)}` : "") +
        (hasCategoryDocFile(result) ? ` ${formatCategoryDocSummary(result)}` : "") +
        (hasAdditionalFieldsDocFile(result) ? ` ${formatAdditionalFieldsDocSummary(result)}` : "") +
        (result.mediaAssets ? ` ${formatMediaSummary(result)}` : ""),
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
      (result.candidateCount > 1 ? ` ${t("foundCandidateFolders", "Found $1 candidate folders.", [String(result.candidateCount)])}` : "") +
      (hasPrivacyDocFile(result) ? ` ${formatPrivacyDocSummary(result)}` : "") +
      (hasCategoryDocFile(result) ? ` ${formatCategoryDocSummary(result)}` : "") +
      (hasAdditionalFieldsDocFile(result) ? ` ${formatAdditionalFieldsDocSummary(result)}` : "") +
      (result.mediaAssets ? ` ${formatMediaSummary(result)}` : ""),
    result.imported === 0
  );
}

function handleFileSelection(event) {
  importFolderFileList(event.target.files).catch(error => {
    console.error(error);
    setStatus(t("importFailed", "Import failed: $1", [error.message]), true);
  });
  event.target.value = "";
}

elements.importFolder.addEventListener("click", importFolder);
elements.listingFolderFallback.addEventListener("change", handleFileSelection);

elements.detailTabButtons.forEach(button => {
  button.addEventListener("click", () => {
    selectDetailTab(button.dataset.detailTab);
  });
});

elements.statusCards.forEach(card => {
  card.addEventListener("click", () => {
    selectDetailTab(card.dataset.detailTabTarget);
  });
});

document.addEventListener("keydown", handleDetailTabKeyboardShortcut);

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

elements.deleteProject.addEventListener("click", async () => {
  const project = await storePilotGetActiveProject();
  if (!project || !window.confirm(t("deleteProjectConfirm", "Delete StorePilot project \"$1\"?", [project.name]))) return;

  await storePilotDeleteProject(project.id);
  await renderAll();
  setStatus(t("deletedProject", "Deleted $1.", [project.name]));
});

if (elements.themeModePicker) {
  elements.themeModePicker.addEventListener("change", async event => {
    const settings = await storePilotOptionsUpdateSettings({ theme: event.target.value });
    applyOptionsSettings(settings);
  });
}

if (elements.themeStylePicker) {
  elements.themeStylePicker.addEventListener("change", async event => {
    const settings = await storePilotOptionsUpdateSettings({ themeStyle: event.target.value });
    applyOptionsSettings(settings);
  });
}

elements.themeModeChoices.forEach(button => {
  button.addEventListener("click", async () => {
    const settings = await storePilotOptionsUpdateSettings({ theme: button.dataset.themeModeChoice });
    applyOptionsSettings(settings);
  });
});

elements.showAdvancedFillActions.addEventListener("change", async event => {
  const settings = await storePilotOptionsUpdateSettings({ showAdvancedFillActions: event.target.checked });
  applyOptionsSettings(settings);
});

elements.tabShortcutControls.forEach(control => {
  control.addEventListener("change", async () => {
    const settings = await storePilotOptionsUpdateSettings({
      tabKeyboardShortcuts: {
        ...activeTabKeyboardShortcuts,
        [control.dataset.tabShortcutSetting]: control.checked
      }
    });
    applyOptionsSettings(settings);
  });
});

elements.resetLocalData.addEventListener("click", async () => {
  if (!window.confirm(t(
    "resetLocalDataConfirm",
    "Delete all StorePilot local projects, preferences, dashboard bindings, folder permissions, and media file handles from this browser?"
  ))) {
    return;
  }

  try {
    await storePilotResetLocalData();
    applyOptionsSettings(await storePilotOptionsGetSettings());
    await renderAll();
    setStatus(t("resetLocalDataDone", "Reset StorePilot local data."));
  } catch (error) {
    console.error(error);
    setStatus(t("resetLocalDataFailed", "Reset failed: $1", [error.message]), true);
  }
});

storePilotStorageOnChangedAddListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes[STOREPILOT_OPTIONS_SETTINGS_KEY]) {
    applyOptionsSettings(changes[STOREPILOT_OPTIONS_SETTINGS_KEY].newValue);
  }

  if (changes[STOREPILOT_PROJECTS_STORAGE_KEY] || changes[STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY]) {
    renderAll();
  }
});

(async () => {
  storePilotApplyI18n();
  applyOptionsSettings(await storePilotOptionsGetSettings());
  selectDetailTab("locales");
  await renderAll();
})();
