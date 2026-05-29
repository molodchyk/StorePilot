param(
  [Parameter(Mandatory = $true)]
  [string]$Dist
)

$ErrorActionPreference = "Stop"

$srcFirefox = Split-Path -Parent $PSCommandPath
$scriptSource = Join-Path $srcFirefox "firefox-import-ui.js"
$scriptDest = Join-Path $Dist "src\firefox-import-ui.js"

Copy-Item -LiteralPath $scriptSource -Destination $scriptDest -Force

$projectOverridesSource = Join-Path $srcFirefox "firefox-project-overrides.js"
$projectOverridesDest = Join-Path $Dist "src\firefox-project-overrides.js"
Copy-Item -LiteralPath $projectOverridesSource -Destination $projectOverridesDest -Force

$iconsSource = Join-Path $srcFirefox "icons"
$iconsDest = Join-Path $Dist "src\icons"
if (Test-Path -LiteralPath $iconsSource) {
  if (!(Test-Path -LiteralPath $iconsDest)) {
    New-Item -ItemType Directory -Path $iconsDest | Out-Null
  }
  Copy-Item -Path (Join-Path $iconsSource "*") -Destination $iconsDest -Force
}

# Copy Firefox background script
$bgSource = Join-Path $srcFirefox "firefox-background.js"
$bgDest = Join-Path $Dist "src\firefox-background.js"
Copy-Item -LiteralPath $bgSource -Destination $bgDest -Force

# Patch dashboard-helper.js to delegate openOptionsPage to background script
$helperPath = Join-Path $Dist "src\content\dashboard-helper.js"
if (Test-Path -LiteralPath $helperPath) {
  $helper = [System.IO.File]::ReadAllText($helperPath)
  $pattern = '(?s)function openOptionsPage\(\)\s*\{.*?\}\s*(?=function renderPanel)'
  $replacement = 'function openOptionsPage() {
  if (STOREPILOT_API.runtime && typeof STOREPILOT_API.runtime.sendMessage === "function") {
    STOREPILOT_API.runtime.sendMessage({ action: "openOptionsPage" }, () => {
      if (STOREPILOT_API.runtime.lastError) {
        console.warn("Could not send openOptionsPage message:", STOREPILOT_API.runtime.lastError.message);
      }
    });
  }
}

'
  $helper = $helper -replace $pattern, $replacement

  # Patch renderPanel to use separate elements for updated timestamp and status messages
  $renderPanelPattern = '(?s)function renderPanel\(\w*\)\s*\{.*?\}\s*(?=function injectStyles)'
  $renderPanelReplacement = 'function renderPanel(locales) {
  const existing = document.getElementById(PANEL_ID);
  if (existing) existing.remove();

  const panel = document.createElement("section");
  const title = document.createElement("div");
  const meta = document.createElement("div");
  const updated = document.createElement("div");
  const status = document.createElement("div");
  const actions = document.createElement("div");

  panel.id = PANEL_ID;
  if (currentTheme !== "system") {
    panel.dataset.theme = currentTheme;
  }
  title.className = "storepilot-title";
  meta.className = "storepilot-meta";
  updated.className = "storepilot-updated";
  status.className = "storepilot-status";
  actions.className = "storepilot-actions";

  title.textContent = localize("extensionName", "StorePilot");
  meta.textContent = locales.length
    ? (activeProjectName
      ? localize("miniPanelLocalesInProject", "$1 locales in $2", [String(locales.length), activeProjectName])
      : localize("localesCount", "$1 locales", [String(locales.length)]))
    : localize("importListingsInOptions", "Import listings in StorePilot options");
  updated.textContent = localize("lastUpdatedOn", "Last updated on $1.", [formatDisplayTimestamp(activeProjectUpdatedAt)]);
  status.textContent = "";

  const fillCurrentButton = createButton(localize("fillCurrent", "Fill current"), async () => {
      const result = await fillCurrentDashboardLanguage();
      status.textContent = result.message;
  });
  fillCurrentButton.dataset.storepilotAction = "fill-current";
  const fillAllButton = createButton(localize("fillAll", "Fill all"), async () => {
    if (isFillingAllLanguages) {
      status.textContent = localize("fillAllAlreadyRunning", "Fill all is already running.");
      return;
    }

    isFillingAllLanguages = true;
    fillAllAbortRequested = false;
    await publishFillAllStatus({
      running: true,
      message: localize("fillingAllLanguages", "Filling all languages...")
    });
    fillAllButton.disabled = true;
    fillCurrentButton.disabled = true;
    abortButton.hidden = false;
    status.textContent = localize("fillingAllLanguages", "Filling all languages...");

    try {
      const result = await fillAllDashboardLanguages(message => {
        status.textContent = message;
      });
      status.textContent = result.message;
    } finally {
      isFillingAllLanguages = false;
      await publishFillAllStatus({
        running: false,
        message: status.textContent
      });
    }
  });
  fillAllButton.dataset.storepilotAction = "fill-all";
  const abortButton = createButton(localize("abort", "Abort"), () => {
    const result = abortFillAllLanguages();
    status.textContent = result.message;
  });
  abortButton.dataset.storepilotAction = "abort-fill-all";
  abortButton.className = "storepilot-danger";
  abortButton.hidden = !isFillingAllLanguages;
  const optionsButton = createButton(localize("options", "Options"), openOptionsPage);

  actions.append(fillCurrentButton, fillAllButton, abortButton, optionsButton);

  panel.append(title, meta, updated, actions, status);
  document.documentElement.append(panel);
  updatePanelFillAllUi();
}

'
  $helper = $helper -replace $renderPanelPattern, $renderPanelReplacement

  # Patch injectStyles to style the updated and status elements nicely
  $injectStylesPattern = '(?s)function injectStyles\(\)\s*\{.*?\}\s*(?=STOREPILOT_API\.runtime\.onMessage\.addListener)'
  $injectStylesReplacement = 'function injectStyles() {
  if (document.getElementById("storepilot-styles")) return;

  const style = document.createElement("style");
  style.id = "storepilot-styles";
  style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483647;
      display: grid;
      gap: 8px;
      width: 280px;
      padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.16);
      border-radius: 8px;
      background: #fff;
      color: #111827;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.2);
      font: 13px/1.4 Arial, sans-serif;
    }

    #${PANEL_ID}[data-theme="dark"] {
      border-color: #343b4a;
      background: #151922;
      color: #f4f6fa;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    }

    #${PANEL_ID} .storepilot-title {
      font-weight: 700;
    }

    #${PANEL_ID} .storepilot-meta,
    #${PANEL_ID} .storepilot-updated {
      color: #475569;
      font-size: 12px;
    }

    #${PANEL_ID}[data-theme="dark"] .storepilot-meta,
    #${PANEL_ID}[data-theme="dark"] .storepilot-updated {
      color: #a8b0bf;
    }

    #${PANEL_ID} select,
    #${PANEL_ID} button {
      min-height: 30px;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      background: #fff;
      color: #111827;
      font: inherit;
    }

    #${PANEL_ID} .storepilot-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    #${PANEL_ID} button {
      cursor: pointer;
      font-weight: 700;
    }

    #${PANEL_ID} button[hidden] {
      display: none;
    }

    #${PANEL_ID} .storepilot-danger {
      border-color: #dc2626;
      background: #fff5f5;
      color: #b42318;
    }

    #${PANEL_ID}[data-theme="dark"] select,
    #${PANEL_ID}[data-theme="dark"] button {
      border-color: #343b4a;
      background: #202633;
      color: #f4f6fa;
    }

    #${PANEL_ID}[data-theme="dark"] .storepilot-danger {
      border-color: #7f1d1d;
      background: #2b1719;
      color: #ff9b92;
    }

    #${PANEL_ID} .storepilot-status {
      color: #475569;
      font-size: 12px;
      min-height: 18px;
    }

    #${PANEL_ID}[data-theme="dark"] .storepilot-status {
      color: #cbd5e1;
    }

    @media (prefers-color-scheme: dark) {
      #${PANEL_ID}:not([data-theme="light"]) {
        border-color: #343b4a;
        background: #151922;
        color: #f4f6fa;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
      }

      #${PANEL_ID}:not([data-theme="light"]) .storepilot-meta,
      #${PANEL_ID}:not([data-theme="light"]) .storepilot-updated {
        color: #a8b0bf;
      }

      #${PANEL_ID}:not([data-theme="light"]) select,
      #${PANEL_ID}:not([data-theme="light"]) button {
        border-color: #343b4a;
        background: #202633;
        color: #f4f6fa;
      }

      #${PANEL_ID}:not([data-theme="light"]) .storepilot-danger {
        border-color: #7f1d1d;
        background: #2b1719;
        color: #ff9b92;
      }

      #${PANEL_ID}:not([data-theme="light"]) .storepilot-status {
        color: #cbd5e1;
      }
    }
  `;
  document.documentElement.append(style);
}

'
  $helper = $helper -replace $injectStylesPattern, $injectStylesReplacement

  # Patch storage onChanged listener to react to active project and projects changes
  $onChangedPattern = '(?s)STOREPILOT_API\.storage\.onChanged\.addListener\(\(changes,\s*areaName\)\s*=>\s*\{.*'
  $onChangedReplacement = 'STOREPILOT_API.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  (async () => {
    let needsRender = false;

    if (changes[SETTINGS_KEY]) {
      currentTheme = (changes[SETTINGS_KEY].newValue && changes[SETTINGS_KEY].newValue.theme) || "system";
      needsRender = true;
    }

    if (changes[ACTIVE_PROJECT_STORAGE_KEY] || changes[PROJECTS_STORAGE_KEY]) {
      needsRender = true;
    }

    if (needsRender) {
      const locales = await loadListings();
      renderPanel(locales);
    }
  })();
});
'
  $helper = $helper -replace $onChangedPattern, $onChangedReplacement

  [System.IO.File]::WriteAllText($helperPath, $helper, [System.Text.UTF8Encoding]::new($false))
}

$htmlFiles = @(
  (Join-Path $Dist "src\options\options.html"),
  (Join-Path $Dist "src\popup\popup.html")
)

foreach ($htmlFile in $htmlFiles) {
  $html = [System.IO.File]::ReadAllText($htmlFile)
  if ($html -notmatch "firefox-project-overrides\.js") {
    $html = $html -replace "(\s*<script src=`"../shared/sync\.js`"></script>)", "`$1`r`n    <script src=`"../firefox-project-overrides.js`"></script>"
  }
  if ($html -notmatch "firefox-import-ui\.js") {
    $html = $html -replace "</body>", "    <script src=`"../firefox-import-ui.js`"></script>`r`n  </body>"
  }
  [System.IO.File]::WriteAllText($htmlFile, $html, [System.Text.UTF8Encoding]::new($false))
}
