function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none";
}

function setNativeValue(element, value) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

function dispatchInputEvents(element) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillElement(element, value) {
  if (!element) return false;

  element.focus();

  if (element.isContentEditable) {
    element.textContent = value;
    dispatchInputEvents(element);
    return true;
  }

  if ("value" in element) {
    setNativeValue(element, value);
    dispatchInputEvents(element);
    return true;
  }

  return false;
}

function getVisibleText(element) {
  return (element && element.textContent || "").replace(/\s+/g, " ").trim();
}

function getElementsByIdList(idList) {
  return String(idList || "")
    .split(/\s+/)
    .map(id => id && document.getElementById(id))
    .filter(Boolean);
}

function getReferencedText(element, attribute) {
  return getElementsByIdList(element && element.getAttribute(attribute))
    .map(getVisibleText)
    .filter(Boolean)
    .join(" ");
}

function getElementTop(element) {
  return element && element.getBoundingClientRect ? element.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
}

function findVisibleTextElement(pattern) {
  return Array.from(document.querySelectorAll("h1, h2, h3, h4, span, div, label"))
    .filter(isVisible)
    .find(element => {
      const text = getVisibleText(element);
      return text.length > 0 && text.length <= 140 && pattern.test(text);
    });
}
