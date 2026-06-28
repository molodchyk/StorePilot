(function registerDashboardPanelStyles(global) {
  function storePilotInjectDashboardPanelStyles(panelId) {
    if (document.getElementById("storepilot-styles")) return;

    const style = document.createElement("style");
    style.id = "storepilot-styles";
    style.textContent = `
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

      #${panelId} .storepilot-parallel-board {
        display: grid;
        gap: 6px;
        padding-top: 8px;
        border-top: 1px solid rgba(148, 163, 184, 0.35);
        color: #475569;
        font-size: 12px;
      }

      #${panelId} .storepilot-localized-worker-board {
        display: grid;
        gap: 6px;
        padding-top: 8px;
        border-top: 1px solid rgba(148, 163, 184, 0.35);
        color: #475569;
        font-size: 12px;
      }

      #${panelId} .storepilot-parallel-board[hidden] {
        display: none;
      }

      #${panelId} .storepilot-localized-worker-board[hidden] {
        display: none;
      }

      #${panelId} .storepilot-parallel-board-title {
        color: #111827;
        font-weight: 700;
      }

      #${panelId} .storepilot-localized-worker-title {
        color: #111827;
        font-weight: 700;
      }

      #${panelId} .storepilot-parallel-board-summary {
        display: grid;
        gap: 2px;
      }

      #${panelId} .storepilot-localized-worker-summary {
        display: grid;
        gap: 2px;
      }

      #${panelId} .storepilot-parallel-chart {
        height: 88px;
        overflow: hidden;
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 5px;
        background: rgba(248, 250, 252, 0.82);
      }

      #${panelId} .storepilot-parallel-chart[hidden] {
        display: none;
      }

      #${panelId} .storepilot-parallel-chart svg {
        display: block;
        width: 100%;
        height: 88px;
      }

      #${panelId} .storepilot-parallel-chart-grid {
        stroke: rgba(148, 163, 184, 0.36);
        stroke-width: 1;
      }

      #${panelId} .storepilot-parallel-chart-completed {
        stroke: #0f766e;
      }

      #${panelId} .storepilot-parallel-chart-remaining {
        stroke: #64748b;
      }

      #${panelId} .storepilot-parallel-chart-failed {
        stroke: #dc2626;
      }

      #${panelId} .storepilot-parallel-chart-label {
        fill: #64748b;
        font-size: 9px;
        font-weight: 700;
      }

      #${panelId} .storepilot-parallel-chart-done-label {
        fill: #0f766e;
      }

      #${panelId} .storepilot-parallel-chart-remaining-label {
        fill: #64748b;
      }

      #${panelId} .storepilot-parallel-locales {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        gap: 3px;
        min-height: 58px;
        height: 116px;
        max-height: 220px;
        overflow: auto;
        padding: 2px 0;
        resize: vertical;
      }

      #${panelId} .storepilot-parallel-locales[hidden] {
        display: none;
      }

      #${panelId} .storepilot-locale-status {
        min-width: 28px;
        padding: 2px 4px;
        border: 1px solid rgba(100, 116, 139, 0.35);
        border-radius: 4px;
        background: #f8fafc;
        color: #334155;
        font-size: 10px;
        font-weight: 700;
        line-height: 1.15;
        text-align: center;
      }

      #${panelId} .storepilot-locale-status[data-status="pendingClear"],
      #${panelId} .storepilot-locale-status[data-status="pendingUpload"],
      #${panelId} .storepilot-locale-status[data-status="pending"] {
        background: #f8fafc;
        color: #64748b;
      }

      #${panelId} .storepilot-locale-status[data-status="clearing"],
      #${panelId} .storepilot-locale-status[data-status="uploading"],
      #${panelId} .storepilot-locale-status[data-status="replacing"],
      #${panelId} .storepilot-locale-status[data-status="running"] {
        border-color: #2563eb;
        background: #eff6ff;
        color: #1d4ed8;
      }

      #${panelId} .storepilot-locale-status[data-status="cleared"] {
        border-color: #0891b2;
        background: #ecfeff;
        color: #0e7490;
      }

      #${panelId} .storepilot-locale-status[data-status="completed"] {
        border-color: #0f766e;
        background: #ecfdf5;
        color: #047857;
      }

      #${panelId} .storepilot-locale-status[data-status="failed"],
      #${panelId} .storepilot-locale-status[data-status="aborted"] {
        border-color: #dc2626;
        background: #fef2f2;
        color: #b91c1c;
      }

      #${panelId} .storepilot-locale-status[data-status="skipped"] {
        border-color: #94a3b8;
        background: #f1f5f9;
        color: #475569;
      }

      #${panelId} .storepilot-parallel-workers {
        display: grid;
        gap: 4px;
        max-height: 160px;
        overflow: auto;
      }

      #${panelId} .storepilot-parallel-worker {
        display: grid;
        gap: 2px;
        padding: 6px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 5px;
        background: rgba(248, 250, 252, 0.8);
      }

      #${panelId} .storepilot-parallel-worker-title {
        color: #111827;
        font-weight: 700;
      }

      #${panelId} .storepilot-parallel-worker-current {
        overflow-wrap: anywhere;
      }

      #${panelId} .storepilot-parallel-board-actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 6px;
      }

      #${panelId}[data-panel-mode="minimized"] .storepilot-meta,
      #${panelId}[data-panel-mode="minimized"] .storepilot-actions,
      #${panelId}[data-panel-mode="minimized"] .storepilot-parallel-board,
      #${panelId}[data-panel-mode="minimized"] .storepilot-localized-worker-board,
      #${panelId}[data-panel-mode="minimized"] .storepilot-status {
        display: none;
      }

      #${panelId}[data-theme="dark"] .storepilot-status {
        color: #cbd5e1;
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-board,
      #${panelId}[data-theme="dark"] .storepilot-localized-worker-board {
        border-top-color: #343b4a;
        color: #cbd5e1;
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-board-title,
      #${panelId}[data-theme="dark"] .storepilot-localized-worker-title,
      #${panelId}[data-theme="dark"] .storepilot-parallel-worker-title {
        color: #f4f6fa;
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-worker {
        border-color: #343b4a;
        background: rgba(32, 38, 51, 0.78);
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-chart {
        border-color: #343b4a;
        background: rgba(17, 24, 39, 0.72);
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-chart-grid {
        stroke: rgba(148, 163, 184, 0.22);
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-chart-label,
      #${panelId}[data-theme="dark"] .storepilot-parallel-chart-remaining-label {
        fill: #94a3b8;
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-chart-completed,
      #${panelId}[data-theme="dark"] .storepilot-parallel-chart-done-label {
        stroke: #2dd4bf;
        fill: #2dd4bf;
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-chart-remaining {
        stroke: #94a3b8;
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-chart-failed {
        stroke: #fb7185;
      }

      #${panelId}[data-theme="dark"] .storepilot-locale-status {
        border-color: #475569;
        background: #111827;
        color: #cbd5e1;
      }

      #${panelId}[data-theme="dark"] .storepilot-locale-status[data-status="clearing"],
      #${panelId}[data-theme="dark"] .storepilot-locale-status[data-status="uploading"],
      #${panelId}[data-theme="dark"] .storepilot-locale-status[data-status="replacing"],
      #${panelId}[data-theme="dark"] .storepilot-locale-status[data-status="running"] {
        border-color: #60a5fa;
        background: #172554;
        color: #bfdbfe;
      }

      #${panelId}[data-theme="dark"] .storepilot-locale-status[data-status="cleared"] {
        border-color: #22d3ee;
        background: #083344;
        color: #a5f3fc;
      }

      #${panelId}[data-theme="dark"] .storepilot-locale-status[data-status="completed"] {
        border-color: #2dd4bf;
        background: #042f2e;
        color: #99f6e4;
      }

      #${panelId}[data-theme="dark"] .storepilot-locale-status[data-status="failed"],
      #${panelId}[data-theme="dark"] .storepilot-locale-status[data-status="aborted"] {
        border-color: #fb7185;
        background: #3f111a;
        color: #fecdd3;
      }

      #${panelId}[data-theme="dark"] .storepilot-locale-status[data-status="skipped"] {
        border-color: #64748b;
        background: #1e293b;
        color: #cbd5e1;
      }

      @media (prefers-color-scheme: dark) {
        #${panelId}:not([data-theme="light"]) {
          border-color: #343b4a;
          background: #151922;
          color: #f4f6fa;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
        }

        #${panelId}:not([data-theme="light"]) .storepilot-meta {
          color: #a8b0bf;
        }

        #${panelId}:not([data-theme="light"]) select,
        #${panelId}:not([data-theme="light"]) button {
          border-color: #343b4a;
          background: #202633;
          color: #f4f6fa;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-danger {
          border-color: #7f1d1d;
          background: #2b1719;
          color: #ff9b92;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-action-group {
          border-top-color: #343b4a;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-status {
          color: #cbd5e1;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-board,
        #${panelId}:not([data-theme="light"]) .storepilot-localized-worker-board {
          border-top-color: #343b4a;
          color: #cbd5e1;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-board-title,
        #${panelId}:not([data-theme="light"]) .storepilot-localized-worker-title,
        #${panelId}:not([data-theme="light"]) .storepilot-parallel-worker-title {
          color: #f4f6fa;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-worker {
          border-color: #343b4a;
          background: rgba(32, 38, 51, 0.78);
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-chart {
          border-color: #343b4a;
          background: rgba(17, 24, 39, 0.72);
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-chart-grid {
          stroke: rgba(148, 163, 184, 0.22);
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-chart-label,
        #${panelId}:not([data-theme="light"]) .storepilot-parallel-chart-remaining-label {
          fill: #94a3b8;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-chart-completed,
        #${panelId}:not([data-theme="light"]) .storepilot-parallel-chart-done-label {
          stroke: #2dd4bf;
          fill: #2dd4bf;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-chart-remaining {
          stroke: #94a3b8;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-chart-failed {
          stroke: #fb7185;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-locale-status {
          border-color: #475569;
          background: #111827;
          color: #cbd5e1;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-locale-status[data-status="clearing"],
        #${panelId}:not([data-theme="light"]) .storepilot-locale-status[data-status="uploading"],
        #${panelId}:not([data-theme="light"]) .storepilot-locale-status[data-status="replacing"],
        #${panelId}:not([data-theme="light"]) .storepilot-locale-status[data-status="running"] {
          border-color: #60a5fa;
          background: #172554;
          color: #bfdbfe;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-locale-status[data-status="cleared"] {
          border-color: #22d3ee;
          background: #083344;
          color: #a5f3fc;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-locale-status[data-status="completed"] {
          border-color: #2dd4bf;
          background: #042f2e;
          color: #99f6e4;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-locale-status[data-status="failed"],
        #${panelId}:not([data-theme="light"]) .storepilot-locale-status[data-status="aborted"] {
          border-color: #fb7185;
          background: #3f111a;
          color: #fecdd3;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-locale-status[data-status="skipped"] {
          border-color: #64748b;
          background: #1e293b;
          color: #cbd5e1;
        }
      }

      #${panelId}:not([data-theme="dark"])[data-theme-style="slate"] {
        border-color: #94a3b8;
        background: #f3f5f8;
      }

      #${panelId}:not([data-theme="dark"])[data-theme-style="ocean"] {
        border-color: #8ecfe0;
        background: #eef8fb;
        color: #102033;
        box-shadow: 0 12px 32px rgba(20, 91, 115, 0.22);
      }

      #${panelId}:not([data-theme="dark"])[data-theme-style="forest"] {
        border-color: #a7caa1;
        background: #f3f8f2;
        color: #132018;
        box-shadow: 0 12px 32px rgba(52, 83, 48, 0.2);
      }

      @media (prefers-color-scheme: dark) {
        #${panelId}:not([data-theme="light"])[data-theme-style="slate"] {
          border-color: #34445f;
          background: #0f172a;
          color: #f4f6fa;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
        }

        #${panelId}:not([data-theme="light"])[data-theme-style="ocean"] {
          border-color: #0e7490;
          background: #0c1e26;
          color: #f4f6fa;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
        }

        #${panelId}:not([data-theme="light"])[data-theme-style="forest"] {
          border-color: #2f7d46;
          background: #102015;
          color: #f4f6fa;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
        }
      }

      #${panelId}[data-theme="dark"][data-theme-style="slate"] {
        border-color: #34445f;
        background: #0f172a;
      }

      #${panelId}[data-theme="dark"][data-theme-style="ocean"] {
        border-color: #0e7490;
        background: #0c1e26;
      }

      #${panelId}[data-theme="dark"][data-theme-style="forest"] {
        border-color: #2f7d46;
        background: #102015;
      }

      #${panelId}[data-theme-style="high-contrast"] {
        border-color: #000000;
        background: #ffffff;
        color: #000000;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
      }

      #${panelId}[data-theme-style="high-contrast"] .storepilot-meta,
      #${panelId}[data-theme-style="high-contrast"] .storepilot-parallel-board,
      #${panelId}[data-theme-style="high-contrast"] .storepilot-localized-worker-board,
      #${panelId}[data-theme-style="high-contrast"] .storepilot-status {
        color: #000000;
      }

      #${panelId}[data-theme-style="high-contrast"] select,
      #${panelId}[data-theme-style="high-contrast"] button {
        border-color: #000000;
        background: #ffffff;
        color: #000000;
      }

      #${panelId}[data-theme-style="high-contrast"] .storepilot-danger {
        border-color: #b00020;
        color: #b00020;
      }

      #${panelId}[data-theme-style="high-contrast"] .storepilot-action-group {
        border-top-color: #000000;
      }

      #${panelId}[data-theme-style="high-contrast"] .storepilot-parallel-board,
      #${panelId}[data-theme-style="high-contrast"] .storepilot-localized-worker-board {
        border-top-color: #000000;
      }

      #${panelId}[data-theme-style="high-contrast"] .storepilot-parallel-board-title,
      #${panelId}[data-theme-style="high-contrast"] .storepilot-localized-worker-title,
      #${panelId}[data-theme-style="high-contrast"] .storepilot-parallel-worker-title {
        color: #000000;
      }

      #${panelId}[data-theme-style="high-contrast"] .storepilot-parallel-worker {
        border-color: #000000;
        background: #ffffff;
      }

      @media (prefers-color-scheme: dark) {
        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] {
          border-color: #ffffff;
          background: #000000;
          color: #ffffff;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7);
        }

        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] .storepilot-meta,
        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] .storepilot-parallel-board,
        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] .storepilot-localized-worker-board,
        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] .storepilot-status {
          color: #ffffff;
        }

        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] select,
        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] button {
          border-color: #ffffff;
          background: #000000;
          color: #ffffff;
        }

        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] .storepilot-danger {
          border-color: #ffb4b4;
          color: #ffb4b4;
        }

        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] .storepilot-action-group {
          border-top-color: #ffffff;
        }

        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] .storepilot-parallel-board,
        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] .storepilot-localized-worker-board {
          border-top-color: #ffffff;
        }

        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] .storepilot-parallel-board-title,
        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] .storepilot-localized-worker-title,
        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] .storepilot-parallel-worker-title {
          color: #ffffff;
        }

        #${panelId}:not([data-theme="light"])[data-theme-style="high-contrast"] .storepilot-parallel-worker {
          border-color: #ffffff;
          background: #000000;
        }
      }

      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] {
        border-color: #ffffff;
        background: #000000;
        color: #ffffff;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7);
      }

      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] .storepilot-meta,
      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] .storepilot-parallel-board,
      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] .storepilot-localized-worker-board,
      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] .storepilot-status {
        color: #ffffff;
      }

      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] select,
      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] button {
        border-color: #ffffff;
        background: #000000;
        color: #ffffff;
      }

      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] .storepilot-danger {
        border-color: #ffb4b4;
        color: #ffb4b4;
      }

      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] .storepilot-action-group {
        border-top-color: #ffffff;
      }

      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] .storepilot-parallel-board,
      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] .storepilot-localized-worker-board {
        border-top-color: #ffffff;
      }

      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] .storepilot-parallel-board-title,
      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] .storepilot-localized-worker-title,
      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] .storepilot-parallel-worker-title {
        color: #ffffff;
      }

      #${panelId}[data-theme="dark"][data-theme-style="high-contrast"] .storepilot-parallel-worker {
        border-color: #ffffff;
        background: #000000;
      }
    `;
    document.documentElement.append(style);
  }

  global.storePilotInjectDashboardPanelStyles = storePilotInjectDashboardPanelStyles;
})(globalThis);
