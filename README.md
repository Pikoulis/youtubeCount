# HelmetCamHeroes · channel display

A lightweight static dashboard for an Android tablet. No installation, build step, library, font download or backend. The page shows a large subscriber count, channel views and videos; at bedtime it becomes a dim clock on a black background.

## Open and try it

Open `index.html` in a desktop browser. In **Settings**, turn on **Preview with sample numbers** to try the display without an API key. Sample numbers are explicitly labelled and never saved as real readings. Switch **Mode: Auto → Day → Night → Auto** to preview the clock. Live API access should be tested on your HTTPS-hosted site, because website-restricted API keys do not work reliably from a local file.

## Put it on GitHub Pages

1. Create a GitHub repository, for example `helmetcamheroes-dashboard`.
2. Upload the contents of this folder into the repository root: `index.html`, `styles.css`, `app.js`, `config.js`, `.nojekyll` and this README. The HTML file must be at the root, not inside another folder. `.nojekyll` is optional for these plain static files.
3. In the repository, go to **Settings → Pages → Build and deployment → Deploy from a branch**.
4. Select **main** and **/(root)**, then save.
5. Open the published URL on your tablet: `https://YOUR-USERNAME.github.io/helmetcamheroes-dashboard/`.

All asset paths are relative, so project repositories and custom domains work. No GitHub Actions workflow is needed. This delivery contains the working files; it has not created a repository or published your site.

Official publishing instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Connect your channel

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **YouTube Data API v3** in APIs & Services → Library.
3. Create an API key in APIs & Services → Credentials.
4. Restrict the key to **Websites / HTTP referrers**, allowing `https://YOUR-USERNAME.github.io/*` (or your custom domain). Use an origin-wide pattern because cross-origin requests may send only the origin as referrer. Restrict its APIs to **YouTube Data API v3** only.
5. Open dashboard **Settings** on the tablet. Enter the key and `@HelmetCamHeroes`, or the exact `UC…` channel ID from your channel settings. Turn off sample preview and save.

The handle is a configurable starting value, not a verified channel identity. After a successful request, the display uses YouTube's returned channel title; confirm it is your channel. A channel ID is the most stable identifier.

The recommended setup stores your key in this browser's local storage, not in the repository. A browser API key is still visible to anyone with access to that browser; it cannot be a secret in a static app. Always apply the website and API restrictions. Do not place OAuth tokens or private credentials in these files.

Defaults live in `config.js`. Settings saved on a tablet override defaults, including after future file updates. To use new defaults, change Settings or clear that site's browser storage (which also clears its saved counts).

The page calls `channels.list` with `part=snippet,statistics`, using either `forHandle` or `id`. The default 15-minute interval is about 96 requests per day per continuously running display, plus page loads and reconnections. Comments add at least one request per refresh, with pagination when needed (up to ten comment requests per refresh). The minimum interval is five minutes. Requests stop in sample mode or without a key. Failed requests time out after 15 seconds and retry at the normal interval.

References:
- https://developers.google.com/youtube/v3/docs/channels/list
- https://developers.google.com/youtube/v3/docs/channels
- https://docs.cloud.google.com/docs/authentication/api-keys

## Night clock and kiosk use

- Default schedule: **22:00–07:00**, using the tablet's local time and timezone. No separate automation app is required while the browser remains running.
- Change the start/end times in Settings, or disable the schedule. Overnight and same-day periods work. Equal times mean no scheduled night period.
- **Mode** cycles through Auto, Day and Night. Day/Night overrides persist until you choose Auto, save Settings, or reload the page.
- Choose 12-hour or 24-hour time in Settings. The date follows the browser locale.
- Tap **Full screen** after opening the page. Android browsers require a user gesture for full screen; a page cannot guarantee it automatically after a reboot.
- The page requests a screen wake lock after a tap when supported on HTTPS. It tries again when you return to the page. Android or browser power policies may refuse it. For unattended use, configure your kiosk browser to keep the screen on, reopen this URL at startup and hide system navigation. Test these settings on your specific tablet.
- The clock uses a black background and dim amber text. Its position shifts slightly each minute. Tap anywhere to reveal controls; they fade after five seconds but remain available to touch and keyboard.
- A webpage cannot set Android's hardware brightness, wake a powered-off screen or reliably execute while Android has suspended the browser. Use Android/kiosk brightness settings for actual dimming. Check the tablet's time, charging setup and sleep policy before leaving it unattended.

## What the numbers mean

YouTube rounds the public subscriber count down to three significant figures. This is not an exact live YouTube Studio counter. A hidden subscriber count is displayed as “Hidden”.

**Comments today** counts published top-level comments associated with the channel since midnight in the tablet’s local timezone. Replies, held-for-review comments and spam are excluded. It uses the same API key and refresh interval as subscribers. No historical collection period is required.

The app queries `commentThreads.list`, ordered by time, with 100 threads per page, continuing until it reaches older comments or the end. It checks at most ten pages per refresh; if more remain, a `+` and “Partial count” indicate a lower bound. Pagination on an actively changing channel can produce small temporary differences. At midnight the old day’s count is cleared and a new request begins. Zero means a successful check found no comments today; a dash means unavailable or not yet checked. Failed comment requests preserve only a same-day saved count, clearly labelled. Channel stats continue to update independently of comment errors.

Reference: https://developers.google.com/youtube/v3/docs/commentThreads/list

If a request fails, the last successful reading stays visible with a saved-count message and its date/time. Saved counts expire after 30 days. The app does not download a historical series, use YouTube Analytics OAuth, or fetch real data in preview mode.

## Files and troubleshooting

- `index.html` — dashboard, night clock and settings
- `styles.css` — responsive landscape/portrait layout
- `app.js` — fetching, cache/comments, schedule, controls and wake lock
- `config.js` — editable initial defaults
- `.nojekyll` — optional GitHub Pages static-file marker

**Setup needed:** enter a key in Settings. **Access denied:** check API enablement and restrictions, including your actual website origin. **Channel not found:** check the exact handle or use the channel ID. **Quota reached:** wait for the project's quota reset. **Saved count:** the last refresh failed; check connectivity and the message. If browser storage is disabled, the app still works for the current session, but cannot reliably retain settings/counts.

The page itself needs to load from its host after reopening; there is no offline service worker. A network outage while it is open leaves the clock and last loaded display working. Modern Android Chrome or an up-to-date Android WebView is recommended.

## Validation for this delivery

JavaScript syntax, local asset references and simulated application checks passed for API responses, cached failures, channel IDs/handles, hidden counts, today’s comments, sample-data isolation, unavailable storage, schedule boundaries and manual modes. Browser rendering could not be verified because this environment blocked local browser preview. Live YouTube access requires your API key and was not tested.
