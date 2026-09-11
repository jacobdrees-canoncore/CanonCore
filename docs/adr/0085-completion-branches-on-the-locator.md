---
status: proposed
---

# Completion branches on the locator, and an unknown duration never completes

COMPLETION NEEDS AN EXTENT. For timed media the extent is a duration; for paged media it is a page
count. Where there is no extent of either kind, completion is UNKNOWN.

Given an extent, the test branches on the locator. Where the locator has a duration behind it,
completion is TIME REMAINING under a small absolute figure, because a six-hour release at 90% still
has thirty-six minutes to run while a 25-minute episode at 90% is in the closing titles. Where it
does not — a book, a comic — completion is `progression` crossing a threshold, computed against the
page count.

Branching on the locator rather than on the medium enum means a fifth medium never reopens this
rule. **That sentence is this record's, and it is the only place it is decided.** ADR-0041 and
ADR-0063 each asserted it as their own; both now cite here instead, because a rule stated in three
places drifts in two of them and the reader cannot tell which one moved.

A missing extent is the only unknown case, and it is unknown for both kinds of media. A video whose
probe failed and whose client sent no duration cannot complete; neither can an unpaginated text
stream with no page count. There is no percentage fallback in either case, because a percentage is a
fraction OF THE EXTENT: with no extent there is no percentage. Unknown is never a fabricated true —
the same rule ADR-0060 applies to a work's extent and ADR-0088 applies to whether a work is
watched.

One number clears the position; do not add a second, higher threshold for that. And there is no
force-complete rule — ADR-0041 refuses it because it completed by DURATION rather than by position,
fabricating a true, and because it caught genuinely short works. Time remaining already completes a
trailer with ten seconds left, exactly as it does anything else.

## Evidence

Jellyfin's fallback in the no-duration case corrupts data. Verified at source on 2026-09-10, in
`UserDataManager.UpdatePlayState`:

```csharp
else if (!hasRuntime) { data.Played = playedToCompletion = true; positionTicks = 0; }
```

Identical at tags v10.7.7 through v10.11.0. It is worse than a stray `Played = true`: it is the
terminal branch of a chain, so it genuinely is the fallback; `playedToCompletion` propagates the
state to every alternate version; and the resume point is destroyed in the same statement. The first
progress report on a runtime-less item marks it watched and throws away where you were. That is the
direct evidence for "unknown is never a fabricated true".

PLEX DOES NOT COMPLETE ON A CLOCK. Its default option is literally named "earliest between threshold
percent and first credits marker", with a 90% default threshold, both admin-configurable, falling
back to the percentage where no marker exists — min(), not both. The time-remaining rule is OURS
rather than the industry's and should be argued rather than attributed.

AN EARLIER VERSION CITED THE WRONG PRECEDENTS FOR THE PAGED BRANCH. Komga uses a threshold for EPUB
only (`totalProgression >= 0.99F`); its DIVINA and PDF branch is exact last-page equality. And
Audiobookshelf never auto-completes a book at all — its whole completion block is `if (this.duration)`
and `get progress()` returns 0 with no duration. Audiobookshelf declining to complete a durationless
book is a point FOR the extent rule, not a precedent for the threshold.
