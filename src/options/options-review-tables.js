function getDataUsageKeys() {
  return typeof STOREPILOT_PRIVACY_DATA_USAGE_KEYS !== "undefined"
    ? STOREPILOT_PRIVACY_DATA_USAGE_KEYS
    : [
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
}

function getCertificationKeys() {
  return typeof STOREPILOT_PRIVACY_CERTIFICATION_KEYS !== "undefined"
    ? STOREPILOT_PRIVACY_CERTIFICATION_KEYS
    : [
      "certification.no_sell_or_transfer",
      "certification.no_unrelated_use",
      "certification.no_creditworthiness"
    ];
}

function getDataUsageFieldKeys(fields) {
  const expected = new Set([...getDataUsageKeys(), ...getCertificationKeys()]);
  return Object.keys(fields || {}).filter(key => expected.has(key));
}

function isDataUsageFieldKey(key) {
  return getDataUsageKeys().includes(key) || getCertificationKeys().includes(key);
}

function getPrivacyDocumentFieldKeys(fields) {
  const remoteCodeDecision = getRemoteCodeDisplayValue(fields && fields.remote_code);
  const includeRemoteCodeJustification = remoteCodeDecision === "yes";
  const keys = Object.keys(fields || {}).filter(key => (
    !isDataUsageFieldKey(key) &&
    key !== "remote_code" &&
    key !== "remote_code_justification"
  ));
  const permissionKeys = keys.filter(key => key.startsWith("permission.")).sort((a, b) => a.localeCompare(b));
  const preferredOrder = [
    "single_purpose",
    "host_permission"
  ];

  const remoteCodeOrder = [];
  if (Object.prototype.hasOwnProperty.call(fields || {}, "remote_code")) {
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

function getRemoteCodeDisplayValue(value) {
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

function formatPrivacyDocumentFieldValue(key, value) {
  if (key === "remote_code") return getRemoteCodeDisplayValue(value);
  return value;
}

function formatPrivacyDocumentFieldState(key, value) {
  if (key === "remote_code_justification" && !String(value || "").trim()) {
    return t("remoteCodeJustificationRequired", "Required when remote_code is yes");
  }

  return "";
}

function formatDataUsageKey(key) {
  const labels = {
    "data_usage.personally_identifiable_information": t("dataUsagePersonallyIdentifiableInformation", "Personally identifiable information"),
    "data_usage.health_information": t("dataUsageHealthInformation", "Health information"),
    "data_usage.financial_payment_information": t("dataUsageFinancialPaymentInformation", "Financial and payment information"),
    "data_usage.authentication_information": t("dataUsageAuthenticationInformation", "Authentication information"),
    "data_usage.personal_communications": t("dataUsagePersonalCommunications", "Personal communications"),
    "data_usage.location": t("dataUsageLocation", "Location"),
    "data_usage.web_history": t("dataUsageWebHistory", "Web history"),
    "data_usage.user_activity": t("dataUsageUserActivity", "User activity"),
    "data_usage.website_content": t("dataUsageWebsiteContent", "Website content"),
    "certification.no_sell_or_transfer": t("certificationNoSellOrTransfer", "Certification: no sale or transfer"),
    "certification.no_unrelated_use": t("certificationNoUnrelatedUse", "Certification: no unrelated use"),
    "certification.no_creditworthiness": t("certificationNoCreditworthiness", "Certification: no creditworthiness use")
  };

  return labels[key] || key;
}

function getBooleanDisplayValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["yes", "true", "on", "1", "y"].includes(normalized)) {
    return { kind: "yes", label: t("yes", "yes").replace(/^./, char => char.toUpperCase()) };
  }
  if (["no", "false", "off", "0", "n", "none"].includes(normalized)) {
    return { kind: "no", label: t("no", "no").replace(/^./, char => char.toUpperCase()) };
  }
  if (!normalized) {
    return { kind: "empty", label: t("notProvided", "Not provided") };
  }
  return null;
}

function createPrivacyRow(typeLabel, value, stateLabel = "") {
  const row = document.createElement("div");
  const type = document.createElement("div");
  const preview = document.createElement("div");
  const count = document.createElement("div");
  const booleanValue = getBooleanDisplayValue(value);

  row.className = "privacy-row";
  type.className = "privacy-type";
  preview.className = "preview";
  count.className = "count";

  type.textContent = typeLabel;
  if (booleanValue && !stateLabel) {
    const chip = document.createElement("span");
    chip.className = `value-chip value-chip-${booleanValue.kind}`;
    chip.textContent = booleanValue.label;
    preview.replaceChildren(chip);
    count.textContent = "";
  } else {
    preview.textContent = value || stateLabel || t("missing", "Missing");
    count.textContent = value ? t("charCount", "$1 chars", [String(value.length)]) : "";
  }

  row.append(type, preview, count);
  return row;
}

function createAdditionalFieldsRow(typeLabel, value, stateLabel = "", countText = "", renderBoolean = false) {
  const row = document.createElement("div");
  const type = document.createElement("div");
  const preview = document.createElement("div");
  const count = document.createElement("div");
  const booleanValue = renderBoolean ? getBooleanDisplayValue(value) : null;

  row.className = "additional-fields-row";
  type.className = "privacy-type";
  preview.className = "preview";
  count.className = "count";

  type.textContent = typeLabel;
  if (booleanValue && !countText) {
    const chip = document.createElement("span");
    chip.className = `value-chip value-chip-${booleanValue.kind}`;
    chip.textContent = booleanValue.label;
    preview.replaceChildren(chip);
    count.textContent = "";
  } else {
    preview.textContent = value || stateLabel || t("missing", "Missing");
    count.textContent = countText || (value ? t("charCount", "$1 chars", [String(value.length)]) : "");
  }

  row.append(type, preview, count);
  return row;
}

function createCategoryRow(typeLabel, value, stateLabel = "", countText = "") {
  const row = document.createElement("div");
  const type = document.createElement("div");
  const preview = document.createElement("div");
  const count = document.createElement("div");

  row.className = "category-row";
  type.className = "privacy-type";
  preview.className = "preview";
  count.className = "count";

  type.textContent = typeLabel;
  preview.textContent = value || stateLabel || t("missing", "Missing");
  count.textContent = countText || (value ? t("charCount", "$1 chars", [String(value.length)]) : "");

  row.append(type, preview, count);
  return row;
}

function createLanguageDiagnosticRow(typeLabel, value, stateLabel = "", countText = "") {
  const row = document.createElement("div");
  const type = document.createElement("div");
  const preview = document.createElement("div");
  const count = document.createElement("div");

  row.className = "language-diagnostics-row";
  type.className = "privacy-type";
  preview.className = "preview";
  count.className = "count";

  type.textContent = typeLabel;
  preview.textContent = value || stateLabel || t("missing", "Missing");
  count.textContent = countText;

  row.append(type, preview, count);
  return row;
}

function formatPrivacyDocSummary(projectOrResult) {
  const privacyDoc = projectOrResult && projectOrResult.privacyDoc
    ? projectOrResult.privacyDoc
    : projectOrResult;

  if (!privacyDoc || !privacyDoc.file || !privacyDoc.file.fields) {
    return typeof storePilotFormatPrivacyDocSummary === "function"
      ? storePilotFormatPrivacyDocSummary(privacyDoc)
      : "";
  }

  return t("privacyDocSummary", "$1 field(s) in $2", [
    String(getPrivacyDocumentFieldKeys(privacyDoc.file.fields).length),
    privacyDoc.file.path
  ]);
}

function hasPrivacyDocFile(projectOrResult) {
  return Boolean(projectOrResult && projectOrResult.privacyDoc && projectOrResult.privacyDoc.file);
}

function formatAdditionalFieldsDocSummary(projectOrResult) {
  return typeof storePilotFormatAdditionalFieldsDocSummary === "function"
    ? storePilotFormatAdditionalFieldsDocSummary(projectOrResult && projectOrResult.additionalFieldsDoc)
    : "";
}

function hasAdditionalFieldsDocFile(projectOrResult) {
  return Boolean(projectOrResult && projectOrResult.additionalFieldsDoc && projectOrResult.additionalFieldsDoc.file);
}

function formatCategoryDocSummary(projectOrResult) {
  return typeof storePilotFormatCategoryDocSummary === "function"
    ? storePilotFormatCategoryDocSummary(projectOrResult && projectOrResult.categoryDoc)
    : "";
}

function hasCategoryDocFile(projectOrResult) {
  return Boolean(projectOrResult && projectOrResult.categoryDoc && projectOrResult.categoryDoc.file);
}

function formatAdditionalFieldKey(key) {
  if (key === "official_url") return t("officialUrl", "Official URL");
  if (key === "homepage_url") return t("homepageUrl", "Homepage URL");
  if (key === "support_url") return t("supportUrl", "Support URL");
  if (key === "mature_content") return t("matureContent", "Mature content");
  return key;
}

function renderAdditionalFieldsDoc(project) {
  const additionalFieldsDoc = project && project.additionalFieldsDoc;

  if (!project) {
    elements.additionalFieldsSummary.textContent = t("noActiveProject", "No active project");
    elements.additionalFieldsTable.innerHTML = "";
    return;
  }

  if (!additionalFieldsDoc) {
    elements.additionalFieldsSummary.textContent = t("additionalFieldsDocNotScanned", "Not scanned");
    elements.additionalFieldsTable.replaceChildren(createAdditionalFieldsRow(
      t("additionalFields", "Additional Fields"),
      "",
      t("reimportFolderToScanAdditionalFieldsDoc", "Re-import the project folder to scan additional fields.")
    ));
    return;
  }

  elements.additionalFieldsSummary.textContent = formatAdditionalFieldsDocSummary(project);

  if (!additionalFieldsDoc.file) {
    elements.additionalFieldsTable.replaceChildren(
      createAdditionalFieldsRow(t("status", "Status"), "", t("additionalFieldsDocNoUsableFileShort", "No usable additional fields document found.")),
      createAdditionalFieldsRow(
        t("additionalFieldsDocCandidateCounts", "Candidates"),
        t("additionalFieldsDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
          String(additionalFieldsDoc.candidateCounts && additionalFieldsDoc.candidateCounts.scanned || 0),
          String(additionalFieldsDoc.candidateCounts && additionalFieldsDoc.candidateCounts.matched || 0)
        ])
      )
    );
    return;
  }

  const fields = additionalFieldsDoc.file.fields || {};
  const preferredOrder = ["official_url", "homepage_url", "support_url", "mature_content"];
  const fieldKeys = preferredOrder.filter(key => Object.prototype.hasOwnProperty.call(fields, key))
    .concat(Object.keys(fields).filter(key => !preferredOrder.includes(key)));
  const rows = [
    createAdditionalFieldsRow(t("privacyDocFile", "File"), additionalFieldsDoc.file.path),
    ...fieldKeys.map(key => createAdditionalFieldsRow(
      formatAdditionalFieldKey(key),
      fields[key],
      t("emptyValue", "(empty)"),
      "",
      key === "mature_content"
    )),
    createAdditionalFieldsRow(
      t("additionalFieldsDocCandidateCounts", "Candidates"),
      t("additionalFieldsDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
        String(additionalFieldsDoc.candidateCounts && additionalFieldsDoc.candidateCounts.scanned || 0),
        String(additionalFieldsDoc.candidateCounts && additionalFieldsDoc.candidateCounts.matched || 0)
      ])
    )
  ];

  elements.additionalFieldsTable.replaceChildren(...rows);
}

function renderProductDetailsCategory(project) {
  const categoryDoc = project && project.categoryDoc;

  if (!project) {
    elements.productDetailsCategoryTable.innerHTML = "";
    return;
  }

  if (!categoryDoc) {
    elements.productDetailsCategoryTable.replaceChildren(createCategoryRow(
      t("storeCategory", "Store Category"),
      "",
      t("reimportFolderToScanCategoryDoc", "Re-import the project folder to scan the category document.")
    ));
    return;
  }

  if (!categoryDoc.file) {
    elements.productDetailsCategoryTable.replaceChildren(
      createCategoryRow(t("status", "Status"), "", t("categoryDocNoUsableFileShort", "No usable category document found.")),
      createCategoryRow(
        t("categoryDocCandidateCounts", "Candidates"),
        t("categoryDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
          String(categoryDoc.candidateCounts && categoryDoc.candidateCounts.scanned || 0),
          String(categoryDoc.candidateCounts && categoryDoc.candidateCounts.matched || 0)
        ])
      )
    );
    return;
  }

  const file = categoryDoc.file;
  const rows = [
    createCategoryRow(t("selectedCategory", "Selected category"), file.categoryLabel),
    createCategoryRow(t("categoryValue", "CWS data value"), file.categoryValue),
    createCategoryRow(t("categoryGroup", "Category group"), file.categoryGroup),
    createCategoryRow(t("privacyDocFile", "File"), file.path, "", formatBytes(file.size)),
    file.reason ? createCategoryRow(t("categoryReason", "Reason"), file.reason) : null,
    createCategoryRow(
      t("categoryDocCandidateCounts", "Candidates"),
      t("categoryDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
        String(categoryDoc.candidateCounts && categoryDoc.candidateCounts.scanned || 0),
        String(categoryDoc.candidateCounts && categoryDoc.candidateCounts.matched || 0)
      ])
    )
  ].filter(Boolean);

  elements.productDetailsCategoryTable.replaceChildren(...rows);
}

function renderPrivacyDoc(project) {
  const privacyDoc = project && project.privacyDoc;

  if (!project) {
    elements.privacySummary.textContent = t("noActiveProject", "No active project");
    elements.privacyTable.innerHTML = "";
    return;
  }

  if (!privacyDoc) {
    elements.privacySummary.textContent = t("privacyDocNotScanned", "Not scanned");
    elements.privacyTable.replaceChildren(createPrivacyRow(
      t("privacyDocument", "Privacy Document"),
      "",
      project.hasFolderHandle
        ? t("reimportFolderToScanPrivacyDoc", "Re-import the project folder to scan the privacy document.")
        : t("reimportFolderToScanPrivacyDoc", "Re-import the project folder to scan the privacy document.")
    ));
    return;
  }

  elements.privacySummary.textContent = formatPrivacyDocSummary(project);

  if (!privacyDoc.file) {
    elements.privacyTable.replaceChildren(
      createPrivacyRow(t("status", "Status"), "", t("privacyDocNoUsableFileShort", "No usable privacy document found.")),
      createPrivacyRow(
        t("privacyDocCandidateCounts", "Candidates"),
        t("privacyDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
          String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0),
          String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.matched || 0)
        ])
      )
    );
    return;
  }

  const fields = privacyDoc.file.fields || {};
  const fieldKeys = getPrivacyDocumentFieldKeys(fields);
  const rows = [
    createPrivacyRow(t("privacyDocFile", "File"), privacyDoc.file.path),
    ...fieldKeys.map(key => createPrivacyRow(
      key,
      formatPrivacyDocumentFieldValue(key, fields[key]),
      formatPrivacyDocumentFieldState(key, fields[key])
    )),
    createPrivacyRow(
      t("privacyDocCandidateCounts", "Candidates"),
      t("privacyDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
        String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0),
        String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.matched || 0)
      ])
    )
  ];

  elements.privacyTable.replaceChildren(...rows);
}

function renderDataUsageDoc(project) {
  const privacyDoc = project && project.privacyDoc;

  if (!project) {
    elements.dataUsageSummary.textContent = t("noActiveProject", "No active project");
    elements.dataUsageTable.innerHTML = "";
    return;
  }

  if (!privacyDoc) {
    elements.dataUsageSummary.textContent = t("privacyDocNotScanned", "Not scanned");
    elements.dataUsageTable.replaceChildren(createPrivacyRow(
      t("dataUsage", "Data Usage"),
      "",
      t("reimportFolderToScanDataUsage", "Re-import the project folder to scan data usage disclosures.")
    ));
    return;
  }

  if (!privacyDoc.file) {
    elements.dataUsageSummary.textContent = t("privacyDocNoUsableFileShort", "No usable privacy document found.");
    elements.dataUsageTable.replaceChildren(
      createPrivacyRow(t("status", "Status"), "", t("privacyDocNoUsableFileShort", "No usable privacy document found.")),
      createPrivacyRow(
        t("privacyDocCandidateCounts", "Candidates"),
        t("privacyDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
          String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0),
          String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.matched || 0)
        ])
      )
    );
    return;
  }

  const fields = privacyDoc.file.fields || {};
  const dataKeys = getDataUsageKeys();
  const certificationKeys = getCertificationKeys();
  const foundKeys = getDataUsageFieldKeys(fields);
  elements.dataUsageSummary.textContent = foundKeys.length
    ? t("dataUsageSummary", "$1 value(s) in $2", [String(foundKeys.length), privacyDoc.file.path])
    : t("dataUsageNoValues", "No data usage values found.");

  const rows = [
    createPrivacyRow(t("privacyDocFile", "File"), privacyDoc.file.path),
    ...dataKeys.map(key => createPrivacyRow(formatDataUsageKey(key), fields[key] || "")),
    ...certificationKeys.map(key => createPrivacyRow(formatDataUsageKey(key), fields[key] || "")),
    createPrivacyRow(
      t("privacyDocCandidateCounts", "Candidates"),
      t("privacyDocCandidateCountsValue", "Scanned: $1; matched: $2.", [
        String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.scanned || 0),
        String(privacyDoc.candidateCounts && privacyDoc.candidateCounts.matched || 0)
      ])
    )
  ];

  elements.dataUsageTable.replaceChildren(...rows);
}

function renderLanguageDiagnostics(project) {
  const listings = project && project.listings ? project.listings : {};
  const locales = Object.keys(listings).sort((a, b) => a.localeCompare(b));

  if (!project) {
    elements.languageDiagnosticsTable.innerHTML = "";
    return;
  }

  if (!locales.length) {
    elements.languageDiagnosticsTable.replaceChildren(createLanguageDiagnosticRow(
      t("languageMatching", "Language matching"),
      "",
      t("noListingsImported", "No listings imported")
    ));
    return;
  }

  const pickerMode = locales.length === 1
    ? t("languagePickerOneLanguageMode", "One-language CWS listing")
    : t("languagePickerMultiLocaleMode", "Multi-locale CWS listing");
  const pickerTarget = locales.length === 1
    ? t("languagePickerOneLanguageTarget", "Product details Language picker below Category; select $1 before filling.", [locales[0]])
    : t("languagePickerMultiLocaleTarget", "Current editing language picker at the top; fill each matched CWS locale.");
  elements.languageDiagnosticsTable.replaceChildren(
    createLanguageDiagnosticRow(t("languagePickerMode", "CWS picker mode"), pickerMode),
    createLanguageDiagnosticRow(t("languagePickerTarget", "StorePilot target"), pickerTarget),
    createLanguageDiagnosticRow(
      t("languageMatchingSummary", "Matching summary"),
      t("languageMatchingSummaryValue", "$1 imported locale(s). CWS availability is checked from the dashboard language menu during Fill languages.", [
        String(locales.length)
      ])
    )
  );
}
