---
status: proposed
---

# An entity page is drawn against what entities carry, and the thin page is its normal case

An entity surface is designed against the ENTITY population's own census, never against a story
page. Three rules follow from it:

- **The thin page is the normal layout, not the empty state.** An Item carrying a title, a kind, its
  Placements and a value or two is the page most entity readers meet, so it is drawn first as a
  whole page: a row for every value the Item carries, nothing for a property it does not, and its
  image where one exists.
- **Nothing on an entity layout is a property the census counts on story pages alone.** A layout
  that wants one has to show the census is wrong first.
- **A surface spanning the whole catalogue assumes a title, a kind and Placements, and nothing
  else.** The 20 SMW properties shared by entity, story and production pages are what such a
  surface can expect to meet on every kind of page. Being shared does not make one present.

The census, the per-property fill rate and the 20 shared properties by name are in
`.claude/rules/entity-surfaces.md`, which loads whenever `apps/web` or `packages/ui` is edited.
That is where somebody laying out a page already is, which a note under `docs/research/` is not.

## Why

Every page anybody on this project has looked at closely is a story page, and a story page is the
rich half of the source. Counted on 2026-09-26 over the live wiki with the method below, a story
page carries a median of 11 of the wiki's SMW properties, housekeeping aside, and an entity page
carries 3, and the table below shows entity pages outnumbering story pages more than three to one. A
page laid out against
a story renders mostly empty on the population it is actually for, and that failure reads as a
defect in the import rather than as a design taken against the wrong population.
[[0077-work-browsing-excludes-entities-by-kind]] is why entity surfaces exist at all: they answer
"what is in this catalogue" rather than "what can I watch". This record is what they are drawn
against.

The thin layout, image included, was drawn and agreed in the session that built CNCORE-377. Nothing
in this repository renders an image yet, and the Owner's install held none when the census was taken
on 2026-09-21, so the image slot is agreed and not built.

## The census, and how its figures are held

Every figure here carries its population and its date
([[0153-a-figure-about-this-tree-is-derived-or-dated]]), and the method is
[[0057-the-archive-stays-outside-the-repo]]'s: `Special:ExportRDF` by POST, 500 titles a batch,
parsed with `provider-wiki`'s `scripts/live-wiki.ts` patterns. The populations are the ns-0,
non-redirect pages transcluding the wiki's own infoboxes, walked with `list=embeddedin`:

| population | infoboxes | pages, 2026-09-26 | triples | distinct properties |
|---|---|---|---|---|
| entity | eleven, onto the six entity kinds ([[0005-seven-item-kinds]]) | 39,209 | 166,930 | 96 |
| story | `Infobox Story SMW` | 11,310 | 207,141 | 565 |
| production | ten production infoboxes and `Infobox Story` | 8,371 | 45,171 | 167 |

Across the three: 718 distinct properties, **479 on story pages alone** and **20 shared by all
three**. Both figures are the same on 2026-09-26 as on 2026-09-21, when CNCORE-377 was filed.

**THE EXPORT RETURNS MORE THAN THE POPULATION, and the fill rates are counted without the excess.**
The triple and property counts above are taken ADR-0057's way, over every subject the response
carries, so they stay comparable with that record. On the entity population that includes 328 SMW
subobjects -- `# QUERY` records of an inline query on a page, carrying `Query string`, `Query size`
and two more -- worth 1,312 triples and four properties that no entity page carries. Counted over
the population's own pages instead, entities carry 165,618 triples over 92 properties. The 479 and
the 20 come out the same either way; the per-property fill rates use the population's own pages.

**ADR-0057's 73% caveat holds here too.** `Special:ExportRDF` returns about three quarters of what
the SMW store holds, so these are export counts and not store totals. They compare populations
fairly because every population was taken the same way.

## Each census query was run where it should find nothing

A count that silently spans the whole wiki satisfies every rule above while measuring the wrong
thing, which is the first way [[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]]
names for an assertion to go hollow. So each query was run on 2026-09-26 against a population that
must come back empty, and each did:

| query | run against | answer |
|---|---|---|
| the population walk, `list=embeddedin` | an infobox that does not exist | 0 pages |
| the property pull, `Special:ExportRDF` | 500 titles that do not exist | 0 triples, 0 subjects |
| the entity population | the story population | 0 pages in both |
| the story-only set | the entity population's own pages | 0 triples |

The fourth is true by construction once the first three hold, and it is listed for that reason: it
would still be green over a pull that had reached the whole wiki. The first three are the ones that
could have failed.

## Two figures were in circulation, and the ticket reconciled them wrongly

CNCORE-377 as filed on 2026-09-21 said the census counts **39,176** entity pages carrying an infobox
while the import population is **39,173** subjects, "and the difference is the three pages carrying
two infoboxes". **Measurement refuses the second half.** The three ns-0 pages carrying two infoboxes
on 2026-09-26 are `Interference (novel)`, `Children in Need 1983 (TV story)` and
`The Visual Dictionary (reference book)`, and each pairs `Infobox Story SMW` with a production
infobox. None is an entity page, and no entity page carries two entity infoboxes. The census counted
three such pages on 2026-09-21 without naming them, which matches the gap between its 58,849 typed
pages, counted per population, and its 58,846 pages carrying an infobox. That they are the same
three is inferred from the count, not checked.

The census's own tables are consistent with a different reading of the entity gap: its field-level
inventory counts Concept at 3,249 pages where its partition counts 3,246, and those two walks were
taken at different times on a wiki the census records renaming pages as it ran. The raw walks were
deleted with the census dataset, so that is stated as consistent and not as proved.

**This record uses the entity population in the table above**, taken on 2026-09-26, which is both
its transclusion count and its page count. The ticket's own sentence was corrected on Linear when this record landed.

## What is built, and why this stays proposed

**BUILT:** the census where a layout is made (`.claude/rules/entity-surfaces.md`); the thin page
pinned by `apps/web/e2e/item-page.test.ts`, whose case goes red when a page draws a Values row or an
image frame the Item cannot fill (checked by adding each, under CNCORE-377); and the citation from
the entity front door, CNCORE-355, and from the redesign's line in `CLAUDE.md`.

**NOT BUILT: the image in the agreed layout.** The census counts 19,128 entity pages carrying
`Has image` on 2026-09-26. Rendering one is the images half of project 5, and the day it lands is
the day the thin page's test gains an entity that has one. This record flips then.

**NOT A MECHANISM, SAID PLAINLY: the story-only rule.** No check reads a layout and refuses a
story-only property, because no entity layout yet names any property at all: the item page renders
whatever statements an Item carries. The rule binds whoever draws the first layout that does.

## Under CNCORE-375: a page says what a Provider gave none of, and draws no row for it

The thin page reaches works too. TMDB's episodes are the thinnest works the catalogue holds (ADR-0128,
"Under CNCORE-375"), and a page that simply omits a value leaves a reader unable to tell a thin
source from a broken page. So an Item page says it in one line under its Values, such as
"provider-tmdb holds no release date for this.", and still draws no row for the value. The first
rule above stands: nothing is drawn for a property the Item does not carry. What is added is who
does not hold it.

**WHAT COUNTS AS "GAVE NONE" IS A FACT, NOT A GUESS.** A Provider import asks for the same properties
on every answer, `WHAT_AN_IMPORT_ASKS_FOR` in `packages/db/src/import.ts`, which is also the list
the import claims from, so the two cannot drift. A Provider that still stands behind the Item and
holds no statement of one of them answered that it holds none. `findPropertiesNotGiven` reads it,
and `item.get` answers it as `notGiven`. A Provider whose every claim has passed its ceiling is not
asked about ([[0036-tmdb-licence-constraints]]). A value that arrived broken was given, so it is
quarantined rather than reported. The page has one such line today, for `released`, because
`title` and the external id are required on every record. When CNCORE-357 or CNCORE-369 add a
property to the import, its absence reads the same way.

Asserted at the router in process ("a season's episodes", `provider.test.ts`) and in the served page
(`item-page.test.ts`, "an episode the second Provider holds thinly"). Mutation-checked: deleting the
ceiling predicate or the held-statement exclusion from `findPropertiesNotGiven` each turned one
router test red.
