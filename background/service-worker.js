import { fetchTweetVideoData } from "../lib/api.js";
import { isAllowedVideoUrl } from "../lib/video-extractor.js";
import { sanitizeFilenameComponent, pickVariantByQuality } from "../lib/utils.js";
import { createMutex } from "../lib/mutex.js";
import {
  SETTINGS_KEY, HISTORY_KEY, PENDING_KEY, DEFAULT_SETTINGS, AUTH_API_WARNING,
} from "../lib/constants.js";

const MAX_HISTORY = 10;
const VARIANT_CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 50;

async function getSettings() {
  try {
    const data = await chrome.storage.sync.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...data[SETTINGS_KEY] };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Map preserves insertion order per spec; LRU eviction relies on keys().next()
// returning the oldest entry, and cache hits delete+re-set to move to the end.
const variantCache = new Map();

const withPendingLock = createMutex();
const withHistoryLock = createMutex();

// --- Pending downloads (persisted + mutex-protected) ---

function savePendingDownload(downloadId, entry) {
  return withPendingLock(async () => {
    const data = await chrome.storage.session.get(PENDING_KEY);
    const pending = data[PENDING_KEY] || {};
    pending[String(downloadId)] = entry;
    await chrome.storage.session.set({ [PENDING_KEY]: pending });
  });
}

function getAndRemovePendingDownload(downloadId) {
  return withPendingLock(async () => {
    const data = await chrome.storage.session.get(PENDING_KEY);
    const pending = data[PENDING_KEY] || {};
    const key = String(downloadId);
    const entry = pending[key] || null;
    if (entry) {
      delete pending[key];
      await chrome.storage.session.set({ [PENDING_KEY]: pending });
    }
    return entry;
  });
}

// --- Event listeners ---

chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    if (details.reason === "update") {
      await chrome.storage.local.remove("xvd_queryId");
    }
    const data = await chrome.storage.local.get("xvd_schema_version");
    if (!data.xvd_schema_version) {
      await chrome.storage.local.set({ xvd_schema_version: 1 });
    }
  } catch (e) {
    console.warn("[XVD] onInstalled error:", e.message);
  }
});

chrome.downloads.onChanged.addListener(async (delta) => {
  try {
    if (!delta.state) return;
    if (delta.state.current !== "complete" && delta.state.current !== "interrupted") return;

    const entry = await getAndRemovePendingDownload(delta.id);
    if (!entry) return;

    if (delta.state.current === "complete") {
      if (!entry.disableHistory) await addToHistory(entry);
      broadcastStatus({ action: "downloadComplete", tweetId: entry.tweetId, success: true });
    } else {
      broadcastStatus({ action: "downloadFailed", tweetId: entry.tweetId, error: "Download interrupted" });
    }
  } catch (e) {
    console.warn("[XVD] onChanged handler error:", e.message);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  if (message.action === "download") {
    handleDownload(message.tweetId, message.variant, message.videoIndex, message.fallbackTweetIds)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === "getVariants") {
    handleGetVariants(message.tweetId, message.fallbackTweetIds)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === "clearHistory") {
    withHistoryLock(() => chrome.storage.local.set({ [HISTORY_KEY]: [] }))
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// --- Keyboard shortcut ---

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "download-video") return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.match(/https:\/\/(x\.com|twitter\.com)\//)) return;
    chrome.tabs.sendMessage(tab.id, { action: "triggerDownload" }).catch(() => {});
  } catch {
    // Tab may not be on X.com
  }
});

// --- Helpers ---

function cacheVariants(tweetId, data) {
  if (variantCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = variantCache.keys().next().value;
    variantCache.delete(oldestKey);
  }
  variantCache.set(tweetId, { data, timestamp: Date.now() });
}

async function fetchWithFallbacks(tweetId, fallbackTweetIds = [], settings = null) {
  if (!settings) settings = await getSettings();
  const apiOpts = { syndicationOnly: settings.syndicationOnly };

  let data;
  const cached = variantCache.get(tweetId);
  if (cached && Date.now() - cached.timestamp < VARIANT_CACHE_TTL) {
    // Move to end for LRU eviction
    variantCache.delete(tweetId);
    variantCache.set(tweetId, cached);
    data = cached.data;
  } else {
    try {
      data = await fetchTweetVideoData(tweetId, apiOpts);
      if (data?.videos?.length) cacheVariants(tweetId, data);
    } catch (primaryError) {
      // Primary fetch failed — try fallbacks before giving up
      if (fallbackTweetIds.length === 0) throw primaryError;
      data = null;
    }
  }

  if (!data?.videos?.length && fallbackTweetIds.length > 0) {
    for (const fallbackId of fallbackTweetIds) {
      try {
        data = await fetchTweetVideoData(fallbackId, apiOpts);
        if (data?.videos?.length) {
          cacheVariants(fallbackId, data);
          return { data, tweetId: fallbackId };
        }
      } catch {
        // Continue to next fallback
      }
    }
  }

  if (!data?.videos?.length) {
    throw new Error("No video found in tweet");
  }
  return { data, tweetId };
}

// --- Handlers ---

function buildFilename(settings, username, resolvedTweetId, resolution) {
  if (settings.anonymousFilenames) {
    // Slice to "YYYY-MM-DDTHH-MM-SS" (19 chars from ISO string with colons/dots replaced)
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `video_${ts}_${resolution}.mp4`;
  }
  const safeUsername = sanitizeFilenameComponent(username);
  return `@${safeUsername}_${resolvedTweetId}_${resolution}.mp4`;
}

async function handleDownload(tweetId, selectedVariant = null, videoIndex = 0, fallbackTweetIds = []) {
  const settings = await getSettings();
  const result = await fetchWithFallbacks(tweetId, fallbackTweetIds, settings);
  const data = result.data;
  const resolvedTweetId = result.tweetId;

  const safeIndex = Number.isInteger(videoIndex) && videoIndex >= 0 ? videoIndex : 0;
  const video = data.videos[safeIndex] || data.videos[0];
  if (!video?.variants?.length) {
    throw new Error("No video found in tweet");
  }

  let variant;
  if (selectedVariant) {
    variant = video.variants.find(v => v.url === selectedVariant.url) || video.variants[0];
  } else {
    variant = pickVariantByQuality(video.variants, settings.defaultQuality);
  }

  if (!isAllowedVideoUrl(variant.url)) {
    throw new Error("Video URL is from an unexpected domain");
  }

  const resolution = sanitizeFilenameComponent(variant.resolution || "best");
  const filename = buildFilename(settings, data.username, resolvedTweetId, resolution);

  const warnings = [];
  if (data.apiSource === "graphql") {
    warnings.push(AUTH_API_WARNING);
  }

  const downloadId = await chrome.downloads.download({ url: variant.url, filename });
  if (downloadId == null) {
    throw new Error("Download was blocked by the browser");
  }

  await savePendingDownload(downloadId, {
    tweetId: resolvedTweetId,
    username: data.username,
    resolution,
    filename,
    timestamp: Date.now(),
    disableHistory: settings.disableHistory,
  });

  return { success: true, downloadId, filename, warnings };
}

async function handleGetVariants(tweetId, fallbackTweetIds = []) {
  const result = await fetchWithFallbacks(tweetId, fallbackTweetIds);

  return {
    success: true,
    videos: result.data.videos,
    username: result.data.username,
    tweetId: result.data.tweetId,
    apiSource: result.data.apiSource,
  };
}

// --- History ---

async function getHistory() {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  return data[HISTORY_KEY] || [];
}

async function addToHistory(entry) {
  return withHistoryLock(async () => {
    const history = await getHistory();
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    await chrome.storage.local.set({ [HISTORY_KEY]: history });
  });
}

async function broadcastStatus(message) {
  try {
    const tabs = await chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
  } catch (e) {
    console.warn("[XVD] broadcastStatus failed:", e.message);
  }
}
