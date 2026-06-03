async function storePilotReadTextFile(file) {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

async function storePilotImportListingFiles(files) {
  const activeProject = await storePilotGetActiveProject();
  const project = activeProject || storePilotCreateProject(storePilotText("manualImport", "Manual import"));
  const nextListings = { ...(project.listings || {}) };
  const textFiles = Array.from(files).filter(storePilotIsPotentialListingFile);
  const skipped = [];
  let imported = 0;

  for (const file of textFiles) {
    const locale = storePilotGetLocaleFromFileName(file.name);
    if (!locale) {
      skipped.push(file.name);
      continue;
    }

    nextListings[locale] = await storePilotReadTextFile(file);
    imported++;
  }

  await storePilotUpsertProject({
    ...project,
    listings: nextListings,
    sourcePath: project.sourcePath || storePilotText("manualFileImport", "Manual file import"),
    lastSyncedAt: storePilotFormatTimestamp()
  });

  return {
    imported,
    skipped,
    total: textFiles.length,
    listings: nextListings,
    unsupportedChromeWebStoreLocales: storePilotGetUnsupportedChromeWebStoreLocales(nextListings),
    project
  };
}

async function storePilotCollectCandidateDirectoriesFromFileList(files) {
  const candidateMap = new Map();
  const directoryChildren = new Map();
  const directoryFiles = new Map();
  const fileList = Array.from(files);
  const hasRelativePaths = fileList.some(file => storePilotGetRelativePathParts(file).length > 1);

  if (!hasRelativePaths) {
    return [];
  }

  for (const file of fileList) {
    const pathParts = storePilotGetRelativePathParts(file);
    const fileName = pathParts[pathParts.length - 1];
    const directoryParts = pathParts.slice(0, -1);

    if (!directoryParts.length) {
      continue;
    }

    for (let index = 0; index < directoryParts.length - 1; index++) {
      const parentPath = directoryParts.slice(0, index + 1).join("/");
      const childName = directoryParts[index + 1];
      const children = directoryChildren.get(parentPath) || new Set();
      children.add(childName);
      directoryChildren.set(parentPath, children);
    }

    if (storePilotHasSkippedPathPart(directoryParts)) {
      continue;
    }

    const directoryPath = directoryParts.join("/");
    const filesInDirectory = directoryFiles.get(directoryPath) || new Set();
    filesInDirectory.add(fileName);
    directoryFiles.set(directoryPath, filesInDirectory);

    if (!storePilotIsPotentialListingFile(file, { allowUnknownText: false })) {
      continue;
    }

    const sample = await storePilotReadTextFile(file);
    const candidate = candidateMap.get(directoryPath) || {
      pathParts: directoryParts,
      files: []
    };

    candidate.files.push({
      name: fileName,
      sample: sample.slice(0, 4000),
      async text() {
        return sample;
      }
    });
    candidateMap.set(directoryPath, candidate);
  }

  const directoryMetadata = new Map();
  for (const directoryPath of new Set([
    ...Array.from(directoryChildren.keys()),
    ...Array.from(directoryFiles.keys())
  ])) {
    const pathParts = directoryPath.split("/").filter(Boolean);
    directoryMetadata.set(storePilotNormalizePath(pathParts), {
      pathParts,
      fileNames: Array.from(directoryFiles.get(directoryPath) || []),
      childDirectoryNames: Array.from(directoryChildren.get(directoryPath) || [])
    });
  }

  const candidates = Array.from(candidateMap.values()).map(candidate => {
    const directoryPath = candidate.pathParts.join("/");
    const childDirectoryNames = Array.from(directoryChildren.get(directoryPath) || []);
    const score = storePilotScoreDirectory(candidate.pathParts, candidate.files, childDirectoryNames);

    return {
      path: directoryPath,
      pathParts: candidate.pathParts,
      score,
      confidence: storePilotCalculateConfidence(score),
      files: candidate.files
    };
  }).filter(candidate => candidate.score);

  const candidatesWithRootEvidence = storePilotAttachProjectRootEvidence(candidates, directoryMetadata);
  candidatesWithRootEvidence.sort((a, b) => b.score - a.score || b.files.length - a.files.length);
  return candidatesWithRootEvidence;
}

async function storePilotImportListingFileList(files, projectId = "") {
  const candidates = await storePilotCollectCandidateDirectoriesFromFileList(files);

  if (!candidates.length) {
    return storePilotImportListingFiles(files);
  }

  const best = candidates[0];
  const rootName = best.path.split("/")[0] || storePilotText("importedProject", "Imported project");
  const projectName = storePilotFormatProjectName(rootName);
  const state = await storePilotGetProjectsState();
  const projectNameCandidates = [
    rootName,
    projectName,
    ...storePilotGetProjectNameCandidates(best.path, rootName)
  ];
  const existingProject = storePilotFindExistingProject(state, {
    projectId,
    names: projectNameCandidates,
    sourcePath: best.path
  });
  const project = existingProject || storePilotCreateProject(projectName);
  const result = await storePilotReadListingFiles(best.files);
  const nextProject = {
    ...project,
    name: project.name || rootName,
    listings: result.listings,
    sourcePath: best.path,
    candidateCount: candidates.length,
    confidence: best.confidence,
    score: best.score,
    lastSyncedAt: storePilotFormatTimestamp(),
    hasFolderHandle: false
  };

  await storePilotUpsertProject(nextProject);

  return {
    ...result,
    project: nextProject,
    sourcePath: best.path,
    candidateCount: candidates.length,
    confidence: best.confidence,
    score: best.score
  };
}

async function storePilotImportListingDirectory(directoryHandle, projectId = "") {
  const candidates = await storePilotCollectCandidateDirectories(directoryHandle);

  if (!candidates.length) {
    return {
      imported: 0,
      skipped: [],
      total: 0,
      listings: await storePilotGetListings(),
      sourcePath: "",
      candidateCount: 0
    };
  }

  const best = candidates[0];
  const projectName = storePilotFormatProjectName(directoryHandle.name);
  const state = await storePilotGetProjectsState();
  const projectNameCandidates = [
    directoryHandle.name,
    projectName,
    ...storePilotGetProjectNameCandidates(best.path, directoryHandle.name)
  ];
  const existingProject = storePilotFindExistingProject(state, {
    projectId,
    names: projectNameCandidates,
    sourcePath: best.path
  });
  const project = existingProject || storePilotCreateProject(projectName);
  const result = await storePilotReadListingFiles(best.files);
  const nextProject = {
    ...project,
    name: project.name || directoryHandle.name,
    listings: result.listings,
    sourcePath: best.path,
    candidateCount: candidates.length,
    confidence: best.confidence,
    score: best.score,
    lastSyncedAt: storePilotFormatTimestamp(),
    hasFolderHandle: true
  };

  await storePilotSaveProjectHandle(nextProject.id, directoryHandle);
  await storePilotUpsertProject(nextProject);

  return {
    ...result,
    project: nextProject,
    sourcePath: best.path,
    candidateCount: candidates.length,
    confidence: best.confidence,
    score: best.score
  };
}

async function storePilotReadListingFiles(files) {
  const textFiles = Array.from(files).filter(storePilotIsPotentialListingFile);
  const listings = {};
  const skipped = [];
  let imported = 0;

  for (const file of textFiles) {
    const locale = storePilotGetLocaleFromFileName(file.name);
    if (!locale) {
      skipped.push(file.name);
      continue;
    }

    listings[locale] = await storePilotReadTextFile(file);
    imported++;
  }

  return {
    imported,
    skipped,
    total: textFiles.length,
    listings,
    unsupportedChromeWebStoreLocales: storePilotGetUnsupportedChromeWebStoreLocales(listings)
  };
}
