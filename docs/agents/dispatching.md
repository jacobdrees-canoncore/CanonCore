# Dispatching

What only this project knows about dispatching, read by the `dispatch` skill before it computes a
frontier or creates a worktree.

## The ceiling

**One spec at a time** (the Owner, 8 Oct 2026). The Design references specs are built in order: the
folder component (CC-37), the web prototype (CC-38), Brink's look (CC-33), the untitled app replica
(CC-36), then the Apple prototype (CC-39). Each finishes, its audit at its clean round, before the
next one's first ticket starts, and the board enforces it: each audit ticket blocks the next spec's
first ticket (CC-140 blocks CC-193, CC-206 blocks CC-207, CC-217 blocks CC-218, CC-242 blocks CC-39).
Inside the current spec, every unblocked ticket runs in parallel within the ceiling below. Main plans
the next spec alongside the current build (its fixes, check rounds and `/to-tickets`), starting with
the Apple prototype.

There is no fixed number of agents. The ceiling is whatever actually contends on the Owner's Mac, and
on Main's review:

- **One Chrome lane.** One agent at a time drives Chrome, whichever repository it works in.
  Captures, walks and comparisons are the memory load and are timing-sensitive, so a second would slow
  and destabilise both.
- **One recording lane.** One agent at a time records on this Mac: motion or screen captures, of
  the phone or of the Mac. Every recording joins this lane, the later folder tickets (CC-57 and
  CC-60) included; the iPad trace on hardware, CC-190, was canceled 8 Oct 2026 (the Owner has no
  iPad, and the Mac trace stands in). Since the spec order above, the lane holds only the current
  spec's recordings, so the phone passes from Brink's look to the untitled app replica by the spec
  edges; inside the replica the Mac's recordings come before the iPhone's. Dispatch hands the lane on
  as it hands on the Chrome lane (the Owner, 6 Oct 2026; order superseded 8 Oct 2026).
- **Browserless agents beside it.** Work that opens no browser and records nothing (the current
  spec's other tickets, the skills repository, prototype-snapshot, CanonCore's records, tracker-only
  tickets) may run alongside while
  `room.sh` allows it and no other open branch or pull request in that repository touches the files
  the ticket names.
- **The review cap.** No new dispatch while about 3 PRs wait on Main's review: an agent started then
  only lengthens the queue (the Owner, 3 Oct 2026).

Before each dispatch, run dispatch's `room.sh`, which refuses on memory, swap, load and the review
cap (its thresholds are the Owner's, in the script), and say which readings allowed it. Then start the agent with
`launch.sh`, never a raw `orca terminal create ... claude`: it holds a lock and refuses a worktree
where a Claude tab already stands, and this repository's hook refuses the raw form. `monitor.sh`'s
`ROOM` line counts only this repository's worktrees, so count the siblings' running agents yourself.

After every merge, look across every lane and the free spikes for anything that now fits, not only
the next ticket in the merged one's lane, and start what does: the Owner asked for this on 2 Oct 2026.
In Design references that means the current spec's tickets only; a later spec's ticket, browserless
or not, waits for its spec's turn (8 Oct 2026).

Every agent runs locally, on the Owner's Mac; none runs in a cloud session.

CanonCore has no test suite yet. When the first project adds one, measure its database connections
per run and add that limit here.

## Standing decisions

- **Free tools are pre-approved.** An agent installs a free tool its ticket needs (Appium and its
  drivers, ipatool and the like) without asking. Spending money still needs the Owner's yes (the
  Owner, 6 Oct 2026).

## Where a merged slice lands

CanonCore lands each ticket on `main` by its own pull request. Main merges it with
`gh pr merge <n> --auto --squash` once the review is done, and GitHub merges when the required checks
pass. The `Standing decisions` check fails a PR that changes `## Standing decisions` in this file
unless Main labelled it `standing-decisions` at its current head; after a later push, Main reads
the push and adds the label again.

The private sibling repositories have no required checks, so they merge through dispatch's
`merge-if-green.sh`, which gates on the head commit's checks and on a change to the repository's own
`## Standing decisions`; `--merge` makes a merge commit where the repository needs one
(prototype-snapshot, and untitled-replica's integrate-to-main PR). Each says how it lands in its own `docs/agents/`.
