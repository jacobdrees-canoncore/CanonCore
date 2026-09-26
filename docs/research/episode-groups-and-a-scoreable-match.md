# Episode groups, and whether a match can be scored at all

**Researched 2026-09-26**, for CNCORE-368. Cited by CNCORE-361 (Works) and CNCORE-362 (people).

CNCORE-368 asks two things before the matcher is designed. First, whether the second Provider's own
alternate orderings resolve the part-versus-story mismatch, and at what coverage. Second, whether a
precision-and-recall harness ([[0028-the-confidence-score-is-falsifiable]]) can be built over a
hand-labelled sample that includes rows whose answer is NO MATCH, answered separately for Works and
for people.

Every figure below was measured live on **2026-09-26**, against TMDB's API, the live tardis.wiki
(the Owner's credential answered that day), and Wikidata's API. Each one names its population. The
scripts and raw responses are outside the repository; the queries that retake each figure are in
the last section. Nothing here decides anything. The ADRs are the Owner's to write.

---

## 0. The short answers

| Question | Answer |
|---|---|
| Do TMDB's own orderings group parts into stories? | **YES for the 1963 series only, and not as something a matcher may trust as ground truth.** One user-authored group, `Story Order`, places all 694 of the 1963 series' main-season parts into 156 groups. **154 of the wiki's 159** 1963 TV stories correspond to exactly one group with the same parts. The 2005 and 2024 series have **no** story-level group at all. |
| Can a precision-and-recall harness be built for **Works**? | **YES.** The positives and the NO MATCH rows both exist in quantity, and a third party (Wikidata) labels them from evidence the matcher does not read. |
| Can one be built for **people**? | **YES, with a weaker negative half.** Positives are plentiful and labelled by a shared IMDb id. Hard negatives, meaning two real people who share a name, are **scarce**: tens of rows rather than hundreds. And the labelling evidence is the same identifier a people matcher would score on, so the rows that measure anything are the ones where that identifier is absent or disagrees. |

Neither answer is NO, so there is no fallback to state. Section 5 still says what the matcher does
for the stories the groups do not resolve.

---

## 1. What the second Provider imports today

`provider-tmdb` at `ffab070` (2026-09-26) reads `/3/tv/{id}`, `/season/{n}`, `/episode/{m}` (each
with `append_to_response=external_ids` where it matters), `/movie/{id}?append_to_response=credits`,
`/collection/{id}` and `/search/multi` (`src/app.ts`). **It calls no episode-group endpoint.** Its
`browse` of a programme relays TMDB's own season array unsorted, which is ADR-0128's rule in code.

Its `externalIdsOf` (`src/records.ts`) passes on `imdb` and `tvdb` only, and holds `imdb` to IMDb's
**title** shape (`tt`), so a person's `nm` id would be refused today. It serves no person record at
all. Both facts matter to section 4.

## 2. Granularity: what TMDB's episode groups hold

### 2.1 What an episode group is, and who writes one

TMDB's reference describes `/tv/{series_id}/episode_groups` as "Get the episode groups that have been
added to a TV show" and gives seven group types: 1 Original air date, 2 Absolute, 3 DVD, 4 Digital,
5 Story arc, 6 Production, 7 TV (developer.themoviedb.org/reference/tv-series-episode-groups and
.../tv-episode-group-details, read 2026-09-26).

**They are written by TMDB's contributors, not by TMDB and not by the broadcaster.** TMDB staff
(Travis Bell, 2018-04-17, themoviedb.org/talk/5ad606829251415dc301645d) introduced them as "a new
system to help organize TV shows in ways that are not based on the original air dates and orders".
A thread from 2025-03-11 (themoviedb.org/talk/67d0476cce20cf197260962b) shows an ordinary account
creating "my first episode group", with a moderator explaining how. The Contribution Bible mentions
them once, in its anime section, as the place "any alternative order" "can be created".

**Neither the API nor the web page names an author.** The group detail carries `id`, `name`,
`order`, `episodes` and `locked`. The web page for the group shows no "added by" or edit history.
All 156 groups of `Story Order` read `locked: false`. **UNSOURCED:** whether TMDB moderates a new
episode group before it is served. No primary source found says either way.

### 2.2 Every group on the three Doctor Who series

TMDB ids verified by `/search/tv?query=Doctor Who`: **121** is the 1963 series, **57243** the 2005
series, and **239770** the 2024 one. "Main-season" means seasons 1 and up, with season 0 (Specials)
excluded.

**1963 series (121)**: 694 main-season episodes, which are broadcast parts, and 1,398 in Specials.

| type | name | groups | placements | main-season parts placed | from Specials |
|---|---|---|---|---|---|
| 3 DVD | Doctor Who: The Collection (Blu-ray) | 18 | 409 | 402 / 694 (57.9%) | 7 |
| 4 Digital | BBC iPlayer | 29 | 642 | 633 / 694 (91.2%) | 9 |
| 5 Story arc | The Doctor Order | 8 | 698 | 694 / 694 | 4 |
| 5 Story arc | **Story Order** | **156** | **713** | **694 / 694** | **19** |
| 5 Story arc | Official Stories Order | 27 | 701 | 693 / 694 | 8 |

**2005 series (57243)**: 153 main-season episodes. Six groups: Blu-ray, German Blu-Ray, BBC iPlayer,
The Doctor Order, Official Stories Order and Chronological. **Not one of them is story-level**:
their groups are named for seasons, Doctors or specials years (`Series 01`, `Specials 2005`,
`Ninth Doctor`).

**2024 series (239770)**: 16 main-season episodes. Four groups, all season-level.

**The spec's figures reproduce, with one correction.** CNCORE-344 recorded "6 for the 2005 series
and 5 for the 1963 one, including one named 'Story Order' with 156 groups over 723 episodes". The
counts of groups reproduce. **723 is the figure the LISTING endpoint states about the group**, and
the group's own detail places **713** episodes. The two endpoints disagree about one object, and the
listing is the one quoted.

Spin-offs (Torchwood, The Sarah Jane Adventures, Class) were **not measured**.

### 2.3 Does `Story Order` line up with the wiki's stories?

The wiki's population is `Category:Doctor Who (1963) television stories`, ns 0, **159 pages**. That
includes the 1996 TV film. An SMW `ask` over the same category returned one more row, a user
sandbox, which is excluded. Each story's part count is its `Epcount` property. Group names and story
titles were compared after normalising: ` (TV story)` stripped, case folded, and punctuation and
diacritics removed.

- **153 of 156 groups** carry the name of a wiki 1963 story, and **all 153** hold that story's
  `Epcount` in parts. In 152 the parts are main-season episodes. In one, `The Five Doctors`, the
  single part is TMDB's Special 0x41.
- **1 group differs in title alone.** `The Massacre of St Bartholomew's Eve` is the wiki's
  `The Massacre (TV story)`, with 4 parts on each side. The wiki's own infobox files that story
  under `Sources with disputed titles`.
- **1 group is coarser than the wiki.** `The Trial of a Time Lord` is one group of 14 parts. The wiki
  holds it as four stories: `The Mysterious Planet`, `Mindwarp`, `Terror of the Vervoids` and
  `The Ultimate Foe`.
- **1 group has no wiki story in this category.** `Shada` is six parts from TMDB's Specials.
- **1 wiki story has no group.** The 1996 TV film is not an episode of TMDB series 121.

**So 154 of 159 wiki stories (96.9%) correspond one-to-one to a `Story Order` group with the same
parts.** Four more are covered by one group that is too coarse, and one is outside the series.

**Two things the group holds that are not parts.** Twelve placements across seven story groups are
extras from TMDB's Specials. Examples are `Behind the Sofa: The Robots of Death` inside `The Robots of
Death`, `BBC1 Continuity: The Masque of Mandragora`, and `Silver Nemesis Extended Edition: Part One`
to `Three` beside the three broadcast parts. A group's membership is therefore "what this
contributor filed with the story", not "the story's parts".

### 2.4 An independent check: Wikidata

Wikidata links an episode to its serial, and the matcher does not read Wikidata. So Wikidata can
corroborate `Story Order`. The population is every item with `P179` (part of the series) =
`Q34316` (Doctor Who). That is **1,479 items**, of which 905 are `television series episode` and 159
are `Doctor Who serial` (`Q28225717`).

- **All 694** of TMDB's 1963 main-season parts carry an IMDb id (from TMDB's episode
  `external_ids`), and each of those ids is on a Wikidata item in that population.
- **693 of 694** reach exactly one serial through `P361` (part of). The 694th, part 1 of `Invasion
  of the Dinosaurs`, has no `P361` on Wikidata.
- **152 of the 154** `Story Order` groups holding main-season parts have **exactly** the part set
  of one Wikidata serial. The other two are `Invasion of the Dinosaurs`, which is Wikidata's gap,
  and `The Trial of a Time Lord`. Wikidata splits that one into the same four serials the wiki does.

**UNSOURCED:** whether the contributor who wrote `Story Order` built it from Wikipedia or Wikidata.
If they did, the agreement is one source seen twice rather than two sources agreeing.

### 2.5 What ADR-0128 permits doing with it

[[0128-an-ordering-is-the-sources-own-axis-not-release-order]]: an ordering is "a DATED CLAIM BY A
NAMED SOURCE", and a Provider reads a stated sequence and reports it, and "may not improve it, date
it, or fill it in". CNCORE-344 adds that a Provider's own collection arrives as a Container, not a
Group, and that two Providers' orderings are never fused.

- **Permitted:** `provider-tmdb` relays `Story Order` as TMDB's claim, as a Container of story
  Containers, each holding its parts at the group's own `order`. That includes the twelve extras and
  the 14-part Trial group, exactly as TMDB serves them.
- **Not permitted:** the Provider removing the extras, splitting the Trial group into four, adding
  the 1996 film, or choosing between `Story Order` and `Official Stories Order` on the reader's
  behalf. Each of those would improve an axis.
- **Not an ordering question at all:** CanonCore's matcher READING a group as evidence that a wiki
  story corresponds to a set of TMDB parts. That is matching, not a Provider improving an axis, and
  ADR-0128 does not reach it. **The matcher must not treat the group as ground truth, though.** It
  is contributor-authored, unlocked, and names no author. Its name is free text, and its id is a hex
  string that can disappear. And at one group of 156 it disagrees with both the wiki and
  Wikidata.

**Answer to the first criterion:** TMDB's own alternate orderings resolve the part-versus-story
mismatch for **154 of 159** wiki 1963 TV stories (96.9%), through one contributor-authored group,
on one series. On the 2005 and 2024 series they resolve nothing. There the mismatch is also small:
of the wiki's **184** stories in `Category:Doctor Who (2005) television stories`, only **17** carry
an `Epcount` at all, and **4** of those are more than 1 (`The End of Time`, `Spyfall`, `Dreamland`
and `The Infinite Quest`).

## 3. Can a Works match be scored?

**YES.** Here is where each part of the harness comes from.

### 3.1 Where the rows come from

The population is the candidate pairs the matcher will really score: wiki TV stories against TMDB
episodes of the same programme. Measured over the two largest:

| | wiki stories | TMDB main-season episodes |
|---|---|---|
| 1963 series | 159 | 694 (plus 1,398 Specials) |
| 2005 series | 184 | 153 (plus 199 Specials) |

**This does not reproduce CNCORE-344's "roughly 675 wiki TV stories against 964 TMDB episodes"**,
and it does not contradict it either. That figure's population is not stated, and these two series
are a subset of any sensible one.

### 3.2 Where the NO MATCH rows come from, and why they are better than "free"

CNCORE-344 said classic serials supply true negatives "for free". **They do, and they are HARD ones,
which is worth more.** Of the wiki's 1963 stories, **157 have two or more parts** (`Epcount`
distribution: 1 part ×2, 2 ×13, 3 ×8, 4 ×91, 5 ×3, 6 ×32, 7 ×6, 8, 10 and 12 ×1 each, and the film
with none). For a story with several parts, the correct answer to "which TMDB episode is this
story?" is NO MATCH. CNCORE-361's criterion says the same: "no single one of them was matched to
this Item".

**132 of those 157 have ONE TMDB part carrying the story's title AND its release date**, after
stripping a trailing `(n)` or `: Part n`. Part 1 of `An Unearthly Child` is titled `An Unearthly
Child` and aired 1963-11-23, which is the story's `Release date`. A title-and-date scorer will accept
every one of them. So these rows catch exactly the false positive the matcher is most likely to
make, which is what [[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]] wants from
a gate.

**Same-title-different-work rows exist, but only three were found** among TMDB 1963 parts. A part
carries the title of a DIFFERENT wiki story in these cases: `The Rescue` (1x11, part of `The
Daleks`), `The Daleks` (2x5, part of `The Dalek Invasion of Earth`) and `Inferno` (2x15, part of
`The Romans`). They go in the set, but three rows are not a population.

### 3.3 Where the positives come from

- **2005 series:** **171 of 184** wiki stories have a TMDB episode with the same normalised title
  and the same date. Most are single-episode stories, so the answer is MATCH.
- **1963 series:** only the 2 single-part stories are positives at episode level. If the matcher
  instead matches a story to a TMDB story group, the 154 groups of section 2.3 are positives too.
  Which of the two the matcher does is CNCORE-361's to decide.

### 3.4 Who labels a row, and against what

**The wiki's story pages carry no IMDb id to join on.** 0 of the 159 1963 stories carry `Imdb`, and
1 of the 184 2005 stories does (live `ask`, 2026-09-26). That agrees with CNCORE-344's 4 of 11,307.
So identifier agreement is not a signal the Works matcher can use, and a label built on a third
party is independent of the scorer.

- **Parts to stories (1963):** Wikidata `P361` places 693 of 694 parts. `Story Order` agrees at
  152 of 154 groups, and the wiki's `Epcount` agrees with both. A row is labelled when all three
  agree. **Where they disagree (Trial, Invasion of the Dinosaurs) a person decides and writes the
  reason into the row.**
- **Episodes to stories (2005):** **146 of 153** TMDB main-season episodes reach a Wikidata episode
  item (through their IMDb id) that carries a `P6262` Fandom article id of the form `tardis:<title>`.
  **141** of those name a title that is a live tardis.wiki story title. That is a third party linking
  the two, per row. The Fandom id names tardis.fandom.com rather than tardis.wiki. The titles
  coincide in 141 of 146, and the note makes no claim about why.

Who holds the pen is CNCORE-361's decision. What this note establishes is that every row can cite
evidence the scorer never reads. The practical shape is that an agent drafts each row with its
evidence cited, and a person confirms the rows where the evidence disagrees.

### 3.5 How many rows before the figures mean anything

Precision is a proportion over the rows the scorer ACCEPTS, and recall is a proportion over the rows
whose answer is MATCH. So each has its own `n`, and both are binomial. The interval method is Wilson
or exact Clopper-Pearson. Brown, Cai and DasGupta, "Interval Estimation for a Binomial Proportion",
*Statistical Science* 16(2):101–133, 2001, doi:10.1214/ss/1009213286, recommend Wilson for small
`n`. Computed with SciPy's beta quantiles:

| n | observed 95% | 95% CI, Clopper-Pearson | width | observed 90% | 95% CI | width |
|---|---|---|---|---|---|---|
| 20 | 19/20 | 0.751–0.999 | 0.247 | 18/20 | 0.683–0.988 | 0.305 |
| 50 | 48/50 | 0.863–0.995 | 0.132 | 45/50 | 0.782–0.967 | 0.185 |
| 100 | 95/100 | 0.887–0.984 | 0.096 | 90/100 | 0.824–0.951 | 0.127 |
| 200 | 190/200 | 0.910–0.976 | 0.066 | 180/200 | 0.850–0.938 | 0.088 |
| 400 | 380/400 | 0.924–0.969 | 0.045 | 360/400 | 0.866–0.928 | 0.061 |

Wilson widths are 0.002 to 0.032 narrower at each row. **A gate phrased as "the one-sided 95% lower
bound is at least X"** needs this many rows on the metric's own denominator:

| lower bound at least | 0 errors | 1 error | 2 errors |
|---|---|---|---|
| 0.90 | 29 | 46 | 61 |
| 0.95 | 59 | 93 | 124 |

**So about 100 MATCH rows and 100 NO MATCH rows is the smallest set where both figures mean
something to ±0.05.** Below about 50, a 95% observation cannot be told apart from an 86% one. The
Works populations clear that comfortably: 171 modern positives, and 132 hard classic negatives
before any easy ones.

[[0028-the-confidence-score-is-falsifiable]]'s degenerate scorers need fewer rows. Say-yes-to-
everything has precision P/(P+N), so with 100 positives it fails a 0.90 gate at N ≥ 12 negatives and
a 0.95 gate at N ≥ 6. The set above catches it many times over.

### 3.6 A constraint the harness inherits

A committed set holding TMDB titles, dates or ids is TMDB content, and
[[0036-tmdb-licence-constraints]] caps caching "any information" at six months. CNCORE-375 already
counts ids inside that ceiling. So a labelled set of TMDB rows goes stale by licence, not only by
drift. It must either be re-taken live, like the corpus suite, or be re-dated inside the ceiling.
**Not decided here.** It is recorded so CNCORE-361 does not find it at review.

## 4. Can a people match be scored?

**YES, and it is the thinner of the two.**

### 4.1 Where the rows come from

- **TMDB side:** the persons credited on the series. `/tv/{id}/aggregate_credits` gives 1,642
  distinct persons for 121 and 1,286 for 57243, a union of **2,891**. That matches CNCORE-362's
  premise that TMDB people arrive only through credits on imported Works.
- **Wiki side:** `Template:Infobox Person`, ns 0, non-redirect, has **5,329** pages
  (`list=embeddedin`). The census recorded 5,315 on 2026-09-21, so the figure has grown by 14 in
  five days.

### 4.2 The evidence a labeller has

- **4,350 of 5,329** wiki Person pages (81.6%) carry an IMDb **person** id (`nm`) in `Imdb`
  (`Special:ExportRDF`). Of the 4,352 pages carrying `Imdb` at all, 2 carry something else. The
  census's 81.8% on 2026-09-21 reproduces. 4 pages carry two `nm` ids, and 4 `nm` ids sit on two
  pages each.
- **2,376 of 2,891** TMDB persons (82.2%) carry an `imdb_id`, and **1,769** (61.2%) a `wikidata_id`
  (`/person/{id}/external_ids`).
- **1,504 TMDB persons (52.0% of 2,891) share an IMDb id with 1,503 wiki Person pages.** Those are
  the positive pool.
- **52 of those 1,504** have different normalised names on the two sides. Those are "two spellings
  of one person" rows, which CNCORE-362 requires to be joinable. They are free, and a name-only
  scorer misses them.

### 4.3 Where the NO MATCH rows come from, and why there are few

- **Homonyms on the wiki:** 109 Person pages carry a parenthetical, and **9 base names** are held by
  two or more Person pages. Examples are `David Fisher (writer)` / `David Fisher (editor)` and `Peter
  Howell` / `Peter Howell (actor)`.
- **Homonyms on TMDB:** **6 names** are held by two TMDB person ids inside the 2,891 (`Ann Davies`,
  `Jonathan Caplan`, `Peter Howell`, `Jack May`, `John Turner`, `Jim Ward`). Both TMDB `Peter
  Howell`s carry no IMDb id, so that row can only be labelled by hand.
- **Same name, different IMDb id: 23 pairs.** A TMDB person and a wiki Person page have the same
  normalised name, and both carry an `nm`, but the two differ. **These are not automatically
  negatives.** In most of them the two ids are adjacent numbers (`nm0604544` / `nm0604545`), and
  the TMDB birth dates look like the same person. That suggests an id error on one side. **UNSOURCED
  which side is wrong.** IMDb itself was not consulted. Each needs a person to decide.

So the hard-negative pool is **tens of rows**: 9 + 6 + some share of the 23. The Works pool is 132.
Against the degenerate scorer that is enough (section 3.5: 6 to 12 negatives per 100 positives). As
a MEASUREMENT of how often a real scorer merges two homonyms it is weak. Zero false merges in 15
homonym rows still allows a true rate up to **18.1%** (one-sided 95%, 1 − 0.05^(1/15)). The set
should say that about itself rather than let a 1.0 read as proof.

### 4.4 The circularity that decides which rows count

[[0026-enrichment-reaches-every-provider]] makes agreeing identifiers evidence of a match, so a
people matcher will score on the same `nm` id that labels the 1,504 positives. **A set labelled by
IMDb agreement cannot measure a scorer that reads IMDb agreement.** The scorer would agree with its
own label by construction. The rows that measure something are these:

- the **515** TMDB persons (17.8%) with no IMDb id;
- the **979** wiki Person pages with none;
- the **23** disagreeing pairs;
- the homonyms.

These are labelled by hand against the pages themselves: birth and death dates, and a credit on a
Work the Works matcher has already joined. The people set must be drawn mostly from them. The
1,504-row pool is where a scorer is shown not to break the easy case.

**Two prerequisites today's code does not meet.** `provider-tmdb` refuses an `nm` id (section 1)
and serves no person, and nothing imports a wiki Person page. So neither side yet sends the
identifier this pool is built on. That is CNCORE-369's and CNCORE-352's ground, noted here so
CNCORE-362 does not assume it.

## 5. What the matcher does where the groups do not resolve

Neither answer is NO. For the rows the groups leave open, the evidence above says:

- **The Trial of a Time Lord** (one TMDB group, four wiki stories): no one-to-one match exists at
  story level. CNCORE-361's own sentence applies, and the Item names how many parts the other
  Provider holds and says that none was matched.
- **The 2005 and 2024 multi-episode stories** (4 of the 17 wiki stories that carry `Epcount`): TMDB
  has no story group, so these are the same NO MATCH case, with no group to help.
- **The 1996 TV film:** a different TMDB object type (a movie), outside the series pairs. Not
  measured here.

## 6. Retaking these figures

All measured 2026-09-26. The TMDB calls used the Owner's read token. The wiki calls went through
`provider-wiki/scripts/live-wiki.ts` (`api`, `listAll`, `exportRdf`) with the sandbox off, over
IPv4. Wikidata was read through `w/api.php`. WDQS answered `429`, rate-limited to one request a
minute during an outage, so no SPARQL figure is used.

- Groups: `/3/tv/{121,57243,239770}/episode_groups`, then `/3/tv/episode_group/{id}` for each.
- Episodes: `/3/tv/{id}/season/{n}` for every season, then
  `/3/tv/{id}/season/{n}/episode/{m}/external_ids` for each main-season episode.
- People: `/3/tv/{id}/aggregate_credits`, then `/3/person/{id}/external_ids`.
- Wiki stories: `list=categorymembers` on `Category:Doctor Who (1963) television stories` and
  `(2005)`, plus `action=ask` `[[Category:…]]|?Epcount|?Season|?Release date|?Imdb`. This is one
  category condition, so SMW's 16-subject limit does not apply.
- Wiki people: `list=embeddedin` on `Template:Infobox Person` (ns 0, non-redirect), then
  `Special:ExportRDF` in batches of 500, reading `Imdb`.
- Wikidata: `list=search` with `haswbstatement:P179=Q34316` (1,479 hits), then `wbgetentities` for
  `P31`, `P345`, `P361`, `P6262`.

## 7. Claims left unsourced

- Whether TMDB moderates an episode group before serving it.
- Whether `Story Order`'s contributor built it from Wikipedia or Wikidata. If so, sections 2.3 and
  2.4 are one source counted twice.
- Which side is wrong in the 23 same-name, different-IMDb person pairs.
- Why tardis.fandom.com titles coincide with tardis.wiki titles in 141 of 146 cases.
- Anything about spin-off series, which were not measured.
