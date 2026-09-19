import { defineConfig } from "vitest/config";

/**
 * THE PAGE IN A BROWSER: ADR-0103's sixth seam and the one it held in reserve.
 *
 * A PROJECT OF ITS OWN RATHER THAN MORE OF `e2e/` (CNCORE-73). The two suites
 * want opposite things from a harness. `e2e` stands up seven instances and two
 * providers so that many files can each assert against the state they need;
 * this one wants ONE instance and a browser -- an ordering to drag, and since
 * CNCORE-217 one Provider whose name has no break in it -- and it wants to fail
 * on its own so that the most brittle thing in the repository cannot redden the
 * check that says the app serves pages at all.
 *
 * NOT VITEST'S BROWSER MODE, and that is a decision rather than an omission.
 * Its `dragAndDrop` takes no `steps` and exposes no mouse API, so the drag it
 * performs is a single jump -- which a pointer sensor's activation constraint
 * routinely misses, passing having reordered nothing. It also declares
 * Playwright as a non-optional peer, so choosing it would not even save the
 * dependency. The `playwright` LIBRARY inside an ordinary Vitest file gives the
 * mouse, and `browser/reorder.test.ts` is where that matters.
 *
 * NOT PLAYWRIGHT'S OWN RUNNER EITHER. This repository runs one test runner
 * (ADR-0103), and a second one would mean a second config language, a second
 * reporter and a second place the network gate has to be wired.
 */
export default defineConfig({
  test: {
    include: ["browser/**/*.test.ts"],
    globalSetup: ["@canoncore/config/testing/gate-global-setup", "./browser/global-setup.ts"],
    /**
     * The gate, as every suite here declares it, and this is the one place it
     * is only HALF the control. It patches undici inside THIS process; a
     * browser is a subprocess of its own and makes its requests where nothing
     * here can see them. `browser/reorder.test.ts` gates that half with
     * Playwright's `context.route()`, which is the only thing that can.
     */
    setupFiles: ["@canoncore/config/testing/install-network-gate"],
    // A Next build, a server start, and a browser launch before the first
    // assertion.
    hookTimeout: 180_000,
  },
});
