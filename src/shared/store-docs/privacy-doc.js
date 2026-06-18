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
