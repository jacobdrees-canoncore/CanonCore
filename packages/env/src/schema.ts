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
  /**
   * HOW MANY CONNECTIONS THIS PROCESS MAY HOLD OPEN (ADR-0104, CNCORE-137).
   *
   * ONE POSTGRES SERVES EVERY WORKTREE, so a pool is spent from a budget the
   * neighbours are drawing on rather than from one this process owns. That is
   * what makes the size a DEPLOYMENT'S to state: a self-hoster pointing
   * CanonCore at a database shared with something else has a ceiling nothing
   * here can read.
   *
   * TEN IS node-postgres's OWN DEFAULT (node-postgres.com/apis/pool, read
   * 2026-09-13), so an installation that sets nothing keeps precisely the pool
   * it had before this variable existed. The variable buys the ability to say
   * otherwise; it changes nothing by arriving.
   *
   * THE E2E SUITE IS THE DEPLOYMENT THAT SAYS OTHERWISE, and it is why this
   * exists at all: it stands up TEN CanonCore servers against one container,
   * where ten default pools spend the whole budget on their own and leave the
   * next worktree's suite to fail with `sorry, too many clients already`.
   * `apps/web/e2e/instance.ts` sets its measured peak instead. The number is
   * not lowered HERE because that peak is taken from servers each running one
   * test file SEQUENTIALLY, which is not what an instance serving concurrent
   * readers does.
   *
   * COERCED, because an environment holds text and nothing else. A POSITIVE
   * INTEGER, because a pool of none is not a small pool: it is a process that
   * reaches its database never, and does it at the first query rather than at
   * startup where somebody would see it.
   */
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().default(10),
};
