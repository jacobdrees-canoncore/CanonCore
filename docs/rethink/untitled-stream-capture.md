# Capturing untitled.stream's design and DOM

Research note, 29 Sep 2026. Question: how to capture every screen of https://untitled.stream
closely enough to rebuild its exact design and DOM for CanonCore. Jacob reports that the site
owner has given permission.

**Scope, as set by Jacob:** design and DOM only. No audio or media capture, and no working
offline replica. Audio files are out of scope. For the record, playback is progressive HTTP
through an `<audio>` element fed by short-lived signed Supabase Storage URLs, with no HLS or DRM
in the player bundle (observed in `/assets/audio-context-*.js`).

Observed with Playwright MCP (Chromium, logged out) and `curl`. The request count was small, and
there were no logins, form submits, uploads or media downloads. "Observed" below means seen
directly in the live site's responses on 29 Sep 2026.

## 1. What the site is and how it is built

- **Product.** "[untitled], a sacred place for your work-in-progress music". Musicians use it to
  upload, organise and share unreleased tracks: projects, folders, versions, share links with
  listen notifications, comments, pitch/speed, loop/trim and a shop/vinyl feature (observed,
  landing page copy). There are native iOS, Android and macOS apps (observed, footer links).
- **Who runs it.** The legal entity is **Sin Titulo Inc.** (observed, `/terms`, "Last Updated
  Date: January 23, 2026"). The page credits "Made in Brooklyn, NY". The `<meta name="author">`
  names Ryan Sheehan, Stephan Diederich, Jeremy Press and Collin Burger (observed).
- **Framework: Remix v2 on Vite, with server-side rendering.** The evidence:
  - `window.__remixContext` and `window.__remixManifest` are present, and `__NEXT_DATA__` is not.
  - Assets are hashed Vite chunks under `/assets/`, for example `entry.client-*.js`,
    `root-*.js` and `manifest-dfb300dd.js`.
  - Remix future flags are set (`v3_routeConfig: true`, `v3_singleFetch: false`,
    `v3_lazyRouteDiscovery: false`).
  - All observed.
- **Libraries seen in chunk names (observed):**
  - React Query (`QueryClientProvider`, `useQuery`)
  - XState (`xstate-react.esm`)
  - Framer Motion style hooks (`use-spring`, `use-presence`, `MotionConfigContext`)
  - Radix-style primitives (`dialog`, `dropdown-menu`, `accordion`, `switch`, `scroll-area`)
  - ProseMirror (a stylesheet)
  - Zod (`zod.gen`)
- **Styling: Tailwind CSS v4.** The evidence, all observed in `app-COSPipnk.css` (138 KB):
  - Cascade layers `@layer properties, theme, base, components, utilities`.
  - `--tw-*` custom properties.
  - Utility classes in the DOM, such as `absolute inset-[7%] rounded-full bg-black/10`.
  - A custom design-token layer with 118 non-`--tw` variables, including:
    - type scale: `--super-title-size`, `--large-title-size`, `--title-*`, `--subhead-*`,
      `--body-*`, `--footnote-*`, `--note-mono-*`
    - brand colours: `--color-untitled-pink`, `--color-untitled-blue`, `--color-daw-*`
    - semantic colours: `--color-primary-background`, `--color-primary-label`,
      `--color-border`, `--color-hover`
    - layout: `--header-height`
  - Theme is a `data-theme="light"` attribute on `<html>`, plus `prefers-color-scheme` rules
    (82 dark or theme references in the CSS).
- **Breakpoints in the CSS (observed):** min-width 400, 480, 561, 640, 768, 940, 1000, 1200 and
  1600px; max-width 768px; max-height 600px; min-height 900px. There are also `hover:hover`,
  `prefers-reduced-motion` and `forced-colors` queries.
- **Fonts.**
  - Untitled Sans in Regular, Italic, Medium and Bold, plus IBM Plex Mono, as WOFF2 and WOFF
    from `/assets/` (observed, `fonts-*.css`).
  - Untitled Sans is a **commercial typeface by Klim Type Foundry** and needs a paid web licence
    (https://klim.co.nz/fonts/untitled-sans/). The site owner's permission does not cover it.
  - IBM Plex Mono is licensed under the SIL Open Font License 1.1
    (https://github.com/IBM/plex/blob/master/LICENSE.txt, read 29 Sep 2026).
  - Klim's licences let a web or app licensee share fonts "only with developers or third-party
    services" (https://klim.co.nz/licences/, site build 28 Sep 2026), so the owner cannot pass
    his copy on. Jacob bought Untitled Sans himself on 29 Sep 2026 (section 4, D10).
- **Icons.** There is no SVG sprite (`svg use` count 0). Each icon is a small React component in
  its own chunk returning inline `<svg>`, for example `pause-*.js`, `close-*.js` and
  `chevron-right-*.js` (observed). Capturing the DOM captures the icons as inline SVG.
- **Images.** Disc artwork is under `/core-assets/discs/disc-{1..4}.webp`, and favicons and
  touch icons are at the root (observed).
- **Hosts (observed):**

  | Host | Role | Front |
  | --- | --- | --- |
  | `untitled.stream` | App | Cloudflare |
  | `sb.untitled.stream` | Supabase custom domain; the fallback in the bundle is `tyymaqwprqsupipyalpj.supabase.co` | Cloudflare |
  | `auth.untitled.stream/v1` | Auth API | Cloudflare |
  | `wss://reverb.untitled.stream` | Realtime WebSocket | Fastly (`t.sni.global.fastly.net`) |
  | `jobs.untitled.stream` | Jobs site | Framer (`sites.framer.app`) |

  The site also sends telemetry to Datadog RUM and Mixpanel (chunk names; Mixpanel host
  `api-js.mixpanel.com` is in the bundle).
- **Bot protection (observed).** Every host answers plain `curl` with `HTTP 403`,
  `cf-mitigated: challenge` and a "Just a moment..." page. That includes `/robots.txt` and the
  public storage bucket. A real Chromium session (Playwright MCP) passed the managed challenge
  without interaction.

## 2. Public vs behind login

**Route discovery is solved by the Remix manifest.** `window.__remixManifest.routes` ships every
route id, path, parent and loader/action flag to every visitor (observed: over 300 entries,
including all `api/*`, `task/*` and `webhook/*` endpoints). A capture script can build the full
screen list from it rather than crawling links. The screen routes, split by what a logged-out
visitor gets:

- **Public, HTTP 200 while logged out** (observed via `fetch(..., {redirect:'manual'})`):
  - `/` (the landing page), `/pricing`, `/trust`, `/terms`, `/privacy`, `/cookie-policy`,
    `/licenses`
  - `/shop` and `/shop/vinyl`
  - `/login`, which offers Google, Apple and phone sign-in
- **Redirect to `/login` when logged out** (observed):
  - `/library`, the main app, with child routes:
    - `project/:projectSlug`, with `comments`, `note`, `attachments`, `signature`, `embed`
    - `project/:projectSlug/track/:trackSlug/{comments,versions,note,attachments,embed}`
    - `track/:trackSlug`
    - `folder/:folderSlug`
    - `project/insights/...` and `track/insights/...`
  - `/profile/*`: `membership`, `devices`, `notifications`, `sign-in-security`, `referrals`,
    `purchases`, `invoices`, `selling`, `passcode`
  - `/membership`, `/register`, `/notifications`, `/following`, `/careers`
- **Public only with a real slug or code**, not enumerable without data:
  - `/u/:username` (with `saved` and `follows`) and `/:username`
  - `/invite/:code`, `/embed/:code`, `/refer/:code`
  - `/buy/project/:projectSlug` (with `embed`) and `/shop/vinyl/:projectSlug`
- **Auth-flow screens:**
  - `/_auth-v2` sign-in and sign-up with `phone`, `email`, `recovery` and `device` steps; the
    feature flag `auth-v2` is currently false (observed, root loader data)
  - `/onboarding/*`, `/recover/*`, `/account-recovery`
- **robots.txt:** there is none. `/robots.txt` falls through to the `:username` route and returns
  404 JSON `"User not found"` (observed).
- **sitemap.xml:** lists only `/register`, `/pricing`, `/login`, `/terms`, `/trust` and `/shop`
  (observed).
- **Deep links:** `/.well-known/apple-app-site-association` lists `/library`, `/library/*`,
  `/buy/project/*`, `/invite/*`, `/refer/*` and `/u/*` for the iOS and macOS apps (observed).
  That confirms which web routes mirror native screens.

### Terms of Use clauses that apply

These are observed in `/terms`, section "User Conduct and Certain Restrictions". Users may not:

- (i) "reproduce, distribute, host or otherwise commercially exploit the Service"
- (iv) "modify, translate, adapt, merge, make derivative works of, ... reverse engineer any part
  of the Service"
- (v) "use any manual or automated software ... (including ... spiders, robots, scrapers,
  crawlers ...) to 'scrape' or download data from any web pages contained in the Service"

The only carve-out in (v) is for public search engines, and it excludes "caches or archives".

**Consequence:** a DOM capture and design rebuild is exactly what (iv) and (v) prohibit by
default. The owner's permission is the only thing that makes it acceptable. Jacob reports that
permission as verbal, and chose to proceed on it without a written record (section 4, D2).

### Whose content is in a captured DOM

The terms say "[untitled] does not claim ownership of Your Content". Users grant [untitled] a
licence limited to "operating and providing the Service" (observed, "License to Your Content").
In any logged-in DOM capture, the following belong to the artists and other users, not the site
owner:

- track names, project names and artwork
- usernames and avatars
- comments and notes
- waveforms, which are derived from their audio

The owner cannot grant rights to them. **Replace them with placeholder data before a capture is
stored or shared.** The design, layout, components, icons, copy and tokens are the owner's. The
Untitled Sans font files are Klim's, under the owner's licence, so they do not transfer either;
the replica uses Jacob's own licence.

### Logged-in observation (29 Sep 2026, about 16:00)

**Which browser.** Jacob's session was in the **Playwright MCP browser**, not Orca's. Two things
show this:

- `orca tab list --worktree all` showed no untitled.stream tab.
- The Playwright tab was on `/library` with `root.authUser` set in `__remixContext` loader data.

**What was done.** Observation only: page loads (GETs), an accessibility snapshot, screenshots
and `getComputedStyle` reads. Nothing was clicked, dismissed, submitted or uploaded. The raw
captures are in the session scratchpad, not the repo. They show Jacob's username, so they are
not for sharing.

- **The account is empty.** The profile page says "0 of 25 tracks used" (Free plan), and the
  library loader returns `projects: []` and `folders: []`.
  - So **no project, track or player-bar screen exists to capture**. Creating one would need an
    upload, which was out of bounds for this research.
  - Jacob has since made the account a sandbox for the capture to seed itself (section 4, D3).
- **`/library` (empty state):**
  - Structure: a sticky `<header>` (`sticky top-0 z-5 px-24 py-20 sm:px-64 sm:py-32`) holding
    the bracketed wordmark link and three icon buttons: notifications, `/profile`, search.
  - Main area: an empty state with the heading "Start your first project", a subline, an
    "Add audio" button and a "Create new +" control.
  - Overlays on top, shown on first visit: an "Open in macOS app?" toast (Always / Once / close),
    a "What's New / Version 1.9.9" dialog (Radix-style, centred with
    `fixed top-1/2 left-1/2 -translate-*`), and the cookie consent sheet (`frost-background`,
    `rounded-16`, bottom-anchored, `max-w-[500px]`).
  - Loader keys: `projects`, `folders`, `hasUnseenNotifications`, `user`,
    `announcementKeyToShow`. The `user` fields include `track_count`, `track_limit`,
    `tracks_remaining`, `is_member`, `profile_disc`, `free_stem_splits_*` and others. Values
    were not recorded.
  - Screenshots were taken at 375, 768 and 1728px.
- **`/profile`:** the structure, top to bottom:
  - header with back and menu
  - "Edit profile" button (disc avatar)
  - username button, "Joined" date and "Edit info"
  - dismissible "Profile / Set up" card linking to `/u/:username`
  - link rows: Subscription (plan), Referrals, Redeem code
  - track-quota meter
  - "Try [membership]" upsell with "Subscribe now" linking to `/membership/signup`
  - "Download apps"
  - Selling and Purchases
  - Notifications
  - toggles for "Dark mode" and "Open in macOS app"; the switch is Radix-style, classes
    `bg-shading data-[state='checked']:bg-green h-[28px] w-[44px] rounded-full`
  - footer links: shop, Instagram, contact, trust, terms, privacy, licences
  - A full-page screenshot was taken at 768px.
- **Resolved light-theme tokens** (from `getComputedStyle(:root)`), proving the token capture
  works:

  | Token | Value |
  | --- | --- |
  | `--color-primary-background` | `#fff` |
  | `--color-secondary-background` | `#f2f2f2` |
  | `--color-primary-label` | `#191919` |
  | `--color-secondary-label` | `#7e7e7e` |
  | `--color-border` | `hsla(0,0%,10%,.1)` |
  | `--color-hover` | `hsla(0,0%,10%,.02)` |
  | `--color-untitled-pink` | `#e699ab` |
  | `--color-untitled-blue` | `#5a8ff7` |
  | `--title-size` | `18px` |
  | `--body-size` | `15px` |
  | `--body-height` | `20px` |
  | `--footnote-size` | `12px` |
  | `--header-height` | `108px` |

  The body font is `"Untitled Sans", sans-serif`.

**Logged-in screens not visited**, from the manifest:

- **Need content first** (a project and a track):
  - `/library/project/:projectSlug`, with `comments`, `note`, `attachments`, `signature` and
    `embed`
  - `/library/project/:projectSlug/track/:trackSlug/{comments,versions,note,attachments,embed}`
  - `/library/track/:trackSlug` and its `embed`
  - `/library/folder/:folderSlug`
  - `/library/project/insights/:projectSlug` and `/library/track/insights/:projectSlug/:trackSlug`
  - the player bar
- **Visitable now but not visited:**
  - `/profile/membership`, `/profile/referrals`, `/profile/referrals/redeem`
  - `/profile/notifications`, `/profile/devices`, `/profile/purchases`, `/profile/invoices`,
    `/profile/selling`, `/profile/passcode`
  - `/profile/sign-in-security`, plus its `add`, `add-email`, `add-phone` and
    `recovery-phrase` children
  - `/profile/recovery-email`
  - `/notifications`, `/following`, `/u/:username`
  - `/membership/signup`
- **Dark-mode variants of everything.** Switching the "Dark mode" toggle changes a setting, so
  it was not done during research; the capture will flip it (section 4, D7). `prefers-color-scheme` emulation may be enough, but that is unverified, since
  the site also stores a theme (`set_theme` action, `theme` in root loader data).

## 3. Capture techniques and tools

The target for each screen is:

- rendered DOM
- styles: bundle CSS, computed styles and tokens
- fonts, icons and images
- screenshots at each breakpoint
- every interaction state

The tools, verified against their docs:

| Tool (version) | What it captures | Fit here |
| --- | --- | --- |
| **Playwright** 1.63.0 (latest release 2026-09-04, GitHub) | `page.content()` gives the serialized DOM. `page.screenshot({fullPage:true})` works per `setViewportSize`. `page.coverage.startCSSCoverage()` / `stopCSSCoverage()` return `{url, text, ranges}` of the CSS actually used, **Chromium only**, and miss "dynamically injected style tags without sourceURLs" (https://playwright.dev/docs/api/class-coverage). `hover()`, `focus()` and `click()` drive states. `context.storageState()` reuses a login. | **Best backbone.** One script iterates manifest routes × breakpoints × states. |
| **CDP `DOMSnapshot.captureSnapshot`** (reached from Playwright through `context.newCDPSession(page)`) | The whole DOM flattened, with shadow DOM and iframes, plus layout rects and a whitelist of **computed styles** per node. Options: `includeDOMRects`, `includePaintOrder`, `includeBlendedBackgroundColors`, `includeTextColorOpacities`. **Experimental** domain (devtools-protocol `browser_protocol.json`). | Best way to record computed styles for every node in one call, for pixel-level comparison. |
| **Playwright MCP** 0.0.83 (2026-09-28) | The interactive version of the above: `browser_snapshot` (accessibility tree), `browser_take_screenshot` (`fullPage`), `browser_evaluate`, `browser_resize`, `browser_hover`, `browser_network_requests`. Supports `--storage-state` and `--user-data-dir` (README). | Good for exploring and one-off captures. For hundreds of route × breakpoint × state combinations, a script is more repeatable. |
| **Orca browser** (`orca` CLI) | `goto`, `snapshot` (accessibility refs), `screenshot`, `full-screenshot`, `pdf`, `eval`, `hover`, `click`, `set device`, `set media --color-scheme dark\|light`, `cookie get`, `network`, `capture start`, and `exec` passthrough to agent-browser. Tabs have **profiles** (`orca tab profile create`). Source: `orca --help` and `orca skills get orca-cli`. | **The one for logged-in screens.** Jacob signs in himself in an Orca profile, and `eval` can serialize the DOM and computed styles in place. No HAR or DOM-serialize command was verified, so use `eval`. |
| **SingleFile CLI** 2.16.0 (2026-09-27, `single-file --help`) | One self-contained HTML per page with CSS, fonts and images inlined. Defaults to `--block-scripts true`, `--remove-hidden-elements true` and `--remove-unused-styles true`. Also `--browser-width` / `--browser-height`, `--browser-wait-until networkIdle`, `--browser-cookies-file`, `--browser-script` and `--crawl-links`. | Good **visual reference file** per screen. Set `--remove-hidden-elements false` and `--remove-unused-styles false`, or hidden menus, modals and responsive rules are stripped. The browser extension (1.27.0) can save logged-in pages by hand. |
| **wget --mirror / HTTrack** 3.50.4 | Static fetch without running JavaScript. | **Does not work here.** Cloudflare returns 403 challenge pages to non-browser clients (observed), and the app screens are client-driven. Not recommended. |
| **browsertrix-crawler** 1.14.3 / pywb 2.10.0 / ArchiveWeb.page 0.17.1 | WARC/WACZ archives for replay. `create-login-profile` gives logged-in crawls (https://crawler.docs.browsertrix.com/user-guide/browser-profiles/). | Built for **replay**, which is now out of scope. Heavier than needed for design capture. |
| **HAR** (`recordHar`, `routeFromHAR`) | Network log and replay. `routeFromHAR` has `notFound` abort/fallback, `update`, `updateContent` embed/attach, and `updateMode` full/minimal. Service-worker traffic is not served (https://playwright.dev/docs/api/class-browsercontext). | Only useful to keep loader JSON for re-rendering states offline. Optional. |
| **DOM-to-code or design-extraction tools** (e.g. html-to-Figma importers) | Unverified. | Unnecessary here. The DOM already carries Tailwind v4 utility classes, so serialized DOM plus the CSS bundle is almost the source markup. |

### What each artefact gives the rebuild

- **Serialized DOM per state:** the Tailwind classes, the element structure and the inline SVG
  icons.
- **`app-*.css` and `fonts-*.css` as shipped:** every token, breakpoint and dark-mode rule. The
  build is minified but readable.
- **Tokens:** list every `--*` variable resolved on `:root` in light and dark themes with
  `getComputedStyle(document.documentElement).getPropertyValue(...)`. There are 118 custom
  tokens.
- **Computed styles:** the ground truth for comparing the rebuild.
- **Screenshots at one width inside every breakpoint band, light and dark:** a visual diff
  target. The site's own breakpoints are 400/480/561/640/768/940/1000/1200/1600 (section 4, D6).
- **Interaction states:** there is no generic crawler for these. Script them per screen:
  - `:hover` with `page.hover`; the site gates hover styles on `@media(hover:hover)`
  - `:focus-visible` via keyboard `Tab`
  - dropdown menus and dialogs (Radix portals render at the end of `<body>`, so serialize
    `document.body`, not just the route container)
  - the cookie modal (shown to all first-time visitors)
  - the player bar while playing and paused
  - loading skeletons (a `skeleton-*.js` chunk exists); throttle with `page.route` delays to
    catch them
  - empty states: a fresh account with no projects
  - `prefers-reduced-motion` via `emulateMedia({reducedMotion:'reduce'})`

## 4. Decisions (grill, 29 Sep 2026)

Jacob settled these after the research. They override anything above that disagrees.

| Id | Decision |
| --- | --- |
| D1 | **Purpose:** a private replica with the exact DOM and design, used as a reference. CanonCore then adapts its patterns under its own brand and font; the replica itself never ships. |
| D2 | **Permission:** verbal, from the owner, as reported by Jacob. No written record. |
| D3 | **Account:** the capture account is a sandbox Jacob handed over. The capture may create projects, tracks and artwork in it, using only placeholder media generated locally (synthesised audio, generated images). Nobody else's content is captured. |
| D4 | **Screens:** every manifest route that renders a page, marketing, legal and shop included. `api/`, `task/`, `webhook/` and `slack/` routes and pure actions are excluded. |
| D5 | **States:** menus, dialogs and sheets; hover and focus (hover-capable widths only); empty, loading and error; the player playing, paused and seeking. |
| D6 | **Widths:** 375, 440, 520, 600, 700, 860, 970, 1100, 1400 and 1728px, one inside each band of the site's breakpoints. |
| D7 | **Themes:** light and dark, set through the account's Dark mode setting. The same pass records whether `prefers-color-scheme` emulation alone matches. |
| D8 | **Storage:** `~/canoncore/untitled-replica/`, a local git repo that is never pushed. Captures, the saved login and font files never reach GitHub. |
| D9 | **Stack:** React Router v8 (released 17 Jun 2026, the successor to Remix v2, which is end of life: https://remix.run/blog/react-router-v8) with Tailwind v4 and the site's own tokens. Screens are components rendering the captured element tree, with placeholder data and states driven by props. |
| D10 | **Fonts:** Untitled Sans Regular, Italic, Medium and Bold under Jacob's own Klim licence, plus IBM Plex Mono (OFL 1.1). Font files are gitignored. |
| D11 | **Capture:** a Playwright script. Jacob signs in once in a visible Playwright browser and the session is saved as a gitignored `storageState`. The script walks routes × widths × themes × states and saves the page HTML, a CDP `DOMSnapshot` with computed styles, a full-page screenshot and CSS coverage. SingleFile is optional, as a visual reference only. |
| D12 | **Exact means:** per route, width, theme and state: (1) the same element tree and classes, ignoring text content and `data-*` ids; (2) the same computed styles on every element; (3) no more than 0.1% of pixels differ, with placeholder images masked. |
| D13 | **Tracking:** a CC spec with sub-issues, worked in the replica repo with local commits (no PRs). |
| D14 | **Order:** the app shell (header, nav, player bar, theme) and `/library` first, proving the whole capture, rebuild and diff loop; then project and track; then profile and settings; marketing, legal and shop last. |

## Unverified

- Whether Orca's `capture start` records HAR or a DOM archive; only its existence in the skill's
  command list was seen. Not needed now that D11 uses a Playwright script.
- The exact signed-URL host and response headers for audio (out of scope).
- Specific DOM-to-Figma or DOM-to-code tools (not evaluated).
- The DOM of the logged-in screens not visited (see the list above). The project, track and
  player-bar screens are known only by route name until the sandbox is seeded (D3).
- Whether `prefers-color-scheme` emulation alone gives the dark render (D7 measures it).
