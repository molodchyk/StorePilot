const STORAGE_KEY = "storePilotListings";

const elements = {
  listingFiles: document.getElementById("listingFiles"),
  clearListings: document.getElementById("clearListings"),
  listingTable: document.getElementById("listingTable"),
  summary: document.getElementById("summary")
};

function getLocaleFromFile(file) {
  const name = file.name.replace(/\.txt$/i, "");

  if (!/^[a-z]{2,3}(?:_[A-Z0-9]{2,4})?$/.test(name)) {
    return null;
  }

  return name;
}

function readTextFile(file) {
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

  for (const file of textFiles) {
    const locale = getLocaleFromFile(file);
    if (!locale) continue;
    nextListings[locale] = await readTextFile(file);
  }

  await setListings(nextListings);
  renderListings(nextListings);
}

elements.listingFiles.addEventListener("change", event => {
  importListings(event.target.files).catch(error => {
    console.error(error);
    window.alert(`Import failed: ${error.message}`);
  });
  event.target.value = "";
});

elements.clearListings.addEventListener("click", async () => {
  if (!window.confirm("Clear all imported StorePilot listings?")) return;
  await setListings({});
  renderListings({});
});

getListings().then(renderListings);
