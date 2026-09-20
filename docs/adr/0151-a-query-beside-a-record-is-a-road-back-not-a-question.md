---
status: accepted
---

# A query beside a record is a road back, not a question to ask

> **ACCEPTED 2026-09-20, whole, in one repository.** The control that reaches a record's Container
> carries `q` and `group`; `/import` renders the way back to those results and does NOT re-run the
> search to do it; and both halves are asserted at
> [[0103-tests-bite-at-package-exports-and-the-router]]'s fourth seam
> (`apps/web/e2e/import-page.test.ts`). No procedure changed, so nothing is owed at the second seam
> and no provider repository is touched.

[[0149-a-found-record-reaches-its-container-on-a-click-not-a-search]] built a road from a search
result to the Container its Provider names. The address it submits to carries `provider` and
`record` and nothing else, so arriving there **discarded the search that started the journey**: an
empty box, no results, and the browser's own Back the only way to them. Walked against the real
`provider-tmdb` image on 2026-09-19: twenty results for `The Matrix`, none of them on the page
after one click.

## It is a defect on THIS road, and the asymmetry is the argument

Picking a Container from `provider.containers` drops the search too, so the page is at least uniform
today. **That uniformity is not a reason to leave this, and it is not a reason to make the other
road lossy to match.** The two lose different kinds of thing.

The picker drops a list **the Owner did not compose**, which the page re-offers identically at an
address of its own: nothing of theirs is gone. This road drops **a query they typed and the Group
they narrowed it within** ([[0010-groups-scope-never-partition]] under CNCORE-182), and a
page of results that exists only because they composed it. Spec CNCORE-159's story 61 is "reach a
Container from a record I found by searching" — the road is DEFINED as starting at a search, so one
that discards its own starting point is unfinished rather than merely inconsistent.

Equal lossiness would be consistency bought with a downgrade, so the picker road is untouched here.

## The fan-out was never a consequence of the parameter

The reason this was not fixed inline in CNCORE-238 was a real one: carrying `q` through would make
the page RE-RUN the search, which is a Provider fan-out per click on a road built expressly to cost
ONE lookup. **But that cost came from a guard, not from the address.** `readImportPage` searched
whenever `q` was present:

```ts
query === undefined ? Promise.resolve(undefined) : call(appRouter.provider.search, …)
```

That line conflates two different facts — *a query is in the address* and *run a search* — and they
come apart cleanly. **`q` ALONE IS A QUESTION TO ASK. `q` BESIDE A `record` IS WHERE THE OWNER CAME
FROM.** So the page carries the query and does not ask it, and reaching a Container still costs
exactly one lookup and no second fan-out. ADR-0149's rule is untouched rather than traded against.

**A CACHE WAS THE OTHER CANDIDATE AND IS NOT NEEDED.** It is the heavier answer to a problem this
guard dissolves, and it would put a staleness decision nobody has ruled on onto the one surface
whose whole job is to report what a Provider holds NOW.

The return then costs one fan-out, spent at the moment the Owner asks for those results back. That
is what ADR-0149 PERMITS rather than what it refuses: its rule defers the cost that scales with the
RESULTS and allows the cost that scales with the PROVIDERS, taken on an ask.

## The way back is a form, which is ADR-0149's argument applied rather than its conclusion copied

ADR-0149 made the row's control a `<Form>` because **Next prefetches a `<Link>`'s own address when
it enters the viewport or is hovered** — verified against Next's own `<Link>` reference on the 16.3.5
this repo runs, where `prefetch` defaults to `auto` and only `false` disables both — and that
address spent a lookup at a third party.

The address BACK carries `q`, so it spends a **whole search**: a fan-out to every Provider in scope.
A link there would run it for a reader who merely scrolled to the foot of the answer. A
string-action `<Form>` prefetches its ACTION PATH, which is `/import` carrying no query and asking
nobody. Same measure, same reason, one operation over.

## What the test taught: the notices carried the fan-out, not the control

Carrying `q` turned the Group picker back on, because it rendered on `query !== undefined`. **Its
links carry `q`, and they are ordinary prefetchable `<Link>`s** — so the page reached by one click
held three addresses Next would run a search for on scroll. The control was a form and the leak was
beside it.

Caught by the assertion that reads the WHOLE page for a prefetchable `q` rather than reading the
control, which is the shape ADR-0149 chose for the same reason and the reason to keep choosing it:
a seam that watches one component cannot see a cost that arrives through another.

So everything scoped to a search now keys off **a search having RUN** rather than off `q` being
present, through one value (`searched`) that pairs the results with the query that got them. Four
independent tests of the same fact were four that could drift apart.

## Where the search stops riding, and why that is a line rather than a gap

The query survives as far as the page that NAMES the Container. It is not carried onward to
`?provider=&container=`, and that is deliberate twice over.

That address is **the same one a Container picked from the list reaches** — ADR-0149 keeps it as one
procedure behind one door rather than two roads to two spellings of it — and differentiating it by
where the reader came from would undo that. And the way onward to it is a `<Link>` whose prefetch is
already the Owner's browse; hanging `q` on it would add a search fan-out to a prefetch, which is the
thing this record exists to refuse.

So the road from a search ends where the shared road begins.
