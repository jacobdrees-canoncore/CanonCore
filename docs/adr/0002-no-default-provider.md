# No default Provider, except Local metadata

A fresh install has no Provider installed, TMDB included: every Provider is installed from the Store by an Admin, what the Store offers per medium describes coverage rather than a preference, and the product ships no global ranking, because CanonCore is everything-agnostic and a franchise's own Providers work through the same Store as anyone's. The one exception is Local metadata, built in, always on and ranked first by default, because it only reads the Library's own media files (tags, NFO, ComicInfo, EPUB metadata) and writes nothing to them, matching Plex and Jellyfin for video, where a local NFO overrides online data. Plex's music library is the exception: there its online agent wins unless "Prefer local metadata" is switched on (support.plex.tv, verified 2026-09-29). CanonCore keeps Local metadata first for every medium, so an Admin's own tags win until a field is reordered or Locked. First-party code that only reads the Library's own media files, such as audio detection, may also ship built in, but Off until an Admin turns it on, so nothing runs or appears unasked. The Store carries no paid Provider, and one that is free with strings attached (non-commercial terms, no image licence) is flagged as such.

## Considered Options

- TMDB installed by default: rejected, since Admins install whatever they choose and nothing in the defaults favours one medium or franchise.
- Local metadata installed like any other Provider: rejected for always on.

## Consequences

- Badly tagged files win over online Providers until an Admin reorders the field or sets a Lock. This was accepted.
- A show's hierarchy is numbered as the Provider it was imported from numbers it. Another Provider's numbering is importable as an Ordering.
