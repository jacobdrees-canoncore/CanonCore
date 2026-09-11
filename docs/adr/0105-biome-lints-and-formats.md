---
status: accepted
---

# Biome is both the linter and the formatter

One binary, one config file, checked in CI by `pnpm lint`. ESLint plus Prettier was the alternative
and was measured rather than dismissed.

## The formatting case is the one that bites; the linting case is weak here, and that is the point

TypeScript already does the correctness work. `strict`, `noUncheckedIndexedAccess`,
`verbatimModuleSyntax`, `noUnusedLocals` and `noFallthroughCasesInSwitch` are all on, and
[[0103-tests-bite-at-package-exports-and-the-router]] describes how `packages/config` asserts they
stay on. A linter chosen for its rule catalogue would be buying something this repo largely has.

What it does not have is agreement about whitespace. The default build mode is dispatch from the
main worktree — several child worktrees writing at once, meeting at merge — so every agent
formatting to its own taste arrives as a conflict hunk in a file nobody meaningfully changed. That
cost scales with the number of worktrees in flight. So the tool was chosen on the formatter, and the
linter is what comes with it.

That ordering is why the larger rule ecosystem, which is ESLint's real advantage, did not decide it.

## What was measured, on 2026-09-10

Versions from the npm registry that morning: `@biomejs/biome` 2.5.13 (published that same day, on a
weekly cadence since 2.5.6 in July), `eslint` 10.10.0, `prettier` 3.9.6, `oxlint` 1.82.0.

**The catalogue pins `^2.5.12`, not `^2.5.13`, and that is the interesting part.** pnpm has defaulted
`minimumReleaseAge` to 1440 minutes since v11, so this repo already carries a 24-hour supply-chain
cooldown on every dependency. 2.5.13 was hours old. Taking it made `pnpm add` write a nine-entry
`minimumReleaseAgeExclude` block into `pnpm-workspace.yaml` — which waives that cooldown for exactly
the case it exists to catch, a package published minutes ago, and writes the version nine more times
in the file [[0101-the-catalogue-is-the-only-place-a-version-is-written]] reserves for writing it
once. Both were reverted. `^2.5.12` clears the cooldown on its own and picks up 2.5.13 the moment it
ages out, so nothing is pinned back and nothing is waived. A patch release is not worth spending a
supply-chain guard on.

**Install footprint, counted rather than estimated.** Biome installs 2 packages: the JS shim and one
platform binary, the other seven platform binaries being optional dependencies that do not resolve
here. A realistic ESLint stack for this repo — `eslint`, `prettier`, `typescript-eslint`,
`eslint-config-prettier`, `eslint-plugin-react-hooks`, `@next/eslint-plugin-next` — installs 106.

**Both fail when they lint nothing, so that acceptance criterion did not separate them.** Verified by
running each against an empty directory: `biome check` and `biome ci` exit 1 with "No files were
processed in the specified paths", `eslint` exits 2, `prettier --check` exits 2. This is worth
stating plainly because it was expected to be the deciding test and was not. What it does settle is
that the Lint job needs no "did anything actually run?" guard of the kind the Test job carries: that
guard exists because `turbo run test` exits 0 having run zero tasks, and Biome does the opposite.

**`next lint` is gone, so ESLint would have been a standalone setup either way.** Next.js 16 removed
the command, and `next build` no longer runs ESLint. Any lint coverage that used to ride on the
build is now zero unless a separate step exists. This removes the one integration advantage ESLint
had in a Next.js repo.

**oxlint is not a candidate for this ticket.** It is a linter only, so satisfying a ticket that asks
for a formatter too would mean pairing it with Prettier, which is two tools again without ESLint's
rule ecosystem to show for it.

**Biome does not process Markdown at 2.5.12, and here that is a feature.** Verified by running it:
`biome check` against a `.md` file reports "No files were processed", and `--write` leaves it byte
for byte. This repo is mostly hand-wrapped prose — `docs/adr/` and `CLAUDE.md` — and a formatter
with an opinion about it would have been a reason to reject the tool rather than a bonus.

`create-better-t-stack` offering Biome as its linting addon is mentioned on the ticket and is
deliberately given no weight. [[0053-scaffold-once-then-own-the-output]] says never to depend on the
generator again, which applies to its preferences as much as to its code.

## The settings that depart from Biome's defaults

Each is in `biome.jsonc` with its reason beside it; the file is `.jsonc` precisely so it can carry
them. In short: spaces rather than Biome's default tabs, because every file in the tree already uses
spaces and because the CLIs that write into this repo (`shadcn`, `drizzle-kit`, `next`) all emit
them, so tabs would mean every generated file arriving non-conforming. Width 100 rather than 80,
matching the prose convention already in use, where 80 would rewrap 147 existing lines for nothing.

`pnpm lint` runs `biome ci`, not `biome check`. Measured difference: under GitHub Actions, `ci`
emits `::error` annotations that land on the diff, and `check` does not. Outside CI the two print
the same diagnostics. One command in both places, so the local check and the CI check cannot drift
apart — which is the failure mode a separate `lint:ci` script would have introduced. `lint:fix`
stays on `biome check --write`, since writing is the one thing `ci` will not do.

## Where the linter was told to stand down, and why each is not a hole

**`packages/config/src/base-config.test-d.ts`** is a file of deliberate compile errors, so
`noFallthroughSwitchClause` fires on a fallthrough that IS the assertion. Suppressed at the site.
The comment ordering there is load-bearing and was established by running both tools rather than
assumed: Biome honours a suppression only as the LAST comment before the node, while
`@ts-expect-error` binds to the next line of code across an intervening comment. So the
`@ts-expect-error` sits above the `biome-ignore`. Both fail loudly if that order is broken — Biome
reports an unused suppression, tsc reports an unused `@ts-expect-error` — which is what makes the
arrangement safe to leave in place.

**`packages/ui/src/components/**`** has three a11y rules off: `noLabelWithoutControl`,
`useSemanticElements` and `useKeyWithClickEvents`. These are shadcn primitives that spread their
props, so the control association and the click handler the rules look for happen at the call site,
which Biome cannot see from the component. Scoped to that directory rather than suppressed inline
because the shadcn CLI rewrites those files and would drop the comments. a11y stays fully on for
`apps/web`, which is where pages are actually written, so the rules are live everywhere a real
accessibility defect could be introduced.

**`packages/db/src/migrations/meta`** is drizzle-kit's bookkeeping: the journal and one snapshot per
rung, all of which it rewrites itself on every `db:generate` — the journal minified, with no trailing
newline. Formatting them means the next generate un-formats them and the Lint job fails on files no
human touched. The `.sql` rungs beside them need no exclusion, because Biome does not handle SQL.

**`**/*.test.ts`** has `noNonNullAssertion` off, and only there. A `!` throws away precisely the
safety `noUncheckedIndexedAccess` buys, so in anything that ships the rule stays on — verified by
putting a `!` in `packages/db/src/queries.ts` and watching it fail. In a test the trade is different:
a wrong `!` FAILS THE TEST, which is what a test is for, and what is lost is the quality of the
failure message rather than a defect slipping through.

Two `noTemplateCurlyInString` suppressions sit in `packages/db/src/docker-compose.test.ts`, on
fixtures that quote docker-compose's own `${VAR:-default}` interpolation. The rule's heuristic is
right in general and wrong on a string whose whole point is to contain that syntax literally.

All of these are narrow on purpose. A blanket `a11y: off`, or a lint task that exits 0 having checked
nothing, is the same defect CNCORE-3 deleted when it removed the generator's empty `lint` task.

## What CNCORE-4 landing taught: an exclusion is only as good as what re-checks it

This record first excluded `packages/db/src/migrations` entirely, which was defensible while that
directory held one generated journal and nothing else. CNCORE-4 filled it with migration 1, and the
exclusion silently widened with it: a hand-written helper dropped in beside the rungs would have gone
unlinted, and nothing would have said so. It is now scoped to `meta`, which is the part drizzle-kit
actually owns.

The test changed with it, and that is the more important half. It used to ask whether each workspace
package had **at least one** file linted — a question a package of forty files and one linted
`package.json` passes. It now asks whether anything git tracks that Biome can parse is being skipped,
and compares that set against the exclusions named above. Proven by breaking it: adding
`packages/db/src/schema` to the exclusions fails the test with the four files by name.

The first form of that test would have passed throughout, because `packages/db` still had a linted
`package.json`. That is the shape to watch for. A coverage check that asks whether a thing is
represented, rather than whether it is complete, degrades quietly as the thing it guards grows.

## Warnings were decorative, and `--error-on-warnings` is what fixes that

Found while making CNCORE-4's code pass. Biome grades some rules as warnings and, by default,
**reports them and exits 0**. `noNonNullAssertion` is one. So the claim "the rule stays on for
production code" was, for a few minutes, not true in the only sense that matters: a `!` in
`packages/db/src/queries.ts` printed a diagnostic and left `pnpm lint` green.

That is the same defect as a task that checks nothing, one severity down, and it is worse for being
quieter — there IS output, so the check looks alive. `pnpm lint` is now
`biome ci --error-on-warnings .`, which costs nothing on the current tree because it has no warnings,
and a test pins it by reading the flags out of the `lint` script and proving a warning-only fixture
fails. Proven by breaking it: dropping the flag fails that test.

The general lesson is worth more than the flag. **A severity a check does not act on is a severity
that does not exist.** Anything that reports without failing should be either enforced or removed,
because the third state — visible, ignored, accumulating — is the one nobody reads.

CNCORE-13 found the same shape one layer out, in CI rather than in a linter: seven workflow steps
passing `pnpm/setup` an input it does not have, warned about on every run since CNCORE-3 and read by
nobody. See [[0106-the-frozen-lockfile-is-set-not-inherited]].

## What was deliberately not enabled, with the trigger to revisit

Biome 2.4 added a `types` linter domain with its own inference engine, so type-aware rules no longer
require `typescript-eslint`. It is off. Measured on this tree: it finds two `noUnnecessaryConditions`
diagnostics and takes the whole-repo check from 33ms to 530ms, and most rules in the domain are
still `nursery`. Two findings that the strict tsconfig does not already cover is not enough to buy
a sixteen-fold slowdown and a set of unstable rules, and both sites are in files another ticket is
rewriting.

Reopen this when the `types` domain rules leave nursery, which is the moment the argument above
expires.

## Evidence

npm registry and each tool's own documentation, read 2026-09-10. Every figure above came from
running the tool named — the install counts from `ls node_modules`, the exit codes from invoking
each binary against an empty directory, the timings from the check itself.
