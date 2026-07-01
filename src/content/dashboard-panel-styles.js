(function registerDashboardPanelStyles(global) {
  function storePilotInjectDashboardPanelStyles(panelId) {
    if (document.getElementById("storepilot-styles")) return;

    const style = document.createElement("style");
    style.id = "storepilot-styles";
    style.textContent = [
      global.storePilotGetDashboardPanelBaseStyles(panelId),
      global.storePilotGetDashboardPanelParallelStyles(panelId),
      global.storePilotGetDashboardPanelThemeStyles(panelId)
    ].join("\n");
    document.documentElement.append(style);
  }

  global.storePilotInjectDashboardPanelStyles = storePilotInjectDashboardPanelStyles;
})(globalThis);
