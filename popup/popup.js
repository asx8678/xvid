import { parseTweetId, formatDuration, formatTimeAgo } from "../lib/utils.js";
import { HISTORY_KEY, DISCLAIMER_KEY, AUTH_API_WARNING, PRIVACY_POLICY_URL } from "../lib/constants.js";

const urlInput = document.getElementById("urlInput");
const fetchBtn = document.getElementById("fetchBtn");
const variantsSection = document.getElementById("variantsSection");
const videoSelectRow = document.getElementById("videoSelectRow");
const videoSelect = document.getElementById("videoSelect");
const qualitySelect = document.getElementById("qualitySelect");
const downloadBtn = document.getElementById("downloadBtn");
const historyList = document.getElementById("historyList");
const emptyHistory = document.getElementById("emptyHistory");
const statusEl = document.getElementById("status");
const progressRow = document.getElementById("progressRow");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const retryRow = document.getElementById("retryRow");
const retryBtn = document.getElementById("retryBtn");
const disclaimer = document.getElementById("disclaimer");
const dismissDisclaimer = document.getElementById("dismissDisclaimer");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const apiWarning = document.getElementById("apiWarning");

let currentVideos = [];
let currentTweetId = "";
let fetchGeneration = 0;
let lastDownloadParams = null;
const ERROR_CLEAR_MS = 5000;

let errorClearTimeout = null;

function setStatus(state, text) {
  if (errorClearTimeout) {
    clearTimeout(errorClearTimeout);
    errorClearTimeout = null;
  }
  statusEl.className = "status " + state;
  statusEl.textContent = text;
  if (state === "error") {
    errorClearTimeout = setTimeout(() => setStatus("ready", "Ready"), ERROR_CLEAR_MS);
  }
}

function updateQualityOptions() {
  const videoIndex = currentVideos.length > 1 ? parseInt(videoSelect.value) || 0 : 0;
  const variants = currentVideos[videoIndex]?.variants || [];
  qualitySelect.innerHTML = "";

  if (variants.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "No downloadable formats";
    opt.disabled = true;
    qualitySelect.appendChild(opt);
    downloadBtn.disabled = true;
    return;
  }

  downloadBtn.disabled = false;
  for (const v of variants) {
    const opt = document.createElement("option");
    opt.value = v.url;
    const res = v.resolution && v.resolution !== "unknown" ? v.resolution : "Unknown";
    const bitrateLabel = v.bitrate > 0 ? ` (${Math.round(v.bitrate / 1000)}kbps)` : "";
    opt.textContent = `${res}${bitrateLabel}`;
    qualitySelect.appendChild(opt);
  }
}

fetchBtn.addEventListener("click", async () => {
  const tweetId = parseTweetId(urlInput.value);
  if (!tweetId) {
    setStatus("error", "Invalid URL or ID");
    return;
  }

  const thisGeneration = ++fetchGeneration;
  setStatus("fetching", "Fetching...");
  fetchBtn.disabled = true;
  downloadBtn.disabled = true;
  variantsSection.classList.add("hidden");

  chrome.runtime.sendMessage({ action: "getVariants", tweetId }, (response) => {
    fetchBtn.disabled = false;

    // Discard stale response from a previous fetch
    if (thisGeneration !== fetchGeneration) return;

    if (chrome.runtime.lastError) {
      setStatus("error", "Extension error \u2014 try again");
      downloadBtn.disabled = false;
      variantsSection.classList.add("hidden");
      return;
    }

    if (!response?.success) {
      setStatus("error", response?.error || "Failed to fetch video data");
      downloadBtn.disabled = false;
      variantsSection.classList.add("hidden");
      return;
    }

    currentVideos = response.videos;
    currentTweetId = response.tweetId;

    if (response.apiSource === "graphql") {
      apiWarning.textContent = AUTH_API_WARNING;
      apiWarning.classList.remove("hidden");
    } else {
      apiWarning.classList.add("hidden");
    }

    // Show video selector if multiple videos
    if (currentVideos.length > 1) {
      videoSelectRow.classList.remove("hidden");
      videoSelect.replaceChildren();
      currentVideos.forEach((video, i) => {
        const opt = document.createElement("option");
        opt.value = i;
        const type = video.type === "animated_gif" ? "GIF" : "Video";
        const duration = video.durationMs > 0 ? ` (${formatDuration(video.durationMs)})` : "";
        opt.textContent = `${type} ${i + 1}${duration}`;
        videoSelect.appendChild(opt);
      });
    } else {
      videoSelectRow.classList.add("hidden");
    }

    updateQualityOptions();
    variantsSection.classList.remove("hidden");
    setStatus("ready", "Ready");
  });
});

videoSelect.addEventListener("change", updateQualityOptions);

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") fetchBtn.click();
});

function handleDownloadResponse(response, failureLabel = "Download failed") {
  downloadBtn.disabled = false;
  if (chrome.runtime.lastError) {
    setStatus("error", "Extension error \u2014 try again");
    retryRow.classList.remove("hidden");
    return;
  }
  if (response?.success) {
    retryRow.classList.add("hidden");
    startProgressTracking(response.downloadId);
    if (response.warnings?.length) {
      setStatus("warning", response.warnings[0]);
      setTimeout(() => setStatus("downloading", "Downloading..."), 3000);
    } else {
      setStatus("downloading", "Downloading...");
    }
  } else {
    setStatus("error", response?.error || failureLabel);
    retryRow.classList.remove("hidden");
  }
}

downloadBtn.addEventListener("click", () => {
  const selectedUrl = qualitySelect.value;
  const videoIndex = currentVideos.length > 1 ? parseInt(videoSelect.value) || 0 : 0;
  const variants = currentVideos[videoIndex]?.variants || [];
  const variant = variants.find(v => v.url === selectedUrl);
  if (!variant) return;

  lastDownloadParams = { tweetId: currentTweetId, variant, videoIndex };

  setStatus("downloading", "Downloading...");
  downloadBtn.disabled = true;

  chrome.runtime.sendMessage(
    { action: "download", tweetId: currentTweetId, variant, videoIndex },
    (response) => handleDownloadResponse(response)
  );
});

// --- History (read directly from chrome.storage.local, no SW roundtrip) ---

function loadHistory() {
  chrome.storage.local.get(HISTORY_KEY, (data) => {
    if (chrome.runtime.lastError) {
      console.warn("[XVD] loadHistory error:", chrome.runtime.lastError.message);
      return;
    }
    const history = data[HISTORY_KEY] || [];

    historyList.replaceChildren();
    if (history.length === 0) {
      emptyHistory.classList.remove("hidden");
      return;
    }

    emptyHistory.classList.add("hidden");
    for (const item of history) {
      const li = document.createElement("li");
      li.className = "history-item";

      const filenameDiv = document.createElement("div");
      filenameDiv.className = "history-filename";
      filenameDiv.textContent = item.filename;

      const timeDiv = document.createElement("div");
      timeDiv.className = "history-time";
      timeDiv.textContent = formatTimeAgo(item.timestamp);

      li.appendChild(filenameDiv);
      li.appendChild(timeDiv);
      historyList.appendChild(li);
    }
  });
}

// Auto-refresh history when a download completes and updates storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[HISTORY_KEY]) {
    loadHistory();
  }
});

// --- Progress tracking (event-driven via chrome.downloads.onChanged) ---

let trackedDownloadId = null;

function onDownloadChanged(delta) {
  if (delta.id !== trackedDownloadId) return;

  if (delta.state) {
    if (delta.state.current === "complete") {
      progressBar.value = 100;
      progressText.textContent = "Done!";
      setStatus("ready", "Download complete!");
      downloadBtn.disabled = false;
      setTimeout(() => {
        stopProgressTracking();
        setStatus("ready", "Ready");
      }, 2000);
      return;
    }
    if (delta.state.current === "interrupted") {
      stopProgressTracking();
      setStatus("error", "Download interrupted");
      retryRow.classList.remove("hidden");
      downloadBtn.disabled = false;
      return;
    }
  }

  // Update progress on bytesReceived / totalBytes changes (use delta directly, no IPC)
  if (delta.bytesReceived !== undefined || delta.totalBytes !== undefined) {
    const received = delta.bytesReceived?.current ?? 0;
    const total = delta.totalBytes?.current ?? 0;
    if (total > 0) {
      const pct = Math.round((received / total) * 100);
      progressBar.value = pct;
      progressText.textContent = `${pct}%`;
    } else if (received > 0) {
      progressText.textContent = `${(received / 1024 / 1024).toFixed(1)} MB`;
    }
  }
}

function startProgressTracking(downloadId) {
  stopProgressTracking();
  trackedDownloadId = downloadId;
  progressRow.classList.remove("hidden");
  progressBar.value = 0;
  progressText.textContent = "0%";
  chrome.downloads.onChanged.addListener(onDownloadChanged);
}

function stopProgressTracking() {
  if (trackedDownloadId !== null) {
    chrome.downloads.onChanged.removeListener(onDownloadChanged);
    trackedDownloadId = null;
  }
  progressRow.classList.add("hidden");
}

// --- Retry ---

retryBtn.addEventListener("click", () => {
  if (!lastDownloadParams) return;
  retryRow.classList.add("hidden");
  setStatus("downloading", "Retrying...");
  downloadBtn.disabled = true;

  chrome.runtime.sendMessage(
    { action: "download", ...lastDownloadParams },
    (response) => handleDownloadResponse(response, "Retry failed")
  );
});

// --- Disclaimer ---
chrome.storage.sync.get(DISCLAIMER_KEY, (data) => {
  if (chrome.runtime.lastError) {
    console.warn("[XVD] disclaimer check error:", chrome.runtime.lastError.message);
    return;
  }
  if (data[DISCLAIMER_KEY]) {
    disclaimer.classList.add("hidden");
  }
});

dismissDisclaimer.addEventListener("click", () => {
  disclaimer.classList.add("hidden");
  chrome.storage.sync.set({ [DISCLAIMER_KEY]: true }, () => {
    if (chrome.runtime.lastError) {
      console.warn("[XVD] disclaimer dismiss error:", chrome.runtime.lastError.message);
    }
  });
});

// --- Clear history ---

clearHistoryBtn.addEventListener("click", () => {
  if (!confirm("Clear all download history?")) return;
  chrome.runtime.sendMessage({ action: "clearHistory" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("[XVD] clearHistory error:", chrome.runtime.lastError.message);
    }
    // UI update is driven by the chrome.storage.onChanged listener
  });
});

// On popup open, resume progress tracking if a download is in progress
function resumeProgressTracking() {
  chrome.downloads.search({ state: "in_progress", orderBy: ["-startTime"], limit: 1 }, (results) => {
    if (chrome.runtime.lastError || !results || results.length === 0) return;
    const dl = results[0];
    if (dl.byExtensionId === chrome.runtime.id) {
      startProgressTracking(dl.id);
      downloadBtn.disabled = true;
      setStatus("downloading", "Downloading...");
    }
  });
}

// Load history on popup open
loadHistory();
resumeProgressTracking();

// Version
document.getElementById("version").textContent = `v${chrome.runtime.getManifest().version}`;

// Footer links
document.getElementById("settingsLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById("privacyLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL(PRIVACY_POLICY_URL) });
});
