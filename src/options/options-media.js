let mediaPreviewUrls = [];
let mediaReviewOverlay = null;
let mediaReviewReturnFocus = null;
let mediaReviewItems = [];
let mediaReviewCurrentIndex = -1;
let mediaReviewElements = null;

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

function getMediaReviewMetaParts(item) {
  const asset = item && item.asset;
  return [
    asset && asset.width && asset.height ? formatMediaDimensions(asset) : "",
    asset && asset.size ? formatBytes(asset.size) : ""
  ].filter(Boolean);
}

function getMediaReviewPath(item) {
  if (!item) return "";
  return item.asset && item.asset.path ? item.asset.path : item.fileName || "";
}

function registerMediaReviewItem(item) {
  mediaReviewItems.push(item);
  return item;
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

  const canNavigate = mediaReviewItems.length > 1;
  mediaReviewElements.previousButton.disabled = !canNavigate;
  mediaReviewElements.nextButton.disabled = !canNavigate;
}

function setMediaReviewContent(item) {
  if (!mediaReviewElements || !item || !item.previewUrl) return;

  const itemIndex = mediaReviewItems.indexOf(item);
  mediaReviewCurrentIndex = itemIndex >= 0 ? itemIndex : 0;
  mediaReviewElements.title.textContent = item.typeLabel;
  mediaReviewElements.meta.textContent = getMediaReviewMetaParts(item).join(" | ");
  mediaReviewElements.image.src = item.previewUrl;
  mediaReviewElements.image.alt = item.typeLabel;
  mediaReviewElements.path.textContent = getMediaReviewPath(item);
  updateMediaReviewNavState();
}

function showAdjacentMediaReview(direction) {
  if (!mediaReviewOverlay || mediaReviewItems.length < 2) return;

  const nextIndex = (mediaReviewCurrentIndex + direction + mediaReviewItems.length) % mediaReviewItems.length;
  setMediaReviewContent(mediaReviewItems[nextIndex]);
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
  closeButton.className = "media-review-close";
  imageFrame.className = "media-review-image-frame";
  path.className = "media-review-path";

  overlay.setAttribute("role", "presentation");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "mediaReviewTitle");
  title.id = "mediaReviewTitle";
  closeButton.type = "button";
  closeButton.textContent = t("closePreview", "Close preview");
  closeButton.addEventListener("click", () => closeMediaReview());

  imageFrame.append(previousButton, image, nextButton);
  titleBlock.append(title, meta);
  header.append(titleBlock, closeButton);
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
    nextButton
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
    const reviewItem = registerMediaReviewItem({
      previewUrl,
      typeLabel,
      asset,
      fileName: file && file.name
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
