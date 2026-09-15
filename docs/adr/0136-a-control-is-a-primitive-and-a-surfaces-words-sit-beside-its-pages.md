---
status: accepted
---

# A control is a primitive in `packages/ui`; a surface's words sit beside its pages

Two homes, and which one a repeated thing goes in is settled by WHAT VARIES rather than by how
many pages carry it.

**A CONTROL — the same element on every surface, varying only in layout — is a primitive in
`packages/ui`.** `Select` is the first one this repository wrote itself rather than vendored.

**A SURFACE'S WORDS — a notice, an empty state, a formatted value — live in
`apps/web/src/components`, with the varying part passed in.** `not-logged-in.tsx` was the first,
`no-provider-allowlisted.tsx` and `moment.tsx` are the second and third.

Nothing had said this. CNCORE-177 found three things written two or three times, every one of them
already drifted, and the three drifts are the argument.

## Why a control this app draws itself belongs in `packages/ui` at all

`.claude/rules/frontend.md` already says to read `packages/ui` first and import what exists. The
case it does not cover is the one that produced the drift: **the registry's version of a control
needs script and this app has none.**

Every form here is server-rendered markup a browser posts with no JavaScript — `/new`, `/import`,
the form that places an Item in a Container, Run and Cancel on `/tasks`, End on `/devices`. Base
UI's Select is a client component that has to hydrate before it opens, and `packages/ui`'s own
`Checkbox` is one for the same reason. So a select had to be the native element, and a native
element is a tag rather than a component: **there was nothing to import, and what each page needed
was not behaviour but IDENTITY.**

Three surfaces reached the same conclusion independently and each wrote the identity out by hand,
each with a docblock explaining that there was no select in `packages/ui` to inherit from. By the
time it was three, the third had lost `w-full` and `md:text-xs`: a control narrower than its
neighbour in a different type size, which is `.claude/rules/frontend.md`'s "reads as part of this
product" failing at the one place review had already caught it twice.

**THE DECISION IS THAT THE MISSING COMPONENT IS WRITTEN, NOT THAT THE TOKENS ARE COPIED CAREFULLY.**
A native element wearing this app's metrics IS a primitive, even though it wraps nothing, and the
next control in that position — a radio group, a date field, anything whose scripted version this
app cannot use — goes the same way rather than being the fourth thing matched by hand.

## Why the words do NOT go there

`packages/ui` holds things with no opinion about this product: a Card knows nothing about Providers.
A notice saying which of two settings refuses a Provider is the product talking, and it reads
`/settings` as a destination — so it sits in `apps/web/src/components` beside the pages that render
it, which is where `not-logged-in.tsx` already was.

**WHAT VARIES IS PASSED IN, AND IT IS ONE CLAUSE.** The front page's copy of the allowlist notice
and `/import`'s differed in one clause — "nothing can be imported yet" against "nothing here can be
searched or imported yet" — and in one whole sentence, which only one of them had. Two copies of a
paragraph are two places for a reader's answer to go missing from one of them, and nothing was
watching either: each copy rendered correctly on its own page, so no assertion about one page could
see it.

## What the third one taught, which is the general form

The moment was the sharpest case. `/devices`, `/settings` and `/tasks` each held a copy of the same
`Intl.DateTimeFormat` call, with docblocks citing each other — and `/tasks` had lost the `<time>`
element. **The words were right.** Nothing a reader saw was wrong, and what was missing was the only
thing telling a machine reading the page that the string was a moment at all.

So a copy does not have to be visibly wrong to be the failure: it drifts in whatever half nobody is
looking at. That is the reason for folding at THREE rather than waiting for a reader to complain,
and `Moment` puts the element and the sentence in one place so that a surface cannot take the second
without the first. The cost is that a sentence containing a moment becomes markup rather than a
string — `lastRunOf` on `/tasks` returns a `ReactNode` now — and that cost is the mechanism working.

## What holds it

The page seam, which is ADR-0103's fourth and its own test for where an assertion belongs: every one
of these is in the HTML the server returns, so `fetch` observes exactly what a browser would.

`e2e/select.test.ts` is the shape worth copying. It reads the rendered `class` of the select on all
three surfaces and compares them, because **the defect was invisible from any one page** — three
copies each internally consistent, wrong only against each other. `/new` passes nothing in, so what
it renders IS the control; `/items/<container>` must match it to the byte, and `/import` must carry
it whole while adding the `max-w-xs` its row needs. A surface may narrow a control. It may not lose
part of one.

`momentsIn` in `e2e/document.ts` does the same job for the second: the three surfaces that print a
moment each assert it is `<time>` with a parseable value, so the element cannot go missing from one
of them again without a named test saying so.
