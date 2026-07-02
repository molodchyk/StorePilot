async function performUploadDashboardMediaAssets(files, kind = "", options = {}) {
  if (kind === "localizedScreenshots") {
    return performUploadLocalizedScreenshots(files, options);
  }

  if (kind === "globalPromoVideo") {
    return pasteDashboardGlobalPromoVideo(files && files.globalPromoVideo);
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
      : kind === "globalPromoVideo"
        ? localize("pastingGlobalPromoVideo", "Pasting global promo video...")
      : localize("uploadingMedia", "Uploading media..."),
    () => performUploadDashboardMediaAssets(files, kind, options)
  );
}

function normalizePromoVideoTargetText(value) {
  if (typeof normalizeLanguageText === "function") {
    return normalizeLanguageText(value);
  }
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getPromoVideoInputContext(input) {
  const parts = [
    getElementLabelText(input),
    input.getAttribute("placeholder") || "",
    input.getAttribute("aria-label") || "",
    getReferencedText(input, "aria-describedby")
  ];

  let current = input;
  for (let depth = 0; current && depth < 5; depth++) {
    parts.push(getVisibleText(current));

    let previous = current.previousElementSibling;
    for (let index = 0; previous && index < 2; index++) {
      parts.push(getVisibleText(previous));
      previous = previous.previousElementSibling;
    }

    let next = current.nextElementSibling;
    for (let index = 0; next && index < 1; index++) {
      parts.push(getVisibleText(next));
      next = next.nextElementSibling;
    }

    current = current.parentElement;
  }

  return normalizePromoVideoTargetText(parts.filter(Boolean).join(" "));
}

function scoreGlobalPromoVideoInput(input) {
  if (!input || isStorePilotOwnedElement(input) || !isVisible(input)) return null;

  const type = normalizePromoVideoTargetText(input.getAttribute("type") || "text");
  if (type && !["text", "url", "search"].includes(type)) return null;

  const labelText = normalizePromoVideoTargetText(getElementLabelText(input));
  const placeholderText = normalizePromoVideoTargetText(input.getAttribute("placeholder") || "");
  const contextText = getPromoVideoInputContext(input);
  const combinedText = normalizePromoVideoTargetText(`${labelText} ${placeholderText} ${contextText}`);
  let score = 0;

  if (/global promo video/.test(labelText)) score += 320;
  if (/global promo video/.test(combinedText)) score += 120;
  if (/youtube url|youtube/.test(placeholderText)) score += 60;
  if (/global assets?/.test(combinedText)) score += 50;
  if (/graphic assets?/.test(combinedText)) score += 20;

  if (/locali[sz]ed promo video/.test(labelText)) score -= 500;
  if (/locali[sz]ed promo video/.test(combinedText)) score -= 180;
  if (/locali[sz]ed assets?/.test(combinedText) && !/global assets?/.test(combinedText)) score -= 90;

  return {
    input,
    score,
    labelText,
    placeholderText,
    contextText: contextText.slice(0, 500)
  };
}

function getGlobalPromoVideoInputCandidates() {
  return Array.from(document.querySelectorAll("input[type='text'],input[type='url'],input:not([type])"))
    .map(scoreGlobalPromoVideoInput)
    .filter(Boolean)
    .filter(candidate => candidate.score >= 250)
    .sort((left, right) => right.score - left.score || getElementTop(left.input) - getElementTop(right.input));
}

function getGlobalPromoVideoInputTarget() {
  return getGlobalPromoVideoInputCandidates()[0] || null;
}

function getDashboardGlobalPromoVideoState() {
  const target = getGlobalPromoVideoInputTarget();
  return {
    targetFound: Boolean(target),
    value: target ? getEditableElementValue(target.input) : "",
    diagnostics: target ? {
      score: target.score,
      labelText: target.labelText,
      placeholderText: target.placeholderText
    } : null
  };
}

function scrollPromoVideoTargetIntoView(input) {
  if (!input || typeof input.scrollIntoView !== "function") return;
  input.scrollIntoView({ block: "center", inline: "center" });
  try {
    input.focus({ preventScroll: true });
  } catch (_error) {
    input.focus();
  }
}

async function pasteDashboardGlobalPromoVideo(asset) {
  const url = String(asset && asset.url || "").trim();
  if (!url) {
    return {
      ok: false,
      message: localize("promoVideoMissing", "No promo video URL found.")
    };
  }

  const target = getGlobalPromoVideoInputTarget();
  if (!target) {
    return {
      ok: false,
      message: localize("globalPromoVideoTargetNotFound", "Global promo video field not found on this page."),
      diagnostics: {
        globalPromoVideoCandidates: getGlobalPromoVideoInputCandidates()
          .slice(0, 5)
          .map(candidate => ({
            score: candidate.score,
            labelText: candidate.labelText,
            placeholderText: candidate.placeholderText,
            contextText: candidate.contextText
          }))
      }
    };
  }

  scrollPromoVideoTargetIntoView(target.input);
  if (!fillElement(target.input, url)) {
    return {
      ok: false,
      message: localize("globalPromoVideoDidNotAcceptValue", "Global promo video field did not accept the URL."),
      diagnostics: {
        globalPromoVideoTarget: target
      }
    };
  }

  target.input.blur();
  await delay(100);

  const actualValue = normalizeFilledFormValue(getEditableElementValue(target.input));
  const expectedValue = normalizeFilledFormValue(url);
  if (actualValue !== expectedValue) {
    return {
      ok: false,
      message: localize("globalPromoVideoDidNotAcceptValue", "Global promo video field did not accept the URL."),
      diagnostics: {
        expectedValue,
        actualValue,
        globalPromoVideoTarget: {
          score: target.score,
          labelText: target.labelText,
          placeholderText: target.placeholderText
        }
      }
    };
  }

  return {
    ok: true,
    message: localize("globalPromoVideoPasted", "Pasted global promo video URL."),
    pasted: url,
    diagnostics: {
      globalPromoVideoTarget: {
        score: target.score,
        labelText: target.labelText,
        placeholderText: target.placeholderText
      }
    }
  };
}
