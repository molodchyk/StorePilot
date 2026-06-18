const PRIVACY_DATA_USAGE_KEYS = STOREPILOT_PRIVACY_DATA_USAGE_KEYS;
const PRIVACY_CERTIFICATION_KEYS = STOREPILOT_PRIVACY_CERTIFICATION_KEYS;

function normalizePrivacyMatchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/[^a-z0-9_. -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getActivePrivacyFields() {
  return activePrivacyDoc && activePrivacyDoc.file && activePrivacyDoc.file.fields
    ? activePrivacyDoc.file.fields
    : {};
}

function normalizePrivacyBooleanValue(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (["yes", "true", "on", "1", "y"].includes(normalized)) return "yes";
  if (["no", "false", "off", "0", "n", "none", ""].includes(normalized)) return normalized ? "no" : "";
  return normalized;
}

function normalizeDataUsageDisclosureValue(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (["yes", "true", "on", "1", "y"].includes(normalized)) return "yes";
  if (["no", "false", "off", "0", "n"].includes(normalized)) return "no";
  if (["", "none", "na", "n_a", "not_applicable", "omit", "skip"].includes(normalized)) return "";
  return "";
}
