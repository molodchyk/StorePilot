(function registerDashboardPanelStyleModule(global) {
  function storePilotGetDashboardPanelParallelStyles(panelId) {
    return `
      #${panelId} .storepilot-parallel-mode-picker {
        display: grid;
        gap: 8px;
        padding: 8px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 6px;
        background: rgba(248, 250, 252, 0.92);
        color: #334155;
        font-size: 12px;
      }

      #${panelId} .storepilot-parallel-mode-picker-title {
        color: #111827;
        font-weight: 700;
      }

      #${panelId} .storepilot-parallel-mode-form {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 6px 8px;
        align-items: center;
      }

      #${panelId} .storepilot-parallel-mode-form label {
        color: #475569;
        font-weight: 700;
      }

      #${panelId} .storepilot-parallel-mode-form input {
        min-height: 28px;
        min-width: 0;
        border: 1px solid #cbd5e1;
        border-radius: 5px;
        padding: 0 8px;
        background: #fff;
        color: #111827;
        font: inherit;
      }

      #${panelId} .storepilot-parallel-mode-choices {
        display: grid;
        gap: 6px;
      }

      #${panelId} .storepilot-parallel-mode-choice {
        display: grid;
        gap: 2px;
        min-height: 0;
        padding: 7px 8px;
        text-align: left;
      }

      #${panelId} .storepilot-parallel-mode-choice[aria-pressed="true"] {
        border-color: #0f766e;
        background: #ecfdf5;
        color: #064e3b;
      }

      #${panelId} .storepilot-parallel-mode-choice[aria-pressed="false"] {
        gap: 0;
        padding: 5px 8px;
      }

      #${panelId} .storepilot-parallel-mode-choice-label {
        font-weight: 700;
      }

      #${panelId} .storepilot-parallel-mode-choice-description {
        color: #64748b;
        font-size: 11px;
        font-weight: 400;
        line-height: 1.25;
      }

      #${panelId} .storepilot-parallel-mode-choice[aria-pressed="false"] .storepilot-parallel-mode-choice-description {
        display: none;
      }

      #${panelId} .storepilot-parallel-mode-actions {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 6px;
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

      #${panelId} .storepilot-localized-worker-actions {
        display: grid;
        grid-template-columns: 1fr;
        gap: 6px;
      }

      #${panelId} .storepilot-localized-worker-actions:empty {
        display: none;
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
        fill: none;
      }

      #${panelId} .storepilot-parallel-chart-remaining {
        stroke: #64748b;
        fill: none;
      }

      #${panelId} .storepilot-parallel-chart-failed {
        stroke: #dc2626;
        fill: none;
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
        max-height: min(260px, 34vh);
        overflow: auto;
        padding: 2px 0;
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

      #${panelId} .storepilot-locale-status[data-status="auditing"] {
        border-color: #7c3aed;
        background: #f5f3ff;
        color: #6d28d9;
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
        min-height: min(220px, 28vh);
        max-height: min(520px, 52vh);
        overflow: auto;
        resize: vertical;
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

      #${panelId} .storepilot-parallel-worker-actions {
        display: grid;
        gap: 6px;
        margin-top: 6px;
      }

      #${panelId} .storepilot-parallel-worker-actions:empty {
        display: none;
      }

      #${panelId} .storepilot-parallel-board-actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 6px;
      }

      #${panelId}[data-panel-mode="minimized"] .storepilot-meta,
      #${panelId}[data-panel-mode="minimized"] .storepilot-actions,
      #${panelId}[data-panel-mode="minimized"] .storepilot-parallel-mode-picker,
      #${panelId}[data-panel-mode="minimized"] .storepilot-parallel-board,
      #${panelId}[data-panel-mode="minimized"] .storepilot-localized-worker-board,
      #${panelId}[data-panel-mode="minimized"] .storepilot-status {
        display: none;
      }

    `;
  }

  global.storePilotGetDashboardPanelParallelStyles = storePilotGetDashboardPanelParallelStyles;
})(globalThis);
