---
status: accepted
---

# A listing is walked forward from the last item it showed

Every listing in CanonCore is capped, and the cap is only half a mechanism: a surface that says
"Showing 100 of 4,312 items" and offers no way to reach item 101 has told the owner the size of a
library it will not let them see. This is the other half.

**A listing is walked FORWARD, and the cursor is the id of the last Item the page before it showed.**
`/?after=<item-id>` on the page, `after` on the procedure, `continuesAfter` in the answer — an
Item's id where there is more and `null` where the listing ends.

## Not an offset, and the second reason is the one that settles it

The obvious shape is `?page=7`, which is what both products this project studies ship: every Plex
list response carries `offset`, `size` and `totalSize`, and Jellyfin pages everything on `startIndex`
and `limit`. Both are recorded in `docs/research/competitor-sweep/`, where the sweep raised paging as
a gap at convergence 4 and said the quiet part: **retrofitting cursors across a shared contract
package is the expensive kind of change.** So it is chosen once, here, before there are three
listings to change.

The FIRST reason against an offset is cost, and it is PostgreSQL's own: "the rows skipped by an
`OFFSET` clause still have to be computed inside the server; therefore a large `OFFSET` might be
inefficient". Page forty-three of the archive would have the server walk four thousand rows and
discard them. That is an argument about a big catalogue, and a reader may reasonably discount it at
eleven thousand items.

**AND AS BUILT IT IS ONLY HALF WON, WHICH IS WORTH KNOWING BEFORE SOMEBODY QUOTES IT.** Measured
with `explain analyze` on the 254-item fixture, page two of a hundred: the cursor is applied at the
scan ("Rows Removed by Filter: 101") so only the 153 rows still ahead of the reader reach the
`Sort` — work that SHRINKS as the walk goes on, where an offset sorts the whole catalogue on every
page. But there is no index scan. `items_sort_name` indexes the bare column and the order is on
`coalesce(sort_name, title)`, so each page still sequentially scans the table: `Seq Scan on items`,
not a seek. **The sort is cheaper per page and the scan is not, so what a cursor buys here today is
less than the quotation above suggests.** An index on the expression — `(coalesce(sort_name, title),
id)` — is what would turn this into a seek, and it is deliberately NOT added: nothing has measured a
problem at this size, the ticket is explicit that the walk needs no index beyond ADR-0014's, and an
index added against a number nobody has taken is a migration written on a guess. The reason that
settles the choice is the next one, and it does not depend on any of this.

The SECOND reason is correctness, and it holds at any size. **An offset addresses a POSITION IN A
RESULT, and the result moves.** Import an item that sorts early while a reader is on page two and
every later row shifts down one: the item at the boundary is served twice and one item is never
served at all. Delete one and an item is skipped. The criterion CNCORE-82 was written with — "no
Item appears twice and none is skipped" — is not something an offset can satisfy, because the thing
it names is not stable between two requests.

A cursor addresses a ROW rather than a position, so an insert or a delete elsewhere in the catalogue
moves nothing about where the next page starts. Inserts BEHIND the reader are missed and inserts
AHEAD are seen, which is what walking a changing list honestly looks like.

## The cursor is an Item's id, not an encoded sort key

The usual keyset cursor is the sort key and the tiebreak, base64'd into an opaque token. Refused,
for two reasons.

**It would emit a column nothing named.** [[0045-the-public-read-path-names-every-field]] makes the
read path enumerate every field it emits, and `sort_name` is not one of them — it is the projection
([[0014-title-is-a-projection]]), which lives below the seam. A cursor spelling it out puts it in a
URL a reader can read, through a side door, in a format that becomes contract the moment anybody
stores one.

**An id is already the vocabulary.** `/items/<id>` is how this app addresses things
([[0066-path-is-identity-query-is-the-route]]), so `?after=<id>` needs no second format and no
encoding scheme of our own. The cost is one indexed primary-key lookup per page to find where that
Item sits, which is the cheapest query this app makes.

The anchor is read WITHOUT the tombstone filter, deliberately — ADR-0075's rule is about what a
reader is SHOWN, and the anchor is never shown, it is a position. An `after` naming nothing at all
names no position either, so the walk starts at the beginning: that is ADR-0066's rule for a
non-identifying parameter, and it means a stale bookmark answers with the catalogue rather than with
an error. **And so does an anchor whose sort key the tombstone took** — read, found, and no more
placeable in this order than an id nobody minted, which is the next paragraph's whole subject.

**IT DID NOT RESUME PAST A DELETE, AND THIS PARAGRAPH SAID IT DID.** The sentence removed from
here read "So a kept link to page two still works after the Item it was cut at is gone, which is
ordinary rather than a corner case." **Measured 2026-09-12** against `readCatalogue`, five Items
walked two at a time: page two answered `Probe walk 3, Probe walk 4` before the anchor was deleted
and **nothing at all** after, which `/` renders as "The catalogue ends here" over a catalogue with
three Items still unseen.

The mechanism is one nothing here anticipated: **a deleted Item has no title and no sort name.**
Migration 5's `items_tombstone_statements` tombstones every statement of a deleted Item, that
re-fires the projection trigger, and the projection over no live statements is NULL — so the columns
are GONE rather than merely hidden ([[0014-title-is-a-projection]]). Reading the anchor past the
tombstone therefore finds a row whose sort key is null, and the comparison's no-sort-key regime
resumes from the untitled tail with everything between skipped.

**THE ANSWER, UNDER CNCORE-110: an anchor whose place is gone names no position, so the walk starts
at the beginning.** Reading it without the tombstone filter stays, and only the reading is shared
now — the row comes back WITH its tombstone and each order decides what it found. This order is
`coalesce(sort_name, title)` and a deleted Item has neither column, so there is nothing to resume
from: that is [[0066-path-is-identity-query-is-the-route]]'s answer for an id naming nothing at all,
and the one Catalogue search below reached the only way its order allows — an anchor with no title
has no closeness to anything, so it names no position and the search is shown again.

**So a kept link SURVIVES its anchor's deletion without RESUMING at it, which is the price taken
rather than a thing left undone.** A reader following one is shown the catalogue from the top and can
walk it again: every Item still reachable and none skipped, which is the criterion the cap exists to
keep. What is gone is the empty page — and the worse shape measured beside it, a catalogue with no
untitled tail at all, where the walk answered NOTHING and `/` rendered "The catalogue ends here"
over four Items still in it.

**The split is what keeps the tombstone exception worth having, and it is a reason this record did
not have before.** An order this app does not yet hold — on `release_date`, or on when a row was
made — reads a column a delete does NOT destroy, so its anchor still has a place and can still be
resumed from. Only the two orders built on the projection lose one, and they are the two that say so.

**Asserted on BOTH shapes of catalogue, because they fail differently and only one of them looks like
an ending.** The suite's shared database has an untitled tail; "no untitled Item anywhere" is a
property of a whole catalogue rather than of a query, so the second shape is a catalogue of its own —
the same reason the page-level walk below needed a third instance.

**Mutation-checked by removing the clause, and the FIGURE moves with the invocation while the SHAPE
does not.** The suite's database is shared and accumulates, so those two files run alone answer 1
Item of 13 where the whole package answers 9 of 99 and work-browsing 26 of 222 — which is worth
saying because a number quoted off one invocation reads as a property of the catalogue. What holds
either way: the catalogue with an untitled tail answers that tail and skips everything before it,
the catalogue without one answers NOTHING, and work-browsing fails with them through the same walk.

## The order has to be TOTAL, and it is the part that gets built wrong

PostgreSQL is explicit that "using different `LIMIT`/`OFFSET` values to select different subsets of a
query result will give inconsistent results unless you enforce a predictable result ordering with
`ORDER BY`", and a keyset cursor needs more than predictable: it needs UNIQUE, or it cannot say what
"after" means.

The catalogue's order is `coalesce(sort_name, title)` and then the id. **Both halves are load-bearing
and each is a way to lose Items silently.**

- **A cursor comparing only the sort key steps over the second of two Items that sort the same.**
  Measured: with the id comparison removed, the walk test passed on one run and failed on the next,
  because ids are random and whether a tied pair straddles a page boundary is luck. A test for this
  has to CUT THE PAGE AT THE TIE rather than hope a page ends there.
- **A plain row comparison loses every Item with no sort key at all, permanently.** An Item nobody
  has titled has neither column, and `(null, x) > (k, y)` is NULL rather than true, so those Items —
  which sort last, as one block — are never reached from any page. The comparison has two regimes and
  has to be written as two.

## What this shape cannot do, said plainly rather than discovered later

- **No "items 101–200 of 4,312".** A keyset walk has no offset, so a page cannot say WHICH hundred it
  is showing without counting. "Showing 100 of 4,312 items" is what it can honestly say.
- **No jump to page seven**, and no page numbers. An A–Z jump (`nameStartsWith`, which Plex has as
  `firstCharacterKey`) is the navigation that fits this shape, and the sweep already named it as
  cheap and adjacent. It is not built.
- **A cursor moves if the Item it names is RETITLED under the reader.** The anchor's key is re-read
  on each request, so if an import changes the title or `sort_name` of the Item page one ended on
  while the reader is still on page one, page two resumes from wherever that Item sorts NOW and
  everything between the two positions is skipped. This is the one case an ENCODED-KEY cursor would
  win, because a key is a value and cannot be edited out from under a reader — and it is the price
  of the id, taken with the reasons above rather than overlooked. It is narrower than the offset's
  failure it replaces: an offset shifts on any insert or delete ANYWHERE ahead of the reader, where
  this needs an edit to the one Item the cursor names, inside the seconds between two clicks.
- **A kept link does not RESUME past its anchor's own deletion: it starts the listing over.** The
  same family as the retitle above — the anchor's key changing under the reader — with the key GONE
  rather than moved, so there is no position left to resume from and the reader is shown the listing
  from the top. Nothing is skipped and nothing is lost, which is the criterion; what it costs is
  that a reader five pages in walks those five again. The section above has the mechanism, the
  measurement and why the alternative was refused.
- **No Previous, yet.** Reversing a keyset walk means the comparison and the ordering both flip and
  the rows come back reversed — a symmetric `before`, but a second query shape, so it is a layer on
  top of this rather than the missing half of it. Until something needs it, every page past the first
  carries a link to the START of the listing: a reader who arrived on page five from a shared URL has
  no history to go back through, and being stranded is the failure worth closing now.

## Evidence

PostgreSQL's LIMIT/OFFSET documentation, read 2026-09-11, for both quotations above. The query plan
above is `explain analyze` run 2026-09-11 against this repo's own e2e fixture database
(`..._test_paged`, 254 Items) on the PostgreSQL the worktree container runs. Plex's and
Jellyfin's paging shapes are taken from this repo's own sweep — `docs/research/competitor-sweep/`
(G33) and `docs/research/verify-adr-plex.md` — rather than re-derived, because that sweep is where
they were checked against the products.

## As built, under CNCORE-82

**Built for the catalogue listing**, which was the only listing that existed when this was written:
`readCatalogue`, `catalogue.list` and `/`. The rule is written for listings in general because
CNCORE-66 (catalogue search) and CNCORE-67 (work-browsing) are both listings of Items and the sweep's
point about retrofitting a contract is what makes choosing once worth doing.

**AND CNCORE-67 HAS SINCE ADOPTED IT, which is this record's premise holding rather than being
restated.** `/works` walks the same way: the same `A_PAGE`, the same `after`, the same
`continuesAfter` cut at an Item's id. It cost nothing to adopt, because `readCatalogue` and
`readWorks` differ in their WHERE and in nothing else and the walk is now written once for both --
which is the shape this record was hoping for when it declined to write the rule for one surface.
The listing, the count and the walk are one shared component on the page for the same reason.

**AND CNCORE-67 INTRODUCED A THIRD LISTING, WHICH CNCORE-89 HAS SINCE BROUGHT IN.** A Container's
own member list — `Members` on `/items/<id>` — is a listing by this record's first sentence, and it
had no cap, no cursor and no count. `browse` imports a whole category in one call and ADR-0077
measures one at 1,049 stories, so that was a thousand rows on an ordinary page rather than a corner
case. It was not done in CNCORE-67's own pass for a specific reason, kept here because it is what
made it a ticket rather than a line: the other two listings ARE their surface, so the cursor is the
whole query, where an Item page's address already carries `?via=` and `?placed=` (ADR-0066) and a
third parameter has to compose with both without moving the canonical. That is a decision about a
governed address rather than a parameter to add, and the section below is where it was taken.

**AND CNCORE-66 SHIPPED WITHOUT IT AND CNCORE-88 ADDED IT, which is a fourth adoption and the one
this record's scope had to widen for.** Catalogue search orders on `similarity(title, query)` — **a
function of the QUERY, not a column of the Item** — so the anchor's place cannot be READ off the
anchor row the way this record's walk reads `coalesce(sort_name, title)` off it. It is
**recomputed**, against the query resupplied on every page.

**That is a cost, not an impossibility, and an earlier draft of this paragraph said otherwise.** It
argued the query was unavailable "because the cursor does not carry it" — true of the cursor and
irrelevant, since there is no such thing as a search request without a query: a paged search is
`?q=<query>&after=<id>`, and `searchCatalogue` takes the query as a required parameter already.
Given it, the anchor's place is one primary-key lookup plus `similarity(anchor.title, $query)`, and
the walk is an ordinary keyset one. **The door is open.** The overstatement is corrected here rather
than below, because "cannot" is what stops somebody trying — and CNCORE-88 then walked through it,
which is what the next section records.

## The relevance-ordered case, decided under CNCORE-88

**This record governs listings ordered by ANY total order the request can reconstruct, not only ones
derivable from the row alone.** That sentence is the correction: it read "derivable from the row
alone" while the relevance case was open, which was an accurate description of what had been built
and the wrong rule to leave standing, because it reads as a boundary on what the shape CAN cover.

**The cursor is still an Item's id.** Three options were weighed and the ticket named all three:
recompute the anchor's rank; drop relevance ordering for paged results and walk the catalogue order
alone; or widen the cursor beyond an id. The third is the one this record already refuses two
sections above — a cursor spelling out a sort key emits a column ADR-0045 never named into a URL a
reader can read — and it gets no easier when the key is a number derived from the reader's own
query. The second buys one shape at the price of the best match no longer coming first, which is
most of what a search is for. So: **recompute**.

**It costs TWO primary-key lookups per page, not one, and that is measured rather than reasoned.**
The comparison names the anchor's closeness twice — once for `<` and once for `=` — and PostgreSQL
hoists each into its own `InitPlan`: `explain (analyze)` on the paged query shows `InitPlan 1` and
`InitPlan 2`, each an `Index Scan using items_pkey`, each at `loops=1`. Uncorrelated, so twice per
PAGE rather than per row. Folding them into one would mean joining the anchor row in as a relation,
which puts a parameter on the shared walk that only one of its three callers would ever pass — a
worse trade than a second lookup on a unique key. The number is here because this record prices the
id cursor at "one indexed primary-key lookup per page" two sections above, and a relevance-ordered
walk pays that twice.

**THE COMPARISON IS THE WHOLE TUPLE THE `ORDER BY` USES, and each of the three terms is a way to
lose rows.** `(similarity DESC, coalesce(sort_name, title), id)`:

- **Closeness alone steps over every result tied with the anchor, and ties are the COMMON case
  here rather than a corner of one.** Titles of one shape rank identically: `Story 0001` and
  `Story 0250` are both `0.54545456` against `story`, measured. A four-item fixture sharing one
  title walked to ONE of them.
- **The sort key and then the id**, for the reasons the section above gives — except that a search
  needs only ONE regime where the catalogue needs two. The catalogue has to write its comparison in
  two halves because an Item nobody has titled has no sort key, and `(null, x) > (k, y)` is NULL. No
  such row can be in a RESULT SET: the match is `title ilike …`, which is NULL without a title. So
  the untitled block the catalogue must reach is a block a search cannot reach at all.

**A CURSOR PREDICATE WITH A TOP-LEVEL `or` MUST BE PARENTHESISED, AND WHAT GOES WRONG IS NOT THE
COMPARISON.** Written as one raw `sql` template — `A or (B and C)` — and composed as
`and(within, past)`, the query builder parenthesises the PAIR it is handed and not the operands
inside it, so the predicate renders as `(within and A or (B and C))`. `and` binds tighter than `or`,
so it parses as `((within and A) or (B and C))` and **the tie branch escapes the listing's own
`WHERE` entirely**: on page two a search returned an Item it had never matched. Built with the query
builder's own `or`/`and`, which wrap their own results, it renders
`(within and (A or (B and C)))`. The catalogue's walk was safe from this only incidentally, because
it already used `or()`.

**It is a precedence bug rather than a logic one, so every walk test in the suite was blind to it.**
Set equality and no-repeats say nothing about rows that should never have been candidates, and every
fixture in this repo ties only among rows that also match. What catches it is a decoy that RANKS
level with the anchor without matching at all, and ADR-0120's own stated limit builds one by
construction: trigram matching has no notion of word order, and `pg_trgm` pads and splits per WORD,
so `Zagreus Antimony` and `Antimony Zagreus` hold the identical trigram set and rank identically
against any query. Only one of them contains it.

**THE ANCHOR'S CLOSENESS DOES NOT LEAVE THE SERVER, and the reason is exact rather than dramatic.**
`similarity()` returns a `real`. Measured against one row: `= $1::float8` is FALSE where `= $1::real`
is true, with `$1` the value read out of that same row. Carrying it out and back WOULD work today —
node-postgres sends a JavaScript number untyped and PostgreSQL infers `real` from the comparison —
so this is a choice against depending on an inference nothing at the call site states, not a repair
of a bug. It is an uncorrelated scalar subquery, so there is no type to infer and no digits to round.

**AND `total` MOVED, exactly as the code predicted it would have to.** Catalogue search counted with
`count(*) over ()`, correct only while it had no cursor, and `catalogue-search.ts` carried a comment
saying so: "THE DAY A CURSOR ARRIVES HERE, THIS LINE HAS TO MOVE WITH IT". Measured before the fix:
page two of three matches reported a match set of **2**. The walk is now ONE function for all three
listings — the order and the cursor are its parameters, and the fields, the join, the count, the cap
and the extra row that says whether to offer another page are written once.

**Catalogue search answered a shape with no `continuesAfter` field at all**, because `null` here
means "the listing ends here" and a search over a thousand matches saying so would be the silent cap
this whole record exists to refuse. It has a cursor now, so `null` means what it means everywhere
and the second shape is gone: `cataloguePublic` is what all three listings answer with. See
[[0120-catalogue-search-is-a-trigram-ilike-not-full-text-search]].

**So three of the four listings had adopted this record, and the section below is the fourth.** The
catalogue, work-browsing and Catalogue search were the three; a Container's members are the fourth,
under CNCORE-89, and the obstacle there was a governed address rather than an order.

**The cap did not move.** `A_PAGE` is still 100 and a caller still cannot ask for more. Paging makes
one answer's cost the same as it was and lets a reader ask again.

**One thing changed under the listing that is not paging.** `total` was a `count(*) over ()`, and a
window count is taken AFTER `where` — so with a cursor in the predicate it counts the Items past the
cursor, and page two would report a smaller library than page one. It is an uncorrelated scalar
subquery now, which the cursor cannot reach, in the same statement and therefore the same snapshot.
The one case it cannot cover is a page with no rows to carry it, where the size is asked for on its
own: there are no entries there for a second moment's answer to disagree with.

**It is asserted at three seams** ([[0103-tests-bite-at-package-exports-and-the-router]]), for the
listing and for Catalogue search alike: the package export, the router in-process, and — the one
CNCORE-82 names as decisive — the page over real HTTP, against a THIRD instance of the same build
serving a catalogue of 254 Items. Neither existing
instance could be it: the seeded one is read by every other file for an Item on its front page, and
several hundred Items push that Item off it; the fresh one's emptiness is its fixture
([[0094-a-fresh-install-starts-empty]]). That walk is checked against the ids the harness WROTE
rather than against a second reading of the catalogue, because a cursor that loses the untitled tail
would lose it from both sides and the two readings would agree.

**The search walk takes the same instance and the same oracle MINUS TWO IDS**, and the subtraction is
the point: a query matching every titled Item there cannot reach the two with no title at all, because
the match is `title ilike …` and that is NULL without one. So the fixture names its keyless pair now,
having deliberately not named it before — "a field naming them would be one nothing reads" was true
until a listing existed that could not reach them.

**The relevance tie is BUILT rather than hoped for**, which is this record's own rule about cutting a
page at a tie, applied to an order that ties far more often than the catalogue's. Four Items sharing
one title rank at exactly 1 and a page of one cuts between every adjacent pair; two of them carry a
sort name and two do not, so the second and third terms of the comparison are each the only thing
separating some pair. Mutation-checked: dropping the id fails it, dropping the sort key fails it and
the plain page-two test as well.

## A Container's members, decided under CNCORE-89

**THE FOURTH LISTING HAS ADOPTED THIS RECORD, and it is the first one that had to depart from its
letter.** `Members` on `/items/<id>` is capped at `A_PAGE`, says what it is not showing, and is
walked forward — and its cursor is **a PLACEMENT's id rather than an Item's**, where the sentence
that opens this record says "the cursor is the id of the last Item the page before it showed".

**A REPEAT IS WHY, AND IT IS ADR-0009'S LICENCE RATHER THAN AN EDGE CASE.** The same Item placed
twice in one Container is two rows sharing one `item_id` — `CONTEXT.md`'s Repeat, "a recap at
position 1 and the episode at position 5 ... one item, twice, on purpose". An Item id therefore
names TWO rows in this listing and cannot say which of them a page ended on: cut at one, the walk
either serves the recap again or skips the episode. The Placement is the only thing that can tell
the two arrivals apart, which is the SAME fact that already makes `?via=` a placement's id rather
than a container's ([[0066-path-is-identity-query-is-the-route]]). So the departure is this record
meeting a listing whose rows are not Items, rather than a second convention: the rule is that a
cursor names the ROW the page ended on, and in three of the four listings that row is an Item.

**THE ORDER IS `position` AND THEN THE PLACEMENT'S ID, and it has the SAME TWO REGIMES the
catalogue's does, over different columns.** A position nothing asserted is NULL and sorts last as
one block — `CONTEXT.md`'s Unplaced, which the wiki's release-order ordering produces for a sixth of
the archive's stories — so a plain row comparison loses that whole block from every page, because
`(null, x) > (k, y)` is NULL rather than true. And ADR-0009 keeps no unique constraint on
`(container_id, position)`, because a novel and the film adapting it must sit at one point without
an order being invented between them: two placements may share a position, so a cursor comparing
only the position steps over the second of them. **Both halves are mutation-checked**, each
removed in turn against a container whose page is cut AT the tie — this record's own rule about
testing a keyset walk, applied to an order that ties by design rather than by accident.

## The walk is shared, and the QUERY is not — which is the question the ticket asked

**CNCORE-89 asked for `readListing`'s walk to be reused "unless the Placement ordering makes that
impossible", and the honest answer is that half of it was and half of it could not be.** Said as
two halves because "reused" and "not reused" are both wrong on their own.

**WHAT IS SHARED IS THE PAGE, and it is now written once for all four listings.** `onePage` holds
the three rules this file has got wrong separately before: the extra row read and never returned,
which is the only thing that knows whether a listing carries on; the size taken in the SAME
statement and therefore the same snapshot, falling back to a query of its own exactly where a page
has no rows to carry it; and the cursor cut at the last row the page showed. It takes the READ
rather than the rows, so `limit + 1` is spent beside the slice that undoes it — a caller that
fetched `limit` rows and handed them over would answer `continuesAfter: null` on every page, which
this record makes mean "the listing ends here".

**WHAT IS NOT SHARED IS `walkListing` ITSELF, AND THE REASON IS THE RELATION RATHER THAN THE
ORDER.** The ticket guessed the obstacle would be the Placement ordering; it is not. That function
is a walk over `items`: it selects an Item's id, joins `item_kinds` for the reader's word, and
counts the `items` matching the question asked. A Container's members walk `placements` — rows that
carry a Placement's id, no kind at all, and a count of memberships rather than of Items. Three of
its four moving parts would have had to become parameters, leaving `and(within, past)` as the only
shared line, which is the abstraction that costs more than the copy it saves. The order is a
parameter there ALREADY and would have cost nothing.

## A kept link into a container RESUMES, which this record predicted and had no instance of

**THE TOMBSTONE SPLIT ABOVE NOW HAS ITS OTHER HALF, and it behaves exactly as that section said it
would.** The rule there is that the anchor is read WITHOUT the tombstone filter and each order
decides what it found — and that the two orders built on the projection lose their anchor's place,
because a deleted Item has neither `sort_name` nor `title` left. Its own words for the other case:
"An order this app does not yet hold — on `release_date`, or on when a row was made — reads a column
a delete does NOT destroy, so its anchor still has a place and can still be resumed from."

**`placements.position` IS THAT COLUMN.** No tombstone touches it: deleting the Item filters the row
out of the listing and leaves the placement row untouched, and tombstoning the placement leaves its
position standing too. So an anchor here keeps its place after the member it names is gone, and a
reader five pages into a Container is NOT sent back to its first page because one member went away
under them. **Asserted rather than reasoned, on BOTH tombstones** — a container walked to a cursor, then the
anchor's Item deleted in one test and the anchor's PLACEMENT deleted in another, the cursor asked
again each time — and mutation-checked by applying the catalogue's own rule here, which starts the
ordering over and fails it. The second test exists because review of CNCORE-89 found this paragraph
claiming both halves while only the first was held.

**So the split was worth having, and this is the evidence rather than the argument.** A rule written
as "a deleted anchor names no position" would have been true of the two orders that existed and
wrong here, and nothing would have been checking.

## The address, and where the cursor sits in it

**`?after=` IS THE THIRD NON-IDENTIFYING PARAMETER on `/items/<id>`, and it is written LAST of the
three.** `via`, then `placed`, then `after` — appended rather than inserted, because ADR-0066
already fixed the order of the first two and re-ordering them would give every link already emitted
a second spelling, which is the one thing a fixed order exists to prevent. The canonical is
unchanged by any of them, which is what makes every route to a Container one page.

**IT IS THE SAME WORD THE OTHER THREE LISTINGS WALK WITH.** A parameter named for this surface would
have been a second convention for one question, on the one surface where a reader can see all three
at once.

**AND THE FILTER CHIPS CARRY IT.** `placed` narrows "Also appears in" and `after` walks `Members`:
two independent listings on one page, so a chip that dropped the cursor would send a reader deep in
an ordering back to its first page for touching the other list. The order is held in one function
rather than in each of the two places that emit it.

**THE CAP IS THE ONE THE OTHER THREE SERVE, read from one place now.** `A_PAGE` moved beside the
routers rather than staying inside the catalogue's, because four listings read it and only three of
them are on that router — a Container is an Item ([[0004-containers-are-items]]) so its members hang
off `item.get`, and a copy of the number over there would have been a second ceiling nobody chose.
`item.get` takes no `limit`: a caller may not raise the cap, and nothing in the product wants to
lower it.

**Asserted at the three seams** [[0103-tests-bite-at-package-exports-and-the-router]]: the package
export, the router in process, and — the one the ticket names by hand — the page over real HTTP,
against a Container holding 254 placements on the same instance this record's catalogue walk uses.
That instance holds ONE new item for it, the container itself, because the ordering is built over
the catalogue the fixture had already written: `every` is an exact oracle two other files compare
against, so two hundred and fifty new items would have had to be added to both. The members oracle
is the PLACEMENTS the harness wrote, and the ordering carries a tie, an Unplaced tail and a Repeat
by construction — the Repeat being what says the walk is over placements, since an item-id cursor
cannot survive one item appearing twice.
