---
status: accepted
---

# A count copied from a record is not the population a check derives

> **ACCEPTED 2026-09-21, whole, for the sentence it names.**
> `packages/config/src/bounded-parameters.test.ts` no longer says how many sites owe
> [[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]]'s bound. "Seven sites in this tree owe
> that bound" is gone, and its `TODO(CNCORE-314)` with it. So are the ordinals that carried the same
> figure: "the sixth and the seventh", "the seventh site" twice, "the eighth site" and "THE FIFTH
> SITE". Each now names the surface it meant. Nothing went into `tree-figures.test.ts`, because no
> argument rests on the figure, and no mechanism is added, as in
> [[0188-a-count-nobody-routes-by-is-deleted-rather-than-derived]]. No provider repository is
> touched, so nothing is owed at a second one.

## The measurement came first

Taken 2026-09-21 at `4ecd698`, before anything was decided. The method was the file's own walk, run
once with its derived set of bounds emptied. That names every surface and parameter whose value
reaches a JSX child position and is kept out of it ONLY by a bound, which is exactly the population
the file derives. The row lived in a scratch copy that was deleted afterwards.

**The population this file derives numbers three, not seven:**

- `?q=` at `/search`
- `?q=` at `/import`
- `?refused=` at `/settings`

With the bounds restored, the same walk reported nothing unbounded.

## The seven was never this file's population

It was [[0170-a-value-a-page-both-asks-with-and-quotes-is-two-values]]'s list, copied in when
CNCORE-298 built the check. That list has five entries plus `?q=` at `/search` and `/import`. The
five are `bounded` in `@canoncore/providers`, the repeat's refusal in `@canoncore/db`, the
overlong-id refusal in `@canoncore/api`, a task's detail in `@canoncore/tasks`, and `?refused=` on
`/settings`.

**The file reaches three of the seven.** The other four sit in packages that render nothing, which
the docblock's own "ANYTHING BUT `apps/web`" paragraph already said. So the paragraph arguing that a
population must be derived opened with a figure for a population its own check says it cannot see.

**And that list has no settled edge either.** ADR-0188 found this for a neighbouring population, and
it holds here for the same reason: the entries mix a FUNCTION with SENTENCES.

- "`bounded` in `@canoncore/providers`" is one entry, and `bounded` served more than one sentence,
  one of them in another package. `@canoncore/api`'s "That Provider holds no Container at"
  refusal bounded its id through `bounded` from CNCORE-166 (`9efa9e4`, 2026-09-14). CNCORE-285 moved
  it onto `theContainerIdQuoted` at `9f20f1d`. No entry in the list is that sentence.
- `/import` is one entry and prints the query in two sentences, which ADR-0170 itself counts.

Read per sentence, more than seven sites owed the bound on the day the docblock said seven
(`c757709`, after `9f20f1d`). Read per entry, the figure repeats a record's granularity rather than
describing the tree. Neither reading is the one this file derives.

## Nothing rests on the figure, so it is deleted

ADR-0188's test is whether an argument in the docblock rests on the number. If one does, the number
is derived into `tree-figures.test.ts`. If none does, it is deleted.

**"WHY A CHECK AND NOT CARE" argues from two misses, each found by a person**: `/search` by
inspection, `/import` by a reviewer. Two for two is the case for an instrument whatever the total
is. It names both misses, so its "two" enumerates the pair it names and stays.

**The ordinals were the only thing tying those misses to the figure.** They were positions in
another record's list, not in anything this file derives, so each now names its surface. "The eighth
site" becomes "the next site", because the roll call's job is to catch a site nobody has written
yet, whatever number it would be.

**The docblock says so where the figure stood**, as a decision rather than an omission, in the words
CNCORE-311 used for its six sentences. It states no replacement figure, three included. CNCORE-311's
review refused its own first draft for exactly that: a new undated count put where the old one was.
The figure lives here instead, dated.

## What this does not cover

- **"FOUR of ADR-0163's five sites are in packages that render nothing"** stays, in the same
  docblock, along with "ADR-0163's five sites" a paragraph above it. It counts a record's closed list
  rather than the tree. The paragraph it sits in confesses that an earlier draft miscounted that same
  list, and the confession needs the number. The four packages it names are still where the sites
  outside this file's reach are, by a grep for the bounding calls at `4ecd698`.
- **[[0178-a-parameter-a-page-speaks-is-reported-where-it-is-unbounded]] calls `/search` and
  `/import` the sixth and seventh sites, and its unwitnessed claim is about "an EIGHTH site".** Its
  ordinals index ADR-0163's list explicitly, as history, and its accepted block is dated at
  `9f20f1d`. They are left. The claim's substance, a site nobody has written yet, does not depend on
  the ordinal.
- **ADR-0188's bullet naming this count** said it had not been measured and that CNCORE-314 carried
  it. It is corrected in the sentence that said so.
