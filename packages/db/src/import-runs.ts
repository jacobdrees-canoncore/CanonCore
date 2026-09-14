import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";

import type { Database } from "./index";
import { theOwnerId } from "./placements";
import { importRunContainers, importRuns } from "./schema";

/** How one Container of a run went. `pending` until it has been asked for. */
export type ContainerOutcome = "pending" | "landed" | "refused";

/**
 * Why one Container refused, in ADR-0123's two fields.
 *
 * DECLARED HERE RATHER THAN IMPORTED FROM `@canoncore/providers`, for the reason
 * `ProvidedRecord` is not the CMPP shape: this package knows nothing about HTTP
 * and nothing about a Provider's wire format, and the caller does the
 * translation. The fields are ADR-0123's because that record decides what a
 * reason IS -- whose sentence it is, and the sentence -- rather than because
 * this is a copy of a type.
 */
export interface RefusalReason {
  /**
   * WHOSE SENTENCE THIS IS. `canoncore` is this app telling the Owner about
   * their own configuration or about an operation the Provider does not offer;
   * `provider` is a third party's text. A surface attributes the second and not
   * the first.
   */
  wrote: "canoncore" | "provider";
  text: string;
}

/**
 * One Container's place in a run, and what came of asking for it.
 *
 * A UNION RATHER THAN FOUR NULLABLE FIELDS, because the three outcomes carry
 * different things and a reader holding one should not have to ask whether the
 * counts are there. It is the same shape migration 18's two equivalence checks
 * hold in the database: a `landed` row has counts, a `refused` row has a reason,
 * and neither can have the other's.
 */
export type RunContainer = { externalId: string } & (
  | { outcome: "pending" }
  | { outcome: "landed"; placements: number; quarantinedValues: number }
  | { outcome: "refused"; reason: RefusalReason }
);

/** One walk over a list of Containers at one Provider (migration 18). */
export interface ImportRun {
  id: string;
  /** The Provider's base URL, which for a Provider IS its identity (ADR-0031). */
  providerIdentity: string;
  /** Every Container of the run, in the order the Owner listed them. */
  containers: RunContainer[];
}

/**
 * Opens a run over a list of Container ids at one Provider.
 *
 * THE LIST IS WRITTEN DOWN BEFORE ANYTHING IS ASKED FOR, which is what the run
 * is for. A walk that held its list in memory would have nothing to resume from:
 * the corpus is 465 Containers at 43.8s each, so the interruption is not the
 * exotic case but the ordinary one.
 */
export async function beginImportRun(
  db: Database,
  { providerIdentity, containerIds }: { providerIdentity: string; containerIds: string[] },
): Promise<ImportRun> {
  const resumable = await theRunStillWalkingThisList(db, { providerIdentity, containerIds });
  if (resumable !== undefined) {
    await askAgainForWhatHasNotLanded(db, resumable);
    return readImportRun(db, resumable);
  }

  const ownerId = await theOwnerId(db);
  const [run] = await db.insert(importRuns).values({ ownerId, providerIdentity }).returning();
  if (!run) throw new Error("opening an import run returned no row");

  await db.insert(importRunContainers).values(
    containerIds.map((externalId, listPosition) => ({
      ownerId,
      runId: run.id,
      externalId,
      listPosition,
    })),
  );

  return readImportRun(db, run.id);
}

/**
 * The run at this Provider that is still walking exactly this list, if there is
 * one.
 *
 * EXACTLY THIS LIST, IN THIS ORDER, which is what makes the Owner's own command
 * the whole identity of a run: they type the same thing again and it carries on,
 * they change what they are importing and it starts afresh. Matching on the
 * Provider alone would resume a walk over a DIFFERENT list of Containers and
 * report it as this one's progress.
 *
 * STILL WALKING MEANS SOMETHING HAS NOT LANDED, not that a walk was interrupted.
 * The two are the same question because of what a Credential does when it lapses
 * (ADR-0122): it does not stop a run, it makes every remaining Container refuse.
 * So a run whose tail refused is exactly as unfinished as one whose tail was
 * never reached, and the Owner renewing their Credential and re-running the same
 * list is the case this whole rung exists for.
 *
 * THE COST, SAID OUT LOUD: a Container that refuses every time -- an id that was
 * never a Container, a page since deleted -- keeps its run open, so handing over
 * the same list again resumes that run rather than importing the list afresh.
 * That is visible rather than silent, because what is answered says what is
 * still to do; and the way out falls out of the rule above rather than needing a
 * switch, since correcting the list makes it a different list and therefore a
 * new run.
 */
async function theRunStillWalkingThisList(
  db: Database,
  { providerIdentity, containerIds }: { providerIdentity: string; containerIds: string[] },
): Promise<string | undefined> {
  // An empty list has nothing to walk, so there is no run to resume and the
  // array literal below would have no elements to give Postgres a type from.
  if (containerIds.length === 0) return undefined;

  const theList = sql`array[${sql.join(
    containerIds.map((externalId) => sql`${externalId}`),
    sql`, `,
  )}]::text[]`;
  const { rows } = await db.execute<{ id: string }>(sql`
    select r."id" from ${importRuns} r
     where r."provider_identity" = ${providerIdentity}
       and r."deleted_at" is null
       and exists (
         select 1 from ${importRunContainers} c
          where c."run_id" = r."id" and c."deleted_at" is null and c."outcome" <> 'landed')
       and coalesce(
             (select array_agg(c."external_id" order by c."list_position")
                from ${importRunContainers} c
               where c."run_id" = r."id" and c."deleted_at" is null),
             '{}') = ${theList}
     order by r."created_at" desc
     limit 1`);
  return rows[0]?.id;
}

/**
 * Puts every Container of a resumed run that has not landed back to `pending`.
 *
 * ONE `begin` IS ONE ATTEMPT, and this is the line between them. Within an
 * attempt `pending` means "not asked for yet", which is what stops the walk
 * asking a second time for a Container that just refused and looping on it
 * forever; across attempts a refusal is not a verdict, so the Owner handing the
 * list over again asks for it afresh.
 *
 * THE PREVIOUS ATTEMPT'S REASON GOES WITH IT, because the row is about to be
 * asked again and a sentence from the last attempt standing beside a `pending`
 * outcome would be a reason for something that has not happened yet. What the
 * Owner reads as the run walks is the reason from the attempt they are watching.
 */
async function askAgainForWhatHasNotLanded(db: Database, runId: string): Promise<void> {
  await db
    .update(importRunContainers)
    .set({
      outcome: "pending",
      placements: null,
      quarantinedValues: null,
      reasonText: null,
      reasonWrote: null,
    })
    .where(
      and(
        eq(importRunContainers.runId, runId),
        ne(importRunContainers.outcome, "landed"),
        isNull(importRunContainers.deletedAt),
      ),
    );
}

/**
 * A run and every Container of it, in the order the Owner listed them.
 *
 * ORDERED BY THE LIST POSITION AND NOT BY ANYTHING ELSE. A Container whose
 * outcome has been recorded is an UPDATED row, and an updated row moves to the
 * end of the heap -- so a read without this order answers the list re-sorted by
 * whichever Containers have been asked for, which is the one order the Owner
 * never gave.
 */
export async function readImportRun(db: Database, runId: string): Promise<ImportRun> {
  const [run] = await db.select().from(importRuns).where(eq(importRuns.id, runId));
  if (!run) throw new Error(`no import run is ${runId}`);

  const containers = await db
    .select()
    .from(importRunContainers)
    .where(eq(importRunContainers.runId, runId))
    .orderBy(asc(importRunContainers.listPosition));

  return {
    id: run.id,
    providerIdentity: run.providerIdentity,
    containers: containers.map((container) => asRunContainer(container)),
  };
}

/**
 * The row as the union above, which is where migration 18's checks are read
 * back rather than trusted: a `landed` row without counts and a `refused` row
 * without a reason are both states the database refuses to hold, so a row
 * arriving here without them is a rung that has changed underneath this.
 */
function asRunContainer(row: typeof importRunContainers.$inferSelect): RunContainer {
  const externalId = row.externalId;
  if (row.outcome === "landed") {
    if (row.placements === null || row.quarantinedValues === null) {
      throw new Error(`import run container ${row.id} landed without counting what it wrote`);
    }
    return {
      externalId,
      outcome: "landed",
      placements: row.placements,
      quarantinedValues: row.quarantinedValues,
    };
  }
  if (row.outcome === "refused") {
    if (row.reasonText === null || row.reasonWrote === null) {
      throw new Error(`import run container ${row.id} refused without saying why`);
    }
    return {
      externalId,
      outcome: "refused",
      reason: { wrote: row.reasonWrote as RefusalReason["wrote"], text: row.reasonText },
    };
  }
  return { externalId, outcome: "pending" };
}

/**
 * What one step of the walk needs: the next Container of this run that has not
 * been asked for, which Provider to ask, and how many are still to go.
 *
 * ONE AT A TIME IS WHAT THIS FUNCTION IS, and it is a measured constraint rather
 * than a simplification. `provider-wiki` is one Node process: two concurrent
 * browses of the largest Ordering were measured at 49.1s each against 25.5s
 * alone (2026-09-13), so a walk asking for two Containers at once would take
 * longer overall AND make every other request on that Provider slower.
 * Answering ONE Container is what leaves a caller nothing to parallelise.
 *
 * THE PROVIDER COMES FROM THE RUN AND NOT FROM THE CALLER. A run is a walk at
 * one Provider; a caller free to name a different one could browse a list of
 * that Provider's ids at somebody else's, and every id in a list belongs to one
 * Provider's namespace (ADR-0031, ADR-0078).
 *
 * `undefined` ONCE NONE IS LEFT, which is how the walk ends.
 */
export async function nextPendingContainer(
  db: Database,
  runId: string,
): Promise<{ externalId: string; providerIdentity: string; pending: number } | undefined> {
  const { rows } = await db.execute<{
    external_id: string;
    provider_identity: string;
    pending: string;
  }>(sql`
    select c."external_id", r."provider_identity",
           -- COUNTED BEFORE THE LIMIT, which is what a window function does: it
           -- answers how many Containers are still to be asked for, not how many
           -- rows came back.
           count(*) over () as pending
      from ${importRunContainers} c
      join ${importRuns} r on r."id" = c."run_id"
     where c."run_id" = ${runId}
       and c."outcome" = 'pending'
       and c."deleted_at" is null
     order by c."list_position"
     limit 1`);
  const next = rows[0];
  if (next === undefined) return undefined;
  return {
    externalId: next.external_id,
    providerIdentity: next.provider_identity,
    // `count` comes back as a string from Postgres's bigint.
    pending: Number(next.pending),
  };
}

/**
 * Records that one Container of a run landed, with what `browse` wrote.
 *
 * WHAT IT WROTE RATHER THAN ONLY THAT IT DID. A run read back a day later has to
 * answer what the import actually put in the catalogue, and `quarantinedValues`
 * is the half that would otherwise be silent: one `browse` writes a container's
 * worth of dates, so a bad Source fills the catalogue rather than a row of it
 * (CNCORE-29), and a run reporting success identically whether it held back
 * nothing or forty is the "silently" this ticket refuses.
 */
export async function recordContainerLanded(
  db: Database,
  {
    runId,
    externalId,
    placements,
    quarantinedValues,
  }: { runId: string; externalId: string; placements: number; quarantinedValues: number },
): Promise<void> {
  await recordOutcome(db, runId, externalId, {
    outcome: "landed",
    placements,
    quarantinedValues,
    reasonText: null,
    reasonWrote: null,
  });
}

/**
 * Records that one Container of a run refused, with the sentence the Owner acts
 * on.
 *
 * A REFUSAL IS ONE CONTAINER'S, NEVER THE RUN'S. The 464 Containers after it are
 * still worth asking for, and a walk that stopped at the first one would make a
 * corpus import hostage to a single deleted page. What makes a partial import
 * visible rather than silent is this row, read back beside the ones that landed.
 *
 * THE REASON IS REQUIRED, and migration 18 refuses a `refused` row without one.
 * A refusal the Owner cannot read is a refusal they cannot act on, which is the
 * whole of ADR-0123.
 */
export async function recordContainerRefused(
  db: Database,
  {
    runId,
    externalId,
    reason,
  }: { runId: string; externalId: string; reason: RefusalReason },
): Promise<void> {
  await recordOutcome(db, runId, externalId, {
    outcome: "refused",
    placements: null,
    quarantinedValues: null,
    reasonText: reason.text,
    reasonWrote: reason.wrote,
  });
}

async function recordOutcome(
  db: Database,
  runId: string,
  externalId: string,
  written: {
    outcome: ContainerOutcome;
    placements: number | null;
    quarantinedValues: number | null;
    reasonText: string | null;
    reasonWrote: string | null;
  },
): Promise<void> {
  const updated = await db
    .update(importRunContainers)
    .set(written)
    .where(
      and(
        eq(importRunContainers.runId, runId),
        eq(importRunContainers.externalId, externalId),
        isNull(importRunContainers.deletedAt),
      ),
    )
    .returning({ id: importRunContainers.id });
  if (updated.length === 0) {
    throw new Error(`import run ${runId} does not list a Container ${externalId}`);
  }
}
