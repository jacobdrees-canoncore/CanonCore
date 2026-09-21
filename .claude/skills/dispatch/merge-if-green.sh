#!/usr/bin/env bash
# Gate AND merge, in one command, so the guard cannot be stepped past.
#
# WHY THIS IS ONE COMMAND. The gate was run as `gate.py | tail -2 && gh pr merge`
# in the scratch version this replaces, and a pipeline's exit status is the LAST
# command's -- `tail` always succeeds. The guard printed BLOCKED and the merge
# ran anyway. Separating "show me" from "decide" is what made that possible, so
# nothing here is piped and the script that decides is the script that merges.
set -euo pipefail

# THE SIBLING IS FOUND FROM THIS FILE, NOT FROM `$0`. Invoked by bare name off
# PATH, `dirname "$0"` is `.` and this would execute whatever `gate.sh` sits in
# the caller's working directory -- an execution sink, in the one script whose
# whole job is refusing to act on the wrong thing.
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
gate="$here/gate.sh"
[ -x "$gate" ] || { echo "NOT MERGING: no executable gate at $gate"; exit 1; }

pr="${1:?usage: merge-if-green.sh <pr-number> [repo] [worktree]}"
repo="${2:-CanonCore}"
worktree="${3:-}"

if ! "$gate" "$pr" "$repo"; then
  echo "NOT MERGING #$pr"
  exit 1
fi

# A WORKTREE NAMED HERE MUST BE READABLE, BE THE WORKTREE, AND BE FINISHED WITH.
# `CLAUDE.md` makes removing one conditional on "nothing is uncommitted and
# nothing unpushed", and this merge is what authorises that removal.
#
# BOTH HALVES, because the guard used to cite the whole condition and check the
# uncommitted half alone -- a guard reading narrower than it says, which is this
# record's defect in a comment. A commit that never reached the remote is not in
# the pull request, so merging lands work missing a piece its author wrote.
#
# AND THE PATH MUST BE THE ROOT. `git -C` walks UP to the enclosing repository,
# so a subdirectory, or a mistyped path that still lands inside some checkout,
# returns a clean report about a repository nobody asked about.
if [ -n "$worktree" ]; then
  if ! root=$(git -C "$worktree" rev-parse --show-toplevel 2>&1); then
    echo "NOT MERGING #$pr: cannot read $worktree -- $root"
    exit 1
  fi
  if [ "$root" != "$(cd -- "$worktree" && pwd -P)" ]; then
    echo "NOT MERGING #$pr: $worktree is inside $root, not the root of it"
    exit 1
  fi

  dirty=$(git -C "$worktree" status --short)
  if [ -n "$dirty" ]; then
    echo "NOT MERGING #$pr: uncommitted work in $worktree"
    echo "$dirty"
    exit 1
  fi

  if ! held=$(git -C "$worktree" log --oneline '@{u}..HEAD' 2>&1); then
    echo "NOT MERGING #$pr: $worktree has no upstream to compare against -- $held"
    exit 1
  fi
  if [ -n "$held" ]; then
    echo "NOT MERGING #$pr: unpushed commits in $worktree, so they are not in the PR"
    echo "$held"
    exit 1
  fi
fi

gh pr merge "$pr" --repo "jacobdrees-canoncore/$repo" --squash --delete-branch
