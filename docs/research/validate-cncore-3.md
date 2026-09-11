# Verification: CNCORE-3 "Scaffold, test harness, CI"

Every technical claim in Linear issue **CNCORE-3** — and in the two ADRs it rests on,
`0053-scaffold-once-then-own-the-output.md` and `0052-monorepo-shared-packages-from-commit-one.md`
— put back to the source that owns it.

CNCORE-3 is the frontier ticket: nothing is built yet, and this is the next thing anyone builds.
A stale claim here costs time on day one, so nothing below is confirmed from memory.

**Run date: 2026-09-10.** Every CONFIRMED verdict carries a lookup performed during this run: an
npm registry query, a fetch of the owning documentation, or — for the claims about generated
output — the generator actually run at its current version with the exact configuration the ticket
names, and the files it produced read on disk.

Verdicts used:

- **CONFIRMED** — the owning source says this, with the citation given.
- **CONTRADICTED** — the owning source says something materially different.
- **UNFOUNDED** — no source found in this run supports it.
- **JUDGEMENT** — a characterisation, not a checkable fact.

**Section 8 at the end is the summary**: counts, and every CONTRADICTED and UNFOUNDED verdict in
one table with what is actually true now.

## The scaffold this run used

The generator was run for real, not read about. Command, taken from the `reproducibleCommand` the
CLI itself emitted into `bts.jsonc`:

```
pnpm create better-t-stack@latest cbts-check \
  --frontend next --backend self --runtime none --database postgres --orm drizzle \
  --api orpc --auth none --payments none --addons turborepo --examples none \
  --db-setup docker --manual-db --web-deploy none --server-deploy none \
  --no-git --package-manager pnpm --no-install
```

`bts.jsonc` records `"version": "3.42.2"` and `"createdAt": "2026-09-10T10:21:56.714Z"`. Every
statement below about "what the generator produces" is a reading of that tree.

---

## 1. The scaffold: does create-better-t-stack still exist, and does the named config still exist?

### 1.1 "Generate the repo with create-better-t-stack" — does it still exist?

**CONFIRMED.** The package is live on npm and actively published. `npm view create-better-t-stack`,
2026-09-10:

```
create-better-t-stack  3.42.2  published 2026-09-02T22:41:41.256Z
```

`dist-tags.latest` is `3.42.2`. The CLI ran, printed its banner, and scaffolded a project in 1.7s
during this run. Repository: `AmanVarshney01/create-better-t-stack`, linked from the CLI's own
completion output.

### 1.2 The exact config the ticket names — every option still present?

**CONFIRMED, with two additions the ticket does not mention.** `npx create-better-t-stack@latest
--help` on 2026-09-10 lists, verbatim from `create --help`:

| Ticket says | CLI flag today | Choice still offered? |
|---|---|---|
| frontend `next` | `--frontend [values...]` | Yes — `"tanstack-router", "react-router", "tanstack-start", "next", "nuxt", "native-bare", "native-uniwind", "native-unistyles", "svelte", "solid", "astro", "none"` |
| backend `self` | `--backend [string]` | Yes — `"hono", "express", "fastify", "elysia", "convex", "self", "none"` |
| api `orpc` | `--api [string]` | Yes — `"trpc", "orpc", "none"` |
| database `postgres` | `--database [string]` | Yes — `"none", "sqlite", "postgres", "mysql", "mongodb"` |
| orm `drizzle` | `--orm [string]` | Yes — `"drizzle", "prisma", "mongoose", "none"` |
| auth `none` | `--auth [string]` | Yes — `"better-auth", "clerk", "none"` |
| addons `turborepo` | `--addons [values...]` | Yes — `"pwa", "tauri", "electrobun", "starlight", "biome", "lefthook", "husky", "mcp", "turborepo", "nx", "vite-plus", "fumadocs", "ultracite", "oxlint", "opentui", "wxt", "skills", "evlog", "none"` |
| dbSetup `docker` | `--db-setup [string]` | Yes — `"turso", "neon", "prisma-postgres", "planetscale", "mongodb-atlas", "supabase", "d1", "docker", "none"` |

Nothing has been renamed or removed. Two notes for whoever runs this:

- **The flag is `--db-setup`, kebab-case.** The ticket and ADR 0053 both write it as `dbSetup`,
  which is the internal key (it is what appears in `bts.jsonc` and in the CLI's own error text),
  not the flag. `--dbSetup` is not accepted.
- **`--runtime none` is now mandatory with `--backend self`,** and the ticket does not name it.
  Omitting it is a hard error, not a default:

  ```
  ERROR  Backend 'self' (fullstack) requires '--runtime none'. Please remove the
  --runtime flag or set it to 'none'.
  ```

### 1.3 `--yes` cannot be combined with the config flags

**Worth recording, because it will bite the first attempt.** Passing `--yes` alongside the stack
flags is refused outright:

```
ERROR  Cannot combine --yes with core stack configuration flags: --database, --orm, --auth,
--payments, --frontend, --addons, --examples, --dbSetup, --backend, --runtime, --api,
--webDeploy, --serverDeploy. The --yes flag uses default configuration. Remove these flags or
use --yes without them.
```

Supplying every flag explicitly (and `--manual-db`) makes the run fully non-interactive without
`--yes`. That is the command recorded at the top of this file.

### 1.4 New options that did not exist when the ADR was written

**JUDGEMENT / informational.** The CLI now also offers `--payments` (`polar` / `none`),
`--template` (`mern`, `pern`, `t3`, `uniwind`, `none`), `--web-deploy` / `--server-deploy`, and the
agent-oriented subcommands `create-json`, `add-json`, `schema` and `history`. None of these change
the ticket's config, but `--payments none` and the two deploy flags must be passed explicitly for a
fully non-interactive run.

There is still **no testing addon** in the `--addons` list. See §2.1.

---

## 2. The five claimed defects in the generated output

All five checked against the tree produced by 3.42.2 on 2026-09-10, not against a remembered
earlier run.

### 2.1 "It ships NO TEST HARNESS AT ALL — no vitest, no playwright, no testing addon"

**CONFIRMED.** `grep -rniE "vitest|playwright|jest|@testing-library|node:test|\"test\"" .` across
the whole generated tree (excluding `node_modules`) returns exactly one file:
`packages/env/src/server.ts` — and that is the string `"test"` inside
`z.enum(["development", "production", "test"])` for `NODE_ENV`. Nothing else.

- No `test` script exists in any of the seven `package.json` files (root, `apps/web`, and
  `packages/{api,config,db,env,ui}`).
- `turbo.json` declares no `test` task. Its `tasks` keys are exactly: `build`, `lint`,
  `check-types`, `dev`, `db:push`, `db:generate`, `db:migrate`, `db:studio`, `db:start`,
  `db:stop`, `db:watch`, `db:down`.
- The `--addons` choice list (§1.2) contains no testing addon: `pwa, tauri, electrobun, starlight,
  biome, lefthook, husky, mcp, turborepo, nx, vite-plus, fumadocs, ultracite, oxlint, opentui, wxt,
  skills, evlog, none`. There is no `vitest`, no `playwright`, no `testing`.

The ticket is right, and this remains the single largest gap against its own acceptance criterion
`pnpm test runs a test and passes`.

**One nuance for the implementer:** `vite-plus` is a new addon since the ADR was written. It is a
build-tool addon, not a test addon, and it is not compatible with a `--frontend next` project.
Nothing in the addon list gets a test runner for free; the harness has to be added by hand.

### 2.2 "The web app's tsconfig does not extend the shared base"

**CONFIRMED, and it is stronger than the ticket says: there is no `extends` key at all.**

`apps/web/tsconfig.json` in full has no `extends` line. It is a standalone Next-style config that
redeclares its own compiler options:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    ...
```

Every other package does extend it — `packages/{api,db,env,ui}/tsconfig.json` and the root
`tsconfig.json` all begin `"extends": "@cbts-check/config/tsconfig.base.json"`. The web app is the
sole exception.

**The consequence is concrete, and worth stating in the ticket because it is the reason this
matters:** the two options the ticket separately says to keep are unevenly applied.
`verbatimModuleSyntax` happens to be redeclared in the web tsconfig, so the app has it. But
`noUncheckedIndexedAccess` is **only** in `packages/config/tsconfig.base.json` — the web app does
not set it and does not inherit it. So today the strictest option in the base config is off in the
one place most of the product's code will live. `noUnusedLocals`, `noUnusedParameters` and
`noFallthroughCasesInSwitch` are likewise base-only and absent from the web app. Fixing 2.2 is what
delivers the "keep `noUncheckedIndexedAccess`" item in §4.5.

### 2.3 "Only two packages have a typecheck script"

**CONFIRMED — and demonstrated by running it, not only by reading it.** The two are `apps/web`
(`"check-types": "tsc --noEmit"`) and `packages/ui` (`"check-types": "tsc --noEmit"`). The scripts
blocks of all seven manifests, read on disk:

| Package | scripts |
|---|---|
| root | `dev`, `build`, `check-types`, `dev:web`, and nine `db:*` passthroughs |
| `apps/web` | `dev`, `build`, **`check-types`**, `start` |
| `packages/api` | `{}` — an empty object |
| `packages/db` | nine `db:*` scripts, no typecheck, no build |
| `packages/env` | **no `scripts` key at all** |
| `packages/ui` | **`check-types`** |
| `packages/config` | **no `scripts` key at all** |

`pnpm check-types` on the installed project, this run:

```
   • Packages in scope: @cbts-check/api, @cbts-check/config, @cbts-check/db, @cbts-check/env, @cbts-check/ui, web
   • Running check-types in 6 packages
@cbts-check/ui:check-types: cache miss, executing ce364b4908cc325c
web:check-types: cache miss, executing a14365f669087a07
 Tasks:    2 successful, 2 total
```

Six packages in scope, two tasks run. `@cbts-check/api`, `@cbts-check/db`, `@cbts-check/env` and
`@cbts-check/config` are never type-checked on their own — exactly the "surface errors only
transitively" the ticket describes.

**One naming correction the implementer must not miss.** The script is called **`check-types`**,
not `typecheck`. The ticket's acceptance criterion says "Every package has a typecheck script",
and `turbo.json` wires the task name `check-types`. Pick one name and make the ticket, the scripts
and `turbo.json` agree; renaming to `typecheck` means editing `turbo.json` and the root passthrough
too.

### 2.4 "The api package sets composite/outDir/declaration with no build script and no include"

**CONFIRMED for `packages/api` — and the same dead config is in `packages/db`, which the ticket
does not mention.** The two tsconfigs are byte-identical:

```json
{
  "extends": "@cbts-check/config/tsconfig.base.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "composite": true
  }
}
```

`packages/api/package.json` has `"scripts": {}` — no build script. `packages/db/package.json` has
only the nine `db:*` scripts — also no build script. Neither tsconfig has an `include`. Neither
package is referenced by a `references` array anywhere (no `references` key exists in the tree), so
`composite: true` buys nothing either. Both packages export TypeScript source directly (§4.6), so
`outDir: dist` names a directory nothing ever writes.

**Widen the ticket from "the api package" to "the api and db packages".** Deleting the five
options from one file and leaving the other identical file in place would be the obvious way to do
this job half-right.

### 2.5 "drizzle-zod is absent, so Zod derived from the schema is unwired"

**CONFIRMED.** `grep -rn "drizzle-zod" .` across the generated tree returns no matches.
`packages/db/package.json` dependencies are `@cbts-check/env`, `dotenv`, `drizzle-orm ^0.45.2`,
`pg ^8.22.0`, `zod` (catalog) — and devDependencies `drizzle-kit ^0.31.10`, `@types/pg`,
`typescript`, `@cbts-check/config`. No `drizzle-zod`.

Two things make the decision the ticket asks for a real one rather than a formality:

- **`zod` and `@orpc/zod` are already present and already load-bearing.** `@orpc/zod` is in the
  workspace catalog and is imported by the generated route as
  `import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4"`. The Zod-4 path is what produces the
  OpenAPI document (§4.4). So the project already has a Zod story; what is missing is specifically
  *deriving* Zod schemas from the Drizzle table definitions.
- **`drizzle-zod`'s stable line has not moved since 2025.** `npm view drizzle-zod`, 2026-09-10:
  `latest` is **0.8.3, published 2025-08-06T08:03:58.355Z** — thirteen months old. The active
  development is on the `1.0.0-beta.*` tags that track `drizzle-orm@1.0.0-beta`, not on the stable
  tag. Adding `drizzle-zod` today means adopting a package whose stable release is a year stale, or
  else moving the whole Drizzle stack onto a beta. That is a genuine argument for the "deliberately
  declined in writing" branch of the acceptance criterion, and it did not exist as an argument when
  the ADR was written.

Also worth recording: `packages/db/src/schema/index.ts` is literally `export {};` and
`packages/api/src/routers/index.ts` is a four-line health check — the ADR 0053 claim that "there is
nothing to rip out" is **CONFIRMED** verbatim from the generated files.

---

## 3. The two claimed traps

ADR 0053 names these as "the time sink it removes… the poorly-documented traps it avoids", and the
ticket repeats them as the reason to scaffold at all. They do not survive equally.

### 3.0 Is Next 16 even current?

**CONFIRMED — Next.js 16 is the current stable major, and there is no Next 17.**

- npm, 2026-09-10: `next` `dist-tags.latest` = **16.3.4**, published 2026-08-31. `canary` is
  `16.4.0-canary.25`; `beta` is `16.0.0-beta.0`. Nothing on the 17 line exists.
- nextjs.org/blog, fetched 2026-09-10: the release posts run **"Next.js 16.3" (August 3rd, 2026)**
  and "Building App-like Experiences with Next.js 16.3" (August 18th, 2026), with the newest posts
  after that being "How we closed 1,500 GitHub issues in one month" (September 4th, 2026) and a
  Turbopack engineering post (September 3rd, 2026). No Next.js 17 announcement.
- The scaffold this run produced builds on **`▲ Next.js 16.3.4 (Turbopack)`** — Turbopack is the
  bundler the generated app uses, with no configuration to select it.

### 3.1 "Getting workspace packages consumed by Next 16 WITHOUT `transpilePackages` is a poorly documented trap"

**CONTRADICTED.** It is neither a trap nor poorly documented, for a Next 16 App Router project. The
Next.js documentation states the behaviour explicitly, in a section headed "When you need it".

`https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages`, fetched
2026-09-10, page front-matter `version: 16.3.4`, `lastUpdated: 2026-05-27`:

> **Turbopack transpiles workspace packages (npm, pnpm, or Yarn workspaces) in your monorepo
> automatically under both routers. Webpack does the same for the App Router.** Add a package to
> `transpilePackages` when:
>
> * **A `node_modules` dependency ships raw TypeScript or JSX.** […]
> * **You build with webpack for the Pages Router and the dependency's source lives outside the
>   next app's directory.** For example, an `apps/web` app importing `packages/ui` in the same
>   monorepo.
> * **You use the Pages Router and want a `node_modules` dependency bundled into the route.** […]

Every case that still requires `transpilePackages` is either a `node_modules` dependency or the
**Pages Router**. CanonCore is App Router on Turbopack, so it falls under the first sentence: it is
handled automatically, and the docs say so in the first line of the relevant section.

Verified empirically as well as documentarily. The generated tree contains **no occurrence of the
string `transpilePackages`** (`grep -rn "transpilePackages" .` — no matches), `apps/web/next.config.ts`
is six lines long:

```ts
import "@cbts-check/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
};

export default nextConfig;
```

…and `pnpm build` on the installed project succeeded while `apps/web` imported raw `.tsx` source
across the workspace boundary (`import { Button } from "@cbts-check/ui/components/button"`, and two
more in `providers.tsx` and `mode-toggle.tsx`):

```
web:build: ▲ Next.js 16.3.4 (Turbopack)
web:build: ✓ Compiled successfully in 1658ms
web:build:   Finished TypeScript in 982ms ...
 Tasks:    1 successful, 1 total
```

**What this means for the ticket.** The claim is not merely stale wording; it removes one of ADR
0053's two stated reasons for using a generator at all. Consuming workspace packages from Next 16
App Router requires no configuration and is documented in the obvious place. If the ADR's rationale
is being relied on to justify the scaffold, it now rests on §3.2 alone.

**One thing that *is* load-bearing here and is not `transpilePackages`:** the packages' `exports`
maps point at `.ts`/`.tsx` source (§4.6), and the web app additionally carries a `paths` alias
`"@cbts-check/ui/*": ["../../packages/ui/src/*"]` in its tsconfig. Those are what make the pattern
work; the absence of `transpilePackages` is a non-event.

### 3.2 "Tailwind v4 in a shared UI package crossing a workspace boundary is another trap"

**CONFIRMED as a real trap. JUDGEMENT on "poorly documented" — the mechanism is documented, but the
documented example points the opposite way to what is actually needed here.**

The trap is real because of two documented defaults that combine badly. From
`https://tailwindcss.com/docs/detecting-classes-in-source-files`, fetched 2026-09-10, documenting
**Tailwind CSS v4.3**:

> Tailwind scans **every file in your project** for class names, **except**: Files listed in your
> `.gitignore` file; Files in the **`node_modules` directory**; Binary files…; CSS files; Common
> package manager lock files

and

> **Tailwind uses the current working directory as its starting point by default.** This option is
> useful in monorepos where build commands run from the monorepo root instead of individual project
> roots.

A workspace package is reached through `node_modules` (pnpm symlinks it there), so its classes are
ignored by default; and the scan origin is not the stylesheet's package. Either half alone breaks a
shared UI package.

The documented fix is `@source`, resolved **relative to the stylesheet**:

> Use `@source` to explicitly register source paths **relative to the stylesheet**:
> ```css
> @import "tailwindcss";
> @source "../node_modules/@acmecorp/ui-lib";
> ```

**The generator solves it, but in the reverse direction from the documented example.** The
documented example lives in the *app's* stylesheet and reaches *into* the package. The generated
project puts the single stylesheet inside the *package* and reaches *out* to the apps.
`packages/ui/src/styles/globals.css` begins:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@source "../../../apps/**/*.{ts,tsx}";
@source "../**/*.{ts,tsx}";
```

and `apps/web/src/index.css` is one line: `@import "@cbts-check/ui/globals.css";`. That inverse
arrangement is the part the docs do not show, which is a fair basis for calling it under-documented
— though "poorly documented" overstates it, since `@source`, its stylesheet-relative resolution,
`source()` and `source(none)` are all documented on one page.

**Proved to work, this run,** by checking which classes survive into the emitted CSS bundle
(`apps/web/.next/static/chunks/3wmtupi0m7y18.css`, 78,774 bytes):

| Class | Appears in source only in | In built CSS? |
|---|---|---|
| `h-svh` | `apps/web/src/app/layout.tsx` | yes (1) |
| `grid-rows-[auto_1fr]` | `apps/web/src/app/layout.tsx` | yes (1, as `grid-rows-\[auto_1fr\]`) |
| `size-9` | `packages/ui/src/components/button.tsx` | yes (1) |
| `bg-fuchsia-700` | neither — control | **no (0)** |

Classes used only in the app and classes used only in the package both survive, and a class used in
neither does not — so the scan really is crossing the boundary in both directions rather than
emitting everything.

**Keep both `@source` lines when the package is renamed.** `../../../apps/**/*.{ts,tsx}` is a
hard-coded relative path from `packages/ui/src/styles/` to `apps/`. Moving the stylesheet, adding an
`apps/` sibling, or restructuring the directories silently drops classes from the bundle with no
error — the failure mode is missing styles at runtime, not a build failure.

---

## 4. What the ticket says to keep — does each still work as described?

Six items. Four survive intact, one survives but is misconfigured in a way that will break CI, and
one does not do what the ticket says it does.

### 4.1 pnpm `catalog:` pinning in the workspace file

**CONFIRMED.** The mechanism is current pnpm, and the generator uses it.

pnpm documentation (`https://pnpm.io/catalogs`, via context7 2026-09-10):

> Once defined in `pnpm-workspace.yaml`, dependency versions can be specified using the `catalog:`
> protocol instead of hardcoding version ranges directly. This protocol is supported in
> `package.json` fields (`dependencies`, `devDependencies`, `peerDependencies`,
> `optionalDependencies`) and within `pnpm-workspace.yaml` overrides. It also supports an optional
> named catalog format (`catalog:name`), falling back to the default catalog if no name is
> specified.

The generated `pnpm-workspace.yaml` carries an 18-entry default catalog (`dotenv`, `zod`,
`typescript`, `@types/node`, `lucide-react`, `next`, `next-themes`, `react`, `react-dom`, `sonner`,
the four `@orpc/*` packages, `@tailwindcss/postcss`, `@types/react`, `@types/react-dom`,
`tailwindcss`), and the package manifests reference them as `"next": "catalog:"` etc. `pnpm install`
resolved it without complaint this run (exit 0, "Done in 9.6s using pnpm v11.20.0").

**Two gaps in the coverage worth closing on day one,** since the point of catalog pinning is that
*nothing* is pinned twice:

- Several deps are **not** in the catalog and carry inline ranges instead:
  `@orpc/tanstack-query ^1.14.12`, `@tanstack/react-query ^5.101.4`,
  `@tanstack/react-query-devtools ^5.101.4`, `babel-plugin-react-compiler ^1.0.0`,
  `@swc/helpers ^0.5.23` (all in `apps/web`); `drizzle-orm ^0.45.2`, `drizzle-kit ^0.31.10`,
  `pg ^8.22.0`, `@types/pg ^8.20.0` (in `packages/db`); `@t3-oss/env-core` and `@t3-oss/env-nextjs`
  `^0.13.11` (in `packages/env`); `@base-ui/react`, `@shadcn/react`, `shadcn`,
  `class-variance-authority`, `cn`, `tw-animate-css` (in `packages/ui`); and `turbo ^2.10.12` at the
  root.
- `@orpc/tanstack-query ^1.14.12` is inline while the other four `@orpc/*` packages are catalogued
  at `^1.14.12` — the same version, expressed two ways. That is exactly the drift catalogs exist to
  prevent.

### 4.2 The turbo DB task flags — `cache: false` plus `persistent` / `interactive`

**CONTRADICTED on correctness, though the flags are present.** The generated `turbo.json` uses
`interactive: true` **without** `persistent: true` on three tasks, which the Turborepo
documentation says is not allowed and which fails at run time in any non-TTY context — CI included.

What the generator emits:

```jsonc
"db:push":     { "cache": false, "interactive": true },
"db:generate": { "cache": false, "interactive": true },
"db:migrate":  { "cache": false, "interactive": true },
"db:studio":   { "cache": false, "persistent": true },
"db:watch":    { "cache": false, "persistent": true },
"db:start":    { "cache": false },
"db:stop":     { "cache": false },
"db:down":     { "cache": false }
```

What the Turborepo configuration reference says
(`https://turborepo.dev/docs/reference/configuration`, fetched 2026-09-10; note the docs domain
moved — `turborepo.com` now 301s to `turborepo.dev`):

> **`interactive`** — Default: `false` (Defaults to `true` for tasks marked as `persistent`).
> "Label a task as `interactive` to make it accept inputs from `stdin` in the terminal UI.
> **Must be used with `persistent`.**"

> **`persistent`** — Default: `false`. "Label a task as `persistent` to prevent other tasks from
> depending on long-running processes. Persistent tasks are made interactive by default."

> **`cache`** — Default: `true`. "Defines if task outputs should be cached. Setting `cache` to false
> is useful for long-running development tasks and ensuring that a task always runs when it is in
> the task's execution graph."

So `cache: false` is right everywhere, and `persistent: true` on `db:studio` / `db:watch` is right.
The three `interactive: true` tasks are the problem.

**Demonstrated, not inferred.** `npx turbo run db:generate` on the installed project, with output
piped (i.e. no TTY), turbo 2.10.12:

```
  x Invalid task configuration
  |->   x Cannot run interactive task "@cbts-check/db#db:generate" without
  |     | Terminal UI. Set `"ui": "tui"` in `turbo.json`, use the `--ui=tui`
  |     | flag, or set `TURBO_UI=true` as an environment variable.
```

The root `turbo.json` **already** sets `"ui": "tui"`, and re-running with `TURBO_UI=true` set
produced the identical error. The remedy the error suggests does not work, because the real
requirement is an attached terminal, which CI does not have. A non-interactive db task in the same
project (`db:stop`) got past turbo's validation and reached the shell normally.

**Why this matters to CNCORE-3 specifically.** The acceptance criterion is "CI runs the test suite
and is green". The moment CI needs a schema applied before tests — `pnpm db:push` or
`pnpm db:migrate`, both of which route through turbo via the root passthrough scripts — the run dies
on task configuration before a single test executes. Fix it by dropping `interactive` from
`db:push`, `db:generate` and `db:migrate` (they are one-shot commands that exit, so they were never
candidates for it), or by giving them `persistent: true` as the docs require and never running them
in CI. Dropping `interactive` is the simpler and correct answer.

This is a **new defect, not on the ticket's list of five.** Add it.

### 4.3 "An env package validated at the top of the Next config so a missing variable fails the BUILD not the request"

**CONTRADICTED.** The mechanism is there; what it validates is nothing. A missing `DATABASE_URL`
does not fail the build.

The wiring, read on disk:

- `apps/web/next.config.ts` line 1 is `import "@cbts-check/env/web";` — so the import-at-the-top
  pattern is genuinely present, and Next really does execute it (`✓ Running next.config.ts took
  1103ms` in the build log).
- But `packages/env/src/web.ts` is, in full:

  ```ts
  import { createEnv } from "@t3-oss/env-nextjs";
  import { z } from "zod";

  export const env = createEnv({
    client: {},
    runtimeEnv: {},
    emptyStringAsUndefined: true,
  });
  ```

  An empty client schema and an empty `runtimeEnv`. There is nothing to validate.
- `DATABASE_URL` lives in `packages/env/src/server.ts`, and `grep -rn "env/server"` shows exactly
  one importer in the whole tree: `packages/db/src/index.ts`. Nothing in `apps/web` imports
  `@cbts-check/db` at all (`grep -rn "cbts-check/db" apps/web packages/api/src` — no matches, even
  though `packages/api` declares it as a dependency). So the server schema is never reached during
  `next build`.

**Proved by deleting the variable.** With `apps/web/.env` truncated to empty and `.next`/`.turbo`
removed:

```
web:build: ▲ Next.js 16.3.4 (Turbopack)
web:build: - Environments: .env
web:build: ✓ Running next.config.ts took 11ms
web:build: ✓ Compiled successfully in 1554ms
 Tasks:    1 successful, 1 total
```

The build passes cleanly with no `DATABASE_URL` anywhere. The failure would land later, at the first
request that touches the database — precisely the outcome the ticket says this pattern prevents.

The upstream library does not overpromise here either. `https://env.t3.gg/docs/nextjs`, fetched
2026-09-10, says only **"Import env here to validate during build"** and that doing so "will save
you a lot of time and headaches down the road". It makes no claim about a client schema validating
server variables.

**What to actually do on day one:** add `import "@cbts-check/env/server";` to `next.config.ts`
alongside the web import, and put the real variables in the server schema. Then the claim becomes
true. Until then, "keep this, it already works" is wrong — this one has to be *built*, and it
belongs on the defect list, not the keep list.

### 4.4 oRPC's RPCHandler and OpenAPIHandler behind one catch-all route, yielding a free OpenAPI reference

**CONFIRMED, and exercised end to end this run.** Both handlers are mounted in the single file
`apps/web/src/app/api/rpc/[[...rest]]/route.ts`, which exports `GET`, `POST`, `PUT`, `PATCH` and
`DELETE` from one `handleRequest`. The RPC handler takes `prefix: "/api/rpc"`, the OpenAPI handler
takes `prefix: "/api/rpc/api-reference"` and carries
`new OpenAPIReferencePlugin({ schemaConverters: [new ZodToJsonSchemaConverter()] })`.

That matches the current oRPC documentation. `https://orpc.dev/docs/openapi/plugins/openapi-reference`
(via context7, 2026-09-10):

> ```ts
> import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
> import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins'
>
> const handler = new OpenAPIHandler(router, {
>   plugins: [ new OpenAPIReferencePlugin({ docsProvider: 'swagger', // default: 'scalar'
>       schemaConverters: [ new ZodToJsonSchemaConverter() ], ... }) ]
> })
> ```

and `https://orpc.dev/docs/openapi/plugins/openapi-reference`:

> The OpenAPI Reference Plugin provides API documentation using either Scalar or Swagger UI. It also
> exposes the OpenAPI specification in JSON format, which is essential for integrating with various
> API tools.

Verified against a running server (`next start -p 3099`, Next 16.3.4, production build):

| Request | Result |
|---|---|
| `GET /api/rpc/api-reference` | HTTP 200, an HTML page titled `API Reference` loading `https://cdn.jsdelivr.net/npm/@scalar/api-reference` |
| `GET /api/rpc/api-reference/spec.json` | HTTP 200, `{"openapi":"3.1.1","info":{"title":"API Reference","version":"0.0.0"},"paths":{"/healthCheck":{"post":{"operationId":"healthCheck",...}}}}` |
| `POST /api/rpc/healthCheck` | HTTP 200, `{"json":"OK"}` |

So "free OpenAPI reference" is literal: a real OpenAPI 3.1.1 document plus a Scalar UI, from the
four-line health-check router, with no extra configuration.

**Two notes for the implementer.** The reference UI is rendered by a **jsDelivr CDN script tag**, so
the docs page needs network access to render and will be blank offline or behind a strict CSP — the
`spec.json` endpoint is unaffected. And the generated code branches on `if (rpcResult.response)`
whereas oRPC's own example branches on `matched`
(`const { matched, response } = await handler.handle(...); if (matched) return response`).
`matched` is the documented field; prefer it when this file is rewritten.

### 4.5 `noUncheckedIndexedAccess` and `verbatimModuleSyntax`

**CONFIRMED that both options exist and work — including on the current TypeScript major, which is
now 7.** But see §2.2: `noUncheckedIndexedAccess` is not actually in effect for the web app.

Both are set in `packages/config/tsconfig.base.json`, together with `strict`, `isolatedModules`,
`noUnusedLocals`, `noUnusedParameters` and `noFallthroughCasesInSwitch`.

Documentation, `https://www.typescriptlang.org/tsconfig/` fetched 2026-09-10: `noUncheckedIndexedAccess`
"adds `undefined` to the type of any un-declared field" reached through an index signature (added in
TypeScript 4.1); `verbatimModuleSyntax` is current and listed under Interop Constraints. Neither is
deprecated.

**Tested against TypeScript 7.0.2, this run,** because `typescript` `dist-tags.latest` is now
**7.0.2** and this is the sort of thing a major rewrite could have dropped:

```
$ npx tsc --version
Version 7.0.2
$ npx tsc --noEmit --strict --noUncheckedIndexedAccess --verbatimModuleSyntax \
      --module esnext --moduleResolution bundler a.ts      # exit 0 — flags accepted
$ npx tsc --noEmit --strict --noUncheckedIndexedAccess b.ts
b.ts(2,7): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
```

Both flags are accepted and `noUncheckedIndexedAccess` genuinely enforces under TS 7.

**A version note the ticket should absorb.** The generated catalog pins `typescript: ^6.0.3` and
`pnpm install` resolved 6.0.3 while printing `typescript 6.0.3 (7.0.2 is available)`. The generator
is one major behind. That is a decision to take deliberately at scaffold time — TypeScript 7 is the
native-port major, and adopting or deferring it is a bigger call than a catalog bump.

### 4.6 The zero-build package pattern, exporting TypeScript source directly

**CONFIRMED.** Every shared package points its `exports` map straight at `.ts` / `.tsx`, with no
build step and no `dist`:

```jsonc
// packages/api/package.json and packages/db/package.json
"exports": { ".": { "default": "./src/index.ts" }, "./*": { "default": "./src/*.ts" } }

// packages/env/package.json
"exports": { "./server": "./src/server.ts", "./web": "./src/web.ts" }

// packages/ui/package.json
"exports": {
  "./globals.css": "./src/styles/globals.css",
  "./lib/*": "./src/lib/*.ts",
  "./components/*": "./src/components/*.tsx",
  "./hooks/*": "./src/hooks/*.ts",
  "./postcss.config": "./postcss.config.mjs"
}
```

No package has a `build` script, no `main`, no `types`, no `dist` directory, and the root
`turbo.json` `build` task therefore runs in exactly one package (`web:build` — "1 successful,
1 total"). The pattern works end to end: `next build` compiled the app while importing `.tsx`
straight out of `packages/ui/src/components/`, and `tsc --noEmit` type-checked across the boundary
via the `paths` alias.

This is also the reason §2.4's `composite` / `outDir` / `declaration` block is dead config: those
options describe a build that the export map guarantees will never happen.

---

## 5. Current stable versions

All from the npm registry (`npm view <pkg> version` / `dist-tags` / `time`) on **2026-09-10**,
cross-checked against the project's own release channel where one exists. "Published" is the
publish timestamp of that exact version, not the package's last-modified date.

| Package | Current stable | Published | Notes |
|---|---|---|---|
| `create-better-t-stack` | **3.42.2** | 2026-09-02 | `dist-tags.latest`. Ran successfully this session; `bts.jsonc` stamps `"version": "3.42.2"`. |
| `next` | **16.3.4** | 2026-08-31 | No Next 17 exists. `canary` 16.4.0-canary.25. Release blog: "Next.js 16.3", 2026-08-03. |
| `@orpc/server` | **1.15.0** | 2026-08-08 | `@orpc/openapi` is also 1.15.0. **A 2.0 line is in beta**: `2.0.0-beta.35`, 2026-09-09. |
| `drizzle-orm` | **0.45.2** | **2026-03-27** | Stable has not moved in ~5.5 months. **1.0.0 is in release candidate**: `1.0.0-rc.5-5935859`, 2026-09-09, 28 rc builds. `drizzle-kit` stable 0.31.10. |
| `tailwindcss` | **4.3.3** | 2026-07-16 | Docs site self-describes as "Tailwind CSS v4.3". `v3-lts` tag holds 3.4.19. |
| `vitest` | **5.0.0** | 2026-09-03 | A **brand-new major, seven days old** at the time of this check. `V4` tag holds 4.1.11; `V3` holds 3.2.7. |
| `pnpm` | **12.3.4** | 2026-09-04 | The generated project pins `"packageManager": "pnpm@11.20.0"` — one major behind. |
| `turbo` | **2.10.12** | 2026-08-25 | Matches the `^2.10.12` the generator writes into the root `package.json`. |

Two more that the ticket depends on without naming:

| Package | Current stable | Published | Notes |
|---|---|---|---|
| `typescript` | **7.0.2** | — | The generated catalog pins `^6.0.3`; `pnpm install` printed `typescript 6.0.3 (7.0.2 is available)`. See §4.5. |
| `drizzle-zod` | **0.8.3** | **2025-08-06** | Stable untouched for 13 months; active work is on `1.0.0-beta.*` tracking `drizzle-orm@1.0.0-beta`. See §2.5. |

### 5.1 Three version decisions the ticket does not currently make

**JUDGEMENT, but they are unavoidable on day one and cheaper to settle now than later.**

- **`vitest` 5.0.0 is seven days old.** The ticket requires a test harness and two committed tests
  but names no runner or version. Standing up a brand-new major on the frontier ticket, with no
  existing suite to fall back on, is a choice worth making on purpose. `vitest@4` (4.1.11) is the
  conservative option.
- **`drizzle-orm` stable is stalled at 0.45.2 while 1.0.0 sits in rc.** The generator pins
  `^0.45.2`. Every Drizzle-adjacent decision — `drizzle-zod` (§2.5) and the migration ladder of ADR
  0047 — is downstream of whether this project tracks 0.x or moves to the 1.0 rc.
- **`typescript` 7 and `pnpm` 12 are both one major ahead of what the generator writes.** ADR 0053
  says to own the output outright and never depend on the generator again; the generator's version
  pins are part of that output, and inheriting them silently is the opposite of owning them.

---

## 6. The other claims in the ticket and its ADRs

### 6.1 "Shared packages exist from this commit: the API contract, the database schema, the Zod schemas, and design tokens as plain TypeScript rather than a Tailwind config"

**CONTRADICTED as a description of what the scaffold gives you — two of the four do not exist, and
one of the two missing ones exists in exactly the form ADR 0052 rejects.**

The generator produces `packages/{api,config,db,env,ui}`. Mapping against ADR 0052's four:

| ADR 0052 requires | Generated? |
|---|---|
| The API contract | **Yes** — `packages/api`, exporting `appRouter` and `AppRouterClient`. |
| The database schema | **Yes** — `packages/db`, though `src/schema/index.ts` is `export {};`. |
| The Zod schemas | **No.** No such package. `zod` is a dependency of five packages and `@orpc/zod` converts schemas for OpenAPI, but there is no shared schema package and no schemas in it. |
| Design tokens as plain TypeScript, **not** a Tailwind config | **No, and worse than absent.** |

On the fourth: `grep -rln "token" packages apps --include="*.ts" --include="*.tsx"` returns nothing.
**[Recounted 2026-09-10 under CNCORE-3: the file holds 102 declarations - 32 in `:root`, 31 in `.dark`, 39 in `@theme inline`. The 84 below is wrong; ADR-0052 carries the correction.]** The tokens exist as **84 CSS custom property declarations** in
`packages/ui/src/styles/globals.css` — a `:root` block of `oklch()` values, a `.dark` block
overriding them, and an `@theme inline { ... }` block re-exporting each one to Tailwind as
`--color-*: var(--*)`.

Strictly, the ticket's phrasing is satisfied on a technicality — there is no `tailwind.config.js`
anywhere (Tailwind v4 is CSS-first, so `find . -name "tailwind.config*"` is empty). But the
substance of ADR 0052 is that tokens must be **plain TypeScript**, and they are CSS custom
properties. Converting them is day-one work that the ticket does not list and that touches every
generated `packages/ui` component.

**This is the second new defect. Add it: the generated design tokens are the form ADR 0052 rules
out, and two of the four required shared packages have to be created from nothing.**

### 6.2 ADR 0052: "CSS custom properties do not cross to React Native — two independent sources agreed on that"

**CONTRADICTED for the path this project would actually take, though true of bare React Native.**

React Native's own style system has no CSS custom properties, so the claim holds for RN with no
styling library. But a Tailwind-based codebase reaching React Native goes through NativeWind, and
NativeWind implements them. `https://www.nativewind.dev/v5/api/vars`, fetched 2026-09-10
(NativeWind v5, pre-release):

> `vars` is a function that takes a dictionary of CSS variables and returns a style object. When
> applied to a component's `style` prop, **the variables flow down the component tree, just like CSS
> custom properties.**

NativeWind's own changelogs describe CSS-variable support arriving in v4/v4.1 and being extended in
v5 ("custom values (CSS Variables) to create themes, sub-themes and dynamic styles"). And the
generator now ships `native-uniwind` and `native-unistyles` as `--frontend` choices, so the RN path
is a first-class option in this very stack.

**The decision is not falsified — plain TypeScript tokens are still the more portable choice, and
they cross to *any* consumer, NativeWind or not.** What is falsified is the stated *reason*. If ADR
0052's justification is being relied on, restate it as "plain TypeScript tokens do not require a
styling library to interpret them", which is true, rather than "CSS custom properties do not cross
to React Native", which NativeWind contradicts. The ADR should also name its "two independent
sources", which it does not; as written that half of the sentence is **UNFOUNDED** — nothing in this
run located them.

### 6.3 "No dependency on create-better-t-stack remains"

**CONFIRMED as achievable, and there is exactly one concrete artifact to delete.** The generator
writes `bts.jsonc` at the repo root, whose own header says:

```
// Better-T-Stack project metadata
//
// Keep this file to use the `add` command.
```

with `"$schema": "https://r2.better-t-stack.dev/schema.json"` and the full `reproducibleCommand`.
Deleting it is what satisfies the criterion; keeping it is what a later agent would use to run
`create-better-t-stack add`, which is the dependency ADR 0053 forbids. Nothing else in the tree
references the generator — no dependency, no script, no config. `bts.jsonc` is the whole of it.

Worth preserving the `reproducibleCommand` string in a commit message or ADR before deleting the
file, since it is the only record of how the tree was produced.

### 6.4 ADR 0053: "the generated db schema file is literally `export {}` and the API router is a four-line health check"

**CONFIRMED, verbatim.** `packages/db/src/schema/index.ts` is one line: `export {};`. And
`packages/api/src/routers/index.ts`:

```ts
export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
};
```

Four lines, as claimed. The "nothing to rip out" argument holds.

### 6.5 The acceptance criteria "`pnpm test` runs a test and passes" and "CI runs the test suite and is green"

**Neither is close to true of the scaffold, and one of them has a second obstacle beyond the missing
harness.** No `test` script exists anywhere and `turbo.json` has no `test` task (§2.1) — that is the
known gap. The second obstacle is §4.2: the three `interactive: true` db tasks abort turbo before
any command runs in a non-TTY, so a CI job that applies a schema before testing fails on task
configuration rather than on a test. Both must be fixed for the second criterion to be reachable.

Turborepo's own Vitest guide is the shape to copy
(`https://turborepo.dev/docs/guides/tools/vitest`, via context7 2026-09-10):

> When using Vitest with Turborepo, it is recommended to define two separate tasks: one for standard
> test execution and one for watch mode. Standard test tasks are suitable for CI environments where
> the process exits upon completion, allowing for caching. Watch mode tasks are considered
> long-running development processes that do not exit, and therefore should be configured without
> caching and marked as persistent in the Turborepo configuration.

That is: `"test": {}` (cached, CI-safe) and `"test:watch": { "cache": false, "persistent": true }`.
Note that the watch task gets `persistent`, not a bare `interactive` — the same rule the generated
db tasks break.

### 6.6 A generated file that rewrites itself, which "own the output" has to account for

**Worth recording; not a claim in the ticket, but it contradicts the spirit of "own the output
outright".** The generator ships `apps/web/AGENTS.md`, and the file says of itself:

> This block is written and re-added by `next dev` — verify at
> `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only
> re-creates the uncommitted change; committing it with your work keeps the tree clean.

So one generated file is regenerated by Next.js itself on every `next dev`. Deleting it as
"generator output we now own" produces a permanently dirty working tree. Commit it, or configure
Next to stop writing it — but decide, because the default is a file that reappears.

---

## 7. Spot-check of ADR 0053's "considered options"

These are ADR claims rather than ticket claims, and `verify-adr-products.md` §35 already covers them
in depth (also dated 2026-09-10). Two cheap re-checks this run, one of which has moved since:

**`create-t3-turbo` "default branch unmoved since 2025-12-12" — CONFIRMED.**
`gh api repos/t3-oss/create-t3-turbo/commits/main` returns
`{"sha":"8f945b7b","date":"2025-12-12T02:00:04Z","msg":"for real..."}`, while the repo's `pushed_at`
reads `2026-09-10T02:03:35Z`. The gap between the two is Renovate pushing to its own branches — which
is precisely the ADR's own point about review sites reading Renovate branches, so the ADR is right
about the mechanism as well as the date. The better-auth pin is also confirmed: the repo's
`pnpm-workspace.yaml` catalog holds `better-auth: 1.4.0-beta.9`, `@better-auth/cli: 1.4.0-beta.9`
and `@better-auth/expo: 1.4.0-beta.9`.

**"…against a stable 1.7.3" — CONTRADICTED as of today, and it changed this morning.**
`better-auth` `dist-tags.latest` is now **1.6.31**, published **2026-09-10T09:22:22Z** — roughly an
hour before this check. Version 1.7.3 does exist (GitHub release `v1.7.3`, 2026-09-06,
`prerelease: false`), as do 1.7.0, 1.7.1 and 1.7.2, but the `latest` tag has been moved back onto
the 1.6 line, and 1.7.0 now also carries `rc: 1.7.0-rc.6` and `beta: 1.7.0-beta.10`. So
`npm install better-auth` today installs **1.6.31**, not 1.7.3. `verify-adr-products.md` line 2444
records "1.7.3 (published 2026-09-06)", which was true when written and is no longer the version a
fresh install resolves.

This has no bearing on CNCORE-3 — the config is `--auth none` and no `better-auth` package appears
anywhere in the generated tree. It is recorded only because a figure verified earlier the same day
moved, which is the argument for re-checking rather than citing.

**`ShipFullStack`** resolves to `sunshineLixun/ShipFullStack`, `pushedAt` `2026-05-28T01:11:22Z` —
consistent with the ADR's "tip is a README edit from 2026-05-28". Not re-checked further;
`verify-adr-products.md` §35.2 has the full enumeration.

`next-forge` and `start-ui-web`'s "~30% / ~15% survives" figures are estimates, not checkable
facts — **JUDGEMENT**, as `verify-adr-products.md` also concluded.

---

## 8. Summary

**38 claims checked. 28 CONFIRMED, 6 CONTRADICTED, 1 UNFOUNDED, 3 JUDGEMENT.**

Counted as: §1 two, §2 five, §3 three, §4 six, §5 ten version figures, §6 five, §7 four, plus the
"poorly documented" characterisation split out from §3.2.

Five of the six contradictions bear on CNCORE-3 directly; the sixth (§7, `better-auth`) is an ADR
0053 footnote with no effect on this ticket, since the config is `--auth none`.

The ticket's core is sound: the generator exists at 3.42.2, every configuration option it names
still exists, and **all five of the claimed defects are real and were reproduced against the tree
the generator produced today**. What does not survive is one of the two justifying "traps", and two
of the six items on the "keep, it already works" list.

### 8.1 CONTRADICTED

| # | Claim | What is actually true, 2026-09-10 |
|---|---|---|
| 1 | ADR 0053 / ticket: getting workspace packages consumed by **Next 16 without `transpilePackages`** is a poorly documented trap | Not a trap and not poorly documented. The Next.js docs (`/docs/app/api-reference/config/next-config-js/transpilePackages`, page version 16.3.4, lastUpdated 2026-05-27) open the "When you need it" section with: "**Turbopack transpiles workspace packages (npm, pnpm, or Yarn workspaces) in your monorepo automatically under both routers. Webpack does the same for the App Router.**" Every remaining case is `node_modules` or the Pages Router. Confirmed empirically: the generated tree contains no `transpilePackages` and `next build` succeeded. **This removes one of ADR 0053's two stated reasons for using a generator at all.** |
| 2 | Keep "the turbo DB task flags (`cache:false` plus `persistent`/`interactive`)" | `cache:false` and `persistent` are right, but `db:push`, `db:generate` and `db:migrate` carry `interactive: true` **without** `persistent`. Turborepo's reference says of `interactive`: "**Must be used with `persistent`.**" In a non-TTY the run aborts: `x Invalid task configuration ... Cannot run interactive task "@cbts-check/db#db:generate" without Terminal UI`. Reproduced on turbo 2.10.12; the root `turbo.json` already sets `"ui": "tui"` and `TURBO_UI=true` did **not** help. **Any CI job that applies a schema before tests dies here** — directly against the acceptance criterion "CI runs the test suite and is green". Fix: drop `interactive` from those three. |
| 3 | Keep "an env package validated at the top of the Next config so a missing variable fails the BUILD not the request" | The import is there (`next.config.ts` line 1: `import "@cbts-check/env/web"`), but `packages/env/src/web.ts` is `createEnv({ client: {}, runtimeEnv: {} })` — an empty schema. `DATABASE_URL` lives in `env/server.ts`, whose only importer in the whole tree is `packages/db/src/index.ts`, which `apps/web` never imports. **Proved: with `apps/web/.env` emptied, `pnpm build` succeeded cleanly.** A missing variable fails the request, not the build — the exact opposite of the claim. This belongs on the defect list, not the keep list. Fix: also `import "@cbts-check/env/server"` in `next.config.ts` and put the real variables in the server schema. |
| 4 | Acceptance criterion: "Shared packages exist from this commit: the API contract, the database schema, **the Zod schemas**, and **design tokens as plain TypeScript** rather than a Tailwind config" | Two of the four do not exist. There is no Zod schema package. The design tokens exist as **84 CSS custom properties** (a recount under CNCORE-3 makes it 102: 32 + 31 + 39) in `packages/ui/src/styles/globals.css` (`:root` + `.dark` + an `@theme inline` block), which is the form ADR 0052 rules out — `grep -rln "token" --include="*.ts" --include="*.tsx"` returns nothing. (There is no `tailwind.config.*`, so the letter of "rather than a Tailwind config" holds; the substance does not.) |
| 5 | ADR 0052: "CSS custom properties **do not cross to React Native**" | True of bare React Native, false of the path a Tailwind codebase would take. NativeWind implements them: "`vars` is a function that takes a dictionary of CSS variables and returns a style object… **the variables flow down the component tree, just like CSS custom properties**" (nativewind.dev/v5/api/vars, 2026-09-10). The generator itself now offers `native-uniwind` and `native-unistyles` frontends. The **decision** still stands; the **reason** needs restating as "plain TypeScript tokens need no styling library to interpret them". |
| 6 | ADR 0053: create-t3-turbo pins better-auth 1.4.0-beta.9 "**against a stable 1.7.3**" | `better-auth` `dist-tags.latest` is **1.6.31**, published 2026-09-10T09:22:22Z — about an hour before this check. 1.7.0 through 1.7.3 exist as GitHub releases (v1.7.3, 2026-09-06, `prerelease: false`), but `latest` has been moved back to the 1.6 line and 1.7.0 now also carries `rc: 1.7.0-rc.6`. A fresh `npm install better-auth` resolves **1.6.31**. No bearing on CNCORE-3 (`--auth none`, no better-auth anywhere in the tree); recorded because a figure verified earlier the same day in `verify-adr-products.md` line 2444 has already moved. |

### 8.2 UNFOUNDED

| # | Claim | What would settle it |
|---|---|---|
| 7 | ADR 0052: design tokens as plain TypeScript because CSS custom properties do not cross to React Native — "**two independent sources agreed on that**" | The two sources are not named anywhere in the ADR, and nothing in this run located them. Name them in the ADR, or drop the appeal to them — especially now that the NativeWind documentation cuts against the claim they were cited for (§6.2). |

### 8.3 JUDGEMENT

| # | Claim | Note |
|---|---|---|
| 8 | The Tailwind-v4-across-a-workspace-boundary trap is "**poorly documented**" | The trap itself is **CONFIRMED** and real: `node_modules` is excluded from scanning by default and the scan origin is the CWD, so a shared UI package's classes vanish without help. But `@source`, its stylesheet-relative resolution, `source()` and `source(none)` are all documented on one Tailwind page. What is genuinely undocumented is the *direction* the generator uses — the stylesheet living inside the package and reaching out via `@source "../../../apps/**/*.{ts,tsx}"`, where the docs only show an app reaching in. "Under-documented in this direction" is accurate; "poorly documented" overstates it. |
| 9 | New CLI options the ADR predates — `--payments`, `--template`, `--web-deploy`, `--server-deploy`, the `create-json` / `schema` / `history` subcommands (§1.4) | Informational. None changes the ticket's config, but `--payments none` and the two deploy flags must be passed explicitly for a fully non-interactive run. |
| 10 | ADR 0053: next-forge "~30% survives", start-ui-web "~15% survives" (§7) | Estimates, not checkable facts. `verify-adr-products.md` reached the same conclusion. |

### 8.4 Five things to add to the ticket before it is worked

Not claim verdicts — work the ticket does not currently name, each established above.

1. **A sixth defect: the three `interactive: true` turbo db tasks.** They make CI impossible for any
   job that touches the database (§4.2).
2. **A seventh defect: the env validation does nothing.** §4.3 — currently miscategorised as
   something to keep.
3. **Widen defect four from "the api package" to "the api and db packages."**
   `packages/db/tsconfig.json` is byte-identical to `packages/api/tsconfig.json`, with the same dead
   `composite`/`outDir`/`declaration` block and no build script (§2.4).
4. **Two of the four shared packages have to be created, not kept** — Zod schemas, and design tokens
   as TypeScript replacing the stylesheet's custom properties (§6.1; recounted as 102, not 84).
5. **Name versions.** `vitest` 5.0.0 is seven days old; `drizzle-orm` stable is frozen at 0.45.2
   while 1.0.0 sits at rc.5; `typescript` and `pnpm` are each one major ahead of what the generator
   pins (§5.1). "Own the output" includes owning its version pins.

Two smaller notes: the flag is `--db-setup`, not `--dbSetup`, and `--runtime none` is **mandatory**
with `--backend self` (§1.2); and `apps/web/AGENTS.md` is rewritten by `next dev` on every run, so
"delete the generator's files" needs a decision about that one (§6.6).

### 8.5 Can CNCORE-3 be worked as written?

**Not as written — it needs editing first, but the edit is small and the ticket's spine is intact.**

Nothing here falsifies the decision to scaffold with create-better-t-stack, and nothing here
invalidates the five defects, which are all real. But two of the six things the ticket instructs the
implementer to **keep** are wrong: the turbo db-task flags will break the ticket's own CI acceptance
criterion, and the env validation does not do the thing it is being kept for. An implementer
following the ticket literally would preserve both, and would discover the first only when CI fails
and the second only in production. Add them as defects six and seven, widen defect four to cover
`packages/db`, and note that the Zod-schema and design-token packages are new work rather than
generator output. Then it can be worked.

The `transpilePackages` correction (§3.1) does not block the work — it weakens ADR 0053's rationale
rather than the ticket's instructions — but ADR 0053 should be amended, because it is the document a
later reader will use to justify keeping the generator in the loop.

