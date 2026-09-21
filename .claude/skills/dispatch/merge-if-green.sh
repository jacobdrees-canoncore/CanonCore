#!/usr/bin/env bash
# Gate AND merge, in one command, so the guard cannot be stepped past.
#
# WHY THIS IS ONE COMMAND. The gate was run as `gate.sh <pr> | tail -2 &&
# gh pr merge`, and a pipeline's exit status is the LAST command's -- `tail`
# always succeeds. The guard printed BLOCKED and the merge ran anyway.
# Separating "show me" from "decide" is what made that possible, so nothing
# here is piped and the script that decides is the script that merges.
set -euo pipefail
pr="${1:?usage: merge-if-green.sh <pr-number> [repo] [worktree]}"
repo="${2:-CanonCore}"
worktree="${3:-}"

if ! "$(dirname "$0")/gate.sh" "$pr" "$repo"; then
  echo "NOT MERGING #$pr"
  exit 1
fi

# A WORKTREE NAMED HERE IS ONE THAT MUST BE READABLE AND CLEAN. `CLAUDE.md`
# makes removing it the dispatcher's job "once nothing is uncommitted and
# nothing unpushed", and this merge is what authorises that removal.
#
# A PATH THAT CANNOT BE READ BLOCKS RATHER THAN BEING SKIPPED. "If the
# directory is there, check it" answers identically for a clean worktree and
# for a mistyped path, which is ADR-0181's own defect wearing a different hat:
# an absence that presents as a pass.
if [ -n "$worktree" ]; then
  if ! dirty=$(git -C "$worktree" status --short 2>&1); then
    echo "NOT MERGING #$pr: cannot read $worktree -- $dirty"
    exit 1
  fi
  if [ -n "$dirty" ]; then
    echo "NOT MERGING #$pr: uncommitted work in $worktree"
    echo "$dirty"
    exit 1
  fi
fi

gh pr merge "$pr" --repo "jacobdrees-canoncore/$repo" --squash --delete-branch
