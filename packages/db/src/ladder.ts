import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The two checks Drizzle's migrator does not perform, and the reasons it does
 * not (ADR-0047).
 *
 * ORDERING. The runner reads `when` from `meta/_journal.json` and applies
 * everything above a HIGH-WATER MARK: `order by created_at desc limit 1`. That
 * is not set membership. A rung inserted below the mark is silently skipped and
 * the run prints `[✓] migrations applied successfully!`. Alembic and Django
 * carry dependency graphs, which would make a splice detectable; Drizzle chose
 * a bare timestamp, so the one-sequence property buys ordering rather than
 * safety. Either never splice, or check. This checks.
 *
 * FREEZING. Drizzle stores a SHA-256 per rung in its ledger and NEVER READS IT
 * BACK, unlike Flyway's `validate`. Once a released version has run migration N
 * on someone's data, migration N is frozen -- and nothing was enforcing that.
 *
 * NEITHER IS COVERED BY THE EMPTY-TO-HEAD CI GATE. Building from empty applies
 * every rung regardless of the mark, so the gate goes green on exactly the
 * divergence described above. It proves the ladder composes from nothing; it
 * says nothing about what an existing database will do.
 */

export interface JournalEntry {
  /** Unix milliseconds. THE ordering key -- the filename prefix is cosmetic. */
  when: number;
  /** The migration's filename, without `.sql`. */
  tag: string;
}

/**
 * Reads and VALIDATES the journal. Validated rather than cast, because this
 * module is a safety check: a malformed journal has to produce a sentence
 * saying so, not a `TypeError` from somewhere further down that reads as a bug
 * in the checker.
 *
 * `tag` is constrained because it becomes a FILESYSTEM PATH below. Drizzle
 * generates it and it is committed, so nothing hostile is expected -- but a
 * value that becomes a path is worth pinning to the shape it is supposed to
 * have, not the shape it happens to have.
 */
export async function readJournal(folder: string): Promise<JournalEntry[]> {
  const path = join(folder, "meta", "_journal.json");
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  const entries = (parsed as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) {
    throw new Error(`${path} has no "entries" array; it is not a Drizzle journal.`);
  }
  return entries.map((entry, index) => {
    const { when, tag } = (entry ?? {}) as { when?: unknown; tag?: unknown };
    if (typeof when !== "number" || !Number.isFinite(when)) {
      throw new Error(`${path} entry ${index} has no numeric "when"; ordering is undecidable.`);
    }
    if (typeof tag !== "string" || !/^[A-Za-z0-9._-]+$/.test(tag)) {
      throw new Error(
        `${path} entry ${index} has a "tag" that is not a plain migration filename: ${String(tag)}`,
      );
    }
    return { when, tag };
  });
}

/**
 * Migrations are APPEND-ONLY AT THE HEAD: a new rung always carries the largest
 * `when` in the journal. Needs no database, so it is the cheap check to run
 * first and on every branch.
 */
export function checkJournalIsAppendOnly(entries: JournalEntry[]): string[] {
  const problems: string[] = [];
  let highWaterMark = Number.NEGATIVE_INFINITY;
  let highWaterTag = "";
  const seenTags = new Set<string>();

  for (const entry of entries) {
    if (seenTags.has(entry.tag)) {
      // Two entries naming ONE file. The `timestamp` prefix is UTC at
      // one-second granularity, so two rungs generated inside one second get
      // the same filename and the second overwrites the first on disk, leaving
      // the journal pointing twice at whatever survived.
      problems.push(
        `${entry.tag} appears twice in the journal, so two rungs name one file. ` +
          `The timestamp prefix is UTC at one-second granularity, which is how this happens. ` +
          `Regenerate the later one.`,
      );
    }
    seenTags.add(entry.tag);

    if (entry.when === highWaterMark) {
      problems.push(
        `${entry.tag} and ${highWaterTag} carry the same ordering key (${entry.when}), ` +
          `so which runs first is undecidable. Regenerate one of them.`,
      );
    } else if (entry.when < highWaterMark) {
      problems.push(
        `${entry.tag} (${entry.when}) sits below ${highWaterTag} (${highWaterMark}) in the ladder. ` +
          `Drizzle applies by high-water mark, so an existing database will SKIP it silently ` +
          `while a fresh one applies it -- two schemas from one folder, both reporting success. ` +
          `Regenerate it at the head.`,
      );
    }
    if (entry.when > highWaterMark) {
      highWaterMark = entry.when;
      highWaterTag = entry.tag;
    }
  }

  return problems;
}

export interface AppliedRung extends Record<string, unknown> {
  hash: string;
  /** Drizzle stores the journal's `when` here, as `bigint`. */
  created_at: string | number;
}

/**
 * Reads Drizzle's own ledger. A function rather than a `Database`, so this
 * module imports nothing but Node builtins -- which is what lets the CI script
 * run it under bare `node` with no loader and no dependency added for one file.
 */
export type ReadAppliedRungs = () => Promise<AppliedRung[]>;

/**
 * Compares every rung this database has ALREADY RUN against the file that is on
 * disk now. Uses Drizzle's own hash: SHA-256 over the whole file as a string,
 * which is what `readMigrationFiles` computes and what the ledger stores.
 */
export async function checkAppliedRungsAreFrozen(
  readApplied: ReadAppliedRungs,
  folder: string,
): Promise<string[]> {
  const problems: string[] = [];
  const applied = await readApplied();
  const entries = await readJournal(folder);
  const byWhen = new Map(entries.map((entry) => [entry.when, entry]));

  for (const row of applied) {
    const when = Number(row.created_at);
    const entry = byWhen.get(when);
    if (!entry) {
      problems.push(
        `this database has run a migration timed ${when} that is no longer in the ladder. ` +
          `A rung cannot be withdrawn once a released version has applied it.`,
      );
      continue;
    }
    const onDisk = createHash("sha256")
      .update(await readFile(join(folder, `${entry.tag}.sql`), "utf8"))
      .digest("hex");
    if (onDisk !== row.hash) {
      problems.push(
        `${entry.tag} has changed since this database applied it ` +
          `(ledger ${row.hash.slice(0, 12)}, on disk ${onDisk.slice(0, 12)}). ` +
          `If the rung has SHIPPED it is frozen, and the fix is a new rung. ` +
          `If it has not, the fix is to rebuild this database from empty -- ` +
          `the rung is free to change right up until a release runs it on ` +
          `someone's data, and this check cannot tell the two apart.`,
      );
    }
  }

  return problems;
}
