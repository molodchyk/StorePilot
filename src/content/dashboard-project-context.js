(function () {
  function normalizeDashboardExtensionId(value) {
    return storePilotNormalizeDashboardExtensionId(value);
  }

  function getDashboardExtensionIdFromUrl(url = window.location.href) {
    return storePilotGetDashboardExtensionIdFromUrl(url);
  }

  function findDashboardIdElement() {
    return Array.from(document.querySelectorAll("header span, main span, span"))
      .filter(isVisible)
      .find(element => /\bID:\s*[a-p]{32}\b/i.test(getVisibleText(element)));
  }

  function getDashboardExtensionIdFromHeader() {
    const idElement = findDashboardIdElement();
    const match = idElement ? getVisibleText(idElement).match(/\bID:\s*([a-p]{32})\b/i) : null;
    return normalizeDashboardExtensionId(match && match[1]);
  }

  function getDashboardExtensionId() {
    return getDashboardExtensionIdFromUrl() || getDashboardExtensionIdFromHeader();
  }

  function cleanDashboardItemTitle(value) {
    return String(value || "")
      .replace(/\bID:\s*[a-p]{32}\b/ig, "")
      .replace(/\bStatus:\s*.+$/i, "")
      .replace(/\bChrome Web Store Developer Dashboard\b/ig, "")
      .replace(/\bPublisher:\s*.+$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getDashboardItemTitle() {
    const idElement = findDashboardIdElement();
    const localContainer = idElement && idElement.closest(".oMEecd, .E0X3S, header");
    const localTitle = cleanDashboardItemTitle(localContainer ? getVisibleText(localContainer) : "");
    if (localTitle && localTitle.length <= 160) return localTitle;

    const selectors = [
      "header .oMEecd",
      "header h1",
      "header a",
      "main h1",
      "article h1"
    ].join(",");
    const candidates = Array.from(document.querySelectorAll(selectors))
      .filter(isVisible)
      .map(element => cleanDashboardItemTitle(getVisibleText(element)))
      .filter(text => text && text.length <= 160 && !/^id:/i.test(text));

    return candidates[0] || "";
  }

  function resolveDashboardProject(projects, activeStoredProjectId, bindings) {
    const extensionId = getDashboardExtensionId();
    const dashboardTitle = getDashboardItemTitle();
    const resolved = storePilotResolveDashboardProjectFromState(
      { projects, activeProjectId: activeStoredProjectId },
      bindings,
      { extensionId, title: dashboardTitle }
    );

    return {
      ...resolved,
      dashboardTitle
    };
  }

  async function saveDashboardProjectBinding(extensionId, project, dashboardItemTitle = "", source = "title") {
    if (!project || !project.id) return;

    await storePilotBindDashboardProject(extensionId, project.id, {
      dashboardItemTitle: dashboardItemTitle || getDashboardItemTitle(),
      source
    });
  }

  globalThis.storePilotGetDashboardExtensionId = getDashboardExtensionId;
  globalThis.storePilotGetDashboardItemTitle = getDashboardItemTitle;
  globalThis.storePilotResolveDashboardProject = resolveDashboardProject;
  globalThis.storePilotSaveDashboardProjectBinding = saveDashboardProjectBinding;
})();
