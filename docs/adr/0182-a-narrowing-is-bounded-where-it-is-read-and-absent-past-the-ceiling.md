---
status: accepted
---

# A narrowing is bounded where it is read, and past the ceiling it is absent rather than cut

> **ACCEPTED 2026-09-21, whole, in one repository.** `A_NARROWING` is 100, declared once in
> `packages/schemas/src/index.ts`, and both parameters it governs are bounded at both seams that
> take them: `listingInput` in `packages/api/src/routers/catalogue.ts` declares
> `kind: z.string().max(A_NARROWING).optional()` and `group` the same, refusing a direct caller on
> all three listing questions; `oneKind` and `oneGroup` in
> `apps/web/src/components/query-params.ts` answer `undefined` past it through one `aNarrowing`,
> so no link `queryFor` writes can carry one. Three seams drive it: the router
> (`packages/api/src/routers/listing.test.ts`, asked of each of the three questions), the surface
> read (`apps/web/src/components/query-params.test.ts`) and the served page
> (`apps/web/e2e/order-and-narrow.test.ts`, over every `href` in the document). The page seam was
> checked RED both ways by mutation -- no bound, and a cut at the ceiling -- and run in the full
> 24-file e2e suite rather than alone. The TODO CNCORE-284 left in that file is gone, and the
> sentence carrying it is corrected in place rather than beside itself. No provider repository is
> touched, so nothing is owed at a second one.

`?kind=` and `?group=` were bounded nowhere on the way in. `oneKind` and `oneGroup` trim and
lowercase and pass any string -- deliberately, because whether a value names a kind or a Group is
the DATABASE's answer rather than this repository's ([[0066-path-is-identity-query-is-the-route]])
-- and nothing downstream put a ceiling on the VALUE. Two sinks took both at whatever length a
stranger chose.

**The read path compared it per request.** `listingInput` declared `z.string().optional()` for
each, and the front page, `/works` and `/search` all handed what they read straight to the
handler. It is parameterised, so this was never injection: it is an unbounded value a stranger
picks the size of.

**And every link on the page carried it forward.** `queryFor` spreads `walking.narrowed` and
`walking.chosen`, so the raw value was written into the `href` of `Everything`, of each Group's
link, of both order links and of the `#` entry [[0180-what-sorts-before-a-is-a-range-and-the-bar-offers-it-only-where-it-holds-rows]]
added. The served document therefore held one copy per Group: the reader's own page grew with the
crafted value times the shape of the catalogue. **Carrying the narrowing forward is CORRECT** --
that is what those links are for -- so the repair is the ceiling and never the carry.

## Past the ceiling the value is ABSENT, and that is the decision this record turns on

The obvious repair is [[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]]'s cut, and it is
the wrong one here.

[[0170-a-value-a-page-both-asks-with-and-quotes-is-two-values]] says a bound "turns on where a
value LANDS", and splits a query into the whole one a page ASKS with and the short one it PRINTS.
A narrowing has only the first half. **It is never printed**: CNCORE-281 took `?kind=` out of the
front page's heading and CNCORE-262 out of `/search`'s, and
[[0178-a-parameter-a-page-speaks-is-reported-where-it-is-unbounded]] now reports a surface that
puts it back. So there is no printed copy for a cut to bound, and cutting the CARRIED copy would
write a narrowing the reader never asked for into every link for their next click to send back.
That is `theQueryQuoted`'s own reason for keeping the whole query in what replays a search: **a cut
value is a different question.**

Absent is not a new meaning invented for this. `oneKind`'s own docblock already said "ABSENT IS THE
LISTING UNNARROWED, which is what clearing the narrowing is", and the kind picker marks "Every
kind" current over exactly the page that was served. A value that cannot be a kind at all is not a
narrowing, and the page says so by being the page it served.

**IT IS NOT THE SAME ANSWER AS `?kind=banana`, AND THE LINE IS ARITHMETIC RATHER THAN TASTE.** A
short word nobody defined still narrows to nothing and the page says which emptiness that is --
`banana` could be an eighth kind after a migration. A value of a thousand characters could not be
one under any migration, so refusing it as a narrowing guesses nothing about a set this repository
does not own.

## The ceiling is 100, taken for the SHAPE of the value and not for the other ceiling's reason

**Measured on the Owner's own install, 2026-09-21**, which holds the real corpus. A figure about a
running system carries its population, its date and the query that would take it again, which is
[[0153-a-figure-about-this-tree-is-derived-or-dated]]'s rule.

| population | count | shortest | longest |
| --- | --- | --- | --- |
| rows in `item_kinds` | 7 | 4 (`work`) | 12 (`organisation`) |

```sql
select count(*), min(length(kind)), max(length(kind)) from item_kinds;  -- 7|4|12
```

`item_kinds.kind` is `text` (migration 1), so no column decides this and the number is a fact about
what a kind IS. [[0005-seven-item-kinds]] closes the set at seven, so the headroom is for a
migration renaming one rather than for a set that grows. A Group id is a uuid at 36. 100 is far
above both and far below a flood.

**IT IS `task.ts`'s `KEY_LENGTH` BY ITS NUMBER AND NOT BY ITS REASON, AND A LATER READER MUST NOT
COLLAPSE THE TWO.** That ceiling bounds a key because the key is QUOTED BACK in a refusal -- an
ADR-0123 sentence bound, where an unbounded value is a caller choosing the length of a sentence
this app utters. **A narrowing is quoted in no sentence at all.** The same number is taken for the
same SHAPE, a short slug a caller names, and agreement on the number says nothing about agreement
on the reason. Inferring from it that a narrowing gets printed somewhere would be inferring the
defect CNCORE-281 closed back into existence.

## One ceiling, two seams, and that split is already this file's arrangement

The refusal and the read are not two copies of one rule; they answer to two different callers, and
`catalogue.ts` had already written the argument down for `order`:

> A WORD NAMING NO ORDER IS REFUSED HERE AND NEVER REACHES A READER, and the two halves of that are
> worth keeping apart. [...] **The refusal bounds the seam; the surface bounds the reader.**

The same holds here, and neither half can do the other's work. The router's ceiling cannot reach a
single `href`, because a link is built from what the SURFACE read and never from what the seam saw.
The surface's ceiling cannot reach a caller that skips the surface, which is
[[0160-a-container-id-is-bounded-where-the-list-arrives]]'s stated cost at its own seam, arriving
here as the reason there are two.

**What is NOT written twice is the number.** `listingInput`'s own docblock refuses that in as many
words -- "Two declarations would be one rule in two places, free to drift into two ceilings that
nobody chose" -- so both read one `A_NARROWING`.

### It lives in `@canoncore/schemas` rather than beside `A_PAGE`, and that is about who reads it

`A_PAGE` argues for its own address: six listings read it and all six are inside `@canoncore/api`.
This ceiling is read in two packages, and the web module holding `oneKind` and `oneGroup` is
imported by `scope.tsx`, which is a **CLIENT component**. Reaching the number through
`@canoncore/api/routers` would pull the router, its database and its oRPC server into the browser
bundle to read an integer. `@canoncore/schemas` is the leaf both seams already depend on and is
described as exactly this: schemas "shared by the API contract and its consumers". So the two
ceilings sit in two places for one reason each, rather than by drift.

`apps/web` gained `@canoncore/schemas` in its manifest for it. It also gained `@canoncore/text`,
which `query-params.ts` had been importing at RUNTIME off a `devDependencies` entry since
CNCORE-285 -- every other package importing that leaf lists it under `dependencies`, and a
production install would not have resolved this one.

## Both parameters in one pass, which was the dispatcher's call

CNCORE-284 named `?kind=` alone. `?group=` was unbounded on the line ABOVE it, with the same two
sinks, and `queryFor` spreads both objects three lines apart. **The DISPATCHER decided on
2026-09-21** that this is ONE REASON TO CHANGE rather than merely one file, and that the second
ticket be FILED FIRST so the PR could name both -- a fold only the agent heard about being one
nobody can check. That is CNCORE-309. The ceiling's value, 100, is the dispatcher's call of the
same date. **Neither is the Owner's.**

A test naming only `kind` would have passed over the parameter beside it, which is how `?group=`
came to be found at all: by reading the declaration the other ticket was repairing.

## What this record does NOT close

**NEXT ECHOES THE ADDRESS, AND THE CEILING DOES NOT REACH IT.** The served document still carries
the request URL inside the RSC flight payload -- `0:{"P":null,"c":["","?group=...&kind=..."]}` --
whatever this app does with the parameter. **Measured 2026-09-21** while writing the page-seam
test, which was first written over the whole document and went red with the ceiling in place: a
crafted value 108 characters long appeared three times there and in no `href`.

It is left, and the reason is the shape of the harm rather than the size of it. CNCORE-284's
complaint is a document that grows with the CATALOGUE: one copy per Group, so a reader with forty
Groups pays forty times over. Next's echo is a CONSTANT three copies of an address the reader's own
browser already holds, and removing it would mean serving a different address than the one asked
for. The page-seam test therefore asserts over every `href` rather than over the document, and says
in its own comment why the window is what it is.

**A NARROWING INSIDE THE CEILING IS STILL CARRIED, one copy per Group, and that is the feature.**
`order-and-narrow.test.ts` drives a 48-character crafted `?kind=` that still reaches every link,
deliberately. The ceiling bounds how MUCH may be carried, never whether -- and the test asserts
both sides for that reason, because an assertion of absence alone would pass equally against a page
that had stopped carrying narrowings at all.

**AND THE OTHER PARAMETERS OF `listingInput` ARE NOT SWEPT HERE.** `after`, `before` and `letter`
are `aCursor` and a plain string, and whether any of them owes a ceiling is a question this record
does not answer. It bounds the two that were reported and the one found beside them; a sweep of the
rest is not a thing to fold in silently under a ticket about `?kind=`.
