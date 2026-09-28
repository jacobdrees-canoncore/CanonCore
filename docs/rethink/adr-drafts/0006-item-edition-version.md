# Item, Edition and Version, and a Version can be a Segment

Following Plex's split ("Versions all represent the same release… Editions represent different releases"), an Item has Editions, each a different cut with its own runtime and watch state and a default one for every Item, and each Edition has Versions, copies such as 1080p, 4K or NTSC; Orderings place the Item, so "Also in" covers whichever cut is watched. A lost episode is an ordinary Item marked Missing and a reconstruction is an Edition of it, so there is no separate coverage concept, and old ADR-0060, 0082 and 0088 (canoncore-history) are dropped. A Version is backed by a media file or by a Segment of one, so an omnibus or multi-episode file is matched to each Part with a start and end time and each keeps its own Progress, avoiding Jellyfin's merged-item trap (old ADR-0021 (canoncore-history)) and going further than Plex, where "playing any of the represented episodes will play the full file".

## Considered Options

- Versions only, as in Jellyfin and Kodi: rejected, a remaster could not keep its own runtime and watch state.
- One merged Item for a multi-episode file, as in Jellyfin: rejected for Segments.
