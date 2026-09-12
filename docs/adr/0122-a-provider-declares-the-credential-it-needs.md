---
status: accepted
---

# A provider declares the credential it needs, and CanonCore links to it rather than carrying it

A CMPP provider reaches an upstream CanonCore knows nothing about. Some upstreams want nothing;
some want a token; `provider-wiki` wants a browser session, because tardis.wiki sits behind a
Cloudflare challenge page that only a person can pass ([[0069-the-first-provider-is-the-wiki]]).
**It is a challenge page and not Turnstile**, which is the widget a site owner embeds; probed
2026-09-12, the response carries `cf-mitigated: challenge` and the word "turnstile" appears in it
zero times. An earlier draft of this record said Turnstile.

**The manifest gains an optional `credential`**: a label, the fields it wants, the path the OWNER
goes to in order to supply them, and the state it is currently in. A provider that needs nothing declares nothing and every
existing provider stays conformant, because `manifest` is a `looseObject` and this is an addition
rather than a change ([[0032-cmpp-versions-array]] governs the version, and an optional field does
not move it).

**CanonCore shows the label and the state, and LINKS to the provider's own unlock path. It does not
render the fields and it does not carry the answer.** An earlier draft had it rendering a form and
forwarding what the owner typed; that is corrected below rather than left standing, because the
credential must not enter CanonCore at all — not even in transit.

## The declaration half is ordinary; carrying the answer is what the ecosystem refuses

**Declaring a credential in self-served metadata is established practice and needs no defending
here.** Home Assistant's config flows are the direct precedent: the integration declares its schema
server-side and the frontend renders it. VS Code's `languageModelChatProviders` does the same, and
**RFC 9728** (April 2025) is the standards-track form of it — a resource publishes its own auth
requirement and a client discovers it. This record takes that half as read.

**Carrying the answer through the host is the part two owners prohibit by name.** The **Model Context
Protocol**, revision 2026-07-28, has this exact mechanism and carves credentials out of it: *"Servers
MUST NOT use form mode elicitation to request sensitive information such as passwords, API keys,
access tokens, or payment credentials"*, and where a third party is involved *"the third-party
credentials MUST NOT transit through the MCP client"*. **BCP 240 / RFC 9700** (January 2025) removed
OAuth's password grant for the same reason: *"credentials can leak in more places than just the
authorization server."*

**And "stores nothing" was a weaker claim than it sounded.** It buys NOT AT REST. It does not buy
NEVER SEES IT: a forwarded credential still passes through CanonCore's request handler and HTTP
client, which is exactly the surface BCP 240 means by "more places". An earlier draft of this record
rested on that distinction without noticing it.

**So the link is not a lesser version of the form; it is what the form was reaching for.** The owner
clicks through and gives the credential to the provider. CanonCore shows what is needed and whether
it is satisfied, which is all it has any business knowing. MCP, Authelia and Jellyfin all landed
here. It also costs nothing that was wanted: the owner still sees the need, the state and when it
lapsed, without a terminal.

**Storing it stays refused, for one reason rather than the two an earlier draft gave.** A
`credential` column on the Settings store, beside the providers an instance names
([[0121-an-instance-names-its-providers-beside-the-allowlist-that-admits-them]], built under
CNCORE-99) would put one
provider's upstream secret in CanonCore's database, and nothing else in this product is a secret at
rest — [[0035-ship-no-api-keys]] is the same instinct pointed outward. The other reason, that a
stored credential would have to travel on the CMPP request and grow a header every provider must
ignore, is sound and now moot: nothing travels.

## The provider writes it to its own config directory

Not memory. A container restart is ordinary — a deploy, a crash, a reboot — and a provider that
forgot its credential on every one of them would be the treadmill this design exists to avoid. The
file is `~/.config/canoncore/wiki-session.json` for `provider-wiki`.

**THIS IS A NEW SHAPE, AND AN EARLIER DRAFT OF THIS RECORD CLAIMED OTHERWISE.** It said the file was
"the shape `provider-tmdb` already uses". That is false and it was checked: `provider-tmdb` reads
`TMDB_READ_ACCESS_TOKEN` from the environment and **throws at startup** without it, with no config
directory and no runtime re-read. `CLAUDE.md` says that provider "runs locally from
`~/.config/canoncore/provider-tmdb.env`", which is how the owner supplies that environment variable —
not how the provider stores anything.

**THE FILE IS THE SOURCE OF TRUTH, NOT THE FORM**, and that is deliberate rather than incidental.
Anything that can write the file can unlock the provider: the form, a script the owner runs, a
scheduled job. The provider does not know or care which. That seam is what stops the provider
growing a browser inside it, and it is why the unlock mechanism can change later without the
provider changing at all.

## The manifest reports the state, because only the provider knows it

`credential.state` is `absent`, `valid` or `expired`, with the time it last changed. CanonCore
already fetches each manifest, so the settings page renders a status it was going to ask for
anyway — no polling, no health check the contract does not define.

The provider is the only thing that can know. It is the one being refused by the upstream, and a
credential's validity is not something CanonCore could test without performing the provider's own
job.

## What happens with no credential

The provider stays up, answers its manifest, and fails each operation with its own reason. It does
NOT refuse to start, and it does NOT fall back to a local corpus.

**Refusing to start makes a locked provider look like a dead host**, which is the wrong diagnosis
shown to the one person who can fix it.

**AND `provider-tmdb` TAKES THE OPPOSITE POSITION, WITH A REASON, so this is a disagreement between
siblings rather than an oversight.** Its own words: *"a container that runs and errors on every
request looks healthy to anything watching the process, while one that refuses to start says what is
wrong once, in the place someone is reading."* That is right for a credential set once in an
environment variable and wrong for one that expires — on that rule a provider whose session lapsed
would die and stay dead until somebody noticed the container had gone. The two differ because their
credentials differ in LIFETIME, and if TMDB's ever becomes renewable this record is the one to
revisit. **Falling back to a corpus is worse**: it makes an expired
session look like a thin wiki. That is [[0033-search-lookup-required-browse-optional]]'s rule as
CNCORE-92 built it — a provider that cannot reach its source must say so, because a refusal
reworded is not a refusal reported.

ADR-0033 keeps `search` and `lookup` mandatory, so a locked provider still declares all three
operations. It is not half a provider; it is a whole one that currently cannot answer.

## What this does not decide

**Whether the owner's one click can ever be removed.** Getting the credential is outside the
contract and outside this record: a person in their own browser today, something else later. The
file is the interface, and this record deliberately says nothing about who fills it.

**Whether `provider-tmdb` adopts it.** It could declare a credential and serve its own unlock path,
but nothing here obliges it and a working thing is not changed for symmetry. It would also have to
stop throwing at startup, which is its own decision with its own reason behind it.

## As built, under CNCORE-98 AND CNCORE-101 — BOTH HALVES, WHICH IS WHY THIS IS `accepted`

**The provider half landed first and the CanonCore half followed.** The provider half is
`jacobdrees-canoncore/provider-wiki#23`, squashed to `a550681` on that repo's `main` — named here
because no PR in a provider repo reaches this directory, so a reader checking what this section
claims has nothing else to check it against. It gave CMPP's manifest the optional `credential`
(`packages/contract/src/cmpp.ts`), made `provider-wiki` declare one, serve `/unlock` and write
`~/.config/canoncore/wiki-session.json`, and held any provider declaring one to the round trip over
HTTP in the contract suite.

**CNCORE-101 is the half in this record's own title, and it is what flipped it.** CanonCore's
consumer schema now reads the declaration, `settings.read` answers what each named Provider had to
say for itself, and `/settings` renders the label, the state and a LINK to the Provider's own unlock
path. `provider-tmdb` is untouched, as the record says it may be.

**A CROSS-REPO PAIR FLIPS ON THE SECOND TICKET**, which is why this section could not be written
under CNCORE-98 however finished the provider looked from outside: `docs/adr/` is in THIS repository
and no PR in a provider repo reaches it.

### What building it taught, which the record did not say

**`expired` needed a WRITER, and the record named the state without naming one.** Only a refusal
tells you a session has lapsed — [[0069-the-first-provider-is-the-wiki]] measured a `cf_clearance`
dead eight days after capture while its own `expires` still claimed 2027-09-03 — so a provider
computing expiry from the cookie's stated lifetime would report `valid` about a session the wiki had
already stopped accepting. The file therefore carries a `lapsed` marker written by whatever met the
refusal, and `expired` is read from it. That keeps the asymmetry this record wants: nothing
DERIVES the state, everything READS it.

**"When that last changed" is the file's mtime rather than a timestamp inside it**, and that is what
keeps "anything able to write the file can Unlock the Provider" true without a clause. Every state
this provider can report is reached by WRITING the file, so the filesystem already records the
answer; requiring the writer to stamp one too would mean a script that wrote the credential and no
timestamp had half-unlocked the provider.

**A file that exists is not a credential, and there is no fourth state to say so in.** Empty,
truncated, valid JSON of the wrong shape and a field present-but-blank all report `absent`, because
from the Owner's side the provider holds nothing it can answer with — and `valid` would send them
looking at the wiki for a fault that is half a `cp`.

**The declared path is a PATH and not a URL**, which is the one place in CMPP that distinction is
load-bearing. Every other URL the contract carries comes FROM the source and is rendered to a
reader; this one addresses the PROVIDER, which does not know the URL CanonCore reaches it on — one
behind a proxy could not — and CanonCore holds that base URL already.

**The contract had to pick a body shape, because "a script can supply it" is not a contract until
the script knows what to send.** JSON is required of a provider that declares a credential and
anything else is permitted beside it; `provider-wiki` also takes a form submission, because the
Owner arrives at a page rather than at a terminal.

**Proving the round trip means performing it, so the contract suite UNLOCKS every provider under
test**, replacing whatever it held. There is no way to assert "POST the declared fields and it
reports valid" without POSTing. That suite is CI's, against ephemeral service containers, and it is
not CanonCore carrying a credential — `packages/contract` depends on no `@canoncore/*` package and
the app is absent from that seam entirely. Pointed by hand at a provider holding a real one, it will
overwrite it, and both provider READMEs say so.

**The unlock route authenticates nobody AND refuses exactly one caller, which is not the same thing
as either extreme.** The file is the source of truth, so anything that can write it can already
Unlock the provider, and a login on the route would guard one writer while leaving the others open.
But that argument has a hole this record did not see, found in review: **a page on another site
cannot write the file and can still make the OWNER'S OWN BROWSER submit the form.** Form encoding is
a CORS-simple content type, so no preflight stands in the way and the attacker never needs to read
the answer — the write lands and the Owner's session is gone. An earlier version of this paragraph
said the exposure was bounded by where the provider listens, loopback by default; **loopback is not a
boundary against the Owner's own browser**, which is the client this design sends to the unlock page
on purpose.

So the route refuses a cross-site BROWSER submission and nothing else, told apart by
`Sec-Fetch-Site`. That header cannot be forged by a page: the `Sec-` prefix makes it a forbidden
request header, set by the browser from the real request context, and it has been Baseline across
browsers since March 2023. A request carrying no such header — a script, a scheduled job, `curl` — is
allowed, which is the point rather than a gap: those are precisely the writers this record means to
keep.

### What the contract had to decide that this record does not

Two obligations fall on every provider that declares a credential, and neither is written above.
They were settled in `packages/contract/src/contract.test.ts` because a conformance suite cannot
assert a round trip without them, and they are recorded here so the next provider meets a decision
rather than a test:

**The declared `unlock_path` must ANSWER** — anything below 400 — because the Owner reaches it by
clicking a link and a path that addresses nothing leaves them with no way in at all. Reachable
rather than HTML: a provider may serve a form, or redirect to wherever its own upstream takes a
person.

**A submission missing a declared field must be refused with 400**, rather than stored in part. Half
a credential stored is a provider reporting `valid` about something its upstream is about to refuse,
which points the Owner's diagnosis at their source for a fault that is in the form they just
submitted.

### What the CanonCore half taught, under CNCORE-101

**A LEADING SLASH DOES NOT KEEP THE LINK ON THE PROVIDER, AND THIS RECORD IMPLIED IT DID.** The
contract requires `unlock_path` to start with `/` and gives the reason as a relative path joining
against the base URL's last segment — a 404 argument, which is true and is not the dangerous one.
Measured on node 24.19.0 against `http://provider-wiki:8080`, three spellings satisfy
`startsWith("/")` and resolve to `http://evil.test/`:

| declared `unlock_path` | resolves to |
| --- | --- |
| `//evil.test/unlock` | `http://evil.test/unlock` |
| `/\evil.test/unlock` | `http://evil.test/unlock` |
| `/⇥/evil.test` (leading tab) | `http://evil.test/` |

The WHATWG parser reads a backslash as a second slash and strips leading tabs before it reads the
rest, so no check on the STRING can see what the JOIN does. **Where this lands is what makes it
matter rather than untidy**: a Provider is an untrusted URL ([[0031-a-provider-is-a-url]]), and this
value goes into an `href` the Owner is asked to click and then type a credential into. It is the one
place in this design that could hand a stranger the very credential the design exists to keep out of
CanonCore's hands, and this record's central refusal would have been satisfied on paper while being
defeated in practice.

So `unlockUrlFor` JOINS AND THEN COMPARES ORIGINS, and answers `null` where the origin changed. The
label and the state still render — the Provider is up and what it says about itself is still worth
reading — and only the link is withheld, for the reason this record gives for a locked provider not
refusing to start: refusing the whole manifest would report a reachable Provider as unreachable,
which is the wrong diagnosis shown to the one person who can fix it.

**THE CONTRACT IS NOT TIGHTENED TO MATCH, DELIBERATELY.** It could refuse these three spellings, and
that would be belt and braces rather than the mechanism: the contract binds providers that WANT to
conform, and the whole premise here is a Provider that may not. The check has to live where the
value is used, so that is where it lives — and a conformance suite passing would otherwise start to
look like a reason for the consumer not to check.

**THE OWNER'S BROWSER HAS TO REACH THE PROVIDER, AND THIS RECORD NEVER SAID SO.** Every other URL in
CMPP is fetched by CanonCore, whose allowlist says what it may reach ([[0034-two-outbound-boundaries]]);
this one is followed by the OWNER. A Provider at `http://provider-wiki:8080` — a container hostname,
which is the spelling this repository's own examples use — is reachable by the app and not by the
person reading the page, so the link resolves to nothing in their browser. That is a real cost of
choosing a link over a form and it is not a defect to fix here: the address the Owner needs is a
deployment fact CanonCore does not hold, and inventing one would be guessing. It is written down so
the next reader meets it as a known consequence rather than as a bug.

**`admitted: boolean` BECAME A THREE-WAY ANSWER.** The settings surface has to tell "this Provider
needs Unlocking" from "this Provider cannot be reached" from "this Provider is not admitted by the
allowlist", which this record requires and a boolean cannot carry. It is a discriminated union in
the procedure's own output schema, so the OpenAPI document says the impossible combinations are
impossible: a credential belongs only to a Provider that answered, a reason only to one that did
not. [[0121-an-instance-names-its-providers-beside-the-allowlist-that-admits-them]] carries the
correction where it described the old field.

**THE DECLARED LABEL IS PROVIDER PROSE, AND NOTHING HAD BOUNDED IT.**
[[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]] caps what a Provider can put on the
Owner's page, and its argument — "a stranger choosing the length and content of text on a page it
does not own" — reaches the label exactly as it reaches a reason, which neither record had noticed.
The contract bounds it only by `min(1)`. It now goes through that record's own cap, and the page
quotes it beside the named Provider, so a Provider cannot flood the settings page and cannot be read
as CanonCore speaking.

**THE CREDENTIAL IS KEPT OUT STRUCTURALLY RATHER THAN BY A RULE ANYBODY REMEMBERS.** CanonCore's
consumer schema is a `z.object` where the contract's is a `looseObject`, so `fields` — the
contract's list of what the Owner supplies — is STRIPPED on the way in. There is no property
anywhere in this app for a credential value to sit in, which is a stronger guarantee than a
convention that nothing reads one: the day somebody reaches for the form again, they have to widen
a schema to do it.
