(function () {
  const STOREPILOT_FIREFOX_IMPORT_MESSAGE =
    getMessage("firefoxImportPrompt", "Firefox will ask for confirmation before letting StorePilot read the selected project folder. That prompt is expected.");

  function getApi() {
    return globalThis.browser || globalThis.chrome;
  }

  function getMessage(key, fallback) {
    const api = globalThis.browser || globalThis.chrome;
    return api && api.i18n && api.i18n.getMessage
      ? api.i18n.getMessage(key) || fallback
      : fallback;
  }

  function cloneButtonWithoutListeners(button) {
    const clone = button.cloneNode(true);
    button.replaceWith(clone);
    return clone;
  }

  function removeElement(element) {
    if (element) element.remove();
  }

  function hideElement(element) {
    if (element) element.hidden = true;
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
    removeElement(document.getElementById("syncAllProjects"));
    removeElement(document.getElementById("syncProject"));
    removeElement(document.getElementById("clearListings"));
    removeElement(document.getElementById("listingFiles") && document.getElementById("listingFiles").closest(".file-button"));

    const importFolder = document.getElementById("importFolder");
    if (importFolder) {
      importFolder.title = STOREPILOT_FIREFOX_IMPORT_MESSAGE;
      importFolder.addEventListener("click", () => setStatus(STOREPILOT_FIREFOX_IMPORT_MESSAGE));
    }

    document.querySelectorAll(".hint").forEach(hint => {
      if (hint.dataset.i18n === "importHintFlexible") {
        hint.textContent = getMessage(
          "firefoxImportHintFlexible",
          "Select a project root, a store-listing folder, or a direct listing folder. Firefox will ask you to confirm folder access."
        );
      }
    });
  }

  function patchPopup() {
    removeElement(document.getElementById("listingFiles") && document.getElementById("listingFiles").closest(".file-button"));
    removeElement(document.getElementById("syncProject"));
    removeElement(document.getElementById("fillField"));
    removeElement(document.getElementById("copyText"));
    removeElement(document.getElementById("diagnosePage"));
    removeElement(document.getElementById("openOptions"));

    const localeSelect = document.getElementById("localeSelect");
    removeElement(localeSelect && localeSelect.closest(".project-picker"));

    const importFolder = document.getElementById("importFolder");
    const button = importFolder && cloneButtonWithoutListeners(importFolder);
    if (!button) return;

    button.textContent = getMessage("openProjectImport", "Open project import");
    button.title = getMessage("firefoxImportHandledInOptions", "Firefox folder import is handled in the options tab, where the folder confirmation prompt can complete reliably.");
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
