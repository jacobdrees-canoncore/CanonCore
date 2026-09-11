---
status: accepted
---

# There are four source kinds, and `derived` is an identity

A value is asserted by a provider, the owner, a sidecar, or a derived computation. All four are
ranked in the one global source order.

`derived` names the computation AND ITS VERSION — `derived:palette-v2`, never a bare `derived`. That
is the load-bearing half: invalidating a computed claim when the algorithm changes is the only
operation ever performed on one, and a flag cannot answer "which rows does the new extractor
invalidate?". MARC 21 field 883's worked example, `deweyclassifierv0.1`, carries a version for exactly this
reason. Its first indicator has four values rather than three — `#` no information provided, `0`
fully machine-generated, `1` partially, `2` not machine-generated — and the `#` is the interesting
one, because it is the honest answer for a value whose origin was never recorded.

Widen the slot, do not add a column. PROV-O gives `prov:Agent` three subclasses — Person,
Organization, SoftwareAgent — so a program fills the same slot an organisation does, and Wikidata
puts "based on heuristic" and "inferred from" in the same reference slot as "stated in".

REFUSED: telling computations apart by naming convention inside the existing kinds. MusicBrainz is
the near example — it has a bot PRIVILEGE bit an admin sets, which gates voting and cross-origin
submission, but no per-EDIT marker, so provenance lives in the edit history rather than on the
value. The convention-only version of that is what we are refusing.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-standards.md`, `docs/research/verify-adr-products.md`.
