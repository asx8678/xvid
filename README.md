# xHelper

A Chrome extension that adds a download button to videos on x.com and saves
the highest-quality MP4.

## How it works

When you point at a post with a video, or its video starts playing, a download
icon appears in the post's action bar. Clicking it sends the post ID to the
extension's service worker, which looks the post up through X's public embed
API, picks the highest-bitrate MP4 and saves it with Chrome's downloads. On a
post without its own video, such as a quote, it saves the quoted post's video.

The whole extension is 391 lines (298 without comments and blank lines), with
no dependencies and no build step:

| File            | Lines | Job                                 |
| --------------- | ----: | ----------------------------------- |
| `content.js`    |   153 | adds the button, sends the post ID  |
| `background.js` |   163 | finds the best MP4 and downloads it |
| `content.css`   |    48 | button style                        |
| `manifest.json` |    27 | permissions and wiring              |

## Why it's light

- It doesn't watch the page: no MutationObserver, polling timers or page
  scans. It reacts only when the pointer or keyboard focus enters a post, or a
  video starts playing, and then checks just that post.
- The service worker sleeps until you click the button.
- It runs only on x.com. Apart from that it asks only for `downloads` and
  access to `cdn.syndication.twimg.com`, the post lookup.
- Measured on x.com: about 0.0015% of one CPU core while the mouse moves
  constantly, and nothing while idle.

## Install

1. Get the code: `git clone https://github.com/asx8678/xvid.git`, or download
   the ZIP from GitHub and unzip it.
2. Open `chrome://extensions` (Edge, Brave and other Chromium browsers work
   too) and turn on **Developer mode**.
3. Click **Load unpacked** and select the folder that contains
   `manifest.json`.
4. Reload any open x.com tabs.

To update, replace the files (or `git pull`), click the reload icon on the
extension's card in `chrome://extensions`, then reload x.com tabs.

## Use

- Point at a video post and click the download icon at the end of its
  reply/repost/like row. Alt/Option-click to choose where to save.
- The icon turns green when the download starts, amber if only some of a
  post's videos started, and red if it fails. Hover over it to see why.
- GIFs save as MP4. A post with several videos saves all of them. Files are
  named like `@user_1234567890_1280x720.mp4` (`_m1`, `_m2`, … for several).
- Private, deleted and restricted posts usually can't be downloaded. If the
  button stops appearing, X has likely changed its markup; the selectors are
  at the top of `content.js`.
