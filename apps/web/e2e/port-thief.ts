import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { vi } from "vitest";

/**
 * ANOTHER PROCESS IN A SERVER'S WAY, AT THE WORST MOMENT THERE IS (CNCORE-235).
 *
 * SHARED BY TWO PROJECTS SINCE CNCORE-237. `e2e/instance.test.ts` puts it in
 * front of `next start`, and `live/provider.test.ts` in front of the real
 * `provider-wiki`, which is another repository's server started the same way.
 *
 * EACH FILE THAT USES IT WRAPS `spawn` ITSELF, because `vi.mock` is hoisted
 * within the file it is written in and nowhere else:
 *
 *   vi.mock("node:child_process", async (importOriginal) => {
 *     const actual = await importOriginal<typeof import("node:child_process")>();
 *     return { ...actual, spawn: vi.fn(actual.spawn) };
 *   });
 *
 * Every call goes through to Node's own until `aPortThief` arms it, and then
 * only the next one is intercepted.
 */

/**
 * ARMS THE NEXT `spawn` WITH ANOTHER PROCESS'S BIND. Whatever port the command
 * names -- as `--port` or `-p` in any spelling, or as `PORT` in its environment,
 * the places `next start` and `provider-wiki` read one -- this process binds
 * before the real `spawn` runs, on the host the command names (`--hostname` or
 * `-H` for Next, `HOSTNAME_BIND` for `provider-wiki`) or on Node's default
 * without one, which is exactly where the server would bind it. A port of 0
 * names nothing, so it takes nothing. What it holds goes on `owned`.
 *
 * THE HOST MATTERS ON macOS, where a bind on `::` leaves `127.0.0.1` free to
 * bind beside it (ADR-0144's table). A thief that ignored `HOSTNAME_BIND` would
 * sit on `::` while `provider-wiki` bound `127.0.0.1` on the same port, and a
 * design naming a port in advance would pass.
 *
 * BOUND BEFORE THE SERVER HAS LOADED NODE: with no host the bind is
 * synchronous, and with one it waits only on the lookup's next tick.
 */
export function aPortThief(owned: AsyncDisposableStack): void {
  const real = vi.mocked(spawn).getMockImplementation();
  if (real === undefined) throw new Error("`spawn` is not wrapped: see the top of port-thief.ts");
  vi.mocked(spawn).mockImplementationOnce((command, args, options) => {
    const port = Number(optionValue(args, "--port", "-p") ?? options?.env?.PORT ?? 0);
    const host = optionValue(args, "--hostname", "-H") ?? options?.env?.HOSTNAME_BIND;
    if (port !== 0) void anotherListener(owned, port, host);
    return real(command, args, options);
  });
}

/**
 * A LISTENER THAT IS NOT THE SERVER, on this port and host, or on Node's default
 * address without one. It hangs up on whatever connects, so nothing mistakes it
 * for a server that answered. Settles once it is listening, or on why it could
 * not; either way it is closed with `owned`.
 */
export function anotherListener(
  owned: AsyncDisposableStack,
  port: number,
  host?: string,
): Promise<void> {
  const other = createServer((socket) => socket.destroy());
  owned.defer(() => new Promise<void>((resolve) => other.close(() => resolve())));
  return new Promise((resolve, reject) => {
    other.once("error", reject);
    other.listen(port, host, resolve);
  });
}

/**
 * The value a command line gives an option, in each spelling Next's parser
 * accepts: `--port 0`, `--port=0`, `-p 0` and `-p0`.
 */
function optionValue(args: readonly string[], long: string, short: string): string | undefined {
  for (const [at, arg] of args.entries()) {
    if (arg === long || arg === short) return args[at + 1];
    if (arg.startsWith(`${long}=`)) return arg.slice(long.length + 1);
    if (arg.startsWith(short) && !arg.startsWith("--")) return arg.slice(short.length);
  }
  return undefined;
}
