const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  console,
  setTimeout,
  storePilotText(_key, fallback, substitutions) {
    return String(fallback || "").replace(/\$(\d+)/g, (_match, index) => {
      const value = substitutions && substitutions[Number(index) - 1];
      return value === undefined || value === null ? "" : String(value);
    });
  },
  storePilotNormalizeLocaleCode(value) {
    const parts = String(value || "")
      .trim()
      .replace(/-/g, "_")
      .split("_")
      .filter(Boolean);
    return parts
      .map((part, index) => index === 0 ? part.toLowerCase() : part.toUpperCase())
      .join("_");
  }
});

vm.runInContext(fs.readFileSync(path.join(root, "src/background/media.js"), "utf8"), context, {
  filename: "src/background/media.js"
});

function hostValue(value) {
  return JSON.parse(JSON.stringify(value));
}

const files = {
  localizedScreenshots: {
    am: ["am-1", "am-2", "am-3"],
    ar: ["ar-1", "ar-2", "ar-3"],
    az: ["az-1", "az-2", "az-3"],
    bg: ["bg-1", "bg-2", "bg-3"],
    bn: ["bn-1", "bn-2", "bn-3"],
    ca: ["ca-1", "ca-2", "ca-3"]
  }
};

const assignedPlan = context.storePilotBuildParallelLocalizedScreenshotPlan(files, {
  assignedLocales: ["bg", "am", "bg"],
  startLocale: "ca",
  workerCount: 2
});
assert.equal(assignedPlan.ok, true);
assert.deepEqual(hostValue(assignedPlan.locales), ["am", "bg"], "assigned locales ignore startLocale and preserve source sort order");
assert.deepEqual(hostValue(assignedPlan.chunks), [["am"], ["bg"]]);
assert.equal(new Set(assignedPlan.chunks.flat()).size, assignedPlan.chunks.flat().length, "worker chunks do not overlap");

const startPlan = context.storePilotBuildParallelLocalizedScreenshotPlan(files, {
  startLocale: "az",
  workerCount: 2
});
assert.equal(startPlan.ok, true);
assert.deepEqual(hostValue(startPlan.locales), ["az", "bg", "bn", "ca"]);
assert.deepEqual(hostValue(startPlan.chunks), [["az", "bg"], ["bn", "ca"]]);
assert.deepEqual(hostValue(startPlan.skipped), ["2 locale(s) before start locale az"]);

const largeLocalizedScreenshots = Object.fromEntries(
  Array.from({ length: 66 }, (_item, index) => [
    `l${String(index).padStart(2, "0")}`,
    [`${index}-1`, `${index}-2`, `${index}-3`]
  ])
);
const largePlan = context.storePilotBuildParallelLocalizedScreenshotPlan({
  localizedScreenshots: largeLocalizedScreenshots
}, {
  workerCount: 6
});
assert.equal(largePlan.ok, true);
assert.equal(largePlan.locales.length, 66);
assert.deepEqual(Array.from(largePlan.chunks).map(chunk => chunk.length), [11, 11, 11, 11, 11, 11]);
assert.equal(largePlan.totalScreenshots, 198);

const filteredFiles = context.storePilotFilterLocalizedScreenshotFilesForAssignedLocales(files, ["ar", "ca"]);
assert.equal(filteredFiles.storeIcon, null);
assert.deepEqual(hostValue(filteredFiles.screenshots), []);
assert.deepEqual(Object.keys(filteredFiles.localizedScreenshots), ["ar", "ca"]);
assert.equal(filteredFiles.smallPromo, null);
assert.equal(filteredFiles.marqueePromo, null);

assert.equal(context.storePilotFormatParallelLocalizedScreenshotElapsed(123456), "2m 03s");
assert.equal(context.storePilotNormalizeParallelLocalizedScreenshotMode("coordinated"), "clearThenUpload");
assert.equal(context.storePilotNormalizeParallelLocalizedScreenshotMode("replace"), "replace");
assert.equal(context.storePilotNormalizeParallelLocalizedScreenshotMode("clear"), "clearOnly");
assert.equal(context.storePilotNormalizeParallelLocalizedScreenshotMode("upload"), "uploadOnly");

const snapshot = context.storePilotCreateParallelLocalizedScreenshotRunSnapshot({
  runId: "run-1",
  status: "running",
  mode: "clearThenUpload",
  phase: "uploading",
  parentTabId: 1,
  parentUrl: "https://chrome.google.com/webstore/devconsole/item/edit/listing",
  startedAt: Date.now() - 5000,
  closeSuccessfulWorkers: true,
  abortRequested: false,
  totalLocales: 2,
  totalScreenshots: 6,
  initialSkipped: [],
  initialSkippedLocales: 0,
  message: "",
  localeStatusOrder: ["am", "ar"],
  localeStatuses: {
    am: {
      locale: "am",
      status: "completed",
      phase: "uploading",
      operation: "uploadOnly",
      workerId: "worker-1",
      uploadedScreenshots: 3,
      totalScreenshots: 3,
      message: "localized screenshots uploaded"
    },
    ar: {
      locale: "ar",
      status: "failed",
      phase: "uploading",
      operation: "uploadOnly",
      workerId: "worker-2",
      uploadedScreenshots: 1,
      totalScreenshots: 3,
      message: "failed"
    }
  },
  timeline: [],
  workers: [
    {
      workerId: "worker-1",
      tabId: 2,
      status: "completed",
      closed: false,
      operation: "uploadOnly",
      assignedLocales: ["am"],
      totalScreenshots: 3,
      completedLocales: 1,
      failedLocales: 0,
      skippedLocales: 0,
      uploadedScreenshots: 3,
      elapsedMs: 2000
    },
    {
      workerId: "worker-2",
      tabId: 3,
      status: "failed",
      closed: false,
      operation: "uploadOnly",
      assignedLocales: ["ar"],
      totalScreenshots: 3,
      completedLocales: 0,
      failedLocales: 1,
      skippedLocales: 0,
      uploadedScreenshots: 1,
      elapsedMs: 3000
    }
  ]
});
assert.equal(snapshot.mode, "clearThenUpload");
assert.equal(snapshot.phase, "uploading");
assert.equal(snapshot.workers[0].operation, "uploadOnly");
assert.equal(snapshot.workers[0].closeable, true);
assert.equal(snapshot.workers[1].closeable, false);
assert.equal(snapshot.workers[0].timeline[0].completedLocales, 1);
assert.equal(snapshot.workers[1].timeline[0].failedLocales, 1);
assert.equal(snapshot.totals.completedLocales, 1);
assert.equal(snapshot.totals.failedLocales, 1);
assert.equal(snapshot.totals.uploadedScreenshots, 4);
assert.equal(snapshot.totals.totalScreenshots, 6);
assert.deepEqual(hostValue(snapshot.localeStatuses).map(item => [item.locale, item.status]), [
  ["am", "completed"],
  ["ar", "failed"]
]);
assert.equal(snapshot.timeline.length, 1);
assert.equal(snapshot.timeline[0].completedLocales, 1);
assert.equal(snapshot.timeline[0].failedLocales, 1);
assert.equal(snapshot.timeline[0].remainingLocales, 0);
assert.equal(snapshot.timeline[0].uploadedScreenshots, 4);

const clearOnlySnapshot = context.storePilotCreateParallelLocalizedScreenshotRunSnapshot({
  runId: "run-2",
  status: "running",
  mode: "clearOnly",
  phase: "clearOnly",
  parentTabId: 1,
  parentUrl: "https://chrome.google.com/webstore/devconsole/item/edit/listing",
  startedAt: Date.now() - 61000,
  closeSuccessfulWorkers: true,
  abortRequested: false,
  totalLocales: 2,
  totalScreenshots: 6,
  initialSkipped: [],
  initialSkippedLocales: 0,
  message: "",
  localeStatusOrder: ["am", "ar"],
  localeStatuses: {
    am: {
      locale: "am",
      status: "completed",
      phase: "clearOnly",
      operation: "clearOnly",
      workerId: "worker-1",
      uploadedScreenshots: 0,
      totalScreenshots: 3,
      message: "localized screenshots cleared"
    },
    ar: {
      locale: "ar",
      status: "clearing",
      phase: "clearOnly",
      operation: "clearOnly",
      workerId: "worker-1",
      uploadedScreenshots: 0,
      totalScreenshots: 3,
      message: "clearing existing screenshots"
    }
  },
  timeline: [],
  workers: [
    {
      workerId: "worker-1",
      tabId: 2,
      status: "running",
      closed: false,
      operation: "clearOnly",
      assignedLocales: ["am", "ar"],
      totalScreenshots: 6,
      completedLocales: 1,
      failedLocales: 0,
      skippedLocales: 0,
      uploadedScreenshots: 0,
      elapsedMs: 61000
    }
  ]
});
assert.equal(clearOnlySnapshot.elapsedLabel, "1m 01s");
assert.equal(clearOnlySnapshot.workers[0].elapsedLabel, "1m 01s");
assert.equal(clearOnlySnapshot.workers[0].timeline[0].completedLocales, 1);
assert.equal(clearOnlySnapshot.workers[0].timeline[0].remainingLocales, 1);
assert.equal(clearOnlySnapshot.timeline[0].completedLocales, 1);
assert.equal(clearOnlySnapshot.timeline[0].remainingLocales, 1);
assert.equal(clearOnlySnapshot.timeline[0].uploadedScreenshots, 0);

const clearOnlyProgressSnapshot = context.storePilotCreateParallelLocalizedScreenshotRunSnapshot({
  runId: "run-3",
  status: "running",
  mode: "clearOnly",
  phase: "clearOnly",
  parentTabId: 1,
  parentUrl: "https://chrome.google.com/webstore/devconsole/item/edit/listing",
  startedAt: Date.now() - 42000,
  closeSuccessfulWorkers: true,
  abortRequested: false,
  totalLocales: 2,
  totalScreenshots: 6,
  initialSkipped: [],
  initialSkippedLocales: 0,
  message: "",
  localeStatusOrder: ["am", "ar"],
  localeStatuses: {
    am: {
      locale: "am",
      status: "clearing",
      phase: "clearOnly",
      operation: "clearOnly",
      workerId: "worker-1",
      uploadedScreenshots: 0,
      totalScreenshots: 3,
      message: "verifying localized screenshot field is clear"
    },
    ar: {
      locale: "ar",
      status: "pendingClear",
      phase: "clearOnly",
      operation: "clearOnly",
      workerId: "worker-1",
      uploadedScreenshots: 0,
      totalScreenshots: 3,
      message: ""
    }
  },
  timeline: [],
  workers: [
    {
      workerId: "worker-1",
      tabId: 2,
      status: "running",
      closed: false,
      operation: "clearOnly",
      assignedLocales: ["am", "ar"],
      totalScreenshots: 6,
      progress: {
        completedLocales: 1,
        failedLocales: 0,
        skippedLocales: 0,
        uploadedScreenshots: 0
      },
      elapsedMs: 42000
    }
  ]
});
assert.equal(clearOnlyProgressSnapshot.timeline[0].completedLocales, 1, "clear-only timeline follows worker progress before locale chips are complete");
assert.equal(clearOnlyProgressSnapshot.timeline[0].remainingLocales, 1);
assert.equal(clearOnlyProgressSnapshot.workers[0].timeline[0].completedLocales, 1);
assert.equal(clearOnlyProgressSnapshot.workers[0].timeline[0].remainingLocales, 1);

(async () => {
  context.storePilotIsListingDashboardUrl = () => true;
  context.storePilotTabsSendMessage = () => Promise.resolve({ ok: true });
  let openedTabs = 0;
  context.storePilotTabsCreate = () => Promise.resolve({ id: 11 + openedTabs++ });
  context.storePilotGetProjectsState = () => new Promise(() => {});

  const immediateStart = await context.storePilotStartParallelLocalizedScreenshotUpload({
    tab: {
      id: 7,
      url: "https://chrome.google.com/webstore/devconsole/item/edit"
    }
  }, false, {
    parallelMode: "clear"
  });

  assert.equal(immediateStart.ok, true);
  assert.equal(immediateStart.run.status, "starting");
  assert.equal(immediateStart.run.phase, "resolvingFiles");
  assert.equal(immediateStart.run.totals.totalLocales, 0);

  const retryWithoutStoredRun = await context.storePilotRetryParallelLocalizedScreenshotFailed({
    tab: {
      id: 7,
      url: "https://chrome.google.com/webstore/devconsole/item/edit"
    }
  }, "missing-run", {
    assignedLocales: ["am", "ar"],
    workerCount: 3,
    parallelMode: "clear"
  });
  assert.equal(retryWithoutStoredRun.ok, true);
  assert.equal(retryWithoutStoredRun.run.status, "starting");
  assert.equal(retryWithoutStoredRun.run.mode, "clearOnly");

  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(openedTabs, 4);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
