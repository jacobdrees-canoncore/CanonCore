"""The step that fails a CI job whose real steps ran past the job's budget (CC-422).

A job writes BUDGET_START (epoch seconds) to $GITHUB_ENV before its real steps and ends with
`budget.py <seconds>`. These run it as CI does: a process reading its environment. Run with
`python3 -m unittest discover -s .github/scripts`.
"""

import os
import subprocess
import sys
import time
import unittest
from pathlib import Path

SCRIPT = Path(__file__).parent / "budget.py"


def check(budget, *, started_ago=None):
    env = {k: v for k, v in os.environ.items() if k != "BUDGET_START"}
    if started_ago is not None:
        env["BUDGET_START"] = str(int(time.time()) - started_ago)
    return subprocess.run([sys.executable, str(SCRIPT), str(budget)], env=env,
                          capture_output=True, text=True)


class Budget(unittest.TestCase):
    def test_real_steps_past_the_budget_fail_the_job(self):
        run = check(5, started_ago=12)
        self.assertEqual(run.returncode, 1)
        self.assertIn("::error", run.stdout)
        self.assertIn("budget 5 s", run.stdout)

    def test_real_steps_within_the_budget_pass_and_say_how_long_they_took(self):
        run = check(30, started_ago=12)
        self.assertEqual(run.returncode, 0)
        self.assertNotIn("::error", run.stdout)
        self.assertRegex(run.stdout, r"took 1[23] s, within this job's budget 30 s")

    def test_a_job_that_never_started_the_clock_fails_rather_than_passing_unmeasured(self):
        run = check(30)
        self.assertEqual(run.returncode, 1)
        self.assertIn("::error", run.stdout)
        self.assertIn("BUDGET_START", run.stdout)


if __name__ == "__main__":
    unittest.main()
