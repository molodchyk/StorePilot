const SETTINGS_KEY = "storePilotSettings";

const elements = {
  summary: document.getElementById("summary"),
  status: document.getElementById("status"),
  importFolder: document.getElementById("importFolder"),
  listingFiles: document.getElementById("listingFiles"),
  listingFolderFallback: document.getElementById("listingFolderFallback"),
  fillField: document.getElementById("fillField"),
  copyText: document.getElementById("copyText"),
  openOptions: document.getElementById("openOptions"),
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
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

async function importListings(files) {
  const result = await storePilotImportListingFiles(files);

  if (!result.total) {
    setStatus("No .txt files selected.", true);
    return;
  }

  await refreshSummary();
  setStatus(`Imported ${result.imported}; skipped ${result.skipped.length}.`, result.imported === 0);
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
      setStatus("No locale listing folder found.", true);
      return;
    }

    await refreshSummary();
    setStatus(`Imported ${result.imported} from ${result.sourcePath}.`, result.imported === 0);
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
  const listings = await storePilotGetListings();
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
  await refreshSummary();
})();
