// Runs in the ISOLATED world (set in the manifest). Running in MAIN would
// expose chrome.runtime to the host page. Button styling lives in content.css.

// --- X.com DOM selectors (fragile — first place to check when things break) --
const SEL_TWEET = '[data-testid="tweet"]';
const SEL_TWEET_LINK = 'a[href*="/status/"], a[href*="/statuses/"]';
const SEL_TIMED_LINK = 'a[href*="/status/"]:has(time), a[href*="/statuses/"]:has(time)';
const SEL_GROUP = '[role="group"]';
// -----------------------------------------------------------------------------

const IDLE_TITLE = 'Download video (Alt/Option-click for Save As)';
const SWEEP_MIN_INTERVAL_MS = 200;
const ids = new WeakMap(); // tweet ID per button (not exposed to the page)
const resultTimers = new WeakMap();
const pendingTweets = new Set();
let sweepTimer = 0;
let lastSweepAt = 0;

// Fixed literal, safe for innerHTML: x.com serves no trusted-types CSP
// directives, and Chrome ≥130 exempts isolated worlds from page CSP anyway.
const ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1zM5 20a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5z"/></svg>';

function getTweetId(block) {
  const link = block.querySelector(SEL_TIMED_LINK) || block.querySelector(SEL_TWEET_LINK);
  return link?.href.match(/\/status(?:es)?\/(\d+)/)?.[1] || null;
}

function findActionBar(block) {
  const groups = block.querySelectorAll(SEL_GROUP);
  for (let index = groups.length - 1; index >= 0; index--) {
    const group = groups[index];
    if (
      group.children.length >= 4 &&
      group.querySelectorAll('button, [role="button"], a[href]').length >= 4
    ) {
      return group;
    }
  }
  return groups[groups.length - 1] || null;
}

function inject(block) {
  const id = getTweetId(block);
  const bar = id && findActionBar(block);
  if (!bar) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'xvd';
  btn.title = IDLE_TITLE;
  btn.setAttribute('aria-label', 'Download video. Alt or Option-click opens Save As.');
  btn.innerHTML = ICON_SVG;

  ids.set(btn, id);
  bar.appendChild(btn);
}

// Queue every tweet enclosing a mutation. The outer post must be revisited when
// a nested quote gains video, because both posts matched the old global scan.
function queueTweet(node) {
  if (!(node instanceof Element)) return false;
  let block = node.closest(SEL_TWEET);
  if (!block) return false;
  do {
    pendingTweets.add(block);
    block = block.parentElement?.closest(SEL_TWEET);
  } while (block);
  return true;
}

function queueAddedTweets(node) {
  if (!(node instanceof Element)) return;
  if (node.dataset.testid === 'tweet') pendingTweets.add(node);
  if (!node.firstElementChild || !node.querySelector(SEL_TWEET)) return;
  for (const block of node.querySelectorAll(SEL_TWEET)) pendingTweets.add(block);
}

function hasOwnButton(block) {
  for (const button of block.getElementsByClassName('xvd')) {
    if (ids.has(button) && button.closest(SEL_TWEET) === block) return true;
  }
  return false;
}

function sweep() {
  lastSweepAt = Date.now();
  for (const block of pendingTweets) {
    if (block.isConnected && block.querySelector('video') && !hasOwnButton(block)) {
      inject(block);
    }
  }
  pendingTweets.clear();
  adCanary();
}

// --- Ad-marker canary -------------------------------------------------------
// X must visibly label ads, so a still-visible labeled ad means the CSS
// placementTracking rule in content.css rotted: hide the timeline cell as a
// JS fallback (sidebar is left alone — hiding containers there over-hides
// organic entries) and flash the toolbar badge once so the selector gets
// refreshed. Ads show the label in place of the <time> permalink, which
// keeps organic tweets (even ones literally containing "Ad") out.
const AD_LABELS = new Set(['Ad', 'Promoted']);
const CANARY_EVERY_MS = 5000;
let nextCanaryAt = 0;
let rotReported = false;

function adCanary() {
  if (Date.now() < nextCanaryAt) return;
  nextCanaryAt = Date.now() + CANARY_EVERY_MS;

  for (const block of document.querySelectorAll(SEL_TWEET)) {
    if (block.offsetParent === null || block.querySelector('time')) continue;

    const labeled = [...block.querySelectorAll('span')].some(
      (span) =>
        span.childElementCount === 0 &&
        AD_LABELS.has(span.textContent.trim()) &&
        !span.closest('[data-testid="tweetText"]')
    );
    if (!labeled) continue;

    const cell = block.closest('div[data-testid="cellInnerDiv"]');
    if (cell) cell.style.display = 'none';
    if (!rotReported) {
      rotReported = true;
      chrome.runtime.sendMessage({ action: 'adMarkerRot' }, () => chrome.runtime.lastError);
    }
  }
}

function collectMutations(records) {
  const targets = new Map();
  const insideTargets = [];
  for (const record of records) {
    // Appending our own button must not schedule another sweep.
    if (record.addedNodes.length === 1 && ids.has(record.addedNodes[0])) continue;

    let insideTweet = targets.get(record.target);
    if (insideTweet === undefined) {
      insideTweet = queueTweet(record.target);
      targets.set(record.target, insideTweet);
      if (insideTweet) insideTargets.push(record.target);
    }
    if (!insideTweet) {
      for (const node of record.addedNodes) queueAddedTweets(node);
    }
  }

  // Connected additions inside a tweet have settled under their final target.
  for (const target of insideTargets) queueAddedTweets(target);

  // Irrelevant page churn does no scheduled work except the 5 s ad canary.
  if (pendingTweets.size || Date.now() >= nextCanaryAt) scheduleSweep();
}

// X mutates the DOM continuously while scrolling. One timer coalesces each
// burst while keeping sweeps at least SWEEP_MIN_INTERVAL_MS apart.
function scheduleSweep() {
  if (sweepTimer) return;

  const wait = Math.max(0, lastSweepAt + SWEEP_MIN_INTERVAL_MS - Date.now());
  sweepTimer = setTimeout(() => {
    sweepTimer = 0;
    sweep();
  }, wait);
}

function setResult(btn, ok, title) {
  clearTimeout(resultTimers.get(btn));
  btn.classList.remove('xvd--busy');
  btn.classList.add(ok ? 'xvd--ok' : 'xvd--err');
  btn.title = title;

  const resetId = setTimeout(() => {
    if (
      resultTimers.get(btn) !== resetId ||
      !btn.isConnected ||
      btn.classList.contains('xvd--busy')
    ) {
      return;
    }
    resultTimers.delete(btn);
    btn.classList.remove('xvd--ok', 'xvd--err');
    btn.title = IDLE_TITLE;
  }, 3000);
  resultTimers.set(btn, resetId);
}

document.addEventListener(
  'click',
  (event) => {
    if (!event.isTrusted) return;

    const btn = event.target instanceof Element ? event.target.closest('.xvd') : null;
    const id = btn && ids.get(btn);
    if (!id || btn.classList.contains('xvd--busy')) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    btn.classList.remove('xvd--ok', 'xvd--err');
    btn.classList.add('xvd--busy');

    // Save As blocks the background response for as long as the user keeps
    // the dialog open, so only plain downloads get a response deadline.
    const saveAs = event.altKey;
    const timeout = saveAs
      ? 0
      : setTimeout(() => setResult(btn, false, 'Extension did not respond'), 15000);

    chrome.runtime.sendMessage({ action: 'download', id, saveAs }, (response) => {
      clearTimeout(timeout);
      // Not busy means the timeout already reported failure — a late reply
      // must not flip the button to a stale result.
      if (!btn.isConnected || !btn.classList.contains('xvd--busy')) return;
      const ok = !chrome.runtime.lastError && response?.ok;
      setResult(
        btn,
        ok,
        ok
          ? saveAs
            ? 'Save As opened'
            : 'Download started'
          : response?.err || chrome.runtime.lastError?.message || 'Download failed'
      );
    });
  },
  true
);

// Observe only while the tab is visible: hidden tabs do zero work, and one
// full scan on return catches anything that changed while hidden.
const observer = new MutationObserver(collectMutations);

function setObserving(active) {
  if (active) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    queueAddedTweets(document.documentElement);
    sweep();
  } else {
    observer.disconnect();
    pendingTweets.clear();
    clearTimeout(sweepTimer);
    sweepTimer = 0;
  }
}

document.addEventListener('visibilitychange', () => setObserving(!document.hidden));
setObserving(!document.hidden);
