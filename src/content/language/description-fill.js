function getEditableCandidates() {
  const selectors = [
    "textarea",
    "input[type='text']",
    "input:not([type])",
    "[contenteditable='true']",
    "[role='textbox']"
  ].join(",");

  return Array.from(document.querySelectorAll(selectors)).filter(isVisible);
}

function findLikelyListingField() {
  const candidates = getEditableCandidates();
  const focused = document.activeElement;

  if (candidates.includes(focused)) {
    return focused;
  }

  const textareas = candidates.filter(element => element.tagName.toLowerCase() === "textarea");
  if (textareas.length) {
    return textareas.sort((a, b) => {
      const areaA = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
      const areaB = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
      return areaB - areaA;
    })[0];
  }

  return candidates[0] || null;
}

function getSelectedText() {
  return selectedLocale ? listings[selectedLocale] || "" : "";
}

async function copySelectedText() {
  const text = getSelectedText();
  if (!text) return { ok: false, message: localize("noListingSelected", "No listing selected.") };

  await navigator.clipboard.writeText(text);
  return { ok: true, message: localize("copiedLocale", "Copied $1.", [selectedLocale]) };
}

function fillSelectedText() {
  const text = getSelectedText();
  if (!text) return { ok: false, message: localize("noListingSelected", "No listing selected.") };

  const target = findLikelyListingField();
  if (!target) {
    return { ok: false, message: localize("noVisibleEditableField", "No visible editable field found.") };
  }

  fillElement(target, text);
  return { ok: true, message: localize("filledLocale", "Filled $1.", [selectedLocale]) };
}

function findDescriptionField() {
  const textareas = Array.from(document.querySelectorAll("textarea")).filter(isVisible);
  const labeledDescription = textareas.find(textarea => {
    const labelId = textarea.getAttribute("aria-labelledby");
    const label = labelId && document.getElementById(labelId);
    return label && /description|beschreibung|description|descrizione|descripción/i.test(getVisibleText(label));
  });

  if (labeledDescription) return labeledDescription;

  const requiredLongTextareas = textareas.filter(textarea => Number(textarea.getAttribute("maxlength") || 0) >= 1000);
  if (requiredLongTextareas.length) {
    return requiredLongTextareas.sort((a, b) => {
      const areaA = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
      const areaB = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
      return areaB - areaA;
    })[0];
  }

  return findLikelyListingField();
}

function formatLanguageOption(optionOrLocale) {
  if (!optionOrLocale) return localize("unknown", "unknown");
  if (typeof optionOrLocale === "string") return optionOrLocale;
  return optionOrLocale.text
    ? `${optionOrLocale.text} (${optionOrLocale.locale})`
    : optionOrLocale.locale;
}

function formatFillAllProgress(action, index, total, option) {
  return `${action} ${index}/${total}: ${formatLanguageOption(option)}...`;
}

function formatFillAllSummary(importedCount, matchedCount, unmatchedLocaleKeys) {
  return [
    localize("fillAllDashboardSummary", "Imported $1; matched $2 dashboard language(s).", [
      String(importedCount),
      String(matchedCount)
    ]),
    unmatchedLocaleKeys.length
      ? localize("unmatchedImportedLocales", "Dashboard language menu did not offer imported locale(s): $1.", [unmatchedLocaleKeys.join(", ")])
      : ""
  ].filter(Boolean).join(" ");
}

async function publishFillAllStatus(status) {
  fillAllStatus = {
    ...fillAllStatus,
    ...status,
    updatedAt: Date.now()
  };

  updatePanelFillAllUi();

  const panelStatus = document.querySelector(`#${PANEL_ID} .storepilot-status`);
  if (panelStatus && fillAllStatus.message) {
    panelStatus.textContent = fillAllStatus.message;
  }

  try {
    const result = storePilotRuntimeSendMessage({
      type: "storepilot-fill-all-progress",
      status: fillAllStatus,
      message: fillAllStatus.message
    });
    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
  } catch (_error) {
    // Progress updates are best-effort because some extension contexts may be closed.
  }

  await storePilotStorageLocalSet({
    [FILL_ALL_STATUS_STORAGE_KEY]: fillAllStatus
  });

  return fillAllStatus;
}

function updatePanelFillAllUi() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const running = Boolean(isFillingAllLanguages || fillAllStatus.running);
  const mediaRunning = Boolean(mediaOperationState.running);
  const fillCurrentButton = panel.querySelector("[data-storepilot-action='fill-current']");
  const fillAllButton = panel.querySelector("[data-storepilot-action='fill-all']");
  const selectCategoryButton = panel.querySelector("[data-storepilot-action='select-category']");
  const fillAdditionalFieldsButton = panel.querySelector("[data-storepilot-action='fill-additional-fields']");
  const abortButtons = Array.from(panel.querySelectorAll("[data-storepilot-action='abort-operation'], [data-storepilot-action='abort-fill-all']"));

  if (fillCurrentButton) {
    fillCurrentButton.disabled = running || mediaRunning;
    fillCurrentButton.title = mediaRunning ? mediaOperationState.label : "";
  }
  if (fillAllButton) {
    fillAllButton.disabled = running || mediaRunning;
    fillAllButton.title = mediaRunning ? mediaOperationState.label : "";
  }
  if (selectCategoryButton) {
    selectCategoryButton.disabled = running || mediaRunning;
    selectCategoryButton.title = mediaRunning ? mediaOperationState.label : (running ? localize("fillingAllLanguages", "Filling descriptions...") : "");
  }
  if (fillAdditionalFieldsButton) {
    fillAdditionalFieldsButton.disabled = running || mediaRunning;
    fillAdditionalFieldsButton.title = mediaRunning ? mediaOperationState.label : (running ? localize("fillingAllLanguages", "Filling descriptions...") : "");
  }
  abortButtons.forEach(button => {
    button.hidden = !running && !mediaRunning;
    button.disabled = false;
  });
}

async function openLanguageDropdown(preferredLocale = "", expectedMode = "", options = {}) {
  const dropdown = findLanguageDropdown(preferredLocale, expectedMode);
  if (!dropdown) {
    return { ok: false, message: localize("languageDropdownNotFound", "Could not find the Chrome Web Store language dropdown.") };
  }

  const openDelayMs = Number.isFinite(options.openDelayMs) ? Math.max(0, options.openDelayMs) : 250;
  dropdown.scrollIntoView({ block: "center", inline: "nearest" });
  dropdown.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" }));
  dropdown.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  dropdown.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" }));
  dropdown.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  dropdown.click();
  if (openDelayMs) {
    await delay(openDelayMs);
  }

  return {
    ok: true,
    dropdown,
    mode: getLanguageDropdownMode(dropdown) || expectedMode || "unknown"
  };
}

async function waitForLanguageDropdownMenuClosed(dropdown, attempts = 4, delayMs = 50) {
  if (typeof isLanguageDropdownMenuOpen !== "function") return true;
  if (!isLanguageDropdownMenuOpen(dropdown)) return true;

  if (typeof closeLanguageDropdownMenu === "function") {
    closeLanguageDropdownMenu(dropdown);
  }

  for (let attempt = 0; attempt < attempts; attempt++) {
    await delay(delayMs);
    if (!isLanguageDropdownMenuOpen(dropdown)) return true;
  }

  return false;
}

function formatLanguageSelectionMismatch(option, normalizedTarget) {
  return localize("clickedButDashboardShows", "Clicked $1, but the dashboard still shows $2.", [
    formatLanguageOption(option),
    getCurrentDashboardLocale() || normalizedTarget || localize("unknownLocale", "an unknown locale")
  ]);
}

async function selectDashboardLanguage(locale, selectionOptions = {}) {
  const normalizedTarget = normalizeLocale(locale);
  const expectedMode = getExpectedLanguageDropdownMode();
  const opened = await openLanguageDropdown(locale, expectedMode, selectionOptions);
  if (!opened.ok) return opened;
  const mode = opened.mode || expectedMode;
  const confirmationAttempts = Number.isFinite(selectionOptions.confirmationAttempts)
    ? Math.max(0, Math.floor(selectionOptions.confirmationAttempts))
    : 16;
  const confirmationDelayMs = Number.isFinite(selectionOptions.confirmationDelayMs)
    ? Math.max(0, selectionOptions.confirmationDelayMs)
    : 150;
  const acceptUnverifiedClick = Boolean(selectionOptions.acceptUnverifiedClick);

  let options = getLanguageOptionsForMode(opened, mode);
  let option = options.find(candidate => normalizeLocale(candidate.locale) === normalizedTarget) ||
    options.find(candidate => localesMatch(candidate.locale, normalizedTarget));

  if (!option) {
    await delay(300);
    options = getLanguageOptionsForMode(opened, mode);
    option = options.find(candidate => normalizeLocale(candidate.locale) === normalizedTarget) ||
      options.find(candidate => localesMatch(candidate.locale, normalizedTarget));
  }

  if (!option) {
    const currentLocale = getCurrentDashboardLocale();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return {
      ok: normalizeLocale(currentLocale) === normalizedTarget,
      message: localize("localeNotInDashboardMenu", "Could not find $1 in the dashboard language menu.", [locale])
    };
  }

  const activation = activateLanguageOptionForMode(option.element, mode);
  if (activation === "scrolled") {
    await delay(75);
    activateDropdownOption(option.element);
  }

  let retriedActivation = false;
  let pressedEnter = false;
  for (let attempt = 0; attempt <= confirmationAttempts; attempt++) {
    const currentDropdown = findLanguageDropdown(locale, expectedMode) || opened.dropdown;
    const currentLocale = currentDropdown ? getLanguageDropdownLocale(currentDropdown) : "";
    const menuOpen = typeof isLanguageDropdownMenuOpen === "function" && isLanguageDropdownMenuOpen(currentDropdown);
    if (currentLocale && localesMatch(currentLocale, normalizedTarget)) {
      if (menuOpen) {
        const closed = await waitForLanguageDropdownMenuClosed(currentDropdown);
        if (!closed) {
          return {
            ok: false,
            message: formatLanguageSelectionMismatch(option, normalizedTarget)
          };
        }
      }
      return {
        ok: true,
        verified: true,
        message: localize("selectedDashboardLanguage", "Selected $1.", [formatLanguageOption(option)])
      };
    }
    if (!currentLocale && currentDropdown && !isLanguageDropdownPlaceholder(currentDropdown) && !menuOpen) {
      return {
        ok: true,
        verified: false,
        message: localize("selectedDashboardLanguage", "Selected $1.", [formatLanguageOption(option)])
      };
    }
    if (menuOpen && !retriedActivation) {
      retriedActivation = true;
      scrollDropdownOptionIntoView(option.element);
      if (typeof activateDropdownOptionLegacy === "function") {
        activateDropdownOptionLegacy(option.element);
      }
      activateDropdownOption(option.element);
    } else if (menuOpen && !pressedEnter) {
      pressedEnter = true;
      if (typeof pressDropdownOptionEnter === "function") {
        pressDropdownOptionEnter(option.element);
      }
    }
    if (attempt < confirmationAttempts && confirmationDelayMs) {
      await delay(confirmationDelayMs);
    }
  }

  if (acceptUnverifiedClick) {
    const currentDropdown = findLanguageDropdown(locale, expectedMode) || opened.dropdown;
    const currentLocale = currentDropdown ? getLanguageDropdownLocale(currentDropdown) : "";
    if (currentLocale && !localesMatch(currentLocale, normalizedTarget)) {
      return {
        ok: false,
        message: formatLanguageSelectionMismatch(option, normalizedTarget)
      };
    }
    if (typeof isLanguageDropdownMenuOpen === "function" && isLanguageDropdownMenuOpen(currentDropdown)) {
      activateDropdownOption(option.element);
      if (typeof pressDropdownOptionEnter === "function") {
        pressDropdownOptionEnter(option.element);
      }
      const closed = await waitForLanguageDropdownMenuClosed(currentDropdown);
      if (!closed) {
        return {
          ok: false,
          message: formatLanguageSelectionMismatch(option, normalizedTarget)
        };
      }
    }

    return {
      ok: true,
      verified: false,
      message: localize("selectedDashboardLanguage", "Selected $1.", [formatLanguageOption(option)])
    };
  }

  return {
    ok: false,
    message: formatLanguageSelectionMismatch(option, normalizedTarget)
  };
}

async function fillDashboardLocale(locale, option = null) {
  const localeKey = getListingLocaleKey(locale);
  if (!localeKey) {
    return { ok: false, message: localize("noListingTextFor", "No listing text for $1.", [formatLanguageOption(option || locale)]) };
  }

  const field = findDescriptionField();
  if (!field) {
    return { ok: false, message: localize("descriptionFieldNotFound", "Could not find the Chrome Web Store description field.") };
  }

  fillElement(field, listings[localeKey]);
  selectedLocale = localeKey;
  return { ok: true, message: localize("filledLocale", "Filled $1.", [formatLanguageOption(option || localeKey)]) };
}

async function fillCurrentDashboardLanguage() {
  if (mediaOperationState.running) {
    return {
      ok: true,
      ignored: true,
      message: localize("mediaOperationAlreadyRunning", "Media operation already running: $1.", [mediaOperationState.label])
    };
  }

  await loadListings();

  const locale = getCurrentDashboardLocale();
  if (!locale) {
    return { ok: false, message: localize("currentDashboardLanguageNotDetected", "Could not detect the current dashboard language.") };
  }

  return fillDashboardLocale(locale);
}

async function fillAllDashboardLanguages(onProgress = null) {
  if (mediaOperationState.running) {
    return {
      ok: true,
      ignored: true,
      message: localize("mediaOperationAlreadyRunning", "Media operation already running: $1.", [mediaOperationState.label])
    };
  }

  await loadListings();

  if (fillAllAbortRequested) {
    return { ok: true, aborted: true, message: localize("stoppedFilledLanguages", "Stopped. Filled $1 dashboard language(s).", ["0"]) };
  }

  const localeKeys = Object.keys(listings).sort((a, b) => a.localeCompare(b));
  if (!localeKeys.length) {
    return { ok: false, message: localize("noProjectListingsImported", "No project listings imported.") };
  }

  const expectedMode = getExpectedLanguageDropdownMode();
  const firstOpen = await openLanguageDropdown(localeKeys[0], expectedMode);
  if (!firstOpen.ok) return firstOpen;

  const availableOptions = getLanguageOptionsForMode(firstOpen, firstOpen.mode || expectedMode);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await delay(150);

  const matchedLocaleKeys = new Set();
  const matchingOptions = availableOptions.reduce((options, option) => {
    const listingLocale = getListingLocaleKey(option.locale);
    if (!listingLocale || matchedLocaleKeys.has(listingLocale)) return options;

    matchedLocaleKeys.add(listingLocale);
    options.push({
      ...option,
      listingLocale
    });
    return options;
  }, []);
  const unmatchedLocaleKeys = localeKeys.filter(locale => !matchedLocaleKeys.has(locale));
  if (!matchingOptions.length) {
    return {
      ok: false,
      message: localize("noImportedLocalesMatchMenu", "No imported locales match the dashboard language menu.") +
        ` ${formatFillAllSummary(localeKeys.length, 0, unmatchedLocaleKeys)}`
    };
  }

  let filled = 0;
  const failed = [];

  function reportProgress(message) {
    publishFillAllStatus({
      running: true,
      message
    });
    if (onProgress) onProgress(message);
  }

  async function fillOptions(options, passName, action) {
    const nextFailed = [];

    for (let index = 0; index < options.length; index++) {
      const option = options[index];
      if (fillAllAbortRequested) {
        return { aborted: true, failed: nextFailed };
      }

      reportProgress(formatFillAllProgress(action, index + 1, options.length, option));
      const selection = await selectDashboardLanguage(option.locale);
      if (fillAllAbortRequested) {
        return { aborted: true, failed: nextFailed };
      }

      if (!selection.ok) {
        nextFailed.push({ ...option, error: selection.message, passName });
        continue;
      }

      await delay(250);
      const result = await fillDashboardLocale(option.locale, option);
      if (result.ok) {
        filled++;
      } else {
        nextFailed.push({ ...option, error: result.message, passName });
      }
    }

    return { aborted: false, failed: nextFailed };
  }

  const firstPass = await fillOptions(matchingOptions, "initial", localize("filling", "Filling"));
  if (firstPass.aborted) {
    return {
      ok: true,
      aborted: true,
      message: localize("stoppedFilledLanguages", "Stopped. Filled $1 dashboard language(s).", [String(filled)])
    };
  }

  let remainingFailed = firstPass.failed;
  if (remainingFailed.length) {
    await delay(500);
    const retryPass = await fillOptions(remainingFailed, "retry", localize("retrying", "Retrying"));
    if (retryPass.aborted) {
      const failedNames = remainingFailed.map(formatLanguageOption).join(", ");
      return {
        ok: true,
        aborted: true,
        message: failedNames
          ? localize("stoppedFilledLanguagesPending", "Stopped. Filled $1 dashboard language(s); still pending: $2.", [String(filled), failedNames])
          : localize("stoppedFilledLanguages", "Stopped. Filled $1 dashboard language(s).", [String(filled)])
      };
    }
    remainingFailed = retryPass.failed;
  }

  const failedNames = remainingFailed.map(formatLanguageOption).join(", ");
  const retryRecoveredCount = firstPass.failed.length - remainingFailed.length;
  const retryNote = retryRecoveredCount > 0
    ? ` ${localize("recoveredAfterRetry", "Recovered $1 after retry.", [String(retryRecoveredCount)])}`
    : (firstPass.failed.length ? ` ${localize("retriedNoneRecovered", "Retried $1; none recovered.", [String(firstPass.failed.length)])}` : "");
  const summaryNote = ` ${formatFillAllSummary(
    localeKeys.length,
    matchingOptions.length,
    unmatchedLocaleKeys
  )}`;

  return {
    ok: filled > 0 && remainingFailed.length === 0,
    message: (remainingFailed.length
      ? localize("filledLanguagesFailed", "Filled $1 dashboard language(s); failed $2: $3.", [String(filled), String(remainingFailed.length), failedNames])
      : localize("filledLanguages", "Filled $1 dashboard language(s).", [String(filled)])) + retryNote + summaryNote
  };
}
