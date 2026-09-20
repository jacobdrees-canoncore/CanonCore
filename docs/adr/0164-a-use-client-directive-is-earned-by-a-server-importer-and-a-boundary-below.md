---
status: accepted
---

# A `"use client"` is earned by a server importer AND a boundary below it

A module may carry the directive when something in it needs a browser: a hook call, a handler it
binds, a browser global. Where it has none of those, it earns one only by satisfying BOTH halves of
a conjunction: an importer that is itself a SERVER module, and a client boundary somewhere BELOW it.

**Neither half stands alone, and both failures are measured rather than argued.** That is the whole
of this record: two rules that each look complete, each pass the case the other was written for, and
each greenlight a directive that costs real bytes.

## The half that was tried and deleted: what a module IMPORTS

ADR-0158 shipped a second limb allowing the directive when a package a module imported marked a
client boundary of its own. Exactly one module ever passed on it, `dropdown-menu.tsx`, and CNCORE-276
measured it rather than arguing it: the client bundle came out byte-for-byte identical with the
directive and without. The limb went, and the directive with it.

**It fails because it asks the wrong graph.** `dropdown-menu.tsx` imports `@base-ui/react`, which
does declare boundaries -- but its only importer, `mode-toggle.tsx`, is already a client module, so
the boundary had been crossed one level up. What a module imports cannot tell you whether the
boundary is still yours to declare.

## The half CNCORE-283 was filed proposing: who IMPORTS a module

So the ticket proposed the opposite ground, and it is right about the chain and **WRONG about the
primitives**. Run over `apps/web` as specified -- a directive earned by a direct client API, or by
the module having an importer that is itself a server module -- and `label.tsx` passes it.

`label.tsx` is the module ADR-0158 was written for. It renders a bare `<label>` with no state,
effect, handler, ref or browser API, and its four importers are `groups/page.tsx`, `new/page.tsx`,
`items/[id]/page.tsx` and `login/page.tsx` -- every one a server module. The proposed rule earns its
directive on that fact alone. **Restoring it measures +707 bytes**, so the ticket's own rule would
have greenlit, through the check, the exact defect the check exists to catch.

**The ticket said so in a checkbox and the measurement refuted it**, which is the same shape
ADR-0158 records twice already: a sentence that reads as load-bearing and is not.

## So the rule is the conjunction, and the eight cases require it

| module | direct API | boundary below | server importer | verdict |
| --- | --- | --- | --- | --- |
| `mode-toggle.tsx` | `useTheme()`, `onClick` | — | — | earned |
| `scope.tsx` | `useSearchParams()` | — | — | earned |
| `search-box.tsx` | `useNarrowedTo()` | — | — | earned |
| `sortable-members.tsx` | `useSortable()`, `onDragEnd` | — | — | earned |
| `providers.tsx` | none | `next-themes` | `app/layout.tsx` | **earned** |
| `theme-provider.tsx` | none | `next-themes` | `providers.tsx` is client | unearned |
| `dropdown-menu.tsx` | none | `@base-ui/react` | `mode-toggle.tsx` is client | unearned |
| `label.tsx` | none | **none** | four server pages | unearned |

The two rows that matter are the last two: `dropdown-menu.tsx` is what the import half alone gets
wrong, and `label.tsx` is what the importer half alone gets wrong. Both refutations are executed by
`packages/ui/src/components/directives.test.ts` rather than described in it, and both were confirmed
by mutation: weakening the rule to either half alone turns exactly those rows red.

**A SERVER MODULE IS THE COMPLEMENT OF THE CLIENT GRAPH, not merely a module without the directive.**
A module carrying no directive that only client modules import is compiled into the client bundle
anyway, so asking whether an importer carries the directive would call it a server module and be
wrong. The check computes the closure of the carriers under imports and takes what is left.

## The measurement, which this record owns

Population: every `.js` under `apps/web/.next/static/chunks`, plus the per-request RSC payload, which
is the larger inline script in the served HTML. Taken 2026-09-20 on Next 16.3.5 with Turbopack, at
`7f7e188`, from clean builds with `.next` removed between them.

```bash
rm -rf apps/web/.next
DATABASE_URL=… NODE_ENV=production pnpm --filter web build
find apps/web/.next/static/chunks -name '*.js' -exec stat -f '%z' {} \; | awk '{s+=$1} END {print s}'
```

| configuration | static chunks | RSC payload per request |
| --- | --- | --- |
| both directives (baseline) | 930,326 | 37,799 |
| **the same source, built again** | **930,326** | — |
| `theme-provider.tsx`'s removed | **930,326** | **37,799** |
| `providers.tsx`'s removed | 930,124 | — |
| both removed | 929,823 | 38,092 |
| `label.tsx`'s restored | 931,033 | — |

**THE CONTROL IS THE HALF WORTH KEEPING.** Two builds of identical source give an identical total and
move one chunk id, so a moved id is the build's nondeterminism and a moved TOTAL is not. Without that
row the 202 bytes below would read as noise.

**Every module the check flags measures zero, and the one it spares does not.** `theme-provider.tsx`
is identical in both dimensions; `dropdown-menu.tsx` was identical when CNCORE-276 measured it;
`providers.tsx` moves 202 bytes of chunk and 293 bytes of every request. That correspondence is the
evidence the static rule is tracking something real.

**FIGURES DRIFT WITH THE DEPENDENCY TREE, WHICH IS WHY EACH IS DATED AND PINNED (ADR-0153).**
ADR-0158 records 930,306 for the same population; this one reads 930,326 at `7f7e188` after a fresh
install. Neither is wrong -- they are different trees, twenty bytes apart -- and a figure quoted
without its commit is the one that goes stale silently.

## The chain is settled, and the check is what said which

`providers.tsx` keeps its directive and `theme-provider.tsx` loses it. `apps/web/src/app/layout.tsx`
is a server module and renders through `providers.tsx`, and `next-themes` below it needs a browser,
so that is where the boundary is declared. `theme-provider.tsx`'s only importer is `providers.tsx`,
already a client module, so its directive marked a boundary already crossed -- and removing it costs
nothing in either dimension.

**ADR-0158 SAID THE BOUNDARY HAD TO BE DECLARED SOMEWHERE IN THAT CHAIN, AND THAT IS FALSE.**
`next-themes@0.4.6` ships `"use client"` in both `index.js` and `index.mjs`, so it declares its own.
Built with neither directive the app serves HTTP 200, carries the identical 823-byte pre-paint theme
script, and names `next-themes` directly as the client boundary in its RSC payload. That
configuration is 503 bytes smaller in cached chunks and **293 bytes larger on every request**, and
all thirteen routes are dynamic, so it is a trade rather than a saving. It is declined here: the
boundary belongs where a server module renders through it, which is the sentence the rule already
encodes.

## What this does not judge

**A ROUTE ENTRY HAS NO IMPORTER**, so the conjunction cannot decide one: `page.tsx` and `layout.tsx`
are rendered by the framework rather than imported by a module, and the importer half would find
nothing and report every one of them unearned. The sweep is therefore the two COMPONENT trees
deliberately, and today that is every carrier in the repository -- all six live in
`apps/web/src/components`. A directive appearing on a page would go unjudged, and would need a ground
this rule does not have.

**AND ADR-0158'S OTHER HALF IS STILL OPEN.** That record's class check runs over `packages/ui` alone,
and `apps/web` is where most of this application's classes are written. This record finishes the
directive half of "what would finish it" and none of the class half, which is why ADR-0158 stays
`proposed`.

## Evidence

Every figure came from running the thing named, on 2026-09-20 at `7f7e188`: the bundle and payload
table from the clean builds whose command is written out above, the +707 bytes from the same build
with `label.tsx`'s directive restored, the boundary in `next-themes` from its own installed dist, the
served HTML and pre-paint script from `next dev` against this worktree's database, and the eight
verdicts from the check itself (CNCORE-283).
