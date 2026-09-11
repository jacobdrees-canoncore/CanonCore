import { z } from "zod";

/**
 * Every environment variable the server reads, as a plain object of fields.
 *
 * SEPARATE FROM `server.ts` SO IT CAN BE READ WITHOUT BEING APPLIED. That file
 * imports `dotenv/config` and calls `createEnv`, so importing it VALIDATES the
 * ambient environment and throws when `DATABASE_URL` is absent -- which is
 * exactly what it is for, and exactly what a suite asking "which variables are
 * there" must not trigger. `createEnv` also keeps no readable copy of what it
 * was given: it returns the validated VALUES, so the schema is not recoverable
 * from its result.
 *
 * The install path's documents are held to this object (CNCORE-64):
 * `.env.example`, `compose.yaml` and `README.md` are checked against it by
 * `install-path.test.ts` rather than against a second list of names. A variable
 * added here is one those three have to account for, without anybody
 * remembering that they exist.
 */
export const serverSchema = {
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
};
