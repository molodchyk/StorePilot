const LEGACY_STORAGE_KEY = "storePilotListings";
var STOREPILOT_API = globalThis.browser || globalThis.chrome;
const PROJECTS_STORAGE_KEY = "storePilotProjects";
const ACTIVE_PROJECT_STORAGE_KEY = "storePilotActiveProjectId";
const SETTINGS_KEY = "storePilotSettings";
const FILL_ALL_STATUS_STORAGE_KEY = "storePilotFillAllStatus";
const PANEL_ID = "storepilot-panel";

let listings = {};
let selectedLocale = "";
let activeProjectName = "";
let activeProjectUpdatedAt = "";
let currentTheme = "system";
let isFillingAllLanguages = false;
let fillAllAbortRequested = false;
let fillAllStatus = {
  running: false,
  message: ""
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function localize(key, fallback, substitutions) {
  const message = STOREPILOT_API.i18n && STOREPILOT_API.i18n.getMessage
    ? STOREPILOT_API.i18n.getMessage(key, substitutions)
    : "";
  return message || fallback;
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
  return Object.keys(listings).find(key => normalizeLocale(key) === normalized) || "";
}

function getLocaleFromText(text, localeKeys = Object.keys(listings)) {
  const normalizedText = normalizeLocale(text);
  const sortedLocaleKeys = [...localeKeys].sort((a, b) => b.length - a.length);

  for (const locale of sortedLocaleKeys) {
    const normalizedLocale = normalizeLocale(locale);
    const escaped = normalizedLocale.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");

    if (pattern.test(normalizedText)) {
      return locale;
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
  const fillCurrentButton = panel.querySelector("[data-storepilot-action='fill-current']");
  const fillAllButton = panel.querySelector("[data-storepilot-action='fill-all']");
  const abortButtons = Array.from(panel.querySelectorAll("[data-storepilot-action='abort-fill-all'], .storepilot-danger"));

  if (fillCurrentButton) fillCurrentButton.disabled = running;
  if (fillAllButton) fillAllButton.disabled = running;
  abortButtons.forEach(button => {
    button.hidden = !running;
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
  await loadListings();

  const locale = getCurrentDashboardLocale();
  if (!locale) {
    return { ok: false, message: localize("currentDashboardLanguageNotDetected", "Could not detect the current dashboard language.") };
  }

  return fillDashboardLocale(locale);
}

async function fillAllDashboardLanguages(onProgress = null) {
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

  const matchingOptions = availableOptions.filter(option => getListingLocaleKey(option.locale));
  if (!matchingOptions.length) {
    return { ok: false, message: localize("noImportedLocalesMatchMenu", "No imported locales match the dashboard language menu.") };
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

  return {
    ok: filled > 0 && remainingFailed.length === 0,
    message: (remainingFailed.length
      ? localize("filledLanguagesFailed", "Filled $1 dashboard language(s); failed $2: $3.", [String(filled), String(remainingFailed.length), failedNames])
      : localize("filledLanguages", "Filled $1 dashboard language(s).", [String(filled)])) + retryNote
  };
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

async function diagnoseDashboardPage() {
  await loadListings();

  const dropdown = findLanguageDropdown();
  const descriptionField = findDescriptionField();
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
  if (STOREPILOT_API.runtime && typeof STOREPILOT_API.runtime.openOptionsPage === "function") {
    const result = STOREPILOT_API.runtime.openOptionsPage();
    if (result && typeof result.catch === "function") {
      result.catch(() => {
        window.open(STOREPILOT_API.runtime.getURL("src/options/options.html"), "_blank", "noopener");
      });
    }
    return;
  }

  window.open(STOREPILOT_API.runtime.getURL("src/options/options.html"), "_blank", "noopener");
}

function renderPanel(locales) {
  const existing = document.getElementById(PANEL_ID);
  if (existing) existing.remove();

  const panel = document.createElement("section");
  const title = document.createElement("div");
  const meta = document.createElement("div");
  const status = document.createElement("div");
  const actions = document.createElement("div");

  panel.id = PANEL_ID;
  if (currentTheme !== "system") {
    panel.dataset.theme = currentTheme;
  }
  title.className = "storepilot-title";
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
      const result = await fillCurrentDashboardLanguage();
      status.textContent = result.message;
  });
  fillCurrentButton.dataset.storepilotAction = "fill-current";
  const fillAllButton = createButton(localize("fillAll", "Fill all"), async () => {
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
    }
  });
  fillAllButton.dataset.storepilotAction = "fill-all";
  const abortButton = createButton(localize("abort", "Abort"), () => {
    const result = abortFillAllLanguages();
    status.textContent = result.message;
  });
  abortButton.dataset.storepilotAction = "abort-fill-all";
  abortButton.className = "storepilot-danger";
  abortButton.hidden = !isFillingAllLanguages;
  const optionsButton = createButton(localize("options", "Options"), openOptionsPage);

  actions.append(fillCurrentButton, fillAllButton, abortButton, optionsButton);

  panel.append(title, meta, actions, status);
  document.documentElement.append(panel);
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
      width: 280px;
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

    #${PANEL_ID} .storepilot-title {
      font-weight: 700;
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
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    #${PANEL_ID} button {
      cursor: pointer;
      font-weight: 700;
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

    #${PANEL_ID} .storepilot-status {
      color: #475569;
      font-size: 12px;
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
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse(await copySelectedText());
      return;
    }

    if (message.type === "storepilot-fill") {
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse(fillSelectedText());
      return;
    }

    if (message.type === "storepilot-fill-current-language") {
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse(await fillCurrentDashboardLanguage());
      return;
    }

    if (message.type === "storepilot-fill-all-languages") {
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

    if (message.type === "storepilot-abort-fill-all") {
      sendResponse(abortFillAllLanguages());
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
      sendResponse(await diagnoseDashboardPage());
    }
  })();

  return true;
});

(async () => {
  injectStyles();
  await loadSettings();
  renderPanel(await loadListings());
})();

STOREPILOT_API.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes[SETTINGS_KEY]) {
    currentTheme = (changes[SETTINGS_KEY].newValue && changes[SETTINGS_KEY].newValue.theme) || "system";
    renderPanel(Object.keys(listings).sort((a, b) => a.localeCompare(b)));
  }
});
