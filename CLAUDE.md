# CanonCore

A self-hosted media server built schema-first: the Library is CanonCore's own schema,
built from Providers the user installs, and media files are only matched to it. One server, a web
client and one SwiftUI app for iPhone, iPad, Mac and Apple TV. Being rebuilt: the founding records are
in `docs/adr/`, names follow `CONTEXT.md`, and the work is ten Linear projects in team CC, in order,
each with an early spec that opens with its own next step, plus the Design references project.


## How a project closes

- A project closes only after the Owner has walked it on their own install; every stall found becomes a ticket before close.
- The same walk includes a manual accessibility pass (keyboard only, a screen reader, 200% zoom). CI runs axe on every web merge; together they are "automated checks plus a manual review", never called WCAG compliance.
- Each close adds to the README: a short screen recording, an architecture diagram, and links to the founding ADRs it built on.
- Follow industry practice and what competitors do today, never the habits of this product's earlier attempt.

## Commands

None yet: the first project adds the pnpm + Turborepo monorepo (ADR 0016).

## Gotchas

- `main` refuses deletion and force-push (admin bypass on); there are no required checks, so a
merge gate is convention. Do not assume a check blocked anything.
- `.claude/settings.json` denies some calls on purpose (`git worktree`, `gh issue`): use
`orca worktree create` and `orca linear`. Secrets live in `~/.config/canoncore/` and in the
gitignored `.env`, never in a commit, PR body or log.

## Agent skills

### Issue tracker

Linear workspace `jacobrees-canoncore`, team `CC`, through the `orca linear` CLI. GitHub Issues
is off. Tickets are born in Todo as sub-issues of their spec, with blocked-by relations. See
`docs/agents/issue-tracker.md`.

### Triage labels

Four labels plus the Canceled state; the Triage inbox is off. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and one `docs/adr/` at the root. See `docs/agents/domain.md`.

## Working substrate

Every implementer runs in an Orca worktree bound with `--linear-issue CC-<n>`. Use Orca's browser
and `orca terminal` rather than Playwright or ad hoc PTYs.