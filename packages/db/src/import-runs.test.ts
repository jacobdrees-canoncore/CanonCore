import { beforeAll, describe, expect, it } from "vitest";

import {
  beginImportRun,
  type Database,
  nextPendingContainer,
  readImportRun,
  recordContainerLanded,
  recordContainerRefused,
} from "./index";
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
});

describe("walking a run", () => {
  it("answers the Container the Owner listed first, because nothing has been asked for yet", async () => {
    const run = await beginImportRun(db, {
      providerIdentity: aProvider(),
      containerIds: THREE,
    });

    expect(await nextPendingContainer(db, run.id)).toEqual({ externalId: "249643" });
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

    expect(await nextPendingContainer(db, run.id)).toEqual({ externalId: "105893" });
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

    expect(await nextPendingContainer(db, run.id)).toEqual({ externalId: "105893" });
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

    expect(await nextPendingContainer(db, resumed.id)).toEqual({ externalId: "105893" });
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

    expect(await nextPendingContainer(db, resumed.id)).toEqual({ externalId: "249643" });
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
