const VIDEO_TYPES = new Set(['video', 'animated_gif']);

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.action !== 'dl' || sender.id !== chrome.runtime.id) return;
  download(msg.id).then(r => reply(r)).catch(e => reply({ ok: false, err: e.message }));
  return true;
});

async function download(tweetId) {
  if (!/^\d{1,20}$/.test(tweetId)) throw new Error('Invalid tweet ID');

  const res = await fetch(
    `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${Date.now()}`,
    { signal: AbortSignal.timeout(10_000) }
  );

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

  const media = (data.mediaDetails || []).find(m => VIDEO_TYPES.has(m.type));
  if (!media?.video_info?.variants) throw new Error('No video');

  const mp4 = media.video_info.variants
    .filter(v => v.content_type === 'video/mp4')
    .reduce((best, v) => ((v.bitrate || 0) > (best.bitrate || 0) ? v : best), { bitrate: -1 });
  if (!mp4.url) throw new Error('No mp4');

  if (!/^https:\/\/video\.twimg\.com\//.test(mp4.url)) throw new Error('Bad URL');

  const user = (data.user?.screen_name || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
  const px = (mp4.url.match(/\/(\d+x\d+)\//) || [])[1] || 'best';

  let dlId;
  try {
    dlId = await chrome.downloads.download({ url: mp4.url, filename: `@${user}_${tweetId}_${px}.mp4` });
  } catch (e) {
    throw new Error(`Download failed: ${e.message}`);
  }
  if (!dlId) throw new Error('Download not started');
  return { ok: true };
}
