import { env } from "@canoncore/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export { createItemByHand, type ItemByHand, ItemRefused, retitleItemByHand } from "./by-hand";
export { likePattern, searchCatalogue } from "./catalogue-search";
export {
  type ImportedContainer,
  type ImportedRecord,
  type ImportingProvider,
  importBrowsedContainer,
  importProvidedRecord,
  type ProvidedContainer,
  type ProvidedRecord,
} from "./import";
export {
  type AssertedPlacement,
  assertPlacement,
  type Writer,
} from "./placements";
export { type PurgedProvider, previewProviderPurge, purgeProvider } from "./purge";
export {
  type AttributionOwed,
  type Catalogue,
  type CatalogueEntry,
  type FoundItem,
  findAttributionOwed,
  findItem,
  findItemKinds,
  findItemsProvided,
  findPlacementsInContainer,
  findPlacementsOfItem,
  findStatementsOfItem,
  type ItemKind,
  type ItemRow,
  type PlacementInContainer,
  type PlacementOfItem,
  type PlacementsInContainer,
  readCatalogue,
  readWorks,
  type StatementOfItem,
} from "./queries";
export * from "./schema";
export {
  type DeclaredDevice,
  endSession,
  listSessions,
  type OwnerSession,
  SESSION_IDLE_LIMIT_SECONDS,
  SESSION_LIFETIME_SECONDS,
  seeSession,
  startSession,
  sweepSessions,
} from "./sessions";
export { worktreeDatabaseName } from "./worktree-database";

/**
 * A handle on one database. The connection string is an argument rather than a
 * read of the environment so that a test can point at its own database without
 * the package reaching around it.
 */
export function createDb(connectionString: string) {
  return drizzle(connectionString, { schema });
}

export type Database = ReturnType<typeof createDb>;

let instance: Database | undefined;

/**
 * The application's database, built once from the validated environment.
 * Memoised because a pool per caller is a pool per caller.
 */
export function getDb(): Database {
  instance ??= createDb(env.DATABASE_URL);
  return instance;
}

/**
 * The MIGRATION LADDER and its checks are deliberately NOT on this entry point.
 * They are build-time and CI concerns that reach for `node:fs` and Drizzle's
 * migrator, and re-exporting them here dragged all of it into the web app's
 * bundle -- which is how this was found. They live at `@canoncore/db/migrate`
 * and `@canoncore/db/ladder`.
 */
