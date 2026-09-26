# A census of Tardis Wiki namespace 0, 2026-09-21

Evidence for project 5, "The data". The Owner wants "a page for everything available on Tardis
Wiki" and nobody had measured what is there. This counts namespace 0 and breaks the non-story
remainder down by what each page is.

Measured against the live wiki over the MediaWiki action API, from a Cloudflare-cleared session the
Owner minted the same day. Every figure below carries the query that produced it. Where a sentence
is judgement rather than measurement, it says so.

**Two house rules from `provider-wiki/scripts/measure-live.ts` are kept here**, because this note
exists to correct a figure that broke both. Every count is printed beside its filter, and **no two
counts are ever subtracted**: a difference counts something only when both figures come from one
population.

## The contradiction, and why none of the three figures is wrong

The brief that commissioned this note said the API reports 128,281 articles and 374,028 pages while
our records say ns 0 holds 40,696 pages, 14,285 stories and 26,411 non-stories. All three numbers
are accurate. They are three different populations, and two of them are not ns 0.

| Figure | Value | What it counts | Query |
|---|---|---|---|
| `pages` | 374,028 | every page in **all 40 namespaces**, redirects included | `meta=siteinfo&siprop=statistics` |
| `articles` | 128,281 | ns 0, non-redirect, meeting `$wgArticleCountMethod` | same call |
| ns-0 non-redirect | **128,736** | walked and counted | `list=allpages&apnamespace=0&apfilterredir=nonredirects&aplimit=max`, 321 calls |
| ns-0 redirects | **31,583** | walked and counted | same, `apfilterredir=redirects`, 159 calls |
| **ns-0 total** | **160,319** | the real size of namespace 0 | the two walks above, counted separately |

**40,696 was never the size of ns 0.** `archive.ts`, under *The closed vocabulary of story
disambiguation terms*, says "Of the 40,696 ns 0 pages **with a non-null medium**" — pages whose
title ends in a parenthetical. That is 25.4% of the namespace. The qualifier survives in
`walking-the-owners-install.md`, under *The one root cause*, and was dropped somewhere after.

Re-running `provider-wiki`'s own rule — `STORY_DAB_TERMS` and `DAB_PREFIX`, transcribed from
`archive.ts` and applied to today's titles — over exactly that population reproduces it:

| ns 0, medium non-null, redirects kept | `archive.ts`, 2026-09-10 | live, 2026-09-21 | drift |
|---|---|---|---|
| pages | 40,696 | **40,775** | +79 |
| admitted as stories | 14,285 | **14,319** | +34 |
| rejected | 26,411 | **26,456** | +45 |
| redirects among the admitted | 1,494 | **1,513** | +19 |
| non-redirect population | 34,580 | 34,628 | +48 |
| non-redirect stories | 12,791 | 12,806 | +15 |

The rejected-term league table matches almost to the unit: `disambiguation` 1,382 → **1,385**,
`people` 898 → **898**, `releases` 810 → **810**, `production` 808 → **808**, `in-universe`
800 → **804**. Eleven days of wiki growth, and the rule is intact.

**The 455-page gap between `articles` (128,281) and the walked 128,736 is NOT the article-count
method.** `$wgArticleCountMethod='link'` would exclude ns-0 pages carrying no internal link, and
`list=querypage&qppage=Deadendpages` returns **zero** results (cached 2026-09-21T15:00:07Z), so no
such page exists. The remaining explanation is drift in MediaWiki's incrementally maintained
`site_stats` counter, which cannot be confirmed without server access and is **not asserted here**.

## The number that should change the plan

**The non-story population is 115,930, not 26,411.**

| | pages | filter |
|---|---|---|
| ns-0 non-redirect | 128,736 | walked |
| less stories | −12,806 | `isStoryPage`: ns 0, not a redirect, story dab term |
| **non-story, non-redirect** | **115,930** | counted directly, not subtracted across populations |

Of those, **94,108 carry no parenthetical at all**, so they were never in the 40,696 denominator in
any form. `Tardis:Disambiguation` (`T:DAB`) is why: "Pages having to do with stories **always** get
a disambiguation term. Pages about **in-universe topics don't get disambiguated at all**, unless
there are two or more in-universe terms with that same name." `Castrovalva` is the city and
`Castrovalva (TV story)` the serial, "even though the TV serial is linked far more often". So the
unbracketed majority is where the entities live, by the wiki's own policy.

## What the non-story pages are

**Measured by infobox transclusion, which is the wiki's own typed assertion.**
`list=embeddedin&eititle=Template:Infobox <X>&einamespace=0&eifilterredir=nonredirects&eilimit=max`,
walked once per template over all 30 real templates. **Only 3 pages in ns 0 carry two infoboxes**,
so this is a partition rather than an overlapping estimate.

| CanonCore kind | pages | the wiki's infobox |
|---|---|---|
| **Character** | 23,653 | `Infobox Individual` |
| **Person** | 5,315 | `Infobox Person` |
| **Place** | 3,427 | `Infobox Location` 3,374, `Filming Location` 53 |
| **Concept** | 3,246 | `Infobox Object` 3,244, `Anatomy` 2 |
| **Species** | 1,919 | `Infobox Species` |
| **Organisation** | 1,013 | `Infobox Organisation` 808, `Company` 205 |
| **Time span** | 560 | `Infobox Event or Conflict` |
| *entities, subtotal* | **39,133** | |
| real-world events | 40 | `Infobox Event or Exhibition`, which these rows counted as 40 more Time spans and a subtotal of 39,173 until CNCORE-431 found every page a real concert or exhibition |
| production / release | 6,942 | `Magazine` 3,231, `Audio Series` 778, `Documentary` 623, `Reference Book` 441, `Merchandise` 365, `Crossover` 310, `Music` 109, `Series` 67, `Match` 13, `Website` 3 |
| **no infobox at all** | **69,815** | — |
| stories | 12,806 | the dab rule |
| **ns-0 non-redirect** | **128,736** | |

`CONTEXT.md`'s **Character** headword folds Species in ("A fictional individual or group,
**including species**"), so in the product's own six kinds that block reads Character 25,572,
Person 5,315, Place 3,427, Concept 3,246, Organisation 1,013, Time span 600.

### The 69,815 without an infobox are untyped AT SOURCE

This is a fact about the wiki, not a gap in the measurement. Compare two pages through
`action=browsebysubject`:

| page | infobox | SMW properties it carries |
|---|---|---|
| `Refiloe` | none | `_INST`, `_MDAT`, `_SKEY` — housekeeping only |
| `Rose Tyler` | `Infobox Individual` | `Actor`, `Father`, `Mother`, `Child`, `Spouse`, `Species`, `Job`, `Affiliation`, `First_appearance`, `Partner`, `Grandparent`, `Adoptive_father`, `Other_actor`, `Has_vid`, `Corresponding_Wikipedia_link` |

**The infobox is both the kind assertion and the sole source of structured data.** A page without
one carries a title and prose and nothing a consumer can read. 58,846 of 128,736 ns-0 non-redirect
pages carry an infobox; the other 69,890 do not. So "a page for everything" arrives with structured
data for **46%** of the namespace.

**The infobox is a summary by policy, which bounds what an import can expect.** `Tardis:Infoboxes` (`T:IBOX`): infoboxes "should be only a summary of what's in the article", and "if a thing is controversial, you generally shouldn't put it in the infobox... such as whether a character is or is not a companion in a particular story". So the structured layer is deliberately the uncontroversial subset, and the nuance lives in prose that no property carries.

A sample of 40 of the untyped pages is mostly entities with short articles — `Refiloe`,
`Great Mother`, `Ikoran`, `Margery Lovett` (characters); `Michael Yeowell`, `Derek Wright` (real
crew); `Hampstead High School`, `Germany-Switzerland border` (places); `Physics`, `Extradition`,
`First aid` (concepts) — so the entity total of 39,173 is a **floor**, not the true figure.

**Category ancestry cannot close that gap, and this note does not try.** The attempt was made and
abandoned: the in-universe category graph is so densely cross-linked that a priority walk up it
classifies `Vacuum cleaner` as a Species (`Technology from the real world` → `Human technology` →
`Humans` → `Sapient Earth species` → `Species by planet` → `Species by location` → `Species`),
`Spoon` as a Place (`Cooking utensils` → `Cooking and cuisine` → `Home` → `Locations by function` →
`Locations`) and `Tom Collins` as a Time span (`Alcoholic beverages from the real world` → … →
`Temporal theory` → `Time`). Those are the wiki's own edges. Inventing a classifier to compensate
for them would be CanonCore deciding what the source declined to say, which is the opposite of what
a provider is for.

## The four branches, which the wiki states and mostly keeps

`Tardis:Category tree` (`T:TREE`) says every category nests up to `Category:Floor 500` through
exactly four branches, and that "articles that are in one of these four categories should not go
into another of them". `Floor 500`'s children are exactly those four, confirmed against
`cat_parents.tsv`.

Walking all 311,866 distinct (page, category) pairs up the DAG, **cutting only the maintenance tag
categories** — a category whose own upward reach is exactly `{The Hub}`, which catches
`Categories requiring diffusion` and `Hidden categories` but not `Species`:

| branch | ns-0 non-redirect pages |
|---|---|
| **Time-Space Visualiser** (in-universe) | **85,076** |
| **Real world** (production, crew, releases) | **41,568** |
| **Non-DWU material** | **2,053** |
| The Hub | **0** |
| reaches none | 2,046 |

Pages in two branches: 2,007, or 1.6%. So `T:TREE` holds. **The Hub containing zero ns-0 articles
is the policy working**, not a measurement failure: the branch is for pages that run the wiki.

Without the cut, 77,997 in-universe pages also reach The Hub, because `T:CAT`'s own
`{{cat diffusion}}` mechanism files ordinary topical categories under `Category maintenance`. That
is worth knowing before anyone reads the raw graph and concludes the policy is dead.

**`Non-DWU material` matters to the provider.** It holds licensed material the wiki does not treat
as a valid source. `T:TREE` names `Dr. Who and the Daleks (theatrical film)` as an example, but in
prose only: the walk of the category does not reach that page (CNCORE-350, 2026-09-26).
`Doctor Who and Crayola (TV story)` is one the walk does reach, and it carries a story dab term, so
`isStoryPage` admitted it. **The provider was importing 650 of the 2,053 pages the wiki classes as
outside its universe** (CNCORE-350, 2026-09-26), and nothing downstream could tell. ADR-0205 made
`storyKind` refuse the branch.

## Disambiguation pages: 1,344, and two mechanisms agree exactly

| measure | pages |
|---|---|
| flagged by the Disambiguator extension (`prop=pageprops&ppprop=disambiguation`) | **1,344** |
| in `Category:Disambiguation pages` | **1,344** |
| flagged but not in the category | 0 |
| in the category but not flagged | 0 |

None carries an infobox; none is admitted as a story. 1.04% of ns-0 non-redirects.

## Two story definitions ship in one repository, disagreeing on 2,515 pages

`archive.ts`'s `isStoryPage` and `scripts/measure-live.ts` do not define a story the same way, and
both are current.

| definition | ns-0 non-redirect |
|---|---|
| A — `isStoryPage`: ns 0, not a redirect, story dab term (**what the provider serves**) | **12,806** |
| B — transcludes `Template:Infobox Story SMW` (**what the repo measures**) | **11,307** |
| agree | 10,799 |
| in A, not in B | **2,007** — 899 `Documentary`, 878 `Infobox Story`, 140 `Reference Book`, 75 no infobox, 11 `Merchandise`, 3 `Object`, 1 `Magazine` |
| in B, not in A | **508** |
| **disagreement** | **2,515** |

B reproduces `measure-live.ts`'s own figure under *THE POPULATION, DEFINED ONCE* — it measured
11,297 on 2026-09-13, and this pass reads **11,307**, +10 in eight days. So the divergence is
between the two rules, not between two measurements.

### The dab rule refuses 1,003 story-infobox pages, and `DAB_PREFIX` alone 156 in-universe works

1,003 pages carry a story infobox (`Infobox Story SMW` 508, `Infobox Story` 495) that the dab rule
rejects **for any reason**, including the no-parenthetical and missing-vocabulary rows below.
`DAB_PREFIX` ALONE refused 534 pages (CNCORE-350, 2026-09-26): 334 under `Non-DWU material`, where
`Unproduced sources` puts `The Hand of Omega (unproduced TV story)`, 156 in-universe works, and 44
characters and objects. ADR-0205 has the table. `DAB_PREFIX` is `^[A-Z0-9]+( [A-Z0-9]+)*$`, which admits only all-caps or numeric prefixes:

| rejected title | why |
|---|---|
| `The Time Meddler (TotT TV story)` | `TotT` is mixed case |
| `Square One (Gallifrey audio story)` | `Gallifrey` is an ordinary word |
| `The Hand of Omega (unproduced TV story)` | `unproduced` is lowercase |
| `The Time of Angels (photo novelisation)` | `photo` is lowercase |
| `Skaro (Doctor Who Atlas feature)` | multi-word mixed-case prefix |
| `Purity of the Daleks (LiT story)` | mixed case **and** `story` is not in `STORY_DAB_TERMS` |
| `Doctor Who and the Library of Time (anthology)` | `anthology` is not a term at all |
| `SJAF 1`, `Doctor Who Annual 2006`, `Roblox` | no parenthetical at all |

`archive.ts`, under *A dab term may carry a citation prefix*, argues the prefix check is
load-bearing because without it `The Long Game` ends in `game`. That argument holds. The pattern
buys it at the cost of roughly a thousand real stories, and the `(LiT story)` and `(anthology)`
cases are missing vocabulary rather than a prefix problem.

### `STORY_DAB_TERMS` against its own authority

`Tardis:Disambiguation term` (`T:DAB TERM`) is the source the constant was transcribed from. Two
differences:

- **`(episode)`** is in `STORY_DAB_TERMS`, but T:DAB TERM lists it under ***Don't* use**, with one
  exception — Hartnell episodes sharing a serial's name, like `An Unearthly Child (episode)`. The
  constant admits every `(episode)` page.
- **`stage play`** is in `STORY_DAB_TERMS` and is **not in T:DAB TERM's table at all**.
  `Template:Infobox Story/doc/stage play` exists, so the term is real, but the authority does not
  document it.

`(CON episode)` and `(DWE episode)` are genuine story terms never transcribed, but `DAB_PREFIX`
catches them, since `CON` and `DWE` match. No defect there.

The table's non-story terms are explicit and correctly excluded: `(species)`, `(mythology)`,
`(in-universe)`, and `(book)`/`(film)`, which it reserves for "**In-universe** discussion about
books and films *within* the DWU".

## Why six of seven item kinds are empty, in two places rather than one

`walking-the-owners-install.md` records that every one of the Owner's 8,052 Items is `kind: work`.
The census shows two independent mechanisms produce that, and fixing either alone changes nothing.

| layer | state | blocks entity kinds? |
|---|---|---|
| Tardis Wiki | 7 kind-bearing infoboxes, 39,173+ entity pages | no |
| `provider-wiki` `isStoryPage` | ns 0, not a redirect, story dab term | **yes** — entities never reach the seam |
| CMPP `RecordSchema.kind` | `z.string().min(1)`, an **open** string | no |
| `packages/db/src/import.ts` | `.values({ ownerId, kind: "work", … })` | **yes** — a Character record would still land as `work` |

**CMPP needs no change.** `cmpp.ts` sets `kind` as an open string for the same stated reason
`ImageSchema.role` is open: it carries "what the image is FOR, in the SOURCE'S OWN vocabulary. CMPP
closes no list of roles (ADR-0033)". The provider already emits the source's vocabulary —
`archive.ts` sets `kind: String(row.medium)`, so `TV story` reaches the seam today.

`import.ts` already explains the second block, under its import-mapping comment: "`kind` — the
provider's `TV story` — is finer than the seven item kinds, and ADR-0005 puts anything finer in a
`category` statement. That takes an item too, so it lands on the same matching question as the
writers." That is a decision with a reason, not an oversight. **The consequence worth recording is
that the data project is two changes in two repositories, and the second is gated on matching
(ADR-0026).**

## Two things for the Owner to rule on

Both are judgement, not measurement.

**1. `T:FTRW` splits real people in a way `CONTEXT.md` cannot express.** `Tardis:"Real world" versus
"from the real world"` distinguishes "real world \<topic\>", which exists only in the real world
(`Philip Hinchcliffe`), from "\<topic\> from the real world", which exists in both (`Marco Polo`,
`Paul McCartney`). `CONTEXT.md`'s **Person** headword says "A real human. Never a fictional one, which is what
lets a person portray a character." Marco Polo is a real human *and* a character in
`Marco Polo (TV story)`; the category `20th century people from the real world` holds 1,203 pages
and sits under `Humans`, i.e. in-universe. One wiki page must become two Items, or one Item whose
kind the rule forbids. This is plausibly a matching question (ADR-0026) rather than a kinds one.

**2. The 31,583 ns-0 redirects are alternative names, and the model has no word for them.**
`Tardis:Redirect` describes them as search aids, American spellings and honorific variants.
`CONTEXT.md`'s **Alias** headword is "the retained id of a merged-away item… an identity, **never an
alternative name**", so the word is taken and means something else. This is an unmodelled thing
rather than an empty table.

## Images: 40,930 of 128,736 pages carry one, and non-story pages do

Measured with PageImages over every ns-0 non-redirect page, `generator=allpages` with
`gaplimit=50&pilimit=50` so the two limits align. **Full coverage measured 2026-09-21: 128,736 of 128,736, none
missing.** `pageimage` is the page's LEAD image, which is not the archive's `Has image` (the
infobox image); the two answer different questions and are not interchangeable.

| group | pages | with image | share |
|---|---|---|---|
| production / release | 6,942 | 6,217 | **89.6%** |
| Person | 5,315 | 4,410 | **83.0%** |
| story | 12,806 | 8,515 | 66.5% |
| Time span | 600 | 379 | 63.2% |
| Concept | 3,246 | 1,943 | 59.9% |
| Species | 1,919 | 1,140 | 59.4% |
| Organisation | 1,013 | 491 | 48.5% |
| Place | 3,427 | 1,619 | 47.2% |
| Character | 23,653 | 8,888 | 37.6% |
| no infobox | 69,815 | 7,328 | 10.5% |
| **all ns-0 non-redirect** | **128,736** | **40,930** | **31.8%** |
| *of which entities* | 39,173 | **18,870** | **48.2%** |

**Non-story pages carry images, and Person (83.0%) beats stories (66.5%).** The Owner's install
holds zero images against 40,930 available. Cross-checked independently: SMW's `Has_image` reports
19,113 entity pages with an image against PageImages' 18,870 — two different mechanisms, 243 apart.

## The containers are already complete

| | count | query |
|---|---|---|
| `Theory:Timeline - X` pages on the wiki | **465** | `list=allpages&apnamespace=114&apfilterredir=nonredirects` |
| Containers in the Owner's install | **465** | `walking-the-owners-install.md`, *The corpus, as measured* |

Exactly equal. Of 1,241 Theory-namespace pages, 465 are timelines and the rest are discontinuity
essays. **There are no more orderings to fetch.** The ordering backbone is finished and the entire
remaining gap is on the item side: 12,806 of 128,736.

## Which empty CanonCore properties the wiki can fill

All 39,176 entity pages through `Special:ExportRDF` (POST, 500 titles per batch, 79 batches). Nine
of CanonCore's thirteen properties are at zero on the Owner's install.

| CanonCore property | wiki source property | entities | share |
|---|---|---|---|
| **appears_in** | `First_appearance`, `Only_appearance`, `First_mention` | **32,714** | **83.5%** |
| **category** | `Species`, `Job` | **22,042** | 56.3% |
| **image** | `Has_image` | **19,113** | 48.8% |
| **portrayed_by** | `Actor`, `Main_actor`, `Main_TV_actor`, `Main_voice_actor`, `Other_actor` | **13,024** | 33.2% |
| **part_of** | `Affiliation`, `Series` | 6,457 | 16.5% |
| note | `Corresponding_Wikipedia_link` | 194 | 0.5% |
| created_by | `Creator` | **0** | 0.0% |
| based_on | `Adapted_from` | **0** | 0.0% |
| credited_to | `Director`, `Producer`, `Executive_producer`, `Writer` | **0** | 0.0% |
| **any property at all** | | **38,487** | **98.2%** |

**Five of the nine have real data; three have none and never will from entities** — `created_by`,
`based_on` and `credited_to` are story-side properties. Coverage of at least one of appears_in /
image / portrayed_by, by kind: Character 99.4%, Species 98.8%, Concept 98.4%, Place 96.0%,
Organisation 91.5%, Time span 87.7%, Person 83.2%.

## The entity pages are not stubs

`prop=info` over all 128,736 ns-0 non-redirect pages, byte length of the wikitext.

| group | pages | median | mean | under 500B | over 5kB |
|---|---|---|---|---|---|
| story | 12,806 | 3,188 | 6,148 | 0.2% | 30.9% |
| Time span | 600 | 3,672 | 8,746 | 0.3% | 39.8% |
| production / release | 6,942 | 2,510 | 3,814 | 0.9% | 17.0% |
| Organisation | 1,013 | 1,788 | 4,379 | 3.2% | 19.8% |
| Species | 1,919 | 1,657 | 3,688 | 4.1% | 15.7% |
| Place | 3,427 | 1,344 | 2,551 | 5.6% | 10.1% |
| Person | 5,315 | 1,327 | 2,056 | 4.1% | 5.4% |
| Concept | 3,246 | 1,282 | 2,756 | 7.2% | 11.7% |
| Character | 23,653 | 950 | 2,084 | 5.5% | 5.0% |
| no infobox | 69,815 | 506 | 1,255 | **49.3%** | 3.2% |
| **entities** | **39,176** | **1,104** | 2,416 | **5.2%** | 7.5% |

Only 5.2% of entity pages are under 500 bytes, against 49.3% of the untyped ones. By the wiki's own
stub tagging the same holds: 11.6% of entities are stub-tagged against 34.9% of stories — though
`Tardis:Stub` says "you should assume that articles about characters are *not* stubs", so that tag
is deliberately conservative for the largest entity kind, which is why byte length is measured
beside it.

## Multi-placement is not a story-only phenomenon

Category membership per page, the same measure `measure-live.ts` uses for stories under its
`placement` phase.

| group | pages | in more than one | share | mean | max |
|---|---|---|---|---|---|
| stories | 12,806 | 12,273 | 95.8% | 4.6 | 52 |
| **entities** | **39,176** | **28,976** | **74.0%** | 3.0 | 157 |
| no infobox | 69,815 | 32,737 | 46.9% | 1.7 | 34 |
| all ns-0 non-redirect | 128,736 | 77,972 | 60.6% | 2.4 | 157 |

Deepest: `Nicholas Briggs` 157, `The Doctor` 143, `The Master` 82, `River Song` 73. Three quarters
of the population the provider currently refuses already sits in more than one container, which is
the case ADR-0009 rests on.

## Where the 31,583 redirects point

Each redirect's single ns-0 outgoing link is its target.

| | redirects |
|---|---|
| to an **untyped** page | 12,437 |
| to an **entity** | 10,446 |
| to a story | 6,192 |
| to a production/release page | 1,933 |
| resolved with exactly one ns-0 link | 31,008 |
| pointing outside ns 0 entirely | 453 |

Most alternative names on one entity: `Cwej (species)` 335, `Time Lord` 54, `First Doctor` 43,
`Eighth Doctor` 37. This is the corpus with no name in the model: `CONTEXT.md`'s **Alias** headword
is reserved for merge identity, so these are unmodelled rather than missing.

## The rest of the 374,028

| namespace | pages |
|---|---|
| 0 main | 160,319 |
| 14 Category | 31,738 |
| 114 Theory | 1,272 |
| 112 Howling | 960 |
| 4 Tardis | 406 |
| 12 Help | 144 |
| 120 Guide | 15 |
| 116 Transmat | 8 |
| 108 Concept | 0 |

File namespace holds 86,651 uploads (`siteinfo`), not walked.

## Field-level inventory: every SMW property on an entity page

A separate live pull, `Special:ExportRDF` by POST, 500 titles per batch, 79 batches over all
**39,176** entity pages. **89 distinct properties.** Reported as DATA SHAPES rather than as domain
concepts, because CanonCore is domain-general and the shape is what the model has to hold.

| shape | properties | what CanonCore would need |
|---|---|---|
| page reference | 67 | a relation to another Item, so ADR-0026 matching applies |
| URL | 7 | an external link, note SMW emits these as `rdf:resource` too |
| text | 6 | a literal statement value |
| date | 5 | an EDTF value under ADR-0073 |
| file reference | 2 | `File:` or `Video:` |
| number | 2 | a literal |

### By infobox type, properties on 1% or more of pages

| Character, n=23,653 | % | shape |
|---|---|---|
| `First_appearance` | 92.6% | page reference |
| `Species` | 90.1% | page reference |
| `Has_image` | 36.9% | file reference |
| `Main_voice_actor` | 33.3% | page reference |
| `Job` | 28.0% | page reference |
| `Affiliation` | 24.9% | page reference |
| `Actor` | 19.6% | page reference |
| `First_mention` | 9.2% | page reference |
| `Spouse` / `Child` / `Father` / `Mother` | 6.9 / 6.2 / 5.2 / 4.6% | page reference |

| Person, n=5,315 | % | | Place, n=3,427 | % |
|---|---|---|---|---|
| `Has_image` | 83.2% | | `First_appearance` | 86.5% |
| `Imdb` | 81.8% (URL) | | `Has_image` | 49.1% |
| `Twitter` | 27.9% (URL) | | `First_mention` | 18.5% |
| `Instagram` / `Website` | 11.9% (URL) | | `Has_vid` | 4.2% |

| Concept, n=3,249 | % | | Species, n=1,919 | % | | Organisation, n=1,013 | % |
|---|---|---|---|---|---|---|---|
| `First_appearance` | 85.7% | | `First_appearance` | 94.2% | | `First_appearance` | 64.5% |
| `Has_image` | 65.1% | | `Has_image` | 64.4% | | `Has_image` | 54.4% |
| `First_mention` | 13.4% | | `Affiliation` | 29.9% | | `Website` | 9.3% |

**Time span (n=600) is the only kind carrying real dates**: `Event_date` 3.3%, `Opening_date` and
`Closing_date` 3.0%, `Release_date` 1.2%, all `date` shape, e.g. `2008-07-27`.

### Onto CanonCore's thirteen

| CanonCore property | source | wiki properties | entity pages |
|---|---|---|---|
| `title` | the page | the title itself | 39,176 |
| `sort_name` | derived | from the title | 39,176 |
| `external_id` | the page | the wiki page id | 39,176 |
| `appears_in` | SMW | `First_appearance`, `First_mention` | **34,180** |
| `category` | SMW | `Species`, `Job` | **27,938** |
| `image` | SMW | `Has_image` | **19,113** |
| `portrayed_by` | SMW | `Actor`, `Main_TV_actor`, `Main_voice_actor`, `Other_actor` | **13,489** |
| `part_of` | SMW | `Affiliation` | 6,457 |
| `note` | SMW | `Counterpart_override`, `Incarnation_override` | 99 |
| `released` | SMW | six date properties | 78 |
| `credited_to` | SMW | `Music`, `Host`, `Conductor`, `Featuring` | 36 |
| `created_by` | SMW | **none present** | 0 |
| `based_on` | SMW | **none present** | 0 |

### The gap: 65 of 89 properties have no home

| shape the thirteen cannot express | properties | page-properties |
|---|---|---|
| **a typed relation between two Items** | 21 | **8,236** |
| a set of typed external links | 8 | 3,091 |
| non-image media reference | 1 | 1,491 |
| "this Item is a variant of that Item" | 3 | 349 |
| long tail | 32 | 187 |
| **total** | **65** | **13,354** |

**The largest gap is that CanonCore has no general typed Item-to-Item relation.** `part_of` and
`appears_in` are its only two and both are fixed in meaning, so 21 distinct relation types have
nowhere to go. Second, `external_id` is a SINGLE identity used for provider matching, not a set of
typed external links, so eight link properties are homeless. Third, `image` is image-only, so 1,491
video references are lost. Fourth, there is no "variant of" relation, which is distinct both from
`CONTEXT.md`'s **Alias** headword (merge identity) and from its **Repeat** headword.

`Has_image` values carry the wiki's own doubled-prefix typo (`File:File:...`), which
`measure-live.ts` already records under its `images` phase: a malformed value, not a missing file.

## ADR-0057's own figures, re-checked live

`0057-the-archive-stays-outside-the-repo.md`, under *The wiki, measured*, carries figures taken
2026-09-13. Three of them are checkable from this census's data and all three reproduce as growth:

| claim | ADR, 2026-09-13 | live, 2026-09-21 | delta |
|---|---|---|---|
| categories in the graph | 28,759 | **28,918** | +159 |
| child-to-parent edges | 45,569 | **45,740** | +171 |
| categories under more than one parent | 13,229 | **13,342** | +113 |
| **triples on story pages** | **206,907** | **207,091** | **+184** |
| **distinct properties** | **559** | **564** | **+5** |
| story pages in the population | 11,297 | 11,307 | +10 |

**ADR-0057 REPRODUCES.** All six figures are eight days of growth and nothing is contradicted.

**A FALSE CORRECTION WAS AVOIDED, AND HOW MATTERS.** A first pass at the triple count read
**205,470 over 541 properties**, which is BELOW the record and would have read as a contradiction
in an accepted ADR. It was wrong twice over, both faults in the measurement rather than the record:
the property regex was narrower than `live-wiki.ts`'s and missed `wiki:Property-3A` elements, and
subjects were filtered to the story population when `measure-live.ts` counts every subject the
response carries. Reproducing a figure means reproducing its METHOD, not just its population, and
the method here is `scripts/live-wiki.ts`'s own `SUBJECT` and `PROPERTY` patterns.

A second trap, checked and ruled out on the way: `Special:ExportRDF` returns only about **73%** of
the values the SMW store holds, measured over 20 sampled story pages (407 values in the store
against 297 in the export, and `Rose (TV story)` alone is 119 against 93). That does NOT invalidate
the comparison, because ADR-0057's figure came from the same `exportRdf` path, so both sides
under-report identically. It does mean **no triple count taken this way is the store's true total**,
and a figure quoted as "the wiki holds N triples" would be wrong by about a quarter.

A note on populations, because the numbers look close to a different one: `list=allcategories`
returns **31,738** category PAGES, while the graph above counts nodes appearing in a parent-child
edge. Those are different populations and the smaller is not a subset error.

## All three typed populations, counted the same way

Counted with `live-wiki.ts`'s own regexes so every row is comparable to ADR-0057.

| population | pages | triples | distinct properties | per page |
|---|---|---|---|---|
| entity | 39,176 | 166,856 | 96 | 4.3 |
| story | 11,307 | **207,091** | **564** | **18.3** |
| production / release | 8,366 | 45,166 | 167 | 5.4 |
| **total** | **58,849** | **419,113** | **718** | 7.1 |

**Story pages are four times richer than entity pages** — 18.3 properties per page against 4.3 —
because the wiki's crew vocabulary lives there: 479 of the 718 properties appear on story pages
alone. Only **20** properties are shared by all three populations.

| properties | count |
|---|---|
| unique to story pages | 479 |
| unique to production pages | 85 |
| unique to entity pages | 65 |
| shared by all three | 20 |

For scale, ADR-0057 records the deleted archive as holding 518,768 triples over 715 properties
CORPUS-WIDE. This pass reads 718 properties over the three TYPED ns-0 populations, so the property
vocabulary is essentially the same size while the triple count is lower, which is what a narrower
population should do.

## Entity fill, re-measured under CNCORE-377

Taken 2026-09-26 against the live wiki, because the dataset frozen for this note had been deleted by
then and the per-property figures behind the entity/story comparison above went with it. What it
decided is `docs/adr/0204-an-entity-page-is-drawn-against-what-entities-carry.md`, and the fill
rate at 1% or more is `.claude/rules/entity-surfaces.md`, where a page gets laid out. This section
holds the method, the controls and the rest.

**The populations**, each ns 0, non-redirect, from `list=embeddedin&einamespace=0&eifilterredir=nonredirects`:

| population | infoboxes | pages |
|---|---|---|
| entity | `Individual`, `Person`, `Location`, `Filming Location`, `Object`, `Anatomy`, `Species`, `Organisation`, `Company`, `Event or Conflict`, `Event or Exhibition` | 39,209 |
| story | `Story SMW` | 11,310 |
| production | `Magazine`, `Audio Series`, `Documentary`, `Reference Book`, `Merchandise`, `Crossover`, `Music`, `Series`, `Match`, `Website`, `Story` | 8,371 |

`list=allpages&apnamespace=10&apprefix=Infobox` lists 30 infobox templates; 23 are transcluded in
ns 0 and the table uses all 23. Transclusions and distinct pages are equal in every population, and
the three ns-0 pages carrying two infoboxes all sit in story AND production: `Interference (novel)`,
`Children in Need 1983 (TV story)`, `The Visual Dictionary (reference book)`.

**The pull** is `live-wiki.ts`'s `exportRdf` over each population in 500-title batches: 23 for
story, 17 for production, 79 for entity. Every figure is counted two ways and they differ only by
SMW subobjects:

| population | every subject the export carries | the population's own pages | subobjects |
|---|---|---|---|
| entity | 166,930 triples, 96 properties | 165,618 triples, 92 properties | 328 `# QUERY` records, 1,312 triples |
| story | 207,141, 565 | 207,139, 563 | 1 `# ERR` record |
| production | 45,171, 167 | 45,169, 165 | 1 `# ERR` record |

Story-only 479 and shared-by-all-three 20 under both counts; entity-only 64 counting subobjects and
60 without. Against the 2026-09-21 figures under "All three typed populations, counted the same way"
the story triples moved 207,091 to 207,141 and the entity triples 166,856 to 166,930, which is five
days of wiki growth.

**Per page, housekeeping aside.** Distinct properties per page, leaving out
`Modification date#aux`, `Display title of`, `Has query`, `Have links been moved`,
`Proposed new name`, `User proposing speedy rename` and the two `#aux` date twins:

| properties carried | entity pages | cumulative | story pages |
|---|---|---|---|
| 0 | 713 | 1.8% | 0 |
| 1 | 4,743 | 13.9% | 0 |
| 2 | 10,962 | 41.9% | 0 |
| 3 | 10,005 | 67.4% | 0 |
| 4 | 6,760 | 84.6% | 11 |
| 5 | 3,320 | 93.1% | 39 |
| 6 or more | 2,706 | 100% | 11,260 |
| **median** | **3** | | **11** |

**The controls**, each a census query run against a population that has to come back empty:
`embeddedin` on `Template:Infobox No Such Template 377` answered 0 pages; `exportRdf` over 500
titles of the form `CNCORE-377 no such page N` answered 0 triples over 0 subjects; the entity and
story populations share 0 pages; and the story-only set matches 0 triples on entity pages, which is
true by construction and would stay green over a pull that had spanned the whole wiki, so it is the
weakest of the four.

**The long tail**, every property on fewer than 1% of the entity population above, counted over the
population's own pages. Those at 1% or more are in `.claude/rules/entity-surfaces.md` and are not
repeated here.

| property | pages | | property | pages | | property | pages |
|---|---|---|---|---|---|---|---|
| `Grandparent` | 363 | | `Soundcloud` | 19 | | `Release end date#aux` | 6 |
| `Grandchild` | 316 | | `Closing date` | 18 | | `User proposing speedy rename` | 6 |
| `Other actor` | 228 | | `Opening date` | 18 | | `Adoptive sister` | 5 |
| `In-law` | 223 | | `Cousin` | 15 | | `Foster child` | 5 |
| `Has query` | 206 | | `Tumblr` | 14 | | `Foster mother` | 5 |
| `Counterpart` | 204 | | `Adoptive parent` | 13 | | `Network` | 5 |
| `Corresponding Wikipedia link` | 194 | | `Music` | 13 | | `Broadcast note` | 4 |
| `Youtube` | 132 | | `Nephew` | 12 | | `Foster sibling` | 4 |
| `Time Lord` | 85 | | `Host` | 11 | | `Nibling` | 4 |
| `Counterpart name` | 60 | | `Adoptive grandchild` | 10 | | `Vocalist` | 4 |
| `Sibling` | 60 | | `Mate` | 10 | | `Confidential` | 3 |
| `Counterpart override` | 54 | | `Adoptive grandparent` | 9 | | `Opening note` | 3 |
| `Adopted child` | 47 | | `Event end date` | 9 | | `Pibling` | 3 |
| `Pet` | 47 | | `Great-grandchild` | 9 | | `Adoptive sibling` | 2 |
| `Incarnation override` | 45 | | `Great-grandparent` | 9 | | `Bandcamp` | 2 |
| `Adoptive father` | 38 | | `Adoptive brother` | 7 | | `Closing note` | 2 |
| `Parent` | 30 | | `Release date` | 7 | | `Foster father` | 2 |
| `Niece` | 27 | | `Release date#aux` | 7 | | `Foster grandchild` | 2 |
| `Adoptive mother` | 25 | | `Conductor` | 6 | | `Foster grandparent` | 2 |
| `Aunt` | 25 | | `Featuring` | 6 | | `Interviewee` | 2 |
| `Bluesky` | 21 | | `Have links been moved` | 6 | | `Tiktok` | 2 |
| `Event date` | 20 | | `Proposed new name` | 6 | | `Release status` | 1 |
| `Uncle` | 20 | | `Release end date` | 6 | | `Spotify` | 1 |

The scripts ran from a scratch directory and were deleted with their output, as this note's own
dataset was: the populations, the batch size and the parsing rule above are the query that takes it
again.

## Method, and what it cost

- One request in flight at a time, 0.35s between calls, exponential backoff, `Retry-After`
  honoured. **No non-200 was returned at any point**, so the rate limiting recorded in
  `CLAUDE.md` was never reached.
- The credential was passed in a `0600` curl config file, never on a command line. An earlier
  version of the walker passed it as `curl -H`, which exposed it in `ps` output. **Do not put a
  cookie in argv.**
- Two figures were cross-checked by independent second passes: ns-0 non-redirects at 128,736
  against 128,742 from a separate walk, and disambiguation pages at 1,344 by two mechanisms that
  agreed exactly.
- **Nine pageids carried two different titles across two passes minutes apart.** The wiki was
  renaming pages during the census, which sets the precision floor: these figures are good to
  roughly ±10, not to the unit.
- `pnpm measure:live` in `provider-wiki` covers the story population in seven phases. It does not
  touch the non-story population, which is why this note exists.
- **The dataset is frozen at `~/canoncore/wiki-census-2026-09-21/`**, outside every repo so no
  commit can reach it: `data/` (every walk as TSV), `scripts/` (every walker and analysis script,
  so any figure here can be re-derived or a new question answered offline) and `policy/` (all 266
  `Tardis:*` pages in full). The credential is not in it, and the archive step refuses to complete
  if the cookie appears in anything it copied.
- Walks that had to be redone, recorded so nobody repeats them: `pilimit` defaults to **1**, so a
  500-page generator batch advances one image at a time — align `gaplimit` to `pilimit`. And
  `prop=redirects` returns redirects **to** a page, not a redirect's target; use the redirect's own
  outgoing link.
