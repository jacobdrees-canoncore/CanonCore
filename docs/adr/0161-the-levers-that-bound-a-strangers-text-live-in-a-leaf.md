---
status: accepted
---

# The levers that bound a stranger's text live in a leaf every package can reach

> **ACCEPTED 2026-09-20, whole, in one repository.** `@canoncore/text` publishes `oneLine`,
> `shortenTo` and `boundedTo` and depends on nothing; `@canoncore/providers`, `@canoncore/db`,
> `@canoncore/tasks` and `@canoncore/api` all reach ADR-0123's two levers through it, and no
> hand-written copy of either lever survives in the tree. The repeat's refusal in
> `packages/db/src/import-runs.ts` bounds its Container id on both, with two witnesses at
> `beginImportRun` (`packages/db/src/import-runs.test.ts`). No provider repository is touched, so
> nothing is owed at a second one.

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
were.

**`shortenTo` stays published beside `boundedTo` rather than hidden behind it**, for one caller.
`shortly` in `packages/providers/src/boundary.ts` quotes a URL, a host or an address that has
already been through a parser, so there is no prose there for the strip to act on. A caller quoting
a stranger's PROSE reaches for `boundedTo`, which applies both in one call — and applying both in
one call is what stops the next caller taking half.

**IT IS NOT NAMED `cut`, AND THAT CONSTRAINT SURVIVES THE MOVE.** `CONTEXT.md` makes **Cut** a
Listing's keyset boundary, and the glossary is binding on names in code. The package is
`@canoncore/text` and the function is still `shortenTo`.

## What this costs

**A twelfth workspace package**, which is the honest price. It is one `package.json`, one
`tsconfig.json`, one `vitest.config.ts` and one source file, and the repository's own roll calls
absorbed it rather than needing to be told about it: `typecheck-wiring.test.ts` counts packages off
`pnpm-workspace.yaml`, `network-gate-wiring.test.ts` counts suites off the tree, and
`tree-figures.test.ts` went red on four stated figures that had said fifteen and eleven. Those are
ADR-0153's mechanism working, and updating them is the whole of the wiring this cost.

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
