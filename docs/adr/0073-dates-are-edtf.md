---
status: accepted
---

# Dates are EDTF, and there is no precision column

A date value is stored as an Extended Date/Time Format string, and nothing else. EDTF is
Library-of-Congress-owned, current, and folded into ISO 8601-2019.

THIS HEADING SAID "with a precision column" until CNCORE-6, while the paragraph below it said the
opposite. The correction to the body had been made and had not reached the title, which is the half
of a correction that does the most damage: a reader scanning a list of records sees only headings.

NO SEPARATE PRECISION COLUMN. An earlier version of this record required one; EDTF encodes precision
itself, in the specification's own words — `1985-04-12` is "with day precision", `1985-04` "with
month precision", `1985` "with year precision". Those are exactly the three levels the column was
for, so it would have been a second source of truth for a fact the string already carries.

The alternative EDTF replaces is padding a partial date to the 1st of January, which sorts wrongly
and displays wrongly forever and cannot be undone, because the padding is indistinguishable from a
real value. **Re-measured against the LIVE wiki on 2026-09-13 (CNCORE-103): 12.41% of release
dates are partial — 1,374 of 11,073 `Release date` values on the 11,297 stories.** The archive that
the 12.39% (1,371 of 11,068) was taken from on 2026-09-10 no longer exists, and the two figures
agree to within a fortieth of a point, which is the wiki moving rather than either being wrong.
`Whispers of Terror (audio story)` at `1999-11` is what a partial one looks like.

A DERIVED sort key is legitimate where one is needed, because Level 1 qualifiers such as `1984?` and
`198X` break lexical ordering. Derived from the string, never written beside it.

Hard to reverse for the same reason ADR-0014 is: the sort key reads this, so changing the shape
later changes every sort and every display.

Related: ADR-0081.

## As built, under CNCORE-6, and checked under CNCORE-29

The import writes every release date the provider holds as one statement per date, CHECKED AS EDTF
ON THE WAY IN. Nothing pads and nothing picks: `2007-03` is stored as `2007-03` and rendered as
`2007-03`, which is the whole of this record at the only two points where a date currently exists.

THIS SECTION SAID "each as the EDTF string it arrived as" AND NOTHING CHECKED IT, which assumed what
it should have verified -- see the section below for what the check is and what it costs.

NO SORT KEY IS DERIVED YET, and that is this record's own conditional rather than a gap -- it says a
derived key is legitimate "where one is needed", and nothing sorts on a date. The first surface that
does is what builds it.

## The check at the door, under CNCORE-29

**THE GAP THIS RECORD DID NOT NAME, found reviewing CNCORE-7, IS CLOSED.** Nothing checked that an
arriving date was EDTF at all: the wire schema is `z.array(z.string())`, so a provider sending `soon`
or `12/03/66` had it stored as a `released` statement and rendered on the page verbatim. That made
"dates are EDTF" a description of what the catalogue WRITES rather than what it ACCEPTS.

ADR-0030's posture, copied rather than its mechanism: take it, mark it, do not silently treat it as
good. `statements.quarantined` (migration 6) is the mark. A date that is not EDTF is written as a
statement like any other, carrying the provider that said it, and the two readers that show a VALUE
skip it -- `findStatementsOfItem` and `winning_literal`, the same pair ADR-0075 names for the
tombstone. The mark and the tombstone are orthogonal for the reason `vocabulary_values` gives:
`deleted_at` says a source withdrew a claim, `quarantined` says the claim stands and the catalogue
cannot read it.

A THIRD READER OF `statements` IS DELIBERATELY UNCHANGED. `findAttributionOwed` joins the same table
to answer which notices a page owes, and it does NOT skip a quarantined row. Two reasons, and the
second is the one that decides it: an imported item always carries a `title` and an `external_id`
from the same provider, so no import can produce an item whose only live claim is quarantined -- and
where the question is a LICENCE, over-showing a notice costs nothing while under-showing one is the
breach. Named here because a sentence saying "both readers" would otherwise leave a third standing.

AND THE CHECK RUNS AT THE REFRESH, NOT ONLY AT THE INSERT. A provider re-asserting a value it
already holds does not rewrite the row, so a check that ran only on insert would never see it again;
`assertClaims` re-checks what it holds and marks what it must. That is also the only thing reaching
rows written BEFORE this slice, because migration 6 backfills nothing and cannot -- the check is an
EDTF parse and SQL has no such thing.

THIS SENTENCE SAID "MARKS WHAT IT MUST" AND THE REFRESH ALSO UNMARKS, since CNCORE-47. ADR-0015
leaves a validation rule editable, so a declaration can be LOOSENED as well as tightened -- and a
mark that could only ever be added would outlive the rule that justified it, leaving the catalogue
holding back values its own declaration now admits. The re-check answers both ways, at the same door
and for the same reason.

NEITHER REFUSED NOR DROPPED, and `browse` is why. Under `lookup` a bad date is one row an owner can
see and delete; the bulk path writes a container's worth at once, so refusing the import would cost a
category of sixty stories to save one field of one of them, and dropping the value would leave
nothing able to tell a provider that sends no date from one that sends rubbish. The import ANSWERS
WITH HOW MANY IT HELD BACK, because a mark alone is still silent: a browse that quarantined forty
dates would otherwise report exactly what a clean one reports.

**WHICH LEVELS THE CATALOGUE ACCEPTS: 0 AND 1.** This record names `1984?` and `198X` as real values,
so the check cannot be a date parse, and Level 1 is what admits them -- with seasons, open intervals
and letter-prefixed years alongside. LEVEL 2 IS REFUSED, which is a decision rather than a limit of
the parser: its sets and lists (`[1667,1668]`, `{1960..1964}`) say in one string what `released`
already says with two statements, since migration 1 gives that property `multiple` cardinality. Two
ways to state one fact, of which only the statement form can be counted, compared or sorted -- and
the derived sort key this record leaves to its first caller would have to grow a second branch for a
shape nothing has ever sent. A Level 2 string is quarantined rather than lost, so if a provider ever
sends one it is visible rather than gone.

THE CHECK IS A PARSE, NOT A PATTERN, and it is the `edtf` package's rather than ours. EDTF has levels,
intervals, qualification and unspecified digits; a regular expression over it looks finished long
before it is. Two things about that package are load-bearing and worth writing down.

ITS DEFAULT EXPORT IS NOT THE ENTRY POINT TO USE. `edtf()` tests `/^\d{5,}$/` against its input and
builds a date from it as Unix MILLISECONDS before the grammar runs, so `edtf("99999")` answers a date
in January 1970 and `edtf("20071301")` answers one too. The named `parse` export goes straight to the
grammar and refuses both.

AND THE INPUT IS BOUNDED BEFORE THE GRAMMAR SEES IT, at 64 characters. `edtf` parses with nearley,
whose cost climbs superlinearly, and a provider's string arrives unbounded -- the wire schema caps
neither the string nor the array -- and is parsed INSIDE the import's transaction. MEASURED against
the package: a braced list of repeated years costs 12.8 ms at 1,000 entries, 121 ms at 5,000 and
1,244 ms at 20,000, which is 100 KB and one field of one record on a path that carries a container's
worth. The ceiling is measured too: the longest form this catalogue accepts is 51 characters, a
date-time interval carrying both offsets. It costs one legal shape -- an EDTF letter-prefixed year is
unbounded in the specification, so `Y` and sixty digits is refused -- and that is quarantined rather
than lost, so a provider that ever sends one leaves a row saying so.

## What is NOT built, under CNCORE-29

NO SURFACE SHOWS AN OWNER WHAT WAS QUARANTINED. The rows are in the catalogue carrying the provider
that said them, and the import answers with a count, but nothing renders either -- there is no import
UI at all yet, so the count reaches a caller and stops there. Whatever first puts a screen in front of
an import owes the sentence that says one arrived.

A ROW NOBODY RE-IMPORTS IS NEVER REACHED. The refresh re-checks what a provider still claims, which
is what covers the absence of a backfill -- but only for records something imports again. A `released`
statement written before this slice, from a provider nothing ever calls a second time, stays unmarked
and readable. There is no sweep, because there is nothing to sweep yet; whatever first needs one owns
writing it.

AND ONLY `released` IS CHECKED, which is still true and is now a fact the CATALOGUE states. THIS
PARAGRAPH SAID THE CHECK WAS "NAMED AT THE CALL SITE THAT WRITES A DATE", AND IT IS NOT, SINCE
CNCORE-47: `released`'s own `validation` column declares `{"format": "edtf", "level": 1}` (migration
7) and `assertClaims` reads it. The reason given for not dispatching on `datatype` still holds
exactly as written -- `url` is a seeded datatype with no check, so a dispatch over datatypes would
read as though every one of them were guarded -- and it does not reach a dispatch over declarations,
because a property declaring `{}` says "nothing is checked" in the catalogue's own words. `image` is
therefore visibly unguarded rather than implied to be guarded, which is the property the call site
was protecting.

THAT LEFT "NOT IN `validation`" UNANSWERED, AND CNCORE-47 ANSWERED IT: THE COLUMN IS FILLED. ADR-0012
names validation among what the properties catalogue declares and makes "the metadata catalogue lives
in the DATABASE rather than in code" the test of the whole model, and the column was `{}` on every
row with nothing reading it. The executor stays in TypeScript because SQL cannot parse EDTF -- but so
does Shopify's, which runs a metafield definition's validations in code while the definition lives in
data; what moved is the DECLARATION, and with it the answer to "which properties are checked, and
how", which is now a query rather than a grep. `import.ts` no longer carries a TODO.

AND THE LEVEL MOVED WITH IT. `HIGHEST_LEVEL_ACCEPTED = 1` was a constant beside the parser, and the
argument for that 1 given above is a fact about `released` rather than about EDTF: its cardinality is
`multiple`, so a Level 2 set says in one string what two statements already say. A fact about a
property belongs to the property, so the ceiling is in the declaration and `isEdtfDate` takes it as
an argument. A date property whose cardinality were `single` could declare a different one without
the parser changing.

THE DERIVED SORT KEY IS STILL UNBUILT, unchanged by this slice and stated where it already was, in
the section above.

Left `accepted` throughout. The decision this record makes -- EDTF, no precision column, no padding --
was built and correct at every point where a date exists, and the check is now in front of it.

## Where the check lives, under CNCORE-47

The check itself is unchanged -- same parser, same levels, same bound, same posture towards a value
that fails it. What changed is that the catalogue DECLARES it rather than a call site naming it, and
the paragraphs above are corrected where they said otherwise rather than beside them. ADR-0012 is the
record that decides this and carries the reasoning; this one only stops describing a mechanism that
has moved.
