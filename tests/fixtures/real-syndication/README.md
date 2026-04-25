# Real Syndication Fixtures

This directory contains sanitized fixtures captured from the live
`cdn.syndication.twimg.com/tweet-result` endpoint for analysis of the
`mediaDetails` structure — specifically `media_url_https` and
`video_info.duration_millis` population.

## PII Redaction Policy

All fixtures have been sanitized of personally identifiable information:

| Field | Treatment |
|-------|-----------|
| `text` / `full_text` | Replaced with `[REDACTED]` |
| `user.name` | Replaced with `[REDACTED]` |
| `user.screen_name` | Replaced with `[REDACTED]` |
| `user.id_str` | Replaced with `[REDACTED]` |
| `user.profile_image_url_https` | Replaced with `[REDACTED]` (presence flag `_has_profile_image_url_https` added) |
| `entities.user_mentions[]` | Replaced with `{ _redacted: true }` |
| `entities.hashtags[]` | Replaced with `{ _redacted: true }` |
| `entities.urls[]` | Replaced with `{ _redacted: true }` (indices preserved) |
| `mediaDetails[].display_url` | Replaced with `[REDACTED]` |
| `mediaDetails[].expanded_url` | Replaced with `[REDACTED]` |
| `mediaDetails[].url` (t.co) | Replaced with `[REDACTED]` |
| `video.poster` | Replaced with `[REDACTED]` (presence flag `_has_poster` added) |
| `edit_control.edit_tweet_ids[]` | Replaced with `[REDACTED]` |

### Fields PRESERVED (not PII — public CDN media metadata)

| Field | Reason |
|-------|--------|
| `mediaDetails[].media_url_https` | Public CDN thumbnail URL; needed for thumbnail analysis |
| `mediaDetails[].video_info.*` | Structural metadata (duration, aspect ratio, variants) |
| `video.variants[].src` | Public CDN video URLs |
| `id_str` | Public tweet identifier |
| `favorite_count`, `conversation_count` | Public metrics |

### Presence Signals

When a field is redacted, a boolean presence flag is added so downstream
analysis can still determine field population:

- `_has_media_url_https` — whether `media_url_https` was present before redaction
- `_has_profile_image_url_https` — whether `profile_image_url_https` was present
- `_has_poster` — whether `video.poster` was present

## How to Re-run Capture

```bash
npm run capture-fixtures
# or directly:
node scripts/capture-real-fixtures.mjs
# preview without writing files:
node scripts/capture-real-fixtures.mjs --dry-run
```

## Analysis Results

See [analysis.md](./analysis.md) for the full population-rate report.
