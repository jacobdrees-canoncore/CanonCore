#!/usr/bin/env bash
# The dispatcher's wake-up. Emits one line per CHANGE, never a heartbeat.
#
#   ROOM <n>                             n CanonCore slots free of the four
#   IDLE <worktree>                      an agent has gone quiet: parked, done or dead
#   GONE <worktree>                      a worktree with no agent at all
#   PARKED <repo> <branch>               a main checkout off main: an agent worked in it
#   UNBOUND <repo>/<worktree>            a worktree with no Linear binding to brief its agent
#   UNBOUND-BLIND                        the worktree listing could not be trusted this pass
#   READY <repo> #<n> <state> <branch>   a PR left draft and wants reading
#   TICKET <id> <state> <title>          a ticket changed state
#   DRIFT-BEHIND <id>                    Todo, but a worktree or PR exists for it
#   DRIFT-STALE <id> <state>             In Progress/In Review with neither
#   DRIFT-FILING <id> ...                Backlog state, or no assignee, or no label
#
# Run under the Monitor tool with persistent: true. SCRATCH must be set and hold
# folded.txt: one "<folded-ticket> <receiving-ticket>" per line, so a ticket
# being done inside another ticket's branch still counts as active. Nothing in
# the repo knows about a fold, so this file is the dispatcher's own bookkeeping
# and a missing line reads as DRIFT-STALE -- which is the safe way to be wrong.
set -uo pipefail
: "${SCRATCH:?set SCRATCH to a writable directory}"
touch "$SCRATCH/folded.txt" "$SCRATCH/prev.txt"
REPOS=${REPOS:-"CanonCore provider-wiki provider-tmdb"}

while true; do
  {
    # ROOM IS THE CEILING, COUNTED RATHER THAN REMEMBERED. Four is a CANONCORE
    # count (CNCORE-137), so provider worktrees are not in it. The dispatcher was
    # hand-counting worktrees every pass and a freed slot waited on it noticing.
    canoncore=$(ls -1d "$HOME"/orca/workspaces/CanonCore/*/ 2>/dev/null | grep -vc trash || true)
    room=$(( 4 - ${canoncore:-0} ))
    [ "$room" -gt 0 ] && echo "ROOM $room"

    # A MAIN CHECKOUT IS NOBODY'S WORKTREE (ADR-0192). A cross-repo ticket's
    # provider half gets a worktree of its own, so a main checkout off `main` is
    # one an agent parked: CNCORE-261 left both providers' on its branch after
    # merging, and CNCORE-262 found one there and stopped to ask. A checkout this
    # cannot read is named too, because silence here has to mean "on main".
    for r in $REPOS; do
      b=$(git -C "$HOME/orca/projects/$r" branch --show-current 2>/dev/null) || b=unreadable
      [ "$b" = main ] || echo "PARKED $r ${b:-detached}"
    done

    # AN AGENT THAT HAS GONE QUIET IS PARKED, FINISHED OR DEAD, and a full slot
    # count cannot tell any of the three from working. A spinner keeps
    # `lastOutputAt` fresh, so silence is the signal; which of the three it is
    # costs one `terminal read`. Three of four agents sat on their own
    # AskUserQuestion prompts while the count read full.
    orca terminal list --json 2>/dev/null | python3 -c '
import json, sys, time
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit()
for t in (d.get("result") or {}).get("terminals") or d.get("terminals") or []:
    path = t.get("worktreePath") or ""
    if "/workspaces/CanonCore/" not in path or t.get("agentIdentity") != "claude":
        continue
    last = t.get("lastOutputAt")
    if not last:
        continue
    if time.time() - last / 1000 > 90:
        print("IDLE", path.rstrip("/").split("/")[-1])
' 2>/dev/null || true

    # A WORKTREE WITH NO AGENT IS INVISIBLE TO IDLE, which only reads terminals
    # that exist. A session restart on 2026-09-19 killed two agents at once and
    # left their worktrees standing with commits on local disk and nothing
    # pushed; their PRs read +0, which is what an abandoned worktree looks like.
    # Removing one then would have destroyed the work.
    orca terminal list --json 2>/dev/null | python3 -c '
import json, sys, os, glob
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit()
held = {(t.get("worktreePath") or "").rstrip("/")
        for t in (d.get("result") or {}).get("terminals") or d.get("terminals") or []
        if t.get("agentIdentity") == "claude"}
for w in sorted(glob.glob(os.path.expanduser("~/orca/workspaces/CanonCore/*/"))):
    w = w.rstrip("/")
    if "trash" not in w and w not in held:
        print("GONE", w.split("/")[-1])
' 2>/dev/null || true

    # A WORKTREE WITH NO BINDING CANNOT BRIEF ITS OWN AGENT. Dispatch sends
    # `--prompt "/implement"` and nothing more, so the binding carries the whole
    # ticket; without it the agent wakes up with no idea what to build. The
    # create call answers `ok: true` either way, which is why this is read here
    # rather than trusted there (ADR-0162).
    #
    # IT READS `linkedLinearIssue`, NOT `linkedIssue`. The second is the GITHUB
    # issue number and is null on every CanonCore worktree because this repo does
    # not use GitHub Issues, so it can show a Linear binding neither present nor
    # absent. Reading it is how the 2026-09-20 wave declared five worktrees
    # unbound on evidence that could not say either way -- the same misread as a
    # 2026-09-13 note about `set --linear-issue`, seven days apart.
    #
    # EMITTING ON AN ABSENCE ONLY FAILS SAFE IF ABSENCE IS DISTINGUISHABLE FROM
    # NOT HAVING LOOKED, which is the trap the drift lines below set `blind` for.
    # A listing that did not parse, or that came back short, would otherwise read
    # as every worktree bound -- the exact false all-clear this block exists to
    # remove. `orca worktree list` is paged and says so in `truncated`, so a
    # short read emits UNBOUND-BLIND rather than silence, and silence keeps its
    # one meaning: every worktree was seen, and every one is bound.
    #
    # EVERY REPO IN `REPOS`, NOT CANONCORE ALONE (ADR-0192). A cross-repo ticket's
    # provider half has a worktree of its own, and the dispatcher created
    # `cncore-264-tmdb` without `--linear-issue` on 2026-09-21 while this read one
    # repo and could not say so. The repo is in the name because a provider
    # worktree is named `cncore-<n>` exactly as its CanonCore twin is.
    orca worktree list --json 2>/dev/null | REPOS="$REPOS" python3 -c '
import json, os, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print("UNBOUND-BLIND")
    sys.exit()
# BOTH SHAPES, as the IDLE and GONE blocks above accept: a runtime that drops the
# `result` envelope would otherwise silence this check rather than trip it.
r = d.get("result") or d
if not isinstance(r, dict) or "worktrees" not in r:
    print("UNBOUND-BLIND")
    sys.exit()
if r.get("truncated"):
    print("UNBOUND-BLIND")
repos = os.environ["REPOS"].split()
for w in r.get("worktrees") or []:
    path = (w.get("path") or "").rstrip("/")
    parts = path.split("/")
    if len(parts) < 3 or parts[-3] != "workspaces" or parts[-2] not in repos:
        continue
    if "trash" in path or w.get("isArchived"):
        continue
    if not w.get("linkedLinearIssue"):
        # NAME SPLIT OFF THE PATH, and any newline in it dropped: this is a line
        # protocol read by `comm` and `grep -qx`, so a name carrying a newline
        # would inject whole lines the dispatcher reads as fact.
        print("UNBOUND", "/".join(parts[-2:]).replace("\n", " "))
' 2>/dev/null || true

    for r in $REPOS; do
      gh pr list --repo "jacobdrees-canoncore/$r" --json number,isDraft,mergeStateStatus,headRefName \
        --jq ".[] | select(.isDraft==false) | \"READY $r #\(.number) \(.mergeStateStatus) \(.headRefName|split(\"/\")|last)\"" 2>/dev/null || true
    done

    # Ticket numbers with real work: any open PR branch, plus any live worktree.
    #
    # A FAILED QUERY IS NOT AN EMPTY BOARD. `|| true` used to swallow a `gh`
    # error into zero branches, so during GitHub's outage on 2026-09-13 every
    # ticket whose only evidence was its PR read DRIFT-STALE -- CNCORE-132 did,
    # with #68 open the whole time. Drift is only honest when the listing
    # succeeded, so a failure sets `blind` and the Python skips both drift lines
    # rather than reporting the absence it cannot distinguish from silence.
    blind=""
    for r in $REPOS; do
      gh pr list --repo "jacobdrees-canoncore/$r" --json headRefName --jq '.[].headRefName' 2>/dev/null \
        || blind=1
    done > "$SCRATCH/branches.txt"
    { cat "$SCRATCH/branches.txt"
      ls -1d "$HOME"/orca/workspaces/*/* 2>/dev/null | grep -v trash || true
    } | grep -oE 'cncore-[0-9]+' | grep -oE '[0-9]+' | sort -u > "$SCRATCH/active.txt" || true
    export BLIND="$blind"

    orca linear list-issues --team CNCORE --json 2>/dev/null | python3 -c '
import json, sys, os, pathlib
s = os.environ["SCRATCH"]
active = {l.strip() for l in pathlib.Path(s + "/active.txt").read_text().split() if l.strip()}
folded = dict(
    l.split() for l in pathlib.Path(s + "/folded.txt").read_text().splitlines() if len(l.split()) == 2
)
try:
    result = json.load(sys.stdin)["result"]
except Exception:
    # THE BOARD WAS NOT READABLE THIS PASS, WHICH IS NOT AN EMPTY BOARD. Exiting
    # quietly here writes a `cur.txt` holding no TICKET line at all, that becomes
    # `prev.txt`, and the next good pass reports every open ticket as new -- a
    # 25-line dump of the whole board, four times on 2026-09-15/16 while the Orca
    # runtime was answering `runtime_unavailable`. The `gh` half already refuses
    # to report an absence it cannot distinguish from silence; this is that rule,
    # applied to the half that was missing it.
    print("LINEAR-BLIND")
    sys.exit()
for i in result.get("issues") or result.get("nodes") or []:
    state = i["state"]["name"]
    # TERMINAL BY TYPE, NOT BY NAME. Linear types a state `completed`, `canceled`
    # or `duplicate`, and filtering on the NAMES of the first two left `Duplicate`
    # looking open: CNCORE-94 drew a DRIFT-FILING line on every pass for a ticket
    # correctly closed against CNCORE-93. Type also survives somebody renaming a
    # state, which a name list does not.
    if i["state"]["type"] in ("completed", "canceled", "duplicate"):
        continue
    num = i["identifier"].split("-")[1]
    print("TICKET", i["identifier"], state, i["title"][:42])
    # BACKLOG IS A DEFECT UNLESS A LABEL SAYS OTHERWISE. `to-spec` is a container
    # rather than a unit of work; `blocked-externally` is real work whose blocker
    # is outside this repo -- a date, a host reboot, a third party. Without the
    # second exemption this line fires on every pass for CNCORE-76 and CNCORE-107,
    # which are correctly filed, and a check that cries wolf twice a pass is one a
    # dispatcher learns to skim past.
    labels = {l["name"] for l in (i.get("labels") or [])}
    parked = labels & {"to-spec", "blocked-externally"}
    if (state == "Backlog" and not parked) or not i.get("assignee") or not labels:
        print("DRIFT-FILING", i["identifier"], state,
              "assignee=" + str((i.get("assignee") or {}).get("displayName")),
              "labels=" + str([l["name"] for l in (i.get("labels") or [])]))
    if os.environ.get("BLIND"):
        continue
    has = num in active or folded.get(num, "") in active
    if state == "Todo" and has:
        print("DRIFT-BEHIND", i["identifier"], "work exists via",
              num if num in active else folded.get(num))
    if state in ("In Progress", "In Review") and not has:
        print("DRIFT-STALE", i["identifier"], state, "no worktree or open PR")
' 2>/dev/null || true
  } | sort > "$SCRATCH/cur.txt"

  # A PASS THAT COULD NOT READ THE BOARD REPORTS NOTHING AND REMEMBERS NOTHING.
  # Keeping the old `prev.txt` is what makes the next good pass a real diff
  # rather than a re-announcement of everything still open.
  if grep -qx 'LINEAR-BLIND' "$SCRATCH/cur.txt"; then
    sleep 60
    continue
  fi

  comm -13 "$SCRATCH/prev.txt" "$SCRATCH/cur.txt" 2>/dev/null || true
  cp "$SCRATCH/cur.txt" "$SCRATCH/prev.txt"
  sleep 60
done
