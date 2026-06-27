function storePilotOpenHandleDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(STOREPILOT_HANDLE_DB_NAME, STOREPILOT_HANDLE_DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains(STOREPILOT_HANDLE_STORE_NAME)) {
        request.result.createObjectStore(STOREPILOT_HANDLE_STORE_NAME);
      }
      if (!request.result.objectStoreNames.contains(STOREPILOT_MEDIA_FILE_STORE_NAME)) {
        request.result.createObjectStore(STOREPILOT_MEDIA_FILE_STORE_NAME);
      }
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

function storePilotGetMediaAssetEntries(mediaAssets, kind = "") {
  if (!mediaAssets) return [];

  const entries = [];
  if ((!kind || kind === "storeIcon") && mediaAssets.storeIcon) {
    entries.push({ kind: "storeIcon", asset: mediaAssets.storeIcon });
  }
  if (!kind || kind === "screenshots") {
    (mediaAssets.screenshots || []).forEach(asset => entries.push({ kind: "screenshots", asset }));
  }
  if (!kind || kind === "localizedScreenshots") {
    Object.entries(mediaAssets.localizedScreenshots || {}).forEach(([locale, assets]) => {
      (assets || []).forEach(asset => entries.push({ kind: "localizedScreenshots", locale, asset }));
    });
  }
  if ((!kind || kind === "smallPromo") && mediaAssets.smallPromo) {
    entries.push({ kind: "smallPromo", asset: mediaAssets.smallPromo });
  }
  if ((!kind || kind === "marqueePromo") && mediaAssets.marqueePromo) {
    entries.push({ kind: "marqueePromo", asset: mediaAssets.marqueePromo });
  }

  return entries;
}

function storePilotNormalizeStoredMediaPath(path) {
  return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function storePilotCreateEmptyMediaFiles() {
  return {
    storeIcon: null,
    screenshots: [],
    localizedScreenshots: {},
    smallPromo: null,
    marqueePromo: null
  };
}

function storePilotAssignMediaFile(mediaFiles, kind, file, locale = "") {
  if (!file) return;
  if (kind === "screenshots") {
    mediaFiles.screenshots.push(file);
  } else if (kind === "localizedScreenshots" && locale) {
    mediaFiles.localizedScreenshots[locale] = mediaFiles.localizedScreenshots[locale] || [];
    mediaFiles.localizedScreenshots[locale].push(file);
  } else {
    mediaFiles[kind] = file;
  }
}

async function storePilotGetMediaFileFromDirectory(directoryHandle, storedPath) {
  const pathParts = storePilotNormalizeStoredMediaPath(storedPath)
    .split("/")
    .filter(Boolean);

  if (pathParts[0] === directoryHandle.name) {
    pathParts.shift();
  }

  if (!pathParts.length) {
    throw new Error(`Invalid media path: ${storedPath}`);
  }

  let handle = directoryHandle;
  for (const part of pathParts.slice(0, -1)) {
    handle = await handle.getDirectoryHandle(part);
  }

  return (await handle.getFileHandle(pathParts[pathParts.length - 1])).getFile();
}

async function storePilotWithMediaFileStore(mode, callback) {
  const db = await storePilotOpenHandleDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STOREPILOT_MEDIA_FILE_STORE_NAME, mode);
    const store = transaction.objectStore(STOREPILOT_MEDIA_FILE_STORE_NAME);
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

async function storePilotSaveProjectMediaFiles(projectId, mediaFiles) {
  await storePilotWithMediaFileStore("readwrite", store => store.put({
    ...mediaFiles,
    savedAt: storePilotFormatTimestamp()
  }, projectId));
}

async function storePilotGetProjectMediaFiles(projectId) {
  return storePilotWithMediaFileStore("readonly", store => store.get(projectId));
}

async function storePilotDeleteProjectMediaFiles(projectId) {
  await storePilotWithMediaFileStore("readwrite", store => store.delete(projectId));
}

async function storePilotClearStoredHandles() {
  const db = await storePilotOpenHandleDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([
      STOREPILOT_HANDLE_STORE_NAME,
      STOREPILOT_MEDIA_FILE_STORE_NAME
    ], "readwrite");

    transaction.objectStore(STOREPILOT_HANDLE_STORE_NAME).clear();
    transaction.objectStore(STOREPILOT_MEDIA_FILE_STORE_NAME).clear();

    transaction.addEventListener("complete", () => {
      db.close();
      resolve();
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

async function storePilotSaveProjectMediaFilesFromFileList(projectId, mediaAssets, files) {
  const entries = storePilotGetMediaAssetEntries(mediaAssets);
  if (!entries.length) return;

  const fileByPath = new Map(Array.from(files || []).map(file => [
    storePilotNormalizeStoredMediaPath(storePilotGetRelativePathParts(file).join("/")),
    file
  ]));
  const mediaFiles = storePilotCreateEmptyMediaFiles();

  for (const { kind, locale, asset } of entries) {
    storePilotAssignMediaFile(mediaFiles, kind, fileByPath.get(storePilotNormalizeStoredMediaPath(asset.path)), locale);
  }

  await storePilotSaveProjectMediaFiles(projectId, mediaFiles);
}

async function storePilotSaveProjectMediaFilesFromDirectory(projectId, mediaAssets, directoryHandle) {
  const entries = storePilotGetMediaAssetEntries(mediaAssets);
  if (!entries.length) return;

  const mediaFiles = storePilotCreateEmptyMediaFiles();

  for (const { kind, locale, asset } of entries) {
    const file = await storePilotGetMediaFileFromDirectory(directoryHandle, asset.path);
    storePilotAssignMediaFile(mediaFiles, kind, file, locale);
  }

  await storePilotSaveProjectMediaFiles(projectId, mediaFiles);
}

function storePilotFilterMediaFilesByKind(mediaFiles, kind = "") {
  const filtered = storePilotCreateEmptyMediaFiles();
  if (!mediaFiles) return filtered;

  if (!kind || kind === "screenshots") {
    filtered.screenshots = Array.from(mediaFiles.screenshots || []);
  }
  if (!kind || kind === "localizedScreenshots") {
    filtered.localizedScreenshots = Object.fromEntries(Object.entries(mediaFiles.localizedScreenshots || {}).map(([locale, files]) => [
      locale,
      Array.from(files || [])
    ]));
  }
  if (!kind || kind === "storeIcon") {
    filtered.storeIcon = mediaFiles.storeIcon || null;
  }
  if (!kind || kind === "smallPromo") {
    filtered.smallPromo = mediaFiles.smallPromo || null;
  }
  if (!kind || kind === "marqueePromo") {
    filtered.marqueePromo = mediaFiles.marqueePromo || null;
  }

  return filtered;
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
