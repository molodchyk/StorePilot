const STOREPILOT_CATEGORY_DOC_MAX_BYTES = 1024 * 1024;

const STOREPILOT_CHROME_WEB_STORE_CATEGORIES = [
  { label: "Communication", value: "CATEGORY_COMMUNICATION", group: "Productivity" },
  { label: "Developer Tools", value: "CATEGORY_DEVELOPER_TOOLS", group: "Productivity" },
  { label: "Education", value: "CATEGORY_EDUCATION", group: "Productivity" },
  { label: "Tools", value: "CATEGORY_TOOLS", group: "Productivity" },
  { label: "Workflow and planning", value: "CATEGORY_WORKFLOW_AND_PLANNING", group: "Productivity" },
  { label: "Art & Design", value: "CATEGORY_EXTENSIONS_ART_AND_DESIGN", group: "Lifestyle", aliases: ["Art and Design"] },
  { label: "Entertainment", value: "CATEGORY_EXTENSIONS_ENTERTAINMENT", group: "Lifestyle" },
  { label: "Games", value: "CATEGORY_GAMES", group: "Lifestyle" },
  { label: "Household", value: "CATEGORY_HOUSEHOLD", group: "Lifestyle" },
  { label: "Just for fun", value: "CATEGORY_JUST_FOR_FUN", group: "Lifestyle" },
  { label: "News & Weather", value: "CATEGORY_NEWS_AND_WEATHER", group: "Lifestyle", aliases: ["News and Weather"] },
  { label: "Shopping", value: "CATEGORY_SHOPPING", group: "Lifestyle" },
  { label: "Social Networking", value: "CATEGORY_SOCIAL_NETWORKING", group: "Lifestyle" },
  { label: "Travel", value: "CATEGORY_TRAVEL", group: "Lifestyle" },
  { label: "Wellbeing", value: "CATEGORY_WELL_BEING", group: "Lifestyle", aliases: ["Well-being", "Well being"] },
  { label: "Accessibility", value: "CATEGORY_ACCESSIBILITY", group: "Make Chrome Yours" },
  { label: "Functionality and UI", value: "CATEGORY_FUNCTIONALITY_AND_UI", group: "Make Chrome Yours", aliases: ["Functionality & UI"] },
  { label: "Privacy & Security", value: "CATEGORY_PRIVACY_AND_SECURITY", group: "Make Chrome Yours", aliases: ["Privacy and Security"] }
];

function storePilotCreateEmptyCategoryDocCandidateCounts() {
  return {
    scanned: 0,
    matched: 0
  };
}

function storePilotNormalizeCategoryDocPath(pathParts) {
  return Array.from(pathParts || [])
    .map(part => String(part || "").trim())
    .filter(Boolean)
    .join("/");
}

function storePilotNormalizeCategoryText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function storePilotCleanCategoryDocValue(value) {
  return String(value || "")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^`+|`+$/g, "")
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/\s+#*$/, "")
    .trim();
}

function storePilotFindChromeWebStoreCategory(value) {
  const raw = storePilotCleanCategoryDocValue(value);
  const normalized = storePilotNormalizeCategoryText(raw);
  const upper = raw.toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "");

  return STOREPILOT_CHROME_WEB_STORE_CATEGORIES.find(category => (
    category.value === raw ||
    category.value === upper ||
    storePilotNormalizeCategoryText(category.label) === normalized ||
    (category.aliases || []).some(alias => storePilotNormalizeCategoryText(alias) === normalized)
  )) || null;
}

function storePilotReadCategoryDocText(file) {
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

function storePilotIsPotentialCategoryDocFile(fileName, size = 0) {
  const extension = typeof storePilotGetFileExtension === "function"
    ? storePilotGetFileExtension(fileName)
    : String(fileName || "").split(".").pop().toLowerCase();
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;

  return (
    [".md", ".markdown", ".txt", ".text"].includes(normalizedExtension) &&
    Number(size || 0) <= STOREPILOT_CATEGORY_DOC_MAX_BYTES
  );
}

function storePilotScoreCategoryDoc(pathParts, text = "", parsed = null) {
  const normalizedPath = storePilotNormalizeCategoryDocPath(pathParts).toLowerCase();
  const fileName = String(pathParts && pathParts[pathParts.length - 1] || "").toLowerCase();
  const normalizedFileName = fileName.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const normalizedText = storePilotNormalizeCategoryText(text);
  let score = 0;

  if (normalizedFileName === "chrome-web-store-category-md") score += 150;
  if (normalizedFileName === "chrome-web-store-category-txt") score += 140;
  if (normalizedFileName.includes("chrome-web-store-category")) score += 120;
  if (normalizedFileName.includes("web-store-category")) score += 90;
  if (normalizedFileName.includes("store-category")) score += 70;
  if (normalizedFileName.includes("category")) score += 35;
  if (normalizedPath.includes("/docs/") || normalizedPath.startsWith("docs/")) score += 20;
  if (normalizedPath.includes("chrome-web-store")) score += 20;
  if (/selected\s+category\s*:/i.test(text)) score += 130;
  if (/chrome\s+web\s+store\s+category\s+decision/i.test(text)) score += 70;
  if (/all\s+visible\s+category\s+options/i.test(text)) score += 20;
  if (/make\s+chrome\s+yours/i.test(text)) score += 16;
  if (parsed && parsed.categoryLabel) score += 70;

  STOREPILOT_CHROME_WEB_STORE_CATEGORIES.forEach(category => {
    if (normalizedText.includes(storePilotNormalizeCategoryText(category.label))) score += 4;
  });

  return score;
}

function storePilotParseCategoryDocReason(lines, reasonIndex) {
  if (reasonIndex < 0) return "";

  const firstLine = lines[reasonIndex].replace(/^\s*(?:[-*]\s*)?(?:\*\*)?\s*reason\s*(?:\*\*)?\s*:\s*/i, "").trim();
  const reasonLines = firstLine ? [firstLine] : [];

  for (let index = reasonIndex + 1; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) break;
    if (/^\s*#{1,6}\s+/.test(line)) break;
    if (/^\s*(?:selected\s+category|category|notes?|all\s+visible\s+category\s+options)\s*:/i.test(line)) break;
    reasonLines.push(line.trim());
  }

  return reasonLines.join(" ").trim();
}

function storePilotParseCategoryDoc(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const categoryLineIndex = lines.findIndex(line => (
    /^\s*(?:[-*]\s*)?(?:\*\*)?\s*(?:selected\s+category|category)\s*(?:\*\*)?\s*:/i.test(line)
  ));
  const reasonIndex = lines.findIndex(line => /^\s*(?:[-*]\s*)?(?:\*\*)?\s*reason\s*(?:\*\*)?\s*:/i.test(line));
  const rawCategory = categoryLineIndex >= 0
    ? storePilotCleanCategoryDocValue(lines[categoryLineIndex].replace(/^\s*(?:[-*]\s*)?(?:\*\*)?\s*(?:selected\s+category|category)\s*(?:\*\*)?\s*:\s*/i, ""))
    : "";
  const category = storePilotFindChromeWebStoreCategory(rawCategory);

  return {
    rawCategory,
    categoryLabel: category ? category.label : "",
    categoryValue: category ? category.value : "",
    categoryGroup: category ? category.group : "",
    reason: storePilotParseCategoryDocReason(lines, reasonIndex),
    hasSelectedCategory: categoryLineIndex >= 0
  };
}

function storePilotCreateCategoryDocCandidatePreview(candidate) {
  return {
    path: candidate.path,
    name: candidate.name,
    size: candidate.size,
    score: candidate.score,
    categoryLabel: candidate.parsed.categoryLabel,
    categoryValue: candidate.parsed.categoryValue,
    hasSelectedCategory: candidate.parsed.hasSelectedCategory
  };
}

function storePilotCreateCategoryDocSummary(candidates) {
  const sorted = [...candidates].sort((a, b) => (
    b.score - a.score ||
    Number(Boolean(b.parsed.categoryLabel)) - Number(Boolean(a.parsed.categoryLabel)) ||
    a.path.localeCompare(b.path)
  ));
  const best = sorted[0] || null;
  const candidateCounts = storePilotCreateEmptyCategoryDocCandidateCounts();

  candidateCounts.scanned = candidates.length;
  candidateCounts.matched = candidates.filter(candidate => candidate.score > 0 && candidate.parsed.categoryLabel).length;

  if (!best || best.score < 80 || !best.parsed.categoryLabel) {
    return {
      file: null,
      candidates: sorted.slice(0, 5).map(storePilotCreateCategoryDocCandidatePreview),
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
      categoryLabel: best.parsed.categoryLabel,
      categoryValue: best.parsed.categoryValue,
      categoryGroup: best.parsed.categoryGroup,
      rawCategory: best.parsed.rawCategory,
      reason: best.parsed.reason,
      hasSelectedCategory: best.parsed.hasSelectedCategory
    },
    candidates: sorted.slice(0, 5).map(storePilotCreateCategoryDocCandidatePreview),
    candidateCounts,
    discoveredAt: storePilotFormatTimestamp()
  };
}

function storePilotFormatCategoryDocSummary(categoryDoc) {
  if (!categoryDoc) return storePilotText("categoryDocNotScanned", "Not scanned");
  if (!categoryDoc.file) {
    const scanned = categoryDoc.candidateCounts && categoryDoc.candidateCounts.scanned || 0;
    return scanned
      ? storePilotText("categoryDocNoUsableFile", "No usable category document found ($1 candidate(s) scanned).", [String(scanned)])
      : storePilotText("categoryDocNoUsableFileShort", "No usable category document found.");
  }

  return storePilotText("categoryDocSummary", "Category: $1 in $2", [
    categoryDoc.file.categoryLabel || storePilotText("unknown", "Unknown"),
    categoryDoc.file.path
  ]);
}

async function storePilotDiscoverCategoryDocFromFileList(files) {
  const candidates = [];

  for (const file of Array.from(files || [])) {
    const pathParts = typeof storePilotGetRelativePathParts === "function"
      ? storePilotGetRelativePathParts(file)
      : [file.name];

    if (!pathParts.length || (typeof storePilotHasSkippedPathPart === "function" && storePilotHasSkippedPathPart(pathParts.slice(0, -1)))) {
      continue;
    }

    if (!storePilotIsPotentialCategoryDocFile(file.name, file.size)) {
      continue;
    }

    const text = await storePilotReadCategoryDocText(file);
    const parsed = storePilotParseCategoryDoc(text);
    const score = storePilotScoreCategoryDoc(pathParts, text, parsed);

    candidates.push({
      path: storePilotNormalizeCategoryDocPath(pathParts),
      name: file.name,
      size: file.size || 0,
      score,
      parsed
    });
  }

  return storePilotCreateCategoryDocSummary(candidates);
}

async function storePilotDiscoverCategoryDocFromDirectory(directoryHandle) {
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
      if (!storePilotIsPotentialCategoryDocFile(file.name, file.size)) {
        continue;
      }

      const text = await storePilotReadCategoryDocText(file);
      const parsed = storePilotParseCategoryDoc(text);
      const score = storePilotScoreCategoryDoc(nextPathParts, text, parsed);

      candidates.push({
        path: storePilotNormalizeCategoryDocPath(nextPathParts),
        name: file.name,
        size: file.size || 0,
        score,
        parsed
      });
    }
  }

  return storePilotCreateCategoryDocSummary(candidates);
}
