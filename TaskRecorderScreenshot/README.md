# D365FO TR Plus Screenshots

Manifest V3 browser extension for **Google Chrome** and **Microsoft Edge** (Windows and Mac). It lets Dynamics 365 Finance and Operations Task Recorder capture screenshots of the active client tab.

There is no capture button for screenshots. Task Recorder drives capture when **Capture screenshots** is set to **Yes**.

## Install (unpacked)

1. Open Chrome or Edge.
2. Go to `chrome://extensions` or `edge://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select this `TaskRecorderScreenshot` folder.
5. Confirm the extension is enabled (**version 2.2.5+**, named **D365FO TR Plus Screenshots**). Look for the blue camera-style icon.
6. Turn on **Allow in Incognito** / **Allow in InPrivate**. After changing this (or after switching to a new extension version), fully quit the browser and open a **new** Incognito/InPrivate window — do not reuse an old private window.
7. Set site access to **On all sites** (Edge may show this as **Allowed on all sites**).  
   This is **required**. Chromium’s tab screenshot API does not work when access is limited to “specific sites,” even if those sites are Dynamics hosts. Microsoft’s original extension needed the same broad capture permission (`<all_urls>`).
8. In the Incognito/InPrivate window, confirm site access is still **On all sites**, reload the Dynamics tab, then open Task recorder with **Capture screenshots = Yes**.

Prefer **Load unpacked** from this folder. Do not commit or distribute `.pem` signing keys or `.crx` packages from local packs.

## Verify with the toolbar popup (easiest)

1. Open your F&O tab, click the extension icon.
2. Click **Diagnose this tab** — must say content script is running and marker present.
3. Click **Test capture now** — must show a preview image.
4. Export as Word document to see screenshots after recording.

## Permissions

| Permission | Why |
| --- | --- |
| `tabs` | Tab APIs used for capture |
| `<all_urls>` | Required by Chromium for `captureTab`. Must also be granted via **On all sites** in the browser UI. |
| `https://*.dynamics.com/*` | Content-script injection for cloud F&O |
| `https://*.microsoftdynamics.us/*` | Content-script injection for GCC |

Content scripts still inject **only** on Dynamics hosts. The service worker rejects capture unless the sender is this extension and the tab is an allowed Dynamics HTTPS host. Capture prefers `captureTab` in normal Chrome windows; for Incognito/InPrivate (and Edge) it uses `captureVisibleTab` only if that Dynamics tab is the active tab. The extension uses `"incognito": "split"` so private windows get their own extension instance (required for reliable Chrome Incognito capture).

## Why “On all sites” is required

| Site access setting | Result |
| --- | --- |
| **On all sites** | Capture API works; Task Recorder screenshots work |
| On specific sites (Dynamics only) | Content script may load, but capture fails with “`<all_urls>` or `activeTab` permission is required” |
| On click | Same capture failure for automated Task Recorder steps |

`activeTab` cannot replace this: Task Recorder triggers capture from the page, not from clicking the extension icon.

## Troubleshooting

- **Chrome Incognito: “Receiving end does not exist” / content script not running** — The page loaded without the content script. Reload extension to **2.2.5+**, keep **Allow in Incognito** on, quit Chrome, open a **new** Incognito window, set **On all sites**, open Dynamics, click **Diagnose** (it will try to inject). Or reload the Dynamics tab.
- **Chrome Incognito captures fail, normal Chrome works** — Same checklist as above; old Incognito windows can keep a stale extension state.
- **Only works with Allowed on all sites** — Expected. Keep that setting on.
- **Error: Either the `&lt;all_urls&gt;` or `activeTab` permission is required** — Site access is not **On all sites**. Change it in the extension toolbar menu or details page, then reload the tab.
- **No Capture screenshots toggle** — Extension not detected. Confirm `#screenshotExtensionIsInstalled` on the Dynamics page.
- **Toggle works but Word has no images** — Confirm **Test capture now** works, then record again with Capture screenshots = Yes.
- **Console: “Taking screenshots has been disabled”** — Browser/enterprise policy is blocking capture.
- **Known F&O feature conflict** — Disable **Upgrade three jQuery components libraries** if enabled ([FMLab#20](https://github.com/microsoft/FMLab/issues/20)).

## Security notes

- Capture requests are accepted only from this extension’s content scripts on HTTPS Dynamics / GCC hosts.
- Unknown message types are ignored.
- Capture is debounced. Chrome uses `captureTab`; Edge uses `captureVisibleTab` only when the Dynamics tab is active (fail-closed otherwise).
- If `#asidePane` is missing, the full tab image is returned instead of failing.
- **Residual trust:** any script running on the same Dynamics origin (including XSS on that page) can trigger capture and read the returned PNG via `postMessage`. That is inherent to the Task Recorder page protocol; harden the F&O environment accordingly.
- Never commit `*.pem` or `*.crx` signing artifacts (see repo `.gitignore`).
