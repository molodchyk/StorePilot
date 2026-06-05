(function () {
  function text(key, fallback) {
    return typeof storePilotText === "function" ? storePilotText(key, fallback) : fallback;
  }

  const GENERIC_PROJECT_FOLDER_NAMES = new Set([
    "chrome",
    "chrome-web-store",
    "listing",
    "listings",
    "metadata",
    "store-listing",
    "store-listings",
    "web-store"
  ]);

  function normalizePathParts(path) {
    return String(path || "")
      .replace(/\\/g, "/")
      .split("/")
      .map(part => part.trim())
      .filter(Boolean);
  }

  function normalizeIdentity(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function isGenericProjectName(value) {
    const normalized = String(value || "").toLowerCase().replace(/\s+/g, "-");
    return GENERIC_PROJECT_FOLDER_NAMES.has(normalized);
  }

  function hashText(value) {
    let hash = 2166136261;
    const text = String(value || "");

    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(36);
  }

  function createListingSignature(listings) {
    return Object.entries(listings || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([locale, text]) => `${locale}:${String(text || "").length}:${hashText(text)}`)
      .join("|");
  }

  function getProjectRootInfo(source, fallbackName) {
    const candidate = source && typeof source === "object" ? source : { path: source };
    const pathParts = normalizePathParts(candidate.path);
    const lowerParts = pathParts.map(part => part.toLowerCase());
    const storeListingIndex = lowerParts.findIndex(part => part === "store-listing" || part === "store-listings");
    const knownStoreIndex = lowerParts.findIndex(part => (
      part === "chrome-web-store" ||
      part === "edge-add-ons" ||
      part === "opera-add-ons"
    ));

    let rootParts = [];
    const evidenceRootParts = normalizePathParts(candidate.projectRootPath);

    if (evidenceRootParts.length && evidenceRootParts.length < pathParts.length) {
      rootParts = evidenceRootParts;
    } else if (storeListingIndex > 0) {
      rootParts = pathParts.slice(0, storeListingIndex);
    } else if (knownStoreIndex > 0) {
      rootParts = pathParts.slice(0, knownStoreIndex);
    } else if (pathParts.length > 1 && !GENERIC_PROJECT_FOLDER_NAMES.has(lowerParts[0])) {
      rootParts = [pathParts[0]];
    } else if (fallbackName && !GENERIC_PROJECT_FOLDER_NAMES.has(String(fallbackName).toLowerCase())) {
      rootParts = [fallbackName];
    }

    const rootPath = rootParts.join("/");
    const rootName = rootParts[rootParts.length - 1] || "";

    return {
      rootPath,
      rootName,
      listingPath: pathParts.join("/"),
      rootScore: candidate.projectRootScore || 0,
      rootSignals: candidate.projectRootSignals || []
    };
  }

  function getProjectNameCandidates(bestPath, fallbackName, rootInfo) {
    const candidates = new Set([
      rootInfo.rootName,
      rootInfo.rootPath,
      fallbackName,
      storePilotFormatProjectName(rootInfo.rootName || fallbackName),
      ...storePilotGetProjectNameCandidates(bestPath, fallbackName)
    ]);

    return Array.from(candidates)
      .map(candidate => String(candidate || "").trim())
      .filter(Boolean);
  }

  function hasSameListings(project, listingSignature) {
    if (!listingSignature) return false;
    if (project.listingSignature === listingSignature) return true;
    return createListingSignature(project.listings) === listingSignature;
  }

  function findExistingProjectByImportIdentity(state, options) {
    const {
      projectId = "",
      names = [],
      sourcePath = "",
      projectRootPath = "",
      listingPath = "",
      listingSignature = ""
    } = options || {};

    if (projectId) {
      const project = state.projects.find(candidate => candidate.id === projectId);
      if (project) return project;
    }

    const normalizedSourcePath = storePilotNormalizeSourcePath(sourcePath);
    const normalizedProjectRootPath = storePilotNormalizeSourcePath(projectRootPath);
    const normalizedListingPath = storePilotNormalizeSourcePath(listingPath);

    const pathMatch = state.projects.find(project => {
      const storedSourcePath = storePilotNormalizeSourcePath(project.sourcePath);
      const storedProjectRootPath = storePilotNormalizeSourcePath(project.projectRootPath);
      const storedListingPath = storePilotNormalizeSourcePath(project.listingPath);

      return (
        (normalizedProjectRootPath && (
          storedProjectRootPath === normalizedProjectRootPath ||
          storedSourcePath === normalizedProjectRootPath
        )) ||
        (normalizedSourcePath && (
          storedSourcePath === normalizedSourcePath ||
          storedProjectRootPath === normalizedSourcePath
        )) ||
        (normalizedListingPath && storedListingPath === normalizedListingPath)
      );
    });

    if (pathMatch) return pathMatch;

    const signatureMatch = state.projects.find(project => hasSameListings(project, listingSignature));
    if (signatureMatch) return signatureMatch;

    const normalizedNames = names.map(normalizeIdentity).filter(Boolean);
    return state.projects.find(project => normalizedNames.includes(normalizeIdentity(project.name)));
  }

  function isSameImportedProject(project, nextProject) {
    if (!project || !nextProject || project.id === nextProject.id) return false;

    const projectRootPath = storePilotNormalizeSourcePath(project.projectRootPath);
    const nextRootPath = storePilotNormalizeSourcePath(nextProject.projectRootPath);
    const projectSourcePath = storePilotNormalizeSourcePath(project.sourcePath);
    const nextSourcePath = storePilotNormalizeSourcePath(nextProject.sourcePath);
    const projectListingPath = storePilotNormalizeSourcePath(project.listingPath);
    const nextListingPath = storePilotNormalizeSourcePath(nextProject.listingPath);
    const sameRootPath = nextRootPath && (
      projectRootPath === nextRootPath ||
      projectSourcePath === nextRootPath
    );
    const sameSourcePath = nextSourcePath && (
      projectSourcePath === nextSourcePath ||
      projectRootPath === nextSourcePath
    );
    const sameListingPath = nextListingPath && projectListingPath === nextListingPath;
    const sameSignature = hasSameListings(project, nextProject.listingSignature);
    const projectNameIsGeneric = isGenericProjectName(project.name);
    const nextNameIsGeneric = isGenericProjectName(nextProject.name);
    const compatibleGenericName = sameSignature && (projectNameIsGeneric || nextNameIsGeneric);

    return sameRootPath || sameSourcePath || sameListingPath || sameSignature || compatibleGenericName;
  }

  async function upsertAndMergeImportedProject(nextProject) {
    const state = await storePilotGetProjectsState();
    const duplicates = state.projects.filter(project => isSameImportedProject(project, nextProject));
    const duplicateIds = new Set(duplicates.map(project => project.id));
    const mergedProject = duplicates.reduce((merged, duplicate) => ({
      ...duplicate,
      ...merged,
      id: merged.id,
      name: merged.name || duplicate.name,
      sourcePath: merged.sourcePath || duplicate.sourcePath,
      projectRootPath: merged.projectRootPath || duplicate.projectRootPath,
      listingPath: merged.listingPath || duplicate.listingPath,
      listingSignature: merged.listingSignature || duplicate.listingSignature,
      mediaAssets: merged.mediaAssets || duplicate.mediaAssets || null,
      privacyDoc: merged.privacyDoc || duplicate.privacyDoc || null,
      hasFolderHandle: Boolean(merged.hasFolderHandle || duplicate.hasFolderHandle)
    }), nextProject);
    const projects = state.projects
      .filter(project => project.id === mergedProject.id || !duplicateIds.has(project.id))
      .map(project => project.id === mergedProject.id ? mergedProject : project);
    const finalProjects = projects.some(project => project.id === mergedProject.id)
      ? projects
      : [...projects, mergedProject];
    const activeProjectId = duplicateIds.has(state.activeProjectId)
      ? mergedProject.id
      : state.activeProjectId || mergedProject.id;

    await storePilotSetProjectsState({
      projects: finalProjects,
      activeProjectId: mergedProject.id || activeProjectId
    });

    for (const duplicateId of duplicateIds) {
      if (duplicateId !== mergedProject.id && typeof storePilotDeleteProjectHandle === "function") {
        await storePilotDeleteProjectHandle(duplicateId);
      }
      if (duplicateId !== mergedProject.id && typeof storePilotDeleteProjectMediaFiles === "function") {
        await storePilotDeleteProjectMediaFiles(duplicateId);
      }
    }

    return mergedProject;
  }

  async function upsertProjectImport({ best, candidates, directoryName, projectId, hasFolderHandle, mediaAssets = null, privacyDoc = null }) {
    const result = await storePilotReadListingFiles(best.files);
    const rootInfo = getProjectRootInfo(best, directoryName);
    const listingSignature = createListingSignature(result.listings);
    const state = await storePilotGetProjectsState();
    const nameCandidates = getProjectNameCandidates(best.path, directoryName, rootInfo);
    const existingProject = findExistingProjectByImportIdentity(state, {
      projectId,
      names: nameCandidates,
      sourcePath: rootInfo.rootPath || best.path,
      projectRootPath: rootInfo.rootPath,
      listingPath: best.path,
      listingSignature
    });
    const fallbackName = rootInfo.rootName || directoryName || text("importedProject", "Imported project");
    const discoveredProjectName = rootInfo.rootName
      ? storePilotFormatProjectName(rootInfo.rootName)
      : storePilotFormatProjectName(fallbackName);
    const projectName = existingProject && !(rootInfo.rootName && isGenericProjectName(existingProject.name))
      ? existingProject.name
      : discoveredProjectName;
    const project = existingProject || storePilotCreateProject(projectName);
    const projectRootPath = rootInfo.rootPath || project.projectRootPath || "";
    const sourcePath = projectRootPath || project.sourcePath || best.path;
    const nextProject = {
      ...project,
      name: projectName,
      listings: result.listings,
      sourcePath,
      projectRootPath,
      listingPath: best.path,
      listingSignature,
      mediaAssets: mediaAssets || project.mediaAssets || null,
      privacyDoc: privacyDoc || project.privacyDoc || null,
      projectRootScore: rootInfo.rootScore,
      projectRootSignals: rootInfo.rootSignals,
      candidateCount: candidates.length,
      confidence: best.confidence,
      score: best.score,
      lastSyncedAt: storePilotFormatTimestamp(),
      hasFolderHandle
    };

    const mergedProject = await upsertAndMergeImportedProject(nextProject);

    return {
      ...result,
      project: mergedProject,
      sourcePath: mergedProject.sourcePath,
      listingPath: mergedProject.listingPath,
      mediaAssets: mergedProject.mediaAssets,
      privacyDoc: mergedProject.privacyDoc,
      candidateCount: candidates.length,
      confidence: best.confidence,
      score: best.score
    };
  }

  globalThis.storePilotImportListingFileList = async function storePilotImportListingFileList(files, projectId = "") {
    const candidates = await storePilotCollectCandidateDirectoriesFromFileList(files);

    if (!candidates.length) {
      return storePilotImportListingFiles(files);
    }

    const best = candidates[0];
    const mediaAssets = typeof storePilotDiscoverMediaAssetsFromFileList === "function"
      ? await storePilotDiscoverMediaAssetsFromFileList(files)
      : null;
    const privacyDoc = typeof storePilotDiscoverPrivacyDocFromFileList === "function"
      ? await storePilotDiscoverPrivacyDocFromFileList(files)
      : null;
    const directoryName = normalizePathParts(best.path)[0] || text("importedProject", "Imported project");

    const result = await upsertProjectImport({
      best,
      candidates,
      directoryName,
      projectId,
      hasFolderHandle: false,
      mediaAssets,
      privacyDoc
    });

    if (typeof storePilotSaveProjectMediaFilesFromFileList === "function") {
      await storePilotSaveProjectMediaFilesFromFileList(result.project.id, result.mediaAssets, files);
    }

    return result;
  };

  globalThis.storePilotImportListingDirectory = async function storePilotImportListingDirectory(directoryHandle, projectId = "") {
    const candidates = await storePilotCollectCandidateDirectories(directoryHandle);

    if (!candidates.length) {
      return {
        imported: 0,
        skipped: [],
        total: 0,
        listings: await storePilotGetListings(),
        sourcePath: "",
        listingPath: "",
        candidateCount: 0
      };
    }

    const best = candidates[0];
    const mediaAssets = typeof storePilotDiscoverMediaAssetsFromDirectory === "function"
      ? await storePilotDiscoverMediaAssetsFromDirectory(directoryHandle)
      : null;
    const privacyDoc = typeof storePilotDiscoverPrivacyDocFromDirectory === "function"
      ? await storePilotDiscoverPrivacyDocFromDirectory(directoryHandle)
      : null;
    const result = await upsertProjectImport({
      best,
      candidates,
      directoryName: directoryHandle.name,
      projectId,
      hasFolderHandle: true,
      mediaAssets,
      privacyDoc
    });

    await storePilotSaveProjectHandle(result.project.id, directoryHandle);
    if (typeof storePilotSaveProjectMediaFilesFromDirectory === "function") {
      await storePilotSaveProjectMediaFilesFromDirectory(result.project.id, result.mediaAssets, directoryHandle);
    }
    return result;
  };
})();
