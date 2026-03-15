/**
 * Sliding-window rate limiter: 300 requests per 15 minutes.
 * Persisted in chrome.storage.session to survive service worker restarts.
 * Uses a promise-based mutex to prevent TOCTOU races between concurrent calls.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 300;
const STORAGE_KEY = "xvd_rate_timestamps";

let lock = Promise.resolve();

export function acquireSlot() {
  const result = lock.then(async () => {
    const cutoff = Date.now() - WINDOW_MS;
    const data = await chrome.storage.session.get(STORAGE_KEY);
    const timestamps = (data[STORAGE_KEY] || []).filter(t => t >= cutoff);

    if (timestamps.length >= MAX_REQUESTS) {
      const retryAfterMs = timestamps[0] + WINDOW_MS - Date.now();
      return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
    }

    timestamps.push(Date.now());
    await chrome.storage.session.set({ [STORAGE_KEY]: timestamps });
    return { allowed: true, retryAfterMs: 0 };
  });
  // Ensure lock chain continues even if one call fails
  lock = result.catch(() => {});
  return result;
}
