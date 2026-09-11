import { installNetworkGate } from "./network-gate";

/**
 * The gate, for the MAIN PROCESS -- listed first in a suite's `globalSetup`.
 *
 * WHY A SECOND ENTRY POINT AT ALL. `setupFiles` run in each test WORKER; a
 * global setup runs in Vitest's main process, before any worker exists. So the
 * gate every suite installs does not reach a global setup, which in this
 * repository is where databases get built, servers get spawned and probed, and
 * fixtures get imported through a running app. Nothing there reaches past
 * loopback today, and the gate exists precisely because "nothing does it today"
 * is the state a harness control is written to keep.
 *
 * IT INSTALLS ONLY, WITH NO `beforeEach` RESTORE -- which is why it is a
 * separate module rather than the one the suites list. `vitest`'s hooks reach
 * for worker state the main process does not have, so importing that module
 * here would throw rather than gate anything. There are no tests in this
 * process to restore between in any case.
 *
 * WHAT IT DOES NOT COVER, said here because a gate that is believed to cover
 * more than it does is worse than none: a CHILD PROCESS. `apps/web/e2e` spawns
 * `next build` and `next start`, and those are separate processes with their own
 * dispatchers -- the served app reaches its provider over HTTP by design, and
 * ADR-0034's boundaries rather than this are what judge that. What this closes
 * is outbound calls made BY THE GLOBAL SETUP ITSELF. PostgreSQL connections are
 * outside it too, and always were: `pg` opens a raw TCP socket and never
 * consults an undici dispatcher.
 */
export default function setup(): void {
  installNetworkGate();
}
