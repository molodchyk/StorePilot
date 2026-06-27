const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  STOREPILOT_PRIVACY_DATA_USAGE_KEYS: [
    "data_usage.personally_identifiable_information",
    "data_usage.health_information",
    "data_usage.financial_payment_information",
    "data_usage.authentication_information",
    "data_usage.personal_communications",
    "data_usage.location",
    "data_usage.web_history",
    "data_usage.user_activity",
    "data_usage.website_content"
  ],
  STOREPILOT_PRIVACY_CERTIFICATION_KEYS: [
    "certification.no_sell_or_transfer",
    "certification.no_unrelated_use",
    "certification.no_creditworthiness"
  ]
});

for (const relativePath of [
  "src/content/dashboard-privacy-core.js",
  "src/content/dashboard-privacy-fields.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), context, {
    filename: relativePath
  });
}

function text(value) {
  return context.normalizePrivacyMatchText(value);
}

function textAreaCandidate(contextText, payload = "1") {
  return {
    context: text(contextText),
    payload,
    maxLength: 1000,
    required: true,
    tagName: "textarea",
    area: 42000
  };
}

const hostPermissionCandidate = textAreaCandidate(`
  Host permission justification
  A host permission is any match pattern specified in the 'permissions' and
  'content_scripts' fields of the extension manifest.
`);

assert.ok(
  context.scorePrivacyFieldCandidate(hostPermissionCandidate, "host_permission") >= 80,
  "Host permission field should still match host_permission."
);
assert.equal(
  context.scorePrivacyFieldCandidate(hostPermissionCandidate, "permission.scripting"),
  0,
  "Host permission field must not be used as a fallback for a missing scripting permission field."
);
assert.equal(
  context.scorePrivacyFieldCandidate(hostPermissionCandidate, "permission.tabs"),
  0,
  "Host permission field must not be used as a fallback for a missing tabs permission field."
);

assert.ok(
  context.scorePrivacyFieldCandidate(textAreaCandidate("scripting justification"), "permission.scripting") >= 80,
  "A real scripting permission field should still match permission.scripting."
);
assert.ok(
  context.scorePrivacyFieldCandidate(textAreaCandidate("tabs justification"), "permission.tabs") >= 80,
  "A real tabs permission field should still match permission.tabs."
);

const chromeWebStorePrivacyOrderFields = {
  single_purpose: "Does one thing.",
  host_permission: "Only uses supported host permissions.",
  "permission.storage": "Stores extension settings.",
  "permission.alarms": "Refreshes a badge after midnight.",
  "permission.tabs": "Opens supported tabs.",
  "permission.scripting": "Injects extension packaged scripts.",
  remote_code: "no",
  privacy_policy_url: "https://example.com/privacy"
};

const expectedChromeWebStorePrivacyOrder = [
  "single_purpose",
  "permission.alarms",
  "permission.scripting",
  "permission.storage",
  "permission.tabs",
  "host_permission",
  "remote_code",
  "privacy_policy_url"
];

assert.deepEqual(
  Array.from(context.getVisiblePrivacyFieldKeys(chromeWebStorePrivacyOrderFields)),
  expectedChromeWebStorePrivacyOrder,
  "Visible privacy field order should match the Chrome Web Store field order."
);

vm.runInContext(`
  globalThis.__lastFillPrivacyKeys = null;
  fillPrivacyFields = function(keys) {
    globalThis.__lastFillPrivacyKeys = Array.from(keys);
    return { ok: true, keys: globalThis.__lastFillPrivacyKeys };
  };
`, context);

context.activePrivacyDoc = {
  file: {
    fields: chromeWebStorePrivacyOrderFields
  }
};

context.fillDetectedPrivacyFields();

assert.deepEqual(
  Array.from(context.__lastFillPrivacyKeys),
  expectedChromeWebStorePrivacyOrder,
  "Bulk privacy fill should use the same Chrome Web Store field order."
);

console.log("Privacy field matching tests passed.");
