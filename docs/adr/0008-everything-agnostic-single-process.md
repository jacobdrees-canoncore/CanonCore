# Everything-agnostic: one process on SQLite, and host limits are settings

CanonCore is for anyone who self-hosts and for any franchise: nothing in the core schema, UI or defaults names Doctor Who (the hardest test case, never the target), and a host's limits become settings or capability checks, never the product's rules ("We can't just focus on my use case"). So the server is a single Node process on SQLite through Kysely and better-sqlite3, runs under whatever supervisor the host has (systemd, launchd, a Docker restart policy or cron), and ships from every merge to main as a versioned release, a Node bundle with the web app inside or a Docker image, updated by `canoncore update` (backup, forward-only migrations, swap, restart, health check) and reversed by `canoncore rollback`. The first deployment is a shared seedbox with no systemd, no usable GPU, a loaded CPU and containers that "may stop working at any time", and this shape runs there without being built for it.

## Considered Options

- A Postgres server: rejected, one more process to babysit.
- Drizzle: passed over because it is still 0.x (1.0 is RC).
- Building releases on the host, or containers on the seedbox: rejected for its shared CPU and "may stop working".

## Consequences

- The server refuses to start on a database newer than it knows, as in old ADR-0047 (canoncore-history), so a rollback restores the backup taken before migrating.
- better-sqlite3 gives way to `node:sqlite` once that is Stable.
