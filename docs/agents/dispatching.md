# Dispatching

What only this project knows about dispatching, read by the `dispatch` skill before it computes a
frontier or creates a worktree.

## The ceiling

There is no fixed number of agents. The ceiling is whatever actually contends on the Owner's Mac, and
on Main's review:

- **One Chrome lane.** One untitled-replica agent at a time drives Chrome. The replica's captures
  and comparisons are the memory load and are timing-sensitive, so a second would slow and destabilise
  both.
- **One recording lane.** One agent at a time records on this Mac: motion or screen captures, of
  the phone or of the Mac. Every recording joins this lane, the later folder tickets (CC-57, CC-60,
  CC-190) included. The iPhone is one resource inside it, so its sessions are also ordered by
  blocked-by edges: the Brink look (CC-33), then the untitled app replica's iPhone recording tickets
  (CC-36). The order on 6 Oct 2026 is the SwiftUI folder (CC-54), the folder's web gallery (CC-50),
  the Brink look (CC-33), then untitled's Mac app and then its iPhone app (CC-36), with the later
  folder tickets taking their turn. Dispatch hands the lane on as it hands on the Chrome lane (the
  Owner, 6 Oct 2026).
- **Browserless agents beside it.** Work that opens no browser and records nothing (the skills
  repository, prototype-snapshot, CanonCore's records, tracker-only tickets) may run alongside while
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
