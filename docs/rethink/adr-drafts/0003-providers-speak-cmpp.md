# Providers speak CMPP from a Store of manifest URLs

A Provider is an HTTP service behind a manifest URL that declares its capabilities (search, lookup, children, orderings, related, match, artwork), its kinds, version, terms, credential and rate limit, and it returns data in CanonCore's schema with a Source on every value; the Store lists public manifest URLs, and a private Provider is installed by pasting its URL, written in any language and hosted anywhere. First-party Providers implement the same interface but load in-process, so a shared host runs no always-on process per Provider, while strangers' code always stays behind a URL, because Node 24's permission model docs say "Malicious code can bypass the permission model". The precedent, verified 2026-09-28, is Plex Custom Metadata Providers ("enter the URL for the locally running provider"), Stremio's manifest URLs with declared resources, and Audiobookshelf's custom providers, and the server enforces each declared rate limit with one limiter per Provider that records "refused" apart from "nothing found".

## Considered Options

- Jellyfin's in-process DLLs from manifest repositories: rejected as the older model, which runs third-party code inside the server.

## Consequences

- A Provider resting on permission given to one person (Tardis Fandom, Big Finish) is a private install on that person's server, never a Store listing.
- Adding an unlisted URL shows a trust warning, as Jellyfin does for third-party repositories.
