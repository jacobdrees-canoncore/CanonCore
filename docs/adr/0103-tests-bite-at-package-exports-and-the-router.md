---
status: accepted
---

# Tests bite at package exports and at the router called in-process

Three seams. The first two were agreed before the first test was written; the third was added
under review, once it turned out the obstacle to it was smaller than assumed.

1. **Each shared package's public export.** What the package's `exports` map publishes, nothing
   reached around it. This requires that map to mean something: the generator gave `packages/api`
   and `packages/db` a `"./*"` wildcard, which publishes every file in `src/` and leaves no public
   surface to test at. Both are enumerated instead, so the seam is a real boundary rather than a
   figure of speech.
2. **The oRPC router, called in the same process.** `call()` and `createRouterClient()` from
   `@orpc/server`, with no HTTP and no Next boot. Context is built by the real `createContext`
   rather than hand-copied from it, so a change to what a request carries reaches the tests.
3. **The catch-all route handler, driven directly.** An oRPC client whose `fetch` calls the
   handler, plus a request for the OpenAPI document.

Both are where the owning projects point. oRPC's own testing recipe is "use the `call` function to
verify validation, middleware, and handler logic without HTTP overhead". Next.js documents Vitest
for components and says async Server Components are not supported by it, recommending end-to-end
tests for those instead — so a route handler exercised over HTTP inside the unit suite would be
running against the grain of both.

## The third seam, and why the first draft of this record refused it

This record originally ruled the HTTP mount out, reasoning that Next documents Vitest for
components but not route handlers, and points at end-to-end tests for anything it does not cover.
That was the wrong inference. Next's caveat is specifically about **async Server Components**,
which React cannot render in a unit test. A Route Handler is not one: it is an ordinary function
from a `Request` to a `Response`, and calling it needs no Next server at all.

So the mount is covered, by the two things that can independently break in it: an oRPC client
routed at the handler proves the RPCHandler prefix, and a request for the document proves the
OpenAPIHandler and its Zod converter. Both were checked by breaking the route rather than by being
watched to pass -- changing the RPC prefix fails the first and only the first, and removing the
reference plugin fails the second and only the second.

What remains for Playwright is what genuinely needs a browser: a rendered page, on the slice that
first has one.

**Component rendering is still ruled out.** No React component is under test. The one test in
`packages/ui` reads the stylesheet; it does not mount anything.

## Harness shape

Vitest, one suite per package, and — as first written — no Vitest config files anywhere, because
none of these packages needed one and the empty config is the kind of file that later accumulates
settings nobody chose. EVERY PACKAGE HAS ONE NOW: CNCORE-4 gave three of them a setting they needed
and CNCORE-27 gave the rest the network gate, both recorded below. The rule that survived is the one
against EMPTY configs, and it is the rule to apply to the next one.
Turborepo's Vitest guide prescribes the task shape and it is followed exactly: `test` cached with
`dependsOn: ["^test"]`, and `test:watch` uncached and `persistent`. Watch mode gets `persistent`,
never a bare `interactive` — which is the same rule the generator's db tasks broke.

**A package with nothing to test has no `test` script.** `vitest run --passWithNoTests` would
report success for a package whose suite had been deleted, which is a false green. `packages/db` is
the only package in that position now: its export opens a Postgres connection, so it has nothing to
test without one. It gets the script in the change that gives it a schema.

The same false green exists one level up, and is closed the same way: `turbo run <task>` exits 0
when it runs ZERO tasks, so **every CI job that invokes turbo** asserts the count turbo printed
rather than trusting the exit code. Measured on turbo 2.10.12: a task no package declares reports
`Tasks: 0 successful, 0 total`, warns on stderr, and exits 0.

That sentence said **a suite** until CNCORE-191, and the narrower word was the whole of the gap:
the hole belongs to the RUNNER, not to `test`. `Typecheck`, `Build` and the migration ladder's two
`db:migrate` runs and its `db:check-ladder` were left invoking turbo bare, each going green having
typechecked, built or migrated nothing — and the ladder's is the worst of them, because ADR-0047's
empty-to-head gate would then report a database built from nothing as built correctly. All four are
behind the guard now. `Lint` stays bare and is right to: `pnpm lint` is `biome ci`, which exits 1
when it processes no files, the opposite behaviour. `Env guard` stays bare and is also right to,
because it REQUIRES the build to fail, so a run of zero tasks reddens it correctly — guarding it
would invert the check. Both reasons are written where a check can read them, in
`run-suite.test.ts`'s exemption list, since the workflow is read back through a YAML parse that
drops comments.

That sentence read `CI asserts` for a long time while ONE job of five did it (CNCORE-160). The
`Test` job carried the check; `The page over HTTP`, `The page in a browser`, the real-provider job
and the contract job invoked the runner bare, so deleting `test:e2e`, `test:browser` or
`test:contract` would have turned its own check GREEN. This record read `accepted` throughout, which
is the shape of failure a half-built mechanism has: from outside, one job doing it and five doing it
are the same sentence.

The guard is now one script, `.github/scripts/run-suite.sh`, and every job invoking turbo runs
behind it —
which is what makes the claim testable rather than merely restated.
`packages/config/src/run-suite.test.ts` runs that script against a turbo workspace with a test
script and then with it deleted, so the red is DEMONSTRATED, and reads `ci.yml` back to refuse any
job that names a suite outside the guard. The NAME is what that check matches, not `pnpm <task>`:
matching the command would read one spelling and let `turbo run test:e2e`,
`npx turbo run test:e2e` and `pnpm --filter web test:e2e` past in silence. All four were measured
against it.

**What the count catches is the count reaching ZERO, and that is not the same as a deleted
suite.** `test:e2e`, `test:browser` and `test:contract` are each declared by one package, so for
those the two are one. `test` is declared by ten: delete one package's and nine still run, which
the guard reads as a pass. What catches that is `network-gate-wiring.test.ts`, which holds every
Vitest config on disk to being run by some suite — so the orphaned config fails it. Measured on
2026-09-14: deleting `packages/tokens`' `test` script turns the Test job red there, not here.

**And the case NEITHER catches was `packages/config`'s own `test` script**, because the sweep that
would catch it is the suite that script runs. Measured the same day: with it deleted, `pnpm test`
reported `Tasks: 9 successful, 9 total` and the job was GREEN, having switched off every check this
repository makes of `ci.yml`, `pnpm-workspace.yaml`, the network gate's wiring, the Biome config and
the Node major. **CNCORE-190 closed it: a count is not a roll call, and the guard now takes one.**
`run-suite.sh test @canoncore/config` holds the run to that package's task having actually appeared
among the ones turbo ran. Turbo announces a task before it writes a word of its own, so a package
declaring no such script contributes nothing to announce — and it does so **in two different
shapes**. Everywhere but GitHub Actions it STREAMS, prefixing every line with `<package>:<task>: `;
on GitHub
Actions it detects the runner and GROUPS instead, emitting `::group::<package>:<task>` with the
task's own lines unprefixed inside. Both are read, because a guard that knew only the streamed shape
is green on a laptop and red on the runner, which is the one place it exists to work. Measured on
turbo 2.10.12, cold and cached: `GITHUB_ACTIONS=true` is the switch and `CI=true` alone is not.

A check cannot police the thing that decides whether it runs, which is why the roll call is in the
script the workflow step EXECUTES, where no `scripts` block reaches it.

The half a suite can still hold is the other one — that `ci.yml` names the package at all — and
`run-suite.test.ts` holds it, because deleting the argument leaves that suite running to notice.
The two holes are disjoint, which is what makes the pair whole.

**The roll call is asked in ONE place, and that is a half rather than a finish.** `test
@canoncore/config` is the case CNCORE-190 measured and closed. `typecheck` is declared by ELEVEN
packages and has only the count, so one of them dropping its script leaves ten running and the job
green — the identical hole, and nothing else catches it, because `network-gate-wiring.test.ts`
covers `test` alone. CNCORE-197 holds that, and this paragraph is here so the mechanism does not
read whole from outside while half of it is open.

`build` is NOT a third case, for the reason `test:e2e` is not: it is declared by exactly ONE
package, `web`, so the count reaching zero and the script being deleted are the same event. That
sentence said "`typecheck` and `build` … eleven packages each" when it was first written, which was
an unchecked figure for the second of them and would have sent somebody to close a hole that does
not exist. Counted 2026-09-14: `test` 10, `typecheck` 11, `build` 1.

**And a scratch fixture does not stand in for a real run**, which this record owes to the roll call
being wrong TWICE before it was right — once on the size of a real log and once on the shape of a
real runner's output, both times with every row of the fixture green.

The second is the plainer of the two. The roll call read the streamed prefix, which is what a laptop
produces and not what GitHub Actions does, so it passed here and failed there — on a check whose
entire purpose is to bite in CI. The fixture now PINS both shapes rather than inheriting whichever
the host happens to be, because a suite that inherits it agrees with itself in each place and
disagrees between them, which is exactly how this got through.

The first was subtler, and it is the one this paragraph is named for. The reader stopped at the
match, which closed the pipe under the `sed` stripping colour ahead of it; that `sed` died of
SIGPIPE, `pipefail` handed 141 to the check, and the guard reported the package it had just found
as missing. Every row of the scratch
workspace passed throughout, because the hazard needs a log longer than a pipe buffer and theirs
were a few lines. It surfaced on the first run against this repository's own `pnpm test`, where the
package announces itself around line 8 of some two hundred. The seam is right and the fixture is
right; what neither gives for free is SIZE, so a guard that reads a log is run against a real one
before it is believed. `run-suite.test.ts` now holds a 20,000-line workspace over it.

## Where the design tokens are actually held honest

`packages/tokens` is the source of truth and `packages/ui/src/styles/globals.css` declares the same
values, because a stylesheet cannot import TypeScript. Nothing generates one from the other: a
test in `packages/ui` parses the stylesheet and fails if the two disagree on a name, a value or the
radius. It was proven to fail on a changed value and on a token added to the CSS alone.

The alternative — generating the CSS from the TypeScript at build time — was rejected because it
puts a build step in front of the zero-build package pattern the rest of the repo relies on. The
cost of this choice is that the values are written twice, and the test is what makes that safe.

## The one package with no TypeScript

`packages/config` held `tsconfig.base.json` and no source, so "every package is typechecked" was
briefly read as "every package except this one". It has source now -- CNCORE-27 put the network gate
there, and an `exports` map with it -- so the heading above is history rather than a description.
It is checked, and by the only thing worth checking: `src/base-config.test-d.ts` asserts, through
`@ts-expect-error`, that the strictness the whole repo inherits is actually on. An unused
`@ts-expect-error` is itself an error, so each line fails if the option it names is turned off --
verified by turning `noUncheckedIndexedAccess`, `strict` and `noFallthroughCasesInSwitch` off in
turn, each of which failed the check.

`tsc --showConfig` was tried first and rejected: it exits 0 on a malformed config and on an unknown
compiler option alike, so it would have been a vacuous green.

It has since gained an ordinary Vitest suite as well, because it gained a second thing worth
checking: `biome.jsonc` is the other configuration every package inherits, and
`src/biome-config.test.ts` runs the real binary against it. See
[[0105-biome-lints-and-formats]]. The rule above is unchanged — the package earned a `test` script
by acquiring something to test, which is the only way to earn one.

## Evidence

oRPC and Turborepo documentation via context7, Next.js testing guides, all read 2026-09-10.

## A fourth seam, and three Vitest configs — under CNCORE-4

**THE APP OVER REAL HTTP.** This record left "a rendered page, on the slice that
first has one" to Playwright. CNCORE-4 is that slice, and it does NOT use
Playwright -- because the criterion this record actually gives is "what
genuinely needs a browser", and a server-rendered title does not. The title is
in the HTML the server returns, so `fetch` observes exactly what a browser
would, at no dependency and no browser binaries in CI.

`apps/web/e2e` builds the database, seeds one item, runs `next build` and
`next start`, and asks the running server for `/items/<id>`. It is the ONLY
check in the repo that fails if the page is unreachable: every other suite
passes with the app never having been served. A production build rather than
`next dev`, because dev-mode rendering is not what ships and the build costs
about three seconds.

Playwright stays reserved, and its reservation is now sharper: the first slice
with real INTERACTIVITY, not merely the first with a page.

**AND THREE VITEST CONFIG FILES, where this record said none.** The rule it
gave was against EMPTY configs -- "the kind of file that later accumulates
settings nobody chose" -- and each of these carries a setting something needs:

- `packages/db`: a `globalSetup` that builds a PostgreSQL database from empty
  and migrates it, plus `fileParallelism: false`, because several tests assert
  on constraints global to that one database (the single owner row, the one
  global source order) which parallel workers would race rather than test.
- `packages/api`: the same two files, imported from `@canoncore/db/testing`, so
  the two suites cannot drift over what a test database is.
- `apps/web`: two configs. The default one EXCLUDES `e2e/`, and the e2e one
  stands up the server. That separation is what keeps a Next build out of every
  local `pnpm test`.

**`packages/db` now has a `test` script**, which this record said it would get
"in the change that gives it a schema". This is that change.

## A network gate, and a Vitest config in every package — under CNCORE-27

**EVERY SUITE NOW RUNS BEHIND A GATE THAT THROWS ON UNEXPECTED EGRESS.** Until
CNCORE-6 nothing here made an outbound request and nothing needed stopping; the
CMPP client does, so a test naming the wrong host reaches it -- quietly
succeeding on the one machine with network access and failing on a runner nobody
is watching.

It is `@canoncore/config/testing/install-network-gate`, listed in `setupFiles` by
all ten suites -- ELEVEN SINCE, and the eleventh is the subject of CNCORE-46 at
the foot of this record -- and it lives in `packages/config` because that package is
already the configuration every package inherits and every package already
devDepends on it. THAT COST THIS RECORD'S "no Vitest config files" ANOTHER FIVE
TIMES OVER: `env`, `providers`, `schemas`, `tokens` and `ui` have one now, each
carrying the gate and nothing else. The rule was against EMPTY configs, and a
file whose one setting is a security control is not one.

BUILT ON undici's `MockAgent.disableNetConnect()` AND NOT ON nock, which is the
part worth not rediscovering: `nock@14` does not intercept `fetch` -- its undici
support is still on the `beta` tag -- so `nock.disableNetConnect()` prints that
net connect was disabled and then makes real calls. Node's own `--allow-net` is
the other tempting answer and CANNOT DO THIS JOB ON ANY MAJOR -- which is the
reason to give, because the reason first written here was that the flag was
unavailable, and that one expires. It is all-or-nothing: measured in
`node:26-alpine` (v26.8.2) on 2026-09-11, `--allow-net=127.0.0.1` still let a
connection to 1.1.1.1 through, and `node --help` documents it as taking no
value at all. The gate below is "closed, except loopback", and a boolean
cannot express a carve-out. It also requires `--permission`, which in the same
image denied `worker_threads`, `child_process` and every filesystem read and
write -- all of which Vitest needs to run. The flag does arrive on the major
this repo runs, on 2026-10-28 under
[[0112-the-node-major-is-the-newest-lts-line]]; nothing above depends on it
not having arrived.

**MEASURED AGAINST undici 8.10.2, because the two calls read as one idiom and
are not.** A `MockAgent` starts with net connect ON; `disableNetConnect()` sets
it to `false`; `enableNetConnect(matcher)` REPLACES that with a list holding the
matcher. So the pair reads as "closed, then this one door" and behaves that way
-- and reversed, the door closes again and loopback goes with it. Order is
load-bearing and looks decorative.

### What the loopback carve-out is actually for

THE CMPP CLIENT SUITE DOES NOT NEED IT, and the ticket, and the commit that
filed the ticket, both said it did. `packages/providers` passes its OWN
dispatcher to every `fetch` (that is how ADR-0034's two boundaries are hung), so
its requests never consult the global dispatcher the gate installs. Measured:
with the carve-out narrowed to match nothing, all 58 tests in that suite still
pass, and the end-to-end run fails on its first request. **The end-to-end run is
what the carve-out exists for** -- it fetches the Next server `global-setup.ts`
started on `127.0.0.1` -- along with anything else reaching loopback through
bare global `fetch`.

A CONSEQUENCE, since it reads as a hole otherwise: the gate cannot see a request
that names its own dispatcher, so it is a control against ACCIDENTS and not
against a suite that means it. ADR-0034's boundaries are what stand in front of
deliberate outbound calls, and they are the app's rather than the harness's.

`provider-wiki`'s copy ALREADY CARVES OUT LOOPBACK, which is the other thing the
ticket had backwards -- CNCORE-15 built the same three alternatives there. What
differs between the two repos is which suites depend on it, not whether it
exists.

**THE CARVE-OUT IS A HOST-STRING MATCH AND NOT AN ADDRESS CHECK.** undici hands
its matcher the host as written, so `localhost` here means whatever `localhost`
resolves to. That is the right strength for a harness control and the wrong
strength for ADR-0034, whose whole subject is the address a socket is about to
connect to. Read the two side by side and the gate looks like a weakened copy of
the boundary; it is a different control with a different job.

### Two tests, because one of them proves less than it appears to

`src/network-gate.test.ts` asserts undici's `UND_MOCK_ERR_MOCK_NOT_MATCHED` on
the error's CAUSE -- `fetch` wraps everything its dispatcher throws in a
TypeError -- and NOT a bare `rejects.toThrow()`. A machine with no network
throws on that fetch too, so the bare version passes with the gate removed, on
exactly the runner the gate is for. It was proven both ways: with `setupFiles`
emptied the assertion sees a `Response`, which is the hole this ticket closed.

`src/network-gate-wiring.test.ts` is the half that makes the claim reach the
repository. The first test proves the gate fires in ONE suite -- the one it
happens to live in -- and would go on passing with the other ten standing open.
So this one reads `pnpm-workspace.yaml`, finds every script whose command runs
`vitest run` (scripts NAMED `test` and `test:e2e`, until CNCORE-46 below),
IMPORTS the Vitest config each one runs and asserts the gate is in its
`setupFiles`. Imported rather than grepped, because a commented-out line still
reads as present to a text search and that is the exact state worth catching.

**THREE PLACES THE GATE CANNOT SEE**, all found in review, all held by CNCORE-30
rather than by this paragraph alone. A request that NAMES ITS OWN DISPATCHER, as
every CMPP request does, is the one above. `globalSetup` is the second: Vitest
runs setup files in each test WORKER and a global setup in the MAIN PROCESS --
not, as this record said until CNCORE-30 measured it, in a process of its own --
so `apps/web/e2e/global-setup.ts`, which builds, starts and probes the server,
was ungated, as was `packages/db`'s database build. The third is a test that
calls `setGlobalDispatcher` itself, which left the gate off for the rest of that
FILE; the blast radius is one file because setup files run per file, and nothing
here does it.

They are three different problems rather than one, and CNCORE-30 gave them three
different answers: the second and third are CLOSED, the first is not and will not
be. The section at the foot of this record is what they were and why.

### Two things review proposed, and why the answer was no

**ONE SHARED VITEST BASE, RE-EXPORTED BY EACH PACKAGE**, instead of five
byte-identical config files. It is the obvious deduplication and it is refused
for the reason at the top of this section: a base config held elsewhere is
exactly "the kind of file that later accumulates settings nobody chose", and a
package would inherit the accumulation without a line in it saying so. The
duplication is safe rather than merely tolerated -- the wiring test fails on any
copy that drifts -- so what is bought by the indirection is five lines and what
is sold is the ability to read one package's config and know what its suite does.

**A CARVE-OUT OF `127.x` ALONE**, without `localhost` and `[::1]`, on the
grounds that nothing here reaches those two today. Refused deliberately rather
than overlooked: `apps/web/src/utils/orpc.ts` already hardcodes
`http://localhost:3001` as its fallback base URL, and a gate that refuses the
app's own dev URL is one somebody widens in a hurry, without reading why it was
narrow. A control that has to be argued with is a control that gets deleted.

Two shapes cannot be tested through `fetch` and are absent from the narrowness
cases for that reason: a host ENDING in the address is not a URL at all, because
the WHATWG parser reads a trailing all-numeric label as an IPv4 address and
refuses `not-127.0.0.1` outright, and a URL carrying the address as USERINFO is
refused by the `Request` constructor before any dispatcher sees it.

## A FIFTH SEAM, under CNCORE-8: a provider over HTTP, with the app absent

This record's four seams all have CanonCore on one side. The contract test has neither: it calls
`search`, `lookup` and `browse` on every provider directly over HTTP and asserts they answer one
shape, one claim structure and one set of failure modes.

**IT MUST NOT RUN THROUGH THE APP, and that is the whole reason it is a seam of its own rather than a
suite at the second one.** CanonCore's provider layer parses every provider into one normalised
shape before anything downstream sees it, so a suite driven through `provider.import` would pass
whether or not the two providers agreed about anything — which is the exact failure it exists to
catch. A test cannot be trusted to stay on the right side of that by intention.

**So the separation is STRUCTURAL.** `packages/contract` declares no `@canoncore/*` dependency at
all, so it cannot reach the app's schema even by accident, and a future import would have to add a
dependency somebody reviews. It writes its own statement of the contract, which is a different
document from `@canoncore/providers`' — that one is a CONSUMER'S reading, "what this app happens to
need", and holding two providers to it would prove only that they both satisfy CanonCore.

**`test:contract`, NOT `test`, and its own CI job.** The suite is meaningless without a provider
running, so putting it under `pnpm test` would make a container a prerequisite of every local run —
and a suite people skip is a suite that rots. CI runs it with both provider images as service
containers, and the job fails before the suite if either one did not answer, because a contract
checked against one participant is a schema test wearing the wrong name.

**A third participant that is not a provider.** The suite stands up a minimal conformant server on a
real socket declaring only `search` and `lookup`, because ADR-0033's optionality has nothing left in
version one exercising it. It is a CONFORMANCE WITNESS rather than a stub standing in for a real
provider, and the difference is enforced by it going through the identical assertions with nothing in
the suite able to tell it apart.

**AND IT RUNS BEHIND CNCORE-27's GATE, which is worth saying because it reads like a
contradiction.** This is the one suite whose entire purpose is outbound HTTP, and it is exactly
where the gate earns its keep: its carve-out is loopback, both provider images run there as service
containers, so the gate is never in the way -- and a participant pointed at a PUBLIC origin stops
being possible by accident. A remote CMPP provider under test becomes a deliberate edit to that
line with a reason beside it, rather than an environment variable somebody exported. The providers'
own upstream calls are the CONTAINERS' egress, not this process's, so nothing here constrains
`provider-tmdb` reaching TMDB.

Playwright's reservation is unchanged: the first slice with real INTERACTIVITY.


## A fifth seam chosen rather than inherited -- under CNCORE-9

**THE JSON READ PATH, OVER HTTP, AND THE ALTERNATIVE WAS THE RENDERED HTML.** CNCORE-9's invariant
is that one item sits in more than one ordering at once, and its ticket named both candidates and
required the choice be made deliberately rather than by habit.

It is asserted against what `item.get` answers, reached with an oRPC client over real HTTP into the
running production build -- the fourth seam's harness, a different observation of it. THE REASON IS
THAT THE INVARIANT IS A DATA CLAIM. "This story has two placements, at 3 and at 1" is a fact about
the read path's answer; the page is one renderer of that answer and `apps/web/e2e/item-page.test.ts`
already holds it to showing both. Asserting through the markup would put a string scrape between the
claim and the check, and buy nothing the other file does not already prove.

**WHAT THAT IS WORTH IS IN THE FAILURE MESSAGES**, which is not a small thing for a test whose whole
job is to go red in five years when somebody rebuilds the model as a tree. A one-parent read path --
`.limit(1)` on `findPlacementsOfItem`, run as a mutant rather than imagined -- fails six of that
file's eight assertions and names the container each placement went missing from. The same mutant
against parsed markup fails as "expected '<li class=...>...' to contain '#3'".

**AND NO PARSER, WHICH IS THE DEPENDENCY HALF OF THE SAME CHOICE.** `item-page.test.ts` scrapes with
regular expressions and decodes React's entities by hand, which is affordable for the page it is
about and is not a foundation to put an invariant on.

## The stub and the image are one contract, and it broke silently -- under CNCORE-9

`apps/web/e2e` runs twice in CI: once against stubs on loopback, and once with a provider variable
naming a real image as a service container. THE ASSERTIONS CANNOT TELL WHICH RAN, and that is the
whole design -- so the stub's answers have to be the image's answers.

**THE SECOND RUN WAS NOT HAPPENING WHEN THIS WAS WRITTEN, AND THE VARIABLE NAMED HERE IS NO LONGER
THE WIKI'S.** This paragraph said `PROVIDER_WIKI_URL` and the real `provider-wiki` image, and both
halves are corrected under CNCORE-143 below: turbo filtered the variable out of `test:e2e`, so both
runs were the stub, and the job now carries `PROVIDER_TMDB_URL` and `provider-tmdb` instead. What
the paragraph claims about the stub owing the image's answers is unchanged and is why the section
stands.

**THEY STOPPED BEING.** ADR-0057 moved the fixture era to new Who and CNCORE-39 cut the
missing-episode roster from five stories to two, in the OTHER REPOSITORY. *Marco Polo* left the
extract, so the position `Stories with missing episodes` computes for *The Tenth Planet* moved from
3 to 2 -- and this suite went on asserting 3, green, because the stub still held the five. The two
runs disagreed about a number, and only the one nobody was looking at was right.

The gap is structural rather than careless: nothing in either repository can see both files. What
closes it is the stub being GENERATED FROM the running provider rather than typed -- the records now
in `apps/web/e2e/wiki-fixture.ts` were read out of it -- and that is a habit rather than a mechanism.
A mechanism would be the image publishing its fixture as a fetchable artefact this suite pins, and
nothing needs one yet. Named here so the next person to widen the stub knows what they are widening.


## Three places the gate could not see, and three answers -- under CNCORE-30

The section above named three kinds of outbound call the CNCORE-27 gate cannot
see and closed none of them, because they are three problems and the answer to
one is not the answer to another. Two are closed now. **The third is refused
rather than deferred**, which is the part worth reading: it has no ticket behind
it and is not waiting for one.

### `globalSetup`: CLOSED, by a global setup of the gate's own

A GLOBAL SETUP RUNS IN VITEST'S MAIN PROCESS. That is the correction this
ticket's first hour bought -- the record said "its own process" and Vitest's own
lifecycle documentation says the main one, in a different global scope from the
workers, before any worker exists. Either way `setupFiles` never reach it, which
is what made it a gap; but the two are not the same claim, and the one that was
written here was wrong.

It is `@canoncore/config/testing/gate-global-setup`, listed FIRST in the
`globalSetup` of the three suites that declare one -- `packages/db`,
`packages/api` sharing that same file, and the end-to-end run.

**A SECOND `globalSetup` ENTRY RATHER THAN AN INSTALL AT THE TOP OF EACH GLOBAL
SETUP**, which is what the section above assumed and what the ticket proposed.
`globalSetup` takes an array and Vitest runs the entries in order, so the gate
can be one of them: the wiring then lives in the config, one line under the
`setupFiles` that carries the gate for the workers, and the global setup files
themselves stay free of harness plumbing. What that bought is the CHECK -- the
existing wiring test already imports every config, so `globalSetup` comes off the
object it already had, and the assertion needed no new machinery at all. (It came
to about forty lines with its comments, and the alternative it replaced needed a
TypeScript parser: see below.)

**FIRST IS THE ASSERTION, NOT PRESENCE, AND IT WAS MEASURED.** With a `fetch` at
the top of `apps/web/e2e/global-setup.ts` and the gate listed FIRST, the run dies
on `UND_MOCK_ERR_MOCK_NOT_MATCHED`. Move the gate to SECOND and the fetch reaches
DNS instead. The two runs used different hosts and the second one is the reason:
proving the gate OFF sends a real request, so that measurement was taken against
a name in `.invalid`, which cannot resolve, and its evidence is `ENOTFOUND`. A global setup listed ahead of
the gate runs ahead of it, which is being ungated for exactly the work that
global setup does.

**THE REASON IS NOT SYMMETRY**, which this record demanded and was right to.
`apps/web/e2e/global-setup.ts` is the largest piece of harness code in the
repository and it grew twice under CNCORE-9 alone; it fetches, it spawns, it
probes, and it imports fixtures through a running app. Nothing there reaches past
loopback today -- and "nothing does it today" is the state a harness control is
written to KEEP, not a reason to leave the control off. The cost turned out to be
one line per config and a `MockAgent` in a process that already holds one per
worker.

**WHAT IT DOES NOT COVER, AND SAYING SO IS THE POINT**: a CHILD PROCESS.
`apps/web/e2e` spawns `next build` and `next start`, which have their own
dispatchers, and the served app reaches its provider over HTTP by design --
ADR-0034's boundaries judge that, not this. PostgreSQL was never covered and
still is not: `pg` opens a raw TCP socket and consults no undici dispatcher.

**AND NOT THE WHOLE MAIN PROCESS EITHER**, which is the sentence this section
first reached for and had to give up. "Every process running Vitest code is
gated" is FALSE: only the three suites that declare a `globalSetup` install
anything in their main process, the other seven run reporters and plugins in an
ungated one, and even in the three the Vitest config file is evaluated by Vite
before any global setup runs. What holds is smaller and is the claim the wiring
test actually makes: EVERY WORKER, AND EVERY GLOBAL SETUP OF EVERY SWEPT SUITE.

**A SOURCE PARSE WAS TRIED FIRST AND ABANDONED**, recorded because the next
person to want a repository-shape check will reach for it. The first shape of
this was an install called at the top of each global setup, checked by parsing
those files with the TypeScript compiler API -- parsed rather than grepped, for
the reason the wiring test already gives about commented-out lines. **TypeScript
7 does not publish that API at its package root.** Its `exports` map offers
`./lib/version.cjs` and everything else behind `./unstable/*`
(`typescript/unstable/ast` and its neighbours), and a repository check founded on
a specifier whose own name says it will move is a stopgap. No other parser
resolves from `packages/config` either -- `es-module-lexer`, `vite`, `rolldown`
and `esbuild` are all in the lockfile via Vitest and none of them is a dependency
of this package, which is pnpm's isolation working as intended. (ROLLDOWN, not
rollup: `rollup` appears nowhere in `pnpm-lock.yaml`, and the bundler under Vite
here is `@rolldown/binding-*@1.2.8`.) The config-array
shape above removed the question rather than answering it, which is why it is the
better shape and not merely the available one.

### A test that swaps the global dispatcher: CLOSED, by restoring the agent already made

`installNetworkGate()` now returns the gate, and `install-network-gate.ts` wires
its `restore` as a `beforeEach`. Setup files run once per FILE, so without it a
test calling `setGlobalDispatcher` left the gate off for every test after it.

**IT RE-INSTALLS THE AGENT IT ALREADY MADE, AND ONLY WHEN SOMETHING ELSE HOLDS
THE GLOBAL DISPATCHER.** The section above costed this as "a `MockAgent` per test
that nothing closes", which is what an unconditional re-install would be; an
identity comparison against the agent the gate installed costs nothing and leaks
nothing.

The two tests that hold it are ORDER-DEPENDENT and unavoidably so, because the
property is what the SECOND test sees after the FIRST one swapped. The swapped-in
dispatcher ANSWERS where the gate refuses -- a `MockAgent` with `disableNetConnect`
and one persisted interceptor -- so the second test tells them apart by getting a
200 rather than a refusal, and neither test can reach the network on any path it
takes. Proven red: with the `beforeEach` removed, the second test sees the
interceptor's answer.

### Two things the wiring test could not see: CLOSED under CNCORE-46

Found reviewing this ticket and left alone deliberately, because both are
CNCORE-27's code and neither is one of the three places the GATE cannot see.
Both are closed now, and neither by what the finding proposed.

**THE SWEEP IS THE COMMAND, NOT A LIST OF SCRIPT NAMES.** `suites()` collected
scripts named `test` and `test:e2e`, so `packages/contract` -- which declares
`test:contract` and nothing else, and whose whole purpose is outbound HTTP -- sat
outside both assertions in that file. Measured rather than argued: with
`setupFiles` emptied in its config, the version of the file on `main` passed both
its tests. It is every script whose command runs `vitest run` now, which leaves
bare `vitest` out on the honest ground that watch mode runs the config its `run`
twin already puts under assertion, rather than by not being on a list.

**AND THE ELEVENTH SUITE IS THE LESSON RATHER THAN THE BUG.** The sweep was
written under CNCORE-27 against the ten suites there were that day; CNCORE-8
added the eleventh the day after, listing the gate in it by hand and correctly,
and outside a filter that could not see it. A sweep written against what a
repository holds on the day is one the next package leaves without a word. So the
file asserts its own completeness now: EVERY `vitest.*.config.ts` SITTING
DIRECTLY IN A PACKAGE MUST BE RUN BY A SWEPT SCRIPT. A config is the unit because
a config is what holds the gate, and that claim fails for the NEXT suite to fall
out of the sweep as well as for the one that already had -- it went red naming
`packages/contract/vitest.config.ts`. The qualifier is the claim's real size and
is in the code beside it: a `.mts` config, a `test` block in a `vite.config.ts`
or one nested deeper is not seen, and this repo has none of the three. The other direction is asserted rather than
swept: a script NAMED for a suite and run by something else matches no command
filter and takes its config with it, so `"test": "jest"` is a failure by name.

**`../*` PASSED THE WORKSPACE-PATTERN CHECK whose own comment named it as a case
that check caught.** `..` matches the first segment's `[\w.-]+`, so `readdirSync`
swept the repository's PARENT; `./*` matched too and swept its root. Refused now
by a first segment of only dots, rather than by refusing dots outright, because
`.github` is an ordinary directory name and what a sweep must not do is leave the
tree.

**BOTH RULES ARE PREDICATES WITH A TABLE BESIDE THEM**, which is what the pair of
findings argues for more than either fix does. Each was a rule that said one thing
and did another, and NEITHER COULD BE CAUGHT BY THIS REPOSITORY'S CONTENTS: `../*`
is in no `pnpm-workspace.yaml` here and `"test": "jest"` in no manifest. A rule
asked only through the repository is a rule asked only about what the repository
happens to have, and it passes for years on the strength of a case nobody wrote.

### A third rule that said one thing and did another: CLOSED under CNCORE-51

The paragraph above generalised from two cases and the third arrived by the same
route, reviewing the ticket that closed them. `suites()` read WHICH config a
swept script runs by matching `--config` followed by a space, and Vitest takes
four spellings: `--config <path>`, `--config=<path>`, `-c <path>` and
`-c=<path>`, the last because its parser takes `=` for the short flag as well as
the long one, all four measured against this repo's vitest 5.0.0. Three of them
read as naming NO config, so the sweep claimed the package's default
`vitest.config.ts` and asserted the gate against the wrong file -- and where the
mis-spelled config WAS that default, asserted twice about one file and said
nothing. It could not be caught here: `apps/web`'s `test:e2e` is the only script
in this repository that names a config at all, and it spells it the way the rule
read. `namedConfig` is the third predicate with a table beside it.

**A RULE WITH TWO HALVES NEEDS A ROW PER HALF, which is what this one added to
the lesson.** The rule reads the flag as a whole word ending at `=` or a space,
and the first table pinned only the second half: `--configLoader` and the `-c`
inside `--coverage` are both refused by the separator alone, so every row passed
with the word-start dropped while the comment credited it. The case that pins it
is a flag's VALUE ending in `-c` -- `--project app-c src/foo.test.ts`, read
without the anchor as naming the config `src/foo.test.ts`. A table that says
which half does the work is worth more than a table that merely goes green,
because the sentence beside the rule is what the next reader believes.

**AND WIDENING A RULE WIDENS WHAT IT MISREADS.** `-c` is another program's flag
far more often than `--config` is, so the widened rule read
`vitest run && playwright test -c playwright.config.ts` as running Playwright's
config. Only the first command in a script is Vitest's, and the rule says so
now. Nothing here is a compound script; that is the same ground the three
spellings stood on.

### A request that names its own dispatcher: NOT CLOSED, and not open either

This one is a LIMIT rather than a hole, and the record of that now lives in
`network-gate.ts` beside the gate and in `packages/providers/src/client.test.ts`
beside the allowlist that is the real control. The live hazard is not the one the
phrase suggests: it is a test building a provider client with a PERMISSIVE
ALLOWLIST, which would reach a public host for real on whichever machine has a
network.

**A LINT RULE AGAINST `dispatcher:` IN A TEST WAS THE OPTION ON THE TICKET AND IS
REFUSED.** Biome 2 can express it -- `configuration_schema.json` in the
installed `@biomejs/biome@2.5.12` carries both a top-level `plugins` key and a
`grit` one -- and it would aim at syntax NO TEST IN THIS REPOSITORY WRITES, because the two `Agent`s
are constructed inside `client.ts` and a test never names one. What it would miss
is `allowlist:`, which is the hazard. A control aimed at the wrong syntax reads
as coverage and is not, and that is worse than the gap it appears to close.

**PATCHING THE SOCKET LAYER was the other candidate and is refused too.** A
`net.Socket.prototype.connect` that refused non-loopback would catch undici
`Agent`s, `pg` and everything else, and it would duplicate ADR-0034's address
judgement inside the harness at a strength this record has already explained the
gate must not have: the gate matches a HOST STRING against accidents, that record
judges the ADDRESS a socket is about to reach. Two controls that look alike and
are not is how one gets deleted in favour of the other.

So ADR-0034's boundaries stay the control for a deliberate outbound call, which
is what they are for, and the allowlist a test passes is what keeps the provider
suite off the network. NOT ONE LINE, which this record claimed until its own
review checked: `client.test.ts` builds every client but one from a loopback
helper, and the exception allowlists `wiki.example.com` while pointing at a
loopback stub, so the base URL is refused before a socket opens -- that refusal
is the test. `boundary.test.ts` names the same public host and never fetches at
all. The shape nothing here stops is a public host in the allowlist AND in the
base URL together, and the helper is commented so that a reviewer meets that
sentence before writing one.

## An abstainer is a participant, and the pin it held open -- under CNCORE-33

The fifth seam found a divergence it could not settle from here: `GET /search?q=`, the parameter
present and empty, answered `400` by `provider-tmdb` and `200 {"results":[]}` by `provider-wiki`.
Settling it needed a change in another repository, so the suite HELD IT OPEN — a test asserting the
two still disagreed, written to FAIL when the disagreement ended, on the reasoning that a `skip`
would have rotted quietly and this could not.

**IT ROTTED ANYWAY, IN THE ONE DIRECTION NOBODY CHECKED.** The pin measured the number of distinct
answers across EVERY participant. Three are under test, not two: the two real providers and
ADR-0033's conformance witness, which was deliberately NEUTRAL on the question and answered `200` on
the grounds that it should not take sides in an open disagreement. So when `provider-wiki` was fixed
and the two real providers agreed, the witness alone kept a second answer in the set and the pin
stayed GREEN. A test written to fail the moment the disagreement ended was held up by the
participant standing aside from it.

**AND THE FALSE SIGNAL TRAVELLED.** CNCORE-33 was reopened stating the contract job was "RED on
`main` and on every open branch, by design". It was not: `provider-wiki:latest` was republished as
`sha256:4a772af0c931` at 2026-09-11T12:42:46Z, and the two runs on `main` that started after it
(12:50:27Z, 12:50:50Z) both report `One contract, both providers, no app: completed/success`. The
work was right and the reason given for it was not, which is the expensive half: a device nobody can
see failing is one whose verdict gets quoted.

**THE RULE: a check that measures a population for disagreement cannot also contain something exempt
from the question**, because an abstention is indistinguishable from a dissent and it votes. Either
the neutral party takes a side or it is excluded from the count BY NAME — and taking a side is the
cheaper of the two here, because an exclusion by name is the branch on `participant.name` this suite
forbids everywhere else.

**THIS IS THE SIBLING OF THE STUB THAT BROKE SILENTLY**, the CNCORE-9 section above, and the pair
is the point. That stub went on asserting a number the image had stopped answering; this pin went on
reporting a disagreement that had ended. Both were GREEN, both were measuring something real, and
in both cases what the suite could not see was the thing it existed to watch. A seam is only as
honest as its population: the question to ask of a new one is not "does it assert the right thing"
but "what is in the count that is not answering the question".

## A rule with two claims in it, and a suite checking one -- under CNCORE-77

**THE FIFTH SEAM HELD PROVIDERS TO HALF OF ADR-0033'S SENTENCE FOR AS LONG AS IT EXISTED.** "An
empty result is an answer; a missing query is a mistake" is two claims. The suite had a test for a
missing `q`, a test for an empty `q`, and nothing at all for a query that simply matched nothing —
so a provider answering `404` to one, or any other failure, passed everything in the file. That is
not a hypothetical shape: `lookup` answers `404` for an id it does not hold, and reusing the reflex
for `search` is the obvious thing to build.

**IT WAS HARMLESS UNTIL SOMETHING DEPENDED ON IT, WHICH IS THE GENERAL CASE.** Nothing in CanonCore
called `search`, so no behaviour rested on the difference between "answered nothing" and "did not
answer". CNCORE-77's client rests on precisely that: a refusal is read as the provider FAILING, an
empty `results` as it ANSWERING, and a fan-out sorts providers into two lists on the distinction.
The gap became load-bearing without anything touching the suite.

**THE RULE: when a record states a rule as a contrast, the suite needs a test per SIDE.** A
contrast is written as one sentence and reads as one claim, which is exactly why the missing half is
hard to see — the tests that exist look like they cover the sentence, because they quote it. The
tell is grammatical rather than technical: `A, not B` and `X is an answer; Y is a mistake` are two
assertions wearing one clause.

**IT IS THE THIRD ENTRY IN THIS FILE'S FAMILY AND THE FIRST THAT WAS NEVER GREEN FOR THE WRONG
REASON.** The CNCORE-9 stub asserted a number the image had stopped answering and the CNCORE-33 pin
reported a disagreement that had ended; both were measuring something real and watching the wrong
population. This one measured its population correctly and was simply not asked the second question.
So the question to ask of a seam is not only "what is in the count that is not answering the
question" but "how many questions did the record actually ask".

Both real providers and the conformance witness already satisfied the missing half, which is the
ordinary outcome and not a reason to have skipped it: what the assertion buys is that the day one of
them stops, it is a contract failure rather than a source that looks broken to an owner.

**AND THE SEPARATION IS REFUSED IN THE OTHER DIRECTION TOO, which this record did not say.** The
guarantee above is one-directional: `packages/contract` depends on no `@canoncore/*` package, so it
cannot reach the app's schema. Nothing in that sentence stops `@canoncore/providers` importing the
CONTRACT'S schema, and CNCORE-77 met a ticket asking for exactly that -- "validated against the
schema `packages/contract` already declares" -- which is the obvious repair and would have breached
no rule written here.

It is refused anyway, and the reason is not the dependency graph. **The two are different
DOCUMENTS.** One is a SPECIFICATION and permits unknown keys, because ADR-0033 lets a provider
declare more than it is asked for; the other is a CONSUMER'S reading and strips them, widens where
the app does not care, and omits fields nothing renders. A single schema serving both collapses that
distinction, and what it costs is the contract test's whole claim: the suite would prove that two
providers satisfy CANONCORE, which is much weaker than that they satisfy one CONTRACT, and it is the
substitution this seam exists to prevent. The app's copy of each response shape is therefore written
out, `search`'s alongside the three that were already there.

`@canoncore/contract` also has no `exports` map and carries `zod` as a devDependency, so it is not
importable as it stands. That is a consequence of the rule rather than the rule, and it is worth
saying which is which: making it importable would take two lines, and the two lines are not what is
standing in the way.

## An assertion taken across two reads of shared state -- under CNCORE-93

**THE FOURTH SEAM RUNS ONE APP AGAINST SEVERAL INSTANCES, AND UNTIL THIS TICKET NOTHING SAID WHICH
FACTS BELONG TO WHICH.** Vitest runs test files in parallel workers, so `import-page.test.ts` and
`multi-placement.test.ts` write to the seeded catalogue at the same moment that a third file is
reading a number out of it. Two assertions were built on that: a re-import compared
`catalogue.list({}).total` either side of two POSTs, and the front page compared a total it had just
read against the count the page printed.

**THEY WERE NOT FLAKY. THEY WERE WRONG,** and the distinction decides the fix. "The number I read a
moment ago is the number the page prints" is not a relationship that holds against state another
worker writes, so neither assertion was entitled to pass even on the runs where it did. Measured
2026-09-12 against the real provider images: the front page reported 59 items against a total read
as 58, and a re-run of the same commit passed; the re-import assertion failed in two of four full
runs and passed every time its file ran alone. `main` had been green for twelve consecutive runs
because the window is small, and it opened when a fourth instance and an eighth test file added
contention.

**THE RULE: AN ASSERTION MAY ONLY SPAN A WRITE ITS OWN FILE MADE -- WHICH IS NECESSARY AND NOT
SUFFICIENT.** CNCORE-126, at the foot of this record, is the case that shows the gap: an assertion
can span only its own file's writes and still be answered by another test's, when the KEY those
writes were made under is one the OS may hand out twice. Where the fact can be narrowed
to something only this test writes, narrow it -- the re-import's claim is about ONE provider record,
and (this provider, this record) is a pair no other worker touches. Where it cannot, the fact needs
an instance nothing else writes to, and paying for one is the honest price rather than a tolerance:
"how much the catalogue holds" IS catalogue-wide, and a `within one` would assert something weaker
than the one number a catalogue must not get wrong about itself.

**NARROWING IS NOT AUTOMATICALLY WEAKENING, BUT IT CAN BE, AND THE CHECK IS WHETHER THE REPLACEMENT
CAN STILL SEE THE DEFECT.** The obvious narrowing here was `provider.held`, and it is the wrong one:
that procedure, `provider.search` under it, and the page's own row all run through
`findItemsProvided`, which answers with a `Map` keyed by the record's id. A second Item carrying that
id collapses into one entry there, so every surface above it reports a single Item while the
catalogue holds two. The replacement reads the ROWS, which is the only place the second one is
visible. Checked by mutation rather than by reading: with the importer's find-or-create broken,
migration 5's unique index made ordinary, and the collapse ordered so the oldest Item wins it, the
page went on linking the original and only the row-level assertion reported the extras.

**A FIFTH INSTANCE COSTS LESS THAN IT LOOKS AND IS CHECKED BEFORE IT IS PAID FOR.** Each instance
already running was tried first and written down: the fresh one renders no count at all, because an
empty catalogue shows what to do next instead (ADR-0094), and the paged one is written to by nothing
but holds 254 items, so it renders `Holding`'s other arm. What the plain-total arm needs is a
catalogue that is non-empty, smaller than one page and written to by nothing, and no instance here
was all three. Measured locally on 2026-09-12: the whole suite runs in 8.4 seconds with five
instances, and each `next start` reports `Ready in` 60-64ms. What an instance costs after that is
what it serves, and this one serves one request.

**AND THE FIXTURE, NOT THE ROUTER, IS WHAT THE PAGE IS HELD TO.** On shared ground the count had to
be read back from `catalogue.list` because nothing in the test could know it. That was always the
weaker assertion -- the page reads its total by calling that same procedure, so the two agreeing is
one code path agreeing with itself -- and an instance of its own removes the reason for it: the
fixture wrote three items, so the page owes the word "3".

## Five instances, one helper, and an environment that cannot go ambient -- under CNCORE-111

**THE FIFTH INSTANCE IS WHAT MADE THE SHAPE WORTH NAMING, NOT THE FIRST.** Four functions in
`apps/web/e2e/global-setup.ts` spelled out the same run of lines: build a database with a suffix,
take a free port, spawn `next start`, wait until it answers, hand back a close. One copy is a
function; four is a shape nobody declared. `anInstanceServing` is that declaration, over
`theBuildServing` for the port-spawn-wait half.

**THE SPLIT IS TWO HELPERS RATHER THAN ONE, AND THE REASON IS `next build`.** The seeded instance
runs the build BETWEEN its database and its server, because the build needs the environment that
carries the database. A single helper covering both halves could only serve it by taking a flag that
says whether to build, and a boolean deciding which half of a function runs is the shape that makes
the other four harder to read. So the four with nothing in between take `anInstanceServing`, and all
five take `theBuildServing` underneath it.

**WHAT AN INSTANCE IS FOR STAYS IN ITS OWN DOCBLOCK.** The near-verbatim lines were worth folding;
the paragraphs above them were not. Each of the five says which state it exists to serve and why no
instance already running could take it, and that is the part a reader needs and the part an
extraction is most likely to swallow.

**AN OMITTED ENVIRONMENT KEY IS NOT AN UNSET ONE, WHICH IS WHY BOTH ARE REQUIRED PARAMETERS.** These
servers inherit the harness process's environment, so a key left out of a `spawn` is not absent -- it
is whatever the developer's `apps/web/.env` holds, reaching a fixture defined by not having it. The
paged instance omitted `PROVIDER_URLS` for exactly that reason and nothing said so: CNCORE-93 named
it and left it, because on CI, where there is no `.env`, the difference is invisible. `allowlist` and
`providers` are now required fields, so an instance that leaves either ambient does not compile.
**AND THE CHANNEL ITSELF IS GONE SINCE CNCORE-99**: both are Settings rows now, written into an
instance's own database before its server starts, so there is no ambient value left for a
developer's `.env` to supply. The required fields stay, because an instance that did not say what it
reaches is one a reader has to go and work out.

**THAT IS THE SAME MECHANISM AS `TEST_DATABASE_SUFFIXES`, DELIBERATELY.** CNCORE-112 folded into this
ticket because its subject is this helper's first parameter, and both halves land on the same rule:
the harness's variable parts are DECLARED and checked by the compiler, rather than written at each
call site and checked by whoever remembers. One mechanism to learn, in one file, rather than two.

## A fact the file owned, under a key it did not -- under CNCORE-126

**CNCORE-93's RULE HELD HERE, AND THE ASSERTION FAILED ANYWAY.** `provider.search`'s "finds a record
by name, with no id known in advance, and says who answered" spans no write another file made:
`packages/api` runs `fileParallelism: false` and `provider.test.ts` is the only file in that package
that binds a stub, so every write the assertion spans is its own file's. It still read
`itemId: "a35cbedf-1ffc-4dec-acb7-e0523c74ba5a"` where it asserts `null`. The evidence is run
34711644736 **attempt 1**, whose `Test` job failed -- the attempt and not the run, because the
re-run passed and `gh run view 34711644736` now shows `success` to anyone checking the citation.
That log does not witness the reuse directly: no earlier stub on port 40871 appears in it, because
this suite prints a stub's URL only when an assertion fails. The failure is the symptom, and the
mechanism below is what explains it.

**THE KEY WAS NOT THE TEST'S TO KEEP.** A provider's URL is its IDENTITY (ADR-0031); a stub's URL is
`http://127.0.0.1:<whichever port the OS picked>`; and this suite closed each stub's socket as its
test ended, handing that port back while the rows keyed on it stayed in the one database this record
gives the whole run. The OS may hand that port to the next stub, and two tests are then one
provider, the earlier one's imports answering the later one's lookups. Timing rather than logic,
which is why the file passed 36 on six consecutive local runs and failed on a runner.

**SO THE RULE GAINS A SECOND HALF: A FIXTURE'S IDENTITY MUST OUTLIVE THE STATE KEYED ON IT.** The
stubs now close in `afterAll` rather than in `afterEach`. That is not thrift about teardown, it is
what makes two stubs two providers, and the premise is measured rather than reasoned from: on node
v24.19.0, two hundred simultaneous `listen(0)` calls returned two hundred DISTINCT ports, because a
port a live listener holds is not one the allocator may hand out -- binding it explicitly is refused
`EADDRINUSE`. It protects more than the assertion that failed: `previewPurge` asserts its provider
provided exactly two placements, which a shared identity would have made wrong the same way.

**THE EXPOSURE WAS ONLY EVER WITHIN ONE RUN**, which is worth saying because it bounds what had to
be fixed. `buildTestDatabase` drops and recreates the database at the start of every run, so no
identity minted by a previous run has a row left to answer with. What remained was reuse inside a
run, and holding the sockets closes it.

**TWO ALTERNATIVES, WEIGHED AND WRITTEN DOWN RATHER THAN LEFT AS OMISSIONS.** A unique path per stub
is not available: the CMPP client builds every request as `new URL(path, base)` with a leading-slash
path (`packages/providers/src/client.ts`), so a base path is discarded, and only a production change
teaching the client to serve under one could make a path an identity. A database per test would
answer a timing bug by rebuilding the harness the `globalSetup` half of this record describes.

**WHERE THE FIX DOES NOT REACH.** Holding the sockets makes reuse impossible WITHIN a file, so a
second file in `packages/api` binding its own stubs would cross that guarantee silently. There is
none today. The repo's four other loopback stubs are unaffected for reasons rather than by luck:
`packages/providers`, `packages/contract` and `packages/config`'s network-gate suite keep no
database, so nothing is keyed on the identities they mint, and `apps/web/e2e` already closes its
stubs in its `globalSetup` teardown at the end of the run rather than between tests.

## The sixth seam: THE PAGE IN A BROWSER, and the reservation is spent -- under CNCORE-73

**PLAYWRIGHT WAS RESERVED FROM THIS RECORD'S FIRST DRAFT, AND THIS IS WHERE IT IS SPENT.** The
reservation moved twice as slices arrived without needing it -- "a rendered page, on the slice that
first has one", sharpened by CNCORE-4 to "the first slice with real INTERACTIVITY", restated
unchanged under CNCORE-9. Dragging a Placement to reorder a Container is that slice. There is no
reservation left after this one, and a seventh seam is a new argument rather than a draw on this
record's credit.

**WHAT THE SEAM MAY ASSERT IS BOUNDED, AND THE BOUND IS THE POINT OF WRITING THIS SECTION.** Two
claims, both of which need a browser and neither of which anything else can make:

1. **That dragging reorders.** A pointer press, a move that crosses the sensor's activation, a
   release over another row, and the list in a new order.
2. **That the new order survives a reload.** The catalogue moved, not merely the DOM.

**EVERYTHING ELSE ABOUT REORDERING IS ASSERTED WITHOUT ONE, and it is a lot.** The arithmetic is a
pure function with its own unit test. The write is asserted at the second seam, the refusals at the
package export, the whole capability at the fourth seam -- because every row carries Move up and
Move down as native forms and `CLAUDE.md` requires that visible path to exist anyway. The browser is
spent on the gesture and nothing else.

**THE TEST TO APPLY TO THE NEXT CANDIDATE IS THIS ONE:** could a `fetch` observe it? If the answer
is yes, it belongs at the fourth seam, and the fact that a browser COULD also observe it is not an
argument. That is the same criterion this record refused Playwright with three times.

### Its own project and its own CI job

**A SEVENTH INSTANCE WOULD HAVE BEEN CHEAPER AND IT IS STILL THE WRONG SHAPE.** `apps/web/browser`
is a Vitest project of its own -- its own config, its own global setup, its own database suffix,
its own `next build` -- and it runs as a fourteenth CI job called `The page in a browser`.

What that costs is one duplicated instance and one duplicated build. What it buys is that the most
expensive and most brittle thing in this repository fails under its own name: a flake in a drag
reddens a check that says so, rather than the one that says the app serves pages at all. The ticket
asked for this to be decided on duplicated setup rather than on money, because CNCORE-80 established
that standard runners are free in a public repository (ADR-0111, corrected) -- so folding saves
nothing and the diagnosability is free.

**`anInstanceServing` MOVED TO `e2e/instance.ts` RATHER THAN BEING COPIED.** CNCORE-111 named that
shape when a fifth copy of the same lines appeared; a second Vitest project is a sixth caller, and a
copy of it would be exactly the drift the extraction was performed to stop. `theAppBuilt` is
exported beside it and is NOT folded into it, for that record's own reason: the page seam stands up
seven instances off ONE build, so a helper that built per instance would build seven times.

### The gate has a half it cannot reach here, and `context.route()` is the other half

`install-network-gate` patches undici inside the Vitest process. **A BROWSER IS A SUBPROCESS MAKING
ITS OWN REQUESTS**, so this is the one suite in the repository where a page reaching a public host
would go unseen. `browser/reorder.test.ts` routes every request through `context.route()`, continues
the ones whose origin is the instance under test, and RECORDS the rest before aborting them -- an
abort alone makes the page fail in whatever way a blocked request makes it fail, which is a puzzle
rather than a message. The recorded list is asserted empty when the suite ends.

### Three false greens, met in one afternoon

Worth writing down because all three pass silently, and because the guard that caught them was put
in on the strength of the ticket's warning rather than on experience:

- **A PRESS BEFORE HYDRATION DOES NOTHING.** The rows are server-rendered, so every drag handle is
  on the page and has a bounding box before any script has run. The suite waits for
  `aria-roledescription`, which dnd-kit attaches imperatively once its sensor registers -- the
  attribute appearing IS the list becoming draggable, where `networkidle` or a sleep would only
  correlate with it.
- **A BOUNDING BOX BELOW THE FOLD PUTS THE PRESS ON `<html>`.** `boundingBox` answers
  document-relative coordinates whether or not the element is on screen, and `page.mouse` moves in
  VIEWPORT coordinates without the auto-scroll `click` performs. A row at y=771 in a 720-tall window
  was pressed on the page behind it. A taller viewport, a scroll, and an assertion that the box is
  reachable.
- **dnd-kit'S DRAG CLONE MAKES EVERY ROW LOCATOR MATCH TWICE.** It lifts the dragged row into a
  `popover` and leaves an `inert` placeholder where it was, both carrying the row's
  `data-placement`. Playwright's strict mode refused the ambiguous locator -- and that refusal
  reached the runner as `expect.poll` retrying quietly until it timed out, reported as "expected
  null to be true", which is a message about the wrong thing entirely. **A POLL SWALLOWS THE ERROR
  IT IS RETRYING**, which is the transferable lesson.

**AND THE SUITE WAS THEN MUTATED TO PROVE IT FAILS.** A write aimed at a placement id that is not
there turns it red on the reload assertion. The first attempt at that mutation PASSED, which is how
`theAppBuilt` came to be called here at all: `anInstanceServing` only starts a build, so the project
had been serving whatever `.next` happened to be on disk -- green against code that was not the code
under test, and unable to start at all on a fresh runner.

### `browser/` had to be excluded from the unit config by name

Vitest's default `include` sweeps every `*.test.ts` under a package, so a new suite directory is IN
the default config until it is named out of it. `apps/web/vitest.config.ts` excluded `e2e/` and
nothing else, so the browser suite ran under it and failed at its first `inject` -- naming a
variable rather than the config that had swept it. Exclusion is part of adding a project here, not
tidiness after the fact.

## The job that held the real image to the contract ran the stub -- under CNCORE-143

CI's `provider` job is the second of the two runs the CNCORE-9 section above describes: the same
e2e suite, with a variable pointing it at a real provider image instead of a stub. **It had never
reached one.** `pnpm test:e2e` is a TURBO task, `turbo.json` declared only `DATABASE_URL` for it,
turbo 2's env mode is `strict` and there is no `globalPassThroughEnv` -- so `PROVIDER_WIKI_URL` was
filtered out of the task environment, `theProvider()` saw `undefined`, and stood up the stub. The
job ran what the `e2e` job runs. `test:contract` declared its variables and really did reach both
images, and that asymmetry between two adjacent lines is the whole of why nobody saw this.

**MEASURED RATHER THAN REASONED.** The published `:latest` image started on a published port, then
`PROVIDER_WIKI_URL=... pnpm test:e2e`: 213 tests passed over 16 files, and `docker logs` on the
container afterwards held one line, `provider-wiki listening on http://0.0.0.0:8080`. It received
no request at all. The same image answers `GET /lookup/265` with `503` when it holds no session,
which is the state a CI service container is in -- so had the variable arrived, the import through
the app would have failed and the job could not have been green since CNCORE-100 merged.

**A GREEN CHECK THAT ASSERTS NOTHING IT SAYS IT ASSERTS IS WORSE THAN AN ABSENT ONE**, which is
CNCORE-39's "a test whose subject you deleted does not fail; it stops asking" reached through a
build tool rather than a typo. Two files rested their design on the claim this job was carrying:
the job's own comment, and `wiki-fixture.ts`'s "a divergence here would make one of those two runs
a check of the harness against itself". Both runs were.

### The fix is one line; the decision is which provider the job is for

Passing the variable through turns the job RED, correctly, and that is the useful part. With
`search` and `lookup` live since CNCORE-100 and `browse` going live under CNCORE-102, a
`provider-wiki` container holding no Credential can answer NONE of the three:
[[0122-a-provider-declares-the-credential-it-needs]] obliges a provider whose `credential.state` is
not `valid` to answer `search` and `lookup` a `503`, so an import through the app cannot succeed
against one. **Unlocking one in CI is refused rather than deferred**, because that record's fixed
point is that NO CI JOB HOLDS THE OWNER'S SESSION, and the wiki's credential is a browser session
past a Cloudflare challenge page that only a person can pass.

**SO THE JOB RUNS AGAINST `provider-tmdb`, AND THE WIKI IMAGE LEAVES IT.** That provider declares no
credential, needs only a token CI already holds as a secret, and answers `200` with real records --
and the e2e suite already drives it through the app: `importFromTmdb` imports a real film,
`providerSearch.browsable` browses a real collection, the import surface searches it, and
[[0036-tmdb-licence-constraints]]'s notice and mark are rendered
from what the image declared rather than from a stub repeating the expected string back. The job's
subject survives; only which process carries it has changed.

**THE THIRD OPTION, ASSERTING THE REFUSALS IN THIS SUITE, WAS REFUSED.** It would make the
assertions able to tell which process ran -- the one thing the CNCORE-9 section says they must not
-- because every wiki fixture would have to be dropped on the locked branch, and sixteen files read
those fixtures. It is also already done: the `contract` job holds the real locked image to
ADR-0122's obligations directly, which is the state CI can actually put it in.

**WHAT THIS COSTS, NAMED RATHER THAN GLOSSED: no e2e check drives the app against the real
`provider-wiki` image any more.** That is a reduction from zero to zero. The job was not checking it
before, so what is removed is the CLAIM, not the coverage, and the contract job's assertions about
the locked image are unaffected.

### No guard inside the suite could have caught this, and that is the interesting half

The obvious fix is a harness that fails when it falls back to a stub in CI. **It cannot work.** By
the time the suite runs, a filtered variable is simply ABSENT, indistinguishable from one nobody
set -- and a "require the real provider" flag delivered through the environment would be filtered
by the very mechanism it guards against. `CI=true` fails for a different reason: the `e2e` job also
runs in CI and legitimately uses stubs, so the implication is false.

**THAT SAYS "THE HARNESS", AND A FIRST DRAFT OF THIS SECTION OVERSTATED IT TO "NOTHING AT RUN
TIME".** `pnpm test:e2e` is `turbo run test:e2e`, and THAT process sees the whole environment before
turbo filters anything, so a preflight wrapper could compare what it was given against what the task
will receive and refuse. It is rejected rather than impossible, and the reason is placement: it
would put a script in front of every e2e run to catch a fault introduced by editing `ci.yml` or
`turbo.json`, which the suite below catches on the pull request that edits them, in the `Test` job,
naming the fix. A check that fires at the edit beats one that fires at the next run, and the
wrapper is indirection in the path of a command everybody runs.

**THE TWO FILES HAVE TO BE READ AGAINST EACH OTHER FROM OUTSIDE**, which is
`packages/config/src/ci-task-env.test.ts`. It asserts two halves of one loop: a variable a job sets
in its OWN `env:` reaches the turbo task that job runs, and a provider container a job STARTS is
addressed by a variable that job sets. The first catches the defect as it happened; the second
catches its appearance in the workflow file, where a job that starts the real image reads as a job
that tests it.

**ASKED OF `turbo` RATHER THAN OF `turbo.json`**, for the reason `turbo-cache-inputs.test.ts` gives
about `inputs`: reading the config back and asserting the entries are present restates the fix in a
second language and passes by construction wherever it is wrong. Only `--dry=json` knows what a
task will actually receive, since `globalPassThroughEnv`, a package's own `turbo.json` and the env
mode all land in the same answer.

**JOB-LEVEL `env:` IS THE SUBJECT AND WORKFLOW-LEVEL IS NOT.** The workflow block is the shared
environment; a JOB setting a variable for itself is saying the work it runs needs it. A variable
only a shell step needs belongs on that STEP, which is how `ci.yml` already spells `BASE_REF` -- so
the fix for a false positive here is to move the variable to the step that reads it, which is the
more precise spelling anyway.

**BOTH GUARDS WERE CHECKED BY MUTATION RATHER THAN BY BEING GREEN.** Dropping `PROVIDER_TMDB_URL`
from `test:e2e` reddens the first, naming every planned task that would not receive it; putting the
wiki image back into the `provider` job unaddressed reddens the second, naming the container.
