const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  FileReader: class {},
  storePilotFormatTimestamp: () => "2026-06-18T00:00:00.000Z",
  storePilotText: (_key, fallback, substitutions = []) => substitutions.reduce(
    (text, value, index) => text.replace(`$${index + 1}`, value),
    fallback
  )
});

for (const relativePath of [
  "src/shared/store-docs/privacy-schema.js",
  "src/shared/store-docs/privacy-doc.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), context, {
    filename: relativePath
  });
}

const localOnlyPrivacyDoc = context.storePilotParsePrivacyDoc(`
[privacy]
single_purpose:
StorePilot imports local project metadata at the user's request.

remote_code:
StorePilot does not load remote code. All extension code is packaged locally.

remote_code_justification:
This should not be shown when remote_code resolves to no.

privacy_policy_url:
https://example.com/privacy

data_usage.web_history:
no

certification.no_sell_or_transfer:
yes

## Permission Justifications

### storage
Used to save local extension preferences.
`);

assert.equal(localOnlyPrivacyDoc.hasPrivacyBlock, true);
assert.equal(localOnlyPrivacyDoc.fields.remote_code, "StorePilot does not load remote code. All extension code is packaged locally.");
assert.equal(context.storePilotGetRemoteCodeDisplayDecision(localOnlyPrivacyDoc.fields.remote_code), "no");
assert.equal(localOnlyPrivacyDoc.permissions.storage, "Used to save local extension preferences.");
assert.equal(localOnlyPrivacyDoc.fields["data_usage.web_history"], "no");
assert.deepEqual(
  Array.from(context.storePilotGetPrivacyDocFieldKeys(localOnlyPrivacyDoc.fields)),
  [
    "single_purpose",
    "permission.storage",
    "remote_code",
    "privacy_policy_url"
  ],
  "Data Usage keys and no-case remote_code_justification should stay out of the Privacy Document text-field order."
);

const remoteCodeYesFields = {
  single_purpose: "Does one thing.",
  remote_code: "yes",
  remote_code_justification: "Loads a remote enterprise script selected by the user.",
  privacy_policy_url: "https://example.com/privacy"
};

assert.deepEqual(
  Array.from(context.storePilotGetPrivacyDocFieldKeys(remoteCodeYesFields)),
  [
    "single_purpose",
    "remote_code",
    "remote_code_justification",
    "privacy_policy_url"
  ],
  "remote_code_justification should be visible only when remote_code resolves to yes."
);

const summary = context.storePilotCreatePrivacyDocSummary([
  {
    path: "docs/chrome-web-store-privacy-form.md",
    name: "chrome-web-store-privacy-form.md",
    size: 512,
    score: 200,
    parsed: localOnlyPrivacyDoc
  }
]);

assert.equal(summary.file.path, "docs/chrome-web-store-privacy-form.md");
assert.equal(summary.file.fieldCount, localOnlyPrivacyDoc.fieldCount);
assert.equal(summary.candidateCounts.scanned, 1);
assert.equal(summary.candidateCounts.matched, 1);

console.log("Privacy document tests passed.");
