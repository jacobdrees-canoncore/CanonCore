import { createHash } from "node:crypto";

/** PostgreSQL truncates an identifier here, silently. */
const MAX_IDENTIFIER_BYTES = 63;

/**
 * The longest name anything DERIVES from this one, reserved so a derived name
 * can never truncate back onto the real database — `build-database.ts` drops
 * what it derives. Kept in step by `worktree-database.test.ts`, which builds
 * the derived names the way the harness builds them rather than trusting this
 * number.
 *
 * ELEVEN IS A BUDGET THE SUITES ARE HELD TO, rather than a measurement of them.
 * `_test_fresh`, `_test_paged` and `_test_still` each spend exactly it, and that
 * is the direction the constraint runs on purpose: WIDENING this number shortens
 * every stem, which renames the database of any worktree already past the new
 * limit and leaves its `.env` pointing at the one it had. A suffix that does not
 * fit gets shorter instead -- `_test_purgeable` was four characters over, and it
 * cost one existing worktree its whole e2e suite before anybody noticed.
 *
 * The thing at the other end of getting this wrong is
 * `drop database ... with (force)` against the worktree's own catalogue, which
 * is why `build-database.ts` refuses rather than truncates and why the test
 * holds every suffix to the budget rather than the two it started with.
 */
const LONGEST_DERIVED_SUFFIX = "_test_fresh".length;

/** `canoncore_` + stem + `_` + fingerprint, within the reserved budget. */
const FINGERPRINT_LENGTH = 8;
const PREFIX = "canoncore_";
const MAX_STEM =
  MAX_IDENTIFIER_BYTES - LONGEST_DERIVED_SUFFIX - PREFIX.length - FINGERPRINT_LENGTH - 1;

/**
 * One database per worktree, inside the one container every worktree shares.
 *
 * Every CanonCore worktree resolves the SAME Compose project, because
 * `name: canoncore` pins it and Compose resolves by name rather than by
 * directory. Sharing the container is fine and cheap. Sharing a DATABASE is
 * not: the harness drops and recreates `<database>_test`, so two worktrees
 * testing at once would take each other's out mid-run.
 *
 * THE NAME ALWAYS CARRIES A FINGERPRINT OF THE WHOLE BRANCH, not only when it
 * is too long. The readable stem is lossy on purpose — it strips the owner
 * segment, lowercases, and folds every run of punctuation to one underscore —
 * so on the stem alone `alice/fix` and `bob/fix` are one database, and so are
 * `feat/foo-bar` and `feat/foo_bar`. That is the exact failure this module
 * exists to end, and the first version of it left the common case wide open by
 * fingerprinting only past the length limit.
 *
 * The stem is for a human reading `\l`; the fingerprint is what makes the name
 * a function of the branch.
 */
export function worktreeDatabaseName(branch: string): string {
  const stem = branch
    // A branch is conventionally `owner/what-it-is`. The owner is the same for
    // every worktree here, so it costs length and reads as noise -- but drop it
    // from the STEM only, never from what is fingerprinted.
    .replace(/^[^/]+\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_STEM)
    .replace(/_+$/, "");

  if (stem === "") {
    throw new Error(
      `branch ${JSON.stringify(branch)} has no name a database could be called after`,
    );
  }

  // 8 hex characters of SHA-256 over the WHOLE branch, untouched by the
  // normalisation above -- which is what makes two branches sharing a stem two
  // databases.
  const fingerprint = createHash("sha256")
    .update(branch)
    .digest("hex")
    .slice(0, FINGERPRINT_LENGTH);
  return `${PREFIX}${stem}_${fingerprint}`;
}
