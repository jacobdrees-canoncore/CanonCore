---
status: accepted
---

# A suite removes the temporary directory it makes, and a check refuses one that does not

> **ACCEPTED 2026-09-21, whole, in one repository.**
> `packages/config/src/temp-directory-cleanup.test.ts` sweeps every tracked source for a
> `mkdtemp` or `mkdtempSync` the file making it never removes, and
> `packages/config/src/testing/temp-directories.ts` is the reader behind it. Seventeen sites across
> seven files were given the removal they lacked, using the `onTestFinished` and `afterAll` shapes
> already in this tree rather than a new helper. Both halves landed together, which is what makes
> this `accepted` rather than `proposed`: the sites are clean AND the next one cannot be added in
> silence. Neither Provider repository creates a temporary directory, so nothing is owed at a
> second one.

`mkdtemp` and `mkdtempSync` create a directory and hand back its path. Nothing removes it: not the
process exiting, not Vitest, not the operating system inside any useful window. A suite that makes
one per test and never removes it therefore leaves one behind per test, per run, for as long as the
machine lives.

**7,547 of them, 1.36 GB, had accumulated in `/private/tmp` by 11:10 on 2026-09-21**, the oldest
from 04:24 the same morning: one day of dispatch on one machine (CNCORE-336). Dated and carrying
its query, which is [[0153-a-figure-about-this-tree-is-derived-or-dated]]'s rule for a figure this
tree cannot re-derive. Taking it again is
`find /private/tmp -maxdepth 1 -type d \( -name 'merge-gate-*' -o -name 'canoncore-*' -o -name
'dispatch-monitor-*' \) | wc -l`.

## Why it went unreported for so long

**A leaked directory fails nothing.** No run has ever gone red for one, no assertion mentions them,
and the disk they fill is not the disk anybody watches. That is the whole of it: the defect has no
way to become visible, so it reached 7,547 before a person happened to look.

It is also in the wrong place to be noticed. **Turbo runs a task in STRICT env mode unless
`turbo.json` says otherwise, and strict mode does not pass `TMPDIR` through.** `os.tmpdir()` falls
back to `/tmp` where `TMPDIR` is unset, so every directory a suite leaks under `pnpm test` lands in
`/private/tmp` rather than in the per-user directory a developer's own tools use. Measuring this
honestly means `turbo run test --env-mode=loose` with `TMPDIR` set, which is how the before and
after in PR #257 were taken: 78 directories left by a full run before, 66 of them from these
suites; 12 after, none of them from these suites.

## The rule

**A site registers its own removal, at the site.** `onTestFinished` where the directory belongs to
one test, the file's `afterEach` or `afterAll` where it belongs to the block. Registering in the
CALLERS is what failed here: `dispatch-monitor.test.ts` made its directory inside a helper three
tests called, and a removal owed by three callers is a removal one of them forgets.

**The check pairs a creation to a removal that names the same binding**, rather than asking whether
the file removes something somewhere. A file-level presence check would have read a new site in
`merge-gate.test.ts` as covered by one of the four removals already standing there, which is
exactly the silent next site this record exists to refuse. A lone site takes any number of removals,
because with nothing else bearing the name there is nothing to mis-attribute; a name borne by
several sites must pair with its removals exactly, which is what spends the slack a surplus would
otherwise leave for a new site to hide in.

## What this cannot do, which is the half worth writing down

It is a scan, not a parser, and it resolves no scopes.

**It can pass a site that leaks** where the removal is present as text but never runs: inside
`if (false)`, inside an unreached branch, or inside a STRING. `without-comments.ts` strips comments
and deliberately keeps strings, so a suite writing source-as-string fixtures can satisfy this by
quoting a removal it never performs. The one file in this tree that does that is excluded by name,
guarded by `isTrackedAs` so a rename is reported rather than silently un-excluding it.

**It can fail a site that is clean** where the removal is not spelled as a call naming the binding:
`execFileSync("rm", ["-rf", dir])`, a shared helper taking the path, or a registry removed in a
loop all report as leaks. **So the check pins one idiom rather than the property**, and that cost is
taken deliberately, because CNCORE-336 chose the idiom: the shapes already in this repository
"rather than a new helper". Extracting a helper later is a change that has to teach this reader
about it in the same commit, and that is the trade this record accepts rather than hides.

**Equality is not attribution.** Three sites and three removals of one name pass whether or not they
pair up. What the rule buys is that ADDING a site has to come with adding its removal, which is the
edit that was being forgotten seventeen times.
