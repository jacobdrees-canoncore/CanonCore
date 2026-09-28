# Clear the slate: checklist (agreed 2026-09-28; process step 5)

Inventoried 2026-09-28. Every destructive step is shown to the Owner before it runs.

## GitHub (`jacobdrees-canoncore`)

- [x] **CanonCore repo (public):** rename it `canoncore-v0`, make it private and archive it (D-92 as amended 2026-09-28). The new `CanonCore` repo is created in step 6.
  - [x] Copy the old tree into `canoncore-history`.
  - [ ] The new repo's first commit holds `docs/rethink/`, LICENSE, `.claude/settings.json` and an interim README (shown to the Owner first). The prototype branches move to it as single commits of their own files; the untracked local `prototypes/` folder is deleted once they are confirmed there.
- [x] **PR #361 (old CNCORE-468):** close it. The ticket is dropped.
- [x] **Tags and releases** v0.1.0, v0.2.0 and `archive/tardis-pipeline-2026-09-04`: keep as history.
- [x] **`provider-wiki` and `provider-tmdb` (private):** copy into `canoncore-history`, then archive them (read-only).
- [x] **`canoncore-history` is ALREADY ARCHIVED (read-only):** unarchive it, push, then re-archive.
- [x] **GHCR images** `canoncore`, `provider-wiki`, `provider-tmdb`: delete.
- [ ] **Actions secret `TMDB_READ_ACCESS_TOKEN`:** kept in `canoncore-v0`; re-add it to the new repo in step 6 from `~/.config/canoncore/tmdb-read-token`.

## Linear (`jacobrees-canoncore`)

- [x] **Export CNCORE to CSV:** 469 issues, 6 projects.
- [x] **Cancel the 7 open issues.** Carry forward only as notes: old CNCORE-107 (the @reboot probe; re-added to the crontab) and old CNCORE-76 (awesome-selfhosted; the rules moved to awesome-selfhosted-data).
- [ ] **RETIRE the CNCORE team.** Never delete it. Linear greys out Retire on a workspace's last team, so this runs in step 6, right after `/setup-orca-linear-project` creates team CC.
- [ ] **Create team CC,** with its key set in the create dialog. Confirm it with `team states`.
- [ ] **Correct `setup-orca-linear-project/reusing-a-workspace.md` and memory `linear-workspace-is-prepaid`:** "delete" becomes "retire".

## The Owner's Mac

- [x] **Take a final dump of the live install,** then stop and remove `canoncore-canoncore-1`, `canoncore-database-1`, `provider-wiki-provider-wiki-1` and `canoncore-postgres`.
- [x] **Unload the LaunchAgent `com.jacobrees.canoncore.dump`** after the final dump.
- [x] **Move `~/canoncore/`** (compose, dump.sh, notes) into the archive.
- [x] **Keep `~/Documents/CanonCore backups`** (126 MB).
- [x] **Delete the 11 exited leftover containers.**

## Claude and agent setup

- [ ] **Replace the old CLAUDE.md, `.claude/rules/` and `.claude/settings.json`** with new ones (the pointer-sized CLAUDE.md at `/setup-orca-linear-project` step 13, inside process step 6; the rest at step 7). The old ones go to the archive.
- [ ] **After `/setup-matt-pocock-skills`,** review the skills tuned to the old repo (dispatch: rungs, Postgres per worktree, ceiling 4).
- [ ] **Prune the obsolete memory notes about the old repo,** keeping the lessons.

## Unknown, ask the Owner

- [x] **Anything still live on Vercel or Neon?** Deletes there need the Owner's hands (memory: vercel-neon-deletes-need-jacobs-hands).

## Already done

- The Whatbox slot was wiped on 2026-09-28, and slskd was reinstalled.

## Done 2026-09-28/29

- `canoncore-history` f8cfc63 holds `final/` (gitleaks clean), re-archived. PR #361 closed, branch deleted. provider-wiki, provider-tmdb and `canoncore-v0` (the renamed old repo, now private) archived. The three GHCR packages deleted.
- Final dump `canoncore-2026-09-28T2251Z-ladder-1790544231016.dump` (97 MB) restored into a scratch database: 3,450 live Items in both. Its rotation dropped the four oldest dumps (20 to 23 Sep), as the nightly run would have.
- All containers and volumes removed; the LaunchAgent unloaded and its plist deleted; `~/canoncore/` removed.
- CNCORE: 7 open issues canceled (469 now closed); JSON and CSV copies in `~/Documents/CanonCore backups/linear-cncore-2026-09-28.*`; Linear's own CSV export requested (emailed).
- The local clone's `origin` points at `canoncore-v0` until step 6 creates the new repo. `docs/rethink/` is untracked here and preserved on local branch `rethink/preserve` and in the Documents backup; it becomes the new repo's first commit.
