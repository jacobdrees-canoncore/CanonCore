"""Fail a PR that would close a ticket it only mentions.

Linear closes a ticket on merge when its id is in the PR's branch name or title, or follows one of
its closing magic words in the body (linear.app/docs/github). A bare mention in the body, or one after a
non-closing word such as "Part of", links nothing and closes nothing.
"""

import os
import re
import sys

# The tracker's team key, from the workflow's configuration (`TEAM_KEY`), so the same script serves
# any repository on any Linear team.
TEAM_KEY = os.environ["TEAM_KEY"]
TEAM = re.escape(TEAM_KEY)
ID = re.compile(rf"\b{TEAM}-(\d+)\b", re.IGNORECASE)
# Linear's closing magic words, as linear.app/docs/github lists them. One word may close several
# issues ("Fixes CC-1, CC-2 and CC-3"), each an id or an issue URL.
CLOSING = "|".join(
    ["close", "closes", "closed", "closing", "fix", "fixes", "fixed", "fixing"]
    + ["resolve", "resolves", "resolved", "resolving", "complete", "completes", "completed"]
    + ["completing", "implement", "implements", "implemented", "implementing", r"linear\s+issue"]
)
# Markdown may wrap an id ("**CC-12**", "`CC-12`", "(CC-12)"); a guard matches at least as
# broadly as Linear does.
ISSUE = rf"[*_`(\[]*(?:\S*/issue/)?{TEAM}-\d+(?:/[^\s,]*)?[*_`)\]]*"
CLOSES = re.compile(
    rf"\b(?:{CLOSING})\b:?\s+({ISSUE}(?:\s*(?:,\s*and\b|,|\band\b|&)\s*{ISSUE})*)",
    re.IGNORECASE,
)

# A PR carrying this label closes whatever it names, deliberately.
OVERRIDE = "closes-what-it-names"


def ids(text):
    return {f"{TEAM_KEY}-{n}" for n in ID.findall(text)}


branch = ids(os.environ["BRANCH"])
title = ids(os.environ["TITLE"])
body = ids(" ".join(CLOSES.findall(os.environ["BODY"])))


def names(tickets):
    return ", ".join(sorted(tickets, key=lambda ticket: int(ID.search(ticket)[1])))


# The one ticket this PR closes is the one its branch names, declared with a closing word in the
# body ("Fixes CC-12"), so each place Linear reads a closing link says the same thing.
errors = []
if len(branch) > 1:
    errors.append(f"the branch names {names(branch)}; a PR closes one ticket.")
if branch - body:
    errors.append(
        f"the branch names {names(branch)}, which this PR's merge would close, but the body never"
        f" says so: write \"Fixes {names(branch)}\", or keep the id out of the branch."
    )
for where, named in (("the title", title), ("a closing word in the body", body)):
    if named - branch:
        errors.append(f"{where} names {names(named - branch)}, which this PR's merge would close.")
if OVERRIDE in os.environ["LABELS"].split(","):
    sys.exit(0)
for error in errors:
    print(f"::error::{error}")
if errors:
    print(f"::error::When the merge is meant to close every ticket named, label the PR {OVERRIDE}.")
sys.exit(1 if errors else 0)
