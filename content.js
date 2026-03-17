const CLR_DEFAULT = 'rgb(113,118,123)';
const CLR_SUCCESS = '#00ba7c';
const CLR_ERROR   = '#f4212e';

const BTN_CSS = `display:flex;align-items:center;justify-content:center;width:34.75px;height:34.75px;border:none;background:none;cursor:pointer;border-radius:50%;color:${CLR_DEFAULT};padding:0`;

function createIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.style.cssText = 'width:18px;height:18px;pointer-events:none';
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1zM5 20a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5z');
  svg.appendChild(path);
  return svg;
}

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
  btn.title = 'Download video';
  btn.dataset.id = id;
  btn.style.cssText = BTN_CSS;
  btn.appendChild(createIcon());
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
    if (!btn.isConnected) return;
    delete btn.dataset.busy;
    btn.style.opacity = '';
    btn.style.color = (!chrome.runtime.lastError && r?.ok) ? CLR_SUCCESS : CLR_ERROR;
    setTimeout(() => { if (btn.isConnected) btn.style.color = CLR_DEFAULT; }, 3000);
  });
}, true);

document.querySelectorAll('article').forEach(inject);
new MutationObserver(mutations => {
  for (const { addedNodes } of mutations) {
    for (const node of addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.tagName === 'ARTICLE') { inject(node); continue; }
      node.querySelectorAll('article').forEach(inject);
      const a = node.closest('article');
      if (a) inject(a);
    }
  }
}).observe(document.body, { childList: true, subtree: true });
