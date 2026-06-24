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
  return {
    theme: "system",
    showAdvancedFillActions: false,
    ...settings,
    tabKeyboardShortcuts: storePilotOptionsNormalizeTabKeyboardShortcuts(settings.tabKeyboardShortcuts)
  };
}

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
  return storePilotOptionsNormalizeSettings({
    theme: "system",
    showAdvancedFillActions: false,
    ...(stored[STOREPILOT_OPTIONS_SETTINGS_KEY] || {})
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

  storePilotOptionsApplyTheme(normalized.theme, elements.themeChoices || []);
  if (elements.showAdvancedFillActions) {
    elements.showAdvancedFillActions.checked = Boolean(normalized.showAdvancedFillActions);
  }
  if (elements.tabShortcutControls) {
    elements.tabShortcutControls.forEach(control => {
      control.checked = Boolean(normalized.tabKeyboardShortcuts[control.dataset.tabShortcutSetting]);
    });
  }
}
