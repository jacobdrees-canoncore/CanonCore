/**
 * Drops the databases a removed worktree left in the shared container.
 *
 *   pnpm db:drop-worktree <branch>
 *
 * THE DISPATCHER RUNS IT, straight after `orca worktree rm`, naming the branch
 * the removed worktree had checked out (ADR-0191). `orca worktree rm` takes
 * the files and nothing else, and `db:setup`'s sweep spares anything younger
 * than an hour, which a worktree's test databases usually are when its PR merges.
 *
 * A thin CLI over `dropRemovedWorktree`, which is where the behaviour lives and
 * where the suite reaches it.
 */
import { DropRefused, dropRemovedWorktree } from "../src/sweep.ts";
import { repository, serverUrl } from "./worktree.ts";

// ONE BRANCH A CALL, because a refusal halfway through a list would leave
// the branches before it dropped and the ones after it standing.
const [branch, ...rest] = process.argv.slice(2);
if (branch === undefined || rest.length > 0) {
  console.error("usage: pnpm db:drop-worktree <branch>, the branch of one removed worktree.");
  process.exit(1);
}

// A REFUSAL IS A SENTENCE, NOT A CRASH (ADR-0191): run before `orca worktree
// rm`, nothing is wrong but the order. Anything else is a fault, and keeps its
// stack trace.
const swept = await dropRemovedWorktree({ serverUrl, repository, branch }).catch(
  (cause: unknown) => {
    if (!(cause instanceof DropRefused)) throw cause;
    console.error(cause.message);
    process.exit(1);
  },
);
console.log(`${branch}  dropped ${swept.dropped.length}`);
for (const database of swept.dropped) console.log(`          ${database}`);
for (const database of swept.inUse) {
  console.log(`          left ${database}: something is connected to it`);
}
