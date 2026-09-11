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
