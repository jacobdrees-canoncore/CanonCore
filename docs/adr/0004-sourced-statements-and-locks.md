# Every value is a sourced Statement, and a Lock wins

Every Provider's value for a field is kept as a Statement with its Source and none is discarded; until an Admin sets a per-field priority, install order decides the winning Statement, and an Admin's own Statement is a Lock that always wins. Jellyfin and Plex use a priority order and a lock but keep only the winner, and CanonCore goes further because the Source badges, and an Item page showing every Provider's value side by side, need them all. After import, facts about imported Items (overview, poster, air date, runtime) refresh on their own, but anything that would add to or restructure the Library arrives as a Proposal, and every Rejection is remembered against that Provider's id, since old ADR-0027 (canoncore-history) found almost nothing remembered rejections.

## Considered Options

- Keep only the winning value, as Plex and Jellyfin do: rejected, it cannot show where a value came from or what else was said.
- A shipped global ranking of Providers: rejected with the default Provider (ADR-0002).

## Consequences

- Accepted imports and Matches are undoable too, because about 3% of the old merges were wrong and irreversible (old CNCORE-441).
- A Rejection is proposed again only when the Provider's data changes meaningfully, or an Admin clears it from Settings › Rejected.
