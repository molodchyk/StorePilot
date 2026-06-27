const LEGACY_STORAGE_KEY = "storePilotListings";
var STOREPILOT_API = globalThis.STOREPILOT_API || globalThis.browser || globalThis.chrome;
const PROJECTS_STORAGE_KEY = "storePilotProjects";
const ACTIVE_PROJECT_STORAGE_KEY = "storePilotActiveProjectId";
const DASHBOARD_PROJECT_BINDINGS_STORAGE_KEY = "storePilotDashboardProjectBindings";
const SETTINGS_KEY = "storePilotSettings";
const FILL_ALL_STATUS_STORAGE_KEY = "storePilotFillAllStatus";
const PANEL_POSITION_STORAGE_KEY = "storePilotPanelPosition";
const PANEL_MODE_STORAGE_KEY = "storePilotPanelMode";
const PANEL_ID = "storepilot-panel";

let listings = {};
let selectedLocale = "";
let activeProjectName = "";
let activeProjectId = "";
let activeProjectUpdatedAt = "";
let activeDashboardExtensionId = "";
let activeDashboardItemTitle = "";
let activeDashboardProjectSource = "";
let activeProjectLocalization = null;
let activeProjectLanguagePickerMode = "";
let activePrivacyDoc = null;
let activeCategoryDoc = null;
let activeAdditionalFieldsDoc = null;
let currentTheme = "system";
let currentThemeStyle = "default";
let showAdvancedFillActions = false;
let isFillingAllLanguages = false;
let fillAllAbortRequested = false;
let fillAllStatus = {
  running: false,
  message: ""
};
let panelViewportClampController = null;
let panelMediaStateObserver = null;
let dashboardSectionWatcherId = 0;
let mediaOperationState = {
  running: false,
  label: "",
  abortRequested: false
};

function localize(key, fallback, substitutions) {
  const message = storePilotI18nGetMessage(key, substitutions);
  const values = substitutions ? (Array.isArray(substitutions) ? substitutions : [substitutions]) : [];
  return String(message || fallback || "").replace(/\$(\d+)/g, (_match, index) => {
    const value = values[Number(index) - 1];
    return value === undefined || value === null ? "" : String(value);
  });
}

function getDashboardSectionFromUrl(url = window.location.href) {
  return storePilotGetDashboardSectionFromUrl(url);
}

function isListingDashboardSection() {
  return getDashboardSectionFromUrl() === "listing";
}

function isPrivacyDashboardSection() {
  return getDashboardSectionFromUrl() === "privacy";
}

function isPanelDashboardSection() {
  const section = getDashboardSectionFromUrl();
  return section === "listing" || section === "privacy";
}

function createWrongDashboardSectionResult() {
  return {
    ok: false,
    message: localize("listingActionsOnlyOnListingPage", "Listing and media actions are only available on the Store listing page.")
  };
}

function formatDisplayTimestamp(value) {
  if (!value) return localize("never", "Never");

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return localize("unknown", "Unknown");

  const pad = number => String(number).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

async function loadSettings() {
  const stored = await storePilotStorageLocalGet([SETTINGS_KEY]);
  applySettings(stored[SETTINGS_KEY]);
  return {
    theme: currentTheme,
    themeStyle: currentThemeStyle,
    showAdvancedFillActions
  };
}

function applySettings(settings = {}) {
  const rawSettings = settings && typeof settings === "object" ? settings : {};
  const themePreferences = storePilotNormalizeThemePreferences(rawSettings);
  const normalized = {
    theme: "system",
    themeStyle: "default",
    showAdvancedFillActions: false,
    ...rawSettings,
    ...themePreferences
  };

  currentTheme = normalized.theme;
  currentThemeStyle = normalized.themeStyle;
  showAdvancedFillActions = Boolean(normalized.showAdvancedFillActions);
}

async function loadListings() {
  const stored = await storePilotStorageLocalGet([
    LEGACY_STORAGE_KEY,
    PROJECTS_STORAGE_KEY,
    ACTIVE_PROJECT_STORAGE_KEY,
    DASHBOARD_PROJECT_BINDINGS_STORAGE_KEY
  ]);
  const projects = stored[PROJECTS_STORAGE_KEY] || [];
  const bindings = stored[DASHBOARD_PROJECT_BINDINGS_STORAGE_KEY] && typeof stored[DASHBOARD_PROJECT_BINDINGS_STORAGE_KEY] === "object"
    ? stored[DASHBOARD_PROJECT_BINDINGS_STORAGE_KEY]
    : {};
  const resolved = storePilotResolveDashboardProject(projects, stored[ACTIVE_PROJECT_STORAGE_KEY], bindings);
  const activeProject = resolved.project || null;

  listings = activeProject ? activeProject.listings || {} : stored[LEGACY_STORAGE_KEY] || {};
  activeProjectId = activeProject ? activeProject.id : "";
  activeProjectName = activeProject ? activeProject.name : "";
  activeProjectUpdatedAt = activeProject ? activeProject.lastSyncedAt || "" : "";
  activeDashboardExtensionId = resolved.extensionId || "";
  activeDashboardItemTitle = resolved.dashboardTitle || "";
  activeDashboardProjectSource = resolved.source || "";
  activeProjectLocalization = activeProject ? storePilotGetProjectLocalization(activeProject) : null;
  activeProjectLanguagePickerMode = activeProject
    ? storePilotGetExpectedLanguageDropdownModeForProject(activeProject, listings)
    : "";
  activePrivacyDoc = activeProject ? activeProject.privacyDoc || null : null;
  activeCategoryDoc = activeProject ? activeProject.categoryDoc || null : null;
  activeAdditionalFieldsDoc = activeProject ? activeProject.additionalFieldsDoc || null : null;
  if (activeProject && activeDashboardExtensionId && resolved.source === "title") {
    storePilotSaveDashboardProjectBinding(activeDashboardExtensionId, activeProject, activeDashboardItemTitle, "title").catch(() => {});
  }

  const locales = Object.keys(listings).sort((a, b) => a.localeCompare(b));

  if (!selectedLocale || !listings[selectedLocale]) {
    selectedLocale = locales[0] || "";
  }

  return locales;
}

function abortCurrentOperation() {
  const message = localize("abortRequestedStopAfterStep", "Abort requested. StorePilot will stop after the current dashboard step.");

  if (isFillingAllLanguages) {
    fillAllAbortRequested = true;
    publishFillAllStatus({
      running: true,
      message
    });
    return { ok: true, message };
  }

  if (mediaOperationState.running) {
    mediaOperationState.abortRequested = true;
    const panelStatus = document.querySelector(`#${PANEL_ID} .storepilot-status`);
    if (panelStatus) {
      panelStatus.textContent = message;
    }
    return { ok: true, message };
  }

  return { ok: false, message: localize("noOperationRunning", "No operation is running.") };
}

function abortFillAllLanguages() {
  if (!isFillingAllLanguages) {
    return { ok: false, message: localize("fillAllNotRunning", "Description fill is not running.") };
  }

  fillAllAbortRequested = true;
  const message = localize("abortRequestedStopAfterStep", "Abort requested. StorePilot will stop after the current dashboard step.");
  publishFillAllStatus({
    running: true,
    message
  });
  return { ok: true, message };
}

async function diagnoseDashboardPage() {
  await loadListings();

  const expectedLanguageDropdownMode = getExpectedLanguageDropdownMode();
  const dropdown = findLanguageDropdown(Object.keys(listings)[0] || "", expectedLanguageDropdownMode);
  const categoryDropdown = findCategoryDropdown();
  const descriptionField = findDescriptionField();
  const mediaUploadTargets = getMediaUploadDiagnostics();
  const activeCategory = getActiveCategorySelection();
  let dropdownOptions = [];

  if (dropdown) {
    const opened = await openLanguageDropdown(Object.keys(listings)[0] || "", expectedLanguageDropdownMode);
    if (opened.ok) {
      const allDropdownOptions = getLanguageOptionsForMode(opened, opened.mode || expectedLanguageDropdownMode);
      const visibleDropdownOptions = getOpenLanguageOptions(opened.dropdown, true);
      dropdownOptions = allDropdownOptions.map(option => ({
        locale: option.locale,
        value: option.value,
        text: option.text
      }));
      dropdownOptions.visibleCount = visibleDropdownOptions.length;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await delay(100);
    }
  }

  const diagnostics = {
    url: location.href,
    dashboardExtensionId: activeDashboardExtensionId,
    dashboardItemTitle: activeDashboardItemTitle,
    dashboardProjectSource: activeDashboardProjectSource,
    activeProjectId,
    activeProjectName,
    activeProjectLocalization,
    importedLocaleCount: Object.keys(listings).length,
    selectedLocale,
    languageDropdownFound: Boolean(dropdown),
    languageDropdownText: dropdown ? getVisibleText(dropdown) : "",
    languageDropdownSelectedText: dropdown ? getLanguageDropdownSelectedText(dropdown) : "",
    languageDropdownMode: dropdown ? getLanguageDropdownMode(dropdown) : "",
    expectedLanguageDropdownMode,
    languageDropdownScore: dropdown ? scoreLanguageDropdown(dropdown, Object.keys(listings)[0] || "") : 0,
    currentDashboardLocale: getCurrentDashboardLocale(),
    dashboardLanguageOptionCount: dropdownOptions.length,
    dashboardVisibleLanguageOptionCount: dropdownOptions.visibleCount || dropdownOptions.length,
    firstDashboardLanguageOptions: dropdownOptions.slice(0, 8),
    categoryDropdownFound: Boolean(categoryDropdown),
    categoryDropdownText: categoryDropdown ? getCategoryDropdownSelectedText(categoryDropdown) : "",
    importedCategory: activeCategory ? activeCategory.label : "",
    importedCategoryPath: activeCategory ? activeCategory.path : "",
    mediaUploadTargets,
    descriptionFieldFound: Boolean(descriptionField),
    descriptionFieldLabel: descriptionField
      ? getVisibleText(document.getElementById(descriptionField.getAttribute("aria-labelledby")))
      : "",
    descriptionFieldMaxLength: descriptionField ? descriptionField.getAttribute("maxlength") || "" : ""
  };

  return {
    ok: diagnostics.languageDropdownFound && diagnostics.descriptionFieldFound,
    message: diagnostics.languageDropdownFound && diagnostics.descriptionFieldFound
      ? localize("dashboardDiagnosticsPassed", "Dashboard diagnostics passed.")
      : localize("dashboardDiagnosticsMissingElements", "Dashboard diagnostics found missing page elements."),
    diagnostics
  };
}

function injectStyles() {
  globalThis.storePilotInjectDashboardPanelStyles(PANEL_ID);
}

(async () => {
  injectStyles();
  bindDashboardSectionWatcher();
  await loadSettings();
  renderPanel(await loadListings());
})();

storePilotStorageOnChangedAddListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes[SETTINGS_KEY]) {
    applySettings(changes[SETTINGS_KEY].newValue);
    renderPanel(Object.keys(listings).sort((a, b) => a.localeCompare(b)));
  }

  if (changes[PROJECTS_STORAGE_KEY] || changes[ACTIVE_PROJECT_STORAGE_KEY] || changes[DASHBOARD_PROJECT_BINDINGS_STORAGE_KEY]) {
    loadListings()
      .then(renderPanel)
      .catch(() => {});
  }
});
