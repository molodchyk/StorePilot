function createButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function openOptionsPage() {
  storePilotRuntimeSendMessage({ action: "openOptionsPage" }).catch(() => {
    window.open(storePilotRuntimeGetUrl("src/options/options.html"), "_blank", "noopener");
  });
}

function downloadJsonFile(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "storepilot-localized-screenshot-log.json";
  document.documentElement.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function createPanelControls(panel) {
  const panelControls = document.createElement("div");
  const toggleModeButton = createButton("", () => {
    const nextMode = panel.dataset.panelMode === "minimized" ? "expanded" : "minimized";
    setPanelMode(panel, nextMode);
  });
  const closeButton = createButton("x", () => {
    setPanelMode(panel, "hidden");
  });

  panelControls.className = "storepilot-panel-controls";
  toggleModeButton.dataset.storepilotAction = "toggle-panel-mode";
  toggleModeButton.className = "storepilot-icon-button";
  closeButton.dataset.storepilotAction = "close-panel";
  closeButton.className = "storepilot-icon-button";
  closeButton.title = localize("closePanel", "Close panel");
  closeButton.setAttribute("aria-label", closeButton.title);
  panelControls.append(toggleModeButton, closeButton);

  return panelControls;
}

function createPanelBase() {
  const panel = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("div");
  const meta = document.createElement("div");
  const status = document.createElement("div");
  const actions = document.createElement("div");

  panel.id = PANEL_ID;
  if (currentTheme !== "system") {
    panel.dataset.theme = currentTheme;
  }
  if (currentThemeStyle !== "default") {
    panel.dataset.themeStyle = currentThemeStyle;
  }
  header.className = "storepilot-header";
  title.className = "storepilot-title";
  meta.className = "storepilot-meta";
  status.className = "storepilot-status";
  actions.className = "storepilot-actions";
  title.textContent = localize("extensionName", "StorePilot");
  header.append(title, createPanelControls(panel));

  return { panel, header, title, meta, status, actions };
}

function createPanelActionGroup(...controls) {
  const visibleControls = controls.filter(Boolean);
  const group = document.createElement("div");
  group.className = "storepilot-action-group";
  if (visibleControls.length === 1) {
    group.classList.add("storepilot-action-group-single");
  }
  group.append(...visibleControls);
  return group;
}

function attachPanel(panel, title) {
  document.documentElement.append(panel);
  applyPanelMode(panel, getStoredPanelMode());
  applyStoredPanelPosition(panel);
  clampPanelToViewport(panel, false);
  bindPanelViewportClamp(panel);
  enablePanelDrag(panel, title);
}

function renderPrivacyPanel() {
  const panelMode = getStoredPanelMode();
  if (panelMode === "hidden") return;

  const { panel, header, title, meta, status, actions } = createPanelBase();
  const fields = getActivePrivacyFields();
  const fieldKeys = getVisiblePrivacyFieldKeys(fields);
  const dataUsageFieldKeys = getPrivacyDataUsageFieldKeys(fields);

  meta.textContent = activePrivacyDoc && activePrivacyDoc.file
    ? localize("privacyPanelSummary", "$1 privacy field(s) in $2", [String(fieldKeys.length), activeProjectName || localize("activeProject", "Active project")])
    : localize("privacyDocNotImported", "No privacy document imported for the active project.");
  status.textContent = activePrivacyDoc && activePrivacyDoc.file
    ? localize("privacyDocFileFound", "Privacy document: $1", [activePrivacyDoc.file.path])
    : localize("importPrivacyDocInOptions", "Import or re-import the project in StorePilot options to load a privacy document.");

  const fillSinglePurposeButton = createButton(localize("fillSinglePurpose", "Fill single purpose"), () => {
    const result = fillPrivacyField("single_purpose");
    status.textContent = result.message;
  });
  fillSinglePurposeButton.dataset.storepilotAction = "fill-single-purpose";
  fillSinglePurposeButton.disabled = !fields.single_purpose;
  fillSinglePurposeButton.title = fields.single_purpose
    ? ""
    : localize("privacyNoValueForField", "No privacy document value for $1.", ["single_purpose"]);

  const fillPrivacyButton = createButton(localize("fillPrivacy", "Fill privacy"), () => {
    const result = fillDetectedPrivacyFields();
    status.textContent = result.message;
  });
  fillPrivacyButton.dataset.storepilotAction = "fill-privacy";
  fillPrivacyButton.disabled = !fieldKeys.length;

  const fillDataUsageButton = createButton(localize("fillDataUsage", "Fill data usage"), () => {
    const result = fillPrivacyDataUsage();
    status.textContent = result.message;
    if (!result.ok && result.diagnostics) {
      console.info("StorePilot data usage diagnostics", result.diagnostics);
    }
  });
  fillDataUsageButton.dataset.storepilotAction = "fill-data-usage";
  fillDataUsageButton.disabled = !dataUsageFieldKeys.length;
  fillDataUsageButton.title = dataUsageFieldKeys.length
    ? ""
    : localize("dataUsageNoValues", "No data usage values found.");

  const diagnoseButton = createButton(localize("diagnosePage", "Diagnose page"), () => {
    const diagnostics = getPrivacyDiagnostics();
    status.textContent = localize("privacyDiagnosticsSummary", "Found $1 editable privacy candidate(s).", [String(diagnostics.fieldCandidates.length)]);
    console.info("StorePilot privacy diagnostics", diagnostics);
  });
  diagnoseButton.dataset.storepilotAction = "diagnose-privacy";

  const optionsButton = createButton(localize("options", "Options"), openOptionsPage);
  actions.append(
    createPanelActionGroup(fillSinglePurposeButton, fillPrivacyButton),
    createPanelActionGroup(fillDataUsageButton),
    createPanelActionGroup(diagnoseButton, optionsButton)
  );
  panel.append(header, meta, actions, status);
  attachPanel(panel, title);
}

function renderPanel(locales) {
  removePanel();

  if (isPrivacyDashboardSection()) {
    renderPrivacyPanel();
    return;
  }

  if (!isListingDashboardSection()) return;

  const panelMode = getStoredPanelMode();
  if (panelMode === "hidden") return;

  const panel = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("div");
  const panelControls = document.createElement("div");
  const meta = document.createElement("div");
  const status = document.createElement("div");
  const actions = document.createElement("div");

  panel.id = PANEL_ID;
  if (currentTheme !== "system") {
    panel.dataset.theme = currentTheme;
  }
  if (currentThemeStyle !== "default") {
    panel.dataset.themeStyle = currentThemeStyle;
  }
  header.className = "storepilot-header";
  title.className = "storepilot-title";
  panelControls.className = "storepilot-panel-controls";
  meta.className = "storepilot-meta";
  status.className = "storepilot-status";
  actions.className = "storepilot-actions";

  title.textContent = localize("extensionName", "StorePilot");
  meta.textContent = locales.length
    ? (activeProjectName
      ? localize("miniPanelLocalesInProject", "$1 locales in $2", [String(locales.length), activeProjectName])
      : localize("localesCount", "$1 locales", [String(locales.length)]))
    : localize("importListingsInOptions", "Import listings in StorePilot options");
  status.textContent = isFillingAllLanguages && fillAllStatus.message
    ? fillAllStatus.message
    : localize("lastUpdatedOn", "Last updated on $1.", [formatDisplayTimestamp(activeProjectUpdatedAt)]);

  let fillCurrentButton = null;
  if (showAdvancedFillActions) {
    fillCurrentButton = createButton(localize("fillCurrent", "Fill current language"), async () => {
      if (mediaOperationState.running) {
        status.textContent = localize("mediaOperationAlreadyRunning", "Media operation already running: $1.", [mediaOperationState.label]);
        return;
      }
      const result = await fillCurrentDashboardLanguage();
      status.textContent = result.message;
    });
    fillCurrentButton.dataset.storepilotAction = "fill-current";
  }

  const fillAllButton = createButton(localize("fillAll", "Fill descriptions"), async () => {
    if (mediaOperationState.running) {
      status.textContent = localize("mediaOperationAlreadyRunning", "Media operation already running: $1.", [mediaOperationState.label]);
      return;
    }

    if (isFillingAllLanguages) {
      status.textContent = localize("fillAllAlreadyRunning", "Description fill is already running.");
      return;
    }

    isFillingAllLanguages = true;
    fillAllAbortRequested = false;
    await publishFillAllStatus({
      running: true,
      message: localize("fillingAllLanguages", "Filling descriptions...")
    });
    fillAllButton.disabled = true;
    if (fillCurrentButton) fillCurrentButton.disabled = true;
    selectCategoryButton.disabled = true;
    fillAdditionalFieldsButton.disabled = true;
    selectCategoryButton.title = localize("fillingAllLanguages", "Filling descriptions...");
    fillAdditionalFieldsButton.title = localize("fillingAllLanguages", "Filling descriptions...");
    setPanelMediaButtonsDisabled(true, localize("fillingAllLanguages", "Filling descriptions..."));
    abortButton.hidden = false;
    status.textContent = localize("fillingAllLanguages", "Filling descriptions...");

    try {
      const result = await fillAllDashboardLanguages(message => {
        status.textContent = message;
      });
      status.textContent = result.message;
    } finally {
      isFillingAllLanguages = false;
      await publishFillAllStatus({
        running: false,
        message: status.textContent
      });
      updatePanelMediaUi();
    }
  });
  fillAllButton.dataset.storepilotAction = "fill-all";
  const selectCategoryButton = createButton(localize("selectCategory", "Select category"), async () => {
    status.textContent = localize("selectingCategory", "Selecting category...");
    const result = await selectDashboardCategory();
    status.textContent = result.message;
    updatePanelFillAllUi();
  });
  selectCategoryButton.dataset.storepilotAction = "select-category";
  const fillAdditionalFieldsButton = createButton(localize("fillAdditionalFields", "Fill additional fields"), async () => {
    status.textContent = localize("fillingAdditionalFields", "Filling additional fields...");
    const result = await fillDetectedAdditionalFields();
    status.textContent = result.message;
    updatePanelFillAllUi();
  });
  fillAdditionalFieldsButton.dataset.storepilotAction = "fill-additional-fields";
  const abortButton = createButton(localize("abortOperation", "Abort operation"), () => {
    const result = abortCurrentOperation();
    status.textContent = result.message;
  });
  abortButton.dataset.storepilotAction = "abort-operation";
  abortButton.className = "storepilot-danger";
  abortButton.hidden = !isFillingAllLanguages && !mediaOperationState.running;

  const toggleModeButton = createButton("", () => {
    const nextMode = panel.dataset.panelMode === "minimized" ? "expanded" : "minimized";
    setPanelMode(panel, nextMode);
  });
  toggleModeButton.dataset.storepilotAction = "toggle-panel-mode";
  toggleModeButton.className = "storepilot-icon-button";

  const closeButton = createButton("x", () => {
    setPanelMode(panel, "hidden");
  });
  closeButton.dataset.storepilotAction = "close-panel";
  closeButton.className = "storepilot-icon-button";
  closeButton.title = localize("closePanel", "Close panel");
  closeButton.setAttribute("aria-label", closeButton.title);

  function getLocalizedScreenshotUploadOptions() {
    if (typeof window.prompt !== "function") {
      return {};
    }

    const currentLocale = typeof getCurrentDashboardLocale === "function" ? getCurrentDashboardLocale() : "";
    const startLocale = window.prompt(
      localize("localizedScreenshotsStartLocalePrompt", "Start at locale (optional; leave empty for first locale)."),
      currentLocale || ""
    );
    if (startLocale === null) return null;

    return {
      localizedScreenshotsStartLocale: startLocale.trim()
    };
  }

  function createMediaUploadButton(kind, labelKey, fallback) {
    const button = createButton(localize(labelKey, fallback), async () => {
      const options = kind === "localizedScreenshots" ? getLocalizedScreenshotUploadOptions() : {};
      if (options === null) return;

      setPanelMediaButtonsDisabled(true, localize("uploadingMedia", "Uploading media..."));
      status.textContent = localize("uploadingMedia", "Uploading media...");
      try {
        const response = await storePilotRuntimeSendMessage({
          type: "storepilot-upload-media-assets-from-project",
          requestAccess: false,
          kind,
          options
        });
        status.textContent = response && response.message || localize("mediaUploadFailed", "Media upload failed: $1", [localize("unknown", "Unknown")]);
      } finally {
        updatePanelMediaUi();
      }
    });
    button.dataset.storepilotAction = `upload-${kind}`;
    return button;
  }

  function createMediaClearButton(kind, labelKey, fallback) {
    const button = createButton(localize(labelKey, fallback), async () => {
      if (!hasClearableMedia(kind)) {
        status.textContent = localize("mediaAlreadyClearKind", "$1 already clear.", [getMediaUploadKindLabel(kind)]);
        updatePanelMediaUi();
        return;
      }

      setPanelMediaButtonsDisabled(true, localize("clearingMedia", "Clearing media..."));
      status.textContent = localize("clearingMedia", "Clearing media...");
      try {
        const result = await clearDashboardMediaAssets(kind);
        status.textContent = result.message;
      } finally {
        updatePanelMediaUi();
      }
    });
    button.dataset.storepilotAction = `clear-${kind}`;
    button.className = "storepilot-danger";
    return button;
  }

  const uploadStoreIconButton = createMediaUploadButton("storeIcon", "uploadStoreIcon", "Upload store icon");
  const uploadScreenshotsButton = createMediaUploadButton("screenshots", "uploadScreenshots", "Upload screenshots");
  const uploadLocalizedScreenshotsButton = createMediaUploadButton("localizedScreenshots", "uploadLocalizedScreenshots", "Upload localized screenshots");
  const uploadLocalizedScreenshotsParallelButton = createButton(
    localize("uploadLocalizedScreenshotsParallel", "Upload localized screenshots in parallel"),
    async () => {
      const options = await getParallelLocalizedScreenshotUploadOptions(panel, status);
      if (options === null) return;

      setPanelMediaButtonsDisabled(true, localize("parallelLocalizedScreenshotsStarting", "Starting parallel localized screenshot upload..."));
      status.textContent = localize("parallelLocalizedScreenshotsStarting", "Starting parallel localized screenshot upload...");
      try {
        const response = await storePilotRuntimeSendMessage({
          type: "storepilot-start-localized-screenshot-parallel-upload",
          requestAccess: false,
          options
        });
        if (response && response.run) {
          updateParallelLocalizedScreenshotRunState(response.run);
        }
        status.textContent = response && response.message || localize("mediaUploadFailed", "Media upload failed: $1", [localize("unknown", "Unknown")]);
      } finally {
        updatePanelMediaUi();
      }
    }
  );
  uploadLocalizedScreenshotsParallelButton.dataset.storepilotAction = "upload-localizedScreenshotsParallel";
  const uploadSmallPromoButton = createMediaUploadButton("smallPromo", "uploadSmallPromo", "Upload small promo");
  const uploadMarqueePromoButton = createMediaUploadButton("marqueePromo", "uploadMarqueePromo", "Upload marquee promo");
  const clearScreenshotsButton = createMediaClearButton("screenshots", "clearScreenshots", "Clear screenshots");
  const clearStoreIconButton = createMediaClearButton("storeIcon", "clearStoreIcon", "Clear store icon");
  const clearSmallPromoButton = createMediaClearButton("smallPromo", "clearSmallPromo", "Clear small promo");
  const clearMarqueePromoButton = createMediaClearButton("marqueePromo", "clearMarqueePromo", "Clear marquee promo");
  const optionsButton = createButton(localize("options", "Options"), openOptionsPage);

  actions.append(
    createPanelActionGroup(fillCurrentButton, fillAllButton, selectCategoryButton),
    createPanelActionGroup(
      uploadStoreIconButton,
      uploadScreenshotsButton,
      uploadLocalizedScreenshotsButton,
      uploadLocalizedScreenshotsParallelButton,
      uploadSmallPromoButton,
      uploadMarqueePromoButton
    ),
    createPanelActionGroup(
      clearStoreIconButton,
      clearScreenshotsButton,
      clearSmallPromoButton,
      clearMarqueePromoButton
    ),
    createPanelActionGroup(fillAdditionalFieldsButton),
    createPanelActionGroup(abortButton, optionsButton)
  );

  panelControls.append(toggleModeButton, closeButton);
  header.append(title, panelControls);
  const parallelBoard = createParallelLocalizedScreenshotBoard();
  const workerProgressBoard = createLocalizedScreenshotWorkerProgressBoard();
  panel.append(header, meta, actions, parallelBoard, workerProgressBoard, status);
  document.documentElement.append(panel);
  renderParallelLocalizedScreenshotBoard(panel);
  renderLocalizedScreenshotWorkerProgressBoard(panel);
  applyPanelMode(panel, panelMode);
  applyStoredPanelPosition(panel);
  clampPanelToViewport(panel, false);
  bindPanelViewportClamp(panel);
  bindPanelMediaState(panel);
  enablePanelDrag(panel, title);
  updatePanelFillAllUi();
}
