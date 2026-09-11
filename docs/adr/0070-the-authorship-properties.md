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

An organisation is not a `created_by` either. The archive records 11,089 Writer credits, which are
people, alongside 8,212 Publisher and 851 Network credits, which are companies — as DIFFERENT ROLES
rather than one role pointing at two kinds of thing.

Reference targets freeze at creation, so these are set on the first insert.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-standards.md`. Archive figures measured against `~/tardis-pipeline` directly.
