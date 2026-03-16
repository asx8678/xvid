/**
 * Sliding-window rate limiter: 300 requests per 15 minutes.
 * Persisted in chrome.storage.session to survive service worker restarts.
 * Uses a promise-based mutex to prevent TOCTOU races between concurrent calls.
 *
 * In-memory timestamps are authoritative during the service worker's lifetime.
 * Storage is read once on first use and written back periodically or when
 * the window shrinks, avoiding a storage round-trip on every request.
 */

import { createMutex } from "./mutex.js";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 300;
const STORAGE_KEY = "xvd_rate_timestamps";
const PERSIST_INTERVAL_MS = 5000;

const withLock = createMutex();
let timestamps = null; // lazy-loaded from storage
let persistTimer = null;

async function loadTimestamps() {
  if (timestamps !== null) return;
  const data = await chrome.storage.session.get(STORAGE_KEY);
  timestamps = data[STORAGE_KEY] || [];
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    chrome.storage.session.set({ [STORAGE_KEY]: timestamps }).catch(() => {});
  }, PERSIST_INTERVAL_MS);
}

export async function requireSlot() {
  const slot = await acquireSlot();
  if (!slot.allowed) {
    throw new Error(`Rate limited \u2014 retry after ${Math.ceil(slot.retryAfterMs / 1000)}s`);
  }
}

export function acquireSlot() {
  return withLock(async () => {
    await loadTimestamps();

    const cutoff = Date.now() - WINDOW_MS;
    const prevLength = timestamps.length;
    timestamps = timestamps.filter(t => t >= cutoff);

    if (timestamps.length >= MAX_REQUESTS) {
      const retryAfterMs = timestamps[0] + WINDOW_MS - Date.now();
      // Persist if we pruned expired entries
      if (timestamps.length !== prevLength) schedulePersist();
      return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
    }

    timestamps.push(Date.now());
    schedulePersist();
    return { allowed: true, retryAfterMs: 0 };
  });
}
