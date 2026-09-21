---
status: proposed
---

# A worktree is retired by content, and an auxiliary one only when it is named

> **PROPOSED 2026-09-21, MECHANISM WHOLE AND ADOPTION OWED, for CanonCore.** `retire.sh` sits beside
> `merge-if-green.sh` in `.claude/skills/dispatch/`, `packages/config/src/worktree-retirement.test.ts`
> drives it over seventeen worlds built from a real bare origin, a real linked worktree and a real
> squash merge, and both documents that used to state this rule now point at it. **NOT BUILT: its
> first real retirement.** Nothing has yet been retired with it in anger, because no ticket merged
> while it was being written, and cncore-333's three real auxiliary trees were left standing on
> purpose: they were live. [[0181-a-check-is-evidence-only-for-the-commit-it-ran-against]] stood
> `proposed` for the same reason and CNCORE-328 flipped it on adoption; the first dispatcher to
> retire with this one flips this record. This record's number was assigned by the dispatcher.

`/dispatch` step 2 is "merge, and remove the worktree in the same action", and it already stated the
safety rule for the second half: a squash merge makes ancestry the wrong test, so compare CONTENT
against `origin/main` before removing. `CLAUDE.md` added the third step, "then drop its databases".

**Nothing in the repository implemented either.** `merge-if-green.sh` guarded the merge half and its
last line was `gh pr merge`; it never removed a worktree, never compared content and never dropped a
database. So the retirement was a rule in three documents that every dispatcher re-derived by hand
or skipped, which is the shape CNCORE-288 had just fixed on the merge side and for the same reason:
a guard the dispatcher runs from memory is one the next dispatcher does not have.

It had already cost a pass. On 2026-09-21 cncore-316's worktree was removed in the same command as
the content comparison, so the removal happened before the DIFF lines were read. Two files differed.
Both turned out to be `main` running ahead, so nothing was lost — **by the order the shell happened
to run things, not by any check.**

## "main is ahead" and "content was lost" are one line, and the blob is what tells them apart

A squash merge lands the branch's CONTENT under a subject of `main`'s own, so none of the branch's
commits is an ancestor of `main` afterwards, by construction. Ancestry therefore cannot answer
whether the work landed, and the comparison has to be of content, file by file.

That produces a DIFF line in two entirely different situations, identical in shape: `main` took the
branch's version and has since changed it, or `main` never took it at all. Only the first is safe.

CNCORE-334 asked for the difference to be explained by "`main` holds a later commit touching it".
**That test is unsound, and it fails on exactly the case the guard exists for.** It is equally true
of a file another ticket edited while this branch's change to it never merged — so the unsafe
reading passes as though it were the safe one, and a guard that cannot refuse its own founding
incident is that incident one level down.

**So the evidence is the blob.** A difference is explained when some commit on `main` since the fork
point holds that file EXACTLY as the branch has it: then the branch's version reached `main`, and
what remains is `main` moving on. The weaker test was refused rather than implemented, and the
suite holds a world for each reading of the same line so the two cannot be confused again.

A second explanation covers what the blob cannot reach: `main`'s history on the file carries this
ticket's own subject, which is the work landing and the merge or a later amend altering it on the
way in. It is anchored to the start of the subject, because this repository's squash subjects open
`CNCORE-<n>:` and a ticket MENTIONED in someone else's subject is not the same fact.

## The upstream is expected to be gone, which inverts the merge gate's reading of the same fact

`merge-if-green.sh` STOPS when a worktree has no upstream to compare against, and it is right to: a
branch with no upstream, before the merge, is one whose work is not in the pull request.

By the time retirement runs, `gh pr merge --squash --delete-branch` has taken the remote branch
away. **No upstream is what a correctly merged ticket looks like**, so a guard copied across from
the merge side refuses every retirement it is handed. Two guards, opposite readings of one fact,
each right at its own moment.

Nothing is given up by passing it, because the content comparison is the stronger test: a branch
that was never pushed at all has every file UNEXPLAINED and stops there instead.

## One question refuses a main checkout and derives the workspace path

In a linked worktree `--git-dir` is `<main>/.git/worktrees/<name>` while `--git-common-dir` is
`<main>/.git`; in a main checkout the two are equal.

So one read does both jobs this script needed. It refuses `~/orca/projects/<repo>`, whose removal
would take the Owner's own checkout and whose databases are the live install's
([[0192-a-cross-repo-tickets-provider-half-gets-a-worktree-of-its-own]]), and it hands back the main
checkout that the drop has to run from. **No path is written down anywhere**, which is what the
scratch version could not manage: it hardcoded the CanonCore workspace, so it could not retire a
provider worktree, and provider worktrees are half of what this repo creates.

Whether a repo HAS databases is asked of the checkout the same way — does the drop this script would
run exist in its manifest — rather than inferred from its name, because listing the provider repos
here makes a fourth repository somebody's maintenance burden. The drop itself is
[[0191-removing-a-worktree-drops-its-databases-and-refuses-a-list-naming-canoncore]]'s, and it
refuses while a live worktree still owns the databases, so it goes after the removal and never
before.

## An auxiliary worktree's owner is recorded nowhere, so it is never inferred

A ticket can run `git worktree add` for a job of its own: the comment scan's parser oracle wants
HEAD, `main` and the previous commit checked out at once. Those trees are registered in the repo's
`.git/worktrees/` and live anywhere on disk, and **Orca never learns about them**, so `orca worktree
list` cannot see them and nothing retired them. Measured on cncore-333, 2026-09-21: three at
`/private/tmp/wt-head`, `wt-main` and `wt-prev`, registered in `provider-wiki/.git/worktrees/`
beside its real Orca worktree.

**Ownership is recorded nowhere, and three plausible tests for it were each refused by measurement.**
The registration holds a `gitdir` naming a path and a detached `HEAD` naming a sha, and nothing that
names a ticket.

- **Reachability cannot attribute one.** Only `wt-head` sat on a commit unique to cncore-333's
  branch; `wt-main` and `wt-prev` sat on commits every branch in the repo shares.
- **Age cannot.** They were two minutes old when they were found.
- **Uncommitted work cannot.** All three were clean but for an untracked `node_modules` from a
  scratch install.

A fourth was available and is refused on principle: that the retiring ticket is the last Orca
worktree in that repo, so anything left must be its litter. It is plausible and it is not recorded,
which makes it the same move as reading "main holds a later commit" as "the content landed".

**So the script never infers ownership. It is told, or it stops.** An unattributed tree stops the
retirement and is named with its path and its HEAD's subject; `--aux <name>` is how the dispatcher
who made one says so; and a `--aux` matching no registration is refused rather than passed over,
because a typo that removes nothing while reporting `RETIRED` is an absence presenting as a pass. A
tracked change in one stops it even when asserted, since naming a tree does not make somebody else's
edit yours. **An auxiliary tree put inside its own worktree raises none of this**, because the
worktree's removal takes it, and that is the habit `/dispatch` now recommends.

The removal is `rm -rf` of the tree AND of its entry under `worktrees/`, because
`.claude/settings.json` denies `Bash(git worktree:*)` — which covers `list`, `prune` and `remove`
alike, measured 2026-09-21 — so there is no `git worktree remove` to call and a registration left
behind is one git still honours pointing at a path that is gone. A registration whose tree has
already been deleted is pruned unasked: no files, no agent, no work, nothing to break.

## As built, under CNCORE-334

**BUILT: the whole retirement, and both documents that used to state it.**
`.claude/skills/dispatch/retire.sh` compares content, explains a difference as `main-ahead` or
`ticket-named` or stops on it, refuses a main checkout, refuses uncommitted and unpushed work,
scans the registrations, removes the worktree, drops the databases where the checkout has them, and
reports one line per file and one verdict line with a non-zero exit on everything but `RETIRED`.
`packages/config/src/worktree-retirement.test.ts` drives it over seventeen worlds at the script's
own process boundary, with `orca` and `pnpm` stubbed on `PATH`; the STOP is measured in five of
them, including the world where `main` edited the file later but never took the branch's version.
`SKILL.md` step 2 and `CLAUDE.md` both point at the script.

**NOT BUILT: adoption, and the three real trees.** No merged worktree has been retired with it, and
cncore-333's three auxiliary trees still stand because that ticket was live while this was written.
Removing a live agent's tree is the one failure this record's own guard exists to refuse, so they
were named rather than swept.

**NOT BUILT: recording an auxiliary tree's owner at creation.** `--aux` closes the gap at retirement
time, which is where the leak was found; it does not stop the next tree being created unlabelled.
The durable fix is for the tree to be made inside its ticket's own worktree, which is a habit stated
in `SKILL.md` and enforced by nothing.
