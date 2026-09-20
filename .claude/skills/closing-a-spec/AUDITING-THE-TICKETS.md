# Auditing the tickets

Step 2 of `closing-a-spec`: how to get the board and the commits in front of the agents before any
of them starts. Getting this wrong is what makes twelve agents hunt the same twelve tickets, or
makes a whole spec read as having none.

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

**FETCH EVERY REPO BEFORE YOU MAP ANYTHING.** A sibling checkout behind `origin` makes a true record
look false: `provider-tmdb` was 8 commits behind on 2026-09-20, and read as checked out it held none
of the `containers` assertions ADR-0033 claims, so an auditor nearly filed that record as wrong. It
checked `origin/main` instead and found both. `git fetch` in all three, then compare
`main..origin/main` and say what you found.

**MAP EVERY TICKET TO ITS COMMIT YOURSELF, BEFORE ANY AGENT STARTS.** `git log --grep "CNCORE-<n>:"`
over `main` matched 68 of 80 on the first run. Without the map, twelve agents hunt the same twelve
tickets and some report provider work as missing.

**A TICKET WITH NO COMMIT ON `main` IS NOT UNMET.** The twelve split three ways, and only the last is
a finding:

- **It landed in a provider repo.** Six did. Grep `provider-wiki` and `provider-tmdb` too.
- **It was FOLDED into another ticket's commit**, which carries the receiving ticket's number in its
  subject and the folded one in its body. Five were. `--grep "CNCORE-<n>"` without the colon finds them.
- **It is nowhere, in any repo.** One was: CNCORE-205.

**THEN CHECK THE CODE, NOT THE LOG.** CNCORE-205 read `Done` and nothing had fixed it. `apiParams`
still spread `params` last, exactly as the ticket described. The log cannot tell you that; only the
code can.

**"CLOSED BY MENTION" IS A WHOLE CLASS, AND THE TRACKER DOES IT SILENTLY.** A PR body that NAMES a
ticket closes it through the integration, whether or not the PR touched it. CanonCore#135 wrote
"filed rather than fixed, CNCORE-205" and the integration closed it two seconds after the merge. So
the habit of citing a ticket you are deliberately NOT fixing is the thing that marks it done. Look for
`Done` tickets whose only trace is a mention in someone else's PR body.

**AND LOOK IN THE PROVIDER REPOS' `CLAUDE.md`.** An agent DID catch CNCORE-205 at the time and wrote
it down — in `provider-wiki`'s `CLAUDE.md`, where this board cannot see it. It was right not to change
another ticket's status itself; the flag just landed somewhere the tracker never reads.
