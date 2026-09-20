---
status: accepted
---

# The name is settled; do not rename again

> **ACCEPTED 2026-09-20, whole, in one repository.** Both clauses hold. THE NAME is set in
> `apps/web/src/app/layout.tsx`, whose docblock cites this record and says why there is no title
> template, and it is asserted at `apps/web/e2e/front-page.test.ts` against the exact placeholder
> the generator left. That assertion is on the CASED string, because the scaffold's own value
> differed from the right one only in its capitals -- a tab reading `canoncore` beside a heading
> reading CanonCore is the scaffold showing through, and a case-insensitive check would have passed
> on it. THE OLD NAMES survive in no identifier, no path and no component name.

CanonCore has already been renamed twice.

AND THE OLD NAMES MUST NOT SURVIVE IN THE CODE. Never "Universora" in an identifier, a path or a
component name. This mattered more than it sounded WHEN IT WAS WRITTEN: the salvage manifest
instructed lifting code out of repositories that carried the old name, so the rule governed an
operation the project actually intended to perform, not a hypothetical. **THAT OPERATION IS
SUPERSEDED as of this record's acceptance, and the ban is kept for a different reason** -- below.

A rename is not a find-and-replace. Karakeep's cost it Docker image continuity and its Firefox
extension outright — "we couldn't get the old one back... you MUST migrate to the new one manually".
The work itself was 14 commits in the tight cluster over three weeks, one of them touching 230 files
(+654/-644).

## Where the old name still appears, and why none of it is a breach

A repo-wide case-insensitive search finds the old name only in markdown under `docs/`: working notes
in `docs/research/`, and the sentence in this record that bans it. Not one hit is an identifier, a
path, a component name or a line of code. A record that forbids a word has to write it down once to
forbid it, and research is dated working that `docs/research/README.md` rules is left as written --
"editing research to match a later deletion would falsify the record of what was known when".

## The clause's original reason is spent, and the clause is kept anyway

This record argued the ban was not hypothetical because "the salvage manifest instructs lifting code
out of repositories that carried the old name". **THAT OPERATION IS NO LONGER INTENDED.** `CLAUDE.md`
and `CONTEXT.md` both record the salvage manifest as superseded, and the forensic record is now read
as evidence when a record cites it rather than as instructions to act on.

So the route by which the old name could have re-entered this tree is closed, which is most of why
the second clause is clean. The ban is kept because it is cheap and because the failure it guards
against is not salvage-shaped: it is a rename half-done, which is the thing the paragraph above it
measures in Karakeep's own costs. **A CLAUSE WHOSE JUSTIFICATION HAS EXPIRED IS WORTH SAYING SO
ABOUT**, rather than leaving a later reader to find the salvage argument, check it, and discover it
names an operation this project has abandoned.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-products.md`.
