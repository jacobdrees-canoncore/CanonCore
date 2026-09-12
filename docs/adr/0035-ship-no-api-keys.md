---
status: proposed
---

# Ship no API keys

A self-hosted instance supplies its own provider credentials, and bundled provider definitions ship
disabled.

For TMDB that credential is now the API READ ACCESS TOKEN sent as a Bearer header, not the legacy
`api_key` query parameter: TMDB's own auth docs say "the default method to authenticate is with your
access token" and every current sample uses it. `api_key` still works, so this is drift rather than
breakage — but a query-string secret ends up in logs and referrers.

The defensible pattern is TheTVDB's: the project holds its own licence and the user supplies their
own subscription credential. Jellyfin ships ONE hardcoded TMDb key, so every default install calls TMDb as the same customer,
which is tolerated rather than authorised and looks like sublicensing. Its override is deliberately
unreachable — Jellyfin's own code comment reads "This is intentionally excluded from the settings
page".

Three hardcoded keys exist across its bundled providers in total — TMDb, TheAudioDb and OMDb — and
the two non-TMDb ones have no override at all, which is worse rather than better.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-products.md`.

## Half built, under CNCORE-6 -- and this record stays PROPOSED

**BUILT: nothing on the import path takes or holds a credential.** The `provider.import` procedure
has two inputs, a base URL and a record id, and the client sends no auth header. The instance would
supply its own if one were needed, and it would supply it from configuration rather than from
anything committed here.

This was cheap to satisfy and the reason is ADR-0069's: the wiki provider needs no key, no rate limit
and no attribution string, so the first provider written could not have shipped a key even by
accident. THAT MAKES THIS HALF UNTESTED RATHER THAN PROVEN -- a rule about credentials has not been
exercised by a provider that needs one.

**NOT BUILT: bundled provider definitions, and therefore "bundled defaults ship disabled".** There is
no bundle. ADR-0089's tier 1 does not exist, nothing ships a provider definition of any kind, and the
only provider reachable is one the owner points at by URL and allowlists by name. The disabled-by-
default rule has nothing to apply to yet, so it is neither honoured nor broken.

**AND TMDB IS THE REAL TEST OF THIS RECORD.** Everything specific here -- the read access token as a
Bearer header rather than the legacy `api_key` query parameter, the TheTVDB pattern of the project
holding its licence while the user supplies their own credential -- is about a provider that has not
been built. CNCORE-8 is where this record is either satisfied or found wanting; today it is satisfied
by there being nothing to get wrong.


## Half built, under CNCORE-16 -- and this record stays PROPOSED

**BUILT: the credential half, and proven at the layer a code review cannot see.** `provider-tmdb`
ships no key. It reads `TMDB_READ_ACCESS_TOKEN` from its environment and REFUSES TO START without
one — a startup failure rather than a per-request one, because a container that runs and errors on
every request looks healthy to anything watching the process, while one that refuses to start says
what is wrong once, where somebody is reading. Its CI additionally runs `env` inside the built image
and fails if the variable is present at all, which is the check that catches a key baked into a
layer: every functional test in that repo passes with one.

**And the token is an API Read Access Token sent as a Bearer header**, which is the drift this record
already names. Nothing anywhere in either repository sends an `api_key` query parameter.

**In CanonCore, the instance supplies it by configuration and nothing in this repo holds one.** CI
passes the token to the provider's service container from a repository secret, which is precisely
"the instance supplies its own": the app has no field for a credential on any provider path, and the
contract test reaches the provider rather than TMDB.

**NOT BUILT: bundled provider definitions, disabled by default.** That is the other half of this
record's first sentence and there is nothing to disable — no definition ships with CanonCore at all,
bundled or otherwise, and a provider becomes reachable only by an owner naming it in their own
settings and allowlisting the host it answers on (CNCORE-99; it was `PROVIDER_ALLOWLIST` when this
was written). ADR-0089's tier 1 is where that arrives, and whatever
builds it is what closes this record.
