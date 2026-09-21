---
status: accepted
---

# The prose corpus is named once, and `.claude/` is prose

**The prose this repository's sweeps read is named in ONE place: `proseIn` in
`packages/config/src/testing/markdown-corpus.ts`, which is every markdown document under `docs/` and
`.claude/`, plus the root's own.** `adr-citations.test.ts`, `doc-line-citations.test.ts` and
`terminal-send-hazards.test.ts` read it and none of them spells a directory list any more. **Every
markdown document git tracks is in that corpus or is named in `NOT_PROSE` beside it, with its
reason**, and `testing/markdown-corpus.test.ts` holds the two against `git ls-files`, so a new
directory of prose is decided rather than excused. Built whole under CNCORE-313. The standing guard
and the named exclusion were the dispatcher's call on 2026-09-21, not the Owner's.

## Three copies had diverged, and the ones that left `.claude/` out excused it

Each of the three suites built "every markdown document under a directory, plus the root's own" for
itself. `markdown-corpus.ts` had already ended that duplication one level down, at the walk, under
CNCORE-259; the list of directories above the walk was still copied per suite, and the copies
disagreed. `terminal-send-hazards.test.ts`, the newest (CNCORE-306), swept `docs/`, `.claude/` and
the root. The two older suites swept `docs/` and the root.

**THE DIVERGENCE IS THE FINDING, NOT THE TIDINESS.** `doc-line-citations.test.ts` builds its `held`
set from its corpus, and a citation whose target is missing from `held` reads as HISTORY, the
exemption `docs/research/README.md` earns for files this tree no longer holds. So that suite did not
merely leave `.claude/` unswept: a line citation INTO it was affirmatively excused. That is the
silence [[0103-tests-bite-at-package-exports-and-the-router]] removed for a symlinked document under
"A symlinked markdown document has lines on disk and none in git", one level up. Nothing reported
it, because each suite agreed with itself.

**MEASURED BY MUTATION, ON BOTH SIDES.** Four defects were planted and the three suites run against
them twice: on `main` at `59fc909`, where each suite kept its own list, and on this branch. They are
described here rather than quoted, since this record is inside the corpus that would catch them.

| Planted | On `main` | Through `proseIn` |
| --- | --- | --- |
| `docs/demo.md` cites a line of `.claude/rules/workflows.md` | passes: excused as history | red in `doc-line-citations` |
| `.claude/rules/workflows.md` cites a line of `CLAUDE.md` | passes: never read | red in `doc-line-citations` |
| `.claude/rules/docs.md` cites a record number no record holds | passes: never read | red in `adr-citations` |
| `.claude/rules/frontend.md` links record 0175 by a slug it never carried | passes: never read | red in `adr-citations` |

On `main` all 22 tests in the three files passed over the four. Here the same run was
`3 failed | 19 passed (22)`, each failure naming its planted line. **The control**: dropping
`.claude` from the reader's list with the four still planted turns the three suites green again,
and what goes red instead is the reader's own rows (below).

## Why `.claude/` is in

It holds the rules and skills an agent reads as instructions. They are written and edited here like
anything under `docs/`, so their lines move under an edit, and they cite records by number and by
slug. Nothing about them earns the history exemption: they are not research, and nobody reads them
for what was known on an earlier date. `CLAUDE.md` itself sends its reader to
`.claude/rules/workflows.md`.

**ADDING IT CHANGED NO VERDICT TODAY, which was checked rather than assumed.** No line citation
anywhere points into `.claude/`. None of its eight documents shares a basename with one under
`docs/` or at the root, and that one mattered: `byBasename` drops a name two documents share, so a
collision would have made `doc-line-citations` NARROWER by gaining a file. Every record number
`.claude/` cites is one the tree holds, and its one wiki link names its record's real slug.
`doc-line-citations` and `adr-citations` each read 241 documents where they read 233;
`terminal-send-hazards` reads the same 241 it did.

**WHAT IT DOES NOT HOLD.** Three of the eight are named `SKILL.md`, so a bare `SKILL.md` citation
by line written outside the skill's own directory is ambiguous, is dropped by `byBasename`, and is
excused as history. That is the existing rule for a shared basename, not a new one, and it is
stated here rather than changed. And `.claude/rules/docs.md` still loads its cite-by-section rule
for `docs/**` only, so an agent editing a skill meets the rule at the build rather than in its
context.

## Why this is not the question ADR-0171 leaves with the caller

[[0171-the-fold-is-of-the-read-not-of-the-question-it-answers]] folds the mechanism and leaves "the
pathspec, the projection, and each caller's own guard" with the caller. The directory list reads
like a pathspec, so the fold needs its reason stated. **A pathspec stays with the caller when the
callers want different populations. These three wanted the same one**, "the prose this repository
holds", and none of them argued for its own list: `adr-citations.test.ts` took its scope as
"`doc-line-citations.test.ts`'s established scope", and `terminal-send-hazards.test.ts` added
`.claude/` because the sentences it polices live there. A difference nobody chose is drift, not a
question. **The projection and the guard stayed where ADR-0171 puts them**:
`terminal-send-hazards` still cuts each document into blocks of sentences, and each suite still
asserts its own population is not empty.

The reader returns paths relative to the root it is given, and sorted, because two of the three
copies sorted and POSIX leaves `readdir`'s order unspecified. `adr-citations` had been joining
`repoRoot` on and slicing it back off to report, and it now does neither.

## The standing guard, and the named exclusion

**One reader ends today's divergence by construction. What reopens it is a new directory of prose
nobody told the reader about**, excused by `doc-line-citations` exactly as `.claude/` was. So the
list is held against git, which owns "what markdown exists": `testing/markdown-corpus.test.ts` asks
`git ls-files` for every tracked `*.md` and requires what falls outside `proseIn` to be exactly
`NOT_PROSE`. That comparison works in both directions. A document outside both fails, and so does an
exclusion that stops matching, since a renamed file would otherwise leave `NOT_PROSE` excusing a
path nothing holds.

**`apps/web/AGENTS.md` is the one entry, NAMED WITH ITS REASON rather than missed by a pattern.**
`next dev` writes it and re-adds it, as its own text says, so a rule these sweeps enforce could
demand an edit the next `next dev` reverts. A directory list that happened to miss it would miss a
second generated file the same way, which is the dispatcher's reason for naming it. Its directory
could not be named instead in any case. Measured on this branch on 2026-09-21, a recursive
`markdownIn` over `apps/` throws, refusing 33 symlinked directories, every one of them pnpm's under
`apps/web/node_modules`.

## The reader's rows, and what each mutation reddens

`markdownIn`'s own rows moved with it. ADR-0103 kept them in `doc-line-citations.test.ts` "because
only this sweep lists markdown this way", and that stopped being true at CNCORE-259. They now sit in
`testing/markdown-corpus.test.ts` beside the new rows, unchanged but for two phrases that said "this
sweep". The new rows were each driven red before their code existed. Each mutation of the finished
reader reddens only the rows written for it:

* **`.claude` dropped from the list** reddens the `.claude/` row, the order row, and the standing
  guard, which names all eight `.claude/` documents.
* **The root's own documents dropped** reddens the root row, the order row, and the standing guard,
  which names `CLAUDE.md`, `CONTEXT.md` and `README.md`.
* **The sort dropped** reddens the order row, alone.
* **`NOT_PROSE` emptied** reddens the standing guard alone, naming `apps/web/AGENTS.md`.
* **`NOT_PROSE` misspelt** reddens the standing guard alone, in both directions at once.
* **A `NOTES.md` under `packages/ui/`, added to git's index** (`git add -N`), the new directory
  nobody told the reader about, reddens the standing guard, alone.
