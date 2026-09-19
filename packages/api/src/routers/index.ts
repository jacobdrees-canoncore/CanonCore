import { healthCheckResult } from "@canoncore/schemas";
import type { RouterClient } from "@orpc/server";

import { openProcedure } from "../index";
import { catalogue } from "./catalogue";
import { group } from "./group";
import { item } from "./item";
import { placement } from "./placement";
import { provider } from "./provider";
import { session } from "./session";
import { settings } from "./settings";
import { task } from "./task";

export type { ReportedRun } from "./task";

export const appRouter = {
  // .output() is what puts the response into the OpenAPI document the
  // catch-all route publishes, and what makes oRPC reject a handler that stops
  // answering what the contract promises.
  healthCheck: openProcedure.output(healthCheckResult).handler(() => "OK" as const),
  catalogue,
  group,
  item,
  placement,
  provider,
  session,
  settings,
  task,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
