const STOREPILOT_ADDITIONAL_FIELDS_DOC_MAX_BYTES = 1024 * 1024;

const STOREPILOT_ADDITIONAL_FIELD_KEYS = [
  "official_url",
  "homepage_url",
  "support_url",
  "mature_content"
];

function storePilotCreateEmptyAdditionalFieldsDocCandidateCounts() {
  return {
    scanned: 0,
    matched: 0
  };
}

function storePilotNormalizeAdditionalFieldsDocPath(pathParts) {
  return Array.from(pathParts || [])
    .map(part => String(part || "").trim())
    .filter(Boolean)
    .join("/");
}

function storePilotNormalizeAdditionalFieldLabel(label) {
  return String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/[^a-z0-9_. -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function storePilotNormalizeAdditionalFieldKey(key) {
  const normalized = storePilotNormalizeAdditionalFieldLabel(key)
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  if (normalized === "official_url" || normalized === "official_site" || normalized === "official_site_url") {
    return "official_url";
  }
  if (normalized === "homepage_url" || normalized === "home_page_url" || normalized === "home_url") {
    return "homepage_url";
  }
  if (normalized === "support_url" || normalized === "support_page_url" || normalized === "help_url") {
    return "support_url";
  }
  if (normalized === "mature_content" || normalized === "mature" || normalized === "mature_content_toggle") {
    return "mature_content";
  }

  return "";
}

function storePilotCleanAdditionalFieldValue(value) {
  return String(value || "")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^`+|`+$/g, "")
    .replace(/^\*\*|\*\*$/g, "")
    .trim();
}

function storePilotReadAdditionalFieldsDocText(file) {
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

function storePilotIsPotentialAdditionalFieldsDocFile(fileName, size = 0) {
  const extension = typeof storePilotGetFileExtension === "function"
    ? storePilotGetFileExtension(fileName)
    : String(fileName || "").split(".").pop().toLowerCase();
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;

  return (
    [".md", ".markdown", ".txt", ".text"].includes(normalizedExtension) &&
    Number(size || 0) <= STOREPILOT_ADDITIONAL_FIELDS_DOC_MAX_BYTES
  );
}

function storePilotParseAdditionalFieldsDoc(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const blockStart = lines.findIndex(line => /^\s*\[(?:additional[_ -]?fields|product[_ -]?details|chrome[_ -]?web[_ -]?store[_ -]?additional[_ -]?fields)\]\s*$/i.test(line));
  const startIndex = blockStart >= 0 ? blockStart + 1 : 0;
  const fields = {};
  const order = [];
  let currentKey = "";
  let currentLines = [];

  function flushCurrent() {
    if (!currentKey) return;

    const value = storePilotCleanAdditionalFieldValue(currentLines.join("\n"));
    fields[currentKey] = value;
    order.push(currentKey);
    currentKey = "";
    currentLines = [];
  }

  for (let index = startIndex; index < lines.length; index++) {
    const line = lines[index];

    if (blockStart >= 0 && /^\s*\[[^\]]+\]\s*$/.test(line)) {
      flushCurrent();
      break;
    }

    const headingMatch = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (headingMatch) {
      const headingKey = storePilotNormalizeAdditionalFieldKey(headingMatch[2]);
      if (headingKey) {
        flushCurrent();
        currentKey = headingKey;
        currentLines = [];
        continue;
      }

      if (currentKey) {
        flushCurrent();
      }
      if (blockStart < 0 && order.length) {
        break;
      }
      continue;
    }

    const keyMatch = line.match(/^\s*([A-Za-z][A-Za-z0-9_. -]*):\s*(.*)$/);
    if (keyMatch) {
      const key = storePilotNormalizeAdditionalFieldKey(keyMatch[1]);
      if (key) {
        flushCurrent();
        currentKey = key;
        currentLines = keyMatch[2] ? [keyMatch[2]] : [];
        continue;
      }

      if (currentKey && STOREPILOT_ADDITIONAL_FIELD_KEYS.includes(storePilotNormalizeAdditionalFieldKey(keyMatch[1]))) {
        flushCurrent();
        continue;
      }
    }

    if (currentKey) {
      currentLines.push(line);
    }
  }

  flushCurrent();

  return {
    fields,
    keys: order,
    fieldCount: order.length,
    hasAdditionalFieldsBlock: blockStart >= 0
  };
}

function storePilotScoreAdditionalFieldsDoc(pathParts, text = "", parsed = null) {
  const normalizedPath = storePilotNormalizeAdditionalFieldsDocPath(pathParts).toLowerCase();
  const fileName = String(pathParts && pathParts[pathParts.length - 1] || "").toLowerCase();
  const normalizedFileName = fileName.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const normalizedText = storePilotNormalizeAdditionalFieldLabel(text);
  let score = 0;

  if (normalizedFileName === "chrome-web-store-additional-fields-md") score += 150;
  if (normalizedFileName === "chrome-web-store-additional-fields-txt") score += 140;
  if (normalizedFileName.includes("chrome-web-store-additional")) score += 120;
  if (normalizedFileName.includes("web-store-additional")) score += 90;
  if (normalizedFileName.includes("additional-fields")) score += 80;
  if (normalizedFileName.includes("product-details")) score += 60;
  if (normalizedPath.includes("/docs/") || normalizedPath.startsWith("docs/")) score += 20;
  if (normalizedPath.includes("chrome-web-store")) score += 20;
  if (/\[(?:additional[_ -]?fields|product[_ -]?details|chrome[_ -]?web[_ -]?store[_ -]?additional[_ -]?fields)\]/i.test(text)) score += 120;
  if (parsed && parsed.fieldCount) score += parsed.fieldCount * 30;

  [
    "official url",
    "homepage url",
    "support url",
    "mature content",
    "additional fields"
  ].forEach(marker => {
    if (normalizedText.includes(marker)) score += 18;
  });

  return score;
}

function storePilotCreateAdditionalFieldsDocCandidatePreview(candidate) {
  return {
    path: candidate.path,
    name: candidate.name,
    size: candidate.size,
    score: candidate.score,
    fieldCount: candidate.parsed.fieldCount,
    hasAdditionalFieldsBlock: candidate.parsed.hasAdditionalFieldsBlock
  };
}

function storePilotCreateAdditionalFieldsDocSummary(candidates) {
  const sorted = [...candidates].sort((a, b) => (
    b.score - a.score ||
    b.parsed.fieldCount - a.parsed.fieldCount ||
    a.path.localeCompare(b.path)
  ));
  const best = sorted[0] || null;
  const candidateCounts = storePilotCreateEmptyAdditionalFieldsDocCandidateCounts();

  candidateCounts.scanned = candidates.length;
  candidateCounts.matched = candidates.filter(candidate => candidate.score > 0 && candidate.parsed.fieldCount).length;

  if (!best || best.score < 80 || !best.parsed.fieldCount) {
    return {
      file: null,
      candidates: sorted.slice(0, 5).map(storePilotCreateAdditionalFieldsDocCandidatePreview),
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
      keys: best.parsed.keys,
      fieldCount: best.parsed.fieldCount,
      hasAdditionalFieldsBlock: best.parsed.hasAdditionalFieldsBlock
    },
    candidates: sorted.slice(0, 5).map(storePilotCreateAdditionalFieldsDocCandidatePreview),
    candidateCounts,
    discoveredAt: storePilotFormatTimestamp()
  };
}

function storePilotFormatAdditionalFieldsDocSummary(additionalFieldsDoc) {
  if (!additionalFieldsDoc) return storePilotText("additionalFieldsDocNotScanned", "Not scanned");
  if (!additionalFieldsDoc.file) {
    const scanned = additionalFieldsDoc.candidateCounts && additionalFieldsDoc.candidateCounts.scanned || 0;
    return scanned
      ? storePilotText("additionalFieldsDocNoUsableFile", "No usable additional fields document found ($1 candidate(s) scanned).", [String(scanned)])
      : storePilotText("additionalFieldsDocNoUsableFileShort", "No usable additional fields document found.");
  }

  return storePilotText("additionalFieldsDocSummary", "$1 field(s) in $2", [
    String(additionalFieldsDoc.file.fieldCount || 0),
    additionalFieldsDoc.file.path
  ]);
}

async function storePilotDiscoverAdditionalFieldsDocFromFileList(files) {
  const candidates = [];

  for (const file of Array.from(files || [])) {
    const pathParts = typeof storePilotGetRelativePathParts === "function"
      ? storePilotGetRelativePathParts(file)
      : [file.name];

    if (!pathParts.length || (typeof storePilotHasSkippedPathPart === "function" && storePilotHasSkippedPathPart(pathParts.slice(0, -1)))) {
      continue;
    }

    if (!storePilotIsPotentialAdditionalFieldsDocFile(file.name, file.size)) {
      continue;
    }

    const text = await storePilotReadAdditionalFieldsDocText(file);
    const parsed = storePilotParseAdditionalFieldsDoc(text);
    const score = storePilotScoreAdditionalFieldsDoc(pathParts, text, parsed);

    candidates.push({
      path: storePilotNormalizeAdditionalFieldsDocPath(pathParts),
      name: file.name,
      size: file.size || 0,
      score,
      parsed
    });
  }

  return storePilotCreateAdditionalFieldsDocSummary(candidates);
}

async function storePilotDiscoverAdditionalFieldsDocFromDirectory(directoryHandle) {
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
      if (!storePilotIsPotentialAdditionalFieldsDocFile(file.name, file.size)) {
        continue;
      }

      const text = await storePilotReadAdditionalFieldsDocText(file);
      const parsed = storePilotParseAdditionalFieldsDoc(text);
      const score = storePilotScoreAdditionalFieldsDoc(nextPathParts, text, parsed);

      candidates.push({
        path: storePilotNormalizeAdditionalFieldsDocPath(nextPathParts),
        name: file.name,
        size: file.size || 0,
        score,
        parsed
      });
    }
  }

  return storePilotCreateAdditionalFieldsDocSummary(candidates);
}
