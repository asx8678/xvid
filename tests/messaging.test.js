/**
 * Integration tests for background.js message dispatch.
 *
 * Strategy: install chrome mock + fetch mock, then import background.js which
 * registers its onMessage listener. Use chrome.runtime.sendMessage to exercise
 * the probe/download/downloadAll handlers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installChromeMock } from './setup.js';

import singleVideoFixture from './fixtures/single-video.json';
import multiVideoFixture from './fixtures/multi-video.json';
import animatedGifFixture from './fixtures/animated-gif.json';
import stringBitrateFixture from './fixtures/string-bitrate.json';

let chrome;
let T;

beforeEach(async () => {
  chrome = installChromeMock();

  // Mock global fetch to return fixture data based on the tweet ID
  globalThis.fetch = vi.fn(async (url) => {
    const urlObj = new URL(String(url));
    const tweetId = urlObj.searchParams.get('id');

    const fixtureMap = {
      '1111111111': singleVideoFixture,
      '2222222222': multiVideoFixture,
      '3333333333': animatedGifFixture,
      '5555555555': stringBitrateFixture,
    };

    const fixture = fixtureMap[tweetId];
    if (fixture) {
      return {
        ok: true,
        status: 200,
        json: async () => fixture,
        body: { cancel: vi.fn() },
      };
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({}),
      body: { cancel: vi.fn() },
    };
  });

  // Enable test exports from background.js
  globalThis.__XVID_TEST__ = {};

  // Reset module cache and load background.js fresh
  vi.resetModules();
  await import('../background.js');

  T = globalThis.__XVID_TEST__;
});

afterEach(() => {
  // Clear inflight downloads + metadata cache to prevent timer leaks
  if (T) T.clearCaches();
  vi.restoreAllMocks();
  delete globalThis.__XVID_TEST__;
});

// ─── probe action ────────────────────────────────────────────────────────

describe('probe action', () => {
  it('returns ok:true with media items for a valid tweet', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'probe',
      input: 'https://x.com/testuser/status/1111111111',
    });

    expect(response.ok).toBe(true);
    expect(response.tweetId).toBe('1111111111');
    expect(Array.isArray(response.mediaItems)).toBe(true);
    expect(response.mediaItems.length).toBeGreaterThan(0);
  });

  it('returns media items with variants for single video fixture', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'probe',
      input: '1111111111',
    });

    expect(response.ok).toBe(true);
    expect(response.mediaItems.length).toBe(1);
    expect(response.mediaItems[0].variants.length).toBe(3);
    expect(response.mediaItems[0].variants[0].bitrate).toBe(2176000);
  });

  it('returns multiple media items for multi-video fixture', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'probe',
      input: '2222222222',
    });

    expect(response.ok).toBe(true);
    expect(response.mediaItems.length).toBe(2);
  });

  it('returns error for invalid input', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'probe',
      input: 'https://evil.example.com/status/123',
    });

    expect(response.ok).toBe(false);
    expect(response.err).toBeTruthy();
  });

  it('returns error for empty input', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'probe',
      input: '',
    });

    expect(response.ok).toBe(false);
    expect(response.err).toContain('valid');
  });

  it('handles string bitrate fixture correctly (v2.3.0 regression)', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'probe',
      input: '5555555555',
    });

    expect(response.ok).toBe(true);
    const variants = response.mediaItems[0].variants;
    expect(variants.length).toBe(5);
    expect(variants[0].bitrate).toBe(2176000);
  });

  it('returns 404 error for unknown tweet ID', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'probe',
      input: '9999999999',
    });

    expect(response.ok).toBe(false);
    expect(response.err).toContain('not be found');
  });
});

// ─── download action ─────────────────────────────────────────────────────

describe('download action', () => {
  it('triggers chrome.downloads.download exactly once', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'download',
      input: '1111111111',
    });

    expect(response.ok).toBe(true);
    const downloads = chrome.__test.__getDownloads();
    expect(downloads).toHaveLength(1);
    expect(downloads[0].url).toContain('twimg.com');
  });

  it('uses sanitized filename in download', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'download',
      input: '1111111111',
    });

    expect(response.ok).toBe(true);
    const downloads = chrome.__test.__getDownloads();
    expect(downloads[0].filename).toBeTruthy();
    expect(downloads[0].filename).not.toContain('..');
    expect(downloads[0].filename).not.toContain('\x00');
    expect(downloads[0].filename.endsWith('.mp4')).toBe(true);
  });

  it('returns error for invalid tweet ID', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'download',
      input: 'not-a-url',
    });

    expect(response.ok).toBe(false);
    expect(response.err).toBeTruthy();
  });

  it('returns error for non-existent tweet', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'download',
      input: '9999999999',
    });

    expect(response.ok).toBe(false);
  });

  it('respects saveAs option', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'download',
      input: '1111111111',
      saveAs: true,
    });

    expect(response.ok).toBe(true);
    expect(response.saveAs).toBe(true);
    const downloads = chrome.__test.__getDownloads();
    expect(downloads[0].saveAs).toBe(true);
  });

  it('selects variant by URL when variantUrl provided', async () => {
    const probe = await chrome.runtime.sendMessage({
      action: 'probe',
      input: '1111111111',
    });

    const mediumUrl = probe.mediaItems[0].variants[1].url;
    chrome.__test.__clearDownloads();

    const response = await chrome.runtime.sendMessage({
      action: 'download',
      input: '1111111111',
      variantUrl: mediumUrl,
    });

    expect(response.ok).toBe(true);
    const downloads = chrome.__test.__getDownloads();
    expect(downloads[0].url).toBe(mediumUrl);
  });
});

// ─── downloadAll action ──────────────────────────────────────────────────

describe('downloadAll action', () => {
  it('triggers sequential downloads for multi-media post', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'downloadAll',
      input: '2222222222',
    });

    expect(response.ok).toBe(true);
    expect(response.count).toBe(2);
    expect(response.requested).toBe(2);
    const downloads = chrome.__test.__getDownloads();
    expect(downloads).toHaveLength(2);
  });

  it('downloads are sequential (not parallel) — order preserved', async () => {
    await chrome.runtime.sendMessage({
      action: 'downloadAll',
      input: '2222222222',
    });

    const downloads = chrome.__test.__getDownloads();
    expect(downloads[0].url).toContain('vid1_high');
    expect(downloads[1].url).toContain('vid2_high');
  });

  it('does not start the second download until the first resolves', async () => {
    let resolveFirst;
    const firstDownload = new Promise((resolve) => {
      resolveFirst = () => resolve(101);
    });
    const downloadSpy = vi.fn()
      .mockImplementationOnce(() => firstDownload)
      .mockResolvedValueOnce(102);
    chrome.downloads.download = downloadSpy;

    const pending = chrome.runtime.sendMessage({
      action: 'downloadAll',
      input: '2222222222',
    });

    // Wait until the first download has been called
    await vi.waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledTimes(1);
    });

    // Second download should NOT have started yet
    expect(downloadSpy).toHaveBeenCalledTimes(1);

    // Now resolve the first download
    resolveFirst();

    const response = await pending;
    expect(response.ok).toBe(true);
    expect(downloadSpy).toHaveBeenCalledTimes(2);
  });

  it('works for single-media post', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'downloadAll',
      input: '1111111111',
    });

    expect(response.ok).toBe(true);
    expect(response.count).toBe(1);
  });

  it('returns error for invalid tweet', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'downloadAll',
      input: 'not-valid',
    });

    expect(response.ok).toBe(false);
  });
});

// ─── unknown action ──────────────────────────────────────────────────────

describe('unknown action', () => {
  it('returns false / no reply for unknown actions', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'foobar',
    });

    expect(response).toBeUndefined();
  });

  it('returns false for empty/null message', async () => {
    const response = await chrome.runtime.sendMessage(null);
    expect(response).toBeUndefined();
  });
});

// ─── error handling ──────────────────────────────────────────────────────

describe('error handling', () => {
  it('handler errors reply with {ok: false, err: "..."}', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network failure');
    });

    const response = await chrome.runtime.sendMessage({
      action: 'probe',
      input: '1111111111',
    });

    expect(response.ok).toBe(false);
    expect(response.err).toBeTruthy();
  });

  it('handler errors allow popup busy-state recovery', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Timeout');
    });

    const response = await chrome.runtime.sendMessage({
      action: 'download',
      input: '1111111111',
    });

    expect(response).toHaveProperty('ok', false);
    expect(response).toHaveProperty('err');
    expect(typeof response.err).toBe('string');
  });
});

// ─── 'dl' alias ──────────────────────────────────────────────────────────

describe('dl alias', () => {
  it('"dl" action works same as "download"', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'dl',
      input: '1111111111',
    });

    expect(response.ok).toBe(true);
    const downloads = chrome.__test.__getDownloads();
    expect(downloads).toHaveLength(1);
  });
});
