// A page just big enough to run content.js's own onActivity and addButton in
// node:vm. It matches only the selectors content.js uses on that path and
// throws on any other, so a changed selector fails the run instead of passing.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const MATCHERS: Record<string, (el: FakeElement) => boolean> = {
  '[data-testid="tweet"]': (el) => el.attrs['data-testid'] === 'tweet',
  '[role="group"]': (el) => el.attrs.role === 'group',
  '[role="button"]': (el) => el.attrs.role === 'button',
  'a[href]': (el) => el.tagName === 'A' && 'href' in el.attrs,
  button: (el) => el.tagName === 'BUTTON',
  video: (el) => el.tagName === 'VIDEO',
};

export class FakeElement {
  tagName: string;
  attrs: Record<string, string>;
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  className = '';
  title = '';
  type = '';
  innerHTML = '';

  constructor(tag: string, attrs: Record<string, string> = {}) {
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
  }

  setAttribute(name: string, value: string) {
    this.attrs[name] = value;
  }

  appendChild(child: FakeElement) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  replaceWith(next: FakeElement) {
    const parent = this.parentElement!;
    parent.children[parent.children.indexOf(this)] = next;
    next.parentElement = parent;
    this.parentElement = null;
  }

  matches(selector: string): boolean {
    return selector.split(',').some((part) => {
      const matcher = MATCHERS[part.trim()];
      if (!matcher) throw new Error(`fake DOM: no matcher for selector "${part.trim()}"`);
      return matcher(this);
    });
  }

  closest(selector: string) {
    for (let el: FakeElement | null = this; el; el = el.parentElement) {
      if (el.matches(selector)) return el;
    }
    return null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const found: FakeElement[] = [];
    const walk = (el: FakeElement) => {
      for (const child of el.children) {
        if (child.matches(selector)) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

const source = new vm.Script(readFileSync(new URL('../content.js', import.meta.url), 'utf8'), {
  filename: 'content.js',
});

// A fresh copy of the shipped content.js, its listeners and its private state.
export function loadContentScript() {
  const listeners = new Map<string, (event: object) => void>();
  const document = {
    addEventListener: (type: string, listener: (event: object) => void) =>
      listeners.set(type, listener),
    createElement: (tag: string) => new FakeElement(tag),
  };
  const context = vm.createContext({
    document,
    Element: FakeElement,
    setTimeout: () => 0,
    clearTimeout: () => {},
  });
  source.runInContext(context);

  const buttons: WeakSet<FakeElement> = vm.runInContext('buttons', context);
  const addButton = context.addButton;
  let checks = 0;
  // onActivity calls addButton through the global binding, so this counts the
  // posts each event checks.
  context.addButton = (post: FakeElement) => {
    checks++;
    addButton(post);
  };

  return {
    // Delivers one event as the page would; returns how many posts it checked.
    fire(type: string, target: FakeElement) {
      checks = 0;
      listeners.get(type)!({ type, target });
      return checks;
    },
    lastPost: (): FakeElement | null => vm.runInContext('lastPost', context),
    isOurs: (el: FakeElement) => buttons.has(el),
  };
}
