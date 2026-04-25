# Manual QA Harness — `tests/manual-qa/`

Standalone Playwright scripts for **manual** browser-based QA of the xvid Chrome MV3 extension.
These scripts are **not** part of `npm test` or CI; run them explicitly when validating an
unpacked browser extension.

## Why this exists

Issue **x-484** documents that qa-kitten's `browser_initialize` wrapper does not expose custom
Chromium args such as `--load-extension` and `--disable-extensions-except`. Those flags are
required to load an unpacked Chrome extension, so extension-behavior QA was blocked.

This harness calls Playwright's `chromium.launchPersistentContext()` directly with the required
flags. That provides an independent local path for extension smoke/manual QA and unblocks **x-3ti**
even before qa-kitten grows first-class custom-arg support.

## Prerequisites

- Node.js >= 18
- Project dependencies installed with `npm install` or `npm ci`
- A Playwright-compatible Chromium browser

The project uses `playwright-core` intentionally: it provides the automation API without downloading
browser binaries during `npm install`. The harness defaults to Playwright's `chromium` channel, which
is the most reliable option for unpacked-extension loading. If that browser is not installed, run:

```bash
npx playwright-core install chromium
```

You can also override browser selection with `CHROME_PATH` or `PLAYWRIGHT_CHANNEL`.

## Command

```bash
npm run manual-qa:smoke
```

This runs:

```bash
node tests/manual-qa/extension-smoke.mjs
```

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PLAYWRIGHT_CHANNEL` | `chromium` | Playwright browser channel. `chromium` is recommended for unpacked extension testing. |
| `CHROME_PATH` | unset | Absolute path to a Chrome/Chromium executable. Highest priority when set. |
| `EXTENSION_PATH` | repo root | Absolute path to the unpacked extension directory. |
| `HEADLESS` | `false` | Set to `true` to try headless mode. MV3 extension loading is most reliable in headed mode. |
| `SLOW_MO` | `0` | Playwright slow-motion delay in milliseconds. Useful for watching the smoke. |
| `SMOKE_TIMEOUT` | `30000` | Timeout in milliseconds for browser startup and assertions. |
| `STATUS_ID` | unset | Optional X/Twitter status ID to fill into the popup and click Analyze after the base smoke passes. Network/API success is not required for the base extension-load smoke. |

Examples:

```bash
# Recommended default: Playwright Chromium channel
npm run manual-qa:smoke

# Use an explicit Playwright channel
PLAYWRIGHT_CHANNEL=chrome npm run manual-qa:smoke

# Use a specific executable
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run manual-qa:smoke

# Exercise the popup Analyze path with a known public status ID
STATUS_ID=2047785574757478731 npm run manual-qa:smoke
```

## What the smoke verifies

1. Creates a temporary minimal copy of the extension and injects an ephemeral manifest `key`, allowing
   the script to derive the extension ID deterministically without modifying the source tree.
2. Launches a persistent browser context with:
   - `--disable-extensions-except=<temporary extension path>`
   - `--load-extension=<temporary extension path>`
   - `ignoreDefaultArgs: ['--disable-extensions']`
3. Opens `chrome-extension://<derived-id>/popup.html`.
4. Asserts key popup UI exists:
   - `<h1>` contains `X Video Downloader`
   - `#tweet-input` is visible
   - `#analyze-btn` is visible
5. Optionally fills/clicks Analyze when `STATUS_ID` is provided.

## Expected output

```text
🧩 Prepared temporary extension copy (extension) with deterministic ID aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
🚀 Launching Chromium…
   browser       : default PLAYWRIGHT_CHANNEL (chromium)
   channel       : chromium
   source ext    : /path/to/xvid
   prepared ext  : /tmp/xvid-smoke-extension-XXXXXX/extension
   expected ID   : aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
   headless      : false
   userDataDir   : /tmp/xvid-smoke-profile-XXXXXX
✅ Extension service worker discovered — ID: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
📄 Opening popup: chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/popup.html

━━━ Smoke Results ━━━
  ✅ heading: X Video Downloader
  ✅ tweet-input: visible=true
  ✅ analyze-btn: visible=true text="Analyze"
━━━━━━━━━━━━━━━━━━━━

🎉 Smoke passed!
```

## Troubleshooting

- **Browser executable was not found**: run `npx playwright-core install chromium`, set `PLAYWRIGHT_CHANNEL` to an installed channel, or set `CHROME_PATH`.
- **`net::ERR_BLOCKED_BY_CLIENT` opening `chrome-extension://...`**: the selected browser did not load the unpacked extension. Use the default `PLAYWRIGHT_CHANNEL=chromium`; some system Chrome builds block extension loading under automation.
- **Headless failures**: keep `HEADLESS=false` unless you have confirmed your browser supports MV3 extension loading in headless mode.
- **Timeouts**: increase `SMOKE_TIMEOUT`, especially on first browser launch.

## Files

```text
tests/manual-qa/
├── README.md              # this guide
├── extension-smoke.mjs    # explicit browser smoke, not run by npm test
├── helpers.mjs            # pure helper functions
└── helpers.test.mjs       # helper unit tests, run by npm test
```
