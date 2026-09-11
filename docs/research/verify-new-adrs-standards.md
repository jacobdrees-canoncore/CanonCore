# Verification: formal-standards claims in the newer ADRs

Every claim about a published standard made in ADR 0005, 0012, 0073, 0077, 0080, 0082, 0090, 0091
and `docs/physical-schema.md`, checked against the standards body's own text. All lookups performed
2026-09-10. No verdict below rests on a blog post, a wiki summary, or on recall.

Verdicts: **CONFIRMED** (URL, section, exact quote, source date), **CONTRADICTED** (what the owner
actually says), **UNFOUNDED** (no support located; what would settle it), **JUDGEMENT** (a defensible
reading rather than a fact the owner states).

**10 claims put to their owner: 6 CONFIRMED, 2 CONTRADICTED, 0 UNFOUNDED, 2 JUDGEMENT.** Two further
records in the reading list carry no formal-standards claim at all and are recorded as such.

### A note on loc.gov access

`www.loc.gov` and `id.loc.gov` served a Cloudflare interactive bot challenge to every client tried on
2026-09-10: `curl` with a browser user-agent (HTTP 403), `WebFetch` (HTTP 403), and the Orca/Electron
browser (challenge page persisted through a checkbox click, a reload, and a 25-second wait; Ray IDs
`a38e4bbb0e52777f`, `a38e4c5eaab3777f`, `a38e5292fb83777f`). The Library of Congress documents below
were therefore read through the Internet Archive's capture of the Library's own pages. That is the
LoC's own document text, not a third-party summary, and each entry gives both the canonical URL and
the snapshot date actually read.

---

## Claim 1 — EDTF, and whether a precision column is needed alongside it

**Claim (ADR 0073, title and body):** "Dates are EDTF with a precision column." "A date value is
stored as an Extended Date/Time Format string alongside a precision column saying what it actually
resolves to: year, year-month, or day."

**Owner:** Network Development and MARC Standards Office, Library of Congress.

**Source:** *Extended Date/Time Format (EDTF) Specification*, spec dated **February 4, 2019**.
Canonical: <https://www.loc.gov/standards/datetime/>. Read via
<https://web.archive.org/web/20260902134658/https://www.loc.gov/standards/datetime/> (snapshot
2026-09-02).

Also *EDTF — Background*, canonical <https://www.loc.gov/standards/datetime/background.html>, page
dated **January 28, 2022**, read via
<https://web.archive.org/web/20260902134658/https://www.loc.gov/standards/datetime/background.html>.

### 1a. EDTF is a real, current specification — CONFIRMED

Background page:

> "The Extended Date/Time Format (EDTF) was created by the Library of Congress with the participation
> and support of the bibliographic community as well as communities with related interests."

> "EDTF functionality has now been integrated into ISO 8601-2019, the latest revision of ISO 8601,
> published in March 2019."

Spec page, *Compliance*:

> "Three conformance levels are defined: level 0, level 1, and level 2. Level 0 specifies features of
> ISO 8601-1; Levels 1 and 2 specify features described ISO 8601-2."

Status: the LoC specification of 4 February 2019 is the current one, and it is a profile of ISO 8601
parts 1 and 2 rather than a competing format. The 2012 draft is explicitly superseded and withdrawn
("The draft specification is no longer publicly, readily available, because its availability has
caused confusion with the official version"). Choosing EDTF for partial dates is sound.

### 1b. EDTF expresses the precision levels the ADR names — CONFIRMED

Spec page, *Level 0 → Date*, verbatim:

> "complete representation: [year]["-"][month]["-"][day]
> Example 1 '1985-04-12' refers to the calendar date 1985 April 12th **with day precision**.
> reduced precision for year and month: [year]["-"][month]
> Example 2 '1985-04' refers to the calendar month 1985 April **with month precision**.
> reduced precision for year: [year]
> Example 3 '1985' refers to the calendar year 1985 **with year precision**."

The three levels the ADR wants a column for — year, year-month, day — are exactly EDTF Level 0's
three Date forms, and the specification labels each one with the word "precision" itself.

### 1c. The separate precision column is redundant — CONTRADICTED

The ADR asserts that both an EDTF string and a precision column are needed. The owner's own text
shows the string *is* the precision statement. `1985`, `1985-04` and `1985-04-12` are three distinct
values in the format, and the specification's gloss on each is "with year precision", "with month
precision", "with day precision" respectively. There is nothing left for a second column to say.

A separately-written precision column is therefore a second source of truth for a fact the value
already carries, and can disagree with it. The ADR's own stated reason for EDTF — that padding is bad
because "the padding is indistinguishable from a real value" — is an argument that the *format*
solves the problem, not that a column is needed beside it.

Two caveats, both of which point at a derived column rather than a stored one:

- EDTF Level 1 adds forms where precision is not a function of string length: `1985-XX-XX` is
  labelled by the spec as "(day precision)" and `201X` as "(year precision)". Precision is still
  fully determined by the string, but by a parser rather than by `length()`.
- Lexical ordering of Level 0 strings happens to be chronological for positive four-digit years, but
  Level 1 qualifiers (`1984?`, `2004-06~`, `198X`) break that.

So a `GENERATED ALWAYS AS (...) STORED` column derived from the EDTF string, for sorting and
indexing, is defensible. A hand-written precision column carrying the same fact twice is not, and
that is what the ADR as written specifies.

**Wording defensible, reasoning wrong:** the decision (EDTF, never pad) survives intact and is
well-supported. The title and mechanism ("with a precision column ... saying what it actually
resolves to") assert a need the owner's own text refutes.

---

## Claim 2 — BCP 47 subsumes script into the tag; the form `ar-latn`

**Claim (ADR 0090):** "Language tags are BCP 47 rather than ISO 639-3, because BCP 47 subsumes script
into the tag (`ar-latn`), so a third axis costs nothing."

**Owner:** IETF. *RFC 5646, Tags for Identifying Languages*, Best Current Practice, **September
2009** (BCP 47). <https://www.rfc-editor.org/rfc/rfc5646.txt> (fetched 2026-09-10).

### 2a. Script is a subtag of the language tag — CONFIRMED

Section 2.1, *Syntax*:

> `langtag = language ["-" script] ["-" region] *("-" variant) *("-" extension) ["-" privateuse]`

Section 2.2.3, *Script Subtag*:

> "Script subtags are used to indicate the script or writing system variations that distinguish the
> written forms of a language or its dialects."

> "1. Script subtags MUST follow any primary and extended language subtags and MUST precede any other
> type of subtag."

> "2. Script subtags consist of four letters and were defined according to the assignments found in
> [ISO15924]"

> "4. There MUST be at most one script subtag in a language tag, and the script subtag SHOULD be
> omitted when it adds no distinguishing value to the tag or when the primary or extended language
> subtag's record in the subtag registry includes a 'Suppress-Script' field listing the applicable
> script subtag.
> For example: "sr-Latn" represents Serbian written using the Latin script."

Confirmed: a BCP 47 tag carries script inside itself, so a separate script column is not needed. The
ADR's reason for preferring BCP 47 over ISO 639-3 is exactly right.

### 2b. `ar-Latn` is the correct form; `ar-latn` is valid but non-preferred — JUDGEMENT

Section 2.1.1, *Formatting of Language Tags*:

> "At all times, language tags and their subtags, including private use and extensions, are to be
> treated as case insensitive: there exist conventions for the capitalization of some of the subtags,
> but these MUST NOT be taken to carry meaning.
> Thus, the tag "mn-Cyrl-MN" is not distinct from "MN-cYRL-mn" or "mN-cYrL-Mn" (or any other
> combination), and each of these variations conveys the same meaning"

> "Although case distinctions do not carry meaning in language tags, consistent formatting and
> presentation of language tags will aid users. The format of subtags in the registry is RECOMMENDED
> as the form to use in language tags."

> "[ISO15924] recommends that script codes use lowercase with the initial letter capitalized ('Cyrl'
> Cyrillic)."

Section 3.1.4, *Subtag and Tag Fields*:

> "Subtags whose 'Type' field is 'script' (in other words, subtags defined by ISO 15924) MUST use
> titlecase."

So `ar-latn` is a *valid and equivalent* tag — it is not an error — but `ar-Latn` is the RECOMMENDED
presentation form, and titlecase is what the IANA registry mandates for its own records.

The tag is also substantively well-chosen. IANA Language Subtag Registry, File-Date **2026-08-08**,
<https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry> (fetched
2026-09-10):

```
Type: language
Subtag: ar
Description: Arabic
Added: 2005-10-16
Suppress-Script: Arab
Scope: macrolanguage
```

`ar` suppresses `Arab`, so `ar-Latn` genuinely adds distinguishing value (Arabic in Latin script) and
is not a redundant subtag under rule 4. The example is a good one.

**Note on where the lowercase came from:** the ADR did not invent `ar-latn`. It is a verbatim lift
from IIIF Presentation 3.0 §4.4 (see Claim 4), which itself writes it lowercase. If the ADR is
edited, `ar-Latn` is the form to prefer, and the lowercase spelling should be attributed to IIIF if
retained.

---

## Claim 3 — MusicBrainz and IIIF both carry script as its own field

**Claim (ADR 0090):** "MusicBrainz and IIIF both carry script as its own field, which is the cost
avoided."

### 3a. MusicBrainz — CONFIRMED

**Owner:** MusicBrainz. *Release*, <https://musicbrainz.org/doc/Release> (fetched 2026-09-10).

> **Language:** "The language the release title and track titles are written in. The possible values
> are taken from the ISO 639-3 standard."
>
> **Script:** "The script used to write the release title and track titles. The possible values are
> taken from the ISO 15924 standard."

Two separate fields, exactly as the ADR says. And note *why*: MusicBrainz uses ISO 639-3 for
language, which cannot express script, so it must carry ISO 15924 in a second field. That is
precisely the cost the ADR says BCP 47 avoids. This half of the claim does not merely hold, it is the
strongest evidence for the decision.

### 3b. IIIF — CONTRADICTED

**Owner:** IIIF Consortium. *Presentation API 3.0*, This Version: 3.0.0, copyright 2012-2026.
<https://iiif.io/api/presentation/3.0/> (fetched 2026-09-10).

IIIF Presentation 3.0 does **not** define a script property. A whole-document search for the word
"script" returns four occurrences: the word "script" in a prose sentence about a film director's
commentary, two occurrences in §4.5 about stripping `<script>` tags to prevent injection, and this
one, in §4.4 — which states the opposite of the ADR's claim:

> "Note that BCP 47 allows the script of the text to be included after a hyphen, such as `ar-latn`,
> and clients should be aware of this possibility."

The spec's own worked example in §4.5 uses the language map key `en-latn`, i.e. script inside the
BCP 47 tag, in a language field. IIIF took the decision CanonCore is taking, for the reason CanonCore
gives.

**Wording defensible, reasoning wrong.** The DECISION (BCP 47, script inside the tag, no third axis)
is correct and IIIF supports it. The stated JUSTIFICATION cites IIIF as an example of the cost being
avoided when IIIF is in fact an example of avoiding that cost the same way. As written the sentence
tells a reader the reverse of what the spec says.

Suggested correction, if the ADR is edited: MusicBrainz carries script as its own field because it
uses ISO 639-3; IIIF, which uses BCP 47, does not need to and explicitly notes that script rides
inside the tag.

---

## Claim 4 — IIIF Presentation 3.0 §4.4 is the source of `none`

**Claim (ADR 0090):** "Unknown is the value `none`, never an absent one. IIIF Presentation 3.0 section
4.4 is the literal source of that spelling."

**Owner:** IIIF Consortium. *Presentation API 3.0*, This Version 3.0.0, Latest Stable Version 3.0.0,
Previous Version 2.1.1; copyright 2012-2026. <https://iiif.io/api/presentation/3.0/> (fetched
2026-09-10).

**Section number and title — CONFIRMED.** Section **4.4** is titled **"Language of Property Values"**,
confirmed in both the table of contents and the body heading.

**Treatment of `none` — CONFIRMED**, verbatim from §4.4:

> "The values of these properties must be JSON objects, with the keys being the BCP 47 language code
> for the language, or if the language is either not known or the string does not have a language,
> then the key must be the string `none`."

The example given in the spec:

```json
{ "label": { "en": [...], "fr": [...], "none": [ "Whistler (1871)" ] } }
```

And in the display algorithm:

> "If all of the values are associated with the `none` key, the client must display all of those
> values."

Two details worth carrying into implementation, both stronger than the ADR states:

1. `none` is a **`must`**, not a convention: "then the key _must_ be the string `none`". The ADR's
   "never an absent one" is faithful.
2. `none` covers **two** cases in IIIF, not one: "the language is either not known **or** the string
   does not have a language". A catalogue number or a bare date has no language; that is not the same
   as an unknown language, and IIIF deliberately collapses them. ADR 0090 says only "Unknown". The
   spelling is right; the scope is slightly narrower in the ADR than in the source.

---

## Claim 5 — Schema.org's shape for a rating carrying its scale

**Claim (ADR 0080):** "A rating value carries `bestRating` and `worstRating` beside it, which is
Schema.org's shape."

**Owner:** Schema.org. Pages fetched 2026-09-10.

**CONFIRMED.**

<https://schema.org/Rating>:

> "A rating is an evaluation on a numeric scale, such as 1 to 5 stars."

<https://schema.org/bestRating>:

> "The highest value allowed in this rating system."
> Values expected to be one of these types: Number, Text.
> Used on these types: **Rating**.

<https://schema.org/worstRating>:

> "The lowest value allowed in this rating system."
> Values expected to be one of these types: Number, Text.
> Used on these types: **Rating**.

Both property names exist, both are spelled as the ADR spells them, both have `Rating` as their sole
domain, and both sit alongside `ratingValue` ("The rating for the content"). `AggregateRating` is a
subtype of `Rating` and so inherits them, which matters because provider ratings are aggregates.

The ADR's purpose — comparing 4/5 with 8/10 — is exactly what the two properties are for: "the
highest value allowed in **this rating system**" is a per-rating scale declaration, not a global one.
Claim holds without qualification.

---

## Claim 6 — MARC 21 field 883 is per-field provenance with process, confidence, date, validity end

**Claim (`docs/physical-schema.md`, statements row):** "Shaped like MARC 21 field 883."
Statements row: `(... source, observed_at, rank, confidence NULL, valid_until NULL, ...)`.

**Owner:** Network Development and MARC Standards Office, Library of Congress. *MARC 21 Format for
Bibliographic Data: 883 — Metadata Provenance*, page revision **May 2020**. Canonical:
<https://www.loc.gov/marc/bibliographic/bd883.html>. Read via
<https://web.archive.org/web/20250913212704/https://www.loc.gov/marc/bibliographic/bd883.html>
(snapshot 2025-09-13).

**CONFIRMED on all four subfields, and on the per-field scope.**

Field definition and scope:

> "Used to provide information about the provenance of metadata in data fields in the record. Field
> 883 contains a link to the field to which it pertains."

Per-field: confirmed. The link is `$8` (Field link and sequence number).

The four data elements the claim names:

| Claim | MARC 21 | LoC's own words |
| --- | --- | --- |
| creation process | **`$a` Creation process** (NR) | "Identifies the process used to produce the data contained in the linked field. The subfield may contain a process name or some other description." |
| confidence value 0..1 | **`$c` Confidence value** (NR) | "Describes the confidence of the agency using the process/activity identified in subfield $a to generate the linked field. The subfield contains a floating point value between 0 and 1. Either a comma or a point may be used as a decimal marker. 0 means no confidence and and 1 means full confidence." |
| creation date | **`$d` Creation date** (NR) | "Date on which the linked field was created. This also serves as the beginning of the period of validity. Date is recorded in the format yyyymmdd in accordance with ISO 8601, Representation of Dates and Times." |
| validity end date | **`$x` Validity end date** (NR) | "Date representing expected end of period of validity for the data in the linked field. Date is recorded in the format yyyymmdd in accordance with ISO 8601, Representation of Dates and Times." |

All four exist, all four are named exactly as claimed. The field's full subfield list is `$a $c $d $q
$x $u $w $0 $1 $8`.

Two corrections/notes worth having, neither of which contradicts the schema doc as written:

1. **The field is no longer called "Machine-generated Metadata Provenance".** Content Designator
   History: "Field 883 - Machine-generated Metadata Provenance [NEW, 2012]"; "Field 883 - Metadata
   Provenance [RENAMED, 2020] Field 883 was renamed to allow the recording of non-machine-generated
   content." Likewise `$a` was renamed from "Generation process" to "Creation process" and `$d` from
   "Generation date" to "Creation date" in 2020. The claim as put to me used the current (2020+)
   names throughout, which is right. Any older phrasing elsewhere in the repo is stale.
2. **`$d` is dual-purpose.** LoC: creation date "also serves as the beginning of the period of
   validity". So the pair `$d`/`$x` is a validity interval, not a creation timestamp plus an
   unrelated expiry. If `observed_at` in the statements row is intended as "when we saw this", it is
   doing `$d`'s job only if `valid_until` is read as the close of the same interval.

### JUDGEMENT: "shaped like" is a loose analogy on the linking mechanism

MARC 883 is a *separate field* that points at the field it describes, one 883 per described field
occurrence. CanonCore's statements row puts `source`, `confidence`, `valid_until` and `observed_at`
as **columns on the statement itself**. The four data elements line up exactly; the indirection does
not. That is almost certainly the better choice for this design — the statement is already the unit
of provenance, so a second linked row would be a needless join — but "shaped like MARC 21 field 883"
should be read as "carries the same four provenance facts as", not "structured the same way as".
Nothing in the repo depends on the stronger reading.

---

## Claim 7 — `time_span` corresponds to LRM-E11

**Claim (ADR 0005):** "`time_span` is LRM-E11, a temporal extent with a beginning, an end and a
duration."

**Owner:** IFLA. *IFLA Library Reference Model: A Conceptual Model for Bibliographic Information*,
Riva, Le Bœuf and Žumer, August 2017, as amended and corrected through **December 2017**.
<https://www.ifla.org/files/assets/cataloguing/frbr-lrm/ifla-lrm-august-2017_rev201712.pdf> (fetched
2026-09-10, 101pp).

**CONFIRMED**, near-verbatim. Table 4.2 Entities:

| ID | Entity | Definition | Constraints |
| --- | --- | --- | --- |
| LRM-E11 | Time-span | "A temporal extent having a beginning, an end and a duration" | Superclass: res |

The ADR's "with a beginning, an end and a duration" differs from the source's "having" by one word
and no meaning. Entity number and definition both correct.

The scope note is directly relevant to Claim 1 and worth recording here:

> "In library implementations, the instances of time-span considered useful in bibliographic or
> authority data are often expressed in years (year of birth of a person, year of death of a person,
> year a corporate body ceased to exist, year of publication of a manifestation), even though the
> associated event took place during only a portion of the year.
> The information available to the cataloguer, or the inherent characteristics of the time-span being
> identified, will be reflected in the **degree of precision** used in recording of a temporal
> extent. For example, '14th century' may be sufficiently precise in recording the beginning of the
> Renaissance, while a decade may be more appropriate when identifying the beginning of a musical
> style.
> **Dates serve as the appellations or nomens for time-spans** in different calendar or time-keeping
> systems."

Two things follow. The 12%-of-release-dates-are-partial figure in ADR 0073 is what the model expects,
not an anomaly. And LRM treats a date as the *nomen* of a time-span — which is consistent with
ADR 0005 removing `nomen` as a kind and making designation a statement.

**Bonus, same source — the LRM-E9 quote in ADR 0005's *Supersedes* section is also CONFIRMED.**
Table 4.2, LRM-E9 Nomen, Definition: "An association between an entity and a designation that refers
to it". ADR 0005 quotes this exactly.

*Caveat on edition:* IFLA issued a further errata integration in July 2024. The copy read here is the
December 2017 amended text. The E9 and E11 definitions are core entity definitions and are not among
the kinds of thing errata typically touch, but the July 2024 issue is the one to cite if the ADR ever
needs a precise edition.

---

## Claim 8 — LRMoo F38 covers "individuals or groups of individuals", and has migrated out of LRMoo 1.1.1 into CRMsoc

**Claim (ADR 0005):** "Species go in `character`, because LRMoo F38 covers 'individuals OR GROUPS of
individuals'. ... Note that F38 has since migrated out of LRMoo 1.1.1 into CRMsoc (ADR-0059), so this
citation has moved and will not be found where it was."

**Owner:** CIDOC CRM Special Interest Group / IFLA LRMoo Working Group.

### 8a. F38's scope note says "individuals or groups of individuals" — CONFIRMED

**Source:** *LRMoo: object-oriented definition and mapping from the IFLA Library Reference Model*,
Version 1.0, **April 2024**, approved by the CIDOC CRM SIG.
<https://cidoc-crm.org/sites/default/files/LRMoo_V1.0.pdf> (fetched 2026-09-10), §9.1, p.65:

> **F38 Character**
> Subclass of: E28 Conceptual Object
> Scope note: "This class comprises fictional or iconographic **individuals or groups of individuals**
> (including families) appearing in works in a way relevant as subjects. Characters may be purely
> fictitious or based on real persons or groups, but as characters they may exhibit properties that
> would be inconsistent with a real person or group. Rather than merging characters with real
> persons, they should be described as disjoint, but related entities."
> Examples: "Harry Potter [in J. K. Rowling's series of novels and the films based on them]";
> "Sinuhe the Egyptian [in Mika Waltari's novel]"; "The Knights of the Round Table [in fiction]"
> Properties: R57 is based on (is basis for): E39 Actor; R58 has fictional member (is fictional
> member of): F38 Character

The quoted phrase is exact. Note also `R58 has fictional member`, whose scope note reads: "This
property associates an instance of F38 Character representing a group with another instance of F38
Character that is presented in relevant fiction as a member of the fictional group." The model
explicitly anticipates a group-Character containing member-Characters.

### 8b. F38 is gone from LRMoo v1.1.1 — CONFIRMED

**Source:** *Classes & Properties Declarations of LRMoo version: 1.1.1*,
<https://cidoc-crm.org/extensions/lrmoo/html/LRMoo_v1.1.1.html> (fetched 2026-09-10). The page states:
"LRMoo version: 1.1.1 was released on November, 2025 and is available at:
https://cidoc-crm.org/lrmoo/ModelVersion/version-1.1.1. It includes references to the following
external models: Cidoc-CRM v7.1.3".

The complete class list in v1.1.1:

> F1 Work, F2 Expression, F3 Manifestation, F5 Item, F11 Corporate Body, F12 Nomen, F18 Serial Work,
> F27 Work Creation, F28 Expression Creation, F30 Manifestation Creation, F31 Performance, F32 Item
> Production Event, F33 Reproduction Event, F36 Script Conversion, F39 Family, F55 Collective Agent

**F38 is absent.** So are F51 Pursuit and F52 Name Use Activity, the other two classes LRMoo v1.0 §9
listed as bound for CRMsoc. The string "CRMsoc" does not appear on the v1.1.1 declarations page at
all — the transitional section is gone, not renamed.

**Version confirmation:** <https://cidoc-crm.org/lrmoo/fm_releases> (fetched 2026-09-10) lists v1.1.1
(November 2025) as "Official (IFLA)" — "A revised and complete community version of the compatible
model fully approved by IFLA" — and it is the latest. v1.0 (May 2024) is the previous official
release. (Note: <https://cidoc-crm.org/lrmoo> still says "The first official release, 1.0, of LRMoo
was fully approved in April 2024" and does not mention 1.1.1; the releases table is the current one.)

Both halves of the ADR's claim hold. The ADR's warning that "this citation has moved and will not be
found where it was" is correct and useful.

### 8c. What the correct current citation is — JUDGEMENT, and the answer is unwelcome

**There is no current, published home for F38.** The migration is announced but not completed.

LRMoo v1.0 §9 preamble, verbatim:

> "The classes and properties declared in this section were declared in FRBRoo version 2.4 and have
> not been deprecated. However, they are not necessary for an implementation of LRMoo. They should be
> implemented as a transition mechanism for implementations of the superseded model FRBRoo version
> 2.4 that require them. They are **intended to be** transferred to CRMsoc."

And §1: "Section 9 provides a temporary home for classes and properties declared in FRBRoo that are
intended to transition to the CRM family model CRMsoc, the model for Social Phenomena, **which is
under development**."

CRMsoc has not caught them. <https://cidoc-crm.org/crmsoc/fm_releases> (fetched 2026-09-10) lists
exactly one release: **version 0.1, May 2019, status Draft**, compatible with CIDOC-CRM 6.2.5. The
version page <https://cidoc-crm.org/crmsoc/ModelVersion/version-0.1> gives its status as "Open-In
progress", "Work in Progress", March 2019 document, May 2019 announcement. The releases table's own
gloss on Draft status: "subject to issues identified and discussed on the SIG mailing list" and "not
meant to support implementations".

So as of 2026-09-10, F38 Character has been removed from the current LRMoo (v1.1.1, Nov 2025) and its
destination model has one seven-year-old draft that is explicitly not meant to support
implementations. The last place F38 is formally declared in a current-family document is **LRMoo v1.0
§9.1 (April 2024)**, which is now superseded; before that, FRBRoo v2.4 (November 2015, Official
(IFLA), also superseded).

**Recommended citation for the "groups of individuals" concept, in order of preference:**

1. **LRMoo v1.0 §9.1 (April 2024)** — <https://cidoc-crm.org/sites/default/files/LRMoo_V1.0.pdf> —
   cited as the last approved declaration, noting it is superseded by v1.1.1 which drops the class,
   and that the class is bound for CRMsoc.
2. FRBRoo v2.4 (November 2015) as the original approved declaration, if provenance matters more than
   currency.
3. **Not** CRMsoc: there is nothing published to cite.

**Wording defensible, reasoning at risk:** ADR 0005 says F38 "has since migrated **into** CRMsoc".
That overstates it. F38 has migrated *out of* LRMoo; it has not arrived anywhere. "Intended to be
transferred to CRMsoc, which remains at draft 0.1" is the accurate form. The design decision — species
are Characters — is unaffected either way: the reasoning stands on a scope note that was approved and
has not been deprecated, and CanonCore is not implementing LRMoo, only borrowing its distinction.

### 8d. Whether a species is what F38 means — JUDGEMENT

The scope note's "groups of individuals" is glossed by the model as "(including families)" and
exemplified by "The Knights of the Round Table [in fiction]" — a named fictional band, and F39 Family
exists separately for real ones. A species (Time Lords, Daleks, house-elves) is a group of
individuals appearing in works in a way relevant as subjects, so it is inside the letter of the scope
note. It is not what the drafters had in the front of their minds. The reading is defensible and I
would not disturb it, but the ADR states it as though F38 settles the question, and it does not
quite: F38 permits the reading rather than requiring it. What actually settles it for CanonCore is
Claim 9 — there is no better home.

---

## Claim 9 — `schema:Taxon` is real-biology and therefore wrong for a fictional species

**Claim (ADR 0005):** "`schema:Taxon` is real-biology and wrong."

**Owner:** Schema.org. <https://schema.org/Taxon> (fetched 2026-09-10).

**"Real-biology" — CONFIRMED.** Definition, verbatim:

> "A set of organisms asserted to represent a natural cohesive biological unit."

Parent type: `Thing`. Origin: bioschemas.org. The page carries the marker "This term is in the 'new'
area - implementation feedback and adoption from applications and websites can help improve our
definitions."

Its three own properties reinforce it: `childTaxon` and `parentTaxon` ("Closest child/parent taxa of
the taxon in question"), and `taxonRank` — "The taxonomic rank of this taxon given preferably as a URI
from a controlled vocabulary – typically the ranks from **TDWG TaxonRank ontology** or equivalent
Wikidata URIs." TDWG is Biodiversity Information Standards. Every affordance of the type points at
actual organisms in actual taxonomy.

**"Therefore wrong for a fictional species" — JUDGEMENT (sound).** Schema.org nowhere says Taxon
excludes fiction; the inference is CanonCore's. But it is a good inference, and the strongest support
comes from the contrast with Claim 10: schema.org signals fictional applicability explicitly where it
intends it — `Person` is "A person (alive, dead, undead, **or fictional**)" — and `Taxon` carries no
such signal while carrying "natural", "biological" and a link to a biodiversity rank ontology. A
vocabulary that says "or fictional" when it means it, and does not say it here, is fairly read as not
meaning it here.

Verdict: the characterisation is confirmed by the owner; the conclusion drawn from it is a sound
judgement rather than a fact the owner states. That distinction does not weaken the decision.

---

## Claim 10 — schema:Person is "A person (alive, dead, undead, or fictional)" — CONTROL

**Claim (ADR 0004/0005 lineage):** schema:Person is defined as "A person (alive, dead, undead, or
fictional)".

**Owner:** Schema.org. <https://schema.org/Person> (fetched 2026-09-10).

**CONFIRMED, verbatim, character for character:**

> "A person (alive, dead, undead, or fictional)."

The control confirms. No cause to doubt the previous run's method.

---

## Records with no formal-standards claim

Two files in the reading list carry nothing this owner group can adjudicate. Recorded so the gap is
deliberate rather than an omission.

**ADR 0077 (work-browsing excludes entities by kind).** Every factual claim is about products, not
standards: Jellyfin's people-have-no-container-parent mechanism, and "All three incumbents group
search results by kind". Those belong to the products owner group
(`docs/research/verify-adr-jellyfin.md`, `verify-adr-plex.md`). The ADR is candid that the ordering
within groups "is ours, since none of them documents it", which is the right way to state an
undocumented gap.

**ADR 0082 (coverage expresses missing parts, never abridgement).** No standard is cited and none is
needed. The argument is internal: an abridgement covers the whole extent at reduced fidelity, so
modelling it as coverage intervals either lies or fabricates. Nothing here for a standards body to
own. (Worth noting only that ONIX and RDA both carry abridgement as a descriptive attribute rather
than an extent, which is the same instinct, but the ADR does not claim their authority and does not
need it.)

**ADR 0012, "What can be pointed at, and what can carry statements" section.** The addressable/
field-bearing lists are an internal design assertion, not a standards claim — there is no owner to
put them to. The standards claim adjacent to this design is "Shaped like MARC 21 field 883", which
lives in `docs/physical-schema.md` and is verified as Claim 6 above. The rest of ADR 0012's evidence
(Wikibase, Shopify metafields, OpenMRS, Salesforce; the 518,768 property rows; the OpenMRS row
counts) is products and archive measurement, not formal standards.

---

## Summary

| # | Claim | Verdict |
| --- | --- | --- |
| 1a | EDTF is real, current, LoC-owned, folded into ISO 8601-2019 | CONFIRMED |
| 1b | EDTF expresses year / year-month / day precision | CONFIRMED |
| 1c | A separate precision column is needed alongside the EDTF string | **CONTRADICTED** |
| 2a | BCP 47 subsumes script into the tag | CONFIRMED |
| 2b | `ar-latn` is the correct casing/form | JUDGEMENT (valid; `ar-Latn` is recommended) |
| 3a | MusicBrainz carries script as its own field | CONFIRMED |
| 3b | IIIF carries script as its own field | **CONTRADICTED** |
| 4 | IIIF Presentation 3.0 §4.4 is the source of `none` | CONFIRMED |
| 5 | `bestRating` / `worstRating` are Schema.org's shape, on Rating | CONFIRMED |
| 6 | MARC 21 883: per-field provenance, `$a` `$c` `$d` `$x` | CONFIRMED |
| 7 | `time_span` is LRM-E11, "a temporal extent having a beginning, an end and a duration" | CONFIRMED |
| 8a | LRMoo F38 covers "individuals or groups of individuals" | CONFIRMED |
| 8b | F38 has migrated out of LRMoo v1.1.1 | CONFIRMED |
| 8c | ...into CRMsoc | JUDGEMENT (intended, not arrived; CRMsoc is at draft 0.1) |
| 8d | A species is what F38 means | JUDGEMENT (permitted, not required) |
| 9 | `schema:Taxon` is real-biology | CONFIRMED (the "therefore wrong" is sound judgement) |
| 10 | `schema:Person` is "alive, dead, undead, or fictional" — CONTROL | CONFIRMED |

### Decisions that survive on reasoning that does not

Three places where the record's conclusion is right and its stated justification is not. These are
the edits worth making, and none of them reopens a decision.

1. **ADR 0073.** Use EDTF: correct, well-supported, keep. "With a precision column ... saying what it
   actually resolves to": the format already says it, in the spec's own word, "precision". If a
   column is wanted for sorting and indexing, it should be stated as *derived from* the EDTF string,
   not as an independent fact stored beside it. The title carries the error too.

2. **ADR 0090.** Use BCP 47, script inside the tag: correct, keep. "MusicBrainz and IIIF both carry
   script as its own field, which is the cost avoided": half wrong. MusicBrainz does, because it uses
   ISO 639-3. IIIF does not — IIIF uses BCP 47 and its §4.4 note about `ar-latn` is the very sentence
   the ADR's own example is lifted from. As written the ADR cites its best supporting witness as a
   counter-example.

3. **ADR 0005.** Species are Characters: keep. "F38 has since migrated out of LRMoo 1.1.1 into
   CRMsoc": the first half is confirmed, the second is not. F38 is gone from LRMoo v1.1.1 (Nov 2025)
   and CRMsoc's only release is draft 0.1 (May 2019), explicitly "not meant to support
   implementations". The honest form is "intended for CRMsoc, which has not yet published it", and
   the citable declaration is LRMoo v1.0 §9.1 (April 2024).
