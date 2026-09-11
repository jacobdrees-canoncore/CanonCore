---
status: accepted
---

# `main`'s history is append-only, and CI is not a merge gate

A repository ruleset named **`main history is append-only`** is active on this repository's default
branch. It carries two rules, `deletion` and `non_fast_forward`, and one bypass actor: the
repository admin role, `always`.

It deliberately carries **no required status checks and no required pull request**. CI is still
convention here. What changed is that the two outcomes no review can undo -- deleting `main`, or
rewriting its history -- are now refused by GitHub rather than by everyone remembering not to.

**This record exists because `CLAUDE.md` told every agent the opposite for as long as this
repository has been public**, and the sentence was not wrong when it was written. It said branch
protection was unavailable because the organisation is on GitHub Free and the repository is
private. CNCORE-62 made the repository public and the premise expired silently, which is the
failure mode a dated measurement in a record is for.

## Protection is available on this plan, and GitHub's own documentation says it is not

Measured 2026-09-11 against `jacobdrees-canoncore/CanonCore`, a **public** repository in a
**GitHub Free** organisation (`gh api orgs/jacobdrees-canoncore` reports `plan.name: free`).

**Every rule attempted was accepted at repository scope.** One `POST
/repos/jacobdrees-canoncore/CanonCore/rulesets` created an active ruleset on `~DEFAULT_BRANCH`
carrying `deletion`, `non_fast_forward`, `pull_request` and `required_status_checks` over four
named CI contexts; a follow-up `PUT` added `required_linear_history` and `required_signatures` and
was also accepted. The legacy API agreed independently: `PUT
/repos/.../branches/main/protection` accepted required status checks, one required approving
review, `required_linear_history` and `required_conversation_resolution`.

**The enforcement was real rather than merely stored.** While the full ruleset was active, the
open pull request for this very ticket moved to `mergeStateStatus: BLOCKED`, and on teardown it
returned to `CLEAN`. That is the difference between an API that records a setting and a gate that
stops a merge, and it is why the measurement attempted a merge-blocking configuration rather than
reading the endpoint.

**`protected: true` is NOT part of that argument, and is worth naming as a trap.**
`GET /repos/.../branches/main` reports `protected: true` right now, under the two-rule ruleset this
record keeps, which blocks no merge at all. It says a ruleset exists; it says nothing about what
the ruleset does. Only the pull request's own mergeability answers that.

**One thing is refused, and it is the thing the documentation is actually about.**
`POST /orgs/jacobdrees-canoncore/rulesets` answers `403 Upgrade to GitHub Team to enable this
feature.` Organisation-scoped rulesets are a paid feature. Repository-scoped ones are not.

**So GitHub's rulesets documentation is wrong for this case, and it is worth naming because it is
the source a future reader will check first.** Read 2026-09-11, *"About rulesets"* states a ruleset
applies *"for customers on GitHub Team and GitHub Enterprise plans"*. Measured at repository scope
on Free, that is false. Measured at ORGANISATION scope it is exactly right, and `403 Upgrade to
GitHub Team to enable this feature.` is the sentence the page is really describing. **Scope is the
word the page is missing**, and it is what makes the page safe to read rather than merely wrong. The protected-branches page is the one that holds: *"You can enable branch
restrictions in public repositories owned by a GitHub Free organization and in all repositories
owned by an organization using GitHub Team or GitHub Enterprise Cloud."* **The measurement wins
over both**, which is the whole reason this repository's rule is to measure rather than to cite.

The earlier measurement in `docs/research/ci-and-repo-standards.md` was correct when taken and its
own evidence predicted this: the 403 it recorded read *"Upgrade to GitHub Pro **or make this
repository public** to enable this feature."* CNCORE-62 did the second thing.

## Why this half is on

CNCORE-63 publishes a container image to a public registry from `main`. A force-push that rewrites
what `:latest` was built from, or a deleted default branch, are not defects a reviewer catches
afterwards; they are the states from which there is nothing to review. Those two are cheap to
refuse and nothing legitimate here does either.

**The gate stops accident, not intent, and must not be sold as more.** The admin bypass is
`always`, so the one person with admin on this repository can still do both. That is deliberate: a
solo project whose only maintainer is locked out of their own default branch is worse than no gate,
because the recovery path runs through GitHub Support. What the ruleset removes is the unattended
mistake -- a script, a stray `--force`, an agent reaching for the fastest way out of a conflict.

## Why the other half is off

Requiring CI to pass before a merge is the obvious next rule and it is **not** turned on. Three
things have to be true first, and none of them is true today.

**The merge path for a workflow-touching pull request is a direct push to `main`.** The `gh` token
here carries `repo` but not `workflow`, and GitHub refuses to let an OAuth app update
`.github/workflows/*` without it. CNCORE-63 was merged by pushing a merge commit over SSH for
exactly this reason, after `gh pr merge` refused. A `pull_request` rule closes that path, and the
next workflow-touching ticket would stop dead with no legible cause. The fix is one command --
`gh auth refresh -s workflow` -- and it belongs to whoever turns the rule on, not to this record.

**The check names are about to change.** CNCORE-80 splits `static-checks` into separately-named
Typecheck, Lint, Build and `DATABASE_URL`-guard checks. A required-checks list pins context strings,
so any list written today goes stale the moment that lands, and a required check that no longer
exists blocks every pull request rather than failing one.

**A required check that never runs pends forever.** `CLAUDE.md` already records that a conflicted
pull request gets no CI run at all. Under required checks that stops being "an absent check is the
tell" and becomes an unmergeable branch whose reason is invisible, and the documented fix from
GitHub is four words: *"Avoid requiring workflows that can be skipped."* Two checks in this
pipeline are matrix-named rather than job-named -- `The image, built and run (linux/amd64,
ubuntu-latest)` and `(linux/arm64, ubuntu-24.04-arm)`, from the two `include` entries at
`.github/workflows/ci.yml:585` -- so the list cannot be transcribed from job names either, and
`One image, both architectures` skips on a pull request, which is the pending-forever case above.

None of that is an argument against the rule. It is the precondition list, and it is here so that
turning the rule on is an afternoon's work rather than a rediscovery.

## What this does not change

`CLAUDE.md`'s standing sentence -- that a merge gate here is convention rather than enforcement --
is now true of **CI** and false of **history**. Both halves are stated there rather than one.

The provider repositories are untouched. `provider-wiki` and `provider-tmdb` stay private under
[[0089-provider-distribution-tiers]], and a private repository in a GitHub Free organisation gets
neither route: that is what
`docs/research/ci-and-repo-standards.md` measured, and it still holds where it was measured.

## Evidence

All 2026-09-11, `jacobdrees-canoncore/CanonCore`, repository public, organisation plan `free`.

| Attempt | Result |
| --- | --- |
| `GET /repos/.../rulesets` before | `[]` -- reachable, none configured |
| `GET /repos/.../branches/main/protection` before | `404 Branch not protected` |
| `POST /repos/.../rulesets`, active, `deletion` + `non_fast_forward` + `pull_request` + `required_status_checks` | **accepted**, id `22960358`, `current_user_can_bypass: never` |
| `PUT` the same ruleset, adding `required_linear_history` + `required_signatures` + admin bypass | **accepted**, `current_user_can_bypass: always` |
| `GET /repos/.../branches/main` while active | `protected: true` -- but it says so today too, under two rules that gate no merge; this proves a ruleset exists, not that anything is blocked |
| Open pull request #9 while active | `mergeStateStatus: BLOCKED` |
| `PUT /repos/.../branches/main/protection` (legacy), checks + 1 review + linear history | **accepted** |
| `POST /orgs/jacobdrees-canoncore/rulesets` | **403 `Upgrade to GitHub Team to enable this feature.`** |
| Both removed, then `GET` each | `[]`, `protected: false`, pull request back to `CLEAN` |
| `POST /repos/.../rulesets`, the ruleset this record keeps | id `22961356`, `deletion` + `non_fast_forward`, admin bypass `always` |
| `GET /repos/.../rules/branches/main` after | both rules reported, `ruleset_id: 22961356` |

Sources, read 2026-09-11: GitHub's *About rulesets*
<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets>
and *About protected branches*
<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>.

The ruleset is configuration on GitHub rather than a file in this tree, so nothing in a checkout
proves it exists. `gh api repos/jacobdrees-canoncore/CanonCore/rulesets` is how a reader checks this
record against reality: it is keyed on the repository alone, and should list `main history is
append-only` as `active`. An empty answer means the ruleset was removed rather than that this
record was never true.

**Ask that endpoint rather than the per-branch one.** The condition is `~DEFAULT_BRANCH`, not the
literal string `main`, so `rules/branches/main` answers the same question today and would answer
`[]` the day the default branch is renamed -- with the ruleset still fully active. That reads
exactly like the removal it is not.
