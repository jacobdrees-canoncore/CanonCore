---
status: proposed
---

# Watch events are the truth; the state row is read from them

Progress keeps an append-only event log plus a maintained state row for reads, the same
store-the-log, read-a-projection shape used for statements.

Every media server surveyed READS FROM a mutable state row for its watch state.

Plex is the partial exception and the claim here was overstated. It keeps `metadata_item_views`, a
per-viewing log, AND it ships Dashboard surfaces over it — "View Full History", and a Top Played
panel showing "the number of times an item has been played in total". Both are Plex Pass. What Plex
does not do is let the log inform watch STATE, and its privacy control deletes the log wholesale.

Jellyfin has no log at all: one `LastPlayedDate` that every play overwrites, cleared along with the
count when an item is marked unwatched.

So the defensible claim is narrower than "neither can tell you that you watched it three times":
Plex can, on a paid tier, in an admin dashboard. Neither builds the catalogue itself on the log,
which is what makes re-watches real here.

## When a report is sent

Every 10 seconds, AND immediately on any user interaction. The timer alone is half a rule: on its
own it loses up to ten seconds on a pause-and-close, which is the common case rather than an edge
one.

Both halves are the industry's rather than ours. Emby frames 10 seconds as a CEILING rather than a
floor — "The server will automatically increment playback progress every second, so it is not
necessary to automatically report more often than at 10 second intervals" — and separately requires
a report "Immediately following any user interaction with the player". Plex puts the interaction
half FIRST: "It must be hit whenever the play state changes", with the timer as the fallback, and
gives 10 seconds for LAN and WAN with 20 seconds over cellular. Jellyfin's web client ships
`setInterval(..., 10000)` and additionally fires on pause, unpause, volumechange and five other
events.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`.
