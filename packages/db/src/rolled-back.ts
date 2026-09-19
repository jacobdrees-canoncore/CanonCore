import type { Database } from "./index";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * The outcome, thrown rather than returned, so that the transaction which
 * produced it rolls back on the way out.
 *
 * Drizzle's `transaction` commits on a normal return and rolls back on ANY
 * throw, so throwing is how a preview declines the commit. It carries the
 * outcome because that is computed and then deliberately discarded along with
 * everything else, and `rollback()` -- the other way to refuse the commit --
 * has nowhere to put it.
 */
class RolledBack extends Error {
  constructor(readonly outcome: unknown) {
    super("A preview, rolled back");
    this.name = "RolledBack";
  }
}

/**
 * What a write WOULD answer, found by running it and rolling it back: the
 * mechanism behind ADR-0046's counts shown first, for the purge and for
 * deleting a Group.
 *
 * THE WRITE ITSELF, NOT A DESCRIPTION OF IT, so a preview cannot drift from the
 * delete it precedes -- there is no second set of predicates to keep in step.
 * What it costs is the write's own work and locks for as long as it runs, and
 * any `change_sequence` values its updates take: a sequence is outside the
 * transaction, so the rollback leaves those gaps behind (ADR-0040 needs the
 * sequence's order, not its density). "Changes nothing" is a claim about ROWS.
 */
export async function rolledBack<T>(
  db: Database,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> {
  try {
    return await db.transaction(async (tx) => {
      throw new RolledBack(await work(tx));
    });
  } catch (error) {
    // `work` is the only thing that constructs one, so its outcome is a `T`.
    if (error instanceof RolledBack) return error.outcome as T;
    throw error;
  }
}
