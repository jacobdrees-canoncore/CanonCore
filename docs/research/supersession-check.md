# Supersession check — can the four superseded artefacts be deleted?

Checked 2026-09-09 against SPEC.md, CONTEXT.md, `competitor-sweep/`, `resolution/`,
`build-order/` and the branch's commit bodies.

**SPEC.md moved during this check.** Commit `f36a8af` ("Reverse P2: grow the system in vertical
slices") landed mid-pass and took SPEC.md from 1,505 to 1,544 lines. Every SPEC.md citation below
has been remapped to that commit and re-verified against it; every finding was re-tested, and
three moved as a result (noted inline at L4/L5, L6 and L23).

The question asked, and the only one: does each candidate contain anything of value that is
NOT already carried forward into a surviving document?

Method: claim by claim. Every "survives" below was checked with grep against the surviving
files, not assumed. Where a check could not confirm survival, it is recorded as a loss rather
than waved through.

## Verdicts

| Candidate | Lines | Verdict | Unique things lost |
|---|---|---|---|
| the forensic record | 3,701 | **NOT SAFE** — the 2026-09-04 claim is false | 14 |
| `decisions.md` | 1,591 | **NOT SAFE** — P16 forbids it by name | 7 |
| `GRILL-DECISIONS.md` | 155 | **NOT SAFE**, but only three lines need carrying | 3 |
| `harry-potter-pass.md` | 556 | **NOT SAFE** — SPEC.md's own "already folded in" list is incomplete | 5 |

The headline: **"superseded in substance by decisions.md" is false for the archive.** The two
files barely overlap. Worse, several claims live in *both and only* those two, so they cover for
each other — deleting both is what actually loses them.

---

## 1. The forensic record — NOT SAFE TO DELETE. The supersession claim is false.

`docs/research/README.md` says:

> `archive-2026-09-04/` — the original 17-file research dump. Superseded in substance by
> `decisions.md`, but that has never been verified, so it is kept.

**Tested, and it does not hold.** `decisions.md` is a decision log; the archive is the evidence
base and the forensic record of nine prior attempts. They overlap on conclusions and almost
nowhere on content. Fourteen distinctive strings were checked across `SPEC.md`, `CONTEXT.md`,
`CLAUDE.md`, `competitor-sweep/`, `resolution/` and `build-order/`; eleven returned the archive
alone:

| Claim | Found in |
|---|---|
| `advisory lock`, `P0001`, `PGlite` | archive only |
| `Companies House`, `Canon Inc`, trademark exposure | archive only |
| `Patreon`, audience sizing | archive only |
| `fallow` period rule | archive only |
| `curonly` / `xmlrevisions` / `arvcontinue` / `case-colliding` | archive only |
| `sync-tardis` latent bug | archive only |
| `tooling tax` | archive only |
| `Time Lord Victorious` (the surviving multi-parent proof) | archive only |
| "Do not lead with the DAG" | archive only |
| `field_claims`, `backend-phase-gate`, Range proxy, Drive landmine | archive only (Range proxy also in `decisions.md`) |
| `portfolio`, `Hardcover`, `create-t3-turbo`, `put.io`, `Stingray`, citation markers | archive **and `decisions.md` only** |

That last row is the trap: those claims survive if *either* file is kept and vanish if both go.
Deleting the two together is strictly worse than deleting either alone.

### What genuinely IS superseded

Three of the seventeen files are safely obsolete on their own terms:

- **`05-the-prompt.md`** (167 lines) — the 2026-09-04 `/grill-with-docs` prompt. Superseded
  outright by SPEC.md, which is nine iterations later. It still describes CanonCore as Doctor
  Who-shaped ("A Doctor Who story belongs to a season…"), which SPEC.md:24-27 deliberately
  generalised.
- **`04-decisions-so-far.md`'s V0/V1/V2/V3 ladder** (`:89-190`) — killed by name in P1: "NO MORE
  V0 / V1 / V2 AS A LADDER." Its stop conditions ("ten installs that aren't yours", "X of 7,282
  rows matched") are superseded by SPEC.md:86-144. Its V2 client recommendation (ONE Expo app for
  phone and TV, Uniwind) is reversed by SPEC.md:1276-1277.
- **`03-stack-and-platforms.md`'s Plex and Jellyfin sections** (`:214-501`, ~290 lines) — genuinely
  superseded, by `competitor-sweep/`, which is 16,934 lines against the same two products with
  every URL enumerated from their own sitemaps. Keep nothing here that the sweep covers.

- **`16-file-identity.md`** (52 lines) — superseded by `competitor-sweep/verify-plex-claims.md`,
  which re-derived the same hash independently and added two traps the archive missed. See L18.

That is roughly 650 of 3,701 lines. The remaining ~3,050 are not superseded by anything.

### LOST if deleted

**L16. `01-forensic-report.md` §9, the ranked salvage list, and `06-what-to-bring.md`, the file-level
manifest.** Together ~430 lines naming exactly which artefacts in the nine archived repos are
worth lifting and which are traps. Nothing anywhere else does this. The load-bearing engineering
detail, `01-forensic-report.md:250-254`:

> **canoncore-rebuild `drizzle/0005_placements.sql` + `0006_refusing_cycles.sql`** — working,
> measured, RLS-safe DAG with concurrency-correct acyclicity. Advisory lock keyed on the TRAILING
> 64 bits of the UUID (uuidv7 yields only 9 distinct leading-64 keys per 10,000 ids). Trigger walks
> UPWARD on purpose: 17.4s up vs 8.1s down, because upward is bounded by depth.
> UNION vs UNION+CYCLE on a 48-edge ladder: 24 rows vs 8,190.

SPEC.md:704-705 requires "An acyclicity constraint and an ancestor closure" and says nothing about
how. The uuidv7 advisory-lock finding is the kind of thing that is discovered once, expensively, by
a deadlock in production. Likewise `:262-263`:

> `0003_loose_quasimodo.sql` (cycle trigger, raises P0001 not 40001 specifically so the retry
> helper won't retry a known-bad write)

and `:274-276`:

> **archive_canoncore-v3 `tests/integration/helpers/test-db.ts`** — 21 lines, migrations-against-
> PGlite. Best value-per-line in the corpus.

SPEC.md:1446 names "NO TEST HARNESS AT ALL" as day-one defect #4 and gives no starting point;
this is one, already written.

**L17. The Google Drive landmine.** `06-what-to-bring.md:114-127`. SPEC.md:1112-1116 refuses cloud
integration and gives a compressed version of the reason ("a cloud provider's file-scoped
permission grants no access to pre-existing children"). The archive gives the second half, which
SPEC.md does not:

> **THE OTHER LANDMINE — bidirectional sync has already broken this project once:**
> **the change cursor never advanced, and all syncs for that connection were permanently wedged.**

A refusal is easier to hold when the failure that produced it is named.

**L18. WITHDRAWN on re-check — the file-identity material is fully superseded.**
This was filed as a loss and it is not one. `competitor-sweep/verify-plex-claims.md` §6a, "The
algorithm — CONFIRMED", and `resolution/resolve-X7-X13.md`'s X11 §0 both carry the test vector, and in better form than the
archive's: the full digests, a live re-verification against real bytes over HTTP range requests,
and two traps the archive does not mention — a trailing newline breaks the hash
(`verify-plex-claims.md:317-318`) and so does uppercase hex (`:319`). `open_subtitle_hash`/OSHash
and `EnableCaseSensitiveItemIds` are likewise covered (`verify-plex-claims.md`,
`verify-jellyfin-claims.md`, `sweep-jellyfin-repo.md`). **`16-file-identity.md` can go.**
Recorded rather than quietly dropped, because it is the one place this check's first pass
over-claimed, and the reason is worth naming: the archive predates the competitor sweep, so
anything the sweep re-verified is superseded by it and not by `decisions.md`.

**L19. The capacity sizing.** `13-model-sizing.md:40-54`. SPEC.md carries corpus statistics but no
projected row counts:

> items **146,205** · placements **299,549** · statements **266,959** SMW-only, **~2.4M** with
> derived relationships · aliases 36,620 · editions ~146,205 + ~1,600
> **Nothing exceeds 10 million rows.**

That verdict is what makes the statements design affordable, and SPEC.md:1517-1520 warns about
OpenMRS reaching 27 million rows without ever saying where CanonCore lands against that number.

**L20. Two import traps that will silently corrupt a first import.**
`13-model-sizing.md:126-131`:

> **Four of the top six are citation markers that EXIST AS REAL ns0 PAGES** — filtering by target
> string is not enough, they must be excluded by name.
> Marker volumes: TV 166,591 · PROSE 156,994 · AUDIO 94,714 · COMIC 49,630 …

and `:34-39`:

> **STRUCTURAL WARNING — do not double-count**
> `stories`, `story_summary`, `story_credits`, `backlinks`, `articles`, `redirects` are **VIEWS,
> not tables**. `story_credits` is literally `page_properties WHERE is_link` joined to story pages:
> 75,223 rows, **adds ZERO to statements**.

and `:84-86`:

> **Import traps:** `Series` is a LITERAL containing wiki markup. `Imdb` and `Twitter` are flagged
> as links but are external IDs. Both need parsing, not a straight copy.

The first is the sharper: it produces a graph where four fake nodes dominate every centrality
measure, and it looks like real data.

**L21. The whole provider landscape and its licence matrix.** `02-provider-research.md`, 346 lines,
unique in full. SPEC.md carries TMDB's terms and the Cloudflare 403 and nothing else about where
metadata can legally come from. The archive holds a twelve-source matrix (`:322-337`) with
machine-readability, licence and cache-and-redisplay for each, plus:

> ## FIELDS WITH NO LEGAL SOURCE AT ALL
> 1. **Cover images** — nobody grants rights. … 3. **Story-level Big Finish data** — the largest
> slice of the corpus, no legal source.

and Big Finish's verbatim clause 5 (`:195-199`), which `04-decisions-so-far.md:115` identifies
as "the strongest argument for self-hosting" — SPEC.md:1110-1116 chooses self-hosting and never
gives that argument. **This is also the direct input to L1**, the open question of what the cheap
second provider should be: `:326-330` ranks Wikidata (CC0, unconditional), Grand Comics Database
(CC BY-SA 4.0, keyless REST, story-level) and MusicBrainz (CC0) as the three clean options.

Two open actions live only here and in `04-decisions-so-far.md:75-77`:

> Ask tardis.guide owner … whether a Tardis Wiki page title/ID is exposed in the API response.
> **If yes, the 75-85% matching ceiling collapses.**

**L22. The standards citations SPEC.md asserts without proof.** `15-standard-type-vocabulary.md`
and `09-industry-vocabulary.md`, ~270 lines. SPEC.md:198-234 states the seven kinds and their
bases as settled; the archive holds the quoted scope notes that make them checkable — LRM E7's
exclusion naming Kermit the Frog, Miss Jane Marple and Merlin (`15:8-11`); LRMoo F38's
"**Rather than merging characters with real persons, they should be described as disjoint, but
related entities**" (`15:24-25`); schema.org issue #540 closed `not_planned` after nine years
(`15:35`); Wikidata's class chain provably not passing through Q5 human (`15:29`).
And in `09`, two findings SPEC.md needs and does not carry:

> **dcterms:provenance is a TRAP** — "A statement of any changes in ownership and custody" — prose,
> whole-resource, not per-field. (`09:57`)
> **The Ordered List Ontology (purl.org/ontology/olo/core#) NO LONGER RESOLVES** — 403 from
> purl.org and SourceForge, 404 from GitHub. Do not build on it. (`09:135`)

Both are refusals of plausible-looking wrong answers an implementer would otherwise reach for.

**L23. The forensic record of why attempts stop.** `01-forensic-report.md:41-71`.
**This one changed during the check, and it is now the strongest item on the list.** Commit
`f36a8af`, taken today, reverses P2 and argues for it directly from this file (SPEC.md:65-72):

> The forensic record on this product's own previous attempts is sharper still: they died two to
> four weeks in, four of five within a week of their highest-output day, and the artefact that
> revealed total cost is what preceded the death every time. A model built whole before anything
> renders is that artefact.

SPEC.md now carries that conclusion, and the ledger it rests on — twelve repos, which artefact
preceded which stop, and by how many days — exists only in the archive. SPEC.md:1538-1539 carries
the derived *rule* — "When an audit says the remaining work is larger than expected, the answer is
to CUT SCOPE INSIDE THIS REPOSITORY. Never to start another one" — with no reason attached. The
reason:

> **They do not decay. They are terminated at peak velocity, by an audit.**
> Four of five measurable attempts hit their highest or second-highest commit day within 7 days of
> death. … Every stop from attempt 3 onward follows within 1–3 days of an artefact that measures
> remaining surface area … **The 2–4 week window is when an attempt first becomes able to see its
> own total cost. It sees it, and it dies.**

plus the two-thirds of the rule SPEC.md does not carry (`:422-430`): the 14-day moratorium on a
new repo, and "Write the one document that has never existed: a dated paragraph, at the moment of
stopping, saying what stopped and why. Eleven are missing." A rule with its evidence deleted is a
rule that gets argued with.

**L24. The name and trademark position.** `01-forensic-report.md:287-293`:

> **CanonCore is fully available**: npm, PyPI, crates.io, .io/.net/.org/.app/.dev/.co.uk all free,
> Companies House clear … **UNVERIFIED: trademark.** UK IPO, EUIPO and USPTO APIs all unreachable.
> "CanonCore" contains "Canon", and Canon Inc. holds broad Class 9 marks. A £170 UK IPO search
> before committing is cheap insurance.

An open, dated legal exposure on the product's name, with a costed action. Nowhere else in the
repo. `CLAUDE.md` names the repo and the Linear team; neither records that the trademark check was
never done.

**L25. The competitive and market position.** `01-forensic-report.md:333-367`:

> **Many-parents is table stakes.** Trakt, Letterboxd, Komga, Kavita, Audiobookshelf, Stash, Plex,
> Anytype and Tana all support one item in many collections. … **Do not lead with the DAG.**

and

> **TMDB's Collection Bible states outright that "Movies can only be in one collection at a time"**,
> with remakes, reboots, spin-offs and shared universes explicitly excluded.

and

> **Audience: ~25k–50k hard core worldwide.** … **A Patreon project, not a business.**

SPEC.md is a build document and correctly holds none of this. But "do not lead with the DAG" is a
positioning instruction that directly contradicts how the product is naturally described, and the
audience sizing is the sanity check on every scope decision. The TMDB Collection Bible finding is
the sharpest single piece of competitive evidence in the repo and appears in no surviving file.

**L26. The pipeline engineering, and a live bug in it.** `01-forensic-report.md:375-391`. SPEC.md
treats `~/tardis-pipeline` as a black box ("Query it; do not vendor it"). The archive holds what
was learned building it — 146 case-colliding image pairs whose failure mode is silent mislabelling
rather than absence; "download 11× more data, finish 8× faster" (`--curonly` ≈ 40-60h against
`--xmlrevisions` ≈ 5h); the arvcontinue watermark reasoning — and one unfixed defect:

> **A latent bug in exactly the place ADR-0004 exists to prevent.** `sync-tardis.py:232-235` takes
> `max(revid)` and `max(timestamp)` as two INDEPENDENT calls and concatenates them. If the highest
> revid is not the highest-timestamped revision, the watermark names a pair that never existed and
> **can skip revisions.** Also `lestart` is inclusive and NOT de-duplicated.

The test fixture and the owner's library both come out of that pipeline. This is the only record
that it can silently skip revisions.

**L27. The vocabulary forensics behind SPEC.md's STANDING RULES.**
`08-corpus-vocabulary.md:51-77`. SPEC.md:1281-1286 bans "duplicate", `record` and `edge`, and
restricts `canon` — as bare rules. The archive gives each its reason, in the words of the decision
that took it:

> **"duplicate"** -> redundant file ("in earlier work 'duplicate' named something undesirable while
> 'multi-placed' named the product's central feature")
> **Meta-collection** — "it meant 're-lists Items that live primarily elsewhere', and **under a DAG
> nothing lives primarily anywhere**."
> **Inherit** — "declared by three separate schemas and **exercised by none of them** … **'inherit
> from which parent?' has no answer once an Item is multi-placed**"
> the table names **`user`** and **`account`** ("the two most obvious defaults are words the domain
> glossary tells you not to use")

CONTEXT.md's `_Avoid_` lines carry the *bans*; only the archive carries the *arguments*, and the
fifteen "load-bearing contradictions" at `08:91-172` are the record of what happens when a
vocabulary is not policed.

**L28. The vapour catalogue.** `08-corpus-vocabulary.md:22-35` and `17-ALL-TERMS-raw.md:125-230`.
SPEC.md:690 says "NO database enums anywhere: an enum accumulates values nothing reads and cannot
be retired". The evidence, and it is specific:

> **v3 `cmpp_provider`: 7 of 9 vapour.** Only TMDB and BIGFINISH have adapters. … **OMDB is worse
> than vapour: it is the repo's canonical "provider not configured" test fixture.**
> **v5 `media_sources_provider`: 3 of 4 vapour.** … **The Doctor Who seed never inserts a media
> source at all.**

**L29. The portfolio rationale.** `01-forensic-report.md:320-329` and `decisions.md:380-386`.
SPEC.md:1403-1404 says of the phone and TV apps: "The apps are being built anyway, deliberately.
Do not re-argue it, and do not quietly drop them either" — and gives no reason at all, having just
spent nine lines arguing the opposite. The reason is that this is a portfolio project:

> **GitHub stars — 54 across four accounts.** jacobdrees (26) is almost entirely React Native /
> Expo mobile UI, with a specific cluster (netflix-ui, apple-music-sheet-ui,
> expo-apple-music-bottom-sheet, expo-reaction-menu, edge-fade) that is someone researching how to
> build a streaming-app-feeling mobile client. … jacobreesdev (19) splits half UI, half unambiguous
> job-search …

Note: commit `f7eefa7` ("Record that this is a portfolio project, and what follows from it") put
this framing into `HANDOFF.md`, and commit `2e8aea5` deleted `HANDOFF.md`. So as of HEAD the
portfolio rationale survives **only** in `decisions.md` and this archive — the two files under
consideration for deletion. An instruction that says "do not re-argue it" with its reason deleted
is an instruction that will be re-argued.

**L30. Ten-plus verified facts about the incumbents that the sweep does not cover**, because the
sweep was scoped to Plex and Jellyfin only. From `10-client-platforms.md`: put.io replacing a
React Native tvOS app with native SwiftUI in August 2026 ("No universal UI target"), VLC sharing
26.5% with tvOS against 99.7% with visionOS, Emby's tvOS carve-out from its own HTML convergence,
Infuse's linked-framework list and licensed-decoder pattern, Stingray reaching the App Store in
~10 weeks with 774 of 782 commits by one person, and the measurement guardrail that Apple exposes
no separate tvOS rating for a universal app so any such figure is fabricated. From
`03-stack-and-platforms.md`: the distribution inversion since 2024 and the r/selfhosted Rule 6
three-month embargo — `build-order/` carries the awesome-selfhosted four-month rule but not this
one. From `07-storage-sources.md`: that forums.plex.tv "staff/moderator" badges are volunteer
community moderators, so only support.plex.tv, plex.tv/blog and @PlexInfo are citable as official
— a sourcing rule that governs how ~30 of SPEC.md's Plex citations should be read.

### CONTRADICTS SPEC.md

The archive is dated 2026-09-04 and predates every decision on this branch, so much of it reads as
superseded rather than wrong. Three items are worth flagging because someone could act on them:

**S12. `09-industry-vocabulary.md:5-7` recommends the opposite of the settled vocabulary:**

> **Recommendation: rename Item -> Work. Keep Item for the file.** That one rename removes the
> model's worst ambiguity.

SPEC.md:822-823 and CONTEXT.md's first headword settle it the other way, deliberately and with the
cost named ("Internally unambiguous; the cost is external only"). `09:138-160` then supplies a full
alternative vocabulary table (Work / Expression / Instance / Proxy / Range) which is *not* the
project's vocabulary. Read cold, that table is a trap.

**S13. `13-model-sizing.md:87-101` proposes kinds SPEC.md refuses.** "Budget for `kind = concept`,
`object`, `issue`, and an `unknown` default." SPEC.md:223-228 refuses `object` by name and at
length, and there is no `issue` or `unknown` kind. The archive's own note that this bucket is an
artefact of building a kind list from wiki categories is at `decisions.md:530`, not here.

**S14. `12-model-breakages.md:57` and `:66` propose `membership_rule` and `ordering_id`**, both
refused later: `decisions.md:770-771` records "REJECTED: `ordering_id` on the placement (IIIF
looked at exactly that shape and deleted it)", and rule-derived containers landed as a
hand-placed-or-rule-derived split (SPEC.md:284-289) rather than as a nullable column.

### Verdict

**NOT SAFE TO DELETE.** The claim it was kept under has now been tested and is false. About 600 of
its 3,701 lines are genuinely superseded (`05-the-prompt.md`, the V-ladder in `04`, `03`'s
Plex/Jellyfin sections and `16-file-identity.md`, all of which `competitor-sweep/` replaces at far
greater depth). The other ~3,050 are
the evidence base for SPEC.md's assertions, the salvage manifest for nine repos of prior work, and
the only record of several live risks.

---

## 2. decisions.md — NOT SAFE TO DELETE

1,591 lines, P1-P21 plus Tier 1-3. Most of the *reasoning* is in SPEC.md, usually improved. What
is not carried is (a) a decision that explicitly says it lives here and nowhere else, (b) three
unfixed criticisms of the current SPEC.md, and (c) the evidence for choices SPEC.md states without
argument.

### LOST if deleted

**L9. P16 — a decision whose entire content is "this stays in the log".**
`decisions.md:1442-1457`:

> ## P16. NO RELEASE-CADENCE RULE IN THE PROMPT. P14 stays in the log.
> P14 established that release cadence is the survival variable. It does NOT follow that a cadence
> belongs in the prompt. … **P14 is recorded here, where it belongs.**
> …
> That fact is real and it is not in the prompt by choice, not by oversight.

Deleting `decisions.md` deletes the thing P16 exists to preserve. This is the clearest single
argument against deletion in the whole check: a prior decision anticipated this deletion and
ruled against it.

**L10. P14 itself — the Ubooquity control case.** `decisions.md:1361-1376`. Grep for `Ubooquity`
across `SPEC.md`, `CONTEXT.md`, `CLAUDE.md` and all of `docs/research/` returns `decisions.md`
and nothing else — **including `build-order/`, which was the re-run of exactly this research**:

> **Ubooquity** was the closed-source comic and ebook server. It shipped 2.1.2 on **2018-10-11**
> and went silent … **Komga was created 2019-08-08. Kavita 2020-12-12. Both inside that gap.** …
> Ubooquity came back — 3.0 beta 2023-10-15, 3.1.0 stable 2025-08-18. The maintainer never quit.
> **THE USERBASE DID NOT RETURN.**
> Companions: **Readarr** is archived at 3,471 stars … **Sick Beard**'s last commit reads
> "Officially sunset the repo" at 2,855 stars.

`build-order/build-order-research.md` covers the awesome-selfhosted four-month rule
(`:673`, `:1442`) and the abandoned-fork cases (`:352`, `:1071`), but not Ubooquity, not Readarr,
not Sick Beard, and not the two-failure-modes synthesis at `decisions.md:1378-1388` that produced
"NO ROADMAP, BUT A CADENCE".

**L11. The rename prohibition.** `decisions.md:1397-1402`:

> A RENAME IS NOT A FIND-AND-REPLACE. Karakeep's rename cost it Docker image continuity … and its
> Firefox extension outright … across 27 rename commits, one touching 230 files.
> **CanonCore has already been renamed twice. The name is settled. Do not rename again.**

SPEC.md:1285-1286 says "Canon is the product's name and nothing else — not a field, not a UI
word", which is a *vocabulary* rule about the word `canon`, not a prohibition on renaming the
product. `01-forensic-report.md:287-291` independently establishes CanonCore as the defensible
name. The instruction not to rename again exists only here.

**L12. Three unfixed criticisms of the current SPEC.md.**
`decisions.md:1520-1528`, filed under "Also noted, not yet changed" — and still not changed:

> - `HOW TO READ THIS` maps about half the document; enrichment, playback, security, storage,
>   delete, facts and constraints are not in it, nor is the new stop-condition caveat.
> - The closing question ("What do we build first, and what is the smallest thing that renders?")
>   is already answered three times over by the document, while CONSTRAINTS two lines above says
>   to reject on sight any proposal that grows the document phase. It invites the thing it forbids.
> - Claims are inconsistently dated. The undated ones include the expo-video codec claim, which is
>   load-bearing for P3, the most expensive decision in the document.

All three verified still true at HEAD: SPEC.md:19-22 maps the model, refusals, disk, clients and
demo and omits enrichment, playback, security, storage, delete, migrations, the scheduler, facts
and constraints; SPEC.md:1540-1543 is the constraint and the question, two lines apart; and
SPEC.md:1407-1408's expo-video claim carries no date while SPEC.md:940-946 and :1438 do.

**L13. The four scaffolders ruled out, with the trap.** `decisions.md:1336-1344`. SPEC.md:1425
says "Generate the repo with create-better-t-stack" and never says what else was looked at:

> - **create-t3-turbo** — default branch has not moved since **2025-12-12**, and it pins
>   `better-auth@1.4.0-beta.9` against a stable 1.7.2. GitHub's timestamp and the review sites
>   report it as maintained because they read Renovate branches. **This repo is in Jacob's stars.**
> - **next-forge** — Prisma not Drizzle, no typed RPC, SaaS-shaped; ~30% survives.
> - **start-ui-web** — TanStack Start + Prisma, single app; ~15% survives.
> - **ShipFullStack** — code frozen since 2025-11-03, and **no `packages/` directory at all** …

Two of the four are in Jacob's own GitHub stars, so they are the two most likely to be proposed
again. The Renovate-branch trap in particular is a checkable, re-derivable-only-by-repeating-it
finding.

**L14. The archive's fixture-selection data.** SPEC.md:1374-1386 says to commit a deterministic
extract and lists the *shapes* required ("a serial with a missing part rebuilt as animation", "a
story in more than twenty containers", "a category cycle", "a story with two release dates", "a
medium value that is parse garbage", "a work with no edition at all"). `decisions.md` names the
rows that satisfy them, at `:785-790`:

> *The Tenth Planet* 4 parts, 3 survive, part 4 animated · *The Ice Warriors* 6 parts, 4 survive,
> 2 animated · *The Daleks' Master Plan* 12 parts, 3 survive, NO animation ever made, so every
> release is a quarter forever · *The Power of the Daleks* 6 parts, none survive, all 6 animated ·
> *Marco Polo* 7 parts, none survive, no animation, unwatchable.

plus *The Sea Devils*' two release dates (`:466`), `His Mad Pranks` = DWM 616-617 and 619-621 and
`Star Tigers` = DWM 27-30 and 44-46 for non-contiguous spans (`:505-506`), River Song / Melody
Pond for the alias case (`:475-476`), and *Real Time* as webcast-and-audio (`:458`). Recoverable
by re-querying the DuckDB, but not from any document.

**L15. The Datomic argument for statements.** `decisions.md:438-444`:

> keeping what a provider said and when it changed means row-versioning whole items would
> duplicate every unchanged field on every save, while **statements store only the DELTA**. That
> is the bridge to Datomic, which is a QUAD — entity, attribute, value, transaction time.

Described in the file as "an argument nobody had made". Not in SPEC.md; `Datomic` appears nowhere
outside `decisions.md` and the forensic record's `14-industry-review.md`.

### CONTRADICTS SPEC.md — stale, a different reason to delete

`decisions.md` marks most of its own supersessions inline (`[SUPERSEDED BY P6]`, `[REFINED BY
P9]`, and the "Amendments owed — ALL RESOLVED" list at `:1018`). These are the ones it does not:

**S3. A stale legal string.** `decisions.md:1112-1113` gives TMDB's required notice as:

> the string "This product uses the TMDb API but is not endorsed or certified by TMDb" shown
> prominently

SPEC.md:1476-1479 carries a different string, checked 2026-09-07 and marked VERBATIM: "This
[website, program, service, application, product] uses TMDB and the TMDB APIs but is not endorsed,
certified, or otherwise approved by TMDB." Two versions of a mandatory attribution notice in one
repo is worse than one, and the older one is wrong.

**S4. Eight item kinds including `nomen`.** `decisions.md:577-588` (Tier 2.3) tabulates eight
kinds. SPEC.md:198-211 says seven and refuses `nomen` by name. Superseded by commit `094206e`,
unmarked in the file.

**S5. Force-complete under five minutes.** `decisions.md:836-837`: "ADD a force-complete for
anything under five minutes, so trailers never sit in Continue Watching". SPEC.md:1021-1029: "THERE
IS NO FORCE-COMPLETE RULE. An earlier version completed anything under five minutes … and it was
wrong twice over." Reversed by commit `525e596`, unmarked.

**S6. The scanner refuses `.nfo`.** `decisions.md:678-683` (3.6) and `:705` and `:1552` (P19) all
say the scanner does not read `.nfo`. Reversed by D4; SPEC.md:1126-1151 reads `.nfo` and embedded
tags. Unmarked in 3.6 and in P19.

**S7. File roles include `chapters`.** `decisions.md:694`: "`role = media | subtitle | audio |
chapters`". SPEC.md:398 closes it at "media|subtitle|audio"; chapters became a column written by
the analysis pass (SPEC.md:971-972). Resolved by X10, unmarked.

**S8. The container is never encoded in the URL.** `decisions.md:718-719`: "the container you
arrived through is navigation state carried alongside the address, **never encoded in it**".
SPEC.md:298-309 reverses this explicitly — `?via=<placement-id>` is in the URL, declared
non-identifying — and names the old wording as having "overshot". Unmarked.

**S9. OPDS is undecided.** `decisions.md:1436-1440` (P15): "A client-facing protocol such as OPDS
remains UNDECIDED and is not refused." `resolution/resolve-counter-signals.md`'s R12 §4, "SURVIVES
or MOVES", later resolves it: "**SURVIVES, and should be written down as a refusal rather than a silence.**"
Note the resolution's own recommended one-sentence edit to SPEC.md was never applied — SPEC.md:1435-1439
still carries only the OPDS *evidence* with no verdict, so this contradiction is currently
unresolved in the live document as well as in the log.

**S10. Progress constants.** `decisions.md:118-120` ("80% marks watched, 95% deletes the position
row, 5-minute dedup, 30-second throttled save") is superseded in-file by 3.16, which is in turn
superseded by SPEC.md:992-1020. Correctly marked at `:838` and `:1024`; noted only because a reader
meeting line 118 first sees four numbers none of which is current.

**S15. P2 is reversed.** `decisions.md:1047-1054` (P2): "WHAT SHIPS FIRST — the full model, then
render. All ten tables as designed … then the page on top." Commit `f36a8af` reverses it:
SPEC.md:60-62, "GROW IT IN VERTICAL SLICES … The first slice renders a real page", explicitly
"THIS REVERSES AN EARLIER DECISION". Unmarked in `decisions.md`.

**S16. P17's premise is gone.** `decisions.md:1459-1468` (P17): "THE PLAYBACK HALF SHIPS UNPROVEN".
SPEC.md:124-127 now says the opposite: "UNDER VERTICAL SLICING THAT HALF IS SIMPLY NOT BUILT YET …
Nothing now ships unproven, because nothing ships until a slice proves it." P17's conclusion
(playback is the first work after the cap) survives at SPEC.md:129-131; its premise does not.

**S11. Medium-value counts disagree three ways.** `decisions.md:471` says "40 `Medium` values of
which ~25 are parse garbage"; `decisions.md:946` says 71 distinct. SPEC.md:696 says "0 of the
archive's 70 `Medium` values" and SPEC.md:1526-1527 says "71 distinct values of which about 50 are
one-use wreckage". The 40/25 pair is the oldest and is wrong. (SPEC.md's own 70-versus-71 is a
separate, pre-existing inconsistency inside the surviving document.)

---

## 3. GRILL-DECISIONS.md — NOT SAFE TO DELETE

155 lines. D1-D10, all applied. The decisions themselves are fully carried forward. What is
not carried forward is the **open queue** at the top of the file, written 2026-09-09 and
newer than most of the document.

### What survives

- **D2** (stop condition widens) → SPEC.md:144 "THE FOUR CONDITIONS ARE A FLOOR, NOT A
  CEILING".
- **D3** (delete "WHY THIS DOES NOT ALREADY EXIST") → the section is gone from SPEC.md, and
  all three evidential reasons survive at source:
  - Jellyfin collections DO cross libraries → `verify-jellyfin-claims.md:111,172,1017`
    ("Claim 4 … **WRONG**").
  - Plex per-show ordering since PMS 1.40.4 (2024-07) → `verify-plex-claims.md:95,1107`.
  - Jellyfin `.disc` placeholders → `gaps-jellyfin-docs.md:28,499`,
    `sweep-jellyfin-site-A.md:1024`, `sweep-jellyfin-repo.md:1355`.
- **D4/D5** (.nfo, sidecar as third source kind) → SPEC.md:1128-1151, 1103-1106.
- **D6** (placements source column) → SPEC.md:252-262, including the Disney+ MCU August 2025
  example verbatim.
- **D7/D8** (backup, restore, documented dump) → SPEC.md:1171-1201, including the
  ten-of-eleven-agents convergence figure and both REFUSED clauses.
- **D9** (MediaInfo analysis pass) → SPEC.md:969-990, including the Jellyfin
  `if (!hasRuntime) { data.Played = true; }` defect and the MediaInfo-over-ffprobe reasoning.
- **D10**'s five-part decision basis → not in SPEC.md, but it is a *process* mandate rather
  than an implementer instruction, and every decision taken under it is on disk in
  `resolution/` in exactly that five-part shape (`### 1. What Plex actually does` /
  `### 2. What Jellyfin actually does` / `### 3. Industry standard` / `### 4. SURVIVES or
  MOVES`). The mandate is legible from its output.
- **Tier B (31) and Tier C (45) gap counts** → `CONSOLIDATED-FINDINGS.md:19`.
- **"7 refusals came back CORROBORATED"** → `CONSOLIDATED-FINDINGS.md:20` and its
  §"Checked and NOT contradicted" at line 1269.
- **`.nfo` referencing local artwork** (listed as still open at line 74) → now CLOSED in
  SPEC.md:1150-1151 "NO ARTWORK COMES FROM IT. Not embedded, and not by following a local
  image path it names."
- **`lockedfields`/`lockdata`** (line 73) → the evidence survives at
  `gaps-jellyfin-docs.md:68,451` and `sweep-jellyfin-site-A.md:1097-1100`, where it is
  recorded as **ABSENT — MEDIUM** (an item-level "never touch this again" lock has no
  CanonCore equivalent). The *question* GRILL-DECISIONS asks is therefore still findable, in
  a tier-ranked list, which is where it belongs.

### LOST if deleted

**L1. The second-provider reversal request. `GRILL-DECISIONS.md:28-29`, and nowhere else in
the repo:**

> **P12** two providers: the conditions stand, with the second provider to be something cheap
> rather than TMDB. Confirm.

This is a live instruction to change a *stop condition*. SPEC.md:51-56 still names TMDB:
"The other is TMDB — remote, user-supplied key, rate-limited, with the attribution string and
the six-month cache rule honoured." Grepping `docs/`, `SPEC.md` and `CONTEXT.md` for "second
provider" returns this line, plus `decisions.md:1177` — which is about the demo's music slot, not
about the stop condition. No surviving document records the request. Deleting the file deletes the only record
that the TMDB half of the stop condition is awaiting confirmation, and SPEC.md would then read
as settled when it is not.

**L2. That "what CMPP stands for" is an OPEN DECISION rather than a deliberate silence.**
`GRILL-DECISIONS.md:22-25`. The evidence itself survives — `resolve-tierA.md:985-1023` quotes
the archive's three candidate expansions in full and says "**I am not inventing one.** The
decision is open". So the *content* is safe. What is lost is its placement on a short list of
things still to decide; buried at line 985 of a 2,718-line resolution document it is
findable only by someone who already knows to look.

**L3. D1's recorded dissent. `GRILL-DECISIONS.md:34-37`:**

> **D1. Standing of the sweep: EVERYTHING is on the table, including settled refusals.**
> Chosen against my recommendation, deliberately. Recorded concern: this is the failure mode
> the prompt was written to prevent, where a list of things two mature products have becomes
> a backlog.

A decision taken *against advice*, with the advice recorded. Nothing in SPEC.md, CONTEXT.md
or the commit bodies preserves it. It matters because it is the standing caution against
exactly the process that produced the 87-gap list, and because "chosen against my
recommendation" is the kind of thing that gets forgotten and then re-litigated from scratch.

### CONTRADICTS SPEC.md — stale, a different reason to delete

**S1. `GRILL-DECISIONS.md:77-84` says X1 is only half closed:**

> **D9 closes only HALF of X1, despite claiming to close it.** … CanonCore has no
> client-capability concept anywhere … The missing piece is a static per-client-type list of
> supported containers and codecs, checked into the repo and compared at play time.
> Undecided; left out of SPEC.md rather than invented.

This is now false, and it was resolved a different way than the one proposed. SPEC.md:147-169
gives `sessions` a CAPABILITY DECLARATION sent by the device, and SPEC.md:961-967 states
"WHEN A FILE WILL NOT PLAY, NAME THE PROPERTY THAT FAILED … playability is the file's probed
properties checked against THE DEVICE'S DECLARED CAPABILITIES". The device declares; there is
no static per-client-type list checked into the repo. The GRILL text is stale in both its
status and its proposed shape.

**S2. The file contradicts itself.** Line 7 "The queue is closed — 2026-09-09" says
"Everything D10 delegated has been worked and applied", while lines 71-84 keep an older
"Still open" section listing R2-R13, X1-X13 and G1-G11 as open. The later header is right.

### Verdict

**NOT SAFE TO DELETE as it stands.** Only three things need carrying forward — L1, L2 and
L3 — and they total about six lines. Carry those, and the file becomes safe.

---

## 4. harry-potter-pass.md — NOT SAFE TO DELETE

SPEC.md:1495-1501 says the pass is done and "DO NOT REPEAT IT", then lists what was folded in:

> the three audio renderings and the radio-dramatisation contrast, the based_on qualifier, the
> playback-medium rule, no `object` kind, institution versus building, what release_date means,
> abridgement, and the rule for what is worth being an edition.

That is eight items: F8, B2, B4, B5, B6, B7, B8, B10. All eight verified present in SPEC.md.
**But the pass made ten recommendations, and the three not on that list are the three the pass
itself flagged as the expensive ones.** Its own closing line, `harry-potter-pass.md:554-556`:

> **The two findings that would have hurt most if found after the first migration are B1 and
> B9**, because both are frozen or column-shaped, and both are invisible until you catalogue a
> book rather than a television story.

Neither B1 nor B9 is in SPEC.md. Grep confirms: `created_by` appears once in SPEC.md, at
line 522, as a bare entry in the seeded property list with no reference target stated;
`fictional author`, `Scamander`, `Beedle` and `Whisp` return nothing; `editions` at SPEC.md:317-318
carries only `medium` and `is_default`. Neither appears in `resolution/` either — that pass
covered X1-X13, G1-G11 and R3-R13, and the B-findings were never in its scope.

### LOST if deleted

**L4. B1 — the reference target of `created_by`, which freezes at creation.**
`harry-potter-pass.md:23-55`. Three genuinely published books in the demo's own flagship group
are credited to characters: *Fantastic Beasts and Where to Find Them* (Newt Scamander),
*Quidditch Through the Ages* (Kennilworthy Whisp), *The Tales of Beedle the Bard* (Beedle the
Bard). The pass calls it (line 41):

> **This is the sharpest finding of the pass.** It is a day-one decision, it is expensive to get
> wrong, and the prompt does not currently prompt anyone to make it.

Its resolution, which SPEC.md does not state:

> - `created_by` stays typed to `person`, and points at Rowling. That is the true fact and the
>   one every provider will supply.
> - The in-universe attribution is a SEPARATE property pointing at a character.

Why it matters: SPEC.md:509 says "Datatype and reference target FREEZE at creation", and
SPEC.md:215-217 says `person` is real humans only. **`f36a8af` sharpened this rather than
softening it:** SPEC.md:86-88 now puts "`statements` and the `properties` catalogue" in
migration 1 by name, as one of the few things "that cannot be retrofitted". So the seeded
properties' frozen attributes are now, explicitly, a migration-1 decision. So an implementer seeding `created_by` has
exactly two options, one of them permanent and wrong, and the document gives no steer. This is a
migration-1 decision with no home.

**L5. B3 — the value-kind of `category`, which also freezes at creation.**
`harry-potter-pass.md:80-100`. `category` is the escape hatch SPEC.md leans on hardest: it
carries finer typing (SPEC.md:220-222), `fictional: true` (SPEC.md:834-836), tags
(SPEC.md:1269-1270), abridgement (SPEC.md:369-370), stage productions and games
(SPEC.md:338-341). SPEC.md:499-500 says properties have a value-kind (literal vs item) and
SPEC.md:509 freezes it, and SPEC.md:86-88 now puts the properties catalogue in migration 1.
**SPEC.md never says which one `category` is.** The pass recommends item,
with a reason SPEC.md's own model depends on:

> **Recommendation: item.** 3.9 puts rule-derived containers in the model and the obvious rule is
> "everything with category X". That rule is far easier to express and index against an item id
> than a matched string, and string-matched membership is exactly the failure P4's evidence
> records against Plex's cross-library collections.

SPEC.md:284-289 does ship rule-derived containers, and SPEC.md:188-192 does cite Plex's
string-matched collections as a failure. So the argument's two premises are in SPEC.md and its
conclusion is not.

**L6. B9 — `language` as a column on `editions`.** *(Weakened by `f36a8af`, not answered.)* `harry-potter-pass.md:188-209`.

> But `editions` carries only `medium` and `is_default`. **There is no language column.**
> Language appears in the model exactly once, on a sidecar FILE, for subtitle tracks.
> …
> **Recommendation: `language` is a column on `editions`.** It meets the stated test for a column
> exactly as `title`, `sort_name` and `release_date` do on items, and leaving it as a statement
> means every edition list query joins to statements to render its own labels.

Still true of the current SPEC.md. `resolve-tierA.md:397-460` (G2) considered language at length
and upheld `statements.language` and the `title` column — it never considered a column on
`editions`, so this was not resolved against, it was never asked. The vertical-slicing reversal
does soften the urgency: `editions` is no longer in migration 1 (SPEC.md:86-101 lists what is,
and it is not there), so adding the column later is now an ordinary additive migration rather
than a retrofit. The recommendation is still unanswered; it is no longer expensive to answer late. Note this is the one finding
where SPEC.md moved *further away*: SPEC.md:355 now says one Harry Potter novel has "80+
translations", making the case sharper than when the pass filed it.

**L7. F5 — the reason `placements.edition_id` exists.** `harry-potter-pass.md:326-332`. The
column is in SPEC.md:240 and is explained nowhere in SPEC.md. The pass gives the justification:

> The 4K box set contains the 4K editions specifically, not "the films". … Useful because
> `placements.edition_id` currently reads as a Doctor Who accommodation, and it is not.

Every other column in the SPEC.md model block carries its reason. This one does not, which makes
it the one an implementer is most likely to drop as unexplained.

**L8. The provider-sequencing note.** `harry-potter-pass.md:494-504`:

> TMDB is film and television only. The seven novels' covers, publishers, ISBNs and publication
> dates come from neither of the two providers named in the stop condition, so the Harry Potter
> demo group needs a book provider, and Taylor Swift needs MusicBrainz. … it needs four providers
> to look the way it is described.

SPEC.md:1488-1489 carries the MusicBrainz half. The book-provider half and the four-provider
count are nowhere. This matters because SPEC.md:1459-1471 describes the demo as shipping with
Harry Potter's books, covers and dates, on a stop condition that funds two providers.

### Also lost, lower value

- **F2's mechanism note** (`:283-297`): Gambon and Regbo both appear as Dumbledore in *Deathly
  Hallows Part 1*, so "`portrayed_by` qualified by work is not enough to disambiguate on its own;
  two portrayals share one work" — and Hugh Laurie's voice-only performance needs a second
  qualifier distinguishing voice from physical. SPEC.md:1465-1467 carries the *case* in the demo
  list; SPEC.md:493-494 describes `statement_qualifiers` only as "in this work, in this place, at
  this time", which is precisely the shape the pass says is insufficient.
- **F1's detail** that the *Philosopher's/Sorcerer's Stone* film was shot with alternate takes for
  every scene naming the stone, so there are two film editions as well as two text editions.
  SPEC.md:355 compresses this to "two texts".
- **F4's confirmation** that the 2001 textbook and the 2016 film share a title with no adaptation
  between them — independent, outside Doctor Who, of why `lookup` is required. SPEC.md:564-567
  keeps the rule and a different example.

### Nothing here contradicts SPEC.md

Every B and F finding is either applied, unapplied-but-still-true, or an example SPEC.md replaced
with an equivalent. The only stale references are internal (`3.18`, `P7`, `3.27` numbering from
`decisions.md`), and one factual drift the pass itself caused: `:1163` of `decisions.md` said
Dumbledore was played by three actors, the pass corrected it to six, and SPEC.md:1465 carries six.

---

## Summary of what would be lost

| # | Thing | Where it lives now | Why it matters |
|---|---|---|---|
| L1 | Second provider should be cheap, not TMDB — "Confirm" | GRILL:28 | Changes a stop condition |
| L2 | CMPP expansion is an open decision | GRILL:22 | Content survives in `resolve-tierA.md:985`; the flag does not |
| L3 | D1 taken against advice, with the advice | GRILL:34 | Standing caution against backlog creep |
| L4 | B1 `created_by` reference target | HP:23 | Frozen at creation; "sharpest finding of the pass" |
| L5 | B3 `category` value-kind | HP:80 | Frozen at creation; every escape hatch depends on it |
| L6 | B9 `language` column on editions | HP:188 | Column-shaped, retrofits badly; never considered by G2 |
| L7 | Why `placements.edition_id` exists | HP:326 | Only unexplained column in the model |
| L8 | Demo needs a book provider, four total | HP:494 | Demo as described is unfundable by the stop condition |
| L9 | P16: P14 stays in the log, by decision | dec:1442 | A prior decision anticipating this deletion |
| L10 | P14 Ubooquity / Readarr / Sick Beard | dec:1361 | Not in `build-order/`; the survival-variable case |
| L11 | Do not rename again | dec:1397 | Renamed twice; Karakeep's rename cost measured |
| L12 | Three unfixed criticisms of SPEC.md | dec:1520 | All three still true at HEAD |
| L13 | Four scaffolders ruled out + Renovate trap | dec:1336 | Two are in Jacob's own stars |
| L14 | Named fixture rows | dec:785 | SPEC.md names shapes, not rows |
| L15 | Datomic / delta argument for statements | dec:438 | "An argument nobody had made" |
| L16 | Salvage manifest, incl. advisory-lock + P0001 + PGlite | 01:245-276, 06 | Only implementation guidance for the DAG and the test harness |
| L17 | Drive sync wedged-cursor landmine | 06:120 | Second half of a refusal SPEC.md states |
| ~~L18~~ | ~~File-identity test vector~~ | **WITHDRAWN** — superseded by `verify-plex-claims.md:242-346` | — |
| L19 | Row-count sizing, "nothing exceeds 10M" | 13:40 | The affordability verdict on the whole design |
| L20 | Citation markers, views-not-tables, literal traps | 13:126, 13:34, 13:84 | Silent corruption of a first import |
| L21 | Provider licence matrix + no-legal-source list | 02 | Direct input to L1 |
| L22 | Standards scope notes and two trap-refusals | 15, 09 | Makes SPEC.md's assertions checkable |
| L23 | Why attempts stop; the 14-day rule; the stopping paragraph | 01:41,422 | SPEC.md has the rule without the reason |
| L24 | Trademark exposure, unverified, £170 to close | 01:287 | Open legal risk on the product name |
| L25 | "Do not lead with the DAG"; TMDB Collection Bible; audience sizing | 01:333 | Positioning and scope sanity check |
| L26 | Pipeline findings + `sync-tardis.py` revision-skip bug | 01:375 | Live bug in the fixture's source |
| L27 | Reasons behind the STANDING RULES vocabulary bans | 08:51 | CONTEXT.md has the bans, not the arguments |
| L28 | The vapour catalogue behind "no database enums" | 08:22, 17:125 | Evidence for a rule stated bare |
| L29 | The portfolio rationale | 01:320, dec:380 | `HANDOFF.md` carried it and was deleted at `2e8aea5` |
| L30 | Incumbent facts outside the sweep's Plex/Jellyfin scope | 10, 03, 07 | Includes the Plex-moderator sourcing rule |

**29 distinct losses** (L18 was filed and then withdrawn on re-check — see section 1), of which
L4, L5, L9, L24 and L26 are the ones that would be expensive or impossible to recover.

## Contradictions found

S1 (GRILL's X1-half-closed note), S2 (GRILL self-contradiction), S3-S11 (`decisions.md`: the stale
TMDB attribution string, eight kinds, force-complete, `.nfo`, `chapters`, URL encoding, OPDS,
progress constants, medium counts), S12-S14 (archive: rename Item→Work, `object`/`issue`/`unknown`
kinds, `membership_rule`/`ordering_id`), S15-S16 (`decisions.md`: P2 reversed, P17's premise
gone). **Sixteen.** None reveals a defect in SPEC.md; all are
older positions the document has since moved past, and each is a reason the file should not be
read cold rather than a reason to delete it.

Two contradictions were found *inside the surviving documents*, and are noted as a by-product:

- **SPEC.md:696 says "70 `Medium` values"; SPEC.md:1527 says "71 distinct values".** One is wrong.
- **`resolve-counter-signals.md:1744-1748` (R12) recommends a one-sentence OPDS refusal be added to
  SPEC.md after "Do not re-argue it, and do not quietly drop them either". It was not added.**
  SPEC.md:1435-1439 still carries the OPDS evidence with no verdict, so whether a client protocol
  is refused or merely undecided is currently ambiguous in the live document.

## Recommendation

None of the four is safe to delete today. Three become safe cheaply:

1. **`GRILL-DECISIONS.md`** — carry L1, L2 and L3 (about six lines) into SPEC.md or a short
   open-questions file. Then delete.
2. **`harry-potter-pass.md`** — decide B1, B3 and B9 and write them into SPEC.md; add L7's
   one-line reason to `placements.edition_id` and L8's sentence to the demo section. Then delete,
   and SPEC.md:1495-1501's "DO NOT REPEAT IT" becomes true rather than nearly true.
3. **`decisions.md`** — L9 forbids it. If the release-cadence log is genuinely wanted out of the
   way, that is a new decision reversing P16, and L10-L15 need somewhere to go first.
4. **The forensic record** — keep. Delete `05-the-prompt.md`, `16-file-identity.md`, `04`'s
   V-ladder section and `03`'s Plex/Jellyfin sections (~650 lines) if the directory needs shrinking, and add a header to
   `09-industry-vocabulary.md` and `13-model-sizing.md` saying which of their recommendations were
   refused (S12, S13), because those two read as live advice.
