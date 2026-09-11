# Sweep D — Plex support articles vs the CanonCore prompt

STATUS: complete

Source list: `shards/plex-support-ad` (107 URLs).
Method: plain `curl` against support.plex.tv, HTML stripped locally to readable text.
Classification key: ADOPTED / REFUSED (named in WHAT NOT TO BUILD or STANDING RULES) /
DIVERGENT (prompt takes a deliberately different position) / ABSENT (prompt is silent).
ABSENT entries carry a need rating for a self-hosted media catalogue: LOW / MEDIUM / HIGH.

## Progress log

- Done: 001-107 (all URLs in the shard).
- 001-070 covered in an earlier pass; 071-107 in a resumed pass.
- Consolidated gaps are at the end of the file.

---

## 001 — /articles/categories/plex-media-server/installation-and-basic-setup/
Category index. Topic area: install, uninstall, a **Basic Setup Wizard**, **dynamically updated server components** (component auto-update separate from the app), **server logs**.
Rule: none (index).
Classification: **ABSENT** — the prompt has no first-run setup flow, no self-update mechanism, no logging story.
Need: MEDIUM — self-hosted software with one owner password needs a defined first-run (set the password, add a group, connect a provider) and a log the owner can read when a scan or a provider fails.

## 002 — /articles/categories/plex-media-server/libraries/
Category index. Topic area: create/edit/delete libraries, **Scanning vs Refreshing**, **Matching Process**, **Emptying Library Trash**, **Analyze Media**, **Monitoring library activity**, agent migration, Collections, Publishing Collections, Manage Recommendations.
Rule: none (index).
Classification: mixed. Libraries ≈ groups (ADOPTED, and prompt DIVERGES: groups never typed by medium, never partition). Matching = the match/apply split (ADOPTED). **Library trash**, **analyze media**, **activity monitoring**, and the **scan-vs-refresh distinction** are **ABSENT**.
Need: MEDIUM — "scan (find new) vs refresh (re-ask providers)" is a distinction every catalogue needs and the prompt never names; trash/deferred-delete for vanished files is a real gap given DELETE is fully specified for items but silent on files that disappear.

## 003 — /articles/categories/plex-media-server/nas-devices/
Category index. Topic area: NAS suitability, NAS limitations, compatibility list, **Mounting Network Resources**, FreeNAS, TerraMaster, QNAP.
Rule: none (index).
Classification: **ADOPTED in part** — the prompt already says build against a filesystem path, document rclone/mergerfs, and do not assume change notifications fire on network mounts.
Need: n/a (covered).

## 004 — /articles/categories/plex-media-server/nvidia-shield/
Category index. Topic area: running the server on constrained ARM hardware, **media storage options**, **moving the server data directory**.
Rule: none (index).
Classification: **ABSENT** — nothing on where CanonCore's own data directory lives or how it is relocated/backed up.
Need: MEDIUM — a self-hosted app must document its data directory (Postgres + artwork cache) and how to move/back it up; this is the single most common self-hoster question.

## 005 — /articles/categories/plex-media-server/scanners-agents/
Category index. Topic area: **Scanners** (find files) and **Agents** (fetch metadata) as two separate, separately-configurable stages; NFO files; **match hinting**; per-agent advanced settings.
Rule: none (index), but the scanner/agent split is the structural point.
Classification: **ADOPTED** — CanonCore has the same split (scanner writes nothing; providers propose values). NFO is explicitly **REFUSED** ("no `.nfo` reading").
Need: n/a.

## 006 — /articles/categories/plex-media-server/server-settings/
Category index. Settings groups: General, Remote Streaming, **Optimized Versions**, Agents, Library, Network, Transcoder, **Languages**, **DLNA**, **Scheduled Tasks**, **Extras**, Troubleshooting, Live TV & DVR.
Rule: none (index).
Classification: Transcoder / Optimized Versions / Live TV = **REFUSED** (no transcoding). DLNA = ABSENT-LOW. **Scheduled Tasks** = **ABSENT** (prompt says "support explicit periodic scans" but never a scheduler with a maintenance window). **Languages** = **ABSENT**. **Extras** = ABSENT.
Need: MEDIUM — a scheduled-task window (when scans and provider refreshes run, and a "don't run while playing" rule) is the piece that makes periodic scanning liveable; the prompt mandates periodic scans without saying when they run.

## 007 — /articles/categories/your-media/
Category index, the biggest one. Notable topics the prompt never mentions: **Multi-Version Movies**, **Local Media Assets**, **Special Keyword File/Folder Exclusion**, **ISO/IMG/VIDEO_TS**, **embedded metadata identification**, **lyrics**, **Personal Media** (home video) as a distinct library type, the whole **subtitles** cluster, **Edit Details**, **Mark as Watched/Unwatched**, **Fix Match / Unmatch**, **Merge or Split Items**, **duplicate/merged content finder**, **Download Media**, **Rename a badly named file**, **TV Theme Music**, **Generating Sample Files**.
Rule: none (index).
Classification: Merge = **ADOPTED** (merge→permanent alias). Duplicates = **DIVERGENT** (prompt bans the word "duplicate", calls it a REDUNDANT FILE, never auto-deletes). Split = **ABSENT**. Unmatch/Fix Match = partially ADOPTED via match/apply split but the *unbind* operation is ABSENT. Everything else listed = **ABSENT**.
Need: HIGH for **Split** and **Unmatch** (see 040-ish entries below); MEDIUM for **file/folder exclusion patterns** — every scanner needs an ignore mechanism or `.AppleDouble`, sample files and extras pollute the catalogue on day one.

## 008 — /articles/categories/your-media/naming-and-organizing-music-media/
Category index: music from folders, local artist/music videos, **local lyrics and artwork**, **identifying music using embedded metadata**, keyword exclusion.
Rule: none (index).
Classification: local artwork = **REFUSED** (no artwork scanning). **Embedded metadata as an identification source** = **ABSENT**. Lyrics = ABSENT.
Need: MEDIUM — embedded tags (ID3, Matroska, EXIF) are a metadata *source* with its own provenance; the prompt's providers are all HTTP URLs, so a file's own tags have no place to enter the statements table at all. That is a structural hole for music, which the demo explicitly includes (Taylor Swift).

## 009 — /articles/categories/your-media/naming-and-organizing-personal-media/
Category index: **Personal Media Movies**, **Naming Home Series Media**, keyword exclusion. Plex's "personal media" = content no agent can ever match.
Rule: none (index).
Classification: **ABSENT** — the prompt has no notion of an item that is deliberately never sent to providers.
Need: MEDIUM — "this item is mine, never enrich it, never send its title anywhere" is a privacy-relevant per-item flag; without it, enrichment reaching all connected providers at once leaks home-video titles to TMDB.

## 010 — /articles/categories/your-media/naming-and-organizing-tv-shows/
Category index: TV naming, local media assets, keyword exclusion, **Multiple Editions – TV Shows**, **Match Hinting**, local trailers/extras.
Rule: none (index).
Classification: multiple editions = ADOPTED (editions table). **Match hinting** = **ABSENT**.
Need: MEDIUM — a per-item hint ("this is actually TMDB id 1396") is the manual override that makes matching recoverable; the prompt has thresholds and a review queue but no way to *tell* it the answer.

## 011 — /articles/categories/your-media/naming-your-movie-media-files/
Category index: movie naming, **Multiple Editions**, **Multi-Version Movies**, local trailers/extras, local media assets, keyword exclusion, **ISO/IMG/VIDEO_TS**.
Rule: none (index). Note Plex has TWO separate concepts — *Editions* (named cuts) and *Versions* (same cut, different files/qualities).
Classification: Editions = ADOPTED. **Versions (multiple files of the same edition, e.g. 4K + 1080p)** = **ABSENT** — CanonCore's `files` table attaches many files to an edition but nothing says how you pick between two full renditions of the same edition, or that a 4K and a 1080p rip are the same edition.
Need: HIGH — see the consolidated gaps section: this is the direct-play consequence the prompt half-specifies.

## 012 — /articles/categories/your-media/using-subtitles/
Category index: fetching internet subtitles, configuring subtitle support, local subtitles, **on-demand subtitle search**, **auto-sync subtitles**, import/delete, **subtitle offsets**.
Rule: none (index).
Classification: sidecar subtitle *files with a language* = ADOPTED (files.role = subtitle, sidecar + language). Everything else (preference/selection rules, search, sync, offsets) = **ABSENT**.
Need: MEDIUM — subtitle *selection policy* (which track opens by default, per language) is the same "which one opens" problem the prompt solved carefully for editions and never solved for tracks.

## 013 — /articles/categories/your-media/working-with-your-media/
Category index. Operations Plex exposes on an item: **Edit Details**, Mark Watched/Unwatched, Fix Match, Collections, **Investigate Media Information**, **Merge or Split**, **find duplicate/merged content**, **Unmatch**, **Download**, **Rename a badly named file**, disk-image conversion, **TV theme music**, **generate sample files**, publish collections.
Rule: none (index).
Classification: Merge = ADOPTED. Mark watched/unwatched = **ABSENT** (prompt has watch events from playback but no manual mark). **Split** = ABSENT. **Unmatch** = ABSENT. **Media info inspection** = ABSENT.
Need: HIGH for manual **Mark as watched/unwatched** — a catalogue of works you do not own files for cannot record that you read the novel elsewhere, and that is CanonCore's central use case. Detailed below.

## 014 — /articles/chromecast-airplay-and-casting/
Casting: Chromecast and AirPlay from mobile; the phone becomes a remote during remote playback.
Rule (verbatim): "It is not always possible to control the audio volume depending on things like audio format or if it is surround sound."
Classification: **ABSENT** — the prompt names web/phone/TV clients but says nothing about casting or remote control between them.
Need: LOW — direct-play-only plus a native TV app covers the reason people cast; casting is a client feature, not a catalogue one, and can wait past the cap.

## 015 — /articles/common-sense-media/
Third-party age/content ratings (Common Sense Media) surfaced on item detail pages: age rating 2-18, star rating, supporting information, parents'/kids' ratings. Applied to personal media too, via the Plex Movie/Series agents.
Rule (verbatim): "The rating cannot be hidden." Also: age rating is "from 2-18", and richer fields are gated behind a Plex Pass.
Classification: **ABSENT** as a feature, but mechanically it is just a provider supplying `content_rating` and `rating` statements — which CanonCore's model handles natively. The *un-hideable* part is DIVERGENT: CanonCore's favourite/rank gives the owner control Plex denies.
Need: LOW as a bundled provider; MEDIUM as a **content-rating property + vocabulary** in the seed field set, because rating systems are per-territory (BBFC, MPAA, FSK, TV-14) and that is a vocabulary problem the prompt never sizes.

## 016 — /articles/community-supported-tuners/
TV tuner hardware compatibility for DVR: officially supported vs a community-maintained list; must conform to Windows BDA or the Linux DVB API.
Rule (verbatim): "tuners added to the Community Supported Tuners list will have been tested and considered trusted by the community, but will not be officially supported by Plex".
Classification: **REFUSED / out of scope** — no live TV, no DVR anywhere in the prompt; the whole broadcast axis is absent by design.
Need: n/a. The transferable idea is the tiering itself (officially supported vs community-trusted), which CanonCore already has as the four provider tiers.

## 017 — /articles/configuration-and-usage-options/
Desktop app (Windows/macOS) settings: keep-on-top, **Normalize Multi-channel Audio**, **Exclusive Audio**, audio device / device kind / channel count, **subtitle size (Tiny/Small/Normal/Large/Huge)**, hardware decoding toggle, default download quality, keyboard shortcuts and media-key support.
Rule: default download quality "By default each will be set to 'Original'".
Classification: audio/decoding config = REFUSED-adjacent (direct play only, no transcoding). **Player preferences as a persisted per-user thing** = **ABSENT**. Keyboard shortcuts = partially covered by the standing rule "Every accelerator has an equivalent visible UI path".
Need: MEDIUM — subtitle appearance and audio-device selection are the minimum player preferences a real player needs, and the prompt's schema has no table for any per-owner UI/player preference at all.

## 018 — /articles/control-sonos-playback-with-a-plex-app/
Linking a third-party account (Sonos) to the Plex account so one app can control playback on another device. Premium.
Rule (verbatim): "Only full Plex accounts can have external services like Sonos linked. That means that it is not possible to use this with a managed user".
Classification: **ABSENT**, and cleanly out of scope: CanonCore has no cloud account to link anything to.
Need: LOW.

## 019 — /articles/correcting-your-music-content-matches/
Fixing bad music matches. Documents: folder layout drives match quality; correct Artist/Album/Track/**Album Artist** tags matter; an **Unmatched filter** for finding items no agent could bind; **Fix Match** to rebind by hand; MusicBrainz as the identity authority, with its **release group vs release** distinction called out.
Rule (verbatim): "If you've enabled the Prefer local metadata advanced preference for your music library, then you must ensure that all of your music content has full, accurate metadata tags." And: "Most users should not enable the Prefer local metadata preference and we do not recommend doing so by default."
Classification: MusicBrainz as an identity source = ADOPTED (prompt names MusicBrainz MBID as a scheme, and MusicBrainz/CAA for the demo). **Release group vs release** = the abstract-work/edition split, ADOPTED. **An "unmatched" filter as a first-class library view** = **ABSENT**. **Fix Match (manual rebind)** = **ABSENT**. "Prefer local metadata" = DIVERGENT (CanonCore's source order with the Owner first is the same lever, done better).
Need: HIGH for a **coverage/unmatched view**. The prompt counts dropped fields and has a review queue for the uncertain band, but nothing shows the owner "these 400 items no provider ever matched" — which is the state most of a real catalogue is in.

## 020 — /articles/credits-detection/
Automatic detection of end credits so a player can offer Skip Credits, plus intro markers by implication. Analysis runs "when media is added, as a scheduled task during regular server maintenance, or both".
Rule (verbatim): the setting's options are "never", "as a scheduled task", "as a scheduled task and when media is added: … This is the default behavior." Detection can be disabled per-server, **per-library**, and **per-item**, and "Disabling for the library will also prevent the skip credits button from appearing … even if the markers have already been detected".
Classification: **ABSENT** — no concept of a time-coded **marker** on an edition (intro, credits, chapter, recap) anywhere in the prompt.
Need: MEDIUM — markers are a real gap in the playback half, but CanonCore has adjacent machinery: `edition_coverage` is already a set of intervals on an edition, and chapters are already a file role. A marker is an interval with a kind, so the shape exists. What is genuinely absent is the three-level (server/library/item) opt-out pattern, which is worth noting as a general design idea: **any expensive automatic analysis needs an override at every level of the hierarchy**.

## 021 — /articles/customizing-plex-web/
Home-screen customisation: pinning sources to a sidebar, reordering them, and the sidebar order driving the order of rows on Home. "More" holds everything unpinned.
Rule (verbatim): "Customizations are associated with the particular browser instance." And: "By default, items in your sidebar will be arranged with sources from your preferred server listed first".
Classification: **ABSENT** — the prompt explicitly defers this ("No shelf type, no command palette yet… Those are decided when screens exist") so it is a *deliberate* deferral rather than an oversight, but nothing says where per-owner UI preference is stored.
Need: MEDIUM — the ordering of home rows is exactly the "declared order decides until the owner pins one" pattern the prompt already uses three times; worth reusing rather than inventing a fourth mechanism.

## 022 — /articles/customizing-the-apps/
Same content as 021 for TV/big-screen apps.
Rule (verbatim): "Customizations are associated with the particular app install. If you delete and reinstall Plex, the customizations would be lost."
Classification: **ABSENT**, and the rule is a warning: Plex stores client customisation client-side and loses it on reinstall. CanonCore has one owner and a server, so server-side preference storage is nearly free and avoids the defect.
Need: MEDIUM — see the gaps section: a per-owner preferences store.

## 023 — /articles/discover-credits/
A **person page**: image, biography, social links, "known for", full filmography, which libraries hold their content, and a link straight into a library filtered on that person.
Rule (verbatim): "Discover credits cannot be outright disabled". It falls back to a filtered grid when "The library uses a legacy metadata agent" or items have not been refreshed.
Classification: **ADOPTED in principle and better** — CanonCore's items table holds `person` as a first-class kind with `portrayed_by` statements and surrogate ids, which is precisely the model Plex lacks (see the prompt's Jellyfin name-keying critique). The **person detail page with a filmography reverse-index** is **ABSENT** as a screen but falls out of the statements table for free.
Need: LOW as a gap; the model covers it. Worth noting one concrete requirement: the filmography is a **reverse statement lookup** (all statements whose `value_item` is this person), so the read projection must index statements by object, not only by subject.

## 024 — /articles/discover/
Cross-source availability: a "universal details screen" showing every place an item can be watched (your server, Plex's free service, Netflix, rental) with the user declaring which streaming services they subscribe to.
Rule (verbatim): "personal servers are not sending lists of library content to Plex. We don't know what's on your server. Instead, when you visit a Universal Details page, the Plex app asks the Plex Media Servers you have access to".
Classification: **REFUSED** — "No fork, no export, no import, no cross-instance sharing". Availability lookup against commercial streaming services is not in scope.
Need: LOW. The *privacy architecture* is the transferable part: query fan-out from the client rather than an inventory upload. CanonCore's Safe External Fetch boundary is the analogous rule and already exists.

## 025 — /articles/discussions/
Public threaded discussions attached to a movie, show, season or episode page, with spoiler flagging, reporting, moderation queue, and a per-user toggle to hide the row.
Rule (verbatim): "Discussions are not stored locally on a Plex Media Server" and "they're 100% public" and "Writing or participating in discussions requires a verified email."
Classification: **REFUSED by construction** — single-user, no signup, no multi-tenancy, and the demo is read-only. There is nobody to discuss with.
Need: LOW. One useful contrast: Plex keeps social content off the server entirely, which is the right instinct if CanonCore ever grows multi-user.

## 026 — /articles/download-ios-android/
Offline downloads to mobile: a download queue with in-progress/queued/errors, pause and cancel, per-item delete, remaining-space estimate, Wifi-only and quality settings.
Rule (verbatim): "Two items can be downloading at a time." And: "Only video content from a personal Plex Media Server can be downloaded."
Classification: **ABSENT** — offline is not mentioned anywhere in the prompt, and the phone app is deferred past the cap.
Need: MEDIUM — offline is the single most-requested feature of any self-hosted media phone app, and it interacts with the prompt's model in one non-obvious way: a downloaded file is a *second location* for the same file identity, and the prompt's rule "PATH IS LOCATION, NOT IDENTITY" already makes that expressible. Worth noting before the phone app starts.

## 027 — /articles/downloads-on-desktop/
Same feature on desktop, plus a **Downloads library** as its own browsable source, sorting by Title/Date Downloaded/Size on Disk, and **subscription rules** for shows ("limit the number of unplayed episodes downloaded and if they should be removed after being played").
Rule (verbatim): "If you've downloaded an item, but you instead choose to play from your regular server library, playback will be streamed from the server. To play the downloaded content, be sure to access from the Downloads library." That is a documented usability defect, not a design.
Classification: **ABSENT**. The **"keep N unplayed, delete after playing"** subscription rule is a genuinely separate idea: a *rule-derived, self-pruning* set.
Need: LOW for the first version. Note the contrast: Plex's downloads live in a parallel library the user must remember to enter; CanonCore's placement model would make "downloaded" a property of an edition's file, not a separate container, which avoids the defect.

## 028 — /articles/downloads-overview/
Downloads overview. Key architectural point: **direct play means direct download**.
Rule (verbatim): "if your device can Direct Play the file, it can 'Download' it without needing to be transcoded."
Classification: **ADOPTED implicitly** — CanonCore is direct-play only, so every file is downloadable by definition and the entire transcode-for-offline apparatus disappears. This is a positive consequence of the transcoding refusal worth recording.
Need: n/a.

## 029 — /articles/downloads-sync-faq/
Entitlement matrix for who may download, keyed on account creation date relative to 2022-08-01 UTC.
Rule (verbatim): "Where the cutoff date in question is midnight (morning) 2022-08-01 00:00 UTC." And: "If you change the setting, it will only affect content you Download in the future; existing (already downloaded) content will not be changed."
Classification: **REFUSED** — no subscriptions, no entitlements, no accounts. This article is an argument *for* the prompt's position: a grandfathering matrix is what a feature flag becomes after four years, and the prompt bans speculative configuration for exactly this reason.
Need: LOW.

## 030 — /articles/edit-profile/
User profile: avatar, username (unique), **full name / "friendly name"** (non-unique, displayed instead of the username), and friend management.
Rule (verbatim): "Username: The identifier for your Plex account, that can not be the same as any other Plex account." and the friendly name "cannot be used to sign into Plex."
Classification: **REFUSED** — one owner row, one password, no signup, no profiles.
Need: LOW. Structural note only: Plex separates a unique identifier from a display name, which is the same discipline as CanonCore's "ENTITY IDENTITY IS A SURROGATE ID … NEVER A NAME".

## 031 — /articles/extended-remote-watch-pass-trial/
Grandfathering offer for users who bought a one-time mobile activation before the 2025-04-29 change that made remote video playback require a subscription.
Rule (verbatim): "a 3-month trial instead of the normal 14-day trial" and "The trial can only be redeemed a single time".
Classification: **REFUSED** — no billing, no entitlements, no remote-access gating. Included here only as evidence: this is what happens when access to your own server becomes a licensed feature.
Need: LOW.

## 032 — /articles/faq-live-tv-on-plex/
Plex's free ad-supported live TV, distinct from the DVR feature. Geographic licensing.
Rule (verbatim): "due to licensing restrictions, we are not able to offer pausing, rewinding, or fast forwarding of Live TV channels." And a hard country blocklist (Bahrain, Cuba, Egypt, Iran, North Korea, Qatar, Russia, Saudi Arabia, South Africa, Sudan, Syria, Turkey, Turkmenistan, UAE).
Classification: **REFUSED / out of scope** — CanonCore is a catalogue plus direct play; no streaming service, no ads, no geo-licensing.
Need: LOW.

## 033 — /articles/faq-rentals-purchases-on-plex/
Transactional VOD: rental and purchase windows.
Rule (verbatim): "You have 30 days to start playback. Once you begin watching, you can play it as many times as you want within 48 hours." Purchases last "so long as Plex has licensing for the title from our studio partner." Rentals "typically priced from $3.99 USD and up". Rentals/purchases "cannot be downloaded".
Classification: **REFUSED / out of scope**. Notable as the clearest statement of a storefront's cost: a purchase that lasts only as long as a licensing agreement.
Need: LOW. One transferable observation: even a purchased item is only a *reference to an entitlement*, which is structurally the same as CanonCore's "a source is a reference" and "it never stores media".

## 034 — /articles/follow/
Social graph: one-way Follow versus mutual Friends, with a three-tier visibility model on profile content (public / friends-only / private) and separate settings for account visibility, friend requests, and follow lists.
Rule (verbatim): "Following is a one-way relationship… without waiting for them to approve." And: "even if someone has this enabled for Anyone they may have individual items on their profile like Reviews only shared with only friends or private".
Classification: **REFUSED** — "No visibility system. Not a column, not propagation, not a resolution rule." Explicitly deferred to multi-user.
Need: LOW now. Worth recording that Plex's own visibility model is *per-activity-type* (reviews separately from watch history separately from profile), not per-item inheritance — which is evidence for the prompt's claim that "inherit from which parent?" has no answer and that a different mechanism is needed when multi-user arrives.

## 035 — /articles/free-live-tv-streaming-overview/
Free live TV: favouriting channels across sources, reordering favourites, and a three-state per-source enable control.
Rule (verbatim): the enable states are "Enabled", "Disabled", and "Disabled for Managed Users – The administrator can access the content, but no managed users or accounts with preset profiles can access it".
Classification: live TV = REFUSED. The **per-source enable/disable control** maps onto CanonCore's providers and is **ADOPTED** ("BUNDLED DEFAULTS — known provider definitions ship with CanonCore, ALL DISABLED BY DEFAULT").
Need: n/a.

## 036 — /articles/frequently-asked-questions-vod/
Free ad-supported VOD catalogue: rotating availability, geographic restrictions.
Rule (verbatim): "Are you putting ads into my personal content? Absolutely not!" And: "some other items may only be available for a limited time from a distributor."
Classification: **REFUSED / out of scope**. The one idea with a CanonCore analogue is **availability with an expiry**: a catalogue entry whose playable source can vanish. CanonCore's items already exist without files, so a lost source degrades to a catalogue entry rather than disappearing — which is a strength worth naming.
Need: LOW.

## 037 — /articles/frequently-asked-questions-watch-together/
Synchronised group playback. Being retired.
Rule (verbatim): "once you have create a Watch Together session, no new users can be invited to the group." And: "If you pause playback (or seek within the content), then the same action will happen for all the other members of the session." Audio/subtitle changes "will apply only for you, and not all members".
Classification: **REFUSED** — single user, no sessions. Note the deprecation notice itself: "we are ending support for some features we've grown to love, like Watch Together."
Need: LOW.

## 038 — /articles/friends/
Friendship and library sharing as **two separate things**.
Rule (verbatim): "This is separate from the Plex Media Server library access you may have granted or been granted… you can still be friends with someone without that." And on removing a friend: "Any existing library access will remain." Invite links "once created is only valid for 72 hours."
Classification: **REFUSED** — no sharing, no multi-user.
Need: LOW. The separation of *social relation* from *access grant* is the correct decomposition if CanonCore ever adds sharing, and the 72-hour invite-link expiry is a concrete default worth remembering.

## 039 — /articles/hdr-to-sdr-tone-mapping/
HDR→SDR tone mapping during transcode, with selectable algorithms (linear, gamma, clip, and others) and a large hardware/driver compatibility matrix.
Rule (verbatim): "Transcodes that involve burnt-in subtitles may require more CPU resources, which could reduce performance." Platform notes include hard requirements like "Requires an Intel 'Kaby Lake' or newer processor" and "Requires NVIDIA GPU driver 470.141.03 or higher".
Classification: **REFUSED** — "No transcoding, no ffmpeg, no quality ladders."
Need: LOW, and this article is the best single justification for that refusal: a compatibility matrix of six platforms × three acceleration paths × six footnoted driver constraints is the maintenance cost of one transcode feature.

## 040 — /articles/htpc-getting-started/
A separate desktop client build for TV-connected PCs, with its own install/update/uninstall lifecycle per platform and browser-based sign-in.
Rule (verbatim): "The app must be in /Applications or ~/Applications for auto-update to work properly" and "the app will automatically update after a restart if it detected an update on its previous launch."
Classification: **ABSENT** — the prompt names web, then phone, then TV, and says nothing about app auto-update or sign-in flow.
Need: MEDIUM — the **browser-hands-off sign-in** pattern (client opens a browser, user authenticates there, client picks up the session) is the standard answer to "how does a TV app log in without a keyboard", and CanonCore's single-password cookie session has no story for the TV app at all. Worth deciding before the TV app starts, not during.

## 041 — /articles/htpc-settings/
The densest settings article in the set. Concrete features named: **UI language separate from library language**, **watched indication (badges) on posters, toggleable**, **Remember Selected Tab**, **Theme Music on detail screens**, **Screen Saver** (with an Entertainment mode drawing backgrounds from pinned libraries), **Reduce Motion**, **Show End Time for Video Playback**, **AutoPlay "Up Next"** with a countdown, **Cinema Trailers before a movie**.
Rule (verbatim): "Language: The language used for interface elements (library content will display in the language set by the server admin for that library)." Autoplay countdown presets are "Immediate, 5 seconds, 10 seconds (default for mobile players), 15 seconds (default for TV players), 30 seconds, 60 seconds". Screensaver falls back: "if a personal media source is not pinned, the Plex Logo screensaver will be used."
Classification: mostly **ABSENT**. Three stand out:
  - **UI language vs content language as two separate settings** — ABSENT, and structurally important (see gaps).
  - **Watched badges** — ABSENT; the prompt computes progress but never says it is *displayed on a poster in a grid*, which is a read-projection requirement (every card in a grid needs its watched state cheaply).
  - **Up Next / autoplay** — the prompt says "Continue Watching … is offered, never auto-played", so autoplay is **REFUSED**, but *Up Next* (what plays after this) is ABSENT and is a different question: in a multi-placement model, "next" depends on which container you arrived through — and the prompt already says the container is navigation state carried alongside the address. That makes Up Next answerable, but only if the player is given the placement context.
Need: HIGH for **Up Next in a multi-ordering catalogue** — see gaps. MEDIUM for language. MEDIUM for watched badges in the projection.

## 042 — /articles/import-or-delete-a-subtitle-file/
Uploading a sidecar subtitle from a phone to the server, and deleting external subtitles.
Rule (verbatim): "Subtitles embedded in a file cannot be deleted." And: "Subtitles files are deleted from computer immediately. Only the server administrator can delete and only if the Allow media deletion setting is enabled in the server library settings." Android gives "a few seconds to UNDO the action"; iOS requires a confirm button.
Classification: **DIVERGENT / partly REFUSED** — the prompt bans uploads for artwork and says "The scanner NEVER writes storage", so subtitle upload is against the grain. But the **"Allow media deletion" server-level switch** is genuinely **ABSENT**: CanonCore's DELETE section covers deleting *catalogue rows* and never says whether deleting an item may delete the file on disk, or whether that is switchable.
Need: HIGH — "does Delete permanently delete the bytes?" is unanswered in a section that claims to be "the one place data is actually lost". Detailed in gaps.
Second note: the prompt's own rule "The confirmation is never dismissible by accident: never a drawer, never a swipe-away sheet" is directly contradicted by Plex's swipe-to-delete-with-undo. Plex's undo window is the better pattern for a low-stakes delete; the prompt's rule is right for the high-stakes one. Worth keeping both, keyed to stakes.

## 043 — /articles/installing-plex-media-server-on-freenas/
Third-party FreeNAS packaging of the FreeBSD build, installed as a jail plugin.
Rule (verbatim): "This is not an official release of Plex Media Server formally supported by Plex. This is a modified package provided by a third-party".
Classification: **ABSENT** — packaging and distribution are not mentioned in the prompt at all.
Need: MEDIUM — a self-hosted product's distribution story (a Docker image and a compose file, at minimum) is the difference between software someone else runs and software only you run, and the prompt's whole framing is "SELF-HOSTED software, plus ONE public read-only demo instance". The scaffold decision (create-better-t-stack, dbSetup docker) covers dev, not distribution.

## 044 — /articles/ios-system-permissions/
Mobile OS permission prompts the app needs: **Local Network** (iOS 14+, required to reach a server on the LAN), Push Notifications, Photos.
Rule (verbatim): "If you've successfully enabled Remote Access for a server, the app may still be able to connect to the server, even if you don't allow the 'Local Network' permission. However, the connections would be 'over the internet'".
Classification: **ABSENT** — relevant only when the phone app arrives.
Need: MEDIUM at that point, LOW now. The Local Network permission is a real trap: a self-hosted phone client that only ever talks to a LAN address is dead without it, and the failure mode is silent.

## 045 — /articles/is-plex-legal/
Legal posture: Plex licenses content it distributes; users must hold rights to their own media.
Rule (verbatim): "These libraries are curated by individual Plex users who must also hold the license to own and/or view the media they provide themselves."
Classification: **ADOPTED in spirit** — CanonCore never stores media and is software someone else runs; the demo is the only publishing surface and the prompt already handles its licensing (TMDB attribution and the six-month cache rule, MusicBrainz/CAA, CC BY-SA on archive-derived text, archive images excluded).
Need: LOW as a gap, but note one thing the prompt does **not** state: a user-facing statement of the same posture. If CanonCore ever ships to strangers, the "you must hold the rights to what you catalogue" line belongs somewhere visible.

## 046 — /articles/lists/
User-created lists spanning server content *and* Discover content, with per-list privacy, and — the key detail — a **ranked vs unranked** choice made at creation.
Rule (verbatim): "Decide if it will be an unranked or ranked (numbered) list." And: "Who can see your lists depends on your privacy settings for each individual list. There is no global privacy setting for all lists." Also: "You can also Duplicate a list and make changes to that one instead."
Classification: **ADOPTED and generalised** — this is CanonCore's container with `is_ordered`, stored not inferred, and the prompt's rule that a container is either hand-placed or rule-derived. Plex needing a *separate* Lists feature alongside Collections and Playlists is evidence for CanonCore's decision to have one construct. **Duplicate a list** is **ABSENT** and is genuinely useful: fork a chronology and re-sequence it without touching the original, which the prompt's "EVERY CONTAINER OWNS ITS MEMBERSHIP OUTRIGHT" makes trivially correct (a copy of the placements, no shared state).
Need: MEDIUM for **duplicate/clone a container** — it is the natural way to make an alternative ordering, it is three lines given the schema, and without it the only way to build a variant ordering is to re-add everything by hand.

## 047 — /articles/local-files-for-trailers-and-extras/
Local extras for movies: inline (`Descriptive_Name-Extra_Type.ext`) or in a subdirectory.
Rule (verbatim): the extra types are exactly `-behindthescenes, -deleted, -featurette, -interview, -scene, -short, -trailer, -other`, and "The filename must end in the -Extra_Type value exactly. The hyphen is important and you cannot have spaces between the hyphen and word." Plus: "If you're making use of multiple editions for movies, you need to make sure that each edition is stored in its own named movie directory."
Classification: **ABSENT** — extras are not in the prompt. The prompt's scanner takes "media files and playback sidecars, and nothing else", and a trailer is a media file, so an extra would import as… an item, an edition, or a file with an unnamed role.
Need: HIGH — see gaps. Extras are the case that breaks the item/edition/file trichotomy, and Plex's own answer (a closed vocabulary of eight kinds) is a good one.
Second point, structural: Plex ties an edition to a **directory**, which is exactly the "ordering lives in filenames" defect the prompt exists to escape. CanonCore should note the contrast explicitly: an edition is a row, so extras attach to the row, and the filesystem layout is free.

## 048 — /articles/local-files-for-tv-show-trailers-and-extras/
Same for TV, at three levels — **show, season and episode** — with a per-client support matrix showing which clients handle which level.
Rule (verbatim): directory types are "Behind The Scenes, Deleted Scenes, Featurettes, Interviews, Scenes, Shorts, Trailers, Other"; episode extras use the same `-Extra_Type` suffix, and multiples are indexed: "-deleted1.mkv, -deleted2.mkv". "Currently, the only clients that fully support extras at all levels are the mobile iOS and Android apps."
Classification: **ABSENT**, same as 047. The three-level attachment (show/season/episode) is trivial in CanonCore because containers are items, so an extra attaches to whichever item you like.
Need: HIGH (folded into 047 in gaps).

## 049 — /articles/manage-favorite-libraries/
Favouriting libraries, syncing that choice across a user's devices, and using the favourite order to drive home-screen row order.
Rule (verbatim): "Favoriting libraries in the modern apps syncs between apps for your account." And: "If no favorites are selected then all libraries you have access to will display here but their content will not appear in recommendation rows on the home screen." That last is a real trap — the empty-favourites default silently empties the home screen.
Classification: **ABSENT**. CanonCore's groups are the analogue and nothing says how they are ordered or whether some are surfaced by default.
Need: MEDIUM — and note the defect to avoid: **an empty preference set must mean "all", not "none"**. That is a general rule the prompt could use, since it has several "declared order decides until the owner pins one" mechanisms whose empty state is unstated.

## 050 — /articles/manage-recommendations/
Server-admin control over which recommendation rows appear, in three separate contexts (Library Recommended tab / owner's Home / shared users' Home), reorderable by drag.
Rule (verbatim): "The only exception to this is the Continue Watching rows which will always be shown on home screen". "If a row contains no items… that row will not appear until it has content." "The default is: All rows enabled under Library Recommended. For Home and Shared Users' Home, only the Recently Added…" And the **Seasonal Movies** row: "occasional rows that Plex creates for content related to particular events, people, or other things."
Classification: **ABSENT / deliberately deferred** — the prompt says "No shelf type… decided when screens exist".
Need: MEDIUM. Two concrete rules worth stealing when the screens are designed: **empty rows hide themselves**, and **a row's definition is a saved query** — which in CanonCore is exactly a rule-derived container, already in the schema. A shelf need not be a new concept at all; it is a rule-derived container marked for display. That is worth recording now because it is the kind of thing that otherwise arrives as a new table.

## 051 — /articles/migrating-a-tv-library-to-use-the-new-plex-tv-series-agent-scanner/
Migrating a library from an old metadata agent to a new one, and what that does to existing metadata.
Rule (verbatim): "Migrating an existing library can result in visible changes to much of the metadata on existing items once their metadata is refreshed (though **locked fields will not be changed**)." And the manual-match escape hatch: "you can use external IDs from The Movie Database, TheTVDB, or IMDb to get a match directly, by entering a prefix and the ID into the title field, e.g. tmdb-1855 / tvdb-74550 / imdb-tt0112178".
Classification: The lock behaviour is **ADOPTED as the favourite** ("THE FAVOURITE IS THE LOCK"). **Direct binding by external id typed into the search box** is **ABSENT** and is the cheapest possible implementation of match hinting — it needs no new UI, only a parse rule in the search field, and CanonCore already has external-id datatypes and identifier statements to bind to.
Need: HIGH for **bind-by-external-id**. Detailed in gaps.
Also worth naming: Plex's agent migration is a **re-derivation of every value from a different source ranking**, which is precisely what the prompt's "re-ordering the source list re-picks the whole catalogue at once" already does — and does better, because CanonCore keeps the losing values rather than overwriting.

## 052 — /articles/mobile-system-permissions/
Push notifications and iOS Local Network permission (duplicate of 044 for current app versions).
Rule (verbatim): "If you choose to not allow the access, then the Plex app will not be able to connect to any Plex Media Server over the local network."
Classification: **ABSENT**, deferred with the phone app.
Need: MEDIUM at phone-app time (see 044).

## 053 — /articles/moving-server-data-storage-location-on-nvidia-shield/
Relocating the server's data directory (databases, metadata) to user-accessible or removable storage.
Rule (verbatim): "if you choose a 'removable' storage location, the drive must remain connected when Plex Media Server is running." And the default is "an internal storage location that is not user-accessible."
Classification: **ABSENT** — CanonCore never says where its own state lives beyond "Postgres".
Need: MEDIUM — the app has at least three state stores (Postgres, the artwork cache with extracted palettes, and provider response caches subject to TMDB's six-month rule). Where they live, how they are backed up, and what a restore looks like is unspecified, and the prompt's migration-ladder rule implies someone will eventually restore an old backup into a newer binary.

## 054 — /articles/multiple-editions-tv-shows/ and
## 055 — /articles/multiple-editions/
The two most directly relevant articles in the whole set. Plex has **two distinct concepts**: **Versions** (same content, different resolution/encoding, merged and auto-selected) and **Editions** (different cuts, dubs, aspect ratios, episode orders — kept as separate library items).
Rule (verbatim): "It's the same actual content, just a different resolution/encoding/etc." for versions, versus: "In cases where you have multiple editions of the same movie, they can all be added to your library, where their **watched status, user ratings, etc. are all tracked separately**." Editions are declared in the filename or folder name: `Blade Runner (1982) {edition-Director's Cut}.mp4`, `/Babylon 5 (1994) {edition-Bluray Remaster}`. And the defect, stated plainly: "If you rename the file for an existing library item, it will be treated as a new library item after the next scan. Any watched status or customization of the metadata you had previously done for this movie will not carry over to this new 'Edition'." TV editions are whole-show only: "this feature is for editions of a show as a whole. It is not for editions of individual seasons or episodes." Editions require a Plex Pass.
Classification: **ADOPTED and improved, decisively.**
  - "Watched status tracked separately per edition" is *exactly* the prompt's "PER EDITION, not per item, because finishing a novelisation must not mark the film watched" — independent confirmation from the market leader.
  - "You may just want more than one episode order for a show to be available as separate listings" — Plex's own documentation admits that **multiple episode orders can only be modelled by duplicating the whole show as separate editions**. That is the exact failure CanonCore exists to fix, and it is a better citation than the "one global setting per library" line already in the prompt, because here Plex is *recommending* the duplication as the workaround.
  - The renaming defect is the prompt's "PATH IS LOCATION, NOT IDENTITY" rule vindicated: Plex loses watched state on rename because identity is the path.
  - **DIVERGENT, and correctly**: the prompt's editions are rows on an item with `is_default`; Plex's editions are separate top-level library items that "will be displayed in the library grid", forcing users to pick different posters to tell them apart. The prompt's model avoids that entirely.
  - **ABSENT: Versions.** Plex's *Versions* concept has no CanonCore equivalent. A 1080p and a 4K rip of the same cut are one edition with two media files, and the prompt's `files` table permits that, but nothing states the rule or says how the player picks. Need: HIGH, in gaps.

## 056 — /articles/mute-block/
Mute (hide someone's activity) vs Block (unfriend, revoke library access, mutual invisibility).
Rule (verbatim): "If you or the blocked account previously had access to a Plex Media Server library from the other person, access to that library will be removed as part of the block." And: "Muting cannot be done to individual activity types."
Classification: **REFUSED** — single-user, no social graph.
Need: LOW.

## 057 — /articles/naming-and-organizing-your-movie-media-files/
Movie file naming: one folder per movie recommended, `MovieName (release year)`, and **external ids embedded in the folder or filename** as a matching hint.
Rule (verbatim): "you can also include the IMDb or TheMovieDB ID number in curly braces to help match the movie. It must follow the form `{[source]-[id]}`." Example: `Batman Begins (2005) {imdb-tt0372784}`. And: "Mixing movie and television content under the same path will likely result in incorrect matching, poorly classified content, and can also result in some files being completely ignored."
Classification: **DIVERGENT, and this is the central divergence of the whole product.** Plex derives identity, type, ordering and edition from the path. CanonCore's items exist without files and its ordering lives on placements, so the path carries none of that. The *external-id-in-the-name* hint is the one part worth keeping: it is a scanner-readable binding signal, and CanonCore's scanner currently reads nothing but the bytes.
Need: MEDIUM for **any filename-derived matching signal at all** — the prompt's file identity is a content hash, which is perfect for relinking moves and useless for first-time matching. Something must turn `Batman Begins (2005).mkv` into a candidate query, and the prompt never says what.

## 058 — /articles/naming-and-organizing-your-tv-show-files/
TV naming, plus the crucial **Episode Ordering** section.
Rule (verbatim): "Be sure to use the English word 'Season' when creating season directories, even if your content is in another language." And on optional info: "Such optional info is ignored by Plex when matching content with legacy agents, but it is used in the Plex TV Series agent to give a hint for matching. If you want info to be ignored put the optional info in brackets." Ids again in curly braces; "As an alternative, you can also use a .plexmatch file". And: "Some shows can have episodes in different orders, depending on where they were originally aired, how they were packaged (a DVD/Blu-ray vs the original broadcast airing)".
Classification: **DIVERGENT / the product's founding case.** Plex acknowledges multiple episode orderings exist and can only offer one per library. That is the prompt's reason 2 for existing, confirmed in Plex's own naming documentation. Also note "TV shows can be season-based, **date-based**, a miniseries, or more" — a date-based ordering is a real ordering type the prompt never mentions but which its placements handle natively.
Need: n/a — the divergence is the product. One ABSENT detail: **a per-file "ignore this text" convention** (square brackets) is a small, real scanner requirement, since `[1080p Bluray]` in every filename otherwise pollutes every match query.

## 059 — /articles/navigating-the-big-screen-apps/
TV app IA: Home (Continue Watching, Recently Added, What's On Now), a navigation sidebar of sources, and per-source tabs: **Recommended, Library, Collections, Playlists, Categories**.
Rule (verbatim): "Television content will even be intelligently stacked for you so that if you add an entire season of content, you'll just get a single 'season' entry displayed rather than a dozen individual episode entries." And: "By default with new app installs, you'll land on Recommended when visiting a source."
Classification: **ABSENT / deliberately deferred** — "no fixed item-page tab structure. Those are decided when screens exist."
Need: MEDIUM for **Recently Added stacking**. It is a genuine algorithmic requirement, not a layout choice: a feed of newly added items must roll up siblings into their common parent or importing one season floods the surface. In a multi-placement model "their common parent" is ambiguous, which makes this *harder* for CanonCore than for Plex, and the prompt has not noticed. Detailed in gaps.

## 060 — /articles/navigating-the-mobile-apps/
Mobile IA: header (Search, Cast, Watchlist, user menu), recommendation rows in a fixed order (Continue Watching, Library Recommendations, Live TV, On Demand, Discover), bottom navigation.
Rule (verbatim): "When the next episode in a show you were watching is available, it will also be included here" — i.e. Continue Watching contains both *resume* and *next up*, two different things in one row.
Classification: **ABSENT / deferred**. But the Continue Watching detail matters: the prompt says "Continue Watching is computed, never stored. No time window, no dismissal", and never says whether it includes **next-episode-in-a-series** as well as **partially-watched**. Those are different queries and in a multi-ordering catalogue the "next" half needs a container to be next *in*.
Need: HIGH — folded into the Up Next gap.

## 061 — /articles/parental-controls/
Content restriction by rating, via preset profiles on managed users, plus per-online-source enable/disable.
Rule (verbatim): the profiles are "Younger Kid: allows TV-Y, G, TV-G, and other equivalent ratings", "Older Kid: … TV-PG, PG", "Teen: … TV-14, PG-13", "None: Can see all content ratings." And the sharp one: "**restricting will also remove the ability to view Plex Media Server libraries by Folder. This is because folder names cannot be hidden.**"
Classification: **REFUSED** — no visibility system, single user. But that last sentence is a genuine finding worth keeping: **a browse surface that exposes raw filesystem paths can never be access-controlled**, because the path itself leaks. CanonCore's opaque-id playback route and its refusal to fold the container into the URL are the same instinct; this is external evidence that the instinct is load-bearing rather than fastidious.
Need: LOW now, but the "folder browse defeats restriction" rule should be remembered if a folder-browse view is ever added.

## 062 — /articles/platforms-no-longer-supported-by-plex-media-server/
A long list of the last server version supporting each dropped platform (CentOS 6, 32-bit OS X, OS X 10.6/10.7/10.8, ARMv5 NAS, PowerPC, QTS 4.2).
Rule (verbatim): "**We do not provide access to old versions of Plex Media Server installers.**"
Classification: **ABSENT**, and it interacts with a rule the prompt does state. The prompt requires "MIGRATIONS ARE AN ORDERED, FORWARD-APPLICABLE LADDER FROM THE FIRST COMMIT… a released version can always migrate forward." Plex's policy shows the other half: dropping a platform strands users on a version, and refusing old installers means those users cannot even reinstall. A forward-only migration ladder plus no old binaries equals data an owner can no longer open.
Need: MEDIUM — a stated **minimum supported platform and version-support policy**, and specifically a rule that old releases stay downloadable, is the counterpart the migration ladder needs.

## 063 — /articles/plex-dash-network-connectivity-tips/
Why a client cannot reach a server on the LAN.
Rule (verbatim): "**Note that the apps will only have trouble connecting if all of the above holds true. Changing any one of these items should allow successful connections.**" The three causes: DNS rebinding protection on the router, NAT loopback / remote access, and "Require Secure Connections" set to Require rather than Preferred.
Classification: **ABSENT** — the prompt says nothing about how a client finds a server, HTTPS on a LAN, or certificates.
Need: HIGH — this is a real, under-appreciated gap. Detailed in gaps: **a self-hosted server on a LAN cannot easily have a valid TLS certificate**, and the prompt's security section mandates "HTTPS only" for outbound fetches while saying nothing about its own inbound listener. DNS rebinding protection breaking hostname-based local resolution is exactly the trap Plex documents here.

## 064 — /articles/plex-for-x1-overview/
A cut-down client on Xfinity X1 that cannot reach a personal server at all, plus the **device-link code** sign-in flow.
Rule (verbatim): "The Plex app for Xumo/Xfinity does not support the ability to access personal media from a Plex Media Server." Sign-in: "The screen will display a URL and a link code… go to https://www.plex.tv/link/ … Enter the link code shown on the app".
Classification: **ABSENT** — the link-code pattern is the answer to TV sign-in raised at 040.
Need: MEDIUM — concrete and reusable: the TV app shows a short code, the owner enters it in a browser already logged in, the server issues the TV a token. That is implementable against a single-password cookie session with one table, and it is the only humane way to authenticate a tvOS app.

## 065 — /articles/plex-htpc-input-maps/
User-authored remote-control mappings: a JSON file with a name, an `idmatcher` regex matching the device's reported name, and a button-to-function map.
Rule (verbatim): "do not edit and save the example file directly in this 'defaults' folder as they will get overwritten whenever the app launches. Instead, make a copy of the file and save it in the 'inputmaps' folder."
Classification: **ABSENT**, and mostly out of scope. One point does bear on a CanonCore rule: this is a **user-supplied regex** consumed by the app, and the prompt bans exactly that for providers ("use bounded primitive validators, never provider-supplied regex"). The ban is scoped to the provider boundary; a local config file is a different trust context. Worth being explicit that the rule is about untrusted input, not about regex.
Need: LOW.

## 066 — /articles/plex-htpc-logs/
Where client and server logs live, and how to attach them to a bug report.
Rule (verbatim): "Quit and then restart your Plex HTPC app (which helps get fresh logs)" and "Do not paste the logs directly in the forum post; instead, attach the file."
Classification: **ABSENT** — no logging or diagnostics story in the prompt.
Need: MEDIUM — with background enrichment, thresholds, a review queue, periodic scans and remote providers, "why did nothing happen?" is the default user state, and the prompt has no answer. A per-run job record (what ran, what it fetched, what it dropped and why) is arguably more useful than a log file, and the prompt already half-implies one with "this provider sent 340 things we have no field for".

## 067 — /articles/plexamp-network-connectivity-tips/
Identical text to 063 for the music client.
Rule (verbatim): same three causes; same "the apps will only have trouble connecting if all of the above holds true."
Classification: **ABSENT** — see 063.
Need: HIGH (same gap, counted once).

## 068 — /articles/plexmatch/
**The most directly transferable article in the set.** A `.plexmatch` sidecar file that overrides how a directory is matched, without renaming any files.
Rule (verbatim): "Match hint information provided in a .plexmatch file **overrides the directory and filenames**, allowing greater control over matching without requiring you to rename your existing files." Format: "A hint directive is composed of a hint name, a colon, and a hint value". Hints: "title and show are synonymous", "season sets the season number", "year", "tvdbid, tmdbid, and imdbid set the numeric ID… This overrides any title or year hints", "guid sets a Plex URI-style media identification GUID, in the format `[source]://[id]`". Scope: "a .plexmatch file at the top level of a series also affects directories beneath it". Comments with `#`, blank lines ignored, "Hint names are case-insensitive."
Classification: **DIVERGENT in mechanism, ABSENT in capability.** CanonCore refuses `.nfo` and refuses sidecar metadata generally ("The scanner takes media files and playback sidecars, and nothing else"), and that refusal is right: a `.plexmatch` file is metadata in the filesystem, which is the thing the product exists to escape. But the *capability* — pin this file to this external record, permanently, overriding every heuristic — is absent, and it is the thing that makes an import of a messy real collection finishable.
Need: HIGH. The right CanonCore form is not a file: it is **a `match` decision stored in the database against the file identity hash**, which survives renames and moves (the hash does), needs no filesystem write (honouring "The scanner NEVER writes storage"), and is exactly a statement sourced to the Owner with a rank of preferred. That the prompt already has all three pieces and never joins them is the finding.

## 069 — /articles/profile/
Profile page: bio, location, link, badges, and three content areas — **Watch History, Watchlist, Ratings** — each with its own privacy setting.
Rule (verbatim): "The count on the right is of watch history but only of a single event for any given item (Watching the same movie twice will only count once)". And: "If you set your Account visibility to 'Anyone Sign into Plex' or 'Anyone'. A URL with your user name will exist at watch.plex.tv/<username>".
Classification: profile = REFUSED (single user). **Watchlist** and **Ratings** as first-class personal data are **ABSENT** from the prompt and are not social features — they are single-user features Plex happens to render socially.
Need: HIGH for **Watchlist** (a want-to-watch / want-to-read list on items you own no file for is arguably CanonCore's most natural feature, given items are media-independent) and MEDIUM for **owner ratings**. Detailed in gaps.
Note also the dedup rule: Plex's *count* dedupes re-watches, while its underlying event log does not — the prompt's "append-only watch EVENTS are the truth, plus a maintained state row" gets this right, and Plex's phrasing is a good sanity check on what the projection should compute.

## 070 — /articles/publishing-collections/
Promoting a collection into a home-screen or library row, with three visibility targets.
Rule (verbatim): "From the overflow menu of the collection, choose Visible On then which screens you wish it to be available. The three options are Home, Library, Shared Users' Home." And: "The content of that collection will be added to the bottom of that libraries rows."
Classification: **ABSENT / deferred**, and it confirms the reading at 050: **a shelf is a container marked for display**, not a new type. Plex arrived at the same answer by letting any collection become a row.
Need: MEDIUM, folded into the shelf gap. The concrete design point: the flag lives on the container, and the ordering of rows is separate from the flag.


## 071 — /articles/push-notifications/
Push and email notification catalogue: what a server can tell you about, and where the preference lives.
Rule (verbatim): "Media notifications won't be sent the very first time something is added to a library after the feature is enabled. You can manually scan for files (even if there is not anything new) on your server to initialize." And: "Your choices for receiving push notifications are saved to your Plex account, which means that all supported Plex apps signed in to your account will have the same settings."
Classification: mostly REFUSED by structure — the Friends/Discover/social half is multi-user and out of scope, and the whole account-synced-preferences idea presumes a cloud account CanonCore does not have. But two notification *types* are single-user: **"New Content Added to Library"** and **"Watchlisted Item Now Available"**. Both are **ABSENT**.
Need: MEDIUM. The prompt has a background enrichment queue, periodic scans and a review queue, all of which complete silently. Some in-app "since you last looked" surface is the minimum; a push stack is not needed, but the *event* that would feed one is the same event the review queue needs. The first-run caveat is the real transferable detail: a notification feature built on a diff against the previous scan produces nothing on its first run, and that reads as broken.

## 072 — /articles/quality-suggestions/
Client-side bandwidth monitoring that offers to drop playback quality mid-session.
Rule (verbatim): "If there are 3 consecutive buffering events, that is likely due to decreased bandwidth. If this happens, the app will ask you if you would like to lower the playback quality for that session." And: "If you hit back or ignore the suggestion it will not ask again for that playback session." Cached-bandwidth staleness: "If last seen bandwidth is higher than current item's required playback bandwidth, check if it's been more than 7 days / If last seen bandwidth is less than current item's required playback bandwidth, check if it's been more than 24 hours."
Classification: **REFUSED** — this is the transcoding ladder ("no transcoding, no ffmpeg, no quality ladders"), and every branch of it ends in "the Plex Media server will need to transcode".
Need: n/a. Worth noting only that Plex's own docs concede "Setting 'original' or 'maximum' quality does not guarantee that the media will never need to be transcoded" — direct-play-only is the honest version of what Plex's quality UI is apologising for.

## 073 — /articles/remote-watch-pass-overview/
A paid subscription tier gating remote streaming of your own files.
Rule (verbatim): "Our optional Remote Watch Pass subscription applies only to the specific account on which the subscription was started."
Classification: **REFUSED / not applicable** — no subscriptions, no accounts, no Plex-side gating. CanonCore is software someone else runs.
Need: n/a. Recorded because it is the clearest statement of the business model CanonCore is structurally the opposite of.

## 074 — /articles/rentals-purchases-on-plex/
Rental and purchase storefront, with time-limited entitlements.
Rule (verbatim): "You have 30 days to start playback. Once you begin watching, you can play it as many times as you want within 48 hours." And on purchases: "remain available as long as the partner licenses the content to Plex."
Classification: **REFUSED** — storefront, geo-restriction, DRM entitlement. None of it is in scope.
Need: n/a. One structural observation worth keeping: a rented title is an item that appears in the catalogue with an entitlement window rather than a file, which is *shaped* like CanonCore's media-independent item plus a source reference. The prompt already gets the general case right; nothing to add.

## 075 — /articles/repair-a-corrupted-database/
Repairing the server's own SQLite database, including a shipped custom `Plex SQLite` binary.
Rule (verbatim): "Due to customizations included in the Plex database engine, the standard SQLite interpreter is not able to repair the Plex Media Server database." And the escape hatch: "You can also simply delete the com.plexapp.plugins.library.db database file while the Plex Media Server is not running. Restarting the server will then restore your server to a nearly-fresh install state. (i.e. You will lose your existing libraries and need to recreate them, but you won't be affecting your content itself.)"
Classification: **ABSENT** — no backup, restore, integrity-check or disaster story anywhere in the prompt.
Need: **HIGH**. Detail below in gaps. The load-bearing point is the second quote: Plex can tell users to delete the database because *nothing in it is irreplaceable* — libraries re-scan and metadata re-fetches. CanonCore is the exact opposite: the hand-built orderings, the owner's `rank` favourites, the remembered rejections, the review-queue decisions and the merge aliases exist nowhere else and cannot be re-derived from the files. The prompt says "DELETE — the one place data is actually lost"; that is only true if the database never dies. Postgres plus `pg_dump` on a schedule is a small amount of work and it is the difference between a catalogue and a hobby.

## 076 — /articles/reporting-security-issues/
Bug bounty policy and vulnerability disclosure process.
Rule (verbatim): "Circumvention of 4-digit PIN codes for account switching (PIN codes are not considered true security measures)" is listed as a NON-qualifying submission.
Classification: **ABSENT** — no disclosure policy, and none is needed pre-release.
Need: LOW as a policy, but the PIN quote is worth carrying: Plex states in its own security policy that its profile-switching PIN is not a security control. CanonCore has no profiles and one password, so it never has to make that concession — which is a point in favour of the single-owner decision, not a gap.

## 077 — /articles/requirements-for-remote-playback-of-personal-media/
The 2025-04-29 change gating remote playback of your own files behind a subscription, plus the definition of "remote".
Rule (verbatim): "'remote' playback would be any time that the player app cannot make a connection to the Plex Media Server on the same subnet of the same local network." Listed causes of a local connection being misread as remote: "An advanced network configuration (multiple subnets…)", "Devices or networks not allowing 'DNS rebinding' to be used", "Privacy/security settings (e.g. in a browser or mobile device) that do not allow making local network connections", "Running apps or servers inside a container/virtualization and not using 'host networking'", "VPNs". Exemption: "The remote playback restrictions do not apply to streaming music content to Plexamp or photos to our Plex Photos app."
Classification: the gating is **REFUSED** (no subscriptions). The **local-versus-remote detection problem is ABSENT** and it is not a licensing artefact — it is the reachability problem any self-hosted server has.
Need: MEDIUM. CanonCore does not need to *bill* differently for local and remote, but it does need to know whether a client can reach it, and "container without host networking" plus "browser blocks local network connections" are two failure modes that will hit a Docker-deployed self-hosted app on day one. The prompt's playback route is an "app-owned opaque-id route", which is the right shape (one URL, server-mediated) and dodges most of this — worth noting that the prompt's design is already the fix for the article's problem.

## 078 — /articles/sales-tax-information/
US sales tax collection on subscriptions and rentals, post-*South Dakota v. Wayfair*.
Rule: jurisdiction list as of 2021-05-04; "The advertised prices for Plex Pass subscriptions as well as other transactions do not include sales tax."
Classification: **REFUSED / not applicable.** No commerce.
Need: n/a.

## 079 — /articles/settings-android-tv/
Full settings reference for the Android TV client. Groups: Experience, Appearance, Privacy, Account, Video Quality, Player Experience.
Rule (verbatim): "Watched Indicators are always shown for episode and season list items on details pages regardless of this setting." Autoplay countdown: "Rewind on Resume … This setting defaults to None or you can choose various values between 1 and 30 seconds." Skip Intro/Ads/Credits all take the same tri-state: "Disabled / Manually (Default) / Automatically".
Classification: quality settings = **REFUSED** (transcoding). Skip markers = **ABSENT** (see 084). Two items are ABSENT and genuinely transferable: **"Remember selected tab"** per source, and the tri-state pattern itself — **Disabled / Manual / Automatic** as the shape for any assistive feature.
Need: MEDIUM for the tri-state. CanonCore has exactly one such feature already specified — enrichment auto-applies above the high bar, queues in the middle, discards below — and the prompt states it as two numbers. Plex's tri-state is the same decision expressed as a control a person can actually find. Worth noting the prompt's "No enrichment wizard" refuses the *flow*, not the *switch*.
Also: **"Reduce motion"** — an accessibility setting. The prompt has no accessibility position at all. LOW-MEDIUM.

## 080 — /articles/settings-playstation/
PlayStation client settings. Same shape as 079 plus console-specific audio passthrough.
Rule (verbatim), and this one is the find: **"Allow Fallback to Insecure Connections … Never – (Default) Never fall back to insecure connections without specific action from the user / On same network as server – Allow fallback, but only when the PlayStation app and the Plex Media Server are on the same network / Always – Always allow fallback."**
Classification: **ABSENT**. The prompt's Safe External Fetch boundary is HTTPS-only and outbound — it governs what the *server* fetches. It says nothing about what the *client* accepts when connecting to the server, and a self-hosted server on a LAN very often has no valid certificate.
Need: MEDIUM. This is the single hardest practical problem in self-hosting and Plex solved it with per-device consent plus a default of Never, scoped by network. CanonCore's phone and TV apps will hit it. Not first-version work, but the decision should not be made accidentally by whichever HTTP client is reached for first.
Also: **"Manual Servers — You can manually specify the IP address (IPv4) and port"**. ABSENT, LOW, but it is the fallback every discovery mechanism needs.

## 081 — /articles/settings-plex-for-apple-tv/
Apple TV client settings. Near-identical to 079.
Rule (verbatim): **"Auto Play Countdown Time … Immediate / 5 seconds / 10 seconds (default for mobile players) / 15 seconds (default for TV players) / 30 seconds / 60 seconds."** And: "Advertise as Player — Enable or disable the ability for other Plex apps to fling content to this device and control it remotely."
Classification: **ABSENT**. The prompt covers Continue Watching ("computed, never stored. No time window, no dismissal. It is offered, never auto-played") but says nothing about what happens when an episode *ends*.
Need: MEDIUM. "Offered, never auto-played" is a stated principle for Continue Watching and post-play is exactly where it gets tested. Plex's differing TV/mobile defaults (15s vs 10s) is a concrete detail: a TV sitting across the room needs longer than a phone in your hand. **Top Shelf** (surfacing content on the tvOS home screen) is ABSENT, LOW, and only relevant once the Swift TV app exists.

## 082 — /articles/share-and-report/
Sending a friend a message about an item, and reporting a playback problem to a server admin.
Rule (verbatim): "The share and report options only works for movies and shows in libraries matched with our modern Plex Movie and Plex TV Series agents. It will not work with Home Video, Music or Photo libraries." And on privacy: "(Note that the item artwork and title are sent to the server admin directly from server. The information is not stored at or by Plex.)"
Classification: **REFUSED** — social, multi-user. But **"Copy Link: Copy to clipboard a URL you can use in other apps that will direct toward the universal details page for the item"** is not social, and it is **ABSENT**.
Need: MEDIUM for copy-link. The prompt is emphatic that URLs address items and that aliases keep old URLs resolvable forever — which is a lot of machinery whose payoff is a stable link, with no affordance anywhere for getting hold of one. One button, and it makes the alias rule visible.

## 083 — /articles/shared-media/
Granting access to a single item rather than a whole library.
Rule (verbatim): "You can give access to individual media items from your Plex Media Server instead of the entire library". Shareable types: "a movie, a TV show, a season, an episode, an album, a song/track, an artist, a playlist, a photo, a photo album". And: "even in the 'Media' source is pinned content from it will not show up in the home screen 'Continue Watching' row".
Classification: **REFUSED** — this is precisely the visibility system the prompt rules out ("No visibility system. Not a column, not propagation, not a resolution rule. … 'Inherit from which parent?' has no answer once an item is multi-placed").
Need: n/a, but this article is *evidence for* the refusal rather than against it. Plex's per-item share is a second, parallel access mechanism sitting beside library shares, with its own pseudo-library ("Media" source) and its own exclusion from Continue Watching, because the two mechanisms cannot be reconciled. That is what the prompt is avoiding.

## 084 — /articles/skip-content/
Intro-marker detection: analysing episode audio to find repeated segments.
Rule (verbatim): **"Short intros of less than 20 seconds are ignored. / Intros ending more than halfway into an episode will not be detected. / If you have multiple copies of the same episode only one will be analyzed to try and detect the intro."** Matching scope: "Matching is done per season, as many shows have a different intro segment for each season." Scheduling tri-state: "never / as a scheduled task / as a scheduled task and when media is added".
Classification: **ABSENT**, and outside the direct-play-only line only in part — a marker is a timestamp, not a transcode.
Need: LOW for detection (it is signal processing over audio, real work, and no part of the stop condition). But two things generalise and are worth MEDIUM:
(a) **The scheduling tri-state** — "never / on schedule / on schedule and on add" is the vocabulary the prompt's "support explicit periodic scans" is missing, and it appears again verbatim at 085. It is Plex's answer for every expensive background job, and CanonCore will have several (scan, provider refresh, artwork fetch + palette extraction).
(b) **"only one will be analyzed"** — a per-*work* job deduped across redundant files. The prompt's "REDUNDANT FILE" rule and its COUNT(DISTINCT item) dedup are the same instinct; this is a third place it applies.

## 085 — /articles/sonic-analysis-music/
CPU-heavy audio fingerprinting used to power similarity, radio and auto-generated mixes.
Rule (verbatim): "The sonic analysis process is very CPU-intensive and can take a significant amount of time (hours or even multiple days) to complete". Same tri-state as 084. And the honest one: **"The activity only shows up while the analysis is taking place. This means that if you set analysis to occur as a scheduled task, it will only appear during that maintenance period (which is typically overnight, while you're likely asleep)."**
Classification: sonic analysis itself = **ABSENT / out of scope**. The *reason* it exists is the interesting part and it is **ABSENT with force**: "maybe you have some obscure artists from Bandcamp or even your high school band … Those may well not have any real metadata available at all on MusicBrainz". That is the no-provider-can-match case, and it is CanonCore's normal case, not its edge case.
Need: MEDIUM, and not for fingerprinting. The transferable finding is the second quote: **a long-running job whose only progress indicator is live is a job nobody can ever see**. The prompt has background enrichment against thresholds with an optional review — if progress is a live activity bar, the owner sees nothing, exactly as Plex concedes here. A **persisted job record** (started, finished, counted, dropped, failed) is the fix, and it is the same record the review queue and 066's logging gap both want. Counted once in gaps.

## 086 — /articles/subtitle-offsets/
Adjusting subtitle timing during playback.
Rule (verbatim): "It is not possible to adjust the offset for subtitles that are embedded in/part of the video file itself. Only for text-based external/'sidecar' subtitles. e.g. .srt files." And: "Add or remove from the offset in 50 or 100 millisecond increments depending on app."
Classification: **ABSENT**, and it lands on a table the prompt already has. Files carry `role: media|subtitle|audio|chapters` and "a sidecar references the file it accompanies plus a language" — an offset is one more nullable column on exactly that row.
Need: LOW-MEDIUM. Small, but it validates the sidecar-as-its-own-row decision: the offset has somewhere to live *because* a subtitle is a file row rather than a property of the media file. Under an embedded-track model it has nowhere, which is why Plex cannot offer it there.

## 087 — /articles/subtitle-search/
Fetching subtitles from OpenSubtitles.com by title, hash and language.
Rule (verbatim): **"The search uses title, file hash, and language to find matches"** and **"The star means that your video file has a hash match from OpenSubtitles (and that result is very likely to be valid)"**. Lifecycle: "If, after selecting a subtitle from search, you later select None or a different existing subtitle, the subtitle that was downloaded from the search will be deleted". Storage: **"Subtitles are temporarily saved in a blob database. Downloaded subtitles are not intended to be user-accessible."** Independence: "the subtitle search is not linked with the OpenSubtitles metadata agent."
Classification: **ABSENT**, and this is the most structurally interesting article in the batch.
Need: MEDIUM, but the finding matters more than the feature. Three things:
(a) **A file hash used as a matching signal to an external service.** The prompt computes SHA1(size + first 64KB + last 64KB) and uses it *only* for relinking moved files. OpenSubtitles' hash is a near-identical construction (filesize + first 64KB + last 64KB) used for the opposite purpose: identifying the release to strangers. The prompt already says "Shared identifiers then become MATCHING SIGNALS between providers" — the file hash is a shared identifier the prompt does not currently treat as one.
(b) **A provider that returns a FILE, not a claim.** Every provider in the prompt returns statements, artwork or containers. A subtitle provider returns bytes to be stored and played. The CMPP contract as specified has no shape for that, and the artwork table is the existing exception proving one is needed. If subtitle fetching is ever wanted, it is a second exception — worth deciding deliberately rather than discovering.
(c) **The same source can be two different providers.** "The subtitle search is not linked with the OpenSubtitles metadata agent" — one origin, two contracts, separately configured. The prompt's providers table assumes one row per source.
Also ABSENT: the **SDH/forced-subtitle preference model** (four-state each: prefer / prefer-other / only / only-other). LOW.

## 088 — /articles/sync-watch-state-and-ratings/
Syncing watched state and personal ratings to the cloud account, with a privacy design worked out in unusual detail.
Rule (verbatim), the payload: watched state syncs "The Plex account user ID / The GUID for the title / The date and time it was set as watched/unwatched / The 'watched' or 'unwatched' state", and ratings the same four with the rating in place of the state. The design goal: **"the feature is designed so that Plex does not know what content may be located on a personal Plex Media Server."** And the consequence, which is the good bit: **"If you stop watching an item part way through, the 'in progress' information is not synced. Only if or when you complete the title (so it is 'watched') will the state get synced up. That's intentional to ensure the source can't be inferred to be a personal server."** Latency: "could take up to 30 minutes". Precondition: "you may want to refresh metadata for libraries to make sure that media IDs (GUIDs) match what we have in our database."
Classification: cross-instance sync = **REFUSED** ("No fork, no export, no import, no cross-instance sharing"). **Owner ratings are ABSENT** (already flagged at 069).
Need: HIGH for ratings, detailed in gaps. Two further findings:
(a) **The in-progress omission is a genuinely clever privacy design** and it is worth recording that CanonCore gets the same property for free by not syncing at all. It is also a warning about the demo: the public demo is read-only with no login, so it has no progress to leak, and that should stay true.
(b) **"make sure that media IDs (GUIDs) match"** — Plex's sync is keyed on an external identifier, so an unmatched item cannot participate at all. CanonCore's items are media-independent and may match nothing anywhere, which means any future feature keyed on an external id excludes the catalogue's most distinctive contents. The prompt's surrogate-id-plus-external-mappings rule already anticipates this; this is a live example of what goes wrong without it.

## 089 — /articles/transcoder/
Full transcoder settings reference, including literal x264 parameter strings.
Rule (verbatim): "The directory used (whether default or not) needs sufficient free space, roughly equal to the size of the source file of the transcode plus 100MB." And: "You should not specify a location that resides on a network share/disk. Do not specify a location that exists is within any of the media path locations for libraries. Do not specify a location that already contains data."
Classification: **REFUSED** in full ("No transcoding. Direct play only. No transcoding, no ffmpeg, no quality ladders").
Need: n/a. Recorded as the size of what the refusal buys: this one settings page carries a quality enum, hardware acceleration, a session cap, two temp directories, a throttle buffer, an x264 preset with nine values, HDR tone mapping, a device selector and an experimental HEVC toggle — every one of them a support burden and a bug surface. The third quote is the transferable one though: **"Do not specify a location that exists is within any of the media path locations for libraries"** — an app-owned working directory nested inside a scanned root gets re-scanned. CanonCore has an artwork cache and will have a projection store; the same trap applies, and the prompt's "the scanner NEVER writes storage" rule prevents the write but not the *read* of someone else's app-owned directory sitting under a media root. The file/folder exclusion gap already logged at 007 is where this lands.

## 090 — /articles/translations-and-localization/
Community translation via Transifex.
Rule (verbatim): "A translation only needs one vote to become a translation."
Classification: **ABSENT** — the prompt has no i18n position, and no localisation of its own UI.
Need: LOW for translation-as-a-programme. MEDIUM for the narrower thing underneath it, which the prompt does need and does not have: **a language/locale axis in the data**. Statements have `source`, `observed_at` and `rank` but no language, so two providers returning a title in different languages produce two competing claims with no way to say they are both right. TMDB returns localised titles and overviews by default. The prompt's demo includes a novel published under two different titles in two markets. This is a real modelling hole, not a UI concern — recorded in gaps.

## 091 — /articles/two-factor-authentication/
TOTP two-factor on the Plex account.
Rule (verbatim): "A new set of 10, single-use codes will be provided to you / All the the previous recovery codes for your account will be invalidated." The legacy-client workaround: **"you append a valid verification code to the end of the password when submitting: <password><verification code>"**. And the caveat that matters: "If you are part of a Plex Home, then there will not be any extra prompt for 2FA when switching between members of the Home."
Classification: **ABSENT**. The prompt specifies "one password, no signup" and a "single-password cookie session" and stops there.
Need: LOW-MEDIUM. Not 2FA itself — one owner, one password, self-hosted, and the instance is usually behind whatever the owner already runs. But three adjacent things the prompt is silent on and which are not optional for a thing exposed to a network: **rate-limiting / lockout on the password endpoint**, **session invalidation** (log out other devices, which the TV link-code flow at 064 makes necessary), and **password change**. The password-concatenation hack is a good warning: an auth design that cannot accommodate a second factor later gets one bolted on sideways.

## 092 — /articles/universal-watchlist/
A single list of things to watch, spanning owned files, streaming services and unreleased titles.
Rule (verbatim): "Movies or TV shows in a Plex Media Server library (**not individual seasons or episodes**)". Ordering: "By default, they will be shown in the order that you added them, with the most recent first." Unavailable items: **"If not yet available from any sources, the expected theatrical or service release date will be shown below the title."** The privacy architecture: **"personal servers are not sending lists of library content to Plex. We don't know what's on your server. Instead, when you visit a page that checks service/server availability of a title, the Plex app asks the Plex Media Server."** Removal: automatic only within Plex's own service; "Items watched on other services will need to be managed manually." Precondition: "the library must use the Plex TV Series or Plex Movie metadata agents. The Watchlist is not supported for libraries using older or third-party agents."
Classification: **ABSENT**, and this is the highest-value ABSENT in the batch, confirming 069.
Need: **HIGH.** Full argument in gaps. The short form: Plex had to build a whole parallel cloud service to have a watchlist, because **in Plex an item cannot exist without a file** — the prompt names this as reason #1 the product does not already exist. CanonCore's items are media-independent by design, so a watchlist is one boolean-ish statement (or one rule-derived container) over items that already exist, with no second service, no availability federation and no privacy problem. It is the clearest case in the whole sweep of a feature that is architecturally expensive for Plex and nearly free here. The RSS-feed detail is also worth noting as the one export Plex ships, against the prompt's "no export".

## 093 — /articles/upgrade-music-libraries-new-metadata-system/
Migrating an existing music library to a new metadata backend after a provider change.
Rule (verbatim): **"At the end of June, 2019, we switched metadata providers for some of the metadata we provide."** Migration semantics: "New content added to the library from this point forward will use the new system. Existing content will not change by default for now. To upgrade an existing artist (and albums/tracks belonging to the artist), you need to take explicit action to Refresh the content." Local tags: **"If you choose to enable the Prefer local metadata (advanced) library preference, that basically means that you're prioritizing local embedded tags over online information as well as committing to having accurate tags for your entire music library."** Folder assumption: "The new matching expects that music tracks in the same folder are in the same album."
Classification: **ABSENT / DIVERGENT.** The whole class of problem — a provider disappears, or is replaced, and every value it supplied is now orphaned — is unaddressed in the prompt, and CanonCore is *structurally better placed* than Plex to handle it because every statement already carries its source.
Need: **MEDIUM-HIGH.** Detailed in gaps. Plex's answer is a hard cutover with old content frozen until manually refreshed, because it has nowhere to record which agent supplied what. CanonCore can answer "show me everything sourced to provider X", "retire provider X", and "what falls back to second place if X's claims are demoted" — but only if a provider row can be *retired* rather than deleted, and only if statements survive their provider's removal. Nothing in the prompt says what happens to statements when a provider is disconnected. That is a genuine unspecified case with a data-loss failure mode.
Also confirms 008: **"Prefer local metadata"** — embedded tags as a first-class metadata source, with a stated all-or-nothing cost. Still ABSENT, still MEDIUM.

## 094 — /articles/upgrading-a-movie-library-to-the-use-the-new-plex-movie-agent/
The same migration for movies, plus what changed in the new agent.
Rule (verbatim), and it is the important one: **"Metadata fields you have locked will not be changed, however."** Locks are the only thing that survives an agent migration. Also: **"A new advanced setting, Minimum automatic collection size, will allow you to tweak the threshold at which we'll automatically add a new collection to your library. You can tweak this setting between Disabled (no automatic collections) and 4."** And on upgrade: "if you're upgrading a movie library that has existing collections we will not overwrite any of their existing metadata fields."
Classification: locks = **ADOPTED-equivalent and DIVERGENT in mechanism.** The prompt refuses a lock flag and makes the owner's `rank`-preferred favourite do the job. This article is direct evidence the substitution works: the *function* Plex needs from a lock here is "the owner decided this; a wholesale provider change must not touch it", and a preferred-rank statement sourced to the Owner delivers exactly that, plus the reason, which a padlock cannot.
The **minimum automatic collection size** is **ABSENT** and it is a small, concrete, transferable rule.
Need: MEDIUM for the threshold. The prompt has rule-derived containers with no floor, so a rule matching one item still produces a container. Plex's answer — a tunable minimum, default above 1, disable-able — is the right shape and costs one integer. Worth adopting rather than rediscovering.
Also ABSENT: **regional language variants** as first-class options ("Spanish (Mexico)", "English (United Kingdom)", "Chinese (Hong Kong)"). Reinforces the language gap logged at 090 — a locale is not a language, and Plex found it needed eight sub-variants.

## 095 — /articles/upgrading-subscriptions/
Changing subscription plan across four different billing channels.
Rule (verbatim): "Going through this upgrade process will result in the loss of any remaining time in the existing App Store subscription. There is no credit or refund for that remaining time." And: "Due to limitations in Roku and Amazon Appstore subscription management APIs, it is not currently possible to directly upgrade Plex subscriptions."
Classification: **REFUSED / not applicable.** No commerce, no app-store billing.
Need: n/a. The only reusable observation is a caution about the client roadmap: shipping through app stores drags their billing and account constraints in with them. CanonCore's apps talk to the owner's own server, so this does not bite — but "you cannot do X because of an app store API limitation" is the shape of problem that arrives with a store listing, not before it.

## 096 — /articles/use-federated-authentication-to-sign-in/
Google and Apple sign-in alongside a native password.
Rule (verbatim), and this is the transferable one: **"When using Continue with Apple, if you choose the Hide My Email option from Apple, then Plex will not know what the real email address is and will not be able to match it to an existing account. Instead, a brand new, separate account will be created."** Also: "If your Google or Apple account has the same email address as your Plex account … For security, Plex will ask you to type your existing Plex password."
Classification: **REFUSED by implication** — the prompt says "auth NONE" in the scaffold config and "one password, no signup". Federated identity presumes accounts.
Need: LOW. But the finding is worth one line as a *general* rule, not an auth rule: **an identity system keyed on an attribute the identity provider is allowed to hide will silently fork the record**. That is the same failure the prompt already names for Jellyfin's name-keyed people ("two people sharing a name merge irreversibly"), arriving from the opposite direction — here a stable identity is *split* rather than merged, because the join key was not guaranteed. The prompt's rule ("ENTITY IDENTITY IS A SURROGATE ID with external-id mappings, NEVER A NAME") already covers both directions; this is independent confirmation from a completely different domain.

## 097 — /articles/user-reviews/
Writing a rating and a text review on an item, with spoiler flagging and privacy controls.
Rule (verbatim): **"Reviews must: Be at least 7 characters long / Not contain only numbers"** and **"You can only have one review per media item."** Storage: **"User Reviews are not stored locally on the Plex Media Server, so Syncing Watch State and Ratings for your account is required. If not enabled, only the option to rate will be available on server library pages."** Editing: "If you only want to delete the review, then simply remove the contents of the text entry field and save." Scope: "rate and review any Movies, Shows, Seasons, or Episodes." And: "User reviews are by other Plex Users. Critic Reviews are currently gotten from Rotten Tomatoes."
Classification: reviews-as-social = **REFUSED**. **The owner's own rating and own review text are ABSENT.**
Need: **HIGH for rating, MEDIUM for review text.** Detailed in gaps. Two structural points from the article:
(a) **Plex cannot store a review on the server it is reviewing** — it needs the cloud, so an offline instance loses the feature entirely. CanonCore has nowhere else to put it, which is an advantage: an owner rating is a `rating` statement sourced to the Owner and a review is a `note` statement, both already fully specified mechanisms. The prompt explicitly blesses `note` ("Owner free-text about an item is a statement with a `note` property sourced to the Owner"), so review text is arguably already covered; a numeric rating is not, because there is no `rating` property in the seed list and no stated position on whether owner ratings exist.
(b) **The spoiler flag.** A per-statement "this contains spoilers, obscure it until asked" bit is genuinely novel for a *fiction* catalogue, and CanonCore is a fiction catalogue in a way Plex is not — a summary of a later story is a spoiler for an earlier one, and a chronology container will routinely place them adjacent. ABSENT, MEDIUM, and unusually well-matched to this product. It would be a qualifier on a statement, which the prompt already has a table for.

## 098 — /articles/using-an-xmltv-guide/
Supplying your own EPG data in the XMLTV XML format instead of Plex's bundled guide.
Rule (verbatim): "Plex itself does not provide XMLTV data to users. If you wish to use XMLTV data, you'll need to obtain that yourself." And: "When you're initially setting up a DVR … (if you've already set up a DVR, you'll need to delete it and set up a DVR fresh)."
Classification: Live TV = **REFUSED / out of scope.** But the *pattern* is directly relevant and is **ABSENT**: **a user-supplied metadata source that is a static file in a published format, rather than a service answering a contract.**
Need: MEDIUM. The prompt defines a provider as "a URL answering a contract — not a plugin, not a repo, and never code running inside the app". An XMLTV feed is a URL, but it answers no contract: it is a file you fetch and parse whole. That is the cheapest possible way for a third party to get data in, and CMPP as specified excludes it — a source has to stand up an HTTP service implementing search *and* lookup before it can contribute anything. Worth deciding deliberately rather than by omission, especially since the prompt's own first provider exists precisely because a source (the wiki) has no usable public API. Note the second quote too: **the guide source cannot be changed after setup without deleting the DVR.** That is what an unmigratable source binding looks like, and the prompt's per-statement provenance is exactly what avoids it.

## 099 — /articles/using-nfo-metadata-files-with-plex/
The Plex NFO Agent: reading Kodi-format XML sidecars as the metadata source. **Last modified 2026-07-14 — Plex shipped this in v1.43.1, recently and deliberately, after years of refusing it.**
Rule (verbatim), and the whole article is quotable, but the load-bearing parts:
- ID priority: **"`<uniqueid>` with a type attribute (recommended). For example, `<uniqueid type="tmdb" default="true">383498</uniqueid>` will produce a stable GUID like `tv.plex.agents.nfo.movie://movie/tmdb_383498`."** and "`<id>` as a fallback."
- Watch-state consequence: **"as long as your NFO files contain consistent IDs, your watch status and play history will be preserved across rescans."**
- Multi-valued ratings with a designated winner: **"The name attribute identifies the rating source (e.g. imdb, themoviedb, thetvdb). Set default=\"true\" on whichever rating you want displayed as the primary rating in Plex."**
- Agent stacking: "Add the appropriate NFO provider as the primary provider. Optionally add additional providers such as 'Plex Movie' or 'Plex Local Media' below it." And: "If you want embedded metadata from MP4 files to take priority over NFO metadata, add the 'Plex Local Media' provider above the NFO provider in the list."
- Multi-episode files: **"When a single video file spans multiple episodes (e.g. S01E01-E02) … include a separate `<episodedetails>` block for each episode."**
- Limitation: "Multi-part files: Movies split across multiple files (pt1, pt2) are not currently supported by the NFO Agent."
- And the cost of choosing it: **"Libraries using this agent will not work with Syncing Watch State and Ratings"**; Discover credits are unavailable unless you deliberately *omit* cast data from your own files.
Classification: NFO reading itself is **REFUSED** and explicitly so ("no `.nfo` reading. The scanner takes media files and playback sidecars, and nothing else"). But four things inside it are ADOPTED-equivalent or ABSENT and this is the richest article in the shard:
1. **`<ratings>` with `default="true"` is Wikibase rank, badly.** Multiple values for one field, all retained, one marked primary. The prompt's `rank` column is the same idea done properly — sourced, disputable, and applying to every property rather than just ratings. Independent confirmation the design is right, arriving from Kodi's format rather than from Wikibase.
2. **`<uniqueid type=…>` is scheme-plus-value**, exactly the prompt's "A SCHEME is what an identifier IS … an identifier statement records both". Kodi got there too.
3. **The agent stack is an ordered source list**, which is the prompt's source order — and Plex's version is per-library, so it *is* the per-group re-ranking the prompt deliberately refused. The prompt's stated cost ("two providers cannot be ranked differently in two groups that both ask both") is real; what this article shows is the cost of the alternative, which is a per-library ordered agent list that the user must reason about, plus a documented gotcha about which provider must sit above which.
4. **ABSENT: one file, several works.** `<episodedetails>` repeated in one NFO, and the *inverse* case (one movie across pt1/pt2) which Plex's NFO agent cannot do at all. The prompt's files table attaches a file "to item or edition" — singular. A double episode on one file, and a film split across two files, are both real and neither is expressible. Recorded in gaps.
Need: HIGH for the file/work cardinality point; the rest is confirmation rather than gap.

## 100 — /articles/using-unsigned-qnap-apps/
Instructions for disabling QNAP's App Center signature check to install Plex manually.
Rule (verbatim): "Enable setting to allow installation of without a digital signature" and the section heading "Expected 'No digital signature' warnings".
Classification: **ABSENT / out of scope.** No packaging story in the prompt at all.
Need: LOW as written. But it names a real cost of self-hosted distribution: asking a user to weaken a platform's security check in order to install you. CanonCore's stated deployment is Docker/Postgres, which sidesteps NAS app stores entirely; worth not drifting into NAS packaging without a reason.

## 101 — /articles/video-on-demand-overview/
Plex's own free ad-supported streaming catalogue.
Rule (verbatim), and it is the one useful thing here: the per-source availability tri-state — **"Enabled – The administrator account as well as all managed users and accounts with preset profiles can access the content / Disabled – Neither the administrator account nor any managed users … / Disabled for Managed Users – The administrator can access the content, but no managed users … can access it."**
Classification: VOD = **REFUSED** (Plex-as-publisher; CanonCore is a publisher only on the demo). The **"Online Media Sources" settings page** — one place listing every non-local source and whether it is on — is **ABSENT**.
Need: MEDIUM. The prompt has four provider tiers (bundled-and-disabled, store, private, licensed-to-one-person) and says bundled defaults ship "ALL DISABLED BY DEFAULT", but never says where the owner sees the list and flips them. That screen is the entire user-facing surface of the provider system, and it is unspecified. Plex's version is exactly it, minus the managed-users column CanonCore does not need.

## 102 — /articles/video-playback-speed-controls/
Variable-speed playback.
Rule (verbatim): **"Available speed increments: 0.5x, 0.75x, Normal, 1.25x, 1.5x, 1.75x, and 2x"**; "The setting will remain enabled during a playback session (play queue) … Stopping playback will reset the playback speed to Normal." Costs: "'Frame Rate Matching' functionality will be disabled for the session on most platforms" and "Passthrough of audio will not be available in most cases and will typically require audio to be transcoded or decoded locally on the device."
Classification: **ABSENT**. Not obviously refused — speed change is a player capability, not a server transcode, and the article says the decode happens "locally on the device".
Need: MEDIUM, and higher than it looks, for one reason the prompt cares about: **audiobooks**. The prompt makes audio a first-class medium, specifies three narrations of one novel as three editions, and cites Audiobookshelf twice. Variable speed is table stakes for spoken-word audio in a way it is not for film, and every audiobook player has it. The scope-relevant point is that it is a *client* feature that costs the server nothing, so it does not conflict with direct-play-only. Worth naming as a phone-app concern rather than leaving it to be discovered as a complaint.
Also note the session-scoped-reset rule: speed persists across a play queue but resets on stop. That is the right default and is free to copy.

## 103 — /articles/watch-together/
Synchronised playback across several people's clients. **Note (2025-02-25) on the article: "As we debut our new Plex experience, we are ending support for some features we've grown to love, like Watch Together."**
Rule (verbatim): "any member of the session can pause/start playback as well as skip or scrub within the playback timeline. Doing so will adjust playback for all members in the session."
Classification: **REFUSED** — multi-user, social, and requires the cloud lobby.
Need: n/a. Worth one line as evidence for the prompt's overall posture: Plex built this, ran it for five years, and killed it during a redesign. A feature that needs a cloud lobby, friendship, and a sharing grant is exactly the sort of thing the prompt's single-user decision keeps out, and Plex's own withdrawal is the confirmation.

## 104 — /articles/windows-and-macos-intro-installation/
Installing and uninstalling the desktop app.
Rule (verbatim), and this is the one substantive item: **"When launching the app for the first time it will have a sign in button on screen. When clicked it will open the the web browser on your computer. Once signed in to your account in the browser, the Plex app will go to your home page."** Uninstall is documented as two steps: the platform uninstaller, *then* deleting `%LOCALAPPDATA%\Plex` / `~/Library/Application Support/Plex` by hand.
Classification: **ABSENT** on both counts.
Need: MEDIUM for the browser-delegated sign-in. It is the desktop counterpart of the TV link-code flow already logged at 064, and it is *simpler*: the app opens the system browser, the browser holds the session, the app gets a token back. For CanonCore's single-password cookie session that is one route plus one token table, and it means no client ever has to implement a password field. LOW for the uninstall note, though "the uninstaller does not remove your data directory" is the sort of thing that has to be written down once and never is.

## 105 — /articles/windows-mac-app-logs/
Where the desktop app's logs live, and how to send them.
Rule (verbatim): "Quit and then restart your Plex app (which helps get fresh logs)"; "Do not paste the logs directly in the forum post; instead, attach the file." Note the structure: **three separate log locations** for one app — app logs, download-feature logs, and server logs — each under a different path, and each Linux packaging format (Flatpak, Snap) puts them somewhere different again.
Classification: **ABSENT** — duplicate of the gap at 066, from the desktop side.
Need: MEDIUM (counted once with 066). The added detail worth keeping: the fragmentation is the failure. Three log locations times three Linux packaging conventions is nine paths a user has to be walked through, and that is what a logging story looks like when it grows rather than being designed. CanonCore is one server process plus one web app; one log stream and one job table is achievable and should be decided now rather than accreted.

## 106 — /articles/windows-transcoder-failures-during-playback-live-tv-or-dvr-recording/
A specific third-party interaction: MalwareBytes Premium's Web Protection blocking the transcoder's loopback HTTP calls.
Rule (verbatim): the diagnostic signature **"ERROR - [Transcoder] av_interleaved_write_frame(): Unknown error"**, and the cause — the transcoder writes its output segments *by HTTP to itself*: "Unable to open http://127.0.0.1:32400/video/:/transcode/session/…/manifest for writing". The fix is eleven named executables to exclude.
Classification: **REFUSED** (transcoding), but there is a real finding underneath.
Need: LOW-MEDIUM, and it is an architecture note rather than a feature. Plex's transcoder talks to its own server over loopback HTTP, so any local security product that inspects HTTP breaks it, and the user-visible symptom ("Conversion failed") names none of that. The transferable rule: **internal component communication over the network stack turns third-party local software into a dependency**. CanonCore's provider fetches are unavoidably HTTP and outbound, and its Safe External Fetch boundary already denies loopback and RFC1918 — which, read against this article, is doubly right: it prevents both the SSRF class and this class of self-referential coupling. Nothing to add; recorded as confirmation.

## 107 — /sign-in/ (support site landing page)
Not an article. The support-site shell: article search, forums, release notes, a suggestion box, a service-status page, billing support, and partner/press assets.
Rule: none.
Classification: **ABSENT / out of scope.** Named for completeness — the shard's 107th URL is the support portal itself, not a document.
Need: LOW. One observation: the portal's own structure is articles + forum + release notes + status + suggestions, and the prompt commits to none of these. That is correct for a pre-first-version project. The single item that becomes non-optional the moment anyone else installs CanonCore is **release notes**, because the prompt mandates a forward-applicable migration ladder and "a released version can always migrate forward" is a promise that needs versions to be named somewhere.

---

STATUS: complete

All 107 URLs in `shards/plex-support-ad` covered (001-070 in the earlier pass, 071-107 in this one).

---

# GAPS — ABSENT FROM CANONCORE

MEDIUM and HIGH only, consolidated across the whole shard. Items already argued in
001-070 are named and cross-referenced rather than re-argued; the detail below is for
what this shard's 071-107 added.

## HIGH

**H1. Backup and restore of the catalogue database.** (075)
The prompt says "DELETE — the one place data is actually lost". That is only true while
the database survives. Plex can tell a user to delete its database because everything in
it is re-derivable from files and providers. CanonCore's is not: hand-built orderings,
placement positions, `rank` favourites, remembered match rejections, review-queue
decisions, merge aliases and owner `note` statements exist nowhere else and cannot be
re-scanned. A scheduled `pg_dump`, a documented data directory, and a restore path are
small and are the difference between a catalogue and a hobby. Related: the data-directory
gap at 004.

**H2. A watchlist / want-to-consume list.** (092, 069)
Plex had to build an entire cloud service to have one, because in Plex an item cannot
exist without a file — which the prompt names as reason #1 this product does not already
exist. CanonCore gets it nearly free: items are media-independent, so a watchlist is a
statement (or a rule-derived container) over items that already exist. No availability
federation, no second service, no privacy problem. This is the single clearest case in
the shard of a feature that is architecturally expensive for Plex and cheap here, and it
is the natural first thing to build on top of media-independence once the four stop
conditions are green. One detail from Plex worth copying: the list orders by *when you
added it*, most recent first, which is a property of the membership row, not the item.

**H3. Owner ratings.** (097, 088, 069, 099)
Three separate articles in this shard treat a personal rating as inseparable from watch
state, and Plex's NFO agent shows the shape: several ratings from several sources with one
marked `default="true"`. CanonCore's statements table with `source` and `rank` already
models exactly that, and an owner rating is a statement sourced to the Owner with rank
preferred. What is missing is only the decision that it exists: there is no `rating` in
the seed property list and no stated position. Deciding it now costs one seed row;
discovering it later costs a scale, a range and a display convention argued from scratch.
Note also Plex's constraint that a review is one-per-item, and that deleting the text but
keeping the number is a distinct operation.

**H4. File-to-work cardinality is not one-to-one.** (099)
The prompt attaches a file "to item or edition", singular. Plex's NFO format supports
repeated `<episodedetails>` blocks for a single file spanning two episodes, and separately
documents that its NFO agent *cannot* handle the inverse (a film split across pt1/pt2).
Both cases are ordinary in real collections and neither is expressible in the schema as
stated. This is a schema-level question, so it belongs before the first migration rather
than after: the honest shapes are either a file-to-subject join table, or an interval on
the attachment mirroring `edition_coverage`. The second is more likely correct, since a
double episode is literally "this file covers parts 1-2" and the coverage-interval
machinery already exists. Cheap to get right now, expensive later.

**H5. Provider retirement and statement orphaning.** (093)
Plex switched music metadata providers in June 2019 and its answer was a hard cutover with
existing content frozen until manually refreshed, because it has nowhere to record which
agent supplied what. CanonCore's per-statement `source` makes the good answer possible —
"show me everything from provider X", "demote X's claims and see what wins instead",
"retire X without deleting its history". But the prompt never says what happens to
statements when a provider is disconnected. If the answer defaults to a cascade delete,
the provenance design's main advantage is thrown away at the one moment it pays off, and
the failure is silent data loss. `providers` needs a `retired` state like every other
vocabulary, and statements must survive it.

## MEDIUM

**M1. A persisted job record.** (085, 066, 105, 071)
Plex concedes in its own docs that a scheduled analysis shows progress only while running,
"which is typically overnight, while you're likely asleep" — so the user sees nothing,
ever. The prompt has background enrichment against thresholds, periodic scans, artwork
fetches and a review queue, all of which complete silently, and no logging story at all.
One table — what ran, when, how many items, how many applied, how many queued, how many
dropped and why, what failed — answers "why did nothing happen?", feeds the review queue,
and is the thing the prompt already half-implies with "this provider sent 340 things we
have no field for". Preferred over log files: it is queryable, it is per-run, and it does
not fragment across nine paths the way Plex's logs do.

**M2. Language and locale on statements.** (090, 094)
Statements carry `source`, `observed_at` and `rank` but no language. TMDB returns localised
titles and overviews; Plex found it needed eight regional sub-variants ("Spanish (Mexico)",
"English (United Kingdom)", "Chinese (Hong Kong)"). Two providers returning a title in two
languages are not in conflict, but the model as stated has no way to say so, and the source
order will pick one arbitrarily. The prompt's own demo has a novel published under
different titles in the UK and US. This is a data-model hole, not a UI concern.

**M3. Scheduling vocabulary for expensive background work.** (084, 085, 006)
Plex uses one tri-state everywhere: **never / as a scheduled task / as a scheduled task and
when media is added**. The prompt mandates "explicit periodic scans" without ever saying
when they run or how the owner controls it. Adopting the tri-state plus a maintenance
window is the smallest complete answer, and it generalises to every expensive job
CanonCore will have (scan, provider refresh, artwork fetch, palette extraction,
projection rebuild).

**M4. A providers screen.** (101, 006)
Four provider tiers are specified, bundled ones ship disabled, and nothing says where the
owner sees the list and enables them. That screen is the entire user-facing surface of the
provider system. Plex's "Online Media Sources" page is the model.

**M5. Client authentication without a password field.** (104, 064)
Browser-delegated sign-in for desktop, link codes for TV. Both reduce to: the client opens
a URL, the browser (already authenticated) approves, the client receives a token. Against a
single-password cookie session this is one route and one token table, and it means no
native client ever implements a password field. Pairs with **session invalidation** and
**password change**, neither of which the prompt mentions and both of which a token table
makes necessary (091).

**M6. Minimum size for rule-derived containers.** (094)
Plex ships "Minimum automatic collection size", tunable between Disabled and 4. The prompt
has rule-derived containers with no floor, so a rule matching one item still yields a
container. One integer, right answer already known, no reason to rediscover it.

**M7. A copy-link affordance.** (082)
The prompt invests heavily in stable addressing — URLs address items, aliases keep merged
ids resolvable forever — and provides no way to obtain a link. One button makes the whole
alias rule visible and is the only "sharing" a single-user instance needs.

**M8. Spoiler-flagged statements.** (097)
A per-statement "obscure until asked" bit. Novel for a *fiction* catalogue in a way it is
not for a media server: a summary of a later story spoils an earlier one, and a chronology
container places them adjacent by design. It is a qualifier on a statement, and the
qualifier table already exists.

**M9. Embedded file tags as a metadata source.** (093, 008)
ID3, Matroska and EXIF tags are metadata with real provenance, and the prompt's providers
are all HTTP URLs, so a file's own tags have no route into the statements table. Plex
treats this as a first-class agent with an explicit all-or-nothing warning ("you're
promising that not only is your entire music library tagged, but also that it's tagged
correctly"). The demo includes music. Note this is *not* the `.nfo` refusal: `.nfo` is a
separate sidecar file the scanner would have to read, whereas embedded tags are inside the
media file the scanner already opens.

**M10. A static-file source shape.** (098)
CMPP requires a source to stand up an HTTP service implementing search *and* lookup. An
XMLTV-style source — a URL returning one document in a published format — is the cheapest
possible way for a third party to contribute, and is excluded by the contract as specified.
Worth a deliberate decision, given the prompt's own first provider exists because its
source has no usable public API.

**M11. Client trust for LAN connections.** (080)
Plex ships a three-state "Allow Fallback to Insecure Connections" (Never / same-network /
Always), defaulting to Never. The prompt's Safe External Fetch boundary governs outbound
fetches only and says nothing about what a client accepts when connecting to a self-hosted
server with no valid certificate. The phone and TV apps will hit this.

**M12. Post-play behaviour.** (081, 079)
"Continue Watching is offered, never auto-played" is stated; what happens when an episode
*ends* is not. Plex's countdown values are worth copying wholesale, including the split
default: 10s on mobile, 15s on TV.

**M13. Variable playback speed.** (102)
A client-side feature costing the server nothing, so no conflict with direct-play-only, and
table stakes for spoken-word audio. The prompt makes audio first-class and cites
Audiobookshelf twice. Increments 0.5x-2x, session-scoped, reset on stop.

**M14. Subtitle offsets, and the file hash as a matching signal.** (086, 087)
An offset is one nullable column on the existing sidecar file row — and it is expressible
only *because* the prompt made subtitles their own file row rather than a property of the
media file. Separately (087): OpenSubtitles keys on a hash built from filesize plus the
first and last 64KB, near-identical to the prompt's file identity hash, used as a *matching
signal to an external service*. The prompt computes that hash and uses it only for
relinking moved files, while separately stating "Shared identifiers then become MATCHING
SIGNALS between providers". The file hash is a shared identifier the model does not
currently treat as one.

**M15. Never-enrich items.** (009, reinforced by 077 and 088)
"This item is mine, never send it to a provider" has no expression in the prompt, and
enrichment reaches all connected providers at once. Home-video and personal-archive titles
would be sent to TMDB. One flag on the item; the privacy consequence of not having it is
concrete.
