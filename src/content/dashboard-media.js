async function performUploadDashboardMediaAssets(files, kind = "", options = {}) {
  if (kind === "localizedScreenshots") {
    return performUploadLocalizedScreenshots(files, options);
  }

  const uploaded = [];
  const failed = [];
  const skipped = [];
  let aborted = false;
  const uploadStoreIcon = !kind || kind === "storeIcon";
  const uploadScreenshots = !kind || kind === "screenshots";
  const uploadSmallPromo = !kind || kind === "smallPromo";
  const uploadMarqueePromo = !kind || kind === "marqueePromo";
  const screenshots = uploadScreenshots ? Array.from(files && files.screenshots || []) : [];

  if (uploadScreenshots && screenshots.length) {
    for (let index = 0; index < screenshots.length; index++) {
      if (mediaOperationState.abortRequested) {
        aborted = true;
        break;
      }

      const visibleScreenshotCount = getVisibleMediaImageCount("screenshots");
      if (visibleScreenshotCount >= MAX_DASHBOARD_SCREENSHOTS) {
        skipped.push(localize(
          "screenshotsLimitReached",
          "screenshots: CWS limit of $1 already reached",
          [String(MAX_DASHBOARD_SCREENSHOTS)]
        ));
        break;
      }

      const target = getAvailableMediaUploadInput("screenshots");
      if (!target) {
        failed.push(`screenshot ${index + 1}: upload target not found`);
        break;
      }

      try {
        const result = await setUploadInputFile(target.input, [screenshots[index]]);
        if (result.ok) {
          uploaded.push(`screenshot ${index + 1}: ${screenshots[index].name}`);
        } else {
          failed.push(`screenshot ${index + 1}: CWS did not show the uploaded image (${result.method})`);
        }
      } catch (error) {
        failed.push(`screenshot ${index + 1}: ${error.message || String(error)}`);
      }
    }
  } else if (uploadScreenshots) {
    skipped.push("screenshots: no discovered files");
  }

  for (const item of [
    { kind: "storeIcon", file: files && files.storeIcon, label: "store icon", enabled: uploadStoreIcon },
    { kind: "smallPromo", file: files && files.smallPromo, label: "small promo", enabled: uploadSmallPromo },
    { kind: "marqueePromo", file: files && files.marqueePromo, label: "marquee promo", enabled: uploadMarqueePromo }
  ].filter(item => item.enabled)) {
    if (mediaOperationState.abortRequested) {
      aborted = true;
      break;
    }

    if (!item.file) {
      skipped.push(`${item.label}: no discovered file`);
      continue;
    }

    if (hasExistingOrProcessingMedia(item.kind)) {
      skipped.push(`${item.label}: already present or processing`);
      continue;
    }

    const target = getAvailableMediaUploadInput(item.kind);
    if (!target) {
      failed.push(`${item.label}: upload target not found`);
      continue;
    }

    try {
      const result = await setUploadInputFile(target.input, [item.file]);
      if (result.ok) {
        uploaded.push(`${item.label}: ${item.file.name}`);
      } else {
        failed.push(`${item.label}: CWS did not show the uploaded image (${result.method})`);
      }
    } catch (error) {
      failed.push(`${item.label}: ${error.message || String(error)}`);
    }
  }

  const messageParts = [
    localize("mediaUploadedKind", "Uploaded $1: $2.", [getMediaUploadKindLabel(kind), String(uploaded.length)]),
    aborted ? localize("operationStopped", "Stopped.") : "",
    skipped.length ? localize("mediaSkipped", "Skipped: $1.", [skipped.join(", ")]) : "",
    failed.length ? localize("mediaUploadFailures", "Failed: $1.", [failed.join(", ")]) : ""
  ].filter(Boolean);

  return {
    ok: failed.length === 0 && (uploaded.length > 0 || skipped.length > 0),
    aborted,
    message: messageParts.join(" "),
    uploaded,
    skipped,
    failed,
    diagnostics: {
      mediaUploadTargets: getMediaUploadDiagnostics()
    }
  };
}

async function uploadDashboardMediaAssets(files, kind = "", options = {}) {
  return runExclusiveMediaOperation(
    kind === "localizedScreenshots"
      ? localize("uploadingLocalizedScreenshots", "Uploading localized screenshots...")
      : localize("uploadingMedia", "Uploading media..."),
    () => performUploadDashboardMediaAssets(files, kind, options)
  );
}
