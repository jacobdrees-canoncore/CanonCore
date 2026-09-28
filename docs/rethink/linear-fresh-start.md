# Linear fresh start (verified 2026-09-28)

**Verify result:** 1 contradicted, 3 unfounded, 11 confirmed. Nothing in Linear was changed.

## Facts

- **Numbering:** issue numbers are per team. A new team starts at 1, and this workspace has done it before (CAN was replaced by CNCORE).
- **Team limits:** Free 2, Basic 5, Business unlimited. Basic charges per user, not per team, so a second team costs nothing.
- **Deleting a team** permanently deletes its issues, with a 30-day grace period.
- **Retiring a team** makes its issues read-only. They are "removed from your sidebar", stay searchable and linkable, and can be restored at any time.
- **Moving an issue** between teams renumbers it. The old URL redirects.
- **Export:** CSV only, up to 2,000 issues, without attachments. Markdown is per issue, copied to the clipboard. There is no JSON except through the API.
- **CNCORE today:** 469 issues. 449 Done, 8 Canceled, 5 Duplicate, 3 Todo, 3 Backlog, 1 In Progress. It is the only team.

## Our setup contradicts the goal

`setup-orca-linear-project/reusing-a-workspace.md` and the memory `linear-workspace-is-prepaid` say to create a new team and DELETE the old one. That loses the old tickets. The fix is to RETIRE the old team instead.

The skill's gotchas still apply:
- A duplicate team name is refused silently.
- Keys are 7 characters at most.
- Set the key in the create dialog.
- Confirm the new team with `team states`.

## Plan (J)

1. Export CNCORE to CSV, as insurance.
2. Create the new team in `jacobrees-canoncore`, with a new key. It starts at 1.
3. RETIRE CNCORE; never delete or rekey it. CNCORE-n stays a valid historical name.
4. Move only the open issues the rethink keeps, and cancel the rest.
5. Update issue-tracker.md, CLAUDE.md, the skill and the memory, changing "delete" to "retire".
