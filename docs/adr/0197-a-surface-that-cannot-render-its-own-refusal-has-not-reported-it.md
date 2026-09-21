---
status: accepted
---

# A surface that cannot render its own refusal has not reported it

> **ACCEPTED 2026-09-21, for CanonCore. It was PROPOSED and HALF BUILT for a day.** The Providers
> half landed with CNCORE-326: `/settings`' action carries a fall-through to `REFUSED.unreadable`,
> `settings.read` answers an unreadable Providers setting instead of throwing it, the page renders
> that state as a third thing rather than as an empty list, the closed set grew a fifth word for a
> refusal this page cannot name, and `apps/web/e2e/settings-page.test.ts` reaches the action's half
> through the instance's own database. **The ALLOWLIST half is built too, under CNCORE-329**, which
> is the sentence this banner carried in the negative: `parseAllowlist` threw out of the same
> `read`, and it now answers a union of its own, with the page naming WHICH of the two settings it
> cannot read. [[0199-a-stored-setting-that-will-not-parse-must-not-remove-the-surface-that-repairs-it]]
> carries the general rule both halves turned out to share, and the half neither of them had: a
> control that still works in the state the refusal names. This record's number was assigned by the
> dispatcher.

[[0156-a-refusals-reason-travels-as-a-code]] settles how a refusal's reason gets from a Server Action
to a reader: as a word from a closed set the surface owns, in the address the action redirects to,
with the page holding a sentence per word. That record is right and nothing here reopens it.

**What it does not say is that the page has to be able to render.** It reasons about the address and
about whose words are shown, and takes the destination for granted — reasonably, because every
refusal it was written for is about what the READER TYPED, and a page is not in the state of a
reader's bad input. The fourth refusal on `/settings` is not one of those, and that is the whole of
the difference.

## The refusal that is about the instance is the one the instance cannot report

`/settings` renders four refusals. Three are about the Owner's own text — nothing typed, several
typed, an entry that is not a URL — and one is not: `setting-unreadable`, raised when the Providers
ALREADY STORED do not parse, so there was no list to add one to.

That fourth names a state of the instance. And the page's own read is inside it:

```ts
// apps/web/src/app/settings/page.tsx, before CNCORE-326
const { providers, allowlist } = await call(appRouter.settings.read, {}, { context });
```

```ts
// packages/api/src/routers/settings.ts, before CNCORE-326
providers: await reachProviders({
  baseUrls: parseProviderUrls(configured.providerUrls),   // throws on exactly that state
  ...
```

**MEASURED 2026-09-21** by calling the procedure in-process with `providerUrls` set to `wiki.test`,
which is the fixture `settings.test.ts` already used for the write half:

| | what came back |
| --- | --- |
| `isSuccess` | `false` |
| constructor | `OutboundRefused` |
| `code` | `undefined` |
| `status` | `undefined` |

So it was not an `ORPCError` at all. `answer.ts` reads a refusal off `error instanceof ORPCError &&
error.status < 500`, and would have rethrown this even if a caller had asked it to look; `apps/web`
has no `error.tsx` or `global-error.tsx` anywhere in the tree; and this read is the FIRST thing the
page does after the session check. The Owner did not lose the list. They lost the page.

**So the catch-all's destination could not render the sentence the catch-all exists to show.** Adding
the fall-through alone would have redirected an Owner from a form that said nothing to an error page
that said something worse, and the ticket's own criterion — that the copy must not exist for an
unreachable case — would have read as met from the diff.

## The rule

**Where a refusal's reason names a state of the INSTANCE rather than of the reader's input, the
surface owes two things and not one: a writer for the reason, and a read that survives the state the
reason names.** Only the first is visible in the action. The second is in a procedure the action
never touches, which is why a review of the action alone cannot find it, and why review found the
missing branch here and not the missing page.

A refusal about the reader's text needs only the writer: the page is not in the state of a bad entry,
so the destination renders either way. That is every refusal [[0156-a-refusals-reason-travels-as-a-code]]
was written against, and it is why the gap is invisible from inside that record.

## A third state is a union, not an empty list

`settings.read` now answers `{ kind: "read", named: [...] } | { kind: "unreadable" }`.

The obvious alternative is to catch the parse, report no Providers, and let the page's existing empty
branch speak. It is refused for the reason
[[0121-an-instance-names-its-providers-beside-the-allowlist-that-admits-them]] makes the surface pay elsewhere: the page's
sentence for an empty list is "No Provider is named, so this instance searches none", which is what a
FRESH instance says. Told to an Owner whose Providers are stored and unreadable it is the likelier
reading of the two and the false one, and it points them at naming a Provider — the one action that
cannot work, because `nameProvider` parses the stored string before it parses the entry.

**And the union is what makes the page handle it.** This defect is a fourth outcome with no branch;
a union is the one shape where a fourth cannot be forgotten, because a page that ignores it fails to
compile. `refusal.ts` already argues exactly this for the codes it holds against `WhyNotNamed`, and
the compile error is how the page change in CNCORE-326 was found rather than remembered: the type
named `page.tsx:123` before anybody looked for it.

The allowlist is answered as before, from the stored string with no parse in the way. Two settings,
neither derivable from the other (ADR-0121), and a read that refused wholesale would take away the
one control still working over a fault in the setting beside it.

**AND THE ALLOWLIST IS A UNION OF ITS OWN SINCE CNCORE-329**, carrying the Owner's text in BOTH
arms, because the box that repairs an unreadable allowlist is the box that renders it. The sentence
above is about this read not refusing WHOLESALE, which still holds; what it did not say is that the
allowlist's own parse was still in the way, one arm over.

## The witness has to go round the surface, and that is why there was none

This is the part worth carrying forward, because it is why the refusal reached `main` with no
assertion on it at all.

**Every settings write parses before it stores.** That is deliberate and ADR-0121's own arrangement:
what the surface accepts is exactly what a configured instance can read back. The consequence is that
**the state the fourth refusal exists for is one no route through the app can produce.** A test with
only the surface cannot arrange it. `settings-page.test.ts` said so in its own docblock — "reaching
the action's half needs a stored setting this surface refuses to write" — and stopped there, asserting
the page's half by driving the address by hand.

That concession is how the defect survived. The sentence was declared in `refusal.ts`, rendered by
`page.tsx`, and addressed by hand in that one test, so a tree-wide grep found three mentions and no
writer, and every one of them looked like coverage.

**The way in is the ROW.** `anInstanceServing` now hands back its `databaseUrl` alongside its handle,
`global-setup.ts` provides it as `configurableDatabaseUrl`, and the witness writes `providerUrls =
"wiki.test"` straight into the instance's own database before posting the form — which is also how an
instance actually arrives in this state: a hand-edited database, a restored dump, a value written by
something older than the parse. It puts the row back in a `finally`, because the rest of that file
reads the Providers this instance names.

**A refusal raised for a state its own surface refuses to create is unassertable from that surface,
and the fixture must write the state directly.** Where that is declined, what is left is copy nobody
can reach and a branch nobody has run.

## A catch-all that names a cause is not a catch-all

The first pass of this ticket redirected EVERY unmatched refusal to `?because=setting-unreadable`,
and that is wrong in a way worth recording, because it reads as the fix.

`setting-unreadable` names a CAUSE. The page writes a specific, actionable sentence for it: *this
instance cannot read the Providers it already has.* Used as the fall-through, that sentence is
asserted of every refusal the procedure can raise — and `ownerProcedure` raises one that is nothing
of the kind. `ORPCError("UNAUTHORIZED")` carries **status 401** (measured), and `answer.ts` reads
anything under 500 as a refusal, so a session that expired between the GET and the POST arrived at
the fall-through exactly as an unreadable row does. The Owner would be told their stored Providers
could not be read: false, and it hides the remedy, which is to log in.

**This is CNCORE-262's own defect, rebuilt inside the branch that was added to close it.** That
ticket exists because one sentence covered three mistakes with three different remedies; a catch-all
carrying a specific sentence covers unboundedly many.

So the two are separated. The code that means the setting gets the sentence about the setting, and a
fifth word — `unexplained` — carries the residue and says only that the entry was not named and that
this instance did not say why. ADR-0156 asks for "a branch for a refusal this page cannot name", and
the test of such a branch is that it names none.

**It was invisible, which is the point.** `SettingsPage` answers a caller with no session with
`NotLoggedIn` before it reads `?because=` at all, so the false sentence rendered nowhere and every
assertion about the page's TEXT passed either way. The witness for it asserts the ADDRESS, and the
address is what a reload, a Back or a bookmark keeps. Found by review on this ticket's own first
pass — the same way CNCORE-262's missing fall-through was found, and one record later.

**And the `?:` chain that rendered the clause was the same hazard.** It ended in an `else` holding
"it is not a URL", so a word added to the closed set with no branch did not fail to compile: it
rendered as whatever the last arm happened to be, telling an Owner to add a scheme to an entry that
had one. It is a `switch` with a `never` default now, checked by deleting a case — `Type
'"not-a-url"' is not assignable to type 'never'`.

## The assertion is on the ADDRESS, not only on the sentence

The witness holds `Submitted.url` — where the response landed after the redirect — as well as the
rendered text. That is not belt and braces. Once the page reports an unreadable setting in its
Providers section, **the sentence alone no longer distinguishes the fixed action from the broken
one**: a silent fall-through re-renders `/settings`, and that page now says the setting cannot be
read for its own reasons.

Checked rather than reasoned. With the fall-through removed, the witness fails on

```
AssertionError: expected 'http://127.0.0.1:59053/settings' to contain 'because=setting-unreadable'
```

— the bare address of a redirect that never happened — while every assertion about the sentence went
on passing. A sentence-only witness would have been green over the defect it was written for.

## What this costs, and what it does not

`settings.read`'s output is a shape an API caller reads, and this changes it. That is accepted: "the
Providers setting does not parse" is a real answer to "which Providers does this instance reach", and
the OpenAPI document a caller reads should be able to say it rather than the caller discovering it as
a 500. Every reader moved and the typechecker named each one: four assertions in `settings.test.ts` and
the page itself.

**What it does not do is give the Owner a way out.** `nameProvider` and `removeProvider` both parse
the stored string first, so both refuse while the row is bad, and the page can now say so without
offering a repair. CNCORE-331 holds that, and the page's own sentence states the position plainly
rather than pointing at a control that would refuse.

**IT DOES NOW, AND THE SENTENCE ABOVE IS WHAT CNCORE-331 CLOSED.** The Providers section renders a
textarea where it cannot render a list, `settings.editProviders` parses what is SUBMITTED and never
what is stored, and the page's sentence points at it. The two writes named above still refuse while
the row is bad and that is unchanged — the way out is a third write rather than a loosening of
either, so the parse-before-store rule
[[0121-an-instance-names-its-providers-beside-the-allowlist-that-admits-them]] puts on every
settings write is untouched.
[[0199-a-stored-setting-that-will-not-parse-must-not-remove-the-surface-that-repairs-it]] has the
argument, including why the Allowlist had never had this defect and the Providers had.
