(function registerDashboardPanelStyleModule(global) {
  function storePilotGetDashboardPanelThemeStyles(panelId) {
    return `
      #${panelId}[data-theme="dark"] .storepilot-status {
        color: #cbd5e1;
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-mode-picker {
        border-color: #343b4a;
        background: rgba(32, 38, 51, 0.78);
        color: #cbd5e1;
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-mode-picker-title {
        color: #f4f6fa;
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-mode-form label,
      #${panelId}[data-theme="dark"] .storepilot-parallel-mode-choice-description {
        color: #a8b0bf;
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-mode-form input {
        border-color: #343b4a;
        background: #202633;
        color: #f4f6fa;
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-mode-choice[aria-pressed="true"] {
        border-color: #2dd4bf;
        background: #042f2e;
        color: #99f6e4;
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

      #${panelId}[data-theme="dark"] .storepilot-parallel-chart-completed {
        stroke: #2dd4bf;
        fill: none;
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-chart-done-label {
        fill: #2dd4bf;
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-chart-remaining {
        stroke: #94a3b8;
        fill: none;
      }

      #${panelId}[data-theme="dark"] .storepilot-parallel-chart-failed {
        stroke: #fb7185;
        fill: none;
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

      #${panelId}[data-theme="dark"] .storepilot-locale-status[data-status="auditing"] {
        border-color: #c084fc;
        background: #2e1065;
        color: #e9d5ff;
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

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-mode-picker {
          border-color: #343b4a;
          background: rgba(32, 38, 51, 0.78);
          color: #cbd5e1;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-mode-picker-title {
          color: #f4f6fa;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-mode-form label,
        #${panelId}:not([data-theme="light"]) .storepilot-parallel-mode-choice-description {
          color: #a8b0bf;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-mode-form input {
          border-color: #343b4a;
          background: #202633;
          color: #f4f6fa;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-mode-choice[aria-pressed="true"] {
          border-color: #2dd4bf;
          background: #042f2e;
          color: #99f6e4;
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

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-chart-completed {
          stroke: #2dd4bf;
          fill: none;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-chart-done-label {
          fill: #2dd4bf;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-chart-remaining {
          stroke: #94a3b8;
          fill: none;
        }

        #${panelId}:not([data-theme="light"]) .storepilot-parallel-chart-failed {
          stroke: #fb7185;
          fill: none;
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

        #${panelId}:not([data-theme="light"]) .storepilot-locale-status[data-status="auditing"] {
          border-color: #c084fc;
          background: #2e1065;
          color: #e9d5ff;
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
  }

  global.storePilotGetDashboardPanelThemeStyles = storePilotGetDashboardPanelThemeStyles;
})(globalThis);
