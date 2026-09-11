# CanonCore competitive sweep — consolidated findings

STATUS: complete

Source: a 13-file competitive sweep of Plex and Jellyfin (documentation, support KB, marketing site,
source repo, plus two claim-verification passes), judged against `prompt.md`. This document is a
synthesis of those files only — no new research was done.

---

# EXECUTIVE SUMMARY

## Counts

| Section | Contents | Count |
|---|---|---|
| **1. Corrections owed to prompt.md** | C1-C19, plus 2 standing warnings (W1, W2) | **19** + 2 |
| **2. Internal contradictions** | X1-X13 — unbuildable as written | **13** |
| **3. Gaps, deduplicated and ranked** | G1-G87 — Tier A **11**, Tier B **31**, Tier C **45**; plus 16 items dropped as REFUSED | **87** |
| **4. Counter-signals against settled refusals** | R1-R13, plus 7 refusals checked and corroborated | **13** |
| **5. Confirmations** | ~21 claims verified at source, plus F1-F14 independently validated designs | **35** |

**Verification score: no decision in `prompt.md` was falsified.** 15 of 20 Jellyfin claims and 11 of
14 Plex/Emby claims came back clean; every failure was a rotted *reason*, never a conclusion. That is
why Section 1 is not optional — `prompt.md` is the only artefact that survives, and a false reason is
what invites a closed decision to be reopened.

## TIER A in full — structural, cannot be retrofitted, decide before the first migration

The prompt's own rule for this class: *"Per-field provenance CANNOT be retrofitted. The statements
table and the properties catalogue exist from the first migration or they never work."* Every item
below has that shape. **All of it is columns and contract fields — none of it widens the stop
condition.** Convergence = how many of the 11 independent sweep agents found it.

| # | Gap | Conv. |
|---|---|---|
| **G1** | **Session and device identity** — a device row IS the session (`Client`/`Device`/`DeviceId`/`Version`/`Token`). Sole prerequisite for a device list, per-device revocation, a device-code pairing flow for the tvOS remote, per-client display preferences, and play-on-the-TV-from-my-phone. Four header fields and four columns, now. | **9** |
| **G2** | **Language, on every axis** — no `language` on `statements`, none on `title`, **none in the CMPP contract** (adding it later breaks every third-party provider), and no preference cascade. The largest structural gap found. | **8** |
| **G3** | **Technical properties of a file — duration above all — and the analysis stage producing them.** `files` has no duration, container, codec, resolution or track list. Three settled playback rules are inert without it (see X1). | **8** |
| **G4** | **Multi-part media: an ordinal on `files`**, so one edition can span several files in order. Also the only mechanism direct-play-only leaves for serving a client that cannot decode the primary file. | **5** |
| **G5** | **Migration-ladder mechanics** — a version stamp on disk, a floor, a startup refusal, an empty→head CI run, one order across schema and data migrations, a stage per migration, a fresh-install stamp, a declared backup with rollback, and quarantine-and-count for rows that fail to transform. | **4** |
| **G6** | **CMPP has no version.** A contract third parties deploy against cannot be versioned retroactively; a contract with no version cannot evolve. | **4** |
| **G7** | **Artwork has no rank, no dimensions, no per-role limit, no quality floor** — awkward to backfill across thousands of already-fetched images, and the missing pin is the prompt's own refresh-flip failure on the most visible field on the page (X7). | **3** |
| **G8** | **A file may cover several works, and a work may need several files** (`S01E01-E02`; a film as `pt1`/`pt2`). Neither is expressible. Schema-level. | **3** |
| **G9** | **Reversing a merge** — `merged_from`, or a merge record. The prompt calls delete "the one place data is actually lost" and silently puts merge in the same category with no inverse. | **3** |
| **G10** | **Placements carry no `source`** — `browse` yields placements from providers, so the product's central feature is the one thing in the model with no provenance, in a product whose reason #3 for existing is that nobody stores provenance (X3). | 1 |
| **G11** | **Vocabularies have no normalised match key and no notion of a scale** — a `CleanValue` beside every raw value is what makes the archive's 71-value `medium` field actionable rather than merely quarantined. | 1 |

## The three things that most need a human decision

**1 · Is media probing inside or outside the ffmpeg ban?** *(X1 · G3 — found by 8 of 11 agents,
the highest convergence in the sweep)*
As written, three settled playback rules are **inert**: duration is never knowable, so the percentage
fallback is the only completion rule that can ever fire, force-complete-under-five-minutes never
fires, and "when a file will not play, say so plainly" can only be a post-mortem. `files` has no
column for any of it. This needs a person, not an implementer, because all three options change the
schema and the scanner: (a) probing is outside the ban — MediaInfo (BSD-2-Clause) is not ffmpeg and is
the named alternative; (b) duration arrives from the client at playback and is written back; (c) the
three rules are rewritten around what is actually knowable. Nothing in the playback half can be built
until this is answered.

**2 · Does "No fork, no export, no import" forbid backup?** *(R2 · G12 — found by 10 of 11 agents,
the most-repeated finding in the entire sweep)*
Read literally it does, and CanonCore's data — hand-built placements and positions, `rank` favourites,
remembered rejections, merge aliases, owner statements, the watch log — **exists nowhere else and
cannot be re-derived from the files**, which is precisely the property that makes Plex able to tell a
user to delete its database and CanonCore not. Choosing a forward-only migration ladder makes
restore-from-backup the only way back, by the prompt's own logic. Jellyfin's 10.11 backup is scoped so
that it is explicitly not an export, which proves the two are separable. **This is one sentence of
policy that unblocks the largest cluster in the document.**

**3 · How does the Safe External Fetch boundary let the first provider through?** *(X2)*
The boundary must "deny localhost, RFC1918, link-local"; the first provider is "ONE service, run on a
machine the owner controls", which on a home network has an RFC1918 address and in the intended Docker
deployment is often `localhost`. **As written, the boundary denies the provider stop-condition 1
requires.** Left unresolved, an implementer adds an exception under deadline pressure, and an
unprincipled exception to an SSRF boundary is how SSRF boundaries fail. This needs a designed
carve-out with its own rule — an owner-declared allowlist of exact hosts, entered deliberately, never
inferred, never wildcarded — not an exception.

*Runners-up, in order:* **R1** — Plex shipped `.nfo` support in v1.43.1 (article last modified
2026-07-14) after eighteen years of refusing it, for **portability**, and CanonCore's answer to
portability is "no export, no import"; the refusal names a mechanism and never names the problem, which
is the shape of a refusal that gets reopened. **G2** — language, because it is Tier A, eight-way
convergence, and changing the CMPP contract after third parties have deployed against it is not
possible.

## How to read the rest

Sections 1 and 2 are **not optional**: a false reason discredits the document, and an internal
contradiction is unbuildable as written. Section 4 is more important than Section 3 — a gap is
something still to decide, a counter-signal is something already decided whose written reason has been
overtaken. Section 3 is the volume, and only Tier A argues for touching the first commit. Section 5 is
what does not need revisiting.


# 1. CORRECTIONS OWED TO prompt.md

Every claim the two `verify-` files found OUTDATED, WRONG, PARTLY CONFIRMED or MISQUOTED.
Line numbers are against `prompt.md` as read 2026-09-06 (888 lines).
**In every case the DECISION survives; what rots is the stated REASON.** That is exactly why these
are not optional: prompt.md is the only surviving record, and a false reason invites the closed
decision to be reopened.

Sources: `verify-plex-claims.md` (VP), `verify-jellyfin-claims.md` (VJ).

## Must fix — the sentence as written is false or a misquote

**C1 — Jellyfin cross-library collections. WRONG.** (VJ claim 4)
L56-59 says "Jellyfin cannot do it at all, and its three feature requests asking for it have sat
unbuilt for years."
Actually: `BoxSet.GetLibraryFolderIds()` returns a distinct `Guid[]` and `AddToCollectionAsync`
performs no library check — Jellyfin BoxSets *do* span libraries, refuted by four lines of its own
source. And FR #4039 (nested collections) opened **2026-07-16**, seven weeks before the prompt was
written, so "for years" is false of it.
Replacement (VJ's own wording): *"NOTHING GIVES A COLLECTION A SECOND ORDERING. A Plex collection
can only appear to span libraries when the collections carry exactly the same NAME, matched as
strings. Jellyfin's collections do cross libraries, but a collection is one flat membership list
with one global display order, and there is only one Collections namespace — 45 votes have been
asking for a second since 2025."*
Note this is the strongest correction in the set: the reason changes but the *product argument gets
better*, because "one ordering" is CanonCore's actual differentiator, not "no linking".

**C2 — Jellyfin "play count but no dates". WRONG.** (VJ claim 10)
L341-342 says "Jellyfin has a play count but no dates, and Plex's unscrobble zeroes the count."
Actually: `UserData` carries `LastPlayedDate`. It is one mutable date every play overwrites.
Replacement: *"Jellyfin keeps one mutable row per user and item: a play count and a single
`LastPlayedDate` that every play overwrites, and marking something unwatched sets the count to 0
and the date to null. Plex's unscrobble does the same. Neither can tell you that you watched it
three times, or when."*
The corrected version is a **stronger** argument for the event log — both products destroy history
on one click rather than merely failing to record it.

**C3 — Plex episode ordering. OUTDATED.** (VP claim 2)
L51 says "Plex's episode ordering is ONE GLOBAL SETTING PER LIBRARY."
Actually: since PMS **1.40.4 (2024-07)**, with the Plex TV Series agent, there is *also* a per-show
override on the show's Advanced tab (TVDB alternate orders / Flexible Seasons). Source: PlexInfo
(Plex Employee), forums.plex.tv/t/tvdb-alternate-orders/882249, 2024-07-10.
The point survives — Plex still has exactly ONE ordering *in force* at a time; picking TVDB (US)
replaces aired order, it does not sit alongside it. TMDB episode groups are still not implemented.
Replacement: *"Plex allows ONE episode ordering in force at a time — a library default plus, since
PMS 1.40.4, a per-show override — never two orderings at once."*

**C4 — Plex plug-ins "closed in 2018". WRONG clause.** (VP claim 10)
L525-528. 2018 killed the plug-in **directory**, not the framework: the same blog post says "you can
still manually install plugins for the foreseeable future". Python plug-ins and legacy agents kept
working until 2024-07 (Shield first) / 2025-04 (desktop). The 2% figure and the 2025-12-09 HTTP
contract both check out.
Replacement: *"Plex opened plug-ins, shut the plug-in directory in 2018 at under 2% usage, let the
legacy agents rot until they broke in 2024-25, and only reopened in December 2025 as a plain HTTP
contract."*
Also drop "seven years" if precision matters: the real functional gap is one to two years.

**C5 — Plex network-mount quotation. MISQUOTE by one word.** (VP claim 11)
L601 quotes "will typically not work". Plex wrote "content mounted via a network **will also**
typically not work" — support.plex.tv/articles/200289526-library/, last modified 2025-05-04.
The setting is also called "Scan my library automatically", not "Update my library automatically".
Replacement: quote it exactly. Substance unaffected, and Plex's own remedy is the one CanonCore
adopts ("you may have to set a periodical scan or do it manually").

**C6 — Emby's 10-second interval. MISATTRIBUTED, and the direction is backwards.** (VP claim 14a,
VJ claim 18)
L539-540 says "Save every 10 seconds — the industry floor, which Emby states as a requirement."
Actually: dev.emby.media/doc/restapi/Playback-Check-ins.html says progress **"should"** be reported
"Automatically every 10 seconds" — the page contains "should" three times and zero occurrences of
"must", "required" or "need to". Worse, Emby frames 10 s as a **ceiling**: "The server will
automatically increment playback progress every second, so it is not necessary to automatically
report more often than at 10 second intervals." Effective Emby resume resolution is ~1 s.
Replacement: *"Save every 10 seconds — the interval Emby's client documentation tells developers to
report at, and the same figure Plex's own API docs give for LAN/WAN. Jellyfin's web client ships
exactly that interval."*
**And add the half the prompt omits:** Emby's rule is *timer plus immediate report on any user
interaction*. A 10-second timer alone loses up to 10 seconds on a pause-and-close, which is the
common case.

## Should fix — true but overstated, and cheap to make bulletproof

**C7 — "the longest-standing complaint in this category". UNPROVABLE superlative.** (VJ claim 9)
L221 and L483-485. Keep the fact, drop the superlative: jellyfin/jellyfin#6709, opened 2021-10-17,
still open, 39 comments, last activity 2026-09-04, with a fix attempt (PR #17781) closed unmerged
that same day.

**C8 — "smart collections DELIBERATELY cannot be hand-ordered". Unevidenced word.** (VP claim 5)
L198. Both factual halves are confirmed (support.plex.tv/articles/201273953-collections/;
python-plexapi raises `BadRequest('Cannot move items in a smart collection.')`). But no Plex
statement of intent exists, and the 2025-11-19 feature request is open in Feature Suggestions
rather than closed wont-fix. Drop "deliberately", or replace the causal claim with the defensible
mechanical one: *"because a smart collection stores a filter rather than a member list."*

**C9 — "Jellyfin's BoxSet is the only real precedent". Loose citation.** (VJ claim 7)
L435. `Playlist` is the better example (the only Jellyfin container allowing duplicate members AND
hand ordering) and `Folder` is the accurate one. Either say "Jellyfin's `Folder` subclasses", or
cite `Playlist`.
Worth adding alongside as a live counter-example to the prompt's own "eight kinds, no enum creep"
rule: Jellyfin's `BaseItemKind` reached **36 values**.

**C10 — "thousands of strangers" use Jellyfin's hardcoded key. Unprovable.** (VJ claim 14)
L589. Install counts are not published. *"Every default Jellyfin install calls TMDb as the same
customer"* is both stronger and checkable. (The claim is otherwise *understated* — there are three
hardcoded keys, and the per-instance override is hidden.)

**C11 — "a Plex library is typed, and that is exactly what stops a container holding mixed media".
Over-attributed.** (VP claim 4)
L141-142. Facts confirmed (type fixed at creation; four API `section_type` values; collections
raise on mixed types). But three type systems do the work at three levels, and a Photos library
genuinely holds mixed media (home videos alongside photos).
Replacement: *"a Plex library is typed by medium and the type is fixed at creation, and Plex then
repeats that typing at every level below it — a collection by subtype, a playlist by
audio/video/photo."*

**C12 — "files on disk" in the Plex completion example. Loose.** (VP claim 9)
L558. `leafCount` counts episode *metadata items*, not files, and the two diverge both ways (one
episode with several versions = several files, one leaf; one `S01E01-E02` file = one file, two
leaves). Use *"children that exist only because you own a file"*. The 13-episode worked example
itself is CONFIRMED and unconditional.

**C13 — Plex's unscrobble "ZEROES the count". Direction right, mechanism unprovable.** (VP claim 8)
L340-342. `isPlayed` is `viewCount > 0`, so clearing behaviour is *required* for the endpoint to
work at all, and third-party implementers document it as clearing — but no primary Plex source
states it. Say "clears" rather than "zeroes", or cite the documented behaviour instead.
**Carry the caveat in C14 with it.**

**C14 — "every media server surveyed keeps only a mutable state row". Needs narrowing.** (VP claim 8)
L340. The same verification found Plex ships **two** tables: `metadata_item_settings` (state —
`view_count`, `view_offset`, `last_viewed_at`) and `metadata_item_views` (**a history log** —
`viewed_at`, `device_id`, `view_type`, one row per viewing), with Plex's own docs drawing the line:
"'Watch state' is simply the current value … 'Watch history' is the ongoing log of changes to watch
state." So a per-viewing log is not unprecedented; what is absent is any *product surface* built on
it, and Plex's own privacy control wipes it.
Replacement: *"Every media server surveyed reads from a mutable state row. Plex does keep a view
log, and then offers no feature that reads it and a privacy control that deletes it wholesale;
Jellyfin keeps a single overwritten `LastPlayedDate`. The event log is what makes re-watches real."*
This is the one correction that materially changes an argument rather than a citation.

**C15 — the file-identity hash is under-specified for an implementer.** (VP claim 6)
L267. The algorithm is **CONFIRMED and reproduced byte-exactly**, but two things must be stated or
it will be got wrong: (a) the encoding is `SHA1(ascii(decimal size) + hex(SHA1(first 64KB)) +
hex(SHA1(last 64KB)))`, no separators, no trailing newline; (b) the last-64KB term is **omitted for
files of 64KB or smaller**. The "128KB per file" cost figure at L270 is correct for files >128KB.
The "computes it and does not use it to relink moves" irony is CONFIRMED in substance.

## Corrections to claims that live in decisions.md, not prompt.md

Recorded because prompt.md is the only artifact surviving, and these are the versions that must not
be carried forward if any of this text is imported.

**C16 — Plex editions/versions structure. TWO ERRORS.** (VP claim 7)
Editions do **not** have their own GUID — they share a GUID and differ by `ratingKey`. And a
version is another **`media_items`** row, not another `media_parts` row. As written the sentence
names a structure that would predict the *opposite* of the observed behaviour. `edition_title` is
real, and the conclusion — progress per edition — is unaffected and better supported once corrected.

**C17 — Plex's 16-week window is not a resume expiry.** (VP claim 12b)
It is "Weeks to consider for Continue Watching", a per-library admin-configurable **lookback window
for inclusion in the row**, default 16. Nothing documents the stored view offset being deleted.
Describe it as "Plex's default 16-week Continue Watching window (admin-configurable)".
Also: Plex says **"LAN/WAN"**, not "LAN", for the 10-second report interval; only cellular gets 20 s.

**C18 — Emby's shared HTML core is being reversed on playback.** (VP claim 14b)
Since 2024-12 Emby has been moving playback *out* of HTML into native players (Xbox/Windows app,
Linux beta). "AVFoundation" appears in no official Emby source — it is a community inference, as is
"Swift/Objective-C". The clients decision (native Swift on TV) is unaffected and if anything
reinforced; this is the claim in the set most likely to age.

**C19 — the content-addressed Plex analysis bundle. UNVERIFIABLE.** (VP claim 6c)
The bundle path shape is confirmed, but that the addressing hash is `media_parts.hash` rather than a
hash of the item GUID was **not** confirmed, and neither was "thumbnails/BIF survive a move". Do not
promote this into prompt.md.

## Two claim-level warnings the verification raises

**W1 — do not introduce the Jellyfin maintainer quotation.** (VJ claim 16) The sentence "the
database currently uses a person's name as their unique identifier… There's no fix for this
currently until the database has been redesigned" appears **nowhere** in the `jellyfin` GitHub
organisation. The prompt's paraphrase at L681-684 is sound and carries no quotation, so nothing is
broken — keep it that way. Citable substitutes: cvium on jellyfin/jellyfin#3356, 2025-10-20,
"Database has not been redesigned... No work has been done to fix this in 10.11."

**W2 — a search-engine confabulation was nearly absorbed.** (VP claim 8) A WebSearch snippet
attributed to technicalramblings.com a sentence that the fetched page does not contain. It would
have flipped a verdict. Discount it.

---

# 2. INTERNAL CONTRADICTIONS

Places where `prompt.md` contradicts *itself*, or where two of its own settled rules cannot both be
satisfied. These are **unbuildable as written** — an implementer meeting one has to invent a rule,
silently, and the prompt is the only record. Not optional.

Ordered by how early an implementer hits them.

**X1 — Direct play "say so plainly" and the time-remaining completion rule both need data that is
banned from being produced.** *(the largest, found by 8 of 11 sweeps)*
- L532-533: "Direct play only… When a file will not play, say so plainly." Saying so *plainly and
  in advance* needs the file's container, codecs, profile and level.
- L535-542: completion is "TIME REMAINING under a small absolute figure"; "Percentage is the
  fallback only where duration is unknown"; "Force-complete anything under five minutes."
  All three need the **duration of the owner's specific file**.
- L532 bans ffmpeg, and `ffprobe` is ffmpeg. `files` has bytes, a hash, a path and a role — no
  duration, no container, no codec, no resolution, no stream list.
- A provider supplies a *work's* runtime, not this file's, and a private instance may have no
  provider connected at all.
**Consequence:** duration is always unknown, so the percentage fallback is the *only* rule that ever
fires, force-complete never fires, and "say so plainly" can only be a post-mortem after playback
fails. **Three settled rules are inert.**
Resolve by choosing one, explicitly: (a) probing is outside the ffmpeg ban (MediaInfo, BSD-2-Clause,
is the named alternative — it is not ffmpeg and it is already in Plex's dependency list); (b)
duration arrives from the client at playback time and is written back; or (c) the three rules are
rewritten around what is actually knowable.
Found by: GJD, SJA, SJB, SPA, SPB, SPC, SWB, GPD.

**X2 — The Safe External Fetch boundary blocks the first provider.** *(SPC H21)*
L581-584: "ONE Safe External Fetch boundary for every user-supplied URL, and a provider IS a
user-supplied URL… deny localhost, RFC1918, link-local and cloud metadata addresses."
L521-524: the first provider is "ONE service, run on a machine the owner controls" — which on any
normal home network has an RFC1918 address, and in the intended Docker deployment is very often
`localhost` or a container-network address.
**Consequence:** the boundary denies the provider that stop-condition 1 requires. An implementer
will add an exception under deadline pressure, and an unprincipled exception to an SSRF boundary is
how SSRF boundaries fail.
Resolve with an explicit carve-out that has its own rule (e.g. an owner-declared private-provider
allowlist of exact hosts, entered deliberately, never inferred, never wildcarded), not an exception.

**X3 — Placements arrive from providers and carry no provenance, in a product whose reason #3 for
existing is per-field provenance.** *(SWA)*
L179: `placements` is `(id, owner_id, container_id, item_id, position, edition_id)` — no `source`.
L329-331: `browse` "returns a container AND its ordering, so browsing a range yields placements for
free."
L52-55: "NOBODY STORES PER-FIELD PROVENANCE" is a stated reason the product exists.
**Consequence:** the one thing arriving from a provider with no provenance is the ordering — the
product's central feature. There is also no `rank` equivalent when two providers order one container
differently, because `rank` resolves competing values for a *field* and stops at that boundary.
Evidence that orderings are dated, revisable claims by named sources: Disney+ "officially adjusted
its chronology in August 2025 … **replacing** Captain America: The First Avenger" at the head of its
timeline.
This is schema-level and belongs in Tier A (see G3).

**X4 — `title` is a column, but providers propose titles, and columns have neither provenance nor a
favourite.** *(SWB #9, plus the language cluster)*
L366-368: "title, sort_name and release_date are COLUMNS, not statements."
L445-451: "A provider may only propose values for fields that already exist."
L478-482: multi-valued fields, a source order and an owner favourite are the mechanism for every
competing claim.
**Consequence:** two providers proposing different titles — the ordinary case, not the edge case —
have no source order to resolve them, no `rank` to lose to, and no provenance row. The prompt says
columns were chosen because these fields are "always-single-valued", which is exactly what a
multi-language, multi-provider catalogue makes false. Compounded by X5.

**X5 — `medium` is closed at four values including `text`, and every completion rule is a clock.**
*(SJB H7)*
L212: "medium (video|audio|text|image)". L818-822: the demo ships the Harry Potter *novels*.
L535-542: completion is time remaining, saved every 10 seconds, force-completed under five minutes.
**Consequence:** a book's position is a page, a CFI or a byte offset; its save trigger is a page
turn; "under five minutes" means nothing. Either the completion rule gets a per-medium variant — and
the prompt's own "ONE number clears the position; do not add a second" then needs re-reading — or
`text` and `image` editions are declared non-playable, which contradicts them being playback media.
Jellyfin is the worked counter-example: it ships **five** resume constants and needed a second code
path in absolute minutes as soon as audiobooks arrived (`MinResumePct` 5, `MaxResumePct` 90,
`MinResumeDurationSeconds` 300, `MinAudiobookResume` 5 min, `MaxAudiobookResume` 5 min).

**X6 — "The container is navigation state, never in the URL" versus anything that plays next.**
*(SJR C1/C2, GPD H8, SPB G15, SPC H17, SPD)*
L207-209: "URLs address ITEMS. The container you arrived through is navigation state carried
alongside the address, never encoded in it, never identity."
L562-572: container progress, Continue Watching, "offered, never auto-played".
**Consequence:** an item in a Release-order container and a Story-order container has **two**
next-ups, and what determines "next" is exactly the state the prompt refuses to put in the address.
The prompt neither names a next-item concept nor says where the placement context lives once the
player is open. The model makes this answerable — pass the placement id to the player — but nothing
says so, and an implementer will either encode the container in the URL (breaking the rule) or lose
the ordering at the player boundary.

**X7 — Artwork breaks "one pattern used twice, not two patterns".** *(GPD M2, SWA, SJR A5)*
L213-217: `is_default` is the owner's pin, and "Same mechanism as the source order and the field
favourite, deliberately: one pattern used twice, not two patterns."
L344-357: the `artwork` table has role, licence, attribution and palette — and **no rank, no
`is_default`, no pin**.
L483-485: "Do NOT pick the winner by recency: a display that changes after a refresh nobody asked
for is the single longest-standing complaint in this category."
**Consequence:** two providers each supplying a poster gives two rows and no rule for which renders,
on the most visible field on the page — the exact refresh-flip failure the prompt names — and with
uploads and artwork scanning both refused, the owner has no recourse at all. The fix is one nullable
column, at most one per (item, role), and it is the sentence already written for `editions.is_default`.

**X8 — `source` "NAMES A PROVIDER OR THE OWNER", and there is no third kind, but the product derives
claims itself.** *(SWB #4)*
L284-286: "`source` NAMES A PROVIDER OR THE OWNER."
L354: "Extract the palette when the artwork is fetched, onto this row."
**Consequence:** the palette escapes only because artwork is a table with a column rather than a
statement. The moment anything else is computed locally — a marker, a normalised value, a derived
extent, a confidence score, an inferred identifier match — the provenance model has nowhere to put
it, and "where did this come from?" is the question the statements table exists to answer. One
sentence now (a third source kind, `derived`, naming the computation) or a migration later.

**X9 — Stop condition 1 requires honouring a cache rule that the model has no cache to hold.**
*(SPC H4/H5)*
L80-84: done means TMDB working "with the attribution string and the **six-month cache rule
honoured**".
L344-346: artwork is a "Provider-supplied URL" — nothing says the bytes are kept.
There is no scheduler anywhere in the prompt, and an expiry needs a job.
**Consequence:** either nothing is cached, in which case the six-month rule has nothing to expire
and the public demo hotlinks TMDB from each visitor's browser (leaking every visitor's IP to a third
party on the one surface where CanonCore is a publisher); or bytes are cached, in which case there
is an unbudgeted, unbounded image store with no eviction and no job to evict it. The stop condition
cannot be met as written without deciding this.

**X10 — File roles are closed at `media|subtitle|audio|chapters`, and two settled rules need roles
that are not in the set.** *(SJA, GJD)*
L271-272: "Files carry a role: media|subtitle|audio|chapters."
L541-542: "Force-complete anything under five minutes so **trailers** never sit in Continue
Watching" — so trailers are playable things that accrue per-edition progress, with no `extra` role
and no place in the model (an extra is not an edition, because the content differs; and as a
separate `work` item it floods every browse surface, since the browse-exclusion rule filters **by
kind** and an extra's kind is `work`).
L271: `chapters` is a role with no data model, no display and no stated source.
Both halves need one sentence each.

**X11 — "It never stores media: a source is a reference" versus a `files` table keyed on a SHA1 over
local bytes at a filesystem path.** *(GJD, SPB)*
L30-32 reads remote-friendly; L266-270 and L594 ("Build against a FILESYSTEM PATH") read local-only.
The two are never reconciled, so "may a `file` be a remote URL?" has no answer — and the answer
changes the identity algorithm, the scanner and the playback route.

**X12 — Entities are excluded from browsing "by kind", and search is the one surface where all eight
kinds belong.** *(SWB #2, GPD M7)*
L670-680 excludes entity kinds from "work-browsing surfaces" without saying whether search is one.
Read literally by an implementer, it produces a catalogue whose people, characters and places exist
and cannot be found. One sentence fixes it; the ambiguity is in the standing rule, which is the part
of the document most likely to be applied mechanically.

**X13 — "The confidence score MUST be capable of failing" with nothing that could ever observe it.**
*(SWB #14)*
L474-476 states the requirement and gives no mechanism. A scorer capable of failing that is never
measured is indistinguishable from one that is not. Plex runs "a test set of about **60k filenames**
… **every day** and get alerted quickly if our accuracy level were to decrease". The prompt already
mandates a committed deterministic fixture; the cheapest fix is a labelled subset of it with an
accuracy floor asserted in CI — which is the same shape as the two committed tests already required.

---

# 3. GAPS, DEDUPLICATED AND RANKED

Every ABSENT finding across the 11 sweep files, merged. **ABSENT means the prompt says nothing** —
not that it decided against. Anything the prompt explicitly refuses has been removed and is listed
at the end of this section under "Dropped as REFUSED".

**Convergence count** is the number of the 11 sweep files that found the gap *independently* (the
agents could not see each other's work). A gap found by six agents is stronger evidence than one
agent's judgement, and it is recorded for exactly that reason.

Ranked on **retrofittability** first, convergence then severity within tier.

File key: **GJD** gaps-jellyfin-docs · **GPD** gaps-plex-docs · **SJR** sweep-jellyfin-repo ·
**SJA** sweep-jellyfin-site-A · **SJB** sweep-jellyfin-site-B · **SPA/SPB/SPC/SPD**
sweep-plex-support-A/B/C/D · **SWA/SWB** sweep-plex-www-A/B.

---

## TIER A — structural. Cannot be retrofitted. Decide before the first migration.

The prompt's own rule for this class: *"Per-field provenance CANNOT be retrofitted. The statements
table and the properties catalogue exist from the first migration or they never work."* Each of
these has the same shape. **Tier A argues for columns and contract fields, not features** — none of
it widens the stop condition.

**G1 · Session and device identity.** — convergence **9** (GJD, GPD, SJR, SJA, SJB, SPA, SPB, SPC, SPD)
The prompt specifies "a single-password cookie session" and commits to a Next.js web app, an Expo
phone app and a native Swift tvOS app. A cookie is unusable from Swift and from a script. Jellyfin's
shape: the request carries `Client`, `Device`, `DeviceId`, `Version`, `Token`, and **a device row IS
the session** — one table, one token column. That single decision is the sole prerequisite for a
visible device list, per-device revocation without rotating the password, a device-code pairing flow
(RFC 8628 — the only sane way to authenticate a tvOS remote, which the prompt itself calls a known-
bad text-entry surface), per-client display preferences, and "play this on the TV from my phone".
Every one of those is a retrofit if the token is opaque and anonymous. **Four header fields and four
columns, now.**

**G2 · Language, on every axis, including in the CMPP contract.** — convergence **8** (GJD, GPD, SJR, SJA, SJB, SPA, SPC, SPD)
The single largest structural gap in the sweep. The prompt is a bibliographic design; language is a
bibliographic primitive that LRM, BIBFRAME and Dublin Core all carry; it appears in the prompt twice,
both times as an attribute of a subtitle file. Four missing places, one decision:
- `statements` has **no language column** — two synopses in two languages are two indistinguishable
  competing claims and the source order picks one arbitrarily.
- `title` is a column with no language, so the Japanese and English titles of one work cannot be
  peers (see X4). Jellyfin's *abandoned* schema made `ItemMetadata.Language` a **required** 3-char
  column with metadata as a collection per item; its shipped schema has one `Name` column.
- **CMPP has no language parameter and no language in the response.** Adding either later is a
  breaking change to every third-party provider — the definition of a first-commit decision.
- No preference cascade. Jellyfin has three levels (server, library, item); CanonCore's groups scope
  *which providers are asked*, never *what is asked of them*.
Plex needed eight regional sub-variants ("Spanish (Mexico)", "English (United Kingdom)"). The
prompt's own demo has a novel published under different titles in the UK and US.

**G3 · Technical properties of a file — duration above all — and the analysis stage that produces
them.** — convergence **8** (GJD, GPD, SJA, SJB, SPA, SPB, SPC, SWB)
`files` has bytes, a hash, a path and a role. No container, no video codec, no audio codec, no
subtitle format, no resolution, no bitrate, **no duration**, and no representation of the audio and
subtitle tracks *inside* the container — which is the normal case for a real direct-play library.
See **X1**: three settled playback rules are inert without this. Plex runs a distinct **Analyze
Media** pass, separate from the scan and separately logged, producing exactly this field list;
Jellyfin's Android TV client spent years forcing server-side extraction of embedded subtitles.
Decide: what columns hold the result, whether the scanner probes, whether re-analysis is an
operation. Named alternative to ffmpeg: **MediaInfo (BSD-2-Clause)**.

**G4 · Multi-part media: one edition spanning several files, in order.** — convergence **5** (GJD, GPD, SJR, SJA, SPA)
`-cd1/-cd2`, a two-disc film, a 30-file audiobook, a serial split across files. The `files` row has
bytes, an attachment point and a role and **no part index and no ordering**, so two files on one
edition have no play order and progress across parts is undefined. `edition_coverage` cannot supply
it — it describes intervals over the *work's* parts, deliberately. **An ordinal on `files` is the
whole fix.** Note this is also the only mechanism direct-play-only leaves for serving a device that
cannot decode the primary file (Plex calls it a *Version*, distinct from an *Edition*), which makes
it load-bearing rather than a nicety.

**G5 · Migration-ladder mechanics: a version stamp, a floor, a startup check, an empty→head CI run,
staging, and a declared backup.** — convergence **4** (GJD, SJA, SJB, SJR)
The prompt mandates the ladder and stops there. Jellyfin, ten years in, could not keep the same
promise: *"You **MUST be running Jellyfin 10.10.7** before upgrading to 10.11.0 … Upgrading from any
other versions is **NOT supported and WILL fail**."* Its 10.11 migration takes "up to several hours",
scaling with *dirtiness rather than size*, and four months later *"the remaining migration issues …
are unlikely to be resolved"* — some instances are permanently broken and the project says so.
Missing sub-decisions, all cheap in migration 1: the **floor** (oldest version migrated from);
the **check** (refuse to start, not fail mid-ladder); the **test** (empty → head, every release, in
CI); **one order across schema and data-fix migrations**; a **stage** per migration saying how much
of the app must be alive; **`RunMigrationOnSetup`** so a fresh install stamps history applied rather
than replaying repairs against an empty database; and a **declared backup with rollback on failure**.
Plus the pattern the prompt already owns and does not extend here: **a migration that cannot
transform a row quarantines it and counts it**, exactly as enrichment drops unmatched fields at the
door and counts them. One pattern used three times.

**G6 · CMPP has no version, and a contract with no version cannot evolve.** — convergence **4** (GJD, SJA, SJB, SPB)
CMPP is implemented by third parties, in their own repos, on their own deploy cadence, and the
prompt's "Do not preserve backward compatibility" is a rule for *this* repo that cannot govern a
contract other people build against. Frozen-at-creation in the sense a wire protocol is: you cannot
retroactively version somebody else's already-deployed service. Jellyfin's plugin manifest carries
`targetAbi` per version and its major-version trigger is defined entirely as "breaks the HTTP or
plugin APIs", for exactly this reason. The store half (manifest format, acceptance criteria, removal
path, stability channel, a pre-release index because one index cannot serve two contract versions) is
Tier C policy; **the version field in the response is Tier A.**

**G7 · Artwork has no rank, no dimensions, no per-role limit and no quality floor.** — convergence **3** (GPD, SJR, SWA)
See **X7** for the internal contradiction. Four missing columns/decisions, all awkward to backfill
across thousands of already-fetched images: `rank` or `is_default` (which of five posters is *the*
poster); `width`/`height` (Jellyfin stores both — without them no layout can reserve space and a
minimum-size floor cannot be enforced after the fact); a **limit per role** (a provider returns
dozens, and several providers × dozens = hundreds of artwork rows per item, each with a palette, with
no "dropped at the door and counted" equivalent); and a **minimum-width floor** so a thumbnail does
not land as a backdrop. Adjacent and equally cheap now, for the same reason the palette is: a
**blurhash** computed at fetch time onto the row.

**G8 · A file may cover several works, and a work may need several files.** — convergence **3** (GJD, SJA, SPD)
The prompt attaches a file "to item or edition", **singular**. `S01E01-E02` in one file, and one film
split across `pt1`/`pt2`, are both ordinary and neither is expressible. Plex's NFO format supports
repeated `<episodedetails>` blocks for the first case and cannot do the second at all. Schema-level,
so before the first migration. The honest shapes are a file-to-subject join table, or **an interval
on the attachment mirroring `edition_coverage`** — the second is more likely correct, since a double
episode is literally "this file covers parts 1-2" and the interval machinery already exists.

**G9 · Reversing a merge.** — convergence **3** (GPD, SPA, SWB)
The prompt calls delete "the one place data is actually lost" and then puts merge in the same
category without saying so: "the loser becomes a PERMANENT ALIAS and stays resolvable forever". A
mis-merge is the second classic destructive mistake in a catalogue and there is no inverse. Statements
know which *source* asserted them and nothing records which *pre-merge item* they hung off;
placements, editions and files carry no such mark at all. **Reversibility is a schema decision** — a
merge record, or `merged_from` on the re-pointed rows — and the alias table already proves the shape
is affordable. Plex, Jellyfin, Calibre and MusicBrainz all ship split.

**G10 · Placements carry no `source`.** — convergence **1** (SWA) — severity extreme
See **X3**. `browse` yields placements from providers; the ordering is the product's central feature;
it is the one thing in the model with no provenance, in a product whose reason #3 for existing is
that nobody stores provenance. Also needed: what happens when two providers order one container
differently (`rank` resolves competing values for a *field* and stops at that boundary).

**G11 · Vocabularies have no normalised match key, and no notion of a scale.** — convergence **1** (SJR)
Two cheap columns in the `properties`/vocabulary design:
- **A normalised form beside every raw value** (Jellyfin's `CleanValue`), so `Sci-Fi`, `sci fi` and
  `Science Fiction ` match while the original survives for provenance. The same instinct appears four
  times in Jellyfin's codebase. The archive's 71-value `medium` field with ~50 pieces of one-use
  wreckage — the prompt's own stated reason for having `quarantine` — is exactly what a normalised
  key makes *actionable* rather than merely bucketed.
- **A vocabulary that is ordered.** "Is 15 stricter than PG-13" and "is TMDB 7/10 better than RT
  70/100" are not string comparisons. `properties` has datatype, cardinality and validation, and
  nothing that says a lookup is a scale with a min and a max.

---

## TIER B — expensive later, cheap now. Not schema-frozen, but the cost of deferral is real.

**G12 · Backup and restore of the owner's catalogue, and a named data directory.** — convergence **10** (all but SWA)
The most-repeated finding in the entire sweep, from every shard independently. CanonCore's value is
precisely the part that cannot be re-derived: hand-built placements and their positions, `rank`
favourites, remembered match rejections, review-queue decisions, merge aliases, owner `note`
statements and the append-only watch log. Plex can tell a user to delete its database because
everything in it is re-derivable from files plus agents; **CanonCore has no such floor.**
Two things must be written down explicitly:
1. **"No fork, no export, no import, no cross-instance sharing" does NOT cover this.** That refusal
   is about interchange between two live instances, and it makes backup *more* necessary, not less,
   because it removes the second path to the data. Jellyfin's own 10.11 backup/restore is scoped so
   it is explicitly not an export ("can only restore systems on which the backup was originally
   made") — the scoping that keeps the refusal intact.
2. **A forward-only ladder has no recovery without one.** Jellyfin states it flatly: once migrations
   run, the old version cannot read the data, and restore-from-backup is the only way back. Note
   Jellyfin makes restore a **startup mode** (`--restore-archive`), because a database cannot be
   restored from inside an app that is using it.
Also missing and answered by the same decision: where instance state lives on disk (serves backup,
restore, uninstall, the Docker volume, and the disk-footprint question at once).

**G13 · A scheduler: a task registry that is visible, runnable, cancellable, with run history.** — convergence **9** (GJD, GPD, SJR, SJA, SPA, SPB, SPC, SPD, SWB)
The prompt commits to at least six recurring jobs and names none as schedulable: periodic scans
(uncadenced), the **six-month TMDB cache eviction** (a licence term, so the job is a compliance
requirement — see X9), projection reconciliation, provider re-refresh, orphan collection, tombstone
compaction, palette extraction. There is no runner, no manual trigger, no maintenance window, and no
way to see that last night's run failed. Jellyfin's framework is the shape worth copying: keyed tasks,
four trigger types (not cron), persisted triggers overriding code defaults, `MaxRuntimeTicks` on the
*trigger* rather than the task, and a four-value completion status where **`Aborted` ("we never found
out") is distinct from `Failed`**. Plex's is the smallest complete version: one window, one setting,
and a per-pass tri-state of `never | scheduled | scheduled and on add`.

**G14 · What the scanner does when a file it knew about is gone.** — convergence **7** (GPD, GJD, SJR, SJA, SPA, SPB, SPC)
The prompt's DELETE section covers deliberate deletion only. CanonCore is committed to network and
FUSE mounts whose change notifications "will typically not work", and to periodic scans — the exact
configuration where **an unmounted share is indistinguishable from a mass delete**, because a
vanished mount leaves an *empty directory*, not an error. Jellyfin's `Clean up collections and
playlists` task destroys hand-curated playlists on a late-mounting share, unattended, at startup, by
default. Needed: an **offline/soft-missing state on the `files` row** with `last_seen`, a
restore-by-reappearance rule, a scanner refusal to act on an unreadable or suspiciously-empty root,
and a hard rule that a scan never deletes catalogue rows. CanonCore's position is *better* than
Plex's here once written — items are media-independent, so a vanished file tombstones the **file**
and leaves the item standing — and content-hash identity makes relinking a moved file strictly
better than Plex, but only if the row survives long enough to be relinked.

**G15 · Inbound transport, LAN discovery, and reaching the instance from outside.** — convergence **8** (GJD, GPD, SJA, SJB, SPA, SPB, SPC, SJR)
The SECURITY section is built entirely around **outbound** fetches. Nothing describes inbound TLS,
how a phone or TV finds the server without typing a URL, or what a client does when a certificate
cannot be validated. This bites hardest exactly where the prompt has already committed: a native tvOS
client faces App Transport Security, which is stricter than the TV platforms that forced Plex to ship
an explicit "Allow Insecure Connections" client setting. Two decisions belong here: **whether a
"networks allowed without auth" LAN bypass exists** (every product in this category has one, it is
how these servers get exposed, and an implementer will add it unless told not to), and a binding rule
that any future protocol surface goes through the same access control as the opaque-id playback route.

**G16 · Logging, diagnostics and a one-click log bundle.** — convergence **8** (GJD, GPD, SJR, SJA, SPA, SPB, SPC, SPD)
No logging at any level. The primary failure modes are remote providers timing out, scans not finding
files, and a confidence scorer misfiring — none observable without logs. It also blocks G17, since
external brute-force protection works by reading log lines. For self-hosted software the logs must be
reachable **from the UI**, not only from a shell the owner may not have, and it must work when the app
is what will not start. The repo's own principle is "report status with evidence". Version display is
diagnostically load-bearing here because of the forward-only ladder ("which version, which migration").
Prefer SPD's framing: **a persisted per-run job record** (what ran, when, how many applied, queued,
dropped and why, what failed) over log files — queryable, per-run, and it already half-exists in the
prompt's "this provider sent 340 things we have no field for".

**G17 · Login throttling, lockout, and credential recovery.** — convergence **6** (GJD, SJR, SJA, SPA, SPB, SPC)
One password is the entire inbound attack surface, and the prompt hardens only outbound fetches.
**Do not copy Jellyfin's lockout**: it has no rate limiting at all, and its lockout is off by default
and sets a permanent flag an *admin* must clear — with one owner and no second account, a copied
lockout is an unrecoverable self-denial of service. The two mechanisms that fit are the two Jellyfin
lacks: throttle by source IP (depends on G18) and exponential backoff on the password check. Worth
copying: a self-describing PHC-style hash string plus **rehash-on-login**, so raising the iteration
count later is a one-line change rather than a forced reset.
**Recovery is the half that is not optional.** No signup means no email means no reset: a forgotten
password is permanent loss of a catalogue that cannot be re-derived. The answer must be local and
physical-access-gated — a CLI command, a boot-time secret, or a documented row — and it lands in G26.

**G18 · Trusted proxies / `X-Forwarded-For`, and serving under a subpath (`basePath`).** — convergence **6** (GJD, SJR, SJA, SJB, SPA, SPC)
Two deployment decisions that are cheap early and painful late. Without known-proxy configuration
every request appears to come from `127.0.0.1` and **any** rate limit, LAN check or audit log is keyed
on the wrong address — so G17 depends on it. And self-hosted software goes behind a reverse proxy on a
shared domain as a matter of course: Next.js supports `basePath`, but only if it is set before
anything hard-codes `/`; retrofitting means auditing every route, every asset path and the API client.

**G19 · Provider disconnection and retirement: what happens to its statements.** — convergence **6** (GJD, SJR, SJA, SPB, SPD, SWB)
Provenance is the product's central claim, and the prompt never says what disconnecting a provider
does. The three plausible answers — delete its statements, keep them as historical claims, keep them
but stop them winning — are all defensible and produce visibly different catalogues, so an implementer
will pick one silently. If it defaults to a cascade delete, **the provenance design's main advantage
is thrown away at the one moment it pays off**, and the failure is silent data loss. Also: `providers`
needs a `retired` state like every other vocabulary, and the source must stay resolvable forever the
way a merged id does. Plex's cautionary case: it switched music providers in 2019 with a hard cutover
and frozen content, because it had nowhere to record which agent supplied what; correcting one bad
agent's contributions required **deleting and re-adding an entire library section**. Under CanonCore
that is `DELETE FROM statements WHERE source = X` — which is the single best argument in the sweep for
the statements table, and it only works if someone writes the rule down.

**G20 · First run: how the one `owners` row and its password come to exist.** — convergence **6** (GJD, SJR, SJA, SPA, SPB, SPC)
"ONE row. Single user, one password, no signup" never says how the password is first set, what the
app does between `docker run` and the owner existing, or what stops that pre-setup surface being an
open door — the "unclaimed media server" problem, which Plex manages with a claim token and Jellyfin
treats as a security hole. Jellyfin's answer is one flag (`IsStartupWizardCompleted`) read by an
authorization policy, so setup and administration share endpoints and there is exactly **one place the
door can be left open**. The same flag gates the fresh-install migration stamp (G5). Note also that a
first-run *wizard* does not reopen the enrichment refusal: "It is NOT A WIZARD" is scoped to
enrichment, and a once-per-install linear flow is the one place a wizard is legitimate.

**G21 · Concurrency caps, and contention rules between the scanner, enrichment, the projection
rebuild and progress writes.** — convergence **6** (GJD, SJR, SJA, SJB, SPC, SWB)
Enrichment "reaches ALL connected providers at once" for every item, in the background, with no cap —
an unbounded fan-out that will rate-limit TMDB on the first bulk import, **against a key the owner
supplied, under terms the product is responsible for honouring**. Three more unbounded fan-outs: the
scanner, the wholesale projection rebuild, and per-artwork palette extraction. Jellyfin's years-long
"database is locked" plague was self-inflicted: *"a bug in its parallel task limit which resulted in
exponential overscheduling of library scan operations"*, invisible for years because it only
manifested on some machines. And the 2008 Plex post-mortem names the exact failure mode CanonCore is
set up for: *"the scanner thread creates a big-ass database transaction inside which it does tons of
time-consuming things like network scraping. This means that no other database operations can run,
like saving where you were in a file for resuming"* — against a 10-second progress save.
Jellyfin's contention rule is worth copying verbatim: heavy jobs open with `if (IsScanRunning) { log;
return; }` — **skip, do not queue**, because a queue of deferred heavy jobs all firing when the scan
ends is worse than skipping. A rate/concurrency limit **declared by the provider and honoured by
CanonCore** is the contract-level half: a limit living only in a provider's own repo cannot protect a
source that two groups both ask.

**G22 · Subtitle and audio tracks beyond language: kind, format, encoding, selection, acquisition.** — convergence **6** (GJD, GPD, SJA, SJB, SPA, SPC)
The largest single cluster in the sweep, and direct-play-only makes it sharper rather than softer. The
sidecar carries "the file it accompanies plus a language" and nothing else. Missing: `forced`, SDH/CC
and `default` as **kinds** of track orthogonal to language (language alone cannot distinguish English,
English (forced) and English SDH — picking blind gives signs-only subtitles for a whole film); the
format axis (SRT vs ASS vs PGS vs VOBSUB, where the last two are unplayable wherever the client cannot
render them, since burn-in needs the transcoder the prompt refuses); a text-encoding column or
detection step (mojibake is silent); a preferred audio and subtitle language; automatic track
selection of any kind; and provider-supplied subtitle acquisition. A track-purpose value would also
make an audio-description track distinguishable from a second dub — the cheapest accessibility win
available.

**G23 · Client capability negotiation: how anything knows a file will not play, before play.** — convergence **5** (GJD, SJA, SJB, SPB, SPC)
The server half of X1. The prompt reasons about codecs entirely on the client and never says how the
*server* learns what this client can decode. Plex publishes a per-client profile that is a
**conjunction** over container, video codec, codec level, framerate, bit depth, audio codec, channels,
resolution and subtitle format — varying per client, per hardware generation within a client, and per
container within a device (the same codec permitted in MKV and refused in MP4 on one console). Two
details make it urgent: on PlayStation **any subtitle at all disqualifies direct play**, and devices
lie ("Sometimes you have media Roku believes it can directplay, but can't"). With no transcoder there
is no fallback, so the comparison must happen before the play button is offered.

**G24 · A refresh verb with modes, a cadence, conditional requests, and a gap-fill job.** — convergence **5** (GJD, GPD, SJR, SPA, SPC)
Enrichment is described as a one-way background process. A catalogue needs three distinct operations
and the prompt names none: "check this one again" (per-item manual), "check only what is still empty"
(the cheap job that makes a large catalogue maintainable), and "re-ask everything and overwrite". The
prompt also promises "re-ordering the source list re-picks the whole catalogue at once" — that *is*
Refresh All, and it has no name, no trigger and no scope. Two mechanics make it survivable at 373,513
rows: a **conditional request** on the CMPP lookup (ETag / `If-Modified-Since`, Jellyfin's
`IHasItemChangeMonitor.HasChanged`), and a **priority** so the item the owner is looking at now jumps
ahead of the rest. Also needed: the timestamp distinction `date_last_refreshed` (when a provider last
spoke) versus `date_modified` (when the record changed) — without it a cadence is not implementable.

**G25 · Un-match: retracting a binding that was accepted and has since proved wrong.** — convergence **5** (GPD, SPA, SPC, SWA, SWB)
The prompt requires `lookup` *precisely because* "a refresh by search can silently rebind a record to
the wrong thing", so a wrong bind is anticipated as the hazard — and the corrective operation is never
specified. An item that matched above the high bar and matched **wrongly** now silently carries
another work's statements. "REJECTIONS ARE REMEMBERED" covers a match not yet applied; nothing detaches
one already applied, and the three outcomes for the statements it wrote (delete, mark stale, leave) are
materially different. Plex has treated unmatch as first-class since 2010 and ships filename match
hinting alongside it; manual identifier entry is the same escape hatch from the other end, and is also
absent.

**G26 · An operational entry point that is not the web app.** — convergence **5** (GJD, SPA, SPB, SPC, SJR)
Every operation a locked-out, broken or headless instance needs has no home: scan, reindex, rebuild
the projection, restore a backup, reset the password, run a scheduled task on demand. Plex ships
`Plex Media Scanner --scan --refresh --analyze --index`. This is where G12, G17's recovery half and
G13's manual triggers actually land, and a scanner that must run periodically currently has no
non-browser trigger at all.

**G27 · Embedded media tags as a metadata source — and this is NOT the `.nfo` refusal.** — convergence **5** (GJD, SJA, SPC, SPD, SWB)
Recorded emphatically because it is the item most likely to be dropped by mistake. `.nfo` is a
**separate sidecar file the scanner would have to open**; ID3, Vorbis comments, Matroska tags, MP4
atoms and EXIF are **inside the media file the scanner already opens**, and none of them is named in
any refusal. The consequence is much larger than the artwork one the prompt does state and accept: a
private instance with no provider connected gets **no track titles, no album, no artist, no track
numbers** — the prompt says such an instance has no artwork; it does not say it has no titles. The
demo includes music. Plex treats this as a first-class agent with an explicit all-or-nothing warning.
Decide it either way; the silence is what is wrong.

**G28 · Setting watch state by hand, and importing a watch history.** — convergence **5** (GJD, GPD, SPA, SPB, SWA)
Progress is an append-only event log, and "mark as watched" / "mark unwatched" have no defined event.
It has to be a synthetic event, and its shape — source, timestamp, whether it is distinguishable from
a real one — is a decision the event-log design forces. The prompt criticises Plex's unscrobble without
saying what replaces it. A catalogue seeded from an existing archive needs **bulk** mark-watched on day
one, and cascading down a container is the same question at scale, interacting with the dedup rule.
Separately: importing watch state from another product is *unspecified rather than refused* ("no
import" is scoped to CanonCore-to-CanonCore), and a catalogue nobody can move into is a catalogue
nobody adopts. Plex's iTunes importer moved play counts, skip counts, ratings and addition dates — and
records a **skip** as its own event with its own count and date, which the prompt's log names nowhere.

**G29 · Artwork bytes: cached, resized, or hot-linked?** — convergence **5** (GJD, SJA, SJR, SPB, SPC)
The palette is extracted "when the artwork is fetched", so the bytes are already downloaded once, and
nothing says whether they are kept. See X9. Hot-linking leaks every viewer's IP and browsing to TMDB —
**including on the public demo, the one surface where CanonCore is a publisher** — breaks permanently
when a provider rotates a URL, and ships no thumbnails. Caching reproduces Plex's problem where
artwork dominates the data directory. A TV grid of 60 posters and a phone list want different bytes,
which is why Plex keeps a separate on-demand resize cache. This is a **legal** posture as much as a
performance one: TMDB grants no rights in images, so the fetch belongs to whoever holds the terms.
Cheapest coherent answer: fetch once, derive palette, cache two sizes, serve from the app behind an
immutable content-hash URL — but it must be chosen.

**G30 · Extras and bonus material have no construct.** — convergence **5** (GJD, SJR, SJB, SWA, SWB)
A trailer, featurette, interview, deleted scene, One-Shot or lyric video is not an **edition** (the
content differs, failing the prompt's own adaptation-versus-edition test), is not an **adaptation**,
and as a separate `work` item floods every browse surface — because the browse-exclusion rule filters
**by kind** and an extra's kind is `work`. See X10. This is where "ADAPTATION VERSUS EDITION" stops
being decidable: *a trailer is neither a rendering of the film nor based on it*, so "Ask what changed:
the content, or the rendering" does not answer it — and it is the first question a real film catalogue
asks. Both Plex and Jellyfin ship a dedicated extras concept because neither the item nor the edition
axis holds it; Jellyfin needed a migration (`CleanupOrphanedExtras`) and a de-duplication routine to
clean up getting it wrong.

**G31 · Scan exclusion, an accepted-format list, and the scan's own timing hazards.** — convergence **5** (GJD, SJR, SJA, SPA, SPB) *(timing half: SJR, SWB)*
"The scanner takes media files and playback sidecars, and nothing else" names **no accept-list and no
exclusion mechanism**. Every real library has samples, extras, OSTs and work-in-progress directories;
without an exclusion the owner deletes junk item by item. An accept-list matters more under
direct-play-only, because a format the product will not play should be refused at the door with an
explanation rather than catalogued and failed at press-play. Put the exclusion **in a table beside the
scanner root, not in a dot-file on the media volume** — Jellyfin's version has to live on the media,
which is the third instance of its recurring "negative decisions do not survive" bug.
The timing half has teeth and is the sharpest single finding in this entry: **file identity is a hash
over the first and last 64KB, so hashing a file that is still being copied mints a wrong, permanent
identity.** The prompt covers notifications that never fire and not notifications that fire too early.
Jellyfin debounces 60 s; Plex "wait[s] until the changes stop before kicking off the scan". Also
missing: incremental versus full as distinct operations with a way to force one (mtime-based
incremental silently misses a file that was mid-copy), and a scan-new-media-first ordering.

**G32 · Deleting must not destroy the watch-event log.** — convergence **1** (SJR) — severity high
The best single idea in the sweep. When an item is deleted Jellyfin **detaches** its user data and
holds it for **90 days**, so a file removed and re-added restores your progress. CanonCore's DELETE
section previews counts and then removes, and says nothing about `progress` or watch events for a
deleted edition. Given the prompt's own position that the event log is the truth and "the event log is
what makes re-watches real", destroying it on delete is the one irreversible loss in a product
otherwise built on aliases and tombstones.

**G33 · Pagination and a list-row-versus-detail-row shape in the shared contract.** — convergence **4** (GPD, GJD, SJR, SJB)
Every Plex list response carries `offset`, `size`, `totalSize`. CanonCore has an 11,285-item stress
dataset with a 4.5M-edge graph and one oRPC contract consumed by three clients: **retrofitting cursors
across a shared contract package is the expensive kind of change**, and offset pagination degrades
exactly at 373,513 rows. The second half is the same decision: an item payload is assembled from a
statements table plus a projection, and nothing says what a **list row** is versus a **detail row**, so
without a sparse-fieldset concept every list request materialises every statement for every row.
Cheap and adjacent: alphabet-jump (`nameStartsWith`), because a remote control cannot scroll 11,285
stories.

**G34 · Path substitution, root relocation, and moving an instance.** — convergence **4** (GJD, GPD, SJR, SPA)
"PATH IS LOCATION, NOT IDENTITY" solves a moved **file**; it does not solve a changed **root**
(`/media/raid` → `/mnt/media` after a container migration), nor the same library reachable at two paths
(a Docker bind mount versus the host). Direct-play-only makes CanonCore *more* exposed to this, not
less. Adjacent: the URL a **client** should use is not the URL the server listens on.

**G35 · Provider health: a durable degraded state, not a per-request failure.** — convergence **5** (SJR, SJA, SPA, SPC, SWA)
A provider is a user-supplied URL, reached for every item, in the background, with no circuit breaker
and no state recording "this has 500'd on the last two hundred calls". Unmatched provider *fields* are
"DROPPED AT THE DOOR AND COUNTED" so the owner is told; nothing does the same for a provider that
errors, times out, rate-limits or returns nothing usable — so a silently failing provider is
indistinguishable from one with nothing to say. Jellyfin records `Malfunctioned` as a first-class
state. Pairs with a **failure taxonomy for the Safe External Fetch boundary**: a blocked address, a
TLS chain broken by a corporate MITM proxy, a skewed clock, a timeout and a size-cap trip all present
identically as "the provider does not work" (and clock skew separately corrupts `observed_at` ordering
and the six-month expiry, so a clock check earns its place).

**G36 · Provider response caching and per-provider configuration.** — convergence **5** (GJD, GPD, SPA, SPB, SPC)
The only caching statement is TMDB's six-month **maximum**, which is a licence term rather than a
design: no cache location, no key, no TTL, no eviction, no way to bust one. The two required providers
have deliberately opposite properties (local/unlimited versus remote/rate-limited/capped), which is
exactly the case a per-provider cache with a per-provider TTL exists for — and stop-condition 4 asserts
"same failure modes" across both, where **a cache is a failure mode**. Separately, providers cannot
declare configuration options of their own; Plex's own new CMP contract lists this as a known gap.

**G37 · Never put a credential in a URL, and the opaque-id playback route is where it lands.** — convergence **3** (GJD, SJA, SPB)
A token in a query string is logged by every proxy in the path, sits in referrer headers, and is what
forces Jellyfin's operators to write log-censoring rules; Plex's token-in-a-query-parameter is the
named anti-pattern. This bears directly on a mechanism the prompt *does* specify — playback "through an
app-owned opaque-id route" — and on any future casting/single-item-access flow, all of which want the
same primitive: **a short-lived, scoped capability URL**. Whether the opaque id is bearer-capable and
time-boxed is cheap to decide now and expensive later.

**G38 · One rule format, wanted by three features.** — convergence **1** (GPD) — severity high
The prompt names rule-derived containers as a core concept and never says what a rule *is*, how it is
stored, or what it can express. Smart-container membership, the server-driven filter UI, and (at
multi-user) share restrictions all need the same thing: a serialisable boolean predicate over
statements. Plex has one (filter URIs with and/or trees). Deciding it once serves all three; deciding
it three times gives three dialects, and stored rules are data that has to survive migrations.

**G39 · The confidence score has no measurement, and accessibility has no posture.** — convergence **2** (SWB; SPC + SJB)
Two unrelated Tier B items, both of the "cheap to state now" kind.
- *Confidence measurement*: see **X13**. A labelled fixture with an accuracy floor asserted in CI.
- *Accessibility*: no statement, no keyboard-navigation commitment beyond "every accelerator has an
  equivalent visible UI path", no screen-reader posture, no contrast rule — the last notable because
  **the palette is extracted from artwork and presumably drives UI colour**. The prompt already
  front-loads design tokens as plain TypeScript *because* such things are expensive to retrofit; this
  is the same class, across three clients, one of which is a TV app whose entire interaction model is
  focus traversal.

**G40 · Per-capability provider selection, and per-kind source order.** — convergence **3** (GJD, SJR, SJB)
The prompt closed the *ranking* question with a good argument — a per-**group** source order gives two
answers for one field on one page — and that argument does not reach two adjacent questions it never
asks. **Per-capability**: "trust TMDB for artwork, the wiki for titles" is the split every system in
this space ends up needing, and Jellyfin ships it at three levels of granularity (metadata, lyrics,
segments) without hitting the two-answers problem. **Per-kind**: an item has exactly one `kind`, so a
per-kind order has a single answer per page. Both deserve an explicit refusal rather than silence.
Note artwork sits outside the source-order mechanism entirely, so "which provider's poster wins" is
undecided independently of this (see G7).

**G41 · Reading the watch event log, and its write volume.** — convergence **1** (SPC)
The append-only log is justified because "the event log is what makes re-watches real", and the only
reader named anywhere is the state row behind Continue Watching. No history view, no "when did I last
watch this", no re-watch count, no per-item timeline: **the product pays the full cost of event
sourcing and spends none of it.** Second half, forced by the prompt's own number: "Save every 10
seconds" is 720 writes per two-hour film, and whether those are 720 rows or one moving row is the
difference between 360 rows/hour/viewer and 1. That is a decision, not an implementation detail.

**G42 · Manual reordering semantics.** — convergence **1** (GPD)
"Move after X" versus rewriting integers, and how positions rebalance. The prompt fixes `position` and
deliberately allows two items to share one, and says nothing about the insert-between case, which is
where the choice of integer versus fractional/lexicographic ordering is made — and that choice is
close to schema-frozen. Adjacent and cheap: m3u-style bulk ordering import, since building a
200-position chronology by hand is the most tedious act in the product.

---

## TIER C — additive. Can be built any time. Listed so the omission is deliberate, not forgotten.

Ordered by convergence. One line each; the source files carry the argument.

| # | Gap | Conv. | Files |
|---|---|---|---|
| G43 | **Bulk operations / multi-select.** Nothing in the prompt acts on more than one row — not a statement across many items, not placing many items in a container, not retiring a vocabulary value across the rows using it, not re-running enrichment over a selection. The fixture is 11,285 stories, 93.4% multi-placed, with a `quarantine` state whose entire purpose is to collect rows to be fixed **in bulk**. Also: no preview-with-counts for a bulk destructive action, where DELETE's care is needed most. | 6 | GPD, SPA, SPB, SPC, SWA, SWB |
| G44 | **Next-up / adjacent / play queue / post-play.** See **X6** — under multi-placement "next" has one answer per ordering. Plex's transferable constants: post-play only above five minutes and never for trailers (the same five-minute figure CanonCore chose independently), asymmetric skip (back 10, forward 30), countdown 10 s mobile / 15 s TV, and auto-advance suppressed after two hours without interaction ("passout protection") — which against an append-only log defined as the truth is **data corruption**, not just annoyance. | 6 | GJD, GPD, SJR, SPB, SPC, SPD |
| G45 | **Media segments / markers: typed provider-supplied intervals over an edition's timeline** (intro, recap, outro, credits, ad). CanonCore has intervals without provenance (`edition_coverage`) and provenance without an interval datatype (`statements`); nothing says which this is or whether it is a third table. The prompt's own "coverage EXPRESSES MISSING PARTS" rule implies markers are *not* coverage — worth writing rather than leaving to the first implementer. Copy two things: the server stores facts and the client decides the action, and the segment is provider-supplied so it arrives as a disputable claim. | 6 | GJD, GPD, SJR, SJA, SJB, SPA |
| G46 | **Packaging, distribution, a container image with a tag policy, and an update path.** "SELF-HOSTED software" with a Postgres dependency and no documented way to install it is not yet self-hostable; Jellyfin documents eleven paths. A no-backward-compatibility rule needs a tag that pins a major line. | 7 | GJD, GPD, SJA, SJB, SPA, SPC, SPD |
| G47 | **i18n of the application itself**, stated as a decision either way, and kept **separate from metadata language** (G2) — which language the chrome is in and which language you want synopses in are independent settings. RTL and non-Latin item titles are the same axis. | 5 | GJD, SJA, SJB, SPC, SPD |
| G48 | **Offline download of the original file.** Survives the no-transcoding rule (it is a byte copy) and is worth *more* to CanonCore than to Plex for a reason the prompt itself creates: with no transcoding, a phone that cannot decode a file cannot play it at all, and a pre-fetched copy is one of the few answers left. It is also the only story for playback with no network. Whether bytes may leave the server is a real product decision and refusing it explicitly is a fine outcome. | 5 | GPD, SJB, SPA, SPB, SPC |
| G49 | **Outbound events / webhooks / notifications.** "The owner is told" appears repeatedly with no mechanism — no in-app inbox, no webhook, no email — for the review queue, dropped-field counts and provider failures. CanonCore already stores the hard half (a change sequence on every table, plus a watch event log that is better scrobbling material than anything Jellyfin has) and never says it is emitted. The Safe External Fetch boundary applies directly. | 5 | GJD, GPD, SPA, SPC, SWA |
| G50 | **A settings surface and an owner-preferences store.** The prompt names at least seven values as tunable — both enrichment thresholds, the source order, the edition order, the completion threshold, the save interval, scanner roots, the scan interval — and gives none of them a place to live. Includes a **providers screen**: four provider tiers are specified, bundled ones ship disabled, and nothing says where the owner sees the list and flips them. That screen is the entire user-facing surface of the provider system. | 4 | GPD, SPA, SPC, SPD |
| G51 | **Casting / play-on-another-device / remote control**, and the three-party session it needs — the opaque id must be handed to a device that never authenticated as the owner, and progress arrives from a party that did not request playback. Ties directly to G1 and G37. | 4 | GPD, SJB, SPA, SPB |
| G52 | **Health endpoint semantics, a startup status page, and a `503` + `Retry-After` contract** so three clients do not each invent a retry policy. Jellyfin warns a naive health check lets a watchdog kill the server mid-migration; its Startup UI exists because a migrating server otherwise "appear[s] dead". | 4 | GJD, SJR, SJA, SJB |
| G53 | **Owner rating.** Fits the statements model exactly (a `rating` statement sourced to the Owner, rank preferred), is one seed property plus a control, and every comparable product has it. Its absence from the seed dozen reads as oversight rather than decision. Note Plex's NFO `<ratings … default="true">` is Wikibase rank badly — independent confirmation the design is right. | 4 | GPD, SJR, SPB, SPD |
| G54 | **Licence for CanonCore's own code, a legal footing, a mark policy, an About/Credits page, and a telemetry stance.** All four presuppositions of the prompt (self-hosted software, a public demo where CanonCore publishes, a CanonCore organisation, a CMPP store that "ACCEPT[S] rather than open[s]") need a licence and an entity that are never named — without a mark policy the store has no basis to accept or refuse anyone. Three licence obligations are already accepted (TMDB's attribution "shown prominently" in an About or Credits section, per-artwork licence strings, CC BY-SA on anything published from the archive) and none has a home. The telemetry stance is worth making as a plain **negative** claim: *an instance calls out only to the providers its owner configured* — the cheapest trust guarantee available, and exactly what self-hosters check. | 4 | SJA, SJB, SPB, SPC |
| G55 | **Push channel for background progress** (scan, enrichment, projection rebuild) across three clients, with no way to learn a page is stale; plus **exposing the change sequence**, which the prompt mandates on every table and never says is emitted — the entire point of having one. | 4 | GJD, GPD, SJR, SJA |
| G56 | **Database maintenance, retention and GC**: VACUUM/ANALYZE for an append-heavy statements table the prompt expects to reach millions of rows; log and cache retention (self-hosted software that never prunes its logs fills a disk); GC for tombstones, superseded projection revisions and orphaned derived artefacts. Plus **config/data/cache/log as four independently relocatable directories**, which determines what a Docker user mounts and what is safe to wipe. | 3 | GJD, GPD, SJR |
| G57 | **Minimum size for rule-derived containers.** Plex ships it tunable between Disabled and 4. Without a floor, an imported catalogue fills with one-member containers. One integer, right answer already known. | 3 | SPA, SPC, SPD |
| G58 | **A server-driven filter and sort vocabulary, derived from the `properties` table.** The prompt calls `properties` "THE LOAD-BEARING TABLE" and holds datatype, value-kind, cardinality and validation — and never says that table drives a filter UI. With a product-extensible field set and three clients, a hardcoded filter list cannot work. Adjacent: an A/Z jump bar and filter choices with counts, at 11,285 items. | 3 | GPD, SJB, SPC |
| G59 | **Multi-value import splitting with a delimiter allowlist.** `"Lennon/McCartney"` splits and `"AC/DC"` must not; `"Action, Sci-Fi/Fantasy"` becomes N vocabulary values. The archive's Semantic MediaWiki properties are exactly this shape, so it lands on the first import, and it is what feeds `quarantine`. Cheap adjacent win: autocomplete on value entry, which stops the owner hand-creating the next near-duplicate. | 3 | GJD, SJR, SPB |
| G60 | **A LAN-only access tier, and an explicit decision on an auth bypass.** CanonCore has two tiers (owner, public demo); "on my LAN, no login" is the posture most single-owner installs want, and a policy decision that has to exist before routes are written. | 3 | SJR, SPB, SPC |
| G61 | **Sizing and hardware guidance, including Postgres on a NAS.** Nothing states what an instance needs. "No transcoding" is a genuine selling point that only lands once the floor is stated — Plex's own no-transcode row is Atom-class, and every NAS-targeted competitor ships SQLite because a consumer NAS is the modal deployment, while CanonCore fixes Postgres. Direct-play-only makes CPU need near zero, so the database is the whole requirement. | 3 | SPA, SPB, SPC |
| G62 | **Household profiles, when multi-user eventually arrives.** Recorded, not proposed. The note is that the first real need is **profiles, not accounts** — no credential, no email, no independent session, existing only to separate progress — which is a much smaller migration than `owner_id`-everywhere anticipates. Two constraints for that day: a grant must enumerate groups rather than mean "all groups" or it silently widens as content is added; and per-library sharing versus "groups are never walls" is an unresolved tension the migration will hit. | 3 | GJD, GPD, SPB |
| G63 | **Deprecation window, client floor, and a minimum-version handshake.** "Remove obsolete paths" is correct pre-release and wrong the moment anyone else runs it. Jellyfin's pattern: announce one release ahead, ship a flag that lets clients test with the removal already applied, then remove — and it still could not enforce an auth deprecation on schedule because its own clients lagged. | 3 | SJA, SJB, SPC |
| G64 | **A provider can only return statements and artwork — never a file.** Subtitles, theme music and lyrics are provider-supplied assets carrying a licence and an attribution exactly as artwork does, and there is no third table. The refusals do not cover this: "no artwork uploads/scanning" governs artwork, and "the scanner takes media files and playback sidecars" governs **disk**, not the network. Subtitles-on-demand is the most-requested feature in this category. | 3 | GJD, GPD, SWB |
| G65 | **Server-side directory picker, and the second security boundary it needs.** Somebody has to enter scanner-root paths, usually for a server in Docker whose view of the filesystem is not the user's. It is also an authenticated directory-listing API over the whole host — and the Safe External Fetch boundary covers outbound URLs only. | 2 | GJD, SJR |
| G66 | **Server-stored display preferences, per user per view per client.** A shelf sorted on the phone comes up sorted on the TV. With `localStorage` unavailable on tvOS this is the only place that state can live, which makes it an API and schema decision rather than a screen decision. | 2 | GJD, SJR |
| G67 | **Spoiler control**, and spoiler-flagged statements. Structurally harder *and* more valuable here than in a media server: a chronology or story-order container is a spoiler surface **by construction**, "Also appears in" reveals which orderings a thing belongs to, and the two-figure rollup reveals how much of a work exists. It is a qualifier on a statement and the qualifier table already exists. | 2 | SPB, SPD |
| G68 | **Trash / undo / restorable tombstones.** Tombstones exist on every table and nothing says one is user-visible or restorable. Also unstated: **whether "Delete permanently" touches the bytes on disk** (the "scanner NEVER writes storage" rule is scoped to the scanner) and what cleans up everything derived from a deleted row — projection, artwork rows, cached bytes, the ancestor closure, statements whose subject placement is gone. Plex needs both a support article and a server-level "allow media deletion" toggle. | 3 | SPB, SPC, SPD |
| G69 | **Search result shaping** — grouped by kind, and explicitly exempt from the entity-exclusion rule (see **X12**). | 2 | GPD, SWB |
| G70 | **Container-versus-member visibility in browse surfaces** (Plex's `collectionMode`: default / hide / hideItems / showItems). At 93.4% multi-placement the grid-duplication problem is worse here than in Plex. Adjacent: collapsing a degenerate hierarchy level. | 2 | GPD, SPC |
| G71 | **Security response headers, CSP and client-side outbound requests.** Sharpened by CanonCore's own design: artwork loads from third-party origins so a CSP has to name them, the public demo is an unauthenticated surface, and a third-party font or CDN call from the web app leaks the same way the read path is carefully specified not to. Add `X-Robots-Tag: noindex` for self-hosted instances. | 2 | GJD, SJA |
| G72 | **Conflict as a first-class, surfaced, resolvable object.** The review queue is only ever described as holding *match* uncertainty. The prompt names four other conflicts the model guarantees and gives none a home: two providers disagreeing on a single-cardinality field; a placement gone stale after a container was re-derived (called "a curation fact for the review queue" and never followed through); a property tightened with existing offenders; a quarantined vocabulary value. | 1 | SPC |
| G73 | **Watchlist / want-to-consume list.** The clearest case in the sweep of something architecturally expensive for Plex (it built a whole cloud service, because in Plex an item cannot exist without a file) and nearly free here. Continue Watching is derived from progress and cannot hold something never started. CanonCore's own rules already answer it — an Owner `category` statement or a rule-derived container — and should say so before someone adds a table. One detail worth copying: the list orders by *when you added it*, which is a property of the membership row, not the item. | 4 | GPD, SJB, SJR, SPD |
| G74 | **A "never enrich this item" flag.** Enrichment reaches all connected providers at once, so home-video and personal-archive titles would be sent to TMDB. One flag; the privacy consequence of not having it is concrete. | 1 | SPD |
| G75 | **Match provenance: identifier-lookup versus name-search** (`QueriedById`). A claim reached by identifier is categorically stronger than one reached by title; the prompt's own search/lookup split hands it this distinction for free and nothing records which route produced an applied statement — while separately requiring a confidence score capable of failing (G39). | 1 | SJR |
| G76 | **A shared external identifier that DISAGREES.** The prompt defines only the agreeing case ("agreeing identifiers between providers are evidence they describe the same work"). Plex's own metadata engineer: *"It gets tricky when these sources contradict themselves, when for instance a TVDB show and a TMDB show link to each other, but their IMDb IDs differ. It's a brainteaser to figure out whom you believe."* A disagreeing shared identifier is a **stronger** signal than a missing one, it arrives immediately in a design that reaches all providers at once, and an implementer will invent a rule for it. | 1 | SWB |
| G77 | **A `derived` source kind.** See **X8**. `source` names a provider or the owner and nothing else; the palette escapes only because artwork is a table. One sentence now, a migration later. | 1 | SWB |
| G78 | **Reverse lookup from a value to its subjects.** "Everything created_by this person" is the strongest thing a statements model can do that Plex cannot, and it is never stated as a requirement — so it may not be indexed for. | 1 | GPD |
| G79 | **A static-file provider shape.** CMPP requires a source to stand up an HTTP service implementing search *and* lookup before it can contribute anything. A URL returning one document in a published format (XMLTV-shaped) is the cheapest possible third-party contribution and is excluded by the contract as specified — worth deciding deliberately, given the prompt's own first provider exists because its source has no usable public API. | 1 | SPD |
| G80 | **Bulk-import preview and reconciliation.** `browse` "yields placements for free" and nothing says the result is reviewed before landing; importing a 500-row range unreviewed is how a catalogue gets wrecked. Note this is not the refused per-item wizard — it is one screen showing what was found against what exists. Adjacent: what happens on re-browse when the provider's container changed (provider-container drift), which the review queue is never described as handling. | 2 | GPD, GJD |
| G81 | **Derived-data invalidation when a file's content hash changes.** Content-hash identity makes detection trivial and the prompt says nothing about what a changed hash invalidates — chapters, extracted data, cached artwork, progress. | 1 | SJB |
| G82 | **Home screen / hubs / a curated entry surface.** The prompt defers "shelf type" by name and then specifies every ingredient (recently added, continue watching, also-appears-in) with no surface that assembles them — and the stop condition is "a rendered page", so this is the first screen, not a later one. Recorded as a deferral being cashed, not as a reopened decision. | 2 | GPD, SWA |
| G83 | **Per-container default sort direction.** Which end of a 500-item Release-order container the reader meets first. One nullable column; Plex added per-show newest/oldest in 2016. | 1 | SWA |
| G84 | **`continuity` is reserved as a word with no mechanism.** On the evidence a continuity is disputed, reversible, source-asserted and load-bearing for placement — which makes it a `category` statement with provenance and `rank`, machinery that already exists. The risk is an implementer inventing a `continuity` column because nothing says not to. | 1 | SWA |
| G85 | **SSR page transitions tearing down a running player.** Jellyfin Vue had to hack around exactly this under Nuxt; CanonCore is Next.js with progress saved every 10 seconds, so a route change that unmounts the video element loses position. Worth knowing before the first playback screen exists. | 1 | SJB |
| G86 | **App-store distribution as a hard external dependency**, and what happens when a client goes unmaintained. tvOS has **no sideload path at all**, so a self-hosted TV client is App Store or TestFlight or nothing — the first constraint in the committed client plan outside the author's control. It gates a decision already taken and should be checked before the phone app ships, not after the TV app is written. Jellyfin's evidence on the recurring cost: seven store relationships carried by one volunteer, one fix "not available on the Google Play store for technical reasons", a Tizen submission that "failed testing". | 2 | SJA, SJB |
| G87 | Smaller, one-line each, single-sighting: **keyframe index for seeking** (long MKVs seek badly under direct play — GJD) · **fallback fonts for ASS/SSA** (the CJK tofu problem transfers unchanged — GJD) · **subtitle offsets**, one nullable column, expressible only *because* subtitles are their own file row (SPD) · **the file hash as an external matching signal** — OpenSubtitles keys on a near-identical hash, and the prompt separately says "shared identifiers become MATCHING SIGNALS" without treating its own hash as one (SPD) · **variable playback speed**, client-side, table stakes for spoken word (SPD) · **content fingerprinting**, the only matching signal that works on an unlabelled file (SWB, SPA) · **a copy-link affordance**, which is what makes the alias rule visible (SPD) · **threshold granularity** per provider or property (SJB) · **item-level lock** against all future enrichment, distinct from the refused per-field lock (GJD) · **the public read path's field-naming rule does not reach derived assets** — a montage, a poster wall, an OG preview image or a stats line on the demo is a new emission the rule does not cover (SJA) · **the cloud-mount cost of the file hash**: 128 KB is a local-disk figure, and first-and-last-range reads over rclone can force full-object fetches on some backends (GJD) · **per-library/aggregate statistics** and **a stable external identifier for a group** (GPD) · **`sort_name` production rules and `original_title` as a distinct field** (SPA) · **rule-derived containers reacting to progress** (an "unwatched" predicate) (SPC) · **explaining why an action is unavailable** (SPC) · **a debug-logging toggle at runtime** and **background work yielding under playback load** (GPD). | 1 each | various |

---

## Dropped as REFUSED — listed by a sweep agent as a gap, removed here

The prompt's WHAT NOT TO BUILD and STANDING RULES are decisions with reasons. Each of these was named
as a gap somewhere and is **not** one. Recorded so the same items are not re-added by the next reader.

- **Transcoding, quality ladders, media optimisation, HDR tone-mapping, burn-in subtitles.** Refused
  outright, and the sweep quantified what the refusal buys: ~52 Jellyfin configuration options, ~40
  API endpoints, 7 of 18 scheduled tasks, 6 of 24 permission flags, plus roughly a quarter of Plex's
  entire support-article burden.
- **Remux / "direct stream" as a third mode.** SPC raised it as a gap (H2). Remux needs ffmpeg, which
  L532 bans by name. Dropped; if the ban is ever revisited, this is the first thing it should reopen.
- **`.nfo` reading, artwork scanning, artwork uploads, AI-generated posters, `content.opf` and
  `ComicInfo.xml`.** All refused (the last two are `.nfo` under other names — recorded because an
  implementer would not recognise them as such). **But see R1**, which is the one place with new
  evidence. Note that **embedded media tags are NOT covered by this refusal** — see G27.
- **A visibility system.** Refused, and the sweep *corroborates* it twice: Plex's own visibility is
  per-category and global, never per item, so it never has to answer "inherit from which parent?"; and
  Jellyfin's only shipped design depends on containers being a tree, which CanonCore deliberately is
  not. The refusal now has a receipt.
- **Per-field lock flags.** Refused; Jellyfin's ceiling is a boolean lock on **nine hardcoded fields**
  (`MetadataField` = Cast, Genres, ProductionLocations, Studios, Tags, Name, Overview, Runtime,
  OfficialRating) and nothing outside those nine can be locked at all.
- **An enrichment wizard, or any multi-step per-item flow.** Refused; Calibre's deleted 2011 modal is
  the cited precedent, and Jellyfin's Live TV channel mapping is the same anti-pattern shipped.
  (A *first-run setup* wizard is out of scope of this refusal — see G20.)
- **A tag table.** Refused; a tag is an owner-authored `category` statement.
- **Cloud storage integration.** Refused, with rclone/mergerfs documented instead. (The 128 KB hash
  cost over rclone survives as a note in G87.)
- **Cross-instance sharing, federation, fork, and CanonCore-to-CanonCore export/import.** Refused.
  **Backup (G12) and importing an ordering via `browse` (G80) and a watch history (G28) are outside
  this refusal** and are kept.
- **Live TV, DVR, EPG, Watch Together, SyncPlay.** Out of scope; LiveTV alone is >10% of Jellyfin's
  API surface.
- **Groups typed by medium; groups as partitions.** Refused with a stated reason. **But see R4.**
- **Auto-play.** Refused ("offered, never auto-played"). *Up Next* / post-play is a different question
  and is kept as G44.
- **A second Expo app for TV, and Unistyles.** Refused with stated reasons; Plex's one-binary-two-
  layouts arrangement is exactly what "it drags the phone binary onto the TV fork" refuses.
- **A shell-out / post-import hook.** Refused by "never code running inside the app", and it is a
  command-injection surface that writes the filesystem, which "the scanner NEVER writes storage"
  forbids independently.
- **Provider-defined and owner-defined custom fields.** Refused with the reason stated (provenance and
  per-edition rules have nothing to attach to).
- **The word "duplicate", and `record` / `edge` in code.** Standing rules, not gaps.

---

# 4. COUNTER-SIGNALS AGAINST SETTLED REFUSALS

Distinct from gaps, and more important. These are places where a **deliberate decision** in
`prompt.md` is not merely silent but **actively contradicted by evidence the sweep found**. A gap is
something to decide; a counter-signal is something already decided that new evidence puts back in
play.

None of these is an instruction to reverse a decision. Each is a decision whose *written reason* is
now weaker than the evidence against it, and the prompt is the only surviving record — so a refusal
whose reason has been overtaken will be re-litigated by every implementer who meets it.

**R1 · `.nfo` is refused outright, and Plex has just shipped it after eighteen years.** — **STRONG**
*Refusal:* L634-637 — "No artwork uploads, no artwork scanning, no `.nfo` reading. The scanner takes
media files and playback sidecars, and nothing else."
*Evidence:* Plex's NFO Agent is **live**, not planned — support article
`/articles/using-nfo-metadata-files-with-plex/`, **last modified 2026-07-14**, shipped in **PMS
v1.43.1**, with "Support for NFO metadata" also named as a roadmap item on the 2026-05-19 pricing
post. The company that has refused sidecar metadata files since 2008 reversed it in 2026.
*Why they did it:* portability — metadata that survives the server that wrote it. Plex's own article
states the payoff: *"as long as your NFO files contain consistent IDs, your watch status and play
history will be preserved across rescans."*
*Why this matters here:* **CanonCore's answer to portability is "No fork, no export, no import" —
which is the opposite answer to the same question.** Both positions are defensible; only one of them
is written down. The prompt's refusal names a mechanism and never names the problem the mechanism
solves, which is exactly the shape of a refusal that gets reopened.
*Recommended:* one sentence in the prompt saying which problem NFO solves and why CanonCore does not
solve it. Do not reverse the refusal on this evidence — but do not leave the reason unstated either.
*Also worth knowing, from the same article:* four things inside Plex's NFO support independently
validate CanonCore designs (see Section 5, F6).
*Found by:* SWA, SPD.

**R2 · "No export, no import" is written so broadly that it reads as refusing backup — and 10 of 11
sweeps found backup missing.** — **STRONG**
*Refusal:* L624-625 — "No fork, no export, no import, no cross-instance sharing, no merge semantics
between instances."
*Evidence:* Every shard independently concluded the refusal must be narrowed in writing. Jellyfin
shipped backup/restore in 10.11 **scoped so that it is explicitly not an export** ("can only restore
systems on which the backup was originally made") — a working demonstration that the two are
separable. Plex documents a full machine-to-machine migration and a viewstate/ratings transfer.
Jellyfin also states the consequence CanonCore inherits by choosing a forward-only ladder: restoring
from backup is the *only* way back.
*Why this matters here:* the refusal is about interchange between two live instances and **makes
backup more necessary, not less**, because it removes the second path to the data — and CanonCore's
data, unlike Plex's, cannot be re-derived from the files. Read literally, the sentence forbids the
one feature its own reasoning requires.
*Recommended:* narrow the refusal in place — say that it governs instance-to-instance interchange and
that backup, restore and a documented data directory are in scope. Then G12 becomes a build item
rather than an argument.
*Found by:* GJD, GPD, SJR, SJA, SJB, SPA, SPB, SPC, SPD, SWB.

**R3 · "ONE number clears the position" meets a first-class `text` medium.** — **MODERATE**
*Refusal:* L540-542 — "ONE number clears the position; do not add a second, higher threshold for
that."
*Evidence:* Jellyfin is the worked counter-example and ships **five** such constants (`MinResumePct`
5, `MaxResumePct` 90, `MinResumeDurationSeconds` 300, `MinAudiobookResume` 5 min,
`MaxAudiobookResume` 5 min). The unit switch is the interesting part: **it needed a second code path
in absolute minutes the moment audiobooks arrived**, and still judges video on a percentage.
`MinResumeDurationSeconds = 300` is exactly the prompt's five-minute force-complete, independently
arrived at.
*Why this matters here:* `medium` is closed at four values including `text` and `image`, the demo
ships novels, and every completion rule in the prompt is a clock (X5). The refusal is aimed at a real
failure mode (two thresholds fighting each other) but it is stated as if one number could serve four
media. Jellyfin's history says it cannot.
*Recommended:* keep "one number **per medium**" and say so, or declare `text` and `image` non-playable.
Either is defensible; the current wording is neither.
*Found by:* VJ (claim 19), SJB.

**R4 · "Groups are NEVER typed by medium" — the market leader's usage data and Jellyfin's own client
lead both argue the other way.** — **MODERATE**
*Refusal:* L141-142 — "WHY never typed by medium: a Plex library is typed, and that is exactly what
stops a container holding mixed media."
*Evidence, two independent sources:*
- Plex, unbundling music and photos in 2025: *"music playback is utilized by only **2.5%** of our
  users, while photos are accessed by just **0.2%** on a monthly basis."* After sixteen years, the
  market leader's data says a mixed-media surface is a cost paid by 97.5% of users for the benefit of
  2.5%.
- Jellyfin Vue's lead, after years of building the generic version: *"a **media-type driven design**,
  where your media feels at home every time. The current approach of most Jellyfin clients is to be
  **too generic in order to be suitable for all media types possible**, but when you're listening to
  music you don't feel you're in a music player (like Spotify) or in Netflix when watching TV."*
*The rebuttal, which the sweeps supply themselves and which should be written down next to the
refusal:* Plex's numbers measure a **typed** product — its music and photo usage is low partly because
everything above the file, from the library to the navigation to the client, has been asking users to
pick a medium first since 2011. And Jellyfin Vue's argument is about **rendering**, not the model: the
prompt's rule governs the model and the browsing scope, and nothing in it forbids a per-medium
renderer ("a renderer is needed only when a file is attached and someone presses play"). The prompt's
own demo groups — Harry Potter across text, video and audio; Taylor Swift — are exactly the case Plex
cannot express, and Plex's own Blade Runner collection (several cuts plus a soundtrack album in one
container) is Plex reaching for it.
*Recommended:* keep the decision; add the rebuttal, and separate "the model is untyped" from "every
screen is untyped", which are not the same claim.
*Found by:* SWB, SJB.

**R5 · The strongest objection on record to the enrichment design, from the incumbent that tried it
and quit.** — **MODERATE** *(a settled design, not strictly a refusal)*
*Design:* L459-485 — enrichment reaches all providers at once, all values stay live, the owner marks
a favourite, a single declared source order decides until then.
*Evidence:* Plex, 2019-11-20, explaining why it replaced per-server agents with a central service:
*"basically everyone just wants the best metadata we can find. It turns out they're **not interested
in a part-time job managing metadata agent settings**."*
*Why this matters here:* it is the exact objection CanonCore's design invites, from the company with
the largest sample in the category, and an implementer who reads that page and not the prompt's
answer will conclude the design is known-bad.
*The answer already exists in the prompt and needs to be visible beside the objection:* a single
global source order with the Owner pinned first, *"Nothing is stored per field until the owner
cares"*, and groups that **choose** providers rather than re-ranking them — i.e. the zero-configuration
path is the default and curation is opt-in per field. Nothing needs changing; the juxtaposition does.
*Found by:* SWA.

**R6 · "Container progress is computed on read … never stored" is the decision Jellyfin switched off
for being too slow.** — **MODERATE**
*Decision:* L562-565 — computed on read from the ancestor closure, deduped with `COUNT(DISTINCT
item)`, never stored.
*Evidence:* Jellyfin computes on read too, and `SupportsUserDataFromChildren` is **false** for
collection folders with the comment *"// These are just far too slow."* — then in 12.0 it had to add a
batched path *"to avoid N+1 queries"*. Both lines verified verbatim.
*Why this matters here:* CanonCore's version is harder than Jellyfin's, not easier — Jellyfin's dedup
is correct only because of an assumption written into its own source (*"Members of a group are
distinct folders, so their leaves cannot overlap"*), and CanonCore's members overlap **by design** at
93.4% multi-placement, over an ancestor closure with a cyclic category graph 22 levels deep.
*Recommended:* the decision stands (count-based, single-user, and the dedup is load-bearing rather
than incidental) — but the ancestor closure and the batch path are where it will bite, Jellyfin's
comment is the primary source saying so, and it is worth a sentence so it is not discovered late.
*Found by:* VJ (claim 13, filed as "warning, not an edit"), SJR.

**R7 · The thin-client argument, which the prompt forbids re-arguing and which got stronger.** —
**MODERATE, and explicitly pre-empted**
*Decision:* L743-772 — three first-party clients, phone then TV, native Swift on TV; "Do not re-argue
it, and do not quietly drop them either."
*Evidence:* Jellyfin on its webOS client: *"the app itself is **a wrapper around our server's web
interface**, so when you keep your Jellyfin server up to date, **you automatically get a lot of the
fixes right away**. While the TV app will directly get occasional fixes, **we don't anticipate having
to update it very often.**"* A wrapper inherits server fixes for free and needs almost no store
releases; a native app needs one release per fix, through a review queue. Add the shipping costs the
sweep priced (G86): seven store relationships carried by one volunteer, a fix blocked "for technical
reasons" on Google Play, a Tizen submission that failed testing, tvOS with no sideload path at all.
*Why this is recorded anyway:* the prompt costs the *engineering* of the client split precisely and
the *shipping* of it not at all, and the ban on re-arguing covers the engineering argument it already
made. This is a different axis and it is new evidence.
*Recommended:* do not reopen the choice; do add the shipping cost to the reason, so the decision
survives contact with someone who has published to seven stores.
*Found by:* SJB, SJA.

**R8 · "The confirmation is never dismissible by accident: never a drawer, never a swipe-away sheet"
is contradicted by the better pattern for the low-stakes case.** — **WEAK-MODERATE**
*Rule:* L613-614.
*Evidence:* Plex ships swipe-to-delete **with a few-seconds undo** on Android, and a confirm button on
iOS — different affordances keyed to platform, and the undo window is what makes the swipe safe.
*Why this matters here:* the prompt's rule is right for "Delete permanently" and wrong for "remove
this one placement from this one container", which is a reversible, low-stakes act the product will
perform constantly. As written, one rule governs both.
*Recommended:* keep both patterns, keyed to stakes: a non-dismissible confirmation for irreversible
loss, an undo window for reversible removal. Note this depends on G68 (nothing currently says a
tombstone is restorable).
*Found by:* SPD.

**R9 · "No time window, no dismissal" on Continue Watching has no answer for the abandoned film.** —
**WEAK**
*Rule:* L571-572.
*Evidence:* Plex applies a **16-week lookback by default** (per-library, admin-configurable) with a
documented carve-out for season premieres — so the incumbent found a window necessary. Verified at
source: it is a Continue Watching *inclusion* window, not a resume-point expiry (C17).
*Why this matters here:* force-complete under five minutes handles trailers; **nothing handles a
three-hour film abandoned at forty minutes**, which then sits in Continue Watching forever with no
window and no dismissal.
*Recommended:* probably the answer is already in the model — let the owner write a watch event by
hand (G28), which is a curation act rather than a dismissal flag. That keeps the refusal and closes
the hole. Worth one sentence rather than a reversal.
*Found by:* SPB, VP (claim 12b).

**R10 · "No transcoding, no ffmpeg" bans REMUX by side effect, and the prompt's own client argument
turns on the ceiling remux would lift.** — **MODERATE**
*Refusal:* L532-533 — "Direct play only. No transcoding, no ffmpeg, no quality ladders."
*Evidence:* the incumbents ship **three** modes, not two. Jellyfin's own four-way taxonomy, ordered by
server load: *"Direct Play: Delivers the file without transcoding … **Remux**: Changes the container
but leaves both audio and video streams untouched. **Direct Stream**: Transcodes audio but leaves
original video untouched. **Transcode**: Transcodes the video stream."* Remux re-encodes nothing; it
is cheap and lossless, and it is the difference between an MKV playing in a browser and not playing at
all.
*Why this matters here:* the prompt's **own** client reasoning depends on exactly that ceiling —
"expo-video wraps AVPlayer with no MKV, no DTS or TrueHD and no PGS subtitles — so the player is
native Swift under every option". Remuxing MKV→MP4 is the standard answer to that specific ceiling,
and the refusal removes it without pricing it. With no transcoder there is **no fallback at all**: a
mismatch is a hard failure, and the failure surface is wider than it looks (on PlayStation, *any*
subtitle at all disqualifies direct play).
*Honest reading:* remux needs ffmpeg, so the ban does cover it and the refusal is internally
consistent. What is missing is that the prompt never states the cost it is accepting, and "no
transcoding" and "no ffmpeg" are two different bans doing different amounts of work — a reader can
accept the first and not realise the second closes remux too.
*Recommended:* keep the refusal; add one clause naming remux and saying it is refused with the rest,
so it is not quietly reintroduced as "just a container rewrite, not really transcoding". If the ban is
ever revisited, this is the first thing it should reopen.
*Found by:* SPC (H2), SJA, SPB.

**R11 · The `.nfo` refusal is read wider than it is, and embedded media tags fall in the shadow.** —
**MODERATE**
*Refusal:* L634-637 — "No artwork uploads, no artwork scanning, no `.nfo` reading. The scanner takes
media files and playback sidecars, and nothing else."
*Evidence:* four sweeps found embedded tags absent; two stated explicitly that the refusal does not
reach them. **`.nfo` is a separate sidecar file the scanner would have to open; ID3, Vorbis comments,
Matroska tags, MP4 atoms and EXIF are inside the media file the scanner already opens.** Plex treats
embedded tags as a first-class agent, with an explicit all-or-nothing warning: *"you're promising that
not only is your entire music library tagged, but also that it's tagged correctly."*
*Why this matters here:* the consequence is much larger than the artwork one the prompt states and
accepts. The prompt says a private instance with no provider connected has no artwork; it does not say
that instance also has **no track titles, no album, no artist and no track numbers**. The demo
includes music, and the prompt commits to `audio` as a first-class medium.
*Recommended:* decide it explicitly either way and say which. If refused, extend the sentence to name
embedded tags and state the consequence, as the artwork consequence is stated. The gap itself is G27;
it is repeated here because **the most likely failure is that a reader drops it as already-refused.**
*Found by:* GJD, SJA, SPC, SPD, SWB.

**R12 · A standard read protocol as a client path — the prompt supplies the evidence for it and then
forecloses the discussion.** — **MODERATE**
*Decision:* L751-759 — "Across ten comparable self-hosted projects the highest-leverage client work by
a wide margin was implementing an EXISTING CLIENT PROTOCOL rather than writing an app: Komga shipped
OPDS at day 34 and had a third-party mobile reader working one day after its first release, and has
never written an app in six years; Navidrome implemented Subsonic from its second commit … Five of the
ten never built an app at all, and two of those are the healthiest projects in the set. The apps are
being built anyway, deliberately. Do not re-argue it."
*The counter-signal is internal:* "Do not re-argue it" is scoped to *whether to build the apps*, and
two sweeps read it as also foreclosing **shipping a read protocol alongside them** — which is a
different question the prompt never asks. Its own paragraph is the strongest evidence in the document
for doing so, and the cost is one endpoint set rather than three client codebases.
*Evidence on the other side, recorded so this is not one-sided:* Jellyfin **demoted DLNA out of core
into a first-party plugin at 10.9**, it requires host networking and UDP 1900, and "Using DLNA
remotely is not possible" — so the incumbent moved away from the standard-protocol path, not toward
it. DLNA specifically is a poor candidate; OPDS/Subsonic-shaped protocols are not, and Komga and
Navidrome are the prompt's own citations.
*Recommended:* one sentence saying whether a standard read protocol is refused or merely not first.
The current wording leaves an implementer unable to tell which, on the one axis the prompt's own
research says has the highest leverage.
*Found by:* SPC (M10), SJB, SJA.

**R13 · Scrobbling and any outbound push — the refusal list reads as covering it and never names
it.** — **WEAK-MODERATE**
*Refusal:* L624-625 — "No fork, no export, no import, no cross-instance sharing…" — which is about
CanonCore-to-CanonCore interchange and does **not** reach pushing watch events to Trakt, Last.fm or
ListenBrainz. Two sweeps noted the refusal "almost certainly covers it and does not name it", which is
precisely the ambiguity that gets resolved silently.
*Evidence:* this is the one place a catalogue in this category conventionally pushes data outward, and
the whole self-hosted automation ecosystem hangs off it. Plex has fired 12 named webhook events since
2017 and keeps a live blog category for them. Jellyfin's position is the sharper evidence: **its only
documented route for preserving watch state across a rebuild is a third-party scrobbler**, and its own
docs warn that it "will not necessarily preserve everything".
*Why this matters here:* CanonCore already owns the hard half — an append-only watch event log that is
better scrobbling material than anything Jellyfin has, plus a change sequence on every table — and has
no hook of any kind. The Safe External Fetch boundary applies directly and is already specified.
*Recommended:* state whether outbound push is refused or deferred. If deferred, G49 is the build item.
*Found by:* GJD, SJB, GPD, SPA, SWA.

---

## Checked and NOT contradicted — refusals the sweep actively corroborated

Recorded because these were the other candidates, and a reader should know they were examined and came
back clean rather than unexamined.

- **No visibility system.** Corroborated twice, from both incumbents. Plex's visibility is
  **per-category and global** — a handful of fixed toggles over whole classes of data (Ratings &
  Reviews, Watchlist, Watch History, Friends), expressly not per item, so it never has to answer the
  prompt's killer question, "inherit from which parent?". And Jellyfin's only shipped design depends on
  containers being **a tree**, which CanonCore deliberately is not. Independent third data point: Plex
  cannot hide content in folder view because "folder names cannot be hidden" — a hierarchy-derived
  browsing surface cannot honour a per-item visibility rule, which is also why any future "browse by
  path" feature would reintroduce the same hole. If visibility ever arrives with multi-user, the shape
  that survives multi-placement is Plex's: **toggles over categories, never a flag on a row.**
- **No per-field lock flag.** Corroborated: Jellyfin's ceiling is a boolean lock on **nine hardcoded
  fields** and nothing outside those nine can be locked at all.
- **No enrichment wizard.** Corroborated: Calibre deleted its modal per-book matching step in 2011 and
  has twice refused to reinstate it; Jellyfin's Live TV channel mapping is the same anti-pattern still
  shipping, tolerable only at ~50 channels.
- **A provider is a URL, never code in the app.** Corroborated at source and by Plex's own reversal —
  see Section 5, F1. The earliest evidence is from Plex's own launch year: *"This raises the issue of
  how to support downloading scripts for different platforms, when the scripts need binary
  components"* (2008-03-25). Plex asked the question in March 2008 and shut the framework down ten
  years later without ever answering it.
- **`.nfo` reading itself** (as distinct from R1's portability argument and R11's scope problem).
  Corroborated: in Jellyfin, `.nfo` **cannot be disabled and always beats remote providers** —
  first-non-empty-wins with a hardcoded order, documented in Jellyfin's own words.
- **No cross-instance import.** Corroborated: **Emby→Jellyfin migration is "NOT SUPPORTED"** by the
  project that forked from it.
- **Groups never partition.** Corroborated by the shape of the failure elsewhere: Plex's sharing is
  granted **per library**, which is what a partition-as-wall becomes in practice — and the prompt has
  pre-emptively said groups are not walls. The tension is real but future-dated (G62).

---

# 5. CONFIRMATIONS

What does **not** need revisiting. Two kinds: claims the sweep verified at source, and CanonCore
designs an incumbent reached independently — which is stronger evidence than either the prompt's
reasoning or the sweep's opinion, because it is a second party arriving at the same shape from a
different direction.

## Claims verified at source

**Verification score: 15 of 20 Jellyfin claims clean, 11 of 14 Plex/Emby claims sound.** Everything
in Section 1 is a rotted *reason*; **no decision anywhere in `prompt.md` was falsified.**

- **The file-identity hash.** `SHA1(size + SHA1(first 64KB) + SHA1(last 64KB))` — CONFIRMED and
  **reproduced byte-exactly** against a real Plex `MediaPart`. The negative claim is confirmed too:
  "Plex hashes the first 4KB" is wrong, as the prompt says. Safe to implement (with C15's encoding
  detail).
- **An item cannot exist without a file, in both products.** CONFIRMED for both, and the workarounds
  are the evidence: Jellyfin ships **zero-byte `.disc` stub files** whose extension encodes the
  physical medium (`MyMovie.bluray.disc`), and Plex renders no placeholder at all — "show missing
  episodes" is a 12-year-old unimplemented request there (and is an Emby/Jellyfin feature, not a Plex
  one, which is a premise worth correcting in passing).
- **`MetadataResult.Provider` is transient and never persisted.** CONFIRMED, and **understated**: it
  is never *read* anywhere in the codebase — one write at `MetadataService.cs#L974`, zero reads. The
  12.0 EF Core rewrite had every opportunity to add a provenance column and did not.
- **Jellyfin's placement key is `(ParentId, SortOrder)`.** CONFIRMED in the 12.0 EF schema
  (`LinkedChildConfiguration.HasKey(e => new { e.ParentId, e.SortOrder })`), so reordering rewrites
  the primary key. **The shipping release is worse**: membership is a position in a JSON array inside
  a blob column, so an external reference to a placement is not fragile, it is impossible.
- **The key omits ChildId, so duplicates in one container are allowed.** CONFIRMED, strengthened
  (migration `20260723111547`, PR #17416).
- **Enrichment merges first-non-empty-wins and discards the losers.** CONFIRMED verbatim in Jellyfin —
  **and Plex does the same thing**: "If a piece of metadata isn't available from your first source,
  then the agent will fallback down the priority list." The refusal is therefore a refusal of the
  **whole category's default design**, not of one product's mistake. That is a stronger sentence than
  the one in the prompt.
- **The dedup assumption.** CONFIRMED verbatim and named the sharpest citation in the entire sweep:
  `// Members of a group are distinct folders, so their leaves cannot overlap.` —
  `ItemCountService.cs#L549`, guarding a bare `+=` with no dedup. CanonCore's members overlap by
  design, which is exactly why its dedup is load-bearing rather than incidental.
- **`IsCountableLeaf = b => !b.IsFolder && !b.IsVirtualItem`.** CONFIRMED verbatim, and the
  inconsistency is provable inside one file: the watched-percentage path ignores the user's
  "display missing episodes" preference while the child-count path forty lines below honours it.
- **Plex's completion is `viewedLeafCount == leafCount`, counting only what you own.** CONFIRMED,
  byte-identical for `Show` and `Season`, and **unconditional across every library and agent** — the
  prompt's own three-of-thirteen worked example is exactly right. Plex *does* know the real episode
  count, on the cloud Universal Details page; the library item simply never reconciles against it.
- **Cross-library Plex collections match on the name.** CONFIRMED — Plex's docs use the phrase
  "the **exact same name**".
- **Plex libraries are typed and the type is fixed at creation.** CONFIRMED, and Plex repeats the
  typing at every level below (collections by `subtype`, playlists by `listType`).
- **Smart collections cannot be hand-ordered; manual ones can.** CONFIRMED by Plex's docs and enforced
  in python-plexapi (`BadRequest('Cannot move items in a smart collection.')`).
- **Multi-version pick is about what the client can decode, and users are still asking for a default.**
  CONFIRMED and current — the canonical request, open since 2020-02-23, latest reply **2026-07-26**:
  *"A shame it was requested six and a half years ago but was never implemented."* The `is_default`
  pin remains a genuine differentiator.
- **Plex's plug-in history.** The "less than 2% of users" figure — CONFIRMED verbatim from the
  2018-09-25 blog post. The December 2025 reopening — CONFIRMED, including the `metadata` and `match`
  feature names in the official API docs.
- **The display-flip complaint.** jellyfin/jellyfin#6709, opened 2021-10-17, still open, 39 comments,
  last activity 2026-09-04, with a fix attempt (PR #17781) closed unmerged that same day.
- **Jellyfin ships a hardcoded TMDb key.** CONFIRMED and **understated** — three keys, and the
  per-instance override is deliberately hidden: *"This is intentionally excluded from the settings
  page as the API key should not need to be changed by most users."*
- **People deliberately have no `TopParentId`**, documented in a comment; and **person identity is an
  MD5 of the name**, behaviour confirmed. The prompt's paraphrase is sound and carries no
  unverifiable quotation (see W1).
- **The 10-second save interval.** Jellyfin: `10000` ms, one line. Plex's own API docs: every 10 s on
  LAN/WAN. Emby's docs: "automatically every 10 seconds". Three independent products, one number.
- **The audiobook constants and `MinResumeDurationSeconds = 300`.** CONFIRMED exactly.
- **Plex's docs on network mounts** and the remedy CanonCore adopts ("set a periodical scan or do it
  manually") — CONFIRMED (subject to C5's one-word misquote).
- **Jellyfin's React rewrite excludes TV** — CONFIRMED verbatim (*"Modern App … Does not currently
  support TV layout!"*) **and enforced in code**, not merely documented. Not currently in the prompt;
  it is the cheapest available support for phone-before-TV, from a second independent stack.

## CanonCore designs independently validated

**F1 · Plex reached the provider-contract shape on its own, and CanonCore is ahead of it.**
Custom Metadata Providers, announced **2025-12-09**: out-of-process HTTP APIs reached by URL, "from
local Docker containers, to self-contained binaries or publicly hosted on the internet. **All the user
needs to install a metadata provider is a single URL.**" And: "**Developers are not restricted by any
one language or technology** … essentially anything that can serve an HTTP API can be used." Two
required features, `metadata` and `match` — which is CanonCore's lookup, and the match/apply split.
Seven years from closing the plug-in directory to arriving at a URL answering a contract.
**CanonCore is ahead on three axes**: Plex's CMP is **unauthenticated requests only**, movies and TV
only (music "no ETA"), with no provider-specific preferences. CanonCore handles authenticated
providers from day one. The prompt's own conclusion is confirmed at source: build it because the model
needs many sources, **not as a moat**.

**F2 · The five-minute constant is real, arrived at three times independently.**
CanonCore: "Force-complete anything under five minutes so trailers never sit in Continue Watching."
Jellyfin: `MinResumeDurationSeconds = 300`. Plex: post-play only above five minutes, and never for
trailers. Three products, one number, no shared source.

**F3 · The match/apply split already exists as a seam in the incumbent.**
Jellyfin ships `RemoteSearch` and `RemoteSearch/Apply` as **separate endpoints** — so the prompt's
critique is of the merge *policy*, not of the seam, and the seam it proposes is not novel or risky.
OpenRefine's `/reconcile` versus `/extend` is the same split in a different domain.

**F4 · Ordering on the join row, and the stable surrogate id, are validated by both failure modes.**
Jellyfin's collections have **no reorder endpoint at all** (they are sets, not sequences), and its
playlists reorder by dense index (`Move/{newIndex}`) — the exact stale-key problem the surrogate
placement id exists to avoid. Calibre put `series_index` on the book with `UNIQUE(book)`, locking users
into one series per book forever; they work around it with five custom columns.

**F5 · Multi-placement is a real unmet need, and the workarounds prove it.**
Jellyfin needs **three metadata fields** (`airsbefore_season`, `airsafter_season`,
`airsbefore_episode`) plus a display toggle to put one episode in two orderings — and ships
`DisplaySpecialsWithinSeasons` as a boolean because it has nowhere else to put it. Placements do it
natively. Plex needed a whole cloud service to have a watchlist, because an item cannot exist without a
file.

**F6 · Wikibase `rank`, and the scheme/provider identifier split, both re-derived by Kodi.**
Plex's new NFO agent reads `<ratings>` with `default="true"` — several values for one field, all
retained, one marked primary. That is `rank`, done badly, arrived at independently. And
`<uniqueid type="tmdb" default="true">` is exactly the prompt's "a SCHEME is what an identifier IS; a
PROVIDER is who asserted it".

**F7 · The statements table's payoff, demonstrated by its absence.**
Correcting what **one source** had contributed to a Plex library required **deleting and re-adding an
entire library section**, because nothing recorded which source supplied which value. Under CanonCore
that is `DELETE FROM statements WHERE source = X`, with every other provider's claims and every owner
`rank` untouched. This is the single best argument in the sweep for the design — provided G19 says so
in writing.

**F8 · Jellyfin attempted approximately CanonCore's model and abandoned it in place.**
The strongest artefact in the whole sweep: **36 entity classes that still compile**, wired to a `DbSet`
block that has not compiled in six years, describing `Library → LibraryItem → Release → MediaFile`
with per-language metadata collections, reified credits, rating scales and a `Group`-based role model.
That is roughly `items → editions → files`. It is **simultaneously the strongest evidence for the
model and for the prompt's scope discipline**: they reached it, could not land it, and shipped a
65-column flat table with a JSON blob instead. Its provenance attempt got within one level —
per-*record* provenance via `ItemMetadata.Sources` — and stopped, which is the near-miss that proves
the finer cut matters.

**F9 · Surrogate entity ids buy a whole class of work that never has to be done.**
Because Jellyfin keys people on their name, it runs a **weekly scheduled task** de-duplicating people
by name and deleting orphans, plus two 2026 migrations merging duplicate people and artists. CanonCore
never writes any of it.

**F10 · SHIP NO API KEYS is what the commercial incumbent does too.**
Plex, with the leverage to negotiate a bulk key, still requires the user to supply their own for a
third-party AI feature: *"(This feature requires an OpenAI API key.)"* The rule is not something free
projects are forced into.

**F11 · The delete design starts where Plex arrived after two reversals.**
Plex shipped media-file deletion on request in 2011-07-20 and **defaulted it off eight days later**
"for the sake of safety"; it reversed its trash default in the other direction and called the first
choice "the wrong default". Preview-with-counts, never automatic, is the destination.

**F12 · "Never trade a working product for unfinished complexity", priced.**
Plex's 2025-03-31 app rewrite shipped with music, photos and playlist editing **missing**, and the
restoration was still a roadmap promise on 2026-05-19 — more than a year of its most engaged users'
goodwill. Separately, "CUT SCOPE INSIDE THIS REPOSITORY. Never to start another one" is the rule
Jellyfin Vue's six-year vNext is the case study for.

**F13 · An extensible provider system is not a durable advantage — the full arc, dated.**
Plex's plug-in store had "tens of thousands of plug-ins downloaded already" three days after opening in
2009, and was at "less than 2% of users" by 2018. Three extension surfaces removed in total (skins,
scanner/agent independent lifecycle locked down 2015, plug-ins 2018). And the pattern behind every
killed feature: **every dead Plex feature depended on a third party's content or a third party's
runtime** — channels, the queue, the bookmarklet, Cloud Sync, News, Podcasts, TIDAL, Arcade, Plex Mix
(*"removed because of a metadata provider change"*). The features that survived only touched the user's
own files. CanonCore's provider model is on the surviving side of that line by construction: a provider
proposes values into fields CanonCore owns, and withdrawing it leaves the statements standing with
their provenance intact.

**F14 · The refusals are quantifiably load-bearing.** What "no transcoding" alone deletes, measured in
Jellyfin: ~52 configuration options and the whole hardware-acceleration matrix, ~40 API endpoints and
the HLS/segment machinery, **7 of 18 scheduled tasks**, and 6 of 24 permission flags. Live TV alone is
**>10% of Jellyfin's API**. Fixing Postgres rather than shipping a pluggable database deletes
Jellyfin's standing rule that *"when creating a new migration, you always have to create migrations for
all providers"*. And a URL-based provider deletes the entire ABI-compatibility problem.
