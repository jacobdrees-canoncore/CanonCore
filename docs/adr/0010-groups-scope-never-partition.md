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
with it would be wrong about every one of them — and since CNCORE-180, about three of the five
rather than all of them:

- **Browsing and search are BUILT, all three Listings, under CNCORE-179 and CNCORE-180.** The
  Catalogue narrowed to a group first; work-browsing and **search** followed, and `and` the same
  predicate onto each of their questions rather than writing a second one. What each ticket built is
  below, under its own heading.
- **Which providers are asked** is CNCORE-182, and it is the one of the three still to build because
  it needs a second relation (a group to the providers it reaches) that no migration writes.
- **Scanner roots** and **the review queue** DO NOT EXIST AS CONSTRUCTS IN THIS PRODUCT, so they are
  not unbuilt scoping over a built thing — there is nothing to scope. Nothing in the repository scans
  a filesystem and nothing queues a review. They stay in the list because the list is CLOSED and its
  closure is the load-bearing half: a scope becomes a partition by accretion, one reasonable-looking
  addition at a time, and a list edited down to what exists would stop refusing the sixth thing.

**So the negative half of this record is the half that is now testable, and the positive half was
still a promise** when this was written; CNCORE-179 and CNCORE-180 keep the first two of its five. `group_items` carries no medium, no field set, no vocabulary and no source order,
and `groupPublic` emits an id and a name — which is the shape refusing to accumulate rather than a
payload waiting to be filled in.

**AND THE MEMBERSHIP IS NOT A PLACEMENT**, which `CONTEXT.md` gained a headword for under this
ticket. Both are "one item's membership of one thing", and they are two tables because a Placement
carries a POSITION and every SOURCE that asserted it, where a group membership carries neither: a
group is not a container, and nobody but the Owner ever says what a scope holds. Folding them would
be this record's partition arriving through the schema.

## As built, under CNCORE-179 — and this record stays PROPOSED

**BUILT: THE CATALOGUE NARROWS TO A GROUP, and its size is the group's.** `/?group=<id>` answers the
catalogue within one scope, picked from a row of links on that page rather than typed as an address
-- by any reader, since reading the catalogue is open ([[0072-no-visibility-system]]) and which
scopes exist is part of it. A walk within it keeps the scope from page to page, `Everything` clears it, a
group with nothing in it says so rather than offering the empty catalogue's routes, and a link naming
a group that is not there says that instead.

**ONE PREDICATE, AND IT ARRIVES BEFORE THE SIZE IS TAKEN.** `inTheGroup` in
`packages/db/src/queries.ts` is the set of a group's live memberships, and `readCatalogue` `and`s it
onto the catalogue's own predicate -- through `withinTheGroup` since CNCORE-180, and the same way
Catalogue search `and`s its match on -- so every
Listing that narrows reads membership from one place. That combined value is the `within`
`walkListing` hands to `theSize`, and the Rows read their `WHERE` back off the same value — so a group narrowing the Rows and not
the count, which is the whole catalogue's size reported over a narrowed page, has no second place to
be missing from. The Listing contract (`listing.test.ts`) walks the narrowed catalogue as one more
entry in its list -- derived from the unnarrowed entry by `narrowedToAGroup` since CNCORE-180 -- and
so inherits the cap, the walk and both positions of the size.

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

**WHAT IT DOES NOT DO.** Work-browsing and Catalogue search did not narrow, and the procedures that
answer them did not accept a group, until CNCORE-180 below: an input that parsed one and answered the
whole catalogue would have been a promise the handler does not keep. The scope did not follow a
reader from `/` to any other page, and a header link back to the catalogue dropped it, until
CNCORE-181 below. And a Row's own figure (`holds`, [[0140-a-row-carries-its-own-count-and-one-predicate-answers-it-twice]])
is NOT narrowed: an Ordering's Row counts every member, in or out of the group, because the figure's
contract is what the reader finds by following the Row, and the Ordering's own page is not narrowed
either.

## As built, under CNCORE-180 — and this record stays PROPOSED

**BUILT: WORK-BROWSING AND CATALOGUE SEARCH NARROW TO A GROUP, and each reports the size of what it
searched.** `/works?group=<id>` answers "what can I watch" within one scope, and
`/search?q=<query>&group=<id>` answers "where is the thing I am thinking of" within it. Each page
offers the Catalogue's own picker -- one component now, beside the walk in
`apps/web/src/components/listing.tsx` -- walks within the scope, says a group that is not there is
not there rather than "nothing to watch" or "nothing matched", and names the group in its own empty
state. Search offers the picker only once a query is asked, and clearing the scope keeps the query:
`Everything` on a narrowed search is the same search across the catalogue.

**EACH LISTING KEEPS ITS OWN QUESTION INSIDE THE SCOPE**, which is [[0077-work-browsing-excludes-entities-by-kind]]
surviving the narrowing. One group holding a Person, a Character, an Ordering of entities, an Ordering
of stories and a story lists all five on the Catalogue, two on work-browsing, and finds the Person
through search -- asserted from all three surfaces against that one group. A narrowing that REPLACED
work-browsing's predicate rather than joining it would list the cast; this record's line between a
scope and a partition is the same line read from the other side.

**ONE PLACE A LISTING TAKES A GROUP.** CNCORE-179's `readCatalogue` joined `inTheGroup` with a
ternary of its own; three copies of that ternary would be three readings of what an absent group
means, so it is `withinTheGroup` in `packages/db/src/queries.ts`, and `readCatalogue`, `readWorks` and
`searchCatalogue` each hand it their question. At the router `group` moved into the shared
`listingInput`, where CNCORE-179 said it belonged once every handler kept the promise. The Listing
contract walks each of the three narrowed as well as whole, derived from the unnarrowed entry, so a
fourth Listing is walked within a group without anybody remembering to add it twice.

**WHAT IT COSTS, MEASURED AGAINST THE CORPUS** the way CNCORE-179 was: 2026-09-19, the Owner's own
install, 8,052 Items, PostgreSQL 18.6, `group_items` a session-local temporary table of the same name
and indexes inside a transaction that was rolled back, then `ANALYZE`d. The statement is each
Listing's first page (`limit` 101: a page of 100 and the Row that says there is more) as the app
renders it, captured from the running code by wrapping the pool's `query` rather than written by
hand. The three groups are the first 50 live Items by id, the distinct live Items of the Ordering
holding the most live Placements, and every live Item. `EXPLAIN (ANALYZE, BUFFERS)`, warm cache,
median of five after one discarded run, in milliseconds with the range beside it:

| First page of | Unnarrowed | 50 Items | Largest Ordering's 2,143 | Every Item |
|---|---|---|---|---|
| Work-browsing | 3.2 (3.2–3.3) | 1.5 (1.4–1.5) | 3.4 (3.4–3.7) | 6.9 (6.6–7.0) |
| Search, `dalek` (177 matches) | 2.4 (2.2–3.6) | 0.3 (0.3–0.3) | 1.2 (1.1–1.5) | 4.1 (3.9–5.2) |
| Search, `the` (4,115 matches) | 15.1 (14.8–16.8) | 1.5 (1.4–1.6) | 8.6 (7.9–8.8) | 17.2 (16.8–17.5) |

**A SCOPE ANYBODY DRAWS COSTS WHAT THE LISTING UNNARROWED COSTS, OR LESS.** The one real scope above
its unnarrowed figure is work-browsing within the largest Ordering, by 0.2 ms. The last column is the
ceiling CNCORE-179 named, and not a scope anybody draws: a group holding the whole catalogue narrows
nothing and pays for the set twice.

**THE PLANNER PICKS WHICH SIDE TO START FROM, and both are served.** Every `dalek` plan, and `the`
unnarrowed and within the two larger groups, reach the match through a Bitmap Index Scan on
`items_title_trigram`, so the group joins the match rather than displacing it. `the` within 50 Items
does not touch that index at all: the planner starts from the group's 50 memberships and filters
them by the match, which is why it is the cheapest search in the table. Nothing was added to steer
either choice.

**WHAT IT DOES NOT DO.** The scope did not travel between surfaces: a group picked on `/` was not
carried to `/works`, and the search box in the header asked across everything wherever it was
submitted from, so a reader picked the group again on each surface -- until CNCORE-181 below. A
Row's own figure is not narrowed on any of the three, for the reason CNCORE-179 gives above. And
which providers a group asks is still CNCORE-182's, so this record stays `proposed`: two of its five
scoped things are built, one is not, and two do not exist to be scoped.

## As built, under CNCORE-181 — and this record stays PROPOSED

**BUILT: THE SCOPE SURVIVES A RELOAD AND TRAVELS IN A SHARED LINK, AND FROM ONE SURFACE TO THE
NEXT.** The group is in the address on all three Listings, so the address alone reproduces the
page: `scope.test.ts` has the Owner pick a group on each surface and asks the picked address again,
as the Owner and as a reader with no session, and all three are served the same page. Nothing holds
the scope outside the address -- no session, no cookie, no script's memory.

**THE HEADER CARRIES IT.** Its wordmark and `Works` link to the scope the page is narrowed to, and its
search box carries it as a hidden field behind the reader's query, which closes what review of
CNCORE-180 found: a second query typed on a narrowed search asked across everything. How the header
reads an address a layout is never handed is
[[0066-path-is-identity-query-is-the-route]]'s, under CNCORE-181.

**AN ITEM IS ONE ITEM WHICHEVER GROUP LED TO IT.** The seeded instance's story sits in two groups,
and every narrowed Listing -- three surfaces, two groups -- links it at the one bare `/items/<id>`,
whose canonical is itself. So an Item's page is not narrowed, and its header carries no scope: a
reader returns to the scope with Back. That is the cost of one address per Item, stated in
[[0066-path-is-identity-query-is-the-route]] beside it.

**WHAT IT DOES NOT DO.** It remembers no scope outside the address, so opening `/` fresh is the whole
catalogue and following the header from an Item's page is too. Which providers a group asks is still
CNCORE-182's, so this record stays `proposed` for the reason CNCORE-180 gives above.
