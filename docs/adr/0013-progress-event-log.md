# Progress is an append-only event log per Profile and Edition

Players report about every 10 seconds into an append-only log kept per Profile and per Edition, and position and "watched" are derived from it, so history is never lost and Progress made offline on several devices merges by time, as in old ADR-0019 (canoncore-history). Versions of one Edition share Progress while a different Edition has its own, as in Plex, and each event carries a position suited to its medium (seconds; an EPUB CFI or Readium locator, which survives a font-size change; a comic page) and a source field, so history imported from a Provider fits the same log.

## Consequences

- Versions of one Edition can differ in runtime (film-originated material runs about 4% fast in PAL), so a resume point is mapped by proportion of each Version's measured runtime, never by seconds or a fixed speed-up.
- "Finished" is defined per medium: for video and audio, time remaining (about the last 2 minutes), not a percentage, as in old ADR-0085 (canoncore-history); for a book or comic, reaching its last chapter or page.
