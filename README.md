# X Video Downloader

A local Chrome/Chromium Manifest V3 extension for downloading MP4 video variants exposed by X/Twitter posts.

## Features

- Inline download button on X/Twitter posts with videos.
- Toolbar popup for pasting a post URL or status ID.
- Automatic popup prefill from the current X/Twitter tab.
- Variant picker for available MP4 resolutions/bitrates.
- Multi-media picker for posts with more than one video or animated GIF.
- Batch download for multi-media posts.
- Optional Save As dialogs and one-off Save As actions.
- Copy selected direct MP4 URL.

## Install locally

1. Extract this folder.
2. Open `chrome://extensions` in Chrome or another Chromium browser.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted extension folder.

## Use

- On X/Twitter, click the inline download icon on a post to download your saved default quality.
- Shift-click the inline icon to open the picker for that post.
- Alt/Option-click the inline icon to open a Save As dialog.
- Use the toolbar popup to paste a URL/status ID, choose a variant, download all media, or copy the direct MP4 URL.

## Notes

This extension only downloads video/GIF MP4 variants that X/Twitter exposes through its embeddable metadata response. Private, restricted, deleted, DRM-protected, or non-video posts may not expose downloadable media.
