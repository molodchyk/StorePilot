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
let activePrivacyDoc = null;
let activeCategoryDoc = null;
let activeAdditionalFieldsDoc = null;
let currentTheme = "system";
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

function getStoredPanelPosition() {
  try {
    return JSON.parse(window.localStorage.getItem(PANEL_POSITION_STORAGE_KEY) || "null");
  } catch (_error) {
    return null;
  }
}

function savePanelPosition(position) {
  try {
    window.localStorage.setItem(PANEL_POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch (_error) {
    // The panel can still be dragged for this session if page storage is unavailable.
  }
}

function normalizePanelMode(mode) {
  return ["expanded", "minimized", "hidden"].includes(mode) ? mode : "expanded";
}

function getStoredPanelMode() {
  try {
    return normalizePanelMode(window.localStorage.getItem(PANEL_MODE_STORAGE_KEY));
  } catch (_error) {
    return "expanded";
  }
}

function savePanelMode(mode) {
  try {
    window.localStorage.setItem(PANEL_MODE_STORAGE_KEY, normalizePanelMode(mode));
  } catch (_error) {
    // Panel mode is convenience state; the panel can still be controlled this session.
  }
}

function removePanel() {
  if (panelMediaStateObserver) {
    panelMediaStateObserver.disconnect();
    panelMediaStateObserver = null;
  }

  if (panelViewportClampController) {
    panelViewportClampController.abort();
    panelViewportClampController = null;
  }

  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.remove();
}

function applyPanelMode(panel, mode) {
  if (!panel) return;

  const normalizedMode = normalizePanelMode(mode);
  panel.dataset.panelMode = normalizedMode;

  const toggleButton = panel.querySelector("[data-storepilot-action='toggle-panel-mode']");
  if (toggleButton) {
    const isMinimized = normalizedMode === "minimized";
    toggleButton.textContent = isMinimized ? "+" : "-";
    toggleButton.title = isMinimized
      ? localize("maximizePanel", "Maximize panel")
      : localize("minimizePanel", "Minimize panel");
    toggleButton.setAttribute("aria-label", toggleButton.title);
  }
}

function setPanelMode(panel, mode) {
  const normalizedMode = normalizePanelMode(mode);
  savePanelMode(normalizedMode);

  if (normalizedMode === "hidden") {
    removePanel();
    return;
  }

  applyPanelMode(panel, normalizedMode);
  clampPanelToViewport(panel, false);
}

function getPanelState() {
  const panel = document.getElementById(PANEL_ID);
  const mode = getStoredPanelMode();
  return {
    mode,
    visible: Boolean(panel) && mode !== "hidden",
    minimized: Boolean(panel) && panel.dataset.panelMode === "minimized"
  };
}

function clampPanelPosition(panel, left, top) {
  const margin = 8;
  const rect = panel.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);

  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop)
  };
}

function setPanelPosition(panel, position) {
  if (!position || !Number.isFinite(position.left) || !Number.isFinite(position.top)) return;

  const nextPosition = clampPanelPosition(panel, position.left, position.top);
  panel.style.left = `${nextPosition.left}px`;
  panel.style.top = `${nextPosition.top}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

function applyStoredPanelPosition(panel) {
  setPanelPosition(panel, getStoredPanelPosition());
}

function clampPanelToViewport(panel, savePosition = true) {
  if (!panel || !panel.isConnected) return;

  const rect = panel.getBoundingClientRect();
  const nextPosition = clampPanelPosition(panel, rect.left, rect.top);
  setPanelPosition(panel, nextPosition);
  if (savePosition) {
    savePanelPosition(nextPosition);
  }
}

function bindPanelViewportClamp(panel) {
  if (panelViewportClampController) {
    panelViewportClampController.abort();
  }

  panelViewportClampController = new AbortController();
  let frameId = 0;

  function scheduleClamp() {
    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      clampPanelToViewport(panel);
    });
  }

  window.addEventListener("resize", scheduleClamp, { signal: panelViewportClampController.signal });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleClamp, { signal: panelViewportClampController.signal });
    window.visualViewport.addEventListener("scroll", scheduleClamp, { signal: panelViewportClampController.signal });
  }
}

function bindDashboardSectionWatcher() {
  if (dashboardSectionWatcherId) return;

  let previousUrl = window.location.href;
  dashboardSectionWatcherId = window.setInterval(() => {
    if (window.location.href === previousUrl) return;
    previousUrl = window.location.href;

    if (!isPanelDashboardSection()) {
      removePanel();
      return;
    }

    loadSettings()
      .then(() => loadListings())
      .then(renderPanel)
      .catch(() => {});
  }, 600);
}

function getDashboardMediaState() {
  const screenshotCount = getVisibleMediaImageCount("screenshots");
  const storeIconPresent = hasExistingOrProcessingMedia("storeIcon");
  const smallPromoPresent = hasExistingOrProcessingMedia("smallPromo");
  const marqueePromoPresent = hasExistingOrProcessingMedia("marqueePromo");

  return {
    screenshots: screenshotCount,
    storeIcon: getVisibleMediaImageCount("storeIcon"),
    smallPromo: getVisibleMediaImageCount("smallPromo"),
    marqueePromo: getVisibleMediaImageCount("marqueePromo"),
    clearableScreenshots: hasClearableMedia("screenshots"),
    clearableStoreIcon: hasClearableMedia("storeIcon"),
    clearableSmallPromo: hasClearableMedia("smallPromo"),
    clearableMarqueePromo: hasClearableMedia("marqueePromo"),
    screenshotsLimitReached: screenshotCount >= MAX_DASHBOARD_SCREENSHOTS,
    maxScreenshots: MAX_DASHBOARD_SCREENSHOTS,
    storeIconPresent,
    smallPromoPresent,
    marqueePromoPresent,
    running: mediaOperationState.running,
    runningLabel: mediaOperationState.label
  };
}

function getPanelMediaButtons(panel = document.getElementById(PANEL_ID)) {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll([
    "[data-storepilot-action='upload-storeIcon']",
    "[data-storepilot-action='upload-screenshots']",
    "[data-storepilot-action='upload-smallPromo']",
    "[data-storepilot-action='upload-marqueePromo']",
    "[data-storepilot-action='clear-screenshots']",
    "[data-storepilot-action='clear-storeIcon']",
    "[data-storepilot-action='clear-smallPromo']",
    "[data-storepilot-action='clear-marqueePromo']"
  ].join(",")));
}

function setPanelMediaButtonsDisabled(disabled, title = "") {
  for (const button of getPanelMediaButtons()) {
    button.disabled = disabled;
    button.title = title;
  }
}

function updatePanelMediaUi() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const fillAllRunning = Boolean(isFillingAllLanguages || fillAllStatus.running);
  if (mediaOperationState.running) {
    setPanelMediaButtonsDisabled(true, mediaOperationState.label);
    updatePanelFillAllUi();
    return;
  }

  if (fillAllRunning) {
    setPanelMediaButtonsDisabled(true, localize("fillingAllLanguages", "Filling descriptions..."));
    return;
  }

  for (const button of getPanelMediaButtons(panel)) {
    button.disabled = false;
    button.title = "";
  }

  for (const kind of ["screenshots", "storeIcon", "smallPromo", "marqueePromo"]) {
    const button = panel.querySelector(`[data-storepilot-action='clear-${kind}']`);
    if (!button) continue;

    const hasMedia = hasClearableMedia(kind);
    button.disabled = !hasMedia;
    button.title = hasMedia
      ? ""
      : localize("mediaAlreadyClearKind", "$1 already clear.", [getMediaUploadKindLabel(kind)]);
  }

  for (const kind of ["storeIcon", "smallPromo", "marqueePromo"]) {
    const button = panel.querySelector(`[data-storepilot-action='upload-${kind}']`);
    if (!button) continue;

    const alreadyPresent = hasExistingOrProcessingMedia(kind);
    button.disabled = alreadyPresent;
    button.title = alreadyPresent
      ? localize("mediaAlreadyPresentOrProcessing", "$1 already present or processing.", [getMediaUploadKindLabel(kind)])
      : "";
  }

  const uploadScreenshotsButton = panel.querySelector("[data-storepilot-action='upload-screenshots']");
  if (uploadScreenshotsButton) {
    const screenshotCount = getVisibleMediaImageCount("screenshots");
    const limitReached = screenshotCount >= MAX_DASHBOARD_SCREENSHOTS;
    uploadScreenshotsButton.disabled = limitReached;
    uploadScreenshotsButton.title = limitReached
      ? localize("screenshotsLimitReached", "screenshots: CWS limit of $1 already reached", [String(MAX_DASHBOARD_SCREENSHOTS)])
      : "";
  }
}

async function runExclusiveMediaOperation(label, operation) {
  if (mediaOperationState.running) {
    return {
      ok: true,
      ignored: true,
      message: localize("mediaOperationAlreadyRunning", "Media operation already running: $1.", [mediaOperationState.label])
    };
  }

  mediaOperationState = {
    running: true,
    label,
    abortRequested: false
  };
  updatePanelMediaUi();
  updatePanelFillAllUi();

  try {
    return await operation();
  } finally {
    mediaOperationState = {
      running: false,
      label: "",
      abortRequested: false
    };
    updatePanelMediaUi();
    updatePanelFillAllUi();
  }
}

function bindPanelMediaState(panel) {
  if (panelMediaStateObserver) {
    panelMediaStateObserver.disconnect();
  }

  let frameId = 0;
  function scheduleUpdate() {
    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      updatePanelMediaUi();
    });
  }

  panelMediaStateObserver = new MutationObserver(scheduleUpdate);
  panelMediaStateObserver.observe(document.body || document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "style", "aria-label", "data-image-key"]
  });

  updatePanelMediaUi();
  window.setTimeout(updatePanelMediaUi, 300);
  window.setTimeout(updatePanelMediaUi, 1200);
}

function enablePanelDrag(panel, dragHandle) {
  if (!panel || !dragHandle) return;

  dragHandle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.target.closest("button, select, input, textarea, a")) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    panel.dataset.dragging = "true";
    panel.setPointerCapture(event.pointerId);
    event.preventDefault();

    function movePanel(moveEvent) {
      const nextPosition = clampPanelPosition(
        panel,
        moveEvent.clientX - offsetX,
        moveEvent.clientY - offsetY
      );
      setPanelPosition(panel, nextPosition);
    }

    function stopDragging() {
      delete panel.dataset.dragging;
      savePanelPosition({
        left: panel.getBoundingClientRect().left,
        top: panel.getBoundingClientRect().top
      });
      panel.removeEventListener("pointermove", movePanel);
      panel.removeEventListener("pointerup", stopDragging);
      panel.removeEventListener("pointercancel", stopDragging);
    }

    panel.addEventListener("pointermove", movePanel);
    panel.addEventListener("pointerup", stopDragging);
    panel.addEventListener("pointercancel", stopDragging);
  });
}

async function loadSettings() {
  const stored = await storePilotStorageLocalGet([SETTINGS_KEY]);
  applySettings(stored[SETTINGS_KEY]);
  return {
    theme: currentTheme,
    showAdvancedFillActions
  };
}

function applySettings(settings = {}) {
  const normalized = {
    theme: "system",
    showAdvancedFillActions: false,
    ...(settings || {})
  };

  currentTheme = normalized.theme || "system";
  showAdvancedFillActions = Boolean(normalized.showAdvancedFillActions);
}

function getEditableCandidates() {
  const selectors = [
    "textarea",
    "input[type='text']",
    "input:not([type])",
    "[contenteditable='true']",
    "[role='textbox']"
  ].join(",");

  return Array.from(document.querySelectorAll(selectors)).filter(isVisible);
}

function findLikelyListingField() {
  const candidates = getEditableCandidates();
  const focused = document.activeElement;

  if (candidates.includes(focused)) {
    return focused;
  }

  const textareas = candidates.filter(element => element.tagName.toLowerCase() === "textarea");
  if (textareas.length) {
    return textareas.sort((a, b) => {
      const areaA = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
      const areaB = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
      return areaB - areaA;
    })[0];
  }

  return candidates[0] || null;
}

function normalizeDashboardExtensionId(value) {
  return storePilotNormalizeDashboardExtensionId(value);
}

function getDashboardExtensionIdFromUrl(url = window.location.href) {
  return storePilotGetDashboardExtensionIdFromUrl(url);
}

function findDashboardIdElement() {
  return Array.from(document.querySelectorAll("header span, main span, span"))
    .filter(isVisible)
    .find(element => /\bID:\s*[a-p]{32}\b/i.test(getVisibleText(element)));
}

function getDashboardExtensionIdFromHeader() {
  const idElement = findDashboardIdElement();
  const match = idElement ? getVisibleText(idElement).match(/\bID:\s*([a-p]{32})\b/i) : null;
  return normalizeDashboardExtensionId(match && match[1]);
}

function getDashboardExtensionId() {
  return getDashboardExtensionIdFromUrl() || getDashboardExtensionIdFromHeader();
}

function cleanDashboardItemTitle(value) {
  return String(value || "")
    .replace(/\bID:\s*[a-p]{32}\b/ig, "")
    .replace(/\bStatus:\s*.+$/i, "")
    .replace(/\bChrome Web Store Developer Dashboard\b/ig, "")
    .replace(/\bPublisher:\s*.+$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getDashboardItemTitle() {
  const idElement = findDashboardIdElement();
  const localContainer = idElement && idElement.closest(".oMEecd, .E0X3S, header");
  const localTitle = cleanDashboardItemTitle(localContainer ? getVisibleText(localContainer) : "");
  if (localTitle && localTitle.length <= 160) return localTitle;

  const selectors = [
    "header .oMEecd",
    "header h1",
    "header a",
    "main h1",
    "article h1"
  ].join(",");
  const candidates = Array.from(document.querySelectorAll(selectors))
    .filter(isVisible)
    .map(element => cleanDashboardItemTitle(getVisibleText(element)))
    .filter(text => text && text.length <= 160 && !/^id:/i.test(text));

  return candidates[0] || "";
}

async function saveDashboardProjectBinding(extensionId, project, source = "title") {
  if (!project || !project.id) return;

  await storePilotBindDashboardProject(extensionId, project.id, {
    dashboardItemTitle: activeDashboardItemTitle || getDashboardItemTitle(),
    source
  });
}

function resolveDashboardProject(projects, activeStoredProjectId, bindings) {
  const extensionId = getDashboardExtensionId();
  const dashboardTitle = getDashboardItemTitle();
  const resolved = storePilotResolveDashboardProjectFromState(
    { projects, activeProjectId: activeStoredProjectId },
    bindings,
    { extensionId, title: dashboardTitle }
  );

  return {
    ...resolved,
    dashboardTitle
  };
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
  const resolved = resolveDashboardProject(projects, stored[ACTIVE_PROJECT_STORAGE_KEY], bindings);
  const activeProject = resolved.project || null;

  listings = activeProject ? activeProject.listings || {} : stored[LEGACY_STORAGE_KEY] || {};
  activeProjectId = activeProject ? activeProject.id : "";
  activeProjectName = activeProject ? activeProject.name : "";
  activeProjectUpdatedAt = activeProject ? activeProject.lastSyncedAt || "" : "";
  activeDashboardExtensionId = resolved.extensionId || "";
  activeDashboardItemTitle = resolved.dashboardTitle || "";
  activeDashboardProjectSource = resolved.source || "";
  activePrivacyDoc = activeProject ? activeProject.privacyDoc || null : null;
  activeCategoryDoc = activeProject ? activeProject.categoryDoc || null : null;
  activeAdditionalFieldsDoc = activeProject ? activeProject.additionalFieldsDoc || null : null;
  if (activeProject && activeDashboardExtensionId && resolved.source === "title") {
    saveDashboardProjectBinding(activeDashboardExtensionId, activeProject, "title").catch(() => {});
  }

  const locales = Object.keys(listings).sort((a, b) => a.localeCompare(b));

  if (!selectedLocale || !listings[selectedLocale]) {
    selectedLocale = locales[0] || "";
  }

  return locales;
}

function getSelectedText() {
  return selectedLocale ? listings[selectedLocale] || "" : "";
}

async function copySelectedText() {
  const text = getSelectedText();
  if (!text) return { ok: false, message: localize("noListingSelected", "No listing selected.") };

  await navigator.clipboard.writeText(text);
  return { ok: true, message: localize("copiedLocale", "Copied $1.", [selectedLocale]) };
}

function fillSelectedText() {
  const text = getSelectedText();
  if (!text) return { ok: false, message: localize("noListingSelected", "No listing selected.") };

  const target = findLikelyListingField();
  if (!target) {
    return { ok: false, message: localize("noVisibleEditableField", "No visible editable field found.") };
  }

  fillElement(target, text);
  return { ok: true, message: localize("filledLocale", "Filled $1.", [selectedLocale]) };
}

function normalizeLocale(locale) {
  return String(locale || "").replace("-", "_").toLowerCase();
}

function getEquivalentLocales(locale) {
  const normalizedLocale = normalizeLocale(locale);
  const aliases = {
    he: ["iw"],
    iw: ["he"],
    id: ["in"],
    in: ["id"],
    no: ["nb"],
    nb: ["no"]
  };

  return Array.from(new Set([
    normalizedLocale,
    ...(aliases[normalizedLocale] || [])
  ].filter(Boolean)));
}

function localesMatch(left, right) {
  const rightLocales = new Set(getEquivalentLocales(right));
  return getEquivalentLocales(left).some(locale => rightLocales.has(locale));
}

function normalizeLanguageText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizePotentialLocaleCode(value) {
  const normalized = normalizeLocale(value);
  return /^[a-z]{2,3}(?:_[a-z0-9]{2,4})?$/.test(normalized) ? normalized : "";
}

function getLocaleDisplayLabels(locale) {
  const normalizedLocale = normalizeLocale(locale);
  const languageTag = normalizedLocale.replace("_", "-");
  const baseLanguage = normalizedLocale.split("_")[0];
  const labels = new Set([normalizedLocale, languageTag, baseLanguage]);

  if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    [languageTag, baseLanguage].forEach(tag => {
      try {
        const label = displayNames.of(tag);
        if (label) labels.add(label);
      } catch (_error) {
        // Keep code-based labels for locale tags Intl cannot display.
      }
    });
  }

  if (normalizedLocale === "en") {
    labels.add("English Standard");
    labels.add("English (Standard)");
  }

  return Array.from(labels).map(normalizeLanguageText).filter(Boolean);
}

function getListingLocaleKey(locale) {
  const normalized = normalizeLocale(locale);
  return Object.keys(listings).find(key => (
    normalizeLocale(key) === normalized ||
    localesMatch(key, normalized)
  )) || "";
}

function getLocaleFromText(text, localeKeys = Object.keys(listings)) {
  const normalizedText = normalizeLocale(text);
  const sortedLocaleKeys = [...localeKeys].sort((a, b) => b.length - a.length);

  for (const locale of sortedLocaleKeys) {
    const localeMatches = getEquivalentLocales(locale).sort((a, b) => b.length - a.length);

    for (const normalizedLocale of localeMatches) {
      const escaped = normalizedLocale.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");

      if (pattern.test(normalizedText)) {
        return locale;
      }
    }
  }

  const normalizedLanguageText = normalizeLanguageText(text);
  const labelMatches = sortedLocaleKeys
    .flatMap(locale => getLocaleDisplayLabels(locale).map(label => ({ locale, label })))
    .sort((a, b) => b.label.length - a.label.length);

  for (const match of labelMatches) {
    const escaped = match.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^| )${escaped}( |$)`, "i");

    if (pattern.test(normalizedLanguageText)) {
      return match.locale;
    }
  }

  return "";
}

function isLikelyLanguageText(text) {
  return /^(language|sprache|langue|idioma|lingua|言語|语言)$/i.test(text.trim());
}

function containsLikelyLanguageText(text) {
  return /\b(language|sprache|langue|idioma|lingua)\b|言語|语言/i.test(String(text || ""));
}

function getElementLocale(element, localeKeys = Object.keys(listings)) {
  if (!element) return "";

  const attributeValues = [
    element.getAttribute("data-value"),
    element.getAttribute("value"),
    element.getAttribute("aria-label")
  ].filter(Boolean);

  for (const value of attributeValues) {
    const locale = normalizePotentialLocaleCode(value);
    if (locale) return locale;
  }

  return getLocaleFromText(getVisibleText(element), localeKeys);
}

function findClickableAncestor(element) {
  let current = element;

  for (let depth = 0; current && depth < 10; depth++) {
    const role = current.getAttribute && current.getAttribute("role");
    const jsaction = current.getAttribute && current.getAttribute("jsaction");

    if (
      role === "combobox" ||
      role === "button" ||
      current.tabIndex >= 0 ||
      current.classList && current.classList.contains("VfPpkd-TkwUic") ||
      jsaction && /click|mousedown|keydown/.test(jsaction)
    ) {
      return current;
    }

    current = current.parentElement;
  }

  return element;
}

function getDropdownMenuRoots(dropdown) {
  if (!dropdown) return [];

  const roots = [];
  const addRoot = root => {
    if (root && !roots.includes(root)) roots.push(root);
  };

  getElementsByIdList(dropdown.getAttribute("aria-controls")).forEach(addRoot);
  addRoot(dropdown.nextElementSibling);

  const container = dropdown.closest(".VfPpkd-O1htCb") ||
    dropdown.closest("label") ||
    dropdown.parentElement;
  if (container) {
    Array.from(container.querySelectorAll("[role='listbox'], [role='menu']")).forEach(addRoot);
  }

  return roots.filter(Boolean);
}

function getLanguageOptionElements(dropdown = null, visibleOnly = true) {
  const selector = "[role='option'], [role='menuitem'], .VfPpkd-StrnGf-rymPhb-ibnC6b";
  const roots = dropdown ? getDropdownMenuRoots(dropdown) : [];
  let options = roots.flatMap(root => Array.from(root.querySelectorAll(selector)));

  if (!options.length) {
    options = Array.from(document.querySelectorAll(selector));
  }

  return Array.from(new Set(options))
    .filter(option => !visibleOnly || isVisible(option));
}

function getLanguageDropdownSelectedText(dropdown) {
  if (!dropdown) return "";

  const labelIds = new Set(getElementsByIdList(dropdown.getAttribute("aria-labelledby"))
    .filter(element => isLikelyLanguageText(getVisibleText(element)))
    .map(element => element.id)
    .filter(Boolean));
  const selectedTextFromLabelledBy = getElementsByIdList(dropdown.getAttribute("aria-labelledby"))
    .filter(element => !labelIds.has(element.id))
    .map(getVisibleText)
    .filter(Boolean)
    .join(" ");

  return selectedTextFromLabelledBy || getVisibleText(dropdown);
}

function getLanguageDropdownLocale(dropdown) {
  return getElementLocale(dropdown) ||
    getLocaleFromText(getLanguageDropdownSelectedText(dropdown)) ||
    getLocaleFromText(getReferencedText(dropdown, "aria-labelledby"));
}

function getDropdownLocalContext(dropdown) {
  if (!dropdown) return "";

  const containers = [
    dropdown.closest(".TVM7Wc"),
    dropdown.closest(".O1htCb-H9tDt"),
    dropdown.closest("label"),
    dropdown.parentElement,
    dropdown
  ].filter(Boolean);

  return containers
    .map(getVisibleText)
    .filter(Boolean)
    .sort((a, b) => a.length - b.length)[0] || "";
}

function getLanguageDropdownLabelText(dropdown) {
  return [
    getReferencedText(dropdown, "aria-labelledby"),
    dropdown && dropdown.getAttribute("aria-label") || "",
    dropdown ? getDropdownLocalContext(dropdown) : ""
  ].filter(Boolean).join(" ");
}

function isLanguageDropdownCandidate(dropdown) {
  if (!dropdown) return false;

  const labelText = getLanguageDropdownLabelText(dropdown);
  return containsLikelyLanguageText(labelText) ||
    getLanguageOptionElements(dropdown, false).some(option => getElementLocale(option));
}

function isMultiLocaleLanguageDropdown(dropdown) {
  if (!isLanguageDropdownCandidate(dropdown)) return false;

  const localContext = normalizeLanguageText(getDropdownLocalContext(dropdown));
  if (/current editing language/.test(localContext)) return true;

  const currentEditingLabel = findVisibleTextElement(/current editing language/i);
  if (!currentEditingLabel) return false;

  const dropdownRect = dropdown.getBoundingClientRect();
  const labelRect = currentEditingLabel.getBoundingClientRect();
  return Math.abs(dropdownRect.top - labelRect.top) < 140 &&
    dropdownRect.left > labelRect.left;
}

function isOneLanguageProductDetailsDropdown(dropdown) {
  if (!isLanguageDropdownCandidate(dropdown)) return false;
  if (isMultiLocaleLanguageDropdown(dropdown)) return false;

  const localContext = normalizeLanguageText(getDropdownLocalContext(dropdown));
  if (/select a language/.test(localContext) && !/current editing language/.test(localContext)) {
    return true;
  }

  const categoryDropdown = typeof findCategoryDropdown === "function" ? findCategoryDropdown() : null;
  const graphicAssetsLabel = findVisibleTextElement(/graphic assets/i);
  const dropdownTop = getElementTop(dropdown);
  const categoryBottom = categoryDropdown ? categoryDropdown.getBoundingClientRect().bottom : Number.NEGATIVE_INFINITY;
  const graphicAssetsTop = graphicAssetsLabel ? graphicAssetsLabel.getBoundingClientRect().top : Number.POSITIVE_INFINITY;

  return dropdownTop > categoryBottom - 24 &&
    dropdownTop < graphicAssetsTop + 24 &&
    !/current editing language/.test(localContext);
}

function isLanguageDropdownPlaceholder(dropdown) {
  const rawText = getVisibleText(dropdown);
  const normalizedText = normalizeLanguageText(rawText);
  return !getLanguageDropdownLocale(dropdown) &&
    (/select a language|select language|language auswahlen|sprache auswahlen|seleccion(?:a|ar|e) (?:un )?idioma|selectionn(?:er|ez) une langue|seleziona(?:re)? (?:una )?lingua/i.test(normalizedText) ||
      /言語を選択|选择语言/.test(rawText));
}

function getLanguageDropdownMode(dropdown) {
  if (!dropdown) return "";

  if (isMultiLocaleLanguageDropdown(dropdown)) return "multi-locale";
  if (isOneLanguageProductDetailsDropdown(dropdown)) return "one-language";
  return "unknown";
}

function getExpectedLanguageDropdownMode() {
  return Object.keys(listings).length === 1 ? "one-language" : "multi-locale";
}

function scoreLanguageDropdown(dropdown, preferredLocale = "") {
  const visibleText = getVisibleText(dropdown);
  const labelledText = getReferencedText(dropdown, "aria-labelledby");
  const labelText = [
    labelledText,
    dropdown.getAttribute("aria-label") || "",
    dropdown.closest("label") ? getVisibleText(dropdown.closest("label")) : ""
  ].filter(Boolean).join(" ");
  const menuRoots = getDropdownMenuRoots(dropdown);
  const menuLabelText = menuRoots
    .map(root => [
      root.getAttribute && root.getAttribute("aria-label") || "",
      getReferencedText(root, "aria-labelledby")
    ].filter(Boolean).join(" "))
    .join(" ");
  const optionLocales = getLanguageOptionElements(dropdown, false)
    .map(option => getElementLocale(option))
    .filter(Boolean);
  const optionLocaleCount = new Set(optionLocales).size;
  const selectedLocale = getLanguageDropdownLocale(dropdown);
  const preferredMatchesOption = preferredLocale && optionLocales.some(locale => localesMatch(locale, preferredLocale));
  const normalizedContext = normalizeLanguageText([
    visibleText,
    labelText,
    menuLabelText,
    dropdown.closest("section") ? getVisibleText(dropdown.closest("section")).slice(0, 400) : ""
  ].join(" "));

  let score = 0;
  if (isLikelyLanguageText(labelledText) || isLikelyLanguageText(labelText)) score += 140;
  if (containsLikelyLanguageText(labelText)) score += 90;
  if (containsLikelyLanguageText(visibleText)) score += 45;
  if (containsLikelyLanguageText(menuLabelText)) score += 35;
  if (dropdown.getAttribute("aria-required") === "true") score += 12;
  if ((dropdown.getAttribute("aria-haspopup") || "").toLowerCase() === "listbox") score += 12;
  if (optionLocaleCount) score += Math.min(90, 30 + optionLocaleCount * 4);
  if (preferredMatchesOption) score += 80;
  if (selectedLocale) score += 25;
  if (preferredLocale && selectedLocale && localesMatch(selectedLocale, preferredLocale)) score += 40;
  if (/select a language/.test(normalizedContext)) score += 25;
  if (/current editing language/.test(normalizedContext)) score += 25;
  if (/product details/.test(normalizedContext) && /graphic assets/.test(normalizedContext)) score += 15;
  if (/\b(category|official url|homepage url|support url|mature content)\b/.test(normalizedContext)) score -= 90;
  if (/select a category|functionality and ui|privacy and security|developer tools/.test(normalizedContext)) score -= 60;

  return score;
}

function findLanguageDropdown(preferredLocale = "", expectedMode = "") {
  const comboboxes = Array.from(document.querySelectorAll("[role='combobox'], .VfPpkd-TkwUic")).filter(isVisible);
  const candidates = comboboxes
    .map((element, index) => ({
      element,
      index,
      mode: getLanguageDropdownMode(element),
      score: scoreLanguageDropdown(element, preferredLocale)
    }));

  if (expectedMode) {
    const modeMatchedCombobox = candidates
      .filter(candidate => candidate.mode === expectedMode)
      .sort((a, b) => b.score - a.score || a.index - b.index)[0];
    return modeMatchedCombobox ? modeMatchedCombobox.element : null;
  }

  const rankedComboboxes = candidates
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  if (rankedComboboxes.length) return rankedComboboxes[0].element;

  const labels = Array.from(document.querySelectorAll("span, label, div"))
    .filter(isVisible)
    .filter(element => isLikelyLanguageText(getVisibleText(element)));

  for (const label of labels) {
    const dropdown = label.closest(".VfPpkd-TkwUic") ||
      label.closest("[role='combobox']") ||
      findClickableAncestor(label);

    if (dropdown && isVisible(dropdown)) {
      return dropdown;
    }
  }

  return null;
}

function getCurrentDashboardLocale({ includePageFallback = true } = {}) {
  const dropdown = findLanguageDropdown();
  const dropdownLocale = dropdown ? getLanguageDropdownLocale(dropdown) : "";
  if (dropdownLocale) return dropdownLocale;
  if (!includePageFallback) return "";

  const localeKeys = Object.keys(listings);
  const visibleLocaleText = Array.from(document.querySelectorAll("span, div, button"))
    .filter(isVisible)
    .map(getVisibleText)
    .filter(text => text.length > 0 && text.length < 140)
    .find(text => getLocaleFromText(text, localeKeys));

  return visibleLocaleText ? getLocaleFromText(visibleLocaleText, localeKeys) : "";
}

function findDescriptionField() {
  const textareas = Array.from(document.querySelectorAll("textarea")).filter(isVisible);
  const labeledDescription = textareas.find(textarea => {
    const labelId = textarea.getAttribute("aria-labelledby");
    const label = labelId && document.getElementById(labelId);
    return label && /description|beschreibung|description|descrizione|descripción/i.test(getVisibleText(label));
  });

  if (labeledDescription) return labeledDescription;

  const requiredLongTextareas = textareas.filter(textarea => Number(textarea.getAttribute("maxlength") || 0) >= 1000);
  if (requiredLongTextareas.length) {
    return requiredLongTextareas.sort((a, b) => {
      const areaA = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
      const areaB = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
      return areaB - areaA;
    })[0];
  }

  return findLikelyListingField();
}

function getOpenLanguageOptions(dropdown = null, visibleOnly = true) {
  return getLanguageOptionElements(dropdown, visibleOnly)
    .map(element => ({
      element,
      text: getVisibleText(element),
      value: element.getAttribute("data-value") || element.getAttribute("value") || "",
      locale: getElementLocale(element)
    }))
    .filter(option => option.locale);
}

function scrollDropdownOptionIntoView(optionElement) {
  if (!optionElement) return;

  const scrollRoot = optionElement.closest("[role='listbox'], [role='menu'], .VfPpkd-xl07Ob, .VfPpkd-xl07Ob-XxIAqe");
  if (scrollRoot && scrollRoot.scrollHeight > scrollRoot.clientHeight) {
    const optionRect = optionElement.getBoundingClientRect();
    const rootRect = scrollRoot.getBoundingClientRect();
    const centeredOffset = optionRect.top - rootRect.top - ((rootRect.height - optionRect.height) / 2);
    scrollRoot.scrollTop += centeredOffset;
  }

  if (typeof optionElement.scrollIntoView === "function") {
    optionElement.scrollIntoView({ block: "center", inline: "nearest" });
  }
}

function activateDropdownOption(optionElement) {
  if (!optionElement) return;

  if (typeof optionElement.focus === "function") {
    optionElement.focus({ preventScroll: true });
  }

  [
    ["pointerover", PointerEvent],
    ["mouseover", MouseEvent],
    ["mouseenter", MouseEvent],
    ["pointerdown", PointerEvent],
    ["mousedown", MouseEvent],
    ["pointerup", PointerEvent],
    ["mouseup", MouseEvent]
  ].forEach(([type, EventConstructor]) => {
    const isPointer = EventConstructor === PointerEvent;
    const isDown = type.endsWith("down");
    const event = isPointer
      ? new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        buttons: isDown ? 1 : 0
      })
      : new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: isDown ? 1 : 0
    });
    optionElement.dispatchEvent(event);
  });

  if (typeof optionElement.click === "function") {
    optionElement.click();
  }
}

function activateDropdownOptionLegacy(optionElement) {
  if (!optionElement) return;

  optionElement.scrollIntoView({ block: "center", inline: "nearest" });
  optionElement.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" }));
  optionElement.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  optionElement.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" }));
  optionElement.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  optionElement.click();
}

function getLanguageOptionsForMode(opened, mode) {
  return mode === "one-language"
    ? getOpenLanguageOptions(opened.dropdown, false)
    : getOpenLanguageOptions(null, true);
}

function activateLanguageOptionForMode(optionElement, mode) {
  if (mode === "one-language") {
    scrollDropdownOptionIntoView(optionElement);
    return "scrolled";
  }

  activateDropdownOptionLegacy(optionElement);
  return "legacy";
}

function formatLanguageOption(optionOrLocale) {
  if (!optionOrLocale) return localize("unknown", "unknown");
  if (typeof optionOrLocale === "string") return optionOrLocale;
  return optionOrLocale.text
    ? `${optionOrLocale.text} (${optionOrLocale.locale})`
    : optionOrLocale.locale;
}

function formatFillAllProgress(action, index, total, option) {
  return `${action} ${index}/${total}: ${formatLanguageOption(option)}...`;
}

function formatFillAllSummary(importedCount, matchedCount, unmatchedLocaleKeys) {
  return [
    localize("fillAllDashboardSummary", "Imported $1; matched $2 dashboard language(s).", [
      String(importedCount),
      String(matchedCount)
    ]),
    unmatchedLocaleKeys.length
      ? localize("unmatchedImportedLocales", "Dashboard language menu did not offer imported locale(s): $1.", [unmatchedLocaleKeys.join(", ")])
      : ""
  ].filter(Boolean).join(" ");
}

async function publishFillAllStatus(status) {
  fillAllStatus = {
    ...fillAllStatus,
    ...status,
    updatedAt: Date.now()
  };

  updatePanelFillAllUi();

  const panelStatus = document.querySelector(`#${PANEL_ID} .storepilot-status`);
  if (panelStatus && fillAllStatus.message) {
    panelStatus.textContent = fillAllStatus.message;
  }

  try {
    const result = storePilotRuntimeSendMessage({
      type: "storepilot-fill-all-progress",
      status: fillAllStatus,
      message: fillAllStatus.message
    });
    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
  } catch (_error) {
    // Progress updates are best-effort because some extension contexts may be closed.
  }

  await storePilotStorageLocalSet({
    [FILL_ALL_STATUS_STORAGE_KEY]: fillAllStatus
  });

  return fillAllStatus;
}

function updatePanelFillAllUi() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const running = Boolean(isFillingAllLanguages || fillAllStatus.running);
  const mediaRunning = Boolean(mediaOperationState.running);
  const fillCurrentButton = panel.querySelector("[data-storepilot-action='fill-current']");
  const fillAllButton = panel.querySelector("[data-storepilot-action='fill-all']");
  const selectCategoryButton = panel.querySelector("[data-storepilot-action='select-category']");
  const fillAdditionalFieldsButton = panel.querySelector("[data-storepilot-action='fill-additional-fields']");
  const abortButtons = Array.from(panel.querySelectorAll("[data-storepilot-action='abort-operation'], [data-storepilot-action='abort-fill-all']"));

  if (fillCurrentButton) {
    fillCurrentButton.disabled = running || mediaRunning;
    fillCurrentButton.title = mediaRunning ? mediaOperationState.label : "";
  }
  if (fillAllButton) {
    fillAllButton.disabled = running || mediaRunning;
    fillAllButton.title = mediaRunning ? mediaOperationState.label : "";
  }
  if (selectCategoryButton) {
    selectCategoryButton.disabled = running || mediaRunning;
    selectCategoryButton.title = mediaRunning ? mediaOperationState.label : (running ? localize("fillingAllLanguages", "Filling descriptions...") : "");
  }
  if (fillAdditionalFieldsButton) {
    fillAdditionalFieldsButton.disabled = running || mediaRunning;
    fillAdditionalFieldsButton.title = mediaRunning ? mediaOperationState.label : (running ? localize("fillingAllLanguages", "Filling descriptions...") : "");
  }
  abortButtons.forEach(button => {
    button.hidden = !running && !mediaRunning;
    button.disabled = false;
  });
}

async function openLanguageDropdown(preferredLocale = "", expectedMode = "") {
  const dropdown = findLanguageDropdown(preferredLocale, expectedMode);
  if (!dropdown) {
    return { ok: false, message: localize("languageDropdownNotFound", "Could not find the Chrome Web Store language dropdown.") };
  }

  dropdown.scrollIntoView({ block: "center", inline: "nearest" });
  dropdown.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" }));
  dropdown.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  dropdown.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" }));
  dropdown.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  dropdown.click();
  await delay(250);

  return {
    ok: true,
    dropdown,
    mode: getLanguageDropdownMode(dropdown) || expectedMode || "unknown"
  };
}

async function selectDashboardLanguage(locale) {
  const normalizedTarget = normalizeLocale(locale);
  const expectedMode = getExpectedLanguageDropdownMode();
  const opened = await openLanguageDropdown(locale, expectedMode);
  if (!opened.ok) return opened;
  const mode = opened.mode || expectedMode;

  let options = getLanguageOptionsForMode(opened, mode);
  let option = options.find(candidate => normalizeLocale(candidate.locale) === normalizedTarget) ||
    options.find(candidate => localesMatch(candidate.locale, normalizedTarget));

  if (!option) {
    await delay(300);
    options = getLanguageOptionsForMode(opened, mode);
    option = options.find(candidate => normalizeLocale(candidate.locale) === normalizedTarget) ||
      options.find(candidate => localesMatch(candidate.locale, normalizedTarget));
  }

  if (!option) {
    const currentLocale = getCurrentDashboardLocale();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return {
      ok: normalizeLocale(currentLocale) === normalizedTarget,
      message: localize("localeNotInDashboardMenu", "Could not find $1 in the dashboard language menu.", [locale])
    };
  }

  const activation = activateLanguageOptionForMode(option.element, mode);
  if (activation === "scrolled") {
    await delay(75);
    activateDropdownOption(option.element);
  }

  for (let attempt = 0; attempt < 16; attempt++) {
    await delay(150);
    const currentDropdown = findLanguageDropdown(locale, expectedMode) || opened.dropdown;
    const currentLocale = currentDropdown ? getLanguageDropdownLocale(currentDropdown) : "";
    if (currentLocale && localesMatch(currentLocale, normalizedTarget)) {
      return { ok: true, message: localize("selectedDashboardLanguage", "Selected $1.", [formatLanguageOption(option)]) };
    }
    if (!currentLocale && currentDropdown && !isLanguageDropdownPlaceholder(currentDropdown)) {
      return { ok: true, message: localize("selectedDashboardLanguage", "Selected $1.", [formatLanguageOption(option)]) };
    }
  }

  return {
    ok: false,
    message: localize("clickedButDashboardShows", "Clicked $1, but the dashboard still shows $2.", [
      formatLanguageOption(option),
      getCurrentDashboardLocale() || localize("unknownLocale", "an unknown locale")
    ])
  };
}

async function fillDashboardLocale(locale, option = null) {
  const localeKey = getListingLocaleKey(locale);
  if (!localeKey) {
    return { ok: false, message: localize("noListingTextFor", "No listing text for $1.", [formatLanguageOption(option || locale)]) };
  }

  const field = findDescriptionField();
  if (!field) {
    return { ok: false, message: localize("descriptionFieldNotFound", "Could not find the Chrome Web Store description field.") };
  }

  fillElement(field, listings[localeKey]);
  selectedLocale = localeKey;
  return { ok: true, message: localize("filledLocale", "Filled $1.", [formatLanguageOption(option || localeKey)]) };
}

async function fillCurrentDashboardLanguage() {
  if (mediaOperationState.running) {
    return {
      ok: true,
      ignored: true,
      message: localize("mediaOperationAlreadyRunning", "Media operation already running: $1.", [mediaOperationState.label])
    };
  }

  await loadListings();

  const locale = getCurrentDashboardLocale();
  if (!locale) {
    return { ok: false, message: localize("currentDashboardLanguageNotDetected", "Could not detect the current dashboard language.") };
  }

  return fillDashboardLocale(locale);
}

async function fillAllDashboardLanguages(onProgress = null) {
  if (mediaOperationState.running) {
    return {
      ok: true,
      ignored: true,
      message: localize("mediaOperationAlreadyRunning", "Media operation already running: $1.", [mediaOperationState.label])
    };
  }

  await loadListings();

  if (fillAllAbortRequested) {
    return { ok: true, aborted: true, message: localize("stoppedFilledLanguages", "Stopped. Filled $1 dashboard language(s).", ["0"]) };
  }

  const localeKeys = Object.keys(listings).sort((a, b) => a.localeCompare(b));
  if (!localeKeys.length) {
    return { ok: false, message: localize("noProjectListingsImported", "No project listings imported.") };
  }

  const expectedMode = getExpectedLanguageDropdownMode();
  const firstOpen = await openLanguageDropdown(localeKeys[0], expectedMode);
  if (!firstOpen.ok) return firstOpen;

  const availableOptions = getLanguageOptionsForMode(firstOpen, firstOpen.mode || expectedMode);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await delay(150);

  const matchedLocaleKeys = new Set();
  const matchingOptions = availableOptions.reduce((options, option) => {
    const listingLocale = getListingLocaleKey(option.locale);
    if (!listingLocale || matchedLocaleKeys.has(listingLocale)) return options;

    matchedLocaleKeys.add(listingLocale);
    options.push({
      ...option,
      listingLocale
    });
    return options;
  }, []);
  const unmatchedLocaleKeys = localeKeys.filter(locale => !matchedLocaleKeys.has(locale));
  if (!matchingOptions.length) {
    return {
      ok: false,
      message: localize("noImportedLocalesMatchMenu", "No imported locales match the dashboard language menu.") +
        ` ${formatFillAllSummary(localeKeys.length, 0, unmatchedLocaleKeys)}`
    };
  }

  let filled = 0;
  const failed = [];

  function reportProgress(message) {
    publishFillAllStatus({
      running: true,
      message
    });
    if (onProgress) onProgress(message);
  }

  async function fillOptions(options, passName, action) {
    const nextFailed = [];

    for (let index = 0; index < options.length; index++) {
      const option = options[index];
      if (fillAllAbortRequested) {
        return { aborted: true, failed: nextFailed };
      }

      reportProgress(formatFillAllProgress(action, index + 1, options.length, option));
      const selection = await selectDashboardLanguage(option.locale);
      if (fillAllAbortRequested) {
        return { aborted: true, failed: nextFailed };
      }

      if (!selection.ok) {
        nextFailed.push({ ...option, error: selection.message, passName });
        continue;
      }

      await delay(250);
      const result = await fillDashboardLocale(option.locale, option);
      if (result.ok) {
        filled++;
      } else {
        nextFailed.push({ ...option, error: result.message, passName });
      }
    }

    return { aborted: false, failed: nextFailed };
  }

  const firstPass = await fillOptions(matchingOptions, "initial", localize("filling", "Filling"));
  if (firstPass.aborted) {
    return {
      ok: true,
      aborted: true,
      message: localize("stoppedFilledLanguages", "Stopped. Filled $1 dashboard language(s).", [String(filled)])
    };
  }

  let remainingFailed = firstPass.failed;
  if (remainingFailed.length) {
    await delay(500);
    const retryPass = await fillOptions(remainingFailed, "retry", localize("retrying", "Retrying"));
    if (retryPass.aborted) {
      const failedNames = remainingFailed.map(formatLanguageOption).join(", ");
      return {
        ok: true,
        aborted: true,
        message: failedNames
          ? localize("stoppedFilledLanguagesPending", "Stopped. Filled $1 dashboard language(s); still pending: $2.", [String(filled), failedNames])
          : localize("stoppedFilledLanguages", "Stopped. Filled $1 dashboard language(s).", [String(filled)])
      };
    }
    remainingFailed = retryPass.failed;
  }

  const failedNames = remainingFailed.map(formatLanguageOption).join(", ");
  const retryRecoveredCount = firstPass.failed.length - remainingFailed.length;
  const retryNote = retryRecoveredCount > 0
    ? ` ${localize("recoveredAfterRetry", "Recovered $1 after retry.", [String(retryRecoveredCount)])}`
    : (firstPass.failed.length ? ` ${localize("retriedNoneRecovered", "Retried $1; none recovered.", [String(firstPass.failed.length)])}` : "");
  const summaryNote = ` ${formatFillAllSummary(
    localeKeys.length,
    matchingOptions.length,
    unmatchedLocaleKeys
  )}`;

  return {
    ok: filled > 0 && remainingFailed.length === 0,
    message: (remainingFailed.length
      ? localize("filledLanguagesFailed", "Filled $1 dashboard language(s); failed $2: $3.", [String(filled), String(remainingFailed.length), failedNames])
      : localize("filledLanguages", "Filled $1 dashboard language(s).", [String(filled)])) + retryNote + summaryNote
  };
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

function createButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function openOptionsPage() {
  storePilotRuntimeSendMessage({ action: "openOptionsPage" }).catch(() => {
    window.open(storePilotRuntimeGetUrl("src/options/options.html"), "_blank", "noopener");
  });
}

function createPanelControls(panel) {
  const panelControls = document.createElement("div");
  const toggleModeButton = createButton("", () => {
    const nextMode = panel.dataset.panelMode === "minimized" ? "expanded" : "minimized";
    setPanelMode(panel, nextMode);
  });
  const closeButton = createButton("x", () => {
    setPanelMode(panel, "hidden");
  });

  panelControls.className = "storepilot-panel-controls";
  toggleModeButton.dataset.storepilotAction = "toggle-panel-mode";
  toggleModeButton.className = "storepilot-icon-button";
  closeButton.dataset.storepilotAction = "close-panel";
  closeButton.className = "storepilot-icon-button";
  closeButton.title = localize("closePanel", "Close panel");
  closeButton.setAttribute("aria-label", closeButton.title);
  panelControls.append(toggleModeButton, closeButton);

  return panelControls;
}

function createPanelBase() {
  const panel = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("div");
  const meta = document.createElement("div");
  const status = document.createElement("div");
  const actions = document.createElement("div");

  panel.id = PANEL_ID;
  if (currentTheme !== "system") {
    panel.dataset.theme = currentTheme;
  }
  header.className = "storepilot-header";
  title.className = "storepilot-title";
  meta.className = "storepilot-meta";
  status.className = "storepilot-status";
  actions.className = "storepilot-actions";
  title.textContent = localize("extensionName", "StorePilot");
  header.append(title, createPanelControls(panel));

  return { panel, header, title, meta, status, actions };
}

function createPanelActionGroup(...controls) {
  const visibleControls = controls.filter(Boolean);
  const group = document.createElement("div");
  group.className = "storepilot-action-group";
  if (visibleControls.length === 1) {
    group.classList.add("storepilot-action-group-single");
  }
  group.append(...visibleControls);
  return group;
}

function attachPanel(panel, title) {
  document.documentElement.append(panel);
  applyPanelMode(panel, getStoredPanelMode());
  applyStoredPanelPosition(panel);
  clampPanelToViewport(panel, false);
  bindPanelViewportClamp(panel);
  enablePanelDrag(panel, title);
}

function renderPrivacyPanel() {
  const panelMode = getStoredPanelMode();
  if (panelMode === "hidden") return;

  const { panel, header, title, meta, status, actions } = createPanelBase();
  const fields = getActivePrivacyFields();
  const fieldKeys = getVisiblePrivacyFieldKeys(fields);
  const dataUsageFieldKeys = getPrivacyDataUsageFieldKeys(fields);

  meta.textContent = activePrivacyDoc && activePrivacyDoc.file
    ? localize("privacyPanelSummary", "$1 privacy field(s) in $2", [String(fieldKeys.length), activeProjectName || localize("activeProject", "Active project")])
    : localize("privacyDocNotImported", "No privacy document imported for the active project.");
  status.textContent = activePrivacyDoc && activePrivacyDoc.file
    ? localize("privacyDocFileFound", "Privacy document: $1", [activePrivacyDoc.file.path])
    : localize("importPrivacyDocInOptions", "Import or re-import the project in StorePilot options to load a privacy document.");

  const fillSinglePurposeButton = createButton(localize("fillSinglePurpose", "Fill single purpose"), () => {
    const result = fillPrivacyField("single_purpose");
    status.textContent = result.message;
  });
  fillSinglePurposeButton.dataset.storepilotAction = "fill-single-purpose";
  fillSinglePurposeButton.disabled = !fields.single_purpose;
  fillSinglePurposeButton.title = fields.single_purpose
    ? ""
    : localize("privacyNoValueForField", "No privacy document value for $1.", ["single_purpose"]);

  const fillPrivacyButton = createButton(localize("fillPrivacy", "Fill privacy"), () => {
    const result = fillDetectedPrivacyFields();
    status.textContent = result.message;
  });
  fillPrivacyButton.dataset.storepilotAction = "fill-privacy";
  fillPrivacyButton.disabled = !fieldKeys.length;

  const fillDataUsageButton = createButton(localize("fillDataUsage", "Fill data usage"), () => {
    const result = fillPrivacyDataUsage();
    status.textContent = result.message;
    if (!result.ok && result.diagnostics) {
      console.info("StorePilot data usage diagnostics", result.diagnostics);
    }
  });
  fillDataUsageButton.dataset.storepilotAction = "fill-data-usage";
  fillDataUsageButton.disabled = !dataUsageFieldKeys.length;
  fillDataUsageButton.title = dataUsageFieldKeys.length
    ? ""
    : localize("dataUsageNoValues", "No data usage values found.");

  const diagnoseButton = createButton(localize("diagnosePage", "Diagnose page"), () => {
    const diagnostics = getPrivacyDiagnostics();
    status.textContent = localize("privacyDiagnosticsSummary", "Found $1 editable privacy candidate(s).", [String(diagnostics.fieldCandidates.length)]);
    console.info("StorePilot privacy diagnostics", diagnostics);
  });
  diagnoseButton.dataset.storepilotAction = "diagnose-privacy";

  const optionsButton = createButton(localize("options", "Options"), openOptionsPage);
  actions.append(
    createPanelActionGroup(fillSinglePurposeButton, fillPrivacyButton),
    createPanelActionGroup(fillDataUsageButton),
    createPanelActionGroup(diagnoseButton, optionsButton)
  );
  panel.append(header, meta, actions, status);
  attachPanel(panel, title);
}

function renderPanel(locales) {
  removePanel();

  if (isPrivacyDashboardSection()) {
    renderPrivacyPanel();
    return;
  }

  if (!isListingDashboardSection()) return;

  const panelMode = getStoredPanelMode();
  if (panelMode === "hidden") return;

  const panel = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("div");
  const panelControls = document.createElement("div");
  const meta = document.createElement("div");
  const status = document.createElement("div");
  const actions = document.createElement("div");

  panel.id = PANEL_ID;
  if (currentTheme !== "system") {
    panel.dataset.theme = currentTheme;
  }
  header.className = "storepilot-header";
  title.className = "storepilot-title";
  panelControls.className = "storepilot-panel-controls";
  meta.className = "storepilot-meta";
  status.className = "storepilot-status";
  actions.className = "storepilot-actions";

  title.textContent = localize("extensionName", "StorePilot");
  meta.textContent = locales.length
    ? (activeProjectName
      ? localize("miniPanelLocalesInProject", "$1 locales in $2", [String(locales.length), activeProjectName])
      : localize("localesCount", "$1 locales", [String(locales.length)]))
    : localize("importListingsInOptions", "Import listings in StorePilot options");
  status.textContent = isFillingAllLanguages && fillAllStatus.message
    ? fillAllStatus.message
    : localize("lastUpdatedOn", "Last updated on $1.", [formatDisplayTimestamp(activeProjectUpdatedAt)]);

  let fillCurrentButton = null;
  if (showAdvancedFillActions) {
    fillCurrentButton = createButton(localize("fillCurrent", "Fill current language"), async () => {
      if (mediaOperationState.running) {
        status.textContent = localize("mediaOperationAlreadyRunning", "Media operation already running: $1.", [mediaOperationState.label]);
        return;
      }
      const result = await fillCurrentDashboardLanguage();
      status.textContent = result.message;
    });
    fillCurrentButton.dataset.storepilotAction = "fill-current";
  }

  const fillAllButton = createButton(localize("fillAll", "Fill descriptions"), async () => {
    if (mediaOperationState.running) {
      status.textContent = localize("mediaOperationAlreadyRunning", "Media operation already running: $1.", [mediaOperationState.label]);
      return;
    }

    if (isFillingAllLanguages) {
      status.textContent = localize("fillAllAlreadyRunning", "Description fill is already running.");
      return;
    }

    isFillingAllLanguages = true;
    fillAllAbortRequested = false;
    await publishFillAllStatus({
      running: true,
      message: localize("fillingAllLanguages", "Filling descriptions...")
    });
    fillAllButton.disabled = true;
    if (fillCurrentButton) fillCurrentButton.disabled = true;
    selectCategoryButton.disabled = true;
    fillAdditionalFieldsButton.disabled = true;
    selectCategoryButton.title = localize("fillingAllLanguages", "Filling descriptions...");
    fillAdditionalFieldsButton.title = localize("fillingAllLanguages", "Filling descriptions...");
    setPanelMediaButtonsDisabled(true, localize("fillingAllLanguages", "Filling descriptions..."));
    abortButton.hidden = false;
    status.textContent = localize("fillingAllLanguages", "Filling descriptions...");

    try {
      const result = await fillAllDashboardLanguages(message => {
        status.textContent = message;
      });
      status.textContent = result.message;
    } finally {
      isFillingAllLanguages = false;
      await publishFillAllStatus({
        running: false,
        message: status.textContent
      });
      updatePanelMediaUi();
    }
  });
  fillAllButton.dataset.storepilotAction = "fill-all";
  const selectCategoryButton = createButton(localize("selectCategory", "Select category"), async () => {
    status.textContent = localize("selectingCategory", "Selecting category...");
    const result = await selectDashboardCategory();
    status.textContent = result.message;
    updatePanelFillAllUi();
  });
  selectCategoryButton.dataset.storepilotAction = "select-category";
  const fillAdditionalFieldsButton = createButton(localize("fillAdditionalFields", "Fill additional fields"), async () => {
    status.textContent = localize("fillingAdditionalFields", "Filling additional fields...");
    const result = await fillDetectedAdditionalFields();
    status.textContent = result.message;
    updatePanelFillAllUi();
  });
  fillAdditionalFieldsButton.dataset.storepilotAction = "fill-additional-fields";
  const abortButton = createButton(localize("abortOperation", "Abort operation"), () => {
    const result = abortCurrentOperation();
    status.textContent = result.message;
  });
  abortButton.dataset.storepilotAction = "abort-operation";
  abortButton.className = "storepilot-danger";
  abortButton.hidden = !isFillingAllLanguages && !mediaOperationState.running;

  const toggleModeButton = createButton("", () => {
    const nextMode = panel.dataset.panelMode === "minimized" ? "expanded" : "minimized";
    setPanelMode(panel, nextMode);
  });
  toggleModeButton.dataset.storepilotAction = "toggle-panel-mode";
  toggleModeButton.className = "storepilot-icon-button";

  const closeButton = createButton("x", () => {
    setPanelMode(panel, "hidden");
  });
  closeButton.dataset.storepilotAction = "close-panel";
  closeButton.className = "storepilot-icon-button";
  closeButton.title = localize("closePanel", "Close panel");
  closeButton.setAttribute("aria-label", closeButton.title);

  function createMediaUploadButton(kind, labelKey, fallback) {
    const button = createButton(localize(labelKey, fallback), async () => {
      setPanelMediaButtonsDisabled(true, localize("uploadingMedia", "Uploading media..."));
      status.textContent = localize("uploadingMedia", "Uploading media...");
      try {
        const response = await storePilotRuntimeSendMessage({
          type: "storepilot-upload-media-assets-from-project",
          requestAccess: false,
          kind
        });
        status.textContent = response && response.message || localize("mediaUploadFailed", "Media upload failed: $1", [localize("unknown", "Unknown")]);
      } finally {
        updatePanelMediaUi();
      }
    });
    button.dataset.storepilotAction = `upload-${kind}`;
    return button;
  }

  function createMediaClearButton(kind, labelKey, fallback) {
    const button = createButton(localize(labelKey, fallback), async () => {
      if (!hasClearableMedia(kind)) {
        status.textContent = localize("mediaAlreadyClearKind", "$1 already clear.", [getMediaUploadKindLabel(kind)]);
        updatePanelMediaUi();
        return;
      }

      setPanelMediaButtonsDisabled(true, localize("clearingMedia", "Clearing media..."));
      status.textContent = localize("clearingMedia", "Clearing media...");
      try {
        const result = await clearDashboardMediaAssets(kind);
        status.textContent = result.message;
      } finally {
        updatePanelMediaUi();
      }
    });
    button.dataset.storepilotAction = `clear-${kind}`;
    button.className = "storepilot-danger";
    return button;
  }

  const uploadStoreIconButton = createMediaUploadButton("storeIcon", "uploadStoreIcon", "Upload store icon");
  const uploadScreenshotsButton = createMediaUploadButton("screenshots", "uploadScreenshots", "Upload screenshots");
  const uploadSmallPromoButton = createMediaUploadButton("smallPromo", "uploadSmallPromo", "Upload small promo");
  const uploadMarqueePromoButton = createMediaUploadButton("marqueePromo", "uploadMarqueePromo", "Upload marquee promo");
  const clearScreenshotsButton = createMediaClearButton("screenshots", "clearScreenshots", "Clear screenshots");
  const clearStoreIconButton = createMediaClearButton("storeIcon", "clearStoreIcon", "Clear store icon");
  const clearSmallPromoButton = createMediaClearButton("smallPromo", "clearSmallPromo", "Clear small promo");
  const clearMarqueePromoButton = createMediaClearButton("marqueePromo", "clearMarqueePromo", "Clear marquee promo");
  const optionsButton = createButton(localize("options", "Options"), openOptionsPage);

  actions.append(
    createPanelActionGroup(fillCurrentButton, fillAllButton, selectCategoryButton),
    createPanelActionGroup(
      uploadStoreIconButton,
      uploadScreenshotsButton,
      uploadSmallPromoButton,
      uploadMarqueePromoButton
    ),
    createPanelActionGroup(
      clearStoreIconButton,
      clearScreenshotsButton,
      clearSmallPromoButton,
      clearMarqueePromoButton
    ),
    createPanelActionGroup(fillAdditionalFieldsButton),
    createPanelActionGroup(abortButton, optionsButton)
  );

  panelControls.append(toggleModeButton, closeButton);
  header.append(title, panelControls);
  panel.append(header, meta, actions, status);
  document.documentElement.append(panel);
  applyPanelMode(panel, panelMode);
  applyStoredPanelPosition(panel);
  clampPanelToViewport(panel, false);
  bindPanelViewportClamp(panel);
  bindPanelMediaState(panel);
  enablePanelDrag(panel, title);
  updatePanelFillAllUi();
}

function injectStyles() {
  globalThis.storePilotInjectDashboardPanelStyles(PANEL_ID);
}

storePilotRuntimeOnMessageAddListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "storepilot-copy") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse(await copySelectedText());
      return;
    }

    if (message.type === "storepilot-fill") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse(fillSelectedText());
      return;
    }

    if (message.type === "storepilot-fill-current-language") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse(await fillCurrentDashboardLanguage());
      return;
    }

    if (message.type === "storepilot-select-category") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse(await selectDashboardCategory());
      return;
    }

    if (message.type === "storepilot-fill-additional-fields") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse(await fillDetectedAdditionalFields());
      return;
    }

    if (message.type === "storepilot-fill-all-languages") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      await loadSettings();
      renderPanel(await loadListings());
      if (isFillingAllLanguages) {
        sendResponse({ ok: false, message: localize("fillAllAlreadyRunning", "Description fill is already running.") });
        return;
      }

      isFillingAllLanguages = true;
      fillAllAbortRequested = false;
      await publishFillAllStatus({
        running: true,
        message: localize("fillingAllLanguages", "Filling descriptions...")
      });
      renderPanel(Object.keys(listings).sort((a, b) => a.localeCompare(b)));

      let result;
      try {
        result = await fillAllDashboardLanguages();
      } finally {
        isFillingAllLanguages = false;
      }
      await publishFillAllStatus({
        running: false,
          message: result ? result.message : localize("fillAllStopped", "Description fill stopped.")
      });
      renderPanel(Object.keys(listings).sort((a, b) => a.localeCompare(b)));
      sendResponse(result || { ok: false, message: localize("fillAllStopped", "Description fill stopped.") });
      return;
    }

    if (message.type === "storepilot-get-fill-all-status") {
      sendResponse({
        ok: true,
        status: {
          ...fillAllStatus,
          running: isFillingAllLanguages
        }
      });
      return;
    }

    if (message.type === "storepilot-abort-operation" || message.type === "storepilot-abort-fill-all") {
      sendResponse(abortCurrentOperation());
      return;
    }

    if (message.type === "storepilot-upload-media-assets") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      sendResponse(await uploadDashboardMediaAssets(message.files || {}, message.kind || ""));
      return;
    }

    if (message.type === "storepilot-clear-media-assets") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      sendResponse(await clearDashboardMediaAssets(message.kind || "screenshots"));
      return;
    }

    if (message.type === "storepilot-get-media-state") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      sendResponse({
        ok: true,
        media: getDashboardMediaState()
      });
      return;
    }

    if (message.type === "storepilot-get-panel-state") {
      sendResponse({
        ok: true,
        panel: getPanelState()
      });
      return;
    }

    if (message.type === "storepilot-get-project-context") {
      await loadListings();
      sendResponse({
        ok: true,
        context: {
          extensionId: activeDashboardExtensionId || getDashboardExtensionId(),
          dashboardItemTitle: activeDashboardItemTitle || getDashboardItemTitle(),
          projectId: activeProjectId,
          projectName: activeProjectName,
          projectSource: activeDashboardProjectSource
        }
      });
      return;
    }

    if (message.type === "storepilot-show-panel") {
      if (!isPanelDashboardSection()) {
        removePanel();
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      savePanelMode("expanded");
      injectStyles();
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse({ ok: true, message: localize("panelOpened", "Panel opened.") });
      return;
    }

    if (message.type === "storepilot-fill-privacy") {
      if (!isPrivacyDashboardSection()) {
        sendResponse({
          ok: false,
          message: localize("privacyActionsOnlyOnPrivacyPage", "Privacy actions are only available on the Privacy page.")
        });
        return;
      }
      await loadSettings();
      await loadListings();
      renderPanel(Object.keys(listings).sort((a, b) => a.localeCompare(b)));
      sendResponse(fillDetectedPrivacyFields());
      return;
    }

    if (message.type === "storepilot-fill-privacy-field") {
      if (!isPrivacyDashboardSection()) {
        sendResponse({
          ok: false,
          message: localize("privacyActionsOnlyOnPrivacyPage", "Privacy actions are only available on the Privacy page.")
        });
        return;
      }
      await loadSettings();
      await loadListings();
      renderPanel(Object.keys(listings).sort((a, b) => a.localeCompare(b)));
      sendResponse(fillPrivacyField(String(message.key || "")));
      return;
    }

    if (message.type === "storepilot-fill-data-usage") {
      if (!isPrivacyDashboardSection()) {
        sendResponse({
          ok: false,
          message: localize("privacyActionsOnlyOnPrivacyPage", "Privacy actions are only available on the Privacy page.")
        });
        return;
      }
      await loadSettings();
      await loadListings();
      renderPanel(Object.keys(listings).sort((a, b) => a.localeCompare(b)));
      sendResponse(fillPrivacyDataUsage());
      return;
    }

    if (message.type === "storepilot-reload") {
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "storepilot-diagnose") {
      await loadSettings();
      renderPanel(await loadListings());
      if (isPrivacyDashboardSection()) {
        const diagnostics = getPrivacyDiagnostics();
        sendResponse({
          ok: Boolean(diagnostics.fieldCandidates.length),
          message: localize("privacyDiagnosticsSummary", "Found $1 editable privacy candidate(s).", [String(diagnostics.fieldCandidates.length)]),
          diagnostics
        });
        return;
      }
      sendResponse(await diagnoseDashboardPage());
    }
  })();

  return true;
});

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
