# Walking the Owner's install, 2026-09-20

Evidence for a later grilling about journey flows and the import. Measured by walking
`http://localhost:3000` (the Owner's live install, `canoncore-canoncore-1`) through every route
logged out and logged in, and by querying its database (`canoncore-database-1`) for the expected
answer BEFORE reading each page. Not a proposal: the proposals belong to the grilling this feeds.

Every figure below carries the query or the page that produced it. Where a sentence is the Owner's
judgement or mine rather than a measurement, it says so.

## The corpus, as measured

| | |
| --- | --- |
| Items | 8,052 |
| of which Containers | 465 |
| Placements | 30,896 |
| Statements | 31,372 |
| Properties declared | 13 |
| Groups | 0 |
| Group memberships | 0 |
| Aliases | 0 |
| Vocabulary values | 0 |
| Merges | 0 |

`select count(*) ... where deleted_at is null` per table.

**Every Item is `kind: work`.** All 8,052. Six of the seven kinds hold nothing.

**Every Container is a `Theory:Timeline - X` wiki page.** All 465; `count(*) where title like
'Theory:%'` returns 465 and `count(*) where is_container and title not like 'Theory:%'` returns 0.
So the catalogue holds no series, no seasons, and no container that is not a fan-made timeline.

**What the X's are.** The largest, by members: `Doctor Who universe/AHistory` 2,907, `The Doctor's
TARDIS` 1,667, `Eleventh Doctor` 653, `Tenth Doctor` 616, `Bernice Summerfield` 440, `Daleks` 430,
`Time Lords` 406, `Torchwood` 334, `Amy Pond` 313, `The Brigadier` 301, `Sarah Jane Smith` 255,
`Ace` 254, `Jack Harkness` 236, `2010s` 254. `Theory:Timeline - Rose Tyler` holds 160.

These are characters, species, organisations, places and time spans. They are the catalogue's own
seven kinds, arriving as `work`.

**Of 13 properties, four are ever written.** `title` 8,052, `external_id` 8,052, `sort_name` 8,052,
`released` 7,216. At zero: `credited_to`, `part_of`, `category`, `based_on`, `created_by`, `image`,
`portrayed_by`, `appears_in`, `note`. So the statement layer currently restates the Item's own
columns and carries no relationship or infobox data at all.

## The one root cause

`provider-wiki` imports stories only, by design. Its filter is
`ns = 0 AND is_redirect = false AND <story disambiguator>` (`archive.ts:378`), and its own comments
measure the effect: of 40,696 ns-0 pages with a non-null medium, "this vocabulary admits 14,285 and
rejects 26,411" (`archive.ts:170`). ADR-0033 is the rule.

A page titled `Rose Tyler` carries no story disambiguator, so the character is excluded at the
source. Searching the live provider for "Rose Tyler" through `/import` returns exactly one row,
`Rose Tyler (short story)`.

`packages/db/src/import.ts:81` already documents what is left out and why: `writers` would be
`created_by`, which needs a person Item to point at, and deciding that this Kit Pedler is the Kit
Pedler already here is MATCHING, which ADR-0026 made its own operation. `series` would be a
container and a placement. The provider's own `kind` -- `TV story` -- is finer than the seven kinds
and ADR-0005 puts anything finer in a `category` statement, which needs an Item too.

So the gap is one end of the pipe. It is not a rendering gap, and it is not an oversight: each
missing piece is a decision recorded somewhere, waiting on matching.

Two consequences the Owner met as complaints, both explained by this and neither a defect:

- **The kind list.** Six of seven kinds are empty because everything imported is a `work`.
- **Groups.** There were none, because nothing creates one and a Group is filled one Item at a time.

## Eight journey problems

Observed while walking. 1, 2, 4, 5 and 6 are consequences of the root cause above; 3, 7 and 8 are
not.

1. **There is no way in.** `/` is 8,052 Items in alphabetical order, opening on `£436 (short
   story)`. No home, no orientation, nothing curated.
2. **There is no hierarchy to descend.** Zero series containers, so no Doctor Who to a series to an
   episode. `/` and `/works` are one list under two predicates (`/works` adds
   `kind = 'work' AND (NOT is_container OR holds_work)`, ADR-0077), navigable by A-Z, kind, order
   and group and nothing else.
3. **The Item page leads with the Owner's furniture.** Rose's page opens with Title, Sorts as and
   Note edit forms and their Save buttons, then Values, then Members. A reader meets the editing
   apparatus before the content. (Judgement, not a measurement: the ordering is deliberate and
   nothing says it is wrong.)
4. **No images anywhere.** The `image` property has 0 uses. 8,052 works and no cover art.
5. **Titles carry their source's plumbing.** `Theory:Timeline - Rose Tyler`, `14681 UNIT Field Log
   (webcast)`, `£436 (short story)`. The wiki's namespaces and disambiguators are shown as titles.
   This distorts browsing: T holds 931 Items, the largest letter, and 465 of those are the
   `Theory:` prefix. Without them T would hold 466, below D's 785.
6. **A Group is filled one Item at a time from its own page**, which the `/groups` empty state says
   outright: "Draw one above, then put Items in it from their own pages." For this corpus that is
   8,052 visits.
7. **A 2,907-member ordering reorders by Move up / Move down only**, 100 members per page. Placing
   an Item takes a Position; moving one already placed does not.
8. **Two things are unreachable.** CNCORE-242: the A-Z bar cannot reach the 37 Items that sort
   before A. CNCORE-243: a logged-in Owner has no clickable route to their account, so Settings,
   Tasks, Devices and Log out can only be reached by typing an address.

## What is already built and waiting on data

This is the reason the root cause is worth fixing before anything is redesigned.

- **The Item page renders statements with their provenance.** A `Values` section lists each
  statement beside the source that said it (`External id 145377 provider-wiki`, `Released
  2013-11-23 provider-wiki`, `Sorts as ... CanonCore (sort name v1)`). An `image` or a
  `portrayed_by` would render the moment one existed.
- **Multi-placement is rendered everywhere.** `The Day of the Doctor (TV story)` sits in 61
  containers and its page says "61 appearances" with All / Imported tabs. The catalogue listing
  marks multi-placed rows with `#also-appears-in`, 20 of 100 on the first page. Search shows
  appearances inline: "Also appears in Theory:Timeline - 2010s #89 ... and 10 more appearances".
- **Groups works end to end.** Drawing one made the narrow control appear on `/` and `/works`,
  correctly absent while there were none. Putting Rose's timeline in it moved the scope to "1 item".
  A Group also binds providers ("Providers searched within Doctor Who universe").
- **Kinds work.** Creating one Character by hand made `?kind=character` read "1 item"; `?kind=person`
  gives a written empty state; `?kind=work` gives 8,052.
- **Search works across kinds** and names its own limitation on a miss: "An item known here under a
  different title -- a translation, or a name a source does not prefer -- is not found by it yet."
  Consistent with `aliases` holding 0 rows.
- **The live provider answers** through `/import`, and `/settings` holds a named provider and an
  allowlist.

## Constraints a fix has to respect

Read before proposing anything in the grilling.

- **ADR-0004** forbids a *collection kind*, not a non-`work` Container. Container-ness is
  `is_container`, a separate column, and `/new` offers Kind and Holds independently. So a Character
  that holds works in order is ALREADY legal.
- **`items_freeze_kind`** (migration 11) refuses any change to `items.kind` at the table, so the 465
  existing Containers cannot be relabelled by UPDATE. **ADR-0077 anticipated exactly this**:
  "whatever first wants a kind to be editable has to DROP `items_freeze_kind`, and the drop is where
  the `holds_work` reprojection gets written." ADR-0077 is `proposed`, and its second question
  (catalogue search) is why.
- **ADR-0026** makes matching its own operation. Importing `created_by` naively mints a fresh person
  per import, which `import.ts` calls "worse than not having them".
- **ADR-0033** is the story filter. Admitting the wiki's entity pages means changing what the
  provider offers, not what the catalogue accepts.
- **ADR-0005** puts anything finer than the seven kinds in a `category` statement.
- **ADR-0119** caps every listing and requires the cap be named to the reader.

## Six hypotheses that were wrong

Recorded so they are not re-derived. Each looked like a defect. **Five are deliberate. The second
was not, and it is left standing here rather than deleted because HOW it was cleared is the thing
worth keeping** (CNCORE-256, [[0165-a-picker-reaches-past-its-cap-through-the-listings-own-search]]).

1. `/` says 8,052 and `/works` says 8,026. The 26 are Containers that hold no work; the predicate is
   ADR-0077's and the database returns exactly 26.
2. The by-hand placement picker offers 100 of 8,052 with no search. **THIS WAS A REAL DEFECT AND
   THIS ENTRY CLEARED IT WRONGLY.** What was checked is that the cap is NAMED -- "Showing 100 of
   8052 items. Search for one to place it from its own page." -- which is ADR-0119's own rule and
   which the page kept correctly. What nobody checked is the rest of the sentence: **an Item's own
   page offered no way to place it into anything**, so the remedy named did not exist and 7,952
   Items could not be placed at all. A cap that is named and a remedy that exists are two claims,
   and satisfying the rule that was in mind says nothing about the half no rule covered. Fixed under
   CNCORE-256: the picker carries the catalogue's own search, and the notice names it.
3. `?kind=nonsense` echoes the parameter. It goes through `<TheirWords>`, React-escaped.
4. The letter empty state interpolates `letter` only when it is in `THE_ALPHABET`, with the
   reasoning written beside it.
5. The 2,907-member container was expected to struggle. It paginates at 100 and loads in ~2.3s.
6. The `In Groups` form looked broken after `orca click` reported success and wrote no row.
   `form.requestSubmit()` wrote it first time. That was the automation, not the product.

## Left on the install

Three rows written while testing, all reversible: the Group `Doctor Who universe`, its one
membership (Rose's timeline), and a hand-made `Rose Tyler` of kind `character`.

## The empty catalogue is better designed than the full one

Measured on a blank throwaway instance, 2026-09-20, after the walk above. It matters to the grilling
because it locates the problem precisely: **the first-run journey is good and the at-size journey is
not**, so what is missing is not care about the reader.

Every empty state on a fresh install explains itself and links to its own fix. `/` carries "No
provider is allowlisted" and "This catalogue is empty" and links to `/settings`. `/works` says
"Nothing to watch yet" and explains why Entities are excluded from it. `/groups` says the catalogue
has not been divided into scopes. `/import` distinguishes "No provider is allowlisted" from "No
provider is configured", which are two different problems with two different remedies. `/new` tells a
visitor only the Owner can add, and offers the login.

So the product knows how to orient somebody. It stops doing it the moment there is data:

- the front page's links to `/settings` are part of the EMPTY state, so the Owner's route to their own
  settings disappears with the first Item (this is what makes CNCORE-243 worse than it looks)
- nothing replaces those notices with an orientation for a catalogue that HAS 8,052 Items
- the first screen goes from three explained sentences to an alphabetical list opening on
  `£436 (short story)`

One first-run defect was found and filed as CNCORE-244: the allowlist refusal names the requirement
and then offers a remedy that cannot work, so an Owner configuring their first Provider on a private
network does exactly what they are told and is refused again.

## For the grilling

The Owner's direction, in their words: every imported Item should already be in a Doctor Who
universe Group, and the sorting things are wanted, by character among others. Open:

- What is the first screen, and what can a reader walk down from it?
- Does a Group arrive from the import, and is it the provider, the continuity, or something the
  Owner names?
- Do the 465 timelines become the entities they describe, and if so what happens to the 30,896
  placements that currently hang off them?
- What supplies images, given the wiki is the only provider reaching this install?
- Is the reader's title separable from the source's title, or does the plumbing in a title get
  fixed at the source?
