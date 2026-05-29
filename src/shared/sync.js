async function storePilotSyncProject(projectId, requestAccess = false) {
  const state = await storePilotGetProjectsState();
  const project = state.projects.find(candidate => candidate.id === projectId);

  if (!project) {
    return { ok: false, message: storePilotText("projectNotFound", "Project not found.") };
  }

  const directoryHandle = await storePilotGetProjectHandle(project.id);
  if (!directoryHandle) {
    return { ok: false, message: storePilotText("chooseProjectFolderAgain", "Choose the project folder again to enable sync.") };
  }

  if (!(await storePilotCanReadHandle(directoryHandle, requestAccess))) {
    return { ok: false, message: storePilotText("folderPermissionNeeded", "Folder permission is needed before sync.") };
  }

  const result = await storePilotImportListingDirectory(directoryHandle, project.id);
  return {
    ok: result.imported > 0,
    message: storePilotText("syncedLocalesFrom", "Synced $1 locale(s) from $2.", [String(result.imported), result.sourcePath]),
    ...result
  };
}

async function storePilotSyncAllProjects(requestAccess = false) {
  const state = await storePilotGetProjectsState();
  const results = [];

  for (const project of state.projects) {
    if (!project.hasFolderHandle) {
      results.push({ project, ok: false, message: storePilotText("noFolderHandleSaved", "No folder handle saved.") });
      continue;
    }

    results.push({
      project,
      ...(await storePilotSyncProject(project.id, requestAccess))
    });
  }

  await STOREPILOT_API.storage.local.set({ [STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY]: state.activeProjectId });

  return results;
}
