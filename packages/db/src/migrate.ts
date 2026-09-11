import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

/** Where the ladder's rungs live. Resolved off this file so it survives a cwd. */
export const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

/**
 * Applies every rung the target database has not seen. `head` is the only
 * target (ADR-0047): there is no partial upgrade and no down migration.
 *
 * The folder is a parameter so CI can apply the BASE BRANCH's ladder to a
 * database and then this branch's on top of it -- which is the upgrade path a
 * real installation takes, and the one an empty-to-head gate cannot see.
 */
export async function migrateToHead(
  connectionString: string,
  folder: string = migrationsFolder,
): Promise<void> {
  const db = drizzle(connectionString);
  try {
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await db.$client.end();
  }
}
