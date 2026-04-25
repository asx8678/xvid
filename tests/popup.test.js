/**
 * UI state tests for popup.js.
 *
 * Strategy: load popup.html into jsdom, install a custom chrome mock where
 * sendMessage returns configurable fixture-shaped responses, then import
 * popup.js through Vite's pipeline (for coverage). We exercise the UI by
 * dispatching events and inspecting DOM state.
 *
 * Uses vi.waitFor() instead of setTimeout sleeps for deterministic async.
 *
 * NOTE: beforeEach auto-analyzes the active tab URL (x.com/status/1111111111)
 * so the popup starts in a "result visible" state. Tests that need a clean
 * state must clear the input and/or re-init.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import singleVideoFixture from './fixtures/single-video.json';

function createPopupChromeMock(options = {}) {
  let __sendMessageImpl = async () => ({ ok: false, err: 'Not configured' });
  const __storage = { defaultQuality: options.defaultQuality || 'best', promptSaveAs: options.promptSaveAs || false };
  const __mockTabs = options.mockTabs || [{ id: 1, url: 'https://x.com/testuser/status/1111111111' }];

  const chrome = {
    storage: {
      sync: {
        async get(defaults) { return { ...defaults, ...__storage }; },
        async set(obj) { Object.assign(__storage, obj); },
        async setAccessLevel() {},
      },
    },
    runtime: {
      onMessage: { addListener() {} },
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      lastError: { message: null },
      getURL(path) { return `chrome-extension://xvid-id/${path}`; },
      sendMessage: (payload) => __sendMessageImpl(payload),
      __setSendMessage(impl) { __sendMessageImpl = impl; },
    },
    downloads: {},
    tabs: {
      async query() { return [...__mockTabs]; },
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

function buildMultiMediaProbeResponse() {
  return buildProbeResponse({
    tweetId: '2222222222',
    screenName: 'multiposter',
    mediaCount: 2,
    mediaItems: [
      {
        index: 0, mediaType: 'video', label: 'Media 1 • Video • 1 variant',
        variants: [{
          url: 'https://video.twimg.com/ext_tw_video/2222222222/pu/vid/1280x720/vid1.mp4',
          bitrate: 2176000, resolution: '1280x720', label: '1280x720 • 2176 kbps', filename: 'test1.mp4',
        }],
      },
      {
        index: 1, mediaType: 'animated_gif', label: 'Media 2 • Animated GIF • 1 variant',
        variants: [{
          url: 'https://video.twimg.com/tw_vod_gif/2222222222/pu/vid/480x480/gif1.mp4',
          bitrate: 0, resolution: '480x480', label: '480x480 • MP4', filename: 'test2.mp4',
        }],
      },
    ],
  });
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
      return { ok: true, filename: '@testuser_1111111111_1280x720_2176kbps.mp4', downloadId: 1, saveAs: false };
    }
    if (payload.action === 'downloadAll') {
      return { ok: true, count: 2, requested: 2, dedupedCount: 0, downloads: [], errors: [] };
    }
    return { ok: false, err: 'Unknown action' };
  });

  vi.resetModules();
  await import('../popup.js');

  await vi.waitFor(() => {
    expect(document.getElementById('tweet-input')).toBeTruthy();
  }, { timeout: 2000 });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.navigator.clipboard;
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
      expect(document.getElementById('status').classList.contains('error')).toBe(true);
    });
  });

  it('re-enables buttons when sendMessage returns ok:false', async () => {
    chrome.runtime.__setSendMessage(async () => ({
      ok: false, err: 'That post could not be found.',
    }));
    const input = document.getElementById('tweet-input');
    input.value = '1111111111';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('analyze-btn').disabled).toBe(false);
    });
    expect(document.getElementById('status').textContent).toContain('not be found');
  });
});

// ─── Empty input branch ──────────────────────────────────────────────────

describe('Empty input handling', () => {
  it('shows error for empty input and clears result', async () => {
    chrome.runtime.__setSendMessage(async () => ({ ok: false, err: 'fail' }));
    const input = document.getElementById('tweet-input');
    input.value = '';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      const statusEl = document.getElementById('status');
      expect(statusEl.classList.contains('error')).toBe(true);
      expect(statusEl.textContent).toContain('valid');
    });
    expect(document.getElementById('result-card').hidden).toBe(true);
  });
});

// ─── Variant <select> population ──────────────────────────────────────────

describe('Variant select population', () => {
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
      expect(Array.from(document.getElementById('variant-select').options).length).toBe(3);
    });
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

  it('updates filename preview when variant changes', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') return buildProbeResponse();
      return { ok: false };
    });
    const input = document.getElementById('tweet-input');
    input.value = '1111111111';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(Array.from(document.getElementById('variant-select').options).length).toBe(3);
    });

    const variantSelect = document.getElementById('variant-select');
    variantSelect.value = variantSelect.options[1].value;
    variantSelect.dispatchEvent(new Event('change'));

    await vi.waitFor(() => {
      const preview = document.getElementById('filename-preview');
      expect(preview.textContent).toContain('640x360');
    });
  });
});

// ─── Animated GIF title branch ────────────────────────────────────────────

describe('Animated GIF title branch', () => {
  it('shows "Animated GIF variants" title for animated_gif media type', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') {
        return buildProbeResponse({
          mediaItems: [{
            index: 0, mediaType: 'animated_gif', label: 'Animated GIF • 1 variant',
            variants: [{
              url: 'https://video.twimg.com/tw_vod_gif/1111111111/pu/vid/480x480/gif.mp4',
              bitrate: 0, resolution: '480x480', label: '480x480 • MP4', filename: 'test_gif.mp4',
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
      expect(document.getElementById('result-title').textContent).toBe('Animated GIF variants');
    });
  });
});

// ─── Download all media button ────────────────────────────────────────────

describe('Download all media button', () => {
  it('is hidden when only one media item', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') return buildProbeResponse();
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
      if (payload.action === 'probe') return buildMultiMediaProbeResponse();
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

// ─── Media select change handler ──────────────────────────────────────────

describe('Media select change handler', () => {
  it('switches to second media item when media select changes', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') return buildMultiMediaProbeResponse();
      return { ok: false };
    });
    const input = document.getElementById('tweet-input');
    input.value = '2222222222';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('media-select').options.length).toBe(2);
    });

    const mediaSelect = document.getElementById('media-select');
    mediaSelect.value = '1';
    mediaSelect.dispatchEvent(new Event('change'));

    await vi.waitFor(() => {
      expect(document.getElementById('result-title').textContent).toContain('Animated GIF');
    });
  });
});

// ─── Preference change handlers ───────────────────────────────────────────

describe('Preference change handlers', () => {
  it('quality preference change saves to storage and shows ok status', async () => {
    let savedSettings = null;
    chrome.storage.sync.set = async (obj) => { savedSettings = obj; };

    const prefQuality = document.getElementById('pref-quality');
    prefQuality.value = 'medium';
    prefQuality.dispatchEvent(new Event('change'));

    await vi.waitFor(() => {
      expect(savedSettings).not.toBeNull();
      expect(savedSettings.defaultQuality).toBe('medium');
    });
    expect(document.getElementById('status').classList.contains('ok')).toBe(true);
  });

  it('small quality preference is saved correctly', async () => {
    let savedSettings = null;
    chrome.storage.sync.set = async (obj) => { savedSettings = obj; };

    const prefQuality = document.getElementById('pref-quality');
    prefQuality.value = 'small';
    prefQuality.dispatchEvent(new Event('change'));

    await vi.waitFor(() => {
      expect(savedSettings.defaultQuality).toBe('small');
    });
  });

  it('Save As toggle saves to storage and updates button labels', async () => {
    let savedSettings = null;
    chrome.storage.sync.set = async (obj) => { savedSettings = obj; };

    const promptSaveAs = document.getElementById('prompt-saveas');
    promptSaveAs.checked = true;
    promptSaveAs.dispatchEvent(new Event('change'));

    await vi.waitFor(() => {
      expect(savedSettings.promptSaveAs).toBe(true);
    });
    expect(document.getElementById('status').textContent).toContain('Save As');
  });

  it('Save As unchecking shows "download directly" message', async () => {
    let savedSettings = null;
    chrome.storage.sync.set = async (obj) => { savedSettings = obj; };

    const promptSaveAs = document.getElementById('prompt-saveas');
    promptSaveAs.checked = true;
    promptSaveAs.dispatchEvent(new Event('change'));
    await vi.waitFor(() => { expect(savedSettings).not.toBeNull(); });

    promptSaveAs.checked = false;
    promptSaveAs.dispatchEvent(new Event('change'));

    await vi.waitFor(() => {
      expect(document.getElementById('status').textContent).toContain('download directly');
    });
  });
});

// ─── Download button ─────────────────────────────────────────────────────

describe('Download button', () => {
  it('sends download message on click', async () => {
    // beforeEach already analyzed the tab, so state is populated
    let sentPayload = null;
    chrome.runtime.__setSendMessage(async (payload) => {
      sentPayload = payload;
      if (payload.action === 'download') {
        return { ok: true, filename: 'test.mp4', downloadId: 1, saveAs: false };
      }
      return { ok: false };
    });

    document.getElementById('download-btn').dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      expect(sentPayload).not.toBeNull();
    });
    expect(sentPayload.action).toBe('download');
    expect(sentPayload.saveAs).toBe(false);
  });

  it('shows error when download fails', async () => {
    let sentPayload = null;
    chrome.runtime.__setSendMessage(async (payload) => {
      sentPayload = payload;
      if (payload.action === 'download') {
        return { ok: false, err: 'Download failed: network error' };
      }
      return { ok: false };
    });

    document.getElementById('download-btn').dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      const statusEl = document.getElementById('status');
      expect(statusEl.textContent).toContain('Download failed');
      expect(statusEl.classList.contains('error')).toBe(true);
    });
  });

  it('shows "Save As opened" when download returns saveAs: true', async () => {
    let sentPayload = null;
    chrome.runtime.__setSendMessage(async (payload) => {
      sentPayload = payload;
      if (payload.action === 'download') {
        return { ok: true, filename: 'test_saveas.mp4', downloadId: 2, saveAs: true };
      }
      return { ok: false };
    });

    // Click the dedicated Save As button which sends saveAs: true
    document.getElementById('saveas-btn').dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      expect(sentPayload).not.toBeNull();
      expect(sentPayload.saveAs).toBe(true);
    });

    // The status transitions: "Opening Save As…" → "Save As opened for: …"
    await vi.waitFor(() => {
      const statusEl = document.getElementById('status');
      expect(statusEl.textContent).toContain('Save As opened');
    });
  });
});

// ─── Save As button ──────────────────────────────────────────────────────

describe('Save As button', () => {
  it('sends download with saveAs: true and shows Save As opened', async () => {
    let sentPayload = null;
    chrome.runtime.__setSendMessage(async (payload) => {
      sentPayload = payload;
      if (payload.action === 'download') {
        return { ok: true, filename: 'test_saveas.mp4', downloadId: 3, saveAs: true };
      }
      return { ok: false };
    });

    document.getElementById('saveas-btn').dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      expect(sentPayload).not.toBeNull();
      expect(sentPayload.action).toBe('download');
      expect(sentPayload.saveAs).toBe(true);
    });

    await vi.waitFor(() => {
      expect(document.getElementById('status').textContent).toContain('Save As opened');
    });
  });
});

// ─── Download All button ─────────────────────────────────────────────────

describe('Download All button', () => {
  it('sends downloadAll message on multi-media post', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') return buildMultiMediaProbeResponse();
      return { ok: false };
    });
    const input = document.getElementById('tweet-input');
    input.value = '2222222222';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('download-all-btn').hidden).toBe(false);
    });

    let sentPayload = null;
    chrome.runtime.__setSendMessage(async (payload) => {
      sentPayload = payload;
      if (payload.action === 'downloadAll') {
        return { ok: true, count: 2, requested: 2, dedupedCount: 0, downloads: [], errors: [] };
      }
      return { ok: false };
    });

    document.getElementById('download-all-btn').dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      expect(sentPayload).not.toBeNull();
    });
    expect(sentPayload.action).toBe('downloadAll');
  });

  it('shows error when downloadAll fails', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') return buildMultiMediaProbeResponse();
      return { ok: false };
    });
    const input = document.getElementById('tweet-input');
    input.value = '2222222222';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('download-all-btn').hidden).toBe(false);
    });

    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'downloadAll') {
        return { ok: false, err: 'Could not start the downloads.' };
      }
      return { ok: false };
    });

    document.getElementById('download-all-btn').dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      expect(document.getElementById('status').classList.contains('error')).toBe(true);
    });
  });

  it('shows warn status when some downloads have errors', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') return buildMultiMediaProbeResponse();
      return { ok: false };
    });
    const input = document.getElementById('tweet-input');
    input.value = '2222222222';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('download-all-btn').hidden).toBe(false);
    });

    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'downloadAll') {
        return {
          ok: true, count: 1, requested: 2, dedupedCount: 0, downloads: [],
          errors: [{ mediaIndex: 1, err: 'No matching MP4 variant.' }],
        };
      }
      return { ok: false };
    });

    document.getElementById('download-all-btn').dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      expect(document.getElementById('status').classList.contains('warn')).toBe(true);
    });
  });

  it('shows deduped count when downloads were already in progress', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') return buildMultiMediaProbeResponse();
      return { ok: false };
    });
    const input = document.getElementById('tweet-input');
    input.value = '2222222222';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('download-all-btn').hidden).toBe(false);
    });

    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'downloadAll') {
        return { ok: true, count: 2, requested: 2, dedupedCount: 1, downloads: [], errors: [] };
      }
      return { ok: false };
    });

    document.getElementById('download-all-btn').dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      expect(document.getElementById('status').textContent).toContain('already in progress');
    });
  });

  it('shows Save As message when saveAs is true', async () => {
    const promptSaveAs = document.getElementById('prompt-saveas');
    promptSaveAs.checked = true;
    promptSaveAs.dispatchEvent(new Event('change'));
    // allow async save
    await vi.waitFor(() => { /* settle */ });

    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') return buildMultiMediaProbeResponse();
      return { ok: false };
    });
    const input = document.getElementById('tweet-input');
    input.value = '2222222222';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('download-all-btn').hidden).toBe(false);
    });

    let sentPayload = null;
    chrome.runtime.__setSendMessage(async (payload) => {
      sentPayload = payload;
      if (payload.action === 'downloadAll') {
        return { ok: true, count: 2, requested: 2, dedupedCount: 0, downloads: [], errors: [] };
      }
      return { ok: false };
    });

    document.getElementById('download-all-btn').dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      expect(document.getElementById('status').textContent).toContain('Save As opened');
    });
    expect(sentPayload.saveAs).toBe(true);
  });
});

// ─── Copy URL button ─────────────────────────────────────────────────────

describe('Copy URL button', () => {
  it('copies variant URL to clipboard', async () => {
    const writtenTexts = [];
    globalThis.navigator.clipboard = {
      writeText: vi.fn(async (text) => { writtenTexts.push(text); }),
    };

    // Wait for the initial auto-analyze to settle
    await vi.waitFor(() => {
      expect(document.getElementById('result-card').hidden).toBe(false);
    });

    document.getElementById('copy-url-btn').dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      expect(writtenTexts.length).toBeGreaterThan(0);
    });
    expect(writtenTexts[0]).toContain('video.twimg.com');

    await vi.waitFor(() => {
      expect(document.getElementById('status').textContent).toContain('Copied');
    });
  });

  it('shows error when clipboard is denied', async () => {
    globalThis.navigator.clipboard = {
      writeText: vi.fn(async () => { throw new Error('Clipboard denied'); }),
    };

    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') return buildProbeResponse();
      return { ok: false };
    });
    const input = document.getElementById('tweet-input');
    input.value = '1111111111';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('result-card').hidden).toBe(false);
    });

    document.getElementById('copy-url-btn').dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      const statusEl = document.getElementById('status');
      expect(statusEl.textContent).toContain('Could not copy');
      expect(statusEl.classList.contains('error')).toBe(true);
    });
  });

  it('falls back to execCommand when clipboard API is unavailable', async () => {
    delete globalThis.navigator.clipboard;
    const originalExecCommand = document.execCommand;
    document.execCommand = vi.fn(() => true);

    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') return buildProbeResponse();
      return { ok: false };
    });
    const input = document.getElementById('tweet-input');
    input.value = '1111111111';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('result-card').hidden).toBe(false);
    });

    document.getElementById('copy-url-btn').dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    expect(document.getElementById('status').textContent).toContain('Copied');
    document.execCommand = originalExecCommand;
  });
});

// ─── Active tab auto-detection ────────────────────────────────────────────

describe('Active tab auto-detection', () => {
  it('shows "Paste a post URL" message when active tab has no tweet ID', async () => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    const nonXChrome = createPopupChromeMock({ mockTabs: [{ id: 1, url: 'https://example.com/some-page' }] });
    globalThis.chrome = nonXChrome;
    loadPopupHtml();
    nonXChrome.runtime.__setSendMessage(async () => ({ ok: false }));

    vi.resetModules();
    await import('../popup.js');

    await vi.waitFor(() => {
      expect(document.getElementById('status').textContent).toContain('Paste a post URL');
    });
  });

  it('handles tabs.query failure gracefully', async () => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    const failingChrome = createPopupChromeMock();
    failingChrome.tabs.query = async () => { throw new Error('Tab access denied'); };
    globalThis.chrome = failingChrome;
    loadPopupHtml();
    failingChrome.runtime.__setSendMessage(async () => ({ ok: false }));

    vi.resetModules();
    await import('../popup.js');

    await vi.waitFor(() => {
      expect(document.getElementById('status').textContent).toContain('Paste a post URL');
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
      expect(document.getElementById('status').textContent).toContain('valid');
    });
    expect(sentPayload).not.toBeNull();
    expect(sentPayload.action).toBe('probe');
    expect(document.getElementById('result-card').hidden).toBe(true);
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

// ─── Status classes (warn) ────────────────────────────────────────────────

describe('Status warn class', () => {
  it('sets warn class when downloadAll has partial errors', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') return buildMultiMediaProbeResponse();
      return { ok: false };
    });
    const input = document.getElementById('tweet-input');
    input.value = '2222222222';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('download-all-btn').hidden).toBe(false);
    });

    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'downloadAll') {
        return {
          ok: true, count: 1, requested: 2, dedupedCount: 0, downloads: [],
          errors: [{ mediaIndex: 1, err: 'No matching MP4 variant.' }],
        };
      }
      return { ok: false };
    });

    document.getElementById('download-all-btn').dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      expect(document.getElementById('status').classList.contains('warn')).toBe(true);
    });
  });
});

// ─── Download guard (no tweetId) ──────────────────────────────────────────

describe('Download guard', () => {
  it('shows error when downloadAll clicked on single-media post', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') return buildProbeResponse();
      return { ok: false };
    });
    const input = document.getElementById('tweet-input');
    input.value = '1111111111';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('result-card').hidden).toBe(false);
    });

    // downloadAllBtn is hidden, but force-visible and click
    const downloadAllBtn = document.getElementById('download-all-btn');
    downloadAllBtn.hidden = false;
    downloadAllBtn.dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      expect(document.getElementById('status').textContent).toContain('only has one');
    });
  });
});

// ─── Post rendering branches ─────────────────────────────────────────────

describe('Post rendering branches', () => {
  it('shows "Post unavailable" when permalink is empty in probe response', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') {
        return buildProbeResponse({ permalink: '', tweetId: '9999999999' });
      }
      return { ok: false };
    });
    const input = document.getElementById('tweet-input');
    input.value = '9999999999';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('permalink').textContent).toBe('Post unavailable');
    });
  });

  it('shows display name when screen name is empty', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') {
        return buildProbeResponse({ screenName: '', displayName: 'Display Only' });
      }
      return { ok: false };
    });
    const input = document.getElementById('tweet-input');
    input.value = '1111111111';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      const postOwner = document.getElementById('post-owner');
      expect(postOwner.textContent).toContain('Display Only');
    });
  });

  it('hides post text when text is empty', async () => {
    chrome.runtime.__setSendMessage(async (payload) => {
      if (payload.action === 'probe') {
        return buildProbeResponse({ text: '', tweetId: '9999999998' });
      }
      return { ok: false };
    });
    const input = document.getElementById('tweet-input');
    input.value = '9999999998';
    const form = document.getElementById('lookup-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('result-card').hidden).toBe(false);
      expect(document.getElementById('post-text').hidden).toBe(true);
    });
  });
});
