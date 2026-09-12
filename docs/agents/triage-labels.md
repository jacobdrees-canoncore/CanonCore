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

## `to-spec` and `provider-repo` are KINDS, not triage roles

Two labels here answer "what is this issue" rather than "how ready is it", which is the axis
Linear's own `Bug` / `Feature` / `Improvement` sit on. They compose with a triage role rather than
replacing one, so an issue carries one of each.

- **`to-spec`** — this issue IS a spec, produced by `/to-spec`, and is a container rather than a
  unit of work. It names the four: CNCORE-2, CNCORE-60, CNCORE-96 and CNCORE-104. A spec carries
  `--state Backlog` for the reason above, and `ready-for-human` once it needs `/to-tickets` run on
  it, because splitting a spec is a human's call.
- **`provider-repo`** — the work lands in `provider-wiki` or `provider-tmdb` rather than here.

**The name says which skill made it, not what to do with it.** `to-spec` marks the output of
`/to-spec`; the action a labelled issue is usually waiting for is `/to-tickets`. That is worth
knowing before renaming it to something that reads like an instruction.

## Creating a label needs the web UI, and the CLI will not tell you gently

`orca linear label add` matches an EXISTING label only: an unknown name answers
`linear_invalid_label: No label exactly matched "<name>"`. The same is true of
`save-issue --project`. So a new label is made at **Settings → Workspace → Labels**
(`/settings/issue-labels`), NOT the team page — the triage labels are workspace-scoped, and a label
made on the team page is a different thing that happens to look the same in a list.

Linear's inline label row does not commit on a typed key or a global Enter. What works, verified
2026-09-12: set the textarea through React's native value setter, then dispatch `input`, `change`,
the three `Enter` keyboard events, `blur()` and `focusout`. Anything less leaves the value on screen
and unsaved, which reads exactly like success.
