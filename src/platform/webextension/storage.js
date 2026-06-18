function storePilotStorageLocalGet(keys) {
  const api = storePilotGetWebExtensionApi();
  return storePilotCallMaybePromise(api.storage.local.get, api.storage.local, [keys]);
}

function storePilotStorageLocalSet(values) {
  const api = storePilotGetWebExtensionApi();
  return storePilotCallMaybePromise(api.storage.local.set, api.storage.local, [values]);
}

function storePilotStorageLocalClear() {
  const api = storePilotGetWebExtensionApi();
  return storePilotCallMaybePromise(api.storage.local.clear, api.storage.local);
}

function storePilotStorageOnChangedAddListener(listener) {
  storePilotGetWebExtensionApi().storage.onChanged.addListener(listener);
}
