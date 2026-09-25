---
status: accepted
---

# The frozen lockfile is set, not inherited

`PNPM_CONFIG_FROZEN_LOCKFILE: true` sits in the workflow-level `env:` block of `.github/workflows/ci.yml`,
where every job inherits it. It replaces `require-lockfile: true`, which seven `pnpm/setup@v2` steps
passed and which that action has never had as an input.

## The defect was invisible by design

GitHub Actions grades an input an action does not declare as a **warning**, never an error. The step
runs, the input is dropped, and the job goes green:

```
Unexpected input(s) 'require-lockfile', valid inputs are
['version', 'dest', 'runtime', 'cache', 'cache-dependency-path',
 'package-json-file', 'install', 'token']
```

That annotation was on every CI run from CNCORE-3 until CNCORE-13 — seven times per run, once per
job — and nobody read it. This is the same shape [[0105-biome-lints-and-formats]] found in Biome's
warning severity, and it generalises the same way: **a severity a check does not act on is a
severity that does not exist.** The variant here is worse in one respect. Biome's warnings were at
least about real code. This was a warning about a line that had never done anything at all.

There is no `require-lockfile` anywhere in v2's history to have been renamed from. The list above
is the whole of what `pnpm/setup@v2` accepts, read from the `inputs:` block of its own `action.yml`
at that ref. **v2 has no input for lockfile strictness of any kind.** v3 added one, under that very
name (read at the `v3` tag on 2026-09-25, CNCORE-411), and it is still not passed: it governs only the
install the action runs, where the variable governs every install in the file, and that is a pnpm
setting rather than a setup-action one.

## CI was right by accident, and that was worth proving rather than assuming

pnpm documents `--frozen-lockfile` as defaulting to true in CI when a lockfile is present. If that
held, the dead input cost nothing and this record would only be housekeeping. So it was run.

**On a real runner, with the setting absent, a desynced manifest failed the build.** A commit adding
`picocolors` to `packages/config/package.json` without regenerating `pnpm-lock.yaml`, and with no
`PNPM_CONFIG_FROZEN_LOCKFILE` in the file, failed every job that installs, at the `pnpm/setup@v2`
step, with `ERR_PNPM_OUTDATED_LOCKFILE`
([run 34503191280](https://github.com/jacobdrees-canoncore/CanonCore/actions/runs/34503191280)).
pnpm's default was doing the work the whole time.

**With the setting present, the same desync failed the same way**
([run 34503426759](https://github.com/jacobdrees-canoncore/CanonCore/actions/runs/34503426759)):
seven jobs red at the install step naming `picocolors@catalog:` as the dependency the lockfile did
not have, and the two jobs that install nothing — Secret scan and Agent docs — green. Both
experiment commits were removed from the branch afterwards; the runs are the record.

So the change does not repair a broken gate. It replaces an inherited gate with a stated one. The
argument for that is not belt-and-braces: pnpm's default is conditional on **its own CI detection**,
which is a thing that can change under an upgrade, and a gate that holds for a reason the file does
not state is one nobody can watch break. The dead input is evidence of exactly that failure — the
repo believed it had asked for something for two months.

## A lockfile that records no dependency did not trigger the CI default

This cost an hour and is the reason the first version of this record said the opposite of the truth.

The first probes used a throwaway project with **no dependencies**, and there `CI=true` did not
produce a frozen install: pnpm went to the registry instead. On that evidence the CI default looked
broken on pnpm 12.3.4 and 11.20.0 alike, and this record was drafted saying so. The runner
disagreed, which is what sent the probe back for a second look.

Re-probed with one real dependency and the same desync, `CI=true` alone fails with
`ERR_PNPM_OUTDATED_LOCKFILE`, matching the runner exactly. **The discriminator is whether the
lockfile records a dependency for the project**, and that is stated as the measurement it is rather
than as a rule of pnpm's: two fixtures each way is what established it, and the mechanism was not
chased further because nothing here turns on it.

What it is NOT is the obvious reading — that the file was empty. Pinning `packageManager` in the
fixture fills its `packages:` block with pnpm's own nine entries, so the dep-free lockfile is a
populated file with an empty importer. That reading was offered under review, checked against the
fixture, and does not survive it. Worth writing down, because it is the explanation anybody would
reach for second.

Two things follow. The narrow one: a dependency-free fixture cannot measure pnpm's CI default, and
`packages/config/src/ci-workflow.test.ts` now relies on that deliberately — it is what leaves the
workflow's own variable as the only thing that can fail the install it asserts on. The general one
is the one worth carrying: **a probe that removes the condition under test measures nothing, and
answers confidently.** The wrong result here was not noisy or marginal. It was clean, twice, on two
pnpm versions.

## Why not `pnpm-workspace.yaml`

`frozenLockfile: true` there would be one line and would cover every install everywhere, which is
briefly appealing. It was rejected: it also freezes a developer's laptop, where editing a manifest
and running `pnpm install` is the ordinary way to add a dependency, and would fail it with an error
telling them to regenerate the lockfile. The requirement is that **CI** refuse a manifest that has
moved ahead of its lockfile. Scoping the setting to the file that states that requirement is the
smaller change and the honest one.

## What the tests pin, and what breaking them proved

Four tests in `packages/config`, which is where `biome.jsonc` is already held honest, reading
`.github/workflows/ci.yml` as a file for the reason [[0103-tests-bite-at-package-exports-and-the-router]]
gives: the value is written where TypeScript cannot see it. Each was proven by breaking the thing it
guards and watching that test, and only that test, fail:

- **No pnpm/setup step passes an input the action does not declare**, against the input list above,
  and every step must be at the pinned major so a bump forces someone to re-read `action.yml`.
  Putting `require-lockfile: true` back on the Build job failed it at `@v2`, naming Build; at `@v3`,
  which declares that input, the same proof is `cache-hit: true`, one of v3's outputs, on the
  Typecheck job, which fails it naming Typecheck (CNCORE-411).
- **The setting is on at workflow level.** Flipping it to `false` fails it.
- **No job or step shadows it.** A job-level `env:` re-declaring the key fails it, and so does a
  step-level one. The step-level half is the live shape in this file: `env-guard` is a job again
  since CNCORE-80, but it blanks `DATABASE_URL` on its single STEP rather than on the job, so that a
  step added beside it later would still get the real value
  ([[0111-ci-optimises-billed-minutes-over-named-checks]] carries the two moves). It was a job-level
  block when this record was written, and CNCORE-35 is what made the step-level form worth asserting
  about in the first place.
- **The name in the workflow is one pnpm honours.** The real pnpm binary, on a throwaway project
  outside the repository, with the `PNPM_CONFIG_*` variables lifted out of the workflow rather than
  retyped: a manifest ahead of its lockfile must fail with `ERR_PNPM_OUTDATED_LOCKFILE`, and the
  same manifest in sync must pass. Typing the key as `PNPM_CONFIG_FROZEN_LOCK_FILE` — a setting
  pnpm loads, does not recognise and ignores, which is `require-lockfile`'s failure exactly — fails
  it. The variables are forwarded to that subprocess verbatim, which is the point and also a sink:
  the set is pinned to the one key, so a second one — `PNPM_CONFIG_STORE_DIR`, say, which would
  redirect what the test writes — fails the test rather than silently changing what it measures.

That fourth test is the one that would have caught the original defect, and it is the one that needs
care, because **it runs inside the environment it is testing**. It strips `PNPM_CONFIG_*` and `CI`
from what it spawns pnpm with. Without the first strip the suite does not merely give a false pass:
it cannot seed its own fixture, because a frozen install refuses a project with no lockfile yet.
That was found by running the suite under the runner's environment locally, before pushing, and it
would otherwise have been a green local suite and a red CI.

`--offline` on both installs the assertions run, so the measurement never reaches the registry: pnpm
makes the frozen-lockfile decision before it resolves anything, which is what makes an offline check
meaningful.

**The seeding install is the exception, and review talked me into breaking it before the runner
talked me out again.** The seed had no `--offline`; that was raised as a gap, and adding the flag
looked obviously right. It is not. Pinning `packageManager` in the fixture makes pnpm resolve pnpm
itself as a config dependency, and offline it cannot, so the seed fails outright with
`ERR_PNPM_BAD_CONFIG_DEP` on a cold store — green locally, red on the runner
([run 34504945322](https://github.com/jacobdrees-canoncore/CanonCore/actions/runs/34504945322)).
Reverted. The registry access it needs is not an extra point of failure: a registry the runner
cannot reach has already failed the job at `pnpm/setup`, several steps earlier.

The lesson is about review rather than about pnpm. **A finding is a hypothesis, and "obviously
right" is where that gets forgotten.** This one was accepted on its reasoning, passed locally, and
was wrong — the machine that could tell the difference was the runner, and asking it cost one push.

One thing makes a test that reads a file outside its own package safe here, and it was already
decided: `packages/config/turbo.json` sets `cache: false` on this suite, under CNCORE-12, because
its real inputs are the whole repository rather than the contents of `packages/config`. Turbo hashes
only a package's own files, so a cached `test` task would replay a pass over a workflow it never
read — the false green this record is about, arriving through the build tool. Verified rather than
assumed: with `PNPM_CONFIG_FROZEN_LOCKFILE` sabotaged in `ci.yml` and the cache warm, the suite
still runs and still fails.

## One dependency added

`yaml` (catalogued at `^2.9.0`, `packages/config` devDependency), to parse the workflow. Checked
first: nothing in the catalogue parses YAML, and `packages/db/src/docker-compose.test.ts` hand-rolls
a regex for its compose file. That regex answers "does any line publish host port 5432", which is a
question about one line. These are questions about block structure — which `with:` belongs to which
`uses:`, which `env:` belongs to which job — and a regex for those is a YAML parser written badly.

## Evidence

`pnpm/setup@v2`'s `action.yml` and pnpm's own documentation on `--frozen-lockfile` and on
`PNPM_CONFIG_*` environment variables, read 2026-09-10. Every behavioural claim above came from
running the thing named: the two runner experiments are linked inline, and the local probes were
`pnpm install` against throwaway projects on pnpm 12.3.4 and 11.20.0.
