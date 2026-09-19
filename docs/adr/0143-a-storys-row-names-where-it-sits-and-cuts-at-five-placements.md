---
status: accepted
---

# A story's Row names where it sits, and cuts at five Placements

> **ACCEPTED 2026-09-19, whole, in one repository.** Both halves landed under CNCORE-184: a Row of
> the catalogue carries where its Item sits, and the page says it in one line. No Provider
> repository is touched, so there is no cross-repo pair here and nothing waiting on a second ticket.

A Row of a Listing carries **the first five Placements of its Item and how many it has
altogether**: each Placement's Ordering and Position. The Row prints them as one line: "Also appears in
Broadcast order #240 · The Doctor's own chronology #1". Both figures come from **one aggregate in one
correlated scalar subquery on the Listing's own statement**. That is
[[0140-a-row-carries-its-own-count-and-one-predicate-answers-it-twice]]'s mechanism reached for a
second time, and its predicate is the one "Also appears in" reads its `total` off.

## Why five, and why five PLACEMENTS

CNCORE-159 said a long membership truncates and could not say where, because the one figure it had
was a guess: "one Item in thirty-six Orderings". CNCORE-167 measured the corpus instead
([[0137-the-corpus-is-8052-items-and-that-is-the-size-the-surfaces-are-designed-against]]). This
record chooses against what was measured. Figures below are from the Owner's install on 2026-09-19:
8,052 Items, 7,587 of them placed, 30,896 Placements.

**THERE ARE THREE WORST CASES, AND THEY ARE THREE DIFFERENT STORIES:**

| | Orderings | Placements | Repeats |
|---|---|---|---|
| `Endgame (POT comic story)`, the widest | **48** | 50 | 2 |
| `The Day of the Doctor (TV story)`, the longest Row | 35 | **61** | 26 |
| `UNIT HQ (video game)`, the most Repeats | 5 | 59 | **54** |

**THE THIRD IS WHY THE CUT COUNTS PLACEMENTS.** UNIT HQ sits at **43** Positions in ONE Ordering,
`Theory:Timeline - Petronella Osgood`. A cut at five ORDERINGS would print all five of its Orderings
and 43 numbers after one of them. 899 stories have at least one Repeat. Counting Placements is the
one cut that bounds a Row whatever shape its membership has.

**AND FIVE BECAUSE OF WHERE THE STORIES ACTUALLY ARE**, which is nowhere near the top:

| Placements at most | Stories whose whole Row fits |
|---|---|
| 3 | 60.6% |
| 5 | **78.8%** |
| 8 | 90.4% |

The median story has 3 Placements and the 99th percentile 21. At five, four stories in five show
everything they sit in. The other 1,611 show five and say how many more. A median Ordering title is
30 characters (the longest is 59), so five Placements in five Orderings is about 175 characters under
a title. Eight would buy another tenth of the catalogue a whole Row, at about 280 on every long one.

**THE CUT LOSES NOTHING, AND THAT IS WHAT ADR-0137's FIGURE BUYS.** "and 56 more appearances" links to the story's
own "Also appears in", which is capped at a page of 100 ([[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]]).
The most any story has is 61. So every story in the corpus shows its whole membership one click from
its Row, on one page, with no walking.

## One aggregate, and the predicate is shared

**THE NAMED FIVE AND THE TOTAL ARE ONE PASS OVER ONE SET OF ROWS.** The subquery aggregates every
Placement of the Item in order and CUTS the array (`[1:5]`), in the same `SELECT` as `count(*)`. Two
subqueries would be two readings of one predicate. One aggregate cannot report "and 3 more" over a
set it named differently.

**THE PREDICATE IS `whatItSitsIn`, AND "ALSO APPEARS IN" READS IT TOO.** This is the item's-end mirror
of `whatItHolds`, and for 0140's reason: a Row saying "and 12 more" over a page listing 11 is two
surfaces disagreeing about one story, with nothing to say which one lied. Both tombstones are in it:
the Placement's own, and the container's, because a deleted Ordering is gone to every reader
([[0075-every-table-carries-a-change-sequence]]). The catalogue's Row is already selecting from
`items` as the STORY, so the container is read through an alias, `container`. **Unaliased, the inner
`items` would resolve inward**, the same trap 0140 names for `held`.

**ITS ORDER IS NOT "ALSO APPEARS IN"'S, DELIBERATELY.** That listing's middle two keys are
ADR-0017's spokesman, a lateral per Placement, which decides which of two DISAGREEING sources speaks
first. A Row groups a story's Positions under their Ordering, so after the container's sort key it
needs the CONTAINER'S ID, so that two Orderings sharing a title cannot interleave. Then comes the
Position, so a recap at 1 reads before the episode at 5. The two orders agree wherever one source
speaks and no two Orderings share a key. That is the whole corpus: **one source behind all 30,896
Placements, and no sort key shared by two Orderings**, measured 2026-09-19. A second source is the
day the two could first differ, and only on which Positions of a disagreement a Row names first.

## The words

**"In no ordering", NOT "Unplaced", WHICH IS WHAT THE TICKET AND THE SPEC BOTH SAY.** `CONTEXT.md`
spends **Unplaced** on a Placement with no Position, "never an absent placement". A story in no
Ordering has no Placement at all: it is at the root
([[0062-root-is-the-absence-of-a-placement]]). The glossary is binding on UI copy and ticket titles
alike, so it wins. Its **Unplaced** entry now says so, because the confusion had been written down
twice. "Ordering" is the glossary's noun from the item's end, the one the item page counts "Also
appears in" in.

**A PLACEMENT WITH NO POSITION READS "no position given"**, the glossary's words for the reader, and
never as a number. The corpus holds 701 of them.

**A POSITION IS NOT GROUPED, AND THAT CORRECTS 0140.** That record grouped "every other number" beside
the Row's figure. What it meant, and what its reason covers, is every COUNT. A Position is an
ordinal, `#1234` as the item page writes it, and grouped it collides with the comma between two of
them: "#1,234, #1,240". The correction is in 0140's own sentence.

**THE CUT SAYS "and 56 more appearances", NOT "and 56 more".** It counts Placements, and after a Row
has named every Ordering it sits in, a bare number reads as that many more Orderings. The fixture's
story is named in all three of its Orderings and then has 2,910 Placements left. "Appearances" is the
noun of the reader's own phrase, and a Repeat is one Ordering appearing twice. "Positions" would
miscount, because a Placement may have none. `CONTEXT.md`'s **Placement** now names it as the count
from the item's end. The item page still counts the same figure as "orderings", which is its own
ticket rather than this one's.

**"Also appears in" ON A CATALOGUE ROW, where "also" has no page to be beside.** It reads as "also,
besides being in the catalogue", and it is the heading of the section the cut links to, so the Row
and the page it leads to use one phrase.

## An Ordering's Row says nothing about where it sits

**A STORY SAYS WHERE IT SITS; AN ORDERING DOES NOT.** Root is where Orderings live, so all 465 of the
corpus's would carry "In no ordering", and the line that matters on a story would drown among them.
None of the 465 sits in another (ADR-0137's `orderingsPlaced` is 0), and the ticket asks for a
story's Row. So an Ordering placed in another is left to the day one is. An earlier draft showed that
case and nothing tested it. The figure is still asked of every Row, for `holds`'s reason: which Rows
SHOW it is the surface's decision, off `isContainer`, and not a second place for "what is a container"
to be decided.

## What it costs

Measured 2026-09-19 against the Owner's install on PostgreSQL 18.6. `EXPLAIN (ANALYZE, BUFFERS)`,
one connection, warm cache, median of five.

| One page of the catalogue | Median | Range |
|---|---|---|
| As it was: `holds` only | 3.4 ms | 3.2–3.6 |
| The first page, with where each story sits | 4.4 ms | 4.3–4.9 |
| The page of the walk carrying the most Placements (the 22nd, 695 across 100 Rows) | 3.7 ms | 3.4–4.1 |
| The 101 most-placed stories together (2,746 Placements) | 8.6 ms | 7.6–9.2 |

**THE LAST ROW IS NOT A PAGE ANY READER CAN BE SERVED**, for 0140's reason: stories do not sort
together by how placed they are, so the 101 most-placed arrive on one page only if somebody asks for
them by id. The third row is the worst the walk itself produces.

**THE COST GROWS WITH THE PLACEMENTS ON THE PAGE**, read off the plan: `placements_item` once per
Row, a primary-key probe per Placement, and a sort of three or four rows. That is about 0.012 ms a
Row on the first page. No index was added, because none was missing. [[0133-a-listing-says-where-the-reader-is]]'s
escape clause is not reached: the Row is well inside the page it sits on.

## A Row links more than its own Item now, and the walks had to learn it

**EVERY WALKED LISTING WAS ORACLED BY THE `/items/` LINKS ON ITS PAGES**, and a Row that links its
Orderings put 723 links on a walk of 465 Rows. Four walk tests went red on the first run. The oracle
now reads **each Row's own link, which is the first link in its `<li>`** (`itemsListedOn`), and
`theRowTitled` matches on that link alone, since a story's Row now carries an Ordering's title too.
**THAT IS A CONTRACT THE LISTING NOW KEEPS**: whatever else a Row links, its own Item comes first.

## What The Day of the Doctor's Row actually reads

Read off the branch under `next dev`, against a restored dump of the Owner's catalogue:

> Also appears in Theory:Timeline - 2010s #114 · Theory:Timeline - 76 Totter's Lane #22 ·
> Theory:Timeline - Adam Mitchell #4 · Theory:Timeline - Clara Oswald #48 · Theory:Timeline -
> Daleks #308 · and 56 more appearances

**THE FIVE ARE WHICHEVER ORDERINGS SORT FIRST, NOT THE ONES THE TICKET'S EXAMPLE NAMES.** The ticket
designs against the fiftieth-anniversary special set beside the Doctor's own chronology. The corpus's
Orderings are the wiki's timelines ([[0128-an-ordering-is-the-sources-own-axis-not-release-order]]),
and this Row opens with `2010s` and `76 Totter's Lane`. Surfacing the Orderings a reader cares about
first needs a rule for which Orderings matter. That is a question about the scope a reader picked,
Groups, and not about how a Row cuts. The Row keeps the item page's order so that "and 56 more
appearances" continues the same list the link lands on.

**AND UNIT HQ'S ROW NAMES ONE OF ITS FIVE ORDERINGS**: "Theory:Timeline - Fugitive Doctor #25, #29,
#31, #34, #35 · and 54 more appearances". Its first five Placements all fall in the Ordering that sorts
first. That is the Placement cut doing what it was chosen for. Naming every Ordering before any
second Position would be a second rule on top of this one, and nobody has asked for it.

## What this does not do

**THE LINK LANDS ON THE ORDERING, NOT AT THE STORY'S POSITION IN IT.** "AHistory #1234" opens
AHistory at its first page. Landing a reader at the story inside a 2,907-member Ordering is a
question about the Members listing's cursor and about `?via=`
([[0066-path-is-identity-query-is-the-route]]). The ticket asked for the membership as links, so it
is not answered here.

**NOTHING HERE IS A CLAIM ABOUT A CATALOGUE WHERE ONE STORY SITS IN HUNDREDS OF ORDERINGS.** The cut
is five whatever the size, so the Row stays bounded. What would change is the link target: a story
past a hundred Placements has an "Also appears in" that walks. The fixture's own story does, at
2,915, and still reads correctly, but that is a fixture and not a corpus.

## Re-taking the figures

**THE DISTRIBUTION ABOVE IS NOT ASSERTED ANYWHERE**, and on purpose, for ADR-0137's reason about its
timings: it is a measurement of one catalogue on one day. The widest figure, 48, is the one the corpus
suite asserts as a floor. Re-take the rest read-only against an install with:

```sql
with live as (
  select p.item_id, p.container_id from placements p
  join items c on c.id = p.container_id
  where p.deleted_at is null and c.deleted_at is null
), per as (
  select item_id, count(distinct container_id) orderings, count(*) placements
  from live group by item_id
)
select max(orderings), max(placements),
       round(100.0 * count(*) filter (where placements <= 5) / count(*), 1) whole_at_five
from per;
```

The one to watch is `max(placements)` against a page of 100. Past it, the cut still holds, but "one
click, one page" does not.

## What holds it

- `packages/db/src/catalogue.test.ts`, at the package export. The order, with ids pinned against
  it so a fall-through to id order is red. Both tombstones, with the story's own "Also appears in"
  `total` as the oracle and a literal beside it. A Repeat. A story in no Ordering. And the cut, over
  a story at seven Positions in ONE Ordering, which is UNIT HQ's shape and is what fails a cut
  counted in Orderings.
- `packages/api/src/routers/listing.test.ts` enumerates the field on all six catalogue Listings, and
  `catalogue.test.ts` beside it asserts the value survives `.output(cataloguePublic)`.
- `apps/web/e2e/front-page.test.ts`, over HTTP on the instance nothing writes to. The story in three
  Orderings with 2,913 Repeats in one reads five Positions, then "and 2,910 more appearances", and links each
  Ordering and then its own "Also appears in". A story in no Ordering says so. A Placement with no
  Position reads "no position given". An Ordering's Row says nothing about where it sits.
- `apps/web/e2e/item-page-cost.test.ts` holds the "same read" half, unchanged. A
  `findPlacementsOfItem` per Row drove it red, at 8 statements against 3.
