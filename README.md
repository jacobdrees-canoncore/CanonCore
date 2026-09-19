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

# Set the database password. Letters and digits only: it ends up inside a
# connection URI, and : / ? # [ ] @ % would break it. Appending is enough --
# a later line in .env wins, so this fills in the blank the sample file leaves.
echo "POSTGRES_PASSWORD=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)" >> .env

# And the password you log in with, which is what lets this instance be changed
# rather than only read. Print it and keep it; it is the only copy.
echo "OWNER_PASSWORD=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)" >> .env
grep OWNER_PASSWORD .env

docker compose up -d
```

Reading the catalogue needs no password and changing it does, so the first thing
to do at <http://localhost:3000/login> is log in with the one you just generated.
Leave `OWNER_PASSWORD` empty instead and the instance is read-only for everybody,
which is how the public demo runs.

CanonCore is then on <http://localhost:3000>. **The directory name becomes the
Compose project name**, because `compose.yaml` deliberately sets no `name:` of
its own; the reason is written in the file. The catalogue itself lives in a
volume named `canoncore_data`, which is pinned rather than derived from the
project, so it survives the stack being recreated and the directory being
renamed -- measured, not assumed. Compose does warn about the project label after
a rename, and the data it uses is the right data.

The container **migrates the database and only then serves it**. A migration that
fails takes the container down with it rather than answering requests against a
database in an unknown shape, so `docker compose logs canoncore` is the first
place to look if nothing answers.

**Which Providers this instance reaches is configured at
<http://localhost:3000/settings>**, not in `.env`. Name a Provider there by its
base URL, and write the hosts and address ranges it may be fetched from into the
allowlist beside it; both take effect on the next request, with nothing to
restart. **An empty allowlist refuses every Provider**, which is the default and
is deliberate (ADR-0034): a fresh instance reaches nothing at all until you name
a host, so an empty catalogue on a first run is that setting rather than a
fault. A Provider needs to be in both -- named so it is searched, allowlisted so
the request is permitted -- and the settings page says which of the two is
refusing one.

### A Provider beside it

Naming a Provider on that page only works if this install can reach it. One on
the open internet it can: the app has ordinary egress. **A Provider you run on
this same machine has to be on a Docker network the app is also on**, and
`compose.yaml` creates one for exactly that, called `canoncore_providers`.

Run the Provider with Compose too, in its own directory, and have its file join
that network rather than make one:

```yaml
services:
  the-provider:
    image: ...
    networks:
      - canoncore

networks:
  canoncore:
    name: canoncore_providers
    external: true
```

`external: true` there means find it, do not make it. **Bring CanonCore up
first**, because CanonCore's `compose.yaml` is the end that makes it: started
the other way round, the Provider stops with `network canoncore_providers
declared as external, but could not be found`.

Then name it on the settings page **by its service name and the port it serves
on, never by an address on this machine**: the service called `the-provider`
above answers the app at `http://the-provider:8080`. Compose gives a service its
own name as a hostname on every network it joins, and that holds across Compose
projects, which is what an install and a Provider beside it are. **That port is
the one the Provider listens on INSIDE its container** -- its own instructions
say which, and it is not the `ports:` line, if it has one: a published port maps
the Provider onto this machine, and the app is not coming from this machine.

**The allowlist beside it needs two entries, not one**, and this is the step that
catches people out. A Provider on that network answers on a container address,
which is a PRIVATE address, and CanonCore admits a private one only where an
allowlisted range covers it -- so the name alone gets the Provider named and then
refused at the socket. Add the name and the range the network hands out. Docker
picks that range per machine, so read yours off it:

```bash
docker network inspect canoncore_providers -f '{{range .IPAM.Config}}{{println .Subnet}}{{end}}'
```

With `the-provider` and, say, `172.19.0.0/16` both in the allowlist, the settings
page stops giving that Provider a reason and the import page can search it.
(`println` because an IPv6-enabled network has two ranges, and both belong in the
allowlist; without it they print glued together as one string that is neither.)

**Read it again if that network is ever recreated.** Docker allocates the range
when it makes the network, and a fresh one can be handed a different one, after
which a stale allowlist entry refuses the Provider at the socket exactly as no
entry did. In ordinary use it stays put: `docker compose down` cannot take the
network with it while a Provider is still attached, so it survives the install
stopping and starting.

**Anything the Provider asks YOU to open is a different address.** A container
hostname means nothing to a browser, so a Provider with a page of its own -- one
where you hand it a Credential, say -- publishes a port to this machine for it
and its own instructions say which. `http://localhost:<that port>` is yours;
`http://the-provider:8080` is the app's, and the two are not interchangeable.

### What it reads

The app refuses to start unless `DATABASE_URL` is set, and `compose.yaml` builds
that from `POSTGRES_PASSWORD` so there is only ever one copy of the password.

| Variable | Set by | What it is |
|---|---|---|
| `DATABASE_URL` | `compose.yaml`, from `POSTGRES_PASSWORD` | **Required.** The Postgres the catalogue lives in. The app validates it at build and at boot, so an absent or empty one is a failure at the start rather than at the first request. |
| `POSTGRES_PASSWORD` | you, in `.env` | **Required, letters and digits only.** The database password. Compose refuses to start without one rather than defaulting to something nobody would change, and it composes `DATABASE_URL` from it -- so a password carrying `: / ? # [ ] @ %` makes that URI invalid and the container crash-loops on `ERR_INVALID_URL` before it ever serves. The command above generates a safe one. |
| `OWNER_PASSWORD` | you, in `.env` | The password you log in with. Everything that CHANGES the catalogue is behind it -- creating and editing an Item, placing it in a Container, reordering one, writing a note, importing from a Provider, browsing a Container in from one, purging one -- and reading is not, so anyone you show your instance to can browse it. **Empty means nobody can log in**, which is how the public demo runs read-only (ADR-0044) rather than a half-configured install. At least 12 characters; a shorter one stops the app starting. |
| `CANONCORE_PORT` | you, in `.env` | The host port to answer on. The container always serves 3000; this is only the host side of the mapping. Defaults to 3000. |
| `DATABASE_MAX_CONNECTIONS` | you, in `.env` | How many PostgreSQL connections this instance may hold open at once. **Defaults to 10**, which is what it has always held, so leave it unset unless the database is not yours alone. A PostgreSQL admits a fixed number of clients (100 by default) and that budget is shared by everything pointed at it -- so an instance sharing a server with other applications, or with a second CanonCore, can exhaust it. The symptom is not this instance failing to start: it is `sorry, too many clients already` landing on whichever application asked last. |
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

**Real data comes from a dump, never from an install.** `pnpm db:restore <dump>` DROPS this
worktree's database and creates it from a `pg_dump --format=custom` archive, then migrates it up to
this branch's ladder. It refuses a dump whose ladder has run a rung this branch lacks, and leaves no
database behind when it does. Give it the file's full path, because turbo runs it from `packages/db`.
Where the Owner's dumps come from, and what they rehearse, is ADR-0048.

**There is no `db:push`.** It was removed with migration 1. `drizzle-kit push` diffs the schema
straight onto a database and writes no rung, so a database built that way has a shape no migration
produced and neither the ladder nor its checks can reason about it (ADR-0047). The ladder is the
only way a database gets its shape here.

The OpenAPI reference is served at `/api/rpc/api-reference`.

### Importing a list of Containers

A Provider's `browse` takes ONE container id and CMPP has no operation answering "which Containers
do you have" (ADR-0033), so importing a corpus means handing over the ids yourself. `import:list`
walks them, one at a time, into a RUNNING instance:

```bash
OWNER_PASSWORD=... pnpm --filter @canoncore/api import:list \
  --at http://localhost:3000 \
  --provider http://provider-wiki:8080 \
  --list ./timelines.txt
```

One id a line; blank lines and `#` comments are ignored. `--provider` is the Provider AS THE
INSTANCE REACHES IT, which is why a Compose service name belongs there rather than a URL that
resolves on your own machine.

**Stop it and run it again to carry on.** Where the walk got to is rows (ADR-0135), so the same
command resumes the same run and asks again only for what has not landed -- which includes whatever
refused, because a lapsed Credential does not stop a run, it makes the rest of it refuse. One
Container a call, because a Provider is one process.

**It needs this checkout.** An install from `compose.yaml` alone has the app and its database and no
way to run this, so bulk import is the Owner's path rather than a stranger's today. Importing one
Container at a time from `/import` is on every install.

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
is not: the suites drop and recreate a `<database>_test…` of their own, so two worktrees testing at
once would take each other's out mid-run. `pnpm db:setup` gives each worktree a database named after
its branch — `canoncore_cncore_4_item_on_a_page` — so `_test`, `_test_api` and `_test_web` never
collide either. See ADR-0104.

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

`One contract, both providers, no app` and `Import and browse over HTTP, against the real
provider-tmdb` run CMPP providers as service containers, pulled from
`ghcr.io/jacobdrees-canoncore/*` — both images for the first, and `provider-tmdb` alone for the
second, which drives the app against a provider and so needs one that can answer without a
Credential. Both images are **private**: `provider-wiki` is pinned private permanently because the
archive it reads was licensed to one person, and `provider-tmdb` is private by a recorded choice
with its own trigger. The registry grant is made to a REPOSITORY, so a fork holds none and those
jobs die at `Initialize containers` on the single word `denied`.

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
