import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  beginImportRun,
  type Database,
  ImportRunRefused,
  nextPendingContainer,
  readImportRun,
  recordContainerLanded,
  recordContainerRefused,
} from "./index";
import { importRuns } from "./schema";
import { connect } from "./testing/catalogue";

let db: Database;

beforeAll(async () => {
  db = await connect();
});

/**
 * A PROVIDER PER TEST, because a run is found again by the provider it is at:
 * two tests sharing one identity would each be resuming the other's run.
 */
let providers = 0;
const aProvider = () => `http://127.0.0.1:39481/${++providers}`;

/**
 * THREE IDS WHOSE LIST ORDER IS NOT THEIR ALPHABETICAL ORDER, so an ordering
 * read off the wrong column fails rather than passing by coincidence. Sorted,
 * these read 105893, 226288, 249643 -- which is neither the order below nor its
 * reverse.
 */
const THREE = ["249643", "105893", "226288"];

/**
 * AN ID NO BTREE CAN HOLD. `import_run_containers_named_once` indexes
 * `external_id`, and PostgreSQL refuses an index row over 2704 bytes: measured
 * here as "index row size 3872 exceeds btree version 4 maximum 2704" on
 * 2026-09-20.
 *
 * INCOMPRESSIBLE ON PURPOSE. 3000 repeated digits TOAST down to something that
 * fits and the row writes perfectly well, so a fixture built the obvious way
 * would pass while proving nothing. Hashes are deterministic as well as
 * incompressible, which a random string would not be.
 */
const TOO_LONG_TO_INDEX = Array.from({ length: 125 }, (_, at) =>
  createHash("sha256").update(String(at)).digest("hex"),
).join("");

describe("beginImportRun", () => {
  it("opens a run holding the list in the order the Owner handed it over", async () => {
    const run = await beginImportRun(db, {
      providerIdentity: aProvider(),
      containerIds: THREE,
    });

    expect(run.containers.map((container) => container.externalId)).toEqual(THREE);
  });

  it("opens every Container of a new run as pending, because nothing has been asked yet", async () => {
    const run = await beginImportRun(db, {
      providerIdentity: aProvider(),
      containerIds: THREE,
    });

    expect(run.containers.map((container) => container.outcome)).toEqual([
      "pending",
      "pending",
      "pending",
    ]);
  });

  /**
   * THE LIST IS A DOCUMENT THE OWNER WROTE, so an id on it twice is a typo
   * rather than a claim made twice. ADR-0154 takes that decision, and says why
   * the opposite reading -- `groups.ts`'s conflict MET rather than raised,
   * because asking twice is the claim already standing -- does not carry here.
   *
   * AND THE SENTENCE SAYS WHERE. The case this exists for is a hand-assembled
   * list of 465, where "one of these is repeated" is not something a reader can
   * act on. Positions count from one, as the Owner counts the lines of their
   * own file.
   */
  it("refuses a list naming one Container twice, saying which id and where it repeats", async () => {
    const listing249643Twice = ["249643", "105893", "249643"];

    const refusal = await beginImportRun(db, {
      providerIdentity: aProvider(),
      containerIds: listing249643Twice,
    }).catch((cause: unknown) => cause);

    expect(refusal).toBeInstanceOf(ImportRunRefused);
    expect((refusal as Error).message).toBe("249643 is listed twice, at positions 1 and 3");
  });
  /**
   * THE RUN ROW AND ITS CONTAINERS ARE ONE WRITE. They were two statements with
   * nothing around them until CNCORE-254, so a list that failed to write left
   * the run row standing over none of its members -- and a run reporting zero
   * Containers reads as an import that found nothing rather than as one that
   * never happened.
   *
   * DRIVEN BY AN ID TOO LONG TO INDEX RATHER THAN BY A REPEAT, because a repeat
   * is refused above before anything is written and so proves nothing about the
   * transaction. `import_run_containers_named_once` is a btree, and a btree
   * cannot hold a value over 2704 bytes: measured at "index row size 3872
   * exceeds btree version 4 maximum 2704" on this server, 2026-09-20. It is
   * incompressible on purpose -- 3000 repeated digits TOAST down to something
   * that fits, and the test would pass while writing the row.
   *
   * NOTHING BOUNDS AN ID'S LENGTH ON THE WAY IN, which is what makes this
   * reachable rather than contrived: `containerIds` is `z.array(z.string()
   * .min(1)).min(1)` with no maximum. That gap is CNCORE-268, and it is not
   * this ticket -- what is this ticket's is that failing here leaves no orphan.
   */
  it("leaves no run behind when the list it was opened with cannot be written", async () => {
    const provider = aProvider();

    await expect(
      beginImportRun(db, { providerIdentity: provider, containerIds: [TOO_LONG_TO_INDEX] }),
    ).rejects.toThrow();

    const orphans = await db
      .select()
      .from(importRuns)
      .where(eq(importRuns.providerIdentity, provider));
    expect(orphans).toEqual([]);
  });
  /**
   * A CONSTRAINT THIS LIST CAN REACH NEVER REACHES THE OWNER AS A FAULT. The
   * insert was unnarrowed until CNCORE-254, so SQLSTATE 23505 escaped as a
   * `DrizzleQueryError` -- which is not an `ORPCError`, so the mount logged it
   * as a fault and oRPC answered 500. The Owner met "something broke" for a
   * list they could have fixed in one edit.
   *
   * WHICH SQLSTATES THOSE ARE IS A FACT ABOUT THE SCHEMA, so they live in
   * `import-runs.ts` beside the write rather than in the router, exactly as
   * `by-hand.ts` and `groups.ts` say of their own.
   */
  it("refuses a list the database will not index, rather than letting it escape as a fault", async () => {
    const refusal = await beginImportRun(db, {
      providerIdentity: aProvider(),
      containerIds: [TOO_LONG_TO_INDEX],
    }).catch((cause: unknown) => cause);

    expect(refusal).toBeInstanceOf(ImportRunRefused);
  });
});

describe("walking a run", () => {
  it("answers the Container the Owner listed first, because nothing has been asked for yet", async () => {
    const run = await beginImportRun(db, {
      providerIdentity: aProvider(),
      containerIds: THREE,
    });

    expect(await nextPendingContainer(db, run.id)).toMatchObject({ externalId: "249643" });
  });

  /**
   * A WALK OF 465 CONTAINERS TAKES ABOUT FIVE AND A HALF HOURS, so what it can
   * say about where it has got to is not a nicety: it is the only thing standing
   * between the Owner and a terminal that has printed nothing for an hour.
   */
  it("says how many Containers are still to be asked for, and which Provider to ask", async () => {
    const provider = aProvider();
    const run = await beginImportRun(db, { providerIdentity: provider, containerIds: THREE });

    await recordContainerLanded(db, {
      runId: run.id,
      externalId: "249643",
      placements: 2913,
      quarantinedValues: 0,
    });

    expect(await nextPendingContainer(db, run.id)).toEqual({
      externalId: "105893",
      providerIdentity: provider,
      pending: 2,
    });
  });

  it("moves past a Container that has landed, to the next one the Owner listed", async () => {
    const run = await beginImportRun(db, {
      providerIdentity: aProvider(),
      containerIds: THREE,
    });

    await recordContainerLanded(db, {
      runId: run.id,
      externalId: "249643",
      placements: 2913,
      quarantinedValues: 0,
    });

    expect(await nextPendingContainer(db, run.id)).toMatchObject({ externalId: "105893" });
  });

  /**
   * A REFUSAL DOES NOT STOP THE WALK, which is what makes a partial import
   * visible rather than silent. One Container the Provider will not answer for
   * is one Container, and the 464 after it are still worth asking for.
   */
  it("carries on past a Container the Provider refused, to the next one the Owner listed", async () => {
    const run = await beginImportRun(db, {
      providerIdentity: aProvider(),
      containerIds: THREE,
    });

    await recordContainerRefused(db, {
      runId: run.id,
      externalId: "249643",
      reason: { wrote: "provider", text: "403 Forbidden" },
    });

    expect(await nextPendingContainer(db, run.id)).toMatchObject({ externalId: "105893" });
  });

  it("reports what landed and what refused, with the reason the refusal carried", async () => {
    const run = await beginImportRun(db, {
      providerIdentity: aProvider(),
      containerIds: THREE,
    });

    await recordContainerRefused(db, {
      runId: run.id,
      externalId: "249643",
      reason: { wrote: "provider", text: "403 Forbidden" },
    });
    await recordContainerLanded(db, {
      runId: run.id,
      externalId: "105893",
      placements: 421,
      quarantinedValues: 2,
    });

    /*
     * THE WHOLE ROW FOR EACH, IN THE ORDER THE OWNER LISTED THEM. Recording an
     * outcome UPDATES a row, and an updated row is written at the end of the
     * heap -- so this also fails if the read stops naming the list's order, in
     * the one arrangement where the wrong order is not the order it was written
     * in.
     */
    expect((await readImportRun(db, run.id)).containers).toEqual([
      {
        externalId: "249643",
        outcome: "refused",
        reason: { wrote: "provider", text: "403 Forbidden" },
      },
      { externalId: "105893", outcome: "landed", placements: 421, quarantinedValues: 2 },
      { externalId: "226288", outcome: "pending" },
    ]);
  });
});

/**
 * WHAT A RESUME IS FOR, in one sentence: the corpus is 465 Containers at 43.8s
 * each, so a walk that started again from the beginning would cost five and a
 * half hours to recover from anything that interrupted it.
 */
describe("resuming a run", () => {
  it("carries on with the same run when the Owner hands over the same list again", async () => {
    const provider = aProvider();
    const first = await beginImportRun(db, { providerIdentity: provider, containerIds: THREE });
    await recordContainerLanded(db, {
      runId: first.id,
      externalId: "249643",
      placements: 2913,
      quarantinedValues: 0,
    });

    const resumed = await beginImportRun(db, { providerIdentity: provider, containerIds: THREE });

    expect(resumed.id).toBe(first.id);
  });

  it("asks again only for what has not landed, so a stop costs the remainder rather than the whole", async () => {
    const provider = aProvider();
    const first = await beginImportRun(db, { providerIdentity: provider, containerIds: THREE });
    await recordContainerLanded(db, {
      runId: first.id,
      externalId: "249643",
      placements: 2913,
      quarantinedValues: 0,
    });

    const resumed = await beginImportRun(db, { providerIdentity: provider, containerIds: THREE });

    expect(await nextPendingContainer(db, resumed.id)).toMatchObject({ externalId: "105893" });
  });

  /**
   * A LAPSED CREDENTIAL IS THE ORDINARY INTERRUPTION (ADR-0122), and it does not
   * stop a run: it refuses every Container after the moment it expires. So a
   * resume that treated a refusal as settled would leave the Owner's remainder
   * unreachable except by re-walking everything that already landed -- which is
   * the cost this whole rung exists to remove.
   */
  it("asks again for a Container that refused, because a refusal is one attempt rather than a verdict", async () => {
    const provider = aProvider();
    const first = await beginImportRun(db, { providerIdentity: provider, containerIds: THREE });
    await recordContainerRefused(db, {
      runId: first.id,
      externalId: "249643",
      reason: { wrote: "provider", text: "401 Unauthorized" },
    });

    const resumed = await beginImportRun(db, { providerIdentity: provider, containerIds: THREE });

    expect(await nextPendingContainer(db, resumed.id)).toMatchObject({ externalId: "249643" });
  });

  it("opens a new run once every Container has landed, so the same list imports again rather than doing nothing", async () => {
    const provider = aProvider();
    const first = await beginImportRun(db, { providerIdentity: provider, containerIds: THREE });
    for (const externalId of THREE) {
      await recordContainerLanded(db, {
        runId: first.id,
        externalId,
        placements: 1,
        quarantinedValues: 0,
      });
    }

    const second = await beginImportRun(db, { providerIdentity: provider, containerIds: THREE });

    expect(second.id).not.toBe(first.id);
    expect(second.containers.map((container) => container.outcome)).toEqual([
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("opens a new run for a different list, because the run is the walk over the list it was opened with", async () => {
    const provider = aProvider();
    const first = await beginImportRun(db, { providerIdentity: provider, containerIds: THREE });

    const other = await beginImportRun(db, {
      providerIdentity: provider,
      containerIds: [...THREE, "302341"],
    });

    expect(other.id).not.toBe(first.id);
  });

  it("opens a new run at a different Provider, because an id is one Provider's namespace", async () => {
    const first = await beginImportRun(db, { providerIdentity: aProvider(), containerIds: THREE });

    const elsewhere = await beginImportRun(db, {
      providerIdentity: aProvider(),
      containerIds: THREE,
    });

    expect(elsewhere.id).not.toBe(first.id);
  });
});
