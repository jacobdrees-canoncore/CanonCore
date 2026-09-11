---
status: proposed
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
step nobody has written down — connect a provider." The mandatory step is real and is not merely undocumented: `PROVIDER_ALLOWLIST`
defaults to `""`, which the code comment describes as refusing every provider, and the README does
not mention the variable at all.

So an install that starts empty is correct, and an install that starts empty WITHOUT SAYING WHAT TO
DO NEXT is a separate failure this record does not licence.
[[0115-the-public-release-comes-before-the-playback-half]] is where that is closed. Nothing in the
refusal above softens: no seed data travels to a stranger, and the fix is words on a page rather
than rows in a database.

## As built, under CNCORE-65

**THIS RECORD IS STILL `proposed`, AND THE REASON IS THE WORD "INSTALL".** Its own subject is what
travels to a stranger, and there is no install path yet — no image and no documented command
(CNCORE-63, CNCORE-64). A record about what somebody else's instance starts with cannot be accepted
while nobody else can start one.

What DID land is the first evidence for it. `apps/web/e2e/front-page.test.ts` stands up the same
build a second time against a database built from empty, with `PROVIDER_ALLOWLIST` unset, and asks
it for `/`. Until then "a fresh install starts empty" was a property nothing exercised: every suite
in the repo ran against a seeded database, which is the one state this record does not govern.

**And the half this record explicitly does not licence is now closed.** The section above ends "an
install that starts empty WITHOUT SAYING WHAT TO DO NEXT is a separate failure", and points at
[[0115-the-public-release-comes-before-the-playback-half]]. CNCORE-65 is where that was done: the
empty catalogue names the two steps that fill it, and an instance with nothing allowlisted says so
rather than leaving an empty result to read as breakage. Nothing in the refusal softened — the fix
is words on a page, and no seed data travels anywhere.

**The third state the page reports was not in this record and is worth naming**: an allowlist that
names nothing is not the same fact as a catalogue that holds nothing, and an owner can be in either
without the other. The page reads them as two conditions off two facts rather than as one
"unconfigured" state, because an owner with items and no allowlist is stuck in a way an empty
catalogue does not describe.
