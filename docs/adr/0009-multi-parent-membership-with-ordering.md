---
status: accepted
---

# Multi-parent membership with per-placement ordering

One item belongs to many containers at once, each with its own position. This is the product's
central claim and the thing no incumbent can express.

OAI-ORE's Proxy supplies the reification and IIIF's `behavior:"sequence"` supplies multiple
orderings, and NONE OF THE STANDARDS IN PLAY GIVES BOTH IN ONE CONSTRUCT. Combining them is our own
work.

Scoped deliberately to the standards this model derives from, because the unbounded version — that
no standard anywhere does this — was asserted and cannot be established. OAI-ORE comes closest: a
Proxy is reified per-Aggregation membership, one resource may belong to many Aggregations, and
sequencing is asserted between Proxies and is therefore already per-Aggregation. METS structMap, EAD
and rdf:Seq have not been surveyed.

## Two rules that follow, and the reasons they need stating

DUPLICATES ARE ALLOWED: the same item may appear twice in one container. Needed for recaps,
bookends and framing devices.

THERE IS NO UNIQUE CONSTRAINT ON (container_id, position): two DIFFERENT items may share a
position. A story-order container holding both a novel and the film that adapts it must place them
at the same point without inventing an order between them. That is what a shared position is FOR,
and without the reason written down it reads as a missing constraint.

The placement id is a STABLE SURROGATE rather than a key made of (parent, position).
[[0018-ordering-lives-on-the-placement]] owns that argument and the Jellyfin evidence behind it. An
earlier version of this paragraph restated it in full and pointed at ADR-0078 instead, which then
pointed back here — a citation circle around an owner neither record named. ADR-0078 was repointed
at 0018 already; this is the other half of that repair.

## Scale

The wiki is 96.8% multi-placement: its stories sit in MORE THAN ONE container, median 4 and
maximum 52. **That measurement is ADR-0057's**, which owns these figures and re-derived them from
the LIVE wiki on 2026-09-13 after the archive was deleted (ADR-0129); it is quoted here rather than
re-asserted, because a number stated twice is a number that can disagree with itself. It is what
sizes this decision, and what makes multi-placement the common case rather than a feature.

IT WAS 93.4% AGAINST THE ARCHIVE AND THE MOVE IS NOT AN ERROR BEING FIXED. The live figure counts
the categories the wiki shows a reader; ADR-0057 carries what each population was and why the two
are not the same question. The decision turns on multi-placement being the common case, which every
filter agrees on.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-standards.md`.

## As built, under CNCORE-4 and CNCORE-5

**BUILT, AND VISIBLE.** `placements` landed with migration 1 under CNCORE-4: a stable surrogate id,
container, item, position, nullable edition, and a child table of sources. CNCORE-5 reads it back
and renders it, so the claim is now something a person can look at rather than a shape in a schema.
The seeded item sits in two orderings that DISAGREE -- the 63rd thing released is the 1st thing that
happens -- because a demo where both orderings agree proves nothing a `series_index` column could
not also do.

Both rules this record says need stating are pinned by tests that fail if either is reversed: one
item twice in a container at different positions is accepted, and two different items at one
position are accepted. The absence of a unique constraint on (container_id, position) is the
decision, so a test is the only place it can be recorded in code.

WHAT THE READER SEES OF IT is "Also appears in", ONE list with a filter -- see
[[0017-placements-carry-sources-and-rank]] for why one list and not two.

## And under CNCORE-7: the same rules, on real data, plus a third

**TWO MEMBERS AT ONE POSITION IS NOW A REAL IMPORT RATHER THAN A TEST.** CNCORE-4 pinned the absence
of a unique constraint on (container_id, position) with a constructed pair. `browse` now imports
*Night of the Vashta Nerada* and *Day of the Vashta Nerada* into one container at position 1 each:
two halves of one box set, both dated 2017-07-27, and the archive asserts no order between them. A
provider that renumbered them would be handing over a claim its source never made, and the missing
constraint is what lets the catalogue record that honestly.

The record's own worked example was a novel and the film adapting it. The real one that arrived is a
box set nobody sequenced, which is the same shape and rather more ordinary.

**AND A THIRD RULE THIS RECORD DID NOT STATE: A MEMBER MAY HAVE NO POSITION AT ALL.** `browse` hands
back members its ordering cannot place -- for the wiki, a story the archive holds no release date
for, and its category ordering IS release order, so a sixth of the archive's stories arrive that
way. Migration 2 makes `position` nullable for them.

It follows from this record rather than extending it. Ordering is a fact about the placement, so
"a member of this container, position unknown" is a fact about a placement too, and there is nowhere
else in the model to put it. The two alternatives each assert something no source said: dropping the
member shrinks the container silently, and numbering it last claims it came out after everything
else.

**The unique constraint is NULLS NOT DISTINCT**, which is the half that is easy to miss. Under
PostgreSQL's default NULL is distinct from NULL, so two sources both saying "a member, position
unknown" would be two rows -- and [[0017-placements-carry-sources-and-rank]] has sources agreeing
recorded against one row. Without it, the least certain fact in the table would be the one kind of
agreement the constraint failed to record.

## And under CNCORE-9: the claim answers to something outside the product

**UNTIL NOW EVERY PROOF OF THIS RECORD USED DATA THE PRODUCT ITSELF HAD WRITTEN.** CNCORE-4 pinned
the rules with a constructed pair, CNCORE-5 seeded one item into two orderings, and CNCORE-7 browsed
a real container and hand-placed one of its members into a second. All three are checks of the model
against a fixture the model was handed, and all three would pass in a system that had quietly
narrowed to one parent and answered the same ordering twice.

`apps/web/e2e/multi-placement.test.ts` is the one that cannot. *New Earth* is the wiki's third
story of series 2 and TMDB's first episode of season 2, and NEITHER NUMBER IS OURS: the wiki's
arrives by a real `browse` of ADR-0057's committed extract, and TMDB's is hardcoded beside the
assertion, read from `tv/57243` on 2026-09-11. The offset holds at the far end too -- fifteen against
thirteen for *Doomsday* -- so it cannot be a coincidence at position 1.

**MEASURED RATHER THAN ARGUED: a one-parent read path fails six of that file's eight assertions.**
`.limit(1)` on `findPlacementsOfItem` is what a tree answers, and it was run as a mutant. That is
what makes this record falsifiable rather than merely illustrated.

**AND THE CONTROL IS THE HALF THAT IS EASY TO LEAVE OUT.** *Rose* sits first in both sources, so the
file also holds a row where they AGREE -- without one it could not tell a detected disagreement from
a test that finds one wherever it looks. See
[[0017-placements-carry-sources-and-rank]], which owns what agreement lands on.
