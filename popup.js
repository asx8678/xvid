const DEFAULT_QUALITY = 'best';
const QUALITY_ORDER = ['best', 'medium', 'small'];

const form = document.getElementById('lookup-form');
const input = document.getElementById('tweet-input');
const analyzeBtn = document.getElementById('analyze-btn');
const prefQuality = document.getElementById('pref-quality');
const promptSaveAs = document.getElementById('prompt-saveas');
const statusEl = document.getElementById('status');
const resultCard = document.getElementById('result-card');
const resultTitle = document.getElementById('result-title');
const resultBadge = document.getElementById('result-badge');
const postOwner = document.getElementById('post-owner');
const postText = document.getElementById('post-text');
const mediaSelectWrap = document.getElementById('media-select-wrap');
const mediaSelect = document.getElementById('media-select');
const variantSelect = document.getElementById('variant-select');
const filenamePreview = document.getElementById('filename-preview');
const permalink = document.getElementById('permalink');
const downloadBtn = document.getElementById('download-btn');
const saveAsBtn = document.getElementById('saveas-btn');
const downloadAllBtn = document.getElementById('download-all-btn');
const copyUrlBtn = document.getElementById('copy-url-btn');
const mediaPreview = document.getElementById('media-preview');
const mediaThumbnail = document.getElementById('media-thumbnail');
const mediaDuration = document.getElementById('media-duration');

const state = {
  tweetId: '',
  permalink: '',
  screenName: '',
  displayName: '',
  text: '',
  mediaItems: [],
  mediaIndex: 0,
};

init().catch((err) => {
  setStatus(getErrorMessage(err), 'error');
});

async function init() {
  bindEvents();

  const stored = await chrome.storage.sync.get({
    defaultQuality: DEFAULT_QUALITY,
    promptSaveAs: false,
  });

  prefQuality.value = QUALITY_ORDER.includes(stored.defaultQuality)
    ? stored.defaultQuality
    : DEFAULT_QUALITY;
  promptSaveAs.checked = Boolean(stored.promptSaveAs);
  updateDownloadLabels();

  const params = new URLSearchParams(window.location.search);
  const initialTweet = params.get('tweet') || '';
  const initialMedia = parseMediaIndex(params.get('media'));
  if (initialTweet) {
    input.value = initialTweet;
    await analyze(initialTweet, initialMedia);
    return;
  }

  await tryPrefillFromActiveTab();
}

function bindEvents() {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await analyze(input.value, state.mediaIndex);
  });

  prefQuality.addEventListener('change', async () => {
    const value = QUALITY_ORDER.includes(prefQuality.value) ? prefQuality.value : DEFAULT_QUALITY;
    await chrome.storage.sync.set({ defaultQuality: value });
    updateCurrentMediaView();
    setStatus('Saved inline-button quality preference.', 'ok');
  });

  promptSaveAs.addEventListener('change', async () => {
    await chrome.storage.sync.set({ promptSaveAs: promptSaveAs.checked });
    updateDownloadLabels();
    setStatus(
      promptSaveAs.checked
        ? 'Files will now open a Save As dialog before downloading.'
        : 'Files will now download directly with no Save As dialog.',
      'ok'
    );
  });

  mediaSelect.addEventListener('change', () => {
    updateCurrentMediaView(parseMediaIndex(mediaSelect.value));
  });

  variantSelect.addEventListener('change', updateSelectionPreview);

  downloadBtn.addEventListener('click', async () => {
    await triggerDownload(promptSaveAs.checked);
  });

  saveAsBtn.addEventListener('click', async () => {
    await triggerDownload(true);
  });

  downloadAllBtn.addEventListener('click', async () => {
    await triggerDownloadAll(promptSaveAs.checked);
  });

  copyUrlBtn.addEventListener('click', async () => {
    const value = variantSelect.value;
    if (!value) return;

    try {
      await copyToClipboard(value);
      setStatus('Copied selected direct MP4 URL to the clipboard.', 'ok');
    } catch (err) {
      setStatus(`Could not copy the MP4 URL: ${getErrorMessage(err)}`, 'error');
    }
  });
}

async function tryPrefillFromActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const active = tabs[0];
    const currentUrl = typeof active?.url === 'string' ? active.url : '';
    const detected = extractTweetId(currentUrl);
    if (!detected) {
      setStatus('Paste a post URL or open an X/Twitter post, then click Analyze.', '');
      return;
    }

    input.value = currentUrl;
    await analyze(currentUrl, 0);
  } catch {
    setStatus('Paste a post URL or status ID to begin.', '');
  }
}

async function analyze(rawInput, preferredMediaIndex = 0) {
  const value = String(rawInput || '').trim();
  if (!value) {
    clearResult();
    setStatus('Paste a valid X/Twitter post URL or a numeric status ID.', 'error');
    return;
  }

  const response = await withBusy('Analyzing post…', () => sendRuntimeMessage({
    action: 'probe',
    input: value,
    mediaIndex: parseMediaIndex(preferredMediaIndex),
  }));

  if (!response?.ok) {
    clearResult();
    setStatus(response?.err || 'Could not inspect that post.', 'error');
    return;
  }

  state.tweetId = response.tweetId;
  state.permalink = response.permalink || '';
  state.screenName = response.screenName || '';
  state.displayName = response.displayName || response.user || '';
  state.text = response.text || '';
  state.mediaItems = Array.isArray(response.mediaItems) ? response.mediaItems : [];
  state.mediaIndex = parseMediaIndex(response.selectedMediaIndex);

  renderResult();

  const count = state.mediaItems.length;
  const owner = state.screenName
    ? ` @${state.screenName}`
    : (state.displayName ? ` ${state.displayName}` : '');
  setStatus(
    `Found ${count} downloadable media item${count === 1 ? '' : 's'} for${owner} / ${response.tweetId}.`,
    'ok'
  );
}

function renderResult() {
  resultCard.hidden = false;

  const ownerLabel = state.screenName
    ? `@${state.screenName}${state.displayName ? ` • ${state.displayName}` : ''}`
    : state.displayName;
  postOwner.textContent = ownerLabel || '';

  if (state.text) {
    postText.hidden = false;
    postText.textContent = state.text;
  } else {
    postText.hidden = true;
    postText.textContent = '';
  }

  permalink.href = state.permalink || '#';
  permalink.textContent = state.permalink ? 'Open post' : 'Post unavailable';

  mediaSelect.innerHTML = '';
  for (const item of state.mediaItems) {
    const option = document.createElement('option');
    option.value = String(item.index);
    option.textContent = item.label;
    mediaSelect.appendChild(option);
  }

  mediaSelectWrap.hidden = state.mediaItems.length <= 1;
  downloadAllBtn.hidden = state.mediaItems.length <= 1;
  updateCurrentMediaView(state.mediaIndex);
}

function updateCurrentMediaView(preferredIndex = state.mediaIndex) {
  const mediaItem = getCurrentMedia(preferredIndex);
  if (!mediaItem) {
    clearResult();
    return;
  }

  state.mediaIndex = mediaItem.index;
  mediaSelect.value = String(mediaItem.index);
  resultTitle.textContent = mediaItem.mediaType === 'animated_gif'
    ? 'Animated GIF variants'
    : 'Video variants';
  resultBadge.textContent = `${mediaItem.variants.length} option${mediaItem.variants.length === 1 ? '' : 's'}`;

  variantSelect.innerHTML = '';
  for (const variant of mediaItem.variants) {
    const option = document.createElement('option');
    option.value = variant.url;
    option.textContent = variant.label;
    option.dataset.filename = variant.filename;
    variantSelect.appendChild(option);
  }

  const preferred = pickPreferredVariantUrl(mediaItem.variants, prefQuality.value);
  if (preferred) {
    variantSelect.value = preferred;
  }
  if (!variantSelect.value && mediaItem.variants[0]) {
    variantSelect.value = mediaItem.variants[0].url;
  }

  renderMediaPreview(mediaItem);
  updateSelectionPreview();
  updateDownloadLabels();
}

function updateSelectionPreview() {
  const option = variantSelect.selectedOptions[0];
  filenamePreview.textContent = option?.dataset.filename || '—';
}

function renderMediaPreview(mediaItem) {
  const hasThumbnail = typeof mediaItem.thumbnailUrl === 'string' && mediaItem.thumbnailUrl.startsWith('https://');
  const hasDuration = typeof mediaItem.durationLabel === 'string' && mediaItem.durationLabel !== '';

  if (!hasThumbnail && !hasDuration) {
    mediaPreview.hidden = true;
    return;
  }

  mediaPreview.hidden = false;

  if (hasThumbnail) {
    mediaThumbnail.hidden = false;
    mediaThumbnail.src = mediaItem.thumbnailUrl;
    const kind = mediaItem.mediaType === 'animated_gif' ? 'Animated GIF' : 'Video';
    const ordinal = state.mediaItems.length > 1 ? ` ${mediaItem.index + 1}` : '';
    mediaThumbnail.alt = `Thumbnail for ${kind}${ordinal}`;
  } else {
    mediaThumbnail.hidden = true;
    mediaThumbnail.src = '';
    mediaThumbnail.alt = '';
  }

  if (hasDuration) {
    mediaDuration.hidden = false;
    mediaDuration.textContent = mediaItem.durationLabel;
    mediaDuration.setAttribute('aria-label', `Duration: ${mediaItem.durationLabel}`);
  } else {
    mediaDuration.textContent = '';
    mediaDuration.removeAttribute('aria-label');
    mediaDuration.hidden = true;
  }
}

async function triggerDownload(saveAs) {
  if (!state.tweetId || !variantSelect.value) {
    setStatus('Analyze a post and choose an MP4 variant first.', 'error');
    return;
  }

  const openingSaveAs = Boolean(saveAs);
  const response = await withBusy(openingSaveAs ? 'Opening Save As…' : 'Starting download…', () => sendRuntimeMessage({
    action: 'download',
    tweetId: state.tweetId,
    mediaIndex: state.mediaIndex,
    variantUrl: variantSelect.value,
    qualityPref: prefQuality.value,
    saveAs: openingSaveAs,
  }));

  if (!response?.ok) {
    setStatus(response?.err || 'Could not start the download.', 'error');
    return;
  }

  setStatus(
    openingSaveAs
      ? `Save As opened for: ${response.filename}`
      : `Download started: ${response.filename}`,
    'ok'
  );
}

async function triggerDownloadAll(saveAs) {
  if (!state.tweetId || state.mediaItems.length <= 1) {
    setStatus('This post only has one downloadable media item.', 'error');
    return;
  }

  const openingSaveAs = Boolean(saveAs);
  const response = await withBusy(openingSaveAs ? 'Opening Save As dialogs…' : 'Starting all downloads…', () => sendRuntimeMessage({
    action: 'downloadAll',
    tweetId: state.tweetId,
    qualityPref: prefQuality.value,
    saveAs: openingSaveAs,
  }));

  if (!response?.ok) {
    setStatus(response?.err || 'Could not start the downloads.', 'error');
    return;
  }

  const failed = Array.isArray(response.errors) ? response.errors.length : 0;
  const deduped = Number.isFinite(response.dedupedCount) ? response.dedupedCount : 0;
  const fresh = Math.max(response.count - deduped, 0);

  const parts = [];
  if (openingSaveAs) {
    parts.push(`Save As opened for ${response.count} of ${response.requested} media items.`);
  } else {
    parts.push(`Started ${fresh} of ${response.requested} downloads.`);
  }
  if (deduped > 0) {
    parts.push(`${deduped} ${deduped === 1 ? 'was' : 'were'} already in progress.`);
  }
  if (failed > 0) {
    const firstErr = response.errors.find((entry) => entry && entry.err);
    const detail = firstErr
      ? `Media ${(firstErr.mediaIndex ?? 0) + 1}: ${firstErr.err}`
      : 'Some items failed.';
    parts.push(`${failed} item${failed === 1 ? '' : 's'} failed — ${detail}`);
  }

  const className = failed > 0 ? 'warn' : 'ok';
  setStatus(parts.join(' '), className);
}

function getCurrentMedia(preferredIndex = state.mediaIndex) {
  if (!state.mediaItems.length) return null;
  const index = parseMediaIndex(preferredIndex);
  return state.mediaItems.find((item) => item.index === index) || state.mediaItems[0];
}

function clearResult() {
  state.tweetId = '';
  state.permalink = '';
  state.screenName = '';
  state.displayName = '';
  state.text = '';
  state.mediaItems = [];
  state.mediaIndex = 0;
  resultCard.hidden = true;
  postOwner.textContent = '';
  postText.hidden = true;
  postText.textContent = '';
  mediaSelectWrap.hidden = true;
  mediaSelect.innerHTML = '';
  variantSelect.innerHTML = '';
  filenamePreview.textContent = '—';
  mediaPreview.hidden = true;
  mediaThumbnail.removeAttribute('src');
  mediaThumbnail.alt = '';
  mediaDuration.textContent = '';
  mediaDuration.removeAttribute('aria-label');
  permalink.href = '#';
  permalink.textContent = 'Open post';
  downloadAllBtn.hidden = true;
  updateDownloadLabels();
}

async function withBusy(message, task) {
  setBusy(true, message);
  try {
    return await task();
  } catch (err) {
    return { ok: false, err: getErrorMessage(err) };
  } finally {
    setBusy(false);
  }
}

async function sendRuntimeMessage(payload) {
  try {
    return await chrome.runtime.sendMessage(payload);
  } catch (err) {
    return { ok: false, err: getErrorMessage(err) };
  }
}

function setBusy(busy, message = '') {
  analyzeBtn.disabled = busy;
  downloadBtn.disabled = busy;
  saveAsBtn.disabled = busy;
  downloadAllBtn.disabled = busy;
  copyUrlBtn.disabled = busy;
  input.disabled = busy;
  variantSelect.disabled = busy;
  mediaSelect.disabled = busy;
  prefQuality.disabled = busy;
  promptSaveAs.disabled = busy;
  analyzeBtn.textContent = busy ? 'Working…' : 'Analyze';
  updateDownloadLabels();
  if (message) setStatus(message, '');
}

function updateDownloadLabels() {
  downloadBtn.textContent = promptSaveAs.checked
    ? 'Download selected MP4…'
    : 'Download selected MP4';
  saveAsBtn.textContent = 'Save As…';
  downloadAllBtn.textContent = promptSaveAs.checked
    ? 'Download all media…'
    : 'Download all media';
  if (analyzeBtn.disabled) {
    downloadBtn.textContent = 'Working…';
    saveAsBtn.textContent = 'Working…';
    downloadAllBtn.textContent = 'Working…';
  }
}

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = 'status';
  if (kind === 'error') statusEl.classList.add('error');
  if (kind === 'ok') statusEl.classList.add('ok');
  if (kind === 'warn') statusEl.classList.add('warn');
}

function pickPreferredVariantUrl(variants, quality) {
  if (!Array.isArray(variants) || !variants.length) return '';
  switch (quality) {
    case 'small':
      return variants[variants.length - 1].url;
    case 'medium':
      return variants[Math.round((variants.length - 1) / 2)].url;
    case 'best':
    default:
      return variants[0].url;
  }
}

function extractTweetId(inputValue) {
  const raw = String(inputValue || '').trim();
  if (!raw) return '';
  if (/^\d{5,25}$/.test(raw)) return raw;

  const candidate = buildTweetUrlCandidate(raw);
  if (candidate) {
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:') return '';
      if (!/(^|\.)(x|twitter)\.com$/i.test(url.hostname)) return '';
      return matchTweetIdFromPath(url.pathname) || '';
    } catch {
      return '';
    }
  }

  return raw.startsWith('/') ? (matchTweetIdFromPath(raw) || '') : '';
}

function buildTweetUrlCandidate(raw) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
  if (/^(?:www\.)?(?:x|twitter)\.com\//i.test(raw)) return `https://${raw}`;
  if (/^(?:mobile\.)twitter\.com\//i.test(raw)) return `https://${raw}`;
  return '';
}

function matchTweetIdFromPath(pathname) {
  const match = String(pathname || '').match(
    /(?:^|\/)(?:status|statuses)\/(\d{5,25})(?:[/?#]|$)|(?:^|\/)i\/(?:web\/)?status\/(\d{5,25})(?:[/?#]|$)/
  );
  return match ? (match[1] || match[2]) : '';
}

function parseMediaIndex(value) {
  const num = Number(value);
  return Number.isInteger(num) && num >= 0 ? num : 0;
}

async function copyToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const area = document.createElement('textarea');
  area.value = value;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.focus();
  area.select();

  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('The browser denied clipboard access.');
}

function getErrorMessage(err) {
  return err instanceof Error && err.message ? err.message : 'Unknown error';
}
