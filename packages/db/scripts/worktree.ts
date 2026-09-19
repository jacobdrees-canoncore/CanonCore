/**
 * What a `db:*` script needs to know about the worktree it runs in that only a
 * running process knows: the server, the branch, and the app's `.env`. Shared
 * by `setup.ts` and `restore.ts`, which both act on the worktree's OWN database
 * and must not disagree about which server that is on.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// CANONCORE_DB_PORT is a SHELL variable, not an apps/web/.env one: Compose
// reads the shell (or packages/db/.env) and would not see a value set only in
// the app's file, which is the same silent mismatch this whole change is about.
export const port = process.env.CANONCORE_DB_PORT ?? "55432";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error(`CANONCORE_DB_PORT is ${JSON.stringify(port)}, which is not a port.`);
  process.exit(1);
}
export const serverUrl = `postgresql://postgres:password@localhost:${port}/postgres`;
export const envFile = fileURLToPath(new URL("../../../apps/web/.env", import.meta.url));
export const repository = fileURLToPath(new URL("../../..", import.meta.url));

let current: string;
try {
  current = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
} catch (cause) {
  throw new Error("could not read the current branch; is this a git worktree?", { cause });
}

// A detached HEAD answers `HEAD`, which names no worktree and would put every
// detached checkout on one database.
if (current === "HEAD") {
  console.error("detached HEAD: check out a branch first, since the branch names the database.");
  process.exit(1);
}
export const branch = current;
