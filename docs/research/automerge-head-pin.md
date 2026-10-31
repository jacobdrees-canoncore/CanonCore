31 Oct 2026. Ticket CC-331 (parent CC-324). The measured run used gh 2.97.0 against `jacobdrees-canoncore/CanonCore` as it stood at `main` `56dad938`. Its ruleset requires four status checks and no review, squash is the only merge method, auto-merge is allowed, and head branches are deleted on merge. The source code read is cli/cli at its latest release, v2.103.3 (`63837fb7`). No browser and no account other than the repository's own `gh` login were used.

# Does GitHub enforce `--match-head-commit` when a queued auto-merge fires?

**No.** GitHub checks the pinned commit when the auto-merge is queued. It does not check it again when the merge fires. A write-access push after queueing was merged as it stood, and the pinned commit was not.

## What the documentation says

- **gh sends the pin on the auto path.** In `pkg/cmd/pr/merge/http.go` one input struct carries `expectedHeadOid` whenever `--match-head-commit` is set. It goes to `mergePullRequest` for a direct merge, or to `enablePullRequestAutoMerge` when `--auto` finds the PR not yet mergeable. If the PR is already mergeable (state CLEAN, HAS_HOOKS or UNSTABLE), `--auto` merges directly with `mergePullRequest`. On a branch with a merge queue, gh always takes the auto path and still sends `expectedHeadOid`. gh never calls `enqueuePullRequest`. The flag's help text is "Commit `SHA` that the pull request head must match to allow merge". ([merge.go](https://github.com/cli/cli/blob/v2.103.3/pkg/cmd/pr/merge/merge.go), [http.go](https://github.com/cli/cli/blob/v2.103.3/pkg/cmd/pr/merge/http.go))
- **The schema promises a check on direct merges only.** `MergePullRequestInput.expectedHeadOid` is "OID that the pull request head ref must match to allow merge; if omitted, no check is performed." `EnablePullRequestAutoMergeInput.expectedHeadOid` and `EnqueuePullRequestInput.expectedHeadOid` are described only as "The expected head OID of the pull request", with nothing about when the check happens. `AutoMergeRequest` has no field that stores the expected oid. ([GraphQL reference: pulls](https://docs.github.com/en/graphql/reference/pulls); the same text is in [octokit/graphql-schema](https://raw.githubusercontent.com/octokit/graphql-schema/main/schema.graphql) at `82ff2d47`)
- **REST says the same about direct merges.** For `PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge`, `sha` is "SHA that pull request head must match to allow merge", and the response is 409 "if sha was provided and pull request head did not match". ([REST: merge a pull request](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request))
- **Only `merge-async` promises a check at execution time.** Its `sha` description says "if the PR is pushed in between the merge being requested and being executed, the merge will be cancelled". That is a different endpoint, and gh does not use it. ([REST: merge a pull request asynchronously](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request-asynchronously))
- **The auto-merge page says pushes by writers keep it on.** "Auto-merge is disabled if someone without write permissions pushes new changes to the head branch or switches the base branch." The page says nothing about a head sha. ([Automatically merging a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request))
- No GitHub changelog entry about `expectedHeadOid` was found.

None of these pages says whether the oid given to `enablePullRequestAutoMerge` is checked again when the merge fires, so the run below settles it.

## The measured run

PR [#60](https://github.com/jacobdrees-canoncore/CanonCore/pull/60). The Owner approved this throwaway PR on public CanonCore in a comment on CC-331 on 31 Oct 2026. Times are UTC.

| Time | Step | Result |
|---|---|---|
| 16:08:34 | Push commit A `02be2fb1` to `cc-331-throwaway`, then open #60 against `main` | Checks start on A |
| 16:08:36 | Control: `gh pr merge --auto --squash --match-head-commit <B>`, which names a commit that is not the head | Refused: `expected head oid does not match the current head oid (enablePullRequestAutoMerge)`, exit 1 |
| 16:08:37 | `gh pr merge --auto --squash --match-head-commit <A>` | Exit 0. `GH_DEBUG=api` shows the variables sent: `{"pullRequestId":"PR_kwDOUxXlGs8AAAABL_BVOA","expectedHeadOid":"02be2fb1…","mergeMethod":"SQUASH"}`. `autoMergeRequest.enabledAt` 16:08:38, `mergeStateStatus` BLOCKED (checks pending) |
| 16:08:40 | Push commit B `2a6952d3` (a child of A) as the same writer | `autoMergeRequest` stays set. The timeline has no `AutoMergeDisabledEvent` |
| 16:08:55 to 16:09:01 | All four required checks pass on B (A's own checks finished by 16:09:02) | |
| 16:09:04 | `MergedEvent`: squash commit `5d8b5853` on `main` | The merged file holds commit B's text, so the head that merged was B, not the pinned A |

What the run shows:

1. `expectedHeadOid` is checked when the auto-merge is enabled (the control was refused).
2. A later push by a writer neither disables the auto-merge nor stops it firing. The pinned oid is not checked when it fires: GitHub merged head B under a request pinned to A.

The merge put `docs/research/cc-331-throwaway.txt` on `main`. The PR that adds this note deletes it. The head branch was deleted automatically on merge, and the PR shows as merged, so it could not be closed.

## The merge queue (CC-2)

The merge queue was not measured. CanonCore has no merge queue yet, and turning one on in `main`'s ruleset is a settings change this spike was not approved to make. So this answer comes from the documentation alone:

- gh, on a branch with a merge queue, takes the `enablePullRequestAutoMerge` path with the same `expectedHeadOid` ([merge.go](https://github.com/cli/cli/blob/v2.103.3/pkg/cmd/pr/merge/merge.go)). The run above shows that this oid is checked only when the request is accepted.
- The merge queue pages document these removal reasons: failed CI, a timeout, a manual removal, a branch protection failure, and conflicts. They do not say whether a push to a queued PR's head removes it, or which head commit goes into the merge group. ([Merging a pull request with a merge queue](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request-with-a-merge-queue), [Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue))

The answer is that no source shows the pin enforced after the PR is queued. Treat `--match-head-commit` on a merge-queue branch as checked only when the PR is queued, unless CC-2 measures otherwise once it adds the queue.

## What the pin does protect

A direct `gh pr merge --match-head-commit <sha>` with no `--auto`, run once the checks have passed, is checked by `mergePullRequest` at merge time. That is the path `merge-if-green.sh` in the dispatch skill takes, so the private siblings' pin holds. `--auto` also falls back to a direct merge when the PR is already mergeable, and the pin is enforced in that case too. Adding the pin to a `--auto` that queues, which is the CanonCore path, only guards the moment of queueing. It does not stop a push after review from being merged.

## Verdict for CC-336 and CC-337

**No.** Pinning CanonCore's queued `gh pr merge --auto` with `--match-head-commit` does not stop a push that lands after review from merging. CC-336 (dispatch pins CanonCore's auto-merge to the reviewed commit) and CC-337 (CanonCore's merge docs pin the reviewed commit) would rest on a guarantee GitHub does not give. Main cancels both when this spike merges. If the reviewed commit must be the merged commit, a guarantee GitHub does keep is a direct pinned merge once the checks pass, which is what `merge-if-green.sh` does. Choosing that path is a new decision for the Owner, not part of these two tickets.

## Not sourced

- Whether a push by a writer removes a PR from a merge queue, and which head commit the merge group is built from: neither is documented, and neither was measured.
- What values `AutoMergeDisabledEvent.reasonCode` can take: the schema gives none.
- Whether the run's result is deliberate GitHub behaviour or could change: GitHub documents no guarantee either way.
