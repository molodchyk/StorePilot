const SETTINGS_KEY = "storePilotSettings";
const FILL_ALL_STATUS_STORAGE_KEY = "storePilotFillAllStatus";
var STOREPILOT_API = globalThis.browser;

function t(key, fallback, substitutions) {
  return storePilotText(key, fallback, substitutions);
}

if (STOREPILOT_API.tabs && STOREPILOT_API.runtime) {
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
  const stored = await STOREPILOT_API.storage.local.get(SETTINGS_KEY);
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

  await STOREPILOT_API.storage.local.set({ [SETTINGS_KEY]: settings });
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

function isDeveloperDashboardUrl(url = "") {
  return /^https:\/\/(chrome\.google\.com\/webstore\/devconsole|chromewebstore\.google\.com\/devconsole)\//.test(url);
}

function getDashboardSectionFromUrl(url = "") {
  try {
    const { pathname } = new URL(url);
    if (/\/edit\/privacy\/?$/.test(pathname)) return "privacy";
    if (/\/edit(?:\/listing)?\/?$/.test(pathname)) return "listing";
  } catch (_error) {
    // Unknown URLs are handled as non-listing pages.
  }

  return "other";
}

function isListingDashboardUrl(url = "") {
  return isDeveloperDashboardUrl(url) && getDashboardSectionFromUrl(url) === "listing";
}

function isPanelDashboardUrl(url = "") {
  if (!isDeveloperDashboardUrl(url)) return false;
  const section = getDashboardSectionFromUrl(url);
  return section === "listing" || section === "privacy";
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

async function getDashboardProjectContext(tab) {
  const url = tab && tab.url ? tab.url : "";
  const context = {
    url,
    extensionId: typeof storePilotGetDashboardExtensionIdFromUrl === "function"
      ? storePilotGetDashboardExtensionIdFromUrl(url)
      : "",
    title: ""
  };

  if (!context.extensionId || !tab || !tab.id) return context;

  try {
    const result = await sendToActiveTab("storepilot-get-project-context");
    if (result && result.ok && result.context) {
      context.extensionId = result.context.extensionId || context.extensionId;
      context.title = result.context.dashboardItemTitle || "";
    }
  } catch (_error) {
    // The URL id is enough when the dashboard helper is not ready yet.
  }

  return context;
}

async function resolvePopupProject() {
  const { projects, activeProjectId } = await storePilotGetProjectsState();
  const tab = await getActiveTab().catch(() => null);
  const context = tab && isDeveloperDashboardUrl(tab.url || "")
    ? await getDashboardProjectContext(tab)
    : { url: tab && tab.url || "", extensionId: "", title: "" };
  const bindings = typeof storePilotGetDashboardProjectBindings === "function"
    ? await storePilotGetDashboardProjectBindings()
    : {};
  const resolved = typeof storePilotResolveDashboardProjectFromState === "function"
    ? storePilotResolveDashboardProjectFromState({ projects, activeProjectId }, bindings, context)
    : {
      project: projects.find(project => project.id === activeProjectId) || projects[0] || null,
      extensionId: context.extensionId,
      source: "active"
    };

  if (resolved.source === "title" && resolved.extensionId && resolved.project && typeof storePilotBindDashboardProject === "function") {
    await storePilotBindDashboardProject(resolved.extensionId, resolved.project.id, {
      dashboardItemTitle: context.title || "",
      source: "title"
    });
  }

  return {
    projects,
    project: resolved.project || null,
    dashboardExtensionId: resolved.extensionId || context.extensionId || "",
    dashboardProjectSource: resolved.source || "none"
  };
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

async function updateDashboardSectionUi() {
  const tab = await getActiveTab();
  const section = tab && isDeveloperDashboardUrl(tab.url || "")
    ? getDashboardSectionFromUrl(tab.url || "")
    : "other";
  const isListing = section === "listing";
  const isPrivacy = section === "privacy";

  setPopupListingActionsVisible(isListing);
  setPopupPrivacyActionsVisible(isPrivacy);

  if (!isPanelDashboardUrl(tab && tab.url || "")) {
    elements.openPanel.hidden = true;
    getPopupMediaButtons().forEach(button => {
      button.disabled = true;
      button.title = "";
    });
  }
  syncUtilityActionsVisibility();
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

async function sendToActiveTab(typeOrMessage) {
  const tab = await getActiveTab();
  const message = typeof typeOrMessage === "string" ? { type: typeOrMessage } : typeOrMessage;
  const type = message && message.type;
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
    const response = await STOREPILOT_API.tabs.sendMessage(tab.id, message);
    return { ...response, diagnostics: { ...diagnostics, contentScript: t("contentScriptAlreadyConnected", "already connected"), response } };
  } catch (error) {
    diagnostics.initialMessageError = formatError(error);

    try {
      await injectContentScript(tab.id);
      diagnostics.injection = t("injectionSucceeded", "succeeded");
      const response = await STOREPILOT_API.tabs.sendMessage(tab.id, message);
      return { ...response, diagnostics: { ...diagnostics, response } };
    } catch (injectionError) {
      diagnostics.injectionError = formatError(injectionError);
      return {
        ok: false,
        message: t("couldNotConnectDashboard", "StorePilot could not connect to this dashboard tab. Open Diagnostics for the exact error."),
        diagnostics
      };
    }
  }
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

async function uploadMediaFromPopup(kind) {
  const injection = await sendToActiveTab("storepilot-reload");
  if (!injection.ok) return injection;

  return STOREPILOT_API.runtime.sendMessage({
    type: "storepilot-upload-media-assets-from-project",
    requestAccess: true,
    kind
  });
}

async function updateMediaActionState() {
  const tab = await getActiveTab();
  if (!tab || !isListingDashboardUrl(tab.url || "")) {
    getPopupMediaButtons().forEach(button => {
      button.disabled = true;
      button.title = t("listingActionsOnlyOnListingPage", "Listing and media actions are only available on the Store listing page.");
    });
    return;
  }

  const result = await sendToActiveTab("storepilot-get-media-state");
  if (!result.ok || !result.media) return;

  if (result.media.running) {
    setPopupMediaRunning(true, result.media.runningLabel || t("mediaOperationInProgress", "Media operation in progress."));
    return;
  }

  setPopupMediaRunning(false);
  const clearableScreenshots = Boolean(result.media.clearableScreenshots || Number(result.media.screenshots || 0) > 0);
  const clearableStoreIcon = Boolean(result.media.clearableStoreIcon || Number(result.media.storeIcon || 0) > 0);
  const clearableSmallPromo = Boolean(result.media.clearableSmallPromo || Number(result.media.smallPromo || 0) > 0);
  const clearableMarqueePromo = Boolean(result.media.clearableMarqueePromo || Number(result.media.marqueePromo || 0) > 0);
  const screenshotsLimitReached = Boolean(result.media.screenshotsLimitReached);
  const maxScreenshots = String(result.media.maxScreenshots || 5);
  const storeIconPresent = Boolean(result.media.storeIconPresent || Number(result.media.storeIcon || 0) > 0);
  const smallPromoPresent = Boolean(result.media.smallPromoPresent || Number(result.media.smallPromo || 0) > 0);
  const marqueePromoPresent = Boolean(result.media.marqueePromoPresent || Number(result.media.marqueePromo || 0) > 0);

  elements.uploadScreenshots.disabled = screenshotsLimitReached;
  elements.uploadScreenshots.title = screenshotsLimitReached
    ? t("screenshotsLimitReached", "screenshots: CWS limit of $1 already reached", [maxScreenshots])
    : "";
  elements.uploadStoreIcon.disabled = storeIconPresent;
  elements.uploadStoreIcon.title = storeIconPresent
    ? t("mediaAlreadyPresentOrProcessing", "$1 already present or processing.", [t("storeIcon", "Store icon")])
    : "";
  elements.clearScreenshots.disabled = !clearableScreenshots;
  elements.clearScreenshots.title = clearableScreenshots
    ? ""
    : t("mediaAlreadyClearKind", "$1 already clear.", [t("screenshots", "Screenshots")]);
  elements.clearStoreIcon.disabled = !clearableStoreIcon;
  elements.clearStoreIcon.title = clearableStoreIcon
    ? ""
    : t("mediaAlreadyClearKind", "$1 already clear.", [t("storeIcon", "Store icon")]);
  elements.clearSmallPromo.disabled = !clearableSmallPromo;
  elements.clearSmallPromo.title = clearableSmallPromo
    ? ""
    : t("mediaAlreadyClearKind", "$1 already clear.", [t("smallPromoTile", "Small promo tile")]);
  elements.clearMarqueePromo.disabled = !clearableMarqueePromo;
  elements.clearMarqueePromo.title = clearableMarqueePromo
    ? ""
    : t("mediaAlreadyClearKind", "$1 already clear.", [t("marqueePromoTile", "Marquee promo tile")]);

  elements.uploadSmallPromo.disabled = smallPromoPresent;
  elements.uploadSmallPromo.title = smallPromoPresent
    ? t("mediaAlreadyPresentOrProcessing", "$1 already present or processing.", [t("smallPromoTile", "Small promo tile")])
    : "";
  elements.uploadMarqueePromo.disabled = marqueePromoPresent;
  elements.uploadMarqueePromo.title = marqueePromoPresent
    ? t("mediaAlreadyPresentOrProcessing", "$1 already present or processing.", [t("marqueePromoTile", "Marquee promo tile")])
    : "";
}

async function updateOpenPanelButtonState() {
  const tab = await getActiveTab();
  if (!tab || !isPanelDashboardUrl(tab.url || "")) {
    elements.openPanel.hidden = true;
    syncUtilityActionsVisibility();
    return;
  }

  const result = await sendToActiveTab("storepilot-get-panel-state");
  const isVisible = Boolean(result && result.ok && result.panel && result.panel.visible);
  elements.openPanel.hidden = isVisible;
  elements.openPanel.disabled = false;
  elements.openPanel.title = "";
  syncUtilityActionsVisibility();
}

async function clearMediaFromPopup(kind) {
  const injection = await sendToActiveTab("storepilot-reload");
  if (!injection.ok) return injection;

  return sendToActiveTab({
    type: "storepilot-clear-media-assets",
    kind
  });
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
  STOREPILOT_API.runtime.openOptionsPage();
}

elements.openOptionsShortcut.addEventListener("click", openOptionsPageFromPopup);

elements.themeChoices.forEach(button => {
  button.addEventListener("click", async () => {
    const settings = await updateSettings({ theme: button.dataset.themeChoice });
    applySettings(settings);
  });
});

STOREPILOT_API.storage.onChanged.addListener((changes, areaName) => {
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

if (STOREPILOT_API.runtime && STOREPILOT_API.runtime.onMessage) {
  STOREPILOT_API.runtime.onMessage.addListener(message => {
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
