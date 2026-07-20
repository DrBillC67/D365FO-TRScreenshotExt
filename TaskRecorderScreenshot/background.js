/**
 * Service worker: captures the requesting Dynamics tab for Task Recorder.
 *
 * Prefer chrome.tabs.captureTab (Chrome). Edge does not expose captureTab, so
 * fall back to captureVisibleTab only when the sender tab is still the active
 * tab in that window (avoids leaking another tab's pixels).
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

      chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
          return;
        }
        if (!dataUrl) {
          sendResponse({ error: "Screenshot capture failed" });
          return;
        }
        sendResponse({ screenshotUrl: dataUrl });
      });
    }
  );
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || request.name !== "screenshot") {
    return false;
  }

  if (sender.id !== chrome.runtime.id) {
    sendResponse({ error: "Unauthorized extension sender" });
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

  const tab = sender.tab;

  if (chrome.tabs.captureTab) {
    chrome.tabs.captureTab(tab.id, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        // Edge/Chromium builds may list captureTab but fail at runtime.
        captureVisibleSenderTab(tab, sendResponse);
        return;
      }
      sendResponse({ screenshotUrl: dataUrl });
    });
  } else {
    captureVisibleSenderTab(tab, sendResponse);
  }

  return true;
});
