---
status: proposed
---

# A Group's Rule is a predicate, never a walk of the tree

A Group fills by a stored predicate over an Item's own Properties, from a closed set of rule kinds:
`property`, `provider`, `manual`. It never fills by descent from a root.

**DESCENT WAS RECOMMENDED THREE TIMES BEFORE ANYONE CHECKED, and it is wrong every time.** That is
why this record exists: the reasoning is cheap to reconstruct wrongly and expensive to re-refute, and
without a record the fourth proposal is already written.

Two independent reasons refuse it.

**No product derives a grouping from the hierarchy.** Six were read on primary sources -- Plex,
Jellyfin, Kodi, TMDB, MusicBrainz, and the schema.org/BIBFRAME pair. Every one of them derives a
grouping either from a PROVIDER IDENTIFIER carried on the item (TMDB's `belongs_to_collection`,
Kodi's scraped set title interned by `AddSet`) or from a RULE OVER ITEM METADATA (Plex's saved
library filter, Kodi's `SmartPlayList` matching its `set` and `tag` fields). Not one walks the
container tree. Kodi's rule engine can match `set`, `tag`, `season` and `episode` and still offers no
way to ask what a thing sits inside.

**And multi-placement makes "below" ambiguous by construction.** One Item sits in many orderings at
once, each with its own position, so an Item has no single parent and "everything below X" has no
single answer. The mechanism no competitor needs is also the one this product's central feature
refuses.

## Why a Group is not where a Provider's collection lands

A franchise a PROVIDER asserts is a CONTAINER, not a Group, and `packages/contract` already says so:
`series_id` exists because "a NAME cannot be browsed", and the contract records that "TMDB asserts
its collections and its series as containers".

So the two are not competing shapes for one thing. **A Container is what a source asserts and can be
disagreed with; a Group is what the Owner narrows their own view to, and no one else supplies it.**
That is the load-bearing line, and it is SOURCE rather than order: a Placement carries a source and
Providers may disagree, where Group membership carries neither.

**An unordered aggregation therefore needs no new construct**, which is the thing worth writing down.
`is_ordered` already sits on the Container and `position` is already nullable on the Placement,
recorded there as "the source that asserted the membership asserted no position for it", with
ADR-0017's uniqueness taking NULLS NOT DISTINCT so two sources both saying "a member, position
unknown" collapse to one row. A provider collection lands as an UNORDERED CONTAINER and nothing
fabricates an order nobody claimed.

That split is the one the standards reached independently. BIBFRAME separates `bf:Collection`,
"Aggregation of resources, generally gathered together **artificially**", from `bf:Series`, which
carries `bf:seriesEnumeration`; MusicBrainz separates an ordered Series, whose position is the
relationship attribute "Number", from an unordered per-user Collection. Artificial gathering is a
browsing scope. A collective title is a container.

## What this does not license

**No minimum-size gate.** Plex ships "Minimum automatic collection size" and Jellyfin's TMDb Box Sets
plugin a "configurable minimum number of films" because BOTH auto-create collections from provider
data, and Plex says why in as many words: "This may cause many unwanted collections to be
automatically created, particularly collections where you only have one item." Nothing here
auto-creates a Group, so there is no flood to gate. The finding is real and lands on Containers, not
on Groups. Do not import the knob without the mechanism that needs it.

**`category` is not a rule kind.** ADR-0016 makes it item-valued over a category graph that is cyclic
and 22 levels deep, so it is a sub-project rather than a switch.

## Evidence

Six products read on primary sources on 2026-09-22 -- Plex's Collections article, Jellyfin's
`BoxSet.cs` and `CollectionManager.cs`, Kodi's `VideoDatabaseDDL.cpp` and `SmartPlayList.cpp`, TMDB's
movie-details and collection-details references, MusicBrainz's Series and Collection docs, and
`bibframe.rdf` with schema.org's `CreativeWorkSeries`. Wikidata's rank semantics were checked the
same day against the RDF dump format and measured live, and are recorded here only as the reason a
rule over a LITERAL would have needed a fusion decision; a rule over an item-valued Property does
not, because a reference survives a source-order change.

The descent proposal and its refusal are in `CONTEXT.md` under **A Group's Rule**, whose `_Avoid_`
list carries `descent` for this reason.
