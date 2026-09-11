import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { serverSchema } from "./schema";

export const env = createEnv({
  server: serverSchema,
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
