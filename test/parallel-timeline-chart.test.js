const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  console,
  window: {},
  document: {},
  localize(_key, fallback) {
    return fallback;
  },
  mediaOperationState: {
    running: false
  }
});

vm.runInContext(fs.readFileSync(path.join(root, "src/content/panel/state.js"), "utf8"), context, {
  filename: "src/content/panel/state.js"
});

function hostValue(value) {
  return JSON.parse(JSON.stringify(value));
}

const samples = context.normalizeParallelTimelineSamples([
  { elapsedMs: 3000, completedLocales: 2, failedLocales: 0, skippedLocales: 0, remainingLocales: 4, totalLocales: 6 },
  { elapsedMs: 1000, completedLocales: 1, failedLocales: 0, skippedLocales: 0, remainingLocales: 5, totalLocales: 6 },
  { elapsedMs: 3000, completedLocales: 1, failedLocales: 0, skippedLocales: 0, remainingLocales: 5, totalLocales: 6 },
  { elapsedMs: 5000, completedLocales: 1, failedLocales: 0, skippedLocales: 0, remainingLocales: 5, totalLocales: 6 },
  { elapsedMs: 7000, completedLocales: 6, failedLocales: 0, skippedLocales: 0, remainingLocales: 0, totalLocales: 6 }
], {
  totals: {
    totalLocales: 6
  }
});

assert.deepEqual(hostValue(samples.map(sample => sample.elapsedMs)), [1000, 3000, 5000, 7000], "duplicate timestamps are collapsed and samples are sorted");
assert.deepEqual(hostValue(samples.map(sample => sample.completedLocales)), [1, 2, 2, 6], "completed count is monotonic");
assert.deepEqual(hostValue(samples.map(sample => sample.remainingLocales)), [5, 4, 4, 0], "remaining count is monotonic");

console.log("Parallel timeline chart tests passed.");
