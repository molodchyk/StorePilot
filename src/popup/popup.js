const STORAGE_KEY = "storePilotListings";

const elements = {
  summary: document.getElementById("summary"),
  status: document.getElementById("status"),
  fillField: document.getElementById("fillField"),
  copyText: document.getElementById("copyText"),
  openOptions: document.getElementById("openOptions")
};

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
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const listings = stored[STORAGE_KEY] || {};
  const count = Object.keys(listings).length;
  elements.summary.textContent = count
    ? `${count} imported listing locales`
    : "No listing files imported yet";
}

elements.fillField.addEventListener("click", async () => {
  const result = await sendToActiveTab("storepilot-fill");
  elements.status.textContent = result.message || (result.ok ? "Filled." : "Could not fill.");
});

elements.copyText.addEventListener("click", async () => {
  const result = await sendToActiveTab("storepilot-copy");
  elements.status.textContent = result.message || (result.ok ? "Copied." : "Could not copy.");
});

elements.openOptions.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refreshSummary();
