#!/usr/bin/env node

import { chromium } from 'playwright-core';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildChromiumArgs,
  extensionIdFromPublicKeyDer,
  resolveBrowserLaunchTarget,
} from './helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const REPORT_DIR = join(__dirname, 'reports', 'x-3ti');
const SCREENSHOT_DIR = join(REPORT_DIR, 'screenshots');

const SINGLE_ID = '2047785574757478731';
const GIF_ID = '1117281960387334147';
const QUOTED_ONLY_ID = '2047801475137470783';
const MULTI_FIXTURE_ID = '2222222222';
const MISSING_ID = '9999999999999999999';

const SCENARIO_TIMEOUT = Number.parseInt(process.env.SCENARIO_TIMEOUT ?? '45000', 10) || 45000;

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lP4G0wAAAABJRU5ErkJggg==',
  'base64'
);

const tinyMp4ish = Buffer.from('xvid manual QA placeholder mp4 bytes\n', 'utf8');

function fixtureJson(name) {
  return JSON.parse(readFileSync(join(REPO_ROOT, 'tests', 'fixtures', name), 'utf8'));
}

function prepareExtensionCopy() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'xvid-x3ti-extension-'));
  const extensionDir = join(tempRoot, 'extension');
  mkdirSync(extensionDir, { recursive: true });

  for (const entry of ['manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.js', 'icons']) {
    cpSync(join(REPO_ROOT, entry), join(extensionDir, entry), { recursive: true });
  }

  const { publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const manifestPath = join(extensionDir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.key = publicKey.toString('base64');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    tempRoot,
    extensionDir,
    extensionId: extensionIdFromPublicKeyDer(publicKey),
  };
}

function syntheticXPostHtml({ id, title, videos = 1 }) {
  const videoTags = Array.from({ length: videos }, (_, index) => `
      <video controls muted width="360" height="220" poster="https://pbs.twimg.com/media/x3ti_${index}.jpg">
        <source src="https://video.twimg.com/ext_tw_video/${id}/pu/vid/640x360/video_${index + 1}.mp4?tag=14" type="video/mp4">
      </video>`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title} / X fixture</title>
  <style>
    body { margin: 0; background: #000; color: #e7e9ea; font: 15px system-ui, sans-serif; }
    main { max-width: 720px; margin: 40px auto; border: 1px solid #2f3336; border-radius: 16px; padding: 24px; }
    article { display: block; }
    [data-testid="tweet"] { display: grid; gap: 14px; }
    video { max-width: 100%; border-radius: 12px; background: #111; margin-right: 10px; }
    [role="group"] { display: flex; gap: 16px; margin-top: 12px; border-top: 1px solid #2f3336; padding-top: 10px; }
    button { color: #e7e9ea; background: transparent; border: 0; padding: 8px; }
    a { color: #1d9bf0; }
  </style>
</head>
<body>
  <main id="primaryColumn" data-testid="primaryColumn">
    <article>
      <div data-testid="tweet">
        <a href="https://x.com/fixture/status/${id}"><time datetime="2026-04-25T22:00:00Z">Apr 25</time></a>
        <p>${title}</p>
        <div>${videoTags}</div>
        <div role="group" aria-label="Post actions">
          <button>Reply</button><button>Repost</button><button>Like</button><button>Bookmark</button><button>Share</button>
        </div>
      </div>
    </article>
  </main>
</body>
</html>`;
}

async function installRoutes(context) {
  const fixtures = new Map([
    [MULTI_FIXTURE_ID, fixtureJson('multi-video.json')],
  ]);

  await context.route('https://cdn.syndication.twimg.com/tweet-result**', async (route) => {
    const url = new URL(route.request().url());
    const id = url.searchParams.get('id') || '';

    if (fixtures.has(id)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.get(id)),
      });
      return;
    }

    if (id === MISSING_ID) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'not found' }),
      });
      return;
    }

    await route.continue();
  });

  await context.route('https://x.com/fixture/status/**', async (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/').pop();
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: syntheticXPostHtml({
        id,
        title: id === MULTI_FIXTURE_ID
          ? 'Fixture-backed multi-video post with two videos'
          : `Fixture post ${id}`,
        videos: id === MULTI_FIXTURE_ID ? 2 : 1,
      }),
    });
  });

  await context.route('https://video.twimg.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'video/mp4',
      body: tinyMp4ish,
    });
  });

  await context.route('https://pbs.twimg.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: tinyPng,
    });
  });
}

async function screenshot(page, name, options = {}) {
  const path = join(SCREENSHOT_DIR, name);
  await page.screenshot({ path, fullPage: true, ...options });
  return `screenshots/${name}`;
}

async function popupPage(context, extensionId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('h1').waitFor({ timeout: SCENARIO_TIMEOUT });
  return page;
}

async function analyzeInPopup(page, inputValue) {
  await page.locator('#tweet-input').fill(inputValue);
  await page.locator('#analyze-btn').click();
  await page.waitForFunction(() => {
    const text = document.querySelector('#status')?.textContent || '';
    return text && !/Analyzing post…?/.test(text);
  }, null, { timeout: SCENARIO_TIMEOUT });

  return {
    status: await page.locator('#status').innerText(),
    resultHidden: await page.locator('#result-card').evaluate((element) => element.hidden),
    mediaSelectHidden: await page.locator('#media-select-wrap').evaluate((element) => element.hidden),
    downloadAllHidden: await page.locator('#download-all-btn').evaluate((element) => element.hidden),
    resultTitle: await page.locator('#result-title').innerText().catch(() => ''),
    mediaOptionCount: await page.locator('#media-select option').count(),
    variantOptionCount: await page.locator('#variant-select option').count(),
  };
}

async function waitForDownloadStatus(page) {
  await page.waitForFunction(() => {
    const text = document.querySelector('#status')?.textContent || '';
    return text && !/(Starting|Opening|Working)/.test(text);
  }, null, { timeout: SCENARIO_TIMEOUT });
  return page.locator('#status').innerText();
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const prepared = prepareExtensionCopy();
  const userDataDir = mkdtempSync(join(tmpdir(), 'xvid-x3ti-profile-'));
  const downloadsPath = mkdtempSync(join(tmpdir(), 'xvid-x3ti-downloads-'));
  const browserTarget = resolveBrowserLaunchTarget();

  console.log('🚀 x-3ti scenario capture');
  console.log(`   browser      : ${browserTarget.label}`);
  console.log(`   extension    : ${prepared.extensionDir}`);
  console.log(`   extension ID : ${prepared.extensionId}`);
  console.log(`   screenshots  : ${SCREENSHOT_DIR}`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    ...browserTarget,
    headless: false,
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
    downloadsPath,
    args: buildChromiumArgs(prepared.extensionDir),
    ignoreDefaultArgs: ['--disable-extensions'],
  });

  const results = [];

  try {
    await installRoutes(context);

    // 1. Single-video live X post: content-script injection + download start.
    {
      const page = await context.newPage();
      await page.goto(`https://x.com/NASAArtemis/status/${SINGLE_ID}`, { waitUntil: 'domcontentloaded', timeout: SCENARIO_TIMEOUT });
      await page.locator('.xvd').first().waitFor({ timeout: SCENARIO_TIMEOUT });
      await page.locator('.xvd').first().click();
      await page.waitForFunction(() => {
        const title = document.querySelector('.xvd')?.title || '';
        return title && !/Download video|Extension did not respond/.test(title);
      }, null, { timeout: SCENARIO_TIMEOUT });
      const title = await page.locator('.xvd').first().getAttribute('title');
      assertCondition(/Download started|Save As opened/.test(title || ''), `Single-video download did not start; title=${title}`);
      results.push({
        id: '1-single-video-live-x',
        status: 'PASS',
        evidence: title,
        screenshot: await screenshot(page, '01-single-video-live-x.png'),
      });
      await page.close();
    }

    // 2. Multi-video fixture in live Chromium: synthetic x.com page + picker + Download all.
    {
      const page = await context.newPage();
      await page.goto(`https://x.com/fixture/status/${MULTI_FIXTURE_ID}`, { waitUntil: 'domcontentloaded', timeout: SCENARIO_TIMEOUT });
      await page.locator('.xvd').first().waitFor({ timeout: SCENARIO_TIMEOUT });
      const pageShot = await screenshot(page, '02-multi-video-fixture-x-page.png');

      const popupPromise = context.waitForEvent('page', { timeout: SCENARIO_TIMEOUT });
      await page.locator('.xvd').first().click({ modifiers: ['Shift'] });
      const picker = await popupPromise;
      await picker.waitForLoadState('domcontentloaded');
      await picker.waitForFunction(() => {
        const text = document.querySelector('#status')?.textContent || '';
        return /Found 2 downloadable media items/.test(text);
      }, null, { timeout: SCENARIO_TIMEOUT });
      assertCondition(await picker.locator('#download-all-btn').isVisible(), 'Download all button was not visible for multi-video fixture');
      await picker.locator('#download-all-btn').click();
      const status = await waitForDownloadStatus(picker);
      assertCondition(/Started 2 of 2 downloads|Started \d+ of 2 downloads/.test(status), `Download all did not start both downloads; status=${status}`);
      results.push({
        id: '2-multi-video-fixture',
        status: 'PASS',
        evidence: status,
        screenshot: await screenshot(picker, '02-multi-video-download-all.png'),
        pageScreenshot: pageShot,
      });
      await picker.close();
      await page.close();
    }

    // 3. Animated GIF live X post + popup detection as Animated GIF variants.
    {
      const page = await context.newPage();
      await page.goto(`https://x.com/GIPHY/status/${GIF_ID}`, { waitUntil: 'domcontentloaded', timeout: SCENARIO_TIMEOUT });
      await page.locator('.xvd').first().waitFor({ timeout: SCENARIO_TIMEOUT });
      const xShot = await screenshot(page, '03-animated-gif-live-x.png');
      await page.close();

      const popup = await popupPage(context, prepared.extensionId);
      const details = await analyzeInPopup(popup, GIF_ID);
      assertCondition(/Found 1 downloadable media item/.test(details.status), `GIF probe failed: ${details.status}`);
      assertCondition(details.resultTitle === 'Animated GIF variants', `Expected Animated GIF variants, got ${details.resultTitle}`);
      results.push({
        id: '3-animated-gif',
        status: 'PASS',
        evidence: `${details.status}; ${details.resultTitle}`,
        screenshot: await screenshot(popup, '03-animated-gif-popup.png'),
        pageScreenshot: xShot,
      });
      await popup.close();
    }

    // 4. Quoted-only video live post. The current x-3ti run records this as FAIL
    // and tracks the defect as x-3ks; future fixes should naturally flip this
    // scenario to PASS without changing the capture script.
    {
      const popup = await popupPage(context, prepared.extensionId);
      const details = await analyzeInPopup(popup, QUOTED_ONLY_ID);
      const passed = /Found \d+ downloadable media item/.test(details.status);
      results.push({
        id: '4-quoted-post-containing-video',
        status: passed ? 'PASS' : 'FAIL',
        evidence: details.status,
        screenshot: await screenshot(popup, '04-quoted-video-popup.png'),
      });
      await popup.close();
    }

    // 5. Restricted/deleted graceful failure.
    {
      const popup = await popupPage(context, prepared.extensionId);
      const details = await analyzeInPopup(popup, MISSING_ID);
      assertCondition(/could not be found/.test(details.status), `Expected not-found message, got: ${details.status}`);
      results.push({
        id: '5-restricted-deleted-post',
        status: 'PASS',
        evidence: details.status,
        screenshot: await screenshot(popup, '05-restricted-deleted-error.png'),
      });
      await popup.close();
    }

    // 6. mobile.twitter.com URL parsing through popup/background.
    {
      const popup = await popupPage(context, prepared.extensionId);
      const mobileUrl = `https://mobile.twitter.com/NASAArtemis/status/${SINGLE_ID}`;
      const details = await analyzeInPopup(popup, mobileUrl);
      assertCondition(/Found 1 downloadable media item/.test(details.status), `Mobile URL probe failed: ${details.status}`);
      results.push({
        id: '6-mobile-twitter-url-parsing',
        status: 'PASS',
        evidence: details.status,
        screenshot: await screenshot(popup, '06-mobile-twitter-url-popup.png'),
      });
      await popup.close();
    }
  } finally {
    await context.close();
    rmSync(userDataDir, { recursive: true, force: true });
    rmSync(downloadsPath, { recursive: true, force: true });
    rmSync(prepared.tempRoot, { recursive: true, force: true });
  }

  const summaryPath = join(REPORT_DIR, 'summary.json');
  writeFileSync(summaryPath, `${JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2)}\n`);

  for (const result of results) {
    const mark = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${mark} ${result.id}: ${result.status} — ${result.evidence}`);
  }
  console.log(`\n📄 Summary: ${summaryPath}`);
}

run().catch((err) => {
  console.error(`❌ x-3ti scenario capture failed: ${err?.stack || err}`);
  process.exitCode = 1;
});
