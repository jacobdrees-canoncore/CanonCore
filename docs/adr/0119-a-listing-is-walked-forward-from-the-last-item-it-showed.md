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
an error.

**IT DOES NOT ACTUALLY SURVIVE A DELETE, AND THIS PARAGRAPH SAID IT DID.** The sentence removed from
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
resumes from the untitled tail with everything between skipped. Reading it without the tombstone
filter is still right; what is missing is an answer for an anchor that no longer has a place.
**CNCORE-110 carries it**, and Catalogue search below has already had to answer the same fact the
only way its order allows: an anchor with no title has no closeness to anything, so it names no
position and the walk starts over — every result still reachable, none skipped.

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

**AND CNCORE-67 INTRODUCED A THIRD LISTING THAT HAS NOT ADOPTED IT, which is said here because an
earlier draft of this paragraph did not say it.** A Container's own member list — `Members` on
`/items/<id>` — is a listing by this record's first sentence, and it has no cap, no cursor and no
count. `browse` imports a whole category in one call and ADR-0077 measures one at 1,049 stories, so
that is a thousand rows on an ordinary page rather than a corner case. CNCORE-89 carries it, and the
reason it was not done in the same pass is specific: the other two listings ARE their surface, so
the cursor is the whole query, where an Item page's address already carries `?via=` and `?placed=`
(ADR-0066) and a third parameter has to compose with both without moving the canonical. That is a
decision about a governed address rather than a parameter to add.

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
most of what a search is for. So: **recompute**, at one extra primary-key lookup per page.

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

**So three of the four listings have adopted this record.** The catalogue, work-browsing and
Catalogue search have. A Container's members have not, and CNCORE-89 is where they will — the
obstacle there is a governed address rather than an order.

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
