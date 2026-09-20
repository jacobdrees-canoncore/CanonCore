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

**A job that dies on one word names a registry, and only one of the three is this repo's.** `denied`
at `Initialize containers` is GHCR, wanting the repo given Read under the package's own Manage
Actions access, which lives outside git. `unauthorized` while booting buildkit is Docker Hub pulling
`moby/buildkit` anonymously. `ECONNRESET` reaching `registry.npmjs.org` at `pnpm/setup` is npm, and
reddened `main` on a docs-only commit. The last two clear on a rerun.

**Every job carries a `timeout-minutes`** (ADR-0141, `packages/config/src/ci-timeouts.test.ts`): a
hung job held a PR for six hours before that landed.
