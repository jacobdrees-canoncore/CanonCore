# Clients keep a local Library copy fed by a change feed

Every table carries a change number and deletions leave a tombstone (as in old ADR-0075 (canoncore-history)), so each client asks "what changed since N" and keeps its own copy of the Library, permanent on iPhone, iPad and Mac and in the browser on the web, which makes browsing and search instant and lets a 603-Placement Timeline scroll smoothly. Search runs on that copy, ignoring accents and case and matching prefixes, with the same index kept in SQLite FTS5 on the server for clients still syncing, replacing pg_trgm from old ADR-0120 (canoncore-history). With good wifi the usual case, the choice is about speed and craft rather than offline use, following Infuse's full local library.

## Considered Options

- Fetching per screen, as Plex and Jellyfin do: rejected for speed.

## Consequences

- On Apple TV the copy is only a rebuildable cache, because tvOS guarantees 500 KB of persistent storage and "all other data must be purgeable" (Apple's tvOS guide, confirmed 2026-09-28). After a wipe, sign-in and the server address survive in Keychain and persistent defaults, screens load live, search uses the server's index, and the copy rebuilds from the change feed in the background, as Swiftfin does.
