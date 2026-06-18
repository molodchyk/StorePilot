var STOREPILOT_SETTINGS_KEY = "storePilotSettings";

function storePilotPopupApplyTheme(theme, themeChoices = []) {
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

async function storePilotPopupGetSettings() {
  const stored = await storePilotStorageLocalGet(STOREPILOT_SETTINGS_KEY);
  return {
    theme: "system",
    showAdvancedFillActions: false,
    ...(stored[STOREPILOT_SETTINGS_KEY] || {})
  };
}

async function storePilotPopupUpdateSettings(patch) {
  const settings = {
    ...(await storePilotPopupGetSettings()),
    ...patch
  };

  await storePilotStorageLocalSet({ [STOREPILOT_SETTINGS_KEY]: settings });
  return settings;
}

function storePilotPopupApplySettings(settings = {}, elements = {}) {
  const normalized = {
    theme: "system",
    showAdvancedFillActions: false,
    ...settings
  };

  storePilotPopupApplyTheme(normalized.theme, elements.themeChoices || []);
  if (elements.fillCurrentLanguage) {
    elements.fillCurrentLanguage.hidden = !Boolean(normalized.showAdvancedFillActions);
  }
}
