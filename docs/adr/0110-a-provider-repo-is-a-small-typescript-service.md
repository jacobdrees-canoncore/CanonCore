---
status: accepted
---

# A provider repo is a small TypeScript service, and oRPC does not travel to it

A CMPP provider is its own repository holding TypeScript on the newest LTS Node major, Hono,
hand-written Zod, Vitest, Biome and a container image, plus `@duckdb/node-api` PINNED EXACTLY where
the provider reads the archive. The major is a RULE rather than a number, and which number it
selects today is below. [[0031-a-provider-is-a-url]] says where a provider lives and why; this
record says what is inside it, and [[0109-deployment-is-a-shape-not-a-vendor]] already fixes the
shape it deploys into.

The list is the least interesting part of this record. Two clauses do the work, and both are
negative.

## oRPC does not travel to a provider repo

oRPC's value is end-to-end TypeScript types across a boundary you own both sides of. ADR-0031 exists
in order NOT to own both sides — CanonCore knows "only a URL, a credential and a validated response
shape" — so a typed RPC client would recreate exactly the coupling the repo boundary is there to
remove, and it would do it in the most attractive possible way. That is why the refusal is written
down instead of left to judgement.

The incumbent frames its own equivalent contract the same way, which is the corroboration rather
than the reason. Plex reopened custom metadata providers as a plain HTTP contract, and said so
explicitly — `drzoidberg33`, carrying a Plex staff flag, on forums.plex.tv, read 2026-09-10:
"Developers are not restricted by any one language or technology to write these providers,
essentially anything that can serve an HTTP API can be used." A contract you can only implement in
TypeScript against a generated client is not that contract.

**ADR-0053's scaffold does not reach here either, by that record's own terms.** It survives a bespoke
schema "because there is nothing to rip out". A provider repo has no Next app, no UI package, no
Tailwind, no Drizzle, no Postgres and no Turborepo, so here there is nothing to keep.

## The CMPP response schema is written once per provider repo, on purpose

ADR-0031's "no shared code" reaches provider-to-provider as much as provider-to-app. The obvious
repair — a shared `@canoncore/cmpp` package — is precisely the coupling the repo boundary exists to
prevent, and it is attractive enough that someone will propose it. The refusal is recorded here so
that proposal meets a decision rather than a shrug.

**The anti-drift device is the contract test that calls BOTH providers over HTTP** and holds them to
one response shape. (Not to be read against ADR-0103's numbered seams, which are this app's and do
not reach a provider repo.) That is the designed substitute, not an accident of nobody getting round to the shared
package. Say so in each provider repo's own `CLAUDE.md` as well, because duplication with no visible
reason reads as a defect to the next person who finds it, and that person is right to ask.

## `@duckdb/node-api` is pinned exactly, and a caret is a live defect

Every published release is a semver PRERELEASE (`-r.N`). On 2026-09-10 `latest` was `1.5.5-r.4`
against DuckDB stable v1.5.5. Measured with semver 7.8.5 rather than reasoned about:

```
^1.5.5      vs 1.5.5-r.4  ->  NO MATCH   (it matches 1.5.5 and 1.5.6, neither of which exists)
^1.5.5-r.4  vs 1.5.5-r.4  ->  match
               1.5.5-r.5  ->  match
               1.5.6-r.1  ->  NO MATCH
```

So a caret range either matches nothing at all or silently freezes on the 1.5.5 line, and NEITHER
FAILURE ANNOUNCES ITSELF. The version is therefore written exactly, which is what DuckDB itself does
internally: `@duckdb/node-api@1.5.5-r.4` depends on `@duckdb/node-bindings` at exactly `1.5.5-r.4`
with no caret, and each platform package likewise.

**ADR-0101's PRINCIPLE carries over; its MECHANISM does not, and the difference matters here.** That
record puts every third-party range in one place and is explicit about which: the `catalog:` block of
`pnpm-workspace.yaml`, so that `a range written inline in a manifest is a defect`. A provider repo is
a single package with no workspace and therefore no catalogue, so its one place IS its
`package.json` — which is not the defect that record names, because there is no catalogue for the
manifest to be contradicting. What holds either way is the FORM: this is one of the pins that cannot
be a range at all.

**The legacy `duckdb` package is not the one to use, and the evidence is not a deprecation flag.**
Its own README says the original bindings "are deprecated in favor of the new and shiny
`@duckdb/node-api` package", and that it will be released for the DuckDB 1.4.x series but "*not* for
the DuckDB 1.5.x series ... any more". The registry bears that out: legacy stops at 1.4.4 while
DuckDB is at 1.5.5. But `npm view duckdb deprecated` is EMPTY and the repository is not archived, so
the case rests on the README and the release cadence. That is the same shape as
[[0102-drizzle-stays-on-the-stable-line]]'s case against `drizzle-zod`, and it is worth naming as
such: a package can be abandoned without ever being flagged as such, so a green `deprecated` field
proves nothing.

Prebuilt binaries ship for every target that matters, as `optionalDependencies` of
`@duckdb/node-bindings`: `linux-x64`, `linux-arm64`, both musl variants, `darwin-x64`,
`darwin-arm64`, `win32-x64` and `win32-arm64`. So no compiler on the rented box, and Alpine stays
available. The only non-platform transitive dependency is `detect-libc`.

## The rest of the stack, and the recommendation to overrule first

**TypeScript rather than Python**, because this repo already owns the toolchain, so a TypeScript
provider adds a repository rather than a stack. **This paragraph is about the LANGUAGE and decides
nothing about the MAJOR** -- it was written as "TypeScript on Node 24" and read afterwards as
pinning 24, which it never argued; the major has its own section below. The case for Python is real
and narrow — DuckDB's Python client is its most mature — but it applies to exactly one of the two
providers, and the two must be built alike because together they are the template for every
provider after them. A second language buys a second toolchain, a second CI shape, a second lint
config and a second dependency policy, for one repo's data layer. **This is a judgement rather than
a measurement, and it is recorded as one.**

**Zod, hand-written** — which here is the only option rather than a choice, because a provider has no
ORM to derive a schema from in the first place. ADR-0102 matters as the PRECEDENT that hand-written
Zod is a settled position in this project rather than a corner cut, so nobody arrives later proposing
a generator to fix it.

**Hono is the weakest recommendation in this record and the one most safely overruled.** It is the
smallest thing that gives routing and typed handlers; `app.request()` runs a handler in a test
without binding a socket, which is exactly what a contract wants tested; and being web-standard it
runs under `node:http` today while deciding nothing about later. Fastify's plugin ecosystem and
JSON-schema pipeline are its strengths and a four-route service needs neither. Express 5 is what
Plex's own example happens to use and carries no argument beyond that. Bare `node:http` is the
honestly simplest option and costs a hand-rolled router. All four ship the same contract and nothing
in `docs/adr/` constrains the choice, so overruling this paragraph costs nothing that the two above
it would cost.

**Vitest and Biome**, matching this repo, so a reviewer moving between repositories reads the same
output rather than learning a second set of failure messages.

**A container image**, because that is how a provider reaches CanonCore's CI as a service container.
Its VISIBILITY is not this record's to decide: [[0089-provider-distribution-tiers]] governs it, and
under that record a publicly pullable image is distribution.

## The Node major is not pinned to a NUMBER: the rule is the newest LTS line, and both providers move together

Before this section existed, this record named "Node 24" in four places and argued for it in none.
24 was simply the major that was current when the record was written, and the sentence above about
TypeScript-versus-Python is about the LANGUAGE. **It has already been read as a pin and acted on**
-- `provider-tmdb#4`, a Dependabot bump to `26-alpine`, was closed citing this record -- so the
silence was doing load-bearing work in two repositories. This section ends it.

**And it is worth being exact about what was wrong there, because it was not the outcome.** Under
the rule below that bump SHOULD have been closed: 26 is not an LTS line yet, and the move needs a
Dockerfile change the PR did not make. What was wrong was the REASON, which cited a pin this record
did not contain. A right answer resting on a sentence that is not there is still a defect, because
the next reader checks the sentence.

**The rule is: both provider repos run the NEWEST LTS major, and they change together.** Not a
number, because a number rots into exactly the confusion above. "Both together" is not new here --
it is the same clause that makes the two repos the template for every provider after them -- and it
is the half of the old reasoning that survives contact with the measurements below.

Node's own guidance is the owner of the rule rather than this record's invention:
"Production applications should only use *Active LTS* or *Maintenance LTS* releases"
(nodejs.org/en/about/previous-releases, read 2026-09-11). `Current` gets "most of the non-major
changes that land on main"; `Active LTS` is what "the Release team ... determined to be appropriate
and stable" (nodejs/Release `README.md`, same day).

**"NEWEST LTS" rather than "ACTIVE LTS", and the difference is not pedantry.** The obvious
assumption is that a line drops to Maintenance exactly as its successor becomes Active, leaving no
seam. The schedule does not work that way: 24 drops to Maintenance on 2026-10-20 and 26 does not
become Active until 2026-10-28. A rule reading "the Active LTS major" would therefore select NOTHING
for those eight days, which is how a rule written to survive the calendar fails on it. "The newest
major that has reached LTS" is defined at every instant, selects 24 across that window, and is still
inside Node's guidance, which permits Maintenance LTS as well as Active.

**Choosing to follow LTS at all is a JUDGEMENT, and is recorded as one**, in the same way the
TypeScript-versus-Python paragraph above is. The measurements below establish only that nothing in
this stack REFUSES 26; they cannot tell anyone whether to run a Current line. What decides that is
that a provider is a deployed service whose failures surface in another repository's CI, and Node's
own advice for that case is unambiguous. A project willing to track Current could overrule this
paragraph without touching a single measurement.

**What the rule selects, with the dates it turns on** -- from `nodejs/Release`'s `schedule.json`,
read 2026-09-11:

| Major | Status on 2026-09-11 | Active LTS from | Maintenance | End of life |
|---|---|---|---|---|
| 24.x (Krypton) | **Active LTS** | 2025-10-28 | 2026-10-20 | 2028-04-30 |
| 26.x | Current | **2026-10-28** | 2027-10-20 | 2029-04-30 |

So today the rule selects 24, which is where both repos already are -- a coincidence rather than a
cause, since they were put on 24 because it was current and this rule did not exist until now.
**On 2026-10-28 it selects 26, and from that date the bump is WANTED rather than refused.** That is
the point of writing a rule instead of a number: this record does not have to be edited again for
the next major, and a reader who finds "24" in the as-built sections below can tell a fact about
what was built from a constraint on what may be.

**The dates above are the schedule's and the RULE is what binds.** That page says "Dates are subject
to change"; if they move, the rule still selects correctly and nothing here needs editing. A date
quoted in this record or in a provider's Dependabot comment is a convenience for a reader, never the
thing to obey.

### The measurement this rests on: the DuckDB bindings DO load on Node 26

The one candidate reason that could have refused the major was `@duckdb/node-api`, pinned exactly at
`1.5.5-r.4` with eight prebuilt platform packages. Whether those load on a new major's ABI is the
thing that decides it, and it had never been run. **Measured 2026-09-11, in containers, on the two
platform packages the IMAGE can resolve** -- the provider ships from `node:*-alpine`, so musl, on
the two architectures in use; the four glibc and two `win32` packages were NOT exercised and are not
claimed:

```
node:26-alpine   Node v26.8.2   @duckdb/node-bindings-linux-arm64-musl   LOAD: OK
node:26-alpine   Node v26.8.2   @duckdb/node-bindings-linux-x64-musl     LOAD: OK   (--platform linux/amd64)
node:24-alpine   Node v24.21.0  @duckdb/node-bindings-linux-arm64-musl   LOAD: OK   (control)
```

Reproduce it with, in any of those images:

```
npm install @duckdb/node-api@1.5.5-r.4
node --input-type=module -e 'import {DuckDBInstance} from "@duckdb/node-api";
  const c = await (await DuckDBInstance.create(":memory:")).connect();
  console.log((await c.runAndReadAll("select 42 as answer, version() as v")).getRowObjects());'
```

Not merely `import`ed: each run opened an instance and ran a query, returning
`[{"answer":42,"v":"v1.5.5"}]`. A binding that resolves but cannot execute would have passed a
weaker check.

**And the mechanism is worth recording, because it is what makes this durable rather than lucky.**
The raw V8 addon ABI DID change across the major -- `process.versions.modules` is 137 on v24.21.0
and 147 on v26.8.2 -- so a native addon built against V8 directly would NOT have loaded. What did
not change is Node-API: `process.versions.napi` is 10 on both. `@duckdb/node-api` is a Node-API
addon (the package is named for it), and Node's own documentation is the owner of what that buys:
Node-API "will be Application Binary Interface (ABI) stable across versions of Node.js ... and allow
modules compiled for one major version to run on later major versions of Node.js without
recompilation", a guarantee the same page is explicit that the V8 and Node.js C++ APIs do NOT give
(nodejs.org/api/n-api.html, read 2026-09-11). That is why one prebuilt `.node` file spans majors. So
the expected answer for the NEXT major is also "it loads", and the reason is a stability guarantee
rather than a coincidence -- **but it is still a measurement to take rather than assume**, because
what is guaranteed is the ABI and not that DuckDB keeps shipping to it.

### The other two candidate reasons, and why neither refuses a major

**Native TypeScript execution does not refuse 26.** Each provider's `CLAUDE.md` records that Node 24
runs TypeScript directly, so there is no build step and no `dist/`. **Node 26 does the same, and
that was run rather than assumed**: an unannotated `.ts` file executed with no flags in
`node:26-alpine` on 2026-09-11. So this is a reason the providers have no build step, and not a
reason they stay on 24. It must not be offered as one.

**"Both providers must be built alike" does not refuse 26 either.** It argues the two repos match
each other, which is why the rule above moves them together, and says nothing about which major they
match on.

### What moving the major actually costs: corepack is gone from Node 25 onward

Not a refusal, a COST, and it is owed at the next major whenever that comes. **Measured 2026-09-11:**

```
docker run --rm node:24-alpine sh -c 'command -v corepack'  ->  /usr/local/bin/corepack
docker run --rm node:26-alpine sh -c 'command -v corepack'  ->  ABSENT
```

Both providers' Dockerfiles are `FROM node:24-alpine` and `RUN corepack enable` to get pnpm into the
image (checked in both repos on 2026-09-11), so both fail at that line: the `image` job on each of
`provider-tmdb#4` and `provider-wiki#9` exited 127 there. **That is what BLOCKED both bumps, which
is not the same as what either was closed on**, and the difference is this record's whole subject:
`provider-wiki#9` was closed on the build failure, `provider-tmdb#4` on a reading of this record
that it did not support. A blocker and a stated reason can differ, and when they do it is the stated
reason the next person inherits.

**This is permanent and it is not an image quirk.** The Node.js TSC voted on 2025-03-19 to "stop
distributing Corepack ... on future (i.e. 25+) release lines of Node.js", with 24.x keeping it as
experimental (nodejs/TSC#1697, recorded in the distribution policy by nodejs/node#61207, merged
2026-01-01). So every major from 25 on lacks it, and both Dockerfiles need another way to install
pnpm before either repo can move. Both, in the same change, or they diverge.

### What this means for the Dependabot rule in the provider repos

An `ignore` on major bumps is the right way to stop the weekly noise, and **a PERMANENT one would
contradict this section**, because under the rule the bump stops being noise and becomes the work.
Whatever form it takes in each repo, it carries this record as its reason and the expected date as a
convenience, so that lifting it is a scheduled act rather than a rediscovery -- and so that a
reviewer meeting it after that date knows to delete it rather than honour it. The RULE is what says
when, per the paragraph above; the date is there to be checked, not obeyed.

**BUILT IN `provider-wiki`, NOT YET IN `provider-tmdb`, and that asymmetry is itself a defect this
record names.** CNCORE-43 landed the `ignore` in `provider-wiki` and decided `engines` there.

**The rule is carried out and was verified rather than assumed.** A docker version-update job ran
against the merged config on 2026-09-11 and reported `All updates for node were ignored`, naming
`version-update:semver-major - from .github/dependabot.yml` as the reason, with `No PRs affected`
where the preceding job had affected `provider-wiki#9`. That distinction had to be checked: `#9` was
closed by hand first, which makes Dependabot go quiet about that release on its own, so silence
would have proved nothing and the job log is what proves it.

**`engines` was decided rather than tightened, and the decision is that it is a FLOOR.** `">=24"`
states the minimum the source needs -- native TypeScript execution -- and is deliberately not the
deployment pin, which is the `Dockerfile` and `ci.yml`. It therefore keeps admitting 26 on purpose
and needs no edit when the rule selects 26. Tightening it would enforce nothing regardless: pnpm
11.20.0 exits 0 on an unsatisfiable engine both with and without `engine-strict`, warning only,
which is ADR-0105's sentence in a second tool.

**`provider-tmdb` has the same docker entry with no `ignore` and the same `engines`, checked
2026-09-11.** So the two repos DIVERGE until CNCORE-49 closes it, and "both providers are built
alike" is the clause that divergence violates. That is the half still to watch, and a reader finding
the rule here and no rule in `provider-tmdb` has found the gap rather than a contradiction.

## Ruled out, with reasons

| Candidate | Why not |
|---|---|
| create-better-t-stack (ADR-0053) | Nothing it generates survives: no Next, no UI package, no Drizzle, no Turborepo. That record's own argument was "there is nothing to rip out"; here there is nothing to keep. |
| oRPC | Recreates the client/server type coupling ADR-0031 removes, and CMPP must stay implementable in any language. |
| A shared `@canoncore/cmpp` package | Forbidden by ADR-0031's "no shared code". The contract test over both providers is the named substitute. |
| The legacy `duckdb` package | Stops at 1.4.x while DuckDB is at 1.5.5, and its own README points at the replacement. |
| DuckDB's `httpserver` community extension | Serves arbitrary SQL over HTTP with an embedded playground UI, which is the opposite of "a validated response shape", and puts the archive's whole SQL surface on the network. Its own listing calls it experimental. |
| A monorepo per provider (ADR-0052) | NOT because a provider repo has one app — that record holds `even with one app in it`, so app count is not the discriminator. It is ruled out on the other half: its case is SHARED PACKAGES, and ADR-0031 forbids a provider repo shared code at all, so a monorepo here would have nothing to hold. |

## Deliberately not decided

**Whether the provider opens the archive read-only.** DuckDB's read-only mode permits concurrent
readers and a writable handle does not, so the flag decides whether anything else can query the
archive while the provider runs. Nothing in this repo says who else holds that file open. It is a
one-flag question the implementer settles in the moment, and the wiki provider's ticket carries it
as an acceptance criterion rather than as a decision here.

## Evidence

Measured against the npm registry and the DuckDB repositories on 2026-09-10: `@duckdb/node-api`,
`@duckdb/node-bindings` and its eight platform packages, the legacy `duckdb` package, Hono, Fastify,
Express and Zod. The semver ranges in the block above were computed with semver 7.8.5 rather than
reasoned about. The Plex quotation is from a staff-flagged post on forums.plex.tv read the same day.
Working, including the reference provider `plexinc/tmdb-example-provider` and why its dependency
list carries no weight, in `docs/research/multi-repo.md` section 6.

**The Node major section was measured separately, on 2026-09-11**, and nothing in it is carried over
from the day above -- which is the point, since the original wording's defect was resting on
whatever was current the day it was written. `@duckdb/node-api@1.5.5-r.4` was installed and QUERIED
in `node:26-alpine` (v26.8.2) on `linux-arm64-musl` and, under `--platform linux/amd64`,
`linux-x64-musl`, with `node:24-alpine` (v24.21.0) as the control; `process.versions.napi` and
`process.versions.modules` were read from the same containers, and an unannotated `.ts` file was run
with no flags in `node:26-alpine` to check native type stripping. Corepack's presence was probed in
both images, and both providers' `Dockerfile`, `package.json` and `.github/dependabot.yml` were read
the same day. The release dates are `nodejs/Release`'s `schedule.json` and `README.md`, the
production-use sentence is nodejs.org/en/about/previous-releases, the ABI-stability guarantee is
nodejs.org/api/n-api.html, and the corepack decision is the TSC vote in nodejs/TSC#1697 as recorded
by nodejs/node#61207. Everything in that section is reproducible from the commands it quotes.

## Half built, under CNCORE-15 -- and this record stayed PROPOSED until CNCORE-8

**BUILT: the stack, and both negative clauses.** `provider-wiki` is TypeScript on Node 24 (which is
the newest LTS major, not a pin -- see the section on the major) with Hono,
hand-written Zod, Vitest, Biome and a container image, and `@duckdb/node-api` is pinned exactly at
`1.5.5-r.4` with no caret. oRPC does not appear in it. ADR-0053's scaffold does not appear in it.

Hono was the weakest recommendation here and was taken as written; `app.request()` did what this
record said it would, and the repo still needed a SECOND seam binding a real socket, because
`app.request()` proves the handlers and proves nothing about the server, the port or the container's
CMD.

**NOT BUILT: the anti-drift device.** This record names the contract test over BOTH providers as the
designed substitute for the shared `@canoncore/cmpp` package it refuses. There is one provider, so
that test does not exist, and the CMPP schema is now written in two places with nothing holding them
together -- `provider-wiki/src/cmpp.ts` and `@canoncore/providers`' own consumer reading of it.

THAT IS THE HALF THAT MATTERS, and it is why this record is not `accepted`. The refusal of the shared
package is in force while the thing that makes the refusal safe is not, so today the duplication is
simply duplication. CNCORE-8 is what closes it, and until then a change to the response shape in one
repository will not fail anything in the other.

**AND ONE THING THIS RECORD LEFT OPEN IS NOW DECIDED.** "Deliberately not decided: whether the
provider opens the archive read-only." It does: `DuckDBInstance.create(path, { access_mode:
"READ_ONLY" })`, and the container additionally `chmod 444`s the file and runs as a non-root user --
two independent statements of one intent, because either alone is a comment a later change can
falsify. DuckDB permits many concurrent readers and a single read-write handle locks every other
process out, readers included, which is what made the flag worth deciding rather than defaulting.
The proof is across a PROCESS boundary, because DuckDB shares one instance cache within a process and
an in-process check passes whatever mode was actually used.


## Accepted, under CNCORE-16 and CNCORE-8

**The half named above as missing is the half these two built**, which is why this record is now
`accepted` rather than carrying a third "still proposed" section.

**A SECOND PROVIDER REPO EXISTS AND MATCHES THE STACK.** `provider-tmdb` is TypeScript on Node 24
-- the same newest-LTS major as `provider-wiki` and by the same rule, which is the clause about the
two moving together doing its job rather than a coincidence --
with Hono, hand-written Zod, Vitest, Biome and a container image, and both negative clauses hold in
it: oRPC does not appear, and ADR-0053's scaffold does not appear. It carries no `@duckdb/node-api`
pin, and that is the clause working rather than being skipped — the pin is specified "where the
provider reads the archive", and this one reads a rate-limited HTTP API instead. A stack recommended
from a sample of one is a guess; a stack that fitted the second repo, whose source has nothing in
common with the first's, is a stack.

**AND THE ANTI-DRIFT DEVICE IS BUILT.** `packages/contract` calls every provider directly over HTTP
and holds them to one shape, one claim structure and one set of failure modes. So the refusal of a
shared `@canoncore/cmpp` package is no longer in force while the thing that makes it safe is
missing: a change to the response shape in one repository now fails a test in this one.

**Three divergences turned up between two providers, and it is worth being exact about which found
which**, because this record is where a later reader judges whether the anti-drift device works.

1. `images.stored_variant`, a map where ADR-0033 fixed it as `string | null`, so
   `@canoncore/providers` could not parse the second provider's manifest at all and every import
   through it failed at the first call. **Found by the app's own consumer schema, not by the
   contract test, which did not exist yet.** An earlier version of this section credited the
   contract test with it.
2. The image reference shape. The two providers share `role` and `url` and nothing else — the wiki
   sends `id`, `description_url` and `licences`, TMDB sends `width` — and ADR-0033's list of five
   named neither the sixth field nor which were required. **Found by the contract test**, in CI,
   against the real published images, on its first run there.
3. `GET /search?q=` empty: `400` from TMDB, `200 {"results":[]}` from the wiki. **Found by the
   contract test**, and SETTLED under CNCORE-33: an empty `q` is refused exactly as an absent one
   is, `provider-wiki` changed to match, and the reading now lives in ADR-0033 where the rest of
   CMPP's semantics do. This item read "open as CNCORE-33" until that landed. Worth a later reader's
   attention that FINDING it and HOLDING it open were not equally sound — the pin meant to fail the
   moment the disagreement ended did not fire, for the reason ADR-0103's CNCORE-33 section gives.

All three are the case FOR this design rather than against it: duplication caught by a test at the
seam is duplication working as designed. The second is the sharpest, because the contract test made
the mistake ITSELF first — its draft required `width` because TMDB sends it, which is taking the
provider in front of you as the rule. A test at this seam catches that; a shared package would have
enshrined it.

**What the contract test is NOT, and this record should say so** because the obvious next move is
wrong. It is not a schema package wearing a different hat. `packages/contract` depends on no
`@canoncore/*` package at all, deliberately, so that it cannot quietly become the shared package
this record refuses — and its schema is the INTERSECTION every provider must satisfy rather than
CanonCore's own reading, which is a different and stronger document. Importing it into a provider
repo would recreate the coupling by the back door, and the repo boundary is what stops that from
being possible rather than merely discouraged.
