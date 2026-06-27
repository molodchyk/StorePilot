const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  console,
  crypto: {
    randomUUID: () => "test-project-id"
  },
  process,
  storePilotText: (_key, fallback) => fallback
});

for (const relativePath of [
  "src/shared/constants.js",
  "src/shared/files.js",
  "src/shared/directory-detection.js",
  "src/shared/projects.js",
  "src/shared/importers.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), context, {
    filename: relativePath
  });
}

function createFakeFile(relativePath, text) {
  return {
    name: path.basename(relativePath),
    webkitRelativePath: relativePath.replace(/\\/g, "/"),
    async text() {
      return text;
    }
  };
}

(async () => {
  const localizedFiles = [
    createFakeFile("new-tab-custom-url/manifest.json", JSON.stringify({
      manifest_version: 3,
      name: "__MSG_extensionName__",
      description: "__MSG_extensionDescription__",
      default_locale: "en"
    })),
    createFakeFile("new-tab-custom-url/_locales/en/messages.json", JSON.stringify({
      extensionName: { message: "New Tab: Custom URL" },
      extensionDescription: { message: "Set your new tab to a custom URL." }
    })),
    createFakeFile("new-tab-custom-url/store-listing/chrome-web-store/listing/en.md", "Detailed description")
  ];
  const localized = await context.storePilotDetectProjectLocalizationFromFileList(
    localizedFiles,
    "new-tab-custom-url"
  );

  assert.equal(localized.isLocalized, true);
  assert.equal(localized.cwsPickerMode, "multi-locale");
  assert.equal(localized.defaultLocale, "en");
  assert.deepEqual(Array.from(localized.localeDirectories), ["en"]);

  const localizedProject = context.storePilotCreateProject("New Tab Custom URL", {
    listings: { en: "Detailed description" },
    localization: localized
  });
  assert.equal(
    context.storePilotGetExpectedLanguageDropdownModeForProject(localizedProject),
    "multi-locale",
    "A localized project uses the CWS top language picker even when only one listing locale is imported."
  );

  let projectState = { projects: [], activeProjectId: "" };
  context.storePilotGetProjectsState = async () => projectState;
  context.storePilotUpsertProject = async nextProject => {
    const exists = projectState.projects.some(project => project.id === nextProject.id);
    projectState = {
      projects: exists
        ? projectState.projects.map(project => project.id === nextProject.id ? nextProject : project)
        : [...projectState.projects, nextProject],
      activeProjectId: nextProject.id
    };
    return nextProject;
  };

  const imported = await context.storePilotImportListingFileList(localizedFiles);
  assert.equal(imported.project.localization.isLocalized, true);
  assert.equal(imported.project.localization.cwsPickerMode, "multi-locale");
  assert.deepEqual(Array.from(projectState.projects[0].localization.localeDirectories), ["en"]);

  const unknownLocalization = await context.storePilotDetectProjectLocalizationFromFileList([
    createFakeFile("new-tab-custom-url/store-listing/chrome-web-store/listing/en.md", "Detailed description")
  ], "new-tab-custom-url");
  const mergedLocalization = context.storePilotMergeProjectLocalization(unknownLocalization, localized);
  assert.equal(
    mergedLocalization.isLocalized,
    true,
    "A partial listing-only re-import should not erase previously detected project localization."
  );

  const existingRootSignalProject = context.storePilotCreateProject("Previously imported localized project", {
    listings: { en: "Detailed description" },
    projectRootSignals: ["extension manifest", "_locales", "store-listing"]
  });
  assert.equal(
    context.storePilotGetExpectedLanguageDropdownModeForProject(existingRootSignalProject),
    "multi-locale",
    "Existing projects imported before localization metadata should infer CWS mode from root _locales evidence."
  );

  const nonLocalized = context.storePilotCreateProject("Single language extension", {
    listings: { en: "Detailed description" },
    localization: context.storePilotCreateProjectLocalizationInfo({
      hasManifest: true,
      manifestPath: "single/manifest.json"
    })
  });
  assert.equal(
    context.storePilotGetExpectedLanguageDropdownModeForProject(nonLocalized),
    "one-language",
    "A known non-localized project uses the Product details language picker."
  );

  const unknownTwoLocaleProject = context.storePilotCreateProject("Legacy import", {
    listings: { en: "English", de: "Deutsch" }
  });
  assert.equal(
    context.storePilotGetExpectedLanguageDropdownModeForProject(unknownTwoLocaleProject),
    "multi-locale",
    "Unknown legacy imports keep the old count-based fallback."
  );

  console.log("Project localization tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
