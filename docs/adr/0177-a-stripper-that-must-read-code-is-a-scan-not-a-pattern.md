---
status: accepted
---

# A stripper that must read code is a scan, not a pattern

Four suites in `packages/config` read source as TEXT, and every one of them took the comments out
first with `source.replace(/\/\*[\s\S]*?\*\//g, " ")`. A regular expression cannot tell a string
literal from code, so ANY `/*` opened a comment and swallowed source to the next `*/`. All four held
the same defect because all four held the same expression.

**THE STRIPPING IS NOW ONE SCAN, `testing/without-comments.ts`, and the four copies are gone.**

## The defect was live, not merely reachable

CNCORE-300 filed the reachable half: `"**/*"` is a glob this tree really writes, and
`apps/web/browser/gate.ts` passes one to `context.route`. Those three lines strip to `const GLOB = "** `,
the import between them gone entirely.

**The half nobody had noticed was already firing.** The block pass runs BEFORE the line pass, so a
`/*` written inside a `//` comment opens a block comment too. `testing/workspace.ts` says "Only the
`<name>/*` shape this repo uses" in a line comment, and that `/*` swallowed the fourteen lines to the
end of the next docblock -- `export function isWorkspacePattern` among them.

Measured over the 178 tracked non-test sources on 2026-09-21, by running the expression and comparing
the statements found before and after: **zero imports lost, one export lost.** The loud failure was
absent and the silent one was not, which is the order [[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]]
would predict. A swallowed import is a red on correct code; a swallowed `export` list means the names
are never collected, so nothing can report them dead -- the one answer `ui-callers.test.ts`'s own
docblock says it must never give.

## Why this is [[0171-the-fold-is-of-the-read-not-of-the-question-it-answers]]'s seam and not a new one

That record folds the MECHANISM and leaves the QUESTION with the caller, and it listed comment
stripping among the things the callers kept. **That entry is corrected by this record rather than
overturned**, because the reason it gave has run out rather than been disagreed with.

The two rules the five readers disagreed about were not two questions. They were two ways of being
wrong, each forced on its author by the instrument:

* `turbo-cache-inputs.test.ts` stripped a `//` only AFTER WHITESPACE, because a protocol-relative
  `"//fonts.googleapis.com"` has a quote before it and the version without that guard ate a real
  climb sitting after it.
* `prefetch-condition.test.ts` and `tree-figures.ts` stripped a `//` only AT A LINE START, and so
  kept every trailing comment in a count whose whole purpose is to not read prose.

**A scan does not have to choose.** It knows the first is inside a string and the second is a
comment, so both rules dissolve rather than being decided between. That is the test ADR-0171 sets for
whether a seam is in the right place -- what the callers did NOT want the same -- and here the
disagreement turned out to belong to the regex, not to the callers.

**The behaviour change this carried was measured before it was taken.** Moving the two line-start
callers onto the scan means trailing comments are now stripped for them. Over the 60 files those two
read, on 2026-09-21: zero `<Link` presences moved, zero `prefetch=` presences moved, and zero
`redirect(` counts moved. It is a no-op today and correct tomorrow.

## TypeScript's own scanner was measured and refused

The obvious objection is that a hand-written scan is a tokenizer nobody asked for, when `typescript`
is already a devDependency of this package. It was tried, and the reasons it is not used are
measurements rather than taste.

**TypeScript 7.0.2 does not publish `createScanner` from the package root.** That root export is
`lib/version.cjs`. The scanner is at `typescript/unstable/ast/scanner`, a subpath whose own name says
what it promises, and its signature is `createScanner(skipTrivia, languageVariant?, ...)` rather than
the `createScanner(languageVersion, skipTrivia, ...)` that older memory supplies.

**Driven the obvious way it does not terminate on this repository.** A plain `scan()` loop to
`EndOfFile`, blanking `SingleLineCommentTrivia` and `MultiLineCommentTrivia`, runs away on **6 of the
178 files**, emitting an unbounded stream of zero-width `PrivateIdentifier` tokens: `apps/web/e2e/global-setup.ts`,
`apps/web/src/app/items/[id]/page.tsx`, `apps/web/src/app/items/actions.ts`,
`apps/web/src/components/listing.tsx`, `packages/config/src/testing/tree-figures.ts` and
`packages/db/src/import-runs.ts`, each passing 2,000,000 tokens without reaching the end. Reducing it
to a minimal source did NOT reproduce it -- a docblock holding `` `#` `` scans and terminates in
thirteen tokens -- so the trigger is stated as a population measurement and not as a mechanism this
record claims to have isolated.

Driving it correctly means supplying the error handling the parser supplies, or parsing outright.
That is more machinery than taking comments out of a file deserves, against an API the package marks
unstable. **The sixty lines that do it here have no dependency, and the population they read passes
through them in the time the suite already took.**

## What it does not read, stated rather than left to be found

**A REGEX LITERAL IS NOT TRACKED.** A `/*` inside one -- `/https:\/*\//` -- would still open a
comment. Telling a regex literal from division needs the parse this deliberately does not do, none of
the four copies tracked one either, and this tree contains none: measured 2026-09-21 with
`git grep -nE '/[^/*\n]([^/\n]|\\/)*\\/\*'` over the same population, whose only hit is a sentence in
a docblock.

**JSX TEXT IS READ AS CODE**, so a `//` in rendered text would be taken for a comment. This is
unchanged from all four copies, and the shared scan is now the one place a refusal could go.

**AN UNTERMINATED `/*` IS BLANKED TO THE END OF THE FILE**, where the regex left it standing for want
of a closing delimiter. Either is arbitrary: a source with an unterminated block comment does not
compile, so no caller reads one. It is named because it is the only case where the two disagree on
input that is not a literal.

**A COMMENT IS BLANKED, NOT REMOVED** -- one space per character, newlines kept. Two callers sweep
with `^[ \t]*import\b` and `^[ \t]*export\b`, and collapsing a multi-line comment to a single space
joined the line before it to the line after, taking the second statement's anchor with it. Keeping the
shape can only ever find more of them.

## As built, under CNCORE-300

**BUILT: one scan, four callers, no copies.** `git grep 'replace(/\/\*'` over `*.ts` and `*.tsx`
returns nothing. `packages/config` runs 31 files and 282 tests green, the same count as before the
change, and `tsc --noEmit` is clean.

**BUILT: seven rows, each proved non-hollow.** Under
[[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]] every row was run against three
mutations -- the two regex rules it replaces and a body returning its argument unchanged -- and each
row is red on at least one. One row was HOLLOW when first written: `"//fonts.googleapis.com"` with the
`//` hard against the quote passes the whitespace rule by accident, and the row was changed to put a
space before the `//` rather than kept.

**NOT BUILT: nothing stops a fifth copy.** No check refuses a comment-stripping regex in a new file;
this is a rule a reviewer applies, which is the same missing half ADR-0168 names for itself.

**NOT RUN: the suites that need a database.** `@canoncore/db`, `@canoncore/api`, `@canoncore/tasks`
and one `apps/web` suite abort on an unset `DATABASE_URL` in a worktree provisioned only with
`.env.example`. None of them can reach this module -- it is package-private to `@canoncore/config`
and absent from that package's `exports` -- and the abort is unprovisioned rather than red.
