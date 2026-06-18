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
