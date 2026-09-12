import { appRouter } from "@canoncore/api/routers";
import { Button } from "@canoncore/ui/components/button";
import { Input } from "@canoncore/ui/components/input";
import { Label } from "@canoncore/ui/components/label";
import { call } from "@orpc/server";
import Link from "next/link";

import { oneValue } from "@/components/query-params";
import { callerContext } from "@/session";
import { logIn, logOut } from "./actions";
import { REFUSED } from "./refusal";

/**
 * WHERE THE OWNER BECOMES THE OWNER (CNCORE-109).
 *
 * ONE PASSWORD AND NO SIGNUP, which is ADR-0044: a single user, one credential,
 * and no account to create. There is nothing on this page but a password field,
 * because there is nothing else an instance knows how to ask.
 *
 * AN INSTANCE THAT SETS NO PASSWORD SAYS SO RATHER THAN OFFERING A FORM THAT
 * CANNOT SUCCEED. That is ADR-0044's public demo -- read-only, with no login --
 * and it is reached by leaving `OWNER_PASSWORD` unset rather than by a mode.
 * A visitor to the demo who finds this page is entitled to know that the answer
 * is "nobody can", not "you got it wrong".
 *
 * IT NEEDS NO JAVASCRIPT, like every other form in this app: the password posts
 * as an ordinary form submission and the outcome comes back as a redirect.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ refused?: string | string[] }>;
}) {
  const asked = await searchParams;
  const context = await callerContext();
  const configured = await call(appRouter.session.configured, {}, { context });

  return (
    <main className="container mx-auto max-w-md px-4 py-8">
      <h1 className="text-3xl font-medium">Log in</h1>
      {context.session !== null ? (
        <LoggedIn />
      ) : configured.password ? (
        <LogInForm refused={oneValue(asked.refused)} />
      ) : (
        <NoPasswordSet />
      )}
    </main>
  );
}

/**
 * ADR-0044's public demo, which is read-only WITH NO LOGIN -- so this is the
 * true answer rather than a failure, and a form here would be a door with no key
 * cut for it.
 */
function NoPasswordSet() {
  return (
    <>
      <p className="mt-2 text-muted-foreground text-sm">
        This instance has no password set, so nobody can log in and nothing can be changed through
        it. Everything in the catalogue is still yours to read.
      </p>
      <Link className="mt-6 inline-block text-sm hover:underline" href="/">
        The catalogue
      </Link>
    </>
  );
}

function LogInForm({ refused }: { refused?: string }) {
  return (
    <>
      <p className="mt-2 text-muted-foreground text-sm">
        Reading this catalogue needs no password. Changing it does: creating and editing items,
        placing and reordering them, writing notes, importing from a provider, taking a
        container&apos;s ordering from one, purging one.
      </p>
      <form action={logIn} className="mt-6 flex flex-col gap-3">
        <Label htmlFor="password">Password</Label>
        {/*
          `type="password"`, WHICH IS ALSO WHAT KEEPS IT OUT OF THE URL. A GET
          form would put the owner's one credential in an address, where the
          browser's history, any proxy's log and the referrer header all keep it.
        */}
        <Input autoComplete="current-password" id="password" name="password" type="password" />
        <Button className="self-start" type="submit">
          Log in
        </Button>
      </form>
      {/*
        WHAT HAPPENED, IN THE OWNER'S TERMS. Two refusals reach this page and
        only one of them is about the password (ADR-0125): an owner who has just
        typed theirs correctly into an instance somebody else has been guessing
        at is told to wait, not told they got it wrong.

        A VALUE THIS PAGE DOES NOT RECOGNISE SAYS NOTHING, which is what keeps
        the parameter from being a way to put a sentence of somebody else's
        choosing in front of a visitor.
      */}
      {refused === REFUSED.password && (
        <p className="mt-4 text-sm" role="alert">
          That password was refused.
        </p>
      )}
      {refused === REFUSED.tooMany && (
        <p className="mt-4 text-sm" role="alert">
          Too many passwords have been tried on this instance, so it is checking them slowly now.
          Wait a moment and try again.
        </p>
      )}
    </>
  );
}

function LoggedIn() {
  return (
    <>
      <p className="mt-2 text-muted-foreground text-sm">
        You are logged in, so this browser may change the catalogue.
      </p>
      <div className="mt-6 flex items-center gap-4">
        <form action={logOut}>
          <Button type="submit" variant="outline">
            Log out
          </Button>
        </form>
        <Link className="text-sm hover:underline" href="/import">
          Import
        </Link>
        {/*
          AND THE WAY TO THE OTHER DEVICES (ADR-0043's per-device logout). It is
          here rather than in the header because the header is served to every
          reader and this page is where an owner already comes to deal with
          being logged in -- and because a visitor who found it would be told
          only that they are not the owner.
        */}
        <Link className="text-sm hover:underline" href="/devices">
          Devices
        </Link>
        {/*
          AND THE WAY TO WHAT THE CATALOGUE DOES FOR ITSELF (ADR-0049). Here
          for the same reason Devices is: the header is served to every reader
          and this page is where an owner already comes to deal with being
          logged in, and a visitor who found it would be told only that they
          are not the owner.
        */}
        <Link className="text-sm hover:underline" href="/tasks">
          Tasks
        </Link>
        {/*
          AND THE WAY TO WHAT THIS INSTANCE REACHES (CNCORE-99), here for the
          same reason the two above are. The empty-catalogue notices link
          straight to it, which is where an owner meets it first; this is where
          they come back to it once their catalogue is no longer empty.
        */}
        <Link className="text-sm hover:underline" href="/settings">
          Settings
        </Link>
      </div>
    </>
  );
}
