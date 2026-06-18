# Privacy Policy

StorePilot does not collect or transmit data to the StorePilot developer or to a StorePilot server.

StorePilot is a local-first Firefox extension for browser extension publishers. It imports user-selected project files, stores the imported project data locally in browser extension storage, and helps fill Chrome Web Store Developer Dashboard fields only when the user clicks an action.

## Data Stored Locally

StorePilot stores the following data in the browser-managed local extension storage on your device:

- Imported listing description text.
- Imported category decisions.
- Imported Additional fields values.
- Imported graphic asset metadata and local media references.
- Imported privacy-form text and Data usage disclosure choices.
- Project metadata, active-project selection, dashboard project bindings, preferences, and status/diagnostic state.
- Browser-managed file or folder permissions after you choose files or folders through the browser file picker.

StorePilot does not use sync storage, managed storage, session storage as a durable data store, or any StorePilot remote database.

You can delete StorePilot's stored local data from **Options > Preferences > Reset local data**. This removes imported projects, preferences, dashboard bindings, folder permissions, and media file handles from this browser.

## Extension Permissions

StorePilot requests these Firefox extension permissions:

- `storage`: stores imported project data, project selection, dashboard bindings, preferences, and local status information in browser extension storage.
- `unlimitedStorage`: allows larger local imports, especially localized listing text and graphic asset metadata for multiple extension projects, without a small extension-storage quota interrupting the local workflow.
- `activeTab`: lets StorePilot inspect and communicate with the active Chrome Web Store dashboard tab only when the user opens the popup or triggers an action.
- `scripting`: injects StorePilot's dashboard helper into the active Chrome Web Store dashboard tab when needed so user-requested fill and upload actions can run on that page.

StorePilot requests these host permissions:

- `https://chrome.google.com/webstore/devconsole/*`
- `https://chromewebstore.google.com/devconsole/*`

These host permissions are used only on Chrome Web Store Developer Dashboard pages so StorePilot can fill dashboard fields and upload reviewable media at the user's request.

## Network Behavior

StorePilot has no analytics, tracking, telemetry, ads, remote server, or StorePilot-owned network endpoint.

StorePilot does not make background network requests to the StorePilot developer. When you use StorePilot on the Chrome Web Store Developer Dashboard, the dashboard itself may communicate with Google's Chrome Web Store services as part of the page you opened. StorePilot's role is limited to filling fields and attaching local files on that dashboard page after you request it.

## Remote Code And External Services

StorePilot does not load remote code, remote scripts, remote styles, WebAssembly from a remote server, or remotely hosted executable dependencies. All extension code is packaged with the add-on.

StorePilot does not use native messaging, external analytics services, advertising SDKs, tracking SDKs, or third-party backend services.

## Data Collection Declaration

StorePilot's manifest declares:

```json
"data_collection_permissions": {
  "required": ["none"]
}
```

This means StorePilot declares no data collection for Firefox Add-ons review purposes.

## Sale, Sharing, And Transfer

StorePilot does not sell, share, rent, or transfer user data to third parties.

StorePilot does not use imported project data for advertising, analytics, creditworthiness, lending, profiling, or any purpose unrelated to the user's explicit store-listing automation workflow.
