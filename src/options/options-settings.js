var STOREPILOT_OPTIONS_SETTINGS_KEY = "storePilotSettings";

function storePilotOptionsDefaultTabKeyboardShortcuts() {
  return {
    numbers: true,
    letters: true,
    arrows: true
  };
}

function storePilotOptionsNormalizeTabKeyboardShortcuts(value) {
  const defaults = storePilotOptionsDefaultTabKeyboardShortcuts();
  const shortcuts = value && typeof value === "object" ? value : {};

  return {
    numbers: shortcuts.numbers !== undefined ? Boolean(shortcuts.numbers) : defaults.numbers,
    letters: shortcuts.letters !== undefined ? Boolean(shortcuts.letters) : defaults.letters,
    arrows: shortcuts.arrows !== undefined ? Boolean(shortcuts.arrows) : defaults.arrows
  };
}

function storePilotOptionsNormalizeSettings(settings = {}) {
  const rawSettings = settings && typeof settings === "object" ? settings : {};
  const themePreferences = storePilotNormalizeThemePreferences(rawSettings);

  return {
    theme: "system",
    themeStyle: "default",
    showAdvancedFillActions: false,
    ...rawSettings,
    ...themePreferences,
    tabKeyboardShortcuts: storePilotOptionsNormalizeTabKeyboardShortcuts(rawSettings.tabKeyboardShortcuts)
  };
}

function storePilotOptionsApplyTheme(settings = {}, elements = {}) {
  const normalized = storePilotNormalizeThemePreferences(settings);
  storePilotApplyThemePreferences(normalized.theme, normalized.themeStyle);

  (elements.themeModeChoices || []).forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.themeModeChoice === normalized.theme));
  });
  if (elements.themeModePicker) {
    elements.themeModePicker.value = normalized.theme;
  }
  if (elements.themeStylePicker) {
    elements.themeStylePicker.value = normalized.themeStyle;
  }
}

async function storePilotOptionsGetSettings() {
  const stored = await storePilotStorageLocalGet(STOREPILOT_OPTIONS_SETTINGS_KEY);
  const storedSettings = stored[STOREPILOT_OPTIONS_SETTINGS_KEY] && typeof stored[STOREPILOT_OPTIONS_SETTINGS_KEY] === "object"
    ? stored[STOREPILOT_OPTIONS_SETTINGS_KEY]
    : {};

  return storePilotOptionsNormalizeSettings({
    theme: "system",
    themeStyle: "default",
    showAdvancedFillActions: false,
    ...storedSettings
  });
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
  const normalized = storePilotOptionsNormalizeSettings(settings);

  storePilotOptionsApplyTheme(normalized, elements);
  if (elements.showAdvancedFillActions) {
    elements.showAdvancedFillActions.checked = Boolean(normalized.showAdvancedFillActions);
  }
  if (elements.tabShortcutControls) {
    elements.tabShortcutControls.forEach(control => {
      control.checked = Boolean(normalized.tabKeyboardShortcuts[control.dataset.tabShortcutSetting]);
    });
  }
}
