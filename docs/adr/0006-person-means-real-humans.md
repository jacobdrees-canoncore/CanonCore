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
