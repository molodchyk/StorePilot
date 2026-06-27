(function () {
  if (window.__storePilotMediaUploadBridgeInstalled) return;
  window.__storePilotMediaUploadBridgeInstalled = true;

  const UPLOAD_TYPE_BY_KIND = {
    storeIcon: "5",
    screenshots: "4",
    smallPromo: "1",
    marqueePromo: "3"
  };
  const MEDIA_UPLOAD_TARGET_ID_ATTRIBUTE = "data-storepilot-upload-target-id";

  function normalizeText(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function isVisible(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none";
  }

  function getVisibleText(element) {
    return (element && element.textContent || "").replace(/\s+/g, " ").trim();
  }

  function getImageUploadInputs() {
    return Array.from(document.querySelectorAll("input[type='file']"))
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
        const text = normalizeText(getVisibleText(button));
        return /drop image here|image here|drop.*image/.test(text);
      }) ||
      null;
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

    return normalizeText(contextParts.filter(Boolean).join(" ").slice(0, 3000));
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

  function findMarkedUploadInput(targetId) {
    if (!targetId) return null;
    const selector = `[${MEDIA_UPLOAD_TARGET_ID_ATTRIBUTE}='${String(targetId).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}']`;
    const marked = document.querySelector(selector);
    if (!marked) return null;
    if (marked.matches && marked.matches("input[type='file']")) return marked;
    return marked.querySelector && marked.querySelector("input[type='file']");
  }

  function getLocalizedScreenshotWidgets() {
    return getImageUploadInputs()
      .map(input => {
        const widget = getMediaUploadWidgetForInput(input);
        return {
          widget,
          score: scoreLocalizedScreenshotUploadWidget(widget)
        };
      })
      .filter(candidate => candidate.widget && candidate.score >= 100)
      .sort((a, b) => b.score - a.score)
      .map(candidate => candidate.widget);
  }

  function getWidgets(kind) {
    if (kind === "localizedScreenshots") {
      return getLocalizedScreenshotWidgets();
    }

    const uploadType = UPLOAD_TYPE_BY_KIND[kind] || "";
    const widgets = Array.from(document.querySelectorAll("[data-image-upload-type]"))
      .filter(widget => widget.dataset.imageUploadType === uploadType)
      .filter(widget => kind !== "screenshots" || widget.dataset.isGlobal === "true" || scoreLocalizedScreenshotUploadWidget(widget) < 100);
    const globalWidgets = widgets.filter(widget => widget.dataset.isGlobal === "true");
    return globalWidgets.length ? globalWidgets : widgets;
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

  function createFile(payload) {
    return new File([payload.buffer], payload.name, {
      type: payload.type || "application/octet-stream",
      lastModified: payload.lastModified || Date.now()
    });
  }

  function uploadFiles(kind, filePayloads, targetId = "") {
    const markedInput = findMarkedUploadInput(targetId);
    const widget = markedInput ? getMediaUploadWidgetForInput(markedInput) : getWidgets(kind)[0];
    if (!widget) {
      return { ok: false, message: `${kind}: upload widget not found` };
    }

    const input = markedInput || widget.querySelector("input[type='file']");
    if (!input) {
      return { ok: false, message: `${kind}: file input not found` };
    }

    const button = getMediaUploadDropButton(widget);
    const dropTarget = button || widget || input;
    const dataTransfer = new DataTransfer();

    filePayloads.map(createFile).forEach(file => dataTransfer.items.add(file));
    for (const target of [widget, button, input].filter(Boolean)) {
      dispatchDataTransferEvent(target, "dragenter", dataTransfer);
      dispatchDataTransferEvent(target, "dragover", dataTransfer);
    }
    dispatchDataTransferEvent(dropTarget, "drop", dataTransfer);

    return {
      ok: true,
      droppedFileCount: dataTransfer.files ? dataTransfer.files.length : 0,
      uploadType: widget.dataset.imageUploadType || "",
      isGlobal: widget.dataset.isGlobal || "",
      localizedScore: scoreLocalizedScreenshotUploadWidget(widget)
    };
  }

  window.addEventListener("message", event => {
    const message = event.data;
    if (!message || message.source !== "storepilot-content-script" || message.type !== "storepilot-upload-media-main-world") {
      return;
    }

    let result;
    try {
      result = uploadFiles(message.kind, message.files || [], message.targetId || "");
    } catch (error) {
      result = {
        ok: false,
        message: error && error.message ? error.message : String(error)
      };
    }

    window.postMessage({
      source: "storepilot-media-upload-bridge",
      type: "storepilot-upload-media-main-world-result",
      requestId: message.requestId,
      result
    }, "*");
  });
})();
