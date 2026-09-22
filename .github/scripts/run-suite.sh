#!/usr/bin/env bash
#
# ONE TURBO TASK, A COUNT THAT SAYS IT RAN, AND OPTIONALLY A ROLL CALL.
#
# `turbo run <task>` EXITS 0 HAVING RUN NOTHING. A root script that is gone, a
# task no package declares, or a task the FILTERED package no longer declares
# gives `Tasks: 0 successful, 0 total` and a WARNING on stderr that no green
# check reports -- so a suite that vanished turns its job green rather than red.
# ADR-0103 refuses `--passWithNoTests` per package for the same reason; this
# closes the same hole one level up.
#
# THAT THIRD ONE READ "a filter matching none" until CNCORE-191, and the two are
# opposites rather than the same case. A filter naming a package the workspace
# does NOT HAVE is refused: `x No package found with name '<name>' in
# workspace`, exit 1, and the job reddens on turbo's own status with nothing
# here involved. It is the package still being there and the SCRIPT being gone
# that exits 0, which is the ladder's shape -- `pnpm db:migrate` is
# `turbo run db:migrate -F @canoncore/db --`. Both measured on turbo 2.10.12,
# and `run-suite.test.ts` now drives each rather than restating them.
#
# WHAT IT CATCHES IS THE COUNT REACHING ZERO, AND NOT ONE PACKAGE OF MANY
# DROPPING ITS SCRIPT. `test:e2e`, `test:browser`, `test:contract` and `build`
# are declared by exactly ONE package each, so for those the two are one and the
# count is the whole answer. `test` is declared by ten, so deleting one leaves
# nine and this passes -- `packages/config/src/network-gate-wiring.test.ts` is
# what catches that, by holding every Vitest config on disk to being run by some
# suite. `typecheck` is declared by eleven and has the same shape;
# `packages/config/src/typecheck-wiring.test.ts` catches it there, by holding
# every package to turbo's plan for the task (CNCORE-197). Counted 2026-09-14
# and again 2026-09-15: test 10, typecheck 11, build 1.
#
# SO A COUNT IS NOT A ROLL CALL, and the second argument is the roll call
# (CNCORE-190). Name a package and its task has to appear among the ones turbo
# ran, which is what closes the case neither check above could: `packages/config`
# dropping its OWN `test` script, where the sweep that would catch it IS the
# suite that script runs. Measured, that read `Tasks: 9 successful` and a green
# job while every check this repository makes of its own CI was switched off.
#
# THE ROLL CALL IS HERE RATHER THAN IN A SUITE for the reason that case is
# special: a check cannot police the thing that decides whether it runs. This
# file is executed by the workflow step directly, so no `scripts` block reaches
# it. What a suite still owns is the other half -- that `ci.yml` names the
# package at all -- and `run-suite.test.ts` holds that, which it can, because
# deleting the argument leaves the suite running to notice.
#
# AND IT IS ASKED IN ONE PLACE ONLY, `test @canoncore/config`, WHICH IS THE WHOLE
# OF WHAT IT IS FOR RATHER THAN HALF OF IT. `typecheck` is declared by ELEVEN
# packages and gets the count alone here, so one of them dropping its script
# still leaves ten running and this script green -- the same hole in the same
# shape, and CNCORE-197 closed it somewhere else rather than by adding arguments:
# `packages/config/src/typecheck-wiring.test.ts` holds every package
# `pnpm-workspace.yaml` declares to appearing in turbo's plan for `typecheck`
# with a command to run.
#
# IT LIVES IN A SUITE BECAUSE IT CAN, which is what the paragraph above says the
# `test` roll call cannot do: a suite cannot police the script that decides
# whether it runs, and `typecheck` is not that script. So the red lands on the
# Test job, the way a deleted `test` script's already does. A roll call for a
# task that IS `test` would have to come back here.
#
# `build` IS NOT IN THAT LIST, and the reason is the one this file's header gives
# for `test:e2e`: it is declared by exactly ONE package, `web`, so the count
# reaching zero and the script being deleted are the same event. Counted
# 2026-09-14 rather than assumed -- the first version of this comment said
# eleven for both, which would have sent someone to close a hole that is not
# there.
#
# AND IT ASSUMES TURBO PRINTS THE TASK AT ALL. A task set to `outputLogs: "none"`
# in `turbo.json` is announced by neither shape, and the roll call would report a
# task that ran as missing. Nothing here sets it and nothing should, but it is
# the one config change that turns this check into a false red rather than a
# missed one.
#
# ONE FILE RATHER THAN A COPY PER JOB, and that is what makes the claim testable
# rather than merely stated: `packages/config/src/run-suite.test.ts` runs THIS
# script against a workspace with the test script and then without it, so the
# red is demonstrated instead of asserted (CNCORE-160).
#
# Usage: .github/scripts/run-suite.sh <turbo task> [package that must have run it] [-- arguments]

set -euo pipefail

task=${1:?run-suite.sh needs the name of a turbo task}
shift

# THE PACKAGE IS OPTIONAL, SO `--` IN ITS PLACE IS WHERE THE ARGUMENTS START
# rather than a package called that: read as one, the roll call below would ask
# for `--` and redden a run that was fine.
required=
if (($#)) && [[ $1 != -- ]]; then
  required=$1
  shift
fi

# ASSERTED RATHER THAN ASSUMED, for the reason `testing/turbo-dry-run.ts` gives
# about the same hazard: a name beginning with `-` reaches pnpm's argument
# parser as a FLAG rather than a script, which is a different command that can
# succeed and answer about something else.
if [[ ! $task =~ ^[a-z][a-z0-9:-]*$ ]]; then
  echo "::error::\`$task\` is not a turbo task name, and would reach pnpm as an argument."
  exit 2
fi

log=$(mktemp)
trap 'rm -f "$log"' EXIT

# THE LOG AS BOTH CHECKS BELOW READ IT: colour stripped, for the reason each
# gives. Written once because the two were the same `sed` twice, and a strip
# that got fixed in one of them is a check quietly reading something else.
stripped() { sed $'s/\033\[[0-9;]*m//g' "$log"; }

# `pipefail` is what keeps the suite's OWN failure fatal: `tee` succeeds
# whatever it is fed, so without it the pipeline reports tee's status and a
# failing suite reaches the count check as a pass.
#
# WHAT IS LEFT IS HANDED TO PNPM AS WRITTEN, THE `--` INCLUDED (CNCORE-343).
# pnpm keeps it, and it is the separator turbo needs to pass the rest on to the
# task, so `run-suite.sh test:e2e -- --exclude <file>` reaches Vitest as
# `--exclude <file>`. Measured on pnpm 12.3.4 and turbo 2.10.13. A root script
# already ending in `--`, as the `db:` ones do, would get a second one; nothing
# forwards to those.
pnpm "$task" "$@" 2>&1 | tee "$log"

# The count turbo prints, not the exit code it does not use.
#
# ANCHORED, because the log also holds every suite's own stdout and the decision
# is made off it: without the anchor, a test printing that sentence anywhere in
# a line satisfies the guard.
#
# THE ANCHOR IS NOT WHAT MAKES THE SUMMARY UNIQUE, THOUGH, and this said it was
# until CNCORE-191. The reasoning was that turbo prefixes a task's output with
# `<package>:<task>: ` so nothing else can start a line -- true when it STREAMS,
# false on GitHub Actions, where it groups instead and a task's lines are
# UNPREFIXED at column one. What actually closes it is the case this check is
# about: a run of zero tasks produces no task output at all, so in the one
# situation the guard has to be right about, there is nothing there to forge the
# line. The roll call below carries the measurement for both shapes.
#
# AND THE COLOUR IS STRIPPED FIRST. Turbo writes `Tasks:` plain when it is not
# on a terminal, which is every CI run, but wraps the count in SGR escapes when
# anything forces colour -- and neither the anchor nor `[1-9]` can match across
# one. Stripping costs nothing and takes the vendor's terminal detection out of
# the decision.
if ! stripped | grep -qE "^ *Tasks: +[1-9][0-9]* successful"; then
  echo "::error::pnpm $task ran no tasks at all. A green result here would mean nothing."
  exit 1
fi

[[ -n $required ]] || exit 0

# THE ROLL CALL, AND TURBO ANNOUNCES A TASK IN TWO DIFFERENT SHAPES.
#
# Everywhere but GitHub Actions it STREAMS, prefixing every line a task writes
# with `<package>:<task>: `. On GitHub Actions it detects the runner and switches
# to GROUPED output: a `::group::<package>:<task>` marker with the task's own
# lines UNPREFIXED inside it. Both are read here, because a guard that knew only
# the streamed shape passed every test on a laptop and failed on the runner --
# which is the one place it exists to work. Measured on turbo 2.10.12:
# `GITHUB_ACTIONS=true` is the switch and `CI=true` alone is not, and
# `run-suite.test.ts` pins both rather than inheriting whichever the host is.
#
# EITHER WAY, A PACKAGE THAT DECLARES NO SUCH SCRIPT CONTRIBUTES NEITHER -- so
# the announcement appearing is the package having run, and the count is free to
# stay non-zero on the strength of the others.
#
# THERE IS ALWAYS ONE TO FIND, which is what makes absence mean something: a
# task is announced with `cache miss, executing <hash>` or `cache hit, replaying
# logs <hash>` before it writes a word of its own, so a suite that runs and
# prints nothing is still present here. Measured cold and cached.
#
# MATCHED LITERALLY AND AT COLUMN ONE. Turbo prefixes NESTED output too, so a
# suite of its own that echoed this string would arrive as
# `<other>:<task>: <package>:<task>: ...` and satisfy an unanchored search. The
# group marker is compared WHOLE rather than by prefix, or `::group::one:test`
# would be answered for by a package called `one:testing`. The colour is
# stripped first for the reason the count check gives, and the escape sits
# BEFORE the `@` rather than inside the name, so the stripped line starts with
# the prefix exactly.
#
# AND IT READS TO THE END RATHER THAN STOPPING AT THE MATCH, which looks like
# waste and is the opposite. `exit` on the matching line closes the pipe under
# `sed`, which dies of SIGPIPE; `pipefail` at the top of this file then hands
# 141 to the `if`, and the guard reports the package it just FOUND as missing.
# A false red, and one that needs a log longer than a pipe buffer to appear at
# all -- it was live against this repository's real `pnpm test`, where the
# package announces itself around line 8 of some two hundred, and invisible in
# every short fixture. `run-suite.test.ts` holds a 20,000-line workspace over it.
if ! stripped |
  awk -v streamed="$required:$task: " -v grouped="::group::$required:$task" '
    { line = $0; sub(/[ \t\r]+$/, "", line) }
    index(line, streamed) == 1 || line == grouped { found = 1 }
    END { exit found ? 0 : 1 }
  '; then
  echo "::error::\`$required\` never ran \`$task\`, though other packages did. Its script is gone, and the count above cannot see that."
  exit 1
fi
