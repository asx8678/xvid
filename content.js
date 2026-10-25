// Runs in the ISOLATED world (set in the manifest). Running in MAIN would
// expose chrome.runtime to the host page. Button styling lives in content.css.
//
// Nothing runs while you browse: no MutationObserver, timers or page scans.
// A video post gets its button only when the pointer or keyboard focus enters
// it or its video starts playing, and the tweet ID is read when it's clicked.

// --- X.com DOM selectors (fragile — first place to check when things break) --
// One post. A post quoted inside it matches too, so code checks ownership
// with closest() before trusting a link or a row.
const SEL_TWEET = '[data-testid="tweet"]';
// Any link to a post (photo/video links carry the post's ID too).
const SEL_TWEET_LINK = 'a[href*="/status/"], a[href*="/statuses/"]';
// The timestamp link: the post's own permalink, tried before any other link.
const SEL_TIMED_LINK = 'a[href*="/status/"]:has(time), a[href*="/statuses/"]:has(time)';
// The reply/repost/like row is a role="group"; some other widgets are too.
const SEL_GROUP = '[role="group"]';
// Controls in that row: four or more tell it apart from other groups.
const SEL_ACTION = 'button, [role="button"], a[href]';
// X plays both videos and GIFs in a <video>; only such posts get a button.
const SEL_VIDEO = 'video';
// -----------------------------------------------------------------------------

const IDLE_TITLE = 'Download video (Alt/Option-click for Save As)';
const IDLE_LABEL = 'Download video. Alt or Option-click opens Save As.';
const RESULT_MS = 3000;
const buttons = new WeakSet(); // our buttons (page elements can't forge membership)
const resetTimers = new WeakMap();
let lastPost = null;

// Fixed literal, safe for innerHTML: x.com serves no trusted-types CSP
// directives, and Chrome ≥130 exempts isolated worlds from page CSP anyway.
// Sized by its own attributes, so no stylesheet rule is ever tested against
// X's own icons.
const ICON_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" pointer-events="none"><path d="M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1zM5 20a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5z"/></svg>';

// The post's own permalink (timestamp link first); a nested quote's links
// belong to the quote.
function getTweetId(post) {
  for (const selector of [SEL_TIMED_LINK, SEL_TWEET_LINK]) {
    for (const link of post.querySelectorAll(selector)) {
      if (link.closest(SEL_TWEET) !== post) continue;
      const id = link.href.match(/\/status(?:es)?\/(\d+)/)?.[1];
      if (id) return id;
    }
  }
  return null;
}

// The post's own reply/repost/like bar, never a nested quote's.
function findActionBar(post) {
  const groups = post.querySelectorAll(SEL_GROUP);
  let fallback = null;
  for (let index = groups.length - 1; index >= 0; index--) {
    const group = groups[index];
    if (group.closest(SEL_TWEET) !== post) continue;
    fallback ??= group;
    if (group.children.length >= 4 && group.querySelectorAll(SEL_ACTION).length >= 4) {
      return group;
    }
  }
  return fallback;
}

function addButton(post) {
  if (!post.querySelector(SEL_VIDEO)) return;
  const bar = findActionBar(post);
  if (!bar || [...bar.children].some((child) => buttons.has(child))) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'xvd';
  btn.title = IDLE_TITLE;
  btn.setAttribute('aria-label', IDLE_LABEL);
  btn.innerHTML = ICON_SVG;
  buttons.add(btn);
  bar.appendChild(btn);
}

function onActivity(event) {
  const post = event.target instanceof Element ? event.target.closest(SEL_TWEET) : null;
  // Pointer and focus moves inside one post fire many events; its first entry
  // is enough. A video (re)starting checks only its own post and leaves this
  // alone, so X replaying short videos never causes extra checks.
  if (event.type !== 'play') {
    if (post === lastPost) return;
    lastPost = post;
  }
  // Outer posts too: a quoted video also gives the post quoting it a button.
  for (let p = post; p; p = p.parentElement?.closest(SEL_TWEET)) addButton(p);
}

// busy → ok/part/err → idle. Clicks are ignored while busy, so a reply always
// belongs to the current attempt. part: some of several videos were saved.
function setState(btn, state, title) {
  clearTimeout(resetTimers.get(btn));
  btn.classList.remove('xvd--busy', 'xvd--ok', 'xvd--part', 'xvd--err');
  if (state) btn.classList.add(`xvd--${state}`);
  btn.title = title;
  // Screen readers get the same status the tooltip shows.
  btn.setAttribute('aria-label', state ? title : IDLE_LABEL);
  if (state && state !== 'busy') {
    resetTimers.set(
      btn,
      setTimeout(() => setState(btn, '', IDLE_TITLE), RESULT_MS)
    );
  }
}

function onClick(event) {
  if (!event.isTrusted) return;
  const btn = event.target instanceof Element ? event.target.closest('.xvd') : null;
  if (!btn || !buttons.has(btn)) return;

  event.preventDefault();
  event.stopImmediatePropagation(); // keep X from opening the post
  if (btn.classList.contains('xvd--busy')) return;

  // Read now, so reused post markup can never send a stale ID.
  const id = getTweetId(btn.closest(SEL_TWEET));
  if (!id) {
    setState(btn, 'err', 'Could not find the post link');
    return;
  }

  const saveAs = event.altKey;
  setState(btn, 'busy', 'Downloading…');
  try {
    chrome.runtime.sendMessage({ action: 'download', id, saveAs }, (response) => {
      const error = chrome.runtime.lastError; // reading it also silences Chrome's warning
      if (!error && response?.ok) {
        setState(btn, 'ok', saveAs ? 'Save As opened' : 'Download started');
      } else {
        // Red only when nothing was saved; amber when some videos were.
        setState(
          btn,
          !error && response?.saved > 0 ? 'part' : 'err',
          response?.err || error?.message || 'Download failed'
        );
      }
    });
  } catch {
    // Throws synchronously once the extension was reloaded under this page.
    setState(btn, 'err', 'Extension was updated. Reload this page.');
  }
}

document.addEventListener('click', onClick, true);
for (const type of ['pointerover', 'focusin', 'play']) {
  // Capture phase: 'play' doesn't bubble, but capturing listeners still see it.
  document.addEventListener(type, onActivity, { capture: true, passive: true });
}
