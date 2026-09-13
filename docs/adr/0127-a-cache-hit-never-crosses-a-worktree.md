---
status: accepted
---

# A cache hit never crosses a worktree

The root `turbo.json` declares `"cacheDir": ".turbo/cache"`. Every worktree keeps its own filesystem
cache, so a task run in one is never replayed into another.

## Turbo shares its cache across worktrees BY DEFAULT

This is not a misconfiguration anybody introduced. It is turbo's documented behaviour when the key
is absent, and the key was absent. Turborepo's configuration reference
(turborepo.dev/docs/reference/configuration, read 2026-09-13 against turbo 2.10.12):

> "When no `cacheDir` is specified and you're working in a Git worktree, Turborepo automatically
> shares the cache with the main worktree. This allows cache hits across different branches checked
> out in separate worktrees. Cache artifacts are restored without rewriting their contents, so
> outputs containing absolute worktree paths can point to another checkout after a cache hit.
> Setting an explicit relative `cacheDir`, such as `.turbo/cache`, resolves from the root of the
> current worktree and disables sharing, giving each worktree its own local cache."

This repository dispatches a worktree per ticket (ADR-0051), so "different branches checked out in
separate worktrees" is not an occasional arrangement here. It is every working day. Measured
2026-09-13: one store at `~/orca/projects/CanonCore/.turbo/cache` holding **7,254 entries and
416 MB**, and **no worktree holding one of its own**.

**The demonstration holds the hash constant and varies only the store**, which is the only way to
tell this defect from the one ADR-0126 fixes. `@canoncore/env#test`, on a tree restored to its
pre-ticket state so the hash could not move:

```
default store (shared with main worktree): hash=8cb865d552b1aeb3  status=HIT   source=LOCAL  timeSaved=452ms
same hash, worktree-local store:           hash=8cb865d552b1aeb3  status=MISS
```

Same task, same inputs, same second. The only difference is whose cache answers. The artifact behind
that HIT was written at 2026-09-12 23:11, and the worktree reading it was created at 2026-09-13
11:19:55 — it was served a result computed **before it existed**. Unpacking it gives the log turbo
would have replayed:

```
RUN v5.0.0 ~/orca/workspaces/CanonCore/cncore-99-provider-settings/packages/env
```

A different worktree, on a ticket that had already merged.

**The A/B above sets the store with `--cache-dir`, and it has to.** The key's own bytes are a global
hash input, so writing it into `turbo.json` would have moved the hash and confounded the one
comparison that had to hold it still. The flag and the key are one setting: turbo's options overview
lists `cacheDir`, `--cache-dir` and `TURBO_CACHE_DIR` as the three ways to set the filesystem cache
directory, and the flag carries the same description and the same default `.turbo/cache` as the key.
**Every measurement below was taken with the shipped key and no flag.**

**The outbound direction, which the inbound pair does not cover.** With the key in place,
`turbo run test --filter=@canoncore/env --force` wrote hash `3f53e85b430ce07e`:

```
in THIS worktree's store:  .turbo/cache/3f53e85b430ce07e.tar.zst
in the SHARED store:       absent
```

So the pair is closed in both directions: nothing arrives from the shared store, and nothing computed
here is written where another worktree could find it. The MISS in the table above is a miss **by
construction**, and the construction is the partition — what shows the private store still answering
when it should is the warm run below, 21 of 22 tasks cached.

## WHY TURBO DOES THIS, AND THE REASON NAMES US

**This record switches off a feature built for exactly how this repository works**, and that is the
single most important thing in it. A later reader will find the feature, see what it is for, and want
it back. This section is so that reader decides on the evidence rather than on the headline.

Cache sharing across worktrees arrived in **Turborepo 2.8**, deliberately. Its release note gives the
motivation in the first line (turborepo.dev/blog/2-8, read 2026-09-13):

> "Many developers want to run multiple coding agents in parallel, in the same repository."
>
> "Git worktrees are a common technique for this. They allow you to check out multiple branches
> simultaneously, in separate directories, all sharing the same Git history."
>
> "However, each worktree would have a new local cache instance, so you would miss cache when
> creating a new worktree."
>
> "Starting with this release, Turborepo now shares the local cache across Git worktrees."

And turbo's AI guide (turborepo.dev/docs/guides/ai, read 2026-09-13) states the intended effect
plainly, with a worked example in which a second agent picks up a first agent's build:

> "Turborepo automatically shares the local cache across worktrees, so agents benefit from each
> other's cached task results."

That sentence describes what CNCORE-138 was filed to stop. A worktree per ticket, an agent in each,
each benefiting from the others' task results — the feature was designed for this repository's
working method, and the ticket's evidence is the feature operating exactly as documented.

**How it reaches the other checkout**, measured here on 2026-09-13 rather than inferred. In a linked
worktree `.git` is a FILE rather than a directory, holding one line — `gitdir:` and a path under the
main checkout. So git answers two different questions two different ways:

```
git rev-parse --show-toplevel    → this worktree
git rev-parse --git-common-dir   → the MAIN checkout's .git
```

A worktree's repository root, in the sense turbo means, is the main checkout. Nothing is misconfigured
and nothing is misreading git.

**The feature is coherent, and its premise is turbo's whole model.** A turbo cache is content
addressed: the hash covers the inputs, so identical inputs must mean an interchangeable result, and
an agent recomputing what another agent already computed is pure waste. On that model, sharing is not
a risk to be managed but the obviously correct thing to do.

**It carries a precondition, stated in the same documentation entry, and this repository fails it.**
The `cacheDir` entry quoted above says artifacts are "restored without rewriting their contents, so
outputs containing absolute worktree paths can point to another checkout after a cache hit". That is
a condition on the OUTPUT, not on the inputs: the artifact has to be RELOCATABLE. This repository's
`build` declares `.next/**` as its output, and Next writes the producing checkout's absolute path
into the standalone server entrypoint — the four files tabled in the next section. So the premise
holds for the hash and fails for the artifact.

**So this is not a bug in turbo and not one to report.** It is a documented feature whose documented
precondition this repository does not meet, switched off for that reason and no other.

**WHAT WOULD MAKE IT RIGHT TO TURN BACK ON**, which is the part that keeps this from being a
permanent article of faith: an output that carries no absolute path. Either `.next/**` stops
embedding the producing checkout — a Next behaviour, not one this repo controls today — or `build`
stops being a cached task. Until one of those is true, re-enabling the sharing trades the **32
seconds per worktree** priced below for a server entrypoint naming a directory that is not this
checkout. Whoever revisits it should check the four files first; if they no longer hold the path, the
trade has changed and this record should be reopened.

## The sharing is a defect ON ITS OWN, which corrects the research

`docs/research/parallel-agent-substrate.md` reached the opposite conclusion twice. Under "The five
current practices, labelled" it called the shared cache "**Actively wrong in combination with
practice 2** — alone it is a sound optimisation, since identical inputs should produce identical
results, and that is exactly what turbo promises", and under "What would change, ranked by harm
prevented per line" it listed "do not partition the turbo cache per worktree before fixing the input
declarations, since sharing is not the defect" among the things not to do. Both rest on one premise:
that identical inputs make two worktrees' results interchangeable.

**Turbo's own documentation denies that premise, in the sentence quoted above**: artifacts are
restored *without rewriting their contents*, so an output holding an absolute path keeps the path of
the worktree that produced it. This repository has four such files, measured 2026-09-13 inside
`.next/**`, which `turbo.json` declares as a cached output of `build`:

| File | Key holding the producing worktree's absolute path |
|---|---|
| `apps/web/.next/required-server-files.json` | `appDir` |
| `apps/web/.next/standalone/apps/web/server.js` | `outputFileTracingRoot`, `repoRoot`, `turbopack.root` |
| `apps/web/.next/required-server-files.js` | the same payload |
| `apps/web/.next/standalone/apps/web/.next/required-server-files.json` | the same payload |

`server.js` is the entrypoint the container image runs. A `build` hit served from another worktree
restores it naming a directory that is not this checkout.

**CORRECT INPUTS CANNOT FIX THIS, and make it more likely rather than less.** ADR-0126 makes a task's
hash see the files it reads. Two worktrees whose inputs are correctly declared and identical then
*agree* on the hash — which is precisely the condition under which the shared store hands one of them
the other's output. The input fix decides whether a hit is legitimate by content; it says nothing
about whether the content is addressed to this checkout. The two tickets are orthogonal and both are
needed, which is what CNCORE-138 asserted and this record now has the owner's documentation for.

## The cost, measured rather than assumed

The ticket asked for this because the trade had never been priced. What a private cache costs is one
cold pass per worktree. Measured 2026-09-13 in a worktree with no `.turbo`, no `.next` and no `dist`,
running `turbo run build typecheck test` — 22 tasks:

| Run | Result | Wall time |
|---|---|---|
| Cold, empty local cache | 0 of 22 cached | **33.144s** |
| Warm, same worktree | 21 of 22 cached | **1.144s** |

**About 32 seconds, once, per worktree.** The 22nd task is `@canoncore/config#test`, uncached on
purpose for a different reason it states itself. Disk: that pass left **20 MB across 63 entries**,
against the 416 MB and 7,254 entries the shared store had accumulated across every worktree and
every branch since the repository opened.

Thirty-two seconds is the whole of what the sharing was buying, and it was buying it by answering
with another agent's work.

**THE DISK COST IS SMALLER THAN THE MULTIPLICATION SUGGESTS, because a private store dies with its
worktree.** The shared one never dies: nothing evicts it, so it holds every entry every merged ticket
ever wrote, which is what 416 MB across 7,254 entries is. A worktree's own `.turbo/cache` goes when
the dispatcher removes the worktree, which this repo already does as each PR merges. Turbo 2.10 offers
`cacheMaxAge` and `cacheMaxSize`; neither is set here, because worktree removal already bounds the
thing they would bound, and a setting nothing needs is one more line to explain.

**Editing `turbo.json` at all moves every task hash once**, because the file is a global hash input.
So merging this costs one cold pass in every live worktree regardless of the cache decision — paid
once, on the merge, and not again.

## Two alternatives, and why neither

**Keying the hash so a hit cannot cross.** Turbo's lever for this is `globalEnv`, which would need an
environment variable carrying worktree identity. Nothing in the repo would read it, which `CLAUDE.md`
refuses outright, and the rebuild cost is identical to a private cache because every worktree misses
every task either way. What it adds is one store growing without bound in entries no worktree will
ever hit again. Strictly worse than the decision above.

**Refusing the cache where a cross-worktree hit is wrong.** `cache: false` pays the task's full cost
on *every* run rather than once per worktree, and the set it would have to cover is not enumerable:
the documented hazard is "outputs containing absolute worktree paths", which is a property of what a
tool writes rather than of anything declared here. `packages/config` is `cache: false` and stays that
way, for the unrelated reason its own comment gives — its real inputs are the whole repository.

## The line that carries this looks like a no-op

`.turbo/cache` is character-for-character turbo's documented default, so the declaration reads as
redundant to anybody tidying, and deleting it restores the sharing with no error and no changed hash.
`packages/config/src/turbo-cache-dir.test.ts` fails if it goes, if it is commented out, if it is made
absolute, or if it climbs out of the checkout on `..`.

**The guard reads the config because turbo will not answer.** `--dry=json` reports a task's hash and
cache status but not the directory; `turbo info` reports the CLI, the platform and the daemon;
`turbo query` exposes packages, files and tasks. All three checked on 2026-09-13.

That is the difference from ADR-0126's guard, which asks turbo rather than `turbo.json` and is right
to: `turbo-cache-inputs.test.ts` nests `turbo run test --dry=json`, which resolves the graph, runs no
task and costs about 0.2s. Nothing equivalent exists here. Observing the cache DIRECTORY needs a real
task run watched against the filesystem, and a nested run that executes — inside a suite that is
itself a turbo task, against packages that suite is already running — is a collision this guard is not
worth. So the behaviour was measured once, in CNCORE-138, and the config is what the suite holds.

What the suite does hold is every way the line can be present and still share: absent, commented out,
made absolute, or climbing out on `..`.

## CI is untouched

A CI job clones the repository; a clone is not a linked worktree, so the default already resolved to
the job's own root and an explicit relative path resolves to the same place. Checked rather than
assumed: no step in `.github/workflows/ci.yml` restores or saves a turbo cache — there is no
`actions/cache` over `.turbo` at all — so every CI job was already cold and still is. No CI time is
spent and none is saved.

## Evidence

All 2026-09-13, on the machine `docs/research/parallel-agent-substrate.md` describes. Store size and
entry counts from `du -sh` and `ls` against `~/orca/projects/CanonCore/.turbo/cache` and the
worktree's own. Hit and miss from `turbo run test --filter=@canoncore/env --dry=json`, run twice on a
tree restored to its pre-ticket state, once with and once without `--cache-dir`; `git status` verified
clean afterwards. The replayed log from `tar --zstd -xOf` on the entry itself. Absolute paths in the
build output from a walk of `.next/**` for the worktree's own path, excluding `.next/cache/**`, which
`turbo.json` excludes too. Cold and warm timings from `/usr/bin/time -p pnpm exec turbo run build
typecheck test`. Turbo's wording from turborepo.dev/docs/reference/configuration.
