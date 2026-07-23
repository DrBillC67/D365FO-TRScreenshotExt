/**
 * Service worker: captures the requesting Dynamics tab for Task Recorder.
 *
 * Prefer chrome.tabs.captureTab in normal windows (Chrome). Edge does not
 * expose captureTab. For Incognito/InPrivate tabs, always use
 * captureVisibleTab (Chrome's captureTab is unreliable there), and only when
 * the sender tab is still active in that window.
 *
 * Also reinjects content scripts on Dynamics navigations — Chrome Incognito
 * often misses automatic injection after Allow-in-Incognito / extension reload.
 */

const ALLOWED_HOST_SUFFIXES = [".dynamics.com", ".microsoftdynamics.us"];

function isAllowedSenderUrl(urlString) {
  if (!urlString) {
    return false;
  }

  let url;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix)
  );
}

async function ensureScriptsInjected(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["page-bridge.js"],
    world: "MAIN",
  });
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["screenshot.js"],
    world: "ISOLATED",
  });
}

function captureVisibleSenderTab(tab, sendResponse) {
  chrome.tabs.query(
    { active: true, windowId: tab.windowId },
    (activeTabs) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }

      const active = activeTabs && activeTabs[0];
      if (!active || active.id !== tab.id) {
        sendResponse({
          error:
            "Capture skipped: Dynamics tab is not the active tab in this window",
        });
        return;
      }

      chrome.tabs.captureVisibleTab(
        tab.windowId,
        { format: "png" },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
          }
          if (!dataUrl) {
            sendResponse({ error: "Screenshot capture failed" });
            return;
          }
          sendResponse({ screenshotUrl: dataUrl });
        }
      );
    }
  );
}

function captureSenderTab(tab, sendResponse) {
  // Incognito: skip captureTab — it often fails or no-ops in Chrome private windows.
  if (tab.incognito || !chrome.tabs.captureTab) {
    captureVisibleSenderTab(tab, sendResponse);
    return;
  }

  chrome.tabs.captureTab(tab.id, { format: "png" }, (dataUrl) => {
    if (chrome.runtime.lastError || !dataUrl) {
      captureVisibleSenderTab(tab, sendResponse);
      return;
    }
    sendResponse({ screenshotUrl: dataUrl });
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab?.url) {
    return;
  }
  if (!isAllowedSenderUrl(tab.url)) {
    return;
  }
  ensureScriptsInjected(tabId).catch(() => {
    // Ignore transient injection errors (tab closed, restricted page, etc.).
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.name) {
    return false;
  }

  if (sender.id !== chrome.runtime.id) {
    sendResponse({ error: "Unauthorized extension sender" });
    return false;
  }

  if (request.name === "ensureInjected") {
    const tabId = request.tabId;
    if (!tabId) {
      sendResponse({ error: "Missing tabId" });
      return false;
    }

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        sendResponse({
          error: chrome.runtime.lastError?.message || "Tab not found",
        });
        return;
      }
      if (!isAllowedSenderUrl(tab.url)) {
        sendResponse({
          error: `Not a Dynamics tab:\n${tab.url || "(no url)"}`,
        });
        return;
      }

      ensureScriptsInjected(tabId)
        .then(() => sendResponse({ ok: true, url: tab.url, incognito: !!tab.incognito }))
        .catch((error) =>
          sendResponse({ error: error.message || String(error) })
        );
    });
    return true;
  }

  if (request.name !== "screenshot") {
    return false;
  }

  if (
    !sender.tab ||
    !sender.tab.id ||
    !isAllowedSenderUrl(sender.url || sender.tab.url)
  ) {
    sendResponse({ error: "Unauthorized sender" });
    return false;
  }

  captureSenderTab(sender.tab, sendResponse);
  return true;
});
