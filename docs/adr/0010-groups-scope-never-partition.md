---
status: proposed
---

# Groups are a browsing scope, never a partition

Group membership is its own many-to-many table rather than a column on items.

A column would make a group a partition — an item belonging to exactly one — and multi-placement
is the entire product. A group is also never typed by medium.

**THE CASE RESTS ON MULTI-PLACEMENT AND NOT ON PRECEDENT, because an earlier version of this record
claimed precedent it does not have.** It read: "Plex ran that argument on real users and reversed it
on 2025-07-16, in its own words, 'in hindsight, we recognize this wasn't the right approach'". The
quote is real, staff-authored and correctly dated — verified twice — but it is about Plex splitting
its APPS by medium, not its libraries, and the sentence invited the reading that the category tried
medium typing and abandoned it. **It did not, and is not.** Plex's own API documentation says
"Libraries are typed"; the very post being reversed announces "support for custom media types"; and
its naming guidance, modified 2026-05-22, still warns that "a failure to separate content such as
movies and TV shows may result in unexpected or incorrect behavior". Every Plex item carries a
singular `librarySectionID`.

**Measured across the category on 2026-09-12, this decision is the unusual one and that is worth
knowing rather than hiding.** Plex, Jellyfin, Emby, Kodi and Audiobookshelf all require a type at
library creation and put each item in exactly one; Komga partitions by path instead. Jellyfin's
`BaseItemDto.ParentId` is a single nullable uuid, and its own untyped option is documented as "broken
and deprecated". Emby staff, asked this exact question in 2019: "This is not currently supported."
Audiobookshelf: "Each item only exists in a single library." Every many-to-many construct in the
category sits BELOW the partition and inherits its type.

**One product ships the thing underneath, which is real cover for the model if not for the group.**
Audiobookshelf lets "a book be part of multiple series to assist with organization, such as in a
larger universe like Star Wars", with a sequence number per membership, decimals included for
insertions. That is [[0009-multi-parent-membership-with-ordering]] built and shipped — and trapped
inside one library, which is the argument for this record in miniature.

## What a group does NOT scope

A group scopes browsing, search, WHICH PROVIDERS ARE ASKED, scanner roots, and the review queue.

It does NOT scope the field set, the vocabularies, progress, entities, or THE SOURCE ORDER
(ADR-0025).

The negative half is the load-bearing one. A partition is what a scope becomes by accretion, one
reasonable-looking addition at a time, and each of those five would be a defensible thing to scope
if the list were not closed.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`.
## As built, under CNCORE-178 — and this record stays PROPOSED

**BUILT: the group, and nothing it scopes.** Migration 19 adds `groups` — an id, the Owner's name,
and the owner id, timestamps, tombstone and change sequence every table in this catalogue carries
(ADR-0044, ADR-0075) — and `group_items`, which is the many-to-many table this record's first
sentence asks for and which carries ADR-0040's merge stamp besides. **"Nothing else" means no
SCOPING column**, which is this record's subject: no medium, no field set, no vocabulary, no source
order, no root. It is not a claim that the table is two columns wide, which is how an earlier draft
of this sentence read and which review caught against criterion five of the ticket. The Owner creates, names, renames and deletes a scope from `/groups`, puts an Item in one
from the Item's own page, and puts ONE ITEM IN SEVERAL at once, which is the case the whole decision
rests on. Deleting a group tombstones it and its memberships in one transaction and names no Item at
all: the function does not mention `items`, which is the strongest form that promise can take.

**NOT BUILT HERE: ALL FIVE OF THE SCOPED THINGS ABOVE, and the five are not in one state.** This
record's "What a group does NOT scope" section closes the list at browsing, search, which providers are
asked, scanner roots and the review queue. A reader who finds the table and assumes the scoping came
with it would be wrong about every one of them — and since CNCORE-179, about all but part of one:

- **Browsing is HALF BUILT, one surface of the two, under CNCORE-179.** The Catalogue narrows to a
  group; work-browsing does not yet, and neither does **search**, and both are CNCORE-180. That
  ticket threads a group through a door that already exists rather than writing a second predicate,
  because the predicate is applied where every Listing of Items meets. What CNCORE-179 built is
  below, under its own heading.
- **Which providers are asked** is CNCORE-182, and it is further off than the two above because it
  needs a second relation (a group to the providers it reaches) that no migration writes.
- **Scanner roots** and **the review queue** DO NOT EXIST AS CONSTRUCTS IN THIS PRODUCT, so they are
  not unbuilt scoping over a built thing — there is nothing to scope. Nothing in the repository scans
  a filesystem and nothing queues a review. They stay in the list because the list is CLOSED and its
  closure is the load-bearing half: a scope becomes a partition by accretion, one reasonable-looking
  addition at a time, and a list edited down to what exists would stop refusing the sixth thing.

**So the negative half of this record is the half that is now testable, and the positive half was
still a promise** when this was written; CNCORE-179 is one surface of it kept. `group_items` carries no medium, no field set, no vocabulary and no source order,
and `groupPublic` emits an id and a name — which is the shape refusing to accumulate rather than a
payload waiting to be filled in.

**AND THE MEMBERSHIP IS NOT A PLACEMENT**, which `CONTEXT.md` gained a headword for under this
ticket. Both are "one item's membership of one thing", and they are two tables because a Placement
carries a POSITION and every SOURCE that asserted it, where a group membership carries neither: a
group is not a container, and nobody but the Owner ever says what a scope holds. Folding them would
be this record's partition arriving through the schema.

## As built, under CNCORE-179 — and this record stays PROPOSED

**BUILT: THE CATALOGUE NARROWS TO A GROUP, and its size is the group's.** `/?group=<id>` answers the
catalogue within one scope, and the Owner picks it from a row of links on that page rather than
typing an address. A walk within it keeps the scope from page to page, `Everything` clears it, a
group with nothing in it says so rather than offering the empty catalogue's routes, and a link naming
a group that is not there says that instead.

**ONE PREDICATE, APPLIED WHERE THE LISTINGS MEET, AND BEFORE THE SIZE IS TAKEN.** `inTheGroup` in
`packages/db/src/queries.ts` is the set of a group's live memberships, `and`ed onto whatever question
the Listing already asks, inside `walkListing`: the one function the catalogue, work-browsing and
Catalogue search all walk through. It is joined to the Listing's own predicate before `theSize` reads
it, and the Rows read their `WHERE` back off the same value — so a group narrowing the Rows and not
the count, which is the whole catalogue's size reported over a narrowed page, has no second place to
be missing from. The Listing contract (`listing.test.ts`) walks the narrowed catalogue as one more
line in its list, and so inherits the cap, the walk and both positions of the size.

**IT NARROWS THE LISTING'S QUESTION RATHER THAN REPLACING IT**, which is this record's own line
between a scope and a partition read from the other side. An Item deleted from the catalogue stays
gone from a group it still sits in — deleting an Item names no group, so its membership is live and
only the catalogue's rule keeps it out. And it reads the MEMBERSHIP's tombstone without joining
`groups`, which is safe because `deleteGroupByHand` tombstones both in one transaction and
`putItemInGroupByHand` refuses a group that has gone; CNCORE-178's test of the deletion said this
read was coming and asserts the half it depends on.

**A GROUP THAT NAMES NOTHING NARROWS TO NOTHING**, which is [[0066-path-is-identity-query-is-the-route]]'s
rule for a parameter that is not an identity: whether it names anything is what the answer says. A
cursor naming nothing starts the walk over because it is a position; a group is a question, and the
honest answer to "what is in a scope nobody drew" is nothing — with the page saying the scope is not
there, since a deleted group and an empty one are two facts a reader cannot tell apart unaided. A
malformed id is refused by the same shape guard `findItem` uses, so a typo in a shared link is not a
500.

**WHAT IT COSTS, MEASURED AGAINST THE CORPUS RATHER THAN A SEED.** 2026-09-19, against the Owner's
own install: 8,052 Items, PostgreSQL 18.6. That install predates migration 19, so `group_items` was a
SESSION-LOCAL TEMPORARY TABLE of the same name and the same two indexes, filled from the catalogue
and gone when the session ended -- nothing of the Owner's was written. The statement is the first
page as `walkListing` renders it, Row figure and size included. `EXPLAIN (ANALYZE, BUFFERS)`, warm
cache, median of five:

| First page of the catalogue | Median | Range |
|---|---|---|
| Unnarrowed | 3.6 ms | 3.6–4.0 |
| Narrowed to 50 Items | 1.7 ms | 1.6–4.1 |
| Narrowed to the largest Ordering's 2,143 distinct Items | 4.2 ms | 3.8–4.6 |
| Narrowed to every Item in the catalogue | 8.7 ms | 7.7–28.2 |

**THE LAST ROW IS THE CEILING AND NOT A SCOPE ANYBODY DRAWS** -- a group holding the whole catalogue
narrows nothing -- and it costs what it does because the Rows and the size each take the whole set.
**AND NO INDEX WAS ADDED FOR IT.** `group_items`' only index on `group_id` is the unique constraint,
which LEADS with `owner_id`; the plan reached it anyway, with an `Index Cond` on `group_id` alone and
two index searches, because there is one Owner. That was read off the plan on 18.6 rather than
assumed, and it is the thing to re-check if the database line `compose.yaml` pins ever moves down.

**WHAT IT DOES NOT DO.** Work-browsing and Catalogue search do not narrow (CNCORE-180), and the
procedures that answer them do not accept a group: an input that parsed one and answered the whole
catalogue would be a promise the handler does not keep. The scope does not follow a reader from `/`
to any other page, and a header link back to the catalogue drops it; carrying it further is
CNCORE-181's. And a Row's own figure (`holds`, [[0140-a-row-carries-its-own-count-and-one-predicate-answers-it-twice]])
is NOT narrowed: an Ordering's Row counts every member, in or out of the group, because the figure's
contract is what the reader finds by following the Row, and the Ordering's own page is not narrowed
either.
