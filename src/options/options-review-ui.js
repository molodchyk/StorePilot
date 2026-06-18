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

function createReviewRow(rowClassName, typeClassName, typeLabel, value, stateLabel = "", countText = "", options = {}) {
  const row = document.createElement("div");
  const type = document.createElement("div");
  const preview = document.createElement("div");
  const count = document.createElement("div");
  const booleanValue = options.renderBoolean ? getBooleanDisplayValue(value) : null;

  row.className = rowClassName;
  type.className = typeClassName;
  preview.className = "preview";
  count.className = "count";

  type.textContent = typeLabel;
  if (booleanValue && !stateLabel && !countText) {
    const chip = document.createElement("span");
    chip.className = `value-chip value-chip-${booleanValue.kind}`;
    chip.textContent = booleanValue.label;
    preview.replaceChildren(chip);
    count.textContent = "";
  } else {
    preview.textContent = value || stateLabel || t("missing", "Missing");
    count.textContent = countText || (options.showCharCount && value ? t("charCount", "$1 chars", [String(value.length)]) : "");
  }

  row.append(type, preview, count);
  return row;
}

function createPrivacyRow(typeLabel, value, stateLabel = "") {
  return createReviewRow("privacy-row", "privacy-type", typeLabel, value, stateLabel, "", {
    renderBoolean: true,
    showCharCount: true
  });
}

function createAdditionalFieldsRow(typeLabel, value, stateLabel = "", countText = "", renderBoolean = false) {
  return createReviewRow("additional-fields-row", "privacy-type", typeLabel, value, stateLabel, countText, {
    renderBoolean,
    showCharCount: true
  });
}

function createCategoryRow(typeLabel, value, stateLabel = "", countText = "") {
  return createReviewRow("category-row", "privacy-type", typeLabel, value, stateLabel, countText, {
    showCharCount: true
  });
}

function createLanguageDiagnosticRow(typeLabel, value, stateLabel = "", countText = "") {
  return createReviewRow("language-diagnostics-row", "privacy-type", typeLabel, value, stateLabel, countText);
}
