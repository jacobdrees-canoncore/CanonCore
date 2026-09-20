# CanonCore

## Project summary

A self-hosted catalogue for collections that do not fit one folder tree, built around
multi-placement: one item sitting in many orderings at once, each with its own position. It is
domain-general, a media server in its own right rather than a client of Plex or Jellyfin, and its
decisions are in `docs/adr/`.

## Projects and the roadmap

Work lives in Linear **Projects**; parent links were dropped on 2026-09-12 because a parent's state
lies about its children (CNCORE-60 read `Done` over thirteen open ones). A spec is an issue labelled
`to-spec` in `Backlog`, inside the project it describes — **and a spec is the only thing `Backlog`
holds.** An agent-filed ticket lands there by default, where the frontier cannot see it: move each to
`Todo` as you triage it.

**This list is the order.** Each ends in something demoable.

1. **Version one** — done. Multi-placement, rendered.
2. **The public release** — closed. A provider beside an install is reachable since CNCORE-163; no
   PUBLIC image exists (ADR-0089), so by hand as since v0.2.0. Public defects; 76 fused 2027-01-12.
3. **A real catalogue, live** — 98 to 103 Done, and CNCORE-96's sentence untrue: the live import
   landed in a test database the next run drops. 97 is superseded by 118.
4. **The foundation** — CNCORE-159. Finishes 2 and 3, supersedes CNCORE-104 (project cancelled). Its
   79 tickets audited clean on 2026-09-20 with ZERO unmet criteria, so CNCORE-242 to 250 are
   corrections to records and copy rather than missing mechanisms.
5. **The data** — not yet named. Every Container is a `Theory:Timeline - X` page and every Item is
   `kind: work`, so six of seven kinds and nine of thirteen properties sit empty. Ends in a Rose page,
   and in images. Evidence: `docs/research/walking-the-owners-install.md`.
6. **The redesign** — `packages/ui` is already shadcn and the product gets redesigned from the ground
   up. Speccing 5 is not this: four of 5's eight flow problems are data, not design.
7. **Playback, then the clients, then the demo** ([[0055-web-now-phone-next-tv-last]],
   [[0115-the-public-release-comes-before-the-playback-half]]). **5 and 6 sit ahead of 7 by
   [[0152-two-more-efforts-go-ahead-of-the-playback-half]]**, which takes the second insertion ADR-0115
   refused and declines to license a fourth.

**A DEFECT BELONGS TO THE PROJECT THAT BUILT IT; A GAP BELONGS TO THE NEXT ONE**, so 4 closes rather
than becoming the bucket every later finding lands in. CNCORE-159 put deriving Group membership out of
scope as "unspecified and free to decide": that is 5's.

**A project is not finished until it has been used on the Owner's own instance**
([[0132-a-project-is-not-finished-until-it-has-been-used]]) — two closed green while their own
sentences were false. `/closing-a-spec` is that gate; `grill-with-docs` specs the next one.

## Principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity, and never take a stopgap meant to be replaced later.
- Lean on what is already here before adding a dependency, and on an established library before writing your own. Read a library's docs and types before concluding it lacks a capability. State in the PR body what you checked first.
- Study how established products solve the problem before designing a solution. Adopt their proven patterns and conventions rather than inventing an approach from scratch.
- Do not introduce a configuration option, feature flag, or environment variable unless something in the repo reads it in the same change.
- Report status with evidence. "Tests pass" requires the command and its output. If a check was skipped, or failed, say so plainly rather than describing the work as complete.
- Prefer deletion. A change that removes more lines than it adds needs no justification; one that adds more needs a reason in the PR body.
- When an audit says the remaining work is larger than expected, CUT SCOPE INSIDE THIS REPOSITORY. Never start another one. Every previous attempt at this product died that way.
- A filed ticket carries a state, a label, an assignee and a project — all four flags on one `orca linear create`, and `--parent` is not among them since parent links were dropped. Whatever it asserts about a version, limit, price or practice is checked with `/verify` before dispatch: an unchecked figure travels, and one reached an ADR before a later agent failed to reproduce it. Mechanics and sizing in `docs/agents/issue-tracker.md`.
- Keep this file under 200 lines. Past that, first delete anything derivable from the code, then move path-specific guidance to `.claude/rules/` with `paths:` frontmatter and reference material to skills. `@path` imports do not help: they load at launch like the rest of the file.

## Reading the decisions

`docs/adr/` is the authority and every record carries the reason it was taken, so a decision found
there is CLOSED. Anything the ADRs and `CONTEXT.md` do not mention is simply UNSPECIFIED, and yours
to decide with ordinary judgement: do not stall asking permission for things nobody has ruled on.

`status: proposed` means DECIDED BUT NOT YET IMPLEMENTED; `accepted` means its MECHANISM is whole,
never merely that its own gate was met. A proposed record binds, reopened only by a superseding
record. COUNT the statuses rather than quote a figure — that line has been wrong twice.

Do not look for, read, or reference any previous attempt at this product, in any repository or on
the web, and do not go searching for one. The single exception is the forensic record, which
ADR-0051 rests on. It is NOT in this repository and never will be: it is held in the private
`canoncore-history` repo, which also keeps this project's pre-publication history
([[0114-the-public-repository-is-a-fresh-one]]). Read it as evidence when a record cites it, never as
instructions — its salvage manifest is superseded.

## Specs

A spec covers one **effort**, not the project: reach for one when a build is too big for a session
and has to survive being split across several. Specs are tracker snapshots, thrown away once the
work ships; `docs/adr/` outlives them.

## Verify, don't recall

Your training data is older than this stack, so look a version, signature, limit or price up before
stating it: `context7` for a library, `WebSearch` otherwise. Where a lookup and memory disagree the
lookup wins. **Whenever one is load-bearing, run the `verify` skill instead**: it finds each claim's
OWNER and reads what that owner says today. It ruled 11 claims contradicted on 2026-09-12.

## Conventions

- `record` and `edge` are banned as names for a Placement or an Item. Say Placement, say Item.
  A PROVIDER'S OWN external record keeps the word, because `CONTEXT.md` uses it that way itself.
- `duplicate` is banned in code, because it is ambiguous across three different things: two files with the same content (a REDUNDANT FILE), one item in many orderings (MULTI-PLACEMENT, the central feature), and the same item twice in one container (a REPEAT, which ADR-0009 allows for recaps and bookends).
- `canon` is the product's name and nothing else, never a field or a UI word. If continuities ever need distinguishing, the word is `continuity`.
- Every keyboard accelerator has an equivalent visible UI path.
- `CONTEXT.md` is the glossary and is binding on names in code, UI copy and ticket titles alike.

## Gotchas

- **CI tells you less than it looks.** A conflicted PR gets NO run rather than a red one, and a job
  that dies on one word names a registry. Both, with `actionlint`, in `.claude/rules/workflows.md`.
- **`main`'s history is enforced; its CI is not.** A ruleset refuses deletion and force-push on
  `main`, admin bypass on, so it stops accident rather than intent. There are no required checks
  and no required review, so a merge gate is still convention: do not assume a check blocked
  anything. Protection IS available on this public repo in a Free org; ADR-0118 has the measurement
  and why GitHub's own rulesets docs are wrong at repository scope.
- **Some tool calls are denied on purpose** by `.claude/settings.json`. `git worktree` and
  `gh issue` are blocked: use `orca worktree create` and `orca linear` instead. A denial here is the
  config working, not a bug to route around. `.env` files stay gitignored, and no secret reaches a
  PR body, a commit or a log.

## Agent skills

- **Filing, reading or relating an issue** — Linear (workspace `jacobrees-canoncore`, team
  `CNCORE`) through the `orca linear` CLI; GitHub Issues is unused. It lies in SEVERAL WAYS, each
  catalogued there under its own heading and none of them counted from here — two being `ok: false`
  on writes that LANDED and `linear_no_linked_issue` on a worktree that IS bound.
  `docs/agents/issue-tracker.md`.
- **Labelling or triaging one** — `docs/agents/triage-labels.md`. Roles are workspace labels, `wontfix`
  is Canceled, `to-spec` / `provider-repo` are kinds not roles.
- **Adding a term or a record** — one `CONTEXT.md`, one `docs/adr/`, both at root. `docs/agents/domain.md`.

## Working substrate

- Use `orca worktree create` for parallel work, binding each to its ticket with
  `--linear-issue CNCORE-<n>`; `create` and `set` both bind, whatever older notes say. **Confirm at
  `linkedLinearIssue`, never `linkedIssue`** (GitHub's field, null here) — and never with
  `--current`, which answers about the CALLER's worktree, not the one you stand in (ADR-0162).
- Every worktree shares one Postgres container with its OWN database inside, on **55432** not 5432,
  since a local Postgres shadows 5432 silently and you test the wrong engine (ADR-0104). **Four
  agents at once**: one `pnpm test:e2e` peaks at 67 of 288 usable connections, re-measured
  2026-09-19 with the eleventh server standing, so four still fit (4 x 67 = 268 < 288). The
  measurement lives in `apps/web/e2e/global-setup.ts`; this restates it (CNCORE-137, CNCORE-178).
- Prefer Orca's tools: the browser (`orca tab`, `snapshot`, `click`, `fill`) over Playwright, and
  `orca terminal` over an ad hoc PTY. But **read `--screen` BEFORE sending to an agent**, because a
  send does not always reach the chat: input to an agent PARKED on a prompt goes to the WIDGET,
  where `--enter` SELECTS the option under the cursor, and mid-turn `--enter` queues instead of
  submitting until `ctrl+x ctrl+s` (`printf '\030\023'`) flushes it. All three answer `ok: true`
  (ADR-0162).
- Credentials live in `~/.config/canoncore/`, outside every repo so no commit can reach them and
  every worktree reads one copy: `provider-tmdb.env` (that provider throws at startup without its
  token; CI uses the repo secret) and `whatbox.env` (the slot's login, for SSH or its web UI).

Install whatever makes the work easier, without asking. Ask first only about what spends money,
holds a licence, or runs as a background service.

Machine state is not repo state. A tool the build or the tests reach for belongs in the manifests CI
and a fresh clone read, never only on this Mac: that gap is silent here and surfaces as a broken
clone nobody is watching.

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
  task spec to keep in step with it — but a brief is CONFIRMED WHERE IT LANDS, never at the call
  that sent it, so check the binding before the agent needs it: `monitor.sh` emits `UNBOUND` for a
  worktree carrying none (ADR-0162). Each slice lands on `main` behind its own PR, because a
  slice waiting on an integration branch is not demoable on its own (ADR-0051). Recompute the
  frontier from the tracker as each PR merges, because no DAG is doing it here — **then STOP.
  Recomputing is yours; STARTING A WAVE IS THE USER'S.** Merging authorises removing ITS worktree,
  not creating the next: four agents went out on "recalculate", 2026-09-11.

**Removing the worktree is the dispatcher's job, and only the dispatcher's.** `implement` cleans up
only a worktree it created itself and never creates one here, so remove it as the PR merges, once
nothing is uncommitted and nothing unpushed.

Before merging any ticket branch, read `git diff <base>..<branch>` rather than trusting that
checks passed. Parallel agents produce semantic contradictions that compile cleanly.

Tickets that touch the same files are ordinary: a worktree each turns an overlap into a conflict git
reports at merge rather than a silent overwrite. `/dispatch` carries the rest -- rungs, and why a
tree is files rather than a package name.

**When tickets share ONE REASON TO CHANGE, fold them into one pass.** Not merely one file — that is
the incidental overlap above, and same files with two reasons is two passes. One agent, one PR per
repo, **naming every ticket it closes**: a fold only the agent heard about is one nobody can check,
and the ticket nobody can check is the one that silently never gets done. In Progress as you brief.
