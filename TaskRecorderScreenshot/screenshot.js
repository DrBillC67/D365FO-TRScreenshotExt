/**
 * Isolated-world content script.
 * - Installs #screenshotExtensionIsInstalled for Task Recorder detection
 * - Handles MAIN-world bridge requests (native + jQuery "screenshot" events)
 * - Delivers a single bare PNG data URL via postMessage (classic protocol)
 */

const MARKER_ID = "screenshotExtensionIsInstalled";
const BRIDGE_SOURCE = "task-recorder-screenshot-bridge";
const CAPTURE_DEBOUNCE_MS = 400;
const DEBUG = false;

let lastCaptureStartedAt = 0;
let captureInFlight = false;

function log(...args) {
  if (DEBUG) {
    console.info("[TaskRecorderScreenshot]", ...args);
  }
}

function logError(...args) {
  console.error("[TaskRecorderScreenshot]", ...args);
}

function ensureInstallMarker() {
  if (document.getElementById(MARKER_ID)) {
    return;
  }
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", ensureInstallMarker, {
      once: true,
    });
    return;
  }
  const marker = document.createElement("div");
  marker.id = MARKER_ID;
  document.body.appendChild(marker);
}

function cropTaskRecorderPane(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const ratio = window.devicePixelRatio || 1;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(dataUrl);
          return;
        }

        canvas.width = window.innerWidth * ratio;
        canvas.height = window.innerHeight * ratio;

        const asidePane = document.getElementById("asidePane");
        const paneWidth = asidePane ? asidePane.clientWidth * ratio : 0;
        const sourceWidth = Math.max(canvas.width - paneWidth, 1);

        context.drawImage(
          image,
          0,
          0,
          sourceWidth,
          canvas.height,
          0,
          0,
          canvas.width,
          canvas.height
        );
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        logError("crop failed, using full image", error);
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function deliverScreenshot(dataUrl) {
  // Classic Task Recorder protocol: a single bare PNG data URL string.
  window.postMessage(dataUrl, window.location.origin);
  log("delivered screenshot to page");
}

function captureAndDeliver() {
  const now = Date.now();
  if (captureInFlight || now - lastCaptureStartedAt < CAPTURE_DEBOUNCE_MS) {
    log("capture skipped (debounce/in-flight)");
    return;
  }

  lastCaptureStartedAt = now;
  captureInFlight = true;

  chrome.runtime.sendMessage({ name: "screenshot" }, (response) => {
    const finish = () => {
      captureInFlight = false;
    };

    if (chrome.runtime.lastError) {
      logError(chrome.runtime.lastError.message);
      finish();
      return;
    }
    if (!response || response.error || !response.screenshotUrl) {
      logError((response && response.error) || "No screenshot returned");
      finish();
      return;
    }

    cropTaskRecorderPane(response.screenshotUrl)
      .then(deliverScreenshot)
      .catch((error) => logError(error))
      .finally(finish);
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data) {
    return;
  }
  if (
    event.data.source === BRIDGE_SOURCE &&
    event.data.direction === "request"
  ) {
    captureAndDeliver();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id && sender.id !== chrome.runtime.id) {
    return false;
  }
  if (request && request.name === "ping") {
    ensureInstallMarker();
    sendResponse({
      ok: true,
      href: location.href,
      markerPresent: !!document.getElementById(MARKER_ID),
    });
    return false;
  }
  return false;
});

ensureInstallMarker();
log("ready on", location.href);
