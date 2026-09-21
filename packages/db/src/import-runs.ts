import { quotedTo } from "@canoncore/text";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";

import type { Database } from "./index";
import { isRefusalOn, theOwnerId } from "./placements";
import { importRunContainers, importRuns } from "./schema";

/**
 * The catalogue REFUSING a list the Owner handed over, as opposed to failing to
 * write one it accepted.
 *
 * A TYPE RATHER THAN A `catch` AT THE CALLER, which is the argument
 * `ItemRefused` and `GroupRefused` already make in their own files: a router
 * that caught everything would tell the Owner their list was malformed when
 * what happened was a dead connection pool.
 *
 * NOT `RefusalReason` BELOW, AND THE TWO MUST NOT BE MISTAKEN FOR EACH OTHER.
 * That is ONE CONTAINER refusing part-way through a walk, written against its
 * row and read back beside the ones that landed; this is the whole list refused
 * before any of it is written, so there is no run to write it against.
 */
export class ImportRunRefused extends Error {}

/**
 * The refusals a list the Owner handed over can actually provoke, by their
 * SQLSTATE. THEY LIVE HERE RATHER THAN IN THE ROUTER, because which constraint
 * means "you asked for something impossible" is a fact about the schema, and
 * the schema is this package's -- the argument `by-hand.ts` and `groups.ts`
 * each make about their own.
 *
 * `54000` is `import_run_containers_named_once` refusing to INDEX an id: a
 * btree cannot hold a value over 2704 bytes, measured at "index row size 3872
 * exceeds btree version 4 maximum 2704" on 2026-09-20. It is a BACKSTOP rather
 * than the path, as 23505 is: `provider.beginImportRun` bounds a Container id
 * at 255 characters before it opens a run (ADR-0160, CNCORE-268), and 255
 * characters cannot exceed 765 bytes, so no list arriving through the router
 * reaches this.
 *
 * THAT IS THE ROUTER'S BOUND AND NOT THIS FUNCTION'S, which is worth holding
 * because a caller here does NOT inherit it. `import-runs.test.ts` drives the
 * transaction below with an id no btree can hold, and it can only do that by
 * calling `beginImportRun` directly; a repeat cannot drive it, because
 * `theRepeatIn` turns that list away before a row is written. So this catch has
 * a live witness while the path it guards has none.
 *
 * `23505` IS THAT SAME INDEX REFUSING A REPEAT, and `theRepeatIn` below turns
 * every list that could reach it away first. It is here because the whole
 * lesson of CNCORE-254 is that a constraint nobody thought reachable was
 * reached -- by the shape the feature was built for.
 *
 * ANYTHING ELSE IS NOT THE OWNER'S DOING and goes on being a fault: a dropped
 * connection, a disk full, a trigger raising for a reason nobody predicted.
 */
const REFUSALS = new Set(["23505", "54000"]);

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
 * the corpus is 465 Containers and ADR-0122's Credential lapses within a day,
 * so the interruption is not the exotic case but the ordinary one.
 */
export async function beginImportRun(
  db: Database,
  { providerIdentity, containerIds }: { providerIdentity: string; containerIds: string[] },
): Promise<ImportRun> {
  const repeated = theRepeatIn(containerIds);
  if (repeated !== undefined) {
    throw new ImportRunRefused(
      `${theContainerIdQuoted(repeated.externalId)} is listed twice, ` +
        `at positions ${repeated.first + 1} and ${repeated.again + 1}`,
    );
  }

  const resumable = await theRunStillWalkingThisList(db, { providerIdentity, containerIds });
  if (resumable !== undefined) {
    await askAgainForWhatHasNotLanded(db, resumable);
    return readImportRun(db, resumable);
  }

  const runId = await openTheRun(db, { providerIdentity, containerIds });

  // READ BACK AFTER THE COMMIT, which is what makes the run this answers the
  // one that is durably there rather than one a later statement could undo.
  return readImportRun(db, runId);
}

/**
 * Writes the run row and every Container of its list, and turns what the
 * Owner's own list can provoke into a refusal they can read.
 *
 * ONE TRANSACTION, because a run and the list it walks are one fact. They were
 * two statements with nothing around them until CNCORE-254, so a list that
 * failed to write left the run row standing over none of its members -- and a
 * run reporting zero Containers reads as an import that found nothing rather
 * than as one that never happened. `importProvidedRecord` makes the same
 * argument about an Item and its title statement.
 */
async function openTheRun(
  db: Database,
  { providerIdentity, containerIds }: { providerIdentity: string; containerIds: string[] },
): Promise<string> {
  try {
    return await db.transaction(async (tx) => {
      const ownerId = await theOwnerId(tx);
      const [run] = await tx.insert(importRuns).values({ ownerId, providerIdentity }).returning();
      if (!run) throw new Error("opening an import run returned no row");

      await tx.insert(importRunContainers).values(
        containerIds.map((externalId, listPosition) => ({
          ownerId,
          runId: run.id,
          externalId,
          listPosition,
        })),
      );
      return run.id;
    });
  } catch (cause) {
    if (isRefusalOn(REFUSALS, cause)) {
      throw new ImportRunRefused("the catalogue refused that list", { cause });
    }
    throw cause;
  }
}

/**
 * A CONTAINER ID AS THIS REFUSAL QUOTES IT BACK, which is 80 characters of it.
 *
 * ADR-0123's ceiling for a value interpolated into a refusal, TAKEN RATHER THAN
 * CHOSEN AGAIN. The two refusals that quote an id are one complaint a
 * constraint apart (ADR-0160), so an id too long and an id twice quote back the
 * same amount of it -- and since ADR-0179 they do that by reaching the SAME
 * function rather than by `provider.ts` spelling this number again. It is read
 * only by `theContainerIdQuoted` below.
 *
 * THE CEILING IS THIS PACKAGE'S AND THE LEVERS ARE NOT (ADR-0163). `quotedTo`
 * applies both of ADR-0123's -- how MUCH of a stranger's value lands in the
 * sentence, and what it may DO to the words around it -- and the number stays
 * beside the sentences it bounds rather than moving into the leaf. Until
 * CNCORE-282 this sentence took NEITHER lever: CNCORE-268 capped what could
 * arrive at 255 characters at the router, which is a smaller flood rather than
 * this record's mechanism.
 *
 * REACHED THROUGH `@canoncore/text` RATHER THAN COPIED. ADR-0123 refused the
 * import that would have shared these levers and was right about the dependency
 * it was offered -- `@canoncore/providers` brings an HTTP client, two undici
 * dispatchers and ADR-0034's boundaries. ADR-0163 moves them to a leaf that
 * depends on nothing, so this package reaches them at the cost of the lines
 * themselves.
 */
const ID_IN_A_SENTENCE = 80;

/**
 * A Container id AS A REFUSAL QUOTES IT BACK: bounded on both of ADR-0123's
 * levers, or the words saying why there was nothing left to quote (ADR-0179).
 *
 * ONE FUNCTION FOR BOTH REFUSALS THAT NAME AN ID, which is the whole point of
 * it being here rather than spelled at each. The repeat's sentence is thrown in
 * this file and the overlong one at the router (ADR-0160) -- "one complaint a
 * constraint apart" -- and two sites composing the call themselves is the shape
 * ADR-0163 already watched drift twice: half a mechanism looks finished from
 * outside, and the half missing here was the fallback rather than a lever.
 *
 * THE WORDS ARE `quotedTo`'S AND THE NOUN IS THIS FILE'S. Every site owing the
 * same sentence about a value the strip emptied takes the phrase from
 * `@canoncore/text`, so one concept ships in one voice; what this file knows,
 * and that leaf does not, is that the value is an id.
 *
 * IT CARRIES THE CEILING WITH IT, which is the one thing ADR-0163 said would
 * stay put. That record left `ID_IN_A_SENTENCE` spelled in two files with a
 * comment in each saying it was "TAKEN RATHER THAN CHOSEN AGAIN" -- a copy kept
 * in step by a comment telling the next reader to keep it in step, which is the
 * exact instrument that record proved does not work. `theQueryQuoted` is its
 * own precedent: one function holding the ceiling and both levers, reached by
 * both surfaces that print a query. ADR-0179 records the same for an id.
 */
export function theContainerIdQuoted(externalId: string): string {
  return quotedTo(externalId, ID_IN_A_SENTENCE, "an id");
}

/**
 * The first id this list names twice, and the two places it sits, or
 * `undefined` if it names each once.
 *
 * REFUSED RATHER THAN DEDUPED (ADR-0154). An import list is a document the
 * Owner authored, so an id on it twice is a typo rather than a claim made
 * twice -- which is what separates this from `putItemInGroupByHand`, where the
 * same conflict is MET rather than raised because a button clicked twice across
 * tabs is the claim already standing. The reading migration 18 wrote down is
 * this one: a repeat "would give the run two answers for one Container with
 * nothing to say which is current".
 *
 * IT ANSWERS THE REPEAT RATHER THAN THE SENTENCE, so the words the Owner reads
 * are built once, where they are thrown.
 *
 * WHICH AND WHERE, because the shape this exists for is a hand-assembled list
 * of 465 and "an id is repeated" is not something a reader can act on.
 *
 * THESE ARE POSITIONS IN THE LIST, NOT LINES OF A FILE, and the caller must not
 * describe them as lines: `theContainerIdsIn` drops blank lines and `#`
 * comments before this ever sees the ids, so position 12 of a commented list is
 * some later line of the file. They count from one because the Owner is
 * counting things, and nobody counts from zero; finding the id is then a search
 * for the id itself, which is what the sentence names first.
 *
 * ONLY THE FIRST. Reporting every repeat would ask the Owner to read a list to
 * fix a list, and the next attempt names the next one -- where a first refusal
 * they can act on in one edit is the whole of ADR-0123's reading of a reason.
 */
function theRepeatIn(containerIds: string[]): RepeatedId | undefined {
  const firstAt = new Map<string, number>();
  for (const [at, externalId] of containerIds.entries()) {
    const first = firstAt.get(externalId);
    if (first !== undefined) return { externalId, first, again: at };
    firstAt.set(externalId, at);
  }
  return undefined;
}

/** An id named twice, and the two places in the list it sits. */
interface RepeatedId {
  externalId: string;
  first: number;
  again: number;
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
  { runId, externalId, reason }: { runId: string; externalId: string; reason: RefusalReason },
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
