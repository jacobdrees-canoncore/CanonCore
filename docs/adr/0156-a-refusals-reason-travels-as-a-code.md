---
status: proposed
---

# A refusal's reason travels as a code, never as its sentence

A Server Action that reports a refusal reports it through the ADDRESS it redirects to, because with
no script loaded there is nowhere else for one to go: `useActionState` is a client hook, and
[[0066-one-address-one-page]] reads the four ways an action can end out of the installed Next and
finds no 400 among them. So the reason becomes a query parameter.

**It travels as a word from a closed set the SURFACE owns, and never as the procedure's own
message.** The page holds a sentence per word and writes every one of them.

## Why not the message, which is the obvious thing and the wrong one

The message is already written, already specific, and already in hand. Copying it into the address
costs one line and deletes a lookup table. It is still refused, for two reasons that are not about
tidiness.

**The address is the reader's to edit.** A query parameter is composed by anybody: a link in an
email, a paste in a chat, a bookmark somebody doctored. A page that prints what the parameter
carries is a page that will render a stranger's sentence in CanonCore's own voice, under CanonCore's
own styling, on CanonCore's own domain. [[0123-whose-words-is-the-reader-reading]] makes whose words
a reader is seeing the question this app answers at every seam, and this is that question at the one
seam where the answer is supplied by whoever wrote the URL. `/login` stated the rule first, of its
own parameter: "a value this page does not recognise says nothing, which is what keeps the parameter
from being a way to put a sentence of somebody else's choosing in front of a visitor."

**And a procedure's sentence is not the surface's to speak.** `settings/actions.ts` had already
written it down — "a procedure's message copied into an address is a sentence nobody owns". The
procedure answers an API caller and a log as well as a page, and those three want different words;
a message that has to serve all three serves the page worst, and changing it for the page breaks the
other two silently.

A closed set cannot say anything the page did not write. That is the whole of the property.

## The entry and the reason are two parameters

The value that was refused travels beside the reason rather than instead of it, which CNCORE-262
found by the only route that could have found it: one of the three refusals has a BLANK entry.

`oneValue` reads a blank parameter as an ABSENT one — rightly, since `?q=` and `?q=%20` are a box
somebody submitted without filling in — so `/settings?refused=%20` rendered nothing whatever. Every
step was correct and the outcome was the exact silence the surface existed to prevent. A value a
person typed can be blank; the word for what was wrong with it cannot. So they are two parameters,
in [[0066-one-address-one-page]]'s fixed order: `?refused=<what>&because=<code>`, which reads as the
sentence it is.

**The name is `because` on every surface.** CNCORE-255 and CNCORE-262 reached the pair independently
and spelled the second parameter differently; `CONTEXT.md` binds names in code and UI copy alike, and
two query parameters meaning one thing is a divergence nobody can see from inside either change.
Settled by the DISPATCHER on 2026-09-20, not by the Owner.

## What the app does today

Three surfaces report a refusal through an address, and all three carry a code:

| surface | parameter | closed set held by |
| --- | --- | --- |
| `/login` | `?refused=` | `app/login/refusal.ts` |
| `/items/<id>` | `?refused=<id>&because=` | `isAPlacementRefusalCause` (CNCORE-255, merged `5431ab0`) |
| `/settings` | `?refused=<entry>&because=` | `app/settings/refusal.ts` (CNCORE-262) |

`/login` carries the reason in `?refused=` itself and identifies nothing, because it has nothing to
echo: the value refused is a password. That is the same rule with one parameter rather than two.

Of the two that DO echo a value, only `/settings` bounds it; `/items/<id>` echoes a uuid, whose
length it does not check either. CNCORE-281 holds that half.

## As built, under CNCORE-262: the rule is whole where a reason travels, and eleven refusals do not travel at all

**BUILT.** Every surface that puts a reason in an address puts a code there, and each holds it to a
closed set on the way back in. CNCORE-262 added the third and corrected the second's name to match.
Two properties came out of writing it that the record above would not have predicted:

- **A closed set needs a catch-all, or it reintroduces the silence.** `/settings` matched three codes
  and the procedure could answer a fourth — the stored setting failing to parse, which is not about
  what the Owner typed. Three branches with no fall-through redirected NOWHERE, which is the original
  defect wearing the fix for it. Found by review, not by the tests. A surface adopting this rule owes
  a branch for "a refusal this page cannot name" before it owes anything else.
- **The set the surface admits is not the set the procedure raises.** `@canoncore/providers` raises
  three; `/settings` renders four. The fourth is the surface's own word for a refusal that was not
  about the reader's text, so the two sets are related by a total function rather than equal, and the
  type holds that rather than a comment.

- **The closed set holds the REASON and nothing holds the VALUE, unless something is made to.**
  `?because=` is admitted from three words; `?refused=` is the Owner's own text and cannot be, since
  the whole point is to echo it. So the second parameter needs the other half of ADR-0123 — a
  CEILING — and it needs it at the READ rather than at the redirect, because an address somebody
  typed by hand never passes through the Server Action that builds one. `TheirWords` does not
  supply it: that component settles WIDTH, and says of itself that it does not "quote, bound or
  attribute". **A surface adopting this rule owes a bound on the echoed value as surely as a closed
  set on the reason, and the two are separate rules about separate parameters.** Raised by the
  DISPATCHER on 2026-09-20 against CNCORE-262's own PR, which had argued the case for the reason and
  left the value beside it open. CNCORE-268 reached the same need within the hour from the other
  end — bounding a Container id inside the refusal that names it — and published `shortenTo` from
  `@canoncore/providers` for it, so the cut was already shared by the time this landed and only the
  ceiling had to be chosen beside the sentence it bounds.

**NOT BUILT.** The rule governs a reason that travels; it says nothing about the refusals that never
set out. **Eleven call sites end `if (refused) return;`** and report through the page's re-read
alone — four in `app/groups/actions.ts`, six in `app/items/actions.ts`, one in `app/login/actions.ts`.
That is `answer.ts`'s documented pattern and is right wherever the re-read actually shows what
happened: the Group that is gone is gone from the list. It is NOT right wherever a re-read renders
identically to a refusal, which is the case `settings/actions.ts` was written to name and the case
CNCORE-262 found by hand rather than by any check. **Nothing has audited those eleven for it.**

So the record stays `proposed`. Its mechanism is whole for the surfaces that report through an
address and untested against the ones that do not, and `accepted` would claim the second.
