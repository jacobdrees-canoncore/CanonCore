import { appRouter } from "@canoncore/api/routers";
import { SESSION_IDLE_LIMIT_SECONDS, SESSION_LIFETIME_SECONDS } from "@canoncore/db";
import { Button } from "@canoncore/ui/components/button";
import { call } from "@orpc/server";
import Link from "next/link";

import { callerContext } from "@/session";

import { endDevice } from "./actions";

/**
 * WHERE THE OWNER LOGS A DEVICE THAT IS NOT THIS ONE OUT (CNCORE-116).
 *
 * ADR-0043 CALLS THIS THE THING EVERYONE ACTUALLY WANTS, and it is the reason
 * that record refuses a token on the user row: one token for the whole account
 * can only be revoked for every device at once. `endSession` has named a session
 * since CNCORE-109 precisely so this would be a page rather than a change to the
 * mechanism -- what was missing was somewhere the owner could read the names.
 *
 * NOT A READ, WHATEVER IT LOOKS LIKE. ADR-0044 leaves the CATALOGUE open,
 * because the demo is read-only with no login and ADR-0072 gives a visitor
 * everything on it. Who is logged in to an instance is not in the catalogue, and
 * a list of an owner's devices answered to anybody is a list of what to go
 * looking for -- so a visitor here is told where the door is and nothing else.
 *
 * IT NEEDS NO JAVASCRIPT, like every other form in this app: End is an ordinary
 * form post and the answer is the re-rendered list.
 */
export default async function DevicesPage() {
  /*
   * THE CALLER'S OWN CONTEXT, which here decides whether there is a page at all
   * rather than only which buttons it carries. `/import` shows a visitor the
   * whole surface and none of its buttons because the reads behind it are open;
   * every read behind THIS one is the owner's.
   */
  const context = await callerContext();
  if (context.session === null) return <NotLoggedIn />;

  const devices = await call(appRouter.session.list, {}, { context });

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-medium">Devices</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Every device you are logged in on. Ending one logs that device out and leaves this one
        alone.
      </p>
      <p className="mt-2 text-muted-foreground text-sm">
        A device that has not been used for {inDays(SESSION_IDLE_LIMIT_SECONDS)} days is logged out
        by itself, and every device is logged out {inDays(SESSION_LIFETIME_SECONDS)} days after it
        logged in.
      </p>
      <section aria-labelledby="devices" className="mt-6">
        <h2 className="sr-only" id="devices">
          Devices you are logged in on
        </h2>
        <ul className="flex flex-col divide-y">
          {devices.map((device) => (
            <li className="flex items-center justify-between gap-4 py-3" key={device.id}>
              <div>
                <p className="text-sm">{nameOf(device)}</p>
                <p className="text-muted-foreground text-xs">
                  Last used{" "}
                  <time dateTime={device.lastSeenAt.toISOString()}>{on(device.lastSeenAt)}</time>
                </p>
              </div>
              {device.current ? (
                /*
                 * THE ONE ROW WITH NO BUTTON. Ending it from here would take the
                 * row and leave the cookie: this browser would hold a token that
                 * opens nothing, on a page that still said it was logged in.
                 * `session.end` refuses it as well, so this is the surface
                 * agreeing with the procedure rather than the only thing
                 * stopping it.
                 */
                <p className="text-muted-foreground text-xs">This device</p>
              ) : (
                <form action={endDevice}>
                  <input name="id" type="hidden" value={device.id} />
                  <Button size="sm" type="submit" variant="outline">
                    Log this device out
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

/**
 * WHAT THE OWNER WOULD RECOGNISE THE DEVICE BY, or the truth that it said
 * nothing.
 *
 * A BROWSER DECLARES NOTHING AND THIS PAGE SAYS SO. The web UI is not a Client
 * (`CONTEXT.md`) -- the server serves it, at the server's own origin -- so its
 * row holds nulls in every declaration column, and a placeholder invented here
 * would be this app asserting something no device ever said (ADR-0043). The
 * names arrive with the clients, and the column is already there for them.
 */
function nameOf(device: { clientName?: string; deviceName?: string }) {
  const declared = [device.deviceName, device.clientName].filter((field) => field !== undefined);
  return declared.length === 0 ? "A browser, which declared nothing" : declared.join(" · ");
}

/**
 * A sighting, in UTC and said so.
 *
 * THE SERVER CANNOT KNOW THE READER'S TIMEZONE, and this page is rendered on the
 * server with no script to correct it afterwards. A time printed in whatever
 * zone the server happens to run in, unlabelled, is one an owner cannot compare
 * against "I used my phone this morning" -- which is the entire question this
 * column is read to answer.
 */
function on(seen: Date): string {
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(seen)} UTC`;
}

/** A limit in the units the sentence above says it in. */
function inDays(seconds: number): number {
  return Math.round(seconds / 60 / 60 / 24);
}

/**
 * ADR-0044's visitor, who is told where the door is and nothing else.
 *
 * NO LIST, NOT EVEN AN EMPTY ONE. "This instance has nobody logged in" and "you
 * are not the person who may ask" are different sentences, and only the second
 * is true here.
 */
function NotLoggedIn() {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-medium">Devices</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        The devices an owner is logged in on are their own business, so this page asks you to be
        them first.
      </p>
      <Link className="mt-6 inline-block text-sm hover:underline" href="/login">
        Log in
      </Link>
    </main>
  );
}
