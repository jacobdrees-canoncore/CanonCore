# Sweep: plex-www-aa (269 www.plex.tv URLs)

STATUS: complete

Shard: `urls/shards/plex-www-aa`
Method: plain `curl` with no User-Agent (www.plex.tv refuses browser UAs and WebFetch).
Classification is against `prompt.md`.

Legend: ADOPTED / REFUSED (named in WHAT NOT TO BUILD or STANDING RULES) / DIVERGENT
(CanonCore does it differently on purpose) / ABSENT (nothing in the prompt covers it).
ABSENT items carry LOW / MEDIUM / HIGH need.

---

## Progress log

(appended every 10 pages)

### Block 1 — pages 1-10 (plug-in history, 2018 redesign, 2025 changes)

**https://www.plex.tv/blog/hubba-bubba-introducing-custom-collections-and-hubs/** — 2021-07-22.
Collections levelled up. Three concrete capabilities: (a) "it's now possible to specify a
custom order for the items in your collection, so you can go ahead and take that machete to
your Star Wars movies, or restore order to the MCU! Just drag and drop!"; (b) Smart
Collections built from "the full power of the filter builder"; (c) any collection, including a
smart one, can be promoted to a home-screen or Recommended hub (Plex Pass only), and every
recommendation hub can be reordered or toggled off.
- Custom hand-ordering of a collection: **ADOPTED** — this is `placements.position` and the
  manual-vs-smart split the prompt already names ("A container is EITHER hand-placed OR
  rule-derived; a rule-derived container carries NO order... This is the split Plex ships as
  manual versus smart collections").
- Note the *worked example Plex itself reaches for* is the Star Wars machete order and MCU
  order — i.e. Plex users are already trying to do the alternate-ordering thing CanonCore is
  built for, and Plex's answer is one hand-dragged order inside one collection.
- Hubs / owner-controlled home-screen shelves: **ABSENT — MEDIUM.** The prompt explicitly
  defers this ("No shelf type... Those are decided when screens exist"), so it is deferred
  rather than refused; a catalogue with many orderings needs *some* curated entry surface.

**https://www.plex.tv/blog/opening-the-plug-in-floodgates/** — 2009-04-08. First-party push
of the Python plug-in framework; plug-ins as installable content channels. Marketing-ish but
it dates the ecosystem's opening: 2009.
- Classification: context for the prompt's plug-in note. Nothing new.

**https://www.plex.tv/blog/documentation-for-plug-in-developers/** — 2009-09-24. Developer
site + framework manual shipped ~5 months after the floodgates post; the ecosystem ran for
years on undocumented APIs before that ("to all the brave developers who waded in without
documentation").
- Relevant to CMPP only as a caution: **ADOPTED in spirit** — CMPP is a declared contract
  with required/optional operations from day one, not an undocumented framework.

**https://www.plex.tv/blog/celebrating-our-100th-plug-in/** — 2009-07-26. 100 plug-ins in the
store within ~4 months of opening. Every one named is a *content channel* (news sites,
magazines, trailers), not a metadata source. Marketing, but load-bearing for the reversal
story: what Plex's plug-in ecosystem actually WAS was scrapers of third-party video sites, and
that is why it rotted (see automated-channel-testing).

**https://www.plex.tv/blog/app-store-updates-new-and-updated-plug-ins/** — 2009-03-02. Same
shape; plug-in release notes. Marketing.

**https://www.plex.tv/blog/automated-channel-testing/** — 2011-04-24. **HIGH-VALUE.** Plex had
"nearly 250 channels" and built a bot that continuously tested them because "The Web is in a
constant state of flux, with sites changing and being redesigned." A scoring heuristic ranked
broken channels by how long/how badly broken and how popular, and paid cash bounties to
volunteer devs who fixed them.
- The rule worth carrying: **a provider that scrapes a third party is a maintenance liability
  that decays continuously**, and Plex's answer was an automated health checker plus paid
  humans. This is the mechanical reason the 2018 shutdown happened.
- Classification: **ABSENT — MEDIUM.** CanonCore has no provider health/staleness surface.
  With third-party CMPP providers at arbitrary URLs, "this provider has been failing for N
  days" is something the owner needs and nothing in the prompt provides it.

**https://www.plex.tv/blog/open-platform-meet-klexi/** — 2010-09-16. Documents the *extent* of
the Plex/Nine open platform, verbatim: "The ability to write scanners, plug-ins, metadata
agents, and of course the HTTP/XML API to the Plex Media Server". Third-party iOS client
KLEXi shipped against it (paid, $5.99), issued an API key "used to access the transcoding
functionality".
- Four extension points, of which CanonCore deliberately keeps ONE (metadata providers, as a
  URL contract). Scanners and in-process plug-ins are **REFUSED** by the prompt ("never code
  running inside the app"). The third-party-client-against-a-documented-API point is
  **DIVERGENT/deferred** — CanonCore has oRPC + a free OpenAPI reference, which is the same
  affordance without the API-key programme.

**https://www.plex.tv/blog/have-plex-your-way/** — 2018-05-30. **HIGH-VALUE, contains a
REVERSAL in its own body.** Announced (a) fully customisable home screen where any section
from anywhere — "even across different servers (mix and match!)" — can be added or reordered,
(b) customisable bottom tabs per media type, (c) a *default source per media type* so content
split across servers is crossed transparently, and (d) **Podcasts**, free, no server required,
with "On Deck, synced view state, rich metadata".
- The reversal, printed as an in-post update: "we've made the decision to end support for
  podcasts within Plex... You can continue to access your podcasts within Plex until next
  Friday, April 15th, 2022, at which point they will no longer be available."
  **Podcasts: launched 2018-05-30, killed 2022-04-15.** Reason given is resource allocation.
- "Elevates some important decisions ('what do I want to watch or listen to?') and
  deemphasizes some less important ones ('where is it coming from?')" — this is Plex arguing
  against its own library-as-partition model from the UI side, which is CanonCore's groups
  decision (**ADOPTED**: groups scope browsing, they never partition).
- Cross-server unified browsing: **REFUSED** by the prompt ("No fork, no export, no import, no
  cross-instance sharing").

**https://www.plex.tv/blog/grid-who/** — 2018-06-12. Live TV grid EPG view, Plex Pass gated.
Live TV/DVR is out of CanonCore's scope entirely. Marketing.

**https://www.plex.tv/blog/important-2025-plex-updates/** — 2025-03-19, with in-post updates
dated 2025-04-30 and 2026-04-29. **HIGHEST-VALUE PAGE IN THE SHARD SO FAR.** Records the 2025
reopening the brief asked about, plus a large paid-feature reversal.
- The reopening, verbatim from the roadmap list: "**An open and documented API for server
  integrations, along with the ability to create custom metadata agents.**" Plus "A new
  bespoke server management app that works on browsers or mobile clients for a better curation
  experience with more visibility into who is on your server, and how."
  So the 2025 reopening is explicitly *custom metadata agents* + *a documented server API* —
  exactly the CMPP shape, and Plex reached it seven years after killing plug-ins.
  **ADOPTED** — direct vindication of "a provider is a URL answering a contract".
- Pricing/gating rules, verbatim: Plex Pass from 2025-04-29 "Monthly: $6.99 / Yearly: $69.99 /
  Lifetime: $249.99", up from a $119.99 lifetime. New tier "Remote Watch Pass... $1.99/month
  or $19.99/year".
- **The reversal that matters:** "we have changed how remote streaming works for personal
  media libraries, and it is no longer offered as a free feature on Plex." Remote playback of
  *your own files on your own server* became a subscription. Server owners with a Plex Pass
  cover all their users; otherwise each viewer pays.
- Counter-reversal in the same post: the mobile "one-time activation fee" and the **one-minute
  playback limitation** on unactivated mobile apps were both removed. A feature Plex built
  (the 60-second clip limit as a paywall) and then killed.
- Classification: all of this is business-model, **not applicable** to a self-hosted
  single-owner product. Recorded because it is the clearest statement anywhere that the
  self-hosted vendor's incentive drifts toward gating access to the user's own files — which
  is the reason CanonCore exists as software someone else runs.

### Block 2 — pages 11-16 (collections, sorting, metadata agents, field locks)

**https://www.plex.tv/blog/beginning-look-lot-like-collections/** — 2017-12-29. **HIGH-VALUE.**
The Collections launch. Concrete rules, verbatim where they are rules:
- "Items can belong to multiple collections as well, for added flexibility." Multi-membership
  existed from day one.
- Membership is a TAG: "now that you've edited your movies or TV shows to add one or more
  Collections Tags". Collections are a string tag on the item, not a first-class join row.
- Per-library display behaviour: "you can configure exactly how you want collections to
  behave on a per-library basis; you might want to show collections alongside the items they
  contain, or collapse the items and just show the collections. Or... disable this new
  behavior altogether."
- **Ordering at launch was fixed and global to the collection: "You can edit any collection to
  order by release date or alphabetically."** No hand-ordering. Custom drag order did not
  arrive until 2021-07-22 (see hubba-bubba, Block 1) — a 3.5-year gap.
- **This page is the primary source for the prompt's claim 4.** Verbatim: "you could add TV
  shows to a Star Wars collection as well. In that case, the two collections from different
  libraries become linked, and you'll have access to both on the same page." Confirms
  cross-library collections are string-name coincidence, not a real link. Music is worse:
  artists and albums "don't have a top-level collection mode" and can only be linked *into*
  movie/show collection pages.
- Classification: **DIVERGENT (deliberate)**. CanonCore's `placements` table with a stable
  surrogate id, duplicates allowed, and no unique constraint on (container, position) is the
  direct answer to tag-as-membership. The tag model is exactly why Plex cannot say "this item
  is at position 63 here and position 1 there".

**https://www.plex.tv/blog/control-time-space-sort/** — 2017-08-02. Despite the title this is
Live TV time-shifting + DVR out of beta, not sorting. Out of scope. Marketing.

**https://www.plex.tv/blog/new-hope-for-meda-browsing/** — 2017-08-24. The v2 UI. Useful only
for one admission: Plex's giant-poster/discovery-first design produced "clear issues with
information density and click efficiency" and users could not simply browse a library
end to end; the fix was to put plain browsing back. Dates On Deck to ~2011.
- Lesson: **a discovery-first home screen is not a substitute for a browsable ordering.**
  CanonCore's stop condition is a rendered item page inside multiple orderings, so this is
  **ADOPTED implicitly**; worth not forgetting when shelves get designed.

**https://www.plex.tv/blog/metadata-update/** — 2010-09-21. **HIGH-VALUE — the source order.**
- Verbatim rule: "Like TheMovieDB summaries? **Drag it to the top of the list of agents.**
  Prefer your summaries in Swedish? Make sure Wikipedia is above TheMovieDB, so its
  internationalized summaries will take precedence."
  A single global, hand-ordered list of sources deciding which value wins per field. That is
  precisely CanonCore's **source order** — **ADOPTED**, and it turns out Plex had it in 2010.
- Per-item override: "You can manually set the language preference to French for just those
  two movies". A per-item exception to a global preference.
- The deliberate move off scraping: "massive amounts of data, all structured (**no more
  'scraping' sites that can change at a moment's notice**)". They moved movies to Freebase,
  Wikipedia, TheMovieDB and structured dumps after the Plex/Nine launch load "put an extreme
  load on a number of sites" — they had to stand up a TheTVDB proxy cache serving "over 99% of
  all bytes out of its cache... over 500 requests/second".
  This is the second, independent statement of why the scraper-plug-in model died (see
  automated-channel-testing). **ADOPTED** — CanonCore providers answer a structured contract.
- The proxy cache is a **REFUSED** shape for CanonCore: the prompt says SHIP NO API KEYS and
  the user supplies their own credential, so there is no central Plex-style relay.

**https://www.plex.tv/blog/happy-thanksgiving-now-with-metadata-editing/** — 2010-11-25.
**HIGHEST-VALUE for the field model. This is the origin of the per-field lock the prompt
refuses.** Verbatim:
- "You'll notice **a lock icon beside every field**, which turns on when you edit a field.
  This means **'I don't want this value to ever change again'**, as opposed to the unlocked
  fields which continue to update based on data from the agents."
- Confirms the prompt's claim 3 exactly: the ceiling in this category is a boolean lock that
  answers "may I overwrite this?" and never "where did this come from?". Plex's lock is set as
  a side effect of editing and stores no provenance.
- Classification: **REFUSED** by the prompt ("No per-field lock flag. The favourite does that
  job"), and this page is the evidence for why the refusal is right — the lock and the owner's
  chosen value are the same act, so two mechanisms is one too many.
- **A REVERSAL, and a data-losing one:** before this release artwork fields were "a bit of a
  hack... It was 'sticky' but not locked. When you upgrade to this incremental version, all
  those graphics fields will become fully fluid, and will update with new graphics as those
  elements become the most popular over time." Users who had curated posters were told to go
  read a forum post and lock the fields *before upgrading* or lose their choices.
  Two rules fall straight out: **artwork selection must be a stored owner choice, not
  stickiness**, and **picking artwork by popularity/recency silently overwrites curation** —
  the same failure mode as the prompt's "NEVER PICK BY RECENCY" rule for editions and sources.
  **ADOPTED**.
- Also documents `Sort Title` as a first-class editable field distinct from title ("useful for
  enforcing the correct ordering with sequels"). CanonCore has `sort_name` as a column —
  **ADOPTED**.
- Also: **unmatch** ("resets any existing metadata and leaves it as a blank slate") and
  **match with an alternative agent**, both per item, with the worked example of two different
  films sharing one title. This is CanonCore's match-vs-apply split and its "lookup is required
  because search is ambiguous forever" reason, stated by Plex in 2010. **ADOPTED**.
- Collections are noted here as already in "the code and database" in Nov 2010 — seven years
  before the 2017 launch.

**https://www.plex.tv/blog/a-sneak-peek-at-alexandria/** — 2010-05-19. A teaser video for the
Plex/Nine ("Alexandria") release. No text content. Marketing.

### Block 3 — pages 17-22 (sharing, myPlex, markers, Watch Together, Discover)

**https://www.plex.tv/blog/introducing-plex-home/** — 2014-11-20. Multi-user arrives: managed
accounts for people without an email address, per-user content-rating limits, and — the part
worth recording — "a flexible sharing mechanism **via labels** which allows you to share
exactly what you want", e.g. individual photos or a few albums. Sharing granularity is a
**label on items**, i.e. a tag, exactly like collections.
- Classification: **REFUSED / deferred.** The prompt has no visibility system at all and says
  why ("'Inherit from which parent?' has no answer once an item is multi-placed. Add it when
  multi-user arrives"). Plex confirms the shape it takes when it does arrive: a label-based
  share scope, not a tree. Note for the eventual multi-user migration: Plex chose labels
  precisely because a hierarchy could not express it either.

**https://www.plex.tv/blog/introducing-myplex/** — 2011-10-28. Cloud account tying servers and
clients together; a "universal media queue" of web videos saved by bookmarklet, "over 100
sites at launch", with cross-device resume ("stop on one client, resume on another") and an
API. The queue was itself built on the plug-in Framework.
- The web-video queue is **an early killed feature** — it and its bookmarklet
  (see a-massive-bookmarklet-upgrade, 2013) do not exist today; it died with the plug-in
  framework in 2018.
- Cross-device resume from a server-side progress record: **ADOPTED** (CanonCore's progress is
  per owner+edition, placement-independent, so resume follows the edition anywhere).

**https://www.plex.tv/blog/go-ahead-and-skip-that-intro/** — 2020-05-20. Skip Intro, Plex Pass
only. Mechanism stated: an audio fingerprint from "the histogram of each episode in a given
season", i.e. detection works by comparing episodes *within a season* to each other.
- **Concrete rule, verbatim: "the intro sequence must be at least 20 seconds long"**, plus the
  server must analyse the library in the background before the button appears.
- Classification: **ABSENT — LOW.** Marker detection needs decoding every file, and CanonCore
  is direct-play-only with no ffmpeg. The interesting half is structural, not the ML: markers
  are *intervals on an edition*, which CanonCore already has a home for
  (`edition_coverage` is intervals; a marker would be a sibling concept). Not needed for v1.

**https://www.plex.tv/blog/let-the-next-episode-roll/** — 2023-02-15. Skip Credits. Different
technique from Skip Intro (text detection + black-frame detection + ML rather than audio
fingerprints), works on movies as well as episodes, and detects mid- and post-credits scenes.
Two operational rules worth recording:
- Results are computed locally then **uploaded**: "By default, the results of all your local
  credit detection efforts are anonymously submitted to our new service" so a library rebuild
  restores them "in seconds instead of burning hours of CPU time".
- Analysis is a **nightly scheduled maintenance task**, with a manual per-item "Analyze".
- Classification: the crowd-sourced marker cloud is **REFUSED in spirit** — CanonCore is
  self-hosted software with no phone-home; a default-on upload of derived data about the
  owner's library is exactly the posture the product exists to avoid.
- The scheduled-task point is **ABSENT — MEDIUM**: the prompt requires "explicit periodic
  scans" but names no general background-maintenance scheduler, and the projection rebuild,
  the review queue and provider refresh all need one.

**https://www.plex.tv/blog/coming-in-hot-watch-together-chill/** — 2020-05-28, with a
**2025-02-25 in-post kill notice**. **A FEATURE BUILT THEN KILLED.** Synchronised group
playback across friends' devices, launched as beta on Apple/Android/FireTV/SHIELD/Roku.
- The kill, verbatim: "as we debut our new Plex experience, we are ending support for some
  features we've grown to love, like Watch Together. While this feature won't be available for
  most devices, you can continue using the feature in our web app for the foreseeable future."
  Reason given is a client rewrite, not usage. Note the hedge that they "don't preclude the
  possibility of offering similar functionality again... using new tooling".
- Classification: **REFUSED** (no cross-instance sharing; single-owner instance). Recorded as
  evidence for a different rule: **a feature that lives in every client dies at the next client
  rewrite.** CanonCore's clients are Next.js now, Expo and Swift later, so anything that must
  be implemented per client is a standing liability — an argument for keeping logic
  server-side, which the prompt already does (Continue Watching computed, container progress
  computed on read).

**https://www.plex.tv/blog/discover-together/** — 2023-11-01. Social layer on Discover
(launched April 2022): friends, activity feed, profiles with lifetime watch stats broken down
by movies/shows/episodes, ratings and comments. Watchlist is universal across streaming
services.
- Classification: **REFUSED** — no cross-instance sharing, no social layer, and the demo is
  read-only with no login. Recorded only because the "watchlist" idea (a want-to-watch list
  independent of ownership) is the one piece here that fits a catalogue of works you do not own
  files for: **ABSENT — MEDIUM.** CanonCore items exist with zero files, so "I intend to
  consume this" has no home; progress is per edition and an item with no edition cannot carry
  it. A rule-derived container could stand in, so this is a design note, not a gap in the model.

### Block 4 — pages 23-28 (killed features: Cloud Sync, PMP, Arcade, Sync; palette extraction)

**https://www.plex.tv/blog/introducing-cloud-sync-beta/** — 2013-10-25, with an in-post kill
notice. **A FEATURE BUILT THEN KILLED.** Cloud Sync pushed transcoded copies of your library
plus its metadata to Dropbox/Google Drive so the server could be turned off; multiple storage
providers each with its own size limit, filled by a smart rule such as "Newest 20 movies added
to my Movie library", and "view progress will be synced" when the server came back.
- The kill, verbatim: "**Cloud Sync was officially discontinued on September 25, 2018.**"
  Announced 2013, dead 2018 — five years.
- Classification: **REFUSED.** The prompt says "No cloud storage integration", and gives the
  structural reason (a cloud provider's file-scoped permission grants no access to pre-existing
  children), plus "Document rclone and mergerfs... rather than implementing any cloud
  integration". Plex is the counter-example that ran the experiment and withdrew.
- The one idea worth keeping: a **rule-derived set feeding an offline copy** ("Newest 20
  movies added") is a smart collection driving an action. CanonCore has rule-derived
  containers; nothing acts on them. **ABSENT — LOW.**

**https://www.plex.tv/blog/desktop-af/** — 2019-08-15. **A KILL ANNOUNCED AND THEN PARTLY
RETRACTED IN THE SAME POST.** Three things at once:
- The Windows Store app was withdrawn that day ("as of today we're taking our Windows app out
  of the store"), reason given: Windows Phone died and the Metro platform stopped being worth
  dedicated resources.
- Sync was renamed Downloads and rebuilt "on a much simpler and more reliable mechanism".
- The retraction, verbatim from the post's own EDIT: "this next section used to talk about how
  we were ending support for Plex Media Player in six months, and with it, **effectively ending
  support for HTPCs as a platform**." After backlash they committed to "keep updating Plex
  Media Player until Jan 30, 2020". PMP was killed anyway, just later.
  The stated reason for killing it is worth recording: "modern streaming devices provide a
  better experience for most people (the vast majority of you have already switched)".
- Classification: not a model question. It is direct evidence for the prompt's client ordering
  (**ADOPTED**): the expensive, low-share client is the one that gets killed, and Plex reached
  the same conclusion by usage share. Also a caution that a maintained desktop/HTPC player is
  the first thing to become unaffordable.

**https://www.plex.tv/blog/game-on-a-plex-blog-story/** — 2021-01-26, with an in-post kill
notice. **A FEATURE BUILT THEN KILLED.** Plex Arcade rendered a folder of ROMs "as a Plex
library with all the power of filtering, searching, and beautiful details pages" — i.e. Plex
extending its catalogue to a medium it could not otherwise play.
- The kill, verbatim: "We've made the difficult decision to **close the doors on Plex Arcade on
  March 31, 2022**... we've stopped accepting new Arcade subscriptions". Fourteen months.
- Classification: **directly relevant and REFUSED by the prompt.** The prompt anticipates this
  exact temptation: "A stage production and a video game are neither [video|audio|text|image],
  and both are still complete catalogue entries: a `work` item with a category statement and
  ZERO editions. Do not add `performance` or `game` to medium." Plex's Arcade needed a
  streaming/emulation runtime to make games playable and the runtime is what became
  unaffordable. CanonCore's split — catalogue everything, render only what it has a renderer
  for — is the version that survives, and Arcade is the evidence.

**https://www.plex.tv/blog/going-off-grid-just-got-great/** — 2021-10-26. **Sync formally
killed and replaced.** Opening line: "Sync is Dead (really). Long Live Downloads!" Plex admits
years of unreliability ("we've had a love / hate relationship with our Sync implementation for
years"). Old Sync and any content synced with it "will be removed in a future version of the
apps". New rules: single tap, no item limits, subscribe to a show to keep the next few
episodes, "Direct download anything your device can play", progressive download during
transcode, all managed in one per-device Downloads list.
- Classification: **out of scope** (no offline sync in CanonCore v1). Worth one line: Plex's
  own verdict is that a *bidirectional* sync model was the wrong shape and a one-way
  download-with-a-visible-list was right. Any future CanonCore offline story should copy the
  latter.

**https://www.plex.tv/blog/finding-your-true-colors-with-plex/** — 2021-11-17. Colour Themes
(Default/Dark, Light, High Contrast, plus two Plex-Pass-only accent themes). Two things worth
recording: **theme accent colours are Plex Pass gated** (a paywall on a colour), and the
implementation note that Modern Layout defines colours as **design tokens** named e.g.
`accentBackground`, `focusBackground`, which "makes swapping out colors for themes and
creating new themes easier".
- Classification: design tokens as named values is **ADOPTED** by the prompt already ("design
  tokens as PLAIN TYPESCRIPT rather than a Tailwind config"), and here is a production system
  saying the same thing for the same reason.

**https://www.plex.tv/blog/choose-your-own-adventure-introducing-modern-layout/** — 2021-08-19.
**HIGH-VALUE for the artwork palette rule.** Plex built "a background color extraction process"
that pulls "visual styling from millions of different pieces of art", then exposed it as three
independent settings:
- Content Layout: Modern (inline metadata on focus; **prefers background artwork over posters
  on detail pages**) or Classic (no inline metadata; **prefers posters to artwork**).
- App/Home Background: "Artwork Colors (the default): Applies colors from the current title's
  artwork to the background and gracefully... transitions the colorfield as the title selection
  changes" — or None.
- Details Background: Artwork Colors / Dimmed Art / None.
- Classification: **ADOPTED, and it confirms the prompt's palette rule is the correct
  attachment point.** Plex's own UI needs *poster* colours in one place and *background
  artwork* colours in another, on the same title, at the same time — which is exactly the
  prompt's argument that "an item with a poster and a backdrop has two palettes, and there is
  no row to hang the second one on". Independent confirmation from a shipped product.
- Second lesson, on process: Plex shipped this as an opt-in experiment, collected feedback on
  "contrast issues, badging concerns, type sizes", and landed it as three orthogonal settings
  rather than one mode, because "any changes to a long-standing user interface can be
  challenging" and they had had "a few, shall we say, 'rough' UI transitions in the past".

### Block 5 — pages 29-39 (resumed session; early releases, the 2011 "Coming Attractions" series)

**Method note for everything from Block 5 onward.** Fetching was fixed (plain `curl`, no proxy;
Cloudflare rate-limits above ~35 requests/minute, so the batch runs at `--rate 35/m`). Two
declared accelerations were used, exactly as authorised:
1. **Slug triage.** 136 of the 269 URLs were classified from the slug without fetching. The full
   list is at the end of this file under "SLUG-TRIAGED (NOT FETCHED)". They are: all 59
   `/blog/category/*` index pages plus `/blog/` itself; the 10 `new-on-plex-in-<month>` posts; the
   20 `new-plug-in-release*` posts (the ecosystem shape they document is already established by
   `celebrating-our-100th-plug-in` and `automated-channel-testing` in Blocks 1-2); and 46 holiday,
   survey, forum-housekeeping, mirror-hosting, site-redesign and streaming-catalogue marketing
   posts.
2. **Keyword grep.** The remaining 105 pages were all fetched and converted to text, then grepped
   for reversal keywords (`discontinued`, `no longer`, `ending support`, `sunset`, `deprecated`,
   `removed`, `retiring`, `difficult decision`, `UPDATE:`) and capability keywords (`collection`,
   `version`, `edition`, `watched`, `order`, `merge`, `metadata agent`, `plug-in`, `share`,
   `marker`, `hub`, `on deck`, `filter`, `api`). 23 pages hit a reversal keyword and were read in
   full; the capability hits were read with surrounding context. Pages with neither are recorded
   below as bulk marketing with their date.

**https://www.plex.tv/blog/exodus/** — 2008-05-22. The founding document: Plex forks from XBMC
after a vote to expel the OS X contributors. Not a capability, but it dates the codebase and
states the founding motive, verbatim: "we will no longer be operating under the restrictions
imposed by the team. We can clean up and simplify the settings as we see fit. **We can remove
features that don't work right (sometimes, less is more).**"
- Recorded because it is the same instinct as the prompt's "Prefer deletion" / "Do not preserve
  backward compatibility" constraints, stated by Plex at hour zero — and because everything in the
  "FEATURES PLEX BUILT THEN KILLED" list below is that promise being kept.

**https://www.plex.tv/blog/coming-attractions-part-1/** — 2011-03-09. **HIGH-VALUE. Two rules,
both primary sources for things the prompt asserts.**
- **The automatic-refresh reversal, verbatim:** "We don't refresh media for no good reason. **In
  the last release, we refreshed items every two weeks. This could lead to posters changing (if
  more popular ones trickled up) and any unlocked metadata changing. We no longer do this.** If
  you do want a refresh, either right-click and select Refresh Metadata or shift-click when
  refreshing a section."
  This is Plex BUILDING the exact failure the prompt names ("a display that changes after a
  refresh nobody asked for is the single longest-standing complaint in this category") and then
  REMOVING it. Note the mechanism it names for the drift: *more popular posters trickling up* —
  i.e. picking by popularity, which is the sibling of picking by recency. **ADOPTED**, and this
  page plus `happy-thanksgiving-now-with-metadata-editing` (Block 2) are the two independent
  primary sources for the rule.
- **Soft deletion / the trash, verbatim reason:** "lots can go wrong during a scan, from someone
  removing a drive in the middle of an automated scan, to a temporary permissions problem...
  Secondly, **now that we allow metadata editing, the 'value' of the metadata is greatly
  increased, and losing it is much more painful.** In order to solve this problem, we've
  introduced something called soft deletion. During a scan, if a piece of media appears to be
  missing, we flag it as such, but don't actually remove it from the library... you can decide to
  go ahead with the deletion by emptying the trash for the library section." Plus an opt-out
  ("Empty trash automatically").
  The argument generalises straight onto CanonCore and gets STRONGER, because CanonCore items
  carry statements, placements and progress that a file does not: a missing file must never
  remove anything.
- Classification: **ABSENT — HIGH.** The prompt has tombstones on every table and requires
  "explicit periodic scans", and it has a careful DELETE section — but that section is about the
  *owner* deleting. Nothing in the prompt says what the SCANNER does when a file it saw last week
  is gone, and the default that falls out of an unspecified scanner is the one Plex shipped first
  and had to reverse. The rule to write down: a scan NEVER deletes; a missing file is flagged and
  waits for the owner. It is also cheap here — CanonCore's items are already file-independent, so
  a vanished file is at worst a missing edition, never a missing item.

**https://www.plex.tv/blog/coming-attractions-parts-2-and-3/** — 2011-03-12. Two smaller rules.
- Follow-on from soft deletion: "**Easy media moves**: One of the nice side effects of the soft
  deletion feature is that it's much easier to move your media around... the media can disappear
  for a while between scans, and nothing is lost." Same conclusion the prompt reaches through
  content hashing ("PATH IS LOCATION, NOT IDENTITY, so a moved file is the same file") — Plex got
  there by making deletion lazy rather than by making identity content-based. **ADOPTED**, and
  ours is the stronger of the two mechanisms.
- Artwork is downloaded and stored at full resolution "in order to ensure that even if the site
  goes down, the media is always there for you." **DIVERGENT.** CanonCore's artwork table stores
  a provider-supplied URL, not bytes, so a provider going dark takes the artwork with it. Worth
  knowing the trade was made deliberately: no uploads and no artwork scanning is the rule, and
  caching provider bytes is a separate question the prompt does not answer. Low priority while
  the palette (which IS stored) is the part the UI depends on.
- Naming: "it turns out that '**plug-ins**' is a rather technical term (who knew?), segregating
  them by class wasn't a great idea (people tend to only use a handful)". Plex renamed plug-ins to
  **channels** in the UI in 2011. Relevant only as vocabulary: CanonCore says *provider*, and the
  prompt's ban list (`record`, `edge`) is the same instinct.

**https://www.plex.tv/blog/coming-attractions-part-4/** — 2011-03-13. Subtitles, and the
sidecar/stream model that CanonCore's `files.role` column mirrors.
- Three sources of subtitles are unified: an **OpenSubtitles metadata agent** that fetches them, a
  **Local Media agent** that "detects and picks up any 'sidecar' subtitles you might have sitting
  around with your media, during a refresh", and multiplexed streams found by media analysis —
  "**information about all subtitles (local files, online sourced ones, multiplexed subtitles)
  being unified and stored in a single place**".
- "the stream selections for your media are stored in your library on the server, so all clients
  (iOS, Plex for Mac) will have the same settings."
- Classification: the sidecar-plus-role model is **ADOPTED** (the prompt's `files` role is
  `media|subtitle|audio|chapters` with a sidecar referencing the file it accompanies plus a
  language, explicitly so an edition stays "a different version of the work" rather than "a
  different file"). Plex reached the same split in 2011.
- What is **ABSENT — LOW**: a per-owner language preference that auto-selects audio and subtitle
  streams ("it's not going to show subtitles if the audio stream matches your preferred
  language"), and a stored per-item stream selection. Both are playback-side, and the prompt caps
  v1 at a rendered page.

**https://www.plex.tv/blog/coming-attractions-part-5/** — 2011-03-14. **HIGH-VALUE — the primary
source for the prompt's claim about Plex versions.** The Direct Play / Direct Stream launch.
- Verbatim: "During the media analysis phase, the Plex Media Server looks at certain attributes of
  your media (resolution, bitrate, etc.). When a client requests a piece of media, the server
  looks at the client's capabilities, compares them to the media parameters, and makes a
  determination as to whether or not the file can be directly played on the device... **If you had
  a movie in MKV format and also encoded it for mobile devices (and both versions scanned into
  your library), the media server is smart enough to mark the specific version of the file as
  playable by the device.**"
  That is the whole of Plex's multiple-versions feature, in its own words, at launch: versions
  exist so the server can pick the one *the client can decode*. It is a CODEC-COMPATIBILITY
  mechanism and nothing else. The prompt says exactly this — "Plex merges versions but its
  automatic pick is about what the client can decode, not about which is canonical" — and this is
  the page that proves it. **DIVERGENT (deliberate), confirmed.** CanonCore's `is_default` is an
  owner pin about which rendering is canonical, a question Plex's mechanism cannot express.
- Direct Play itself is **ADOPTED** — CanonCore is direct-play-only. Note the honest cost Plex
  states for the alternative: "transcoding implies a decode and then a subsequent re-encode of the
  media, which is a lossy transformation" and "it can take quite a bit of CPU". The prompt refuses
  transcoding; this is the vendor's own accounting of what is being refused.

**https://www.plex.tv/blog/coming-attractions-the-last-one/** — 2011-03-15. Universal search
launches. Two properties worth recording: it searches **every Plex server in the house, not one
library** ("it searches the Plex Media Server you're connected to, obviously. But we went a step
further, and made it search all Plex Media Servers in your house"), and it federates out to
third-party sources through providers — "The search functionality is **extremely pluggable**, so
you'll see new providers come online very shortly, as well as **the ability to add your own custom
providers**, should you so choose."
- Classification: **ADOPTED in the CMPP shape.** A pluggable search provider added by URL is
  precisely CMPP's required `search` operation and the tier-3 "any URL added directly" provider.
  Plex had the idea in 2011, delivered it as in-process Python, and lost it in 2018.
- Cross-server search is **REFUSED** (no cross-instance anything). Within one instance the
  equivalent is groups scoping search, which the prompt already specifies.

**https://www.plex.tv/blog/laika-revealed/** — 2011-10-29. **The origin of On Deck**, with the
argument for it stated as a click count.
- Verbatim: "if I want to watch TV, I'm most likely to be interested in seeing **the next
  unwatched episode of a show I've watched recently**. Easy enough to explain, but in previous
  versions, you were stuck finding the TV show, going to the right season, and looking for the
  next unwatched episode... Two clicks away and I'm watching it, as opposed to (I just counted)
  **fifteen**!" Three cases are shown and they are the three the definition has to cover: next
  episode after a finished one, next SEASON's premiere after a finished season, and a
  half-finished episode resumed.
- Classification: **ADOPTED** — this is Continue Watching, which the prompt computes and never
  stores, with no window and no dismissal.
- Also here: "**Allow browsing by collection in music sections**" — a collection *browse axis*
  existed in 2011, six years before Collections launched as a feature (2017), and eleven months
  after collections were noted as already in the database (Nov 2010, Block 2). The idea outran the
  UI by seven years.
- Also: "all the new features, such as the 'on deck' and recently added content are available via
  the **HTTP API** to the media server." Server-computed, client-agnostic — the same posture the
  prompt takes for Continue Watching and container progress.

**https://www.plex.tv/blog/a-plexweb-update/** — 2012-11-17. Plex/Web replaces the old manager.
One real capability here.
- **Bulk multi-select, verbatim:** "something that's been requested for literally years,
  **multi-selection**. Type in 'star wars' in the quick filter, select all the movies, and **add
  them to a new collection**. Or delete the ones with Jar Jar."
- Classification: **ABSENT — MEDIUM.** The prompt specifies placements one at a time and specifies
  DELETE carefully (three outcomes, previewed with counts), but there is no bulk path: no
  filter-then-select-all, no "add these 40 items to this container". Building a Release-order and a
  Story-order container for Breaking Bad by hand, one placement at a time, is the stop condition's
  own worked example — so this is felt immediately. Note the prompt's standing rule cuts the other
  way too: "Every accelerator has an equivalent visible UI path", which means bulk-add needs the
  single-add path to exist first, not instead.
- Also here: an On Deck shortcut inside each section, remote playback ("fling media from any web
  browser to Plex apps which support remote control"), scan progress feedback, and a "media info"
  dialog. All out of scope.

**https://www.plex.tv/blog/plex-082-silky-smooth/** — 2009-08-09, **https://www.plex.tv/blog/plex-0-8-3-let-it-snow-leopard/**
— 2009-10-26, **https://www.plex.tv/blog/plex-0-8-5-fixes-fixes-fixes/** — 2009-11-19. Three
Plex/Eight release-note posts, read in full because they tripped reversal keywords. Almost
entirely OS X playback fixes. Three lines are worth keeping:
- 0.8.2: "**Resume point for videos is now saved when quitting**" — resume was not durable until
  Aug 2009, and "we now scrobble to Last.fm as 'Plex'" dates outbound scrobbling to the same
  release.
- 0.8.2: "**all plug-in caches and data will be reset because of changes to the encoding, which
  means that you will need to re-enter login data into some plug-ins (we apologize for this)**" —
  an in-process plug-in framework makes its own data format a compatibility surface. CanonCore has
  none of this: a provider is a URL and its credential is CanonCore's row.
- 0.8.3: "**Support for one-click install of plug-ins.** You can now easily install plug-ins off
  the web without having to copy files all over the place" — one-click install of arbitrary web
  code, in 2009, is the shape the prompt **REFUSES** outright ("not a plugin, not a repo, and
  never code running inside the app").

---

## Resumption note (session 3)

Resumed 2026-09-06. The 39 URLs already written up in Blocks 1-4 above were NOT re-fetched.
Predecessor cache check: the shared scratchpad held 339 raw pages, but all of them belong to the
sibling `plex-www-ab` shard (slugs beginning `plex-`) and NONE overlapped this shard, so the
remaining 230 URLs were fetched fresh with plain `curl` (HTTP 200, no proxy, no User-Agent).

**TRIAGE ACCELERATIONS USED — declared so the coverage claim stays honest.**

1. **Skipped by slug, not fetched — 59 category index pages.** Every
   `https://www.plex.tv/blog/category/<name>/` URL in the shard is a WordPress taxonomy listing of
   posts already covered individually; it carries no prose of its own. The slug list is itself the
   finding and is recorded below as the PRODUCT-LINE ROSTER.
2. **Skipped by slug, not fetched — 1 blog index** (`https://www.plex.tv/blog/`) and **53
   holiday / listicle / poll / codec-fix posts.** Full list at the end of this section so anyone
   can challenge a call. Categories: seasonal greetings (`happy-halloween-from-plex`,
   `mele-kalikimaka`, ...), monthly content listicles (`new-on-plex-in-*`, 10 of them), surveys
   and polls, forum/mirror/website housekeeping, and OS X video-decoding bug posts from 2008-2010
   (`experimenting-with-bicubic-scaling`, `fix-for-video-problems-on-ati`, ...). CanonCore refuses
   transcoding, so the decoding posts cannot contain a rule for it.
3. **Fetched 116, then keyword-triaged.** All 116 bodies were extracted to plain text and grepped
   for reversal keywords (`no longer`, `discontinu`, `deprecat`, `sunset`, `shut down`, `retire`,
   `will be removed`, `going away`, `end support`) and capability keywords (`metadata agent`,
   `edition`, `watch(ed) state`, `view state`, `sort order`, `custom order`, `collection`,
   `chronolog`, `sharing`, `merge`, `API`, `webhook`). Files that hit were read in full; files
   that hit nothing were read only as far as their opening paragraph. 1 URL
   (`live-tv-gratis`) is a 301 redirect out of the blog to a marketing page and has no post.

Net: 39 (earlier blocks) + 116 fetched + 113 slug-triaged + 1 dead redirect = 269 unique URLs.

### Block 5 — the highest-value page on this shard

**https://www.plex.tv/blog/marvel-movies-in-order-should-you-watch-them-in-release-or-chronological-order/**
— 2026-02-26. **THE SINGLE MOST LOAD-BEARING PAGE IN THIS SHARD.** Plex publishes, as editorial
content on its own domain, the exact artefact CanonCore exists to hold as data — and in doing so
demonstrates, without meaning to, every reason its own product cannot hold it.

- Two complete orderings of one franchise, printed as two tables: **"Complete MCU Release Order
  List" (37 rows)** and **"Complete MCU Chronological Order List" (53 rows)**.
  - Classification: **ADOPTED, and this is the product's thesis in the vendor's own words.** The
    same item sits at different positions in both: *Captain America: The First Avenger* is #5 in
    release order and #2 in chronological. That is placements-carry-order, verbatim.
  - **The membership differs, not just the sequence.** The chronological list contains 16 items the
    release list does not — `Agent Carter`, `Loki`, `What If...?`, `WandaVision`, `Hawkeye`,
    `Moon Knight`, `Ms. Marvel`, `She-Hulk`, `Secret Invasion`, `Echo`, `Agatha All Along`,
    `Daredevil: Born Again`, `Werewolf by Night`, the `Guardians Holiday Special`, and more. This
    is direct field evidence for the prompt's rule **"EVERY CONTAINER OWNS ITS MEMBERSHIP OUTRIGHT
    ... Do NOT build a source container that other orderings re-sequence."** A re-sequencing model
    would have to represent this as a subset filter over one master list, and there is no such
    master list: neither ordering is a subset of the other in intent, they are two different
    editorial claims about what belongs.
- **POSITIONS THAT ARE NOT DATES, printed in the "Timeline Setting" column.** Verbatim values:
  `1260 BC - 1896 AD`, `1946 - 1947`, `1964 (Earth-828)`, `2016 - 2017`, `2018 / 2023`,
  `Outside Time`, `Various`, `2024 - 2025`, `2026 - 2027`.
  - `Outside Time` and `Various` are placements with a real position in the container and **no
    date at all**. The prompt's date machinery (EDTF plus a precision column) cannot express them,
    and it should not try: they are exactly why `placements.position` is an integer the owner
    controls rather than a sort derived from a date. **ADOPTED, and this is the case that proves
    position must not be derived.**
  - `2018 / 2023` (Endgame) is one item whose in-universe setting is two disjoint spans — the
    interval shape the prompt already has for `edition_coverage`, applied to a different axis.
    Not a gap; noted so nobody tries to make `position` a date range.
- **AN ORDERING IS AN ASSERTION BY A SOURCE, AND IT CHANGES.** Verbatim: *"the MCU officially
  adjusted its chronology in August 2025. Disney+ added Eyes of Wakanda to the top of its MCU
  Timeline Order, **replacing Captain America: The First Avenger**."* And: *"Disney+ also
  restructured its Marvel section in October 2020, adding both phase-based groupings and a timeline
  order collection. This collection now serves as the studio's official reference."*
  - Classification: **ABSENT — HIGH.** In CanonCore a placement row is
    `(id, owner_id, container_id, item_id, position, edition_id)` and carries **no source**. But
    the provider contract's `browse` operation explicitly *"returns a container AND its ordering,
    so browsing a range yields placements for free"* — which means placements arrive from
    providers, and nothing in the model records which provider asserted an ordering, or lets two
    providers disagree about one. Every other value in the system has provenance; the ordering,
    which is the product's whole point, does not.
  - The prompt does say **"A PLACEMENT IS A LEGITIMATE SUBJECT"** of statements, so
    `source -> Disney+` is *expressible* as a statement on a placement. What is missing is that
    nothing requires it, no import path populates it, and there is no `rank` equivalent for
    resolving two providers' competing orderings of the same container the way `rank` resolves two
    providers' competing values for one field. **The favourite mechanism stops at the field
    boundary and the ordering is on the far side of it.**
- **ALTERNATE CONTINUITIES ARE LOAD-BEARING HERE, NOT HYPOTHETICAL.** Verbatim: *"The film takes
  place primarily in 1964, but in an alternate reality called Earth-828 ... This setting features
  retrofuturistic design elements that separate it from the main MCU timeline (Earth-616)."* And
  the canonicity dispute: *"Marvel has confirmed they [Agents of SHIELD, the Netflix shows] exist
  outside the Sacred Timeline"*, reversed later — *"As of 2025, these shows are officially part of
  the MCU."*
  - The prompt reserves the word: *"Canon is the product's name and nothing else — not a field, not
    a UI word. If continuities ever need distinguishing, the word is `continuity`."*
  - Classification: **ABSENT — MEDIUM.** The word is reserved but no mechanism is specified. On
    this evidence a continuity is (a) disputed, (b) reversible over time, and (c) asserted by a
    source — which makes it a `category` statement with provenance and `rank`, exactly the
    machinery that already exists. So the gap is small and the answer is already in the model; what
    is absent is *saying so*, and the risk is an implementer inventing a `continuity` column.
- **ORTHOGONAL GROUPING AXES ON THE SAME ITEMS.** Every item carries a Phase (six of them) and a
  Saga (two), and Disney+ ships "both phase-based groupings and a timeline order collection". One
  franchise therefore needs at minimum: release-order container, chronological container, six phase
  containers, two saga containers. **ADOPTED** — an item in ten containers is the median case in
  the Tardis archive too (median 4, max 52), and this is the same shape from a completely different
  domain, which is worth having as independent corroboration.
- **THE COMPLETIONIST PROBLEM, STATED AS A NUMBER.** *"With total runtime exceeding 200 hours ...
  The franchise includes 37 films, over 20 TV series, multiple specials, and various One-Shots."*
  The prompt computes container progress **count-based, never duration-weighted, "since runtime is
  missing for most of any real catalogue"**. This page is the counter-case where runtime IS known
  and IS the number the reader wants. Classification: **DIVERGENT (deliberate), and the cost is
  visible.** Worth stating in the prompt that a total-runtime *display* is not the same thing as
  duration-weighted *progress*, because an implementer will read the rule as banning both.
- **"One-Shots"**, *"a series of short films ... that bridge gaps between movies ... add small
  details to the larger story without being required viewing"*, and Disney+ **specials**. See the
  EXTRAS gap recorded in Block 6 — this is the second independent sighting of it.

### Block 6 — the agent architecture, in Plex's own post-mortem

**https://www.plex.tv/blog/find-that-tune/** — 2019-11-20. **HIGH-VALUE. Plex's own written
diagnosis of why the per-server metadata-agent stack failed**, and the reason it centralised
instead. Every one of its three complaints is a decision the prompt already takes a position on.

Verbatim setup: *"Historically, all of the tasty metadata that powers your Plex library has been
collected by a loosely-coupled set of 'agents' that live on your server, each one responsible for
talking to a single metadata source, with a framework responsible for merging everything together
to present the full picture. For example, plot summaries may come from The Movie DB, ratings from
IMDB, and reviews from Rotten Tomatoes."*

Then the three failures, verbatim:

1. *"each server's agent stack can only be so smart about how it interleaves different pieces of
   metadata. **It boils down to a stack-ranked list, so there's no way to get, let's say, artist
   bios from Last.fm but album art from fanart.tv**."*
   - Classification: **ADOPTED — this is precisely the hole the per-field favourite fills.** The
     prompt's source order IS a stack-ranked list and would inherit this exact defect, except that
     `statements.rank` is set per field by hand, so bios from one provider and art from another is
     the ordinary case rather than the impossible one. This paragraph is the strongest vendor
     evidence in the entire sweep that `rank` is load-bearing rather than nice-to-have.
2. *"we're entirely at the mercy of the original providers for the content. Even if we can all
   agree that the plot summary for a movie is too spoilery, or the season two poster for your
   favorite show looks like someone's kid sister just learned Photoshop, **we couldn't tell the
   agents otherwise**."*
   - For text fields: **ADOPTED** — the Owner is a first-class source sitting first in the source
     order, so an owner-authored synopsis simply wins. Solved.
   - For artwork: **NOT SOLVED, and this is a real hole.** See the artwork finding below.
3. *"basically everyone just wants the best metadata we can find. **It turns out they're not
   interested in a part-time job managing metadata agent settings.** Who could have guessed?"*
   - Classification: **the strongest objection on record to CanonCore's whole enrichment design,
     stated by the incumbent that tried it and quit.** It is already answered, and the answer
     should be stated where it can be seen: the source order is *single and global* with the Owner
     pinned first, *"Nothing is stored per field until the owner cares"*, and a group *chooses* its
     providers rather than re-ranking them. Zero configuration is the default path; the ranking
     work only exists for the owner who wants it. Nothing needs changing — but an implementer who
     reads this page and not this paragraph will conclude the design is known-bad.

**Plex's resolution, verbatim:** *"a huge part of the new music solution has been **standing up our
own metadata service in the cloud** ... seeded by the best metadata sources ... easily accessible
by your server in one convenient location."* This is the opposite direction to CanonCore, and it is
the direction that costs the user provenance entirely: after this change a Plex user cannot see
which source a music value came from, because the merge happens on Plex's servers.

Also on this page:
- *"There is **no longer a choice between basic and premium music libraries**"* — Plex removed a
  library-tier distinction it had shipped. Library typing collapsing again (see 2016 photo/video
  merge below).
- Matching by **audio fingerprint** (AcoustID) and a scanner *"inspired by"* **Beets**, because
  filename and tag matching was insufficient — *"'listens' to a few seconds of the track and
  searches for matches based on the actual audio instead of relying on file names or tags."*
  CanonCore's file identity is `SHA1(size + SHA1(first 64KB) + SHA1(last 64KB))`, which is
  **byte identity, not content identity**: two encodes of one episode are two unrelated files.
  Classification: **ABSENT — LOW.** Correct for its stated job (a moved file is the same file) and
  the prompt's matching is item-level via providers, not file-level. Recorded only so nobody later
  mistakes the SHA1 for a content fingerprint.

**THE ARTWORK GAP — the one genuinely new structural hole this shard found.**

**https://www.plex.tv/blog/making-your-tv-shows-look-great-in-plex/** — 2012-05-17. Plex's local
artwork convention, which turns out to contain the missing mechanism.
- Verbatim: *"**One really cool feature is that you can actually have multiple elements**; just name
  them suffixed like `show-1.jpg`, `theme-2.mp3`. For multiple season elements, use the suffix
  a, b, c, etc."* So Plex has had **many artworks per role, with the owner choosing between them**,
  since 2012.
- And in the same era's release notes
  (**https://www.plex.tv/blog/a-new-plex-incremental-and-some-mp4-love/**, 2010-12-18):
  *"FIX: Issue where **different movie posters were picked up during each scan**."* — nondeterministic
  artwork selection is a bug Plex had to fix, and it is the artwork instance of the prompt's own
  *"a display that changes after a refresh nobody asked for is the single longest-standing
  complaint in this category."*
- Classification: **ABSENT — HIGH.** CanonCore's `artwork` table carries provider URL, role,
  licence, attribution and palette. It carries **no rank, no `is_default`, no owner pin**. `rank`
  lives on `statements`, and artwork was deliberately made a table rather than a statement, so the
  favourite mechanism does not reach it. Consequences, all forced:
  - Two connected providers each supplying a poster gives two poster rows and **nothing decides
    which renders**. Either the reader picks arbitrarily (the refresh-flip complaint, on the most
    visible field on the page) or an undeclared rule creeps in.
  - The owner has **no recourse at all** when both providers' posters are bad, because the prompt
    also refuses uploads and artwork scanning. Plex's user in 2019 could at least drop a
    `show-1.jpg` on disk; CanonCore's cannot.
  - The prompt's own three-way pattern — *"Same mechanism as the source order and the field
    favourite, deliberately: one pattern used twice, not two patterns"* — is stated for
    `editions.is_default`. Artwork is the **fourth** place that needs it and the only one that does
    not have it. The fix is one nullable column on the artwork table, at most one per (item, role),
    and it is the same sentence already written twice.

### Block 7 — features Plex shipped and killed, dated

Each of these is a page on this shard that announces a capability Plex later removed. Collected
here; the consolidated list is in FEATURES PLEX BUILT THEN KILLED at the end of the file.

**https://www.plex.tv/blog/introducing-new-game-photo-tag/** — 2016-11-23, and the post itself now
opens with an in-body reversal: **"UPDATE: This feature is no longer available on Plex."**
- What was killed: **machine-learning auto-tagging of photos**, Plex Pass gated. Verbatim:
  *"our Plex Pass subscribers can now let Plex automatically tag all your photos with fun stuff
  like 'kitten' and 'irish setter' using advanced machine learning technology"*, with two uses —
  tag search, and *"when you're viewing a photo, you can now see related photos based on tags, and
  explore that related set."*
- Classification: **REFUSED, correctly, and this is the evidence.** The prompt bans a tag table
  outright (*"A tag is an owner-authored `category` statement, which gets provenance for free"*).
  An ML tagger produces exactly the values that most need provenance and a confidence band, and
  Plex's implementation had neither — the tags had no source, no score, and no correction path, so
  when the model was withdrawn the tags went with it and the search built on them died.
  Under the prompt's model the same feature is a provider proposing `category` statements against
  the two thresholds, and withdrawing the provider leaves the statements standing with their
  source intact.
- Also in this post, and separately important: *"the photos and personal video that you shoot on
  your phone **no longer need to live in separate libraries**. Your 'Photo' libraries now
  incorporate your personal videos too."* — Plex merging two typed libraries because the typing was
  the problem. **ADOPTED** — the prompt's *"WHY never typed by medium: a Plex library is typed, and
  that is exactly what stops a container holding mixed media."*

**https://www.plex.tv/blog/introducing-the-plex-media-player/** — 2015-10-20. Verbatim: *"Plex Home
Theater is still available and open source. **We're no longer actively developing it** and are
focusing our efforts on making Plex Media Player the best experience possible."* Plex Media Player
was itself discontinued in 2020. **Two consecutive desktop clients killed**, the second within five
years of replacing the first. Relevant to the prompt's client order (web now, phone, then TV) only
as a caution about client count.

**https://www.plex.tv/blog/immerse-yourself-in-your-media-with-gear-vr-and-oculus/** — 2018-04-05.
Plex VR. Killed; `plex-vr` survives only as a dead blog category.

**https://www.plex.tv/blog/all-the-news-thats-fit-to-plex/** — 2017-09-26. Plex News. Killed 2023.
**https://www.plex.tv/blog/androids-dream-plex-car/** — 2017-10-17. Plex for Android Auto/CarPlay.
**https://www.plex.tv/blog/bitcasa-joins-our-cloud-sync-line-up/** — 2013-12-13. Cloud Sync
(Dropbox / Google Drive / Copy / Box / Bitcasa targets). Killed 2016.
**https://www.plex.tv/blog/a-massive-bookmarklet-upgrade/** — 2013-10-18. The browser bookmarklet
that pushed web video into your queue. Killed with Watch Later.
**https://www.plex.tv/blog/email-videos-to-your-myplex-queue/** — 2011-11-20, and
**https://www.plex.tv/blog/myplex-queue-api-how-to/** — 2011-11-12. The myPlex Queue, with a
documented public API and an email-in address. Became Watch Later; killed 2019.
- These five share one shape and it is worth naming: **every Plex feature that depended on scraping
  or embedding a third party's web content died.** The plug-in channels (2018), the queue and its
  bookmarklet, Cloud Sync, News. The prompt's provider model does not have this failure mode,
  because a provider proposes values into fields CanonCore owns and its withdrawal leaves the
  statements standing with provenance. The features that survived at Plex are the ones that only
  touched the user's own files.

### Block 8 — capability pages, classified

**https://www.plex.tv/blog/frankly-trailer-dont-give-playlist/** — 2014-07-31. Playlists, Extras
and the iTunes importer, all in one release.
- **Extras.** Verbatim: *"we scoured the earth looking for the best source for trailers and we
  found one which also had **tons of interviews and behind-the-scenes content** ... we'll
  automatically add all these amazing extras to your library as you add movies."* Plus
  **Cinema Trailers**: *"Choose the types of trailers to use on the server; then in supported Plex
  apps, you can select the number of trailers to play before a movie."*
  - Classification: **ABSENT — MEDIUM.** A behind-the-scenes featurette is not an *edition* of the
    film (the content differs, so by the prompt's own adaptation-versus-edition test it fails) and
    it is not an *adaptation* either. Making it a separate `work` item is the only expressible
    answer and it floods every work-browsing surface with fifty featurettes per film. Both Plex and
    Jellyfin ship a dedicated extras concept precisely because neither the item nor the edition
    axis holds it. The prompt's `part_of` statement plus a `category` statement is probably the
    answer, but the browse-surface exclusion rule (*"exclude BY KIND"*) does not cover it, because
    an extra is kind `work`. **Second independent sighting: the MCU page's "One-Shots" and
    Disney+ "specials", 2026.**
- **Playlists as a second ordered-container concept.** Plex ships collections AND playlists,
  distinct types with distinct UIs. CanonCore folds both into containers.
  Classification: **ADOPTED (the fold is right)**, and note that Plex's own split is why a Plex
  collection cannot be reordered the way a playlist can.
- **Watch-state import.** Verbatim: *"our importer provides you with a nearly seamless way to
  transition over playlists (including smart playlists), **play/skip counts, track ratings, and
  even media addition dates**."* Also in the changelog: *"Support for **skip count and skip
  date**."*
  - Classification: **ABSENT — MEDIUM.** Two things. (a) There is no import path for progress at
    all, and *"No fork, no export, no import"* is scoped to cross-*instance* CanonCore transfer,
    not to bringing a watch history in from elsewhere — so this is genuinely unspecified rather
    than refused, and a catalogue nobody can move into is a catalogue nobody adopts. (b) A **skip**
    is an event distinct from a watch and Plex records it with its own count and date. The prompt's
    append-only watch event log is the right store for it and does not name it.
- Also: *"this is the first time we've licensed premium content for our Plex Pass users; so, **we
  reserve the right to impose viewing limits in the future**"* — the standing cost of routing
  licensed third-party content through the product. CanonCore's providers propose metadata only, so
  it does not incur this. **REFUSED, and rightly.**

**https://www.plex.tv/blog/announcing-the-new-plexpass-feature/** — 2012-11-19. PlexSync.
- Verbatim: *"your **watched state & view offsets are synced back to your server the next time you
  connect**. The sync details are stored in the cloud, so they can be edited even if your server is
  offline."*
  - Classification: **ADOPTED, and this is the argument for the event log.** Offline playback
    produces progress that must reconcile later against progress made elsewhere. A mutable state
    row cannot merge two divergent offsets; an append-only event log merges by construction. The
    prompt's *"Append-only watch EVENTS are the truth, plus a maintained state row for reads"*
    is what makes offline clients possible at all, and the phone app is on the roadmap.
- Also *"filter out episodes you've already watched"* as a sync rule predicate — watch state as a
  first-class filter input, which the smart-container filter builder will need.

**https://www.plex.tv/blog/a-new-plex-incremental-and-some-mp4-love/** — 2010-12-18, and
**https://www.plex.tv/blog/making-your-tv-shows-look-great-in-plex/** — 2012-05-17. The
**Local Media Assets agent**.
- Verbatim: *"While most agents scurry all over the Internet looking for data, this one **looks only
  on your hard drive**, for things like poster files, fanart files, and now ... metadata embedded in
  MP4 files. The awesome thing is when you look at your metadata agent settings, and realize that
  you can **\*prefer\* local metadata, but fall back to data from the Internet**."*
  - Classification: **REFUSED by the prompt** (*"no artwork scanning, no `.nfo` reading. The scanner
    takes media files and playback sidecars, and nothing else"*) — but the *shape* is worth
    recording. Plex did not special-case local metadata; it made local disk **just another agent in
    the same ranked stack**. CanonCore's equivalent, if it is ever wanted, is a local CMPP provider
    at `http://localhost`, which costs nothing in the model and would sit in the source order like
    any other. Nothing needs building now. The point is that the refusal does not need a special
    exception later, because the contract already accommodates it.
  - Also: **"FIX: Unmatching an item wasn't resetting posters and other graphics correctly."**
    Unmatch is a first-class operation in Plex. Classification: **ABSENT — MEDIUM.** The prompt
    splits matching from applying, remembers rejections, and gives lookup-not-search as a rule
    *because* *"a refresh by search can silently rebind a record to the wrong thing"* — so a wrong
    bind is anticipated as the hazard, and the corrective operation is not specified. What does
    "unmatch this item from TMDB" do to the statements TMDB already contributed? Nothing in the
    prompt says, and the three plausible answers (delete them, mark them stale, leave them) are
    materially different.
  - Also: the scanner *"parse[s] MP4 files and determine[s] [season/episode] through looking at the
    information in the file."* Whether CanonCore's scanner may read tags **embedded inside** a media
    file, as distinct from a sidecar, is genuinely unspecified. **ABSENT — LOW**, but it is a
    one-line ruling and cheaper to make now than to discover.

**https://www.plex.tv/blog/heart-your-photos/** — 2017-12-12. Favourites.
- Verbatim: *"you can quickly mark your photos with a heart which **automatically adds them to a
  Favorites album** ... **If you don't have a Favorites album already, it will automatically be
  created** with your first favorited photo."*
  - Classification: **ABSENT — LOW.** An item-level favourite is an owner-authored `category`
    statement and needs nothing new. The pattern worth stealing is the second half: a container
    that materialises on first use rather than sitting empty in the UI from day one.

**https://www.plex.tv/blog/alexa-ask-plex-get-party-started/** — 2017-02-02. Webhooks.
- Verbatim: *"any **media playback event or media rating event** can trigger a webhook ... dim the
  lights when you start a movie, or send a tweet after you finish an episode."*
  - Classification: **ABSENT — MEDIUM.** CanonCore already stores the hard part — an append-only
    event log — and has no outbound notification of any kind. `webhooks` has been a durable Plex
    product surface since 2016 and is the standard integration seam for self-hosted media software.
    This is not covered by *"no cross-instance sharing"*, which is about CanonCore-to-CanonCore
    transfer. Small to build on top of what already exists; absent from the prompt entirely.

**https://www.plex.tv/blog/air-human-plex-dvr-divine/** — 2016-09-01.
- Verbatim: *"we've also added **the ability to sort individual shows by newest or oldest
  episodes**"*, plus a retention rule (*"keep a fixed number of unwatched episodes for a show"*).
  - Classification: **ABSENT — LOW/MEDIUM.** A per-container default display direction. CanonCore
    stores an order on the placements; which end of it a reader sees first is a per-container
    preference the prompt does not have. It matters for exactly the case the prompt cares about —
    a Release-order container of 500 items whose owner wants the newest at the top — and it is one
    nullable column.

**https://www.plex.tv/blog/new-year-same-mission/** — 2025-01-22. Public reviews, profiles and
per-category privacy.
- Verbatim: *"you can now access your Plex profile on watch.plex.tv, and make it visible to ANYONE!
  ... they can see **what you've been watching, what's on your Watchlist**"* and *"**Your privacy
  settings apply to ALL of your Ratings & Reviews.** These options are also now available for other
  profile privacy settings like Watchlist, Watch History, and your Friends list."*
  - Classification: **REFUSED** by the prompt (*"No visibility system. Not a column, not
    propagation, not a resolution rule"*) — but the shape is instructive and supports the refusal.
    Plex's visibility is **per-category and global**, a handful of fixed toggles over whole classes
    of data. It is expressly *not* per item, and therefore never has to answer the prompt's killer
    question, *"Inherit from which parent?"*. If visibility ever arrives with multi-user, this is
    the shape that survives multi-placement: toggles over categories, never a flag on a row.

**https://www.plex.tv/blog/new-lifetime-plex-pass-pricing/** — 2026-05-19, updated 2026-07-01.
Pricing, and a roadmap that contains two reversals.
- Pricing ladder, verbatim: Lifetime **$249.99 → $749.99** on 2026-07-01, plus a **new 5-Year
  recurring at $249.99**. (Combined with the 2025-03-19 page already in Block 1, that is
  $119.99 → $249.99 → $749.99 in fifteen months.) *"We've considered eliminating the Lifetime Plex
  Pass in the past, given that recurring subscriptions help us sustain long-term development."*
- **REVERSAL 1 — features lost to a rewrite.** Verbatim roadmap items: *"**Music and photo library
  support will be restored** in the mobile apps and the new experience on TV apps"* and *"Support
  for **Playlist creation and editing** in the mobile apps"*. The New Plex Experience shipped on
  2025-03-31 with music, photos and playlist editing **missing**, and they are being restored more
  than a year later. This is the single clearest external instance of the principle the prompt and
  CLAUDE.md both state — *"Never trade a working product for unfinished complexity"* — and it cost
  the incumbent a year of its most engaged users' goodwill. **ADOPTED, and this is why.**
- **REVERSAL 2, against CanonCore.** Verbatim roadmap item: *"**Support for NFO metadata**."*
  After eighteen years of refusing sidecar metadata files, Plex is adding them in 2026.
  - Classification: **DIVERGENT (deliberate), and the industry is moving the other way.** The
    prompt refuses `.nfo` reading outright. Recorded honestly rather than argued away: the reason
    users want NFO is portability — metadata that survives the server that wrote it — and
    CanonCore's answer to portability is *"No fork, no export, no import"*, which is the opposite
    answer to the same question. Both positions are defensible; only one of them is written down.
    Worth a sentence in the prompt saying which problem NFO solves and why CanonCore does not solve
    it, so the refusal is not re-litigated from first principles by every implementer who meets it.
- Also roadmap: *"All server and library management features currently available on app.plex.tv
  will be added to the mobile apps"* — server management migrating into clients, which is the same
  direction as the 2025 *"new bespoke server management app"* already recorded in Block 1.

**https://www.plex.tv/blog/free-bird-plexamp-spreads-its-wings-for-every-music-lover/** —
2023-07-18. Plexamp made free.
- Verbatim, on an AI feature: *"(**This feature requires an OpenAI API key.**)"*
  - Classification: **ADOPTED — direct industry precedent for the prompt's SHIP NO API KEYS rule.**
    Plex, a commercial vendor with the leverage to negotiate a bulk key, still requires the user to
    supply their own for a third-party AI service. The prompt's *"A self-hosted instance supplies
    its own provider credentials"* is what the commercial incumbent does too, not just what the
    free projects are forced into.
- Also lists **"Multiple Movie Editions"** among Plex Pass features — see below for its date.

**https://www.plex.tv/blog/2022-year-in-review/** — 2022-12-29. Dates two things the prompt argues
about.
- Verbatim, August 2022: *"New Features Launched: **Multiple edition support** / **View state
  sync** / Discover Together on mobile"*, and in the body *"we added multiple edition support ...
  the ability to **sync your watch state and ratings**"*.
  - **Plex shipped multiple editions in August 2022** — eleven years after collections were in its
    database. The prompt's claim that *"Plex merges versions but its automatic pick is about what
    the client can decode ... and its users are still asking for a way to set the one they want"*
    is dated by this: the feature is three years old at time of writing, not ancient, and the
    request the prompt cites post-dates it.
- Also *"**Discover Credits**, personal media users ... now have a powerful new way of navigating
  your media libraries **by favorite actors, directors, and writers**"* — entity-led browsing over
  a personal library. **ADOPTED**: this is the prompt's entity items reached deliberately, and it
  is also the exact surface the *"entities must not leak into work-browsing"* rule protects.

**https://www.plex.tv/blog/more-python-goodness/** — 2008-03-25. The first recorded cost of
in-process plug-ins, on day one of the framework: *"I did need to replace some of the Python
libraries in the downloaded script with the OS X version. **This raises the issue of how to support
downloading scripts for different platforms, when the scripts need binary components.**"*
- Classification: **REFUSED, and this is the earliest evidence.** The prompt's *"not a plugin, not
  a repo, and never code running inside the app"* removes this problem entirely: a provider is a URL
  and its platform is its own business. Plex asked the question in March 2008 and shut the
  framework down ten years later without ever answering it.

### Slug-triaged list (fetched: NO) — declared in full

Category index pages, 59: `amazon-alexa`, `amazon-fire-tv`, `android`, `android-auto`,
`android-tv`, `announcement`, `apple-tv`, `barkley-jowlsworth-bonestein`, `brand`, `carplay`,
`chromecast`, `cloud`, `community`, `customer-spotlights`, `discover`, `geek-week`, `ios`, `kodi`,
`live-tv`, `live-tv-dvr`, `new-on-plex`, `news-podcasts`, `news-podcasts/news`,
`news-podcasts/podcasts`, `nvidia-shield`, `playstation-3`, `playstation-4`, `plex-arcade`,
`plex-dash`, `plex-desktop`, `plex-for-mac`, `plex-for-windows`, `plex-labs`, `plex-media-player`,
`plex-media-server`, `plex-pass`, `plex-photos`, `plex-pro`, `plex-web`, `plexamp`, `pro-week`,
`rentals`, `roku`, `smart-tvs`, `sonos`, `streaming-music`, `tvos`, `uncategorized`,
`wd-my-cloud-pro-series`, `wd-my-passport-wireless-pro`, `webhooks`, `windows`, `xbox-360`,
`xbox-one`, `your-media`, `your-media/movies-tv`, `your-media/music`, `your-media/photos-videos`,
`your-media/plex-vr`, plus the bare `/blog/` index.

**THE PRODUCT-LINE ROSTER IS THE FINDING.** Those slugs are a durable, self-maintained list of every
product line Plex has had a blog category for, and **eleven of them name dead or discontinued products**:
`plex-arcade` (cloud/local game streaming, killed 2023), `plex-media-player` (killed 2020),
`plex-labs`, `plex-dash`, `plex-vr`, `news-podcasts/news` (killed 2023),
`news-podcasts/podcasts` (killed 2022-04-15, already dated in Block 1), `kodi`, plus the two
WD-hardware categories and `rentals` (the movie-rental storefront). A vendor's own taxonomy outlives
the products in it, which is the cheapest possible census of what got built and abandoned.

Holiday / listicle / survey / housekeeping / codec-fix posts, 53 (not fetched):
`20-highest-grossing-movies-of-all-time-finding-the-audiences-favorites`, `a-postcard`,
`audio-hardware-poll`, `back-to-school-with-plex`, `barkley-jowlsworth-bonestein`,
`best-movies-to-watch`, `beware-the-ides-of-march-madness`, `beware-the-new-flash-10-1-beta`,
`blog-migration`, `diagnostic-release-for-tv-mode-problem`, `does-a-snow-leopard-have-spots`,
`endless-summer-plex-western-digital`, `experimenting-with-bicubic-scaling`, `family-in-town`,
`finally-nailed-the-font-issue`, `fix-for-video-problems-on-ati`, `happy-april-fools-day`,
`happy-halloween-from-plex`, `happy-holidays-from-plex`, `happy-pi-day`, `happy-plexivus-2020`,
`happy-thanksgiving`, `happy-valentines-day`, `high-quality-upscaling-in-next-release`,
`international-forums-added`, `interview-with-automatedhome`, `interview-with-crunchgear`,
`introducing-our-brand-new-website`, `inverse-goldilocks`, `keeping-me-company`,
`let-the-discussions-begin`, `like-really-really-like-plex-customer-spotlights`,
`looking-for-a-few-good-mirrors`, `looking-for-some-help-with-ac3dts-passthrough`,
`make-sure-youre-using-the-latest-version`, `meet-our-survey-contest-winners`, `mele-kalikimaka`,
`move-to-lighthouse`, `new-download-link-and-instructions`, `new-on-plex-in-april`,
`new-on-plex-in-august`, `new-on-plex-in-december`, `new-on-plex-in-february`,
`new-on-plex-in-january`, `new-on-plex-in-july`, `new-on-plex-in-june`, `new-on-plex-in-march`,
`new-on-plex-in-may`, `new-on-plex-in-september`, `one-year-ago-today`, `our-mirrors-runneth-over`,
`please-take-our-survey`,
`plex-and-atx-tv-announce-friday-night-lights-roadshow-to-celebrate-series-20th-anniversary`.

---

## BULK LIST — fetched, keyword-triaged, no capability worth a write-up

Coordinator instruction (session 3): stop per-page prose, bulk-list everything that is not a hit.
All 93 URLs below were **fetched in full and grepped** for `no longer`, `deprecat`, `discontinu`,
`sunset`, `retir`, `removing`, `end of life`, `end support`, `plug-in`/`plugin`, `channel`,
`edition`, `version`, `watch state`, `view state`, `collection`, `shar`, `metadata agent`,
`custom order`, `sort`, `watchlist`. Where a match was only the site footer ("Share this"), a
platform name, or a version number in release notes, the page was opened to its first paragraph and
closed. Verdict for every line below: **marketing, release notes, or platform announcement; no
capability rule.**

Three sub-classes, so the shape of the noise is legible:

**(a) Plug-in / channel release notes, 2009-2010 — 23 pages.** All the same: a list of newly
published Python channels scraping a third-party video site (NPR, NME, Boing Boing, PBS, SVT Play,
Headweb, Joost, Netflix, Daily Kos, Pitchfork, CNET, Flickr, Shoutcast, Miro, ...). They matter
collectively, not individually: they are the census of what Plex's plug-in ecosystem actually WAS —
scrapers of other people's websites — which is why it rotted and was shut down in 2018. That
conclusion is already recorded in Block 1 from `automated-channel-testing` and
`celebrating-our-100th-plug-in`; these 23 add volume, not information.

- 2009-02-23 https://www.plex.tv/blog/joost-and-appstore-updates/
- 2009-02-24 https://www.plex.tv/blog/new-plug-in-national-public-radio/
- 2009-03-05 https://www.plex.tv/blog/app-store-politics-and-indie-rock/
- 2009-04-08 https://www.plex.tv/blog/netflix-has-never-looked-this-good/
- 2009-04-24 https://www.plex.tv/blog/new-plug-in-releases/
- 2009-05-16 https://www.plex.tv/blog/new-plug-in-releases-2/
- 2009-06-09 https://www.plex.tv/blog/boing-boing-video-now-available-on-plex/
- 2009-06-16 https://www.plex.tv/blog/new-plug-in-releases-3/
- 2009-06-23 https://www.plex.tv/blog/new-plug-in-releases-4/
- 2009-08-08 https://www.plex.tv/blog/new-plug-in-releases-5/
- 2009-08-15 https://www.plex.tv/blog/pbs-and-svt-play/
- 2009-08-16 https://www.plex.tv/blog/new-plug-in-releases-6/
- 2009-08-31 https://www.plex.tv/blog/new-plug-in-release-that-guy-with-the-glasses/
- 2009-09-07 https://www.plex.tv/blog/new-plug-in-releases-7/
- 2009-09-13 https://www.plex.tv/blog/new-plug-in-release-nme/
- 2009-09-27 https://www.plex.tv/blog/new-plug-in-releases-8/
- 2009-10-05 https://www.plex.tv/blog/new-plug-in-releases-9/
- 2009-10-31 https://www.plex.tv/blog/new-plug-in-releases-for-november-1st/
- 2009-11-14 https://www.plex.tv/blog/headweb-plug-in-released/
- 2009-11-14 https://www.plex.tv/blog/new-plug-in-releases-for-november-14th/
- 2009-12-22 https://www.plex.tv/blog/new-plug-in-releases-for-december-22nd/
- 2009-12-27 https://www.plex.tv/blog/new-plug-in-releases-for-december-27th/
- 2010-01-06 https://www.plex.tv/blog/new-plug-in-releases-for-january-6th/
- 2010-01-17 https://www.plex.tv/blog/new-plug-in-releases-for-january-20th/
- 2010-02-15 https://www.plex.tv/blog/new-plug-in-releases-for-febuary-15th/
- 2010-03-08 https://www.plex.tv/blog/new-plug-in-releases-for-march-8th/

**(b) 2008-2013 dev-diary and OS X release notes — 19 pages.** Playback fixes, build instructions,
download mirrors, decoder work. CanonCore is direct-play-only and refuses transcoding, so none of
this can carry a rule for it.

- 2008-01-21 https://www.plex.tv/blog/much-progress-on-video/
- 2008-02-23 https://www.plex.tv/blog/bad-movie-good-news/
- 2008-03-10 https://www.plex.tv/blog/all-checked-in/
- 2008-03-22 https://www.plex.tv/blog/good-news-and-bad-news/
- 2008-04-12 https://www.plex.tv/blog/a-quick-1080p-tip/
- 2008-04-22 https://www.plex.tv/blog/alternate-download-location/
- 2008-04-27 https://www.plex.tv/blog/accessing-your-itunes-library/
- 2008-07-02 https://www.plex.tv/blog/coming-in-the-next-beta-full-screen-lite/
- 2008-07-05 https://www.plex.tv/blog/announcing-plex/  (the XBMC split and the naming of "Plex";
  origin story, no capability)
- 2008-07-09 https://www.plex.tv/blog/getting-to-know-you-better/
- 2009-02-04 https://www.plex.tv/blog/076-released/
- 2009-10-15 https://www.plex.tv/blog/getting-to-know-you/
- 2010-04-19 https://www.plex.tv/blog/an-inconvenient-bug-or-two/
- 2010-04-27 https://www.plex.tv/blog/hardware-accelerated-h-264-decoding-on-plex/
- 2010-08-25 https://www.plex.tv/blog/a-quick-update/
- 2010-08-28 https://www.plex.tv/blog/continuing-the-conversation/  (Q&A; one line of colour —
  *"What's your favorite metadata agent? It would have to be the IMDB agent"* — no rule)
- 2010-08-30 https://www.plex.tv/blog/one-more-thing/
- 2010-09-02 https://www.plex.tv/blog/plex-and-the-future-of-television/
- 2012-04-01 https://www.plex.tv/blog/one-more-thing-2/  (April Fools)

**(c) Client / platform announcements and company marketing, 2012-2026 — 48 pages.** Each announces
an app on a device, a pricing or branding change, or a content deal. Two carry a line already used
elsewhere in this file (`part-1` and `a-trinity-of-releases` for API changelog entries;
`part-3` for the origin of the filter-and-sort builder) and are listed here rather than written up
because the line is all there is.

- 2012-08-28 https://www.plex.tv/blog/part-1-plex-media-server-v0-9-6-8/
- 2012-08-28 https://www.plex.tv/blog/part-2-introducing-plexpass/  (PlexPass launch, $3.99/mo)
- 2012-08-28 https://www.plex.tv/blog/part-3-introducing-the-new-plex-web-client/
- 2012-12-04 https://www.plex.tv/blog/announcing-plex-for-windows-8/
- 2012-12-08 https://www.plex.tv/blog/a-big-update-for-the-plex-roku-channel/
- 2013-01-02 https://www.plex.tv/blog/a-trinity-of-releases/
- 2013-02-11 https://www.plex.tv/blog/introducing-the-new-plex-for-android/
- 2013-05-27 https://www.plex.tv/blog/plex-3-2-for-ios-released/
- 2013-06-04 https://www.plex.tv/blog/introducing-plexconnect-an-appletv-client-which-thinks-different/
- 2014-02-24 https://www.plex.tv/blog/chromecast-enhancements-shared-sync-more-omg/
- 2014-03-13 https://www.plex.tv/blog/chromecast-free-everyone-great-new-features-ios/
- 2014-05-13 https://www.plex.tv/blog/camera-upload-android-windows-phone-sync-windows-8/
- 2014-08-11 https://www.plex.tv/blog/new-trailers-features/
- 2014-10-15 https://www.plex.tv/blog/nexus-player-coming/
- 2014-12-12 https://www.plex.tv/blog/playlists-come-to-android/
- 2015-02-24 https://www.plex.tv/blog/brand-new-plex-app-platform-people/
- 2015-03-27 https://www.plex.tv/blog/major-updates-android-app-2/
- 2015-04-16 https://www.plex.tv/blog/huge-update-smart-tv-app/
- 2015-06-04 https://www.plex.tv/blog/its-not-easy-being-green-secure-communication-arrives/
- 2015-07-07 https://www.plex.tv/blog/oh-yeah-a-great-update-for-the-xbox-one-app/
- 2015-08-10 https://www.plex.tv/blog/our-shiny-new-ios-app/
- 2015-08-25 https://www.plex.tv/blog/graduation-day-the-roku-and-xbox-360-apps-are-now-free-for-everyone/
- 2015-08-27 https://www.plex.tv/blog/a-massive-update-for-our-smart-tv-and-playstation-apps/
- 2015-12-23 https://www.plex.tv/blog/let-it-snow-lyrics-for-all-your-music/
- 2016-03-31 https://www.plex.tv/blog/best-platform-of-the-people-gets-life-changing-update/
- 2016-06-09 https://www.plex.tv/blog/nvidia-shield-you-complete-us/
- 2016-06-23 https://www.plex.tv/blog/long-winding-road-v1-0/
- 2016-09-14 https://www.plex.tv/blog/ok-ask-help-plex-pro-installer-program-arrived/
- 2016-10-03 https://www.plex.tv/blog/mcstreamy-brain-take-world-two-easy-steps/
- 2017-06-13 https://www.plex.tv/blog/open-play-video-file-android/
- 2017-09-06 https://www.plex.tv/blog/live-tv-amazon-fire-tv-web/
- 2017-12-07 https://www.plex.tv/blog/catch-restart-android/
- 2018-02-08 https://www.plex.tv/blog/live-tv-and-time-shifting-extravaganza/
- 2018-03-20 https://www.plex.tv/blog/massive-update-chromecast-app/
- 2019-04-25 https://www.plex.tv/blog/expand-your-musical-universe-in-sixty-seconds-flat/
- 2019-12-04 https://www.plex.tv/blog/boom-we-just-dinosized-your-movie-collection-for-free/
- 2019-12-11 https://www.plex.tv/blog/building-a-personal-media-paradise/
- 2020-03-25 https://www.plex.tv/blog/okay-so-here-we-are/
- 2020-04-02 https://www.plex.tv/blog/making-television-more-televisionary/
- 2020-05-01 https://www.plex.tv/blog/a-second-helping-of-free/
- 2021-04-14 https://www.plex.tv/blog/one-giant-step-for-plex-kind/
- 2022-02-24 https://www.plex.tv/blog/cord-cutters-rejoice-all-your-live-tv-all-in-one-place/
- 2022-04-05 https://www.plex.tv/blog/end-the-streaming-struggle-with-plex/  (Discover + the
  unified Watchlist; a hand-placed to-watch container, which CanonCore's model already covers)
- 2022-04-28 https://www.plex.tv/blog/new-logo-same-plex/
- 2023-12-21 https://www.plex.tv/blog/2023-a-year-of-discovery/
- 2024-05-31 https://www.plex.tv/blog/a-beginners-guide-to-plex/
- 2025-03-31 https://www.plex.tv/blog/its-go-time-the-new-plex-experience-is-here/  (the New Plex
  Experience ships on mobile; content-free, and see the 2026 pricing page for what it dropped)
- 2025-12-18 https://www.plex.tv/blog/2025-plex-rewind/

One URL, `https://www.plex.tv/blog/live-tv-gratis/`, is a 301 to `/tv-gratis/` and has no post.

---

## FEATURES PLEX BUILT THEN KILLED

Dated from this shard's own pages unless marked otherwise. This is the list the sweep was for.

| Feature | Announced | Killed | Evidence on this shard |
|---|---|---|---|
| **Python plug-in framework / channels** | 2009-04-08 `opening-the-plug-in-floodgates` | 2018, at under 2% usage; ecosystem stranded seven years | Block 1; the 23 channel release-note posts are the census of what it was |
| **Podcasts** | 2018-05-30 `have-plex-your-way` | **2022-04-15**, stated in-post: *"we've made the decision to end support for podcasts within Plex"* | Block 1 |
| **ML photo auto-tagging** | 2016-11-23 `introducing-new-game-photo-tag` | in-post: **"UPDATE: This feature is no longer available on Plex."** | Block 7 |
| **Plex Home Theater** | pre-2015 | 2015-10-20, superseded: *"We're no longer actively developing it"* | Block 7 |
| **Plex Media Player** (its replacement) | 2015-10-20 `introducing-the-plex-media-player` | 2020 | Block 7; dead `plex-media-player` blog category |
| **Cloud Sync** (Dropbox/Drive/Box/Copy/Bitcasa) | 2013-12-13 `bitcasa-joins-our-cloud-sync-line-up` | 2016 | Block 7 |
| **myPlex Queue → Watch Later**, with a public API and an email-in address | 2011-11-12 / 2011-11-20 | 2019 | Block 7 |
| **The browser bookmarklet** that fed the queue | 2013-10-18 `a-massive-bookmarklet-upgrade` | with Watch Later | Block 7 |
| **Plex News** | 2017-09-26 `all-the-news-thats-fit-to-plex` | 2023 | Block 7; dead `news-podcasts/news` category |
| **Plex VR** (Gear VR / Oculus) | 2018-04-05 | — | Block 7; dead `your-media/plex-vr` category |
| **Plex Arcade** | — | 2023 | dead `plex-arcade` blog category |
| **Plex for Car** (Android Auto / CarPlay) | 2017-10-17 `androids-dream-plex-car` | — | dead `android-auto`, `carplay` categories |
| **Basic vs premium music libraries** (the tier itself) | — | 2019-11-20: *"There is no longer a choice between basic and premium music libraries"* | Block 6 |
| **Per-server metadata agents**, replaced by a central cloud service | 2008 | 2019-11-20 for music; the model's post-mortem is `find-that-tune` | Block 6 |
| **Free remote streaming of your own files on your own server** | since launch | 2025-04-29: *"it is no longer offered as a free feature on Plex"* | Block 1 |
| **Music libraries, photo libraries and playlist editing in the mobile app** | pre-2025 | **removed by the 2025-03-31 rewrite**, restoration promised 2026-05-19: *"Music and photo library support **will be restored**"* | Block 8 |
| **Watch Together** | 2020-05 `coming-in-hot-watch-together-chill` | retirement began 2025-02-25 (sibling agent's finding, not re-verified here) | Block 1 covers the announce page |

Two things this list is for.

1. **Every dead feature depended on a third party's content or a third party's runtime.** Channels,
   the queue, the bookmarklet, Cloud Sync, News, Podcasts, Arcade. The features that survived are
   the ones that only touched the user's own files. CanonCore's provider model is on the surviving
   side of that line by construction: a provider proposes values into fields CanonCore owns, and
   withdrawing it leaves the statements standing with their provenance intact.
2. **The 2018 shutdown and the 2025 reopening are one arc, and the reopened shape is CMPP's.**
   2009 opened four extension points (scanners, plug-ins, metadata agents, HTTP API —
   `open-platform-meet-klexi`, Block 1). 2018 closed all of them. 2025 reopened exactly two, as
   HTTP: *"An open and documented API for server integrations, along with the ability to create
   custom metadata agents"* (`important-2025-plex-updates`, Block 1). Seven years, and the
   destination is a URL answering a contract.

---

## GAPS — ABSENT FROM CANONCORE

MEDIUM and HIGH only. LOW-rated items stay in their blocks above.

**HIGH — a placement has no provenance, and orderings cannot disagree.**
`placements` is `(id, owner_id, container_id, item_id, position, edition_id)` and carries no source.
But the provider contract's `browse` *"returns a container AND its ordering, so browsing a range
yields placements for free"*, so placements arrive from providers. Nothing records which provider
asserted an ordering, and there is no `rank` equivalent for two providers who order one container
differently — `rank` resolves competing values for a *field* and stops at that boundary. Evidence:
Disney+ *"officially adjusted its chronology in August 2025 ... **replacing** Captain America: The
First Avenger"* at the head of its timeline. An ordering is a dated, revisable claim by a named
source, and it is the one thing in this product that has no provenance.
(`marvel-movies-in-order...`, 2026-02-26.)

**HIGH — artwork has no favourite, and therefore no owner recourse.**
The `artwork` table carries URL, role, licence, attribution and palette, and **no rank, no
`is_default`, no pin**. Two providers each supplying a poster gives two rows and no rule for which
renders — the refresh-flip complaint the prompt names, on the most visible field on the page. And
because uploads and artwork scanning are also refused, an owner faced with two bad posters has no
recourse at all. Plex has had many-artworks-per-role with an owner picker since 2012
(*"you can actually have multiple elements; just name them `show-1.jpg`"*) and had to fix
nondeterministic poster selection as a bug in 2010. Fix is one nullable column, at most one per
(item, role) — the same sentence already written for `editions.is_default`.
(`making-your-tv-shows-look-great-in-plex` 2012-05-17, `a-new-plex-incremental-and-some-mp4-love`
2010-12-18, `find-that-tune` 2019-11-20.)

**MEDIUM — extras and bonus material have no home.**
A behind-the-scenes featurette, an interview, a One-Shot, a Disney+ special: not an *edition* (the
content differs, so it fails the prompt's own adaptation-versus-edition test), not an *adaptation*,
and a separate `work` item floods every browse surface. The browse-exclusion rule works *by kind*
and an extra is kind `work`, so it cannot filter them out. Both Plex and Jellyfin ship a dedicated
extras concept because neither the item nor the edition axis holds it. Two independent sightings on
this shard: `frankly-trailer-dont-give-playlist` (2014-07-31) and `marvel-movies-in-order...`
(2026-02-26).

**MEDIUM — no unmatch, and no rule for what a rebind does to applied statements.**
The prompt requires `lookup` precisely because *"a refresh by search can silently rebind a record to
the wrong thing"*, so a wrong bind is anticipated as the hazard — but the corrective operation is
never specified. "Unmatch this item from TMDB" has three plausible outcomes for the statements TMDB
already contributed (delete, mark stale, leave), they are materially different, and an implementer
will pick one silently. Plex has treated unmatch as first-class since 2010.
(`a-new-plex-incremental-and-some-mp4-love`, 2010-12-18.)

**MEDIUM — no import path for watch state, and no skip event.**
*"No fork, no export, no import"* is scoped to cross-*instance* CanonCore transfer, so bringing a
watch history in from elsewhere is unspecified rather than refused — and a catalogue nobody can
move into is a catalogue nobody adopts. Plex's iTunes importer moved *"play/skip counts, track
ratings, and even media addition dates"*, and Plex records a **skip** with its own count and date as
an event distinct from a watch. The append-only event log is the right store for both and names
neither. (`frankly-trailer-dont-give-playlist`, 2014-07-31.)

**MEDIUM — no outbound event notification.**
CanonCore already stores the hard part, an append-only watch event log, and has no webhook, no
notification, nothing that reaches outside the process. Plex has shipped webhooks on *"any media
playback event or media rating event"* since 2017 and keeps a live blog category for them; it is
the standard integration seam for self-hosted media software. Not covered by the no-cross-instance
rule, which is about CanonCore-to-CanonCore transfer. (`alexa-ask-plex-get-party-started`,
2017-02-02.)

**MEDIUM — `continuity` is reserved as a word with no mechanism.**
The prompt reserves the term and specifies nothing. On this shard's evidence a continuity is
disputed (*"Marvel has confirmed they exist outside the Sacred Timeline"*, reversed in 2025),
reversible, source-asserted, and load-bearing for placement (Earth-828 versus Earth-616). That makes
it a `category` statement with provenance and `rank` — machinery that already exists. The gap is
small and the answer is already in the model; the risk is an implementer inventing a `continuity`
column because nothing says not to. (`marvel-movies-in-order...`, 2026-02-26.)

**MEDIUM — no per-container default sort direction.**
Placements carry an order; which end of it a reader meets first is a per-container preference the
prompt does not have. It bites on exactly the case the product exists for: a Release-order container
of 500 items whose owner wants newest first. Plex added per-show newest/oldest in 2016. One nullable
column. (`air-human-plex-dvr-divine`, 2016-09-01.)

**MEDIUM — hubs / curated entry surfaces** (carried forward from Block 1, unchanged): the prompt
defers shelves to "when screens exist", and a catalogue with many orderings needs some curated
entry surface. (`hubba-bubba-introducing-custom-collections-and-hubs`, 2021-07-22.)

**MEDIUM — provider health and staleness** (carried forward from Block 1, unchanged): with
third-party CMPP providers at arbitrary URLs, "this provider has been failing for N days" is
something the owner needs and nothing in the prompt provides. Plex built an automated channel
health-checker with cash bounties in 2011 and still lost the ecosystem.
(`automated-channel-testing`, 2011-04-24.)

**MEDIUM — bulk placement** (carried forward from Block 1, unchanged): no filter-then-select-all,
no "add these 40 items to this container". The stop condition's own worked example is building two
orderings of Breaking Bad by hand. (`a-plexweb-update`, 2012-11-17.)

### Two findings that are NOT gaps, recorded because they will be raised as objections

- **"Users won't manage provider settings."** Plex's own words, 2019-11-20: *"basically everyone
  just wants the best metadata we can find. It turns out they're not interested in a part-time job
  managing metadata agent settings."* This is the strongest objection on record to CanonCore's
  enrichment design, from the incumbent that tried it and quit — and it is already answered by a
  single global source order with the Owner pinned first, *"Nothing is stored per field until the
  owner cares"*, and groups that *choose* providers rather than re-ranking them. Nothing needs
  changing; the answer needs to be visible next to the objection, or an implementer who reads that
  page will conclude the design is known-bad.
- **Plex is adding NFO support in 2026.** Roadmap item, verbatim: *"Support for NFO metadata"*
  (`new-lifetime-plex-pass-pricing`, 2026-05-19). After eighteen years of refusing it. CanonCore
  refuses `.nfo` outright; the industry is moving the other way, because what NFO actually buys is
  *portability* — metadata that survives the server that wrote it — and CanonCore's answer to
  portability is *"No fork, no export, no import"*. Both positions are defensible; only one is
  written down. Worth one sentence in the prompt naming the problem NFO solves and why CanonCore
  does not solve it, so the refusal is not re-derived from scratch by every implementer.

---

STATUS: complete

Coverage: 269 unique URLs in `urls/shards/plex-www-aa`. 39 written up individually in Blocks 1-4
(earlier sessions), 23 written up individually in Blocks 5-8, 93 fetched and bulk-listed, 113
triaged by slug without fetching (59 category indexes, 1 blog index, 53 holiday/listicle/poll/
codec-fix posts), 1 dead redirect. 39 + 23 + 93 + 113 + 1 = 269. Every skipped URL is named in
this file.
