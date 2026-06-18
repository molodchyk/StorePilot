function storePilotI18nGetMessage(key, substitutions) {
  const api = STOREPILOT_API;
  return api && api.i18n && api.i18n.getMessage
    ? api.i18n.getMessage(key, substitutions)
    : "";
}
