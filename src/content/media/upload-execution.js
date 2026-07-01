let mediaUploadBridgePromise = null;
let mediaUploadBridgeBypassed = false;
let lastMediaVisibilityFocusRequestAt = 0;

function getDashboardLocaleSelectionState(locale) {
  if (typeof getCurrentDashboardLocale !== "function") return true;
  const currentLocale = getCurrentDashboardLocale({ includePageFallback: false }) ||
    getCurrentDashboardLocale();
  if (!currentLocale) {
    return {
      selected: false,
      known: false,
      currentLocale: ""
    };
  }

  return {
    selected: localesMatch(currentLocale, locale),
    known: true,
    currentLocale
  };
}

function isDashboardLocaleSelected(locale) {
  const state = getDashboardLocaleSelectionState(locale);
  return state === true || Boolean(state && state.selected);
}

function formatDashboardLocaleMismatch(locale) {
  return localize("clickedButDashboardShows", "Clicked $1, but the dashboard still shows $2.", [
    locale,
    typeof getCurrentDashboardLocale === "function"
      ? getCurrentDashboardLocale() || localize("unknownLocale", "an unknown locale")
      : localize("unknownLocale", "an unknown locale")
  ]);
}

async function ensureDashboardLanguageSelected(locale, options = {}) {
  const initialState = getDashboardLocaleSelectionState(locale);
  if (initialState === true || initialState.selected) {
    return { ok: true, message: "" };
  }

  const selection = await selectDashboardLanguage(locale, options.selectionOptions || {});
  if (!selection.ok) return selection;

  const verificationAttempts = Number.isFinite(options.verificationAttempts)
    ? Math.max(0, Math.floor(options.verificationAttempts))
    : 24;
  const verificationDelayMs = Number.isFinite(options.verificationDelayMs)
    ? Math.max(0, options.verificationDelayMs)
    : 250;

  for (let attempt = 0; attempt <= verificationAttempts; attempt++) {
    const state = getDashboardLocaleSelectionState(locale);
    if (state === true || state.selected) {
      return selection;
    }
    if (attempt < verificationAttempts && verificationDelayMs) {
      await delay(verificationDelayMs);
    }
  }

  const finalState = getDashboardLocaleSelectionState(locale);
  if (options.allowUnknownLocaleAfterSelection && finalState !== true && !finalState.known) {
    return selection;
  }

  return {
    ok: false,
    message: formatDashboardLocaleMismatch(locale)
  };
}

async function ensureLocalizedScreenshotUploadContext(locale) {
  const selection = await ensureDashboardLanguageSelected(locale, {
    selectionOptions: LOCALIZED_SCREENSHOT_LANGUAGE_SELECTION_OPTIONS,
    verificationAttempts: LOCALIZED_SCREENSHOT_LANGUAGE_VERIFICATION_ATTEMPTS,
    verificationDelayMs: LOCALIZED_SCREENSHOT_LANGUAGE_VERIFICATION_DELAY_MS,
    allowUnknownLocaleAfterSelection: true
  });
  if (!selection.ok) return selection;

  const fieldReady = await waitForLocalizedScreenshotFieldReady();
  if (!fieldReady.ok) {
    return {
      ok: false,
      message: localize("localizedScreenshotTargetNotFound", "Localized screenshots upload target not found on this page.")
    };
  }

  if (!isDashboardLocaleSelected(locale)) {
    const state = getDashboardLocaleSelectionState(locale);
    if (state !== true && !state.known) {
      return { ok: true, fieldReady };
    }

    return {
      ok: false,
      message: formatDashboardLocaleMismatch(locale)
    };
  }

  return { ok: true, fieldReady };
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

function markUploadTargetForBridge(input) {
  if (!input || typeof input.setAttribute !== "function") return "";
  const targetId = `storepilot-target-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  input.setAttribute(MEDIA_UPLOAD_TARGET_ID_ATTRIBUTE, targetId);
  const uploadWidget = getMediaUploadWidgetForInput(input);
  if (uploadWidget && typeof uploadWidget.setAttribute === "function") {
    uploadWidget.setAttribute(MEDIA_UPLOAD_TARGET_ID_ATTRIBUTE, targetId);
  }
  return targetId;
}

function clearUploadTargetBridgeMarker(input, targetId) {
  if (!targetId) return;
  const selector = `[${MEDIA_UPLOAD_TARGET_ID_ATTRIBUTE}='${String(targetId).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}']`;
  const marked = new Set(Array.from(document.querySelectorAll(selector)));
  if (input) marked.add(input);
  const uploadWidget = getMediaUploadWidgetForInput(input);
  if (uploadWidget) marked.add(uploadWidget);

  marked.forEach(element => {
    if (element && element.getAttribute && element.getAttribute(MEDIA_UPLOAD_TARGET_ID_ATTRIBUTE) === targetId) {
      element.removeAttribute(MEDIA_UPLOAD_TARGET_ID_ATTRIBUTE);
    }
  });
}

async function uploadFilesInMainWorld(kind, files, options = {}) {
  if (mediaUploadBridgeBypassed) {
    return { ok: false, message: "page bridge bypassed after timeout" };
  }

  if (!(await ensureMediaUploadBridge())) {
    mediaUploadBridgeBypassed = true;
    return { ok: false, message: "page bridge unavailable" };
  }

  const requestId = `storepilot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const { payloads, transfers } = await serializeMediaFiles(files);

  return new Promise(resolve => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      mediaUploadBridgeBypassed = true;
      resolve({ ok: false, message: "page bridge timed out" });
    }, options.timeoutMs || MEDIA_UPLOAD_BRIDGE_TIMEOUT_MS);

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
      targetId: options.targetId || "",
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
  const widget = getMediaUploadWidgetForInput(input);
  const button = getMediaUploadDropButton(widget);
  const dropTarget = button || widget || input;
  const dataTransfer = new DataTransfer();

  scrollMediaActionTargetIntoView(input);
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
}

async function setUploadInputFile(input, files, forcedKind = "", options = {}) {
  const widget = getMediaUploadWidgetForInput(input);
  const kind = forcedKind || getMediaUploadTypeName(widget);
  const beforeCount = Number.isFinite(options.beforeCount) ? options.beforeCount : getVisibleMediaImageCount(kind);
  const expectedCount = Number.isFinite(options.expectedCount)
    ? options.expectedCount
    : beforeCount + files.filter(Boolean).length;
  const timeoutMs = options.timeoutMs || (kind === "localizedScreenshots"
    ? LOCALIZED_SCREENSHOT_UPLOAD_TIMEOUT_MS
    : DEFAULT_MEDIA_UPLOAD_TIMEOUT_MS);
  const targetId = markUploadTargetForBridge(input);
  const errorState = options.errorState || {};
  let method = "page bridge";

  try {
    scrollMediaActionTargetIntoView(input);
    let bridgeResult = await uploadFilesInMainWorld(kind, files, { targetId });

    if (bridgeResult.ok) {
      const uiChanged = await waitForMediaUploadUiChange(kind, beforeCount, {
        expectedCount,
        timeoutMs,
        progress: options.progress || null,
        errorState
      });
      return {
        ok: uiChanged,
        method,
        bridgeResult,
        beforeCount,
        afterCount: getVisibleMediaImageCount(kind),
        errorMessage: errorState.message || ""
      };
    }

    method = "content script";
    await uploadFilesInContentWorld(input, files);
    const uiChanged = await waitForMediaUploadUiChange(kind, beforeCount, {
      expectedCount,
      timeoutMs,
      progress: options.progress || null,
      errorState
    });

    return {
      ok: uiChanged,
      method,
      bridgeResult,
      beforeCount,
      afterCount: getVisibleMediaImageCount(kind),
      errorMessage: errorState.message || ""
    };
  } finally {
    clearUploadTargetBridgeMarker(input, targetId);
  }
}

