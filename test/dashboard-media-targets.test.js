const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  console,
  document: {
    querySelectorAll() {
      return [];
    }
  },
  setTimeout,
  Date,
  window: {},
  MouseEvent: class FakeMouseEvent {
    constructor(type, options = {}) {
      this.type = type;
      Object.assign(this, options);
    }
  },
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  normalizeLanguageText(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  },
  normalizeLocale(locale) {
    return String(locale || "").replace("-", "_").toLowerCase();
  },
  localesMatch(left, right) {
    const normalize = value => String(value || "").replace("-", "_").toLowerCase();
    return normalize(left) === normalize(right);
  },
  getVisibleText(element) {
    return element && element.textContent || "";
  },
  localize(_key, fallback, substitutions) {
    return String(fallback || "").replace(/\$(\d+)/g, (_match, index) => {
      const value = substitutions && substitutions[Number(index) - 1];
      return value === undefined || value === null ? "" : String(value);
    });
  },
  getMediaUploadDiagnostics() {
    return {};
  },
  mediaOperationState: {
    abortRequested: false
  }
});

for (const file of [
  "src/content/media/upload-targets.js",
  "src/content/media/upload-waits.js",
  "src/content/media/upload-execution.js",
  "src/content/media/localized-screenshot-progress.js",
  "src/content/media/clear-operations.js",
  "src/content/media/localized-screenshot-files.js",
  "src/content/media/localized-screenshot-upload.js",
  "src/content/media/localized-screenshot-run.js",
  "src/content/dashboard-media.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

function createElement(text, previous = null, parent = null) {
  const element = {
    textContent: text,
    previousElementSibling: previous,
    nextElementSibling: null,
    parentElement: parent,
    dataset: {}
  };
  if (previous) previous.nextElementSibling = element;
  return element;
}

const localizedAssets = createElement("Localized assets");
const localizedLabel = createElement("Localized screenshots *", localizedAssets);
const localizedWidget = createElement("Drop image here", localizedLabel, localizedAssets);
localizedAssets.textContent = "Graphic assets Localized assets Localized screenshots Drop image here";

const globalAssets = createElement("Global assets");
const globalLabel = createElement("Global screenshots *", globalAssets);
const globalWidget = createElement("Drop image here", globalLabel, globalAssets);
globalAssets.textContent = "Graphic assets Global assets Global screenshots Drop image here";

assert.ok(context.scoreLocalizedScreenshotUploadWidget(localizedWidget) >= 100);
assert.ok(context.scoreLocalizedScreenshotUploadWidget(globalWidget) < 100);

const localizedProgressStatus = context.formatLocalizedScreenshotProgressStatus({
  localeIndex: 1,
  totalLocales: 66,
  locale: "ar",
  localeScreenshotCount: 3,
  completedLocales: 1,
  failedLocales: 0,
  skippedLocales: 0,
  uploadedScreenshots: 5,
  totalScreenshots: 198
}, "uploading screenshot 3/3 (attempt 1/3, visible 2)");
assert.deepEqual(localizedProgressStatus.split("\n"), [
  "Localized screenshots",
  "Locale: 2/66 - ar (3 expected)",
  "Run locales: 1/66 completed, 0 failed, 0 skipped",
  "Screenshots: 5/198 uploaded",
  "Elapsed: 0s",
  "Current step: uploading screenshot 3/3 (attempt 1/3, visible 2)"
]);

const assignedLocalizedEntries = context.applyLocalizedScreenshotAssignedLocales([
  { locale: "am", files: ["am-1"] },
  { locale: "ar", files: ["ar-1"] },
  { locale: "pt_BR", files: ["pt-br-1"] }
], ["pt-BR", "am", "pt_br", "missing"]);
assert.deepEqual(Array.from(assignedLocalizedEntries.assignedLocales), ["pt_br", "am", "missing"]);
assert.deepEqual(Array.from(assignedLocalizedEntries.entries).map(entry => entry.locale), ["am", "pt_BR"]);
assert.deepEqual(Array.from(assignedLocalizedEntries.skippedAssignedLocales), [
  "missing: assigned locale has no localized screenshot files"
]);

class FakeElement {
  constructor(tagName, options = {}) {
    this.tagName = tagName.toUpperCase();
    this.textContent = options.textContent || "";
    this.dataset = options.dataset || {};
    this.attributes = options.attributes || {};
    this.className = options.className || "";
    this.children = [];
    this.parentElement = null;
    this.previousElementSibling = null;
    this.nextElementSibling = null;
    this.rect = options.rect || { top: 0, bottom: 20, left: 0, right: 200, width: 200, height: 20 };
    this.hidden = Boolean(options.hidden);
    this.clickCount = 0;
  }

  append(...children) {
    children.forEach(child => {
      const previous = this.children[this.children.length - 1] || null;
      if (previous) {
        previous.nextElementSibling = child;
        child.previousElementSibling = previous;
      }
      child.parentElement = this;
      this.children.push(child);
    });
  }

  getAttribute(name) {
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      return this.dataset[key] || "";
    }
    return this.attributes[name] || "";
  }

  matches(selector) {
    if (selector === "*") return true;
    if (selector === "div") return this.tagName === "DIV";
    if (selector === "section") return this.tagName === "SECTION";
    if (selector === "article") return this.tagName === "ARTICLE";
    if (selector === "c-wiz") return this.tagName === "C-WIZ";
    if (selector === "img") return this.tagName === "IMG";
    if (selector === "input[type='file']") return this.tagName === "INPUT" && this.attributes.type === "file";
    if (selector === "[role='button']") return this.attributes.role === "button";
    if (selector === "[role='button'][aria-label]") return this.attributes.role === "button" && Boolean(this.attributes["aria-label"]);
    if (selector === "[role='button'][jsname='DagSrd']") return this.attributes.role === "button" && this.attributes.jsname === "DagSrd";
    if (selector === "[jsname='LCoeQd']") return this.attributes.jsname === "LCoeQd";
    if (selector === "[aria-label]") return Boolean(this.attributes["aria-label"]);
    if (selector === "button[data-mdc-dialog-action='ok']") return this.tagName === "BUTTON" && this.attributes["data-mdc-dialog-action"] === "ok";
    if (selector === "[data-image-upload-type]") return Boolean(this.dataset.imageUploadType);
    if (selector === ".aQzcYd") return this.className.split(/\s+/).includes("aQzcYd");
    return false;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches(selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  querySelectorAll(selector) {
    const selectors = selector.split(",").map(part => part.trim());
    const results = [];
    const visit = element => {
      if (selectors.some(part => element.matches(part))) {
        results.push(element);
      }
      element.children.forEach(visit);
    };
    this.children.forEach(visit);
    return results;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  getBoundingClientRect() {
    return this.rect;
  }

  scrollIntoView() {}

  focus() {}

  dispatchEvent() {
    return true;
  }
}

function createUploadField({ top, text, isGlobal = false, imageCount = 0, removePrefix = "Remove image Screenshot" }) {
  const label = new FakeElement("div", {
    textContent: text,
    rect: { top, bottom: top + 24, left: 40, right: 260, width: 220, height: 24 }
  });
  const field = new FakeElement("div", {
    textContent: `${text} Drop image here`,
    dataset: isGlobal ? { imageUploadType: "4", isGlobal: "true" } : {},
    rect: { top: top + 40, bottom: top + 180, left: 300, right: 720, width: 420, height: 140 }
  });
  const uploadWidget = new FakeElement("div", {
    className: "aQzcYd",
    textContent: "Drop image here",
    rect: { top: top + 120, bottom: top + 180, left: 520, right: 720, width: 200, height: 60 }
  });
  const button = new FakeElement("div", {
    textContent: "Drop image here",
    attributes: { role: "button", jsname: "DagSrd" },
    rect: uploadWidget.rect
  });
  const input = new FakeElement("input", {
    attributes: { type: "file", accept: ".png,.jpg,.jpeg" },
    rect: uploadWidget.rect
  });

  for (let index = 0; index < imageCount; index++) {
    field.append(new FakeElement("img", {
      attributes: { src: `image-${index}.png` },
      rect: { top: top + 50, bottom: top + 100, left: 310 + index * 60, right: 360 + index * 60, width: 50, height: 50 }
    }));
    field.append(new FakeElement("div", {
      attributes: { role: "button", jsname: "LCoeQd", "aria-label": `${removePrefix} ${index + 1}` },
      rect: { top: top + 45, bottom: top + 75, left: 340 + index * 60, right: 370 + index * 60, width: 30, height: 30 }
    }));
  }
  uploadWidget.append(button, input);
  field.append(uploadWidget);

  return { label, field, uploadWidget, input };
}

function flatten(elements) {
  const output = [];
  const visit = element => {
    output.push(element);
    element.children.forEach(visit);
  };
  elements.forEach(visit);
  return output;
}

const storeIconField = createUploadField({
  top: 20,
  text: "Store icon *",
  imageCount: 1,
  removePrefix: "Remove image Store icon"
});
const localizedField = createUploadField({ top: 100, text: "Localised screenshots *", imageCount: 2 });
const localizedUploadError = new FakeElement("div", {
  textContent: "Error: An unknown error occurred.",
  attributes: { role: "alert" },
  rect: { top: 240, bottom: 270, left: 520, right: 720, width: 200, height: 30 },
  hidden: true
});
const localizedUploadErrorClose = new FakeElement("div", {
  attributes: { role: "button", jsname: "P0Jxu", "aria-label": "Close image upload status" },
  rect: { top: 270, bottom: 300, left: 690, right: 720, width: 30, height: 30 },
  hidden: true
});
localizedField.field.append(localizedUploadError, localizedUploadErrorClose);
const globalField = createUploadField({ top: 420, text: "Global screenshots *", isGlobal: true, imageCount: 1 });
const marqueeField = createUploadField({
  top: 680,
  text: "Marquee promo tile",
  imageCount: 1,
  removePrefix: "Remove image Marquee promo"
});
const allInputs = [localizedField.input, globalField.input];
const allLabels = [storeIconField.label, localizedField.label, globalField.label, marqueeField.label];
const allContainers = [
  storeIconField.field,
  storeIconField.uploadWidget,
  localizedField.field,
  localizedField.uploadWidget,
  globalField.field,
  globalField.uploadWidget,
  marqueeField.field,
  marqueeField.uploadWidget
];
const allElements = flatten(allLabels.concat(allContainers));
const confirmButton = new FakeElement("button", {
  textContent: "Remove",
  attributes: { "data-mdc-dialog-action": "ok" },
  rect: { top: 400, bottom: 440, left: 760, right: 840, width: 80, height: 40 },
  hidden: true
});
let pendingDeleteButton = null;

context.document = {
  querySelectorAll(selector) {
    if (selector === "[role='dialog'] button,.VfPpkd-Sx9Kwc button,button[data-mdc-dialog-action='ok']") {
      return [confirmButton];
    }
    if (selector === "input[type='file']") return allInputs;
    if (selector === "h1,h2,h3,h4,span,p,div,label") return allLabels;
    if (selector === "div,section,article,c-wiz") return allContainers;
    if (selector === "[data-image-upload-type]") return [globalField.field];
    if (selector === "img") return allElements.filter(element => element.matches("img"));
    if (selector === "[role='alert']") return allElements.filter(element => element.getAttribute("role") === "alert");
    if (selector === "[aria-live]") return [];
    if (selector === ".e16bl" || selector === ".J5br2e") return [];
    if (selector === "button") return allElements.filter(element => element.tagName === "BUTTON");
    if (selector === "[role='button']") return allElements.filter(element => element.getAttribute("role") === "button");
    if (selector === "[aria-label]") return allElements.filter(element => Boolean(element.getAttribute("aria-label")));
    if (selector === "[jsname='P0Jxu']") return allElements.filter(element => element.getAttribute("jsname") === "P0Jxu");
    if (selector === "svg.l3jvA" || selector === "svg[viewBox='0 0 48 48']") return [];
    if (selector === "[role='button'][aria-label], [jsname='LCoeQd']") {
      return allElements.filter(element => element.matches("[role='button'][aria-label]") || element.matches("[jsname='LCoeQd']"));
    }
    if (selector === "*") return allElements;
    return [];
  },
  querySelector() {
    return null;
  }
};
context.isVisible = element => !element.hidden;

const localizedTargets = Array.from(context.getLocalizedScreenshotUploadTargets());
assert.equal(localizedTargets.length, 1);
assert.equal(localizedTargets[0].input, localizedField.input);
assert.equal(context.getVisibleMediaImageCount("localizedScreenshots"), 2);
assert.equal(context.getVisibleMediaImageCount("screenshots"), 1);

const localizedRemoveButtons = context.getMediaRemoveButtons("localizedScreenshots");
assert.equal(localizedRemoveButtons.length, 2);
assert.deepEqual(
  Array.from(localizedRemoveButtons, button => button.getAttribute("aria-label")),
  ["Remove image Screenshot 1", "Remove image Screenshot 2"]
);

context.activateDashboardButton = button => {
  button.clickCount += 1;
  if (button === confirmButton) {
    assert.ok(pendingDeleteButton, "confirmation was clicked without a pending localized delete");
    pendingDeleteButton.hidden = true;
    const previous = pendingDeleteButton.previousElementSibling;
    if (previous && previous.tagName === "IMG") previous.hidden = true;
    pendingDeleteButton = null;
    confirmButton.hidden = true;
    return;
  }

  if ((button.getAttribute("aria-label") || "").startsWith("Remove image Screenshot") &&
    context.isElementInsideLocalizedScreenshotField(button)) {
    assert.equal(pendingDeleteButton, null, "clicked another localized delete while confirmation dialog was open");
    pendingDeleteButton = button;
    confirmButton.hidden = false;
  }
};

localizedUploadError.hidden = false;
localizedUploadErrorClose.hidden = false;
assert.equal(context.getLocalizedScreenshotUploadErrorMessage(), "Error: An unknown error occurred.");
const localizedUploadErrorDismissButtons = Array.from(context.getLocalizedScreenshotUploadErrorDismissButtons());
assert.equal(localizedUploadErrorDismissButtons.length, 1);
assert.equal(localizedUploadErrorDismissButtons[0], localizedUploadErrorClose);
assert.equal(context.dismissLocalizedScreenshotUploadErrors(), "Error: An unknown error occurred.");
assert.equal(localizedUploadErrorClose.clickCount, 1);
localizedUploadError.hidden = true;
localizedUploadErrorClose.hidden = true;

(async () => {
  const result = await context.performClearLocalizedScreenshotAssets();
  assert.equal(result.ok, true);
  assert.equal(result.removed.length, 2);
  assert.equal(context.getVisibleMediaImageCount("localizedScreenshots"), 0);
  assert.equal(context.getVisibleMediaImageCount("screenshots"), 1);
  assert.equal(confirmButton.clickCount, 2);
  assert.equal(pendingDeleteButton, null);
  const globalRemoveButtons = context.getMediaRemoveButtons("screenshots");
  assert.equal(globalRemoveButtons.length, 1);
  assert.equal(globalRemoveButtons[0].getAttribute("aria-label"), "Remove image Screenshot 1");
  assert.equal(globalRemoveButtons[0].clickCount, 0);

  let selectedDashboardLocale = "";
  let capturedSelectionOptions = null;
  context.getCurrentDashboardLocale = ({ includePageFallback = true } = {}) => (
    includePageFallback ? selectedDashboardLocale : selectedDashboardLocale
  );
  context.selectDashboardLanguage = async (locale, options = {}) => {
    capturedSelectionOptions = options;
    selectedDashboardLocale = locale;
    return { ok: true, verified: false, message: `Selected ${locale}.` };
  };

  const fastSelection = await context.ensureDashboardLanguageSelected("de", {
    selectionOptions: { confirmationAttempts: 2, confirmationDelayMs: 0 },
    verificationAttempts: 0,
    verificationDelayMs: 0
  });
  assert.equal(fastSelection.ok, true);
  assert.deepEqual(capturedSelectionOptions, { confirmationAttempts: 2, confirmationDelayMs: 0 });

  selectedDashboardLocale = "fr";
  context.selectDashboardLanguage = async () => ({ ok: true, verified: false, message: "Selected de." });
  const mismatchedSelection = await context.ensureDashboardLanguageSelected("de", {
    verificationAttempts: 0,
    verificationDelayMs: 0
  });
  assert.equal(mismatchedSelection.ok, false);

  selectedDashboardLocale = "";
  const unknownSelection = await context.ensureDashboardLanguageSelected("de", {
    verificationAttempts: 0,
    verificationDelayMs: 0,
    allowUnknownLocaleAfterSelection: true
  });
  assert.equal(unknownSelection.ok, true);

  const startLocaleResult = context.applyLocalizedScreenshotStartLocale([
    { locale: "am", files: ["am-1"] },
    { locale: "ar", files: ["ar-1"] },
    { locale: "pt_BR", files: ["pt-1"] }
  ], "pt-BR");
  assert.equal(startLocaleResult.ok, true);
  assert.deepEqual(Array.from(startLocaleResult.entries, entry => entry.locale), ["pt_BR"]);
  assert.deepEqual(Array.from(startLocaleResult.skippedBeforeStart), ["2 locale(s) before start locale pt-BR"]);
  assert.equal(context.applyLocalizedScreenshotStartLocale(startLocaleResult.entries, "de").ok, false);

  console.log("Dashboard media target tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
