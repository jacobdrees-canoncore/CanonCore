---
status: proposed
---

# `person` means real humans only

Fictional people are `character`; only real humans are `person`.

The reason is ours, not the standards'. It is what lets the model say a person PORTRAYED a
character, and merging the two kinds destroys that relation.

An earlier version claimed this was "the one point all four standards agree on". It is not.
IFLA LRM-E7, CIDOC CRM E21 and LRMoo F38 do restrict themselves to real people, but **schema.org
does not**: `schema:Person` is defined as "A person (alive, dead, undead, or **fictional**)", and
`schema:character` ranges over it. Since schema.org is one of the standards this model derives from,
the appeal to unanimity was false — the decision stands on its own merit instead.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-standards.md`.

## As built, under CNCORE-4 — and this record stays PROPOSED

**BUILT: both kinds, and the relation that needs them apart.** `person` and `character` are two of
ADR-0005's seven seeded `item_kinds`, and migration 1 seeds `portrayed_by` with `reference_target`
frozen to `person` — which the migration's own comment calls out as "what carries the
person/character distinction, which is why it is on the seeded list at all".

**NOT BUILT: the enforcement, and any writer of either kind.** `reference_target` is DECLARED and
frozen (ADR-0015), never checked: the only constraint on it is that a property with a literal value
has none, and nothing validates a statement's value item against the kinds its property names. So
the catalogue would today accept a `character` as the value of `portrayed_by` without complaint,
and the distinction this record makes is a documented intention rather than a shape the database
holds. Nothing writes either kind either — the importer writes `kind: "work"` and nothing else — so
no person, no character and no portrayal has ever been recorded outside a test fixture.

**WHICH IS WHY THE DECISION STILL MATTERS RATHER THAN LESS.** Nothing has been written under the
wrong reading yet, so correcting the standards claim above costs nothing today and would cost a
migration later.
