# Triage Labels

The skills speak in terms of five canonical triage roles. This repo maps four of them onto
workspace labels and one onto a Linear workflow state.

| Role in the skills | In this repo | Mechanism |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Workspace label |
| `needs-info` | `needs-info` | Workspace label |
| `ready-for-agent` | `ready-for-agent` | Workspace label |
| `ready-for-human` | `ready-for-human` | Workspace label |
| `wontfix` | **Canceled** | Workflow state |

Linear's own **Triage inbox is deliberately off** on team `CNCORE`. With `needs-triage` as a
label, enabling the inbox would create a second place for an issue to hide, and it would route
every integration-authored issue out of the default views. A label is the only place triage state
lives here; do not turn the inbox on as a "fix".

## Applying them

Labels:

```bash
orca linear label add CNCORE-12 --label ready-for-agent --json
orca linear label remove CNCORE-12 --label needs-info --json
orca linear label set CNCORE-12 --label ready-for-human --json     # replaces all labels
orca linear team labels --team CNCORE --json                        # list what exists
```

Canceled, for `wontfix`:

```bash
orca linear status set CNCORE-12 --to Canceled --json
```

There is no `wontfix` label. Cancelling an issue is what "wontfix" means; a label saying the same
thing would be a second mechanism for one role, which is worse than one documented edge.

## Always name a state when filing

`orca linear create` writes as an OAuth integration, and Linear gives such an issue a default
state whenever none is named. With Triage off, that default is the first Backlog state, so a
ticket filed without `--state` is visible but not where the workflow expects it. Pass
`--state Todo` for work that is ready and `--state Backlog` for a spec or container that is not
itself a unit of work.

## Do not create duplicates

Before adding any label, check `orca linear team labels --team CNCORE --json`. The workspace also
ships Linear's defaults (`Bug`, `Feature`, `Improvement`); those are categorisation, unrelated to
triage roles, and should not be repurposed.

## `to-spec`, `provider-repo`, `skills-repo` and `spike` are KINDS, not triage roles

Four labels here answer "what is this issue" rather than "how ready is it", which is the axis
Linear's own `Bug` / `Feature` / `Improvement` sit on. They compose with a triage role rather than
replacing one, so an issue carries one of each.

- **`to-spec`** — this issue IS a spec, produced by `/to-spec`, and is a container rather than a
  unit of work. It names four specs, one per project on the roadmap: **CNCORE-2** (Version one),
  **CNCORE-60** (The public release), **CNCORE-96** (A real catalogue, live) and **CNCORE-159** (The
  foundation). All four read `Done` — a spec is closed when its project ships, so `Done` is not the
  thing that separates them from the fifth. **CNCORE-104** carries the label too and is `Canceled`
  along with its project, superseded by CNCORE-159 (`CLAUDE.md`). So a listing by label returns the
  four and a listing including cancelled work returns five. Counted from the board 2026-09-20 rather than
  quoted, because this list has been wrong once already. A spec carries `--state Backlog` for the
  reason above, and `ready-for-human` once it needs `/to-tickets` run on it, because splitting a spec
  is a human's call.
- **`provider-repo`** — the work lands in `provider-wiki` or `provider-tmdb` rather than here.
- **`skills-repo`** — the work lands in `jacobdrees/claude-skills`, the shared skills at
  `~/.claude/skills` that include the `dispatch` scripts, rather than here. A ticket with a half
  here as well carries it too, as CNCORE-342 does. `/dispatch` creates every worktree in this
  repository unless told otherwise, so the label is how a dispatcher sees which tickets need
  `--repo name:skills`, and the dispatch prompt has to say so. Added 2026-09-22, on CNCORE-342
  and CNCORE-379 to 385.
- **`spike`**: the outcome is a finding, not functionality, so the work is a research note rather
  than code. `/dispatch` briefs a `spike` ticket `--prompt "/research"` instead of `/implement`, and
  `research`, run in a worktree bound to the ticket, lands the note behind a PR naming it. There is
  no `implement` label: `/implement` is the unlabelled default. Added 2026-09-26 by the Owner, after
  CNCORE-368 ran as a spike under `/implement`, which says nothing about research; chosen over two
  labels on every ticket, since a kind is added only where it changes how the work is done
  (CNCORE-423).

## `blocked-externally` is the only other thing `Backlog` may hold

`CLAUDE.md` says a spec is the only thing in `Backlog`, and this is the exception that proves rather
than breaks it: real work, correctly filed, whose blocker is **outside this repo and outside our
control** — a date, a host reboot, a third party. It names CNCORE-76, fused to 2027-01-12 because
awesome-selfhosted's clock runs four months from v0.1.0's Release, and CNCORE-107, which waits on a
shared host rebooting so a `@reboot` probe can fire.

**It is not "blocked by another ticket", which Linear relations already express** and the frontier
already reads. A ticket blocked by CNCORE-100 sits in `Todo` with an edge; a ticket blocked by
January sits here with this label.

The dispatch monitor exempts it alongside `to-spec`, so a correctly parked ticket stops drawing a
`DRIFT-FILING` line. Before that exemption it fired on four tickets every pass, which is how a check
becomes something a dispatcher skims past.

**The name says which skill made it, not what to do with it.** `to-spec` marks the output of
`/to-spec`; the action a labelled issue is usually waiting for is `/to-tickets`. That is worth
knowing before renaming it to something that reads like an instruction.

## Creating a label needs the web UI, and the CLI will not tell you gently

`orca linear label add` matches an EXISTING label only: an unknown name answers
`linear_invalid_label: No label exactly matched "<name>"`. The same is true of
`save-issue --project`. So a new label is made at **Settings → Workspace → Labels**
(`/settings/issue-labels`), NOT the team page — the triage labels are workspace-scoped, and a label
made on the team page is a different thing that happens to look the same in a list.

**Orca's own browser tools are enough, and the elaborate recipe below is no longer the way.**
Verified 2026-09-13 creating `blocked-externally`: `orca click --element <New label>`, then
`orca fill --element <ref> --value <name>`, then `orca computer press-key --app Orca --key Return`.
The label existed immediately, confirmed by reading it back through `orca linear team labels` rather
than off the screen. `orca fill` dispatches the events React wants, which is what the hand-rolled
sequence was compensating for.

What that supersedes, kept because it explains why the recipe was elaborate: a typed key or a global
Enter alone does not commit the row, and the 2026-09-12 workaround was to set the textarea through
React's native value setter, then dispatch `input`, `change`, the three `Enter` keyboard events,
`blur()` and `focusout`. **The failure mode is the reason to read the label back either way:** an
uncommitted value stays on screen and reads exactly like success.
