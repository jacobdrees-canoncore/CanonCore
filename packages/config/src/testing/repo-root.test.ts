import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./repo-root";

/**
 * The one assertion that the depth in `repo-root.ts` is right.
 *
 * Checked against GIT rather than against a second copy of `../../../../`,
 * which would only restate the thing under test and pass by construction
 * wherever it was wrong. WHY the depth needs pinning is in `repo-root.ts`,
 * beside the expression it pins, rather than restated here.
 *
 * Without this, a wrong depth surfaces in whichever suite first fails to read a
 * file, naming the file and not the reason.
 */
describe("the repository root", () => {
  it("is the directory git reports as the top level", () => {
    const here = fileURLToPath(new URL(".", import.meta.url));
    const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: here,
      encoding: "utf8",
    });

    // Vacuous otherwise: a git that failed to run leaves an empty stdout, which
    // a repoRoot of "" would match.
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).not.toBe("");

    expect(repoRoot).toBe(result.stdout.trim());
  });
});
