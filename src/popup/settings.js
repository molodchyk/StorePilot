var STOREPILOT_SETTINGS_KEY = "storePilotSettings";

function storePilotPopupApplyTheme(settings = {}) {
  const normalized = storePilotNormalizeThemePreferences(
    settings && typeof settings === "object" ? settings : { theme: settings }
  );
  storePilotApplyThemePreferences(normalized.theme, normalized.themeStyle);
}

async function storePilotPopupGetSettings() {
  const stored = await storePilotStorageLocalGet(STOREPILOT_SETTINGS_KEY);
  const storedSettings = stored[STOREPILOT_SETTINGS_KEY] && typeof stored[STOREPILOT_SETTINGS_KEY] === "object"
    ? stored[STOREPILOT_SETTINGS_KEY]
    : {};

  return {
    theme: "system",
    themeStyle: "default",
    showAdvancedFillActions: false,
    ...storedSettings,
    ...storePilotNormalizeThemePreferences(storedSettings)
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
  const rawSettings = settings && typeof settings === "object" ? settings : {};
  const normalized = {
    theme: "system",
    themeStyle: "default",
    showAdvancedFillActions: false,
    ...rawSettings,
    ...storePilotNormalizeThemePreferences(rawSettings)
  };

  storePilotPopupApplyTheme(normalized, elements);
  if (elements.fillCurrentLanguage) {
    elements.fillCurrentLanguage.hidden = !Boolean(normalized.showAdvancedFillActions);
  }
}
