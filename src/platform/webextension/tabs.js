function storePilotTabsQuery(queryInfo) {
  const api = storePilotGetWebExtensionApi();
  return storePilotCallMaybePromise(api.tabs.query, api.tabs, [queryInfo]);
}

function storePilotTabsSendMessage(tabId, message) {
  const api = storePilotGetWebExtensionApi();
  return storePilotCallMaybePromise(api.tabs.sendMessage, api.tabs, [tabId, message]);
}

function storePilotTabsCreate(createProperties) {
  const api = storePilotGetWebExtensionApi();
  return storePilotCallMaybePromise(api.tabs.create, api.tabs, [createProperties]);
}

function storePilotTabsUpdate(tabId, updateProperties) {
  const api = storePilotGetWebExtensionApi();
  return storePilotCallMaybePromise(api.tabs.update, api.tabs, [tabId, updateProperties]);
}

function storePilotTabsRemove(tabIds) {
  const api = storePilotGetWebExtensionApi();
  return storePilotCallMaybePromise(api.tabs.remove, api.tabs, [tabIds]);
}

function storePilotWindowsUpdate(windowId, updateProperties) {
  const api = storePilotGetWebExtensionApi();
  return api.windows && api.windows.update
    ? storePilotCallMaybePromise(api.windows.update, api.windows, [windowId, updateProperties])
    : Promise.resolve(null);
}
