/**
 * Unit tests for background.js pure helpers.
 *
 * Strategy: set globalThis.__XVID_TEST__ = {} before loading background.js,
 * which populates it via its guarded Object.freeze export block. Then we
 * test the extracted functions directly.
 *
 * We use dynamic import() through Vite's pipeline for proper coverage tracking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installChromeMock } from './setup.js';

let T; // __XVID_TEST__ helpers

beforeEach(async () => {
  // Fresh chrome mock
  installChromeMock();

  // Signal to background.js that we want the test exports
  globalThis.__XVID_TEST__ = {};

  // Mock fetch so the service worker init doesn't explode
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ mediaDetails: [] }),
    body: { cancel: vi.fn() },
  });

  // Reset module cache so background.js re-executes each time
  vi.resetModules();

  // Load background.js through Vite's module pipeline (for coverage)
  await import('../background.js');

  T = globalThis.__XVID_TEST__;

  // Reset caches between tests via safe API
  if (T) T.clearCaches();
});

afterEach(() => {
  delete globalThis.__XVID_TEST__;
  vi.restoreAllMocks();
});

// ─── URL / ID parser ─────────────────────────────────────────────────────

describe('normalizeTweetId', () => {
  it('accepts a bare numeric ID', () => {
    expect(T.normalizeTweetId('1234567890')).toBe('1234567890');
  });

  it('accepts a numeric type input', () => {
    expect(T.normalizeTweetId(1234567890)).toBe('1234567890');
  });

  it('accepts https://x.com/user/status/123', () => {
    expect(T.normalizeTweetId('https://x.com/someuser/status/1234567890')).toBe('1234567890');
  });

  it('accepts https://twitter.com/user/status/123', () => {
    expect(T.normalizeTweetId('https://twitter.com/someuser/status/1234567890')).toBe('1234567890');
  });

  it('accepts https://mobile.twitter.com/user/status/123', () => {
    expect(T.normalizeTweetId('https://mobile.twitter.com/someuser/status/1234567890')).toBe('1234567890');
  });

  it('accepts www.x.com URL', () => {
    expect(T.normalizeTweetId('www.x.com/user/status/1234567890')).toBe('1234567890');
  });

  it('accepts x.com/ without scheme', () => {
    expect(T.normalizeTweetId('x.com/someuser/status/1234567890')).toBe('1234567890');
  });

  it('accepts mobile.twitter.com/ without scheme', () => {
    expect(T.normalizeTweetId('mobile.twitter.com/someuser/status/1234567890')).toBe('1234567890');
  });

  it('accepts /status/ path-only input', () => {
    expect(T.normalizeTweetId('/someuser/status/1234567890')).toBe('1234567890');
  });

  it('accepts /statuses/ URL variant', () => {
    expect(T.normalizeTweetId('https://x.com/user/statuses/1234567890')).toBe('1234567890');
  });

  it('accepts /i/web/status/ URL', () => {
    expect(T.normalizeTweetId('https://x.com/i/web/status/1234567890')).toBe('1234567890');
  });

  it('accepts /i/status/ URL', () => {
    expect(T.normalizeTweetId('https://x.com/i/status/1234567890')).toBe('1234567890');
  });

  // v2.3.0 hardening — rejection cases
  it('rejects evil.example.com domain', () => {
    expect(T.normalizeTweetId('https://evil.example.com/status/1234567890')).toBeNull();
  });

  it('rejects x.com.evil.com subdomain attack', () => {
    expect(T.normalizeTweetId('https://x.com.evil.com/status/1234567890')).toBeNull();
  });

  it('rejects notx.com domain', () => {
    expect(T.normalizeTweetId('https://notx.com/path/status/1234567890')).toBeNull();
  });

  it('rejects non-numeric status IDs', () => {
    expect(T.normalizeTweetId('https://x.com/user/status/abc')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(T.normalizeTweetId('')).toBeNull();
  });

  it('rejects null input', () => {
    expect(T.normalizeTweetId(null)).toBeNull();
  });

  it('rejects undefined input', () => {
    expect(T.normalizeTweetId(undefined)).toBeNull();
  });

  it('rejects non-string non-number input', () => {
    expect(T.normalizeTweetId({})).toBeNull();
    expect(T.normalizeTweetId([])).toBeNull();
  });

  it('rejects http:// (non-https) URLs', () => {
    expect(T.normalizeTweetId('http://x.com/user/status/1234567890')).toBeNull();
  });

  it('rejects IDs shorter than 5 digits', () => {
    expect(T.normalizeTweetId('1234')).toBeNull();
  });

  it('rejects IDs longer than 25 digits', () => {
    expect(T.normalizeTweetId('1'.repeat(26))).toBeNull();
  });

  it('trims whitespace from input', () => {
    expect(T.normalizeTweetId('  1234567890  ')).toBe('1234567890');
  });
});

// ─── Hostile input regression tests (v2.3.0 security hardening) ─────────

describe('normalizeTweetId rejects hostile inputs (security regression)', () => {
  it.each([
    'https://evil.com/status/123',
    'https://evil.com/status/1234567890',
    'https://x.com.evil.com/status/1234567890',
    'https://notx.com/path/status/1234567890',
    'javascript:alert(1)',
    'javascript://x.com/user/status/1234567890',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
  ])('rejects %s', (input) => {
    expect(T.normalizeTweetId(input)).toBeNull();
  });
});

// ─── buildTweetUrlCandidate ───────────────────────────────────────────────

describe('buildTweetUrlCandidate', () => {
  it('passes through URLs that already have a scheme', () => {
    expect(T.buildTweetUrlCandidate('https://x.com/user/status/1')).toBe('https://x.com/user/status/1');
  });

  it('prefixes www.x.com/ with https://', () => {
    expect(T.buildTweetUrlCandidate('www.x.com/user/status/1')).toBe('https://www.x.com/user/status/1');
  });

  it('prefixes x.com/ with https://', () => {
    expect(T.buildTweetUrlCandidate('x.com/user/status/1')).toBe('https://x.com/user/status/1');
  });

  it('prefixes twitter.com/ with https://', () => {
    expect(T.buildTweetUrlCandidate('twitter.com/user/status/1')).toBe('https://twitter.com/user/status/1');
  });

  it('prefixes mobile.twitter.com/ with https://', () => {
    expect(T.buildTweetUrlCandidate('mobile.twitter.com/user/status/1')).toBe('https://mobile.twitter.com/user/status/1');
  });

  it('returns empty string for non-X/Twitter domains', () => {
    expect(T.buildTweetUrlCandidate('evil.com/user/status/1')).toBe('');
  });

  it('returns empty string for random text', () => {
    expect(T.buildTweetUrlCandidate('just some text')).toBe('');
  });
});

// ─── matchTweetIdFromPath ─────────────────────────────────────────────────

describe('matchTweetIdFromPath', () => {
  it('extracts ID from /status/ path', () => {
    expect(T.matchTweetIdFromPath('/user/status/1234567890')).toBe('1234567890');
  });

  it('extracts ID from /statuses/ path', () => {
    expect(T.matchTweetIdFromPath('/user/statuses/1234567890')).toBe('1234567890');
  });

  it('extracts ID from /i/web/status/ path', () => {
    expect(T.matchTweetIdFromPath('/i/web/status/1234567890')).toBe('1234567890');
  });

  it('extracts ID from /i/status/ path', () => {
    expect(T.matchTweetIdFromPath('/i/status/1234567890')).toBe('1234567890');
  });

  it('returns null for path without status segment', () => {
    expect(T.matchTweetIdFromPath('/user/tweets/1234567890')).toBeNull();
  });

  it('returns null for non-numeric ID in path', () => {
    expect(T.matchTweetIdFromPath('/user/status/abc')).toBeNull();
  });
});

// ─── extractMp4Variants (MP4 ranking + Twimg HTTPS filter) ────────────────

describe('extractMp4Variants', () => {
  it('filters to only video/mp4 content type', () => {
    const variants = [
      { content_type: 'video/mp4', url: 'https://video.twimg.com/test/pu/vid/640x360/a.mp4', bitrate: 832000 },
      { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/test/pu/pl/hls.m3u8', bitrate: 0 },
      { content_type: 'video/webm', url: 'https://video.twimg.com/test/pu/vid/640x360/a.webm', bitrate: 500000 },
    ];
    const result = T.extractMp4Variants(variants);
    expect(result).toHaveLength(1);
    expect(result[0].url).toContain('a.mp4');
  });

  it('sorts variants by bitrate descending (best first)', () => {
    const variants = [
      { content_type: 'video/mp4', url: 'https://video.twimg.com/test/pu/vid/320x180/low.mp4', bitrate: 256000 },
      { content_type: 'video/mp4', url: 'https://video.twimg.com/test/pu/vid/1280x720/high.mp4', bitrate: 2176000 },
      { content_type: 'video/mp4', url: 'https://video.twimg.com/test/pu/vid/640x360/med.mp4', bitrate: 832000 },
    ];
    const result = T.extractMp4Variants(variants);
    expect(result).toHaveLength(3);
    expect(result[0].bitrate).toBe(2176000);
    expect(result[1].bitrate).toBe(832000);
    expect(result[2].bitrate).toBe(256000);
  });

  it('normalizes string bitrate "832000" to number (v2.3.0 regression)', () => {
    const variants = [
      { content_type: 'video/mp4', url: 'https://video.twimg.com/test/pu/vid/1280x720/high.mp4', bitrate: '2176000' },
      { content_type: 'video/mp4', url: 'https://video.twimg.com/test/pu/vid/640x360/med.mp4', bitrate: '832000' },
      { content_type: 'video/mp4', url: 'https://video.twimg.com/test/pu/vid/320x180/low.mp4', bitrate: '256000' },
    ];
    const result = T.extractMp4Variants(variants);
    expect(result).toHaveLength(3);
    expect(result[0].bitrate).toBe(2176000);
    expect(result[1].bitrate).toBe(832000);
    expect(result[2].bitrate).toBe(256000);
  });

  it('treats empty string bitrate as 0', () => {
    const variants = [
      { content_type: 'video/mp4', url: 'https://video.twimg.com/test/pu/vid/640x360/a.mp4', bitrate: '' },
    ];
    const result = T.extractMp4Variants(variants);
    expect(result).toHaveLength(1);
    expect(result[0].bitrate).toBe(0);
  });

  it('treats non-numeric string bitrate as 0', () => {
    const variants = [
      { content_type: 'video/mp4', url: 'https://video.twimg.com/test/pu/vid/640x360/a.mp4', bitrate: 'not-a-number' },
    ];
    const result = T.extractMp4Variants(variants);
    expect(result).toHaveLength(1);
    expect(result[0].bitrate).toBe(0);
  });

  // Twimg HTTPS filter tests
  it('rejects http:// URLs (not HTTPS)', () => {
    const variants = [
      { content_type: 'video/mp4', url: 'http://video.twimg.com/test/pu/vid/640x360/a.mp4', bitrate: 832000 },
    ];
    const result = T.extractMp4Variants(variants);
    expect(result).toHaveLength(0);
  });

  it('rejects non-twimg.com HTTPS URLs', () => {
    const variants = [
      { content_type: 'video/mp4', url: 'https://evil.com/twimg/x.mp4', bitrate: 832000 },
    ];
    const result = T.extractMp4Variants(variants);
    expect(result).toHaveLength(0);
  });

  it('rejects https://video.twimg.com.evil.com/ suffix-spoofing attack', () => {
    const variants = [{
      content_type: 'video/mp4',
      url: 'https://video.twimg.com.evil.com/x.mp4',
      bitrate: 832000,
    }];
    expect(T.extractMp4Variants(variants)).toHaveLength(0);
  });

  it('accepts https://video.twimg.com/ URLs', () => {
    const variants = [
      { content_type: 'video/mp4', url: 'https://video.twimg.com/ext_tw_video/test/pu/vid/640x360/a.mp4', bitrate: 832000 },
    ];
    const result = T.extractMp4Variants(variants);
    expect(result).toHaveLength(1);
  });

  it('accepts https://pbs.twimg.com/ URLs', () => {
    const variants = [
      { content_type: 'video/mp4', url: 'https://pbs.twimg.com/test/pu/vid/640x360/a.mp4', bitrate: 500000 },
    ];
    const result = T.extractMp4Variants(variants);
    expect(result).toHaveLength(1);
  });

  it('rejects https://evil.twimg.com.evil.com/ (subdomain attack)', () => {
    const variants = [
      { content_type: 'video/mp4', url: 'https://evil.twimg.com.evil.com/pu/vid/640x360/a.mp4', bitrate: 832000 },
    ];
    const result = T.extractMp4Variants(variants);
    expect(result).toHaveLength(0);
  });

  it('deduplicates variants with same resolution, bitrate, and path', () => {
    const variants = [
      { content_type: 'video/mp4', url: 'https://video.twimg.com/test/pu/vid/640x360/a.mp4?tag=14', bitrate: 832000 },
      { content_type: 'video/mp4', url: 'https://video.twimg.com/test/pu/vid/640x360/a.mp4?tag=15', bitrate: 832000 },
    ];
    const result = T.extractMp4Variants(variants);
    expect(result).toHaveLength(1);
  });

  it('extracts resolution from URL path', () => {
    const variants = [
      { content_type: 'video/mp4', url: 'https://video.twimg.com/test/pu/vid/1280x720/a.mp4', bitrate: 2176000 },
    ];
    const result = T.extractMp4Variants(variants);
    expect(result[0].resolution).toBe('1280x720');
  });

  it('handles empty variants array', () => {
    expect(T.extractMp4Variants([])).toEqual([]);
  });

  it('handles non-array input gracefully', () => {
    expect(T.extractMp4Variants(null)).toEqual([]);
    expect(T.extractMp4Variants(undefined)).toEqual([]);
  });

  it('skips variants with missing or non-string url', () => {
    const variants = [
      { content_type: 'video/mp4', url: null, bitrate: 832000 },
      { content_type: 'video/mp4', bitrate: 832000 },
    ];
    const result = T.extractMp4Variants(variants);
    expect(result).toHaveLength(0);
  });

  it('skips variants with invalid URLs', () => {
    const variants = [
      { content_type: 'video/mp4', url: 'not-a-url', bitrate: 832000 },
    ];
    const result = T.extractMp4Variants(variants);
    expect(result).toHaveLength(0);
  });
});

// ─── chooseVariant ───────────────────────────────────────────────────────

describe('chooseVariant', () => {
  const variants = [
    { url: 'https://video.twimg.com/a/high.mp4', bitrate: 2176000, resolution: '1280x720', label: '1280x720 • 2176 kbps' },
    { url: 'https://video.twimg.com/a/med.mp4', bitrate: 832000, resolution: '640x360', label: '640x360 • 832 kbps' },
    { url: 'https://video.twimg.com/a/low.mp4', bitrate: 256000, resolution: '320x180', label: '320x180 • 256 kbps' },
  ];

  it('selects best quality (first variant) by default', () => {
    const result = T.chooseVariant(variants, null, 'best');
    expect(result.bitrate).toBe(2176000);
  });

  it('selects medium quality (middle variant)', () => {
    const result = T.chooseVariant(variants, null, 'medium');
    expect(result.bitrate).toBe(832000);
  });

  it('selects small quality (last variant)', () => {
    const result = T.chooseVariant(variants, null, 'small');
    expect(result.bitrate).toBe(256000);
  });

  it('selects by exact variant URL', () => {
    const result = T.chooseVariant(variants, 'https://video.twimg.com/a/med.mp4', 'best');
    expect(result.bitrate).toBe(832000);
  });

  it('returns null when variant URL not found', () => {
    const result = T.chooseVariant(variants, 'https://video.twimg.com/nonexistent.mp4', 'best');
    expect(result).toBeNull();
  });

  it('returns null for empty variants array', () => {
    expect(T.chooseVariant([], null, 'best')).toBeNull();
  });

  it('returns null for non-array variants', () => {
    expect(T.chooseVariant(null, null, 'best')).toBeNull();
  });

  it('falls back to best for unrecognized quality', () => {
    const result = T.chooseVariant(variants, null, 'ultra');
    expect(result.bitrate).toBe(2176000);
  });
});

// ─── pickMediaItem ───────────────────────────────────────────────────────

describe('pickMediaItem', () => {
  const items = [
    { index: 0, mediaType: 'video' },
    { index: 1, mediaType: 'animated_gif' },
  ];

  it('picks the item matching the given index', () => {
    expect(T.pickMediaItem(items, 1).mediaType).toBe('animated_gif');
  });

  it('falls back to first item if index not found', () => {
    expect(T.pickMediaItem(items, 99).index).toBe(0);
  });

  it('falls back to first item if no index specified', () => {
    expect(T.pickMediaItem(items, undefined).index).toBe(0);
  });

  it('returns null for empty array', () => {
    expect(T.pickMediaItem([], 0)).toBeNull();
  });

  it('returns null for non-array input', () => {
    expect(T.pickMediaItem(null, 0)).toBeNull();
  });
});

// ─── resolveQualityPref ──────────────────────────────────────────────────

describe('resolveQualityPref', () => {
  it('returns the value if it is a valid quality', () => {
    expect(T.resolveQualityPref('best')).toBe('best');
    expect(T.resolveQualityPref('medium')).toBe('medium');
    expect(T.resolveQualityPref('small')).toBe('small');
  });

  it('returns fallback for invalid quality', () => {
    expect(T.resolveQualityPref('ultra', 'medium')).toBe('medium');
  });

  it('returns default fallback when no custom fallback', () => {
    expect(T.resolveQualityPref(null)).toBe('best');
    expect(T.resolveQualityPref(undefined)).toBe('best');
  });
});

// ─── sanitizeFilePart ────────────────────────────────────────────────────

describe('sanitizeFilePart', () => {
  it('strips control characters', () => {
    expect(T.sanitizeFilePart('hello\x00world\x1F')).toBe('hello world');
  });

  it('replaces path traversal characters with space then collapses', () => {
    expect(T.sanitizeFilePart('file<>:/\\|?*name')).toBe('file name');
  });

  it('blocks path traversal by stripping slashes', () => {
    const result = T.sanitizeFilePart('../etc/passwd');
    expect(result).not.toContain('/');
    // Note: '..' literal text survives — no path separators means no
    // directory traversal. Chrome.downloads and the OS enforce path safety.
  });

  it('caps length at 48 characters', () => {
    const long = 'a'.repeat(100);
    expect(T.sanitizeFilePart(long).length).toBeLessThanOrEqual(48);
  });

  it('preserves extensions (dots within name)', () => {
    expect(T.sanitizeFilePart('video.mp4')).toBe('video.mp4');
  });

  it('strips leading @ _ - characters', () => {
    expect(T.sanitizeFilePart('@__-hello')).toBe('hello');
  });

  it('strips trailing dots and spaces', () => {
    expect(T.sanitizeFilePart('hello.  ')).toBe('hello');
  });

  it('normalizes unicode via NFKD and strips diacritics', () => {
    expect(T.sanitizeFilePart('café')).toBe('cafe');
  });

  it('renames Windows reserved names (con, prn, aux, nul, com1-9, lpt1-9)', () => {
    expect(T.sanitizeFilePart('con')).toBe('file_con');
    expect(T.sanitizeFilePart('prn')).toBe('file_prn');
    expect(T.sanitizeFilePart('aux')).toBe('file_aux');
    expect(T.sanitizeFilePart('nul')).toBe('file_nul');
    expect(T.sanitizeFilePart('com1')).toBe('file_com1');
    expect(T.sanitizeFilePart('lpt9')).toBe('file_lpt9');
  });

  it('replaces non-ASCII-alphanumeric chars with underscore', () => {
    expect(T.sanitizeFilePart('hello#world')).toBe('hello_world');
  });

  it('collapses multiple underscores', () => {
    expect(T.sanitizeFilePart('a___b')).toBe('a_b');
  });

  it('returns empty string for empty input', () => {
    expect(T.sanitizeFilePart('')).toBe('');
  });

  it('returns empty string for non-string falsy input', () => {
    expect(T.sanitizeFilePart(null)).toBe('');
    expect(T.sanitizeFilePart(undefined)).toBe('');
  });
});

// ─── sanitizeFilePart hostile-input regression ───────────────────────────

describe('sanitizeFilePart hostile-input regression', () => {
  it('blocks deep path traversal payloads', () => {
    const result = T.sanitizeFilePart('../../../etc/passwd');
    expect(result).not.toContain('/');
    expect(result).not.toContain('\\');
  });

  it.each(['CON', 'PRN', 'NUL', 'COM1', 'LPT1'])(
    'renames uppercase Windows reserved name: %s',
    (name) => {
      expect(T.sanitizeFilePart(name)).toMatch(/^file_/i);
    }
  );

  it('caps very large filename parts well below filesystem limits', () => {
    const long = 'a'.repeat(4096);
    expect(T.sanitizeFilePart(long).length).toBeLessThanOrEqual(48);
  });
});

// ─── buildFilename ───────────────────────────────────────────────────────

describe('buildFilename', () => {
  const baseMetadata = {
    tweetId: '1234567890',
    fileUser: 'testuser',
    screenName: 'testuser',
    displayName: 'Test User',
    text: 'Short tweet',
    mediaItems: [{ index: 0, mediaType: 'video' }],
  };

  it('includes @username in filename', () => {
    const result = T.buildFilename(baseMetadata, baseMetadata.mediaItems[0], {
      bitrate: 832000, resolution: '640x360', label: '640x360 • 832 kbps', url: 'https://video.twimg.com/test.mp4',
    });
    expect(result).toContain('@testuser');
  });

  it('includes tweet ID', () => {
    const result = T.buildFilename(baseMetadata, baseMetadata.mediaItems[0], {
      bitrate: 832000, resolution: '640x360', label: '640x360 • 832 kbps', url: 'https://video.twimg.com/test.mp4',
    });
    expect(result).toContain('1234567890');
  });

  it('ends with .mp4 extension', () => {
    const result = T.buildFilename(baseMetadata, baseMetadata.mediaItems[0], {
      bitrate: 832000, resolution: '640x360', label: '640x360 • 832 kbps', url: 'https://video.twimg.com/test.mp4',
    });
    expect(result.endsWith('.mp4')).toBe(true);
  });

  it('includes media index (m1, m2) for multi-media posts', () => {
    const multiMetadata = {
      ...baseMetadata,
      mediaItems: [
        { index: 0, mediaType: 'video' },
        { index: 1, mediaType: 'video' },
      ],
    };
    const result = T.buildFilename(multiMetadata, multiMetadata.mediaItems[1], {
      bitrate: 832000, resolution: '640x360', label: '640x360 • 832 kbps', url: 'https://video.twimg.com/test.mp4',
    });
    expect(result).toContain('m2');
  });

  it('does NOT include media index for single-media posts', () => {
    const result = T.buildFilename(baseMetadata, baseMetadata.mediaItems[0], {
      bitrate: 832000, resolution: '640x360', label: '640x360 • 832 kbps', url: 'https://video.twimg.com/test.mp4',
    });
    expect(result).not.toContain('m1');
  });

  it('includes "gif" for animated_gif media type', () => {
    const gifMetadata = {
      ...baseMetadata,
      mediaItems: [{ index: 0, mediaType: 'animated_gif' }],
    };
    const result = T.buildFilename(gifMetadata, gifMetadata.mediaItems[0], {
      bitrate: 0, resolution: '480x480', label: '480x480 • MP4', url: 'https://video.twimg.com/test.mp4',
    });
    expect(result).toContain('gif');
  });

  it('includes bitrate in kbps format', () => {
    const result = T.buildFilename(baseMetadata, baseMetadata.mediaItems[0], {
      bitrate: 832000, resolution: '640x360', label: '640x360 • 832 kbps', url: 'https://video.twimg.com/test.mp4',
    });
    expect(result).toContain('832kbps');
  });

  it('uses "mp4" label when bitrate is 0', () => {
    const result = T.buildFilename(baseMetadata, baseMetadata.mediaItems[0], {
      bitrate: 0, resolution: '480x480', label: '480x480 • MP4', url: 'https://video.twimg.com/test.mp4',
    });
    expect(result).toContain('mp4');
  });

  it('crops filename to 180 chars before adding .mp4', () => {
    const longMetadata = {
      ...baseMetadata,
      text: 'A'.repeat(200),
    };
    const result = T.buildFilename(longMetadata, longMetadata.mediaItems[0], {
      bitrate: 832000, resolution: '640x360', label: 'test', url: 'https://video.twimg.com/test.mp4',
    });
    const base = result.replace(/\.mp4$/, '');
    expect(base.length).toBeLessThanOrEqual(180);
  });

  it('uses fallback name when all parts are empty', () => {
    const emptyMetadata = {
      tweetId: '1234567890',
      fileUser: '',
      screenName: '',
      displayName: '',
      text: '',
      mediaItems: [{ index: 0, mediaType: 'video' }],
    };
    const result = T.buildFilename(emptyMetadata, emptyMetadata.mediaItems[0], {
      bitrate: 0, resolution: '', label: 'MP4', url: 'https://video.twimg.com/test.mp4',
    });
    expect(result).toContain('1234567890');
    expect(result.endsWith('.mp4')).toBe(true);
  });

  it('sanitizes control chars in text snippet', () => {
    const dirtyMetadata = {
      ...baseMetadata,
      text: 'hello\x00world<script>',
    };
    const result = T.buildFilename(dirtyMetadata, dirtyMetadata.mediaItems[0], {
      bitrate: 832000, resolution: '640x360', label: 'test', url: 'https://video.twimg.com/test.mp4',
    });
    expect(result).not.toContain('<');
    expect(result).not.toContain('\x00');
  });

  it('never produces path-traversal segments (deep traversal security)', () => {
    // sanitizeFilePart strips slashes, and buildFilename joins with underscores.
    // Even if '..' text survives sanitizeFilePart (no slashes = no traversal),
    // the composed filename uses '_' separators, never '/'.
    const traversalMetadata = {
      ...baseMetadata,
      fileUser: '../../../etc',
      text: '../../../etc/passwd',
    };
    const result = T.buildFilename(traversalMetadata, traversalMetadata.mediaItems[0], {
      bitrate: 832000, resolution: '640x360', label: 'test', url: 'https://video.twimg.com/test.mp4',
    });
    // No path separators can appear in the composed filename
    expect(result).not.toContain('/');
    expect(result).not.toContain('\\');
    // '..' text may survive but without separators it's harmless text, not traversal
  });
});

// ─── sanitizeText ────────────────────────────────────────────────────────

describe('sanitizeText', () => {
  it('collapses whitespace', () => {
    expect(T.sanitizeText('  hello   world  ')).toBe('hello world');
  });

  it('handles empty/null/undefined input', () => {
    expect(T.sanitizeText('')).toBe('');
    expect(T.sanitizeText(null)).toBe('');
    expect(T.sanitizeText(undefined)).toBe('');
  });
});

// ─── formatVariantLabel ──────────────────────────────────────────────────

describe('formatVariantLabel', () => {
  it('shows resolution and bitrate', () => {
    expect(T.formatVariantLabel({ bitrate: 832000, resolution: '640x360' })).toBe('640x360 • 832 kbps');
  });

  it('shows resolution only when bitrate is 0', () => {
    expect(T.formatVariantLabel({ bitrate: 0, resolution: '480x480' })).toBe('480x480');
  });

  it('shows bitrate only when no resolution', () => {
    expect(T.formatVariantLabel({ bitrate: 256000, resolution: '' })).toBe('256 kbps');
  });

  it('shows "MP4" when both bitrate and resolution are absent', () => {
    expect(T.formatVariantLabel({ bitrate: 0, resolution: '' })).toBe('MP4');
  });
});

// ─── formatDurationLabel ─────────────────────────────────────────────────

describe('formatDurationLabel', () => {
  it('formats 30000ms as 0:30', () => {
    expect(T.formatDurationLabel(30000)).toBe('0:30');
  });

  it('formats 15000ms as 0:15', () => {
    expect(T.formatDurationLabel(15000)).toBe('0:15');
  });

  it('formats 63200ms as 1:03', () => {
    expect(T.formatDurationLabel(63200)).toBe('1:03');
  });

  it('formats 379266ms (rounded) as 6:19', () => {
    expect(T.formatDurationLabel(379266)).toBe('6:19');
  });

  it('formats 0ms as empty string', () => {
    expect(T.formatDurationLabel(0)).toBe('');
  });

  it('formats negative as empty string', () => {
    expect(T.formatDurationLabel(-5000)).toBe('');
  });

  it('handles non-number input as empty string', () => {
    expect(T.formatDurationLabel(null)).toBe('');
    expect(T.formatDurationLabel(undefined)).toBe('');
    expect(T.formatDurationLabel('30000')).toBe('');
  });

  it('pads seconds with leading zero when < 10', () => {
    expect(T.formatDurationLabel(5000)).toBe('0:05');
    expect(T.formatDurationLabel(9000)).toBe('0:09');
  });

  it('formats exact minutes', () => {
    expect(T.formatDurationLabel(60000)).toBe('1:00');
    expect(T.formatDurationLabel(120000)).toBe('2:00');
  });

  it('rounds milliseconds to nearest second', () => {
    expect(T.formatDurationLabel(15499)).toBe('0:15');
    expect(T.formatDurationLabel(15500)).toBe('0:16');
  });
});

// ─── formatMediaItemLabel ────────────────────────────────────────────────

describe('formatMediaItemLabel', () => {
  it('shows "Video" for video type with single media', () => {
    const item = { mediaType: 'video', variants: [{}, {}] };
    expect(T.formatMediaItemLabel(item, 1)).toBe('Video • 2 variants');
  });

  it('shows "Animated GIF" for animated_gif type', () => {
    const item = { mediaType: 'animated_gif', variants: [{}] };
    expect(T.formatMediaItemLabel(item, 1)).toBe('Animated GIF • 1 variant');
  });

  it('shows "Media N" prefix for multi-media posts', () => {
    const item = { index: 0, mediaType: 'video', variants: [{}, {}] };
    expect(T.formatMediaItemLabel(item, 2)).toBe('Media 1 • Video • 2 variants');
  });

  it('uses singular "variant" when only 1', () => {
    const item = { mediaType: 'video', variants: [{}] };
    expect(T.formatMediaItemLabel(item, 1)).toBe('Video • 1 variant');
  });
});

// ─── resolutionArea ──────────────────────────────────────────────────────

describe('resolutionArea', () => {
  it('calculates area from WxH resolution', () => {
    expect(T.resolutionArea('1280x720')).toBe(921600);
    expect(T.resolutionArea('640x360')).toBe(230400);
  });

  it('returns 0 for invalid resolution strings', () => {
    expect(T.resolutionArea('')).toBe(0);
    expect(T.resolutionArea('invalid')).toBe(0);
    expect(T.resolutionArea('1920x')).toBe(0);
  });
});

// ─── getErrorMessage ─────────────────────────────────────────────────────

describe('getErrorMessage', () => {
  it('extracts message from Error objects', () => {
    expect(T.getErrorMessage(new Error('test error'))).toBe('test error');
  });

  it('returns string directly', () => {
    expect(T.getErrorMessage('string error')).toBe('string error');
  });

  it('returns "Unknown error" for other types', () => {
    expect(T.getErrorMessage(null)).toBe('Unknown error');
    expect(T.getErrorMessage(undefined)).toBe('Unknown error');
    expect(T.getErrorMessage(42)).toBe('Unknown error');
  });

  it('returns "Unknown error" for empty string', () => {
    expect(T.getErrorMessage('')).toBe('Unknown error');
  });
});

// ─── Cache via safe API ──────────────────────────────────────────────────

describe('Cache TTL (via safe API)', () => {
  it('reports empty caches after clearCaches()', () => {
    expect(T.cacheSizes()).toEqual({ metadataCache: 0, inflightDownloads: 0 });
  });

  it('cacheSizes reflects metadata lookups', async () => {
    // Trigger a metadata fetch that will be cached
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mediaDetails: [{
          type: 'video',
          video_info: {
            variants: [{
              content_type: 'video/mp4',
              url: 'https://video.twimg.com/test/pu/vid/640x360/a.mp4',
              bitrate: 832000,
            }],
          },
        }],
        user: { screen_name: 'test' },
        text: 'test',
      }),
      body: { cancel: vi.fn() },
    });

    // Exercise the message dispatch path to populate the cache
    const chrome = globalThis.chrome;
    await chrome.runtime.sendMessage({ action: 'probe', input: '9999911111' });

    // Cache should now have an entry
    expect(T.cacheSizes().metadataCache).toBeGreaterThanOrEqual(1);

    // Clear and verify
    T.clearCaches();
    expect(T.cacheSizes()).toEqual({ metadataCache: 0, inflightDownloads: 0 });
  });

  it('CACHE_TTL_MS is 90 seconds', () => {
    expect(T.CACHE_TTL_MS).toBe(90_000);
  });
});

// ─── Metadata extraction: thumbnailUrl and durationMillis ───────────────

describe('Metadata extraction: thumbnailUrl and durationMillis', () => {
  it('extracts thumbnailUrl from media_url_https when valid HTTPS', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mediaDetails: [{
          type: 'video',
          media_url_https: 'https://pbs.twimg.com/media/thumb.jpg',
          video_info: {
            duration_millis: 30000,
            variants: [{
              content_type: 'video/mp4',
              url: 'https://video.twimg.com/test/pu/vid/640x360/a.mp4',
              bitrate: 832000,
            }],
          },
        }],
        user: { screen_name: 'test' },
        text: 'test',
      }),
      body: { cancel: vi.fn() },
    });

    const chrome = globalThis.chrome;
    const result = await chrome.runtime.sendMessage({ action: 'probe', input: '5555511111' });
    expect(result.ok).toBe(true);
    expect(result.mediaItems[0].thumbnailUrl).toBe('https://pbs.twimg.com/media/thumb.jpg');
    expect(result.mediaItems[0].durationMillis).toBe(30000);
    expect(result.mediaItems[0].durationLabel).toBe('0:30');
  });

  it('omits thumbnailUrl when media_url_https is http (non-HTTPS)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mediaDetails: [{
          type: 'video',
          media_url_https: 'http://pbs.twimg.com/media/thumb.jpg',
          video_info: {
            duration_millis: 15000,
            variants: [{
              content_type: 'video/mp4',
              url: 'https://video.twimg.com/test/pu/vid/640x360/a.mp4',
              bitrate: 832000,
            }],
          },
        }],
        user: { screen_name: 'test' },
        text: 'test',
      }),
      body: { cancel: vi.fn() },
    });

    const chrome = globalThis.chrome;
    const result = await chrome.runtime.sendMessage({ action: 'probe', input: '5555522222' });
    expect(result.ok).toBe(true);
    expect(result.mediaItems[0].thumbnailUrl).toBe('');
    expect(result.mediaItems[0].durationMillis).toBe(15000);
    expect(result.mediaItems[0].durationLabel).toBe('0:15');
  });

  it('omits thumbnailUrl when media_url_https is missing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mediaDetails: [{
          type: 'video',
          video_info: {
            duration_millis: 22000,
            variants: [{
              content_type: 'video/mp4',
              url: 'https://video.twimg.com/test/pu/vid/640x360/a.mp4',
              bitrate: 832000,
            }],
          },
        }],
        user: { screen_name: 'test' },
        text: 'test',
      }),
      body: { cancel: vi.fn() },
    });

    const chrome = globalThis.chrome;
    const result = await chrome.runtime.sendMessage({ action: 'probe', input: '5555533333' });
    expect(result.ok).toBe(true);
    expect(result.mediaItems[0].thumbnailUrl).toBe('');
    expect(result.mediaItems[0].durationMillis).toBe(22000);
    expect(result.mediaItems[0].durationLabel).toBe('0:22');
  });

  it('sets durationMillis to 0 and durationLabel to empty when duration_millis is missing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mediaDetails: [{
          type: 'video',
          media_url_https: 'https://pbs.twimg.com/media/thumb.jpg',
          video_info: {
            variants: [{
              content_type: 'video/mp4',
              url: 'https://video.twimg.com/test/pu/vid/640x360/a.mp4',
              bitrate: 832000,
            }],
          },
        }],
        user: { screen_name: 'test' },
        text: 'test',
      }),
      body: { cancel: vi.fn() },
    });

    const chrome = globalThis.chrome;
    const result = await chrome.runtime.sendMessage({ action: 'probe', input: '5555544444' });
    expect(result.ok).toBe(true);
    expect(result.mediaItems[0].thumbnailUrl).toBe('https://pbs.twimg.com/media/thumb.jpg');
    expect(result.mediaItems[0].durationMillis).toBe(0);
    expect(result.mediaItems[0].durationLabel).toBe('');
  });

  it('sets durationMillis to 0 when duration_millis is negative', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mediaDetails: [{
          type: 'video',
          video_info: {
            duration_millis: -100,
            variants: [{
              content_type: 'video/mp4',
              url: 'https://video.twimg.com/test/pu/vid/640x360/a.mp4',
              bitrate: 832000,
            }],
          },
        }],
        user: { screen_name: 'test' },
        text: 'test',
      }),
      body: { cancel: vi.fn() },
    });

    const chrome = globalThis.chrome;
    const result = await chrome.runtime.sendMessage({ action: 'probe', input: '5555555555' });
    expect(result.ok).toBe(true);
    expect(result.mediaItems[0].durationMillis).toBe(0);
    expect(result.mediaItems[0].durationLabel).toBe('');
  });

  it('extracts metadata for multi-media posts', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mediaDetails: [
          {
            type: 'video',
            media_url_https: 'https://pbs.twimg.com/media/vid1.jpg',
            video_info: {
              duration_millis: 15000,
              variants: [{
                content_type: 'video/mp4',
                url: 'https://video.twimg.com/test/pu/vid/1280x720/a.mp4',
                bitrate: 2176000,
              }],
            },
          },
          {
            type: 'animated_gif',
            media_url_https: 'https://pbs.twimg.com/media/vid2.jpg',
            video_info: {
              duration_millis: 5000,
              variants: [{
                content_type: 'video/mp4',
                url: 'https://video.twimg.com/tw_vod_gif/test/pu/vid/480x480/b.mp4',
                bitrate: 0,
              }],
            },
          },
        ],
        user: { screen_name: 'test' },
        text: 'multi',
      }),
      body: { cancel: vi.fn() },
    });

    const chrome = globalThis.chrome;
    const result = await chrome.runtime.sendMessage({ action: 'probe', input: '5555566666' });
    expect(result.ok).toBe(true);
    expect(result.mediaItems).toHaveLength(2);
    expect(result.mediaItems[0].thumbnailUrl).toBe('https://pbs.twimg.com/media/vid1.jpg');
    expect(result.mediaItems[0].durationMillis).toBe(15000);
    expect(result.mediaItems[0].durationLabel).toBe('0:15');
    expect(result.mediaItems[1].thumbnailUrl).toBe('https://pbs.twimg.com/media/vid2.jpg');
    expect(result.mediaItems[1].durationMillis).toBe(5000);
    expect(result.mediaItems[1].durationLabel).toBe('0:05');
  });

  it('handles snake_case media_details with thumbnailUrl and duration', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        media_details: [{
          type: 'video',
          media_url_https: 'https://pbs.twimg.com/media/snake.jpg',
          video_info: {
            duration_millis: 20000,
            variants: [{
              content_type: 'video/mp4',
              url: 'https://video.twimg.com/test/pu/vid/640x360/a.mp4',
              bitrate: 832000,
            }],
          },
        }],
        user: { screen_name: 'test' },
        text: 'snake',
      }),
      body: { cancel: vi.fn() },
    });

    const chrome = globalThis.chrome;
    const result = await chrome.runtime.sendMessage({ action: 'probe', input: '5555577777' });
    expect(result.ok).toBe(true);
    expect(result.mediaItems[0].thumbnailUrl).toBe('https://pbs.twimg.com/media/snake.jpg');
    expect(result.mediaItems[0].durationMillis).toBe(20000);
    expect(result.mediaItems[0].durationLabel).toBe('0:20');
  });
});
