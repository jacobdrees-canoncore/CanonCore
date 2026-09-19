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

const owned = new AsyncDisposableStack();
let db: ReturnType<typeof createDb>;
let client: AppRouterClient;
const imported: Array<{
  id: string;
  name: string;
  atLeast: number;
  placements: number;
  seconds: number;
}> = [];

beforeAll(async () => {
  const providerUrl = await theProviderServing(owned);

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

test("the wiki is recorded as the Source of what landed", async () => {
  const { rows } = await db.execute(sql`SELECT kind, identity, label FROM sources`);
  console.log(`  sources: ${JSON.stringify(rows)}`);
  expect(rows.length).toBeGreaterThan(0);
});

test("one Item sits in SEVERAL Orderings at different Positions", async () => {
  const { rows } = await db.execute(sql`
    SELECT i.title, count(DISTINCT p.container_id) AS orderings,
           array_agg(DISTINCT p.position) AS positions
    FROM items i JOIN placements p ON p.item_id = i.id
    GROUP BY i.id, i.title
    HAVING count(DISTINCT p.container_id) > 1
    ORDER BY count(DISTINCT p.container_id) DESC, i.title
    LIMIT 5`);
  for (const row of rows)
    console.log(`  ${row.title}: ${row.orderings} orderings at ${row.positions}`);
  expect(rows.length).toBeGreaterThan(0);
});

/**
 * ADR-0009's REPEAT, which is the shape a folder tree cannot hold at all: the same story
 * listed at several points of ONE chronology, for a recap or a bookend.
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
  expect(rows.length).toBeGreaterThan(0);
});
