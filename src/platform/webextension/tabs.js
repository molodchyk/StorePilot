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
