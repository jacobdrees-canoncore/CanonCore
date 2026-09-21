---
status: accepted
---

# The suite serves the entry point that can take an ephemeral port

`apps/web/next.config.ts` sets `output: "standalone"`. Every server the e2e harness stands up is
`next start` (`apps/web/e2e/instance.ts`, `theBuildServing`), and Next answers each one with:

```
⚠ "next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead.
```

**The harness keeps `next start`, and the warning stays.** The shipped entry point is proved by the
`image` job, which runs the actual image against a route that reads the database.

## Why this is a decision and not a shrug

The warning costs nothing at runtime. It is a WARNING and not a throw: `next/dist/server/next.js`
logs it in `getServer()` when `conf.output === 'standalone'` and `__NEXT_PRIVATE_STANDALONE_CONFIG`
is unset, and the `output: 'export'` branch beside it throws where this one does not (read from
`node_modules` at 16.3.5 on 2026-09-21).

What it costs is an argument. This suite's whole claim is that it tests the SHIPPED page, and
`global-setup.ts` makes it twice -- at `freshInstall` and at `aCatalogueTooBigForOnePage`, both
saying THE SAME BUILD started again rather than a second build of it, which is the shape
[[0117-a-read-surface-renders-per-request]] exists to serve. Those two sentences are about the
BUILD. This record is about the ENTRY POINT, which they do not speak to and which is the second
half of the same claim: a deployment runs `.next/standalone/apps/web/server.js`, and the suite runs
`next start`. The claim is only as good as the distance between them.

## The distance, measured rather than assumed

Both entry points load the same `.next/server` output through the same `startServer`. They differ
in FOUR things, and only one of them can produce a defect:

1. **Which `node_modules` resolve.** The shipped tree carries the TRACED SUBSET. A module the app
   reaches at runtime but tracing missed works under `next start` and fails under the server that
   ships. **This is the one that matters, and it is not hypothetical here**: the `Dockerfile` builds
   the migrator a module tree of its own precisely because `drizzle-orm` is a part the trace does
   not carry.
2. **The config source** — `next.config.ts` from disk, against a string baked into `server.js`.
3. **The working directory** — `apps/web`, against the standalone tree, which `server.js` `chdir`s
   into.
4. **Where `.next/static` sits.** The standalone tree carries NO `static` directory at all;
   `Dockerfile:121` copies it in. Verified on 2026-09-21: `.next/standalone/apps/web/.next/` holds
   the manifests, `server`, `node_modules` and `package.json`, and nothing else.

Two, three and four change whether the server STARTS. They cannot change the bytes a started server
returns for a page this suite asserts on. One can, and one is covered below.

## The shipped entry point cannot be given an ephemeral port

This is what refuses the obvious fix. `next build` writes the glue itself, and its eighth line is:

```js
const currentPort = parseInt(process.env.PORT, 10) || 3000
```

`parseInt("0", 10)` is `0`, and `0 || 3000` is `3000`. **So `PORT=0` does not ask the OS for a
port; it takes 3000.** Measured 2026-09-21, with
`PORT=0 HOSTNAME=127.0.0.1 node .next/standalone/apps/web/server.js`:

```
▲ Next.js 16.3.5
- Local:         http://127.0.0.1:3000
```

The harness gives Next `--port 0` and reads back the port it bound, and it does that because the
alternative cost a server its life: a probe that bound a port, closed, and handed the number over
left a window in which another worktree's suite took it
([[0144-a-next-server-under-test-chooses-its-own-port-where-it-is-reached]], CNCORE-235).
Eleven standalone servers would each need a port named in advance, which is that window, eleven
times, with four agents running at once.

## And on the Owner's own machine the cost is not theoretical

Port 3000 is the Owner's LIVE INSTALL. The standalone server bound `127.0.0.1:3000` beside it and
took its loopback traffic, which is the SO_REUSEADDR shadowing `SERVER_HOST`'s own docblock
describes: a connection goes to the most specific address bound, and Docker publishes the live
install on the wildcard. Measured 2026-09-21 by asking `http://127.0.0.1:3000/` before, during and
after:

| | bytes | what answered |
|---|---|---|
| before | 273,973 | the live install, 8,053 Items |
| while the standalone server ran | 34,751 | this worktree's seeded catalogue |
| after it was killed | 273,973 | the live install again |

The item count is derived, not quoted: `select count(*) from items` against the live install's own
database on 2026-09-21. **A test that silently serves the Owner's install its own test fixtures is
worse than a warning**, and this is the reason an e2e standalone check was declined rather than any
question of scope.

## So the acceptance is conditional, and the condition is pinned

`next start` in the e2e suite is acceptable BECAUSE something else runs the entry point that ships.
That something is the `image` job: it builds the real image on both architectures, runs it against
an empty PostgreSQL, and asks `/items/<unknown-uuid>` for a **404 and not a 500** — a route that
reads the database, chosen so the server has to have opened a connection. A missing traced
dependency cannot survive that.

**This record is only true while that job keeps asking.** Delete the smoke test, or weaken it to
`/` — which answers 200 with no connection ever opened — and nothing anywhere runs the shipped
entry point, while the e2e suite goes on reporting green and claiming it tests the page that ships.
The claim would become false with nothing in the diff saying so, which is
[[0181-a-check-is-evidence-only-for-the-commit-it-ran-against]]'s own shape.

So the condition is an assertion rather than a sentence: `packages/config/src/image.test.ts`, "the
smoke test the e2e suite's entry point leans on". Both halves are held to ONE step, and that was a
correction a mutation forced — the first draft asked only for a step running `canoncore:smoke`,
and deleting the image from the step that SERVES left it green, because the step proving the
container
REFUSES to serve an unmigrated database runs the same tag.

## Three things refused, each for its own reason

**Dropping `output: "standalone"` is refused because it is the image.** `Dockerfile:117` copies
`/app/apps/web/.next/standalone` and `Dockerfile:142` runs `node apps/web/server.js`. The ticket
asked whether anything reads the setting; the whole runner stage does.

**Silencing the warning with `__NEXT_PRIVATE_STANDALONE_CONFIG` is refused because it is not a
silencer.** It is the only lever Next offers, and `next/dist/server/config.js` shows what it
actually does: the config is parsed out of that variable and returned, so `next.config.ts` is never
read, `assignDefaults` and `modifyConfig` are skipped, and a `loadWebpackHook` failure is swallowed.
Setting it to quiet a line would stop the server under test loading the app's own configuration —
paying in what the suite proves for a tidier log.

**Filtering the warnings out of the run's output is refused too**, and this one is closer. The cost
is real, and it is BIGGER THAN THE TICKET COUNTED: CNCORE-302 headlines eleven, one per instance,
and a full run on 2026-09-21 emitted **28** — the ticket names the remainder without adding them
up, because `instance.test.ts` and `item-page-cost.test.ts` start servers of their own. Twenty-eight
lines sit in output an agent reads to decide whether a run was clean, and the line's operative claim
is false here: `next start` does work, and 374 e2e tests passed through it on 2026-09-21.

But stderr is INHERITED on purpose. An orphaned server holds the run's output open through it,
which is how a leaked server hangs CI to the job ceiling
([[0141-every-ci-job-stops-at-three-times-its-slowest-measured-run]], CNCORE-229), and re-plumbing
that stream for cosmetics puts a mechanism that catches a real hang at risk to remove a line that
catches nothing. A suite that hides a known line also teaches the next reader that hidden lines
exist.

## What this does not cover

The suite is still blind to the traced-module-subset defect between one `image` job run and the
next, and that is the honest limit rather than a gap to close here: `pnpm test:e2e` on a developer's
machine runs no container, and nothing here proposes one should: CI builds both architectures on
every run, which is where that class of defect is caught.

If Next ever makes this a throw, as the `output: 'export'` branch beside it already is, this record
needs revisiting — and it will announce itself, loudly, because all eleven servers will fail to
start at once. That needs no assertion of its own.

## As built, under CNCORE-302

- `apps/web/e2e/instance.ts` — `theBuildServing` keeps `next start`, and the TODO that asked this
  question is replaced by the answer.
- `packages/config/src/image.test.ts` — the condition above, held to one step, checked by mutation
  in both directions.
- `packages/config/src/adr-numbering.test.ts` — the row tying this record to the file that carries
  it.

**Nothing changed about HOW an instance is served**, which is the half a parallel branch needed:
CNCORE-284 was adding an e2e test in `apps/web/e2e/` while this landed, and its assertions run
against exactly the server they were written against.

The choice between these options was the DISPATCHER's, taken 2026-09-21 on the measurements above,
and not the Owner's.
