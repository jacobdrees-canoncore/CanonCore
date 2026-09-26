---
status: accepted
---

# An import run is rows, and the walk is one Container a call

> **ACCEPTED 2026-09-14, whole, in one repository.** Migration 18 holds the run,
> `provider.beginImportRun` / `importNextContainer` / `readImportRun` walk and report it,
> `importContainerList` is the driver and `pnpm import:list` is the Owner's command. No Provider
> repository is touched, so there is no cross-repo pair here and nothing waiting on a second ticket.
>
> **EXTENDED TO A SECOND GRANULARITY UNDER CNCORE-373, 2026-09-26: A BATCH.** Migration 27 holds
> where a Container walked in batches has got to, and `importNextContainer` asks for one batch a
> call. That one IS a cross-repo pair: `provider-wiki` answers an infobox in batches, and its PR
> is linked from this one's. The half left is withdrawal (CNCORE-437), below.

Importing the wiki's corpus is 465 Containers. `browse` takes ONE container id (ADR-0033) and CMPP
had no operation answering "which Containers do you have", so before this the corpus was 465 form
submissions with an id pasted into each. CMPP declares one since CNCORE-185. No Provider answered it
with a Container until CNCORE-208 on 2026-09-19 (ADR-0033). `/import` asks it since CNCORE-187, so the
Owner can pick ONE Container rather than typing its id; a run does not ask it, so the list a run
walks is still the Owner's own and nothing here changes.

**The loop is four lines. What was missing is somewhere for the loop's POSITION to live.** A walk
holding where it got to in one process's memory starts again from the beginning whenever anything
interrupts it, and at 43.8s a Container — AHistory's cost, the LARGEST page on the wiki, rather
than what a typical one pays — the whole list looked like about five and a half hours. It is ELEVEN
MINUTES, measured 2026-09-15 into the Owner's own install.

**THAT ESTIMATE WAS WRONG BY AN ORDER OF MAGNITUDE, AND THE CORRECTION NOW STANDS IN THE SENTENCE
THAT MAKES IT** (ADR-0137, CNCORE-167; moved into that sentence under CNCORE-327, which found it had
been left in this one). 43.8s is the cost of AHistory, the LARGEST page on the wiki, and multiplying
it by 465 is not a bound on the list — it is a different quantity. The median Ordering holds **19**
Placements; 319 of the 439 that hold anything hold fewer than 50, and nine hold more than 500. **The
whole corpus landed in roughly ELEVEN MINUTES**, measured 2026-09-15 into the Owner's own install.
Everything this record decides about resuming still holds: what was wrong was the size of the job,
not the need to survive losing it.

**MIGRATION 18'S PROSE STILL CARRIES THE SUPERSEDED ESTIMATE, AND CANNOT BE CORRECTED WHERE IT
STANDS.** The rung repeats the sentence above almost word for word, and
[[0047-migrations-are-a-forward-only-ladder]]'s freeze check hashes every applied rung against
Drizzle's ledger: editing it fails `db:check-ladder` on every database that has run it, the Owner's
install included. It is the same wall
[[0134-a-sort-name-is-derived-by-stripping-a-leading-article]] met, and the same answer -- the rung
was frozen the moment a release applied it, which is that record's rule working rather than an
obstacle to route around. So the correction lives here, and
[[0195-a-corrected-figure-is-held-by-a-check-rather-than-by-another-sweep]]'s check REPORTS that rung
by name rather than refusing it, holding the set to exactly one so a new rung stating the figure is
caught while it can still be edited. A reader of migration 18 owes it eleven minutes, not the
estimate it quotes, and nobody should try to fix it there (CNCORE-327).

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
absent, never half, so re-asking refreshes rather than doubles (ADR-0026, ADR-0078). For a Container
walked in batches (CNCORE-373) the same holds of each BATCH rather than of the Container: a batch is
wholly in or wholly absent, and the cursor moves only after it commits.

## A Container is done when it has LANDED, and a refusal is an attempt rather than a verdict

A run is still walking while a Container of it has not landed, so handing the same list over again
asks again for what REFUSED as well as for what was never reached.

**That rule is chosen against what actually interrupts a run.** ADR-0122's Credential lapses within
a day, and it does not stop a walk by itself: it makes every remaining Container refuse. Since
CNCORE-373 the walk stops at the first one, on the Provider's own `expired`, and leaves the rest
`pending` rather than refused (see the CNCORE-373 section below). A resume that treated
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
need is somewhere for an eleven-minute operation to live while nobody is watching it -- the
five-and-a-half hours this record estimated further up is corrected to eleven minutes by its own
re-measurement above, and this sentence is the third statement of it, corrected under CNCORE-252 --
which is
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

## What the first entity import taught about resuming (CNCORE-367)

**AN ENTITY INFOBOX IS ONE CONTAINER, SO A RUN OVER ONE NEEDED NOTHING NEW.** CNCORE-367 made an
infobox browsable (ADR-0033), and a run listing `8103` and `203134` is an ordinary run at this
record's grain: two Containers, 555 and 40 Unplaced members, one call each.

**A WHOLE RUN REFUSED COST NOTHING, AND THE SAME COMMAND CARRIED IT ON.** Rehearsed on
2026-09-26 against a development install, the first attempt refused both Containers in under a
second: the provider was run on a host whose default route is IPv6, and the clearance is bound to
IPv4 (`provider-wiki`'s README, CNCORE-206). Once it was run over IPv4, the same list resumed the
SAME run and landed both. That is this record working exactly as written -- a refusal is an attempt.

**WHAT IT DID NOT COVER, AND WHAT CNCORE-373 INHERITS.** The refusal did not stay in the run: the
provider marked its session `lapsed` in the file it read, though the session was good over the
route it was bound to. A run can resume; a credential marked lapsed by a refusal that was not about
the credential cannot, until somebody renews or restores it. And one Container a call stops being
the right grain for the entity kinds that follow: `Infobox Individual` alone holds 23,653 pages,
which one browse, one transaction and ADR-0130's sixty-second cap will not take. That is the
batch granularity CNCORE-373 is filed to give a home, and this record is where it lands.

## A Container walks in batches, and the run holds where (CNCORE-373)

**THE SAME RULES, ONE LEVEL DOWN.** Everything above decides resumption at the grain of a
Container. An entity infobox is too large for that grain: `Infobox Individual` holds 23,653 pages,
and one browse of it is one transaction and 1,479 `ask` requests inside ADR-0130's sixty seconds.
So `browse` now answers a Container that large in BATCHES (`CONTEXT.md`), and each rule this record
states of a Container holds of a batch:

- **The position is a row.** Migration 27 puts the Provider's cursor on the Container's row
  (`batch_cursor`). A batch that lands moves it and adds to the Container's counts; the Container
  stays `pending` until its last batch lands.
- **A refusal is an attempt, and it costs the batch it was in.** A batch that refuses leaves the
  cursor where it was and every earlier batch landed. Handing the same list over again carries on
  from THAT batch, not from the first -- so resuming no longer clears the counts or the cursor,
  only the outcome and the previous attempt's reason.
- **One batch a call**, for the reason one Container a call is held above: a caller has nothing
  to parallelise. `provider.browse`, the one request that lands a Container whole, follows every
  `next` itself; the walk too long for a request is the run's.

**A BATCH IS WHOLLY IN OR WHOLLY ABSENT, AND IT WITHDRAWS NOTHING.** Each batch is one transaction
of `importBrowsedContainer`, which is what makes asking for a batch again refresh rather than
double. But what a batch leaves out is the other batches, not what the source stopped asserting, so
withdrawal (ADR-0078) is skipped for a batch. **THAT IS THE HALF NOT BUILT:** a Container walked in
batches never takes back a Placement its Source stopped asserting. CNCORE-437 carries it, and a
`TODO` at `importBrowsedContainer`'s `batch` parameter names that ticket. Nothing that withdrew
before stops withdrawing: only an infobox answers in batches, and infoboxes arrived under CNCORE-367.

**A LAPSED CREDENTIAL NOW STOPS THE WALK, WHICH THIS RECORD SAID IT DID NOT.** The rule above that
a refusal is one Container's still holds for every other refusal. A lapse is different in kind: it
makes every Container after it refuse too, so walking on turns one lapse into a run of refusals
the Owner has to read past. When a batch refuses, the step asks the Provider's manifest whether its
Credential is `expired` (ADR-0122) and, if it is, answers `stopped` with a sentence of CanonCore's
naming the lapse, and the driver ends the walk. What is left stays `pending`. **ON EVIDENCE:** the
manifest is the Provider's own claim about its Credential, where the refusal's text is prose it may
word however it likes. The CNCORE-367 section above names the cost of trusting it: a Provider that
marks a good session lapsed stops the run, and renewing or restoring it is what carries it on.

**A REFUSAL REPORTED AS SUCCESS IS THE PROVIDER'S TO READ, AND IS.** Semantic MediaWiki answers an
`ask` over its limit with `200`, an empty `results` and `error.query`. `provider-wiki` has read the
KEY, not the count of results, since 2026-09-13 (`askRefused`), and answers `503`, so no Item,
Placement or Statement is written from one and the batch is still to be asked for. An EMPTY batch
is an answer and carries on. Both are asserted at the router in-process.

**THE CEILING, RE-TAKEN OVER THE POPULATION AN ENTITY IMPORT ASKS ABOUT** (ADR-0153). A batch is
at most `ASK_SUBJECTS` members because each member is one `ask` subject. That figure, sixteen, was
measured on STORY subjects on 2026-09-13. On **2026-09-26**, over the members of
`Template:Infobox Event or Exhibition` (namespace 0, non-redirects, the four printouts
`provider-wiki` asks for), two asks of 16 entity subjects answered 16 results each, and one of 17
answered `200` with `error.query` and no results. `pnpm capture:live` in `provider-wiki` retakes
it and commits the answers as `ask-entities-over-the-limit.json` and the infobox's
`browse-events-or-exhibitions-*` captures.

## Evidence

- **Hand-walked against a running instance, 2026-09-14**, which is ADR-0132's gate applied to a
  ticket rather than to a project. A list of four ids — one of them an id the Provider does not hold
  — imported three Containers in the Owner's order, refused the fourth in CanonCore's own voice, and
  left `import_run_containers` reading `landed, landed, refused, landed` at list positions 0 to 3.
  Running the same command again answered "carrying on: 3 already landed, 1 to ask for" and asked
  the Provider for that one alone.
- **The concurrency figures are CNCORE-159's**, measured against the live wiki on 2026-09-13 and not
  re-measured here: 25.5–26.4s for one AHistory browse across five runs, 49.1s each for two at once,
  43.8s end to end for the page an import pays for. **That last figure is AHistory's, the LARGEST
  page on the wiki, and the corpus's median Ordering holds 19 Placements**, which is why the
  five-and-a-half-hour estimate built on it is corrected at the top of this record (ADR-0137).
