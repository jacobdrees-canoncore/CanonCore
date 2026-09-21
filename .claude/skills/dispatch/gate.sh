#!/usr/bin/env bash
# THE MERGE GATE. Is there evidence, for THIS COMMIT, that CI passed?
#
# ADR-0181. A check is evidence only for the commit it ran against. A rebased
# and force-pushed PR goes on displaying the PREVIOUS head's results, and
# `gh pr checks` reports them without naming the commit they belong to -- so the
# PR reads green while no CI has run on the code that would merge. This repo has
# no required checks (ADR-0118), so nothing at GitHub's level catches that.
#
# SO THE HEAD IS RESOLVED AND ASKED ABOUT BY NAME, rather than the PR's rollup.
#
# ONE LINE OUT, ONE OUTCOME PER LINE, and a non-zero exit on every one but
# PASSED. `merge-if-green.sh` beside this file is what reads that exit status;
# never pipe this script, because a pipeline's status is the LAST command's.
#
#   PASSED <sha7> ...          this commit's own checks completed, none failed
#   BLOCKED NO-RUN <sha7> ...  nothing ran against it -- and which zero it is
#   BLOCKED RUNNING <sha7> ... a run exists and has not answered yet
#   BLOCKED FAILED <sha7> ...  a check on THIS commit concluded failure
#   BLOCKED SUPERSEDED ...     every run on it was cancelled by a newer push
#   BLOCKED MERGED|CLOSED ...  the PR is not open, so there is nothing to merge
#   BLOCKED LAGGING <n> ...    the PR's head field has not caught up with the branch
#   BLOCKED UNREADABLE ...     the question could not be asked at all
set -uo pipefail
pr="${1:?usage: gate.sh <pr-number> [repo]}"
repo="${2:-CanonCore}"
slug="jacobdrees-canoncore/$repo"

view=$(gh pr view "$pr" --repo "$slug" --json headRefOid,headRefName,mergeStateStatus,state 2>/dev/null) ||
  { echo "BLOCKED UNREADABLE cannot read #$pr in $slug"; exit 1; }
head=$(VIEW="$view" python3 -c 'import json,os;print(json.loads(os.environ["VIEW"]).get("headRefOid") or "")')
[ -n "$head" ] || { echo "BLOCKED UNREADABLE #$pr names no head commit"; exit 1; }

# A CLOSED PR IS NOT A MERGE CANDIDATE, and it is said in those words. Merging
# with `--delete-branch` takes the head ref away, so the tip check below would
# otherwise report a missing ref -- a symptom phrased as though something were
# broken, at a dispatcher who would then go looking for it.
state=$(VIEW="$view" python3 -c 'import json,os;print(json.loads(os.environ["VIEW"]).get("state") or "OPEN")')
if [ "$state" != "OPEN" ]; then
  echo "BLOCKED $state #$pr is not open, so there is nothing to merge"
  exit 1
fi

# THE PR'S OWN HEAD FIELD LAGS A FORCE-PUSH, so resolving from it is necessary
# and not sufficient. Measured on CNCORE-288's branch, 2026-09-21: seconds after
# a rebase, `git ls-remote` had the new tip while `gh pr view` still answered
# with the PRE-REBASE commit, and this gate gave a verdict about a commit that
# was no longer on the branch. The two disagreeing is not a verdict either way
# -- it means the question was asked inside that window -- so it refuses and
# the dispatcher looks again.
branch=$(VIEW="$view" python3 -c 'import json,os;print(json.loads(os.environ["VIEW"]).get("headRefName") or "")')
tip=$(GIT_TERMINAL_PROMPT=0 git ls-remote "https://github.com/$slug.git" "refs/heads/$branch" 2>/dev/null | cut -f1)
[ -n "$tip" ] || { echo "BLOCKED UNREADABLE cannot read refs/heads/$branch in $slug"; exit 1; }
if [ "$tip" != "$head" ]; then
  echo "BLOCKED LAGGING #$pr says its head is ${head:0:7}, the branch is at ${tip:0:7} -- ask again"
  exit 1
fi

# EVERY PAGE, BECAUSE THIRTY IS THE PAGE AND THIRTY-TWO WAS THE ANSWER. This
# endpoint serves 30 per page by default. #210's head carries 32 check-runs --
# nineteen that answered and thirteen a force-push cancelled -- so an unpaged read saw
# 30 of them and gave a verdict on those, with the real size sitting in a
# `total_count` nothing looked at. A failure on page two is a failure this gate
# would have passed, which is this record's own defect one level down.
# `--slurp` wraps the pages in an array rather than concatenating objects.
runs=$(gh api --paginate --slurp "repos/$slug/commits/$head/check-runs?per_page=100" 2>/dev/null) ||
  { echo "BLOCKED UNREADABLE no check-runs answer for ${head:0:7}"; exit 1; }

HEAD="$head" VIEW="$view" RUNS="$runs" python3 <<'PY'
import json, os, sys

head = os.environ["HEAD"]
state = json.loads(os.environ["VIEW"]).get("mergeStateStatus") or "UNKNOWN"
pages = json.loads(os.environ["RUNS"])
runs = [c for page in pages for c in (page.get("check_runs") or [])]

# A READ THAT CAME BACK SHORT IS NOT AN ANSWER. `total_count` is the commit's
# real number of check-runs; a verdict given over fewer than that is a verdict
# over a page, which is the whole class this gate exists to refuse.
total = max((page.get("total_count") or 0) for page in pages) if pages else 0
if len(runs) != total:
    print(f"BLOCKED UNREADABLE {head[:7]} read {len(runs)} check-runs of {total}")
    sys.exit(1)

if not runs:
    # A conflicted PR gets NO run rather than a failing one: a `pull_request`
    # workflow runs against `refs/pull/N/merge`, which GitHub cannot build
    # while the branch conflicts. That zero never clears on its own.
    if state == "DIRTY":
        print(f"BLOCKED NO-RUN {head[:7]} the branch conflicts, so none ever will -- merge main and it fires")
    else:
        print(f"BLOCKED NO-RUN {head[:7]} none YET ({state}) -- re-check; #210 waited 4m05s after its force-push")
    sys.exit(1)

running = [c["name"] for c in runs if c.get("status") != "completed"]
if running:
    print(f"BLOCKED RUNNING {head[:7]} {len(running)} of {len(runs)} still going: " + ", ".join(running[:5]))
    sys.exit(1)

def concluded(*what):
    return [c["name"] for c in runs if c.get("conclusion") in what]

failed = concluded("failure", "timed_out", "action_required")
if failed:
    print(f"BLOCKED FAILED {head[:7]} " + ", ".join(failed[:5]))
    sys.exit(1)

# `cancelled` is a run a NEWER PUSH killed -- `ci.yml` sets `cancel-in-progress`
# on a group keyed by the head ref, so every force-push leaves a trail of them.
# It is not a defect, and calling it one produced a false "genuine breakage"
# claim on 2026-09-20. It still blocks when nothing else ran: a commit whose
# only runs were killed has no more evidence behind it than one with none.
passed = concluded("success", "skipped", "neutral")
if not passed:
    print(f"BLOCKED SUPERSEDED {head[:7]} every run on this commit was cancelled by a newer push")
    sys.exit(1)

print(f"PASSED {head[:7]} {len(passed)} of {len(runs)} checks passed on this commit")
PY
