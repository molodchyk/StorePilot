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
