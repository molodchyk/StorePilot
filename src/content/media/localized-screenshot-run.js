async function auditCompletedLocalizedScreenshotLocales(entries, completedLocales, stats, operation) {
  const completedSet = new Set((completedLocales || []).map(normalizeLocale));
  const audited = [];
  const failed = [];
  const failedLocales = [];
  const normalizedOperation = normalizeLocalizedScreenshotOperation(operation);
  const completedEntries = entries.filter(entry => completedSet.has(normalizeLocale(entry.locale)));

  for (let index = 0; index < completedEntries.length; index++) {
    if (mediaOperationState.abortRequested) {
      return { audited, failed, failedLocales, aborted: true };
    }

    const entry = completedEntries[index];
    const expectedCount = normalizedOperation === LOCALIZED_SCREENSHOT_OPERATION_CLEAR_ONLY
      ? 0
      : entry.files.length;
    const progress = createLocalizedScreenshotProgress(entry, index, completedEntries.length, stats, {
      completedLocales: stats.completedLocales || completedEntries.length,
      auditedLocales: audited.length,
      failedLocales: failed.length,
      uploadedScreenshots: stats.uploadedScreenshots || 0
    });
    setLocalizedScreenshotProgress(progress, `auditing persisted localized screenshot count (${expectedCount} expected)`);

    const visible = await waitForMediaAutomationVisible(progress);
    if (!visible.ok) {
      const message = `${entry.locale}: ${visible.message || localize("operationStopped", "Stopped.")}`;
      failed.push(message);
      failedLocales.push(entry.locale);
      return {
        audited,
        failed,
        failedLocales,
        aborted: Boolean(visible.aborted),
        hiddenTimeout: Boolean(visible.hiddenTimeout)
      };
    }

    const contextReady = await ensureLocalizedScreenshotUploadContext(entry.locale);
    if (!contextReady.ok) {
      const message = `${entry.locale}: audit could not select localized screenshot field: ${contextReady.message}`;
      failed.push(message);
      failedLocales.push(entry.locale);
      continue;
    }

    scrollMediaActionTargetIntoView(getLocalizedScreenshotActionElement());
    const auditWait = await waitForVisibleMediaImageCount("localizedScreenshots", expectedCount, 8000, { progress });
    if (!auditWait.ok) {
      if (auditWait.hiddenTimeout) {
        const message = `${entry.locale}: ${auditWait.message || "dashboard tab stayed hidden/minimized during audit"}`;
        failed.push(message);
        failedLocales.push(entry.locale);
        return { audited, failed, failedLocales, aborted: false, hiddenTimeout: true };
      }
      const visibleCount = getVisibleMediaImageCount("localizedScreenshots");
      const message = `${entry.locale}: audit expected ${expectedCount} localized screenshot(s), CWS shows ${visibleCount}`;
      publishLocalizedScreenshotActionLog(progress, {
        action: "audit",
        stage: "result",
        outcome: "mismatch",
        visibleAfter: visibleCount,
        message
      });
      failed.push(message);
      failedLocales.push(entry.locale);
      continue;
    }

    publishLocalizedScreenshotActionLog(progress, {
      action: "audit",
      stage: "result",
      outcome: "matched",
      visibleAfter: auditWait.count,
      message: `${entry.locale}: audit matched ${expectedCount} localized screenshot(s)`
    });
    audited.push(entry.locale);
  }

  return { audited, failed, failedLocales, aborted: false };
}

async function performUploadLocalizedScreenshots(files, options = {}) {
  const startedAt = Date.now();
  const uploaded = [];
  const failed = [];
  const skipped = [];
  const completed = [];
  const audited = [];
  let aborted = false;
  const operation = normalizeLocalizedScreenshotOperation(options.localizedScreenshotsOperation || options.operation || "");

  if (typeof loadListings === "function") {
    await loadListings();
  }

  let entries = getLocalizedScreenshotFileEntries(files).filter(entry => {
    if (typeof getListingLocaleKey !== "function") return true;
    const listingLocale = getListingLocaleKey(entry.locale);
    if (listingLocale) return true;
    skipped.push(`${entry.locale}: no imported listing text`);
    return false;
  });

  const hasAssignedLocales = Array.isArray(options.assignedLocales);
  let assignedLocales = [];
  if (hasAssignedLocales) {
    const assignedResult = applyLocalizedScreenshotAssignedLocales(entries, options.assignedLocales);
    assignedLocales = assignedResult.assignedLocales;
    entries = assignedResult.entries;
    skipped.push(...assignedResult.skippedAssignedLocales);
  } else {
    const startLocaleResult = applyLocalizedScreenshotStartLocale(entries, options.localizedScreenshotsStartLocale || options.startLocale || "");
    if (!startLocaleResult.ok) {
      failed.push(startLocaleResult.message);
      entries = [];
    } else {
      entries = startLocaleResult.entries;
      skipped.push(...startLocaleResult.skippedBeforeStart);
    }
  }

  if (!entries.length) {
    const elapsedMs = Date.now() - startedAt;
    return {
      ok: skipped.length > 0 && failed.length === 0,
      aborted: false,
      message: failed.length
        ? localize("mediaUploadFailures", "Failed: $1.", [failed.join(", ")])
        : skipped.length
          ? localize("mediaSkipped", "Skipped: $1.", [skipped.join(", ")])
          : localize("localizedScreenshotsNoMatchingFiles", "No localized screenshot files match imported listing locales."),
      uploaded,
      skipped,
      failed,
      completed,
      elapsedMs,
      assignedLocales,
      operation,
      diagnostics: {
        mediaUploadTargets: getMediaUploadDiagnostics()
      }
    };
  }

  const totalScreenshots = entries.reduce((sum, entry) => sum + entry.files.length, 0);
  let uploadedScreenshotCount = 0;
  let stopAfterVisibilityTimeout = false;

  for (let localeIndex = 0; localeIndex < entries.length; localeIndex++) {
    const entry = entries[localeIndex];
    let localeUploadedCount = 0;
    const localeFailures = [];

    for (let localeAttempt = 1; localeAttempt <= LOCALIZED_SCREENSHOT_LOCALE_ATTEMPTS; localeAttempt++) {
      const localeResult = await uploadLocalizedScreenshotLocale(entry, localeIndex, entries.length, localeAttempt, {
        completedLocales: completed.length,
        failedLocales: failed.length,
        skippedLocales: countLocalizedScreenshotSkippedLocales(skipped),
        uploadedScreenshots: uploadedScreenshotCount,
        totalScreenshots,
        operation,
        startedAt,
        runId: options.parallelRunId || options.runId || "",
        workerId: options.parallelWorkerId || options.workerId || "",
        mutationGateEnabled: Boolean(options.parallelMutationGateEnabled)
      }, operation);
      localeUploadedCount = Math.max(localeUploadedCount, localeResult.uploadedCount || 0);

      if (localeResult.ok) {
        localeFailures.length = 0;
        localeUploadedCount = localeResult.uploadedCount || 0;
        break;
      }

      localeFailures.push(localeResult.message);
      if (localeResult.hiddenTimeout) {
        stopAfterVisibilityTimeout = true;
        break;
      }
      if (mediaOperationState.abortRequested || localeResult.aborted) {
        aborted = true;
        break;
      }

      if (localeAttempt < LOCALIZED_SCREENSHOT_LOCALE_ATTEMPTS) {
        dismissVisibleDashboardStatusMessages();
        await delay(LOCALIZED_SCREENSHOT_RETRY_DELAY_MS);
      }
    }

    if (localeFailures.length) {
      failed.push(`${entry.locale}: ${localeFailures.join(" | ")}`);
    } else {
      completed.push(entry.locale);
    }

    if (!localeFailures.length && localeUploadedCount > 0) {
      uploaded.push(`${entry.locale}: ${localeUploadedCount}`);
      uploadedScreenshotCount += localeUploadedCount;
    }

    if (aborted) {
      break;
    }

    if (stopAfterVisibilityTimeout) {
      break;
    }

    if (mediaOperationState.abortRequested) {
      aborted = true;
      break;
    }
  }

  if (!aborted && options.parallelAuditAfterRun && completed.length) {
    const audit = await auditCompletedLocalizedScreenshotLocales(entries, completed, {
      completedLocales: completed.length,
      failedLocales: failed.length,
      skippedLocales: countLocalizedScreenshotSkippedLocales(skipped),
      uploadedScreenshots: uploadedScreenshotCount,
      totalScreenshots,
      operation,
      startedAt,
      runId: options.parallelRunId || options.runId || "",
      workerId: options.parallelWorkerId || options.workerId || "",
      mutationGateEnabled: Boolean(options.parallelMutationGateEnabled)
    }, operation);
    audited.push(...audit.audited);
    if (audit.aborted) {
      aborted = true;
    }
    if (audit.hiddenTimeout) {
      const auditedSet = new Set(audit.audited.map(normalizeLocale));
      const failedAuditSet = new Set(audit.failedLocales.map(normalizeLocale));
      for (const locale of completed) {
        const normalizedLocale = normalizeLocale(locale);
        if (auditedSet.has(normalizedLocale) || failedAuditSet.has(normalizedLocale)) continue;
        audit.failed.push(`${locale}: audit did not finish because the dashboard stayed hidden/minimized`);
        audit.failedLocales.push(locale);
        failedAuditSet.add(normalizedLocale);
      }
    }
    if (audit.failed.length) {
      const failedAuditSet = new Set(audit.failedLocales.map(normalizeLocale));
      for (let index = completed.length - 1; index >= 0; index--) {
        if (failedAuditSet.has(normalizeLocale(completed[index]))) {
          completed.splice(index, 1);
        }
      }
      failed.push(...audit.failed);
    }
  }

  const skippedLocaleCount = countLocalizedScreenshotSkippedLocales(skipped);
  const elapsedMs = Date.now() - startedAt;
  const operationLabel = operation === LOCALIZED_SCREENSHOT_OPERATION_CLEAR_ONLY
    ? "clear"
    : operation === LOCALIZED_SCREENSHOT_OPERATION_UPLOAD_ONLY
      ? "upload-only"
      : "upload";
  const auditSummary = options.parallelAuditAfterRun
    ? `, ${audited.length} audited`
    : "";
  const runSummary = `Localized screenshot ${operationLabel} ${aborted ? "stopped" : "finished"}: ${completed.length}/${entries.length} run locale(s) completed${auditSummary}, ${uploadedScreenshotCount}/${totalScreenshots} screenshot(s) uploaded, ${skippedLocaleCount} locale(s) skipped, ${failed.length} failed. Elapsed: ${formatLocalizedScreenshotElapsedTime(elapsedMs)}.`;
  const messageParts = [
    runSummary,
    aborted ? localize("operationStopped", "Stopped.") : "",
    skipped.length ? localize("mediaSkipped", "Skipped: $1.", [skipped.join(", ")]) : "",
    failed.length ? localize("mediaUploadFailures", "Failed: $1.", [failed.join(", ")]) : ""
  ].filter(Boolean);

  return {
    ok: failed.length === 0 && (completed.length > 0 || uploaded.length > 0 || skipped.length > 0),
    aborted,
    hiddenTimeout: stopAfterVisibilityTimeout,
    message: messageParts.join(" "),
    uploaded,
    skipped,
    failed,
    completed,
    audited,
    elapsedMs,
    assignedLocales,
    operation,
    diagnostics: {
      mediaUploadTargets: getMediaUploadDiagnostics()
    }
  };
}

