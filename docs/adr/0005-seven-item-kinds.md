---
status: accepted
---

# Seven item kinds, and finer typing is a statement

Items carry one of seven standards-derived kinds: work, person, organisation, place, time_span,
character, concept. Anything finer is a `category` statement.

A category statement can be sourced and disputed; a kind column cannot. Kind must also stay
single-valued and decidable, because keeping entities out of "what can I watch" surfaces depends
on it.

`time_span` is LRM-E11, a temporal extent with a beginning, an end and a duration.

**AN EARLIER VERSION OF THIS RECORD EARNED THAT SLOT WITH THE WRONG SHAPE**, and the correction is
worth keeping because the wrong shape is the more natural one to reach for. It argued that "stories
set in the Victorian era, in order" is the same shape as "the Doctors, in order". It is not: that
container's MEMBERS are works and the time span is its SUBJECT, which is the ordinary case and needs
no new kind at all. The entity argument runs the other way: entities must be items because they are
MEMBERS of ordered containers. That case is THIS record's own, and ADR-0077 leans on this record for
it rather than the other way about.

What actually earns the slot is ADDRESSABILITY, and it is one argument covering all six entity
kinds. A statement points AT a time span exactly as it points at a person or a place, and ADR-0012
makes items, editions and placements the only addressable things there are. A time span is neither
an edition nor a placement, so it is an item. It gets a kind of its own rather than falling into
`concept` because the seven are STANDARDS-DERIVED rather than chosen, and LRM-E11 is where the
standard puts a temporal extent.

Species go in `character`, because LRMoo F38 covers "fictional or iconographic individuals or groups
of individuals (including families)". `schema:Taxon` is "a set of organisms asserted to represent a
natural cohesive biological unit", drawn from bioschemas and pointing at a real-biology rank
ontology — wrong for a fictional species. That schema.org says "or fictional" on `Person` where it
means it and does not say it on `Taxon` is our inference rather than schema.org's statement.

CITE F38 CAREFULLY. It is gone from LRMoo v1.1.1 (Nov 2025) and it has NOT landed anywhere else:
CRMsoc has exactly one release, draft 0.1 of May 2019, whose own status line says it is "not meant
to support implementations". The citable source is LRMoo v1.0 §9.1 (April 2024), noted as
superseded. And F38 permits the species reading rather than requiring it — its own examples are
families and "The Knights of the Round Table", not species.

## Supersedes

There were eight kinds until `nomen` was removed. (For scale on why the list stays closed:
Jellyfin's `BaseItemKind` is at 37 values, and its own source explains why — "This enum is generated
from all classes that inherit from `BaseItem`", so the enum grows whenever the class hierarchy
does.) LRM-E9 defines a nomen as "an association between
an entity and a designation that refers to it", which is precisely what a statement already is — a
property, a value, a source, a rank and a language, every part disputable. A kind for it was a
second mechanism for the job the central one exists to do.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-standards.md`.
