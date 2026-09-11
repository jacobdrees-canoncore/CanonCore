import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    /**
     * ADR-0034's ALLOWLIST: the exact hosts and CIDRs a provider base URL may
     * name, separated by commas or whitespace.
     *
     * EMPTY BY DEFAULT, WHICH REFUSES EVERY PROVIDER. That is the safe end of
     * the failure: an instance that has not been configured reaches nothing,
     * rather than reaching whatever a response happens to name. A provider on a
     * private network -- loopback, a tailnet -- becomes legal by being written
     * here BY NAME, which is the whole reason the config boundary is an
     * allowlist and not an exception carved into the content deny rule.
     *
     * It is env rather than a settings table because there is no settings table
     * yet. When there is one, this moves into it and the boundary does not
     * change: `parseAllowlist` already takes a string from wherever it comes.
     */
    PROVIDER_ALLOWLIST: z.string().default(""),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
