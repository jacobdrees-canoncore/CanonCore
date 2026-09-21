---
status: accepted
---

# A stored setting that will not parse must not remove the surface that repairs it

> **ACCEPTED 2026-09-21, for CanonCore.** Both settings behind `/settings` are now parsed where the
> ANSWER can carry the refusal rather than in an expression that throws out of the read; the page
> says WHICH of the two it cannot read, including both; and each setting has a wholesale editor that
> parses only what is SUBMITTED, so a row no other write will touch is repairable from the page.
> CNCORE-329 and CNCORE-331, folded on this one rule. Its number was assigned by the dispatcher.

[[0197-a-surface-that-cannot-render-its-own-refusal-has-not-reported-it]] found half of this and
said so in its own banner: a surface owes a writer for a refusal AND a read that survives the state
the refusal names. It built that for the Providers setting and left the Allowlist, and it is the
LEAVING that turned out to be the interesting part. This record is the general rule the two halves
share, plus the half neither of them had: **saying a setting is unreadable is not the same as
letting the Owner do something about it.**

## The rule

**Where a stored setting can fail to parse, the surface that edits it owes three things:**

1. **A read that survives it.** The parse belongs where the answer can carry the refusal, never in
   the return expression, because a read is not a place a refusal can be reported from.
2. **A sentence naming WHICH setting**, where there is more than one.
   [[0121-an-instance-names-its-providers-beside-the-allowlist-that-admits-them]] accepts two
   settings for one concept on exactly that condition, and "both" is one of the answers it has to
   be able to give.
3. **A control that works in that state**, which means one that parses what is SUBMITTED and never
   what is stored.

The third is the one nothing had written down, and the first two are worth less than they look
without it.

## The Allowlist half was worse than the Providers half, and the arrangement was inverted

CNCORE-326 moved `parseProviderUrls` out of the return expression. It left `parseAllowlist` where it
was — inside the argument list of the call in the arm that runs when the Providers DO parse:

```ts
// packages/api/src/routers/settings.ts, after CNCORE-326 and before this record
named === undefined
  ? { kind: "unreadable" }
  : { kind: "read", named: await reachProviders({
      baseUrls: named,
      allowlist: parseAllowlist(configured.providerAllowlist),   // still throws, and only here
    }) }
```

**So the throw was reachable only where the OTHER setting was fine, which inverts the severity.** An
instance with both rows bad rendered the page; an instance with only the allowlist bad did not. The
worse state was the one that worked.

And the allowlist is the half that mattered more. CNCORE-326 went out of its way to keep the
allowlist readable when the Providers are bad, on the argument that its textarea "is the one control
on that page still worth using" — which is true, and is exactly why losing the page to the ALLOWLIST
was the costlier of the two.

**Both settings are asked independently now**, which is ADR-0121's own sentence arriving in the
handler: neither is derivable from the other, so neither parse may sit inside the other's arm.

## A reading is a fact about the PAIR, so the third state has no `reach`

`settings.read` answers the Providers section as three states rather than two:

| state | what it carries |
| --- | --- |
| `read` | every Provider, each with how far this instance got |
| `allowlist-unreadable` | every Provider, and no reading of any of them |
| `unreadable` | the stored string, for the textarea that replaces it |

The middle one is the one worth arguing about. Reaching a Provider means asking
[[0034-two-outbound-boundaries]]'s boundary first, so an allowlist that will not parse leaves the
LIST knowable and every READING of it unknowable.

**It is not a fourth `Reach`.** "This instance cannot read the boundary that admits anything" is
true of the instance, not of any one Provider: carried per row it renders as the same sentence
repeated down the page, and `@canoncore/providers` would hold a per-Provider shape for something no
Provider is involved in. It is not `not-admitted` either, which would be a lie — the allowlist has
not refused the host, it has failed to be read, and those send the Owner to two different places.

**The rows are still listed, and that is not decoration.** `removeProvider` parses the Providers
string and never the allowlist, so every row is live while the setting beside it is broken.

## The repair is a wholesale editor, and the Allowlist already proved it

CNCORE-331 asked which of three routes to take: a textarea for the Providers, a way to clear the row
outright, or a list rendering the unreadable entries so Remove can reach them.

**The answer was already in the product.** The Allowlist has never had this defect, for exactly one
reason: `editAllowlist` parses what is SUBMITTED and never what is stored, so a bad allowlist has
always been repairable from its own box. Every other settings write parses the stored string first —

```ts
export function nameProvider(configured: string, baseUrl: string): string {
  const named = parseProviderUrls(configured);   // the STORED value, before the entry
```

— and `removeProvider` opens the same way, so while the row is bad both refuse, and removing is the
one that would have repaired it. The asymmetry was the bug, and giving the Providers the Allowlist's
shape is the fix. The third route — marking unreadable entries so Remove can reach them — is a
second rendering of a string that by definition did not parse, which means guessing where its
entries are.

**The textarea renders INSTEAD of the list, never beside it.** A Provider is a source with an
identity ([[0031-a-provider-is-a-url]]), so a row with a Remove button is the right control for one
and this is no improvement on it. Rendering both would put two controls over one setting on one
page, each with its own Save, free to disagree about what it holds. Clearing the row outright is the
same control with an empty box, so that route is covered rather than refused.

**Parse-before-store is untouched, which was CNCORE-331's condition.** What the surface accepts is
still exactly what a configured instance can read back. What changed is only that the STORED value
is no longer parsed on the way in — and it never should have been, because it is the thing being
replaced.

## A refusal the surface cannot report is a refusal it did not have

`editAllowlist`'s action read like this:

```ts
await whatTheProcedureAnswered(
  call(appRouter.settings.editAllowlist, input, { context: await callerContext() }),
);
```

It did not bind `refused` at all. An Owner who typed a wildcard got the page back with the STORED
allowlist in the box, their edit gone, and no sentence about either.

**CNCORE-329 filed this as one of the eleven call sites
[[0156-a-refusals-reason-travels-as-a-code]] lists under "NOT BUILT". It is not one of them.**
Measured: `grep -rn "if (refused) return" apps/web/src` returns eleven, four in
`app/groups/actions.ts`, six in `app/items/actions.ts`, one in `app/login/actions.ts`, and none in
`app/settings/actions.ts`. This was a twelfth shape and a worse one. Those eleven report through the
page's re-read, which is right wherever the re-read shows what happened; a textarea reverting to the
stored value shows the OPPOSITE of what happened, and does it under a docstring in the same file
that forbids exactly this.

**The two rules a refused allowlist can break have opposite remedies**, so one sentence for both is
CNCORE-262's defect at the setting beside the one that ticket was about: a wildcard is deleted and
replaced by the hosts it stood for, a malformed range is corrected where it stands.

## The entry travels because the control takes a LIST

The three refusals `REFUSED` already held are about one entry typed into a box, and the Owner is
looking straight at it. A wholesale save is different: "an entry in that setting would not read"
sends somebody with forty lines to read their own setting looking for the one that is wrong. So
`SettingNotRead` carries the entry and the rule as FIELDS, and the surface writes the sentence.

**It is one class raised by both parsers.** The Allowlist and the Providers are two settings and
neither follows from the other, but "an entry inside a wholesale setting would not read" is one fact
about both, and the surface that repairs either reads the same two fields off it. It is a SIBLING of
`ProviderNotNamed` rather than a parent or a child, and the catch order in `settings.nameProvider`
is why: that handler asks `instanceof ProviderNotNamed` first to tell a bad ENTRY from a bad STORED
ROW, and merging them would tell an Owner whose row is bad that their own perfectly good URL was the
problem.

**And each closed set belongs to one control.** `refusal.ts` holds three now — the naming box, the
Allowlist textarea, the Providers textarea — because a page holding one set for all of them would
have to work out which section a word belonged in before it could place the sentence. Three sets ARE
that answer, and a sentence about wildcards cannot then render under a box that takes one URL.

## What the figures moved, and one of them moved because of where a `redirect()` sits

`tree-figures.test.ts` counts the call sites that redirect on what a procedure answered, per
FUNCTION, by splitting a file on its exports. Both new redirects build their address through one
shared helper, and the first draft raised the `redirect()` inside it — which the splitter attributes
to whichever export the helper happens to follow, and to no other. **The helper returns the address
and each action raises its own redirect**, so the count sees both.

| figure | was | is |
| --- | --- | --- |
| hand-built redirects in `settings/actions.ts` | 5 | 7 |
| call sites reading a procedure's answer | 27 | 28 |
| of those, redirecting on it | 7 | 9 |

The helper's return type is `` `/settings?${string}` `` rather than `string`, because `redirect()`
takes a `RouteImpl` under typed routes and a bare `string` would have thrown that check away for
both call sites ([[0109-deployment-is-a-shape-not-a-vendor]]).

## What this costs

`settings.read`'s output changes shape again, one ticket after the last time. That is accepted for
the reason ADR-0197 accepted it: "the allowlist does not parse" is a real answer to "what does this
instance reach", and an API caller should read it out of the OpenAPI document rather than discover
it as a 500. Every reader moved and the typechecker named each one.

**What it does not do is make an unreadable row impossible.** Nothing in the product can write one;
what remains is a hand-edited database, a restored dump, or a value written by something older than
the parse. The change is that arriving there no longer costs the Owner the page, and no longer costs
them the only control that could have fixed it.

**And `createContext` still throws for every OTHER surface** that asks what this instance reaches.
That half stands rather than being an omission: those pages have no repair to offer, and a refusal
is the honest answer from a page that cannot fix anything. The sentence in that function claiming
`/settings` was among them is corrected where it stood.
