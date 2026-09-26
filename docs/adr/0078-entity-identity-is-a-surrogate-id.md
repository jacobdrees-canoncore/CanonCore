---
status: proposed
---

# Entity identity is a surrogate id, never a name

An entity is identified by a surrogate id with external-id mappings beside it. Never by its name.

Jellyfin keys people on their name, so two people sharing a name merge irreversibly, and two
spellings of one person cannot be merged even when their external ids match. Verified at source on
2026-09-10: `GetPersonId(name)` is `MD5(typeof(Person).FullName + name-derived path)`, the `People`
entity is `Id/Name/PersonType/BaseItems` with **no external-id column at all**, and
`PeopleRepository.UpdatePeople` dedupes on `(loweredName, personType)`.

A maintainer said in 2020 there was "no easy fix ... unlikely to be fixed before the database
rewrite" (issue #3356, still open). In October 2025 the same maintainer wrote, on the same issue:
"**Database has not been redesigned.** The underlying framework was changed, but that has no bearing
on the data models. No work has been done to fix this in 10.11."

Read the whole comment, not the tail of it. The rewrite the 2020 note was waiting for has NOT
happened; 10.11 swapped the framework and left the data model alone. The point is therefore not that
a rewrite failed to fix it — it is that six years on, through a framework replacement and two major
releases, the defect is still there and still keyed on name. Jellyfin's own May 2026 migration
`MergeDuplicatePeople` concedes it in its summary: "Person.GetPath hashes the name verbatim", and
remedies it with a case-folding repair pass rather than a schema change.

Same shape as ADR-0018's stable surrogate placement id, and taken for the same reason.

## As built, under CNCORE-28 -- and this record stays PROPOSED

**BUILT: the mapping, for what the product actually imports.** Migration 3 seeds
an `external_id` property, so a provider's own id for a record is a STATEMENT
carrying that provider as its source (ADR-0012) -- and `importProvidedRecord`
and `importBrowsedContainer` find or create against (source, external id) rather
than always inserting. A second import of one record refreshes the first item; a
second browse of one container adds no items and no placements. The surrogate id
is untouched by any of it, which is the half of this record that was already
true in migration 1: identity stays the id CanonCore minted, and the mapping sits
BESIDE it.

**(SOURCE, EXTERNAL ID), NEVER THE ID ALONE.** A provider's id is unique in its
own namespace and nowhere else, so two providers both calling something `265`
have said nothing to each other. An importer keying on the bare id would merge
two unrelated stories on a collision between two numbering schemes -- the same
class of failure as Jellyfin's name key, arrived at from the other direction.

**NOT BUILT: the entity half, which is the half this record's evidence is
about.** Nothing imports an entity at all. Every imported item is a `work`
(ADR-0005), and a provider's `writers` are deliberately dropped because minting a
person per import is worse than having none -- so there is no person, no
character and no organisation for a mapping to identify, and the two-people-
sharing-a-name failure Jellyfin has cannot yet be reproduced here to be shown
fixed. The mechanism is kind-agnostic (a statement takes any item), which is why
this is an absent CALLER rather than an absent capability. It arrives with the
slice that first imports an entity.

**NOT BUILT: ids AGREEING across providers.** That is ADR-0026's operation, and
it stays unbuilt behind this one. This record's mapping is what its identifiers
have to exist for.

**BUILT, UNDER CNCORE-31: ONE PROVIDER'S ID IS HELD TO ONE ITEM BY THE
DATABASE.** An earlier draft of this section said the find-or-create's own
transaction did it. IT DOES NOT, and that correction stands: a transaction is
atomicity, not mutual exclusion. `db.transaction` sets no isolation level, so it
runs at READ COMMITTED, and two callers that both find nothing would both insert.

Migration 5 refuses the second, with `statements_one_item_per_external_id`: a
PARTIAL unique index on `("source_id", md5("value_literal"))`, predicated on the
`external_id` property and on `"deleted_at" IS NULL`. Partial because every other
property is a claim two items may legitimately share. The property's id is a
LITERAL because PostgreSQL refuses a subquery in an index predicate, and ADR-0044
is what makes one available -- exactly one owner row, so exactly one `external_id`
property row, pinned with `format(..., %L)` and read with `INTO STRICT`, so a
future multi-user migration meets a refusal rather than whichever row came back
first. The hash is migration 3's measured reason (a btree tuple caps at 2704
bytes) and it costs more here than there: on a UNIQUE index a collision REFUSES a
correct write rather than merely widening a scan. Accepted and named in the rung.

**AND THE DELETE HALF, WHICH THE INDEX COULD NOT SHIP WITHOUT.**
`itemWithExternalId` honours the item's tombstone (ADR-0075), so a re-import
after the owner deletes an item writes a FRESH item and needs a second
`external_id` statement with the same (source, value) -- which the index would
refuse, failing an import that is correct. Migration 5 therefore also tombstones
an item's statements WITH the item, by trigger. By trigger rather than by a rule
the delete path remembers, because that path does not exist yet: nothing in the
product deletes an item, and a rule written into a function nobody has written is
a rule nobody will read. ADR-0075 carries the mechanics.

**AND THE RACE WAS ALREADY UNREACHABLE, BY ACCIDENT.** This is the finding
CNCORE-31 turned up and it corrects the paragraph above rather than sitting under
it. The ticket said the duplicate becomes reachable with the first import surface
that has a button. It does not. `providerSource` REWRITES the source row on every
import so a revised licence cannot go stale (CNCORE-8, migration 4), and two
imports from one provider update ONE row -- so the second blocks on the first's
transaction before it ever reaches the find, and then FINDS the item and
refreshes it. MEASURED, not reasoned: with `statements` held by a third
transaction, the two racers park on `insert into "statements"` (`Lock/relation`)
and on `update "sources" set "attribution_notice"` (`Lock/transactionid`).

That is an argument FOR the index, not against it. The mutual exclusion is a lock
nobody meant to take, sitting one plausible optimisation away from going -- "only
write the attribution when it changed" is a reasonable change that would restore
the defect silently, in a file whose author is thinking about licences rather than
about identity. The index is the guarantee; the row lock is a coincidence that
currently agrees with it. It also binds every OTHER writer: a merge, a scanner, a
seed and a hand-written fix all meet the same refusal, and none of them goes
through `providerSource` at all.

What the schema does carry is the index that makes the reverse lookup cheap:
`statements_property_literal_source`, on a HASH of the value rather than the value
-- a btree tuple is capped at 2704 bytes and `value_literal` is unbounded, so
indexing it directly would put that cap on every literal statement in the
catalogue. Measured: 2600 random characters insert, 2800 fail.

**NO BACKFILL, and it cannot be done.** An item imported before migration 3
carries no external id and nothing kept the one it was imported by, so it is
found by nothing and the next import of that record writes a fresh item beside
it. Deciding those two are one work is matching.

## Identifiers, under CNCORE-349 -- and this record STILL STAYS PROPOSED

**A PROVIDER'S IDS IN OTHER ID SPACES ARE HELD NOW, BESIDE THE MAPPING AND NOT IN IT.** CMPP's
`external_ids` carries a record's id in someone else's space, keyed by Scheme: `provider-tmdb`
sends `{ tmdb: "603", imdb: "tt0133093" }` for The Matrix. Migration 23 writes those to a table of
their own, `identifiers`, one row per (item, source, scheme, value), sourced like a Statement and
withdrawn by tombstone on a refresh. `identifiers_one_value_per_scheme` holds one live value per
(item, source, scheme), because `external_ids` is a map keyed by scheme and a provider gives one
answer per scheme. `item.get` reads them back and the Item page lists them.

**NOT THE `external_id` PROPERTY, BECAUSE MIGRATION 5 WOULD REFUSE THEM.** That property is the id a
provider knows ITS OWN record by, and the partial unique index holds one (source, value) to one
item because that is how an import finds its item again. An id in another space does not have that
shape. `provider-tmdb` files `tmdb: "603"` on movie 603 and on programme 603 alike, because TMDB
numbers films and programmes separately, so the second import would be refused. It would also mix
two meanings under one property: "this source knows it as 265" and "this source says IMDb knows it
as tt0133093". Nor a Property per Scheme, which is a provider defining a field
([[0029-only-the-product-adds-fields]]).

**STILL NOT BUILT: ids agreeing across providers.** Two providers' Identifiers for one Scheme and
value are [[0026-enrichment-reaches-every-provider]]'s evidence that they describe one work.
Nothing reads them that way yet, and nothing here decides a match.
