---
status: accepted
---

# A check answers at one granularity, and that is part of its claim

`packages/config/src/ui-callers.test.ts` holds every module in `packages/ui` to having a caller and
it was green, on a package where fifteen exported names had none. Eleven of them were in
`dropdown-menu.tsx`, whose four live exports are all imported by `mode-toggle.tsx` alone. The check
was not broken and it was not stale: it answered the question it asks, per MODULE, and a module
with one live export answers for all of them.

**SO THE RULE NOW HAS TWO RUNGS, AND THE FINER ONE IS THE INSTRUMENT.** A name `packages/ui`
publishes that nothing imports is deleted, the same way [[0138-a-primitive-earns-its-place-by-having-a-caller]]
deletes a module nothing imports, and `ui-callers.test.ts` carries both roll calls.

## What the granularity gap actually costs

It is not that the module check was too weak. It is that **A GREEN CHECK IS READ AS THE RULE BEING
KEPT, NOT AS THE QUESTION IT ASKED BEING ANSWERED.** `.claude/rules/frontend.md` points an agent at
`ui-callers.test.ts` and says a component nothing imports "goes red rather than sitting unread".
That sentence is true and a reader takes more from it than it says: that `packages/ui` contains what
this product renders with. It contained eleven submenu, radio-group and checkbox-item primitives for
a catalogue that has never rendered one.

**AND THE COARSER CHECK MADE THEM HARDER TO SEE, NOT EASIER.** Before CNCORE-161 a reader could open
`packages/ui` and find whole modules with no importer. After it, every module has one, so the
package LOOKS swept -- and the residue that survived is hidden behind the four exports that
answer for their module. A partial sweep leaves a tidier-looking tree than no sweep, which is why
the second rung was worth building rather than trusting a reader to re-derive.

## What this does not check, and it is the larger half

**EIGHT THINGS WERE FOUND WITH NO CONSUMER UNDER CNCORE-263 AND ONLY ONE CLASS OF THEM IS NOW
POLICED.** The rest were kept alive by a SENTENCE, and no check reads a sentence:

- `packages/api/src/routers/provider.ts` exported two functions, each with a docstring stating its
  own reason for being exported: "the end-to-end suite stands up a provider and imports through
  THIS", and "the end-to-end suite does a real browse through THIS". Both were false at HEAD. The
  suite calls `client.provider.import` and `client.provider.browse` -- the PROCEDURES those
  functions sit under -- so it exercised more than the sentence claimed, and the `export` served
  nobody. `package.json` published a `./routers/provider` subpath to carry them that nothing ever
  imported.
- `provider-wiki/src/archive.ts` exported three symbols "for the same reason `storyDabTermSql` is:
  `scripts/measure-images.ts` and `scripts/extract-fixture.ts` have to read the RULE THIS PROVIDER
  SHIPS". CNCORE-103 deleted both scripts with the 66GB archive they read. The reason outlived its
  consumers, and `storyDabTermSql` -- the symbol the sentence reasons by analogy FROM -- is the only
  one of the four that still has one.
- `provider-wiki/Dockerfile` opened "The image carries the fixture, BECAUSE CanonCore's CI runs this
  provider as a service container and stop condition 4's contract test calls it directly over HTTP."

**THE DOCKERFILE IS THE ONE WORTH SITTING WITH, BECAUSE BOTH OF ITS FACTS ARE TRUE AND ITS "BECAUSE"
IS NOT.** CanonCore's `ci.yml` really does run that image as a service container, and it really does
run `test:contract` against it over HTTP. What does not follow is the fixture. The image ships with
no credential, so `provider-wiki`'s own `ci.yml` asserts **503** for `/lookup/265`, `/search` and
`/browse/91997` -- the very ids `packages/contract/src/participants.ts` puts to it. It answered that
contract test without ever opening the fixture, by this repository's own assertion, while a build
stage, a 2,109,440-byte `COPY --from=build` and a `chmod 444` served a file `.dockerignore` had
already excluded every reader of. `README.md` has said "`fixture/wiki.duckdb` ... is no longer read
by any route" since CNCORE-103, so the repository stated the fact and the Dockerfile stated the
opposite as its reason for existing.

**A COMPOUND REASON FAILS DIFFERENTLY FROM A FALSE FACT.** Each clause here is checkable and each
one checks out; it is the LINKAGE that was never true. A reader verifying the sentence confirms the
service container, confirms the contract test, and stops -- having confirmed everything except the
word doing the work. That is why these are not caught by the instinct that catches a stale figure.

**NO MECHANISM IS BUILT FOR THIS AND NONE IS PROPOSED HERE.** The eight were found by a 688-file
scan, by hand. Naming that plainly is the point: a record that ended "and a check now covers it"
would be the same overclaim this one is about.

## Why the instrument stops at `packages/ui`

The dispatcher decided this on 2026-09-20, against extending the roll call to every package under
`packages/`.

`packages/ui` is where the defect was MEASURED, and it is the package the measurement is ABOUT: it
arrived as a registry's opening move rather than by anyone choosing its contents
([[0138-a-primitive-earns-its-place-by-having-a-caller]] on why it is not a library), so its surface
is a guess somebody else made. The other ten packages were written here, export by export, by people
who wanted each one. A roll call over them would be an instrument built on no evidence, which is the
speculative abstraction `CLAUDE.md` rules out -- and `packages/api`'s four dead `export` keywords
were deleted BY HAND under the same ticket, which is what that boundary means in practice.

**THE BOUNDARY IS NAMED IN THE CHECK ITSELF, not only here**, so the next reader meets the absence of
`packages/api` from the sweep as a decision rather than as an oversight.

## As built, under CNCORE-263

Fifteen names, in three modules that the module roll call reports as perfectly healthy and that stay
healthy afterwards: eleven from `dropdown-menu.tsx`, `CardAction` / `CardContent` / `CardFooter`,
and `EmptyMedia`.

**WHAT WENT WITH THEM IS THE PART A NAME-ONLY DELETION MISSES.** `emptyMediaVariants` and
`empty.tsx`'s whole `cva` / `VariantProps` import; `dropdown-menu.tsx`'s `lucide-react` and
`react` type imports, both of which served only deleted functions. `lucide-react` had no other
importer in the package, so it leaves `packages/ui`'s manifest the way `next-themes` did under
CNCORE-161 -- `apps/web` declares it for itself. It stays in `pnpm-workspace.yaml`, which
[[0101-the-catalogue-is-the-only-place-a-version-is-written]] makes the only place a version is
written, because `apps/web` still resolves it there.

**AND THREE TAILWIND SELECTORS WENT, WHICH IS THE SAME RULE ONE LAYER OUT.** `Card` carried
`has-data-[slot=card-footer]:pb-0` and its `data-[size=sm]` twin, and `CardHeader` carried
`has-data-[slot=card-action]:grid-cols-[1fr_auto]`. Nothing can set `data-slot="card-footer"` or
`data-slot="card-action"` once the components that set them are gone, so those are selectors that
can never match. They are not modules and not exports; they are the same defect wearing a third
shape, which is worth one sentence here rather than a fourth rung.

**THE CHECK REFUSES A FORM IT CANNOT READ**, which is the choice `theExportsResolver` beside it
already makes: `export default` and `export *` throw rather than being skipped, because a name
quietly not collected is a name nothing can ever report as dead. Every module in the package writes
one `export { ... }` list today, and a walk that knew only that form would go green on the first one
to write `export function` instead.

**A NAME IN A STRING IS NOT A CALLER, AND THE ADVERSARIAL CASE IS THE ROW THAT SAYS SO.** Parsing
the import CLAUSE defeats a bare `"CardTitle"` by construction. What it does not defeat is a whole
`import { CardTitle } from "@canoncore/ui/components/card"` written INSIDE a string literal, which
is still text this reads -- so the statement must begin a line, and the third row builds exactly
that string and requires it to count for nothing. The boundary that leaves: an import spelled at the
start of a line inside a template literal would be read as one. Nothing here does that, and a walk
that PARSED TypeScript rather than reading it is the instrument if one ever does.

## The corrections that travelled with it

**`packages/contract/src/contract.test.ts` CONTRADICTED ITSELF IN ONE FILE.** Its URL floor said
`provider-wiki` "clears it anyway through `browse`, which still reads its committed fixture;
CNCORE-102 moves that operation live too". Two hundred lines below, the `browse` row already says
that ticket landed and the operation answers 503. The witness that actually holds the floor up is
the stub that declines a credential, which the same comment names first.

**AND `provider-wiki`'s `ci.yml` CARRIED THE DOCKERFILE'S LINKAGE WORD FOR WORD**, which is
[[0153-a-figure-lives-in-one-place]]'s point arriving as a false reason rather than a stale number:
"The image carries the fixture and is what CanonCore's CI runs as a service container." One
sentence, one true half, in two files that nothing compares.
