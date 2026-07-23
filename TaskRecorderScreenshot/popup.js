const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");

function setStatus(kind, message) {
  statusEl.className = kind;
  statusEl.textContent = message;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function isDynamicsUrl(url) {
  if (!url) {
    return false;
  }
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "dynamics.com" ||
      host.endsWith(".dynamics.com") ||
      host === "microsoftdynamics.us" ||
      host.endsWith(".microsoftdynamics.us")
    );
  } catch {
    return false;
  }
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

function runCapture(tab, onCaptured) {
  if (tab.incognito || !chrome.tabs.captureTab) {
    chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, onCaptured);
    return;
  }

  chrome.tabs.captureTab(tab.id, { format: "png" }, (dataUrl) => {
    if (chrome.runtime.lastError || !dataUrl) {
      chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, onCaptured);
      return;
    }
    onCaptured(dataUrl);
  });
}

async function ensureInjected(tab) {
  const result = await chrome.runtime.sendMessage({
    name: "ensureInjected",
    tabId: tab.id,
  });
  if (!result || result.error) {
    throw new Error((result && result.error) || "Injection failed");
  }
  return result;
}

async function pingTab(tab) {
  return chrome.tabs.sendMessage(tab.id, { name: "ping" });
}

document.getElementById("diagnose").addEventListener("click", async () => {
  previewEl.replaceChildren();
  const tab = await getActiveTab();
  if (!tab) {
    setStatus("bad", "No active tab.");
    return;
  }

  const mode = tab.incognito ? "Incognito/InPrivate" : "normal";

  if (!isDynamicsUrl(tab.url)) {
    setStatus(
      "bad",
      `Active tab is not a Dynamics host (${mode}):\n${tab.url || "(no url)"}\n\nOpen your F&O app tab (*.dynamics.com), then Diagnose again.\nLogin pages like microsoftonline.com will fail this check.`
    );
    return;
  }

  setStatus("info", `Checking content script on Dynamics tab (${mode})…`);

  try {
    let response;
    try {
      response = await pingTab(tab);
    } catch {
      await ensureInjected(tab);
      response = await pingTab(tab);
    }

    setStatus(
      "ok",
      `Content script is running (${mode}).\nURL: ${response.href}\nMarker present: ${response.markerPresent}\n\nNext: confirm site access is On all sites, then Test capture now.`
    );
  } catch (error) {
    setStatus(
      "bad",
      `Content script is NOT running (${mode}).\n${error.message}\n\n` +
        `URL: ${tab.url}\n\n` +
        "Fix checklist:\n" +
        "1) chrome://extensions → version 2.2.5+, Allow in Incognito ON\n" +
        "2) Fully quit Chrome, open a NEW Incognito window\n" +
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
  if (!isDynamicsUrl(tab.url)) {
    setStatus("bad", "Switch to a Dynamics tab first.");
    return;
  }

  setStatus("info", "Ensuring content script, then capturing…");

  try {
    try {
      await pingTab(tab);
    } catch {
      await ensureInjected(tab);
    }
  } catch (error) {
    setStatus(
      "bad",
      `Could not inject content script:\n${error.message}\n\nReload the Dynamics tab and confirm Allow in Incognito + On all sites.`
    );
    return;
  }

  const onCaptured = (dataUrl) => {
    if (chrome.runtime.lastError) {
      setStatus(
        "bad",
        capturePermissionHelp(chrome.runtime.lastError.message)
      );
      return;
    }
    if (!dataUrl) {
      setStatus("bad", "Capture returned no image.");
      return;
    }
    showCapturePreview(dataUrl);
  };

  runCapture(tab, onCaptured);
});
