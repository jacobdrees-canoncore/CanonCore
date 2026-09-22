# Walking this install

How to ask CanonCore's running install whether it is current, and how to stand a throwaway beside it
without writing to the Owner's catalogue. The `closing-a-spec` skill carries the method — which
surfaces to enumerate, the case taxonomy, the two-instance rule — and reads this file for the part
that is CanonCore's rather than general.

## Is it current? Ask both, because either alone reads clean

```sh
docker exec <db> psql -U canoncore -d canoncore -Atc \
  "select count(*) from drizzle.__drizzle_migrations"     # against ls packages/db/src/migrations/*.sql
docker inspect <app> --format '{{.Created}}'              # against main's newest merge
```

The first asks whether the stored state is current; the second asks whether the running build is.
They fail apart, and the skill carries the measurement that showed it.

Behind on either → the spec is not closed. Update it, then walk it.

## Enumerating the surfaces

The skill walks every surface the filesystem shows, not the ones memory holds. Here the surfaces are
the web app's routes:

```sh
find apps/web/src/app -name page.tsx -o -name route.ts   # 12 on 2026-09-22: 11 pages, 1 route handler
```

**WALK THEM LOGGED IN.** On 2026-09-20 five of the eleven pages rendered a refusal and nothing else until a session
exists; every write surface, the provider list and the account are invisible logged out.

## The throwaway, and why its own project name is not enough

**A PINNED VOLUME IS PROJECT-INDEPENDENT, WHICH IS THE REVERSE OF WHAT IT LOOKS LIKE.** The Owner's
`compose.yaml` pins its volume with an explicit name so the catalogue survives the directory being
renamed:

```yaml
volumes:
  canoncore_data:
    name: canoncore_data      # NOT prefixed with the project. That is the point of it.
```

So `docker compose -p canoncore-gate up` against that file mounts **the Owner's live catalogue** into
the throwaway, and puts a second Postgres on one data directory. `canoncore_providers` is pinned the
same way.

A throwaway is therefore **self-contained, deriving from nothing**: the published image, its own
volume under its own project, its own port, and fresh secrets rather than the live ones. Joining the
Provider network read-only is safe, because that is the one name it is right to share.

```sh
docker compose -p canoncore-gate config --format json   # volumes MUST resolve to canoncore-gate_*
```

Check rather than assume. Tear it down with `down -v`, then read `docker volume ls` back:
`canoncore_data` is still there, or something was wrong with the file.

**AND THE DEFAULT PROJECT NAME IS TAKEN BY THE LIVE INSTALL.** `canoncore-canoncore-1` and
`canoncore-database-1` (working dir `~/canoncore`) carry `com.docker.compose.project=canoncore`, so a
throwaway given no `-p` of its own joins the Owner's instance. Name the project.

`canoncore-postgres` carried that same label until CNCORE-250 and now carries `canoncore-dev`, which
is what a throwaway must also stay clear of. Two projects on one name was why the orphans were the
live install and why Compose printed `--remove-orphans` as the remedy; that pair is disjoint now.
Still check `docker ps` before any compose command in `packages/db`, and still never `db:down` while
other worktrees are testing — it stops the container every one of them is using.

## The corpus is the point

**THE OWNER'S INSTALL IS NOT A TEST FIXTURE.** It holds the real catalogue and it is what makes the
scale findings possible, so it is walked and never reset. Every finding on 2026-09-20 needed the real
corpus: a 2,907-member ordering, T holding 931 of 8,052, the 37 Items sorting before A, a picker
capped at 100 of 8,052.

Its nightly dump is `~/canoncore/dump.sh` at 03:15, restored with `pnpm db:restore`.
