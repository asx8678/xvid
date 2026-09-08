const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

// Model tests deliberately do not load resources or use a real Chrome profile.
function contentFixture(t) {
  const dom = new JSDOM(
    '<!doctype html><style>' +
      fs.readFileSync(path.join(__dirname, '..', 'content.css'), 'utf8') +
      '</style><main></main>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.invalid/' }
  );
  t.after(() => dom.window.close());
  const window = dom.window;
  const document = window.document;
  const messages = [];
  const timers = new Map();
  let now = 1_000_000;
  let nextTimer = 0;
  let clickHandler;
  window.Date.now = () => now;
  window.setTimeout = (fn, delay = 0) => {
    const id = ++nextTimer;
    timers.set(id, { fn, at: now + delay });
    return id;
  };
  window.clearTimeout = (id) => timers.delete(id);
  window.fetch =
    window.XMLHttpRequest =
    window.WebSocket =
      () => {
        throw new Error('Network is forbidden in synthetic tests');
      };
  // jsdom has no layout. This models only display:none ancestry for canary tests.
  Object.defineProperty(window.HTMLElement.prototype, 'offsetParent', {
    get() {
      if (!this.isConnected) return null;
      for (let element = this; element; element = element.parentElement) {
        if (window.getComputedStyle(element).display === 'none') return null;
      }
      return this.parentElement;
    },
  });
  window.chrome = {
    runtime: {
      sendMessage(message, callback) {
        messages.push({ message, callback });
        if (message.action === 'adMarkerRot') callback();
      },
    },
  };
  const addEventListener = document.addEventListener.bind(document);
  document.addEventListener = (type, handler, options) => {
    if (type === 'click') clickHandler = handler;
    addEventListener(type, handler, options);
  };
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8'),
    dom.getInternalVMContext(),
    { filename: 'content.js', timeout: 1_000 }
  );
  async function advance(ms = 250) {
    await Promise.resolve();
    const end = now + ms;
    for (let steps = 0; steps < 1_000; steps++) {
      const due = [...timers].filter(([, timer]) => timer.at <= end);
      if (!due.length) {
        now = end;
        await Promise.resolve();
        return;
      }
      due.sort((a, b) => a[1].at - b[1].at);
      const [id, timer] = due[0];
      now = timer.at;
      timers.delete(id);
      timer.fn();
      await Promise.resolve();
    }
    throw new Error('Timer work did not settle within 1,000 callbacks');
  }
  function tweet(id, { bar = true, video = true } = {}) {
    const block = document.createElement('article');
    block.dataset.testid = 'tweet';
    const header = document.createElement('header');
    const link = document.createElement('a');
    link.href = 'https://x.com/synthetic/status/' + id;
    link.append(document.createElement('time'));
    header.append(link);
    block.append(header);
    if (video) block.append(document.createElement('video'));
    if (bar) block.append(actionBar());
    return block;
  }
  function actionBar() {
    const bar = document.createElement('div');
    bar.setAttribute('role', 'group');
    for (let i = 0; i < 4; i++) bar.append(document.createElement('button'));
    return bar;
  }
  function adCell() {
    const cell = document.createElement('div');
    cell.dataset.testid = 'cellInnerDiv';
    const block = document.createElement('article');
    block.dataset.testid = 'tweet';
    const label = document.createElement('span');
    label.textContent = 'Ad';
    block.append(label);
    cell.append(block);
    return cell;
  }
  return {
    window,
    document,
    messages,
    advance,
    tweet,
    actionBar,
    adCell,
    mount: (node) => document.querySelector('main').append(node),
    click(button, { altKey = false, trusted = true } = {}) {
      // Calls the captured handler; it does not establish native trusted input.
      clickHandler({
        isTrusted: trusted,
        target: button,
        altKey,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {},
      });
    },
    hide(hidden) {
      Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
      document.dispatchEvent(new window.Event('visibilitychange'));
    },
  };
}

module.exports = { contentFixture };
