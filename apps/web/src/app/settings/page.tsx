import { appRouter } from "@canoncore/api/routers";
import type { DeclaredCredential, Reach } from "@canoncore/providers";
import { Button, buttonVariants } from "@canoncore/ui/components/button";
import { Input } from "@canoncore/ui/components/input";
import { Textarea } from "@canoncore/ui/components/textarea";
import { call } from "@orpc/server";
import { Moment } from "@/components/moment";
import { NotLoggedIn } from "@/components/not-logged-in";
import { Reason } from "@/components/reason";
import { TheirWords } from "@/components/their-words";
import { callerContext } from "@/session";

import { editAllowlist, editProviders, nameProvider, removeProvider } from "./actions";
import {
  oneBecause,
  oneBecauseSavingTheAllowlist,
  oneBecauseSavingTheProviders,
  theEntryRefused,
  UNSHOWABLE_ENTRY,
  type WhyItWasRefused,
  type WhyTheAllowlistWasRefused,
  type WhyTheProvidersWereRefused,
} from "./refusal";

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
  /*
   * THE ENTRY, BOUNDED WHERE IT IS READ (ADR-0123). `?refused=` is in an
   * address anybody can compose, and it lands inside a sentence this page
   * speaks in its own voice, so its LENGTH is not the composer's to choose any
   * more than its WORDS are -- `refusal.ts` holds both rules, one per
   * parameter.
   */
  const refused = theEntryRefused(asked.refused);
  /*
   * WHICH REFUSAL, read apart from WHAT was refused (CNCORE-262). The entry can
   * be blank -- a box of spaces is a real thing an Owner submits -- and
   * `oneValue` reads a blank parameter as an absent one, so a page that took
   * the reason from the entry could not report the one refusal whose entry is
   * blank. It is held to a closed set in `refusal.ts`, because this parameter
   * is in an address the Owner can edit.
   */
  const because = oneBecause(asked.because);
  /*
   * AND THE TWO WHOLESALE SAVES, EACH HELD TO ITS OWN CLOSED SET (CNCORE-329,
   * CNCORE-331). Three controls on this page can be refused and each writes its
   * own sentences, so a word is read under the section that owns it -- which is
   * what stops an allowlist refusal rendering under "Name a Provider", where
   * its remedy would make no sense at all.
   */
  const savingTheAllowlist = oneBecauseSavingTheAllowlist(asked.because);
  const savingTheProviders = oneBecauseSavingTheProviders(asked.because);

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
        {/*
          THREE STATES AND NOT TWO (CNCORE-326). An unreadable setting used to
          be none of them: `settings.read` threw where it was parsed, so this
          page -- the only reader that procedure has -- did not render at all.
          The state it now reports must not be folded into the empty one below
          it: "no Provider is named" is what a FRESH instance says, and telling
          an Owner whose Providers are stored and unreadable that they have
          none would be the likelier reading of the two and the false one.
        */}
        {providers.kind === "unreadable" ? (
          <RepairTheProviders
            asWritten={providers.asWritten}
            because={savingTheProviders}
            entry={refused}
          />
        ) : providers.named.length === 0 ? (
          <p className="mt-4 text-muted-foreground text-sm">
            No Provider is named, so this instance searches none. Name one below.
          </p>
        ) : (
          <>
            {/*
              WHICH OF THE TWO SETTINGS IS THE BROKEN ONE (CNCORE-329, ADR-0121).
              The rows below are real and still removable -- `removeProvider`
              never parses the allowlist -- but not one of them carries a
              reading, because ADR-0034's boundary admits nothing it cannot
              read. Said ONCE above the list rather than on every row: it is a
              fact about the instance, not about any Provider.
            */}
            {providers.kind === "allowlist-unreadable" ? (
              <p className="mt-4 text-muted-foreground text-sm">
                This instance <CannotReadTheAllowlist />, so none of these was reached: the boundary
                that admits a Provider admits nothing it cannot read. Correcting it below is what
                brings them back.
              </p>
            ) : null}
            <ul className="mt-4 flex flex-col divide-y">
              {providers.named.map((provider) => (
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
                    {"reach" in provider ? <ReachNotice reach={provider.reach} /> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {"reach" in provider ? <UnlockAt reach={provider.reach} /> : null}
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
          </>
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
            /*
              THE BROWSER SAYS SO FIRST, AND THE SERVER STILL ANSWERS IT
              (CNCORE-262). `required` is native HTML and needs no script, so
              an empty box is caught before the round trip -- but it is a
              CONVENIENCE and never the check: a hand-composed POST carries no
              browser, and a box of spaces satisfies `required` anyway. The
              refusal behind it is what actually holds, which is why both exist.
            */
            required
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
        {/*
          AND WHETHER THIS INSTANCE CAN READ WHAT IS IN IT (CNCORE-329). The
          parse sat in `settings.read`'s return expression and threw out of the
          only read behind this page, so a stored allowlist that did not parse
          cost the Owner the page -- including this box, which is the one thing
          that repairs it. It renders now, holding their own text.
        */}
        {allowlist.kind === "unreadable" ? (
          <p className="mt-2 text-muted-foreground text-sm">
            This instance <CannotReadTheAllowlist />, so it admits nothing and reaches no Provider.
            Correct it below and save; what is stored is unchanged until you do.
          </p>
        ) : null}
        <form action={editAllowlist} className="mt-4 flex flex-col items-start gap-2">
          <Textarea
            aria-label="The hosts and address ranges a Provider may be fetched from"
            className="max-w-sm"
            defaultValue={allowlist.asWritten}
            name="allowlist"
            placeholder="wiki.example.com, 100.64.0.0/10"
            rows={3}
          />
          <Button type="submit">Save the allowlist</Button>
        </form>
        {savingTheAllowlist === undefined ? null : (
          <AllowlistNotSaved because={savingTheAllowlist} entry={refused} />
        )}
      </section>
    </main>
  );
}

/**
 * WHAT THE OWNER TYPED THAT WAS NOT A PROVIDER, AND WHICH REFUSAL IT MET
 * (CNCORE-262, CNCORE-326).
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
 * admits five words and nothing else, and every word below is written here.
 *
 * FIVE SINCE CNCORE-326, AND THE LAST TWO ARE NOT ABOUT THE ENTRY. The three
 * the Owner's own text can raise are joined by the stored setting that would
 * not parse, and by a refusal this page cannot name at all -- which says only
 * that nothing changed, because naming a cause it was not given is the harm
 * the closed set exists to prevent, arriving from the inside.
 */
function NotNamed({ because, entry }: { because: WhyItWasRefused; entry?: string }) {
  if (because === "nothing-named") {
    return (
      <p className="mt-3 text-muted-foreground text-sm">
        Nothing was named, so nothing changed. <ByItsBaseUrl />
      </p>
    );
  }

  /*
    A REFUSAL THIS PAGE CANNOT NAME SAYS SO, AND STOPS (CNCORE-326). It has no
    "because" clause, because it has no because: the one thing known is that
    the entry was not named and that nothing changed. Writing a cause here that
    the refusal did not carry is what the word below this one exists to stop.
  */
  if (because === "unexplained") {
    return (
      <p className="mt-3 text-muted-foreground text-sm">
        <WhichEntry entry={entry} /> was not named, and this instance did not say why. Nothing
        changed.
      </p>
    );
  }

  return (
    <p className="mt-3 text-muted-foreground text-sm">
      <WhichEntry entry={entry} /> was not named, because <WhyNot because={because} />
    </p>
  );
}

/**
 * THE CLAUSE AFTER "because", one per word that has one.
 *
 * A `switch` RATHER THAN THE `?:` CHAIN IT REPLACES, and that is this ticket's
 * own lesson applied to the file it was found in. The chain ended in an `else`
 * holding "it is not a URL", so a word added to `REFUSED` with no branch here
 * did not fail to compile -- it RENDERED, as whatever the last arm happened to
 * be, telling an Owner to add a scheme to an entry that had one. That is
 * CNCORE-262's defect exactly, waiting behind the same shape that hid this
 * ticket's. Every word is a `case`, and the two that take no clause never
 * reach here.
 *
 * `never` IS WHAT MAKES IT A CHECK. A sixth word with no `case` makes `because`
 * something other than `never` at the end, which does not assign -- so the
 * compiler names the omission rather than the page silently mis-answering it.
 */
function WhyNot({
  because,
}: {
  because: Exclude<WhyItWasRefused, "nothing-named" | "unexplained">;
}) {
  switch (because) {
    case "not-one-provider":
      return (
        <>
          it is more than one Provider. A Provider is a URL and nothing more, so name them one at a
          time.
        </>
      );
    /*
      NOT ABOUT THE ENTRY, AND IT SAYS SO. The other sentences tell the Owner to
      change what they typed; this one must not, because what they typed may
      have been perfect. The Providers already stored would not parse, so there
      was no list to add one to -- a different fault with a different fix, which
      is `ReachNotice`'s argument below applied to the field above it.
    */
    case "setting-unreadable":
      return (
        <>
          this instance <CannotReadWhatIsStored />. That setting has to be readable before another
          can be added to it.
        </>
      );
    case "not-a-url":
      return (
        <>
          it is not a URL. <ByItsBaseUrl />
        </>
      );
    default: {
      const unhandled: never = because;
      return unhandled;
    }
  }
}

/**
 * The remedy two of these sentences share, written once.
 *
 * ONE FRAGMENT RATHER THAN TWO IDENTICAL ONES, which is the argument `On`
 * below already makes in this file: the same clause written out twice is two
 * places for it to drift, and on a rendered sentence that shows up as wording
 * a reader meets in two versions rather than as anything a type would catch.
 */
function ByItsBaseUrl() {
  return <>A Provider is a URL and nothing more, so name it by its base URL, scheme included.</>;
}

/**
 * The fault two of these sentences share, written once (CNCORE-326).
 *
 * TWO SECTIONS SAY IT AND THEY SAY DIFFERENT THINGS WITH IT. The Providers
 * section states what is true of the LIST -- there is none to show; the notice
 * under the box states what became of the ENTRY the Owner just typed. Both rest
 * on the one fact, and `ByItsBaseUrl` above is this file's own argument for why
 * that fact is spelled in one place: the same clause written out twice is two
 * places for it to drift, which shows up as wording a reader meets in two
 * versions rather than as anything a type would catch.
 */
function CannotReadWhatIsStored() {
  return <>cannot read the Providers it already has</>;
}

/**
 * THE ONE CONTROL THAT WORKS WHEN THE PROVIDERS SETTING WILL NOT PARSE
 * (CNCORE-331).
 *
 * A TEXTAREA WHERE THE LIST WOULD BE, AND NEVER BESIDE IT. A Provider is a
 * source with an identity (ADR-0031), so a row with a Remove button is the
 * right control for one and this is not an improvement on it. It renders
 * INSTEAD of a list that cannot be rendered, which is also what keeps the two
 * from disagreeing: an Owner is never offered both a list and the raw text of
 * the setting behind it, with a Save on each.
 *
 * IT HOLDS THEIR OWN TEXT, WHICH IS THE WHOLE REPAIR. `editProviders` parses
 * what is SUBMITTED and never what is stored, so this box is live in exactly
 * the state where `nameProvider` and `removeProvider` both refuse. An empty
 * box is a legal save and clears the setting outright, which is the exit for
 * an Owner who cannot see what is wrong with it.
 *
 * THE SENTENCE IS A STATEMENT AND NOW ALSO AN INSTRUCTION. ADR-0197 wrote that
 * it "states the position plainly rather than pointing at a control that would
 * refuse" -- correct while there was no such control, and the reason this half
 * was left. There is one now, so it points.
 */
function RepairTheProviders({
  asWritten,
  because,
  entry,
}: {
  asWritten: string;
  because?: WhyTheProvidersWereRefused;
  entry?: string;
}) {
  return (
    <>
      <p className="mt-4 text-muted-foreground text-sm">
        This instance <CannotReadWhatIsStored />, so none can be listed. Naming a Provider reads
        that setting and so does removing one, so both are refused until it is readable. Correct it
        below, one Provider per line, or empty the box to start again.
      </p>
      <form action={editProviders} className="mt-4 flex flex-col items-start gap-2">
        <Textarea
          aria-label="The base URLs this instance searches, one per line"
          className="max-w-sm"
          defaultValue={asWritten}
          name="providers"
          placeholder="http://provider-wiki:8080"
          rows={3}
        />
        <Button type="submit">Save the Providers</Button>
      </form>
      {because === undefined ? null : <ProvidersNotSaved because={because} entry={entry} />}
    </>
  );
}

/**
 * WHY THE PROVIDERS WERE NOT SAVED, AND WHICH LINE DID IT (CNCORE-331).
 *
 * THE ENTRY IS NAMED, WHICH IS THE DIFFERENCE FROM THE BOX ABOVE. "Name a
 * Provider" takes one entry and the Owner is looking straight at it; this
 * takes a LIST, so "an entry in it is not a URL" sends them reading their own
 * setting line by line for the one that is wrong. `SettingNotRead` carries the
 * line for exactly this, and it rides in `?refused=` as every other echoed
 * value on this page does.
 *
 * A `switch` WITH A `never` DEFAULT OVER A SET OF ONE, which looks like
 * ceremony and is the check. A second word added to
 * `REFUSED_SAVING_THE_PROVIDERS` makes `because` something other than this
 * literal, so the compiler names the missing branch -- where an `if` or a bare
 * sentence would render the wrong one. That is this page's own lesson: the
 * `?:` chain `WhyNot` replaced fell through to "it is not a URL", which is the
 * very sentence below.
 */
function ProvidersNotSaved({
  because,
  entry,
}: {
  because: WhyTheProvidersWereRefused;
  entry?: string;
}) {
  switch (because) {
    case "providers-not-a-url":
      return (
        <p className="mt-3 text-muted-foreground text-sm">
          That list was not saved, because <WhichEntry entry={entry} /> is not a URL.{" "}
          <ByItsBaseUrl />
        </p>
      );
    default: {
      const unhandled: never = because;
      return unhandled;
    }
  }
}

/**
 * WHY THE ALLOWLIST WAS NOT SAVED, one sentence per rule (CNCORE-329).
 *
 * TWO REMEDIES THAT ARE NOT THE SAME INSTRUCTION, which is the whole reason
 * this reads `?because=` rather than saying "an entry would not read". A
 * wildcard is DELETED and replaced by the hosts it stood for; a malformed
 * range is CORRECTED where it stands. Told the wrong one, an Owner edits the
 * wrong entry -- which is CNCORE-262's defect, and this is the setting beside
 * the one that ticket was about.
 *
 * A `switch` WITH A `never` DEFAULT, which is `WhyNot`'s lesson below and was
 * learned on this page: the `?:` chain it replaced ended in an `else`, so a
 * word with no branch rendered as whatever the last arm happened to be.
 *
 * THE SAVE IS REPORTED HERE AND NOT UNDER "NAME A PROVIDER", because a
 * sentence about wildcards under a box that takes one URL is an instruction
 * about a control the Owner was not using. `refusal.ts` holds a set per
 * control for exactly this.
 */
function AllowlistNotSaved({
  because,
  entry,
}: {
  because: WhyTheAllowlistWasRefused;
  entry?: string;
}) {
  return (
    <p className="mt-3 text-muted-foreground text-sm">
      <WhichEntry entry={entry} /> was not saved, because <WhyNotAllowed because={because} />
    </p>
  );
}

function WhyNotAllowed({ because }: { because: WhyTheAllowlistWasRefused }) {
  switch (because) {
    case "allowlist-wildcard":
      return (
        <>
          the Allowlist takes exact hosts and address ranges, and no wildcards. Name the hosts it
          stood for, or the range that covers them.
        </>
      );
    case "allowlist-not-a-cidr":
      return (
        <>
          it is not an address range this instance can read. A range is an address and a prefix, as
          in <span className="font-medium">100.64.0.0/10</span>.
        </>
      );
    default: {
      const unhandled: never = because;
      return unhandled;
    }
  }
}

/**
 * The fault the Allowlist's two sentences share, written once (CNCORE-329).
 *
 * ONE FRAGMENT FOR TWO SECTIONS, which is `CannotReadWhatIsStored`'s argument
 * below at the setting beside it. The Providers section says what follows for
 * the LIST -- none of it was reached; the Allowlist section says what follows
 * for the BOUNDARY -- it admits nothing. One fact, two consequences, and the
 * clause naming the fact is spelled in one place so the two cannot drift into
 * wording a reader meets in two versions.
 */
function CannotReadTheAllowlist() {
  return <>cannot read the Allowlist it already has</>;
}

/**
 * The entry the sentence above is about, or what stands in for it.
 *
 * AN ADDRESS NAMING A REASON AND NO ENTRY IS REACHABLE BY HAND, and nothing
 * else: every redirect this app writes carries both. Rather than render a
 * sentence opening with a gap, it opens with a phrase that is true of the state
 * -- the Owner is reading a page they were sent to by editing its address.
 *
 * AND A THIRD STATE, WHICH IS CANONCORE'S OWN WORDS ABOUT THE ENTRY RATHER
 * THAN THE ENTRY (ADR-0179). An entry made only of stripped characters has
 * nothing to show, so `theEntryRefused` answers with a sentence describing it.
 * That sentence must NOT go through `TheirWords`: that component is for
 * somebody else's text, and the `font-medium` around it is how this page marks
 * a value as QUOTED. Rendering our own description there would attribute it to
 * the Owner -- ADR-0123's `wrote` distinction, lost at the last inch.
 */
function WhichEntry({ entry }: { entry?: string }) {
  if (entry === undefined) return <>That entry</>;
  if (entry === UNSHOWABLE_ENTRY) return <>{entry}</>;
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
