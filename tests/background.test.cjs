// Regression checks load the actual background script in node:vm.
// No application endpoints or real chrome.downloads calls are reachable.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
const test = require('node:test');
function runtime(
  fetchImpl = async () => {
    throw Error('Unexpected stub fetch');
  },
  downloadImpl = async () => 1
) {
  const handlers = {},
    badges = [],
    downloads = [],
    requests = [],
    timers = [];
  const ctx = vm.createContext({
    URL,
    AbortSignal,
    Date,
    console,
    fetch: (...args) => {
      requests.push(args);
      return fetchImpl(...args);
    },
    setTimeout: (fn, delay) => {
      timers.push({ fn, delay });
      return timers.length;
    },
    chrome: {
      action: {
        setBadgeBackgroundColor: async () => {},
        setBadgeText: async (value) => badges.push(value),
        disable: async () => {},
        onClicked: { addListener: (fn) => (handlers.clicked = fn) },
      },
      runtime: {
        onInstalled: { addListener: (fn) => (handlers.installed = fn) },
        onMessage: { addListener: (fn) => (handlers.message = fn) },
      },
      declarativeContent: {
        onPageChanged: {
          removeRules: (_, cb) => cb(),
          addRules: (value) => (handlers.rules = value),
        },
        PageStateMatcher: function (value) {
          Object.assign(this, value);
        },
        ShowAction: function () {},
      },
      downloads: {
        download: (options) => {
          downloads.push(options);
          return downloadImpl(options);
        },
      },
    },
  });
  vm.runInContext(source, ctx, { filename: 'background.js', timeout: 1000 });
  return { ctx, handlers, badges, downloads, requests, timers };
}
function media(variants) {
  return { type: 'video', video_info: { variants } };
}
function mp4(bitrate, resolution = '1280x720') {
  return {
    content_type: 'video/mp4',
    bitrate,
    url: 'https://video.twimg.com/ext_tw_video/vid/' + resolution + '/synthetic.mp4',
  };
}
function payload(items = [media([mp4(10)])]) {
  return { id_str: '1111111111', user: { screen_name: 'synthetic' }, mediaDetails: items };
}
const response = (value) => ({ ok: true, json: async () => value });

test('BG-01 malformed request ID is rejected before fetch; unknown action ignored', async () => {
  const r = runtime();
  let reply;
  assert.equal(
    r.handlers.message({ action: 'download', id: 'short' }, { tab: { id: 1 } }, (x) => (reply = x)),
    true
  );
  await new Promise(setImmediate);
  assert.equal(reply.ok, false);
  assert.equal(r.requests.length, 0);
  assert.equal(
    r.handlers.message({ action: 'unrelated' }, {}, () => {}),
    false
  );
});
test('BG-02 toolbar URL and post boundary parsing', () => {
  const r = runtime();
  for (const input of [
    'https://example.invalid/user/status/1111111111',
    'https://x.com/home',
    'http://x.com/user/status/1111111111',
  ]) {
    assert.equal(r.ctx.tweetIdFromUrl(input), null);
  }
  assert.equal(
    r.ctx.tweetIdFromUrl('https://x.com/synthetic/status/1111111111?view=1'),
    '1111111111'
  );
});
test('BG-03 variant ranking coerces bitrate and uses resolution tie break', () => {
  const r = runtime();
  const best = r.ctx.bestMp4Variant(
    media([mp4('10', '640x360'), mp4(20, '640x360'), mp4('20', '1280x720')])
  );
  assert.equal(best.bitrate, 20);
  assert.equal(best.resolution, '1280x720');
});
test('BG-04 defensive URL allowlist rejects non-HTTPS and other domains', () => {
  const r = runtime();
  const variants = [
    {
      content_type: 'video/mp4',
      url: 'https://example.invalid/1280x720/synthetic.mp4',
      bitrate: 999,
    },
    {
      content_type: 'video/mp4',
      url: 'http://video.twimg.com/1280x720/synthetic.mp4',
      bitrate: 999,
    },
    mp4(1),
  ];
  assert.equal(r.ctx.bestMp4Variant(media(variants)).bitrate, 1);
});
test('BG-05 own media wins, then quote before reply parent', async () => {
  const data = payload();
  data.quoted_status = payload();
  data.quoted_status.id_str = '2222222222';
  data.parent = payload();
  data.parent.id_str = '3333333333';
  let r = runtime(async () => response(data));
  assert.equal((await r.ctx.fetchTweetMetadata('1111111111')).tweetId, '1111111111');
  data.mediaDetails = [];
  assert.equal((await r.ctx.fetchTweetMetadata('1111111111')).tweetId, '2222222222');
  data.quoted_status.mediaDetails = [];
  assert.equal((await r.ctx.fetchTweetMetadata('1111111111')).tweetId, '3333333333');
});
test('BG-06 malformed filename metadata falls back to safe fields', async () => {
  const data = payload();
  data.id_str = 'invalid id';
  data.user.screen_name = 'name with spaces';
  const r = runtime(async () => response(data));
  const metadata = await r.ctx.fetchTweetMetadata('1111111111');
  assert.equal(
    r.ctx.buildFilename(metadata, metadata.mediaItems[0], 0),
    '@video_1111111111_1280x720.mp4'
  );
});
test('BG-07 multi-video downloads start sequentially with unique suffixes', async () => {
  let release;
  const r = runtime(
    async () => response(payload([media([mp4(10)]), media([mp4(20)])])),
    () =>
      r.downloads.length === 1 ? new Promise((resolve) => (release = resolve)) : Promise.resolve(2)
  );
  const promise = r.ctx.downloadTweetMedia('1111111111', true);
  await new Promise(setImmediate);
  assert.equal(r.downloads.length, 1);
  release(1);
  const result = await promise;
  assert.equal(result.ok, true);
  assert.equal(r.downloads.length, 2);
  assert.match(r.downloads[0].filename, /_m1_/);
  assert.match(r.downloads[1].filename, /_m2_/);
  assert.ok(r.downloads.every((x) => x.saveAs && x.conflictAction === 'uniquify'));
});
test('BG-08 lookup error translations and response body cancellation', async () => {
  let cancelled = false;
  const r = runtime(async () => ({
    ok: false,
    status: 404,
    body: {
      cancel: async () => {
        cancelled = true;
      },
    },
  }));
  await assert.rejects(r.ctx.fetchTweetMetadata('1111111111'), /could not be found/);
  assert.ok(cancelled);
  for (const name of ['TimeoutError', 'TypeError']) {
    const err = Error('synthetic failure');
    err.name = name;
    const r = runtime(async () => {
      throw err;
    });
    await assert.rejects(
      r.ctx.fetchTweetMetadata('1111111111'),
      name === 'TimeoutError' ? /Timed out/ : /Could not reach/
    );
  }
  const bad = runtime(async () => ({
    ok: true,
    json: async () => {
      throw SyntaxError();
    },
  }));
  await assert.rejects(bad.ctx.fetchTweetMetadata('1111111111'), /invalid JSON/);
});
test('BG-09 toolbar failure and ad canary badges retain originating tab', async () => {
  const r = runtime(async () => {
    throw Error('offline');
  });
  r.handlers.clicked({ url: 'https://x.com/home', id: 12 });
  r.handlers.clicked({ url: 'https://x.com/synthetic/status/1111111111', id: 13 });
  r.handlers.message({ action: 'adMarkerRot' }, { tab: { id: 14 } }, () => {});
  await new Promise(setImmediate);
  assert.ok(r.badges.some((x) => x.text === '?' && x.tabId === 12));
  assert.ok(r.badges.some((x) => x.text === '!' && x.tabId === 13));
  assert.ok(r.badges.some((x) => x.text === 'AD' && x.tabId === 14));
});
test('BG-10 download rejection propagates; success acknowledges start only', async () => {
  const r = runtime(
    async () => response(payload()),
    async () => {
      throw Error('synthetic cancellation');
    }
  );
  await assert.rejects(r.ctx.downloadTweetMedia('1111111111', true), /synthetic cancellation/);
  assert.equal(r.downloads.length, 1);
});
test('BG-11 mixed exposed/non-MP4 media currently reports aggregate success', async () => {
  const unsupported = {
    content_type: 'application/x-mpegURL',
    url: 'https://video.twimg.com/synthetic.m3u8',
  };
  const r = runtime(async () => response(payload([media([mp4(10)]), media([unsupported])])));
  const result = await r.ctx.downloadTweetMedia('1111111111', false);
  assert.equal(result.ok, true);
  assert.equal(r.downloads.length, 1);
  return 'Characterization only: 1 of 2 video items has an allowed MP4; unsupported item skipped without warning.';
});
