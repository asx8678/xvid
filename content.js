// Runs in the ISOLATED world (set in the manifest). Running in MAIN would
// expose chrome.runtime to the host page. Button styling lives in content.css.

// --- X.com DOM selectors (fragile — first place to check when things break) --
const SEL_INJECTABLE = '[data-testid="tweet"]:has(video):not(:has(.xvd))';
const SEL_TWEET_LINK = 'a[href*="/status/"], a[href*="/statuses/"]';
const SEL_TIMED_LINK = 'a[href*="/status/"]:has(time), a[href*="/statuses/"]:has(time)';
const SEL_GROUP = '[role="group"]';
// -----------------------------------------------------------------------------

const IDLE_TITLE = 'Download video (Alt/Option-click for Save As)';
const ids = new WeakMap(); // tweet ID per button (not exposed to the page)
let rafId = 0;

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

// X virtualizes its timeline (only ~a couple dozen tweets stay in the DOM),
// so rescanning on each batched mutation is cheap; the :has() selector leaves
// only video tweets that don't have a button yet.
function sweep() {
  for (const block of document.querySelectorAll(SEL_INJECTABLE)) inject(block);
}

function scheduleSweep() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    sweep();
  });
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

    const btn = event.target instanceof Element ? event.target.closest('.xvd') : null;
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
