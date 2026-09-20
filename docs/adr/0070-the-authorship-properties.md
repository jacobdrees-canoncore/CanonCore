---
status: proposed
---

# `created_by` is a person; `credited_to` is a character

`created_by` takes a `person` and names who actually made the thing. `credited_to` takes a
`character` and names the stated in-universe author. `published_by` and `broadcast_by` take an
`organisation`, added by INSERT when something first needs them.

They must not share a property. Three genuinely published books in one demo group are credited to
Newt Scamander, Kennilworthy Whisp and Beedle the Bard, and all three are by Rowling.

THE STANDARDS GAP THIS WAS ORIGINALLY ARGUED FROM DOES NOT EXIST, and the record should say so.
`schema:Person` is "A person (alive, dead, undead, or **fictional**)", so `schema:author` can point
at a fictional author perfectly well. CIDOC CRM goes further: `E74 Group`, a subclass of P14's range
`E39 Actor`, states that "A joint pseudonym ... used as a persona by two or more people is a
particular case of E74 Group", and names **Betty Crocker** and **Ellery Queen**. Only `E21 Person`
excludes personae. IFLA LRM handles the single-author persona as a nomen cluster.

So the standards would permit one property. We split anyway, for a reason of ours: "who wrote this"
must have exactly ONE answer. In a single field the real and the stated author compete on rank, a
fictional author can win, and the question stops being answerable. That is a product decision and it
is stronger for being argued as one.

An organisation is not a `created_by` either. **Re-measured against the LIVE wiki on 2026-09-13
(CNCORE-103): the wiki states 11,095 `Writer` credits across 9,278 of its 11,297 stories**, which
are people, alongside `Publisher` and `Network` credits, which are companies — as DIFFERENT ROLES
rather than one role pointing at two kinds of thing. The archive's 11,089, taken 2026-09-10, is six
credits away and the archive no longer exists.

THE PUBLISHER AND NETWORK COUNTS ARE NOT RESTATED. They were measured corpus-wide and the live
re-derivation covers the story population, so quoting the old pair beside a new `Writer` figure
would put three numbers from two populations in one sentence. What this decision turns on is that
the two KINDS of credit are distinct roles, and that is unchanged.

Reference targets freeze at creation, so these are set on the first insert.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-standards.md`. **The archive is deleted (ADR-0129) and every figure above was re-derived from the LIVE wiki on 2026-09-13 by `provider-wiki`'s `pnpm measure:live`.** The archive-era working is `docs/research/verify-new-adrs-archive.md`, which stays as the frozen record it is: it describes a corpus taken 2026-09-04, not the wiki.

## As built, under CNCORE-4 — and this record stays PROPOSED

**BUILT: both properties, split as this record requires, with their targets frozen.** Migration 1
seeds `created_by` with `reference_target` `person` and `credited_to` with `character`, and
ADR-0015 freezes that target — so the split is a shape the catalogue cannot later collapse by
accident, which is the one thing this decision most needed to be true early.

**NOT BUILT: any write of either, and the kinds they point at.** Nothing in the product writes a
`created_by` or a `credited_to` statement. The importer refuses the only source of them it has:
`import.ts` lists writers among what is DELIBERATELY NOT IMPORTED, and it writes every item as
`kind: "work"`, so no `person` and no `character` item has ever been created outside a test
fixture. The three books credited to Newt Scamander, Kennilworthy Whisp and Beedle the Bard — the
case this record turns on, and the reason the two properties may not share one — cannot be written
down today.

**THE `Writer` FIGURES ABOVE COUNT THE WIKI, NEVER THIS CATALOGUE.** 11,095 credits across 9,278
stories is what the source holds and what makes the distinction worth deciding; none of them has
been imported, and this section is here so the measurement is not read as a description of the
catalogue's contents.
