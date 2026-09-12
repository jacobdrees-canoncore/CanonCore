import { appRouter } from "@canoncore/api/routers";
import { Button } from "@canoncore/ui/components/button";
import { Input } from "@canoncore/ui/components/input";
import { Label } from "@canoncore/ui/components/label";
import { call } from "@orpc/server";
import Link from "next/link";

import { oneValue } from "@/components/query-params";
import { callerContext } from "@/session";
import { logIn, logOut } from "./actions";

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
        <LogInForm refused={oneValue(asked.refused) !== undefined} />
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

function LogInForm({ refused }: { refused: boolean }) {
  return (
    <>
      <p className="mt-2 text-muted-foreground text-sm">
        Reading this catalogue needs no password. Changing it does: importing a record, taking a
        container&apos;s ordering, purging a provider.
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
      {refused && (
        <p className="mt-4 text-sm" role="alert">
          That password was refused.
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
      </div>
    </>
  );
}
