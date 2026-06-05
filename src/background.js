(function () {
  const api = globalThis.browser;

  function text(key, fallback, substitutions) {
    return typeof storePilotText === "function" ? storePilotText(key, fallback, substitutions) : substitutions
      ? substitutions.reduce((message, value, index) => message.replace(`$${index + 1}`, value), fallback)
      : fallback;
  }

  function normalizePathParts(path) {
    return String(path || "")
      .replace(/\\/g, "/")
      .split("/")
      .map(part => part.trim())
      .filter(Boolean);
  }

  async function getFileFromProjectPath(rootHandle, storedPath) {
    const pathParts = normalizePathParts(storedPath);
    if (pathParts[0] === rootHandle.name) {
      pathParts.shift();
    }

    if (!pathParts.length) {
      throw new Error(`Invalid media path: ${storedPath}`);
    }

    let handle = rootHandle;
    for (const part of pathParts.slice(0, -1)) {
      handle = await handle.getDirectoryHandle(part);
    }

    return (await handle.getFileHandle(pathParts[pathParts.length - 1])).getFile();
  }

  function hasResolvedMediaFiles(files, kind = "") {
    if (!files) return false;
    if ((!kind || kind === "storeIcon") && files.storeIcon) return true;
    if (!kind || kind === "screenshots") {
      if ((files.screenshots || []).length) return true;
    }
    if ((!kind || kind === "smallPromo") && files.smallPromo) return true;
    if ((!kind || kind === "marqueePromo") && files.marqueePromo) return true;
    return false;
  }

  async function resolveMediaFilesForActiveProject(requestAccess = false, kind = "") {
    const state = await storePilotGetProjectsState();
    const project = state.projects.find(candidate => candidate.id === state.activeProjectId) || state.projects[0] || null;

    if (!project) {
      return { ok: false, message: text("noActiveProject", "No active project") };
    }

    if (!project.mediaAssets) {
      return { ok: false, message: text("mediaAssetsNotScanned", "Not scanned") };
    }

    const storedMediaFiles = typeof storePilotGetProjectMediaFiles === "function"
      ? await storePilotGetProjectMediaFiles(project.id)
      : null;
    const filteredStoredMediaFiles = typeof storePilotFilterMediaFilesByKind === "function"
      ? storePilotFilterMediaFilesByKind(storedMediaFiles, kind)
      : storedMediaFiles;

    if (hasResolvedMediaFiles(filteredStoredMediaFiles, kind)) {
      return {
        ok: true,
        projectName: project.name,
        files: filteredStoredMediaFiles
      };
    }

    const directoryHandle = await storePilotGetProjectHandle(project.id);
    if (!directoryHandle) {
      return { ok: false, message: text("reimportProjectFolderForMediaUpload", "Re-import the project folder so StorePilot can store the media files for upload.") };
    }

    if (!(await storePilotCanReadHandle(directoryHandle, requestAccess))) {
      return { ok: false, message: text("folderPermissionNeeded", "Folder permission is needed before reading media files.") };
    }

    const screenshots = [];
    const wantedStoreIcon = !kind || kind === "storeIcon";
    const wantedScreenshots = !kind || kind === "screenshots";
    const wantedSmallPromo = !kind || kind === "smallPromo";
    const wantedMarqueePromo = !kind || kind === "marqueePromo";

    const storeIcon = wantedStoreIcon && project.mediaAssets.storeIcon
      ? await getFileFromProjectPath(directoryHandle, project.mediaAssets.storeIcon.path)
      : null;

    for (const asset of wantedScreenshots ? project.mediaAssets.screenshots || [] : []) {
      screenshots.push(await getFileFromProjectPath(directoryHandle, asset.path));
    }

    const smallPromo = wantedSmallPromo && project.mediaAssets.smallPromo
      ? await getFileFromProjectPath(directoryHandle, project.mediaAssets.smallPromo.path)
      : null;
    const marqueePromo = wantedMarqueePromo && project.mediaAssets.marqueePromo
      ? await getFileFromProjectPath(directoryHandle, project.mediaAssets.marqueePromo.path)
      : null;

    return {
      ok: true,
      projectName: project.name,
      files: {
        storeIcon,
        screenshots,
        smallPromo,
        marqueePromo
      }
    };
  }

  async function getActiveDashboardTab(sender) {
    if (sender && sender.tab && sender.tab.id) {
      return sender.tab;
    }

    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    return tabs && tabs[0];
  }

  async function uploadMediaToDashboard(sender, requestAccess = false, kind = "") {
    const tab = await getActiveDashboardTab(sender);
    if (!tab || !tab.id) {
      return { ok: false, message: text("noActiveTab", "No active tab.") };
    }

    const resolved = await resolveMediaFilesForActiveProject(requestAccess, kind);
    if (!resolved.ok) return resolved;

    return api.tabs.sendMessage(tab.id, {
      type: "storepilot-upload-media-assets",
      files: resolved.files,
      kind,
      projectName: resolved.projectName
    });
  }

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === "openOptionsPage") {
      if (api.runtime.openOptionsPage) {
        api.runtime.openOptionsPage();
      } else {
        api.tabs.create({ url: api.runtime.getURL("src/options/options.html") });
      }
      sendResponse({ ok: true });
    }

    if (message && message.type === "storepilot-upload-media-assets-from-project") {
      uploadMediaToDashboard(sender, Boolean(message.requestAccess), message.kind || "")
        .then(sendResponse)
        .catch(error => sendResponse({
          ok: false,
          message: text("mediaUploadFailed", "Media upload failed: $1", [error.message || String(error)])
        }));
      return true;
    }
  });
  // Conditionally open popup on devconsole pages, otherwise go to options
  api.action.onClicked.addListener(() => {
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      const url = tab && tab.url ? tab.url : '';
      const isDevConsole = url.includes('/devconsole/');
      const isWebstore = url.includes('chrome.google.com/webstore') || url.includes('chromewebstore.google.com');
      const isOptions = url.includes('src/options/options.html');

      if (isDevConsole) {
        // If the action API supports it, set the popup for this tab and open it
        if (api.action && typeof api.action.setPopup === "function" && typeof api.action.openPopup === "function") {
          api.action.setPopup({ tabId: tab.id, popup: "src/popup/popup.html" });
          api.action.openPopup();
        } else {
          // Fallback: open the options page (no popup support)
          if (api.runtime.openOptionsPage) {
            api.runtime.openOptionsPage();
          } else {
            api.tabs.create({ url: api.runtime.getURL('src/options/options.html') });
          }
        }
        return;
      }

      // For non‑devconsole pages, redirect to options unless we are on the public Web Store or already on options
      if (!(isWebstore && !isDevConsole) && !isOptions) {
        if (api.runtime.openOptionsPage) {
          api.runtime.openOptionsPage();
        } else {
          api.tabs.create({ url: api.runtime.getURL('src/options/options.html') });
        }
      }
      // Otherwise do nothing
    });
  });
})();
