/**
 * A real `Theory:Timeline` imported live, end to end.
 *
 * IT IS TWO TICKETS' EVIDENCE AND THE SECOND IS WHY THE BIGGEST PAGE IS HERE.
 * CNCORE-103 needs it to delete the archive: the live path has to be shown to
 * replace what is being deleted. CNCORE-151 needs it because the defect it fixes
 * is only visible at size -- one cap for every operation, which the largest
 * timeline on the wiki could not fit inside.
 *
 * NOTHING IN EITHER REPOSITORY HAD EVER DONE THIS, which is why deleting the archive could
 * not rest on a green suite. The e2e suite's provider is a stub (`e2e/wiki-fixture.ts`),
 * CI's "against the real provider" job never reached one (CNCORE-143), and `provider-wiki`'s
 * own suite reads a committed fixture. Every check that was green was a check of the harness
 * against itself.
 *
 * THE WHOLE STACK, NOTHING STUBBED:
 *   next build + next start -> /api/rpc -> provider.browse -> HTTP -> provider-wiki
 *   -> tardis.wiki (live, behind Cloudflare, on the Owner's Credential) -> Postgres
 *
 * LOCAL ONLY. It needs the Owner's Credential, which no CI job holds (ADR-0122), and it is
 * in a Vitest project of its own so that `test:e2e` neither runs it nor reddens without it.
 * `vitest.live.config.ts` says why that separation is the point.
 *
 * IT IS AN ASSERTION RATHER THAN A PRINTOUT. A script that prints what landed proves
 * nothing the day it stops landing: the acceptance criteria below are the claims CNCORE-103
 * is gated on, written as expectations so that a future run says which one broke.
 */

import type { AppRouterClient } from "@canoncore/api/routers";
import { createDb, writeProviderSettings } from "@canoncore/db";
import { buildTestDatabase } from "@canoncore/db/testing/build-database";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";

import { logInAt } from "../e2e/document";
import { OWNER_PASSWORD, theAppBuilt, theBuildServing } from "../e2e/instance";
import { theProviderServing } from "./provider";

/**
 * THREE TIMELINES, CHOSEN RATHER THAN PICKED, AND EACH ONE ANSWERS SOMETHING.
 *
 * The first two OVERLAP, which is the whole point: measured 2026-09-13 they share 57
 * stories, and they disagree about where those stories go -- `The Quantum Archangel
 * (novel)` is at position 29 of one and 370 of the other. That disagreement is the
 * product's entire argument and the thing a three-item seed could only gesture at.
 *
 * THE THIRD IS THE BIGGEST THE WIKI HOLDS, AND IT IS HERE BECAUSE IT COULD NOT BE.
 * AHistory is 229,641 bytes and browses to 2,913 members at 2,669 distinct positions with
 * 454 repeats, and `provider-wiki` needs ~25.9s to answer it. Every provider call was
 * capped at 10s, so CNCORE-102's "a large timeline imports without timing out" was FALSE
 * against the real wiki and had never been tested against it -- that suite's provider is a
 * stub. CNCORE-151 split the cap by the size of the question and this line is what proves
 * it: measured here at 2,913 placements, where before it was `UND_ERR_HEADERS_TIMEOUT`.
 *
 * IT IS THE SLOW ONE ON PURPOSE. This file takes about a minute, and most of that minute
 * is this page. A cheaper check would not be checking the thing that broke.
 */
const TIMELINES = [
  { id: "226288", name: "Theory:Timeline - Melanie Bush", atLeast: 100 },
  { id: "105893", name: "Theory:Timeline - Sixth Doctor", atLeast: 400 },
  { id: "249643", name: "Theory:Timeline - Doctor Who universe/AHistory", atLeast: 2_500 },
];

/**
 * The REAL positions in an aggregated array, with the NULLs dropped.
 *
 * Both claims below are about where a story SITS, and a NULL is the absence of that
 * (ADR-0018): counting one would let `{null, 29}` read as two points. `unknown`
 * because `array_agg` arrives untyped, and a row is a database answer rather than a
 * value this file constructed.
 */
function realPositions(aggregated: unknown): number[] {
  if (!Array.isArray(aggregated))
    throw new Error(`not an aggregate: ${JSON.stringify(aggregated)}`);
  return aggregated.filter((at): at is number => typeof at === "number");
}

/**
 * WHAT EACH ORDERING SAYS ABOUT ONE ITEM, as one string per ordering that SPOKE.
 *
 * An ordering holding the item at no position said nothing (ADR-0018) rather than
 * disagreeing, so it is dropped; the rest are compared whole, because two orderings
 * agree only if they put the story in all the same places. A Set of them sized above
 * one IS the disagreement.
 */
function whatEachOrderingSays(row: Record<string, unknown>): Set<string> {
  const orderings = row.by_ordering;
  if (!Array.isArray(orderings)) throw new Error(`no orderings on ${JSON.stringify(row)}`);
  return new Set(
    orderings.map((positions) => realPositions(positions).join(",")).filter((said) => said !== ""),
  );
}

const owned = new AsyncDisposableStack();
let db: ReturnType<typeof createDb>;
let client: AppRouterClient;
let providerUrl: string;
const imported: Array<{
  id: string;
  name: string;
  atLeast: number;
  placements: number;
  seconds: number;
}> = [];

beforeAll(async () => {
  providerUrl = await theProviderServing(owned);

  const databaseUrl = await buildTestDatabase("web");
  db = createDb(databaseUrl, { maxConnections: 2 });
  owned.defer(() => db.$client.end());
  await writeProviderSettings(db, {
    providerAllowlist: "127.0.0.0/8",
    providerUrls: providerUrl,
  });

  const env = { ...process.env, DATABASE_URL: databaseUrl, OWNER_PASSWORD };
  await theAppBuilt(env);
  const server = await theBuildServing(owned, env);

  const cookie = await logInAt(server.baseUrl, OWNER_PASSWORD);
  client = createORPCClient(new RPCLink({ url: `${server.baseUrl}/api/rpc`, headers: { cookie } }));

  for (const timeline of TIMELINES) {
    const began = Date.now();
    const browsed = await client.provider.browse({
      baseUrl: providerUrl,
      containerId: timeline.id,
    });
    imported.push({
      ...timeline,
      placements: browsed.placements.length,
      seconds: Number(((Date.now() - began) / 1000).toFixed(1)),
    });
  }
});

afterAll(async () => {
  await owned.disposeAsync();
});

test("a real Theory:Timeline browses in from the live wiki and lands its Items", async () => {
  for (const run of imported) {
    // The figures are the evidence this file exists for.
    console.log(`  ${run.name} (${run.id}): ${run.placements} placements in ${run.seconds}s`);
    /*
     * A FLOOR PER TIMELINE RATHER THAN "MORE THAN NONE", because more than none is
     * what a TRUNCATED import also looks like. CNCORE-151's claim is that AHistory
     * arrives WHOLE at 2,913 members, and an assertion of `> 0` would pass on a
     * hundred of them -- catching only a hard timeout and not the half-answer that
     * a cap, a body limit or a batching bug produces.
     *
     * A FLOOR AND NOT THE EXACT COUNT, because these are figures about the LIVE
     * wiki and they move as editors edit it. Each is set a little under what was
     * measured on 2026-09-13 -- 113, 421 and 2,913 -- so an edit does not redden
     * the suite while a truncation still does.
     */
    expect(run.placements).toBeGreaterThanOrEqual(run.atLeast);
  }
  const [totals] = (
    await db.execute(sql`
      SELECT (SELECT count(*) FROM items) AS items,
             (SELECT count(*) FROM placements) AS placements`)
  ).rows;
  console.log(`  postgres: ${JSON.stringify(totals)}`);
  expect(Number(totals?.items)).toBeGreaterThan(100);
});

/**
 * AND `rows.length > 0` IS NOT THAT ASSERTION, WHICH IS WHY IT IS NOT THE ONE MADE
 * (CNCORE-257). `sources` IS NEVER EMPTY ON A MIGRATED DATABASE: migration 1 seeds
 * `owner` and migration 17 seeds `derived:sort-name-v1`. Measured on a database this
 * file's own `buildTestDatabase("web")` had just built -- two rows, `items` 0,
 * `placements` 0 -- so the count passed with the ENTIRE live import deleted, while
 * `kind`, `identity` and `label` were selected for `console.log` alone.
 *
 * THE IDENTITY IS THE PROVIDER THIS RUN STARTED, not merely the word "provider". A
 * source row naming some other provider would be a catalogue that recorded the wrong
 * origin for what landed, which is the failure this claim is here to refuse.
 */
test("the wiki is recorded as the Source of what landed", async () => {
  const { rows } = await db.execute(sql`SELECT kind, identity, label FROM sources`);
  console.log(`  sources: ${JSON.stringify(rows)}`);
  expect(rows).toContainEqual({ kind: "provider", identity: providerUrl, label: "provider-wiki" });
});

/**
 * THE POSITIONS THEMSELVES, BECAUSE THE DISAGREEMENT IS THE CLAIM (CNCORE-257).
 *
 * `rows.length > 0` said only that some item was in two orderings, and the `positions`
 * it aggregated went to `console.log`. Multi-placement is not "a member of two lists" --
 * a folder tree with symlinks does that -- it is TWO ORDERINGS DISAGREEING ABOUT WHERE
 * THE SAME STORY GOES, which is ADR-0018's whole argument against Calibre's
 * `series_index` (that record, at its Calibre paragraph and at its nullable-column one).
 * Delete the disagreement -- every placement of one item at one position -- and the old
 * count passed unchanged; measured on a database seeded to exactly that shape, where the
 * assertion below reddens.
 *
 * THE FIXTURE WAS CHOSEN FOR IT: the header's `The Quantum Archangel (novel)` at 29 of
 * one timeline and 370 of another. Read as "some row disagrees with itself" rather than
 * as those two numbers, for the reason the floors above are floors -- editors edit. On
 * the Owner's install on 2026-09-20 that was 5,680 of 5,789 items in several orderings.
 *
 * READ PER ORDERING AND COMPARED ACROSS THEM, NOT POOLED. Pooling every position of an
 * item and counting the distinct ones is satisfied by a REPEAT INSIDE ONE ordering --
 * which is the test below this one, ADR-0009's, and would leave this one green on a
 * catalogue where no two orderings disagreed about anything. Each ordering says where it
 * puts the story; two saying different things is the claim.
 *
 * NULLS ARE NOT A DISAGREEMENT. A member a source placed nowhere carries `position`
 * NULL (ADR-0018): an ordering holding the story at no position said nothing rather than
 * something else, so it is dropped rather than counted as a third opinion.
 */
test("one Item sits in SEVERAL Orderings at different Positions", async () => {
  const { rows } = await db.execute(sql`
    SELECT i.title, count(*) AS orderings,
           jsonb_agg(per.positions ORDER BY per.container_id) AS by_ordering
    FROM (
      SELECT item_id, container_id, array_agg(position ORDER BY position) AS positions
      FROM placements GROUP BY item_id, container_id
    ) per
    JOIN items i ON i.id = per.item_id
    GROUP BY i.id, i.title
    HAVING count(*) > 1
    ORDER BY count(*) DESC, i.title
    LIMIT 5`);
  for (const row of rows)
    console.log(`  ${row.title}: ${row.orderings} orderings saying ${row.by_ordering}`);
  expect(rows.some((row) => whatEachOrderingSays(row).size > 1)).toBe(true);
});

/**
 * ADR-0009's REPEAT, which is the shape a folder tree cannot hold at all: the same story
 * listed at several points of ONE chronology, for a recap or a bookend.
 *
 * AND `count(*) > 1` IS NOT THAT SHAPE, WHICH IS WHAT `rows.length > 0` COULD NOT SEE
 * (CNCORE-257). A group of two rows passes that `HAVING` when one of them has NO
 * position: `{null, 29}` is a member placed once and declared once, not a story at
 * several points. Measured on the Owner's install on 2026-09-20 -- of 1,537 groups
 * passing it, 27 are that shape. Seeded to only that shape, the old count passed and the
 * assertion below reddens.
 *
 * A REPEATED POSITION IS NOT THE MECHANISM AND CANNOT BE. `placements_container_item_position`
 * is UNIQUE NULLS NOT DISTINCT over (owner, container, item, position), so two placements
 * of one item in one container MUST differ in position; the same measurement found zero
 * repeated ones, as the constraint requires. The repeat is SEVERAL REAL POINTS, and that
 * is what is counted here.
 */
test("a story listed at several points of one timeline arrives as several Placements", async () => {
  const { rows } = await db.execute(sql`
    SELECT i.title, count(*) AS times, array_agg(p.position ORDER BY p.position) AS positions
    FROM items i JOIN placements p ON p.item_id = i.id
    GROUP BY i.id, i.title, p.container_id
    HAVING count(*) > 1
    ORDER BY count(*) DESC
    LIMIT 5`);
  for (const row of rows) console.log(`  ${row.title}: ${row.times}x at ${row.positions}`);
  expect(rows.some((row) => realPositions(row.positions).length > 1)).toBe(true);
});
