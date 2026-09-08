const test = require('node:test');
const assert = require('node:assert/strict');
const { contentFixture } = require('./content-fixture.cjs');

test('late responses cannot settle a newer attempt after a timeout', async (t) => {
  const f = contentFixture(t);
  f.mount(f.tweet('1111111111'));
  await f.advance();
  const button = f.document.querySelector('.xvd');
  f.click(button);
  const first = f.messages.at(-1);
  await f.advance(15_000);
  assert.equal(button.title, 'Extension did not respond');
  f.click(button);
  const second = f.messages.at(-1);
  first.callback({ ok: true });
  assert.ok(button.classList.contains('xvd--busy'));
  second.callback({ ok: false, err: 'Current request failed' });
  assert.equal(button.title, 'Current request failed');
  await f.advance(3_000);
  assert.match(button.title, /^Download video/);
});

test('a timed-out reply is ignored without a retry; Save As has no UI deadline', async (t) => {
  const f = contentFixture(t);
  f.mount(f.tweet('1111111111'));
  await f.advance();
  const button = f.document.querySelector('.xvd');
  f.click(button);
  const first = f.messages.at(-1);
  await f.advance(15_000);
  first.callback({ ok: true });
  assert.equal(button.title, 'Extension did not respond');
  f.click(button, { altKey: true });
  const save = f.messages.at(-1);
  assert.equal(save.message.saveAs, true);
  await f.advance(30_000);
  assert.ok(button.classList.contains('xvd--busy'));
  save.callback({ ok: true });
  assert.equal(button.title, 'Save As opened');
});

test('retained post identity is reconciled on href changes and again at click time', async (t) => {
  const f = contentFixture(t);
  const block = f.tweet('1111111111');
  f.mount(block);
  await f.advance();
  const button = block.querySelector('.xvd');
  block.querySelector('a').href = 'https://x.com/synthetic/status/2222222222';
  await f.advance();
  f.click(button);
  assert.equal(f.messages.at(-1).message.id, '2222222222');
  const old = f.messages.at(-1);
  block.querySelector('a').href = 'https://x.com/synthetic/status/3333333333';
  // Click before MutationObserver delivery: a retained control must still be fresh.
  f.click(button);
  assert.equal(f.messages.at(-1).message.id, '3333333333');
  old.callback({ ok: true });
  assert.ok(button.classList.contains('xvd--busy'));
  f.messages.at(-1).callback({ ok: false, err: 'New post failed' });
  assert.equal(button.title, 'New post failed');
});

test('removing video removes its old actionable control and invalidates replies', async (t) => {
  const f = contentFixture(t);
  const block = f.tweet('1111111111');
  f.mount(block);
  await f.advance();
  const button = block.querySelector('.xvd');
  f.click(button);
  const request = f.messages.at(-1);
  block.querySelector('video').remove();
  await f.advance();
  assert.equal(block.querySelector('.xvd'), null);
  request.callback({ ok: true });
  f.click(button);
  assert.equal(f.messages.length, 1);
});

for (const innerFirst of [false, true]) {
  test(
    'partial nested action bars retain correct ownership; inner first: ' + innerFirst,
    async (t) => {
      const f = contentFixture(t);
      const outer = f.tweet('1111111111', { bar: false, video: false });
      const inner = f.tweet('2222222222');
      if (innerFirst) {
        f.mount(outer);
        await f.advance();
        outer.append(inner);
      } else {
        outer.append(inner);
        f.mount(outer);
      }
      await f.advance();
      for (let n = 0; n < 3; n++) {
        outer.append(f.document.createElement('span'));
        await f.advance();
      }
      assert.equal(inner.querySelectorAll('.xvd').length, 1);
      f.click(inner.querySelector('.xvd'));
      assert.equal(f.messages.at(-1).message.id, '2222222222');
      f.messages.at(-1).callback({ ok: true });
      const bar = f.actionBar();
      outer.append(bar);
      await f.advance();
      assert.equal(bar.querySelectorAll('.xvd').length, 1);
      assert.equal(inner.querySelectorAll('.xvd').length, 1);
      f.click(bar.querySelector('.xvd'));
      assert.equal(f.messages.at(-1).message.id, '1111111111');
    }
  );
}

test('an outer post without its own permalink waits instead of borrowing its quote ID', async (t) => {
  const f = contentFixture(t);
  const outer = f.tweet('1111111111', { video: false });
  outer.querySelector('header').remove();
  const inner = f.tweet('2222222222');
  outer.prepend(inner);
  f.mount(outer);
  await f.advance();
  const outerBar = outer.lastElementChild;
  assert.equal(outerBar.querySelector('.xvd'), null);
  outer.prepend(f.tweet('1111111111').querySelector('header'));
  await f.advance();
  f.click(outerBar.querySelector('.xvd'));
  assert.equal(f.messages.at(-1).message.id, '1111111111');
});

test('fallback-hidden ad cells reveal organic replacements while preserving host styles', async (t) => {
  const f = contentFixture(t);
  await f.advance(5_000);
  const cell = f.adCell();
  cell.style.display = 'flex';
  f.mount(cell);
  await f.advance();
  assert.equal(f.window.getComputedStyle(cell).display, 'none');
  cell.replaceChildren(f.tweet('2222222222'));
  await f.advance();
  assert.equal(f.window.getComputedStyle(cell).display, 'flex');
  assert.equal(cell.style.display, 'flex');

  const other = f.adCell();
  f.mount(other);
  await f.advance(5_000);
  // The canary is opportunistic: a mutation triggers the next due scan.
  other.append(f.document.createElement('span'));
  await f.advance();
  assert.equal(f.window.getComputedStyle(other).display, 'none');
  other.style.display = 'none';
  other.replaceChildren(f.tweet('3333333333'));
  await f.advance();
  assert.equal(f.window.getComputedStyle(other).display, 'none');
  assert.equal(other.style.display, 'none');
});

test('fallback hiding reconciles text-only reuse even before the next canary scan', async (t) => {
  const f = contentFixture(t);
  await f.advance(5_000);
  const cell = f.adCell();
  f.mount(cell);
  await f.advance();
  assert.equal(f.window.getComputedStyle(cell).display, 'none');
  cell.querySelector('span').firstChild.data = 'Organic author';
  await f.advance();
  assert.notEqual(f.window.getComputedStyle(cell).display, 'none');

  const next = f.adCell();
  f.mount(next);
  await f.advance(5_000);
  next.append(f.document.createElement('span'));
  await f.advance();
  assert.equal(f.window.getComputedStyle(next).display, 'none');
  next.replaceChildren(f.document.createTextNode('Organic non-post content'));
  await f.advance();
  assert.notEqual(f.window.getComputedStyle(next).display, 'none');
});

test('batch discovery, removed control recovery and visibility resume preserve one button', async (t) => {
  const f = contentFixture(t);
  const fragment = f.document.createDocumentFragment();
  for (const id of ['1111111111', '2222222222', '3333333333']) fragment.append(f.tweet(id));
  f.mount(fragment);
  await f.advance();
  assert.equal(f.document.querySelectorAll('.xvd').length, 3);
  f.document.querySelector('.xvd').remove();
  await f.advance();
  assert.equal(f.document.querySelectorAll('.xvd').length, 3);
  f.hide(true);
  f.mount(f.tweet('4444444444'));
  await f.advance();
  assert.equal(f.document.querySelectorAll('.xvd').length, 3);
  f.hide(false);
  await f.advance();
  assert.equal(f.document.querySelectorAll('.xvd').length, 4);
});

test('page-owned classes and untrusted clicks are ignored; busy clicks do not duplicate requests', async (t) => {
  const f = contentFixture(t);
  const block = f.tweet('1111111111');
  const foreign = f.document.createElement('button');
  foreign.className = 'xvd';
  block.append(foreign);
  f.mount(block);
  await f.advance();
  assert.equal(block.querySelectorAll('.xvd').length, 2);
  const button = block.querySelector('[role=group] .xvd');
  assert.equal(button.tagName, 'BUTTON');
  assert.match(button.getAttribute('aria-label'), /Download video/);
  f.click(foreign);
  f.click(button, { trusted: false });
  assert.equal(f.messages.length, 0);
  f.click(button);
  f.click(button);
  assert.equal(f.messages.length, 1);
});

test('CSS hides marked ads without hiding an organic sidebar sibling', async (t) => {
  const f = contentFixture(t);
  const cell = f.adCell();
  cell.firstElementChild.dataset.testid = 'placementTracking';
  const sidebar = f.document.createElement('aside');
  sidebar.dataset.testid = 'sidebarColumn';
  const ad = f.document.createElement('div');
  ad.dataset.testid = 'placementTracking';
  const organic = f.document.createElement('div');
  sidebar.append(ad, organic);
  f.mount(cell);
  f.mount(sidebar);
  await f.advance();
  assert.equal(f.window.getComputedStyle(cell).display, 'none');
  assert.equal(f.window.getComputedStyle(ad).display, 'none');
  assert.notEqual(f.window.getComputedStyle(organic).display, 'none');
});
