const assert = require("node:assert/strict");
const {
  analyzeLocalizedScreenshotLog,
  renderMarkdownReport,
  renderPerSlotPersistenceReport
} = require("../scripts/analyze-localized-screenshot-log.js");

const baseTime = Date.UTC(2026, 5, 28, 12, 0, 0, 0);
const event = (sequence, offsetMs, workerId, locale, stage, slot, extra = {}) => ({
  sequence,
  epochMs: baseTime + offsetMs,
  isoTime: new Date(baseTime + offsetMs).toISOString(),
  elapsedMs: offsetMs,
  runId: "run-test",
  workerId,
  operation: "replace",
  locale,
  localeIndex: 0,
  totalLocales: 2,
  localeScreenshotCount: 3,
  action: "upload",
  stage,
  attempt: extra.attempt || 1,
  screenshotSlot: slot,
  visibleBefore: stage === "attempt" ? extra.visibleBefore : extra.visibleBefore ?? slot - 1,
  visibleAfter: stage === "result" ? extra.visibleAfter ?? slot : null,
  addedCount: stage === "result" ? extra.addedCount ?? 1 : null,
  durationMs: stage === "result" ? extra.durationMs ?? 1000 : null,
  outcome: stage === "result" ? extra.outcome || "added" : "",
  method: stage === "result" ? "page bridge" : "",
  errorMessage: extra.errorMessage || "",
  message: extra.message || ""
});

const log = {
  run: {
    runId: "run-test",
    status: "completed",
    mode: "replace",
    elapsedLabel: "10s",
    workerCount: 2
  },
  actionLog: [
    event(1, 0, "worker-1", "hy", "attempt", 1, { visibleBefore: 0 }),
    event(2, 1200, "worker-2", "nl", "attempt", 1, { visibleBefore: 0 }),
    event(3, 2000, "worker-1", "hy", "result", 1, { visibleBefore: 0, visibleAfter: 1 }),
    event(4, 2150, "worker-1", "hy", "attempt", 2, { visibleBefore: 1 }),
    event(5, 2700, "worker-2", "nl", "result", 1, { visibleBefore: 0, visibleAfter: 1 }),
    event(6, 3150, "worker-1", "hy", "result", 2, { visibleBefore: 1, visibleAfter: 2 })
  ]
};

const analysis = analyzeLocalizedScreenshotLog(log, {
  observed: {
    hy: [1]
  },
  logPath: "sample-log.json",
  observedPath: "observed.json",
  top: 10
});

assert.equal(analysis.events.length, 6);
assert.equal(analysis.pairs.length, 5);
assert.equal(analysis.mismatchRows.length, 1);
assert.deepEqual(analysis.mismatchRows[0].missingLoggedSlots, [2]);

const riskyHySlot2 = analysis.resultRows.find(row => row.locale === "hy" && row.slot === 2);
assert.ok(riskyHySlot2);
assert.equal(riskyHySlot2.observedMissing, true);
assert.equal(riskyHySlot2.otherWorkerEventsDuringWindow.length, 1);
assert.ok(riskyHySlot2.riskScore > 20);

const hySlot2Persistence = analysis.perSlotPersistenceRows.find(row => row.locale === "hy" && row.slot === 2);
assert.ok(hySlot2Persistence);
assert.equal(hySlot2Persistence.persisted, false);
assert.equal(hySlot2Persistence.previousAttempt.locale, "nl");
assert.equal(hySlot2Persistence.previousAttempt.workerId, "worker-2");
assert.equal(hySlot2Persistence.previousResult.locale, "nl");
assert.equal(hySlot2Persistence.otherWorkerEventsDuringWindow.length, 1);

const report = renderMarkdownReport(analysis);
assert.match(report, /## Algorithm/);
assert.match(report, /## Closest Adjacent Action Events/);
assert.match(report, /## Highest Risk Result Events/);
assert.match(report, /Observed Refreshed-State Comparison/);
assert.match(report, /Per-Slot Persistence Competition/);
assert.match(report, /Previous global attempt before this attempt/);
assert.match(report, /hy/);
assert.match(report, /Missing logged slots/);

const perSlotReport = renderPerSlotPersistenceReport(analysis);
assert.match(perSlotReport, /--report per-slot/);
assert.match(perSlotReport, /Previous global result before this result/);

console.log("Localized screenshot log analysis tests passed.");
