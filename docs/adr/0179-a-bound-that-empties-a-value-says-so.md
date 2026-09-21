---
status: accepted
---

# A bound that empties a value says so, in one phrase everywhere

> **ACCEPTED 2026-09-21, whole, in one repository.** `quotedTo` and `unshowable` in
> `packages/text/src/index.ts` hold the phrase "made only of characters that cannot be shown", and
> every caller that bounds a stranger's value reaches one of them: the repeat's refusal
> (`packages/db/src/import-runs.ts`), the overlong-id refusal (`packages/api/src/routers/provider.ts`),
> `theQueryQuoted` at `/search` and `/import` (`apps/web/src/components/query-params.ts`),
> `theEntryRefused` at `/settings` (`apps/web/src/app/settings/refusal.ts`), a task's `detail`
> (`packages/tasks/src/registry.ts`) and the "holds no Container at" refusal
> (`packages/api/src/routers/provider.ts`). That is SIX sites in four packages, counted by grepping
> `boundedTo` AND `bounded` and reading each caller. A witness at each seam drives a value of only
> stripped characters and was checked RED first. `ID_IN_A_SENTENCE`'s two copies folded into
> `theContainerIdQuoted`; `REASON_MAX_LENGTH`, `QUERY_IN_A_SENTENCE`, `ENTRY_MAX` and
> `BOUNDED_DETAIL` stay where they were, and `@canoncore/text` still holds no ceiling. No provider
> repository is touched, so nothing is owed at a second one. **The six are this record's own sweep and
> not a standing total:** CNCORE-305 added three more sentences reaching `unshowable`, in
> `@canoncore/providers` — a package absent from the four above, and one this record's own "What this
> does not cover" had named as owing them.
> [[0176-saying-nothing-and-saying-nothing-showable-are-two-sentences]] carries those, so the
> enumeration is dated rather than corrected away.

[[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]] bounds a stranger's text on two levers,
and [[0163-the-levers-that-bound-a-strangers-text-live-in-a-leaf]] moved both into `@canoncore/text`
so every caller reaches them through one call. `boundedTo` strips the controls, collapses whitespace
and trims.

**A value made of nothing but those characters bounds to the empty string.** Every sentence built
around one then loses its subject:

```
 is listed twice, at positions 1 and 3
 is 256 characters, at position 1, and a Container id is at most 255
```

**A bound that empties a value is not a bound. It is a second defect wearing the first one's fix**,
and it is the case ADR-0123 cares most about: not the dangerous one, since nothing is re-ordered
once the controls are gone, but the UNACTIONABLE one.

## It is reachable at every site, not exotic

`trim()` does not remove U+200B, and nothing upstream of these seams does either:

- **The three id refusals.** `theContainerIdsIn` drops blank lines and `#` comments only, so a line
  of three zero-width spaces is a non-blank line that becomes a Container id and clears ADR-0160's
  255-character ceiling with 252 to spare. Listed twice it reaches the repeat's sentence; at 256 of
  them it reaches the overlong one; walked by `importNextContainer` against a Provider holding
  nothing at it, it reaches the third.
- **`theQueryQuoted` and `theEntryRefused`.** Both guard with `oneValue`, which tests
  `parameter.trim() !== ""` — so `?q=` and `?refused=` of three zero-width spaces are NOT blank by
  that test and arrive whole, off an address anybody can compose.
- **A task's `detail`.** What a task THROWS is written by whatever broke, and `tasks/page.tsx`
  renders the result as `{said} Ran {when}.`

## The answer was already in the tree

`reasonFor` in `packages/providers/src/reason.ts` met this shape: `bounded(message) || SILENT`,
where `SILENT` reports the silence rather than dressing it up — "the provider failed without saying
why." CNCORE-92's rule is that **a refusal reworded is not a refusal reported**, so these sentences
say the value could not be shown rather than printing nothing and leaving the reader to guess.

**It was half a precedent, and the half it was missing is the one this record is about** — it could
not tell a value that said nothing from one that said nothing showable, which is what the paragraph
under "What this does not cover" reported against itself. CNCORE-305 gave it a second sentence and
that line now reads `boundedOr(message, SILENT, UNSHOWABLE_REASON)`;
[[0176-saying-nothing-and-saying-nothing-showable-are-two-sentences]] carries it. CNCORE-307 then put
a guard in FRONT of that call rather than inside it, because a throw carrying no string at all
reaches none of these three questions —
[[0183-a-thrown-thing-with-no-words-is-not-a-provider-saying-undefined]]. The shape quoted
above is kept as what this record was written from rather than corrected away, because the argument
for `quotedTo` was taken from it.

## One phrase, six callers

**The phrase is "made only of characters that cannot be shown", and it lives in one place.** Six
sites across four packages owe the same sentence. Each composing its own `boundedTo(...) || "..."`
would ship ONE concept in six voices, which is a two-readings defect rather than a matter of taste —
a reader meeting "an unprintable id" on one page and "a query with no showable characters" on the
next has no way to know they are the same fact.

**"MADE ONLY OF" IS LOAD-BEARING AND MUST NOT BE SHORTENED.** A value that is PARTLY unshowable —
`249‮643` — is QUOTED, as `249643`, by the strip alone. This phrase is reached ONLY when the
whole value went. "An id of characters that cannot be shown" would name a class holding both and
tell the reader the wrong thing about which of their lines is at fault. It costs ten characters
against ceilings whose longest sentence measures 120, which is the cheap side of the trade. **A
witness in `packages/text/src/index.test.ts` goes red if it is shortened back**, because the next
reader to meet a long string is the one who shortens it, and a rule stated only in a record is not
one the tree enforces.

**The NOUN and the FRAME are the caller's**, because only it knows what the value is.
`boundedProse`'s argument that no house sentence fits every field is kept: what is shared is the
phrase, not the sentence.

**`quotedTo` for five callers; the sixth wraps it.** Five interpolate a value into a sentence they
wrote and need a bare noun phrase — "an id", "a query", "an entry". A task's `detail` IS the
sentence the page prints, so it calls `quotedTo` and adds a full stop when the answer is the
fallback, comparing against `unshowable("A detail")` rather than re-spelling the phrase. They are published side by side on
the same argument that publishes `shortenTo` beside `boundedTo`: a fork in the road needs the
doc comment saying which way each caller goes.

**Absent and unshowable stay two answers.** `theEntryRefused` still returns `undefined` for an
absent parameter, because `WhichEntry` renders that as "That entry" — a refusal that named nothing
is a different fact from one naming something nobody can print. For the same reason a task's empty
detail does not become `tasks/page.tsx`'s `?? "It said nothing."`: that tests for NULL, and a task
that threw zero-width spaces did not say nothing.

## The ceiling moved, which ADR-0163 said it would not

That record's "What moves, and what does not" says the LEVERS move and the CEILINGS do not, naming
`ID_IN_A_SENTENCE` in two files as staying where it was. **That half is superseded here, for that
value only.** The rest stands: `REASON_MAX_LENGTH`, `QUERY_IN_A_SENTENCE`, `ENTRY_MAX` and
`BOUNDED_DETAIL` do not move, and `@canoncore/text` still holds no ceiling.

The reason is ADR-0163's own evidence turned on its own remedy. It left the 80 spelled twice with a
docblock in each file telling the next reader it was "TAKEN RATHER THAN CHOSEN AGAIN" — **a copy
kept in step by a comment asking for it to be kept in step**, which is the exact instrument that
record proved does not work after watching its levers drift twice, in CNCORE-272 and CNCORE-274.
Adding a fallback would have made it two copies of three things rather than of one.

**`theQueryQuoted` is the precedent, and it is ADR-0163's own.** That record describes `/search` and
`/import` reading "the ceiling and both levers" from one function. `theContainerIdQuoted` is the
same shape for an id: one function, reached by both sites that print one. It lives in
`@canoncore/db` rather than in the leaf, because "an id" is domain vocabulary and `@canoncore/text`
depends on nothing and knows about no Containers; `@canoncore/api` already imports `beginImportRun`
and `ImportRunRefused` from that package, so the refusal and the words it may use arrive together.

## The count was five until it was six, which is this record's own evidence

**The first sweep here missed a site, and missed it the same way ADR-0163 did.** That record had to
add a paragraph about itself after a reviewer found two sites its list had not seen, and concluded:
**a count of `boundedTo`'s callers is not a count of the places that owe it.** This record then
grepped `boundedTo`, found five, and wrote "five" into the sentence above.

**The sixth reaches the levers through `bounded`**, the wrapper `@canoncore/providers` publishes for
a reason's 300. `oneContainerIntoTheCatalogue` built `That Provider holds no Container at
${bounded(containerId)}.`, so a grep for the lever's NAME could never find it. It is a refusal
quoting a Container id — the very thing this record is about — and it was reachable on the Owner's
own list, `containerId` being bounded by `z.string().min(1)` which three zero-width spaces satisfy.
Unpatched it read `That Provider holds no Container at .`

**It also quoted that id at 300 rather than at 80**, a third spelling of one rule, which is the
duplication `theContainerIdQuoted` exists to end. Folding it onto that function fixed both at once.

**The lesson is sharper than "grep harder".** A wrapper renames a mechanism, and a sweep that
searches for the mechanism's name finds callers of the name rather than callers of the mechanism.
The honest statement of coverage is therefore about what was READ, not what was matched.

## What this does not cover

**The other two callers of `bounded` were read and owe nothing**, recorded here so the next sweep
does not re-derive it:

- `packages/api/src/routers/provider.ts`'s `BrowseNotOffered` branch bounds a message built as
  `` `${name} declares no browse; it was not asked for one.` `` — fixed prose that cannot empty.
- `packages/providers/src/client.ts`'s `saidBy` can return `""`, and `failed()` already branches on
  it: `said === "" ? \`${answered}.\` : \`${answered}: ${said}\``. The empty case was handled at that
  seam before this record existed. **Re-read under CNCORE-305 and the exclusion stands for a better
  reason: that sentence OMITS rather than contradicts**, telling the Owner a status and nothing about
  a body. Its COMMENT infers "Said nothing" from `said === ""`, which is this record's conflation, so
  CNCORE-308 carries whether an unshowable body is worth a third branch.

`shortenTo` keeps its one caller, `shortly`, and owes these words nothing — **but not for the reason
that first went in here, which a reviewer refuted.** "No prose for the strip to act on" is not an
argument about `shortenTo` at all: that function never strips, it only cuts. What makes it safe is
arithmetic. `shortenTo` returns `""` only through `if (max <= MARKER.length) return MARKER.slice(0,
Math.max(0, max))`, which needs a ceiling of 0, and `shortly`'s `VALUE_MAX` is 80. So the guarantee
rests on its caller's number rather than on the shape of its input, and it would break if a ceiling
of 0 were ever passed. Written down because the wrong reason for a right conclusion is what survives
into the next record that cites it.

**Nothing in this tree reports a surface that prints a value it did not write**, so this list is
only ever as good as the last reading of it — and one reading of it was already wrong by one.
