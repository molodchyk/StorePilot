(function () {
  if (window.__storePilotMediaUploadBridgeInstalled) return;
  window.__storePilotMediaUploadBridgeInstalled = true;

  const UPLOAD_TYPE_BY_KIND = {
    storeIcon: "5",
    screenshots: "4",
    smallPromo: "1",
    marqueePromo: "3"
  };

  function getWidgets(kind) {
    const uploadType = UPLOAD_TYPE_BY_KIND[kind] || "";
    const widgets = Array.from(document.querySelectorAll("[data-image-upload-type]"))
      .filter(widget => widget.dataset.imageUploadType === uploadType);
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

  function uploadFiles(kind, filePayloads) {
    const widget = getWidgets(kind)[0];
    if (!widget) {
      return { ok: false, message: `${kind}: upload widget not found` };
    }

    const input = widget.querySelector("input[type='file']");
    if (!input) {
      return { ok: false, message: `${kind}: file input not found` };
    }

    const button = widget.querySelector("[role='button'][jsname='DagSrd']");
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
      isGlobal: widget.dataset.isGlobal || ""
    };
  }

  window.addEventListener("message", event => {
    const message = event.data;
    if (!message || message.source !== "storepilot-content-script" || message.type !== "storepilot-upload-media-main-world") {
      return;
    }

    let result;
    try {
      result = uploadFiles(message.kind, message.files || []);
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
