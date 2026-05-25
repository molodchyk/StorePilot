const STOREPILOT_LISTING_STORAGE_KEY = "storePilotListings";
var STOREPILOT_API = globalThis.browser || globalThis.chrome;
const STOREPILOT_PROJECTS_STORAGE_KEY = "storePilotProjects";
const STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY = "storePilotActiveProjectId";
const STOREPILOT_HANDLE_DB_NAME = "storePilotHandles";
const STOREPILOT_HANDLE_DB_VERSION = 1;
const STOREPILOT_HANDLE_STORE_NAME = "handles";
const STOREPILOT_TEXT_LISTING_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".text",
  ".rtf",
  ".html",
  ".htm",
  ".json",
  ".yaml",
  ".yml",
  ".csv",
  ".tsv",
  ".xml",
  ".properties"
]);
const STOREPILOT_BLOCKED_LISTING_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".avif",
  ".ico",
  ".zip",
  ".crx",
  ".xpi",
  ".pdf",
  ".exe",
  ".dll",
  ".bin"
]);
const STOREPILOT_SKIPPED_DIRECTORY_NAMES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".cache",
  ".next",
  "node_modules"
]);

function storePilotGetLocaleFromFileName(fileName) {
  const name = fileName.replace(/\.[^.]+$/i, "");

  if (!/^[a-z]{2,3}(?:_[A-Z0-9]{2,4})?$/.test(name)) {
    return null;
  }

  return name;
}

function storePilotGetFileExtension(fileName) {
  const match = fileName.toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : "";
}

function storePilotIsPotentialListingFile(file) {
  const locale = storePilotGetLocaleFromFileName(file.name);
  const extension = storePilotGetFileExtension(file.name);

  if (!locale) return false;
  if (STOREPILOT_TEXT_LISTING_EXTENSIONS.has(extension)) return true;
  if (STOREPILOT_BLOCKED_LISTING_EXTENSIONS.has(extension)) return false;

  return !file.size || file.size <= 512 * 1024;
}

function storePilotShouldSkipDirectory(directoryName) {
  return STOREPILOT_SKIPPED_DIRECTORY_NAMES.has(directoryName.toLowerCase());
}

function storePilotCreateProjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function storePilotFormatTimestamp(date = new Date()) {
  return date.toISOString();
}

function storePilotCreateProject(name, patch = {}) {
  return {
    id: storePilotCreateProjectId(),
    name: name || "Untitled project",
    listings: {},
    sourcePath: "",
    confidence: "",
    score: 0,
    candidateCount: 0,
    lastSyncedAt: "",
    hasFolderHandle: false,
    ...patch
  };
}

function storePilotGetProjectLocaleCount(project) {
  return Object.keys(project && project.listings ? project.listings : {}).length;
}

function storePilotSortProjects(projects) {
  return [...projects].sort((a, b) => a.name.localeCompare(b.name));
}

function storePilotOpenHandleDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(STOREPILOT_HANDLE_DB_NAME, STOREPILOT_HANDLE_DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore(STOREPILOT_HANDLE_STORE_NAME);
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function storePilotWithHandleStore(mode, callback) {
  const db = await storePilotOpenHandleDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STOREPILOT_HANDLE_STORE_NAME, mode);
    const store = transaction.objectStore(STOREPILOT_HANDLE_STORE_NAME);
    const request = callback(store);

    if (request) {
      request.addEventListener("error", () => reject(request.error));
    }

    transaction.addEventListener("complete", () => {
      db.close();
      resolve(request ? request.result : undefined);
    });
    transaction.addEventListener("error", () => {
      db.close();
      reject(transaction.error);
    });
    transaction.addEventListener("abort", () => {
      db.close();
      reject(transaction.error);
    });
  });
}

async function storePilotSaveProjectHandle(projectId, directoryHandle) {
  await storePilotWithHandleStore("readwrite", store => store.put(directoryHandle, projectId));
}

async function storePilotGetProjectHandle(projectId) {
  return storePilotWithHandleStore("readonly", store => store.get(projectId));
}

async function storePilotDeleteProjectHandle(projectId) {
  await storePilotWithHandleStore("readwrite", store => store.delete(projectId));
}

async function storePilotCanReadHandle(directoryHandle, requestAccess = false) {
  if (!directoryHandle || typeof directoryHandle.queryPermission !== "function") {
    return false;
  }

  const options = { mode: "read" };
  if ((await directoryHandle.queryPermission(options)) === "granted") {
    return true;
  }

  return requestAccess &&
    typeof directoryHandle.requestPermission === "function" &&
    (await directoryHandle.requestPermission(options)) === "granted";
}

function storePilotNormalizePath(parts) {
  return parts.join("/").toLowerCase();
}

function storePilotCountMatches(values, patterns) {
  return values.reduce((count, value) => (
    count + (patterns.some(pattern => pattern.test(value)) ? 1 : 0)
  ), 0);
}

function storePilotLooksLikeListingText(text) {
  const normalized = text.toLowerCase();
  const signals = [
    /\bfeatures?\b/,
    /\bprivacy\b/,
    /\bopen source\b/,
    /\bsource code\b/,
    /\bwhat'?s new\b/,
    /\bversion\s+\d/,
    /\bextension\b/,
    /\bchrome web store\b/,
    /\byoutube\b/,
    /\brecommendations?\b/,
    /\bdoes not collect\b/,
    /datenschutz/,
    /confidentialit/,
    /privacidad/,
    /конфиденциаль/,
    /приватн/,
    /версі/,
    /versión/,
    /versione/,
    /versie/,
    /versão/,
    /版本/
  ];

  return text.length > 250 && signals.some(pattern => pattern.test(normalized));
}

function storePilotCalculateConfidence(score) {
  if (score >= 180) return "high";
  if (score >= 80) return "medium";
  return "low";
}

function storePilotScoreDirectory(pathParts, files, childDirectoryNames = []) {
  const path = storePilotNormalizePath(pathParts);
  const directoryNames = pathParts.map(part => part.toLowerCase());
  const localeFiles = files.filter(file => storePilotGetLocaleFromFileName(file.name));
  const localeCount = localeFiles.length;
  const listingLikeCount = localeFiles.filter(file => storePilotLooksLikeListingText(file.sample || "")).length;

  if (!localeCount) return 0;

  let score = localeCount * 6;

  if (localeCount >= 40) score += 90;
  else if (localeCount >= 10) score += 50;
  else if (localeCount >= 3) score += 20;

  score += listingLikeCount * 12;

  if (files.some(file => storePilotGetLocaleFromFileName(file.name) === "en")) score += 35;
  if (files.some(file => storePilotGetLocaleFromFileName(file.name) === "de")) score += 10;
  if (files.some(file => storePilotGetLocaleFromFileName(file.name) === "uk")) score += 10;

  score += storePilotCountMatches(directoryNames, [
    /^listing$/,
    /^listings$/,
    /^store-listing$/,
    /^store-listings$/,
    /^chrome-web-store$/,
    /^chrome$/,
    /^web-store$/,
    /^metadata$/,
    /^locales?$/
  ]) * 18;

  score += storePilotCountMatches(childDirectoryNames.map(name => name.toLowerCase()), [
    /^media$/,
    /^screenshots?$/,
    /^promo$/,
    /^images?$/,
    /^assets?$/
  ]) * 8;

  if (path.endsWith("store-listing/chrome-web-store/listing")) score += 35;
  if (path.endsWith("chrome-web-store/listing")) score += 25;
  if (path.endsWith("store-listing/firefox-add-ons/listing")) score += 20;

  score -= storePilotCountMatches(directoryNames, [
    /^node_modules$/,
    /^\.git$/,
    /^dist$/,
    /^dist-firefox$/,
    /^src$/,
    /^scripts$/,
    /^release$/,
    /^_locales$/,
    /^docs?$/
  ]) * 60;

  if (localeCount === 1 && listingLikeCount === 0) score -= 30;

  return Math.max(0, score);
}

async function storePilotCollectCandidateDirectories(directoryHandle) {
  const candidates = [];

  async function walk(handle, pathParts) {
    const textFiles = [];
    const childDirectoryNames = [];

    for await (const entry of handle.values()) {
      if (entry.kind === "directory") {
        if (storePilotShouldSkipDirectory(entry.name)) {
          continue;
        }

        childDirectoryNames.push(entry.name);
        await walk(entry, [...pathParts, entry.name]);
        continue;
      }

      const file = await entry.getFile();

      if (!storePilotIsPotentialListingFile(file)) {
        continue;
      }

      const sample = await file.text();
      textFiles.push({
        name: entry.name,
        sample: sample.slice(0, 4000),
        async text() {
          return sample;
        }
      });
    }

    if (textFiles.length) {
      const score = storePilotScoreDirectory(pathParts, textFiles, childDirectoryNames);
      if (score) {
        candidates.push({
          path: pathParts.join("/") || handle.name,
          score,
          confidence: storePilotCalculateConfidence(score),
          files: textFiles
        });
      }
    }
  }

  await walk(directoryHandle, [directoryHandle.name]);
  candidates.sort((a, b) => b.score - a.score || b.files.length - a.files.length);
  return candidates;
}

async function storePilotGetListings() {
  const project = await storePilotGetActiveProject();
  return project ? project.listings || {} : {};
}

async function storePilotSetListings(listings) {
  const state = await storePilotGetProjectsState();
  let activeProjectId = state.activeProjectId;
  let projects = state.projects;

  if (!activeProjectId || !projects.some(project => project.id === activeProjectId)) {
    const project = storePilotCreateProject("Manual import");
    activeProjectId = project.id;
    projects = [...projects, project];
  }

  projects = projects.map(project => project.id === activeProjectId
    ? { ...project, listings, lastSyncedAt: storePilotFormatTimestamp() }
    : project
  );

  await storePilotSetProjectsState({ projects, activeProjectId });
}

async function storePilotGetProjectsState() {
  const stored = await STOREPILOT_API.storage.local.get([
    STOREPILOT_PROJECTS_STORAGE_KEY,
    STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY,
    STOREPILOT_LISTING_STORAGE_KEY
  ]);
  let projects = stored[STOREPILOT_PROJECTS_STORAGE_KEY] || [];
  let activeProjectId = stored[STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY] || "";

  if (!projects.length && stored[STOREPILOT_LISTING_STORAGE_KEY] && Object.keys(stored[STOREPILOT_LISTING_STORAGE_KEY]).length) {
    const migrated = storePilotCreateProject("Imported listings", {
      listings: stored[STOREPILOT_LISTING_STORAGE_KEY],
      lastSyncedAt: storePilotFormatTimestamp()
    });
    projects = [migrated];
    activeProjectId = migrated.id;
    await storePilotSetProjectsState({ projects, activeProjectId });
  }

  if (projects.length && !projects.some(project => project.id === activeProjectId)) {
    activeProjectId = projects[0].id;
    await STOREPILOT_API.storage.local.set({ [STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY]: activeProjectId });
  }

  return { projects, activeProjectId };
}

async function storePilotSetProjectsState({ projects, activeProjectId }) {
  await STOREPILOT_API.storage.local.set({
    [STOREPILOT_PROJECTS_STORAGE_KEY]: projects,
    [STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY]: activeProjectId || ""
  });
}

async function storePilotGetActiveProject() {
  const { projects, activeProjectId } = await storePilotGetProjectsState();
  return projects.find(project => project.id === activeProjectId) || projects[0] || null;
}

async function storePilotSetActiveProject(projectId) {
  const { projects } = await storePilotGetProjectsState();
  if (!projects.some(project => project.id === projectId)) return;
  await STOREPILOT_API.storage.local.set({ [STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY]: projectId });
}

async function storePilotUpsertProject(nextProject, setActive = true) {
  const state = await storePilotGetProjectsState();
  const exists = state.projects.some(project => project.id === nextProject.id);
  const projects = exists
    ? state.projects.map(project => project.id === nextProject.id ? nextProject : project)
    : [...state.projects, nextProject];

  await storePilotSetProjectsState({
    projects,
    activeProjectId: setActive ? nextProject.id : state.activeProjectId || nextProject.id
  });

  return nextProject;
}

async function storePilotDeleteProject(projectId) {
  const state = await storePilotGetProjectsState();
  const projects = state.projects.filter(project => project.id !== projectId);
  const activeProjectId = state.activeProjectId === projectId
    ? (projects[0] && projects[0].id) || ""
    : state.activeProjectId;

  await storePilotDeleteProjectHandle(projectId);
  await storePilotSetProjectsState({ projects, activeProjectId });
}

async function storePilotReadTextFile(file) {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

async function storePilotImportListingFiles(files) {
  const activeProject = await storePilotGetActiveProject();
  const project = activeProject || storePilotCreateProject("Manual import");
  const nextListings = { ...(project.listings || {}) };
  const textFiles = Array.from(files).filter(storePilotIsPotentialListingFile);
  const skipped = [];
  let imported = 0;

  for (const file of textFiles) {
    const locale = storePilotGetLocaleFromFileName(file.name);
    if (!locale) {
      skipped.push(file.name);
      continue;
    }

    nextListings[locale] = await storePilotReadTextFile(file);
    imported++;
  }

  await storePilotUpsertProject({
    ...project,
    listings: nextListings,
    sourcePath: project.sourcePath || "Manual file import",
    lastSyncedAt: storePilotFormatTimestamp()
  });

  return {
    imported,
    skipped,
    total: textFiles.length,
    listings: nextListings,
    project
  };
}

async function storePilotImportListingDirectory(directoryHandle, projectId = "") {
  const candidates = await storePilotCollectCandidateDirectories(directoryHandle);

  if (!candidates.length) {
    return {
      imported: 0,
      skipped: [],
      total: 0,
      listings: await storePilotGetListings(),
      sourcePath: "",
      candidateCount: 0
    };
  }

  const best = candidates[0];
  const state = await storePilotGetProjectsState();
  const existingProject = state.projects.find(project => project.id === projectId) ||
    state.projects.find(project => project.name === directoryHandle.name);
  const project = existingProject || storePilotCreateProject(directoryHandle.name);
  const result = await storePilotReadListingFiles(best.files);
  const nextProject = {
    ...project,
    name: project.name || directoryHandle.name,
    listings: result.listings,
    sourcePath: best.path,
    candidateCount: candidates.length,
    confidence: best.confidence,
    score: best.score,
    lastSyncedAt: storePilotFormatTimestamp(),
    hasFolderHandle: true
  };

  await storePilotSaveProjectHandle(nextProject.id, directoryHandle);
  await storePilotUpsertProject(nextProject);

  return {
    ...result,
    project: nextProject,
    sourcePath: best.path,
    candidateCount: candidates.length,
    confidence: best.confidence,
    score: best.score
  };
}

async function storePilotReadListingFiles(files) {
  const textFiles = Array.from(files).filter(storePilotIsPotentialListingFile);
  const listings = {};
  const skipped = [];
  let imported = 0;

  for (const file of textFiles) {
    const locale = storePilotGetLocaleFromFileName(file.name);
    if (!locale) {
      skipped.push(file.name);
      continue;
    }

    listings[locale] = await storePilotReadTextFile(file);
    imported++;
  }

  return {
    imported,
    skipped,
    total: textFiles.length,
    listings
  };
}

async function storePilotSyncProject(projectId, requestAccess = false) {
  const state = await storePilotGetProjectsState();
  const project = state.projects.find(candidate => candidate.id === projectId);

  if (!project) {
    return { ok: false, message: "Project not found." };
  }

  const directoryHandle = await storePilotGetProjectHandle(project.id);
  if (!directoryHandle) {
    return { ok: false, message: "Choose the project folder again to enable sync." };
  }

  if (!(await storePilotCanReadHandle(directoryHandle, requestAccess))) {
    return { ok: false, message: "Folder permission is needed before sync." };
  }

  const result = await storePilotImportListingDirectory(directoryHandle, project.id);
  return {
    ok: result.imported > 0,
    message: `Synced ${result.imported} locale${result.imported === 1 ? "" : "s"} from ${result.sourcePath}.`,
    ...result
  };
}

async function storePilotSyncAllProjects(requestAccess = false) {
  const state = await storePilotGetProjectsState();
  const results = [];

  for (const project of state.projects) {
    if (!project.hasFolderHandle) {
      results.push({ project, ok: false, message: "No folder handle saved." });
      continue;
    }

    results.push({
      project,
      ...(await storePilotSyncProject(project.id, requestAccess))
    });
  }

  await STOREPILOT_API.storage.local.set({ [STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY]: state.activeProjectId });

  return results;
}
