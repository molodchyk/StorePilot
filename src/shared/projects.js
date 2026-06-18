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

function storePilotSortProjects(projects) {
  return [...projects].sort((a, b) => a.name.localeCompare(b.name));
}
