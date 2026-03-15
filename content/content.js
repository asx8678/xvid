const DOWNLOAD_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1zM5 20a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5z"/></svg>`;

// --- Tooltip (appended to document.body to avoid overflow:hidden clipping) ---

let activeTooltip = null;
let tooltipTimeout = null;

function showTooltip(anchor, text) {
  hideTooltip();
  const rect = anchor.getBoundingClientRect();

  const tooltip = document.createElement("div");
  tooltip.className = "xvd-tooltip";
  tooltip.setAttribute("role", "alert");
  tooltip.textContent = text;
  tooltip.style.position = "fixed";
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.top - 4}px`;
  tooltip.style.transform = "translateX(-50%) translateY(-100%)";
  document.body.appendChild(tooltip);

  // Force reflow then animate in
  tooltip.offsetHeight;
  tooltip.classList.add("xvd-tooltip-visible");

  activeTooltip = tooltip;
  tooltipTimeout = setTimeout(hideTooltip, 4000);
}

function hideTooltip() {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
}

// --- Theme detection ---

function detectAndApplyTheme() {
  const bg = getComputedStyle(document.body).backgroundColor;
  let color;
  if (bg.includes("255, 255, 255")) {
    color = "rgb(83, 100, 113)";   // Light
  } else if (bg.includes("21, 32, 43")) {
    color = "rgb(139, 148, 158)";  // Dim
  } else {
    color = "rgb(113, 118, 123)";  // Lights Out / default
  }
  document.documentElement.style.setProperty("--xvd-icon-color", color);
}

// --- Tweet helpers ---

function getTweetId(article) {
  // Prefer the timestamp link — it always points to the outer tweet, not a quoted tweet
  const timeLink = article.querySelector('a[href*="/status/"] time');
  if (timeLink) {
    const link = timeLink.closest("a");
    const match = link?.href.match(/\/status\/(\d+)/);
    if (match) return match[1];
  }

  // Fallback: first status link
  const links = article.querySelectorAll('a[href*="/status/"]');
  for (const link of links) {
    const match = link.href.match(/\/status\/(\d+)/);
    if (match) return match[1];
  }
  return null;
}

function getAllTweetIds(article) {
  const primary = getTweetId(article);
  const ids = new Set();
  const links = article.querySelectorAll('a[href*="/status/"]');
  for (const link of links) {
    const match = link.href.match(/\/status\/(\d+)/);
    if (match && match[1] !== primary) ids.add(match[1]);
  }
  return { primary, fallbacks: [...ids] };
}

function hasVideo(article) {
  return article.querySelector("video") !== null;
}

function findAllButtonsForTweet(tweetId) {
  const wrappers = document.querySelectorAll(`.xvd-btn-wrapper[data-xvd-tweet-id="${CSS.escape(tweetId)}"]`);
  const buttons = [];
  for (const w of wrappers) {
    const btn = w.querySelector(".xvd-download-btn");
    if (btn) buttons.push(btn);
  }
  return buttons;
}

// --- Button ---

function countVideos(article) {
  return article.querySelectorAll("video").length;
}

function createDownloadButton(tweetId, fallbackTweetIds) {
  const wrapper = document.createElement("div");
  wrapper.className = "xvd-btn-wrapper";
  wrapper.dataset.xvdTweetId = tweetId;
  wrapper.dataset.xvdFallbacks = JSON.stringify(fallbackTweetIds || []);

  const btn = document.createElement("button");
  btn.className = "xvd-download-btn";
  btn.title = "Download video";
  btn.innerHTML = DOWNLOAD_SVG;
  btn.setAttribute("aria-label", "Download video");

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (btn.classList.contains("xvd-loading")) {
      showTooltip(btn, "Download in progress\u2026");
      return;
    }

    btn.classList.remove("xvd-success", "xvd-error");
    btn.classList.add("xvd-loading");
    btn.setAttribute("aria-busy", "true");

    chrome.runtime.sendMessage({ action: "download", tweetId, fallbackTweetIds }, (response) => {
      btn.classList.remove("xvd-loading");
      btn.setAttribute("aria-busy", "false");

      if (chrome.runtime.lastError) {
        btn.classList.add("xvd-error");
        showTooltip(btn, "Extension restarted \u2014 please reload the page");
        setTimeout(() => btn.classList.remove("xvd-error"), 4000);
        return;
      }

      if (response?.success) {
        btn.classList.add("xvd-success");
        btn.setAttribute("aria-label", "Download started");
        btn.title = "Download started";
      } else {
        btn.classList.add("xvd-error");
        showTooltip(btn, response?.error || "Download failed");
      }
      setTimeout(() => {
        btn.classList.remove("xvd-success", "xvd-error");
        btn.setAttribute("aria-label", "Download video");
        btn.title = "Download video";
      }, 4000);
    });
  });

  wrapper.appendChild(btn);
  return wrapper;
}

// --- Article processing ---

function processArticle(article) {
  if (article.querySelector(".xvd-btn-wrapper")) return;
  if (!hasVideo(article)) return;

  const { primary, fallbacks } = getAllTweetIds(article);
  if (!primary) return;

  const actionBar = article.querySelector('[role="group"]:last-of-type');
  if (!actionBar) return;

  const downloadBtn = createDownloadButton(primary, fallbacks);

  const videoCount = countVideos(article);
  if (videoCount > 1) {
    const badge = document.createElement("span");
    badge.className = "xvd-badge";
    badge.textContent = String(videoCount);
    badge.title = `${videoCount} videos — use popup for full control`;
    downloadBtn.querySelector(".xvd-download-btn").appendChild(badge);
  }

  actionBar.appendChild(downloadBtn);
}

function processAllArticles() {
  document.querySelectorAll("article").forEach(processArticle);
}

// --- Download status listener (handles async completion/failure from SW) ---

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "downloadComplete" && message.success) {
    for (const btn of findAllButtonsForTweet(message.tweetId)) {
      btn.classList.remove("xvd-loading");
      btn.classList.add("xvd-success");
      btn.title = "Download complete";
      setTimeout(() => {
        btn.classList.remove("xvd-success");
        btn.setAttribute("aria-label", "Download video");
        btn.title = "Download video";
      }, 4000);
    }
  }

  if (message.action === "downloadFailed") {
    const buttons = findAllButtonsForTweet(message.tweetId);
    for (const btn of buttons) {
      btn.classList.remove("xvd-loading", "xvd-success");
      btn.classList.add("xvd-error");
      setTimeout(() => {
        btn.classList.remove("xvd-error");
        btn.setAttribute("aria-label", "Download video");
      }, 4000);
    }
    if (buttons.length > 0) {
      showTooltip(buttons[0], message.error || "Download failed");
    }
  }
});

// --- Debounced MutationObserver ---

let pendingNodes = new Set();
let rafScheduled = false;

function processPendingNodes() {
  rafScheduled = false;
  const nodes = pendingNodes;
  pendingNodes = new Set();

  for (const node of nodes) {
    if (!document.contains(node)) continue;

    if (node.tagName === "ARTICLE") {
      processArticle(node);
    } else {
      if (node.querySelectorAll) {
        node.querySelectorAll("article").forEach(processArticle);
      }
      // Detect lazy-loaded video inside an existing article
      if (node.tagName === "VIDEO" || (node.querySelector && node.querySelector("video"))) {
        const article = node.closest("article");
        if (article) processArticle(article);
      }
    }
  }
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        pendingNodes.add(node);
      }
    }
  }
  if (!rafScheduled && pendingNodes.size > 0) {
    rafScheduled = true;
    requestAnimationFrame(processPendingNodes);
  }
});

// --- Initialize ---

processAllArticles();

detectAndApplyTheme();
new MutationObserver(detectAndApplyTheme).observe(document.body, {
  attributes: true,
  attributeFilter: ["style", "class"],
});

observer.observe(document.body, { childList: true, subtree: true });
