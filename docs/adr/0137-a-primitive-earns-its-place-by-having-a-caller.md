---
status: accepted
---

# A primitive earns its place by having a caller

`packages/ui` holds what this product renders with, and nothing else. A module in it that no
caller reaches is deleted, and a check names it rather than a reader noticing.

**THIS REVERSES HALF OF [[0053-scaffold-once-then-own-the-output]], AND ONLY HALF.** That record
deleted a client-side data layer on the sentence "a data layer with no callers is scaffold however
well it works", then declined to apply it one directory over: `sonner.tsx` STAYED, on the argument
that it is a vendored primitive, that nine of seventeen primitives had no importer that day, and
that "deleting one because this slice stopped using it would be deleting the library a component at
a time." Its scaffold decision is untouched and still `accepted`. This is the other half.

## Why "deleting the library a component at a time" does not hold

It reads `packages/ui` as a library. It is not one: it is a private workspace package with one
consumer, published nowhere, versioned `0.0.0`, and it did not accumulate these modules by anyone
choosing them. They arrived in a registry's opening move.

**THE COST OF BEING WRONG IS ONE COMMAND.** A primitive deleted today and wanted tomorrow comes
back from `@shadcn` or `@shadcnblocks` the same way it first arrived, onto this project's tokens,
which `.claude/rules/frontend.md` already instructs. Nothing is lost that a reader cannot get back
in less time than it takes to establish that the copy in the tree was never used.

**AND THE COST OF KEEPING THEM IS PAID BY EVERY READER.** 61% of the package was unreachable --
891 of the 1,433 lines of TypeScript under `src/`, measured on 2026-09-13 -- so a reader asking
what this product renders with had no way to tell the 39% that answers from the 61% that does not.
An agent told to "read `packages/ui` first and import what exists" was being pointed at a chat
bubble, a message scroller and an attachment tile, in a catalogue.

**WHAT MADE THE ARGUMENT SAFE TO DROP IS [[0136-a-control-is-a-primitive-and-a-surfaces-words-sit-beside-its-pages]].**
ADR-0053 wrote that "what replaces it is added by the slice that needs it", and at the time that was
a prediction. `Select` is it, happening: this repository wrote the primitive it needed rather than
inheriting a guess, because the registry's version needed script this app does not ship. A package
that writes what it needs does not also have to hoard what it might.

## What holds it

`packages/config/src/ui-callers.test.ts`, a roll call in the shape `typecheck-wiring.test.ts` uses:
both sides derived, and the red driven rather than described.

**IT WALKS REACH TO A FIXED POINT, which is the rung a grep cannot reach.** `lib/utils.ts` has no
importer outside the package at all and is the most-used module in it -- eight components import
`cn`, and the app imports those. The inverse is what made the ten worth a check: `input-group.tsx`
imported `Button`, `Input` and `Textarea`, and `attachment.tsx` imported `Button`, so the dead
modules were keeping each other's dependencies alive. Only a module already reached passes reach on.

**A TEST IS NOT A CALLER.** A component whose one importer is its own suite is still a component
this product never renders, and it would answer the roll call with a file written to answer it.

**IT LIVES IN `packages/config` BECAUSE ITS SUBJECT IS THE WHOLE REPOSITORY** -- the files that
answer "what imports this" are everywhere except the package under test. That task is `cache: false`
already ([[0126-a-task-declares-the-files-it-reads-outside-its-package]]), so it cannot replay a
stale pass over a file it never read; beside `packages/ui` it would be cached against the one
directory that cannot answer the question.

**WHAT IT DOES NOT ANSWER:** whether the caller is itself reachable. A module imported only by a
component no route renders still counts as reached, because the walk starts at every tracked source
outside the package rather than at the router. It catches a module nothing imports. A subtree that
has quietly fallen off the product needs a different instrument, and none is built.

## The same rule, applied to something that is not a module

Two font families were declared in `apps/web/src/app/layout.tsx` per request and read by no
stylesheet: `--font-geist-sans` and `--font-geist-mono`, hung on `<body>` by the generator, while
`globals.css` resolves `--font-sans` to `"Inter Variable"` and names neither. Both were subsetted
into the build and declared in the sheet every page links, to be rendered in by nothing.

**THE OBVIOUS ASSERTION ABOUT THEM PASSED AGAINST THE RESIDUE IT WAS WRITTEN TO CATCH, and that is
the part worth recording.** `next/font` emitted a `<link rel="preload" as="font">` when this app was
scaffolded, so the first version of the check looked for one in the served head. Under Next 16.3.4's
Turbopack build it emits none: measured 2026-09-16 with both fonts still in the layout, the head
carried no `as="font"` at all and the check went green over two unread families. What it carries
instead is one `<link rel="stylesheet">`, with the `@font-face` rules inside it. So the assertion
FETCHES THAT SHEET, and requires it to declare no `@font-face` -- blunt on purpose, because this app
self-hosts no face: its `--font-sans` names a family it expects a reader to already have.

**A CHECK THAT AGREES WITH WHATEVER IT HAPPENS TO READ IS THE FAILURE MODE, not an absent check**,
which is the same shape [[0126-a-task-declares-the-files-it-reads-outside-its-package]] is about one
level down. The lesson generalises past fonts: an assertion written from what a framework USED to
emit is one that reports on the framework rather than on this product.

## As built, under CNCORE-161

Ten modules, 891 lines: `attachment`, `bubble`, `checkbox`, `input-group`, `marker`, `message`,
`message-scroller`, `skeleton`, `sonner` and `tooltip`. Nine remain, every one of them reached.

**THREE DEPENDENCIES WENT WITH THEM, AND TWO LEFT THE CATALOGUE.** `sonner` and `@shadcn/react` had
no other importer anywhere, so they are gone from `packages/ui`'s manifest AND from
`pnpm-workspace.yaml`, which [[0101-the-catalogue-is-the-only-place-a-version-is-written]] makes the
only place a version is written -- a package dropped from a manifest and left in the catalogue is
still a version this repo maintains, which is the correction that record already had to make once.
`next-themes` is the third and it leaves this package's manifest ONLY: `apps/web` declares it for
itself and renders the theme with it.

**`src/hooks/` IS STILL THERE, EMPTY BUT FOR A `.gitkeep`**, with an `exports` entry publishing
nothing. It is not a module and has no lines to count, so it sits outside this record's rule and
outside CNCORE-161's criteria. Left rather than taken, and written down rather than left to be
found.
