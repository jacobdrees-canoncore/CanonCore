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

Measured over the 178 tracked non-test sources `main` held on 2026-09-21, by running the expression
and comparing the statements found before and after: **zero imports lost, one export lost.** (The
population is 179 with this branch's own new file in it; the figure is of the tree the defect was
measured in.) The loud failure was
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

**THE TRIGGER WAS ISOLATED AFTERWARDS, UNDER CNCORE-298, AND IT IS NOT A POPULATION FACT.** The
sentence above is corrected here rather than beside itself: a plain `scan()` never re-scans a `/`, so
a REGEX BODY is read as code, and the `#` in `tree-figures.ts`'s own
`/(^|\s)(#)[ \t]?/gm` is a stall in it. Where the body holds a BACKTICK instead -- and
`ui-callers.test.ts` writes three -- the scan enters a template literal that runs on until the next
backtick, which lands it inside a docblock, where a `#` in prose stalls it. That is why all six files
stall on `PrivateIdentifier` at a `#` that is plainly inside a comment, and why reducing it to a
docblock holding a `#` did NOT reproduce: a `#` in a comment is harmless until something has already
desynced the scan into it. Minimally, `const r = /(#)/;` stalls and
`/** prose `#1` */ const x = 1;` does not.

**NONE OF WHICH REOPENS THIS RECORD'S DECISION**, since driving the scanner correctly is exactly the
"error handling the parser supplies" named above: `reScanSlashToken` for a regex, `reScanTemplateToken`
for a template's `}`, and `scanJsxToken` for JSX text, none of which taking comments out of a file
should have to know about. `bounded-parameters.test.ts` pays that cost because it needs a token's
POSITION and not a stripped string, which
[[0178-a-parameter-a-page-speaks-is-reported-where-it-is-unbounded]] argues where it chooses the
scanner. The sixty lines here remain the right answer for this question.

## The first version of this scan shipped the same class of defect

**A HAND-WRITTEN SCAN THAT DOES NOT TRACK REGEX LITERALS IS STILL A THING THAT CANNOT TELL A LITERAL
FROM CODE.** The first version of this module declared regex literals an untracked boundary, on the
measured ground that no regex in this tree holds a `/*`. That measurement was true and the conclusion
drawn from it was wrong, because the hazard is not only `/*`. **A BACKTICK inside a regex literal
opens a TEMPLATE**, and `ui-callers.test.ts` writes `["'`]([^"'`\n]+)["'`]` -- three backticks, an odd
number -- so the scan entered a template at the first and never left.

Five tracked files stopped being stripped at the point of their first such regex:
`adr-identifiers.test.ts`, `corpus-figures.test.ts`, `sweep-shard-citations.test.ts`,
`ui-callers.test.ts` and `providers/src/boundary.test.ts`.
`turbo-cache-inputs.test.ts` sweeps `packages/*.ts` with NO test-file filter, so it read all five
unstripped, and **it stayed green** -- none of the surviving prose happened to hold a `"../`. A
silent under-strip, which is the same failure this record exists to end, reintroduced by the fix for
it and caught in review rather than by any of the seven hand-written rows.

**SO REGEX LITERALS ARE TRACKED, and the guard is a sweep rather than another row.** Every hand-written
row is a shape somebody thought of; the shape that bit was the one nobody did. The eighth and ninth
rows are the defect and a sweep over every tracked source asserting no docblock is left standing,
which is the row that would have caught it.

**AND THE SCAN REFUSES WHEN IT LOSES ITS PLACE.** A source that ends inside a template literal means a
backtick was taken for an opener it was not, and every comment below it has been kept. It throws
rather than returning that. Valid TypeScript always closes its templates, so this fires on a scan
that is wrong rather than on a file that is.

## What it does not read, stated rather than left to be found

**A `/` IS RESOLVED FROM THE SAFE SIDE, not parsed.** Telling a regex literal from division needs the
parse this deliberately does not do, so the preceding token decides: after `(`, `,`, `=`, `:`, `[`,
an operator or a keyword like `return`, a `/` opens a regex; after anything else -- an identifier,
`)`, `]`, a quote, and notably `<` in `</div>` -- it divides. **A WRONG GUESS COSTS AT MOST ONE LINE**,
because a regex literal cannot span one and a run that reaches a newline without closing is
abandoned. The scan never DELETES on a wrong guess; it only declines to strip, and the sweep row
asserts that it does not.

**JSX TEXT IS READ AS CODE, and this changes what two callers see.** A mid-line `//` in rendered text
is now taken for a comment, where the two line-start copies kept it -- the claim that this is
"unchanged from all four copies" was in an earlier draft of this record and is false. A new case
comes with the scan: an apostrophe in JSX text (`don't`) opens a string literal that runs to the end
of its line, so a comment later on that same line survives. Neither occurs in this tree today, and
both hits of a grep for the second are inside comments, where the scan consumes them first.

**AN UNTERMINATED `/*` IS BLANKED TO THE END OF THE FILE**, where the regex left it standing for want
of a closing delimiter. Either is arbitrary: a source with an unterminated block comment does not
compile, so no caller reads one.

**A COMMENT IS BLANKED, NOT REMOVED** -- one space per character, newlines kept. Two callers sweep
with `^[ \t]*import\b` and `^[ \t]*export\b`, and collapsing a multi-line comment to a single space
joined the line before it to the line after, taking the second statement's anchor with it. Keeping the
shape can only ever find more of them.

**TWO THINGS THAT LOOK LIKE COPIES ARE NOT.** `tree-figures.ts`'s `directiveCarriers` and
`packages/ui/src/components/directives.test.ts` both hold
`/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/`. That is not a stripper: it asks whether a
`"use client"` directive is the first thing in the file that is not a comment, so it must SEE the
comments to answer. Folding it into this module would destroy the question it asks. They are named
here because a reader counting `/\*[\s\S]*?\*\//` in the tree will find them.

## As built, under CNCORE-300

**BUILT: one scan, four callers, no copies.** The only matches for `replace(/\/\*` over `*.ts` and
`*.tsx` are the two docblocks in this module and its suite that QUOTE the old expression as prose.
No call site holds one.

**BUILT: nine rows, each proved non-hollow.** Under
[[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]] every row was run against four
mutations -- the two regex rules it replaces, a body returning its argument unchanged, and the first
version of this scan, which did not track regex literals -- and each row is red on at least one. The
last mutation is the one that matters: it reddens exactly the two rows added after review, and
nothing else, which is what says those two rows earn their place.

**TWO ROWS WERE HOLLOW OR WRONG WHEN FIRST WRITTEN, and both were fixed rather than kept.**
`"//fonts.googleapis.com"` with the `//` hard against the quote passes the whitespace rule by
accident, so a space was put before it. And the docblock on that row claimed it was red on BOTH rules
it replaces; it is red on the whitespace rule only, since the line-start rule strips nothing mid-line.

**A DERIVED FIGURE MOVED, and it is stated rather than quietly updated.** The sweep row makes
`without-comments.test.ts` a suite that reads the repository at large, so that count went from 27 to
28. `turbo-cache-inputs.test.ts` states it in two sentences and `tree-figures.test.ts` asserts it;
all three were updated together, which is [[0153-a-figure-about-this-tree-is-derived-or-dated]]
working as intended.

**MEASURED, at the commit this record lands on:** `packages/config` runs 31 files and 284 tests green,
up from 30 files and 275 tests on `main` -- one new file and nine new rows, with no existing row
changed. `tsc --noEmit` and `pnpm lint` are clean.

**NOT BUILT: nothing stops a fifth copy.** No check refuses a comment-stripping regex in a new file;
this is a rule a reviewer applies, which is the same missing half ADR-0168 names for itself.

**NOT RUN: the suites that need a database.** `@canoncore/db`, `@canoncore/api`, `@canoncore/tasks`
and one `apps/web` suite abort on an unset `DATABASE_URL` in a worktree provisioned only with
`.env.example`. None of them can reach this module -- it is package-private to `@canoncore/config`
and absent from that package's `exports` -- and the abort is unprovisioned rather than red.
