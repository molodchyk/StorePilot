const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertBefore(list, before, after, label) {
  const beforeIndex = list.indexOf(before);
  const afterIndex = list.indexOf(after);
  assert.notEqual(beforeIndex, -1, `${label} is missing ${before}`);
  assert.notEqual(afterIndex, -1, `${label} is missing ${after}`);
  assert.ok(beforeIndex < afterIndex, `${before} must load before ${after} in ${label}`);
}

function extractPopupInjectionFiles() {
  const source = readText("src/popup/dashboard-page.js");
  const filesMatch = source.match(/files:\s*\[([\s\S]*?)\]/);
  assert.ok(filesMatch, "Popup dashboard injection file list was not found.");

  return Array.from(filesMatch[1].matchAll(/"([^"]+)"/g), match => match[1]);
}

function extractPopupHtmlScripts() {
  const html = readText("src/popup/popup.html");
  return Array.from(html.matchAll(/<script\s+src="([^"]+)"/g), match => {
    const src = match[1];
    if (src.startsWith("../")) return `src/${src.slice(3)}`;
    return `src/popup/${src}`;
  });
}

function extractOptionsHtmlScripts() {
  const html = readText("src/options/options.html");
  return Array.from(html.matchAll(/<script\s+src="([^"]+)"/g), match => {
    const src = match[1];
    if (src.startsWith("../")) return `src/${src.slice(3)}`;
    return `src/options/${src}`;
  });
}

const manifest = JSON.parse(readText("manifest.json"));
const backgroundFiles = manifest.background.scripts || [];
const contentFiles = manifest.content_scripts.flatMap(contentScript => contentScript.js || []);
const injectionFiles = extractPopupInjectionFiles();
const popupHtmlFiles = extractPopupHtmlScripts();
const optionsHtmlFiles = extractOptionsHtmlScripts();
const platformFiles = [
  "src/platform/webextension/core.js",
  "src/platform/webextension/storage.js",
  "src/platform/webextension/tabs.js",
  "src/platform/webextension/runtime.js",
  "src/platform/webextension/scripting.js",
  "src/platform/webextension/action.js",
  "src/platform/webextension/i18n.js"
];

function assertPlatformFiles(files, label) {
  for (const required of platformFiles) {
    assert.ok(files.includes(required), `${label} is missing ${required}`);
  }

  for (let index = 1; index < platformFiles.length; index += 1) {
    assertBefore(files, platformFiles[index - 1], platformFiles[index], label);
  }
}

assertPlatformFiles(backgroundFiles, "manifest background scripts");

const backgroundMediaFiles = [
  "src/background/media/parallel-core.js",
  "src/background/media/parallel-log-storage.js",
  "src/background/media/parallel-mutation-gate.js",
  "src/background/media/parallel-progress-state.js",
  "src/background/media/file-resolution.js",
  "src/background/media/parallel-worker-lifecycle.js",
  "src/background/media/parallel-phase-runner.js",
  "src/background/media/parallel-run-commands.js",
  "src/background/media/parallel-message-handlers.js",
  "src/background/media.js"
];

for (const required of [
  ...backgroundMediaFiles,
  "src/background.js"
]) {
  assert.ok(backgroundFiles.includes(required), `manifest background scripts are missing ${required}`);
}

for (let index = 1; index < backgroundMediaFiles.length; index += 1) {
  assertBefore(backgroundFiles, backgroundMediaFiles[index - 1], backgroundMediaFiles[index], "manifest background scripts");
}

assertBefore(backgroundFiles, "src/background/media.js", "src/background.js", "manifest background scripts");

for (const [label, files] of [
  ["manifest content scripts", contentFiles],
  ["popup fallback injection", injectionFiles]
]) {
  assertPlatformFiles(files, label);

  for (const required of [
    "src/shared/constants.js",
    "src/shared/i18n.js",
    "src/shared/theme.js",
    "src/shared/projects.js",
    "src/shared/dashboard-url.js",
    "src/shared/storage.js",
    "src/shared/store-docs/privacy-schema.js",
    "src/content/dashboard-dom.js",
    "src/content/dashboard-project-context.js",
    "src/content/media/upload-targets.js",
    "src/content/media/upload-waits.js",
    "src/content/media/upload-execution.js",
    "src/content/media/localized-screenshot-progress.js",
    "src/content/media/clear-operations.js",
    "src/content/media/localized-screenshot-files.js",
    "src/content/media/localized-screenshot-upload.js",
    "src/content/media/localized-screenshot-run.js",
    "src/content/panel/state.js",
    "src/content/panel/parallel-timeline.js",
    "src/content/panel/worker-progress.js",
    "src/content/panel/parallel-board.js",
    "src/content/panel/render.js",
    "src/content/panel/parallel-render.js",
    "src/content/panel/styles/base.js",
    "src/content/panel/styles/parallel.js",
    "src/content/panel/styles/theme.js",
    "src/content/dashboard-panel-styles.js",
    "src/content/dashboard-helper.js",
    "src/content/dashboard-messages.js"
  ]) {
    assert.ok(files.includes(required), `${label} is missing ${required}`);
  }

  assertBefore(files, "src/shared/constants.js", "src/shared/storage.js", label);
  assertBefore(files, "src/shared/i18n.js", "src/shared/storage.js", label);
  assertBefore(files, "src/shared/theme.js", "src/content/dashboard-helper.js", label);
  assertBefore(files, "src/shared/projects.js", "src/shared/storage.js", label);
  assertBefore(files, "src/shared/dashboard-url.js", "src/shared/storage.js", label);
  assertBefore(files, "src/shared/store-docs/privacy-schema.js", "src/shared/store-docs/privacy-doc.js", label);
  assertBefore(files, "src/content/dashboard-dom.js", "src/content/dashboard-project-context.js", label);
  assertBefore(files, "src/content/dashboard-project-context.js", "src/content/dashboard-helper.js", label);
  assertBefore(files, "src/content/media/upload-targets.js", "src/content/media/upload-waits.js", label);
  assertBefore(files, "src/content/media/upload-waits.js", "src/content/media/upload-execution.js", label);
  assertBefore(files, "src/content/media/upload-execution.js", "src/content/media/localized-screenshot-progress.js", label);
  assertBefore(files, "src/content/media/upload-execution.js", "src/content/dashboard-media.js", label);
  assertBefore(files, "src/content/media/localized-screenshot-progress.js", "src/content/media/clear-operations.js", label);
  assertBefore(files, "src/content/media/clear-operations.js", "src/content/dashboard-media.js", label);
  assertBefore(files, "src/content/media/clear-operations.js", "src/content/media/localized-screenshot-files.js", label);
  assertBefore(files, "src/content/media/localized-screenshot-files.js", "src/content/media/localized-screenshot-upload.js", label);
  assertBefore(files, "src/content/media/localized-screenshot-upload.js", "src/content/media/localized-screenshot-run.js", label);
  assertBefore(files, "src/content/media/localized-screenshot-run.js", "src/content/dashboard-media.js", label);
  assertBefore(files, "src/content/media/upload-targets.js", "src/content/media/localized-screenshot-progress.js", label);
  assertBefore(files, "src/content/media/upload-targets.js", "src/content/dashboard-media.js", label);
  assertBefore(files, "src/content/media/upload-waits.js", "src/content/dashboard-media.js", label);
  assertBefore(files, "src/content/media/localized-screenshot-progress.js", "src/content/dashboard-media.js", label);
  assertBefore(files, "src/content/panel/state.js", "src/content/panel/parallel-timeline.js", label);
  assertBefore(files, "src/content/panel/parallel-timeline.js", "src/content/panel/worker-progress.js", label);
  assertBefore(files, "src/content/panel/worker-progress.js", "src/content/panel/parallel-board.js", label);
  assertBefore(files, "src/content/panel/parallel-board.js", "src/content/panel/render.js", label);
  assertBefore(files, "src/content/panel/render.js", "src/content/panel/parallel-render.js", label);
  assertBefore(files, "src/content/panel/parallel-render.js", "src/content/dashboard-helper.js", label);
  assertBefore(files, "src/content/panel/styles/base.js", "src/content/dashboard-panel-styles.js", label);
  assertBefore(files, "src/content/panel/styles/parallel.js", "src/content/dashboard-panel-styles.js", label);
  assertBefore(files, "src/content/panel/styles/theme.js", "src/content/dashboard-panel-styles.js", label);
  assertBefore(files, "src/shared/storage.js", "src/content/dashboard-helper.js", label);
  assertBefore(files, "src/content/dashboard-helper.js", "src/content/dashboard-messages.js", label);
}

assert.deepEqual(injectionFiles, contentFiles, "Popup fallback injection should match manifest content script order.");
for (const required of [
  "src/shared/store-docs/privacy-schema.js",
  "src/shared/store-docs/privacy-doc.js",
  "src/shared/theme.js",
  "src/popup/dashboard-page.js",
  "src/popup/settings.js",
  "src/popup/popup.js"
]) {
  assert.ok(popupHtmlFiles.includes(required), `popup.html is missing ${required}`);
}
assertPlatformFiles(popupHtmlFiles, "popup HTML scripts");
assertBefore(popupHtmlFiles, "src/shared/store-docs/privacy-schema.js", "src/shared/store-docs/privacy-doc.js", "popup HTML scripts");
assertBefore(popupHtmlFiles, "src/shared/theme.js", "src/popup/settings.js", "popup HTML scripts");
assertBefore(popupHtmlFiles, "src/popup/settings.js", "src/popup/popup.js", "popup HTML scripts");
for (const required of [
  "src/shared/store-docs/privacy-schema.js",
  "src/shared/store-docs/privacy-doc.js",
  "src/shared/theme.js",
  "src/options/options-media.js",
  "src/options/options-review-ui.js",
  "src/options/options-privacy-review.js",
  "src/options/options-review-tables.js",
  "src/options/options-settings.js",
  "src/options/options.js"
]) {
  assert.ok(optionsHtmlFiles.includes(required), `options.html is missing ${required}`);
}
assertPlatformFiles(optionsHtmlFiles, "options HTML scripts");
assertBefore(optionsHtmlFiles, "src/shared/store-docs/privacy-schema.js", "src/shared/store-docs/privacy-doc.js", "options HTML scripts");
assertBefore(optionsHtmlFiles, "src/options/options-review-ui.js", "src/options/options-privacy-review.js", "options HTML scripts");
assertBefore(optionsHtmlFiles, "src/options/options-review-ui.js", "src/options/options-review-tables.js", "options HTML scripts");
assertBefore(optionsHtmlFiles, "src/options/options-privacy-review.js", "src/options/options.js", "options HTML scripts");
assertBefore(optionsHtmlFiles, "src/shared/theme.js", "src/options/options-settings.js", "options HTML scripts");
assertBefore(optionsHtmlFiles, "src/options/options-settings.js", "src/options/options.js", "options HTML scripts");

console.log("Runtime load surface tests passed.");
