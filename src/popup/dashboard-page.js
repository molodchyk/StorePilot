async function getActiveTab() {
  const [tab] = await storePilotTabsQuery({ active: true, currentWindow: true });
  return tab;
}

async function injectContentScript(tabId) {
  await storePilotScriptingExecuteScript({
    target: { tabId },
    files: [
      "src/platform/webextension/core.js",
      "src/platform/webextension/storage.js",
      "src/platform/webextension/tabs.js",
      "src/platform/webextension/runtime.js",
      "src/platform/webextension/scripting.js",
      "src/platform/webextension/action.js",
      "src/platform/webextension/i18n.js",
      "src/shared/constants.js",
      "src/shared/i18n.js",
      "src/shared/projects.js",
      "src/shared/dashboard-url.js",
      "src/shared/storage.js",
      "src/shared/store-docs/privacy-schema.js",
      "src/shared/store-docs/privacy-doc.js",
      "src/shared/store-docs/category-doc.js",
      "src/content/dashboard-dom.js",
      "src/content/dashboard-project-context.js",
      "src/content/language/locale.js",
      "src/content/dashboard-category.js",
      "src/content/language/picker.js",
      "src/content/language/description-fill.js",
      "src/content/dashboard-additional-fields.js",
      "src/content/dashboard-privacy-core.js",
      "src/content/dashboard-privacy-data-usage.js",
      "src/content/dashboard-privacy-fields.js",
      "src/content/dashboard-media.js",
      "src/content/panel/state.js",
      "src/content/panel/render.js",
      "src/content/dashboard-panel-styles.js",
      "src/content/dashboard-helper.js",
      "src/content/dashboard-messages.js"
    ]
  });
}

async function sendToActiveTab(typeOrMessage) {
  const tab = await getActiveTab();
  const message = typeof typeOrMessage === "string" ? { type: typeOrMessage } : typeOrMessage;
  const type = message && message.type;
  if (!tab || !tab.id) {
    return { ok: false, message: t("noActiveTab", "No active tab.") };
  }

  const diagnostics = {
    action: type,
    tabId: tab.id,
    url: tab.url || "",
    expectedDashboardUrl: storePilotIsDeveloperDashboardUrl(tab.url || "")
  };

  if (!diagnostics.expectedDashboardUrl) {
    return {
      ok: false,
      message: t("notDashboardPage", "The active tab is not a Chrome Web Store Developer Dashboard page."),
      diagnostics
    };
  }

  try {
    const response = await storePilotTabsSendMessage(tab.id, message);
    return { ...response, diagnostics: { ...diagnostics, contentScript: t("contentScriptAlreadyConnected", "already connected"), response } };
  } catch (error) {
    diagnostics.initialMessageError = formatError(error);

    try {
      await injectContentScript(tab.id);
      diagnostics.injection = t("injectionSucceeded", "succeeded");
      const response = await storePilotTabsSendMessage(tab.id, message);
      return { ...response, diagnostics: { ...diagnostics, response } };
    } catch (injectionError) {
      diagnostics.injectionError = formatError(injectionError);
      return {
        ok: false,
        message: t("couldNotConnectDashboard", "StorePilot could not connect to this dashboard tab. Open Diagnostics for the exact error."),
        diagnostics
      };
    }
  }
}

async function getDashboardProjectContext(tab) {
  const url = tab && tab.url ? tab.url : "";
  const context = {
    url,
    extensionId: typeof storePilotGetDashboardExtensionIdFromUrl === "function"
      ? storePilotGetDashboardExtensionIdFromUrl(url)
      : "",
    title: ""
  };

  if (!context.extensionId || !tab || !tab.id) return context;

  try {
    const result = await sendToActiveTab("storepilot-get-project-context");
    if (result && result.ok && result.context) {
      context.extensionId = result.context.extensionId || context.extensionId;
      context.title = result.context.dashboardItemTitle || "";
    }
  } catch (_error) {
    // The URL id is enough when the dashboard helper is not ready yet.
  }

  return context;
}

async function resolvePopupProject() {
  const { projects, activeProjectId } = await storePilotGetProjectsState();
  const tab = await getActiveTab().catch(() => null);
  const context = tab && storePilotIsDeveloperDashboardUrl(tab.url || "")
    ? await getDashboardProjectContext(tab)
    : { url: tab && tab.url || "", extensionId: "", title: "" };
  const bindings = typeof storePilotGetDashboardProjectBindings === "function"
    ? await storePilotGetDashboardProjectBindings()
    : {};
  const resolved = typeof storePilotResolveDashboardProjectFromState === "function"
    ? storePilotResolveDashboardProjectFromState({ projects, activeProjectId }, bindings, context)
    : {
      project: projects.find(project => project.id === activeProjectId) || projects[0] || null,
      extensionId: context.extensionId,
      source: "active"
    };

  if (resolved.source === "title" && resolved.extensionId && resolved.project && typeof storePilotBindDashboardProject === "function") {
    await storePilotBindDashboardProject(resolved.extensionId, resolved.project.id, {
      dashboardItemTitle: context.title || "",
      source: "title"
    });
  }

  return {
    projects,
    project: resolved.project || null,
    dashboardExtensionId: resolved.extensionId || context.extensionId || "",
    dashboardProjectSource: resolved.source || "none"
  };
}

async function updateDashboardSectionUi() {
  const tab = await getActiveTab();
  const section = tab && storePilotIsDeveloperDashboardUrl(tab.url || "")
    ? storePilotGetDashboardSectionFromUrl(tab.url || "")
    : "other";
  const isListing = section === "listing";
  const isPrivacy = section === "privacy";

  setPopupListingActionsVisible(isListing);
  setPopupPrivacyActionsVisible(isPrivacy);

  if (!storePilotIsPanelDashboardUrl(tab && tab.url || "")) {
    elements.openPanel.hidden = true;
    getPopupMediaButtons().forEach(button => {
      button.disabled = true;
      button.title = "";
    });
  }
  syncUtilityActionsVisibility();
}

async function uploadMediaFromPopup(kind) {
  const injection = await sendToActiveTab("storepilot-reload");
  if (!injection.ok) return injection;

  return storePilotRuntimeSendMessage({
    type: "storepilot-upload-media-assets-from-project",
    requestAccess: true,
    kind
  });
}

async function updateMediaActionState() {
  const tab = await getActiveTab();
  if (!tab || !storePilotIsListingDashboardUrl(tab.url || "")) {
    getPopupMediaButtons().forEach(button => {
      button.disabled = true;
      button.title = t("listingActionsOnlyOnListingPage", "Listing and media actions are only available on the Store listing page.");
    });
    return;
  }

  const result = await sendToActiveTab("storepilot-get-media-state");
  if (!result.ok || !result.media) return;

  if (result.media.running) {
    setPopupMediaRunning(true, result.media.runningLabel || t("mediaOperationInProgress", "Media operation in progress."));
    return;
  }

  setPopupMediaRunning(false);
  const clearableScreenshots = Boolean(result.media.clearableScreenshots || Number(result.media.screenshots || 0) > 0);
  const clearableStoreIcon = Boolean(result.media.clearableStoreIcon || Number(result.media.storeIcon || 0) > 0);
  const clearableSmallPromo = Boolean(result.media.clearableSmallPromo || Number(result.media.smallPromo || 0) > 0);
  const clearableMarqueePromo = Boolean(result.media.clearableMarqueePromo || Number(result.media.marqueePromo || 0) > 0);
  const screenshotsLimitReached = Boolean(result.media.screenshotsLimitReached);
  const maxScreenshots = String(result.media.maxScreenshots || 5);
  const storeIconPresent = Boolean(result.media.storeIconPresent || Number(result.media.storeIcon || 0) > 0);
  const smallPromoPresent = Boolean(result.media.smallPromoPresent || Number(result.media.smallPromo || 0) > 0);
  const marqueePromoPresent = Boolean(result.media.marqueePromoPresent || Number(result.media.marqueePromo || 0) > 0);

  elements.uploadScreenshots.disabled = screenshotsLimitReached;
  elements.uploadScreenshots.title = screenshotsLimitReached
    ? t("screenshotsLimitReached", "screenshots: CWS limit of $1 already reached", [maxScreenshots])
    : "";
  elements.uploadStoreIcon.disabled = storeIconPresent;
  elements.uploadStoreIcon.title = storeIconPresent
    ? t("mediaAlreadyPresentOrProcessing", "$1 already present or processing.", [t("storeIcon", "Store icon")])
    : "";
  elements.clearScreenshots.disabled = !clearableScreenshots;
  elements.clearScreenshots.title = clearableScreenshots
    ? ""
    : t("mediaAlreadyClearKind", "$1 already clear.", [t("screenshots", "Screenshots")]);
  elements.clearStoreIcon.disabled = !clearableStoreIcon;
  elements.clearStoreIcon.title = clearableStoreIcon
    ? ""
    : t("mediaAlreadyClearKind", "$1 already clear.", [t("storeIcon", "Store icon")]);
  elements.clearSmallPromo.disabled = !clearableSmallPromo;
  elements.clearSmallPromo.title = clearableSmallPromo
    ? ""
    : t("mediaAlreadyClearKind", "$1 already clear.", [t("smallPromoTile", "Small promo tile")]);
  elements.clearMarqueePromo.disabled = !clearableMarqueePromo;
  elements.clearMarqueePromo.title = clearableMarqueePromo
    ? ""
    : t("mediaAlreadyClearKind", "$1 already clear.", [t("marqueePromoTile", "Marquee promo tile")]);

  elements.uploadSmallPromo.disabled = smallPromoPresent;
  elements.uploadSmallPromo.title = smallPromoPresent
    ? t("mediaAlreadyPresentOrProcessing", "$1 already present or processing.", [t("smallPromoTile", "Small promo tile")])
    : "";
  elements.uploadMarqueePromo.disabled = marqueePromoPresent;
  elements.uploadMarqueePromo.title = marqueePromoPresent
    ? t("mediaAlreadyPresentOrProcessing", "$1 already present or processing.", [t("marqueePromoTile", "Marquee promo tile")])
    : "";
}

async function updateOpenPanelButtonState() {
  const tab = await getActiveTab();
  if (!tab || !storePilotIsPanelDashboardUrl(tab.url || "")) {
    elements.openPanel.hidden = true;
    syncUtilityActionsVisibility();
    return;
  }

  const result = await sendToActiveTab("storepilot-get-panel-state");
  const isVisible = Boolean(result && result.ok && result.panel && result.panel.visible);
  elements.openPanel.hidden = isVisible;
  elements.openPanel.disabled = false;
  elements.openPanel.title = "";
  syncUtilityActionsVisibility();
}

async function clearMediaFromPopup(kind) {
  const injection = await sendToActiveTab("storepilot-reload");
  if (!injection.ok) return injection;

  return sendToActiveTab({
    type: "storepilot-clear-media-assets",
    kind
  });
}
