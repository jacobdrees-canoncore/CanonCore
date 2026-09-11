---
status: proposed
---

# CanonCore's source is offered under AGPL-3.0-or-later

The instrument is `AGPL-3.0-or-later`, and it takes effect in each repository AT THE MOMENT THAT
REPOSITORY GOES PUBLIC. CanonCore's goes public under this spec, so its `LICENSE` lands with the
flip. `provider-wiki` and `provider-tmdb` stay private ([[0089-provider-distribution-tiers]]), so
theirs land if and when they follow.

`-or-later` rather than `-only` because the FSF urges it and its recommended notice carries "either
version 3 of the License, or (at your option) any later version". Choosing `-only` would be a
departure and would need its own reason.

**THE LICENCE FILE CANNOT CARRY THE ELECTION, AND AN EARLIER VERSION OF THIS RECORD SAID IT COULD.**
GitHub's picker does insert that sentence, but as the UNFILLED TEMPLATE in the "How to Apply These
Terms" appendix, `<year>` and `<name of author>` still in angle brackets. A template is not a
choice. GNU is explicit about where the choice is made: "The way developers state their choice is in
the license notice that goes at the start of each source file. That's where the GPL says the
decision is stated" (gnu.org/licenses/identify-licenses-clearly.html, read 2026-09-11).

So a bare `LICENSE` leaves the election UNSTATED, and the AGPL text contains the string "SPDX" zero
times. **The election is declared in `package.json` as `"license": "AGPL-3.0-or-later"`** — what
Nextcloud and Mastodon do — and in the image's OCI `org.opencontainers.image.licenses` label, which
takes an SPDX expression and is therefore the one artefact where the precise form survives.

**Expect GitHub to report the deprecated `AGPL-3.0` regardless.** licensee's own documentation says
it "does not parse these expressions". That is GitHub flattening the identifier rather than a defect
in the repository, and a reader comparing the badge against this record should meet that sentence
here rather than conclude one of them is wrong.

## Why the network clause, which is the whole of the choice

CanonCore is a server reached over a network, and it operates ONE PUBLIC INSTANCE ITSELF
(`docs/demo.md`). That is section 13's case exactly: a third party running a modified CanonCore as a
hosted service must offer their modifications to its users. Under GPL-3.0 they need not, because
they never distribute a binary.

This is the one dimension the product is actually exposed on, so it is the one the licence is chosen
for. Everything else about AGPL and GPL is identical here.

**What it PERMITS, which is accepted rather than overlooked: someone else may run CanonCore
commercially.** [[0100-canoncore-is-non-commercial]] governs this project's conduct and has never
governed anyone else's. A licence that forbade third-party commercial use exists and is rejected
below, so this is a choice rather than an omission.

## What comparable projects chose

Read from the GitHub API on 2026-09-11, not from memory:

| Project | Licence |
| --- | --- |
| Immich, Stash, Romm | AGPL-3.0 |
| Navidrome, Audiobookshelf, Kavita | GPL-3.0 |
| Jellyfin | GPL-2.0 |
| Komga | MIT |

Copyleft is the genre's norm, and the two NEWEST of these eight took the network clause — Immich
and Romm. Stash is the third AGPL project and the third OLDEST here, so the honest reading is "the
newest reached for section 13", not a trend line. This is corroboration rather than the argument:
the reason above is CanonCore's own shape.

**And the table measures GitHub's flattening rather than anyone's election.** `gh api .license.spdx_id`
returns the deprecated bare `AGPL-3.0` for EVERY AGPL repository, whatever it actually chose —
Nextcloud and Mastodon both declare `AGPL-3.0-or-later` in `package.json` and both report
`AGPL-3.0`. These figures therefore say nothing about `-only` versus `-or-later` and must not be
cited as if they did.

## Supersedes

[[0100-canoncore-is-non-commercial]] §"If a source licence is ever taken, the instrument is PolyForm
Noncommercial" recorded PolyForm Noncommercial 1.0.0 as the instrument. **That paragraph is
superseded and the reversal is named here as a reversal**, because the working behind it was done
properly and lost to a consequence it did not weigh rather than to a flaw in it.

PolyForm is rejected on the ground that record states about itself: **"AND IT IS NOT OPEN SOURCE,
which is a property to accept knowingly rather than discover"** — Open Source Definition 1.9 clause
6, and absent from OSI's approved list. The consequence it did not weigh is the discovery clock.
awesome-selfhosted lists Free and Open-Source software only; anything else goes to its separate
`non-free.md`. Its addition template requires that a project "was first released more than 4 months
ago" and "has working installation instructions" (read 2026-09-11). The release staging in this
spec is argued from that four-month clock, so a non-free licence would cost the thing the release
was for.

**One consequence for whoever files that submission.** The list validates `licenses` against a
CLOSED enumeration in `licenses.yml`, enforced by `hecat` on every pull request, and its only AGPL
entry is the deprecated bare **`AGPL-3.0`**; `AGPL-3.0-or-later` appears zero times and fails the
lint. The submission therefore says `AGPL-3.0` while this project is `AGPL-3.0-or-later`. That is
the list's limitation rather than a misstatement, and it is recorded here so nobody "corrects" it
into a failing pull request.

**Nothing upstream ever forced non-commercial, and ADR-0100 is what establishes that.** Its own
correction reads: the Cover Art Archive's NonCommercial term "governs the use of CAA's work, and
none of them reaches an outbound licence". An inbound NC condition and an outbound licence are
separate instruments over separate works. So AGPL was available the whole time; PolyForm was a
preference, not an obligation.

## Ruled out, with reasons

| Candidate | Why not |
| --- | --- |
| PolyForm Noncommercial 1.0.0 | Not open source (OSD clause 6), not OSI-approved, forfeits the awesome-selfhosted listing the release staging rests on. Superseded above. |
| GPL-3.0 | Identical here except on the one dimension that matters: a hosted modified CanonCore need never publish its changes. |
| MIT | A commercial fork with no contribution back is entirely permitted. Available, and it gives up the reciprocity for adoption CanonCore does not yet need. |
| A CC licence | Creative Commons recommends against using its licences for software, and ADR-0100 records the three reasons. |
| BUSL 1.1 / Elastic 2.0 | Both exist to defend a COMMERCIAL product, which is the opposite posture. ADR-0100's working stands. |
| Leaving it unlicensed | All rights reserved. Nobody may legally run or modify it, which makes "self-hosted software" untrue in the only sense that matters, and fails awesome-selfhosted outright. |

## What this record does NOT reach

The fixture inside `provider-wiki` is an extract of the archive and is CC BY-SA 3.0 Unported
([[0057-the-archive-stays-outside-the-repo]]). A licence over a repository does not relicense
third-party content inside it. That repository stays private, so nothing here is live for it, and
whichever ticket publishes it owns the question.

## Evidence

Comparable projects' licences: `gh api repos/<owner>/<name> --jq .license.spdx_id`, 2026-09-11.
awesome-selfhosted's rules: `CONTRIBUTING.md` and `.github/ISSUE_TEMPLATE/addition.md` in
`awesome-selfhosted/awesome-selfhosted-data`, read via the GitHub contents API the same day; the
four-month and installation-instructions requirements are quoted from the addition template's
checklist, and the FOSS-only rule from CONTRIBUTING's "Add a license" section.

The OSD clause 6 reading, the OSI list, the PolyForm text and the Creative Commons software FAQ are
ADR-0100's citations, read 2026-09-11 and not re-fetched here.

**One thing is NOT checked and is not asserted.** Whether AGPL-3.0 is compatible with every
dependency's licence in `pnpm-lock.yaml` has not been audited. The stack is the usual MIT/Apache-2.0
mix and no conflict is expected, but expectation is not a check, and a licence audit is work this
record does not claim to have done.
