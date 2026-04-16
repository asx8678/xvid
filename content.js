// NOTE: This script MUST run in the ISOLATED world. Running in MAIN would
// expose chrome.runtime to the host page and open XSS vectors.

const CLR_DEFAULT = 'rgb(113,118,123)';
const CLR_HOVER = '#1d9bf0';
const CLR_SUCCESS = '#00ba7c';
const CLR_ERROR = '#f4212e';

// --- X.com DOM selectors (fragile — first place to check when things break) --
const SEL_TWEET_LINK = 'a[href*="/status/"], a[href*="/statuses/"], a[href*="/i/web/status/"], a[href*="/i/status/"]';
const SEL_TWEET_BLOCK = '[data-testid="tweet"]';
const SEL_GROUP = '[role="group"]';
// -----------------------------------------------------------------------------

const BTN_CSS = [
  'display:flex',
  'align-items:center',
  'justify-content:center',
  'width:34.75px',
  'height:34.75px',
  'border:none',
  'background:none',
  'cursor:pointer',
  'border-radius:999px',
  `color:${CLR_DEFAULT}`,
  'padding:0',
  'transition:background-color .15s ease, color .15s ease, opacity .15s ease',
].join(';');

const WRAP_CSS = 'display:flex;align-items:center;justify-content:center;min-width:34.75px;height:34.75px';
const URL_POLL_MS = 1200;

const ids = new WeakMap();       // tweet ID per button (not exposed to page)
const pending = new Set();       // elements queued for injection this frame
let scanned = new WeakMap();     // article → last-known content fingerprint
let rafId = null;
let lastHref = location.href;
let observedTarget = null;

// ── helpers ────────────────────────────────────────────────────────────────

function createIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.style.cssText = 'width:18px;height:18px;pointer-events:none';

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1'
      + '-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1z'
      + 'M5 20a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5z'
  );
  svg.appendChild(path);
  return svg;
}

function isTweetBlock(node) {
  return Boolean(node?.matches?.(SEL_TWEET_BLOCK));
}

function getOwnedElements(scope, selector) {
  const elements = Array.from(scope.querySelectorAll(selector));
  if (!isTweetBlock(scope)) return elements;
  return elements.filter((element) => element.closest(SEL_TWEET_BLOCK) === scope);
}

function getTweetId(block) {
  const links = getOwnedElements(block, SEL_TWEET_LINK);
  if (!links.length) return null;

  const preferred = links.find((link) => link.querySelector('time')) || links[0];
  return preferred?.href.match(/(?:\/status\/|\/statuses\/|\/i\/web\/status\/|\/i\/status\/)(\d+)/)?.[1] || null;
}

function countInteractive(group) {
  return group.querySelectorAll('button, [role="button"], a[href]').length;
}

function hasOwnedVideo(scope) {
  return getOwnedElements(scope, 'video').length > 0;
}

function hasOwnButton(scope) {
  return getOwnedElements(scope, '.xvd').length > 0;
}

function findActionBar(scope) {
  const groups = getOwnedElements(scope, SEL_GROUP);
  if (!groups.length) return null;

  for (let index = groups.length - 1; index >= 0; index--) {
    const group = groups[index];
    if (group.children.length >= 4 && countInteractive(group) >= 4) return group;
  }

  return groups[groups.length - 1] || null;
}

function setButtonVisual(btn, state) {
  if (!btn?.isConnected) return;

  switch (state) {
    case 'hover':
      btn.style.color = CLR_HOVER;
      btn.style.backgroundColor = 'rgba(29,155,240,0.1)';
      break;
    case 'success':
      btn.style.color = CLR_SUCCESS;
      btn.style.backgroundColor = 'rgba(0,186,124,0.12)';
      break;
    case 'error':
      btn.style.color = CLR_ERROR;
      btn.style.backgroundColor = 'rgba(244,33,46,0.12)';
      break;
    default:
      btn.style.color = CLR_DEFAULT;
      btn.style.backgroundColor = 'transparent';
      break;
  }
}

function resetButtonLater(btn, title = 'Download video (Shift-click for picker, Alt-click for Save As)') {
  setTimeout(() => {
    if (!btn.isConnected || btn.dataset.busy) return;
    btn.title = title;
    setButtonVisual(btn, 'default');
  }, 3000);
}

// ── injection ──────────────────────────────────────────────────────────────

function inject(block) {
  if (hasOwnButton(block) || !hasOwnedVideo(block)) return;

  const id = getTweetId(block);
  if (!id) return;

  const bar = findActionBar(block);
  if (!bar) return;

  const host = document.createElement('div');
  host.className = 'xvd-wrap';
  host.style.cssText = WRAP_CSS;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'xvd';
  btn.title = 'Download video (Shift-click for picker, Alt-click for Save As)';
  btn.setAttribute('aria-label', 'Download video');
  btn.style.cssText = BTN_CSS;
  btn.appendChild(createIcon());

  btn.addEventListener('mouseenter', () => {
    if (!btn.dataset.busy) setButtonVisual(btn, 'hover');
  });
  btn.addEventListener('mouseleave', () => {
    if (!btn.dataset.busy) setButtonVisual(btn, 'default');
  });
  btn.addEventListener('focus', () => {
    if (!btn.dataset.busy) setButtonVisual(btn, 'hover');
  });
  btn.addEventListener('blur', () => {
    if (!btn.dataset.busy) setButtonVisual(btn, 'default');
  });

  ids.set(btn, id);
  host.appendChild(btn);
  bar.appendChild(host);
}

/**
 * Fallback when data-testid="tweet" is absent: walk up from the action
 * bar until we find the smallest container that owns both a video and a
 * permalink, then inject there.
 */
const MAX_FALLBACK_DEPTH = 10;

function injectFallback(article) {
  const bar = findActionBar(article);
  if (!bar || article.querySelector('.xvd')) return;

  let container = bar.parentElement;
  let depth = 0;

  while (container && container !== article && depth < MAX_FALLBACK_DEPTH) {
    if (container.querySelector('video') && getTweetId(container)) {
      inject(container);
      return;
    }
    container = container.parentElement;
    depth++;
  }

  if (article.querySelector('video') && getTweetId(article)) {
    inject(article);
  }
}

function articleFingerprint(article) {
  const vids = article.querySelectorAll('video');
  if (!vids.length) return `no-video|${article.querySelectorAll(SEL_TWEET_BLOCK).length}`;

  return Array.from(
    vids,
    (video) => `${video.src || ''}|${video.poster || ''}|${video.querySelectorAll('source').length}`
  ).join(';');
}

function scanArticle(article) {
  const fp = articleFingerprint(article);
  if (scanned.get(article) === fp) return;

  scanned.set(article, fp);
  article.querySelectorAll('.xvd-wrap').forEach((node) => node.remove());

  const blocks = article.querySelectorAll(SEL_TWEET_BLOCK);
  if (blocks.length) {
    blocks.forEach(inject);
  } else {
    injectFallback(article);
  }
}

function resetAllInjections() {
  scanned = new WeakMap();
  document.querySelectorAll('.xvd-wrap').forEach((node) => node.remove());
  document.querySelectorAll('article').forEach((article) => pending.add(article));
  scheduleFlush();
}

// ── batched mutation observer ──────────────────────────────────────────────

function flush() {
  rafId = null;

  for (const el of pending) {
    if (!el.isConnected) continue;

    if (el.matches(SEL_TWEET_BLOCK)) {
      inject(el);
      continue;
    }

    if (el.matches('article')) {
      scanArticle(el);
      continue;
    }

    el.querySelectorAll(SEL_TWEET_BLOCK).forEach(inject);
    el.querySelectorAll('article').forEach(scanArticle);
  }

  pending.clear();
}

function scheduleFlush() {
  if (rafId) return;
  rafId = requestAnimationFrame(flush);
}

// ── click handler ──────────────────────────────────────────────────────────

document.addEventListener('click', (event) => {
  if (!event.isTrusted) return;

  const btn = event.target.closest('.xvd');
  if (!btn || btn.dataset.busy) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const id = ids.get(btn);
  if (!id) return;

  btn.dataset.busy = '1';
  btn.style.opacity = '.55';
  setButtonVisual(btn, 'default');

  const timeout = setTimeout(() => {
    if (!btn.isConnected) return;
    delete btn.dataset.busy;
    btn.style.opacity = '';
    btn.title = 'Extension did not respond';
    setButtonVisual(btn, 'error');
    resetButtonLater(btn);
  }, 15000);

  const finish = (ok, title) => {
    clearTimeout(timeout);
    if (!btn.isConnected) return;
    delete btn.dataset.busy;
    btn.style.opacity = '';
    btn.title = title;
    setButtonVisual(btn, ok ? 'success' : 'error');
    resetButtonLater(btn);
  };

  if (event.shiftKey) {
    chrome.runtime.sendMessage({ action: 'openPicker', id }, (response) => {
      const ok = !chrome.runtime.lastError && response?.ok;
      finish(
        ok,
        ok
          ? 'Opened quality picker'
          : (response?.err || chrome.runtime.lastError?.message || 'Could not open picker')
      );
    });
    return;
  }

  const wantsSaveAs = event.altKey;
  chrome.runtime.sendMessage({ action: 'download', id, saveAs: wantsSaveAs }, (response) => {
    const ok = !chrome.runtime.lastError && response?.ok;
    finish(
      ok,
      ok
        ? (wantsSaveAs ? 'Save As opened' : 'Download started')
        : (response?.err || chrome.runtime.lastError?.message || 'Download failed')
    );
  });
}, true);

// ── bootstrap ──────────────────────────────────────────────────────────────

document.querySelectorAll('article').forEach(scanArticle);

const SKIP_TAGS = new Set([
  'STYLE', 'SCRIPT', 'LINK', 'META', 'NOSCRIPT',
  'BR', 'HR', 'IMG', 'SVG', 'CANVAS',
  'INPUT', 'TEXTAREA', 'SELECT', 'OPTION',
  'VIDEO', 'SOURCE', 'AUDIO',
]);

const OBSERVER_OPTS = { childList: true, subtree: true };

function handleMutations(mutations) {
  for (const { addedNodes } of mutations) {
    for (const node of addedNodes) {
      if (node.nodeType !== 1) continue;
      if (SKIP_TAGS.has(node.tagName)) continue;
      if (node.classList?.contains('xvd-wrap') || node.classList?.contains('xvd')) continue;
      if (node.closest?.('.xvd-wrap')) continue;

      const block = node.closest?.(SEL_TWEET_BLOCK);
      const article = !block && node.closest?.('article');
      if (block) {
        pending.add(block);
        continue;
      }
      if (article) {
        pending.add(article);
        continue;
      }
      if (node.querySelector?.(SEL_TWEET_BLOCK) || node.querySelector?.('article')) {
        pending.add(node);
      }
    }
  }

  scheduleFlush();
}

const observer = new MutationObserver(handleMutations);

function observeBestTarget() {
  const target = document.querySelector('[data-testid="primaryColumn"]') || document.body;
  if (!target || observedTarget === target) return;

  observer.disconnect();
  observedTarget = target;
  observer.observe(target, OBSERVER_OPTS);
}

observeBestTarget();

setInterval(() => {
  observeBestTarget();

  if (location.href !== lastHref) {
    lastHref = location.href;
    resetAllInjections();
  }
}, URL_POLL_MS);
