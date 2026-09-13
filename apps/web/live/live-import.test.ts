/**
 * CNCORE-103's GATE: a real `Theory:Timeline` imported live, end to end.
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

import { spawn } from "node:child_process";
import { createDb, writeProviderSettings } from "@canoncore/db";
import { buildTestDatabase } from "@canoncore/db/testing/build-database";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";

import { logInAt } from "../e2e/document";
import {
  freePort,
  OWNER_PASSWORD,
  theAppBuilt,
  theBuildServing,
  waitUntilAnswering,
} from "../e2e/instance";

/**
 * WHERE `provider-wiki` IS CHECKED OUT, which is the one thing this file cannot derive.
 *
 * It is a SEPARATE REPOSITORY (ADR-0031) and there is no import to follow. A default is
 * given so the check runs without ceremony on the machine it was written on, and the
 * variable is what makes it runnable anywhere else.
 */
const PROVIDER_WIKI =
  process.env.PROVIDER_WIKI_REPO ??
  "/Users/jacobrees/orca/workspaces/provider-wiki/cncore-103-delete-archive";

/**
 * THE TWO TIMELINES, CHOSEN RATHER THAN PICKED, AND THE CHOICE IS BOUNDED BY A DEFECT.
 *
 * They OVERLAP, which is the whole point: measured 2026-09-13 they share 57 stories, and
 * they disagree about where those stories go -- `The Quantum Archangel (novel)` is at
 * position 29 of one and 370 of the other. That disagreement is the product's entire
 * argument and the thing a three-item seed could only gesture at.
 *
 * THE BIGGEST TIMELINE IS NOT HERE AND CANNOT BE, WHICH IS CNCORE-151. AHistory is the
 * largest at 229,641 bytes and browses to 2,913 members at 2,669 distinct positions with
 * 454 repeats -- but it takes `provider-wiki` 24.6s, and `packages/providers/src/client.ts`
 * caps a provider call at 10s. So CNCORE-102's "a large timeline imports without timing
 * out" is FALSE against the real wiki, and was never tested against it: that suite's
 * provider is a stub. Measured here rather than assumed, which is why this file exists.
 */
const TIMELINES = [
  { id: "226288", name: "Theory:Timeline - Melanie Bush" },
  { id: "105893", name: "Theory:Timeline - Sixth Doctor" },
];

const stop: Array<() => void> = [];
let db: ReturnType<typeof createDb>;
// biome-ignore lint/suspicious/noExplicitAny: the oRPC client's type lives in the api package.
let client: any;
const imported: Array<{ id: string; name: string; placements: number; seconds: number }> = [];

beforeAll(async () => {
  const providerPort = await freePort();
  const provider = spawn("node", ["src/server.ts"], {
    cwd: PROVIDER_WIKI,
    env: { ...process.env, PORT: String(providerPort), HOSTNAME_BIND: "127.0.0.1" },
    stdio: "inherit",
  });
  stop.push(() => provider.kill("SIGTERM"));
  const providerUrl = `http://127.0.0.1:${providerPort}`;
  await waitUntilAnswering(providerUrl, provider);

  const databaseUrl = await buildTestDatabase("web");
  db = createDb(databaseUrl, { maxConnections: 2 });
  await writeProviderSettings(db, {
    providerAllowlist: "127.0.0.0/8",
    providerUrls: providerUrl,
  });

  const env = { ...process.env, DATABASE_URL: databaseUrl, OWNER_PASSWORD };
  await theAppBuilt(env);
  const server = await theBuildServing(env);
  stop.push(server.close);

  const cookie = await logInAt(server.baseUrl, OWNER_PASSWORD);
  client = createORPCClient(
    new RPCLink({ url: `${server.baseUrl}/api/rpc`, headers: { cookie } }),
  );

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
  await db?.$client.end();
  for (const halt of stop.reverse()) halt();
});

test("a real Theory:Timeline browses in from the live wiki and lands its Items", async () => {
  for (const run of imported) {
    // eslint-disable-next-line no-console -- the figures are the evidence this file exists for.
    console.log(`  ${run.name} (${run.id}): ${run.placements} placements in ${run.seconds}s`);
    expect(run.placements).toBeGreaterThan(0);
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
  for (const row of rows) console.log(`  ${row.title}: ${row.orderings} orderings at ${row.positions}`);
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
