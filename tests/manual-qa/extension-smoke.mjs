/**
 * extension-smoke.mjs — standalone Playwright smoke for the xvid Chrome MV3 extension.
 *
 * Loads a temporary unpacked copy of the extension directly via Chromium args,
 * opens the popup page, and asserts key UI elements. The temporary copy gets an
 * ephemeral manifest `key`, allowing this script to derive the extension ID
 * without relying on service-worker target discovery.
 *
 * Usage:
 *   npm run manual-qa:smoke
 *   CHROME_PATH=/path/to/chrome npm run manual-qa:smoke
 *   PLAYWRIGHT_CHANNEL=chrome npm run manual-qa:smoke
 *   EXTENSION_PATH=/other/repo npm run manual-qa:smoke
 *
 * See tests/manual-qa/README.md for full docs.
 */

import { chromium } from 'playwright-core';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import {
  resolveBrowserLaunchTarget,
  resolveExtensionPath,
  buildChromiumArgs,
  extractExtensionId,
  extensionIdFromPublicKeyDer,
  findXvidExtensionId,
  POPUP_SMOKE_SELECTORS,
  matchesExtensionName,
} from './helpers.mjs';

const HEADLESS = (process.env.HEADLESS ?? 'false') === 'true';
const SLOW_MO = parseIntegerEnv(process.env.SLOW_MO, 0);
const TIMEOUT_MS = parseIntegerEnv(process.env.SMOKE_TIMEOUT, 30000);
const STATUS_ID = process.env.STATUS_ID ?? null;

const EXTENSION_FILES = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'popup.css',
];
const EXTENSION_DIRS = ['icons'];

async function main() {
  const browserTarget = resolveBrowserLaunchTarget();
  const sourceExtensionPath = resolveExtensionPath();
  const preparedExtension = prepareTemporaryExtension(sourceExtensionPath);
  const args = buildChromiumArgs(preparedExtension.extensionDir);
  const userDataDir = mkdtempSync(join(tmpdir(), 'xvid-smoke-profile-'));

  /** @type {import('playwright-core').BrowserContext|null} */
  let context = null;
  try {
    console.log('🚀 Launching Chromium…');
    console.log(`   browser       : ${browserTarget.label}`);
    if (browserTarget.executablePath) console.log(`   executable    : ${browserTarget.executablePath}`);
    if (browserTarget.channel) console.log(`   channel       : ${browserTarget.channel}`);
    console.log(`   source ext    : ${sourceExtensionPath}`);
    console.log(`   prepared ext  : ${preparedExtension.extensionDir}`);
    console.log(`   expected ID   : ${preparedExtension.extensionId}`);
    console.log(`   headless      : ${HEADLESS}`);
    console.log(`   userDataDir   : ${userDataDir}`);

    const launchOpts = {
      headless: HEADLESS,
      args,
      slowMo: SLOW_MO,
      ignoreDefaultArgs: ['--disable-extensions'],
    };
    const { label: _label, ...browserLaunchOptions } = browserTarget;
    Object.assign(launchOpts, browserLaunchOptions);

    context = await chromium.launchPersistentContext(userDataDir, launchOpts);

    const discoveredId = await discoverExtensionId(context, 3000);
    if (discoveredId && discoveredId !== preparedExtension.extensionId) {
      console.log(`ℹ️  Service-worker discovery returned ${discoveredId}; using manifest-key ID ${preparedExtension.extensionId}.`);
    } else if (discoveredId) {
      console.log(`✅ Extension service worker discovered — ID: ${discoveredId}`);
    } else {
      console.log('ℹ️  Service worker not discovered before popup open; continuing with manifest-key ID.');
    }

    const popupUrl = `chrome-extension://${preparedExtension.extensionId}/popup.html`;
    console.log(`📄 Opening popup: ${popupUrl}`);
    const page = await context.newPage();
    await page.goto(popupUrl, { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });

    const results = [];

    const headingText = await page.locator(POPUP_SMOKE_SELECTORS.heading).textContent({ timeout: TIMEOUT_MS });
    results.push({ check: 'heading', ok: matchesExtensionName(headingText), detail: headingText });

    const inputVisible = await page.locator(POPUP_SMOKE_SELECTORS.input).isVisible({ timeout: TIMEOUT_MS });
    results.push({ check: 'tweet-input', ok: inputVisible, detail: `visible=${inputVisible}` });

    const button = page.locator(POPUP_SMOKE_SELECTORS.analyzeButton);
    const btnVisible = await button.isVisible({ timeout: TIMEOUT_MS });
    const btnText = await button.textContent();
    results.push({ check: 'analyze-btn', ok: btnVisible, detail: `visible=${btnVisible} text="${btnText}"` });

    if (STATUS_ID) {
      console.log(`🔗 Optional status probe: ${STATUS_ID}`);
      await page.locator(POPUP_SMOKE_SELECTORS.input).fill(`https://x.com/i/status/${STATUS_ID}`);
      await button.click();
      await page.waitForTimeout(2000);
      results.push({ check: 'status-id-probe', ok: true, detail: `submitted ${STATUS_ID}` });
    }

    console.log('\n━━━ Smoke Results ━━━');
    let allOk = true;
    for (const result of results) {
      const icon = result.ok ? '✅' : '❌';
      console.log(`  ${icon} ${result.check}: ${result.detail}`);
      if (!result.ok && result.check !== 'status-id-probe') allOk = false;
    }
    console.log('━━━━━━━━━━━━━━━━━━━━\n');

    if (!allOk) {
      bail('Smoke failed — one or more critical assertions did not pass.');
    }

    console.log('🎉 Smoke passed!');
  } finally {
    if (context) await context.close();
    rmSync(userDataDir, { recursive: true, force: true });
    rmSync(preparedExtension.tempRoot, { recursive: true, force: true });
  }
}

function prepareTemporaryExtension(sourceExtensionPath) {
  const manifestPath = join(sourceExtensionPath, 'manifest.json');
  if (!existsSync(manifestPath)) {
    bail(`No manifest.json found at ${sourceExtensionPath}. Set EXTENSION_PATH to the unpacked extension directory.`);
  }

  const tempRoot = mkdtempSync(join(tmpdir(), 'xvid-smoke-extension-'));
  const extensionDir = join(tempRoot, 'extension');
  mkdirSync(extensionDir, { recursive: true });

  for (const file of EXTENSION_FILES) {
    const source = join(sourceExtensionPath, file);
    if (existsSync(source)) cpSync(source, join(extensionDir, file));
  }
  for (const dir of EXTENSION_DIRS) {
    const source = join(sourceExtensionPath, dir);
    if (existsSync(source)) cpSync(source, join(extensionDir, dir), { recursive: true });
  }

  const { publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const extensionId = extensionIdFromPublicKeyDer(publicKey);

  const manifest = JSON.parse(readFileSync(join(extensionDir, 'manifest.json'), 'utf8'));
  manifest.key = Buffer.from(publicKey).toString('base64');
  writeFileSync(join(extensionDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`🧩 Prepared temporary extension copy (${basename(extensionDir)}) with deterministic ID ${extensionId}`);
  return { tempRoot, extensionDir, extensionId };
}

async function discoverExtensionId(context, timeoutMs = TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const sw of context.serviceWorkers()) {
      const id = extractExtensionId(sw.url());
      if (id) return id;
    }

    for (const page of context.pages()) {
      const id = extractExtensionId(page.url());
      if (id) return id;
    }

    try {
      const helperPage = context.pages()[0] ?? await context.newPage();
      const cdp = await context.newCDPSession(helperPage);
      const { targetInfos } = await cdp.send('Target.getTargets');
      await cdp.detach();
      const id = findXvidExtensionId(targetInfos);
      if (id) return id;
    } catch {
      // CDP is best-effort only.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return null;
}

function parseIntegerEnv(value, fallback) {
  const parsed = parseInt(value ?? String(fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exitCode = 1;
  throw new Error(message);
}

main().catch((err) => {
  const message = String(err.message || '');
  const expectedFailure = message.includes('Smoke failed')
    || message.includes('manifest.json')
    || message.includes('net::ERR_FAILED')
    || message.includes('Cannot find')
    || message.includes('Executable doesn');

  if (message.includes('Executable doesn') || message.includes('Cannot find')) {
    console.error('Browser executable was not found. Install Chrome/Chromium or set CHROME_PATH / PLAYWRIGHT_CHANNEL.');
  }

  if (!expectedFailure) {
    console.error('Unexpected error:', err);
  }

  process.exitCode = process.exitCode || 1;
});
