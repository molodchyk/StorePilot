const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  URL,
  globalThis: {
    browser: {
      storage: {
        local: {
          get: async () => ({}),
          set: async () => {}
        }
      }
    }
  }
});

for (const relativePath of [
  "src/shared/constants.js",
  "src/shared/storage.js"
]) {
  const filePath = path.join(root, relativePath);
  vm.runInContext(fs.readFileSync(filePath, "utf8"), context, {
    filename: relativePath
  });
}

const browseVault = { id: "browse-vault", name: "Browse Vault" };
const defense = { id: "defense", name: "Defense against Distractions" };
const projects = [browseVault, defense];
const state = { projects, activeProjectId: browseVault.id };
const browseVaultExtensionId = "imecemnmedkkkboidgmdnjjaelfcaajo";
const defenseExtensionId = "nhkelkpefomnpeigoifhhlmajenkohfo";

assert.equal(
  context.storePilotNormalizeDashboardExtensionId(` ${defenseExtensionId.toUpperCase()} `),
  defenseExtensionId,
  "extension ids should normalize to lower-case CWS ids"
);

assert.equal(
  context.storePilotGetDashboardExtensionIdFromUrl(`https://chrome.google.com/webstore/devconsole/3f375c03-c756-4a15-90e6-4876d2227d99/${defenseExtensionId}/edit/listing`),
  defenseExtensionId,
  "CWS extension id should be read from listing URLs"
);

assert.equal(
  context.storePilotFindProjectByDashboardTitle(projects, "BrowseVault: History Search & Backup").id,
  browseVault.id,
  "dashboard title matching should tolerate punctuation and spacing"
);

assert.equal(
  context.storePilotFindProjectByDashboardTitle(projects, "Defense against Distractions").id,
  defense.id,
  "dashboard title matching should find the correct project by visible title"
);

const boundResult = context.storePilotResolveDashboardProjectFromState(
  state,
  {
    [defenseExtensionId]: {
      projectId: defense.id,
      extensionId: defenseExtensionId
    }
  },
  {
    url: `https://chrome.google.com/webstore/devconsole/3f375c03-c756-4a15-90e6-4876d2227d99/${defenseExtensionId}/edit`
  }
);

assert.equal(boundResult.project.id, defense.id);
assert.equal(boundResult.source, "binding");
assert.equal(boundResult.extensionId, defenseExtensionId);

const titleResult = context.storePilotResolveDashboardProjectFromState(
  state,
  {},
  {
    title: "Defense against Distractions"
  }
);

assert.equal(titleResult.project.id, defense.id);
assert.equal(titleResult.source, "title");

const activeFallbackResult = context.storePilotResolveDashboardProjectFromState(
  state,
  {},
  {
    title: "Unknown Dashboard"
  }
);

assert.equal(activeFallbackResult.project.id, browseVault.id);
assert.equal(activeFallbackResult.source, "active");

const staleBindingResult = context.storePilotResolveDashboardProjectFromState(
  state,
  {
    [browseVaultExtensionId]: {
      projectId: "deleted-project",
      extensionId: browseVaultExtensionId
    }
  },
  {
    extensionId: browseVaultExtensionId,
    title: "Defense against Distractions"
  }
);

assert.equal(staleBindingResult.project.id, defense.id);
assert.equal(staleBindingResult.source, "title");

console.log("Project resolution tests passed.");
