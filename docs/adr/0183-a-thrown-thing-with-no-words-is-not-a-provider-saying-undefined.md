---
status: accepted
---

# A thrown thing with no words of its own is not a Provider saying `undefined`

`reasonFor` reads whatever a `catch` caught, which is typed `unknown` because nothing upstream
narrows it. Until CNCORE-307 it asked one question of that value —
`spoke instanceof Error ? spoke.message : String(spoke)` — and **`String` was answering for two
inputs that are not the same input.**

Measured on node v24.19.0:

| thrown | what the Owner read |
| -- | -- |
| `undefined` | `undefined` |
| `null` | `null` |
| `{}` | `[object Object]` |
| `42` | `42` |
| `[]` | `""`, so it reached the sentence for a Provider that said nothing |

Three of those are **CanonCore's spelling of a value**, handed to the Owner under
`wrote: "provider"`. CNCORE-96 binds every reason surface to the opposite — the Owner reads a
Provider's text "as a Provider's claim rather than as CanonCore speaking" — so a page rendering
`undefined` in a Provider's voice says the Provider used that word. It did not.

So there is a fourth answer: a value that is neither an `Error` nor a string gets a sentence saying
that, rather than a stringification of itself. It is the **third fallback sentence** — the other two
are [[0176-saying-nothing-and-saying-nothing-showable-are-two-sentences]]'s — and the fourth of
`reasonFor`'s answers, counting the quoted message it exists to carry.

## A sentence about a Provider is not a quote of one

**All three fallbacks already travel under `wrote: "provider"`, and that is not the contradiction it
looks like.** [[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]] decides `wrote` by WHICH
BOUNDARY refused, and no boundary refuses a silent throw — so "the provider failed without saying
why." is CanonCore's sentence carrying the Provider's attribution, and so is ADR-0176's second one,
and so is this record's third.

**The line is that each of those is a sentence ABOUT a Provider and none of them is a QUOTE of one.**
A page may print a sentence about a Provider in a Provider's voice: it reads as a report of what
happened, which is what it is. `undefined` is not a sentence about anything. It reads as a word
somebody used, and the only party the field offers as having used it is the Provider. That is the
whole defect, and it is why the repair is a sentence rather than a better stringification.

## A thrown string is the Provider's own words, and `String` was right about it

`throw "rate limited"` is legal, and the string is a sentence the thrower wrote. Quoting it verbatim
— bounded on [[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]]'s two levers, like any other
stranger's text — is exactly what this function is for.

**So the repair is not "stop calling `String`", it is "stop calling it on the input that has no
words".** A fix that sent every non-`Error` to the new sentence would compile, pass every other
assertion in `reason.test.ts`, and quietly stop quoting a Provider that spoke. The witness for the
string branch exists because that repair is the plausible one, and it was checked by deleting the
branch it names ([[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]]): removing it
reds two tests.

## `undefined` rather than the empty string, because the empty string is already taken

`wordsThrown` returns `string | undefined`, and the absent case is `undefined` rather than `""`.

**The empty string is a real answer on this path and already has two sentences waiting for it.** It
is what a silent `Error` and a thrown `""` both give, and `boundedOr` tells those two from a value
the strip emptied — which is the distinction [[0179-a-bound-that-empties-a-value-says-so]] exists to
keep. Returning `""` for a value that never spoke would fold this branch back into that question and
put ADR-0176's conflation into a third spelling: a page would say a Provider said nothing about a
value that was never a message.

## The sentence does not name the value, and every repair that does is worse

`"the provider failed with something that is not a message."` reports what happened and stops, which
is CNCORE-92's rule that a refusal reworded is not a refusal reported.

**Naming the value is what the old line did, and the smaller spellings of it land on the same side of
the line above.** `typeof` puts "object" on the page, which is CanonCore's vocabulary in a Provider's
voice and gives the Owner nothing to act on. `JSON.stringify` puts the value back, in another
notation. And `${spoke}` **throws**: measured on node v24.19.0, interpolating a thrown symbol raises
`TypeError: Cannot convert a Symbol value to a string`, inside the function whose whole job is to
turn a throw into a sentence. `String()` is the one spelling that does not, so the hazard arrives
with the obvious improvement rather than with what is here — and a symbol is in the witness's
population for that reason rather than because anybody expects one.

## The question is shared; the sentences are not (CNCORE-310)

**The same line stood at a second `reasonFor`, in `@canoncore/tasks`' registry**, spent as the
`detail` a run leaves in its history and printed by `tasks/page.tsx` as the sentence a reader reads.
A task that threw `undefined` left the WORD `undefined` there. Found reviewing CNCORE-307, filed as
CNCORE-310, and folded into the same pass because it is one reason to change rather than two.

**What the two sites share is the QUESTION and not the answer.** "What words does this thrown thing
have, if any" is one question with one correct answer. What they do with it differs all the way
down: one returns `{ wrote, text }` and reports a Provider under ADR-0123's attribution, the other
returns the sentence a run left behind; they carry different nouns, different ceilings, and
different punctuation. Folding the SENTENCES would have meant one voice for two surfaces, which is
the defect [[0176-saying-nothing-and-saying-nothing-showable-are-two-sentences]] and
[[0179-a-bound-that-empties-a-value-says-so]] both refuse.

**So `wordsThrown` is published from `@canoncore/text` and each caller keeps its own words.** That is
this repository's existing split rather than a new one: `holdsUnshowable` already sits in that leaf
as a question while `UNSHOWABLE`'s own docblock rules that the noun belongs to whoever knows what the
value is.

**The leaf is the only place it could go, and that was decided before this.**
[[0163-the-levers-that-bound-a-strangers-text-live-in-a-leaf]] turned down exactly the import the
alternative needs — `@canoncore/tasks` reaching into `@canoncore/providers` for a string function,
taking an HTTP client, two undici dispatchers and [[0034-two-outbound-boundaries]]'s boundaries with
it.

## A fix at one function is undone by a caller that pre-wraps it (CNCORE-307)

This is what the work taught that nothing had written down, and it was caught in review rather than
by the change itself.

**`searchProviders` wrapped every non-`Error` before `reasonFor` could see it.** Its `catch` stored
`new Error(String(thrown))`, so a wordless throw reached `packages/api`'s `reasonFor` ALREADY an
`Error`, with the word `undefined` as its message — and the branch this record adds could never fire
on `provider.search`, which is one of the two surfaces
[[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]] was written for. Measured before the
repair: the composition returned `"undefined"`.

**The wrap's own argument was the limitation this record removes.** It existed so that
`reason.message` would be "a sentence a caller can show, whatever a provider's client library decided
to throw" — but `reasonFor` takes `unknown` and now has words for the case, so the wrap was buying
nothing and costing the distinction. It is gone, and `FailedProvider.reason` is `unknown`.

**The general shape is worth keeping in mind at the next one of these.** A branch added to a leaf
function is only as reachable as its callers allow, and a caller that NARROWS a value by rewriting it
disables the branch silently — nothing fails, and the surface keeps answering the way it always did.
Grepping for the function's name would not have found this; what found it was asking which callers
change the value's SHAPE before the call.

## What this does not cover

**A cross-realm `Error` reads as wordless, and that is a change rather than an oversight.** Measured:
an `Error` built in a `node:vm` context answers `false` to `instanceof Error`, and `String()` gave it
`"Error: boom"` — words, which the Owner no longer gets. It is unreachable here: nothing in this app
runs a provider fetch or a task in a second realm, and undici's rejections are same-realm.

**The repair for it would split the file's answer to "what is an error" in two.** `unwrapped` already
asks `instanceof Error` to walk the `cause` chain, so a cross-realm error was ALREADY neither
unwrapped nor read for a nested reason; loosening `wordsThrown` alone — to anything with a string
`message` — would leave one function saying a value is an error while the other beside it says it is
not. It would also admit any object carrying a `message` property as a message, which is the guessing
this record removes.

**No end-to-end witness drives a wordless throw through `provider.search`.** Nothing reachable
through undici throws one, so arranging it would take a stub of the client rather than a provider,
and the assertion would then be about the stub. What holds that surface is the deleted wrap and the
`unknown` on the field, plus the witness at `reasonFor` itself. This sentence is here rather than a
demonstration nobody ran.

**`failed()` in `client.ts` is a different site and CNCORE-308 carried it.** It builds its sentence
from a response body rather than from a thrown value, so nothing here reaches it. [[0186-a-failure-body-nobody-can-show-is-reported-rather-than-omitted]] closed it, and
took one thing out of this record with it: the `unknown` on `FailedProvider.reason` left two comments
claiming a consumer that reads `reason.message`, and `asError`'s deletion is why nothing does.
