const LEGACY_STORAGE_KEY = "storePilotListings";
var STOREPILOT_API = globalThis.browser;
const PROJECTS_STORAGE_KEY = "storePilotProjects";
const ACTIVE_PROJECT_STORAGE_KEY = "storePilotActiveProjectId";
const SETTINGS_KEY = "storePilotSettings";
const FILL_ALL_STATUS_STORAGE_KEY = "storePilotFillAllStatus";
const PANEL_POSITION_STORAGE_KEY = "storePilotPanelPosition";
const PANEL_MODE_STORAGE_KEY = "storePilotPanelMode";
const PANEL_ID = "storepilot-panel";
const MEDIA_UPLOAD_BRIDGE_SCRIPT = "src/content/media-upload-main-world.js";
const MAX_DASHBOARD_SCREENSHOTS = 5;
const CHROME_WEB_STORE_SUPPORTED_LOCALES = new Set([
  "ar", "am", "bg", "bn", "ca", "cs", "da", "de", "el", "en", "en_au", "en_gb", "en_us",
  "es", "es_419", "et", "fa", "fi", "fil", "fr", "gu", "he", "hi", "hr", "hu", "id",
  "it", "ja", "kn", "ko", "lt", "lv", "ml", "mr", "ms", "nl", "no", "pl", "pt_br",
  "pt_pt", "ro", "ru", "sk", "sl", "sr", "sv", "sw", "ta", "te", "th", "tr", "uk",
  "ur", "vi", "zh_cn", "zh_tw"
]);

let listings = {};
let selectedLocale = "";
let activeProjectName = "";
let activeProjectUpdatedAt = "";
let activePrivacyDoc = null;
let currentTheme = "system";
let isFillingAllLanguages = false;
let fillAllAbortRequested = false;
let fillAllStatus = {
  running: false,
  message: ""
};
let mediaUploadBridgePromise = null;
let panelViewportClampController = null;
let panelMediaStateObserver = null;
let dashboardSectionWatcherId = 0;
let mediaOperationState = {
  running: false,
  label: "",
  abortRequested: false
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function localize(key, fallback, substitutions) {
  const message = STOREPILOT_API.i18n && STOREPILOT_API.i18n.getMessage
    ? STOREPILOT_API.i18n.getMessage(key, substitutions)
    : "";
  const values = substitutions ? (Array.isArray(substitutions) ? substitutions : [substitutions]) : [];
  return String(message || fallback || "").replace(/\$(\d+)/g, (_match, index) => {
    const value = values[Number(index) - 1];
    return value === undefined || value === null ? "" : String(value);
  });
}

function getDashboardSectionFromUrl(url = window.location.href) {
  try {
    const { pathname } = new URL(url);
    if (/\/edit\/privacy\/?$/.test(pathname)) return "privacy";
    if (/\/edit(?:\/listing)?\/?$/.test(pathname)) return "listing";
  } catch (_error) {
    // Fall through to unknown; URL parsing is only used to gate UI actions.
  }

  return "other";
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

function isVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none";
}

function setNativeValue(element, value) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

function dispatchInputEvents(element) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillElement(element, value) {
  if (!element) return false;

  element.focus();

  if (element.isContentEditable) {
    element.textContent = value;
    dispatchInputEvents(element);
    return true;
  }

  if ("value" in element) {
    setNativeValue(element, value);
    dispatchInputEvents(element);
    return true;
  }

  return false;
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
    setPanelMediaButtonsDisabled(true, localize("fillingAllLanguages", "Filling all languages..."));
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
  const stored = await STOREPILOT_API.storage.local.get([SETTINGS_KEY]);
  currentTheme = (stored[SETTINGS_KEY] && stored[SETTINGS_KEY].theme) || "system";
  return currentTheme;
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

async function loadListings() {
  const stored = await STOREPILOT_API.storage.local.get([
    LEGACY_STORAGE_KEY,
    PROJECTS_STORAGE_KEY,
    ACTIVE_PROJECT_STORAGE_KEY
  ]);
  const projects = stored[PROJECTS_STORAGE_KEY] || [];
  const activeProject = projects.find(project => project.id === stored[ACTIVE_PROJECT_STORAGE_KEY]) ||
    projects[0] ||
    null;

  listings = activeProject ? activeProject.listings || {} : stored[LEGACY_STORAGE_KEY] || {};
  activeProjectName = activeProject ? activeProject.name : "";
  activeProjectUpdatedAt = activeProject ? activeProject.lastSyncedAt || "" : "";
  activePrivacyDoc = activeProject ? activeProject.privacyDoc || null : null;
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

function normalizePrivacyMatchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/[^a-z0-9_. -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getElementLabelText(element) {
  const parts = [];
  const ariaLabel = element.getAttribute("aria-label");
  const ariaLabelledBy = element.getAttribute("aria-labelledby");
  const id = element.id;

  if (ariaLabel) parts.push(ariaLabel);

  if (ariaLabelledBy) {
    ariaLabelledBy.split(/\s+/).forEach(labelId => {
      const label = document.getElementById(labelId);
      if (label) parts.push(getVisibleText(label));
    });
  }

  if (id) {
    document.querySelectorAll(`label[for='${CSS.escape(id)}']`).forEach(label => {
      parts.push(getVisibleText(label));
    });
  }

  const closestLabel = element.closest("label");
  if (closestLabel) {
    const clone = closestLabel.cloneNode(true);
    clone.querySelectorAll("textarea,input,[role='textbox']").forEach(control => {
      control.remove();
    });
    parts.push(getVisibleText(clone));
  }

  return parts.filter(Boolean).join(" ");
}

function getPrivacyFieldContextText(element) {
  const parts = [getElementLabelText(element)];
  const containers = [
    element.closest("label"),
    element.closest(".TVM7Wc"),
    element.closest(".n5L2Mb")
  ].filter(Boolean);

  containers.forEach(container => {
    const clone = container.cloneNode(true);
    clone.querySelectorAll("textarea,input,[role='textbox']").forEach(control => {
      control.remove();
    });
    parts.push(getVisibleText(clone));
  });

  return normalizePrivacyMatchText(parts.join(" "));
}

function getPrivacyFieldCandidates() {
  return Array.from(document.querySelectorAll([
    "textarea",
    "input[type='text']",
    "input[type='url']",
    "input:not([type])",
    "[role='textbox']"
  ].join(",")))
    .filter(isVisible)
    .map((element, index) => {
      const rect = element.getBoundingClientRect();
      return {
        element,
        index,
        context: getPrivacyFieldContextText(element),
        payload: element.getAttribute("data-payload") || "",
        maxLength: Number(element.getAttribute("maxlength") || 0),
        required: element.hasAttribute("required"),
        tagName: element.tagName.toLowerCase(),
        area: rect.width * rect.height
      };
    });
}

function normalizePrivacyPayload(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getExpectedPrivacyPayloads(key) {
  if (key === "single_purpose") return ["singlepurpose", "singlepurposejustification"];
  if (key === "privacy_policy_url") return ["privacypolicyurl", "privacypolicy"];
  if (key === "host_permission") return ["hostpermission", "hostpermissions", "hostpermissionjustification"];
  if (key === "remote_code") return ["remotecode", "remotecodejustification"];

  const permissionMatch = key.match(/^permission\.(.+)$/);
  return permissionMatch ? [normalizePrivacyPayload(permissionMatch[1])] : [];
}

function isNumericPrivacyPayload(payload) {
  return /^\d+$/.test(String(payload || "").trim());
}

function scorePrivacyFieldCandidate(candidate, key) {
  const context = candidate.context;
  const permissionMatch = key.match(/^permission\.(.+)$/);
  const payload = normalizePrivacyPayload(candidate.payload);
  const expectedPayloads = getExpectedPrivacyPayloads(key);
  let score = 0;

  if (payload) {
    if (expectedPayloads.includes(payload)) {
      score += 300;
    } else if (isNumericPrivacyPayload(candidate.payload)) {
      score += 20;
    } else {
      return 0;
    }
  }

  if (key === "single_purpose") {
    if (/\bsingle purpose\b/.test(context)) score += 120;
    if (/alleinigen zweck|alleiniger zweck|alleinige zweck|zweck des artikels/.test(context)) score += 120;
    if (/beschreibung/.test(context) && /zweck/.test(context)) score += 70;
    if (/\bpurpose\b/.test(context) && /\bdescription\b/.test(context)) score += 70;
    if (candidate.tagName === "textarea") score += 25;
    if (candidate.required) score += 15;
    if (candidate.maxLength >= 900 && candidate.maxLength <= 1200) score += 35;
    if (candidate.area > 30000) score += 15;
  } else if (key === "privacy_policy_url") {
    if (/privacy policy|datenschutzerklarung|datenschutzrichtlinie/.test(context)) score += 100;
    if (/\burl\b|link/.test(context)) score += 35;
    if (candidate.tagName === "input") score += 25;
  } else if (key === "host_permission") {
    if (/host permission|hostberechtigung|host berechtigung|host permissions/.test(context)) score += 120;
    if (/begrundung|justification|berechtigung/.test(context)) score += 35;
    if (candidate.tagName === "textarea") score += 20;
  } else if (key === "remote_code") {
    if (/remote code|remotecode|remote.*code|extern.*code|ausgelagert.*code/.test(context)) score += 120;
    if (/begrundung|justification|erklarung/.test(context)) score += 25;
  } else if (permissionMatch) {
    const permission = normalizePrivacyMatchText(permissionMatch[1]);
    if (new RegExp(`\\b${permission.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(context)) score += 110;
    if (/permission|berechtigung|berechtigungen/.test(context)) score += 40;
    if (/begrundung|justification|warum|why/.test(context)) score += 25;
    if (candidate.tagName === "textarea") score += 15;
  }

  return score;
}

function findPrivacyField(key) {
  const candidates = getPrivacyFieldCandidates()
    .map(candidate => ({
      ...candidate,
      score: scorePrivacyFieldCandidate(candidate, key)
    }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || b.area - a.area || a.index - b.index);

  return candidates[0] && candidates[0].score >= 80 ? candidates[0] : null;
}

function isDisabledEditableElement(element) {
  return Boolean(
    !element ||
    element.disabled ||
    element.readOnly ||
    element.getAttribute("aria-disabled") === "true" ||
    element.closest("[aria-disabled='true']")
  );
}

function getContextAroundElement(element) {
  if (!element) return "";
  const containers = [
    element.closest("label"),
    element.closest(".TVM7Wc"),
    element.closest(".n5L2Mb"),
    element.closest("section")
  ].filter(Boolean);

  return normalizePrivacyMatchText(containers.map(getVisibleText).join(" "));
}

function isRemoteCodeNoSelected() {
  return Array.from(document.querySelectorAll([
    "input[type='radio']:checked",
    "[role='radio'][aria-checked='true']"
  ].join(","))).some(control => {
    const context = getContextAroundElement(control);
    return /remote ?code|remotecode/.test(context) &&
      (/\bno\b/.test(context) || /nein/.test(context)) &&
      (/\bnot\b/.test(context) || /nicht/.test(context)) &&
      !(/\byes\b/.test(context) || /\bja\b/.test(context));
  });
}

function getActivePrivacyFields() {
  return activePrivacyDoc && activePrivacyDoc.file && activePrivacyDoc.file.fields
    ? activePrivacyDoc.file.fields
    : {};
}

function getEditableElementValue(element) {
  if (!element) return "";
  if (element.isContentEditable) return element.textContent || "";
  if ("value" in element) return element.value || "";
  return "";
}

function normalizeFilledPrivacyValue(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function getPrivacyFieldFillValue(key, value) {
  if (key !== "privacy_policy_url") return value;

  const raw = String(value || "").trim();
  const firstUrl = raw.match(/https?:\/\/\S+/i);
  let url = firstUrl ? firstUrl[0] : raw.split(/\r?\n/).map(line => line.trim()).find(Boolean) || "";
  const markerIndex = url.search(/(?:data_usage|certification_\d+|single_purpose|host_permission|remote_code|privacy_policy_url|permission\.[A-Za-z0-9_.-]+)\s*:/i);

  if (markerIndex > 0) {
    url = url.slice(0, markerIndex);
  }

  return url.replace(/[),;]+$/g, "").trim();
}

function fillPrivacyField(key) {
  const fields = getActivePrivacyFields();
  const value = getPrivacyFieldFillValue(key, fields[key]);

  if (!value) {
    return { ok: false, message: localize("privacyNoValueForField", "No privacy document value for $1.", [key]) };
  }

  const target = findPrivacyField(key);
  if (key === "remote_code" && (!target || isRemoteCodeNoSelected())) {
    return {
      ok: true,
      skipped: true,
      message: localize("privacySkippedField", "Skipped privacy field: $1.", [key]),
      key,
      reason: "remote_code_not_used"
    };
  }

  if (!target) {
    return { ok: false, message: localize("privacyFieldNotFound", "Could not find privacy field: $1.", [key]) };
  }

  if (key === "remote_code" && isDisabledEditableElement(target.element)) {
    return {
      ok: true,
      skipped: true,
      message: localize("privacySkippedField", "Skipped privacy field: $1.", [key]),
      key,
      score: target.score,
      reason: "remote_code_justification_disabled"
    };
  }

  if (!fillElement(target.element, value)) {
    return { ok: false, message: localize("privacyFieldDidNotAcceptValue", "Privacy field did not accept value: $1.", [key]) };
  }

  const expected = normalizeFilledPrivacyValue(value);
  const actual = normalizeFilledPrivacyValue(getEditableElementValue(target.element));
  if (actual !== expected) {
    return {
      ok: false,
      message: localize("privacyFieldDidNotAcceptValue", "Privacy field did not accept value: $1.", [key]),
      key,
      score: target.score,
      actualLength: actual.length,
      expectedLength: expected.length
    };
  }

  return {
    ok: true,
    message: localize("privacyFilledField", "Filled privacy field: $1.", [key]),
    key,
    score: target.score
  };
}

function fillPrivacyFields(keys) {
  const fields = getActivePrivacyFields();
  if (!Object.keys(fields).length) {
    return { ok: false, message: localize("privacyDocNotImported", "No privacy document imported for the active project.") };
  }

  const filled = [];
  const missing = [];
  const skipped = [];

  keys.forEach(key => {
    if (!fields[key]) return;

    const result = fillPrivacyField(key);
    if (result.skipped) {
      skipped.push(key);
    } else if (result.ok) {
      filled.push(key);
    } else {
      missing.push(key);
    }
  });

  return {
    ok: filled.length > 0 || skipped.length > 0,
    message: [
      filled.length ? localize("privacyFilledFields", "Filled $1 privacy field(s): $2.", [String(filled.length), filled.join(", ")]) : "",
      skipped.length ? localize("privacySkippedFields", "Skipped $1 privacy field(s): $2.", [String(skipped.length), skipped.join(", ")]) : "",
      missing.length ? localize("privacyFieldsNotFound", "Could not find: $1.", [missing.join(", ")]) : ""
    ].filter(Boolean).join(" ") || localize("privacyNoSupportedFields", "No supported privacy fields were available to fill."),
    filled,
    missing,
    skipped
  };
}

function fillDetectedPrivacyFields() {
  return fillPrivacyFields([
    "single_purpose",
    "privacy_policy_url",
    "host_permission",
    "remote_code",
    ...Object.keys(getActivePrivacyFields()).filter(key => key.startsWith("permission."))
  ]);
}

function getPrivacyDiagnostics() {
  const fields = getActivePrivacyFields();
  return {
    hasPrivacyDoc: Boolean(activePrivacyDoc && activePrivacyDoc.file),
    privacyDocPath: activePrivacyDoc && activePrivacyDoc.file ? activePrivacyDoc.file.path : "",
    privacyDocKeys: Object.keys(fields),
    fieldCandidates: getPrivacyFieldCandidates().map(candidate => ({
      index: candidate.index,
      tagName: candidate.tagName,
      payload: candidate.payload,
      maxLength: candidate.maxLength,
      required: candidate.required,
      contextSample: candidate.context.slice(0, 220),
      scores: Object.keys(fields).reduce((scores, key) => ({
        ...scores,
        [key]: scorePrivacyFieldCandidate(candidate, key)
      }), {})
    }))
  };
}

function normalizeLocale(locale) {
  return String(locale || "").replace("-", "_").toLowerCase();
}

function isChromeWebStoreSupportedLocale(locale) {
  return CHROME_WEB_STORE_SUPPORTED_LOCALES.has(normalizeLocale(locale));
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
        // Ignore unsupported locale display names and keep code-based matching.
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

function getVisibleText(element) {
  return (element && element.textContent || "").replace(/\s+/g, " ").trim();
}

function isLikelyLanguageText(text) {
  return /^(language|sprache|langue|idioma|lingua|言語|语言)$/i.test(text.trim());
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

function findLanguageDropdown() {
  const comboboxes = Array.from(document.querySelectorAll("[role='combobox'], .VfPpkd-TkwUic")).filter(isVisible);
  const labeledCombobox = comboboxes.find(element => /language|sprache|langue|idioma/i.test(getVisibleText(element)));
  if (labeledCombobox) return labeledCombobox;

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

function getCurrentDashboardLocale() {
  const dropdown = findLanguageDropdown();
  const dropdownLocale = dropdown ? getLocaleFromText(getVisibleText(dropdown)) : "";
  if (dropdownLocale) return dropdownLocale;

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

function getOpenLanguageOptions() {
  return Array.from(document.querySelectorAll("[role='option'], [role='menuitem'], .VfPpkd-StrnGf-rymPhb-ibnC6b"))
    .filter(isVisible)
    .map(element => ({
      element,
      text: getVisibleText(element),
      locale: getLocaleFromText(getVisibleText(element))
    }))
    .filter(option => option.locale);
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

function formatFillAllSummary(importedCount, matchedCount, unsupportedUnmatchedLocaleKeys, unmatchedLocaleKeys) {
  return [
    localize("fillAllDashboardSummary", "Imported $1; matched $2 dashboard language(s).", [
      String(importedCount),
      String(matchedCount)
    ]),
    unsupportedUnmatchedLocaleKeys.length
      ? localize("unsupportedChromeWebStoreLocales", "Chrome Web Store did not offer unsupported locale(s): $1.", [unsupportedUnmatchedLocaleKeys.join(", ")])
      : "",
    unmatchedLocaleKeys.length
      ? localize("unmatchedImportedLocales", "Dashboard did not offer supported imported locale(s): $1.", [unmatchedLocaleKeys.join(", ")])
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

  if (!STOREPILOT_API.runtime || typeof STOREPILOT_API.runtime.sendMessage !== "function") {
    return fillAllStatus;
  }

  try {
    const result = STOREPILOT_API.runtime.sendMessage({
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

  if (STOREPILOT_API.storage && STOREPILOT_API.storage.local) {
    await STOREPILOT_API.storage.local.set({
      [FILL_ALL_STATUS_STORAGE_KEY]: fillAllStatus
    });
  }

  return fillAllStatus;
}

function updatePanelFillAllUi() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const running = Boolean(isFillingAllLanguages || fillAllStatus.running);
  const mediaRunning = Boolean(mediaOperationState.running);
  const fillCurrentButton = panel.querySelector("[data-storepilot-action='fill-current']");
  const fillAllButton = panel.querySelector("[data-storepilot-action='fill-all']");
  const abortButtons = Array.from(panel.querySelectorAll("[data-storepilot-action='abort-operation'], [data-storepilot-action='abort-fill-all']"));

  if (fillCurrentButton) {
    fillCurrentButton.disabled = running || mediaRunning;
    fillCurrentButton.title = mediaRunning ? mediaOperationState.label : "";
  }
  if (fillAllButton) {
    fillAllButton.disabled = running || mediaRunning;
    fillAllButton.title = mediaRunning ? mediaOperationState.label : "";
  }
  abortButtons.forEach(button => {
    button.hidden = !running && !mediaRunning;
    button.disabled = false;
  });
}

async function openLanguageDropdown() {
  const dropdown = findLanguageDropdown();
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

  return { ok: true, dropdown };
}

async function selectDashboardLanguage(locale) {
  const normalizedTarget = normalizeLocale(locale);
  const opened = await openLanguageDropdown();
  if (!opened.ok) return opened;

  let options = getOpenLanguageOptions();
  let option = options.find(candidate => normalizeLocale(candidate.locale) === normalizedTarget);

  if (!option) {
    await delay(300);
    options = getOpenLanguageOptions();
    option = options.find(candidate => normalizeLocale(candidate.locale) === normalizedTarget);
  }

  if (!option) {
    const currentLocale = getCurrentDashboardLocale();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return {
      ok: normalizeLocale(currentLocale) === normalizedTarget,
      message: localize("localeNotInDashboardMenu", "Could not find $1 in the dashboard language menu.", [locale])
    };
  }

  option.element.scrollIntoView({ block: "center", inline: "nearest" });
  option.element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" }));
  option.element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  option.element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" }));
  option.element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  option.element.click();

  for (let attempt = 0; attempt < 12; attempt++) {
    await delay(150);
    const currentLocale = getCurrentDashboardLocale();
    if (!currentLocale || normalizeLocale(currentLocale) === normalizedTarget) {
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

  const firstOpen = await openLanguageDropdown();
  if (!firstOpen.ok) return firstOpen;

  const availableOptions = getOpenLanguageOptions();
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
  const unsupportedUnmatchedLocaleKeys = localeKeys.filter(locale => (
    !isChromeWebStoreSupportedLocale(locale) &&
    !matchedLocaleKeys.has(locale)
  ));
  const unmatchedLocaleKeys = localeKeys.filter(locale => (
    isChromeWebStoreSupportedLocale(locale) &&
    !matchedLocaleKeys.has(locale)
  ));
  if (!matchingOptions.length) {
    return {
      ok: false,
      message: localize("noImportedLocalesMatchMenu", "No imported locales match the dashboard language menu.") +
        ` ${formatFillAllSummary(localeKeys.length, 0, unsupportedUnmatchedLocaleKeys, unmatchedLocaleKeys)}`
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
    unsupportedUnmatchedLocaleKeys,
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
    return { ok: false, message: localize("fillAllNotRunning", "Fill all is not running.") };
  }

  fillAllAbortRequested = true;
  const message = localize("abortRequestedStopAfterStep", "Abort requested. StorePilot will stop after the current dashboard step.");
  publishFillAllStatus({
    running: true,
    message
  });
  return { ok: true, message };
}

function getMediaUploadTypeName(widget) {
  const uploadType = widget && widget.dataset ? widget.dataset.imageUploadType : "";

  if (uploadType === "4") {
    return "screenshots";
  }

  if (uploadType === "5") {
    return "storeIcon";
  }

  if (uploadType === "1") {
    return "smallPromo";
  }

  if (uploadType === "3") {
    return "marqueePromo";
  }

  const widgetText = normalizeLanguageText(getVisibleText(widget || ""));

  if (/screenshots?/.test(widgetText) || /screenshot/.test(widgetText)) return "screenshots";
  if (/store icon|merchant icon|handler symbol|haendler symbol|handlersymbol|handlersymbol|symbol hier ablegen/.test(widgetText)) return "storeIcon";
  if (/small promo|small tile|kleine werbekachel/.test(widgetText)) return "smallPromo";
  if (/marquee|large promo|lauf(schrift)? werbekachel|laufschrift werbekachel/.test(widgetText)) return "marqueePromo";

  return uploadType ? `unknownType${uploadType}` : "unknown";
}

function getMediaUploadDiagnostics() {
  const widgets = Array.from(document.querySelectorAll("[data-image-upload-type]"));
  const targets = widgets.map((widget, index) => {
    const input = widget.querySelector("input[type='file']");
    const visibleImages = Array.from(widget.querySelectorAll("img"))
      .filter(image => isVisible(image) && image.getAttribute("src"));
    const removeButtons = Array.from(widget.querySelectorAll("[aria-label]"))
      .map(element => element.getAttribute("aria-label") || "")
      .filter(label => /remove|entfernen|löschen|delete/i.test(label));

    return {
      index,
      kind: getMediaUploadTypeName(widget),
      uploadType: widget.dataset.imageUploadType || "",
      isGlobal: widget.dataset.isGlobal || "",
      jsname: widget.getAttribute("jsname") || "",
      hasFileInput: Boolean(input),
      accept: input ? input.getAttribute("accept") || "" : "",
      multiple: input ? Boolean(input.multiple) : false,
      hasVisibleExistingImage: visibleImages.length > 0,
      existingImageCount: visibleImages.length,
      removeButtonLabels: removeButtons,
      dropText: getVisibleText(widget.querySelector(".ubUOie") || widget.querySelector("[role='button']")),
      elementTextSample: getVisibleText(widget).slice(0, 160)
    };
  });

  return {
    total: targets.length,
    byKind: targets.reduce((counts, target) => ({
      ...counts,
      [target.kind]: (counts[target.kind] || 0) + 1
    }), {}),
    targets
  };
}

function getMediaUploadWidgets(kind) {
  const widgets = Array.from(document.querySelectorAll("[data-image-upload-type]"))
    .filter(widget => getMediaUploadTypeName(widget) === kind);
  const globalWidgets = widgets.filter(widget => widget.dataset.isGlobal === "true");

  return globalWidgets.length ? globalWidgets : widgets;
}

function getVisibleMediaImageCount(kind) {
  return getMediaUploadWidgets(kind)
    .flatMap(widget => Array.from(widget.querySelectorAll("img")))
    .filter(image => isVisible(image) && image.getAttribute("src"))
    .length;
}

function hasMediaUploadInProgress(kind) {
  return getMediaUploadWidgets(kind).some(widget => {
    const hasVisibleProgress = Array.from(widget.querySelectorAll("[role='progressbar']"))
      .some(isVisible);
    if (hasVisibleProgress) return true;

    const visibleText = Array.from(widget.querySelectorAll("*"))
      .filter(isVisible)
      .map(element => element.textContent || "")
      .join(" ");
    return /in bearbeitung|processing|uploading|hochlad|in progress/i.test(visibleText);
  });
}

function hasExistingOrProcessingMedia(kind) {
  return getVisibleMediaImageCount(kind) > 0 || hasMediaUploadInProgress(kind);
}

async function waitForMediaUploadUiChange(kind, beforeCount) {
  for (let attempt = 0; attempt < 20; attempt++) {
    await delay(500);
    const nextCount = getVisibleMediaImageCount(kind);
    if (nextCount > beforeCount) {
      return true;
    }
  }

  return false;
}

function getAvailableMediaUploadInput(kind) {
  return getMediaUploadWidgets(kind)
    .map(widget => ({
      widget,
      input: widget.querySelector("input[type='file']")
    }))
    .find(target => target.input && !target.input.disabled);
}

function dispatchDataTransferEvent(target, type, dataTransfer) {
  let event;
  try {
    event = new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      dataTransfer
    });
  } catch (_error) {
    event = new Event(type, {
      bubbles: true,
      cancelable: true,
      composed: true
    });
    Object.defineProperty(event, "dataTransfer", {
      configurable: true,
      value: dataTransfer
    });
  }

  target.dispatchEvent(event);
}

function ensureMediaUploadBridge() {
  if (mediaUploadBridgePromise) return mediaUploadBridgePromise;

  mediaUploadBridgePromise = new Promise(resolve => {
    const existing = document.querySelector("script[data-storepilot-media-upload-bridge]");
    if (existing) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    let settled = false;

    function finish(ok) {
      if (settled) return;
      settled = true;
      resolve(ok);
    }

    script.dataset.storepilotMediaUploadBridge = "true";
    script.src = STOREPILOT_API.runtime.getURL(MEDIA_UPLOAD_BRIDGE_SCRIPT);
    script.addEventListener("load", () => finish(true), { once: true });
    script.addEventListener("error", () => finish(false), { once: true });
    (document.head || document.documentElement).append(script);
    window.setTimeout(() => finish(false), 1500);
  });

  return mediaUploadBridgePromise;
}

async function serializeMediaFiles(files) {
  const payloads = [];
  const transfers = [];

  for (const file of files.filter(Boolean)) {
    const buffer = await file.arrayBuffer();
    payloads.push({
      name: file.name,
      type: file.type || "",
      lastModified: file.lastModified || Date.now(),
      buffer
    });
    transfers.push(buffer);
  }

  return { payloads, transfers };
}

async function uploadFilesInMainWorld(kind, files) {
  if (!(await ensureMediaUploadBridge())) {
    return { ok: false, message: "page bridge unavailable" };
  }

  const requestId = `storepilot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const { payloads, transfers } = await serializeMediaFiles(files);

  return new Promise(resolve => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      resolve({ ok: false, message: "page bridge timed out" });
    }, 4000);

    function handleMessage(event) {
      const message = event.data;
      if (!message ||
        message.source !== "storepilot-media-upload-bridge" ||
        message.type !== "storepilot-upload-media-main-world-result" ||
        message.requestId !== requestId) {
        return;
      }

      window.clearTimeout(timeoutId);
      window.removeEventListener("message", handleMessage);
      resolve(message.result || { ok: false, message: "empty page bridge response" });
    }

    window.addEventListener("message", handleMessage);

    const message = {
      source: "storepilot-content-script",
      type: "storepilot-upload-media-main-world",
      requestId,
      kind,
      files: payloads
    };

    try {
      window.postMessage(message, "*", transfers);
    } catch (_error) {
      window.postMessage(message, "*");
    }
  });
}

async function uploadFilesInContentWorld(input, files) {
  const widget = input.closest("[data-image-upload-type]");
  const button = widget && widget.querySelector("[role='button'][jsname='DagSrd']");
  const dropTarget = button || widget || input;
  const dataTransfer = new DataTransfer();

  dropTarget.scrollIntoView({ block: "center", inline: "center" });
  if (typeof dropTarget.focus === "function") {
    dropTarget.focus({ preventScroll: true });
  }

  files.filter(Boolean).forEach(file => dataTransfer.items.add(file));

  for (const target of [widget, button, input].filter(Boolean)) {
    dispatchDataTransferEvent(target, "dragenter", dataTransfer);
    dispatchDataTransferEvent(target, "dragover", dataTransfer);
  }
  dispatchDataTransferEvent(dropTarget, "drop", dataTransfer);

  input.files = dataTransfer.files;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  await delay(2500);
}

async function setUploadInputFile(input, files) {
  const widget = input.closest("[data-image-upload-type]");
  const kind = getMediaUploadTypeName(widget);
  const beforeCount = getVisibleMediaImageCount(kind);
  let method = "page bridge";
  let bridgeResult = await uploadFilesInMainWorld(kind, files);

  if (bridgeResult.ok) {
    const uiChanged = await waitForMediaUploadUiChange(kind, beforeCount);
    return {
      ok: uiChanged,
      method,
      bridgeResult,
      beforeCount,
      afterCount: getVisibleMediaImageCount(kind)
    };
  }

  method = "content script";
  await uploadFilesInContentWorld(input, files);
  const uiChanged = await waitForMediaUploadUiChange(kind, beforeCount);

  return {
    ok: uiChanged,
    method,
    bridgeResult,
    beforeCount,
    afterCount: getVisibleMediaImageCount(kind)
  };
}

function getMediaUploadKindLabel(kind) {
  if (kind === "screenshots") return localize("screenshots", "Screenshots");
  if (kind === "storeIcon") return localize("storeIcon", "Store icon");
  if (kind === "smallPromo") return localize("smallPromoTile", "Small promo tile");
  if (kind === "marqueePromo") return localize("marqueePromoTile", "Marquee promo tile");
  return localize("media", "Media");
}

function activateDashboardButton(button) {
  button.scrollIntoView({ block: "center", inline: "center" });
  if (typeof button.focus === "function") {
    button.focus({ preventScroll: true });
  }

  for (const type of ["pointerover", "mouseover", "mouseenter", "pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
    button.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 0,
      buttons: type.endsWith("down") ? 1 : 0,
      view: window
    }));
  }
}

async function revealMediaRemoveControls(kind) {
  const targets = getMediaUploadWidgets(kind)
    .flatMap(widget => Array.from(widget.querySelectorAll("img")))
    .filter(image => isVisible(image) && image.getAttribute("src"))
    .map(image => image.closest("div") || image);

  for (const target of targets) {
    target.scrollIntoView({ block: "center", inline: "center" });
    for (const type of ["pointerover", "mouseover", "mouseenter"]) {
      target.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window
      }));
    }
  }

  if (targets.length) {
    await delay(80);
  }
}

function getVisibleDialogConfirmButton() {
  const buttons = Array.from(document.querySelectorAll([
    "[role='dialog'] button",
    ".VfPpkd-Sx9Kwc button",
    "button[data-mdc-dialog-action='ok']"
  ].join(","))).filter(isVisible);

  return buttons.find(button => button.getAttribute("data-mdc-dialog-action") === "ok") ||
    buttons.find(button => {
      const text = normalizeLanguageText(getVisibleText(button));
      return /^(remove|delete|entfernen|loschen)$/.test(text);
    }) ||
    null;
}

async function confirmVisibleDialog() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const button = getVisibleDialogConfirmButton();
    if (button) {
      activateDashboardButton(button);
      return true;
    }
    await delay(150);
  }

  return false;
}

function getMediaRemoveButtons(kind) {
  return getMediaUploadWidgets(kind)
    .flatMap(widget => Array.from(widget.querySelectorAll("[role='button'][aria-label], [jsname='LCoeQd']")))
    .filter(button => {
      if (button.getAttribute("aria-disabled") === "true") return false;
      if (!isVisible(button)) return false;
      const label = normalizeLanguageText(button.getAttribute("aria-label") || "");
      return button.getAttribute("jsname") === "LCoeQd" ||
        /remove|delete|entfernen|loschen/.test(label);
    });
}

function hasClearableMedia(kind) {
  return getVisibleMediaImageCount(kind) > 0 || getMediaRemoveButtons(kind).length > 0;
}

async function waitForMediaRemovalUiChange(kind, beforeCount) {
  for (let attempt = 0; attempt < 16; attempt++) {
    await delay(300);
    if (getVisibleMediaImageCount(kind) < beforeCount) {
      return true;
    }
  }

  return false;
}

async function performClearDashboardMediaAssets(kind) {
  const removed = [];
  const failed = [];
  let aborted = false;
  const label = getMediaUploadKindLabel(kind);

  for (let attempt = 0; attempt < 30; attempt++) {
    if (mediaOperationState.abortRequested) {
      aborted = true;
      break;
    }

    const beforeCount = getVisibleMediaImageCount(kind);
    if (!beforeCount) break;

    await revealMediaRemoveControls(kind);
    const buttons = getMediaRemoveButtons(kind);
    if (!buttons.length) {
      failed.push(`${label}: remove button not found`);
      break;
    }

    const button = buttons[buttons.length - 1];
    const buttonLabel = button.getAttribute("aria-label") || label;
    activateDashboardButton(button);
    await confirmVisibleDialog();

    const changed = await waitForMediaRemovalUiChange(kind, beforeCount);
    const afterCount = getVisibleMediaImageCount(kind);
    if (!changed) {
      failed.push(`${buttonLabel}: CWS did not remove the image`);
      break;
    }

    const removedCount = Math.max(1, beforeCount - afterCount);
    for (let index = 0; index < removedCount; index++) {
      removed.push(buttonLabel);
    }
  }

  const messageParts = [
    removed.length
      ? localize("mediaClearedKind", "Cleared $1: $2.", [label, String(removed.length)])
      : localize("mediaAlreadyClearKind", "$1 already clear.", [label]),
    aborted ? localize("operationStopped", "Stopped.") : "",
    failed.length ? localize("mediaUploadFailures", "Failed: $1.", [failed.join(", ")]) : ""
  ].filter(Boolean);

  return {
    ok: failed.length === 0,
    aborted,
    message: messageParts.join(" "),
    removed,
    failed,
    diagnostics: {
      mediaUploadTargets: getMediaUploadDiagnostics()
    }
  };
}

async function clearDashboardMediaAssets(kind) {
  return runExclusiveMediaOperation(
    localize("clearingMedia", "Clearing media..."),
    () => performClearDashboardMediaAssets(kind)
  );
}

async function performUploadDashboardMediaAssets(files, kind = "") {
  const uploaded = [];
  const failed = [];
  const skipped = [];
  let aborted = false;
  const uploadStoreIcon = !kind || kind === "storeIcon";
  const uploadScreenshots = !kind || kind === "screenshots";
  const uploadSmallPromo = !kind || kind === "smallPromo";
  const uploadMarqueePromo = !kind || kind === "marqueePromo";
  const screenshots = uploadScreenshots ? Array.from(files && files.screenshots || []) : [];

  if (uploadScreenshots && screenshots.length) {
    for (let index = 0; index < screenshots.length; index++) {
      if (mediaOperationState.abortRequested) {
        aborted = true;
        break;
      }

      const visibleScreenshotCount = getVisibleMediaImageCount("screenshots");
      if (visibleScreenshotCount >= MAX_DASHBOARD_SCREENSHOTS) {
        skipped.push(localize(
          "screenshotsLimitReached",
          "screenshots: CWS limit of $1 already reached",
          [String(MAX_DASHBOARD_SCREENSHOTS)]
        ));
        break;
      }

      const target = getAvailableMediaUploadInput("screenshots");
      if (!target) {
        failed.push(`screenshot ${index + 1}: upload target not found`);
        break;
      }

      try {
        const result = await setUploadInputFile(target.input, [screenshots[index]]);
        if (result.ok) {
          uploaded.push(`screenshot ${index + 1}: ${screenshots[index].name}`);
        } else {
          failed.push(`screenshot ${index + 1}: CWS did not show the uploaded image (${result.method})`);
        }
      } catch (error) {
        failed.push(`screenshot ${index + 1}: ${error.message || String(error)}`);
      }
    }
  } else if (uploadScreenshots) {
    skipped.push("screenshots: no discovered files");
  }

  for (const item of [
    { kind: "storeIcon", file: files && files.storeIcon, label: "store icon", enabled: uploadStoreIcon },
    { kind: "smallPromo", file: files && files.smallPromo, label: "small promo", enabled: uploadSmallPromo },
    { kind: "marqueePromo", file: files && files.marqueePromo, label: "marquee promo", enabled: uploadMarqueePromo }
  ].filter(item => item.enabled)) {
    if (mediaOperationState.abortRequested) {
      aborted = true;
      break;
    }

    if (!item.file) {
      skipped.push(`${item.label}: no discovered file`);
      continue;
    }

    if (hasExistingOrProcessingMedia(item.kind)) {
      skipped.push(`${item.label}: already present or processing`);
      continue;
    }

    const target = getAvailableMediaUploadInput(item.kind);
    if (!target) {
      failed.push(`${item.label}: upload target not found`);
      continue;
    }

    try {
      const result = await setUploadInputFile(target.input, [item.file]);
      if (result.ok) {
        uploaded.push(`${item.label}: ${item.file.name}`);
      } else {
        failed.push(`${item.label}: CWS did not show the uploaded image (${result.method})`);
      }
    } catch (error) {
      failed.push(`${item.label}: ${error.message || String(error)}`);
    }
  }

  const messageParts = [
    localize("mediaUploadedKind", "Uploaded $1: $2.", [getMediaUploadKindLabel(kind), String(uploaded.length)]),
    aborted ? localize("operationStopped", "Stopped.") : "",
    skipped.length ? localize("mediaSkipped", "Skipped: $1.", [skipped.join(", ")]) : "",
    failed.length ? localize("mediaUploadFailures", "Failed: $1.", [failed.join(", ")]) : ""
  ].filter(Boolean);

  return {
    ok: failed.length === 0 && (uploaded.length > 0 || skipped.length > 0),
    aborted,
    message: messageParts.join(" "),
    uploaded,
    skipped,
    failed,
    diagnostics: {
      mediaUploadTargets: getMediaUploadDiagnostics()
    }
  };
}

async function uploadDashboardMediaAssets(files, kind = "") {
  return runExclusiveMediaOperation(
    localize("uploadingMedia", "Uploading media..."),
    () => performUploadDashboardMediaAssets(files, kind)
  );
}

async function diagnoseDashboardPage() {
  await loadListings();

  const dropdown = findLanguageDropdown();
  const descriptionField = findDescriptionField();
  const mediaUploadTargets = getMediaUploadDiagnostics();
  let dropdownOptions = [];

  if (dropdown) {
    const opened = await openLanguageDropdown();
    if (opened.ok) {
      dropdownOptions = getOpenLanguageOptions().map(option => ({
        locale: option.locale,
        text: option.text
      }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await delay(100);
    }
  }

  const diagnostics = {
    url: location.href,
    activeProjectName,
    importedLocaleCount: Object.keys(listings).length,
    selectedLocale,
    languageDropdownFound: Boolean(dropdown),
    languageDropdownText: dropdown ? getVisibleText(dropdown) : "",
    currentDashboardLocale: getCurrentDashboardLocale(),
    dashboardLanguageOptionCount: dropdownOptions.length,
    firstDashboardLanguageOptions: dropdownOptions.slice(0, 8),
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
  if (STOREPILOT_API.runtime && typeof STOREPILOT_API.runtime.sendMessage === "function") {
    STOREPILOT_API.runtime.sendMessage({ action: "openOptionsPage" }).catch(() => {
      window.open(STOREPILOT_API.runtime.getURL("src/options/options.html"), "_blank", "noopener");
    });
    return;
  }

  window.open(STOREPILOT_API.runtime.getURL("src/options/options.html"), "_blank", "noopener");
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
  const group = document.createElement("div");
  group.className = "storepilot-action-group";
  group.append(...controls.filter(Boolean));
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
  const fieldKeys = Object.keys(fields);

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

  const diagnoseButton = createButton(localize("diagnosePage", "Diagnose page"), () => {
    const diagnostics = getPrivacyDiagnostics();
    status.textContent = localize("privacyDiagnosticsSummary", "Found $1 editable privacy candidate(s).", [String(diagnostics.fieldCandidates.length)]);
    console.info("StorePilot privacy diagnostics", diagnostics);
  });
  diagnoseButton.dataset.storepilotAction = "diagnose-privacy";

  const optionsButton = createButton(localize("options", "Options"), openOptionsPage);
  actions.append(
    createPanelActionGroup(fillSinglePurposeButton, fillPrivacyButton),
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

  const fillCurrentButton = createButton(localize("fillCurrent", "Fill current"), async () => {
      if (mediaOperationState.running) {
        status.textContent = localize("mediaOperationAlreadyRunning", "Media operation already running: $1.", [mediaOperationState.label]);
        return;
      }
      const result = await fillCurrentDashboardLanguage();
      status.textContent = result.message;
  });
  fillCurrentButton.dataset.storepilotAction = "fill-current";
  const fillAllButton = createButton(localize("fillAll", "Fill all"), async () => {
    if (mediaOperationState.running) {
      status.textContent = localize("mediaOperationAlreadyRunning", "Media operation already running: $1.", [mediaOperationState.label]);
      return;
    }

    if (isFillingAllLanguages) {
      status.textContent = localize("fillAllAlreadyRunning", "Fill all is already running.");
      return;
    }

    isFillingAllLanguages = true;
    fillAllAbortRequested = false;
    await publishFillAllStatus({
      running: true,
      message: localize("fillingAllLanguages", "Filling all languages...")
    });
    fillAllButton.disabled = true;
    fillCurrentButton.disabled = true;
    setPanelMediaButtonsDisabled(true, localize("fillingAllLanguages", "Filling all languages..."));
    abortButton.hidden = false;
    status.textContent = localize("fillingAllLanguages", "Filling all languages...");

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
        const response = await STOREPILOT_API.runtime.sendMessage({
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
    createPanelActionGroup(fillCurrentButton, fillAllButton),
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
  if (document.getElementById("storepilot-styles")) return;

  const style = document.createElement("style");
  style.id = "storepilot-styles";
  style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483647;
      display: grid;
      gap: 8px;
      width: 320px;
      padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.16);
      border-radius: 8px;
      background: #fff;
      color: #111827;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.2);
      font: 13px/1.4 Arial, sans-serif;
    }

    #${PANEL_ID}[data-theme="dark"] {
      border-color: #343b4a;
      background: #151922;
      color: #f4f6fa;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    }

    #${PANEL_ID}[data-panel-mode="minimized"] {
      width: 220px;
      padding: 10px 12px;
    }

    #${PANEL_ID} .storepilot-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
    }

    #${PANEL_ID} .storepilot-title {
      cursor: grab;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      user-select: none;
      touch-action: none;
    }

    #${PANEL_ID}[data-dragging="true"] .storepilot-title {
      cursor: grabbing;
    }

    #${PANEL_ID} .storepilot-panel-controls {
      display: flex;
      gap: 4px;
    }

    #${PANEL_ID} .storepilot-icon-button {
      width: 26px;
      min-width: 26px;
      min-height: 26px;
      padding: 0;
      line-height: 1;
    }

    #${PANEL_ID} .storepilot-meta {
      color: #475569;
      font-size: 12px;
    }

    #${PANEL_ID}[data-theme="dark"] .storepilot-meta {
      color: #a8b0bf;
    }

    #${PANEL_ID} select,
    #${PANEL_ID} button {
      min-height: 30px;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      background: #fff;
      color: #111827;
      font: inherit;
    }

    #${PANEL_ID} .storepilot-actions {
      display: grid;
      gap: 8px;
    }

    #${PANEL_ID} .storepilot-action-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      padding-top: 8px;
      border-top: 1px solid rgba(148, 163, 184, 0.35);
    }

    #${PANEL_ID} .storepilot-action-group:first-child {
      padding-top: 0;
      border-top: 0;
    }

    #${PANEL_ID} button {
      cursor: pointer;
      font-weight: 700;
    }

    #${PANEL_ID} button:disabled {
      cursor: not-allowed;
      opacity: 0.48;
    }

    #${PANEL_ID} button[hidden] {
      display: none;
    }

    #${PANEL_ID} .storepilot-danger {
      border-color: #dc2626;
      background: #fff5f5;
      color: #b42318;
    }

    #${PANEL_ID}[data-theme="dark"] select,
    #${PANEL_ID}[data-theme="dark"] button {
      border-color: #343b4a;
      background: #202633;
      color: #f4f6fa;
    }

    #${PANEL_ID}[data-theme="dark"] .storepilot-danger {
      border-color: #7f1d1d;
      background: #2b1719;
      color: #ff9b92;
    }

    #${PANEL_ID}[data-theme="dark"] .storepilot-action-group {
      border-top-color: #343b4a;
    }

    #${PANEL_ID} .storepilot-status {
      color: #475569;
      font-size: 12px;
    }

    #${PANEL_ID}[data-panel-mode="minimized"] .storepilot-meta,
    #${PANEL_ID}[data-panel-mode="minimized"] .storepilot-actions,
    #${PANEL_ID}[data-panel-mode="minimized"] .storepilot-status {
      display: none;
    }

    #${PANEL_ID}[data-theme="dark"] .storepilot-status {
      color: #cbd5e1;
    }

    @media (prefers-color-scheme: dark) {
      #${PANEL_ID}:not([data-theme="light"]) {
        border-color: #343b4a;
        background: #151922;
        color: #f4f6fa;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
      }

      #${PANEL_ID}:not([data-theme="light"]) .storepilot-meta {
        color: #a8b0bf;
      }

      #${PANEL_ID}:not([data-theme="light"]) select,
      #${PANEL_ID}:not([data-theme="light"]) button {
        border-color: #343b4a;
        background: #202633;
        color: #f4f6fa;
      }

      #${PANEL_ID}:not([data-theme="light"]) .storepilot-danger {
        border-color: #7f1d1d;
        background: #2b1719;
        color: #ff9b92;
      }

      #${PANEL_ID}:not([data-theme="light"]) .storepilot-action-group {
        border-top-color: #343b4a;
      }

      #${PANEL_ID}:not([data-theme="light"]) .storepilot-status {
        color: #cbd5e1;
      }
    }
  `;
  document.documentElement.append(style);
}

STOREPILOT_API.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

    if (message.type === "storepilot-fill-all-languages") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      await loadSettings();
      renderPanel(await loadListings());
      if (isFillingAllLanguages) {
        sendResponse({ ok: false, message: localize("fillAllAlreadyRunning", "Fill all is already running.") });
        return;
      }

      isFillingAllLanguages = true;
      fillAllAbortRequested = false;
      await publishFillAllStatus({
        running: true,
        message: localize("fillingAllLanguages", "Filling all languages...")
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
          message: result ? result.message : localize("fillAllStopped", "Fill all stopped.")
      });
      renderPanel(Object.keys(listings).sort((a, b) => a.localeCompare(b)));
      sendResponse(result || { ok: false, message: localize("fillAllStopped", "Fill all stopped.") });
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

STOREPILOT_API.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes[SETTINGS_KEY]) {
    currentTheme = (changes[SETTINGS_KEY].newValue && changes[SETTINGS_KEY].newValue.theme) || "system";
    renderPanel(Object.keys(listings).sort((a, b) => a.localeCompare(b)));
  }

  if (changes[PROJECTS_STORAGE_KEY] || changes[ACTIVE_PROJECT_STORAGE_KEY]) {
    loadListings()
      .then(renderPanel)
      .catch(() => {});
  }
});
