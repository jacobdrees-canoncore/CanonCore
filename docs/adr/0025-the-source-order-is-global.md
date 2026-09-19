---
status: accepted
---

# The source order is global; a group picks providers but never re-ranks them

A group chooses which providers are asked, which is what actually delivers "this group prefers the
wiki" — a group that never asks TMDB is never answered by TMDB. **That holds of what the group ASKS,
not of what the catalogue holds** (corrected under CNCORE-182, whose build found the gap): an Item
another group asked TMDB about carries TMDB's claim, and that claim ranks by this order in every group
the Item sits in, including one that never asks TMDB. The ranking among them is one order for the
whole instance.

Per-group ranking cannot answer the case it would create: an item in two groups whose orders
disagree has two answers for one field, on one page, reached by one URL.

Accepted cost, stated plainly: two providers cannot be ranked differently in two groups that both
ask both.

## As built, under CNCORE-4 — and this record stays PROPOSED

**BUILT: the global order.** `sources.source_order` is unique per owner, so
there is exactly one ranking for the instance and it cannot be expressed twice.
The owner is seeded into it at 0.

**NOT BUILT: the group half** (until CNCORE-182, at the end of this record). "A
group picks providers but never re-ranks them" needs groups, and groups are not a
table yet. The accepted cost this record
states -- two providers cannot be ranked differently in two groups that both ask
both -- is not yet payable, because groups do not exist.

(An earlier version of that sentence said "neither groups nor providers exist".
Providers do: a provider takes a `sources` row on its first import, and takes
the next place in this order rather than competing for one -- CNCORE-6 for
`lookup`, CNCORE-7 for `browse`. Groups are the half that is still missing, and
one of the two is enough to make the cost unpayable.)

## A second site applies this order, under CNCORE-5

`findPlacementsOfItem` decides which source speaks for a PLACEMENT by these same terms, in the same
sequence, so provenance on a placement and provenance on a field cannot disagree. The rule is
written twice, in SQL and in TypeScript, and holding the two identical is a stated obligation of
both -- see [[0017-placements-carry-sources-and-rank]].

## And it decides a second thing now, under CNCORE-7

The same three terms also settle WHICH OF TWO PLACEMENTS SPEAKS when two sources disagree about
position -- two rows, both standing, the winner first. That is not a new rule, it is this one
reaching the case [[0017-placements-carry-sources-and-rank]] was waiting for a second origin to
produce, and `browse` is that origin.

## The owner's place in the order gets a WRITER, under CNCORE-71

**BUILT: something that actually writes at `source_order` 0.** Migration 1 seeded
the owner into the order and, until this slice, nothing in the product ever wrote
a statement against that row -- the seed did, and the purge fixture did, and both
are harness rather than product. `createItemByHand` and `retitleItemByHand` are
the first writers, so "nothing the owner asserts is ever beaten by a provider" is
now a property a user can produce rather than one only a fixture could
demonstrate.

**AND IT IS WHAT MAKES THE ORDER'S POINT VISIBLE.** An owner retitling an imported
item outranks the provider with no rank set and no favourite chosen, because 0
comes first -- and the provider's claim STILL STANDS beside it, since a source may
only withdraw what it said itself. That pair is asserted at all three seams.

**THIS RECORD STAYS `proposed` FOR THE REASON IT ALREADY GAVE.** The group half is
still missing, groups are still not a table, and CNCORE-71 adds neither. (Groups
became a table under CNCORE-178 and the half landed under CNCORE-182, below.)

## The group half, under CNCORE-182 -- and this record is ACCEPTED

**BUILT: a group picks which providers are asked.** Migration 20 adds `group_providers`, one row per
provider a group asks, keyed by the provider's base URL because that is its identity
([[0031-a-provider-is-a-url]]) and a group may ask one this catalogue has never imported from. The
Owner chooses on `/groups`, one button per configured provider (`group.ask`, `group.stopAsking`), and
`provider.search` narrowed to a group asks only the providers that group asks, picked on `/import`
off the same picker the three Listings carry. Both halves of this record's mechanism now exist, so it
is `accepted`: the order is one for the instance, and a group chooses who is asked within it.

**THERE IS NO ORDER COLUMN, AND THAT ABSENCE IS THIS RECORD KEPT.** `group_providers` says which, never
how high. The narrowed search answers in the instance's configured order rather than the group's,
so even the order results are listed in is the same in every group.

**A GROUP NOBODY TOLD ANYTHING ASKS NOBODY.** This record's own sentence, read literally: a group that
never asks a provider cannot be answered by it. The other reading, every configured provider until
told otherwise, would make every new scope ask TMDB until the Owner thought to say not to. The page
says so in words, "asks no Provider", rather than "Nothing matched", which would be a claim about
providers nobody asked. Groups drawn before migration 20 are in this state after it.

**A GROUP PICKS AMONG THE CONFIGURED PROVIDERS AND NEVER ADDS TO THEM** ([[0121-an-instance-names-its-providers-beside-the-allowlist-that-admits-them]]).
`group.ask` refuses a URL settings does not name, because a group asking one would be a second,
hidden list of providers. A provider the Owner removes from settings stays in the group's rows and is
asked by nothing; naming it again resumes the group's choice. The fan-out only ever reaches the
intersection of the two.

**WHAT A GROUP DOES NOT DECIDE.** `import`, `browse` and `lookup` each address ONE provider the Owner
names, so there is no "which are asked" for a group to scope; the fan-out is the only operation that
chooses who to ask, and it is the only one narrowed. Enrichment, the other fan-out `CONTEXT.md`
names, does not exist yet; it asks about an ITEM, and an Item sits in many groups, so which group's
providers it asks is a question this record leaves to whatever builds it.

### The accepted cost, stated plainly rather than left implicit

This record's third paragraph states the cost, and building the half showed it is two costs, not one.
Both are asserted in `packages/api/src/routers/provider.test.ts`, under "the source order within a
Group", where the Catalogue is narrowed to each group in turn:

1. **Two providers cannot be ranked differently in two groups that both ask both.** There is no field
   in which to say so. An Owner who wants the wiki first for Doctor Who and TMDB first for Marvel,
   with both groups asking both, cannot have it.
2. **A group filters who is ASKED, not what is READ.** A provider's claim about an Item, once in the
   catalogue, speaks for that Item in every group it sits in, ranked by this one order, including a
   group that never asks that provider. The crossover is exactly where this bites: an Item in a group
   that asks the wiki and a group that asks only TMDB shows whichever of the two ranks first, in both.
   The alternative is to hide a claim by the group it is read through, and that is per-group ranking
   under another name: one Item, one field, two answers at one address.

Neither is worked around, and neither may be: each workaround is the thing this record refuses.

