function storePilotMessage(key, substitutions, fallback = "") {
  const api = globalThis.browser || globalThis.chrome;
  if (!api || !api.i18n || typeof api.i18n.getMessage !== "function") {
    return fallback;
  }

  return api.i18n.getMessage(key, substitutions) || fallback;
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
