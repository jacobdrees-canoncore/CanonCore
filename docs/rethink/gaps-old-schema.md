# Gaps: the old schema compared with decisions 31 to 40 (2026-09-28)

This was read-only. Sources:
- CONTEXT.md
- docs/research/walking-the-owners-install.md
- ADRs 0004, 0005, 0009, 0011, 0018, 0021, 0026, 0033, 0064, 0067, 0070, 0077, 0087, 0092, 0128 and 0204
- the migrations in packages/db (1, 52 and the property seeds)

## What the old concepts became

- **Covered:**
  - Item (31, 37).
  - Ordering + placement (32).
  - Part, Variant and File as Files under one Item (31, 38).
  - Statement, Property, Source, and Favourite as the lock (33).
  - Franchise (40), which is new; the nearest old concept was a hand-made Group.
- **Dropped:**
  - Container (32).
  - Edition (31).
  - Source order: the global ranking is superseded by the per-field priority in 33.
- **Reversed:** Medium now picks the hierarchy.
- **Undecided:**
  - Entity kinds: person, character, organisation, place, time span, concept.
  - Unplaced entries, repeats and shared positions (ADR-0009).
  - Group, and Group's rule.
  - Dubs, translations and narrations.
  - File identity by content (ADR-0023).
  - Instalment (serial against episode).
  - Adaptation, which was "always a separate item".
  - Extent and edition coverage.
  - Qualifier and Rank.
  - Credit, Credited to and Relation.
  - Alias, merges and matching across providers (ADR-0026).
  - Artwork (partly covered).
  - Continuity.
- **Properties:** 13 were counted in the walk, and later reshaped by migrations 25, 35, 45 and 52.

## Where the old model hurt

- **walking-the-owners-install.md, "The corpus, as measured":**
  - Every Item was `kind: work`, and 6 of the 7 kinds held nothing.
  - All 465 Containers were timeline pages, so there was "no series, no seasons".
  - Only 4 of 13 properties were ever written.
- **"The one root cause":** only stories were imported. Credits were blocked because a naive import mints a new person each time.
- **"Eight journey problems":** No. 2, "no hierarchy to descend", and No. 5, "Titles carry their source's plumbing".
- **ADR-0077:** a kind filter failed on its own example.
- **ADR-0004 (CNCORE-353):** 141 of 465 timelines never paired with a character.
- **ADR-0026:** 157 of the 159 stories from 1963 are multi-part. Episode against story was the hardest matching problem.
- **ADR-0033:** one title is routinely a TV story, a novelisation and a character at once.
- **ADR-0064:** about 100 channel releases forced a cap of 16 editions.
- **ADR-0021:** Jellyfin's "Rose / The End of the World" merges two episodes into one item. That is the trap to avoid.
- **Migration 52:** relation properties were retired after launch.

## Undecided, in blocking order

**Project 1:**
1. Typed tables per level, or one Item table with a level?
2. Specials and renumbering: Season 0 or Series 2, and TMDB's numbering or the BBC's?
3. Does progress attach to the Item or the File?
4. Is a File identified by path or by content?
5. Can one File cover several Items (The Stolen Earth + Journey's End)?
6. Which fields are statements in project 1, and what is the priority table?
7. Extras.

**Project 2:**
8. Serial or episodes (instalments).
9. Do Entities exist (Character, Person)?
10. Items from other media before their project ships.
11. Adaptation.
12. The relation vocabulary.
13. What a franchise is, and nesting.
14. Timeline entries with no Item.
15. Repeats and shared positions.
16. Provider disagreement on a position.
17. Credits and people.

**Later:**
18. Dubs and narrations.
19. Extent and missing episodes.
20. Qualifiers.
21. Continuity.
22. The time span and concept kinds.
