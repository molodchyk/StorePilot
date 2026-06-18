const SETTINGS_KEY = "storePilotSettings";
var STOREPILOT_API = globalThis.browser;

function t(key, fallback, substitutions) {
  return storePilotText(key, fallback, substitutions);
}

const elements = {
  importFolder: document.getElementById("importFolder"),
  listingFolderFallback: document.getElementById("listingFolderFallback"),
  deleteProject: document.getElementById("deleteProject"),
  projectSelect: document.getElementById("projectSelect"),
  projectTable: document.getElementById("projectTable"),
  projectSummary: document.getElementById("projectSummary"),
  privacySummary: document.getElementById("privacySummary"),
  privacyTable: document.getElementById("privacyTable"),
  dataUsageSummary: document.getElementById("dataUsageSummary"),
  dataUsageTable: document.getElementById("dataUsageTable"),
  additionalFieldsSummary: document.getElementById("additionalFieldsSummary"),
  additionalFieldsTable: document.getElementById("additionalFieldsTable"),
  productDetailsCategoryTable: document.getElementById("productDetailsCategoryTable"),
  languageDiagnosticsTable: document.getElementById("languageDiagnosticsTable"),
  mediaSummary: document.getElementById("mediaSummary"),
  mediaTable: document.getElementById("mediaTable"),
  listingTable: document.getElementById("listingTable"),
  summary: document.getElementById("summary"),
  lastUpdatedStatus: document.getElementById("lastUpdatedStatus"),
  importStatus: document.getElementById("importStatus"),
  dropZone: document.getElementById("dropZone"),
  listingsCardValue: document.getElementById("listingsCardValue"),
  listingsCardMeta: document.getElementById("listingsCardMeta"),
  mediaCardValue: document.getElementById("mediaCardValue"),
  mediaCardMeta: document.getElementById("mediaCardMeta"),
  privacyCardValue: document.getElementById("privacyCardValue"),
  privacyCardMeta: document.getElementById("privacyCardMeta"),
  dataUsageCardValue: document.getElementById("dataUsageCardValue"),
  dataUsageCardMeta: document.getElementById("dataUsageCardMeta"),
  additionalFieldsCardValue: document.getElementById("additionalFieldsCardValue"),
  additionalFieldsCardMeta: document.getElementById("additionalFieldsCardMeta"),
  sourceCardValue: document.getElementById("sourceCardValue"),
  sourceCardMeta: document.getElementById("sourceCardMeta"),
  detailTabButtons: Array.from(document.querySelectorAll("[data-detail-tab]")),
  detailPanels: Array.from(document.querySelectorAll("[data-detail-panel]")),
  statusCards: Array.from(document.querySelectorAll("[data-detail-tab-target]")),
  themeChoices: Array.from(document.querySelectorAll("[data-theme-choice]")),
  showAdvancedFillActions: document.getElementById("showAdvancedFillActions")
};

let mediaPreviewUrls = [];
let mediaReviewOverlay = null;
let mediaReviewReturnFocus = null;

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
  const stored = await STOREPILOT_API.storage.local.get(SETTINGS_KEY);
  return {
    theme: "system",
    showAdvancedFillActions: false,
    ...(stored[SETTINGS_KEY] || {})
  };
}

async function updateSettings(patch) {
  const settings = {
    ...(await getSettings()),
    ...patch
  };

  await STOREPILOT_API.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

function applySettings(settings = {}) {
  const normalized = {
    theme: "system",
    showAdvancedFillActions: false,
    ...settings
  };

  applyTheme(normalized.theme);
  elements.showAdvancedFillActions.checked = Boolean(normalized.showAdvancedFillActions);
}

function setStatus(message, isError = false) {
  elements.importStatus.textContent = message;
  elements.importStatus.classList.toggle("error", isError);
}

function selectDetailTab(tabName) {
  elements.detailTabButtons.forEach(button => {
    button.setAttribute("aria-selected", String(button.dataset.detailTab === tabName));
  });
  elements.detailPanels.forEach(panel => {
    panel.hidden = panel.dataset.detailPanel !== tabName;
  });
  elements.statusCards.forEach(card => {
    card.setAttribute("aria-current", String(card.dataset.detailTabTarget === tabName));
  });
}

function formatConfidence(value) {
  if (value === "high") return t("confidenceHigh", "high");
  if (value === "medium") return t("confidenceMedium", "medium");
  if (value === "low") return t("confidenceLow", "low");
  return value || "";
}

function formatMediaSummary(projectOrResult) {
  return typeof storePilotFormatMediaSummary === "function"
    ? storePilotFormatMediaSummary(projectOrResult && projectOrResult.mediaAssets)
    : "";
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return t("unknown", "Unknown");
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMediaDimensions(asset) {
  if (!asset || !asset.width || !asset.height) return t("unknown", "Unknown");

  const assetType = asset.type && typeof STOREPILOT_MEDIA_ASSET_TYPES !== "undefined"
    ? STOREPILOT_MEDIA_ASSET_TYPES[asset.type]
    : null;
  const alphaLabel = asset.hasAlpha && assetType && !assetType.allowAlpha
    ? `, ${t("alphaChannel", "alpha")}`
    : "";

  return `${asset.width} x ${asset.height}${alphaLabel}`;
}

function formatFoundMissing(value) {
  return value ? t("yes", "yes") : t("no", "no");
}

function getProjectLocaleCount(project) {
  return project ? storePilotGetProjectLocaleCount(project) : 0;
}

function getDataUsageKeys() {
  return typeof STOREPILOT_PRIVACY_DATA_USAGE_KEYS !== "undefined"
    ? STOREPILOT_PRIVACY_DATA_USAGE_KEYS
    : [
      "data_usage.personally_identifiable_information",
      "data_usage.health_information",
      "data_usage.financial_payment_information",
      "data_usage.authentication_information",
      "data_usage.personal_communications",
      "data_usage.location",
      "data_usage.web_history",
      "data_usage.user_activity",
      "data_usage.website_content"
    ];
}

function getCertificationKeys() {
  return typeof STOREPILOT_PRIVACY_CERTIFICATION_KEYS !== "undefined"
    ? STOREPILOT_PRIVACY_CERTIFICATION_KEYS
    : [
      "certification.no_sell_or_transfer",
      "certification.no_unrelated_use",
      "certification.no_creditworthiness"
    ];
}

function getDataUsageFieldKeys(fields) {
  const expected = new Set([...getDataUsageKeys(), ...getCertificationKeys()]);
  return Object.keys(fields || {}).filter(key => expected.has(key));
}

function isDataUsageFieldKey(key) {
  return getDataUsageKeys().includes(key) || getCertificationKeys().includes(key);
}

function getPrivacyDocumentFieldKeys(fields) {
  const remoteCodeDecision = getRemoteCodeDisplayValue(fields && fields.remote_code);
  const includeRemoteCodeJustification = remoteCodeDecision === "yes";
  const keys = Object.keys(fields || {}).filter(key => (
    !isDataUsageFieldKey(key) &&
    key !== "remote_code" &&
    key !== "remote_code_justification"
  ));
  const permissionKeys = keys.filter(key => key.startsWith("permission.")).sort((a, b) => a.localeCompare(b));
  const preferredOrder = [
    "single_purpose",
    "host_permission"
  ];

  const remoteCodeOrder = [];
  if (Object.prototype.hasOwnProperty.call(fields || {}, "remote_code")) {
    remoteCodeOrder.push("remote_code");
  }
  if (includeRemoteCodeJustification) {
    remoteCodeOrder.push("remote_code_justification");
  }

  const ordered = preferredOrder.filter(key => keys.includes(key))
    .concat(permissionKeys)
    .concat(keys.filter(key => (
      !preferredOrder.includes(key) &&
      !permissionKeys.includes(key) &&
      key !== "privacy_policy_url"
    )).sort((a, b) => a.localeCompare(b)))
    .concat(remoteCodeOrder);

  if (keys.includes("privacy_policy_url")) ordered.push("privacy_policy_url");
  return ordered;
}

function getRemoteCodeDisplayValue(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (["yes", "true", "on", "1", "y"].includes(normalized)) return "yes";
  if (["no", "false", "off", "0", "n", "none", ""].includes(normalized)) return normalized ? "no" : "";

  const matchText = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_. -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const negative = (
    /does not (load|use|include|execute|eval|reference).*remote code/.test(matchText) ||
    /remote code.*(not used|not loaded|not included|not requested|none|no)/.test(matchText) ||
    /\bno remote code\b/.test(matchText) ||
    /remote scripts?.*(not used|not loaded|none|no)/.test(matchText) ||
    /all extension code.*packaged locally/.test(matchText) ||
    /code.*packaged locally/.test(matchText)
  );

  return negative ? "no" : "yes";
}

function formatPrivacyDocumentFieldValue(key, value) {
  if (key === "remote_code") return getRemoteCodeDisplayValue(value);
  return value;
}

function formatPrivacyDocumentFieldState(key, value) {
  if (key === "remote_code_justification" && !String(value || "").trim()) {
    return t("remoteCodeJustificationRequired", "Required when remote_code is yes");
  }

  return "";
}

function formatDataUsageKey(key) {
  const labels = {
    "data_usage.personally_identifiable_information": t("dataUsagePersonallyIdentifiableInformation", "Personally identifiable information"),
    "data_usage.health_information": t("dataUsageHealthInformation", "Health information"),
    "data_usage.financial_payment_information": t("dataUsageFinancialPaymentInformation", "Financial and payment information"),
    "data_usage.authentication_information": t("dataUsageAuthenticationInformation", "Authentication information"),
    "data_usage.personal_communications": t("dataUsagePersonalCommunications", "Personal communications"),
    "data_usage.location": t("dataUsageLocation", "Location"),
    "data_usage.web_history": t("dataUsageWebHistory", "Web history"),
    "data_usage.user_activity": t("dataUsageUserActivity", "User activity"),
    "data_usage.website_content": t("dataUsageWebsiteContent", "Website content"),
    "certification.no_sell_or_transfer": t("certificationNoSellOrTransfer", "Certification: no sale or transfer"),
    "certification.no_unrelated_use": t("certificationNoUnrelatedUse", "Certification: no unrelated use"),
    "certification.no_creditworthiness": t("certificationNoCreditworthiness", "Certification: no creditworthiness use")
  };

  return labels[key] || key;
}

function getBooleanDisplayValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["yes", "true", "on", "1", "y"].includes(normalized)) {
    return { kind: "yes", label: t("yes", "yes").replace(/^./, char => char.toUpperCase()) };
  }
  if (["no", "false", "off", "0", "n", "none"].includes(normalized)) {
    return { kind: "no", label: t("no", "no").replace(/^./, char => char.toUpperCase()) };
  }
  if (!normalized) {
    return { kind: "empty", label: t("notProvided", "Not provided") };
  }
  return null;
}

function updateStatusCards(projects, activeProject) {
  const locales = getProjectLocaleCount(activeProject);
  const mediaAssets = activeProject && activeProject.mediaAssets;
  const privacyDoc = activeProject && activeProject.privacyDoc;
  const categoryDoc = activeProject && activeProject.categoryDoc;
  const additionalFieldsDoc = activeProject && activeProject.additionalFieldsDoc;
  const privacyFields = privacyDoc && privacyDoc.file && privacyDoc.file.fields
    ? getPrivacyDocumentFieldKeys(privacyDoc.file.fields)
    : [];
  const dataUsageFields = privacyDoc && privacyDoc.file && privacyDoc.file.fields
    ? getDataUsageFieldKeys(privacyDoc.file.fields)
    : [];
  const additionalFields = additionalFieldsDoc && additionalFieldsDoc.file && additionalFieldsDoc.file.fields
    ? Object.keys(additionalFieldsDoc.file.fields)
    : [];

  elements.listingsCardValue.textContent = t("localesCount", "$1 locales", [String(locales)]);
  elements.listingsCardMeta.textContent = activeProject
    ? [
      t("projectLocalesImported", "$1: $2 locale(s) imported", [activeProject.name, String(locales)]),
      categoryDoc && categoryDoc.file ? t("categoryLabel", "Category: $1", [categoryDoc.file.categoryLabel || t("unknown", "Unknown")]) : ""
    ].filter(Boolean).join(" | ")
    : t("noActiveProject", "No active project");

  if (mediaAssets) {
    elements.mediaCardValue.textContent = t("screenshotsCardValue", "$1/5 screenshot(s)", [String((mediaAssets.screenshots || []).length)]);
    elements.mediaCardMeta.textContent = [
      `${t("storeIcon", "Store icon")}: ${formatFoundMissing(mediaAssets.storeIcon)}`,
      `${t("smallPromoTile", "Small promo tile")}: ${formatFoundMissing(mediaAssets.smallPromo)}`,
      `${t("marqueePromoTile", "Marquee promo tile")}: ${formatFoundMissing(mediaAssets.marqueePromo)}`
    ].join(" | ");
  } else {
    elements.mediaCardValue.textContent = t("mediaAssetsNotScanned", "Not scanned");
    elements.mediaCardMeta.textContent = t("reimportFolderToScanMediaAssets", "Re-import the project folder to scan graphic assets.");
  }

  if (privacyDoc && privacyDoc.file) {
    elements.privacyCardValue.textContent = t("privacyFieldsCardValue", "$1 field(s)", [String(privacyFields.length)]);
    elements.privacyCardMeta.textContent = privacyDoc.file.path;
  } else if (privacyDoc) {
    elements.privacyCardValue.textContent = t("privacyDocNoUsableFileShort", "No usable privacy document found.");
    elements.privacyCardMeta.textContent = t("privacyDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
      String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0),
      String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.matched || 0)
    ]);
  } else {
    elements.privacyCardValue.textContent = t("privacyDocNotScanned", "Not scanned");
    elements.privacyCardMeta.textContent = t("reimportFolderToScanPrivacyDoc", "Re-import the project folder to scan the privacy document.");
  }

  if (privacyDoc && privacyDoc.file) {
    elements.dataUsageCardValue.textContent = t("dataUsageFieldsCardValue", "$1 value(s)", [String(dataUsageFields.length)]);
    elements.dataUsageCardMeta.textContent = dataUsageFields.length
      ? privacyDoc.file.path
      : t("dataUsageNoValues", "No data usage values found.");
  } else if (privacyDoc) {
    elements.dataUsageCardValue.textContent = t("privacyDocNoUsableFileShort", "No usable privacy document found.");
    elements.dataUsageCardMeta.textContent = t("privacyDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
      String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0),
      String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.matched || 0)
    ]);
  } else {
    elements.dataUsageCardValue.textContent = t("privacyDocNotScanned", "Not scanned");
    elements.dataUsageCardMeta.textContent = t("reimportFolderToScanDataUsage", "Re-import the project folder to scan data usage disclosures.");
  }

  if (additionalFieldsDoc && additionalFieldsDoc.file) {
    elements.additionalFieldsCardValue.textContent = t("additionalFieldsCardValue", "$1 field(s)", [String(additionalFields.length)]);
    elements.additionalFieldsCardMeta.textContent = additionalFieldsDoc.file.path;
  } else if (additionalFieldsDoc) {
    elements.additionalFieldsCardValue.textContent = t("additionalFieldsDocNoUsableFileShort", "No usable additional fields document found.");
    elements.additionalFieldsCardMeta.textContent = t("additionalFieldsDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
      String(additionalFieldsDoc.candidateCounts && additionalFieldsDoc.candidateCounts.scanned || 0),
      String(additionalFieldsDoc.candidateCounts && additionalFieldsDoc.candidateCounts.matched || 0)
    ]);
  } else {
    elements.additionalFieldsCardValue.textContent = t("additionalFieldsDocNotScanned", "Not scanned");
    elements.additionalFieldsCardMeta.textContent = t("reimportFolderToScanAdditionalFieldsDoc", "Re-import the project folder to scan additional fields.");
  }

  elements.sourceCardValue.textContent = activeProject ? activeProject.name : t("noActiveProject", "No active project");
  elements.sourceCardMeta.textContent = activeProject
    ? [
      activeProject.sourcePath || t("noSourceFolder", "No source folder"),
      activeProject.confidence ? t("detectionConfidence", "Detection: $1 confidence", [formatConfidence(activeProject.confidence)]) : "",
      categoryDoc && categoryDoc.file ? formatCategoryDocSummary(activeProject) : "",
      additionalFieldsDoc && additionalFieldsDoc.file ? formatAdditionalFieldsDocSummary(activeProject) : "",
      t("projectCount", "$1 project(s)", [String(projects.length)])
    ].filter(Boolean).join(" | ")
    : t("importProjectFolder", "Import project/folder");
}

function revokeMediaPreviewUrls() {
  closeMediaReview({ restoreFocus: false });
  mediaPreviewUrls.forEach(url => URL.revokeObjectURL(url));
  mediaPreviewUrls = [];
}

function createMediaPreviewUrl(file) {
  if (!file) return "";
  const url = URL.createObjectURL(file);
  mediaPreviewUrls.push(url);
  return url;
}

function getFocusableMediaReviewElements() {
  if (!mediaReviewOverlay) return [];
  return Array.from(mediaReviewOverlay.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"))
    .filter(element => !element.disabled && element.offsetParent !== null);
}

function handleMediaReviewKeydown(event) {
  if (event.key === "Escape") {
    closeMediaReview();
    return;
  }

  if (event.key !== "Tab") return;

  const focusable = getFocusableMediaReviewElements();
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function closeMediaReview(options = {}) {
  if (!mediaReviewOverlay) return;

  const restoreFocus = options.restoreFocus !== false;
  mediaReviewOverlay.remove();
  mediaReviewOverlay = null;
  document.body.classList.remove("media-review-open");
  document.removeEventListener("keydown", handleMediaReviewKeydown);

  if (restoreFocus && mediaReviewReturnFocus && mediaReviewReturnFocus.isConnected) {
    mediaReviewReturnFocus.focus();
  }
  mediaReviewReturnFocus = null;
}

function openMediaReview({ previewUrl, typeLabel, asset, fileName }) {
  if (!previewUrl) return;

  closeMediaReview({ restoreFocus: false });
  mediaReviewReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const titleBlock = document.createElement("div");
  const title = document.createElement("h3");
  const meta = document.createElement("div");
  const closeButton = document.createElement("button");
  const imageFrame = document.createElement("div");
  const image = document.createElement("img");
  const path = document.createElement("div");
  const reviewPath = asset && asset.path ? asset.path : fileName || "";
  const metaParts = [
    asset && asset.width && asset.height ? formatMediaDimensions(asset) : "",
    asset && asset.size ? formatBytes(asset.size) : ""
  ].filter(Boolean);

  overlay.className = "media-review-overlay";
  dialog.className = "media-review-dialog";
  header.className = "media-review-header";
  titleBlock.className = "media-review-title";
  meta.className = "media-review-meta";
  closeButton.className = "media-review-close";
  imageFrame.className = "media-review-image-frame";
  path.className = "media-review-path";

  overlay.setAttribute("role", "presentation");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "mediaReviewTitle");
  title.id = "mediaReviewTitle";
  title.textContent = typeLabel;
  meta.textContent = metaParts.join(" | ");
  closeButton.type = "button";
  closeButton.textContent = t("closePreview", "Close preview");
  closeButton.addEventListener("click", () => closeMediaReview());
  image.src = previewUrl;
  image.alt = typeLabel;
  path.textContent = reviewPath;

  imageFrame.append(image);
  titleBlock.append(title, meta);
  header.append(titleBlock, closeButton);
  dialog.append(header, imageFrame, path);
  overlay.append(dialog);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeMediaReview();
  });

  mediaReviewOverlay = overlay;
  document.body.classList.add("media-review-open");
  document.addEventListener("keydown", handleMediaReviewKeydown);
  document.body.append(overlay);
  closeButton.focus();
}

function getStoredMediaFile(mediaFiles, kind, index = 0) {
  if (!mediaFiles) return null;
  if (kind === "screenshots") return (mediaFiles.screenshots || [])[index] || null;
  return mediaFiles[kind] || null;
}

function createMediaCard(typeLabel, asset, stateLabel = "", file = null) {
  const card = document.createElement("article");
  const header = document.createElement("div");
  const type = document.createElement("div");
  const dimensions = document.createElement("div");
  let thumb = document.createElement("div");
  const path = document.createElement("div");
  const size = document.createElement("div");
  const previewUrl = createMediaPreviewUrl(file);

  card.className = "media-card";
  header.className = "media-card-header";
  type.className = "media-type";
  dimensions.className = "media-dimensions";
  thumb.className = "media-thumb";
  path.className = "media-path";
  size.className = "count";

  type.textContent = typeLabel;
  dimensions.textContent = asset && asset.width && asset.height ? formatMediaDimensions(asset) : "";
  path.textContent = asset ? asset.path : stateLabel || t("missing", "Missing");
  size.textContent = asset && asset.size ? formatBytes(asset.size) : "";

  if (previewUrl) {
    thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "media-thumb media-thumb-button";
    thumb.setAttribute("aria-label", t("openMediaPreview", "Open preview for $1", [typeLabel]));
    thumb.addEventListener("click", () => openMediaReview({
      previewUrl,
      typeLabel,
      asset,
      fileName: file && file.name
    }));

    const image = document.createElement("img");
    image.src = previewUrl;
    image.alt = typeLabel;
    thumb.append(image);
  } else {
    thumb.textContent = asset ? t("previewUnavailable", "Preview unavailable") : stateLabel || t("missing", "Missing");
  }

  header.append(type, dimensions);
  card.append(header, thumb, path, size);
  return card;
}

function createPrivacyRow(typeLabel, value, stateLabel = "") {
  const row = document.createElement("div");
  const type = document.createElement("div");
  const preview = document.createElement("div");
  const count = document.createElement("div");
  const booleanValue = getBooleanDisplayValue(value);

  row.className = "privacy-row";
  type.className = "privacy-type";
  preview.className = "preview";
  count.className = "count";

  type.textContent = typeLabel;
  if (booleanValue && !stateLabel) {
    const chip = document.createElement("span");
    chip.className = `value-chip value-chip-${booleanValue.kind}`;
    chip.textContent = booleanValue.label;
    preview.replaceChildren(chip);
    count.textContent = "";
  } else {
    preview.textContent = value || stateLabel || t("missing", "Missing");
    count.textContent = value ? t("charCount", "$1 chars", [String(value.length)]) : "";
  }

  row.append(type, preview, count);
  return row;
}

function createAdditionalFieldsRow(typeLabel, value, stateLabel = "", countText = "", renderBoolean = false) {
  const row = document.createElement("div");
  const type = document.createElement("div");
  const preview = document.createElement("div");
  const count = document.createElement("div");
  const booleanValue = renderBoolean ? getBooleanDisplayValue(value) : null;

  row.className = "additional-fields-row";
  type.className = "privacy-type";
  preview.className = "preview";
  count.className = "count";

  type.textContent = typeLabel;
  if (booleanValue && !countText) {
    const chip = document.createElement("span");
    chip.className = `value-chip value-chip-${booleanValue.kind}`;
    chip.textContent = booleanValue.label;
    preview.replaceChildren(chip);
    count.textContent = "";
  } else {
    preview.textContent = value || stateLabel || t("missing", "Missing");
    count.textContent = countText || (value ? t("charCount", "$1 chars", [String(value.length)]) : "");
  }

  row.append(type, preview, count);
  return row;
}

function createCategoryRow(typeLabel, value, stateLabel = "", countText = "") {
  const row = document.createElement("div");
  const type = document.createElement("div");
  const preview = document.createElement("div");
  const count = document.createElement("div");

  row.className = "category-row";
  type.className = "privacy-type";
  preview.className = "preview";
  count.className = "count";

  type.textContent = typeLabel;
  preview.textContent = value || stateLabel || t("missing", "Missing");
  count.textContent = countText || (value ? t("charCount", "$1 chars", [String(value.length)]) : "");

  row.append(type, preview, count);
  return row;
}

function createLanguageDiagnosticRow(typeLabel, value, stateLabel = "", countText = "") {
  const row = document.createElement("div");
  const type = document.createElement("div");
  const preview = document.createElement("div");
  const count = document.createElement("div");

  row.className = "language-diagnostics-row";
  type.className = "privacy-type";
  preview.className = "preview";
  count.className = "count";

  type.textContent = typeLabel;
  preview.textContent = value || stateLabel || t("missing", "Missing");
  count.textContent = countText;

  row.append(type, preview, count);
  return row;
}

function formatPrivacyDocSummary(projectOrResult) {
  const privacyDoc = projectOrResult && projectOrResult.privacyDoc
    ? projectOrResult.privacyDoc
    : projectOrResult;

  if (!privacyDoc || !privacyDoc.file || !privacyDoc.file.fields) {
    return typeof storePilotFormatPrivacyDocSummary === "function"
      ? storePilotFormatPrivacyDocSummary(privacyDoc)
      : "";
  }

  return t("privacyDocSummary", "$1 field(s) in $2", [
    String(getPrivacyDocumentFieldKeys(privacyDoc.file.fields).length),
    privacyDoc.file.path
  ]);
}

function hasPrivacyDocFile(projectOrResult) {
  return Boolean(projectOrResult && projectOrResult.privacyDoc && projectOrResult.privacyDoc.file);
}

function formatAdditionalFieldsDocSummary(projectOrResult) {
  return typeof storePilotFormatAdditionalFieldsDocSummary === "function"
    ? storePilotFormatAdditionalFieldsDocSummary(projectOrResult && projectOrResult.additionalFieldsDoc)
    : "";
}

function hasAdditionalFieldsDocFile(projectOrResult) {
  return Boolean(projectOrResult && projectOrResult.additionalFieldsDoc && projectOrResult.additionalFieldsDoc.file);
}

function formatCategoryDocSummary(projectOrResult) {
  return typeof storePilotFormatCategoryDocSummary === "function"
    ? storePilotFormatCategoryDocSummary(projectOrResult && projectOrResult.categoryDoc)
    : "";
}

function hasCategoryDocFile(projectOrResult) {
  return Boolean(projectOrResult && projectOrResult.categoryDoc && projectOrResult.categoryDoc.file);
}

function formatAdditionalFieldKey(key) {
  if (key === "official_url") return t("officialUrl", "Official URL");
  if (key === "homepage_url") return t("homepageUrl", "Homepage URL");
  if (key === "support_url") return t("supportUrl", "Support URL");
  if (key === "mature_content") return t("matureContent", "Mature content");
  return key;
}

function renderAdditionalFieldsDoc(project) {
  const additionalFieldsDoc = project && project.additionalFieldsDoc;

  if (!project) {
    elements.additionalFieldsSummary.textContent = t("noActiveProject", "No active project");
    elements.additionalFieldsTable.innerHTML = "";
    return;
  }

  if (!additionalFieldsDoc) {
    elements.additionalFieldsSummary.textContent = t("additionalFieldsDocNotScanned", "Not scanned");
    elements.additionalFieldsTable.replaceChildren(createAdditionalFieldsRow(
      t("additionalFields", "Additional Fields"),
      "",
      t("reimportFolderToScanAdditionalFieldsDoc", "Re-import the project folder to scan additional fields.")
    ));
    return;
  }

  elements.additionalFieldsSummary.textContent = formatAdditionalFieldsDocSummary(project);

  if (!additionalFieldsDoc.file) {
    elements.additionalFieldsTable.replaceChildren(
      createAdditionalFieldsRow(t("status", "Status"), "", t("additionalFieldsDocNoUsableFileShort", "No usable additional fields document found.")),
      createAdditionalFieldsRow(
        t("additionalFieldsDocCandidateCounts", "Candidates"),
        t("additionalFieldsDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
          String(additionalFieldsDoc.candidateCounts && additionalFieldsDoc.candidateCounts.scanned || 0),
          String(additionalFieldsDoc.candidateCounts && additionalFieldsDoc.candidateCounts.matched || 0)
        ])
      )
    );
    return;
  }

  const fields = additionalFieldsDoc.file.fields || {};
  const preferredOrder = ["official_url", "homepage_url", "support_url", "mature_content"];
  const fieldKeys = preferredOrder.filter(key => Object.prototype.hasOwnProperty.call(fields, key))
    .concat(Object.keys(fields).filter(key => !preferredOrder.includes(key)));
  const rows = [
    createAdditionalFieldsRow(t("privacyDocFile", "File"), additionalFieldsDoc.file.path),
    ...fieldKeys.map(key => createAdditionalFieldsRow(
      formatAdditionalFieldKey(key),
      fields[key],
      t("emptyValue", "(empty)"),
      "",
      key === "mature_content"
    )),
    createAdditionalFieldsRow(
      t("additionalFieldsDocCandidateCounts", "Candidates"),
      t("additionalFieldsDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
        String(additionalFieldsDoc.candidateCounts && additionalFieldsDoc.candidateCounts.scanned || 0),
        String(additionalFieldsDoc.candidateCounts && additionalFieldsDoc.candidateCounts.matched || 0)
      ])
    )
  ];

  elements.additionalFieldsTable.replaceChildren(...rows);
}

function renderProductDetailsCategory(project) {
  const categoryDoc = project && project.categoryDoc;

  if (!project) {
    elements.productDetailsCategoryTable.innerHTML = "";
    return;
  }

  if (!categoryDoc) {
    elements.productDetailsCategoryTable.replaceChildren(createCategoryRow(
      t("storeCategory", "Store Category"),
      "",
      t("reimportFolderToScanCategoryDoc", "Re-import the project folder to scan the category document.")
    ));
    return;
  }

  if (!categoryDoc.file) {
    elements.productDetailsCategoryTable.replaceChildren(
      createCategoryRow(t("status", "Status"), "", t("categoryDocNoUsableFileShort", "No usable category document found.")),
      createCategoryRow(
        t("categoryDocCandidateCounts", "Candidates"),
        t("categoryDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
          String(categoryDoc.candidateCounts && categoryDoc.candidateCounts.scanned || 0),
          String(categoryDoc.candidateCounts && categoryDoc.candidateCounts.matched || 0)
        ])
      )
    );
    return;
  }

  const file = categoryDoc.file;
  const rows = [
    createCategoryRow(t("selectedCategory", "Selected category"), file.categoryLabel),
    createCategoryRow(t("categoryValue", "CWS data value"), file.categoryValue),
    createCategoryRow(t("categoryGroup", "Category group"), file.categoryGroup),
    createCategoryRow(t("privacyDocFile", "File"), file.path, "", formatBytes(file.size)),
    file.reason ? createCategoryRow(t("categoryReason", "Reason"), file.reason) : null,
    createCategoryRow(
      t("categoryDocCandidateCounts", "Candidates"),
      t("categoryDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
        String(categoryDoc.candidateCounts && categoryDoc.candidateCounts.scanned || 0),
        String(categoryDoc.candidateCounts && categoryDoc.candidateCounts.matched || 0)
      ])
    )
  ].filter(Boolean);

  elements.productDetailsCategoryTable.replaceChildren(...rows);
}

function renderPrivacyDoc(project) {
  const privacyDoc = project && project.privacyDoc;

  if (!project) {
    elements.privacySummary.textContent = t("noActiveProject", "No active project");
    elements.privacyTable.innerHTML = "";
    return;
  }

  if (!privacyDoc) {
    elements.privacySummary.textContent = t("privacyDocNotScanned", "Not scanned");
    elements.privacyTable.replaceChildren(createPrivacyRow(
      t("privacyDocument", "Privacy Document"),
      "",
      project.hasFolderHandle
        ? t("reimportFolderToScanPrivacyDoc", "Re-import the project folder to scan the privacy document.")
        : t("reimportFolderToScanPrivacyDoc", "Re-import the project folder to scan the privacy document.")
    ));
    return;
  }

  elements.privacySummary.textContent = formatPrivacyDocSummary(project);

  if (!privacyDoc.file) {
    elements.privacyTable.replaceChildren(
      createPrivacyRow(t("status", "Status"), "", t("privacyDocNoUsableFileShort", "No usable privacy document found.")),
      createPrivacyRow(
        t("privacyDocCandidateCounts", "Candidates"),
        t("privacyDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
          String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0),
          String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.matched || 0)
        ])
      )
    );
    return;
  }

  const fields = privacyDoc.file.fields || {};
  const fieldKeys = getPrivacyDocumentFieldKeys(fields);
  const rows = [
    createPrivacyRow(t("privacyDocFile", "File"), privacyDoc.file.path),
    ...fieldKeys.map(key => createPrivacyRow(
      key,
      formatPrivacyDocumentFieldValue(key, fields[key]),
      formatPrivacyDocumentFieldState(key, fields[key])
    )),
    createPrivacyRow(
      t("privacyDocCandidateCounts", "Candidates"),
      t("privacyDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
        String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0),
        String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.matched || 0)
      ])
    )
  ];

  elements.privacyTable.replaceChildren(...rows);
}

function renderDataUsageDoc(project) {
  const privacyDoc = project && project.privacyDoc;

  if (!project) {
    elements.dataUsageSummary.textContent = t("noActiveProject", "No active project");
    elements.dataUsageTable.innerHTML = "";
    return;
  }

  if (!privacyDoc) {
    elements.dataUsageSummary.textContent = t("privacyDocNotScanned", "Not scanned");
    elements.dataUsageTable.replaceChildren(createPrivacyRow(
      t("dataUsage", "Data Usage"),
      "",
      t("reimportFolderToScanDataUsage", "Re-import the project folder to scan data usage disclosures.")
    ));
    return;
  }

  if (!privacyDoc.file) {
    elements.dataUsageSummary.textContent = t("privacyDocNoUsableFileShort", "No usable privacy document found.");
    elements.dataUsageTable.replaceChildren(
      createPrivacyRow(t("status", "Status"), "", t("privacyDocNoUsableFileShort", "No usable privacy document found.")),
      createPrivacyRow(
        t("privacyDocCandidateCounts", "Candidates"),
        t("privacyDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
          String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0),
          String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.matched || 0)
        ])
      )
    );
    return;
  }

  const fields = privacyDoc.file.fields || {};
  const dataKeys = getDataUsageKeys();
  const certificationKeys = getCertificationKeys();
  const foundKeys = getDataUsageFieldKeys(fields);
  elements.dataUsageSummary.textContent = foundKeys.length
    ? t("dataUsageSummary", "$1 value(s) in $2", [String(foundKeys.length), privacyDoc.file.path])
    : t("dataUsageNoValues", "No data usage values found.");

  const rows = [
    createPrivacyRow(t("privacyDocFile", "File"), privacyDoc.file.path),
    ...dataKeys.map(key => createPrivacyRow(formatDataUsageKey(key), fields[key] || "")),
    ...certificationKeys.map(key => createPrivacyRow(formatDataUsageKey(key), fields[key] || "")),
    createPrivacyRow(
      t("privacyDocCandidateCounts", "Candidates"),
      t("privacyDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
        String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0),
        String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.matched || 0)
      ])
    )
  ];

  elements.dataUsageTable.replaceChildren(...rows);
}

async function renderMediaAssets(project) {
  const mediaAssets = project && project.mediaAssets;
  revokeMediaPreviewUrls();

  if (!project) {
    elements.mediaSummary.textContent = t("noActiveProject", "No active project");
    elements.mediaTable.innerHTML = "";
    return;
  }

  if (!mediaAssets) {
    elements.mediaSummary.textContent = t("mediaAssetsNotScanned", "Not scanned");
    elements.mediaTable.replaceChildren(createMediaCard(
      t("storeMediaAssets", "Graphic assets"),
      null,
      project.hasFolderHandle
        ? t("reimportFolderToScanMediaAssets", "Re-import the project folder to scan graphic assets.")
        : t("reimportFolderToScanMediaAssets", "Re-import the project folder to scan graphic assets.")
    ));
    return;
  }

  const screenshots = mediaAssets.screenshots || [];
  const mediaFiles = project && project.id && typeof storePilotGetProjectMediaFiles === "function"
    ? await storePilotGetProjectMediaFiles(project.id).catch(() => null)
    : null;
  elements.mediaSummary.textContent = formatMediaSummary(project);

  elements.mediaTable.replaceChildren(
    createMediaCard(
      t("storeIcon", "Store icon"),
      mediaAssets.storeIcon,
      "",
      getStoredMediaFile(mediaFiles, "storeIcon")
    ),
    ...(screenshots.length ? screenshots.map((asset, index) => createMediaCard(
      t("screenshotNumber", "Screenshot $1", [String(index + 1)]),
      asset,
      "",
      getStoredMediaFile(mediaFiles, "screenshots", index)
    )) : [createMediaCard(t("screenshots", "Screenshots"), null)]),
    createMediaCard(
      t("smallPromoTile", "Small promo tile"),
      mediaAssets.smallPromo,
      "",
      getStoredMediaFile(mediaFiles, "smallPromo")
    ),
    createMediaCard(
      t("marqueePromoTile", "Marquee promo tile"),
      mediaAssets.marqueePromo,
      "",
      getStoredMediaFile(mediaFiles, "marqueePromo")
    ),
    createMediaCard(
      t("mediaCandidateCounts", "Candidates"),
      {
        path: t("mediaCandidateCountsValue", "Icon: $1; screenshots: $2; small promo: $3; marquee promo: $4.", [
          String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.storeIcon || 0),
          String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.screenshots || 0),
          String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.smallPromo || 0),
          String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.marqueePromo || 0)
        ]),
        width: "",
        height: "",
        size: 0
      }
    )
  );
}

function renderProjectSelect(projects, activeProjectId) {
  const activeProject = projects.find(project => project.id === activeProjectId) || null;
  elements.projectSelect.replaceChildren(...storePilotSortProjects(projects).map(project => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    option.selected = project.id === activeProjectId;
    return option;
  }));

  elements.projectSelect.disabled = !projects.length;
  elements.deleteProject.disabled = !projects.length;
}

function renderListings(project) {
  const listings = project && project.listings ? project.listings : {};
  const locales = Object.keys(listings).sort((a, b) => a.localeCompare(b));
  elements.lastUpdatedStatus.textContent = project
    ? t("lastUpdatedOn", "Last updated on $1.", [storePilotFormatDisplayTimestamp(project.lastSyncedAt)])
    : t("lastUpdatedOn", "Last updated on $1.", [t("never", "Never")]);
  elements.summary.textContent = project
    ? t("projectLocalesImported", "$1: $2 locale(s) imported", [project.name, String(locales.length)])
    : t("noActiveProject", "No active project");

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
    preview.textContent = text.split(/\r?\n/).find(Boolean) || t("emptyValue", "(empty)");
    count.textContent = t("charCount", "$1 chars", [text.length.toLocaleString()]);

    row.append(localeCell, preview, count);
    return row;
  }));
}

function renderLanguageDiagnostics(project) {
  const listings = project && project.listings ? project.listings : {};
  const locales = Object.keys(listings).sort((a, b) => a.localeCompare(b));

  if (!project) {
    elements.languageDiagnosticsTable.innerHTML = "";
    return;
  }

  if (!locales.length) {
    elements.languageDiagnosticsTable.replaceChildren(createLanguageDiagnosticRow(
      t("languageMatching", "Language matching"),
      "",
      t("noListingsImported", "No listings imported")
    ));
    return;
  }

  const pickerMode = locales.length === 1
    ? t("languagePickerOneLanguageMode", "One-language CWS listing")
    : t("languagePickerMultiLocaleMode", "Multi-locale CWS listing");
  const pickerTarget = locales.length === 1
    ? t("languagePickerOneLanguageTarget", "Product details Language picker below Category; select $1 before filling.", [locales[0]])
    : t("languagePickerMultiLocaleTarget", "Current editing language picker at the top; fill each matched CWS locale.");
  elements.languageDiagnosticsTable.replaceChildren(
    createLanguageDiagnosticRow(t("languagePickerMode", "CWS picker mode"), pickerMode),
    createLanguageDiagnosticRow(t("languagePickerTarget", "StorePilot target"), pickerTarget),
    createLanguageDiagnosticRow(
      t("languageMatchingSummary", "Matching summary"),
      t("languageMatchingSummaryValue", "$1 imported locale(s). CWS availability is checked from the dashboard language menu during Fill languages.", [
        String(locales.length)
      ])
    )
  );
}

function renderProjectTable(projects, activeProjectId) {
  elements.projectSummary.textContent = projects.length
    ? t("projectCount", "$1 project(s)", [String(projects.length)])
    : t("noProjects", "No projects");

  if (!projects.length) {
    elements.projectTable.innerHTML = "";
    return;
  }

  elements.projectTable.replaceChildren(...storePilotSortProjects(projects).map(project => {
    const row = document.createElement("button");
    const name = document.createElement("div");
    const details = document.createElement("div");
    const count = document.createElement("div");

    row.className = "project-row";
    row.type = "button";
    row.dataset.projectId = project.id;
    row.setAttribute("aria-pressed", String(project.id === activeProjectId));
    name.className = "project-name";
    details.className = "preview";
    count.className = "count";

    name.textContent = project.name;
    details.textContent = [
      project.id === activeProjectId ? t("selectedProject", "Selected project") : "",
      t("sourceLabel", "Source: $1", [project.sourcePath || t("noSourceFolder", "No source folder")]),
      project.confidence ? t("detectionConfidence", "Detection: $1 confidence", [formatConfidence(project.confidence)]) : "",
      hasCategoryDocFile(project) ? formatCategoryDocSummary(project) : "",
      hasAdditionalFieldsDocFile(project) ? formatAdditionalFieldsDocSummary(project) : "",
      hasPrivacyDocFile(project) ? formatPrivacyDocSummary(project) : "",
      project.mediaAssets ? formatMediaSummary(project) : "",
      t("refreshReimportFolder", "Refresh: re-import folder"),
      t("updatedLabel", "Updated: $1", [storePilotFormatDisplayTimestamp(project.lastSyncedAt)])
    ].filter(Boolean).join(" | ");
    count.textContent = t("localesCount", "$1 locales", [String(storePilotGetProjectLocaleCount(project))]);

    row.append(name, details, count);
    return row;
  }));
}

async function renderAll() {
  const { projects, activeProjectId } = await storePilotGetProjectsState();
  const activeProject = projects.find(project => project.id === activeProjectId) || projects[0] || null;

  renderProjectSelect(projects, activeProject && activeProject.id);
  updateStatusCards(projects, activeProject);
  renderPrivacyDoc(activeProject);
  renderDataUsageDoc(activeProject);
  renderAdditionalFieldsDoc(activeProject);
  renderProductDetailsCategory(activeProject);
  await renderMediaAssets(activeProject);
  renderListings(activeProject);
  renderLanguageDiagnostics(activeProject);
  renderProjectTable(projects, activeProject && activeProject.id);
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
      setStatus(t("noLocaleListingFolderFound", "No locale listing folder was found in the selected folder."), true);
      return;
    }

    await renderAll();
    setStatus(
      t("importedIntoFrom", "Imported $1 into $2 from $3 ($4 confidence); skipped $5.", [String(result.imported), result.project.name, result.sourcePath, formatConfidence(result.confidence), String(result.skipped.length)]) +
      (result.candidateCount > 1 ? ` ${t("foundCandidateFolders", "Found $1 candidate folders.", [String(result.candidateCount)])}` : "") +
        (hasPrivacyDocFile(result) ? ` ${formatPrivacyDocSummary(result)}` : "") +
        (hasCategoryDocFile(result) ? ` ${formatCategoryDocSummary(result)}` : "") +
        (hasAdditionalFieldsDocFile(result) ? ` ${formatAdditionalFieldsDocSummary(result)}` : "") +
        (result.mediaAssets ? ` ${formatMediaSummary(result)}` : ""),
      result.imported === 0
    );
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus(t("folderImportCanceled", "Folder import canceled."));
      return;
    }

    console.error(error);
    setStatus(t("folderImportFailed", "Folder import failed: $1", [error.message]), true);
  }
}

async function importFolderFileList(files) {
  const result = await storePilotImportListingFileList(files);

  if (!result.total) {
    setStatus(t("noLocaleListingFolderFound", "No locale listing folder was found in the selected folder."), true);
    return;
  }

  await renderAll();
  setStatus(
    t("importedIntoFrom", "Imported $1 into $2 from $3 ($4 confidence); skipped $5.", [String(result.imported), result.project.name, result.sourcePath || t("selectedFiles", "selected files"), formatConfidence(result.confidence) || t("manual", "manual"), String(result.skipped.length)]) +
      (result.candidateCount > 1 ? ` ${t("foundCandidateFolders", "Found $1 candidate folders.", [String(result.candidateCount)])}` : "") +
      (hasPrivacyDocFile(result) ? ` ${formatPrivacyDocSummary(result)}` : "") +
      (hasCategoryDocFile(result) ? ` ${formatCategoryDocSummary(result)}` : "") +
      (hasAdditionalFieldsDocFile(result) ? ` ${formatAdditionalFieldsDocSummary(result)}` : "") +
      (result.mediaAssets ? ` ${formatMediaSummary(result)}` : ""),
    result.imported === 0
  );
}

function handleFileSelection(event) {
  importFolderFileList(event.target.files).catch(error => {
    console.error(error);
    setStatus(t("importFailed", "Import failed: $1", [error.message]), true);
  });
  event.target.value = "";
}

elements.importFolder.addEventListener("click", importFolder);
elements.listingFolderFallback.addEventListener("change", handleFileSelection);

elements.detailTabButtons.forEach(button => {
  button.addEventListener("click", () => {
    selectDetailTab(button.dataset.detailTab);
  });
});

elements.statusCards.forEach(card => {
  card.addEventListener("click", () => {
    selectDetailTab(card.dataset.detailTabTarget);
  });
});

elements.projectSelect.addEventListener("change", async event => {
  await storePilotSetActiveProject(event.target.value);
  await renderAll();
});

elements.projectTable.addEventListener("click", async event => {
  const row = event.target.closest("[data-project-id]");
  if (!row) return;

  await storePilotSetActiveProject(row.dataset.projectId);
  await renderAll();
});

elements.deleteProject.addEventListener("click", async () => {
  const project = await storePilotGetActiveProject();
  if (!project || !window.confirm(t("deleteProjectConfirm", "Delete StorePilot project \"$1\"?", [project.name]))) return;

  await storePilotDeleteProject(project.id);
  await renderAll();
  setStatus(t("deletedProject", "Deleted $1.", [project.name]));
});

elements.themeChoices.forEach(button => {
  button.addEventListener("click", async () => {
    const settings = await updateSettings({ theme: button.dataset.themeChoice });
    applySettings(settings);
  });
});

elements.showAdvancedFillActions.addEventListener("change", async event => {
  const settings = await updateSettings({ showAdvancedFillActions: event.target.checked });
  applySettings(settings);
});

STOREPILOT_API.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes[SETTINGS_KEY]) {
    applySettings(changes[SETTINGS_KEY].newValue);
  }

  if (changes[STOREPILOT_PROJECTS_STORAGE_KEY] || changes[STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY]) {
    renderAll();
  }
});

(async () => {
  storePilotApplyI18n();
  applySettings(await getSettings());
  selectDetailTab("locales");
  await renderAll();
})();
