# D365FO TR Plus Screenshots

Manifest V3 browser extension for **Google Chrome** and **Microsoft Edge** (Windows and Mac). It lets Dynamics 365 Finance and Operations Task Recorder capture screenshots of the active client tab.

There is no capture button for screenshots. Task Recorder drives capture when **Capture screenshots** is set to **Yes**.

**New here?** Start with the [quick reference](docs/QUICK-REFERENCE.md) or the [FAQ](docs/FAQ.md).

## Repository layout

| Path | Purpose |
| --- | --- |
| `TaskRecorderScreenshot/` | The extension. Load this folder unpacked. |
| `TaskRecorderScreenshot/manifest.json` | Extension manifest (name, version, permissions, F&O host matches) |
| `TaskRecorderScreenshot/hosts.js` | Allowed Finance and operations host list, shared by the service worker and popup |
| `TaskRecorderScreenshot/background.js` | Service worker: throttled tab capture and content-script reinjection |
| `TaskRecorderScreenshot/page-bridge.js` | Page-world listener for Task Recorder `screenshot` events |
| `TaskRecorderScreenshot/screenshot.js` | Content script: install marker, capture queue, crop, and deliver PNG to the page |
| `TaskRecorderScreenshot/popup.html`, `popup.js` | Toolbar popup for diagnosing and testing capture |
| `docs/` | [Quick reference](docs/QUICK-REFERENCE.md) and [FAQ](docs/FAQ.md) |
| `tests/` | Unit tests and browser end-to-end tests (see [Testing](#testing)) |

## Supported hosts

Content scripts run only on Finance and operations environment URLs:

| Cloud | Environment URL |
| --- | --- |
| Commercial (US and default) | `https://NAME.operations.dynamics.com`, `https://NAME.sandbox.operations.dynamics.com` |
| Regional | `https://NAME.operations.{eu,fr,no,sa,ch,uae}.dynamics.com` |
| Cloud-hosted dev (legacy) | `https://NAME.cloudax.dynamics.com` |
| US Government (GCC) | `https://NAME.operations.gov.microsoftdynamics.us` |
| US Government (GCC High) | `https://NAME.operations.high.microsoftdynamics.us` |

Other Dynamics hosts, such as Dataverse / customer engagement (`*.crm.dynamics.com`), are intentionally excluded because they can serve customer-authored pages.

**On-premises or other hosts:** add the host to both content script `matches` lists in `manifest.json` and to `TR_ALLOWED_HOST_SUFFIXES` in `hosts.js` (for example `https://*.ax.contoso.com/*` and `".ax.contoso.com"`), then run `npm test` — a test fails if the two lists drift apart.

## Install (unpacked)

1. Open Chrome or Edge.
2. Go to `chrome://extensions` or `edge://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select the `TaskRecorderScreenshot` folder in this repository (not the repository root).
5. Confirm the extension is enabled (**version 2.3.0+**, named **D365FO TR Plus Screenshots**). Look for the blue camera-style icon.
6. Turn on **Allow in Incognito** / **Allow in InPrivate**. After changing this (or after switching to a new extension version), fully quit the browser and open a **new** Incognito/InPrivate window — do not reuse an old private window.
7. Set site access to **On all sites** (Edge may show this as **Allowed on all sites**).  
   This is **required**. Chromium’s tab screenshot API does not work when access is limited to “specific sites,” even if those sites are Dynamics hosts. Microsoft’s original extension needed the same broad capture permission (`<all_urls>`).
8. In the Incognito/InPrivate window, confirm site access is still **On all sites**, reload the Dynamics tab, then open Task recorder with **Capture screenshots = Yes**.

Prefer **Load unpacked** from the `TaskRecorderScreenshot` folder. Do not commit or distribute `.pem` signing keys or `.crx` packages from local packs.

## Usage

1. Open Task recorder in F&O (**Settings** → **Task recorder**) and select **Create recording**.
2. Set **Capture screenshots** to **Yes**, then **Start**.
3. Perform the business process. **Keep the F&O tab in front** while recording — Chromium can only screenshot the active tab, so captures requested while you are on another tab are skipped. Task Recorder requests a screenshot for each recorded step; the extension crops out the Task Recorder pane and returns the image.
4. Select **Stop**, then **Export as Word document**. Screenshots appear in the Word export, not as step thumbnails in the Task Recorder pane.

## Verify with the toolbar popup (easiest)

1. Open your F&O tab, click the extension icon.
2. Click **Diagnose this tab** — must say content script is running and marker present, and shows the installed extension version. If the content script is missing (common in Chrome Incognito), Diagnose injects it automatically and checks again.
3. Click **Test capture now** — must show a preview image. It also injects the content script first if needed.
4. Record with **Capture screenshots = Yes** and export as a Word document to see the screenshots.

## Permissions

| Permission | Why |
| --- | --- |
| `tabs` | Read the active tab’s URL so the popup can explain misconfigured site access |
| `scripting` | Reinjects content scripts into the top frame of F&O tabs when automatic injection is missed (Chrome Incognito, after extension reload) |
| `<all_urls>` | Required by Chromium for `captureVisibleTab` when capture is triggered by the page rather than a toolbar click. Must also be granted via **On all sites** in the browser UI. |

`<all_urls>` combined with `scripting` is broad: the browser would let this extension inject into any site. The code only injects into the F&O hosts above, only into the top frame, and only when the content script is not already running. Review updates to this extension before installing them.

## How capture works

1. Task Recorder fires a `screenshot` event (native DOM or jQuery). `page-bridge.js` turns each event into exactly one capture request, even when the event reaches both the native and jQuery listeners.
2. `screenshot.js` queues requests in order (up to 10 pending) so none are dropped when steps fire quickly.
3. The service worker checks that the request came from this extension on an F&O frame in an F&O tab, waits so captures stay under Chromium’s limit of 2 per second, confirms the tab is still the active tab, and calls `captureVisibleTab`.
4. `screenshot.js` crops off the Task Recorder pane (`#asidePane`) at 1:1 scale and posts the PNG data URL back to the page. If the pane is missing or hidden, the full viewport image is returned.

## Why “On all sites” is required

| Site access setting | Result |
| --- | --- |
| **On all sites** | Capture API works; Task Recorder screenshots work |
| On specific sites (Dynamics only) | Content script may load, but capture fails with “`<all_urls>` or `activeTab` permission is required” |
| On click | Same capture failure for automated Task Recorder steps |

`activeTab` cannot replace this: Task Recorder triggers capture from the page, not from clicking the extension icon.

## Troubleshooting

- **Chrome Incognito: “Receiving end does not exist” / content script not running** — The page loaded without the content script. Reload the extension to **2.3.0+**, keep **Allow in Incognito** on, quit Chrome, open a **new** Incognito window, set **On all sites**, open Dynamics, and click **Diagnose** (it will try to inject). Or reload the Dynamics tab.
- **Chrome Incognito captures fail, normal Chrome works** — Same checklist as above; old Incognito windows can keep a stale extension state.
- **Diagnose says the active tab is not a Finance and operations host** — You are on a sign-in page (for example `login.microsoftonline.com`), another site, or an F&O host not in [Supported hosts](#supported-hosts). Switch to the F&O tab, or add your host.
- **Only works with Allowed on all sites** — Expected. Keep that setting on.
- **Error: Either the `<all_urls>` or `activeTab` permission is required** — Site access is not **On all sites**. Change it in the extension toolbar menu or details page, then reload the tab.
- **Capture skipped: Dynamics tab is not the active tab** — Keep the F&O tab in front while recording.
- **No Capture screenshots toggle** — Extension not detected. Confirm `#screenshotExtensionIsInstalled` exists on the Dynamics page and the host is in [Supported hosts](#supported-hosts).
- **Toggle works but Word has no images** — Confirm **Test capture now** works, then record again with **Capture screenshots = Yes**.
- **Console: “Taking screenshots has been disabled”** — Browser/enterprise policy is blocking capture.
- **Known F&O feature conflict** — Disable **Upgrade three jQuery components libraries** if enabled ([FMLab#20](https://github.com/microsoft/FMLab/issues/20)).

## Security notes

- Content scripts run only on the F&O hosts listed in [Supported hosts](#supported-hosts), never on other `*.dynamics.com` pages.
- Capture requests are accepted only from this extension’s content scripts when both the requesting frame and its tab are HTTPS F&O hosts.
- Reinjection and popup test capture are accepted only from the extension popup; content scripts cannot call them.
- Capture is fail-closed: it only runs when the F&O tab is the active tab in its window.
- Unknown message types are ignored.
- **Residual trust:** any script running on the same F&O origin (including XSS on that page) can trigger capture and read the returned PNG via `postMessage`, or block captures entirely. That is inherent to the Task Recorder page protocol; harden the F&O environment accordingly.
- Never commit `*.pem` or `*.crx` signing artifacts (excluded in [`.gitignore`](.gitignore)).

## Testing

Requires Node.js 22.12+ and OpenSSL. Puppeteer is a test-only dependency; nothing from `node_modules` ships in the extension.

```bash
npm install                             # Puppeteer's postinstall is denied in package.json (allowScripts)
npx puppeteer browsers install chrome   # so download Chrome for Testing explicitly
npm test                                # unit + end-to-end
npm run test:unit                       # host allow-list and manifest checks only
```

The end-to-end tests load the unpacked extension into headless Chrome for Testing and serve fake pages over local HTTPS (hosts are mapped to `127.0.0.1`). They cover cropping without distortion, request de-duplication and queueing, the capture rate limit, top-frame-only reinjection, rejection of non-F&O hosts and of popup-only messages from content scripts, and the toolbar popup.
