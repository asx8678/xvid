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

let currentVideos = [];
let currentTweetId = "";
let currentUsername = "";
let fetchGeneration = 0;
let lastDownloadParams = null;
let progressInterval = null;

function parseTweetId(input) {
  input = input.trim();
  // Bare tweet ID
  if (/^\d+$/.test(input)) return input;
  // x.com or twitter.com URL
  const match = input.match(/(?:x\.com|twitter\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

let errorClearTimeout = null;

function setStatus(state, text) {
  if (errorClearTimeout) {
    clearTimeout(errorClearTimeout);
    errorClearTimeout = null;
  }
  statusEl.className = "status " + state;
  statusEl.textContent = text;
  if (state === "error") {
    errorClearTimeout = setTimeout(() => setStatus("ready", "Ready"), 5000);
  }
}

function formatDuration(ms) {
  const secs = Math.round(ms / 1000);
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  if (mins > 0) return `${mins}:${String(rem).padStart(2, "0")}`;
  return `${secs}s`;
}

function updateQualityOptions() {
  const videoIndex = currentVideos.length > 1 ? parseInt(videoSelect.value) : 0;
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
    opt.textContent = `${v.resolution} (${Math.round(v.bitrate / 1000)}kbps)`;
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
      variantsSection.classList.add("hidden");
      return;
    }

    if (!response?.success) {
      setStatus("error", response?.error || "Failed to fetch video data");
      variantsSection.classList.add("hidden");
      return;
    }

    currentVideos = response.videos;
    currentTweetId = response.tweetId;
    currentUsername = response.username;

    // Show video selector if multiple videos
    if (currentVideos.length > 1) {
      videoSelectRow.classList.remove("hidden");
      videoSelect.innerHTML = "";
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

downloadBtn.addEventListener("click", () => {
  const selectedUrl = qualitySelect.value;
  const videoIndex = currentVideos.length > 1 ? parseInt(videoSelect.value) : 0;
  const variants = currentVideos[videoIndex]?.variants || [];
  const variant = variants.find(v => v.url === selectedUrl);
  if (!variant) return;

  lastDownloadParams = { tweetId: currentTweetId, variant, videoIndex };

  setStatus("downloading", "Downloading...");
  downloadBtn.disabled = true;

  chrome.runtime.sendMessage(
    { action: "download", tweetId: currentTweetId, variant, videoIndex },
    (response) => {
      downloadBtn.disabled = false;

      if (chrome.runtime.lastError) {
        setStatus("error", "Extension error \u2014 try again");
        retryRow.classList.remove("hidden");
        return;
      }

      if (response?.success) {
        setStatus("downloading", "Downloading...");
        retryRow.classList.add("hidden");
        startProgressTracking(response.downloadId);
      } else {
        setStatus("error", response?.error || "Download failed");
        retryRow.classList.remove("hidden");
      }
    }
  );
});

// --- History (read directly from chrome.storage.local, no SW roundtrip) ---

function loadHistory() {
  chrome.storage.local.get("xvd_download_history", (data) => {
    const history = data.xvd_download_history || [];

    historyList.innerHTML = "";
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

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Auto-refresh history when a download completes and updates storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.xvd_download_history) {
    loadHistory();
  }
});

// --- Progress tracking ---

function startProgressTracking(downloadId) {
  stopProgressTracking();
  progressRow.classList.remove("hidden");
  progressBar.value = 0;
  progressText.textContent = "0%";

  progressInterval = setInterval(() => {
    chrome.downloads.search({ id: downloadId }, (results) => {
      if (chrome.runtime.lastError || !results || results.length === 0) {
        stopProgressTracking();
        return;
      }
      const dl = results[0];
      if (dl.state === "complete") {
        progressBar.value = 100;
        progressText.textContent = "Done!";
        setStatus("ready", "Download complete!");
        setTimeout(() => {
          stopProgressTracking();
          setStatus("ready", "Ready");
        }, 2000);
        downloadBtn.disabled = false;
        return;
      }
      if (dl.state === "interrupted") {
        stopProgressTracking();
        setStatus("error", "Download interrupted");
        retryRow.classList.remove("hidden");
        downloadBtn.disabled = false;
        return;
      }
      if (dl.totalBytes > 0) {
        const pct = Math.round((dl.bytesReceived / dl.totalBytes) * 100);
        progressBar.value = pct;
        progressText.textContent = `${pct}%`;
      } else if (dl.bytesReceived > 0) {
        progressText.textContent = `${(dl.bytesReceived / 1024 / 1024).toFixed(1)} MB`;
      }
    });
  }, 500);
}

function stopProgressTracking() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
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
    (response) => {
      downloadBtn.disabled = false;

      if (chrome.runtime.lastError) {
        setStatus("error", "Extension error \u2014 try again");
        retryRow.classList.remove("hidden");
        return;
      }

      if (response?.success) {
        setStatus("downloading", "Downloading...");
        retryRow.classList.add("hidden");
        startProgressTracking(response.downloadId);
      } else {
        setStatus("error", response?.error || "Retry failed");
        retryRow.classList.remove("hidden");
      }
    }
  );
});

// --- Disclaimer ---
chrome.storage.sync.get("xvd_disclaimer_dismissed", (data) => {
  if (data.xvd_disclaimer_dismissed) {
    disclaimer.classList.add("hidden");
  }
});

dismissDisclaimer.addEventListener("click", () => {
  disclaimer.classList.add("hidden");
  chrome.storage.sync.set({ xvd_disclaimer_dismissed: true });
});

// Load history on popup open
loadHistory();
