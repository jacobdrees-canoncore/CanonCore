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
unstable. **The scan that does it here has no dependency, and the population it reads passes
through it in the time the suite already took.**

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
scanner. The scan here remains the right answer for this question.

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

**A `/` IS RESOLVED BY THE CODE BEFORE IT, not parsed.** Telling a regex literal from division needs
the parse this deliberately does not do, so the code before the `/` decides, read back past
whitespace and blanked comments. After `(`, `,`, `=`, `:`, `[`, `{`, `}`, `;`, an operator -- `=>`
among them -- a spread's `...`, a keyword a value can follow like `return` or `default`, or a `)`
that closes the head of an `if`, `while`, `for` or `with`, a `/` opens a regex. After anything else
-- an identifier, a property named like a keyword, `]`, a quote, any other `)`, and notably `<` in
`</div>` -- it divides. **A WRONG GUESS IN EITHER DIRECTION CAN DELETE CODE.** This paragraph said
first that a wrong guess cost at most one line, then, after CNCORE-321's review, that taking
division for a regex did, and both were false. A regex taken for division is read as code, so a
`/*` inside it opens a comment that runs to the next `*/`: a regex after `=>` did that until
CNCORE-324, and four shapes still would -- a regex after `<`, after a `for await` head, as the
divisor in `a / /re/`, or opening the line after a statement left without its semicolon, which
Biome never leaves. Division taken for a regex -- after `i++`, a non-null `x!`, or a variable named
`of` -- is usually abandoned at the end of its line, since a regex cannot span one. But where a
second `/` follows on that line inside a string or template, the run ends inside the literal, the
rest of the literal is read as code, and a `/*` there deletes too: `let half = i++ / 2 + "a//*";`
swallows the docblock below it. **Measured 2026-09-21 against oxc's parser**: every tracked `.ts`,
`.tsx`, `.js`, `.mjs` and `.cjs` in the three repositories that hold the scan -- 321 here, 54 in
`provider-wiki` and 24 in `provider-tmdb` -- parsed with `oxc-parser`'s `parseSync`, and its
`comments` compared with `commentsIn`'s by offset and text. The scan finds exactly the comments the
parser does in every file. Before CNCORE-324 they disagreed in one: `provider-tmdb`'s
`test/image-platforms.test.ts:531`, where a regex after `=>` had its `//.test(...)` tail taken for a
line comment.

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

## Copied to the provider repositories, under CNCORE-321

**The scan's code now runs in two more repositories**, `provider-wiki` and `provider-tmdb`, each at
`test/setup/without-comments.ts`, copied line for line -- and since CNCORE-324 byte for byte,
docblock included -- so each can refuse a stacked docblock
([[0196-a-docblock-sits-on-the-declaration-it-describes]]). [[0031-a-provider-is-a-url]] rules out
the shared package that would have kept one copy. "One scan, four callers, no copies" above is
true of this tree and not across the three. Nothing keeps them in step, and
`testing/without-comments.ts`'s own docblock says so where an edit would start.

## Fixed in all three copies, under CNCORE-324

**A REGEX AFTER `=>` WAS READ AS DIVISION, AND `>` WAS ONE MISSING TOKEN OF FIVE.** The others were
found by asking which tokens a value can follow, rather than waiting for each to be filed: a
spread's `...`, the keywords `default` and `extends`, and the `)` that closes the head of an `if`,
`while`, `for` or `with`. That last rule is esprima's: its tokenizer's `isRegexStart` answers a `)`
by the keyword before the matching `(`.

**THE `)` NEEDS PAIRED PARENTHESES**, so each open `(` records whether it began a head, and a `)`
answers for the `(` it closes rather than the last one opened. `if (ready(s)) /re/` closes two.
Esprima keeps only the index of the last `(` it saw, and reads that shape as division.

**THE CODE BEFORE A `/` IS READ BACK FROM THE SCAN'S OWN OUTPUT**, and three variables that tracked
it are gone. The output is the source with every comment blanked, so reading it backwards past
whitespace reaches the last real token, and that read can see what the state could not: whether a
word follows a `.`. The first fix under this ticket matched `default` and `for` as keywords in
`config.default / 2` and `cache.for(key) / 2`, which review found. Those were new ways to take
division for a regex that the scan before it did not have, and a word after a `.` is now a property
and never a keyword. The `.` added for a spread became exactly `...`, so `1./2` divides, although
Biome prints that as `1 / 2`.

**THE THREE COPIES ARE NOW ONE FILE.** The scan's docblock was rewritten so that every file it names
says which repository holds it, and `testing/without-comments.ts` is byte-identical to both
providers' `test/setup/without-comments.ts`, prose included. **The provider pair is merged**:
provider-wiki#63 as `4e7a519` and provider-tmdb#34 as `d117a3f`, and at both commits the file hashes
the same as it does here. Under CNCORE-321 only the code was, and
the correction that pass made to the docblock here reached the providers' in different words. The
history this docblock carried -- the 178-source measurement, and why the fold is
[[0171-the-fold-is-of-the-read-not-of-the-question-it-answers]]'s seam -- is this record's, above,
and it left the docblock rather than be copied into two repositories it is not about.

**SIXTEEN ROWS BY SHAPE, THE SAME BLOCK IN ALL THREE SUITES.** Ten shapes a regex follows and six a
division does. The eight for the missing tokens and heads were red on the scan as merged under
CNCORE-321, in all three suites -- `8 failed | 17 passed (25)` here, `8 failed | 21 passed (29)` in
each provider -- and are green now. `return` and an operator held already. Under
[[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]] each division row was run
against its own code added to the regex list, the `.` guard deleted, each head deleted from the set
on its own, and a scan that does not pair parentheses: each mutation reddens its own row. Two
provider rows the table covers were deleted rather than kept beside it.

**MEASURED, at the commit this section lands on:** `packages/config` runs 37 files and 367 tests
green, sixteen of them new, and `tsc --noEmit` and `pnpm lint` are clean. `provider-wiki` runs 23
files and 387 tests, `provider-tmdb` 12 files and 213, each with typecheck and lint clean.

**NOT BUILT: nothing holds the three copies together.** A diff says whether they agree, and no check
runs one. Nor is the comparison with oxc a check: it ran from outside all three repositories, and
making it one would put a parser into each one's dependencies to test the module that exists so as
not to need one.

**NOT BUILT: the shapes that still guess wrong**, named above: a regex after `<`, after a
`for await` head, as the divisor in `a / /re/`, or after a statement left without its semicolon,
and division after `i++`, `x!` or a variable named like a keyword. None changes a comment in the
three trees, measured against the parser.
