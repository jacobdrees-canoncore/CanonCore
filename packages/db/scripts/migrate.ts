/**
 * Applies a ladder to DATABASE_URL.
 *
 *   node scripts/migrate.ts [folder]
 *
 * `pnpm db:migrate` runs drizzle-kit and is the ordinary path. This exists for
 * the one thing drizzle-kit cannot do: apply a ladder that is not the one in
 * `drizzle.config.ts`. CI uses it to migrate a database with the BASE BRANCH's
 * rungs before putting this branch's on top, which is the upgrade path a real
 * installation takes and the one an empty-to-head gate cannot see.
 */
import "../src/load-env.ts";
import { migrateToHead, migrationsFolder } from "../src/migrate.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const folder = process.argv[2] ?? migrationsFolder;
await migrateToHead(connectionString, folder);
console.log(`applied every rung in ${folder}`);
