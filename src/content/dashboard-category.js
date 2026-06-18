function normalizeCategoryMatchText(value) {
  return storePilotNormalizeCategoryText(value);
}

function getChromeWebStoreCategoryByValue(value) {
  const normalizedValue = String(value || "").trim().toUpperCase();
  return STOREPILOT_CHROME_WEB_STORE_CATEGORIES.find(category => category.value === normalizedValue) || null;
}

function getChromeWebStoreCategoryByLabel(label) {
  const normalizedLabel = normalizeCategoryMatchText(label);
  return STOREPILOT_CHROME_WEB_STORE_CATEGORIES.find(category => (
    normalizeCategoryMatchText(category.label) === normalizedLabel ||
    (category.aliases || []).some(alias => normalizeCategoryMatchText(alias) === normalizedLabel)
  )) || null;
}

function getActiveCategorySelection() {
  const file = activeCategoryDoc && activeCategoryDoc.file;
  if (!file) return null;

  const category = getChromeWebStoreCategoryByValue(file.categoryValue) ||
    getChromeWebStoreCategoryByLabel(file.categoryLabel) ||
    getChromeWebStoreCategoryByLabel(file.rawCategory);
  if (!category && !file.categoryLabel) return null;

  return {
    label: category ? category.label : file.categoryLabel,
    value: category ? category.value : file.categoryValue || "",
    path: file.path || "",
    rawCategory: file.rawCategory || file.categoryLabel || ""
  };
}

function categoryTextMatches(text, category) {
  const normalizedText = normalizeCategoryMatchText(text);
  const normalizedCategory = normalizeCategoryMatchText(category && category.label);
  return Boolean(normalizedCategory && (
    normalizedText === normalizedCategory ||
    normalizedText.endsWith(` ${normalizedCategory}`)
  ));
}

function getCategoryDropdownSelectedText(dropdown) {
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
    .filter(text => !/^(category|select a category)$/i.test(text.trim()));
  if (labelledTexts.length) return labelledTexts[labelledTexts.length - 1];

  return getVisibleText(dropdown).replace(/\bcategory\b/i, "").trim();
}

function getCategoryDropdownContextText(dropdown) {
  return normalizeCategoryMatchText([
    dropdown && dropdown.getAttribute("aria-label") || "",
    dropdown ? getElementLabelText(dropdown) : "",
    dropdown ? getVisibleText(dropdown) : ""
  ].join(" "));
}

function findCategoryDropdown() {
  const candidates = Array.from(document.querySelectorAll("[role='combobox'], .VfPpkd-TkwUic"))
    .filter(isVisible)
    .filter(element => element.getAttribute("aria-disabled") !== "true");

  return candidates.find(element => /\bcategory\b/.test(getCategoryDropdownContextText(element))) || null;
}

function getOpenCategoryOptions() {
  return Array.from(document.querySelectorAll("[role='option']"))
    .filter(element => element.getAttribute("aria-disabled") !== "true")
    .filter(isVisible)
    .map(element => ({
      element,
      text: getVisibleText(element),
      value: element.getAttribute("data-value") || ""
    }))
    .filter(option => (
      option.value.startsWith("CATEGORY_") ||
      Boolean(getChromeWebStoreCategoryByLabel(option.text))
    ))
    .filter(option => getChromeWebStoreCategoryByValue(option.value) || getChromeWebStoreCategoryByLabel(option.text));
}

function findCategoryOption(category) {
  const options = getOpenCategoryOptions();
  return options.find(option => category.value && option.value === category.value) ||
    options.find(option => normalizeCategoryMatchText(option.text) === normalizeCategoryMatchText(category.label)) ||
    null;
}

async function openCategoryDropdown(dropdown = findCategoryDropdown()) {
  if (!dropdown) {
    return { ok: false, message: localize("categoryFieldNotFound", "Could not find the Chrome Web Store category field.") };
  }

  dropdown.scrollIntoView({ block: "center", inline: "nearest" });
  activateDashboardButton(dropdown);
  await delay(250);

  if (!getOpenCategoryOptions().length) {
    dropdown.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true, cancelable: true }));
    await delay(250);
  }

  return { ok: true, dropdown };
}

async function selectDashboardCategory() {
  if (mediaOperationState.running) {
    return {
      ok: true,
      ignored: true,
      message: localize("mediaOperationAlreadyRunning", "Media operation already running: $1.", [mediaOperationState.label])
    };
  }

  if (isFillingAllLanguages) {
    return { ok: false, message: localize("fillAllAlreadyRunning", "Description fill is already running.") };
  }

  await loadListings();

  const category = getActiveCategorySelection();
  if (!category) {
    return { ok: false, message: localize("categoryDocNotImported", "No category document imported for the active project.") };
  }

  const dropdown = findCategoryDropdown();
  if (!dropdown) {
    return {
      ok: false,
      message: localize("categoryFieldNotFound", "Could not find the Chrome Web Store category field."),
      diagnostics: {
        targetCategory: category,
        comboboxCount: document.querySelectorAll("[role='combobox'], .VfPpkd-TkwUic").length
      }
    };
  }

  const currentCategory = getCategoryDropdownSelectedText(dropdown);
  if (categoryTextMatches(currentCategory, category)) {
    return { ok: true, message: localize("categoryAlreadySelected", "Category already selected: $1.", [category.label]) };
  }

  const opened = await openCategoryDropdown(dropdown);
  if (!opened.ok) return opened;

  let option = findCategoryOption(category);
  for (let attempt = 0; !option && attempt < 10; attempt++) {
    await delay(150);
    option = findCategoryOption(category);
  }

  if (!option) {
    const availableOptions = getOpenCategoryOptions().map(candidate => candidate.text || candidate.value).filter(Boolean);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return {
      ok: false,
      message: localize("categoryOptionNotFound", "Could not find category option: $1.", [category.label]),
      diagnostics: {
        targetCategory: category,
        currentCategory,
        availableOptions
      }
    };
  }

  activateDashboardButton(option.element);

  for (let attempt = 0; attempt < 12; attempt++) {
    await delay(150);
    const nextDropdown = findCategoryDropdown() || dropdown;
    const nextCategory = getCategoryDropdownSelectedText(nextDropdown);
    if (!nextCategory || categoryTextMatches(nextCategory, category)) {
      return { ok: true, message: localize("categorySelected", "Selected category: $1.", [category.label]) };
    }
  }

  return {
    ok: false,
    message: localize("clickedButCategoryShows", "Clicked $1, but the dashboard still shows $2.", [
      category.label,
      getCategoryDropdownSelectedText(findCategoryDropdown() || dropdown) || localize("unknown", "Unknown")
    ]),
    diagnostics: {
      targetCategory: category,
      clickedOption: option.text,
      clickedValue: option.value
    }
  };
}
