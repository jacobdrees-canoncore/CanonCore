import { describe, expect, it } from "vitest";

import {
  SUITE_DATABASE_SUFFIXES,
  TEST_DATABASE_SUFFIXES,
  testDatabaseNameFor,
} from "./testing/build-database";
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
    // build-database.ts derives `<name>_test` and one database per suffix any
    // suite passes it, and drops them with `drop database ... with (force)`.
    // PostgreSQL truncates at 63 silently, so if a derived name truncated back
    // onto the real one, running the suite would destroy the worktree's own
    // database.
    //
    // Asserted against what the harness actually appends, not against a
    // constant this module also owns -- otherwise the two would agree by
    // construction and never catch a change to either.
    //
    // EVERY SUFFIX THE HARNESS WILL ACCEPT, which is the part that drifted and
    // is now the part that cannot. This read a list of its own -- three, while
    // the web suite passed five -- and one of the two it was missing did not
    // fit, so a worktree whose branch stem ran to the limit could not run
    // `pnpm test:e2e` at all. The list is gone: `buildTestDatabase` takes a
    // DECLARED suffix, so the set below is the set the harness has, rather than
    // one more copy of it that a sixth call site could leave behind.
    //
    // WHY THE UNION IS LOAD-BEARING AND NOT TIDINESS, which matters because the
    // obvious simplification is to widen the parameter back to `string`. While
    // it was `string` this assertion had no finite set to range over, so "every
    // suffix the harness accepts fits the budget" could not be written down, let
    // alone fail -- and that is exactly how this test stayed green through the
    // whole period the bug shipped. The type is what makes the sentence below
    // falsifiable; widening it does not weaken this test, it un-writes it.
    const name = worktreeDatabaseName(`feat/${"a".repeat(200)}`);

    // Built by the HARNESS's own function, not by pasting its format here, so
    // that changing how a test database is named fails this instead of quietly
    // eating the room reserved for it.
    for (const suffix of TEST_DATABASE_SUFFIXES) {
      const derived = testDatabaseNameFor(name, suffix);
      expect(derived.length).toBeLessThanOrEqual(63);
      expect(derived.slice(0, 63)).not.toBe(name);
    }
  });

  it("leaves room for the name a SUITE derives, which is one `_test` further out", () => {
    // THE DERIVATION HAPPENS TWICE AND THE TEST ABOVE MODELS IT ONCE, which is
    // how a budget that is exactly right stayed exactly wrong for every long
    // branch (CNCORE-150).
    //
    // `global-setup.ts` builds `<worktree>_test` and `testing/setup.ts` points
    // DATABASE_URL AT IT, so that the suite's own `createContext` reads the test
    // database out of the environment like the app does (ADR-0103). A file that
    // then asks for a second database -- `catalogue.test.ts` does, for a
    // catalogue with no untitled item in it -- is deriving from the run's
    // database rather than from the worktree's, and gets one more `_test` than
    // anybody budgeted for.
    //
    // Measured across every pushed branch on 2026-09-13, before the fix: 11 of
    // 72 derived a name that broke, each of them at the 52-byte cap and so at
    // `<52>_test_test_fresh` = 68. It is LOCAL-ONLY -- CI names its database
    // `canoncore`, so the branch never enters the arithmetic and this never
    // went red there.
    // AND THE RUN'S DATABASE IS NO LONGER ONE NAME (CNCORE-199). `global-setup.ts`
    // builds the suffix the RUNNING PACKAGE claims, so `<worktree>_test` is now
    // `packages/db`'s alone and the other suites run against siblings of it.
    // Ranging over the claims rather than over the bare one is what keeps this
    // modelling the two steps the harness actually takes -- a loop over a single
    // `testDatabaseNameFor(name)` would have gone on asserting about a database
    // two of the three suites no longer use.
    const name = worktreeDatabaseName(`feat/${"a".repeat(200)}`);

    for (const claimed of Object.values(SUITE_DATABASE_SUFFIXES)) {
      // The two steps, each taken by the harness's own function rather than by
      // pasting its format here: what `global-setup.ts` builds, and then what a
      // worker derives once `setup.ts` has repointed the variable at it.
      const run = testDatabaseNameFor(name, claimed);

      for (const suffix of TEST_DATABASE_SUFFIXES) {
        const derived = testDatabaseNameFor(run, suffix);
        expect(derived.length).toBeLessThanOrEqual(63);
        // THE PROPERTY, rather than the byte count that follows from it: deriving
        // from the RUN's database and deriving from the WORKTREE's land on one
        // name. The test above already holds the one-step side to the budget, so
        // this equality is what carries the two-step side there with it, and it
        // is the assertion that goes red the moment a second `_test` comes back.
        expect(derived, `from ${run}`).toBe(testDatabaseNameFor(name, suffix));
      }
    }
  });

  it("hands back the run's OWN database when a suite asks from inside it", () => {
    // THE EDGE THE RECOVERY ABOVE CREATES, pinned rather than left to be
    // discovered. Naming from the worktree database makes the derivation
    // idempotent, so `buildSuiteDatabase(suffix)` called from a WORKER
    // resolves to the very database that worker is running against, rather than
    // to the `<worktree>_test_test` it used to build quietly.
    //
    // IT SAID `buildTestDatabase()` -- NO SUFFIX -- UNTIL CNCORE-246. CNCORE-199
    // took the default off both builders and gave a suite's own database its own
    // verb, so that call has not type-checked since and the suffix is always
    // named now. ADR-0104 says so in one place and said the opposite in two
    // others, which is the defect this ticket is about.
    //
    // That is the safer of the two and still not safe on its own, because what
    // `buildSuiteDatabase` does next is `drop database ... with (force)`. The
    // name being EQUAL is what its own `name === database` guard refuses on, so
    // this asserts the equality that guard depends on.
    const name = worktreeDatabaseName("jacobdrees/cncore-150-db-name-length");

    for (const claimed of Object.values(SUITE_DATABASE_SUFFIXES)) {
      const run = testDatabaseNameFor(name, claimed);

      expect(testDatabaseNameFor(run, claimed)).toBe(run);

      // And a SUFFIX asked for from inside the run is still the worktree's
      // sibling, never a second generation below it.
      expect(testDatabaseNameFor(run, "gone"), `from ${run}`).toBe(`${name}_test_gone`);
    }
  });

  it("refuses a branch it cannot name a database after", () => {
    // Detached HEAD gives `HEAD`; a ref that normalises to nothing would
    // otherwise silently produce the bare prefix, and every such worktree would
    // land on one database -- the failure this module exists to end.
    expect(() => worktreeDatabaseName("owner/---")).toThrow(/branch/i);
  });
});
