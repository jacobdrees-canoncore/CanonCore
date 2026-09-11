# CanonCore

## Project summary

A self-hosted catalogue for collections that do not fit one folder tree, built around
multi-placement: one item sitting in many orderings at once, each with its own position. It is
domain-general, and it is a media server in its own right rather than a client of Plex or Jellyfin.
The decisions are in `docs/adr/` and the work is on Linear as CNCORE-2 and its tracer bullets.

## Principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Lean on what is already here before adding a dependency, and on an established library before writing your own. Read a library's docs and types before concluding it lacks a capability.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
- Study how established products solve the problem before designing a solution. Adopt their proven patterns and conventions rather than inventing an approach from scratch.
- Do not introduce a configuration option, feature flag, or environment variable unless something in the repo reads it in the same change.
- Do not add a dependency without stating in the PR body what you checked in the existing dependencies first.
- Report status with evidence. "Tests pass" requires the command and its output. If a check was skipped, or failed, say so plainly rather than describing the work as complete.
- Prefer deletion. A change that removes more lines than it adds needs no justification; one that adds more needs a reason in the PR body.
- When an audit says the remaining work is larger than expected, CUT SCOPE INSIDE THIS REPOSITORY. Never start another one. Every previous attempt at this product died that way.
- A list of things two mature products have is not a backlog. Every item in `docs/research/competitor-sweep/` was decided on user benefit rather than on parity, and the next sweep is not automatically owed a response.
- The first version ends in a rendered page, not a report. Reject on sight any proposal that grows the document phase without bringing the render forward.
- A filed ticket carries a state, a label, an assignee and a parent — all four flags on one `orca linear create` — and whatever it asserts about a version, limit, price or practice is checked with `/verify` before dispatch. An unchecked figure travels: one reached an ADR before a later agent failed to reproduce it. Mechanics and sizing in `docs/agents/issue-tracker.md`.
- Keep this file under 200 lines. Past that, first delete anything derivable from the code, then move path-specific guidance to `.claude/rules/` with `paths:` frontmatter and reference material to skills. `@path` imports do not help: they load at launch like the rest of the file.

## Reading the decisions

`docs/adr/` is the authority and every record carries the reason it was taken, so a decision found
there is CLOSED. Anything the ADRs and `CONTEXT.md` do not mention is simply UNSPECIFIED, and yours
to decide with ordinary judgement: do not stall asking permission for things nobody has ruled on.

Every record is `status: proposed`, and that is not hedging: it means DECIDED BUT NOT YET
IMPLEMENTED. A record becomes `accepted` when the slice that implements it lands. Treat a proposed
record as binding on the work and reopen it only with a superseding record, never by disagreeing
with it in code.

Do not look for, read, or reference any previous attempt at this product, in any repository or on
the web, and do not go searching for one. The single exception is the forensic record, which
ADR-0051 rests on. It is NOT in this repository and never will be: it is held in the private
`canoncore-history` repo, which also keeps this project's pre-publication history
([[0114-the-public-repository-is-a-fresh-one]]). Read it as evidence when a record cites it, never as
instructions — its salvage manifest is superseded.

The Harry Potter pass is done (2026-09-05) and its findings are folded into the ADRs. Do not repeat
it. If you find yourself rediscovering the audiobook renderings, the `based_on` qualifier, the
playback-medium rule, the absence of an `object` kind, institution versus building, what
`release_date` means, or abridgement, you are re-deriving records that already exist.

## Specs

A spec covers one **effort**, not the project. Reach for one when a build is too big for a session
and has to survive being split across several. CNCORE-2 is version one's; the playback half, the
clients and the demo each get their own.

Specs live on the tracker. They are snapshots, thrown away once the work ships — `docs/adr/` and
`CONTEXT.md` outlive them. `SPEC.md` was deleted under that rule, not against specs.

## Verify, don't recall

Your training data is older than this stack. Before stating a version, API signature, limit, or price, look it up: `context7` for any library, `WebSearch` for anything else. Where a lookup and your memory disagree, the lookup wins. The point is current industry best practice: what the ecosystem does today, not what it did when the model was trained.

Attribution, motive and measurement are what decide whether a citation holds, and the `verify`
skill carries all three. Reach for it whenever a version, limit, price or practice is load-bearing;
it also names each claim's owner, which is the part that stops a write-up about a library standing
in for the library.

## Conventions

- `record` and `edge` are banned as names for a Placement or an Item. Say Placement, say Item.
  A PROVIDER'S OWN external record keeps the word, because `CONTEXT.md` uses it that way itself.
- `duplicate` is banned in code, because it is ambiguous across three different things: two files with the same content (a REDUNDANT FILE), one item in many orderings (MULTI-PLACEMENT, the central feature), and the same item twice in one container (a REPEAT, which ADR-0009 allows for recaps and bookends).
- `canon` is the product's name and nothing else, never a field or a UI word. If continuities ever need distinguishing, the word is `continuity`.
- Every keyboard accelerator has an equivalent visible UI path.
- `CONTEXT.md` is the glossary and is binding on names in code, UI copy and ticket titles alike.

<!-- Only where this repo differs from the language default. A linter beats a rule here. -->

## Gotchas

- **A conflicted PR gets no CI at all.** A `pull_request` workflow runs against
  `refs/pull/N/merge`, which GitHub cannot build while the branch conflicts -- so it creates no run
  rather than a failing one. An ABSENT check is the tell, not a red one. Merge `main` and it fires.
- **`main`'s history is enforced; its CI is not.** A ruleset refuses deletion and force-push on
  `main`, admin bypass on, so it stops accident rather than intent. There are no required checks
  and no required review, so a merge gate is still convention: do not assume a check blocked
  anything. Protection IS available here, measured 2026-09-11 on this public repo in a Free org
  and against GitHub's own rulesets docs, which are wrong at repository scope. See ADR-0118.
- **Some tool calls are denied on purpose** by `.claude/settings.json`. `git worktree` and
  `gh issue` are blocked: use `orca worktree create` and `orca linear` instead. A denial here is the
  config working, not a bug to route around. **`.env` reads were denied until 2026-09-11 and are
  not now** — they stay gitignored, and no secret reaches a PR body, a commit or a log.
- **File Linear issues with `--state Todo`.** `orca linear create` writes as an OAuth integration,
  and without a named state the issue lands in the team's default Backlog state rather than where
  the workflow expects it. On a team with Triage enabled it would be diverted to the Triage inbox
  and vanish from every default view; Triage is off here, so the failure is quieter but still
  wrong. See `docs/agents/issue-tracker.md`.
- **Linear team keys cap at 7 characters.** `CNCORE` is the key because Linear's UI rejects
  anything longer, in both the create-team dialog and team settings. Linear also refuses, silently
  and with no error, to create a team whose name duplicates an existing one.

## Agent skills

### Issue tracker

Issues live in Linear (workspace `jacobrees-canoncore`, team `CNCORE`), driven entirely through the
`orca linear` CLI. GitHub Issues is not used. See `docs/agents/issue-tracker.md`.

### Triage labels

`needs-triage`, `needs-info`, `ready-for-agent` and `ready-for-human` are workspace labels;
`wontfix` is the Canceled state. Linear's Triage inbox is deliberately off, so a label is the only
place triage state lives. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and one `docs/adr/` at the repo root, both created lazily. See
`docs/agents/domain.md`.

## Working substrate

This repo is Orca-managed; `orca repo list --json` has its ids and refs.

- Use `orca worktree create` for parallel work. Bind each worktree to its ticket with
  `--linear-issue CNCORE-<n>` so `--current` resolves in every later call.
- Run `pnpm db:start && pnpm db:setup` in a fresh worktree. Every worktree shares one Postgres
  container and gets its OWN database inside it; the container is on 55432, never 5432, because a
  local Postgres shadows 5432 silently and you end up testing against the wrong engine (ADR-0104).
- Use Orca's built-in browser (`orca tab`, `snapshot`, `click`, `fill`) rather than Playwright.
- Use `orca terminal` rather than ad hoc PTYs. It is a real PTY, so an interactive prompt -- a
  device code, a confirmation -- can be read with `terminal read` and answered with `terminal send`.
- Run `actionlint` on a workflow before pushing it. A file that fails to parse creates NO run at
  all, so a broken workflow reads as Actions being switched off.
- `gh` carries `read:packages`, so `docker pull ghcr.io/jacobdrees-canoncore/*` works here. The
  other half of that lives outside git: a repo gets Read under the package's own Manage Actions
  access, or its jobs die at `Initialize containers` on the single word `denied`.
- `provider-tmdb` runs locally from `~/.config/canoncore/provider-tmdb.env`. CI reads the same
  token from the `TMDB_READ_ACCESS_TOKEN` repo secret.

Install whatever makes the work easier, without asking: Homebrew for tools, corepack for package
managers, whatever a ticket turns out to need. What earns a question first is anything that spends
money, holds a licence, or runs as a background service.

Machine state is not repo state. A tool the build or the tests reach for belongs in the manifests
CI and a fresh clone read, never only on this Mac, because that gap is silent here and surfaces as
a broken clone on a machine nobody is watching.

**Every implementer runs in an Orca worktree**, never a raw `git worktree` and never the Claude
Code subagent tool's built-in worktree isolation.

## Implementing

**A ticket is not done until the ADRs it implements read `accepted`.** But a record whose mechanism
you built only half of is not one you implemented: leave it `proposed` and write into it which half
landed and which did not. Half a mechanism looks finished from outside, and the missing half
surfaces later as a false signal in whatever depends on it. **A CROSS-REPO PAIR FLIPS ON THE SECOND
TICKET**, since `docs/adr/` is here and no PR in a provider repo reaches it; that PR body links the
first ticket's MERGED PR, or the flip is an assertion its reviewer cannot check against the diff.

**Write what implementation teaches you into an ADR.** That is where it survives.

**A correction propagates, or it has not landed.** After correcting a record, grep for what cites it
and fix those too: a record and the ticket citing it drift apart otherwise. Put the correction in
the sentence it corrects — placed beside one, it leaves the old claim standing.

- `/implement` takes one or two tickets. `/implement-spec` takes a whole spec, and runs only when
  asked for by name — never by inference from a wide frontier.
- Dispatch from the main worktree, which is how this repo builds by default: a child worktree per
  ticket, created with `--linear-issue CNCORE-<n> --agent claude --prompt "/implement"` and nothing
  more in the prompt. The binding is the brief — `--current` resolves the ticket, so there is no
  task spec to keep in step with it — and each slice lands on `main` behind its own PR, because a
  slice waiting on an integration branch is not demoable on its own (ADR-0051). Recompute the
  frontier from the tracker as each PR merges, because no DAG is doing it here.

**Removing the worktree is the dispatcher's job, and only the dispatcher's.** `implement` tells a
worker to clean up only a worktree it created itself, and in this mode it never creates one, so it
leaves it standing exactly as instructed. Remove it as the PR merges, once nothing is uncommitted
and nothing unpushed.

Under `/implement-spec`, the PR branch is the integration branch. Merge ticket branches into it,
verify there, and only then to `main`.

Before merging any ticket branch, read `git diff <base>..<branch>` rather than trusting that
checks passed. Parallel agents produce semantic contradictions that compile cleanly.

Tickets that touch the same files are ordinary. Giving each file one owner works only while the
files are features: a registry every ticket adds a line to, like a tool list, the shared test
fixtures or the migration ladder, cannot be owned by one ticket without serialising the rest. A
worktree each is what turns an overlap into a conflict git reports at merge rather than a silent
overwrite. Merge ticket branches one at a time, and rebase the branches still running onto the
integration branch as each one lands, so a conflict is met once and small instead of at the end and
whole.

**When tickets share ONE REASON TO CHANGE, fold them into one pass.** Not merely one file — that is
the incidental overlap above, and same files with two reasons is two passes. One agent, one PR per
repo, **naming every ticket it closes**: a fold only the agent heard about is one nobody can check,
and the ticket nobody can check is the one that silently never gets done. In Progress as you brief.
