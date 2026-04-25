# Release Notes — v2.4.0

## Thumbnail and duration previews in the media picker

- **Media preview panel.** The popup now shows a thumbnail image and formatted duration (mm:ss) for the currently selected video or animated GIF. This gives users a visual cue about which media item they're about to download, especially helpful for multi-media posts.

- **Efficient thumbnail loading.** Thumbnails use `loading="lazy"` and `decoding="async"` attributes so they don't block popup rendering or consume bandwidth for off-screen images.

- **Accessible alt text.** Each thumbnail includes descriptive alt text (e.g. "Thumbnail for Video 1") and duration badges carry an `aria-label` (e.g. "Duration: 0:30") for screen-reader users.

- **Graceful fallback.** When a post's API response lacks `media_url_https` or `duration_millis`, the preview gracefully hides the missing element. If both are absent, the preview panel is hidden entirely — no broken-image icons or placeholder noise.

- **Background metadata pass-through.** The probe response now includes `thumbnailUrl`, `durationMillis`, and `durationLabel` fields per media item, extracted from the syndication endpoint's `mediaDetails[].media_url_https` and `video_info.duration_millis`. These fields default to empty/zero when absent, preserving backward compatibility.

## Fixture analysis

Real-syndication fixture analysis confirms 14/14 (100%) video media items expose both `media_url_https` and `duration_millis`, exceeding the ≥95% threshold for conditional rendering.

## Validation performed

- Full Vitest suite passes (background, popup, content, messaging, setup, redaction tests).
- New test coverage for `formatDurationLabel`, metadata extraction via probe, and popup preview rendering/fallback/selection behavior.
