---
status: accepted
---

# A server under test chooses its own port, on the address it is reached at

Every `next start` the test harness spawns goes through `theBuildServing` in
`apps/web/e2e/instance.ts`, and it is given `--hostname 127.0.0.1 --port 0`. The OS picks the port
in the bind that holds it, Next announces it on its `- Local:` line, and the harness reads it from
there and reaches the server at `127.0.0.1` on it. Nothing names a port in advance, so no port is
free between being chosen and being bound, and nothing else can listen where the harness reaches a
server.

That is the shape every in-process stub in this repository already had: `stubs.ts`,
`settings-page.test.ts` and `packages/api`'s provider tests all `listen(0, "127.0.0.1")` and read
their own address back. The servers were the exception because they are another process, and a
port had to cross from the harness to it.

## The defect: a port chosen, closed, then handed over

On 2026-09-19 one full `pnpm test:e2e` run of four went red on a server `item-page-cost.test.ts`
started for itself, while another worktree's suite ran beside it at a load average of 7 to 10:

```
⨯ Failed to start server
Error: listen EADDRINUSE: address already in use :::56214
Error: next start exited with 1 before answering
```

The rerun passed 300 of 300, unchanged. `freePort` bound a probe to `127.0.0.1` on port 0, read the
number, closed the probe and passed the number to `next start --port`. From that close until Next's
own bind the port was anybody's. And Next, given no `--hostname`, bound every address (`:::56214`),
so the probe had checked one address and the server needed another.

## What was measured, and what it changed

Node 24.19.0 on macOS (Darwin 25.6.0), 2026-09-19, with plain `net` listeners:

| Listener held first | Then listened on                     | Result       |
| ------------------- | ------------------------------------ | ------------ |
| `127.0.0.1:P`       | `::`                                 | bound        |
| `127.0.0.1:P`       | no host (Node's default, and Next's) | bound        |
| `::1:P`             | `::`                                 | bound        |
| `:::P`              | `127.0.0.1`                          | bound        |
| `0.0.0.0:P`         | `127.0.0.1`                          | bound        |
| `127.0.0.1:P`       | `127.0.0.1`                          | `EADDRINUSE` |

libuv sets `SO_REUSEADDR` on every TCP bind (1.52.1, the version this Node ships, in
`src/unix/tcp.c`), and on macOS that lets overlapping addresses share a port: only an identical
address conflicts. Two more facts followed from it:

- **A connection goes to the most specific address bound.** With one listener on `127.0.0.1:P` and
  another on `:::P`, a request to `127.0.0.1:P` reached the `127.0.0.1` one, whichever bound first.
- **The allocator does not hand out a port a listener holds on another address.** With 3,000 held on
  `::`, 2,000 probes on `127.0.0.1` port 0 were given none of their ports; with the addresses
  swapped, none; with both on `127.0.0.1`, none. CNCORE-126 measured the same for one address
  (ADR-0103: two hundred simultaneous `listen(0)` calls, two hundred distinct ports).

**THE ADDRESS WAS NOT HOW THE PORT WAS LOST, BUT IT WAS A HAZARD OF ITS OWN.** The ticket, and the
dispatcher's comment on it, named the probe's address a second cause: a check that proved the port
free on loopback when the server needed it free everywhere. The allocator answers for every
address, so a probe on `127.0.0.1` was never handed a port a listener held on `::`. The window is
the only path the measurements leave: port 56214 was free everywhere when the probe got it, and
held on `::` by the time Next asked. What took it was not recorded.

The mismatch was still wrong, the other way round. A server on every address leaves `127.0.0.1`
itself free to bind. Anything that took it inside the window would not have made Next fail: Next's
bind would succeed beside it, and every request the harness sent would reach the other process,
since it is the more specific address. A harness answered by the wrong process is worse than a
server that fails to start, because nothing about it is red. So both are fixed, as the dispatcher
asked, and the second one's case is below.

## The decision

- **`--port 0`, and the port read off `- Local:`.** Next's own harness does exactly this: its
  `next start` test mode spawns with `PORT` `'0'` unless a test forces one
  (`test/lib/next-modes/base.ts`) and reads the URL off the `- Local:` line
  (`test/lib/next-modes/next-start.ts`), read from `vercel/next.js` on 2026-09-19. Next 16.3.5's CLI
  accepts 0 (`parseValidPositiveInteger` rejects only negatives). Its `listening` handler reads the
  port back from `server.address()`, prints it on that line, and passes it on to the request
  handlers it builds next (`dist/server/lib/start-server.js`), so nothing inside Next is left
  believing the port is 0.
- **`--hostname 127.0.0.1`, from the constant the harness builds `baseUrl` with.** One constant for
  where the server listens and where it is reached. The servers also stop announcing
  `Network: http://192.168.0.109:<port>`. A server under test never needed to be reachable from the
  LAN.
- **The port is the harness's, not Next's URL.** The harness takes only the port from the line and
  builds the URL from its own constant, so a Next that printed `localhost` there could not send the
  harness to `::1`.
- **Stdout is piped to read it and passed on to the run's own; stderr stays inherited.** A server's
  output still reaches the run.
- **One minute for the whole start.** `STARTING_MS` covers binding, announcing and answering, and
  `waitUntilAnswering` takes the same deadline, so the tests' `ONE_SERVER_MS` still describes
  one server's worst case.

A Next that worded the line differently would fail every start with `next start named no port
within 60s`. It would not start somewhere unknown.

## Alternatives weighed

- **A wider probe**, on `::` or on both addresses. It narrows nothing: the allocator already answers
  for every address, and the window stays exactly as wide.
- **Retrying on `EADDRINUSE`.** It survives the window instead of closing it, telling a stolen port
  from any other failed start means parsing Next's stderr, and it does nothing for the hazard above,
  where the bind succeeds.
- **Handing Next the probe's socket.** `next start` takes no listening socket or descriptor.
- **Ports outside the ephemeral range.** Every harness on the machine would draw from the same
  ones, which is the four-agent case (ADR-0104) exactly.

## How it is held

**THE SEAM IS CNCORE-229'S** (ADR-0103, "A server is owned from the moment it spawns"):
`theBuildServing` with a real `next start` in `e2e/instance.test.ts`, on the `leak` database, one
server a case. What it adds is an adversary, and **the dispatcher chose it on 2026-09-19, as the
only option offered that holds both causes**, the race and the address. The two rejected: a case on
the address alone, which leaves the race held only by hand-measured red, and a unit test of the
line parser, which a design naming a port in advance would pass.

- **A thief at the spawn.** `node:child_process` is mocked with a wrapper around the REAL `spawn`.
  Armed, it binds whatever port the command names (`--port`, `-p`, or `PORT` in its environment),
  on the host the command names or Node's default, before the real `spawn` runs. The server
  process is loading Node when the port goes, so the window's worst case is forced every time
  rather than waited for on a busy machine. A port of 0 names nothing, so it takes nothing. Red on
  `main`'s `instance.ts` in 203ms: `⨯ Failed to start server`, `listen EADDRINUSE: address already
  in use :::52839`, `next start exited with 1 before answering`, the ticket's failure verbatim.
- **Nothing else can listen where the harness reaches it.** Once the server answers, a listener on
  the host and port in its `baseUrl` is refused `EADDRINUSE`. Red on `main` on this Mac: `promise
  resolved "undefined" instead of rejecting`. Whether Linux lets that bind through against a
  wildcard listener was not measured, so whether this case can go red on CI's runners is unknown. It
  holds the property on the machine where four agents share the ports, which is where the hazard
  was.

**THE THIEF HANGS UP ON WHATEVER CONNECTS, AND THE FIRST DRAFT DID NOT.** It accepted connections
and never answered them, and on `main` that hung the harness. `waitUntilAnswering`'s `fetch` to
`127.0.0.1:<port>` connected to the thief and waited until the case's 75-second timeout. That is the
same hazard from the harness's side: a harness talking to a listener that is not its server. The
thief closes each connection now, so the red is the ticket's own.

**TWO CASES, ONE SERVER EACH, IN ORDER**, in the file that already starts servers one at a time. The
file's peak is still one server, so ADR-0104's four-agent ceiling does not move. On this branch the
file runs 8 of 8, and every server announces `http://127.0.0.1:<port>` and nothing else.

## What this does not hold

- **The live suite's provider process.** `live/live-import.test.ts` starts `provider-wiki`, another
  repository's server, on a port from `freePort`, which now lives in that file as its one caller,
  with the window still open. CNCORE-237 carries it. Its CanonCore server goes through
  `theBuildServing` and is covered here.
- **Sockets that are not listening.** Every measurement above is of listeners. What a connected
  socket's local port does to a later bind on the same port was not measured, and nothing here
  depends on it: a server that binds port 0 is handed a port the OS considers free for that bind.
