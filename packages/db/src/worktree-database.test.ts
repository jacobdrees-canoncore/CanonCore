import { describe, expect, it } from "vitest";

import { testDatabaseNameFor } from "./testing/build-database";
import { worktreeDatabaseName } from "./worktree-database";

describe("worktreeDatabaseName", () => {
  it("names a database after the branch the worktree is on", () => {
    // The readable stem comes from the branch; the fingerprint is asserted by
    // SHAPE rather than by value, because writing the expected hash here would
    // mean recomputing it the way the code does and agreeing by construction.
    expect(worktreeDatabaseName("jacobdrees/cncore-4-item-on-a-page")).toMatch(
      /^canoncore_cncore_4_item_on_a_page_[0-9a-f]{8}$/,
    );
  });

  it("gives two SHORT branches two different databases", () => {
    // The first version fingerprinted only past the length limit, so every
    // short branch that normalised the same silently shared a database -- which
    // is the failure this module exists to end, left wide open in the common
    // case. Measured before the fix: `alice/fix` and `bob/fix` both gave
    // `canoncore_fix`, as did `feat/foo-bar` and `feat/foo_bar`.
    const collidingBefore = [
      ["alice/fix", "bob/fix"],
      ["feat/foo-bar", "feat/foo_bar"],
      ["feat/Foo-Bar", "feat/foo.bar"],
      ["wip", "someone/wip"],
    ] as const;

    for (const [first, second] of collidingBefore) {
      expect(worktreeDatabaseName(first)).not.toBe(worktreeDatabaseName(second));
    }
  });

  it("gives two long branches two different databases", () => {
    // The failure being fixed is two worktrees silently sharing one database.
    // PostgreSQL truncates an identifier at 63 bytes SILENTLY, so a derivation
    // that merely cuts would reintroduce it for any two branches with a common
    // prefix -- which is what branches on one project mostly are.
    const first = worktreeDatabaseName(`feat/${"a".repeat(80)}-one`);
    const second = worktreeDatabaseName(`feat/${"a".repeat(80)}-two`);

    expect(first).not.toBe(second);
    expect(first.length).toBeLessThanOrEqual(63);
  });

  it("leaves room for the names the test harness derives and DROPS", () => {
    // build-database.ts derives `<name>_test` and `<name>_test_web`, and drops
    // them with `drop database ... with (force)`. PostgreSQL truncates at 63
    // silently, so if a derived name truncated back onto the real one, running
    // the suite would destroy the worktree's own database.
    //
    // Asserted against what the harness actually appends, not against a
    // constant this module also owns -- otherwise the two would agree by
    // construction and never catch a change to either.
    const name = worktreeDatabaseName(`feat/${"a".repeat(200)}`);

    // Built by the HARNESS's own function, not by pasting its format here, so
    // that changing how a test database is named fails this instead of quietly
    // eating the room reserved for it.
    for (const suffix of ["", "web"]) {
      const derived = testDatabaseNameFor(name, suffix);
      expect(derived.length).toBeLessThanOrEqual(63);
      expect(derived.slice(0, 63)).not.toBe(name);
    }
  });

  it("refuses a branch it cannot name a database after", () => {
    // Detached HEAD gives `HEAD`; a ref that normalises to nothing would
    // otherwise silently produce the bare prefix, and every such worktree would
    // land on one database -- the failure this module exists to end.
    expect(() => worktreeDatabaseName("owner/---")).toThrow(/branch/i);
  });
});
