import { changeProviderUrls, readProviderSettings, writeProviderSettings } from "@canoncore/db";
import {
  type Allowlist,
  failureReason,
  nameProvider,
  OutboundRefused,
  ProviderNotNamed,
  parseAllowlist,
  parseProviderUrls,
  REASON_MAX_LENGTH,
  reachProviders,
  removeProvider,
  SettingNotRead,
  type WhySettingNotRead,
} from "@canoncore/providers";
import { z } from "zod";

import { ownerProcedure } from "../index";

/**
 * WHAT A SETTING THIS INSTANCE CANNOT READ IS ANSWERED WITH.
 *
 * ONE SENTENCE FOR THE THREE WRITES BELOW, because it is one fact about all of
 * them: the value did not survive the parse every read of it goes through. Three
 * copies would be three chances for the wording to drift while the rule stayed
 * the same. The SPECIFIC refusal still reaches the owner -- each handler passes
 * `OutboundRefused`'s own message, which names the entry and what is wrong with
 * it -- and this is the fallback the code carries.
 */
const NOT_A_SETTING = {
  BAD_REQUEST: { message: "That is not a setting this instance can read." },
} as const;

/**
 * THE THREE WAYS ONE BOX CAN FAIL TO NAME A PROVIDER (CNCORE-262).
 *
 * THREE CODES RATHER THAN ONE, because three different corrections follow from
 * them and a caller cannot pick one from a status. An entry that is nothing, an
 * entry that is several and an entry that is not a URL send the Owner to type
 * one, to type fewer, and to add a scheme; `BAD_REQUEST` covered all three, so
 * the settings surface could only ever print one sentence and printed the one
 * about schemes at an Owner who had pasted two URLs that both had schemes.
 *
 * `status: 400` ON EVERY ONE, AND IT IS NOT DECORATION. oRPC resolves a status
 * as `status ?? COMMON_ORPC_ERROR_DEFS[code]?.status ?? 500` (read in
 * `@orpc/client@1.15.1`), and none of these three is a code it knows -- so
 * leaving it off would answer 500, `isARefusal` in `answer.ts` would stop
 * reading them as refusals, and the Server Action would rethrow into Next's
 * bare `Internal Server Error`. These ARE refusals: the Owner asked for
 * something this instance will not do, which is an answer.
 *
 * THE MESSAGES ARE THE FALLBACK AND NOT THE SURFACE'S WORDS. `ProviderNotNamed`
 * carries its own sentence and it is passed through below; what an API caller
 * and a log read is that one. The settings page reads the CODE and writes its
 * own sentence, because a procedure's message copied into an address is a
 * sentence nobody owns (`settings/actions.ts`).
 */
const NOT_ONE_PROVIDER = {
  NOTHING_NAMED: {
    status: 400,
    message: "No provider was named.",
  },
  NOT_ONE_PROVIDER: {
    status: 400,
    message: "That is more than one provider, and they are named one at a time.",
  },
  NOT_A_URL: {
    status: 400,
    message: "That entry is not a URL, and a provider is a URL and nothing more.",
  },
} as const;

/**
 * AN ENTRY INSIDE A WHOLESALE SETTING THAT THIS INSTANCE CANNOT READ
 * (CNCORE-329, CNCORE-331).
 *
 * ONE CODE FOR BOTH SETTINGS, WITH THE RULE AS DATA, and that is the shape
 * `placement.ts` already uses for the same problem: a refusal with several
 * causes carries the cause rather than being split into several codes. Three
 * codes here -- one per rule -- would make the API surface grow every time
 * ADR-0034 gains a rule, and the SURFACE would still have to map them to its
 * own words, which is the mapping `why` already is.
 *
 * SEPARATE FROM `NOT_ONE_PROVIDER`'S THREE, WHICH IT LOOKS LIKE AND IS NOT.
 * Those judge one entry the Owner typed into a BOX, and their remedies are
 * about that entry: type one, type fewer, add a scheme. This judges one line
 * inside a TEXT the Owner replaced wholesale, so the surface has to say WHICH
 * line as well as what is wrong with it -- the Owner cannot be sent back to
 * "the entry" when they submitted forty of them.
 *
 * `status: 400` FOR THE REASON `NOT_ONE_PROVIDER` STATES, and it is load
 * bearing rather than decoration: oRPC does not know this code, so an omitted
 * status resolves to 500, `isARefusal` in `answer.ts` stops reading it as a
 * refusal, and the Server Action rethrows into Next's bare
 * `Internal Server Error`. This IS a refusal -- the Owner asked for something
 * this instance will not do, which is an answer.
 *
 * THE ENTRY IS NOT BOUNDED HERE AND IS BOUNDED AT THE PAGE, which ADR-0156
 * settles: `?refused=` is in an address anybody can compose, so a ceiling
 * applied where the redirect is BUILT would guard the one path that was never
 * the problem. `theEntryRefused` cuts it at the READ, which is the seam that
 * catches a hand-typed address too. It is the Owner's own text either way --
 * ADR-0123's ceiling is for a STRANGER's, and the stranger here is whoever
 * wrote the URL rather than whoever wrote the setting.
 */
const NOT_A_READABLE_SETTING = {
  SETTING_NOT_READ: {
    status: 400,
    message: "An entry in that setting is not one this instance can read.",
    data: z.object({
      /** The one line that would not read, as the Owner wrote it. */
      entry: z.string(),
      /** Which rule it broke, so the surface can pick the matching remedy. */
      why: z.enum(["wildcard", "not-a-cidr", "not-a-url"] satisfies WhySettingNotRead[]),
    }),
  },
} as const;

/**
 * WHICH REFUSAL TO ANSWER WITH, read off the one the parse raised.
 *
 * A MAP RATHER THAN A CHAIN OF `if`s, so the three words `@canoncore/providers`
 * can raise and the three this router can answer are checked against each other
 * by the type rather than by eye: a fourth added there with no answer here
 * fails to compile, which is the only way a new refusal cannot quietly arrive
 * as whatever the last branch happened to be.
 */
const ANSWERED_AS = {
  "nothing-named": "NOTHING_NAMED",
  "not-one-provider": "NOT_ONE_PROVIDER",
  "not-a-url": "NOT_A_URL",
} as const satisfies Record<ProviderNotNamed["why"], keyof typeof NOT_ONE_PROVIDER>;

/**
 * HOW FAR THIS INSTANCE GOT WITH ONE NAMED PROVIDER, and what it found there.
 *
 * THREE OUTCOMES THE OWNER MUST BE ABLE TO TELL APART, which is CNCORE-101's
 * own acceptance criterion: a Provider that needs Unlocking, one that cannot be
 * reached, and one the allowlist never admitted are three different faults with
 * three different fixes. ADR-0121 already made the surface pay the cost of two
 * settings for one concept by saying WHICH of the two refuses a Provider; this
 * is that obligation extended to the Provider's own end of the wire.
 *
 * A DISCRIMINATED UNION IN THE CONTRACT RATHER THAN OPTIONAL FIELDS, so the
 * OpenAPI document a caller reads says the impossible combinations are
 * impossible: a credential belongs only to a Provider that answered, and a
 * reason only to one that did not. `@canoncore/providers` owns the shape and
 * this states it, the same arrangement `failureReason` is already under.
 *
 * IT REPLACES `admitted: boolean`, which said one of these three things and left
 * the page to guess the other two. Two fields for one fact is two chances for
 * them to disagree.
 */
const providerReach = z.discriminatedUnion("kind", [
  /** ADR-0034's config boundary refuses this Provider's host, so nothing was sent. */
  z.object({ kind: z.literal("not-admitted") }),
  /** Admitted, and it did not answer -- or answered something CMPP does not accept. */
  z.object({ kind: z.literal("unreachable"), reason: failureReason }),
  /**
   * It answered a manifest. `credential: null` is a Provider that needs nothing,
   * which is every Provider that existed before ADR-0122.
   *
   * NOTHING HERE CAN HOLD A CREDENTIAL, and that is the point rather than an
   * omission. CanonCore renders the label, the state and a LINK to the
   * Provider's own unlock path; the value goes from the Owner to the Provider
   * and never through this app, not even in transit (ADR-0122).
   */
  z.object({
    kind: z.literal("reached"),
    credential: z
      .object({
        /**
         * One sentence for the Owner, in the Provider's words.
         *
         * BOUNDED IN THE CONTRACT AND NOT ONLY IN THE HANDLER, which is the rule
         * `failureReason` states for the same kind of string: the ceiling belongs
         * in the output schema a caller is held to rather than being an invariant
         * they take on trust from a handler that remembered it, and stated in
         * the OpenAPI document a caller reads (CNCORE-212). `min(1)` is the floor
         * `cmppManifest` guarantees where the manifest is read (CNCORE-165), so a
         * blank label is a bug here rather than an empty quotation on the page.
         */
        label: z.string().min(1).max(REASON_MAX_LENGTH),
        /**
         * Where the Owner goes, or null where the declared path left the
         * Provider and `unlockUrlFor` refused it.
         *
         * `z.url()` RATHER THAN `z.string()`, because this value is a third
         * party's and its one destination is an `href` the Owner clicks.
         */
        unlockUrl: z.url().nullable(),
        state: z.enum(["absent", "valid", "expired"]),
        /**
         * When it last became that, or null where nothing was ever supplied.
         *
         * STATED AS A DATETIME rather than as a string, so the page may render it
         * as one without re-deciding whether it is one.
         */
        changedAt: z.iso.datetime().nullable(),
      })
      .nullable(),
  }),
]);

/**
 * THE PROVIDERS THIS INSTANCE NAMES, OR THAT THE SETTING HOLDING THEM DOES NOT
 * PARSE (CNCORE-326).
 *
 * A THIRD STATE THAT WAS A THROW. `parseProviderUrls` refuses a stored string
 * it cannot read, and it was called in this procedure's return expression --
 * so the one read behind `/settings` raised a bare `OutboundRefused`, which is
 * not an `ORPCError` and carries neither code nor status. `answer.ts` reads a
 * refusal off `status < 500` and would not have recognised it; there is no
 * error boundary in `apps/web`; and the page renders this read before anything
 * else it shows. The Owner lost the page.
 *
 * A UNION RATHER THAN AN EMPTY LIST, and it is the same argument `providerReach`
 * above already makes against `admitted: boolean`. "No Provider is named" is
 * what an empty list says, and the page says exactly that sentence for it --
 * which would be a lie told to an Owner whose Providers are stored and
 * unreadable, and the likelier reading, since it is the state a fresh instance
 * is in. Two facts must not share one shape.
 *
 * AND IT MAKES THE PAGE HANDLE IT RATHER THAN HOPE. This ticket exists because
 * a fourth outcome had no branch and fell through in silence; a union is the
 * one shape where the fourth cannot be forgotten, since a page that ignores it
 * fails to compile. `refusal.ts` already states that reasoning for the codes it
 * holds against `WhyNotNamed`.
 *
 * `unreadable` CARRIES NOTHING, ON PURPOSE. `OutboundRefused`'s message names
 * the entry that would not parse, and it is the OWNER'S OWN configured string:
 * ADR-0123 makes whose words a reader is shown the question this app answers at
 * every seam, and the surface writes its own sentence from the state rather
 * than quoting a refusal into the page. The message goes on reaching a log and
 * an API caller through the writes below, which is where it is read by somebody
 * who can act on it.
 */
const providersConfigured = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("read"),
    /** Every Provider the setting named, which may be none at all. */
    named: z.array(
      z.object({
        /** As the owner typed it, which is the provider's identity (ADR-0031). */
        baseUrl: z.string().min(1),
        reach: providerReach,
      }),
    ),
  }),
  /**
   * THE PROVIDERS READ AND THE ALLOWLIST DID NOT, so they are named and none of
   * them was reached (CNCORE-329).
   *
   * A THIRD ARM RATHER THAN A FOURTH `Reach`, and the difference is whose fact
   * it is. "This instance cannot read the boundary that admits anything" is
   * true of the INSTANCE, not of any one Provider -- carried on each row it
   * would render as the same sentence repeated down the page, and
   * `@canoncore/providers` would hold a per-Provider shape for something no
   * Provider has anything to do with.
   *
   * NO `reach`, WHICH IS THE POINT RATHER THAN AN OMISSION. ADR-0034 makes the
   * allowlist the boundary every config URL is held to, so nothing may be sent
   * until it parses: `not-admitted` would be a lie (the allowlist has not
   * refused this host, it has failed to be read) and `unreachable` would be a
   * lie about a request nobody made. The honest answer is that there is no
   * reading, and a shape with no field for one is how it stays honest.
   *
   * THE LIST IS STILL ANSWERED, because Remove still works: `removeProvider`
   * parses the Providers string and never the allowlist, so these rows are the
   * Owner's to act on while the setting beside them is broken.
   */
  z.object({
    kind: z.literal("allowlist-unreadable"),
    named: z.array(z.object({ baseUrl: z.string().min(1) })),
  }),
  /**
   * The stored setting did not survive the parse every read of it goes through.
   *
   * IT CARRIES THE STRING, AND THAT IS THE REPAIR RATHER THAN A QUOTATION
   * (CNCORE-331). ADR-0197 wrote that this arm "carries nothing, on purpose",
   * and what it was refusing was the REFUSAL'S MESSAGE -- a sentence about the
   * Owner's setting, written by `@canoncore/providers`, which the page must
   * not speak in its own voice. This is a different value: the Owner's OWN
   * stored text, rendered into the textarea that replaces it, exactly as the
   * allowlist's has always been. Withholding it would hand them an empty box
   * whose Save wipes the setting they came to fix.
   */
  z.object({ kind: z.literal("unreadable"), asWritten: z.string() }),
]);

/**
 * THE PROVIDERS SECTION'S THREE STATES, published so a reader can NARROW them
 * rather than restate them.
 *
 * ONE EXPORT RATHER THAN A SHAPE SPELLED OUT AT EACH READER. `settings.test.ts`
 * holds a helper that takes this union and hands back the read arm's rows; it
 * described the union structurally instead, and TypeScript then inferred the
 * row type from the WRONG arm -- every caller's rows came back as the arm with
 * no `reach` on it. A union restated by hand is a union free to drift from the
 * contract, and this one drifted within the hour of gaining a third arm.
 */
export type ProvidersConfigured = z.output<typeof providersConfigured>;

/**
 * ADR-0034's ALLOWLIST AS THE OWNER WROTE IT, AND WHETHER IT READS (CNCORE-329).
 *
 * THE TEXT IS ANSWERED IN BOTH ARMS, AND THAT IS THE WHOLE REPAIR ROUTE. The
 * textarea renders this value, so withholding it on the arm where it does not
 * parse would take away the one control that can fix it -- the Owner would be
 * shown an empty box, and saving it would replace their allowlist with nothing.
 * `editAllowlist` parses only what is SUBMITTED, never what is stored, so the
 * box is live in exactly the state this arm names.
 *
 * A UNION RATHER THAN A FLAG BESIDE THE STRING, matching the Providers above:
 * a page that ignores the second arm fails to compile, which is the property
 * ADR-0197 asks a third state to have.
 *
 * IT IS NOT DERIVED FROM `providers` AND MUST NOT BE. The two are separate
 * settings and neither follows from the other (ADR-0121): an instance can have
 * both bad, and the surface owes the Owner both sentences, since fixing one
 * would otherwise send them round again for the other.
 */
const allowlistConfigured = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("read"), asWritten: z.string() }),
  z.object({ kind: z.literal("unreadable"), asWritten: z.string() }),
]);

/**
 * THE PROVIDERS A STORED STRING NAMES, or nothing where it does not parse.
 *
 * THE REFUSAL IS TURNED INTO AN ABSENCE HERE AND NOWHERE ELSE, so the handler
 * above reads as the two answers it has rather than as a `try` around a return
 * expression. Only `OutboundRefused` is caught, which is the rule the three
 * writes below already keep in their own words: a bare catch would answer
 * "this instance cannot read its Providers" for a bug in the parser.
 */
function theProvidersStored(configured: string): string[] | undefined {
  try {
    return parseProviderUrls(configured);
  } catch (cause) {
    if (cause instanceof OutboundRefused) return undefined;
    throw cause;
  }
}

/**
 * ADR-0034's boundary as a stored string names it, or nothing where it does not
 * parse (CNCORE-329).
 *
 * THE SAME SHAPE AS `theProvidersStored` ABOVE AND DELIBERATELY NOT THE SAME
 * FUNCTION. They call different parsers over different settings; what they
 * share is a three-line `try`, and a generic taking a parser would make one
 * function whose name could only say "parse something, catching one class" --
 * which is what the two call sites already say in fewer words.
 */
function theAllowlistStored(configured: string): Allowlist | undefined {
  try {
    return parseAllowlist(configured);
  } catch (cause) {
    if (cause instanceof OutboundRefused) return undefined;
    throw cause;
  }
}

/**
 * PARSES WHAT THE OWNER SUBMITTED, AND TURNS ITS REFUSAL INTO ONE THIS SURFACE
 * DECLARES (CNCORE-329, CNCORE-331).
 *
 * ONE FUNCTION FOR THE TWO WHOLESALE WRITES, because it is one rule about both:
 * a Setting is saved as a whole text, so the refusal has to name the LINE that
 * broke it and which rule it broke. Written out twice it would be two places
 * for the mapping to drift, and the drift would show up as one setting
 * reporting a cause its own page has no sentence for.
 *
 * `SettingNotRead` FIRST AND `OutboundRefused` BEHIND IT, which is the order
 * `nameProvider` already keeps for a reason of the same shape: the specific
 * refusal carries the fields the surface needs, and the general one is the
 * fallback that must not be answered as though it had them. A bare catch would
 * answer "an entry in that setting is unreadable" for a bug in a parser.
 */
function theSettingSubmitted(
  parse: () => unknown,
  errors: {
    BAD_REQUEST: (options: { message: string }) => Error;
    SETTING_NOT_READ: (options: {
      message: string;
      data: { entry: string; why: WhySettingNotRead };
    }) => Error;
  },
): void {
  try {
    parse();
  } catch (cause) {
    if (cause instanceof SettingNotRead) {
      throw errors.SETTING_NOT_READ({
        data: { entry: cause.entry, why: cause.why },
        message: cause.message,
      });
    }
    if (cause instanceof OutboundRefused) throw errors.BAD_REQUEST({ message: cause.message });
    throw cause;
  }
}

/**
 * WHAT THE PROVIDERS SECTION IS ANSWERED WITH, given how each setting read.
 *
 * THREE STATES OFF TWO PARSES, and the middle one is the one with no reading.
 * A Provider's reach is not a fact about the Providers setting alone: reaching
 * one means asking ADR-0034's boundary first, so the allowlist failing to parse
 * leaves the list knowable and every reading of it unknowable. The Providers
 * failing to parse leaves nothing at all, whatever the allowlist did.
 *
 * ORDERED WITH THE PROVIDERS' OWN FAULT FIRST, because it is the one that
 * empties this section. An instance with both rows bad is answered `unreadable`
 * here and `unreadable` on the allowlist beside it, which is how the page says
 * both rather than the first one it met.
 */
async function theProvidersAnswered(
  named: string[] | undefined,
  allowlist: Allowlist | undefined,
  asWritten: string,
): Promise<ProvidersConfigured> {
  if (named === undefined) return { asWritten, kind: "unreadable" };
  if (allowlist === undefined) {
    return { kind: "allowlist-unreadable", named: named.map((baseUrl) => ({ baseUrl })) };
  }
  return { kind: "read", named: await reachProviders({ allowlist, baseUrls: named }) };
}

/**
 * WHAT THIS INSTANCE IS CONFIGURED TO REACH, AND THE OWNER CHANGING IT
 * (CNCORE-99).
 *
 * ITS OWN ROUTER RATHER THAN MORE OF `provider`, because what these procedures
 * write is the INSTANCE'S configuration and not any provider. The reads that
 * live next door -- `provider.configured` and `provider.allowlisted` -- answer
 * questions the import surface asks about what it may do now, and they go on
 * answering them from the context; these are the editor.
 *
 * EVERY ONE OF THEM IS THE OWNER'S, INCLUDING THE READ, and that is the
 * difference from `provider.allowlisted`. That procedure answers a yes-or-no to
 * anybody exactly so that it never has to hand over a private network's address
 * ranges to satisfy one (ADR-0034). This read hands over the ranges themselves,
 * because it is the text box the owner edits them in.
 */
export const settings = {
  /**
   * Everything the settings surface renders: the providers this instance names,
   * the allowlist as the owner wrote it, and how far this instance got with each
   * of those providers.
   *
   * THE REACH IS COMPUTED HERE RATHER THAN ON THE PAGE, because its first
   * question is the boundary's own and `assertConfigUrl` is the only thing
   * entitled to answer it. A page comparing hosts itself would be a second
   * implementation of ADR-0034's allowlist, and the two would disagree on
   * exactly the entries that are hard -- a CIDR, an address literal, a port.
   *
   * IT ANSWERS THE MISCONFIGURATION ADR-0121 SAYS IT ACCEPTS. Two settings for
   * one concept means the likely mistake is naming a provider and forgetting to
   * allowlist its host, and that record's answer is that the SURFACE pays the
   * cost by saying which of the two refuses it. This is the half a page cannot
   * work out for itself.
   *
   * IT READS EACH PROVIDER'S MANIFEST, WHICH THIS PROCEDURE DID NOT DO BEFORE
   * CNCORE-101, and that is a real change in its character rather than a field
   * added. ADR-0122 puts the credential's state on the manifest because only the
   * provider can know it, so the state cannot be had without the read. The cost
   * is that a provider which accepts a connection and never answers holds this
   * page for `PATIENCE.brief` -- ten seconds -- and this page is where that
   * provider is removed. The reads are concurrent, so it is one timeout rather
   * than one per provider.
   *
   * `brief` AND NOT THE OTHER ONE, WHICH IS WHY THAT CONSTANT IS TWO (ADR-0130).
   * A `browse` may take sixty, because it answers a whole container; a manifest
   * is a few hundred bytes and anything near ten seconds of it is a provider that
   * has stopped. This page is the reason the caps did not simply rise together.
   */
  read: ownerProcedure
    .output(
      z.object({
        providers: providersConfigured,
        /** ADR-0034's allowlist, as the owner wrote it: hosts and CIDRs. */
        allowlist: allowlistConfigured,
      }),
    )
    .handler(async ({ context }) => {
      const configured = await readProviderSettings(context.db);
      /*
       * BOTH STORED SETTINGS ARE PARSED WHERE THE ANSWER CAN CARRY THE REFUSAL
       * (CNCORE-326 for the Providers, CNCORE-329 for the allowlist). Each
       * threw out of this handler bare, and this read is the only way to
       * `/settings` -- so a row that no longer parses cost the Owner the whole
       * page rather than the one setting it is about, INCLUDING the other
       * setting, which reads perfectly well and is what they would go and fix.
       *
       * BOTH ARE READ WHATEVER THE OTHER DID, which is the correction this
       * ticket carries over CNCORE-326's half. The allowlist's parse sat inside
       * the Providers' `read` arm, so an instance with BOTH rows bad rendered
       * and one with only the allowlist bad did not -- the exact opposite of
       * what the fault deserves. Two settings, neither derivable from the other
       * (ADR-0121), so each is asked independently and the page is told about
       * both.
       */
      const named = theProvidersStored(configured.providerUrls);
      const allowlist = theAllowlistStored(configured.providerAllowlist);
      return {
        providers: await theProvidersAnswered(named, allowlist, configured.providerUrls),
        allowlist: {
          kind: allowlist === undefined ? ("unreadable" as const) : ("read" as const),
          // AS THE OWNER WROTE IT, IN BOTH ARMS. The textarea renders this and
          // is what repairs an unreadable one, so a blank box here would offer
          // them a save that wipes the setting they came to fix.
          asWritten: configured.providerAllowlist,
        },
      };
    }),

  /**
   * Names one more provider for this instance to search.
   *
   * NO RESTART, WHICH IS THE WHOLE TICKET. `createContext` reads the store per
   * request, so the provider is searched by the next request rather than by the
   * next deployment.
   *
   * IT VALIDATES BY PARSING, AND THE PARSE IS THE ONE EVERY READ GOES THROUGH.
   * `nameProvider` refuses through `parseProviderUrls`, so what this surface
   * accepts is exactly what a configured instance can read back -- and the
   * refusal reaches the owner as a sentence about their own entry rather than
   * as a 500 from the next page that needed the setting.
   */
  nameProvider: ownerProcedure
    /*
     * NO `.min(1)` ON THE ENTRY (CNCORE-262). An empty box is a real thing an
     * Owner submits, and refusing it in the INPUT SCHEMA answers a generic
     * `BAD_REQUEST` instead of the one refusal that names what happened --
     * `nameProvider` already reads an empty string as naming nothing and says
     * so. A schema refusal here would be a second rule for a fact the parse
     * already settles, and the less useful of the two.
     */
    .input(z.object({ baseUrl: z.string() }))
    .errors({ ...NOT_A_SETTING, ...NOT_ONE_PROVIDER })
    .handler(async ({ input, context, errors }) => {
      try {
        // THE ROW IS HELD FROM THE READ TO THE WRITE (CNCORE-391), so a second
        // change at the same moment computes its list from this one's.
        await changeProviderUrls(context.db, (configured) =>
          nameProvider(configured, input.baseUrl),
        );
      } catch (cause) {
        /*
         * WHICH OF THE THREE, WHERE THE ENTRY IS WHAT WAS REFUSED (CNCORE-262).
         * `ProviderNotNamed` is raised only for the text the Owner typed into
         * the box, and it says which mistake it was; the surface needs that to
         * pick a remedy, and reading it off the SENTENCE would tie this router
         * to wording that is deliberately not its own.
         */
        if (cause instanceof ProviderNotNamed) {
          throw errors[ANSWERED_AS[cause.why]]({ message: cause.message });
        }
        // ONLY THE BOUNDARY'S OWN REFUSAL, which is `item.create`'s lesson: a
        // bare catch here would answer BAD_REQUEST for a dead connection pool
        // and tell the owner their URL was the problem.
        //
        // WHAT IS LEFT HERE IS THE SETTING ALREADY STORED, not the entry: the
        // first thing `nameProvider` parses is the configured string, so a row
        // that no longer reads refuses here while the Owner's entry was fine.
        // That is not one of the three above and must not be answered as one.
        if (cause instanceof OutboundRefused) throw errors.BAD_REQUEST({ message: cause.message });
        throw cause;
      }
    }),

  /**
   * Stops this instance naming one provider.
   *
   * NOT A PURGE, AND THE WORDS ARE KEPT APART (`CONTEXT.md`). Everything this
   * provider ever claimed stays in the catalogue, attributed to it; the only
   * change is that nothing asks it again. `provider.purge` is the other
   * operation and it has a confirmation of its own (ADR-0046).
   */
  removeProvider: ownerProcedure
    .input(z.object({ baseUrl: z.string().min(1) }))
    .errors(NOT_A_SETTING)
    .handler(async ({ input, context, errors }) => {
      try {
        await changeProviderUrls(context.db, (configured) =>
          removeProvider(configured, input.baseUrl),
        );
      } catch (cause) {
        if (cause instanceof OutboundRefused) throw errors.BAD_REQUEST({ message: cause.message });
        throw cause;
      }
    }),

  /**
   * Replaces the Providers setting with what the Owner wrote (CNCORE-331).
   *
   * THE ROUTE BACK FROM A ROW THAT WILL NOT PARSE, and it exists because the
   * other two writes cannot be one. `nameProvider` and `removeProvider` both
   * parse the STORED string before they look at the entry, so while the row is
   * bad both refuse -- and removing is the one that would have repaired it.
   * ADR-0197 recorded that the page could say what was wrong and offer nothing
   * to do about it; this is the something.
   *
   * WHOLESALE, WHICH IS THE ALLOWLIST'S OWN ARRANGEMENT RATHER THAN A NEW ONE.
   * `editAllowlist` has never had this defect for exactly one reason: it parses
   * what is SUBMITTED and never what is stored, so a bad allowlist has always
   * been repairable from its own textarea. The asymmetry was the bug.
   *
   * IT DOES NOT REPLACE THE LIST WITH A TEXTAREA ON THE PAGE. A Provider is a
   * source with an identity (ADR-0031) and a row with a Remove button is the
   * right control for one; the textarea is what the page renders INSTEAD of a
   * list it cannot render, so the two never stand together and cannot disagree
   * about what the setting holds.
   *
   * AND PARSE-BEFORE-STORE IS UNTOUCHED, which is ADR-0121's condition on every
   * settings write: what the surface accepts is exactly what a configured
   * instance can read back. The INPUT is parsed before it reaches a row, as in
   * all three writes beside it. The stored value is not, and never should have
   * been here -- it is the thing being replaced.
   */
  editProviders: ownerProcedure
    /*
     * NO `.min(1)`: AN EMPTY BOX IS THE "CLEAR IT AND START AGAIN" REPAIR.
     * An instance naming no Provider searches none (ADR-0121), which is what a
     * fresh one does -- and an Owner whose row is unreadable and unfixable by
     * hand needs that exit more than anyone.
     */
    .input(z.object({ providers: z.string() }))
    .errors({ ...NOT_A_SETTING, ...NOT_A_READABLE_SETTING })
    .handler(async ({ input, context, errors }) => {
      theSettingSubmitted(() => parseProviderUrls(input.providers), errors);
      await writeProviderSettings(context.db, { providerUrls: input.providers });
    }),

  /**
   * Replaces ADR-0034's allowlist with what the owner wrote.
   *
   * WHOLESALE RATHER THAN ENTRY BY ENTRY, because the allowlist is a text the
   * owner edits: it holds hosts AND CIDRs, and `127.0.0.0/8` is not a thing
   * anybody adds and removes one of. The providers beside it are a list with a
   * button per row, because each entry there is a source with an identity.
   *
   * AN EMPTY ALLOWLIST IS A LEGAL EDIT AND REFUSES EVERY PROVIDER, which is
   * ADR-0034's default rather than an error: an owner is entitled to shut this
   * instance's outbound door, and the import surface already says so.
   */
  editAllowlist: ownerProcedure
    .input(z.object({ allowlist: z.string() }))
    .errors({ ...NOT_A_SETTING, ...NOT_A_READABLE_SETTING })
    .handler(async ({ input, context, errors }) => {
      // PARSED FOR ITS REFUSAL, NOT FOR ITS ANSWER. What is stored is the
      // owner's own text -- `parseAllowlist` is what every read of this value
      // runs, so a value it cannot read must not reach a row.
      //
      // AND THE REFUSAL NAMES THE LINE (CNCORE-329). This answered a bare
      // `BAD_REQUEST`, so the Server Action above it had nothing to report
      // with and reported nothing: the Owner's edit vanished from a textarea
      // that re-rendered with the stored value, with no sentence about why.
      theSettingSubmitted(() => parseAllowlist(input.allowlist), errors);
      await writeProviderSettings(context.db, { providerAllowlist: input.allowlist });
    }),
};
