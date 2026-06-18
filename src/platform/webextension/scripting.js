function storePilotScriptingExecuteScript(details) {
  const api = storePilotGetWebExtensionApi();
  return storePilotCallMaybePromise(api.scripting.executeScript, api.scripting, [details]);
}
