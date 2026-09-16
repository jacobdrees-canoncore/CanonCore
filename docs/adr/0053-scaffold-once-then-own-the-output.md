---
status: accepted
---

# Scaffold with create-better-t-stack, then never depend on it again

Config verified by scaffolding and running it rather than by reading a README: next / self / orpc /
postgres / drizzle / auth none / turborepo / docker.

It survives a bespoke schema because there is nothing to rip out — the generated db schema file is
literally `export {}` and the API router is a four-line health check.

ONE OF THE TWO REASONS ORIGINALLY GIVEN FOR USING A GENERATOR AT ALL HAS EVAPORATED. Consuming
workspace packages without `transpilePackages` was called a poorly documented trap; it is neither.
Next.js documents it plainly: "Turbopack transpiles workspace packages (npm, pnpm, or Yarn
workspaces) in your monorepo automatically under both routers. Webpack does the same for the App
Router." Every remaining case is `node_modules` or the Pages Router. The Tailwind v4 workspace-
boundary reason still stands, and so does not having to assemble the oRPC handlers by hand.

## Considered options

Checked 2026-09-10 by RUNNING the generator, not by reading about it: create-better-t-stack 3.42.2
scaffolded this config, installed, typechecked, built and served. Two flag details the docs get wrong
in passing: it is `--db-setup`, not `--dbSetup`, and `--runtime none` is MANDATORY alongside
`--backend self`.

create-t3-turbo: default branch unmoved since 2025-12-12, pinning better-auth 1.4.0-beta.9 against a
stable that was 1.7.3 in the morning and 1.6.31 by the afternoon — the dist-tag moved BACK off the
1.7 line the same day, which is its own argument for pinning versions with a date rather than a
number — and the review sites call it maintained BECAUSE
THEY READ RENOVATE BRANCHES. next-forge: Prisma, no typed RPC, SaaS-shaped, ~30% survives.
start-ui-web: ~15% survives. ShipFullStack: no `packages/` directory at all, last CODE commit
2025-11-03 though the tip is a README edit from 2026-05-28. Two of these are in the owner's own
GitHub stars, so they will be suggested again.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-products.md`.

## As built, under CNCORE-3

Scaffolded at 3.42.2 and landed as a single unmodified commit, so that every later change reads as
a deliberate departure from the generator rather than as part of one blob. `bts.jsonc` is deleted:
it exists to let `create-better-t-stack add` run later, which is the standing dependency this
record forbids, and it was the only artefact of the generator in the tree. Its
`reproducibleCommand` is preserved in that commit's message, since nothing else records how the
tree was produced.

Owning the output turned out to include owning its version pins, which is a large enough matter to
have its own record: see [[0101-the-catalogue-is-the-only-place-a-version-is-written]].

One generated file is committed rather than deleted. `apps/web/AGENTS.md` is rewritten by
`next dev` on every run from `generate-agent-files.js`, so removing it as generator output only
produces a permanently dirty working tree.

### An eighth defect, which only CI could find

The seven defects catalogued on CNCORE-3 were all found by reading the generated tree. The eighth
was not visible there, and was not visible locally either.

`turbo.json`'s `build` task declares `inputs: ["$TURBO_DEFAULT$", ".env*"]` and no `env`. Turborepo
2.x defaults to Strict Environment Mode, which filters a task's environment down to the variables
named in `env`, `globalEnv` and `passThroughEnv`. So `DATABASE_URL` reached the build only when it
came from a `.env` file on disk, and never when it came from the environment.

This was invisible until defect 7 was fixed, because until then nothing in the build read
`DATABASE_URL` at all. It is invisible in local development too, because `apps/web/.env` exists
there. It surfaced on the first CI run: `Typecheck`, `Test` and the env-guard job all passed while
`Build` failed with `Invalid input: expected string, received undefined` — the env-guard passing and
the build failing for the same reason, which is the shape of the bug.

`DATABASE_URL` is now declared in `env` on `build`, `dev` and the `db:*` tasks. `env` rather than
`passThroughEnv`, deliberately: Turborepo's reference says values in `passThroughEnv` "do not
contribute to the cache key for the task", and a build whose success depends on a variable outside
its hash is a build that can replay a cached success when the variable is missing. That would let
the env guard stop testing anything the day remote caching is turned on. The guard was a step of
`static-checks` between CNCORE-35 and CNCORE-80, which made the question sharp — it ran straight
after a successful `pnpm build` in the same workspace, so a LOCAL warm cache was enough to raise it
and no remote one was needed. It is its own job again
([[0111-ci-optimises-billed-minutes-over-named-checks]] carries why it moved twice), so it starts
from a cold cache and nothing local can replay a success into it. **The `env` declaration above is
still what the guard rests on**, because a remote cache would reach a fresh job too: it is what
keeps the guard's build a cache miss, measured at `0 cached, 1 total` against a deliberately warmed
cache while the two shared a job.

## The last of the generator's output, under CNCORE-65

"Never depend on it again" was satisfied from the first commit; OWNING the output took longer, and
what was left of it was a client-side data layer rather than a dependency.

The generator's banner page ran a health check through TanStack Query, and `utils/orpc.ts`, the
`QueryClientProvider`, its devtools and the Toaster existed to serve that one panel. When `/` became
a server component reading the router in-process, nothing called any of them. **A data layer with no
callers is scaffold however well it works**, so it went, and `loader.tsx` with it: nothing had ever
imported that one at all.

**THREE DEPENDENCIES WENT, NOT FOUR, AND THE DIFFERENCE IS WORTH STATING.** `@orpc/tanstack-query`,
`@tanstack/react-query` and `@tanstack/react-query-devtools` are gone from `apps/web/package.json`
AND from the catalogue in `pnpm-workspace.yaml`, which is where
[[0101-the-catalogue-is-the-only-place-a-version-is-written]] puts every version. An earlier draft of
this section said four and left all three pinned; a package deleted from a manifest and left in the
catalogue is still a version this repo maintains.

**`sonner` WAS THE FOURTH AND IT STAYED -- AND THAT HALF OF THIS RECORD IS REVERSED, BY CNCORE-161
AND [[0137-a-primitive-earns-its-place-by-having-a-caller]].** The correction is written into the
sentence rather than appended after it, because appended it would leave the claim standing.

What this record decided, and what no longer holds: the app's `<Toaster>` went with the query
client, and "a data layer with no callers is scaffold" was then declined one directory over.
`packages/ui/src/components/sonner.tsx` was called a VENDORED PRIMITIVE; nine of that package's
seventeen primitives had no importer that day; and the reasoning was that an unimported primitive is
what a primitive library normally holds, so deleting one because this slice stopped using it would
be deleting the library a component at a time.

**IT READ `packages/ui` AS A LIBRARY, AND IT IS NOT ONE** -- a private workspace package, published
nowhere, with one consumer and a set of modules nobody chose. The nine became ten and the share was
measured: 61% of the package, 891 of the 1,433 lines of TypeScript under its `src/`, reachable from
nothing. `sonner.tsx` is deleted along with the other nine, and a roll call names the eleventh the
day it appears. **THE SCAFFOLD DECISION ABOVE IS UNTOUCHED**: owning the output is what both halves
of this are, and only the judgement about which parts to keep has moved.

The residue was not only code. `layout.tsx` carried `title: "canoncore"` and
`description: "canoncore"` — a placeholder the generator writes from the directory name, and a tab
reading `canoncore` beside a heading reading CanonCore is the scaffold showing through
([[0058-the-name-is-settled]]).

**What replaces it is added by the slice that needs it**, not restored on the way out. CNCORE-68 is
the first surface that mutates from the browser, and it picks what it needs rather than inheriting a
generator's guess.

**AS BUILT IT NEEDED NOTHING NEW, which is the cheapest possible vindication of the paragraph above.**
`/import` mutates through two Server Actions and a pair of forms, and it is built from the primitives
`packages/ui` already vendors -- `Button`, `Input`, `Card`, `Empty` -- plus one plain `select`, for
which the library offers a component that needs client state this page does not have. No toast, no
form library, no state manager: the surface reports what it did by RE-READING THE CATALOGUE, so there
was no client-side outcome to hold. What the generator shipped and this removed would have supplied a
toaster and a form abstraction to a page that wanted neither.
