function getStoredPanelPosition() {
  try {
    return JSON.parse(window.localStorage.getItem(PANEL_POSITION_STORAGE_KEY) || "null");
  } catch (_error) {
    return null;
  }
}

function savePanelPosition(position) {
  try {
    window.localStorage.setItem(PANEL_POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch (_error) {
    // The panel can still be dragged for this session if page storage is unavailable.
  }
}

function normalizePanelMode(mode) {
  return ["expanded", "minimized", "hidden"].includes(mode) ? mode : "expanded";
}

function getStoredPanelMode() {
  try {
    return normalizePanelMode(window.localStorage.getItem(PANEL_MODE_STORAGE_KEY));
  } catch (_error) {
    return "expanded";
  }
}

function savePanelMode(mode) {
  try {
    window.localStorage.setItem(PANEL_MODE_STORAGE_KEY, normalizePanelMode(mode));
  } catch (_error) {
    // Panel mode is convenience state; the panel can still be controlled this session.
  }
}

function removePanel() {
  if (panelMediaStateObserver) {
    panelMediaStateObserver.disconnect();
    panelMediaStateObserver = null;
  }

  if (panelViewportClampController) {
    panelViewportClampController.abort();
    panelViewportClampController = null;
  }

  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.remove();
}

function applyPanelMode(panel, mode) {
  if (!panel) return;

  const normalizedMode = normalizePanelMode(mode);
  panel.dataset.panelMode = normalizedMode;

  const toggleButton = panel.querySelector("[data-storepilot-action='toggle-panel-mode']");
  if (toggleButton) {
    const isMinimized = normalizedMode === "minimized";
    toggleButton.textContent = isMinimized ? "+" : "-";
    toggleButton.title = isMinimized
      ? localize("maximizePanel", "Maximize panel")
      : localize("minimizePanel", "Minimize panel");
    toggleButton.setAttribute("aria-label", toggleButton.title);
  }
}

function setPanelMode(panel, mode) {
  const normalizedMode = normalizePanelMode(mode);
  savePanelMode(normalizedMode);

  if (normalizedMode === "hidden") {
    removePanel();
    return;
  }

  applyPanelMode(panel, normalizedMode);
  clampPanelToViewport(panel, false);
}

function getPanelState() {
  const panel = document.getElementById(PANEL_ID);
  const mode = getStoredPanelMode();
  return {
    mode,
    visible: Boolean(panel) && mode !== "hidden",
    minimized: Boolean(panel) && panel.dataset.panelMode === "minimized"
  };
}

function clampPanelPosition(panel, left, top) {
  const margin = 8;
  const rect = panel.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);

  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop)
  };
}

function setPanelPosition(panel, position) {
  if (!position || !Number.isFinite(position.left) || !Number.isFinite(position.top)) return;

  const nextPosition = clampPanelPosition(panel, position.left, position.top);
  panel.style.left = `${nextPosition.left}px`;
  panel.style.top = `${nextPosition.top}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

function applyStoredPanelPosition(panel) {
  setPanelPosition(panel, getStoredPanelPosition());
}

function clampPanelToViewport(panel, savePosition = true) {
  if (!panel || !panel.isConnected) return;

  const rect = panel.getBoundingClientRect();
  const nextPosition = clampPanelPosition(panel, rect.left, rect.top);
  setPanelPosition(panel, nextPosition);
  if (savePosition) {
    savePanelPosition(nextPosition);
  }
}

function bindPanelViewportClamp(panel) {
  if (panelViewportClampController) {
    panelViewportClampController.abort();
  }

  panelViewportClampController = new AbortController();
  let frameId = 0;

  function scheduleClamp() {
    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      clampPanelToViewport(panel);
    });
  }

  window.addEventListener("resize", scheduleClamp, { signal: panelViewportClampController.signal });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleClamp, { signal: panelViewportClampController.signal });
    window.visualViewport.addEventListener("scroll", scheduleClamp, { signal: panelViewportClampController.signal });
  }
}

function bindDashboardSectionWatcher() {
  if (dashboardSectionWatcherId) return;

  let previousUrl = window.location.href;
  dashboardSectionWatcherId = window.setInterval(() => {
    if (window.location.href === previousUrl) return;
    previousUrl = window.location.href;

    if (!isPanelDashboardSection()) {
      removePanel();
      return;
    }

    loadSettings()
      .then(() => loadListings())
      .then(renderPanel)
      .catch(() => {});
  }, 600);
}

function getDashboardMediaState() {
  const screenshotCount = getVisibleMediaImageCount("screenshots");
  const storeIconPresent = hasExistingOrProcessingMedia("storeIcon");
  const smallPromoPresent = hasExistingOrProcessingMedia("smallPromo");
  const marqueePromoPresent = hasExistingOrProcessingMedia("marqueePromo");
  const localizedScreenshotTargetFound = getMediaUploadWidgets("localizedScreenshots").length > 0 ||
    hasClearableMedia("localizedScreenshots");

  return {
    screenshots: screenshotCount,
    localizedScreenshots: getVisibleMediaImageCount("localizedScreenshots"),
    storeIcon: getVisibleMediaImageCount("storeIcon"),
    smallPromo: getVisibleMediaImageCount("smallPromo"),
    marqueePromo: getVisibleMediaImageCount("marqueePromo"),
    clearableScreenshots: hasClearableMedia("screenshots"),
    clearableStoreIcon: hasClearableMedia("storeIcon"),
    clearableSmallPromo: hasClearableMedia("smallPromo"),
    clearableMarqueePromo: hasClearableMedia("marqueePromo"),
    screenshotsLimitReached: screenshotCount >= MAX_DASHBOARD_SCREENSHOTS,
    maxScreenshots: MAX_DASHBOARD_SCREENSHOTS,
    localizedScreenshotTargetFound,
    storeIconPresent,
    smallPromoPresent,
    marqueePromoPresent,
    running: mediaOperationState.running,
    runningLabel: mediaOperationState.label
  };
}

function getPanelMediaButtons(panel = document.getElementById(PANEL_ID)) {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll([
    "[data-storepilot-action='upload-storeIcon']",
    "[data-storepilot-action='upload-screenshots']",
    "[data-storepilot-action='upload-localizedScreenshots']",
    "[data-storepilot-action='upload-smallPromo']",
    "[data-storepilot-action='upload-marqueePromo']",
    "[data-storepilot-action='clear-screenshots']",
    "[data-storepilot-action='clear-storeIcon']",
    "[data-storepilot-action='clear-smallPromo']",
    "[data-storepilot-action='clear-marqueePromo']"
  ].join(",")));
}

function setPanelMediaButtonsDisabled(disabled, title = "") {
  for (const button of getPanelMediaButtons()) {
    button.disabled = disabled;
    button.title = title;
  }
}

function updatePanelMediaUi() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const fillAllRunning = Boolean(isFillingAllLanguages || fillAllStatus.running);
  if (mediaOperationState.running) {
    setPanelMediaButtonsDisabled(true, mediaOperationState.label);
    updatePanelFillAllUi();
    return;
  }

  if (fillAllRunning) {
    setPanelMediaButtonsDisabled(true, localize("fillingAllLanguages", "Filling descriptions..."));
    return;
  }

  for (const button of getPanelMediaButtons(panel)) {
    button.disabled = false;
    button.title = "";
  }

  for (const kind of ["screenshots", "storeIcon", "smallPromo", "marqueePromo"]) {
    const button = panel.querySelector(`[data-storepilot-action='clear-${kind}']`);
    if (!button) continue;

    const hasMedia = hasClearableMedia(kind);
    button.disabled = !hasMedia;
    button.title = hasMedia
      ? ""
      : localize("mediaAlreadyClearKind", "$1 already clear.", [getMediaUploadKindLabel(kind)]);
  }

  for (const kind of ["storeIcon", "smallPromo", "marqueePromo"]) {
    const button = panel.querySelector(`[data-storepilot-action='upload-${kind}']`);
    if (!button) continue;

    const alreadyPresent = hasExistingOrProcessingMedia(kind);
    button.disabled = alreadyPresent;
    button.title = alreadyPresent
      ? localize("mediaAlreadyPresentOrProcessing", "$1 already present or processing.", [getMediaUploadKindLabel(kind)])
      : "";
  }

  const uploadScreenshotsButton = panel.querySelector("[data-storepilot-action='upload-screenshots']");
  if (uploadScreenshotsButton) {
    const screenshotCount = getVisibleMediaImageCount("screenshots");
    const limitReached = screenshotCount >= MAX_DASHBOARD_SCREENSHOTS;
    uploadScreenshotsButton.disabled = limitReached;
    uploadScreenshotsButton.title = limitReached
      ? localize("screenshotsLimitReached", "screenshots: CWS limit of $1 already reached", [String(MAX_DASHBOARD_SCREENSHOTS)])
      : "";
  }

  const uploadLocalizedScreenshotsButton = panel.querySelector("[data-storepilot-action='upload-localizedScreenshots']");
  if (uploadLocalizedScreenshotsButton) {
    const targetFound = getMediaUploadWidgets("localizedScreenshots").length > 0 ||
      hasClearableMedia("localizedScreenshots");
    uploadLocalizedScreenshotsButton.disabled = !targetFound;
    uploadLocalizedScreenshotsButton.title = targetFound
      ? ""
      : localize("localizedScreenshotTargetNotFound", "Localized screenshots upload target not found on this page.");
  }
}

async function runExclusiveMediaOperation(label, operation) {
  if (mediaOperationState.running) {
    return {
      ok: true,
      ignored: true,
      message: localize("mediaOperationAlreadyRunning", "Media operation already running: $1.", [mediaOperationState.label])
    };
  }

  mediaOperationState = {
    running: true,
    label,
    abortRequested: false
  };
  updatePanelMediaUi();
  updatePanelFillAllUi();

  try {
    return await operation();
  } finally {
    mediaOperationState = {
      running: false,
      label: "",
      abortRequested: false
    };
    updatePanelMediaUi();
    updatePanelFillAllUi();
  }
}

function bindPanelMediaState(panel) {
  if (panelMediaStateObserver) {
    panelMediaStateObserver.disconnect();
  }

  let frameId = 0;
  function scheduleUpdate() {
    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      updatePanelMediaUi();
    });
  }

  panelMediaStateObserver = new MutationObserver(scheduleUpdate);
  panelMediaStateObserver.observe(document.body || document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "style", "aria-label", "data-image-key"]
  });

  updatePanelMediaUi();
  window.setTimeout(updatePanelMediaUi, 300);
  window.setTimeout(updatePanelMediaUi, 1200);
}

function enablePanelDrag(panel, dragHandle) {
  if (!panel || !dragHandle) return;

  dragHandle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.target.closest("button, select, input, textarea, a")) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    panel.dataset.dragging = "true";
    panel.setPointerCapture(event.pointerId);
    event.preventDefault();

    function movePanel(moveEvent) {
      const nextPosition = clampPanelPosition(
        panel,
        moveEvent.clientX - offsetX,
        moveEvent.clientY - offsetY
      );
      setPanelPosition(panel, nextPosition);
    }

    function stopDragging() {
      delete panel.dataset.dragging;
      savePanelPosition({
        left: panel.getBoundingClientRect().left,
        top: panel.getBoundingClientRect().top
      });
      panel.removeEventListener("pointermove", movePanel);
      panel.removeEventListener("pointerup", stopDragging);
      panel.removeEventListener("pointercancel", stopDragging);
    }

    panel.addEventListener("pointermove", movePanel);
    panel.addEventListener("pointerup", stopDragging);
    panel.addEventListener("pointercancel", stopDragging);
  });
}
