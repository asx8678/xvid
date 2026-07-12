/**
 * Tests for background.js.
 *
 * Strategy: set globalThis.__XVID_TEST__ = {} before loading background.js,
 * which populates it via the guarded export block, then exercise the
 * functions directly against the syndication-endpoint fixtures.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installChromeMock } from './setup.js';

const FIXTURE_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures');
const loadFixture = (name) => JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8'));

let chrome;
let T;

function mockFetch(data, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (data instanceof Error) throw data;
      return data;
    },
    body: { cancel: vi.fn() },
  });
}

beforeEach(async () => {
  chrome = installChromeMock();
  globalThis.__XVID_TEST__ = {};
  mockFetch({});
  vi.resetModules();
  await import('../background.js');
  T = globalThis.__XVID_TEST__;
});

afterEach(() => {
  delete globalThis.__XVID_TEST__;
  vi.restoreAllMocks();
});

// ─── tweetIdFromUrl ─────────────────────────────────────────────────────────

describe('tweetIdFromUrl', () => {
  it.each([
    ['https://x.com/user/status/1234567890', '1234567890'],
    ['https://x.com/user/status/1234567890?s=20', '1234567890'],
    ['https://x.com/user/status/1234567890/photo/1', '1234567890'],
    ['https://twitter.com/user/statuses/1234567890', '1234567890'],
    ['https://x.com/i/web/status/1234567890', '1234567890'],
    ['https://mobile.twitter.com/user/status/1234567890', '1234567890'],
  ])('extracts the ID from %s', (url, id) => {
    expect(T.tweetIdFromUrl(url)).toBe(id);
  });

  it.each([
    'https://evil.com/user/status/1234567890',
    'https://evil.com/x.com/status/1234567890',
    'http://x.com/user/status/1234567890',
    'https://x.com/home',
    'https://x.com/user/status/123', // too short
    '',
    undefined,
  ])('rejects %s', (url) => {
    expect(T.tweetIdFromUrl(url)).toBeNull();
  });
});

// ─── variant extraction ─────────────────────────────────────────────────────

describe('bestMp4Variant', () => {
  const mp4 = (url, bitrate) => ({ content_type: 'video/mp4', url, bitrate });

  it('picks the highest bitrate', () => {
    const best = T.bestMp4Variant({
      video_info: {
        variants: [
          mp4('https://video.twimg.com/vid/640x360/med.mp4', 832000),
          mp4('https://video.twimg.com/vid/1280x720/high.mp4', 2176000),
          mp4('https://video.twimg.com/vid/320x180/low.mp4', 256000),
        ],
      },
    });
    expect(best.url).toContain('high.mp4');
    expect(best.resolution).toBe('1280x720');
  });

  it('coerces string bitrates and treats empty strings as 0', () => {
    const best = T.bestMp4Variant({
      video_info: {
        variants: [
          mp4('https://video.twimg.com/vid/640x360/med.mp4', '832000'),
          mp4('https://video.twimg.com/vid/1280x720/high.mp4', '2176000'),
          mp4('https://video.twimg.com/vid/320x180/none.mp4', ''),
        ],
      },
    });
    expect(best.url).toContain('high.mp4');
    expect(best.bitrate).toBe(2176000);
  });

  it('breaks bitrate ties by resolution area', () => {
    const best = T.bestMp4Variant({
      video_info: {
        variants: [
          mp4('https://video.twimg.com/vid/320x320/small.mp4', 0),
          mp4('https://video.twimg.com/vid/480x480/large.mp4', 0),
        ],
      },
    });
    expect(best.url).toContain('large.mp4');
  });

  it('ignores non-MP4, non-HTTPS, non-Twimg, and malformed variants', () => {
    const best = T.bestMp4Variant({
      video_info: {
        variants: [
          { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/pl/hls.m3u8' },
          mp4('http://video.twimg.com/vid/640x360/insecure.mp4', 9999999),
          mp4('https://evil.com/vid/640x360/evil.mp4', 9999999),
          mp4('https://eviltwimg.com/vid/640x360/evil.mp4', 9999999),
          mp4('not a url', 9999999),
          mp4('https://video.twimg.com/vid/320x180/ok.mp4', 256000),
        ],
      },
    });
    expect(best.url).toContain('ok.mp4');
  });

  it('returns null when nothing qualifies', () => {
    expect(T.bestMp4Variant({ video_info: { variants: [] } })).toBeNull();
    expect(T.bestMp4Variant({})).toBeNull();
    expect(T.bestMp4Variant(undefined)).toBeNull();
  });
});

describe('videoMediaDetails', () => {
  it('reads camelCase and snake_case containers', () => {
    const media = [{ type: 'video' }, { type: 'photo' }, { type: 'animated_gif' }];
    expect(T.videoMediaDetails({ mediaDetails: media })).toHaveLength(2);
    expect(T.videoMediaDetails({ media_details: media })).toHaveLength(2);
    expect(T.videoMediaDetails({})).toEqual([]);
    expect(T.videoMediaDetails(null)).toEqual([]);
  });
});

// ─── fetchTweetMetadata (fixture-driven) ────────────────────────────────────

describe('fetchTweetMetadata', () => {
  it('extracts the best variant from a single-video post', async () => {
    mockFetch(loadFixture('single-video.json'));
    const meta = await T.fetchTweetMetadata('1234567890');

    expect(meta.screenName).toBe('testuser');
    expect(meta.tweetId).toBe('1234567890');
    expect(meta.mediaItems).toHaveLength(1);
    expect(meta.mediaItems[0].url).toContain('1280x720/a1b2c3.mp4');
  });

  it('extracts every item from a multi-video post', async () => {
    mockFetch(loadFixture('multi-video.json'));
    const meta = await T.fetchTweetMetadata('1234567890');

    expect(meta.mediaItems.map((item) => item.url)).toEqual([
      expect.stringContaining('vid1_high.mp4'),
      expect.stringContaining('vid2_high.mp4'),
    ]);
  });

  it('handles animated GIFs (zero bitrates, area tiebreak)', async () => {
    mockFetch(loadFixture('animated-gif.json'));
    const meta = await T.fetchTweetMetadata('1234567890');

    expect(meta.mediaItems).toHaveLength(1);
    expect(meta.mediaItems[0].url).toContain('480x480/gif_high.mp4');
  });

  it('handles snake_case media_details payloads', async () => {
    mockFetch(loadFixture('snake-case-media-details.json'));
    const meta = await T.fetchTweetMetadata('1234567890');
    expect(meta.mediaItems).toHaveLength(1);
  });

  it('picks the highest string bitrate', async () => {
    mockFetch(loadFixture('string-bitrate.json'));
    const meta = await T.fetchTweetMetadata('1234567890');
    expect(meta.mediaItems[0].url).toContain('str_high.mp4');
  });

  it('prefers top-level media over the quoted tweet', async () => {
    mockFetch(loadFixture('quoted-with-video.json'));
    const meta = await T.fetchTweetMetadata('1234567890');

    expect(meta.screenName).toBe('quoter');
    expect(meta.mediaItems[0].url).toContain('quoted_high.mp4');
  });

  it('falls back to parent media and retargets tweetId/screenName', async () => {
    mockFetch(loadFixture('quoted-only-video.json'));
    const meta = await T.fetchTweetMetadata('1234567890');

    expect(meta.tweetId).toBe('9998887776665554443');
    expect(meta.screenName).toBe('originalposter');
    expect(meta.mediaItems[0].url).toContain('parent_high.mp4');
  });

  it('rejects tombstoned/restricted posts', async () => {
    mockFetch(loadFixture('restricted.json'));
    await expect(T.fetchTweetMetadata('1234567890')).rejects.toThrow(
      'No downloadable video was found in that post.'
    );
  });

  it('parses every captured real syndication payload without surprises', async () => {
    const files = readdirSync(join(FIXTURE_DIR, 'real-syndication')).filter((name) =>
      /^\d+\.json$/.test(name)
    );
    expect(files.length).toBeGreaterThan(0);

    for (const name of files) {
      mockFetch(loadFixture(join('real-syndication', name)));
      await T.fetchTweetMetadata(name.replace('.json', '')).then(
        (meta) => {
          expect(meta.mediaItems.length).toBeGreaterThan(0);
          for (const item of meta.mediaItems) {
            expect(item.url).toMatch(/^https:\/\/.*twimg\.com\//);
          }
        },
        (err) => {
          expect(err.message).toBe('No downloadable video was found in that post.');
        }
      );
    }
  });

  it('falls back to the screen name "video" when the name looks unsafe', async () => {
    const fixture = loadFixture('single-video.json');
    fixture.user.screen_name = '../evil';
    mockFetch(fixture);

    const meta = await T.fetchTweetMetadata('1234567890');
    expect(meta.screenName).toBe('video');
  });

  it.each([
    [404, 'That post could not be found.'],
    [401, 'This post is unavailable or restricted.'],
    [403, 'This post is unavailable or restricted.'],
    [429, 'Rate limited by X/Twitter. Wait a moment and try again.'],
    [500, 'Post lookup failed (500).'],
  ])('maps HTTP %i to a friendly error', async (status, message) => {
    mockFetch({}, status);
    await expect(T.fetchTweetMetadata('1234567890')).rejects.toThrow(message);
  });

  it('reports invalid JSON', async () => {
    mockFetch(new Error('bad json'));
    await expect(T.fetchTweetMetadata('1234567890')).rejects.toThrow(
      'X/Twitter returned invalid JSON for that post.'
    );
  });

  it('maps fetch aborts to a timeout message', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expect(T.fetchTweetMetadata('1234567890')).rejects.toThrow(
      'Timed out while contacting X/Twitter. Try again.'
    );
  });
});

// ─── filenames ──────────────────────────────────────────────────────────────

describe('buildFilename', () => {
  const item = { url: 'https://video.twimg.com/x.mp4', bitrate: 1, resolution: '1280x720' };

  it('builds @user_id_resolution.mp4 for single-media posts', () => {
    const meta = { screenName: 'testuser', tweetId: '42', mediaItems: [item] };
    expect(T.buildFilename(meta, item, 0)).toBe('@testuser_42_1280x720.mp4');
  });

  it('adds an mN part for multi-media posts', () => {
    const meta = { screenName: 'u', tweetId: '42', mediaItems: [item, item] };
    expect(T.buildFilename(meta, item, 1)).toBe('@u_42_m2_1280x720.mp4');
  });

  it('omits missing resolutions', () => {
    const bare = { ...item, resolution: '' };
    const meta = { screenName: 'u', tweetId: '42', mediaItems: [bare] };
    expect(T.buildFilename(meta, bare, 0)).toBe('@u_42.mp4');
  });
});

// ─── download flow ──────────────────────────────────────────────────────────

describe('downloadTweetMedia', () => {
  it('starts one uniquified download per media item', async () => {
    mockFetch(loadFixture('multi-video.json'));
    const result = await T.downloadTweetMedia('1234567890', false);

    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);

    const downloads = chrome.__test.__getDownloads();
    expect(downloads).toHaveLength(2);
    expect(downloads[0]).toMatchObject({
      url: expect.stringContaining('vid1_high.mp4'),
      filename: '@multimediaposter_1234567890_m1_1280x720.mp4',
      conflictAction: 'uniquify',
      saveAs: false,
    });
    expect(downloads[1].filename).toBe('@multimediaposter_1234567890_m2_720x720.mp4');
  });

  it('passes saveAs through', async () => {
    mockFetch(loadFixture('single-video.json'));
    await T.downloadTweetMedia('1234567890', true);
    expect(chrome.__test.__getDownloads()[0].saveAs).toBe(true);
  });
});

// ─── message contract ───────────────────────────────────────────────────────

describe('onMessage', () => {
  it('handles download requests', async () => {
    mockFetch(loadFixture('single-video.json'));
    const reply = await chrome.__test.__triggerMessage({ action: 'download', id: '1234567890' });

    expect(reply.ok).toBe(true);
    expect(chrome.__test.__getDownloads()).toHaveLength(1);
  });

  it('rejects malformed IDs without fetching', async () => {
    const reply = await chrome.__test.__triggerMessage({ action: 'download', id: 'nope' });
    expect(reply).toEqual({ ok: false, err: 'Invalid tweet ID.' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('replies with the failure reason', async () => {
    mockFetch(loadFixture('restricted.json'));
    const reply = await chrome.__test.__triggerMessage({ action: 'download', id: '1234567890' });
    expect(reply).toEqual({ ok: false, err: 'No downloadable video was found in that post.' });
  });

  it('ignores unknown and malformed messages', async () => {
    await expect(chrome.__test.__triggerMessage({ action: 'probe' })).resolves.toBeUndefined();
    await expect(chrome.__test.__triggerMessage(null)).resolves.toBeUndefined();
  });
});

// ─── toolbar action ─────────────────────────────────────────────────────────

describe('action.onClicked', () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('downloads the video of the open post', async () => {
    mockFetch(loadFixture('single-video.json'));
    chrome.__test.__triggerActionClick({ url: 'https://x.com/testuser/status/1234567890' });
    await tick();

    expect(chrome.__test.__getDownloads()).toHaveLength(1);
    expect(chrome.__test.__getBadgeCalls()).toEqual([]);
  });

  it('flashes ? on non-post pages', async () => {
    chrome.__test.__triggerActionClick({ url: 'https://example.com/' });
    await tick();

    expect(chrome.__test.__getDownloads()).toHaveLength(0);
    expect(chrome.__test.__getBadgeCalls()).toContain('?');
  });

  it('flashes ! when the lookup fails', async () => {
    mockFetch(loadFixture('restricted.json'));
    chrome.__test.__triggerActionClick({ url: 'https://x.com/testuser/status/1234567890' });
    await tick();

    expect(chrome.__test.__getBadgeCalls()).toContain('!');
  });
});
