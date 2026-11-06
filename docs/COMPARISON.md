# Comparison: Microsoft FMLab original vs. D365FO TR Plus Screenshots

This document compares Microsoft’s original Task Recorder screenshot extension with this version.

| | Microsoft original | This version |
| --- | --- | --- |
| Name | Dynamics 365 for Finance and Operations Task Recorder Screenshot Extension | D365FO TR Plus Screenshots |
| Version | 1.0.0.2 | 2.3.1 |
| Source | [`microsoft/FMLab` → `FMLab/TaskRecorderScreenshot`](https://github.com/microsoft/FMLab/tree/master/FMLab/TaskRecorderScreenshot) (last changed August 2017; repository archived) | `TaskRecorderScreenshot/` in this repository |
| Manifest | V2 | V3 |
| Code | 3 files, about 50 lines | 7 files (plus icons), about 650 lines |
| Tests | None | 13 automated tests (unit and browser end-to-end) |

## Summary

The original is a minimal proof of concept: it listens for Task Recorder’s `screenshot` event, captures the visible tab, crops off the Task Recorder pane, and posts the image back to the page. It no longer runs on current Chrome or Edge because it uses Manifest V2, and it has several correctness and security gaps.

This version keeps the same page protocol, so Task Recorder needs no changes, and rebuilds everything around it: Manifest V3, a narrower host list, sender validation, a correct crop, a capture queue that respects Chrome’s rate limit, jQuery event support, Incognito/InPrivate support, a diagnostic popup, and automated tests.

## What stayed the same (Task Recorder compatibility)

Task Recorder in F&O talks to the extension through a small, undocumented page protocol. This version keeps every part of it:

| Protocol element | Both versions |
| --- | --- |
| Install detection | A `<div id="screenshotExtensionIsInstalled">` is added to the page; Task Recorder shows the **Capture screenshots** toggle when it exists. |
| Screenshot request | Task Recorder fires a `screenshot` event on `document`. |
| Screenshot reply | A single PNG data URL string sent with `window.postMessage(dataUrl, <page origin>)`. |
| Cropping | The Task Recorder pane (`#asidePane`) is cut off the right side of the image. |
| Capture API | `chrome.tabs.captureVisibleTab` (PNG). |

**Constraint learned the hard way:** Task Recorder treats *every* `window` message as a screenshot reply. Version 2.2.5 and the first 2.3.0 build used `window.postMessage` for their own internal request messages, and Task Recorder took those objects as the “image”, so Word exports had no screenshots. Since 2.3.1, the only thing this extension posts to the page is the PNG data URL, as in the original. A test enforces this.

## File-by-file mapping

| Original file | This version | Notes |
| --- | --- | --- |
| `manifest.json` | `manifest.json` | V2 → V3; narrower host matches; split Incognito mode; popup and icons. |
| `background.js` (8 lines) | `background.js` | Sender validation, active-tab check, throttled capture queue, content-script reinjection, popup-only actions. |
| `screenshot.js` (27 lines) | `screenshot.js` | Install marker, capture queue, corrected crop, PNG delivery. |
| — | `page-bridge.js` | New. Runs in the page’s own JavaScript context to catch jQuery-triggered `screenshot` events, and de-duplicates events. |
| — | `hosts.js` | New. Shared list of allowed F&O hosts. |
| — | `popup.html`, `popup.js` | New. **Diagnose this tab** and **Test capture now**. |
| — | `icons/` | New. 16, 32, 48 and 128 px icons. |

## Differences by area

| Area | Microsoft original | This version |
| --- | --- | --- |
| **Browser support** | Manifest V2. Chrome and Edge have phased out Manifest V2, so current versions don’t run it. | Manifest V3, Chrome/Edge 116+. |
| **Messaging APIs** | `chrome.extension.sendMessage` / `chrome.extension.onMessage` (deprecated aliases, not available in V3). | `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` with promises. |
| **Where it runs** | Every `https://*.dynamics.com/*` page, including Dataverse / customer engagement (`*.crm.dynamics.com`), which can host customer-authored pages. | F&O hosts only: `*.operations[.region].dynamics.com`, `*.cloudax.dynamics.com`, and the GCC / GCC High `*.operations.*.microsoftdynamics.us` hosts. |
| **GCC** | Requires editing the manifest by hand. | Included. |
| **Request validation** | None. Any page the content script runs on can trigger a capture. | The requesting frame **and** its tab must be HTTPS F&O hosts; popup-only actions reject content scripts. |
| **Which tab is captured** | `captureVisibleTab(null, …)` captures the active tab of the *last focused window*, which may not be the F&O tab that asked. | Captures only if the requesting F&O tab is the active tab in its own window; otherwise skips (fail-closed). |
| **Crop accuracy** | Draws the region left of the pane stretched across the full canvas width, so images are distorted horizontally (about 33% with a typical pane). | Canvas is sized to the cropped region and drawn 1:1 using the captured image’s real pixel size. |
| **Missing pane** | `document.getElementById('asidePane').clientWidth` throws if the pane is absent; no image is delivered. | Returns the full viewport image. |
| **Capture errors** | Not handled: a failed capture leaves `screenshotUrl` undefined and nothing is delivered, with no log. | Errors are caught and logged as `[TaskRecorderScreenshot] …`; the queue continues. |
| **Rapid requests** | Not handled; Chrome’s limit of 2 captures per second can make captures fail. | Requests queue in order (up to 10) and captures are spaced to stay under the limit. None are dropped. |
| **jQuery-triggered events** | Not received: jQuery custom events don’t reach listeners in the extension’s isolated context. | Received through `page-bridge.js`; a single event reaching both native and jQuery listeners produces one capture. |
| **Frames** | Top frame only. | Content scripts in F&O frames; reinjection into the top frame only. |
| **Incognito / InPrivate** | Not configured. | `"incognito": "split"`, plus automatic reinjection when Chrome Incognito misses the content script. |
| **Diagnostics** | None. | Toolbar popup: content-script check (with automatic injection), extension version, and a live test capture with preview. |
| **Permissions** | `tabs`, `<all_urls>`. | `tabs`, `scripting`, `<all_urls>` (host). `scripting` is used only for top-frame reinjection on F&O hosts. |
| **Icons** | None. | Transparent camera icon at 16, 32, 48 and 128 px. |
| **Documentation** | Steps in Microsoft Learn. | [README](../README.md), [quick reference](QUICK-REFERENCE.md), [FAQ](FAQ.md), this comparison. |
| **Tests** | None. | Unit tests (host list, manifest, permissions) and browser tests in Chrome for Testing (crop, queueing, rate limit, de-duplication, host rejection, message channel, popup). |

## Code side by side

### Handling a capture request (background)

Original — captures whatever is visible in the last focused window, for any requester:

```js
chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.name == 'screenshot') {
        chrome.tabs.captureVisibleTab(null, null, function(dataUrl) {
            sendResponse({ screenshotUrl: dataUrl });
        });
    }
    return true;
});
```

This version (simplified) — validates the requester, then queues a capture of that tab only if it is still active:

```js
case "screenshot":
  if (!sender.tab || !isAllowedDynamicsUrl(sender.url) || !isAllowedDynamicsUrl(sender.tab.url)) {
    sendResponse({ error: "Unauthorized sender" });
    return false;
  }
  return respond(
    enqueueCapture(sender.tab).then((screenshotUrl) => ({ screenshotUrl })),
    sendResponse
  );
```

`enqueueCapture` serializes captures, waits so calls stay under Chrome’s rate limit, confirms the tab is active in its window, then calls `captureVisibleTab` for that window.

### Cropping the Task Recorder pane (content script)

Original — sizes the canvas to the full viewport and stretches the narrower region into it:

```js
canvas.width = window.innerWidth * ratio;
canvas.height = window.innerHeight * ratio;
var taskRecorderPaneWidth = document.getElementById('asidePane').clientWidth * ratio;
context.drawImage(image, 0, 0, (canvas.width - taskRecorderPaneWidth), canvas.height,
                  0, 0, canvas.width, canvas.height);
```

This version — measures the pane’s position, scales by the real image size, and draws 1:1:

```js
const width = contentWidthInImage(image.naturalWidth);   // left edge of #asidePane, in image pixels
canvas.width = width;
canvas.height = image.naturalHeight;
context.drawImage(image, 0, 0);
```

## Issues in the original and how they are addressed

| # | Issue in the original | Impact | Addressed by |
| --- | --- | --- | --- |
| 1 | Manifest V2 and deprecated `chrome.extension.*` messaging | Doesn’t run on current Chrome/Edge | Manifest V3 rewrite |
| 2 | Runs on all `*.dynamics.com` pages | Customer-authored pages (for example Dataverse web resources) could trigger captures, including pixels of cross-origin iframes they embed | F&O-only host list in `manifest.json` and `hosts.js` |
| 3 | No sender validation | Any page with the content script can request a capture | Frame and tab URL checks in `background.js` |
| 4 | Captures the last focused window’s active tab | Can capture a different tab or window than the one that asked | Active-tab check for the requesting tab |
| 5 | Stretched crop | Distorted screenshots in every Word export | 1:1 crop using the image’s real size |
| 6 | Throws when `#asidePane` is missing | No image delivered | Full-image fallback |
| 7 | No error handling | Silent failures | Logged errors, queue keeps going |
| 8 | No rate limiting | Captures can fail under Chrome’s 2-per-second limit | Throttled capture queue |
| 9 | No jQuery event support | Requests triggered through jQuery are missed | `page-bridge.js` |
| 10 | No Incognito support or diagnostics | Hard to set up and troubleshoot | Split Incognito mode, reinjection, diagnostic popup |

## Remaining limitations (both versions)

- **Same-page trust:** any script already running on the F&O page can request a capture of that page or block captures. This is inherent to Task Recorder’s page protocol.
- **Active tab only:** Chromium’s capture API only captures the visible tab, so the F&O tab must stay in front while recording.
- **Broad permission:** `<all_urls>` is required for capture triggered by the page rather than a toolbar click.
- **No manual screenshots:** Task Recorder decides when screenshots are taken; see the [FAQ](FAQ.md#can-i-take-a-screenshot-manually-for-example-with-a-button-next-to-stop).
