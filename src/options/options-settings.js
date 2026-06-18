var STOREPILOT_OPTIONS_SETTINGS_KEY = "storePilotSettings";

function storePilotOptionsApplyTheme(theme, themeChoices = []) {
  const normalized = ["system", "light", "dark"].includes(theme) ? theme : "system";

  if (normalized === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = normalized;
  }

  themeChoices.forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === normalized));
  });
}

async function storePilotOptionsGetSettings() {
  const stored = await storePilotStorageLocalGet(STOREPILOT_OPTIONS_SETTINGS_KEY);
  return {
    theme: "system",
    showAdvancedFillActions: false,
    ...(stored[STOREPILOT_OPTIONS_SETTINGS_KEY] || {})
  };
}

async function storePilotOptionsUpdateSettings(patch) {
  const settings = {
    ...(await storePilotOptionsGetSettings()),
    ...patch
  };

  await storePilotStorageLocalSet({ [STOREPILOT_OPTIONS_SETTINGS_KEY]: settings });
  return settings;
}

function storePilotOptionsApplySettings(settings = {}, elements = {}) {
  const normalized = {
    theme: "system",
    showAdvancedFillActions: false,
    ...settings
  };

  storePilotOptionsApplyTheme(normalized.theme, elements.themeChoices || []);
  if (elements.showAdvancedFillActions) {
    elements.showAdvancedFillActions.checked = Boolean(normalized.showAdvancedFillActions);
  }
}
