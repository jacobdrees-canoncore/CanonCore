---
status: proposed
---

# Providers come in three distribution tiers, and a licence rule over them

1. BUNDLED DEFAULTS — known provider definitions ship with CanonCore, all disabled by default.
   Shipping a definition is not shipping a key (ADR-0035); the user supplies their
   own.
2. THE CMPP STORE — publicly addable providers, ACCEPTED rather than open. Curated.
3. PRIVATE PROVIDERS — any URL added directly, bypassing the store.
OVER ALL THREE SITS A LICENCE RULE, which an earlier version of this record miscounted as a fourth
tier. It is not a tier — it is a constraint that forces a provider into tier 3 and pins it there: a
provider whose source has licensed it to ONE person is private and stays private, never bundled,
never in the store, never pointed at by another instance.

The archive's own wiki provider is the case. Permission was granted to one person, so ADR-0069's
provider can never be distributed even though it is the first one written.

## A publicly pullable container image is distribution

The three tiers govern IMAGES exactly as they govern bundled definitions and store listings, because
a `docker pull` hands someone the provider itself. Left unsaid, this is the form the licence rule
leaks through: a provider can be correctly kept out of the bundle and out of the store, and still be
handed to the whole world by a public image.

The archive's wiki provider is the case again. The rule above pins it to tier 3, so its image is
PRIVATE and stays private, and CanonCore's own CI pulls it as a NAMED REPOSITORY rather than
anonymously: the package grants the CanonCore repository read under Manage Actions access, and the
workflow's own `GITHUB_TOKEN` is what pulls it. Every provider the licence rule pins to tier 3
carries the same constraint on its image, because an image is a COPY of the provider rather than a
description of one.

NOT A FINE-GRAINED TOKEN, WHICH IS WHAT THIS RECORD USED TO SAY AND WHICH DOES NOT EXIST FOR THIS
REGISTRY. GitHub's own packages documentation reads "GitHub Packages only supports authentication
using a personal access token (classic)", read 2026-09-10; community discussion #38467 says the same
and notes the capability was removed from the public roadmap in 2024 and never re-added. So the
choice was never fine-grained versus classic. It was a CLASSIC token — broad by construction, stored
as a repository secret and rotated by hand — against a grant that needs no credential at all, and
the grant wins on the licence rule's own terms: nothing to leak is stronger than something scoped.
The grant is a web-UI step with no REST or GraphQL equivalent (community discussions #188574,
#61495, #45560), so it is a manual prerequisite of any ticket that pulls the image, and saying so
here is what stops the next reader budgeting for a token instead.

## What this record is not about

Where a provider's source lives, and why the boundary is a repository at all, is ADR-0031's — this
record cited it and restated it at the same time, and now only cites it. What goes inside that
repository is [[0110-a-provider-repo-is-a-small-typescript-service]]'s. This record decides who may
have a provider, never how one is built.

## Evidence

The registry's token support and the Manage Actions access mechanism were read from GitHub's own
documentation on 2026-09-10, after CNCORE-6 found the fine-grained claim above unbuildable. Nothing
about the TIERS changed: the licence rule, the privacy of the image and who may pull it are exactly
as they were. Only the credential named for the pull was wrong.

## Half built, under CNCORE-6 and CNCORE-15 -- and this record stays PROPOSED

**BUILT: tier 3, the licence rule over it, and the image half.** The wiki provider is reachable only
as a URL the owner points at and allowlists by name, its repository is private, and its image is
private and asserted so by its own CI on every publish -- the job fails if the package's visibility
ever stops reading `private`, because a default is what a later click changes.

CanonCore's CI pulls that image as a NAMED REPOSITORY rather than anonymously, which is the clause
this record now states correctly.

**NOT BUILT: tiers 1 and 2.** There are no bundled provider definitions, so "all disabled by default"
has nothing to disable, and there is no CMPP store, so "accepted rather than open" has nothing to
curate. Two thirds of this record is a description of a thing that does not exist yet.

The licence rule is the part that had to be right first, because it is the only one of the three that
can be VIOLATED today: a public image would have distributed a provider licensed to one person, and
that is irreversible in a way a missing store is not.


## Under CNCORE-16 and CNCORE-8: a second private image, for a different reason

The section above reasons about a publicly pullable image from the wiki provider's case, where the
LICENCE RULE forces it: permission was granted to one person, so that image can never be
distributed. `provider-tmdb`'s image is private too and **nothing licence-pins it** — TMDB licenses
nothing to one person. It is private to match CanonCore, which is a DECISION rather than the rule
operating, and the named trigger to revisit it is tier 2's CMPP store becoming real.

That distinction is the reason this is written down. Two private images look like one rule being
applied twice, and they are not: one is pinned and one is a choice, so a later reader deciding
whether an image may be published has to check which kind it is looking at. `provider-tmdb`'s own CI
asserts its package visibility on every push to `main` and fails if it moves, so the choice cannot
drift into a default.

**Tier 1 and tier 2 are still unbuilt.** No provider definition ships with CanonCore, bundled or
otherwise, and there is no store. Both providers are reached the tier 3 way: a URL an owner writes
into `PROVIDER_ALLOWLIST`. This record stays `proposed` for that reason.

## A PUBLIC consumer of private images, which this record had not met

*(Decided ahead of the slice that implements it. The ticket reference belongs here once the public
release spec is filed; naming a number before the ticket exists is how a citation goes stale.)*

Everything above was written while all three repositories were private, so "the image is private"
and "the thing that pulls it is private" were one situation. They are about to come apart:
CanonCore's repository goes public ([[0107-canoncore-has-two-audiences]],
[[0113-the-source-licence-is-agpl]]) and **both provider images stay private**.

**Neither privacy decision changes, and the reasons are untouched.** `provider-wiki` is pinned by
the licence rule — permission reaches one person, so it is tier 3 for good. `provider-tmdb` is
private by the CHOICE recorded above, and its trigger is unchanged: tier 2's CMPP store becoming
real. What is new is only who is standing outside.

**The consequence, named rather than discovered: CI passes for this repository and fails for every
fork.** The Manage Actions grant is made to the CanonCore REPOSITORY, and the workflow's own
`GITHUB_TOKEN` is what spends it. A fork is a different repository and holds no grant, so the jobs
that run either provider as a service container die at `Initialize containers` on the single word
`denied`. `pnpm test:contract` degrades the same way for a different reason: with
`PROVIDER_WIKI_URL` and `PROVIDER_TMDB_URL` unset, only the local conformance witness participates,
the witness declines `browse`, and the suite's own guard trips on "Nothing under test declares
`browse`".

So a contributor can run the type-check, the lint, the unit and database suites and the migration
ladder, and cannot run the two jobs that prove the provider contract — **which are the two that
prove half of what version one claims.** That is the cost, and it is accepted because the
alternatives are worse in kind rather than in degree: publishing `provider-wiki`'s image would
distribute a provider licensed to one person, which is irreversible and is the one thing the licence
rule exists to stop; publishing `provider-tmdb`'s would spend its trigger early for no gain, since a
lone public TMDB provider does not make the contract checkable without the other half.

**What would lift it is tier 1 or tier 2 becoming real**, not a credential. A bundled default or a
store listing is a provider someone else may legitimately point at; until one exists there is
nothing a fork could be given that this record permits giving. A token would be the wrong fix twice
over — it is the classic-token route already rejected above, and it would hand over exactly what the
grant is careful not to.

**Said plainly for the reader who meets a red fork: this is the rule operating, not a broken
pipeline.** The public repository is honest about what it cannot let a stranger run, which is a
different thing from a repository that looks contributable and is not.
