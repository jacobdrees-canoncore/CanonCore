---
paths:
  - ".github/workflows/**"
---

# Workflows

**Run `actionlint` before pushing.** A file that fails to parse creates NO run at all, so a broken
workflow reads as Actions being switched off rather than as a mistake in the file.

**A conflicted PR gets no CI either**, for a different reason: a `pull_request` workflow runs against
`refs/pull/N/merge`, which GitHub cannot build while the branch conflicts. An ABSENT check is the
tell, not a red one, and that ref keys the run — so a `--commit <head>` poll finds nothing and
`gh pr checks <n>` is what watches it.

**AND A REBASED PR'S ABSENCE PRESENTS AS A PASS** (ADR-0181). A force-push leaves no run against the
new head, and the PR goes on displaying the PREVIOUS head's results, which `gh pr checks` reports
without naming the commit they belong to. The trigger is not the problem: `on: pull_request` here
takes the default types, `synchronize` among them, and #210's force-push did produce a run — four
minutes and five seconds later. **That delay is the whole trap**, because a dispatcher who polls
once reads zero and concludes "never". A check is evidence only for the commit it ran against, so
gate a merge on `.claude/skills/dispatch/gate.sh`, which resolves the head and asks about THAT
commit, and never on the pull request's own rollup.

**A job that dies on one word names a registry, and only one of the three is this repo's.** `denied`
at `Initialize containers` is GHCR, wanting the repo given Read under the package's own Manage
Actions access, which lives outside git. `unauthorized` while booting buildkit is Docker Hub pulling
`moby/buildkit` anonymously. `ECONNRESET` reaching `registry.npmjs.org` at `pnpm/setup` is npm, and
reddened `main` on a docs-only commit. The last two clear on a rerun.

**Every job carries a `timeout-minutes`** (ADR-0141, `packages/config/src/ci-timeouts.test.ts`): a
hung job held a PR for six hours before that landed.
