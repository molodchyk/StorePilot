function findClickableAncestor(element) {
  let current = element;

  for (let depth = 0; current && depth < 10; depth++) {
    const role = current.getAttribute && current.getAttribute("role");
    const jsaction = current.getAttribute && current.getAttribute("jsaction");

    if (
      role === "combobox" ||
      role === "button" ||
      current.tabIndex >= 0 ||
      current.classList && current.classList.contains("VfPpkd-TkwUic") ||
      jsaction && /click|mousedown|keydown/.test(jsaction)
    ) {
      return current;
    }

    current = current.parentElement;
  }

  return element;
}

function getDropdownMenuRoots(dropdown) {
  if (!dropdown) return [];

  const roots = [];
  const addRoot = root => {
    if (root && !roots.includes(root)) roots.push(root);
  };

  getElementsByIdList(dropdown.getAttribute("aria-controls")).forEach(addRoot);
  addRoot(dropdown.nextElementSibling);

  const container = dropdown.closest(".VfPpkd-O1htCb") ||
    dropdown.closest("label") ||
    dropdown.parentElement;
  if (container) {
    Array.from(container.querySelectorAll("[role='listbox'], [role='menu']")).forEach(addRoot);
  }

  return roots.filter(Boolean);
}

function getLanguageOptionElements(dropdown = null, visibleOnly = true) {
  const selector = "[role='option'], [role='menuitem'], .VfPpkd-StrnGf-rymPhb-ibnC6b";
  const roots = dropdown ? getDropdownMenuRoots(dropdown) : [];
  let options = roots.flatMap(root => Array.from(root.querySelectorAll(selector)));

  if (!options.length) {
    options = Array.from(document.querySelectorAll(selector));
  }

  return Array.from(new Set(options))
    .filter(option => !visibleOnly || isVisible(option));
}

function getLanguageDropdownSelectedText(dropdown) {
  if (!dropdown) return "";

  const labelIds = new Set(getElementsByIdList(dropdown.getAttribute("aria-labelledby"))
    .filter(element => isLikelyLanguageText(getVisibleText(element)))
    .map(element => element.id)
    .filter(Boolean));
  const selectedTextFromLabelledBy = getElementsByIdList(dropdown.getAttribute("aria-labelledby"))
    .filter(element => !labelIds.has(element.id))
    .map(getVisibleText)
    .filter(Boolean)
    .join(" ");

  return selectedTextFromLabelledBy || getVisibleText(dropdown);
}

function getLanguageDropdownLocale(dropdown) {
  return getElementLocale(dropdown) ||
    getLocaleFromText(getLanguageDropdownSelectedText(dropdown)) ||
    getLocaleFromText(getReferencedText(dropdown, "aria-labelledby"));
}

function getDropdownLocalContext(dropdown) {
  if (!dropdown) return "";

  const containers = [
    dropdown.closest(".TVM7Wc"),
    dropdown.closest(".O1htCb-H9tDt"),
    dropdown.closest("label"),
    dropdown.parentElement,
    dropdown
  ].filter(Boolean);

  return containers
    .map(getVisibleText)
    .filter(Boolean)
    .sort((a, b) => a.length - b.length)[0] || "";
}

function getLanguageDropdownLabelText(dropdown) {
  return [
    getReferencedText(dropdown, "aria-labelledby"),
    dropdown && dropdown.getAttribute("aria-label") || "",
    dropdown ? getDropdownLocalContext(dropdown) : ""
  ].filter(Boolean).join(" ");
}

function isLanguageDropdownCandidate(dropdown) {
  if (!dropdown) return false;

  const labelText = getLanguageDropdownLabelText(dropdown);
  return containsLikelyLanguageText(labelText) ||
    getLanguageOptionElements(dropdown, false).some(option => getElementLocale(option));
}

function isMultiLocaleLanguageDropdown(dropdown) {
  if (!isLanguageDropdownCandidate(dropdown)) return false;

  const localContext = normalizeLanguageText(getDropdownLocalContext(dropdown));
  if (/current editing language/.test(localContext)) return true;

  const currentEditingLabel = findVisibleTextElement(/current editing language/i);
  if (!currentEditingLabel) return false;

  const dropdownRect = dropdown.getBoundingClientRect();
  const labelRect = currentEditingLabel.getBoundingClientRect();
  return Math.abs(dropdownRect.top - labelRect.top) < 140 &&
    dropdownRect.left > labelRect.left;
}

function isOneLanguageProductDetailsDropdown(dropdown) {
  if (!isLanguageDropdownCandidate(dropdown)) return false;
  if (isMultiLocaleLanguageDropdown(dropdown)) return false;

  const localContext = normalizeLanguageText(getDropdownLocalContext(dropdown));
  if (/select a language/.test(localContext) && !/current editing language/.test(localContext)) {
    return true;
  }

  const categoryDropdown = typeof findCategoryDropdown === "function" ? findCategoryDropdown() : null;
  const graphicAssetsLabel = findVisibleTextElement(/graphic assets/i);
  const dropdownTop = getElementTop(dropdown);
  const categoryBottom = categoryDropdown ? categoryDropdown.getBoundingClientRect().bottom : Number.NEGATIVE_INFINITY;
  const graphicAssetsTop = graphicAssetsLabel ? graphicAssetsLabel.getBoundingClientRect().top : Number.POSITIVE_INFINITY;

  return dropdownTop > categoryBottom - 24 &&
    dropdownTop < graphicAssetsTop + 24 &&
    !/current editing language/.test(localContext);
}

function isLanguageDropdownPlaceholder(dropdown) {
  const rawText = getVisibleText(dropdown);
  const normalizedText = normalizeLanguageText(rawText);
  return !getLanguageDropdownLocale(dropdown) &&
    (/select a language|select language|language auswahlen|sprache auswahlen|seleccion(?:a|ar|e) (?:un )?idioma|selectionn(?:er|ez) une langue|seleziona(?:re)? (?:una )?lingua/i.test(normalizedText) ||
      /言語を選択|选择语言/.test(rawText));
}

function getLanguageDropdownMode(dropdown) {
  if (!dropdown) return "";

  if (isMultiLocaleLanguageDropdown(dropdown)) return "multi-locale";
  if (isOneLanguageProductDetailsDropdown(dropdown)) return "one-language";
  return "unknown";
}

function getExpectedLanguageDropdownMode() {
  return Object.keys(listings).length === 1 ? "one-language" : "multi-locale";
}

function scoreLanguageDropdown(dropdown, preferredLocale = "") {
  const visibleText = getVisibleText(dropdown);
  const labelledText = getReferencedText(dropdown, "aria-labelledby");
  const labelText = [
    labelledText,
    dropdown.getAttribute("aria-label") || "",
    dropdown.closest("label") ? getVisibleText(dropdown.closest("label")) : ""
  ].filter(Boolean).join(" ");
  const menuRoots = getDropdownMenuRoots(dropdown);
  const menuLabelText = menuRoots
    .map(root => [
      root.getAttribute && root.getAttribute("aria-label") || "",
      getReferencedText(root, "aria-labelledby")
    ].filter(Boolean).join(" "))
    .join(" ");
  const optionLocales = getLanguageOptionElements(dropdown, false)
    .map(option => getElementLocale(option))
    .filter(Boolean);
  const optionLocaleCount = new Set(optionLocales).size;
  const selectedLocale = getLanguageDropdownLocale(dropdown);
  const preferredMatchesOption = preferredLocale && optionLocales.some(locale => localesMatch(locale, preferredLocale));
  const normalizedContext = normalizeLanguageText([
    visibleText,
    labelText,
    menuLabelText,
    dropdown.closest("section") ? getVisibleText(dropdown.closest("section")).slice(0, 400) : ""
  ].join(" "));

  let score = 0;
  if (isLikelyLanguageText(labelledText) || isLikelyLanguageText(labelText)) score += 140;
  if (containsLikelyLanguageText(labelText)) score += 90;
  if (containsLikelyLanguageText(visibleText)) score += 45;
  if (containsLikelyLanguageText(menuLabelText)) score += 35;
  if (dropdown.getAttribute("aria-required") === "true") score += 12;
  if ((dropdown.getAttribute("aria-haspopup") || "").toLowerCase() === "listbox") score += 12;
  if (optionLocaleCount) score += Math.min(90, 30 + optionLocaleCount * 4);
  if (preferredMatchesOption) score += 80;
  if (selectedLocale) score += 25;
  if (preferredLocale && selectedLocale && localesMatch(selectedLocale, preferredLocale)) score += 40;
  if (/select a language/.test(normalizedContext)) score += 25;
  if (/current editing language/.test(normalizedContext)) score += 25;
  if (/product details/.test(normalizedContext) && /graphic assets/.test(normalizedContext)) score += 15;
  if (/\b(category|official url|homepage url|support url|mature content)\b/.test(normalizedContext)) score -= 90;
  if (/select a category|functionality and ui|privacy and security|developer tools/.test(normalizedContext)) score -= 60;

  return score;
}

function findLanguageDropdown(preferredLocale = "", expectedMode = "") {
  const comboboxes = Array.from(document.querySelectorAll("[role='combobox'], .VfPpkd-TkwUic")).filter(isVisible);
  const candidates = comboboxes
    .map((element, index) => ({
      element,
      index,
      mode: getLanguageDropdownMode(element),
      score: scoreLanguageDropdown(element, preferredLocale)
    }));

  if (expectedMode) {
    const modeMatchedCombobox = candidates
      .filter(candidate => candidate.mode === expectedMode)
      .sort((a, b) => b.score - a.score || a.index - b.index)[0];
    return modeMatchedCombobox ? modeMatchedCombobox.element : null;
  }

  const rankedComboboxes = candidates
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  if (rankedComboboxes.length) return rankedComboboxes[0].element;

  const labels = Array.from(document.querySelectorAll("span, label, div"))
    .filter(isVisible)
    .filter(element => isLikelyLanguageText(getVisibleText(element)));

  for (const label of labels) {
    const dropdown = label.closest(".VfPpkd-TkwUic") ||
      label.closest("[role='combobox']") ||
      findClickableAncestor(label);

    if (dropdown && isVisible(dropdown)) {
      return dropdown;
    }
  }

  return null;
}

function getCurrentDashboardLocale({ includePageFallback = true } = {}) {
  const dropdown = findLanguageDropdown();
  const dropdownLocale = dropdown ? getLanguageDropdownLocale(dropdown) : "";
  if (dropdownLocale) return dropdownLocale;
  if (!includePageFallback) return "";

  const localeKeys = Object.keys(listings);
  const visibleLocaleText = Array.from(document.querySelectorAll("span, div, button"))
    .filter(isVisible)
    .map(getVisibleText)
    .filter(text => text.length > 0 && text.length < 140)
    .find(text => getLocaleFromText(text, localeKeys));

  return visibleLocaleText ? getLocaleFromText(visibleLocaleText, localeKeys) : "";
}

function getOpenLanguageOptions(dropdown = null, visibleOnly = true) {
  return getLanguageOptionElements(dropdown, visibleOnly)
    .map(element => ({
      element,
      text: getVisibleText(element),
      value: element.getAttribute("data-value") || element.getAttribute("value") || "",
      locale: getElementLocale(element)
    }))
    .filter(option => option.locale);
}

function scrollDropdownOptionIntoView(optionElement) {
  if (!optionElement) return;

  const scrollRoot = optionElement.closest("[role='listbox'], [role='menu'], .VfPpkd-xl07Ob, .VfPpkd-xl07Ob-XxIAqe");
  if (scrollRoot && scrollRoot.scrollHeight > scrollRoot.clientHeight) {
    const optionRect = optionElement.getBoundingClientRect();
    const rootRect = scrollRoot.getBoundingClientRect();
    const centeredOffset = optionRect.top - rootRect.top - ((rootRect.height - optionRect.height) / 2);
    scrollRoot.scrollTop += centeredOffset;
  }

  if (typeof optionElement.scrollIntoView === "function") {
    optionElement.scrollIntoView({ block: "center", inline: "nearest" });
  }
}

function activateDropdownOption(optionElement) {
  if (!optionElement) return;

  if (typeof optionElement.focus === "function") {
    optionElement.focus({ preventScroll: true });
  }

  [
    ["pointerover", PointerEvent],
    ["mouseover", MouseEvent],
    ["mouseenter", MouseEvent],
    ["pointerdown", PointerEvent],
    ["mousedown", MouseEvent],
    ["pointerup", PointerEvent],
    ["mouseup", MouseEvent]
  ].forEach(([type, EventConstructor]) => {
    const isPointer = EventConstructor === PointerEvent;
    const isDown = type.endsWith("down");
    const event = isPointer
      ? new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        buttons: isDown ? 1 : 0
      })
      : new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: isDown ? 1 : 0
    });
    optionElement.dispatchEvent(event);
  });

  if (typeof optionElement.click === "function") {
    optionElement.click();
  }
}

function activateDropdownOptionLegacy(optionElement) {
  if (!optionElement) return;

  optionElement.scrollIntoView({ block: "center", inline: "nearest" });
  optionElement.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" }));
  optionElement.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  optionElement.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" }));
  optionElement.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  optionElement.click();
}

function getLanguageOptionsForMode(opened, mode) {
  return mode === "one-language"
    ? getOpenLanguageOptions(opened.dropdown, false)
    : getOpenLanguageOptions(null, true);
}

function activateLanguageOptionForMode(optionElement, mode) {
  if (mode === "one-language") {
    scrollDropdownOptionIntoView(optionElement);
    return "scrolled";
  }

  activateDropdownOptionLegacy(optionElement);
  return "legacy";
}
