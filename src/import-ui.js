(function () {
  const STOREPILOT_FOLDER_ACCESS_MESSAGE =
    getMessage("folderAccessPrompt", "StorePilot will ask for confirmation before reading the selected project folder. That prompt is expected.");

  function getApi() {
    return globalThis.browser;
  }

  function getMessage(key, fallback) {
    const api = globalThis.browser;
    return api && api.i18n && api.i18n.getMessage
      ? api.i18n.getMessage(key) || fallback
      : fallback;
  }

  function cloneButtonWithoutListeners(button) {
    const clone = button.cloneNode(true);
    button.replaceWith(clone);
    return clone;
  }

  function setStatus(message, isError = false) {
    const status = document.getElementById("importStatus") || document.getElementById("status");
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function openOptionsPage() {
    const api = getApi();
    if (api && api.runtime && typeof api.runtime.openOptionsPage === "function") {
      api.runtime.openOptionsPage();
      return;
    }

    if (api && api.tabs && api.runtime && typeof api.runtime.getURL === "function") {
      api.tabs.create({ url: api.runtime.getURL("src/options/options.html") });
    }
  }

  function patchOptionsPage() {
    const importFolder = document.getElementById("importFolder");
    if (importFolder) {
      importFolder.title = STOREPILOT_FOLDER_ACCESS_MESSAGE;
      importFolder.addEventListener("click", () => setStatus(STOREPILOT_FOLDER_ACCESS_MESSAGE));
    }

    document.querySelectorAll(".hint").forEach(hint => {
      if (hint.dataset.i18n === "importHintFlexible") {
        hint.textContent = getMessage(
          "folderImportHintFlexible",
          "Select a project root, a store-listing folder, or a direct listing folder. StorePilot will ask you to confirm folder access."
        );
      }
    });
  }

  function patchPopup() {
    const importFolder = document.getElementById("importFolder");
    const button = importFolder && cloneButtonWithoutListeners(importFolder);
    if (!button) return;

    button.textContent = getMessage("openProjectImport", "Open project import");
    button.title = getMessage("folderImportHandledInOptions", "Folder import is handled in the options tab, where the folder confirmation prompt can complete reliably.");
    button.addEventListener("click", () => {
      setStatus(getMessage("openingProjectImport", "Opening project import..."));
      openOptionsPage();
      window.close();
    });
  }

  if (document.getElementById("dropZone")) {
    patchOptionsPage();
  } else {
    patchPopup();
  }
})();
