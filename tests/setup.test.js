/**
 * Regression tests for the MV3 onMessage dispatcher in tests/setup.js.
 *
 * These validate that the shared dispatcher faithfully models Chrome's MV3
 * async-reply contract — all listeners always run, returning true keeps the
 * channel open but doesn't stop dispatch, and unreplied keepalives fail fast.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installChromeMock } from './setup.js';

let chrome;

beforeEach(() => {
  chrome = installChromeMock();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MV3 onMessage dispatcher', () => {
  it('listener A returns true (keepalive), listener B sync-replies → B wins', async () => {
    let aRan = false;
    let bRan = false;

    chrome.runtime.onMessage.addListener((msg, sender, reply) => {
      aRan = true;
      // Returns true (keepalive) but never calls reply
      return true;
    });

    chrome.runtime.onMessage.addListener((msg, sender, reply) => {
      bRan = true;
      reply({ from: 'B' });
      return false;
    });

    const result = await chrome.runtime.sendMessage({ action: 'test' });

    // Both listeners must have been invoked
    expect(aRan).toBe(true);
    expect(bRan).toBe(true);

    // B's synchronous reply wins
    expect(result).toEqual({ from: 'B' });
  });

  it('listener A returns false, listener B returns true and async-replies → resolves', async () => {
    let aRan = false;
    let bRan = false;

    chrome.runtime.onMessage.addListener((msg, sender, reply) => {
      aRan = true;
      return false;
    });

    chrome.runtime.onMessage.addListener((msg, sender, reply) => {
      bRan = true;
      // Async reply
      setTimeout(() => reply({ from: 'B-async' }), 10);
      return true;
    });

    const result = await chrome.runtime.sendMessage({ action: 'test' });

    expect(aRan).toBe(true);
    expect(bRan).toBe(true);
    expect(result).toEqual({ from: 'B-async' });
  });

  it('listener A throws, listener B replies → no deadlock; B wins', async () => {
    let aRan = false;
    let bRan = false;

    chrome.runtime.onMessage.addListener((msg, sender, reply) => {
      aRan = true;
      throw new Error('A exploded');
    });

    chrome.runtime.onMessage.addListener((msg, sender, reply) => {
      bRan = true;
      reply({ from: 'B-despite-A-error' });
      return false;
    });

    const result = await chrome.runtime.sendMessage({ action: 'test' });

    expect(aRan).toBe(true);
    expect(bRan).toBe(true);
    // B's reply takes priority over A's error
    expect(result).toEqual({ from: 'B-despite-A-error' });
  });

  it('listener returns true and never replies → rejects within ~1500ms', async () => {
    chrome.runtime.onMessage.addListener((msg, sender, reply) => {
      // Returns true (keepalive) but NEVER calls reply()
      return true;
    });

    const start = Date.now();
    await expect(
      chrome.runtime.sendMessage({ action: 'test' })
    ).rejects.toThrow('never replied');

    const elapsed = Date.now() - start;
    // Dispatcher uses 1000ms timeout; should reject well under 1500ms
    expect(elapsed).toBeLessThan(1500);
  });

  it('no listeners → rejects immediately', async () => {
    await expect(
      chrome.runtime.sendMessage({ action: 'test' })
    ).rejects.toThrow('No message listeners registered');
  });

  it('single listener returns false (no keepalive) → resolves undefined', async () => {
    let ran = false;
    chrome.runtime.onMessage.addListener((msg, sender, reply) => {
      ran = true;
      return false;
    });

    const result = await chrome.runtime.sendMessage({ action: 'test' });
    expect(ran).toBe(true);
    expect(result).toBeUndefined();
  });

  it('__triggerMessage uses the same dispatcher', async () => {
    let ran = false;
    chrome.runtime.onMessage.addListener((msg, sender, reply) => {
      ran = true;
      reply({ triggered: true });
      return false;
    });

    const result = await chrome.__test.__triggerMessage({ action: 'test' });
    expect(ran).toBe(true);
    expect(result).toEqual({ triggered: true });
  });
});
