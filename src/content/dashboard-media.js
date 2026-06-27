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
const MEDIA_UPLOAD_BRIDGE_TIMEOUT_MS = 500;
const LOCALIZED_SCREENSHOT_OPERATION_REPLACE = "replace";
const LOCALIZED_SCREENSHOT_OPERATION_CLEAR_ONLY = "clearOnly";
const LOCALIZED_SCREENSHOT_OPERATION_UPLOAD_ONLY = "uploadOnly";

let mediaUploadBridgePromise = null;
let mediaUploadBridgeBypassed = false;
let lastMediaVisibilityFocusRequestAt = 0;

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
      if (!visible.ok) return false;
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
      if (!visible.ok) return { ok: false, count: getVisibleMediaImageCount(kind) };
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

function getDashboardLocaleSelectionState(locale) {
  if (typeof getCurrentDashboardLocale !== "function") return true;
  const currentLocale = getCurrentDashboardLocale({ includePageFallback: false }) ||
    getCurrentDashboardLocale();
  if (!currentLocale) {
    return {
      selected: false,
      known: false,
      currentLocale: ""
    };
  }

  return {
    selected: localesMatch(currentLocale, locale),
    known: true,
    currentLocale
  };
}

function isDashboardLocaleSelected(locale) {
  const state = getDashboardLocaleSelectionState(locale);
  return state === true || Boolean(state && state.selected);
}

function formatDashboardLocaleMismatch(locale) {
  return localize("clickedButDashboardShows", "Clicked $1, but the dashboard still shows $2.", [
    locale,
    typeof getCurrentDashboardLocale === "function"
      ? getCurrentDashboardLocale() || localize("unknownLocale", "an unknown locale")
      : localize("unknownLocale", "an unknown locale")
  ]);
}

async function ensureDashboardLanguageSelected(locale, options = {}) {
  const initialState = getDashboardLocaleSelectionState(locale);
  if (initialState === true || initialState.selected) {
    return { ok: true, message: "" };
  }

  const selection = await selectDashboardLanguage(locale, options.selectionOptions || {});
  if (!selection.ok) return selection;

  const verificationAttempts = Number.isFinite(options.verificationAttempts)
    ? Math.max(0, Math.floor(options.verificationAttempts))
    : 24;
  const verificationDelayMs = Number.isFinite(options.verificationDelayMs)
    ? Math.max(0, options.verificationDelayMs)
    : 250;

  for (let attempt = 0; attempt <= verificationAttempts; attempt++) {
    const state = getDashboardLocaleSelectionState(locale);
    if (state === true || state.selected) {
      return selection;
    }
    if (attempt < verificationAttempts && verificationDelayMs) {
      await delay(verificationDelayMs);
    }
  }

  const finalState = getDashboardLocaleSelectionState(locale);
  if (options.allowUnknownLocaleAfterSelection && finalState !== true && !finalState.known) {
    return selection;
  }

  return {
    ok: false,
    message: formatDashboardLocaleMismatch(locale)
  };
}

async function ensureLocalizedScreenshotUploadContext(locale) {
  const selection = await ensureDashboardLanguageSelected(locale, {
    selectionOptions: LOCALIZED_SCREENSHOT_LANGUAGE_SELECTION_OPTIONS,
    verificationAttempts: LOCALIZED_SCREENSHOT_LANGUAGE_VERIFICATION_ATTEMPTS,
    verificationDelayMs: LOCALIZED_SCREENSHOT_LANGUAGE_VERIFICATION_DELAY_MS,
    allowUnknownLocaleAfterSelection: true
  });
  if (!selection.ok) return selection;

  const fieldReady = await waitForLocalizedScreenshotFieldReady();
  if (!fieldReady.ok) {
    return {
      ok: false,
      message: localize("localizedScreenshotTargetNotFound", "Localized screenshots upload target not found on this page.")
    };
  }

  if (!isDashboardLocaleSelected(locale)) {
    const state = getDashboardLocaleSelectionState(locale);
    if (state !== true && !state.known) {
      return { ok: true, fieldReady };
    }

    return {
      ok: false,
      message: formatDashboardLocaleMismatch(locale)
    };
  }

  return { ok: true, fieldReady };
}

function dispatchDataTransferEvent(target, type, dataTransfer) {
  let event;
  try {
    event = new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      dataTransfer
    });
  } catch (_error) {
    event = new Event(type, {
      bubbles: true,
      cancelable: true,
      composed: true
    });
    Object.defineProperty(event, "dataTransfer", {
      configurable: true,
      value: dataTransfer
    });
  }

  target.dispatchEvent(event);
}

function ensureMediaUploadBridge() {
  if (mediaUploadBridgePromise) return mediaUploadBridgePromise;

  mediaUploadBridgePromise = new Promise(resolve => {
    const existing = document.querySelector("script[data-storepilot-media-upload-bridge]");
    if (existing) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    let settled = false;

    function finish(ok) {
      if (settled) return;
      settled = true;
      resolve(ok);
    }

    script.dataset.storepilotMediaUploadBridge = "true";
    script.src = storePilotRuntimeGetUrl(MEDIA_UPLOAD_BRIDGE_SCRIPT);
    script.addEventListener("load", () => finish(true), { once: true });
    script.addEventListener("error", () => finish(false), { once: true });
    (document.head || document.documentElement).append(script);
    window.setTimeout(() => finish(false), 1500);
  });

  return mediaUploadBridgePromise;
}

async function serializeMediaFiles(files) {
  const payloads = [];
  const transfers = [];

  for (const file of files.filter(Boolean)) {
    const buffer = await file.arrayBuffer();
    payloads.push({
      name: file.name,
      type: file.type || "",
      lastModified: file.lastModified || Date.now(),
      buffer
    });
    transfers.push(buffer);
  }

  return { payloads, transfers };
}

function markUploadTargetForBridge(input) {
  if (!input || typeof input.setAttribute !== "function") return "";
  const targetId = `storepilot-target-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  input.setAttribute(MEDIA_UPLOAD_TARGET_ID_ATTRIBUTE, targetId);
  const uploadWidget = getMediaUploadWidgetForInput(input);
  if (uploadWidget && typeof uploadWidget.setAttribute === "function") {
    uploadWidget.setAttribute(MEDIA_UPLOAD_TARGET_ID_ATTRIBUTE, targetId);
  }
  return targetId;
}

function clearUploadTargetBridgeMarker(input, targetId) {
  if (!targetId) return;
  const selector = `[${MEDIA_UPLOAD_TARGET_ID_ATTRIBUTE}='${String(targetId).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}']`;
  const marked = new Set(Array.from(document.querySelectorAll(selector)));
  if (input) marked.add(input);
  const uploadWidget = getMediaUploadWidgetForInput(input);
  if (uploadWidget) marked.add(uploadWidget);

  marked.forEach(element => {
    if (element && element.getAttribute && element.getAttribute(MEDIA_UPLOAD_TARGET_ID_ATTRIBUTE) === targetId) {
      element.removeAttribute(MEDIA_UPLOAD_TARGET_ID_ATTRIBUTE);
    }
  });
}

async function uploadFilesInMainWorld(kind, files, options = {}) {
  if (mediaUploadBridgeBypassed) {
    return { ok: false, message: "page bridge bypassed after timeout" };
  }

  if (!(await ensureMediaUploadBridge())) {
    mediaUploadBridgeBypassed = true;
    return { ok: false, message: "page bridge unavailable" };
  }

  const requestId = `storepilot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const { payloads, transfers } = await serializeMediaFiles(files);

  return new Promise(resolve => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      mediaUploadBridgeBypassed = true;
      resolve({ ok: false, message: "page bridge timed out" });
    }, options.timeoutMs || MEDIA_UPLOAD_BRIDGE_TIMEOUT_MS);

    function handleMessage(event) {
      const message = event.data;
      if (!message ||
        message.source !== "storepilot-media-upload-bridge" ||
        message.type !== "storepilot-upload-media-main-world-result" ||
        message.requestId !== requestId) {
        return;
      }

      window.clearTimeout(timeoutId);
      window.removeEventListener("message", handleMessage);
      resolve(message.result || { ok: false, message: "empty page bridge response" });
    }

    window.addEventListener("message", handleMessage);

    const message = {
      source: "storepilot-content-script",
      type: "storepilot-upload-media-main-world",
      requestId,
      kind,
      targetId: options.targetId || "",
      files: payloads
    };

    try {
      window.postMessage(message, "*", transfers);
    } catch (_error) {
      window.postMessage(message, "*");
    }
  });
}

async function uploadFilesInContentWorld(input, files) {
  const widget = getMediaUploadWidgetForInput(input);
  const button = getMediaUploadDropButton(widget);
  const dropTarget = button || widget || input;
  const dataTransfer = new DataTransfer();

  scrollMediaActionTargetIntoView(input);
  if (typeof dropTarget.focus === "function") {
    dropTarget.focus({ preventScroll: true });
  }

  files.filter(Boolean).forEach(file => dataTransfer.items.add(file));

  for (const target of [widget, button, input].filter(Boolean)) {
    dispatchDataTransferEvent(target, "dragenter", dataTransfer);
    dispatchDataTransferEvent(target, "dragover", dataTransfer);
  }
  dispatchDataTransferEvent(dropTarget, "drop", dataTransfer);

  input.files = dataTransfer.files;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
}

async function setUploadInputFile(input, files, forcedKind = "", options = {}) {
  const widget = getMediaUploadWidgetForInput(input);
  const kind = forcedKind || getMediaUploadTypeName(widget);
  const beforeCount = Number.isFinite(options.beforeCount) ? options.beforeCount : getVisibleMediaImageCount(kind);
  const expectedCount = Number.isFinite(options.expectedCount)
    ? options.expectedCount
    : beforeCount + files.filter(Boolean).length;
  const timeoutMs = options.timeoutMs || (kind === "localizedScreenshots"
    ? LOCALIZED_SCREENSHOT_UPLOAD_TIMEOUT_MS
    : DEFAULT_MEDIA_UPLOAD_TIMEOUT_MS);
  const targetId = markUploadTargetForBridge(input);
  const errorState = options.errorState || {};
  let method = "page bridge";

  try {
    scrollMediaActionTargetIntoView(input);
    let bridgeResult = await uploadFilesInMainWorld(kind, files, { targetId });

    if (bridgeResult.ok) {
      const uiChanged = await waitForMediaUploadUiChange(kind, beforeCount, {
        expectedCount,
        timeoutMs,
        progress: options.progress || null,
        errorState
      });
      return {
        ok: uiChanged,
        method,
        bridgeResult,
        beforeCount,
        afterCount: getVisibleMediaImageCount(kind),
        errorMessage: errorState.message || ""
      };
    }

    method = "content script";
    await uploadFilesInContentWorld(input, files);
    const uiChanged = await waitForMediaUploadUiChange(kind, beforeCount, {
      expectedCount,
      timeoutMs,
      progress: options.progress || null,
      errorState
    });

    return {
      ok: uiChanged,
      method,
      bridgeResult,
      beforeCount,
      afterCount: getVisibleMediaImageCount(kind),
      errorMessage: errorState.message || ""
    };
  } finally {
    clearUploadTargetBridgeMarker(input, targetId);
  }
}

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

function formatLocalizedScreenshotElapsedTime(elapsedMs) {
  const totalSeconds = Math.max(0, Math.floor(Number(elapsedMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

function createLocalizedScreenshotProgress(entry, localeIndex, totalLocales, stats = {}, overrides = {}) {
  const startedAt = stats.startedAt || overrides.startedAt || Date.now();
  const elapsedMs = Number.isFinite(overrides.elapsedMs)
    ? overrides.elapsedMs
    : Math.max(0, Date.now() - startedAt);

  return {
    localeIndex,
    totalLocales,
    locale: entry && entry.locale || "",
    localeScreenshotCount: entry && entry.files ? entry.files.length : 0,
    completedLocales: stats.completedLocales || 0,
    failedLocales: stats.failedLocales || 0,
    skippedLocales: stats.skippedLocales || 0,
    uploadedScreenshots: stats.uploadedScreenshots || 0,
    totalScreenshots: stats.totalScreenshots || 0,
    startedAt,
    elapsedMs,
    runId: stats.runId || overrides.runId || "",
    workerId: stats.workerId || overrides.workerId || "",
    ...overrides
  };
}

function formatLocalizedScreenshotProgressStatus(progress, phase) {
  return [
    "Localized screenshots",
    `Locale: ${progress.localeIndex + 1}/${progress.totalLocales} - ${progress.locale} (${progress.localeScreenshotCount} expected)`,
    `Run locales: ${progress.completedLocales || 0}/${progress.totalLocales} completed, ${progress.failedLocales || 0} failed, ${progress.skippedLocales || 0} skipped`,
    `Screenshots: ${progress.uploadedScreenshots || 0}/${progress.totalScreenshots || 0} uploaded`,
    `Elapsed: ${formatLocalizedScreenshotElapsedTime(progress.elapsedMs || 0)}`,
    `Current step: ${phase}`
  ].join("\n");
}

function publishLocalizedScreenshotProgress(progress, phase) {
  if (!progress || !progress.runId || !progress.workerId || typeof storePilotRuntimeSendMessage !== "function") {
    return;
  }

  try {
    const response = storePilotRuntimeSendMessage({
      type: "storepilot-localized-screenshot-progress",
      runId: progress.runId,
      workerId: progress.workerId,
      progress: {
        ...progress,
        phase,
        elapsedMs: Number.isFinite(progress.elapsedMs) ? progress.elapsedMs : 0
      }
    });
    if (response && typeof response.catch === "function") {
      response.catch(() => {});
    }
  } catch (_error) {
    // Parallel progress is best-effort; upload correctness is local to the worker.
  }
}

function setLocalizedScreenshotProgress(progress, phase) {
  setMediaOperationProgress(formatLocalizedScreenshotProgressStatus(progress, phase));
  publishLocalizedScreenshotProgress(progress, phase);
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
  while (!isDashboardPageVisibleForMediaAutomation()) {
    if (mediaOperationState.abortRequested) {
      return { ok: false, aborted: true };
    }

    const message = "paused; dashboard tab is hidden/minimized, waiting for it to be visible";
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
      if (!visible.ok) return false;
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
      return { ok: false, aborted: Boolean(visible.aborted), message: localize("operationStopped", "Stopped.") };
    }

    if (progress) {
      setLocalizedScreenshotProgress(progress, `clearing existing screenshots (visible ${beforeCount}, delete attempt ${attempt}/${LOCALIZED_SCREENSHOT_DELETE_ATTEMPTS_PER_IMAGE})`);
    }
    scrollMediaActionTargetIntoView(getLocalizedScreenshotActionElement());
    await revealMediaRemoveControls("localizedScreenshots");
    const buttons = getMediaRemoveButtons("localizedScreenshots");
    if (!buttons.length) {
      return { ok: false, message: `${label}: remove button not found` };
    }

    const button = buttons[buttons.length - 1];
    lastButtonLabel = button.getAttribute("aria-label") || label;
    scrollMediaActionTargetIntoView(button);
    dismissVisibleDashboardStatusMessages();
    activateDashboardButton(button);

    const changed = await waitForMediaRemovalAfterClick(
      "localizedScreenshots",
      beforeCount,
      LOCALIZED_SCREENSHOT_DELETE_ATTEMPT_TIMEOUT_MS,
      { progress }
    );
    const afterCount = getVisibleMediaImageCount("localizedScreenshots");
    if (changed || afterCount < beforeCount) {
      return {
        ok: true,
        removedCount: Math.max(1, beforeCount - afterCount),
        label: lastButtonLabel
      };
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

function getLocalizedScreenshotFileEntries(files) {
  return Object.entries(files && files.localizedScreenshots || {})
    .map(([locale, localeFiles]) => ({
      locale,
      files: Array.from(localeFiles || []).filter(Boolean).slice(0, MAX_DASHBOARD_SCREENSHOTS)
    }))
    .filter(entry => entry.locale && entry.files.length)
    .sort((a, b) => a.locale.localeCompare(b.locale));
}

function applyLocalizedScreenshotStartLocale(entries, startLocale) {
  const normalizedStartLocale = normalizeLocale(startLocale);
  if (!normalizedStartLocale) {
    return {
      ok: true,
      entries,
      skippedBeforeStart: []
    };
  }

  const startIndex = entries.findIndex(entry => localesMatch(entry.locale, normalizedStartLocale));
  if (startIndex < 0) {
    return {
      ok: false,
      entries: [],
      skippedBeforeStart: [],
      message: `start locale ${startLocale} was not found in localized screenshot files`
    };
  }

  return {
    ok: true,
    entries: entries.slice(startIndex),
    skippedBeforeStart: startIndex > 0
      ? [`${startIndex} locale(s) before start locale ${startLocale}`]
      : []
  };
}

function normalizeLocalizedScreenshotAssignedLocales(assignedLocales) {
  if (!Array.isArray(assignedLocales)) return [];

  const seen = new Set();
  const normalized = [];
  for (const locale of assignedLocales) {
    const normalizedLocale = normalizeLocale(locale);
    if (!normalizedLocale || seen.has(normalizedLocale)) continue;
    seen.add(normalizedLocale);
    normalized.push(normalizedLocale);
  }
  return normalized;
}

function applyLocalizedScreenshotAssignedLocales(entries, assignedLocales) {
  const normalizedAssignedLocales = normalizeLocalizedScreenshotAssignedLocales(assignedLocales);
  const assignedSet = new Set(normalizedAssignedLocales);
  const filteredEntries = entries.filter(entry => assignedSet.has(normalizeLocale(entry.locale)));
  const foundLocales = new Set(filteredEntries.map(entry => normalizeLocale(entry.locale)));
  const missingAssignedLocales = normalizedAssignedLocales
    .filter(locale => !foundLocales.has(locale))
    .map(locale => `${locale}: assigned locale has no localized screenshot files`);

  return {
    entries: filteredEntries,
    skippedAssignedLocales: missingAssignedLocales,
    assignedLocales: normalizedAssignedLocales
  };
}

function normalizeLocalizedScreenshotOperation(value) {
  return [
    LOCALIZED_SCREENSHOT_OPERATION_REPLACE,
    LOCALIZED_SCREENSHOT_OPERATION_CLEAR_ONLY,
    LOCALIZED_SCREENSHOT_OPERATION_UPLOAD_ONLY
  ].includes(value)
    ? value
    : LOCALIZED_SCREENSHOT_OPERATION_REPLACE;
}

function countLocalizedScreenshotSkippedLocales(skipped) {
  return skipped.reduce((count, item) => {
    const match = String(item || "").match(/^(\d+) locale\(s\) before start locale\b/);
    return count + (match ? Number(match[1]) : 1);
  }, 0);
}

async function resolveLocalizedScreenshotUploadTarget(currentTarget) {
  if (currentTarget && currentTarget.input && currentTarget.input.isConnected) {
    return currentTarget;
  }

  return waitForAvailableMediaUploadInput("localizedScreenshots");
}

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
      return { ok: false, aborted: Boolean(visible.aborted), message: localize("operationStopped", "Stopped."), target };
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

    try {
      dismissVisibleDashboardStatusMessages();
      dismissLocalizedScreenshotUploadErrors();
      const beforeCount = getVisibleMediaImageCount("localizedScreenshots");
      const errorState = {};
      const result = await setUploadInputFile(target.input, [file], "localizedScreenshots", {
        beforeCount,
        expectedCount: beforeCount + 1,
        timeoutMs: LOCALIZED_SCREENSHOT_UPLOAD_TIMEOUT_MS,
        progress,
        errorState
      });
      const afterCount = result.afterCount;
      const addedCount = afterCount - beforeCount;

      if (afterCount > MAX_DASHBOARD_SCREENSHOTS) {
        return {
          ok: false,
          aborted: true,
          message: `${entry.locale} screenshot ${fileIndex + 1}: CWS exceeded the ${MAX_DASHBOARD_SCREENSHOTS} screenshot limit`,
          target
        };
      }
      if (addedCount > 1) {
        return {
          ok: false,
          aborted: true,
          message: `${entry.locale} screenshot ${fileIndex + 1}: CWS added ${addedCount} screenshots for one upload; stopped to avoid duplicates`,
          target
        };
      }
      if (addedCount === 1) {
        if (!isDashboardLocaleSelected(entry.locale)) {
          return {
            ok: false,
            aborted: true,
            message: `${entry.locale} screenshot ${fileIndex + 1}: dashboard locale changed during upload; stopped to avoid writing to the wrong locale`,
            target
          };
        }
        setLocalizedScreenshotProgress(progress, `uploaded screenshot ${fileIndex + 1}/${entry.files.length} (visible ${afterCount})`);
        return { ok: true, target };
      }

      lastMessage = result.errorMessage
        ? `${entry.locale} screenshot ${fileIndex + 1}: ${result.errorMessage}`
        : `${entry.locale} screenshot ${fileIndex + 1}: CWS still shows ${afterCount} screenshot(s) after upload (${result.method})`;
    } catch (error) {
      lastMessage = `${entry.locale} screenshot ${fileIndex + 1}: ${error.message || String(error)}`;
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
    return { ok: false, aborted: Boolean(visible.aborted), uploadedCount: 0, message: localize("operationStopped", "Stopped.") };
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
        uploadedCount: 0,
        completed: false,
        message: `${entry.locale}: CWS still shows ${clearWait.count} localized screenshot(s) after clear`
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

async function performUploadLocalizedScreenshots(files, options = {}) {
  const startedAt = Date.now();
  const uploaded = [];
  const failed = [];
  const skipped = [];
  const completed = [];
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
        startedAt,
        runId: options.parallelRunId || options.runId || "",
        workerId: options.parallelWorkerId || options.workerId || ""
      }, operation);
      localeUploadedCount = Math.max(localeUploadedCount, localeResult.uploadedCount || 0);

      if (localeResult.ok) {
        localeFailures.length = 0;
        localeUploadedCount = localeResult.uploadedCount || 0;
        break;
      }

      localeFailures.push(localeResult.message);
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

    if (mediaOperationState.abortRequested) {
      aborted = true;
      break;
    }
  }

  const skippedLocaleCount = countLocalizedScreenshotSkippedLocales(skipped);
  const elapsedMs = Date.now() - startedAt;
  const operationLabel = operation === LOCALIZED_SCREENSHOT_OPERATION_CLEAR_ONLY
    ? "clear"
    : operation === LOCALIZED_SCREENSHOT_OPERATION_UPLOAD_ONLY
      ? "upload-only"
      : "upload";
  const runSummary = `Localized screenshot ${operationLabel} ${aborted ? "stopped" : "finished"}: ${completed.length}/${entries.length} run locale(s) completed, ${uploadedScreenshotCount}/${totalScreenshots} screenshot(s) uploaded, ${skippedLocaleCount} locale(s) skipped, ${failed.length} failed. Elapsed: ${formatLocalizedScreenshotElapsedTime(elapsedMs)}.`;
  const messageParts = [
    runSummary,
    aborted ? localize("operationStopped", "Stopped.") : "",
    skipped.length ? localize("mediaSkipped", "Skipped: $1.", [skipped.join(", ")]) : "",
    failed.length ? localize("mediaUploadFailures", "Failed: $1.", [failed.join(", ")]) : ""
  ].filter(Boolean);

  return {
    ok: failed.length === 0 && (completed.length > 0 || uploaded.length > 0 || skipped.length > 0),
    aborted,
    message: messageParts.join(" "),
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
