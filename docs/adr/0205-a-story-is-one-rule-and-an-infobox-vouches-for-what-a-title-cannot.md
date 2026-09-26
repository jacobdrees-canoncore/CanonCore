---
status: accepted
---

# A story is one rule, the wiki's own universe bounds it, and an infobox vouches for what a title cannot

`provider-wiki` decides what a story is in ONE function, `storyKind` in `src/story.ts`, and every
reader of the wiki calls it: the live reader, the DuckDB reader its tests run against, the
timeline parser, and the scripts that measure the corpus. A page is a story when all four hold:

1. It is in ns 0 and is not a redirect.
2. It is NOT under `Category:Non-DWU material`, which is the branch `Tardis:Category tree` keeps
   for "fictional elements which cannot be said to take place within the Doctor Who universe".
3. Its title's parenthetical ends in a T:DAB TERM story term. This is
   [[0033-search-lookup-required-browse-optional]]'s rule, and it stands.
4. What precedes that term is empty, an acronym or a number, **or the page carries a work
   infobox**: `Infobox Story SMW`, `Infobox Story`, `Infobox Doc`, `Infobox Documentary`,
   `Infobox Reference Book` or `Infobox Merchandise`.

The fourth condition replaces ADR-0033's "a prefix is an acronym or a number and never ordinary
words". That sentence was a claim about the wiki and the wiki refutes it.

## Why

**Two definitions shipped in one repository.** The provider served a page by its title's dab term.
`scripts/measure-live.ts` counted a page that transcluded `Infobox Story SMW`. The census of
2026-09-21 (`docs/research/tardis-wiki-ns0-census.md`) found them disagreeing on 2,515 pages, so a
figure measured under one described a population served under the other. Now there is one
definition, and the script measures with it.

**The prefix rule refused real stories, and no rule over the title can fix that.** It existed to keep
out `Customer (The Long Game)`: a character dabbed by a story whose title ends in the term `game`.
The same rule refused `Ascension (Gallifrey audio story)`, `The Time of Angels (photo
novelisation)` and `73 Yards (Unleashed episode)`. `Gallifrey audio` and `The Long` are both
ordinary words in front of a story term, so the title cannot tell them apart. The page's infobox
can. It is the wiki's own typed assertion of what a page is, and the character carries `Infobox
Individual`.

The six infoboxes were read off the data, not chosen. They are what the pages the acronym rule
already admits carry. Among the pages that rule refused, every other infobox was an entity's:
`Individual`, `Object`, `Species`, `Organisation`.

**The provider was importing pages the source says are outside its universe.** `Doctor Who and
Crayola (TV story)` has a real story dab term and sits in `Non-DWU television stories`. Nothing
downstream could tell it from an in-universe story.

## Measured

All figures from `pnpm measure:live split` in `provider-wiki`, against the live wiki on
2026-09-26, over ns 0 non-redirect pages (128,781 of them). Each is counted directly over the
population beside it, never subtracted.

| figure | count | population |
| --- | ---: | --- |
| stories | 12,314 | the four conditions above |
| under `Non-DWU material` | 2,053 | reached by walking that category's subcategories |
| of those, a story by every other condition | 885 | the row above |
| of those, admitted by the rule the provider shipped before this | 650 | the row above, no infobox, no universe condition |
| a story term behind a prefix that is not an acronym or number | 534 | title ends in a story term, refused by the acronym rule alone |
| of those, a story now | 156 | in the universe, carrying a work infobox |
| of those, outside the universe | 334 | under `Non-DWU material` |
| of those, in the universe with no work infobox | 44 | characters and in-universe objects dabbed by a story |

**Two figures the spec carried were not these, and the difference is method, not drift.** The
spec said the provider admitted 2,053 out-of-universe pages. 2,053 is the size of the branch; the
provider admitted 650 of them. It said a capitals rule rejects "roughly 1,000 real stories". 1,003
is the census's count of pages carrying a story infobox that the dab rule refuses for ANY reason,
including a title with no parenthetical at all (`SJAF 1`) and a term missing from the vocabulary
(`(anthology)`). The acronym rule alone refuses 534, and 156 of those are in-universe works.

## How Non-DWU membership is read

By a walk: `list=categorymembers` from `Category:Non-DWU material` down every subcategory. It took
90 categories, 2,053 ns 0 pages and 7 seconds on 2026-09-26, the census's figure to the page. The
provider holds the resulting set of page ids for `RESOLUTION_CACHE_TTL_SECONDS`, and does not hold a
failure.

**Semantic MediaWiki's hierarchical category condition was tried first and refused.**
`[[Category:Non-DWU material]][[A||B||...]]` would have answered on the ask the provider already
makes, at no extra cost. It answered a query naming four subjects correctly. Queries naming sixteen
failed six times running, so it cannot carry a serving path.

## Consequences

- The work infoboxes ride on the page-info request the provider already sends
  (`prop=info|templates`, `tltemplates` naming the six), so condition 4 costs no round trip.
- The walk costs about 90 requests on the first story question after start-up and once an hour after
  that. The stub wiki serves the recorded walk to every test.
- The timeline parser holds only titles, so it applies the title half of the rule
  (`mayNameAStory`) and resolution applies the rest. A bullet citing `(It's Even Bigger on the
  Inside comic story)` is now a slot. Its member is served or refused by the page it names.
- `Bow Tie Game (video game)` stopped being a story, being under `Non-DWU material`, so the fixture's
  pasted-markup `Has image` case moved to `Faction Armour: Some Design Notes (short story)`.
- **What the provider leaves out, and which of it is our decision, is stated in `provider-wiki`'s
  `README.md`**, under *What it serves, and what it leaves out*.
