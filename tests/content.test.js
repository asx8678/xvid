/**
 * Tests for content.js injection and click handling (jsdom).
 *
 * content.js is a side-effect script with top-level listeners, so it is
 * loaded ONCE in beforeAll and DOM state is reset between tests. The
 * MutationObserver stays live across tests; requestAnimationFrame is
 * stubbed to run synchronously (returning 0 so the schedule guard resets).
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { installChromeMock } from './setup.js';

let chrome;

function createTweetArticle({ tweetId = '1234567890', hasVideo = true } = {}) {
  const article = document.createElement('article');
  const block = document.createElement('div');
  block.setAttribute('data-testid', 'tweet');

  const link = document.createElement('a');
  link.href = `https://x.com/testuser/status/${tweetId}`;
  link.appendChild(document.createElement('time'));
  block.appendChild(link);

  if (hasVideo) {
    const video = document.createElement('video');
    video.src = 'https://video.twimg.com/test.mp4';
    block.appendChild(video);
  }

  const group = document.createElement('div');
  group.setAttribute('role', 'group');
  for (let i = 0; i < 4; i++) {
    const action = document.createElement('div');
    action.appendChild(document.createElement('button'));
    group.appendChild(action);
  }
  block.appendChild(group);

  article.appendChild(block);
  return article;
}

/** Outer tweet without its own media quoting a video tweet (nested block). */
function createQuotedVideoArticle({ outerId = '1111111111', innerId = '2222222222' } = {}) {
  const article = createTweetArticle({ tweetId: outerId, hasVideo: false });
  const outerBlock = article.querySelector('[data-testid="tweet"]');

  const inner = document.createElement('div');
  inner.setAttribute('data-testid', 'tweet');
  const innerLink = document.createElement('a');
  innerLink.href = `https://x.com/original/status/${innerId}`;
  innerLink.appendChild(document.createElement('time'));
  inner.appendChild(innerLink);
  const video = document.createElement('video');
  video.src = 'https://video.twimg.com/quoted.mp4';
  inner.appendChild(video);

  // Quote embeds render before the action bar and have no [role=group] of
  // their own.
  outerBlock.insertBefore(inner, outerBlock.querySelector('[role="group"]'));
  return article;
}

/**
 * dispatchEvent() unsets isTrusted at dispatch start (per spec), so the flag
 * must be re-flipped from inside the dispatch: a capture listener registered
 * BEFORE content.js loads runs first and rewrites jsdom's internal impl flag
 * for events marked with __forceTrusted.
 */
function installTrustedClickHook() {
  document.addEventListener(
    'click',
    (event) => {
      if (!event.__forceTrusted) return;
      const implSymbol = Object.getOwnPropertySymbols(event).find(
        (sym) => sym.description === 'impl'
      );
      event[implSymbol].isTrusted = true;
    },
    true
  );
}

function trustedClick(el, init = {}) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
  event.__forceTrusted = true;
  el.dispatchEvent(event);
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeAll(async () => {
  globalThis.requestAnimationFrame = (cb) => {
    cb();
    return 0;
  };
  globalThis.cancelAnimationFrame = () => {};
  chrome = installChromeMock();
  installTrustedClickHook();
  await import('../content.js');
});

beforeEach(() => {
  document.body.innerHTML = '';
  chrome.__test.__setLastError(null);
});

describe('injection', () => {
  it('adds one download button to video tweets added later', async () => {
    document.body.appendChild(createTweetArticle());
    await tick();

    const buttons = document.querySelectorAll('.xvd');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].closest('[role="group"]')).not.toBeNull();
    expect(buttons[0].getAttribute('aria-label')).toContain('Download video');
    expect(buttons[0].querySelector('svg')).not.toBeNull();
  });

  it('skips tweets without video', async () => {
    document.body.appendChild(createTweetArticle({ hasVideo: false }));
    await tick();
    expect(document.querySelectorAll('.xvd')).toHaveLength(0);
  });

  it('skips blocks without a resolvable tweet link', async () => {
    const article = createTweetArticle();
    article.querySelector('a').remove();
    document.body.appendChild(article);
    await tick();
    expect(document.querySelectorAll('.xvd')).toHaveLength(0);
  });

  it('does not double-inject on later mutations', async () => {
    document.body.appendChild(createTweetArticle());
    await tick();
    document.body.appendChild(document.createElement('span'));
    await tick();
    expect(document.querySelectorAll('.xvd')).toHaveLength(1);
  });

  it('gives quote tweets one button targeting the outer tweet', async () => {
    document.body.appendChild(createQuotedVideoArticle());
    await tick();

    const buttons = document.querySelectorAll('.xvd');
    expect(buttons).toHaveLength(1);

    chrome.runtime.sendMessage = vi.fn((msg, cb) => cb({ ok: true }));
    trustedClick(buttons[0]);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'download', id: '1111111111', saveAs: false },
      expect.any(Function)
    );
  });
});

describe('click handling', () => {
  async function injectedButton() {
    document.body.appendChild(createTweetArticle());
    await tick();
    return document.querySelector('.xvd');
  }

  it('shows busy state, then success', async () => {
    const btn = await injectedButton();
    let respond;
    chrome.runtime.sendMessage = vi.fn((msg, cb) => {
      respond = () => cb({ ok: true });
    });

    trustedClick(btn);
    expect(btn.classList.contains('xvd--busy')).toBe(true);

    respond();
    expect(btn.classList.contains('xvd--busy')).toBe(false);
    expect(btn.classList.contains('xvd--ok')).toBe(true);
    expect(btn.title).toBe('Download started');
  });

  it('sends saveAs on Alt-click', async () => {
    const btn = await injectedButton();
    chrome.runtime.sendMessage = vi.fn((msg, cb) => cb({ ok: true }));

    trustedClick(btn, { altKey: true });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ saveAs: true }),
      expect.any(Function)
    );
    expect(btn.title).toBe('Save As opened');
  });

  it('shows the error reply', async () => {
    const btn = await injectedButton();
    chrome.runtime.sendMessage = vi.fn((msg, cb) => cb({ ok: false, err: 'Boom' }));

    trustedClick(btn);
    expect(btn.classList.contains('xvd--err')).toBe(true);
    expect(btn.title).toBe('Boom');
  });

  it('surfaces runtime.lastError as a failure', async () => {
    const btn = await injectedButton();
    chrome.runtime.sendMessage = vi.fn((msg, cb) => {
      chrome.__test.__setLastError('Receiving end does not exist');
      cb(undefined);
    });

    trustedClick(btn);
    expect(btn.classList.contains('xvd--err')).toBe(true);
    expect(btn.title).toBe('Receiving end does not exist');
  });

  it('ignores clicks while busy and untrusted clicks', async () => {
    const btn = await injectedButton();
    const callbacks = [];
    chrome.runtime.sendMessage = vi.fn((msg, cb) => callbacks.push(cb));

    trustedClick(btn);
    trustedClick(btn);
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); // untrusted
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

    callbacks[0]({ ok: true });
    expect(btn.classList.contains('xvd--ok')).toBe(true);
  });
});

describe('visibility gating', () => {
  const setHidden = (hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  it('does no work while hidden and catches up when visible', async () => {
    setHidden(true);
    document.body.appendChild(createTweetArticle());
    await tick();
    expect(document.querySelectorAll('.xvd')).toHaveLength(0);

    setHidden(false);
    expect(document.querySelectorAll('.xvd')).toHaveLength(1);
  });
});
