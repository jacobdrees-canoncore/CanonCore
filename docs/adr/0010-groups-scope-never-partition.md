---
status: proposed
---

# Groups are a browsing scope, never a partition

Group membership is its own many-to-many table rather than a column on items.

A column would make a group a partition — an item belonging to exactly one — and multi-placement
is the entire product. A group is also never typed by medium.

**THE CASE RESTS ON MULTI-PLACEMENT AND NOT ON PRECEDENT, because an earlier version of this record
claimed precedent it does not have.** It read: "Plex ran that argument on real users and reversed it
on 2025-07-16, in its own words, 'in hindsight, we recognize this wasn't the right approach'". The
quote is real, staff-authored and correctly dated — verified twice — but it is about Plex splitting
its APPS by medium, not its libraries, and the sentence invited the reading that the category tried
medium typing and abandoned it. **It did not, and is not.** Plex's own API documentation says
"Libraries are typed"; the very post being reversed announces "support for custom media types"; and
its naming guidance, modified 2026-05-22, still warns that "a failure to separate content such as
movies and TV shows may result in unexpected or incorrect behavior". Every Plex item carries a
singular `librarySectionID`.

**Measured across the category on 2026-09-12, this decision is the unusual one and that is worth
knowing rather than hiding.** Plex, Jellyfin, Emby, Kodi and Audiobookshelf all require a type at
library creation and put each item in exactly one; Komga partitions by path instead. Jellyfin's
`BaseItemDto.ParentId` is a single nullable uuid, and its own untyped option is documented as "broken
and deprecated". Emby staff, asked this exact question in 2019: "This is not currently supported."
Audiobookshelf: "Each item only exists in a single library." Every many-to-many construct in the
category sits BELOW the partition and inherits its type.

**One product ships the thing underneath, which is real cover for the model if not for the group.**
Audiobookshelf lets "a book be part of multiple series to assist with organization, such as in a
larger universe like Star Wars", with a sequence number per membership, decimals included for
insertions. That is [[0009-multi-parent-membership-with-ordering]] built and shipped — and trapped
inside one library, which is the argument for this record in miniature.

## What a group does NOT scope

A group scopes browsing, search, WHICH PROVIDERS ARE ASKED, scanner roots, and the review queue.

It does NOT scope the field set, the vocabularies, progress, entities, or THE SOURCE ORDER
(ADR-0025).

The negative half is the load-bearing one. A partition is what a scope becomes by accretion, one
reasonable-looking addition at a time, and each of those five would be a defensible thing to scope
if the list were not closed.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`.
## As built, under CNCORE-178 — and this record stays PROPOSED

**BUILT: the group, and nothing it scopes.** Migration 19 adds `groups` — an id, the Owner's name,
and the owner id, timestamps, tombstone and change sequence every table in this catalogue carries
(ADR-0044, ADR-0075) — and `group_items`, which is the many-to-many table this record's first
sentence asks for and which carries ADR-0040's merge stamp besides. **"Nothing else" means no
SCOPING column**, which is this record's subject: no medium, no field set, no vocabulary, no source
order, no root. It is not a claim that the table is two columns wide, which is how an earlier draft
of this sentence read and which review caught against criterion five of the ticket. The Owner creates, names, renames and deletes a scope from `/groups`, puts an Item in one
from the Item's own page, and puts ONE ITEM IN SEVERAL at once, which is the case the whole decision
rests on. Deleting a group tombstones it and its memberships in one transaction and names no Item at
all: the function does not mention `items`, which is the strongest form that promise can take.

**NOT BUILT: ALL FIVE OF THE SCOPED THINGS ABOVE, and the five are not in one state.** This record's
"What a group does NOT scope" section closes the list at browsing, search, which providers are asked,
scanner roots and the review queue. A reader who finds the table and assumes the scoping came with it
would be wrong about every one of them:

- **Browsing** and **search** are CNCORE-179. The predicate exists nowhere: no Listing joins
  `group_items`, so narrowing to a group is not yet a thing any surface can do. This is the half that
  makes a group useful, and it is deliberately the next ticket rather than this one — the scope has
  to exist and hold Items before anything can be read through it.
- **Which providers are asked** is CNCORE-182, and it is further off than the two above because it
  needs a second relation (a group to the providers it reaches) that no migration writes.
- **Scanner roots** and **the review queue** DO NOT EXIST AS CONSTRUCTS IN THIS PRODUCT, so they are
  not unbuilt scoping over a built thing — there is nothing to scope. Nothing in the repository scans
  a filesystem and nothing queues a review. They stay in the list because the list is CLOSED and its
  closure is the load-bearing half: a scope becomes a partition by accretion, one reasonable-looking
  addition at a time, and a list edited down to what exists would stop refusing the sixth thing.

**So the negative half of this record is the half that is now testable, and the positive half is
still a promise.** `group_items` carries no medium, no field set, no vocabulary and no source order,
and `groupPublic` emits an id and a name — which is the shape refusing to accumulate rather than a
payload waiting to be filled in.

**AND THE MEMBERSHIP IS NOT A PLACEMENT**, which `CONTEXT.md` gained a headword for under this
ticket. Both are "one item's membership of one thing", and they are two tables because a Placement
carries a POSITION and every SOURCE that asserted it, where a group membership carries neither: a
group is not a container, and nobody but the Owner ever says what a scope holds. Folding them would
be this record's partition arriving through the schema.
