/**
 * Pure helpers for the manual QA smoke harness.
 *
 * No Playwright imports here — anything that touches a browser lives in
 * extension-smoke.mjs. Keeping this file browser-free means we can unit-test
 * path, browser-resolution, argument, and extension-ID logic without spinning
 * up Chromium.
 */

import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANUAL_QA_DIR = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_PLAYWRIGHT_CHANNEL = 'chromium';

/* ------------------------------------------------------------------ */
/*  Browser executable/channel resolution                             */
/* ------------------------------------------------------------------ */

/**
 * Resolve the browser launch target for playwright-core.
 *
 * Priority:
 *   1. CHROME_PATH env var (explicit executable path)
 *   2. PLAYWRIGHT_CHANNEL env var (e.g. chrome, msedge, chrome-beta)
 *   3. Playwright channel "chromium" as the default
 *
 * playwright-core intentionally does not download browsers during npm install.
 * If the default channel is unavailable, run `npx playwright-core install chromium`
 * or set CHROME_PATH / PLAYWRIGHT_CHANNEL to an installed browser.
 *
 * @param {object} [opts]
 * @param {Record<string, string|undefined>} [opts.env]
 * @returns {{label: string, executablePath?: string, channel?: string}}
 */
export function resolveBrowserLaunchTarget(opts = {}) {
  const env = opts.env ?? process.env;
  const explicitPath = env.CHROME_PATH?.trim();
  if (explicitPath) {
    return { label: `CHROME_PATH (${explicitPath})`, executablePath: explicitPath };
  }

  const explicitChannel = env.PLAYWRIGHT_CHANNEL?.trim();
  if (explicitChannel) {
    return { label: `PLAYWRIGHT_CHANNEL (${explicitChannel})`, channel: explicitChannel };
  }

  return { label: `default PLAYWRIGHT_CHANNEL (${DEFAULT_PLAYWRIGHT_CHANNEL})`, channel: DEFAULT_PLAYWRIGHT_CHANNEL };
}

/* ------------------------------------------------------------------ */
/*  Extension path resolution                                         */
/* ------------------------------------------------------------------ */

/**
 * Resolve the unpacked extension directory.
 *
 * Priority:
 *   1. EXTENSION_PATH env var
 *   2. Repo root (two levels up from tests/manual-qa/)
 *
 * @param {object} [opts]
 * @param {Record<string, string|undefined>} [opts.env]
 * @returns {string}
 */
export function resolveExtensionPath(opts = {}) {
  const env = opts.env ?? process.env;
  const explicitPath = env.EXTENSION_PATH?.trim();
  if (explicitPath) return resolve(explicitPath);

  return resolve(join(MANUAL_QA_DIR, '..', '..'));
}

/* ------------------------------------------------------------------ */
/*  Chromium args builder                                             */
/* ------------------------------------------------------------------ */

/**
 * Build the Chromium launch args needed for unpacked extension loading.
 *
 * IMPORTANT: The caller must also pass
 * `ignoreDefaultArgs: ['--disable-extensions']` to launchPersistentContext
 * because Playwright adds --disable-extensions by default, which blocks
 * --load-extension.
 *
 * @param {string} extensionPath - absolute path to unpacked extension dir
 * @returns {string[]}
 */
export function buildChromiumArgs(extensionPath) {
  return [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-first-run',
    '--no-default-browser-check',
  ];
}

/* ------------------------------------------------------------------ */
/*  Extension ID derivation / extraction                              */
/* ------------------------------------------------------------------ */


/**
 * Derive a Chrome extension ID from a DER-encoded SubjectPublicKeyInfo public key.
 * Chrome maps the first 16 bytes of SHA-256(publicKeyDer) to the letters a-p.
 *
 * @param {Buffer|Uint8Array} publicKeyDer
 * @returns {string}
 */
export function extensionIdFromPublicKeyDer(publicKeyDer) {
  const alphabet = 'abcdefghijklmnop';
  const digest = createHash('sha256').update(publicKeyDer).digest();
  let id = '';
  for (const byte of digest.subarray(0, 16)) {
    id += alphabet[byte >> 4];
    id += alphabet[byte & 0x0f];
  }
  return id;
}


/**
 * Extract the extension ID from a URL like
 * `chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/background.js`.
 * Chrome extension IDs use the letters a-p and are 32 characters long.
 *
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function extractExtensionId(url) {
  if (!url) return null;
  const match = String(url).match(/^chrome-extension:\/\/([a-p]{32})\//);
  return match ? match[1] : null;
}

/** The expected MV3 service worker filename for the xvid extension. */
export const EXPECTED_SERVICE_WORKER = 'background.js';

/**
 * Find the xvid extension ID from a list of CDP target info objects.
 *
 * @param {{url?: string, type?: string}[]} targets
 * @returns {string|null}
 */
export function findXvidExtensionId(targets) {
  for (const target of targets) {
    const id = extractExtensionId(target.url);
    if (id && target.url?.endsWith(`/${EXPECTED_SERVICE_WORKER}`)) return id;
  }

  for (const target of targets) {
    if (target.type === 'service_worker' || target.type === 'background_page') {
      const id = extractExtensionId(target.url);
      if (id) return id;
    }
  }

  for (const target of targets) {
    const id = extractExtensionId(target.url);
    if (id) return id;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Smoke assertions (pure data checks)                               */
/* ------------------------------------------------------------------ */

export const POPUP_SMOKE_SELECTORS = Object.freeze({
  heading: 'h1',
  input: '#tweet-input',
  analyzeButton: '#analyze-btn',
});

/**
 * Validate that text matches the extension name.
 *
 * @param {string|null|undefined} text
 * @returns {boolean}
 */
export function matchesExtensionName(text) {
  return /X Video Downloader/i.test(String(text || ''));
}
