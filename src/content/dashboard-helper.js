const STORAGE_KEY = "storePilotListings";
const PANEL_ID = "storepilot-panel";

let listings = {};
let selectedLocale = "";

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
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  listings = stored[STORAGE_KEY] || {};
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
    ? `${locales.length} listings ready`
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
      width: 240px;
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
      grid-template-columns: 1fr 1fr 1fr;
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
      sendResponse(await copySelectedText());
      return;
    }

    if (message.type === "storepilot-fill") {
      sendResponse(fillSelectedText());
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
