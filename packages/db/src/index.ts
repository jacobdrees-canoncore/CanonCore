import { env } from "@canoncore/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export {
  annotateItemByHand,
  createItemByHand,
  type ItemByHand,
  ItemRefused,
  retitleItemByHand,
} from "./by-hand";
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
  movePlacementByHand,
  PlacementRefused,
  placeItemByHand,
  type Reorder,
  removePlacementByHand,
  restorePlacementByHand,
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
  findNoteOfItem,
  findPlacementsInContainer,
  findPlacementsOfItem,
  findStatementsOfItem,
  type ItemKind,
  type ItemRow,
  type NoteOfItem,
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
export {
  type ProviderSettings,
  readProviderSettings,
  writeProviderSettings,
} from "./settings";
export {
  closeTaskRunsLeftOpen,
  compactTaskRuns,
  endTaskRun,
  RUN_HISTORY_DEPTH,
  readLatestTaskRuns,
  readTaskRuns,
  startTaskRun,
  type TaskOutcome,
  type TaskRun,
} from "./task-runs";
export { worktreeDatabaseName } from "./worktree-database";

/**
 * A handle on one database. The connection string is an argument rather than a
 * read of the environment so that a test can point at its own database without
 * the package reaching around it.
 *
 * `maxConnections` BOUNDS THE POOL, and it exists because one PostgreSQL serves
 * far more processes here than a deployment's does. node-postgres opens up to
 * TEN connections per pool, so a page-seam run -- ten servers, each with a
 * pool, plus the harness's own handles against the same container -- can ask
 * for more than the server will give and fails with `sorry, too many clients
 * already` (measured on this repo, 2026-09-12, adding the ninth instance). The
 * app leaves it at the default: it is one process, and ten is the number that
 * process was already using.
 *
 * AND THE CEILING IT IS MEASURED AGAINST IS NO LONGER POSTGRES'S DEFAULT
 * HUNDRED. The tenth instance (CNCORE-131) put one suite's peak AT that budget
 * on its own, which left nothing for the second worktree ADR-0104 expects to be
 * sharing the container -- so `docker-compose.yml` raises it to 300 and says
 * why. This bound still matters and for the reason above: it is what keeps a
 * harness handle from holding ten idle connections the servers under test
 * cannot have.
 */
export function createDb(connectionString: string, { maxConnections }: DbOptions = {}) {
  return drizzle({
    connection: { connectionString, max: maxConnections },
    schema,
  });
}

export interface DbOptions {
  /** How many connections this handle may hold open. Defaults to node-postgres's ten. */
  maxConnections?: number;
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
