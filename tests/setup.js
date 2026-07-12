/**
 * Chrome Extension API mock factory for Vitest.
 *
 * Provides MV3-faithful chrome.* mocks with test helpers exposed on
 * chrome.__test for triggering events and inspecting calls.
 */

/**
 * Shared MV3-compatible onMessage dispatcher.
 *
 * Models the Chrome MV3 message-passing contract:
 * - All registered listeners are always invoked.
 * - A listener returning `true` signals an async reply; the dispatcher keeps
 *   the channel open and waits for `reply()`.
 * - If no listener returns `true`, the dispatcher resolves with `undefined`
 *   (or the first synchronous `reply()`).
 * - A listener that returns `true` but never replies times out after 1s.
 * - A throwing listener rejects the dispatch unless another listener replied.
 */
export function dispatchRuntimeMessage(listeners, msg, sender) {
  return new Promise((resolve, reject) => {
    let replied = false;
    let keptAlive = false;
    let firstError = null;

    const timeout = setTimeout(() => {
      if (!replied) {
        reject(new Error('chrome.runtime.onMessage listener returned true but never replied'));
      }
    }, 1000);

    const reply = (result) => {
      if (replied) return;
      replied = true;
      clearTimeout(timeout);
      resolve(result);
    };

    for (const listener of [...listeners]) {
      try {
        if (listener(msg, sender, reply) === true) keptAlive = true;
      } catch (err) {
        firstError ??= err;
      }
    }

    if (replied || keptAlive) return;

    clearTimeout(timeout);
    if (firstError) reject(firstError);
    else resolve(undefined);
  });
}

/** Create a fresh chrome.* mock suite. */
export function createChromeMock() {
  const __lastError = { message: null };

  const __messageListeners = [];
  const onMessage = {
    addListener(fn) {
      __messageListeners.push(fn);
    },
  };

  // Supports both the promise form (no callback) and the callback form used
  // by content scripts; the callback form sets lastError on failure.
  const sendMessage = (msg, callback) => {
    const promise = __messageListeners.length
      ? dispatchRuntimeMessage(__messageListeners, msg, { tab: { id: 1 } })
      : Promise.reject(new Error('No message listeners registered'));

    if (typeof callback !== 'function') return promise;

    promise.then(
      (result) => {
        __lastError.message = null;
        callback(result);
      },
      (err) => {
        __lastError.message = err?.message || String(err);
        callback(undefined);
      }
    );
    return undefined;
  };

  const __downloads = [];
  let __nextDownloadId = 1;
  const downloads = {
    async download(options) {
      const id = __nextDownloadId++;
      __downloads.push({ id, ...options });
      return id;
    },
  };

  const __actionClickListeners = [];
  const __badgeCalls = [];
  const action = {
    onClicked: {
      addListener(fn) {
        __actionClickListeners.push(fn);
      },
    },
    async setBadgeText(details) {
      __badgeCalls.push(details.text);
    },
    async setBadgeBackgroundColor() {},
  };

  const runtime = { onMessage, sendMessage };
  // Chrome exposes lastError only while an error is pending; otherwise it is
  // undefined (an always-present object would defeat `!chrome.runtime.lastError`).
  Object.defineProperty(runtime, 'lastError', {
    get() {
      return __lastError.message ? { message: __lastError.message } : undefined;
    },
    configurable: true,
  });

  const chrome = { runtime, downloads, action };

  chrome.__test = {
    __triggerMessage(msg, sender = { tab: { id: 1 } }) {
      return dispatchRuntimeMessage(__messageListeners, msg, sender);
    },
    __triggerActionClick(tab) {
      for (const fn of __actionClickListeners) fn(tab);
    },
    __getDownloads() {
      return [...__downloads];
    },
    __getBadgeCalls() {
      return [...__badgeCalls];
    },
    __setLastError(message) {
      __lastError.message = message;
    },
  };

  return chrome;
}

/** Install a fresh chrome mock as a global and return it. Call in beforeEach. */
export function installChromeMock() {
  const chrome = createChromeMock();
  globalThis.chrome = chrome;
  return chrome;
}
