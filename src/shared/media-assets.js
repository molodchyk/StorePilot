const STOREPILOT_MEDIA_ASSET_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png"
]);

const STOREPILOT_MEDIA_ASSET_TYPES = {
  storeIcon: {
    label: "store icon",
    maxCount: 1,
    dimensions: [{ width: 128, height: 128 }],
    allowAlpha: true
  },
  screenshots: {
    label: "screenshots",
    maxCount: 5,
    dimensions: [
      { width: 1280, height: 800 },
      { width: 640, height: 400 }
    ]
  },
  smallPromo: {
    label: "small promo tile",
    maxCount: 1,
    dimensions: [{ width: 440, height: 280 }]
  },
  marqueePromo: {
    label: "marquee promo tile",
    maxCount: 1,
    dimensions: [{ width: 1400, height: 560 }]
  }
};
const STOREPILOT_NON_UPLOAD_SCREENSHOT_FOLDERS = new Set([
  "copy",
  "copies",
  "source",
  "sources",
  "preview",
  "previews",
  "render-preview",
  "templates"
]);

function storePilotReadUint32(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function storePilotGetPngDimensions(bytes) {
  const isPng = bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[12] === 0x49 &&
    bytes[13] === 0x48 &&
    bytes[14] === 0x44 &&
    bytes[15] === 0x52;

  if (!isPng) return null;

  let hasTransparencyChunk = false;
  let offset = 33;
  while (offset + 8 < bytes.length) {
    const chunkLength = storePilotReadUint32(bytes, offset);
    const chunkType = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    if (chunkType === "tRNS") {
      hasTransparencyChunk = true;
      break;
    }
    if (chunkType === "IDAT") break;
    offset += 12 + chunkLength;
  }

  const colorType = bytes[25];

  return {
    width: storePilotReadUint32(bytes, 16),
    height: storePilotReadUint32(bytes, 20),
    hasAlpha: colorType === 4 || colorType === 6 || hasTransparencyChunk
  };
}

function storePilotGetJpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

    if (isStartOfFrame && offset + 8 < bytes.length) {
      return {
        height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        width: (bytes[offset + 7] << 8) + bytes[offset + 8],
        hasAlpha: false
      };
    }

    if (!length) break;
    offset += 2 + length;
  }

  return null;
}

async function storePilotGetImageDimensions(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return storePilotGetPngDimensions(bytes) || storePilotGetJpegDimensions(bytes);
}

function storePilotGetMediaAssetType(width, height) {
  return Object.entries(STOREPILOT_MEDIA_ASSET_TYPES).find(([, config]) => (
    config.dimensions.some(size => size.width === width && size.height === height)
  ))?.[0] || "";
}

function storePilotGetLocaleFromPathPart(value) {
  const normalized = typeof storePilotNormalizeLocaleCode === "function"
    ? storePilotNormalizeLocaleCode(value)
    : String(value || "").trim().replace(/-/g, "_");
  if (!normalized) return "";

  return storePilotGetLocaleFromFileName(`${normalized}.txt`) || "";
}

function storePilotGetLocalizedScreenshotLocale(pathParts) {
  const parts = Array.from(pathParts || []).map(part => String(part || ""));
  const lowerParts = parts.map(part => part.toLowerCase());
  const fileIndex = parts.length - 1;

  for (let index = 0; index < fileIndex - 1; index++) {
    if (!/^screenshots?$/.test(lowerParts[index])) continue;

    const folderName = lowerParts[index + 1];
    if (STOREPILOT_NON_UPLOAD_SCREENSHOT_FOLDERS.has(folderName)) return "";

    return storePilotGetLocaleFromPathPart(parts[index + 1]);
  }

  return "";
}

function storePilotIsDirectGlobalScreenshotPath(pathParts) {
  const parts = Array.from(pathParts || []).map(part => String(part || "").toLowerCase());
  const fileIndex = parts.length - 1;
  const screenshotIndex = parts.findIndex(part => /^screenshots?$/.test(part));
  return screenshotIndex >= 0 && screenshotIndex === fileIndex - 1;
}

function storePilotIsPotentialMediaAsset(fileName, size = 0) {
  const extension = storePilotGetFileExtension(fileName);
  return STOREPILOT_MEDIA_ASSET_EXTENSIONS.has(extension) && (!size || size <= 15 * 1024 * 1024);
}

function storePilotScoreMediaAsset(pathParts, type) {
  const names = pathParts.map(part => String(part || "").toLowerCase());
  const fileName = names[names.length - 1] || "";
  let score = 0;

  if (type === "storeIcon") {
    if (names.some(name => /^icons?$/.test(name))) score += 70;
    if (names.some(name => /^images?$/.test(name))) score += 20;
    if (names.some(name => /^(src|source|extension)$/.test(name))) score += 15;
    if (names.some(name => /^(dist|build|release|releases|artifacts?)$/.test(name))) score -= 45;
    if (/icon|logo|symbol/.test(fileName)) score += 45;
    if (/(^|[^0-9])128([^0-9]|$)/.test(fileName)) score += 35;
    if (/store|webstore|listing/.test(fileName)) score += 15;
    if (/favicon/.test(fileName)) score -= 35;
    return score;
  }

  if (names.some(name => /^store-assets?$/.test(name))) score += 35;
  if (names.some(name => /^assets?$/.test(name))) score += 20;
  if (names.some(name => /^store$/.test(name))) score += 20;
  if (names.some(name => /^(dist|build|release|releases|artifacts?)$/.test(name))) score -= 80;
  if (names.some(name => /^screenshots?$/.test(name))) score += type === "screenshots" ? 45 : -20;
  if (names.some(name => /^promo$/.test(name))) score += type === "screenshots" ? -10 : 45;
  if (names.some(name => /^icons?$/.test(name))) score -= 80;
  if (/screenshot|screen/.test(fileName)) score += type === "screenshots" ? 20 : -10;
  if (/small|tile|promo/.test(fileName)) score += type === "smallPromo" ? 35 : 8;
  if (/marquee|large|banner/.test(fileName)) score += type === "marqueePromo" ? 35 : 0;
  if (/^\d+[-_]/.test(fileName)) score += type === "screenshots" ? 12 : 0;

  return score;
}

function storePilotCreateMediaSummary(candidates) {
  const sorted = [...candidates].sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const screenshots = sorted
    .filter(asset => asset.type === "screenshots" && !asset.locale)
    .slice(0, STOREPILOT_MEDIA_ASSET_TYPES.screenshots.maxCount)
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));
  const storeIcon = sorted.find(asset => asset.type === "storeIcon") || null;
  const smallPromo = sorted.find(asset => asset.type === "smallPromo") || null;
  const marqueePromo = sorted.find(asset => asset.type === "marqueePromo") || null;
  const localizedScreenshots = storePilotCreateLocalizedScreenshotSummary(sorted);
  const localizedScreenshotStats = storePilotCalculateLocalizedScreenshotStats(localizedScreenshots);

  return {
    screenshots,
    localizedScreenshots,
    storeIcon,
    smallPromo,
    marqueePromo,
    candidateCounts: {
      storeIcon: candidates.filter(asset => asset.type === "storeIcon").length,
      screenshots: candidates.filter(asset => asset.type === "screenshots" && !asset.locale).length,
      localizedScreenshots: candidates.filter(asset => asset.type === "localizedScreenshots").length,
      smallPromo: candidates.filter(asset => asset.type === "smallPromo").length,
      marqueePromo: candidates.filter(asset => asset.type === "marqueePromo").length
    },
    localizedScreenshotStats,
    discoveredAt: storePilotFormatTimestamp()
  };
}

function storePilotCalculateLocalizedScreenshotStats(localizedScreenshots) {
  const groups = localizedScreenshots || {};
  const screenshotCount = Object.values(groups)
    .reduce((count, assets) => count + (assets || []).length, 0);
  const issueCount = Object.values(groups)
    .reduce((count, assets) => count + (assets || []).reduce((assetCount, asset) => assetCount + (asset.issues || []).length, 0), 0);

  return {
    localeCount: Object.keys(groups).length,
    screenshotCount,
    issueCount
  };
}

function storePilotCreateLocalizedScreenshotSummary(sortedCandidates) {
  const grouped = {};
  const localized = sortedCandidates
    .filter(asset => asset.type === "localizedScreenshots" && asset.locale)
    .sort((a, b) => (
      a.locale.localeCompare(b.locale) ||
      a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" })
    ));

  localized.forEach(asset => {
    grouped[asset.locale] = grouped[asset.locale] || [];
    grouped[asset.locale].push({ ...asset, issues: Array.from(asset.issues || []) });
  });

  const canonicalFiles = Object.values(grouped)
    .find(assets => assets.length > 0)
    ?.slice(0, STOREPILOT_MEDIA_ASSET_TYPES.screenshots.maxCount)
    .map(asset => asset.name) || [];

  Object.keys(grouped).forEach(locale => {
    const assets = grouped[locale]
      .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));
    const keptAssets = assets.slice(0, STOREPILOT_MEDIA_ASSET_TYPES.screenshots.maxCount);
    const extraAssets = assets.slice(STOREPILOT_MEDIA_ASSET_TYPES.screenshots.maxCount);
    const keptFileNames = keptAssets.map(asset => asset.name);
    const slotParityIssue = canonicalFiles.length &&
      (keptFileNames.length !== canonicalFiles.length ||
        keptFileNames.some((name, index) => name !== canonicalFiles[index]));

    if (extraAssets.length && keptAssets[keptAssets.length - 1]) {
      keptAssets[keptAssets.length - 1].issues = [
        ...(keptAssets[keptAssets.length - 1].issues || []),
        storePilotText("localizedScreenshotExtraFiles", "Extra localized screenshot file(s) ignored after the first five.")
      ];
    }

    if (slotParityIssue && keptAssets[0]) {
      keptAssets[0].issues = [
        ...(keptAssets[0].issues || []),
        storePilotText("localizedScreenshotSlotMismatch", "Screenshot filenames differ from the first localized screenshot set.")
      ];
    }

    grouped[locale] = keptAssets;
  });

  return grouped;
}

function storePilotFormatMediaSummary(mediaAssets) {
  if (!mediaAssets) return storePilotText("mediaAssetsNone", "No graphic assets found");
  const localizedStats = mediaAssets.localizedScreenshotStats || {};

  return storePilotText("mediaAssetsSummary", "$1 global screenshot(s), $2 localized screenshot locale(s), icon: $3, small promo: $4, marquee promo: $5", [
    String((mediaAssets.screenshots || []).length),
    String(localizedStats.localeCount || Object.keys(mediaAssets.localizedScreenshots || {}).length),
    mediaAssets.storeIcon ? storePilotText("yes", "yes") : storePilotText("no", "no"),
    mediaAssets.smallPromo ? storePilotText("yes", "yes") : storePilotText("no", "no"),
    mediaAssets.marqueePromo ? storePilotText("yes", "yes") : storePilotText("no", "no")
  ]);
}

function storePilotAddLocalizedScreenshotListingWarnings(mediaAssets, listings) {
  if (!mediaAssets || !mediaAssets.localizedScreenshots) return mediaAssets;

  const listingLocales = new Set(Object.keys(listings || {})
    .map(locale => typeof storePilotNormalizeLocaleCode === "function" ? storePilotNormalizeLocaleCode(locale) : String(locale || ""))
    .filter(Boolean));
  if (!listingLocales.size) return mediaAssets;

  const localizedScreenshots = Object.fromEntries(Object.entries(mediaAssets.localizedScreenshots || {}).map(([locale, assets]) => {
    const clonedAssets = (assets || []).map(asset => ({
      ...asset,
      issues: Array.from(asset.issues || [])
    }));
    const normalizedLocale = typeof storePilotNormalizeLocaleCode === "function" ? storePilotNormalizeLocaleCode(locale) : locale;
    const warning = storePilotText("localizedScreenshotMissingListing", "Localized screenshot folder has no matching imported listing text.");

    if (!listingLocales.has(normalizedLocale) && clonedAssets[0] && !clonedAssets[0].issues.includes(warning)) {
      clonedAssets[0].issues.push(warning);
    }

    return [locale, clonedAssets];
  }));

  return {
    ...mediaAssets,
    localizedScreenshots,
    localizedScreenshotStats: storePilotCalculateLocalizedScreenshotStats(localizedScreenshots)
  };
}

function storePilotCreateMediaAssetCandidate(pathParts, file, dimensions, type, patch = {}) {
  return {
    type,
    path: pathParts.join("/"),
    name: file.name,
    width: dimensions.width,
    height: dimensions.height,
    hasAlpha: dimensions.hasAlpha,
    size: file.size,
    lastModified: file.lastModified || 0,
    score: storePilotScoreMediaAsset(pathParts, type === "localizedScreenshots" ? "screenshots" : type),
    issues: dimensions.hasAlpha && type !== "storeIcon"
      ? [storePilotText("mediaAlphaNotAllowed", "PNG alpha channel is not allowed for this CWS asset.")]
      : [],
    ...patch
  };
}

async function storePilotDiscoverMediaAssetsFromDirectory(directoryHandle) {
  const candidates = [];

  async function walk(handle, pathParts) {
    for await (const entry of handle.values()) {
      const nextPathParts = [...pathParts, entry.name];

      if (entry.kind === "directory") {
        if (!storePilotShouldSkipDirectory(entry.name)) {
          await walk(entry, nextPathParts);
        }
        continue;
      }

      const file = await entry.getFile();
      if (!storePilotIsPotentialMediaAsset(file.name, file.size)) continue;

      const dimensions = await storePilotGetImageDimensions(file).catch(() => null);
      if (!dimensions) continue;

      const type = storePilotGetMediaAssetType(dimensions.width, dimensions.height);
      if (!type) continue;
      const localizedScreenshotLocale = type === "screenshots"
        ? storePilotGetLocalizedScreenshotLocale(nextPathParts)
        : "";
      if (type === "screenshots" && localizedScreenshotLocale) {
        candidates.push(storePilotCreateMediaAssetCandidate(nextPathParts, file, dimensions, "localizedScreenshots", {
          locale: localizedScreenshotLocale
        }));
        continue;
      }
      if (type === "screenshots" && !storePilotIsDirectGlobalScreenshotPath(nextPathParts)) continue;

      candidates.push(storePilotCreateMediaAssetCandidate(nextPathParts, file, dimensions, type));
    }
  }

  await walk(directoryHandle, [directoryHandle.name]);
  return storePilotCreateMediaSummary(candidates);
}

async function storePilotDiscoverMediaAssetsFromFileList(files) {
  const candidates = [];

  for (const file of Array.from(files)) {
    const pathParts = storePilotGetRelativePathParts(file);
    if (!pathParts.length || storePilotHasSkippedPathPart(pathParts.slice(0, -1))) continue;
    if (!storePilotIsPotentialMediaAsset(file.name, file.size)) continue;

    const dimensions = await storePilotGetImageDimensions(file).catch(() => null);
    if (!dimensions) continue;

    const type = storePilotGetMediaAssetType(dimensions.width, dimensions.height);
    if (!type) continue;
    const localizedScreenshotLocale = type === "screenshots"
      ? storePilotGetLocalizedScreenshotLocale(pathParts)
      : "";
    if (type === "screenshots" && localizedScreenshotLocale) {
      candidates.push(storePilotCreateMediaAssetCandidate(pathParts, file, dimensions, "localizedScreenshots", {
        locale: localizedScreenshotLocale
      }));
      continue;
    }
    if (type === "screenshots" && !storePilotIsDirectGlobalScreenshotPath(pathParts)) continue;

    candidates.push(storePilotCreateMediaAssetCandidate(pathParts, file, dimensions, type));
  }

  return storePilotCreateMediaSummary(candidates);
}
