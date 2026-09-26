---
status: accepted
---

# An ordering is the source's own axis, not release order

`browse` hands over a Container AND its ordering (ADR-0033), and until CNCORE-102 the only
Container `provider-wiki` served was a wiki **Category**, ordered by release date. That was correct
for a category and it quietly became the contract in everyone's head: a provider's ordering was the
order things came out.

**IT IS NOT, AND THE WIKI IS THE COUNTEREXAMPLE THAT MATTERS.** tardis.wiki writes 465
`Theory:Timeline` pages — counted 2026-09-13 over `ns 114, title starts Theory:Timeline,
non-redirect` — each stating an IN-UNIVERSE chronology, and that is the axis this product exists to
carry, because it is the one a folder tree cannot. CNCORE-102's own measurement, taken
2026-09-12 over one timeline against one release list, TV stories only: **113 of 298 adjacent pairs
are reversed in-universe**, 38%. That figure is CARRIED FROM THE TICKET rather than re-derived here,
and the decision does not turn on its exact value — only on the two axes disagreeing in bulk, which
the import below shows independently: `City of Death (TV story)` sits at position 11 of one timeline
and 200 of another, and release order would put it at neither. Serving a timeline in release order
would answer with the very ordering the page was written to contradict.

So the rule is: **an ordering is a DATED CLAIM BY A NAMED SOURCE (ADR-0017), and its AXIS is the
source's too.** Release order is one such claim, not the shape of the operation.

## Which axis a provider may use is decided by what the source states, not by what is convenient

- A **category** states MEMBERSHIP and no sequence whatever. Any order a provider reports for one it
  has COMPUTED, and a release date per story is the only thing the wiki holds that computes into an
  order without inventing a claim. Ties share a position and nothing breaks them (ADR-0009).
- A **timeline** STATES a sequence, in its own bullets. The provider reads it and reports it. It may
  not improve it, date it, or fill it in.

A provider that cannot honestly compute an axis for a container serves the members with no position
rather than guessing one. That is what `unplaced` is for, and it is why that field is not a tail of
the ordering.

## `unplaced` means the SOURCE declined to place it, never that the provider failed to read it

CMPP's `unplaced` is "members this provider serves that THIS ordering cannot place". CNCORE-102 had
to decide what that covers on a wiki that writes its own `== Unplaced ==`, `== Currently unplaced ==`
and `== Awaiting placement ==` headings. Counted 2026-09-13 over `ns 114, title starts
Theory:Timeline, non-redirect`, the wiki's own unplaced sections hold **719 story bullets across 125
pages**, which is `fixture/timeline/COVERAGE.md`'s row for them. That count has moved twice, and both
of the figures it moved from are the ARCHIVE's, read over its own differently-stated filter
`ns = 114 AND title LIKE 'Theory:Timeline%' AND is_redirect = false` against a corpus frozen
2026-09-04 (ADR-0129): CNCORE-118 took **703 story bullets across 125 pages** from it on 2026-09-12
under the rule CNCORE-97 stated rather than the one that shipped, and an earlier pass reported 729
across 136 from a looser link regex. The decision turns on the count being large, not on its exact
value.

**Those are members with no Position.** The heading is the wiki asserting that a story belongs to
this ordering and that it will not say where, which is `CONTEXT.md`'s **Unplaced** exactly: "a member
of a container no source has given a position in". Dropping them would answer with a Container that
silently omits stories the source explicitly lists, and nothing on the page would say so.

**A member the PROVIDER could not resolve is in NEITHER list.** That is a fact about this
repository's parser, not a claim the wiki made, and `BrowseResponseSchema` already says a member that
is not a record this provider serves appears in neither. Collapsing the two would report our parse
failure as the source's statement — and they arrive indistinguishable as a bare `null`, which is why
`provider-wiki`'s parser carries a REASON beside the absent position rather than only the absence.

## What makes a page a Container is what the source calls it, which is not always its namespace

The obvious predicate for the wiki was the namespace, and it is wrong by 776 pages: counted
2026-09-13 over `ns 114, non-redirect`, namespace 114 (`Theory:`) holds **1,241 non-redirect pages,
of which 465 are timelines and the other 776 are not**. Those 776 are discontinuity-and-plot-hole
pages, which state no ordering at all, and accepting the namespace would serve every one of them as a
Container ordered by whatever bullets sat under its first heading. The wiki names the thing in the
TITLE, so the title is the predicate; a category is told apart by its namespace because there the
namespace is what the wiki uses to mean it.

**BOTH HALVES ARE COUNTED, OVER THAT ONE LISTING, AND SAYING SO IS THE POINT.** `the other 776` was
`1,240 - 464`, and both of those are the ARCHIVE's: 464 over `ns = 114 AND title LIKE
'Theory:Timeline%' AND is_redirect = false`, 1,240 over that same filter without its title clause,
read 2026-09-12 from a corpus frozen 2026-09-04 (ADR-0129). CNCORE-156 counted the two halves
separately against the live wiki instead, because a subtraction does not stop being one for being
spelled in words. It is the dangerous kind of wrong method, too, because it went on producing the
RIGHT answer: each live count differs from the frozen one by one, so the remainder was still 776 when
both of its inputs had moved. Nothing checking the answer could have caught it.

**AND NONE OF THESE FIGURES IS THIS REPOSITORY'S TO MEASURE.** CanonCore asks the wiki nothing and
counts nothing; every corpus figure above belongs to `provider-wiki` and is stated in its
`fixture/timeline/COVERAGE.md`, which `pnpm measure:timelines` regenerates. That report is COMMITTED
and reading it needs no Credential, which is what makes it the right thing to point a reader at —
the script behind it needs the Owner's (ADR-0122), so a reader sent to the script instead could check
nothing. Those figures move as editors edit the wiki, so one here that disagrees with the report is
this record being stale rather than the report being wrong.

The general rule for a provider: **read the predicate the source actually uses to mean the thing.**

## And the Container's `kind` says which, because the two are not the same thing

`provider-wiki` answered the constant `"category"` for every Container it served. True while a
category was the only one; a lie the moment a timeline was. `kind` is the source's own word
(ADR-0033 closes no list), and the two kinds differ in the axis their ordering carries — which is the
one thing a reader of that field most needs not to be misled about.

## As built (CNCORE-102)

**ACCEPTED RATHER THAN PROPOSED, AND THE MERGED PR IS WHY.** This record's mechanism spans two
repositories — the serving half is `provider-wiki` and the contract half is here — so nothing in
this repository's diff can show that the first half exists. It is
[provider-wiki#26](https://github.com/jacobdrees-canoncore/provider-wiki/pull/26), merged
2026-09-13 as `15ac869`, and a reviewer can check every claim below against that diff rather than
against this sentence. CLAUDE.md's rule for a cross-repo pair: the flip lands on the SECOND ticket
and names the first's merged PR, or it is an assertion nobody can check.

CanonCore needed **no change** to import any of this, and that is the finding worth recording.
`importBrowsedContainer` already writes a member at several positions as several Placements
(ADR-0009's Repeat), already writes an `unplaced` member as a Placement with no position, and already
finds every member by the id the provider knows it by, so a re-browse adds nothing (CNCORE-28).

Measured live on 2026-09-13, importing two real timelines through `browseIntoCatalogue` against
tardis.wiki. These are figures about the LIVE wiki, so they move as editors edit it, and what
produced them is the import path itself rather than a script:

- **A Repeat inside ONE ordering**: `City of Death (novelisation)` sits at ten positions in
  `Theory:Timeline - Scaroth` — 3, 4, 5, 6, 7, 8, 9, 10, 11 and 14 — as ten Placements of one Item.
- **One Item across SEVERAL orderings**, which is the different claim and the one this product
  exists for: after importing Scaroth and `Theory:Timeline - Doctor Who universe/TV`, `City of Death
  (TV story)` holds five Placements across **two** containers, at positions 6, 11, 14, 40 and 200. A
  `series_index` column holds one of those and locks the reader out of the rest (ADR-0018).
- **Size and time**: the TV timeline is 611 placements over 426 distinct stories, highest position
  548, imported in **8.4s**. The provider's own browse of it is 20 requests in 1.7–4.9s depending on
  batch size. The cost is dominated by requests to the wiki rather than by writing Placements —
  and the sentence that stood here, "nothing is near a timeout", was TRUE OF THESE TWO PAGES AND
  FALSE OF THE WIKI. It was measured on a 611-placement timeline; the largest the wiki holds is
  `Theory:Timeline - Doctor Who universe/AHistory` at 2,913, which needs ~25.9s and so could not be
  imported at all under the single 10s cap every provider call carried. CNCORE-151 found it and
  ADR-0130 splits that cap by the size of the question. Measuring the timeline a ticket happens to
  be about says nothing about the largest one a source holds.
- **A repeat import is safe**: browsing Scaroth a second time left the catalogue at 629 Placements,
  the number it already held.
- **Every Placement carries the provider as its source** (ADR-0017): 629 of 629.

**THE CONTRACT SUITE GAINED A BRANCH IT COULD NOT EXERCISE BEFORE.** ADR-0122 obliges a provider that
cannot reach its source to say so rather than serve a frozen corpus, and CNCORE-141 wrote that into
the contract for `search` and `lookup`. It was never "except browse" — but while `browse` read a file
on disk, no participant could demonstrate it: that operation answered a Container whatever the
credential said. It answers `503` now, so the contract holds it to the same rule.

**TWO LIMITS BIT, AND BOTH WERE INVISIBLE AT THE SIZES THE OLD FIXTURES USED.** They are recorded
because the second is the dangerous kind:

- **`414 Request-URI Too Large`**, at 20,813 URL bytes, asking about every member of the largest
  timeline in one request. Loud, and fixed by batching.
- **Semantic MediaWiki refuses a query naming more than 16 subjects — and reports the refusal as
  `200` with an EMPTY result set and a warning.** Measured on this wiki 2026-09-13: 16 subjects
  answer with 16 results, 17 answer with zero and "could not be considered due to this wiki's
  restrictions on query size or depth". Read as an answer, it serves every story in the batch with no
  release date, no writers and no series, and nothing says so. `Category:Stories with missing
  episodes` browsed to 27 members with **every one of them undated**, while `lookup` on the same page
  ids answered with their real dates.

The second is `unplaced` meaning the wrong thing one layer down: an ordering that cannot place a
single member because the provider never got the dates, presented as a source that holds no dates. A
provider must read a refusal as a refusal — the same rule ADR-0122 states about a credential, applied
to a query limit.

## Under CNCORE-360: the second Provider's programme and seasons are Containers of their own

A TMDB programme browsed into the catalogue is a Container ordered the way TMDB published it, with
specials first because TMDB files them as season 0 and returns them first. Each season is a Container
in turn, because the record says so (`is_container`, [[0033-search-lookup-required-browse-optional]],
"And under CNCORE-360"). So the Owner descends from a programme to a season, and the season's
episodes are CNCORE-375's.

**THE TWO PROVIDERS' ORDERINGS STAY TWO CONTAINERS, and nothing had to be built for that.** A
Container is found again by (source, external id) and never by title, so TMDB's `Doctor Who` and a
wiki timeline over the same stories land apart, each holding its own members in its own order. That
is asserted at the router in process ("a series and its seasons", `provider.test.ts`), because a
reader of this record should not have to take "nothing fuses them" on trust.

**SEASON COVERAGE, STATED RATHER THAN ASSUMED.** Over the seasons TMDB lists for its three `Doctor
Who` programmes (`tv:121`, `tv:57243` and `tv:239770`, 27 + 14 + 3 = 44 seasons), read from
`/3/tv/{id}` on 2026-09-26, which is the answer the browse itself reads: **44 of 44** carry an
overview and **44 of 44** a poster. The spec's 7.8% and 43.0% were counted on 2026-09-21 over a
different population, and these figures do not replace them, since they describe the headline
franchise alone. And WHAT THIS IMPORT HOLDS of either is **none**. No `description` Property exists
yet, and artwork is CNCORE-358 and CNCORE-372's, so a season arrives as a title, a release date, an
external id and its place in the programme's ordering, and nothing more.

## Under CNCORE-375: a season's episodes, and the depth where the source thins out

A season's episodes arrive by browsing the season, which answers them at the numbers TMDB gives
them. Nothing new was built for that: `provider-tmdb` already answered a season's browse with its
episodes, and CanonCore's browse already writes an ordering. So the Owner descends programme, season,
episode, asserted at the router in process ("a season's episodes", `provider.test.ts`).

**NOT BUILT: getting there by descending.** Browsing a programme brings its seasons and not their
episodes, and a season's page offers nothing that fetches them. So the Owner fetches a programme's
episodes by handing its season ids to a run (`pnpm import:list`) or by typing each one on `/import`,
and a season's page holds no members until then. The descent works in the catalogue once they are
fetched. Reaching them from the season's own page is CNCORE-428.

**EPISODE COVERAGE, over the episodes actually imported.** The population is every season TMDB lists
for its three `Doctor Who` programmes (`tv:121`, `tv:57243`, `tv:239770`: the same 44 seasons as
above), browsed into the catalogue through the router on 2026-09-26: **2,465 episodes**, every one
read back as an Item page. What an episode page shows, and how many carry it:

| field on the page | episodes carrying it |
| -- | -- |
| title | 2,465 (100%) |
| release date | 2,387 (96.8%) |
| `tmdb` id | 2,465 (100%) |
| `imdb` id | 0 |
| `tvdb` id | 0 |

**NO EPISODE ARRIVES BY BROWSE WITH AN IMDb OR TVDB ID**, and that is the season endpoint, not a
loss: `/3/tv/{id}/season/{n}` carries no per-episode `external_ids`, and a `lookup` of one episode
does (`append_to_response=external_ids`). Fetching them in a browse would cost one request per
episode, 1,398 for the largest season. Nothing here needs them, so none are fetched.

**THE FIELDS NO PAGE DRAWS YET**, read from the same 44 season answers on the same day, so the ticket
that draws one reads its episode rate first rather than its work rate:

| field | episodes carrying it | the spec, 2026-09-21 |
| -- | -- | -- |
| overview | 1,967 (79.8%) | 25.3% |
| still | 1,411 (57.2%) | 18.0% |
| any crew | 959 (38.9%) | 12.1% |
| any vote | 1,029 (41.7%) | 4.8% |
| production code | 61 (2.5%) | 0.7% |

The spec counted its figures over the second Provider's episodes of a series it does not name, and
these do not replace them: they describe the headline franchise alone, the richest programme TMDB holds of this
catalogue's. Two in five episodes carry no crew and three in five no vote even here. So a credits
surface (CNCORE-369) or a description (CNCORE-357) drawn against a film's 88.5% renders empty on most
episodes, and an Item page says what a Provider gave none of rather than drawing the empty row
([[0204-an-entity-page-is-drawn-against-what-entities-carry]], "Under CNCORE-375").
