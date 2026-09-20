import { appRouter } from "@canoncore/api/routers";
import type { DeclaredCredential, Reach, WhyNotNamed } from "@canoncore/providers";
import { Button, buttonVariants } from "@canoncore/ui/components/button";
import { Input } from "@canoncore/ui/components/input";
import { Textarea } from "@canoncore/ui/components/textarea";
import { call } from "@orpc/server";
import { Moment } from "@/components/moment";
import { NotLoggedIn } from "@/components/not-logged-in";
import { oneValue } from "@/components/query-params";
import { Reason } from "@/components/reason";
import { TheirWords } from "@/components/their-words";
import { callerContext } from "@/session";

import { editAllowlist, nameProvider, removeProvider } from "./actions";
import { oneBecause } from "./refusal";

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
 *
 * NO `connection()` HERE, AND THAT IS ADR-0117 OBEYED RATHER THAN SKIPPED, under
 * the same exemption `/search` and `/import` take: the rule is that a read
 * surface declares it needs a request, and the second way of declaring it is "a
 * request-time API the page was going to touch anyway". This one reads the
 * session cookie before it decides whether there is a page at all, so it is
 * dynamic by the thing it exists to do rather than by a line that could be
 * removed.
 *
 * AND THE CHECK THAT RECORD SAYS IS ACTUALLY EARNED IS TAKEN, in the shape this
 * surface makes available: `e2e/settings-page.test.ts` writes a setting and
 * re-reads the same running server, which a page prerendered at build time
 * cannot do. Two instances differing is the usual form of that check; one
 * instance CHANGING its answer is the stronger form, and it is the one a
 * settings surface can make.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await callerContext();
  /*
   * ADR-0044's visitor, told where the door is -- or, on an instance that
   * sets no password, that there is no door (CNCORE-146). The shape is three
   * pages' and lives in `not-logged-in.tsx`, which reads the instance itself.
   *
   * NO LIST AND NO ALLOWLIST, NOT EVEN EMPTY ONES, which is why this returns
   * rather than rendering the page with them withheld. "This instance reaches
   * nothing" and "you are not the person who may ask" are different sentences
   * and only the second is true here -- and the first would hand a stranger
   * the shape of somebody else's network.
   */
  if (context.session === null) {
    return (
      <NotLoggedIn
        title="Settings"
        whoseBusiness="What an instance is configured to reach is its owner's own business."
      />
    );
  }

  const { providers, allowlist } = await call(appRouter.settings.read, {}, { context });
  const asked = await searchParams;
  const refused = oneValue(asked.refused);
  /*
   * WHICH REFUSAL, read apart from WHAT was refused (CNCORE-262). The entry can
   * be blank -- a box of spaces is a real thing an Owner submits -- and
   * `oneValue` reads a blank parameter as an absent one, so a page that took
   * the reason from the entry could not report the one refusal whose entry is
   * blank. It is held to a closed set in `refusal.ts`, because this parameter
   * is in an address the Owner can edit.
   */
  const because = oneBecause(asked.because);

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
                    spellings would be two Providers. And not this page's words,
                    so it wraps where one of them would not (ADR-0142).
                  */}
                  <p className="text-sm">
                    <TheirWords>{provider.baseUrl}</TheirWords>
                  </p>
                  <ReachNotice reach={provider.reach} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <UnlockAt reach={provider.reach} />
                  <form action={removeProvider}>
                    <input name="baseUrl" type="hidden" value={provider.baseUrl} />
                    <Button size="sm" type="submit" variant="outline">
                      Remove
                    </Button>
                  </form>
                </div>
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
        {because === undefined ? null : <NotNamed because={because} entry={refused} />}
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
 * WHAT THE OWNER TYPED THAT WAS NOT A PROVIDER, AND WHICH OF THE THREE IT WAS
 * (CNCORE-262).
 *
 * THE REFUSALS THIS SURFACE HAS TO RENDER, because a re-read cannot report one:
 * "that was not a URL" and "nothing happened" are the same unchanged list, and
 * the Owner typed the entry. That is this file's own docstring, and until this
 * ticket the page honoured it with ONE sentence for three different mistakes.
 *
 * THREE REMEDIES, AND TWO OF THEM WERE WRONG. Nothing typed, two pasted at
 * once, and one entry with no scheme are corrected by typing one, typing fewer,
 * and adding a scheme -- opposite instructions. The page said "it is not a URL
 * ... scheme included" to all three, which is false of the paste (both entries
 * were URLs and both had schemes) and rendered not at all for the blank one.
 * `ReachNotice` below already refuses to collapse three faults into one
 * sentence; this is the same argument at the field above it.
 *
 * THE ENTRY IS ECHOED WHERE THERE IS ONE, through `TheirWords`, since it is the
 * Owner's words and not this page's (ADR-0142). The blank refusal names none:
 * there is nothing to show, and a run of spaces would render as a gap the Owner
 * would read as a missing word.
 *
 * AND THE SENTENCES ARE THIS PAGE'S, never the procedure's. `?because=` is in an
 * address the Owner can edit, so a page that printed text out of the parameter
 * would show a stranger's sentence in CanonCore's own voice; `refusal.ts`
 * admits three words and nothing else, and every word below is written here.
 */
function NotNamed({ because, entry }: { because: WhyNotNamed; entry?: string }) {
  if (because === "nothing-named") {
    return (
      <p className="mt-3 text-muted-foreground text-sm">
        Nothing was named, so nothing changed. A Provider is a URL and nothing more, so name it by
        its base URL, scheme included.
      </p>
    );
  }

  return (
    <p className="mt-3 text-muted-foreground text-sm">
      <WhichEntry entry={entry} />{" "}
      {because === "not-one-provider" ? (
        <>
          was not named, because it is more than one Provider. A Provider is a URL and nothing more,
          so name them one at a time.
        </>
      ) : (
        <>
          was not named, because it is not a URL. A Provider is a URL and nothing more, so name it
          by its base URL, scheme included.
        </>
      )}
    </p>
  );
}

/**
 * The entry the sentence above is about, or what stands in for it.
 *
 * AN ADDRESS NAMING A REASON AND NO ENTRY IS REACHABLE BY HAND, and nothing
 * else: every redirect this app writes carries both. Rather than render a
 * sentence opening with a gap, it opens with a phrase that is true of the state
 * -- the Owner is reading a page they were sent to by editing its address.
 */
function WhichEntry({ entry }: { entry?: string }) {
  if (entry === undefined) return <>That entry</>;
  return (
    <span className="font-medium">
      <TheirWords>{entry}</TheirWords>
    </span>
  );
}

/**
 * A PROVIDER'S READING, IN WHICHEVER OF THREE FAULTS IT IS IN (CNCORE-101).
 *
 * THREE THINGS WITH THREE DIFFERENT FIXES, and the whole job of this component
 * is that they never render alike. A Provider the allowlist refuses, one that
 * did not answer, and one that answered and needs Unlocking send the Owner to
 * three different places -- a setting on this page, their own network, and the
 * Provider's own unlock path -- so a surface that collapsed any two of them
 * would send them to the wrong one. ADR-0121 already made this page pay that
 * cost for the two settings; ADR-0122 extends it to the Provider's end.
 *
 * THE REACHED-AND-NEEDING-NOTHING CASE RENDERS NOTHING, which is the fourth
 * outcome and the ordinary one. Every Provider that existed before ADR-0122
 * declares no credential, and a line reassuring the Owner about each of them is
 * noise on the page where the one that DOES need something has to stand out.
 */
function ReachNotice({ reach }: { reach: Reach }) {
  if (reach.kind === "not-admitted") {
    /*
      WHICH OF THE TWO SETTINGS REFUSES IT, which is ADR-0121's own condition on
      accepting two settings for one concept. An instance that reaches nothing
      has to say which one to go and change, because one answer could not.
    */
    return (
      <p className="text-muted-foreground text-xs">
        The allowlist below does not admit this host, so it is never reached. Add its host or
        address range to the allowlist.
      </p>
    );
  }

  if (reach.kind === "unreachable") {
    /*
      IT DOES NOT SAY "COULD NOT BE REACHED", AND THAT IS THE TRUER SENTENCE
      RATHER THAN THE WEAKER ONE. This branch covers a Provider that never
      answered AND one that answered something `packages/providers` will not
      parse -- a 500, a manifest with a number where its name goes. "Could not
      be reached" is false of the second, and it is false of it directly above a
      reason that says `answered 500`, which is a sentence contradicting itself
      in two lines. `/import`'s `NotReached` reached the same wording by the same
      argument.
    */
    return (
      <p className="text-muted-foreground text-xs">
        Nothing could be read from this Provider. <Reason reason={reach.reason} />
      </p>
    );
  }

  return reach.credential === null ? null : <Credential credential={reach.credential} />;
}

/**
 * WHAT THIS PROVIDER NEEDS, AND WHETHER IT HAS IT (ADR-0122).
 *
 * THE LABEL IS QUOTED BECAUSE IT IS THE PROVIDER'S SENTENCE, which is ADR-0123's
 * rule applied to the one piece of provider prose that is not a failure reason.
 * The Provider is named on the row directly above, so the quotation marks are
 * the whole of what is needed to stop the Owner reading it as CanonCore
 * speaking. Its LENGTH was settled before it arrived, at the same seam and by
 * the same function as every other provider text this app prints, and its WIDTH
 * by the same component (CNCORE-217).
 *
 * THREE STATES THAT SAY THREE DIFFERENT THINGS, and the expired one says WHEN.
 * `expired` alone does not tell the Owner whether the session lapsed a minute
 * ago or three weeks ago, and those are the difference between renewing it and
 * going to find out what else broke.
 */
function Credential({ credential }: { credential: DeclaredCredential }) {
  return (
    <p className="text-muted-foreground text-xs">
      <q>
        <TheirWords>{credential.label}</TheirWords>
      </q>{" "}
      <State credential={credential} />
      {credential.unlockUrl === null ? <PathRefused /> : null}
    </p>
  );
}

/**
 * WHY THERE IS NO LINK, WHEN THERE IS NO LINK.
 *
 * `unlockUrlFor` withholds the URL where the declared path would have left the
 * Provider's own origin, because that value's one destination is an `href` the
 * Owner is about to click and then hand a credential to. Saying NOTHING about
 * that would leave them reading "has not been Unlocked" beside no way to Unlock
 * it -- a Provider that looks merely locked while it is actually misbehaving,
 * which is the collapse of two different faults this surface exists to keep
 * apart.
 *
 * THE PATH ITSELF IS NOT PRINTED. It is the Provider's string and naming the
 * host it points at would put the destination on the page in text, which is most
 * of what withholding the link was for.
 */
function PathRefused() {
  return (
    <>
      {" "}
      CanonCore is not linking to it: the unlock path this Provider declared leads somewhere other
      than the Provider, so it is refused.
    </>
  );
}

function State({ credential }: { credential: DeclaredCredential }) {
  const when = credential.changedAt;
  if (credential.state === "absent") {
    return <>This Provider has not been Unlocked, so it can answer nothing yet.</>;
  }
  if (credential.state === "expired") {
    return (
      <>
        Its Credential lapsed
        <On at={when} />, so it can answer nothing until it is Unlocked again.
      </>
    );
  }
  return (
    <>
      Unlocked
      <On at={when} />.
    </>
  );
}

/**
 * ` on <date>`, or nothing at all where the Provider gave no date.
 *
 * ONE FRAGMENT RATHER THAN TWO IDENTICAL ONES. Both sentences above need the
 * same optional clause, and written out twice they are two places for the
 * spacing to drift -- which on a rendered sentence shows up as a missing space
 * before a date rather than as anything a type would catch.
 *
 * IT DOES NOT RE-CHECK THAT THE PROVIDER SENT A DATE. `cmppManifest` holds
 * `state_changed_at` to `z.iso.datetime()` on the way in and `settings.read`
 * states the same type on the way out, so a value reaching `new Date` here is
 * one both have already accepted. An earlier version parsed defensively and
 * rendered the raw string on `NaN`; that branch could not be reached, and a
 * guard nothing can trip reads as protection while protecting nothing.
 */
function On({ at }: { at: string | null }) {
  if (at === null) return null;
  return (
    <>
      {" "}
      on <Moment at={new Date(at)} />
    </>
  );
}

/**
 * THE LINK, WHICH IS THIS TICKET AFTER ITS CORRECTION (ADR-0122).
 *
 * A LINK AND NEVER A FORM. CNCORE-101 was filed asking for a form CanonCore
 * would render from the Provider's manifest and POST what the Owner typed;
 * MCP's 2026-07-28 revision prohibits exactly that mechanism by name -- "Servers
 * MUST NOT use form mode elicitation to request sensitive information such as
 * passwords, API keys, access tokens" -- and BCP 240 removed OAuth's password
 * grant over the same leak surface. "CanonCore stores nothing" bought NOT AT
 * REST and never bought NEVER SEES IT, because a forwarded value still passes
 * through this app's request handler. So the Owner goes to the Provider and
 * CanonCore holds nothing at all.
 *
 * OFFERED IN EVERY STATE A CREDENTIAL IS DECLARED IN, INCLUDING `valid`. An
 * expired Provider must be re-Unlockable without being removed and re-added,
 * which is a criterion of its own; and a valid one is worth offering too,
 * because a credential the Owner wants to replace early is not a fault anything
 * here would know about.
 *
 * `rel="noreferrer"` BECAUSE THE DESTINATION IS A THIRD PARTY'S. ADR-0031 makes
 * a Provider an untrusted URL, and the referrer would hand it the address of the
 * settings page it was reached from. It is NOT opened in a new tab: the Owner is
 * going there to do something and come back, and `target="_blank"` on a link the
 * Provider chose the destination of is the combination that earns `noopener`
 * arguments this avoids having.
 *
 * WHERE THE LINK IS MISSING, THE NEED IS STILL SHOWN. `unlockUrl` is null when
 * the declared path left the Provider's own origin, which `unlockUrlFor`
 * refuses; the label and the state above still render, because the Provider is
 * up and what it says about itself is still worth the Owner reading.
 */
function UnlockAt({ reach }: { reach: Reach }) {
  if (reach.kind !== "reached" || reach.credential === null) return null;
  const { unlockUrl } = reach.credential;
  if (unlockUrl === null) return null;

  return (
    <a
      className={buttonVariants({ size: "sm", variant: "secondary" })}
      href={unlockUrl}
      rel="noreferrer"
    >
      Unlock it
    </a>
  );
}
