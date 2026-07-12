# Changelog

## 3.0.1

- Removed the test suite, fixtures, capture script, and vitest tooling —
  the extension is verified manually; CI now runs lint + format only.
- Removed the obsolete `SECURITY.md` advisory (it covered the removed
  vitest/esbuild dependency chain).
- Simplified the request timeout to native `AbortSignal.timeout()`
  (Chrome 103+), dropped the test-only export block and single-use helpers.

## 3.0.0

Minimal rewrite: the extension is now just the inline download button (plus
the toolbar icon on post pages). ~80% less code, zero idle CPU.

- **Removed the popup entirely** — no picker, settings, previews, or
  copy-URL. Downloads always use the highest-quality MP4 variant.
- **Removed the `storage` permission** (no settings left) and the
  `mobile.twitter.com` host permission (it redirects to x.com).
- Toolbar icon now directly downloads the video of the open post; a badge
  flash signals failure (`?` = not a post page, `!` = lookup failed).
- Alt/Option-click on the inline button still opens Save As.
- Multi-video posts download every video with `_mN` filename suffixes.
- Filenames are now `@user_tweetId[_mN][_WxH].mp4` (no text snippet).
- Content script rewritten around a sweep-based MutationObserver: no URL
  polling interval, styling moved to `content.css`, and the observer fully
  disconnects while the tab is hidden.
- Kept: quoted/parent-tweet media fallback, string-bitrate coercion,
  HTTPS/twimg-only variant filtering, sequential multi-media downloads.
- Repo: ESLint + Prettier with CI lint/format gates, `CONTRIBUTING.md`, and
  `homepage_url` in the manifest (merged from the parallel cleanup PRs);
  release notes consolidated into this file.

## 2.x (historical)

- **2.4.0** — popup thumbnail and duration previews.
- **2.3.1** — removed redundant `activeTab` permission.
- **2.3.0** — popup Download All; stricter URL parsing; string bitrate
  support; mobile.twitter.com support.
- **2.2.0** — multi-media picker, Save As options, copy MP4 URL, quoted-post
  injection fixes, SPA URL-change rescanning.
- **2.0.0** — toolbar popup with quality picker, richer filenames, hover
  states, resilient action-bar detection.
