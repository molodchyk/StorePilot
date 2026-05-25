const STOREPILOT_LISTING_STORAGE_KEY = "storePilotListings";

function storePilotGetLocaleFromFileName(fileName) {
  const name = fileName.replace(/\.txt$/i, "");

  if (!/^[a-z]{2,3}(?:_[A-Z0-9]{2,4})?$/.test(name)) {
    return null;
  }

  return name;
}

function storePilotNormalizePath(parts) {
  return parts.join("/").toLowerCase();
}

function storePilotScoreDirectory(pathParts, files) {
  const path = storePilotNormalizePath(pathParts);
  const localeCount = files.filter(file => storePilotGetLocaleFromFileName(file.name)).length;

  if (!localeCount) return 0;

  let score = localeCount;

  if (path.endsWith("store-listing/chrome-web-store/listing")) score += 1000;
  if (path.endsWith("chrome-web-store/listing")) score += 700;
  if (path.endsWith("store-listing/firefox-add-ons/listing")) score += 500;
  if (path.endsWith("listing") || path.endsWith("listings")) score += 250;
  if (files.some(file => file.name === "en.txt")) score += 50;
  if (files.some(file => file.name === "de.txt")) score += 20;
  if (files.some(file => file.name === "uk.txt")) score += 20;

  return score;
}

async function storePilotCollectCandidateDirectories(directoryHandle) {
  const candidates = [];

  async function walk(handle, pathParts) {
    const textFiles = [];

    for await (const entry of handle.values()) {
      if (entry.kind === "directory") {
        await walk(entry, [...pathParts, entry.name]);
        continue;
      }

      if (!entry.name.toLowerCase().endsWith(".txt")) {
        continue;
      }

      const file = await entry.getFile();
      textFiles.push({
        name: entry.name,
        async text() {
          return file.text();
        }
      });
    }

    if (textFiles.length) {
      const score = storePilotScoreDirectory(pathParts, textFiles);
      if (score) {
        candidates.push({
          path: pathParts.join("/") || handle.name,
          score,
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
  const textFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith(".txt"));
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
    candidateCount: candidates.length
  };
}
