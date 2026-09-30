# Providers speak CMPP from a Store of manifest URLs

A Provider is an HTTP service behind a manifest URL that declares its capabilities (search, lookup, children, orderings, related, match, artwork, history, entities: people and characters with their Credits, served apart from a work's lookup), its kinds, version, terms, credential and rate limit, and it returns data in CanonCore's schema with a Source on every value; the Store lists public manifest URLs, and a private Provider is installed by pasting its URL, written in any language and hosted anywhere. First-party Providers implement the same interface but load in-process, so a shared host runs no always-on process per Provider, while strangers' code always stays behind a URL, because Node's permission model docs (the same in v24 and v26) say "Malicious code can bypass the permission model". The precedent, verified 2026-09-28, is Plex Custom Metadata Providers ("enter the URL for the locally running provider"), Stremio's manifest URLs with declared resources, and Audiobookshelf's custom providers, and the server enforces each declared rate limit with one limiter per Provider that records "refused" apart from "nothing found".

## Considered Options

- Jellyfin's in-process DLLs from manifest repositories: rejected as the older model, which runs third-party code inside the server.

## Consequences

- CanonCore ships no shared credential for any Provider: a Provider that needs a key declares it in its manifest, and each Admin enters their own (TMDB, Metron, TARDIS Guide). One install's misuse can never get a key revoked for everyone. The one exception is a Provider whose owner agrees in writing to a key CanonCore ships (asked of TMDB, 2026-09-29): that key is then the default, an Admin may still enter their own, and installs fall back to asking for one if it is ever revoked.
- A Provider resting on permission given to one person (Tardis Fandom, Big Finish) is a private install on that person's server, never a Store listing.
- Installing a Provider from a URL the Store does not list shows a trust warning, once, before it is installed. Pasting a URL installs that one Provider, so adding and installing are the same moment here. Jellyfin warns at the same point: when a plugin is installed from an untrusted repository, not when the repository is added (verified 2026-09-29).
