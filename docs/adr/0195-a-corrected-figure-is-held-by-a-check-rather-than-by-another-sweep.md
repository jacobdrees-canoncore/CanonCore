---
status: accepted
---

# A corrected figure is held by a check rather than by another sweep

> **ACCEPTED 2026-09-21, whole, in one repository.**
> `packages/config/src/corpus-import-cost.test.ts` sweeps every tracked text file for the superseded
> cost of importing the corpus and refuses any statement of it that does not carry its correction.
> Six sentences across five files were corrected to lean on their own reason, and
> [[0135-an-import-run-is-rows-and-the-walk-is-one-container-a-call]]'s own estimate now carries the
> eleven-minute measurement in the sentence that makes it. `testing/sentences.ts` holds the block and
> sentence cutter that `terminal-send-hazards.test.ts` wrote and this check needed. Neither Provider
> repository states the figure -- both spell 43.8s as the LARGEST page's cost, which is the framing
> this record asks for -- so nothing is owed at a second one.

[[0135-an-import-run-is-rows-and-the-walk-is-one-container-a-call]] estimated the wiki's corpus at
about five and a half hours and corrected itself: that is 465 multiplied by AHistory's 43.8s, the
LARGEST page on the wiki, and the whole corpus in fact landed in roughly **eleven minutes**,
measured 2026-09-15 into the Owner's own install. The estimate was superseded the day it was
measured.

**It went on reading as a live cost for six days, at six sentences, through two sweeps that were
looking for exactly it.** CNCORE-246 swept and missed some; CNCORE-289 swept the same figure again
and missed some, including one 170 lines from a docblock it had just edited in the same file. The
dispatcher's own tree-wide `git grep -i` on 2026-09-21 found a site neither had, and filed
CNCORE-327 naming four. **There were six.**

## A third sweep would have missed too, and this is the measurement rather than the suspicion

The two sites the dispatcher's grep did not reach are the ones that say why the instrument is the
problem:

- **`packages/api/src/import-list.test.ts:201` was WRAPPED.** The docblock is hard-wrapped at 100
  columns, so the sentence read `...is about five` / ` * and a half hours...`. **No `git grep` can
  match that at all**, in any case or hyphenation, because the phrase is not on one line. A sweep
  that greps is blind to it by construction, and re-running the sweep more carefully changes
  nothing.
- **`packages/db/src/import-runs.test.ts:344` stated the ARITHMETIC.** "the corpus is 465 Containers
  at 43.8s each" multiplies the count by the LARGEST page's cost, which is the superseded figure
  exactly, spelled with no words to grep for.

So the decision is not "sweep again, harder". A mechanical fault gets a check, which is
`/closing-a-spec`'s rule and the reason CNCORE-327 declined to be a third sweep.

## The check refuses the figure UNCORRECTED, never the figure

**The rule is that the correction stands beside the figure, not that the figure is absent**, and
that is forced rather than preferred. `adr-as-built.test.ts` settled the identical question already:
"a record correcting itself has to be able to say what it used to claim". ADR-0135 and ADR-0137 are
the two documents that OWN this correction, and a rule refusing the figure outright would drive it
out of the only two places that carry it -- leaving a tree where nothing is wrong and nothing
explains why.

**So the exemption is a SENTENCE rather than a filename.** A named list of excused files rots in
both directions: it survives a rename by matching nothing, and survives a rewrite by excusing
whatever replaced the prose. A document that quotes the estimate in order to correct it is covered
here without being named, and on the day it stops correcting it, it is not.

**THE UNIT IS THE SENTENCE**, which is `CLAUDE.md`'s rule in its own words: "Put the correction in
the sentence it corrects -- placed beside one, it leaves the old claim standing." A document-level
check would pass ADR-0135 on the strength of a correction three sections away from the estimate,
which is the shape that rule exists to refuse.

**A WINDOW OF THE NEIGHBOURING SENTENCES WAS TRIED FIRST, AND WAS LOOSER THAN THE RULE IT
ENFORCES.** The word `largest` stands in 69 tracked files, so a window let any neighbour carrying it
for an unrelated reason excuse a live claim beside it: "The largest Ordering holds 500 Placements."
would have exempted a stale sentence sitting next to it. The code review on this ticket found that,
and tightening cost nothing -- measured across the whole tree, every statement that passes the
window rule passes the sentence rule too, so the looser bound was buying only the loophole.

**What counts as the correction is ADR-0135's and ADR-0137's own vocabulary**, not this check's
invention: the measured **eleven minutes**, or 43.8s named as the **LARGEST** page rather than a
typical one, or the product called **not a bound** / **a different quantity**. Both Provider
repositories independently reached the same idiom -- `provider-wiki` spells it "the largest of them"
and "the largest single page" -- which is corroboration that this is the tree's word for the correct
framing rather than a phrase chosen to make a regex pass.

**`mistake` is deliberately NOT in that vocabulary, and it is the exclusion worth writing down.**
`import-list.test.ts:280` opened "WHERE A FIVE-AND-A-HALF-HOUR MISTAKE WOULD HIDE": it concedes the
figure is wrong and still spends the reader's whole attention on a quantity nothing pays -- the
import is eleven minutes -- to explain a point about resuming that has nothing to do with duration.
A vocabulary that accepted `mistake` would have marked that site correct and left it standing
exactly as the two hand sweeps did.

## The population is derived by asking what is text, not by listing what is source

Every tracked file is opened and one holding a NUL byte is dropped. **An extension allowlist is a
list of the places a figure has been found before**, which is the instrument that already missed
twice. The `.sql` rung is the specimen: a sweep of "source files" would not have thought to open the
migration ladder, and the ladder is where the one uncorrectable statement lives.

## The floor is load-bearing, and that was measured rather than assumed

The population count is asserted before the rule is. **With the sweep emptied, the rule passes** --
"no statement reads as a live cost" is satisfied by opening no files at all, and the run goes green
over a tree nothing has read. That was reproduced on 2026-09-21 by emptying the tracked list and
watching the rule stay green while the three guards around it went red. It is the vacuous pass
CNCORE-298 and CNCORE-314 each paid for separately, standing inside the mechanism meant to answer
it.

## The frozen rung is where a correction cannot land, and the exemption is EXECUTED

Migration 18's prose states the superseded figure and always will.
[[0047-migrations-are-a-forward-only-ladder]]'s freeze check hashes every applied rung against
Drizzle's ledger, so editing a shipped rung fails `db:check-ladder` on every database that has run
it -- the Owner's install included. [[0134-a-sort-name-is-derived-by-stripping-a-leading-article]]
met this from the other side and named it: the rung "was frozen the moment a release applied it,
which is that record's rule working rather than an obstacle to route around".

**So it is reported by name rather than skipped**, and the set is held to EXACTLY that one rung --
`bounded-parameters.test.ts`'s rule that "an exemption nothing executes is an exemption nobody can
check". Both ways it could rot then redden. A NEW rung stating the figure is caught while it can
still be edited, which is the only window a rung ever has; and a reader that stopped matching the
rung's spelling empties the set rather than quietly shrinking the rule beside it.

**Nothing offline can ask which rungs an install has APPLIED**, since the freeze check reads a live
database, so the rung is named as a string rather than derived. That buys a red run on the day the
name moves, which is the honest trade and not a gap.

## What this does NOT cover, said here rather than left to be discovered

- **ONE FIGURE, NOT A CLASS.** This holds the corpus-import cost and nothing else. It is not a
  reader that decides which numbers in English are stale, which `tree-figures.test.ts` argues at
  length is not a problem a regular expression settles.
- **A DOCUMENT THAT STATES THE FIGURE AND MEANS A DIFFERENT QUANTITY IS UNTOUCHED, ON PURPOSE.**
  ADR-0133's "five and a half TIMES" and `docs/research/resolution/resolve-X1-X6.md`'s "five and a
  half YEARS" both wear the words and neither is this figure. The unit is what separates them, and
  both were measured as false positives before the pattern carried it.
- **A PRODUCT SPLIT ACROSS TWO SENTENCES IS INVISIBLE, BY CONSTRUCTION.** The arithmetic is caught
  by both factors standing in ONE sentence, so "the corpus is 465 Containers. Each browse cost
  43.8s." asserts the same thing and matches nothing. Widening the unit is what the paragraph above
  refuses for the correction, and it cannot be one thing here and another there: the sentence is the
  unit or it is not. Named here so the next reader meets it as a decision rather than as a hole.
- **THE NUMERIC SPELLINGS ARE REFUSED BEFORE ANYTHING WRITES THEM.** Nothing in this tree spells the
  superseded figure in digits -- as `5.5`, as a fraction or with a vulgar half, each against the
  word `hours` -- and the measured cost those forms would be wrong about is eleven minutes. They are
  in the pattern because a sweep is defeated by the spelling nobody thought of, and the whole
  argument of this record is that the next miss is the one the instrument cannot see.

## What implementation taught

**A hard-wrapped claim is invisible to the tool everybody reaches for.** Two sweeps, a dispatcher's
tree-wide grep and a ticket written specifically about missed spellings all failed on the same
sentence, and none of them failed through carelessness: `git grep` cannot match a phrase broken by a
newline, and every one of those instruments was `git grep`. The corpus this repository checks itself
against is hard-wrapped prose, so **any check over it that does not flatten first is measuring the
line breaks rather than the claim** -- which is `flatten.ts`'s paragraph, arriving for the second
time at a different suite.

**A CHECK OVER THE TRACKED TREE IS BLIND TO ITSELF UNTIL IT IS COMMITTED, AND THAT IS THE ONE RUN
NOBODY THINKS TO TAKE.** The population is `git ls-files`, so while this check's own module and this
record were untracked they were not swept, and every run was green over a tree that did not yet hold
them. The first commit turned three files tracked at once and the next run went red naming the
check's own regexes. The reader that holds a pattern cannot be its own subject and is excused by
path; this record is NOT, and every sentence here that names the superseded figure carries the
correction, because a record that could not live under its own rule would be a rule nobody should
keep. **Any check whose population is the index should be run once after `git add`**, or its author
is reading a tree that is missing exactly the files they just wrote.

**IT THEN HAPPENED A SECOND TIME, TO THE PERSON WHO HAD JUST WRITTEN THAT SENTENCE.** A code review
asked for a suite over the shared sentence cutter; its rows reached for the wrapped spelling because
that is the cut they demonstrate; the whole package was run green while that file was still
untracked; and it was committed and pushed without being run again. The dispatcher found the red on
the pushed head. A rule written into a record in the same pass that breaks it is the strongest
evidence there is that the rule needs a mechanism rather than a reader's attention, which is this
record's whole argument arriving at its own author.

**AND THE REFLEX FIX WAS THE WRONG ONE, WHICH IS THE PART WORTH KEEPING.** A third name on the
exclusion list turns that red green in one line and is silent for ever after. It was wrong because
the cutter is GENERAL: those rows need a sentence that wraps, any sentence wraps, and the figure was
doing no work in them. It is described where it matters, in this check's own fixtures where the
spelling IS the subject, and absent from the cutter's suite, which is
[[0190-the-prose-corpus-is-named-once-and-claude-is-prose]]'s shape for the same self-reference.

**SO AN EXCLUSION HERE ANSWERS FOR ITSELF.** Every excused file is swept separately and must still
produce findings, so an exclusion that has stopped being necessary reports nothing and the suite
refuses it. That is `bounded-parameters.test.ts`'s rule turned on this check's own escape hatch, and
it is what makes the shortcut above go red on the run that takes it rather than never.

**A ticket's count of the sites is a sweep's output, and inherits that sweep's blind spot.**
CNCORE-327 named four fixable sites in a table headed by the spelling that hid each one. It was
filed by the instrument it was written to replace, so its four were the four that instrument could
see. Correcting the ticket's premise was the first thing the check did.

## Evidence

- **Every spelling planted and shown red, 2026-09-21**, one at a time into `import-runs.ts`, each
  compared against a case-insensitive grep for the worded form over the same file. Four forms: the
  phrase broken across a 100-column wrap, the arithmetic with no words, the shouted-and-hyphenated
  form, and a numeric one nothing has yet written. **Grep found zero of the four; the check went red
  on all four.**
- **The exclusion list shown red two ways**: by adding a file that does not need excusing, which
  names that file; and by renaming an excused one, which throws naming the path. The first is the
  shortcut this record argues against, refused by the mechanism rather than by care.
- **That plant is no longer the evidence, which is the change the code review bought.** It was a
  measurement taken once, by hand, into a file then restored -- everything it proved stopped
  existing with it. `corpus-import-cost.test.ts` now carries a row per spelling and a row per near
  miss, so fourteen forms and five things that merely wear the words are checked on every run.
  ADR-0133's "five and a half TIMES" and a research document's "five and a half YEARS" are two of
  the rows rather than a sentence promising somebody once looked.
- **The floor shown red by emptying the swept list**, and the rule shown green over that same empty
  list, which is the measurement the floor section above rests on.
- **The frozen-rung set shown red by pointing its name at a rung the ladder does not hold.**
- `pnpm --filter @canoncore/config test`: 39 files, 410 tests, green. The new suite moved
  `suitesReadingTheRepository` from 34 to 35 and `tree-figures.test.ts` caught both restatements of
  the old count in `turbo-cache-inputs.test.ts` -- the drift mechanism catching this record's own
  change, unprompted.
