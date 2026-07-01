async function waitForMediaUploadUiChange(kind, beforeCount, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_MEDIA_UPLOAD_TIMEOUT_MS;
  const expectedCount = Number.isFinite(options.expectedCount) ? options.expectedCount : beforeCount + 1;
  const startedAt = Date.now();
  let visibleElapsedMs = 0;
  let firstIncreaseAt = 0;
  const pollIntervalMs = kind === "localizedScreenshots" ? 100 : 500;

  while (kind === "localizedScreenshots" ? visibleElapsedMs < timeoutMs : Date.now() - startedAt < timeoutMs) {
    if (kind === "localizedScreenshots") {
      const visible = await waitForMediaAutomationVisible(options.progress || null);
      if (!visible.ok) {
        if (options.errorState) {
          options.errorState.hiddenTimeout = Boolean(visible.hiddenTimeout);
          options.errorState.message = visible.message || "";
        }
        return false;
      }
    }
    const visibleTickStartedAt = Date.now();
    const nextCount = getVisibleMediaImageCount(kind);
    const reachedExpectedCount = nextCount >= expectedCount || nextCount > beforeCount;

    if (reachedExpectedCount && !firstIncreaseAt) {
      firstIncreaseAt = Date.now();
    }

    if (kind === "localizedScreenshots" && nextCount >= expectedCount) {
      return true;
    }

    if (kind === "localizedScreenshots" &&
      nextCount <= beforeCount &&
      getVisibleDashboardStatusMessageText(/failed.*(upload|add)|upload.*failed|could not upload|couldn t upload|image upload failed/)) {
      dismissVisibleDashboardStatusMessages();
      return false;
    }

    if (kind === "localizedScreenshots" && nextCount <= beforeCount) {
      const localizedUploadError = getLocalizedScreenshotUploadErrorMessage();
      if (localizedUploadError) {
        if (options.errorState) {
          options.errorState.message = localizedUploadError;
        }
        dismissLocalizedScreenshotUploadErrors();
        return false;
      }
    }

    if (reachedExpectedCount && !hasMediaUploadInProgress(kind)) {
      return true;
    }

    if (reachedExpectedCount && Date.now() - firstIncreaseAt > 5000) {
      return true;
    }

    await delay(pollIntervalMs);
    if (kind === "localizedScreenshots") {
      visibleElapsedMs += getVisibleAutomationElapsedMs(visibleTickStartedAt, pollIntervalMs);
    }
  }

  return false;
}

function getAvailableMediaUploadInput(kind) {
  if (kind === "localizedScreenshots") {
    const target = getLocalizedScreenshotUploadTargets()
      .find(candidate => candidate.input && !candidate.input.disabled);
    if (!target) return null;
    return {
      widget: target.uploadWidget || target.widget,
      input: target.input
    };
  }

  return getMediaUploadWidgets(kind)
    .map(widget => ({
      widget,
      input: widget.querySelector("input[type='file']")
    }))
    .find(target => target.input && !target.input.disabled);
}

async function waitForAvailableMediaUploadInput(kind, timeoutMs = LOCALIZED_SCREENSHOT_TARGET_READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  let target = getAvailableMediaUploadInput(kind);
  const pollIntervalMs = kind === "localizedScreenshots" ? 100 : 500;

  while (!target && Date.now() - startedAt < timeoutMs) {
    await delay(pollIntervalMs);
    target = getAvailableMediaUploadInput(kind);
  }

  return target;
}

async function waitForLocalizedScreenshotFieldReady(timeoutMs = LOCALIZED_SCREENSHOT_TARGET_READY_TIMEOUT_MS) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const uploadTarget = getAvailableMediaUploadInput("localizedScreenshots");
    const widgets = getMediaUploadWidgets("localizedScreenshots");
    if (uploadTarget || widgets.length) {
      return {
        ok: true,
        uploadTarget,
        widgets
      };
    }
    await delay(100);
  }

  return {
    ok: false,
    uploadTarget: null,
    widgets: []
  };
}

async function waitForVisibleMediaImageCount(kind, expectedCount, timeoutMs = MEDIA_REMOVAL_TIMEOUT_MS, options = {}) {
  const startedAt = Date.now();
  let visibleElapsedMs = 0;
  let matchedAt = 0;
  let currentCount = getVisibleMediaImageCount(kind);
  const pollIntervalMs = kind === "localizedScreenshots" ? 100 : 300;

  while (kind === "localizedScreenshots" ? visibleElapsedMs < timeoutMs : Date.now() - startedAt < timeoutMs) {
    if (kind === "localizedScreenshots") {
      const visible = await waitForMediaAutomationVisible(options.progress || null);
      if (!visible.ok) {
        return {
          ok: false,
          count: getVisibleMediaImageCount(kind),
          hiddenTimeout: Boolean(visible.hiddenTimeout),
          message: visible.message || ""
        };
      }
    }
    const visibleTickStartedAt = Date.now();
    currentCount = getVisibleMediaImageCount(kind);
    if (currentCount === expectedCount) {
      if (kind === "localizedScreenshots") {
        return { ok: true, count: currentCount };
      }
      if (!matchedAt) matchedAt = Date.now();
      if (!hasMediaUploadInProgress(kind) || Date.now() - matchedAt > 1500) {
        return { ok: true, count: currentCount };
      }
    } else {
      matchedAt = 0;
    }
    await delay(pollIntervalMs);
    if (kind === "localizedScreenshots") {
      visibleElapsedMs += getVisibleAutomationElapsedMs(visibleTickStartedAt, pollIntervalMs);
    }
  }

  return { ok: false, count: getVisibleMediaImageCount(kind) };
}
