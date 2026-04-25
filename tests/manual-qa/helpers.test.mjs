import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_PLAYWRIGHT_CHANNEL,
  resolveBrowserLaunchTarget,
  resolveExtensionPath,
  buildChromiumArgs,
  extensionIdFromPublicKeyDer,
  extractExtensionId,
  findXvidExtensionId,
  POPUP_SMOKE_SELECTORS,
  matchesExtensionName,
} from './helpers.mjs';

describe('resolveBrowserLaunchTarget', () => {
  it('prefers CHROME_PATH', () => {
    expect(resolveBrowserLaunchTarget({ env: { CHROME_PATH: '/custom/chrome' } })).toEqual({
      label: 'CHROME_PATH (/custom/chrome)',
      executablePath: '/custom/chrome',
    });
  });

  it('uses PLAYWRIGHT_CHANNEL when CHROME_PATH is absent', () => {
    expect(resolveBrowserLaunchTarget({ env: { PLAYWRIGHT_CHANNEL: 'msedge' } })).toEqual({
      label: 'PLAYWRIGHT_CHANNEL (msedge)',
      channel: 'msedge',
    });
  });

  it('defaults to the chromium channel when no override is set', () => {
    expect(resolveBrowserLaunchTarget({ env: {} })).toEqual({
      label: `default PLAYWRIGHT_CHANNEL (${DEFAULT_PLAYWRIGHT_CHANNEL})`,
      channel: DEFAULT_PLAYWRIGHT_CHANNEL,
    });
  });
});

describe('resolveExtensionPath', () => {
  it('prefers EXTENSION_PATH env var', () => {
    expect(resolveExtensionPath({ env: { EXTENSION_PATH: '/tmp/my-ext' } })).toBe('/tmp/my-ext');
  });

  it('falls back to the repo root', () => {
    const result = resolveExtensionPath({ env: {} });
    expect(existsSync(join(result, 'manifest.json'))).toBe(true);
    expect(existsSync(join(result, 'tests', 'manual-qa'))).toBe(true);
  });
});

describe('buildChromiumArgs', () => {
  it('includes both unpacked-extension flags with the given path', () => {
    const args = buildChromiumArgs('/path/to/ext');
    expect(args).toContain('--disable-extensions-except=/path/to/ext');
    expect(args).toContain('--load-extension=/path/to/ext');
  });

  it('includes browser startup stability flags', () => {
    const args = buildChromiumArgs('/x');
    expect(args).toContain('--no-first-run');
    expect(args).toContain('--no-default-browser-check');
  });
});


describe('extensionIdFromPublicKeyDer', () => {
  it('returns a 32-character Chrome extension ID using only a-p', () => {
    const id = extensionIdFromPublicKeyDer(Buffer.from('public-key-fixture'));
    expect(id).toMatch(/^[a-p]{32}$/);
  });

  it('is deterministic for the same key bytes', () => {
    const key = Buffer.from('same-key');
    expect(extensionIdFromPublicKeyDer(key)).toBe(extensionIdFromPublicKeyDer(key));
  });

  it('changes for different key bytes', () => {
    expect(extensionIdFromPublicKeyDer(Buffer.from('key-a'))).not.toBe(extensionIdFromPublicKeyDer(Buffer.from('key-b')));
  });
});

describe('extractExtensionId', () => {
  it('extracts a 32-character Chrome extension ID from a service-worker URL', () => {
    const id = 'aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbb';
    expect(extractExtensionId(`chrome-extension://${id}/background.js`)).toBe(id);
  });

  it('rejects non-extension URLs and malformed IDs', () => {
    expect(extractExtensionId('https://x.com')).toBeNull();
    expect(extractExtensionId('about:blank')).toBeNull();
    expect(extractExtensionId('')).toBeNull();
    expect(extractExtensionId(null)).toBeNull();
    expect(extractExtensionId(undefined)).toBeNull();
    expect(extractExtensionId('chrome-extension://abc/background.js')).toBeNull();
    expect(extractExtensionId('chrome-extension://qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq/background.js')).toBeNull();
  });
});

describe('findXvidExtensionId', () => {
  const XVID_ID = 'aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbb';
  const OTHER_ID = 'ccccccccccccccccdddddddddddddddd';

  it('prefers the service worker ending in background.js', () => {
    expect(findXvidExtensionId([
      { url: `chrome-extension://${OTHER_ID}/background.html`, type: 'background_page' },
      { url: `chrome-extension://${XVID_ID}/background.js`, type: 'service_worker' },
    ])).toBe(XVID_ID);
  });

  it('falls back to extension service-worker/background targets', () => {
    expect(findXvidExtensionId([{ url: `chrome-extension://${OTHER_ID}/worker.js`, type: 'service_worker' }])).toBe(OTHER_ID);
    expect(findXvidExtensionId([{ url: `chrome-extension://${OTHER_ID}/background.html`, type: 'background_page' }])).toBe(OTHER_ID);
  });

  it('falls back to any chrome-extension URL', () => {
    expect(findXvidExtensionId([{ url: `chrome-extension://${OTHER_ID}/popup.html`, type: 'page' }])).toBe(OTHER_ID);
  });

  it('returns null when no extension targets exist', () => {
    expect(findXvidExtensionId([])).toBeNull();
    expect(findXvidExtensionId([{ url: 'about:blank', type: 'page' }])).toBeNull();
  });
});

describe('POPUP_SMOKE_SELECTORS', () => {
  it('contains the three critical popup selectors', () => {
    expect(POPUP_SMOKE_SELECTORS).toEqual({
      heading: 'h1',
      input: '#tweet-input',
      analyzeButton: '#analyze-btn',
    });
  });
});

describe('matchesExtensionName', () => {
  it('matches the extension name case-insensitively', () => {
    expect(matchesExtensionName('X Video Downloader')).toBe(true);
    expect(matchesExtensionName('x VIDEO downloader v2.4.0')).toBe(true);
  });

  it('rejects unrelated or empty text', () => {
    expect(matchesExtensionName('Some Other Extension')).toBe(false);
    expect(matchesExtensionName('')).toBe(false);
    expect(matchesExtensionName(null)).toBe(false);
  });
});
