// Runs in the ISOLATED world (set in the manifest). Running in MAIN would
// expose chrome.runtime to the host page. Button styling lives in content.css.

// --- X.com DOM selectors (fragile — first place to check when things break) --
const SEL_TWEET_BLOCK = '[data-testid="tweet"]';
const SEL_TWEET_LINK = 'a[href*="/status/"], a[href*="/statuses/"]';
const SEL_GROUP = '[role="group"]';
// -----------------------------------------------------------------------------

const IDLE_TITLE = 'Download video (Alt/Option-click for Save As)';
const ids = new WeakMap(); // tweet ID per button (not exposed to the page)
let rafId = 0;

function createIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1' +
      '-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1z' +
      'M5 20a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5z'
  );
  svg.appendChild(path);
  return svg;
}

function getTweetId(block) {
  const links = block.querySelectorAll(SEL_TWEET_LINK);
  const preferred = Array.from(links).find((link) => link.querySelector('time')) || links[0];
  return preferred?.href.match(/\/status(?:es)?\/(\d+)/)?.[1] || null;
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
  btn.appendChild(createIcon());

  ids.set(btn, id);
  bar.appendChild(btn);
}

// X virtualizes its timeline (only ~a couple dozen tweets stay in the DOM),
// so rescanning every tweet block on each batched mutation is cheap and
// removes any need for URL-change tracking or per-article bookkeeping.
function sweep() {
  for (const block of document.querySelectorAll(SEL_TWEET_BLOCK)) {
    if (!block.querySelector('.xvd') && block.querySelector('video')) inject(block);
  }
}

function scheduleSweep() {
  if (!rafId) rafId = requestAnimationFrame(runSweep);
}

function runSweep() {
  rafId = 0;
  sweep();
}

function setResult(btn, ok, title) {
  btn.classList.remove('xvd--busy');
  btn.classList.add(ok ? 'xvd--ok' : 'xvd--err');
  btn.title = title;
  setTimeout(() => {
    if (!btn.isConnected || btn.classList.contains('xvd--busy')) return;
    btn.classList.remove('xvd--ok', 'xvd--err');
    btn.title = IDLE_TITLE;
  }, 3000);
}

document.addEventListener(
  'click',
  (event) => {
    if (!event.isTrusted) return;

    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const btn = target?.closest?.('.xvd');
    if (!btn || btn.classList.contains('xvd--busy')) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const id = ids.get(btn);
    if (!id) return;

    btn.classList.remove('xvd--ok', 'xvd--err');
    btn.classList.add('xvd--busy');

    const timeout = setTimeout(() => {
      if (btn.classList.contains('xvd--busy')) setResult(btn, false, 'Extension did not respond');
    }, 15000);

    const saveAs = event.altKey;
    chrome.runtime.sendMessage({ action: 'download', id, saveAs }, (response) => {
      clearTimeout(timeout);
      if (!btn.isConnected) return;
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

// Observe only while the tab is visible: hidden tabs do zero work, and the
// re-sweep on return catches anything that changed while hidden.
const observer = new MutationObserver(scheduleSweep);

function setObserving(active) {
  if (active) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    sweep();
  } else {
    observer.disconnect();
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }
}

document.addEventListener('visibilitychange', () => setObserving(!document.hidden));
setObserving(!document.hidden);
