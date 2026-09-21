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
that, rather than a stringification of itself.

## A sentence about a Provider is not a quote of one

**All three fallbacks already travel under `wrote: "provider"`, and that is not the contradiction it
looks like.** [[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]] decides `wrote` by WHICH
BOUNDARY refused, and no boundary refuses a silent throw — so "the provider failed without saying
why." is CanonCore's sentence carrying the Provider's attribution, and so is
[[0176-saying-nothing-and-saying-nothing-showable-are-two-sentences]]'s second one, and so is this
record's third.

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

`wordsOf` returns `string | undefined`, and the absent case is `undefined` rather than `""`.

**The empty string is a real answer on this path and already has two sentences waiting for it.** It
is what a silent `Error` and a thrown `""` both give, and `boundedOr` tells those two from a value
the strip emptied — which is the distinction [[0179-a-bound-that-empties-a-value-says-so]] exists to
keep. Returning `""` for a value that never spoke would fold this branch back into that question and
put ADR-0176's conflation into a third spelling: a page would say a Provider said nothing about a
value that was never a message.

## The sentence does not name the value, and every repair that does is worse

`"the provider failed with something that is not a message."` reports what happened and stops, which
is CNCORE-92's rule that a refusal reworded is not a refusal reported.

**Naming the value is what `String(spoke)` did, and the smaller spellings of it land on the same side
of the line above.** `typeof` puts "object" on the page, which is CanonCore's vocabulary in a
Provider's voice and gives the Owner nothing to act on. `JSON.stringify` puts the value back, in
another notation. And `${spoke}` **throws**: measured on node v24.19.0, interpolating a thrown symbol
raises `TypeError: Cannot convert a Symbol value to a string`, inside the function whose whole job is
to turn a throw into a sentence. `String()` is the one spelling that does not, so the hazard arrives
with the obvious improvement rather than with what is here — and a symbol is in the witness's
population for that reason rather than because anybody expects one.

## What this does not cover

**A cross-realm `Error` reads as wordless, and that is a change rather than an oversight.** Measured:
an `Error` built in a `node:vm` context answers `false` to `instanceof Error`, and `String()` gave it
`"Error: boom"` — words, which the Owner no longer gets. It is unreachable here: nothing in this app
runs a provider fetch in a second realm, and undici's rejections are same-realm.

**The repair for it would split the file's answer to "what is an error" in two.** `unwrapped` already
asks `instanceof Error` to walk the `cause` chain, so a cross-realm error was ALREADY neither
unwrapped nor read for a nested reason; loosening `wordsOf` alone — to anything with a string
`message` — would leave one function saying a value is an error while the other beside it says it is
not. It would also admit any object carrying a `message` property as a message, which is the guessing
this record removes.

**`failed()` in `client.ts` is a different site and CNCORE-308 carries it.** It builds its sentence
from a response body rather than from a thrown value, so nothing here reaches it.
