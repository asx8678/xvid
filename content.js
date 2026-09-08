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
const requests = new WeakMap();
const pendingTweets = new Set();
let sweepTimer = 0;
let lastSweepAt = 0;

// Fixed literal, safe for innerHTML: x.com serves no trusted-types CSP
// directives, and Chrome ≥130 exempts isolated worlds from page CSP anyway.
const ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1zM5 20a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5z"/></svg>';

function getTweetId(block) {
  for (const selector of [SEL_TIMED_LINK, SEL_TWEET_LINK]) {
    for (const link of block.querySelectorAll(selector)) {
      if (link.closest(SEL_TWEET) !== block) continue;
      const id = link.href.match(/\/status(?:es)?\/(\d+)/)?.[1];
      if (id) return id;
    }
  }
  return null;
}

function findActionBar(block) {
  const groups = block.querySelectorAll(SEL_GROUP);
  let fallback = null;
  for (let index = groups.length - 1; index >= 0; index--) {
    const group = groups[index];
    if (group.closest(SEL_TWEET) !== block) continue;
    fallback ??= group;
    if (
      group.children.length >= 4 &&
      group.querySelectorAll('button, [role="button"], a[href]').length >= 4
    ) {
      return group;
    }
  }
  return fallback;
}

function inject(id, bar) {
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

function resetButton(btn) {
  clearTimeout(requests.get(btn)?.timeout);
  requests.delete(btn);
  clearTimeout(resultTimers.get(btn));
  resultTimers.delete(btn);
  btn.classList.remove('xvd--busy', 'xvd--ok', 'xvd--err');
  btn.title = IDLE_TITLE;
}

function reconcileButton(block) {
  const id = getTweetId(block);
  const bar = id && block.querySelector('video') && findActionBar(block);
  let kept = null;
  // Snapshot the live collection before removing duplicates or stale controls.
  for (const btn of [...block.getElementsByClassName('xvd')]) {
    if (!ids.has(btn) || btn.closest(SEL_TWEET) !== block) continue;
    if (bar && btn.parentElement === bar && !kept) {
      kept = btn;
      if (ids.get(btn) !== id) {
        resetButton(btn);
        ids.set(btn, id);
      }
    } else {
      resetButton(btn);
      ids.delete(btn);
      btn.remove();
    }
  }
  if (bar && !kept) inject(id, bar);
}

function sweep() {
  lastSweepAt = Date.now();
  for (const block of pendingTweets) {
    if (block.isConnected) reconcileButton(block);
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
const HIDDEN_AD_CLASS = 'xvd-hidden-ad';
const hiddenAdCells = new Set();
let nextCanaryAt = 0;
let rotReported = false;

function isLabeledAd(block) {
  if (block.querySelector('time')) return false;
  return [...block.querySelectorAll('span')].some(
    (span) =>
      span.childElementCount === 0 &&
      AD_LABELS.has(span.textContent.trim()) &&
      !span.closest('[data-testid="tweetText"]')
  );
}

function adCanary() {
  // Recheck our hidden cells even between discovery scans. Visibility cannot
  // be the guard here: our own class makes both ads and reused organic posts hidden.
  for (const cell of hiddenAdCells) {
    if (!cell.isConnected || ![...cell.querySelectorAll(SEL_TWEET)].some(isLabeledAd)) {
      cell.classList.remove(HIDDEN_AD_CLASS);
      hiddenAdCells.delete(cell);
    }
  }
  if (Date.now() < nextCanaryAt) return;
  nextCanaryAt = Date.now() + CANARY_EVERY_MS;

  for (const block of document.querySelectorAll(SEL_TWEET)) {
    if (block.offsetParent === null || !isLabeledAd(block)) continue;

    const cell = block.closest('div[data-testid="cellInnerDiv"]');
    if (cell && !cell.classList.contains(HIDDEN_AD_CLASS)) {
      cell.classList.add(HIDDEN_AD_CLASS);
      hiddenAdCells.add(cell);
    }
    if (!rotReported) {
      rotReported = true;
      chrome.runtime.sendMessage({ action: 'adMarkerRot' }, () => chrome.runtime.lastError);
    }
  }
}

function collectMutations(records) {
  const targets = new Map();
  const insideTargets = [];
  let changed = false;
  for (const record of records) {
    // Appending our own button must not schedule another sweep.
    if (record.addedNodes.length === 1 && ids.has(record.addedNodes[0])) continue;

    changed = true;
    const target = record.target instanceof Element ? record.target : record.target.parentElement;
    let insideTweet = targets.get(target);
    if (insideTweet === undefined) {
      insideTweet = queueTweet(target);
      targets.set(target, insideTweet);
      if (insideTweet) insideTargets.push(target);
    }
    if (!insideTweet) {
      for (const node of record.addedNodes) queueAddedTweets(node);
    }
  }
  if (!changed) return;

  // Connected additions inside a tweet have settled under their final target.
  for (const target of insideTargets) queueAddedTweets(target);

  // Hidden fallback cells also need reconciliation when the host reuses them.
  if (pendingTweets.size || hiddenAdCells.size || Date.now() >= nextCanaryAt) scheduleSweep();
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

function finishRequest(btn, request, ok, title) {
  if (requests.get(btn) !== request) return;
  clearTimeout(request.timeout);
  requests.delete(btn);
  if (btn.isConnected) setResult(btn, ok, title);
}

document.addEventListener(
  'click',
  (event) => {
    if (!event.isTrusted) return;

    const btn = event.target instanceof Element ? event.target.closest('.xvd') : null;
    if (!btn || !ids.has(btn)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const block = btn.closest(SEL_TWEET);
    if (!block) return;
    // A click may arrive before the observer sees a reused post's new href.
    reconcileButton(block);
    const id = ids.get(btn);
    if (!id || !btn.isConnected || requests.has(btn)) return;

    resetButton(btn);
    btn.classList.add('xvd--busy');
    const request = {};
    requests.set(btn, request);

    // Save As blocks the background response for as long as the user keeps
    // the dialog open, so only plain downloads get a response deadline.
    const saveAs = event.altKey;
    request.timeout = saveAs
      ? 0
      : setTimeout(() => finishRequest(btn, request, false, 'Extension did not respond'), 15000);

    try {
      chrome.runtime.sendMessage({ action: 'download', id, saveAs }, (response) => {
        const ok = !chrome.runtime.lastError && response?.ok;
        finishRequest(
          btn,
          request,
          ok,
          ok
            ? saveAs
              ? 'Save As opened'
              : 'Download started'
            : response?.err || chrome.runtime.lastError?.message || 'Download failed'
        );
      });
    } catch (err) {
      finishRequest(btn, request, false, err?.message || 'Download failed');
    }
  },
  true
);

// Observe the DOM only while the tab is visible. One full scan on return
// catches anything that changed while hidden.
const observer = new MutationObserver(collectMutations);

function setObserving(active) {
  if (active) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
      characterData: true,
    });
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
