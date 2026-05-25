const STORAGE_KEY = "storePilotListings";

const elements = {
  summary: document.getElementById("summary"),
  status: document.getElementById("status"),
  importFolder: document.getElementById("importFolder"),
  listingFiles: document.getElementById("listingFiles"),
  listingFolderFallback: document.getElementById("listingFolderFallback"),
  fillField: document.getElementById("fillField"),
  copyText: document.getElementById("copyText"),
  openOptions: document.getElementById("openOptions")
};

function getLocaleFromFile(file) {
  const name = file.name.replace(/\.txt$/i, "");

  if (!/^[a-z]{2,3}(?:_[A-Z0-9]{2,4})?$/.test(name)) {
    return null;
  }

  return name;
}

function createFileLike(name, text) {
  return {
    name,
    async text() {
      return text;
    }
  };
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

async function getListings() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return stored[STORAGE_KEY] || {};
}

async function setListings(listings) {
  await chrome.storage.local.set({ [STORAGE_KEY]: listings });
}

async function readTextFile(file) {
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

async function importListings(files) {
  const nextListings = { ...(await getListings()) };
  const textFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith(".txt"));
  const skipped = [];
  let imported = 0;

  if (!textFiles.length) {
    setStatus("No .txt files selected.", true);
    return;
  }

  for (const file of textFiles) {
    const locale = getLocaleFromFile(file);
    if (!locale) {
      skipped.push(file.name);
      continue;
    }

    nextListings[locale] = await readTextFile(file);
    imported++;
  }

  await setListings(nextListings);
  await refreshSummary();
  setStatus(`Imported ${imported}; skipped ${skipped.length}.`, imported === 0);
}

async function collectTextFilesFromDirectory(directoryHandle) {
  const files = [];

  async function walk(handle) {
    for await (const entry of handle.values()) {
      if (entry.kind === "directory") {
        await walk(entry);
        continue;
      }

      if (!entry.name.toLowerCase().endsWith(".txt")) {
        continue;
      }

      const file = await entry.getFile();
      files.push(createFileLike(entry.name, await file.text()));
    }
  }

  await walk(directoryHandle);
  return files;
}

async function importFolder() {
  if (!window.showDirectoryPicker) {
    elements.listingFolderFallback.click();
    return;
  }

  try {
    const directoryHandle = await window.showDirectoryPicker({
      id: "storepilot-listing-folder",
      mode: "read"
    });
    await importListings(await collectTextFilesFromDirectory(directoryHandle));
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("Folder import canceled.");
      return;
    }

    console.error(error);
    setStatus(`Import failed: ${error.message}`, true);
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToActiveTab(type) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    return { ok: false, message: "No active tab." };
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, { type });
  } catch (_error) {
    return {
      ok: false,
      message: "Open a Chrome Web Store Developer Dashboard page first."
    };
  }
}

async function refreshSummary() {
  const listings = await getListings();
  const count = Object.keys(listings).length;
  elements.summary.textContent = count
    ? `${count} imported listing locales`
    : "No listing files imported yet";
}

function handleFileSelection(event) {
  importListings(event.target.files).catch(error => {
    console.error(error);
    setStatus(`Import failed: ${error.message}`, true);
  });
  event.target.value = "";
}

elements.importFolder.addEventListener("click", importFolder);
elements.listingFiles.addEventListener("change", handleFileSelection);
elements.listingFolderFallback.addEventListener("change", handleFileSelection);

elements.fillField.addEventListener("click", async () => {
  const result = await sendToActiveTab("storepilot-fill");
  setStatus(result.message || (result.ok ? "Filled." : "Could not fill."), !result.ok);
});

elements.copyText.addEventListener("click", async () => {
  const result = await sendToActiveTab("storepilot-copy");
  setStatus(result.message || (result.ok ? "Copied." : "Could not copy."), !result.ok);
});

elements.openOptions.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refreshSummary();
