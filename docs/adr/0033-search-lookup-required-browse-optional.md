---
status: proposed
---

# search and lookup are required; browse is optional and declared

`lookup` is required because search is ambiguous forever: one title is routinely a TV story, a
novelisation and a character at once, so a refresh by search can silently rebind an item to the
wrong thing.

`browse` is optional because it returns a container AND its ordering together, which yields
placements for free and is the only viable bulk import path for a source with no public API. A
provider also declares its cache ceiling, its stored image variant, and a per-role image limit and
quality floor — so a third party's licence terms stay declared fields rather than special cases in
our core.

Language is an optional parameter in both directions and never required.

Emby retrofitted the RESPONSE half into a shipped provider contract in one commit on 2016-09-14
(`d169da7de03ca11dd62863e9c40937d752218274`; the hash cited earlier was Jellyfin's for the same
change). The request half, `ItemLookupInfo.MetadataLanguage`, predated it. Worth knowing that the
commit shipped its prioritisation loop dead and Emby later removed the approach — the retrofit is
the precedent, not the design.

## What the declared variant buys

Declaring the stored variant (a w500 poster, a w780 backdrop) is what makes the image store bounded
BY THE CATALOGUE at design time rather than discovered at runtime: the count of stored images is a
function of the catalogue and the declared variants, both of which are known before anything is
fetched.

NO SIZE BAND IS CLAIMED HERE. An earlier version said "roughly 50-150KB each, a few hundred
megabytes across the archive extract's 11,285 stories". Nothing owns that figure — Plex publishes no
image sizes and TMDB documents `file_size` without bytes — and it was wrong twice over: 11,285 is
the whole archive rather than the committed extract, and the arithmetic gives 0.56-1.7GB rather than
"a few hundred megabytes". A spot measurement of nine TMDB `w500` posters gave 18-119KB, median
~33KB. Measure against our own pipeline when a number is needed.

Plex runs a separate PhotoTranscoder cache with a weekly sweep. Plex documents the mechanism —
images "generated as needed" and cached — and publishes no rationale, so the reading that a
runtime-bounded store is what forces a sweeper is OURS. It is still the tell we design against.

Width, height and blurhash are NOT needed early. Storing the bytes (ADR-0037) makes all three
re-derivable.

## The story filter is a vocabulary; `medium IS NOT NULL` is not one

The ambiguity above recurs one layer down, and there it stops looking like a guess. A provider
filtering a source for stories reaches for the field that names what kind of thing a row is and asks
whether it is set. That reads as a type check and is another guess, which is why the rule sits here
rather than in one provider's notes: the wiki provider hit it, the TMDB provider writes the same
schema against the same contract, and the app-side matcher is a third site.

The archive names that field `medium`, and it is NOT [[0063-medium-is-a-playback-medium]]'s, which
is closed at four values and describes how an edition is rendered. This one holds a disambiguation term and is closed at nothing. The collision is part of
why the null check reads as a type check, and it is why the wiki provider renames the value before
it crosses the CMPP boundary.

The archive's wiki disambiguates a CHARACTER by the story it first appears in, so `Empress (Marco
Polo)` and `Nurse (The Long Game)` parse to a non-null `medium` while being characters. Of the
40,696 article-namespace pages carrying a non-null `medium`, the wiki's own T:DAB TERM vocabulary
admits 14,285: the null check returns 2.85 rows for every one the vocabulary wants. The 26,411 it
rejects — 65% — are not stories at all, led by `disambiguation` (1,382), `people` (898), `releases`
(810), `production` (808) and `in-universe` (800) pages, and then by story titles dabbing the
characters who appear in them. *Marco Polo* bare is the historical person and the story is
`Marco Polo (TV story)`, so a matcher trusting a non-null `medium` binds an item to a character and
nothing downstream can tell.

**Filter on the source's own vocabulary of kinds, never on a field being populated.** For the wiki
that vocabulary is T:DAB TERM's, and it is closed in its BASE TERMS and open in the citation
prefixes those terms carry, which is the next paragraph's whole subject.

**THE PREFIX RULE IS NOT OPTIONAL.** A real dab term may carry a citation prefix — `TV21 125 short
story`, `CON episode`, `DWM 30 short story` — so matching the tail alone readmits `The Long Game`,
which is the dab term on seven pages, every one a character and not one a story. A prefix is an
acronym or a number and never ordinary words, and that is the whole of what separates the two. A
suffix match is wrong in the same direction as the null check, and it is the half that gets
dropped.

## The manifest's image fields, and their names are this record's

The paragraph above names three things in prose — a stored image variant, a per-role image limit and
a quality floor — and stops. CNCORE-15 had to write them as JSON keys anyway, so `provider-wiki`
shipped `stored_variant`, `per_role_limit` and `quality_floor` and NOTHING OWNED THEM. A name
invented in one provider's source is a name the second provider invents differently, and CNCORE-8's
contract test would then catch a drift nobody needed to cause. Catching it in a test is worse than
not causing it, so the names are settled here. They are adopted UNCHANGED: they are the right names,
and renaming them would spend a migration to settle nothing.

`images.stored_variant` — `string`, or a MAP OF ROLE TO VARIANT, or `null`. The variant CanonCore
stores, IN THE SOURCE'S OWN VOCABULARY, because there is no cross-source vocabulary of image sizes
and inventing one would put a translation layer between every provider and the store. `null` means
the source offers no choice of rendition.

**THIS SAID `string | null` AND GAVE TMDB'S `w500` AS THE EXAMPLE, AND TMDB CANNOT ANSWER IT.**
Corrected here rather than beside, because a note underneath would leave the wrong type standing.
TMDB's `/configuration` puts `w500` in `poster_sizes` and in NEITHER `backdrop_sizes` NOR
`still_sizes`, so one string for every role names a size that 404s for two of the three; the honest
declaration is `{"poster": "w500", "backdrop": "w780", "still": "w300"}`. The map is not a TMDB
special case — it is what a source with role-specific renditions has to be able to say, and the wiki
provider's `null` and a single string both stay legal.

**Found by `@canoncore/providers` REFUSING THE SECOND PROVIDER'S MANIFEST OUTRIGHT, which is the
app's own consumer schema and not the contract test.** An earlier version of this sentence credited
the contract test, which did not exist yet — a record a later reader uses to judge the anti-drift
device must not credit it with a catch it did not make. What the contract test caught is in the
image-reference section below. This is the field the section above turns into a design-time bound on
the store, so it declares what WILL be stored rather than hinting at what could be.

`images.per_role_limit` — integer, 0 or more. How many images of any ONE role CanonCore may fetch.
`0` says this provider serves no images, which is a declaration and not an unset field.

`images.quality_floor` — integer, 0 or more, a minimum stored width in pixels. `0` says the source
publishes no dimensions, so no floor can be enforced against it — again a statement rather than a
blank.

`max_cache_age` sits beside these three and is NOT this record's. [[0037-artwork-stores-its-bytes]]
owns it, being the record that makes expiry a read-time check.

### An image reference on a record

CMPP returns "metadata and URLs, never media bytes" (ADR-0031), so an image on a record is a
reference. Five fields, and each exists because something downstream cannot work without it:

`id` — `string | null`. The source's own stable handle for the file. Null where the source has none,
which is a real answer: 108 of the wiki's 8,289 story image references name a file page the archive
does not hold.

`role` — string. What the image is FOR. Without it `per_role_limit` limits nothing.

`url` — string, and an HTTP one. Where the BYTES are, and it is this field ADR-0037's store is
filled from. The scheme is part of the field rather than the fetcher's problem; CNCORE-79's
section below is why.

`description_url` — `string | null`, HTTP where it is not null. The page describing the file, which
is where a wiki keeps the per-file licence and the photo credit. Null where the source has no such
page. It is RENDERED AS A LINK beside the credit, so it is the same sink a record's own `url` is
and takes the same rule.

`licences` — array of strings, possibly empty. The source's own licence labels for this file. Empty
means the source states none, which is different from the source stating a permissive one.

`width` — integer pixels, optional. **A SIXTH FIELD, and this list said five.** It is what
`quality_floor` is checked against, and a floor with nothing to check is a rule nobody can enforce —
so the field the manifest's policy depends on was missing from the record the policy applies to.
Optional because a source that publishes no dimensions cannot supply it, which is the same source
that declares `quality_floor: 0`.

**ONLY `role` AND `url` ARE REQUIRED OF ANYBODY, and that is the correction CNCORE-8's contract test
forced.** This list read as six things a provider sends; the two real providers between them send
all six and SHARE ONLY TWO. The wiki has `id`, `description_url` and `licences` because a MediaWiki
file page has a handle, a description page and copyright templates; TMDB has none of those and has
`width`, because its images come from studios who keep the rights and its renditions are sized.
Requiring either one's set would write "be that provider" into the contract. The contract test
required `width` on its first draft — taking the provider in front of it as the rule, which is the
exact failure it exists to prevent — and CI running it against the real published wiki image is what
caught that. **That is the divergence the contract test found, as against the `stored_variant` one
above, which the app's consumer schema found.**

**`source_url` WAS THE OBVIOUS NAME FOR THE FOURTH FIELD AND IS BANNED.** ADR-0097 reserves `source`
for who asserted a value, and ADR-0071 makes that a four-valued thing the catalogue reads; a field
named `source_url` next to a `url` would read as provenance-of-the-claim and mean
location-of-a-page. `description_url` is MediaWiki's own phrase — a file description page — and
degrades honestly to null for a source that has nothing like one.

**`licences` is PLURAL where CONTEXT.md's Artwork entry says "its licence", and the plural is the
honest shape.** 4 of the wiki's 8,132 story-image file pages carry two copyright tags. Handing over
one of the two is the provider picking, which is the thing a provider must not do — the same
argument that makes `released` an array rather than a chosen date.

### CMPP field names are snake_case, and that is a contract rule

Every field in this record and in every provider is `snake_case` -- `max_cache_age`,
`per_role_limit`, `stored_variant`, `description_url`, `external_ids`, `series_id`, `data_uri`. That
was a convention nobody had written down, and CNCORE-8's contract test began ENFORCING it before
this paragraph existed: it walks every response and fails on any camelCase key.

**A rule enforced by a test and stated nowhere is the incumbent-draft problem again**, which is the
failure this record spent a section fixing for the image field names. So it is stated: a provider
may send fields the contract does not name -- unknown keys are permitted, because a provider ahead
of the contract is well-formed -- and it may not spell them in another casing.

The reason it is worth a rule rather than a preference: a provider sending `externalIds` beside the
contract's `external_ids` passes a shape check TWICE OVER. The unknown key is permitted, and the
contract's own field is then simply absent, which is also permitted. Both providers' suites stay
green on their own spelling forever, and the drift is invisible until something tries to read the
field. Casing is the one part of a name a schema cannot check for you.

### The role vocabulary is the SOURCE's, and is NOT closed here

Roles are declared as strings and CMPP closes no list of them. TMDB has posters, backdrops, logos
and stills; the wiki's archive has ONE image property per page, which MediaWiki itself calls a
**page image** — "the single most appropriate thumbnail associated with an article". Closing a
vocabulary now, from one provider that has one role and a second that is not written, would be
inventing a taxonomy from a sample of one and then making every later provider translate into it.

This is NOT [[0083-a-file-carries-a-role]]'s role, which is closed at three values and says whether
a file is media, subtitle or audio. That one is about what a file IS to a player. This one is about
what a picture is FOR on a page, and the two lists must never be merged: an image role reaching
`0083`'s column is how a role column becomes a second edition axis, which is the failure that record
already names.

### The licence tag is a vocabulary too, and the same rule catches it

The rule this record states for stories — **filter on the source's own vocabulary of kinds, never on
a field being populated** — applies again one layer down, and it is worth saying because the wrong
answer looks obvious. A file page's licence is a template call in its wikitext, so "the first
`{{...}}` on the page" reads like the licence and is not one: on the wiki's story images that
matches `{{cs|...}}`, a story-citation template, 524 times.

The wiki maintains `Category:Copyright templates`, 92 members, and that is the vocabulary. Matched
against it, 8,057 of the 8,132 file pages behind the archive's story images carry a tag, led by
`Comic copyright` (2,029), `Screenshot` (1,522), `BF audio cover` (1,182) and `Illustration`
(1,105). Case varies between usages of the same tag, so the match is case-insensitive and the value
handed over is the CATEGORY'S spelling rather than the calling page's — otherwise `screenshot` and
`Screenshot` reach the catalogue as two licences.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`.

The figures above were measured on 2026-09-10 against `~/tardis-pipeline/data/db/tardis.duckdb`
opened read-only, by the query that produced them:

```sql
WITH v(term) AS (SELECT unnest(['tv story', 'audio story', 'novel', 'novelisation', 'comic story',
  'short story', 'theatrical film', 'poem', 'graphic novel', 'omnibus', 'webcast', 'home video',
  'video game', 'game', 'reference book', 'feature', 'illustration', 'stage play', 'documentary',
  'episode'])),
m AS (SELECT medium FROM pages WHERE ns = 0 AND medium IS NOT NULL)
SELECT count(*) AS non_null_medium,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM v
         WHERE lower(m.medium) = v.term
            OR (lower(m.medium) LIKE '% ' || v.term
                AND regexp_matches(substr(m.medium, 1, length(m.medium) - length(v.term) - 1),
                                   '^[A-Z0-9]+( [A-Z0-9]+)*$')))) AS admitted
FROM m;
-- 40696 | 14285
```

The term list and the prefix pattern are copied verbatim from `STORY_DAB_TERMS` and `DAB_PREFIX` in
`provider-wiki`'s `src/archive.ts`, so the figure measures the rule this record states rather than a
paraphrase of it. That file stays the vocabulary's home: T:DAB TERM can change and no other source
has dab terms at all, so the list appears here only inside a query that has to be runnable to be
evidence.

**It is the dab-term predicate alone, isolated from the rest of that WHERE clause**, which also
excludes redirects. So 1,494 of the 14,285 admitted rows are redirect pages rather than story
articles. That is deliberate: both figures are then counts of what one predicate does to one
population, which is the comparison the record is making. Excluding redirects from both sides gives
34,580 admitted-by-null-check and 12,791 admitted-by-vocabulary, a rejected share of 63.0% against
64.9%, so nothing in the argument turns on it.

`The Long Game` is the `medium` of seven pages, and every one is a character: `Nurse`, `Customer`,
`Mate`, `Max`, `Editor-in-Chief`, `Dog` and `Steve`, each parenthesised with the story title.

CNCORE-15 REPORTED 13,457 ADMITTED AND 27,239 REJECTED, and that pair does not reproduce. The
denominator does, exactly. What is known about the split is that the predicate above does not
produce it and that what did produce it was not recorded; eight variants were tried and the counts
are on CNCORE-23, which is also where `provider-wiki`'s four copies of the old pair get corrected.
The figures given here are the ones the query above prints. The claim both pairs carry — that
roughly two thirds of the rows a null check admits are not stories — survives every one of those
variants, which reject between 62% and 68%.

## Half built, under CNCORE-6, CNCORE-15, CNCORE-17 and CNCORE-22 -- and this record stays PROPOSED

**BUILT: all three operations, and the image fields now carry real values.** `provider-wiki`
answers `search`, `lookup` and -- since CNCORE-17 -- `browse`, declaring each in its manifest, and
CanonCore imports by `lookup` against a stable id rather than by re-running a search. So the reason
`lookup` is required is not an argument here any more, it is the code path: an import that refreshed
by search could rebind an item to whichever of a title's three meanings sorted first.

**AN EARLIER VERSION OF THIS SECTION SAID THAT PROVIDER "DECLARES NEITHER `browse` NOR AN
IMPLEMENTATION OF IT", AND CNCORE-17 MADE THAT FALSE WITHOUT COMING BACK HERE.** Corrected in the
sentence rather than beside it, because a note underneath would have left the old claim standing.

The optionality is exercised in NEITHER direction BY THE PROVIDERS THAT EXIST. One provider has
source and it declares all three, so nothing in the tree is currently a provider WITHOUT `browse` --
and that case is CNCORE-8's to keep alive, its ticket saying to write the assertion so CNCORE-17
landing did not silently retire it. `provider-tmdb` ALSO declares all three, since CNCORE-16 landed its source — an
earlier version of this sentence said that repository held "a README and no source", which CNCORE-16
made false without coming back here.

**THE APP SIDE IS A DIFFERENT AXIS AND CNCORE-7 BUILT IT**, which is why the paragraph above is
narrowed to the providers rather than left saying the optionality is unexercised. CanonCore now
reads `operations` and behaves differently on it: a provider declaring `browse` is browsed, one that
does not is refused without a request leaving the app, and both branches are pinned by tests against
stubs. What is still missing is a second REAL provider to hold the contract across, not the
behaviour. See the CNCORE-7 section below.

**NOT BUILT: every declared field CanonCore is supposed to honour.** The provider declares its cache
ceiling and, since CNCORE-22, a real stored image variant, per-role image limit and quality floor
rather than the zeros CNCORE-15 shipped under ADR-0057's since-corrected image exclusion. This app
reads none of them. There is no image store to bound, and no read-time expiry check against
`max_cache_age` -- so the fields travel the wire and stop at the schema.

That is the half worth naming, because it is invisible from outside: the manifest looks honoured. A
provider whose licence caps how long a value may be kept is currently having that cap RECEIVED and
IGNORED, and this record's whole argument is that a third party's licence terms stay declared fields
rather than special cases in our core. Declared is only half of that. Whatever first stores an image
or first caches a value is what closes it.

CNCORE-22 WIDENED THAT GAP RATHER THAN CLOSING IT, and says so here rather than letting the fields
being populated read as the mechanism working. Records now carry image references and the manifest
now bounds them, so there is something real to honour and still nothing honouring it. The names are
settled, which is what that ticket was for; the store is not.

**Language is neither built nor needed yet.** It is an optional parameter in both directions and
nothing passes one, because there is one language of one archive here.

## Evidence for the image section, under CNCORE-22

Measured 2026-09-10 against `~/tardis-pipeline/data/db/tardis.duckdb` opened read-only. Re-derive
the whole set with `pnpm measure:images` in `provider-wiki`, which reads the same predicates the
code does — `storyDabTermSql`, `fileTitleSql`, `COPYRIGHT_TAGS_SQL` — rather than a copy of them.
That is CNCORE-23's device for the story split, applied here so these figures cannot drift from the
rule they describe either.

**IT DID NOT DO THAT AT FIRST, AND PUBLISHED A WRONG FIGURE BECAUSE OF IT.** The script imported the
story predicate and then hand-wrote the file-title join and the licence vocabulary beside it, so it
reported 259 references to files the archive does not hold when the answer is 108. The rule is
therefore sharper than "write a script": a script that RESTATES a predicate is measuring something
else, and it will not say so. Export the predicate and import it, or the script is a second
implementation wearing the authority of a measurement.

**Every figure with its filter, because the pair is the claim.** `story` below is `ns = 0 AND
is_redirect = false` plus the story dab term, which is the population the provider serves:

| Figure | Filter |
| --- | --- |
| 38,868 `Has image` rows | none |
| 8,289 `Has image` rows on 8,177 distinct pages | `story` |
| 12,791 stories | `story` |
| 8,132 distinct file pages behind those rows | `story`, joined to `ns = 6` on the NORMALISED title |
| 8,057 of them carrying a `Category:Copyright templates` tag | the same |
| 524 whose first template CALL is `{{cs}}` rather than a licence | the same |
| 108 rows resolving to no file page at all | `story` |
| 259 rows an EXACT title join would call missing instead | `story` |
| 4 carrying two DISTINCT copyright tags | the same |
| 92 members of `Category:Copyright templates` | none |

The 8,289 and the 8,132 are different populations and MUST NOT be subtracted: the first counts
property rows, the second counts distinct file pages they point at, and the gap between them mixes
the 108 rows pointing at no page with the files two stories both use. Deriving one from the other
produces a number that reads as "images without a file page" and is not. `measure:images` said in
its own closing line that the difference WAS the missing-file count, which is this mistake made
inside the sentence warning against it.

```sql
-- the copyright-tag vocabulary, and what it admits on story images
WITH refs AS (
  SELECT DISTINCT pp.value AS fname FROM page_properties pp JOIN pages p ON p.title = pp.page
  WHERE pp.property = 'Has image' AND p.ns = 0 AND p.is_redirect = false AND <story dab term>),
tags AS (SELECT replace(title, 'Template:', '') AS tag
         FROM page_categories WHERE category = 'Copyright templates')
SELECT count(*) AS file_pages,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM page_templates pt JOIN tags ON lower(tags.tag) = lower(pt.template)
         WHERE pt.page_id = f.page_id)) AS with_copyright_tag
FROM refs JOIN pages f ON f.title = refs.fname AND f.ns = 6;
-- 7981 | 7908
```

`<story dab term>` is `storyDabTermSql` from `provider-wiki`'s `src/archive.ts`, which stays the
vocabulary's home for the reason the section above gives. The join above is shown matching
`refs.fname` exactly, which is the version that was wrong; the shipped one wraps it in
`fileTitleSql`. It is left here as written so the corrected figures and the query that produced the
wrong ones stay legible together.

**Two of these figures were hand-measured wrongly before the script existed, which is the argument
for the script.** The two-tag count read 5 because the query counted JOIN ROWS rather than distinct
tags, so a page calling one tag twice looked like a page carrying two; it is 4. And "first `{{...}}`"
has two readings — the first template CALL anywhere on the page (524) and the page's text BEGINNING
with it (6) — because a file page routinely opens with `== Summary ==` or a caption. The claim needs
the first, since what it describes is a reader scanning for a template and taking the one it finds.

## And under CNCORE-7: the app reads the declaration -- and this record STILL STAYS PROPOSED

**BUILT: the app side of the optionality, in BOTH DIRECTIONS.** The provider half is above;
`provider-wiki` declares `browse` since CNCORE-17. What this ticket adds is the reader: CanonCore
takes the manifest and consults `operations` before asking for anything. A provider that declares it
is browsed; a provider that does not is refused with a named error and NO REQUEST IS MADE -- which is
the point, since a provider
declining the optional operation is well-formed rather than broken, and must not read to its owner
as a failure. Both directions are pinned by tests, and so is the half that is easy to break by
accident: a provider that declares no `browse` goes on serving `lookup` exactly as before.

**AND A DECISION THIS RECORD DID NOT MAKE, MADE HERE: WHERE A CONTAINER ID COMES FROM.** Nothing in
CMPP hands one over. `search` returns stories and `browse` takes the container's own id, so there is
no operation that answers "which containers do you have". THE OWNER NAMES IT, exactly as they name a
record for `lookup`. That is written down here rather than left in the code, because the obvious
alternative is wrong in a way that takes a while to notice: a record's `series` field is a NAME, and
the archive links members by name while a page id does not move -- so deriving the container from
`series` would bind an import to a string that can be renamed out from under it (the wiki's own
T:DAB policy is the reason a page id is the stable thing).

A provider-side operation that LISTS containers is not refused here, it is simply not needed by
anything yet. Whatever first wants to browse without knowing an id is what should propose it.

**AND THE RECORD STILL STAYS `proposed` ANYWAY.** Its operations half is now complete on both sides
of the wire, and its DECLARED FIELDS half is not: the section above owns that paragraph and CNCORE-22
sharpened it, since those fields now carry real values rather than zeros. Declared is half of "a
third party's licence terms stay declared fields rather than special cases in our core". Whatever
first stores an image or first caches a value is what closes it.


## And under CNCORE-8: the optionality is exercised again, by a witness -- and this record STILL STAYS PROPOSED

**THE ASYMMETRY THIS RECORD WAS COUNTING ON IS GONE.** The section above says the optionality is
exercised "in NEITHER direction BY THE PROVIDERS THAT EXIST" and leaves that case to CNCORE-8, whose
ticket asked for an assertion written so CNCORE-17 landing could not silently retire it. CNCORE-17
landed FIRST. Both real providers declare `browse`, so there is nothing in version one that a
provider declining it could be compared against.

**So the contract suite carries a CONFORMANCE WITNESS**: a minimal provider on a real socket that
declares `search` and `lookup` and nothing else, and goes through every assertion the real providers
do, unchanged and indistinguishable to the suite. It stands for exactly one claim — that the contract
is SATISFIABLE without `browse` — and the day a conformance rule is written that assumes the
operation, it is what goes red.

**And a suite-level assertion stops the witness being deleted as redundant**, which is the way this
would otherwise rot: it fails if EVERY participant declares `browse`, naming what was lost. The
failure it prevents is quiet — a rule added later that assumes `browse`, with every provider under
test happening to offer it, so the rule looks universal and is not.

**NOT BUILT, STILL: the declared fields this app is supposed to honour.** Unchanged from the section
above and the reason this record stays `proposed`. `max_cache_age` and the image fields now travel
the wire from two providers rather than one, are checked for shape by the contract test, and are
still read by nothing: there is no image store to bound and no read-time expiry check. Two providers
declaring a field nobody honours is a wider gap than one, not a narrower one.

**What CNCORE-8 DID close is a different sentence of this record's.** "A third party's licence terms
stay declared fields rather than special cases in our core" now has a field behind it that the app
genuinely renders: `attribution`, carrying a source's notice and its mark, written onto the source
row at import and shown on every page that displays that source's claims. Nothing in the renderer
knows it is looking at TMDB. That is the rule working end to end for the first time — for one field,
while the cache ceiling and the image policy are still declared into silence.

## And under CNCORE-33: `search` refuses an empty query too -- and this record STILL STAYS PROPOSED

**AN EMPTY RESULT IS AN ANSWER; A MISSING QUERY IS A MISTAKE.** `GET /search` answers `400` with a
JSON body when `q` is absent, and it answers the same when `q` is PRESENT AND EMPTY. An empty string
is not a query. A caller sending `?q=` built a URL and never filled the parameter in, which is the
absent case wearing a different spelling, and answering `[]` to it hides the mistake in a shape that
looks like a result.

**THE READING THAT MAKES THE TWO LOOK DIFFERENT IS AN IMPLEMENTATION'S, NOT A CALLER'S.** "An empty
string is not undefined" is true of the language a provider happens to be written in and invisible
from the outside: a caller cannot see why one spelling of a query it never supplied is a refusal and
the other is an empty list. The contract does not offer it that distinction.

**IT WAS THE CONTRACT TEST THAT FOUND THIS**, as ADR-0110 records: `provider-tmdb` refused `?q=` and
`provider-wiki` answered `200 {"results":[]}`, each locally sensible and neither wrong against its
own repo's tests. Settled under CNCORE-33 by changing `provider-wiki`, because this record is where
the reading is decided and the provider is where it is obeyed.

**HOW IT WAS HELD OPEN MEANWHILE IS NOT THIS RECORD'S LESSON**, and it is worth saying where that
went. The suite pinned the divergence rather than asserting the rule, so that settling it could not
pass quietly; the pin then failed to fire. That is a fact about the SUITE rather than about CMPP, so
it is written up in [[0103-tests-bite-at-package-exports-and-the-router]], which owns the fifth seam
and already carries its sibling — a suite that was green for the wrong reason under CNCORE-9.

**NOT BUILT, STILL: the declared fields this app is supposed to honour.** Unchanged, and still why
this record is `proposed`. CNCORE-33 settled one failure mode in the required half of CMPP; it
touched neither `max_cache_age` nor the image policy, which continue to travel the wire and be read
by nothing.

## And under CNCORE-77: the app finally CALLS `search` -- and this record STILL STAYS PROPOSED

**BUILT: the operations half is now complete in BOTH DIRECTIONS for all three operations.** Every
section above is about what a PROVIDER must answer, and `search` was the operation where that was
the only half there was: both providers answered it, the contract test held them to it, and nothing
in CanonCore had ever called it. The client's own comment said so and said why — a client method
with only tests behind it would be an abstraction ahead of a need, and it would arrive with the
surface that searches. It has arrived. `ProviderClient.search` is on the interface, the comment
recording its absence is gone rather than left contradicting the code, and a record can be reached
by NAME rather than by an id obtained from outside the product.

**WHICH HALF THIS LEAVES STANDING, stated plainly because "half built" has meant different halves in
each section above.** The OPERATIONS half is closed: three operations, declared by two providers,
called by this app, with the optional one's optionality honoured in both directions. The DECLARED
FIELDS half is exactly where CNCORE-8 left it — `max_cache_age` and the image policy travel the wire
from two providers and are read by nothing — and it is still the only reason this record is
`proposed`.

**A SECOND CALLER, AND A DIFFERENT SHAPE OF ONE.** `lookup` and `browse` reach ONE provider that the
owner named. Searching is the first thing that reaches SEVERAL at once, and it is the operation where
the difference bites: an owner who does not know an id also does not know which source holds it.
`searchProviders` is that fan-out, and it lives in `@canoncore/providers` beside the client rather
than in the app, because it is about reaching providers and touches no catalogue.

**ONE PROVIDER FAILING IS NOT THE SEARCH FAILING.** A fan-out that threw on the first failure would
hand an owner nothing at all because one of several connected sources was having a bad day, and it
would do it non-deterministically — whichever provider lost the race decides. So each provider's
turn is caught on its own, and what comes back is TWO LISTS: who answered, and who did not and why.
Collapsing them into one short list is how an owner concludes their query was wrong when their
provider was merely offline.

**THE REFUSAL TRAVELS AS AN `Error` AND NOT AS A SENTENCE ABOUT ONE.** ADR-0034's refusals are
answers a UI must be able to put in front of an owner, and `packages/api` maps them onto a declared
error rather than a 500; a `reason` flattened to prose would have made that distinction something to
recover by reading the message. A URL the owner never allowlisted therefore fails as an
`OutboundRefused` beside a provider that answered badly, in the same list, distinguishable.

**AND THE `?q=` READING GAINED ITS THIRD CALLER, WHICH IS WHERE IT GOT INTERESTING.** The section
above settles that `?q=` is the caller's mistake and both providers answer it `400`. This app is now
a caller, and the two rules it just acquired cancel each other out if nothing says otherwise: an
empty query fanned across every provider collects a refusal from each, every failure is tolerated,
and the answer is `{ answered: [], failed: [...] }` — which an owner reads as "nothing matched". The
mistake would have been hidden by the very leniency that makes a fan-out worth having.

So the two sit at different levels ON PURPOSE. **The CLIENT sends `?q=`** and reports the provider's
`400` as the failure it is, which is what keeps this app a caller of the case rather than a stranger
to it: refusing locally would mean nothing on this side ever noticed a provider that changed its
mind. **The FAN-OUT refuses before a socket opens**, because tolerance is exactly why the mistake has
to be caught before it becomes tolerable.

**A CONTRACT GAP THIS TICKET FOUND, AND IT WAS IN THIS RECORD'S OWN SENTENCE.** "An empty result is
an answer; a missing query is a mistake" carries two claims, and the contract suite only ever checked
the second. A provider answering `404` — or any failure — to a query that simply matched nothing
satisfied every assertion in that suite, and it is a plausible thing to build, since `lookup` answers
`404` for an id it does not hold and reusing that reflex looks consistent. It was harmless while
nothing called `search`. It is not harmless now: the client reads a refusal as that provider FAILING
and an empty `results` as it ANSWERING, and the fan-out sorts providers into two lists on exactly
that distinction — so a provider reporting "nothing matched" as a failure would show an owner a
source that looks broken every time they search for something it does not hold. The suite now pins
the first claim against both real providers and the conformance witness. Both already satisfied it.

The lesson in the SHAPE of that gap is a fact about the suite rather than about CMPP, so it is
written up in [[0103-tests-bite-at-package-exports-and-the-router]] beside its two siblings, exactly
as CNCORE-33's was.

**NOT BUILT, AND DELIBERATELY SO: the surface.** This is the half with no UI in it. Nothing renders a
result, nothing imports one, and no procedure exposes `search` — CNCORE-68 is the page, and this
ticket exists so that the client change and the page that uses it are two reviewable slices rather
than one across five packages. The fan-out has one caller today and it is a test, which is the state
the client's own removed comment warned against; what makes it a need rather than an abstraction is
that the surface is the next ticket and was specified before this one.

**NOT BUILT, STILL: the declared fields this app is supposed to honour.** Unchanged, and still the
reason this record is `proposed`. CNCORE-77 touched neither `max_cache_age` nor the image policy.


## And under CNCORE-79: every URL CMPP carries is an HTTP one -- and this record STILL STAYS PROPOSED

**THE CONTRACT DID NOT OBLIGE A PROVIDER TO SEND AN HTTP URL AT ALL, and nothing above noticed
because a URL is the one field that looks self-evidently checked.** `packages/contract`'s `record.url`,
`images[].url` and `images[].description_url` were each `z.url()`, which asks whether a string PARSES
as a URL and says nothing about its scheme. Measured against zod 4.5.4 rather than reasoned about:
`javascript:alert(1)`, `data:text/html,<script>x</script>`, `vbscript:x` and `file:///etc/passwd`
every one parsed clean. A provider sending any of them was conformant.

**IT WAS HARMLESS FOR EXACTLY AS LONG AS NOBODY READ THE VALUE.** `asProvided` in
`packages/api/src/routers/provider.ts` drops `url` on the floor, so no record's URL had ever reached
a reader. CNCORE-77 is what changed that -- `search` now carries arrays of provider-supplied records
out of `@canoncore/providers` -- and CNCORE-68 is the page that puts a candidate in front of the
Owner with its URL in an `href`. So the hole predates both and was opened by neither: what those two
tickets did was make it reachable.

**WHY IT IS THE CONTRACT'S RULE AND NOT THE APP'S.** ADR-0031's position is that a provider is an
untrusted URL rather than code we run, and a provider that can run script in the Owner's browser is
that position failing at the one place it is supposed to hold. The app's consumer schema refusing one
would protect THIS app; the contract refusing one is what obliges every provider, including the ones
nobody has written yet. Both now do, which is the arrangement every other field here is under.

**FOUR SCHEMES ASSERTED, NOT ONE REPRESENTATIVE OF THEM.** They are four different sinks --
`javascript:` and `vbscript:` execute, `data:` carries a document with its own origin, `file:` reads
the reader's own disk -- and a rule written against one can miss the others. The specification's own
refusal is asserted in `packages/contract/src/cmpp.test.ts`; that the real providers actually comply
is asserted against their live answers in the contract suite, because a schema that refuses a value
no provider sends is a rule with nothing exercising it.

**THE SCHEME AND NOT THE HOST, which is the part that looks like an omission.** [[0034-two-outbound-boundaries]]
carries the reasoning, because the question is which boundary judges a URL rather than what a field
holds.

**NOT BUILT, STILL: the declared fields this app is supposed to honour.** Unchanged. `max_cache_age`
and the image policy still travel the wire from two providers and are read by nothing, and that is
still the only reason this record is `proposed`.


## And under CNCORE-68: the surface arrives -- and this record STILL STAYS PROPOSED

**THE HALF THE SECTION ABOVE DEFERRED IS BUILT.** CNCORE-77 left it in as many words: "NOT BUILT,
AND DELIBERATELY SO: the surface. Nothing renders a result, nothing imports one, and no procedure
exposes `search` — CNCORE-68 is the page." It exists. `/import` searches every configured provider,
renders what each of them offered, and takes a candidate into the catalogue without an id being known
in advance. The fan-out's only caller is no longer a test.

**WHICH HALF THIS LEAVES STANDING.** Still the DECLARED FIELDS half, and still exactly where CNCORE-8
left it: `max_cache_age` and the image policy travel the wire from two providers and are read by
nothing. There is no image store to bound and no read-time expiry check. That is the only reason this
record is `proposed`, as it has been through four sections now.

**A SURFACE THAT LISTS A PROVIDER THAT MATCHED NOTHING.** The fan-out answers two lists and that
section explains why; what a PAGE adds is a third state those two lists cannot by themselves make
visible. A provider that answered with no results is in `answered`, and a page that rendered only
non-empty results would show the same thing for a provider that was never asked. So every provider
that answered is listed, saying it matched nothing where it did. "Both providers are searched" is then
something an owner can read rather than something the code happens to do.

**WHERE A CONTAINER ID COMES FROM, HELD TO FROM THE OTHER SIDE.** The CNCORE-17 section above decided
that the owner names it, because no CMPP operation answers "which containers do you have" and a
record's `series` is a name that can be renamed out from under an import. The surface obeys it
literally: the owner picks a provider and types the container's own id. That is the one field on this
page somebody types, and it is the one that can be wrong -- which is why the same section's named
refusals matter more now than when they were written. **A provider that declines `browse` and an id
that addresses no container reached the owner as neither: the surface this section describes threw
all three declared errors away and answered a bare `Internal Server Error`, eighteen bytes of plain
text with no HTML at all.** The sentence that stood here said they reached an owner "as the
procedure's declared errors rather than as an empty result to puzzle over", and it was wrong on the
day it was written -- a declared error is what the PROCEDURE answers, and nothing carried it to a
page. CNCORE-92 is the correction and the section below is what it built.

**AND THE OPERATION A PROVIDER-SIDE `list containers` WOULD SERVE IS NOW VISIBLE.** The CNCORE-17
section says such an operation "is not refused here, it is simply not needed by anything yet. Whatever
first wants to browse without knowing an id is what should propose it." This page is the first thing
that wants it: an owner who has just found *The Matrix* by name still has to go and find out that its
collection is `collection:2344` somewhere outside the product, which is the same wall search was built
to knock down one level up. **It is still not proposed here**, because the cheaper fix is nearer: a
record already carries `series` and `series_id`, and `series_id` IS a browsable container id at both
providers -- so the candidate an owner is looking at could offer its own container without any new
operation. Whatever builds that is where the choice gets made.

**A NEW CALLER OF `search` THAT IS NOT A SEARCH.** `provider.held` asks which of a provider's records
the catalogue already holds, by the external-id mapping migration 3 wrote, and it exists because of
something a surface needs and a protocol cannot supply: a page must be able to report what an import
did. The candidates a search answers carry the same field. Both are IDENTITY rather than matching
(ADR-0026) -- one party, one namespace, no judgement -- so a record one provider holds and another
does not reads as absent rather than as the other's Item.


## And under CNCORE-92: the three refusals are read BEFORE the button is offered

**THE DECLARED ERRORS EXISTED AND NOBODY COULD READ THEM.** The section above claimed they reached
the owner; the sentence is corrected where it stands. What the owner actually got, measured against
the production build by posting the browse form with a container id the provider does not hold, was
`Internal Server Error`: eighteen bytes of plain text, no HTML, and none of `NO_SUCH_CONTAINER`,
`BROWSE_NOT_OFFERED` or `PROVIDER_REFUSED` anywhere in it. Declaring an error is not delivering one.

**AND TWO MECHANISMS FOR DELIVERING IT ON THE POST DO NOT EXIST.** An `error.tsx` was written and
removed because it DOES NOT FIRE: a Server Action that throws during a form POST with no JavaScript
answers the bare 500 regardless, since rendering that boundary is the client router's job and this
surface's whole point is working before a script loads. It could not have carried the sentence
anyway — Next redacts a server error's message in production before a boundary sees it, handing over
a digest. So the reason is not recoverable on the POST at all, by any route.

**SO THE QUESTION MOVED TO THE GET, WHERE A READ BELONGS.** `provider.container` reads the manifest
and asks about the container the owner named, and answers a UNION rather than throwing: the
container, no container at that id, this provider declares no browse, or this provider could not be
reached with the reason it failed for. The page prints whichever it gets. Nothing about ADR-0033's
optionality changed — the manifest is still what decides whether `browse` is called, and a provider
that declares none is still never asked.

**THE READ IS `browse`, NOT `lookup`, AND THAT IS THE DECISION THIS TICKET TURNED ON.** Asking
`lookup` for the container id is cheaper and is wrong twice.

CMPP DOES NOT PROMISE A CONTAINER ID IS LOOKUP-ABLE, and `provider-wiki` does not answer one.
Measured 2026-09-12 against the real image rather than the stub
(`ghcr.io/jacobdrees-canoncore/provider-wiki@sha256:fc69c217bd16ccd4080897922b38689f9339b2a975b177ba0643ce41d9658de9`):
`/lookup/91997` answers `404 {"error":"no such record"}` while `/browse/91997` answers `200` with
`Category:Stories with missing episodes` and its ordering. That id is `packages/contract`'s own
fixture for a container this provider really holds, so a preflight built on `lookup` would have
reported every wiki category as a container that does not exist, on the one provider this project
ships first (ADR-0069).

AND `lookup` CANNOT TELL A CONTAINER FROM A STORY. Where it does answer, it answers for records of
every kind, so a record id typed into the container box comes back with a title and a button: the
button then meets the very 500 this ticket removes. `browse` is the operation the button performs,
so its answer is the only one that predicts the button.

**WHICH REVERSES A COST THE CNCORE-68 SECTION DECLINED TO PAY, and the reversal is arithmetic rather
than a change of mind.** That section refused to ask the provider because asking "would be a request
on every render of a page the owner may simply be typing into". It is not: the browse box is a GET
form with no script behind it, so it renders on SUBMIT and not on keystrokes, and the request is one
per submission — the same one the button was going to make anyway, moved earlier.

**A READ THAT WRITES NOTHING, PINNED AS SUCH.** The preflight calls the same provider operation the
import does, so the one invariant worth a test of its own is that reading it imports nothing: the
catalogue is counted either side of the GET. A page that quietly wrote sixty placements because
somebody followed a link would be a worse defect than the 500, and it would look exactly like a page
that worked.

**IT NARROWS THE WINDOW RATHER THAN CLOSING IT, AND THAT IS ON PURPOSE.** A provider can still fall
over between the GET that offered the button and the POST that presses it, and that POST still
answers a loud 500. Nothing here catches it, because the alternative was refused when this ticket was
written: an action that swallowed the three refusals would re-render as if nothing had happened,
which makes a provider that is down indistinguishable from a provider that holds nothing. Loud and
rare beats quiet and wrong.

**A CONFORMANCE WITNESS NOW STANDS IN THE APP'S HARNESS TOO.** `packages/contract` keeps one because
`provider-wiki` and `provider-tmdb` both declare `browse` since CNCORE-17, so no real provider
exercises this record's optionality. The import surface needs the same thing for the same reason: a
page that must say "this provider does not do that" has nothing to say it about otherwise. It is
configured in `PROVIDER_URLS` like any other provider, and it is a stub even in the CI job where the
other two are real images.

**STILL NOT BUILT, AND STILL THE ONLY REASON THIS RECORD IS `proposed`:** the declared fields.
`max_cache_age` and the image policy travel the wire from two providers and are read by nothing.
There is no image store to bound and no read-time expiry check. Five sections have now said so.
