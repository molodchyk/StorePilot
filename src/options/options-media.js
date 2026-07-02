let mediaPreviewUrls = [];
let mediaReviewOverlay = null;
let mediaReviewReturnFocus = null;
let mediaReviewItems = [];
let mediaReviewCurrentIndex = -1;
let mediaReviewElements = null;
let mediaReviewPreviewOrder = "locale";

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
    ? STOREPILOT_MEDIA_ASSET_TYPES[asset.type === "localizedScreenshots" ? "screenshots" : asset.type]
    : null;
  const alphaLabel = asset.hasAlpha && assetType && !assetType.allowAlpha
    ? `, ${t("alphaChannel", "alpha")}`
    : "";

  return `${asset.width} x ${asset.height}${alphaLabel}`;
}

function revokeMediaPreviewUrls() {
  closeMediaReview({ restoreFocus: false });
  mediaPreviewUrls.forEach(url => URL.revokeObjectURL(url));
  mediaPreviewUrls = [];
  mediaReviewItems = [];
  mediaReviewCurrentIndex = -1;
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

function getMediaReviewMetaParts(item, positionLabel = "") {
  const asset = item && item.asset;
  return [
    positionLabel,
    item && item.locale ? item.locale : "",
    item && Number.isFinite(item.slotIndex) ? t("screenshotNumber", "Screenshot $1", [String(item.slotIndex + 1)]) : "",
    asset && asset.width && asset.height ? formatMediaDimensions(asset) : "",
    asset && asset.size ? formatBytes(asset.size) : ""
  ].filter(Boolean);
}

function getMediaReviewPath(item) {
  if (!item) return "";
  return item.asset && item.asset.path ? item.asset.path : item.fileName || "";
}

function registerMediaReviewItem(item) {
  const reviewItem = {
    ...item,
    registrationIndex: mediaReviewItems.length
  };
  mediaReviewItems.push(reviewItem);
  return reviewItem;
}

function isLocalizedMediaReviewItem(item) {
  return item && item.kind === "localizedScreenshots";
}

function getOrderedMediaReviewItemsForMode(items, previewOrder = "locale", anchorItem = null) {
  const anchorIsLocalized = isLocalizedMediaReviewItem(anchorItem);
  const scopedItems = Array.from(items || [])
    .filter(item => Boolean(isLocalizedMediaReviewItem(item)) === Boolean(anchorIsLocalized));

  if (!anchorIsLocalized || previewOrder !== "slot") {
    return scopedItems.sort((a, b) => a.registrationIndex - b.registrationIndex);
  }

  return scopedItems.sort((a, b) => {
    return (a.slotIndex || 0) - (b.slotIndex || 0) ||
      String(a.locale || "").localeCompare(String(b.locale || "")) ||
      a.registrationIndex - b.registrationIndex;
  });
}

function getOrderedMediaReviewItems(anchorItem = mediaReviewElements && mediaReviewElements.currentItem || null) {
  return getOrderedMediaReviewItemsForMode(mediaReviewItems, mediaReviewPreviewOrder, anchorItem);
}

function createMediaReviewArrowIcon(direction) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2.25");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("d", direction < 0 ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6");
  icon.append(path);
  return icon;
}

function createMediaReviewNavButton(direction, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = direction < 0
    ? "media-review-nav media-review-nav-previous"
    : "media-review-nav media-review-nav-next";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(createMediaReviewArrowIcon(direction));
  button.addEventListener("click", () => showAdjacentMediaReview(direction));
  return button;
}

function updateMediaReviewNavState() {
  if (!mediaReviewElements) return;

  const canNavigate = getOrderedMediaReviewItems(mediaReviewElements.currentItem).length > 1;
  mediaReviewElements.previousButton.disabled = !canNavigate;
  mediaReviewElements.nextButton.disabled = !canNavigate;
}

function setMediaReviewContent(item) {
  if (!mediaReviewElements || !item || !item.previewUrl) return;

  const orderedItems = getOrderedMediaReviewItems(item);
  const itemIndex = orderedItems.indexOf(item);
  mediaReviewCurrentIndex = itemIndex >= 0 ? itemIndex : 0;
  mediaReviewElements.currentItem = item;
  const positionLabel = t("mediaReviewPosition", "$1 of $2", [
    String(mediaReviewCurrentIndex + 1),
    String(orderedItems.length)
  ]);
  const isLocalized = isLocalizedMediaReviewItem(item);

  mediaReviewElements.title.textContent = item.typeLabel;
  mediaReviewElements.meta.textContent = getMediaReviewMetaParts(item, positionLabel).join(" | ");
  mediaReviewElements.image.src = item.previewUrl;
  mediaReviewElements.image.alt = item.typeLabel;
  mediaReviewElements.path.textContent = getMediaReviewPath(item);
  mediaReviewElements.previewOrderControl.hidden = !isLocalized;
  mediaReviewElements.previewOrderSelect.value = mediaReviewPreviewOrder;
  updateMediaReviewNavState();
}

function showAdjacentMediaReview(direction) {
  const orderedItems = getOrderedMediaReviewItems(mediaReviewElements && mediaReviewElements.currentItem);
  if (!mediaReviewOverlay || orderedItems.length < 2) return;

  const nextIndex = (mediaReviewCurrentIndex + direction + orderedItems.length) % orderedItems.length;
  setMediaReviewContent(orderedItems[nextIndex]);
}

function handleMediaReviewKeydown(event) {
  if (event.key === "Escape") {
    closeMediaReview();
    return;
  }

  if (!event.altKey && !event.ctrlKey && !event.metaKey) {
    const key = event.key.toLowerCase();
    if (key === "a" || event.key === "ArrowLeft") {
      event.preventDefault();
      showAdjacentMediaReview(-1);
      return;
    }

    if (key === "d" || event.key === "ArrowRight") {
      event.preventDefault();
      showAdjacentMediaReview(1);
      return;
    }
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
  mediaReviewElements = null;
  mediaReviewCurrentIndex = -1;
  document.body.classList.remove("media-review-open");
  document.removeEventListener("keydown", handleMediaReviewKeydown);

  if (restoreFocus && mediaReviewReturnFocus && mediaReviewReturnFocus.isConnected) {
    mediaReviewReturnFocus.focus();
  }
  mediaReviewReturnFocus = null;
}

function openMediaReview(item) {
  if (!item || !item.previewUrl) return;

  closeMediaReview({ restoreFocus: false });
  mediaReviewReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const titleBlock = document.createElement("div");
  const title = document.createElement("h3");
  const meta = document.createElement("div");
  const previewOrderControl = document.createElement("label");
  const previewOrderLabel = document.createElement("span");
  const previewOrderSelect = document.createElement("select");
  const closeButton = document.createElement("button");
  const imageFrame = document.createElement("div");
  const previousButton = createMediaReviewNavButton(-1, t("previousMediaPreview", "Previous graphic asset"));
  const nextButton = createMediaReviewNavButton(1, t("nextMediaPreview", "Next graphic asset"));
  const image = document.createElement("img");
  const path = document.createElement("div");

  overlay.className = "media-review-overlay";
  dialog.className = "media-review-dialog";
  header.className = "media-review-header";
  titleBlock.className = "media-review-title";
  meta.className = "media-review-meta";
  previewOrderControl.className = "media-review-order";
  closeButton.className = "media-review-close";
  imageFrame.className = "media-review-image-frame";
  path.className = "media-review-path";

  overlay.setAttribute("role", "presentation");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "mediaReviewTitle");
  title.id = "mediaReviewTitle";
  previewOrderLabel.textContent = t("mediaReviewPreviewOrder", "Preview order");
  [
    { value: "locale", label: t("mediaReviewLocaleByLocale", "Locale by locale") },
    { value: "slot", label: t("mediaReviewSlotAcrossLocales", "Screenshot number across locales") }
  ].forEach(optionConfig => {
    const option = document.createElement("option");
    option.value = optionConfig.value;
    option.textContent = optionConfig.label;
    option.selected = mediaReviewPreviewOrder === optionConfig.value;
    previewOrderSelect.append(option);
  });
  previewOrderSelect.addEventListener("change", () => {
    mediaReviewPreviewOrder = previewOrderSelect.value === "slot" ? "slot" : "locale";
    setMediaReviewContent(mediaReviewElements && mediaReviewElements.currentItem || item);
  });
  closeButton.type = "button";
  closeButton.textContent = t("closePreview", "Close preview");
  closeButton.addEventListener("click", () => closeMediaReview());

  imageFrame.append(previousButton, image, nextButton);
  titleBlock.append(title, meta);
  previewOrderControl.append(previewOrderLabel, previewOrderSelect);
  header.append(titleBlock, previewOrderControl, closeButton);
  dialog.append(header, imageFrame, path);
  overlay.append(dialog);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeMediaReview();
  });

  mediaReviewOverlay = overlay;
  mediaReviewElements = {
    title,
    meta,
    image,
    path,
    previousButton,
    nextButton,
    previewOrderControl,
    previewOrderSelect,
    currentItem: null
  };
  setMediaReviewContent(item);
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

function getStoredLocalizedScreenshotFile(mediaFiles, locale, index = 0) {
  return mediaFiles && mediaFiles.localizedScreenshots && mediaFiles.localizedScreenshots[locale]
    ? mediaFiles.localizedScreenshots[locale][index] || null
    : null;
}

function createMediaCard(typeLabel, asset, stateLabel = "", file = null, reviewPatch = {}) {
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
    const reviewItem = registerMediaReviewItem({
      previewUrl,
      typeLabel,
      asset,
      fileName: file && file.name,
      ...reviewPatch
    });

    thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "media-thumb media-thumb-button";
    thumb.setAttribute("aria-label", t("openMediaPreview", "Open preview for $1", [typeLabel]));
    thumb.addEventListener("click", () => openMediaReview(reviewItem));

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

function createPromoVideoLink(url) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = url;
  return link;
}

function getPromoVideoIssueLabel(asset) {
  const issues = Array.from(asset && asset.issues || []);
  return issues.length
    ? t("localizedPromoVideoIssueCount", "$1 issue(s): $2", [String(issues.length), issues.slice(0, 2).join("; ")])
    : t("noIssues", "No issues");
}

function createPromoVideoCard(typeLabel, asset, stateLabel = "") {
  const card = document.createElement("article");
  const header = document.createElement("div");
  const type = document.createElement("div");
  const label = document.createElement("div");
  const urlBox = document.createElement("div");
  const path = document.createElement("div");
  const status = document.createElement("div");

  card.className = "media-card promo-video-card";
  header.className = "media-card-header";
  type.className = "media-type";
  label.className = "media-dimensions";
  urlBox.className = "media-thumb promo-video-url-box";
  path.className = "media-path";
  status.className = "count";

  type.textContent = typeLabel;
  label.textContent = t("promoVideoUrl", "YouTube URL");
  path.textContent = asset ? asset.path : stateLabel || t("missing", "Missing");
  status.textContent = asset ? getPromoVideoIssueLabel(asset) : "";

  if (asset && asset.url) {
    urlBox.append(createPromoVideoLink(asset.url));
  } else {
    urlBox.textContent = stateLabel || t("promoVideoMissing", "No promo video URL found.");
  }

  header.append(type, label);
  card.append(header, urlBox, path, status);
  return card;
}

function getLocalizedPromoVideoEntries(mediaAssets) {
  return Object.entries(mediaAssets && mediaAssets.localizedPromoVideos || {})
    .map(([locale, asset]) => ({
      locale,
      asset
    }))
    .filter(entry => entry.asset && entry.asset.url)
    .sort((a, b) => a.locale.localeCompare(b.locale));
}

function createLocalizedPromoVideoHeader() {
  const row = document.createElement("div");
  row.className = "localized-promo-video-row localized-promo-video-row-header";
  [
    t("localizedPromoVideoLocale", "Locale"),
    t("localizedPromoVideoUrl", "URL"),
    t("localizedPromoVideoStatus", "Status"),
    t("localizedPromoVideoSourcePath", "Source path")
  ].forEach(label => {
    const cell = document.createElement("div");
    cell.textContent = label;
    row.append(cell);
  });
  return row;
}

function createLocalizedPromoVideoRow(entry) {
  const row = document.createElement("div");
  const locale = document.createElement("div");
  const url = document.createElement("div");
  const status = document.createElement("div");
  const source = document.createElement("div");

  row.className = "localized-promo-video-row";
  locale.className = "locale";
  url.className = "promo-video-url";
  status.className = "preview";
  source.className = "media-path";

  locale.textContent = entry.locale;
  url.append(createPromoVideoLink(entry.asset.url));
  status.textContent = getPromoVideoIssueLabel(entry.asset);
  source.textContent = entry.asset.path;

  row.append(locale, url, status, source);
  return row;
}

function createLocalizedPromoVideoSection(mediaAssets) {
  const section = document.createElement("section");
  const heading = document.createElement("div");
  const title = document.createElement("h3");
  const summary = document.createElement("p");
  const table = document.createElement("div");
  const entries = getLocalizedPromoVideoEntries(mediaAssets);
  const stats = mediaAssets.localizedPromoVideoStats || {};

  section.className = "localized-screenshot-section localized-promo-video-section";
  heading.className = "localized-screenshot-heading";
  table.className = "localized-screenshot-table localized-promo-video-table";

  title.textContent = t("localizedPromoVideos", "Localized promo videos");
  summary.textContent = t("localizedPromoVideoSummary", "$1 locale(s), $2 issue(s).", [
    String(stats.localeCount || entries.length),
    String(stats.issueCount || entries.reduce((count, entry) => count + (entry.asset.issues || []).length, 0))
  ]);
  heading.append(title, summary);

  if (entries.length) {
    table.append(
      createLocalizedPromoVideoHeader(),
      ...entries.map(createLocalizedPromoVideoRow)
    );
  } else {
    const empty = document.createElement("div");
    empty.className = "localized-screenshot-empty";
    empty.textContent = t("localizedPromoVideoNoFiles", "No localized promo video URLs found.");
    table.append(empty);
  }

  section.append(heading, table);
  return section;
}

function getLocalizedScreenshotEntries(mediaAssets) {
  return Object.entries(mediaAssets && mediaAssets.localizedScreenshots || {})
    .map(([locale, assets]) => ({
      locale,
      assets: Array.from(assets || [])
    }))
    .filter(entry => entry.assets.length)
    .sort((a, b) => a.locale.localeCompare(b.locale));
}

function getLocalizedScreenshotIssues(assets) {
  return (assets || []).flatMap(asset => Array.from(asset.issues || []));
}

function getLocalizedScreenshotDimensions(assets) {
  return Array.from(new Set((assets || []).map(formatMediaDimensions).filter(Boolean))).join(", ");
}

function getLocalizedScreenshotFolderPath(entry) {
  const firstPath = entry && entry.assets && entry.assets[0] && entry.assets[0].path || "";
  const separatorIndex = Math.max(firstPath.lastIndexOf("/"), firstPath.lastIndexOf("\\"));
  return separatorIndex > 0 ? firstPath.slice(0, separatorIndex) : firstPath;
}

function createLocalizedScreenshotHeader() {
  const row = document.createElement("div");
  row.className = "localized-screenshot-row localized-screenshot-row-header";
  [
    t("localizedScreenshotLocale", "Locale"),
    t("localizedScreenshotCount", "Count"),
    t("localizedScreenshotDimensionsIssues", "Dimensions / issues"),
    t("localizedScreenshotPreview", "Preview"),
    t("localizedScreenshotSourcePath", "Source path")
  ].forEach(label => {
    const cell = document.createElement("div");
    cell.textContent = label;
    row.append(cell);
  });
  return row;
}

function createLocalizedScreenshotRow(entry, mediaFiles) {
  const row = document.createElement("div");
  const count = document.createElement("div");
  const locale = document.createElement("div");
  const dimensions = document.createElement("div");
  const preview = document.createElement("div");
  const source = document.createElement("div");
  const issues = getLocalizedScreenshotIssues(entry.assets);
  let previewCount = 0;

  row.className = "localized-screenshot-row";
  locale.className = "locale";
  count.className = "count";
  dimensions.className = "preview";
  preview.className = "localized-screenshot-preview";
  source.className = "media-path";

  locale.textContent = entry.locale;
  count.textContent = String(entry.assets.length);
  dimensions.textContent = [
    getLocalizedScreenshotDimensions(entry.assets),
    issues.length
      ? t("localizedScreenshotIssueCount", "$1 issue(s): $2", [String(issues.length), issues.slice(0, 2).join("; ")])
      : t("noIssues", "No issues")
  ].filter(Boolean).join(" | ");
  source.textContent = getLocalizedScreenshotFolderPath(entry);

  entry.assets.forEach((asset, index) => {
    const file = getStoredLocalizedScreenshotFile(mediaFiles, entry.locale, index);
    const previewUrl = createMediaPreviewUrl(file);
    if (!previewUrl) return;

    const reviewItem = registerMediaReviewItem({
      previewUrl,
      typeLabel: t("localizedScreenshotNumber", "$1 screenshot $2", [entry.locale, String(index + 1)]),
      asset,
      fileName: file && file.name,
      kind: "localizedScreenshots",
      locale: entry.locale,
      slotIndex: index
    });

    const button = document.createElement("button");
    const image = document.createElement("img");
    button.type = "button";
    button.className = "localized-screenshot-thumb";
    button.setAttribute("aria-label", t("openMediaPreview", "Open preview for $1", [reviewItem.typeLabel]));
    button.addEventListener("click", () => openMediaReview(reviewItem));
    image.src = reviewItem.previewUrl;
    image.alt = reviewItem.typeLabel;
    button.append(image);
    preview.append(button);
    previewCount++;
  });

  if (!previewCount) {
    preview.textContent = t("previewUnavailable", "Preview unavailable");
  }

  row.append(locale, count, dimensions, preview, source);
  return row;
}

function createLocalizedScreenshotSection(mediaAssets, mediaFiles) {
  const section = document.createElement("section");
  const heading = document.createElement("div");
  const title = document.createElement("h3");
  const summary = document.createElement("p");
  const table = document.createElement("div");
  const entries = getLocalizedScreenshotEntries(mediaAssets);
  const stats = mediaAssets.localizedScreenshotStats || {};

  section.className = "localized-screenshot-section";
  heading.className = "localized-screenshot-heading";
  table.className = "localized-screenshot-table";

  title.textContent = t("localizedScreenshots", "Localized screenshots");
  summary.textContent = t("localizedScreenshotSummary", "$1 locale(s), $2 screenshot(s), $3 issue(s).", [
    String(stats.localeCount || entries.length),
    String(stats.screenshotCount || entries.reduce((count, entry) => count + entry.assets.length, 0)),
    String(stats.issueCount || entries.reduce((count, entry) => count + getLocalizedScreenshotIssues(entry.assets).length, 0))
  ]);
  heading.append(title, summary);

  if (entries.length) {
    table.append(
      createLocalizedScreenshotHeader(),
      ...entries.map(entry => createLocalizedScreenshotRow(entry, mediaFiles))
    );
  } else {
    const empty = document.createElement("div");
    empty.className = "localized-screenshot-empty";
    empty.textContent = t("localizedScreenshotNoFiles", "No localized screenshots found.");
    table.append(empty);
  }

  section.append(heading, table);
  return section;
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
    createPromoVideoCard(
      t("globalPromoVideo", "Global promo video"),
      mediaAssets.globalPromoVideo
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
    createLocalizedPromoVideoSection(mediaAssets),
    createLocalizedScreenshotSection(mediaAssets, mediaFiles),
    createMediaCard(
      t("mediaCandidateCounts", "Candidates"),
      {
        path: [
          t("mediaCandidateCountsValue", "Icon: $1; global screenshots: $2; localized screenshots: $3; small promo: $4; marquee promo: $5.", [
            String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.storeIcon || 0),
            String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.screenshots || 0),
            String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.localizedScreenshots || 0),
            String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.smallPromo || 0),
            String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.marqueePromo || 0)
          ]),
          t("mediaPromoVideoCandidateCountsValue", "Global promo video: $1; localized promo videos: $2.", [
            String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.globalPromoVideo || 0),
            String(mediaAssets.candidateCounts && mediaAssets.candidateCounts.localizedPromoVideos || 0)
          ])
        ].join(" "),
        width: "",
        height: "",
        size: 0
      }
    )
  );
}
