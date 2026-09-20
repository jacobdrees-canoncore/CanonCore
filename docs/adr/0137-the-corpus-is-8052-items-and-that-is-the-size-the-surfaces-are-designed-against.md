---
status: accepted
---

# The corpus is 8,052 Items, and that is the size the surfaces are designed against

> **ACCEPTED 2026-09-15, whole, in one repository.** The Owner's install holds the wiki's timeline
> corpus; `readCorpusCensus` counts it through the app's own API and `packages/api/corpus/` asserts
> what landed. No Provider repository is touched, so there is no cross-repo pair here and nothing
> waiting on a second ticket.

CNCORE-159 said the thing three projects claimed was never true: **nothing had ever used this product
at the size it is designed for.** It has now. Every figure below was read out of an installed
CanonCore holding a real catalogue, through the same procedures a reader's browser calls.

## What is standing

Measured 2026-09-15 against the Owner's install, `docker compose up -d` from the published
`compose.yaml`, with `provider-wiki` beside it on `canoncore_providers`.

| | |
|---|---|
| Orderings asked for | 465 |
| Orderings landed | **465**, none refused |
| Items in the catalogue | **8,052** |
| Distinct stories placed | **7,587** |
| Placements | **30,896** |
| Most Orderings one Item sits in | **48** — `Endgame (POT comic story)` |
| Largest Ordering | 2,907 — `Theory:Timeline - Doctor Who universe/AHistory` |

**THE TWO FIGURES IN BOLD ARE THE ONES NOBODY HAD COUNTED**, and CNCORE-159 is explicit that
nothing computed either: it guessed "about seven thousand" for the first, an earlier draft of it
said thirty-six for the second, and ADR-0119 says twice that nothing counts an Item's placements.
The guess was close and the draft was not.

**NOTHING PLACED IS ITSELF AN ORDERING, AND THAT IS WHAT MAKES THE FIRST FIGURE A COUNT OF
STORIES.** The census answers it directly — `orderingsPlaced` is **0** — and `corpus-stands.test.ts`
asserts that rather than the arithmetic.

**AN EARLIER DRAFT OF THIS RECORD PROVED IT BY SUBTRACTION AND THE PROOF DID NOT HOLD**, which is
worth keeping because the sum is so nearly convincing. 465 + 7,587 = 8,052 exactly, and it is
tempting to read that as "every Item is either an Ordering or a story inside one". It is not: write
it out as `items = orderings + placed + unplacedItems` against `itemsPlaced = placed + nested`, and
**one nested Ordering cancels against one Item in no Ordering**. The sum holds whenever those two
counts happen to be equal, so it can be true of a catalogue that has both. It was also an EXACT
equality in a suite whose own rule is floors, so the Owner creating a single Group or Person by hand
would have reddened it.

**AND EVERY ONE OF THE 7,587 IS OF KIND `work`**, read off the install directly. That is the other
half of "story": `itemsPlaced` counts Items of whatever kind, and what makes it answer the ticket's
question here is a measurement rather than a guarantee. A corpus that placed a Person would need the
figure said differently.

**AHISTORY LANDED AT 2,907 AGAINST ITS 2,913, two days apart on a wiki editors edit.** That is the
reason every assertion in the corpus suite is a FLOOR: an exact count reddens on the next edit,
where a floor still catches a truncation.

**THE 30,896 AGAINST CNCORE-159's 29,844 IS NOT A LIKE-FOR-LIKE COMPARISON AND NOTHING SHOULD BE
READ INTO THE DIFFERENCE.** That spec counted "slots ... as a partition of four disjoint outcomes",
and whether its partition included members the page gives no position is not recorded. **701 of
ours carry no Position** — CONTEXT.md's Unplaced, which is a Placement rather than an absent one —
so a denominator that excluded them would account for most of the gap without a single edit. The
figure here is stated for what it is: every Placement this install holds.

**AND THE CODE SAYS `placements` WHERE THE TICKETS SAY "SLOTS"**, deliberately. ADR-0116 already
spends that word on the other side of the relation — "positions are SLOTS", "two placements sharing
a slot are ordered by ids" — so a slot is a POSITION that Placements can share. Counting Placements
and calling them slots would put two senses of one word in one codebase, which is the hazard
`CONTEXT.md` bans `duplicate` over.

## 26 Orderings hold nothing, and they are not a defect

439 of the 465 hold something. The 26 that do not are named `Theory:Timeline - Popes`,
`- Leaders of France`, `- President of the United States`, `- The Doctor's age`,
`- The Master's incarnations`. **They are prose timelines ABOUT a subject rather than orderings OF
stories**, so the parser finds no story to place and the Container lands empty.

**ADR-0128 already knew this shape one level out** — "THE PREFIX IS THE PREDICATE, NOT THE
NAMESPACE ... Namespace 114 holds far more than timelines". The prefix is not a perfect predicate
either: `Theory:Timeline` catches pages that are not orderings. Nothing here changes the population,
because an empty Ordering is an honest row and dropping it would need a rule for which pages are
"really" timelines that the wiki does not offer.

**IT IS A ROW CNCORE-183 HAS TO RENDER.** That ticket makes an Ordering's Row say how much it holds,
and 26 of these rows say zero. CNCORE-159 already carries the story for the adjacent case — "a
Group with nothing in it to say so plainly, so that an empty scope does not look like a broken one"
— and it applies here unchanged.

## The size distribution, which is what the next surfaces are actually sized against

Across the 439 Orderings that hold anything:

| min | median | mean | p90 | max |
|---|---|---|---|---|
| 1 | **19** | 70.4 | 157 | 2,907 |

319 of them hold fewer than 50 Placements. **Nine hold more than 500.** So the corpus is a long tail of
small Orderings with a handful of very large ones, and a surface tuned for the median would be
wrong about the nine that matter most.

## What the surfaces do at that size

Median of five, against the running install:

| | |
|---|---|
| `GET /` | 32.6 ms |
| `GET /works` | 27.5 ms |
| `GET /search?q=dalek` | 25.6 ms |
| `catalogue.list` page 1 | 17.1 ms |
| `catalogue.list` page 11 | 15.0 ms |
| `catalogue.list` page 31 | 14.8 ms |
| `catalogue.list` page 61 | 14.9 ms |
| `item.get`, AHistory's first page of members | 16.1 ms |
| `GET /items/<AHistory>` | 37.4 ms |

**A PAGE DEEP IN THE WALK IS NOT SLOWER THAN THE FIRST**, which is the measurement ADR-0119 asked
for and could not take.

**AND THE ALPHABET IS REAL, WHICH IS CNCORE-159's OWN HEADLINE COMPLAINT.** That spec says "nothing
ever asserts a sort name, so every Listing is ordered by raw title and *The Daleks' Master Plan*
files under T". Read back off the install: its `sortName` is `Daleks' Master Plan (TV story)`, so it
files under D, and the front page's first screen runs `... Agent Provocateur`, `The Age of
Ambition`, with the article stripped rather than sorted on (ADR-0134, CNCORE-173). That story sits
in **47** Orderings, one short of the corpus maximum.

**WHAT THE FRONT PAGE DID NOT OFFER WHEN THIS WAS WRITTEN WAS THE REST OF THE WALK.** It said
"Showing 100 of 8052 items" and ended in a single `Next` link, so the eighty-first page was eighty
presses away. That was CNCORE-159's navigation stage rather than a defect found here, and it is
recorded because this was the first time anyone had seen it at the size the argument is about.

**THAT STAGE LANDED FOUR DAYS LATER AND THIS PARAGRAPH DID NOT FOLLOW IT** (CNCORE-252). CNCORE-174
put the alphabet bar on `/` and CNCORE-188 added `Previous` and a position -- "items 3,201 to
3,300" rather than a bare "Showing 100" -- so the walk this names as missing is the walk the front
page has. `JumpToALetter` and the `Previous` link are both in `apps/web/src/components/listing.tsx`.

## ADR-0119's index stays unadded, and now for a measured reason rather than an absent one

That record refuses an index on `(coalesce(sort_name, title), id)` and says exactly why it cannot
settle the question: "nothing has measured a problem at this size ... an index added against a
number nobody has taken is a migration written on a guess." **The number is now taken.**

`explain analyze` on the catalogue listing's order at 8,052 rows:

```
Limit  (actual time=3.074..3.093 rows=100)
  ->  Sort  (actual time=3.073..3.077 rows=100)
        Sort Key: (COALESCE(sort_name, title)), id
        Sort Method: top-N heapsort  Memory: 48kB
        ->  Seq Scan on items  (actual time=0.014..1.597 rows=8052)
              Filter: (deleted_at IS NULL)
Execution Time: 3.132 ms
```

**ADR-0119's structural prediction holds exactly — still a `Seq Scan`, still no seek — and the cost
is 3.1 ms.** Scanning 8,052 rows is 1.6 ms of that. So the index is not added, and the reason has
changed from "nobody has measured it" to "measured, and there is nothing here to fix". The question
becomes live at a size this corpus does not reach, and whoever reaches it should re-run the two
lines above rather than trusting this one.

## Importing the corpus costs about eleven minutes, not five and a half hours

**ADR-0135 estimated the corpus at "about five and a half hours", and that is 465 × 43.8s — the
cost of ONE page multiplied by the count.** The page it used is AHistory, the largest on the wiki.
The median Ordering holds 19 Placements.

Measured end to end on 2026-09-15, the whole corpus landed in roughly ELEVEN MINUTES of productive
import. **The correction is in ADR-0135's own sentence**, and the lesson generalises past this
ticket: an estimate that multiplies a worst case by a count is not a bound, it is a different
quantity.

**ONE CAVEAT SAID OUT LOUD RATHER THAN LEFT TO BE DISCOVERED.** `provider-wiki` caches, and its
container had already been asked for many of these pages before the run that finished. A first
import into a cold Provider is slower than eleven minutes and nothing here measures how much
slower, because the cold run is the one that was interrupted. What is measured is that the estimate
is wrong by an order of magnitude and why.

## The wiki rate-limits a corpus import, and a refusal storm is what sustains the block

The first run landed 12 Containers and then tardis.wiki began resetting connections. Under the
retry storm the provider container's own DNS gave out:

```
20:40:15  ECONNRESET  host: 'tardis.wiki'     (many, in the same second)
20:41:05  getaddrinfo ENOTFOUND tardis.wiki
```

**The driver went on asking for the remaining 450 anyway, and every one of those was a doomed
request.** 453 refused in a run that had already lost its Provider. DNS recovered on its own once
the load stopped, so nothing was misconfigured: the storm was the problem.

**ADR-0135's resume is what made this recoverable, and it needed no change.** A run is rows, and
resuming asks again only for what has not LANDED — refusals included, because "a refusal is an
attempt rather than a verdict". Killing an attempt mid-browse is safe by that record's own design:
an interrupted Container stays `pending` and is asked again, because `importBrowsedContainer` is one
transaction. So the corpus was filled by running the same command over the same list and stopping
each attempt the moment refusals cascaded.

**WHAT IS NOT BUILT, AND IS NOT BUILT DELIBERATELY:** the driver has no backoff of its own. It would
be one, and this record does not add it, because the pacing belongs to a rate limit that one wiki
chooses and that nothing in this repository can observe — `provider-wiki` already honours
`Retry-After` where the wiki sends one, and an `ECONNRESET` carries no header to honour. Whatever
next meets this should decide it with a figure, the way this record decided the index above.

## The catalogue survives a restart and a rename, measured with the corpus in it

ADR-0132's gate is "a running instance the Owner actually opens". Both survival claims were checked
against the full corpus rather than against an empty install, by re-running the census and comparing
every figure:

- **`docker compose restart`** — identical census.
- **`mv ~/canoncore ~/catalogue && docker compose up -d`**, which is a DIFFERENT Compose project
  (`catalogue`) with NEW containers reading the pinned `canoncore_data` volume — identical census.

**NOTHING ASSERTS THIS AND THE PROCEDURE IS WRITTEN OUT INSTEAD, which is a choice rather than an
omission.** A suite that renamed the Owner's directory and drove Compose would be a test with the
power to take their catalogue down, and the thing being checked is Docker's behaviour rather than
this repository's. So it follows ADR-0135's evidence, which is hand-walked in the same way. It is
repeatable in four commands, and the census is what makes it an assertion rather than a look:

```bash
CANONCORE_AT=http://localhost:3000 pnpm --filter @canoncore/api test:corpus   # before
cd ~/canoncore && docker compose stop && mv ~/canoncore ~/catalogue
cd ~/catalogue && docker compose up -d
CANONCORE_AT=http://localhost:3000 pnpm --filter @canoncore/api test:corpus   # same figures
```

**NEVER `docker compose down --remove-orphans` HERE**, which is the one command that would do harm:
ADR-0104 spends the project name `canoncore` on the development container, so `--remove-orphans`
from an install directory would take the Postgres every worktree shares.

**Compose warns about the NETWORK as well as the volume**, and `compose.yaml` documents only the
volume. After a rename it prints both:

```
a network with name canoncore_providers exists but was not created for project "catalogue"
volume "canoncore_data" already exists but was created for project "canoncore" (expected "catalogue")
```

Neither warning is a fault and both are permanent, for the reason that file already gives about the
volume: taking Compose's `external: true` suggestion would make a FIRST install fail on an object
that does not exist yet.

**AND A BARE `docker compose stop` IN THE INSTALL DOES NOT TOUCH THE DEVELOPMENT CONTAINER**, which
matters because ADR-0104 spends the project name `canoncore` on that container and `docker compose
ps` in the install therefore LISTS it. Measured with `--dry-run`: `stop` acts on the two services
the file declares and leaves `canoncore-postgres` running. Only `--remove-orphans` would take it,
which `compose.yaml` already says.

## What this does not answer

**Nothing here is a claim about a catalogue an order of magnitude larger.** Every figure is a
measurement of 8,052 Items on one Mac, and the only honest way to know the next size is to reach it
and re-run `pnpm test:corpus`.

## Evidence

- The census is `packages/api/src/corpus-census.ts`, walked through the app's own API rather than
  its database — ADR-0132's reason applied one layer down: a census that reached past the app into
  Postgres would be the repository checking itself again. Its arithmetic is checked in CI over a
  corpus small enough to state by hand (`corpus-census.test.ts`); what runs only on the Owner's
  machine is the assertions.
- `packages/api/corpus/corpus-stands.test.ts`, in a Vitest project of its own, never run by `pnpm
  test` or by turbo, and skipping rather than reddening when no install is named.
- The timings and the `explain analyze` above were taken by hand against the running install on
  2026-09-15 and are not asserted anywhere: they are figures about one machine, and a suite that
  asserted them would be a flaky test of this laptop.
