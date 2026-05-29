(function () {
  const api = globalThis.browser || globalThis.chrome;

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === "openOptionsPage") {
      if (api.runtime.openOptionsPage) {
        api.runtime.openOptionsPage();
      } else {
        api.tabs.create({ url: api.runtime.getURL("src/options/options.html") });
      }
      sendResponse({ ok: true });
    }
  });
  // Conditionally open popup on devconsole pages, otherwise go to options
  api.action.onClicked.addListener(() => {
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      const url = tab && tab.url ? tab.url : '';
      const isDevConsole = url.includes('/devconsole/');
      const isWebstore = url.includes('chrome.google.com/webstore') || url.includes('chromewebstore.google.com');
      const isOptions = url.includes('src/options/options.html');

      if (isDevConsole) {
        // If the action API supports it, set the popup for this tab and open it
        if (api.action && typeof api.action.setPopup === "function" && typeof api.action.openPopup === "function") {
          api.action.setPopup({ tabId: tab.id, popup: "src/popup/popup.html" });
          api.action.openPopup();
        } else {
          // Fallback: open the options page (no popup support)
          if (api.runtime.openOptionsPage) {
            api.runtime.openOptionsPage();
          } else {
            api.tabs.create({ url: api.runtime.getURL('src/options/options.html') });
          }
        }
        return;
      }

      // For non‑devconsole pages, redirect to options unless we are on the public Web Store or already on options
      if (!(isWebstore && !isDevConsole) && !isOptions) {
        if (api.runtime.openOptionsPage) {
          api.runtime.openOptionsPage();
        } else {
          api.tabs.create({ url: api.runtime.getURL('src/options/options.html') });
        }
      }
      // Otherwise do nothing
    });
  });
})();
