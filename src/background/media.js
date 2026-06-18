(function () {
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

  async function resolveMediaFilesForActiveProject(requestAccess = false, kind = "", dashboardUrl = "") {
    const state = await storePilotGetProjectsState();
    const resolved = typeof storePilotResolveProjectForDashboard === "function"
      ? await storePilotResolveProjectForDashboard({ url: dashboardUrl })
      : {};
    const project = resolved.project ||
      state.projects.find(candidate => candidate.id === state.activeProjectId) ||
      state.projects[0] ||
      null;

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

    const tabs = await storePilotTabsQuery({ active: true, currentWindow: true });
    return tabs && tabs[0];
  }

  async function storePilotUploadMediaToDashboard(sender, requestAccess = false, kind = "") {
    const tab = await getActiveDashboardTab(sender);
    if (!tab || !tab.id) {
      return { ok: false, message: text("noActiveTab", "No active tab.") };
    }

    const resolved = await resolveMediaFilesForActiveProject(requestAccess, kind, tab.url || "");
    if (!resolved.ok) return resolved;

    return storePilotTabsSendMessage(tab.id, {
      type: "storepilot-upload-media-assets",
      files: resolved.files,
      kind,
      projectName: resolved.projectName
    });
  }

  globalThis.storePilotUploadMediaToDashboard = storePilotUploadMediaToDashboard;
})();
