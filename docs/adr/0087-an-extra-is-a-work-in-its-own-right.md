---
status: proposed
---

# An extra is a work in its own right, and stays out of its parent's Continue Watching

A trailer, a featurette, a deleted scene or an interview is a WORK RELATED TO another work, not a
file role on it. So it has its own item row, its own metadata, its own artwork and its own page —
and finishing it says nothing about the film. It does not surface in Continue Watching for its
parent.

Plex and Jellyfin both model an extra as a child item, so this is the mainstream shape. KODI DOES
NOT: it files an extra as a file role, one `videoversion` row keyed on `idFile` with
`VideoAssetType::EXTRA = 2` — the same table and the same axis as an alternate version — and
`AddVideoAsset` writes no `movie` row at all.

WHAT KODI DENIES AN EXTRA IS A LIBRARY ITEM, not progress. Verified 2026-09-10: because
`videoversion.idFile` is the primary key and Kodi's watched state is `files.playCount` keyed on
`idFile`, an extra there does carry its own play count, resume bookmark and per-asset artwork. What
it cannot have is an item of its own — no page, no metadata, no standing. That is the cost, and it
is the argument this record needs.

## Evidence

An earlier version of this record said Plex's users had "been asking since 2020" and quoted "Extras
store no watched status. You can't mark Extras watched or unwatched" as PLEX'S OWN DESIGN RULE.
Both halves were wrong and the correction runs the other way.

The quotation is verbatim but it is post #4 by a forum user with `staff: false`, `admin: false`,
`moderator: false` and `trust_level: 0` — no Plex account posts in that topic at all. And the
earliest retrievable request is 2015-11-08, not 2020: "Currently PMS does not keep track of playback
of movie extras... I would definitely like to have playback supported for extras."

More importantly it is stale. Plex's official release notes for 2026-05-13 read "NEW: Add progress
indicators to local extras on details screens", and a moderator confirmed in 2022 that Plex Web
stores and resumes playback position on extras. **Plex is a precedent for this decision, not the
foil the record used it as.**

(A methodology note that produced the error: on that forum Discourse's `staff: true` means
*moderator*, and Plex Ninjas are volunteers. Only `user_title: "Plex Employee"` or `"Team Member"`
speaks for Plex.)
