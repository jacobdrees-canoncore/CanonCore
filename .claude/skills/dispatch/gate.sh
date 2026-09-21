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
# never pipe this script: a pipeline's status is the LAST command's, and
# `gate.py | tail -2 && gh pr merge` once merged over a printed BLOCKED.
#
#   PASSED <sha7> ...          this commit's own checks completed, none failed
#   BLOCKED NO-RUN <sha7> ...  nothing ran against it -- and which zero it is
#   BLOCKED RUNNING <sha7> ... a run exists and has not answered yet
#   BLOCKED FAILED <sha7> ...  a check on THIS commit concluded failure
#   BLOCKED SUPERSEDED ...     every run on it was cancelled by a newer push
#   BLOCKED UNKNOWN-CONCLUSION  a conclusion this gate does not know, so not evidence
#   BLOCKED MERGED|CLOSED ...  the PR is not open, so there is nothing to merge
#   BLOCKED DRAFT <n> ...      the PR is still a draft, which no other field says
#   BLOCKED LAGGING <n> ...    the PR's head field has not caught up with the branch
#   BLOCKED UNREADABLE ...     the question could not be asked at all
set -uo pipefail
pr="${1:?usage: gate.sh <pr-number> [repo]}"
repo="${2:-CanonCore}"

# THE REPOSITORY NAME REACHES A URL PATH AND A CLONE ADDRESS, so its shape is
# checked before either is built. A dispatcher types this rather than a stranger
# sending it, which is why it is a shape check and not an allowlist: three names
# hardcoded here is a fourth repository's maintenance burden, while a `/` or a
# `..` in it is never anything but a mistake.
case "$repo" in
  *[!A-Za-z0-9._-]* | "" | .* ) echo "BLOCKED UNREADABLE '$repo' is not a repository name"; exit 1;;
esac
slug="jacobdrees-canoncore/$repo"

view=$(gh pr view "$pr" --repo "$slug" --json headRefOid,headRefName,isDraft,mergeStateStatus,state 2>/dev/null) ||
  { echo "BLOCKED UNREADABLE cannot read #$pr in $slug"; exit 1; }

# ONE PARSE OF ONE SNAPSHOT. Asking `gh` four times would be four snapshots, and
# during a force-push they disagree -- which is the very window the tip check
# below exists for, so reading the fields separately would undermine it.
{ read -r head; read -r branch; read -r prstate; read -r mergestate; read -r draft; } < <(
  VIEW="$view" python3 -c '
import json, os
try:
    pr = json.loads(os.environ["VIEW"])
except Exception:
    pr = {}
for key in ("headRefOid", "headRefName", "state", "mergeStateStatus"):
    print(pr.get(key) or "")
print("draft" if pr.get("isDraft") else "")
'
)
[ -n "$head" ] || { echo "BLOCKED UNREADABLE #$pr names no head commit"; exit 1; }
[ -n "$branch" ] || { echo "BLOCKED UNREADABLE #$pr names no head branch"; exit 1; }

# A CLOSED PR IS NOT A MERGE CANDIDATE, and it is said in those words. Merging
# with `--delete-branch` takes the head ref away, so the tip check below would
# otherwise report a missing ref -- a symptom phrased as though something were
# broken, at a dispatcher who would then go looking for it.
if [ "${prstate:-OPEN}" != "OPEN" ]; then
  echo "BLOCKED $prstate #$pr is not open, so there is nothing to merge"
  exit 1
fi

# A DRAFT IS NOT A MERGE CANDIDATE, AND NOTHING ELSE ON THE PULL REQUEST SAYS
# SO. Measured on #230, 2026-09-21: `isDraft` true, `state` OPEN,
# `mergeStateStatus` CLEAN and sixteen checks green -- on which this gate said
# PASSED, and the fused merge would have taken another agent's unfinished work
# while it was still writing it. `monitor.sh` beside this file already fires
# `READY` only on `isDraft==false`, so the gate was the one step in the loop
# that did not know.
if [ -n "$draft" ]; then
  echo "BLOCKED DRAFT #$pr is still a draft, so it is not offered for merge"
  exit 1
fi

# THE PR'S OWN HEAD FIELD LAGS A FORCE-PUSH, so resolving from it is necessary
# and not sufficient. Measured on CNCORE-288's branch, 2026-09-21: seconds after
# a rebase, `git ls-remote` had the new tip while `gh pr view` still answered
# with the PRE-REBASE commit, and this gate gave a verdict about a commit that
# was no longer on the branch. The two disagreeing is not a verdict either way
# -- it means the question was asked inside that window -- so it refuses and
# the dispatcher looks again.
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

HEAD="$head" STATE="$mergestate" RUNS="$runs" python3 <<'PY'
import json, os, sys

head = os.environ["HEAD"]
state = os.environ["STATE"] or "UNKNOWN"

# A TRACEBACK IS NOT ONE OF THIS SCRIPT'S OUTCOMES. The contract above is one
# line out and a non-zero exit; an unparseable answer that crashed the parser
# would still block, but it would block in a shape nothing reading this expects.
try:
    pages = json.loads(os.environ["RUNS"])
except Exception:
    print(f"BLOCKED UNREADABLE {head[:7]} the check-runs answer did not parse")
    sys.exit(1)
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

# THE GOOD SET IS THE CLOSED ONE, and everything else is refused by name.
# Listing the BAD conclusions and letting the rest through is this record's own
# defect wearing a third hat: `stale` is a documented conclusion that only
# GitHub sets -- its REST docs say "You cannot change a check run conclusion to
# stale, only GitHub can set this" -- so it appears without this repository
# doing anything, and beside one `success` it read PASSED. A conclusion this
# gate has never heard of is absent evidence, not good evidence.
GOOD = {"success", "skipped", "neutral"}
named = lambda those: ", ".join(f"{c.get('name') or '?'} ({c.get('conclusion')})" for c in those[:5])

failed = [c for c in runs if c.get("conclusion") in {"failure", "timed_out", "action_required"}]
if failed:
    print(f"BLOCKED FAILED {head[:7]} " + named(failed))
    sys.exit(1)

# `cancelled` is a run a NEWER PUSH killed -- `ci.yml` sets `cancel-in-progress`
# on a group keyed by the head ref, so every force-push leaves a trail of them.
# It is not a defect, and calling it one produced a false "genuine breakage"
# claim on 2026-09-20.
cancelled = [c for c in runs if c.get("conclusion") == "cancelled"]

unknown = [c for c in runs if c.get("conclusion") not in GOOD and c not in cancelled]
if unknown:
    print(f"BLOCKED UNKNOWN-CONCLUSION {head[:7]} " + named(unknown))
    sys.exit(1)

# It still blocks when nothing else ran: a commit whose only runs were killed
# has no more evidence behind it than one with none.
passed = [c for c in runs if c.get("conclusion") in GOOD]
if not passed:
    print(f"BLOCKED SUPERSEDED {head[:7]} every run on this commit was cancelled by a newer push")
    sys.exit(1)

print(f"PASSED {head[:7]} {len(passed)} of {len(runs)} checks passed on this commit")
PY
