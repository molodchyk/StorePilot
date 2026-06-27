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
  getVisibleText(element) {
    return element && element.textContent || "";
  }
});

vm.runInContext(fs.readFileSync(path.join(root, "src/content/dashboard-media.js"), "utf8"), context, {
  filename: "src/content/dashboard-media.js"
});

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
    if (selector === "input[type='file']") return this.tagName === "INPUT" && this.attributes.type === "file";
    if (selector === "[role='button']") return this.attributes.role === "button";
    if (selector === "[role='button'][jsname='DagSrd']") return this.attributes.role === "button" && this.attributes.jsname === "DagSrd";
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
      if (selectors.some(part => element.matches(part) ||
        part === "img" && element.tagName === "IMG" ||
        part === "[aria-label]" && Boolean(element.attributes["aria-label"]) ||
        part === "[jsname='LCoeQd']" && element.attributes.jsname === "LCoeQd")) {
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
}

function createUploadField({ top, text, isGlobal = false, imageCount = 0 }) {
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
  }
  uploadWidget.append(button, input);
  field.append(uploadWidget);

  return { label, field, uploadWidget, input };
}

const localizedField = createUploadField({ top: 100, text: "Localised screenshots *", imageCount: 2 });
const globalField = createUploadField({ top: 420, text: "Global screenshots *", isGlobal: true, imageCount: 1 });
const allInputs = [localizedField.input, globalField.input];
const allLabels = [localizedField.label, globalField.label];
const allContainers = [localizedField.field, localizedField.uploadWidget, globalField.field, globalField.uploadWidget];

context.document = {
  querySelectorAll(selector) {
    if (selector === "input[type='file']") return allInputs;
    if (selector === "h1,h2,h3,h4,span,p,div,label") return allLabels;
    if (selector === "div,section,article,c-wiz") return allContainers;
    if (selector === "[data-image-upload-type]") return [globalField.field];
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

console.log("Dashboard media target tests passed.");
