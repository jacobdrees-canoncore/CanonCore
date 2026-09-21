---
status: accepted
---

# A count nobody routes by is deleted rather than derived

> **ACCEPTED 2026-09-21, whole, for the population it names.** Six sentences stated how many sites
> owe [[0179-a-bound-that-empties-a-value-says-so]]'s phrase, and none of them states a number now:
> `UNSHOWABLE`'s and `unshowable`'s docblocks in `packages/text/src/index.ts`, and the restatements
> in `packages/db/src/import-runs.ts`, `apps/web/src/components/query-params.ts`,
> `packages/tasks/src/registry.ts` and `packages/text/src/index.test.ts`. Each now gives the reason
> it was written for, and the two `TODO(CNCORE-311)`s are gone. The population was READ rather than
> grepped, with the `bounded` / `boundedProse` / `boundedOr` wrapper route walked as well as the
> direct one. **This decides those six sentences and does not sweep the tree** for other counts:
> "What this does not cover" names the ones met on the way. No mechanism is added, which is the
> decision and is argued below. No provider repository is touched, so nothing is owed at a second one.

[[0153-a-figure-about-this-tree-is-derived-or-dated]] gives a figure this repository states about
itself two lawful forms: DERIVED, held to the tree by `packages/config/src/tree-figures.test.ts`, or
DATED, carrying its population and the query that would take it again. It also used a third answer
once, for a figure that could not be derived: *that figure is now a phrase rather than a number,
which is the honest answer when nothing derives it.* **This record takes that third answer for two
counts, one of which COULD have been derived.**

## The count was wrong three times

ADR-0179 grepped `boundedTo`, found five and wrote "five". A reviewer found a sixth reaching the
levers through `bounded`, so it became "SIX sites in four packages". CNCORE-305 then added three
sentences reaching `unshowable` in `@canoncore/providers`, a fifth package, which ADR-0179's
acceptance block records. CNCORE-308 added a fourth there, which ADR-0179's "What this does not
cover" and [[0176-saying-nothing-and-saying-nothing-showable-are-two-sentences]] record. The source
never followed either: at `main`, `@canoncore/db` said "six across four packages" beside
`apps/web`'s "five sites".

## The read

Taken 2026-09-21 at `355c2db`, and re-checked at `59fc909` after a rebase that touched none of
these files.

**Six direct callers of `unshowable`, in five files and three packages:** `UNSHOWABLE_ENTRY`
(`apps/web/src/app/settings/refusal.ts`), `UNSHOWABLE_BODY` (`packages/providers/src/client.ts`),
`UNSHOWABLE_NAME` and `UNSHOWABLE_LABEL` (`packages/providers/src/cmpp.ts`), `UNSHOWABLE_REASON`
(`packages/providers/src/reason.ts`) and `UNSHOWABLE_DETAIL` (`packages/tasks/src/registry.ts`).
`quotedTo` calls it a seventh time, inside the leaf.

**Four callers of `quotedTo`:** `theEntryRefused`, `theQueryQuoted`, `theContainerIdQuoted` and
`@canoncore/tasks`' own `bounded`.

**Eleven surfaces can print the phrase, in five packages**, because two of those four serve more than
one surface: the repeat's, overlong-id and "holds no Container at" refusals; `/search`'s and
`/import`'s query; `/settings`' entry; a task's detail; and a provider's reason, name, credential
label and failure body.

**One wrapper exclusion still holds.** `packages/api/src/routers/provider.ts`'s `BrowseNotOffered`
branch bounds fixed prose that cannot empty, so it owes nothing. That was re-read here rather than
taken from ADR-0179. `failed` in `client.ts` is no longer an exclusion, since
[[0186-a-failure-body-nobody-can-show-is-reported-rather-than-omitted]] gave it a third branch.

## Two counts, and only one of them could be derived

**`UNSHOWABLE`'s count, of the sites that owe the phrase, has no settled edge.** Six, four and eleven
above are all honest readings of "sites that owe these words", and ADR-0179's "six" was a fourth: a
list whose bullets merged `/search` with `/import` and split the two id refusals. A derivation has
to pick one reading, and picking one makes the sentence precise about a question nobody asks. The
one population a check could count, call sites, is the wrong one for this sentence.
`bounded-parameters.test.ts` says why in its own words: *a count of `boundedTo`'s callers is a count
of the sites that ANSWER the rule and never of the sites that OWE it.*

**`unshowable`'s count, of its direct callers, has a settled edge.** Six call sites is a fact on
disk, and `tree-figures.test.ts` could hold it in one row. **It is left out anyway, because no
argument rests on it.** Being derivable does not oblige a sentence to state a figure: ADR-0153
governs the figures that ARE stated. It does not require stating every figure that could be.

## What the two sentences were for

**`UNSHOWABLE`'s argument needs plurality, not a number.** The phrase lives in one place because
callers composing their own `boundedTo(...) || "..."` would ship one concept in many voices. That
holds once there is more than one caller, and how many more changes nothing.

**`unshowable`'s argument is a fork sign, and its true criterion is not a count.** `quotedTo` bounds
a value and falls back to the phrase in one call, which is what a caller interpolating a value into
its own sentence wants. A caller reaches `unshowable` instead when it needs the phrase WITHOUT that
bound. That happens in one of two ways:

- **It recognises `quotedTo`'s fallback.** `UNSHOWABLE_ENTRY` is compared against what
  `theEntryRefused` returned, so the page can render it plainly, and `UNSHOWABLE_DETAIL` is compared
  before a full stop is added.
- **It bounds on a path of its own.** The four in `@canoncore/providers` bound through `bounded` and
  the wrappers built on it, and ask `holdsUnshowable` themselves.

That criterion routes all six callers. How many took each branch routes nobody.

## The first draft of this record had the criterion wrong

It said `unshowable` was "for the caller that owns the whole sentence", which needs a capital and a
full stop. Code review refuted that against the six callers:
- `UNSHOWABLE_BODY` is a clause `failed` finishes, and has no stop.
- `UNSHOWABLE_NAME` stands in for a name, and has no stop.
- `UNSHOWABLE_ENTRY` is compared against rather than printed as a sentence.

That criterion described `@canoncore/tasks`, the first caller, and was then generalised to five
callers it did not fit. **Deleting a count had nearly swapped a false figure for a false criterion.**
The docblock and the section above carry the corrected criterion. Punctuation is each caller's own,
like the noun and the frame, and never decided which way a caller goes. This is recorded because a
wrong reason for a right conclusion is what survives into the next record that cites it, which is
ADR-0179's lesson about its own refuted `shortenTo` paragraph.

## Deletion is a stronger answer to drift than derivation

A figure held by a check cannot drift without the check failing. **A figure that is not stated cannot
drift at all**, and it costs no row. So where no argument rests on a number, removing it beats
holding it, and `tree-figures.test.ts` stays pointed at figures something genuinely reads. That is
why neither count went into it, including the one that could have. A figure an argument does rest on
still belongs there. Many do, such as `apps/web/src/answer.ts`'s count of call sites, already held
in that table.

## What IS worth reporting, and already partly is

**Coverage, not population size.** The defect that actually hurts is a surface that owes the phrase
and does not reach it. [[0178-a-parameter-a-page-speaks-is-reported-where-it-is-unbounded]] built
that instrument: `bounded-parameters.test.ts` reads every `.tsx` under `apps/web/src`, follows each
value taken off `searchParams`, and names the FILE and the PARAMETER wherever one reaches a sentence
unbounded.
- **That is the whole of it.** Its population is web surfaces reading an address, so the phrase's
  coverage in `@canoncore/providers`, `@canoncore/db`, `@canoncore/api` and `@canoncore/tasks` is
  held by reading alone.
- ADR-0179 said as much, and was wrong by one when it said it. Nothing here improves that.

## What this does not cover

**It is a decision about six sentences, not a rule with an instrument.** Nothing stops the next agent
writing a fresh count into a docblock. This record is an argument a reviewer can cite. Checking prose
for counts would mean deciding which numbers in English are claims about this tree, which
[[0153-a-figure-about-this-tree-is-derived-or-dated]] already declined as not a problem a regular
expression settles.

**Three counts of the same kind were met on the way and left to other passes, each named rather
than fixed here:**

- **`bounded-parameters.test.ts`: "Seven sites in this tree owe that bound".**
  - It counts a DIFFERENT population: the sites owing ADR-0123's levers, not ADR-0179's phrase.
  - It sits in the file whose argument is that a count is not a check.
  - It was not measured here. CNCORE-314 then measured it: the file derives three, and the seven
    was [[0170-a-value-a-page-both-asks-with-and-quotes-is-two-values]]'s list copied in. It is
    deleted, by this record's test
    ([[0194-a-count-copied-from-a-record-is-not-the-population-a-check-derives]]).
- **`client.ts`: "the four sentences stay one concept".**
  - The count was true, but the four span three files, so it was the kind this record describes.
  - The same docblock's "NO FULL STOP, UNLIKE THE OTHER THREE" was FALSE, because `UNSHOWABLE_NAME`
    has no stop either. That is a claim about punctuation, a different reason to change the same
    sentence, so it was a separate pass.
  - CNCORE-315 took both, and neither stands now. The figure is deleted by this record's test, and
    the stop is argued from the clause's own slot
    ([[0193-a-fallback-is-punctuated-for-its-slot-and-argued-from-it]]).
- **`holdsUnshowable`'s docblock in `packages/text/src/index.ts`: "ALL THREE CALLERS ASK IT".**
  - It counts a different population again: `holdsUnshowable`'s callers.
  - It is true today: `quotedTo`, `boundedOr` and `failed`.
  - CNCORE-311 explicitly left it to CNCORE-308, which had just corrected it.
  - What the argument rests on is "every caller asks only once the bound came back empty", with
    the list as evidence. By this record's test the number could go and the list stay. That is
    left to whoever next changes the sentence, not done over the scope the ticket drew.

**The phrase itself is spelled once, and this record did not change that.**
`packages/text/src/index.ts` holds the only production copy. Every other occurrence in the tree is
a test pinning the wording.
