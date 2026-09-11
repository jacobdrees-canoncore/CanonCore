#!/usr/bin/env bash
# The dispatcher's wake-up. Emits one line per CHANGE, never a heartbeat.
#
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
    for r in $REPOS; do
      gh pr list --repo "jacobdrees-canoncore/$r" --json number,isDraft,mergeStateStatus,headRefName \
        --jq ".[] | select(.isDraft==false) | \"READY $r #\(.number) \(.mergeStateStatus) \(.headRefName|split(\"/\")|last)\"" 2>/dev/null || true
    done

    # Ticket numbers with real work: any open PR branch, plus any live worktree.
    { for r in $REPOS; do
        gh pr list --repo "jacobdrees-canoncore/$r" --json headRefName --jq '.[].headRefName' 2>/dev/null || true
      done
      ls -1d "$HOME"/orca/workspaces/*/* 2>/dev/null | grep -v trash || true
    } | grep -oE 'cncore-[0-9]+' | grep -oE '[0-9]+' | sort -u > "$SCRATCH/active.txt" || true

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
    sys.exit()
for i in result.get("issues") or result.get("nodes") or []:
    state = i["state"]["name"]
    if state in ("Done", "Canceled"):
        continue
    num = i["identifier"].split("-")[1]
    print("TICKET", i["identifier"], state, i["title"][:42])
    if state == "Backlog" or not i.get("assignee") or not i.get("labels"):
        print("DRIFT-FILING", i["identifier"], state,
              "assignee=" + str((i.get("assignee") or {}).get("displayName")),
              "labels=" + str([l["name"] for l in (i.get("labels") or [])]))
    has = num in active or folded.get(num, "") in active
    if state == "Todo" and has:
        print("DRIFT-BEHIND", i["identifier"], "work exists via",
              num if num in active else folded.get(num))
    if state in ("In Progress", "In Review") and not has:
        print("DRIFT-STALE", i["identifier"], state, "no worktree or open PR")
' 2>/dev/null || true
  } | sort > "$SCRATCH/cur.txt"

  comm -13 "$SCRATCH/prev.txt" "$SCRATCH/cur.txt" 2>/dev/null || true
  cp "$SCRATCH/cur.txt" "$SCRATCH/prev.txt"
  sleep 60
done
