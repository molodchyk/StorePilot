const MEDIA_UPLOAD_BRIDGE_SCRIPT = "src/content/media-upload-main-world.js";
const MAX_DASHBOARD_SCREENSHOTS = 5;
const MEDIA_UPLOAD_TARGET_ID_ATTRIBUTE = "data-storepilot-upload-target-id";
const DEFAULT_MEDIA_UPLOAD_TIMEOUT_MS = 20000;
const LOCALIZED_SCREENSHOT_UPLOAD_TIMEOUT_MS = 90000;
const MEDIA_REMOVAL_TIMEOUT_MS = 30000;
const LOCALIZED_SCREENSHOT_TARGET_READY_TIMEOUT_MS = 45000;
const LOCALIZED_SCREENSHOT_CLEAR_TIMEOUT_MS = 45000;
const LOCALIZED_SCREENSHOT_LANGUAGE_SELECTION_OPTIONS = {
  openDelayMs: 125,
  confirmationAttempts: 3,
  confirmationDelayMs: 75,
  acceptUnverifiedClick: true
};
const LOCALIZED_SCREENSHOT_LANGUAGE_VERIFICATION_ATTEMPTS = 8;
const LOCALIZED_SCREENSHOT_LANGUAGE_VERIFICATION_DELAY_MS = 75;
const LOCALIZED_SCREENSHOT_LOCALE_ATTEMPTS = 2;
const LOCALIZED_SCREENSHOT_DELETE_ATTEMPTS_PER_IMAGE = 3;
const LOCALIZED_SCREENSHOT_UPLOAD_ATTEMPTS_PER_FILE = 3;
const LOCALIZED_SCREENSHOT_DELETE_ATTEMPT_TIMEOUT_MS = 10000;
const LOCALIZED_SCREENSHOT_RETRY_DELAY_MS = 250;
const MEDIA_VISIBILITY_POLL_MS = 1000;
const MEDIA_VISIBILITY_FOCUS_RETRY_MS = 5000;
const MEDIA_VISIBILITY_MAX_HIDDEN_WAIT_MS = 5 * 60 * 1000;
const MEDIA_UPLOAD_BRIDGE_TIMEOUT_MS = 500;
const LOCALIZED_SCREENSHOT_OPERATION_REPLACE = "replace";
const LOCALIZED_SCREENSHOT_OPERATION_CLEAR_ONLY = "clearOnly";
const LOCALIZED_SCREENSHOT_OPERATION_UPLOAD_ONLY = "uploadOnly";

function isStorePilotOwnedElement(element) {
  const panelId = typeof PANEL_ID === "string" ? PANEL_ID : "storepilot-panel";
  return Boolean(element && typeof element.closest === "function" && element.closest(`#${panelId}`));
}

function getMediaUploadTypeName(widget) {
  const uploadType = widget && widget.dataset ? widget.dataset.imageUploadType : "";
  const widgetText = normalizeLanguageText(getVisibleText(widget || ""));

  if (/locali[sz]ed screenshots?/.test(widgetText)) return "localizedScreenshots";

  if (uploadType === "4") {
    return "screenshots";
  }

  if (uploadType === "5") {
    return "storeIcon";
  }

  if (uploadType === "1") {
    return "smallPromo";
  }

  if (uploadType === "3") {
    return "marqueePromo";
  }

  if (/screenshots?/.test(widgetText) || /screenshot/.test(widgetText)) return "screenshots";
  if (/store icon|merchant icon|handler symbol|haendler symbol|handlersymbol|handlersymbol|symbol hier ablegen/.test(widgetText)) return "storeIcon";
  if (/small promo|small tile|kleine werbekachel/.test(widgetText)) return "smallPromo";
  if (/marquee|large promo|lauf(schrift)? werbekachel|laufschrift werbekachel/.test(widgetText)) return "marqueePromo";

  return uploadType ? `unknownType${uploadType}` : "unknown";
}

function getImageUploadInputs() {
  return Array.from(document.querySelectorAll("input[type='file']"))
    .filter(input => !isStorePilotOwnedElement(input))
    .filter(input => {
      const accept = String(input.getAttribute("accept") || "").toLowerCase();
      return /\.png|\.jpg|\.jpeg|image\//.test(accept);
    });
}

function getMediaUploadWidgetForInput(input) {
  if (!input) return null;
  return input.closest("[data-image-upload-type]") ||
    input.closest(".aQzcYd") ||
    input.parentElement ||
    input;
}

function getMediaUploadDropButton(inputOrWidget) {
  const widget = inputOrWidget && inputOrWidget.matches && inputOrWidget.matches("input[type='file']")
    ? getMediaUploadWidgetForInput(inputOrWidget)
    : inputOrWidget;
  if (!widget || typeof widget.querySelector !== "function") return null;

  return widget.querySelector("[role='button'][jsname='DagSrd']") ||
    Array.from(widget.querySelectorAll("[role='button']")).find(button => {
      const text = normalizeLanguageText(getVisibleText(button));
      return /drop image here|image here|drop.*image/.test(text);
    }) ||
    null;
}

function getMediaUploadAnchorElement(input) {
  const widget = getMediaUploadWidgetForInput(input);
  return getMediaUploadDropButton(widget) || widget || input;
}

function scrollMediaActionTargetIntoView(inputOrWidget) {
  const target = inputOrWidget && inputOrWidget.matches && inputOrWidget.matches("input[type='file']")
    ? getMediaUploadAnchorElement(inputOrWidget)
    : getMediaUploadDropButton(inputOrWidget) || inputOrWidget;
  if (!target || typeof target.scrollIntoView !== "function") return;

  target.scrollIntoView({ block: "center", inline: "center" });
  if (typeof target.focus === "function") {
    target.focus({ preventScroll: true });
  }
}

function getNearbyMediaContext(element) {
  if (!element) return "";

  const contextParts = [];
  let current = element;
  for (let depth = 0; current && depth < 7; depth++) {
    const siblingTexts = [];
    let previous = current.previousElementSibling;
    for (let index = 0; previous && index < 3; index++) {
      siblingTexts.unshift(getVisibleText(previous));
      previous = previous.previousElementSibling;
    }
    let next = current.nextElementSibling;
    for (let index = 0; next && index < 2; index++) {
      siblingTexts.push(getVisibleText(next));
      next = next.nextElementSibling;
    }

    contextParts.push([
      siblingTexts.join(" "),
      getVisibleText(current)
    ].filter(Boolean).join(" "));

    current = current.parentElement;
  }

  return normalizeLanguageText(contextParts.filter(Boolean).join(" ").slice(0, 3000));
}

function getSafeElementRect(element) {
  if (!element || typeof element.getBoundingClientRect !== "function") return null;
  const rect = element.getBoundingClientRect();
  if (!Number.isFinite(rect.top) || !Number.isFinite(rect.bottom)) return null;
  return rect;
}

function getMediaLabelTextElements() {
  return Array.from(document.querySelectorAll("h1,h2,h3,h4,span,p,div,label"))
    .filter(element => !isStorePilotOwnedElement(element))
    .filter(isVisible)
    .filter(element => {
      const text = getVisibleText(element);
      return text && text.length <= 220;
    });
}

function isLocalizedScreenshotLabelText(text) {
  const normalized = normalizeLanguageText(text);
  return /locali[sz]ed screenshots?/.test(normalized) &&
    !/upload locali[sz]ed screenshots?/.test(normalized);
}

function isLocalizedAssetsLabelText(text) {
  return /locali[sz]ed assets?/.test(normalizeLanguageText(text));
}

function isGlobalMediaBoundaryText(text) {
  return /global assets?|global screenshots?|small promo|small tile|marquee|large promo|store icon|merchant icon|handler symbol|shop symbol/.test(normalizeLanguageText(text));
}

function getLocalizedScreenshotLabelElements() {
  return getMediaLabelTextElements().filter(element => isLocalizedScreenshotLabelText(getVisibleText(element)));
}

function getLocalizedAssetsLabelElements() {
  return getMediaLabelTextElements().filter(element => isLocalizedAssetsLabelText(getVisibleText(element)));
}

function getGlobalMediaBoundaryElements() {
  return getMediaLabelTextElements().filter(element => isGlobalMediaBoundaryText(getVisibleText(element)));
}

function getLocalizedScreenshotFieldBounds() {
  const labels = getLocalizedScreenshotLabelElements()
    .map(label => ({ label, rect: getSafeElementRect(label) }))
    .filter(candidate => candidate.rect)
    .sort((a, b) => a.rect.top - b.rect.top);
  if (!labels.length) return null;

  const label = labels[0];
  const bottomBoundary = getGlobalMediaBoundaryElements()
    .map(element => getSafeElementRect(element))
    .filter(Boolean)
    .filter(rect => rect.top > label.rect.top + 24)
    .sort((a, b) => a.top - b.top)[0];

  return {
    top: label.rect.top - 8,
    bottom: bottomBoundary ? bottomBoundary.top - 4 : label.rect.top + 900,
    label: label.label
  };
}

function isElementInsideLocalizedScreenshotField(element) {
  return isElementInsideLocalizedScreenshotBounds(element, getLocalizedScreenshotFieldBounds());
}

function isElementInsideLocalizedScreenshotBounds(element, bounds) {
  if (!element || !bounds || isStorePilotOwnedElement(element)) return false;
  const rect = getSafeElementRect(element);
  if (!rect) return false;
  return rect.top >= bounds.top && rect.top <= bounds.bottom;
}

function hasBoundaryBetween(topA, topB) {
  const minTop = Math.min(topA, topB);
  const maxTop = Math.max(topA, topB);
  return getGlobalMediaBoundaryElements().some(element => {
    const rect = getSafeElementRect(element);
    return rect && rect.top > minTop + 2 && rect.top < maxTop - 2;
  });
}

function scoreLocalizedScreenshotLabelRelation(element) {
  const rect = getSafeElementRect(element);
  if (!rect) return 0;

  let score = 0;
  const localizedLabels = getLocalizedScreenshotLabelElements()
    .map(label => ({ label, rect: getSafeElementRect(label) }))
    .filter(candidate => candidate.rect)
    .filter(candidate => candidate.rect.top <= rect.bottom + 120)
    .filter(candidate => rect.top - candidate.rect.top < 1100)
    .filter(candidate => !hasBoundaryBetween(candidate.rect.top, rect.top));

  if (localizedLabels.length) {
    const nearest = localizedLabels
      .sort((a, b) => Math.abs(rect.top - a.rect.top) - Math.abs(rect.top - b.rect.top))[0];
    score += 260;
    if (Math.abs(rect.top - nearest.rect.top) < 360) score += 45;
  }

  const localizedAssetsLabels = getLocalizedAssetsLabelElements()
    .map(label => ({ label, rect: getSafeElementRect(label) }))
    .filter(candidate => candidate.rect)
    .filter(candidate => candidate.rect.top <= rect.bottom + 160)
    .filter(candidate => rect.top - candidate.rect.top < 1300)
    .filter(candidate => !hasBoundaryBetween(candidate.rect.top, rect.top));

  if (localizedAssetsLabels.length) {
    score += 80;
  }

  if (!localizedLabels.length && hasBoundaryBetween(rect.top - 900, rect.top)) {
    score -= 180;
  }

  return score;
}

function scoreLocalizedScreenshotUploadWidget(widget) {
  const context = getNearbyMediaContext(widget);
  if (!context) return 0;

  let score = 0;
  if (/locali[sz]ed screenshots?/.test(context)) score += 220;
  if (/locali[sz]ed assets?/.test(context)) score += 80;
  if (/graphic assets?/.test(context)) score += 25;
  if (/drop image here|image here|drop.*image/.test(context)) score += 20;
  if (/global screenshots?|global assets?/.test(context)) score -= 220;
  if (/store icon|small promo|marquee|promo tile/.test(context)) score -= 120;
  return score;
}

function scoreLocalizedScreenshotUploadInput(input) {
  const uploadWidget = getMediaUploadWidgetForInput(input);
  const anchor = getMediaUploadAnchorElement(input);
  const ancestorScores = [];
  let current = input;

  for (let depth = 0; current && depth < 7; depth++) {
    ancestorScores.push(scoreLocalizedScreenshotUploadWidget(current));
    current = current.parentElement;
  }

  const text = normalizeLanguageText(getVisibleText(anchor) || getVisibleText(uploadWidget));
  let score = Math.max(0, ...ancestorScores);
  score += scoreLocalizedScreenshotLabelRelation(anchor || input);
  if (/drop image here|image here|drop.*image/.test(text)) score += 20;
  if (uploadWidget && uploadWidget.dataset && uploadWidget.dataset.imageUploadType === "4") score -= 50;
  return score;
}

function getMediaImageCountForWidget(widget) {
  return Array.from(widget ? widget.querySelectorAll("img") : [])
    .filter(image => isVisible(image) && image.getAttribute("src"))
    .length;
}

function getMediaRemoveButtonCountForWidget(widget) {
  return Array.from(widget ? widget.querySelectorAll("[role='button'][aria-label], [jsname='LCoeQd']") : [])
    .filter(button => {
      if (button.getAttribute("aria-disabled") === "true") return false;
      if (!isVisible(button)) return false;
      const label = normalizeLanguageText(button.getAttribute("aria-label") || "");
      return button.getAttribute("jsname") === "LCoeQd" ||
        /remove|delete|entfernen|loschen/.test(label);
    })
    .length;
}

function getMediaUploadInputCountForWidget(widget) {
  return Array.from(widget ? widget.querySelectorAll("input[type='file']") : [])
    .filter(input => !isStorePilotOwnedElement(input))
    .length;
}

function isUsableLocalizedScreenshotFieldWidget(widget) {
  if (!widget || isStorePilotOwnedElement(widget)) return false;
  const mediaControlCount = getMediaImageCountForWidget(widget) +
    getMediaRemoveButtonCountForWidget(widget) +
    getMediaUploadInputCountForWidget(widget);
  if (!mediaControlCount) return false;

  const inputCount = getMediaUploadInputCountForWidget(widget);
  if (inputCount > 1) return false;

  const context = normalizeLanguageText(getVisibleText(widget).slice(0, 1600));
  if (/global assets?|global screenshots?/.test(context)) return false;
  return true;
}

function getLocalizedScreenshotFieldWidgetForInput(input) {
  const uploadWidget = getMediaUploadWidgetForInput(input);
  const inputScore = scoreLocalizedScreenshotUploadInput(input);
  const candidates = [];
  let current = input && input.parentElement;

  for (let depth = 0; current && depth < 8; depth++) {
    const score = Math.max(scoreLocalizedScreenshotUploadWidget(current), inputScore);
    if (score >= 100 && isUsableLocalizedScreenshotFieldWidget(current)) {
      const imageCount = getMediaImageCountForWidget(current);
      const removeButtonCount = getMediaRemoveButtonCountForWidget(current);
      candidates.push({
        widget: current,
        mediaControlCount: imageCount + removeButtonCount,
        score: score + Math.min(25, (imageCount + removeButtonCount) * 5)
      });
    }
    current = current.parentElement;
  }

  const mediaContainer = candidates.find(candidate => candidate.mediaControlCount > 0);
  if (mediaContainer) return mediaContainer.widget;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] && candidates[0].widget || uploadWidget;
}

function getLocalizedScreenshotFieldWidgetsFromLabels() {
  const labels = getLocalizedScreenshotLabelElements()
    .map(label => ({ label, rect: getSafeElementRect(label) }))
    .filter(candidate => candidate.rect);
  if (!labels.length) return [];

  const candidateElements = Array.from(document.querySelectorAll("div,section,article,c-wiz"))
    .filter(element => !isStorePilotOwnedElement(element))
    .filter(isUsableLocalizedScreenshotFieldWidget)
    .map(element => ({ element, rect: getSafeElementRect(element) }))
    .filter(candidate => candidate.rect);

  return candidateElements
    .filter(candidate => isElementInsideLocalizedScreenshotField(candidate.element))
    .filter(candidate => labels.some(label => {
      if (candidate.rect.bottom < label.rect.top - 40) return false;
      if (candidate.rect.top - label.rect.top > 1100) return false;
      return !hasBoundaryBetween(label.rect.top, candidate.rect.top);
    }))
    .sort((a, b) => {
      const areaA = Math.max(1, a.rect.width * a.rect.height);
      const areaB = Math.max(1, b.rect.width * b.rect.height);
      return areaA - areaB;
    })
    .map(candidate => candidate.element);
}

function getLocalizedScreenshotUploadTargets() {
  return getImageUploadInputs()
    .map(input => {
      const uploadWidget = getMediaUploadWidgetForInput(input);
      const widget = getLocalizedScreenshotFieldWidgetForInput(input);
      return {
        widget,
        uploadWidget,
        input,
        score: Math.max(
          scoreLocalizedScreenshotUploadWidget(widget),
          scoreLocalizedScreenshotUploadWidget(uploadWidget),
          scoreLocalizedScreenshotUploadInput(input)
        )
      };
    })
    .filter(candidate => isElementInsideLocalizedScreenshotField(candidate.input) ||
      isElementInsideLocalizedScreenshotField(candidate.uploadWidget))
    .filter(candidate => candidate.widget && candidate.input && candidate.score >= 100)
    .sort((a, b) => b.score - a.score);
}

function getLocalizedScreenshotUploadWidgets() {
  return Array.from(new Set(getLocalizedScreenshotUploadTargets()
    .map(candidate => candidate.widget)
    .concat(getLocalizedScreenshotFieldWidgetsFromLabels())
  ));
}

function getMediaUploadDiagnostics() {
  const localizedWidgets = new Set(getLocalizedScreenshotUploadWidgets());
  const widgets = Array.from(new Set([
    ...Array.from(document.querySelectorAll("[data-image-upload-type]")),
    ...localizedWidgets
  ]));
  const targets = widgets.map((widget, index) => {
    const input = widget.querySelector("input[type='file']");
    const visibleImages = Array.from(widget.querySelectorAll("img"))
      .filter(image => isVisible(image) && image.getAttribute("src"));
    const removeButtons = Array.from(widget.querySelectorAll("[aria-label]"))
      .map(element => element.getAttribute("aria-label") || "")
      .filter(label => /remove|entfernen|löschen|delete/i.test(label));

    return {
      index,
      kind: localizedWidgets.has(widget) ? "localizedScreenshots" : getMediaUploadTypeName(widget),
      uploadType: widget.dataset.imageUploadType || "",
      isGlobal: widget.dataset.isGlobal || "",
      jsname: widget.getAttribute("jsname") || "",
      hasFileInput: Boolean(input),
      accept: input ? input.getAttribute("accept") || "" : "",
      multiple: input ? Boolean(input.multiple) : false,
      hasVisibleExistingImage: visibleImages.length > 0,
      existingImageCount: visibleImages.length,
      removeButtonLabels: removeButtons,
      localizedScore: scoreLocalizedScreenshotUploadWidget(widget),
      contextSample: getNearbyMediaContext(widget).slice(0, 220),
      dropText: getVisibleText(widget.querySelector(".ubUOie") || widget.querySelector("[role='button']")),
      elementTextSample: getVisibleText(widget).slice(0, 160)
    };
  });

  return {
    total: targets.length,
    byKind: targets.reduce((counts, target) => ({
      ...counts,
      [target.kind]: (counts[target.kind] || 0) + 1
    }), {}),
    targets
  };
}

function getMediaUploadWidgets(kind) {
  if (kind === "localizedScreenshots") {
    return getLocalizedScreenshotUploadWidgets();
  }

  const widgets = Array.from(document.querySelectorAll("[data-image-upload-type]"))
    .filter(widget => getMediaUploadTypeName(widget) === kind)
    .filter(widget => kind !== "screenshots" || widget.dataset.isGlobal === "true" || scoreLocalizedScreenshotUploadWidget(widget) < 100);
  const globalWidgets = widgets.filter(widget => widget.dataset.isGlobal === "true");

  return globalWidgets.length ? globalWidgets : widgets;
}

function getLocalizedScreenshotMediaImages() {
  const bounds = getLocalizedScreenshotFieldBounds();
  if (!bounds) return [];

  return Array.from(document.querySelectorAll("img"))
    .filter(image => isVisible(image) && image.getAttribute("src"))
    .filter(image => isElementInsideLocalizedScreenshotBounds(image, bounds));
}

function isMediaRemoveButton(button) {
  if (!button || button.getAttribute("aria-disabled") === "true") return false;
  if (!isVisible(button)) return false;
  const label = normalizeLanguageText(button.getAttribute("aria-label") || "");
  return button.getAttribute("jsname") === "LCoeQd" ||
    /remove|delete|entfernen|loschen/.test(label);
}

function getLocalizedScreenshotRemoveButtons() {
  const bounds = getLocalizedScreenshotFieldBounds();
  if (!bounds) return [];

  return Array.from(document.querySelectorAll("[role='button'][aria-label], [jsname='LCoeQd']"))
    .filter(isMediaRemoveButton)
    .filter(button => isElementInsideLocalizedScreenshotBounds(button, bounds));
}

function getLocalizedScreenshotProgressElements() {
  const bounds = getLocalizedScreenshotFieldBounds();
  if (!bounds) return [];

  return Array.from(document.querySelectorAll("[role='progressbar']"))
    .filter(isVisible)
    .filter(element => isElementInsideLocalizedScreenshotBounds(element, bounds));
}

function queryDashboardElementsAny(selectors) {
  const elements = new Set();
  selectors.forEach(selector => {
    try {
      Array.from(document.querySelectorAll(selector)).forEach(element => elements.add(element));
    } catch (_error) {
      // Ignore selectors unsupported by a test shim or browser quirk.
    }
  });
  return Array.from(elements);
}

function isLocalizedScreenshotUploadErrorText(text) {
  const normalized = normalizeLanguageText(text);
  return /error|unknown error|failed|could not upload|couldn t upload|image upload failed|fehler|unbekannter fehler/.test(normalized);
}

function getLocalizedScreenshotUploadErrorMessage() {
  const bounds = getLocalizedScreenshotFieldBounds();
  if (!bounds) return "";

  return queryDashboardElementsAny([
    "[role='alert']",
    "[aria-live]",
    ".e16bl",
    ".J5br2e"
  ])
    .filter(isVisible)
    .filter(element => isElementInsideLocalizedScreenshotBounds(element, bounds))
    .map(getVisibleText)
    .map(text => String(text || "").trim())
    .filter(text => text && text.length <= 260)
    .find(isLocalizedScreenshotUploadErrorText) || "";
}

function hasDashboardCloseIconSvg(element) {
  if (!element || typeof element.querySelectorAll !== "function") return false;
  return Array.from(element.querySelectorAll("svg")).some(svg => {
    const viewBox = svg.getAttribute && svg.getAttribute("viewBox");
    const className = typeof svg.className === "string"
      ? svg.className
      : svg.className && typeof svg.className.baseVal === "string"
        ? svg.className.baseVal
        : "";
    return viewBox === "0 0 48 48" || /\bl3jvA\b/.test(className);
  });
}

function getLocalizedScreenshotUploadErrorDismissButtons() {
  const bounds = getLocalizedScreenshotFieldBounds();
  if (!bounds) return [];

  const buttons = queryDashboardElementsAny([
    "button",
    "[role='button']",
    "[aria-label]",
    "[jsname='P0Jxu']"
  ]);
  queryDashboardElementsAny([
    "svg.l3jvA",
    "svg[viewBox='0 0 48 48']"
  ]).forEach(svg => {
    const button = svg.closest && svg.closest("button,[role='button'],[aria-label]");
    if (button) buttons.push(button);
  });

  return Array.from(new Set(buttons))
    .filter(isVisible)
    .filter(element => isElementInsideLocalizedScreenshotBounds(element, bounds))
    .filter(element => element.tagName === "BUTTON" || element.matches("[role='button']") || element.getAttribute("aria-label"))
    .filter(element => {
      const label = normalizeLanguageText([
        element.getAttribute("aria-label") || "",
        getVisibleText(element)
      ].filter(Boolean).join(" "));
      return element.getAttribute("jsname") === "P0Jxu" ||
        /close|dismiss|ok|schliessen|schlie en/.test(label) ||
        hasDashboardCloseIconSvg(element);
    });
}

function dismissLocalizedScreenshotUploadErrors() {
  const message = getLocalizedScreenshotUploadErrorMessage();
  if (!message) return "";

  getLocalizedScreenshotUploadErrorDismissButtons()
    .forEach(button => activateDashboardButton(button));
  return message;
}

function getLocalizedScreenshotActionElement() {
  const uploadTarget = getAvailableMediaUploadInput("localizedScreenshots");
  if (uploadTarget && uploadTarget.input) {
    return getMediaUploadAnchorElement(uploadTarget.input);
  }

  const removeButton = getLocalizedScreenshotRemoveButtons()[0];
  if (removeButton) return removeButton;

  const image = getLocalizedScreenshotMediaImages()[0];
  if (image) return image.closest("div") || image;

  const bounds = getLocalizedScreenshotFieldBounds();
  return bounds && bounds.label || null;
}

function getVisibleMediaImageCount(kind) {
  if (kind === "localizedScreenshots") {
    return getLocalizedScreenshotMediaImages().length;
  }

  const images = new Set();
  getMediaUploadWidgets(kind).forEach(widget => {
    Array.from(widget.querySelectorAll("img"))
      .filter(image => isVisible(image) && image.getAttribute("src"))
      .forEach(image => images.add(image));
  });
  return images.size;
}

function hasMediaUploadInProgress(kind) {
  if (kind === "localizedScreenshots") {
    return getLocalizedScreenshotProgressElements().length > 0;
  }

  return getMediaUploadWidgets(kind).some(widget => {
    const hasVisibleProgress = Array.from(widget.querySelectorAll("[role='progressbar']"))
      .some(isVisible);
    if (hasVisibleProgress) return true;

    const visibleText = Array.from(widget.querySelectorAll("*"))
      .filter(isVisible)
      .map(element => element.textContent || "")
      .join(" ");
    return /in bearbeitung|processing|uploading|hochlad|in progress/i.test(visibleText);
  });
}

function hasExistingOrProcessingMedia(kind) {
  return getVisibleMediaImageCount(kind) > 0 || hasMediaUploadInProgress(kind);
}

