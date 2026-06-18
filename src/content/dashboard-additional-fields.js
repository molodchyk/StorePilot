function normalizeAdditionalMatchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/[^a-z0-9_.:/ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getActiveAdditionalFields() {
  return activeAdditionalFieldsDoc && activeAdditionalFieldsDoc.file && activeAdditionalFieldsDoc.file.fields
    ? activeAdditionalFieldsDoc.file.fields
    : {};
}

function hasAdditionalField(fields, key) {
  return Object.prototype.hasOwnProperty.call(fields || {}, key);
}

function isNoneAdditionalFieldValue(value) {
  return /^(none|null|n\/a|na|not applicable|not provided)$/i.test(String(value || "").trim());
}

function getAdditionalUrlFieldFillValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (isNoneAdditionalFieldValue(raw)) return "";

  const firstUrl = raw.match(/https?:\/\/\S+/i);
  const url = firstUrl ? firstUrl[0] : raw.split(/\r?\n/).map(line => line.trim()).find(Boolean) || "";
  return url.replace(/[),;]+$/g, "").trim();
}

function parseMatureContentValue(value) {
  const normalized = normalizeAdditionalMatchText(value);
  if (/^(yes|true|on|1)$/.test(normalized)) return true;
  if (/^(no|false|off|0)$/.test(normalized)) return false;
  return null;
}

function getAdditionalFieldContextText(element) {
  const parts = [getElementLabelText(element)];
  const containers = [
    element.closest("label"),
    element.closest(".TVM7Wc"),
    element.closest(".Ufn6O"),
    element.closest(".n5L2Mb")
  ].filter(Boolean);

  containers.forEach(container => {
    const clone = container.cloneNode(true);
    clone.querySelectorAll("textarea,input,[role='textbox'],[role='combobox'],[role='switch']").forEach(control => {
      control.remove();
    });
    parts.push(getVisibleText(clone));
  });

  return normalizeAdditionalMatchText(parts.join(" "));
}

function getAdditionalTextFieldCandidates() {
  return Array.from(document.querySelectorAll([
    "input[type='text']",
    "input[type='url']",
    "input:not([type])",
    "[role='textbox']"
  ].join(",")))
    .filter(isVisible)
    .map((element, index) => {
      const rect = element.getBoundingClientRect();
      return {
        element,
        index,
        context: getAdditionalFieldContextText(element),
        maxLength: Number(element.getAttribute("maxlength") || 0),
        tagName: element.tagName.toLowerCase(),
        area: rect.width * rect.height
      };
    });
}

function scoreAdditionalTextFieldCandidate(candidate, key) {
  const context = candidate.context;
  let score = 0;

  if (key === "homepage_url") {
    if (/\bhomepage url\b|\bhome page url\b/.test(context)) score += 180;
    if (/\bhomepage\b|\bhome page\b/.test(context)) score += 100;
    if (/\burl\b/.test(context)) score += 35;
    if (/\bsupport\b/.test(context)) score -= 120;
  } else if (key === "support_url") {
    if (/\bsupport url\b/.test(context)) score += 180;
    if (/\bsupport\b/.test(context)) score += 100;
    if (/\burl\b/.test(context)) score += 35;
    if (/\bhomepage\b|\bhome page\b/.test(context)) score -= 120;
  }

  if (candidate.tagName === "input") score += 25;
  if (candidate.maxLength >= 1000) score += 15;
  if (candidate.area > 12000) score += 10;

  return score;
}

function findAdditionalTextField(key) {
  const candidates = getAdditionalTextFieldCandidates()
    .map(candidate => ({
      ...candidate,
      score: scoreAdditionalTextFieldCandidate(candidate, key)
    }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || b.area - a.area || a.index - b.index);

  return candidates[0] && candidates[0].score >= 90 ? candidates[0] : null;
}

function normalizeAdditionalUrlForMatch(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase();
}

function getOfficialUrlDropdownContextText(dropdown) {
  return normalizeAdditionalMatchText([
    dropdown && dropdown.getAttribute("aria-label") || "",
    dropdown ? getElementLabelText(dropdown) : "",
    dropdown ? getVisibleText(dropdown) : ""
  ].join(" "));
}

function findOfficialUrlDropdown() {
  const candidates = Array.from(document.querySelectorAll("[role='combobox'], .VfPpkd-TkwUic"))
    .filter(isVisible)
    .filter(element => element.getAttribute("aria-disabled") !== "true");

  return candidates.find(element => /\bofficial url\b/.test(getOfficialUrlDropdownContextText(element))) || null;
}

function getOfficialUrlDropdownSelectedText(dropdown) {
  if (!dropdown) return "";

  const selectedElement = dropdown.querySelector("[jsname='Fb0Bif'], .VfPpkd-uusGie-fmcmS");
  const selectedText = selectedElement ? getVisibleText(selectedElement) : "";
  if (selectedText) return selectedText;

  const labelledBy = dropdown.getAttribute("aria-labelledby") || "";
  const labelledTexts = labelledBy.split(/\s+/)
    .map(id => document.getElementById(id))
    .filter(Boolean)
    .map(getVisibleText)
    .filter(Boolean)
    .filter(text => !/^official url$/i.test(text.trim()));
  if (labelledTexts.length) return labelledTexts[labelledTexts.length - 1];

  return getVisibleText(dropdown).replace(/\bofficial url\b/i, "").trim();
}

function getOpenOfficialUrlOptions() {
  return Array.from(document.querySelectorAll("[role='option']"))
    .filter(element => element.getAttribute("aria-disabled") !== "true")
    .filter(isVisible)
    .map(element => ({
      element,
      text: getVisibleText(element),
      value: element.getAttribute("data-value") || ""
    }))
    .filter(option => option.text || option.value);
}

function findOfficialUrlOption(targetValue) {
  const options = getOpenOfficialUrlOptions();
  const normalizedTarget = normalizeAdditionalUrlForMatch(targetValue);

  if (isNoneAdditionalFieldValue(targetValue)) {
    return options.find(option => /^none$/i.test(option.value || option.text)) || null;
  }

  return options.find(option => normalizeAdditionalUrlForMatch(option.value) === normalizedTarget) ||
    options.find(option => normalizeAdditionalUrlForMatch(option.text) === normalizedTarget) ||
    options.find(option => normalizeAdditionalUrlForMatch(option.text).includes(normalizedTarget)) ||
    null;
}

async function openOfficialUrlDropdown(dropdown = findOfficialUrlDropdown()) {
  if (!dropdown) {
    return { ok: false, message: localize("officialUrlFieldNotFound", "Could not find the Official URL field.") };
  }

  dropdown.scrollIntoView({ block: "center", inline: "nearest" });
  activateDashboardButton(dropdown);
  await delay(250);

  if (!getOpenOfficialUrlOptions().length) {
    dropdown.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true, cancelable: true }));
    await delay(250);
  }

  return { ok: true, dropdown };
}

async function selectOfficialUrlField(rawValue) {
  const targetValue = isNoneAdditionalFieldValue(rawValue) ? "None" : getAdditionalUrlFieldFillValue(rawValue);
  if (!targetValue) {
    return {
      ok: true,
      skipped: true,
      key: "official_url",
      message: localize("additionalFieldSkipped", "Skipped additional field: $1.", ["official_url"])
    };
  }

  const dropdown = findOfficialUrlDropdown();
  if (!dropdown) {
    return { ok: false, key: "official_url", message: localize("officialUrlFieldNotFound", "Could not find the Official URL field.") };
  }

  const currentValue = getOfficialUrlDropdownSelectedText(dropdown);
  if (
    isNoneAdditionalFieldValue(targetValue) && /^none$/i.test(currentValue) ||
    normalizeAdditionalUrlForMatch(currentValue) === normalizeAdditionalUrlForMatch(targetValue)
  ) {
    return { ok: true, key: "official_url", message: localize("additionalFieldAlreadySet", "Additional field already set: $1.", ["official_url"]) };
  }

  const opened = await openOfficialUrlDropdown(dropdown);
  if (!opened.ok) return { ...opened, key: "official_url" };

  let option = findOfficialUrlOption(targetValue);
  for (let attempt = 0; !option && attempt < 8; attempt++) {
    await delay(150);
    option = findOfficialUrlOption(targetValue);
  }

  if (!option) {
    const availableOptions = getOpenOfficialUrlOptions().map(candidate => candidate.text || candidate.value).filter(Boolean);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return {
      ok: false,
      key: "official_url",
      message: localize("officialUrlOptionNotFound", "Could not find Official URL option: $1.", [targetValue]),
      diagnostics: {
        targetValue,
        currentValue,
        availableOptions
      }
    };
  }

  activateDashboardButton(option.element);
  await delay(250);
  return { ok: true, key: "official_url", message: localize("additionalFieldFilled", "Filled additional field: $1.", ["official_url"]) };
}

function fillAdditionalUrlTextField(key) {
  const fields = getActiveAdditionalFields();
  if (!hasAdditionalField(fields, key)) {
    return {
      ok: true,
      skipped: true,
      key,
      message: localize("additionalFieldSkipped", "Skipped additional field: $1.", [key])
    };
  }

  const rawValue = String(fields[key] || "").trim();
  if (!rawValue) {
    return {
      ok: true,
      skipped: true,
      key,
      message: localize("additionalFieldSkipped", "Skipped additional field: $1.", [key])
    };
  }

  const value = getAdditionalUrlFieldFillValue(rawValue);
  const target = findAdditionalTextField(key);
  if (!target) {
    return { ok: false, key, message: localize("additionalFieldNotFound", "Could not find additional field: $1.", [key]) };
  }

  if (!fillElement(target.element, value)) {
    return { ok: false, key, message: localize("additionalFieldDidNotAcceptValue", "Additional field did not accept value: $1.", [key]) };
  }

  const actual = normalizeFilledFormValue(getEditableElementValue(target.element));
  const expected = normalizeFilledFormValue(value);
  if (actual !== expected) {
    return {
      ok: false,
      key,
      message: localize("additionalFieldDidNotAcceptValue", "Additional field did not accept value: $1.", [key]),
      actual,
      expected
    };
  }

  return { ok: true, key, message: localize("additionalFieldFilled", "Filled additional field: $1.", [key]) };
}

function getMatureContentSwitchContextText(element) {
  const parts = [getElementLabelText(element)];
  const containers = [
    element.closest("label"),
    element.closest(".TVM7Wc"),
    element.closest(".n5L2Mb")
  ].filter(Boolean);

  containers.forEach(container => {
    parts.push(getVisibleText(container));
  });

  return normalizeAdditionalMatchText(parts.join(" "));
}

function findMatureContentSwitch() {
  const candidates = Array.from(document.querySelectorAll("button[role='switch'], [role='switch']"))
    .filter(isVisible)
    .filter(element => element.getAttribute("aria-disabled") !== "true")
    .map((element, index) => {
      const context = getMatureContentSwitchContextText(element);
      let score = 0;
      if (/\bmature content\b/.test(context)) score += 180;
      if (/\bmature\b/.test(context)) score += 80;
      if (/\bcontent\b/.test(context)) score += 25;
      return { element, index, context, score };
    })
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return candidates[0] && candidates[0].score >= 120 ? candidates[0].element : null;
}

function setMatureContentField(rawValue) {
  const targetValue = parseMatureContentValue(rawValue);
  if (targetValue === null) {
    return {
      ok: true,
      skipped: true,
      key: "mature_content",
      message: localize("additionalFieldSkipped", "Skipped additional field: $1.", ["mature_content"])
    };
  }

  const switchElement = findMatureContentSwitch();
  if (!switchElement) {
    return { ok: false, key: "mature_content", message: localize("additionalFieldNotFound", "Could not find additional field: $1.", ["mature_content"]) };
  }

  const currentValue = switchElement.getAttribute("aria-checked") === "true";
  if (currentValue === targetValue) {
    return { ok: true, key: "mature_content", message: localize("additionalFieldAlreadySet", "Additional field already set: $1.", ["mature_content"]) };
  }

  activateDashboardButton(switchElement);
  return { ok: true, key: "mature_content", message: localize("additionalFieldFilled", "Filled additional field: $1.", ["mature_content"]) };
}

async function fillDetectedAdditionalFields() {
  const fields = getActiveAdditionalFields();
  if (!Object.keys(fields).length) {
    return { ok: false, message: localize("additionalFieldsDocNotImported", "No additional fields document imported for the active project.") };
  }

  const filled = [];
  const missing = [];
  const skipped = [];
  const results = [];

  for (const key of ["official_url", "homepage_url", "support_url", "mature_content"]) {
    if (!hasAdditionalField(fields, key)) continue;

    let result;
    if (key === "official_url") {
      result = await selectOfficialUrlField(fields[key]);
    } else if (key === "homepage_url" || key === "support_url") {
      result = fillAdditionalUrlTextField(key);
    } else if (key === "mature_content") {
      result = setMatureContentField(fields[key]);
    }

    if (!result) continue;
    results.push(result);
    if (result.skipped) {
      skipped.push(key);
    } else if (result.ok) {
      filled.push(key);
    } else {
      missing.push(key);
    }
  }

  return {
    ok: filled.length > 0 || skipped.length > 0,
    message: [
      filled.length ? localize("additionalFieldsFilled", "Filled $1 additional field(s): $2.", [String(filled.length), filled.join(", ")]) : "",
      skipped.length ? localize("additionalFieldsSkipped", "Skipped $1 additional field(s): $2.", [String(skipped.length), skipped.join(", ")]) : "",
      missing.length ? localize("additionalFieldsNotFound", "Could not find: $1.", [missing.join(", ")]) : ""
    ].filter(Boolean).join(" ") || localize("additionalFieldsNoSupportedFields", "No supported additional fields were available to fill."),
    filled,
    skipped,
    missing,
    results
  };
}
