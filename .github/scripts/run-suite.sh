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
# AND NEITHER CATCHES `packages/config` DROPPING ITS OWN `test` SCRIPT, because
# that sweep is the suite that script runs: measured, `Tasks: 9 successful` and
# a green job. TODO(CNCORE-190), and ADR-0103 carries the measurement.
#
# ONE FILE RATHER THAN A COPY PER JOB, and that is what makes the claim testable
# rather than merely stated: `packages/config/src/run-suite.test.ts` runs THIS
# script against a workspace with the test script and then without it, so the
# red is demonstrated instead of asserted (CNCORE-160).
#
# Usage: .github/scripts/run-suite.sh <turbo task>

set -euo pipefail

task=${1:?run-suite.sh needs the name of a turbo task}

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
