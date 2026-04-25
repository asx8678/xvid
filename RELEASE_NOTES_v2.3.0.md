# X Video Downloader v2.3.0

## What changed

- Added **Download all media** in the popup for posts that expose more than one video/GIF item.
- Added a background `downloadAll` action that starts multi-media downloads sequentially, which is friendlier to Save As dialogs and the Chrome downloads API.
- Made popup runtime messaging safer so buttons are re-enabled even if the service worker/runtime message fails unexpectedly.
- Added `activeTab` permission so popup auto-detection of the current post is more reliable after clicking the extension action.
- Added support for `mobile.twitter.com` URLs in host permissions/content-script matching.
- Improved URL parsing so non-X/Twitter URLs that merely contain `/status/123...` are rejected.
- Improved variant extraction by accepting numeric bitrate values that arrive as strings while continuing to reject non-Twimg/non-HTTPS URLs.
- Improved inline-button accessibility labels and guarded the click handler against non-Element event targets.
- Added responsive popup CSS for narrower browser windows.
- Added a README with install and usage instructions.

## Validation performed

- `node --check background.js`
- `node --check content.js`
- `node --check popup.js`
- `python3 -m json.tool manifest.json`
- Static check that every `popup.js` `getElementById()` reference exists in `popup.html`.
