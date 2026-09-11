---
status: proposed
---

# Standards first, then hard data as the stress test

The schema comes from industry standards. Take the standard first, build the model from it, then
throw hard real data at it and see what breaks. Where it breaks, decide whether the standard has a
gap or whether the distinction belongs in DATA rather than in the schema.

Never the other way round. A decision justified only by "this dataset does it this way" needs
re-examining against a standard.

Standards in play, with the versions checked on 2026-09-10: IFLA LRM, LRMoo 1.1.1 (Nov 2025),
BIBFRAME vocabulary 3.0.1 (2025-12-03), Schema.org, Dublin Core, PROV-O, OAI-ORE, IIIF Presentation
3.0, Wikibase, and CIDOC CRM 7.4 (Aug 2026) where LRMoo defers to it. Versions are named because
these move: LRMoo F38 has since migrated out to CRMsoc and is gone from 1.1.1.

This is recorded first among the decisions it governs because it is the one that settles arguments,
and because every other record here is downstream of it. Where a standard genuinely has no answer, the gap is named rather than papered over — and where
one was CLAIMED and turned out not to exist, that is corrected rather than quietly kept. The
fictional-author gap was one of those: schema:Person explicitly admits fictional persons, so the
standards permitted what we thought they forbade.

## The register of deliberate divergences

Where this model knowingly departs from the standards above, the departure is recorded HERE, as a
list, so it can be read as a list. That is the mechanism "the gap is named rather than papered over"
depends on — a divergence nobody can enumerate has not been named, it has been mentioned.

- ADR-0011 — one edition level collapses LRM's Expression and Manifestation.
  No standard makes that particular collapse; BIBFRAME merged Work and Expression instead, which is
  the opposite pair.
- ADR-0002 — `Item` names the abstract thing. IFLA LRM and BIBFRAME
  both use it for the file.
- ADR-0009 — per-placement ordering combines OAI-ORE's Proxy with IIIF's
  `behavior:"sequence"`; no standard in play gives both in one construct.
- ADR-0005 — species are `character`, not `schema:Taxon`.
- ADR-0063 — medium is a playback medium, closed at four values, and not
  a taxonomy of works.
- ADR-0004 — containers fold into `work` rather than taking a class of their own.
- ADR-0006 — `person` excludes fictional people, where `schema:Person` explicitly admits them.
- ADR-0034 — the outbound boundary splits by who supplied the URL, where OWASP files deny-lists
  under "Last Resort" and prefers a single allow-list.
- ADR-0070 — `created_by` and `credited_to` are two properties, where the standards permit one.

ADR-0016 is NOT on this list: `category` taking an item rather than a literal departs from no
standard, and an earlier version of this register included it. That version also omitted the four
above — which defeats the point, since a register that cannot be trusted to be complete is a mention
rather than a naming. Add to this list when a new record diverges; ADR-0011 already closes by
pointing at it.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-standards.md`.
