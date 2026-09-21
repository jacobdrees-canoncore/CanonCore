---
status: accepted
---

# A count nobody routes by is deleted rather than derived

> **ACCEPTED 2026-09-21, whole, in one repository.** Six sentences stated how many sites owe
> [[0179-a-bound-that-empties-a-value-says-so]]'s phrase, and none of them states a number now:
> `UNSHOWABLE`'s and `unshowable`'s docblocks in `packages/text/src/index.ts`, plus the
> restatements in `packages/db/src/import-runs.ts`, `apps/web/src/components/query-params.ts`,
> `packages/tasks/src/registry.ts` and `packages/text/src/index.test.ts`. Each now carries the
> CRITERION it was really written to give — which callers share the phrase, and which fork of
> `quotedTo` versus `unshowable` a caller takes — and the two `TODO(CNCORE-311)`s are gone. The
> population was READ rather than grepped, with the `bounded` / `boundedProse` / `boundedOr`
> wrapper route walked as well as the direct one; that read is below. No mechanism is added, which
> is this record's actual decision and is argued rather than assumed. No provider repository is
> touched, so nothing is owed at a second one.

[[0153-a-figure-about-this-tree-is-derived-or-dated]] gives a figure this repository states about
itself two lawful forms: DERIVED, held to the tree by a check in
`packages/config/src/tree-figures.test.ts`, or DATED, carrying the population it was counted over
and the query that would take it again. **There is a third answer that record already used once and
did not generalise, and this is it: do not state the figure.**

## The count was wrong three times, and each time for a different reason

ADR-0179 grepped `boundedTo`, found five, and wrote "five". A reviewer found a sixth reaching the
levers through `bounded`, the wrapper `@canoncore/providers` publishes for a reason's 300 — so the
record corrected itself to "SIX sites in four packages". CNCORE-305 then added three sentences
reaching `unshowable` in `@canoncore/providers`, a package absent from those four, and CNCORE-308
added a fourth there. ADR-0179's own acceptance block says so; the code it describes never did, and
`@canoncore/db` and `apps/web` went on restating "six across four packages" and "five sites" beside
each other.

**Three misses is not carelessness, it is the figure being unowned.** Nothing reported any of them.
Each sentence was true the day it was written, which is [[0153-a-figure-about-this-tree-is-derived-or-dated]]'s
description of this repository's commonest defect.

## The read, which is what this record is evidence of

Taken 2026-09-21 at `355c2db`, by reading each call site rather than matching a name.

**Six direct callers of `unshowable`**, in four files and three packages: `UNSHOWABLE_ENTRY`
(`apps/web/src/app/settings/refusal.ts`), `UNSHOWABLE_BODY` (`packages/providers/src/client.ts`),
`UNSHOWABLE_NAME` and `UNSHOWABLE_LABEL` (`packages/providers/src/cmpp.ts`), `UNSHOWABLE_REASON`
(`packages/providers/src/reason.ts`) and `UNSHOWABLE_DETAIL` (`packages/tasks/src/registry.ts`).
`quotedTo` calls it a seventh time inside the leaf itself.

**Four callers of `quotedTo`**: `theEntryRefused`, `theQueryQuoted`, `theContainerIdQuoted` and
`@canoncore/tasks`' own `bounded`.

**Eleven surfaces can print the phrase**, because two of those four serve more than one: the
repeat's refusal, the overlong-id refusal and the "holds no Container at" refusal; `/search`'s and
`/import`'s query; `/settings`' entry; a task's detail; and a provider's reason, name, credential
label and failure body. **Five packages, not four.**

**The wrapper route was walked and one exclusion still holds.**
`packages/api/src/routers/provider.ts`'s `BrowseNotOffered` branch bounds fixed prose that cannot
empty, so it owes nothing — ADR-0179's reading, re-read here rather than inherited. `failed()` in
`client.ts` is no longer an exclusion: [[0186-a-failure-body-nobody-can-show-is-reported-rather-than-omitted]]
gave it a third branch.

## Why not derived

**Because "sites that owe these words" has no settled edge.** Six, four and eleven above are all
honest readings of the same sentence, and ADR-0179's "six" was a fourth — a list whose bullets
merged `/search` with `/import` and separated the two id refusals. A derivation has to pick one
reading. Picking one would not make the sentence true; it would make it precise about a question no
reader is asking, and the check would then hold the prose to an arbitrary choice for ever.

**And the thing a derivation could count is the thing ADR-0179 proved is the wrong population.**
`packages/config/src/bounded-parameters.test.ts` says it in its own words: *a count of `boundedTo`'s
callers is a count of the sites that ANSWER the rule and never of the sites that OWE it.* A row in
`tree-figures.test.ts` counting `unshowable(` call sites would be exactly that count — the one that
has never once caught a miss, because every miss so far was a site that had not called anything.

## Why not dated either

A date is honest, and ADR-0179 already carries one: its six is labelled as that record's own sweep
rather than a standing total, which is why the RECORD is right where the code was wrong. **What a
date cannot do is make a docblock worth the maintenance.** Dating "six sites, as at 2026-09-21" in
five source files means five sentences to revisit whenever a seventh caller lands, guarded by
nothing, for a figure no argument rests on.

## What the sentences were actually for

**`UNSHOWABLE`'s argument needs plurality, not a number.** It says the phrase lives in one place
because every caller composing its own `boundedTo(...) || "..."` would ship one concept in many
voices. That argument turns on there being MORE THAN ONE caller. Six versus ten changes nothing
about it.

**`unshowable`'s argument is a fork sign, and a number routes nobody.** "PUBLISHED BESIDE `quotedTo`
FOR ONE CALLER" named `@canoncore/tasks` as the only caller whose value IS the sentence a reader
reads. A reader arriving at that fork needs to know WHICH HALF OF THE SENTENCE THEY OWN — the whole
thing, so they want `unshowable` and a full stop; or a noun inside a sentence they wrote, so they
want `quotedTo`. The count told them how many others went each way, which is not the question.

## Deletion is a stronger answer to drift than derivation

A stated figure held by a check cannot drift silently. **A figure that is not stated cannot drift at
all**, and costs no rung. So where an argument does not rest on a number, removing it beats holding
it — and `tree-figures.test.ts` stays pointed at the figures something genuinely reads.
[[0153-a-figure-about-this-tree-is-derived-or-dated]] reached the same place once, for the suites
needing the loopback carve-out: *that figure is now a phrase rather than a number, which is the
honest answer when nothing derives it.* This record generalises that from one population to a rule.

## What IS worth reporting, and already is

**Coverage, not population size.** The defect that actually hurts is a surface that owes the phrase
and does not reach it, and [[0178-a-parameter-a-page-speaks-is-reported-where-it-is-unbounded]]
built the instrument for it: `bounded-parameters.test.ts` reads every `.tsx` under `apps/web/src`,
follows each value taken off `searchParams`, and names the FILE and the PARAMETER wherever one
reaches a sentence unbounded. That is a check on the sites that OWE. **It is also the whole of what
this tree has**, and its population is web surfaces reading an address — so the phrase's coverage in
`@canoncore/providers`, `@canoncore/db`, `@canoncore/api` and `@canoncore/tasks` is still held by
reading alone. ADR-0179 said as much and was wrong by one when it said it. Nothing here improves
that, and this record does not pretend to.

## A count that names a closed set it owns is not this defect

`client.ts`'s "the four sentences stay one concept by sharing the words after the noun" counts the
four fallbacks in `@canoncore/providers`, names each of them in the same docblock, and is true. That
is a local enumeration a file can see all of, not a claim about the tree, and it is left standing.
**The rule is about a figure counting a population the sentence cannot see**, which is what every
one of the six removed here did.

## What this does not cover

**It is a rule with no instrument, and that is deliberate.** Nothing stops the next agent writing a
fresh count into a docblock; this record is an argument a reviewer can cite, not a check. Building
one would mean deciding which numbers in English are claims about this tree, which
[[0153-a-figure-about-this-tree-is-derived-or-dated]] already declined as not a problem a regular
expression settles.

**One count of the same class is left standing and named here rather than fixed.**
`bounded-parameters.test.ts`'s own docblock opens "Seven sites in this tree owe that bound" — a
figure about a DIFFERENT population (sites owing ADR-0123's levers, not ADR-0179's phrase), in the
file whose argument is that a count is not a check. It was not measured under this ticket, so
whether it is currently right is unknown. CNCORE-314 carries it.

**The phrase itself is spelled once and this record did not change that.** `packages/text/src/index.ts`
holds the only production copy; every other occurrence in the tree is a test pinning the wording,
which is the witness [[0176-saying-nothing-and-saying-nothing-showable-are-two-sentences]] and
ADR-0179 describe.
