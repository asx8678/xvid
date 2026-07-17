# Changelog

## 3.4.1

- **Save As no longer false-fails.** `chrome.downloads.download` blocks on
  the Save As dialog, so Alt/Option-click downloads no longer get the 15 s
  "Extension did not respond" deadline — the user sets the pace. A reply
  arriving after a timeout was already reported no longer flips the button
  to a stale green.
- Badge flashes (`?` / `!` / `AD`) are scoped to the tab that triggered
  them instead of appearing on every window's toolbar icon.
- Offline/DNS lookup failures now read "Could not reach X/Twitter. Check
  your connection." instead of the raw "Failed to fetch".
- The tweet ID returned by the syndication API is validated before being
  used in the download filename (defense in depth — it was always digits
  in practice).
- Fallback media source order flipped to quoted tweet before reply parent:
  the quoted video is the one visibly embedded in the post.
- Tooling: eslint lints the extension files as classic scripts
  (`sourceType: 'script'`), matching how Chrome loads them.

## 3.4.0

- **Strictly x.com only.** Dropped `twitter.com` from the content-script
  matches and host permissions (it redirects to x.com). The toolbar icon
  is now greyed out and unclickable everywhere except x.com, via
  `declarativeContent` rules the browser evaluates natively — no extension
  code runs on non-X sites, and clicking the icon elsewhere no longer even
  wakes the service worker.

## 3.3.2

- Sweeps are throttled to one per 200 ms during DOM-mutation bursts
  (previously one per animation frame, ~60/s while scrolling) with a
  trailing-edge timer so the last mutation of a burst is always swept.
  Cuts scroll-time CPU ~90%; button appearance lags at most 200 ms.

## 3.3.1

- **Renamed to xHelper**, superseding the short-lived Distill name from
  3.3.0. (No relation to the Android malware family of the same name.)

## 3.3.0

- **Renamed to Distill** (formerly "X Video Downloader" / xvid — the old
  name collided with the Xvid codec and predated the ad-hiding feature).
  Internal identifiers (`.xvd` CSS classes, repo URL) are unchanged.

## 3.2.0

- **Ad-marker canary with self-healing.** X must visibly label ads, so the
  content script now uses the "Ad"/"Promoted" label as an independent check
  (throttled to once per 5s, riding the existing sweep — no new timers or
  permissions). If a labeled ad is still visible, the structural
  `placementTracking` marker has rotted: the timeline cell is hidden via JS
  as a fallback and the toolbar badge flashes "AD" once per page load so
  the CSS selector gets refreshed. Organic tweets are excluded because ads
  render the label in place of the `<time>` permalink.

## 3.1.0

- **Hides promoted posts (ads) on x.com** — pure CSS, no new permissions,
  no JavaScript on the hot path. Timeline ads collapse with the whole cell;
  sidebar promoted entries are hidden in place. Uses X's
  `placementTracking` marker (verified against the live feed; if X renames
  it, ads reappear until the selector in `content.css` is updated).

## 3.0.2

- Content script: CSS `:has()` selectors now do the sweep filtering
  ("video tweet without a button") and the timestamped-permalink preference
  natively; `minimum_chrome_version` raised 103 → 105 for `:has()`.
- Inline SVG icon is built with `innerHTML` from a fixed literal instead of
  `createElementNS` ceremony (verified x.com serves no Trusted Types CSP
  directives; Chrome ≥130 exempts isolated worlds regardless).

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
