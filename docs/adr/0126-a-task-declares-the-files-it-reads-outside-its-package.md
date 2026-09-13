---
status: proposed
---

# A task declares the files it reads outside its package

`turbo` hashes a task against the files of its OWN package and nothing else. Several suites here
read files at the repository ROOT — `glossary.test.ts` reads `CONTEXT.md`, `install-path.test.ts`
reads the `README`, the `Dockerfile`, `compose.yaml`, `.env.example` and `ci.yml` — and each of them
was therefore **cached against everything except the thing it checks**. Editing the checked file did
not invalidate the task, so the suite replayed a stale pass and only a cold cache ran it for real.

**THE FAILURE POINTS THE WRONG WAY**, which is what makes it a record rather than a commit message.
CNCORE-101 added an `_Avoid_` entry banning `health`, colliding with `healthCheckResult` on the read
path. `pnpm test` passed locally across ten tasks; CI failed. The difference was the cache, not the
code — so a green suite certified a rule it had not read, and the person best placed to fix the name
was the one who never saw it fail. Measured before the fix: appending a line to `CONTEXT.md` left
`@canoncore/schemas#test` on hash `68c4f053449da0a2`, unmoved.

## The task names the file, in that package's own `turbo.json`

`"inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/CONTEXT.md"]`. `$TURBO_ROOT$` is turbo's own instruction
for an input outside the package and has been since 2.5; a relative `../../` climb resolves against
the package and is documented as the wrong spelling. `$TURBO_DEFAULT$` is not optional garnish: an
`inputs` list REPLACES the package's default file set rather than adding to it, so omitting it would
trade one wrong cache key for another.

**`globalDependencies` WAS REFUSED**, and it is the obvious one-line fix, which is why the reason
matters. It asserts that every task in the repository depends on the glossary. That is false — the
db suite does not read it — and it would rebuild the world on each domain-model edit, in a repo where
the domain model is edited often. Declaring it per task keeps the statement true: measured, a
glossary edit now misses 3 of the 11 planned test tasks, `@canoncore/schemas` plus the two that
depend on it through `dependsOn: ["^test"]`.

**`cache: false` WAS ALSO REFUSED**, though `packages/config` uses exactly that. Its own comment
gives the reason it can: its suites ask whether the linter reaches every file git tracks, so their
real inputs ARE the whole repository and cannot be enumerated. `packages/schemas` reads exactly one
extra file and `packages/env` five, all enumerable, so the precedent's reasoning does not transfer —
only its shape would, and copying a shape without its reason is how a repo acquires rules nobody can
defend.

## The guard asks `turbo`, not `turbo.json`

`packages/config/src/turbo-cache-inputs.test.ts` runs `turbo run test --dry=json` and asserts the
file appears among the task's REAL inputs, carrying the hash git holds for it. Content, not merely a
path: what makes a warm cache miss is the file's own bytes inside the key.

Reading the `inputs` entry back out of the config file would restate the fix in a second language —
what [[0124-the-glossary-is-checked-where-the-read-path-names-its-fields]] already refuses for the
`_Avoid_` lists — and it would pass by construction wherever it was wrong. **An unmatched glob is
dropped SILENTLY**: `$TURBO_ROOT$/CONTEXT.MD` reads fine, matches nothing, and caches exactly as
badly as no entry at all. Measured on 2026-09-13: turbo emits no warning for it, and only the dry run
knows. `repo-root.test.ts` checks its depth against git on the same argument.

**IT LIVES IN `packages/config`, WHICH IS UNCACHED**, so the guard can never itself be served from
the cache it is checking.

## Which packages belong on the list is RECOMPUTED, not remembered

A hand-kept list goes stale the day a new suite reads a root file, and that suite would be cached
against everything except the file it checks with nothing to say so. So the guard walks the tracked
sources, resolves each relative specifier the way the runtime would and asks whether it landed
outside the package, and propagates reach to importers — `repo-root.ts` is the only file that climbs
to the root, and every suite reaching a root file does it by importing that constant rather than by
climbing itself, so a
walk reading climbs alone would report one reaching file and no reaching suites. A package it finds
that is on neither list fails the check.

**ONLY A RELATIVE SPECIFIER COUNTS AS A PATH**, and that line was drawn twice, both times by the
guard arguing with legitimate code rather than by foresight. First a comment EXPLAINING the rule,
using `../../../` as its example, reported the file it was written in as reaching outside. Then a
string merely containing `../` was read as a path: `credential.test.ts` asserts on the URL
`"/..//evil.test"` to prove a traversal is refused, and because that string is absolute, resolving it
discarded everything before it and landed outside the package — reporting `@canoncore/providers`,
which reaches nothing.

Both fixes NARROWED WHAT THE GUARD READS rather than widening the allowance, and the difference
matters: an allowance entry would have parked a false positive where a later reader takes it for a
real one. A path a file reaches through opens `./` or `../`; a URL, a regex and a traversal fixture
do not. The cost is a genuine `new URL("foo/../../bar")` — no `./`, still a path — going unseen.
That is the trade taken knowingly: a guard that fires on a security fixture is one somebody deletes.

**AND ONLY CI COULD HAVE CAUGHT THE SECOND ONE.** A `pull_request` workflow builds
`refs/pull/N/merge`, so it tested this branch against a main that had moved thirty commits and
carried the fixture. Every local run passed. That is the same shape as the defect this record is
about — a check that agrees with whatever it happens to read — arriving one level up.

It answers "does this PACKAGE belong on a list", never "is that list complete": which files a suite
goes on to open is not visible from outside it. That limit is why the lists name files by hand and
this names only packages.

## As built, under CNCORE-132 — and this record stays PROPOSED

**BUILT: both live instances, and the guard.** `packages/schemas` and `packages/env` declare what
they read; the guard asserts content-level inputs for both, recomputes the package set, and asserts
that `packages/config` really is uncached where that is the excuse given.

**NOT BUILT: every task that is not `test`.** The guard reads the `test` task alone. `build` and
`typecheck` are hashed the same way and could carry the same defect; nothing here would report it.
It is left undone rather than guessed at because no instance is known — `next.config.ts` names the
workspace root as a directory to trace from and opens no file — and a guard written against a
hypothetical is one whose first real failure is a false one.

**NOT BUILT: a suite that reads a root file it never names in source.** The walk sees climbs and
imports, so a path assembled at run time from parts, or read through a helper this repo does not
publish, is invisible to it. The file lists above are hand-kept for that reason and are the part a
reviewer still has to hold.
