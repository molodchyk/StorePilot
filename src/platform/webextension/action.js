function storePilotActionOnClickedAddListener(listener) {
  const api = storePilotGetWebExtensionApi();
  if (api.action && api.action.onClicked) {
    api.action.onClicked.addListener(listener);
  }
}

function storePilotActionCanOpenPopup() {
  const api = storePilotGetWebExtensionApi();
  return Boolean(api.action && typeof api.action.setPopup === "function" && typeof api.action.openPopup === "function");
}

async function storePilotActionSetPopup(details) {
  const api = storePilotGetWebExtensionApi();
  if (!api.action || typeof api.action.setPopup !== "function") return;
  await storePilotCallMaybePromise(api.action.setPopup, api.action, [details]);
}

async function storePilotActionOpenPopup() {
  const api = storePilotGetWebExtensionApi();
  if (!api.action || typeof api.action.openPopup !== "function") return false;
  await storePilotCallMaybePromise(api.action.openPopup, api.action);
  return true;
}
