---
status: accepted
---

# An identifier a record names is checked against what this tree once held

A record naming one of this repository's own symbols is naming something that can be renamed out
from under it, and nothing reported the break. ADR-0119 said a Listing's letter "is on
`filedByNameInput`" for months after CNCORE-175 renamed that input `browsedInput`, and it read as
though it named something the whole time. That is the shape
[[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]] is a victim of rather than an
author of, and it is the shape `doc-line-citations.test.ts` already guards one step over: a pointer
that stays syntactically fine while becoming false.

**`adr-identifiers.test.ts` holds it.** A backticked camelCase identifier a record names, which this
tree's history held in source and its tree no longer does, is a defect unless the record is named in
that check's exception map with the reason.

## The obvious rule is the wrong one, and the measurement is why

"Every backticked identifier a record names resolves in the code" reads well and is false. Measured
over the whole corpus on 2026-09-20: the records name **367** distinct camelCase identifiers, **57**
of which do not resolve, and **47 of those 57 were never ours.** Plex's `playQueueItemID`,
schema.org's `bestRating`, Next's `transpilePackages`, Biome's `noUnnecessaryConditions`, Drizzle's
`folderMillis`.

A record names those because `CLAUDE.md` asks it to: "Study how established products solve the
problem before designing a solution." **A check demanding they resolve would demand this repository
reimplement every product it learned from**, and the alternative — 47 entries naming another
product each — would tax every future record for doing what the principle asks.

**So the population is what this tree itself once held, asked of git rather than of a list somebody
maintains.** That is `adr-numbering.test.ts`'s own reason in its own words, "a record added without
touching this file is still covered". An identifier the history holds in source and the tree does
not was OURS and is GONE, which is the one reading under which naming it is a claim that has quietly
stopped being true.

**It earned its place on the first run.** CNCORE-246 was filed naming `filedByNameInput` alone; two
independent auditors and a `/verify` pass over that same record all missed `pastTheRow`, which
ADR-0119 asserted in the present tense at two sites while `packages/db` had called it
`pastTheRowIn` since CNCORE-175.

## What it cannot decide is TENSE, and that is why there is a map rather than a rule

A record correcting itself in place MUST be able to say what it used to claim. `CLAUDE.md` asks for
exactly that — "Put the correction in the sentence it corrects" — and
[[0122-a-provider-declares-the-credential-it-needs]] carries a whole dated section that CNCORE-246
was told to leave alone because correcting it would erase a measurement.

So "**`globalDependencies` WAS REFUSED**" and "the reads were `thePlaceIn` and `stillHasAPlaceIn`
until CNCORE-224" are CORRECT sentences naming a gone symbol. **No pattern separates them from a
stale one without deciding prose by regex**, which is the question `doc-line-citations.test.ts`
refuses to decide in its own words: it "bans the form rather than checking the quote". Eight are
named with a reason each, and **each was opened and read rather than taken from the tool**: the
first draft of that map trusted the pickaxe and was wrong about `containerDeletedAt`, whose sentence
reports the removal rather than asserting the symbol.

**The map is expected to grow, and slowly** — one line per record that correctly remembers its own
past. That is the standing cost, stated rather than discovered, against a defect class that outran
three passes on the record where it was already being hunted.

## What it does not cover, said here rather than left to be found

**PascalCase is out.** `Item`, `Container`, `Placement` and `Group` are `CONTEXT.md`'s words and sit
in backticks as prose constantly; a rule reaching them would be reading the glossary, not the code.

**AN INVENTED NAME PASSES SILENTLY**, and that is the cost of scoping to history
rather than to the tree. A symbol a record misspells, or names that never existed
anywhere, was never ours and never foreign either, so nothing distinguishes it
from Plex's `playQueueItemID` -- it reads as true exactly the way the defect this
record is about does. What is bought with that is a check nobody has to feed: the
alternative populations were a 47-entry map of other products' APIs, or a rule
that taxes every record for studying one.

**It reads `docs/adr/` alone**, not `CONTEXT.md`, the README or `docs/research/`. The README carried
this same defect under CNCORE-246 and is not covered here.

**It needs the history, so it refuses a shallow clone** rather than answering "never ours" to
everything and passing having read nothing. `ci.yml`'s `test` job sets `fetch-depth: 0` for it.

**It is the fifth copy of the `git ls-files` walk**, and
[[0136-a-control-is-a-primitive-and-a-surfaces-words-sit-beside-its-pages]]
folds at three. CNCORE-277 owns that fold and is not pre-empted here: the reads
genuinely disagree about comments and test files, so what they share is about
three lines.
