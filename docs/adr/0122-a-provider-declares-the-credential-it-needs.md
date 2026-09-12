---
status: proposed
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
