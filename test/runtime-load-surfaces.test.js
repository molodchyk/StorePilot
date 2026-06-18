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

const manifest = JSON.parse(readText("manifest.json"));
const contentFiles = manifest.content_scripts.flatMap(contentScript => contentScript.js || []);
const injectionFiles = extractPopupInjectionFiles();
const popupHtmlFiles = extractPopupHtmlScripts();

for (const [label, files] of [
  ["manifest content scripts", contentFiles],
  ["popup fallback injection", injectionFiles]
]) {
  for (const required of [
    "src/shared/constants.js",
    "src/shared/i18n.js",
    "src/shared/projects.js",
    "src/shared/dashboard-url.js",
    "src/shared/storage.js",
    "src/content/dashboard-helper.js"
  ]) {
    assert.ok(files.includes(required), `${label} is missing ${required}`);
  }

  assertBefore(files, "src/shared/constants.js", "src/shared/storage.js", label);
  assertBefore(files, "src/shared/i18n.js", "src/shared/storage.js", label);
  assertBefore(files, "src/shared/projects.js", "src/shared/storage.js", label);
  assertBefore(files, "src/shared/dashboard-url.js", "src/shared/storage.js", label);
  assertBefore(files, "src/shared/storage.js", "src/content/dashboard-helper.js", label);
}

assert.deepEqual(injectionFiles, contentFiles, "Popup fallback injection should match manifest content script order.");
for (const required of [
  "src/popup/dashboard-page.js",
  "src/popup/settings.js",
  "src/popup/popup.js"
]) {
  assert.ok(popupHtmlFiles.includes(required), `popup.html is missing ${required}`);
}
assertBefore(popupHtmlFiles, "src/popup/settings.js", "src/popup/popup.js", "popup HTML scripts");

console.log("Runtime load surface tests passed.");
