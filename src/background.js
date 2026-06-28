(function () {
  function text(key, fallback, substitutions) {
    return typeof storePilotText === "function" ? storePilotText(key, fallback, substitutions) : substitutions
      ? substitutions.reduce((message, value, index) => message.replace(`$${index + 1}`, value), fallback)
      : fallback;
  }

  function handleUploadMediaMessage(message, sender, sendResponse) {
    storePilotUploadMediaToDashboard(sender, Boolean(message.requestAccess), message.kind || "", message.options || {})
      .then(sendResponse)
      .catch(error => sendResponse({
        ok: false,
        message: text("mediaUploadFailed", "Media upload failed: $1", [error.message || String(error)])
      }));
    return true;
  }

  function handleStartParallelLocalizedScreenshotUploadMessage(message, sender, sendResponse) {
    storePilotStartParallelLocalizedScreenshotUpload(sender, Boolean(message.requestAccess), message.options || {})
      .then(sendResponse)
      .catch(error => sendResponse({
        ok: false,
        message: text("mediaUploadFailed", "Media upload failed: $1", [error.message || String(error)])
      }));
    return true;
  }

  function handleAbortParallelLocalizedScreenshotUploadMessage(message, sender, sendResponse) {
    storePilotAbortParallelLocalizedScreenshotUpload(sender, message.runId || "")
      .then(sendResponse)
      .catch(error => sendResponse({
        ok: false,
        message: error.message || String(error)
      }));
    return true;
  }

  function handleRetryParallelLocalizedScreenshotUploadMessage(message, sender, sendResponse) {
    storePilotRetryParallelLocalizedScreenshotFailed(sender, message.runId || "", message.options || {})
      .then(sendResponse)
      .catch(error => sendResponse({
        ok: false,
        message: error.message || String(error)
      }));
    return true;
  }

  function handleLocalizedScreenshotProgressMessage(message, sender, sendResponse) {
    storePilotHandleLocalizedScreenshotProgress(sender, message)
      .then(sendResponse)
      .catch(error => sendResponse({
        ok: false,
        message: error.message || String(error)
      }));
    return true;
  }

  function handleLocalizedScreenshotActionLogMessage(message, sender, sendResponse) {
    storePilotHandleLocalizedScreenshotActionLog(sender, message)
      .then(sendResponse)
      .catch(error => sendResponse({
        ok: false,
        message: error.message || String(error)
      }));
    return true;
  }

  function handleFocusDashboardTabMessage(sender, sendResponse) {
    const tab = sender && sender.tab;
    if (!tab || tab.id === undefined || tab.id === null) {
      sendResponse({
        ok: false,
        message: text("noActiveTab", "No active tab.")
      });
      return false;
    }

    Promise.resolve()
      .then(async () => {
        const tasks = [];
        if (tab.windowId !== undefined && tab.windowId !== null) {
          tasks.push(
            storePilotWindowsUpdate(tab.windowId, { focused: true, state: "normal" })
              .catch(() => storePilotWindowsUpdate(tab.windowId, { focused: true }).catch(() => null))
          );
        }
        tasks.push(storePilotTabsUpdate(tab.id, { active: true }).catch(() => null));
        await Promise.all(tasks);
        return {
          ok: true,
          message: "Dashboard tab focused."
        };
      })
      .then(sendResponse)
      .catch(error => sendResponse({
        ok: false,
        message: error.message || String(error)
      }));
    return true;
  }

  function handleActionClick() {
    storePilotTabsQuery({ active: true, currentWindow: true }).then(async tabs => {
      const tab = tabs && tabs[0];
      const url = tab && tab.url ? tab.url : "";
      const isDevConsole = url.includes("/devconsole/");
      const isWebstore = url.includes("chrome.google.com/webstore") || url.includes("chromewebstore.google.com");
      const isOptions = url.includes("src/options/options.html");

      if (isDevConsole) {
        if (storePilotActionCanOpenPopup()) {
          await storePilotActionSetPopup({ tabId: tab.id, popup: "src/popup/popup.html" });
          await storePilotActionOpenPopup();
        } else {
          await storePilotRuntimeOpenOptionsPage();
        }
        return;
      }

      if (!(isWebstore && !isDevConsole) && !isOptions) {
        await storePilotRuntimeOpenOptionsPage();
      }
    }).catch(() => {});
  }

  storePilotRuntimeOnMessageAddListener((message, sender, sendResponse) => {
    if (message && message.action === "openOptionsPage") {
      storePilotRuntimeOpenOptionsPage();
      sendResponse({ ok: true });
    }

    if (message && message.type === "storepilot-upload-media-assets-from-project") {
      return handleUploadMediaMessage(message, sender, sendResponse);
    }

    if (message && message.type === "storepilot-start-localized-screenshot-parallel-upload") {
      return handleStartParallelLocalizedScreenshotUploadMessage(message, sender, sendResponse);
    }

    if (message && message.type === "storepilot-abort-localized-screenshot-parallel-upload") {
      return handleAbortParallelLocalizedScreenshotUploadMessage(message, sender, sendResponse);
    }

    if (message && message.type === "storepilot-retry-localized-screenshot-parallel-failed") {
      return handleRetryParallelLocalizedScreenshotUploadMessage(message, sender, sendResponse);
    }

    if (message && message.type === "storepilot-localized-screenshot-progress") {
      return handleLocalizedScreenshotProgressMessage(message, sender, sendResponse);
    }

    if (message && message.type === "storepilot-localized-screenshot-action-log") {
      return handleLocalizedScreenshotActionLogMessage(message, sender, sendResponse);
    }

    if (message && message.type === "storepilot-get-localized-screenshot-parallel-run") {
      sendResponse(storePilotGetParallelLocalizedScreenshotRun(sender, message.runId || ""));
      return false;
    }

    if (message && message.type === "storepilot-get-localized-screenshot-parallel-log") {
      sendResponse(storePilotGetParallelLocalizedScreenshotLog(sender, message.runId || ""));
      return false;
    }

    if (message && message.type === "storepilot-focus-dashboard-tab") {
      return handleFocusDashboardTabMessage(sender, sendResponse);
    }
  });

  storePilotActionOnClickedAddListener(handleActionClick);
})();
