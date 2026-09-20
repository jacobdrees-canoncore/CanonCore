---
status: accepted
---

# A Next server under test chooses its own port, on the address it is reached at

Every `next start` the test harness spawns goes through `theBuildServing` in
`apps/web/e2e/instance.ts`, and it is given `--hostname 127.0.0.1 --port 0`. The OS picks the port
in the bind that holds it, Next announces it on its `- Local:` line, and the harness reads it from
there and reaches the server at `127.0.0.1` on it. Nothing names a port in advance, so no port is
free between being chosen and being bound, and nothing else can listen where the harness reaches a
server. The live suite's `provider-wiki`, another repository's server, is started the same way since
CNCORE-237, through the same reader: see "The live suite's provider, the same way (CNCORE-237)".

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

2026-09-19, with plain `net` listeners: Node 24.19.0 on macOS (Darwin 25.6.0), and Node 24.21.0 on
Linux 6.8.0 (`node:24-alpine` in colima's VM).

| Listener held first | Then listened on                     | macOS        | Linux        |
| ------------------- | ------------------------------------ | ------------ | ------------ |
| `127.0.0.1:P`       | `::`                                 | bound        | `EADDRINUSE` |
| `127.0.0.1:P`       | no host (Node's default, and Next's) | bound        | `EADDRINUSE` |
| `::1:P`             | `::`                                 | bound        | `EADDRINUSE` |
| `:::P`              | `127.0.0.1`                          | bound        | `EADDRINUSE` |
| `0.0.0.0:P`         | `127.0.0.1`                          | bound        | `EADDRINUSE` |
| `:::P`              | `::1`                                | bound        | `EADDRINUSE` |
| `127.0.0.1:P`       | `127.0.0.1`                          | `EADDRINUSE` | `EADDRINUSE` |

libuv sets `SO_REUSEADDR` on every TCP bind (1.52.1, the version Node 24.19.0 ships, in
`src/unix/tcp.c`). On macOS that lets overlapping addresses share a port, and only an identical
address conflicts; Linux refuses every overlap. Two more facts followed on macOS:

- **A connection goes to the most specific address bound.** With one listener on `127.0.0.1:P` and
  another on `:::P`, a request to `127.0.0.1:P` reached the `127.0.0.1` one, whichever bound first.
- **The allocator does not hand out a port a listener holds on another address.** With 3,000 held on
  `::`, 2,000 probes on `127.0.0.1` port 0 were given none of their ports; with the addresses
  swapped, none; with both on `127.0.0.1`, none. CNCORE-126 measured the same for one address
  (ADR-0103: two hundred simultaneous `listen(0)` calls, two hundred distinct ports).

**THE ADDRESS WAS NOT HOW THE PORT WAS LOST, BUT ON macOS IT WAS A HAZARD OF ITS OWN.** The ticket,
and the dispatcher's comment on it, named the probe's address a second cause: a check that proved
the port free on loopback when the server needed it free everywhere. The allocator answers for every
address, so a probe on `127.0.0.1` was never handed a port a listener held on `::`. The window is
the only path the measurements leave: port 56214 was free everywhere when the probe got it, and held
on `::` by the time Next asked. What took it was not recorded.

The mismatch was still wrong, the other way round, on the Mac four agents share. A server on every
address leaves `127.0.0.1` itself free to bind there. Anything that took it inside the window would
not have made Next fail: Next's bind would succeed beside it, and every request the harness sent
would reach the other process, since it is the more specific address. A harness answered by the
wrong process is worse than a server that fails to start, because nothing about it is red. So both
are fixed, as the dispatcher asked, and the second one's case is below.

## The decision

- **`--port 0`, and the port read off `- Local:`.** Next's own harness does exactly this: its
  `next start` test mode spawns with `PORT` `'0'` unless a test forces one and reads the URL off the
  `- Local:` line -- BOTH IN `test/lib/next-modes/next-start.ts`, read from `vercel/next.js` at tag
  `v16.3.5`. `base.ts` only declares `forcedPort` and resolves the `'random'` case, so citing it for
  the spawn named a file that does not make the decision. Next 16.3.5's CLI
  accepts 0 (`parseValidPositiveInteger` rejects only negatives). Its `listening` handler reads the
  port back from `server.address()`, prints it on that line, and passes it on to the request
  handlers it builds next (`dist/server/lib/start-server.js`), so nothing inside Next is left
  believing the port is 0.
- **`--hostname 127.0.0.1`, from the constant the harness builds `baseUrl` with.** One constant for
  where the server listens and where it is reached. The servers stop announcing a LAN address --
  `Network: http://192.168.0.109:<port>` -- and a server under test never needed to be reachable
  from the LAN. A `Network:` LINE ITSELF STILL PRINTS, which is the narrower claim and the true one:
  `start-server.js` sets `networkHostname = hostname ?? getNetworkHost(...)`, so a passed
  `--hostname` makes it non-null and `app-info-log.js` prints the line. Both lines now carry
  `127.0.0.1`, which is why "every server announces `http://127.0.0.1:<port>` and nothing else"
  below stays true.
- **The port is the harness's, not Next's URL.** The harness takes only the port from the line and
  builds the URL from its own constant, so a Next that printed `localhost` there could not send the
  harness to `::1`.
- **Stdout is piped to read it and passed on to the run's own; stderr stays inherited.** A server's
  output still reaches the run. An orphaned server now holds the run's output open through its
  stderr rather than its stdout, which is still ADR-0141's hang, and still `settingUp`'s to prevent
  (ADR-0103, "A server is owned from the moment it spawns", corrected to say so).
- **One minute for the whole start.** `STARTING_MS` covers binding, announcing and answering, and
  `waitUntilAnswering` takes the same deadline, so the tests' `ONE_SERVER_MS` still describes
  one server's worst case.

A Next that worded the line differently would fail every start: with `next start named no port
within 60s` if the line went missing, or `next start announced <url>, which names no port` if its
URL carried none. It would not start somewhere unknown.

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
  Armed, it binds whatever port the command names (`--port` or `-p` in each spelling Next's parser
  accepts, or `PORT` in its environment), on the host the command names (`--hostname` or `-H`, or
  `HOSTNAME_BIND` in its environment since CNCORE-237) or Node's default, before the real `spawn`
  runs. It lives in `e2e/port-thief.ts` since CNCORE-237, so the live suite can use it too. The
  server process is loading Node when the port goes, so the window's worst case is forced every
  time rather than waited for on a busy machine. Red on `main`'s
  `instance.ts` in 203ms: `⨯ Failed to start server`, `listen EADDRINUSE: address already in use
  :::52839`, `next start exited with 1 before answering`, the ticket's failure verbatim. **On this
  branch it takes nothing**, because a port of 0 names nothing: there the case is a guard that
  fails any design naming a port in advance. That the window is closed rests on the mechanism, the
  OS choosing in the bind that holds the port, and on that red.
- **Nothing else can listen where the harness reaches it.** Once the server answers, a listener on
  the host and port in its `baseUrl` is refused `EADDRINUSE`. Red on `main` on this Mac: `promise
  resolved "undefined" instead of rejecting`. On Linux it cannot go red, because Linux refuses that
  bind against a wildcard listener too (the table above), so CI's runners hold nothing here. It
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

## The live suite's provider, the same way (CNCORE-237)

`live/live-import.test.ts` starts the real `provider-wiki`, another repository's server, and it was
the last caller of `freePort`, with the same window open. It now goes through
`theProviderServing` in `live/provider.ts`, which gives the provider `PORT=0` and
`HOSTNAME_BIND=127.0.0.1` (`SERVER_HOST`, exported for it) and reads the port with
`thePortItBound`, the same reader, off the provider's own `provider-wiki listening on <url>` line.
`freePort` is gone. The reader takes the line as an `Announcement`, which is the only thing that
differs between the two servers.

- **`PORT=0` reaches the provider's listener as 0.** Its `src/server.ts` (at d028451) takes `PORT`
  from the environment and `@hono/node-server` 2.1.1 defaults it with `??`, so 0 is not replaced.
  Run by hand on 2026-09-19: it announced `http://127.0.0.1:52495`, `lsof` showed it listening on
  exactly `127.0.0.1:52495`, and that URL answered 200.
- **No poll after the line.** The provider prints it from its listening callback, and a listening
  server answers, so `waitUntilAnswering` is `theBuildServing`'s alone now and no longer exported.
- **The seam is the real provider with the thief armed**, in `live/provider.test.ts`. The dispatcher
  chose it on 2026-09-19 over the live import alone, because it needs the checkout and NOT the
  Owner's Credential, which lapses within a day and only the Owner renews. A check that needs the
  credential rarely runs. Red on the probe's shape: `listen EADDRINUSE: address already in use
  127.0.0.1:55233`, and the provider exited before it answered. Green on port 0, where the thief
  takes nothing.
- **The thief had to learn `HOSTNAME_BIND`, or it proves nothing on macOS.** Without it the thief
  binds `::`, the provider binds `127.0.0.1` beside it (the table above), and the probe's shape
  PASSED: measured 2026-09-19, the thief held `:::55440` and the provider still announced
  `http://127.0.0.1:55440`.

## What this does not hold

- **Sockets that are not listening.** Every measurement above is of listeners. What a connected
  socket's local port does to a later bind on the same port was not measured, and nothing here
  depends on it: a server that binds port 0 is handed a port the OS considers free for that bind.
