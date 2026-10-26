# Project Instructions for AI Agents

xHelper is a Manifest V3 Chrome extension that adds a download button to
videos on x.com. Downloading videos is its only job — keep it that way, and
keep it doing no work while the user browses.

## Build & Check

There is no build step — the repo root loads directly as an unpacked
extension (`chrome://extensions` → Developer mode → Load unpacked). The only
automated check is `npm run prove` (below); verify everything else by hand on
x.com: a video post, a GIF, a multi-video post, a quote of a video,
Alt/Option-click Save As (and cancelling it), and a retry after a failure.

```bash
npm ci --ignore-scripts # Node.js 24 LTS, >=24.15 within 24.x; dev deps only
npm run lint         # eslint .
npm run format:check # prettier --check .
npm run prove        # gdp-wired: button placement laws + shipped content.js check
```

## Architecture Overview

No runtime dependencies:

- `manifest.json` — MV3 manifest; minimal permissions (`downloads`, plus the
  `cdn.syndication.twimg.com` host: its CORS only allows X's own embed
  origin, so the lookup needs it).
- `content.js` — runs in the ISOLATED world on x.com. No MutationObserver,
  timers or scans: a video post gets its button when the pointer or keyboard
  focus enters it or its video starts playing. The tweet ID is read on click.
- `content.css` — download button styling.
- `background.js` — service worker. Resolves the post via the syndication API
  (falling back to the quoted post), picks the best MP4 variant,
  and downloads via `chrome.downloads`.
- `proofs/` — dev-only, never loaded by Chrome. `placement.mts` is the
  gdp-wired rule for where `content.js` puts buttons, its laws, the bugs it
  rules out, and a check that runs the shipped `content.js` on a fake page
  (`fake-dom.mts`) against the rule.

## Conventions & Patterns

- Every release bumps the version in `manifest.json` and `package.json` and
  adds a `CHANGELOG.md` entry.
- `README.md` states each file's line count (`wc -l`); update it whenever
  those files change.
- Commit style: `type: vX.Y.Z — summary`.
- Finished work is committed and pushed to `origin/main` once lint, format and
  prove checks pass.
- A change to `onActivity`, `addButton` or `findActionBar` updates the rule in
  `proofs/placement.mts` in the same commit.
- No runtime dependencies and no new permissions without strong
  justification; the minimal permission set is a feature.
- X.com DOM selectors are fragile by nature — they live at the top of
  `content.js` behind named constants, with comments explaining each.
