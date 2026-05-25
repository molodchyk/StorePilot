const STORAGE_KEY = "storePilotListings";
const SETTINGS_KEY = "storePilotSettings";

const elements = {
  importFolder: document.getElementById("importFolder"),
  listingFolderFallback: document.getElementById("listingFolderFallback"),
  listingFiles: document.getElementById("listingFiles"),
  clearListings: document.getElementById("clearListings"),
  listingTable: document.getElementById("listingTable"),
  summary: document.getElementById("summary"),
  importStatus: document.getElementById("importStatus"),
  dropZone: document.getElementById("dropZone"),
  themeChoices: Array.from(document.querySelectorAll("[data-theme-choice]"))
};

function applyTheme(theme) {
  const normalized = ["system", "light", "dark"].includes(theme) ? theme : "system";

  if (normalized === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = normalized;
  }

  elements.themeChoices.forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === normalized));
  });
}

async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return {
    theme: "system",
    ...(stored[SETTINGS_KEY] || {})
  };
}

async function updateSettings(patch) {
  const settings = {
    ...(await getSettings()),
    ...patch
  };

  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

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
  elements.importStatus.textContent = message;
  elements.importStatus.classList.toggle("error", isError);
}

function readTextFile(file) {
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

async function getListings() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return stored[STORAGE_KEY] || {};
}

async function setListings(listings) {
  await chrome.storage.local.set({ [STORAGE_KEY]: listings });
}

function renderListings(listings) {
  const locales = Object.keys(listings).sort((a, b) => a.localeCompare(b));
  elements.summary.textContent = locales.length
    ? `${locales.length} locale${locales.length === 1 ? "" : "s"} imported`
    : "No listings imported";

  if (!locales.length) {
    elements.listingTable.innerHTML = "";
    return;
  }

  elements.listingTable.replaceChildren(...locales.map(locale => {
    const text = listings[locale] || "";
    const row = document.createElement("div");
    const localeCell = document.createElement("div");
    const preview = document.createElement("div");
    const count = document.createElement("div");

    row.className = "listing-row";
    localeCell.className = "locale";
    preview.className = "preview";
    count.className = "count";

    localeCell.textContent = locale;
    preview.textContent = text.split(/\r?\n/).find(Boolean) || "(empty)";
    count.textContent = `${text.length.toLocaleString()} chars`;

    row.append(localeCell, preview, count);
    return row;
  }));
}

async function importListings(files) {
  const nextListings = { ...(await getListings()) };
  const textFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith(".txt"));
  const skipped = [];
  let imported = 0;

  if (!textFiles.length) {
    setStatus("No .txt files were selected.", true);
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
  renderListings(nextListings);
  setStatus(
    `Saw ${textFiles.length} text file${textFiles.length === 1 ? "" : "s"}; imported ${imported}; skipped ${skipped.length}.` +
      (skipped.length ? ` Skipped: ${skipped.slice(0, 5).join(", ")}${skipped.length > 5 ? "..." : ""}` : ""),
    imported === 0
  );
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
    const files = await collectTextFilesFromDirectory(directoryHandle);
    await importListings(files);
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("Folder import canceled.");
      return;
    }

    console.error(error);
    setStatus(`Folder import failed: ${error.message}`, true);
  }
}

function handleFileSelection(event) {
  importListings(event.target.files).catch(error => {
    console.error(error);
    setStatus(`Import failed: ${error.message}`, true);
  });
  event.target.value = "";
}

elements.importFolder.addEventListener("click", importFolder);
elements.listingFolderFallback.addEventListener("change", handleFileSelection);
elements.listingFiles.addEventListener("change", handleFileSelection);

elements.dropZone.addEventListener("dragover", event => {
  event.preventDefault();
  elements.dropZone.classList.add("dragging");
});

elements.dropZone.addEventListener("dragleave", () => {
  elements.dropZone.classList.remove("dragging");
});

elements.dropZone.addEventListener("drop", event => {
  event.preventDefault();
  elements.dropZone.classList.remove("dragging");

  importListings(event.dataTransfer.files).catch(error => {
    console.error(error);
    setStatus(`Import failed: ${error.message}`, true);
  });
});

elements.clearListings.addEventListener("click", async () => {
  if (!window.confirm("Clear all imported StorePilot listings?")) return;
  await setListings({});
  renderListings({});
});

elements.themeChoices.forEach(button => {
  button.addEventListener("click", async () => {
    const settings = await updateSettings({ theme: button.dataset.themeChoice });
    applyTheme(settings.theme);
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[SETTINGS_KEY]) return;
  applyTheme(changes[SETTINGS_KEY].newValue && changes[SETTINGS_KEY].newValue.theme);
});

(async () => {
  applyTheme((await getSettings()).theme);
  renderListings(await getListings());
})();
