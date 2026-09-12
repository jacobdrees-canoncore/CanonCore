---
status: accepted
---

# A fresh install starts empty, and the archive is never shipped or demoed

The archive is NOT shipped seed data. A fresh install by anyone else starts EMPTY: no items, no
placements, no editions, nothing in the catalogue. It is NOT on the public demo, which is
deliberately other material (`docs/demo.md`).

**"EMPTY" IS ABOUT WHAT IS SHIPPED TO SOMEBODY ELSE, NEVER ABOUT A REPOSITORY OR A DEVELOPER'S BOX.**
An earlier version of this record said "no content of any kind", which the committed fixture
contradicts on its face, and a first attempt at this correction then overcorrected into a second
false claim — that no setup step loads archive-derived content. It does. Three things are being run
together and they need separating:

1. **A CLONE.** ADR-0057's named fixture is committed, in the wiki provider's repository rather than
   this one. It exists to be read by tests and nothing loads it into a catalogue.
2. **A DEVELOPER'S DATABASE.** `pnpm db:setup` seeds one item titled *The Daleks' Master Plan* — an
   archive row's name, hand-written in `packages/db/src/seed.ts` rather than extracted — because
   CNCORE-4 and CNCORE-5 need something on the page to look at. That is archive-derived content in a
   database, and pretending otherwise is how this record acquires a false claim for the second time.
3. **AN INSTALL.** Somebody else's running instance. THAT is what starts empty, and it is the only
   one of the three this record governs.

The line is not clone-versus-install; it is whether content travels TO A STRANGER. A seeded worktree
is ours and a fixture is a test input. Neither is a catalogue handed to someone who did not ask for
it, and that is the thing being refused.

The archive has three private jobs and an earlier version of this paragraph credited them all to one
record. ADR-0057 gives it two: a queried source for that fixture, and a stress test to size the
model against. The third, THE OWNER'S OWN LIBRARY, is `CONTEXT.md`'s alone — no ADR states it, this
one included, and sending a reader to ADR-0057 for it wastes their time.

This record is the negative half of the same decision, and it is the easier half to get wrong,
because seeding a new install with the data you already have is the path of least resistance and it
is how someone else's catalogue becomes the product.

## Empty is not the same as UNEXPLAINED, and this record governs only the first

What content ships is decided above. **What the resulting screen says is not decided here, and
reading this record alone as the whole answer is what produced the defect below.**

Two shards of the competitor sweep independently rated a fresh CanonCore's first run HIGH:
`sweep-plex-support-C.md` ("Every decision in the prompt is individually right and together they
produce the worst possible first five minutes") and `sweep-jellyfin-repo.md` ("A self-hosted
product's first five minutes are unspecified in the prompt", classified ABSENT — HIGH). A third
shard names the mechanism without rating it: "CanonCore's equivalent path has an extra mandatory
step nobody has written down — connect a provider." The mandatory step is real and was not merely
undocumented: the allowlist defaults to empty, which refuses every provider, and the README did not
mention it at all. (It was `PROVIDER_ALLOWLIST` then; the default survived the move to a Setting
under CNCORE-99 unchanged, which is the half that mattered.) CNCORE-64 gave it a row in the
README's `### What it reads` table and a line in `.env.example`, and CNCORE-65 put it on the front
page. The default is untouched and still deliberate; what changed is that it is now told to the
person it governs.

So an install that starts empty is correct, and an install that starts empty WITHOUT SAYING WHAT TO
DO NEXT is a separate failure this record does not licence.
[[0115-the-public-release-comes-before-the-playback-half]] is where that is closed. Nothing in the
refusal above softens: no seed data travels to a stranger, and the fix is words on a page rather
than rows in a database.

## As built, under CNCORE-65, and accepted under CNCORE-105

**THIS RECORD IS `accepted`, AND THE WORD IT WAITED ON WAS "INSTALL".** Its own subject is what
travels to a stranger, and when CNCORE-65 landed there was no install path — no image and no
documented command. CNCORE-63 published the image, CNCORE-64 documented the command, and CNCORE-64
then WALKED it: the README followed from a directory with no checkout, with no `auths` entry in
`~/.docker/config.json` at all, which is what proves the run a stranger gets rather than the one
the owner gets. That run read the page as well as the status code — it served `Your catalogue is
empty` and `No provider is allowlisted` — so this record's own subject was observed on it rather
than inferred from a 200. CNCORE-70 repeated the walk at `v0.1.0` from a clean volume, and CNCORE-75 at `v0.2.0`
from a volume it had removed first: `items`, `placements` and `statements` all zero before a hand
touched them, the schema's own furniture written by the ladder as before. A record
about what somebody else's instance starts with can be accepted once somebody else can start one,
and they can. The flip was owed by CNCORE-64 and is made by CNCORE-105.

**AND THE EMPTINESS HAS A SECOND WAY OUT, WHICH THE PAGE NAMES SINCE CNCORE-131.** This record's
other half is that an install starting empty must say what to do next, and the front page said it in
two steps that were both about a Provider: allowlist one, then import from it. Since v0.2.0 neither
is necessary — an owner fills a catalogue by hand, and the walk that found this configured no
Provider at all (CNCORE-75). So that copy was not wrong and was not the whole answer either: a
reader whose instance reached nothing was sent to go and find something for it to reach, past the
shorter path already on the page they were looking at. **THE PAGE OFFERS TWO ROUTES NOW, AND THE ONE
THAT NEEDS NO PROVIDER GOES FIRST** — `/new`, which makes an Item with no file and no provider
record (ADR-0003) — beside the provider's route, which keeps both its steps and names the two
Settings it needs (ADR-0121). It was FILED rather than fixed inside the release ticket, because it
is product copy and the header's own `New item` link meant the capability was reachable rather than
hidden. Reachable and unsaid is exactly what this record does not licence, which is why reachable
was not an answer.

**AND THE ROUTE IS OFFERED WHETHER OR NOT A PROVIDER IS ALLOWLISTED**, which is the half that needed
a fixture rather than words. Every empty instance in the suite was also an unconfigured one, so
"the catalogue holds nothing" and "this instance reaches nothing" moved together and no assertion
could tell which of them the page was reading. `front-page.test.ts` stands up an instance in the
missing combination — an allowlist that admits something, a catalogue that is still empty — so an
empty state that acquired a second condition, shown only where nothing is reachable, fails there
rather than passing everything.

**WHAT `accepted` DOES NOT ASSERT, BECAUSE THE TITLE IS TWO REFUSALS AND ONLY ONE HAS MET AN
INSTANCE.** "Never shipped" is the half above, walked. "Never demoed" is not: there IS no public
demo, it sequences LAST behind playback and the clients (`docs/demo.md`,
[[0055-web-now-phone-next-tv-last]]), so that half is a refusal held in advance rather than one
anything has yet had the chance to break. It binds whoever builds that surface exactly as it did
while this record read `proposed`; it is named here only so `accepted` cannot be read as both
halves having been tested.

**AND WHAT A FRESH INSTALL DOES CARRY WAS COUNTED UNDER CNCORE-105, BECAUSE "EMPTY" HAS BEEN
OVERSTATED HERE TWICE.** The path was walked once more on 2026-09-12, against
`ghcr.io/jacobdrees-canoncore/canoncore:latest` pulled with no credentials at revision `5c16778`,
and this time the database was counted rather than only the page read. `items`, `placements`,
`statements`, `aliases`, `merges` and `placement_sources` each held zero rows. What is not zero is
the schema's own furniture, written by the migration ladder at first boot rather than shipped from
anywhere: migration 1 seeds the vocabulary (`item_kinds` 7, `ranks` 3, `source_kinds` 4, the three
`property_*` enumerations, and ELEVEN properties — migration 3's `external_id` makes the twelfth),
ONE `owners` row labelled "Owner" whose id is generated per install (ADR-0044), and its `owner`
Source sitting first in the global source order (ADR-0025). **So the opening sentence is exact as
written and has to stay that way** — "nothing in the catalogue", never "nothing in the database". A
third run at "no content of any kind" would be refuted by a row count that takes half a minute.

The first evidence for it was CNCORE-65's suite. `apps/web/e2e/front-page.test.ts` stands up the
same build a second time against a database built from empty, reaching nothing, and asks it for
`/`. (It was `PROVIDER_ALLOWLIST` unset when this was written; since CNCORE-99 the allowlist is a
Settings row and the fixture writes an empty one, which is the same state arrived at through the
store the surface writes.) Until then "a fresh install starts empty" was a property nothing exercised: every
suite in the repo ran against a seeded database, which is the one state this record does not
govern.

**And the half this record explicitly does not licence is now closed.** The section above ends "an
install that starts empty WITHOUT SAYING WHAT TO DO NEXT is a separate failure", and points at
[[0115-the-public-release-comes-before-the-playback-half]]. CNCORE-65 is where that was done and
CNCORE-131 is where it was finished: the empty catalogue names the ROUTES that fill it — by hand,
and from a provider — and an instance with nothing allowlisted says so rather than leaving an empty
result to read as breakage. Nothing in the refusal softened — the fix is words on a page, and no
seed data travels anywhere.

**The third state the page reports was not in this record and is worth naming**: an allowlist that
names nothing is not the same fact as a catalogue that holds nothing, and an owner can be in either
without the other — which CNCORE-131 turned from a claim into a fixture, having found that no
instance in the suite was in one without the other. The page reads them as two conditions off two
facts rather than as one "unconfigured" state, because an owner with items and no allowlist is
stuck in a way an empty catalogue does not describe.
