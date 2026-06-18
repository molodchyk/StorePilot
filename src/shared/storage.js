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

function storePilotNormalizeDashboardExtensionId(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-p]{32}$/.test(normalized) ? normalized : "";
}

function storePilotGetDashboardExtensionIdFromUrl(url = "") {
  try {
    const { pathname } = new URL(url);
    const parts = pathname.split("/").filter(Boolean);
    const consoleIndex = parts.findIndex(part => part === "devconsole");
    const candidate = consoleIndex >= 0 ? parts[consoleIndex + 2] : "";
    return storePilotNormalizeDashboardExtensionId(candidate);
  } catch (_error) {
    return "";
  }
}

function storePilotNormalizeDashboardProjectText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");
}

function storePilotGetDashboardProjectBinding(bindings, extensionId) {
  const normalizedExtensionId = storePilotNormalizeDashboardExtensionId(extensionId);
  if (!normalizedExtensionId || !bindings) return null;

  const binding = bindings[normalizedExtensionId];
  if (!binding) return null;
  if (typeof binding === "string") return { projectId: binding };
  if (typeof binding === "object") return binding;
  return null;
}

function storePilotFindProjectByDashboardTitle(projects, title) {
  const normalizedTitle = storePilotNormalizeDashboardProjectText(title);
  if (!normalizedTitle) return null;

  const matches = projects
    .map(project => {
      const normalizedName = storePilotNormalizeDashboardProjectText(project.name);
      if (!normalizedName) return null;

      const containsName = normalizedTitle.includes(normalizedName);
      const containsTitle = normalizedName.includes(normalizedTitle);
      if (!containsName && !containsTitle) return null;

      return {
        project,
        score: containsName ? normalizedName.length : Math.max(1, normalizedTitle.length - 5)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (!matches.length) return null;
  if (matches[1] && matches[1].score === matches[0].score) return null;
  return matches[0].project;
}

function storePilotResolveDashboardProjectFromState(state, bindings = {}, context = {}) {
  const projects = state.projects || [];
  const activeProject = projects.find(project => project.id === state.activeProjectId) || projects[0] || null;
  const extensionId = storePilotNormalizeDashboardExtensionId(context.extensionId || storePilotGetDashboardExtensionIdFromUrl(context.url || ""));
  const binding = storePilotGetDashboardProjectBinding(bindings, extensionId);

  if (binding && binding.projectId) {
    const boundProject = projects.find(project => project.id === binding.projectId);
    if (boundProject) {
      return {
        project: boundProject,
        extensionId,
        source: "binding",
        binding
      };
    }
  }

  const titleProject = storePilotFindProjectByDashboardTitle(projects, context.title || "");
  if (titleProject) {
    return {
      project: titleProject,
      extensionId,
      source: "title"
    };
  }

  return {
    project: activeProject,
    extensionId,
    source: activeProject ? "active" : "none"
  };
}

async function storePilotGetDashboardProjectBindings() {
  const stored = await STOREPILOT_API.storage.local.get([STOREPILOT_DASHBOARD_PROJECT_BINDINGS_STORAGE_KEY]);
  const bindings = stored[STOREPILOT_DASHBOARD_PROJECT_BINDINGS_STORAGE_KEY];
  return bindings && typeof bindings === "object" ? bindings : {};
}

async function storePilotBindDashboardProject(extensionId, projectId, patch = {}) {
  const normalizedExtensionId = storePilotNormalizeDashboardExtensionId(extensionId);
  if (!normalizedExtensionId || !projectId) return null;

  const bindings = await storePilotGetDashboardProjectBindings();
  const binding = {
    ...(storePilotGetDashboardProjectBinding(bindings, normalizedExtensionId) || {}),
    ...patch,
    projectId,
    extensionId: normalizedExtensionId,
    updatedAt: storePilotFormatTimestamp()
  };

  await STOREPILOT_API.storage.local.set({
    [STOREPILOT_DASHBOARD_PROJECT_BINDINGS_STORAGE_KEY]: {
      ...bindings,
      [normalizedExtensionId]: binding
    }
  });

  return binding;
}

async function storePilotResolveProjectForDashboard(context = {}) {
  const state = await storePilotGetProjectsState();
  const bindings = await storePilotGetDashboardProjectBindings();
  return {
    ...storePilotResolveDashboardProjectFromState(state, bindings, context),
    projects: state.projects,
    activeProjectId: state.activeProjectId
  };
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
  const bindings = await storePilotGetDashboardProjectBindings();
  const nextBindings = Object.fromEntries(Object.entries(bindings).filter(([_extensionId, binding]) => (
    (typeof binding === "string" ? binding : binding && binding.projectId) !== projectId
  )));

  await storePilotDeleteProjectHandle(projectId);
  await STOREPILOT_API.storage.local.set({ [STOREPILOT_DASHBOARD_PROJECT_BINDINGS_STORAGE_KEY]: nextBindings });
  await storePilotSetProjectsState({ projects, activeProjectId });
}

async function storePilotResetLocalData() {
  await storePilotClearStoredHandles();
  await STOREPILOT_API.storage.local.clear();
}
