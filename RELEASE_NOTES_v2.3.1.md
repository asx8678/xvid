# Release Notes — v2.3.1

## Permission tightening

- **Removed `activeTab` permission.** This permission was added in v2.3.0 but is redundant with the existing `host_permissions` for x.com, twitter.com, and mobile.twitter.com. The popup's auto-prefill feature continues to work on X/Twitter tabs (covered by `host_permissions`); on non-matching tabs it correctly falls back to the "Paste a post URL" prompt.

## Rationale

The `chrome.tabs.query({active: true, currentWindow: true})` call in `popup.js` populates `tab.url` when the extension has a matching `host_permissions` entry for the tab's origin. Since all supported sites (x.com, twitter.com, mobile.twitter.com) are already listed in `host_permissions`, `activeTab` provides no additional capability. Removing it tightens the extension's permission surface.
