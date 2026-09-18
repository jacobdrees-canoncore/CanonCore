import { join } from "node:path";
import { repoRoot } from "@canoncore/config/testing/repo-root";
import { describe, expect, it } from "vitest";

import { suiteDatabaseSuffixAt } from "./suite-database";

describe("the database a suite claims", () => {
  it("gives each suite sharing the harness a database of its own", () => {
    const claimed = ["packages/db", "packages/api", "packages/tasks"].map((directory) =>
      suiteDatabaseSuffixAt(join(repoRoot, directory)),
    );

    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it("refuses a package that has not claimed one, by name", () => {
    // `packages/providers` is a real package with a real suite and no database,
    // so it stands here for the one a later ticket wires into the shared global
    // setup without declaring anything -- which is the case that used to fall
    // through to the bare `<worktree>_test` and drop whatever was in it.
    expect(() => suiteDatabaseSuffixAt(join(repoRoot, "packages/providers"))).toThrow(
      /@canoncore\/providers/,
    );
  });
});
