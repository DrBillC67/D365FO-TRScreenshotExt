# Privacy policy — D365FO TR Plus Screenshots

_Last updated: November 6, 2026_

D365FO TR Plus Screenshots ("the extension") is a browser extension for Google Chrome and Microsoft Edge that supplies screenshots to the Task Recorder in Microsoft Dynamics 365 Finance and Operations.

## What the extension accesses

- **Screenshots of the visible F&O tab.** When Task Recorder (with **Capture screenshots** set to **Yes**) requests a screenshot, the extension captures the visible area of the active Finance and operations tab, crops off the Task Recorder pane, and hands the PNG image back to that same F&O page. Task Recorder then stores it in the recording, which is governed by your organization’s Dynamics 365 environment and Microsoft’s terms.
- **The active tab’s URL.** The toolbar popup reads the URL of the active tab only to tell you whether it is a Finance and operations host and to show diagnostics. The URL is displayed in the popup and is not stored.

## What the extension does not do

- It does not send screenshots, URLs, or any other data to the developer or to any third party. It makes no network requests of its own.
- It does not store data. Screenshots exist only in memory long enough to be cropped and returned to the page.
- It does not use analytics, tracking, advertising, cookies, or remote code.
- It does not run on sites other than Finance and operations environment hosts (see the [supported hosts](../README.md#supported-hosts)).
- It does not sell, transfer, or use data for any purpose other than the single purpose described above, and does not use data to determine creditworthiness or for lending.

## Permissions

The extension requests `tabs`, `scripting`, and access to all sites. The [README](../README.md#permissions) explains why each is needed. Access to all sites is required by the browser’s screenshot API; content scripts still run only on Finance and operations hosts.

## Changes

Changes to this policy are published in this file in the [project repository](https://github.com/DrBillC67/D365FO-TRScreenshotExt).

## Contact

Open an issue at <https://github.com/DrBillC67/D365FO-TRScreenshotExt/issues>.

This extension is not affiliated with, sponsored by, or endorsed by Microsoft.
