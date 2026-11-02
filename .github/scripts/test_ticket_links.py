"""The CI guard against a PR closing a ticket it only mentions, ported from Extractor (EXT-49).

Linear closes a ticket on merge when its id is in the PR's branch name or title, or follows a
closing magic word in the body (linear.app/docs/github). These run the guard as CI does: a process
reading the PR from its environment. Run with `python3 -m unittest discover -s .github/scripts`.
"""

import os
import subprocess
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).parent / "ticket_links.py"


def guard(*, branch="jacobdrees/cc-49", title="Do a thing", body="Fixes CC-49", labels="", team="CC"):
    env = {**os.environ, "BRANCH": branch, "TITLE": title, "BODY": body, "LABELS": labels,
           "TEAM_KEY": team}
    return subprocess.run([sys.executable, str(SCRIPT)], env=env, capture_output=True, text=True)


class TicketLinks(unittest.TestCase):
    def test_a_title_naming_another_ticket_fails(self):
        run = guard(title="Release CC-35 and CC-36")
        self.assertEqual(run.returncode, 1)
        self.assertIn("CC-35", run.stdout)
        self.assertIn("CC-36", run.stdout)
        self.assertIn("::error", run.stdout)

    def test_a_pr_naming_only_its_own_ticket_passes(self):
        run = guard(title="Guard the title (CC-49)", body="Fixes CC-49")
        self.assertEqual((run.returncode, run.stdout), (0, ""))

    def test_a_body_closing_another_ticket_fails(self):
        run = guard(body="Fixes CC-49\n\nAlso resolves CC-12.")
        self.assertEqual(run.returncode, 1)
        self.assertIn("CC-12", run.stdout)

    def test_part_of_and_bare_mentions_pass(self):
        run = guard(body="Fixes CC-49\n\nThe other half is CC-34.\n\nPart of CC-29")
        self.assertEqual((run.returncode, run.stdout), (0, ""))

    def test_an_audit_pr_saying_only_part_of_passes(self):
        # An audit's branch leaves its id out and its PR says "Part of" (docs/agents/issue-tracker.md).
        run = guard(branch="jacobdrees/audit-brink-round-2", title="Audit: Brink's look, round 2",
                    body="Part of CC-217")
        self.assertEqual((run.returncode, run.stdout), (0, ""))

    def test_every_ticket_one_closing_word_lists_is_caught(self):
        run = guard(body="Fixes CC-49, CC-12 and https://linear.app/jacobrees-canoncore/issue/CC-13/a-title")
        self.assertEqual(run.returncode, 1)
        self.assertIn("CC-12, CC-13", run.stdout)

    def test_a_branch_whose_ticket_the_body_does_not_close_fails(self):
        run = guard(branch="docs/hold-cc-29-rest", body="Pause the rest of CC-29.")
        self.assertEqual(run.returncode, 1)
        self.assertIn("CC-29", run.stdout)

    def test_the_override_label_lets_a_pr_close_what_it_names(self):
        run = guard(title="Release CC-35", labels="dependencies,closes-what-it-names")
        self.assertEqual((run.returncode, run.stdout), (0, ""))

    def test_a_failure_names_the_override_label(self):
        self.assertIn("closes-what-it-names", guard(title="Release CC-35").stdout)

    def test_a_closing_list_with_an_oxford_comma_or_markdown_is_caught(self):
        run = guard(body="Fixes CC-49, CC-12, and CC-13\n\nCloses **CC-14**, `CC-15` and (CC-16)")
        self.assertEqual(run.returncode, 1)
        self.assertIn("CC-12, CC-13, CC-14, CC-15, CC-16", run.stdout)

    def test_the_team_key_comes_from_configuration(self):
        # Another team's ids are not this repository's tickets, and its own key is read from TEAM_KEY.
        self.assertEqual(guard(title="Release EXT-35").returncode, 0)
        run = guard(branch="x", title="Release EXT-35", body="", team="EXT")
        self.assertEqual(run.returncode, 1)
        self.assertIn("EXT-35", run.stdout)


if __name__ == "__main__":
    unittest.main()
