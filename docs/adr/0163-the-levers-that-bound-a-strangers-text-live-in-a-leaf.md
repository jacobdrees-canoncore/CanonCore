---
status: accepted
---

# The levers that bound a stranger's text live in a leaf every package can reach

> **ACCEPTED 2026-09-20, whole, in one repository.** `@canoncore/text` publishes `oneLine`,
> `shortenTo` and `boundedTo` and depends on nothing. Every site that puts a stranger's PROSE in a
> sentence reaches both levers through `boundedTo`: `@canoncore/providers` (`bounded`),
> `@canoncore/db` (the repeat's refusal), `@canoncore/api` (the overlong-id refusal),
> `@canoncore/tasks` (a task's detail) and `apps/web` (`?refused=` -- **and `?q=`, which this list
> MISSED at BOTH surfaces that print one and CNCORE-291 added**: `/search` and `/import` were a
> sixth and seventh site putting a stranger's prose in this app's own sentences, reaching neither
> lever, while the sentence here said every such site reached both. Both now read the ceiling and
> both levers from `theQueryQuoted` in `apps/web/src/components/query-params.ts`. The claim was
> about the CALLERS that existed, and the sites nobody had counted are exactly the ones it could
> not see; **a count of `boundedTo`'s callers is not a count of the places that owe it**, and the
> second site was found only by a reviewer reading the diff -- nothing in the tree reports one).
> `shortenTo` has exactly one
> caller, `shortly`, whose values are parsed URLs and hosts rather than prose. No hand-written copy
> of either lever survives in the tree, checked by grepping `0xd800`, `202a` and `feff`. The
> repeat's refusal in `packages/db/src/import-runs.ts` bounds its Container id on both, with two
> witnesses at `beginImportRun` that were each checked RED against the unpatched sentence
> (`packages/db/src/import-runs.test.ts`). No provider repository is touched, so nothing is owed at
> a second one.

[[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]] bounds a stranger's text on two levers: a
CUT, answering how MUCH of a value lands in a sentence, and a CONTROL STRIP, answering what that
text may DO to the words around it. That record put both in `@canoncore/providers` and then had to
answer what the packages that cannot reach that one should do. Its answer was **write them out by
hand, and do not repair the duplication with an import**, in as many words: "the duplication is the
decision".

**It was right about the dependency it was offered.** `@canoncore/tasks` depends on
`@canoncore/db` alone; reaching `@canoncore/providers` would have taken an HTTP client, two undici
dispatchers and ADR-0034's two outbound boundaries to get at a string function. That is a real cost
and refusing it was correct.

**The option nobody put on the table is that the levers need not live there.** A package holding
them that depends on NOTHING costs a caller exactly the lines themselves. That is this record, and
it is not a reversal of ADR-0123's reasoning — it is the same reasoning applied to a third option
that record never considered.

## The hand copies drifted twice, and that is the evidence

"Keep them in step by hand" is an instruction that has to be followed by whoever arrives next, and
twice nobody did:

- **CNCORE-272** found `packages/tasks/src/registry.ts` cutting without the surrogate guard, five
  months after the cut it copied grew one. A lone surrogate reaching that UTF-8 column round-trips
  to U+FFFD — well-formed on the way back out, so nothing downstream can tell it was ever a
  character, and permanent in the history.
- **CNCORE-274** found the same copy had never taken the CONTROL STRIP at all. ADR-0123's own
  summary of the situation — "two numbers, one rule" — was true of the cut and an overclaim about
  the strip, for as long as it took somebody to check.

**And a THIRD site had the same gap at the same time.** `theRepeatIn`'s refusal interpolated a
Container id raw, on neither lever, and CNCORE-268 bounded that id at 255 characters at the router
without closing it: 255 is not 80, and no ceiling strips a control character. So the count at the
moment this record was taken was three copies and three different subsets of one mechanism.

**A copy that has drifted twice is not kept in step by a comment saying to keep it in step.** What
made each gap survive is that half a mechanism looks finished from outside — which is ADR-0123's own
sentence about itself, turned on its own remedy.

**AND A FOURTH CALLER ARRIVED WHILE THIS RECORD WAS BEING WRITTEN, WHICH IS THE STRONGEST EVIDENCE
HERE BECAUSE NOBODY ARRANGED IT.** CNCORE-262 needed the cut in `apps/web/src/app/settings/refusal.ts`
to bound the entry `/settings` echoes back out of its own address, and published `shortenTo` from
`@canoncore/providers` to get it — its own docblock saying the alternative was "a fourth
hand-maintained copy of the same five lines". It merged into `main` on 2026-09-20 while CNCORE-282
was in flight, and the two changes did not conflict: git merged an export of a file the other branch
had deleted, and only the typechecker noticed. Three tickets in one project independently concluded
that the cut has to be reachable from outside the package that happened to hold it. This record is
that conclusion taken once, at the level it belongs: `apps/web` imports from `@canoncore/text`, and
`@canoncore/providers` re-exports nothing, so there is ONE import path rather than two spellings of
the same function.

## What moves, and what does not

**The LEVERS move. The CEILINGS do not.** 80 is a fact about a value a refusal quotes back, 300 is a
fact about a reason and about a task's detail, and each stays beside the sentences it bounds. That
is ADR-0123's split kept exactly as it was: a caller names its own number and reaches for the shared
pair. `REASON_MAX_LENGTH`, `ID_IN_A_SENTENCE` in two files and `BOUNDED_DETAIL` all stay where they
were — **except `ID_IN_A_SENTENCE`, whose two copies
[[0179-a-bound-that-empties-a-value-says-so]] folded into one function on 2026-09-21.
That record needed a THIRD thing shared between the same two sites, the words for a value this
strip empties, and two copies of three things is the shape this record spent its evidence on. The
argument against it here was that a caller names its own number; what that missed is that these two
callers are not two callers, they are ADR-0160's ONE complaint a constraint apart, and the docblock
in each file said so by telling the next reader the number was "TAKEN RATHER THAN CHOSEN AGAIN" — a
copy kept in step by a comment asking for it to be kept in step, which is the instrument this record
proved does not work. `REASON_MAX_LENGTH` and `BOUNDED_DETAIL` are untouched and `@canoncore/text`
still holds no ceiling, so the rule above holds everywhere it was actually load-bearing.**

**`shortenTo` stays published beside `boundedTo` rather than hidden behind it**, for one caller.
`shortly` in `packages/providers/src/boundary.ts` quotes a URL, a host or an address that has
already been through a parser, so there is no prose there for the strip to act on. A caller quoting
a stranger's PROSE reaches for `boundedTo`, which applies both in one call — and applying both in
one call is what stops the next caller taking half.

**AND PUBLISHING THE CUT AT ALL COST SOMETHING WITHIN THE HOUR, WHICH IS WORTH WRITING DOWN RATHER
THAN DISCOVERING TWICE.** `apps/web/src/app/settings/refusal.ts` bounded `?refused=` — a value off a
forgeable address, landing in a sentence the page speaks in its own voice — with the CUT ALONE,
while its own docblock claimed the file "holds both rules, one per parameter". ADR-0160 had already
named that shape: "taking the cut alone is half a mechanism that looks finished from outside." It
was caught reviewing THIS change and is fixed here. The lesson is not to hide the cut, because
`shortly` genuinely needs it; it is that a published cut is a fork in the road, so the doc comment
beside it has to say which way a prose caller goes.

**IT IS NOT NAMED `cut`, AND THAT CONSTRAINT SURVIVES THE MOVE.** `CONTEXT.md` makes **Cut** a
Listing's keyset boundary, and the glossary is binding on names in code. The package is
`@canoncore/text` and the function is still `shortenTo`.

## What this costs

**A twelfth workspace package**, which is the honest price. It is one `package.json`, one
`tsconfig.json`, one `vitest.config.ts` and one source file, and the mechanised parts of the
repository absorbed it rather than needing to be told: `typecheck-wiring.test.ts` counts packages
off `pnpm-workspace.yaml`, turbo, biome and `ci.yml` are glob-driven, and `tree-figures.test.ts`
went red on four stated figures that had said fifteen and fourteen. That last is ADR-0153's
mechanism working.

**BUT NOT EVERY STALE FIGURE WAS CAUGHT, AND CLAIMING OTHERWISE WOULD BE THE OVERCLAIM ADR-0153
EXISTS TO STOP.** The package counts in `typecheck-wiring.test.ts` and in ADR-0103 — "ELEVEN
packages", "TEN of the eleven" — are PROSE with no entry in `tree-figures.test.ts`'s claims table,
so nothing went red and they were corrected here by hand after a reviewer found them. A figure that
only a reader can catch is exactly the shape that record refuses. Adding the package count to the
claims table is **CNCORE-286**.

**Set against three copies of five lines that drifted twice in one project**, and a fourth owed the
next time a package puts a stranger's value in a sentence. The trade is one leaf against a rule
nobody can enforce.

## What it does not claim

**It does not say `@canoncore/db` may now depend on `@canoncore/providers`.** It may not, and
nothing here changes that: `RefusalReason` is still declared in `import-runs.ts` rather than
imported, for the reason that file gives. What moved is a string function, to a package that is not
the provider stack.

**It does not promise a grapheme cluster.** `shortenTo` cuts on a whole CODE POINT, which is the
smaller promise ADR-0123 makes and the one actually kept. A ZWJ sequence, a flag's two regional
indicators or a base and its combining mark can still be parted. Both halves remain valid characters
that render as themselves, where a lone surrogate is not a character at all — which is what makes it
alone worth a guard.
