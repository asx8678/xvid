/**
 * redaction.test.js
 *
 * Regression tests for PII redaction in capture-real-fixtures.mjs.
 * Ensures that redactTweet() scrubs all user-identifiable fields
 * from tweet objects, including nested parent/quoted tweets.
 */

import { describe, it, expect } from 'vitest';
import { REDACTED, redactTweet } from '../scripts/capture-real-fixtures.mjs';

const R = '[REDACTED]';

// ── Helpers ──────────────────────────────────────────────────────────

/** Collect all string values in a nested object (recursively). */
function collectStrings(obj, path = '') {
  const results = [];
  if (obj === null || obj === undefined) return results;
  if (typeof obj === 'string') {
    results.push({ path, value: obj });
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      results.push(...collectStrings(obj[i], `${path}[${i}]`));
    }
  } else if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      results.push(...collectStrings(v, path ? `${path}.${k}` : k));
    }
  }
  return results;
}

/** Collect all values for a given key name, recursively. */
function findKeyValues(obj, key) {
  const results = [];
  if (obj === null || obj === undefined) return results;
  if (Array.isArray(obj)) {
    for (const item of obj) results.push(...findKeyValues(item, key));
  } else if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (k === key) results.push(v);
      results.push(...findKeyValues(v, key));
    }
  }
  return results;
}

// ── Test fixtures (synthetic tweet data mimicking real API shape) ────

const tweetWithParent = {
  __typename: 'Tweet',
  id_str: '111',
  text: 'Reply text with PII',
  full_text: 'Reply full_text with PII',
  in_reply_to_screen_name: 'OriginalAuthor',
  in_reply_to_status_id_str: '222',
  in_reply_to_user_id_str: '333444',
  in_reply_to_user_id: 333444,
  user: {
    id_str: '555666',
    name: 'Replier Name',
    screen_name: 'replier_handle',
    profile_image_url_https: 'https://pbs.twimg.com/profile_images/foo.jpg',
    highlighted_label: {
      description: 'Government Agency',
      badge: { url: 'https://example.com/badge.png' },
      url: { url: 'https://example.com/label', url_type: 'DeepLink' },
    },
  },
  parent: {
    __typename: 'Tweet',
    id_str: '222',
    text: 'Original parent tweet text — must be redacted',
    full_text: 'Original parent full_text — must be redacted',
    in_reply_to_screen_name: 'SomeoneElse',
    in_reply_to_user_id_str: '999',
    user: {
      id_str: '333444',
      name: 'OriginalAuthor',
      screen_name: 'OriginalAuthor',
      profile_image_url_https: 'https://pbs.twimg.com/profile_images/bar.jpg',
    },
    entities: {
      user_mentions: [{ screen_name: 'mentioned', id_str: '123' }],
      hashtags: [{ text: 'secret' }],
      urls: [{ expanded_url: 'https://example.com', indices: [0, 10] }],
    },
    edit_control: {
      edit_tweet_ids: ['222'],
    },
    mediaDetails: [
      {
        display_url: 'pic.x.com/abc',
        expanded_url: 'https://x.com/OriginalAuthor/status/222/video/1',
        url: 'https://t.co/abc',
        media_url_https: 'https://pbs.twimg.com/media/thumb.jpg',
        additional_media_info: {
          description: 'Media description with PII text',
        },
        video_info: {
          duration_millis: 30000,
          aspect_ratio: [16, 9],
          variants: [],
        },
      },
    ],
    video: {
      poster: 'https://pbs.twimg.com/media/poster.jpg',
      durationMs: 30000,
    },
  },
};

const tweetWithQuotedStatus = {
  __typename: 'Tweet',
  id_str: '444',
  text: 'Quote tweet',
  user: {
    id_str: '111',
    name: 'Quoter',
    screen_name: 'quoter',
    highlighted_label: {
      description: 'A Business',
    },
  },
  quoted_status: {
    __typename: 'Tweet',
    id_str: '555',
    text: 'Quoted tweet text — must be redacted',
    user: {
      id_str: '666',
      name: 'QuotedUser',
      screen_name: 'quoted_user',
      highlighted_label: {
        description: 'QuotedOrg',
      },
    },
  },
};

const tweetWithNoNested = {
  __typename: 'Tweet',
  id_str: '777',
  text: 'Simple tweet',
  user: {
    id_str: '888',
    name: 'SimpleUser',
    screen_name: 'simple',
  },
};

// ── Tests ────────────────────────────────────────────────────────────

describe('redactTweet', () => {
  it('redacts top-level text fields', () => {
    const result = redactTweet(tweetWithNoNested);
    expect(result.text).toBe(R);
    expect(result.user.name).toBe(R);
    expect(result.user.screen_name).toBe(R);
    expect(result.user.id_str).toBe(R);
  });

  it('redacts in_reply_to_* fields at top level', () => {
    const result = redactTweet(tweetWithParent);
    expect(result.in_reply_to_screen_name).toBe(R);
    expect(result.in_reply_to_user_id_str).toBe(R);
    expect(result.in_reply_to_user_id).toBe(R);
  });

  it('recursively redacts nested parent tweet', () => {
    const result = redactTweet(tweetWithParent);

    // Parent text must be redacted
    expect(result.parent.text).toBe(R);
    expect(result.parent.full_text).toBe(R);

    // Parent user identity must be redacted
    expect(result.parent.user.name).toBe(R);
    expect(result.parent.user.screen_name).toBe(R);
    expect(result.parent.user.id_str).toBe(R);
    expect(result.parent.user.profile_image_url_https).toBe(R);

    // Parent reply identity must be redacted
    expect(result.parent.in_reply_to_screen_name).toBe(R);
    expect(result.parent.in_reply_to_user_id_str).toBe(R);

    // Parent entities must be redacted
    expect(result.parent.entities.user_mentions[0]._redacted).toBe(true);
    expect(result.parent.entities.hashtags[0]._redacted).toBe(true);
    expect(result.parent.entities.urls[0]._redacted).toBe(true);

    // Parent edit_control IDs must be redacted
    expect(result.parent.edit_control.edit_tweet_ids[0]).toBe(R);

    // Parent mediaDetails display URLs redacted, structure preserved
    expect(result.parent.mediaDetails[0].display_url).toBe(R);
    expect(result.parent.mediaDetails[0].expanded_url).toBe(R);
    expect(result.parent.mediaDetails[0].url).toBe(R);
    expect(result.parent.mediaDetails[0].media_url_https).toBeTruthy();
    expect(result.parent.mediaDetails[0].additional_media_info.description).toBe(R);

    // Parent video poster redacted
    expect(result.parent.video.poster).toBe(R);
  });

  it('redacts quoted_status recursively', () => {
    const result = redactTweet(tweetWithQuotedStatus);

    expect(result.quoted_status.text).toBe(R);
    expect(result.quoted_status.user.name).toBe(R);
    expect(result.quoted_status.user.screen_name).toBe(R);
    expect(result.quoted_status.user.id_str).toBe(R);
    expect(result.quoted_status.user.highlighted_label.description).toBe(R);
  });

  it('redacts user.highlighted_label.description', () => {
    const result = redactTweet(tweetWithParent);
    expect(result.user.highlighted_label.description).toBe(R);
    expect(result.user.highlighted_label.badge.url).toBe(R);
    expect(result.user.highlighted_label.url.url).toBe(R);
  });

  it('does not leave any unredacted user identity strings', () => {
    // Build a combined fixture that exercises all code paths
    const allFixtures = [tweetWithParent, tweetWithQuotedStatus, tweetWithNoNested];

    for (const fixture of allFixtures) {
      const result = redactTweet(fixture);
      const strings = collectStrings(result);

      // PII field names that should never contain unredacted values
      const piiKeys = [
        'text', 'full_text', 'name', 'screen_name',
        'in_reply_to_screen_name', 'in_reply_to_user_id_str',
        'profile_image_url_https',
      ];

      for (const s of strings) {
        const lastKey = s.path.split('.').pop();
        if (piiKeys.includes(lastKey)) {
          expect(s.value).toBe(R);
        }
      }
    }
  });

  it('redacts highlighted_label.description in all nested tweets', () => {
    const result = redactTweet(tweetWithQuotedStatus);
    const descriptions = findKeyValues(result, 'description');
    for (const d of descriptions) {
      // Any description that was a string should now be REDACTED
      if (typeof d === 'string') {
        expect(d).toBe(R);
      }
    }
  });
});

describe('real-syndication fixtures (regression)', () => {
  it('should have no unredacted PII in any fixture JSON', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const fixtureDir = join(
      import.meta.url.replace('file://', '').replace(/tests\/.*/, ''),
      'tests/fixtures/real-syndication'
    );

    let files;
    try {
      files = readdirSync(fixtureDir).filter((f) => f.endsWith('.json') && f !== 'analysis.json');
    } catch {
      // No fixtures dir yet — skip gracefully
      return;
    }

    const piiPatterns = [
      { key: 'text', check: (v) => v !== R && typeof v === 'string' && v.length > 0 },
      { key: 'name', check: (v) => v !== R && typeof v === 'string' && v.length > 0 },
      { key: 'screen_name', check: (v) => v !== R && typeof v === 'string' && v.length > 0 },
      { key: 'in_reply_to_screen_name', check: (v) => v !== R && typeof v === 'string' && v.length > 0 },
      { key: 'in_reply_to_user_id_str', check: (v) => typeof v === 'string' && /^\d+$/.test(v) },
      { key: 'in_reply_to_user_id', check: (v) => typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v)) },
      // description under highlighted_label or additional_media_info is PII
      { key: 'description', check: (v) => v !== R && typeof v === 'string' && v.length > 0 },
    ];

    const violations = [];

    // Keys named 'description' are only PII when inside highlighted_label or additional_media_info
    // but we're conservative: any unredacted 'description' string is flagged.
    function checkObj(obj, path, file) {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.forEach((item, i) => checkObj(item, `${path}[${i}]`, file));
        return;
      }
      for (const [k, v] of Object.entries(obj)) {
        const p = path ? `${path}.${k}` : k;
        for (const rule of piiPatterns) {
          if (k === rule.key && rule.check(v)) {
            // Skip 'description' in structural contexts (e.g., edit_control descriptions)
            // that aren't PII — but highlighted_label.description and
            // additional_media_info.description ARE PII. Since we're being
            // conservative, flag all unredacted description strings.
            violations.push(`${file}: ${p} = ${JSON.stringify(v)}`);
          }
        }
        checkObj(v, p, file);
      }
    }

    for (const file of files) {
      const raw = readFileSync(join(fixtureDir, file), 'utf-8');
      const data = JSON.parse(raw);
      checkObj(data, '', file);
    }

    expect(violations, `Unredacted PII found:\n${violations.join('\n')}`).toHaveLength(0);
  });
});
