# X Video Downloader v2.2.0

## What changed

- Added support for posts that expose more than one downloadable video/GIF item.
- Added a media-item picker in the popup before choosing a quality variant.
- Added a saved **Ask where to save each file** preference.
- Added a one-off **Save As…** button in the popup.
- Added **Alt-click** on the inline X/Twitter button to open Save As immediately.
- Added **Copy direct MP4 URL** in the popup.
- Hardened storage access so synced settings are restricted to trusted extension contexts.
- Improved inline-button injection so nested quoted posts are less likely to get the wrong button.
- Added lightweight URL-change rescanning for X/Twitter single-page navigation.
- Improved filename generation for multi-media posts and animated GIF labels.
- Expanded pasted-link parsing to support `/statuses/` and `/i/web/status/` URL shapes.
- Broadened MP4 URL acceptance to Twimg CDN hostnames ending in `twimg.com`.
