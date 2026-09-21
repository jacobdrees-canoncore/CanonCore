/**
 * WHAT `refusal` WILL AND WILL NOT CALL A REFUSAL (CNCORE-280).
 *
 * `constraints.test.ts` asserts the RULES; this asserts the helper those
 * assertions are made THROUGH, and the one distinction it has to keep: a
 * database that refused a write, against a database that could not serve it.
 * The second is a condition of a server every worktree shares (ADR-0104) and
 * says nothing about any rule, so it has to arrive as itself rather than in the
 * position where a caller reads a constraint's name.
 *
 * THE ERRORS ARE THE SERVER'S OWN rather than hand-made objects. What is under
 * test is the shape PostgreSQL and node-postgres actually produce, and a
 * fixture error would assert only that the classifier agrees with whoever wrote
 * the fixture.
 *
 * NOTHING HERE WRITES A ROW, AND NOTHING HERE KEEPS A CONNECTION. Every
 * statement below is refused or unreachable, which is what lets this file sit in
 * the shared catalogue these suites run against without being part of any other
 * file's fixture (CNCORE-199); every pool it opens is closed in `finally`, which
 * is what keeps it off the budget ADR-0104 shares out.
 */
import { sql } from "drizzle-orm";
import { expect, inject, it } from "vitest";

import { createDb, items } from "../index";
import { connect, refusal, theOwner } from "./catalogue";

it("refuses to answer for a server that could not run the statement", async () => {
  // ONE CONNECTION, so the timeout set below is the one the next statement
  // meets: `set` is a session setting and a pool hands out whichever session
  // is free.
  const db = createDb(inject("databaseUrl"), { maxConnections: 1 });
  try {
    await db.execute(sql`set statement_timeout = 1`);

    await expect(refusal(db.execute(sql`select pg_sleep(1)`))).rejects.toThrow(
      /failed to serve it: SQLSTATE 57014, canceling statement due to statement timeout/,
    );
  } finally {
    // CLOSED IN `finally`, as `by-hand.test.ts` and `statements.test.ts` close
    // theirs. A record arguing that every worktree shares one server is the
    // last place to leave a handle on it -- and this pool's session is holding
    // a one-millisecond `statement_timeout`.
    await db.$client.end();
  }
});

it("refuses to answer for a server it could not reach at all", async () => {
  const nowhere = createDb("postgresql://postgres:password@127.0.0.1:1/nothing");
  try {
    await expect(refusal(nowhere.execute(sql`select 1`))).rejects.toThrow(
      /failed to serve it: error code ECONNREFUSED/,
    );
  } finally {
    await nowhere.$client.end();
  }
});

it("answers with the constraint name whichever integrity rule refused the write", async () => {
  const db = await connect();
  const ownerId = await theOwner(db);

  // A CHECK (23514) and a FOREIGN KEY (23503), which is why the classifier
  // reads the CLASS rather than a list of codes. Neither write lands a row.
  expect(await refusal(db.insert(items).values({ ownerId, kind: "work", isOrdered: true }))).toBe(
    "items_ordered_implies_container",
  );
  expect(await refusal(db.insert(items).values({ ownerId, kind: "episode" }))).toBe(
    "items_kind_item_kinds_kind_fk",
  );
});
