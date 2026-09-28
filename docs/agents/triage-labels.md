# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker   | Meaning                                  |
| -------------------------- | ---------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`         | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`           | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`      | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`      | Requires human implementation            |
| `wontfix`                  | the **Canceled** state | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Linear's Triage inbox is OFF on team CC, so a label is the only place triage state lives. `wontfix` is Linear's built-in Canceled workflow state, not a label.

## Kind and area labels (not triage roles)

Plain labels, never a Linear label group, because a group allows only one of its labels per issue.

- Kinds: `to-spec` (a project's spec issue), `spike` (research, dispatched to `/research`), `skills-repo` (the change lands in the skills repo).
- Areas: `server`; the clients `web`, `ios`, `macos`, `tvos`, in any combination (shared SwiftUI work carries all three Apple labels, so each client's filter finds everything that changes it); and `provider-<name>`, one per Provider, created when that Provider's first ticket is filed.

Before adding a label, check `orca linear team labels --team CC --json`; never create a duplicate. Linear's defaults `Bug`, `Feature` and `Improvement` are unused.
