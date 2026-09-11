---
status: proposed
---

# Grow the system in vertical slices, not model-first

Each slice cuts a narrow but complete path through schema, API, screen and tests, and is demoable
on its own. The first slice renders a real page.

This reverses "build the full model, then render". Across ten comparable self-hosted projects none
had a finished data model up front, and the forensic record on this product's own previous attempts
is sharper: they died two to four weeks in, four of five within a week of their highest-output day,
and an artefact revealing total cost preceded the death every time. A model built whole before
anything renders is that artefact.

Migration 1 carries only what was individually TESTED as unretrofittable: statements and the
properties catalogue, title and sort_name as projections, aliases, placements with their sources and
rank, the migration ladder's rules, the raw uniqueness constraint, and a merge stamping its id.
Everything else arrives on the slice that needs it, as an ordinary additive migration.

The operational conclusion, which is the part that gets forgotten under pressure: WHEN AN AUDIT SAYS
THE REMAINING WORK IS LARGER THAN EXPECTED, THE ANSWER IS TO CUT SCOPE INSIDE THIS REPOSITORY. Never
to start another one. Starting again is what the forensic record above is a record OF.

## Supersedes

An earlier decision read "build the full model, then render", and was recorded at the time as taken
against the evidence. It is named here so the reversal is visible as a reversal: the model-first
position was held deliberately, for months, and lost to the forensic record rather than to taste.

## Evidence

The ten-project finding comes from `docs/research/build-order/`. The forensic record of this product's own previous attempts is self-reported rather than externally verifiable, and stays in the private repository rather than travelling to the public one ([[0114-the-public-repository-is-a-fresh-one]]).

## A slice split across two pull requests -- under CNCORE-77

**THE RULE ABOVE SAYS "DEMOABLE ON ITS OWN", AND CNCORE-77 IS NOT.** It gives the CMPP client
`search` and a fan-out across several providers, and it renders nothing: no procedure, no screen,
and its only caller is a test. CNCORE-68 is the page. Read against the opening sentence that is a
departure, and it is recorded here rather than argued in the ticket, because a rule with an
unwritten exception is one the next agent rejects a good ticket on.

**WHAT MAKES IT A SPLIT RATHER THAN A RETURN TO MODEL-FIRST.** The failure this record is a record
of is building a MODEL nobody can see, judged finished by its author, against an artefact revealing
total cost. The test that separates the two is not whether one pull request renders: it is whether
the thing that renders is ALREADY SPECIFIED AND ALREADY NEXT. CNCORE-68 existed, with its
acceptance criteria written, before CNCORE-77 was cut out of it; the tracker carries the blocking
edge; and the half landing first is the smaller one. Nothing here was built in the hope that a
surface would later want it.

**SO THE PERMISSION IS NARROW, AND THE NARROWNESS IS THE POINT.** A slice may land as two pull
requests when the second is specified, blocked on the first, and next. It may not land as one pull
request plus an intention. The difference is checkable by anyone reading the tracker, which is what
stops this becoming the exception that swallows the rule -- and a library with no specified caller
is exactly the artefact the opening sentence is defending against.

**WHAT IT BUYS is a diff a reviewer can actually hold.** The alternative was one ticket across five
packages: the client, a schema, a procedure, a page and its tests, with the protocol decisions and
the rendering decisions in one review. The `?q=` reading alone took a decision at two levels; it
would have arrived alongside a page, and the page is what a reviewer looks at.
