const STOREPILOT_PRIVACY_DOC_MAX_BYTES = 1024 * 1024;
const STOREPILOT_PRIVACY_DATA_USAGE_KEYS = [
  "data_usage.personally_identifiable_information",
  "data_usage.health_information",
  "data_usage.financial_payment_information",
  "data_usage.authentication_information",
  "data_usage.personal_communications",
  "data_usage.location",
  "data_usage.web_history",
  "data_usage.user_activity",
  "data_usage.website_content"
];
const STOREPILOT_PRIVACY_CERTIFICATION_KEYS = [
  "certification.no_sell_or_transfer",
  "certification.no_unrelated_use",
  "certification.no_creditworthiness"
];

function storePilotIsPrivacyDataUsageFieldKey(key) {
  return STOREPILOT_PRIVACY_DATA_USAGE_KEYS.includes(key) || STOREPILOT_PRIVACY_CERTIFICATION_KEYS.includes(key);
}

function storePilotGetRemoteCodeDisplayDecision(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (["yes", "true", "on", "1", "y"].includes(normalized)) return "yes";
  if (["no", "false", "off", "0", "n", "none", ""].includes(normalized)) return normalized ? "no" : "";

  const matchText = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_. -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const negative = (
    /does not (load|use|include|execute|eval|reference).*remote code/.test(matchText) ||
    /remote code.*(not used|not loaded|not included|not requested|none|no)/.test(matchText) ||
    /\bno remote code\b/.test(matchText) ||
    /remote scripts?.*(not used|not loaded|none|no)/.test(matchText) ||
    /all extension code.*packaged locally/.test(matchText) ||
    /code.*packaged locally/.test(matchText)
  );

  return negative ? "no" : "yes";
}

function storePilotGetPrivacyDocFieldKeys(fields) {
  const privacyFields = fields || {};
  const includeRemoteCodeJustification = storePilotGetRemoteCodeDisplayDecision(privacyFields.remote_code) === "yes";
  const keys = Object.keys(privacyFields).filter(key => (
    !storePilotIsPrivacyDataUsageFieldKey(key) &&
    key !== "remote_code" &&
    key !== "remote_code_justification"
  ));
  const permissionKeys = keys.filter(key => key.startsWith("permission.")).sort((a, b) => a.localeCompare(b));
  const preferredOrder = [
    "single_purpose"
  ];
  const hostPermissionOrder = keys.includes("host_permission") ? ["host_permission"] : [];

  const remoteCodeOrder = [];
  if (Object.prototype.hasOwnProperty.call(privacyFields, "remote_code")) {
    remoteCodeOrder.push("remote_code");
  }
  if (includeRemoteCodeJustification) {
    remoteCodeOrder.push("remote_code_justification");
  }

  const ordered = preferredOrder.filter(key => keys.includes(key))
    .concat(permissionKeys)
    .concat(hostPermissionOrder)
    .concat(keys.filter(key => (
      !preferredOrder.includes(key) &&
      !permissionKeys.includes(key) &&
      key !== "host_permission" &&
      key !== "privacy_policy_url"
    )).sort((a, b) => a.localeCompare(b)))
    .concat(remoteCodeOrder);

  if (keys.includes("privacy_policy_url")) ordered.push("privacy_policy_url");
  return ordered;
}

function storePilotCreateEmptyPrivacyDocCandidateCounts() {
  return {
    scanned: 0,
    matched: 0
  };
}

function storePilotNormalizePrivacyDocPath(pathParts) {
  return Array.from(pathParts || [])
    .map(part => String(part || "").trim())
    .filter(Boolean)
    .join("/");
}

function storePilotNormalizePrivacyKey(key) {
  const raw = String(key || "").trim();
  if (/^permission\./i.test(raw)) {
    const suffix = raw.slice(raw.indexOf(".") + 1).trim();
    const permissionCode = storePilotNormalizePermissionCode(suffix);
    return permissionCode ? `permission.${permissionCode}` : "";
  }

  if (/^certification[\s_.-]*1$/i.test(raw)) return "certification.no_sell_or_transfer";
  if (/^certification[\s_.-]*2$/i.test(raw)) return "certification.no_unrelated_use";
  if (/^certification[\s_.-]*3$/i.test(raw)) return "certification.no_creditworthiness";

  return raw
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_.]/g, "");
}

function storePilotNormalizePrivacyLabel(label) {
  return String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/[^a-z0-9_. -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function storePilotIsPermissionJustificationsHeading(label) {
  const normalized = storePilotNormalizePrivacyLabel(label);
  return (
    /permission/.test(normalized) &&
    /justification|justifications|rationale|reason|reasons|begrundung|begrundungen/.test(normalized)
  );
}

function storePilotNormalizePermissionCode(label) {
  const original = String(label || "").trim();
  const raw = original
    .trim()
    .replace(/^`|`$/g, "")
    .replace(/:.*$/g, "")
    .trim();
  const compact = raw.replace(/[^A-Za-z0-9_.-]+/g, "");
  const lower = compact.toLowerCase();
  const known = {
    activetab: "activeTab",
    contextmenus: "contextMenus",
    declarativedynamicrules: "declarativeNetRequest",
    declarativenetrequest: "declarativeNetRequest",
    declarativenetrequestfeedback: "declarativeNetRequestFeedback",
    declarativenetrequestwithhostaccess: "declarativeNetRequestWithHostAccess",
    nativemessaging: "nativeMessaging",
    sidepanel: "sidePanel",
    tabgroups: "tabGroups",
    webnavigation: "webNavigation",
    webrequest: "webRequest"
  };

  if (!compact || /^(permission|permissions|justification|justifications)$/i.test(compact)) {
    return "";
  }

  if (/\s/.test(raw) && !known[lower]) {
    return "";
  }

  if (compact.length > 60) {
    return "";
  }

  return known[lower] || compact;
}

function storePilotPrivacyLabelToKey(label, options = {}) {
  const normalized = storePilotNormalizePrivacyLabel(label);
  const compact = normalized.replace(/[\s-]+/g, "_");

  if (storePilotIsPermissionJustificationsHeading(label)) {
    return "";
  }

  if (storePilotIsPrivacyDocKey(compact)) {
    return storePilotNormalizePrivacyKey(compact);
  }

  if (/^personally identifiable information$/.test(normalized)) return "data_usage.personally_identifiable_information";
  if (/^health information$/.test(normalized)) return "data_usage.health_information";
  if (/^financial and payment information$/.test(normalized)) return "data_usage.financial_payment_information";
  if (/^authentication information$/.test(normalized)) return "data_usage.authentication_information";
  if (/^personal communications$/.test(normalized)) return "data_usage.personal_communications";
  if (/^location$/.test(normalized)) return "data_usage.location";
  if (/^web history$/.test(normalized)) return "data_usage.web_history";
  if (/^user activity$/.test(normalized)) return "data_usage.user_activity";
  if (/^website content$/.test(normalized)) return "data_usage.website_content";
  if (/do not sell or transfer user data/.test(normalized)) return "certification.no_sell_or_transfer";
  if (/unrelated to my item.?s single purpose/.test(normalized)) return "certification.no_unrelated_use";
  if (/determine creditworthiness|lending purposes/.test(normalized)) return "certification.no_creditworthiness";

  if (/\bprivacy\b/.test(normalized) && /\bpolicy\b/.test(normalized) && /\burl\b/.test(normalized)) {
    return "privacy_policy_url";
  }
  if (/datenschutzerklarung|datenschutzrichtlinie/.test(normalized) && (/\burl\b|link/.test(normalized) || normalized.length < 40)) {
    return "privacy_policy_url";
  }

  if (/remote\s*code|remotecode/.test(normalized) && /justification|reason|rationale|explanation|begrundung|erklarung/.test(normalized)) {
    return "remote_code_justification";
  }

  if (/\bhost\b/.test(normalized) && /permission|berechtigung/.test(normalized)) {
    return "host_permission";
  }
  if (/hostberechtigung/.test(normalized)) {
    return "host_permission";
  }

  if (/remote\s*code|remotecode/.test(normalized)) {
    return "remote_code";
  }

  if (/single purpose|sole purpose|single use/.test(normalized)) {
    return "single_purpose";
  }
  if (/alleinigen zweck|alleiniger zweck|alleinige zweck|einzigen zweck/.test(normalized)) {
    return "single_purpose";
  }

  if (options.permissionSection) {
    const permissionCode = storePilotNormalizePermissionCode(label);
    if (permissionCode && /^[A-Za-z][A-Za-z0-9_.-]*$/.test(permissionCode)) {
      return `permission.${permissionCode}`;
    }
  }

  const permissionMatch = normalized.match(/\bpermission[ ._-]+([a-z][a-z0-9_.-]*)\b/);
  if (permissionMatch) {
    const permissionCode = storePilotNormalizePermissionCode(permissionMatch[1]);
    return permissionCode ? `permission.${permissionCode}` : "";
  }

  return "";
}

function storePilotIsPrivacyDocKey(key) {
  return (
    key === "single_purpose" ||
    key === "host_permission" ||
    key === "remote_code" ||
    key === "remote_code_justification" ||
    key === "privacy_policy_url" ||
    STOREPILOT_PRIVACY_DATA_USAGE_KEYS.includes(key) ||
    STOREPILOT_PRIVACY_CERTIFICATION_KEYS.includes(key) ||
    /^permission\.[A-Za-z0-9_.-]+$/.test(key)
  );
}

function storePilotIsPrivacyDocBoundaryKey(label) {
  const raw = String(label || "").trim();
  const normalized = storePilotNormalizePrivacyKey(raw);

  return storePilotIsPrivacyDocKey(normalized) ||
    normalized === "data_usage" ||
    normalized === "certification" ||
    /^data_usage[._][a-z0-9_.-]+$/.test(normalized) ||
    /^certification[._][a-z0-9_.-]+$/.test(normalized) ||
    /^certification_\d+$/.test(normalized);
}
