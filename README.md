# X Video Downloader

A local, privacy-focused Chrome/Chromium Manifest V3 extension that adds a
download button to X/Twitter videos and hides promoted posts. Deliberately
minimal: no popup, no settings, no idle CPU — it always downloads the
highest-quality MP4 the post exposes.

## Use

- **Inline button** — posts with video get a download icon in the action bar.
  Click it to download the best MP4. Alt/Option-click opens a Save As dialog.
- **Toolbar icon** — on an open post page, clicking the extension icon
  downloads that post's video. The icon badge flashes `?` if the page isn't a
  post and `!` if the lookup fails.
- Multi-video posts download every video (`_m1`, `_m2`, … filename suffixes).
- Quote posts and replies without their own media download the quoted/parent
  video.
- **Ad hiding** — promoted posts in the timeline and sidebar are hidden via
  a pure-CSS rule. A built-in canary watches for X renaming its ad marker:
  labeled ads that slip past the CSS rule are hidden by a JS fallback and
  the toolbar badge flashes "AD" — that's the signal to refresh the
  selector in `content.css`.

Filenames look like `@user_1234567890_1280x720.mp4`.

## Install locally

1. Open `chrome://extensions` (or the equivalent in Edge/Brave).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

## Development

The extension is three files (`background.js`, `content.js`, `content.css`)
plus the manifest — no build step, no runtime dependencies. Dev tooling is
lint/format only:

```bash
npm install
npm run lint
npm run format:check
```

To verify a change, reload the unpacked extension and download from a video
post, a multi-video post, and a quote of a video post.

Contributions are welcome — see `CONTRIBUTING.md`. Release history lives in
`CHANGELOG.md`.

## Notes & limitations

- Only downloads video/GIF MP4 variants that X/Twitter exposes through its
  embeddable metadata endpoint. Private, restricted, deleted, DRM-protected,
  or non-video posts may not expose downloadable media.
- X frequently updates their UI — the inline button may occasionally break
  until the DOM selectors are updated.
