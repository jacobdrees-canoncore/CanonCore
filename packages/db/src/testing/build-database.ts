import { Client } from "pg";

import "../load-env";
import { migrateToHead } from "../migrate";

/**
 * EVERY SUFFIX ANY SUITE MAY ASK FOR, and the only place one is written down.
 *
 * `buildTestDatabase` takes a member of this and nothing else, so a suite that
 * wants one more database adds it HERE or does not compile. That is the whole of
 * what CNCORE-112 fixed: the set used to be string literals at the call sites
 * with a hand-written copy in `worktree-database.test.ts` -- three places and
 * nothing holding them together, so the copy read three while the web suite
 * passed five, and one of the missing two did not fit the budget below.
 *
 * `""` IS A MEMBER RATHER THAN AN ABSENCE. `packages/db`'s own suite takes the
 * bare `<database>_test`, so "no suffix" is a declared value that gets held to
 * the budget like any other, rather than a case the union quietly excludes.
 *
 * `gone` IS THE ONE MEMBER `packages/db` ASKS FOR ON TOP OF THE BARE ONE, and
 * it is here because what it holds is a property of a WHOLE CATALOGUE rather
 * than of a query: "no untitled item anywhere" cannot be arranged by a WHERE
 * over the shared database, only by building one from empty (CNCORE-110). A
 * suffix earns its place by that test -- a suite that could have narrowed
 * instead does not need a database.
 *
 * THE BUDGET IS ELEVEN CHARACTERS, set by `LONGEST_DERIVED_SUFFIX` in
 * `worktree-database.ts` and deliberately NOT derived from this list -- that
 * file says what derives it wrong. `worktree-database.test.ts` is what holds
 * every member here to it.
 */
export const TEST_DATABASE_SUFFIXES = [
  "",
  "web",
  "fresh",
  "paged",
  "purge",
  "still",
  "gone",
  "edit",
  "place",
  /*
   * A REORDER CHANGES THE ORDERING IT IS ASSERTED AGAINST, so the two suites
   * that reorder cannot share one instance with anything -- `place` included,
   * whose file asserts a container's rows by position. `order` is the
   * script-less path at the page seam and `drag` is the browser suite
   * (CNCORE-73), and they are two rather than one because they run as two
   * Vitest projects in two CI jobs, each standing up its own server.
   */
  "order",
  "drag",
  /*
   * THE ONE WHOSE CONFIGURATION A TEST WRITES (CNCORE-99). The settings surface
   * changes what an instance REACHES, and every other instance here is
   * somebody's fixture -- three of them assert on which providers are
   * configured. A suite that edited one of those would be CNCORE-93's shape
   * exactly: an assertion reading shared state across a write it does not own.
   *
   * FOUR CHARACTERS BECAUSE THE BUDGET IS ELEVEN, and `_test_config` is twelve.
   * `worktree-database.ts` says why the constant leads and the suffix gives way.
   */
  "conf",
  /*
   * AN EMPTY CATALOGUE THAT IS NOT AN UNCONFIGURED ONE (CNCORE-131). Every
   * other instance a test may READ is empty AND unconfigured or neither, so the
   * two facts move together and no assertion made on one of them can tell them
   * apart. `conf` above starts empty as well and is not the one to borrow: its
   * configuration is what another suite writes. The front page reads the two as
   * two conditions off two facts, and this is the combination that proves it:
   * an owner who allowlisted something and still has nothing.
   *
   * `_test_allow` IS ELEVEN CHARACTERS, WHICH IS THE BUDGET EXACTLY:
   * `LONGEST_DERIVED_SUFFIX` is `_test_fresh`, and this one is the same length.
   */
  "allow",
  /*
   * THE ONE BUILT ON AN OLDER LADDER AND THEN UPGRADED (CNCORE-173). A rung that
   * BACKFILLS existing rows cannot be asserted from empty -- from empty there is
   * nothing to fill -- so `sort-name.test.ts` builds this one to the rung BEFORE
   * the head, writes a catalogue into it, and then migrates. It is its own
   * database for the reason every suffix here is: what it holds is a property of
   * a WHOLE CATALOGUE at a particular ladder position, which no `WHERE` over the
   * shared database can arrange.
   *
   * `_test_rung` IS TEN CHARACTERS, inside the eleven `worktree-database.ts`
   * budgets for.
   */
  "rung",
  /*
   * THE ONE NOBODY ELSE MAY TALK TO WHILE A COUNT IS RUNNING (CNCORE-176). What
   * an Item page COSTS is read off `pg_stat_database`, which counts a whole
   * database rather than one request -- so a second suite fetching a page from
   * the same instance lands in the middle of the measurement and is
   * indistinguishable from the page under test. Vitest runs these files in
   * parallel, so quiet is not something a `WHERE` can arrange: it is a property
   * of the whole database, which is exactly what this list says a suffix is
   * for.
   *
   * `_test_cost` IS TEN CHARACTERS, inside the eleven `worktree-database.ts`
   * budgets for.
   */
  "cost",
] as const;

/** A suffix this repo has declared, which is the only kind there is. */
export type TestDatabaseSuffix = (typeof TEST_DATABASE_SUFFIXES)[number];

/**
 * Builds a database FROM EMPTY and runs the whole ladder against it.
 *
 * Deliberately the same path CI's empty-to-head gate takes (ADR-0047), so the
 * gate and the suites cannot disagree about whether the ladder composes.
 *
 * KNOW WHAT EMPTY-TO-HEAD DOES NOT PROVE. Against an empty database Drizzle
 * applies every rung regardless of the high-water mark it uses on a populated
 * one, so this path goes green on a spliced migration that a real upgrade would
 * silently skip. `scripts/check-ladder.ts` covers that; this covers whether the
 * SQL is valid at all.
 *
 * `folder` IS WHAT LETS A TEST BUILD AN OLDER INSTALL AND UPGRADE IT (CNCORE-173).
 * It is `migrateToHead`'s own parameter, passed through rather than invented:
 * that function already takes a folder "so CI can apply the BASE BRANCH's
 * ladder to a database and then this branch's on top of it -- which is the
 * upgrade path a real installation takes", and a suite asking the same question
 * had no way to reach it. A rung that BACKFILLS is invisible from empty, because
 * from empty there is nothing to fill: every row is written after the rung and
 * gets its value from whatever the rung installed. The default is unchanged, so
 * every existing caller still builds straight to head.
 */
export async function buildTestDatabase(
  suffix: TestDatabaseSuffix = "",
  folder?: string,
): Promise<string> {
  const url = new URL(requireDatabaseUrl());
  const name = testDatabaseName(url, suffix);

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    // FORCE so a leftover connection from a killed run cannot wedge the suite.
    await client.query(`drop database if exists ${quote(name)} with (force)`);
    await client.query(`create database ${quote(name)}`);
  } finally {
    await client.end();
  }

  const built = new URL(url);
  built.pathname = `/${name}`;
  await migrateToHead(built.toString(), folder);
  return built.toString();
}

/** What `testDatabaseNameFor` appends, and so what it strips to find the root. */
const MARKER = "_test";

/**
 * How a test database is named FROM THE WORKTREE'S OWN DATABASE. THE one place
 * that knows, so `worktreeDatabaseName`'s reservation and this cannot drift on
 * FORMAT -- and `TEST_DATABASE_SUFFIXES` is what stops the SET drifting, which
 * is the half that did. A suite can no longer reach this with a suffix nobody
 * measured: there is no `buildTestDatabase("something-longer")` to write.
 *
 * IT TAKES THE WORKTREE DATABASE, AND ONE CALLER HANDED IT SOMETHING ELSE.
 * That first sentence is the contract and `buildTestDatabase` broke it, because
 * what it reads is DATABASE_URL and `testing/setup.ts` repoints that at the
 * `<worktree>_test` this function just built -- deliberately, so a suite builds
 * its context with the real `createContext` (ADR-0103). A file asking for a
 * second database was therefore deriving from the RUN's database rather than
 * from the worktree's, and got `<worktree>_test_test_<suffix>`: one whole
 * `_test` past anything ADR-0104 budgeted for, that record's own format being
 * `<name>_test` plus a SIBLING per suffix.
 *
 * So the family root is recovered rather than assumed. `_test` is this
 * function's own marker, and for every database this repo NAMES ITSELF the
 * strip cannot misfire: `worktreeDatabaseName` ends each one in eight hex
 * characters and CI names its database `canoncore`, so none of them ends in
 * `_test` to begin with. THAT GUARANTEE STOPS AT A HAND-SET DATABASE_URL, which
 * may name anything a developer likes. Point it at `myapp_test` and the family
 * becomes `myapp_test`, `myapp_test_web` and so on, rather than a generation
 * below it -- the harness still only ever drops names it derived, but WHICH
 * names those are moved with this change.
 *
 * AND THE NAMING IS NOW TOTAL WHERE IT USED TO GROW. Before the strip, a
 * derived name was always longer than its input, so it could never BE its
 * input; it can now, and `testDatabaseNameFor(x_test)` is `x_test`. That is
 * deliberate -- it is what makes the derivation agree from either end -- but it
 * means this function alone is no longer proof that a caller is about to touch
 * a database it owns. NEITHER GUARD LIVES HERE: the 63-byte refusal and the
 * `name === database` refusal are both in `testDatabaseName` below, at the
 * point of DESTRUCTION rather than the point of naming, which is where they
 * belong and where `buildTestDatabase` passes through them. A caller reaching
 * for this export to name something it then DROPS must take that route.
 *
 * THE BUDGET DID NOT MOVE, AND THAT IS THE POINT (CNCORE-150). Widening
 * `LONGEST_DERIVED_SUFFIX` to cover the doubled tail was the obvious reading
 * and is the one thing ADR-0104 forbids -- it shortens every stem and so
 * RENAMES the database of any worktree already past the new limit, leaving its
 * `.env` pointing at the one it had. Eleven was never too small; it was TRUE
 * for the format the records describe and a lie only because the tail went on
 * twice. The worst branch now lands on 63 exactly, and no existing worktree is
 * renamed.
 */
export function testDatabaseNameFor(database: string, suffix: TestDatabaseSuffix = ""): string {
  const worktree = database.endsWith(MARKER) ? database.slice(0, -MARKER.length) : database;
  return `${worktree}${MARKER}${suffix ? `_${suffix}` : ""}`;
}

/**
 * `<database>_test`, or `<database>_test_<suffix>`, for the database a URL names.
 *
 * REFUSES rather than truncates, and that is the whole point of it. PostgreSQL
 * silently cuts an identifier at 63 bytes, so a database named at 58 characters
 * or more would have its `_test` suffix cut back off -- and what
 * `buildTestDatabase` does with the name this returns is
 * `drop database ... with (force)`. Truncation here destroys the developer's
 * real catalogue, silently, on a test run.
 *
 * The pathname is percent-DECODED first, because a URL carries it encoded and
 * `%20` is not the database's name.
 */
function testDatabaseName(url: URL, suffix: TestDatabaseSuffix): string {
  const database = decodeURIComponent(url.pathname.slice(1));
  const name = testDatabaseNameFor(database, suffix);
  if (Buffer.byteLength(name, "utf8") > 63) {
    throw new Error(
      `the test database would be named "${name}", which PostgreSQL truncates at 63 bytes -- ` +
        `back onto "${database}" itself, which this file then drops. ` +
        `Point DATABASE_URL at a database with a shorter name.`,
    );
  }
  if (name === database) {
    throw new Error(`refusing to use the target database "${database}" as its own test database`);
  }
  return name;
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. These suites need a real PostgreSQL server: " +
        "`pnpm db:start`, or point DATABASE_URL at one you already run.",
    );
  }
  return url;
}

/** Database names are identifiers, not parameters, so they cannot be bound. */
function quote(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
