let mediaPreviewUrls = [];
let mediaReviewOverlay = null;
let mediaReviewReturnFocus = null;

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
