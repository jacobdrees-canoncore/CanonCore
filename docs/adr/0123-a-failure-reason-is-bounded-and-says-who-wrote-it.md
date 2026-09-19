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

**THAT QUESTION HAS TO BE ASKED OF THE RIGHT ERROR, AND FOR HALF THE REFUSALS IT WAS NOT (CNCORE-192).**
The rule above is right and the thing it was reading was wrong: a refusal raised BELOW `fetch` never
reaches `reasonFor` as itself, so `instanceof` was being asked of undici's wrapper. What is owed is
below.

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
  would be wrong for them — but they are not the provider's words either. **SINCE CNCORE-140 THERE IS
  A FOURTH, AND IT IS THE PROVIDER'S WORDS LITERALLY** — a failing answer's own reason, read off the
  body rather than cancelled unread. It sits at this same default, and it is the one case where the
  default is not merely the safe reading but the exactly correct one.
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
door does NOT close is this one.** `provider.search` is a read, so it is open on the demo as
everything else is, and an unauthenticated caller still reads a bounded, attributed reason -- which
is what this section decided and why narrowing the field would have cost the Owner the distinction
without shutting anything.

**`provider.container` WAS THE SECOND NAME IN THAT SENTENCE AND IS NOT ANY MORE.** It is an
`ownerProcedure` since CNCORE-154 ([[0131-an-outbound-read-that-costs-a-browse-is-the-owners]]),
because answering it runs a whole browse at a third party rather than reading this catalogue's rows
-- a different door from the one CNCORE-109 closed, which was about writing. This section's decision
is untouched by that: the reason it carries is still bounded and still attributed, and the caller who
reads it is now the Owner.

## As built, under CNCORE-95

`reasonFor(thrown)` in `@canoncore/providers` is the single mapping, and `failureReason` is the zod
schema both procedures state as their output — so the ceiling is in the output schema a caller is
held to rather than an invariant two handlers each had to remember, and it is stated in the OpenAPI
document a caller reads.

**FROM THE AFTERNOON OF 2026-09-19 UNTIL CNCORE-212 IT WAS NOT, and no test noticed.** zod 4.6.5,
taken that afternoon, keeps a length on its check's own `def` and leaves `_zod.bag` empty, where
4.5.4 filled it, and @orpc/zod 1.15.0 read only the bag. So every length and format in this API dropped out of the document, and
CNCORE-165 read it and found `{"type": "string"}` where this sentence claimed a ceiling. @orpc/zod
1.15.1 reads the checks ("Keep JSON Schema constraints on zod >= 4.6", in its release notes), and
CNCORE-212 took it with the @orpc family it peer-requires at exactly its own version.
`route.test.ts` asserts the ceiling on the served document now. The test there before asserted only
that a path was listed, which a document stating no bound anywhere still passes.

**1.15.1, NOT THE 1.15.2 CNCORE-212 WAS FILED AGAINST.** The converter is byte-identical in the
two, and 1.15.2 was hours old: taking it made pnpm write a fifteen-entry `minimumReleaseAgeExclude`
block, waiving the 24-hour cooldown for exactly the case it exists to catch. That is the trade
[[0105-biome-lints-and-formats]] already refused for a patch release, and `^1.15.1` takes 1.15.2 on
the first update after it ages out.

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

**A THIRD TRUNCATION ALREADY EXISTS AND IS DELIBERATELY LEFT.** `packages/tasks/src/registry.ts` has
its own private `bounded` at this same 300, collapsing and cutting the same way, for what a task
THREW. Publishing this one does not absorb it: `@canoncore/tasks` depends on `@canoncore/db` alone,
and taking a dependency on `@canoncore/providers` — the outbound HTTP client, two undici dispatchers
and ADR-0034's boundaries — to reach a four-line string function would couple the task registry to
the provider stack for nothing. The number is the shared thing and this record is where it is
shared; that file takes it "rather than chosen again" and says so. Recorded because a reader who
finds the second copy should meet a decision rather than an oversight.

**THE CAP IS NOT THE ONLY LEVER A PROVIDER HAS OVER A PAGE, which this record framed as a question of
LENGTH alone.** Bidirectional overrides (U+202A–U+202E, U+2066–U+2069) re-order the glyphs around
themselves, so a short reason can run backwards through the sentence CanonCore wrote about it, and
the zero-width family (U+200B–U+200D, U+FEFF) splits a word a reader is scanning for. Neither is
whitespace, so `oneLine`'s `\s+` never touched them, and a 300-character ceiling is no answer to
either. They are stripped rather than escaped: a reason and a credential's label are single
sentences of prose, not documents with a mixed-direction layout to preserve. Found reviewing
CNCORE-101, on the page whose next control is a link the Owner is about to give a credential to.

**WIDTH IS A THIRD LEVER**, and a 300-character ceiling is no answer to it either: 300 characters
with no break in them are one line as wide as the Provider likes. CNCORE-217 closes it with a
component, recorded under "Where the wrap lives" below: `ProviderProse` as built, and `TheirWords`
since CNCORE-223 put a record's fields, an Item's values and a Group's name through it as well
([[0142-text-the-page-did-not-write-wraps-anywhere-through-one-component]]).

**THE `Reason` COMPONENT MOVED OUT OF `/import` FOR THE SAME REASON THE MAPPING DID.** This record
says both `/import` sections take the same component, which held while `/import` was the only
surface; the settings page is the third, and a second two-line component deciding whose voice a
sentence is printed in is exactly the shape that gave this defect two sites in the first place. It
is `apps/web/src/components/reason.tsx` now. `reasonFor` decides WHOSE the text is and that
component decides how the page says so — the half a shared mapping alone does not buy.

**The page prints CanonCore's sentence unquoted and QUOTES everything else, with the provider named
beside it.** All THREE reason surfaces take the same component — `/import`'s two sections and, since
CNCORE-101, the settings surface — and each keeps naming the provider in its own lead sentence. It
lived inside `/import/page.tsx` while that page was the only caller and moved to
`apps/web/src/components/reason.tsx` when the third arrived; this sentence said "both `/import`
sections" until then. An earlier build moved that naming into the component instead, which rendered
the URL twice in the search list and — worse — dropped it entirely when the reason came from
`assertConfigAddress`, which names an ADDRESS rather than the provider. The lead sentence is the
right place for it precisely because the reason cannot be relied on to contain it.

**The `provider` branch is rendered by a test, which it was not at first.** The suite's one
unreachable provider is refused at the config boundary, so every page assertion reached the
`canoncore` branch and the quoting this record turns on was rendered by nothing. `aProviderThatAnswersBadly`
is the witness, and the instance names it like `aProviderThatDeclinesBrowse` — the page
refuses a base URL it does not know, so a stub standing up inside one test cannot reach the branch.

## Draining a body and READING it are not the same thing (CNCORE-140)

Everything above describes a mapping that was complete and a mechanism that reached no further than
`reasonFor`'s own inputs. **The one reason an Owner most needs was never among them.**

`client.ts` answered a non-2xx by cancelling the body and throwing the status alone —
``${base.origin}${path} answered ${response.status}.`` — at two sites, each with the same comment
beside it: drained "or the socket is held until the dispatcher times it out". **The reason for the
drain was sound and the conclusion drawn from it was not.** A bounded read releases that socket
exactly as a cancel does, and what makes it possible to bound is this record's own cap.

It mattered from CNCORE-100 onward rather than in the abstract. `provider-wiki` answers `503` with
the sentence naming which session lapsed and the path to renew it at, built to this record on the
provider's own side and measured there as not surviving the crossing. CNCORE-100's own words for it:
"the missing half is on the other side of the boundary". An expired `cf_clearance` is the ORDINARY
failure of a live provider, and the Owner read `answered 503`.

**ONE FUNCTION FOR BOTH SITES**, which is this record's own lesson one seam below where it was
learned: `read` and `readOrNull` carried two copies of that sentence exactly as `provider.search` and
`provider.container` carried two catches.

### The origin leaves the sentence, because the cap reaches this one too

The sections above bound a value where it enters a refusal and leave the prose around it fixed.
**This sentence had the same defect and nothing had looked at it.** `${base.origin}${path}` is TWO
variable-length values, both ahead of the provider's remedy, inside a string this record caps at 300.

The origin is dropped rather than shortened. It is the longer of the two, and **every reason surface
prints it in its own lead sentence already** — which is this record's sentence about `Reason` not
naming the provider, read from the other direction. `/import`'s search list rendered it twice as a
result. The path stays, bounded by `shortly`: it says WHICH operation failed, which nothing else on
the page does. That leaves the framing at 95 characters with its one value at full stretch, so a
provider's remedy of ordinary length arrives whole.

**AND IT IS ASSERTED WITH THE VARIABLE HALF AT STRETCH**, which is this record's correction of its
own earlier test applied before the same mistake could be made twice: the witness uses a long PATH,
not a long sentence of fixed prose, because the variable half is the half that consumes the headroom.
Reverting `shortly` there leaves the Owner 300 characters of their own query and none of the remedy,
which is how that test is known to guard something.

### `error` is unwrapped where it is there, and nothing is required of a provider

`packages/contract` refuses to make a failure body's shape part of CMPP and gives its reason:
requiring `{error, provider}` would be "writing `be provider-wiki` into the intersection". That
refusal stands and this does not disturb it. CanonCore READS that spelling opportunistically and
falls back to the body's own text, which is the arrangement `cmpp.ts` is already under as a
CONSUMER'S schema — what is written there is only what this app depends on, and a provider spelling
it otherwise is still quoted, just with its braces showing.

**THE ARGUMENT FOR UNWRAPPING IS THE CAP'S RATHER THAN TIDINESS.** This record already found the 300
characters being spent on a `ZodError`'s indentation and handing the Owner a fragment of a stack of
braces. A JSON envelope spends them the same way: on punctuation, and on a `provider` key the page
names in its own lead sentence.

### What the bounded read costs, and what it does not

`MAX_REASON_BYTES` is twelve times `REASON_MAX_LENGTH` and not `MAX_BODY_BYTES`.

**THE ARITHMETIC IS RECORDED BECAUSE THE FIRST ATTEMPT AT IT WAS WRONG IN BOTH HALVES**, and the
review that caught it proposed a third figure that is wrong too — so it is spelled out rather than
asserted. `REASON_MAX_LENGTH` counts UTF-16 UNITS, not code points. A unit costs AT MOST THREE UTF-8
bytes, which is a BMP character; an ASTRAL character is four bytes spread over TWO units, so it is
cheaper per unit rather than dearer. **So the longest reason there can be is 900 bytes, not 1,200**,
and a near-maximal reason inside a `{"error": …}` envelope does NOT overrun a 1,200-byte read the way
the review reasoned it would. What was genuinely wrong was the constant's own comment, which named
1,200 and called it "three times" the 1,200 it had just derived. Twelve times leaves 900 bytes of
reason and three times that in headroom, for the envelope and for a provider that writes other keys
ahead of its `error`.

**IT BOUNDS WHAT IS ASKED FOR RATHER THAN CUTTING AT AN EXACT BYTE**, which is the third thing the
first attempt did not say. The read stops requesting chunks once it holds the bound and keeps whole
the chunk that took it there, so a small body arrives entire whatever the number is. A test asserting
that a reason past the bound is dropped would therefore pass on CHUNK GRANULARITY rather than on the
cap, and one was written and deleted for exactly that: it is the "looked like a guard and was not
one" shape this record already carries once.

Reading four mebibytes to print three hundred characters would hold the socket open for the very
reason the drain existed. Past the bound the body is cancelled in a `finally`, which is what reclaims
it — **and that is guarded rather than assumed.** The witness is a provider that
never stops writing, and one that walked away without cancelling leaves a socket the test's own
teardown hangs on. Removing the cancel fails it in 10 seconds, measured, which is how it is known to
be a guard rather than decoration.

**THE TEN SECONDS IS THE ABANDONED SOCKET'S AND NOT THE READ ONE'S**, which the sentence here used to
blur by saying "a client reading to the end waits out `bodyTimeout`". It does not. `bodyTimeout` caps
the GAP BETWEEN body chunks rather than a total (ADR-0130, and undici's own docs), and this witness
writes every millisecond — so it never leaves a gap, and a client reading it to the end waits
FOREVER rather than ten seconds. The cap fires on the socket the reader ABANDONED, where the gap does
grow, and that is the socket the cancel reclaims.

A provider that sends NO body still fails with the sentence it failed with before this ticket, full
stop and all. A body is the provider's choice and an empty one is a choice it may make; what it must
not produce is a colon trailing into blank space.

**ASSERTED WHERE IT IS RENDERED AND NOT ONLY AT THE CLIENT**, on the settings surface. The reason
crosses a package boundary, an RPC procedure and a React component between the socket and the page,
and the client's own test proves none of that. The existing page witness for the `provider` branch
answers `200` with a malformed manifest, so the text it quotes is zod's; this is the first one whose
quoted text is a provider's own words.

### Where the bound is applied, and why twice is not twice

The reason is bounded where it ENTERS the sentence and the whole sentence is bounded again by
`reasonFor` on its way to a page. A review read the inner one as the outer one repeated, since the
outer always dominates what a page RENDERS. It does not: `FailedProvider` in `search.ts` carries the
thrown Error itself and reads `reason.message` directly, so text left unbounded at the seam reaches
that consumer at whatever length the provider chose. Bounding where the value enters is this record's
own rule, and this is where it enters.

The same review proposed setting the inner bound to `REASON_MAX_LENGTH` minus the framing so the cut
happens once. That is refused. It buys the Owner nothing — the rendered length is 300 either way — and
it reintroduces precisely the arithmetic this record warns against, a bound that holds only while
every caller agrees how long the prose around it is.

### A field a provider sent empty is silence, not a body to quote

`{"error": ""}` is the same silence as no body at all wearing a different spelling. An earlier build
read a present-but-empty `error` as "no reason here" and fell through to quoting the raw envelope, so
the Owner got `{"error":"","provider":"…"}` with its braces showing — the stack of braces this record
caps against, arriving by the route built to prevent it. A string `error` is taken whatever is in it,
and an empty one reaches the sentence that reports silence.

### One read loop, not two

`readAtMost` is shared by `readJson` and the reason read. They are the same loop and differ only in
what the caller does at the ceiling: one REFUSES a body past `MAX_BODY_BYTES`, the other keeps what it
has and walks away. Written twice they would quietly stop agreeing about the half that is hard, which
is the release rather than the counting — and this record exists because a defect already had two
sites. It reads ONE CHUNK PAST the limit on purpose: `cut` has to tell a body that ENDED at the
ceiling from one that merely reached it, and nothing but asking for the next chunk distinguishes
those, so refusing a body of exactly `MAX_BODY_BYTES` would be refusing a body that was fine.

## A wrapper is not a reason, so the `cause` chain is unwrapped (CNCORE-192)

Everything above asks `wrote` of the thing that was thrown. **For every refusal raised below `fetch`,
the thing that was thrown is not the refusal.**

[[0034-two-outbound-boundaries]]'s connection pinning lives in the DNS `lookup` hook, which is
undici's callback and not this app's stack. So `assertConfigAddress` throws, undici catches it at the
connector, and what arrives at `reasonFor` is `TypeError: fetch failed` with the refusal on `cause`.
Nothing here read `cause`. **Both of this record's fields then answered wrongly, and the second is the
worse one:** the sentence naming the remedy was replaced by eight words that name nothing, and
`wrote` fell through to `provider` — so the page QUOTED this catalogue's own sentence about the
Owner's own settings as a stranger's claim. That is not this record failing to answer. It is this
record answering, confidently, with the attribution inverted.

Found by walking the README's `### A Provider beside it` by hand on 2026-09-14, on a real install
with a real Provider beside it. An allowlist holding the Provider's HOST and not the CIDR its address
sits in is what a stranger gets by following that section, the host check admits the name, and the
pinned lookup refuses the socket. The one sentence that would tell them what to do was the one being
discarded.

### It costs every diagnosis, not only the refusal

The ticket framed this as the refusal's loss. Measured, it is not: **every** network-layer failure
undici reports arrives the same way, with the fact one link down.

| what failed | what the Owner read | what was on `cause` |
| --- | --- | --- |
| the config boundary refused the address | `fetch failed` | `refused ::1: … no allowlisted CIDR covers it. …` |
| nothing was listening | `fetch failed` | `connect ECONNREFUSED 127.0.0.1:64665` |
| the host does not resolve | `fetch failed` | `getaddrinfo ENOTFOUND nothing.invalid` |

So the repair is not a wider `instanceof` list looking for one class — that is the mistake this record
already warns about under "`wrote` asks which boundary refused; this asks WHERE the throw happened",
where the failures a provider can produce are shown to have no class in common. **The repair is that a
wrapper is not a reason.** `fetch failed` is undici saying that something underneath it failed; the
reason is whatever is underneath.

### What unwrapping is owed

`reasonFor` walks `cause` and takes **the innermost link that said something**, then asks `wrote` of
THAT link — which is this record's existing question, put to the error it was always meant to be put
to. Three parts of that sentence were each measured rather than assumed.

**THE INNERMOST THAT SPOKE, RATHER THAN SIMPLY THE INNERMOST.** `makeNetworkError()` called with no
argument builds `new Error(undefined)`, whose message is EMPTY, and three sites in undici's fetch
reach it. A blind walk to the bottom would report silence there and throw away `fetch failed`, which
in that one case is genuinely all there is. Keeping the last link with words in it cannot lose
information: the deepest thing that spoke is the most specific thing that spoke.

**WALKED, RATHER THAN READ ONCE.** A chain deeper than one is undici's own shape and not a
hypothetical: `response.js` wraps an abort as `fetch failed` → `DOMException` → the original error,
and `client-h2.js` wraps an HTTP/2 failure in an `InformationalError` before the fetch layer wraps it
again. `cause` read once would reach the `DOMException` and stop.

**A VISITED SET, RATHER THAN A DEPTH LIMIT.** ECMA-262's `InstallErrorCause` (20.5.9.1) stores
whatever `Get(options, "cause")` returned, as a WRITABLE property, and places no restriction on the
value — so a `cause` may be a number or a string, and a cycle is constructible with nothing in the
platform forbidding one. Measured: `a.cause.cause === a` is `true`. A depth limit would be a number
nobody could defend; a visited set needs none, and what it prevents is an infinite loop inside a
function that runs while rendering the Owner's page. **It is a guard rather than decoration** —
removing the set hangs its test until the runner kills it, measured at 45 seconds and no result.

### The standard promises none of this, and the version that does is not the one you would guess

**The Fetch Standard says only "If response is a network error, then reject p with a `TypeError` and
abort these steps".** The word `cause` occurs twice in that document and neither is an error cause.
So `cause` is undici's own addition at `lib/web/fetch/index.js` — `new TypeError('fetch failed', {
cause: response.error })` — and this section reads a shape undici chooses rather than one anybody
promised. The walk is written to survive that shape changing: a chain of one, or of none, answers
exactly as it did before.

**AND THE UNDICI THAT MATTERS IS THE ONE THIS PACKAGE IMPORTS, NOT THE ONE NODE BUNDLES.**
`client.ts` does `import { Agent, fetch } from "undici"`, so the behaviour above is **undici 8.10.2**,
what the catalog pins; Node 24.19.0's own global `fetch` is undici 7.29.0 and is not on this path at
all. Measuring the bundled one and recording it as the rule would have been a fact about the wrong
library, and the two are free to diverge.

What makes the refusal survive the crossing at all is that `makeNetworkError` passes anything
`instanceof Error` through **by identity** rather than re-wrapping it — so the sentence, and the
custom `boundary` this record put on `OutboundRefused`, are both intact one link down. The mechanism
was whole; only the reading was not.

### `wrote` and `text` come from the SAME link, and the obvious improvement breaks that

`wrote` is asked of the link the walk LANDED on, not of any `config` refusal found anywhere in the
chain. **Review of CNCORE-192 read that as a fragility and proposed the second reading; it is worse
than the thing it repairs, in two ways.** A refusal that ever gained a `cause` would, under the walk,
hand its `text` to the deeper link — so preferring a `config` refusal from elsewhere in the chain
would print a THIRD PARTY'S text in this catalogue's voice. That is the cost this record has already
ranked: the one it calls worse. Under-attributing our own sentence is the conservative direction, and
it is the one the walk takes.

**AND THE SECOND WAY WAS FOUND BY BUILDING IT.** The proposal is a SECOND traversal of the same
chain, and a second traversal is a second place to forget the visited set — the one written to try it
did forget, and the suite hung rather than failed. So the cheaper repair is also the one that
reintroduces the hang this section spends a `Set` to prevent, which is the argument for asking the
question ONCE, of one link, at one place.

**So the coupling is the mechanism rather than an accident of it.** `wrote` is a claim ABOUT `text`,
and a build sourcing them from two different links would be making that claim about a sentence it did
not read. A test pins it, and the shape it pins has to be built by hand because **`OutboundRefused`'s
constructor takes a message and a boundary and nothing else** — there is no `cause` parameter to
pass, so none of its fifteen construction sites could produce one even by accident. What is guarded
is which way this falls the day somebody adds one. (Counted: nine in `boundary.ts`, four in
`client.ts`, two in `configured.ts`. An earlier draft of this paragraph said twelve, which was a
figure taken from a review rather than from the tree.)

**AND `canoncore` RESTS ON A CHAIN UNDICI ASSEMBLED, which is the question this record exists to
ask of itself.** Attribution is decided by the link the walk lands on rather than by the thing that
was thrown, so it is worth saying why that is not a way for a stranger to speak in this catalogue's
voice: the branch fires only on an `OutboundRefused` whose `boundary` is `config`, and the only
things that construct one are `assertConfigUrl`, `assertConfigAddress` and `assertHttpScheme` — all
three judging a base URL the OWNER typed. A provider supplies text, never an error object, so it
cannot put one in a chain. The conservative direction this record already chose holds: everything
undecided still lands on `provider`.

### Asserted at three seams, because each proves what the others cannot

The rule is at `reasonFor`, where a hand-written `TypeError` carries a refusal thrown by the real
boundary. That the hand-written wrapper is the shape undici really produces is proved a layer down,
in `client.test.ts`, through a real socket and a real `dns.lookup` on a Provider allowlisted by NAME
whose address no CIDR covers. And the page is where `wrote` is finally spent: `reasonFor` decides
whose the sentence is and `Reason` decides how the page says so, with a package boundary, an RPC
procedure and a React component in between, so **the settings witness asserts the ABSENCE of `<q>`**
— quoted, this sentence would be telling the Owner their Provider said something about their
allowlist. Reverting the walk fails exactly one of those twenty page tests, which is how the witness
is known to guard something.

## The WRITE surfaces get the same reason, in the same shape (CNCORE-149)

Everything above is about surfaces that READ. `provider.search`, `provider.container` and — since
CNCORE-101 — the settings page all map through `reasonFor`, and this record's "one function for every
reason surface" was true of every surface it had counted. **It had not counted the two that write.**

`provider.import` and `provider.browse` caught `OutboundRefused` and nothing else. A provider
ANSWERING a non-2xx throws a plain `Error` from `client.ts`'s `failed()` — the sentence the section
above built — so it fell past both catches into the undeclared throw those catches exist to remove,
and each carried the comment saying so: "an undeclared throw is a 500 no caller can narrow on". The
Owner who FOUND a record and pressed Take on an expired Provider got that 500, where the read that
found it would have told them what to do. CNCORE-100 makes it the ordinary case rather than a rare
one: an expired `cf_clearance` is a 503 on every operation, import included.

### `wrote` asks which boundary refused; this asks WHERE the throw happened

The obvious repair is a wider `instanceof` list, and it is wrong for the reason this record already
gives about `wrote`. **The failures a provider can produce have no class in common**: ADR-0034's
refusal, undici's dead socket, zod's report on a body, and `client.ts`'s own sentence about a status
share no type, and every type they do have is one a bug in this app can throw too. So what
distinguishes them is not what was thrown but that it was thrown WHILE A PROVIDER WAS BEING ASKED
SOMETHING — `askingTheProvider` wraps exactly that, and `ProviderFailed` carries the reason out.

**WHICH PUTS THE CATALOGUE'S OWN WRITE OUTSIDE IT, and that is the point of a wrapper rather than a
wider catch.** `importProvidedRecord` runs after the provider has answered. A `catch` wide enough to
hold every way a provider can fail is wide enough to report a failed INSERT as something the provider
did — a false attribution in the field this record exists to keep honest. `BrowseNotOffered` is
outside it for the same reason: it is raised on a manifest that came back fine, and ADR-0033 makes
declining `browse` well-formed rather than a failure.

### One shape, because two shapes for one thing is what this record is about

`PROVIDER_REFUSED` carried a bare `message` string. That is the same field the read surfaces carry as
`{wrote, text}`, spelled twice — and the half a string cannot carry is `wrote`, so a caller holding
one had no way to tell this catalogue's sentence about the Owner's own settings from a third party's
text. It is `data: failureReason` now, declared, so the ceiling is in the output schema and in the
OpenAPI document rather than an invariant each handler remembered. The document lost it when zod
4.6.5 was taken, for the reason "As built, under CNCORE-95" gives, and states it again since
CNCORE-212.

Its MESSAGE was wrong too, and in the way this record warns about. "That provider URL is not one this
instance may reach" is true of ADR-0034 refusing a URL and false of the other two the branch carries
— a dead socket, and a provider that ANSWERED badly, which was reached. `provider.container`'s
`unreachable` branch already keeps the three apart by what they SAY rather than by the name over
them, and the message says nothing about which now.

### A DECLARED error at status 500 never reaches a page, which nothing here had noticed

The router change alone fixed nothing an Owner could see, and the page test is what said so.

**oRPC gives a code of its own `status: 500`.** Measured on @orpc/client 1.15.0:
`fallbackORPCErrorStatus` is `status ?? COMMON_ORPC_ERROR_DEFS[code]?.status ?? 500`, and
`PROVIDER_REFUSED` is not a common def. `apps/web/src/answer.ts` reads exactly that number to tell a
refusal from a fault and rethrows at 500 and above, so the declared error left a Server Action as a
throw and Next answered the bare `Internal Server Error` — the same eighteen bytes the undeclared
throw answered. **Declaring an error is not delivering one**, which ADR-0033 already says in those
words about these two procedures, and this is the second way it turns out to be true.

**`424` RATHER THAN `502`, AND THE OBVIOUS ONE IS THE WRONG ONE.** RFC 9110's gateway status is the
better literal fit — an inbound server answered badly — but it is a 5xx, and a 5xx in this app means
a genuine fault: rethrown at the action and logged with its stack at `/api/rpc` (ADR-0125). An
expired credential at a third party is neither a fault of this server nor something to page on. What
this catalogue already decided about the identical failure is on the READ side, where
`provider.container` answers it at 200 as an ANSWER, and a 4xx is that position held on the write
side. RFC 4918's `424` is the registered one that says it: "A method's execution has failed because
it depends on the execution of another method, and that other method failed."

**THE OTHER THREE CARRY ONE SINCE CNCORE-152, AND THE READING SPLIT WHERE THIS PARAGRAPH SAID IT
WOULD.** `NO_SUCH_RECORD`, `NO_SUCH_CONTAINER` and `BROWSE_NOT_OFFERED` were ANSWERS reaching the
Owner as bare 500s by the mechanism above. Each was asked separately, as a failure REASON is a
different question from what status an answer deserves; two of them gave the same answer and the
third did not.

**`404` FOR THE TWO MISSING-ID ANSWERS.** RFC 9110 15.5.5: 404 "indicates that the origin server did
not find a current representation for the target resource or is not willing to disclose that one
exists". The record or the container is the resource and the Provider is the origin server for it —
which ADR-0066 already makes an ANSWER rather than a failure, and which `provider.container` already
answers at 200 on the read side. `410` is the one that record prefers where the condition "is likely
to be permanent", and nothing here knows that: a wiki page deleted today can be restored tomorrow.

**`422` FOR A PROVIDER THAT DOES NOT OFFER BROWSE, BECAUSE IT IS NOT A MISSING THING.** A 404 here
would tell the Owner the container is not there, and nothing ever asked: ADR-0033 makes declining
`browse` well-formed, so what is absent is the OPERATION rather than the container, and the two have
different remedies — import the records one at a time, against check the id. **`501` is the closer
wording and wrong twice over.** It is a 5xx, so `answer.ts` rethrows it into the eighteen bytes this
section is about and `/api/rpc` logs a stack for it as though CanonCore were broken (ADR-0125); and
RFC 9110 15.6.2 scopes it to a server that "does not recognize the request method", where THIS server
implements browse perfectly well and the Provider does not. `405` is out on that record's own terms,
since the origin server "MUST generate an Allow header field in a 405 response" and the POST that
carried this really is allowed. What 422 says at 15.5.21 is this exactly: the server understands the
content type "and the syntax of the request content is correct, but it was unable to process the
contained instructions". **Mapping an ABSENT UPSTREAM CAPABILITY onto that sentence is CanonCore's
reading rather than RFC 9110's example**, which is semantically erroneous XML; the registry offers no
closer 4xx, and oRPC carries the same status under its own `UNPROCESSABLE_CONTENT`.

**THE RULE THE FOUR LEAVE BEHIND: A DECLARED ERROR DECLARES A STATUS, OR IT IS A 500 WEARING A NAME.**
oRPC's default is 500 for every code of this app's own, and 500 is exactly where `answer.ts` stops
handing answers back — so a procedure that adds a code and no status has narrowed its RPC surface and
changed nothing an Owner can see, and **its router test will pass while it does so.** That held for
all four codes on these two procedures, one ticket apart, and it will hold for the fifth.

### Asserted where an import failure is rendered

The reason crosses a package boundary, the wrapper above, a declared error's `data` schema, oRPC's
serialisation, a Server Action and `answer.ts` between the socket and the page, and the router's own
test proves none of it — which is exactly the argument the CNCORE-140 section makes about the client's
own test, one layer up. The status defect is the proof: every router assertion passed while the page
went on answering eighteen bytes.

**THE WITNESS PRESSES A BUTTON THE PAGE DREW WHILE THE PROVIDER WAS ALIVE**, because that is the only
way the state is reachable and is also the real one. `/import` offers nothing to press for a Provider
it cannot reach — the existing tests assert that — so a write can only fail this way if the Provider
stops answering between the GET that drew the button and the POST that presses it, which is an
expired `cf_clearance` exactly. A form field is input whoever rendered the form, which is what
`actions.ts` already says of these two in those words.

**AND THE PAGE THAT COMES BACK IS WHERE THE REASON IS**, which is the shape `/import` was already
built to: an action returns nothing and the page reports by re-reading, because `useActionState` is a
client hook with nothing to give when no script has loaded. So the read that offered the button is
the read that explains why it failed — the Owner lands back on the page and the Provider's sentence
is quoted there, beside the URL they typed.

**WHICH MEANS THE ERROR'S OWN `data` IS NOT WHAT THE PAGE PRINTS, and that is worth saying plainly
rather than leaving a reader to infer it.** The sentence an Owner reads after a failed Take or browse
comes from `provider.search`'s `failed` list or `provider.container`'s `unreachable` answer, mapped
by `reasonFor` exactly as it was before this ticket — `actions.ts` discards what a refusal carries,
which is the "it returns nothing and the page reports by re-reading" above read from the other end.
What `data` buys is the RPC surface, where a caller now reads the reason instead of a 500 with
nothing in it, and the SHAPE, so the two surfaces stop spelling one field two ways. **The page's half
of the fix is that there is a page at all: the status, not the payload.** A witness asserting only
the quoted sentence would therefore pass without any of this, which is why the status is the guard
and is said to be — checked by reverting the wrapper, which fails it `expected 500 to be 200`.

Carrying the reason itself through a redirect is what would have put the error's own text on the
page, and it is refused. A reason in a query parameter is a stranger choosing the text on a page it
does not own, arriving by a route with no boundary to ask `wrote` about — this record's opening
sentence with the attacker's half made easier, since anyone could author that link where today only
a Provider the Owner configured can author the sentence.

## A Provider's own name is bounded where the manifest is read (CNCORE-165)

This record's opening sentence — a stranger choosing the length and content of text on a page it
does not own — was true of one more field than it had counted, and it was the one that travels
furthest. A Provider's manifest `name` becomes the heading over its answers on `/import`, the
`label` on the Source row an import writes, and from there the name beside every value that source
claims on every Item page. Its only bound was `MAX_BODY_BYTES`, four mebibytes. Three sites
bounded Provider prose already — `reasonFor`, the credential's `label`, and `BrowseNotOffered`'s
sentence, which bounded this very name — and the fourth looked exactly like them, because a bounded
field and a raw one were both spelled `z.string().min(1)`.

### At the field, which is where the defect's shape says to put it

**Bounding at each surface is how this record's defect keeps recurring**, and it had just recurred:
`BrowseNotOffered` bounded `name` correctly while `providerFrom` and `provider.search` read the same
value raw. So `name` is bounded in `cmppManifest`, where a Provider's self-description ENTERS this
app, and nothing downstream can read the raw value at all. `boundedProse(whenSilent)` is the schema
form of `bounded`, published beside it, and the credential's `label` moved to it from `asDeclared`
in the same change. One mechanism for one rule; a label bounded one way and a name another would
have left the manifest unable to say which rule it followed.

**A FLOOR IS REQUIRED, NOT OPTIONAL.** Measured on zod 4.6.5, `min(1)` runs before a transform, so
`""` is refused outright and `" "` is what reaches the cap — which collapses it to nothing. An empty
name then fails the `min(1)` every surface declares on its output: a Provider crashing the request
that reads it, which is what `SILENT` prevents for a reason. `whenSilent` has no default because no
house sentence fits both fields.

### The rule a fifth field meets, and what enforces it

**Every string in the manifest is DECIDED AT ITS FIELD: bounded there, or named with the reason it
is not.** `cmppManifest` states it where a fifth field would be added, and `cmpp.test.ts` enforces
it: the test walks the schema through zod's public API and fails on any bare `z.string()` nobody has
named. Measured both ways: adding `description: z.string().min(1)` fails it, and so does `name`
spelled as it was filed. That is what the ticket asked for by "stated rather than left to review" —
the four surfaces before this one were each right because somebody remembered, and a comment is
still somebody remembering.

- **Prose CanonCore frames is `boundedProse`**: cut, and floored. `name`, `credential.label`.
- **Prose an obligation requires verbatim cannot be cut**, because `Attribution` prints a licence
  notice unaltered and cutting one is the breach it exists to prevent. So it is **refused past a
  ceiling, and the refusal is the whole manifest**: `attribution.notice` and `logo.alt` past
  `MAX_NOTICE_CHARS`, `logo.data_uri` past `MAX_LOGO_CHARS`. This said the first two were "NOT this
  record's decision" and left them to CNCORE-213, which decided them under "A licence's own words
  are refused, never cut" below.
- **A field never printed as text** is named with that reason: `operations`, `stored_variant`, and
  `unlock_path`, which `unlockUrlFor` judges before it reaches an href.
- **A record's fields are out of it.** A manifest is a Provider describing itself; a record is a
  source's claim, which the catalogue holds and the Owner curates, and cutting a title would corrupt
  the catalogue rather than protect a page.

**THIS RECORD STAYS `accepted`, AND THAT IS A CLAIM WORTH CHECKING.** What this section DECIDES is
built: framed prose is bounded at its field, and every string in the manifest is classified under a
test. It left one question open, how a verbatim notice is bounded, and the test named the two
fields against CNCORE-213 so neither could be mistaken for done. That ticket decided it and built
what it decided, and the test's reason for each field now names its ceiling.

### The output schema states it, and oRPC enforces it

`provider.search` and `provider.container` answered the name at four fields, each
`z.string().min(1)`. They share one `declaredName` schema now, carrying `max(REASON_MAX_LENGTH)`
exactly as `failureReason.text` and the settings `label` do.

**IT IS ENFORCED, WHICH IS MORE THAN THE WORD "STATES" SAYS.** oRPC validates every answer against
it. With the parse-side cap removed and the floor kept, every `/import` search answered **500** —
one Provider's name taking the page down for every other Provider on it — and eight tests in
`import-page.test.ts` failed on it. That is the right failure for what it now means: `cmppManifest`
bounds the name before any router code sees it, so a name past this ceiling can only be a bug in
this app, and a bug belongs in the log with its stack (ADR-0125) rather than on a page as a flood.

It is in the OpenAPI document too, and `route.test.ts` asserts it on the served document. CNCORE-165
wrote that test first, found every length in the API missing from the document, for the reason "As
built, under CNCORE-95" gives, and split the fix out because the fixed @orpc/zod peer-requires
`@orpc/server` and `@orpc/contract` at exactly its own version — the RPC stack moving together is
not a change about a Provider's name. CNCORE-212 moved it.

### Asserted at three seams, each proving what the others cannot

- **The parse** (`cmpp.test.ts`): a hundred-thousand-character name is cut, a whitespace name is
  floored, and the label is bounded where the manifest is read rather than where a page prints it.
- **The row** (`provider.test.ts`): an import from that Provider writes a bounded `sources.label`.
  The row outlives the request and is printed on pages the Provider does not own, and the parse test
  cannot prove nothing between the read and the write went back for the raw value. With the cap
  reverted it failed `expected 100000 to be less than or equal to 300`: the flood reached the row.
- **The page** (`import-page.test.ts`), beside `aProviderThatFloodsItsName`. **Run against the
  defect AS FILED** — no parse-side cap, and an output ceiling loosened so the flood passes it —
  exactly one of the file's thirty-two tests fails, and it is this one: the page printed the flood.
  It asserts the name IS listed as well as that no run of it exceeds the cap, because a page that
  dropped the Provider entirely would satisfy the second half alone.

**THE ITEM PAGE IS NOT A FOURTH WITNESS, and that is a judgement rather than an omission.** It prints
`sources.label` through the read path and can only print what the row holds, which the row test
asserts directly. A witness there would need a sixth catalogue imported through a flooding Provider
to assert the same string through a longer path.

### A cap on length is not a cap on width, which only walking it showed

Walked by hand on this branch under `next dev`, with a Provider whose name is `"flood"` twenty
thousand times: the longest run of the name anywhere in the `/import` document was exactly 300
characters, so the cap held. **And the heading still ran past the right edge of the viewport**,
because three hundred characters with no break in them are one unbreakable line. The Provider no
longer chooses how LONG the page is and still chooses how WIDE, by the kind of lever "THE CAP IS NOT
THE ONLY LEVER A PROVIDER HAS OVER A PAGE" records for bidirectional overrides.

Nothing in `apps/web` or `packages/ui` wrapped an unbroken word, so it was not this field's defect but
every 300-character surface's, reasons included, and where the wrap lives was a decision of its own,
taken under CNCORE-217 and recorded in the next section. No test in this section would have found it:
each asserts what the document CONTAINS, and this is how the document LAYS OUT.

## Where the wrap lives: a component, and not `body` (CNCORE-217)

**A PROVIDER'S PROSE IS PRINTED THROUGH `TheirWords`**, in `apps/web/src/components/their-words.tsx`,
which sets `overflow-wrap: anywhere` and nothing else. CNCORE-217 built it as `ProviderProse`, for a
Provider's text alone; CNCORE-223 renamed it and put a record's fields, an Item's values and a
Group's name through it as well, and ADR-0142 records why one component serves every writer. The contract bounds the length and this bounds
the width, and neither is the Provider's to choose. A new surface printing a Provider's text prints it
through this component. `Reason` wraps what it quotes, so a new reason surface gets the wrap without
having to know about it; `AssertedBy` wraps every name it lists, which covers the Item page's two
lists of sources and any list that reuses it, and is private to that page.

Every surface that printed a Provider's prose takes it: on `/import`, the heading over a Provider's
answers and the two container sentences naming it; `Reason`'s `provider` branch, wherever it is
rendered; the credential's `label` on settings; and on Item pages, a statement's source label,
`AssertedBy`, and the attribution notice. A source label is the Owner's, a sidecar's or a
computation's as often as a Provider's, and it is wrapped wherever it is printed because it is a
Provider's declared name whenever a Provider asserted the value.

**The notice was not on CNCORE-217's list** and was found by sweeping for every place a Provider's
text is printed. Wrapping it is not one of the transformations the notice's verbatim rule forbids,
because it changes where a line breaks and not a character of what is on it. **A note's source label
WAS on the list and is not wrapped**: the ticket inferred it, and the schema rules it out. `note`
declares `assertableBy` the owner alone, and the database refuses a note moved onto a Provider's
source (`constraints.test.ts`), so that label is never a Provider's.

CanonCore's own sentence in `Reason` is not quoted, because it is this app's own words, and since
CNCORE-226 it is wrapped, whole. This once printed it raw as well, for a second reason: that the
config boundary judges a URL the Owner typed, so every value in the sentence is the Owner's own
rather than a stranger's. That reason does not hold, since ADR-0142 measured the Owner's words
setting the page's width exactly as a stranger's do. The address inside the sentence is text the
page did not write, and the sentence reaches the page as one string, so the whole of it goes through
the component; ADR-0142 carries the measurement that says this breaks none of the page's words.

### `anywhere`, because `break-word` passes one witness and fails the other

Both values wrap a word that will not fit its line. They differ in whether the break counts when the
browser sizes the element, and that is the half a flex row turns on. Measured at 1,280 pixels, with a
Provider whose name is 300 characters of `flood`, as `{element, document}`: how far the element's
content runs past its own box, and how far the page runs past the viewport.

| rule | `/import`'s heading (a block) | a Values row on the Item page (flex) |
| --- | --- | --- |
| none | `{1092, 820}` | `{1205, 933}` |
| `break-word` | `{0, 0}` | `{1205, 933}` |
| `anywhere` | `{0, 0}` | `{0, 0}` |

**`break-word` leaves an element's min-content width at the whole word, and a flex item may not
shrink below its min-content.** So on the Item page the label's box grew to the word, the text sat
neatly inside the grown box, and the page scrolled. `/import`'s heading is a block, so `break-word`
wraps it, and a suite witnessing only the heading could not tell the two rules apart. That is why
there are two witnesses.

### A component, because one rule on `body` breaks this app's own words

The ticket named two places the wrap could live: a component, or one rule in `globals.css`. The rule
is the stronger guarantee, since no surface could forget it, and it was measured before it was
refused. **`overflow-wrap: anywhere` on `body` changed no element's box on any of ten pages at 1,280
pixels, and at 375 it wrecked the header.** It lets every flex item shrink below its own longest
word, and the header's `CanonCore` link became a column seventeen pixels wide and 336 tall, one letter
to a line, with `Works` and `Groups` beside it the same. A stranger's text breaking mid-word to fit
this page is the right trade. This page's own words breaking that way is not. So `anywhere` goes on
text whose shape the page did not choose and not on the page's own words, but for those that reach
the page in one expression with somebody else's, which ADR-0142 measures riding inside without
breaking. The component is that for a Provider's text and, since CNCORE-223, for everybody else's. It lives where `.claude/rules/frontend.md` puts a formatted value: in
`apps/web/src/components`, beside the pages that render it.

**THE OWNER'S TEXT IS THE SAME QUESTION FROM THE OTHER SIDE, AND IT IS ALREADY ANSWERED ONCE.**
CNCORE-179 put a raw `wrap-anywhere` on a Group's name on the Catalogue page, for the reason given
here: the Owner's words, with no cap. That site was not a Provider's prose and did not take this
component. Whether a Group's name, an Item's title and a record's fields share one component of
their own was CNCORE-223's question, and they share this one: the Group's name takes it in place of
the raw class (ADR-0142).

**THE HEADER ALREADY OVERRAN A 375-PIXEL VIEWPORT BY 231 PIXELS BEFORE ANY OF THIS**, measured
with no wrap rule at all. That is not this record's defect: it is the page before the phone client
([[0055-web-now-phone-next-tv-last]]), and the global rule would have traded it for something worse
rather than fixed it.

### What it did not cover: a record's fields, until CNCORE-223

This record's CNCORE-165 section keeps a record's fields out of the manifest's bound, because cutting
a title would corrupt the catalogue. The same is true of wrapping in the other direction: a record's
fields are not a Provider's prose in this record's sense, and CNCORE-217 did not put them through
`ProviderProse`. **A field with no break in it was therefore still a width lever, and an unbounded
one.** `/import` prints a search result's `title`, `kind` and `released` as flex items, each a
`z.string().min(1)` in `cmpp.ts` with no ceiling. That was inferred from the mechanism the table
measures and not walked here. It is a question about every Item's fields, whoever wrote them, rather
than about a Provider's prose, so it had its own ticket. CNCORE-223 walked it, a search result's
title running its row 1,754 pixels past its box, and put a record's fields through the same
component, renamed `TheirWords` (ADR-0142).

### Asserted in a browser, because only a browser can see it

The two witnesses are in `apps/web/browser/prose-width.test.ts`, which is [[0103-tests-bite-at-package-exports-and-the-router]]'s
sixth seam spending its third claim. That record's own test for a candidate is "could a `fetch`
observe it?", and a `fetch` observes what the document contains, not how it lays out. **Each witness
asserts both halves of `{element, document}`, because either half alone has a false green:** a block
keeps its box at its container's width while its text runs out of it, so the document half alone
could pass a page that clipped; and a flex item that grew to the word holds its text inside a box
that is itself off the page, so the element half alone passes the defect as it was filed.

**It is known to guard something.** Before the component, both witnesses failed at the figures in the
table's first row. With `wrap-anywhere` swapped for `wrap-break-word`, the heading passed and the
Values row failed at `{1205, 933}`: the witness the second rule needs, failing on exactly the rule
it exists to refuse.

## A licence's own words are refused, never cut (CNCORE-213)

A Provider's `attribution.notice` and its mark's `alt` reach every Item page that shows the source's
claims. Until CNCORE-213 their only bound was `MAX_BODY_BYTES`, four mebibytes, and they were
spelled `z.string().min(1)` exactly as `name` had been. `boundedProse` is the wrong tool for them.
`Attribution` prints a notice verbatim because a paraphrased licence notice breaches the licence as
surely as a missing one ([[0036-tmdb-licence-constraints]] checked TMDB's character for character),
and a cut is a paraphrase. So the bound is a refusal, as `logo.data_uri`'s
already was.

### The ceiling is 1,000 characters, for both

TMDB's notice, as `provider-tmdb` declares it and every fixture holds it, is 107 characters, and its
alt is 86, measured 2026-09-19. `MAX_NOTICE_CHARS` is 1,000, about ten times either. The alt takes
the same ceiling because it is a notice too: it carries TMDB's no-endorsement sentence for the
reader who cannot see the mark.

A notice past the ceiling costs the whole Provider (below), so the ceiling sits well above any
sentence a licence plausibly asks for. It is still a paragraph, rather than four mebibytes on every
Item page. A character here is what zod's `max` counts, a UTF-16 code unit, as for `MAX_LOGO_CHARS`.

### The refusal is the whole manifest, and that is the choice

A refusal on a field inside `cmppManifest` refuses the manifest, so a Provider with an over-long
notice answers no search and no import. Two answers were open, and this record takes the first:

1. **Refuse the manifest**, as `data_uri` does.
2. Refuse only the attribution, so the Provider stays usable and owes a notice it cannot print,
   with the Item page saying so.

**THE NOTICE IS THE CONDITION FOR SHOWING THE CONTENT, so a Provider whose notice cannot be printed
has no content that can be shown.** Refusing the manifest stops that content at the door. Every
search, import and browse reads the manifest before it asks for anything else, so nothing arrives.
Refusing only the attribution would import the content anyway and then print, on a public Item
page, that the page owes a notice it is not printing. That is the breach, published with an
admission beside it. It would also need a state the Source row cannot hold: a null
`attribution_notice` means the source owes nothing, so "owes one it cannot print" would be a new
column, a new read-path field and a new branch on the page, all built to render a breach.

**`unlockUrlFor` argues the other way, and its argument does not transfer.** It withholds a bad
unlock link rather than refusing the manifest, because "refusing the whole manifest would report a
reachable provider as unreachable". There the link is one affordance on a Provider whose content is
fine to show, and the Provider's state is worth reading without it. A notice is not an affordance.
Without it, none of the Provider's content can be shown.

**AND THE SETTINGS PAGE DOES NOT SAY "UNREACHABLE".** A manifest this app will not parse already
lands in `Reach`'s `unreachable` kind, which the page renders as "Nothing could be read from this
Provider." with the reason quoted as the Provider's. That sentence is true of this case. **`/import`
SAYS THE SAME SINCE CNCORE-221.** Until then it listed a search this Provider failed under "Could
not be reached", which `NotReached` on the same page calls false of any Provider that answered. That
heading was already wrong for a `500` or a malformed manifest, so it was not this refusal's defect;
it now reads "Nothing could be read from these providers". Measured on zod 4.6.5 against a
four-mebibyte notice, the reason is zod's issue list, 183 characters once collapsed to one line:

    [ { "origin": "string", "code": "too_big", "maximum": 1000, "inclusive": true, "path": [ "attribution", "notice" ], "message": "Too big: expected string to have <=1000 characters" } ]

It is inside `REASON_MAX_LENGTH`, it names the field and the ceiling, and it carries none of the
value, because zod's `reportInput` defaults to `false` and nothing here sets it.

**A THIRD SHAPE WAS AVAILABLE, AND IT IS NOT TAKEN.** The settings page could report "reached, but
owes a notice past the ceiling" while search and import went on refusing. That buys a sentence the
reason above already says, at the cost of a manifest read two ways: refused for use and admitted for
display. What the Owner loses without it is the refused Provider's credential state and Unlock link
on that page, since both are read off the manifest that was refused. Nothing from that Provider
can be used either way, so there is nothing for an Unlock to unblock.

### What it leaves as it was

- **Content already imported keeps the notice its Source row last held.** Only an import rewrites
  the row, and an import from a refused Provider fails before it reaches it. So if a Provider
  revised its notice past the ceiling, its existing content would go on printing the previous one,
  which `providerFrom` calls "the same breach as showing none". That is the residual, and the
  ceiling's generosity is what keeps it hypothetical. It is not a new hole: a Provider whose
  manifest fails to parse for any other reason leaves its row the same way, and in both cases the
  Owner is told on the settings page.
- **Purge still works.** `provider.purge` goes straight to `purgeProvider` with the Source's
  identity and never reads a manifest, so a Provider refused here can still be purged under a
  termination notice.
- **The read path does not restate the ceiling.** `attributionPublic.notice` stays `z.string()`, as
  `sourceLabel` stayed unbounded there after CNCORE-165. Everything that writes the column parses
  the manifest first, and restating the ceiling on `item.get`'s output would turn a row written by
  hand into a 500 on a public page. **That is not the argument `attributionPublic.logo.dataUri`
  rejects**, where the read path restates the wire's regex so it is "a shape" rather than "a rule
  somebody remembers". The regex guards a SINK: a string that fails it is not a mark, and is not
  put in an `img`'s `src` at any cost. The length guards a COST: an over-long notice is still the
  notice, and a 500 would print no notice at all along with no page.
- **A ceiling on length is not one on width.** A thousand characters with no break in them run off
  the page as three hundred do, and that is CNCORE-217's, for every surface.

### Asserted at three seams, as the name is

- **The parse** (`cmpp.test.ts`): TMDB's notice and alt parse whole and unaltered, and so does one
  of exactly 1,000. One character past, on either field, refuses the manifest with one issue whose
  path names that field. VERIFIED BY BREAKING IT: with the ceiling at 100, the admitting test
  fails, because TMDB's own notice is refused.
- **The row** (`provider.test.ts`): an import from such a Provider answers `PROVIDER_REFUSED`,
  attributed to the Provider, with a reason naming `"attribution", "notice"`, and writes no Source
  row. Every row an import writes names its Source, so no Source row means nothing arrived.
  VERIFIED BY BREAKING IT: without the ceiling it fails `expected a defined error, got null`,
  because the import succeeded.
- **The page** (`settings-page.test.ts`): the Provider's row says nothing could be read from it and
  quotes zod's `too_big` at `attribution.notice`, and the notice is nowhere on the page. VERIFIED BY
  BREAKING IT: without the ceiling the row said nothing at all, and the test failed on it.
