---
status: accepted
---

# The public release comes before the playback half

One effort goes ahead of the playback half: a CanonCore that somebody else can install, navigate and
curate, published under [[0113-the-source-licence-is-agpl]] with the repository public.

## This reverses CNCORE-2, and the reversal is named rather than performed

CNCORE-2's Out of Scope section reads: "**The playback half is not built** ... Their decisions are
made and recorded as ADRs, waiting. **That is the first work after the cap.**" Four further
documents agree on the ordering, and `docs/research/access-layer.md` §8 says in terms "This research
does not overturn that."

**The ORDER OF THE THREE NAMED SUCCESSORS IS NOT TOUCHED.** Playback still precedes clients
precedes demo ([[0055-web-now-phone-next-tv-last]], `docs/demo.md`). This record inserts ONE effort
ahead of all three; it does not reorder them, and it does not license a second insertion.

## Why: ADR-0001's two failure modes both point the same way

[[0001-no-release-cadence-rule-in-the-specification]] names them:

> **Internal**, from this product's own history: attempts die at two to four weeks, within days of an
> artefact revealing total cost. Over-scoping kills.
> **External**, from this research: going quiet long enough for someone else to ship kills, and it
> does not recover.

**The playback half is now known to be the largest spec yet attempted**, which was not visible when
CNCORE-2 named it as next. `docs/research/access-layer.md` §8: "It is not 'files, scanner, progress,
playback' — it is '**authentication**, files, scanner, progress, playback', because ADR-0097's route
has nothing behind it otherwise." `docs/research/where-it-runs.md` §10 adds the canonical HTTPS
origin, the deployment rung and a test environment: "Three of the seven land on the playback spec,
and that concentration is the finding." That is roughly two dozen proposed records against version
one's TEN planned tickets (`docs/agents/issue-tracker.md`, measured 2026-09-11). Opening with it is the internal failure mode by construction.

**And the discovery clock had not started.** awesome-selfhosted's addition checklist requires that a
project "was first released more than 4 months ago" and "has working installation instructions"
(read 2026-09-11). The clock runs from the FIRST release, not the good one. When this was written
there was no tag, no image and no install path, so every week of playback work was a week added to a
clock that had not begun. That is the external failure mode, and it is the half a scope document
cannot see. **CNCORE-63 built the image, CNCORE-64 the install path, and CNCORE-70 cut the tag on
2026-09-12**, so all three legs now stand and the clock has started. That date is the one that
matters rather than this record's: awesome-selfhosted counts from the release's `published_at`, and
CNCORE-76 cannot be filed before 2027-01-12.

## ADR-0107's flip was already due and owned by nothing

[[0107-canoncore-has-two-audiences]]: "**The repository goes public when version one's four
conditions are met.** ... **Review the forensic record before flipping it**." The
four conditions are met and the repository is still private. That review is resolved in
[[0114-the-public-repository-is-a-fresh-one]].

That record's own test is what licenses this effort and bounds it: "does it make an existing thing
VISIBLE, or does it make a new thing EXIST? The first is what this record is for. The second is
ADR-0051's to refuse." Publishing, licensing, packaging, and surfacing a catalogue that already
exists are all the first. **The owner write path is the second**, and it is taken here anyway, as a
deliberate exception argued below rather than smuggled under ADR-0107.

## Why a bare release was refused, and the catalogue half folded in

Two shards of the competitor sweep — `sweep-plex-support-C.md` and `sweep-jellyfin-repo.md` —
independently rated the empty first run HIGH:

> With no providers enabled by default ... no seed data, no artwork, and no scanner root, a fresh
> CanonCore is an empty page. **Every decision in the prompt is individually right and together they
> produce the worst possible first five minutes.**

Today `/` is the unmodified create-better-t-stack banner, nothing reaches `/items/<id>` without a
UUID you already hold, `PROVIDER_ALLOWLIST` defaults to refusing every provider, and the README
never mentions it (all four true when this was written; see below for what has since changed). **A
release of that is a release of the first five minutes rather than of the product.**
[[0094-a-fresh-install-starts-empty]] governs what content ships and deliberately says nothing about
whether the emptiness is explained; that gap is what this effort closes.

**The first clause of that paragraph is now history and the last is not.** CNCORE-65 replaced the
banner with the catalogue: an empty one names the two steps that fill it, and an instance with
nothing allowlisted says so, so an empty result reads as configuration rather than breakage.
CNCORE-64 has since put the variable in the README and in `.env.example`, both held to the schema by
a suite rather than to a reader's memory, so the page and the documents now say the same thing about
what empty means. Nothing reaches `/items/<id>` by SEARCHING for it yet, which is CNCORE-66's. The
paragraph is left standing because it is this record's reasoning at the moment it was taken; this is
what has since been done about it.

**The owner write path is included for one reason: without it the product's central claim is not
personally usable.** A catalogue filled only from providers holds only the orderings a provider
gave. CNCORE-2's user story 7 is "each ordering is mine to curate", and CNCORE-5 was "One item, two
orderings, **hand-placed**". [[0061-containers-own-their-membership]] recorded "NOT BUILT: mutations
naming a PLACEMENT. There are none." Shipping multi-placement that the owner cannot perform is
shipping the demo of the feature rather than the feature.

**Most of that half landed under CNCORE-72**, which is why the quotation above is in the past tense:
place, remove and restore name a Placement by id, and a container's own page is where an owner
reaches them. What is still a provider's alone is the REORDER and the move between containers, under
CNCORE-73 — which is also why ADR-0061 is still `proposed`.

## Staged in two tags

v0.1.0 is the release mechanics and the make-visible half; v0.2.0 is the owner write path. **The
reason is the clock and not the polish**: it runs from the first release, so the tag is worth having
before the product deserves it. Build-order's phrasing is "tag v0.1.0 and publish an image, however
embarrassing."

**THE TAG IS CUT, WHICH IS THE CONDITION THIS RECORD SET FOR ITSELF, AND IT IS NOW `accepted`.**
CNCORE-63 publishes the image: multi-arch, from `main` alone, migrating before it serves. CNCORE-64
made it installable -- `compose.yaml`, `.env.example` and the README's `## Installing it`, followed
on a machine with no checkout and no `ghcr.io` credentials, which is the run that proves what a
stranger gets rather than what the owner gets. CNCORE-70 added the release trigger and tagged
`v0.1.0` at `b45a4ff` on 2026-09-12, so `ghcr.io/jacobdrees-canoncore/canoncore:0.1.0` exists,
resolves for amd64 and arm64, and was fetched with an anonymous registry token to prove it answers
somebody who is not a member of this organisation. Both of awesome-selfhosted's conditions are
satisfied and the clock runs.

**WHAT `accepted` DOES NOT MEAN HERE, SAID PLAINLY.** This record stages one effort across two tags
and only the FIRST has shipped. v0.2.0's owner write path -- CNCORE-71 to CNCORE-75 -- is unbuilt,
so the argument three sections up, that "shipping multi-placement that the owner cannot perform is
shipping the demo of the feature rather than the feature", is still an outstanding debt rather than
a settled one. The status is flipped because the gate this record wrote for itself was the tag and
nothing else; the half that has not landed is named here so `accepted` cannot be read as the whole
effort being done.

**WHAT TAGGING TAUGHT, WHICH IS THAT `latest` WAS ONE LINE ORDER AWAY FROM MOVING.** The release
publishes `0.1.0` and `sha-<short>` and deliberately does NOT touch `latest`, because `latest` here
means the head of `main`: `compose.yaml` names it and the README documents it that way, so a
release re-pointing it would change that meaning silently, and backwards the first time an older
commit were tagged. That was ALREADY the behaviour before CNCORE-70 pinned it, and only by
accident. `docker/metadata-action`'s `flavor.latest` defaults to `auto`, under which `procSemver`
computes latest for every non-prerelease semver tag; `setVersion` assigns the flag only while it is
still undefined, so the FIRST tag entry processed freezes it, and `type=sha` happened to sit above
`type=semver` and froze it false. Swapping those two lines, or dropping `type=sha`, would have
re-pointed `latest` on the next release with nothing in the diff saying so. `flavor: latest=false`
makes it a statement instead (`src/meta.ts`, read 2026-09-12).

**AND THE TRIGGER IS THE GATE, NOT THE CONDITIONS.** A tag carries no branch, so the publish
conditions have to admit `refs/tags/v` explicitly -- but Actions expressions have no globbing, so
those conditions cannot tell a version from any `v`. What refuses `vtest` is `on: push: tags`,
which does glob: the pattern is `v[0-9]+.[0-9]+.[0-9]+`, GitHub's own documented shape for semantic
versions. A consequence worth knowing before v0.2.0: a pre-release tag such as `v0.2.0-rc1` does not
match it, so it neither builds nor publishes until that line is widened.

**AND A RELEASE IS NOT A BRANCH BUILD RERUN.** The tag's run is a full CI run at the tagged commit,
which is what makes the release's claims checkable rather than inherited: at `v0.1.0` every job was
green, including the provider job carrying CNCORE-2's multi-placement assertion against two
independent Sources.

**AND THE PUBLISH HAD A SECOND MANUAL STEP NOBODY HAD WRITTEN DOWN.** CNCORE-63's CI asserts the
package reads `public` on every publish, and that assertion sat red on `main` because the package
was private -- correctly, which is what it is for. The instruction it carried was incomplete: this
organisation's Package creation policy admitted Private and Internal only, so the package's own
Change visibility dialog rendered Public DISABLED under "Setting is disabled by organization
administrators", and there was nothing to click. Two settings pages, in order, and the first is the
one nobody expects. Both were walked on 2026-09-11 and `ci.yml`'s failure message now names both,
because an instruction that leads somebody to a greyed-out control is worse than no instruction: it
reads as the product being broken rather than as a step being missing.

This is a staging decision inside one effort and NOT a cadence rule.
[[0001-no-release-cadence-rule-in-the-specification]] refuses a cadence rule in the SPECIFICATION,
on the ground that it "would be about TIME rather than about the product", and that refusal stands.

## The cost, stated

**The playback half is delayed by the length of this effort**, and playback is what makes CanonCore
a media server rather than a catalogue. Nothing here reduces that; it defers it.

**And some of this work is work CNCORE-2 could have done.** Its four conditions were explicitly a
floor — "The conditions are a floor rather than a ceiling" — and roughly 28 of its 43 user stories
went unbuilt beneath it, search and browse among them. Closing some of them now is finishing version
one's own list rather than new ambition, which is an argument for doing it and also an admission
that the floor was set low enough to leave the product unusable by a stranger.

## What would have falsified this

Written down so the reasoning is checkable rather than merely persuasive. Any one of these would
have left playback as next: if the playback half had turned out small; if ADR-0107's flip had
already been owned by a named spec; if a release tag or an installable artefact already existed; or
if the build-order study's step 3 had carried a refusing record the way step 4 carries
[[0056-a-standard-read-protocol-is-refused]]. None of the four holds.

## Evidence

awesome-selfhosted's requirements: `CONTRIBUTING.md` and `.github/ISSUE_TEMPLATE/addition.md` in
`awesome-selfhosted/awesome-selfhosted-data`, via the GitHub contents API, 2026-09-11.

Repository state the same day: `gh repo view` reports CanonCore PRIVATE with `licenseInfo` null;
`gh release list` and the tags API are empty for all three repositories; the only local tag is
`archive/tardis-pipeline-2026-09-04` and `git ls-remote --tags origin` shows it was never pushed;
`find` reports no Dockerfile anywhere in the tree.

The empty-first-run and packaging findings are `docs/research/competitor-sweep/`, chiefly
`sweep-plex-support-C.md` and `sweep-jellyfin-site-A.md`. **Those files carry no in/out verdicts** —
they are observation logs ranked on cost of deferral times certainty, and "ABSENT" there means the
prompt said nothing rather than that it decided against. They are cited here as findings, which is
what they are, and the decision is this record's.
