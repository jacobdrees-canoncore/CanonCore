---
status: accepted
---

# CMPP declares a `versions` array, and absence means the first version

A provider declares an ARRAY rather than a single number, so it can straddle two versions during a
transition — which turns a breaking change into a migration instead of a flag day.

The absence rule is the whole mechanism, and it is published: the W3C Reconciliation Service API,
already cited here for the reconcile/extend split, retrofitted versioning at v0.2 with exactly it —
absence there means 0.1, not 1 — and Jellyfin runs the same rule in code.

The spec contradicts itself on this and it is worth knowing which half to copy: its 1.0 draft lists
`versions` as required in the same breath as stating the absence rule. Take the prose, not the
schema. A "Version Negotiation" section was also landed and reverted in July 2026, so this is still
moving.

Never make the field required. Note that the W3C spec does not manage this cleanly itself — its
manifest JSON schema lists `versions` under `required`, so its prose infers 0.1 from absence while
its schema rejects absence. We take the prose rule and not the schema, because a required field
breaks every existing provider on the day it lands.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-standards.md`.

## As built, under CNCORE-6 and CNCORE-15

Both halves, which is what makes this one flippable at all: `provider-wiki` DECLARES `versions: [1]`,
and CanonCore's own reading of the manifest makes the field OPTIONAL with a default of `[1]`, so a
provider that says nothing is read as the first version rather than rejected.

Taking the prose and not the schema is therefore a line of code rather than an intention: the field
is not in any required list anywhere, and a manifest without it parses. The test that proves it
deletes `versions` from a real manifest and asserts the answer is `[1]`.

## An optional field does not move the version, under CNCORE-349

CNCORE-349 opened the record to keys the contract does not name, and made CanonCore read
`external_ids`. Neither moved `versions`. Nothing became required of a provider, so every provider
that conformed before conforms unchanged. That is the same test `credential` passed under ADR-0122.
