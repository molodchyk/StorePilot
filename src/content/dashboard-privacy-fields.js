function getPrivacyFieldContextText(element) {
  const parts = [getElementLabelText(element)];
  const containers = [
    element.closest("label"),
    element.closest(".TVM7Wc"),
    element.closest(".n5L2Mb")
  ].filter(Boolean);

  containers.forEach(container => {
    const clone = container.cloneNode(true);
    clone.querySelectorAll("textarea,input,[role='textbox']").forEach(control => {
      control.remove();
    });
    parts.push(getVisibleText(clone));
  });

  return normalizePrivacyMatchText(parts.join(" "));
}

function getPrivacyFieldCandidates() {
  return Array.from(document.querySelectorAll([
    "textarea",
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
        context: getPrivacyFieldContextText(element),
        payload: element.getAttribute("data-payload") || "",
        maxLength: Number(element.getAttribute("maxlength") || 0),
        required: element.hasAttribute("required"),
        tagName: element.tagName.toLowerCase(),
        area: rect.width * rect.height
      };
    });
}

function normalizePrivacyPayload(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getExpectedPrivacyPayloads(key) {
  if (key === "single_purpose") return ["singlepurpose", "singlepurposejustification"];
  if (key === "privacy_policy_url") return ["privacypolicyurl", "privacypolicy"];
  if (key === "host_permission") return ["hostpermission", "hostpermissions", "hostpermissionjustification"];
  if (key === "remote_code") return ["remotecode"];
  if (key === "remote_code_justification") return ["remotecodejustification"];

  const permissionMatch = key.match(/^permission\.(.+)$/);
  return permissionMatch ? [normalizePrivacyPayload(permissionMatch[1])] : [];
}

function isNumericPrivacyPayload(payload) {
  return /^\d+$/.test(String(payload || "").trim());
}

function escapePrivacyRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitPrivacyPermissionWords(permission) {
  return String(permission || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .map(part => normalizePrivacyMatchText(part))
    .filter(Boolean);
}

function permissionContextMatches(candidate, permission) {
  const context = candidate.context;
  const words = splitPrivacyPermissionWords(permission);
  const compactPermission = normalizePrivacyPayload(permission);
  const compactContext = normalizePrivacyPayload(context);

  if (!compactPermission) return false;
  if (new RegExp(`\\b${escapePrivacyRegex(normalizePrivacyMatchText(permission))}\\b`).test(context)) return true;
  if (words.length > 1 && new RegExp(`\\b${words.map(escapePrivacyRegex).join("\\s+")}\\b`).test(context)) return true;
  return compactContext.includes(compactPermission);
}

function scorePrivacyFieldCandidate(candidate, key) {
  const context = candidate.context;
  const permissionMatch = key.match(/^permission\.(.+)$/);
  const payload = normalizePrivacyPayload(candidate.payload);
  const expectedPayloads = getExpectedPrivacyPayloads(key);
  const payloadMatched = Boolean(payload && expectedPayloads.includes(payload));
  let score = 0;

  if (payload) {
    if (payloadMatched) {
      score += 300;
    } else if (isNumericPrivacyPayload(candidate.payload)) {
      score += 20;
    } else {
      return 0;
    }
  }

  if (key === "single_purpose") {
    if (/\bsingle purpose\b/.test(context)) score += 120;
    if (/alleinigen zweck|alleiniger zweck|alleinige zweck|zweck des artikels/.test(context)) score += 120;
    if (/beschreibung/.test(context) && /zweck/.test(context)) score += 70;
    if (/\bpurpose\b/.test(context) && /\bdescription\b/.test(context)) score += 70;
    if (candidate.tagName === "textarea") score += 25;
    if (candidate.required) score += 15;
    if (candidate.maxLength >= 900 && candidate.maxLength <= 1200) score += 35;
    if (candidate.area > 30000) score += 15;
  } else if (key === "privacy_policy_url") {
    if (/privacy policy|datenschutzerklarung|datenschutzrichtlinie/.test(context)) score += 100;
    if (/\burl\b|link/.test(context)) score += 35;
    if (candidate.tagName === "input") score += 25;
  } else if (key === "host_permission") {
    if (/host permission|hostberechtigung|host berechtigung|host permissions/.test(context)) score += 120;
    if (/begrundung|justification|berechtigung/.test(context)) score += 35;
    if (candidate.tagName === "textarea") score += 20;
  } else if (key === "remote_code") {
    if (/remote code|remotecode|remote.*code|extern.*code|ausgelagert.*code/.test(context)) score += 120;
  } else if (key === "remote_code_justification") {
    if (/remote code|remotecode|remote.*code|extern.*code|ausgelagert.*code/.test(context)) score += 120;
    if (/begrundung|justification|erklarung|reason|rationale|explanation/.test(context)) score += 35;
    if (candidate.tagName === "textarea") score += 20;
  } else if (permissionMatch) {
    const permission = permissionMatch[1];
    if (!payloadMatched && !permissionContextMatches(candidate, permission)) return 0;

    if (permissionContextMatches(candidate, permission)) score += 110;
    if (/permission|berechtigung|berechtigungen/.test(context)) score += 40;
    if (/begrundung|justification|warum|why/.test(context)) score += 25;
    if (candidate.tagName === "textarea") score += 15;
  }

  return score;
}

function findPrivacyField(key) {
  const candidates = getPrivacyFieldCandidates()
    .map(candidate => ({
      ...candidate,
      score: scorePrivacyFieldCandidate(candidate, key)
    }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || b.area - a.area || a.index - b.index);

  return candidates[0] && candidates[0].score >= 80 ? candidates[0] : null;
}

function isDisabledEditableElement(element) {
  return Boolean(
    !element ||
    element.disabled ||
    element.readOnly ||
    element.getAttribute("aria-disabled") === "true" ||
    element.closest("[aria-disabled='true']")
  );
}

function getContextAroundElement(element) {
  if (!element) return "";
  const containers = [
    element.closest("label"),
    element.closest(".TVM7Wc"),
    element.closest(".n5L2Mb"),
    element.closest("section")
  ].filter(Boolean);

  return normalizePrivacyMatchText(containers.map(getVisibleText).join(" "));
}

function getPrivacyRadioControl(input) {
  return input && (
    input.closest(".VfPpkd-GCYh9b") ||
    input.closest(".VfPpkd-dgl2Hf-ppHlrf-sM5MNb") ||
    input.closest("[role='radio']") ||
    input.closest("label") ||
    input
  );
}

function isPrivacyRadioChecked(input) {
  return Boolean(
    input &&
    (input.checked || input.getAttribute("aria-checked") === "true" ||
      (input.closest("[aria-checked]") && input.closest("[aria-checked]").getAttribute("aria-checked") === "true"))
  );
}

function normalizeRemoteCodeRadioValue(input) {
  const value = String(input && (input.value || input.getAttribute("data-value") || input.getAttribute("aria-label")) || "")
    .trim()
    .toLowerCase();
  if (value === "true" || value === "yes") return "yes";
  if (value === "false" || value === "no") return "no";

  const context = getContextAroundElement(input);
  if (/\byes\b|\bja\b/.test(context) && /remote ?code|remotecode/.test(context)) return "yes";
  if (/\bno\b|nein/.test(context) && /remote ?code|remotecode/.test(context)) return "no";
  return "";
}

function getRemoteCodeRadioGroup() {
  const radios = Array.from(document.querySelectorAll("input[type='radio'], [role='radio']"))
    .map((input, index) => {
      const control = getPrivacyRadioControl(input);
      const value = normalizeRemoteCodeRadioValue(input);
      return {
        input,
        control,
        value,
        index,
        groupKey: input.name || input.getAttribute("name") || input.getAttribute("aria-controls") || `radio-${index}`,
        context: getContextAroundElement(input),
        visible: isVisible(control) || isVisible(input)
      };
    })
    .filter(item => item.visible && (item.value === "yes" || item.value === "no"));

  const groups = [];
  radios.forEach(item => {
    let group = groups.find(candidate => candidate.groupKey === item.groupKey);
    if (!group) {
      group = {
        groupKey: item.groupKey,
        rows: [],
        yes: null,
        no: null,
        context: ""
      };
      groups.push(group);
    }
    group.rows.push(item);
    group[item.value] = item;
    group.context = normalizePrivacyMatchText(`${group.context} ${item.context}`);
  });

  const completeGroups = groups
    .filter(group => group.yes && group.no)
    .map(group => ({
      ...group,
      score: (/remote ?code|remotecode|extern.*code|ausgelagert.*code/.test(group.context) ? 100 : 0) +
        (groups.length === 1 ? 30 : 0) +
        (group.rows.length === 2 ? 20 : 0)
    }))
    .sort((a, b) => b.score - a.score);

  const best = completeGroups[0];
  return best && best.score >= 80 ? best : null;
}

function setPrivacyRadioChecked(item) {
  const input = item && item.input ? item.input : item;
  if (!input) return false;
  if (isPrivacyRadioChecked(input)) return true;

  const control = getPrivacyRadioControl(input);
  activateDashboardButton(control);
  if (isPrivacyRadioChecked(input)) return true;

  input.click();
  if (isPrivacyRadioChecked(input)) return true;

  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked");
  const sameName = input.name
    ? Array.from(document.querySelectorAll(`input[type='radio'][name='${CSS.escape(input.name)}']`))
    : [];
  sameName.forEach(other => {
    if (other !== input) {
      if (descriptor && typeof descriptor.set === "function") descriptor.set.call(other, false);
      else other.checked = false;
    }
  });
  if (descriptor && typeof descriptor.set === "function") descriptor.set.call(input, true);
  else input.checked = true;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));

  return isPrivacyRadioChecked(input);
}

function getPrivacyFieldFillValue(key, value) {
  if (key !== "privacy_policy_url") return value;

  const raw = String(value || "").trim();
  const firstUrl = raw.match(/https?:\/\/\S+/i);
  let url = firstUrl ? firstUrl[0] : raw.split(/\r?\n/).map(line => line.trim()).find(Boolean) || "";
  const markerIndex = url.search(/(?:data_usage(?:\.[A-Za-z0-9_.-]+)?|certification(?:\.[A-Za-z0-9_.-]+)?|certification_\d+|single_purpose|host_permission|remote_code(?:_justification)?|privacy_policy_url|permission\.[A-Za-z0-9_.-]+)\s*:/i);

  if (markerIndex > 0) {
    url = url.slice(0, markerIndex);
  }

  return url.replace(/[),;]+$/g, "").trim();
}

function getRemoteCodeDecision(value) {
  const raw = String(value || "").trim();
  const normalized = normalizePrivacyBooleanValue(raw);
  if (normalized === "yes" || normalized === "no" || normalized === "") {
    return {
      decision: normalized,
      legacyJustification: ""
    };
  }

  const matchText = normalizePrivacyMatchText(raw);
  const negative = (
    /does not (load|use|include|execute|eval|reference).*remote code/.test(matchText) ||
    /remote code.*(not used|not loaded|not included|not requested|none|no)/.test(matchText) ||
    /\bno remote code\b/.test(matchText) ||
    /remote scripts?.*(not used|not loaded|none|no)/.test(matchText) ||
    /all extension code.*packaged locally/.test(matchText) ||
    /code.*packaged locally/.test(matchText)
  );

  if (negative) {
    return {
      decision: "no",
      legacyJustification: ""
    };
  }

  return {
    decision: raw ? "yes" : "",
    legacyJustification: raw
  };
}

function getRemoteCodeJustificationValue(fields, decisionResult) {
  const explicit = String(fields.remote_code_justification || "").trim();
  if (explicit) return explicit;
  return decisionResult && decisionResult.decision === "yes" ? decisionResult.legacyJustification : "";
}

function isPrivacyDataUsageKey(key) {
  return PRIVACY_DATA_USAGE_KEYS.includes(key) || PRIVACY_CERTIFICATION_KEYS.includes(key);
}

function getVisiblePrivacyFieldKeys(fields) {
  const privacyFields = fields || {};
  const remoteCodeDecision = getRemoteCodeDecision(privacyFields.remote_code).decision;
  const includeRemoteCodeJustification = remoteCodeDecision === "yes";
  const keys = Object.keys(privacyFields).filter(key => (
    !isPrivacyDataUsageKey(key) &&
    key !== "remote_code" &&
    key !== "remote_code_justification"
  ));
  const permissionKeys = keys.filter(key => key.startsWith("permission.")).sort((a, b) => a.localeCompare(b));
  const preferredOrder = [
    "single_purpose"
  ];
  const hostPermissionOrder = keys.includes("host_permission") ? ["host_permission"] : [];

  const remoteCodeOrder = [];
  if (Object.prototype.hasOwnProperty.call(privacyFields, "remote_code")) {
    remoteCodeOrder.push("remote_code");
  }
  if (includeRemoteCodeJustification) {
    remoteCodeOrder.push("remote_code_justification");
  }

  const ordered = preferredOrder.filter(key => keys.includes(key))
    .concat(permissionKeys)
    .concat(hostPermissionOrder)
    .concat(keys.filter(key => (
      !preferredOrder.includes(key) &&
      !permissionKeys.includes(key) &&
      key !== "host_permission" &&
      key !== "privacy_policy_url"
    )).sort((a, b) => a.localeCompare(b)))
    .concat(remoteCodeOrder);

  if (keys.includes("privacy_policy_url")) ordered.push("privacy_policy_url");
  return ordered;
}

function getPrivacyDataUsageFieldKeys(fields) {
  const privacyFields = fields || {};
  const expected = new Set([...PRIVACY_DATA_USAGE_KEYS, ...PRIVACY_CERTIFICATION_KEYS]);
  return Object.keys(privacyFields).filter(key => expected.has(key));
}

function fillRemoteCodePrivacyField() {
  const fields = getActivePrivacyFields();
  const decisionResult = getRemoteCodeDecision(fields.remote_code);

  if (!decisionResult.decision) {
    return { ok: false, message: localize("privacyNoValueForField", "No privacy document value for $1.", ["remote_code"]) };
  }

  const radioGroup = getRemoteCodeRadioGroup();
  if (!radioGroup) {
    return { ok: false, message: localize("privacyFieldNotFound", "Could not find privacy field: $1", ["remote_code"]) };
  }

  const radio = decisionResult.decision === "yes" ? radioGroup.yes : radioGroup.no;
  if (!setPrivacyRadioChecked(radio)) {
    return { ok: false, message: localize("privacyFieldDidNotAcceptValue", "Privacy field did not accept value: $1.", ["remote_code"]) };
  }

  if (decisionResult.decision === "no") {
    return {
      ok: true,
      message: localize("privacyFilledField", "Filled privacy field: $1.", ["remote_code"]),
      key: "remote_code",
      decision: "no"
    };
  }

  const justification = getRemoteCodeJustificationValue(fields, decisionResult);
  if (!justification) {
    return { ok: false, message: localize("privacyNoValueForField", "No privacy document value for $1.", ["remote_code_justification"]) };
  }

  const target = findPrivacyField("remote_code_justification");
  if (!target || isDisabledEditableElement(target.element)) {
    return { ok: false, message: localize("privacyFieldNotFound", "Could not find privacy field: $1.", ["remote_code_justification"]) };
  }

  if (!fillElement(target.element, justification)) {
    return { ok: false, message: localize("privacyFieldDidNotAcceptValue", "Privacy field did not accept value: $1.", ["remote_code_justification"]) };
  }

  const expected = normalizeFilledFormValue(justification);
  const actual = normalizeFilledFormValue(getEditableElementValue(target.element));
  if (actual !== expected) {
    return {
      ok: false,
      message: localize("privacyFieldDidNotAcceptValue", "Privacy field did not accept value: $1.", ["remote_code_justification"]),
      key: "remote_code_justification",
      score: target.score,
      actualLength: actual.length,
      expectedLength: expected.length
    };
  }

  return {
    ok: true,
    message: localize("privacyFilledField", "Filled privacy field: $1.", ["remote_code"]),
    key: "remote_code",
    decision: "yes",
    score: target.score
  };
}

function fillPrivacyField(key) {
  const fields = getActivePrivacyFields();
  if (key === "remote_code") {
    return fillRemoteCodePrivacyField();
  }

  const value = getPrivacyFieldFillValue(key, fields[key]);

  if (!value) {
    return { ok: false, message: localize("privacyNoValueForField", "No privacy document value for $1.", [key]) };
  }

  const target = findPrivacyField(key);

  if (!target) {
    return { ok: false, message: localize("privacyFieldNotFound", "Could not find privacy field: $1.", [key]) };
  }

  if (!fillElement(target.element, value)) {
    return { ok: false, message: localize("privacyFieldDidNotAcceptValue", "Privacy field did not accept value: $1.", [key]) };
  }

  const expected = normalizeFilledFormValue(value);
  const actual = normalizeFilledFormValue(getEditableElementValue(target.element));
  if (actual !== expected) {
    return {
      ok: false,
      message: localize("privacyFieldDidNotAcceptValue", "Privacy field did not accept value: $1.", [key]),
      key,
      score: target.score,
      actualLength: actual.length,
      expectedLength: expected.length
    };
  }

  return {
    ok: true,
    message: localize("privacyFilledField", "Filled privacy field: $1.", [key]),
    key,
    score: target.score
  };
}

function fillPrivacyFields(keys) {
  const fields = getActivePrivacyFields();
  if (!Object.keys(fields).length) {
    return { ok: false, message: localize("privacyDocNotImported", "No privacy document imported for the active project.") };
  }

  const filled = [];
  const missing = [];
  const skipped = [];

  keys.forEach(key => {
    if (!fields[key]) return;

    const result = fillPrivacyField(key);
    if (result.skipped) {
      skipped.push(key);
    } else if (result.ok) {
      filled.push(key);
    } else {
      missing.push(key);
    }
  });

  return {
    ok: filled.length > 0 || skipped.length > 0,
    message: [
      filled.length ? localize("privacyFilledFields", "Filled $1 privacy field(s): $2.", [String(filled.length), filled.join(", ")]) : "",
      skipped.length ? localize("privacySkippedFields", "Skipped $1 privacy field(s): $2.", [String(skipped.length), skipped.join(", ")]) : "",
      missing.length ? localize("privacyFieldsNotFound", "Could not find: $1.", [missing.join(", ")]) : ""
    ].filter(Boolean).join(" ") || localize("privacyNoSupportedFields", "No supported privacy fields were available to fill."),
    filled,
    missing,
    skipped
  };
}

function fillDetectedPrivacyFields() {
  return fillPrivacyFields(getVisiblePrivacyFieldKeys(getActivePrivacyFields()).filter(key => key !== "remote_code_justification"));
}

function getPrivacyDiagnostics() {
  const fields = getActivePrivacyFields();
  const dataUsageMap = getPrivacyDataUsageCheckboxMap();
  return {
    hasPrivacyDoc: Boolean(activePrivacyDoc && activePrivacyDoc.file),
    privacyDocPath: activePrivacyDoc && activePrivacyDoc.file ? activePrivacyDoc.file.path : "",
    privacyDocKeys: Object.keys(fields),
    dataUsageCheckboxes: dataUsageMap.ok ? dataUsageMap.diagnostics : {
      ok: false,
      ...(dataUsageMap.diagnostics || {})
    },
    fieldCandidates: getPrivacyFieldCandidates().map(candidate => ({
      index: candidate.index,
      tagName: candidate.tagName,
      payload: candidate.payload,
      maxLength: candidate.maxLength,
      required: candidate.required,
      contextSample: candidate.context.slice(0, 220),
      scores: Object.keys(fields).reduce((scores, key) => ({
        ...scores,
        [key]: scorePrivacyFieldCandidate(candidate, key)
      }), {})
    }))
  };
}
