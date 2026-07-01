(function registerDashboardPanelStyleModule(global) {
  function storePilotGetDashboardPanelBaseStyles(panelId) {
    return `
      #${panelId} {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        display: grid;
        gap: 8px;
        width: 320px;
        padding: 12px;
        border: 1px solid rgba(15, 23, 42, 0.16);
        border-radius: 8px;
        background: #fff;
        color: #111827;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.2);
        font: 13px/1.4 Arial, sans-serif;
      }

      #${panelId}[data-theme="dark"] {
        border-color: #343b4a;
        background: #151922;
        color: #f4f6fa;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
      }

      #${panelId}[data-panel-mode="minimized"] {
        width: 220px;
        padding: 10px 12px;
      }

      #${panelId} .storepilot-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
      }

      #${panelId} .storepilot-title {
        cursor: grab;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        user-select: none;
        touch-action: none;
      }

      #${panelId}[data-dragging="true"] .storepilot-title {
        cursor: grabbing;
      }

      #${panelId} .storepilot-panel-controls {
        display: flex;
        gap: 4px;
      }

      #${panelId} .storepilot-icon-button {
        width: 26px;
        min-width: 26px;
        min-height: 26px;
        padding: 0;
        line-height: 1;
      }

      #${panelId} .storepilot-meta {
        color: #475569;
        font-size: 12px;
      }

      #${panelId}[data-theme="dark"] .storepilot-meta {
        color: #a8b0bf;
      }

      #${panelId} select,
      #${panelId} button {
        min-height: 30px;
        border: 1px solid #cbd5e1;
        border-radius: 5px;
        background: #fff;
        color: #111827;
        font: inherit;
      }

      #${panelId} .storepilot-actions {
        display: grid;
        gap: 8px;
      }

      #${panelId}[data-parallel-localized-screenshots-active="true"] .storepilot-actions {
        display: none;
      }

      #${panelId} .storepilot-action-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        padding-top: 8px;
        border-top: 1px solid rgba(148, 163, 184, 0.35);
      }

      #${panelId} .storepilot-action-group-single {
        grid-template-columns: 1fr;
      }

      #${panelId} .storepilot-action-group:first-child {
        padding-top: 0;
        border-top: 0;
      }

      #${panelId} button {
        cursor: pointer;
        font-weight: 700;
      }

      #${panelId} button:disabled {
        cursor: not-allowed;
        opacity: 0.48;
      }

      #${panelId} button[hidden] {
        display: none;
      }

      #${panelId} .storepilot-danger {
        border-color: #dc2626;
        background: #fff5f5;
        color: #b42318;
      }

      #${panelId}[data-theme="dark"] select,
      #${panelId}[data-theme="dark"] button {
        border-color: #343b4a;
        background: #202633;
        color: #f4f6fa;
      }

      #${panelId}[data-theme="dark"] .storepilot-danger {
        border-color: #7f1d1d;
        background: #2b1719;
        color: #ff9b92;
      }

      #${panelId}[data-theme="dark"] .storepilot-action-group {
        border-top-color: #343b4a;
      }

      #${panelId} .storepilot-status {
        color: #475569;
        font-size: 12px;
        overflow-wrap: anywhere;
        white-space: pre-line;
      }

    `;
  }

  global.storePilotGetDashboardPanelBaseStyles = storePilotGetDashboardPanelBaseStyles;
})(globalThis);
