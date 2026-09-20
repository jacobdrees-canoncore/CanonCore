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
this repo runs, where `prefetch` defaults to `auto` and only `false` disables both. **THAT VERSION
FACT IS CORRECT AND STANDS; WHAT FOLLOWED IT DID NOT.** This record said that address "spent a lookup
at a third party" and that a link carrying `q` "would run it for a reader who merely scrolled to the
foot of the answer". Measured on 2026-09-20, neither happens:
[[0161-a-prefetch-of-these-surfaces-renders-nothing]] has the figures. The prefetch of a dynamic
route is skipped, and every surface here is dynamic, so it renders nothing and asks nobody.

The address BACK carries `q`, so ASKED it costs a **whole search**: a fan-out to every Provider in
scope. **The form is still the right control for it, on the reason that survives the measurement**
rather than the one that did not: a `<Form>`'s fields are not known until submission, so its ACTION
PATH is all there is to prefetch — `/import` carrying no query — and that stays true under the
`prefetch={true}`, the `loading.tsx` or the Partial Prefetching that would each put a link's cost
back. Same measure, same reason, one operation over.

## What the test taught: the notices carried the fan-out, not the control

Carrying `q` turned the Group picker back on, because it rendered on `query !== undefined`. **Its
links carry `q`, and they are ordinary prefetchable `<Link>`s** — so the page reached by one click
held three addresses that ASK every Provider in scope, on a page nobody had asked a question from.
The sentence this replaces said Next would run a search for them "on scroll"; it would not
([[0161-a-prefetch-of-these-surfaces-renders-nothing]]), and the leak is the addresses being there
rather than the scroll reaching them. The control was a form and the leak was beside it.

Caught by the assertion that reads the WHOLE page for a prefetchable `q` rather than reading the
control, which is the shape ADR-0149 chose for the same reason and the reason to keep choosing it:
a seam that watches one component cannot see a cost that arrives through another.

So everything scoped to a search now keys off **a search having RUN** rather than off `q` being
present. TWO VALUES CARRY THAT, one per half, and naming only the second hides where the cost is
actually decided: `theQueryIsAsked` decides whether the fan-out RUNS at all, and `searched` -- which
pairs the results with the query that got them -- gates what the page RENDERS. Four independent
tests of the same fact were four that could drift apart.

## What review taught: a prefilled box is a second control, and it has to agree

Carrying the query makes the page's own search box **prefilled**, where before it was empty. That
turns it into a road the Owner has — type nothing, press Enter — and the first version of this change
left it carrying `q` and **no Group**, because the scope was resolved only where a search had run.
So the box re-ran the search UNSCOPED and landed on results the way back one section down would not.

`SearchBox`'s own comment had already forbidden exactly that, for CNCORE-182's reason: "a search from
it that quietly asked every Provider would contradict the page it was typed on." The rule was
written; what was new was a SECOND control spelling the same Group, and nothing making the two agree.

So the Group is resolved from `group.list` **whenever a query is on the address, asked or not**, and
both controls read it from one value. That is a read of this catalogue rather than of a Provider, so
it is not the cost this record defers — and it keeps `SearchBox`'s "ONLY A GROUP THAT IS THERE",
which also means **no unresolved id from the address is ever carried onward**.

**THE HELPER THAT ASSERTED THIS PASSED AGAINST THE WRONG FORM FIRST.** Three navigating forms on this
document carry a `q`: the site header's box, which submits to `/search` and carries the Group too;
the page's own; and the way back, whose `q` is hidden. A helper that took "the first form carrying a
`q`" matched the HEADER, and went green while the box it named carried nothing. It is found by the
label its input carries instead. A seam that identifies a control by its shape finds whichever
control happens to share that shape.

## Where the search stops riding, and why that is a line rather than a gap

The query survives as far as the page that NAMES the Container. It is not carried onward to
`?provider=&container=`, and that is deliberate twice over.

That address is **the same one a Container picked from the list reaches** — ADR-0149 keeps it as one
procedure behind one door rather than two roads to two spellings of it — and differentiating it by
where the reader came from would undo that. And the way onward to it is a `<Link>` to a page whose
own cost is the Owner's browse; hanging `q` on it would put a search fan-out on an address a reader
reaches by clicking, which is the thing this record exists to refuse. **THAT ADDRESS IS PREFETCHED NO
MORE THAN ANY OTHER HERE** ([[0161-a-prefetch-of-these-surfaces-renders-nothing]]): the sentence this
replaces said the fan-out would be added "to a prefetch", and the cost it names is spent on the
click rather than on the scroll.

So the road from a search ends where the shared road begins.
