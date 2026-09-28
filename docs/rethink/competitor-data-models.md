# Competitor data models (research + verify, 2026-09-28)

**Verify result:** 4 contradicted or corrected, 3 unfounded, about 35 confirmed. Sources are the owners' docs and source code. Judgement is marked J.

## Corrections

- Kodi links works narrowly: NFO `<showlink>` links a movie to a TV show (`movielinktvshow`), and it also has sets.
- The `-trailer`, `-featurette`, `-behindthescenes` … list is **Plex's**. Jellyfin's is wider: it adds `-clip`, `-deletedscene`, `-extra` and `-sample`, plus the folders `clips`, `extras`, `samples` and `theme-music`.
- **Jellyfin has no editions.** "Directors Cut" is a free-text version label.
- TMDB has no work relationships, but it does have `belongs_to_collection`, crew jobs such as "Novel", and keywords.

## Editions and versions

- **Plex:** "Versions all represent the same release… Editions represent different releases."
  - Each edition is a separate library item with its OWN watch state and rating.
  - Versions collapse into one item.
  - `{edition-Director's Cut}` can hold 1080p and 4K versions.
- **Jellyfin:** `PrimaryVersionId` and `LocalAlternateVersions`.
- **Kodi 21+:** a `videoversion` table, where VERSION or EXTRA is a file role.
- **MusicBrainz:** work → recording → release → release group. A work can be "a novel later recorded as an audiobook".
- **Audiobookshelf:** one Book row holds its audio files and an ebook. There is no edition entity.

## Extras

- **Plex:** extras are items of type `clip` with a subtype, served at `/library/metadata/{id}/extras`.
- **Jellyfin:** extras are full BaseItems with `ExtraType` and `OwnerId`, so they are **items, not attachments**.
- **Kodi:** an extra is an attachment, a file row.

## Relationships between works

- **MusicBrainz, work to work:** based on, adaptation, arrangement, revision, parts, other version…
- **MusicBrainz, release group to release group:** translated version, remix, cover, commentary…
- **Wikidata:**
  - P144 based on;
  - P4969 derivative work;
  - P179 part of the series, with P155/P156 as qualifiers;
  - P361/P527 part of and has part;
  - P406 soundtrack release;
  - **P2512 has spin-off**;
  - P8345 media franchise;
  - P747/P629 edition-of.
- **Kavita `RelationKind`:** Prequel, Sequel, SpinOff, Adaptation, SideStory, AlternativeVersion, Edition, Annual, Cameo…
- **Metron:** reprints, and associated series.
- **Jellyfin:** no relationship fields.

## People, credits and characters

- **Plex, Jellyfin, Kodi and TMDB store the character as a STRING on the credit.**
  - On TMDB, Eccleston is "Doctor Who" on Rose, while Tennant and Smith are "The Doctor". **The Doctor is not one entity there.**
- **TheTVDB:** one Character row per person per work.
- **Metron:** Character is an entity. Credits are issue × creator × roles.
- **Wikidata:**
  - The Doctor is ONE character, Q34358, with 15 performers, each qualified by P4649 with the incarnation (First Doctor…).
  - Film cast is P161 qualified by P453 character role.
- **Jellyfin `PersonKind`** includes Author, Narrator, Penciller, Inker, Colorist, Letterer, Translator.

## Kinds

- **Jellyfin:** Movie, Series, Season, Episode, MusicAlbum, MusicArtist, Audio, AudioBook, Book, MusicVideo, Trailer, BoxSet, Playlist. No podcast.
- **Plex:** movie, show, season, episode, trailer, person, artist, album, track, clip, photo, playlist, collection. No book.
- **Audiobookshelf:** book or podcast, and a podcast episode carries a season.
- **MusicBrainz:** release-group secondary types include Audiobook, **Audio drama**, Spokenword and Soundtrack. Series types include Podcast.

## Collections, playlists and series

- **Komga:** a ReadList is ordered; a SeriesCollection is not.
- **Audiobookshelf:** Collection and Playlist, plus `BookSeries.sequence`.
- **Plex:** collection and playlist.
- **Jellyfin:** BoxSet and Playlist.
- **TMDB episode-group types:** 1 air date, 2 absolute, 3 DVD, 4 digital, **5 story arc**, 6 production, 7 TV. Doctor Who has live "The Doctor Order" and "Chronological" groups.

## What CanonCore needs beyond decisions 31 to 40 (J)

1. **Typed, directed relationships between Items:** based-on/adaptation, spin-off, soundtrack-of, remake, version-of.
   - All live on Wikidata: the Rose 2018 novel is based on the Rose episode; Doctor Who has the spin-off Torchwood; *Dr. Who and the Daleks* is based on The Daleks.
   - Derive sequel and prequel from orderings rather than storing them.
2. **Character as an entity.** A credit is person × Item × role × character, with an optional incarnation, as in Wikidata P4649.
3. **A cut distinct from a file.** Plex gives each edition its own watch state. Either a cut label on the File with shared watch state (the Jellyfin and Kodi approach), or a cut as its own Item linked by version-of. **This reopens part of decision 31.**
4. **Extras as Items with an owner and a type,** following Jellyfin.
5. **Music, work against recording:** the Item is the recording, and the composition is the target of a relationship.
6. **Audio drama and podcasts get their own hierarchies:** range → story → part, and show → episode.
7. **Playlists stay per user, outside the catalogue.**
