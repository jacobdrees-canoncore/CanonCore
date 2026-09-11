import { healthCheckResult } from "@canoncore/schemas";
import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { item } from "./item";
import { provider } from "./provider";

export const appRouter = {
  // .output() is what puts the response into the OpenAPI document the
  // catch-all route publishes, and what makes oRPC reject a handler that stops
  // answering what the contract promises.
  healthCheck: publicProcedure.output(healthCheckResult).handler(() => "OK" as const),
  item,
  provider,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
