---
status: accepted
---

# An outbound read that costs a browse is the Owner's

> **ACCEPTED 2026-09-13, whole, in one repository.** `provider.container` is an `ownerProcedure`,
> `/import` renders the notice in its place, and both halves are asserted — at ADR-0103's second
> seam (`packages/api/src/routers/provider.test.ts`) and its fourth (`apps/web/e2e/import-page.test.ts`).
> No provider repository is touched, so there is no cross-repo pair here and nothing waiting on a
> second ticket.

`provider.container` answers "how many placements would this import?" by running the whole browse.
It is now behind the Owner. **The catalogue's own half of that question — `provider.held`, which
reads this instance's rows — stays open to anyone**, so what a visitor loses is a preview of a
button they were never offered, and not a single row of the catalogue.

ADR-0130 predicted this record and named the ticket that takes it: "It is the same case wearing the
wrong procedure builder, and CNCORE-154 is where it gets taken." This is that.

## The rule, stated so it can be applied to the next one

**A read is the Owner's when answering it spends a THIRD PARTY's time rather than this catalogue's
rows.** Reading the catalogue is open (ADR-0072); reaching out of it on an anonymous caller's say-so
is not, once what is reached costs real time.

That is deliberately not "every outbound read", and the boundary is a measured one rather than a
feeling. `packages/providers/src/client.ts` holds providers to two caps by kind of question
(ADR-0130), and **`browse` is the only operation on the 60-second `patient` cap.** `manifest`,
`search` and `lookup` are all `brief` — ten seconds — and ADR-0130 measured `search` against
tardis.wiki at **0.25s**.

## Which is why `provider.search` is still open, named here rather than left to be noticed

`provider.search` is an `openProcedure` that also reaches providers, and it fans out across every
one this instance is configured with. It stays open, for three reasons that hold together and would
stop holding if any one changed:

1. **It is capped at ten seconds, not sixty**, because it asks `search` rather than `browse`.
2. **It fans out in parallel**, so the wall time of a fan-out is the slowest provider rather than
   the sum — the cost does not scale with how many providers an owner has configured.
3. **It is the demo's discovery surface.** ADR-0044's public demo exists to be looked around, and a
   visitor who cannot search the providers cannot see what the product does at all.

**If `search` ever moves to the `patient` cap, this rule catches it and it moves behind the Owner
too.** That is the test to apply, and it is why the rule above is written about what a read SPENDS
rather than about which procedures happen to be open today.

## It is not CNCORE-109's rule, and conflating them would get the next one wrong

CNCORE-109 put everything that CHANGES the catalogue behind the session. `provider.container`
changes nothing: it writes no row, and `import-page.test.ts` has asserted since CNCORE-92 that
reading it imports nothing. So the two rules answer different questions, and a reader who remembers
only "writes are the Owner's" would have left this one open forever.

The shape this DOES match is `previewPurge`, one procedure over, and ADR-0130 spotted it first.
That is an `ownerProcedure` because, in `apps/web/src/app/import/page.tsx`'s own words, "the preview
IS the purge, run in a transaction it then rolls back, so it costs the work and the write locks of a
real delete". `provider.container` is that argument with a provider in place of the database: **the
preview IS the browse.**

## What the page does instead, because a gap is the worse answer

A visitor who names a container still gets the `container` section. What stands in it is `LogIn` —
the same notice every other control on that page is refused with (CNCORE-146) — naming the operation
they are not being offered, and linking `/login` where this instance has one.

**The catalogue's own answer survives beside it**, exactly as it survives the three provider refusals:
a visitor asking about a container this catalogue already holds is still pointed at the Item. That is
`provider.held`, it is open, and it was never the provider's to answer.

A blank section was the alternative and is refused for the reason `NoLogin` exists at the top of that
page: a reader who typed an id and got nothing back learns nothing about why, and goes looking for
what they did wrong.

## Evidence

- **The open read was six times more expensive after CNCORE-151.** That ticket raised `browse` from
  10s to 60s because the largest timeline on tardis.wiki needs 25.7s and could not be imported at
  all. The cap is right for the import; what was wrong is that a read anyone could call did the same
  work as the write behind it.
- **Concurrency roughly doubles it.** Measured against the live wiki 2026-09-13: one AHistory browse
  (`browse/249643`) is 25.5–26.4s across five runs; TWO at once take **49.1s each**. `provider-wiki`
  is one Node process. So a handful of concurrent anonymous requests was enough to slow every import
  on the instance.
- **Nothing rate-limited it.** ADR-0125 bounds password guessing by a rate, and is the nearest
  existing pattern, but its allowance is spent only by REFUSALS — where every call here is expensive
  whatever it answers, and one global counter would have throttled the Owner on the same procedure
  it throttled a stranger.
- **The cheap-preview alternative is recorded, not lost.** Asking a provider for a count rather than
  an ordering is a CMPP contract change: a new operation, ADR-0033 reopened, and a provider-repo PR.
  ADR-0130 already records paged orderings as the direction. This record does not close that off; it
  removes the reason it was urgent.
