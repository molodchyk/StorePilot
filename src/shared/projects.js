function storePilotCreateProjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function storePilotFormatTimestamp(date = new Date()) {
  return date.toISOString();
}

function storePilotFormatDisplayTimestamp(value) {
  if (!value) return storePilotText("never", "Never");

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return storePilotText("unknown", "Unknown");

  const pad = number => String(number).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function storePilotCreateProject(name, patch = {}) {
  return {
    id: storePilotCreateProjectId(),
    name: name || storePilotText("untitledProject", "Untitled project"),
    listings: {},
    localization: null,
    sourcePath: "",
    confidence: "",
    score: 0,
    candidateCount: 0,
    mediaAssets: null,
    privacyDoc: null,
    categoryDoc: null,
    additionalFieldsDoc: null,
    lastSyncedAt: "",
    hasFolderHandle: false,
    ...patch
  };
}

function storePilotFormatProjectName(folderName) {
  return String(folderName || storePilotText("importedProject", "Imported project"))
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function storePilotFindProjectByAnyName(projects, names) {
  const normalizedNames = names
    .filter(Boolean)
    .map(name => name.toLowerCase());

  return projects.find(project => normalizedNames.includes(project.name.toLowerCase()));
}

function storePilotNormalizeProjectIdentity(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function storePilotNormalizeSourcePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "")
    .toLowerCase();
}

function storePilotGetProjectNameCandidates(sourcePath, fallbackName = "") {
  const pathParts = storePilotNormalizeSourcePath(sourcePath).split("/").filter(Boolean);
  const candidates = new Set();

  [fallbackName, storePilotFormatProjectName(fallbackName)].filter(Boolean).forEach(name => candidates.add(name));

  if (pathParts[0]) {
    candidates.add(pathParts[0]);
    candidates.add(storePilotFormatProjectName(pathParts[0]));
  }

  const storeListingIndex = pathParts.findIndex(part => part === "store-listing" || part === "store-listings");
  if (storeListingIndex > 0) {
    candidates.add(pathParts[storeListingIndex - 1]);
    candidates.add(storePilotFormatProjectName(pathParts[storeListingIndex - 1]));
  }

  return Array.from(candidates).filter(Boolean);
}

function storePilotFindExistingProject(state, { projectId = "", names = [], sourcePath = "" } = {}) {
  if (projectId) {
    const project = state.projects.find(candidate => candidate.id === projectId);
    if (project) return project;
  }

  const normalizedSourcePath = storePilotNormalizeSourcePath(sourcePath);
  if (normalizedSourcePath) {
    const project = state.projects.find(candidate => (
      storePilotNormalizeSourcePath(candidate.sourcePath) === normalizedSourcePath
    ));
    if (project) return project;
  }

  const normalizedNames = names
    .filter(Boolean)
    .map(storePilotNormalizeProjectIdentity)
    .filter(Boolean);

  return state.projects.find(project => (
    normalizedNames.includes(storePilotNormalizeProjectIdentity(project.name))
  ));
}

function storePilotGetProjectLocaleCount(project) {
  return Object.keys(project && project.listings ? project.listings : {}).length;
}

function storePilotNormalizeLocaleCode(value) {
  const parts = String(value || "")
    .trim()
    .replace(/-/g, "_")
    .split("_")
    .filter(Boolean);
  if (!parts.length) return "";

  return parts
    .map((part, index) => index === 0 ? part.toLowerCase() : part.toUpperCase())
    .join("_");
}

function storePilotNormalizeLanguagePickerMode(value) {
  return value === "multi-locale" || value === "one-language" ? value : "";
}

function storePilotCreateProjectLocalizationInfo(input = {}) {
  const localeDirectories = Array.from(new Set(
    (Array.isArray(input.localeDirectories) ? input.localeDirectories : [])
      .map(storePilotNormalizeLocaleCode)
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));
  const defaultLocale = storePilotNormalizeLocaleCode(input.defaultLocale);
  const manifestPath = String(input.manifestPath || "");
  const hasManifest = Boolean(input.hasManifest || manifestPath);
  const hasLocalesDirectory = Boolean(input.hasLocalesDirectory || localeDirectories.length);
  const manifestUsesMessages = Boolean(input.manifestUsesMessages);
  const hasDetectionEvidence = Boolean(
    hasManifest ||
    hasLocalesDirectory ||
    defaultLocale ||
    manifestUsesMessages ||
    input.isLocalized === true ||
    input.isLocalized === false
  );
  const isLocalized = input.isLocalized === true
    ? true
    : input.isLocalized === false
    ? false
    : hasDetectionEvidence
    ? Boolean(defaultLocale || manifestUsesMessages || hasLocalesDirectory)
    : null;
  const cwsPickerMode = storePilotNormalizeLanguagePickerMode(input.cwsPickerMode) ||
    (isLocalized === true ? "multi-locale" : "");
  const reasons = Array.from(new Set([
    ...(Array.isArray(input.reasons) ? input.reasons : []),
    defaultLocale ? "manifest.default_locale" : "",
    manifestUsesMessages ? "manifest __MSG__ references" : "",
    hasLocalesDirectory ? "_locales messages" : ""
  ].filter(Boolean)));

  return {
    isLocalized,
    cwsPickerMode,
    defaultLocale,
    localeDirectories,
    hasManifest,
    manifestPath,
    hasLocalesDirectory,
    manifestUsesMessages,
    reasons
  };
}

function storePilotNormalizeProjectLocalization(value) {
  return storePilotCreateProjectLocalizationInfo(value && typeof value === "object" ? value : {});
}

function storePilotProjectLocalizationHasEvidence(value) {
  const localization = storePilotNormalizeProjectLocalization(value);
  return Boolean(
    localization.isLocalized !== null ||
    localization.cwsPickerMode ||
    localization.defaultLocale ||
    localization.localeDirectories.length ||
    localization.hasManifest ||
    localization.hasLocalesDirectory ||
    localization.manifestUsesMessages
  );
}

function storePilotMergeProjectLocalization(preferred, fallback) {
  if (storePilotProjectLocalizationHasEvidence(preferred)) {
    return storePilotNormalizeProjectLocalization(preferred);
  }
  if (storePilotProjectLocalizationHasEvidence(fallback)) {
    return storePilotNormalizeProjectLocalization(fallback);
  }

  return preferred || fallback || null;
}

function storePilotGetProjectLocalization(project) {
  const storedLocalization = project && project.localization;
  if (storePilotProjectLocalizationHasEvidence(storedLocalization)) {
    return storePilotNormalizeProjectLocalization(storedLocalization);
  }

  const rootSignals = Array.isArray(project && project.projectRootSignals)
    ? project.projectRootSignals.map(signal => String(signal || "").toLowerCase())
    : [];
  if (rootSignals.includes("_locales")) {
    return storePilotCreateProjectLocalizationInfo({
      isLocalized: true,
      hasLocalesDirectory: true,
      reasons: ["project root _locales signal"]
    });
  }

  return storePilotNormalizeProjectLocalization(storedLocalization);
}

function storePilotGetExpectedLanguageDropdownModeForProject(project, listingsOverride = null) {
  const localization = storePilotGetProjectLocalization(project);
  if (localization.isLocalized === true) return "multi-locale";
  if (localization.isLocalized === false) return "one-language";

  const listings = listingsOverride || project && project.listings || {};
  return Object.keys(listings).length === 1 ? "one-language" : "multi-locale";
}

function storePilotGetPathPartsForProjectFile(file) {
  if (typeof storePilotGetRelativePathParts === "function") {
    return storePilotGetRelativePathParts(file);
  }

  return String(file && (file.webkitRelativePath || file.relativePath || file.name) || "")
    .split(/[\\/]+/)
    .filter(Boolean);
}

function storePilotGetRootRelativePathParts(pathParts, projectRootPath = "") {
  const rootParts = storePilotNormalizeSourcePath(projectRootPath).split("/").filter(Boolean);
  if (!rootParts.length) return pathParts;
  if (pathParts.length < rootParts.length) return null;

  const pathPrefix = pathParts.slice(0, rootParts.length)
    .map(part => String(part || "").toLowerCase());
  const rootPrefix = rootParts.map(part => String(part || "").toLowerCase());
  if (!rootPrefix.every((part, index) => pathPrefix[index] === part)) return null;
  return pathParts.slice(rootParts.length);
}

async function storePilotReadProjectFileText(file) {
  if (!file) return "";
  if (typeof file.text === "function") return file.text();
  if (typeof storePilotReadTextFile === "function") return storePilotReadTextFile(file);
  return "";
}

function storePilotAnalyzeProjectLocalization({ manifestText = "", manifestPath = "", localeDirectories = [] } = {}) {
  let defaultLocale = "";
  const hasManifest = Boolean(manifestText || manifestPath);
  const manifestUsesMessages = /__MSG_[A-Za-z0-9_]+__/.test(String(manifestText || ""));

  if (manifestText) {
    try {
      const manifest = JSON.parse(manifestText);
      defaultLocale = manifest && typeof manifest.default_locale === "string"
        ? manifest.default_locale
        : "";
    } catch (_error) {
      defaultLocale = "";
    }
  }

  return storePilotCreateProjectLocalizationInfo({
    hasManifest,
    manifestPath,
    defaultLocale,
    manifestUsesMessages,
    localeDirectories,
    hasLocalesDirectory: localeDirectories.length > 0
  });
}

async function storePilotDetectProjectLocalizationFromFileList(files, projectRootPath = "") {
  const localeDirectories = new Set();
  let manifestText = "";
  let manifestPath = "";

  for (const file of Array.from(files || [])) {
    const pathParts = storePilotGetPathPartsForProjectFile(file);
    const relativeParts = storePilotGetRootRelativePathParts(pathParts, projectRootPath);
    if (!relativeParts || !relativeParts.length) continue;

    const lowerParts = relativeParts.map(part => String(part || "").toLowerCase());
    if (lowerParts.length === 1 && lowerParts[0] === "manifest.json") {
      manifestText = await storePilotReadProjectFileText(file);
      manifestPath = pathParts.join("/");
      continue;
    }

    if (
      lowerParts[0] === "_locales" &&
      lowerParts.length >= 3 &&
      lowerParts[2] === "messages.json"
    ) {
      localeDirectories.add(relativeParts[1]);
    }
  }

  return storePilotAnalyzeProjectLocalization({
    manifestText,
    manifestPath,
    localeDirectories: Array.from(localeDirectories)
  });
}

async function storePilotFindDirectoryHandleAtProjectRoot(directoryHandle, projectRootPath = "") {
  if (!directoryHandle) return null;

  let pathParts = storePilotNormalizeSourcePath(projectRootPath).split("/").filter(Boolean);
  if (pathParts[0] && pathParts[0].toLowerCase() === String(directoryHandle.name || "").toLowerCase()) {
    pathParts = pathParts.slice(1);
  }

  let current = directoryHandle;
  for (const part of pathParts) {
    let next = null;
    for await (const entry of current.values()) {
      if (entry.kind === "directory" && entry.name.toLowerCase() === part.toLowerCase()) {
        next = entry;
        break;
      }
    }
    if (!next) return null;
    current = next;
  }

  return current;
}

async function storePilotDirectoryHasMessagesFile(localeHandle) {
  for await (const entry of localeHandle.values()) {
    if (entry.kind === "file" && entry.name.toLowerCase() === "messages.json") {
      return true;
    }
  }

  return false;
}

async function storePilotDetectProjectLocalizationFromDirectory(directoryHandle, projectRootPath = "") {
  const rootHandle = await storePilotFindDirectoryHandleAtProjectRoot(directoryHandle, projectRootPath) || directoryHandle;
  const localeDirectories = [];
  let manifestText = "";
  let manifestPath = "";

  for await (const entry of rootHandle.values()) {
    if (entry.kind === "file" && entry.name.toLowerCase() === "manifest.json") {
      manifestText = await (await entry.getFile()).text();
      manifestPath = [projectRootPath || rootHandle.name, entry.name].filter(Boolean).join("/");
      continue;
    }

    if (entry.kind === "directory" && entry.name.toLowerCase() === "_locales") {
      for await (const localeEntry of entry.values()) {
        if (
          localeEntry.kind === "directory" &&
          await storePilotDirectoryHasMessagesFile(localeEntry)
        ) {
          localeDirectories.push(localeEntry.name);
        }
      }
    }
  }

  return storePilotAnalyzeProjectLocalization({
    manifestText,
    manifestPath,
    localeDirectories
  });
}

function storePilotSortProjects(projects) {
  return [...projects].sort((a, b) => a.name.localeCompare(b.name));
}
