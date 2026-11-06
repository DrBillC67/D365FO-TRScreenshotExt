# FAQ — D365FO TR Plus Screenshots

Answers to common questions about recording Dynamics 365 Finance and Operations (F&O) Task Recorder screenshots with this extension. See also the [quick reference](QUICK-REFERENCE.md) and the [README](../README.md).

## General

### What does this extension do?

It lets F&O Task Recorder take screenshots while you record. When **Capture screenshots** is **Yes**, Task Recorder asks for an image at each recorded step; the extension captures the visible F&O page, crops off the Task Recorder pane, and hands the image back to Task Recorder. The images appear when you export the recording as a Word document.

### How is this different from Microsoft’s original FMLab extension?

Microsoft’s [FMLab](https://github.com/microsoft/FMLab) extension (now archived) is Manifest V2, which current Chrome and Edge no longer run. This extension is a Manifest V3 rewrite that also:

- Runs only on F&O hosts, not every `*.dynamics.com` page.
- Captures only the F&O tab that asked, and only when it is the active tab.
- Crops screenshots without stretching them.
- Queues rapid requests instead of dropping them, and supports Task Recorder events sent through jQuery.
- Works in Incognito/InPrivate and includes a diagnostic popup.

For a detailed, side-by-side breakdown, see the [comparison with Microsoft’s original](COMPARISON.md).

### Which browsers are supported?

Google Chrome and Microsoft Edge (Chromium), version 116 or later, on Windows and Mac. Firefox and Safari are not supported.

### Is it in the Chrome Web Store or Edge Add-ons?

No. Install it with **Load unpacked** from the `TaskRecorderScreenshot` folder (see the [README](../README.md#install-unpacked)).

## Recording

### Can I take a screenshot manually, for example with a button next to Stop?

Not as part of the recording. Task Recorder decides when a screenshot is taken and which step it belongs to; the extension only answers those requests. An image sent without a request from Task Recorder is ignored, so a manual button could only save a picture outside the recording (for example to a file you paste into Word yourself).

Workarounds inside Task Recorder:

- Perform a UI action on the screen you want captured; each recorded step gets a screenshot.
- Use **Add info step** (right-click a control → **Task recorder**) to document something in text.
- Play the recording back to regenerate screenshots.

### Why didn’t some steps get a screenshot?

The most common cause is switching away from the F&O tab during recording. Chrome and Edge can only screenshot the tab that is in front, so the extension skips captures for a background tab rather than capture the wrong page. Keep the F&O tab active until you select **Stop**.

Other causes: site access isn’t **On all sites**, an enterprise policy blocks screenshots, or the content script didn’t load (run **Diagnose**).

### Where do the screenshots show up?

In the Word document from **Export as Word document**. They don’t appear as thumbnails in the Task Recorder pane.

### What exactly is captured?

The visible part of the F&O tab — what you see in the browser window, minus the Task Recorder pane on the right. It does not capture other tabs, other windows, the browser toolbar, or your desktop. Content scrolled out of view is not included.

### Why are the images so large or high-resolution?

Screenshots are taken at your display’s pixel density. On high-DPI displays (for example Retina or 150% Windows scaling) the images have 1.5–2× as many pixels as the page’s CSS size. Browser zoom also affects what is captured.

### Can I record in Incognito or InPrivate windows?

Yes. Turn on **Allow in Incognito** (Chrome) or **Allow in InPrivate** (Edge), then fully quit the browser and open a **new** private window. Set site access to **On all sites** again if the browser asks. Run **Diagnose** in the private window to confirm.

### Does Task Recorder still work in cloud-hosted environments?

Microsoft states that starting January 2026, Task Recordings can be created, edited, or used only in Sandbox and Production environments. The extension still supports `*.cloudax.dynamics.com` hosts, but Task Recorder itself may not be available there.

## Setup and troubleshooting

### Why does the extension need “On all sites” access?

Chromium’s screenshot API requires either access to all sites or a user click on the extension icon. Task Recorder requests screenshots from the page, not from a click, so all-sites access is the only option. The original Microsoft extension needed the same permission.

Even with this access, the extension only runs its scripts on the F&O hosts listed below.

### The “Capture screenshots” toggle doesn’t appear. What do I check?

1. The extension is enabled and shows version 2.3.1+.
2. Your F&O URL matches a [supported host](#which-environment-urls-are-supported).
3. Reload the F&O tab after installing or updating the extension.
4. Click the extension icon → **Diagnose this tab**. It should report “Marker present: true”.
5. In Incognito/InPrivate, follow the private-window steps above.

### Screenshots stopped working after an F&O update. What changed?

Check whether the feature **Upgrade three jQuery components libraries** is enabled in Feature management; it is known to break screenshot capture ([FMLab#20](https://github.com/microsoft/FMLab/issues/20)). Then run **Diagnose** and **Test capture now**.

### “Taking screenshots has been disabled” appears in the console

A browser or enterprise policy (for example `DisableScreenshots`) is blocking capture. Ask your IT administrator; the extension can’t override it.

### Which environment URLs are supported?

| Cloud | URL |
| --- | --- |
| Commercial | `NAME.operations.dynamics.com`, `NAME.sandbox.operations.dynamics.com` |
| Regional | `NAME.operations.{eu,fr,no,sa,ch,uae}.dynamics.com` |
| Cloud-hosted dev (legacy) | `NAME.cloudax.dynamics.com` |
| US Government (GCC) | `NAME.operations.gov.microsoftdynamics.us` |
| US Government (GCC High) | `NAME.operations.high.microsoftdynamics.us` |

All must be HTTPS.

### My environment URL isn’t recognized (on-premises or custom host)

Add your host in two places, then reload the extension:

1. `TaskRecorderScreenshot/manifest.json` — add `https://*.your.host/*` to **both** `content_scripts` `matches` lists.
2. `TaskRecorderScreenshot/hosts.js` — add `".your.host"` to `TR_ALLOWED_HOST_SUFFIXES`.

If you have Node.js, run `npm test`; it fails if the two lists don’t match.

### Why doesn’t it run on Dataverse / customer engagement pages (`*.crm.dynamics.com`)?

Those hosts can serve customer-authored pages (web resources). Running there would let any such page trigger screenshots, so the extension is limited to F&O hosts.

## Privacy and security

### Where do screenshots go? Are they uploaded anywhere?

Only to the F&O page that requested them. The extension posts each image back to Task Recorder in the same tab and keeps no copies. It makes no network requests and has no analytics. What F&O does with the images afterward (for example, the Word export) is governed by your F&O environment.

### Will screenshots include sensitive data?

Yes, if it is visible on screen. Close unrelated forms, use test data, and check the Word export before sharing it.

### Can a web page misuse the extension?

Only pages on the supported F&O hosts can request screenshots, and only of their own tab while it is active. Any script already running on your F&O page (including a cross-site scripting flaw in F&O) could request a capture of that page or block captures. This is inherent to how Task Recorder talks to the extension. See the [security notes](../README.md#security-notes).

## Updating and support

### How do I update to a new version?

Replace the `TaskRecorderScreenshot` folder, click **Reload** on the extension in `chrome://extensions` / `edge://extensions`, reload your F&O tabs, and run **Diagnose** to confirm the version. Open a new Incognito/InPrivate window if you use one.

### How do I check which version I have?

Click the extension icon → **Diagnose this tab**; the version is shown in the result. It’s also listed on the extensions page.

### How do I report a problem?

Include the output of **Diagnose this tab** and **Test capture now**, your browser and version, whether you were in a private window, and the F&O URL host (not the full URL if it contains sensitive data). Open the browser console (F12) on the F&O tab and include any lines starting with `[TaskRecorderScreenshot]`.
