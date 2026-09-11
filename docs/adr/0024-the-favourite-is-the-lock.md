---
status: proposed
---

# The favourite is the lock, and a pin survives a source-order change

Marking a value as the owner's favourite is what stops it being overwritten. There is no separate
per-field lock flag.

Re-ordering the source list re-picks the whole catalogue, but never touches anything the owner has
pinned — neither a field favourite nor an artwork `is_default`. Without that carve-out the design
ships a complaint Plex has carried since at least 2013 and still has in 2026, in its users' own
words: "the first time, when the 300 Posters has changed, it was definitely after changing the order
of the Freebase-Agents." A pin the next refresh silently overwrites is not a pin.

(An earlier version dated it to 2011. That rests on one 2013 aside linking four topics on a host
that no longer exists, so 2013 is what is actually evidenced.)

A winner is also never picked by recency. Importing a remaster would silently flip every default,
and a display that changes after a refresh nobody asked for is a complaint that has stayed open
for years.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`.

## As built, under CNCORE-4 — and this record stays PROPOSED

**BUILT: the statement half.** `rank` sorts ahead of the source order in the
projection's winner rule, so a pin cannot be beaten by re-ordering the source
list -- and re-ordering DOES re-pick everything else, through a trigger on
`sources.source_order` that runs the wholesale rebuild.

Both halves are tested together, on two items differing only in whether one
carries a pin, with the pin deliberately placed on the WORSE-ranked source. That
last detail matters: the first draft of these tests pinned the OWNER's own
statement, and the owner already sits first in the source order, so the test
passed without rank ever deciding anything. It was caught by deleting the rank
term from the winner rule and watching nothing fail.

**NOT BUILT: the artwork half.** This record also carves out artwork's
`is_default`, and `artwork` is not a table yet (ADR-0038). It arrives with its
slice, and this carve-out has to arrive with it.

## A second site applies this order, under CNCORE-5

`findPlacementsOfItem` decides which source speaks for a PLACEMENT by these same terms, in the same
sequence, so provenance on a placement and provenance on a field cannot disagree. The rule is
written twice, in SQL and in TypeScript, and holding the two identical is a stated obligation of
both -- see [[0017-placements-carry-sources-and-rank]].

## And it decides a second thing now, under CNCORE-7

The same three terms also settle WHICH OF TWO PLACEMENTS SPEAKS when two sources disagree about
position -- two rows, both standing, the winner first. That is not a new rule, it is this one
reaching the case [[0017-placements-carry-sources-and-rank]] was waiting for a second origin to
produce, and `browse` is that origin.
