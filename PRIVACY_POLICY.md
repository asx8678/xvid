# Privacy Policy — Tweet Video Saver

**Last updated:** March 2026

## What this extension does

Tweet Video Saver is a browser extension that allows you to download videos from posts on X.com (formerly Twitter).

## Data collected

This extension does **not** collect, transmit, or share any personal data. All data stays on your device.

### Local storage

The extension stores the following data locally on your device using Chrome's built-in storage APIs:

- **Download history** (last 10 downloads): filename, tweet ID, username, resolution, and timestamp. Stored in `chrome.storage.local`. You can clear this by removing and reinstalling the extension.
- **Settings** (default quality preference): Stored in `chrome.storage.sync` so they sync across your Chrome browsers if sync is enabled.
- **Rate limiting timestamps**: Stored in `chrome.storage.session` and cleared when you close your browser.
- **Cached API data**: Temporarily cached in memory and cleared when the browser restarts.

### Cookies

The extension reads your X.com session cookie (`ct0`) solely to authenticate API requests to X.com on your behalf. This cookie value is **never stored, logged, or transmitted to any third party**. It is only sent back to X.com's own servers as part of authenticated API requests.

## Network requests

The extension makes requests only to the following domains, all owned by X Corp:

- `x.com` — to fetch tweet data and authenticate API requests
- `twitter.com` — legacy domain support
- `cdn.syndication.twimg.com` — to fetch public tweet data
- `abs.twimg.com` — to resolve API endpoints
- `video.twimg.com` — to download video files

**No data is sent to any other server.** There is no analytics, telemetry, or third-party tracking of any kind.

## Permissions explained

- **downloads**: Required to save video files to your Downloads folder.
- **storage**: Required to store your settings and download history locally.
- **cookies**: Required to read your X.com session cookie for authenticated API requests. The cookie is only used to communicate with X.com.
- **Host permissions** (x.com, twitter.com, twimg.com subdomains): Required to interact with X.com pages and download videos from their CDN.

## Third-party services

This extension does not use any third-party services, analytics, or tracking tools.

## Changes to this policy

If this policy changes, the updated version will be included with the extension update.

## Contact

If you have questions about this privacy policy, please open an issue on the extension's GitHub repository.
