#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_TOP_LIMIT = 40;

function usage() {
  return [
    "Usage:",
    "  node scripts/analyze-localized-screenshot-log.js <log.json> [--out report.md] [--observed observed.json] [--top 40] [--report full|per-slot]",
    "",
    "Observed JSON shape:",
    "  { \"hy\": [1, 2], \"nl\": [2] }",
    "  or { \"hy\": { \"presentSlots\": [1, 2] } }"
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    logPath: "",
    outPath: "",
    observedPath: "",
    top: DEFAULT_TOP_LIMIT,
    report: "full"
  };

  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === "--out") {
      args.outPath = argv[++index] || "";
    } else if (value === "--observed") {
      args.observedPath = argv[++index] || "";
    } else if (value === "--top") {
      args.top = Math.max(1, Number.parseInt(argv[++index], 10) || DEFAULT_TOP_LIMIT);
    } else if (value === "--report") {
      args.report = argv[++index] || "full";
      if (!["full", "per-slot"].includes(args.report)) {
        throw new Error(`Unsupported report type: ${args.report}`);
      }
    } else if (!args.logPath) {
      args.logPath = value;
    } else {
      throw new Error(`Unexpected argument: ${value}`);
    }
  }

  if (!args.logPath) {
    throw new Error(usage());
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeLocale(value) {
  return String(value || "").trim().replace(/-/g, "_").toLowerCase();
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeObservedState(rawObserved = {}) {
  const observed = {};
  for (const [locale, value] of Object.entries(rawObserved || {})) {
    const normalizedLocale = normalizeLocale(locale);
    if (!normalizedLocale) continue;
    const slots = Array.isArray(value)
      ? value
      : Array.isArray(value && value.presentSlots)
        ? value.presentSlots
        : [];
    observed[normalizedLocale] = new Set(slots
      .map(slot => Number(slot))
      .filter(slot => Number.isInteger(slot) && slot > 0));
  }
  return observed;
}

function normalizeEvent(event, index) {
  const epochMs = Number(event && event.epochMs || 0);
  return {
    index,
    sequence: Number(event && event.sequence || 0),
    epochMs,
    isoTime: event && event.isoTime || (epochMs ? new Date(epochMs).toISOString() : ""),
    receivedAtMs: Number(event && event.receivedAtMs || 0),
    elapsedMs: Number(event && event.elapsedMs || 0),
    runId: event && event.runId || "",
    workerId: event && event.workerId || "",
    tabId: Number(event && event.tabId || 0),
    operation: event && event.operation || "",
    locale: normalizeLocale(event && event.locale || ""),
    localeIndex: Number(event && event.localeIndex || 0),
    totalLocales: Number(event && event.totalLocales || 0),
    localeScreenshotCount: Number(event && event.localeScreenshotCount || 0),
    action: event && event.action || "",
    stage: event && event.stage || "",
    attempt: Number(event && event.attempt || 0),
    screenshotSlot: Number(event && event.screenshotSlot || 0),
    targetSlot: Number(event && event.targetSlot || 0),
    visibleBefore: numberOrNull(event && event.visibleBefore),
    visibleAfter: numberOrNull(event && event.visibleAfter),
    addedCount: numberOrNull(event && event.addedCount),
    removedCount: numberOrNull(event && event.removedCount),
    durationMs: numberOrNull(event && event.durationMs),
    outcome: event && event.outcome || "",
    method: event && event.method || "",
    buttonLabel: event && event.buttonLabel || "",
    fileName: event && event.fileName || "",
    fileSize: Number(event && event.fileSize || 0),
    fileType: event && event.fileType || "",
    errorMessage: event && event.errorMessage || "",
    message: event && event.message || ""
  };
}

function loadActionEvents(log) {
  return (log.actionLog || [])
    .map(normalizeEvent)
    .filter(event => event.epochMs && event.action && event.stage)
    .sort((left, right) => left.epochMs - right.epochMs || left.sequence - right.sequence || left.index - right.index);
}

function eventSlot(event) {
  return Number(event.screenshotSlot || event.targetSlot || 0);
}

function formatTime(event) {
  if (!event || !event.isoTime) return "";
  const match = event.isoTime.match(/T(\d\d:\d\d:\d\d\.\d\d\d)Z?$/);
  return match ? match[1] : event.isoTime;
}

function formatEvent(event) {
  if (!event) return "";
  const slot = eventSlot(event);
  return [
    formatTime(event),
    event.workerId,
    event.locale,
    `${event.action}:${event.stage}`,
    slot ? `slot ${slot}` : "",
    event.outcome ? event.outcome : "",
    Number.isFinite(event.durationMs) ? `${event.durationMs}ms` : ""
  ].filter(Boolean).join(" ");
}

function formatCompactEvent(event) {
  if (!event) return "";
  const slot = eventSlot(event);
  const result = event.stage === "result" && event.outcome
    ? `/${event.outcome}`
    : "";
  return [
    event.workerId,
    event.locale,
    slot ? `#${slot}` : "",
    `${event.action}:${event.stage}${result}`
  ].filter(Boolean).join(" ");
}

function formatSignedGap(reference, event) {
  if (!reference || !event) return "";
  const gap = event.epochMs - reference.epochMs;
  return `${gap >= 0 ? "+" : ""}${gap}ms ${formatCompactEvent(event)}`;
}

function percentile(values, p) {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!finite.length) return null;
  const index = Math.min(finite.length - 1, Math.max(0, Math.ceil((p / 100) * finite.length) - 1));
  return finite[index];
}

function summarizeNumbers(values) {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!finite.length) {
    return { count: 0, min: null, median: null, p90: null, max: null, avg: null };
  }
  return {
    count: finite.length,
    min: finite[0],
    median: percentile(finite, 50),
    p90: percentile(finite, 90),
    max: finite[finite.length - 1],
    avg: Math.round(finite.reduce((sum, value) => sum + value, 0) / finite.length)
  };
}

function formatNumber(value) {
  return Number.isFinite(value) ? String(value) : "";
}

function formatStats(stats) {
  if (!stats || !stats.count) return "0 count";
  return `${stats.count} count, min ${stats.min}ms, median ${stats.median}ms, p90 ${stats.p90}ms, max ${stats.max}ms, avg ${stats.avg}ms`;
}

function countBy(items, getKey) {
  const counts = {};
  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((left, right) => left[0].localeCompare(right[0])));
}

function createAdjacentPairs(events) {
  const pairs = [];
  for (let index = 1; index < events.length; index++) {
    const previous = events[index - 1];
    const current = events[index];
    pairs.push({
      previous,
      current,
      gapMs: current.epochMs - previous.epochMs,
      sameWorker: current.workerId === previous.workerId,
      sameLocale: current.locale === previous.locale,
      bothAttempts: current.stage === "attempt" && previous.stage === "attempt",
      bothResults: current.stage === "result" && previous.stage === "result"
    });
  }
  return pairs;
}

function findNearestEvent(events, reference, predicate, direction) {
  let nearest = null;
  for (const event of events) {
    if (event === reference || !predicate(event)) continue;
    const delta = event.epochMs - reference.epochMs;
    if ((direction < 0 && delta >= 0) || (direction > 0 && delta <= 0)) continue;
    if (!nearest || Math.abs(delta) < Math.abs(nearest.epochMs - reference.epochMs)) {
      nearest = event;
    }
  }
  return nearest;
}

function findAdjacentEvent(events, reference, predicate, direction) {
  const referenceIndex = events.indexOf(reference);
  if (referenceIndex < 0) return null;
  for (
    let index = referenceIndex + direction;
    index >= 0 && index < events.length;
    index += direction
  ) {
    const event = events[index];
    if (predicate(event)) return event;
  }
  return null;
}

function findUploadAttemptForResult(events, result) {
  return events.find(event => (
    event.action === result.action &&
    event.stage === "attempt" &&
    event.workerId === result.workerId &&
    event.locale === result.locale &&
    event.attempt === result.attempt &&
    eventSlot(event) === eventSlot(result) &&
    event.epochMs <= result.epochMs
  )) || null;
}

function gapBetween(left, right) {
  if (!left || !right) return null;
  return Math.abs(left.epochMs - right.epochMs);
}

function computeRiskScore(row) {
  let score = 0;
  const minGap = row.minAnyNeighborGapMs;
  if (Number.isFinite(minGap)) {
    if (minGap < 1000) score += 10;
    else if (minGap < 2000) score += 8;
    else if (minGap < 3000) score += 6;
    else if (minGap < 5000) score += 4;
    else if (minGap < 8000) score += 2;
  }
  if (Number.isFinite(row.minOtherWorkerGapMs)) {
    if (row.minOtherWorkerGapMs < 1000) score += 8;
    else if (row.minOtherWorkerGapMs < 2000) score += 6;
    else if (row.minOtherWorkerGapMs < 3000) score += 4;
    else if (row.minOtherWorkerGapMs < 5000) score += 2;
  }
  if (row.otherWorkerEventsDuringWindow > 0) {
    score += Math.min(6, row.otherWorkerEventsDuringWindow * 2);
  }
  if (Number.isFinite(row.sameWorkerNextAfterResultGapMs)) {
    if (row.sameWorkerNextAfterResultGapMs < 500) score += 6;
    else if (row.sameWorkerNextAfterResultGapMs < 1000) score += 4;
    else if (row.sameWorkerNextAfterResultGapMs < 3000) score += 2;
  }
  if (row.outcome && row.outcome !== "added" && row.outcome !== "removed") score += 6;
  if (row.error) score += 6;
  if (row.observedMissing) score += 20;
  return score;
}

function analyzeResultEvents(events, observed = {}) {
  const resultRows = [];
  const results = events.filter(event => event.stage === "result");

  for (const result of results) {
    const attempt = findUploadAttemptForResult(events, result);
    const windowStart = attempt || result;
    const otherWorkerEventsDuringWindow = events.filter(event => (
      event.workerId !== result.workerId &&
      event.epochMs >= windowStart.epochMs &&
      event.epochMs <= result.epochMs
    ));
    const sameWorkerNextAfterResult = findNearestEvent(
      events,
      result,
      event => event.workerId === result.workerId && event.stage === "attempt",
      1
    );
    const otherWorkerPreviousAttempt = findNearestEvent(
      events,
      windowStart,
      event => event.workerId !== result.workerId && event.stage === "attempt",
      -1
    );
    const otherWorkerNextAttempt = findNearestEvent(
      events,
      windowStart,
      event => event.workerId !== result.workerId && event.stage === "attempt",
      1
    );
    const otherWorkerPreviousResult = findNearestEvent(
      events,
      result,
      event => event.workerId !== result.workerId && event.stage === "result",
      -1
    );
    const otherWorkerNextResult = findNearestEvent(
      events,
      result,
      event => event.workerId !== result.workerId && event.stage === "result",
      1
    );
    const previousAnyEvent = findNearestEvent(events, windowStart, () => true, -1);
    const nextAnyEvent = findNearestEvent(events, windowStart, () => true, 1);
    const observedSlots = observed[result.locale] || null;
    const slot = eventSlot(result);
    const observedMissing = Boolean(
      observedSlots &&
      slot &&
      (result.outcome === "added" || result.outcome === "removed") &&
      !observedSlots.has(slot)
    );
    const minOtherWorkerGapMs = Math.min(
      gapBetween(windowStart, otherWorkerPreviousAttempt) ?? Infinity,
      gapBetween(windowStart, otherWorkerNextAttempt) ?? Infinity,
      gapBetween(result, otherWorkerPreviousResult) ?? Infinity,
      gapBetween(result, otherWorkerNextResult) ?? Infinity
    );
    const minAnyNeighborGapMs = Math.min(
      gapBetween(windowStart, previousAnyEvent) ?? Infinity,
      gapBetween(windowStart, nextAnyEvent) ?? Infinity
    );

    const row = {
      result,
      attempt,
      locale: result.locale,
      slot,
      workerId: result.workerId,
      action: result.action,
      outcome: result.outcome,
      error: result.errorMessage || result.message || "",
      durationMs: result.durationMs,
      visibleTransition: `${result.visibleBefore ?? ""}->${result.visibleAfter ?? ""}`,
      attemptTime: formatTime(windowStart),
      resultTime: formatTime(result),
      otherWorkerEventsDuringWindow,
      otherWorkerPreviousAttempt,
      otherWorkerNextAttempt,
      otherWorkerPreviousResult,
      otherWorkerNextResult,
      sameWorkerNextAfterResult,
      sameWorkerNextAfterResultGapMs: gapBetween(result, sameWorkerNextAfterResult),
      minOtherWorkerGapMs: Number.isFinite(minOtherWorkerGapMs) ? minOtherWorkerGapMs : null,
      minAnyNeighborGapMs: Number.isFinite(minAnyNeighborGapMs) ? minAnyNeighborGapMs : null,
      observedMissing
    };
    row.riskScore = computeRiskScore(row);
    resultRows.push(row);
  }

  return resultRows.sort((left, right) => (
    right.riskScore - left.riskScore ||
    (left.minAnyNeighborGapMs ?? Infinity) - (right.minAnyNeighborGapMs ?? Infinity) ||
    (left.result.epochMs - right.result.epochMs)
  ));
}

function getLoggedAddedSlotsByLocale(events) {
  const byLocale = {};
  for (const event of events) {
    if (event.action !== "upload" || event.stage !== "result" || event.outcome !== "added") continue;
    if (!byLocale[event.locale]) byLocale[event.locale] = new Set();
    byLocale[event.locale].add(event.screenshotSlot);
  }
  return byLocale;
}

function buildObservedMismatchRows(events, observed) {
  const logged = getLoggedAddedSlotsByLocale(events);
  const rows = [];
  for (const [locale, presentSlots] of Object.entries(observed)) {
    const loggedSlots = logged[locale] || new Set();
    const missingLoggedSlots = Array.from(loggedSlots)
      .filter(slot => !presentSlots.has(slot))
      .sort((left, right) => left - right);
    const unexpectedSlots = Array.from(presentSlots)
      .filter(slot => !loggedSlots.has(slot))
      .sort((left, right) => left - right);
    rows.push({
      locale,
      presentSlots: Array.from(presentSlots).sort((left, right) => left - right),
      loggedSlots: Array.from(loggedSlots).sort((left, right) => left - right),
      missingLoggedSlots,
      unexpectedSlots
    });
  }
  return rows.sort((left, right) => left.locale.localeCompare(right.locale));
}

function buildPerSlotPersistenceRows(events, observed) {
  const rows = [];
  for (const [locale, presentSlots] of Object.entries(observed)) {
    const localeEvents = events.filter(event => event.locale === locale);
    const slots = new Set([
      ...Array.from(presentSlots),
      ...localeEvents.map(eventSlot).filter(Boolean)
    ]);

    for (const slot of Array.from(slots).sort((left, right) => left - right)) {
      const slotResults = localeEvents.filter(event => event.stage === "result" && eventSlot(event) === slot);
      if (!slotResults.length) continue;
      const addedResult = slotResults
        .slice()
        .reverse()
        .find(event => event.outcome === "added");
      const result = addedResult || slotResults[slotResults.length - 1];
      const attempt = findUploadAttemptForResult(events, result);
      const windowStart = attempt || result;
      const previousAttempt = findNearestEvent(
        events,
        windowStart,
        event => event.stage === "attempt",
        -1
      );
      const nextAttempt = findNearestEvent(
        events,
        windowStart,
        event => event.stage === "attempt",
        1
      );
      const previousResult = findNearestEvent(
        events,
        result,
        event => event.stage === "result",
        -1
      );
      const nextResult = findNearestEvent(
        events,
        result,
        event => event.stage === "result",
        1
      );
      const previousAction = findAdjacentEvent(events, result, () => true, -1);
      const nextAction = findAdjacentEvent(events, result, () => true, 1);
      const otherWorkerEventsDuringWindow = events.filter(event => (
        event.workerId !== result.workerId &&
        event.epochMs >= windowStart.epochMs &&
        event.epochMs <= result.epochMs
      ));
      const errors = slotResults
        .filter(event => event.errorMessage || event.message)
        .map(event => `attempt ${event.attempt}: ${event.errorMessage || event.message}`);

      rows.push({
        locale,
        slot,
        persisted: presentSlots.has(slot),
        workerId: result.workerId,
        attempt,
        result,
        outcome: result.outcome,
        visibleTransition: `${result.visibleBefore ?? ""}->${result.visibleAfter ?? ""}`,
        durationMs: result.durationMs,
        attemptTime: formatTime(windowStart),
        resultTime: formatTime(result),
        previousAttempt,
        nextAttempt,
        previousResult,
        nextResult,
        previousAction,
        nextAction,
        otherWorkerEventsDuringWindow,
        errors
      });
    }
  }
  return rows.sort((left, right) => (
    Number(left.persisted) - Number(right.persisted) ||
    left.locale.localeCompare(right.locale) ||
    left.slot - right.slot
  ));
}

function markdownTable(headers, rows) {
  if (!rows.length) return "_No rows._\n";
  const escape = value => String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");
  return [
    `| ${headers.map(escape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map(row => `| ${row.map(escape).join(" | ")} |`)
  ].join("\n") + "\n";
}

function renderClosestPairsSection(pairs, top) {
  const closest = pairs
    .slice()
    .sort((left, right) => left.gapMs - right.gapMs)
    .slice(0, top);
  return [
    "## Closest Adjacent Action Events",
    "",
    "These are the tightest gaps between consecutive logged CWS media action events. They are the primary candidates for server-side timing pressure.",
    "",
    markdownTable(
      ["Rank", "Gap ms", "Same worker", "Previous", "Current"],
      closest.map((pair, index) => [
        index + 1,
        pair.gapMs,
        pair.sameWorker ? "yes" : "no",
        formatEvent(pair.previous),
        formatEvent(pair.current)
      ])
    )
  ].join("\n");
}

function renderRiskRowsSection(rows, top) {
  const topRows = rows.slice(0, top);
  return [
    "## Highest Risk Result Events",
    "",
    "Risk score weights observed refreshed-state misses, tight adjacent action gaps, tight other-worker gaps, other-worker activity during the upload/delete window, immediate same-worker next attempts, and explicit CWS errors.",
    "",
    markdownTable(
      [
        "Rank",
        "Score",
        "Locale",
        "Slot",
        "Worker",
        "Outcome",
        "Attempt time",
        "Result time",
        "Duration ms",
        "Visible",
        "Min any gap ms",
        "Min other-worker gap ms",
        "Other events during window",
        "Same-worker next attempt gap ms",
        "Observed missing",
        "Error"
      ],
      topRows.map((row, index) => [
        index + 1,
        row.riskScore,
        row.locale,
        row.slot || "",
        row.workerId,
        row.outcome,
        row.attemptTime,
        row.resultTime,
        formatNumber(row.durationMs),
        row.visibleTransition,
        formatNumber(row.minAnyNeighborGapMs),
        formatNumber(row.minOtherWorkerGapMs),
        row.otherWorkerEventsDuringWindow.length,
        formatNumber(row.sameWorkerNextAfterResultGapMs),
        row.observedMissing ? "yes" : "no",
        row.error
      ])
    )
  ].join("\n");
}

function renderObservedSection(mismatchRows) {
  if (!mismatchRows.length) return "";
  return [
    "## Observed Refreshed-State Comparison",
    "",
    "This section is produced only when an observed-state JSON file is supplied. `Missing logged slots` means StorePilot logged the slot as added, but manual refreshed CWS inspection did not find it.",
    "",
    markdownTable(
      ["Locale", "Observed present slots", "Logged added slots", "Missing logged slots", "Unexpected observed slots"],
      mismatchRows.map(row => [
        row.locale,
        row.presentSlots.join(", "),
        row.loggedSlots.join(", "),
        row.missingLoggedSlots.join(", "),
        row.unexpectedSlots.join(", ")
      ])
    )
  ].join("\n");
}

function renderPerSlotPersistenceSection(rows) {
  if (!rows.length) return "";
  const renderRows = persisted => rows
    .filter(row => row.persisted === persisted)
    .map(row => [
      row.locale,
      row.slot,
      row.workerId,
      row.persisted ? "present" : "missing",
      `${row.outcome || ""} ${row.visibleTransition}`.trim(),
      row.attemptTime,
      row.resultTime,
      formatNumber(row.durationMs),
      formatSignedGap(row.attempt || row.result, row.previousAttempt),
      formatSignedGap(row.attempt || row.result, row.nextAttempt),
      formatSignedGap(row.result, row.previousResult),
      formatSignedGap(row.result, row.nextResult),
      formatSignedGap(row.result, row.previousAction),
      formatSignedGap(row.result, row.nextAction),
      row.otherWorkerEventsDuringWindow.length
        ? row.otherWorkerEventsDuringWindow
          .map(event => formatSignedGap(row.attempt || row.result, event))
          .join("; ")
        : "",
      row.errors.join("; ")
    ]);

  const headers = [
    "Locale",
    "Slot",
    "Worker",
    "Refreshed",
    "UI result",
    "Attempt time",
    "Result time",
    "Duration ms",
    "Previous global attempt before this attempt",
    "Next global attempt after this attempt",
    "Previous global result before this result",
    "Next global result after this result",
    "Immediate previous global action before this result",
    "Immediate next global action after this result",
    "Other-worker actions during this upload window",
    "Errors"
  ];

  return [
    "## Per-Slot Persistence Competition",
    "",
    "This section is produced only when observed refreshed-state data is supplied. It treats `present` as the screenshot slot being present after revisiting/reloading CWS, not merely after StorePilot saw the thumbnail count increase.",
    "",
    "The timing columns are global across all workers and all locales. They are intended to test server-side throttling or race behavior where CWS would not care whether the nearby action belongs to the same locale.",
    "",
    "### Missing After Refresh",
    "",
    markdownTable(headers, renderRows(false)),
    "### Present After Refresh",
    "",
    markdownTable(headers, renderRows(true))
  ].join("\n");
}

function renderAlgorithmSection() {
  return [
    "## Algorithm",
    "",
    "1. Parse `actionLog` and keep events that have `epochMs`, `action`, and `stage`.",
    "2. Sort events by `epochMs`, then `sequence`, then original index.",
    "3. Build adjacent action pairs and calculate `gapMs = current.epochMs - previous.epochMs`.",
    "4. For every result event, locate the matching attempt by worker, locale, action, attempt number, and screenshot/target slot.",
    "5. For that attempt-result window, calculate:",
    "   - closest previous/next action gap around the attempt;",
    "   - closest previous/next other-worker attempt gap;",
    "   - closest previous/next other-worker result gap;",
    "   - count of other-worker events that occurred between attempt and result;",
    "   - gap from this result to the same worker's next attempt.",
    "6. If observed refreshed-state data is supplied, build a per-slot persistence table with global previous/next attempts, global previous/next results, immediate previous/next action events, and other-worker actions inside each upload window.",
    "7. Mark logged added slots missing when the refreshed CWS state does not contain that slot.",
    "8. Rank result events with a risk score. The biggest weights are observed missing slots, sub-second or sub-three-second gaps, other-worker overlap, immediate same-worker next attempts, and explicit CWS errors.",
    ""
  ].join("\n");
}

function renderMarkdownReport(analysis) {
  const {
    logPath,
    observedPath,
    log,
    events,
    pairs,
    resultRows,
    mismatchRows,
    perSlotPersistenceRows,
    top
  } = analysis;
  const attempts = events.filter(event => event.stage === "attempt");
  const results = events.filter(event => event.stage === "result");
  const attemptPairs = createAdjacentPairs(attempts);
  const resultPairs = createAdjacentPairs(results);
  const allGaps = pairs.map(pair => pair.gapMs);
  const attemptGaps = attemptPairs.map(pair => pair.gapMs);
  const resultGaps = resultPairs.map(pair => pair.gapMs);
  const crossWorkerGaps = pairs.filter(pair => !pair.sameWorker).map(pair => pair.gapMs);
  const sameWorkerGaps = pairs.filter(pair => pair.sameWorker).map(pair => pair.gapMs);

  return [
    `# Localized Screenshot Timing Risk Report: ${log.run && log.run.runId || path.basename(logPath)}`,
    "",
    `Generated from: \`${path.relative(process.cwd(), logPath)}\``,
    observedPath ? `Observed state: \`${path.relative(process.cwd(), observedPath)}\`` : "Observed state: not supplied",
    "",
    "## Run Summary",
    "",
    markdownTable(
      ["Metric", "Value"],
      [
        ["Run status", log.run && log.run.status || ""],
        ["Mode", log.run && log.run.mode || ""],
        ["Elapsed", log.run && log.run.elapsedLabel || `${log.run && log.run.elapsedMs || 0}ms`],
        ["Workers", log.run && log.run.workerCount || ""],
        ["Action events", events.length],
        ["Attempts", attempts.length],
        ["Results", results.length],
        ["Result outcomes", Object.entries(countBy(results, event => `${event.action}:${event.outcome || "(none)"}`)).map(([key, value]) => `${key}=${value}`).join(", ")]
      ]
    ),
    "## Gap Summary",
    "",
    markdownTable(
      ["Gap set", "Stats"],
      [
        ["All adjacent action events", formatStats(summarizeNumbers(allGaps))],
        ["Adjacent attempts only", formatStats(summarizeNumbers(attemptGaps))],
        ["Adjacent results only", formatStats(summarizeNumbers(resultGaps))],
        ["Cross-worker adjacent action events", formatStats(summarizeNumbers(crossWorkerGaps))],
        ["Same-worker adjacent action events", formatStats(summarizeNumbers(sameWorkerGaps))]
      ]
    ),
    renderAlgorithmSection(),
    renderObservedSection(mismatchRows),
    renderPerSlotPersistenceSection(perSlotPersistenceRows),
    renderClosestPairsSection(pairs, top),
    renderRiskRowsSection(resultRows, top),
    "## Recommendation",
    "",
    "Use this report to choose a conservative mutation gate. If missing refreshed-state slots cluster near small cross-worker or same-worker gaps, enforce one background-issued media mutation token at a time and add a cooldown after every delete/upload result before another worker can mutate CWS media."
  ].filter(Boolean).join("\n");
}

function renderPerSlotPersistenceReport(analysis) {
  const {
    logPath,
    observedPath,
    log,
    perSlotPersistenceRows
  } = analysis;

  return [
    `# Localized Screenshot Per-Slot Persistence Competition Report: ${log.run && log.run.runId || path.basename(logPath)}`,
    "",
    `Generated from: \`${path.relative(process.cwd(), logPath)}\``,
    observedPath ? `Observed state: \`${path.relative(process.cwd(), observedPath)}\`` : "Observed state: not supplied",
    "",
    "This report is generated by `scripts/analyze-localized-screenshot-log.js --report per-slot`.",
    "",
    "The table uses global previous/next media actions across all workers and all locales. It is intended to inspect CWS-wide throttling or race behavior, where the server would not care whether the nearby action belongs to the same locale.",
    "",
    renderPerSlotPersistenceSection(perSlotPersistenceRows)
  ].filter(Boolean).join("\n");
}

function analyzeLocalizedScreenshotLog(log, options = {}) {
  const observed = normalizeObservedState(options.observed || {});
  const events = loadActionEvents(log);
  const pairs = createAdjacentPairs(events);
  const resultRows = analyzeResultEvents(events, observed);
  const mismatchRows = buildObservedMismatchRows(events, observed);
  const perSlotPersistenceRows = buildPerSlotPersistenceRows(events, observed);
  return {
    logPath: options.logPath || "",
    observedPath: options.observedPath || "",
    top: options.top || DEFAULT_TOP_LIMIT,
    log,
    events,
    pairs,
    resultRows,
    mismatchRows,
    perSlotPersistenceRows
  };
}

function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const logPath = path.resolve(args.logPath);
  const observedPath = args.observedPath ? path.resolve(args.observedPath) : "";
  const log = readJson(logPath);
  const observed = observedPath ? readJson(observedPath) : {};
  const analysis = analyzeLocalizedScreenshotLog(log, {
    logPath,
    observedPath,
    observed,
    top: args.top
  });
  const report = args.report === "per-slot"
    ? renderPerSlotPersistenceReport(analysis)
    : renderMarkdownReport(analysis);

  if (args.outPath) {
    const outPath = path.resolve(args.outPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${report.trimEnd()}\n`);
    console.log(`Wrote ${outPath}`);
  } else {
    console.log(report.trimEnd());
  }
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  analyzeLocalizedScreenshotLog,
  buildObservedMismatchRows,
  buildPerSlotPersistenceRows,
  createAdjacentPairs,
  loadActionEvents,
  normalizeObservedState,
  renderMarkdownReport,
  renderPerSlotPersistenceReport
};
