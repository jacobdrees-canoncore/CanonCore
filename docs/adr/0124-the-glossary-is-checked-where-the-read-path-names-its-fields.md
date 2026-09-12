---
status: proposed
---

# The glossary is checked where the read path names its fields

`CLAUDE.md` declares `CONTEXT.md` "binding on names in code, UI copy and ticket titles alike", and
every `_Avoid_` list in it names words that must not stand for the term above them. **Nothing read
those lists.** CNCORE-67 made **Member** a first-class name on the read path — `memberPublic`, a
`members` field, `MemberOfContainer` — a second noun beside Placement, which is the one thing those
lists exist to prevent, and it passed every check in the repository on its way in. CNCORE-91 fixed
that instance. This is the decision that it not recur.

**The `_Avoid_` lists are READ by a test rather than remembered by a reviewer.**
`packages/schemas/src/glossary.test.ts` parses them out of `CONTEXT.md` and fails when a name the
read path emits uses a word they reject.

It reads the glossary rather than restating it, for the reason
[[0045-the-public-read-path-names-every-field]] gives for reading a seeded label instead of mapping
it in the app: a list of banned words copied into a test is the same rule in a second language, and
it goes stale the day an entry gains a word.

## The scope is the read path's emitted names, and the limit is not timidity

The check covers the schemas `packages/schemas` exports and every field key underneath them — which
is ADR-0045's own subject, the fields the read path emits.

**IT CANNOT BE REPO-WIDE, and the reason is a licence rather than an effort estimate.** `CONTEXT.md`
grants the word `record` to A PROVIDER'S OWN EXTERNAL RECORD, and the CMPP contract uses it on that
grant — so a check over the whole repository would fail on day one against a use the glossary itself
permits. A check that has to be argued with is one that gets deleted. Scoping it to the payload is
what makes it sound rather than merely strict.

## An offence left standing carries a ticket and an EXACT-match allowance

Where the check catches a name a ticket is not fixing, the allowance lists that name and names the
ticket that owns it. It is asserted as an EXACT match rather than as a subset, and that is the half
that matters: the day the ticket renames one of them, the check fails until the name is DELETED from
the allowance. An allowance written as "offences ⊆ allowed" goes on passing over names that no longer
exist, and the next offence can be added to it without argument.

## As built, under CNCORE-91 — and this record stays PROPOSED

**BUILT: the payload is checked.** The check reads the live `CONTEXT.md`, its parser is tested against
fixtures rather than only exercised against the real file (the argument `docker-compose.test.ts`
makes about the same kind of check), and it carries an assertion that the real glossary yields more
than twenty words — so a renamed heading or a moved file fails loudly instead of passing while
guarding nothing. It caught `catalogueEntryPublic` and `cataloguePublic.entries` on its first run;
CNCORE-114 owns those.

**NOT BUILT: everything that names the read path without emitting it.** Three gaps, and they are the
half a reader would otherwise assume was covered:

- **Type aliases.** `PlacementInContainerPublic` is erased before the test runs, so only value
  exports and their keys are seen. This is arguably the right line rather than a gap — a type alias
  is emitted to nobody — but it means the convention that a type matches its schema is still a rule
  somebody remembers.
- **The db layer's own names.** `PlacementInContainer` and `findPlacementsInContainer` were renamed by
  hand under CNCORE-91 and nothing would catch them drifting back.
- **Output schemas declared inline in a router.** The provider router builds its `.output(...)`
  shapes inside the procedure rather than in `packages/schemas`, so its fields — `placements` on the
  dry run and on what a browse wrote, both renamed by hand under CNCORE-91 — are outside the check.
  Reaching them means going through oRPC's contract internals, which is why it was not done here.
