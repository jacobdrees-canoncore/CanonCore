# Dispatching

What only this project knows about dispatching, read by the `dispatch` skill before it computes a
frontier or creates a worktree.

## The ceiling

There is no fixed number of agents. The ceiling is whatever actually contends on the Owner's Mac:

- **One Chrome lane.** One untitled-replica agent at a time drives Chrome. The replica's captures
  and comparisons are the memory load and are timing-sensitive, so a second would slow and destabilise
  both.
- **Browserless agents beside it.** Work that opens no browser (the skills repository,
  prototype-snapshot, CanonCore's records, tracker-only tickets) may run alongside, beyond three, while
  memory is about 45% free or more, swap is not near full, and no other open branch or pull request in
  that repository touches the files the ticket names.

Before each dispatch, check `memory_pressure`, `sysctl vm.swapusage` and the target repository's open
pull requests and worktrees, and say which check allowed it. `monitor.sh`'s `ROOM` line counts only
this repository's worktrees and cannot see the sibling repositories, so count running agents yourself.

The Owner set this on 2 Oct 2026, when four agents (one replica, three browserless) ran with memory
about 50% free. The earlier codebase's ceiling came from Postgres connections in its end-to-end suite;
CanonCore has no test suite yet. When the first project adds one, measure its connections per run and
add that limit here.

## Where a merged slice lands

CanonCore lands each ticket on `main` by its own pull request. The sibling repositories each say how
they land in their own `docs/agents/`.
