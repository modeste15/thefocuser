# The Focuser

A Chrome / Edge browser extension that blocks distracting social networks and redirects you to a motivational page to keep you on track.

---

## Features

- **Blocks social networks** — Facebook, Instagram, Twitter/X, TikTok blocked by default
- **Two-layer blocking** — `declarativeNetRequest` at the network level + a content script fallback that catches SPA client-side navigations (e.g. x.com/home → x.com/messages)
- **Custom blocklist** — add or remove any domain from the settings page
- **Attempt counter** — tracks how many times you tried to visit each blocked site
- **Motivational blocked page** — shows a random illustration, a handwritten-style message, and a focus quote; redirects you to Coursera
- **Persistent settings** — blocked sites sync across devices via `chrome.storage.sync`

---

## Installation (Developer Mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the `thefocus/` folder
5. The extension icon appears in your toolbar

---

## File Structure

```
thefocus/
├── manifest.json       # Extension manifest (MV3)
├── background.js       # Service worker — manages blocking rules and visit counts
├── content.js          # Content script — fallback blocker + SPA navigation detection
├── blocked.html/css/js # The "Get Focus" page shown when a blocked site is visited
├── options.html/css/js # Settings page — add/remove sites, view attempt counts
├── logo.png            # Extension icon
└── images/             # Illustrations shown randomly on the blocked page (1–7.png)
```

---

## How It Works

### Blocking

When you navigate to a blocked site, two mechanisms fire:

1. **`declarativeNetRequest` rules** (background.js) — redirect the request at the network level before the page loads, using a precise regex filter: `^https?://([a-z0-9-]+\.)*domain\.com([/?#]|$)`
2. **Content script** (content.js) — runs at `document_start` as a fallback; also hooks `history.pushState` and `popstate` to catch in-app navigations on single-page apps like X/Twitter

Both layers redirect to `blocked.html?site=SiteName`.

### Blocked Page

Displays:
- A playful "AH BRO, [SITE NAME]" heading
- A random motivational quote
- A random illustration from `images/`
- A **Go to Coursera** button as a productive alternative

### Visit Counting

Every time `blocked.html` loads it sends a `countVisit` message to the background service worker, which increments a counter in `chrome.storage.local` keyed by site name. Counts are visible in the settings page.

---

## Settings Page

Open via: right-click the extension icon → **Options**, or `chrome://extensions` → **Details** → **Extension options**.

| Feature | Description |
|---|---|
| Add a site | Enter a domain (e.g. `reddit.com`) and an optional label, then press **Add** or Enter |
| Remove a site | Click **Remove** next to any entry (including defaults) |
| Attempt counts | Each row shows how many times you tried to visit that site |
| Reset counts | Clears all attempt counters back to zero |
| Default badge | Sites pre-seeded on install are labelled **default** |

Domain validation strips `https://`, `www.`, and paths automatically, so you can paste a full URL.

---

## Blocked Sites (Defaults)

| Domain | Label |
|---|---|
| `facebook.com` | Facebook |
| `instagram.com` | Instagram |
| `twitter.com` | Twitter |
| `x.com` | X (Twitter) |
| `tiktok.com` | TikTok |

---

## Permissions

| Permission | Why |
|---|---|
| `declarativeNetRequest` | Redirect blocked URLs at the network level |
| `storage` | Save the blocked sites list and visit counts |
| `host_permissions: <all_urls>` | Required so blocking rules and the content script work for any user-added domain |

---

## Browser Compatibility

| Browser | Support |
|---|---|
| Chrome 88+ | Full (Manifest V3) |
| Edge 88+ | Full (Chromium-based) |
| Firefox | Not supported (uses MV2) |
