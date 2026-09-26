---
status: proposed
---

# TMDB's terms are constraints the code cannot show

TMDB forbids caching "for longer than 6 months" — a CEILING, not an obligation to hold one — and it
covers "any information", so a cached poster and a cached runtime are treated identically.

The attribution notice must be verbatim and prominent (checked 2026-09-07): "This [website,
program, service, application, product] uses TMDB and the TMDB APIs but is not endorsed, certified,
or otherwise approved by TMDB." The TMDB logo must be less prominent than ours. TMDB grants no rights in the underlying images —
the studios keep those — which is the posture every product in this space operates under.

Clauses to settle with TMDB before the public demo ships rather than after: using TMDB "as an image
hosting service for banner advertisements, graphics, etc." is prohibited — and the trailing "etc."
makes that BROADER than a narrow ad-banner ban, which supports storing the bytes more strongly than
a narrow reading would — and using it "on or in connection with a 'destination'
website, search engine, or interactive query-response system (including large language model
(LLM), artificial intelligence, or any other machine learning based interactive query-response
systems or chatbots) ... or for driving traffic" counts as commercial use needing a separate written
agreement, judged by TMDB "in its sole discretion".

Our disposition on that second clause, recorded so it is not re-derived: a free read-only demo is
not obviously a destination website, but it is TMDB's call to make and it is better asked than
assumed. ADR-0100 states the non-commercial posture the question is asked from.

AND THERE IS A SECOND, SEPARATE AI CLAUSE WITH NO ESCAPE HATCH, in the paragraph 1.C restrictions
list rather than the commercial-use examples: "Use the TMDB APIs or TMDB Content in connection with,
including for training, a machine learning (ML) or artificial intelligence (AI) based Application."
Unlike the commercial-use clause, no written agreement is offered against it.

Our reading is that it does not bite: CanonCore is a catalogue, not an AI-based application, and
building software with AI tooling is not using TMDB Content in connection with one. That reading is
recorded here deliberately, because a later reader who finds the clause should see it was considered
rather than missed. It was missed once already. Termination requires purging all cached TMDB content,
which `source` on every statement and artwork row already makes one delete. (It said that, and then
there was no artwork table, so it was corrected to statements alone; CNCORE-358 built the table and
`purgeProvider` deletes a provider's pictures with the rest, so the artwork half holds again.)

## Evidence

TMDB's terms were fetched from themoviedb.org/api-terms-of-use on 2026-09-10 and every clause quoted here was confirmed verbatim. Wider working in `docs/research/verify-adr-products.md`.


## Half built, under CNCORE-16 and CNCORE-8 -- and this record stays PROPOSED

**BUILT: attribution, all three obligations of it.** Paragraph 3 is three requirements and it is
worth counting them, because CNCORE-16 built the third and named the first as a gap in its own
`docs/tmdb-terms.md` — a doc naming a gap is not a gap covered.

1. *"You must use the TMDB logo"* — unconditional, not a rule about logos you chose to use.
   `provider-tmdb` now declares one, and CanonCore renders it.
2. *"less prominent than the logos or marks that primarily describe or identify Your Application"* —
   CanonCore had no such mark at all until this slice; the header was a Home link and a theme
   toggle, so there was nothing for TMDB's to be less prominent THAN. There is a wordmark now, and
   both sizes live in one file and are emitted as explicit sizes in the HTML, so the comparison is in
   the bytes a reader is served and the end-to-end suite reads it back out of them.
3. The notice, verbatim and prominent, rendered unaltered on every page showing that source's claims.

**AND THE MARK TRAVELS AS BYTES, NOT AS A URL**, which is the decision here worth reading twice.
Every other image in CMPP is a URL because CanonCore's SERVER fetches it, and ADR-0034's allowlist is
a promise about what the server may reach. A mark on a page is fetched by the READER'S BROWSER, which
nothing has ever promised can reach a provider on a LAN address or a container network — and the
resulting breach renders as whitespace, with nothing anywhere reporting one. A licence obligation
whose failure mode is invisible has to be the one that cannot half-arrive.

**BUILT: the purge, and it is one delete rather than a feature.** This record's claim about
termination is now exercised: `provider.purge` removes every statement and every placement source
carrying that provider, the placements it was the last claimant of, the items nothing is left
asserting anything about, and the source row itself. No ownership column, no tombstone reconciliation
and no per-table policy, because every row that can carry a claim already names who made it. An item
the owner also placed somewhere, or put in a Group, survives, untitled — either is the owner's claim,
and a provider's licence ending has no bearing on it. (The Group half is CNCORE-232's, below.)

**HALF BUILT SINCE CNCORE-360: the six-month ceiling.** `max_cache_age` is declared by
`provider-tmdb` at 180 days, and until CNCORE-360 it was read by nothing: the app honoured the
ceiling only by not caching, which is compliance by absence rather than by mechanism. It is READ
ON THE ITEM PAGE'S CLAIMS now, and on its pictures since CNCORE-358 (by the same `observed_at`
rule, [[0037-artwork-stores-its-bytes]]), and NOT on the projected columns. "Under CNCORE-360" below says
which reads refuse an expired value and which cannot, and it is why this record is still
`proposed`.

**AND CNCORE-9 IS THE FIRST THING TO STORE ONE, SO THE CEILING IS NOW LIVE RATHER THAN
HYPOTHETICAL.** That ticket hardcodes TMDB's season and episode numbers as the expected positions of
a test. A COMMITTED EXPECTATION IS A CACHE THAT NEVER EXPIRES: no read-time `max_cache_age` check
will ever reach a number in git, and the six-month ceiling covers "any information" rather than
images alone, so an episode number is inside it however factual it reads.

**WHAT IS ACTUALLY HELD, as built, which is more than this record first named and changed shape
under CNCORE-361.** It said *New Earth*, *Doomsday* and *The Christmas Invasion*. Since CNCORE-361
`apps/web/e2e/multi-placement.test.ts` BROWSES TMDB rather than writing its claims by hand, so the
literals are expectations compared against what a real browse answers, never values written into the
catalogue. Read from the API on 2026-09-11 and again on 2026-09-26, it holds:

* THREE CONTAINER IDS, TMDB's own identifiers for its own records: `season:57243:1`,
  `season:57243:2` and `season:57243:0`
* FIVE EPISODE NUMBERS: *Rose* at 1 in season 1; *New Earth* at 1, *Fear Her* at 11 and *Doomsday*
  at 13 in season 2; *The Christmas Invasion* at 2 in `Specials`
* ONE TMDB TITLE, `Children in Need: Born Again`, which is why that story is offered rather than
  matched

The season names `Series 2` and `Specials`, and *Born Again*'s number, are no longer held: the hand
step that needed them is gone. Season 1 is now a container of TMDB's own (ADR-0026 says why), so the
agreement on *Rose* is two orderings rather than one row.

**AND CNCORE-361 ADDED THREE MORE FILES THAT HOLD TMDB CONTENT, each taken 2026-09-26:**

* `apps/web/e2e/global-setup.ts`'s `TMDB_SEASONS`, the stand-in the suite uses where no real image
  answers: four seasons' ids, names, and 38 episodes' TMDB ids, titles and air dates.
* `apps/web/e2e/works-match.test.ts`: `season:121:4`, and that TMDB holds *The Tenth Planet* as four
  parts.
* `packages/db/src/testing/works-labelled.json`, the matcher's labelled set
  ([[0028-the-confidence-score-is-falsifiable]]): 751 rows of TMDB episode ids, titles and air dates,
  and the titles of every season they sit in. **IT IS THE FIRST LITERAL HERE THAT ENFORCES THE CEILING
  ITSELF**: it carries the date it was taken, and a test in `works-match.test.ts` goes red 180 days
  after it. So that set cannot outlive the six months unnoticed, as the rest can.

`packages/api/src/routers/provider.test.ts`'s stand-ins for TMDB answers (titles and air dates such as
`The Smugglers (1)`) are TMDB content too, by the rule below.

The count that matters is not the tally but the rule: EVERYTHING IN THOSE FILES THAT CAME FROM TMDB IS
CACHED TMDB CONTENT, and purging TMDB means reading the files rather than a list here. This record has
undercounted what is held three times now.

**They are recorded here as cached TMDB Content subject to the purge duty.** That is the answer this
record's termination clause requires, and the alternative was to derive the expectations from a
source without the clause — there is none, because TMDB IS the second source and a second source is
the whole of what CNCORE-9 asserts.

**AND `provider.purge` DOES NOT REACH THEM, WHICH IS THE HALF A READER WILL OTHERWISE ASSUME.** That
procedure is built and it works on ROWS: it removes every statement and placement carrying the
provider, the placements it was the last claimant of, and the items nothing is left asserting
anything about. A number hardcoded in a test file is none of those. So purging TMDB is TWO ACTS
rather than one — the procedure against the database, and a hand edit against version control — and
only the first is mechanised. The rows those numbers are compared against carry their source and are
purged normally; the expectations themselves are a literal in a file that no code path can find.

That asymmetry is the whole reason this is written down rather than inferred. A purge that ran
cleanly and left the expectations in git would report success, and the test would go on asserting
TMDB's numbers after the right to hold them had ended.

WHAT THIS DOES NOT DO IS BUILD THE MECHANISM. A note in a record is not a read-time check, and the
paragraph above stands: this record closes when something honours `max_cache_age` in code. What is
now true is that the first cached value exists and is declared, rather than existing unnoticed —
which is the failure mode a fixture in git was always going to have.

**NOT SETTLED, and unchanged: the two clauses to put to TMDB before a public demo ships.** The
commercial-use question and paragraph 1.C's AI restriction are both dispositions recorded above
rather than answers, and nothing in these two tickets touched either.

## Two instances of one provider are two notices -- under CNCORE-130

**A LABEL IS NOT AN IDENTITY, AND THE ATTRIBUTION LIST USED TO KEY ON ONE.** `sources` is unique on
`(owner_id, kind, identity)`; nothing constrains `label`, which for a provider is its own `name` off
its manifest. `findAttributionOwed` answers ONE ROW PER SOURCE, so a second instance of a
notice-carrying provider is a second obligation under one name -- and keyed by that name, two
notices were two siblings with one key. `Attribution` now keys by PLACE, which is how `AssertedBy`
settled the same question under CNCORE-128. THAT DECISION IS NOT IN A RECORD: it lives only as the
comment at its own site, `AssertedBy` in `apps/web/src/app/items/[id]/page.tsx`, which is where a
reader has to go for it and is half the reason this one is written down here instead.

**NOTHING ELSE IS AVAILABLE TO KEY ON.** ADR-0045 §"The public read path names every field it emits"
is the rule -- the read path "carries no internal ids, no owner id and no notes" -- and the reason
the source's IDENTITY goes with them is stated where that field is declared, in `attributionPublic`
in `packages/schemas/src/index.ts`: a URL an owner typed is a deployment detail and, for a provider
on a private network, an address a reader has no business being handed. Nor would the content serve:
two instances of one provider agree on all three fields a row has -- one label, one notice, one mark
-- so a key derived from any of them collides for exactly the case this is about. Place is the only
discriminator there is.

**AND PLACE IS DETERMINISTIC HERE RATHER THAN MERELY HARMLESS**, which is the half that makes it a
key rather than a shrug. `sources_order` is unique on `(owner_id, source_order)` and
`findAttributionOwed` orders by it (ADR-0025's one global source order), so the nth notice is the
same source on every request. A place that named a different source between two renders would be
the very thing a key exists to prevent.

**THE LOGO DOES NOT CHANGE THAT ANSWER**, which is worth recording because an attribution row carries
one where a source name does not, and that difference is why this was a ticket of its own rather than
a line in the last one. Place is unsafe where reordering moves state the DOM holds and React cannot
see; these rows hold none. The mark is a `data:` URI -- constrained to one by `attributionPublic` and
enforced on the render path by `item.get`'s output schema -- so reusing an element and swapping `src`
fetches nothing and cannot flash a stale image, and the list is server-rendered with no client
reordering to meet.

### What asserts this, and what does not

**THE KEY ITSELF IS ASSERTED BY NOTHING, AND THAT IS MEASURED RATHER THAN ASSUMED.** A React key is
not serialised into HTML, and ON REACT 19.2.8 the server renderer renders both siblings and emits no
warning for a duplicate one:

    renderToStaticMarkup(<ul>{rows.map((r) => <li key={r.label}>{r.notice}</li>)}</ul>)
    // two rows, one label -> <ul><li>A</li><li>B</li></ul>, and console.error never called

So the document a reader is served is byte-identical before and after this fix, and the page seam
cannot tell them apart. The RSC flight payload DOES carry it -- measured the same way, the key is the
third slot of each element, `["$","li","provider-tmdb",{"children":"A"},...]` -- but asserting on
that would be asserting React's serialisation rather than the page's content, which
`apps/web/e2e/document.ts` refuses for its own reasons. ADR-0103 §"The third seam, and why the first
draft of this record refused it" rules component rendering out, and §"The sixth seam: THE PAGE IN A
BROWSER, and the reservation is spent -- under CNCORE-73" says a seventh seam is a new argument
rather than a draw on that record's credit. This fix is not the argument for one; VERIFICATION OF THE
KEY IS CODE REVIEW, and a reader should know that rather than assume a test is holding it.

**WHAT IS ASSERTED IS THE LICENCE SURFACE EITHER SIDE OF IT**, which is where a notice can actually go
missing:

- **The read path answers one row per SOURCE.** `findAttributionOwed` gives TWO rows for two sources
  sharing a label. That is green against the query as written, and it is there for what a later
  reading of that answer would do -- two identical rows look like a redundancy, and a `distinct` or a
  group-by on the label would drop one. VERIFIED BY BREAKING IT: deduping the answer on the label
  turns a green run into `Tests 1 failed`, and the one is this test.
- **The page renders one notice per row.** Two sources sharing a label, each owing a notice on one
  item, put TWO notices under Sources in the served HTML. COUNTED OFF THE ROWS RATHER THAN THE
  NOTICE TEXT, because two instances of one provider declare ONE licence -- the sentence is
  identical, so a `toContain` cannot tell one notice from two, which is the confusion the defect
  lived in. VERIFIED BY BREAKING IT TOO: deduping the list on the label inside `Attribution` fails
  with `expected [ Array(1) ] to have a length of 2 but got 1`.

A notice a reader is owed going missing is this record's first obligation, and neither half of it was
reported by anything before.

## An Item in a Group survives a purge -- under CNCORE-232

**A LIVE GROUP MEMBERSHIP IS THE OWNER'S CLAIM, SO IT KEEPS THE ITEM**, the way the Owner's own
Placement does. That is decided by two sentences that already stood rather than invented here:
`CONTEXT.md`'s Purge says "an item the owner also claims is not removed by one", and migration 19
calls a `group_items` row "nobody's claim but the Owner's". Nobody but the Owner ever puts an Item in
a Group, so nothing about a provider's licence ending bears on it. The Item stays, stripped of that
provider's words and still in the Group, and the preview counts it among `keptItems` rather than
among what goes.

**LIVE MEANS THE GROUP AS WELL AS THE MEMBERSHIP.** A membership that outlived its Group narrows
nothing ([[0010-groups-scope-never-partition]], under CNCORE-230), so it is nobody's scope and keeps
nothing. `deleteOrphansAmong` reads it through `LIVE_GROUP_MEMBERSHIP`, the one spelling of a live
membership that `inTheGroup` and `findGroupsOfItem` read as well (CNCORE-234). Until that ticket it
was a THIRD COPY of the rule, and the three agreed only because each was copied, which is how
CNCORE-230 came about. The purge is now held to the rule by construction. The test for a membership
that outlived its Group shows it: dropping the Group's tombstone from that one spelling fails one test
for each of the three readers, in `catalogue.test.ts`, `groups.test.ts` and `import.test.ts`.

**A DEAD MEMBERSHIP KEEPS NOTHING, BUT IT STILL NAMES THE ITEM, AND THE PURGE TAKES IT WITH THE ITEM.**
A membership the Owner took back out is a tombstone, not a DELETE (ADR-0075), and `group_items.item_id`
carries no cascade, so before this ticket such a row refused the Item's delete with `23503`. Nothing
was purged at all, and the preview failed the same way because it is the same traversal. So an
Item's dead memberships are hard-deleted just ahead of the Item. This is the one row the purge takes
on the ITEM'S account rather than the provider's, and it is not the "tombstone reconciliation" that
"BUILT: the purge" rules out above: it follows from the foreign key, not from anything the provider
said.

**ONLY THE DOOMED ITEMS' DEAD MEMBERSHIPS.** The simpler "every dead membership among the Items this
provider touched" would also remove the tombstones of Items that survive, and putting such an Item
back in a Group would then mint a second row instead of returning the one it always had (ADR-0078).
The dead memberships go UNCOUNTED: an Owner cannot see a membership they took out, so a count of
them would tell them nothing they could act on.

**AND IN ONE STATEMENT, WHICH REVIEW FORCED.** The first version was two: delete the doomed Items'
memberships, then delete the doomed Items, each asking the predicate afresh. Under READ COMMITTED each
statement takes its own snapshot, so an Owner taking a KEPT Item out of its Group between the two
made the second statement find it orphaned while the first had left its new tombstone standing. The
delete then failed with `23503`, which is the failure this ticket exists to remove. Now the doomed
Items are chosen once, in a `WITH`, and both deletes read that one set. PostgreSQL runs every
sub-statement of a `WITH` "with the same snapshot" (its manual, "Data-Modifying Statements in WITH",
read 2026-09-19 for version 18), so the two cannot see different catalogues. The foreign key is
checked at the end of that statement and accepts it, which the taken-out test shows by passing.

**A RACE THAT IS NOT CLOSED, AND IS NOT THIS TICKET'S.** An Owner putting a doomed Item in a Group
while that one statement runs can still commit a membership it did not see, and the foreign key then
refuses the whole purge. The same is true of a Placement or a `based_on` written by hand in that
moment, since six of the seven foreign keys into `items` lack a cascade and theirs are among the six
(`placements.item_id` and `container_id`, `statements.value_item_id`). It fails safe: nothing is
half-purged, and running the purge again succeeds. The seventh, `statements.subject_item_id`, is
`ON DELETE CASCADE`, so a statement ABOUT a doomed Item cannot refuse the purge this way. Migration
1 gives no reason for that cascade, and this traversal relies on it: a derived statement left about
a doomed Item goes with the Item by it (CNCORE-173). Counted from `pg_constraint` on 2026-09-19.

**WHAT ASSERTS IT**, at the package seam in `packages/db/src/import.test.ts`, each asking the
preview first and holding the purge to it: an Item in a Group is kept and still in the Group; one
taken back out goes; one whose only membership outlived its Group goes; and a kept Item's
taken-out membership comes back under its old id. The last two were CHECKED BY BREAKING THE CODE,
since the Group's tombstone arrived in the same change as the first: without that tombstone in the
clause, the Item that outlived its Group is kept (`keptItems` 1 where 0 is right), and widening
the sweep to every dead membership among the candidates makes the put answer a fresh id.

**THIS RECORD STAYS PROPOSED.** CNCORE-232 completes the purge half. The six-month ceiling is read
since CNCORE-360, but not on the projected columns, which is what still holds this record open (see
"Under CNCORE-360" below).

## Under CNCORE-360: the ceiling is read where an Item page shows a claim

CNCORE-360 is the day this record's own sentence names: "the day something stores a value or an
image is the day it stops being enough". It stores TMDB's programmes and their seasons as Containers
of their own, at scale, so the ceiling had to become a mechanism in the same change.

**BUILT: every stored value carries the moment it was taken.** That column already existed on two of
the three tables that hold a Provider's claims. ADR-0012 lists `observed_at` among a claim's
attributes, and migration 1 put it on `statements` and `placement_sources`. An Identifier (migration
23) had none, and migration 24 gives it one. The column was set on insert and NEVER refreshed, so a
value TMDB repeats every week would have expired six months after TMDB FIRST said it. Now
`assertClaims`, `assertPlacement` and `assertIdentifiers` each move it to `now()` on a row the
source says again. The cost is that a re-import rewrites every row it confirms: `updated_at` and the
change sequence advance with it, where before an unchanged row was left alone.

**BUILT: the source keeps its ceiling.** `sources.max_cache_age` (migration 24) is taken off the
manifest on every import, beside the attribution and for its reason: a Provider may revise it.
`ImportingProvider.maxCacheAge` is REQUIRED, `null` included, for the reason the attribution is:
a caller that could omit it would clear a stored ceiling and keep that source's values forever.

**BUILT: a read refuses a claim taken longer ago than its source allows.** The check is one
predicate, `insideItsCeiling` in `packages/db/src/queries.ts`, and it compares the claim's own
`observed_at` with its own source's `max_cache_age` at the moment of the read. So no job has to have
run, and a value nobody touched for six months is refused by the first read after it. It stands in:

- `findStatementsOfItem`, the claims an Item page lists;
- `findIdentifiersOfItem`, its ids in other schemes;
- `findPartsHeldElsewhere`, how many parts another Provider holds an Item's work as (CNCORE-361),
  which `provider.purge` also removes with its source;
- `standingBehindThePlacement`, so an expired claim does not name who placed a Placement;
- `whatItHolds` and `whatItSitsIn`, through `STILL_HELD`. A Placement whose every standing claim
  has expired is refused from a Container's Members, from an Item's orderings, and from the counts
  a catalogue Row reports off those two. A Placement nobody stands behind at all is still shown,
  which is the read path's standing rule and is not this record's to change.

A source declaring no ceiling is never refused, which covers the Owner.

**AND `provider-wiki` NOW DECLARES NONE, WHICH IS THE OWNER'S DECISION, TAKEN ON 2026-09-26.** It
declared thirty days, and its own comment called that "a freshness choice rather than a licence
one". A declared `max_cache_age` IS a ceiling that a read enforces, as [[0037-artwork-stores-its-bytes]]
has always said, so that number would have emptied every timeline not browsed again within a month,
with nothing scheduled to browse it. No licence imposes a ceiling on the wiki: its text is CC BY-SA
3.0 Unported ([[0057-the-archive-stays-outside-the-repo]]), and its images are
permitted personally. So it declares none
([provider-wiki#76](https://github.com/jacobdrees-canoncore/provider-wiki/pull/76)). Two options
were declined: keeping the number and scheduling a re-import before it passed, which is correct to
the letter but empties the catalogue until that job exists, and splitting the field into a ceiling
and a freshness hint, which is a contract change for a number nothing needs. `max_cache_age` means
a licence ceiling and nothing else, so a Provider declares it only where a licence imposes one.
TMDB's 180 days is exactly that, and a TMDB value nobody re-imports within six months is refused on
read, as its terms require. Nothing re-imports on a schedule yet. Asserted at the router in process (ADR-0103), in `provider.test.ts`, "a Provider's
cache ceiling". Values are aged by moving `observed_at` into the past, never by waiting. Mutation-
checked, each run and read: deleting the check from the statements read, the Identifiers read or
`whatItHolds`, not writing the ceiling onto the source, and not refreshing `observed_at` in any of
the three writers each turns exactly one of the four tests red.

**NOT BUILT, AND IT IS WHY THIS RECORD STAYS `proposed`: the projected columns.** `items.title` and
`items.sort_name` are written by `winning_literal` when a statement changes (ADR-0014). They are a
snapshot, not a read, and time passing changes no row, so nothing can re-project an expired title
at the moment it expires. Every listing, the catalogue search and an Item page's own heading read
`items.title`. So a title TMDB gave seven months ago and has not said since is refused from the
page's list of claims AND STILL SHOWN AS THE ITEM'S NAME. That is the largest cached value a read-
time check does not reach, and it is TMDB Content as squarely as a season number is. `holds_work`
is the same shape one level over, a projection of Placements, and it is not refreshed by expiry
either.

**AND THREE SMALLER GAPS, each named so none is assumed covered:**

- A source row written before migration 24 holds `max_cache_age` NULL, so it is never refused,
  until that Provider's next import writes the value. Nothing kept the ceiling to backfill it from.
- `findItemsProvided`, the read that tells a search which candidates are already held, maps
  TMDB's ids to Items without the check. It shows no TMDB Content, but it does read a claim.
- The two anchor reads a listing resumes from, `findInThisItemsOrder` and `findInTheContainersOrder`, do not
  read `STILL_HELD`, so a cursor naming a Placement that has since expired still resumes after
  it. They answer a position rather than a value, and the rows the page then shows are checked.
- Artwork: there is no image store yet (CNCORE-358), and expiring a stored picture is CNCORE-372's
  by that ticket's own criterion. The test literals above are still two acts to purge, not one.

**NOT SETTLED, still:** the two clauses to put to TMDB before a public demo ships. CNCORE-360 touched
neither, and the commercial-use question and paragraph 1.C's AI restriction remain dispositions
rather than answers.
