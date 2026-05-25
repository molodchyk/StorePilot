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

function setStatus(message, isError = false) {
  elements.importStatus.textContent = message;
  elements.importStatus.classList.toggle("error", isError);
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
  const result = await storePilotImportListingFiles(files);

  if (!result.total) {
    setStatus("No .txt files were selected.", true);
    return;
  }

  renderListings(result.listings);
  setStatus(
    `Saw ${result.total} text file${result.total === 1 ? "" : "s"}; imported ${result.imported}; skipped ${result.skipped.length}.` +
      (result.skipped.length ? ` Skipped: ${result.skipped.slice(0, 5).join(", ")}${result.skipped.length > 5 ? "..." : ""}` : ""),
    result.imported === 0
  );
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
    const result = await storePilotImportListingDirectory(directoryHandle);

    if (!result.total) {
      setStatus("No locale listing folder was found in the selected folder.", true);
      return;
    }

    renderListings(result.listings);
    setStatus(
      `Imported ${result.imported} from ${result.sourcePath}; skipped ${result.skipped.length}.` +
        (result.candidateCount > 1 ? ` Found ${result.candidateCount} candidate folders.` : ""),
      result.imported === 0
    );
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
  await storePilotSetListings({});
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
  renderListings(await storePilotGetListings());
})();
