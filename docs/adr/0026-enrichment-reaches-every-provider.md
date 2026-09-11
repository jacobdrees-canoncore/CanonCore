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

## Not built -- and the one piece that was not really matching is now built, under CNCORE-28

Nothing matches. There is no scoring, no threshold, no review queue and no endpoint.

What has changed is the piece this section was written to name. An item used to carry NO external
identifier: `importProvidedRecord` took the provider's own id and dropped it, because only a
migration may add a property (ADR-0029) and none held one -- so a second import of one record from
one provider wrote a SECOND ITEM, and a second browse of one container wrote a second container and
a second copy of every member, silently. Migration 3 holds the id and both imports now find or
create against (source, external id), so a re-import refreshes rather than doubles.

**IT IS NOT THIS RECORD'S OPERATION, WHICH IS WHY IT NEEDED SAYING HERE.** "This provider's record
265 is the item we already made from this provider's record 265" is IDENTITY: one party, one
namespace, no judgement, no score. This record's matching is the harder claim that two DIFFERENT
providers' records describe one work, and its own sentence is the reason the two are separable --
"each provider is matched independently to its own record, and agreeing identifiers between
providers are evidence they describe the same work". The identifiers had to exist before they could
agree, and now they do. [[0078-entity-identity-is-a-surrogate-id]] decided their shape and records
which half of itself CNCORE-28 built.

So the mapping is built and this record's operation stays unbuilt behind it. A reader finding
duplicate items from ONE provider should stop expecting them; a reader finding one item per provider
for one story is looking at the thing this record has not done yet.

## Its absence is now load-bearing on a test -- under CNCORE-9

**A COMMITTED TEST NOW DEPENDS ON THIS RECORD NOT BEING BUILT**, which is a thing a reader of the
paragraph above should be warned about before they build it.

`apps/web/e2e/multi-placement.test.ts` needs ONE item sitting in the wiki's ordering and TMDB's at
once. A real browse of each gives two items -- one per provider, which is exactly the state the
section above describes -- so the wiki's half is imported and TMDB's is RECORDED AS TMDB'S CLAIM
against the item the wiki import already wrote. That hand step is what this record's apply operation
would do, performed by a test because nothing else can perform it.

**SO THE DAY MATCHING LANDS, THAT FILE SHOULD STOP DOING IT BY HAND** and browse TMDB for real. It is
not a workaround to be preserved; it is the shape of a test written in front of an operation that
does not exist. The file says so at the site, and this is the other end of that sentence.
