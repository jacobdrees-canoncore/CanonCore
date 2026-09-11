import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({
  path: "../../apps/web/.env",
});

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  // ADR-0047. The default prefix is `index` (`0000_`), which numbers rungs
  // sequentially and so cannot interleave a hand-written data migration with a
  // generated schema one. `timestamp` gives `20260910102311_name.sql`.
  //
  // Know what this does NOT do. The runner never reads the filename: it orders
  // by `when` in `meta/_journal.json`, a Unix-millisecond integer, and applies
  // by high-water mark. The prefix is what makes the folder readable in the
  // order it executes; `scripts/check-ladder.ts` is what makes that order safe.
  migrations: {
    prefix: "timestamp",
  },
});
