const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");
const EXTENSION_VERSION = chrome.runtime.getManifest().version;

function setStatus(kind, message) {
  statusEl.className = kind;
  statusEl.textContent = message;
}

// F&O URLs carry long encoded page state in the query string; it adds noise
// and can contain record identifiers, so show only the origin and path.
function displayUrl(urlString) {
  if (!urlString) {
    return "(no url)";
  }
  try {
    const url = new URL(urlString);
    return url.origin + url.pathname;
  } catch {
    return urlString;
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function capturePermissionHelp(message) {
  const lower = (message || "").toLowerCase();
  if (
    lower.includes("<all_urls>") ||
    lower.includes("all_urls") ||
    lower.includes("activetab")
  ) {
    return (
      `${message}\n\n` +
      "Fix: set this extension’s site access to On all sites " +
      "(toolbar menu → Site access → On all sites), then reload the Dynamics tab.\n" +
      "Specific-site access is not enough for Chromium’s screenshot API."
    );
  }
  if (lower.includes("disabled")) {
    return (
      `${message}\n\n` +
      "An enterprise policy may be blocking screenshots on this device."
    );
  }
  return message;
}

function showCapturePreview(dataUrl) {
  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "Capture preview";
  previewEl.appendChild(img);
  setStatus(
    "ok",
    "Capture API works with current site access.\nKeep On all sites enabled for Task Recorder."
  );
}

async function sendToBackground(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result || result.error) {
    throw new Error((result && result.error) || `${message.name} failed`);
  }
  return result;
}

async function pingTab(tab) {
  return chrome.tabs.sendMessage(tab.id, { name: "ping" }, { frameId: 0 });
}

async function ensureContentScript(tab) {
  try {
    return await pingTab(tab);
  } catch {
    await sendToBackground({ name: "ensureInjected", tabId: tab.id });
    return pingTab(tab);
  }
}

document.getElementById("diagnose").addEventListener("click", async () => {
  previewEl.replaceChildren();
  const tab = await getActiveTab();
  if (!tab) {
    setStatus("bad", "No active tab.");
    return;
  }

  const mode = tab.incognito ? "Incognito/InPrivate" : "normal";

  if (!isAllowedDynamicsUrl(tab.url)) {
    setStatus(
      "bad",
      `Active tab is not a Finance and operations host (${mode}):\n${displayUrl(tab.url)}\n\n` +
        "Open your F&O app tab (for example *.operations.dynamics.com), then Diagnose again.\n" +
        "Login pages like microsoftonline.com will fail this check."
    );
    return;
  }

  setStatus("info", `Checking content script on Dynamics tab (${mode})…`);

  try {
    const response = await ensureContentScript(tab);
    setStatus(
      "ok",
      `Content script is running (${mode}).\nExtension version: ${EXTENSION_VERSION}\n` +
        `URL: ${displayUrl(response.href)}\nMarker present: ${response.markerPresent}\n\n` +
        "Next: confirm site access is On all sites, then Test capture now."
    );
  } catch (error) {
    setStatus(
      "bad",
      `Content script is NOT running (${mode}).\n${error.message}\n\n` +
        `URL: ${displayUrl(tab.url)}\nExtension version: ${EXTENSION_VERSION}\n\n` +
        "Fix checklist:\n" +
        "1) Extensions page → this extension enabled, Allow in Incognito ON\n" +
        "2) Fully quit the browser, open a NEW Incognito/InPrivate window\n" +
        "3) Site access → On all sites (check again inside Incognito)\n" +
        "4) Reload this Dynamics tab, then Diagnose again"
    );
  }
});

document.getElementById("testCapture").addEventListener("click", async () => {
  previewEl.replaceChildren();
  const tab = await getActiveTab();
  if (!tab) {
    setStatus("bad", "No active tab.");
    return;
  }
  if (!isAllowedDynamicsUrl(tab.url)) {
    setStatus("bad", "Switch to a Finance and operations tab first.");
    return;
  }

  setStatus("info", "Ensuring content script, then capturing…");

  try {
    await ensureContentScript(tab);
  } catch (error) {
    setStatus(
      "bad",
      `Could not inject content script:\n${error.message}\n\nReload the Dynamics tab and confirm Allow in Incognito + On all sites.`
    );
    return;
  }

  try {
    const { screenshotUrl } = await sendToBackground({
      name: "testCapture",
      tabId: tab.id,
    });
    showCapturePreview(screenshotUrl);
  } catch (error) {
    setStatus("bad", capturePermissionHelp(error.message));
  }
});
