---
status: accepted
---

# A provider's cap is per kind of question, and silence is capped separately

`packages/providers/src/client.ts` holds a provider to TWO limits with different jobs, where it
used to hold it to one number written twice:

- **How long it may take to START answering**, which scales with the size of the question. Ten
  seconds for `manifest`, `search` and `lookup`; sixty for `browse`.
- **How long it may go SILENT in the middle of answering**, which does not scale with anything.
  Ten seconds, for every operation.

## The one number was not a compromise, it was a category error

`TIMEOUT_MS = 10_000` was set on both `headersTimeout` and `bodyTimeout`, with the comment "a
provider that stops answering must not hold the import open forever". The reason is sound and it is
a sentence about a provider that has **stopped**. A provider still computing has not stopped, and
the two were being answered with one number.

undici had already drawn the line this record draws, and the names say so
(nodejs/undici, `docs/docs/api/Dispatcher.md` and `docs/docs/getting-started.md`, read 2026-09-13):
`headersTimeout` is the wait for response headers and `bodyTimeout` is the time **between
consecutive body chunks**. The second is an inactivity guard, not a total. Its own documented
example sets the two apart — `headersTimeout: 5_000, bodyTimeout: 30_000` — so splitting them is
undici's grain rather than a departure from it.

## What the sizes actually are

Measured against tardis.wiki through `provider-wiki` on 2026-09-13, time to FIRST BYTE, which is
where the whole cost sits:

| operation | page | answer | time to first byte |
| -- | -- | -- | -- |
| `manifest` | — | ~300 bytes | 0.02s |
| `search` | `q=Rose Tyler` | candidates | 0.25s |
| `browse` | 226288 Melanie Bush | 113 members | 1.9s |
| `browse` | 104797 Eleventh Doctor | 652 members | 8.9s |
| `browse` | 249643 **AHistory** | **2,913 members** | **25.7s** |

Three orders of magnitude between the smallest and the largest, and a single cap has to be wrong
for one end or the other. It was wrong for the large end: the biggest and most valuable ordering
the wiki holds could not be imported at all, and the Owner saw `Internal server error` over an
`UND_ERR_HEADERS_TIMEOUT`.

**THE TRANSFER IS NOT THE COST AND THAT IS WHY `bodyTimeout` DOES NOT MOVE.** All 1,340,208 bytes
of AHistory arrived within 5.7ms of its first byte. A provider sending a megabyte sends it in
chunks milliseconds apart, so a ten-second GAP is a provider that has stopped at any size.

**PAGE BYTES DO NOT PREDICT IT.** `Theory:Timeline - UNIT` is 99KB and answers in 0.4s because it
yields no members; the cost is member resolution, not parsing. So the thing that is large about a
large browse is its ANSWER, which is why the cap belongs to the operation rather than to a guess
about the page.

## Sixty seconds, and what eats it

2.3x the largest browse the source can be asked for, and a fifth of undici's own 300s default —
which the comment this replaces rightly called long enough to look like a hang.

**THE SINGLE-BROWSE FIGURE IS STABLE AND THE HEADROOM IS NOT.** Five clean runs of AHistory gave
25.5, 25.6, 25.9, 26.1 and 26.4s — under a second of spread. Two of them **at once took 49.1s
each**, measured the same afternoon: `provider-wiki` is one Node process and two large browses
roughly double each other. So the margin is 2.3x against one browse and 1.2x against two, and what
eats it is CONTENTION rather than page size. A third concurrent browse would not fit.

**THE ANSWER TO THAT IS NOT A BIGGER NUMBER.** It is a faster provider, or an ordering that arrives
in pages rather than whole — and the second is a CMPP question, because ADR-0033 makes `browse`
answer a container and its ordering together. Raising this constant buys a little headroom and
spends it on the paragraph below.

## The cap is also what an OPEN read can hold for

`provider.container` is an `openProcedure` — anyone who can reach the instance may call it, with no
login — and it answers "how many placements would this import?" by running the whole browse. So
this constant is also the longest a stranger's page render can sit before it says `unreachable`,
and raising it to buy concurrency headroom would spend that.

**THIS REPOSITORY HAS ALREADY DECIDED THE SHAPE OF THAT, ONE PROCEDURE OVER.** `previewPurge` is an
`ownerProcedure` because, in `apps/web/src/app/import/page.tsx`'s own words, "the preview IS the
purge, run in a transaction it then rolls back, so it costs the work and the write locks of a real
delete". `provider.container` is that argument exactly: the preview IS the browse, and it costs the
provider work of a real import. It is the same case wearing the wrong procedure builder, and
CNCORE-154 is where it gets taken — not here, because a shorter cap on that path would make the
preview report `unreachable` for containers that import perfectly well, which is a worse lie than
the cost it saves.

## The mechanism, and why it is four dispatchers

Patience is on the DISPATCHER because undici puts it there. `fetch`'s `RequestInit` has no
`headersTimeout`: measured against undici 8 on 2026-09-13, one passed per request is accepted in
silence and **ignored**, and the dispatcher's value is what fires. There is no per-call spelling to
reach for, so a cap that varies by operation means a dispatcher per class of operation.

That crosses ADR-0034's existing axis, which is not optional either — the config boundary may reach
an allowlisted address and the content boundary may not, ever, and one agent's lookup hook cannot
tell which hop it is on. Two boundaries by two patiences is four, and **patience follows the
operation across every hop**: a browse that redirects is still a browse, and the hop that finally
answers it is the one doing the thinking.

## What this costs a test, which is a fact about undici rather than about the design

undici's timeouts run on a coarse timer wheel, so a cap under a second does not fire under a
second. Measured against undici 8 on 2026-09-13: `headersTimeout` of 100, 150, 300, 500 and 900ms
**all fired at ~1.00s**, and 1,000ms fired at 1.50s — it rounds up to a 500ms tick and may add one
more. A suite proving that a browse outlives what a search dies at therefore cannot do it in
milliseconds; it costs ~2s, which is why `createProviderClient` takes the two caps as an override
that only that test passes. Production's ten and sixty seconds are far above the granularity and
unaffected.
