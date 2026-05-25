const LEGACY_STORAGE_KEY = "storePilotListings";
const PROJECTS_STORAGE_KEY = "storePilotProjects";
const ACTIVE_PROJECT_STORAGE_KEY = "storePilotActiveProjectId";
const PANEL_ID = "storepilot-panel";

let listings = {};
let selectedLocale = "";
let activeProjectName = "";

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  const stored = await chrome.storage.local.get([
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
  if (!text) return { ok: false, message: "No listing selected." };

  await navigator.clipboard.writeText(text);
  return { ok: true, message: `Copied ${selectedLocale}.` };
}

function fillSelectedText() {
  const text = getSelectedText();
  if (!text) return { ok: false, message: "No listing selected." };

  const target = findLikelyListingField();
  if (!target) {
    return { ok: false, message: "No visible editable field found." };
  }

  fillElement(target, text);
  return { ok: true, message: `Filled ${selectedLocale}.` };
}

function normalizeLocale(locale) {
  return String(locale || "").replace("-", "_").toLowerCase();
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

async function openLanguageDropdown() {
  const dropdown = findLanguageDropdown();
  if (!dropdown) {
    return { ok: false, message: "Could not find the Chrome Web Store language dropdown." };
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
    const currentLocale = getCurrentDashboardLocale();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return {
      ok: normalizeLocale(currentLocale) === normalizedTarget,
      message: `Could not find ${locale} in the dashboard language menu.`
    };
  }

  option.element.scrollIntoView({ block: "center", inline: "nearest" });
  option.element.click();
  await delay(650);

  return { ok: true, message: `Selected ${locale}.` };
}

async function fillDashboardLocale(locale) {
  const localeKey = getListingLocaleKey(locale);
  if (!localeKey) {
    return { ok: false, message: `No listing text for ${locale}.` };
  }

  const field = findDescriptionField();
  if (!field) {
    return { ok: false, message: "Could not find the Chrome Web Store description field." };
  }

  fillElement(field, listings[localeKey]);
  selectedLocale = localeKey;
  return { ok: true, message: `Filled ${localeKey}.` };
}

async function fillCurrentDashboardLanguage() {
  await loadListings();

  const locale = getCurrentDashboardLocale();
  if (!locale) {
    return { ok: false, message: "Could not detect the current dashboard language." };
  }

  return fillDashboardLocale(locale);
}

async function fillAllDashboardLanguages() {
  await loadListings();

  const localeKeys = Object.keys(listings).sort((a, b) => a.localeCompare(b));
  if (!localeKeys.length) {
    return { ok: false, message: "No project listings imported." };
  }

  const firstOpen = await openLanguageDropdown();
  if (!firstOpen.ok) return firstOpen;

  const availableLocales = getOpenLanguageOptions().map(option => option.locale);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await delay(150);

  const matchingLocales = availableLocales.filter(locale => getListingLocaleKey(locale));
  if (!matchingLocales.length) {
    return { ok: false, message: "No imported locales match the dashboard language menu." };
  }

  let filled = 0;
  const failed = [];

  for (const locale of matchingLocales) {
    const selection = await selectDashboardLanguage(locale);
    if (!selection.ok) {
      failed.push(locale);
      continue;
    }

    const result = await fillDashboardLocale(locale);
    if (result.ok) {
      filled++;
    } else {
      failed.push(locale);
    }
  }

  return {
    ok: filled > 0 && failed.length === 0,
    message: `Filled ${filled} dashboard language${filled === 1 ? "" : "s"}${failed.length ? `; failed ${failed.length}.` : "."}`
  };
}

function createButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderPanel(locales) {
  const existing = document.getElementById(PANEL_ID);
  if (existing) existing.remove();

  const panel = document.createElement("section");
  const title = document.createElement("div");
  const select = document.createElement("select");
  const status = document.createElement("div");
  const actions = document.createElement("div");

  panel.id = PANEL_ID;
  title.className = "storepilot-title";
  status.className = "storepilot-status";
  actions.className = "storepilot-actions";

  title.textContent = "StorePilot";
  status.textContent = locales.length
    ? `${locales.length} listings ready${activeProjectName ? ` for ${activeProjectName}` : ""}`
    : "Import listings in StorePilot options";

  locales.forEach(locale => {
    const option = document.createElement("option");
    option.value = locale;
    option.textContent = locale;
    option.selected = locale === selectedLocale;
    select.append(option);
  });

  select.addEventListener("change", event => {
    selectedLocale = event.target.value;
    status.textContent = `${selectedLocale} selected`;
  });

  actions.append(
    createButton("Copy", async () => {
      const result = await copySelectedText();
      status.textContent = result.message;
    }),
    createButton("Fill field", () => {
      const result = fillSelectedText();
      status.textContent = result.message;
    }),
    createButton("Fill current", async () => {
      const result = await fillCurrentDashboardLanguage();
      status.textContent = result.message;
    }),
    createButton("Fill all", async () => {
      const result = await fillAllDashboardLanguages();
      status.textContent = result.message;
    }),
    createButton("Reload", async () => {
      renderPanel(await loadListings());
    })
  );

  panel.append(title, select, actions, status);
  document.documentElement.append(panel);
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

    #${PANEL_ID} .storepilot-title {
      font-weight: 700;
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

    #${PANEL_ID} .storepilot-status {
      color: #475569;
      font-size: 12px;
    }
  `;
  document.documentElement.append(style);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "storepilot-copy") {
      renderPanel(await loadListings());
      sendResponse(await copySelectedText());
      return;
    }

    if (message.type === "storepilot-fill") {
      renderPanel(await loadListings());
      sendResponse(fillSelectedText());
      return;
    }

    if (message.type === "storepilot-fill-current-language") {
      renderPanel(await loadListings());
      sendResponse(await fillCurrentDashboardLanguage());
      return;
    }

    if (message.type === "storepilot-fill-all-languages") {
      renderPanel(await loadListings());
      sendResponse(await fillAllDashboardLanguages());
      return;
    }

    if (message.type === "storepilot-reload") {
      renderPanel(await loadListings());
      sendResponse({ ok: true });
    }
  })();

  return true;
});

(async () => {
  injectStyles();
  renderPanel(await loadListings());
})();
