# Plex schema dumps

Four files that sat untracked in the repo root for some time with no explanation. They are dumps
of **Plex Media Server's own database schema**, useful as evidence about how the market leader
actually models media.

- `migrations.tsv` (446 lines) — the migration ladder. The most useful of the four, and the one
  that dates the dump: its ladder ends at `202507311200`, so this is a build from **July 2025 or
  later**.
- `sqlite_tables.txt`, `pg_tables.txt`, `ml_tables.txt` — **table NAME lists only, no column
  definitions.** Do not expect to answer schema questions from these; `media_parts` appears as a
  single line.

They were used to date the dump and confirm which tables exist. The file-identity algorithm
(`SHA1(size + SHA1(first 64KB) + SHA1(last 64KB))`) was verified elsewhere, against code and a
reproduced worked example — see `../competitor-sweep/verify-plex-claims.md`, claim 6.
