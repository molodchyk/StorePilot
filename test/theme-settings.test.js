const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const documentElement = {
  dataset: {},
  removeAttribute(name) {
    if (name === "data-theme") {
      delete this.dataset.theme;
    }
    if (name === "data-theme-style") {
      delete this.dataset.themeStyle;
    }
  }
};

const context = vm.createContext({
  document: {
    documentElement
  }
});

for (const relativePath of [
  "src/shared/theme.js",
  "src/options/options-settings.js",
  "src/popup/settings.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), context, {
    filename: relativePath
  });
}

assert.deepEqual(
  Array.from(context.storePilotGetThemeChoices()),
  ["system", "light", "dark"],
  "Theme choices should stay focused on brightness mode."
);
assert.deepEqual(
  Array.from(context.storePilotGetThemeStyleChoices()),
  ["default", "slate", "ocean", "forest", "high-contrast"],
  "Theme style choices should include the default and styled modes."
);

assert.equal(context.storePilotNormalizeThemeChoice("dark"), "dark");
assert.equal(context.storePilotNormalizeThemeStyle("ocean"), "ocean");
assert.equal(context.storePilotNormalizeThemeStyle("high-contrast"), "high-contrast");
assert.equal(context.storePilotNormalizeThemeChoice("unknown"), "system");
assert.equal(context.storePilotOptionsNormalizeSettings("invalid").theme, "system");
const legacyThemePreferences = context.storePilotNormalizeThemePreferences({ theme: "ocean" });
assert.equal(legacyThemePreferences.theme, "system");
assert.equal(legacyThemePreferences.themeStyle, "ocean", "Legacy single-picker style values should migrate to themeStyle.");

const modePicker = { value: "" };
const stylePicker = { value: "" };

context.storePilotOptionsApplyTheme({ theme: "dark", themeStyle: "forest" }, {
  themeModePicker: modePicker,
  themeStylePicker: stylePicker
});
assert.equal(documentElement.dataset.theme, "dark");
assert.equal(documentElement.dataset.themeStyle, "forest");
assert.equal(modePicker.value, "dark");
assert.equal(stylePicker.value, "forest");

context.storePilotPopupApplyTheme({ theme: "light", themeStyle: "slate" });
assert.equal(documentElement.dataset.theme, "light");
assert.equal(documentElement.dataset.themeStyle, "slate");

context.storePilotOptionsApplyTheme({ theme: "invalid", themeStyle: "invalid" }, {
  themeModePicker: modePicker,
  themeStylePicker: stylePicker
});
assert.equal(documentElement.dataset.theme, undefined);
assert.equal(documentElement.dataset.themeStyle, undefined);
assert.equal(modePicker.value, "system");
assert.equal(stylePicker.value, "default");

const popupHtml = fs.readFileSync(path.join(root, "src/popup/popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(root, "src/popup/popup.js"), "utf8");
const popupCss = fs.readFileSync(path.join(root, "src/popup/popup.css"), "utf8");
for (const [label, source] of [
  ["popup markup", popupHtml],
  ["popup script", popupJs]
]) {
  assert.doesNotMatch(source, /data-theme-mode-picker|data-theme-style-picker|data-theme-mode-choice|popupTheme/, `${label} should not expose appearance controls.`);
}
assert.doesNotMatch(popupCss, /theme-control|appearance-control/, "Popup CSS should not keep styles for removed appearance controls.");

for (const [label, relativePath] of [
  [
    "options",
    [
      "src/options/options-theme.css",
      "src/options/options-theme-modes.css",
      "src/options/options-theme-styles.css",
      "src/options/options-theme-high-contrast.css"
    ]
  ],
  ["popup", "src/popup/popup.css"],
  [
    "dashboard panel",
    [
      "src/content/panel/styles/base.js",
      "src/content/panel/styles/parallel.js",
      "src/content/panel/styles/theme.js",
      "src/content/dashboard-panel-styles.js"
    ]
  ]
]) {
  const paths = Array.isArray(relativePath) ? relativePath : [relativePath];
  const source = paths
    .map(filePath => fs.readFileSync(path.join(root, filePath), "utf8"))
    .join("\n");
  assert.match(
    source,
    /data-theme-style="high-contrast"/,
    `${label} should define high contrast styling.`
  );
  assert.match(
    source,
    /not\(\[data-theme="light"\]\)\[data-theme-style="high-contrast"\]/,
    `${label} should use dark high contrast only for system-dark, not forced light mode.`
  );
  assert.match(
    source,
    /data-theme="dark"\]\[data-theme-style="high-contrast"\]/,
    `${label} should define explicit dark high contrast styling.`
  );
  for (const styleName of ["slate", "ocean", "forest"]) {
    assert.match(
      source,
      new RegExp(`not\\(\\[data-theme="light"\\]\\)\\[data-theme-style="${styleName}"\\]`),
      `${label} should use the dark ${styleName} style when system mode resolves to dark.`
    );
  }
}

console.log("Theme settings tests passed.");
