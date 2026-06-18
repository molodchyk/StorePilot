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

function getPrivacyDocumentFieldKeys(fields) {
  return storePilotGetPrivacyDocFieldKeys(fields);
}

function getRemoteCodeDisplayValue(value) {
  return storePilotGetRemoteCodeDisplayDecision(value);
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
      t("reimportFolderToScanPrivacyDoc", "Re-import the project folder to scan the privacy document.")
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
