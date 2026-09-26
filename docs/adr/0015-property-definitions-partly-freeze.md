---
status: accepted
---

# A property's datatype and reference target freeze at creation

Datatype and reference target are fixed once a property exists; required, cardinality, range,
options and validation stay editable. (VALIDATION WAS MISSING FROM THIS LIST until CNCORE-47, which
is when the column first held anything; the section at the foot of this record says what editing one
costs.)

Four of five systems studied converged on that split. The one that did not, Magento, silently DELETES every scoped value when an attribute's scope is
NARROWED TO GLOBAL — Store View to Website is safe — with no confirmation and no reverse. The
narrower trigger makes it worse rather than better as a warning: it fires on the change nobody
expects to be destructive. Tightening a rule never rejects existing rows either — it marks the property as having
offenders and lets you list them, which is Shopify's validation-status field and is what makes
"start loose, tighten later" survivable.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-products.md`.

## What is seeded, and why the list is short

NINE properties at migration 1, and the count is exact because the list is: `category`,
`portrayed_by`, `appears_in`, `based_on`, `created_by`, `credited_to`, `released`, `part_of`,
and `image` -- which migration 25 DELETED under CNCORE-358, so eight of the nine stand. `image`
declared a picture to be a Statement holding a URL, which ADR-0038 refuses and ADR-0037 replaces
with stored bytes, and nothing ever wrote it. Everything else enters when a screen or an import
actually needs it. (An earlier version said "roughly a dozen" over the same nine names, which is a
loose count on a list that freezes.)

Adding one later is an INSERT, not a migration — but its targets and value-kinds freeze on that
first insert, so a speculative property is a freeze event with nothing behind it. That is what makes
a short list the safe one.

`portrayed_by` is on the list because it carries the person/character distinction ADR-0006 exists to
protect.

## As built, under CNCORE-4: the count is ELEVEN, not nine -- and TEN since CNCORE-358

The list above is nine and this record said the count was exact. Implementation
made it eleven, and migration 25 took `image` back out, so ten of migration 1's
seeds stand. The two extra are not scope creep: ADR-0014 makes `title`
and `sort_name` columns that PROJECT STATEMENTS, so the statements they project
need properties to hang on. Without them migration 1 cannot satisfy ADR-0014 at
all.

Read the original nine for what they are -- the RELATIONSHIP and enrichment
properties, whose reference targets freeze and therefore had to be got right
before anything wrote one. `title` and `sort_name` are literals with no target
to freeze, which is why they were not on a list about freezing and why adding
them costs nothing.

The freeze itself is ENFORCED rather than intended, by a trigger on `properties`
that refuses a change to `datatype`, `value_kind` or `reference_target` after
creation. `cardinality` stays editable, and a test tightens it and puts it back.

TIGHTENING MUST NOT TRAP THE ROWS IT MARKS, AND CNCORE-74 IS WHERE THAT WAS NEARLY LOST. This
record's "tightening a rule never rejects existing rows" was written about `validation`, whose
offenders are marked by `quarantined` at the next refresh. `capabilities` arrived with an enforcement
in the DATABASE (ADR-0096), and its first trigger re-checked the declaration on every `UPDATE` of a
statement -- so narrowing `assertableBy` made the rows already written by a no-longer-admitted source
impossible to WITHDRAW, and their items impossible to DELETE. The sentence above holds for any
editable declaration, and what it requires of an enforcement is that it be re-checked ONLY where the
thing it declares about is changing: `BEFORE INSERT OR UPDATE OF "source_id", "property_id"`, never
a bare `UPDATE`.

THE CATALOGUE IS TWELVE PROPERTIES SINCE, and every change is this record's own rule working
rather than the count drifting: "everything else enters when a screen or an import actually needs
it". Migration 3 added `external_id` for the importer (CNCORE-28), migration 12 added `note` for
the owner's own words (ADR-0096, CNCORE-74), and migration 25 deleted `image`, which nothing had
needed (CNCORE-358). `packages/db/src/artwork.test.ts` names the twelve. Eleven remains the count of
what MIGRATION 1 seeded and ten of those stand, which is what the paragraph above is about -- the
properties whose reference targets froze before anything could write one.

`reference_target` is an ARRAY. A single column cannot express `created_by`,
which ADR-0070 targets at a person while `published_by` targets an organisation
-- but the general case is a property legitimately pointing at more than one
kind. It may also be null, meaning the target is open: ADR-0016's `category`
genuinely points at any kind of item, and freezing it as a list of all seven
would be a freeze on a fact nobody has.

## A VALIDATION RULE DOES NOT FREEZE (CNCORE-47)

`validation` is on the editable side, with `required`, `cardinality`, `range` and `options`, and the
freeze trigger does not name it. That is this record's own finding applied rather than an exception
to it: the research above says tightening a rule "never rejects existing rows either -- it marks the
property as having offenders and lets you list them, which is Shopify's validation-status field and
is what makes 'start loose, tighten later' survivable".

THIS CATALOGUE ALREADY HAD THE OFFENDER MARK BEFORE IT HAD THE RULE. `statements.quarantined`
(migration 6) says the claim stands and the catalogue cannot read it, and `assertClaims` re-checks
what a provider still claims at every refresh. So tightening a declaration marks the rows that no
longer pass, at the next refresh, and leaves them in the catalogue carrying the provider that said
them. Nothing is rejected and nothing is deleted.

AND LOOSENING RELEASES THEM AGAIN, which is the half that makes "editable" true rather than asserted.
A mark that could only ever be ADDED would outlive the rule that justified it: loosen `released` and
the catalogue would go on holding back values its own declaration now admits, with nothing saying
why. The re-check answers both ways at the same door.

WHAT IT COSTS, SAID PLAINLY. A rule that can be loosened is a rule rows were already admitted under,
so "this value passed the check" is only ever a statement about the rule in force when it was last
looked at. The refresh is what reaches a row, and ADR-0073 names the gap that leaves: a statement from
a provider nothing ever calls a second time is never re-checked at all. That is the same gap
tightening already had, and it is unchanged rather than introduced here.

NOTHING SWEEPS, and nothing can from SQL -- the check is an EDTF parse. Whatever first needs a sweep
owns writing it, which is ADR-0073's sentence and is repeated here because the loosening direction
makes it easier to want one.
