const STOREPILOT_THEME_MODES = [
  "system",
  "light",
  "dark"
];

const STOREPILOT_THEME_STYLES = [
  "default",
  "slate",
  "ocean",
  "forest",
  "high-contrast"
];

function storePilotGetThemeChoices() {
  return [...STOREPILOT_THEME_MODES];
}

function storePilotGetThemeStyleChoices() {
  return [...STOREPILOT_THEME_STYLES];
}

function storePilotNormalizeThemeChoice(theme) {
  const value = String(theme || "").trim().toLowerCase();
  return STOREPILOT_THEME_MODES.includes(value) ? value : "system";
}

function storePilotNormalizeThemeStyle(themeStyle, legacyTheme = "") {
  const value = String(themeStyle || "").trim().toLowerCase();
  if (STOREPILOT_THEME_STYLES.includes(value)) return value;

  const legacyValue = String(legacyTheme || "").trim().toLowerCase();
  return STOREPILOT_THEME_STYLES.includes(legacyValue) ? legacyValue : "default";
}

function storePilotNormalizeThemePreferences(settings = {}) {
  const rawSettings = settings && typeof settings === "object" ? settings : {};

  return {
    theme: storePilotNormalizeThemeChoice(rawSettings.theme),
    themeStyle: storePilotNormalizeThemeStyle(rawSettings.themeStyle, rawSettings.theme)
  };
}

function storePilotApplyThemeChoice(theme, target = document.documentElement) {
  return storePilotApplyThemePreferences(theme, "default", target).theme;
}

function storePilotApplyThemePreferences(theme, themeStyle, target = document.documentElement) {
  const normalized = {
    theme: storePilotNormalizeThemeChoice(theme),
    themeStyle: storePilotNormalizeThemeStyle(themeStyle)
  };

  if (normalized.theme === "system") {
    target.removeAttribute("data-theme");
  } else {
    target.dataset.theme = normalized.theme;
  }

  if (normalized.themeStyle === "default") {
    target.removeAttribute("data-theme-style");
  } else {
    target.dataset.themeStyle = normalized.themeStyle;
  }

  return normalized;
}
