# Songs in an episode (research, 2026-09-28)

This research was read-only. **F** means measured or read at the owner this run, and **J** means judgement.

## Data

- **Wikidata P10664 "featured track(s)" has the right shape (F).** Its qualifiers are time index, duration, ordinal and performer.
  - It is almost unused: 303 statements on 186 items, 66 of them TV episodes.
  - **Doctor Who: 0 of 905 episodes.**
- **MusicBrainz has no film or episode entity (F).** It links soundtrack albums to a film or show only at the release-group level.
- **Also no song-level data (F):**
  - TMDB: composer credits only.
  - IMDb: no soundtrack dataset, and scraping is forbidden.
  - BBC /programmes: segments exist for radio, not for Doctor Who.
- **Tunefind:** its API plans are sales-negotiated and treated as paid (F/U).
- **WhatSong:** no public API was found, and its terms were unreadable (U). Both are excluded.
- **Tardis Fandom:** songs appear only as free prose in story notes (Toxic and Tainted Love in The End of the World). That is a hint for a human, not data (F).

## Detection from the audio

- **Olaf** (AGPL-3.0, pushed 2026-09-27) and **Panako** (AGPL-3.0) match fragments against a database built from songs you already have, and report where in the episode each song matches (F).
- **AcoustID's own FAQ says it is not for fragments or tracklisting a stream (F).**
- AudD and ACRCloud are paid (F).
- Accuracy under dialogue and effects is unmeasured. Test one episode before promising anything (J).

## Recommendation (J)

- Store each song as a sourced link from an episode or film to a recording, with a time, a duration and an order, mirroring P10664.
- Import P10664 where it exists.
- The Owner or a curator adds songs by hand, searched against MusicBrainz.
- Optionally, Olaf on the server fingerprints the library's own music and suggests matches for confirmation, which fits "link to the song in the library if present".
