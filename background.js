const VIDEO_TYPES = new Set(['video', 'animated_gif']);
const QUALITY_PREFS = new Set(['best', 'medium', 'small']);
const DEFAULT_SETTINGS = Object.freeze({
  defaultQuality: 'best',
  promptSaveAs: false,
});
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 90_000;

const inflightDownloads = new Map();
const metadataCache = new Map();

chrome.runtime.onInstalled.addListener(() => {
  void bootstrapSettings();
});

chrome.runtime.onStartup?.addListener(() => {
  void hardenStorageAccess();
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || typeof msg !== 'object') return false;

  const finish = (promise) => {
    promise
      .then((result) => reply(result))
      .catch((err) => reply({ ok: false, err: getErrorMessage(err) }));
    return true;
  };

  switch (msg.action) {
    case 'probe':
      return finish(handleProbe(msg));
    case 'download':
    case 'dl':
      return finish(handleDownload(msg));
    case 'downloadAll':
      return finish(handleDownloadAll(msg));
    case 'openPicker':
      return finish(handleOpenPicker(msg, sender));
    default:
      return false;
  }
});

async function bootstrapSettings() {
  await hardenStorageAccess();

  try {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    const next = {};

    if (!QUALITY_PREFS.has(settings.defaultQuality)) {
      next.defaultQuality = DEFAULT_SETTINGS.defaultQuality;
    }
    if (typeof settings.promptSaveAs !== 'boolean') {
      next.promptSaveAs = DEFAULT_SETTINGS.promptSaveAs;
    }

    if (Object.keys(next).length) {
      await chrome.storage.sync.set({ ...settings, ...next });
    }
  } catch {
    // Ignore storage bootstrap failures; runtime defaults are still applied.
  }
}

async function hardenStorageAccess() {
  try {
    await chrome.storage.sync.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  } catch {
    // Ignore if unavailable; functionality still works.
  }
}

async function handleProbe(msg) {
  const tweetId = normalizeTweetId(msg?.input ?? msg?.id ?? msg?.tweetId);
  if (!tweetId) {
    return { ok: false, err: 'Paste a valid X/Twitter post URL or a numeric status ID.' };
  }

  const metadata = await getTweetMetadata(tweetId);
  const settings = await getSettings();
  const selectedMedia = pickMediaItem(metadata.mediaItems, msg?.mediaIndex);

  return {
    ok: true,
    tweetId,
    user: metadata.screenName || metadata.displayName || '',
    screenName: metadata.screenName || '',
    displayName: metadata.displayName || '',
    text: metadata.text || '',
    permalink: metadata.permalink,
    defaultQuality: settings.defaultQuality,
    promptSaveAs: settings.promptSaveAs,
    mediaCount: metadata.mediaItems.length,
    selectedMediaIndex: selectedMedia?.index ?? 0,
    mediaItems: metadata.mediaItems.map((item) => ({
      index: item.index,
      mediaType: item.mediaType,
      label: formatMediaItemLabel(item, metadata.mediaItems.length),
      thumbnailUrl: item.thumbnailUrl || '',
      durationMillis: item.durationMillis || 0,
      durationLabel: item.durationLabel || '',
      variants: item.variants.map((variant) => ({
        url: variant.url,
        bitrate: variant.bitrate,
        resolution: variant.resolution,
        label: variant.label,
        filename: buildFilename(metadata, item, variant),
      })),
    })),
  };
}

async function handleDownload(msg) {
  const tweetId = normalizeTweetId(msg?.input ?? msg?.id ?? msg?.tweetId);
  if (!tweetId) return { ok: false, err: 'Invalid tweet ID or post URL.' };

  const metadata = await getTweetMetadata(tweetId);
  const mediaItem = pickMediaItem(metadata.mediaItems, msg?.mediaIndex);
  if (!mediaItem) return { ok: false, err: 'No downloadable media item was found for that post.' };

  const settings = await getSettings();
  const qualityPref = resolveQualityPref(msg?.qualityPref, settings.defaultQuality);
  const variant = chooseVariant(mediaItem.variants, msg?.variantUrl || null, qualityPref);
  if (!variant) return { ok: false, err: 'No matching MP4 variant was found for that post.' };

  const saveAs = typeof msg?.saveAs === 'boolean' ? msg.saveAs : settings.promptSaveAs;
  return startDownloadWithInflight(metadata, mediaItem, variant, { saveAs });
}

async function handleDownloadAll(msg) {
  const tweetId = normalizeTweetId(msg?.input ?? msg?.id ?? msg?.tweetId);
  if (!tweetId) return { ok: false, err: 'Invalid tweet ID or post URL.' };

  const metadata = await getTweetMetadata(tweetId);
  if (!metadata.mediaItems.length) {
    return { ok: false, err: 'No downloadable media item was found for that post.' };
  }

  const settings = await getSettings();
  const qualityPref = resolveQualityPref(msg?.qualityPref, settings.defaultQuality);
  const saveAs = typeof msg?.saveAs === 'boolean' ? msg.saveAs : settings.promptSaveAs;
  const downloads = [];
  const errors = [];

  // Start sequentially. This keeps Chrome Save As prompts usable on multi-media posts
  // and avoids flooding the downloads API if a post exposes many variants.
  for (const mediaItem of metadata.mediaItems) {
    const variant = chooseVariant(mediaItem.variants, null, qualityPref);
    if (!variant) {
      errors.push({ mediaIndex: mediaItem.index, err: 'No matching MP4 variant.' });
      continue;
    }

    try {
      downloads.push(await startDownloadWithInflight(metadata, mediaItem, variant, { saveAs }));
    } catch (err) {
      errors.push({ mediaIndex: mediaItem.index, err: getErrorMessage(err) });
    }
  }

  if (!downloads.length) {
    return {
      ok: false,
      err: errors.map((entry) => entry.err).filter(Boolean).join('; ') || 'Could not start any downloads.',
      errors,
    };
  }

  const dedupedCount = downloads.filter((entry) => entry && entry.deduped).length;
  return {
    ok: true,
    tweetId,
    requested: metadata.mediaItems.length,
    count: downloads.length,
    dedupedCount,
    saveAs,
    downloads,
    errors,
  };
}

async function handleOpenPicker(msg, sender) {
  const tweetId = normalizeTweetId(msg?.id ?? sender?.tab?.url ?? '');
  if (!tweetId) return { ok: false, err: 'Could not determine which post to inspect.' };

  const mediaItem = Number.isInteger(msg?.mediaIndex) ? msg.mediaIndex : 0;
  const url = chrome.runtime.getURL(
    `popup.html?tweet=${encodeURIComponent(tweetId)}&media=${encodeURIComponent(String(mediaItem))}`
  );
  await chrome.tabs.create({ url });
  return { ok: true };
}

async function getSettings() {
  try {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return {
      defaultQuality: resolveQualityPref(settings.defaultQuality, DEFAULT_SETTINGS.defaultQuality),
      promptSaveAs: typeof settings.promptSaveAs === 'boolean'
        ? settings.promptSaveAs
        : DEFAULT_SETTINGS.promptSaveAs,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function resolveQualityPref(value, fallback = DEFAULT_SETTINGS.defaultQuality) {
  return QUALITY_PREFS.has(value) ? value : fallback;
}

function normalizeTweetId(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  const raw = String(input).trim();
  if (!raw) return null;

  if (/^\d{5,25}$/.test(raw)) return raw;

  const candidate = buildTweetUrlCandidate(raw);
  if (candidate) {
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:') return null;
      if (!/(^|\.)(x|twitter)\.com$/i.test(url.hostname)) return null;
      return matchTweetIdFromPath(url.pathname);
    } catch {
      return null;
    }
  }

  return raw.startsWith('/') ? matchTweetIdFromPath(raw) : null;
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
  return match ? (match[1] || match[2]) : null;
}

async function getTweetMetadata(tweetId) {
  pruneMetadataCache();

  const cached = metadataCache.get(tweetId);
  if (cached && (Date.now() - cached.createdAt) < CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = fetchTweetMetadata(tweetId).catch((err) => {
    metadataCache.delete(tweetId);
    throw err;
  });

  metadataCache.set(tweetId, { createdAt: Date.now(), promise });
  return promise;
}

function pruneMetadataCache() {
  const now = Date.now();
  for (const [key, value] of metadataCache) {
    if ((now - value.createdAt) >= CACHE_TTL_MS) metadataCache.delete(key);
  }
}

async function fetchTweetMetadata(tweetId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    const endpoint = new URL('https://cdn.syndication.twimg.com/tweet-result');
    endpoint.searchParams.set('id', tweetId);
    endpoint.searchParams.set('token', String(Date.now()));

    response = await fetch(endpoint, {
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Timed out while contacting X/Twitter. Try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 404) {
      throw new Error('That post could not be found.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('This post is unavailable or restricted.');
    }
    if (response.status === 429) {
      throw new Error('Rate limited by X/Twitter. Wait a moment and try again.');
    }
    throw new Error(`Post lookup failed (${response.status}).`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('X/Twitter returned invalid JSON for that post.');
  }

  const mediaDetails = Array.isArray(data?.mediaDetails)
    ? data.mediaDetails
    : (Array.isArray(data?.media_details) ? data.media_details : []);
  const rawVideoMedia = mediaDetails.filter((entry) => VIDEO_TYPES.has(entry?.type));

  const mediaItems = [];
  for (const media of rawVideoMedia) {
    const variants = extractMp4Variants(media?.video_info?.variants ?? []);
    if (!variants.length) continue;

    const thumbnailUrl = typeof media.media_url_https === 'string' && media.media_url_https.startsWith('https://')
      ? media.media_url_https
      : '';
    const durationMillis = typeof media.video_info?.duration_millis === 'number' && media.video_info.duration_millis > 0
      ? media.video_info.duration_millis
      : 0;

    mediaItems.push({
      index: mediaItems.length,
      mediaType: media.type,
      variants,
      thumbnailUrl,
      durationMillis,
      durationLabel: formatDurationLabel(durationMillis),
    });
  }

  if (!mediaItems.length) {
    if (!rawVideoMedia.length) {
      throw new Error('No downloadable video was found in that post.');
    }
    throw new Error('The post has video media, but no direct MP4 variants were exposed.');
  }

  const screenName = sanitizeText(data?.user?.screen_name || '');
  const displayName = sanitizeText(data?.user?.name || '');
  const fileUser = screenName || displayName || 'video';
  const text = sanitizeText(data?.text || data?.full_text || '');
  const permalink = screenName
    ? `https://x.com/${encodeURIComponent(screenName)}/status/${tweetId}`
    : `https://x.com/i/status/${tweetId}`;

  return {
    tweetId,
    screenName,
    displayName,
    fileUser,
    text,
    permalink,
    mediaItems,
  };
}

function extractMp4Variants(variants) {
  const seen = new Set();
  const output = [];

  for (const variant of Array.isArray(variants) ? variants : []) {
    if (variant?.content_type !== 'video/mp4' || typeof variant.url !== 'string') continue;

    let parsed;
    try {
      parsed = new URL(variant.url);
    } catch {
      continue;
    }

    if (parsed.protocol !== 'https:' || !/(^|\.)twimg\.com$/i.test(parsed.hostname)) continue;

    const resolution = (parsed.pathname.match(/\/(\d+x\d+)\//) || [])[1] || '';
    const rawBitrate = typeof variant.bitrate === 'number'
      ? variant.bitrate
      : (typeof variant.bitrate === 'string' && /^[1-9]\d*$/.test(variant.bitrate.trim())
          ? Number(variant.bitrate.trim())
          : NaN);
    const bitrate = Number.isFinite(rawBitrate) && rawBitrate > 0 ? rawBitrate : 0;
    const key = `${resolution}|${bitrate}|${parsed.pathname}`;
    if (seen.has(key)) continue;
    seen.add(key);

    output.push({
      url: variant.url,
      bitrate,
      resolution,
      label: formatVariantLabel({ bitrate, resolution }),
      area: resolutionArea(resolution),
    });
  }

  output.sort((a, b) => {
    if (b.bitrate !== a.bitrate) return b.bitrate - a.bitrate;
    return b.area - a.area;
  });

  return output.map(({ area, ...variant }) => variant);
}

function pickMediaItem(mediaItems, mediaIndex) {
  if (!Array.isArray(mediaItems) || !mediaItems.length) return null;
  const index = Number(mediaIndex);
  return mediaItems.find((item) => item.index === index) || mediaItems[0];
}

function chooseVariant(variants, variantUrl, qualityPref) {
  if (!Array.isArray(variants) || !variants.length) return null;

  if (variantUrl) {
    return variants.find((variant) => variant.url === variantUrl) || null;
  }

  switch (qualityPref) {
    case 'small':
      return variants[variants.length - 1];
    case 'medium':
      return variants[Math.round((variants.length - 1) / 2)];
    case 'best':
    default:
      return variants[0];
  }
}

async function startDownloadWithInflight(metadata, mediaItem, variant, options = {}) {
  const saveAs = Boolean(options.saveAs);
  const key = `${metadata.tweetId}|${mediaItem.index}|${variant.url}|${saveAs ? 'saveas' : 'auto'}`;

  const existing = inflightDownloads.get(key);
  if (existing) {
    // Already-pending request: dedupe to the same promise.
    // Already-settled request kept briefly to absorb double-clicks: tag the
    // replayed result so callers can avoid claiming a fresh download started.
    return existing.settled
      ? existing.promise.then((result) => ({ ...result, deduped: true }))
      : existing.promise;
  }

  const entry = { settled: false, promise: null };
  entry.promise = startDownload(metadata, mediaItem, variant, { saveAs }).then(
    (result) => {
      entry.settled = true;
      setTimeout(() => inflightDownloads.delete(key), 5000);
      return result;
    },
    (err) => {
      // Drop failed entries immediately so a retry can actually retry.
      inflightDownloads.delete(key);
      throw err;
    }
  );
  inflightDownloads.set(key, entry);
  return entry.promise;
}

async function startDownload(metadata, mediaItem, variant, options = {}) {
  const filename = buildFilename(metadata, mediaItem, variant);
  const saveAs = Boolean(options.saveAs);

  let downloadId;
  try {
    downloadId = await chrome.downloads.download({
      url: variant.url,
      filename,
      conflictAction: 'uniquify',
      saveAs,
    });
  } catch (err) {
    throw new Error(`Download failed: ${getErrorMessage(err)}`);
  }

  if (!downloadId) {
    throw new Error('Chrome did not start the download.');
  }

  return {
    ok: true,
    tweetId: metadata.tweetId,
    mediaIndex: mediaItem.index,
    mediaType: mediaItem.mediaType,
    filename,
    saveAs,
    downloadId,
    variant: {
      url: variant.url,
      bitrate: variant.bitrate,
      resolution: variant.resolution,
      label: variant.label,
    },
  };
}

function buildFilename(metadata, mediaItem, variant) {
  const user = sanitizeFilePart(metadata.fileUser || metadata.screenName || metadata.displayName || 'video') || 'video';
  const mediaPart = metadata.mediaItems.length > 1 ? `m${mediaItem.index + 1}` : '';
  const typePart = mediaItem.mediaType === 'animated_gif' ? 'gif' : '';
  const resolution = sanitizeFilePart(variant.resolution || 'best') || 'best';
  const bitrate = variant.bitrate > 0 ? `${Math.round(variant.bitrate / 1000)}kbps` : 'mp4';
  const snippet = sanitizeFilePart(metadata.text || '').slice(0, 40);

  const parts = [`@${user}`, metadata.tweetId, mediaPart, typePart, resolution, bitrate, snippet]
    .filter(Boolean)
    .join('_')
    .replace(/_+/g, '_')
    .slice(0, 180);

  return `${parts || `x_video_${metadata.tweetId}`}.mp4`;
}

function formatVariantLabel({ bitrate, resolution }) {
  const pieces = [];
  if (resolution) pieces.push(resolution);
  if (bitrate > 0) pieces.push(`${Math.round(bitrate / 1000)} kbps`);
  if (!pieces.length) pieces.push('MP4');
  return pieces.join(' • ');
}

function formatDurationLabel(millis) {
  if (typeof millis !== 'number' || millis <= 0) return '';
  const totalSeconds = Math.round(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatMediaItemLabel(item, totalCount) {
  const kind = item.mediaType === 'animated_gif' ? 'Animated GIF' : 'Video';
  const variants = `${item.variants.length} variant${item.variants.length === 1 ? '' : 's'}`;
  if (totalCount <= 1) return `${kind} • ${variants}`;
  return `Media ${item.index + 1} • ${kind} • ${variants}`;
}

function resolutionArea(resolution) {
  const match = /^([0-9]+)x([0-9]+)$/.exec(resolution);
  if (!match) return 0;
  return Number(match[1]) * Number(match[2]);
}

function sanitizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizeFilePart(value) {
  let cleaned = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/[ ]+/g, ' ')
    .replace(/_+/g, '_')
    .replace(/[. ]+$/g, '')
    .replace(/^[@_ -]+/, '')
    .slice(0, 48);

  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) {
    cleaned = `file_${cleaned}`;
  }

  return cleaned;
}

function getErrorMessage(err) {
  if (err instanceof Error && err.message) return err.message;
  return typeof err === 'string' && err ? err : 'Unknown error';
}

if (typeof globalThis.__XVID_TEST__ !== 'undefined') {
  globalThis.__XVID_TEST__ = Object.freeze({
    normalizeTweetId,
    buildTweetUrlCandidate,
    matchTweetIdFromPath,
    extractMp4Variants,
    chooseVariant,
    pickMediaItem,
    resolveQualityPref,
    sanitizeFilePart,
    sanitizeText,
    buildFilename,
    formatVariantLabel,
    formatMediaItemLabel,
    formatDurationLabel,
    resolutionArea,
    getErrorMessage,
    CACHE_TTL_MS,
    clearCaches() {
      metadataCache.clear();
      inflightDownloads.clear();
    },
    cacheSizes() {
      return {
        metadataCache: metadataCache.size,
        inflightDownloads: inflightDownloads.size,
      };
    },
  });
}
