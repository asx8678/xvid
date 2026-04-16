# X Video Downloader v2.0.0

## What changed

- Added a toolbar popup so you can paste an X/Twitter post URL or analyze the current post.
- Added manual quality selection for exposed MP4 variants.
- Added a saved default quality preference for the inline tweet button.
- Added Shift-click on the inline button to open the quality picker for that specific post.
- Improved download filenames with username, tweet ID, resolution, bitrate, and a short text snippet.
- Improved service worker validation, caching, and error messages.
- Made action-bar detection more resilient to X/Twitter DOM changes.
- Added better hover/success/error states for the injected inline button.

## Load in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select the extracted extension folder

Or pack the folder into a `.crx` from the Extensions page if you want a signed local package.
