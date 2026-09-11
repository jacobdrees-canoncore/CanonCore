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
