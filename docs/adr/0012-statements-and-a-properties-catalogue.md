---
status: accepted
---

# Field values are statements, governed by a properties catalogue

Every CLAIMED value and every relationship is a statement carrying property, value, source, rank,
language, confidence and observed_at. Two things are deliberately not claims and so are not
statements: artwork, which carries four attributes of its own and is a table (ADR-0038), and a
file's technical properties, which are measured off the bytes rather than asserted by anybody and so
have nothing to give provenance to (ADR-0042). A `properties` table declares each field's datatype,
value-kind, cardinality and validation -- all four in the DATABASE, since CNCORE-47, and all four
read. The validation declaration names a check and its parameters, and the code that RUNS it is
TypeScript, for the reason the section below gives.

Without that catalogue this design is `wp_postmeta`. The test separating a sound attribute model
from the antipattern is whether the metadata catalogue lives in the DATABASE rather than in code,
and Wikibase, Shopify metafields, the OpenMRS concept dictionary and Salesforce all have it.

## What can be pointed at, and what can carry statements

Addressable: items, editions, placements. Field-bearing via statements: items, editions,
placements. The two lists are the same three tables, and saying so once is what stops a fourth
being assumed into either.

Prefer a capabilities object over booleans on a property definition, so new capabilities land
without changing the definition's shape.

## Why value-kind sits on the definition rather than the row

Measured, not assumed: across the archive's 518,768 property rows, NO property is ever both a link
and a literal. Value-kind is therefore decidable from the property definition, and a per-row
value-kind column would be 518,768 copies of a fact the definition already carries.

## Consequences

Production EAV always grows a denormalised read side; OpenMRS let its observation table reach 27 million rows at PIH and around 260 million at AMPATH, at
which point each schema change took about an hour to RUN — five of them, which PIH could only afford
by running them online with pt-online-schema-change — and every serious deployment independently
built a flat ETL. Budget the projection as a first-class component.

## A rating carries its scale

A rating value carries `bestRating` and `worstRating` beside it — Schema.org's shape, whose sole
domain is `Rating` — so 4 out of 5 and 8 out of 10 can be compared. ADR-0026 reaches every connected
provider at once by design, so ratings arriving on different scales is the normal case rather than
the edge one, and a bare number is uninterpretable the moment a second provider answers.

## As built: validation is a DECLARATION, and the executor is code (CNCORE-47)

The sentence above names four things the catalogue declares. Three -- `datatype`, `value_kind`,
`cardinality` -- have been columns with reference tables behind them since migration 1. The fourth
was `jsonb('{}')` on every row, written by nothing and read by nothing, which is the shape of a
declared mechanism that does not exist. Migration 7 fills it: `released` declares
`{"format": "edtf", "level": 1}`, and the import reads the column instead of naming a callback at the
value it writes.

THE EXECUTOR STAYING IN CODE IS NOT THIS COLUMN FAILING THIS RECORD'S OWN TEST. SQL cannot parse
EDTF, and neither can Shopify's database run a metafield definition's regular expression nor
Wikibase's evaluate a property constraint -- both of which this record cites as systems that pass the
test. What lives in the data is the DECLARATION; the runner is code in every one of them. The test is
about whether the catalogue of fields is a table or a hardcoded list, and what the move buys is that
"which properties are checked, and how" is a QUERY rather than a grep.

`{}` IS A DECLARATION TOO, AND ITS CONTENT IS "NOTHING IS CHECKED". That is what makes dispatching on
this column honest where dispatching on `datatype` would not be. CNCORE-29 refused the datatype
dispatch because `url` is a seeded datatype with no check, so dispatching over datatypes would read
as though every datatype were guarded; a property declaring `{}` says the opposite out loud, so
`image` is visibly unguarded. ADR-0073 carries that correction in the paragraph that made it.

WHAT THE DATABASE CHECKS AND WHAT THE CODE CHECKS ARE DIFFERENT HALVES.
`properties_validation_declares_a_format` (migration 7) refuses anything that is not an object, and
refuses a non-empty object naming no `format` -- `jsonb` takes a scalar, an array and a null as
happily as an object, and this is the one declaration no foreign key can reach. The per-format shape
is parsed in `packages/db/src/validation.ts`, which REFUSES a declaration it cannot execute rather
than reading it as "no check": admitting everything would make the column decorative again, which is
the exact state this section exists to end.

`validation.test.ts` WALKS THE CATALOGUE THE MIGRATION LADDER BUILDS, so a format with no executor
fails in CI rather than at somebody's first import. THE GAP THAT LEAVES IS NAMED HERE RATHER THAN
CLAIMED AWAY: the constraint admits any string `format`, and ADR-0015 leaves validation editable, so
a declaration written OUTSIDE the ladder is bounded by neither. It would reach `declaredCheck` and
abort every import touching that property -- loudly, which is the intended failure, but at an import
rather than in CI. The two halves bound different sets, and the ladder is what closes the gap between
them, because only the product may write a property at all (ADR-0029) and it writes them there. A
constraint naming the executable formats would need a reference table `jsonb` cannot point at, and
would put that list in SQL as well as TypeScript -- a second drift surface to fix a first.

THE FIRST PROPERTY WAS WORTH IT AND THE ARGUMENT FOR WAITING WAS REAL. CNCORE-47 was filed saying the
move earns its keep at the SECOND property to need a check, and no second property has one: nothing
writes `image` yet. It was taken now because the alternative was to leave an accepted record naming a
declaration that did not exist, and because the rule genuinely belongs to the property rather than to
the door -- `assertClaims` is the only writer of statements today, and version one's stories 16 and
20 both add another, which cannot name a checker at a call site for a property it does not know.

## As built: the capabilities object holds something (CNCORE-74)

"Prefer a capabilities object over booleans on a property definition" was the same shape of
declared-but-absent mechanism `validation` was until CNCORE-47: `capabilities` was `jsonb('{}')` on
every row, written by nothing and read by nothing. Migration 12 fills it, and the FIRST capability
is two keys on one property rather than one, which is the argument for the object made by the thing
itself.

`note` declares `{"assertableBy": ["owner"], "public": false}` (ADR-0096). `assertableBy` names
which of ADR-0071's four source KINDS may assert a value of this property, and
`refuse_an_unadmitted_source` -- a trigger on `statements` -- reads it and refuses the rest.
`public` says whether the property's statements may travel on the public read path, and
`findStatementsOfItem` reads it, which is what makes ADR-0045's "no notes" a declaration rather than
a filter naming one property.

THE EXECUTOR IS IN THE DATABASE HERE AND IN TYPESCRIPT FOR `validation`, AND THAT IS THIS RECORD'S
OWN TEST APPLIED TWICE RATHER THAN ABANDONED. The section above says the runner is code because SQL
cannot parse EDTF, and names Shopify's regular expressions and Wikibase's property constraints as
the same case. SQL can compare a source kind against a list of them, so the reason does not reach
this capability -- and what decides it instead is migration 1's argument for the projection trigger:
a trigger cannot be forgotten, where an application-maintained rule is silently bypassed by anything
writing directly. What lives in the data is the DECLARATION either way, which is the sentence this
record is actually about.

`properties_capabilities_are_an_object` is the second constraint of
`properties_validation_declares_a_format`'s kind and exists for the same reason. It is DECLARED in
`schema/tables.ts` beside its sibling and migration 12's `ALTER` is GENERATED from that declaration,
which is ADR-0047's rule rather than a style: the schema and the head snapshot have to agree, so a
CHECK on a declared table is declared, and only the data statement and the trigger are hand-written
into the rung. Its content: `capabilities` is
`jsonb`, ADR-0015 leaves it editable, and no foreign key can reach inside it. It refuses a non-object,
an `assertableBy` that is not a non-empty array, and a `public` that is not a boolean -- the last
because `jsonb` would take the string `"false"` as happily as the boolean, which reads as truthy
wherever it is cast. What it CANNOT reach is whether each `assertableBy` string names a real source
kind, which is the same gap this record already names for `format` and bounded the same way: only the
product writes a property, and it writes them in the ladder (ADR-0029).

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-standards.md`, `docs/research/verify-adr-products.md`.
