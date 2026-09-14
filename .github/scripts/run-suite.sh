#!/usr/bin/env bash
#
# ONE TURBO TASK, AND A COUNT THAT SAYS IT RAN.
#
# `turbo run <task>` EXITS 0 HAVING RUN NOTHING. A root script that is gone, a
# task no package declares, or a filter matching none gives `Tasks: 0
# successful, 0 total` and a WARNING on stderr that no green check reports -- so
# a suite that vanished turns its job green rather than red. ADR-0103 refuses
# `--passWithNoTests` per package for the same reason; this closes the same hole
# one level up.
#
# WHAT IT CATCHES IS THE COUNT REACHING ZERO, AND NOT ONE PACKAGE OF MANY
# DROPPING ITS SCRIPT. `test:e2e`, `test:browser` and `test:contract` are
# declared by exactly one package each, so for those the two are one.
# `test` is declared by ten, so deleting one leaves nine and this passes --
# `packages/config/src/network-gate-wiring.test.ts` is what catches that, by
# holding every Vitest config on disk to being run by some suite.
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
# ONE FILE RATHER THAN A COPY PER JOB, and that is what makes the claim testable
# rather than merely stated: `packages/config/src/run-suite.test.ts` runs THIS
# script against a workspace with the test script and then without it, so the
# red is demonstrated instead of asserted (CNCORE-160).
#
# Usage: .github/scripts/run-suite.sh <turbo task> [package that must have run it]

set -euo pipefail

task=${1:?run-suite.sh needs the name of a turbo task}
required=${2-}

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

# `pipefail` is what keeps the suite's OWN failure fatal: `tee` succeeds
# whatever it is fed, so without it the pipeline reports tee's status and a
# failing suite reaches the count check as a pass.
pnpm "$task" 2>&1 | tee "$log"

# The count turbo prints, not the exit code it does not use.
#
# ANCHORED, because the log also holds every suite's own stdout and the decision
# is made off it. Turbo prefixes a task's output with `<package>:<task>: `, so
# the summary is the only line that can start with `Tasks:` -- without the
# anchor a test printing that sentence satisfies the guard.
#
# AND THE COLOUR IS STRIPPED FIRST. Turbo writes `Tasks:` plain when it is not
# on a terminal, which is every CI run, but wraps the count in SGR escapes when
# anything forces colour -- and neither the anchor nor `[1-9]` can match across
# one. Stripping costs nothing and takes the vendor's terminal detection out of
# the decision.
if ! sed $'s/\033\[[0-9;]*m//g' "$log" | grep -qE "^ *Tasks: +[1-9][0-9]* successful"; then
  echo "::error::pnpm $task ran no tasks at all. A green result here would mean nothing."
  exit 1
fi

[[ -n $required ]] || exit 0

# THE ROLL CALL. Turbo prefixes every line a task writes with
# `<package>:<task>: `, and a package that declares no such script contributes
# no line at all -- so the prefix appearing is the package having run, and the
# count is free to stay non-zero on the strength of the others.
#
# THERE IS ALWAYS A LINE TO FIND, which is what makes absence mean something: a
# task is announced with `cache miss, executing <hash>` or `cache hit, replaying
# logs <hash>` under that same prefix before it writes a word of its own, so a
# suite that runs and prints nothing is still present here. Measured on turbo
# 2.10.12, cold and cached.
#
# MATCHED LITERALLY AND AT COLUMN ONE. Turbo prefixes NESTED output too, so a
# suite of its own that echoed this string would arrive as
# `<other>:<task>: <package>:<task>: ...` and satisfy an unanchored search. The
# colour is stripped first for the reason the count check gives, and the escape
# sits BEFORE the `@` rather than inside the name, so the stripped line starts
# with the prefix exactly.
if ! sed $'s/\033\[[0-9;]*m//g' "$log" |
  awk -v prefix="$required:$task: " 'index($0, prefix) == 1 { found = 1; exit } END { exit found ? 0 : 1 }'; then
  echo "::error::\`$required\` never ran \`$task\`, though other packages did. Its script is gone, and the count above cannot see that."
  exit 1
fi
