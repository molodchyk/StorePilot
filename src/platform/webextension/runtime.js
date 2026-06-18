function storePilotRuntimeSendMessage(message) {
  const api = storePilotGetWebExtensionApi();
  return storePilotCallMaybePromise(api.runtime.sendMessage, api.runtime, [message]);
}

function storePilotRuntimeOnMessageAddListener(listener) {
  storePilotGetWebExtensionApi().runtime.onMessage.addListener(listener);
}

function storePilotRuntimeGetUrl(path) {
  return storePilotGetWebExtensionApi().runtime.getURL(path);
}

function storePilotRuntimeOpenOptionsPage() {
  const api = storePilotGetWebExtensionApi();
  if (api.runtime.openOptionsPage) {
    return storePilotCallMaybePromise(api.runtime.openOptionsPage, api.runtime);
  }
  return storePilotTabsCreate({ url: storePilotRuntimeGetUrl("src/options/options.html") });
}
