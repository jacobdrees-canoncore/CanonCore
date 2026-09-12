import { healthCheckResult } from "@canoncore/schemas";
import type { RouterClient } from "@orpc/server";

import { openProcedure } from "../index";
import { catalogue } from "./catalogue";
import { item } from "./item";
import { provider } from "./provider";
import { session } from "./session";

export const appRouter = {
  // .output() is what puts the response into the OpenAPI document the
  // catch-all route publishes, and what makes oRPC reject a handler that stops
  // answering what the contract promises.
  healthCheck: openProcedure.output(healthCheckResult).handler(() => "OK" as const),
  catalogue,
  item,
  provider,
  session,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
