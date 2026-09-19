import { expect, test, vi } from "vitest";

import { aPortThief } from "../e2e/port-thief";
import { theProviderServing } from "./provider";

/**
 * THE REAL `spawn`, WRAPPED SO THE CASE BELOW CAN PUT ANOTHER PROCESS IN THE
 * PROVIDER'S WAY: see `aPortThief` in `e2e/port-thief.ts`.
 */
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});

/**
 * THE LIVE SUITE'S PROVIDER, AND ANOTHER PROCESS THAT WANTS ITS PORT (CNCORE-237).
 *
 * `live-import.test.ts` starts the real `provider-wiki`, and it used to hand it a
 * port from a probe that had already closed: the window CNCORE-235 closed for
 * `next start`, left open here. The thief strikes where that window was, just
 * before the provider's process starts, on the port and host it was told to use.
 * Red on the probe's shape: `listen EADDRINUSE: address already in use
 * 127.0.0.1:55233`, and the provider exited before it answered. Given port 0 it
 * is told nothing, so the thief takes nothing, and the case is a guard that fails
 * any return to naming the provider a port in advance.
 *
 * THE REAL PROVIDER, NOT A STAND-IN, because what is held is that `provider-wiki`
 * takes 0 as a port and announces the one it bound, and a stand-in would be the
 * harness agreeing with itself. It needs `PROVIDER_WIKI_REPO` and NOT the
 * Owner's Credential: the provider starts and answers its manifest without one.
 * That is why the dispatcher chose this seam on 2026-09-19, over the live import
 * alone: the credential lapses within a day and only the Owner renews it, so a
 * check that needs it rarely runs. Run it on its own with
 *
 *   PROVIDER_WIKI_REPO=/path/to/provider-wiki pnpm test:live live/provider.test.ts
 *
 * THE MANIFEST'S NAME IS THE ASSERTION, not merely a status, because the thief
 * hangs up on whatever connects and a URL reaching anything else would not say
 * `provider-wiki`.
 */
test("the provider starts even when another process takes, just before it binds, any port it was told to use", async () => {
  await using owned = new AsyncDisposableStack();
  aPortThief(owned);

  const providerUrl = await theProviderServing(owned);

  expect(await (await fetch(providerUrl)).json()).toMatchObject({ name: "provider-wiki" });
});
