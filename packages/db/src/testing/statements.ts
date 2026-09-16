import { Client } from "pg";

/**
 * WHAT A PIECE OF WORK COSTS THE DATABASE, COUNTED RATHER THAN REASONED ABOUT
 * (CNCORE-176).
 *
 * An Item page used to read its Item TWICE -- once for `generateMetadata` and
 * once for the page -- and nothing in the repository could see it. The suites
 * read served markup, and markup is identical either way: the second read
 * answers exactly what the first one did, so the page rendered correctly and
 * cost double. A defect invisible to every test is one that comes back, so the
 * fix is worth less than the instrument that catches it doing so.
 *
 * IT COUNTS TRANSACTIONS, WHICH ON A READ PATH IS ONE PER STATEMENT. Every
 * query these handlers issue arrives on its own implicit transaction, because
 * nothing in the read path opens one -- so a committed transaction here IS a
 * statement. That equivalence is what makes the figure readable, and it would
 * end the day a read path wrapped itself in `db.transaction`: the count would
 * then report one where the server ran several, UNDER-reporting a regression
 * rather than over-reporting it. Said out loud because a caller reading "6"
 * will take it for six statements, which today it is.
 *
 * ROLLED-BACK TRANSACTIONS ARE COUNTED TOO. A statement that raised is a
 * statement the server ran and paid for, and leaving it out would let a page
 * that read twice and failed the second read report the cost of reading once.
 *
 * IT IS ONLY TRUE OF A DATABASE NOTHING ELSE IS TALKING TO, which is why
 * `TEST_DATABASE_SUFFIXES` carries `cost`. `pg_stat_database` counts a whole
 * database rather than one request, so a second reader lands in the middle of
 * the measurement and cannot be told from the work under test.
 */
export async function statementsWhile(
  databaseUrl: string,
  /**
   * THE WORK, AND IT MUST END WITH EVERY CONNECTION IT OPENED CLOSED -- so a
   * caller that starts a server stops it again. That is a real constraint rather
   * than tidiness, and the docblock on `whenNothingIsConnected` below is why: an
   * OPEN connection has not published what it did, so a count taken over one is
   * a count of whatever happened to have been flushed.
   */
  doing: () => Promise<unknown>,
): Promise<number> {
  const counter = await aCounterOn(databaseUrl);
  try {
    await counter.whenNothingIsConnected();
    const before = await counter.reading();
    await doing();
    await counter.whenNothingIsConnected();
    const after = await counter.reading();
    /*
     * THE CONNECTIONS ARE PART OF THE ARITHMETIC, WHICH IS THE ONE THING HERE
     * THAT IS NOT OBVIOUS. A session is worth exactly one transaction on top of
     * the statements it carried -- MEASURED on PostgreSQL 18.6, 2026-09-15: a
     * pool that connects and asks NOTHING moves the transaction counter by one
     * per connection; six statements over one connection move it by seven; six
     * at once over a pool of four move it by ten, against four sessions. So the
     * sessions opened inside the window are subtracted and the answer is
     * statements alone, whatever pool size the work happened to use.
     */
    return after.transactions - before.transactions - (after.sessions - before.sessions);
  } finally {
    await counter.close();
  }
}

/**
 * The counter connects to `postgres`, NOT to the database it is counting, and
 * that is what makes the arithmetic clean rather than nearly clean. A handle on
 * the measured database would be one more session and one more transaction per
 * reading it took, and it would never be closed inside the window, so it would
 * never publish them. Counted from outside, the delta is the work's alone.
 *
 * `postgres` is the same administrative database `buildTestDatabase` drops and
 * creates from, so this reaches for nothing that is not already reached for
 * here.
 */
async function aCounterOn(databaseUrl: string): Promise<{
  reading: () => Promise<Reading>;
  whenNothingIsConnected: () => Promise<void>;
  close: () => Promise<void>;
}> {
  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.slice(1));
  const admin = new URL(url);
  admin.pathname = "/postgres";

  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  return {
    reading: () => reading(client, database),
    whenNothingIsConnected: () => whenNothingIsConnected(client, database),
    close: () => client.end(),
  };
}

/**
 * How long a database is given to have nobody on it before that is a failure.
 *
 * TEN SECONDS IS A SHUTDOWN'S WORTH RATHER THAN A GUESS: what the callers wait
 * for is a `next start` exiting on SIGTERM, and what they meet if they wrote the
 * window wrong is this refusal. It is also how long that mistake COSTS, which is
 * why it is not a minute.
 */
const EMPTIES_WITHIN_MS = 10_000;

/**
 * Waits until nothing is connected to this database, because THAT is when its
 * statistics are true.
 *
 * A BACKEND DOES NOT PUBLISH WHAT IT DID AS IT GOES. It accumulates and flushes
 * on a schedule of its own, and it flushes everything on exit. MEASURED on
 * PostgreSQL 18.6, 2026-09-15: six statements issued over a connection that
 * STAYS OPEN moved the counter by three over the following eight and a half
 * seconds and by two more over the next twenty -- so a reading taken while a
 * server still holds its pool is a reading of whatever happened to have been
 * flushed, off by an amount nothing bounds. The same six over a connection that
 * CLOSED counted exactly.
 *
 * SO THE INSTRUMENT WAITS FOR AN EMPTY DATABASE RATHER THAN ENDING THE
 * CONNECTIONS ITSELF, and that is a decision rather than an oversight.
 * `pg_terminate_backend` would make the wait unnecessary and it CANNOT BE USED
 * ON A SERVER UNDER TEST: node-postgres re-emits an idle client's error on the
 * pool, and a pool with no `error` listener throws it as an uncaught exception
 * (`pg-pool@3.14.0`, `index.js:62`). Measured against a real `next start` on
 * 2026-09-15: `⨯ uncaughtException: terminating connection due to administrator
 * command`. An instrument that destabilises what it measures reports on
 * something else.
 */
async function whenNothingIsConnected(client: Client, database: string): Promise<void> {
  const deadline = Date.now() + EMPTIES_WITHIN_MS;
  while (Date.now() < deadline) {
    if ((await reading(client, database)).connected === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(
    `something was still connected to "${database}" after ${EMPTIES_WITHIN_MS}ms, so nothing ` +
      "here can say what the work cost. Either it left a connection open or something " +
      "other than the work under test is talking to this database.",
  );
}

interface Reading {
  /** Committed and rolled back, which on a read path is one per statement. */
  transactions: number;
  /** Cumulative, so two readings give the connections opened between them. */
  sessions: number;
  /** Connected right now, which is how "nothing has anything pending" is known. */
  connected: number;
}

async function reading(client: Client, database: string): Promise<Reading> {
  const { rows } = await client.query<Record<keyof Reading, string>>(
    `select xact_commit + xact_rollback as transactions, sessions, numbackends as connected
       from pg_stat_database where datname = $1`,
    [database],
  );
  const [row] = rows;
  if (!row) throw new Error(`no statistics for a database named "${database}"`);
  // These are `bigint`, which node-postgres hands over as strings because the
  // range does not fit a JavaScript number.
  return {
    transactions: Number(row.transactions),
    sessions: Number(row.sessions),
    connected: Number(row.connected),
  };
}
