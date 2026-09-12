import {
  type Database,
  findItemsProvided,
  type ImportedContainer,
  type ImportedRecord,
  importBrowsedContainer,
  importProvidedRecord,
  type PurgedProvider,
  previewProviderPurge,
  purgeProvider,
} from "@canoncore/db";
import {
  type Allowlist,
  allowsAnything,
  type CmppManifest,
  type CmppRecord,
  createProviderClient,
  OutboundRefused,
  searchProviders,
} from "@canoncore/providers";
import { z } from "zod";

import { publicProcedure } from "../index";

/** What an import needs: the URL the owner typed, and which record to take. */
export interface ImportRequest {
  baseUrl: string;
  recordId: string;
}

/**
 * Reaching a provider and writing what it answers, as a plain function.
 *
 * SEPARATE FROM THE PROCEDURE so that anything that is not an oRPC call can do
 * a real import -- the end-to-end suite stands up a provider and imports through
 * THIS, rather than re-implementing the three steps and then proving its own
 * re-implementation renders. The procedure below is the transport and the error
 * mapping; this is the operation.
 *
 * Answers `null` when the provider holds no record at that id, because that is
 * an answer rather than a failure: it is what an ambiguous `search` candidate
 * looks like once the candidate turns out to be gone (ADR-0033).
 */
export async function importRecordFromProvider(
  db: Database,
  allowlist: Allowlist,
  { baseUrl, recordId }: ImportRequest,
): Promise<ImportedRecord | null> {
  const client = createProviderClient({ baseUrl, allowlist });
  try {
    // The manifest first, for the provider's OWN name. A source answers "who
    // said this", and `provider-wiki` answers it where `http://127.0.0.1:39481`
    // shows a reader a deployment detail.
    const manifest = await client.manifest();
    const record = await client.lookup(recordId);
    if (!record) return null;

    return await importProvidedRecord(db, {
      provider: providerFrom(baseUrl, manifest),
      record: asProvided(record),
    });
  } finally {
    // The client holds two undici agents and therefore two connection pools.
    // Left open they keep sockets alive long after the one import that needed
    // them.
    await client.close();
  }
}

/** What a browse needs: the URL the owner typed, and which container to take. */
export interface BrowseRequest {
  baseUrl: string;
  containerId: string;
}

/**
 * Raised when a provider does not declare `browse`.
 *
 * A NAMED REFUSAL RATHER THAN A SILENT SKIP. ADR-0033 makes `browse` optional
 * AND DECLARED, so a provider that offers only `search` and `lookup` is
 * perfectly well-formed and this is not an error on its part -- the owner asked
 * for something this provider does not do, and that is a sentence to put in
 * front of them rather than an empty result to puzzle over.
 */
export class BrowseNotOffered extends Error {}

/**
 * Reaching a provider's `browse` and writing the container and ordering it
 * answers, as a plain function.
 *
 * SEPARATE FROM THE PROCEDURE for the reason `importRecordFromProvider` is: the
 * end-to-end suite does a real browse through THIS, rather than re-implementing
 * the steps and then proving its own re-implementation renders.
 *
 * THE MANIFEST IS READ BEFORE ANYTHING IS ASKED FOR, and its `operations` list
 * is what decides whether to call at all (ADR-0033). A provider that does not
 * declare `browse` is never asked -- the check is not an optimisation, it is
 * the optionality being honoured: `browse` is the operation a provider may
 * decline, and reading the declaration is the only way an app can tell.
 *
 * THE CONTAINER IS NAMED BY THE OWNER, and nothing in CMPP hands one over.
 * `search` returns stories and `browse` takes a container's own id, so there is
 * no operation that answers "which containers do you have". The owner supplies
 * it exactly as they supply a record id to `import` -- see ADR-0033's as-built
 * section, which records the decision rather than leaving it to be rediscovered.
 *
 * Answers `null` when that id addresses no container, which is an answer rather
 * than a failure (ADR-0066).
 */
export async function browseIntoCatalogue(
  db: Database,
  allowlist: Allowlist,
  { baseUrl, containerId }: BrowseRequest,
): Promise<ImportedContainer | null> {
  const client = createProviderClient({ baseUrl, allowlist });
  try {
    const manifest = await client.manifest();
    if (!manifest.operations.includes("browse")) {
      throw new BrowseNotOffered(`${manifest.name} declares no browse; it was not asked for one.`);
    }

    const browsed = await client.browse(containerId);
    if (!browsed) return null;

    return await importBrowsedContainer(db, {
      provider: providerFrom(baseUrl, manifest),
      browsed: {
        container: asProvided(browsed.container),
        ordering: browsed.ordering.map(({ position, record }) => ({
          position,
          record: asProvided(record),
        })),
        unplaced: browsed.unplaced.map(asProvided),
      },
    });
  } finally {
    await client.close();
  }
}

/**
 * The provider as the catalogue records it: who it is, what it calls itself, and
 * what its licence obliges the app to show.
 *
 * THE ATTRIBUTION IS TAKEN OFF THE MANIFEST ON EVERY IMPORT rather than only the
 * first. A licence changes, and the source row is made once and reused forever --
 * so a notice captured at first import and never revisited goes stale the day the
 * source revises its terms, and showing last year's notice is the same breach as
 * showing none.
 */
function providerFrom(baseUrl: string, manifest: CmppManifest) {
  return { identity: baseUrl, label: manifest.name, attribution: manifest.attribution };
}

/**
 * A CMPP record in the terms the catalogue writes.
 *
 * The translation lives HERE rather than in `@canoncore/db`, which is what
 * keeps the wire format out of the catalogue: that package knows nothing about
 * HTTP and nothing about a provider's shape, and a change to the protocol stops
 * at this function.
 */
function asProvided(record: CmppRecord) {
  return {
    externalId: record.id,
    title: record.title,
    // Every date, each at the precision it arrived with (ADR-0073).
    //
    // CARRIED OVER UNCHECKED, ON PURPOSE. The EDTF check is the CATALOGUE's
    // (CNCORE-29), and it runs where the statement is written rather than here:
    // ADR-0073 is a decision about what the catalogue holds, so a translation
    // that silently dropped a value would leave `@canoncore/db` still able to
    // write one and this function the only thing standing in the way. What
    // arrives broken is quarantined at the door and counted, not lost here.
    released: record.released,
  };
}

/** Which provider, for both halves of the purge. */
const purgeTarget = z.object({
  /** The provider's identity, which for a provider IS its base URL (ADR-0031). */
  baseUrl: z.url(),
});

/**
 * What a purge took, and -- the same schema, deliberately -- what a preview says
 * it WOULD take. Two shapes here would be two chances for the preview and the
 * delete to describe different answers, which is the thing this pair exists to
 * make impossible.
 */
const purgeCounts = z.object({
  statements: z.number().int().nonnegative(),
  placements: z.number().int().nonnegative(),
  /**
   * Items left with no claim on them and nowhere they sit. NOT every item the
   * provider ever wrote: one the owner also placed somewhere survives, untitled,
   * because the owner's placement is the owner's claim and a provider's licence
   * ending has no bearing on it.
   */
  items: z.number().int().nonnegative(),
});

/**
 * One candidate, as the owner meets it: what the provider said about it, and
 * WHETHER THIS CATALOGUE ALREADY HOLDS IT.
 *
 * `itemId` IS WHAT MAKES THIS A SURFACE RATHER THAN A LIST. Without it the page
 * has no way to report an import at all -- it would show the same row before and
 * after, and the only other way to say "here is what you just imported" is a
 * redirect, which ADR-0109 rules out because Next does not apply `basePath` to
 * one (measured on 16.3.4: `<Link>` emits `/canoncore/items/x` under a basePath
 * and `redirect("/items/x")` sets `Location: /items/x`). It is also the answer to
 * the question an owner searching a provider actually has, which is whether they
 * already have this.
 *
 * IT IS IDENTITY AND NOT MATCHING (ADR-0026). The item is found by the id THIS
 * provider knows the record by, so a record one provider holds and another does
 * not reads as absent rather than as the other's item. Deciding that two
 * providers' records describe one work needs a score and a review queue, and
 * nothing here does it by accident.
 */
const candidate = z.object({
  /** The provider's own id, which is what `lookup` and `import` take (ADR-0033). */
  recordId: z.string().min(1),
  title: z.string().min(1),
  /**
   * The PROVIDER'S taxonomy of works -- `TV story`, `audio story` -- and not the
   * catalogue's seven item kinds, and never `medium`, which CONTEXT.md reserves
   * for a playback medium. An owner choosing between two answers for one title is
   * choosing on exactly this, so it is the field that makes the choice possible.
   */
  kind: z.string().min(1),
  /** Every release date the provider holds, each at its own precision (ADR-0073). */
  released: z.array(z.string()),
  /**
   * The record's own page at the provider. A CONTENT URL that is only READ, so
   * what it is held to is its SCHEME and not its host (ADR-0034, CNCORE-79): the
   * scheme is what decides whether the owner's browser treats it as a destination
   * or as a program, and nothing fetches it.
   */
  url: z.url({ protocol: /^https?$/ }),
  /** The Item this provider's record is already held as, or `null`. */
  itemId: z.uuid().nullable(),
});

export const provider = {
  /**
   * Whether this instance may reach ANY provider at all.
   *
   * ADR-0034 makes the allowlist empty by default, and empty refuses
   * everything. That is the right default and it is also invisible: an owner
   * whose catalogue will not fill sees imports refused one at a time, with no
   * way to tell a wrong URL from an instance that was never configured to reach
   * anything. ADR-0094 names the same gap from the other end -- an install that
   * starts empty without saying what to do next -- so this exists to be SAID on
   * a page rather than discovered at the first failed import.
   *
   * A BOOLEAN RATHER THAN THE ALLOWLIST. What is on it is the owner's
   * configuration and the answer to a different question; what a surface needs
   * is whether there is anything on it at all. Handing over the entries would
   * put a private network's addresses in a response to satisfy a yes-or-no.
   *
   * NO REQUEST LEAVES THE APP. It reads the configuration this process started
   * with, which is what `createContext` parsed at module load.
   */
  allowlisted: publicProcedure
    .output(z.object({ any: z.boolean() }))
    .handler(({ context }) => ({ any: allowsAnything(context.providerAllowlist) })),

  /**
   * WHICH PROVIDERS THIS INSTANCE SEARCHES, so a surface can say "none" rather
   * than show an empty result.
   *
   * THE SECOND HALF OF THE SAME SILENCE `allowlisted` ABOVE NAMES. An instance
   * reaches no provider either because nothing is allowlisted or because nothing
   * is named, and the two have different remedies -- `PROVIDER_ALLOWLIST` and
   * `PROVIDER_URLS` -- so one answer could not tell an owner which to go and set.
   *
   * AND IT HANDS OVER THE URLS, WHICH IS THE OPPOSITE OF WHAT `allowlisted` DOES
   * AND IS NOT AN INCONSISTENCY. That procedure answers a YES-OR-NO and would have
   * had to disclose a private network's address ranges to do it. Here the URLs ARE
   * the answer: the surface offers them to be chosen between -- a browse takes a
   * container id at ONE provider, so the owner has to say which -- and they are
   * configuration the owner typed rather than anything a provider told us. The
   * contract test's rule about keeping a deployment address away from a reader is
   * about a READER being handed a source's claims; this is the OWNER, who wrote
   * these URLs and is the only person who can change one.
   *
   * NO REQUEST LEAVES THE APP. It reads what `createContext` parsed at module
   * load, so it answers for a provider that is switched off exactly as for one
   * that is running.
   */
  configured: publicProcedure
    .output(z.object({ providers: z.array(z.url()) }))
    .handler(({ context }) => ({ providers: context.providerUrls })),

  /**
   * WHICH OF ONE PROVIDER'S RECORDS THIS CATALOGUE ALREADY HOLDS, for ids the
   * owner names rather than for candidates a search found.
   *
   * `search` ANSWERS THIS ALREADY FOR WHAT IT FOUND, and this exists for the case
   * it cannot reach: a CONTAINER id. Nothing in CMPP hands one over -- `search`
   * returns stories and `browse` takes a container's own id (ADR-0033) -- so the
   * owner types it, and a surface showing what they typed has no search answer to
   * read the Item out of.
   *
   * NO REQUEST LEAVES THE APP. `baseUrl` is an IDENTITY here rather than an
   * address, exactly as it is for `purge`: the rows are this catalogue's, and the
   * question is about what was imported rather than about what the provider says
   * now. So the allowlist has no say and a provider that is switched off answers
   * the same as one that is running.
   */
  held: publicProcedure
    .input(
      z.object({
        /** The provider's identity, which for a provider IS its base URL (ADR-0031). */
        baseUrl: z.url(),
        /** The provider's own ids, the ones `lookup` and `browse` take. */
        recordIds: z.array(z.string().min(1)),
      }),
    )
    .output(
      z.object({
        /**
         * ONE ROW PER RECORD THAT IS HELD, and none for one that is not. The
         * caller asked which of these the catalogue has; a row carrying nothing is
         * a longer way of saying the same thing.
         */
        items: z.array(z.object({ recordId: z.string().min(1), itemId: z.uuid() })),
      }),
    )
    .handler(async ({ input, context }) => {
      const held = await findItemsProvided(context.db, {
        identity: input.baseUrl,
        externalIds: input.recordIds,
      });
      return {
        // IN THE ORDER THE CALLER ASKED, rather than whatever the planner
        // returned, so a surface rendering these rows renders them the same way
        // twice.
        items: input.recordIds.flatMap((recordId) => {
          const itemId = held.get(recordId);
          return itemId === undefined ? [] : [{ recordId, itemId }];
        }),
      };
    }),

  /**
   * Searches EVERY configured provider at once and answers what each of them
   * offered, with the ones this catalogue already holds named.
   *
   * SEVERAL PROVIDERS, WHICH IS WHAT MAKES SEARCH A DIFFERENT SHAPE FROM THE
   * REST OF THIS ROUTER. `import`, `browse` and `purge` each address ONE provider
   * the owner named, because the owner already knows which one. An owner who does
   * not know an id does not know which source holds it either, so this is the one
   * operation that has to ask them all -- ADR-0033's as-built section under
   * CNCORE-77 records the reasoning and `searchProviders` is the fan-out.
   *
   * ONE PROVIDER FAILING IS NOT THE SEARCH FAILING, which is why this answers
   * with two lists rather than one. A provider that is down and a provider that
   * matched nothing are different answers, and collapsing them is how an owner
   * concludes their query was wrong when their source was merely offline.
   *
   * THE CONFIGURED SET RATHER THAN A URL ON THE INPUT. A provider is a URL
   * (ADR-0031) and there is no registry, so the set comes from `PROVIDER_URLS`,
   * parsed at module load. Taking it as input would make every caller name the
   * providers, and a caller that named one would get one answer and no way to
   * know it had missed the other.
   */
  search: publicProcedure
    .input(
      z.object({
        /**
         * TRIMMED BEFORE IT IS JUDGED, and that is load-bearing rather than
         * tidy. `searchProviders` throws on a blank query on purpose -- fanning
         * one out collects a `400` from every provider and answers `{ answered:
         * [], failed: [...] }`, which an owner reads as "nothing matched"
         * (ADR-0033 under CNCORE-77) -- and a thrown `Error` here would be a 500
         * no caller can narrow. A box somebody tabbed through holds spaces
         * rather than nothing, so `"   "` is the commonest spelling of the
         * mistake: measured on zod 4.5.4, `.trim().min(1)` refuses it as bad
         * INPUT, which is what it is.
         */
        query: z.string().trim().min(1),
      }),
    )
    .output(
      z.object({
        answered: z.array(
          z.object({
            provider: z.object({
              /**
               * WHICH PROVIDER, as the URL that IS its identity (ADR-0031). The
               * owner needs it back to import from it, and it is configuration
               * they typed rather than anything the provider told us.
               */
              baseUrl: z.url(),
              /** The name the provider gives itself, off its manifest. */
              name: z.string().min(1),
            }),
            results: z.array(candidate),
          }),
        ),
        /**
         * Who was asked and did not answer, and why.
         *
         * NAMED BY URL, where an answering provider is named by its manifest --
         * because reading the name is one of the things that failed. It is for
         * the OWNER, who typed these URLs and is the only person who can fix
         * one, and who cannot act on "a provider you configured is down".
         */
        failed: z.array(z.object({ baseUrl: z.url(), reason: z.string().min(1) })),
      }),
    )
    .handler(async ({ input, context }) => {
      // NO DECLARED ERROR FOR A REFUSAL HERE, WHICH IS THE OPPOSITE OF `import`
      // BELOW AND IS NOT AN OVERSIGHT. A refusal reaches one provider's turn and
      // is caught there, so it arrives as that provider's `failed` entry beside a
      // provider that answered -- the fan-out's whole purpose. Raising it as the
      // SEARCH's error would throw away every other provider's answers because
      // one URL was not allowlisted.
      const { answered, failed } = await searchProviders(
        { baseUrls: context.providerUrls, allowlist: context.providerAllowlist },
        input.query,
      );

      return {
        answered: await Promise.all(
          answered.map(async ({ provider: answering, results }) => {
            // ONE QUERY PER PROVIDER, not one per candidate. The ids are that
            // provider's namespace, so they can only be asked about together.
            const held = await findItemsProvided(context.db, {
              identity: answering.baseUrl,
              externalIds: results.map((record) => record.id),
            });
            return {
              provider: answering,
              results: results.map((record) => ({
                recordId: record.id,
                title: record.title,
                kind: record.kind,
                released: record.released,
                url: record.url,
                itemId: held.get(record.id) ?? null,
              })),
            };
          }),
        ),
        // THE MESSAGE RATHER THAN THE `Error`. It travels to a page, and an
        // `Error` does not serialise across the wire; the message is the sentence
        // the owner has to read. `OutboundRefused` and a provider that fell over
        // are both in here, distinguishable by what they say.
        failed: failed.map(({ baseUrl, reason }) => ({ baseUrl, reason: reason.message })),
      };
    }),

  /**
   * Imports one record from a provider, over HTTP, and answers with the item it
   * wrote.
   *
   * THE WHOLE OPERATION AT ONCE, and that is a statement about where the
   * project is rather than a design. ADR-0026 makes MATCHING and APPLYING two
   * operations with two endpoints, precisely so a separation living only in a
   * screen design does not get collapsed by the next screen design. Neither
   * exists yet: nothing scores a candidate and nothing chooses among a record's
   * values, so there is nothing for the split to separate. When the first of
   * them lands it takes its own procedure, and this one is what it replaces.
   *
   * NO CREDENTIAL, ANYWHERE ON THIS PATH (ADR-0035). The instance supplies its
   * own, and the wiki provider needs none at all -- no key, no rate limit, no
   * attribution string -- which is exactly why ADR-0069 makes it the first
   * provider written. There is no field here for one and nothing in this repo
   * holds one.
   */
  import: publicProcedure
    .input(
      z.object({
        /**
         * A CONFIG URL: the owner typed it, so it travels ADR-0034's allowlist.
         * `z.url()` only says it parses as one -- whether it may be REACHED is
         * the allowlist's answer, given below, and not a validation concern.
         */
        baseUrl: z.url(),
        /** The provider's own id, the one `lookup` takes (ADR-0033). */
        recordId: z.string().min(1),
      }),
    )
    .output(
      z.object({
        itemId: z.uuid(),
        /**
         * How many of this record's values arrived broken and were held apart
         * from the live set (CNCORE-29). ADR-0073 says a date is an EDTF
         * string, and one that is not is kept, marked and not read as good.
         *
         * ON THE ANSWER RATHER THAN LEFT TO A QUERY, because the alternative is
         * an import that reports success identically whether it wrote what the
         * provider said or held half of it back.
         */
        quarantinedValues: z.number().int().nonnegative(),
      }),
    )
    .errors({
      PROVIDER_REFUSED: {
        message: "That provider URL is not one this instance may reach.",
      },
      NO_SUCH_RECORD: {
        message: "The provider holds no record at that id.",
      },
    })
    .handler(async ({ input, context, errors }) => {
      try {
        const imported = await importRecordFromProvider(
          context.db,
          context.providerAllowlist,
          input,
        );
        if (!imported) throw errors.NO_SUCH_RECORD();
        return imported;
      } catch (error) {
        // A REFUSAL IS AN ANSWER, NOT A CRASH. The owner typed this URL, so a
        // UI has to be able to put the reason in front of them -- and an
        // undeclared throw is a 500 no caller can narrow on, which is the same
        // defect CNCORE-14 fixed for a malformed item id.
        if (error instanceof OutboundRefused) {
          throw errors.PROVIDER_REFUSED({ message: error.message });
        }
        throw error;
      }
    }),

  /**
   * WHAT ONE PROVIDER SAYS ABOUT ONE CONTAINER, asked before anything is
   * written.
   *
   * A READ WHERE `browse` IS A WRITE, and that is the whole of why it exists.
   * `browse` below declares three refusals precisely so each is an ANSWER
   * rather than a fault (ADR-0033), and a POST is the one place none of them
   * can be read: a Server Action that throws during a form submission with no
   * script answers a bare `Internal Server Error`, and Next redacts a server
   * error's message before any boundary sees it. Asked on the GET instead,
   * every one of the three is a value a page can print.
   */
  container: publicProcedure
    .input(
      z.object({
        /** A CONFIG URL, travelling ADR-0034's allowlist, as `browse`'s does. */
        baseUrl: z.url(),
        /** The provider's own id for the container, the one `browse` takes. */
        containerId: z.string().min(1),
      }),
    )
    /*
     * A UNION RATHER THAN DECLARED ERRORS, WHICH IS THE WHOLE POINT OF THIS
     * PROCEDURE EXISTING BESIDE `browse`. Every one of these is an ANSWER: the
     * provider was asked and said something, and the caller renders whichever
     * sentence it got. An error -- declared or not -- would put the same
     * outcomes back on the throwing path this exists to get them off.
     */
    .output(
      z.discriminatedUnion("answer", [
        z.object({
          answer: z.literal("container"),
          /** The name the provider gives itself, off its manifest. */
          providerName: z.string().min(1),
          /** The container's own title, which is what the owner cannot see today. */
          title: z.string().min(1),
        }),
        /**
         * THE PROVIDER WAS ASKED AND HOLDS NOTHING THERE, which ADR-0066 makes
         * an answer rather than a failure: an id that cannot BE an identity
         * addresses nothing, exactly as one nobody minted does.
         */
        z.object({
          answer: z.literal("no-such-container"),
          providerName: z.string().min(1),
        }),
        /**
         * THE PROVIDER DOES NOT DO THIS, which ADR-0033 makes well-formed
         * rather than broken: `browse` is the operation a provider may decline,
         * and one offering only `search` and `lookup` satisfies CMPP. The owner
         * asked for something this provider does not do, which is a sentence to
         * put in front of them rather than an empty result to puzzle over.
         */
        z.object({
          answer: z.literal("browse-not-offered"),
          providerName: z.string().min(1),
        }),
        /**
         * NOBODY ANSWERED, so there is no name to attribute this to -- reading
         * the provider's own name is one of the things that failed, exactly as
         * in `search`'s `failed` list.
         *
         * THE REASON IS THE SENTENCE THE OWNER ACTS ON. A URL ADR-0034 refuses
         * and a provider that is switched off are both in here, distinguishable
         * by what they say, and the two have different remedies.
         */
        z.object({
          answer: z.literal("unreachable"),
          reason: z.string().min(1),
        }),
      ]),
    )
    .handler(async ({ input, context }) => {
      const client = createProviderClient({
        baseUrl: input.baseUrl,
        allowlist: context.providerAllowlist,
      });
      try {
        const manifest = await client.manifest();
        // THE DECLARATION DECIDES WHETHER TO CALL AT ALL, exactly as it does in
        // `browseIntoCatalogue` above. Reading it is the only way an app can
        // tell, and asking anyway would be the declaration read and ignored.
        if (!manifest.operations.includes("browse")) {
          return { answer: "browse-not-offered" as const, providerName: manifest.name };
        }
        const browsed = await client.browse(input.containerId);
        if (!browsed) {
          return { answer: "no-such-container" as const, providerName: manifest.name };
        }
        return {
          answer: "container" as const,
          providerName: manifest.name,
          title: browsed.container.title,
        };
      } catch (error) {
        /*
         * EVERY FAILURE IS AN ANSWER HERE, which is the opposite of `browse`
         * below and is the reason this procedure exists. The caller is a page
         * being READ: it has already decided to show the owner something about
         * this id, and a throw would take the whole page down over one provider
         * having a bad day.
         *
         * WHATEVER WENT WRONG, RATHER THAN A LIST OF WHAT MIGHT. An
         * `OutboundRefused` from ADR-0034's boundary, a socket that never
         * opened, and a manifest that does not parse are all a provider this
         * page could not get an answer out of -- and they stay apart by what
         * they SAY, as they do in `search`'s `failed` list. Narrowing to the
         * ones foreseen here would leave the rest as the 500 this removes.
         */
        return {
          answer: "unreachable" as const,
          reason: error instanceof Error ? error.message : String(error),
        };
      } finally {
        // Two undici agents and therefore two connection pools, as everywhere
        // else on this path.
        await client.close();
      }
    }),

  /**
   * Imports a container AND its ordering from a provider that declares
   * `browse`, and answers with the container and every member it wrote.
   *
   * ONE CALL RATHER THAN SIXTY. That is the whole difference from `import`
   * above, and it is why `browse` exists at all (ADR-0033): the container and
   * its ordering arrive together, so a bulk import yields placements for free
   * instead of asking the owner to place sixty episodes by hand.
   *
   * IT TAKES THE CONTAINER'S ID FROM THE OWNER, because nothing in CMPP hands
   * one over -- `search` returns stories and `browse` takes a container's own
   * id, so no operation answers "which containers do you have". The owner names
   * it, exactly as they name a record for `import`.
   */
  browse: publicProcedure
    .input(
      z.object({
        /** A CONFIG URL, travelling ADR-0034's allowlist, as `import`'s does. */
        baseUrl: z.url(),
        /** The provider's own id for the container, the one `browse` takes. */
        containerId: z.string().min(1),
      }),
    )
    .output(
      z.object({
        containerId: z.uuid(),
        /**
         * Every member written, container-side. The placement id is here for
         * the same reason `?via=` carries one (ADR-0066): it names the ordering
         * a reader would arrive through, and it is an address rather than an
         * internal id.
         */
        members: z.array(z.object({ itemId: z.uuid(), placementId: z.uuid() })),
        /**
         * How many values across the whole browse were held apart, the
         * container's own included (CNCORE-29).
         *
         * THE BULK PATH IS WHY THIS FIELD EXISTS. One call writes a container's
         * worth of dates, so a bad source fills the catalogue rather than a row
         * of it -- and sixty members' worth of quarantined dates reported as a
         * plain success is the "silently" this ticket refuses.
         */
        quarantinedValues: z.number().int().nonnegative(),
      }),
    )
    .errors({
      PROVIDER_REFUSED: {
        message: "That provider URL is not one this instance may reach.",
      },
      BROWSE_NOT_OFFERED: {
        message: "That provider does not offer browse, so it was not asked for one.",
      },
      NO_SUCH_CONTAINER: {
        message: "The provider holds no container at that id.",
      },
    })
    .handler(async ({ input, context, errors }) => {
      try {
        const browsed = await browseIntoCatalogue(context.db, context.providerAllowlist, input);
        if (!browsed) throw errors.NO_SUCH_CONTAINER();
        return browsed;
      } catch (error) {
        if (error instanceof OutboundRefused) {
          throw errors.PROVIDER_REFUSED({ message: error.message });
        }
        // A DECLARED ERROR RATHER THAN A 500, for the same reason a refusal is
        // one: the owner asked for this and a UI has to be able to tell them
        // that this provider does not do it. ADR-0033 makes declining `browse`
        // well-formed, so it must not read as the provider being broken.
        if (error instanceof BrowseNotOffered) {
          throw errors.BROWSE_NOT_OFFERED({ message: error.message });
        }
        throw error;
      }
    }),

  /**
   * Removes everything one provider ever said, in one operation.
   *
   * ADR-0036: TMDB's terms end in termination, and termination "requires purging
   * all cached TMDB content". That record's claim about what this costs is that
   * `source` on every row "already makes one delete" -- so this procedure exists
   * to make the claim TRUE rather than to build a purge subsystem that works
   * around its being false. There is no ownership column to sweep and no
   * per-table policy, because every row that can carry a claim names who made it.
   *
   * NO REQUEST LEAVES THE APP, AND THAT IS WHY THERE IS NO `PROVIDER_REFUSED`
   * HERE. `baseUrl` is an IDENTITY on this path rather than an address: the rows
   * to delete are this catalogue's, and a provider whose licence has just been
   * terminated is precisely the one nothing should be calling. So the allowlist
   * has no say -- an owner must be able to purge a provider they can no longer
   * reach, which is the ordinary case when a licence ends rather than an exotic
   * one. ADR-0034's boundaries stand in front of requests, and this makes none.
   *
   * IT ANSWERS WITH COUNTS rather than with nothing, because "done" and "there
   * was nothing there" are different answers and an owner running this after a
   * termination notice needs to be able to tell them apart. It answers them
   * AFTERWARDS, and `previewPurge` below is where ADR-0046's "counts shown
   * first" is satisfied -- the same traversal, stopped before it commits.
   */
  purge: publicProcedure
    .input(purgeTarget)
    .output(purgeCounts)
    .handler(async ({ input, context }): Promise<PurgedProvider> => {
      return purgeProvider(context.db, { identity: input.baseUrl });
    }),

  /**
   * What `purge` would take, answered before it takes it (ADR-0046).
   *
   * A purge is the delete where a preview matters most. It is the one an owner
   * runs under time pressure, after a termination notice, against a provider
   * whose content they can no longer inspect because the provider is
   * unreachable -- so the counts are the only description of it they will get.
   *
   * THE SAME TRAVERSAL, ROLLED BACK, rather than a second one that describes it.
   * A preview free to disagree with the delete is worse than no preview, because
   * an owner deciding under a notice has already acted on it by the time the
   * delete contradicts it.
   *
   * IT MAKES NO REQUEST EITHER, for the reason `purge` makes none: an owner must
   * be able to ask this about a provider they can no longer reach, which is the
   * ordinary case when a licence ends rather than an exotic one.
   */
  previewPurge: publicProcedure
    .input(purgeTarget)
    .output(purgeCounts)
    .handler(async ({ input, context }): Promise<PurgedProvider> => {
      return previewProviderPurge(context.db, { identity: input.baseUrl });
    }),
};
