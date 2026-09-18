---
status: accepted
---

# An import run is rows, and the walk is one Container a call

> **ACCEPTED 2026-09-14, whole, in one repository.** Migration 18 holds the run,
> `provider.beginImportRun` / `importNextContainer` / `readImportRun` walk and report it,
> `importContainerList` is the driver and `pnpm import:list` is the Owner's command. No Provider
> repository is touched, so there is no cross-repo pair here and nothing waiting on a second ticket.

Importing the wiki's corpus is 465 Containers. `browse` takes ONE container id (ADR-0033) and CMPP
had no operation answering "which Containers do you have", so before this the corpus was 465 form
submissions with an id pasted into each. CMPP declares one since CNCORE-185 and no Provider answers
it yet, so the list is still the Owner's own and nothing here changes.

**The loop is four lines. What was missing is somewhere for the loop's POSITION to live.** A walk
holding where it got to in one process's memory starts again from the beginning whenever anything
interrupts it, and at 43.8s a Container — the figure an import actually pays, measured against the
live wiki 2026-09-13 — the whole list is about five and a half hours.

**THAT ESTIMATE IS WRONG BY AN ORDER OF MAGNITUDE, AND THE CORRECTION BELONGS IN THIS SENTENCE**
(ADR-0137, CNCORE-167). 43.8s is the cost of AHistory, the LARGEST page on the wiki, and multiplying
it by 465 is not a bound on the list — it is a different quantity. The median Ordering holds **19**
Placements; 319 of the 439 that hold anything hold fewer than 50, and nine hold more than 500. **The
whole corpus landed in roughly ELEVEN MINUTES**, measured 2026-09-15 into the Owner's own install.
Everything this record decides about resuming still holds: what was wrong was the size of the job,
not the need to survive losing it.

## The run is rows, at the grain of one Container

Migration 18: `import_runs` carries which Provider the walk is at, and `import_run_containers`
carries one Container's id, its place in the Owner's list, and how asking for it went.

**It is `task_runs`'s argument at a finer grain.** ADR-0049 opens a run when it STARTS rather than
writing one when it finishes, "which is what makes a run that never finished readable at all". What
a resume needs to read back here is not whether the run finished but WHICH OF ITS 465 CONTAINERS
DID, so the rows that carry an outcome are the Containers.

**There is no column saying a run has finished**, for the reason migration 13 gives itself in
`task_runs_running_has_no_end`: a run is open exactly while a Container of it is still `pending`,
which the rows already hold, and the same fact stored twice is two facts free to disagree.

**And there is no claim column, which is the one thing a reader will expect and not find.** The
obvious shape for this table is a work queue — claim a row, mark it running, release it on a
timeout — and every part of that machinery exists to stop two workers taking one item. There is one
worker: the walk awaits each Container before asking for the next. A claim would buy mutual
exclusion against a second walk nobody starts, at the price of a stale-claim timeout, which is a
duration nobody has measured and a run that strands itself when it is wrong. A Container interrupted
mid-browse stays `pending` and is simply asked again, which is correct because
`importBrowsedContainer` is ONE TRANSACTION: a Container is wholly in the catalogue or wholly
absent, never half, so re-asking refreshes rather than doubles (ADR-0026, ADR-0078).

## A Container is done when it has LANDED, and a refusal is an attempt rather than a verdict

A run is still walking while a Container of it has not landed, so handing the same list over again
asks again for what REFUSED as well as for what was never reached.

**That rule is chosen against what actually interrupts a run.** ADR-0122's Credential lapses within
a day, and it does not stop a walk: it makes every remaining Container refuse. A resume that treated
a refusal as settled would leave the Owner's remainder reachable only by re-walking the 200 that had
already landed — and CNCORE-159's own story is "a lapsed Credential costs me the remainder rather
than the whole".

**One `begin` is one attempt, and that is the line between them.** Resuming puts every Container
that has not landed back to `pending` and clears the previous attempt's reason. Within an attempt
`pending` means "not asked for yet", which is what stops the walk re-asking for a Container that
just refused and looping on it forever; across attempts a refusal is not a verdict.

**A run is found again by the PROVIDER AND THE EXACT LIST, in order.** That makes the Owner's own
command the whole of the interface: they type the same thing again and it carries on, they change
what they are importing and it starts afresh. Matching on the Provider alone would resume a walk
over a different list and report it as this one's progress.

**THE COST, SAID OUT LOUD:** a Container that refuses every time — an id that was never a Container,
a page since deleted — keeps its run open, so handing the same list over again resumes that run
rather than importing the list afresh. It is visible rather than silent, because what `begin`
answers says what is still to do. The way out falls out of the matching rule rather than needing a
switch, since correcting the list makes it a different list and therefore a new run.

**A list whose every Container landed opens a FRESH run**, which is how a re-import refreshes rather
than doing nothing.

## One Container a call, which is where "one at a time" is actually held

`importNextContainer` browses the next Container and answers the one it did, so which is next is a
question only the run can answer once this one is recorded. **A caller has nothing to parallelise
even by accident.**

The constraint is measured rather than tidy: `provider-wiki` is one Node process, and two concurrent
browses of the largest Ordering took **49.1s each against 25.5–26.4s alone** across five runs
(2026-09-13). Parallelism here is slower as well as ruder.

**IT IS ASSERTED AGAINST WHAT THE PROVIDER SAW**, not against what the driver intended, because
what a Provider has is the requests: the suite's stub counts how many it is answering at once and
the walk is held to one. The assertion was checked by breaking it — a `Promise.all` over two steps
turns it red.

**The split between opening a run and walking it is what makes a long walk possible at all** — about
eleven minutes for the corpus rather than the five and a half hours estimated above. No single
request waits on more than one browse, and opening a run asks the Provider nothing, so an Owner who
typed 465 ids does not wait a browse before the list exists.

## The driver takes a CLIENT, because an install publishes no database port

`importContainerList` drives the app's own API rather than a `Database`, and that is forced rather
than chosen: `compose.yaml` publishes no port for Postgres — "Only the app talks to this, over the
network Compose makes for the project" — so the app is the only route into a running instance.

The same function therefore fills the Owner's install, a stranger's, or a test's in-process router
with nothing swapped out, and `pnpm import:list` passes `--provider` through verbatim, so a Provider
host only the app can resolve (`http://provider-wiki:8080`, on the network CNCORE-163 created) is
named exactly as the app sees it.

**A page is refused here and CNCORE-159 already said so**, putting the import driver at ADR-0103's
first seam rather than among its pages. A surface for an operation of this length needs a background
worker this repository does not have: ADR-0049's registry is RECURRING work on a daily trigger, and
`CONTEXT.md`'s Task headword says so in those words, which a one-off corpus import is not.

**THE MEASURED ELEVEN MINUTES DOES NOT REOPEN THAT**, though it is the obvious thing to try next.
Eleven minutes is still far past what a request may hold open, the run that actually filled the
install was INTERRUPTED and resumed rather than run once, and the cold-Provider cost is unmeasured
because the cold run is the one that was interrupted (ADR-0137). What has changed is that whoever
builds the surface is sizing it against minutes rather than against an afternoon.

## What this does NOT give a stranger, said rather than left to be found

CNCORE-159 lists "importing in bulk" among the things that make ADR-0115's sentence true for both
audiences (ADR-0107). **As built it reaches the Owner and not a stranger**, because the command is a
script in this repository and an install from `compose.yaml` alone is the app and its database with
no checkout to run one from. Importing one Container at a time from `/import` is on every install and
is untouched.

That gap is a SURFACE rather than a mechanism: everything behind it — the run, the walk, the report,
the resume — is in the app and reachable by any client of its API. What a page would additionally
need is somewhere for a five-and-a-half-hour operation to live while nobody is watching it, which is
a background worker this repository does not have and which ADR-0049's registry is not: that is
RECURRING work on a daily trigger. Whatever builds it inherits this record's procedures rather than
replacing them.

## Two things implementation taught, recorded because neither was foreseen

**A fixture positioned relative to the head of a forward-only ladder moves every time the ladder
grows.** `sort-name.test.ts` built its upgrade case from "the ladder before its LAST rung", which
was the sort-name rung only while nothing sat on top of it. Migration 18 landed on top, and the
test went from asserting an upgrade to asserting nothing — the Item arrived WITH a sort name, so the
line written to prove the defect was the line that broke. It names its rung now. ADR-0047 makes the
ladder forward-only and therefore always growing, so relative positions in it are never stable.

**`tsc` resolves an extensionless specifier that bare `node` will not.** The Owner's command is a
script under `node`, and a typechecked, fully green branch still died at `ERR_MODULE_NOT_FOUND` on
its first real run. `packages/db/tsconfig.json` had already met this and turned
`allowImportingTsExtensions` on for `check-ladder.ts`; the answer taken here is the other one, which
costs no compiler option: **the script reaches its own package by NAME, through the exports map that
already spells the `.ts` out.** That is also what moved `SESSION_COOKIE` into `@canoncore/api` — it
is the wire contract for the router that package publishes, and it had been unreachable outside a
request because it sat beside `next/headers`.

## Evidence

- **Hand-walked against a running instance, 2026-09-14**, which is ADR-0132's gate applied to a
  ticket rather than to a project. A list of four ids — one of them an id the Provider does not hold
  — imported three Containers in the Owner's order, refused the fourth in CanonCore's own voice, and
  left `import_run_containers` reading `landed, landed, refused, landed` at list positions 0 to 3.
  Running the same command again answered "carrying on: 3 already landed, 1 to ask for" and asked
  the Provider for that one alone.
- **The concurrency figures are CNCORE-159's**, measured against the live wiki on 2026-09-13 and not
  re-measured here: 25.5–26.4s for one AHistory browse across five runs, 49.1s each for two at once,
  43.8s end to end for the page an import pays for. **That last figure is AHistory's and the
  corpus's median Ordering holds 19 Placements**, which is why the five-and-a-half-hour estimate built on it
  is corrected at the top of this record (ADR-0137).
