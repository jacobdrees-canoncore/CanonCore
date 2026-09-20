---
status: accepted
---

# A project is not finished until it has been used on the Owner's own instance

> **ACCEPTED 2026-09-20, whole, in one repository.** The mechanism is
> `.claude/skills/closing-a-spec/SKILL.md`. It opens on this record's own output rule -- the output
> is tickets, or nothing -- and makes "Does the Owner's instance run it?" its step 1, with two
> concrete commands that compare the RUNNING install against `main` rather than against the board:
> the rungs its database has applied, and the age of its image. It says why both are needed, which
> is that either alone reads clean. The local-only checks this record argues for exist and are
> reachable by nothing but a person at the install -- `packages/api/corpus/corpus-stands.test.ts`,
> `packages/api/src/corpus-census.ts`, `packages/api/vitest.corpus.config.ts` and
> `apps/web/live/live-import.test.ts` -- and `CLAUDE.md` names the skill as the gate.
>
> **THE STATUS ALTERNATIVE WAS WEIGHED AND REFUSED** -- a different one from the habit-versus-gate
> choice below, and the one a reviewer of this flip reaches for first:
> hold this `proposed` until a project has been CLOSED through the gate rather than merely checked
> by it. That applies the GATE-MET test, and `CLAUDE.md` says in as many words that `accepted` means
> a record's MECHANISM is whole, "never merely that its own gate was met". A record whose mechanism
> IS a gate would be the only record that could never reach `accepted` under its own rule. Ruled by
> the DISPATCHER on 2026-09-20, under CNCORE-248.

A project ends when the Owner has pulled it onto their own running CanonCore and looked at it. Not
when its tickets read Done, not when CI is green, not when a tag ships. Those are necessary and none
of them has ever been sufficient.

**THIS IS A GATE WITH TEETH, AND THE ALTERNATIVE WAS CONSIDERED AND REFUSED.** A habit — look when
you remember to — costs nothing and enforces nothing, which is the same property that makes it stop
happening around the point it starts mattering. A gate can stall a project: if the instance is
broken, or the corpus is stale, or the credential has lapsed, the project sits open until that is
dealt with. That is the cost and it is the mechanism. A gate that cannot stall anything is a habit
wearing a rule's clothes.

## Why: two projects and a headline ticket closed green while their own sentences were untrue

Measured 2026-09-13, against the tracker and the repository together.

- **[[0115-the-public-release-comes-before-the-playback-half]]** inserted "a CanonCore that somebody
  else can install, navigate and curate". Both tags shipped and CNCORE-60 closed with 60 tickets
  Done. An installed instance has no route to a Provider running BESIDE it — `compose.yaml` ships two
  services, no provider among them, and no `networks:`, `extra_hosts:` or `host-gateway` anywhere in
  this repository, so no container hostname resolves and no host address is mapped. Outbound to a
  public URL works; both of this project's Providers are private (ADR-0089), so there is none to
  point at. It can be installed. It cannot be curated from a source it can reach.
- **CNCORE-96** says "the Owner points CanonCore at their own wiki Provider, browses a timeline, and
  gets a real catalogue. Then the archive and the extraction pipeline are deleted." Tickets 98 to 103
  all read Done. The import landed in `buildTestDatabase("web")`, which the next run drops, so no
  catalogue persists anywhere and the Owner has never had one. The two halves also ran in reverse:
  the archive was deleted on proof that an import CAN happen, which was the right gate for CNCORE-103
  and is honestly met by its own criteria, but the half that was supposed to come first never landed.
  **THIS ONE IS CLOSED SINCE 2026-09-15** (CNCORE-167, ADR-0137): the Owner's install holds all 465
  Orderings and 8,052 Items in a named volume, proved to survive a restart and a rename of its
  directory. The sentence above stays as written because it is what was measured on 2026-09-13 and
  it is the evidence this record rests on; what has changed is that it is no longer true today.
- **CNCORE-65** shipped "a real front page". At the size the catalogue is designed for it renders 100
  rows, one `Next` link and no way to reach the 2,913rd Row of the largest Ordering but to press it 29
  times. This one is a TICKET rather than a project, and it is here because the failure takes the same
  shape at both sizes.

Two projects and one headline ticket, three stated outcomes, none of them true — and every ticket
under the two projects honestly met its own acceptance criteria. **Those tickets were not wrong.
Nothing was checking the sentence above them.** CNCORE-65 is the instructive exception: its sentence
WAS the headline, so there was nothing above it to do the checking either.

**THE REPOSITORY ALREADY KNEW THE SHAPE OF THIS ONE LEVEL DOWN.** `CLAUDE.md`'s tracker section says
"a parent issue carries a state of its own that lies about its children — CNCORE-60 read
`Done` over thirteen open ones". Parent links were dropped on 2026-09-12 for exactly that reason.
This record is the same failure one level up, where there is no link to drop: a PROJECT's tickets all
read Done while the project's own sentence is false.

## What the gate catches that a green suite cannot

`apps/web/live/live-import.test.ts` states the general case in its own header: before it existed,
"every check that was green was a check of the harness against itself." The e2e suite's provider is
a stub; CI's "against the real provider" job ran against that stub for want of a declared variable
until CNCORE-143, whose fix was to drive the real `provider-tmdb` and drop the wiki image from the
job altogether, since no CI job may hold its Credential (ADR-0122); and the wiki provider's own suite
reads a committed fixture. So the wiki path is still checked only against itself.

That file closed the gap for one operation, and `packages/api/corpus/corpus-stands.test.ts` has
since closed it for the CATALOGUE -- it counts what an installed instance actually holds, through
the same procedures a reader's browser calls (ADR-0137). Both are local-only for the same reason and
neither is reachable by CI. The gate closes the rest: a running instance the Owner actually opens is
the only check in this repository that is not the repository checking itself.

## What it costs, and what it does not require

**Pulling is cheap and deliberately so.** `ci.yml` publishes `latest` at the head of `main`, so
taking a project onto the Owner's instance is `docker compose pull && docker compose up -d`. No tag,
no release, no ceremony. If the gate were expensive it would be negotiated away.

**It does not require the instance to be public, hosted, or reachable from anywhere.** It is
[[0094-a-fresh-install-starts-empty]]'s third category — an install — running wherever the Owner
runs it. No record here decides where that is.

**It does not require a written report.** The output of the gate is tickets when something is wrong
and nothing when nothing is. A gate whose output is a document is a document phase, which
`CLAUDE.md` refuses on sight.

## The category does this, and calls it a deployment ring

Microsoft's current safe-deployment guidance is the closest first-party precedent, and it is a gate
rather than a habit: Defender for Endpoint "ships updates externally ONLY AFTER all the certification
and validation tests are completed across multiple iterations of internal devices", and "the first
stabilization ring targets Microsoft's hundreds of thousands of employees and millions of internal
devices" (`learn.microsoft.com`, updated 2026-03-22). Their tier model names what it is for in the
same words this record does — tier 0 "finds most of the user-impacting bugs introduced by the
deployment" — and adds a bake time, "a 24-hour day should be enough time for most scenarios to expose
latent bugs", which must include a peak-usage period.

**GOOGLE IS THE WEAKER CITATION AND IS NOT USED HERE.** Its testing blog (2014-01-03) describes
dogfooding as "an important part of our test process" that feeds bugs back into coverage, and never
as a blocking gate. It supports the value and not the teeth.

## What would falsify this

A project that passes the gate and still ships an untrue sentence. That would mean the Owner can
look at the product and not see what is wrong with it, and the answer would be a harder question
than a gate — what the Owner is failing to notice, and what would make it visible.

## As built, under CNCORE-159 -- and the record was the last thing to hear about it

**THE MECHANISM SHIPPED AND THIS RECORD WAS NOT TOUCHED**, which left it reading as an argument FOR
a gate that already existed. That is the defect CNCORE-248 was raised on, and it is this record's
own failure mode one level down: something was built, everything depending on it went on reading a
document that said it had not been.

The gate has been RUN, and it did what this record says a gate does rather than what a habit does.
Its first pass over CNCORE-159 stalled the project instead of noting a concern: the install was
found running a stale image over a database short of `main`'s ladder, and the spec did not close.
Its second pass caught the case the two commands exist to separate -- the ladder agreeing while the
image was older than the newest merge, because a ticket carrying no migration moves one and not the
other. Both catches are written into the skill with their dates.

**AND ITS OUTPUT WAS TICKETS.** This record's own rule -- "the output of the gate is tickets when
something is wrong and nothing when nothing is" -- held on the first run that could have broken it:
that pass filed corrections rather than a report, and CNCORE-248 is one of them. A gate whose output
is a document is a document phase, and this one did not become that when it had the chance.

**WHAT IS DELIBERATELY NOT CLAIMED**, so no half reads as finished: no project has yet been CLOSED
through this gate end to end. CNCORE-159 is the first to reach it and is still open on the
corrections the gate produced. The mechanism is whole; the first full passage through it is owed,
and that is a fact about this project's progress rather than about this record's status.

## Evidence

The two projects and the ticket above, read from Linear and the repository on 2026-09-13. The census behind them
is in this conversation's own working rather than a file: eleven agents over the routes, the API, the
schema, the ADRs, the tracker, the deferrals, the research, the glossary, the tests, both provider
repos and the measured limits.
