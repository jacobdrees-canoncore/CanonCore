# Every value is a sourced Statement, and a Lock wins

Every Provider's value for a field is kept as a Statement with its Source and none is discarded; an Admin ranks Providers separately for each field in Settings › Providers, until then install order decides the winning Statement, and an Admin's own Statement is a Lock that always wins. Jellyfin and Plex keep only the winner, and CanonCore goes further because the Source badges, and an Item page showing every Provider's value side by side, need them all. Ranking per field is the Owner's choice against the ecosystem (2 Oct 2026), verified 2026-10-02: Jellyfin and Emby rank metadata downloaders once per library and item type (`MetadataFetcherOrder` under `TypeOptions`) and lock fields per Item; Plex's current agents have no source ordering, only a per-field "Ratings Source", and its legacy ordered agents are hidden for new libraries since Server 1.43.0; Kodi picks a scraper per source, and only some scrapers choose a site per field, for a few fields. After import, facts about imported Items (overview, poster, air date, runtime) refresh on their own, but anything that would add to or restructure the Library arrives as a Proposal, and every Rejection is remembered against that Provider's id, or for a file an Admin imports, such as a CBL reading list, against the entry as the file identifies it (a database id, or its series, number and year), since old ADR-0027 (canoncore-history) found almost nothing remembered rejections.

## Considered Options

- Keep only the winning value, as Plex and Jellyfin do: rejected, it cannot show where a value came from or what else was said.
- A shipped global ranking of Providers: rejected with the default Provider (ADR-0002).

## Consequences

- Accepted imports and Matches are undoable too, because about 3% of the old merges were wrong and irreversible (old CNCORE-441).
- Installing a Provider later proposes a link from each existing Item to that Provider's record, with confident links accepted in bulk; once a link is accepted, its values arrive as Statements and refresh on their own. A wrong link never silently rewrites the Library.
- A Rejection is proposed again only when the Provider's data changes meaningfully, or an Admin clears it from Settings › Rejected.
