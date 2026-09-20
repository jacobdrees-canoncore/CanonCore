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
import { importRunContainers, importRuns } from "./schema";
import { connect, refusal, theOwner } from "./testing/catalogue";

let db: Database;
let ownerId: string;

beforeAll(async () => {
  db = await connect();
  ownerId = await theOwner(db);
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
   * act on.
   *
   * POSITIONS IN THE LIST, NOT LINES OF THE FILE. `theContainerIdsIn` drops
   * blank lines and `#` comments before an id reaches here, so the two numbers
   * do not address the file directly -- which is why the sentence names the id
   * first, and the id is what the Owner searches their file for.
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
   * ADR-0123'S SECOND LEVER, AT THE SENTENCE THIS ONE BUILDS. A bidirectional
   * override re-orders the glyphs on either side of itself, so an id carrying
   * one runs the clause the refusal wrote AROUND it -- "is listed twice, at
   * positions 1 and 3" -- backwards through the Owner's page. It does that at
   * any length, which is why CNCORE-268's 255-character ceiling at the router
   * did not touch it: that bounded how much could arrive, not what it could do.
   *
   * THE WHOLE SENTENCE IS ASSERTED, not merely the absence of the character.
   * What the lever protects is the CLAUSE, and a test that only checked the id
   * had been scrubbed would pass on a sentence whose remedy had been reversed.
   */
  it("strips a bidirectional override from the id it quotes, so the clause around it still reads forwards", async () => {
    const listing249643Twice = ["249\u202e643", "105893", "249\u202e643"];

    const refusal = await beginImportRun(db, {
      providerIdentity: aProvider(),
      containerIds: listing249643Twice,
    }).catch((cause: unknown) => cause);

    expect((refusal as Error).message).toBe("249643 is listed twice, at positions 1 and 3");
  });
  /**
   * THE OTHER LEVER, AND IT IS REACHABLE RATHER THAN THEORETICAL. ADR-0160
   * bounds a Container id at 255 characters at the router, so an id of 120 is
   * one the Owner's own list can carry all the way to this sentence -- where
   * unbounded it would push the clause naming the two positions off whatever is
   * reading it. 80 is ADR-0123's ceiling for a value a refusal quotes back.
   *
   * THE CLAUSE IS ASSERTED WHOLE. What the ceiling protects is the half of the
   * sentence that says what to do about it, so a test asserting only the id's
   * length would pass on a sentence that had lost its remedy.
   */
  it("quotes back only as much of an overlong id as leaves the clause after it standing", async () => {
    const tooLongToQuote = "2".repeat(120);

    const refusal = await beginImportRun(db, {
      providerIdentity: aProvider(),
      containerIds: [tooLongToQuote, "105893", tooLongToQuote],
    }).catch((cause: unknown) => cause);

    expect((refusal as Error).message).toBe(
      `${"2".repeat(79)}\u2026 is listed twice, at positions 1 and 3`,
    );
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
   * THE WAY IN IS BOUNDED NOW, AND THIS SEAM IS NOT (CNCORE-268, ADR-0160).
   * `provider.beginImportRun` refuses a Container id over 255 characters before
   * it opens a run, so no list arriving through the router reaches the index.
   * This calls `beginImportRun` DIRECTLY, which is what keeps the write
   * reachable -- and it is the only thing that does, since a repeat is turned
   * away by `theRepeatIn` before a row is written. Bounding the length HERE
   * instead would leave the transaction below with nothing to drive it, which
   * is why ADR-0160 put the ceiling at the router and left 54000 a backstop.
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

/**
 * MIGRATION 18'S SIX, EACH MET HEAD ON. The suite above drives this table
 * through `beginImportRun`, `recordContainerLanded` and `recordContainerRefused`
 * and every write it makes is a legal one, so until CNCORE-260 the six rules the
 * rung declares were carried by nothing but the fact that no code broke them
 * yet. What each one is FOR is only visible when something tries.
 *
 * DIRECTLY AGAINST THE TABLE, WHICH IS THE SEAM ON PURPOSE. The functions exist
 * to write legal rows and a test that went through them could not reach these at
 * all -- CNCORE-254 is the worked example, where the repeat it refuses by name
 * now never gets as far as `named_once`. The database is the thing under test
 * here, so the database is what these write to.
 *
 * EACH NAMES THE CONSTRAINT IT EXPECTS. `refusal` answers with the constraint
 * PostgreSQL named, so a write that trips a neighbouring rule fails here rather
 * than passing as though it had proved the rule in the title -- which is the
 * ordinary way a test like this rots.
 */
describe("what a run's Containers will not hold", () => {
  it("refuses an outcome nobody defined, because those three words are the whole vocabulary", async () => {
    const run = await beginImportRun(db, { providerIdentity: aProvider(), containerIds: THREE });

    expect(
      await refusal(
        db
          .update(importRunContainers)
          .set({ outcome: "finished" })
          .where(eq(importRunContainers.runId, run.id)),
      ),
    ).toBe("import_run_containers_outcome_is_known");
  });
  /**
   * THE EQUIVALENCE RUNS BOTH WAYS, which is the half a nullable column would
   * lose. A row saying it landed while holding no counts is a run that cannot
   * say what it wrote, and the rung's own sentence calls that the row "this
   * database will not hold".
   */
  it("refuses a Container that landed without saying what it wrote", async () => {
    const run = await beginImportRun(db, { providerIdentity: aProvider(), containerIds: THREE });

    expect(
      await refusal(
        db
          .update(importRunContainers)
          .set({ outcome: "landed" })
          .where(eq(importRunContainers.runId, run.id)),
      ),
    ).toBe("import_run_containers_landed_counts_what_it_wrote");
  });

  /**
   * AND THE OTHER WAY, at the end an Owner has to act on. `refused` is the one
   * outcome that asks the Owner to do something, and a refusal carrying no
   * sentence tells them only that a Container did not arrive -- which of
   * ADR-0033's three it was, and whether it is worth asking again, is exactly
   * what the sentence holds.
   */
  it("refuses a Container that refused without saying why", async () => {
    const run = await beginImportRun(db, { providerIdentity: aProvider(), containerIds: THREE });

    expect(
      await refusal(
        db
          .update(importRunContainers)
          .set({ outcome: "refused" })
          .where(eq(importRunContainers.runId, run.id)),
      ),
    ).toBe("import_run_containers_refused_says_why");
  });

  /**
   * WHO WROTE THE SENTENCE IS A CLOSED SET OF TWO, because a surface attributes
   * a Provider's words and does not attribute this app's own (ADR-0123). A third
   * value would reach a surface that has no branch for it, and the surface would
   * either attribute CanonCore's own sentence to a third party or drop the
   * attribution from a Provider's.
   */
  it("refuses a reason written by somebody who is neither this app nor the Provider", async () => {
    const run = await beginImportRun(db, { providerIdentity: aProvider(), containerIds: THREE });

    expect(
      await refusal(
        db
          .update(importRunContainers)
          .set({ outcome: "refused", reasonText: "403 Forbidden", reasonWrote: "the-wiki-itself" })
          .where(eq(importRunContainers.runId, run.id)),
      ),
    ).toBe("import_run_containers_reason_wrote_is_known");
  });

  /**
   * THE BACKSTOP BEHIND CNCORE-254'S CHECK, and not the same assertion. The test
   * above -- "refuses a list naming one Container twice" -- drives
   * `beginImportRun`, which reads the list and refuses a repeat by name before a
   * row is written, so it never reaches this index at all. ADR-0154 names that
   * arrangement: the check saves the insert, and the index holds the invariant
   * behind it. What this asserts is the half nothing else can reach.
   *
   * A FRESH `list_position` ON PURPOSE, so `in_list_order` cannot be what fires
   * and pass this test for the wrong reason.
   */
  it("refuses one Container named twice in a run, whatever place in the list it claims", async () => {
    const run = await beginImportRun(db, { providerIdentity: aProvider(), containerIds: THREE });

    expect(
      await refusal(
        db.insert(importRunContainers).values({
          ownerId,
          runId: run.id,
          externalId: "249643",
          listPosition: 9,
        }),
      ),
    ).toBe("import_run_containers_named_once");
  });

  /**
   * WHAT MAKES THE ORDER TOTAL RATHER THAN MERELY USUAL, in migration 18's own
   * words. A resume reads this run's Containers by `list_position`, so two rows
   * claiming one place put the walk's next Container at the planner's discretion
   * -- and the walk is five and a half hours the Owner does not want to repeat.
   *
   * A FRESH `external_id` ON PURPOSE, for the same reason reversed: `named_once`
   * must not be what fires.
   */
  it("refuses two Containers claiming one place in the list", async () => {
    const run = await beginImportRun(db, { providerIdentity: aProvider(), containerIds: THREE });

    expect(
      await refusal(
        db.insert(importRunContainers).values({
          ownerId,
          runId: run.id,
          externalId: "302341",
          listPosition: 0,
        }),
      ),
    ).toBe("import_run_containers_in_list_order");
  });
});
