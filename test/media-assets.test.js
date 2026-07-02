const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  console,
  storePilotText: (_key, fallback, substitutions) => substitutions
    ? substitutions.reduce((message, value, index) => message.replace(`$${index + 1}`, value), fallback)
    : fallback
});

for (const relativePath of [
  "src/shared/constants.js",
  "src/shared/files.js",
  "src/shared/projects.js",
  "src/shared/media-assets.js",
  "src/shared/handles.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), "utf8"), context, {
    filename: relativePath
  });
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function createPngBytes(width, height, hasAlpha = false) {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  writeUint32(bytes, 8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  writeUint32(bytes, 16, width);
  writeUint32(bytes, 20, height);
  bytes[24] = 8;
  bytes[25] = hasAlpha ? 6 : 2;
  writeUint32(bytes, 33, 0);
  bytes.set([0x49, 0x44, 0x41, 0x54], 37);
  return bytes;
}

function createFakeImage(relativePath, width, height, hasAlpha = false) {
  const bytes = createPngBytes(width, height, hasAlpha);
  return {
    name: path.basename(relativePath),
    webkitRelativePath: relativePath.replace(/\\/g, "/"),
    size: bytes.byteLength,
    lastModified: 1,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  };
}

function createFakeText(relativePath, text) {
  const encoded = Buffer.from(text, "utf8");
  return {
    name: path.basename(relativePath),
    webkitRelativePath: relativePath.replace(/\\/g, "/"),
    size: encoded.byteLength,
    lastModified: 1,
    async text() {
      return text;
    }
  };
}

(async () => {
  const files = [
    createFakeText("demo/store-listing/chrome-web-store/media/promo-videos/global.txt", "https://www.youtube.com/watch?v=nFYpu2wlTmg\n"),
    createFakeText("demo/store-listing/chrome-web-store/media/promo-videos/localized/en.txt", "https://www.youtube.com/watch?v=enpromo1234\n"),
    createFakeText("demo/store-listing/chrome-web-store/media/localized-promo-videos/de.txt", "https://youtu.be/depromo1234\n"),
    createFakeText("demo/store-listing/chrome-web-store/media/promo-videos/localized/fr.txt", "https://example.com/not-youtube\n"),
    createFakeText("demo/store-listing/chrome-web-store/README.md", "Reference: https://www.youtube.com/watch?v=ignored0000\n"),
    createFakeText("demo/docs/promo-videos/localized/es.txt", "Promo video\nhttps://youtu.be/espromo1234\n"),
    createFakeImage("demo/store-listing/chrome-web-store/media/screenshots/01-global.png", 1280, 800),
    createFakeImage("demo/store-listing/chrome-web-store/media/screenshots/en/01-first.png", 1280, 800),
    createFakeImage("demo/store-listing/chrome-web-store/media/screenshots/en/02-second.png", 640, 400),
    createFakeImage("demo/store-listing/chrome-web-store/media/screenshots/en/03-third.png", 1280, 800),
    createFakeImage("demo/store-listing/chrome-web-store/media/screenshots/de/01-first.png", 1280, 800),
    createFakeImage("demo/store-listing/chrome-web-store/media/screenshots/de/02-second.png", 640, 400),
    createFakeImage("demo/store-listing/chrome-web-store/media/screenshots/de/03-third.png", 1280, 800),
    createFakeImage("demo/store-listing/chrome-web-store/media/screenshots/de/04-fourth.png", 1280, 800),
    createFakeImage("demo/store-listing/chrome-web-store/media/screenshots/de/05-fifth.png", 1280, 800),
    createFakeImage("demo/store-listing/chrome-web-store/media/screenshots/de/06-extra.png", 1280, 800),
    createFakeImage("demo/store-listing/chrome-web-store/media/screenshots/source/render-preview/en/01-preview.png", 1280, 800),
    createFakeImage("demo/store-listing/chrome-web-store/media/promo/small-promo.png", 440, 280),
    createFakeImage("demo/store-listing/chrome-web-store/media/promo/marquee-promo.png", 1400, 560)
  ];

  const summary = await context.storePilotDiscoverMediaAssetsFromFileList(files);

  assert.equal(summary.screenshots.length, 1, "Only direct screenshots/ files should be global screenshots.");
  assert.equal(summary.screenshots[0].name, "01-global.png");
  assert.deepEqual(Object.keys(summary.localizedScreenshots), ["de", "en"]);
  assert.equal(summary.localizedScreenshots.en.length, 3);
  assert.equal(summary.localizedScreenshots.de.length, 5, "Localized screenshot sets are capped at five files.");
  assert.equal(summary.candidateCounts.localizedScreenshots, 9);
  assert.equal(summary.localizedScreenshotStats.localeCount, 2);
  assert.equal(summary.localizedScreenshotStats.screenshotCount, 8);
  assert.equal(summary.globalPromoVideo.url, "https://www.youtube.com/watch?v=nFYpu2wlTmg");
  assert.deepEqual(Object.keys(summary.localizedPromoVideos), ["de", "en", "es"]);
  assert.equal(summary.localizedPromoVideos.en.url, "https://www.youtube.com/watch?v=enpromo1234");
  assert.equal(summary.localizedPromoVideos.de.url, "https://youtu.be/depromo1234");
  assert.equal(summary.localizedPromoVideos.es.url, "https://youtu.be/espromo1234");
  assert.equal(summary.localizedPromoVideoStats.localeCount, 3);
  assert.equal(summary.localizedPromoVideoStats.issueCount, 0);
  assert.equal(summary.candidateCounts.globalPromoVideo, 1);
  assert.equal(summary.candidateCounts.localizedPromoVideos, 3);
  assert.ok(
    summary.localizedScreenshots.de.some(asset => (asset.issues || []).some(issue => /Extra localized screenshot/.test(issue))),
    "Extra localized screenshot files should be reported as an issue."
  );
  const annotated = context.storePilotAddLocalizedScreenshotListingWarnings(summary, { en: "English listing" });
  assert.ok(
    annotated.localizedScreenshots.de[0].issues.some(issue => /no matching imported listing text/.test(issue)),
    "Localized screenshot folders without imported listing text should be reported as an issue."
  );
  assert.ok(
    annotated.localizedPromoVideos.de.issues.some(issue => /no matching imported listing text/.test(issue)),
    "Localized promo videos without imported listing text should be reported as an issue."
  );
  assert.ok(summary.smallPromo);
  assert.ok(summary.marqueePromo);

  const entries = context.storePilotGetMediaAssetEntries(summary, "localizedScreenshots");
  assert.equal(entries.length, 8);
  assert.ok(entries.every(entry => entry.kind === "localizedScreenshots" && entry.locale));
  assert.equal(
    context.storePilotGetMediaAssetEntries(summary).some(entry => /PromoVideo/.test(entry.kind)),
    false,
    "Promo video URLs are metadata, not upload File entries."
  );

  const filtered = context.storePilotFilterMediaFilesByKind({
    storeIcon: "icon",
    screenshots: ["global"],
    localizedScreenshots: {
      en: ["en-1", "en-2"],
      de: ["de-1"]
    },
    smallPromo: "small",
    marqueePromo: "marquee"
  }, "localizedScreenshots");

  assert.deepEqual(JSON.parse(JSON.stringify(filtered)), {
    storeIcon: null,
    screenshots: [],
    localizedScreenshots: {
      en: ["en-1", "en-2"],
      de: ["de-1"]
    },
    smallPromo: null,
    marqueePromo: null
  });

  const localeCodes = Array.from({ length: 66 }, (_value, index) => `aa_${String(index).padStart(2, "0")}`);
  const largeFiles = localeCodes.flatMap(locale => [
    createFakeImage(`demo/store-listing/chrome-web-store/media/screenshots/${locale}/01-main.png`, 1280, 800),
    createFakeImage(`demo/store-listing/chrome-web-store/media/screenshots/${locale}/02-settings.png`, 1280, 800),
    createFakeImage(`demo/store-listing/chrome-web-store/media/screenshots/${locale}/03-panel.png`, 640, 400)
  ]);
  const largeSummary = await context.storePilotDiscoverMediaAssetsFromFileList(largeFiles);

  assert.equal(Object.keys(largeSummary.localizedScreenshots).length, 66);
  assert.equal(largeSummary.localizedScreenshotStats.localeCount, 66);
  assert.equal(largeSummary.localizedScreenshotStats.screenshotCount, 198);
  assert.equal(largeSummary.candidateCounts.localizedScreenshots, 198);
  assert.equal(context.storePilotGetMediaAssetEntries(largeSummary, "localizedScreenshots").length, 198);

  const largePromoFiles = localeCodes.map(locale => createFakeText(
    `demo/store-listing/chrome-web-store/media/promo-videos/localized/${locale}.txt`,
    `https://www.youtube.com/watch?v=${locale.replace(/_/g, "").padEnd(11, "0")}\n`
  ));
  const largePromoSummary = await context.storePilotDiscoverMediaAssetsFromFileList(largePromoFiles);

  assert.equal(Object.keys(largePromoSummary.localizedPromoVideos).length, 66);
  assert.equal(largePromoSummary.localizedPromoVideoStats.localeCount, 66);
  assert.equal(largePromoSummary.localizedPromoVideoStats.issueCount, 0);
  assert.equal(largePromoSummary.candidateCounts.localizedPromoVideos, 66);

  console.log("Media asset tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
