<p align="center">
  <img src="icons/icon128.png" width="96" alt="Shorts Blocker icon">
</p>

<h1 align="center">Shorts Blocker</h1>

<p align="center">A Chrome extension that removes YouTube Shorts and shields you from GTA 6 spoilers.</p>

## Features

### Block Shorts

- Hides Shorts shelves on the home page, subscriptions, search results, and the watch-page sidebar
- Hides individual Shorts mixed into regular video lists
- Removes the Shorts entry from the sidebar, the Shorts tab on channel pages, and the Shorts search filter
- Opens any `/shorts/VIDEO_ID` link in the normal player (`/watch?v=VIDEO_ID`), whether you paste it or click it
- Works on `m.youtube.com` too

### GTA 6 spoiler shield

- Hides videos, posts, channels, comments, notifications, search suggestions, and player end screens that mention GTA 6
- If you open a spoiler video directly, it's paused and covered with a warning, with options to go back or watch anyway
- Videos from **@RockstarGames** are let through, so you still get the official trailers
- The toolbar badge shows how many items were hidden on the current tab

Default blocked words: `gta 6`, `gta vi`, `grand theft auto 6`, `grand theft auto vi`, `gta leak(s)`, `rockstar leak(s)`, `cyberleek`, `vice city`, `leonida`, `lucia caminos`, `jason duval`, `port gellhorn`.

Matching ignores case, and spaces in a word also match dashes or nothing, so `gta 6` catches `GTA6`, `#gta6`, and `gta-6`. Only whole words match, so `gta vi` doesn't hide "GTA Vice City" and `gta 6` doesn't hide "GTA 60fps".

## Install

1. Clone or download this repository.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the project folder.

After pulling changes, click the reload button on the extension card and refresh any open YouTube tabs.

## Settings

Click the toolbar icon to turn Shorts blocking or the spoiler shield on and off.

Click **Edit blocked words & allowed channels** in the popup (or right-click the icon → **Options**) to:

- Add or remove blocked words, one per line
- Add allowed channels by `@handle` or `UC…` channel ID
- Type a video title to check whether the filter would hide it

Settings sync across your Chrome profile.

### How the Rockstar exception works

A video is only let through if it links to an allowed channel, and every channel it links to is allowed. Display names are ignored because anyone can name their channel "Rockstar Games". Comments are never exempt, so an `@RockstarGames` mention can't sneak a spoiler through.

## How it works

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension manifest (Manifest V3) |
| `blocker.css` | Hides Shorts elements and styles the spoiler warning |
| `content.js` | Redirects in-app Shorts navigation and runs the spoiler shield |
| `rules.json` | Redirects direct `/shorts/` page loads to `/watch` |
| `shared.js` | Default settings and the word matcher, shared by every part |
| `background.js` | Turns the redirect rule on and off and updates the badge count |
| `popup.html`, `popup.js` | Toolbar popup |
| `options.html`, `options.js` | Settings page |
| `ui.css` | Shared styles for the popup and settings page |
| `tools/make-icons.js` | Draws the icon PNGs (`node tools/make-icons.js`) |

YouTube changes its page layout often. If Shorts or spoilers start showing up somewhere, the selectors in `blocker.css` (Shorts) or `TILE_SELECTOR` in `content.js` (spoilers) probably need updating.
