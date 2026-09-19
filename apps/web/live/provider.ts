import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { type Announcement, SERVER_HOST, thePortItBound } from "../e2e/instance";

/**
 * WHERE `provider-wiki` IS CHECKED OUT, which is the one thing this file cannot derive.
 *
 * It is a SEPARATE REPOSITORY (ADR-0031) and there is no import to follow.
 *
 * REQUIRED, WITH NO DEFAULT. An earlier version of this defaulted to the worktree it was
 * written in -- which the dispatcher removes when this branch merges, so the default was
 * dead the day it landed and would have failed as `spawn ENOENT` naming a path nobody
 * recognises. Machine state is not repo state: a path that exists on one Mac is not a
 * value this repository knows, and the honest form of not knowing it is to ask.
 */
const PROVIDER_WIKI = process.env.PROVIDER_WIKI_REPO;

/**
 * WHAT `provider-wiki` PRINTS ONCE IT IS LISTENING, from the port its own listener
 * reports: the last line of its `src/server.ts`, read at d028451. Were it worded
 * differently, the provider would fail to start saying it named no port, rather
 * than start somewhere unknown.
 */
const PROVIDER_WIKI_STARTED: Announcement = {
  name: "provider-wiki",
  line: /provider-wiki listening on (\S+)\r?\n/,
};

/**
 * THE REAL `provider-wiki`, STARTED FROM ITS CHECKOUT, and the URL it answers on.
 *
 * GIVEN PORT 0, AND THE PORT IT BOUND READ BACK OFF ITS OWN LINE (CNCORE-237),
 * which is `theBuildServing`'s shape for `next start` and the same reader. It used
 * to be handed a port from a probe that closed before the provider bound it, and
 * from that close to the provider's own bind the port was anybody's: the
 * provider then died on `EADDRINUSE` before it answered. `PORT=0` reaches its
 * listener as 0 -- `@hono/node-server` defaults the port with `??`, not `||` --
 * so the OS chooses in the bind that holds it. ADR-0144 carries why that closes
 * the window.
 *
 * BOUND AND REACHED AT `SERVER_HOST`, one constant for both, as a Next server
 * under test is. The URL is built from it and the port alone, never taken whole
 * from the line.
 *
 * ITS LINE IS PRINTED ONCE IT IS LISTENING, which is when it answers, so there
 * is no poll after it. It goes on `owned` as it is spawned, before the read, so
 * a provider that never names a port is closed with the rest.
 */
export async function theProviderServing(owned: AsyncDisposableStack): Promise<string> {
  if (!PROVIDER_WIKI) {
    throw new Error(
      "PROVIDER_WIKI_REPO is unset. It must name a `provider-wiki` checkout, which is a " +
        "separate repository (ADR-0031):\n" +
        "  PROVIDER_WIKI_REPO=/path/to/provider-wiki pnpm test:live",
    );
  }
  if (!existsSync(join(PROVIDER_WIKI, "src/server.ts"))) {
    throw new Error(
      `PROVIDER_WIKI_REPO is ${PROVIDER_WIKI}, which holds no src/server.ts. It should be ` +
        "the root of a `provider-wiki` checkout.",
    );
  }
  const provider = spawn("node", ["src/server.ts"], {
    cwd: PROVIDER_WIKI,
    env: { ...process.env, PORT: "0", HOSTNAME_BIND: SERVER_HOST },
    stdio: ["inherit", "pipe", "inherit"],
  });
  owned.defer(() => {
    provider.kill("SIGTERM");
  });
  return `http://${SERVER_HOST}:${await thePortItBound(provider, PROVIDER_WIKI_STARTED)}`;
}
