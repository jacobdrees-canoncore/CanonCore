---
status: accepted
---

# A failure reason is bounded, and it says who wrote it

Reaching a provider fails in several ways, and until CNCORE-95 every one of them handed the caller
`asError(error).message` — verbatim, with no ceiling, straight onto the Owner's page. Two procedures
did it independently: `provider.search`'s `failed` list since CNCORE-68, and `provider.container`'s
`unreachable` answer since CNCORE-92. Each mapped its own `catch`, which is how one defect came to
have two sites.

**TWO KINDS OF STRING ARRIVE AT THAT `catch` AND THEY ARE NOT THE SAME KIND.** One is this app
telling the Owner about their own instance: [[0034-two-outbound-boundaries]]'s CONFIG boundary
refused a URL the Owner typed, and the refusal names the setting they go and change. The other is a
third party's text — undici's, the DNS layer's, or zod's report on a body the provider chose. The
first is exactly the sentence the Owner needs. The second is a stranger choosing the length and
content of text on a page it does not own.

So a reason is **two fields**: `text`, capped, and `wrote`, which is `canoncore` or `provider`.

## The cap is 300 characters, and everything is capped

Including our own. The bound is what makes the field bounded AT ALL, and exempting one branch would
mean the bound held only while every caller agreed about which branch it was on — which is the
shape of the defect this record closes, not a repair of it.

300 sits above every sentence this app writes and far below anything a provider could flood a page
with.

**AND "EVERY SENTENCE THIS APP WRITES" IS NOT A FIXED LENGTH, WHICH AN EARLIER VERSION OF THIS
RECORD MISSED.** It claimed the longest refusal in `boundary.ts` was 172 characters and that the
Owner's sentences therefore arrived whole. Both halves were wrong. `assertConfigAddress` with a full
IPv6 address is 199, and — the one that matters — **`assertConfigUrl` interpolates the host TWICE**,
once as the origin and once on its own, so the refusal grows at twice the rate of whatever the Owner
typed. Measured: a 147-character hostname, an ordinary AWS load balancer name, produces a
413-character refusal, and capping that at 300 took away `is not an allowlisted host` AND the
sentence naming the remedy. The Owner was left the name of their own host and no verdict on it. The
cap was eating the one thing this record promises to protect.

**SO THE VALUE IS BOUNDED WHERE IT ENTERS THE SENTENCE, and the prose around it is then fixed-length
and cannot be cut.** `shortly()` caps an interpolated host, origin or address at 80 characters, which
leaves the longest of these refusals at 269 with both of its values at full stretch. An Owner who
typed a long host still recognises its opening; what they cannot do without is the clause saying what
to change.

**THIS IS ASSERTED WITH A LONG HOSTNAME, not merely with the fixed prose.** The earlier test threw
the refusal from the real boundary and compared it exactly, which looked like a guard and was not
one: it used `wiki.example.com`, so it only ever exercised the half that never varies. The variable
half is the half that consumed the headroom.

## The mechanism CNCORE-95 named is not the mechanism, and the defect is larger than it said

The ticket's words are that a refused body reaches the Owner as "a zod message that serialises the
received value". **Measured on zod 4.5.4, it does not.** A `ZodError`'s `message` is the ISSUE LIST
serialised as JSON — `code`, `expected`, `path`, and zod's own sentence — and the received value
appears nowhere in it.

The provider controls the length by a different lever, and a stronger one: **one issue per bad
field, so the length is set by how many bad records it sends.** Measured on the payloads the tests
actually use, uncapped:

| payload | reason length |
| --- | --- |
| 200 malformed `search` results | 151,362 characters |
| a 200-member malformed `browse` | 78,287 characters |
| 1000 records with two bad fields each | 378,782 characters |

`MAX_BODY_BYTES` admits 4 MiB of such records, so those figures are a floor rather than a ceiling.
A second lever is real and narrower: a provider's own strings DO reach the message through `path`,
so a record key it chooses is quoted back — two 400-character keys measured at 981 characters.

**AND THAT MESSAGE IS PRETTY-PRINTED JSON**, newlines and six-space indents, which is the third
thing the ticket did not say. Uncollapsed, the cap spends most of its 300 characters on the
provider's indentation and hands the Owner a fragment of a stack of braces. So a reason is collapsed
to one line before it is cut, and the same 300 characters then carry the codes and paths that say
what was wrong. It was found by a page assertion that could not match across the newlines, which is
the sort of thing only building it tells you.

Correcting this makes the case for the cap stronger, not weaker, which is why it is recorded here
rather than left as a ticket that was roughly right.

## `wrote` is decided by WHICH BOUNDARY refused, not by the error's class

The obvious rule is `instanceof OutboundRefused`, and it is wrong. **An `OutboundRefused` is not
reliably app-authored.** `hopTo` interpolates a raw `Location` header a provider wrote — ``refused a
redirect from ${origin}: `${location}` is not a URL.`` — and `assertContentUrl` and `readJson` quote
provider-chosen URLs the same way. Attributing those to CanonCore would put a provider's text in
this catalogue's voice under a rule written to stop exactly that.

So `OutboundRefused` carries `boundary: "config" | "content"`, which is this record's own split
doing the work: the config boundary judges a URL the OWNER supplied, the content boundary judges one
a PROVIDER supplied, and that is already the question "whose text is this?" asked and answered.
`canoncore` means the config boundary refused, and nothing else does.

**`content` IS THE DEFAULT**, so a refusal added later is capped and attributed to the provider until
somebody decides otherwise. The cost of being wrong that way is a sentence the Owner reads as a
provider's; the cost the other way is a provider choosing text the Owner reads as CanonCore's.

**WHAT SITS AT THE DEFAULT IS MORE THAN AN EARLIER VERSION OF THIS RECORD COUNTED.** It said "two
refusals", and the true list is longer, so it is enumerated rather than characterised:

- `pinnedLookup`'s "resolves to no address" is raised for both dispatchers and is a fact about the
  provider's host, so reading it as the provider's is not wrong.
- `client.ts` raises three that are THIS APP'S OWN PROSE about a provider's behaviour: more than
  `MAX_HOPS` redirects, a response that carried no body, and a body larger than `MAX_BODY_BYTES`.
  They are not config-boundary refusals and they name no setting the Owner can change, so `canoncore`
  would be wrong for them — but they are not the provider's words either.
- The refusals raised while PARSING settings at startup never reach a page at all; they stop the
  server, so they are not annotated for a reader that does not exist.

**THAT THIRD BULLET IS WHY THE PAGE DOES NOT SAY THE PROVIDER "said" THIS, and an earlier build did.**
`wrote: "provider"` means *this is not CanonCore's sentence about your settings*, which is a weaker
claim than *this provider uttered these words* — and the weaker claim is the true one for all of
them. The page therefore QUOTES rather than attributing an utterance: quotation marks beside a named
provider say the catalogue is not the one making the claim, without asserting who wrote it.

## Attributed, not reworded

A provider's text is QUOTED and named as that provider's. It is not replaced. CNCORE-92's rule
holds: a provider that cannot be reached must never look like one that holds nothing, because "a
refusal reworded is not a refusal reported". A house sentence in place of the provider's would be
that defect reintroduced by the fix for a different one.

## Whether an unauthenticated caller should read the raw message at all

**It should, and capping it is not what would change that.**

CNCORE-95 records the second half correctly, AS IT STOOD THEN: neither procedure was behind
anything. `packages/api/src/index.ts` exported exactly one builder, `publicProcedure`, and there was
no session or capability check anywhere on the RPC surface -- so "an unauthenticated caller" was
EVERY caller, `purge` was as reachable as this, and a bounded reason changed none of it. CNCORE-109
closed that surface; these two procedures are READS and stay open, which is the conclusion below
rather than an exception to it.

**And narrowing the reason would buy nothing here, because the surface already answers the question
more directly.** `provider.configured` hands any caller the full list of configured provider URLs,
and `provider.allowlisted` says whether anything is allowlisted at all. A caller wanting to know
what this instance can reach reads those; it does not need to infer it from the shape of a failure.
Removing the reason's detail would cost the Owner the distinction between a refusal, a dead socket
and a provider that answered badly — the three that CNCORE-92 built this field to keep apart — and
would leave the oracle standing.

The door that needs closing is the RPC surface, not this field. [[0043-sessions-carry-capabilities]]
and [[0044-one-owner-row]] already decide what closes it, and CNCORE-109 built it: everything that
writes is behind an owner session, and the reason above was not degraded to get there. **What that
door does NOT close is this one.** `provider.search` and `provider.container` are reads, so they are
open on the demo as everything else is, and an unauthenticated caller still reads a bounded,
attributed reason -- which is what this section decided and why narrowing the field would have cost
the Owner the distinction without shutting anything.

## As built, under CNCORE-95

`reasonFor(thrown)` in `@canoncore/providers` is the single mapping, and `failureReason` is the zod
schema both procedures state as their output — so the ceiling is in the OpenAPI document a caller
reads rather than an invariant two handlers each had to remember.

**ONE FUNCTION RATHER THAN TWO LOCAL TRUNCATIONS, because the surface is still growing.** CNCORE-100
and CNCORE-101 are both blocked by this ticket on purpose: a live provider failing on an expired
credential and a settings page saying why a provider cannot be reached are two more reason surfaces,
and CNCORE-96 binds them to this record — "a reason is capped, and the page says which Provider it
came from". Four sites mapping their own catch is how this defect happened twice already.

**AND A REASON IS NOT THE ONLY PROSE A PROVIDER PUTS ON A PAGE, WHICH THIS RECORD DID NOT SAY.**
CNCORE-101 renders a declared credential's `label` ([[0122-a-provider-declares-the-credential-it-needs]]),
which the contract bounds only by `min(1)` — so the opening sentence of this record, a stranger
choosing the length and content of text on a page it does not own, was true of a field nothing here
covered. `bounded(text)` is now published beside `reasonFor` and is the same cap without the
attribution: `wrote` is decided by WHICH BOUNDARY REFUSED, and a label was refused by nothing. It is
a provider's text on a manifest it chose to send, known to be the provider's with nothing having to
decide.

**THE `Reason` COMPONENT MOVED OUT OF `/import` FOR THE SAME REASON THE MAPPING DID.** This record
says both `/import` sections take the same component, which held while `/import` was the only
surface; the settings page is the third, and a second two-line component deciding whose voice a
sentence is printed in is exactly the shape that gave this defect two sites in the first place. It
is `apps/web/src/components/reason.tsx` now. `reasonFor` decides WHOSE the text is and that
component decides how the page says so — the half a shared mapping alone does not buy.

**The page prints CanonCore's sentence plainly and QUOTES everything else, with the provider named
beside it.** Both `/import` sections take the same component, and each keeps naming the provider in
its own lead sentence. An earlier build moved that naming into the component instead, which rendered
the URL twice in the search list and — worse — dropped it entirely when the reason came from
`assertConfigAddress`, which names an ADDRESS rather than the provider. The lead sentence is the
right place for it precisely because the reason cannot be relied on to contain it.

**The `provider` branch is rendered by a test, which it was not at first.** The suite's one
unreachable provider is refused at the config boundary, so every page assertion reached the
`canoncore` branch and the quoting this record turns on was rendered by nothing. `aProviderThatAnswersBadly`
is the witness, and the instance names it like `aProviderThatDeclinesBrowse` — the page
refuses a base URL it does not know, so a stub standing up inside one test cannot reach the branch.
