async function storePilotGetListings() {
  const project = await storePilotGetActiveProject();
  return project ? project.listings || {} : {};
}

async function storePilotSetListings(listings) {
  const state = await storePilotGetProjectsState();
  let activeProjectId = state.activeProjectId;
  let projects = state.projects;

  if (!activeProjectId || !projects.some(project => project.id === activeProjectId)) {
    const project = storePilotCreateProject(storePilotText("manualImport", "Manual import"));
    activeProjectId = project.id;
    projects = [...projects, project];
  }

  projects = projects.map(project => project.id === activeProjectId
    ? { ...project, listings, lastSyncedAt: storePilotFormatTimestamp() }
    : project
  );

  await storePilotSetProjectsState({ projects, activeProjectId });
}

async function storePilotGetProjectsState() {
  const stored = await STOREPILOT_API.storage.local.get([
    STOREPILOT_PROJECTS_STORAGE_KEY,
    STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY,
    STOREPILOT_LISTING_STORAGE_KEY
  ]);
  let projects = stored[STOREPILOT_PROJECTS_STORAGE_KEY] || [];
  let activeProjectId = stored[STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY] || "";

  if (!projects.length && stored[STOREPILOT_LISTING_STORAGE_KEY] && Object.keys(stored[STOREPILOT_LISTING_STORAGE_KEY]).length) {
    const migrated = storePilotCreateProject(storePilotText("importedListingsProject", "Imported listings"), {
      listings: stored[STOREPILOT_LISTING_STORAGE_KEY],
      lastSyncedAt: storePilotFormatTimestamp()
    });
    projects = [migrated];
    activeProjectId = migrated.id;
    await storePilotSetProjectsState({ projects, activeProjectId });
  }

  if (projects.length && !projects.some(project => project.id === activeProjectId)) {
    activeProjectId = projects[0].id;
    await STOREPILOT_API.storage.local.set({ [STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY]: activeProjectId });
  }

  return { projects, activeProjectId };
}

async function storePilotSetProjectsState({ projects, activeProjectId }) {
  await STOREPILOT_API.storage.local.set({
    [STOREPILOT_PROJECTS_STORAGE_KEY]: projects,
    [STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY]: activeProjectId || ""
  });
}

async function storePilotGetActiveProject() {
  const { projects, activeProjectId } = await storePilotGetProjectsState();
  return projects.find(project => project.id === activeProjectId) || projects[0] || null;
}

async function storePilotSetActiveProject(projectId) {
  const { projects } = await storePilotGetProjectsState();
  if (!projects.some(project => project.id === projectId)) return;
  await STOREPILOT_API.storage.local.set({ [STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY]: projectId });
}

async function storePilotUpsertProject(nextProject, setActive = true) {
  const state = await storePilotGetProjectsState();
  const exists = state.projects.some(project => project.id === nextProject.id);
  const projects = exists
    ? state.projects.map(project => project.id === nextProject.id ? nextProject : project)
    : [...state.projects, nextProject];

  await storePilotSetProjectsState({
    projects,
    activeProjectId: setActive ? nextProject.id : state.activeProjectId || nextProject.id
  });

  return nextProject;
}

async function storePilotDeleteProject(projectId) {
  const state = await storePilotGetProjectsState();
  const projects = state.projects.filter(project => project.id !== projectId);
  const activeProjectId = state.activeProjectId === projectId
    ? (projects[0] && projects[0].id) || ""
    : state.activeProjectId;

  await storePilotDeleteProjectHandle(projectId);
  await storePilotSetProjectsState({ projects, activeProjectId });
}
