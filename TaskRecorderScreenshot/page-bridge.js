/**
 * Runs in the page's MAIN world (not the extension isolated world).
 * Task Recorder may fire "screenshot" via native DOM events and/or jQuery;
 * jQuery custom events do not reach isolated-world addEventListener handlers.
 */
(function () {
  if (globalThis.__trPlusPageBridgeLoaded) {
    return;
  }
  globalThis.__trPlusPageBridgeLoaded = true;

  const SOURCE = "task-recorder-screenshot-bridge";
  let lastEvent = null;

  function requestCapture(event) {
    // A native dispatch reaches both the native listener and jQuery's handler
    // (as event.originalEvent); request only one capture per event.
    const nativeEvent = (event && event.originalEvent) || event;
    if (nativeEvent && nativeEvent === lastEvent) {
      return;
    }
    lastEvent = nativeEvent;

    window.postMessage(
      {
        source: SOURCE,
        direction: "request",
        requestId: String(Date.now()) + Math.random().toString(16).slice(2),
      },
      window.location.origin
    );
  }

  document.addEventListener("screenshot", requestCapture, true);

  function hookJQuery() {
    const jq = window.jQuery || window.$;
    if (!jq || !jq.fn || jq.__trScreenshotHooked) {
      return !!jq;
    }
    jq.__trScreenshotHooked = true;
    jq(document).on("screenshot.taskRecorderScreenshot", requestCapture);
    return true;
  }

  hookJQuery();
  const timer = window.setInterval(() => {
    if (hookJQuery()) {
      window.clearInterval(timer);
    }
  }, 500);
  window.setTimeout(() => window.clearInterval(timer), 60000);
})();
