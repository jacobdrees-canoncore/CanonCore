---
status: proposed
---

# Extent is a statement, and is never derived

How many parts a work has needs provenance like any other claim, because two sources can
legitimately disagree about it.

And it is unknown far more often than known. **Re-measured against the LIVE wiki on 2026-09-13
(CNCORE-103): of the 11,297 stories, 3,741 carry an `Epcount` and NONE carries a `Runtime` of any
kind.** So a part count exists for a third of the corpus and a duration for none of it, and absence
is the normal case rather than the exception — which is exactly what "unknown is the absence of a
row" needs in order to be workable.

THE `Runtime` FIGURE IS NARROWER THAN THE ONE IT REPLACES AND SAYS SO. The archive-era sentence
counted 22 `Runtime` rows "across the whole corpus" and none on a story; the live re-measurement
covers the story population only, so it establishes the none-on-a-story half and not the 22. The
half that carries this decision is the half that was re-derived.

DO NOT DERIVE EXTENT from the maximum part covered by any edition. That is wrong in precisely the
case the rule exists for: where every surviving edition is partial, the derived extent is the
largest partial one. *The Daleks' Master Plan* — five of twelve parts, and no animation was ever
made — would report as complete forever. (It said THREE of twelve. ADR-0057 re-measured it to five
on 2026-09-10, episodes 1 and 3 having been recovered in March 2026, and this copy was not corrected
with it. The argument is untouched by which figure is right, which is exactly why the stale one
survived here.)

Nobody in the field gets this right. Plex compares watched children against the children that exist
only because you own a file, so owning three episodes of a thirteen-episode season and watching them
reports the season fully watched. Jellyfin materialises the missing parts and then excludes them
from the percentage anyway.

## Evidence

RE-MEASURED 2026-09-10, AND AN EARLIER CORRECTION WAS ITSELF WRONG. This record said no property
records a part or episode count for any of the 11,285 stories. The archive has `Epcount`: 4,111 rows,
values 1 to 21, populated on 3,741 stories (33.15%) — including all five of the classic serials
ADR-0057 named at the time of this measurement, at exactly the part counts quoted there. A further
2,887 stories carry a part count as a category. (That record's roster is now two classic serials
plus new Who rows, under CNCORE-9. The measurement stands as taken and is not restated for the new
roster, because what it establishes is that `Epcount` EXISTS and is partial — not a fact about which
five rows a fixture holds.)

So extent is unknown for 66.85% of stories, which is the "roughly two thirds" figure this record
replaced. The decision is untouched — extent is still a statement, two sources can still disagree,
and deriving it from the maximum part covered is still wrong — but it is unknown for two thirds
rather than for everything, and a third of the corpus has a value to import.

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`. **The archive is deleted (ADR-0129) and every figure above was re-derived from the LIVE wiki on 2026-09-13 by `provider-wiki`'s `pnpm measure:live`.** The archive-era working is `docs/research/verify-new-adrs-archive.md`, which stays as the frozen record it is: it describes a corpus taken 2026-09-04, not the wiki.
