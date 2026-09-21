---
status: accepted
---

# Saying nothing and saying nothing showable are two sentences

> **ACCEPTED 2026-09-21, whole, in one repository.** `boundedOr` in
> `packages/providers/src/reason.ts` asks `holdsUnshowable` which of the two emptied a value and
> answers with the caller's sentence for that one. Its two callers are `reasonFor` and
> `boundedProse`, and `boundedProse`'s two fields are `name` and `credential.label` in `cmpp.ts` —
> the THREE fallbacks [[0179-a-bound-that-empties-a-value-says-so]] named as stating the opposite of
> itself. Each carries a second sentence beside the one it had: `UNSHOWABLE_REASON`,
> `UNSHOWABLE_NAME` and `UNSHOWABLE_LABEL`, all three built from `@canoncore/text`'s `unshowable` so
> the phrase stays in one place. `holdsUnshowable` is published from that leaf, where it was
> private to `quotedTo`. A witness at each seam drives a value of only stripped characters and was
> checked RED first, and the sentence each replaced is now pinned EXACTLY where it was asserted by
> length alone. ADR-0179's "What this does not cover" loses the paragraph that named this work, and
> the two stale spellings of `reasonFor`'s old line — in `quotedTo`'s docblock and in ADR-0179's
> own "The answer was already in the tree" — are corrected in the sentences that carried them. No
> provider repository is touched, so nothing is owed at a second one.
>
> **THREE THINGS CAME OUT OF THE REVIEW AND ARE PART OF WHAT LANDED.** `holdsUnshowable` is that name
> because it is now EXPORTED and the old one overstated: it answers about the STRIP, is `true` for a
> PARTLY unshowable value, and means "the value went" only inside a guard its caller owns — pinned in
> `index.test.ts` rather than left in a docblock. The fallbacks' own ceiling is asserted, having been
> held by nothing. And `failed()` in `client.ts` keeps its exclusion while its COMMENT does not:
> CNCORE-308 — **which then took the exclusion off it too.** [[0186-a-failure-body-nobody-can-show-is-reported-rather-than-omitted]] answered the question deferred
> below and gave that site a third branch, so the fallbacks reaching `unshowable` are FOUR rather
> than the three this paragraph counts.

[[0179-a-bound-that-empties-a-value-says-so]] settled that **a value nobody can show is not a value
nobody sent**, and gave six callers one phrase for it. It also recorded, in its own "What this does
not cover", that three fallbacks in `@canoncore/providers` said the opposite — and that they were
the code it cited as its own precedent.

**Those three are not the same fix as the six, which is why they were not folded in.** The six had
NO words for the emptied case: each interpolated a value into a sentence it wrote, and the sentence
lost its subject. These three already had words. What was wrong is that the words were a claim about
a different input:

```
the provider failed without saying why.          ← a provider that DID say why, unshowably
a Provider that did not name itself              ← a Provider that DID name itself, unshowably
this Provider needs something, and did not say what.  ← it DID say what, unshowably
```

## Three answers where the code had two

`bounded` returns the empty string for a value that carried nothing AND for one made of nothing the
strip leaves, so `bounded(text) || whenSilent` is a two-branch expression over a three-way question.
Both callers here wrote that expression, separately, and both got the same thing wrong — which is
`reasonFor`'s own reason for existing, one seam up: `provider.search` and `provider.container` each
mapped its own catch, and each carried the same defect independently (CNCORE-68, then CNCORE-92).

So the question is asked in ONE function and the answers stay at the callers. `boundedOr` is that
function, and the split it keeps is ADR-0179's: **the phrase belongs to `@canoncore/text`, the frame
and the noun belong to the caller.**

## Both sentences are the caller's, and neither is defaulted

`boundedProse`'s existing argument was that no house sentence fits every field. It holds twice over
once there are two sentences per field, and the evidence is punctuation. `SILENT` and
`SAID_NOTHING` are whole sentences a page prints and end in full stops; `UNNAMED` stands in for a
NAME, is rendered where a name is rendered, and a full stop there would read as part of the name. A
default would have to pick one, and a field whose two answers are punctuated differently reads as
two voices — which is the two-readings defect ADR-0179 refused for the phrase itself.

**A FALLBACK IS NEVER BOUNDED BY `bounded`, WHICH NOTHING HAD ASSERTED.** `bounded` caps a
PROVIDER'S text; these three are this app's own sentences and go straight into a field the contract
declares `max(REASON_MAX_LENGTH)`. So one edited past the ceiling is a 500 at the output boundary --
the exact failure `SILENT` exists to prevent, arriving through the fix for it. The ceiling is now
asserted at all three rather than counted in prose here, which is ADR-0123's rule for the cap and
[[0153-a-figure-about-this-tree-is-derived-or-dated]]'s for a figure: `reason.test.ts` hands both of
`reasonFor`'s fallbacks to `failureReason` itself, and `cmpp.test.ts` holds each field's against
`REASON_MAX_LENGTH`. Checked by blowing the ceiling to 400 characters and watching it go red.

## The question moved to the leaf rather than the strip being spelled again

`holdsUnshowable` asks whether `CONTROLS` removed anything. It was private because `quotedTo` was
its only caller, and `quotedTo` is the wrong shape for these three: it answers with a bare noun
phrase or `""`, which suits a caller interpolating a value into a sentence of its own. A caller that
already owns both sentences needs the QUESTION, not either answer.

**`trim()` is not that question and U+FEFF is why**, which is the reason this reaches the leaf
instead of composing something locally. U+FEFF is whitespace to `String.prototype.trim` AND a member
of the zero-width family, so a guard spelled `text.trim() === ""` answers "nothing there" for
exactly the value these words exist to name. Spelling the test in `@canoncore/providers` would have
put a second copy of `CONTROLS` in the package ADR-0163 moved the levers OUT of, and that record's
own evidence is two copies drifting twice (CNCORE-272, CNCORE-274).

## What the cause chain taught, which nothing had written down

`unwrapped` takes the innermost link in a `cause` chain THAT SAID SOMETHING, and it asks `oneLine`
— which strips. So a link whose message is nothing but controls is passed over, and a wrapper's own
words stand:

```
new Error("fetch failed", { cause: new Error("​") })   →   fetch failed
```

**That is the right order and it is worth stating, because it looks like the same conflation and is
not.** `unwrapped` is choosing which link to QUOTE, and a link with nothing quotable is rightly
skipped in favour of one with words: `fetch failed` is a thin reason and still more than a sentence
about the absence of one. The new sentence is reached only when NO link in the chain had showable
words, which is the case where there is nothing better to say. A witness pins it, because the
obvious "fix" to it would make every wrapped failure read as unshowable.

## An assertion by length is not an assertion about a sentence

`reason.test.ts` asserted `text.length > 0` over a population of silent throws. That is what let the
defect sit under a test named for it: the wrong sentence is as non-empty as the right one.
[[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]] is the same argument, and the
strengthening here found something the ticket had not asked about — **`String(undefined)` is
`"undefined"`**, so a thrown `undefined` reaches no fallback at all and the Owner reads CanonCore's
spelling of a value in a Provider's voice. CNCORE-307 carried it and
[[0183-a-thrown-thing-with-no-words-is-not-a-provider-saying-undefined]] closed it with a THIRD
sentence beside this record's two; it was a different defect, because nothing was stripped.

## How far each of the three is reachable, which is not equally far

**The two schema sites are reachable from a manifest anybody can send.** `"name": "​​​"`
is valid JSON and satisfies `min(1)`, and so is the credential's `label`.

**`reasonFor`'s branch is reached through the `unknown` a `catch` holds, and not from any throw this
package writes.** Every `throw` in `@canoncore/providers` carries fixed prose, and `failed()`
prefixes a provider's body with words of its own — `${answered}: ${said}` — so nothing in
`client.ts` can hand it a message of only controls. What can is undici, the DNS layer, zod, or a
provider repo's own code. The witness therefore drives `reasonFor` directly rather than a live
Provider, and this sentence says so instead of implying a demonstration nobody ran.

## What this does not cover

**`failed()` in `client.ts` was read again, and the exclusion holds for the SENTENCE but not for the
COMMENT.** A body of only controls gives `said === ""` and the sentence stops at `${answered}.`, so
the Owner is told the status and not told there was a body. That is an OMISSION, not a contradiction:
nothing there asserts the Provider sent nothing, which is the claim this record exists to remove, and
it is why the site was not folded into a diff agreed for three. **The exclusion was right and it did
not last: [[0186-a-failure-body-nobody-can-show-is-reported-rather-than-omitted]] reports that body.** This paragraph's reading is kept rather than corrected away,
because that record is built on it — the omission is not a contradiction, and what it turned out to
be instead is a sentence whose absence the Owner had been taught to read.

**Its comment is another matter, and ADR-0179 did not read it.** `// Said nothing, so there is nothing
to introduce` sits on `said === ""`, and `said` arrived through `bounded` — so the premise is this
record's conflation, stated beside a line whose output happens to be merely incomplete. A wrong reason
for a right line is what the next change to that line reads, which is the argument
[[0179-a-bound-that-empties-a-value-says-so]] makes about its own refuted `shortenTo` paragraph.
**CNCORE-308** carried it, and with it the question this record did not decide: whether the Owner
should be told a body arrived that could not be shown, given that no body and an unshowable body
rendered identically. **The answer is yes**, and [[0186-a-failure-body-nobody-can-show-is-reported-rather-than-omitted]] has it: the two failures have different remedies,
and the Owner reached for the wrong one because the sentences were the same.

**Nothing reports a fallback that answers two inputs with one sentence**, so the count of them is
only ever as good as the last reading. ADR-0179 said as much about its own list, and was wrong by one
when it said it.
