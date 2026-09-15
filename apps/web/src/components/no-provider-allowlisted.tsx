import { Card, CardDescription, CardHeader, CardTitle } from "@canoncore/ui/components/card";
import Link from "next/link";

/**
 * WHY AN INSTANCE REACHES NOTHING, when the reason is the allowlist.
 *
 * ADR-0034 makes the allowlist empty by default and the empty value refuses
 * every provider. That is the safe end of the failure and it is also completely
 * silent: with nothing allowlisted, an instance nobody has configured and an
 * instance that is broken look identical from a page. Two shards of the
 * competitor sweep rated exactly this first run HIGH.
 *
 * WHERE THE SETTING IS, NAMED AND LINKED (CNCORE-99). "Allowlist a provider" is
 * the step, and until that ticket the thing an owner had to type was an
 * environment variable -- so the notice named `PROVIDER_ALLOWLIST`, because one
 * that gestured at the step without naming it would leave them exactly where
 * the README left them. The setting is on a page of this app now, so what the
 * notice owes them is the way TO it: a link they can follow rather than a
 * variable they have to go and find a file for.
 *
 * ONE COMPONENT RATHER THAN A COPY PER SURFACE (CNCORE-177). `/` and `/import`
 * both say this, and they said it in two hand-written copies that had drifted:
 * the second had lost the last sentence below, which is the one telling a
 * reader that an empty result is configuration rather than a defect. A
 * paragraph written twice is two places for a reader's answer to go missing
 * from one of them, and nothing was watching either. `not-logged-in.tsx` beside
 * this file carries the same argument for the same reason.
 *
 * WHAT VARIES IS ONE CLAUSE AND IT IS PASSED IN. The front page speaks for the
 * whole instance and `/import` for the operations that page in particular
 * cannot perform, so "what this stops" is the surface's to say and everything
 * around it is not.
 */
export function NoProviderAllowlisted({ whatIsStopped }: { whatIsStopped: string }) {
  return (
    <section aria-labelledby="no-provider" className="mt-6">
      <Card>
        <CardHeader>
          {/*
            A REAL HEADING INSIDE THE PRIMITIVE. `CardTitle` and `EmptyTitle`
            both render a `div`, so a section labelled by one is labelled by
            something that is not a heading -- and a reader navigating the page
            by heading finds only the `h1`. The id goes on the `h2` so
            `aria-labelledby` points at the heading itself.
          */}
          <CardTitle>
            <h2 id="no-provider">No provider is allowlisted</h2>
          </CardTitle>
          <CardDescription>
            CanonCore reaches a provider only when its host or address range is on the allowlist in{" "}
            <Link className="underline" href="/settings">
              Settings
            </Link>
            . That setting is empty until you write one, and empty refuses every provider, so{" "}
            {whatIsStopped}. An empty result here is this setting rather than a fault.
          </CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}
