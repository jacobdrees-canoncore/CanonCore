# Validating CNCORE-4 and CNCORE-5 against the sources

Every technical claim in tickets CNCORE-4 ("An item on a page") and CNCORE-5 ("One item, two
orderings, hand-placed"), and in the ADRs they rest on (0012, 0014, 0015, 0017, 0018, 0047, 0062,
0066), put back to the source that owns it.

Run date: **2026-09-10**. Every verdict below rests on a lookup made on that date. Nothing is
carried from memory or from an earlier pass.

Method: `context7` and vendor docs for libraries, `curl` against `rfc-editor.org` for the RFCs,
and — where a lookup could not settle it — **empirical tests against a real PostgreSQL 17.11
server and a real `drizzle-kit` install**. The empirical tests are the load-bearing part of this
document; three of them contradict the tickets.

Verdict vocabulary:

| Verdict | Meaning |
|---|---|
| **CONFIRMED** | A lookup or test made on 2026-09-10 supports the claim. URL / command and quote given. |
| **CONTRADICTED** | The source says otherwise. What is actually true is stated. |
| **UNFOUNDED** | No source found either way. What would settle it is stated. |
| **JUDGEMENT** | The source is real but does not decide the question; the call is a design choice. |

---

## Section 0 — Versions

All four are the current stable as of **2026-09-10**.

| Thing | Current stable | Dated | How checked |
|---|---|---|---|
| **Drizzle ORM** | **0.45.2** | published `2026-09-09T10:25:54Z` | `npm view drizzle-orm version time.modified` |
| **Drizzle Kit** | **0.31.10** | published `2026-09-09T10:28:46Z` | `npm view drizzle-kit version time.modified` |
| **PostgreSQL** | **18.6** (also 17.11, 16.15, 15.19, 14.24) | released **2026-08-13** | postgresql.org front page, fetched 2026-09-10 |
| **Next.js** | **16.3.4** | published `2026-09-09T23:56:55Z` | `npm view next version`; `dist-tags.latest = 16.3.4` |

Notes worth carrying:

- Drizzle ORM and Drizzle Kit version **independently** — `0.45.2` and `0.31.10`. There is no
  matched pair. Pin both.
- PostgreSQL **19 Beta 3** also shipped 2026-08-13. 19 is not stable; do not target it.
- The **local** Postgres on this machine is `PostgreSQL 17.11 (Homebrew) on aarch64-apple-darwin`
  (verified via `select version()`), a major version behind current stable. Every SQL result in
  this document was produced on 17.11. Everything used here (`NULLS NOT DISTINCT`, generated
  columns STORED) exists in 15+ and behaves identically in 18; only **VIRTUAL** generated columns
  are 18-only, and they are not used.
- Next.js `16.3.4` docs are served with `version: 16.3.4` and `lastUpdated: 2026-06-09` in their
  own front matter, so the Next.js quotes below are current-for-the-installed-version.

**VERDICT: CONFIRMED** for all four, each with a dated lookup from this run.

---

## Section 1 — CNCORE-4: the ISO8601 ordering key

### The claim

CNCORE-4, in "What to build":

> an ISO8601 timestamp as the ordering key so schema and data-fix migrations share one sequence

and, as a hard acceptance criterion:

> - [ ] The migration ordering key is an ISO8601 timestamp, not an integer

ADR 0047 states it as the decision:

> The ordering key is an ISO8601 TIMESTAMP, never an integer, so schema and data-fix migrations
> share one sequence.

There are three separable claims. They do not get the same verdict.

### 1a. Do schema migrations and hand-written data migrations share one sequence in Drizzle?

**VERDICT: CONFIRMED** — and demonstrated end to end, not merely read about.

`drizzle-kit generate --custom --name=<name>` produces an empty `.sql` file and appends it to the
same journal as a generated schema migration. Source, fetched 2026-09-10 from
<https://orm.drizzle.team/docs/kit-custom-migrations>:

> "You can generate empty migration files to write your own custom SQL migrations for DDL
> alternations currently not supported by Drizzle Kit or data seeding."

Test run on 2026-09-10 with `drizzle-orm@0.45.2` / `drizzle-kit@0.31.10` against a real Postgres
database `dz_interleave`:

```
$ npx drizzle-kit generate --name=initial
[✓] Your SQL migration file ➜ drizzle/20260910102311_initial.sql

$ npx drizzle-kit generate --custom --name=seed_owner_source
Prepared empty file for your custom SQL migration!
[✓] Your SQL migration file ➜ drizzle/20260910102429_seed_owner_source.sql

$ npx drizzle-kit migrate
[✓] migrations applied successfully!

$ psql -d dz_interleave -c 'select id, created_at from drizzle.__drizzle_migrations order by id;'
 id |  created_at
----+---------------
  1 | 1789035791691
  2 | 1789035869271

$ psql -d dz_interleave -c 'select title from items;'
         title
-----------------------
 from custom migration
```

One folder, one journal, one `drizzle-kit migrate` command, one ledger table. A hand-written data
migration and a generated schema migration are indistinguishable to the runner. The ticket's
*intent* here is sound and Drizzle already delivers it.

### 1b. Is the ordering key an ISO8601 timestamp, and can it be?

**VERDICT: CONTRADICTED.** The acceptance criterion as written cannot be satisfied by a Drizzle
project. The ordering key that actually governs execution is an **integer**, and nothing in
Drizzle Kit can make it a string.

Three findings, in increasing order of severity.

**(i) The default filename prefix is a sequential index, not a timestamp.** From Drizzle's own
release notes for v0.32.0 (via context7, 2026-09-10):

> "Users can now customize migration file prefixes to ensure compatibility with various migration
> tools. Available options include index (default), supabase and timestamp (which use full
> timestamps), unix (which uses unix seconds), or none to omit the prefix entirely."

So out of the box you get `0000_name.sql`, `0001_name.sql`. Getting a timestamp at all requires
opting in:

```ts
export default defineConfig({ migrations: { prefix: "timestamp" } })
```

That part is fine — the ticket can simply mandate that config line.

**(ii) The `timestamp` prefix is not ISO 8601.** Verified by generating one on 2026-09-10:

```
[✓] Your SQL migration file ➜ drizzle/20260910102311_initial.sql
```

`20260910102311` is `YYYYMMDDHHMMSS`. ISO 8601 requires either the extended form
(`2026-09-10T10:23:11Z`) or, in basic form, a `T` date/time separator and a zone designator
(`20260910T102311Z`). Drizzle's prefix has no separator, no `T`, and no zone. It is a
*sortable compact datetime*, which is what the ticket actually wants, but calling it ISO8601 in
an acceptance criterion sets up a check that fails on a technicality.

**(iii) The prefix is cosmetic. The real ordering key is a Unix-millisecond integer.** This is
the finding that contradicts the criterion outright.

`drizzle-orm@0.45.2`, `node_modules/drizzle-orm/migrator.js`, read on 2026-09-10:

```js
const journal = JSON.parse(journalAsString);
for (const journalEntry of journal.entries) {
  ...
  migrationQueries.push({
    sql: result,
    bps: journalEntry.breakpoints,
    folderMillis: journalEntry.when,
    hash: crypto.createHash("sha256").update(query).digest("hex")
  });
}
```

The runner never looks at the filename prefix for ordering. It reads `meta/_journal.json` and uses
`journalEntry.when`. The journal generated in the test above:

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    { "idx": 0, "version": "7", "when": 1789035791691, "tag": "20260910102311_initial",           "breakpoints": true },
    { "idx": 1, "version": "7", "when": 1789035869271, "tag": "20260910102429_seed_owner_source", "breakpoints": true }
  ]
}
```

`when` is Unix epoch **milliseconds as a JSON number**. It is then stored in Postgres as
`created_at bigint` (see Section 3). The ordering key is an integer at every layer: in the journal,
in the comparison, and in the ledger table.

**What is actually true:** in a Drizzle project the ordering key is a Unix-millisecond integer
(`_journal.json` → `when` → `__drizzle_migrations.created_at bigint`). The *filename prefix* is
configurable and can be made a sortable compact datetime (`prefix: "timestamp"`), which is not
ISO 8601 and does not affect ordering.

**Recommended rewrite of the acceptance criterion:**

> - [ ] `drizzle.config.ts` sets `migrations: { prefix: "timestamp" }`, so migration filenames sort
>       chronologically and schema and data migrations interleave readably in one folder

That is testable, achievable, and captures the property the ticket is after. The current wording
is not.

### 1c. Can a hand-written migration interleave?

**VERDICT: CONTRADICTED, and this is the serious one.** No — and Drizzle does not merely refuse.
It **silently skips** the interleaved migration and reports success.

From `node_modules/drizzle-orm/pg-core/dialect.js`, `async migrate(...)`, read 2026-09-10:

```js
const dbMigrations = await session.all(
  sql`select id, hash, created_at from ${...}.${...} order by created_at desc limit 1`
);
const lastDbMigration = dbMigrations[0];
await session.transaction(async (tx) => {
  for await (const migration of migrations) {
    if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) {
      ...
    }
  }
});
```

`limit 1`. The runner reads **only the single most recent row** of the ledger and applies every
migration whose `when` is strictly greater than that one value. It is a high-water mark, not a
set-membership check. Any migration slotted in below the mark is skipped, forever, with no error.

Demonstrated on 2026-09-10. After the two migrations above were applied, a third was hand-inserted
into the journal with `when: 1789035800000` (between the two existing entries), containing
`CREATE TABLE interleaved_marker (id int);`:

```
$ npx drizzle-kit migrate
[✓] migrations applied successfully!

$ psql -d dz_interleave -c "select to_regclass('public.interleaved_marker');"
 to_regclass
-------------
             ← NULL. The table was never created.

$ psql -d dz_interleave -c 'select id, created_at from drizzle.__drizzle_migrations order by id;'
 id |  created_at
----+---------------
  1 | 1789035791691
  2 | 1789035869271     ← still two rows. The third was never recorded.
```

**And the same migration folder, run against an empty database, applies all three:**

```
$ psql -c "CREATE DATABASE dz_fresh;"
$ npx drizzle-kit migrate        # same folder, same journal, empty target
[✓] migrations applied successfully!

$ psql -d dz_fresh -c "select to_regclass('public.interleaved_marker');"
    to_regclass
--------------------
 interleaved_marker    ← created here

$ psql -d dz_fresh -c 'select count(*) from drizzle.__drizzle_migrations;'
 count
-------
     3
```

One migration folder, two databases, **two different schemas**, both reporting
`migrations applied successfully!`.

This has a direct consequence for CNCORE-4's own CI gate (Section 2): the gate as specified builds
from empty, so it lands in the `dz_fresh` column — it would have gone **green** on exactly the
mistake it exists to catch, while production silently diverged.

Contrast the tools the ADR compares itself to. Alembic, per
<https://alembic.sqlalchemy.org/en/latest/tutorial.html> (2026-09-10), orders by a `down_revision`
linked list rather than by timestamp, and the docs describe this as what makes interleaving safe:

> Revisions are ordered through a linked-list structure using the `down_revision` variable...
> This design theoretically allows "splicing" migration files between existing ones from different
> branches.

Django is the same shape — from <https://docs.djangoproject.com/en/stable/topics/migrations/>
(2026-09-10):

> "Don't worry - the numbers are just there for developers' reference, Django just cares that each
> migration has a different name. Migrations specify which other migrations they depend on...
> so it's possible to detect when there's two new migrations for the same app that aren't ordered."

A timestamp ordering key is precisely the design that Alembic and Django rejected, for precisely
this reason. Drizzle chose the timestamp, and pays for it with the silent-skip.

**What to do.** This is not a reason to abandon Drizzle, but the ticket must not claim a property
Drizzle does not have. Concretely:

1. Drop "interleave" from the model. Migrations in this project are **append-only at the head**.
   A new migration must always carry the largest `when` in the journal.
2. Add a CI check that enforces it: assert `_journal.json` entries are strictly increasing in
   `when` **and** that the largest `when` belongs to the last entry. This is a ten-line script and
   it is the only thing standing between a rebased branch and a silently-skipped migration.
3. `drizzle-kit check` is related but not sufficient. Per
   <https://orm.drizzle.team/docs/drizzle-kit-check> (2026-09-10) it "lets you check consistency of
   your generated SQL migrations history" and performs commutativity checks on branch merges. It
   validates the snapshot chain, not the monotonicity of `when` against an already-migrated
   database. Run it, but do not mistake it for this check.

---

## Section 2 — CNCORE-4: "CI builds the database from empty" as a standard gate

### The claim

CNCORE-4:

> CI building the database from EMPTY on every run as a gate rather than a report

> - [ ] CI builds the database from empty and applies every migration, and fails the build if it
>       cannot

ADR 0047: "CI runs empty-to-head every release, as a gate."

### What the five named tools actually offer

All checked 2026-09-10.

| Tool | Empty-to-head gate? | What it actually ships |
|---|---|---|
| **Drizzle Kit** | **No named command** | `drizzle-kit migrate` applies pending migrations to whatever DB you point it at. `drizzle-kit check` validates migration-history consistency/commutativity. Neither creates a database. Empty-to-head is `createdb` + `drizzle-kit migrate`, hand-rolled. |
| **Prisma** (v8) | **No** | `prisma migration check` verifies "files are intact and the graph is well-formed"; `prisma db migrate` applies. Docs are explicit that a shadow-database rehearsal is **"not built yet,"** recommending "rehearse with `--show` and a staging database." |
| **Alembic** | **No** | `alembic upgrade head` applies from wherever you are, including empty. `alembic check` is a *drift* check: it "will run through the same process as `alembic revision --autogenerate`... returns an error code plus a message if it is detected that new operations would be rendered," and the docs say it "can be worked into CI systems." That is model-vs-DB drift, not empty-to-head. |
| **Flyway** | **Closest of the five, and disclaimed** | `flyway clean` "Drops all objects in the configured schemas," carrying the explicit warning **"Do not use against your production DB!"** Paired with `flyway migrate` this is a genuine empty-to-head rebuild — but Redgate's own docs do **not** document `clean` + `migrate` as a CI gate. `flyway validate` "Validates the applied migrations against the available ones," failing on name/type/checksum differences. |
| **Rails** | **Explicitly recommends against it** | From <https://guides.rubyonrails.org/active_record_migrations.html> (2026-09-10): *"It tends to be faster and less error prone to create a new instance of your application's database by loading the schema file via `bin/rails db:schema:load` than it is to replay the entire migration history."* And: *"Old migrations may fail to apply correctly if those migrations use changing external dependencies or rely on application code which evolves separately from your migrations."* `bin/rails db:prepare` loads schema then runs pending migrations. |

### Verdict

**"A standard gate": CONTRADICTED.** Not one of the five ships an empty-to-head gate as a named,
documented command. Two ship *different* gates (drift for Alembic and Prisma, checksum validation
for Flyway). One — Rails, the most widely deployed migration system in the table — documents the
opposite recommendation in its own official guide, and gives the reason: replaying history from
empty is *more* error-prone, not less, because old migrations rot against code that has moved on.

**"A good idea for this project anyway": JUDGEMENT, and yes.** Rails' objection is about a decade
of accumulated migrations against evolving application code. CNCORE-4 lands **migration 1**. At one
rung the objection does not bite, and empty-to-head is cheap, fast and genuinely valuable. Keep the
gate. It is a defensible local choice, not an industry standard, and the ticket should say so.

**"As a gate rather than a report": CONFIRMED as achievable and trivial.** Any of `drizzle-kit
migrate` in a CI step with a non-zero exit, `alembic upgrade head`, or `flyway migrate` fails the
build on error by default. There is nothing to design here.

### The gap the gate does not close

Section 1c is the point. An empty-to-head gate validates the path *from empty*. Drizzle's runner
takes a **different code path** against a non-empty database — high-water mark instead of full
replay — and the two paths were empirically shown to produce different schemas from the same
folder, both reporting success.

So the gate as written verifies the one case that will never happen in production and does not
verify the one that always will. **The ticket needs a second gate**: apply the previous release's
migrations, then apply the branch's, and assert the resulting schema matches the empty-to-head
build. That is the check that catches an interleaved or non-monotonic `when` before it ships.

Cheap substitute, if the two-build comparison is too much for ticket 1: the monotonicity assertion
on `_journal.json` from Section 1c. It catches the same class of bug at a fraction of the cost.

---

## Section 3 — CNCORE-4: the version table

### The claim

ADR 0047 lists "A version table" among the rules that cannot be retrofitted. The brief asks whether
the pattern is universal across `alembic_version`, `flyway_schema_history`, `schema_migrations`,
`django_migrations`, `__EFMigrationsHistory` — and specifically what Drizzle's equivalent is.

### VERDICT: CONFIRMED. All six exist; here is Drizzle's.

| System | Table | Verified how, 2026-09-10 |
|---|---|---|
| Alembic | `alembic_version` | alembic.sqlalchemy.org tutorial: "Alembic creates a table called `alembic_version` to track the current database revision state." |
| Flyway | `flyway_schema_history` | documentation.red-gate.com: "The name of Flyway's schema history table can be customized using `table`. The default name is `flyway_schema_history`." It "tracks migration checksums and whether or not the migrations were successful," and is "exclusively for use by Flyway. It is a bad idea to edit or update it directly." |
| Rails | `schema_migrations` | guides.rubyonrails.org: "Rails keeps track of which migrations have been run through the `schema_migrations` table in the database." |
| Django | `django_migrations` | docs.djangoproject.com references "Django's migrations table" and the `migrate --prune` option for cleaning it. |
| EF Core | `__EFMigrationsHistory` | dotnet/EntityFramework.Docs `history-table.md`: "By default, EF Core keeps track of which migrations have been applied to the database by recording them in a table named `__EFMigrationsHistory`." Row per migration, keyed on `MigrationId`. |
| **Drizzle** | **`drizzle.__drizzle_migrations`** | See below. |

Drizzle's, read directly out of the shipped `drizzle-orm@0.45.2` source
(`node_modules/drizzle-orm/pg-core/dialect.js`) on 2026-09-10:

```js
const migrationsTable = config.migrationsTable ?? "__drizzle_migrations";
const migrationsSchema = config.migrationsSchema ?? "drizzle";
const migrationTableCreate = sql`
  CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )
`;
```

Confirmed live against the test database:

```
$ psql -d dz_fresh -c '\d drizzle.__drizzle_migrations'
 id         | integer | not null | nextval(...)
 hash       | text    | not null
 created_at | bigint
```

Both names are configurable, per the docs (context7, 2026-09-10):

```ts
migrations: {
  table: 'my-migrations-table', // `__drizzle_migrations` by default
  schema: 'my_schema',          // `drizzle` by default
}
```

So the version-table pattern is genuinely universal, Drizzle included, and the ADR's claim stands.
It is also the one rule in ADR 0047 that costs nothing to adopt: **Drizzle creates the table for
you on first `migrate`**. Nothing needs designing; the ticket only needs to not fight it.

### The nuance the ticket should know

Drizzle's table *looks* like a full ledger (one row per applied migration, with a content hash) but
is *used* as a watermark. Section 1c's `order by created_at desc limit 1` is the whole read. The
`hash` column is written and **never read back** — Drizzle does not verify that a previously
applied migration's SQL is unchanged.

That is a real gap against Flyway, which validates checksums (`flyway validate` fails "if there are
differences in migration names, types, or checksums"), and against Rails and Django, which consult
full set membership.

ADR 0047 says: "Once a released version has run migration N on someone's data, migration N is
frozen." Drizzle will not enforce that for you. If the project wants the freeze enforced rather
than merely intended, it needs a CI check comparing each migration file's SHA-256 to the `hash`
column — the data is already there, nothing reads it. Small, cheap, and worth adding to ticket 1
alongside the monotonicity check.

**Verdict on the freeze-enforcement gap: UNFOUNDED in the ticket** — CNCORE-4 asserts a version
table without saying what it is for beyond existing. What would settle it: a line in the ticket
saying whether the hash is checked, and by what.

---

## Section 4 — CNCORE-4: a column that projects a statement

### The claim

CNCORE-4:

> `title` and `sort_name` as COLUMNS THAT PROJECT STATEMENTS. The statement is the truth and
> carries source, rank, language and favourite; the column is a cached copy of whichever wins, so
> reads and sorts stay fast.

ADR 0014 the same, plus ADR 0012's consequence: "Production EAV always grows a denormalised read
side... Budget the projection as a first-class component."

### 4a. Is there prior art for a materialised projection column?

**VERDICT: CONFIRMED.** The pattern is old, named, and shipped in mainstream frameworks.

- **PostgreSQL generated columns** are the in-database form. Per
  <https://www.postgresql.org/docs/current/ddl-generated-columns.html> (2026-09-10):
  *"A stored generated column is computed when it is written (inserted or updated) and occupies
  storage as if it were a normal column... A stored generated column is similar to a materialized
  view (except that it is always updated automatically)."*
- **Rails `counter_cache`** is the framework form: a column on the parent holding a value derived
  from child rows, maintained automatically, existing purely so reads do not have to aggregate.
  guides.rubyonrails.org, 2026-09-10.
- **Trigger-maintained denormalisation** is the general form, with dedicated tooling
  (`sequel_postgresql_triggers`, the `denorm` package: *"Denorm is similar to PostgreSQL's REFRESH
  MATERIALIZED VIEW, except that it updates materialized table incrementally, and generates SQL DDL
  statements that create the necessary functions and triggers."*).
- ADR 0014 already carries the domain-specific prior art (Plex's three title columns, Jellyfin's
  four), verified in the 2026-09-10 ADR pass.

The design is not novel and does not need defending.

### 4b. What are the current options in Postgres — and which apply here?

This is where the ticket has a real problem.

**Generated column: RULED OUT. Verified empirically, not inferred.**

The PostgreSQL 18 docs list the restrictions:

> "The generation expression can only use immutable functions and cannot use subqueries or
> reference anything other than the current row in any way."

`title` projects the winning row of the **`statements` table**. That is, by definition, another
table, reached by a subquery. Tested on PostgreSQL 17.11 on 2026-09-10:

```sql
CREATE TABLE items_gen (
  id uuid PRIMARY KEY,
  title text GENERATED ALWAYS AS (
    (SELECT value FROM statements s
      WHERE s.item_id = id AND s.property='title'
      ORDER BY rank DESC LIMIT 1)
  ) STORED
);
```
```
ERROR:  cannot use subquery in column generation expression
LINE 3:   title text GENERATED ALWAYS AS ((SELECT value FROM stateme...
```

Postgres 18's new **VIRTUAL** generated columns do not help — same restriction, plus tighter ones
(no user-defined functions or types). Neither STORED nor VIRTUAL can express this.

**What is left:**

| Option | Verdict for this projection |
|---|---|
| Generated column (STORED or VIRTUAL) | **Impossible.** Cannot reference another table. Verified above. |
| **Trigger on `statements`** | Viable. Consistency enforced in-database, survives writes from anything (imports, `psql`, a future scanner). Cost: the projection logic lives in PL/pgSQL, outside the TypeScript codebase and outside Drizzle's schema — awkward against ADR 0053's "own the output" and awkward to test. Also serialises concurrent writes touching one item's title. |
| **Application-maintained** | Viable and probably right for migration 1. The projection is recomputed in the same transaction that writes the statement. Cost: any write path that bypasses the application silently rots the column — and CNCORE-4 explicitly says *"Seed one item by hand,"* which is exactly such a path. |
| Materialized view | Not a column. Requires `REFRESH`, so reads go stale. Does not meet "reads and sorts stay fast" without a refresh strategy nobody has specified. |

**VERDICT on 4b: CONTRADICTED as posed.** The ticket says "columns that project statements" as if
the mechanism were a detail. It is not: the obvious mechanism is unavailable, and the two that
remain have materially different failure modes. The ticket picks neither.

**What would settle it:** one line in CNCORE-4 naming the mechanism — trigger or application — and
one acceptance criterion that catches drift. Suggested:

> - [ ] A test writes a second, higher-ranked `title` statement and asserts the projected column
>       changes to match, without an explicit refresh call

That criterion is mechanism-agnostic, it is the actual property the design depends on, and it is
the one thing that fails loudly if the projection is ever wired up wrong. CNCORE-4's current
criterion — *"The title is stored as a statement and read from the projected column"* — passes
trivially on a hand-seeded row where both were written once and never diverge.

---

## Section 5 — CNCORE-5: RFC 3986 §3.4 and the non-identifying query parameter

### The claim

CNCORE-5:

> Addressing: the path is identity and the query carries the route. `/items/<id>` is canonical;
> `?via=<placement-id>` says which ordering the reader arrived through and is declared
> NON-IDENTIFYING, so two routes to one item give one page and one record.

ADR 0066:

> That declaration is a DEVIATION from RFC 3986, which says the query component "serves to identify
> a resource" alongside the path. We take the deviation knowingly.

### 5a. Does RFC 3986 §3.4 say what the ADR says it says?

**VERDICT: CONFIRMED, verbatim.** Fetched `https://www.rfc-editor.org/rfc/rfc3986.txt` with `curl`
on 2026-09-10 (141,811 bytes). Section 3.4, quoted exactly:

> 3.4.  Query
>
>    The query component contains non-hierarchical data that, along with
>    data in the path component (Section 3.3), serves to identify a
>    resource within the scope of the URI's scheme and naming authority
>    (if any).  The query component is indicated by the first question
>    mark ("?") character and terminated by a number sign ("#") character
>    or by the end of the URI.

Section 3.3 states the mirror image:

>    The path component contains data, usually organized in hierarchical
>    form, that, along with data in the non-hierarchical query component
>    (Section 3.4), serves to identify a resource within the scope of the
>    URI's scheme and naming authority (if any).

The ADR's quotation is accurate and its characterisation is fair. Path and query are named as
*jointly* identifying.

### 5b. Is declaring a query parameter non-identifying a recognised practice, or a deviation?

**VERDICT: CONTRADICTED — it is a recognised practice with a dedicated IETF RFC, and ADR 0066
overstates the deviation.**

Two things the ADR misses.

**(i) RFC 3986 itself scopes identity to the application.** Section 6.1, fetched verbatim
2026-09-10:

>    Because URIs exist to identify resources, presumably they should be
>    considered equivalent when they identify the same resource.  However,
>    this definition of equivalence is not of much practical use...
>    determination of equivalence or difference of URIs is based on string
>    comparison, perhaps augmented by reference to additional rules
>    provided by URI scheme definitions.  We use the terms "different" and
>    "equivalent" to describe the possible outcomes of such comparisons,
>    but there are many application-dependent versions of equivalence.

"There are many application-dependent versions of equivalence" is the RFC explicitly declining to
fix one. §3.4's "within the scope of the URI's scheme and naming authority" is doing the same work:
what the query means is the authority's business. An origin declaring `?via=` non-identifying is
operating inside that scope, not outside it.

**(ii) There is a standard mechanism for exactly this, and it names this exact case.**
**RFC 6596, "The Canonical Link Relation"** (Ohye & Kupke, April 2012, Informational), fetched
2026-09-10:

>    The canonical link relation specifies the preferred IRI from
>    resources with duplicative content.  Common implementations of the
>    canonical link relation are to specify the preferred version of an
>    IRI from duplicate pages created with the addition of IRI parameters
>    (e.g., session IDs)...

"Duplicate pages created with the addition of IRI parameters" is precisely `?via=`. RFC 6596 §3
sets the contract:

>    The target (canonical) IRI MUST identify content that is either
>    duplicative or a superset of the content at the context (referring)
>    IRI.
>    The target (canonical) IRI MAY:
>    o  Be self-referential (context IRI identical to target IRI).

CNCORE-5's design satisfies the MUST: `/items/<id>` and `/items/<id>?via=X` render the same item and
the same record, so the target is duplicative of the context. This is a textbook RFC 6596
application.

**What is actually true:** declaring a query parameter non-identifying is a well-established web
practice with an IETF RFC describing it and a `<link rel="canonical">` mechanism for expressing it.
It is not a deviation from RFC 3986 so much as an exercise of the latitude RFC 3986 §6.1 grants.

**JUDGEMENT on the ADR wording:** ADR 0066's "we take the deviation knowingly" is honourable and
does no harm, but it is a stronger self-indictment than the facts require, and it obscures that
there is a *standard way to declare the thing* which the project should be using. Softening it
would be an improvement; leaving it costs nothing except that the reader may not go looking for
RFC 6596.

### 5c. The gap this opens in CNCORE-5

**VERDICT: UNFOUNDED — the ticket declares a canonical URL and never emits one.**

CNCORE-5 says `/items/<id>` "is canonical" and that `?via=` "is declared NON-IDENTIFYING". Neither
the "What to build" section nor any of the seven acceptance criteria mentions a
`<link rel="canonical">` tag. A declaration that exists only in a Linear ticket is not a
declaration: no crawler, no cache, no link-sharing preview and no other consumer can observe it.

RFC 6596 §3 and Google's current guidance (Section 6) both say the mechanism is the link relation.
Next.js supplies it directly through the Metadata API (`alternates.canonical`), so the cost is one
line.

**What would settle it:** add to CNCORE-5:

> - [ ] Both `/items/<id>` and `/items/<id>?via=<placement-id>` emit
>       `<link rel="canonical" href="/items/<id>">`, and a test asserts it

That turns the ticket's central addressing claim from an assertion into something the test suite
can hold. Without it, "declared NON-IDENTIFYING" is a design note with no artefact.

---

## Section 6 — CNCORE-5: canonical URL practice for query parameters

### The claim

That `/items/<id>` should be canonical while `?via=` varies, and that this is normal practice.

### VERDICT: CONFIRMED. This is exactly what current search-engine guidance prescribes.

**Google, "Managing crawling of faceted navigation URLs"**
(<https://developers.google.com/crawling/docs/faceted-navigation>), the page's own stated
**last updated: 2025-12-18 UTC**, fetched 2026-09-10. This is Google's current home for
query-parameter guidance and it recommends `rel="canonical"` to point non-canonical parameterised
URLs at the preferred one, noting it "may, over time, decrease the crawl volume of non-canonical
versions of those URLs."

**Google, "How to specify a canonical with rel=canonical and other methods"**, fetched 2026-09-10:

> "Do include a `rel="canonical"` link on the canonical page itself (also known as a
> self-referential canonical)."

That matters for CNCORE-5's shape specifically: the bare `/items/<id>` should carry a
self-referential canonical, not just the `?via=` variants. RFC 6596 §3 independently permits it
("The target (canonical) IRI MAY... Be self-referential"). Emitting the same tag unconditionally
from the page is both simpler and correct.

One thing this run could **not** source to a verbatim quote: the widely repeated line that
parameter variations are deduplicated rather than penalised. Google's canonicalization pages
(fetched 2026-09-10) describe deduplication and canonical selection but do not state a
no-penalty rule in those words on the pages retrieved. Treat it as unverified. It does not change
the recommendation either way — the reason to emit a canonical here is correctness and cache
behaviour, not SEO.

### Three practical notes for the implementer

1. **Self-referential, unconditional.** Emit `<link rel="canonical" href="/items/<id>">` from the
   item page regardless of whether `?via=` is present. Simplest correct thing, and it matches both
   RFC 6596 and Google's stated best practice.
2. **Do not reach for `robots.txt`.** Google's faceted-nav page offers `disallow: /*?*products=`
   style rules for parameters that should not be crawled *at all*. That is the wrong tool here:
   `?via=` URLs are meant to be shareable and followable (ADR 0066: making "here, in story order"
   shareable is the whole point). Disallowing them would block the sharing the ADR set out to
   enable. Canonical, not robots.
3. **Parameter ordering** only becomes relevant once a second query parameter exists. Google:
   "ensure that the logical order of the filters always stays the same and that no duplicate
   filters can exist." With one parameter, nothing to do — worth a note against the day a second
   arrives.

---

## Section 7 — CNCORE-5: the unique constraint, and the nullable column beside it

### The claim

CNCORE-5:

> Unique on (container, item, position), because the same item at the same position twice is never
> a deliberate duplicate... Duplicates at DIFFERENT positions stay legal, since a recap at position
> 1 and the episode at position 5 is a real thing.

with `placements` carrying "a stable surrogate id, container, item, position, **nullable edition**,
rank". ADR 0017 states the same.

### The tests

All run 2026-09-10 against PostgreSQL 17.11, on a table shaped as the ticket describes:

```sql
CREATE TABLE placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL,
  item_id uuid NOT NULL,
  position integer NOT NULL,
  edition_id uuid,          -- nullable, per the ticket
  rank integer NOT NULL DEFAULT 0,
  CONSTRAINT placements_container_item_position_uq UNIQUE (container_id, item_id, position)
);
```

### 7a. The three behavioural claims

**VERDICT: CONFIRMED, all three, empirically.**

| Acceptance criterion | Test | Result |
|---|---|---|
| "The same item can appear twice in one container at different positions" | same container + item at positions 1 and 5 | `INSERT 0 2` — accepted |
| "Two different items can share a position in one container" | two item ids at position 1 | `INSERT 0 1` — accepted |
| "(container, item, position) is unique" | same triple twice | `ERROR: duplicate key value violates unique constraint "placements_container_item_position_uq"` |

The ticket's model does what it says. As the brief anticipated, this part is trivially true — but
it is now tested rather than assumed, and the third criterion is directly expressible as a test.

### 7b. The nullable-column gotcha — there are two, and they point opposite ways

The brief asked whether nullable `edition_id` on the same table causes a problem. **It does, but
not the one you would expect.**

**Gotcha 1 (live now): `edition_id` is NOT in the index, so editions cannot differ at one position.**

```sql
-- same (container, item, position), different edition
INSERT INTO placements (container_id, item_id, position, edition_id)
VALUES ('1111…','2222…', 1, '4444…');
```
```
ERROR:  duplicate key value violates unique constraint "placements_container_item_position_uq"
DETAIL:  Key (container_id, item_id, "position")=(1111…, 2222…, 1) already exists.
```

Because the constraint names only three columns, `edition_id` is irrelevant to it. **The theatrical
cut and the extended cut of one film cannot both sit at position 1 of one container.** Given ADR
0011 ("editions are one level"), ADR 0064 and ADR 0065 all treat editions as a real first-class
concept, this is a design decision the ticket makes silently, by omission, and does not
acknowledge.

**VERDICT: UNFOUNDED in the ticket.** CNCORE-5 gives `placements` a nullable `edition_id` and a
constraint that ignores it, and never says whether that combination is intended. What would settle
it: one sentence in CNCORE-5 stating either

- *"`edition_id` is deliberately outside the uniqueness key: a position in a container holds one
  item, and which edition opens is decided at read time (ADR 0065)"* — which reads as consistent
  with ADR 0065 and is probably the intent; or
- *"`edition_id` participates in uniqueness"* — in which case see Gotcha 2 immediately.

**Gotcha 2 (latent): if `edition_id` is ever added to the index, NULLs silently defeat it.**

Postgres, `<https://www.postgresql.org/docs/current/ddl-constraints.html>`, fetched 2026-09-10:

> "By default, two null values are not considered equal in this comparison. That means even in the
> presence of a unique constraint it is possible to store duplicate rows that contain a null value
> in at least one of the constrained columns. This behavior can be changed by adding the clause
> `NULLS NOT DISTINCT`... The default null treatment in unique constraints is
> implementation-defined according to the SQL standard, and other implementations have a different
> behavior. So be careful when developing applications that are intended to be portable."

Demonstrated:

```sql
CREATE TABLE p2 (container_id uuid, item_id uuid, position int, edition_id uuid,
  UNIQUE (container_id, item_id, position, edition_id));
INSERT INTO p2 VALUES ('1111…','2222…',1,NULL);   -- INSERT 0 1
INSERT INTO p2 VALUES ('1111…','2222…',1,NULL);   -- INSERT 0 1   ← accepted!
SELECT count(*) FROM p2;                          -- 2
```

Two byte-identical rows, under a unique constraint naming all four columns. And the fix, available
since PostgreSQL 15:

```sql
CREATE TABLE p3 (..., UNIQUE NULLS NOT DISTINCT (container_id, item_id, position, edition_id));
INSERT INTO p3 VALUES ('1111…','2222…',1,NULL);   -- INSERT 0 1
INSERT INTO p3 VALUES ('1111…','2222…',1,NULL);
-- ERROR: duplicate key value violates unique constraint "p3_..._key"
-- DETAIL: Key (container_id, item_id, "position", edition_id)=(1111…, 2222…, 1, null) already exists.
```

Since `edition_id` is nullable and *most* placements will have no edition, the default
`NULLS DISTINCT` would make the constraint a no-op for exactly the common case. This is a trap
laid for whoever later decides editions should participate in uniqueness.

**Drizzle note, checked 2026-09-10:** `drizzle-orm@0.45.2` supports this. From the installed
`node_modules/drizzle-orm/pg-core/unique-constraint.d.ts`:

```ts
nullsNotDistinct(): this;
readonly nullsNotDistinct: boolean;
constructor(table: PgTable, columns: PgColumn[], nullsNotDistinct: boolean, name?: string);
```

If ticket 5's answer to Gotcha 1 is ever "yes, include the edition", the
`nullsNotDistinct` flag is mandatory and is easy to forget because the constraint appears to work
in every test that happens to set an edition.

**Recommended acceptance criterion for CNCORE-5, either way:**

> - [ ] A test asserts that the same item at the same position in the same container is rejected
>       *whatever* `edition_id` holds, including null on both rows

That criterion is correct under either answer to Gotcha 1 and fails loudly if someone changes the
index without thinking about nulls.

---

## Section 8 — CNCORE-5: Next.js, `?via=`, and server rendering

### The claim

CNCORE-5 rests on `?via=<placement-id>` being read server-side, since the acceptance criteria
assert on rendered output:

> - [ ] `/items/<id>` and `/items/<id>?via=<placement-id>` render the same item and the same record

and CNCORE-4's:

> - [ ] A test asserts the page renders the title, at the app's HTTP seam

The brief asks: how are query parameters read in the App Router today, and does reading one opt the
page out of static rendering?

### VERDICT: CONFIRMED on both counts, quoted from the docs for the installed version.

Source: <https://nextjs.org/docs/app/api-reference/file-conventions/page>, fetched 2026-09-10, front
matter `version: 16.3.4`, `lastUpdated: 2026-06-09`.

**How it is read.** `searchParams` is a **Promise** prop on the page component and must be awaited:

> `searchParams` (optional)
> A promise that resolves to an object containing the search parameters of the current URL.

```tsx
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const filters = (await searchParams).filters
}
```

> * Since the `searchParams` prop is a promise. You must use `async/await` or React's `use`
>   function to access the values.
>   * In version 14 and earlier, `searchParams` was a synchronous prop. To help with backwards
>     compatibility, you can still access it synchronously in Next.js 15, but this behavior will be
>     deprecated in the future.

Version History confirms the change landed at `v15.0.0-RC`. On Next.js 16.3.4 the synchronous form
is gone; **`await searchParams` is the only way**. Any implementer writing from pre-15 memory will
write code that does not work.

> * `searchParams` is a plain JavaScript object, not a `URLSearchParams` instance.

Also worth knowing: Next.js 16 ships a global `PageProps` helper generated during `next dev` /
`next build` / `next typegen`:

```tsx
export default async function Page(props: PageProps<'/items/[id]'>) {
  const { id } = await props.params
  const { via } = await props.searchParams
}
```

**Does it opt out of static rendering? Yes, explicitly:**

> * `searchParams` is a **Request-time API** whose values cannot be known ahead of time. Using it
>   will opt the page into **dynamic rendering** at request time.
> * With **Cache Components**, where you access `searchParams` in the component tree determines how
>   much of the page can be prerendered. See "Maximizing the static shell".

### What this means for the tickets

**The good news — CNCORE-5's premise holds.** Reading `?via=` on the server is the documented,
first-class way to do this, and it guarantees the value is in the server-rendered HTML. Both
tickets' HTTP-seam assertions are sound: fetch the URL, assert on the response body. Nothing exotic
is required.

**The consequence the ticket does not mention.** Accepting `searchParams` in
`app/items/[id]/page.tsx` opts **the entire route** into dynamic rendering — including
`/items/<id>` with no query string at all. The plain canonical URL, the one CNCORE-5 declares
canonical and which will be the overwhelming majority of traffic, loses static prerendering as a
side effect of a parameter it does not carry.

**JUDGEMENT: acceptable for this ticket, worth one line.** At migration 1 with one hand-seeded item
this costs nothing, and premature optimisation would violate the repo's own "simplest
implementation that fully meets the current requirements". But it is a real property of the design
and the ticket should not be silent about it, because the escape hatches are known and cheap to
adopt later:

- Read `searchParams` **below a `<Suspense>` boundary**, in a child component, so the item content
  prerenders as a static shell and only the "arrived via" strip is deferred. This is exactly what
  the docs' "Maximizing the static shell" describes under Cache Components, which is the Next.js 16
  model.
- Or read `?via=` in a small Client Component with `useSearchParams()`, leaving the server page
  fully static — **but this breaks CNCORE-5's testability**, since the `?via=` behaviour would no
  longer appear in the server HTML the acceptance criterion asserts on.

Given the acceptance criterion asserts on rendered output, **the server-side read is the right
call** and the dynamic-rendering cost is the price of a testable ticket. That is a defensible
trade; it should just be a stated one.

**A verification note for whoever implements CNCORE-4's HTTP-seam test:** neither ticket says
whether "at the app's HTTP seam" means a real HTTP request against a running server or a rendered
React tree. On Next.js 16 those differ — a rendered tree will not exercise the
`searchParams`-promise resolution or the dynamic-rendering path at all. Assert against a real
response body.

---

## Section 9 — Tally, and what needs editing before these tickets are worked

### Counts

**23 claims tested. 13 CONFIRMED, 5 CONTRADICTED, 3 UNFOUNDED, 2 JUDGEMENT.**

| # | Claim | Verdict |
|---|---|---|
| 1 | Drizzle ORM current stable is 0.45.2 | CONFIRMED |
| 2 | Drizzle Kit current stable is 0.31.10 | CONFIRMED |
| 3 | PostgreSQL current stable is 18.6 (2026-08-13) | CONFIRMED |
| 4 | Next.js current stable is 16.3.4 | CONFIRMED |
| 5 | Schema and hand-written data migrations share one Drizzle sequence | CONFIRMED |
| 6 | The ordering key is an ISO8601 timestamp, not an integer | **CONTRADICTED** |
| 7 | A hand-written migration can interleave | **CONTRADICTED** |
| 8 | Empty-to-head in CI is a standard gate | **CONTRADICTED** |
| 9 | Empty-to-head is enforceable as a gate rather than a report | CONFIRMED |
| 10 | Empty-to-head is right for *this* project at migration 1 | JUDGEMENT (yes) |
| 11 | A version table is universal across the five named systems | CONFIRMED |
| 12 | Drizzle's equivalent is `drizzle.__drizzle_migrations` | CONFIRMED |
| 13 | What enforces ADR 0047's "migration N is frozen" | **UNFOUNDED** |
| 14 | Prior art exists for a materialised projection column | CONFIRMED |
| 15 | The projection can be a Postgres generated column | **CONTRADICTED** |
| 16 | RFC 3986 §3.4 says query jointly identifies the resource | CONFIRMED |
| 17 | Declaring a query param non-identifying is a deviation | **CONTRADICTED** |
| 18 | CNCORE-5 emits the canonical declaration it claims to make | **UNFOUNDED** |
| 19 | `rel=canonical` is current guidance for query-param variants | CONFIRMED |
| 20 | (container, item, position) unique behaves as described | CONFIRMED |
| 21 | Nullable `edition_id` beside that constraint is intended | **UNFOUNDED** |
| 22 | `searchParams` is awaited and opts the page into dynamic rendering | CONFIRMED |
| 23 | Server-side read is the right trade for a testable ticket | JUDGEMENT (yes) |

No decision in either ticket was falsified. Both models survive contact with the sources. What
failed is mechanism, wording, and three silent omissions.

### CNCORE-4 — needs editing before it is worked

1. **Replace the ISO8601 acceptance criterion.** As written it is unachievable: Drizzle's ordering
   key is a Unix-millisecond integer at every layer. Substitute the `prefix: "timestamp"` config
   criterion from Section 1b.
2. **Drop "interleave" and add the monotonicity check.** An interleaved migration is silently
   skipped against any non-empty database. Migrations are append-only at the head, and CI must
   assert `_journal.json` is strictly increasing in `when`.
3. **Add the second CI gate, or say why not.** The empty-to-head gate as specified would go green
   on exactly the divergence Section 1c demonstrates.
4. **Name the projection mechanism** (trigger or application) and add the drift-catching criterion
   from Section 4b. A generated column is not available.
5. Soften "a standard gate" — it is a good local choice, not industry practice, and Rails documents
   the opposite recommendation.

### CNCORE-5 — needs editing before it is worked

1. **Add the `rel="canonical"` criterion.** The ticket declares a canonical URL and never emits
   one. Self-referential, unconditional, one line via the Next.js Metadata API.
2. **Say what nullable `edition_id` means beside a constraint that ignores it.** Right now two
   editions of one item cannot share a position, silently and by omission.
3. **Strengthen the uniqueness criterion** to cover the null case, so nobody later adds
   `edition_id` to the index without `nullsNotDistinct`.
4. Note the dynamic-rendering consequence: reading `?via=` server-side opts the whole route out of
   static rendering, including the bare canonical URL. Acceptable here, but state it.
5. ADR 0066 only: its "DEVIATION from RFC 3986" framing overstates the case. RFC 6596 describes
   this exact practice, and RFC 3986 §6.1 grants the latitude.

### Verdict on readiness

Both tickets are labelled `ready-for-agent`. **Neither is, quite.** None of the fixes is large, and
none requires re-deciding anything — they are corrections to mechanism and three additions of
things the tickets assert but do not test. An hour of ticket editing. But CNCORE-4 item 1 in
particular would send an implementer chasing an acceptance criterion that cannot be satisfied, and
items 2 and 3 describe a failure that ships silently and is discovered in production.

---

## Appendix — every source consulted, 2026-09-10

**Primary specifications**
- RFC 3986, URI Generic Syntax — `curl https://www.rfc-editor.org/rfc/rfc3986.txt` (141,811 bytes).
  §3.3, §3.4, §6.1 quoted verbatim from the retrieved file.
- RFC 6596, The Canonical Link Relation (Informational, April 2012) —
  `curl https://www.rfc-editor.org/rfc/rfc6596.txt` (13,800 bytes). §1 and §3 quoted verbatim.

**PostgreSQL**
- <https://www.postgresql.org/> — 18.6 / 17.11 / 16.15 / 15.19 / 14.24 released 2026-08-13; 19 Beta 3.
- <https://www.postgresql.org/docs/current/ddl-constraints.html> — NULLS DISTINCT / NOT DISTINCT.
- <https://www.postgresql.org/docs/current/ddl-generated-columns.html> — generated-column restrictions.
- Local `PostgreSQL 17.11 (Homebrew)` — seven SQL tests in Sections 4 and 7.

**Drizzle**
- `npm view drizzle-orm version` → 0.45.2; `npm view drizzle-kit version` → 0.31.10.
- Installed source: `drizzle-orm/migrator.js`, `drizzle-orm/pg-core/dialect.js`.
- <https://orm.drizzle.team/docs/drizzle-kit-generate>, `/docs/kit-custom-migrations`,
  `/docs/drizzle-kit-migrate`, `/docs/drizzle-kit-check`.
- context7 `/websites/orm_drizzle_team` — prefix options, migrations table config.
- Live runs against Postgres databases `dz_interleave` and `dz_fresh`.

**Other migration systems**
- <https://alembic.sqlalchemy.org/en/latest/tutorial.html>, `/autogenerate.html`.
- <https://documentation.red-gate.com/flyway/> — schema history table, `validate`, `clean`.
- <https://guides.rubyonrails.org/active_record_migrations.html>, `/association_basics.html`.
- <https://docs.djangoproject.com/en/stable/topics/migrations/>.
- <https://www.prisma.io/docs/orm/migrations/applying-a-migration> (Prisma 8).
- dotnet/EntityFramework.Docs `entity-framework/core/managing-schemas/migrations/history-table.md`.

**Next.js**
- `npm view next version` → 16.3.4; `dist-tags.latest`.
- <https://nextjs.org/docs/app/api-reference/file-conventions/page> (version 16.3.4,
  lastUpdated 2026-06-09).

**Search-engine guidance**
- <https://developers.google.com/crawling/docs/faceted-navigation> (last updated 2025-12-18 UTC).
- <https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls>.
- <https://developers.google.com/search/docs/crawling-indexing/canonicalization>.
