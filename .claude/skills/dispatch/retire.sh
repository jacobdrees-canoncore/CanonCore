#!/usr/bin/env bash
# RETIRE A MERGED TICKET'S WORKTREE: verify the content landed, and only THEN
# remove and drop. `merge-if-green.sh` beside this file is the other half.
#
# WHY THIS EXISTS. `/dispatch` step 2 and `CLAUDE.md` both state the rule -- a
# squash merge makes ancestry the wrong test, so compare CONTENT against
# `origin/main` before removing, then drop the databases -- and until CNCORE-334
# nothing here implemented it. On 2026-09-21 cncore-316's worktree was removed
# in the same command as the comparison, so the removal ran before the DIFF
# lines were read. Two files differed and both turned out to be `main` running
# ahead, so nothing was lost -- by the order the shell happened to run things,
# not by any check.
#
# ONE LINE PER FILE, ONE VERDICT LINE, and a non-zero exit on everything but
# RETIRED. Never pipe it: a pipeline's exit status is the LAST command's, which
# is how a printed BLOCKED was once merged over (ADR-0181).
set -uo pipefail

wt="${1:?usage: retire.sh <worktree> [--ticket CNCORE-<n>] [--aux <name>]...}"
shift
ticket=""
# SPACE-DELIMITED RATHER THAN AN ARRAY, and matched with a `case` below, because
# `declare -A` and an empty `${a[@]}` under `set -u` are both bash 4 -- and
# `/bin/bash` on this Mac is 3.2.57.
asserted=" "
while [ $# -gt 0 ]; do
  case "$1" in
    # STRICTLY SHAPED, because it reaches a `grep` pattern below: the loose
    # `CNCORE-*` check this replaces admitted `CNCORE-.*`, which matches every
    # subject there is and would explain any difference at all.
    --ticket)
      case "${2:?--ticket needs a CNCORE-<n>}" in
        CNCORE-[0-9] | CNCORE-[0-9][0-9] | CNCORE-[0-9][0-9][0-9] | CNCORE-[0-9][0-9][0-9][0-9]) ;;
        *) echo "STOPPED: '--ticket $2' is not a CNCORE-<n>"; exit 1;;
      esac
      ticket="$2"; shift 2;;
    # AN AUXILIARY TREE IS NAMED, NEVER INFERRED. See the scan below for why
    # this is an argument rather than something the script works out.
    --aux)
      case "${2:?--aux needs a worktree name}" in
        *[!A-Za-z0-9._-]* | "" | .* ) echo "STOPPED: '--aux $2' is not a worktree name"; exit 1;;
      esac
      asserted="$asserted$2 "
      shift 2;;
    *) echo "STOPPED: unknown argument '$1'"; exit 1;;
  esac
done

# THE PATH MUST BE THE ROOT OF THE WORKTREE, for the reason `merge-if-green.sh`
# gives: `git -C` walks UP to the enclosing repository, so a subdirectory -- or
# a mistyped path that still lands inside some checkout -- answers cleanly about
# a repository nobody asked about, and here that answer authorises a removal.
if ! root=$(git -C "$wt" rev-parse --show-toplevel 2>&1); then
  echo "STOPPED: cannot read $wt -- $root"
  exit 1
fi
wt=$(cd -- "$wt" && pwd -P)
if [ "$root" != "$wt" ]; then
  echo "STOPPED: $wt is inside $root, not the root of it"
  exit 1
fi

# A MAIN CHECKOUT IS NOT A WORKTREE TO RETIRE, AND THE SAME READ DERIVES THE
# WORKSPACE PATH. In a linked worktree `--git-dir` is
# `<main>/.git/worktrees/<name>` while `--git-common-dir` is `<main>/.git`; in a
# main checkout the two are equal. So one question refuses
# `~/orca/projects/<repo>` -- whose removal would take the Owner's own checkout
# and whose databases are the live install's -- and hands back where
# `db:drop-worktree` has to run from, with no path written down anywhere
# (ADR-0192, and ADR-0191 on the drop).
# ONE LINE EACH, NEVER SPLIT ON WHITESPACE. Read through `tr '\n' ' '` into two
# words, a worktree under a path containing a space mis-parsed `common`, `main`
# came out wrong, the manifest read below failed, and the script printed
# `databases none` and exited 0 -- RETIRED over databases still standing. This
# is the shape `gate.sh` beside this file already uses for the same reason.
{ read -r gitdir; read -r common; } < <(
  git -C "$wt" rev-parse --path-format=absolute --git-dir --git-common-dir 2>/dev/null
)
if [ -z "${gitdir:-}" ] || [ -z "${common:-}" ]; then
  echo "STOPPED: $wt does not answer as a git checkout"
  exit 1
fi
if [ "$gitdir" = "$common" ]; then
  echo "STOPPED: $wt is a main checkout, not a worktree -- removing it is never this script's job"
  exit 1
fi
main=$(dirname -- "$common")

branch=$(git -C "$wt" symbolic-ref --quiet --short HEAD) || branch=""
if [ -z "$branch" ]; then
  echo "STOPPED: $wt has no branch checked out, so there is nothing to compare"
  exit 1
fi
case "$branch" in
  main | master) echo "STOPPED: $wt has $branch checked out"; exit 1;;
esac

# THE TICKET IS DERIVED FROM THE BRANCH, then the worktree's own name, because a
# provider worktree carries its CanonCore twin's name (ADR-0192) and may not
# carry its branch shape. An argument overrides both. WITHOUT ONE, ONE OF THE
# TWO EXPLANATIONS BELOW CANNOT FIRE, so the script SAYS which ticket it is
# reading for rather than quietly explaining less than it claims to.
if [ -z "$ticket" ]; then
  ticket=$(printf '%s\n' "$branch" "$(basename -- "$wt")" |
    sed -n 's|.*[Cc][Nn][Cc][Oo][Rr][Ee]-\([0-9][0-9]*\).*|\1|p' | head -1)
  [ -n "$ticket" ] && ticket="CNCORE-$ticket"
fi
if [ -n "$ticket" ]; then
  echo "  ticket       $ticket"
else
  echo "  ticket       none derivable from '$branch' -- only landed content will explain a difference"
fi

# NOTHING UNCOMMITTED AND NOTHING UNPUSHED, which is the condition `CLAUDE.md`
# puts on removing a worktree. `merge-if-green.sh` checks both before the merge
# that AUTHORISES this removal; they are checked again here because the two are
# separate commands with a review between them, and work can arrive in that
# window.
dirty=$(git -C "$wt" status --short)
if [ -n "$dirty" ]; then
  echo "STOPPED: uncommitted work in $wt"
  echo "$dirty"
  exit 1
fi

if ! fetched=$(git -C "$wt" fetch -q origin 2>&1); then
  echo "STOPPED: cannot fetch origin in $wt -- $fetched"
  exit 1
fi
if ! base=$(git -C "$wt" merge-base HEAD origin/main 2>&1); then
  echo "STOPPED: $wt and origin/main share no history -- $base"
  exit 1
fi

# AND A MISSING UPSTREAM IS THE NORMAL STATE HERE, WHICH INVERTS
# `merge-if-green.sh`'S READING OF THE SAME FACT. That script stops when a
# worktree has no upstream, and it is right to: before the merge, a branch with
# no upstream is one whose work is not in the pull request. By the time this
# runs, `gh pr merge --squash --delete-branch` has taken the remote branch
# away, so no upstream is what a correctly merged ticket LOOKS like -- and a
# guard copied across from the merge side refuses every retirement handed to
# it. Nothing is given up by passing it, because the content comparison below
# is the stronger test: a branch that was never pushed at all has every file
# UNEXPLAINED and stops there instead.
if held=$(git -C "$wt" log --oneline '@{u}..HEAD' 2>/dev/null) && [ -n "$held" ]; then
  echo "STOPPED: unpushed commits in $wt, so they are not in the pull request"
  echo "$held"
  exit 1
fi

# THE COMPARISON IS OF CONTENT, FILE BY FILE, AND NEITHER READING OF A DIFF LINE
# IS ASSUMED. `main` ahead and content lost produce the SAME line, so each
# difference has to be explained before it is passed over:
#
#   main-ahead    some commit on `main` since the fork holds this file's blob
#                 EXACTLY as the branch has it, so the branch's version reached
#                 `main` and `main` changed it afterwards.
#   ticket-named  a commit on `main` since the fork touched this file under this
#                 ticket's subject, so the work landed and the merge or a later
#                 amend altered it.
#
# THE BLOB TEST IS THE ONE THAT HOLDS, and the ticket asked for a weaker one:
# "`main` holds a later commit touching it". That is true of a file some OTHER
# ticket edited while THIS branch's change to it never merged -- which is the
# unsafe reading, passed as though it were the safe one. A guard that cannot
# refuse the incident it was written for is the defect one level down, so the
# blob is compared instead of the timestamp (ADR-0199).
#
# NUL-DELIMITED, because a filename is not a word: `for f in $(git diff --name-only)`
# splits one holding a space into two paths that exist nowhere, and a path that
# cannot be read is a difference that cannot be explained.
stopped=0
while IFS= read -r -d '' f; do
  git -C "$wt" diff --quiet origin/main HEAD -- "$f" && continue

  mine=$(git -C "$wt" rev-parse --quiet --verify "HEAD:$f" 2>/dev/null) || mine=""
  landed=""
  while IFS= read -r commit; do
    [ -n "$commit" ] || continue
    theirs=$(git -C "$wt" rev-parse --quiet --verify "$commit:$f" 2>/dev/null) || theirs=""
    if [ -n "$mine" ] && [ "$theirs" = "$mine" ]; then landed="$commit"; break; fi
  done < <(git -C "$wt" rev-list "$base..origin/main" -- "$f")

  if [ -n "$landed" ]; then
    echo "  main-ahead   $f  (landed in $(git -C "$wt" log --oneline -1 "$landed" | cut -c1-60))"
  elif [ -n "$ticket" ] &&
    git -C "$wt" log --format=%s "$base..origin/main" -- "$f" | grep -q "^$ticket:"; then
    echo "  ticket-named $f  (main's history on it carries $ticket)"
  else
    echo "  UNEXPLAINED  $f"
    stopped=1
  fi
done < <(git -C "$wt" diff --name-only -z "$base" HEAD)

# AUXILIARY WORKTREES: THE LEAK `orca worktree list` CANNOT SEE.
#
# A ticket can run `git worktree add` for a job of its own -- the comment scan's
# parser oracle wants HEAD, main and the previous commit checked out at once --
# and those trees are registered in the repo's `.git/worktrees/` while living
# anywhere on disk. Orca never learns about them, so nothing lists them and,
# until this block, nothing retired them. Measured on cncore-333, 2026-09-21:
# three at `/private/tmp/wt-head`, `wt-main` and `wt-prev`, registered in
# `provider-wiki/.git/worktrees/` and absent from `orca worktree list`.
#
# OWNERSHIP IS RECORDED NOWHERE, WHICH IS WHY THIS ASKS RATHER THAN DECIDES.
# Each entry holds a `gitdir` naming a path and a detached `HEAD` naming a sha,
# and nothing that names a ticket. Of those three only `wt-head` sat on a commit
# unique to its branch; the other two sat on commits every branch in the repo
# shares, so reachability cannot attribute them. Age cannot -- they were two
# minutes old. Nor can uncommitted work: all three were clean but for an
# untracked `node_modules` from a scratch install. So an unattributed tree STOPS
# the retirement and is named, and `--aux <name>` is how the dispatcher who made
# one says so. Inferring ownership from what happens to be reachable is the same
# move as reading "main holds a later commit" as "the content landed".
#
# THE REGISTRATIONS ARE READ AS FILES, because `git worktree` is denied by
# `.claude/settings.json` -- `Bash(git worktree:*)`, which covers `list`,
# `prune` and `remove` alike (measured 2026-09-21). So the scan is `cat`, and
# the removal is `rm -rf` of the tree AND of its entry under `worktrees/`.
workspace=$(dirname -- "$wt")
registrations="$common/worktrees"
remove_names=" "
matched=" "

# THE PLAN IS NUL-DELIMITED ON DISK, NOT A DELIMITED STRING. Built as newline
# records split by `read -r entry tree`, a `gitdir` file holding a NEWLINE
# yielded a SECOND record whose first field was an arbitrary absolute path --
# and that path was then `rm -rf`'d. This script already refuses to split git's
# filenames on whitespace for the same reason; the plan it builds from them had
# no business being weaker than its input.
plan=$(mktemp) || { echo "STOPPED: cannot make a temporary file"; exit 1; }
trap 'rm -f "$plan"' EXIT

for entry in "$registrations"/*; do
  [ -d "$entry" ] || continue
  name=$(basename -- "$entry")

  # A REGISTRATION NAME IS BUILT BACK INTO A PATH THIS SCRIPT REMOVES, so its
  # shape is checked before anything is built from it.
  case "$name" in
    *[!A-Za-z0-9._-]* | "" | .* )
      echo "  UNATTRIBUTED (a registration whose name this script will not build a path from)"
      stopped=1
      continue;;
  esac

  gitdir=$(cat "$entry/gitdir" 2>/dev/null) || gitdir=""
  if [ -z "$gitdir" ]; then
    echo "  UNATTRIBUTED $name  (no gitdir recorded in $entry)"
    stopped=1
    continue
  fi
  # A `gitdir` IS ONE ABSOLUTE PATH AND NOTHING ELSE. Anything else reaches
  # `dirname` and then a removal decision, and a multi-line one used to land in
  # the prune branch by accident rather than be refused on purpose.
  case "$gitdir" in
    /*) ;;
    *) echo "  UNATTRIBUTED $name  (its gitdir is not an absolute path)"; stopped=1; continue;;
  esac
  if [ "$gitdir" != "$(printf '%s' "$gitdir" | head -1)" ]; then
    echo "  UNATTRIBUTED $name  (its gitdir is more than one line)"
    stopped=1
    continue
  fi
  tree=$(dirname -- "$gitdir")
  [ -d "$tree" ] && tree=$(cd -- "$tree" && pwd -P)

  # The retiring worktree's own registration, which its removal takes.
  [ "$tree" = "$wt" ] && continue

  # ANOTHER TICKET'S ORCA WORKTREE, beside this one in the same workspace
  # directory. Orca lists it and `/dispatch` retires it on its own PR; sweeping
  # it up here would take a live ticket's whole checkout. NAMING ONE WITH
  # `--aux` IS REFUSED RATHER THAN IGNORED: skipped silently, the assertion then
  # failed as "matches no registration" about a registration that plainly does
  # exist, which sends the dispatcher looking for the wrong thing.
  if [ "$(dirname -- "$tree")" = "$workspace" ]; then
    case "$asserted" in
      *" $name "*)
        echo "STOPPED: --aux $name names an Orca worktree ($tree), which is retired on its own PR"
        exit 1;;
    esac
    continue
  fi

  # A REGISTRATION WHOSE TREE IS ALREADY GONE IS PRUNED UNASKED: no files, no
  # agent, no work, and nothing to break. It is what `git worktree prune` would
  # do, and that is the command this repository denies. Only the ENTRY is
  # removed here, so no path read out of a file reaches `rm -rf` on this path.
  if [ ! -d "$tree" ]; then
    echo "  aux-pruned   $name  (registration only; $tree is gone)"
    printf '%s\0%s\0' "$entry" "" >> "$plan"
    continue
  fi

  # THE TREE MUST BE A WORKTREE OF THIS REPOSITORY, AND GIT IS WHO SAYS SO.
  # `$tree` comes out of a FILE, and it is about to be handed to `rm -rf`. The
  # guard this replaces was a `case "$tree" in /*/*)` depth test, which the
  # OWNER'S HOME DIRECTORY passes -- two components is all it has -- so a
  # `gitdir` naming it would have removed it on one `--aux`, and `cd && pwd -P`
  # resolves symlinks INTO whatever it names. Asking git whether the path is a
  # worktree sharing THIS repository's common directory is a question no
  # unrelated path can answer, and it is the same question that told this
  # worktree from a main checkout above.
  belongs=$(git -C "$tree" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || belongs=""
  if [ "$belongs" != "$common" ]; then
    echo "  UNATTRIBUTED $name  ($tree does not answer as a worktree of $common)"
    stopped=1
    continue
  fi
  # AND NEVER ONE OF THE PATHS THIS SCRIPT IS STANDING ON, however it answered.
  case "$tree" in
    "$main" | "$workspace" | "$HOME" | "/" )
      echo "  UNATTRIBUTED $name  ($tree is not a path this script will remove)"
      stopped=1
      continue;;
  esac

  # A TRACKED CHANGE IS SOMEBODY'S EDIT, AND AN ASSERTION IS NOT A LICENCE TO
  # DESTROY IT -- the condition `CLAUDE.md` puts on the worktree itself, applied
  # wherever the work sits. Untracked files are not the signal: a scratch
  # `node_modules` is what these trees are for. A READ THAT FAILED IS NOT A
  # CLEAN ONE: it used to come back empty and pass.
  if ! aux_dirty=$(git -C "$tree" status --porcelain --untracked-files=no 2>&1); then
    echo "  UNATTRIBUTED $name  (cannot read $tree -- $aux_dirty)"
    stopped=1
    continue
  fi
  if [ -n "$aux_dirty" ]; then
    echo "  AUX-DIRTY    $name  ($tree holds uncommitted tracked work)"
    echo "$aux_dirty" | sed 's/^/                 /'
    stopped=1
    continue
  fi

  case "$asserted" in
    *" $name "*)
      echo "  aux-asserted $name  ($tree)"
      printf '%s\0%s\0' "$entry" "$tree" >> "$plan"
      matched="$matched$name "
      ;;
    *)
      echo "  UNATTRIBUTED $name  ($tree, at $(git -C "$tree" log --oneline -1 2>/dev/null | cut -c1-50))"
      echo "               retire it with this too, if it is this ticket's: --aux $name"
      stopped=1
      ;;
  esac
done

# AN ASSERTION THAT MATCHED NOTHING IS A TYPO THAT READS AS A CLEAN PASS. The
# dispatcher named a tree, nothing was removed under that name, and without this
# the retirement reports success over a tree still standing.
for name in $asserted; do
  case "$matched" in
    *" $name "*) ;;
    *) echo "STOPPED: --aux $name matches no registration under $registrations"; exit 1;;
  esac
done

if [ "$stopped" -ne 0 ]; then
  echo "STOPPED: the retirement found something it cannot account for -- look before removing"
  exit 1
fi

# ONLY NOW DOES ANYTHING GO. Every refusal above had to come first: the incident
# this script exists for was a removal chained into the same command as the
# check, so it ran before the check's output was read.
#
# THE TREE GOES BEFORE ITS REGISTRATION. The other order leaves, on a failure
# between the two, a tree that git no longer knows about -- which is the harder
# of the two leftovers to notice, since nothing lists it.
while IFS= read -r -d '' entry && IFS= read -r -d '' tree; do
  [ -n "$entry" ] || continue
  if [ -n "$tree" ] && ! rm -rf -- "$tree"; then
    echo "STOPPED: could not remove $tree, so its registration is left pointing at it"
    exit 1
  fi
  if ! rm -rf -- "$entry"; then
    echo "STOPPED: removed $tree but could not remove its registration $entry"
    exit 1
  fi
done < "$plan"

# THE REMOVAL COMES FIRST AND THE DROP SECOND, and the order is not a
# preference: `db:drop-worktree` REFUSES while a live worktree still owns the
# databases, by its branch or by its `.env` (ADR-0191), so run the other way
# round it drops nothing and says so in one sentence nobody reads.
if ! removal=$(orca worktree rm --worktree path:"$wt" --json 2>&1); then
  echo "STOPPED: orca worktree rm refused $wt -- $removal"
  echo "         databases left standing, since dropping them needs the worktree gone"
  exit 1
fi
echo "  removed      $wt"

# A PROVIDER WORKTREE HAS NO DATABASES, and that is asked of the checkout rather
# than inferred from its name: the question is whether the drop this script
# would run exists there at all. Every provider repo would otherwise need
# listing here, which is a fourth repository's maintenance burden.
# `python3` RATHER THAN A GREP, and it is not a new dependency: `gate.sh` beside
# this file already parses two JSON documents with it.
if MAIN="$main" python3 -c '
import json, os, sys
try:
    with open(os.path.join(os.environ["MAIN"], "package.json"), encoding="utf-8") as manifest:
        scripts = json.load(manifest).get("scripts") or {}
except Exception:
    sys.exit(1)
sys.exit(0 if "db:drop-worktree" in scripts else 1)
'; then
  if ! dropped=$(cd -- "$main" && pnpm db:drop-worktree "$branch" 2>&1); then
    echo "STOPPED: the worktree is gone but its databases are not -- $dropped"
    echo "         re-run: (cd $main && pnpm db:drop-worktree $branch)"
    exit 1
  fi
  printf '  %s\n' "$dropped" | sed 's/^  */  dropped      /'
else
  echo "  databases    none: $main has no db:drop-worktree"
fi

echo "RETIRED $wt"
