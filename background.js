const VIDEO_TYPES = new Set(['video', 'animated_gif']);
const REQUEST_TIMEOUT_MS = 12_000;
const TWEET_ID_RE = /^\d{5,25}$/;

const LOOKUP_ERRORS = {
  401: 'This post is unavailable or restricted.',
  403: 'This post is unavailable or restricted.',
  404: 'That post could not be found.',
  429: 'Rate limited by X/Twitter. Wait a moment and try again.',
};

// The worker's only event: a download button click. It sleeps otherwise.
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
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

async function downloadTweetMedia(tweetId, saveAs) {
  const metadata = await fetchTweetMetadata(tweetId);

  // Sequential keeps multi-media Save As dialogs usable.
  for (const [index, item] of metadata.mediaItems.entries()) {
    await chrome.downloads.download({
      url: item.url,
      filename: buildFilename(metadata, item, index),
      conflictAction: 'uniquify',
      saveAs,
    });
  }

  return { ok: true };
}

async function fetchTweetMetadata(tweetId) {
  let response;
  try {
    // The endpoint requires a token parameter but accepts any value.
    response = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${Date.now()}`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: 'no-store' }
    );
  } catch (err) {
    // Everything fetch rejects with here is network-level (timeout, offline,
    // DNS) — none of the raw messages ("Failed to fetch") belong in the UI.
    throw err?.name === 'TimeoutError' || err?.name === 'AbortError'
      ? new Error('Timed out while contacting X/Twitter. Try again.')
      : new Error('Could not reach X/Twitter. Check your connection.');
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

  // Prefer the post's own video, then the quoted post's (it is the one visibly
  // embedded), then the reply parent's, so a button on a media-less quote or
  // reply still downloads the referenced video. The API names the quoted post
  // quoted_tweet; quoted_status is its older name.
  const source =
    [data, data?.quoted_tweet, data?.quoted_status, data?.parent].find(
      (node) => videoMediaDetails(node).length
    ) ?? data;
  const rawMedia = videoMediaDetails(source);
  const mediaItems = rawMedia.map(bestMp4Variant).filter(Boolean);
  if (!mediaItems.length) {
    throw new Error(
      rawMedia.length
        ? 'The post has video media, but no direct MP4 variants were exposed.'
        : 'No downloadable video was found in that post.'
    );
  }

  // The API's ID and screen name land in the download filename, so trust them
  // only when they look valid. Screen names are \w-only, so they are
  // filesystem-safe as-is; the length cap is generous vs. X's 15-char limit.
  const sourceId = String(source?.id_str ?? '');
  const screenName = source?.user?.screen_name;
  return {
    tweetId: TWEET_ID_RE.test(sourceId) ? sourceId : tweetId,
    screenName:
      typeof screenName === 'string' && /^\w{1,30}$/.test(screenName) ? screenName : 'video',
    mediaItems,
  };
}

function videoMediaDetails(node) {
  return Array.isArray(node?.mediaDetails)
    ? node.mediaDetails.filter((entry) => VIDEO_TYPES.has(entry?.type))
    : [];
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
    const resolution = parsed.pathname.match(/\/(\d+x\d+)\//)?.[1] || '';
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
