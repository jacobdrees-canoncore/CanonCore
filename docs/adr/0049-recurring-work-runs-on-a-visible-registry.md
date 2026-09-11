---
status: proposed
---

# Recurring work runs on a visible task registry

Scans, the six-month TMDB cache eviction, projection reconciliation, provider re-refresh, orphan
collection, tombstone compaction, palette extraction and the analysis pass all need a runner, and
none had one.

Keyed tasks, each visible, runnable by hand, cancellable, with a run history. Jellyfin's shape is
worth copying — named trigger types rather than raw cron, and `Aborted` distinct from `Failed`,
because a job that was killed and a job that broke need different answers.

Plex's own version is one maintenance window (3am-6am by default) plus EIGHT separately toggleable
tasks with hard-coded cadences — database backup every three days, optimise weekly, remove old
bundles and cache files weekly, refresh local metadata every three days, and so on. Not "one
setting", as an earlier version had it, and the eight are worth reading as a list of what actually
needs scheduling in this category.

The minimum is that last night's failure is VISIBLE. A recurring job whose result nobody can see is
one that silently stopped months ago.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`, `docs/research/verify-adr-jellyfin.md`.
