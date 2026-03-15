import { fetchTweetVideoData } from "../lib/api.js";

const HISTORY_KEY = "xvd_download_history";
const PENDING_KEY = "xvd_pending_downloads";
const MAX_HISTORY = 10;
const VARIANT_CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 50;

const ALLOWED_VIDEO_HOSTS = ["video.twimg.com"];

const DEFAULT_SETTINGS = { defaultQuality: "highest" };

async function getSettings() {
  try {
    const data = await chrome.storage.sync.get("xvd_settings");
    return { ...DEFAULT_SETTINGS, ...data.xvd_settings };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function pickVariantByQuality(variants, quality) {
  if (quality === "highest" || !quality) return variants[0]; // already sorted by bitrate desc
  // Match by resolution height
  const target = parseInt(quality);
  if (!target) return variants[0];
  const match = variants.find(v => {
    const h = parseInt((v.resolution || "").split("x")[1]);
    return h && h <= target;
  });
  return match || variants[variants.length - 1]; // Fallback to lowest if target is below all
}

const variantCache = new Map();
let historyLock = Promise.resolve();
let pendingLock = Promise.resolve();

function sanitizeFilenameComponent(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, "_") || "unknown";
}

function isAllowedVideoUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      ALLOWED_VIDEO_HOSTS.some(d => parsed.hostname === d || parsed.hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

// --- Pending downloads (persisted + mutex-protected to prevent TOCTOU races) ---

function withPendingLock(fn) {
  const result = pendingLock.then(fn);
  pendingLock = result.catch(() => {});
  return result;
}

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
  console.log("[XVD] X Video Downloader installed/updated:", details.reason);

  if (details.reason === "update") {
    // Clear cached queryId to avoid stale GraphQL endpoints
    await chrome.storage.local.remove("xvd_queryId");
  }

  // Set schema version for future migrations
  const data = await chrome.storage.local.get("xvd_schema_version");
  if (!data.xvd_schema_version) {
    await chrome.storage.local.set({ xvd_schema_version: 1 });
  }
});

chrome.downloads.onChanged.addListener(async (delta) => {
  try {
    if (!delta.state) return;
    if (delta.state.current !== "complete" && delta.state.current !== "interrupted") return;

    const entry = await getAndRemovePendingDownload(delta.id);
    if (!entry) return;

    if (delta.state.current === "complete") {
      await addToHistory(entry);
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
});

// --- Handlers ---

async function handleDownload(tweetId, selectedVariant, videoIndex = 0, fallbackTweetIds = []) {
  let data;
  const cached = variantCache.get(tweetId);
  if (cached && Date.now() - cached.timestamp < VARIANT_CACHE_TTL) {
    data = cached.data;
  } else {
    data = await fetchTweetVideoData(tweetId);
  }

  // If primary tweet has no video, try fallback IDs (e.g. quoted tweet)
  if (!data?.videos?.length && fallbackTweetIds.length > 0) {
    for (const fbId of fallbackTweetIds) {
      try {
        data = await fetchTweetVideoData(fbId);
        if (data?.videos?.length) {
          tweetId = fbId; // Use the fallback ID for filename
          break;
        }
      } catch {
        // Continue to next fallback
      }
    }
  }

  if (!data?.videos?.length) {
    throw new Error("No video found in tweet");
  }

  const video = data.videos[videoIndex] || data.videos[0];
  if (!video?.variants?.length) {
    throw new Error("No video found in tweet");
  }

  let variant;
  if (selectedVariant) {
    variant = video.variants.find(v => v.url === selectedVariant.url) || video.variants[0];
  } else {
    // Apply default quality setting
    const settings = await getSettings();
    variant = pickVariantByQuality(video.variants, settings.defaultQuality);
  }

  if (!isAllowedVideoUrl(variant.url)) {
    throw new Error("Video URL is from an unexpected domain");
  }

  const resolution = sanitizeFilenameComponent(variant.resolution || "best");
  const username = sanitizeFilenameComponent(data.username);
  const filename = `@${username}_${tweetId}_${resolution}.mp4`;

  const downloadId = await chrome.downloads.download({
    url: variant.url,
    filename,
  });

  await savePendingDownload(downloadId, {
    tweetId,
    username: data.username,
    resolution,
    filename,
    timestamp: Date.now(),
  });

  return { success: true, downloadId, filename };
}

async function handleGetVariants(tweetId, fallbackTweetIds = []) {
  let data = await fetchTweetVideoData(tweetId);

  if (!data?.videos?.length && fallbackTweetIds.length > 0) {
    for (const fbId of fallbackTweetIds) {
      try {
        data = await fetchTweetVideoData(fbId);
        if (data?.videos?.length) {
          tweetId = fbId;
          break;
        }
      } catch {
        // Continue to next fallback
      }
    }
  }

  if (!data?.videos?.length) {
    throw new Error("No video found in tweet");
  }

  if (variantCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = variantCache.keys().next().value;
    variantCache.delete(oldestKey);
  }
  variantCache.set(tweetId, { data, timestamp: Date.now() });

  return {
    success: true,
    videos: data.videos,
    username: data.username,
    tweetId: data.tweetId,
  };
}

// --- History ---

async function getHistory() {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  return data[HISTORY_KEY] || [];
}

async function addToHistory(entry) {
  historyLock = historyLock.then(async () => {
    const history = await getHistory();
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    await chrome.storage.local.set({ [HISTORY_KEY]: history });
  }).catch(e => console.warn("[XVD] History write error:", e.message));
  return historyLock;
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
