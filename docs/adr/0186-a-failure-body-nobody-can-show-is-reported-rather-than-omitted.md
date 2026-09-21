---
status: accepted
---

# A failure body nobody can show is reported, because the omission was read as an absence

> **ACCEPTED 2026-09-21, whole, in one repository.** `failed()` in
> `packages/providers/src/client.ts` has three branches where it had two. `saidBy` is now
> `offeredBy` and returns `errorIn(text) ?? text` UNBOUNDED; `failed` bounds it, and where that comes
> back empty asks `holdsUnshowable` — published from `@canoncore/text` by
> [[0176-saying-nothing-and-saying-nothing-showable-are-two-sentences]] — which of the two emptied
> it. The third sentence is `${answered} with ${UNSHOWABLE_BODY}.`, built from that leaf's
> `unshowable` so the phrase stays in one place, and it is the FOURTH IN THIS PACKAGE to reach it,
> after `UNSHOWABLE_REASON`, `UNSHOWABLE_NAME` and `UNSHOWABLE_LABEL` — `reason.ts`, `cmpp.ts`
> twice, and now `client.ts`. **That is a count of this package, and no tree-wide figure is restated
> here on purpose.** ADR-0179's own sweep got that wrong twice, and this branch nearly did a third
> time: `@canoncore/tasks` reaches the phrase BOTH ways, directly and through `quotedTo`, so "sites"
> and "packages" do not divide the way a grep suggests. Two sentences in `@canoncore/text` still
> carry a figure counting the tree before CNCORE-305 — already stale when this branch started —
> and CNCORE-311 carries them, with a TODO at each, because the figure wants a READ rather than a
> grep.
>
> **Four witnesses in `client.test.ts`:**
> a plain body of only stripped characters, an `error` FIELD of them, an empty `error` beside an
> unshowable key that must still read as a silence, and the sentence's ceiling. The first was checked
> RED first; the other three passed on arrival and were each checked by deleting the behaviour they
> name ([[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]]). The paragraphs in
> ADR-0176 and [[0179-a-bound-that-empties-a-value-says-so]] holding this open, and ADR-0183's
> sentence deferring to it, are corrected where they stand. No provider repository is touched, so
> nothing is owed at a second one.
>
> **A STALE CLAIM WAS FOUND IN THE COMMENT BEING MOVED AND CORRECTED WITH IT.** The bound's own
> argument said this Error is "carried whole by `FailedProvider`, whose `reason.message` `search.ts`
> reads directly". Nothing reads it: `asError` went with ADR-0183, `reason` is `unknown`, and its one
> consumer — `provider.ts`'s `failed.map` — hands it to `reasonFor`. The argument SURVIVES, because
> it was always about the Error travelling whole rather than about who reads it, and the test that
> holds it asserts the Error's own message. The two copies of the dead clause, in `client.ts` and in
> `client.test.ts`, are corrected in the sentences that carried them.

[[0176-saying-nothing-and-saying-nothing-showable-are-two-sentences]] removed one conflation from
three sentences in `@canoncore/providers` and **left a fourth site standing, on a reason it stated
carefully**: `failed()`'s sentence OMITS rather than contradicts. `${answered}.` tells the Owner a
status and tells them nothing about a body, so unlike the three fallbacks it asserts nothing false.
That reasoning is why this was a separate ticket rather than a fourth site in CNCORE-305's diff, and
this record does not overturn it. It answers the question that record deferred.

## The omission is not neutral, because every other failure has a colon in it

The two remaining branches are `${answered}.` and `${answered}: ${said}`, so across a corpus of
failures **the colon is what a body looks like.** A reader who has seen a dozen of these has learned
that, and the learning is what turns the silent branch from an omission into a reading: the sentence
does not say "no body", but it is the sentence a reader has been taught means one.

That is weaker than the three fallbacks ADR-0176 fixed, and it is the whole of the difference
between this record and that one. Those said something false in their own words. This one says
nothing and is heard saying something, which is why it was worth a separate reading rather than a
fourth line in the same diff.

## Two failures, two next moves, and the Owner could not tell them apart

| the provider answered 500 with | what is wrong | what the Owner does next |
| -- | -- | -- |
| no body at all | it fell over before it could say anything | read the provider's own logs; CanonCore holds nothing more |
| three zero-width spaces | its ERROR PATH is producing garbage | find the serialiser that wrote them |

**The second is findable and the first is not, and the Owner reaches for the first remedy for both.**
That is [[0179-a-bound-that-empties-a-value-says-so]]'s own test for whether these words are worth
their characters — not the dangerous case, since nothing is re-ordered once the controls are gone,
but the UNACTIONABLE one — applied to a site that record had excluded.

**It is as reachable as the two schema sites ADR-0176 called reachable from a manifest anybody can
send.** A 500 whose body is `"​​​"` reaches it as itself, and `{"error":"​"}`
reaches it through `errorIn`. Both are ordinary JSON, and CMPP exists so that strangers can write
providers.

## Three frames, which is why this does not reach `boundedOr`

`boundedOr` in `reason.ts` is the one other place in this package asking this question, and ADR-0176
put it there on the argument that the two callers which had composed it separately had got it wrong
separately. **A third caller composing it again is the shape that record refused**, so not reaching
for it needs a reason rather than an omission.

The reason is that `boundedOr` collapses the three answers into a STRING. It can, because its two
callers put both of their answers in the same frame: `reasonFor` returns whichever sentence is true,
and `boundedProse` transforms a field into one. **This site has three FRAMES rather than two
sentences.** What it needs is the QUESTION, and the question is `holdsUnshowable` — which
`@canoncore/text` publishes for exactly this caller, its docblock saying so: *"published for the
callers that already have words for both answers ... what it is short of is the QUESTION rather than
either answer."*

**The guard is the caller's and that is the leaf's own design, not a copy of `boundedOr`.** That
docblock requires `holdsUnshowable` to be asked only once the bound has come back empty, and names
its two existing callers doing it by hand — `quotedTo` behind `if (quoted !== "")` and `boundedOr`
behind `bounded(text) ||` — *"because only the caller knows its ceiling."* `failed` is the third,
behind `if (said !== "")`, at the same ceiling `boundedOr` uses.

## The colon is not reused, and that is what makes it three frames

`${answered}: ${said}` introduces THE PROVIDER'S OWN WORDS. A sentence about a body nobody can show
is CanonCore's observation, and putting it after that colon would hand the Owner a phrase the
provider never wrote in the position its words go.

**`wrote` cannot draw that line here, because it draws it BETWEEN reasons and this is inside one.**
ADR-0123 decides attribution by which boundary refused, and ADR-0183's docblock spells out what
follows: the fallbacks travel under `wrote: "provider"` and are each *"a sentence ABOUT a Provider,
which a page may print in a Provider's voice"*. That is sound for a whole reason. It says nothing
about a clause sitting where a quotation goes, so the frame has to carry it: **`with` reports, `:`
quotes.**

## The question is about the string that was bounded, not the body it came out of

`offeredBy` returns `errorIn(text) ?? text`, and **that** is what both questions are asked of. The
obvious spelling asks the raw body, and it is wrong:

```
{"error": "", "note": "​"}   ← the provider wrote `error` and put nothing in it
```

The envelope holds a stripped character; the REASON does not. Asking the envelope tells the Owner
this provider's reason could not be shown when it gave none — this record's own conflation,
committed by its own fix. A witness pins it, and it is the one witness here that catches the
mutation: made to ask the raw body, it goes red alone while the other forty-seven stay green.

This is also why the bound moved out of `offeredBy` rather than the function being left alone. A
function that bounds answers the first question and throws away what the second needs.

## The sentence is asserted against its ceiling rather than counted here

151 characters at full stretch against `REASON_MAX_LENGTH`'s 300, derived 2026-09-21 — a path
`shortly` has cut to 80, a three-digit status, and a fixed clause of 57.

**The number is not what holds it, which is ADR-0176's lesson at this seam.** That record found the
three fallbacks' own ceiling *"held by nothing"* and asserted each. The failure mode here is
different and worse: `bounded` keeps the OPENING, so a sentence edited past the ceiling loses its
END — which is the entire clause saying a body arrived. It would read `answered 500…` and be this
defect again, arriving through the fix for it and wearing a truncation's marker. The witness drives
the longest sentence this site can produce and asserts `reasonFor` returns it uncut.

## What this does not cover

**The silent branch still answers three inputs**, and that is correct rather than deferred. A body
that was absent, a body of only ordinary whitespace, and a read that threw part-way all reach
`${answered}.` — the first because there was nothing, the second because a space is SHOWABLE and
`holdsUnshowable` rightly answers `false` for it ([[0179-a-bound-that-empties-a-value-says-so]]
keeps that split deliberately), and the third because a provider that died mid-body left no sentence
to quote. None of the three has a remedy the others do not.

**ADR-0176's claim that nothing in `client.ts` can hand `reasonFor` a message of only controls still
holds**, and was re-checked rather than assumed: all three branches now open with
`${shortly(path)} answered ${status}`, so every message this file throws has showable words in it.

**"MADE ONLY OF" IS LOOSE WHERE A BODY MIXED ZERO-WIDTHS WITH ORDINARY SPACES.** `oneLine` strips
the controls AND trims, so a body of `"  \u200b  "` empties and `holdsUnshowable` answers `true` —
and the Owner is told the body was made only of characters that cannot be shown when part of it was
spaces. **This is not new and it is not this record's to fix**: `boundedOr` has the same shape, so
`UNSHOWABLE_REASON`, `UNSHOWABLE_NAME` and `UNSHOWABLE_LABEL` all read the same way, and the phrase
is ADR-0179's. What the strict reading would need is a question distinguishing "the strip emptied
it" from "the strip and the trim between them emptied it", which is a change at the leaf and to four
sentences at once. Recorded here because the review found it and a reader of this record would
otherwise take "made only of" as exact.

**Nothing reports a sentence whose reader has learned to read its absence**, so the argument at the
top of this record is one somebody had to make by looking. It was made about `failed()` because
CNCORE-305's review pointed at it. No sweep has asked the same question of any other pair of
branches in this tree.
