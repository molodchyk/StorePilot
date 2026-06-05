const STOREPILOT_PRIVACY_DOC_MAX_BYTES = 1024 * 1024;

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

  if (/\bprivacy\b/.test(normalized) && /\bpolicy\b/.test(normalized) && /\burl\b/.test(normalized)) {
    return "privacy_policy_url";
  }
  if (/datenschutzerklarung|datenschutzrichtlinie/.test(normalized) && (/\burl\b|link/.test(normalized) || normalized.length < 40)) {
    return "privacy_policy_url";
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
    key === "privacy_policy_url" ||
    /^permission\.[A-Za-z0-9_.-]+$/.test(key)
  );
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
    "privacy_policy_url:"
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

  return storePilotText("privacyDocSummary", "$1 field(s) in $2", [
    String(privacyDoc.file.fieldCount || 0),
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
