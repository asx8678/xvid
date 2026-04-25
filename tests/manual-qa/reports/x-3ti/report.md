# x-3ti Manual QA Report — Cross-scenario validation in live Chromium

**Issue:** x-3ti — Manual QA: cross-scenario validation of v2.3.0 in live Chrome  
**Executed on:** 2026-04-25  
**Tester:** pack-leader-1870f2  
**Code under test:** local `main` after x-484 harness merge; manifest reports extension version `2.4.0`  
**Browser path:** Playwright `chromium` channel via `playwright-core`  
**Harness:** `tests/manual-qa/x-3ti-scenarios.mjs`, built on the x-484 manual QA extension loader

> Note: the original issue title references v2.3.0, but the repository manifest currently reports
> `2.4.0`. This report validates the current local extension version.

## Commands run

```bash
npm install
npm test
SMOKE_TIMEOUT=15000 npm run manual-qa:smoke
node tests/manual-qa/x-3ti-scenarios.mjs
```

## Overall result

**QA sign-off:** CONDITIONAL PASS with one product defect filed.

- 5 of 6 requested scenarios passed.
- Scenario 4, quoted post containing video, failed and was filed separately as **x-3ks**.
- No additional extension-console failures were observed in the captured popup flows.
- Some X.com page console noise was from third-party sign-in/FedCM resources and was not attributable to the extension.

## Pass/fail table

| # | Scenario | Data used | Result | Evidence | Screenshot(s) |
|---:|---|---|---|---|---|
| 1 | Single-video X/Twitter post | Live X post `2047785574757478731` (`https://x.com/NASAArtemis/status/2047785574757478731`) | PASS | Content script injected `.xvd` button on live X page; clicking it returned button title `Download started`. Video downloads were routed to a tiny placeholder response by the QA harness to avoid persisting large media files. | [`01-single-video-live-x.png`](screenshots/01-single-video-live-x.png) |
| 2 | Multi-video post | Fixture-backed X page `https://x.com/fixture/status/2222222222` plus existing `tests/fixtures/multi-video.json` | PASS | Synthetic `x.com` page loaded in live Chromium, content script injected `.xvd`; Shift-click opened picker; popup found 2 media items; `Download all media` started `2 of 2` downloads. | [`02-multi-video-fixture-x-page.png`](screenshots/02-multi-video-fixture-x-page.png), [`02-multi-video-download-all.png`](screenshots/02-multi-video-download-all.png) |
| 3 | Animated GIF post | Live X post `1117281960387334147` (`https://x.com/GIPHY/status/1117281960387334147`) | PASS | Content script injected `.xvd` on live X GIF post; popup analyzed same ID and showed `Animated GIF variants` with a downloadable MP4 variant. | [`03-animated-gif-live-x.png`](screenshots/03-animated-gif-live-x.png), [`03-animated-gif-popup.png`](screenshots/03-animated-gif-popup.png) |
| 4 | Quoted post containing video | Live X/Syndication post `2047801475137470783` (`https://x.com/SpaceX/status/2047801475137470783`) whose `quoted_status` contains video but top-level tweet has no media | **FAIL** | Popup returned `No downloadable video was found in that post.` A separate bug was filed as **x-3ks**. | [`04-quoted-video-popup.png`](screenshots/04-quoted-video-popup.png) |
| 5 | Restricted/deleted post graceful failure | Routed missing status ID `9999999999999999999` returning HTTP 404 from syndication endpoint | PASS | Popup displayed user-friendly error `That post could not be found.` and kept the result card hidden. | [`05-restricted-deleted-error.png`](screenshots/05-restricted-deleted-error.png) |
| 6 | `mobile.twitter.com` URL parsing | `https://mobile.twitter.com/NASAArtemis/status/2047785574757478731` | PASS | Popup/background normalized the mobile URL, extracted status ID `2047785574757478731`, and found 1 downloadable media item. | [`06-mobile-twitter-url-popup.png`](screenshots/06-mobile-twitter-url-popup.png) |

## Defects filed

### x-3ks — Quoted-only video posts are not detected by popup/background

**Severity/priority:** P1 bug  
**Scenario:** #4 quoted post containing video  
**Repro summary:**

1. Load the extension in Chromium through the manual QA harness.
2. Open the popup.
3. Analyze status ID `2047801475137470783`.
4. Expected: extension detects/offers the video media from the quoted status.
5. Actual: popup reports `No downloadable video was found in that post.`

Evidence is captured in [`screenshots/04-quoted-video-popup.png`](screenshots/04-quoted-video-popup.png)
and in [`summary.json`](summary.json).

## Notes and caveats

- The multi-video scenario used a fixture-backed `x.com` page because a stable public live multi-video
  post was not identified during candidate mining. The flow still ran in live Chromium with the actual
  MV3 extension loaded, exercised content-script injection on an `https://x.com/.../status/...` URL,
  exercised the background/popup path through the existing multi-video fixture, and verified the
  `Download all media` action.
- The harness routes `https://video.twimg.com/**` to a tiny local placeholder body during these captures.
  This verifies that the extension starts Chrome downloads without downloading large third-party media
  into the developer machine.
- The restricted/deleted scenario intentionally uses a routed 404 for deterministic evidence and avoids
  relying on public tombstone availability.

## Artifacts

- Machine-readable summary: [`summary.json`](summary.json)
- Screenshots: [`screenshots/`](screenshots/)
- Repro/capture script: [`../../x-3ti-scenarios.mjs`](../../x-3ti-scenarios.mjs)
