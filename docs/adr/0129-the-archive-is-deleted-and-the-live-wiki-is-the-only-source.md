---
status: accepted
---

# The archive is deleted, and the live wiki is the only source

> **ACCEPTED 2026-09-13, AND BOTH HALVES ARE CHECKABLE.** This is a cross-repo pair, so it flips on
> the SECOND ticket with the first's merged PR named: the recipes, the SMW version pin and
> `pnpm measure:live` landed in
> [provider-wiki#27](https://github.com/jacobdrees-canoncore/provider-wiki/pull/27), squashed as
> `9c29db7`. The gate, the re-pointed records and this file land here.
>
> **ONE CLAIM IS NOT CHECKABLE AGAINST ANY DIFF AND NEVER WILL BE: that the archive is gone.** It
> is a fact about a filesystem, asserted here by the agent that ran the `rm` on 2026-09-13 after the
> gate passed. What CAN be checked is that nothing in either repository needs it — `pnpm test` in
> `provider-wiki` was run with `~/tardis-pipeline` renamed away AND `fixture/wiki.duckdb` deleted,
> and `pnpm build:fixture` rebuilt from the committed SQL with all 165 tests passing.
>
> **WHAT IS NOT BUILT, NAMED RATHER THAN IMPLIED:** the two largest timelines still cannot be
> imported (CNCORE-151, below), and ADR-0057's "11 serials are completely missing" is left as an
> archive-era figure nobody can now reproduce. Neither is a half-built mechanism — they are a defect
> and a gap, both with a ticket or a flag on them.

`~/tardis-pipeline` (3.2GB) and `~/tardis-archive.sparsebundle` (66GB) are **gone**, deleted
2026-09-13 under CNCORE-103. There is now ONE way wiki data reaches CanonCore — `provider-wiki`
asking tardis.wiki over CMPP, on a Credential the Owner supplies (ADR-0122) — where there were two.

This record supersedes the half of ADR-0057 that treated the archive as a thing you could still
query. The other half of that record is untouched and still binding: the fixture is committed as
readable SQL in `provider-wiki`, and CI never needs anything bigger.

## Why a second source was worth ending

The archive was not costing anything to keep. It was costing something to BELIEVE.

Every figure in seven ADRs was measured against a corpus that froze on 2026-09-04, and each was
written as though it described the wiki. It described a photograph of the wiki. Nothing in either
repository said which, because the boilerplate — "Archive figures measured against
`~/tardis-pipeline` directly" — names a path rather than a date, and a path does not go stale
visibly. A reader re-deriving one of those figures against the live wiki and getting a different
answer had no way to tell a drift from a mistake.

**And the second source was never exercised.** Until CNCORE-103 nothing had imported a real
timeline live, end to end, in either repository: `apps/web/e2e`'s provider is a stub, CI's
"against the real provider" job never reached one (CNCORE-143), and `provider-wiki`'s own suite
reads a committed fixture. Every green check was a check of the harness against itself. Deleting
the fallback is what forced the live path to be proven rather than assumed.

## What it cost, stated plainly

4,127,415 revisions across 373,513 pages and 86,342 images, collected with the wiki's permission
using wikiteam3 when that was easy, and it is not easy now: a Cloudflare challenge sits in front
of the wiki and refuses every automated client. **Re-collecting it would be a project, not a
command.** That is the honest price of this record and it is written here rather than left to be
discovered.

**AND `~/tardis-pipeline` WAS NEVER UNDER VERSION CONTROL, SO ITS SOURCE IS GONE TOO.** Checked
2026-09-13 before deleting: no `.git`, no remote, and `canoncore-history` — the private repository
that keeps this project's pre-publication history — does not hold it either. The tag
`archive/tardis-pipeline-2026-09-04` that ADR-0115 records was never pushed and names nothing that
survives. So this is not a deletion anybody can undo from a remote, and a later reader must not go
looking for one: nine scripts, four ADRs of their own, and a README went with the data.

Three of those scripts are carried below as working code. The rest are not, deliberately — see
"What is deliberately NOT carried".

What makes the price worth paying is that nothing needed it. The fixture is committed, the figures
are re-derivable, and the recipes that made collection possible are carried across.

## The gate, and what it actually proved

This deletion ran only after a real `Theory:Timeline` had been imported live, end to end. That is
`apps/web/live/live-import.test.ts`, a Vitest project of its own because it needs a Credential no
CI job holds.

Measured 2026-09-13, through `next start` → `/api/rpc` → `provider.browse` → HTTP →
`provider-wiki` → tardis.wiki → Postgres:

| what | figure |
|---|---|
| timelines imported | `Theory:Timeline - Melanie Bush` (226288), `Theory:Timeline - Sixth Doctor` (105893) |
| Items landed | 475 |
| Placements landed | 534 |
| Sources | `owner`, and `provider-wiki` at its own URL |

**One Item in two Orderings, at positions that disagree**: `Business Unusual (novel)` sits at
position 2 of one and 353 of the other; `Catch-1782 (audio story)` at 30 and 371. **A story at
several positions inside ONE timeline**, which is ADR-0009's Repeat: `Terror of the Vervoids
(TV story)` at 162 and 365.

That is the product's whole argument, running on somebody else's data, for the first time.

### The gate also found a defect, and it is not fixed here

**The two largest timelines cannot be imported at all.** AHistory (249643) browses to 2,913
members at 2,669 distinct positions with 454 repeats and takes `provider-wiki` 25.4s;
`Theory:Timeline - The Doctor's TARDIS` takes 18.4s for 1,667 members. Both are past the 10s cap
in `packages/providers/src/client.ts`, and CanonCore answers `Internal server error`.

So CNCORE-102's "A large timeline imports without timing out" is FALSE against the real wiki, and
was accepted against a stub. **CNCORE-151 carries it**, with the measurement below.

**IT IS TWO OF 465, AND THE TAIL IS MEASURED RATHER THAN ESTIMATED.** Timed 2026-09-13 across 32
timelines spanning every size band, including ALL 22 pages of 80KB or more: exactly two exceed the
cap and **463 import today**. The predictor is MEMBER COUNT rather than page size — roughly 82
members resolved per second, so the cap bites at about 820 members — and page bytes mislead in
both directions: the Eighth Doctor's timeline is 199,163 bytes and answers in 5.7s, while
`Theory:Timeline - UNIT` is 99,049 bytes and answers in 0.4s because it yields no members at all.

### Why this record did not wait for that fix

**Because the archive is not a mitigation for it, and keeping it would not have been caution.**

The archive was never an import path. `provider-wiki` has served the live wiki since CNCORE-100,
and `browse` has since CNCORE-102; the archive was a measurement corpus and the source the
committed fixture was extracted from, and nothing ever imported a Container out of it. So there is
no sense in which AHistory could be imported from the archive today and cannot be tomorrow —
it could not be imported from the archive yesterday either.

Nor does holding 66GB shorten a live browse or raise a timeout. CNCORE-151 is a decision about
what a provider may hold a request open for, and every input it needs is a live measurement that
`pnpm measure:live` and `apps/web/live/live-import.test.ts` now produce on demand.

Waiting would therefore have kept the archive against a defect it cannot help with, at the cost of
leaving seven records citing a path that was going to be deleted anyway. **The honest statement of
the risk is the one this section makes: 463 of 465 orderings import, two do not, and the two are
named with a ticket rather than left to be discovered.**

## The recipes are carried, because they are not re-derivable

Three things in the deleted repository were knowledge rather than code, and none of them is in any
vendor's documentation. They live in `provider-wiki/scripts/live-wiki.ts` now, as working code
rather than prose, and every one was re-confirmed against the live wiki on 2026-09-13.

**The bulk property-graph recipe**, out of `build-smw.py`. `Special:ExportRDF` takes a BATCH of
pages per POST and returns every property of each, which beats `action=browsebysubject`'s
one-request-per-page by roughly 500x. Three traps, all load-bearing:

1. **`postform=1` is what makes it take a batch.** Without it the endpoint answers the single page
   in the URL and silently ignores the `pages` body.
2. **SMW encodes names as `-XX` hex with `_` for space**, so `Rose_-28TV_story-29` is
   "Rose (TV story)". Spaces are substituted BEFORE the hex, because a literal underscore arrives
   as `-5F` and a hex-first pass turns it into a space too.
3. **A property is written TWO ways in the same document.** SMW emits `<property:Featuring>` when
   the name is a valid XML element name and falls back to `<wiki:Property-3A2D_artist>` when it is
   not — which is every property starting with a digit. Measured on three story pages: 82 names in
   the first form and 5 in the second. build-smw.py's own comment is the warning worth keeping:
   "Matching only one silently drops most of the graph."

**The clearance-capture recipe**, out of `cf-clearance.mjs`. Solve the Cloudflare challenge once in
a real, NON-headless, PERSISTENT Chrome context, wait for `document.title` to stop starting with
"Just a moment", and keep TWO values: the `cf_clearance` cookie AND `navigator.userAgent`. The
clearance is bound to the User-Agent that earned it, so a capture that keeps only the cookie
produces a session that looks valid and is refused — which reads as an expiry rather than as a
mismatch, and sends the reader to renew something that was never wrong.

## The wiki's version is pinned, because current documentation is wrong about it

**tardis.wiki runs MediaWiki 1.39.11 and SemanticMediaWiki 4.2.0**, read from
`action=query&meta=siteinfo&siprop=general|extensions` on 2026-09-13 and pinned in
`provider-wiki/scripts/live-wiki.ts` as `WIKI_SOFTWARE`.

**`action=browsebysubject` was REMOVED in SMW 7.0.0 and works here.** So a reader who checks
Semantic MediaWiki's current documentation before checking the version will conclude a working
call is impossible. Anything written against current SMW docs is wrong about this wiki.

## Two things measuring live taught us that the archive could not

**`ask`'s `offset` silently wraps to the first page past 10,000.** It does not error. Measured
2026-09-13 against `[[Pagename::+]]` at `limit=5000`: offsets 0 and 5,000 return two distinct
pages, and offsets 10,000 and 15,000 BOTH return the offset-0 page again. A loop that pages until
it sees a short page therefore never terminates and counts the first 5,000 rows over and over — it
reported 65,000 pages for a property carrying about 11,000 before the duplicates were noticed. So
**every count is driven by `list=` with a continue token, or by an enumerated title list, never by
paging an `ask`.**

**A multi-value parameter splits on `|`, and page titles contain `|`.** MediaWiki's documented
escape is obscure and exact: a list whose FIRST character is U+001F is split on U+001F instead.
Without it, `File:A|B.jpg` is asked about as two titles that both come back missing, so a
dangling-image count inflates by the split halves of every title containing a pipe.

## What is deliberately NOT carried

The deleted repository held four ADRs of its own — wikiteam3 over a bespoke exporter, archive full
history then derive latest, the case-sensitive filesystem, and incremental sync keyed on an
`arvcontinue` token. **None is carried, and that is the decision rather than an oversight.** They
are all knowledge about how to ARCHIVE a wiki, and this record is the one that stops archiving it.
Carrying them would preserve, in the repository that ended the practice, the instructions for
resuming it.

`extract-fixture.ts` went the same way: it regenerated `provider-wiki`'s `fixture/rows.sql` from
the archive, and the SQL is committed, small enough to read, and edited by hand from here on.
Rebuilding the whole roster from the live wiki is a ticket nobody has needed yet, and a generator
nothing runs would be the speculative half of this change.

## Evidence

Every figure the seven records `pnpm measure:live` covers took from the archive was re-derived from
the live wiki on 2026-09-13 by that script, which replaced the five scripts that opened the deleted
DuckDB. ADR-0016, 0030, 0057, 0060, 0070, 0073 and 0077 each carry their own re-measured figures and
the date.

**THE COUNT WAS EIGHT RECORDS, NOT SEVEN, AND THIS SENTENCE SAID SEVEN UNTIL CNCORE-157.** ADR-0128
took 464 timelines, 1,240 namespace pages and 703 unplaced bullets from the archive too, and it was
missed here because its figures belong to a DIFFERENT script: they are `pnpm measure:timelines`'s and
are reported in `provider-wiki`'s `fixture/timeline/COVERAGE.md`, so a sweep that went record by
record through `measure:live`'s outputs never reached them. They sat unrefreshed while the two
records either side of this one stated the live counts, which is how `docs/adr/` came to assert two
sizes for one population. CNCORE-156 re-derived them on the provider side and CNCORE-157 brought
them across.

**The live figures are not corrections of the archive's and must not be read as such.** The
archive froze on 2026-09-04 and was measured on 2026-09-10; the wiki has been edited since, and
the two were measured under filters stated differently. Where a figure moved, the record says what
each population was rather than declaring an old number wrong — `docs/research/verify-new-adrs-archive.md`
stays as the archive-era working, labelled as the frozen thing it is.
