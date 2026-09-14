#!/usr/bin/env bash
#
# ONE TURBO TASK, AND A COUNT THAT SAYS IT RAN.
#
# `turbo run <task>` EXITS 0 HAVING RUN NOTHING. A package that dropped the
# script, or a filter that matches none, gives `Tasks: 0 successful, 0 total`
# and a WARNING on stderr that no green check reports -- so deleting a suite
# turns its job green rather than red. ADR-0103 refuses `--passWithNoTests` per
# package for the same reason; this closes the same hole one level up.
#
# ONE FILE RATHER THAN A COPY PER JOB, and that is what makes the claim
# testable rather than merely stated: `packages/config/src/run-suite.test.ts`
# runs THIS script against a workspace with the test script and then without
# it, so the red is demonstrated instead of asserted (CNCORE-160).
#
# Usage: .github/scripts/run-suite.sh <turbo task>

set -euo pipefail

task=${1:?run-suite.sh needs the name of a turbo task}

log=$(mktemp)
trap 'rm -f "$log"' EXIT

# `pipefail` is what keeps the suite's OWN failure fatal: `tee` succeeds
# whatever it is fed, so without it the pipeline reports tee's status and a
# failing suite reaches the count check as a pass.
pnpm "$task" 2>&1 | tee "$log"

# The count turbo prints, not the exit code it does not use. `[1-9][0-9]*`
# rather than `[0-9]+` is the whole assertion: `0 successful` must not match.
if ! grep -qE "Tasks: +[1-9][0-9]* successful" "$log"; then
  echo "::error::pnpm $task ran no tasks at all. A green result here would mean nothing."
  exit 1
fi
