---
status: accepted
---

# Reading the configuration does not empty the environment it read

`packages/env/src/server.ts` hands `createEnv` a COPY of `process.env`, never `process.env` itself.

t3-env implements `emptyStringAsUndefined` as a DELETE on the object it is handed:

```js
if (opts.emptyStringAsUndefined ?? false) {
  for (const [key, value] of Object.entries(runtimeEnv)) if (value === "") delete runtimeEnv[key];
}
```

Handed the live environment, reading the configuration therefore REMOVES from the process every
variable deliberately set empty. The reader never notices, because it already holds the values it
asked for. The cost lands on whatever loads `dotenv/config` next, since dotenv fills an ABSENT key
and leaves a PRESENT one alone whatever its value -- so the variable comes back holding what a file
on that machine says, which is the opposite of what was asked for.

## An empty value is a value here

This is not a tidiness argument, it is [[0044-one-owner-row]]'s. "The demo is an instance that never
sets it": an empty `OWNER_PASSWORD` means nobody can log in, and that is a CONFIGURED state rather
than a missing one. `DATABASE_MAX_CONNECTIONS` says it the other way -- `compose.yaml` interpolates
`${DATABASE_MAX_CONNECTIONS:-}`, so an installation that sets nothing hands the container an empty
string ON PURPOSE. A mechanism that erases empty values erases meaning this repository writes
deliberately.

## What it cost

The e2e harness stands up eleven instances off one build, and gives three of them
`OWNER_PASSWORD: ""` because they ARE ADR-0044's read-only demo. A developer who had followed
`README.md` and set a password in `apps/web/.env` -- which is the only place `next dev` reads one
from, so it is what hand-walking a branch under `CLAUDE.md` requires -- handed that password to all
three instead. The demo grew a login, and the suite reddened at `header.test.ts` and
`login-page.test.ts`: two assertions about a header and a page, naming neither the file nor the
practice that had collided.

Twice, because a Next server loads this module twice -- the copy `next.config.ts` pulls in through
the require hook, and the server bundle's own. The first deleted the key and the second's dotenv
refilled it. **ONE LOAD CANNOT SHOW THIS**, which is why a suite that loads the module in every
other case missed it.

## Neither loader was at fault, and both were blamed for a year

`apps/web/e2e/global-setup.ts` has said since CNCORE-99 that the leak was "not dotenv doing it ...
but Next's own env loading inside the server". CNCORE-270 was filed with a third account again:
that Node drops an `undefined` from a child's env and dotenv then fills the absent key.

Measured, all of it is false. The harness passes an empty STRING, not `undefined`. `@next/env`
16.3.5 and dotenv 17.4.2 each leave a key that is present alone, empty or not. What made the key
absent was our own call, and no loader can tell a key deleted by a reader from one never set.

The lesson is narrower than "read the source of your dependencies" and worth stating on its own: a
library handed a mutable object the caller also depends on may CHANGE it, and a flag named for what
it returns (`emptyStringAsUndefined`) is not obliged to say so.

## Evidence

CNCORE-270, measured 2026-09-21 at `a54f125`.

**The defect, end to end.** Build `apps/web` once, then start `next start` twice with
`OWNER_PASSWORD: ""` in its environment -- once with a password line in `apps/web/.env` and once
without -- and fetch `/login` and `/works` from each:

| `apps/web/.env` | `/login` says "no password set" | `/login` offers a form | header offers `/login` |
| --- | --- | --- | --- |
| no `OWNER_PASSWORD` | yes | no | no |
| `OWNER_PASSWORD` set | **no** | **yes** | **yes** |

**The door, named.** Take it again by preloading a module that replaces `process.env` with a Proxy
trapping `set` and `deleteProperty` and printing a stack, then starting a server the same way. On
2026-09-21 that printed, in order, `DELETE OWNER_PASSWORD` at
`createEnv (@t3-oss/env-core/dist/index.js:10)` called from `packages/env/src/server.ts:14`, and
then `SET OWNER_PASSWORD="the-developers-own-password"` at dotenv's `populate`, from the server
bundle's own copy of that module.

**The loaders, cleared.** With `OWNER_PASSWORD` present and empty, `loadEnvConfig` from
`@next/env` 16.3.5 leaves it empty, and so does `dotenv/config` 17.4.2, against a `.env` naming a
password in both cases.

## As built, under CNCORE-270

**BUILT: the copy, at the one site that reads configuration.** `createEnv` is called exactly once in
this repository and it now takes `{ ...process.env }`, so the delete lands on what that module read.

**BUILT: two assertions, each proved to catch it** by reverting the one line and watching them go red
([[0168-an-assertion-is-checked-by-deleting-the-behaviour-it-names]]). One holds the mechanism --
reading the environment leaves an empty variable in it -- and one holds the defect as filed: a
password in a `.env` does not reach a variable deliberately set empty, across the two module loads a
Next server really performs.

**NOT BUILT: nothing stops a SECOND caller passing `process.env` again.** There is one call site and
no check that there is only one, so this is a rule a reviewer applies rather than a mechanism. The
sweep that would enforce it was not built here, and naming that is cheaper than a record which reads
as though it were.
