import { describe, it, expect } from 'vitest';
import { sanitizeFilenameComponent, pickVariantByQuality } from '../lib/utils.js';
import { isAllowedVideoUrl } from '../lib/video-extractor.js';

describe('sanitizeFilenameComponent', () => {
  it('keeps alphanumeric, hyphens, and underscores', () => {
    expect(sanitizeFilenameComponent('hello-world_123')).toBe('hello-world_123');
  });

  it('replaces special characters with underscore', () => {
    expect(sanitizeFilenameComponent('user@name!')).toBe('user_name_');
  });

  it('replaces all-special-char input with underscores', () => {
    expect(sanitizeFilenameComponent('!!!')).toBe('___');
  });

  it('returns "unknown" for empty string', () => {
    expect(sanitizeFilenameComponent('')).toBe('unknown');
  });
});

describe('isAllowedVideoUrl', () => {
  it('allows video.twimg.com', () => {
    expect(isAllowedVideoUrl('https://video.twimg.com/ext_tw_video/123/pu/vid/720x1280/abc.mp4')).toBe(true);
  });

  it('rejects non-https', () => {
    expect(isAllowedVideoUrl('http://video.twimg.com/abc.mp4')).toBe(false);
  });

  it('rejects unknown domains', () => {
    expect(isAllowedVideoUrl('https://evil.com/video.mp4')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isAllowedVideoUrl('not a url')).toBe(false);
  });

  it('allows subdomains of video.twimg.com', () => {
    expect(isAllowedVideoUrl('https://cdn.video.twimg.com/abc.mp4')).toBe(true);
  });

  it('rejects twimg.com without video prefix', () => {
    expect(isAllowedVideoUrl('https://pbs.twimg.com/media/abc.jpg')).toBe(false);
  });

  it('rejects video.twimg.com as a path component', () => {
    expect(isAllowedVideoUrl('https://evil.com/video.twimg.com/abc.mp4')).toBe(false);
  });
});

describe('pickVariantByQuality', () => {
  const variants = [
    { resolution: '1920x1080', bitrate: 2000000 },
    { resolution: '1280x720', bitrate: 1000000 },
    { resolution: '640x360', bitrate: 500000 },
  ];

  it('returns highest for "highest"', () => {
    expect(pickVariantByQuality(variants, 'highest')).toBe(variants[0]);
  });

  it('returns highest when quality is undefined', () => {
    expect(pickVariantByQuality(variants, undefined)).toBe(variants[0]);
  });

  it('returns matching quality level', () => {
    expect(pickVariantByQuality(variants, '720')).toBe(variants[1]);
  });

  it('returns next lower when exact match not found', () => {
    expect(pickVariantByQuality(variants, '480')).toBe(variants[2]);
  });

  it('returns highest when target is below all available resolutions', () => {
    expect(pickVariantByQuality(variants, '240')).toBe(variants[0]);
  });

  it('returns undefined for empty variants array', () => {
    expect(pickVariantByQuality([], 'highest')).toBeUndefined();
  });

  it('returns first variant for non-numeric quality string', () => {
    expect(pickVariantByQuality(variants, 'medium')).toBe(variants[0]);
  });

  it('handles variants with missing resolution field', () => {
    const noRes = [{ bitrate: 1000000 }, { resolution: '640x360', bitrate: 500000 }];
    // Target 720 — first variant has no resolution so height is NaN, skip it; second is 360 <= 720
    expect(pickVariantByQuality(noRes, '720')).toBe(noRes[1]);
  });
});
