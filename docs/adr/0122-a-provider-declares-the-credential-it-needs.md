---
status: proposed
---

# A provider declares the credential it needs, and CanonCore forwards it without storing it

A CMPP provider reaches an upstream CanonCore knows nothing about. Some upstreams want nothing;
some want a token; `provider-wiki` wants a browser session, because tardis.wiki sits behind a
Cloudflare Turnstile that only a person can pass ([[0069-the-first-provider-is-the-wiki]]).

**The manifest gains an optional `credential`**: a label, the fields it wants, the path to POST them
to, and the state it is currently in. A provider that needs nothing declares nothing and every
existing provider stays conformant, because `manifest` is a `looseObject` and this is an addition
rather than a change ([[0032-cmpp-versions-array]] governs the version, and an optional field does
not move it).

**CanonCore renders a form for any provider that declares one, POSTs it straight to that provider,
and stores nothing.**

## Storing it was the obvious shape and it is the one refused

The settings table is arriving anyway ([[0121-an-instance-names-its-providers-beside-the-allowlist-that-admits-them]]),
so a `credential` column beside `PROVIDER_URLS` costs almost nothing to build. Refused for two
reasons, and the second is the one that decides it.

**It puts one provider's upstream secret in CanonCore's database.** Nothing else in this product is
a secret at rest. `provider-tmdb` holds its own token in `~/.config/canoncore/provider-tmdb.env` and
CanonCore has never seen it; [[0035-ship-no-api-keys]] is the same instinct pointed outward. A
column here would be the first, and it would be a secret belonging to something else.

**It makes every other provider carry a header that means nothing to it.** A stored credential has
to travel, and the only place to put it is on the CMPP request. Then the contract grows a header
every conformant provider must ignore, to serve one provider's private arrangement with its own
upstream. [[0031-a-provider-is-a-url]] puts that arrangement behind the seam; a header drags it
through.

Forwarding keeps both: CanonCore learns a provider needs something, shows a form, and hands the
answer over. It never holds it, so it never has to protect it.

## The provider writes it to its own config directory

Not memory. A container restart is ordinary — a deploy, a crash, a reboot — and a provider that
forgot its credential on every one of them would be the treadmill this design exists to avoid. The
file is `~/.config/canoncore/wiki-session.json` for `provider-wiki`, which is the shape
`provider-tmdb` already uses.

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
shown to the one person who can fix it. **Falling back to a corpus is worse**: it makes an expired
session look like a thin wiki. That is [[0033-search-lookup-required-browse-optional]]'s rule as
CNCORE-92 built it — a provider that cannot reach its source must say so, because a refusal
reworded is not a refusal reported.

ADR-0033 keeps `search` and `lookup` mandatory, so a locked provider still declares all three
operations. It is not half a provider; it is a whole one that currently cannot answer.

## What this does not decide

**Whether the owner's one click can ever be removed.** Getting the credential is outside the
contract and outside this record: a person in their own browser today, something else later. The
file is the interface, and this record deliberately says nothing about who fills it.

**Whether `provider-tmdb` adopts it.** It could — the same form would replace its `.env` file — but
nothing here obliges it, and a working thing is not changed for symmetry.
