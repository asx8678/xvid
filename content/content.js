const DOWNLOAD_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1zM5 20a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5z"/></svg>`;

const BUTTON_RESET_MS = 4000;

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

  // Force reflow so the CSS transition triggers on the newly-appended element
  tooltip.offsetHeight;
  tooltip.classList.add("xvd-tooltip-visible");

  activeTooltip = tooltip;
  tooltipTimeout = setTimeout(hideTooltip, BUTTON_RESET_MS);
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
// X.com uses three themes with distinct body background colors:
//   Light:      rgb(255, 255, 255)
//   Dim:        rgb(21, 32, 43)
//   Lights Out: rgb(0, 0, 0)

let lastIconColor = null;

function detectAndApplyTheme() {
  const bg = getComputedStyle(document.body).backgroundColor;
  let iconColor;
  if (bg.includes("255, 255, 255")) {
    iconColor = "rgb(83, 100, 113)";   // Light theme icon color
  } else if (bg.includes("21, 32, 43")) {
    iconColor = "rgb(139, 148, 158)";  // Dim theme icon color
  } else {
    iconColor = "rgb(113, 118, 123)";  // Lights Out / default icon color
  }
  if (iconColor !== lastIconColor) {
    lastIconColor = iconColor;
    document.documentElement.style.setProperty("--xvd-icon-color", iconColor);
  }
}

// --- Tweet helpers ---

function getAllTweetIds(article) {
  // Prefer the timestamp link — it always points to the outer tweet, not a quoted tweet
  const timeLink = article.querySelector('a[href*="/status/"] time');
  let primary = null;
  if (timeLink) {
    const link = timeLink.closest("a");
    const match = link?.href.match(/\/status\/(\d+)/);
    if (match) primary = match[1];
  }

  const links = article.querySelectorAll('a[href*="/status/"]');
  const ids = new Set();
  for (const link of links) {
    const match = link.href.match(/\/status\/(\d+)/);
    if (match) {
      if (!primary) primary = match[1];
      else if (match[1] !== primary) ids.add(match[1]);
    }
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

function findMostVisibleVideoArticle() {
  const articles = document.querySelectorAll("article");
  const viewportCenter = window.innerHeight / 2;
  let best = null;
  let closestDistance = Infinity;
  for (const article of articles) {
    if (!hasVideo(article)) continue;
    const rect = article.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    const articleCenter = rect.top + rect.height / 2;
    const dist = Math.abs(articleCenter - viewportCenter);
    if (dist < closestDistance) {
      closestDistance = dist;
      best = article;
    }
  }
  return best;
}

// --- Button state ---

function resetButton(btn) {
  btn.classList.remove("xvd-loading", "xvd-success", "xvd-error");
  btn.setAttribute("aria-label", "Download video");
  btn.title = "Download video";
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
        setTimeout(() => resetButton(btn), BUTTON_RESET_MS);
        return;
      }

      if (response?.success) {
        btn.classList.add("xvd-success");
        btn.setAttribute("aria-label", "Download started");
        btn.title = "Download started";
        if (response.warnings?.length) {
          showTooltip(btn, response.warnings[0]);
        }
      } else {
        btn.classList.add("xvd-error");
        showTooltip(btn, response?.error || "Download failed");
      }
      setTimeout(() => resetButton(btn), BUTTON_RESET_MS);
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
      setTimeout(() => resetButton(btn), BUTTON_RESET_MS);
    }
  }

  if (message.action === "downloadFailed") {
    const buttons = findAllButtonsForTweet(message.tweetId);
    for (const btn of buttons) {
      btn.classList.remove("xvd-loading", "xvd-success");
      btn.classList.add("xvd-error");
      setTimeout(() => resetButton(btn), BUTTON_RESET_MS);
    }
    if (buttons.length > 0) {
      showTooltip(buttons[0], message.error || "Download failed");
    }
  }

  if (message.action === "triggerDownload") {
    const article = findMostVisibleVideoArticle();
    if (article) {
      const btn = article.querySelector(".xvd-download-btn");
      if (btn && !btn.classList.contains("xvd-loading")) {
        btn.click();
      }
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
