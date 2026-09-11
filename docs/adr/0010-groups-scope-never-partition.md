---
status: proposed
---

# Groups are a browsing scope, never a partition

Group membership is its own many-to-many table rather than a column on items.

A column would make a group a partition — an item belonging to exactly one — and multi-placement
is the entire product. A group is also never typed by medium: Plex ran that argument on real
users and reversed it on 2025-07-16, in its own words, "in hindsight, we recognize this wasn't
the right approach".

## What a group does NOT scope

A group scopes browsing, search, WHICH PROVIDERS ARE ASKED, scanner roots, and the review queue.

It does NOT scope the field set, the vocabularies, progress, entities, or THE SOURCE ORDER
(ADR-0025).

The negative half is the load-bearing one. A partition is what a scope becomes by accretion, one
reasonable-looking addition at a time, and each of those five would be a defensible thing to scope
if the list were not closed.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`.
