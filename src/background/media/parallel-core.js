const MAX_PARALLEL_LOCALIZED_SCREENSHOT_WORKERS = 6;
const PARALLEL_LOCALIZED_SCREENSHOT_WORKER_READY_TIMEOUT_MS = 90000;
const PARALLEL_LOCALIZED_SCREENSHOT_WORKER_READY_POLL_MS = 1000;
const PARALLEL_LOCALIZED_SCREENSHOT_PARENT_UPDATE_TIMEOUT_MS = 1500;
const PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD = "clearThenUpload";
const PARALLEL_LOCALIZED_SCREENSHOT_MODE_REPLACE = "replace";
const PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_ONLY = "clearOnly";
const PARALLEL_LOCALIZED_SCREENSHOT_MODE_UPLOAD_ONLY = "uploadOnly";
const PARALLEL_LOCALIZED_SCREENSHOT_MUTATION_SUCCESS_COOLDOWN_MS = 750;
const PARALLEL_LOCALIZED_SCREENSHOT_MUTATION_ERROR_COOLDOWN_MS = 4000;
const PARALLEL_LOCALIZED_SCREENSHOT_MUTATION_LEASE_TIMEOUT_MS = 120000;
const PARALLEL_LOCALIZED_SCREENSHOT_ABORT_GRACE_MS = 30000;
const PARALLEL_LOCALIZED_SCREENSHOT_STALE_WORKER_RESTART_LIMIT = 2;
const PARALLEL_LOCALIZED_SCREENSHOT_LOG_STORAGE_KEY = "storePilotParallelLocalizedScreenshotLogs";
const PARALLEL_LOCALIZED_SCREENSHOT_STORED_LOG_LIMIT = 5;
const PARALLEL_LOCALIZED_SCREENSHOT_STATUS_CLEARED_AUDITED = "clearedAudited";
const localizedScreenshotParallelRuns = new Map();

function text(key, fallback, substitutions) {
  return typeof storePilotText === "function" ? storePilotText(key, fallback, substitutions) : substitutions
    ? substitutions.reduce((message, value, index) => message.replace(`$${index + 1}`, value), fallback)
    : fallback;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setBackgroundTimer(callback, ms) {
  const timer = setTimeout(callback, ms);
  if (timer && typeof timer.unref === "function") {
    timer.unref();
  }
  return timer;
}

function normalizeParallelLocalizedScreenshotLocale(value) {
  const normalized = typeof storePilotNormalizeLocaleCode === "function"
    ? storePilotNormalizeLocaleCode(value)
    : String(value || "").trim().replace(/-/g, "_");
  return String(normalized || "").trim().replace(/-/g, "_").toLowerCase();
}

function normalizeAssignedParallelLocales(assignedLocales) {
  if (!Array.isArray(assignedLocales)) return [];

  const seen = new Set();
  const normalizedLocales = [];
  for (const locale of assignedLocales) {
    const normalizedLocale = normalizeParallelLocalizedScreenshotLocale(locale);
    if (!normalizedLocale || seen.has(normalizedLocale)) continue;
    seen.add(normalizedLocale);
    normalizedLocales.push(normalizedLocale);
  }
  return normalizedLocales;
}

function normalizeParallelLocalizedScreenshotMode(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/[\s_-]+/g, "")
    .toLowerCase();

  if (["replace", "fullreplace", "legacy"].includes(normalized)) {
    return PARALLEL_LOCALIZED_SCREENSHOT_MODE_REPLACE;
  }
  if (["clear", "clearonly", "delete", "deleteonly"].includes(normalized)) {
    return PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_ONLY;
  }
  if (["upload", "uploadonly", "send", "sendonly"].includes(normalized)) {
    return PARALLEL_LOCALIZED_SCREENSHOT_MODE_UPLOAD_ONLY;
  }
  return PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_THEN_UPLOAD;
}

function getParallelLocalizedScreenshotOperationForMode(mode) {
  const normalizedMode = normalizeParallelLocalizedScreenshotMode(mode);
  if (normalizedMode === PARALLEL_LOCALIZED_SCREENSHOT_MODE_CLEAR_ONLY) return "clearOnly";
  if (normalizedMode === PARALLEL_LOCALIZED_SCREENSHOT_MODE_UPLOAD_ONLY) return "uploadOnly";
  return "replace";
}

function getRequestedParallelLocalizedScreenshotWorkerCount(workerCount = 2) {
  return Math.min(
    Math.max(Number.parseInt(String(workerCount || 2), 10) || 2, 1),
    MAX_PARALLEL_LOCALIZED_SCREENSHOT_WORKERS
  );
}

function getParallelLocalizedScreenshotLocales(files) {
  return Object.entries(files && files.localizedScreenshots || {})
    .filter(([_locale, localeFiles]) => (localeFiles || []).length)
    .map(([locale]) => locale)
    .sort((left, right) => normalizeParallelLocalizedScreenshotLocale(left).localeCompare(normalizeParallelLocalizedScreenshotLocale(right)));
}

function countParallelLocalizedScreenshotFiles(files, locales) {
  const localizedScreenshots = files && files.localizedScreenshots || {};
  return locales.reduce((sum, locale) => {
    const matchedLocale = Object.keys(localizedScreenshots)
      .find(candidate => normalizeParallelLocalizedScreenshotLocale(candidate) === normalizeParallelLocalizedScreenshotLocale(locale));
    const localeFiles = matchedLocale ? localizedScreenshots[matchedLocale] || [] : [];
    return sum + Math.min(localeFiles.length, 5);
  }, 0);
}

function countParallelLocalizedScreenshotFilesForLocale(files, locale) {
  return countParallelLocalizedScreenshotFiles(files, [locale]);
}

function splitParallelLocalizedScreenshotLocales(locales, workerCount = 2) {
  const uniqueLocales = Array.from(new Set((locales || [])
    .map(locale => normalizeParallelLocalizedScreenshotLocale(locale))
    .filter(Boolean)));
  if (!uniqueLocales.length) return [];

  const normalizedWorkerCount = Math.min(getRequestedParallelLocalizedScreenshotWorkerCount(workerCount), uniqueLocales.length);
  const baseSize = Math.floor(uniqueLocales.length / normalizedWorkerCount);
  const extraCount = uniqueLocales.length % normalizedWorkerCount;
  const chunks = [];
  let offset = 0;

  for (let index = 0; index < normalizedWorkerCount; index++) {
    const size = baseSize + (index < extraCount ? 1 : 0);
    chunks.push(uniqueLocales.slice(offset, offset + size));
    offset += size;
  }

  return chunks.filter(chunk => chunk.length);
}

function buildParallelLocalizedScreenshotPlan(files, options = {}) {
  const allLocales = getParallelLocalizedScreenshotLocales(files);
  let runLocales = allLocales;
  const skipped = [];
  const assignedLocales = normalizeAssignedParallelLocales(options.assignedLocales);

  if (Array.isArray(options.assignedLocales)) {
    const assignedSet = new Set(assignedLocales);
    runLocales = allLocales.filter(locale => assignedSet.has(normalizeParallelLocalizedScreenshotLocale(locale)));
    const foundSet = new Set(runLocales.map(locale => normalizeParallelLocalizedScreenshotLocale(locale)));
    skipped.push(...assignedLocales
      .filter(locale => !foundSet.has(locale))
      .map(locale => `${locale}: assigned locale has no localized screenshot files`));
  } else {
    const normalizedStartLocale = normalizeParallelLocalizedScreenshotLocale(options.startLocale || options.localizedScreenshotsStartLocale || "");
    if (normalizedStartLocale) {
      const startIndex = allLocales.findIndex(locale => normalizeParallelLocalizedScreenshotLocale(locale) === normalizedStartLocale);
      if (startIndex < 0) {
        return {
          ok: false,
          message: `start locale ${options.startLocale || options.localizedScreenshotsStartLocale} was not found in localized screenshot files`,
          locales: [],
          chunks: [],
          skipped,
          totalScreenshots: 0,
          workerCount: 0
        };
      }
      if (startIndex > 0) {
        skipped.push(`${startIndex} locale(s) before start locale ${options.startLocale || options.localizedScreenshotsStartLocale}`);
      }
      runLocales = allLocales.slice(startIndex);
    }
  }

  const normalizedRunLocales = runLocales.map(normalizeParallelLocalizedScreenshotLocale).filter(Boolean);
  const chunks = splitParallelLocalizedScreenshotLocales(normalizedRunLocales, options.workerCount);

  return {
    ok: true,
    locales: normalizedRunLocales,
    chunks,
    skipped,
    totalScreenshots: countParallelLocalizedScreenshotFiles(files, normalizedRunLocales),
    workerCount: chunks.length
  };
}

function filterLocalizedScreenshotFilesForAssignedLocales(files, assignedLocales) {
  const assignedSet = new Set(normalizeAssignedParallelLocales(assignedLocales));
  const localizedScreenshots = {};

  for (const [locale, localeFiles] of Object.entries(files && files.localizedScreenshots || {})) {
    if (!assignedSet.has(normalizeParallelLocalizedScreenshotLocale(locale))) continue;
    localizedScreenshots[locale] = Array.from(localeFiles || []);
  }

  return {
    storeIcon: null,
    screenshots: [],
    localizedScreenshots,
    smallPromo: null,
    marqueePromo: null
  };
}

function createParallelLocalizedScreenshotRunId() {
  return `localized-screenshots-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
