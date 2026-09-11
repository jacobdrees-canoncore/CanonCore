import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";

/**
 * The loopback the carve-out below admits, matched against undici's `host` --
 * the hostname with the port when there is one, so `127.0.0.1:8080` and bare
 * `127.0.0.1` both arrive here.
 *
 * `127.0.0.0/8` AS A PATTERN RATHER THAN THE ONE ADDRESS, because a suite is
 * free to bind anywhere in it. `localhost` and `[::1]` are the same machine
 * written two other ways: nothing in this repo reaches either today, but
 * `apps/web/src/utils/orpc.ts` already hardcodes `http://localhost:3001` as its
 * fallback base URL, and a gate that refuses the app's own dev URL is one
 * somebody widens in a hurry without reading why it was narrow.
 *
 * THIS IS A HOST-STRING MATCH AND NOT AN ADDRESS CHECK, which is the one thing
 * to keep straight when reading it next to ADR-0034. That record's boundaries
 * judge the address a socket is about to connect to; undici's matcher is handed
 * the host as written, so `localhost` here means "whatever localhost resolves
 * to". That is the right strength for a harness control against ACCIDENTS and
 * the wrong strength for the app's SSRF boundary, which is why the app has its
 * own and does not share this.
 */
const LOOPBACK = /^(127\.\d+\.\d+\.\d+|localhost|\[::1\])(:\d+)?$/;

/**
 * The suite's network gate: unexpected egress THROWS rather than reaching the
 * network.
 *
 * Nothing in this repository made an outbound request until CNCORE-6, and
 * nothing needed stopping. The CMPP client does, so a test naming the wrong
 * host now reaches it -- quietly succeeding on the one machine with network
 * access and failing on a runner nobody is watching.
 *
 * BUILT ON undici's `MockAgent` AND NOT ON nock. `nock@14` does not intercept
 * `fetch` -- its undici support is still on the `beta` tag -- so
 * `nock.disableNetConnect()` prints that net connect was disabled and then makes
 * real calls, which is a gate that reports success while standing open.
 *
 * INSTALLING IT IS A FUNCTION AND NOT AN IMPORT SIDE EFFECT. CNCORE-15 measured
 * the alternative: with the install at module top level, any test importing
 * anything from this file installed the gate as well, so the test proving the
 * gate fires passed with the setup file removed and could never have caught the
 * gate being switched off.
 *
 * THE ONE PLACE IT STILL CANNOT SEE, and it is a limit rather than a hole to be
 * closed: a request that names its OWN dispatcher never consults the global one
 * this sets, and every CMPP request names its own -- that is how ADR-0034 hangs
 * its two boundaries. So this is a control against ACCIDENTS, and the live
 * hazard it cannot reach is a test building a provider client with a permissive
 * allowlist, which would make a real outbound call with nothing here to stop it.
 * CNCORE-30 weighed closing it and did not: a lint rule against `dispatcher:` in
 * a test aims at syntax no test in this repository writes, and would miss the
 * allowlist that is the actual hazard. ADR-0034's boundaries are what stand in
 * front of a deliberate outbound call, which is what they are for. Two other
 * places it could not see -- a `globalSetup`, and a test that swaps the global
 * dispatcher -- WERE closed, by `gate-global-setup.ts` and by `restore` below.
 */
export function installNetworkGate(): () => void {
  const agent = new MockAgent();
  // BOTH CALLS, IN THIS ORDER. Measured against undici 8.10.2 rather than
  // recalled: a MockAgent starts with net connect ON, `disableNetConnect()`
  // turns it off, and `enableNetConnect(matcher)` REPLACES that answer with a
  // list holding the matcher. So the pair reads as "closed, then this one door"
  // and behaves that way; reversed, the door closes again and loopback goes
  // with it.
  agent.disableNetConnect();
  agent.enableNetConnect(LOOPBACK);
  setGlobalDispatcher(agent);

  /**
   * WHAT IT HANDS BACK is how to put the gate on again, for a caller that runs
   * tests: one that calls `setGlobalDispatcher` itself takes the gate's place,
   * and setup files run once per FILE rather than once per test, so without
   * this the gate stays off for every test after the one that swapped it.
   * `install-network-gate.ts` wires it as a `beforeEach` and is the only place
   * that can -- `vitest`'s hooks reach for worker state, so they cannot be
   * called from a `globalSetup`, which is why that one ignores this.
   *
   * ONLY WHEN SOMETHING ELSE HOLDS THE GLOBAL DISPATCHER. A fresh `MockAgent`
   * per test would do the same job and leak one per test that nothing closes;
   * this re-installs the agent already made, so the check costs an identity
   * comparison and the fix costs nothing.
   */
  return () => {
    if (getGlobalDispatcher() !== agent) setGlobalDispatcher(agent);
  };
}
