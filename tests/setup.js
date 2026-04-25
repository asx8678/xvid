/**
 * Chrome Extension API mock factory for Vitest + jsdom.
 *
 * Provides faithful MV3 chrome.* mocks with test helpers exposed on the mock
 * objects for triggering events and inspecting calls.
 */

/**
 * Shared MV3-compatible onMessage dispatcher.
 *
 * Faithfully models the Chrome MV3 message-passing contract:
 * - All registered listeners are always invoked (returning true does NOT
 *   stop dispatch to subsequent listeners).
 * - If a listener returns `true`, it signals an async reply; the dispatcher
 *   keeps the channel open and waits for `reply()` to be called.
 * - If no listener returns `true`, the dispatcher resolves with `undefined`
 *   (or the first synchronous `reply()` if a listener called it directly).
 * - If a listener returns `true` but never calls `reply()`, the dispatcher
 *   times out after 1 second rather than hanging indefinitely.
 * - If a listener throws, the error is captured but dispatch continues.
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
        const returnValue = listener(msg, sender, reply);
        if (returnValue === true) keptAlive = true;
      } catch (err) {
        firstError ??= err;
      }
    }

    if (replied) return;
    if (keptAlive) return; // Wait for async reply or timeout

    clearTimeout(timeout);
    if (firstError) reject(firstError);
    else resolve(undefined);
  });
}

/**
 * Create a fresh chrome.* mock suite. Call this in beforeEach or via
 * installChromeMock() to get a clean slate.
 */
export function createChromeMock() {
  const __storage = { ...DEFAULT_SETTINGS };

  // --- chrome.storage.sync ---
  const storageSync = {
    async get(defaults) {
      const merged = { ...defaults, ...__storage };
      return merged;
    },
    async set(obj) {
      Object.assign(__storage, obj);
    },
    async setAccessLevel() {
      // no-op in tests
    },
    __storage,
  };

  // --- chrome.runtime.onMessage ---
  const __messageListeners = [];
  const onMessage = {
    addListener(fn) {
      __messageListeners.push(fn);
    },
    removeListener(fn) {
      const idx = __messageListeners.indexOf(fn);
      if (idx !== -1) __messageListeners.splice(idx, 1);
    },
  };

  // --- chrome.runtime.onInstalled / onStartup ---
  const __onInstalledListeners = [];
  const onInstalled = {
    addListener(fn) {
      __onInstalledListeners.push(fn);
    },
  };

  const __onStartupListeners = [];
  const onStartup = {
    addListener(fn) {
      __onStartupListeners.push(fn);
    },
  };

  // --- chrome.runtime.sendMessage ---
  // Uses the shared dispatcher for faithful MV3 semantics.
  const __lastError = { message: null };
  const runtimeSendMessage = (msg) => {
    if (__messageListeners.length === 0) {
      return Promise.reject(new Error('No message listeners registered'));
    }
    const sender = { tab: { id: 1, url: 'https://x.com/test/status/1234567890' } };
    return dispatchRuntimeMessage(__messageListeners, msg, sender);
  };

  // --- chrome.runtime.getURL ---
  const getURL = (path) => `chrome-extension://xvid-id/${path}`;

  // --- chrome.downloads ---
  const __downloads = [];
  let __nextDownloadId = 1;
  const downloadsApi = {
    async download(options) {
      const id = __nextDownloadId++;
      __downloads.push({ id, ...options });
      return id;
    },
  };

  // --- chrome.tabs ---
  const __mockTabs = [{ id: 1, url: 'https://x.com/testuser/status/1234567890' }];
  const tabsApi = {
    async query(queryInfo) {
      return [...__mockTabs];
    },
    async create(opts) {
      return { id: 99, ...opts };
    },
  };

  // --- chrome.runtime.lastError ---
  const lastError = Object.create(null);
  Object.defineProperty(lastError, 'message', {
    get() { return __lastError.message; },
    set(v) { __lastError.message = v; },
    configurable: true,
  });

  // Assemble the chrome global
  const chrome = {
    storage: { sync: storageSync },
    runtime: {
      onMessage,
      onInstalled,
      onStartup,
      sendMessage: runtimeSendMessage,
      getURL,
      lastError,
    },
    downloads: downloadsApi,
    tabs: tabsApi,
  };

  // Test helpers attached to chrome
  chrome.__test = {
    /** Overwrite storage data */
    __setStorage(obj) {
      Object.assign(__storage, obj);
    },
    /** Clear and reset storage to defaults */
    __resetStorage() {
      for (const key of Object.keys(__storage)) delete __storage[key];
      Object.assign(__storage, { ...DEFAULT_SETTINGS });
    },
    /** Get all registered onMessage listeners */
    __getMessageListeners() {
      return [...__messageListeners];
    },
    /**
     * Manually trigger a message to all listeners, returning the reply.
     * Simulates the MV3 async-reply contract using the shared dispatcher.
     */
    __triggerMessage(msg, sender) {
      const safeSender = sender || { tab: { id: 1, url: 'https://x.com/test/status/1234567890' } };
      return dispatchRuntimeMessage(__messageListeners, msg, safeSender);
    },
    /** Trigger onInstalled listeners */
    __triggerOnInstalled() {
      for (const fn of __onInstalledListeners) fn();
    },
    /** Trigger onStartup listeners */
    __triggerOnStartup() {
      for (const fn of __onStartupListeners) fn();
    },
    /** Get recorded downloads */
    __getDownloads() {
      return [...__downloads];
    },
    /** Clear recorded downloads */
    __clearDownloads() {
      __downloads.length = 0;
      __nextDownloadId = 1;
    },
    /** Set mock tabs */
    __setMockTabs(tabs) {
      __mockTabs.length = 0;
      __mockTabs.push(...tabs);
    },
    /** Set lastError */
    __setLastError(msg) {
      __lastError.message = msg;
    },
    /** Clear lastError */
    __clearLastError() {
      __lastError.message = null;
    },
  };

  return chrome;
}

const DEFAULT_SETTINGS = {
  defaultQuality: 'best',
  promptSaveAs: false,
};

/**
 * Install chrome mock as a global and return it.
 * Call in beforeEach.
 */
export function installChromeMock() {
  const chrome = createChromeMock();
  globalThis.chrome = chrome;
  return chrome;
}

/**
 * Reset the chrome mock's internal state (clear downloads, reset storage, etc.)
 * Useful between tests without recreating the entire mock.
 */
export function resetChromeMock(chrome) {
  if (!chrome || !chrome.__test) return;
  chrome.__test.__resetStorage();
  chrome.__test.__clearDownloads();
  chrome.__test.__clearLastError();
}
