---
status: accepted
---

# Two more efforts go ahead of the playback half

The catalogue learns what its things ARE, and then the product is redesigned. Both before playback,
the clients and the demo.

## This is the second insertion ADR-0115 refused to license, and the refusal is answered rather than ignored

[[0115-the-public-release-comes-before-the-playback-half]] is explicit: "This record inserts ONE
effort ahead of all three; it does not reorder them, **and it does not license a second insertion**."

That sentence is doing its job. It stops an ordering being widened by whoever is holding the roadmap
at the time, which is exactly how the four-project list grew a fifth entry in `CLAUDE.md` on
2026-09-20 with nothing in `docs/adr/` behind it. So the licence is taken here, with an argument of
its own, and ADR-0115's own clause about the three named successors is left standing: **playback
still precedes clients precedes demo** ([[0055-web-now-phone-next-tv-last]]).

**AND THIS DOES NOT LICENSE A THIRD.** The same reason holds: a fourth insertion needs its own record.

## Why the data effort goes first, measured rather than argued

The catalogue holds 8,052 Items and every one is `kind: work`. All 465 Containers are
`Theory:Timeline - X` wiki pages. Of TWELVE declared properties, four are ever written — `title`,
`external_id`, `sort_name`, `released` — and `portrayed_by`, `created_by`, `appears_in`,
`based_on`, `category`, `part_of`, `credited_to` and `note` sit at zero; it was thirteen with nine at
zero when counted, until migration 25 deleted the never-written `image` under CNCORE-358, because a
picture is a table rather than a Statement ([[0038-artwork-is-a-table]]). Counted against the Owner's
own install on 2026-09-20; working in `docs/research/walking-the-owners-install.md`.

So six of the seven item kinds are empty, no Group has ever existed, and there was no image anywhere
in the product until CNCORE-358 stored the first. **Every capability built on top of that data is a working mechanism with an empty input**,
which is why walking the install produced two reported defects that were neither: the kind filter and
Groups both work, and both had nothing in them.

`provider-wiki` imports stories only, by design — `ns = 0 AND is_redirect = false AND <story
disambiguator>`, which its own comments measure as admitting 14,285 of 40,696 pages
([[0033-search-lookup-required-browse-optional]]). A page titled `Rose Tyler` carries no story
disambiguator, so the character is excluded at the source.

## Why the redesign goes after the data and not before it

**Four of the eight flow problems measured on 2026-09-20 are data problems**: there is no way in, no
hierarchy to descend, no images, and the wiki's namespaces and disambiguators are shown to readers as
titles. A first screen designed before the data arrives is designed for 8,052 undifferentiated works
and then designed again.

[[0037-artwork-stores-its-bytes]] and [[0038-artwork-is-a-table]] make this concrete: there was no
artwork store, so there were no images and there could not be until one existed. CNCORE-358 built
the store, and it holds TMDB's pictures; the wiki's cannot reach it past tardis.wiki's challenge,
which only the Provider can pass, and CNCORE-427 carries them. A redesign scheduled ahead
of the data effort would be designing pages for content that does not arrive.

**THE CORPUS HAS NO RECORD TO SCOPE A REDESIGN FROM, AND THAT IS NOT AN OVERSIGHT.** Every surface and
listing decision in the corpus is `accepted`, which in this repository means the mechanism is whole:
0119, 0133, 0136, 0138, 0140, 0142, 0143, 0149, 0150, 0151. Sorting the 67 `proposed` records THIS
CORPUS HELD ON 2026-09-20 by which effort owns them yields **zero** in the redesign. The count is
dated because the corpus grows: it read 71 of 188 on 2026-09-21, and the seven `proposed` records
added in between (0153, 0155, 0156, 0158, 0167, 0168, 0187) were re-sorted on that date and still
yield zero, so the finding stands on the larger corpus rather than only on the one it was taken over. So the redesign is UNSPECIFIED rather than pending,
and its scope has to be argued from scratch — which is a further reason it cannot precede the effort
that gives it something to show.

## What the data effort is, in one sentence, and what it already has decided for it

Combine what the wiki and TMDB each say about one work into one page, rather than one provider per Item.

[[0026-enrichment-reaches-every-provider]] is the charter and it already decides the shape: "each
provider is matched independently to its own record, and agreeing identifiers between providers are
evidence they describe the same work", with a single primary source filling gaps REFUSED because "that
is Jellyfin's design, it merges first-non-empty-wins and DISCARDS the losing answers, and it is why
Jellyfin can never say where a value came from."

The substrate is built and the agreement operation is not.
[[0078-entity-identity-is-a-surrogate-id]] holds `(SOURCE, EXTERNAL ID)`, never the id alone, and
migration 5's unique index is partial, so one Item carrying both providers' ids is permitted by
construction. [[0014-title-is-a-projection]] fixes the arbitration as rank, then the global source
order, then the statement id, with recency deliberately absent.

Three constraints on it, all already recorded:

- [[0128-an-ordering-is-the-sources-own-axis-not-release-order]] FORBIDS fusing orderings. Two
  providers' orderings are two Containers.
- [[0081-release-date-means-earliest-known-release]] overrides the arbitration for one column:
  `release_date` is the EARLIEST, not whichever source wins.
- [[0036-tmdb-licence-constraints]] forbids caching "any information" past six months, and
  `max_cache_age` is declared at 180 days. It was read by nothing, which is compliance by absence,
  until CNCORE-360 made a read refuse a claim past it. The projected columns are still out of its
  reach. Fusion stores values by definition, so that ceiling came due WITH this effort rather than
  after it.

## What this record does not settle

**Where the Edition axis sits.** [[0092-a-placement-may-name-an-edition]] records that `editions`, its
foreign key and any read of it are all unbuilt, and nothing a provider can send today is
edition-shaped. If fusing TMDB means saying a runtime or a language belongs to one edition, the table
it needs is in the playback half and this ordering would have to be revisited. That is a real open
question and it is named here rather than assumed away.

**The two controls fusion needs and does not have.** [[0024-the-favourite-is-the-lock]]'s pin and
[[0027-two-thresholds-and-a-review-queue]]'s queue are both surfaces, and
[[0017-placements-carry-sources-and-rank]] records that nothing sets a rank: "ADR-0024's lock arrives
with the surface that locks something." The moment two providers assert one title, the global source
order decides silently and the Owner cannot reach it. So a little design lands INSIDE the data effort,
which [[0051-grow-in-vertical-slices]] requires anyway — "the first slice renders a real page".

**The merge.** [[0040-a-merge-stamps-the-change-sequence]] records that no operation writes a `merges`
row. Fusion produces two Items for one work whenever each provider was imported separately, and only
a merge collapses them.

## Evidence

Measured against the Owner's running install and the corpus on 2026-09-20, by the first
`/closing-a-spec` run and a ten-agent sweep of 688 files across all three repositories. Working in
`docs/research/walking-the-owners-install.md`. The `proposed`-record sort behind the zero-redesign
finding was taken over all 67 records in two halves.
