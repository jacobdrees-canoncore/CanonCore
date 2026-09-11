---
status: proposed
---

# No release-cadence rule in the specification

Release cadence is the survival variable for a project like this one, and the specification
still does not carry a rule about it. That is a choice, not an oversight, and this record
exists so it is not "fixed" by someone who finds the evidence later and assumes nobody saw it.

## Context

Ten comparable self-hosted projects were studied. The control case is Ubooquity: it shipped
2.1.2 on 2018-10-11 and went quiet. Komga was created 2019-08-08 and Kavita 2020-12-12, both
inside that gap, and Kavita's maintainer states it exists "due to Ubooquity not having
metadata". Ubooquity came back — 3.0 beta in 2023, stable in 2025 — and **the userbase did not
return.** Readarr is archived at 3,471 stars; Sick Beard's final commit reads "Officially
sunset the repo" at 2,855.

What ends a solo self-hosted project is not the maintainer quitting. It is a gap long enough
for someone else to ship, and the transfer is permanent.

There are therefore **two** failure modes, and they are different:

- **Internal**, from this product's own history: attempts die at two to four weeks, within days
  of an artefact revealing total cost. Over-scoping kills.
- **External**, from this research: going quiet long enough for someone else to ship kills, and
  it does not recover.

Both point the same way — ship small, ship often.

A supporting fact was also declined: awesome-selfhosted will not list a project until its first
release is four months old, and its rejection text states the count "initiates only after a
release has been created", so a delayed first tag directly delays discovery. First-commit-to-first-tag ranged from 4 to 39 days for MOST of the ten, though not all — Navidrome
took 1,434 days — and the release notes are uniformly slight: Komga's first was "First release,
support for `cbr` and `cbz` archives"; Karakeep's and Audiobookshelf's were empty.

## Decision

No cadence rule goes in the specification. The specification is a scope document, and a cadence
rule is the one thing that would be about TIME rather than about the product. An earlier
decision dropped the version ladder for exactly that reason.

## Consequences

The evidence is strong and the rule is still absent, so the absence has to be recorded or it
reads as a gap. A cadence is not a plan: it does not measure remaining surface area, so it does
not trigger the internal failure mode, while directly preventing the external one. Putting it
in the specification would start it measuring, which is the thing it warns against.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-products.md`.
