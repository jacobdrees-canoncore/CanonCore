---
status: proposed
---

# Enrichment reaches every provider at once

Each provider is matched independently to its own record, and agreeing identifiers between
providers are evidence they describe the same work.

A single primary source with others filling gaps is refused: that is Jellyfin's design, it merges
first-non-empty-wins and DISCARDS the losing answers, and it is why Jellyfin can never say where a
value came from. Matching and applying are also separate operations with separate endpoints,
because a separation living only in a screen design gets collapsed by the next screen design —
OpenRefine's reconciliation API separates the two OPERATIONS — `queries` for matching, `extend` for
applying — though both go to the same endpoint distinguished by parameter rather than to separate
paths, and data extension is an optional capability a service must declare in its manifest. Koha
evaluates overlay rules as a policy at commit.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-products.md`.

## Half built, under CNCORE-361 -- and this record stays PROPOSED

**BUILT: MATCHING, FOR WORKS, ON A BROWSE.** When a browse writes a work its Provider has never
sent before, `matchArrivingWork` (`packages/db/src/matching.ts`) scores it against every live,
non-container Item another Provider holds that shares its day of release or could share its title,
as that Provider titles and dates it. Each Provider is matched against the other's own claims, never
against a merged value, which is this record's first sentence. Above ADR-0027's high bar the arriving
record is written onto that Item, which then carries both Providers' external ids and both
Providers' values, each still sourced; the band is handed over as a candidate pair; below the low bar
nothing is kept. Two Items at the high bar are a question, not an answer, so both are offered and
neither applied.

**IT FOLLOWS CNCORE-368'S FINDING, `docs/research/episode-groups-and-a-scoreable-match.md`, NOT AN
ASSUMPTION.** That note measured the part-versus-story mismatch: 157 of the wiki's 159 1963 stories
have several parts, and for 132 of them TMDB's part 1 carries the story's title AND its release date,
so a title-and-date scorer accepts every one (section 3.2). A part is therefore never a story. The
scorer reads how many INSTALMENTS each Provider holds a work as (`CONTEXT.md`'s term, since the
glossary's Part is a file), and a disagreement scores zero whatever
the title and date say. The count comes from TMDB's own `(n)` titles (`The Tenth Planet (1)` to `(4)`,
`instalmentsOf`), not from the contributor-written `Story Order` group the note found and warned against
trusting (section 2.5), and not from the wiki's `Epcount`, which `provider-wiki` does not send. The
Item page names the count and says no single instalment was matched, under the claims and on any offered
row.

**WHAT THE COUNT CANNOT SEE, MEASURED:** the 1963 series' first three seasons title each part on its
own (`An Unearthly Child`, `The Cave of Skulls`), so those stories read as one instalment. Five rows of the
labelled set are exactly that (`An Unearthly Child`, `The Edge of Destruction`, `Planet of Giants`,
`The Web Planet`, `The Space Museum`), and they are the scorer's only false positives there.
ADR-0028 says how that was measured.

**NOT BUILT, AND IT IS WHY THIS RECORD STAYS `proposed`: matching as ITS OWN ENDPOINT.** Matching runs
inside `provider.browse`, separated from the write only at module level: `matchArrivingWork` decides
and writes nothing, and the import writes what it decided. This record asks for more than that, so
a later screen cannot collapse the two. There is no procedure that matches without importing, and a
`provider.import` (a lookup) never matches at all, since it names no Container to read an instalment count
from. APPLYING in this record's sense, meaning choosing among a matched record's values, is not built
either: both Providers' values are kept and the projection ranks them (ADR-0014, ADR-0025). A second
half is also missing: the wiki arriving AFTER TMDB is matched too, by the same code, but nothing
re-scores Items that were already both held when this landed. A pair is found only when a browse
meets it. All three halves are CNCORE-429.

**THE IDENTITY PIECE, UNDER CNCORE-28, IS UNCHANGED.** "This provider's record 265 is the item we
already made from this provider's record 265" is IDENTITY: one party, one namespace, no judgement,
no score. Migration 3 holds the id, and both imports find or create against (source, external id), so
a re-import refreshes rather than doubles. [[0078-entity-identity-is-a-surrogate-id]] decided the
ids' shape. A work found again by identity is never re-matched; only its instalment disagreements are
taken afresh.

## The test that stood in for it -- under CNCORE-9, retired under CNCORE-361

`apps/web/e2e/multi-placement.test.ts` needs ONE Item sitting in the wiki's ordering and TMDB's at
once. Until CNCORE-361 a real browse of each gave two Items, so the wiki's half was imported and
TMDB's was RECORDED BY HAND as TMDB's claim against the Items the wiki import had written. That hand
step did what this record's operation would do, performed by a test because nothing else could.

**IT NOW BROWSES TMDB FOR REAL**, seasons 0, 1 and 2 of `tv/57243`, and the hand-written claims are
gone. Two things changed in what the file asserts, each because a real browse does something the hand
step did not:

- *Rose*'s control was ONE placement row in the wiki's `Series 1` carrying both sources (ADR-0017).
  A browse puts TMDB's claim in TMDB's own season, since matching joins works and never Containers
  (ADR-0128). The control is now one Item, first in each of two orderings, carrying both ids.
- *Born Again* was written onto the wiki's Item. TMDB titles it `Children in Need: Born Again`, which
  scores 0.7, between the bars, so a real browse OFFERS it. The file asserts the offer.
