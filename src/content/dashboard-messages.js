storePilotRuntimeOnMessageAddListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "storepilot-copy") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse(await copySelectedText());
      return;
    }

    if (message.type === "storepilot-fill") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse(fillSelectedText());
      return;
    }

    if (message.type === "storepilot-fill-current-language") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse(await fillCurrentDashboardLanguage());
      return;
    }

    if (message.type === "storepilot-select-category") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse(await selectDashboardCategory());
      return;
    }

    if (message.type === "storepilot-fill-additional-fields") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse(await fillDetectedAdditionalFields());
      return;
    }

    if (message.type === "storepilot-fill-all-languages") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      await loadSettings();
      renderPanel(await loadListings());
      if (isFillingAllLanguages) {
        sendResponse({ ok: false, message: localize("fillAllAlreadyRunning", "Description fill is already running.") });
        return;
      }

      isFillingAllLanguages = true;
      fillAllAbortRequested = false;
      await publishFillAllStatus({
        running: true,
        message: localize("fillingAllLanguages", "Filling descriptions...")
      });
      renderPanel(Object.keys(listings).sort((a, b) => a.localeCompare(b)));

      let result;
      try {
        result = await fillAllDashboardLanguages();
      } finally {
        isFillingAllLanguages = false;
      }
      await publishFillAllStatus({
        running: false,
        message: result ? result.message : localize("fillAllStopped", "Description fill stopped.")
      });
      renderPanel(Object.keys(listings).sort((a, b) => a.localeCompare(b)));
      sendResponse(result || { ok: false, message: localize("fillAllStopped", "Description fill stopped.") });
      return;
    }

    if (message.type === "storepilot-get-fill-all-status") {
      sendResponse({
        ok: true,
        status: {
          ...fillAllStatus,
          running: isFillingAllLanguages
        }
      });
      return;
    }

    if (message.type === "storepilot-abort-operation" || message.type === "storepilot-abort-fill-all") {
      sendResponse(abortCurrentOperation());
      return;
    }

    if (message.type === "storepilot-upload-media-assets") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      sendResponse(await uploadDashboardMediaAssets(message.files || {}, message.kind || ""));
      return;
    }

    if (message.type === "storepilot-clear-media-assets") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      sendResponse(await clearDashboardMediaAssets(message.kind || "screenshots"));
      return;
    }

    if (message.type === "storepilot-get-media-state") {
      if (!isListingDashboardSection()) {
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      sendResponse({
        ok: true,
        media: getDashboardMediaState()
      });
      return;
    }

    if (message.type === "storepilot-get-panel-state") {
      sendResponse({
        ok: true,
        panel: getPanelState()
      });
      return;
    }

    if (message.type === "storepilot-get-project-context") {
      await loadListings();
      sendResponse({
        ok: true,
        context: {
          extensionId: activeDashboardExtensionId || storePilotGetDashboardExtensionId(),
          dashboardItemTitle: activeDashboardItemTitle || storePilotGetDashboardItemTitle(),
          projectId: activeProjectId,
          projectName: activeProjectName,
          projectSource: activeDashboardProjectSource
        }
      });
      return;
    }

    if (message.type === "storepilot-show-panel") {
      if (!isPanelDashboardSection()) {
        removePanel();
        sendResponse(createWrongDashboardSectionResult());
        return;
      }
      savePanelMode("expanded");
      injectStyles();
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse({ ok: true, message: localize("panelOpened", "Panel opened.") });
      return;
    }

    if (message.type === "storepilot-fill-privacy") {
      if (!isPrivacyDashboardSection()) {
        sendResponse({
          ok: false,
          message: localize("privacyActionsOnlyOnPrivacyPage", "Privacy actions are only available on the Privacy page.")
        });
        return;
      }
      await loadSettings();
      await loadListings();
      renderPanel(Object.keys(listings).sort((a, b) => a.localeCompare(b)));
      sendResponse(fillDetectedPrivacyFields());
      return;
    }

    if (message.type === "storepilot-fill-privacy-field") {
      if (!isPrivacyDashboardSection()) {
        sendResponse({
          ok: false,
          message: localize("privacyActionsOnlyOnPrivacyPage", "Privacy actions are only available on the Privacy page.")
        });
        return;
      }
      await loadSettings();
      await loadListings();
      renderPanel(Object.keys(listings).sort((a, b) => a.localeCompare(b)));
      sendResponse(fillPrivacyField(String(message.key || "")));
      return;
    }

    if (message.type === "storepilot-fill-data-usage") {
      if (!isPrivacyDashboardSection()) {
        sendResponse({
          ok: false,
          message: localize("privacyActionsOnlyOnPrivacyPage", "Privacy actions are only available on the Privacy page.")
        });
        return;
      }
      await loadSettings();
      await loadListings();
      renderPanel(Object.keys(listings).sort((a, b) => a.localeCompare(b)));
      sendResponse(fillPrivacyDataUsage());
      return;
    }

    if (message.type === "storepilot-reload") {
      await loadSettings();
      renderPanel(await loadListings());
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "storepilot-diagnose") {
      await loadSettings();
      renderPanel(await loadListings());
      if (isPrivacyDashboardSection()) {
        const diagnostics = getPrivacyDiagnostics();
        sendResponse({
          ok: Boolean(diagnostics.fieldCandidates.length),
          message: localize("privacyDiagnosticsSummary", "Found $1 editable privacy candidate(s).", [String(diagnostics.fieldCandidates.length)]),
          diagnostics
        });
        return;
      }
      sendResponse(await diagnoseDashboardPage());
    }
  })();

  return true;
});
