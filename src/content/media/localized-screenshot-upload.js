async function uploadLocalizedScreenshotFileWithRetries(entry, fileIndex, localizedUploadTarget, progress) {
  const file = entry.files[fileIndex];
  let target = localizedUploadTarget;
  let lastMessage = "";

  for (let uploadAttempt = 1; uploadAttempt <= LOCALIZED_SCREENSHOT_UPLOAD_ATTEMPTS_PER_FILE; uploadAttempt++) {
    if (mediaOperationState.abortRequested) {
      return { ok: false, aborted: true, message: localize("operationStopped", "Stopped."), target };
    }

    const visible = await waitForMediaAutomationVisible(progress);
    if (!visible.ok) {
      return {
        ok: false,
        aborted: Boolean(visible.aborted),
        hiddenTimeout: Boolean(visible.hiddenTimeout),
        message: visible.message || localize("operationStopped", "Stopped."),
        target
      };
    }

    let currentCount = getVisibleMediaImageCount("localizedScreenshots");
    setLocalizedScreenshotProgress(progress, `uploading screenshot ${fileIndex + 1}/${entry.files.length} (attempt ${uploadAttempt}/${LOCALIZED_SCREENSHOT_UPLOAD_ATTEMPTS_PER_FILE}, visible ${currentCount})`);

    if (!isDashboardLocaleSelected(entry.locale)) {
      setLocalizedScreenshotProgress(progress, `dashboard locale changed; re-selecting ${entry.locale} before screenshot ${fileIndex + 1}/${entry.files.length}`);
      const uploadContext = await ensureLocalizedScreenshotUploadContext(entry.locale);
      if (!uploadContext.ok) {
        return {
          ok: false,
          message: `${entry.locale} screenshot ${fileIndex + 1}: ${uploadContext.message}`,
          target
        };
      }
      target = uploadContext.fieldReady && uploadContext.fieldReady.uploadTarget ||
        getAvailableMediaUploadInput("localizedScreenshots");
      currentCount = getVisibleMediaImageCount("localizedScreenshots");
    }

    if (currentCount >= MAX_DASHBOARD_SCREENSHOTS) {
      return {
        ok: false,
        message: `${entry.locale}: localized screenshots already show the CWS limit of ${MAX_DASHBOARD_SCREENSHOTS}`,
        target
      };
    }

    target = await resolveLocalizedScreenshotUploadTarget(target);
    if (!target) {
      return { ok: false, message: `${entry.locale}: localized screenshot upload target not found`, target };
    }

    let actionStartedAt = Date.now();
    let lease = null;
    let mutationRequest = null;
    let releaseResult = null;
    try {
      dismissVisibleDashboardStatusMessages();
      dismissLocalizedScreenshotUploadErrors();
      const beforeCount = getVisibleMediaImageCount("localizedScreenshots");
      const errorState = {};
      actionStartedAt = Date.now();
      mutationRequest = {
        action: "upload",
        attempt: uploadAttempt,
        screenshotSlot: fileIndex + 1,
        visibleBefore: beforeCount,
        fileName: file && file.name || "",
        fileSize: file && file.size || 0,
        fileType: file && file.type || ""
      };
      lease = await acquireLocalizedScreenshotMutationLease(progress, mutationRequest);
      if (!lease.ok) {
        return {
          ok: false,
          aborted: Boolean(lease.aborted),
          message: lease.message || `${entry.locale} screenshot ${fileIndex + 1}: media mutation gate did not grant an upload lease`,
          target
        };
      }
      publishLocalizedScreenshotActionLog(progress, {
        action: "upload",
        stage: "attempt",
        attempt: uploadAttempt,
        screenshotSlot: fileIndex + 1,
        visibleBefore: beforeCount,
        fileName: file && file.name || "",
        fileSize: file && file.size || 0,
        fileType: file && file.type || "",
        leaseId: lease.leaseId || "",
        waitMs: Number.isFinite(Number(lease.waitMs)) ? Number(lease.waitMs) : null
      });
      const result = await setUploadInputFile(target.input, [file], "localizedScreenshots", {
        beforeCount,
        expectedCount: beforeCount + 1,
        timeoutMs: LOCALIZED_SCREENSHOT_UPLOAD_TIMEOUT_MS,
        progress,
        errorState
      });
      const afterCount = result.afterCount;
      const addedCount = afterCount - beforeCount;

      if (!result.ok && errorState.hiddenTimeout) {
        lastMessage = `${entry.locale} screenshot ${fileIndex + 1}: ${errorState.message || "dashboard tab stayed hidden/minimized"}`;
        releaseResult = {
          outcome: "hidden-timeout",
          visibleBefore: beforeCount,
          visibleAfter: afterCount,
          addedCount,
          method: result.method || "",
          errorMessage: errorState.message || "",
          message: lastMessage,
          durationMs: Date.now() - actionStartedAt
        };
        publishLocalizedScreenshotActionLog(progress, {
          action: "upload",
          stage: "result",
          attempt: uploadAttempt,
          screenshotSlot: fileIndex + 1,
          leaseId: lease.leaseId || "",
          ...releaseResult
        });
        return {
          ok: false,
          aborted: false,
          hiddenTimeout: true,
          message: lastMessage,
          target
        };
      }

      if (afterCount > MAX_DASHBOARD_SCREENSHOTS) {
        releaseResult = {
          outcome: "limit-exceeded",
          visibleBefore: beforeCount,
          visibleAfter: afterCount,
          addedCount,
          method: result.method || "",
          errorMessage: result.errorMessage || "",
          durationMs: Date.now() - actionStartedAt
        };
        publishLocalizedScreenshotActionLog(progress, {
          action: "upload",
          stage: "result",
          attempt: uploadAttempt,
          screenshotSlot: fileIndex + 1,
          leaseId: lease.leaseId || "",
          ...releaseResult
        });
        return {
          ok: false,
          aborted: true,
          message: `${entry.locale} screenshot ${fileIndex + 1}: CWS exceeded the ${MAX_DASHBOARD_SCREENSHOTS} screenshot limit`,
          target
        };
      }
      if (addedCount > 1) {
        releaseResult = {
          outcome: "duplicate-add",
          visibleBefore: beforeCount,
          visibleAfter: afterCount,
          addedCount,
          method: result.method || "",
          errorMessage: result.errorMessage || "",
          durationMs: Date.now() - actionStartedAt
        };
        publishLocalizedScreenshotActionLog(progress, {
          action: "upload",
          stage: "result",
          attempt: uploadAttempt,
          screenshotSlot: fileIndex + 1,
          leaseId: lease.leaseId || "",
          ...releaseResult
        });
        return {
          ok: false,
          aborted: true,
          message: `${entry.locale} screenshot ${fileIndex + 1}: CWS added ${addedCount} screenshots for one upload; stopped to avoid duplicates`,
          target
        };
      }
      if (addedCount === 1) {
        if (!isDashboardLocaleSelected(entry.locale)) {
          releaseResult = {
            outcome: "wrong-locale-after-upload",
            visibleBefore: beforeCount,
            visibleAfter: afterCount,
            addedCount,
            method: result.method || "",
            errorMessage: result.errorMessage || "",
            durationMs: Date.now() - actionStartedAt
          };
          publishLocalizedScreenshotActionLog(progress, {
            action: "upload",
            stage: "result",
            attempt: uploadAttempt,
            screenshotSlot: fileIndex + 1,
            leaseId: lease.leaseId || "",
            ...releaseResult
          });
          return {
            ok: false,
            aborted: true,
            message: `${entry.locale} screenshot ${fileIndex + 1}: dashboard locale changed during upload; stopped to avoid writing to the wrong locale`,
            target
          };
        }
        releaseResult = {
          outcome: "added",
          visibleBefore: beforeCount,
          visibleAfter: afterCount,
          addedCount,
          method: result.method || "",
          errorMessage: result.errorMessage || "",
          durationMs: Date.now() - actionStartedAt
        };
        publishLocalizedScreenshotActionLog(progress, {
          action: "upload",
          stage: "result",
          attempt: uploadAttempt,
          screenshotSlot: fileIndex + 1,
          leaseId: lease.leaseId || "",
          ...releaseResult
        });
        setLocalizedScreenshotProgress(progress, `uploaded screenshot ${fileIndex + 1}/${entry.files.length} (visible ${afterCount})`);
        return { ok: true, target };
      }

      lastMessage = result.errorMessage
        ? `${entry.locale} screenshot ${fileIndex + 1}: ${result.errorMessage}`
        : `${entry.locale} screenshot ${fileIndex + 1}: CWS still shows ${afterCount} screenshot(s) after upload (${result.method})`;
      releaseResult = {
        outcome: "unchanged",
        visibleBefore: beforeCount,
        visibleAfter: afterCount,
        addedCount,
        method: result.method || "",
        errorMessage: result.errorMessage || "",
        message: lastMessage,
        durationMs: Date.now() - actionStartedAt
      };
      publishLocalizedScreenshotActionLog(progress, {
        action: "upload",
        stage: "result",
        attempt: uploadAttempt,
        screenshotSlot: fileIndex + 1,
        leaseId: lease.leaseId || "",
        ...releaseResult
      });
    } catch (error) {
      lastMessage = `${entry.locale} screenshot ${fileIndex + 1}: ${error.message || String(error)}`;
      releaseResult = {
        outcome: "exception",
        message: lastMessage,
        durationMs: Date.now() - actionStartedAt
      };
      publishLocalizedScreenshotActionLog(progress, {
        action: "upload",
        stage: "result",
        attempt: uploadAttempt,
        screenshotSlot: fileIndex + 1,
        leaseId: lease && lease.leaseId || "",
        ...releaseResult
      });
    } finally {
      await releaseLocalizedScreenshotMutationLease(progress, lease, mutationRequest || {}, releaseResult || {
        outcome: "unknown",
        durationMs: Date.now() - actionStartedAt
      });
    }

    dismissVisibleDashboardStatusMessages();
    dismissLocalizedScreenshotUploadErrors();
    target = null;
    if (uploadAttempt < LOCALIZED_SCREENSHOT_UPLOAD_ATTEMPTS_PER_FILE) {
      await delay(LOCALIZED_SCREENSHOT_RETRY_DELAY_MS);
    }
  }

  return {
    ok: false,
    message: lastMessage || `${entry.locale} screenshot ${fileIndex + 1}: CWS did not show the uploaded image`,
    target
  };
}

async function uploadLocalizedScreenshotLocale(entry, localeIndex, total, localeAttempt, stats, operation = LOCALIZED_SCREENSHOT_OPERATION_REPLACE) {
  const normalizedOperation = normalizeLocalizedScreenshotOperation(operation);
  let progress = createLocalizedScreenshotProgress(entry, localeIndex, total, stats);
  const attemptPrefix = localeAttempt > 1
    ? `retrying locale (attempt ${localeAttempt}/${LOCALIZED_SCREENSHOT_LOCALE_ATTEMPTS}); `
    : "";
  setLocalizedScreenshotProgress(progress, `${attemptPrefix}selecting locale`);

  if (mediaOperationState.abortRequested) {
    return { ok: false, aborted: true, uploadedCount: 0, message: localize("operationStopped", "Stopped.") };
  }

  const visible = await waitForMediaAutomationVisible(progress);
  if (!visible.ok) {
    return {
      ok: false,
      aborted: Boolean(visible.aborted),
      hiddenTimeout: Boolean(visible.hiddenTimeout),
      uploadedCount: 0,
      message: visible.message || localize("operationStopped", "Stopped.")
    };
  }

  const contextReady = await ensureLocalizedScreenshotUploadContext(entry.locale);
  if (!contextReady.ok) {
    return { ok: false, uploadedCount: 0, message: `${entry.locale}: ${contextReady.message}` };
  }
  let localizedUploadTarget = contextReady.fieldReady && contextReady.fieldReady.uploadTarget ||
    getAvailableMediaUploadInput("localizedScreenshots");

  scrollMediaActionTargetIntoView(getLocalizedScreenshotActionElement());

  if (normalizedOperation !== LOCALIZED_SCREENSHOT_OPERATION_UPLOAD_ONLY) {
    setLocalizedScreenshotProgress(progress, "localized screenshot field found; clearing existing screenshots");
    const clearResult = await performClearDashboardMediaAssets("localizedScreenshots", {
      localizedProgress: progress
    });
    if (!clearResult.ok) {
      return {
        ok: false,
        aborted: Boolean(clearResult.aborted),
        hiddenTimeout: Boolean(clearResult.hiddenTimeout),
        uploadedCount: 0,
        completed: false,
        message: `${entry.locale}: ${clearResult.message || "could not clear localized screenshots"}`
      };
    }
    if (mediaOperationState.abortRequested || clearResult.aborted) {
      return { ok: false, aborted: true, uploadedCount: 0, completed: false, message: localize("operationStopped", "Stopped.") };
    }

    setLocalizedScreenshotProgress(progress, "verifying localized screenshot field is clear");
    const clearWait = await waitForVisibleMediaImageCount(
      "localizedScreenshots",
      0,
      LOCALIZED_SCREENSHOT_CLEAR_TIMEOUT_MS,
      { progress }
    );
    if (!clearWait.ok) {
      return {
        ok: false,
        hiddenTimeout: Boolean(clearWait.hiddenTimeout),
        uploadedCount: 0,
        completed: false,
        message: clearWait.hiddenTimeout && clearWait.message
          ? `${entry.locale}: ${clearWait.message}`
          : `${entry.locale}: CWS still shows ${clearWait.count} localized screenshot(s) after clear`
      };
    }

    if (normalizedOperation === LOCALIZED_SCREENSHOT_OPERATION_CLEAR_ONLY) {
      setLocalizedScreenshotProgress(progress, "localized screenshot field cleared");
      return { ok: true, uploadedCount: 0, completed: true, message: "" };
    }
  }

  let startingFileIndex = 0;
  if (normalizedOperation === LOCALIZED_SCREENSHOT_OPERATION_UPLOAD_ONLY) {
    const visibleCount = getVisibleMediaImageCount("localizedScreenshots");
    if (visibleCount > entry.files.length) {
      return {
        ok: false,
        uploadedCount: 0,
        completed: false,
        message: `${entry.locale}: CWS already shows ${visibleCount} localized screenshot(s), expected at most ${entry.files.length}`
      };
    }
    if (visibleCount === entry.files.length) {
      setLocalizedScreenshotProgress(progress, `upload-only found expected screenshot count (${visibleCount})`);
      return { ok: true, uploadedCount: 0, completed: true, message: "" };
    }

    startingFileIndex = visibleCount;
    setLocalizedScreenshotProgress(progress, `upload-only continuing from visible screenshot count ${visibleCount}`);
  }

  let uploadedForLocale = 0;
  for (let fileIndex = startingFileIndex; fileIndex < entry.files.length; fileIndex++) {
    progress = createLocalizedScreenshotProgress(entry, localeIndex, total, stats, {
      uploadedScreenshots: (stats.uploadedScreenshots || 0) + uploadedForLocale
    });
    const uploadResult = await uploadLocalizedScreenshotFileWithRetries(
      entry,
      fileIndex,
      localizedUploadTarget,
      progress
    );
    localizedUploadTarget = uploadResult.target || localizedUploadTarget;

    if (!uploadResult.ok) {
      return {
        ok: false,
        aborted: Boolean(uploadResult.aborted),
        hiddenTimeout: Boolean(uploadResult.hiddenTimeout),
        uploadedCount: uploadedForLocale,
        completed: false,
        message: uploadResult.message
      };
    }
    uploadedForLocale++;
  }

  progress = createLocalizedScreenshotProgress(entry, localeIndex, total, stats, {
    uploadedScreenshots: (stats.uploadedScreenshots || 0) + uploadedForLocale
  });
  setLocalizedScreenshotProgress(progress, "verifying final localized screenshot count");
  const finalLocalizedCount = getVisibleMediaImageCount("localizedScreenshots");
  if (finalLocalizedCount !== entry.files.length) {
    return {
      ok: false,
      uploadedCount: uploadedForLocale,
      completed: false,
      message: `${entry.locale}: CWS shows ${finalLocalizedCount} localized screenshot(s) after ${uploadedForLocale} upload(s)`
    };
  }

  return { ok: true, uploadedCount: uploadedForLocale, completed: true, message: "" };
}

