# Quick reference — D365FO TR Plus Screenshots

One-page cheat sheet for recording Task Recorder business processes with screenshots in Dynamics 365 Finance and Operations (F&O). For full details see the [README](../README.md); for common questions see the [FAQ](FAQ.md).

## One-time setup

| Step | Where | Setting |
| --- | --- | --- |
| 1 | `chrome://extensions` or `edge://extensions` | **Developer mode** on |
| 2 | Same page | **Load unpacked** → select the `TaskRecorderScreenshot` folder |
| 3 | Extension details | **Allow in Incognito** / **Allow in InPrivate** on (if you record in private windows) |
| 4 | Extension toolbar menu or details | Site access → **On all sites** (required) |
| 5 | F&O tab | Reload the page |

Confirm the extension shows **version 2.3.0+**.

## Record with screenshots

1. **Settings** (gear) → **Task recorder** → **Create recording**.
2. Enter a name, set **Capture screenshots = Yes**, select **Start**.
3. Perform the process. **Keep the F&O tab in front** the whole time.
4. Select **Stop** (top of the page).
5. Select **Export as Word document** — screenshots are in the Word file.

## Check that it works

Click the extension icon on the F&O tab:

| Button | Expected result |
| --- | --- |
| **Diagnose this tab** | Green: “Content script is running”, marker present, extension version |
| **Test capture now** | Green, with a preview image of the page |

## Do and don’t

| Do | Don’t |
| --- | --- |
| Keep the F&O tab active while recording | Switch tabs or windows mid-recording (those steps get no image) |
| Use **On all sites** site access | Limit site access to specific sites or “On click” |
| Open a **new** Incognito/InPrivate window after changing extension settings | Reuse a private window opened before the change |
| Close or mask sensitive data before recording | Assume screenshots hide anything visible on screen |
| Turn off **Upgrade three jQuery components libraries** if screenshots stop | Expect step thumbnails in the Task Recorder pane |

## Quick fixes

| Symptom | Fix |
| --- | --- |
| No **Capture screenshots** toggle | Extension disabled, wrong host, or tab not reloaded. Run **Diagnose**. |
| “`<all_urls>` or `activeTab` permission is required” | Set site access to **On all sites**, reload the tab. |
| “Not the active tab” | Bring the F&O tab to the front and continue. |
| “Content script is NOT running” (Incognito) | Allow in Incognito on → quit browser → new private window → reload F&O. |
| Word export has no images | **Test capture now** must work; then record again with the toggle on. |
| “Taking screenshots has been disabled” | Browser or enterprise policy blocks capture — contact IT. |
| Host not recognized | Your URL isn’t a supported F&O host — see [FAQ: on-premises and other hosts](FAQ.md#my-environment-url-isnt-recognized-on-premises-or-custom-host). |

## Supported environment URLs

- `NAME.operations.dynamics.com` and `NAME.sandbox.operations.dynamics.com`
- `NAME.operations.{eu,fr,no,sa,ch,uae}.dynamics.com`
- `NAME.cloudax.dynamics.com` (legacy cloud-hosted dev)
- `NAME.operations.gov.microsoftdynamics.us` (GCC), `NAME.operations.high.microsoftdynamics.us` (GCC High)

## Updating the extension

1. Replace the `TaskRecorderScreenshot` folder with the new version.
2. On the extensions page, click **Reload** on the extension.
3. Reload F&O tabs (and open a new Incognito/InPrivate window if you use one).
4. Run **Diagnose** to confirm the new version number.
