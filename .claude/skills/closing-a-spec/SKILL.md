---
name: closing-a-spec
description: "Closes a finished spec by checking three things the board cannot: that the Owner's instance runs what was built, that each acceptance criterion was met rather than marked met, and that the records the spec touched still say what is true. Files tickets for what is wrong and nothing when nothing is. Use when a spec's last ticket merges, or when asked to audit, retro or close a spec or Linear project."
---

A spec reads `Done` when its tickets do. That is not the same as being done.

**THE OUTPUT IS TICKETS, OR NOTHING.** ADR-0132 says it and every first-party source on
retrospectives agrees: Google's SRE Workbook gives the failure mode as cause and effect -- "without a
formal tracking process, action items from postmortems are often forgotten" -- and Scrum puts
improvements in the backlog, not a report. A gate whose output is a document is a document phase,
which `CLAUDE.md` refuses on sight. Write no summary file. File what is wrong, in the tracker, with
the four flags.

## 1. Does the Owner's instance run it?

**This is the check that catches the most and is skipped the most.** ADR-0132 exists because two
projects and a headline ticket closed green while their own sentences were false. On 2026-09-20
CNCORE-159 read `Done` while the install ran a five-day-old image whose database stopped three rungs
short: no Groups, no letter jump, none of it.

Compare the running install against `main`, not against the board:

```sh
docker exec <db> psql -U canoncore -d canoncore -Atc \
  "select count(*) from drizzle.__drizzle_migrations"     # against ls packages/db/src/migrations/*.sql
docker inspect <app> --format '{{.Created}}'              # against main's newest merge
```

**BOTH CHECKS, BECAUSE EITHER ONE ALONE READS CLEAN.** A ticket carrying no migration moves the image
and not the ladder, so the rungs agree while the app is old. On 2026-09-20 the second run of this gate
read 22 rungs against 22 files and the image was ten minutes older than CNCORE-239's merge, which had
shipped two `apps/web` files and no SQL. The ladder is not a proxy for the build.

Behind on either → the spec is not closed. Update it, then walk it.

**WALK IT LOGGED IN, AND WALK A BLANK INSTANCE BESIDE IT.** Logged out is a different product: five
of eleven routes render only a refusal. A filled install cannot show the first-run journey, and an
import is only honestly tested from zero. The Owner's install is never reset.

**ENUMERATE THE SURFACES, THEN THINK THE CASE SPACE WITH THE `sequentialthinking` TOOL.** Clicking
around finds what a page volunteers; the taxonomy finds what it hides. It is the difference between
five cases and fifteen, and it is what found CNCORE-242.

**AND EXERCISE EACH FEATURE ONCE, END TO END.** An empty feature and a broken one are identical from
the outside. Both of the Owner's complaints on 2026-09-20 were empty stores behind correct features,
and one row each told them apart.

Read [WALKING-THE-INSTALL.md](WALKING-THE-INSTALL.md) for the route enumeration, the eight-class case
taxonomy, the two-instance rule and the compose project-name hazard that can take the catalogue down.

## 2. Did every ticket in the project land what it said?

Read the project, not the tickets you remember. CNCORE-159's ran to 80.

**GET THE BOARD AND THE COMMIT MAP IN FRONT OF THE AGENTS BEFORE ANY OF THEM STARTS.** One board
fetch, every repo fetched from `origin`, and every ticket mapped to its commit by you. Without the map,
twelve agents hunt the same twelve tickets and some report provider work as missing.

**A TICKET WITH NO COMMIT ON `main` IS NOT UNMET.** It landed in a provider repo, or was FOLDED into
another ticket's commit, or is nowhere at all -- and only the third is a finding. Then check the CODE,
not the log: CNCORE-205 read `Done` with nothing fixed and the log could not say so.

Read [AUDITING-THE-TICKETS.md](AUDITING-THE-TICKETS.md) for the board fetch and the `--limit` trap, the
fixed point, the mapping commands, the three classes, "closed by mention", and why the provider repos'
own `CLAUDE.md` is worth grepping.

Then one agent per handful of tickets, each ruling every criterion MET, DEVIATION-STATED,
SILENTLY-UNMET or CANNOT-TELL. **Only the last two reach you.** A criterion marked `[~]` with a stated
reason is closed; one silently unmet is a ticket.

Two shapes to look for, both seen on 2026-09-20: a criterion whose **premise** was false (CNCORE-187's
assumed a search carries a container; no provider sends one), and a test that **passed with the
feature deleted** (CNCORE-174's step-back, because stepping back from page 2 reaches the start anyway).

**AND ASK EACH AGENT FOR WHAT IT FOUND BESIDE THE CRITERIA, BECAUSE THAT IS WHERE THE YIELD IS.** The
second run put 79 tickets through ten auditors and every acceptance criterion was MET or
DEVIATION-STATED -- **zero unmet, across roughly 230 of them.** Four of the eight tickets it filed came
from things agents noticed while reading and reported as "not a criterion verdict, but worth your
attention", including the run's only code defect (CNCORE-249: a provider's own string interpolated
into a refusal unbounded, where the rule forbidding it is stated two files away and `shortly` is
already imported).

So the brief asks for both, and keeps them apart: a criterion verdict, and anything true and checkable
found on the way. **A pass that reports only criteria will report nothing on a healthy spec**, which
reads as the gate working when it is the gate looking in one place.

## 3. Do the records say what is now true?

`docs/adr/` is the authority, so a record the spec falsified is worse than no record. Three tests
already police the corpus's form -- `adr-numbering`, `corpus-figures`, `doc-line-citations` -- so
check MEANING, which none of them can.

**COUNT the statuses; never quote them.** That line has been wrong three times, most recently in the
brief that commissioned `docs/research/post-spec-retro-practice.md`.

Two greps surface candidates. **Both are triggers to read, not verdicts**: run them, then open what
they name.

```sh
grep -l "^status: proposed" docs/adr/*.md          # decided, not yet built -- THIS repo's meaning
grep -rl "ADR-0NNN" --include="*.ts" . | grep -v docs/   # is anything reading it?
```

A `proposed` record cited from source is being leaned on before it is built. One cited nowhere may be
honest: on 2026-09-20, 27 of 67 sat in genuinely unbuilt product, so a pass reporting all 67 as stale
would have been wrong 27 times. An `accepted` record cited nowhere is the sharper smell, and even
that has a legitimate shape: ADR-0101's mechanism is the `catalog:` convention itself, which needs no
comment naming it.

## 4. Expect to be wrong, and check before you file

This gate throws false positives, and two arrived inside ten minutes on its first run:

- **A fifth Linear project** that `CLAUDE.md`'s "four projects" does not list. It holds one Canceled
  issue and `CLAUDE.md` accounts for it by that ticket's number. Read the record before calling a
  discrepancy one.
- **A CLI defect** that was the throttle above. Three repeat runs killed it.

So: **retry a tracker read before believing it, and read the record before believing a grep.** File
only what survives that. A gate that files noise is worse than one nobody runs, because the noise
looks like work.

**AND IN THE PRODUCT, THE REASONING IS BESIDE THE CODE.** Six suspected defects were put up on
2026-09-20 and all six were deliberate, with the answer inside twenty lines of the thing that looked
wrong:

| Looked like | Actually |
| --- | --- |
| `/` says 8,052, `/works` says 8,026 | ADR-0077's predicate; the database returns exactly 26 Containers holding no work |
| A picker offering 100 of 8,052 | says so on the page, which is ADR-0119's own rule being kept |
| `?kind=nonsense` echoed back | goes through `<TheirWords>`, React-escaped |
| A letter interpolated into a sentence | only when it is in `THE_ALPHABET`, reasoned in a comment beside it |
| A 2,907-member container would struggle | paginates at 100, loads in ~2.3s |
| A Groups form wrote nothing | the automation had not submitted it |

**SO GREP FOR THE REASONING BEFORE FILING, AND SEARCH THE ADRs FOR THE SURFACE'S NAME.** In a repo
that writes its reasons in place, a suspected defect is usually a decision you have not read yet. Two
of the six survive as findings only because the reasoning was absent rather than disagreed with.

**AND SEPARATE A DATA GAP FROM A DEFECT BEFORE IT REACHES A TICKET.** Both of the Owner's own
complaints were empty stores behind correct features. A ticket that says a feature is broken when the
feature is starved sends an agent to fix working code.

## 5. Is the same fault filed three times?

Count root causes, not tickets. `/import`'s prefetch trap produced CNCORE-210, 238 and 240 -- three
passes, one cause, no record saying an address that spends a Provider call must not be a `<Link>`.
**Three tickets on one cause is a rule written three times instead of once.** Checked on the first
run: the fact that Next prefetches a `<Link>`'s address appears in ADR-0046, ADR-0149 AND ADR-0151,
once per incident, and 14 `<Link>`s on that page have never been swept against it. That is the same
duplication CNCORE-234 removed from code, left standing in the records.

Propose the single record, and prefer a check over a rule where one is possible: a mechanical fault
gets a test, and `adr-numbering.test.ts` is the local shape for it -- it asks the tree rather than a
list somebody maintains.

**THEN MEASURE THE RULE, BECAUSE ONE STATED THREE TIMES IS ONE NOBODY MEASURED ONCE.** A claim gets
restated rather than checked precisely when it sounds obvious, and each restatement makes the next
reader likelier to inherit it than test it. So the third sighting is the signal to go and measure.

The second run did, and the rule was FALSE. ADR-0046, ADR-0149 and ADR-0151 all rest on two claims:
that Next prefetches a `<Link>`'s address, and that the prefetch therefore spends the Provider call.
The first is true -- 12 RSC requests on one scroll. The second is not: a prefetch of
`/import?q=Cyberman` returns **298 bytes in 6 ms** where the real render is **27,803 bytes in 152 ms**,
and a page carrying 100 Provider-spending links prefetched 10,213 bytes in total. **Prefetching an
ADDRESS is not rendering the PAGE**, and these are dynamic routes, so the fan-out the three records
refuse does not occur. ADR-0151 had verified the prefetch HAPPENS against Next's own docs; the cost
was inferred from it and never put to a running instance.

Read the claim as TWO claims, because that is how one true half carries one false half for three
records and three tickets. And the ticket had said so itself -- CNCORE-240's body reads "NOT MEASURED
against a running instance ... so that ticket measures it before it changes anything". **A ticket
admitting its own premise is unmeasured is the cheapest finding on the board**; grep the tracker and
the records for that admission before doing anything harder.

Then say which way the correction runs. Here the mechanism stays (a `<Form>` is still right for a
control that acts) and only the stated cost goes, so the ticket carries the wrong reactions it must
rule out. A measurement that refutes a reason is not a licence to undo the thing the reason defended.

## What this is not

`retro` in `mattpocock/skills` retrospects the **agent's environment** after a session -- steering
files, guardrails, tool economy. Different subject, and worth running too. This one audits a body of
work against what it promised.

Grounding, with sources: `docs/research/post-spec-retro-practice.md`.
