---
status: proposed
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

**And the discovery clock has not started.** awesome-selfhosted's addition checklist requires that a
project "was first released more than 4 months ago" and "has working installation instructions"
(read 2026-09-11). The clock runs from the FIRST release, not the good one. There is no tag, no
image and no install path today, so every week of playback work is a week added to a clock that has
not begun. That is the external failure mode, and it is the half a scope document cannot see.

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
never mentions it. **A release of that is a release of the first five minutes rather than of the
product.** [[0094-a-fresh-install-starts-empty]] governs what content ships and deliberately says
nothing about whether the emptiness is explained; that gap is what this effort closes.

**The owner write path is included for one reason: without it the product's central claim is not
personally usable.** A catalogue filled only from providers holds only the orderings a provider
gave. CNCORE-2's user story 7 is "each ordering is mine to curate", and CNCORE-5 was "One item, two
orderings, **hand-placed**". [[0061-containers-own-their-membership]] records "NOT BUILT: mutations
naming a PLACEMENT. There are none." Shipping multi-placement that the owner cannot perform is
shipping the demo of the feature rather than the feature.

## Staged in two tags

v0.1.0 is the release mechanics and the make-visible half; v0.2.0 is the owner write path. **The
reason is the clock and not the polish**: it runs from the first release, so the tag is worth having
before the product deserves it. Build-order's phrasing is "tag v0.1.0 and publish an image, however
embarrassing."

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
