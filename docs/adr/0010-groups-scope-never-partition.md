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
