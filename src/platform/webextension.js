var STOREPILOT_API = globalThis.browser || globalThis.chrome;

function storePilotGetWebExtensionApi() {
  if (!STOREPILOT_API) {
    throw new Error("WebExtension API is unavailable.");
  }
  return STOREPILOT_API;
}

function storePilotCallMaybePromise(fn, thisArg, args = []) {
  if (STOREPILOT_API === globalThis.browser) {
    return Promise.resolve(fn.apply(thisArg, args));
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    function callback(result) {
      if (settled) return;
      settled = true;
      const error = STOREPILOT_API && STOREPILOT_API.runtime && STOREPILOT_API.runtime.lastError;
      if (error) {
        reject(new Error(error.message || String(error)));
      } else {
        resolve(result);
      }
    }

    try {
      const result = fn.apply(thisArg, [...args, callback]);
      if (result && typeof result.then === "function") {
        result.then(resolve, reject);
      } else if (fn.length <= args.length && !settled) {
        settled = true;
        resolve(result);
      }
    } catch (error) {
      reject(error);
    }
  });
}

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

function storePilotScriptingExecuteScript(details) {
  const api = storePilotGetWebExtensionApi();
  return storePilotCallMaybePromise(api.scripting.executeScript, api.scripting, [details]);
}

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

function storePilotI18nGetMessage(key, substitutions) {
  const api = STOREPILOT_API;
  return api && api.i18n && api.i18n.getMessage
    ? api.i18n.getMessage(key, substitutions)
    : "";
}
