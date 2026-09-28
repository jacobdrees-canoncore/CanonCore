# Matt Pocock's suggested setup (research, 2026-09-28)

**Verify result:** 1 contradicted, 14 confirmed, 3 judgement.

**Sources:** github.com/mattpocock/skills at HEAD c55ee46 (2026-09-18), aihero.dev "A complete guide to AGENTS.md" (2026-01-18) and "skills-implement" (2026-08-24).

## His setup

- **CLAUDE.md / AGENTS.md: as small as possible.** A one-sentence description, the package manager and any non-standard commands. Everything else goes behind pointers. "Config is death": standing preferences live in CLAUDE.md, not in skill edits.
- **CONTEXT.md:** one glossary. Each term gets 1 or 2 sentences and an `_Avoid_:` list of synonyms. Be opinionated.
- **ADRs:** `docs/adr/NNNN-slug.md`. **One paragraph is enough**, and Status is optional. Write one only when a decision is hard to reverse, surprising, and a real trade-off.
- **Names:** a PRD is now a **spec** (`to-spec`: problem, solution, user stories, implementation decisions, testing seams, out of scope, with no file paths). Issues are now **tickets** (`to-tickets`: tracer-bullet vertical slices with blocking edges).
- **Flow:** `/grill-with-docs` (with an optional `/prototype`), then `/to-spec`, then `/to-tickets`, then `/implement` per ticket, which drives `/tdd` and `/code-review`. **Steps 1 to 3 happen in one context window.**
- **Mechanical rules become checks** (lint, hooks, CI), not prose: "Default to building the check over writing the rule" (`retro`).
- **TDD:** one test at a time, only at seams agreed in advance. Browser tests come after the behaviour works.
- **Trackers:** "Linear for issues and planning, GitHub for code and PRs". Upstream, Linear sits under "Other" in `setup-matt-pocock-skills` (the README's claim of built-in Linear support is contradicted). Our copy has a dedicated "Linear (via Orca)" tracker option (`issue-tracker-linear-orca.md`), which is the one to use.
- **Parallel work:** `/implement` is one ticket per invocation. `implement-spec` (in progress) fans out worktrees onto ONE PR per spec. Do large refactors first.

## Our copies

- **No drift upstream:** all 27 synced skills are identical to his current versions. Our local edits (Orca and ticket bindings) are deliberate.
- **His skills we lack:**
  - `pr`: Before/After evidence and Merge Danger.
  - `retro`: turns failures into checks.
  - `setup-pre-commit`.
  - `git-guardrails-claude-code`.
  - `claude-handoff` and `loop-me` (in progress).
  - the writing skills.

## To adopt (J, to be grilled)

1. A pointer-sized CLAUDE.md, with gotchas moved into rules or checks.
2. `/setup-matt-pocock-skills` with its dedicated "Linear (via Orca)" tracker option (`issue-tracker-linear-orca.md`) for team CC, NOT "Other".
3. One-paragraph ADRs, under the three-part test.
4. spec and tickets naming, with OUR competitor + verify step before a spec publishes and during /to-tickets, before publishing (tickets are born in Todo as sub-issues).
5. Keep Orca worktrees, 4 agents, and one PR per ticket (a deliberate difference from his one PR per spec).
6. Adopt `retro`, `setup-pre-commit` and `pr`.
7. TDD at agreed seams.
