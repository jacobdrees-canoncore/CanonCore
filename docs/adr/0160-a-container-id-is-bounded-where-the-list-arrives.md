---
status: accepted
---

# A Container id is bounded where the list arrives, not where it is written

> **ACCEPTED 2026-09-20, whole, in one repository.** `provider.beginImportRun` refuses a Container
> id over 255 characters before it opens a run, naming the id, its length and where it sits; the id
> is bounded on both of ADR-0123's levers where it enters that sentence, through one `boundedTo`
> call rather than a fourth hand-written copy of them; and four tests at ADR-0103's router seam
> drive the refusal, the boundary, the control characters and the dearest id the bound admits
> (`packages/api/src/routers/provider.test.ts`). No provider repository is touched, so nothing is
> owed at a second one.

Nothing bounded the LENGTH of a Container id. `containerIds` was
`z.array(z.string().min(1)).min(1)` -- a minimum and no maximum -- and `theContainerIdsIn` trims
blank lines and `#` comments only, so an ordinary import list reached
`import_run_containers_named_once`. That index is a btree, and a btree cannot index a value over
2704 bytes. Reproduced on this tree's PostgreSQL 18.6 on 2026-09-20, with an 8000-character value:

```
ERROR:  index row size 8016 exceeds btree version 4 maximum 2704
HINT:   Values larger than 1/3 of a buffer page cannot be indexed.
```

CNCORE-254 had already narrowed that write, so SQLSTATE 54000 reaches the Owner as `BAD_REQUEST`
rather than as the 500 it used to be. What was left was **a sentence that does not say why**: the
Owner read "the catalogue refused that list" and was told neither which id nor that its length was
the problem. That is the complaint CNCORE-254 made about the repeated id, one constraint over.

## The ceiling is 255, and it is a fact about Providers rather than about Postgres

Taking 2704 would be taking the wrong ceiling, because **an id anywhere near it is already wrong**.
The number is chosen against what a Provider's ids actually look like.

**Measured against the Owner's own install on 2026-09-20**, which holds the real corpus. These are
figures about a running system rather than about this tree, so each carries its population, its
date and the query that would take it again, which is
[[0153-a-figure-about-this-tree-is-derived-or-dated]]'s rule for exactly this case.

| population | count | shortest | longest |
| --- | --- | --- | --- |
| distinct `import_run_containers.external_id`, undeleted | 465 | 4 | 6 |
| `external_id` statements on Items, undeleted | 8,052 | 2 | 6 |

```sql
-- 465 distinct ids over 466 rows: the install holds two runs and one row refused.
-- 465 is the same 465 the corpus census counts, rather than a figure beside it.
select count(distinct external_id), min(length(external_id)), max(length(external_id))
  from import_run_containers where deleted_at is null;

select count(*), min(length(s.value_literal)), max(length(s.value_literal))
  from statements s join properties p on p.id = s.property_id
 where p.name = 'external_id' and s.deleted_at is null;
```

They are MediaWiki pageids, and the longest thing this catalogue has ever held in either column is
**six characters**.

**255 is the headroom a Provider could honestly need, not a round number.** CMPP declares a
record's id as `z.string().min(1)`, so a Provider is free to use a page TITLE where `provider-wiki`
uses a pageid, and MediaWiki caps a page title at 255 bytes -- `Page_title_size_limitations` on
mediawiki.org, last edited 2025-11-07, which gives the reason as 255 being what one byte of length
can express. The bound here is 255 CHARACTERS, which is the more generous reading of that ceiling
and never the meaner one: a 255-byte title is at most 255 characters and may be as few as 64.

### It cannot reach the constraint it protects, and the obvious arithmetic is wrong twice

The ceiling counts `String.length`, which is **UTF-16 units**. The most UTF-8 bytes one unit can
cost is 3, because a character needing 4 bytes is an astral one and spends TWO units to get them --
so an emoji id is cheaper per unit than a CJK one, not dearer. 255 units is therefore at most **765
bytes**, against a 2704-byte limit.

The obvious reasoning -- four bytes a character, 1020 -- picks the wrong worst case AND the wrong
unit. It is safe here by luck of the margin, and it is written down because a later ceiling chosen
that way would not be. `provider.test.ts` writes the dearest id the bound admits, 255 units and 765
bytes of pseudo-random CJK, and reads it back through the run.

**Incompressibility is the trap this was filed with.** TOAST compresses before the index sees a
value, so `repeat('9', 3000)` writes perfectly well while an 8000-character hash string does not --
both reproduced on this tree on 2026-09-20. A fixture built the obvious way proves nothing about
length, so the one here draws its code points off a sha256 stream. It is not load-bearing for this
record's own tests, which stay under the limit by design; it is what keeps the dearest-id test
honest about being the dearest.

## The bound is at the router, and the repeat stays in the store

`theRepeatIn` refuses a repeated id inside `beginImportRun`
([[0154-a-repeated-container-id-refuses-the-list-rather-than-being-deduped]]). This refusal sits
one layer out, in `provider.beginImportRun`, and the line between them is **what each rule is
about**:

- A **repeat is a property of the LIST**. It needs every id and its positions, and a run's identity
  IS that exact list in that exact order -- `theRunStillWalkingThisList` matches on it to resume.
  So it belongs where the run is opened.
- A **length is a property of ONE ID**. That is the boundary's ordinary work, and it is where
  `declaredName` and `task`'s `key` are already bounded.

**And bounding it in `beginImportRun` would have broken a test that cannot be replaced.**
`import-runs.test.ts` drives CNCORE-254's transaction -- the run row and its Containers as one
write, leaving no orphan -- with an id no btree can hold. A repeat cannot drive it, because
`theRepeatIn` turns that list away before a row is written, and that test's own comment says so. A
length check inside `beginImportRun` would refuse before the INSERT and leave the transaction with
nothing reaching it. So the ceiling went at the router, the store keeps catching 54000, and that
catch keeps its witness.

The cost, said out loud: **a caller reaching `beginImportRun` directly does not inherit the bound.**
There is one production caller and it is the router, so the exposure is tests; the store answers
such a list with "the catalogue refused that list", which is what it answered everyone before this.

## The refusal is a sentence, which is the whole point of the ticket

```
Theory:Timeline - xxx… is 300 characters, at position 2, and a Container id is at most 255
```

**The id is bounded where it ENTERS the sentence**, which is
[[0123-a-failure-reason-is-bounded-and-it-says-who-wrote-it]]'s rule and its 80 characters, taken
rather than chosen again because it is the same question that record answered about a different
reader. An id refused FOR ITS LENGTH is precisely the value that would otherwise eat the clause
explaining why it was refused -- the correction that record makes against itself, arriving here as
the case it predicted.

**On BOTH of that record's levers, which this took only one of until review.** The cut answers how
MUCH of a stranger's value lands in the sentence; `CONTROLS` answers what it may DO to the words
around it, because a bidirectional override re-orders the glyphs on either side of itself and runs
the clause naming the ceiling backwards through the page. Taking the cut alone is half a mechanism
that looks finished from outside -- which is what CNCORE-274 found in `@canoncore/tasks`' copy, and
what a fresh copy here reproduced one ticket later.

So **`boundedTo(text, max)` applies both levers in one call**, and a caller supplies only its own
ceiling, because that number is a fact about its own sentences (CNCORE-269); the levers are not its
to choose between. That is deliberately a narrower export than the cut: publishing the cut is what
let this diff take half the mechanism in the first place.

**IT WAS `@canoncore/providers` THAT PUBLISHED IT, AND IT IS NOT ANY MORE
([[0163-the-levers-that-bound-a-strangers-text-live-in-a-leaf]], CNCORE-282).** Both levers moved to
`@canoncore/text`, a package depending on nothing, so `@canoncore/db` and `@canoncore/tasks` reach
them without taking the outbound HTTP stack ADR-0123 refused them. `@canoncore/providers` publishes
neither function now. The rule above is unchanged — one call, both levers, the caller's own ceiling
— only its address is.

**The id a Provider chose can reach this sentence**, which is why the levers are not theoretical
here. `/import` lists a Provider's own Containers for the Owner to pick from since CNCORE-187, so
the value quoted back may be a stranger's rather than the Owner's own typing.

**And it says where.** The repeat's sentence names positions because a hand-assembled list of 465
makes "an id is repeated" unactionable (ADR-0154). It matters more here, because the id the Owner
reads back is CUT and a cut id is not something they can search their own file for. As there, it is
a position in the LIST and not a line of the file: `theContainerIdsIn` drops blank lines and `#`
comments before an id arrives.

**Not a `z.string().max()`, though that is where the gap was found.** oRPC answers an
input-validation failure with the procedure's DECLARED sentence and zod's issue list, so the bound
would hold and the Owner would read "That list of Container ids cannot be imported as it stands." --
naming no id and no length, which is the defect this record closes rather than a repair of it.

## What this record does NOT close

`theRepeatIn`'s own sentence still interpolated a Container id raw, on neither lever, when this
record was taken. This bound caps what can reach it at 255 characters rather than at nothing, which
is a smaller flood and not the mechanism: 255 is not 80, and no lever strips the controls.
`@canoncore/db` could not call `boundedTo`, because ADR-0123 kept `@canoncore/providers` out of that
package's reach deliberately and `@canoncore/tasks` wrote its own pair by hand for the same reason.
Closing it meant either a third hand-written copy or moving the levers somewhere both packages
reach, which is a decision rather than a line: **CNCORE-282**.

**CLOSED, AND BY THE SECOND OPTION**
([[0163-the-levers-that-bound-a-strangers-text-live-in-a-leaf]]). The levers live in
`@canoncore/text` and the repeat's sentence bounds its id on both at a ceiling of 80, beside the
sentence it bounds. The two hand-written copies this paragraph names are gone with it.
