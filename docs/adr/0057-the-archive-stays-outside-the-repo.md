---
status: accepted
---

# The archive stays outside every repo; a named fixture goes in the provider's

> **THE ARCHIVE IS DELETED. ADR-0129 SUPERSEDES THIS RECORD'S FIRST HALF, 2026-09-13.** There is no
> `~/tardis-pipeline` to query any more: `provider-wiki` asks the LIVE wiki, and every figure below
> was re-derived from it on 2026-09-13 by `pnpm measure:live`. THE SECOND HALF STANDS UNCHANGED and
> is still binding — the fixture is committed as readable SQL, the rows are NAMED, and CI needs
> nothing bigger. Read "the archive" below as "the wiki", and the figures as measurements of a
> source that moves.

The wiki is queried, never vendored. Tests in CI run against a small deterministic extract chosen
for the invariants it proves, and the rows are NAMED rather than described — *The Daleks' Master
Plan*, five of twelve parts with no animation ever made, is not "a serial with missing parts", it is
the row that makes coverage-as-a-set unavoidable.

Anything needing the whole corpus is a local-only check, never a CI gate.

The archive is a stress test and never a source of requirements. Its text is under the Creative
Commons Attribution-Share Alike License 3.0 (Unported), so anything derived from it that is ever
published must carry BY-SA attribution. Its IMAGES are permitted too, and the section below is the
whole of what that permission covers.

## The images are permitted, and the permission is personal

**Jacob confirmed on 2026-09-10 that he can access and use all of the wiki's data, images
included.** That is recorded as his decision, dated, rather than as an inference from a licence
page — nothing in Tardis:Copyrights grants it, and reading one out of the CC BY-SA text would be
exactly the assumption this section exists to replace.

An earlier version of this record said the opposite: that the archive's images "are third-party
copyright and excluded" and that anything published from it "must never redisplay its images". That
sentence is GONE rather than softened, because it was wrong at the root and not merely too strong.
It is also the sentence that cost something: ADR-0069's provider could not serve an image reference
under it, so CNCORE-15 shipped an empty image policy on purpose and said so in its PR body.

IT CHANGES NOTHING IN ADR-0089. The grant reaches one person, which is that record's licence rule
exactly, so the wiki provider stays tier 3 — private, never bundled, never in the store, its
container image private too. A permission that stops at one person is a second instance of that
tier rather than an exception to it, and a reader who takes this section as a loosening has it
backwards.

### What the wiki grants, and what it does not

The wiki grants its own rights and its own hosting. It does not grant the copyright in what the
pictures depict, and it says so itself — Tardis:Copyrights: "Images are licensed separately to text.
Their licenses can be found on their respective pages." Those pages carry per-file tags over BBC,
Metal Mutt Productions, Terry Nation estate, Paul Cornell and Big Finish copyright, and the same
page keeps the owners' hand free: "The legal owners of any image or other file used on this site may
request the removal of said materials at any time."

**So the scope is stated rather than implied, and it is not a blanket relicence.** The distinction
has to be written down because the obvious next step from "images are permitted" is to put one on
the demo, which is the single surface where CanonCore publishes (ADR-0097) and therefore the single
place a scope error becomes public. ADR-0094 keeps the archive off the demo entirely, so nothing
here reaches that surface — that record is what makes this one safe, and it does not stop being
load-bearing because the images are now allowed.

### The licence has a version, and the attribution rule has a floor

**It is 3.0 Unported. Not 4.0, and not a bare "CC BY-SA".** Tardis:Copyrights names it in full:
"Creative Commons Attribution-Share Alike License 3.0 (Unported)". The version was missing here, in
ADR-0100 and in `docs/demo.md`, and all three now carry it — the two licences differ on attribution
and on what a derivative may be relicensed as, so an unversioned name is not a shorter way of
saying the same thing.

Attribution is required and NEED NOT BE VISIBLE. Tardis:Plagiarism: attribution "does not
necessarily have to be visible, but it must — at a minimum — appear in an edit summary", and it
"can't suggest that the original authors actually endorse your usage". The floor is the useful half:
a surface that shows no credit is compliant, and a pipeline that keeps no record of where a value
came from is not. ADR-0071's source on every value is what satisfies this, not a UI decision.

### A wiki filename is not a stable image identifier

Tardis:Image use policy: "Note that if any image with the same title has already been uploaded, it
will be replaced with your new one." An untagged picture is "subject to immediate deletion", and
admins reserve "the right to automate the deletion process of unsourced, unlicensed pictures". So a
filename names whatever sits at that name today. A URL built from one keeps working and comes back a
different picture, or none, with no error and no version to compare against.

**THIS IS AN ARGUMENT FOR ADR-0037, not a new decision, and nobody should read it as licence to
hotlink because the pictures are now allowed.** That record already refuses hotlinking and stores
the bytes; the wiki is an independent second reason for it and the sharper one, because TMDB rotates
a path and breaks a page loudly whereas the wiki swaps the image and breaks nothing.

The best handle the archive holds is the FILE PAGE'S OWN PAGE ID, and it is better rather than
perfect. Two claims, from two mouths: T:DAB records that story titles were moved wholesale once the
wiki settled its disambiguation rules, so a title moving is ordinary here rather than hypothetical;
and MediaWiki's own `page` table documentation says "Page IDs do not change when pages are moved,
but they **may** change when pages are deleted and then restored". Those are not the same guarantee.
A move keeps the id and an untagged picture faces "immediate deletion", which is precisely the path
that can hand the id back changed. So ADR-0069's provider hands the id over beside the name because
it survives the common case and the name survives nothing — and the residue, the case neither
survives, is a third reason the bytes get stored rather than referenced.

## The wiki, measured

**RE-MEASURED LIVE ON 2026-09-13 (CNCORE-103).** The archive-era figures beside each one were taken
2026-09-10 from a corpus frozen 2026-09-04, and they are kept because agreeing to within a rounding
point across nine months of wiki edits is itself the evidence that the live path measures the same
thing.

**11,297 stories** — a page transcluding `Template:Infobox Story SMW`, in ns 0, not a redirect. The
template has 11,410 transclusions of which 113 are redirects. (Archive: 11,285.)

As a sizing guide for what the model must survive:

- **96.8% of stories sit in more than one container** — 10,938 of 11,297, median 4, **maximum 52** —
  counting only the categories the wiki shows a reader. Counting hidden maintenance categories too
  it is 97.4% and the maximum is 53. (Archive: 93.4%, median 4, maximum 52.) **The filter is half
  the claim here and the two answers are a point apart**, because a wiki category is two things
  wearing one name: `Stories set in London` is a container and `Articles needing citation` is a
  maintenance tag on the article, and both are rows in `categorylinks`.
- **The category graph is cyclic and 22 levels deep** — BFS downward from its 29 roots, 0-based —
  across 28,759 categories and 45,569 child-to-parent edges, of which 13,229 categories sit under
  more than one parent. (Archive: cyclic, 22 levels, 28 categories on a cycle. The cycle COUNT is
  not restated: this pass counted the nodes a back edge points at, which is a different question
  from membership of a non-trivial strongly connected component, and two numbers from two
  definitions do not belong in one sentence.)
- **206,907 Semantic MediaWiki triples over 559 distinct properties, on the story pages alone.**
  (Archive: 518,768 triples over 715 properties, CORPUS-WIDE. A third of the pages carry most of
  the interest, and the two figures are different populations rather than a drift.)
(ADR-0012).

## The named rows

**NEW WHO CARRIES THE FIXTURE, AND THE REASON IS CNCORE-9 RATHER THAN RECOGNISABILITY.** That
ticket's expected positions must come from TWO INDEPENDENT EXTERNAL SOURCES, and for classic Who
there is no second source for them to come from. Measured against TMDB on 2026-09-11 with a working
token: `search/tv?query=The Tenth Planet` returns 0 results, and so does `The Power of the Daleks`.
Classic Who is there as `tv/121` at PART level — season 1 is 42 episodes, opening *An Unearthly
Child*, *The Cave of Skulls*, *The Forest of Fear* — so *The Tenth Planet* is parts 29 to 32 of a
season rather than a thing anything can name. New Who is `tv/57243` at STORY level: season 1 is 13
episodes against the wiki's 13 stories, one to one.

### The two-source rows, and the disagreement is real

Measured on both sides on 2026-09-11. The wiki's `Series 2 (Doctor Who) stories` holds FIFTEEN
members and TMDB's `tv/57243` season 2 holds THIRTEEN, because the wiki folds the Children in Need
mini-episode and the Christmas special into the series while TMDB files both under Specials.

*Rose* — wiki `Series 1` #1, TMDB S1 #1. THE AGREEMENT ROW: series 1 matches one to one on both
sides, all thirteen. Two sources agreeing must collapse to ONE placement row carrying a source each
([[0017-placements-carry-sources-and-rank]]), and without this row a test cannot tell a detected
disagreement from a test that always finds one.

*New Earth* — wiki `Series 2` #3, TMDB S2 #1. THE DISAGREEMENT, and CNCORE-9's whole claim: one
item, two orderings, two positions, both stated outside this product.

*Doomsday* — wiki `Series 2` #15, TMDB S2 #13. THE SAME OFFSET AT THE FAR END, so the test cannot
pass by coincidence at position 1.

*The Christmas Invasion* — wiki `Series 2` #2, TMDB `tv/57243` SPECIALS #2. THE PUREST
MULTI-PLACEMENT ROW: the same item is a member of DIFFERENT CONTAINERS on the two sources.

**THE TWO SERIES 2s ARE TWO CONTAINERS, AND A FIXTURE THAT MATCHES THEM TESTS THE WRONG THING.**
They differ in membership, fifteen against thirteen, and nothing has matched them. Were they one
container, ADR-0017 makes this a POSITION DISAGREEMENT resolved by rank — two placement rows in one
ordering — which is a different mechanism, and multi-placement would go untested while every
assertion still passed. Said outright because matching them is the obvious move.

### The classic rows that stay, and they are two rather than five

Missing episodes are a property only classic Who has. Measured 2026-09-11: of the 29 members of
`Stories with missing episodes`, NOT ONE is a new Who story. So two rows stay, each held for one
claim that cannot be re-homed:

*The Tenth Planet*, 4 parts, 3 survive, part 4 animated — missing episodes WITH a reconstruction ·
*The Daleks' Master Plan*, 12 parts, 5 survive and NO animation was ever made, so every release is a
fraction of it — coverage as a set.

*The Ice Warriors*, *The Power of the Daleks* and *Marco Polo* GO. They are variations on those two
ratios, and their other jobs — the redirect trap and the character trap — re-home onto new Who and
are done better there.

**Re-measured live 2026-09-13: 27 stories carry missing episodes** (`Category:Stories with missing
episodes`, its 28 ns-0 pages less the one sandbox page that is not a story) **and 15 have an
animated replacement** (`Category:Animated missing episodes`, less `The Web of Fear Teaser`, which
is not in the story population). The archive gave 27 and 14 on 2026-09-10.

**"11 serials are completely missing" IS NOT RE-DERIVED AND IS LEFT AS AN ARCHIVE-ERA FIGURE.** The
wiki has no category that states it — `Category:Missing episodes` holds five real-world pages and
no stories — so re-deriving it needs per-episode survival, which no property or category carries and
which this record already says is held as prose. It is flagged rather than quietly re-pointed,
because a figure nobody can reproduce should say so.

**NEW WHO HAS ANIMATION AND IT IS NOT THE SAME CLAIM.** *The Infinite Quest* and *Dreamland* are the
two new Who members of `Doctor Who animated television stories`, and both were MADE as animation
rather than animated to replace missing episodes. Swapping one in for *The Power of the Daleks*
would prove that an animated story exists, which nothing was asking.

### The traps, and new Who does them better

TWO TRAPS, BOTH MEASURED. The bare titles are REDIRECTS — the story rows are `X (TV story)`, and
`Rose`, `Bad Wolf`, `The Christmas Invasion` and `The Long Game` all resolve as redirects while
`Dalek` and `New Earth` do not. That is BETTER than the classic set gave, which was redirects only:
the fixture now carries both halves of the trap rather than the half that bites. And per-episode
survival exists ONLY as English prose in `pages.text` — no property, column or category anywhere
says "3 of 4" — which is now a claim about the two classic rows alone.

THE THIRD TRAP RE-HOMES AND GETS SHARPER. `medium IS NOT NULL` reads like a story filter and is not
one, because the wiki dabs a CHARACTER by the story it first appears in. `Empress (Marco Polo)` was
the example; new Who supplies THIRTY-FOUR pages dabbed `(Rose)` — `Wheelie bin (Rose)`,
`Tesco Metro (Rose)`, `Dalek graffiti (Rose)` — and sixteen more dabbed `(The Christmas Invasion)`.
Not one is a story, and they are what the no-match half of the labelled match set is drawn from.

### The required shapes, and one of them cannot be new Who

Plus, as required shapes rather than named rows: a story in more than twenty containers; a category
cycle; a story with two release dates; a medium value that is parse garbage; a work with no edition
at all.

THE FIRST RE-HOMES AND IMPROVES: *The End of Time* sits in 39 containers, *The Pandorica Opens* in
30, *The Name of the Doctor* in 29 and *Journey's End* in 22.

**THE TWO-DATES SHAPE CANNOT BE A NEW WHO ROW — AND IT WAS NEVER ONE OF THE NAMED FIVE EITHER.**
Measured 2026-09-11: exactly FOUR pages in the whole archive carry more than one distinct release
date — `City of the Daleks (video game)`, `Worlds in Time (video game)`, `Blood of the Daleks (audio
story)` and `The Sea Devils (TV story)` — and no new Who story is among them. None of the five
originally named rows carried it either, so this was always a shape some unnamed row satisfied,
which is worth correcting here rather than leaving for CNCORE-9 to discover. *The Sea Devils* is the
one to take: 1972-02-26 and 2025-12-07, a broadcast and a colourised re-release, which is
[[0081-release-date-means-earliest-known-release]]'s case exactly rather than a curiosity.

**And a LABELLED MATCH SET inside the fixture**: rows whose correct provider match is known,
INCLUDING rows whose correct answer is that there is no match. That second group is what makes the
confidence test in ADR-0028 mean anything — on a set of only true
matches a false positive is impossible, so precision is pinned at 1.0 however bad the scorer.

The extract is a FIXTURE, not the archive. Committing it does not license vendoring the database,
and it must stay small enough to read.

**IT IS COMMITTED IN THE WIKI PROVIDER'S REPOSITORY RATHER THAN THIS ONE**, because that repository
is the thing that reads the archive. CanonCore reaches the wiki through CMPP and never opens the
file itself (ADR-0031), so a fixture here would sit beside nothing that could use it. It reaches
CanonCore's own CI inside the provider's container image. Said outright because a reader will
otherwise look for it in this repository and conclude it was never committed.

**AND THE TMDB HALF IS NOT IN THE FIXTURE AT ALL, WHICH THE SENTENCE ABOVE MAKES UNAVOIDABLE.** The
fixture is an extract of the ARCHIVE, and `CONTEXT.md` defines it that way; TMDB's season and
episode numbers are not in the archive and never will be. So CNCORE-9's second source is a
HARDCODED EXPECTATION IN THIS REPOSITORY'S OWN TEST, beside the assertion that reads it, rather than
a second fixture file. That is the honest shape — the numbers are a claim this repository is making
about what TMDB says, and pinning them next to the assertion is what lets a reader check the claim
without opening another repository. An earlier reading of the ticket's "recorded in the fixture" is
unsatisfiable and is corrected on the ticket rather than met.

**AND THOSE NUMBERS CARRY A LICENCE, WHICH [[0036-tmdb-licence-constraints]] NOW DECIDES RATHER THAN
THIS RECORD.** *New Earth* at TMDB S2 #1 and *Doomsday* at S2 #13 are TMDB Content under a
six-month cache ceiling, and a committed expectation is a cache that never expires. They are
recorded there as cached TMDB Content subject to purge — and `provider.purge` cannot reach them,
because it works on rows and these are literals in a file. Named here because this record is where a
reader decides what goes in the fixture, and the licence is a property of the row rather than an
afterthought about it.

**THE ROSTER ABOVE IS NOT WHAT IS COMMITTED TODAY.** `provider-wiki`'s `fixture/rows.sql` still
holds the five classic serials CNCORE-15 built, and 135 of its 519 lines name them or their page
ids. Changing it is CNCORE-9's work in that repository, and this record names the destination rather
than the current state. Written down because this record is otherwise read as a description of a
file, and for the length of one ticket it is a specification for one instead.

## Evidence

**EVERY FIGURE IN THIS RECORD WAS RE-DERIVED FROM THE LIVE WIKI ON 2026-09-13 (CNCORE-103) AND THE
ARCHIVE IS DELETED (ADR-0129).** What follows is the archive-era working, kept as the history of how
these figures were arrived at rather than as a source anyone can go back to. The paths in it point
at nothing now.

Archive figures re-measured against `~/tardis-pipeline` on 2026-09-10 and five were wrong: 7,236
categories on a cycle was 28 (7,236 counts categories reachable DOWNWARD from a cycle node, 258x
out); *The Daleks' Master Plan* was 3 of 12 and is 5, episodes 1 and 3 having been recovered in
March 2026; 13 animated replacements is 14; 29 stories with missing episodes is 27, two of the
category's members not being stories; and 2.3GB is `du -sh` on `data/db/`, which also holds 689MB of
raw JSONL — the database itself is 1,816,932,352 bytes. Working in
`docs/research/verify-new-adrs-archive.md`.

## As built, under CNCORE-15, and consumed under CNCORE-6

The fixture is committed in `provider-wiki` as readable SQL rather than as a DuckDB file, which is
what keeps "small enough to read" true: a two-row database is already 524KB, so a binary fixture
would have cost half a megabyte of opaque blob per change. The database is built from that SQL by a
script, and the extractor that regenerates the SQL from the 1.8GB archive is local-only, never a CI
gate -- exactly as this record requires.

BOTH TRAPS BIT DURING THE BUILD, which is the strongest evidence they were worth writing down. Rows
are selected by story page id, because the bare titles are redirects. And per-episode survival is
carried as one real sentence of `pages.text` per row rather than as a count, because no property,
column or category holds it.

A THIRD TRAP THIS RECORD DID NOT NAME, found by CNCORE-15 and worth adding here: `medium IS NOT NULL`
reads like a story filter and is not one. The wiki dabs a CHARACTER by the story it first appears in,
so `Empress (Marco Polo)` carries a medium too, and a null check admits it. The fixture now carries
one of those characters with a label saying the correct answer is no match.

NO SPLIT IS QUOTED HERE, DELIBERATELY. An earlier version of this paragraph gave CNCORE-15's
"13,457 stories of 40,696", and [[0033-search-lookup-required-browse-optional]] has since shown
that pair does not reproduce -- the denominator does, the split does not, and CNCORE-23 is where the
copies of it get corrected. That record owns the measurement and states it from the query that
printed it; repeating a figure here would be a second copy to correct next time. What this record
needs is the SHAPE, and the shape is not in dispute.

CanonCore's side is that it reaches all of this through CMPP and never opens the file, so the fixture
arrives in CI inside the provider's container image and this repository holds none of it.

## Evidence for the image section, under CNCORE-22

**The wiki's own policy pages are the specification, and they are ON THE WIKI.** Every quote in
the image section was read on 2026-09-10 out of the archive at `ns = 4` rather than off the live
site — Tardis:Copyrights (page 101), Tardis:Image use policy (page 101696) and Tardis:Plagiarism
(page 17176) — which at the time meant nothing had to route around the Cloudflare challenge on
`tardis.wiki` to get them.

**THAT ROUTE IS GONE AND THE PAGE IDS ARE WHAT SURVIVED IT (ADR-0129, 2026-09-13).** These
citations are no longer reproducible by holding the archive, because nobody holds one. They are
reproducible by READING THE THREE PAGES, which the ids above address directly and which the Owner's
Credential reaches — and a page id survives a rename where a title does not, which is why they were
recorded as ids in the first place. The quotes are dated, so a policy edited since would show as a
disagreement rather than pass unnoticed.

The MediaWiki claims are MediaWiki's, cited separately because they are a different mouth:
`Manual:Page table` for a page id surviving a move but not necessarily a delete-and-restore, and
`Special:Redirect/file` (alias `Special:FilePath`) for a filename-addressed path to a file's bytes
that is documented as linkable from outside the wiki and takes a `width` parameter.

**The image figures, each with the filter it was measured under**, on the same date and database:

| Figure | Filter |
| --- | --- |
| 38,868 `Has image` rows | none — the whole `page_properties` table |
| 8,289 `Has image` rows, over 8,177 distinct stories | `ns = 0`, not a redirect, story dab term |
| 12,791 stories | the same filter, which is the population the provider serves |
| 8,181 of those 8,289 values resolve to an `ns = 6` page | the same filter, joined on the NORMALISED file title |
| 8,030 of them, if the title is matched exactly instead | the same filter, joined on the raw value |
| 87,950 `File:` pages | `ns = 6`, no other condition |

CNCORE-22 SAID "38,868 `Has image` PROPERTY ROWS ON STORY PAGES" AND THE QUALIFIER IS WRONG: 38,868
is the unfiltered total, and restricting it to story pages gives 8,289. Both numbers are right and
only one of them answers the question the sentence asks. It is the failure this repository has now
made three times — a figure travelling without the filter that produced it — so it is recorded here
beside the corrected pair rather than only fixed. **And 38,868 minus 8,289 is not a count of
anything**: the populations differ, so the difference mixes redirects and non-article namespaces
into a number that would read as "images on non-stories".

**Re-measured live 2026-09-13: the 11,297 stories carry 7,283 `Has image` values naming 7,234
distinct files, and 85 of those files have no page on the wiki** — 14 because the VALUE itself is
malformed, doubling the prefix into `File:File:...` where an editor typed `File:Foo.jpg` into a
field the template already prefixes, and 71 with a well-formed value and no file. A dangling image
reference is ordinary rather than exceptional, which is why the provider serves the name it was
given and reports no id rather than dropping the row.

**THE ARCHIVE'S 108 OF 8,289 IS NOT THE SAME MEASUREMENT AND MUST NOT BE READ AS ONE.** That pass
took its population from the story DAB TERM — a title ending `(TV story)`, `(audio story)` and the
rest — where this one takes it from the infobox transclusion. The two populations differ by more
than the wiki moved in three days, so the drop from 8,289 to 7,283 is mostly the filter and not the
wiki. Stated rather than reconciled, because the honest comparison is unavailable: the corpus the
first figure was taken from is deleted.

**THAT FIGURE WAS 259 UNTIL THE JOIN WAS FIXED, AND THE 151 IN BETWEEN WERE THIS RECORD CALLING
FILES MISSING THAT THE ARCHIVE HOLDS.** A wiki filename is not merely unstable, which is the section
above; it is not CANONICAL either, and that is a second and separate thing. MediaWiki normalises a
title before storing it — `Manual:Page title`: spaces and underscores "are treated as equivalent",
runs of them "are collapsed into a single underscore ... or a single space", surrounding whitespace
is stripped, and "titles starting with a lowercase letter are automatically converted to leading
uppercase" — while the `Has image` property keeps whatever the editor typed. So `File:keys
title.jpg` is the page `File:Keys title.jpg` and an exact match misses it.

It is worth this record's space because of HOW it hid. The wrong join produced a plausible number,
the fixture's chosen example of a missing file was itself a file the archive holds, and every test
agreed. A provider that resolves a reference by exact string match against a normalising source is
asserting an absence it has not checked — and an absence asserted about a licence is the wrong way
round to be wrong.
