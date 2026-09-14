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

## As built, under CNCORE-173 — and this record's load-bearing half is now exercised

**THE FIRST DERIVED SOURCE IN THE PRODUCT.** Migration 1 seeded `derived` into `source_kinds` and
the `sources_derived_names_its_version` check into the table, and for sixteen rungs NOTHING EVER
TOOK A ROW OF THAT KIND. This record read `accepted` on the strength of a reference row and a
constraint guarding a door nobody had walked through. `derived:sort-name-v1` is the first, and the
version is in three places on purpose: the source's identity, the function's name (`sort_name_v1`),
and the rung that installs both.

**THE CONSTRAINT WAS ALREADY RIGHT, WHICH IS WORTH SAYING.** The first attempt to insert this source
used a bare `sort-name-v1` as the identity and the database refused it — `new row for relation
"sources" violates check constraint "sources_derived_names_its_version"`. A rule written a year of
rungs before its first user, and it held. `derived:palette-v2` in the paragraph above is the spelling
the check actually enforces (`^derived:.+$`), not an illustration.

**AND IMPLEMENTATION ADDED A RULE THIS RECORD DID NOT HAVE.** A derived value may never be the reason
an Item survives, because it exists only as a function of the claims it is computed from: when they
go it is a residue rather than evidence. That was found by a provider purge quietly keeping every
Item it should have taken, and it is written against the SOURCE KIND so the next computation
inherits it. [[0134-a-sort-name-is-derived-by-stripping-a-leading-article]] carries the whole of it.

**THE MECHANISM IS WHOLE; WHAT HAS NOT HAPPENED IS AN OCCASION TO USE IT.** This record's decision is
that the version rides in the identity, and it does — written by migration 17, enforced by the check,
and read back by `derive_sort_name`. The INVALIDATION it names as the only operation ever performed on
a derived claim needs a SECOND version to have something to invalidate, and there is one version. So
this stays `accepted` rather than dropping to `proposed`: nothing here is half-built, and an
unexercised consequence is not a missing half. Review raised the question, which is why the
distinction is written down rather than left to be re-argued.

**WHEN `sort-name-v2` ARRIVES the query is `sources.identity = 'derived:sort-name-v1'`, and that it is
obvious is the point** — it is the query a bare `derived` flag could not express, which is the whole
of what this record bought.
