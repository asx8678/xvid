chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.action !== 'dl' || sender.id !== chrome.runtime.id) return;
  download(msg.id).then(r => reply(r)).catch(e => reply({ ok: false, err: e.message }));
  return true;
});

async function download(tweetId) {
  if (!/^\d{1,20}$/.test(tweetId)) throw new Error('Invalid tweet ID');

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
  if (!res.ok) throw new Error('Tweet fetch failed');
  const data = await res.json();

  const media = (data.mediaDetails || []).find(
    m => m.type === 'video' || m.type === 'animated_gif'
  );
  if (!media?.video_info?.variants) throw new Error('No video');

  const mp4 = media.video_info.variants
    .filter(v => v.content_type === 'video/mp4')
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  if (!mp4) throw new Error('No mp4');

  if (!/^https:\/\/video\.twimg\.com\//.test(mp4.url)) throw new Error('Bad URL');

  const user = (data.user?.screen_name || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
  const px = (mp4.url.match(/\/(\d+x\d+)\//) || [])[1] || 'best';

  const dlId = await chrome.downloads.download({ url: mp4.url, filename: `@${user}_${tweetId}_${px}.mp4` });
  if (!dlId) throw new Error('Download not started');
  return { ok: true };
}
