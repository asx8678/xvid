const VIDEO_TYPES = new Set(['video', 'animated_gif']);
const inflight = new Map();

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // BUG 1 FIX: Return false explicitly on non-matching messages so Chrome
  // knows we won't use the async reply channel. Returning undefined is
  // ambiguous and fragile if the extension adds more listeners later.
  if (!msg || typeof msg !== 'object') return false;
  if (msg.action !== 'dl') return false;
  if (sender.id !== chrome.runtime.id) return false;

  const tabUrl = sender?.tab?.url ?? '';
  if (!/^https:\/\/(x|twitter)\.com\//.test(tabUrl)) return false;

  if (typeof msg.id !== 'string' || !/^\d{1,20}$/.test(msg.id)) {
    reply({ ok: false, err: 'Invalid tweet ID' });
    return true;
  }

  const id = msg.id;
  if (!inflight.has(id)) {
    // BUG 2 FIX: Delay inflight cleanup by 5s so concurrent callers can
    // still chain onto the same promise. Prevents duplicate downloads from
    // rapid clicks when .finally() used to delete the entry immediately.
    const p = download(id).finally(() => {
      setTimeout(() => inflight.delete(id), 5000);
    });
    inflight.set(id, p);
  }
  inflight.get(id).then(r => reply(r)).catch(e => reply({ ok: false, err: e instanceof Error ? e.message : String(e) }));
  return true;
});

async function download(tweetId) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  let res;
  try {
    res = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${Date.now()}`,
      { signal: ctrl.signal }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`Tweet fetch failed (${res.status})`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Invalid API response');
  }

  const details = Array.isArray(data.mediaDetails) ? data.mediaDetails : [];
  const media = details.find(m => VIDEO_TYPES.has(m.type));
  if (!media?.video_info?.variants) throw new Error('No video');

  const variants = Array.isArray(media.video_info.variants) ? media.video_info.variants : [];
  const mp4 = variants
    .filter(v => v.content_type === 'video/mp4')
    .reduce((best, v) => ((v.bitrate || 0) > (best.bitrate || 0) ? v : best), { bitrate: -1 });
  if (!mp4.url) throw new Error('No mp4');

  let parsed;
  try { parsed = new URL(mp4.url); } catch { throw new Error('Bad URL'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'video.twimg.com') throw new Error('Bad URL');

  const user = (data.user?.screen_name || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
  const px = (mp4.url.match(/\/(\d+x\d+)\//) || [])[1] || 'best';

  let dlId;
  try {
    dlId = await chrome.downloads.download({ url: mp4.url, filename: `@${user}_${tweetId}_${px}.mp4` });
  } catch (e) {
    throw new Error(`Download failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!dlId) throw new Error('Download not started');
  return { ok: true };
}
