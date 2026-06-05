const SETTINGS_KEY = "storePilotSettings";
var STOREPILOT_API = globalThis.browser;

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
  sourceCardValue: document.getElementById("sourceCardValue"),
  sourceCardMeta: document.getElementById("sourceCardMeta"),
  detailTabButtons: Array.from(document.querySelectorAll("[data-detail-tab]")),
  detailPanels: Array.from(document.querySelectorAll("[data-detail-panel]")),
  statusCards: Array.from(document.querySelectorAll("[data-detail-tab-target]")),
  themeChoices: Array.from(document.querySelectorAll("[data-theme-choice]"))
};

let mediaPreviewUrls = [];

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

function formatConfidence(value) {
  if (value === "high") return t("confidenceHigh", "high");
  if (value === "medium") return t("confidenceMedium", "medium");
  if (value === "low") return t("confidenceLow", "low");
  return value || "";
}

function formatMediaSummary(projectOrResult) {
  return typeof storePilotFormatMediaSummary === "function"
    ? storePilotFormatMediaSummary(projectOrResult && projectOrResult.mediaAssets)
    : "";
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return t("unknown", "Unknown");
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMediaDimensions(asset) {
  if (!asset || !asset.width || !asset.height) return t("unknown", "Unknown");

  const assetType = asset.type && typeof STOREPILOT_MEDIA_ASSET_TYPES !== "undefined"
    ? STOREPILOT_MEDIA_ASSET_TYPES[asset.type]
    : null;
  const alphaLabel = asset.hasAlpha && assetType && !assetType.allowAlpha
    ? `, ${t("alphaChannel", "alpha")}`
    : "";

  return `${asset.width} x ${asset.height}${alphaLabel}`;
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
  const privacyFields = privacyDoc && privacyDoc.file && privacyDoc.file.fields
    ? Object.keys(privacyDoc.file.fields)
    : [];

  elements.listingsCardValue.textContent = t("localesCount", "$1 locales", [String(locales)]);
  elements.listingsCardMeta.textContent = activeProject
    ? t("projectLocalesImported", "$1: $2 locale(s) imported", [activeProject.name, String(locales)])
    : t("noActiveProject", "No active project");

  if (mediaAssets) {
    elements.mediaCardValue.textContent = t("screenshotsCardValue", "$1/5 screenshot(s)", [String((mediaAssets.screenshots || []).length)]);
    elements.mediaCardMeta.textContent = [
      `${t("storeIcon", "Store icon")}: ${formatFoundMissing(mediaAssets.storeIcon)}`,
      `${t("smallPromoTile", "Small promo tile")}: ${formatFoundMissing(mediaAssets.smallPromo)}`,
      `${t("marqueePromoTile", "Marquee promo tile")}: ${formatFoundMissing(mediaAssets.marqueePromo)}`
    ].join(" | ");
  } else {
    elements.mediaCardValue.textContent = t("mediaAssetsNotScanned", "Not scanned");
    elements.mediaCardMeta.textContent = t("reimportFolderToScanMediaAssets", "Re-import the project folder to scan media assets.");
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

  elements.sourceCardValue.textContent = activeProject ? activeProject.name : t("noActiveProject", "No active project");
  elements.sourceCardMeta.textContent = activeProject
    ? [
      activeProject.sourcePath || t("noSourceFolder", "No source folder"),
      activeProject.confidence ? t("detectionConfidence", "Detection: $1 confidence", [formatConfidence(activeProject.confidence)]) : "",
      t("projectCount", "$1 project(s)", [String(projects.length)])
    ].filter(Boolean).join(" | ")
    : t("importProjectFolder", "Import project/folder");
}

function revokeMediaPreviewUrls() {
  mediaPreviewUrls.forEach(url => URL.revokeObjectURL(url));
  mediaPreviewUrls = [];
}

function createMediaPreviewUrl(file) {
  if (!file) return "";
  const url = URL.createObjectURL(file);
  mediaPreviewUrls.push(url);
  return url;
}

function getStoredMediaFile(mediaFiles, kind, index = 0) {
  if (!mediaFiles) return null;
  if (kind === "screenshots") return (mediaFiles.screenshots || [])[index] || null;
  return mediaFiles[kind] || null;
}

function createMediaCard(typeLabel, asset, stateLabel = "", file = null) {
  const card = document.createElement("article");
  const header = document.createElement("div");
  const type = document.createElement("div");
  const dimensions = document.createElement("div");
  const thumb = document.createElement("div");
  const path = document.createElement("div");
  const size = document.createElement("div");
  const previewUrl = createMediaPreviewUrl(file);

  card.className = "media-card";
  header.className = "media-card-header";
  type.className = "media-type";
  dimensions.className = "media-dimensions";
  thumb.className = "media-thumb";
  path.className = "media-path";
  size.className = "count";

  type.textContent = typeLabel;
  dimensions.textContent = asset && asset.width && asset.height ? formatMediaDimensions(asset) : "";
  path.textContent = asset ? asset.path : stateLabel || t("missing", "Missing");
  size.textContent = asset && asset.size ? formatBytes(asset.size) : "";

  if (previewUrl) {
    const image = document.createElement("img");
    image.src = previewUrl;
    image.alt = typeLabel;
    thumb.append(image);
  } else {
    thumb.textContent = asset ? t("previewUnavailable", "Preview unavailable") : stateLabel || t("missing", "Missing");
  }

  header.append(type, dimensions);
  card.append(header, thumb, path, size);
  return card;
}

function createPrivacyRow(typeLabel, value, stateLabel = "") {
  const row = document.createElement("div");
  const type = document.createElement("div");
  const preview = document.createElement("div");
  const count = document.createElement("div");

  row.className = "privacy-row";
  type.className = "privacy-type";
  preview.className = "preview";
  count.className = "count";

  type.textContent = typeLabel;
  preview.textContent = value || stateLabel || t("missing", "Missing");
  count.textContent = value ? t("charCount", "$1 chars", [String(value.length)]) : "";

  row.append(type, preview, count);
  return row;
}

function formatPrivacyDocSummary(projectOrResult) {
  return typeof storePilotFormatPrivacyDocSummary === "function"
    ? storePilotFormatPrivacyDocSummary(projectOrResult && projectOrResult.privacyDoc)
    : "";
}

function hasPrivacyDocFile(projectOrResult) {
  return Boolean(projectOrResult && projectOrResult.privacyDoc && projectOrResult.privacyDoc.file);
}

function renderPrivacyDoc(project) {
  const privacyDoc = project && project.privacyDoc;

  if (!project) {
    elements.privacySummary.textContent = t("noActiveProject", "No active project");
    elements.privacyTable.innerHTML = "";
    return;
  }

  if (!privacyDoc) {
    elements.privacySummary.textContent = t("privacyDocNotScanned", "Not scanned");
    elements.privacyTable.replaceChildren(createPrivacyRow(
      t("privacyDocument", "Privacy Document"),
      "",
      project.hasFolderHandle
        ? t("reimportFolderToScanPrivacyDoc", "Re-import the project folder to scan the privacy document.")
        : t("reimportFolderToScanPrivacyDoc", "Re-import the project folder to scan the privacy document.")
    ));
    return;
  }

  elements.privacySummary.textContent = formatPrivacyDocSummary(project);

  if (!privacyDoc.file) {
    elements.privacyTable.replaceChildren(
      createPrivacyRow(t("status", "Status"), "", t("privacyDocNoUsableFileShort", "No usable privacy document found.")),
      createPrivacyRow(
        t("privacyDocCandidateCounts", "Candidates"),
        t("privacyDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
          String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0),
          String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.matched || 0)
        ])
      )
    );
    return;
  }

  const fields = privacyDoc.file.fields || {};
  const rows = [
    createPrivacyRow(t("privacyDocFile", "File"), privacyDoc.file.path),
    ...Object.keys(fields).map(key => createPrivacyRow(key, fields[key])),
    createPrivacyRow(
      t("privacyDocCandidateCounts", "Candidates"),
      t("privacyDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
        String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0),
        String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.matched || 0)
      ])
    )
  ];

  elements.privacyTable.replaceChildren(...rows);
}

async function renderMediaAssets(project) {
  const mediaAssets = project && project.mediaAssets;
  revokeMediaPreviewUrls();

  if (!project) {
    elements.mediaSummary.textContent = t("noActiveProject", "No active project");
    elements.mediaTable.innerHTML = "";
    return;
  }

  if (!mediaAssets) {
    elements.mediaSummary.textContent = t("mediaAssetsNotScanned", "Not scanned");
    elements.mediaTable.replaceChildren(createMediaCard(
      t("storeMediaAssets", "Store media assets"),
      null,
      project.hasFolderHandle
        ? t("reimportFolderToScanMediaAssets", "Re-import the project folder to scan media assets.")
        : t("reimportFolderToScanMediaAssets", "Re-import the project folder to scan media assets.")
    ));
    return;
  }

  const screenshots = mediaAssets.screenshots || [];
  const mediaFiles = project && project.id && typeof storePilotGetProjectMediaFiles === "function"
    ? await storePilotGetProjectMediaFiles(project.id).catch(() => null)
    : null;
  elements.mediaSummary.textContent = formatMediaSummary(project);

  elements.mediaTable.replaceChildren(
    createMediaCard(
      t("storeIcon", "Store icon"),
      mediaAssets.storeIcon,
      "",
      getStoredMediaFile(mediaFiles, "storeIcon")
    ),
    ...(screenshots.length ? screenshots.map((asset, index) => createMediaCard(
      t("screenshotNumber", "Screenshot $1", [String(index + 1)]),
      asset,
      "",
      getStoredMediaFile(mediaFiles, "screenshots", index)
    )) : [createMediaCard(t("screenshots", "Screenshots"), null)]),
    createMediaCard(
      t("smallPromoTile", "Small promo tile"),
      mediaAssets.smallPromo,
      "",
      getStoredMediaFile(mediaFiles, "smallPromo")
    ),
    createMediaCard(
      t("marqueePromoTile", "Marquee promo tile"),
      mediaAssets.marqueePromo,
      "",
      getStoredMediaFile(mediaFiles, "marqueePromo")
    ),
    createMediaCard(
      t("mediaCandidateCounts", "Candidates"),
      {
        path: t("mediaCandidateCountsValue", "Icon: $1; screenshots: $2; small promo: $3; marquee promo: $4.", [
          String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.storeIcon || 0),
          String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.screenshots || 0),
          String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.smallPromo || 0),
          String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.marqueePromo || 0)
        ]),
        width: "",
        height: "",
        size: 0
      }
    )
  );
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
  await renderMediaAssets(activeProject);
  renderListings(activeProject);
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
  selectDetailTab("locales");
  await renderAll();
})();
