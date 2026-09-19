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

**THE AXIS IS THE CONTAINER, NOT THE RESTART, AND FOR A DAY THE FILE DID NOT SURVIVE A NEW ONE.**
Checked 2026-09-13: `provider-wiki`'s Dockerfile creates `/home/node/.config/canoncore` and declares
**no `VOLUME`**, so the credential lived on the container's writable layer. Docker documents one rule
about that layer — it is deleted when the container is — and everything else follows from it rather
than from a list of cases. Anything that is the SAME container starting again keeps the file: a
restart, a crash under a restart policy, a host reboot. Anything that REPLACES it loses the file: a
deploy, `compose down`, `--force-recreate`, `docker rm`, a prune, and any edit to the service's
compose config that triggers recreation. A deploy is the one this record named first, and it is the
one Compose does routinely.

An earlier version of this paragraph enumerated four cases and attributed the split to Docker.
Docker states only the deletion rule; the rest was inference, correct but wrongly sourced. The file
is still the right shape and this was never a reason to reopen that — what was missing was the one
declaration that makes it outlive the container it is written in, **and CNCORE-164 added it**
(`jacobdrees-canoncore/provider-wiki#31`). That repository now ships a `compose.yaml` mounting a
named `provider_wiki_credential` volume at `/home/node/.config/canoncore`, so every case in the
paragraph above keeps the file, the replacing ones included. A `VOLUME` line in the Dockerfile would
NOT have done it: that makes an anonymous volume, which a replacement container does not re-attach
to, so it would have survived exactly the restarts that were never the problem.

**AND THE SENTENCE THAT FOLLOWED THIS ONE SAID NOTHING DECIDES HOW THE PROVIDER IS RUN, WHICH IS NOW
FALSE.** It read: "nothing in either repository decides how this Provider is run, so the crash and
reboot cases depend on the Owner's own invocation: under `docker run --rm` a crash takes the
container and the credential with it." The same `compose.yaml` decides them — it declares `restart:
unless-stopped`, which is what the app's own install path chooses — so the crash and reboot cases
are the install path's rather than the Owner's invocation's, and `docker run --rm` describes a way
of running this Provider that its own repository no longer documents.

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
operations. It is not half a provider; it is a whole one that currently cannot answer. **AND
DECLARING AN OPERATION IS NOT ANSWERING IT, WHICH THIS PARAGRAPH LEFT UNSAID UNTIL CNCORE-141.** A
locked provider declares all three and can satisfy neither of the two that read its source, so what
it OWES those two is an obligation in its own right — written with the others the contract had to
decide, below. Until it was, CMPP held every participant to `200` and a record, this record said the
opposite in prose, and both were correct: the contradiction surfaced as CanonCore's contract job
going red the moment `provider-wiki:latest` was republished from `main`.

## What this does not decide

**Whether the owner's one click can ever be removed.** Getting the credential is outside the
contract and outside this record: a person in their own browser today, something else later. The
file is the interface, and this record deliberately says nothing about who fills it.

**Whether `provider-tmdb` adopts it.** It could declare a credential and serve its own unlock path,
but nothing here obliges it and a working thing is not changed for symmetry. It would also have to
stop throwing at startup, which is its own decision with its own reason behind it.

## Whole, under CNCORE-98, CNCORE-101, CNCORE-164 and CNCORE-163

**IT READ `accepted` FROM 2026-09-12 UNTIL 2026-09-13, WENT BACK TO `proposed`, AND IS `accepted`
AGAIN FROM 2026-09-14.** The middle state was the convention rather than a reversal. Both halves of
the CNCORE-98 pair did land, which is what the first flip claimed; what the corrections above then
established is that the MECHANISM was not whole. Two things were missing, and both now exist:

- **The credential outliving its container**, which was CNCORE-164 and is
  `jacobdrees-canoncore/provider-wiki#31`. A named volume mounted at the config directory, so a
  deploy, a `down` and an `up`, or a `--force-recreate` keeps the Owner's session.
- **A route from an installed instance to a Provider beside it**, which was CNCORE-163 and is the
  `canoncore_providers` network this repository's `compose.yaml` now creates. Without it the Unlock
  link this record chose over a form pointed at a Provider the app could not reach at all.

**THE FLIP IS ON THE SECOND TICKET AND THIS IS IT**, which is `CLAUDE.md`'s rule for a cross-repo
pair: `docs/adr/` is here and no PR in a provider repo reaches it, so the provider half could not
flip anything. CNCORE-164's merged PR is named above so a reader can check the assertion against a
diff rather than take it on trust.

**AND THE ROUTE IS WALKED RATHER THAN ASSERTED**, under "AND THE HALF THIS ASSUMED AWAY WAS NOT TRUE
EITHER" above: an install, a Provider beside it, a search answering, and an item imported and
standing in the catalogue. **The route, and not this record's own subject.** The Provider walked was
`provider-tmdb`, which declares no `credential`, so nothing in that walk exercised a declaration, a
state or an Unlock link; `provider-wiki`, which does declare one, will not run on an arm64 host
(CNCORE-189). The mechanism is whole and each half is checked — the credential half by the volume
`provider-wiki` now mounts, the route half by the walk — but no single pass has yet run this
record's whole sentence against an install, and [[0132-a-project-is-not-finished-until-it-has-been-used]]
is the standard that says so out loud rather than letting the flip imply otherwise. The Unlock link's own destination — the
Provider's published port in the OWNER'S browser, not the container hostname — is a deployment fact
this record still does not hold, which the section above says out loud and `provider-wiki`'s README
answers for itself.

## As built, under CNCORE-98 AND CNCORE-101 — both halves of the cross-repo pair

**The provider half landed first and the CanonCore half followed.** The provider half is
`jacobdrees-canoncore/provider-wiki#23`, squashed to `a550681` on that repo's `main` — named here
because no PR in a provider repo reaches this directory, so a reader checking what this section
claims has nothing else to check it against. It gave CMPP's manifest the optional `credential`
(`packages/contract/src/cmpp.ts`), made `provider-wiki` declare one, serve `/unlock` and write
`~/.config/canoncore/wiki-session.json`, and held any provider declaring one to the round trip over
HTTP in the contract suite.

**CNCORE-101 is the half in this record's own title, and it is what flipped it at the time** -- a flip since reverted, for the reason the section above gives. CanonCore's
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

Four obligations fall on every provider that declares a credential, and none is written above.
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

**And under CNCORE-207: a complete submission is either HELD — below 400, the state `valid`, the
moment it changed moved — or, by a provider that Spent it and was refused, REFUSED with `400` and a
JSON body, leaving the state and the moment exactly as they were.** No third answer is conformant.
The section at the end of this record carries why.

**And under CNCORE-141: a provider whose declared `credential.state` is not `valid` owes `search`
and `lookup` a `503` with a JSON body — while one reporting `valid` is still held to `200` and a
record.**

`CONTEXT.md` already carried the claim in the product's own words, under **Unlock**, and the
contract simply did not encode it: a Provider with no Credential "stays reachable and answers nothing, saying so — it is not
broken and it is not empty". **Those are TWO wrong answers rather than one**, and naming both is what
makes this an obligation instead of a permission:

- **Not broken** rules out a dropped connection, a bare `500`, and refusing to start — which this
  record already refuses above, because it shows a dead host to the one person who can fix it.
- **Not empty** rules out `200 {"results":[]}` from `search`, and the record `lookup` owes an id its
  source holds. "Nothing matched" is a claim ABOUT THE SOURCE, and a provider that cannot reach its
  source has not established it — it has established that it does not know. It is the fallback this
  record refuses by name, in its cheapest form: an empty corpus rather than a thin one.

**AND THE REFUSAL DOES NOT DISPLACE THE CALLER'S OWN MISTAKE, WHICH A FIRST BUILD OF THIS GOT
WRONG.** A missing or blank `q` is still `400`, and an id that addresses nothing in the provider's
own id space is still `404` — both are settled BEFORE the source is reached, so neither is a claim
about it. `provider-wiki` is built exactly this way: `lookup` rejects anything but `^\d{1,18}$`
before the wiki is touched, which is [[0066-path-is-identity-query-is-the-route]]'s rule that an id
which cannot BE an identity is an address with nothing at it. **The measurement settled it**: with
`provider-wiki` locked, CI's contract job failed THREE assertions and the `404` one was not among
them (run 34752451432: "answers candidates in one shape", "answers a query it matches nothing for as
an empty result", and "answers one record, in one shape, at the id it was given" — while "reports an
id it does not hold as an answer, not as a failure" passed). A contract that refused here too
would have reddened a passing assertion, and would hide a caller who forgot the parameter behind a
credential problem.

**What this leaves NOT under test is a WELL-FORMED id a provider would have to consult its source
about**, which a locked provider owes a refusal rather than a `404`. No fixture in the suite is one,
and inventing an id that is well-formed for every provider at once would be a claim about their id
spaces that CMPP does not make.

**`!== "valid"` RATHER THAN `=== "absent"`.** `expired` is a session that lapsed, which is this
record's whole reason for having the state at all, and a provider holding one can answer exactly as
little as a provider holding nothing. A rule naming only `absent` would oblige a provider whose
credential had just expired to invent an answer.

**THE DECLARATION IS READ BEFORE THE CALL, NOT AFTER, and that ordering is the rule rather than an
implementation detail.** The manifest is a PROMISE and the contract checks the answer against the
promise that was standing when the call was made. Read afterwards, a provider that reported `valid`,
was refused by its upstream mid-call and came back reporting `expired` would have its refusal
excused by the very lapse the call caused — the suite going green on a provider that had just been
refused, which is this record's own mis-diagnosis arriving through the test that checks it. It also
keeps the suite's ordering honest: `its credential` unlocks every declarer that holds what it is
given — every declarer, until a provider began Spending under CNCORE-207 — and runs after these, so
a reorder makes them RED rather than quietly re-filing the credential test's subject as a locked
provider.

**WHAT IS DELIBERATELY NOT REQUIRED IS THE BODY'S SHAPE.** `provider-wiki` answers
`{error, provider}`, bounded and attributed per
[[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]], and that spelling is ITS OWN. CMPP is
the intersection every provider must satisfy, and with exactly one provider declaring a credential
there is no intersection to take — requiring its shape would be writing "be `provider-wiki`" into
the contract, which is the mistake `cmpp.ts` records itself having made once over an image's
`width`. What the contract requires is that SOMETHING came back as JSON, so a refusal carrying a
reason can be told from a provider that fell over. The next provider to declare a credential is
where the body's shape becomes a question worth answering.

**WHAT THE CONFORMANCE SUITE STRUCTURALLY CANNOT WITNESS is a provider that DECLARES a credential,
reports `valid`, and answers.** It holds only a dummy — a real one reaching CI would be distribution
([[0089-provider-distribution-tiers]]) — so asking a real provider that HOLDS what it is given to answer after the round
trip would send that dummy upstream, be refused, and lapse the session the round trip had just
reported `valid`. A provider that Spends never holds the dummy at all (CNCORE-207), which changes
nothing here: it is still `absent` after the round trip and has nothing to answer with. That is why `search` and `lookup` run BEFORE the credential block, and it is a limit of the
instrument rather than an omission. Two things stand in for it: `provider-tmdb` and the `browse`
witness declare no credential and are held to `200` and a record throughout, and a guard added
beside this record's optionality test fails if EVERY participant is unable to answer — the refusal
is a permission for one provider, never a branch the whole suite may take. The remaining claim, that
Unlocking changes what a provider answers, is asserted against the witness alone in
`packages/contract/src/participants.test.ts`, where no real provider is involved.

**AND THE CASE IS WITNESSED ON EVERY MACHINE, not only where the image can be pulled.**
`provider-wiki` is the only real provider that declares a credential, its image is private on GHCR,
and CI gives it nothing — so the branch was entered nowhere a developer could run it, and this
record's own optionality guard failed outright there (measured: `Tests 2 failed | 48 passed`).
`lockedProvider()` in `participants.ts` is a second conformance witness alongside the one ADR-0033
has: well-formed, reachable, currently unable to answer, and Unlockable, on a real socket and
indistinguishable to the suite from a real provider.

**THE FIXED POINT THROUGHOUT WAS THAT NO CI JOB HOLDS THE OWNER'S SESSION**, and the contract moved
around it rather than the other way about. [[0089-provider-distribution-tiers]] pins this provider
to one person, so a credential reaching CI is distribution — the service container starts with an
empty configuration directory and CNCORE-141 added nothing to it.

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

**AND THE PAGE SAYS WHY THE LINK IS MISSING, which withholding it silently would have undone.** Found
in review: the first build rendered nothing at all in that case, so the Owner read "has not been
Unlocked" beside no way to Unlock it — a Provider that looks merely locked while it is actually
misbehaving, which is precisely the collapse of two faults into one that this record's own
three-way distinction exists to prevent. The declared path itself is NOT printed, because naming the
host it points at would put the destination on the page in text, and that is most of what
withholding the link was for.

**THE CONTRACT IS NOT TIGHTENED TO MATCH, DELIBERATELY.** It could refuse these three spellings, and
that would be belt and braces rather than the mechanism: the contract binds providers that WANT to
conform, and the whole premise here is a Provider that may not. The check has to live where the
value is used, so that is where it lives — and a conformance suite passing would otherwise start to
look like a reason for the consumer not to check.

**THE OWNER'S BROWSER HAS TO REACH THE PROVIDER, AND THIS RECORD NEVER SAID SO.** Every other URL in
CMPP is fetched by CanonCore, whose allowlist says what it may reach ([[0034-two-outbound-boundaries]]);
this one is followed by the OWNER. A Provider at `http://provider-wiki:8080` — a container hostname,
which is the spelling this repository's own examples use — would be reachable by the app and not by
the person reading the page, so the link resolves to nothing in their browser. That is a real cost of
choosing a link over a form and it is not a defect to fix here: the address the Owner needs is a
deployment fact CanonCore does not hold, and inventing one would be guessing. It is written down so
the next reader meets it as a known consequence rather than as a bug.

**AND THE HALF THIS ASSUMED AWAY WAS NOT TRUE EITHER, MEASURED 2026-09-13 AND CLOSED UNDER
CNCORE-163.** The sentence above takes for granted that a container hostname is "reachable by the
app" and worries only about the browser. For a day it was not. `compose.yaml` shipped TWO services —
the app and `postgres:18` — with no provider among them, no `networks:`, no `extra_hosts:` and no
`host-gateway` anywhere in this repository.

**THE PRECISE CLAIM, because a wider one was written here first and is wrong.** Outbound to a
PUBLIC URL always worked: with no `networks:` key the app sat on Compose's default bridge with
ordinary egress, so a Provider on the open internet was reachable and `/settings` plus the allowlist
is exactly how to name one. What had no route was a Provider the Owner runs BESIDE the install — no
container hostname resolved, because no such container was on its network, and no host address was
mapped. That is the ordinary case for a self-hosted product, and it is the case both of this
project's Providers are in, since [[0089-provider-distribution-tiers]] keeps both images private and
there is no public one to point at. A defect against
[[0115-the-public-release-comes-before-the-playback-half]]'s "install, navigate and curate", not a
cost of this record's link-over-form choice — written here because this is the sentence that assumed
otherwise.

**THE ROUTE IS A NETWORK THE INSTALL CREATES AND THE PROVIDER JOINS.** `compose.yaml` now declares a
`providers` network pinned to the name `canoncore_providers`, and the app joins it alongside
`default`. A Provider beside the install joins the same network `external: true` from its own
Compose project and is reached at `http://<its service name>:<its port>`, because Compose gives a
service its own name as an alias on every network it joins and that holds ACROSS projects, which is
what an install and a Provider beside it are. The direction is the only one that cannot deadlock:
declared external at BOTH ends nothing would create it and a first install would fail on a network
that does not exist, which is the trap `canoncore_data` already records in that file. The app keeps
`default` in the same key, because a `networks:` key REPLACES the implicit join rather than adding
to it — naming only the new one would have taken the app off the network its own database is on.

**WALKED RATHER THAN ASSERTED, 2026-09-14**, which [[0132-a-project-is-not-finished-until-it-has-been-used]]
asks for. An install brought up from this file in a directory named `canoncore`; `provider-tmdb`
started beside it from its own directory, joining `canoncore_providers`; the Provider named on
`/settings` as `http://provider-tmdb:8080`; a search for "Blade Runner" on `/import` answering 17
candidates; one imported and standing in the catalogue. Started the other way round, the Provider
refuses with `network canoncore_providers declared as external, but could not be found`, which is
the sentence its own README documents. `provider-wiki` was NOT the Provider walked: its image is
`linux/amd64` alone and does not run on this arm64 host (CNCORE-189), while `provider-tmdb`'s does
under emulation. The route is the same route — neither end of it knows which Provider is on the
other.

**AND THE PROVIDER'S COMPOSE FILE WAS WRITTEN FROM CANONCORE'S README, not taken from a repository**,
because `provider-tmdb` ships none. That is a strength of the walk rather than a hole in it: what a
stranger has is the README and their Provider's own instructions, so the file under test was the
example in `## Installing it` and it worked unedited apart from the image and the env file. What it
does NOT establish is that `provider-wiki`'s own committed `compose.yaml` joins correctly, which no
walk on this host can establish while CNCORE-189 stands.

**WHAT IS STILL UNWALKED IS THIS RECORD'S OWN SUBJECT.** `provider-tmdb` declares no `credential`,
so a walk with it exercises the ROUTE and not the declaration, the label, the state, or the Unlock
link that route exists to make reachable. Those are held by the contract job against the real locked
`provider-wiki` image ([[0103-tests-bite-at-package-exports-and-the-router]]), which is a different
kind of evidence from an install being used, and the gap closes when CNCORE-189 does.

**AND THE ALLOWLIST NEEDS THE RANGE AS WELL AS THE NAME, which nothing had said and the walk found.**
A Provider on that network answers on a container address, which `ipaddr.js` classifies as `private`
rather than `unicast`; [[0034-two-outbound-boundaries]]'s config boundary checks twice, and the
second check admits a private address only where an allowlisted CIDR covers it. So an allowlist
holding the host alone admits the NAME and then refuses the SOCKET. Docker picks that range per
machine — `172.19.0.0/16` on the walk above — so the README hands over `docker network inspect` to
read it rather than a number that would be right on one host. This is not a new rule and not a
defect in that record: it is that record's own two-check design meeting the case this one created.

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

**THE SETTINGS SURFACE NOW MAKES A NETWORK CALL, AND IT DID NOT BEFORE.** This record says the state
arrives with "a read CanonCore already makes", which is true of the app and was NOT true of this
page: `settings.read` was a pure database read until CNCORE-101. The manifest is still the only
place the state can come from — only the Provider knows it — so the read is right, but the cost is
real and belongs here rather than in a PR nobody will find. A Provider that ACCEPTS a connection and
never answers holds `/settings` for the client's ten-second timeout, and `/settings` is where that
Provider is removed. The reads are concurrent, so it is one timeout rather than one per Provider,
and a Provider that refuses the connection outright fails immediately. Whether this surface deserves
a shorter deadline than an import does is a question this record leaves open rather than settles
with a second constant.

**THE CREDENTIAL IS KEPT OUT STRUCTURALLY RATHER THAN BY A RULE ANYBODY REMEMBERS.** CanonCore's
consumer schema is a `z.object` where the contract's is a `looseObject`, so `fields` — the
contract's list of what the Owner supplies — is STRIPPED on the way in. There is no property
anywhere in this app for a credential value to sit in, which is a stronger guarantee than a
convention that nothing reads one: the day somebody reaches for the form again, they have to widen
a schema to do it.

**AND WHAT CANONCORE MUST NEVER DO IS PINNED FROM THE PROVIDER'S SIDE.** The schema half of "not
even in transit" is asserted where the value would enter; the other half is that the unlock path is
somewhere this app LINKS to and must never REQUEST, since a request is how a value would come to
pass through its client at all. The e2e stub records every path it was asked for, and the assertion
is made from what the PROVIDER saw rather than from CanonCore's account of itself.

## A provider may Spend what it is given, under CNCORE-207

**`provider-wiki` stopped reporting `valid` about a credential it had never used.** Under CNCORE-206
(`jacobdrees-canoncore/provider-wiki#45`, merged 2026-09-19) its unlock path Spends what it is given
on one request to the wiki before holding it: a `cf_clearance` obtained over IPv6 cannot be Spent by
a container with no IPv6 path, and the Owner had been told to supply a fresh one that failed
identically, for ever. This record's own sentence is what that provider now acts on rather than
contradicts: the provider is "the one being refused by the upstream", and it has started asking
before it answers.

**THE CONTRACT SUITE ASSERTED THE BEHAVIOUR THAT REMOVED**, and went red on every pull request from
the run after `provider-wiki:latest` republished: it POSTed a dummy value and required `status < 400`
and then `valid`, reasoning that a provider "cannot check a credential without doing its own job".
One that Spends CAN, and answered `400` with the manifest still `absent`. The obligation was correct
on each side of a repository boundary and contradictory across it, which is the shape CNCORE-33,
CNCORE-141 and CNCORE-156 each met.

**SO A COMPLETE SUBMISSION IS OWED ONE OF TWO ANSWERS, AND BOTH ARE PINNED.**

- **Held**: below 400, `valid`, `state_changed_at` moved. A provider that does not Spend, one whose
  upstream accepted the value, and one that could not reach its upstream to Spend it at all all
  answer this way. The last is still honest: `valid` has only ever meant "nothing has refused this
  one yet", and an outage is no evidence about a credential — refusing then would lock the Owner out
  of the one act that fixes an outage-shaped fault.
- **Refused**: exactly `400`, a JSON body carrying the reason, and NOTHING CHANGED. `400` for the
  reason CNCORE-141 pinned `503` rather than admitting "some refusal": a contract that let each
  provider choose would quietly become two integrations. It is also right on the merits — what
  failed is the SUBMISSION, a fault in the request just made, while `401` and `403` would describe
  the caller's standing with the provider, which is not what happened.

**"NOTHING CHANGED" IS THE HALF WITH A PROPERTY ON IT.** From `absent` it catches a refused value
stored anyway and one recorded as a lapse. Against a credential the provider already holds, it is a
security rule: nothing authenticates an unlock path, by this record's design, so a refusal that
wrote anything would let anyone able to reach the port mark the Owner's working session `expired`
with a value they made up. `provider-wiki` found exactly this and guards it: the value being tried
is never read from or written to its file. The suite will not touch a held credential, so that half
is asserted against the witness in `packages/contract/src/participants.test.ts`.

**AND THE SUITE STILL HOLDS SOMETHING TO HOLDING, OR THE REFUSAL MEANS NOTHING.** It has no value any
upstream would accept — a real one reaching CI is distribution
([[0089-provider-distribution-tiers]]) — so to the suite a provider that Spends and is refused and a
provider that refuses everything are the same answer. What keeps the refusal a permission is a
suite-level guard beside this record's optionality test that fails unless some participant HELD what
it was given, and some participant refused it. The ticket said nothing else exercised the held
answer, `provider-tmdb` declaring no credential; `lockedProvider()` did, but nothing kept it doing
so, which is the gap the guard closes. A witness that Spends stands beside it — `lockedProvider({
spends: true })`, whose upstream accepts the one session it issued and refuses the rest — so the
refused answer is entered on every machine, not only where the private image can be pulled.

**WHAT THIS STILL CANNOT WITNESS is that a real provider's refusal is its upstream speaking**, rather
than a provider that refuses every complete submission and could never be Unlocked. That is the
provider's own repository's to prove, and `provider-wiki`'s record says it measured both directions
live on 2026-09-19: a credential the container could not Spend refused naming IPv4, and one it
could, held, reporting `valid` and answering `search`, `lookup` and `browse` from the wiki.

**A FOURTH STATE WAS DECIDED AGAINST, and the reason is the contract rather than taste.** A
credential held because the upstream could not be reached is not one that has been refused, and a
state for it beside `absent` and `expired` would fall on the wrong side of CNCORE-141's rule: the
contract reads anything but `valid` as a provider unable to reach its source and owed a `503`, so a
provider holding a credential that works would be obliged to refuse with it.

**A FIELD BESIDE THE STATE, SAYING A CREDENTIAL HAS NOT BEEN SPENT, IS NOT ADDED.** The Owner is told
so where they are standing when it happens — `provider-wiki` answers the POST with the reason, on
its own page — and the next request that reaches the upstream settles it either way, to `valid`
still or to `expired`. Nothing in CanonCore would read the field but a new line on the settings
page. It is an optional addition to the manifest the day an Owner is misled by its absence, and an
optional field does not move the version ([[0032-cmpp-versions-array]]), so declining it now forecloses
nothing.

**SPEND IS NOW A WORD IN `CONTEXT.md`**, because it is a real act in this ecosystem — it is what tells
a usable credential from a well-formed one — and the glossary is binding on the provider
repositories. `verify`, `validate` and `unverified` are what it avoids, since each reads as a
stronger claim than `valid` makes; `provider-wiki`'s POST answer names its outage case `unverified`
and CNCORE-214 carries the rename to that repository.

