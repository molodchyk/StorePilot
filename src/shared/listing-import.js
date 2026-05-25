const STOREPILOT_LISTING_STORAGE_KEY = "storePilotListings";
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
  const stored = await chrome.storage.local.get(STOREPILOT_LISTING_STORAGE_KEY);
  return stored[STOREPILOT_LISTING_STORAGE_KEY] || {};
}

async function storePilotSetListings(listings) {
  await chrome.storage.local.set({ [STOREPILOT_LISTING_STORAGE_KEY]: listings });
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
  const nextListings = { ...(await storePilotGetListings()) };
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

  await storePilotSetListings(nextListings);

  return {
    imported,
    skipped,
    total: textFiles.length,
    listings: nextListings
  };
}

async function storePilotImportListingDirectory(directoryHandle) {
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
  const result = await storePilotImportListingFiles(best.files);

  return {
    ...result,
    sourcePath: best.path,
    candidateCount: candidates.length,
    confidence: best.confidence,
    score: best.score
  };
}
