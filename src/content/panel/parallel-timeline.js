function isParallelLocalizedScreenshotRunActive(run = parallelLocalizedScreenshotRunState) {
  return Boolean(run && ["starting", "running", "aborting"].includes(run.status));
}

function formatPanelParallelElapsed(elapsedMs) {
  const totalSeconds = Math.max(0, Math.floor(Number(elapsedMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

function getPanelParallelRunElapsedMs(run) {
  if (!run) return 0;
  if (isParallelLocalizedScreenshotRunActive(run) && run.startedAt) {
    return Math.max(0, Date.now() - run.startedAt);
  }
  return Math.max(0, Number(run.elapsedMs || 0));
}

function getPanelParallelWorkerElapsedMs(worker) {
  if (!worker) return 0;
  if (["opening", "running", "aborting"].includes(worker.status) && worker.startedAt) {
    return Math.max(0, Date.now() - worker.startedAt);
  }
  return Math.max(0, Number(worker.elapsedMs || 0));
}

function getParallelLocalizedScreenshotRunState() {
  return parallelLocalizedScreenshotRunState;
}

function isLocalizedScreenshotWorkerRun(runId) {
  const normalizedRunId = String(runId || "");
  return Boolean(
    normalizedRunId &&
    (
      localizedScreenshotWorkerIdentity &&
        localizedScreenshotWorkerIdentity.runId === normalizedRunId ||
      localizedScreenshotWorkerProgressState &&
        localizedScreenshotWorkerProgressState.runId === normalizedRunId
    )
  );
}

function markLocalizedScreenshotWorkerRun(runId, workerId = "") {
  const normalizedRunId = String(runId || "");
  if (!normalizedRunId) return;

  localizedScreenshotWorkerIdentity = {
    runId: normalizedRunId,
    workerId: String(workerId || "")
  };
  if (parallelLocalizedScreenshotRunState && parallelLocalizedScreenshotRunState.runId === normalizedRunId) {
    parallelLocalizedScreenshotRunState = null;
    renderParallelLocalizedScreenshotBoard();
    updatePanelMediaUi();
  }
}

function normalizeParallelLocalizedScreenshotPanelLocale(value) {
  const parts = String(value || "")
    .trim()
    .replace(/-/g, "_")
    .split("_")
    .filter(Boolean);
  return parts
    .map((part, index) => index === 0 ? part.toLowerCase() : part.toUpperCase())
    .join("_");
}

function createParallelBoardLine(label, value) {
  const line = document.createElement("div");
  line.className = "storepilot-parallel-board-line";
  line.textContent = `${label}: ${value}`;
  return line;
}

function createParallelSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function isParallelClearProgressRun(run) {
  const mode = String(run && run.mode || "");
  const phase = String(run && run.phase || "");
  return mode === "clearOnly" || (mode === "clearThenUpload" && phase === "clearing");
}

function isParallelClearProgressWorker(worker, run = parallelLocalizedScreenshotRunState) {
  const operation = String(worker && worker.operation || "");
  return operation === "clearOnly" || isParallelClearProgressRun(run);
}

function isParallelAuditPhaseText(value) {
  return /auditing persisted localized screenshot count/i.test(String(value || ""));
}

function getParallelAuditTotals(run) {
  const workers = Array.isArray(run && run.workers) ? run.workers : [];
  const totals = run && run.totals || {};
  const auditedLocales = Number(totals.auditedLocales || 0) || workers
    .reduce((sum, worker) => sum + Number(worker.auditedLocales || 0), 0);
  const auditTotalLocales = Number(totals.auditTotalLocales || 0) || workers
    .reduce((sum, worker) => {
      const workerAuditTotal = Number(worker.auditTotalLocales || 0);
      if (workerAuditTotal) return sum + workerAuditTotal;
      return sum + (worker.auditedLocales ? Number(worker.completedLocales || worker.assignedCount || 0) : 0);
    }, 0);

  return {
    auditedLocales,
    auditTotalLocales
  };
}

function isParallelRunAuditing(run) {
  return Boolean(run && (
    isParallelAuditPhaseText(run.phase) ||
    (Array.isArray(run.workers) && run.workers.some(worker => isParallelAuditPhaseText(worker.phase)))
  ));
}

function getParallelTimelineCurrentSample(run, elapsedMs = getPanelParallelRunElapsedMs(run)) {
  const totals = run && run.totals || {};
  const statuses = Array.isArray(run && run.localeStatuses) ? run.localeStatuses : [];
  const totalLocales = Math.max(Number(totals.totalLocales || 0), statuses.length);
  let completedLocales = Math.min(totalLocales, Number(totals.completedLocales || 0));
  let failedLocales = Math.min(
    Math.max(0, totalLocales - completedLocales),
    Number(totals.failedLocales || 0)
  );
  const statusSkippedLocales = statuses.length
    ? statuses.filter(status => status.status === "skipped").length
    : Number(totals.skippedLocales || 0);
  let skippedLocales = Math.min(
    Math.max(0, totalLocales - completedLocales - failedLocales),
    statusSkippedLocales
  );

  if (!completedLocales && !failedLocales && !skippedLocales && statuses.length) {
    const countClearedAsComplete = run &&
      run.mode === "clearThenUpload" &&
      run.phase === "clearing";
    completedLocales = statuses.filter(status => (
      status.status === "completed" || (countClearedAsComplete && status.status === "cleared")
    )).length;
    failedLocales = statuses.filter(status => status.status === "failed" || status.status === "aborted").length;
    skippedLocales = statuses.filter(status => status.status === "skipped").length;
  }

  return {
    elapsedMs,
    completedLocales,
    failedLocales,
    skippedLocales,
    remainingLocales: Math.max(0, totalLocales - completedLocales - failedLocales - skippedLocales),
    uploadedScreenshots: Number(totals.uploadedScreenshots || 0),
    totalLocales
  };
}

function getParallelTimelineSamples(run) {
  if (!run) return [];

  const currentPhase = String(run.phase || "");
  let rawSamples = Array.isArray(run.timeline) ? run.timeline : [];
  if (currentPhase && rawSamples.some(sample => String(sample && sample.phase || "") === currentPhase)) {
    rawSamples = rawSamples.filter(sample => String(sample && sample.phase || "") === currentPhase);
  }

  const samples = rawSamples.length
    ? rawSamples.map(sample => ({
      elapsedMs: Number(sample.elapsedMs || 0),
      completedLocales: Number(sample.completedLocales || 0),
      failedLocales: Number(sample.failedLocales || 0),
      skippedLocales: Number(sample.skippedLocales || 0),
      remainingLocales: Number(sample.remainingLocales || 0),
      uploadedScreenshots: Number(sample.uploadedScreenshots || 0),
      totalLocales: Number(sample.totalLocales || run.totals && run.totals.totalLocales || 0)
    })).filter(sample => Number.isFinite(sample.elapsedMs))
    : [];

  const liveSample = getParallelTimelineCurrentSample(run);
  const lastSample = samples[samples.length - 1];
  if (!lastSample || liveSample.elapsedMs > lastSample.elapsedMs) {
    samples.push(liveSample);
  }

  if (!samples.length) {
    samples.push(liveSample);
  }

  const normalizedSamples = normalizeParallelTimelineSamples(samples, run);
  if (normalizedSamples[0] && normalizedSamples[0].elapsedMs > 0) {
    const totalLocales = Number(run.totals && run.totals.totalLocales || samples[0].totalLocales || 0);
    normalizedSamples.unshift({
      elapsedMs: 0,
      completedLocales: 0,
      failedLocales: 0,
      skippedLocales: 0,
      remainingLocales: totalLocales,
      uploadedScreenshots: 0,
      totalLocales
    });
  }

  return normalizedSamples;
}

function normalizeParallelTimelineSamples(samples, run) {
  const totalLocales = Math.max(
    0,
    Number(run && run.totals && run.totals.totalLocales || 0),
    ...samples.map(sample => Number(sample.totalLocales || 0))
  );
  const byElapsedMs = new Map();

  for (const sample of samples.slice().sort((left, right) => left.elapsedMs - right.elapsedMs)) {
    const elapsedMs = Math.max(0, Number(sample.elapsedMs || 0));
    const key = String(elapsedMs);
    const previous = byElapsedMs.get(key);
    const normalized = {
      elapsedMs,
      completedLocales: Math.max(0, Math.min(totalLocales, Number(sample.completedLocales || 0))),
      failedLocales: Math.max(0, Math.min(totalLocales, Number(sample.failedLocales || 0))),
      skippedLocales: Math.max(0, Math.min(totalLocales, Number(sample.skippedLocales || 0))),
      remainingLocales: Math.max(0, Math.min(totalLocales, Number(sample.remainingLocales || 0))),
      uploadedScreenshots: Math.max(0, Number(sample.uploadedScreenshots || 0)),
      totalLocales
    };

    if (!previous) {
      byElapsedMs.set(key, normalized);
      continue;
    }

    byElapsedMs.set(key, {
      ...normalized,
      completedLocales: Math.max(previous.completedLocales, normalized.completedLocales),
      failedLocales: Math.max(previous.failedLocales, normalized.failedLocales),
      skippedLocales: Math.max(previous.skippedLocales, normalized.skippedLocales),
      remainingLocales: Math.min(previous.remainingLocales, normalized.remainingLocales),
      uploadedScreenshots: Math.max(previous.uploadedScreenshots, normalized.uploadedScreenshots)
    });
  }

  const normalizedSamples = Array.from(byElapsedMs.values()).sort((left, right) => left.elapsedMs - right.elapsedMs);
  let completedLocales = 0;
  let failedLocales = 0;
  let skippedLocales = 0;

  return normalizedSamples.map(sample => {
    completedLocales = Math.max(completedLocales, sample.completedLocales);
    failedLocales = Math.max(failedLocales, sample.failedLocales);
    skippedLocales = Math.max(skippedLocales, sample.skippedLocales);
    const cappedCompleted = Math.min(totalLocales, completedLocales);
    const cappedFailed = Math.min(Math.max(0, totalLocales - cappedCompleted), failedLocales);
    const cappedSkipped = Math.min(Math.max(0, totalLocales - cappedCompleted - cappedFailed), skippedLocales);

    return {
      ...sample,
      completedLocales: cappedCompleted,
      failedLocales: cappedFailed,
      skippedLocales: cappedSkipped,
      remainingLocales: Math.max(0, totalLocales - cappedCompleted - cappedFailed - cappedSkipped),
      totalLocales
    };
  });
}

function buildParallelTimelineStepPathData(samples, field, xForSample, yForValue) {
  if (!Array.isArray(samples) || !samples.length) return "";

  const first = samples[0];
  let previousX = xForSample(first);
  let previousY = yForValue(first[field] || 0);
  const parts = [`M ${previousX.toFixed(1)} ${previousY.toFixed(1)}`];

  for (const sample of samples.slice(1)) {
    const nextX = xForSample(sample);
    const nextY = yForValue(sample[field] || 0);

    if (nextX !== previousX) {
      parts.push(`L ${nextX.toFixed(1)} ${previousY.toFixed(1)}`);
    }
    if (nextY !== previousY) {
      parts.push(`L ${nextX.toFixed(1)} ${nextY.toFixed(1)}`);
    }

    previousX = nextX;
    previousY = nextY;
  }

  return parts.join(" ");
}

function createParallelTimelineStepPath(samples, field, xForSample, yForValue, className) {
  return createParallelSvgElement("path", {
    class: className,
    d: buildParallelTimelineStepPathData(samples, field, xForSample, yForValue),
    fill: "none",
    style: "fill: none;",
    "stroke-width": "2.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  });
}

function renderParallelTimelineChart(container, run) {
  if (!container) return;
  container.replaceChildren();

  if (!run) {
    container.hidden = true;
    return;
  }

  const samples = getParallelTimelineSamples(run);
  const width = 300;
  const height = 88;
  const padding = { left: 26, right: 8, top: 8, bottom: 18 };
  const maxElapsed = Math.max(1, ...samples.map(sample => sample.elapsedMs));
  const maxLocales = Math.max(1, Number(run.totals && run.totals.totalLocales || 0), ...samples.map(sample => sample.totalLocales || 0));
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const xForSample = sample => padding.left + (Math.max(0, sample.elapsedMs) / maxElapsed) * chartWidth;
  const yForValue = value => padding.top + (1 - (Math.max(0, value) / maxLocales)) * chartHeight;
  const svg = createParallelSvgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": "Localized screenshot progress over elapsed time"
  });

  for (const ratio of [0, 0.5, 1]) {
    const y = padding.top + ratio * chartHeight;
    svg.append(createParallelSvgElement("line", {
      class: "storepilot-parallel-chart-grid",
      x1: padding.left,
      y1: y,
      x2: width - padding.right,
      y2: y
    }));
  }

  svg.append(createParallelTimelineStepPath(samples, "remainingLocales", xForSample, yForValue, "storepilot-parallel-chart-remaining"));
  svg.append(createParallelTimelineStepPath(samples, "completedLocales", xForSample, yForValue, "storepilot-parallel-chart-completed"));
  if (samples.some(sample => sample.failedLocales > 0)) {
    svg.append(createParallelTimelineStepPath(samples, "failedLocales", xForSample, yForValue, "storepilot-parallel-chart-failed"));
  }

  const startLabel = createParallelSvgElement("text", {
    class: "storepilot-parallel-chart-label",
    x: padding.left,
    y: height - 4
  });
  startLabel.textContent = "0s";
  svg.append(startLabel);

  const endLabel = createParallelSvgElement("text", {
    class: "storepilot-parallel-chart-label storepilot-parallel-chart-label-end",
    x: width - padding.right,
    y: height - 4,
    "text-anchor": "end"
  });
  endLabel.textContent = formatPanelParallelElapsed(maxElapsed);
  svg.append(endLabel);

  const doneLabel = createParallelSvgElement("text", {
    class: "storepilot-parallel-chart-label storepilot-parallel-chart-done-label",
    x: width - padding.right,
    y: Math.max(10, yForValue(samples[samples.length - 1].completedLocales || 0) - 4),
    "text-anchor": "end"
  });
  doneLabel.textContent = "done";
  if (isParallelClearProgressRun(run)) {
    doneLabel.textContent = "cleared";
  }
  svg.append(doneLabel);

  const remainingLabel = createParallelSvgElement("text", {
    class: "storepilot-parallel-chart-label storepilot-parallel-chart-remaining-label",
    x: width - padding.right,
    y: Math.min(height - padding.bottom - 2, yForValue(samples[samples.length - 1].remainingLocales || 0) + 10),
    "text-anchor": "end"
  });
  remainingLabel.textContent = "remaining";
  svg.append(remainingLabel);

  container.hidden = false;
  container.append(svg);
}
