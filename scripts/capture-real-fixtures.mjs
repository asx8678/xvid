#!/usr/bin/env node

/**
 * capture-real-fixtures.mjs
 *
 * Fetches real cdn.syndication.twimg.com tweet-result responses,
 * redacts PII, and writes sanitized fixtures + analysis report.
 *
 * Usage:
 *   node scripts/capture-real-fixtures.mjs          # fetch all
 *   node scripts/capture-real-fixtures.mjs --dry-run # preview without writing
 *
 * Output:
 *   tests/fixtures/real-syndication/<tweet-id>.json   — sanitized per-tweet fixtures
 *   tests/fixtures/real-syndication/analysis.json      — structured analysis
 *   tests/fixtures/real-syndication/analysis.md        — human-readable report
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const FIXTURE_DIR = join(PROJECT_ROOT, 'tests', 'fixtures', 'real-syndication');

const REDACTED = '[REDACTED]';

// ── Candidate tweet IDs (all verified public video tweets) ──────────
const TWEET_IDS = [
  '2047785574757478731',
  '2047785307236413636',
  '2047737165308674546',
  '2047734958077202845',
  '2047018269446455578',
  '2046602263162949685',
  '2046595795583955209',
  '2042757356610818106',
  '2042756933686337713',
  '2047740381690011787',
  '2047709335204102318',
  '2047033500486791223',
  '2046632310921924717',
  '2046355025266671693',
];

// ── Fetch ───────────────────────────────────────────────────────────

async function fetchTweet(id) {
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'xvid-fixture-capture/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for tweet ${id}`);
  return res.json();
}

// ── PII Redaction ───────────────────────────────────────────────────

/**
 * Redact PII-sensitive fields while preserving mediaDetails structure
 * needed for x-6dc analysis (media_url_https, duration_millis, etc.).
 *
 * Strategy:
 *  - Tweet text → REDACTED (content is PII)
 *  - User identity fields → REDACTED
 *  - Entities with user mentions → redact mention details
 *  - mediaDetails.media_url_https → KEPT (public CDN media, not PII;
 *    needed for thumbnail analysis). Boolean _has_media_url_https added
 *    as explicit presence signal.
 *  - video_info → KEPT intact (duration_millis, aspect_ratio, variants
 *    are structural, not PII)
 *  - Top-level `video` object → redact poster URL, keep structure
 */
function redactTweet(raw) {
  // Deep clone to avoid mutating original
  const t = structuredClone(raw);

  // ── Text ──────────────────────────────────────────────────────
  if ('text' in t) t.text = REDACTED;
  if ('full_text' in t) t.full_text = REDACTED;

  // ── User ──────────────────────────────────────────────────────
  if (t.user) {
    const u = t.user;
    u.name = REDACTED;
    u.screen_name = REDACTED;
    if ('id_str' in u) u.id_str = REDACTED;
    if ('profile_image_url_https' in u) {
      u._has_profile_image_url_https = true;
      u.profile_image_url_https = REDACTED;
    }
    if (u.highlighted_label) {
      if ('description' in u.highlighted_label) {
        u.highlighted_label.description = REDACTED;
      }
      if (u.highlighted_label.badge?.url) {
        u.highlighted_label.badge.url = REDACTED;
      }
      if (u.highlighted_label.url?.url) {
        u.highlighted_label.url.url = REDACTED;
      }
    }
  }

  // ── Entities ──────────────────────────────────────────────────
  if (t.entities) {
    // Redact user mention details
    if (Array.isArray(t.entities.user_mentions)) {
      t.entities.user_mentions = t.entities.user_mentions.map(() => ({
        _redacted: true,
      }));
    }
    // Redact hashtag text
    if (Array.isArray(t.entities.hashtags)) {
      t.entities.hashtags = t.entities.hashtags.map(() => ({
        _redacted: true,
      }));
    }
    // Redact URL details but keep indices
    if (Array.isArray(t.entities.urls)) {
      t.entities.urls = t.entities.urls.map((u) => ({
        indices: u.indices,
        _redacted: true,
      }));
    }
    // Redact media in entities but keep indices
    if (Array.isArray(t.entities.media)) {
      t.entities.media = t.entities.media.map((m) => ({
        indices: m.indices,
        _redacted: true,
      }));
    }
  }

  // ── Edit control ──────────────────────────────────────────────
  if (t.edit_control?.edit_tweet_ids) {
    t.edit_control.edit_tweet_ids = t.edit_control.edit_tweet_ids.map(
      () => REDACTED
    );
  }

  // ── mediaDetails: PRESERVE media_url_https and video_info ─────
  // These are public CDN URLs for media assets, not PII.
  // Add explicit presence boolean for analysis.
  if (Array.isArray(t.mediaDetails)) {
    t.mediaDetails = t.mediaDetails.map((md) => {
      const out = { ...md };
      out._has_media_url_https = 'media_url_https' in md;
      // Redact display/expanded/t.co URLs (may contain user handles)
      if ('display_url' in out) out.display_url = REDACTED;
      if ('expanded_url' in out) out.expanded_url = REDACTED;
      if ('url' in out) out.url = REDACTED;
      // Redact additional_media_info.description (may contain tweet text)
      if (out.additional_media_info?.description) {
        out.additional_media_info.description = REDACTED;
      }
      return out;
    });
  }

  // ── Top-level video object (legacy format) ───────────────────
  if (t.video) {
    if (t.video.poster) {
      t.video._has_poster = true;
      t.video.poster = REDACTED;
    }
    // Keep durationMs, aspectRatio, variants — structural not PII
  }

  // ── Reply identity fields ───────────────────────────────────
  if ('in_reply_to_screen_name' in t) t.in_reply_to_screen_name = REDACTED;
  if ('in_reply_to_user_id_str' in t) t.in_reply_to_user_id_str = REDACTED;
  if ('in_reply_to_user_id' in t) t.in_reply_to_user_id = REDACTED;

  // ── Quoted / retweeted / parent status ────────────────────────
  if (t.quoted_status) {
    t.quoted_status = redactTweet(t.quoted_status);
  }
  if (t.retweeted_status) {
    t.retweeted_status = redactTweet(t.retweeted_status);
  }
  if (t.parent) {
    t.parent = redactTweet(t.parent);
  }

  return t;
}

// ── Analysis ────────────────────────────────────────────────────────

function analyzeFixture(id, fixture) {
  const media = fixture.mediaDetails || fixture.media_details || [];
  return {
    id,
    typename: fixture.__typename || 'unknown',
    mediaCount: media.length,
    media: media.map((m) => ({
      type: m.type,
      has_media_url_https: !!m.media_url_https,
      media_url_https_present: m._has_media_url_https ?? ('media_url_https' in m),
      has_video_info: !!m.video_info,
      duration_millis: m.video_info?.duration_millis ?? null,
      aspect_ratio: m.video_info?.aspect_ratio ?? null,
      variant_count: m.video_info?.variants?.length ?? 0,
    })),
  };
}

function buildReport(results) {
  const totalMedia = results.reduce((s, r) => s + r.mediaCount, 0);
  const videoGifMedia = results.flatMap((r) => r.media).filter(
    (m) => m.type === 'video' || m.type === 'animated_gif'
  );
  const videoGifCount = videoGifMedia.length;

  const withMediaUrl = videoGifMedia.filter((m) => m.has_media_url_https).length;
  const withDuration = videoGifMedia.filter((m) => m.duration_millis !== null).length;
  const withAspectRatio = videoGifMedia.filter((m) => m.aspect_ratio !== null).length;
  const withVariants = videoGifMedia.filter((m) => m.variant_count > 0).length;

  const mediaUrlRate = videoGifCount > 0
    ? ((withMediaUrl / videoGifCount) * 100).toFixed(1) : 'N/A';
  const durationRate = videoGifCount > 0
    ? ((withDuration / videoGifCount) * 100).toFixed(1) : 'N/A';
  const aspectRate = videoGifCount > 0
    ? ((withAspectRatio / videoGifCount) * 100).toFixed(1) : 'N/A';
  const variantRate = videoGifCount > 0
    ? ((withVariants / videoGifCount) * 100).toFixed(1) : 'N/A';

  return {
    captured: results.length,
    totalMediaItems: totalMedia,
    videoAndGifMediaItems: videoGifCount,
    populationRates: {
      media_url_https: { populated: withMediaUrl, total: videoGifCount, rate: mediaUrlRate },
      duration_millis: { populated: withDuration, total: videoGifCount, rate: durationRate },
      aspect_ratio: { populated: withAspectRatio, total: videoGifCount, rate: aspectRate },
      variants: { populated: withVariants, total: videoGifCount, rate: variantRate },
    },
    perTweet: results,
  };
}

function reportToMarkdown(report) {
  const lines = [
    '# Real Syndication Fixture Analysis',
    '',
    `**Captured**: ${report.captured} tweets`,
    `**Total media items**: ${report.totalMediaItems}`,
    `**Video/animated_gif items**: ${report.videoAndGifMediaItems}`,
    '',
    '## Population Rates (video & animated_gif only)',
    '',
    '| Field | Populated | Total | Rate |',
    '|-------|-----------|-------|------|',
  ];

  for (const [field, data] of Object.entries(report.populationRates)) {
    lines.push(
      `| \`${field}\` | ${data.populated} | ${data.total} | ${data.rate}% |`
    );
  }

  const mr = report.populationRates.media_url_https.rate;
  const dr = report.populationRates.duration_millis.rate;
  const targetMet = parseFloat(mr) >= 95 && parseFloat(dr) >= 95;

  lines.push('');
  if (targetMet) {
    if (mr === '100.0' && dr === '100.0') {
      lines.push(
        '> **✅ Target MET**: Both `media_url_https` and `duration_millis` ' +
        'are populated at **100%** — exceeds the ≥95% target.'
      );
    } else {
      lines.push(
        `> **✅ Target MET**: ` +
        `\`media_url_https\` at ${mr}%, ` +
        `\`duration_millis\` at ${dr}% — both ≥95%.`
      );
    }
  } else {
    lines.push(
      `> **❌ Target NOT MET**: ` +
      `\`media_url_https\` at ${mr}%, ` +
      `\`duration_millis\` at ${dr}% — need ≥95%.`
    );
  }

  lines.push('', '## Per-Tweet Breakdown', '');
  lines.push('| Tweet ID | Media Count | Types | media_url_https | duration_millis |');
  lines.push('|----------|-------------|-------|----------------|-----------------|');

  for (const r of report.perTweet) {
    const types = r.media.map((m) => m.type).join(', ') || 'none';
    const hasUrl = r.media.map((m) => m.has_media_url_https ? '✅' : '❌').join(' ') || '—';
    const dur = r.media.map((m) => m.duration_millis !== null ? `${m.duration_millis}ms` : '❌').join(', ') || '—';
    lines.push(`| ${r.id} | ${r.mediaCount} | ${types} | ${hasUrl} | ${dur} |`);
  }

  lines.push('', '## How to Re-run', '', '```bash', 'npm run capture-fixtures', '# or:', 'node scripts/capture-real-fixtures.mjs', '```');

  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const startTime = Date.now();

  console.log(`\n🐶 Fetching ${TWEET_IDS.length} tweets from cdn.syndication.twimg.com...`);
  if (dryRun) console.log('   (dry-run: no files will be written)\n');

  const results = [];
  const errors = [];

  for (const id of TWEET_IDS) {
    try {
      process.stdout.write(`  Fetching ${id}... `);
      const raw = await fetchTweet(id);
      const sanitized = redactTweet(raw);
      const analysis = analyzeFixture(id, sanitized);

      results.push(analysis);

      if (!dryRun) {
        mkdirSync(FIXTURE_DIR, { recursive: true });
        writeFileSync(
          join(FIXTURE_DIR, `${id}.json`),
          JSON.stringify(sanitized, null, 2) + '\n'
        );
      }

      const types = analysis.media.map((m) => m.type).join(', ');
      console.log(`✅ ${types || 'no media'}`);
    } catch (err) {
      errors.push({ id, error: err.message });
      console.log(`❌ ${err.message}`);
    }
  }

  const report = buildReport(results);

  if (!dryRun) {
    writeFileSync(
      join(FIXTURE_DIR, 'analysis.json'),
      JSON.stringify(report, null, 2) + '\n'
    );
    writeFileSync(
      join(FIXTURE_DIR, 'analysis.md'),
      reportToMarkdown(report) + '\n'
    );
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n📊 Results (${elapsed}s):`);
  console.log(`   Captured:   ${report.captured}/${TWEET_IDS.length}`);
  console.log(`   Video/GIF:  ${report.videoAndGifMediaItems}`);
  console.log(`   media_url_https:  ${report.populationRates.media_url_https.rate}%`);
  console.log(`   duration_millis:  ${report.populationRates.duration_millis.rate}%`);
  console.log(`   aspect_ratio:     ${report.populationRates.aspect_ratio.rate}%`);
  console.log(`   variants:         ${report.populationRates.variants.rate}%`);

  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} errors:`);
    for (const e of errors) console.log(`   ${e.id}: ${e.error}`);
  }

  if (!dryRun) {
    console.log(`\n📁 Written to ${FIXTURE_DIR}/`);
  }

  // Exit non-zero if we got fewer than 10 good fixtures
  if (results.length < 10) {
    console.error(`\n❌ Only ${results.length} fixtures captured (need ≥10)`);
    process.exit(1);
  }

  console.log('\n🐶 Done!\n');
}

// ── Exports (import-safe: no CLI execution on import) ──────────────

export { REDACTED, redactTweet, analyzeFixture, buildReport, reportToMarkdown };

// ── CLI entry point (only runs when executed directly) ─────────────

const isMain = process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
