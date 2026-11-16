"""Fail a CI job whose real steps ran past its budget in seconds (CC-422).

A job's `timeout-minutes` is whole minutes and only catches a hang, so each job starts a clock
before its real steps (`echo "BUDGET_START=$(date +%s)" >> "$GITHUB_ENV"`) and ends with
`python3 .github/scripts/budget.py <seconds>`. GitHub's clock is whole seconds, so a reading is
good to about 1 s. Why each budget is what it is: docs/research/ci-speed-2026-11-16.md.
"""

import os
import sys
import time

budget = int(sys.argv[1])
start = os.environ.get("BUDGET_START", "")
if not start.isdigit():
    print("::error::BUDGET_START is not set, so the real steps went unmeasured. Start the clock"
          ' before them: echo "BUDGET_START=$(date +%s)" >> "$GITHUB_ENV"')
    sys.exit(1)
elapsed = int(time.time()) - int(start)
if elapsed > budget:
    print(f"::error::The real steps took {elapsed} s, past this job's budget {budget} s.")
    sys.exit(1)
print(f"The real steps took {elapsed} s, within this job's budget {budget} s.")
