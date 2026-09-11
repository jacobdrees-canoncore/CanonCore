/**
 * Applies the ladder shipped in the image to DATABASE_URL.
 *
 *   node /app/migrator/migrate.mjs <migrations folder>
 *
 * The FOLDER IS REQUIRED rather than defaulted, which is the point of this file.
 * `migrateToHead` takes it as a parameter (ADR-0047) and falls back to a path
 * resolved from `import.meta.url` -- correct in the repository, meaningless once
 * the ladder is copied somewhere else, and silently wrong rather than loud. A
 * missing argument fails here instead.
 *
 * `migrate.ts` is the repository's own, copied in beside this file so the image
 * runs the same function the migration ladder's CI job runs rather than a second
 * implementation of it.
 */
import { migrateToHead } from "./migrate.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const folder = process.argv[2];
if (!folder) {
  console.error("usage: node migrate.mjs <migrations folder>");
  process.exit(1);
}

await migrateToHead(connectionString, folder);
console.log(`applied every rung in ${folder}`);
