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

**THE NUMBER HAS SINCE BEEN TAKEN, AND IT LEAVES THE CHOICE ABOVE STANDING** (ADR-0137,
CNCORE-167). Measured 2026-09-15 against the Owner's install holding 8,052 Items: the plan is still
`Seq Scan on items` feeding a top-N heapsort, exactly as predicted, and the whole statement takes
**3.1 ms** — 1.6 ms of it the scan. A page deep in the walk is not slower than the first (14.9 ms at
page 61 against 17.1 ms at page 1), and the front page renders in 32.6 ms. So the index stays
unadded and the reason has changed: not "nobody has measured it" but "measured, and there is nothing
here to fix". Whoever reaches a catalogue an order of magnitude larger should re-run
`explain analyze` rather than trusting this paragraph.

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
  **SUPERSEDED 2026-09-14 by [[0133-a-listing-says-where-the-reader-is]]**, which agrees to pay the
  counting this sentence names and shows where the reader is. The bullet below — no jump to page
  seven — is NOT superseded and is the half that genuinely needs an offset.
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

**It costs THREE primary-key lookups per page, not one, and that is measured rather than reasoned.**
The comparison names the anchor's closeness three times — once for `is null`, once for `<` and once
for `=` — and PostgreSQL hoists each into its own `InitPlan`: `explain (analyze)` on the real paged
statement shows three of them, each an `Index Scan using items_pkey` on the same id, each at
`loops=1` and two shared buffer hits. Uncorrelated, so three times per PAGE rather than per row.
Folding them into one would mean joining the anchor row in as a relation, which puts a parameter on
the shared walk that only one of its three callers would ever pass — a worse trade than a third
lookup on a unique key. The number is here because this record prices the id cursor at "one indexed
primary-key lookup per page" two sections above, and a relevance-ordered walk pays that three times.

**IT SAID TWO UNTIL CNCORE-113, AND THE THIRD IS THE `is null` BRANCH THAT TICKET ADDED**,
corrected in the sentence that carries the number rather than beside it, because a number left
standing next to its correction is the one somebody quotes.

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

**AND KEEPING IT THERE COSTS A TWO-STATEMENT WINDOW, WHICH CNCORE-113 ANSWERED BY ACCEPTING THE
WINDOW RATHER THAN CLOSING IT.** Because the closeness stays on the server, a paged search reads the
anchor in one statement and ranks it in the next: an Item deleted between the two is titled for the
check and untitled for the subquery, that subquery answers NULL, a NULL on one side makes the whole
cursor predicate NULL, and the page comes back EMPTY — rendered as "These results end here" over
results still unseen. It is the silent ending CNCORE-110 closed for the listing, two statements wide
rather than at read time.

**Two shapes were weighed and the second was taken.** The first is to collapse the window by joining
the anchor row in as a relation, so there is no second statement to race; it is refused for the
reason this section already prices the fold at — it puts a parameter on the shared walk that only
one of its three callers would ever pass — and refusing it twice for one reason is what makes that
pricing a rule rather than a remark. The second is to leave the window open and read a NULL closeness as **"no
position"**, which is what the walk now does.

**What makes that safe is not that the window is narrow — it is that both sides of it answer the
same way.** An anchor with no title names no position at read time and starts the search over
(CNCORE-110, under "The cursor is an Item's id, not an encoded sort key"); an anchor that loses its
title one statement later now does
exactly the same. So nothing a reader can see depends on which side of the gap a delete lands on,
and the race is harmless rather than merely unlikely. The read-time check is kept beside it as two
MOMENTS rather than two mechanisms: it spares the walk a predicate it does not need, and neither is
the other's dead code.

**It is spelled `(subquery) IS NULL` rather than a `coalesce(…, true)` over the whole comparison,
and the difference is which NULL it forgives.** A coalesce would answer "start over" for ANY null in
the predicate, including a candidate row with no closeness of its own — which a search would then
RETURN without ever having matched it. That is the distinction the ticket named: a NULL meaning
"tied at nothing" is not a NULL meaning "the anchor is gone", and only the explicit spelling can
tell them apart. It costs the third primary-key lookup this section prices.

**Asserted rather than reasoned.** The window is REACHED in `catalogue-search.test.ts`: the test
hands `searchCatalogue` a database that wedges the delete into the gap by hooking the first
statement's own resolution, so the ordering is fixed rather than raced. Measured before the fix, on
three matching Items paged two at a time — the page came back with **no rows** and a `total` of
2.

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
own: there are no rows there for a second moment's answer to disagree with.

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

## "Also appears in", decided under CNCORE-125 -- and the SHARED COMPARISON HAD TO GROW

**THE FIFTH LISTING HAS ADOPTED THIS RECORD, AND IT IS THE LAST ONE THERE IS.** Every ordering one
Item sits in -- "Also appears in" on `/items/<id>` -- is capped at `A_PAGE`, says what it is not
showing, and is walked forward. After CNCORE-89 it was the only listing in the app that was none of
those: `findPlacementsOfItem` took no `limit` and no `after` while `item.get` awaited it on every
Item page. So this record's first sentence is now true of the app rather than of its intentions.

**Said with its limit, because the ticket asked for it plainly.** Multi-placement is the product's
central claim, but an Item in a thousand orderings is not the ordinary case a Container holding a
thousand members is: ADR-0077 measures a real imported category at 1,049 stories, and NOTHING
measures an Item's placement count. This is the rule applied for consistency rather than a page
anybody has watched fall over -- which is also why no index was added for it, on the reasoning the
top of this record already gives about indexes written against a number nobody has taken.

**SOMETHING MEASURES IT NOW, AND THE ORDINARY CASE IS NOWHERE NEAR THE CAP** (ADR-0137,
CNCORE-167). Across the whole Doctor Who corpus -- 465 Orderings holding 7,587 distinct stories --
the MOST Orderings any one Item sits in is **48**, and that Item is `Endgame (POT comic story)`.
So "Also appears in" fits inside its first page for every Item in the largest real catalogue this
product has, the cap has never been reached by anything but a hypothesis, and CNCORE-184 has the
figure it needs to choose where a Row's membership list truncates.

**THE CURSOR IS A PLACEMENT'S ID**, the same departure from this record's letter that CNCORE-89
made and for the mirror of its reason. A Repeat is one Item twice in ONE Container (ADR-0009), so
from this end a CONTAINER id names two rows and cannot say which of them a page ended on. Both
listings whose rows are placements name the row the page ended on; the rule underneath is that a
cursor names the ROW, and in three of the five listings that row is an Item.

## The comparison covered FOUR of the five listings and not this one

**THE TICKET ASKED WHETHER `pastInTwoRegimes` COVERED THIS ORDER AND SAID TO CHECK RATHER THAN
ASSUME. IT DID NOT, AND IT GREW -- INCLUDING OUT OF ITS NAME.** That function took ONE key and an
id, and is `pastTheRow` now. This order is FIVE terms:
the CONTAINER's projected key `coalesce(sort_name, title)` (ADR-0014), then ADR-0017's two deciding
which source SPEAKS -- the rank's precedence (ADR-0024) and the one global source order (ADR-0025)
-- then ADR-0018's position, then the placement's id.

**SO IT TAKES A LIST OF KEYS NOW, and is named `pastTheRow`.** One key was never the rule; it was
the number the first four listings happened to need. The rule underneath is that **the comparison
must name EVERY term the `ORDER BY` does** -- A RULE THIS RECORD STATED AND NOTHING ENFORCED, until
CNCORE-169 made it a value rather than a sentence, under "The rule became a VALUE rather than a
sentence (CNCORE-169), and ONE Listing is on it" below. A key left out
of it is rows silently stepped over
-- which is what the two paragraphs above it in this record are each an instance of, at N=1. The
nesting is built from the inside out, so each key's tie branch is the whole comparison on the keys
behind it; a flat `or` of per-key clauses is a DIFFERENT AND WRONG predicate, answering true for a
row that sorts before the anchor on an early key and after it on a late one.

**EVERY ONE OF THE FOUR KEYS IS NULLABLE, so this listing has FOUR keyless blocks where the
catalogue has one and a Container has one.** A Container nobody has named has no key at all
(ADR-0014); a placement no source stands behind is null on BOTH of ADR-0017's terms; an Unplaced one
has no position. The row this listing lists is a placement JOINED TO ITS CONTAINER, and both ends can
be silent.

**MUTATION-CHECKED TERM BY TERM, which this record's own rule about cutting a page AT a tie demands
and which an order this long makes cheap to get wrong.** Each of the five terms has ONE test that
dies when that term is dropped from the comparison, against a pair tied on every other term, and
each of the two regimes has its own: removing the `isNull(key)` disjunct kills the three
keyless-block tests, and treating a keyless ANCHOR as a keyed one kills two more.

**THE IDS ARE NAMED RATHER THAN MINTED IN THOSE TESTS, and that is what makes them assert rather
than hope.** The last term is the placement's id, so a comparison that drops a key falls through to
one -- and whether that loses a row is then decided by whichever uuids `gen_random_uuid` handed out.
This record already records that flakiness on the catalogue's own walk ("passed on one run and
failed on the next"). Each pair is written with the id order OPPOSITE to the key under test, so
dropping that key loses a row every time instead of half the time. `aPlacement` takes an `id` for
this, exactly as `SeededItem` already did one table over.

**AND ONE SHAPE THIS ORDER CANNOT HOLD, found by trying to build it**: migration 1 keeps a unique
constraint on `(owner_id, container_id, item_id, position)`, so one Item cannot sit twice in ONE
Container at ONE point. ADR-0009's "no unique constraint on (container_id, position)" is about two
DIFFERENT Items sharing a position and does not license this. So a tie on all four keys has to be
TWO CONTAINERS SHARING A NAME, and that is what the test for the id term is built from.

## The tombstone split meets the first order with BOTH KINDS OF TERM IN IT

**THIS IS WHERE THAT SPLIT PAYS FOR ITSELF A SECOND TIME, and differently.** The rule above is that
the anchor is read WITHOUT the tombstone filter and each order decides what it found: an order on
ADR-0014's projection loses its anchor's place to a delete, because the projection over no live
statements is NULL and the columns are GONE rather than hidden; an order on a stored column a delete
does not touch keeps it, which is why a kept link into a Container RESUMES.

**This order is BOTH.** It LEADS on the projection -- of the CONTAINER, which is another row
entirely -- and continues on three stored columns that no tombstone touches. And **a place that has
lost its FIRST term has lost the whole place**: the survivors behind it cannot rescue it, because
resuming from `(null, precedence, ...)` resumes from the unnamed-Container block with every named
one between SKIPPED, which is exactly the dead end CNCORE-110 measured on `/`. So a kept link whose
ordering has since been deleted starts this listing over, and one whose own PLACEMENT was removed
resumes past it. Both are asserted, and the guard is mutation-checked.

**AND IT IS THE PAIR RATHER THAN THE TOMBSTONE ALONE, for the reason `findInTheOrder` gives one
listing over.** A Container nobody NAMED has no key either and sits at the end of the order as one
block, resumed from by the three keys behind it. `deletedAt` alone would refuse an anchor whose key
a delete had left alone; a null key alone would refuse the unnamed Container. There is a test for
each.

**So the split's own words -- "an order this app does not yet hold ... reads a column a delete does
NOT destroy" -- were right and INCOMPLETE.** They imagined an order made entirely of one kind of
term. A MIXED order takes the answer of whichever term LEADS, and nothing was checking that until
there was one.

## The address, and the second cursor on it

**`?placedAfter=` IS THE FOURTH NON-IDENTIFYING PARAMETER on `/items/<id>`, written LAST of the
four**: `via`, `placed`, `after`, `placedAfter`, each appended behind the ones already emitted
(ADR-0066). The canonical is unchanged by it.

**IT IS NOT A SECOND `after`, AND THIS RECORD'S OWN ARGUMENT IS WHY IT COULD NOT BE.** ADR-0066
argues the bare word for the Members cursor precisely because it is "the same word the other three
listings walk with", and a parameter named for one surface would be a second convention for one
question. That argument holds right up until ONE PAGE HAS TO SPELL BOTH AT ONCE -- which is what a
Container being an Item (ADR-0004) produces, and what this ticket arrived at. One of the two has to
be qualified or neither can be read.

**THE BARE WORD STAYS WITH THE LISTING THAT HAS ALREADY EMITTED LINKS.** Re-spelling the Members
cursor would give every link CNCORE-89 put into the world a second spelling of itself, which is the
one thing a fixed order exists to prevent. The parameter arriving later is the one that takes a name.

**AND IT IS NAMED FOR ITS PAIR RATHER THAN FOR ITS SURFACE.** `?placed=` already narrows this same
listing, so `placed` and `placedAfter` read as the one listing's pair. `appearsAfter` was the other
candidate and it names the heading instead -- true, and it says nothing about the parameter sitting
beside it in the same URL.

**THE TWO CURSORS MUST NOT MOVE EACH OTHER**, which is what the name buys: each walk carries the
OTHER listing's cursor through and sets only its own, so a reader deep in one list is not sent back
to the first page of the other for walking a list that has nothing to do with it.

**AND IT WAS BUILT IN ONE DIRECTION ONLY, WHICH REVIEW OF CNCORE-125 CAUGHT WHILE THIS PARAGRAPH
ALREADY CLAIMED BOTH.** "Also appears in" carried `after` through; the Members walk dropped
`placedAfter`, so walking Members silently reset the other list to its first page. Both directions
are held by a test now, one on each listing.

**THE MECHANISM THAT LET IT HAPPEN IS WORTH MORE THAN THE BUG.** The query was built as
`{ ...asked, [cursor]: at }`, and a SPREAD APPENDS a key that was not already there. That is correct
while every parameter behind the cursor is absent and wrong the moment one is not -- walking Members
on an address already carrying `?placedAfter=` would have put `after` BEHIND it, which is a second
spelling of one address and the exact thing a fixed order exists to prevent. So the order is read off
a LIST of the four names now rather than off the order keys happen to be written in, and the same
function serves `Next` and `Back to the start`: the cursor it owns is set for one and DROPPED for the
other, which is what makes a start a start without dropping the other listing's.

**AND THE FILTER CHIPS CARRY ONE AND DROP THE OTHER, which is not an asymmetry to tidy away.** A
chip carries `after` forward because it has nothing to do with the Members listing and must not move
it. A chip DROPS `placedAfter` because it changes what "Also appears in" is ASKING -- the answer is a
different listing, and the old cursor names a place in the one the reader is leaving.

## A narrowing is part of the QUESTION, not a filter over the answer (CNCORE-129)

**`?placed=` RAN OVER THE ROWS THE PAGE HAD BEEN HANDED, and so did the chips offered beside it.**
While this listing was uncapped that was exactly right: "the rows the page was handed" and "every
ordering the Item sits in" were the same set. **Capping it is what created the gap**, and a
narrowing that silently looked at only the first hundred was this record's own silent cap arriving
through the filter instead of through the listing. CNCORE-125 SAID SO AND CNCORE-129 FIXED IT: for
one ticket the notice under a narrowed list counted against the PAGE -- "Showing 12 of the 100
orderings on this page" -- so the surface never claimed more than it had looked at.

**THE NARROWING IS A TERM OF THE QUERY NOW, so a narrowed "Also appears in" is a LISTING**: its own
size, its own cap, its own walk. `item.get` takes `placed` beside its two cursors, and the walk
carries it on every page -- an origin with three hundred orderings in it is walked to the end of
itself rather than cut off at the cap of the list it was cut out of.

**AND THE NOTICE CNCORE-125 ADDED IS GONE, WHICH IS THE HALF THAT IS EASY TO LEAVE STANDING.** It
described a limit that had stopped holding the moment the query learned the narrowing, and a caveat
outliving its cause is worse than none: it teaches a reader to distrust a count that is now exact.

**THE COUNT'S LATERAL COMES AND GOES WITH THE NARROWING.** The origin a row carries is the kind of
the source that SPEAKS for it, which is an output of the join that picks the spokesman -- so the
count subquery beside the rows, which deliberately had none, grows one when and only when it is
counting a narrowing. MEASURED FOR THIS JOIN under CNCORE-129, on one Item in 1,000 orderings with
two sources each over three runs on PostgreSQL 18.6: 2.7-3.4 ms narrowed against 0.24-0.28 ms
unnarrowed, the planner using `Index Scan using placement_sources_placement_source`. Unnarrowed the
count still pays nothing it did not pay before.

**ONE PREDICATE SERVES THE ENTRIES AND THE COUNT, and what makes that possible is worth writing
down: a fragment naming `spokesman.kind` resolves in WHICHEVER SCOPE IT IS SPLICED INTO.** The walk
binds it to its own lateral and the count subquery to the one inside itself, because SQL resolves a
name in the innermost scope that has one. So the two cannot disagree about what was narrowed -- the
hazard `queries.ts` already carries a paragraph about, met with one fragment rather than two.

**THE EMITTED COUNT, READ OFF THE BUILDER RATHER THAN ASSUMED**, because scope resolution is exactly
the kind of claim that reads as true and compiles either way:

```sql
select count(*) from "placements"
  inner join "items" on "items"."id" = "placements"."container_id"
  left join lateral (
    select "sources"."kind", "ranks"."precedence", "sources"."source_order"
    from "placement_sources"
      inner join "sources" on "sources"."id" = "placement_sources"."source_id"
      inner join "ranks" on "ranks"."rank" = "placement_sources"."rank"
    where ("placement_sources"."placement_id" = "placements"."id"
      and "placement_sources"."deleted_at" is null)
    order by "ranks"."precedence", "sources"."source_order", "placement_sources"."id"
    limit $1
  ) "spokesman" on true
where (("placements"."item_id" = $2 and "placements"."deleted_at" is null
  and "items"."deleted_at" is null) and "spokesman"."kind" = $3)
```

Its `placements` and `items` are its own, its lateral correlates to its own `placements.id`, and
`$3` is a BOUND PARAMETER: the origin arrives from a URL and never reaches the statement as text.
Nothing in it is correlated to the walk outside, which is what keeps the cursor out of the count --
the property this record already required of it before there was a narrowing to keep out too.

**A SECOND READ IS WHAT THE CHIPS COST, and it is the part that is easy to miss.** Which origins an
Item has placements from cannot be derived from the rows a narrowing answered: a narrowed page holds
the one origin it was cut to, so the chips would collapse to the choice the reader had already made
and the way back to All would be to edit the address by hand. It is a field of its own on the
listing -- `everyPlacedBy`, named there because [[0045-the-public-read-path-names-every-field]]
admits no other way -- and it is the one fact in that shape the narrowing does not touch.

**IT IS NAMED FOR `CONTEXT.md`'s Placed by AND NOT FOR "ORIGIN"**, which review of CNCORE-129 caught
after the field had shipped under the second name. "Origin" is the prose word the records and the
ticket use for one Placed-by value, and it has no entry -- and ADR-0066 and the glossary already use
it for a WEB origin, so a public field named for it would have been a third sense of one word.

**AND IT RUNS ON EVERY ITEM PAGE, NARROWED OR NOT**, because the chips render either way: the
spokesman's lateral over every Placement of the Item rather than over a capped page of them.
MEASURED on the same 1,000 orderings: 2.7-2.8 ms. Nothing yet measures an Item in that many
orderings, so it is a ceiling a real catalogue has not reached rather than a price anybody pays.

**IT IS TWO STATEMENTS RATHER THAN ONE, which is the opposite of the rule about the count**, and the
asymmetry is argued rather than overlooked. A count in a second statement can disagree with the rows
it is printed beside; an origin whose last placement goes between the two reads is offered as a chip
that answers nothing, and what the reader meets is "Nothing placed that way" -- the ordinary answer
for an origin with no rows. Folding it in would cost the spokesman's lateral over every row of the
count to remove a state indistinguishable from the truthful one.

**AND THE SECTION IS NO LONGER GATED ON `total`, WHICH IS THE THING IMPLEMENTATION TAUGHT.** That
number is the NARROWED listing's size now, so it is zero for an origin the Item has nothing from --
over a list with plenty in it. A section that vanished there would take the chips with it, which is
the dead end this whole ticket is about. It renders when the Item has orderings OR origins.

**THE ONE ITEM BOTH MISS IS STRANDED, AND IS LEFT, which is said rather than dressed up.** An Item
whose every ordering is a Placement no source stands behind, narrowed by hand, has neither -- so the
section vanishes where the address without `?placed=` would show it. An earlier draft of this
paragraph claimed that reader got "the page they would have got by not narrowing", and review of
CNCORE-129 found it false. It is left because the app cannot make that Item: `assertPlacement`
writes a source with every Placement, a withdrawal tombstones the Placement its last source leaves
([[0075-every-table-carries-a-change-sequence]]), and a purge deletes the ones it orphans. The
obvious fix, rendering whenever `?placed=` is present, gives an Item in NO ordering a section on any
address with a `placed` typed onto it -- a non-identifying parameter changing a page when it names
nothing, which [[0066-path-is-identity-query-is-the-route]] refuses. Telling the two apart needs the
unnarrowed size as a second field, for an Item nothing can produce.

**THE EMPTY PAGE SPLITS CLEANLY FOR THE SAME REASON.** No rows with a total behind them is the end
of a walk; no rows and no total is an origin with nothing in it. Those were one state while `total`
described the whole listing, and the page had to ask whether the cap had bitten to tell them apart.

## Asserted at the three seams

[[0103-tests-bite-at-package-exports-and-the-router]]: the package export, the router in process,
and -- the one the ticket names by hand -- the page over real HTTP, against an Item sitting in 211
placements across 210 CONTAINERS on the same instance the other four walks use -- 211 orderings by
`CONTEXT.md`'s word, which counts the placement rather than the container, because the fixture's
Repeat puts the Item in one of them twice. The page's count says 211 for that reason.

**THAT FIXTURE COSTS ITS OWN ITEMS WHERE CNCORE-89'S COST ONE, and the asymmetry is forced rather
than careless.** A Container's members are ORDINARY ITEMS, so that fixture could hold the catalogue
the harness had already written. This one needs a hundred and more CONTAINERS, and a catalogue of
plain stories holds none -- so its orderings are minted and counted into `pagedCatalogue`, which is
what keeps the front page's set oracle exact. Its two unnamed orderings are counted into
`pagedUntitled` for the same reason one listing over: they are untitled Items on that instance, and
Catalogue search cannot reach an untitled row whatever wrote it.

**THE PAGE'S ORACLE IS THE CONTAINERS AND NOT THE PLACEMENTS, which is ADR-0066 operating rather
than a shortcoming.** These rows link to the Container itself and deliberately carry no `?via=` --
a reader following one is arriving AT the Container, not at this Item through an ordering -- so
there is no placement id in the markup to collect, where the Members list has one in every row. What
keeps it exact is comparing MULTISETS: the fixture's Repeat puts one Container in the list twice,
and a set comparison would forgive losing one of them.

**THAT FIXTURE HAS TWO ORIGINS SINCE CNCORE-129, and the second is ONE ordering sitting past the
first page.** Every other is the Owner's own hand, so the two criteria a narrowing has are
observable at all: chips read off the rows a page carries would not offer that origin, and a
narrowing applied to those rows would answer nothing where the listing holds a row. It is the last
ordering anybody asserted rather than an index picked by hand, which would be right for one fixture
size and wrong for the next.

**AND THE ROUTER SEAM MINTS ONE OF IT FOR THE WHOLE BLOCK, which is a cost this ticket paid to
learn.** That suite shares ONE catalogue and each of these fixtures puts a hundred and twenty
Containers in it, so a fixture per test pushed the item the FRONT PAGE's own test asserts off the
first page of a capped listing -- a test in another file, failing on a fixture it has never heard
of. Read and never written to, one fixture serves every question the block asks.

**AND THE END OF THE WALK IS NAMED BY THE FIXTURE for the same reason.** The last row's id cannot be
read off the page that shows it, so the fixture says which placement sorts last and why it does:
the last ordering minted is one of the two nobody named, and its placement is the one no source
stands behind, so it is null on the leading key and on both rank terms and nothing is behind it on
any term. Mutation-checked by aiming that test at a row that is NOT last, which fails it.

## The rule became a VALUE rather than a sentence (CNCORE-169), and every Listing is on it (CNCORE-170)

**ALL FIVE LISTINGS ARE ON IT SINCE CNCORE-170, AND ONE THING IS STILL NOT IN IT.** Every Listing
derives its `ORDER BY` and its cursor comparison from one value, which is what the top of this
section claims and what was a sentence for three Listings until then. What is NOT in the value is
the TOMBSTONE SPLIT ON A PROJECTED KEY: the reads still apply that by hand, and the paragraph on it
below says why and what it would cost to move. This record's `accepted` stays scoped to the walk,
which is whole.

**THIS RECORD STATED "the comparison must name EVERY term the `ORDER BY` does" AND NOTHING
ENFORCED IT.** The order and the comparison were two independent statements that a paragraph
required to agree, in two files, and the four defects above are what came of that: the relevance
order whose comparison skipped the sort key between closeness and the id (CNCORE-88), and the
four-key order handed to a comparison built for one (CNCORE-125). Two more are the same failure at
the anchor rather than in the comparison -- a VALUE missing for a term rather than a term missing
from the predicate: the deleted anchor read as an untitled one (CNCORE-110) and the closeness that
went NULL between two statements (CNCORE-113).

**SO AN ORDER IS ONE VALUE NOW, IN `packages/db/src/order.ts`, AND THREE THINGS ARE READ OFF IT.**
It names its keys once, most significant first, with the id behind them. `theOrderBy` renders the
`ORDER BY`; `pastTheRowIn` renders the comparison; `PlaceIn<typeof order>` is the shape an anchor
has to carry for it. A key added to an order reaches all three in the same edit, and a place that
does not carry one is a TYPE ERROR rather than rows silently stepped over.

**`Order` RATHER THAN `Ordering`, AND THE GLOSSARY IS WHY.** `CONTEXT.md` gives Ordering to the
Placement construct -- what a container keeps of its own members -- and
`apps/web/src/components/ordering.ts` already uses the word that way. A second sense of it here is
what this repository refuses for `duplicate` and `record`. "The order" is what these files had
always called this in prose (`pastInTheOrder`, `findInTheOrder`, `PlaceInTheOrder`), and
`CONTEXT.md` now carries the entry.

**CNCORE-169 BUILT IT AND MOVED THE CATALOGUE LISTING ONTO IT** -- both of ADR-0077's questions,
since they share one order and differ only in their `WHERE`. The other three still wrote their terms
out beside their `ORDER BY`, and they were not all in the same state either: a Container's members
and "Also appears in" called `pastTheRow`, the same comparison one layer down, while **CATALOGUE
SEARCH CALLED NEITHER** -- `pastInTheRanking` hand-built its own predicate, ending in the tuple row
comparison this record says cannot express both regimes, which it got away with only because no
untitled row can match an `ilike`.

**CNCORE-170 MOVED THE OTHER THREE, AND TWO OF THEM COST THE INTERFACE SOMETHING.** That was the
point of doing them second rather than together: an abstraction that fits only the naive shape costs
what it saves, so the two Listings that do not fit are what the interface had to be made to carry.
A KEY NOW SAYS THREE THINGS instead of being an expression alone.

- **WHICH WAY THE LISTING READS IT.** Catalogue search leads on `similarity(...) desc` and every
  other key in the app is ascending. `theOrderBy` renders `desc` and `pastTheRowIn` compares with
  `<` off the same flag, so the two cannot disagree about which end of the ranking a page starts
  from. This is the direction the paragraph above deliberately did not build ahead of its reader.
- **WHETHER THE LISTING HOLDS ROWS WITH NO VALUE FOR IT.** Every row Catalogue search lists matched
  `title ilike ...`, so it has a title, so it has a closeness and a sort key: that order has no
  keyless block, where the catalogue's untitled tail is a real one. This was the COMMENT justifying
  the tuple comparison and is a declaration the shared one reads. **IT IS NOT TIDINESS AND THE PRICE
  WAS MEASURED**: a keyless branch is `key IS NULL`, which on a COMPUTED key is the whole expression
  evaluated again per row, and PostgreSQL does not fold it away. On the 18.6 `compose.yaml` pins, an
  11,000-row catalogue with a trigram index, a page of 101 over 10,500 matches, five interleaved
  `explain (analyze)` runs per shape: 35.7-41.8 ms declared, against 34.7-48.3 ms for the
  hand-written predicate it replaces and 50.1-64.1 ms undeclared. The branch that can never be true
  was the most expensive thing in the statement.
- **AND A PLACE MAY CARRY AN EXPRESSION RATHER THAN A VALUE.** Catalogue search's closeness is a
  function of the QUERY the request resupplies rather than a column of the anchor row, so it is
  computed in the walk's own statement and is deliberately not carried out through the driver and
  back -- what a `real` compares equal to depends on its inferred type, and relevance ties are the
  common case. A computed value that is NULL means what a read answering `undefined` means: the
  anchor has no place, so the walk starts the listing over. **THE TOMBSTONE SPLIT IS ONE RULE AT TWO
  MOMENTS**, which is what CNCORE-113 found the hard way, and the interface carries the SECOND
  moment -- the one no read can reach, because the value does not exist until the walk runs.

**SO THE COMPARISON HAS ONE IMPLEMENTATION, AND `pastTheRow` IS GONE.** It took a LIST of terms a
caller wrote out, which is two lists read by one index and therefore two lists that can come apart.
`pastTheRowIn` is the whole of it. `walkListing` went the same way in the same ticket: it took an
`ORDER BY` and a cursor as separate parameters, so the pairing this mechanism abolishes was still
expressible one function further out than the listings it had been removed from. It takes the order
and the anchor's place in it, typed against each other.

**WHAT DID NOT MOVE, AND CNCORE-170 ASKED FOR ONE OF IT.** That ticket's second criterion names two
shapes the interface had to carry, and the closeness is carried; **THE TOMBSTONE SPLIT ON A PROJECTED
KEY IS NOT.** A key a delete DESTROYS still cannot say so. `findInThisItemsOrder` hand-writes
`if (containerKey === null && containerDeletedAt !== null) return undefined`, and `findInTheOrder`
hand-writes the same shape for the catalogue's sort key; both read the tombstone BESIDE the order's
keys rather than through them.

**IT IS NOT BUILT BECAUSE EVERY WAY OF BUILDING IT MEASURED WORSE THAN THE RULE IT REPLACES, and
that is a finding rather than an excuse.** Declaring the tombstone as an EXPRESSION needs a second
helper to put it in the select, and it then reaches only two of the four anchor reads: the Catalogue
Listing's and Catalogue search's both go through `findTheAnchor`, whose select shape this record
deliberately fixed and shares so that the shape guard and the tombstone exception are not spelled
twice. Two of four deriving and two not is worse than four writing one clear line. Declaring it as
the NAME of a field in the read reaches all four -- but couples an order to a string naming a select
field, which is two places that can come apart silently, and that is the exact hazard this module
exists to abolish. **SO THE HONEST STATE IS: the keys are read THROUGH the order and the split is
applied BESIDE it**, and moving it needs `findTheAnchor` reopened, which is a decision of this
record's own and is a ticket rather than a paragraph (CNCORE-195).

**AND THE REST OF THE ANCHOR READ DID NOT MOVE EITHER.** The catalogue's place is checked against its
order by the TYPE rather than read through it; a Container's members and "Also appears in" do read
theirs through the order (`select({ ...order.keys, id: order.id })`), so a key added to either
reaches its read as well.

**ASSERTED AT THE PACKAGE EXPORT, BY TESTS THAT ALREADY EXISTED -- CNCORE-170 ADDED NONE, and that
is a claim about coverage that has to be earned rather than asserted.** It moved three Listings onto
a value while requiring each to answer exactly what it answered before, so there was no new
behaviour to assert; what it owed instead was evidence that the standing tests reach the moved code.
That evidence is MUTATION: dropping the position key from a Container's order fails five of its
export tests, dropping the rank from "Also appears in" fails two and its leading container key fails
three, dropping the direction from the ranking fails exactly one, and dropping the computed anchor's
`is null` fails exactly one -- CNCORE-113's own test, reproduced. Each was run and read rather than
predicted.

**ONE DECLARATION HAS NO SUCH EVIDENCE AND CANNOT.** `everyRowHasIt` deletes a branch rather than
changing an answer, so a wrong one skips rows silently and NO TEST AT ANY SEAM GOES RED. What holds
it up is the Listing's own `WHERE` -- Catalogue search matches on `title ilike ...`, so no row it
lists is without a title -- and that is a sentence to check by reading, not by running. Said here
because it is the strongest argument against the declaration and the next reviewer should not have
to find it.

**NO NEW SEAM AND NO NEW MODULE TEST**, which is what CNCORE-159 asks for.

**AND ONE THING STILL BITES AT THE MODULE, FOR THE REASON IT ALWAYS DID.** Walking an order WITH A
KEY ADDED, in `packages/db/src/order.test.ts`, which IMPORTS THE MODULE DIRECTLY AND IS THEREFORE
NOT ONE OF ADR-0103's THREE SEAMS -- said plainly rather than dressed up as one. The reason is that
the Catalogue's order has the two terms it has always had, and adding one to it would change what
the Catalogue answers, which CNCORE-169's own criteria forbid; so an order with a key added is a
thing no Listing has and no package export can be asked for. That is still true after CNCORE-170:
the three orders it moved each answer exactly what they answered before, so none of them gained a
key either. Precedent for reaching a module directly is `edtf.test.ts`, `validation.test.ts` and
`titleMatches` in `catalogue-search.test.ts`. The Catalogue's own half is asserted where it always
was, at the package export in `catalogue.test.ts`. Four items tie on a leading key with
their ids running OPPOSITE to the key behind it, exactly as the CNCORE-125 tests are built and for
the same reason. Mutation-checked: dropping the last key from the derivation walks that fixture to
ONE of the four, which is CNCORE-88's own measurement reproduced.

## The guarantees are ONE BLOCK over every Listing procedure (CNCORE-171)

**THIS RECORD'S GUARANTEES WERE ASSERTED PER LISTING, AND THE SECOND LISTING ADDED TO THE SHAPE
INHERITED NONE OF THEM.** `catalogue.list` carried five cases at the router seam; Catalogue search
carried two of the same ones in different wording; **work-browsing carried none** — one test, that a
Person is excluded. Every one of the three is the same cap, the same cursor and the same
`continuesAfter`, so what was being re-asserted was never the Listing's own question. It is one
block now, in `packages/api/src/routers/listing.test.ts`, run over a LIST of Listings: it refuses a
page above the cap, it walks without repeating or skipping a Row, it reports one size from both
pages, a cursor naming nothing starts at the beginning, and ADR-0045's enumeration holds of what its
Rows emit. Adding a Listing is adding a line to that list, and each procedure keeps the test of its
own question and nothing more.

**THE FIFTH IS ADR-0045'S AND CNCORE-171 NAMES FOUR.** It moved off `catalogue.list` because it is a
fact about what a Listing's Row IS rather than about the question any one procedure asks, and
leaving it on one procedure is the same shape as the walk, one assertion smaller. **What it guards
at THIS seam is the declaration rather than the mapping, measured rather than assumed**: a field
added to `asRow` alone is stripped by `.output(cataloguePublic)` and the block stays green, where a
field added to `catalogueRowPublic` reaches the reader and fails all three.

**THREE LISTINGS AND NOT FIVE, AND THE TWO THAT ARE OUT ARE OUT BECAUSE THE CAP IS NOT A PARAMETER
THEY HAVE.** A Container's members and "Also appears in" ride on `item.get` for the reason the
sections above give — a Container IS an Item and its page is the Item page — so the handler serves
`A_PAGE` and a caller cannot ask for anything else. The cap is a question they cannot be asked at
all, and the walk and the size would each cost a fixture of more than a hundred Placements, because
there is no smaller page to ask for.

**THE CURSOR IS THE EXCEPTION AND AN EARLIER DRAFT OF THIS PARAGRAPH GLOSSED IT, claiming all three
of the rest were equally unaskable.** They are not: `after` and `placedAfter` are plain optional
strings on `item.get`, so "a cursor naming nothing starts at the beginning" could be put to those
two here for nothing. They stay out anyway, because a member that can answer one question of five is
not a member of ONE BLOCK — and the honest price of that is a gap rather than none.

**AND THE GAP IS REAL AT BOTH SEAMS, checked rather than assumed.** At the package export a
Container's members is asked all four. **"Also appears in" is asked three**: every `after` it is ever
handed names a real Placement or one a delete has since taken, so neither a malformed id nor a
well-formed one nobody minted has ever been put to it. Neither Listing is asked it at the router
seam either — `item.test.ts` walks both with real cursors and hands neither a bad one. The guard
looks to be in place — `findInThisItemsOrder` reaches `canBeAnId` like every other anchor read — so
it is a missing assertion rather than a known defect, which is the shape this whole section is
about. CNCORE-198 carries both halves.

**AND A CONTRACT TEST IS ONLY AS GOOD AS THE SHAPES ITS LISTING HOLDS — found by running one
mutation twice and getting two answers.** The first version of the walk seeded a run of five
distinctly-titled stories and asserted the walk arrived at exactly `total` distinct Rows. Declaring
the catalogue's sort key `everyRowHasIt` deletes the `isNull(key)` arm that reaches the Rows with no
sort key — the failure two sections above call permanent and silent — and **one command run twice
answered RED and then GREEN.** The first run failed at 466 Rows of a `total` of 491; the second,
identical, passed. The first reading of this attributed it to the invocation, one file against the
package; that was wrong, and what actually decides it is worse.

**VITEST'S FILE ORDER DECIDES IT, AND THAT ORDER IS A CACHE.** Read in `BaseSequencer.sort`
(vitest 5.0.0, 2026-09-14): a file that FAILED last run is promoted to FIRST, then files run
longest-first, and file size decides only where there are no cached stats at all. This suite shares
ONE catalogue, so a Listing whose fixture is whatever earlier files left behind holds different Rows
depending on where that cache put it — **and a file that has just gone red is moved to the front,
where nothing has run yet and the catalogue holds only its own Rows.** A test that loses its fixture
by failing is the worst arrangement there is: the run that would show you the failure is the run
that no longer can.

**THE MUTANT DID NOT SURVIVE BY BEING SUBTLE. IT SURVIVED BY BREAKING THE TEST THAT CAUGHT IT** —
the red run is what promoted the file, and the promotion is what took its fixture away.

**SO THE FIXTURE BELONGS TO THE CONTRACT.** It seeds the keyless pair itself, and the mutant is then
red in either position: 7 Rows of a `total` of 9 and 14 of 18 with the file first — work-browsing is
four short because it lists the catalogue block's pair as well as its own — and 466 of 493 and 471
of 494 with the file late, the ranking correctly untouched throughout. This is this record's own "the FIGURE moves with the invocation while the SHAPE does not"
with the SHAPE moving too. `aCatalogueLargerThanOnePage` already says the general form one package
over ("a walk over a few hundred distinct titles passes against a cursor that ... cannot cross into
the untitled tail"); what is new is that a shared database is not a fixture at all, because what it
holds is another file's business under an ordering rule nobody here wrote.

**THE ORACLE IS THE LISTING'S OWN `total`, which is not the walk marking its own work.** That count
is a scalar subquery over the same predicate in a different clause of a different statement, so
"arrives at exactly that many DISTINCT Rows" is the two halves agreeing — and it says repeats and
skips in one assertion, since a walk that repeats overruns the count and one that skips falls short.
The Rows the fixture seeded are asserted present beside it, which is what keeps a `total` of zero
from satisfying everything.

**THE PAGE SIZE IS DERIVED FROM THE LISTING'S SIZE rather than written down**, because these three
differ in size by two orders of magnitude and one number serves neither end: a small one is a
hundred requests over the shared catalogue, and a large one is a single page over Catalogue search's
five Rows, where a walk that never crosses a boundary asserts nothing about walking. Cut into four,
every Listing crosses several boundaries and none crosses many.

**WHAT THE BLOCK DOES NOT ASSERT, said plainly rather than left to be discovered.**

- **The boundary is not AIMED at a tie for the two Listings that run over the whole catalogue.** The
  tied pair is seeded, but the page size is a function of a shared catalogue's size, so where the cut
  falls is not the test's to choose — and this record's own rule is that such a test must cut the
  page AT the tie. That is asserted at the package export, where the fixture and the page size are
  both the test's own. Catalogue search's fixture ties on EVERY Row, so the id behind the keys is
  mutation-checked through a boundary here as well: dropping it fails all three walks.
- **A DELETED anchor is not among the four.** "A cursor naming nothing" here is an id that named no
  row and a string that is not an id; the anchor whose place a delete destroyed (CNCORE-110) needs a
  cursor cut at a row the test chose, and at this seam the only row a cursor can be cut at cheaply is
  whichever sorts first in a catalogue every other file is reading. It is asserted at the package
  export for all three Listings, each in its own order, which is where the two ways a key can be null
  are separable anyway.

**MUTATIONS RUN AND READ RATHER THAN PREDICTED.** The cap removed from `listingInput` fails all
three; `continuesAfter` naming the page's FIRST Row rather than its last fails all three walks; the
id dropped from `pastTheRowIn` fails all three; the catalogue's sort key declared `everyRowHasIt`
fails the two catalogue-ordered walks and leaves the ranking alone; `total` as a `count(*) over ()`
fails all three size assertions **and no walk**, because the walk reads the size off page one where
a window count is still right; the anchor's shape guard removed fails all three cursor assertions.
**One was run and does NOT bite**: dropping the sort key from the ranking, between the closeness and
the id, loses no Row — `(closeness desc, id)` is still total, and CNCORE-88's failure was the
ORDER BY and the comparison disagreeing rather than the term being absent from both.
