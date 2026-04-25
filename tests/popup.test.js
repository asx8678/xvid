/**
 * UI state tests for popup.js.
 *
 * Strategy: load popup.html into jsdom, install a custom chrome mock where
 * sendMessage returns configurable fixture-shaped responses, then import
 * popup.js through Vite's pipeline (for coverage). We exercise the UI by
 * dispatching events and inspecting DOM state.
 *
 * Uses vi.waitFor() instead of setTimeout sleeps for deterministic async.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import singleVideoFixture from './fixtures/single-video.json';

/**
 * Create a popup-specific chrome mock where sendMessage can be configured
 * to return specific responses per test.
 */
function createPopupChromeMock() {
  let __sendMessageImpl = async () => ({ ok: false, err: 'Not configured' });
  const __storage = { defaultQuality: 'best', promptSaveAs: false };

  const chrome = {
    storage: {
      sync: {
        async get(defaults) {
          return { ...defaults, ...__storage };
        },
        async set(obj) {
          Object.assign(__storage, obj);
        },
        async setAccessLevel() {},
      },
    },
    runtime: {
      onMessage: { addListener() {} },
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      lastError: { message: null },
      getURL(path) {
        return `chrome-extension://xvid-id/${path}`;
      },
      sendMessage: (payload) => __sendMessageImpl(payload),
      __setSendMessage(impl) {
        __sendMessageImpl = impl;
      },
    },
    downloads: {},
    tabs: {
      async query() {
        return [{ id: 1, url: 'https://x.com/testuser/status/1111111111' }];
      },
    },
  };

  return chrome;
}

function loadPopupHtml() {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.resolve(process.cwd(), 'popup.html'), 'utf8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const headMatch = html.match(/<head[^>]*>([\s\S]*)<\/head>/i);
  if (headMatch) document.head.innerHTML = headMatch[1];
  if (bodyMatch) document.body.innerHTML = bodyMatch[1];
}

/**
 * Build a probe response from the single-video fixture.
 */
function buildProbeResponse(overrides = {}) {
  const media = singleVideoFixture.mediaDetails[0];
  const mp4Variants = media.video_info.variants.filter(v => v.content_type === 'video/mp4');
  return {
    ok: true,
    tweetId: '1111111111',
    screenName: 'testuser',
    displayName: 'Test User',
    text: 'Check out this video!',
    permalink: 'https://x.com/testuser/status/1111111111',
    defaultQuality: 'best',
    promptSaveAs: false,
    mediaCount: 1,
    selectedMediaIndex: 0,
    mediaItems: [{
      index: 0,
      mediaType: 'video',
      label: 'Video • 3 variants',
      variants: mp4Variants.map(v => {
        const res = (v.url.match(/\/(\d+x\d+)\//) || [])[1] || '';
        const bitrate = typeof v.bitrate === 'string' ? parseInt(v.bitrate, 10) || 0 : (v.bitrate || 0);
        return {
          url: v.url,
          bitrate,
          resolution: res,
          label: `${res}${res ? ' • ' : ''}${bitrate > 0 ? Math.round(bitrate / 1000) + ' kbps' : 'MP4'}`,
          filename: `@testuser_1111111111_${res}_${bitrate > 0 ? Math.round(bitrate / 1000) + 'kbps' : 'mp4'}.mp4`,
        };
      }),
    }],
    ...overrides,
  };
}

let chrome;

beforeEach(async () => {
  document.documentElement.innerHTML = '<head></head><body></body>';
  chrome = createPopupChromeMock();
  globalThis.chrome = chrome;
  loadPopupHtml();

  chrome.runtime.__setSendMessage(async (payload) => {
    if (payload.action === 'probe') return buildProbeResponse();
    if (payload.action === 'download') {
      return { ok: true, filename: '@testuser_1111111111_1280x720_2176kbps.mp4', downloadId: 1 };
    }
    if (payload.action === 'downloadAll') {
      return { ok: true, count: 1, requested: 1, dedupedCount: 0, downloads: [], errors: [] };
    }
    return { ok: false, err: 'Unknown action' };
  });

  vi.resetModules();
  await import('../popup.js');

  // Wait for async init (tryPrefillFromActiveTab, storage reads) to settle
  await vi.waitFor(() => {
    // Just need the async init to complete; checking input exists is enough
    expect(document.getElementById('tweet-input')).toBeTruthy();
  }, { timeout: 2000 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Busy-state recovery ─────────────────────────────────────────────────

describe('Busy-state recovery', () => {
  it('re-enables all action buttons when sendMessage rejects', async () => {
    chrome.runtime.__setSendMessage(async () => {
      throw new Error('Extension context invalidated');
    });

    const input = document.getElementById('tweet-input');
    input.value = 'https://x.com/test/status/1111111111';

    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('analyze-btn').disabled).toBe(false);
    });

    expect(document.getElementById('download-btn').disabled).toBe(false);
    expect(document.getElementById('saveas-btn').disabled).toBe(false);
    expect(document.getElementById('download-all-btn').disabled).toBe(false);
    expect(input.disabled).toBe(false);
  });

  it('shows error message when sendMessage rejects', async () => {
    chrome.runtime.__setSendMessage(async () => {
      throw new Error('Extension context invalidated');
    });

    const input = document.getElementById('tweet-input');
    input.value = '1111111111';

    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      const statusEl = document.getElementById('status');
      expect(statusEl.textContent).toBeTruthy();
      expect(statusEl.classList.contains('error')).toBe(true);
    });
  });

  it('re-enables buttons when sendMessage returns ok:false', async () => {
    chrome.runtime.__setSendMessage(async () => ({
      ok: false,
      err: 'That post could not be found.',
    }));

    const input = document.getElementById('tweet-input');
    input.value = '1111111111';

    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('analyze-btn').disabled).toBe(false);
    });

    const statusEl = document.getElementById('status');
    expect(statusEl.textContent).toContain('not be found');
  });
});

// ─── Variant <select> population ──────────────────────────────────────────

describe('Variant <select> population', () => {
  it('populates variant select with options from fixture', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') return buildProbeResponse();
      return { ok: false };
    });

    const input = document.getElementById('tweet-input');
    input.value = '1111111111';

    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      const options = Array.from(document.getElementById('variant-select').options);
      expect(options.length).toBe(3);
    });

    const variantSelect = document.getElementById('variant-select');
    const options = Array.from(variantSelect.options);
    expect(variantSelect.value).toBe(options[0].value);
  });

  it('selects best quality variant by default', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') return buildProbeResponse();
      return { ok: false };
    });

    const input = document.getElementById('tweet-input');
    input.value = '1111111111';

    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      const options = Array.from(document.getElementById('variant-select').options);
      expect(options.length).toBeGreaterThan(0);
      expect(options[0].textContent).toContain('1280x720');
    });
  });
});

// ─── "Download all media" button visibility ──────────────────────────────

describe('Download all media button', () => {
  it('is hidden when only one media item', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') {
        return buildProbeResponse({
          mediaCount: 1,
          mediaItems: [{
            index: 0,
            mediaType: 'video',
            label: 'Video • 1 variant',
            variants: [{
              url: 'https://video.twimg.com/test.mp4',
              bitrate: 832000,
              resolution: '640x360',
              label: '640x360 • 832 kbps',
              filename: 'test.mp4',
            }],
          }],
        });
      }
      return { ok: false };
    });

    const input = document.getElementById('tweet-input');
    input.value = '1111111111';

    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('download-all-btn').hidden).toBe(true);
    });
  });

  it('is visible when multiple media items exist', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') {
        return buildProbeResponse({
          tweetId: '2222222222',
          screenName: 'multimediaposter',
          mediaCount: 2,
          mediaItems: [
            {
              index: 0,
              mediaType: 'video',
              label: 'Media 1 • Video • 3 variants',
              variants: [{
                url: 'https://video.twimg.com/vid1_high.mp4',
                bitrate: 2176000,
                resolution: '1280x720',
                label: '1280x720 • 2176 kbps',
                filename: 'test1.mp4',
              }],
            },
            {
              index: 1,
              mediaType: 'video',
              label: 'Media 2 • Video • 3 variants',
              variants: [{
                url: 'https://video.twimg.com/vid2_high.mp4',
                bitrate: 1280000,
                resolution: '720x720',
                label: '720x720 • 1280 kbps',
                filename: 'test2.mp4',
              }],
            },
          ],
        });
      }
      return { ok: false };
    });

    const input = document.getElementById('tweet-input');
    input.value = '2222222222';

    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('download-all-btn').hidden).toBe(false);
    });
  });
});

// ─── URL input rejection ─────────────────────────────────────────────────

describe('URL input rejection', () => {
  it('shows error for evil.com URL — background rejects it', async () => {
    let sentPayload = null;
    chrome.runtime.__setSendMessage(async (payload) => {
      sentPayload = payload;
      return { ok: false, err: 'Paste a valid X/Twitter post URL or a numeric status ID.' };
    });

    const input = document.getElementById('tweet-input');
    input.value = 'https://evil.com/status/1234567890';

    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      const statusEl = document.getElementById('status');
      expect(statusEl.textContent).toContain('valid');
    });

    expect(sentPayload).not.toBeNull();
    expect(sentPayload.action).toBe('probe');

    const resultCard = document.getElementById('result-card');
    expect(resultCard.hidden).toBe(true);
  });

  it('accepts valid x.com URL and sends probe message', async () => {
    let sentPayload = null;
    chrome.runtime.__setSendMessage(async (payload) => {
      sentPayload = payload;
      return buildProbeResponse();
    });

    const input = document.getElementById('tweet-input');
    input.value = 'https://x.com/testuser/status/1111111111';

    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(sentPayload).not.toBeNull();
    });

    expect(sentPayload.action).toBe('probe');
  });
});
