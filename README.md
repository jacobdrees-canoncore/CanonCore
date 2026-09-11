# CanonCore

A self-hosted catalogue for collections that do not fit one folder tree, built around
multi-placement: one item sitting in many orderings at once, each with its own position. It is
domain-general, and it is a media server in its own right rather than a client of Plex or Jellyfin.

`CONTEXT.md` is the glossary and is binding on names in code and UI copy alike. `docs/adr/` holds
the decisions and the reason each was taken.

## Installing it

Requires Docker, and nothing else. No checkout of this repository, no Node, no
toolchain: the image carries the app and its migration ladder.

```bash
mkdir canoncore && cd canoncore
curl -fsSLO https://raw.githubusercontent.com/jacobdrees-canoncore/CanonCore/main/compose.yaml
curl -fsSL -o .env https://raw.githubusercontent.com/jacobdrees-canoncore/CanonCore/main/.env.example

# Open .env and set POSTGRES_PASSWORD to something long. Nothing else is required.

docker compose up -d
```

CanonCore is then on <http://localhost:3000>. **The directory name is the Compose
project name**, so keep it: `compose.yaml` deliberately sets no `name:` of its own,
for the reason written in the file. The catalogue itself lives in a volume named
`canoncore_data` and survives the directory being renamed or the stack being
recreated.

The container **migrates the database and only then serves it**. A migration that
fails takes the container down with it rather than answering requests against a
database in an unknown shape, so `docker compose logs canoncore` is the first
place to look if nothing answers.

### What it reads

The app refuses to start unless `DATABASE_URL` is set, and `compose.yaml` builds
that from `POSTGRES_PASSWORD` so there is only ever one copy of the password.

| Variable | Set by | What it is |
|---|---|---|
| `DATABASE_URL` | `compose.yaml`, from `POSTGRES_PASSWORD` | **Required.** The Postgres the catalogue lives in. The app validates it at build and at boot, so an absent or empty one is a failure at the start rather than at the first request. |
| `POSTGRES_PASSWORD` | you, in `.env` | **Required.** The database password. Compose refuses to start without one rather than defaulting to something nobody would change. |
| `PROVIDER_ALLOWLIST` | you, in `.env` | The hosts and address ranges a Provider may be fetched from, separated by commas or whitespace. **Empty refuses every Provider**, which is the default and is deliberate (ADR-0034): a fresh instance reaches nothing at all until you name a host. An empty catalogue is that setting rather than a fault, and the front page says so. |
| `CANONCORE_PORT` | you, in `.env` | The host port to answer on. The container always serves 3000; this is only the host side of the mapping. Defaults to 3000. |
| `NODE_ENV` | the image | Already `production` in the image. Nothing to set. |

`.env.example` documents the same set and is the file to copy.

### Upgrading

```bash
docker compose pull && docker compose up -d
```

The new container applies whatever rungs of the ladder are missing before it
serves, so an upgrade is a pull and a restart. The volume is not touched.

## Layout

```
apps/
  web/          Next.js app; also the server (the oRPC handlers mount in one catch-all route)
packages/
  api/          the API contract: the oRPC router and its context
  db/           the Drizzle schema and the migration ladder
  schemas/      hand-written Zod, shared by the contract and its consumers
  tokens/       design tokens as a plain TypeScript object
  ui/           shared components and the stylesheet that mirrors the tokens
  config/       the shared tsconfig base; no TypeScript of its own
```

Packages export TypeScript source directly and have no build step.

## Running it

Requires Docker and Node 24 -- the newest LTS line. ADR-0112 has the rule, the reason, and the date
the rule moves to 26.

pnpm's version is the `packageManager` field's, so install corepack and let it read that field
rather than installing pnpm by hand:

```bash
npm install -g corepack   # Node stopped bundling corepack from the 25 line on
corepack enable

pnpm install
pnpm db:start   # Postgres 18 in Docker, on port 55432
pnpm db:setup   # this worktree's own database: created, migrated, seeded, .env written
pnpm dev        # http://localhost:3001
```

**`corepack enable` alone is no longer enough, and that is not a local problem.** The Node TSC
stopped distributing corepack from the 25 line on, so on any major above 24 the bare instruction
fails with `command not found`. Installing it from npm first works on every major -- checked
2026-09-11 in `node:24-alpine`, which still bundles it, in `node:26-alpine`, which does not, and on
an nvm-managed v24.19.0, where it upgraded the bundled corepack rather than colliding with it.

**Installing pnpm globally instead has a sharp edge**, which is why the instruction above does not.
pnpm only switches itself to the `packageManager` version when that version is NEWER than the one
you already have. Point it at an older pin and `pnpm` exits 1 having printed nothing at all -- no
error, no version, no clue (measured 2026-09-11 on both images). Corepack handles both directions.

`db:setup` prints the URL of the item it seeded. Open it. It is safe to re-run: it never drops
anything, never overwrites `apps/web/.env`, and says so when an existing one names a different
database. `pnpm db:seed` adds another item to whatever `.env` points at.

**There is no `db:push`.** It was removed with migration 1. `drizzle-kit push` diffs the schema
straight onto a database and writes no rung, so a database built that way has a shape no migration
produced and neither the ladder nor its checks can reason about it (ADR-0047). The ladder is the
only way a database gets its shape here.

The OpenAPI reference is served at `/api/rpc/api-reference`.

### One container, a database per worktree

**The container publishes 55432, not 5432, and that is not a preference.** A machine that already
runs PostgreSQL shadows the container SILENTLY on 5432: Docker binds the `0.0.0.0` wildcard, a local
server binds the more specific `127.0.0.1`, and the specific bind wins for `localhost`. Nothing
errors. `docker compose up` reports success, the container sits there healthy, and every connection
goes to the other server. This repo shipped a whole ticket's tests against Homebrew's 17.11 that way
while believing they ran on the container's 18.6. Supabase's CLI defaults to 54322 for the same
reason. Set `CANONCORE_DB_PORT` if 55432 is taken too.

**Every CanonCore worktree shares ONE container**, because `name: canoncore` pins the Compose
project and Compose resolves it from any directory. That is fine and cheap. Sharing one *database*
is not: the suites drop and recreate `<database>_test`, so two worktrees testing at once would take
each other's out mid-run. `pnpm db:setup` gives each worktree a database named after its branch —
`canoncore_cncore_4_item_on_a_page` — so `_test` and `_test_web` never collide either. See ADR-0104.

## Checks

```bash
pnpm typecheck        # every package, including the shared tsconfig itself
pnpm test             # Vitest; needs a running Postgres
pnpm test:e2e         # builds Next, starts it, asks it for a page over HTTP
pnpm db:check-ladder  # the two checks Drizzle's migrator does not perform
pnpm build
```

**`pnpm test` needs a database.** `packages/db` and `packages/api` read real tables, so the suites
build a `<database>_test` from empty, run the whole ladder against it, and drop it again on the next
run. `pnpm db:start` and `pnpm db:setup` are enough. Nothing else in the repo touches Postgres.

`pnpm test:e2e` is separate on purpose: it runs a production `next build` before its first
assertion, and that does not belong in front of every local test run. It is the only check that
fails if the page is unreachable — every other suite passes with the app never having been served.

`pnpm db:check-ladder` catches the two things Drizzle silently allows: a migration spliced in below
the high-water mark (skipped forever, reported as success) and a shipped migration edited after the
fact (Drizzle stores a SHA-256 and never reads it back). See ADR-0047.

`packages/config` contains no TypeScript, but it is typechecked all the same: `src/base-config.test-d.ts`
asserts through `@ts-expect-error` that the strictness every other package inherits is actually on,
and fails if any of it is switched off.

CI runs each of these as a separate job, plus a secret scan and a job asserting that a missing
`DATABASE_URL` fails the build rather than the first request. The migration job does two builds: the
ladder from empty, and the ladder applied on top of the base branch's — which is the upgrade path a
real installation takes, and the one an empty-to-head gate cannot see.

`DATABASE_URL` is validated at the top of `next.config.ts`, so the build fails without it. That is
deliberate and is the subject of one of the CI jobs; see `docs/adr/`.

## What a fork cannot run

Two CI jobs fail for anyone who is not this repository, and that is the licence rule operating
rather than a broken pipeline.

`One contract, both providers, no app` and `Import and browse over HTTP, against the real provider`
run the two CMPP providers as service containers, pulled from `ghcr.io/jacobdrees-canoncore/*`.
Both images are **private**: `provider-wiki` is pinned private permanently because the archive it
reads was licensed to one person, and `provider-tmdb` is private by a recorded choice with its own
trigger. The registry grant is made to a REPOSITORY, so a fork holds none and those jobs die at
`Initialize containers` on the single word `denied`.

Everything else runs anywhere: type-check, lint, the unit and database suites, the migration ladder,
the page over HTTP, and the secret scan.

`pnpm test:contract` degrades rather than failing usefully. With `PROVIDER_WIKI_URL` and
`PROVIDER_TMDB_URL` unset only the local conformance witness participates, the witness declines
`browse`, and the suite's own guard trips on "Nothing under test declares `browse`".

The decisions are `docs/adr/0089-provider-distribution-tiers.md`.

## Working on it

Design tokens live in `packages/tokens` as TypeScript, which is the form ADR-0052 requires.
`packages/ui/src/styles/globals.css` declares the same values as CSS custom properties, because a
stylesheet cannot import TypeScript. **Change both, or the test in `packages/ui` fails.**

Shared UI primitives come from shadcn:

```bash
pnpm dlx shadcn@latest add dialog popover table -c packages/ui
```

Import them as `@canoncore/ui/components/<name>`.
