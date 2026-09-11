# Verification: the migration-tooling claims in ADR 0047

Every claim in `docs/adr/0047-migrations-are-a-forward-only-ladder.md` about a database migration
tool — Alembic, Flyway, Rails Active Record, Django, EF Core, Drizzle ORM — put to the source that
owns it: the project's own documentation, or the project's own source tree.

Nothing here is confirmed from memory. Every CONFIRMED verdict carries a lookup performed during
this run, with the URL or repository path and the date read.

Verdicts used:

- **CONFIRMED** — the owner's own source says this, with the citation given.
- **CONTRADICTED** — the owner's own source says something materially different.
- **UNFOUNDED** — no source was found in this run that supports it.
- **JUDGEMENT** — a characterisation or an inference, not a checkable fact.

Run date: 2026-09-10.

Section 9 at the end is the summary, plus the claims that fuse a documented fact with an
undocumented inference about motive.

---

## 1. The five version-table names

> **ADR 0047:** "There is no disagreement anywhere in the industry: Alembic has `alembic_version`,
> Flyway `flyway_schema_history`, Rails `schema_migrations`, Django `django_migrations`, EF Core
> `__EFMigrationsHistory`."

**CONFIRMED** on all five names. Two qualifications the sentence "no disagreement anywhere in the
industry" papers over: Flyway's name is the result of a rename in Flyway 5.0, and three of the five
are configurable defaults rather than fixed names.

### 1.1 Alembic — `alembic_version` — CONFIRMED

<https://alembic.sqlalchemy.org/en/latest/tutorial.html>, Alembic 1.19.2 docs, read 2026-09-10:

> Alembic first checked if the database had a table called `alembic_version`, and if not, created it.

Configurable. <https://alembic.sqlalchemy.org/en/latest/api/runtime.html>, read 2026-09-10,
documents the `version_table` parameter of `EnvironmentContext.configure()`:

> The name of the Alembic version table. The default is `'alembic_version'`.

### 1.2 Flyway — `flyway_schema_history` — CONFIRMED, but it is a renamed default

<https://documentation.red-gate.com/fd/flyway-table-setting-277579042.html>, read 2026-09-10.
Description of the `table` setting:

> The name of Flyway's schema history table.

Default, stated explicitly on that page:

> `"flyway_schema_history"`

Configurable, and the docs say so plainly at
<https://documentation.red-gate.com/fd/flyway-schema-history-table-273973417.html> (read
2026-09-10):

> The name of Flyway's schema history table can be customized using `table`.

**The rename.** The current default is not the original one. `flyway/flyway` issue #1848, "Change
default for flyway.table from schema_version to flyway_schema_history", records the change landing
in Flyway 5.0.0, with an automatic fallback to the old `schema_version` default plus a warning; the
fallback was removed in Flyway 6.0.0. (Searched 2026-09-10; the Redgate documentation tree carries
no mention of `schema_version` at all — a `path:documentation` search of `flyway/flyway` for
`schema_version` returns 0 hits, i.e. the old name has been fully scrubbed from current docs.)

This does not break the ADR's claim, but it does break the *framing*. "No disagreement anywhere in
the industry" is a stronger statement than the evidence supports: the industry leader renamed its
own table eight years ago and had to ship a compatibility fallback to do it. If anything this is an
argument FOR the ADR's position, not against it — but the ADR should not claim unanimity it does
not have.

### 1.3 Rails — `schema_migrations` — CONFIRMED

<https://guides.rubyonrails.org/active_record_migrations.html>, read 2026-09-10:

> Rails keeps track of which migrations have been run through the `schema_migrations` table in the
> database.

and

> When you run a migration, Rails inserts a row into the `schema_migrations` table with the version
> number of the migration, stored in the `version` column.

No documented option to rename it.

### 1.4 Django — `django_migrations` — CONFIRMED

The name does not appear on the migrations topic page. It is named in Django's own `migrate`
command reference, under the `--prune` option
(<https://docs.djangoproject.com/en/stable/ref/django-admin/>, read 2026-09-10):

> Deletes nonexistent migrations from the `django_migrations` table.

No documented option to rename it.

### 1.5 EF Core — `__EFMigrationsHistory` — CONFIRMED

<https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/history-table>, page last
updated 2024-09-26, read 2026-09-10:

> By default, EF Core keeps track of which migrations have been applied to the database by
> recording them in a table named `__EFMigrationsHistory`.

Configurable:

> You can change the schema and table name using the `MigrationsHistoryTable()` method in
> `OnConfiguring()` (or `ConfigureServices()` on ASP.NET Core).

with the warning:

> If you customize the Migrations history table *after* applying migrations, you are responsible for
> updating the existing table in the database.

### 1.6 Sixth data point, not in the ADR: Drizzle

For completeness, since the ADR builds on Drizzle: Drizzle's version table is
`drizzle.__drizzle_migrations`, also configurable. From
`drizzle-orm/src/pg-core/dialect.ts` on `drizzle-team/drizzle-orm@main`, read 2026-09-10:

```ts
const migrationsTable = typeof config === 'string'
    ? '__drizzle_migrations'
    : config.migrationsTable ?? '__drizzle_migrations';
const migrationsSchema = typeof config === 'string' ? 'drizzle' : config.migrationsSchema ?? 'drizzle';
```

So the industry pattern the ADR relies on holds across six tools, not five. **Note the columns**:
Drizzle's table is `(id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)` — it stores a
hash and a timestamp, and *does not store the migration's name or ordering key*. That is directly
relevant to section 7.

---

## 2. "A declared floor is Flyway's baseline: the oldest version we will migrate from"

> **ADR 0047:** "**The declared floor** is Flyway's baseline: the oldest version we will migrate
> from. Below it we refuse to start AND SAY WHICH VERSION TO UPGRADE TO FIRST."

**CONFIRMED** for the first sentence. The second sentence is CanonCore's own extension and Flyway
does not do it — see 2.3.

### 2.1 The definitive quote

`flyway/flyway`, `documentation/Reference/Commands/Baseline.md` on `main`, read 2026-09-10:

> ## Description
>
> Baselines an existing database, excluding all migrations up to and including baselineVersion.

That is exactly the "oldest version we will migrate from" reading: everything at or below
`baselineVersion` is excluded from ever being applied.

`flyway/flyway`, `documentation/Reference/Configuration/Flyway Namespace/Flyway Baseline Version
Setting.md` on `main`, read 2026-09-10:

> ## Description
>
> The version to tag an existing schema with when executing [baseline](Commands/baseline).
>
> ## Type
>
> String
>
> ## Default
>
> `"1"`

And <https://documentation.red-gate.com/fd/baselines-273973441.html>, read 2026-09-10:

> When starting to use Flyway for the first time against an existing database, the baseline state is
> the state before Flyway has first been run against it.

### 2.2 A terminology trap for the implementer

Flyway has **two** things called baseline and they are not the same:

1. **The `baseline` command and `baselineVersion` setting** — the floor. This is what the ADR means.
2. **Baseline migrations**, `B`-prefixed scripts, documented at
   <https://documentation.red-gate.com/fd/baseline-migrations-273973336.html> (read 2026-09-10): a
   single cumulative script that takes an empty database to a given version, so a new environment
   need not replay the whole history. Per that documentation, "any migrations with a version older
   than the latest baseline migration's version are not applied and are treated as being ignored."

Both produce a floor, by different means. If ADR 0047's floor is written by an implementer reading
Flyway docs, they will hit (2) first, because it is the more prominent concept in current Redgate
documentation. Worth naming which one the ADR means.

### 2.3 What Flyway does NOT do

The ADR's floor **refuses to start and names the version to upgrade to first**. Flyway's baseline
does neither: it silently *excludes* migrations below the floor and carries on. Nothing in the
baseline command reference, the `baselineVersion` setting reference, or the Baselines concept page
describes refusing to start against a too-old database, or emitting a "upgrade to version X first"
message. Flyway's nearest equivalent behaviour is `validate` failing on a checksum or a missing
migration, which is a different check.

So: the floor CONCEPT is Flyway's. The floor BEHAVIOUR the ADR specifies is CanonCore's own and is
strictly more than Flyway offers. That is fine — but it should not be presented as adopting a
proven pattern when half of it is new. **JUDGEMENT** on the second sentence.

---

## 3. Django's `--fake-initial`

> Claim under test: `--fake-initial` is the mechanism that stops an initial migration replaying on a
> database that already has the tables.

**CONFIRMED**, and the precise semantics matter, because `--fake-initial` and `--fake` are easy to
conflate and do very different things.

### 3.1 `--fake-initial` — the checked one

<https://docs.djangoproject.com/en/stable/ref/django-admin/>, `migrate --fake-initial`, read
2026-09-10:

> Allows Django to skip an app's initial migration if all database tables with the names of all
> models created by all `CreateModel` operations in that migration already exist. This option is
> intended for use when first running migrations against a database that preexisted the use of
> migrations. This option does not, however, check for matching database schema beyond matching
> table names and so is only safe to use if you are confident that your existing schema matches
> what is recorded in your initial migration.

<https://docs.djangoproject.com/en/stable/topics/migrations/>, read 2026-09-10, adds the column
case:

> When the `migrate --fake-initial` option is used, these initial migrations are treated specially.
> For an initial migration that creates one or more tables (`CreateModel` operation), Django checks
> that all of those tables already exist in the database and fake-applies the migration if so.
> Similarly, for an initial migration that adds one or more fields (`AddField` operation), Django
> checks that all of the respective columns already exist in the database and fake-applies the
> migration if so.

So, precisely:

- It applies **only to migrations marked initial**, not to any migration.
- It **probes the database** for the tables (and, for `AddField`, the columns) the migration would
  create.
- If they are all present it **records the migration as applied without running it**; if they are
  not, it runs normally.
- It matches on **names only**. Django says this outright: "does not, however, check for matching
  database schema beyond matching table names". A table of the right name with the wrong columns
  passes.

### 3.2 `--fake` — the unchecked one

Same page, read 2026-09-10:

> Marks the migrations up to the target one (following the rules above) as applied, but without
> actually running the SQL to change your database schema.
>
> This is intended for advanced users to manipulate the current migration state directly if they're
> manually applying changes; be warned that using `--fake` runs the risk of putting the migration
> state table into a state where manual recovery will be needed to make migrations run correctly.

`--fake` performs **no database probe at all**. It is an operator assertion. `--fake-initial` is a
conditional fake gated on a name check.

### 3.3 What this means for ADR 0047

The ADR pairs this with Jellyfin's `RunMigrationOnSetup` as prior art for "do not replay a repair
migration on a fresh or already-correct database". The two mechanisms are not the same shape and the
ADR should not treat them as interchangeable:

- Jellyfin's `RunMigrationOnSetup` is a **declaration on the migration** — the migration itself says
  whether it applies to a fresh install. No probe.
- Django's `--fake-initial` is an **operator flag at the call site** that triggers a **runtime probe
  of the live schema**. The migration says nothing.

A design that wants both properties needs both. Django's is the one that survives an operator who
forgets to pass a flag only in the sense that the default (`migrate` with no flag) is the SAFE
direction: without the flag Django just runs the migration and fails loudly on an existing table,
rather than silently skipping. That failure-loud default is the part worth copying.

---

## 4. Rails prefers `db:schema:load` over replaying history

> **ADR 0047:** "It is also a local choice rather than industry practice: Rails documents the
> opposite, preferring `db:schema:load` to replaying history."

**CONFIRMED.** Rails' own wording, from
<https://guides.rubyonrails.org/active_record_migrations.html>, read 2026-09-10:

> It tends to be faster and less error prone to create a new instance of your application's database
> by loading the schema file via `bin/rails db:schema:load` than it is to replay the entire migration
> history.

And Rails' stated reason:

> Old migrations may fail to apply correctly if those migrations use changing external dependencies
> or rely on application code which evolves separately from your migrations.

Note what Rails' reason IS and IS NOT. Rails is not arguing that empty-to-head is a weak test. It is
arguing that old migrations **rot**, because they reference application code and external
dependencies that have moved on since. That is a maintenance argument, not a correctness-of-coverage
argument.

ADR 0047's argument against relying on empty-to-head CI is a different one — that building from
empty applies every migration regardless of the high-water mark, so it cannot catch the spliced
migration divergence. Both arguments are sound and they are independent. The ADR is entitled to cite
Rails as evidence that replaying history is not universally regarded as the right way to build a
database; it is not entitled to cite Rails as agreeing with its *reason*. Rails gives a different
reason. **The citation is accurate; the implied agreement on motive is not documented.**

---

## 5. `down_revision` / dependency graphs in Alembic and Django

> **ADR 0047:** "Alembic and Django use a `down_revision` dependency graph precisely because the bare
> timestamp key cannot make a splice detectable, and that is the design they rejected."

Split into two: the mechanism, and the motive.

### 5.1 The mechanism exists in Alembic — CONFIRMED

<https://alembic.sqlalchemy.org/en/latest/branches.html>, Alembic 1.19.2 docs, read 2026-09-10:

> the upgrade process traverses through all of our migration files using a topological sorting
> algorithm, treating the list of migration files not as a linked list, but as a directed acyclic
> graph

and

> each "node" is a point that cannot be crossed until all of its dependencies are satisfied

The attribute is `down_revision`, present in every generated revision file and pointing at the
predecessor; `down_revision = None` marks the base. Alembic composes the ordering by reading every
file in `versions/` and linking them by `down_revision`, not by filename, date, or any positional
key.

### 5.2 The mechanism exists in Django — CONFIRMED, and it is called `dependencies`

Django's is **not** called `down_revision`. From
<https://docs.djangoproject.com/en/stable/topics/migrations/>, read 2026-09-10, describing the
`Migration` class:

> `dependencies`, a list of migrations this one depends on.

with the example:

```python
class Migration(migrations.Migration):
    dependencies = [("migrations", "0001_initial")]

    operations = [
        migrations.DeleteModel("Tribble"),
        migrations.AddField("Author", "rating", models.IntegerField(default=0)),
    ]
```

Two structural differences from Alembic worth an implementer's attention:

- Django's dependency is a **`(app_label, migration_name)` pair**, so it can point across apps. It is
  a cross-app dependency graph, not a single chain.
- A Django migration can declare **several** dependencies, and the graph is resolved globally across
  all installed apps. Alembic's `down_revision` is normally one predecessor (or a tuple, at a merge
  point).

So the ADR's shorthand "Alembic and Django use a `down_revision` dependency graph" is right in
substance and wrong in naming for half of it. Django's word is `dependencies`.

### 5.3 The motive — UNFOUNDED

> "precisely because the bare timestamp key cannot make a splice detectable, and that is the design
> they rejected"

**No source found in this run states this motive, for either project.**

What Alembic's own documentation gives as the reason for the DAG is **branching and merging**: the
ability to have several independent revision streams that later merge, which a linear key cannot
express. That is a collaboration-workflow reason, not a splice-detection reason. Searched
alembic.sqlalchemy.org (site-restricted, 2026-09-10) for any statement comparing the revision-id
design against timestamp ordering; nothing found. Django's documentation likewise explains
`dependencies` in terms of ordering and cross-app relationships, and nowhere frames it as a
rejection of a timestamp scheme.

Nor is "that is the design they rejected" supported. Django's migration **filenames** are
index-prefixed (`0001_initial`), and its ordering comes from the graph; there is no documented
record of either project having considered and rejected timestamp ordering.

**This is the clearest fact/motive fusion in the ADR.** The mechanism claim is solid and citable.
The "precisely because" is the ADR's own reasoning, and it is *good* reasoning — a predecessor
pointer does make a splice detectable, because a migration inserted into the middle would have to
claim a predecessor that another migration already claims, which the graph surfaces as a branch —
but it is CanonCore's argument, not Alembic's or Django's. It should be stated as CanonCore's.

---

## 6. No quarantine concept in Alembic, Flyway, Rails or Django

> **ADR 0047:** "A row that cannot be transformed is QUARANTINED AND COUNTED rather than aborting the
> migration. This is the one place we are ahead: Alembic, Flyway, Rails and Django have no quarantine
> concept."

**CONFIRMED** for the narrow reading — none of the four documents a facility for setting aside an
individual untransformable row, counting it, and completing the migration. **With one qualification
that weakens "the one place we are ahead"**: Flyway Teams has a statement-level continue-past-error
facility (6.4).

An absence is hard to prove, so here is exactly what was established and how.

### 6.1 The keyword probe

GitHub code search, run 2026-09-10, across each project's own documentation tree on its default
branch:

| Query | Hits |
| --- | --- |
| `quarantine repo:flyway/flyway path:documentation` | 0 |
| `quarantine repo:sqlalchemy/alembic path:docs` | 0 |
| `quarantine repo:django/django path:docs` | 0 |
| `quarantine repo:rails/rails path:guides` | 0 |

Independently, page-level checks confirmed the word is absent from
<https://docs.djangoproject.com/en/stable/topics/migrations/>,
<https://guides.rubyonrails.org/active_record_migrations.html>,
<https://alembic.sqlalchemy.org/en/latest/cookbook.html>,
<https://alembic.sqlalchemy.org/en/latest/api/runtime.html> and
<https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html> (all read
2026-09-10).

**Limit of this evidence:** "quarantine" is the ADR's own coinage. A zero-hit keyword search rules
out the word, not necessarily the idea under another name. The positive evidence in 6.2–6.3 is what
carries the verdict.

### 6.2 The positive evidence: all four are succeed-or-abort

**Flyway.** <https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html>,
read 2026-09-10:

> Flyway wraps the execution of each migration script in a single transaction and applies them in
> order.

and, on failure:

> failed migrations will always be rolled back (unless they were marked as non-transactional)

and, where the database lacks clean DDL transaction support, Flyway

> won't be able to perform a clean rollback in case of failure and will instead mark the migration as
> failed, indicating that some manual cleanup may be required. You may also need to run repair to
> remove the failed migration entry from the schema history table.

Two outcomes only: rolled back, or marked failed and blocking until repaired. There is no third
outcome in which the migration completes with some rows set aside.

**Django.** <https://docs.djangoproject.com/en/stable/topics/migrations/>, read 2026-09-10:

> On databases that support DDL transactions (SQLite and PostgreSQL), all migration operations will
> run inside a single transaction by default. In contrast, if a database doesn't support DDL
> transactions (e.g. MySQL, Oracle) then all operations will run without a transaction.
>
> You can prevent a migration from running in a transaction by setting the `atomic` attribute to
> `False`.

The only knob is all-or-nothing versus no-transaction. Nothing partial.

**Rails.** <https://guides.rubyonrails.org/active_record_migrations.html>, read 2026-09-10:

> If the database does not support DDL transactions with statements that change the schema, then when
> a migration fails, the parts of it that have succeeded will not be rolled back. You will have to
> rollback the changes manually.

Again: rolled back, or half-applied and your problem. No quarantine.

**Alembic.** <https://alembic.sqlalchemy.org/en/latest/api/runtime.html>, read 2026-09-10, the
`transaction_per_migration` parameter:

> if True, nest each migration script in a transaction rather than the full series of migrations to
> run.

The only choice offered is the transaction's *granularity* — one per migration, or one for the whole
run. Not what happens to a row inside one.

### 6.3 Why this is not surprising

All four are **schema** migration tools. They apply DDL, where "a row that cannot be transformed" is
not a normal failure mode — a DDL statement either succeeds or fails for the whole table. The
row-level transform is Django's `RunPython` and Rails' data migrations, which are ordinary
application code inside the transaction: an exception there aborts like anything else. The absence
the ADR observes is real, but it is partly an absence of the *problem*, not a gap in the tools. A
media server migrating heterogeneous user data is in a different situation, which is the actual
argument for quarantine and is stronger than "four tools forgot to build it".

### 6.4 The qualification: Flyway `errorOverrides`

<https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-error-overrides-setting>,
read 2026-09-10:

> Rules for the built-in error handler that let you override specific SQL states and errors codes in
> order to force specific errors or warnings to be treated as debug messages, info messages, warnings
> or errors.

A `W` behavior modifier downgrades an error to a warning, letting the migration continue past it.
This is **Flyway Teams only** (the paid edition), and it is **statement-level and blanket**: it
suppresses a whole SQL error class for the run, and does not identify, count, or set aside the
specific rows affected. It is not quarantine. But it is a "keep going past a failure" concept in one
of the four tools, so "have no quarantine concept" is exactly right while "this is the one place we
are ahead" is a shade too clean. **JUDGEMENT** on the boast, CONFIRMED on the fact.

---

## 7. Drizzle applies migrations by high-water mark — the important one

> **ADR 0047:** "Drizzle applies migrations by HIGH-WATER MARK, not set membership: it reads
> `folderMillis` from the journal and selects `order by created_at desc limit 1`. A migration
> inserted below that mark is SILENTLY SKIPPED and the run reports success."

**CONFIRMED at source, exactly as stated, including the two literal details.** This is the
best-evidenced claim in the ADR.

### 7.1 `folderMillis` comes from the journal

`drizzle-team/drizzle-orm`, `drizzle-orm/src/migrator.ts` on `main`, read 2026-09-10:

```ts
export interface MigrationMeta {
	sql: string[];
	folderMillis: number;
	hash: string;
	bps: boolean;
}

export function readMigrationFiles(config: MigrationConfig): MigrationMeta[] {
	const migrationFolderTo = config.migrationsFolder;
	const migrationQueries: MigrationMeta[] = [];

	const journalPath = `${migrationFolderTo}/meta/_journal.json`;
	if (!fs.existsSync(journalPath)) {
		throw new Error(`Can't find meta/_journal.json file`);
	}

	const journalAsString = fs.readFileSync(`${migrationFolderTo}/meta/_journal.json`).toString();

	const journal = JSON.parse(journalAsString) as {
		entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
	};

	for (const journalEntry of journal.entries) {
		...
		migrationQueries.push({
			sql: result,
			bps: journalEntry.breakpoints,
			folderMillis: journalEntry.when,
			hash: crypto.createHash('sha256').update(query).digest('hex'),
		});
	}

	return migrationQueries;
}
```

`folderMillis` is `journalEntry.when`, read from `meta/_journal.json`. Confirmed.

### 7.2 The runner selects one row and compares against it

`drizzle-team/drizzle-orm`, `drizzle-orm/src/pg-core/dialect.ts` on `main`, read 2026-09-10:

```ts
const dbMigrations = await session.all<{ id: number; hash: string; created_at: string }>(
	sql`select id, hash, created_at from ${sql.identifier(migrationsSchema)}.${
		sql.identifier(migrationsTable)
	} order by created_at desc limit 1`,
);

const lastDbMigration = dbMigrations[0];
await session.transaction(async (tx) => {
	for await (const migration of migrations) {
		if (
			!lastDbMigration
			|| Number(lastDbMigration.created_at) < migration.folderMillis
		) {
			for (const stmt of migration.sql) {
				await tx.execute(sql.raw(stmt));
			}
			await tx.execute(
				sql`insert into ${sql.identifier(migrationsSchema)}.${
					sql.identifier(migrationsTable)
				} ("hash", "created_at") values(${migration.hash}, ${migration.folderMillis})`,
			);
		}
	}
});
```

Both literal details in the ADR are verbatim correct: `order by created_at desc limit 1`, and the
comparison `Number(lastDbMigration.created_at) < migration.folderMillis`.

The consequence the ADR draws follows directly from the code. The condition is a strict `<` against
**one** row — the maximum `created_at`. A migration whose `folderMillis` is less than or equal to
that maximum fails the condition, its `sql` is never executed, no row is inserted, no error is
raised, and the loop proceeds to the next migration. The function returns normally. There is no set
membership check: the `hash` column is written but never read back for comparison, and the `SELECT`
does not even retrieve the other rows. **Silently skipped, run reports success. Confirmed.**

A second consequence, not in the ADR and worth adding: because only the maximum is compared, this is
also insensitive to a migration being *edited* after it has been applied. The hash is stored and
never checked, so Drizzle cannot detect a changed migration either. Flyway's checksum validation
exists precisely for this and Drizzle has the column but not the check.

### 7.3 It is not just Postgres

The same pattern is in every dialect. `drizzle-orm/src/sqlite-core/dialect.ts` on `main`, read
2026-09-10:

```ts
const dbMigrations = await session.values<[number, string, string]>(
	sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`,
);

const lastDbMigration = dbMigrations[0] ?? undefined;

await session.transaction(async (tx) => {
	for (const migration of migrations) {
		if (
			!lastDbMigration
			|| Number(lastDbMigration[2])! < migration.folderMillis
		) {
```

A GitHub code search for `folderMillis repo:drizzle-team/drizzle-orm` (run 2026-09-10) returns 17
files, including `pg-core/dialect.ts`, `sqlite-core/dialect.ts`, `mysql-core/dialect.ts`,
`gel-core/dialect.ts`, `singlestore-core/dialect.ts`, plus the per-driver migrators for d1, libsql,
neon-http, xata-http, op-sqlite, expo-sqlite, durable-sqlite and the proxy drivers. The high-water
mark is the universal strategy in this codebase, not a Postgres quirk.

### 7.4 Versions

npm registry, queried 2026-09-10 (registry `modified` timestamp 2026-09-09T10:25:54Z for
drizzle-orm, 2026-09-09T10:28:46Z for drizzle-kit):

| Package | `latest` dist-tag | `rc` dist-tag | `beta` dist-tag |
| --- | --- | --- | --- |
| `drizzle-orm` | **0.45.2** | 1.0.0-rc.4 | 1.0.0-beta.22 |
| `drizzle-kit` | **0.31.10** | 1.0.0-rc.4 | 1.0.0-beta.22 |

`drizzle-orm/package.json` on `main` reads `"version": "0.45.3"`, i.e. main is one unreleased patch
ahead of the published `latest`.

**Caveat that matters for the ADR's lifetime.** Drizzle 1.0 is in release-candidate. On the `beta`
branch, `drizzle-orm/src/pg-core/dialect.ts` **has no `migrate()` method at all** (checked
2026-09-10) — the 1.0 line has moved migration execution out of the dialect. Branch names on the
repo include `runner-agnostic-migrators`, `update/migrator-strategy` and `migrator-init`, and there
is a published dist-tag `update/migrator-strategy`. So the migrator is actively being reworked for
1.0, and **everything verified in 7.1–7.3 is confirmed for the 0.x stable line only**. The ADR's
conclusion ("the runner does not make splicing safe") is correct today and should be re-checked when
the project moves to 1.0, because the mechanism may change. This does not weaken the ADR's decision
— "either never splice, or add the membership check the runner lacks" is the right response to a
runner whose guarantees are in flux, not just to one that is currently wrong.

### 7.5 The demonstration

The ADR says "Demonstrated against real Postgres: the same migration folder produced two different
schemas on two databases, both green." That demonstration is not re-run here and this verification
does not attest to it. It is, however, exactly what the code in 7.2 predicts, so the claim is
consistent with the source. **No independent verification of the experiment itself.**

---

## 8. Drizzle's timestamp prefix

> **ADR 0047:** "Drizzle's opt-in `migrations: { prefix: "timestamp" }` produces `20260910102311` —
> not ISO 8601, and the default `index` prefix must be changed deliberately."

**CONFIRMED on every part** — the config key, the accepted values, the default, and the produced
format. And the "deliberately" is, if anything, understated: see 8.4.

### 8.1 The config key and the default

`drizzle-team/drizzle-orm`, `drizzle-kit/src/cli/validations/common.ts` on `main`, read 2026-09-10:

```ts
export const prefixes = [
	'index',
	'timestamp',
	'supabase',
	'unix',
	'none',
] as const;
export const prefix = enum_(prefixes);
export type Prefix = (typeof prefixes)[number];

export const configMigrations = object({
	table: string().optional(),
	schema: string().optional(),
	prefix: prefix.optional().default('index'),
}).optional();
```

- The key is **`migrations.prefix`**, nested under the `migrations` object in `drizzle.config.ts` —
  exactly as the ADR writes it.
- Accepted values: **`index`, `timestamp`, `supabase`, `unix`, `none`**.
- Default: **`'index'`**, in the source, as a schema-level `.default('index')`.

Corroborated by Drizzle's own release notes for v0.32.0, in `drizzle-team/drizzle-orm-docs`,
`src/content/docs/latest-releases/drizzle-orm-v0320.mdx` (read via context7 library
`/drizzle-team/drizzle-orm-docs`, 2026-09-10):

> You can now customize migration file prefixes to make the format suitable for your migration tools:
>
> - `index` is the default type and will result in `0001_name.sql` file names;
> - `supabase` and `timestamp` are equal and will result in `20240627123900_name.sql` file names;
> - `unix` will result in unix seconds prefixes `1719481298_name.sql` file names;
> - `none` will omit the prefix completely;

with the config example:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  migrations: {
    prefix: 'supabase'
  }
});
```

### 8.2 The produced format

`drizzle-team/drizzle-orm`, `drizzle-kit/src/utils/words.ts` on `main`, read 2026-09-10:

```ts
export const prepareMigrationMetadata = (
	idx: number,
	prefixMode: Prefix,
	name?: string,
) => {
	const prefix = prefixMode === 'index'
		? idx.toFixed(0).padStart(4, '0')
		: prefixMode === 'timestamp' || prefixMode === 'supabase'
		? new Date()
			.toISOString()
			.replace('T', '')
			.replaceAll('-', '')
			.replaceAll(':', '')
			.slice(0, 14)
		: prefixMode === 'unix'
		? Math.floor(Date.now() / 1000)
		: '';

	const suffix = name || `${adjectives.random()}_${heroes.random()}`;
	const tag = `${prefix}_${suffix}`;
	return { prefix, suffix, tag };
};
```

Trace it: `new Date().toISOString()` gives `2026-09-10T10:23:11.123Z`. Strip the `T`, strip the
hyphens, strip the colons → `20260910102311.123Z`. Take the first 14 characters →
**`20260910102311`**. The ADR's example value is exactly what this code produces. CONFIRMED.

Two details an implementer needs that the ADR does not state:

- It is **UTC**, because it derives from `toISOString()`. Not local time.
- It is **one-second granularity**. Two migrations generated within the same second get the same
  prefix. `index` mode cannot collide; `timestamp` mode can.

### 8.3 "Not ISO 8601" — CONFIRMED, and the source proves it itself

The strongest evidence is the code above: it calls `.replace('T', '')`, explicitly deleting the ISO
8601 time designator. ISO 8601's combined date-and-time representation requires the `T` between the
date part and the time part — W3C's ISO 8601 profile
(<https://www.w3.org/TR/NOTE-datetime>) states the format as `YYYY-MM-DDThh:mm:ssTZD`, with the `T`
appearing literally to indicate the beginning of the time element, and RFC 3339 §5.6 defines
`date-time` as `full-date` followed by the `T` designator followed by `full-time` (both consulted
2026-09-10; ISO's own page at iso.org returned HTTP 403 to automated fetch, so the profile
specifications are cited in its place).

`20260910102311` has no `T`, no separators and no timezone designator. It is a bare 14-digit
`YYYYMMDDHHmmss` string. Not ISO 8601. CONFIRMED.

### 8.4 "Must be changed deliberately" — CONFIRMED, and worse than the ADR says

The default is `index` (8.1), so a project that says nothing gets `0001_`, `0002_` filenames. To get
timestamps you must set it. That is the ADR's point and it holds.

**Additional finding.** `migrations.prefix` is **not documented on Drizzle's current configuration
reference page**. Checked 2026-09-10:

- <https://orm.drizzle.team/docs/drizzle-config-file> documents `migrations` as
  `{ table: string, schema: string }` with default `{ table: "__drizzle_migrations", schema: "drizzle" }`
  and no `prefix` key.
- The docs source, `drizzle-team/drizzle-orm-docs`, `src/content/docs/drizzle-config-file.mdx` on
  `main`, likewise documents only `table` and `schema` under `migrations`.
- <https://orm.drizzle.team/docs/drizzle-kit-generate> documents CLI options `custom`, `name`,
  `ignore-conflicts` and config options `dialect`, `schema`, `driver`, `out`, `config`,
  `breakpoints` — no `prefix`.

The option is real and enforced in the config schema, but its only documentation is the v0.32.0
release-notes page. An implementer reading the configuration reference will not discover it. That
strengthens the ADR's instruction to set it deliberately, and is a reason to put the setting in the
repo's config file with a comment rather than relying on anyone finding it later.

### 8.5 The prefix is not the ordering key

Worth stating in the ADR, because it is easy to assume otherwise and it interacts with section 7:
**the runner never reads the filename prefix.** `readMigrationFiles` (7.1) takes ordering from
`journalEntry.when` in `meta/_journal.json` and uses `journalEntry.tag` only to locate the `.sql`
file. The prefix is a naming convention for humans and for other tools; `folderMillis` is the
ordering key that decides execution. Setting `prefix: "timestamp"` makes the filenames legible and
sortable but changes nothing about the high-water-mark behaviour in section 7.

---

## 9. Summary

### Counts

| Verdict | Claims |
| --- | --- |
| CONFIRMED | 7 |
| CONTRADICTED | 0 |
| UNFOUNDED | 1 (the motive in claim 5) |
| JUDGEMENT | 2 partial (the floor's behaviour in 2.3; "the one place we are ahead" in 6.4) |

### The one unfounded claim

| Claim | What was found | What would settle it |
| --- | --- | --- |
| Alembic and Django use a dependency graph "precisely because the bare timestamp key cannot make a splice detectable, and that is the design they rejected" | Both mechanisms verified to exist. Alembic's documented reason for the DAG is branching and merging. No statement in either project's docs compares the design against timestamp ordering or records rejecting it. | A design document, mailing-list post or issue from either project stating the motive. Absent that, the ADR should present the reasoning as CanonCore's own — which it is, and it is sound. |

### Claims fusing a documented fact with an undocumented inference about motive

1. **Claim 5, the `down_revision` motive.** "Alembic and Django use a `down_revision` dependency
   graph" — documented fact, verified. "precisely because the bare timestamp key cannot make a
   splice detectable, and that is the design they rejected" — undocumented inference about motive.
   The fusion is invisible in the current sentence because "precisely because" reads as if the
   projects said so. **Recommend rewording** to separate them, e.g. state the mechanism, then state
   that a predecessor pointer is what makes a splice detectable, as CanonCore's reason for wanting
   one.

2. **Claim 4, the Rails citation.** "Rails documents the opposite, preferring `db:schema:load` to
   replaying history" — documented fact, verified verbatim. The surrounding argument implies Rails
   shares the ADR's reason for distrusting replay. It does not: Rails' documented reason is that old
   migrations rot against evolving application code and external dependencies, not that empty-to-head
   fails to catch divergence. The citation is sound; the implied agreement on motive is not
   documented.

3. **Claim 2, the floor.** "The declared floor is Flyway's baseline" — documented fact, verified
   verbatim ("Baselines an existing database, excluding all migrations up to and including
   baselineVersion"). "Below it we refuse to start AND SAY WHICH VERSION TO UPGRADE TO FIRST" — not
   Flyway behaviour, and presented in a sentence that reads as describing Flyway's. The concept is
   borrowed; the behaviour is new. Worth marking as new so nobody looks for it in Flyway's docs.

Also noted, not a motive fusion but a framing overreach: **"There is no disagreement anywhere in the
industry"** (claim 1). All five names are right, but Flyway renamed its own table in 5.0 from
`schema_version` and shipped a deprecation fallback removed in 6.0, and three of the five names are
configurable defaults. The convergence is real; the unanimity is not.

### Confirmed, with sources

| Claim | Source |
| --- | --- |
| Alembic `alembic_version`, configurable via `version_table` | alembic.sqlalchemy.org tutorial + api/runtime, 1.19.2 docs, 2026-09-10 |
| Flyway `flyway_schema_history`, default of the `table` setting | documentation.red-gate.com Flyway Table Setting, 2026-09-10 |
| Rails `schema_migrations` | guides.rubyonrails.org Active Record Migrations, 2026-09-10 |
| Django `django_migrations` | docs.djangoproject.com django-admin `migrate --prune`, 2026-09-10 |
| EF Core `__EFMigrationsHistory`, customisable via `MigrationsHistoryTable()` | learn.microsoft.com EF Core history table, page updated 2024-09-26, read 2026-09-10 |
| Flyway baseline is the floor: migrations up to and including `baselineVersion` are excluded | `flyway/flyway` `documentation/Reference/Commands/Baseline.md`@main, 2026-09-10 |
| Django `--fake-initial` fake-applies an initial migration when the tables/columns already exist, matching on names only | docs.djangoproject.com django-admin + topics/migrations, 2026-09-10 |
| Django `--fake` marks applied with no database probe at all | docs.djangoproject.com django-admin, 2026-09-10 |
| Rails prefers `db:schema:load` to replaying migration history | guides.rubyonrails.org Active Record Migrations, 2026-09-10 |
| Alembic `down_revision`, topologically sorted DAG | alembic.sqlalchemy.org branches, 1.19.2 docs, 2026-09-10 |
| Django's equivalent is `dependencies`, a list of `(app_label, migration_name)` | docs.djangoproject.com topics/migrations, 2026-09-10 |
| All four of Flyway, Django, Rails, Alembic are succeed-or-abort; no row quarantine | four projects' own docs + 0-hit keyword probe across four docs trees, 2026-09-10 |
| Drizzle reads `folderMillis` from `meta/_journal.json` (`journalEntry.when`) | `drizzle-orm/src/migrator.ts`@main, 2026-09-10 |
| Drizzle selects `order by created_at desc limit 1` and applies only where `created_at < folderMillis` | `drizzle-orm/src/pg-core/dialect.ts`@main and `sqlite-core/dialect.ts`@main, 2026-09-10 |
| Same high-water-mark strategy across all Drizzle dialects and driver migrators | 17-file `folderMillis` search across the repo, 2026-09-10 |
| drizzle-orm `latest` 0.45.2 (main 0.45.3), drizzle-kit `latest` 0.31.10; 1.0.0-rc.4 in RC | npm registry, 2026-09-10 |
| Drizzle config key is `migrations.prefix`, values `index`/`timestamp`/`supabase`/`unix`/`none`, default `index` | `drizzle-kit/src/cli/validations/common.ts`@main + drizzle-orm-docs v0.32.0 release notes, 2026-09-10 |
| `timestamp` prefix produces a bare 14-digit UTC `YYYYMMDDHHmmss` such as `20260910102311`, with the ISO `T` explicitly stripped | `drizzle-kit/src/utils/words.ts`@main, 2026-09-10 |
| That value is not ISO 8601 (no `T` designator between date and time) | W3C NOTE-datetime; RFC 3339 §5.6, 2026-09-10 |

### Findings the ADR does not yet carry, and should

1. **Drizzle stores a `hash` and never reads it back.** The version table is
   `(id, hash, created_at)`, the `SELECT` retrieves only the newest row, and the hash is never
   compared. So Drizzle cannot detect an *edited* migration either, not just a spliced one. Flyway's
   checksum validation exists for exactly this. If CanonCore is adding a membership check, add the
   checksum check in the same pass — it is the same table read.
2. **Drizzle 1.0 is reworking the migrator.** `migrate()` is absent from the dialect on the `beta`
   branch; there are `runner-agnostic-migrators` and `update/migrator-strategy` branches and a
   published dist-tag for the latter. Section 7 is confirmed for the 0.x line. Re-check on the 1.0
   upgrade.
3. **`migrations.prefix` is undocumented in Drizzle's config reference**, appearing only in the
   v0.32.0 release notes. Set it in the config file with a comment; nobody will rediscover it.
4. **The filename prefix is not the ordering key.** `folderMillis` from the journal is. Changing the
   prefix changes nothing about execution order or the high-water mark.
5. **Flyway has two "baseline" concepts** — the `baseline` command / `baselineVersion` floor, and
   `B`-prefixed baseline migrations. Name which one the ADR means.
6. **Django's `--fake-initial` matches on table and column NAMES only** and Django says so in its own
   warning. Any CanonCore equivalent that probes the schema should decide, explicitly, whether it
   checks more than names.
7. **The quarantine argument is stronger on its own merits than as a comparison.** The four tools are
   schema migration tools where a row-level transform failure is not the normal failure mode. The
   real argument is that CanonCore migrates heterogeneous user data, which is a different problem,
   not that four mature projects overlooked something.
