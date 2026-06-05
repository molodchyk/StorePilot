function storePilotApplySubstitutions(message, substitutions) {
  if (!substitutions) return message;

  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  return String(message || "").replace(/\$(\d+)/g, (_match, index) => {
    const value = values[Number(index) - 1];
    return value === undefined || value === null ? "" : String(value);
  });
}

function storePilotMessage(key, substitutions, fallback = "") {
  const api = globalThis.browser;
  const fallbackMessage = storePilotApplySubstitutions(fallback, substitutions);

  if (!api || !api.i18n || typeof api.i18n.getMessage !== "function") {
    return fallbackMessage;
  }

  return storePilotApplySubstitutions(api.i18n.getMessage(key, substitutions) || fallback, substitutions);
}

function storePilotText(key, fallback = "", substitutions) {
  return storePilotMessage(key, substitutions, fallback);
}

function storePilotApplyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(element => {
    const message = storePilotMessage(element.dataset.i18n);
    if (message) element.textContent = message;
  });

  root.querySelectorAll("[data-i18n-title]").forEach(element => {
    const message = storePilotMessage(element.dataset.i18nTitle);
    if (message) element.title = message;
  });

  root.querySelectorAll("[data-i18n-aria-label]").forEach(element => {
    const message = storePilotMessage(element.dataset.i18nAriaLabel);
    if (message) element.setAttribute("aria-label", message);
  });
}
