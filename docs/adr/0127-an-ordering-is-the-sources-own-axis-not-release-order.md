---
status: proposed
---

# An ordering is the source's own axis, not release order

`browse` hands over a Container AND its ordering (ADR-0033), and until CNCORE-102 the only
Container `provider-wiki` served was a wiki **Category**, ordered by release date. That was correct
for a category and it quietly became the contract in everyone's head: a provider's ordering was the
order things came out.

**IT IS NOT, AND THE WIKI IS THE COUNTEREXAMPLE THAT MATTERS.** tardis.wiki writes 464
`Theory:Timeline` pages, each stating an IN-UNIVERSE chronology — and that is the axis this product
exists to carry, because it is the one a folder tree cannot. Measured 2026-09-12 over one timeline
against one release list, TV stories only: **113 of 298 adjacent pairs are reversed in-universe**,
38%. Serving a timeline in release order would answer with the very ordering the page was written to
contradict.

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
and `== Awaiting placement ==` headings — **703 story bullets across 125 pages**, measured
2026-09-12.

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

The obvious predicate for the wiki was the namespace, and it is wrong by 776 pages: namespace 114
(`Theory:`) holds **1,240 non-redirect pages and only 464 are timelines**. The rest are
discontinuity-and-plot-hole pages, which state no ordering at all, and accepting the namespace would
serve all 776 as Containers ordered by whatever bullets sat under their first heading. The wiki names
the thing in the TITLE, so the title is the predicate; a category is told apart by its namespace
because there the namespace is what the wiki uses to mean it.

The general rule for a provider: **read the predicate the source actually uses to mean the thing.**

## And the Container's `kind` says which, because the two are not the same thing

`provider-wiki` answered the constant `"category"` for every Container it served. True while a
category was the only one; a lie the moment a timeline was. `kind` is the source's own word
(ADR-0033 closes no list), and the two kinds differ in the axis their ordering carries — which is the
one thing a reader of that field most needs not to be misled about.

## As built (CNCORE-102)

CanonCore needed **no change** to import any of this, and that is the finding worth recording.
`importBrowsedContainer` already writes a member at several positions as several Placements
(ADR-0009's Repeat), already writes an `unplaced` member as a Placement with no position, and already
finds every member by the id the provider knows it by, so a re-browse adds nothing (CNCORE-28). One
timeline exercised all three at once: `Theory:Timeline - Doctor Who universe/TV` browses to **611
placements over 426 distinct stories, 105 of which sit at more than one position**, highest position
548 — measured live 2026-09-13.

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
