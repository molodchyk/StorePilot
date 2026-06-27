const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  console
});

vm.runInContext(fs.readFileSync(path.join(root, "src/options/options-media.js"), "utf8"), context, {
  filename: "src/options/options-media.js"
});

const globalStoreIcon = { id: "global-icon", kind: "storeIcon", registrationIndex: 0 };
const globalScreenshot = { id: "global-screenshot", kind: "screenshots", registrationIndex: 1 };
const amOne = { id: "am-1", kind: "localizedScreenshots", locale: "am", slotIndex: 0, registrationIndex: 2 };
const amTwo = { id: "am-2", kind: "localizedScreenshots", locale: "am", slotIndex: 1, registrationIndex: 3 };
const amThree = { id: "am-3", kind: "localizedScreenshots", locale: "am", slotIndex: 2, registrationIndex: 4 };
const arOne = { id: "ar-1", kind: "localizedScreenshots", locale: "ar", slotIndex: 0, registrationIndex: 5 };
const arTwo = { id: "ar-2", kind: "localizedScreenshots", locale: "ar", slotIndex: 1, registrationIndex: 6 };
const azOne = { id: "az-1", kind: "localizedScreenshots", locale: "az", slotIndex: 0, registrationIndex: 7 };

const mixedItems = [
  globalStoreIcon,
  globalScreenshot,
  amOne,
  amTwo,
  amThree,
  arOne,
  arTwo,
  azOne
];

function orderedIds(previewOrder, anchorItem) {
  return Array.from(
    context.getOrderedMediaReviewItemsForMode(mixedItems, previewOrder, anchorItem),
    item => item.id
  );
}

assert.deepEqual(
  orderedIds("locale", amTwo),
  ["am-1", "am-2", "am-3", "ar-1", "ar-2", "az-1"],
  "Locale order should keep all screenshots for one locale before moving to the next locale."
);

assert.deepEqual(
  orderedIds("slot", amTwo),
  ["am-1", "ar-1", "az-1", "am-2", "ar-2", "am-3"],
  "Slot order should traverse screenshot number across locales before moving to the next slot."
);

assert.deepEqual(
  orderedIds("slot", globalScreenshot),
  ["global-icon", "global-screenshot"],
  "Global previews should not mix localized screenshots into their navigation set."
);

console.log("Media review order tests passed.");
