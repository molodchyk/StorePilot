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
    "single_purpose",
    "host_permission"
  ];

  const remoteCodeOrder = [];
  if (Object.prototype.hasOwnProperty.call(privacyFields, "remote_code")) {
    remoteCodeOrder.push("remote_code");
  }
  if (includeRemoteCodeJustification) {
    remoteCodeOrder.push("remote_code_justification");
  }

  const ordered = preferredOrder.filter(key => keys.includes(key))
    .concat(permissionKeys)
    .concat(keys.filter(key => (
      !preferredOrder.includes(key) &&
      !permissionKeys.includes(key) &&
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

function storePilotReadPrivacyDocText(file) {
  if (file && typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

function storePilotIsPotentialPrivacyDocFile(fileName, size = 0) {
  const extension = typeof storePilotGetFileExtension === "function"
    ? storePilotGetFileExtension(fileName)
    : String(fileName || "").split(".").pop().toLowerCase();
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;

  return (
    [".md", ".markdown", ".txt", ".text"].includes(normalizedExtension) &&
    Number(size || 0) <= STOREPILOT_PRIVACY_DOC_MAX_BYTES
  );
}

function storePilotScorePrivacyDoc(pathParts, text = "") {
  const normalizedPath = storePilotNormalizePrivacyDocPath(pathParts).toLowerCase();
  const fileName = String(pathParts && pathParts[pathParts.length - 1] || "").toLowerCase();
  const normalizedFileName = fileName.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const lowerText = String(text || "").toLowerCase();
  let score = 0;

  if (normalizedFileName === "chrome-web-store-privacy-form-md") score += 140;
  if (normalizedFileName === "store-justifications-md") score += 125;
  if (normalizedFileName.includes("store-justification")) score += 95;
  if (normalizedFileName.includes("web-store-justification")) score += 95;
  if (normalizedFileName.includes("justification")) score += 55;
  if (normalizedFileName.includes("chrome-web-store-privacy")) score += 90;
  if (normalizedFileName.includes("web-store-privacy")) score += 70;
  if (normalizedFileName.includes("privacy-form")) score += 55;
  if (normalizedFileName.includes("privacy")) score += 30;
  if (normalizedPath.includes("/docs/") || normalizedPath.startsWith("docs/")) score += 20;
  if (normalizedPath.includes("chrome-web-store")) score += 20;
  if (/\[privacy\]/i.test(text)) score += 120;

  [
    "single_purpose:",
    "permission.storage:",
    "host_permission:",
    "remote_code:",
    "remote_code_justification:",
    "privacy_policy_url:",
    "data_usage.web_history:",
    "data_usage.website_content:",
    "certification.no_sell_or_transfer:"
  ].forEach(marker => {
    if (lowerText.includes(marker)) score += 22;
  });

  [
    "beschreibung des alleinigen zwecks",
    "begrundung fur hostberechtigung",
    "url der datenschutzerklarung",
    "host permission",
    "privacy policy"
  ].forEach(marker => {
    if (storePilotNormalizePrivacyLabel(text).includes(marker)) score += 24;
  });

  return score;
}

function storePilotParsePrivacyDoc(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const privacyStart = lines.findIndex(line => /^\s*\[privacy\]\s*$/i.test(line));
  const startIndex = privacyStart >= 0 ? privacyStart + 1 : 0;
  const fields = {};
  const order = [];
  let currentKey = "";
  let currentLines = [];
  let sectionContext = "";
  let sectionHeadingLevel = 0;

  function flushCurrent() {
    if (!currentKey) return;

    const value = currentLines.join("\n").trim();
    fields[currentKey] = value;
    order.push(currentKey);
    currentKey = "";
    currentLines = [];
  }

  for (let index = startIndex; index < lines.length; index++) {
    const line = lines[index];
    const headingMatch = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (headingMatch) {
      const headingLevel = headingMatch[1].length;
      const headingText = headingMatch[2];

      if (sectionContext && headingLevel <= sectionHeadingLevel) {
        sectionContext = "";
        sectionHeadingLevel = 0;
      }

      if (storePilotIsPermissionJustificationsHeading(headingText)) {
        flushCurrent();
        sectionContext = "permissions";
        sectionHeadingLevel = headingLevel;
        continue;
      }

      const headingKey = storePilotPrivacyLabelToKey(headingText, {
        permissionSection: sectionContext === "permissions" && headingLevel > sectionHeadingLevel
      });
      if (headingKey) {
        flushCurrent();
        currentKey = headingKey;
        currentLines = [];
        continue;
      }

      if (currentKey) {
        flushCurrent();
      }
      if (order.length) {
        break;
      }
      continue;
    }

    const keyMatch = line.match(/^\s*([A-Za-z][A-Za-z0-9_. -]*):\s*(.*)$/);

    if (keyMatch) {
      const key = storePilotPrivacyLabelToKey(keyMatch[1], {
        permissionSection: sectionContext === "permissions"
      }) || storePilotNormalizePrivacyKey(keyMatch[1]);
      if (storePilotIsPrivacyDocKey(key)) {
        flushCurrent();
        currentKey = key;
        currentLines = keyMatch[2] ? [keyMatch[2]] : [];
        continue;
      }
      if (currentKey && storePilotIsPrivacyDocBoundaryKey(keyMatch[1])) {
        flushCurrent();
        continue;
      }
    }

    if (/^#{1,6}\s+\S/.test(line) && currentKey && order.length) {
      flushCurrent();
      break;
    }

    if (currentKey) {
      currentLines.push(line);
    }
  }

  flushCurrent();

  const permissions = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (key.startsWith("permission.")) {
      permissions[key.slice("permission.".length)] = value;
    }
  });

  return {
    fields,
    permissions,
    keys: order,
    fieldCount: order.length,
    hasPrivacyBlock: privacyStart >= 0
  };
}

function storePilotCreatePrivacyDocSummary(candidates) {
  const sorted = [...candidates].sort((a, b) => (
    b.score - a.score ||
    b.parsed.fieldCount - a.parsed.fieldCount ||
    a.path.localeCompare(b.path)
  ));
  const best = sorted[0] || null;
  const candidateCounts = storePilotCreateEmptyPrivacyDocCandidateCounts();

  candidateCounts.scanned = candidates.length;
  candidateCounts.matched = candidates.filter(candidate => candidate.score > 0).length;

  if (!best || best.score < 80 || !best.parsed.fieldCount) {
    return {
      file: null,
      candidates: sorted.slice(0, 5).map(storePilotCreatePrivacyDocCandidatePreview),
      candidateCounts,
      discoveredAt: storePilotFormatTimestamp()
    };
  }

  return {
    file: {
      path: best.path,
      name: best.name,
      size: best.size,
      score: best.score,
      fields: best.parsed.fields,
      permissions: best.parsed.permissions,
      keys: best.parsed.keys,
      fieldCount: best.parsed.fieldCount,
      hasPrivacyBlock: best.parsed.hasPrivacyBlock
    },
    candidates: sorted.slice(0, 5).map(storePilotCreatePrivacyDocCandidatePreview),
    candidateCounts,
    discoveredAt: storePilotFormatTimestamp()
  };
}

function storePilotCreatePrivacyDocCandidatePreview(candidate) {
  return {
    path: candidate.path,
    name: candidate.name,
    size: candidate.size,
    score: candidate.score,
    fieldCount: candidate.parsed.fieldCount,
    hasPrivacyBlock: candidate.parsed.hasPrivacyBlock
  };
}

function storePilotFormatPrivacyDocSummary(privacyDoc) {
  if (!privacyDoc) return storePilotText("privacyDocNotScanned", "Not scanned");
  if (!privacyDoc.file) {
    const scanned = privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0;
    return scanned
      ? storePilotText("privacyDocNoUsableFile", "No usable privacy document found ($1 candidate(s) scanned).", [String(scanned)])
      : storePilotText("privacyDocNoUsableFileShort", "No usable privacy document found.");
  }

  const visibleFieldCount = privacyDoc.file.fields
    ? storePilotGetPrivacyDocFieldKeys(privacyDoc.file.fields).length
    : privacyDoc.file.fieldCount || 0;

  return storePilotText("privacyDocSummary", "$1 field(s) in $2", [
    String(visibleFieldCount),
    privacyDoc.file.path
  ]);
}

async function storePilotDiscoverPrivacyDocFromFileList(files) {
  const candidates = [];

  for (const file of Array.from(files || [])) {
    const pathParts = typeof storePilotGetRelativePathParts === "function"
      ? storePilotGetRelativePathParts(file)
      : [file.name];

    if (!pathParts.length || (typeof storePilotHasSkippedPathPart === "function" && storePilotHasSkippedPathPart(pathParts.slice(0, -1)))) {
      continue;
    }

    if (!storePilotIsPotentialPrivacyDocFile(file.name, file.size)) {
      continue;
    }

    const text = await storePilotReadPrivacyDocText(file);
    const parsed = storePilotParsePrivacyDoc(text);
    const score = storePilotScorePrivacyDoc(pathParts, text);

    candidates.push({
      path: storePilotNormalizePrivacyDocPath(pathParts),
      name: file.name,
      size: file.size || 0,
      score,
      parsed
    });
  }

  return storePilotCreatePrivacyDocSummary(candidates);
}

async function storePilotDiscoverPrivacyDocFromDirectory(directoryHandle) {
  const candidates = [];
  const queue = [{ handle: directoryHandle, pathParts: [] }];

  while (queue.length) {
    const current = queue.shift();

    for await (const entry of current.handle.values()) {
      const nextPathParts = [...current.pathParts, entry.name];

      if (entry.kind === "directory") {
        if (typeof storePilotShouldSkipDirectory !== "function" || !storePilotShouldSkipDirectory(entry.name)) {
          queue.push({ handle: entry, pathParts: nextPathParts });
        }
        continue;
      }

      const file = await entry.getFile();
      if (!storePilotIsPotentialPrivacyDocFile(file.name, file.size)) {
        continue;
      }

      const text = await storePilotReadPrivacyDocText(file);
      const parsed = storePilotParsePrivacyDoc(text);
      const score = storePilotScorePrivacyDoc(nextPathParts, text);

      candidates.push({
        path: storePilotNormalizePrivacyDocPath(nextPathParts),
        name: file.name,
        size: file.size || 0,
        score,
        parsed
      });
    }
  }

  return storePilotCreatePrivacyDocSummary(candidates);
}
