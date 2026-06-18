const MEDIA_UPLOAD_BRIDGE_SCRIPT = "src/content/media-upload-main-world.js";
const MAX_DASHBOARD_SCREENSHOTS = 5;

let mediaUploadBridgePromise = null;

function getMediaUploadTypeName(widget) {
  const uploadType = widget && widget.dataset ? widget.dataset.imageUploadType : "";

  if (uploadType === "4") {
    return "screenshots";
  }

  if (uploadType === "5") {
    return "storeIcon";
  }

  if (uploadType === "1") {
    return "smallPromo";
  }

  if (uploadType === "3") {
    return "marqueePromo";
  }

  const widgetText = normalizeLanguageText(getVisibleText(widget || ""));

  if (/screenshots?/.test(widgetText) || /screenshot/.test(widgetText)) return "screenshots";
  if (/store icon|merchant icon|handler symbol|haendler symbol|handlersymbol|handlersymbol|symbol hier ablegen/.test(widgetText)) return "storeIcon";
  if (/small promo|small tile|kleine werbekachel/.test(widgetText)) return "smallPromo";
  if (/marquee|large promo|lauf(schrift)? werbekachel|laufschrift werbekachel/.test(widgetText)) return "marqueePromo";

  return uploadType ? `unknownType${uploadType}` : "unknown";
}

function getMediaUploadDiagnostics() {
  const widgets = Array.from(document.querySelectorAll("[data-image-upload-type]"));
  const targets = widgets.map((widget, index) => {
    const input = widget.querySelector("input[type='file']");
    const visibleImages = Array.from(widget.querySelectorAll("img"))
      .filter(image => isVisible(image) && image.getAttribute("src"));
    const removeButtons = Array.from(widget.querySelectorAll("[aria-label]"))
      .map(element => element.getAttribute("aria-label") || "")
      .filter(label => /remove|entfernen|löschen|delete/i.test(label));

    return {
      index,
      kind: getMediaUploadTypeName(widget),
      uploadType: widget.dataset.imageUploadType || "",
      isGlobal: widget.dataset.isGlobal || "",
      jsname: widget.getAttribute("jsname") || "",
      hasFileInput: Boolean(input),
      accept: input ? input.getAttribute("accept") || "" : "",
      multiple: input ? Boolean(input.multiple) : false,
      hasVisibleExistingImage: visibleImages.length > 0,
      existingImageCount: visibleImages.length,
      removeButtonLabels: removeButtons,
      dropText: getVisibleText(widget.querySelector(".ubUOie") || widget.querySelector("[role='button']")),
      elementTextSample: getVisibleText(widget).slice(0, 160)
    };
  });

  return {
    total: targets.length,
    byKind: targets.reduce((counts, target) => ({
      ...counts,
      [target.kind]: (counts[target.kind] || 0) + 1
    }), {}),
    targets
  };
}

function getMediaUploadWidgets(kind) {
  const widgets = Array.from(document.querySelectorAll("[data-image-upload-type]"))
    .filter(widget => getMediaUploadTypeName(widget) === kind);
  const globalWidgets = widgets.filter(widget => widget.dataset.isGlobal === "true");

  return globalWidgets.length ? globalWidgets : widgets;
}

function getVisibleMediaImageCount(kind) {
  return getMediaUploadWidgets(kind)
    .flatMap(widget => Array.from(widget.querySelectorAll("img")))
    .filter(image => isVisible(image) && image.getAttribute("src"))
    .length;
}

function hasMediaUploadInProgress(kind) {
  return getMediaUploadWidgets(kind).some(widget => {
    const hasVisibleProgress = Array.from(widget.querySelectorAll("[role='progressbar']"))
      .some(isVisible);
    if (hasVisibleProgress) return true;

    const visibleText = Array.from(widget.querySelectorAll("*"))
      .filter(isVisible)
      .map(element => element.textContent || "")
      .join(" ");
    return /in bearbeitung|processing|uploading|hochlad|in progress/i.test(visibleText);
  });
}

function hasExistingOrProcessingMedia(kind) {
  return getVisibleMediaImageCount(kind) > 0 || hasMediaUploadInProgress(kind);
}

async function waitForMediaUploadUiChange(kind, beforeCount) {
  for (let attempt = 0; attempt < 20; attempt++) {
    await delay(500);
    const nextCount = getVisibleMediaImageCount(kind);
    if (nextCount > beforeCount) {
      return true;
    }
  }

  return false;
}

function getAvailableMediaUploadInput(kind) {
  return getMediaUploadWidgets(kind)
    .map(widget => ({
      widget,
      input: widget.querySelector("input[type='file']")
    }))
    .find(target => target.input && !target.input.disabled);
}

function dispatchDataTransferEvent(target, type, dataTransfer) {
  let event;
  try {
    event = new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      dataTransfer
    });
  } catch (_error) {
    event = new Event(type, {
      bubbles: true,
      cancelable: true,
      composed: true
    });
    Object.defineProperty(event, "dataTransfer", {
      configurable: true,
      value: dataTransfer
    });
  }

  target.dispatchEvent(event);
}

function ensureMediaUploadBridge() {
  if (mediaUploadBridgePromise) return mediaUploadBridgePromise;

  mediaUploadBridgePromise = new Promise(resolve => {
    const existing = document.querySelector("script[data-storepilot-media-upload-bridge]");
    if (existing) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    let settled = false;

    function finish(ok) {
      if (settled) return;
      settled = true;
      resolve(ok);
    }

    script.dataset.storepilotMediaUploadBridge = "true";
    script.src = storePilotRuntimeGetUrl(MEDIA_UPLOAD_BRIDGE_SCRIPT);
    script.addEventListener("load", () => finish(true), { once: true });
    script.addEventListener("error", () => finish(false), { once: true });
    (document.head || document.documentElement).append(script);
    window.setTimeout(() => finish(false), 1500);
  });

  return mediaUploadBridgePromise;
}

async function serializeMediaFiles(files) {
  const payloads = [];
  const transfers = [];

  for (const file of files.filter(Boolean)) {
    const buffer = await file.arrayBuffer();
    payloads.push({
      name: file.name,
      type: file.type || "",
      lastModified: file.lastModified || Date.now(),
      buffer
    });
    transfers.push(buffer);
  }

  return { payloads, transfers };
}

async function uploadFilesInMainWorld(kind, files) {
  if (!(await ensureMediaUploadBridge())) {
    return { ok: false, message: "page bridge unavailable" };
  }

  const requestId = `storepilot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const { payloads, transfers } = await serializeMediaFiles(files);

  return new Promise(resolve => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      resolve({ ok: false, message: "page bridge timed out" });
    }, 4000);

    function handleMessage(event) {
      const message = event.data;
      if (!message ||
        message.source !== "storepilot-media-upload-bridge" ||
        message.type !== "storepilot-upload-media-main-world-result" ||
        message.requestId !== requestId) {
        return;
      }

      window.clearTimeout(timeoutId);
      window.removeEventListener("message", handleMessage);
      resolve(message.result || { ok: false, message: "empty page bridge response" });
    }

    window.addEventListener("message", handleMessage);

    const message = {
      source: "storepilot-content-script",
      type: "storepilot-upload-media-main-world",
      requestId,
      kind,
      files: payloads
    };

    try {
      window.postMessage(message, "*", transfers);
    } catch (_error) {
      window.postMessage(message, "*");
    }
  });
}

async function uploadFilesInContentWorld(input, files) {
  const widget = input.closest("[data-image-upload-type]");
  const button = widget && widget.querySelector("[role='button'][jsname='DagSrd']");
  const dropTarget = button || widget || input;
  const dataTransfer = new DataTransfer();

  dropTarget.scrollIntoView({ block: "center", inline: "center" });
  if (typeof dropTarget.focus === "function") {
    dropTarget.focus({ preventScroll: true });
  }

  files.filter(Boolean).forEach(file => dataTransfer.items.add(file));

  for (const target of [widget, button, input].filter(Boolean)) {
    dispatchDataTransferEvent(target, "dragenter", dataTransfer);
    dispatchDataTransferEvent(target, "dragover", dataTransfer);
  }
  dispatchDataTransferEvent(dropTarget, "drop", dataTransfer);

  input.files = dataTransfer.files;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  await delay(2500);
}

async function setUploadInputFile(input, files) {
  const widget = input.closest("[data-image-upload-type]");
  const kind = getMediaUploadTypeName(widget);
  const beforeCount = getVisibleMediaImageCount(kind);
  let method = "page bridge";
  let bridgeResult = await uploadFilesInMainWorld(kind, files);

  if (bridgeResult.ok) {
    const uiChanged = await waitForMediaUploadUiChange(kind, beforeCount);
    return {
      ok: uiChanged,
      method,
      bridgeResult,
      beforeCount,
      afterCount: getVisibleMediaImageCount(kind)
    };
  }

  method = "content script";
  await uploadFilesInContentWorld(input, files);
  const uiChanged = await waitForMediaUploadUiChange(kind, beforeCount);

  return {
    ok: uiChanged,
    method,
    bridgeResult,
    beforeCount,
    afterCount: getVisibleMediaImageCount(kind)
  };
}

function getMediaUploadKindLabel(kind) {
  if (kind === "screenshots") return localize("screenshots", "Screenshots");
  if (kind === "storeIcon") return localize("storeIcon", "Store icon");
  if (kind === "smallPromo") return localize("smallPromoTile", "Small promo tile");
  if (kind === "marqueePromo") return localize("marqueePromoTile", "Marquee promo tile");
  return localize("media", "Media");
}

async function revealMediaRemoveControls(kind) {
  const targets = getMediaUploadWidgets(kind)
    .flatMap(widget => Array.from(widget.querySelectorAll("img")))
    .filter(image => isVisible(image) && image.getAttribute("src"))
    .map(image => image.closest("div") || image);

  for (const target of targets) {
    target.scrollIntoView({ block: "center", inline: "center" });
    for (const type of ["pointerover", "mouseover", "mouseenter"]) {
      target.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window
      }));
    }
  }

  if (targets.length) {
    await delay(80);
  }
}

function getVisibleDialogConfirmButton() {
  const buttons = Array.from(document.querySelectorAll([
    "[role='dialog'] button",
    ".VfPpkd-Sx9Kwc button",
    "button[data-mdc-dialog-action='ok']"
  ].join(","))).filter(isVisible);

  return buttons.find(button => button.getAttribute("data-mdc-dialog-action") === "ok") ||
    buttons.find(button => {
      const text = normalizeLanguageText(getVisibleText(button));
      return /^(remove|delete|entfernen|loschen)$/.test(text);
    }) ||
    null;
}

async function confirmVisibleDialog() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const button = getVisibleDialogConfirmButton();
    if (button) {
      activateDashboardButton(button);
      return true;
    }
    await delay(150);
  }

  return false;
}

function getMediaRemoveButtons(kind) {
  return getMediaUploadWidgets(kind)
    .flatMap(widget => Array.from(widget.querySelectorAll("[role='button'][aria-label], [jsname='LCoeQd']")))
    .filter(button => {
      if (button.getAttribute("aria-disabled") === "true") return false;
      if (!isVisible(button)) return false;
      const label = normalizeLanguageText(button.getAttribute("aria-label") || "");
      return button.getAttribute("jsname") === "LCoeQd" ||
        /remove|delete|entfernen|loschen/.test(label);
    });
}

function hasClearableMedia(kind) {
  return getVisibleMediaImageCount(kind) > 0 || getMediaRemoveButtons(kind).length > 0;
}

async function waitForMediaRemovalUiChange(kind, beforeCount) {
  for (let attempt = 0; attempt < 16; attempt++) {
    await delay(300);
    if (getVisibleMediaImageCount(kind) < beforeCount) {
      return true;
    }
  }

  return false;
}

async function performClearDashboardMediaAssets(kind) {
  const removed = [];
  const failed = [];
  let aborted = false;
  const label = getMediaUploadKindLabel(kind);

  for (let attempt = 0; attempt < 30; attempt++) {
    if (mediaOperationState.abortRequested) {
      aborted = true;
      break;
    }

    const beforeCount = getVisibleMediaImageCount(kind);
    if (!beforeCount) break;

    await revealMediaRemoveControls(kind);
    const buttons = getMediaRemoveButtons(kind);
    if (!buttons.length) {
      failed.push(`${label}: remove button not found`);
      break;
    }

    const button = buttons[buttons.length - 1];
    const buttonLabel = button.getAttribute("aria-label") || label;
    activateDashboardButton(button);
    await confirmVisibleDialog();

    const changed = await waitForMediaRemovalUiChange(kind, beforeCount);
    const afterCount = getVisibleMediaImageCount(kind);
    if (!changed) {
      failed.push(`${buttonLabel}: CWS did not remove the image`);
      break;
    }

    const removedCount = Math.max(1, beforeCount - afterCount);
    for (let index = 0; index < removedCount; index++) {
      removed.push(buttonLabel);
    }
  }

  const messageParts = [
    removed.length
      ? localize("mediaClearedKind", "Cleared $1: $2.", [label, String(removed.length)])
      : localize("mediaAlreadyClearKind", "$1 already clear.", [label]),
    aborted ? localize("operationStopped", "Stopped.") : "",
    failed.length ? localize("mediaUploadFailures", "Failed: $1.", [failed.join(", ")]) : ""
  ].filter(Boolean);

  return {
    ok: failed.length === 0,
    aborted,
    message: messageParts.join(" "),
    removed,
    failed,
    diagnostics: {
      mediaUploadTargets: getMediaUploadDiagnostics()
    }
  };
}

async function clearDashboardMediaAssets(kind) {
  return runExclusiveMediaOperation(
    localize("clearingMedia", "Clearing media..."),
    () => performClearDashboardMediaAssets(kind)
  );
}

async function performUploadDashboardMediaAssets(files, kind = "") {
  const uploaded = [];
  const failed = [];
  const skipped = [];
  let aborted = false;
  const uploadStoreIcon = !kind || kind === "storeIcon";
  const uploadScreenshots = !kind || kind === "screenshots";
  const uploadSmallPromo = !kind || kind === "smallPromo";
  const uploadMarqueePromo = !kind || kind === "marqueePromo";
  const screenshots = uploadScreenshots ? Array.from(files && files.screenshots || []) : [];

  if (uploadScreenshots && screenshots.length) {
    for (let index = 0; index < screenshots.length; index++) {
      if (mediaOperationState.abortRequested) {
        aborted = true;
        break;
      }

      const visibleScreenshotCount = getVisibleMediaImageCount("screenshots");
      if (visibleScreenshotCount >= MAX_DASHBOARD_SCREENSHOTS) {
        skipped.push(localize(
          "screenshotsLimitReached",
          "screenshots: CWS limit of $1 already reached",
          [String(MAX_DASHBOARD_SCREENSHOTS)]
        ));
        break;
      }

      const target = getAvailableMediaUploadInput("screenshots");
      if (!target) {
        failed.push(`screenshot ${index + 1}: upload target not found`);
        break;
      }

      try {
        const result = await setUploadInputFile(target.input, [screenshots[index]]);
        if (result.ok) {
          uploaded.push(`screenshot ${index + 1}: ${screenshots[index].name}`);
        } else {
          failed.push(`screenshot ${index + 1}: CWS did not show the uploaded image (${result.method})`);
        }
      } catch (error) {
        failed.push(`screenshot ${index + 1}: ${error.message || String(error)}`);
      }
    }
  } else if (uploadScreenshots) {
    skipped.push("screenshots: no discovered files");
  }

  for (const item of [
    { kind: "storeIcon", file: files && files.storeIcon, label: "store icon", enabled: uploadStoreIcon },
    { kind: "smallPromo", file: files && files.smallPromo, label: "small promo", enabled: uploadSmallPromo },
    { kind: "marqueePromo", file: files && files.marqueePromo, label: "marquee promo", enabled: uploadMarqueePromo }
  ].filter(item => item.enabled)) {
    if (mediaOperationState.abortRequested) {
      aborted = true;
      break;
    }

    if (!item.file) {
      skipped.push(`${item.label}: no discovered file`);
      continue;
    }

    if (hasExistingOrProcessingMedia(item.kind)) {
      skipped.push(`${item.label}: already present or processing`);
      continue;
    }

    const target = getAvailableMediaUploadInput(item.kind);
    if (!target) {
      failed.push(`${item.label}: upload target not found`);
      continue;
    }

    try {
      const result = await setUploadInputFile(target.input, [item.file]);
      if (result.ok) {
        uploaded.push(`${item.label}: ${item.file.name}`);
      } else {
        failed.push(`${item.label}: CWS did not show the uploaded image (${result.method})`);
      }
    } catch (error) {
      failed.push(`${item.label}: ${error.message || String(error)}`);
    }
  }

  const messageParts = [
    localize("mediaUploadedKind", "Uploaded $1: $2.", [getMediaUploadKindLabel(kind), String(uploaded.length)]),
    aborted ? localize("operationStopped", "Stopped.") : "",
    skipped.length ? localize("mediaSkipped", "Skipped: $1.", [skipped.join(", ")]) : "",
    failed.length ? localize("mediaUploadFailures", "Failed: $1.", [failed.join(", ")]) : ""
  ].filter(Boolean);

  return {
    ok: failed.length === 0 && (uploaded.length > 0 || skipped.length > 0),
    aborted,
    message: messageParts.join(" "),
    uploaded,
    skipped,
    failed,
    diagnostics: {
      mediaUploadTargets: getMediaUploadDiagnostics()
    }
  };
}

async function uploadDashboardMediaAssets(files, kind = "") {
  return runExclusiveMediaOperation(
    localize("uploadingMedia", "Uploading media..."),
    () => performUploadDashboardMediaAssets(files, kind)
  );
}
