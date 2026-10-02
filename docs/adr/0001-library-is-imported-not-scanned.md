# The Library is imported, and files are only matched to it

The Library is CanonCore's own strict schema, built by an Admin accepting Proposals from Providers, or from a reading-list file an Admin imports, never by scanning media files: a file is only ever Matched to an Item already imported (Rose.mkv attaches to the Rose Item), the scanner suggests each Match, confident ones confirm in bulk, and the rest wait as Unmatched files. This follows MusicBrainz Picard's look up, compare, accept, and makes the Library everything imported, owned or not, so CanonCore is a reference as much as a player, and no whole Provider is ever mirrored again (the old "way too much" problem). Importing an Ordering is one Proposal ticked by medium, and each ticked entry with no matching Item becomes an Item of the right kind, so a Timeline's novels and audio dramas exist in the Library before any media for them does.

## Considered Options

- Media files seed the Library, as in Plex and Jellyfin: rejected, "it should be focused on CanonCore schema, don't suggest via files".
- Owned Items first, unowned greyed out: rejected for a Library of everything imported, narrowed by an "Only what I can play" filter.

## Consequences

- An Unmatched file never becomes an Item on its own. It waits until an Admin matches it, or imports its Item first.
