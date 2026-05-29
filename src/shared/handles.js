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
