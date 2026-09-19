---
status: accepted
---

# A listing says where the reader is, but still cannot be jumped into

A page of a listing says which rows it is showing and how many there are: "3,201–3,300 of 7,000",
not merely "100 of 7,000". **It still offers no jump to page seven.** Those are two different
requests that [[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]] refused together, and
only one of them had to be refused.

## Supersedes

ADR-0119's first bullet under "What this shape cannot do": *"No 'items 101–200 of 4,312'. A keyset
walk has no offset, so a page cannot say WHICH hundred it is showing without counting."*

**That sentence is exactly right and it was read as a refusal.** Its operative words are "without
counting", and this record is what happens when somebody agrees to pay the counting. Nothing else in
ADR-0119 is reopened: the walk stays keyset, the cursor stays a row's own key, the ordering and the
comparison stay one rule, and the second bullet — no jump to page seven, no page numbers AS
NAVIGATION — stands and is restated below.

## The two halves cost different things, and an earlier draft of the successor conflated them

**Saying where you are is a COUNT.** Rank the anchor — how many rows sort before it — and the page
number falls out of the rank and the page size. It is the same shape as the `total` every listing
already computes, because ADR-0119 insists the cap is never silent. So this is a second count beside
a count, not a new kind of work.

**Jumping to page seven is an OFFSET**, and that is a different thing entirely: it means producing
the six hundredth row without having seen the five hundred and ninety-nine before it, which is what a
keyset walk has no way to express and what PostgreSQL's own documentation warns about — *"the rows
skipped by an `OFFSET` clause still have to be computed inside the server."* No count gives you that.

**So the answer differs by half, and the record has to say which.** A reader is told where they are;
a reader is not given a numbered page to land on. **The A–Z jump is the landing mechanism**
(ADR-0119 names it as "the navigation that fits this shape", and it is built since CNCORE-174), and a letter is a better target than a
number anyway: a reader looking for something knows its first letter and does not know its page.

## What it costs, stated rather than waved through

**Two counts per page instead of one**, both growing with the catalogue. The rank is the more
expensive of the two, because a `total` can be answered from a narrower predicate while a rank must
respect the full sort order, and CNCORE-188 measured by how much: barely on the catalogue (1.0 ms
against 0.85), and five and a half times on Catalogue search, whose leading key is computed per match
(20.5 ms against 3.7). Measured evidence that this class of work grows: Albe (Cybertec, January 2023)
put offset pagination at 1.16 ms on page one and 15.36 ms on page one hundred, against 1.40 ms and
1.39 ms for a keyset walk. This record predicted that a rank, doing the linear work that offset's
first number describes, would follow the offset curve; **MEASURED UNDER CNCORE-188 IT DOES NOT AT THIS
SIZE, because it grows with the Listing rather than with the page**: no index covers the key it
compares, so the count behind row 3,000 and behind row 8,000 is one sequential scan of the Listing
either way (0.8 and 1.0 ms on 8,052 Items). It sits beside the size, which is the same scan, and the
section "As built, under CNCORE-188" has the figures.

**That is the trade being made**: the walk stays flat, and one label on it does not. If the label
ever costs more than the page it sits on, the honest move is to drop the label, not the walk.

**Not everyone pays it.** Stripe's cursor API returns no total at all — only `has_more` — which is
the reminder that a count is a choice rather than a property of pagination. CanonCore already chose
to pay one, for ADR-0119's reason. This record chooses to pay the second, for the reader's.

## Why the refusal did not survive its own reason

ADR-0119's refusal was correct when it was written and was taken forward on a stronger claim than it
made. The spec that inherited it said a page number "cannot be answered without becoming a different
walk", which is false: it can be answered by counting, and counting is not a different walk. The
record said "without counting" and meant it literally.

**It is worth naming why the overstatement happened, because the mechanism is general.** A refusal is
easier to carry forward than its reason, and a reason that says "this costs something" compresses on
each retelling into "this is impossible". The two are different decisions and only one of them is
revisitable. Whatever restates a refusal from another record should quote its reason rather than
summarise it.

## Evidence

ADR-0119's own text, quoted above. PostgreSQL 18 documentation on `LIMIT`/`OFFSET`, read 2026-09-13.
Markus Winand, use-the-index-luke.com — whose "you cannot directly navigate to arbitrary pages" is
about navigation, and whose remark that page numbers are poor navigation is marked as his opinion
rather than a finding. Laurenz Albe, Cybertec, January 2023, for the measured offset curve. Stripe's
published pagination contract for the counterexample.

## As built, under CNCORE-188

**EVERY LISTING ANSWERS `rowsBefore`: HOW MANY ROWS SORT BEFORE THE PAGE'S FIRST.** The catalogue,
work-browsing, Catalogue search, a Container's members and "Also appears in", each narrowed to a Group
where it can be. A surface reads it as Rows `rowsBefore + 1` to `rowsBefore + rows.length` of
`total`, and all five say it in one sentence, `Holding` in `apps/web/src/components/listing.tsx`:
"Showing items 3,201 to 3,300 of 7,000", with each surface's own noun (items, results, members,
appearances) and "Showing item 465 of 465" for a page of one. **A page opened cold from a shared
link says it too**, because the number is the Listing's rather than the reader's walk added up.

**IT IS A COUNT OF THE ROWS BEHIND THE PAGE'S CUT, and nothing else.** ADR-0119's `TheCut` is one
predicate, the Rows ahead of a point, and the Rows behind are its complement. `TheSize` in
`packages/db/src/queries.ts` gains `behind(ahead)`: the Listing's own predicate and `not(ahead)`,
counted by the size's own relation. Walked forward to a page, that count IS `rowsBefore`; read back
to one, the page is the last `limit` Rows behind the Cut, so it is the count less a page. The first
page counts nothing (it is zero), and an empty page past the end counts nothing either, because a
Cut with nothing ahead of it has the whole Listing behind it, and the size already says how much
that is.

**IT RIDES ON THE ROWS, BESIDE THE SIZE, IN THE PAGE'S OWN STATEMENT.** An uncorrelated scalar
subquery, like `total`, so "Rows 3,201 to 3,300 of 7,000" is two counts and a page in one snapshot
and cannot disagree with itself. That is ADR-0119's own rule for a number the reader takes as a fact
(the CNCORE-174 section says a count "could not" ride a second statement where a link could).

**AND THE TWO STEP-BACK LINKS ARE READ OFF IT, WHICH REMOVED TWO STATEMENTS.** CNCORE-174 asked
"is anything behind this page?" and "is anything ahead of it?" with a one-Row read each, a second
statement beside the page. Both are the count now: something lies behind a page read forward exactly
where `rowsBefore` is above zero, and something lies ahead of a page read back exactly where the size
is above the count behind its Cut. **THE PRICE, said rather than found: the links ride on the label.**
If the label is ever dropped under this record's escape clause, those two reads come back with it.

**NOTHING TAKES THE NUMBER BACK.** No procedure accepts a count of Rows to skip, and the schema says
so beside the field. A reader lands with the letters (CNCORE-174), and ADR-0119's refusal of a
numbered page stands untouched.

### A second count needed a second query, and one Listing needed more than the size does

**A DRIZZLE SELECT IS SPENT BY ITS `where`**, which sets the builder's own predicate and returns the
same object (read in `pg-core/query-builders/select.js`, drizzle-orm 0.45.2). So `theSize` now takes
a way to BUILD the relation it counts, `CountedFrom`, rather than a builder, and builds one per
count. The enforcement ADR-0119 records under CNCORE-172 is unchanged: the callback is handed no
predicate, it answers a `Countable` whose `where` is still unspent, and `theSize` spends it.

**"ALSO APPEARS IN" SORTS ON TWO COLUMNS OF A LATERAL ITS SIZE JOINS ONLY WHEN NARROWED**
(CNCORE-129 measured why). A count of the Rows behind a Cut compares those keys, so `CountedFrom` is
told `reachingItsOrder` and that Listing joins its spokesman there. **LEFT OUT, IT DOES NOT FAIL**:
the comparison's `"spokesman"` resolves to the page's own lateral one scope out and counts every Row
against the outer Row's spokesman. Mutation-checked: with the join dropped, the new package-export
test answered `past 7: 6`, `past 8: 8` and `back from 8: 8`, and no SQL error was raised. The other
four Listings read their keys off the relation they count and ignore the argument.

### What it costs, measured on the Owner's corpus

Restored into a worktree from the dump of 2026-09-19T18:51Z (8,052 Items, 30,896 Placements),
PostgreSQL 18.6. **This ticket's code and `main` before it, run INTERLEAVED** through the package
export, seven runs of each after one to warm, median and range, in milliseconds. A second full run
agreed within 0.7 ms on every row. `main`'s figures reproduce the CNCORE-174 table in ADR-0119.

| Page | Before | With `rowsBefore` |
| --- | --- | --- |
| The front page | 4.0 (3.8-5.3) | 4.2 (4.0-4.9) |
| Page 31, walked forward | 5.1 (4.8-5.5) | 5.4 (5.4-5.6) |
| Page 30, stepped back from 31 | 4.7 (4.6-5.0) | 5.2 (4.9-5.3) |
| Page 2 stepped back to the start | 8.3 (8.0-10.6) | 8.6 (7.9-8.7) |
| Page 80, walked forward | 4.2 (4.2-5.4) | 4.6 (4.5-5.1) |
| Page 81, the last | 3.7 (3.3-3.9) | 3.8 (3.5-4.2) |
| A jump to A, M, T and Z | 4.6, 4.4, 4.0, 2.9 | 4.9, 4.6, 4.3, 2.6 |
| 2,907 members, first page | 2.3 (2.2-2.4) | 2.3 (2.2-2.3) |
| 2,907 members, page 30 | 3.1 (2.8-3.6) | 3.9 (3.8-4.2) |
| Catalogue search for "story", first page | 21.6 (21.3-21.9) | 21.3 (21.1-21.9) |
| "story", page 31, walked forward | 34.1 (32.5-35.3) | 52.7 (52.0-53.9) |
| "story", page 30, stepped back | 32.5 (31.4-37.5) | 50.2 (49.0-56.1) |
| "story", page 66, the last | 42.1 (40.0-43.9) | 57.2 (55.7-57.7) |
| Catalogue search for "the", page 31 | 23.5 (22.7-25.0) | 36.7 (36.2-37.6) |

**THE COUNT ALONE**, `EXPLAIN (ANALYZE)` five times each: the Rows behind row 3,000 in 0.81 ms
(0.80-0.98), behind row 8,000 in 1.03 ms (1.01-1.18), and the size beside them in 0.85 ms
(0.82-0.93). Each is a sequential scan of `items`, 171 buffers, with PostgreSQL pushing the `not`
down into `<=` and `<>` on the sort key. **So on the catalogue the second count costs what the first
does**, and both grow with it: the count alone is 0.8 to 1.0 ms of a 3.8 to 5.4 ms page, and the net
is 0.2 to 0.8 ms because the two one-Row reads went.

**CATALOGUE SEARCH IS WHERE IT COSTS, AND THE REASON IS THE KEY IT COUNTS BY.** Its leading key is
`similarity()` against what a reader typed, computed for every match: one pass over the 6,536 titles
matching "story" is 15.0 ms, the count behind row 3,000 of that ranking is 20.5 ms (19.4-23.5), and
the size beside it, an `ilike` alone, is 3.7 ms. `main` paid that pass twice already, the page's sort
and the look-behind, but ran the two statements side by side; the count rides in the page's own
statement, so its pass is added to the page rather than overlapped with it. **So a search page past
the first costs 13 to 19 ms more, about half again**, and the first page nothing.

**THE ESCAPE CLAUSE IS NOT REACHED, AND SEARCH IS WHERE IT WOULD BE.** On the catalogue the count is a
fifth of its page at most; on Catalogue search it is 20 ms against a page of 34 to 42, which is
below the page and not far below it. The lever, if it is ever pulled, is to compute the closeness once
for the page and the count together rather than to drop the snapshot the count shares with the Rows.
Nothing is built for that now. **"Also appears in" pays nothing on the Owner's corpus**, because its
longest is 61 Rows (ADR-0119, CNCORE-174) and a Listing that fits one page never has a Cut to count
behind: its count, which joins the spokesman lateral, has never run against real data.

**WHAT WOULD CHANGE THE CURVE** is an index on `coalesce(sort_name, title)`, which would let the count
read only the Rows behind the Cut: cheaper near the front and dearer towards the back, the shape this
record first predicted. None is added, because nothing measured needs one.

### Asserted at the three seams

[[0103-tests-bite-at-package-exports-and-the-router]]'s seams, each walked against an oracle that is
not the count: how many Rows the walk actually handed out before each page.

- **At the package export**, the catalogue's walk from the first page to the last; every Row of the
  catalogue walked past and stepped back from, across a tie and the untitled tail; the same for a
  Container's members (across a tie, a Repeat and the Unplaced) and for "Also appears in" (across
  all four keys); and a jump to M says how many Rows are filed before it.
- **At the router**, one new case in the contract block of `listing.test.ts`, so all three
  procedures and each narrowed to a Group are asked it: every page walked to and stepped back to,
  and the page past the end, which has the whole Listing before it. `item.test.ts` asks `item.get`'s
  two Listings where their first, second and stepped-back pages are.
- **Over HTTP**, `/` walked to its end with every page's address opened cold, and each of `/works`,
  `/search`, a Container's members and "Also appears in" saying where its step back or jump landed.

**MOST OF THE PACKAGE-EXPORT TESTS WERE WRITTEN AFTER THE CODE**, because the step back's arithmetic
went in with the first forward test's green. So they were mutation-checked, each run and read: the
page read back left as the count behind its Cut (killed by the new every-Row test), the count
dropping the Listing's own predicate (two tests), the step back offered off nothing but the page's
first Row (four of CNCORE-174's own tests), "Also appears in"'s spokesman left out of its count (the
new test, silently, above), and `rowsBefore` handed to the surface as zero on `/search` and on a
Container's members (both surfaces' step-back tests, and `/search`'s page-two sentence).

**THE STATUS IS `accepted`.** Both halves of this record are whole: every Listing says where the
reader is, from the shared page every Listing is cut in, and nothing lets a reader jump by number.
