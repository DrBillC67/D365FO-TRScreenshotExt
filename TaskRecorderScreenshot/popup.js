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

document.getElementById("diagnose").addEventListener("click", async () => {
  previewEl.replaceChildren();
  const tab = await getActiveTab();
  if (!tab) {
    setStatus("bad", "No active tab.");
    return;
  }

  if (!isDynamicsUrl(tab.url)) {
    setStatus(
      "bad",
      `Active tab is not a Dynamics host:\n${tab.url || "(no url)"}\n\nOpen your F&O page, then run Diagnose again.`
    );
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { name: "ping" });
    setStatus(
      "ok",
      `Content script is running.\nURL: ${response.href}\nMarker present: ${response.markerPresent}\n\nNext: confirm site access is On all sites, then Test capture now.`
    );
  } catch (error) {
    setStatus(
      "bad",
      `Content script is NOT running on this tab.\n${error.message}\n\nReload the Dynamics tab, confirm Allow in InPrivate, then try again.`
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

  setStatus("info", "Capturing…");

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

  // Edge does not implement chrome.tabs.captureTab; use captureVisibleTab for
  // the active tab (this popup only runs against the focused Dynamics tab).
  if (chrome.tabs.captureTab) {
    chrome.tabs.captureTab(tab.id, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, onCaptured);
        return;
      }
      showCapturePreview(dataUrl);
    });
  } else {
    chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, onCaptured);
  }
});
