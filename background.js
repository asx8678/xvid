const VIDEO_TYPES = new Set(['video', 'animated_gif']);
const REQUEST_TIMEOUT_MS = 12_000;
const TWEET_ID_RE = /^\d{5,25}$/;

const LOOKUP_ERRORS = {
  401: 'This post is unavailable or restricted.',
  403: 'This post is unavailable or restricted.',
  404: 'That post could not be found.',
  429: 'Rate limited by X/Twitter. Wait a moment and try again.',
};

void chrome.action.setBadgeBackgroundColor({ color: '#f4212e' });

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.action === 'adMarkerRot') {
    // Content-script canary: ads slipped past the CSS rule — the marker in
    // content.css needs refreshing.
    flashBadge('AD');
    return false;
  }
  if (msg?.action !== 'download') return false;

  const tweetId = String(msg.id ?? '');
  const task = TWEET_ID_RE.test(tweetId)
    ? downloadTweetMedia(tweetId, Boolean(msg.saveAs))
    : Promise.resolve({ ok: false, err: 'Invalid tweet ID.' });

  task
    .then((result) => reply(result))
    .catch((err) => reply({ ok: false, err: err?.message || 'Unknown error' }));
  return true;
});

// No popup: clicking the toolbar icon downloads the video of the open post.
// Chrome's download shelf is the success feedback; a brief badge flags failure.
chrome.action.onClicked.addListener((tab) => {
  const tweetId = tweetIdFromUrl(tab?.url);
  if (!tweetId) {
    flashBadge('?');
    return;
  }
  downloadTweetMedia(tweetId, false).catch(() => flashBadge('!'));
});

function tweetIdFromUrl(url) {
  if (typeof url !== 'string' || !/^https:\/\/(?:mobile\.)?(?:x|twitter)\.com\//i.test(url)) {
    return null;
  }
  return url.match(/\/status(?:es)?\/(\d{5,25})(?:[/?#]|$)/)?.[1] ?? null;
}

async function downloadTweetMedia(tweetId, saveAs) {
  const metadata = await fetchTweetMetadata(tweetId);
  const downloads = [];

  // Sequential keeps multi-media Save As dialogs usable.
  for (const [index, item] of metadata.mediaItems.entries()) {
    const filename = buildFilename(metadata, item, index);
    const downloadId = await chrome.downloads.download({
      url: item.url,
      filename,
      conflictAction: 'uniquify',
      saveAs,
    });
    downloads.push({ filename, downloadId });
  }

  return { ok: true, tweetId: metadata.tweetId, count: downloads.length, downloads };
}

async function fetchTweetMetadata(tweetId) {
  let response;
  try {
    response = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${Date.now()}`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: 'no-store' }
    );
  } catch (err) {
    throw err?.name === 'TimeoutError' || err?.name === 'AbortError'
      ? new Error('Timed out while contacting X/Twitter. Try again.')
      : err;
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(LOOKUP_ERRORS[response.status] || `Post lookup failed (${response.status}).`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('X/Twitter returned invalid JSON for that post.');
  }

  // Prefer top-level media; fall back to the parent or quoted tweet so a
  // button on a media-less quote/reply still downloads the referenced video.
  let source = data;
  let rawMedia = videoMediaDetails(data);
  if (!rawMedia.length) {
    for (const candidate of [data?.parent, data?.quoted_status]) {
      if (!candidate || typeof candidate !== 'object') continue;
      const fallbackMedia = videoMediaDetails(candidate);
      if (fallbackMedia.length) {
        source = candidate;
        rawMedia = fallbackMedia;
        break;
      }
    }
  }

  const mediaItems = rawMedia.map(bestMp4Variant).filter(Boolean);
  if (!mediaItems.length) {
    throw new Error(
      rawMedia.length
        ? 'The post has video media, but no direct MP4 variants were exposed.'
        : 'No downloadable video was found in that post.'
    );
  }

  const screenName = source?.user?.screen_name;
  return {
    tweetId: String(source?.id_str || source?.id || tweetId),
    // Screen names are \w-only, so they are filesystem-safe as-is; the
    // length cap is filename hygiene, generous vs. X's 15-char limit.
    screenName:
      typeof screenName === 'string' && /^\w{1,30}$/.test(screenName) ? screenName : 'video',
    mediaItems,
  };
}

function videoMediaDetails(node) {
  const details = Array.isArray(node?.mediaDetails)
    ? node.mediaDetails
    : Array.isArray(node?.media_details)
      ? node.media_details
      : [];
  return details.filter((entry) => VIDEO_TYPES.has(entry?.type));
}

function bestMp4Variant(media) {
  let best = null;

  for (const variant of media?.video_info?.variants ?? []) {
    if (variant?.content_type !== 'video/mp4' || typeof variant.url !== 'string') continue;

    let parsed;
    try {
      parsed = new URL(variant.url);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:' || !/(^|\.)twimg\.com$/i.test(parsed.hostname)) continue;

    // The API sometimes serves bitrates as strings; Number() coerces both.
    const bitrate = Number(variant.bitrate) > 0 ? Number(variant.bitrate) : 0;
    const resolution = (parsed.pathname.match(/\/(\d+x\d+)\//) || [])[1] || '';
    const [w, h] = resolution.split('x');
    const area = (Number(w) || 0) * (Number(h) || 0);

    if (!best || bitrate > best.bitrate || (bitrate === best.bitrate && area > best.area)) {
      best = { url: variant.url, bitrate, resolution, area };
    }
  }

  return best;
}

function buildFilename(metadata, item, index) {
  const parts = [`@${metadata.screenName}`, metadata.tweetId];
  if (metadata.mediaItems.length > 1) parts.push(`m${index + 1}`);
  if (item.resolution) parts.push(item.resolution);
  return `${parts.join('_')}.mp4`;
}

function flashBadge(text) {
  void chrome.action.setBadgeText({ text });
  setTimeout(() => void chrome.action.setBadgeText({ text: '' }), 3000);
}
