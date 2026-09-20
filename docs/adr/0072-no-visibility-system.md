---
status: accepted
---

# There is no visibility system

> **ACCEPTED 2026-09-20, whole, in one repository.** Both halves hold. The ABSENCE is complete --
> no column, no propagation, no resolution rule -- and the positive half is ASSERTED rather than
> left to be assumed: `openProcedure` in `packages/api/src/index.ts` is where "a read asks for
> nothing" is written down as a decision carrying this record's name, and `routers/group.ts`,
> `routers/item.ts` and `routers/task.ts` are read on it. `packages/schemas/src/index.ts` and
> `packages/env/src/schema.ts` carry it at the contract, and
> `apps/web/src/components/not-logged-in.tsx` is what a visitor meets instead of a filtered page.
> `packages/api/src/routers/group.test.ts` and `apps/web/e2e/login-page.test.ts` hold the openness
> as a DECISION rather than an oversight. Nothing is owed in a provider repository: a provider is
> never told who is asking.
>
> **AND THE OPEN HALF IS THE NARROWED ONE**, stated here so this record cannot be read back as the
> wider claim it once made. [[0131-an-outbound-read-that-costs-a-browse-is-the-owners]] found "a
> read asks for nothing" too wide by one procedure: `provider.container` reads no row of this
> catalogue and is `ownerProcedure` anyway, because it spends this instance's standing at a third
> party, which this record never gave a visitor. What is open is reading THE CATALOGUE.

Not a column, not propagation, not a resolution rule.

"Inherit from which parent?" has no answer once an item is multi-placed, and multi-placement is the
product. A single-owner instance shows the owner everything; the demo shows visitors everything on
it.

Add it when multi-user arrives, which is when it first means anything.

## The absence, measured rather than assumed

A case-insensitive search for `visibilit`, `unlisted` and `is_public` across
`packages/db/src/schema/` and every rung of the ladder returns ONE hit, and it is about something
else: `tables.ts` calls an ADR-0049 task-run row "THE VISIBILITY", meaning a failure you can still
see in the morning rather than a rule about who may see it. So the sentence above is checked, and
this record's own three nouns are absent from the schema in the plainest way available.

## Why this is `accepted` now and not held for multi-user

The deferral clause is the reason a reader might expect `proposed`, so it is answered here. "Add it
when multi-user arrives" has NOT triggered -- [[0044-one-owner-row]] still ships one owner row, one
password and no signup -- and a record is `accepted` when its MECHANISM is whole rather than when
every future it mentions has arrived. The mechanism here is a refusal, and a refusal is whole when
nothing implements the thing refused and everything that would have consulted it instead asks
nothing. Both are true today.

ADR-0044 is the sibling refusal of exactly this shape -- "no multi-tenancy, no RLS, no database
roles" -- and it reads `accepted` while carrying its own later-migration clause. Holding this one
`proposed` for a clause that has not fired would be the two records disagreeing about what
`proposed` means.

**AND THE FALSE SIGNAL IS THE REASON THIS WAS WORTH FIXING.** `CLAUDE.md` reads `proposed` as
DECIDED BUT NOT YET IMPLEMENTED. Every file above cites this record; not one of them could tell from
it that the answer was settled rather than pending, so each was written against a record that looked
like an open question. That is the defect CNCORE-248 was raised on.
