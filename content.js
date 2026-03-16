const ICON = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px"><path d="M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1zM5 20a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5z"/></svg>';

const CLR_DEFAULT = 'rgb(113,118,123)';
const CLR_SUCCESS = '#00ba7c';
const CLR_ERROR   = '#f4212e';

const BTN_CSS = `display:flex;align-items:center;justify-content:center;width:34.75px;height:34.75px;border:none;background:none;cursor:pointer;border-radius:50%;color:${CLR_DEFAULT};padding:0`;

function getTweetId(article) {
  const link = article.querySelector('a[href*="/status/"] time')?.closest('a');
  return link?.href.match(/\/status\/(\d+)/)?.[1];
}

function inject(article) {
  if (article.querySelector('.xvd') || !article.querySelector('video')) return;
  const id = getTweetId(article);
  if (!id) return;
  const bar = article.querySelector('[role="group"]:last-of-type');
  if (!bar) return;
  const btn = document.createElement('button');
  btn.className = 'xvd';
  btn.dataset.id = id;
  const svg = new DOMParser().parseFromString(ICON, 'image/svg+xml').documentElement;
  btn.appendChild(svg);
  btn.style.cssText = BTN_CSS;
  bar.appendChild(btn);
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.xvd');
  if (!btn || btn.dataset.busy) return;
  e.preventDefault();
  e.stopPropagation();
  btn.dataset.busy = '1';
  btn.style.opacity = '.4';
  chrome.runtime.sendMessage({ action: 'dl', id: btn.dataset.id }, r => {
    delete btn.dataset.busy;
    btn.style.opacity = '';
    btn.style.color = (!chrome.runtime.lastError && r?.ok) ? CLR_SUCCESS : CLR_ERROR;
    setTimeout(() => { btn.style.color = CLR_DEFAULT; }, 3000);
  });
}, true);

let pending = false;
function scanNodes(root) {
  if (root.nodeType !== 1) return;
  if (root.matches('article')) { inject(root); return; }
  root.querySelectorAll?.('article')?.forEach(inject);
}

document.querySelectorAll('article').forEach(inject);
new MutationObserver(mutations => {
  if (!pending) {
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      for (const m of mutations)
        for (const node of m.addedNodes) scanNodes(node);
    });
  }
}).observe(document.body, { childList: true, subtree: true });
