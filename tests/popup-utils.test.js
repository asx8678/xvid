import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseTweetId, formatDuration, formatTimeAgo } from '../lib/utils.js';

describe('parseTweetId', () => {
  it('parses bare tweet ID', () => {
    expect(parseTweetId('1234567890')).toBe('1234567890');
  });

  it('parses x.com URL', () => {
    expect(parseTweetId('https://x.com/user/status/1234567890')).toBe('1234567890');
  });

  it('parses twitter.com URL', () => {
    expect(parseTweetId('https://twitter.com/user/status/1234567890')).toBe('1234567890');
  });

  it('handles URL with query params', () => {
    expect(parseTweetId('https://x.com/user/status/1234567890?s=20')).toBe('1234567890');
  });

  it('trims whitespace', () => {
    expect(parseTweetId('  1234567890  ')).toBe('1234567890');
  });

  it('returns null for invalid input', () => {
    expect(parseTweetId('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseTweetId('')).toBeNull();
  });

  it('returns null for whitespace-only input', () => {
    expect(parseTweetId('   ')).toBeNull();
  });

  it('returns null for URLs from other domains', () => {
    expect(parseTweetId('https://example.com/status/1234567890')).toBeNull();
  });

  it('handles usernames with dots and hyphens in URL', () => {
    expect(parseTweetId('https://x.com/user.name-123/status/1234567890')).toBe('1234567890');
  });
});

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(5000)).toBe('5s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(65000)).toBe('1:05');
  });

  it('formats zero', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('pads seconds in minute format', () => {
    expect(formatDuration(121000)).toBe('2:01');
  });

  it('formats exactly 60 seconds as 1:00', () => {
    expect(formatDuration(60000)).toBe('1:00');
  });

  it('rounds sub-second values', () => {
    expect(formatDuration(500)).toBe('1s');
    expect(formatDuration(499)).toBe('0s');
  });
});

describe('formatTimeAgo', () => {
  let now;

  beforeEach(() => {
    now = 1700000000000;
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Just now" for recent timestamps', () => {
    expect(formatTimeAgo(now - 30000)).toBe('Just now');
  });

  it('returns "Just now" at boundary (59 seconds)', () => {
    expect(formatTimeAgo(now - 59999)).toBe('Just now');
  });

  it('returns minutes ago', () => {
    expect(formatTimeAgo(now - 5 * 60000)).toBe('5m ago');
  });

  it('returns "1m ago" at 60 seconds boundary', () => {
    expect(formatTimeAgo(now - 60000)).toBe('1m ago');
  });

  it('returns hours ago', () => {
    expect(formatTimeAgo(now - 3 * 3600000)).toBe('3h ago');
  });

  it('returns days ago', () => {
    expect(formatTimeAgo(now - 2 * 86400000)).toBe('2d ago');
  });
});
