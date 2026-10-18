# xHelper

A minimal Chrome/Chromium Manifest V3 extension that adds a download button
to videos on x.com. It always saves the highest-quality MP4 the post exposes.
No popup, no settings, and no background work while you browse.

## Use

- Point at a post with a video (or let the video start playing) and a
  download icon appears in its action bar. Click it to save the best MP4;
  Alt/Option-click opens Save As.
- The icon turns green when the download starts and red on failure — hover it
  for the reason.
- Multi-video posts download every video (`_m1`, `_m2`, … filename suffixes).
- Quotes and replies without their own video download the quoted or parent
  post's video.

Filenames look like `@user_1234567890_1280x720.mp4`.

## How it stays light

- The content script has no MutationObserver, timers or page scans. It only
  reacts when the pointer or keyboard focus enters a post, or a video starts
  playing, and then checks just that post.
- The tweet ID is read when you click. The service worker sleeps until then,
  looks the post up through X's public embed endpoint, and hands the MP4 to
  Chrome's downloads.
- Nothing runs on other sites. Permissions: `downloads`, plus the lookup host
  `cdn.syndication.twimg.com`.

## Install

1. Open `chrome://extensions` (or the equivalent in Edge/Brave).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

After reloading or updating the extension, also reload open x.com tabs.

## Development

No build step and no runtime dependencies. Lint and format checks use
Node.js 24 LTS (24.15 or newer within 24.x):

```bash
npm ci --ignore-scripts
npm run lint
npm run format:check
```

There are no automated tests. Check changes by hand on x.com: a video post,
a GIF, a multi-video post, a quote of a video, Alt/Option-click Save As (and
cancelling it), and a retry after a failure.

## Limitations

- Only video/GIF MP4s exposed by X's embed metadata endpoint can be saved.
  Private, restricted, deleted or DRM-protected posts may not expose them.
- X changes its markup often. If the button stops appearing, update the
  selectors at the top of `content.js`.
