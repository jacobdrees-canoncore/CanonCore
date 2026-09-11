import { beforeEach } from "vitest";

import { installNetworkGate } from "./network-gate";

/**
 * The side-effect module every suite lists in `setupFiles`. It runs once per
 * test FILE, in the worker that file runs in.
 *
 * INSTALLING IS A CALL AND NOT THIS FILE'S IMPORT. CNCORE-15 measured the
 * alternative: with the install at the top level of `network-gate.ts`, any test
 * importing anything from that file installed the gate too, so the test proving
 * the gate fires passed with the setup file removed.
 */
const restoreGate = installNetworkGate();

// AND PUT IT BACK BEFORE EACH TEST, because a test that swaps the global
// dispatcher would otherwise leave the gate off for every test after it in the
// same file (CNCORE-30).
beforeEach(restoreGate);
