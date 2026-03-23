// NOTE: This script MUST run in the ISOLATED world (the default). Running in
// MAIN would expose chrome.runtime to the host page and open XSS vectors.

const CLR_DEFAULT = 'rgb(113,118,123)';
const CLR_SUCCESS = '#00ba7c';
const CLR_ERROR   = '#f4212e';

// --- X.com DOM selectors (fragile — first place to check when things break) --
const SEL_TWEET_LINK  = 'a[href*="/status/"] time';
const SEL_ACTION_BAR  = '[role="group"]:last-of-type';
const SEL_TWEET_BLOCK = '[data-testid="tweet"]';
// -----------------------------------------------------------------------------

const BTN_CSS = `display:flex;align-items:center;justify-content:center;width:34.75px;height:34.75px;border:none;background:none;cursor:pointer;border-radius:50%;color:${CLR_DEFAULT};padding:0`;

const ids     = new WeakMap();   // tweet ID per button (not exposed to page)
const pending = new Set();       // elements queued for injection this frame
const scanned = new WeakMap();   // article → last-known content fingerprint
let rafId     = null;

// ── helpers ────────────────────────────────────────────────────────────────

function createIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.style.cssText = 'width:18px;height:18px;pointer-events:none';
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d',
    'M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1'
    + '-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1z'
    + 'M5 20a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5z');
  svg.appendChild(path);
  return svg;
}

function getTweetId(block) {
  const link = block.querySelector(SEL_TWEET_LINK)?.closest('a');
  return link?.href.match(/\/status\/(\d+)/)?.[1];
}

// ── injection ──────────────────────────────────────────────────────────────

/**
 * Inject a download button into the given tweet block.
 * `block` is typically a [data-testid="tweet"] element whose video,
 * permalink link, and action bar all belong to the same logical tweet.
 */
function inject(block) {
  if (block.querySelector('.xvd') || !block.querySelector('video')) return;
  const id = getTweetId(block);
  if (!id) return;
  const bar = block.querySelector(SEL_ACTION_BAR);
  if (!bar) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'xvd';
  btn.title = 'Download video';
  btn.setAttribute('aria-label', 'Download video');
  ids.set(btn, id);
  btn.style.cssText = BTN_CSS;
  btn.appendChild(createIcon());
  bar.appendChild(btn);
}

/**
 * Fallback when data-testid="tweet" is absent: walk up from the action
 * bar until we find the smallest container that owns both a video and a
 * permalink, then inject there.
 */
const MAX_FALLBACK_DEPTH = 10;

function injectFallback(article) {
  const bar = article.querySelector(SEL_ACTION_BAR);
  if (!bar || article.querySelector('.xvd')) return;
  let container = bar.parentElement;
  let depth = 0;
  // Depth guard: prevent runaway traversal on malformed DOM
  // (normal tweet blocks are ~5-7 levels from action bar to article)
  while (container && container !== article && depth < MAX_FALLBACK_DEPTH) {
    if (container.querySelector('video') && container.querySelector(SEL_TWEET_LINK)) {
      inject(container);
      return;
    }
    container = container.parentElement;
    depth++;
  }
  if (article.querySelector('video') && article.querySelector(SEL_TWEET_LINK)) {
    inject(article);
  }
}

function articleFingerprint(article) {
  const vids = article.querySelectorAll('video');
  if (!vids.length) return 'no-video';
  return Array.from(vids, v =>
    `${v.src || ''}|${v.poster || ''}|${v.querySelectorAll('source').length}`
  ).join(';');
}

function scanArticle(article) {
  const fp = articleFingerprint(article);
  if (scanned.get(article) === fp) return;          // content unchanged — skip
  scanned.set(article, fp);
  article.querySelectorAll('.xvd').forEach(b => b.remove()); // purge stale buttons
  const blocks = article.querySelectorAll(SEL_TWEET_BLOCK);
  if (blocks.length) {
    blocks.forEach(inject);
  } else {
    injectFallback(article);
  }
}

// ── batched mutation observer ──────────────────────────────────────────────

function flush() {
  rafId = null;
  for (const el of pending) {
    if (!el.isConnected) continue;
    if (el.matches(SEL_TWEET_BLOCK)) { inject(el); continue; }
    if (el.matches('article')) {
      scanArticle(el);
      continue;
    }
    el.querySelectorAll(SEL_TWEET_BLOCK).forEach(inject);
    el.querySelectorAll('article').forEach(a => {
      scanArticle(a);
    });
  }
  pending.clear();
}

function scheduleFlush() {
  if (rafId) return;
  rafId = requestAnimationFrame(flush);
}

// ── click handler ──────────────────────────────────────────────────────────

document.addEventListener('click', e => {
  if (!e.isTrusted) return;
  const btn = e.target.closest('.xvd');
  if (!btn || btn.dataset.busy) return;
  e.preventDefault();
  e.stopPropagation();

  const id = ids.get(btn);
  if (!id) return;

  btn.dataset.busy = '1';
  btn.style.opacity = '.4';

  // FIX 5 — safety timeout in case the service worker never responds
  const timer = setTimeout(() => {
    if (!btn.isConnected) return;
    delete btn.dataset.busy;
    btn.style.opacity = '';
    btn.style.color = CLR_ERROR;
    btn.title = 'Service worker did not respond';
    setTimeout(() => {
      if (btn.isConnected) { btn.style.color = CLR_DEFAULT; btn.title = 'Download video'; }
    }, 3000);
  }, 15000);

  chrome.runtime.sendMessage({ action: 'dl', id }, r => {
    clearTimeout(timer);
    if (!btn.isConnected) return;
    delete btn.dataset.busy;
    btn.style.opacity = '';
    const ok = !chrome.runtime.lastError && r?.ok;
    btn.style.color = ok ? CLR_SUCCESS : CLR_ERROR;
    if (!ok) btn.title = r?.err || chrome.runtime.lastError?.message || 'Download failed';
    setTimeout(() => {
      if (btn.isConnected) { btn.style.color = CLR_DEFAULT; btn.title = 'Download video'; }
    }, 3000);
  });
}, true);

// ── bootstrap ──────────────────────────────────────────────────────────────

document.querySelectorAll('article').forEach(scanArticle);

// BUG 4 FIX: Skip leaf/noise elements that can never contain tweets.
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
      const block   = node.closest?.(SEL_TWEET_BLOCK);
      const article = !block && node.closest?.('article');
      if (block)   { pending.add(block);   continue; }
      if (article) { pending.add(article); continue; }
      if (node.querySelector(SEL_TWEET_BLOCK) || node.querySelector('article')) {
        pending.add(node);
      }
    }
  }
  scheduleFlush();
}

const observer = new MutationObserver(handleMutations);

// BUG 4 FIX: Observe primaryColumn instead of document.body to eliminate
// mutation noise from sidebar, DMs, modals. Fallback to body if not ready.
const primaryTarget = document.querySelector('[data-testid="primaryColumn"]');

if (primaryTarget) {
  observer.observe(primaryTarget, OBSERVER_OPTS);
} else {
  observer.observe(document.body, OBSERVER_OPTS);
  // One-time watcher: re-target onto primaryColumn once it appears
  const retarget = new MutationObserver((_, self) => {
    const primary = document.querySelector('[data-testid="primaryColumn"]');
    if (!primary) return;
    self.disconnect();
    observer.disconnect();
    observer.observe(primary, OBSERVER_OPTS);
  });
  retarget.observe(document.body, { childList: true, subtree: true });
}
