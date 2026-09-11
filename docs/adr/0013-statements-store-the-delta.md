---
status: accepted
---

# Statements store the delta, not versioned rows

Keeping what a provider said and when it changed could be done by versioning whole items. It is
not: a statement records only what changed, with who said it and when.

Row-versioning duplicates every unchanged field on every save. This is also the bridge to
Datomic, which is a quad — entity, attribute, value, transaction time — and it is why a
statement's identity genuinely requires authorship, time and source rather than merely carrying
them.

## Evidence

The Datomic comparison is an argument rather than a lookup, and was not put to Datomic's own documentation in the 2026-09-10 verification pass. Treat it as reasoning, not as a cited fact.
