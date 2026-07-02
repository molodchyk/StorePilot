function getMediaUploadKindLabel(kind) {
  if (kind === "screenshots") return localize("screenshots", "Screenshots");
  if (kind === "localizedScreenshots") return localize("localizedScreenshots", "Localized screenshots");
  if (kind === "storeIcon") return localize("storeIcon", "Store icon");
  if (kind === "smallPromo") return localize("smallPromoTile", "Small promo tile");
  if (kind === "marqueePromo") return localize("marqueePromoTile", "Marquee promo tile");
  return localize("media", "Media");
}

function setMediaOperationProgress(message) {
  mediaOperationState.label = message;
  const panelStatus = document.querySelector(`#${PANEL_ID} .storepilot-status`);
  if (panelStatus) {
    panelStatus.textContent = message;
  }
}

function isDashboardPageVisibleForMediaAutomation() {
  const hasVisibilityState = typeof document.visibilityState === "string" || typeof document.hidden === "boolean";
  const visibilityOk = !hasVisibilityState ||
    (document.visibilityState !== "hidden" && document.hidden !== true);
  const hasViewportSize = Number.isFinite(window.innerWidth) && Number.isFinite(window.innerHeight);
  const viewportOk = !hasViewportSize || (window.innerWidth > 0 && window.innerHeight > 0);
  return visibilityOk && viewportOk;
}

function getVisibleAutomationElapsedMs(startedAt, pollIntervalMs) {
  if (!isDashboardPageVisibleForMediaAutomation()) return 0;
  return Math.min(Math.max(0, Date.now() - startedAt), pollIntervalMs + 250);
}

async function requestMediaAutomationFocus() {
  const now = Date.now();
  if (now - lastMediaVisibilityFocusRequestAt < MEDIA_VISIBILITY_FOCUS_RETRY_MS) return;
  lastMediaVisibilityFocusRequestAt = now;

  try {
    const response = storePilotRuntimeSendMessage({ type: "storepilot-focus-dashboard-tab" });
    if (response && typeof response.catch === "function") {
      response.catch(() => {});
    }
  } catch (_error) {
    // Focusing is best-effort; the visible-tab wait below is the real guard.
  }
}

async function waitForMediaAutomationVisible(progress = null) {
  const hiddenStartedAt = Date.now();
  const maxHiddenWaitMs = progress && progress.mutationGateEnabled
    ? MEDIA_PARALLEL_VISIBILITY_MAX_HIDDEN_WAIT_MS
    : MEDIA_VISIBILITY_MAX_HIDDEN_WAIT_MS;

  while (!isDashboardPageVisibleForMediaAutomation()) {
    if (mediaOperationState.abortRequested) {
      return { ok: false, aborted: true };
    }

    const hiddenElapsedMs = Date.now() - hiddenStartedAt;
    if (hiddenElapsedMs >= maxHiddenWaitMs) {
      const timeoutMessage = `dashboard tab stayed hidden/minimized for ${formatLocalizedScreenshotElapsedTime(hiddenElapsedMs)}; retry unfinished locale(s) when visible`;
      if (progress) {
        setLocalizedScreenshotProgress(progress, timeoutMessage);
      } else {
        setMediaOperationProgress(`Media automation paused - ${timeoutMessage}`);
      }
      return {
        ok: false,
        aborted: false,
        hiddenTimeout: true,
        message: timeoutMessage
      };
    }

    const message = `paused; dashboard tab is hidden/minimized, waiting for it to be visible (${formatLocalizedScreenshotElapsedTime(hiddenElapsedMs)})`;
    if (progress) {
      setLocalizedScreenshotProgress(progress, message);
    } else {
      setMediaOperationProgress(`Media automation paused - ${message}`);
    }
    await requestMediaAutomationFocus();
    await delay(MEDIA_VISIBILITY_POLL_MS);
  }

  return { ok: true };
}

async function revealMediaRemoveControls(kind) {
  const targets = (kind === "localizedScreenshots"
    ? getLocalizedScreenshotMediaImages()
    : getMediaUploadWidgets(kind)
      .flatMap(widget => Array.from(widget.querySelectorAll("img")))
      .filter(image => isVisible(image) && image.getAttribute("src")))
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

function getVisibleDashboardStatusMessageText(pattern = null) {
  const elements = Array.from(document.querySelectorAll([
    "[role='alert']",
    "[aria-live]",
    ".VfPpkd-SnS2Cb",
    ".VfPpkd-Bz112c-LgbsSe"
  ].join(","))).filter(isVisible);

  return elements
    .map(getVisibleText)
    .filter(text => text && text.length <= 260)
    .find(text => !pattern || pattern.test(normalizeLanguageText(text))) || "";
}

function dismissVisibleDashboardStatusMessages() {
  Array.from(document.querySelectorAll("button,[role='button']"))
    .filter(isVisible)
    .filter(button => /^(dismiss|close|ok|schliessen|schlie en)$/.test(normalizeLanguageText(getVisibleText(button))))
    .forEach(button => activateDashboardButton(button));
}

function getMediaRemoveButtons(kind) {
  if (kind === "localizedScreenshots") {
    return getLocalizedScreenshotRemoveButtons();
  }

  const buttons = new Set();
  getMediaUploadWidgets(kind).forEach(widget => {
    Array.from(widget.querySelectorAll("[role='button'][aria-label], [jsname='LCoeQd']"))
      .forEach(button => buttons.add(button));
  });

  return Array.from(buttons)
    .filter(isMediaRemoveButton);
}

function hasClearableMedia(kind) {
  return getVisibleMediaImageCount(kind) > 0 || getMediaRemoveButtons(kind).length > 0;
}

async function waitForMediaRemovalAfterClick(kind, beforeCount, timeoutMs = MEDIA_REMOVAL_TIMEOUT_MS, options = {}) {
  const startedAt = Date.now();
  let visibleElapsedMs = 0;
  let lastConfirmAt = 0;

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
    if (getVisibleMediaImageCount(kind) < beforeCount) {
      return true;
    }

    if (kind === "localizedScreenshots" &&
      getVisibleDashboardStatusMessageText(/failed.*(delete|remove)|delete.*failed|remove.*failed|could not (delete|remove)|couldn t (delete|remove)/)) {
      dismissVisibleDashboardStatusMessages();
      return false;
    }

    const confirmButton = getVisibleDialogConfirmButton();
    if (confirmButton && Date.now() - lastConfirmAt > 300) {
      activateDashboardButton(confirmButton);
      lastConfirmAt = Date.now();
    }

    await delay(75);
    if (kind === "localizedScreenshots") {
      visibleElapsedMs += getVisibleAutomationElapsedMs(visibleTickStartedAt, 75);
    }
  }

  return false;
}

async function removeOneLocalizedScreenshotWithRetries(progress = null) {
  const label = getMediaUploadKindLabel("localizedScreenshots");
  let lastButtonLabel = label;

  for (let attempt = 1; attempt <= LOCALIZED_SCREENSHOT_DELETE_ATTEMPTS_PER_IMAGE; attempt++) {
    if (mediaOperationState.abortRequested) {
      return { ok: false, aborted: true, message: localize("operationStopped", "Stopped.") };
    }

    const beforeCount = getVisibleMediaImageCount("localizedScreenshots");
    if (!beforeCount) {
      return { ok: true, alreadyClear: true, removedCount: 0, label };
    }

    const visible = await waitForMediaAutomationVisible(progress);
    if (!visible.ok) {
      return {
        ok: false,
        aborted: Boolean(visible.aborted),
        hiddenTimeout: Boolean(visible.hiddenTimeout),
        message: visible.message || localize("operationStopped", "Stopped.")
      };
    }

    if (progress) {
      setLocalizedScreenshotProgress(progress, `clearing existing screenshots (visible ${beforeCount}, delete attempt ${attempt}/${LOCALIZED_SCREENSHOT_DELETE_ATTEMPTS_PER_IMAGE})`);
    }
    scrollMediaActionTargetIntoView(getLocalizedScreenshotActionElement());
    await revealMediaRemoveControls("localizedScreenshots");
    const buttons = getMediaRemoveButtons("localizedScreenshots");
    if (!buttons.length) {
      publishLocalizedScreenshotActionLog(progress, {
        action: "delete",
        stage: "result",
        attempt,
        outcome: "missing-remove-button",
        visibleBefore: beforeCount,
        durationMs: 0,
        message: `${label}: remove button not found`
      });
      return { ok: false, message: `${label}: remove button not found` };
    }

    const button = buttons[buttons.length - 1];
    lastButtonLabel = button.getAttribute("aria-label") || label;
    scrollMediaActionTargetIntoView(button);
    dismissVisibleDashboardStatusMessages();
    const mutationRequest = {
      action: "delete",
      attempt,
      visibleBefore: beforeCount,
      targetSlot: beforeCount,
      buttonLabel: lastButtonLabel
    };
    const lease = await acquireLocalizedScreenshotMutationLease(progress, mutationRequest);
    if (!lease.ok) {
      return {
        ok: false,
        aborted: Boolean(lease.aborted),
        message: lease.message || `${label}: media mutation gate did not grant a delete lease`
      };
    }
    const actionStartedAt = Date.now();
    let releaseResult = {
      outcome: "exception",
      visibleBefore: beforeCount,
      targetSlot: beforeCount,
      buttonLabel: lastButtonLabel,
      durationMs: 0
    };

    try {
      publishLocalizedScreenshotActionLog(progress, {
        action: "delete",
        stage: "attempt",
        attempt,
        visibleBefore: beforeCount,
        targetSlot: beforeCount,
        buttonLabel: lastButtonLabel,
        leaseId: lease.leaseId || "",
        waitMs: Number.isFinite(Number(lease.waitMs)) ? Number(lease.waitMs) : null
      });
      activateDashboardButton(button);

      const changed = await waitForMediaRemovalAfterClick(
        "localizedScreenshots",
        beforeCount,
        LOCALIZED_SCREENSHOT_DELETE_ATTEMPT_TIMEOUT_MS,
        { progress, errorState: releaseResult }
      );
      if (!changed && releaseResult.hiddenTimeout) {
        releaseResult = {
          ...releaseResult,
          outcome: "hidden-timeout",
          durationMs: Date.now() - actionStartedAt
        };
        return {
          ok: false,
          aborted: false,
          hiddenTimeout: true,
          message: releaseResult.message || `${label}: dashboard tab stayed hidden/minimized`
        };
      }
      const afterCount = getVisibleMediaImageCount("localizedScreenshots");
      if (changed || afterCount < beforeCount) {
        releaseResult = {
          outcome: "removed",
          visibleBefore: beforeCount,
          visibleAfter: afterCount,
          removedCount: Math.max(1, beforeCount - afterCount),
          targetSlot: beforeCount,
          buttonLabel: lastButtonLabel,
          durationMs: Date.now() - actionStartedAt
        };
        publishLocalizedScreenshotActionLog(progress, {
          action: "delete",
          stage: "result",
          attempt,
          outcome: releaseResult.outcome,
          visibleBefore: releaseResult.visibleBefore,
          visibleAfter: releaseResult.visibleAfter,
          removedCount: releaseResult.removedCount,
          targetSlot: releaseResult.targetSlot,
          buttonLabel: releaseResult.buttonLabel,
          leaseId: lease.leaseId || "",
          durationMs: releaseResult.durationMs
        });
        return {
          ok: true,
          removedCount: Math.max(1, beforeCount - afterCount),
          label: lastButtonLabel
        };
      }

      releaseResult = {
        outcome: "unchanged",
        visibleBefore: beforeCount,
        visibleAfter: afterCount,
        targetSlot: beforeCount,
        buttonLabel: lastButtonLabel,
        durationMs: Date.now() - actionStartedAt
      };
      publishLocalizedScreenshotActionLog(progress, {
        action: "delete",
        stage: "result",
        attempt,
        outcome: releaseResult.outcome,
        visibleBefore: releaseResult.visibleBefore,
        visibleAfter: releaseResult.visibleAfter,
        targetSlot: releaseResult.targetSlot,
        buttonLabel: releaseResult.buttonLabel,
        leaseId: lease.leaseId || "",
        durationMs: releaseResult.durationMs
      });
    } finally {
      await releaseLocalizedScreenshotMutationLease(progress, lease, mutationRequest, releaseResult);
    }

    dismissVisibleDashboardStatusMessages();
    if (attempt < LOCALIZED_SCREENSHOT_DELETE_ATTEMPTS_PER_IMAGE) {
      await delay(LOCALIZED_SCREENSHOT_RETRY_DELAY_MS);
    }
  }

  return {
    ok: false,
    message: `${lastButtonLabel}: CWS did not remove the image after ${LOCALIZED_SCREENSHOT_DELETE_ATTEMPTS_PER_IMAGE} attempt(s)`
  };
}

async function performClearLocalizedScreenshotAssets(options = {}) {
  const removed = [];
  const failed = [];
  let aborted = false;
  let hiddenTimeout = false;
  const label = getMediaUploadKindLabel("localizedScreenshots");
  const progress = options.localizedProgress || null;

  for (let attempt = 0; attempt < 8; attempt++) {
    if (mediaOperationState.abortRequested) {
      aborted = true;
      break;
    }

    const beforeCount = getVisibleMediaImageCount("localizedScreenshots");
    if (!beforeCount) break;

    const removal = await removeOneLocalizedScreenshotWithRetries(progress);
    if (removal.aborted) {
      aborted = true;
      break;
    }
    if (removal.hiddenTimeout) {
      hiddenTimeout = true;
      failed.push(removal.message || `${label}: dashboard tab stayed hidden/minimized`);
      break;
    }
    if (!removal.ok) {
      failed.push(removal.message || `${label}: CWS did not remove the image`);
      break;
    }
    if (removal.alreadyClear) break;

    for (let index = 0; index < removal.removedCount; index++) {
      removed.push(removal.label);
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
    hiddenTimeout,
    message: messageParts.join(" "),
    removed,
    failed,
    diagnostics: {
      mediaUploadTargets: getMediaUploadDiagnostics()
    }
  };
}

async function performClearDashboardMediaAssets(kind, options = {}) {
  if (kind === "localizedScreenshots") {
    return performClearLocalizedScreenshotAssets(options);
  }

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

    const changed = await waitForMediaRemovalAfterClick(kind, beforeCount);
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
