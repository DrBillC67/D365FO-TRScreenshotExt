/**
 * Isolated-world content script.
 * - Installs #screenshotExtensionIsInstalled for Task Recorder detection
 * - Handles MAIN-world bridge requests (native + jQuery "screenshot" events)
 * - Delivers a single bare PNG data URL via postMessage (classic protocol)
 */

if (!globalThis.__trPlusScreenshotScriptLoaded) {
  globalThis.__trPlusScreenshotScriptLoaded = true;

  const MARKER_ID = "screenshotExtensionIsInstalled";
  const REQUEST_EVENT = "trplus:screenshot-request";
  // Task Recorder expects one image per request, in order, so requests are
  // queued rather than dropped. The cap bounds a runaway page.
  const MAX_PENDING_CAPTURES = 10;
  const DEBUG = false;

  let pendingCaptures = 0;
  let draining = false;

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

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not decode screenshot"));
      image.src = dataUrl;
    });
  }

  // Width in image pixels of the area left of the Task Recorder pane, or the
  // full image width when the pane is absent, hidden, or not docked right.
  function contentWidthInImage(imageWidth) {
    const asidePane = document.getElementById("asidePane");
    if (!asidePane) {
      return imageWidth;
    }
    const rect = asidePane.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    if (rect.width <= 0 || rect.left <= 0 || rect.right < viewportWidth - 1) {
      return imageWidth;
    }
    const scale = imageWidth / window.innerWidth;
    return Math.min(Math.max(Math.round(rect.left * scale), 1), imageWidth);
  }

  async function cropTaskRecorderPane(dataUrl) {
    try {
      const image = await loadImage(dataUrl);
      const width = contentWidthInImage(image.naturalWidth);
      if (width === image.naturalWidth) {
        return dataUrl;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        return dataUrl;
      }
      context.drawImage(image, 0, 0);
      return canvas.toDataURL("image/png");
    } catch (error) {
      logError("crop failed, using full image", error);
      return dataUrl;
    }
  }

  function deliverScreenshot(dataUrl) {
    window.postMessage(dataUrl, window.location.origin);
    log("delivered screenshot to page");
  }

  async function captureAndDeliver() {
    let response;
    try {
      response = await chrome.runtime.sendMessage({ name: "screenshot" });
    } catch (error) {
      logError(error.message || error);
      return;
    }
    if (!response || response.error || !response.screenshotUrl) {
      logError((response && response.error) || "No screenshot returned");
      return;
    }
    deliverScreenshot(await cropTaskRecorderPane(response.screenshotUrl));
  }

  async function drainCaptureQueue() {
    if (draining) {
      return;
    }
    draining = true;
    try {
      while (pendingCaptures > 0) {
        await captureAndDeliver();
        pendingCaptures -= 1;
      }
    } finally {
      draining = false;
    }
  }

  function requestCapture() {
    if (pendingCaptures >= MAX_PENDING_CAPTURES) {
      logError("capture queue full, request ignored");
      return;
    }
    pendingCaptures += 1;
    drainCaptureQueue();
  }

  document.addEventListener(REQUEST_EVENT, requestCapture);

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) {
      return false;
    }
    if (request && request.name === "ping") {
      ensureInstallMarker();
      sendResponse({
        ok: true,
        href: location.href,
        markerPresent: !!document.getElementById(MARKER_ID),
      });
    }
    return false;
  });

  ensureInstallMarker();
  log("ready on", location.href);
}
