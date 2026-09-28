# A fixed hierarchy per medium, with Orderings on top

Each medium has a fixed hierarchy (Show, Season, Episode; Artist, Album, Track; Book series, Book; Comic series, Issue; a Film, optionally in a Collection) that is its "As broadcast" home, so an ordinary show like Friends looks exactly like Plex, and Orderings (Ordering plus Placement) are a separate layer on top, holding Timelines, lists and alternate orders across media. A show's structure is chosen at import from what its Provider offers, the default numbering or a grouping such as a TMDB episode group or a TheTVDB alternate order, and choosing a story grouping gives it Show, Season, Story, Part, with every other grouping importable as an Ordering, so the Doctor Who case needs nothing Doctor Who-specific in the core. There is no continuity concept: an alternative continuity is a nested Franchise with its own Orderings (Star Wars, then Legends with a Legends Timeline), and the word "continuity" stays reserved.

## Considered Options

- "Everything is an ordering" (the old Containers): rejected after the prototype on `prototype/schema-structure`, because it makes ordinary shows generic and takes away the Timelines' special status.
- A continuity concept of its own: rejected, a nested Franchise already holds one.

## Consequences

- Orderings come from layered Providers (TMDB collections and episode groups, TheTVDB alternate orders, fandom wikis through one Provider with an adapter per wiki format, MDBList lists) and from Profiles, and every Ordering imports and exports as a list of provider-neutral `provider:id` ids after Kometa's `text` builder.
