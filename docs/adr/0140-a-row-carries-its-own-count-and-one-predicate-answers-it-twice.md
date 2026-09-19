---
status: accepted
---

# A Row carries its own count, and one predicate answers it twice

> **ACCEPTED 2026-09-19, whole, in one repository.** Both halves landed under CNCORE-183: a Row of
> the catalogue says how much it holds, and the figure reads the predicate the container's own
> Members listing reads its `total` off. No Provider repository is touched, so there is no
> cross-repo pair here and nothing waiting on a second ticket.

A Row of a Listing may carry a count of ANOTHER Listing — how much the thing on that line holds. It
is taken as a **correlated scalar subquery on the Listing's own statement**, so it arrives in the
Row's snapshot rather than from a second read, and it reads the **same predicate** the counted
Listing reads, so the two surfaces cannot report different sizes for one Ordering.

## What made the question worth asking

`is_container` puts the word "Container" on a Row and can say nothing about how big one is, so an
Ordering and a story sat on the catalogue as peers. At the size this product is designed against
that is not a cosmetic gap: [[0137-the-corpus-is-8052-items-and-that-is-the-size-the-surfaces-are-designed-against]]
measured 465 Orderings among 8,052 Items, so a reader scanning the catalogue meets one every
seventeen Rows and cannot tell a container from its contents without opening it.

## This is not the count [[0133-a-listing-says-where-the-reader-is]] priced

That record bought a **second count beside a count** and said what it cost: the `total` every
Listing already computes, and the rank that says which hundred is on screen. Both are counts OF THE
LISTING — one predicate, asked twice, once per page.

**This is a count PER ROW, of a different Listing entirely**, and nothing had priced it. It is
the shape that record's cost paragraph does not cover and its escape clause does: *"If the label
ever costs more than the page it sits on, the honest move is to drop the label, not the walk."*
Reaching for that clause needs a measurement, so one was taken rather than reasoned about.

## What it costs, measured against the corpus rather than a seed

Measured **2026-09-19** against the Owner's own install — the corpus ADR-0137 records, re-counted
the same day at 8,052 Items, 30,896 Placements, 465 Orderings and 2,907 in the largest. PostgreSQL
**18.6**, which is what `compose.yaml`'s `postgres:18` had resolved to there; the file pins the LINE
rather than the patch, so a later install measures a later one. `EXPLAIN (ANALYZE, BUFFERS)` on one
connection against a warm cache, median of five, with the spread given because it is wide.

| One page of the catalogue | Median | Range |
|---|---|---|
| As it was, no figure on the Row | 3.3 ms | 3.1–4.6 |
| The first page, with the figure | 4.3 ms | 3.6–13.0 |
| A page of nothing but Orderings | 8.8 ms | 6.4–13.7 |
| The 101 largest Orderings together | 38 ms | 20–42 |

**THE LAST ROW IS NOT A PAGE ANY READER CAN BE SERVED**, and is in the table because a ceiling
nobody can reach is still the honest ceiling. Orderings do not sort together — the catalogue's order
is `coalesce(sort_name, title)` — so the largest 101 arrive on one page only if somebody asks for
them by id, which no surface does. The third row is the worst thing the walk itself can produce.

**THE COST DOES NOT GROW WITH THE ORDERING, IT GROWS WITH THE PAGE**, which is why the figures stay
this flat over a container of 2,907. Two things hold it there, both read off the plan rather than
assumed:

- The correlated half reaches `placements_container_item_position` on `container_id`, so a Row that
  holds nothing costs an index probe returning nothing rather than a scan.
- The member's tombstone needs `items`, and PostgreSQL builds that hash **once per statement** and
  reuses it across every Row on the page — `loops=1` under a `SubPlan` at `loops=101`. A per-Row
  join that rebuilt it would be the version of this that does not scale, and it is worth naming
  because the plan is what decides it rather than the SQL.

So ADR-0133's escape clause is not reached: on the page a reader is actually served the label is
inside the noise of the page it sits on.

## The predicate is shared, and that is the half that would have drifted

Two surfaces now answer "how much does this Ordering hold" — the Row on the catalogue, and the
`total` on the container's own Members listing. **A count that read only `placements.deleted_at`
would answer both differently**, because [[0075-every-table-carries-a-change-sequence]] takes a
deleted ITEM away from every Listing while its Placement sits there live. The catalogue would
promise a size the page could not list, and nothing on either would say which was lying.

It is the same failure `theSize` was built against one seam out, and the same remedy: the rule is
written once and both readers are pointed at it rather than each spelling it. What differs is that
the two readers reach the member through different names — one joins `items` itself and the other is
already selecting from `items` — so the tombstone arrives as a parameter and the catalogue's Row
reads the member through an alias. **Unaliased, both sides of the subquery resolve inward** and
every Row answers the count of items placed in themselves, which is 0 for the whole catalogue:
green against a story and wrong against every Ordering.

## What this does not license

**A Row does not gain a count because one could be taken.** [[0045-the-public-read-path-names-every-field]]
makes a Row a projection for a list, and `CONTEXT.md` says what belongs in one: what a reader needs
to recognise a Row and follow it. The figure earned its place by answering a question a reader has
while scanning — is this the container or the thing inside it — not by being cheap.

**And the name is not the reader's word.** `CONTEXT.md` under **Placement** rejects `member` as a
name and settles "Members" as what a reader is shown from the container's end; its Language section
names a type, a field, a function **and a SQL alias** as the forms that list covers. The field is
`holds` — the glossary's own verb for a **Container**, and the name the read path already gives the
Listing this counts — and the alias inside the subquery is `held`. The page says "members" and the
two are allowed to differ (ADR-0045).

**THE ALIAS IS WHERE THIS WENT WRONG FIRST**, which is worth keeping rather than quietly fixing.
The subquery was written with `alias(items, "member")` in the same change whose docstrings state
the rule three times, and it passed every check in the repository: the glossary check
(`glossary.test.ts`) reads the schemas this package EXPORTS and their field keys, and a SQL alias
is neither. That is the honest limit of that check rather than a gap to apologise for — but it
means a `_SQL alias_` is held by review alone, and review is what caught this one.

## The figure is grouped, and so is every other count beside it

`2,913` rather than `2913`. That is a decision about the WHOLE Listing rather than about the Row:
the size of the Listing and the size of a Row's own Ordering sit on one screen, so a grouped Row
beside "Showing 100 of 8052 items" would be the page disagreeing with itself about how it writes a
count. One `Intl.NumberFormat("en-GB")`, built once for the reason `Moment` gives about a formatter
one file over, and read by every COUNT on the page. Not by every number: a Position, which the Row
prints since [[0143-a-storys-row-names-where-it-sits-and-cuts-at-five-placements]], is an ordinal,
written `#1234` as the item page writes it, because grouped it would run into the comma between two
of them.

**THE LOCALE IS FIXED RATHER THAN THE READER'S**, for that component's own reason: these pages
render on the server with no script to correct them afterwards, so the default would be whichever
locale the machine happens to run under — and a grouping that differs between two instances of one
build is the sort of thing that surfaces as an assertion nobody can reproduce.

**IT WIDENS THE TICKET AND IS SAID SO HERE** rather than left in a diff. CNCORE-183 asked for the
Row. Spelling only the Row's number and leaving the line above it raw would have shipped the
inconsistency this record exists to refuse, and it reaches four surfaces because `Holding` is one
component. Nothing in the suite was pinning it — every catalogue in it is smaller than a thousand
Items, so the grouping is invisible on all of them — which is why the assertion is on the 2,913
Ordering's own Members listing, the one place in the suite where the spelling changes a byte.

## A figure does not narrow with the Listing it sits in

Work-browsing lists what a reader can watch (ADR-0077) and an Ordering's figure there still counts
every Placement, entity kinds included. **That is the right answer rather than a leak**, because the
figure's whole contract is that it says what the reader will find when they follow the Row: the
container's own Members listing is not narrowed either. A figure narrowed to the question the Row
was found by would be a promise the page it links to does not keep.

## What holds it

`catalogue.test.ts` at the package export, where the figure is asserted against the container page's
own `total` past both tombstones and the literal beside it stops the pair agreeing while both are
wrong. `listing.test.ts` at the router, where every Listing's Row enumerates the field, and
`catalogue.test.ts` beside it for the value, because an enumeration passes on a mapping that carries
a constant. `front-page.test.ts` over real HTTP on the instance nothing writes to, at nothing, one,
three and 2,913 — all four, because three and 2,913 are both plural and a Row reading "1 members"
would satisfy the ticket's own pair.

**AND THE "SAME READ" HALF IS HELD BY A COST RATHER THAN BY A NUMBER**, in `item-page-cost.test.ts`,
because it is the half no assertion on the figure can see: a read per Row answers exactly what the
subquery answers. One Listing is asked for one Row and then for every Row, and the two must cost the
same statements — flat in the number of Rows is what a subquery in the Listing's own statement can
promise and a read per Row cannot. Driven red: a `findPlacementsInContainer` per Container Row put
it at 3 statements against 2.
