---
status: accepted
---

# A parameter a page speaks is reported where it is unbounded

> **ACCEPTED 2026-09-21, whole, in one repository.**
> `packages/config/src/bounded-parameters.test.ts` reads every `.tsx` git tracks under
> `apps/web/src`, follows each value taken off `searchParams`, and names the FILE and the PARAMETER
> wherever one reaches a JSX child position without having been through a bounding call. It is green
> on `main` as of `9f20f1d`, CNCORE-291 having bounded the sixth and seventh sites.
>
> **EVERY RED BELOW WAS CHECKED AGAINST THE STATE IT NAMES**, and each is a real site reverted rather
> than a fixture: `/search`'s bound dropped at the read; `/import`'s `quoted` field set to the raw
> query; `/import`'s sentence switched from `search.quoted` to `search.q`; `/import`'s hidden replay
> field spoken beside the input instead of filling it; `/settings`' wrapper swapped for `oneValue`;
> `?placing=` moved out of its form field; `?refused=` printed instead of tested; the front page's
> kind printed as typed instead of looked up; and `/search`'s Group name handed the parameter instead
> of the Group. Shapes with no site to revert are written out -- a value spoken after a `&&`, one
> taken through the CUT alone at the arity a caller really writes, and one through the other lever --
> and each was a FALSE PASS that review or the dispatcher measured, so what they hold is a regression
> rather than a hypothesis. The cut-alone row asserts `shortenTo`'s SIGNATURE before planting a call
> shaped like one, because its first version asserted against a one-argument call that cannot exist and
> passed while the defect shipped.
>
> **WHAT COUNTS AS A BOUND IS DERIVED FROM THE RULE, NOT FROM A NAME.** A function reaching both of
> ADR-0123's levers bounds, and one calling such a function bounds, to a fixed point; the whole
> derived set is asserted, so a page cannot drift into it. **ONE CLAIM HERE HAS NO WITNESS**: that the
> check would catch an EIGHTH site nobody has written yet. It cannot have one, and the reverts are the
> nearest thing. No provider repository is touched, so nothing is owed at a second one.

[[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]] requires a value a stranger supplies to be
bounded before this app repeats it in a sentence of its own.
[[0163-the-levers-that-bound-a-strangers-text-live-in-a-leaf]] published the levers so every package
could reach them. [[0170-a-value-a-page-both-asks-with-and-quotes-is-two-values]] settled what a page
does when it both asks with a value and speaks it.

**None of the three could say who OWED the bound.** That is this record.

## The evidence is that both misses were found by a person, and neither by the tree

ADR-0163's accepted block said every site putting a stranger's prose in this app's sentences reached
both levers. It was wrong: `?q=` at `/search` was a sixth, found by inspection while CNCORE-256 was
deciding an unrelated question. ADR-0170 then said the same thing one record later, naming `/search`
as the sixth and asserting the set complete -- **committing the identical error in the sentence
correcting it** -- and `/import` was a seventh, found by the code review ON CNCORE-291.

Two for two, by two different people, reading two different diffs. What both records had was a count
of `boundedTo`'s callers, and **a count of the callers is a count of the sites that ANSWER the rule,
never of the sites that OWE it.** The sites nobody had counted are exactly the ones such a count
cannot see.

This is the same shape as [[0153-a-figure-about-this-tree-is-derived-or-dated]] for figures and
[[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]] for assertions: a class that is
only ever caught by somebody happening to look is a class that needs an instrument.

## Where the boundary is: what a value LANDS in

ADR-0170 already decided this, in as many words -- it "turns on where a value LANDS" -- and the check
applies that sentence rather than inventing a rule. A parameter reaching a JSX CHILD position is the
page speaking; anywhere else it is not. Five landings therefore sit outside the rule, each of them a
decision some record already took:

| The landing | Why it is not a sentence | Whose decision |
| --- | --- | --- |
| An attribute | `defaultValue={placing ?? ""}`, `value={search.q}`: the Owner's own words handed back in a form control | ADR-0165, ADR-0170 |
| A gate | `{refused && <p>…</p>}` reads it as a bare boolean; every sentence it gates is the page's own | CNCORE-281, measured |
| A member of a closed set | `WHAT_WAS_REFUSED[because]`, `kinds.find(…)?.label`: keyed ON the reader's word, answering WITH one of ours | CNCORE-281 |
| A round trip | Handed to an awaited read, or to a call given data that read answered, it comes back as the catalogue's | ADR-0170 |
| An iteration | `{Object.entries(carried).map(…)}` renders the callback's JSX, judged where it stands | this record |

**EVERY ONE OF THOSE IS DRIVEN BY A ROW, not listed in a comment.** The exemption and its
counterexample stand together: `?placing=` passes in its form field AND is named when moved into a
sentence. An exemption nothing executes is one nobody can check, and the ticket that asked for this
check refused to have it loosened until the tree passed.

## The rule is derived three times over, which is the whole difference from a note

Nothing in the file lists the surfaces, the parameters, or the bounding calls.

**The surfaces** are every `.tsx` git tracks under `apps/web/src`. **The parameters** are whatever
each one takes off its own address. **The bounding calls** are the fixed point of "a function that
reaches BOTH of ADR-0123's levers, or calls one that does".

**THE TREE REFUTED THE FIRST VERSION OF THIS WITHIN HOURS, AND IT IS WORTH BEING EXACT ABOUT WHAT
BROKE.** CNCORE-285 landed `quotedTo` between both wrappers and `boundedTo`: `theQueryQuoted` and
`theEntryRefused` now call `quotedTo`, which calls `boundedTo`. The check went red on three bounded
surfaces, and **the cause was the POPULATION rather than the seed** -- `@canoncore/text` was not
swept, so the chain's middle link was invisible and no amount of transitivity could reach it. That
package is in the population now.

**THE SEED BECAME THE RULE AS WELL, WHICH IS A SECOND FIX AND NOT THE SAME ONE.** Naming `boundedTo`
would work again today; it would stop working the day that function is itself renamed, which is the
same class of event that had just happened one hop along. Asking instead which functions reach both
levers costs nothing and cannot be renamed out of. That the two seeds are distinguishable at all is
owed to a defect found while measuring this: a scope starts at its `function` keyword, so a
declaration's own `name(` was read as a call to itself, and `boundedTo` was entering the set for
being spelled `boundedTo` rather than for reaching both levers. Right answer, wrong reason, and a
row now refuses it.

**ADR-0163 PREDICTED THE WRAPPER, having watched three copies of those five lines drift twice in one
project.** It arrived on a schedule nobody arranged.

`shortenTo` is absent BY THAT RULE rather than by exclusion -- it reaches one lever -- and a row
holds the whole derived set to `boundedTo`, `quotedTo`, `theEntryRefused` and `theQueryQuoted`. Two
things follow that a `toContain` did not give: a tree where the CUT alone began to count would go
green on the defect CNCORE-282 was filed for, and a PAGE drifting into the set would seal calls to
itself. The review of this ticket found three pages in it, counted there merely for mentioning a
bound.

## What it does not answer

**A VALUE LAUNDERED THROUGH ANOTHER MODULE.** The walk is within one file. `{...surface}` is that case
today: `surface.asked.q` reaches `Walk` and `PastTheEnd` in `listing.tsx`, which write it into links
rather than sentences. The ticket named this limit when it was filed and it is kept, because the
cross-file case is worth a second instrument rather than a looser version of this one.

**A ROUND TRIP THAT REALLY DOES CARRY THE BYTES.** Treating an `await`, and a call given more than one
argument, as answering with this tree's own data is true of every such call here and is not true in
general. A page that sent `?q=` to a procedure and printed the procedure's echo of it would pass.
That is a FALSE PASS rather than a false failure, which is the direction that matters, and it is the
first thing to revisit if the seam below stops bounding its own refusals.

**WHETHER THE TEXT IS A LIE.** A bound answers how MUCH a stranger puts on a page and what it may DO
to the words around it. ADR-0170 records the residue: a crafted sentence of eighty characters is
still quoted whole.

**ANYTHING OUTSIDE `apps/web`.** FOUR of ADR-0163's five sites are in packages that render nothing --
`@canoncore/providers`, `@canoncore/db`, `@canoncore/api` and `@canoncore/tasks` -- so JSX cannot be
the instrument for them. **The FIFTH is `?refused=` on `/settings`, which IS in this population and IS
driven by a row.** An earlier draft of this paragraph said five sites were outside, which both
miscounted that record's list and quietly moved `/settings` into a package. That is the error this
record exists to end, committed about the record it cites, and it is corrected in the sentence that
made it rather than beside it.

## What building it taught, which is worth more than the check

**A HEURISTIC OVER JSX NEEDS LEXICAL SCOPES, AND THAT WAS MEASURED RATHER THAN FORESEEN.** Keyed on
bare names the walk reported SIX sites on a clean tree. `?provider=` is read on `/import` and handed
to a component as `baseUrl`, and `configured.map((baseUrl) => …)` binds a different `baseUrl` three
screens away. The worst of the six was the front page's `NoItemsOfThatKind`, whose `kind` is an
`item_kinds` label and whose docblock is CNCORE-281 explaining that the typed word no longer reaches
it -- so the check's first output was an accusation against the very fix it should have been
confirming. **A check that has to be loosened to get past its own false reds is worse than no check**,
because the loosening is what ships.

**AND IT NEEDS MEMBER PRECISION TO SURVIVE A HAND-OFF.** ADR-0170's design is two fields named apart,
`q` and `quoted`, "so a sentence reaching for `q` is visibly the wrong field". `/import` builds that
value, wraps it in a second, and hands that to the component which prints it. A walk that carried
taint per OBJECT would resolve the bounded field to whatever the object holds and report the page
that gets it right. The check follows what a name is another name FOR, so `search.quoted` resolves
through both hops to the bound and `search.q` does not.

### A row that tests a call shape is worth nothing until it is pinned to the real signature

This is the sharpest thing the build taught, and it cost two passes.

`shortenTo` is the CUT alone -- ADR-0163's half-mechanism -- so a sentence taking it and nothing else
is a breach this check must name. The first version did not, because the rule excusing a value inside
parentheses excused every call. That was found, fixed, and covered by a row asserting that
`{shortenTo(query)}` is named.

**The fix was real and the row was vacuous, so the defect went on shipping.** `shortenTo` is
`(text: string, max: number)`. `shortenTo(query)` is a call nobody can make, and every call that can
be made has two arguments -- which the sealing rule of the day excused, because it sealed anything of
more than one argument. Green row, live hole. The dispatcher found it by reading the signature and
planting `shortenTo(query, 40)` into `/search`, where the suite stayed green.

**TWO THINGS FOLLOW, AND THE SECOND IS THE GENERAL ONE.**

The sealing rule now asks PROVENANCE instead of arity: a call is sealed where one of its arguments
carries what an awaited read answered. `theScope(groups, narrowedTo)` is sealed because `groups` came
out of the catalogue; `shortenTo(query, 80)` is not, because a ceiling is not data. The idiomatic
spelling `shortenTo(query, QUERY_IN_A_SENTENCE)` -- two identifiers, which the arity rule was blindest
to -- is named as well, and one row carries both spellings plus the other lever alone.

And that row asserts `shortenTo`'s signature before planting anything shaped like a call to it, so the
arity cannot drift out from under the assertion a second time. **A test written against a SHAPE rather
than against behaviour has to be pinned to where that shape is declared**, or it is
[[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]]'s defect wearing a passing row:
true of nothing, and reporting success about it.

### Why the scanner, when ADR-0177 measured it and refused it

[[0177-a-stripper-that-must-read-code-is-a-scan-not-a-pattern]] landed the same day and reached the
opposite answer, and this is not a reversal of it. **That record's question is "what does this file
say with its comments taken out", whose answer is a STRING.** A scan with no dependency beats an
API the package marks unstable, and `withoutComments` is the right tool for it.

**This check's question is where a token STANDS**, and an attribute is not a child. No stripped
string can answer that, so the choice here is between the compiler's tokeniser and a second
hand-written one that would have to learn JSX as well -- and a regular expression is not in the
running at all, because the prose above every bounded site in this tree ARGUES for the bound, naming
the parameters more often than the code does. A reader counting raw bytes finds the argument for the
rule and reports it as the rule being kept.

**AND THE RUNAWAY ADR-0177 REFUSED IT OVER IS ISOLATED, WHICH THAT RECORD SAID IT HAD NOT DONE.** It
measured 6 of 178 files emitting an unbounded stream of zero-width `PrivateIdentifier` tokens and
could not reduce it. The mechanism is that a plain `scan()` never re-scans a `/`, so a regex BODY is
read as code; `const r = /(#)/;` stalls where `/** prose `#1` */` does not, and a BACKTICK in a regex
body opens a template that runs on into the next docblock, where a `#` in prose stalls it. The
correction is written into ADR-0177 at the sentence that made the claim. Driving the scanner
correctly means three re-scans the parser supplies -- and this check pays that cost because it needs
the positions, where a stripper should not have to.

### The traps in TypeScript 7's scanner, each of which cost real time

- **DRIVING IT WITH `scan()` OVER JSX DOES NOT TERMINATE.** JSX text read as code is not JSX text:
  `listing.tsx` prints an ordinal as `#1234` (CNCORE-184), and a bare `#` that begins no private
  identifier comes back as a zero-length `PrivateIdentifier` **without advancing the scanner**. The
  loop spun to 400,000 tokens on two of the files then swept and the process died. An apostrophe in prose
  is the same class, opening a string literal that swallows the page. `scanJsxToken()` answers with
  the whole run as one `JsxText`, which is correct as well as finite.
- **A TEMPLATE'S `}` IS NOT A BRACE.** `${…}` closes with a `CloseBraceToken`, so a walker counting
  braces reads it as the end of the JSX interpolation it sits inside. Measured on `/items/<id>`,
  where a `key` built from a template put the walk back inside a tag, after which the scanner read
  three thousand characters of DOC COMMENT as template literals before stalling on that `#`.
  `reScanTemplateToken` is what the compiler's own parser calls there.
- **A REGEX BODY IS READ AS CODE** unless `reScanSlashToken` is called where a value can start,
  which is the stall above. One predicate answers both that and whether a `<` opens an element,
  because it is one question: can a value start here.

**AND A MISSING MEMBER OF ITS ENUMS IS `undefined` RATHER THAN AN ERROR**, which is how the first trap
arrived: `SyntaxKind.EndOfFileToken` is `EndOfFile` in TypeScript 7, so the loop's exit condition
compared against `undefined` and never fired. **The typechecker caught one no runtime probe did**: `createScanner` dropped its leading `ScriptTarget` argument, so a call written from
memory of the old signature shifts every argument one place and still appears to work. The check
carries a guard that throws with the offset when the scanner stops advancing, so the next character
of that class is a named red rather than a hung suite.

**THE SUBPATH SAYS `unstable` AND MEANS IT.** TypeScript is pinned through the catalogue, so this
moves when that moves, and the rows in the file are what turn a renamed member into a red.
