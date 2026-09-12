import { readProviderSettings, writeProviderSettings } from "@canoncore/db";
import {
  assertConfigUrl,
  nameProvider,
  OutboundRefused,
  parseAllowlist,
  parseProviderUrls,
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
   * the allowlist as the owner wrote it, and which of those providers that
   * allowlist actually admits.
   *
   * `admitted` IS COMPUTED HERE RATHER THAN ON THE PAGE, because it is the
   * boundary's own question and `assertConfigUrl` is the only thing entitled to
   * answer it. A page comparing hosts itself would be a second implementation
   * of ADR-0034's allowlist, and the two would disagree on exactly the entries
   * that are hard -- a CIDR, an address literal, a port.
   *
   * IT ANSWERS THE MISCONFIGURATION ADR-0121 SAYS IT ACCEPTS. Two settings for
   * one concept means the likely mistake is naming a provider and forgetting to
   * allowlist its host, and that record's answer is that the SURFACE pays the
   * cost by saying which of the two refuses it. This is the half a page cannot
   * work out for itself.
   */
  read: ownerProcedure
    .output(
      z.object({
        providers: z.array(
          z.object({
            /** As the owner typed it, which is the provider's identity (ADR-0031). */
            baseUrl: z.string().min(1),
            /** Whether ADR-0034's allowlist admits this provider's host. */
            admitted: z.boolean(),
          }),
        ),
        /** ADR-0034's allowlist, as the owner wrote it: hosts and CIDRs. */
        allowlist: z.string(),
      }),
    )
    .handler(async ({ context }) => {
      const configured = await readProviderSettings(context.db);
      return {
        providers: parseProviderUrls(configured.providerUrls).map((baseUrl) => ({
          baseUrl,
          admitted: admits(configured.providerAllowlist, baseUrl),
        })),
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
    .errors(NOT_A_SETTING)
    .handler(async ({ input, context, errors }) => {
      const configured = await readProviderSettings(context.db);
      try {
        await writeProviderSettings(context.db, {
          providerUrls: nameProvider(configured.providerUrls, input.baseUrl),
        });
      } catch (cause) {
        // ONLY THE BOUNDARY'S OWN REFUSAL, which is `item.create`'s lesson: a
        // bare catch here would answer BAD_REQUEST for a dead connection pool
        // and tell the owner their URL was the problem.
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

/**
 * Whether ADR-0034's allowlist admits this provider's host.
 *
 * IT ASKS `assertConfigUrl`, WHICH IS THE BOUNDARY ITSELF. The question a page
 * renders and the question asked in front of a request must be one question: a
 * surface that said "admitted" where the boundary refuses would be telling the
 * owner their configuration works, and the import would fail anyway.
 *
 * A PROVIDER WHOSE ENTRY THE BOUNDARY CANNOT EVEN READ IS NOT ADMITTED. Nothing
 * can name such an entry through this router, but a row written by hand could
 * hold one, and "not admitted" is the safe reading of it.
 */
function admits(allowlist: string, baseUrl: string): boolean {
  try {
    assertConfigUrl(new URL(baseUrl), parseAllowlist(allowlist));
    return true;
  } catch {
    return false;
  }
}
