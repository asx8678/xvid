# Tweet Video Saver

A Chrome extension that adds download buttons to videos on X.com (formerly Twitter). One click to save any video — no external services, no accounts, no tracking.

## Features

- **One-click downloads** — a download button appears in every tweet's action bar (next to like, retweet, etc.)
- **Popup for full control** — paste any tweet URL, pick quality, and track download progress
- **Keyboard shortcut** — press `Alt+D` to download the video closest to the center of your screen
- **Multi-video support** — tweets with multiple videos show a badge; use the popup to pick which one
- **Privacy-first** — anonymous API used by default; authenticated API only when needed and only with your explicit permission
- **No external servers** — all requests go directly to X.com's own APIs

## Installation

### From source (developer mode)

1. Clone this repository:
   ```
   git clone https://github.com/asx8678/xvid.git
   ```

2. Open Chrome and go to `chrome://extensions`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** and select the cloned repository folder

5. The extension icon will appear in your toolbar. Pin it for easy access.

### Building the zip

To create a distributable zip file:

```
npm install
npm run build
```

The zip will be at `dist/tweet-video-saver.zip`.

## How to Use

### In-page download button

Browse X.com normally. Every tweet with a video will have a download button in its action bar:

1. Click the download button on any tweet with a video
2. The button pulses while fetching, then turns green on success
3. The video saves to your Downloads folder as `@username_tweetId_resolution.mp4`

For tweets with multiple videos, the button shows a count badge. It downloads the first video by default — use the popup for more control.

### Popup

Click the extension icon in your toolbar to open the popup:

1. Paste a tweet URL or bare tweet ID into the input field
2. Click **Fetch** to load available video qualities
3. For multi-video tweets, select which video from the dropdown
4. Pick your preferred quality
5. Click **Download** and watch the progress bar

The popup also shows your recent download history.

### Keyboard shortcut

Press `Alt+D` on any X.com page to instantly download the video from the most visible tweet on screen.

## Settings

Open the settings page from the popup footer or right-click the extension icon → **Options**.

| Setting | What it does |
|---------|-------------|
| **Default download quality** | Quality used by the in-page button (Highest, 1080p, 720p, 480p, 360p). The popup always lets you pick. |
| **Syndication-only mode** | Only use the anonymous API. X.com cannot see which account is requesting video info. Some videos (protected, age-restricted) won't be downloadable. |
| **Anonymous filenames** | Save as `video_2026-03-16T12-30-00_1280x720.mp4` instead of `@username_tweetId_1280x720.mp4`. |
| **Disable download history** | Don't store any record of downloads. Clears existing history when enabled. |
| **Allow authenticated downloads** | Grants cookie access for downloading protected or age-restricted videos. Without this, only publicly available videos can be downloaded. |

## How It Works

The extension uses two API strategies to fetch video data, tried in order:

1. **Syndication API** (anonymous) — hits `cdn.syndication.twimg.com`, no authentication needed. Works for most public tweets.

2. **GraphQL API** (authenticated fallback) — uses your existing X.com session cookies to access X.com's internal API. Required for protected accounts, age-restricted content, and some tweets where syndication returns no data.

The video files themselves are always downloaded directly from `video.twimg.com` (X.com's video CDN).

No data is sent to any third-party server. See the [Privacy Policy](PRIVACY_POLICY.md) for full details.

## Permissions

| Permission | Why |
|-----------|-----|
| `downloads` | Save video files to your Downloads folder |
| `storage` | Store settings and download history locally |
| `cookies` (optional) | Read your X.com session cookie for authenticated downloads. Only requested when you enable it in settings. |
| Host permissions (`x.com`, `twitter.com`, `twimg.com` subdomains) | Interact with X.com pages and download videos from their CDN |

## Development

### Running tests

```
npm install
npm test
```

### Project structure

```
background/       Service worker — download orchestration, caching, history
content/          Content script — button injection, tweet detection
lib/              Shared modules — API, video extraction, rate limiting, utilities
popup/            Popup UI — manual URL input, quality picker, progress tracking
options/          Settings page
shared/           Shared CSS between popup and options
tests/            Vitest unit tests
```

## License

[MIT](LICENSE)
