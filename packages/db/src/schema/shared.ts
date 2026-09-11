import { sql } from "drizzle-orm";
import { bigint, pgSequence, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * ONE sequence for the whole catalogue (ADR-0075). Every row on every table
 * takes its number from here, which is what makes ADR-0040's merge stamp
 * findable ACROSS tables in the order the merge touched them. A per-table
 * sequence would order each table's rows and nothing else.
 *
 * Retrofitting this is the thing that cannot be done: every row written before
 * it would be indistinguishable from every other, so a reversal query could not
 * see the history it was not present for.
 */
export const changeSequence = pgSequence("change_sequence");

/**
 * Timestamps and a tombstone, on every table (ADR-0075), plus the change
 * sequence. `updated_at` and `change_sequence` are advanced by a trigger rather
 * than by whoever writes the row, because a write that forgets is exactly the
 * write a reversal needs to find.
 */
export const lifecycleColumns = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  changeSequence: bigint("change_sequence", { mode: "number" })
    .notNull()
    .default(sql`nextval('change_sequence')`),
});

/** The owner every row belongs to (ADR-0044). Nothing reads it yet, by design. */
export const ownerColumn = () => uuid("owner_id").notNull();

export const idColumn = () => uuid("id").primaryKey().defaultRandom();
