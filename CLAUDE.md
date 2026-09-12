# CanonCore

## Project summary

A self-hosted catalogue for collections that do not fit one folder tree, built around
multi-placement: one item sitting in many orderings at once, each with its own position. It is
domain-general, and it is a media server in its own right rather than a client of Plex or Jellyfin.
The decisions are in `docs/adr/`.

## Projects and the roadmap

Work lives in Linear **Projects**. A parent issue carries a state of its own that lies about its
children — CNCORE-60 read `Done` over thirteen open ones — so parent links were dropped on
2026-09-12. A spec is an issue labelled `to-spec`, held in `Backlog`, inside the project it
describes.

Four projects, in order, each ending in something demoable:

1. **Version one** — done. Multi-placement, rendered.
2. **The public release** — in progress. v0.1.0 tagged and published; v0.2.0 is the owner write
   path, CNCORE-71 to 75.
3. **A real catalogue, live** — CNCORE-96, tickets 97 to 103. The wiki provider serves tardis.wiki
   on a credential the owner supplies, a real Doctor Who catalogue is imported, and the archive is
   deleted once that is proven.
4. **A catalogue you can navigate** — CNCORE-104. Groups scope the catalogue and every row says
   where it sits. Split it into tickets only after 3 lands: it is designed against real data, and a
   three-item seed is what made the front page unreadable in the first place.

Playback, then the clients, then the demo come after ([[0055-web-now-phone-next-tv-last]],
[[0115-the-public-release-comes-before-the-playback-half]]). Design is its own effort, later still:
`packages/ui` is already shadcn, and the product will be redesigned from the ground up.

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

The Harry Potter pass is done (2026-09-05) and folded into the ADRs. Rediscovering the audiobook
renderings, `based_on`, the playback-medium rule, the missing `object` kind, institution versus
building, `release_date`, or abridgement means you are re-deriving records that exist.

## Specs

A spec covers one **effort**, not the project. Reach for one when a build is too big for a session
and has to survive being split across several.

Specs live on the tracker as snapshots, thrown away once the work ships; `docs/adr/` outlives them.

## Verify, don't recall

Your training data is older than this stack, so look a version, signature, limit or price up before
stating it: `context7` for a library, `WebSearch` otherwise. Where a lookup and memory disagree the
lookup wins. **Whenever one is load-bearing, run the `verify` skill instead**: it finds each claim's
OWNER and reads what that owner says today, which is what stops a write-up about a library standing
in for the library. It ruled 11 claims contradicted on 2026-09-12, most of them written confidently.

## Conventions

- `record` and `edge` are banned as names for a Placement or an Item. Say Placement, say Item.
  A PROVIDER'S OWN external record keeps the word, because `CONTEXT.md` uses it that way itself.
- `duplicate` is banned in code, because it is ambiguous across three different things: two files with the same content (a REDUNDANT FILE), one item in many orderings (MULTI-PLACEMENT, the central feature), and the same item twice in one container (a REPEAT, which ADR-0009 allows for recaps and bookends).
- `canon` is the product's name and nothing else, never a field or a UI word. If continuities ever need distinguishing, the word is `continuity`.
- Every keyboard accelerator has an equivalent visible UI path.
- `CONTEXT.md` is the glossary and is binding on names in code, UI copy and ticket titles alike.

## Gotchas

- **A conflicted PR gets no CI at all.** A `pull_request` workflow runs against
  `refs/pull/N/merge`, which GitHub cannot build while the branch conflicts -- so it creates no run
  rather than a failing one. An ABSENT check is the tell, not a red one. Merge `main` and it fires.
  That ref keys the run too: a `--commit <head>` poll finds nothing; watch with `gh pr checks <n>`.
- **`main`'s history is enforced; its CI is not.** A ruleset refuses deletion and force-push on
  `main`, admin bypass on, so it stops accident rather than intent. There are no required checks
  and no required review, so a merge gate is still convention: do not assume a check blocked
  anything. Protection IS available here, measured 2026-09-11 on this public repo in a Free org
  and against GitHub's own rulesets docs, which are wrong at repository scope. See ADR-0118.
- **Some tool calls are denied on purpose** by `.claude/settings.json`. `git worktree` and
  `gh issue` are blocked: use `orca worktree create` and `orca linear` instead. A denial here is the
  config working, not a bug to route around. `.env` files stay gitignored, and no secret reaches a
  PR body, a commit or a log.

## Agent skills

- **Filing, reading or relating an issue** — Linear (workspace `jacobrees-canoncore`, team
  `CNCORE`) through the `orca linear` CLI; GitHub Issues is unused. It lies five ways, one being
  `ok: false` on writes that LANDED. `docs/agents/issue-tracker.md`.
- **Labelling or triaging one** — `docs/agents/triage-labels.md`. Triage roles are workspace
  labels, `wontfix` is the Canceled state, and `to-spec` / `provider-repo` are kinds rather than
  roles.
- **Adding a term or a record** — one `CONTEXT.md` and one `docs/adr/`, both at the root.
  `docs/agents/domain.md`.

## Working substrate

- Use `orca worktree create` for parallel work. Bind each worktree to its ticket with
  `--linear-issue CNCORE-<n>` so `--current` resolves in every later call.
- Every worktree shares one Postgres container and gets its OWN database inside it, on **55432**
  rather than 5432, because a local Postgres shadows 5432 silently and you test the wrong engine
  (ADR-0104).
- Use Orca's built-in browser (`orca tab`, `snapshot`, `click`, `fill`) rather than Playwright.
- Use `orca terminal` rather than ad hoc PTYs. It is a real PTY, so an interactive prompt -- a
  device code, a confirmation -- can be read with `terminal read` and answered with `terminal send`.
- Run `actionlint` on a workflow before pushing it. A file that fails to parse creates NO run at
  all, so a broken workflow reads as Actions being switched off.
- `gh` carries `read:packages`, so `docker pull ghcr.io/jacobdrees-canoncore/*` works here. The
  other half of that lives outside git: a repo gets Read under the package's own Manage Actions
  access, or its jobs die at `Initialize containers` on the single word `denied`.
- Credentials live in `~/.config/canoncore/`, outside every repo so no commit can reach them and
  every worktree reads one copy: `provider-tmdb.env` (that provider throws at startup without its
  token; CI uses the repo secret) and `whatbox.env` (the slot's login, for SSH or its web UI).

Install whatever makes the work easier, without asking. What earns a question first is anything
that spends money, holds a licence, or runs as a background service.

Machine state is not repo state. A tool the build or the tests reach for belongs in the manifests
CI and a fresh clone read, never only on this Mac, because that gap is silent here and surfaces as
a broken clone on a machine nobody is watching.

**Every implementer runs in an Orca worktree**, never the Claude Code subagent tool's own isolation.

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
  frontier from the tracker as each PR merges, because no DAG is doing it here — **then STOP.
  Recomputing is yours; STARTING A WAVE IS THE USER'S.** Merging authorises removing ITS worktree,
  not creating the next: four agents went out on "recalculate", 2026-09-11.

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
