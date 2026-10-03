# CanonCore

A self-hosted media server built schema-first: the Library is CanonCore's own schema,
built from Providers the user installs, and media files are only matched to it. One server, a web
client and one SwiftUI app for iPhone, iPad, Mac and Apple TV. Being rebuilt: the founding records are
in `docs/adr/`, names follow `CONTEXT.md`, and the work is ten Linear projects in team CC, in order,
each with an early spec that opens with its own next step, plus the Design references project.

<!-- standard:start -->
<!-- The standard, the same in every CanonCore repository. Edit it only in CLAUDE.md in
jacobdrees-canoncore/CanonCore; every other repository's CI compares its copy of this block with main. -->

## Most Important: Verify, don't recall

Look up any version, API signature, limit or price before stating it (`context7` for a library,
`WebSearch` otherwise); the lookup wins over memory. The point is current industry practice: what
the ecosystem does today, not what it did when the model was trained. Before a spec or its tickets
publish, check what competitors do and run the `check` skill on every claim a decision rests on.

## Principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
- Study how established products solve the problem before designing a solution. Adopt their proven patterns and conventions rather than inventing an approach from scratch.
- Do not introduce a configuration option, feature flag, or environment variable unless something in the repo reads it in the same change.
- Do not add a dependency without stating in the PR body what you checked in the existing dependencies first.
- Report status with evidence. "Tests pass" requires the command and its output. If a check was skipped, or failed, say so plainly rather than describing the work as complete.
- Prefer deletion. A change that removes more lines than it adds needs no justification; one that adds more needs a reason in the PR body.
- Keep this file a pointer file, under 200 lines. Repeated gotchas become checks (lint, hooks, CI), not prose here.
- End every spec's tickets with an audit ticket, blocked by all the others, that runs `auditing-a-spec`. It checks what was built against the spec's own stories and every spec blocked by it, files every blocking gap as a follow-up, and the Owner decides after round 2; the Owner walks the last clean round.

## CanonCore's own skills

Written for CanonCore's repositories and kept in `jacobdrees/claude-skills` (`~/.claude/skills`). How they fit
from a decision to a merged slice: CanonCore's [`docs/agents/workflow.md`](https://github.com/jacobdrees-canoncore/CanonCore/blob/main/docs/agents/workflow.md),
checked out at `~/orca/projects/CanonCore/docs/agents/workflow.md`.

- `check`: a claim, a ticket, a PR, a doc or a whole spec against the sources that own it; on every spec
  straight after `/to-tickets`, and whenever a version, limit or price is about to bear weight.
- `tracing-a-decision`: once, when a grill changes an ADR or a `CONTEXT.md` term, before anything is
  committed; lists every sentence the decision makes false and checks what it rests on.
- `dispatch`: Main's loop, to merge ready PRs, retire their worktrees and put the frontier to the Owner.
- `tracker-sweep`: when asked, to repair tickets that drifted from the tracker doc's filing standard.
- `auditing-a-spec`: the audit ticket every spec ends with. Its last, clean round carries the Owner's
  walk, the accessibility pass and the README additions.
- `design-panel`: the Owner invokes it, to put one UI question past nine design lenses.
- `setup-orca-linear-project`: the Owner invokes it, to stand up a project or add a repository.
<!-- standard:end -->

## Rebuilding

- Follow industry practice and what competitors do today, never the habits of this product's earlier attempt.
- CI runs axe on every web merge. With the manual pass in each spec's last audit (keyboard only, a screen
  reader, 200% zoom) they are "automated checks plus a manual review", never called WCAG compliance.
  CanonCore claims no WCAG 2.2 AA conformance, and on the web the keyboard pass does not report
  missing focus rings: the web client draws none, as Arc ships (ADR 0023; Apple waits on CC-39).

## Commands

None yet: the first project adds the pnpm + Turborepo monorepo (ADR 0016).

## Gotchas

- `main` refuses deletion and force-push (admin bypass on), and its ruleset requires CI's checks. Main
merges with `gh pr merge --auto` after review, so GitHub merges only once the checks pass.
- `.claude/settings.json` denies some calls on purpose (`git worktree`, `gh issue`): use
`orca worktree create` and `orca linear`. Its hook refuses a raw `orca terminal create ... claude`:
agents start through dispatch's `launch.sh`. Secrets live in `~/.config/canoncore/` and in the
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

### Arc

The web client and the web prototype use Arc as it ships (ADR 0023, proposed: nothing installed
yet). Agents use Arc's MCP server, its `arc` skill at project scope (`.claude/skills/arc/`, never
`~/.claude/skills`) and its `INSTRUCTIONS.md`. The Arc Pro token lives in
`~/.config/canoncore/arc-pro.env`; web-client agents reach Pro through `~/.config/canoncore/arc-mcp.json`.

## Working substrate

Every implementer runs in an Orca worktree bound with `--linear-issue CC-<n>`. How many run at once is in `docs/agents/dispatching.md`. An audit ticket's
`--name` leaves the ticket id out, so its merge does not close it (`docs/agents/issue-tracker.md`). Use Orca's browser
and `orca terminal` rather than Playwright or ad hoc PTYs.