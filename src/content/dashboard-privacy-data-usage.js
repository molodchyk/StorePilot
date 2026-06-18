function isPrivacyCheckboxChecked(input) {
  if (!input) return false;
  return Boolean(
    input.checked ||
    input.getAttribute("aria-checked") === "true" ||
    (input.closest("[aria-checked]") && input.closest("[aria-checked]").getAttribute("aria-checked") === "true")
  );
}

function getPrivacyCheckboxRows() {
  return Array.from(document.querySelectorAll("input[type='checkbox']"))
    .map((input, index) => {
      const row = input.closest(".VfPpkd-I9GLp-yrriRe") ||
        input.closest("label") ||
        input.parentElement ||
        input;
      const section = input.closest(".xOQx5b") || input.closest("section") || document.body;
      const control = input.closest(".VfPpkd-MPu53c") || input;
      const rect = row.getBoundingClientRect();

      return {
        input,
        row,
        section,
        control,
        index,
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        label: input.getAttribute("aria-label") || getVisibleText(row)
      };
    })
    .filter(item => isVisible(item.row) || isVisible(item.control) || isVisible(item.input))
    .sort((a, b) => a.top - b.top || a.left - b.left || a.index - b.index);
}

function getPrivacyCheckboxGroups() {
  const rows = getPrivacyCheckboxRows();
  const groups = [];

  rows.forEach(row => {
    let group = groups.find(candidate => candidate.section === row.section);
    if (!group) {
      group = {
        section: row.section,
        top: row.top,
        rows: []
      };
      groups.push(group);
    }
    group.rows.push(row);
    group.top = Math.min(group.top, row.top);
  });

  return groups
    .map(group => ({
      ...group,
      rows: group.rows.sort((a, b) => a.top - b.top || a.left - b.left || a.index - b.index)
    }))
    .sort((a, b) => a.top - b.top);
}

function getPrivacyDataUsageCheckboxMap() {
  const groups = getPrivacyCheckboxGroups();
  const dataGroup = groups.find(group => group.rows.length === PRIVACY_DATA_USAGE_KEYS.length);
  const certificationGroup = dataGroup
    ? groups.find(group => group.top > dataGroup.top && group.rows.length === PRIVACY_CERTIFICATION_KEYS.length)
    : null;

  if (!dataGroup || !certificationGroup) {
    return {
      ok: false,
      message: localize("dataUsageCheckboxStructureNotFound", "Could not confidently map Data usage checkboxes."),
      diagnostics: {
        checkboxGroupSizes: groups.map(group => group.rows.length),
        checkboxLabels: groups.map(group => group.rows.map(row => row.label))
      }
    };
  }

  const entries = {};
  PRIVACY_DATA_USAGE_KEYS.forEach((key, index) => {
    entries[key] = {
      ...dataGroup.rows[index],
      group: "data_usage"
    };
  });
  PRIVACY_CERTIFICATION_KEYS.forEach((key, index) => {
    entries[key] = {
      ...certificationGroup.rows[index],
      group: "certification"
    };
  });

  return {
    ok: true,
    entries,
    diagnostics: {
      mapping: Object.fromEntries(Object.entries(entries).map(([key, item]) => [key, item.label])),
      checkboxGroupSizes: groups.map(group => group.rows.length)
    }
  };
}

function setPrivacyCheckboxChecked(item, checked) {
  if (!item || !item.input) return false;
  if (isPrivacyCheckboxChecked(item.input) === checked) return true;

  const target = item.control || item.input;
  activateDashboardButton(target);

  if (isPrivacyCheckboxChecked(item.input) === checked) return true;

  item.input.click();
  if (isPrivacyCheckboxChecked(item.input) === checked) return true;

  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked");
  if (descriptor && typeof descriptor.set === "function") {
    descriptor.set.call(item.input, checked);
  } else {
    item.input.checked = checked;
  }
  item.input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  item.input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));

  return isPrivacyCheckboxChecked(item.input) === checked;
}

function fillPrivacyDataUsage() {
  const fields = getActivePrivacyFields();
  if (!Object.keys(fields).length) {
    return { ok: false, message: localize("privacyDocNotImported", "No privacy document imported for the active project.") };
  }

  const map = getPrivacyDataUsageCheckboxMap();
  if (!map.ok) {
    return {
      ok: false,
      message: map.message,
      diagnostics: map.diagnostics
    };
  }

  const checked = [];
  const unchecked = [];
  const skipped = [];
  const failed = [];
  const allKeys = [...PRIVACY_DATA_USAGE_KEYS, ...PRIVACY_CERTIFICATION_KEYS];

  allKeys.forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) return;

    const normalized = normalizeDataUsageDisclosureValue(fields[key]);
    if (!normalized) {
      skipped.push(key);
      return;
    }

    const item = map.entries[key];
    const checkedState = normalized === "yes";
    if (!item || !setPrivacyCheckboxChecked(item, checkedState)) {
      failed.push(key);
      return;
    }

    if (checkedState) {
      checked.push(key);
    } else {
      unchecked.push(key);
    }
  });

  const messageParts = [
    checked.length ? localize("dataUsageCheckedFields", "Checked $1 data usage disclosure(s): $2.", [String(checked.length), checked.join(", ")]) : "",
    unchecked.length ? localize("dataUsageUncheckedFields", "Unchecked $1 data usage disclosure(s): $2.", [String(unchecked.length), unchecked.join(", ")]) : "",
    skipped.length ? localize("dataUsageSkippedFields", "Skipped $1 data usage disclosure(s): $2.", [String(skipped.length), skipped.join(", ")]) : "",
    failed.length ? localize("dataUsageCheckboxesNotFound", "Could not set: $1.", [failed.join(", ")]) : ""
  ].filter(Boolean);

  return {
    ok: (checked.length > 0 || unchecked.length > 0) && failed.length === 0,
    message: messageParts.join(" ") || localize("dataUsageNoExplicitYes", "No explicit data usage values were available to apply."),
    checked,
    unchecked,
    skipped,
    failed,
    diagnostics: map.diagnostics
  };
}
