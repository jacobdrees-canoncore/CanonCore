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
