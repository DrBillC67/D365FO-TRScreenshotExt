# Store listing — Chrome Web Store and Edge Add-ons

Draft text and answers for publishing **D365FO TR Plus Screenshots**. Copy each block into the matching field in the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole) or [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview). Review the forms when you submit, because store fields and limits change.

## Build the upload package

```bash
npm test
npm run package
```

Upload `dist/d365fo-tr-plus-screenshots-<version>-store.zip`. It has `manifest.json` at the zip root, as both stores require. The other file, `dist/TaskRecorderScreenshot-<version>.zip`, holds a `TaskRecorderScreenshot/` folder for people who unzip and **Load unpacked**; the stores reject it.

`npm run package` fails if the manifest is invalid, a referenced file is missing, the description is longer than 132 characters, or a `.pem`, `.crx`, `.zip`, or `.map` file is inside the extension folder.

Each upload needs a higher `version` in `TaskRecorderScreenshot/manifest.json` than the last published one.

## Before you submit

- [ ] Make the GitHub repository public (the privacy policy and support links point to it), or host [PRIVACY.md](PRIVACY.md) somewhere public.
- [ ] Confirm you may redistribute code derived from Microsoft’s FMLab sample. The [microsoft/FMLab](https://github.com/microsoft/FMLab) repository does not include a license file. This version is largely rewritten (see [COMPARISON.md](COMPARISON.md)), but check before publishing publicly.
- [ ] Chrome Web Store: pay the one-time $5 developer registration fee and verify the contact email.
- [ ] Take 1–5 screenshots at **1280×800** (or 640×400). Suggested shots:
  1. F&O with Task recorder open and **Capture screenshots = Yes**.
  2. The toolbar popup after **Diagnose this tab** reports the content script and marker.
  3. The popup after **Test capture now**, showing a preview.
  4. A Word export from Task Recorder with screenshots in the steps.
  
  Blur environment names, company data, and user names first.
- [ ] Create a small promo tile at **440×280** (required by Chrome). A marquee at 1400×560 is optional.
- [ ] Store icon: `TaskRecorderScreenshot/icons/icon128.png` (128×128).

## Listing fields

**Name** (from the manifest)

```
D365FO TR Plus Screenshots
```

**Summary / short description** (from the manifest, 97 of 132 characters)

```
Captures tab screenshots for Dynamics 365 Finance and Operations Task Recorder (Chrome and Edge).
```

**Category:** Productivity → Tools (Chrome). Productivity (Edge).

**Language:** English

**Homepage / support URL**

```
https://github.com/DrBillC67/D365FO-TRScreenshotExt
https://github.com/DrBillC67/D365FO-TRScreenshotExt/issues
```

**Detailed description**

```
Add screenshots to Dynamics 365 Finance and Operations Task Recorder in Chrome and Edge.

Task Recorder in Finance and operations can include a screenshot for every recorded step, but only when a screenshot extension is installed in the browser. This extension provides that capability using Manifest V3.

HOW TO USE
1. Install the extension and set its site access to "On all sites" (required by the browser’s screenshot API).
2. In Finance and operations, open Settings > Task recorder > Create recording.
3. Set "Capture screenshots" to Yes and start recording.
4. Keep the Finance and operations tab in front while you work. Each recorded step gets a screenshot, with the Task Recorder pane cropped out.
5. Stop the recording and choose "Export as Word document". The screenshots appear with the steps.

FEATURES
• Works with Task Recorder’s built-in "Capture screenshots" option. There is nothing extra to click while recording.
• Crops the Task Recorder pane out of each image without stretching, including on high-DPI displays.
• Queues fast steps and paces captures to stay within the browser’s screenshot rate limit, so steps are not dropped.
• Works in Incognito and InPrivate windows when allowed.
• Toolbar popup with "Diagnose this tab" and "Test capture now" for troubleshooting site access and setup.

SUPPORTED ENVIRONMENTS
Finance and operations hosts on operations.dynamics.com (including sandboxes), the regional clouds (eu, fr, no, sa, ch, uae), cloudax.dynamics.com, and the US Government clouds (GCC and GCC High). It does not run on other Dynamics 365 apps or other websites.

PRIVACY
Screenshots are returned only to the Finance and operations page that requested them. The extension does not send data anywhere, store data, or use analytics.

Source code, documentation, and FAQ: https://github.com/DrBillC67/D365FO-TRScreenshotExt

This extension is not affiliated with, sponsored by, or endorsed by Microsoft. Dynamics 365 is a trademark of the Microsoft group of companies.
```

## Privacy practices (Chrome “Privacy” tab)

**Single purpose**

```
Capture screenshots of the active Dynamics 365 Finance and Operations tab when that tab's Task Recorder requests them, and return the images to Task Recorder so that recordings and Word exports include step screenshots.
```

**Permission justifications**

`tabs`

```
The toolbar popup reads the URL of the active tab to tell the user whether it is a Finance and operations environment, and to diagnose setup problems. The URL must be readable even when the user has restricted the extension's site access, because that misconfiguration is the most common reason capture fails and the popup explains how to fix it. The background service worker also checks that the requesting tab is a Finance and operations host and is the active tab before capturing. URLs are not stored or sent anywhere.
```

`scripting`

```
Used only to inject the extension's own content scripts into the top frame of Finance and operations tabs when the browser did not inject them automatically (for example, in Chrome Incognito windows or after the extension is updated while the tab is open). The service worker refuses to inject into any other host. No remote code is injected.
```

Host permission (`<all_urls>`)

```
Required by chrome.tabs.captureVisibleTab. Task Recorder requests each screenshot from the web page, not from a click on the extension's toolbar button, so activeTab cannot be used. Chromium only permits page-triggered captureVisibleTab when the extension has the <all_urls> host permission, so access limited to specific sites makes capture fail. Content scripts are declared only for Finance and operations hosts, scripting is restricted to those hosts in code, and screenshots are taken only when the requesting frame and its tab are Finance and operations hosts.
```

**Are you using remote code?**

```
No. All JavaScript is included in the package. The extension makes no network requests.
```

**Data usage** — what user data the extension collects

- [x] **Website content.** The extension reads screenshots of the Finance and operations page. Check this box because the extension handles page images, even though they never leave the browser.
- [ ] Every other category (personally identifiable information, health, financial and payment, authentication, personal communications, location, web history, user activity) stays unchecked.

Certify all three statements:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL**

```
https://github.com/DrBillC67/D365FO-TRScreenshotExt/blob/main/docs/PRIVACY.md
```

## Distribution

- **Visibility:** Use **Unlisted** if only your team will install the extension from a direct link. Use **Public** to make it searchable. Chrome’s **Private** option is limited to a Google Workspace domain, which does not fit most Dynamics 365 tenants.
- **Regions:** All regions.
- **Enterprise deployment:** After publishing, admins can force-install the extension by its store ID using the `ExtensionInstallForcelist` policy (Chrome) or the Edge equivalent.

## Notes for reviewers (Chrome “Test instructions” / Edge “Notes for certification”)

```
This extension only activates on Microsoft Dynamics 365 Finance and Operations environments (for example https://NAME.operations.dynamics.com), which require an organizational Microsoft Entra account and a licensed environment, so we cannot provide test credentials.

Behavior you can check without an environment:
- On any other website the content scripts do not run, and the toolbar popup's "Diagnose this tab" reports that the active tab is not a Finance and operations host.
- The service worker only calls captureVisibleTab in response to a message from its own content script on a Finance and operations frame in the active tab, or from its own popup.

Why <all_urls>: Task Recorder requests screenshots from the page, not from a click on the action button, so activeTab does not apply and Chromium requires <all_urls> for captureVisibleTab. Scripting is limited to Finance and operations hosts in code.

The source code and an automated test suite (headless Chrome with simulated Finance and operations pages) are at https://github.com/DrBillC67/D365FO-TRScreenshotExt.
```

## Microsoft Edge Add-ons

Upload the same store zip in Partner Center (registration is free). Notes for the Edge forms:

- **Properties:** category Productivity, privacy policy URL as above (needed because the extension accesses page content), website and support URLs as above.
- **Store listing:** reuse the detailed description. The Edge description must be at least 250 characters. The store logo can reuse `icon128.png` (Edge recommends 300×300, so a larger render is worth making). Screenshots and promo tiles are optional on Edge but help with approval and discovery.
- **Availability:** Hidden is Edge’s equivalent of Unlisted.
- **Notes for certification:** use the reviewer notes above.

## Review expectations

The combination of `<all_urls>` and `scripting` usually triggers a longer manual review, which can take several days to a few weeks. Rejections usually cite unclear justifications or permissions the reviewer thinks are unused. If that happens, reply with the host permission justification above. It explains why neither `activeTab` nor specific-site access works for page-triggered capture.
