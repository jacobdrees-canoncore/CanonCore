import { readProviderSettings, writeProviderSettings } from "@canoncore/db";
import {
  failureReason,
  nameProvider,
  OutboundRefused,
  ProviderNotNamed,
  parseAllowlist,
  parseProviderUrls,
  REASON_MAX_LENGTH,
  reachProviders,
  removeProvider,
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
        providers: z.array(
          z.object({
            /** As the owner typed it, which is the provider's identity (ADR-0031). */
            baseUrl: z.string().min(1),
            reach: providerReach,
          }),
        ),
        /** ADR-0034's allowlist, as the owner wrote it: hosts and CIDRs. */
        allowlist: z.string(),
      }),
    )
    .handler(async ({ context }) => {
      const configured = await readProviderSettings(context.db);
      return {
        providers: await reachProviders({
          baseUrls: parseProviderUrls(configured.providerUrls),
          allowlist: parseAllowlist(configured.providerAllowlist),
        }),
        allowlist: configured.providerAllowlist,
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
    .input(z.object({ baseUrl: z.string().min(1) }))
    .errors({ ...NOT_A_SETTING, ...NOT_ONE_PROVIDER })
    .handler(async ({ input, context, errors }) => {
      const configured = await readProviderSettings(context.db);
      try {
        await writeProviderSettings(context.db, {
          providerUrls: nameProvider(configured.providerUrls, input.baseUrl),
        });
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
      const configured = await readProviderSettings(context.db);
      try {
        await writeProviderSettings(context.db, {
          providerUrls: removeProvider(configured.providerUrls, input.baseUrl),
        });
      } catch (cause) {
        if (cause instanceof OutboundRefused) throw errors.BAD_REQUEST({ message: cause.message });
        throw cause;
      }
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
    .errors(NOT_A_SETTING)
    .handler(async ({ input, context, errors }) => {
      try {
        // PARSED FOR ITS REFUSAL, NOT FOR ITS ANSWER. What is stored is the
        // owner's own text -- `parseAllowlist` is what every read of this value
        // runs, so a value it cannot read must not reach a row.
        parseAllowlist(input.allowlist);
      } catch (cause) {
        if (cause instanceof OutboundRefused) throw errors.BAD_REQUEST({ message: cause.message });
        throw cause;
      }
      await writeProviderSettings(context.db, { providerAllowlist: input.allowlist });
    }),
};
