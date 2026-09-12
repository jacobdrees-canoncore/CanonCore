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
  /**
   * WHICH PROVIDERS THIS INSTANCE SEARCHES: their base URLs, separated by commas
   * or whitespace (ADR-0031, CNCORE-68).
   *
   * A SECOND VARIABLE RATHER THAN A READING OF THE ONE ABOVE, because the two
   * hold different things and neither can be derived from the other. The
   * allowlist holds HOSTS AND CIDRs -- `127.0.0.0/8` names a range with no
   * scheme and no port, so no provider URL can be recovered from it -- and this
   * holds the URLs themselves. They compose: a URL here is reached only if its
   * host is allowlisted above, which is the boundary doing its job rather than a
   * duplication.
   *
   * EMPTY BY DEFAULT, and a surface says so rather than showing an empty result,
   * which is ADR-0094's rule applied to the other half of the same first run.
   *
   * It is env rather than a settings table for the reason the allowlist is, and
   * moves into one on the same day: `parseProviderUrls` already takes a string
   * from wherever it comes.
   */
  PROVIDER_URLS: z.string().default(""),
  /**
   * THE OWNER'S ONE PASSWORD (ADR-0044, CNCORE-109). Everything that writes is
   * behind a session, and this is what a session is exchanged for.
   *
   * ABSENT MEANS NOBODY CAN LOG IN, and that is not a degraded state: it is
   * ADR-0044's public demo, which is read-only WITH NO LOGIN, reached by leaving
   * a variable unset rather than by a deployment flag or a mode. The read path
   * needs no session at all (ADR-0072), so an instance that sets none serves
   * every page it serves today and refuses every write.
   *
   * IT IS CONFIGURATION RATHER THAN A COLUMN, which keeps ADR-0044's "no
   * password column ships" true. The owner already holds this instance's other
   * secrets here -- the database's password is composed into `DATABASE_URL` --
   * and a password in the database would need a signup surface to set it, which
   * that record refuses in the same sentence.
   *
   * MINIMUM 12 CHARACTERS, so the one credential guarding the write path cannot
   * be set to something a stranger reaches by typing. It is not hashed at rest:
   * it sits in the owner's own `.env`, which is where `POSTGRES_PASSWORD` sits,
   * and hashing a value the same file holds in the clear protects nothing.
   */
  OWNER_PASSWORD: z.string().min(12).optional(),
};
