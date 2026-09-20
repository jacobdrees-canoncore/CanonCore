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

Behind on either → the spec is not closed. Update it, walk the spec's own headline claims against the
real catalogue, and only then read the rest of this.

## 2. Did every ticket in the project land what it said?

Read the project, not the tickets you remember. CNCORE-159's ran to 80.

**FETCH THE BOARD ONCE, YOURSELF, AND HAND IT TO THE AGENTS AS TEXT.** One call carries every
description, so nothing else needs the tracker:

```sh
orca linear list-issues --team CNCORE --json > /tmp/board.json   # NO --limit
```

**`--limit` IS THE TRAP.** Under a burst of calls it answers `ok: true` with zero rows, which is
indistinguishable from an empty board -- measured 2026-09-20, seven rapid calls, every one empty while
the no-limit call returned 241. An agent that hits that concludes the spec has no tickets. The same
lie is why `monitor.sh` carries a `LINEAR-BLIND` guard.

The fixed point to diff against is the parent of the spec's first merge:

```sh
git log --format=%H --reverse --grep="CNCORE-<first>" | head -1   # then ^
```

Then one agent per handful of tickets, each ruling every criterion MET, DEVIATION-STATED,
SILENTLY-UNMET or CANNOT-TELL. **Only the last two reach you.** A criterion marked `[~]` with a stated
reason is closed; one silently unmet is a ticket.

Two shapes to look for, both seen on 2026-09-20: a criterion whose **premise** was false (CNCORE-187's
assumed a search carries a container; no provider sends one), and a test that **passed with the
feature deleted** (CNCORE-174's step-back, because stepping back from page 2 reaches the start anyway).

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

## What this is not

`retro` in `mattpocock/skills` retrospects the **agent's environment** after a session -- steering
files, guardrails, tool economy. Different subject, and worth running too. This one audits a body of
work against what it promised.

Grounding, with sources: `docs/research/post-spec-retro-practice.md`.
