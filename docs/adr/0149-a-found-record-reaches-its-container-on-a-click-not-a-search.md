---
status: accepted
---

# A found record reaches its Container on a click, not on the search

> **ACCEPTED 2026-09-19, whole, in one repository.** `provider.containerOf` answers the Container
> one record names, `/import` renders it at `?provider=&record=` — and, since CNCORE-239, at
> `?q=&group=&provider=&record=`, the search riding along unasked so the way back needs no second
> fan-out ([[0151-a-query-beside-a-record-is-a-road-back-not-a-question]]) — and both halves are
> asserted — at
> [[0103-tests-bite-at-package-exports-and-the-router]]'s second seam
> (`packages/api/src/routers/provider.test.ts`) and its fourth (`apps/web/e2e/import-page.test.ts`).
> No provider repository is touched: `provider-tmdb` and `provider-wiki` already send what this
> reads. **CORRECTED 2026-09-21 (CNCORE-264): there WAS a cross-repo pair here, one path over.**
> `collectionPartToRecord` is a browse mapper and it hardcoded `series_id: null`, so a record reached
> by BROWSING a collection could not reach its Container -- the same dead end this record exists to
> close, on the path it did not look at. `provider-tmdb#29` fills it. The mechanism THIS record
> decided is unchanged and still whole; what was wrong was the sentence below, which read the three
> mappers it checked as though they were all of them.

Spec CNCORE-159's story 61 is "reach a Container from a record I found by searching". Until this it
was unmet for TMDB, and the reason is a fact about the source rather than a gap in the app: **a CMPP
search cannot carry a Container.**

`provider-tmdb`'s `searchResultToRecord` hardcodes `series_id: null` (`src/records.ts:119`, read at
`46a1189`), because TMDB's multi-search carries no collection and filling one would cost **a request
per result**. **THE RULE IS ABOUT WHAT A RECORD SITS IN, NOT ABOUT WHICH OPERATION PRODUCED IT**, and
the first draft of this sentence -- "its `lookup` and `browse` paths do fill it" -- got that wrong by
naming operations. A record that SITS IN a Container carries `series_id` on a lookup and a browse and
never on a search; a record that IS one carries none. So `seriesToRecord` and `collectionToRecord`
answering null is correct rather than the same defect, they being Containers themselves -- while
`collectionPartToRecord`, a browse mapper serving records that DO sit in one, answered null until
`provider-tmdb#29` and was a real defect (CNCORE-264). MEASURED AGAINST THE
RUNNING IMAGE on 2026-09-19, not recalled: `/search?q=The Matrix` answers `movie:603` with
`"series_id":null`, and `/lookup/movie%3A603` answers the same record with
`"series_id":"collection:2344"`.

So the id exists, and it is one lookup away from every candidate on the page — and the whole design
question is **who pays for that lookup, and when.**

## The rule

**A read whose cost scales with the RESULTS is taken on a click; a read whose cost scales with the
PROVIDERS may be taken on the search.**

A search asks each configured Provider once and fans out in parallel, so its cost is a function of
the Owner's configuration — bounded, known, and paid once. Resolving a Container per candidate is a
function of what the query MATCHED, which the Owner does not choose and cannot see in advance. Twenty
results is twenty requests at a third party for a page nobody has read yet.

So the lookup is deferred to the one record the Owner points at. **A search still costs one request
per Provider, however many candidates come back**, and reaching a Container costs exactly one lookup,
spent on purpose.

## The control is a form, and that is the mechanism rather than a style choice

**Next prefetches a `<Link>`'s own address when it enters the viewport.** **THAT PREFETCH SPENDS
NOTHING HERE, AND THE SENTENCE THIS REPLACES SAID IT SPENT A REQUEST PER CANDIDATE "because a reader
scrolled past"** — measured on a production instance on 2026-09-20 and false:
[[0161-a-prefetch-of-these-surfaces-renders-nothing]] carries the figures. A dynamic route's
prefetch is skipped, this page is dynamic, and what comes back renders no candidate and asks no
Provider.

**THE CONTROL IS STILL A FORM, AND THE ARGUMENT IS NOW THE OTHER ONE IN THIS SECTION.** A cost that
is absent by CONFIGURATION is one a `prefetch={true}`, a `loading.tsx` above the read or Partial
Prefetching each restore, and the address that resolves a Container would run the lookup the moment
any of the three landed. A control whose correctness turns on three settings nobody is thinking
about is not a control this record wants, so the rule above is kept by the shape of the control
rather than by the framework's current default.

A string-action `<Form>` prefetches its ACTION PATH instead, its fields not being known until
submission — here `/import` naming no record and looking nothing up. `PurgeBox` on the same page
already takes this measure for the same reason, one operation over; this is that argument with a
third party's time in place of the database's write locks.

**IT IS ASSERTED AS A STRUCTURAL FACT RATHER THAN A COUNT**, at the fourth seam: the searched page is
held to contain no `record=` anywhere in it. **AND THE SAME SEAM NOW READS THE PAGE THAT CLICK
REACHES for a prefetchable `q`**, which is where CNCORE-239 found this rule leaking through the
GROUP PICKER rather than through any control: a notice rendered on `q` being present, whose links
are ordinary `<Link>`s. A seam that watches one component cannot see a cost arriving through
another ([[0151-a-query-beside-a-record-is-a-road-back-not-a-question]]).

What a lookup COSTS is asserted a layer down, where a stub records the paths it was asked for; in CI
the fourth seam runs against the real `provider-tmdb` image, which records nothing and cannot be
made to. The prefetchable address is the thing that would spend it, and that the seam can see.

## It answers an id, and the preview stays where it was

`provider.containerOf` answers the `series_id` a browse takes. It does **not** browse, and the page
does not chain one: the way onward is a link to `?provider=&container=`, **the same address a
Container picked from `provider.containers` reaches**.

That keeps the expensive half — the preview of what a browse would write — as ONE procedure behind
ONE door, rather than reimplemented on this road to it.
[[0131-an-outbound-read-that-costs-a-browse-is-the-owners]] gates that door and is untouched here.

**A REDIRECT WAS NOT AN OPTION, AND THE REASON IS ALREADY RECORDED.**
[[0109-deployment-is-a-shape-not-a-vendor]] rules out `redirect()` on this surface because Next does
not apply `basePath` to one. So the intermediate address is not a compromise between one click and
two: it is the only spelling available, and it earns its place by being the thing a visitor may read.

## Applying ADR-0131's rule rather than copying its conclusion

[[0131-an-outbound-read-that-costs-a-browse-is-the-owners]] put `provider.container` behind the Owner
and said in terms that the test for the next read is **what it SPENDS**, with the line drawn at
[[0130-a-providers-cap-is-per-kind-of-question]]'s `patient` cap: `browse` is the only operation on
it. A `lookup` is `brief`.

So `provider.containerOf` is an **`openProcedure`**, which is `provider.search`'s case rather than
`provider.container`'s: the same ten-second ceiling, one record rather than a whole Container's
ordering, and — asking the manifest first and serially as every procedure here does — a worst case of
**20s (10 + 10)** against that procedure's 70. A visitor to
[[0044-one-owner-row]]'s demo follows a record to the Container it names exactly as they search for
the record; what they meet at the other end is the preview, which is still the Owner's and says so
there.

**THIS WIDENS NOTHING.** The one read on `/import` that spends a `patient` cap is still shut.

## A Provider that names no Container says so

`provider-wiki` sends no `series_id` at all — a story sits in many timelines at once, and no one of
them is THE Container. That is the ordinary answer there rather than an exceptional one, so it is an
ANSWER in the union (`no-container`) rather than a failure, and the page prints a sentence with **no
link in it**. A way onward that leads to a preview of nothing is worse than no way onward.

It is kept distinct from `no-such-record` — the Provider holding nothing at that id, which
[[0066-path-is-identity-query-is-the-route]] makes an answer too — because the two
have different remedies and an Owner told the wrong one goes looking for the wrong fix.

**NO `lookup-not-offered` ARM EXISTS, AND THAT IS CMPP RATHER THAN AN OMISSION.** `CONTEXT.md` makes
`lookup` required of every Provider and
[[0033-search-lookup-required-browse-optional]] makes `browse` the one a Provider may decline — so
the arm `provider.container` needs has nothing to stand for here, and inventing one would describe a
Provider the contract does not permit.

## What review taught: `null` is not the only spelling of absent

`cmppRecord` holds `series_id` and `series` to `z.string().nullable()` with **no `.min(1)`**, so
`""` is a WELL-FORMED CMPP answer. It parses clean, passes a `=== null` guard, and lands on this
procedure's output schema, which demands `.min(1)`.

**AND THAT FAILS OUTSIDE THE `try`**, because oRPC validates what the handler RETURNED rather than
what it did. So the one thing this union exists to prevent — a provider having a bad day taking
`/import` down with a 500 — was reachable by an empty string, through the arm meant to be the happy
one. Reproduced before it was fixed: `Output validation failed … expected string to have >=1
characters`.

An empty id **names no Container** ([[0066-path-is-identity-query-is-the-route]]: an
id that cannot BE an identity addresses nothing), and an empty name is **no name**, so it joins
`null` rather than meeting the same refusal one field over.

**THE GENERAL RULE, BECAUSE THIS WILL RECUR:** where a consumer schema is laxer than an output
schema, every field that crosses between them is a 500 waiting for a provider to send the empty
string. The guard is `!value`, not `value !== null`.

## What implementation taught: a wrapper loses whose sentence it is

`askingTheProvider` raises `ProviderFailed(reasonFor(error))`, which carries the reason as a VALUE and
leaves no `cause`. [[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]]'s `reasonFor` walks the `cause` chain
to find the innermost link that said something — so called on that wrapper it stops AT the wrapper,
finds no `OutboundRefused`, and **attributes CanonCore's own refusal to the Provider.**

Measured while building this: wrapped, ADR-0034's "169.254.169.254 is on no allowlisted CIDR"
sentence came back `wrote: "provider"`. A Provider was told to have written a sentence naming one of
our own ADRs.

The helper is for the two procedures that THROW a declared error. **A procedure that ANSWERS catches
the raw error**, as `provider.container` does. That is the rule to apply to the next one, and it is
the reason the union arms here are reached without it.
