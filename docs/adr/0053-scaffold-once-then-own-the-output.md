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
the env guard stop testing anything the day remote caching is turned on. The guard is a step of
`static-checks` since CNCORE-35 rather than a job of its own
([[0111-ci-optimises-billed-minutes-over-named-checks]]), and that shortens the path to this: it now
runs straight after a successful `pnpm build` in the same workspace, so a LOCAL warm cache would be
enough and no remote one is needed. The `env` declaration above is the whole of what keeps the
guard's build a cache miss, measured at `0 cached, 1 total` against a deliberately warmed cache.
