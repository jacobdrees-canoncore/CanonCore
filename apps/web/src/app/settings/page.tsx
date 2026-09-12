import { appRouter } from "@canoncore/api/routers";
import { Button } from "@canoncore/ui/components/button";
import { Input } from "@canoncore/ui/components/input";
import { Textarea } from "@canoncore/ui/components/textarea";
import { call } from "@orpc/server";
import Link from "next/link";

import { oneValue } from "@/components/query-params";
import { callerContext } from "@/session";

import { editAllowlist, nameProvider, removeProvider } from "./actions";

/**
 * WHERE THE OWNER SAYS WHAT THIS INSTANCE REACHES (CNCORE-99, ADR-0121).
 *
 * UNTIL THIS PAGE IT WAS A FILE AND A RESTART. Both settings were environment
 * variables read once at boot, so connecting a source meant editing a file on
 * the machine and bringing the instance down -- which is not a thing an owner
 * should have to do to add a Provider, and is the gap CNCORE-96's problem
 * statement opens with. They are rows now, read per request, so a Provider named
 * here is searched by the next request.
 *
 * NOT A READ, WHATEVER IT LOOKS LIKE. ADR-0044 leaves the CATALOGUE open,
 * because the demo is read-only with no login and ADR-0072 gives a visitor
 * everything on it. What this instance is configured to reach is not in the
 * catalogue -- and the allowlist names the hosts and address ranges on the
 * owner's own network, which `provider.allowlisted` answers a yes-or-no to
 * anybody precisely so that it never has to disclose (ADR-0034). So a visitor
 * here is told where the door is and nothing else, exactly as `/devices` does.
 *
 * TWO SETTINGS, SHOWN AS TWO THINGS, because they hold different things and
 * neither is derivable from the other (ADR-0121): the allowlist holds HOSTS AND
 * RANGES and says what MAY be reached, the list above it holds URLs and says
 * what IS reached. A Provider needs to be in both, so the commonest real
 * mistake is naming one and forgetting to allowlist its host -- and that record
 * accepts that cost on the condition that the SURFACE says which of the two is
 * refusing. That is the notice on the rows below.
 *
 * IT NEEDS NO JAVASCRIPT, like every other form in this app: Name, Remove and
 * Save are ordinary form posts and the answer is the re-rendered page.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await callerContext();
  if (context.session === null) return <NotLoggedIn />;

  const { providers, allowlist } = await call(appRouter.settings.read, {}, { context });
  const refused = oneValue((await searchParams).refused);

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-medium">Settings</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        What this instance reaches. Both settings take effect on the next request, so nothing here
        needs a restart.
      </p>

      <section aria-labelledby="providers" className="mt-8">
        <h2 className="text-xl font-medium" id="providers">
          Providers
        </h2>
        <p className="mt-2 text-muted-foreground text-sm">
          The Providers this instance searches, as their base URLs. A Provider is a URL answering
          the CMPP contract rather than code you install, so nothing named here runs inside your
          catalogue.
        </p>
        {providers.length === 0 ? (
          <p className="mt-4 text-muted-foreground text-sm">
            No Provider is named, so this instance searches none. Name one below.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y">
            {providers.map((provider) => (
              <li
                className="flex items-center justify-between gap-4 py-3"
                data-provider={provider.baseUrl}
                key={provider.baseUrl}
              >
                <div>
                  {/*
                    THE URL AS THE OWNER TYPED IT, which is the Provider's
                    IDENTITY (ADR-0031) and what the Source row on every
                    imported claim carries. Nothing here tidies it, because two
                    spellings would be two Providers.
                  */}
                  <p className="text-sm">{provider.baseUrl}</p>
                  {provider.admitted ? null : (
                    /*
                      WHICH OF THE TWO SETTINGS REFUSES IT, which is ADR-0121's
                      own condition on accepting two settings for one concept.
                      An instance that reaches nothing has to say which one to go
                      and change, because one answer could not.
                    */
                    <p className="text-muted-foreground text-xs">
                      The allowlist below does not admit this host, so it is never reached. Add its
                      host or address range to the allowlist.
                    </p>
                  )}
                </div>
                <form action={removeProvider}>
                  <input name="baseUrl" type="hidden" value={provider.baseUrl} />
                  <Button size="sm" type="submit" variant="outline">
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="name-a-provider" className="mt-8">
        <h2 className="text-xl font-medium" id="name-a-provider">
          Name a Provider
        </h2>
        <form action={nameProvider} className="mt-4 flex items-start gap-2">
          <Input
            aria-label="The Provider's base URL"
            className="max-w-sm"
            defaultValue=""
            name="baseUrl"
            placeholder="http://provider-wiki:8080"
            type="text"
          />
          <Button type="submit">Name it</Button>
        </form>
        {refused === undefined ? null : (
          /*
            THE ONE REFUSAL THIS SURFACE HAS TO RENDER. An entry that is not a
            URL is the one thing on this page a person can get wrong, and a
            re-read cannot report it: "that was not a URL" and "nothing
            happened" are the same unchanged list. The entry is echoed so the
            owner can see which one it was.
          */
          <p className="mt-3 text-muted-foreground text-sm">
            <span className="font-medium">{refused}</span> was not named, because it is not a URL. A
            Provider is a URL and nothing more, so name it by its base URL, scheme included.
          </p>
        )}
      </section>

      <section aria-labelledby="allowlist" className="mt-8">
        <h2 className="text-xl font-medium" id="allowlist">
          Allowlist
        </h2>
        <p className="mt-2 text-muted-foreground text-sm">
          The hosts and address ranges a Provider may be fetched from, separated by commas or
          whitespace. A different setting from the Providers above and not derivable from it: that
          list says what IS reached, this says what MAY be reached.
        </p>
        {/*
          THE SENTENCE THAT USED TO LIVE IN `.env.example` (CNCORE-99). ADR-0034
          makes the empty value REFUSE EVERY PROVIDER, which is the safe end of
          the failure and is completely silent -- an owner who reads an empty box
          as "nothing restricted yet" has the meaning exactly backwards, and this
          is the only place that can be corrected before it happens.
        */}
        <p className="mt-2 text-muted-foreground text-sm">
          <span className="font-medium">Empty refuses every Provider</span>, which is what a fresh
          instance starts with: it reaches nothing at all until you name a host here.
        </p>
        <form action={editAllowlist} className="mt-4 flex flex-col items-start gap-2">
          <Textarea
            aria-label="The hosts and address ranges a Provider may be fetched from"
            className="max-w-sm"
            defaultValue={allowlist}
            name="allowlist"
            placeholder="wiki.example.com, 100.64.0.0/10"
            rows={3}
          />
          <Button type="submit">Save the allowlist</Button>
        </form>
      </section>
    </main>
  );
}

/**
 * ADR-0044's visitor, who is told where the door is and nothing else.
 *
 * NO LIST AND NO ALLOWLIST, NOT EVEN EMPTY ONES. "This instance reaches nothing"
 * and "you are not the person who may ask" are different sentences, and only the
 * second is true here -- and the first would hand a stranger the shape of
 * somebody else's network.
 */
function NotLoggedIn() {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-medium">Settings</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        What an instance is configured to reach is its owner's own business, so this page asks you
        to be them first.
      </p>
      <Link className="mt-6 inline-block text-sm hover:underline" href="/login">
        Log in
      </Link>
    </main>
  );
}
