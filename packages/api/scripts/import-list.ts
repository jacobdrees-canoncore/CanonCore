/**
 * Imports a list of Containers into a RUNNING CanonCore, one at a time,
 * resumably (CNCORE-166).
 *
 *   OWNER_PASSWORD=... pnpm import:list \
 *     --at http://localhost:3000 \
 *     --provider http://provider-wiki:8080 \
 *     --list ./timelines.txt
 *
 * A thin CLI over `importContainerList`, which is where the behaviour lives and
 * where the suite reaches it -- the shape `packages/db/scripts/seed.ts` already
 * has over `src/seed.ts`. Everything this file decides is how to read three
 * arguments and what to print.
 *
 * IT DRIVES A RUNNING INSTANCE OVER ITS OWN API rather than reaching into a
 * database, and that is forced rather than chosen: `compose.yaml` publishes NO
 * database port -- "Only the app talks to this" -- so the app is the only route
 * into an install. Which is also why `--provider` may name a host only the app
 * can resolve: `http://provider-wiki:8080` means nothing here and everything on
 * the network `compose.yaml` puts the app and a Provider on.
 *
 * THE PASSWORD COMES FROM THE ENVIRONMENT AND NEVER FROM AN ARGUMENT, because
 * `ps` shows every process's arguments to every user on the machine.
 *
 * IT REACHES ITS OWN PACKAGE BY NAME rather than by a relative path, which is
 * what keeps bare `node` and `tsc` agreeing about where these modules are: the
 * exports map names the `.ts` files, so the runtime resolves them without the
 * explicit extension that a relative import would need and that this app's
 * tsconfig does not permit.
 *
 * RUN FROM THIS PACKAGE RATHER THAN THROUGH TURBO, for the reason
 * `vitest.live.config.ts` gives one directory over: a turbo task FILTERS its
 * environment, so `OWNER_PASSWORD` would be filtered out and this would answer a
 * different question in silence. That is CNCORE-143's shape exactly.
 */
import { readFile } from "node:fs/promises";
import { importContainerList, theContainerIdsIn } from "@canoncore/api/import-list";
import type { AppRouterClient } from "@canoncore/api/routers";
import { SESSION_COOKIE } from "@canoncore/api/session-cookie";
import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

const USAGE = `Imports a list of Containers into a running CanonCore.

  OWNER_PASSWORD=... pnpm import:list --at <url> --provider <url> --list <file>

  --at        the CanonCore instance to import INTO, e.g. http://localhost:3000
  --provider  the Provider to import FROM, as the INSTANCE reaches it
  --list      a file of Container ids, one a line; blank lines and # are ignored

  OWNER_PASSWORD is read from the environment, never from an argument.`;

function argument(name: string): string {
  const at = process.argv.indexOf(`--${name}`);
  const value = at === -1 ? undefined : process.argv[at + 1];
  if (value === undefined || value.startsWith("--")) {
    console.error(`--${name} is missing.\n\n${USAGE}`);
    process.exit(1);
  }
  return value;
}

const at = argument("at").replace(/\/$/, "");
const provider = argument("provider");
const list = argument("list");

const password = process.env.OWNER_PASSWORD;
if (!password) {
  console.error(`OWNER_PASSWORD is not set.\n\n${USAGE}`);
  process.exit(1);
}

const containerIds = theContainerIdsIn(await readFile(list, "utf8"));
if (containerIds.length === 0) {
  console.error(`${list} names no Container ids.`);
  process.exit(1);
}

const rpc = (headers: Record<string, string> = {}) =>
  createORPCClient<AppRouterClient>(new RPCLink({ url: `${at}/api/rpc`, headers }));

// THE TOKEN IS EXCHANGED FOR THE PASSWORD ONCE, and then travels as the cookie
// the instance reads (`SESSION_COOKIE`). Everything that WRITES is behind it
// (CNCORE-109), and a browse is a write.
const { token } = await rpc().session.logIn({ password });
const owner = rpc({ cookie: `${SESSION_COOKIE}=${token}` });

const began = Date.now();

/*
 * A REFUSED LIST PRINTS AS A SENTENCE, NOT AS A STACK TRACE. `beginImportRun`
 * refuses a list naming an id twice and says which id and where (CNCORE-254,
 * ADR-0154), and that sentence is the whole point of refusing rather than
 * deduping -- so reaching the Owner as an unhandled rejection, under a stack
 * from inside the RPC client, would waste it. BAD_REQUEST is the one code this
 * means: everything else is a fault and keeps its stack, because a dead
 * instance and a mistyped list are not the same news.
 */
const report = await importContainerList(
  owner,
  { baseUrl: provider, containerIds },
  {
    onOpened: ({ runId, landed, toAskFor }) => {
      console.log(`run ${runId}`);
      console.log(
        landed === 0
          ? `  ${toAskFor} Containers to import from ${provider}`
          : `  carrying on: ${landed} already landed, ${toAskFor} to ask for`,
      );
    },
    /*
     * A LINE PER CONTAINER, AS IT HAPPENS. The corpus is 465 Containers and
     * about eleven minutes (ADR-0137), so a command that printed only at the
     * end would be a command nobody could tell from a hung one -- eleven
     * minutes of silence is well past where a person starts pressing ^C.
     */
    onStepped: (step) => {
      const done = containerIds.length - step.remaining;
      const where = `[${done}/${containerIds.length}] ${step.containerId}`;
      const quarantined = (count: number) => (count > 0 ? `, ${count} quarantined` : "");
      switch (step.answer) {
        case "landed":
          return console.log(
            `${where}: ${step.placements} placements${quarantined(step.quarantinedValues)}`,
          );
        // A BATCH IS A LINE TOO (CNCORE-373): an infobox of 23,653 pages is
        // ~1,500 of them, and a Container with no line until its last batch
        // would be as silent as a command that printed only at the end.
        case "batch":
          return console.log(
            `${where}: a batch of ${step.placements} placements${quarantined(step.quarantinedValues)}, more to come`,
          );
        case "stopped":
          return console.log(`${where}: STOPPED ${step.reason.text}`);
        case "refused":
          return console.log(`${where}: REFUSED (${step.reason.wrote}) ${step.reason.text}`);
      }
    },
  },
).catch((cause: unknown) => {
  if (cause instanceof ORPCError && cause.code === "BAD_REQUEST") {
    console.error(`${list}: ${cause.message}`);
    process.exit(1);
  }
  throw cause;
});

const landed = report.containers.filter((container) => container.outcome === "landed");
const refused = report.containers.filter((container) => container.outcome === "refused");
const minutes = ((Date.now() - began) / 60000).toFixed(1);

console.log(`\n${landed.length} landed, ${refused.length} refused, in ${minutes} minutes`);
for (const container of refused) {
  if (container.outcome === "refused") {
    console.log(`  ${container.containerId}: (${container.reason.wrote}) ${container.reason.text}`);
  }
}
// WHAT IS STILL PENDING IS NOT NOTHING: a run that was interrupted leaves them,
// and the same command carries on from there rather than from the beginning.
const pending = report.containers.filter((container) => container.outcome === "pending").length;
if (pending > 0) console.log(`  ${pending} never asked for; run this again to carry on`);

process.exit(refused.length === 0 ? 0 : 1);
