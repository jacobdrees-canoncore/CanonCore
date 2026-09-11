---
status: accepted
---

# A provider is a URL answering CMPP, never a plugin

CMPP is the CanonCore Metadata Provider Protocol: an HTTP contract returning metadata and URLs,
never media bytes. Providers are not plugins, not repos, and never code running inside the app.

Plex opened plug-ins, shut the plug-in DIRECTORY in 2018 at under 2% usage while manual installs
kept working, warned in July 2024 that "legacy agents will soon cease to work", broke them in April
2025, and only reopened in December 2025 as a plain HTTP contract. So build it because the model needs many sources, not as a moat.

## The repository boundary, and this record owns it

"Not repos" above is about what CanonCore CONSUMES: it is pointed at a URL, never at a repository to
fetch, build or trust. Where a provider's SOURCE lives is a different question, and the answer is
below. Reading the two as one claim is the mistake this section exists to prevent.

Every provider we write lives in its own repository in the CanonCore organisation: separate deploy,
separate lifecycle, no shared code. CanonCore knows only a URL, a credential and a validated
response shape, and the repo boundary is what makes the decoupling real rather than a convention.

**Written once, here, because it was previously written twice.** ADR-0089's subject is distribution
tiers and a licence rule, not repositories; it restated this paragraph near-verbatim and cited this
record mid-sentence at the same time. It now cites and does not restate. A rule asserted in two
places drifts in one of them, and the reader cannot tell which one moved.

**"No shared code" reaches provider-to-provider, not only provider-to-app.** Two providers do not
share a package either, however obviously convenient a common one would be.
[[0110-a-provider-repo-is-a-small-typescript-service]] says what goes inside one of these
repositories, and names the contract test that stands in for the shared code that is refused here.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`.

## As built, under CNCORE-6 and CNCORE-15

CanonCore knows a URL, a validated response shape and -- for this provider -- no credential at all.
It never fetches, builds or trusts a repository, and `provider-wiki` is its own repository with its
own deploy and its own lifecycle.

The CMPP response schema is written twice on purpose, once in the provider and once as CanonCore's
own consumer reading of it. The consumer's copy is deliberately not a transcription: Zod strips what
this app does not read, so a provider declaring more than CanonCore uses stays readable.

THE PROVIDER-TO-PROVIDER HALF HAS ONE PROVIDER SO FAR. Nothing violates it and nothing can yet, and
the device meant to keep two providers honest without a shared package -- the contract test over both
of them -- is CNCORE-8's. See [[0110-a-provider-repo-is-a-small-typescript-service]], which stays
PROPOSED for exactly that reason.


## Under CNCORE-8: the substitute for a shared package now exists

This record refuses shared code between repositories, and [[0110-a-provider-repo-is-a-small-typescript-service]]
records the refusal of a shared `@canoncore/cmpp` package specifically. Both were in force from the
first provider; what was missing until now is the thing that makes them safe.

`packages/contract` is it. It calls every provider over HTTP and holds them to one shape, so a change
to the response shape in one repository fails a test in this one. Until it existed the duplication
was simply duplication, and the record admitting that is ADR-0110's own "half built" section.

**It also wrote down the CMPP record shape for the first time.** That shape existed in no ADR and no
line of `CONTEXT.md` — only in each provider's `src/cmpp.ts` plus this app's reading of it, which
made the first provider's copy the INCUMBENT DRAFT rather than a specification: whatever
`provider-wiki` happened to send was the rule, and the second provider discovered that by diverging
from it on its first day. `packages/contract/src/cmpp.ts` is now the normative statement, and it is
the INTERSECTION every provider must satisfy rather than the union of what any one sends.
