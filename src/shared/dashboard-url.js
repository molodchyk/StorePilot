function storePilotIsDeveloperDashboardUrl(url = "") {
  return /^https:\/\/(chrome\.google\.com\/webstore\/devconsole|chromewebstore\.google\.com\/devconsole)\//.test(String(url || ""));
}

function storePilotGetDashboardSectionFromUrl(url = "") {
  try {
    const { pathname } = new URL(url);
    if (/\/edit\/privacy\/?$/.test(pathname)) return "privacy";
    if (/\/edit(?:\/listing)?\/?$/.test(pathname)) return "listing";
  } catch (_error) {
    // Unknown URLs are treated as non-dashboard sections by callers.
  }

  return "other";
}

function storePilotIsListingDashboardUrl(url = "") {
  return storePilotIsDeveloperDashboardUrl(url) && storePilotGetDashboardSectionFromUrl(url) === "listing";
}

function storePilotIsPrivacyDashboardUrl(url = "") {
  return storePilotIsDeveloperDashboardUrl(url) && storePilotGetDashboardSectionFromUrl(url) === "privacy";
}

function storePilotIsPanelDashboardUrl(url = "") {
  if (!storePilotIsDeveloperDashboardUrl(url)) return false;
  const section = storePilotGetDashboardSectionFromUrl(url);
  return section === "listing" || section === "privacy";
}

function storePilotNormalizeDashboardExtensionId(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-p]{32}$/.test(normalized) ? normalized : "";
}

function storePilotGetDashboardExtensionIdFromUrl(url = "") {
  try {
    const { pathname } = new URL(url);
    const parts = pathname.split("/").filter(Boolean);
    const consoleIndex = parts.findIndex(part => part === "devconsole");
    const candidate = consoleIndex >= 0 ? parts[consoleIndex + 2] : "";
    return storePilotNormalizeDashboardExtensionId(candidate);
  } catch (_error) {
    return "";
  }
}
