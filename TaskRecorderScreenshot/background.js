/**
 * Service worker: captures the requesting Finance and operations tab for
 * Task Recorder.
 *
 * Chromium only offers captureVisibleTab, so the requesting tab must be the
 * active tab in its window. Captures are serialized and spaced to stay under
 * MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND.
 *
 * Also reinjects content scripts into the top frame of F&O tabs that are
 * missing them — Chrome Incognito often skips automatic injection after
 * Allow-in-Incognito / extension reload.
 */

importScripts("hosts.js");

const POPUP_URL = chrome.runtime.getURL("popup.html");
const MIN_CAPTURE_INTERVAL_MS =
  Math.ceil(1000 / (chrome.tabs.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND || 2)) +
  50;

let captureQueue = Promise.resolve();
let lastCaptureAt = 0;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureActiveTab(tab) {
  const wait = lastCaptureAt + MIN_CAPTURE_INTERVAL_MS - Date.now();
  if (wait > 0) {
    await delay(wait);
  }

  const [active] = await chrome.tabs.query({
    active: true,
    windowId: tab.windowId,
  });
  if (!active || active.id !== tab.id) {
    throw new Error(
      "Capture skipped: Dynamics tab is not the active tab in this window"
    );
  }

  lastCaptureAt = Date.now();
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  if (!dataUrl) {
    throw new Error("Screenshot capture failed");
  }
  return dataUrl;
}

function enqueueCapture(tab) {
  const run = captureQueue.then(() => captureActiveTab(tab));
  captureQueue = run.catch(() => {});
  return run;
}

async function hasContentScript(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(
      tabId,
      { name: "ping" },
      { frameId: 0 }
    );
    return !!(response && response.ok);
  } catch {
    return false;
  }
}

async function ensureScriptsInjected(tabId) {
  if (await hasContentScript(tabId)) {
    return false;
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["page-bridge.js"],
    world: "MAIN",
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["screenshot.js"],
    world: "ISOLATED",
  });
  return true;
}

async function getAllowedTab(tabId) {
  if (!tabId) {
    throw new Error("Missing tabId");
  }
  const tab = await chrome.tabs.get(tabId);
  if (!isAllowedDynamicsUrl(tab.url)) {
    throw new Error(`Not a Finance and operations tab:\n${tab.url || "(no url)"}`);
  }
  return tab;
}

function isFromPopup(sender) {
  return !sender.tab && sender.url === POPUP_URL;
}

function respond(promise, sendResponse) {
  promise.then(sendResponse, (error) =>
    sendResponse({ error: (error && error.message) || String(error) })
  );
  return true;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !isAllowedDynamicsUrl(tab?.url)) {
    return;
  }
  ensureScriptsInjected(tabId).catch(() => {
    // Ignore transient injection errors (tab closed, navigation in progress).
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.name || sender.id !== chrome.runtime.id) {
    return false;
  }

  switch (request.name) {
    case "screenshot":
      if (
        !sender.tab ||
        !isAllowedDynamicsUrl(sender.url) ||
        !isAllowedDynamicsUrl(sender.tab.url)
      ) {
        sendResponse({ error: "Unauthorized sender" });
        return false;
      }
      return respond(
        enqueueCapture(sender.tab).then((screenshotUrl) => ({ screenshotUrl })),
        sendResponse
      );

    case "ensureInjected":
      if (!isFromPopup(sender)) {
        sendResponse({ error: "Unauthorized sender" });
        return false;
      }
      return respond(
        getAllowedTab(request.tabId).then(async (tab) => ({
          ok: true,
          injected: await ensureScriptsInjected(tab.id),
          url: tab.url,
          incognito: !!tab.incognito,
        })),
        sendResponse
      );

    case "testCapture":
      if (!isFromPopup(sender)) {
        sendResponse({ error: "Unauthorized sender" });
        return false;
      }
      return respond(
        getAllowedTab(request.tabId)
          .then(enqueueCapture)
          .then((screenshotUrl) => ({ screenshotUrl })),
        sendResponse
      );

    default:
      return false;
  }
});
