---
status: accepted
---

# A repeated Container id refuses the list rather than being deduped

> **ACCEPTED 2026-09-20, whole, in one repository.** `beginImportRun` refuses a list naming an id
> twice, by name and position, before any row is written; the run row and its Containers are one
> transaction; the write is narrowed so what the Owner's list can provoke reaches them as
> `BAD_REQUEST` rather than a 500; and both halves are asserted at
> [[0103-tests-bite-at-package-exports-and-the-router]]'s first two seams
> (`packages/db/src/import-runs.test.ts`, `packages/api/src/routers/provider.test.ts`). No provider
> repository is touched, so nothing is owed at a second one.

A Container id appearing twice in an import list failed the **entire** import. Not the duplicate:
all 465. `import_run_containers_named_once` refused the INSERT, SQLSTATE 23505 escaped as a
`DrizzleQueryError` -- which is not an `ORPCError`, so the mount logged it as a fault and oRPC
answered 500 -- and the `import_runs` row survived a write that landed none of its members, because
the two statements had no transaction around them. Reproduced end to end on 2026-09-20 against a
throwaway database: `containers=0` beside a live run row.

The shape that broke it is the shape the feature was built for. `packages/api/scripts/import-list.ts`
documents its input as "a file of Container ids, one a line", so a hand-assembled 465-line list is
the intended way in, and nothing on the path looks for a repeat: `containerIds` is
`z.array(z.string().min(1)).min(1)`, and `theContainerIdsIn` trims blank lines and `#` comments only.

## The decision, and whose it was

**The list is refused. It is not deduped.** Taken by the dispatcher on 2026-09-20, from two options
this repository already argues both sides of.

Deduping has a real case here, and it is `putItemInGroupByHand`: that write MEETS its unique
constraint rather than raising on it, because "the Owner asking for something already true has not
made a mistake, and a surface that offers an Item and a Group cannot know what the last tab did".
Naming a Container twice does mean the same thing as naming it once, so the same reading was
available.

What separates the two is **who composed the input**. A Group membership is asserted by a button,
and a button pressed twice across two tabs is the claim already standing. An import list is a
**document the Owner authored**, and an id on it twice is a typo. Migration 18 wrote that reading
down before either was built: a repeat "would give the run two answers for one Container with
nothing to say which is current". `placements.ts` takes the same side for the same reason, treating
its own 23505 as a refusal because a Repeat at one Position is something [[0009-multi-parent-membership-with-ordering]]
does not licence.

The Owner is told **which id and where it sits**, counted from one, because the case this exists for
is 465 hand-assembled lines and "an id is repeated" is not something a reader can act on. Only the
first repeat is reported: naming every one would ask the Owner to read a list in order to fix a
list, and the next attempt names the next.

**Those are positions in the LIST, not lines of the file**, and the distinction is worth holding:
`theContainerIdsIn` drops blank lines and `#` comments before an id reaches the run, so position 12
of a commented list is some later line of the file. The sentence therefore names the **id** first,
which is what the Owner can search their own file for; the positions say how many there are and
which two, not where to put the cursor.

### What deduping would have cost, said out loud

It is not free, and the cost is not obvious. `theRunStillWalkingThisList` resumes a run by matching
the handed-over list against the stored one, exactly and in order, so a dedupe applied at the insert
alone would leave every re-run of the same file matching nothing and opening a **second run over all
465** -- browsing every Container again, silently, and asking a third party for all of it a second
time. That is precisely the
failure `theContainerIdsIn` was extracted and tested to prevent. A dedupe would also have to travel
to `scripts/import-list.ts`, whose `[n/465]` counter divides by the raw list length.

## Refusing does not make the index redundant

The check and the index are not two copies of one rule. `beginImportRun` reads the list and refuses
a repeat by name; the index holds the invariant behind it. **The whole lesson of this defect is that
a constraint nobody thought reachable was reached by the ordinary case**, so the write is narrowed
rather than left to escape: 23505 as a backstop, and 54000 because
`import_run_containers_named_once` is a btree and a btree cannot index a value over 2704 bytes --
measured at "index row size 3872 exceeds btree version 4 maximum 2704" on 2026-09-20. Nothing bounded
an id's length on the way in when this record was taken, so an ordinary list reached that one.
**CNCORE-268 has since bounded it at the router**, at 255 characters, so 54000 is now a backstop
rather than a path an import list can walk: see
[[0160-a-container-id-is-bounded-where-the-list-arrives]], which also says why the ceiling went
there rather than into `beginImportRun` beside this record's own check.

Which SQLSTATEs mean "you asked for something impossible" lives in `import-runs.ts` beside the write
rather than in the router, which is the rule `by-hand.ts` and `groups.ts` each record about their
own: it is a fact about the schema, and the schema is that package's.

## A refusal's sentence does not cross the wire by itself

Worth writing down, because it cost this record a review round and it will cost the next one.
`errors.BAD_REQUEST({ cause })` is the shape `item.create` and `group.put` use, and it **drops the
sentence**: `ORPCError.toJSON` serialises `{defined, code, status, message, data}` and nothing else,
so the `cause` never leaves the server and the caller reads the sentence DECLARED on the procedure
-- which, being declared once, can name no id.

**`placement.place` WAS THE THIRD NAME IN THAT SENTENCE, AND CNCORE-255 TOOK IT OUT OF THE LIST.**
It had the defect this paragraph predicts: its declared sentence named two of the four causes that
reach it, and `placement.move`'s named one of five, so a move refused for naming a placement outside
its destination was answered with a sentence about cycles -- wrong rather than merely vague. Both
now pass `message`. The two that remain are not defects: `item.create` names both members of
`by-hand.ts`'s set and `group.put` the one member of `groups.ts`'s, so nothing is lost by declaring
those sentences once.

A refusal whose whole value is naming the id has to pass `message` explicitly, as
`settings.ts` already does for `OutboundRefused`:

```ts
throw errors.BAD_REQUEST({ message: cause.message, cause });
```

The cause still travels for the server's own chain. **A test asserting `error.code` alone passes on
the broken version**, which is how this nearly shipped half-built: the code was right and the words
were gone. The router test asserts the sentence itself.

## Migration 18 could not be corrected, so rung 22 carries the correction

Migration 18 frames the index as saving a browse already paid for -- "43.8s spent asking a Provider a question
it has already answered". An index does not skip a browse. What saves the browse is the refusal
above, reading the list before anything is asked for.

That sentence cannot be edited. `checkAppliedRungsAreFrozen` hashes every applied rung against the
file on disk ([[0047-migrations-are-a-forward-only-ladder]]), so changing migration 18 fails
`pnpm db:check-ladder` on every database that has already run it, the Owner's own install included.
**The fix for a frozen rung is a new rung**, so migration 22 carries the corrected sentence as a
`COMMENT ON INDEX`, which puts it ON the object a reader is looking at rather than in a file beside
it. `packages/db/src/schema/tables.ts` carries the same correction for the reader of the schema.

This is the first `COMMENT ON` in this ladder. It is worth naming as a precedent rather than
leaving it to be discovered: a correction to a frozen rung has somewhere to go now.
