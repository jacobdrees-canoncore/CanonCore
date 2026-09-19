import {
  beginImportRun,
  type Database,
  findItemsProvided,
  type ImportedContainer,
  type ImportedRecord,
  importBrowsedContainer,
  importProvidedRecord,
  nextPendingContainer,
  type PurgedProvider,
  previewProviderPurge,
  purgeProvider,
  type RunContainer,
  readImportRun,
  recordContainerLanded,
  recordContainerRefused,
} from "@canoncore/db";
import {
  type Allowlist,
  allowsAnything,
  bounded,
  type CmppBrowse,
  type CmppManifest,
  type CmppRecord,
  createProviderClient,
  type FailureReason,
  failureReason,
  type ProviderClient,
  REASON_MAX_LENGTH,
  reasonFor,
  searchProviders,
} from "@canoncore/providers";
import { z } from "zod";

import { openProcedure, ownerProcedure } from "../index";
import { theProvidersAsked } from "./group";
import { A_PAGE, aCursor } from "./listing";

/**
 * Raised when REACHING a provider failed, carrying the reason a page may print.
 *
 * NAMED FOR WHERE IT HAPPENED RATHER THAN FOR WHAT WAS THROWN, which is
 * ADR-0123's own rule one question over. That record decides WHOSE a sentence is
 * by asking which boundary refused, because the error's CLASS does not answer
 * it; the same holds for "is this the provider's failure at all". The three
 * things that arrive here -- ADR-0034 refusing a URL, a socket that never
 * opened, a provider that answered badly -- have no class in common and no
 * class they do not share with a bug in this app, so what distinguishes them is
 * that they were thrown while a provider was being asked something.
 *
 * WHICH IS WHY THE CATALOGUE'S OWN WRITE IS OUTSIDE IT. `importProvidedRecord`
 * runs after the provider has answered, and a `catch` wide enough to hold every
 * way a provider can fail is wide enough to report a failed INSERT as something
 * the provider did -- a false attribution in a field ADR-0123 built to stop
 * exactly those.
 *
 * IT CARRIES THE REASON RATHER THAN A MESSAGE, so the mapping happens once, at
 * the seam where the thrown thing is still in hand. `reasonFor` is the single
 * mapping that record names, and a procedure re-deriving it from a message would
 * be the fifth site it exists to prevent.
 */
export class ProviderFailed extends Error {
  constructor(readonly reason: FailureReason) {
    super(reason.text);
  }
}

/**
 * Whatever was thrown ASKING a provider something, as the failure that says so.
 *
 * ONE WRAPPER FOR BOTH WRITE PATHS, for the reason `browseIfOffered` below is
 * one preamble for two callers: `import` and `browse` had the identical `catch`
 * and the identical hole in it (CNCORE-149), which is how one defect came to
 * have two sites -- the shape ADR-0123 was written about. AND FOR ONE READ,
 * `provider.containers` (CNCORE-187), for the reason it exists on the write
 * paths: that read queries the catalogue after the provider answers, and the
 * catalogue's failure must not be reported as the provider's.
 *
 * IT WRAPS THE ASKING AND NOTHING ELSE. What goes inside is every request a
 * provider can fail; what stays outside is the catalogue's own write and the
 * app's own answers -- `BrowseNotOffered` is raised on a manifest that came back
 * fine, and reporting it as a provider failure would say the opposite of what
 * ADR-0033 decided about a provider that declines `browse`.
 */
async function askingTheProvider<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new ProviderFailed(reasonFor(error));
  }
}

/**
 * THE REFUSAL BOTH WRITE PROCEDURES DECLARE, WRITTEN ONCE (ADR-0123).
 *
 * That record exists because one defect had two sites that each solved it
 * separately, and these two procedures are how it got them: the identical
 * `catch`, narrowed the identical way, with the identical hole in it. A second
 * copy of the declaration is the same shape one layer up -- two places for the
 * status, the message and the reason's schema to stop agreeing.
 */
const providerRefused = {
  /**
   * THREE THINGS ARE IN HERE AND THE MESSAGE NAMES NONE OF THEM, which is the
   * correction CNCORE-149 made to it. It said "That provider URL is not one this
   * instance may reach", which is true of ADR-0034 refusing a URL and false of
   * the other two: a socket that never opened, and a provider that ANSWERED
   * badly -- that one was reached. `provider.container`'s `unreachable` branch
   * keeps the same three apart the same way, by what they SAY rather than by the
   * name over them.
   */
  message: "Nothing usable came back from that provider.",
  /**
   * BELOW 500, BECAUSE A PROVIDER FAILING IS NOT THIS SERVER BEING BROKEN -- AND
   * WITHOUT THIS THE DECLARED ERROR NEVER REACHES A PAGE. oRPC gives a code of
   * its own `status: 500` (`fallbackORPCErrorStatus` is
   * `status ?? COMMON_ORPC_ERROR_DEFS[code]?.status ?? 500`, measured on
   * @orpc/client 1.15.0), and `answer.ts` reads exactly that number to tell a
   * refusal from a fault: at 500 it rethrows, and a Server Action that throws
   * with no script loaded answers the bare `Internal Server Error` -- the same
   * eighteen bytes the UNDECLARED throw answered. So declaring the error without
   * declaring its status would narrow the RPC surface and leave the page exactly
   * as it was.
   *
   * `424` RATHER THAN `502`, WHICH IS THE MORE OBVIOUS AND THE WRONG ONE. RFC
   * 9110's gateway status is the better literal fit -- an inbound server
   * answered badly -- but it is a 5xx, and a 5xx in this app means a genuine
   * fault: `answer.ts` rethrows it and `/api/rpc` logs the stack (ADR-0125). An
   * expired credential at a third party is neither. What this catalogue already
   * decided about the same failure is on the READ side, where
   * `provider.container` answers it at 200 as an ANSWER, and a 4xx is that
   * position held on the write side. RFC 4918's `424` is the registered one that
   * says it: "A method's execution has failed because it depends on the
   * execution of another method, and that other method failed."
   */
  status: 424,
  /**
   * THE REASON, IN THE SHAPE THE READ SURFACES CARRY (ADR-0123). It was a bare
   * `message` string until CNCORE-149, which is two shapes for one thing -- and
   * the half a string cannot carry is `wrote`, so a caller holding one has no way
   * to tell this catalogue's sentence about the Owner's own settings from a
   * third party's text.
   *
   * DECLARED, so the ceiling is in the output schema a caller is held to rather
   * than an invariant two handlers each had to remember, and stated in the
   * OpenAPI document a caller reads.
   */
  data: failureReason,
};

/**
 * A Provider's declared name, as a caller of this API receives it (ADR-0123,
 * CNCORE-165).
 *
 * `cmppManifest` is what BOUNDS the name, where the manifest is read, and it is
 * nothing a caller of this API can see. This is where the ceiling is STATED, in
 * the output schema every procedure answering a name is held to -- the rule
 * `failureReason.text` has kept since CNCORE-95 and the name did not.
 *
 * ONE SCHEMA FOR EVERY FIELD CARRYING IT, which is ADR-0123's lesson one layer
 * up: `provider.search` and `provider.container` answered this name at four
 * fields, each `z.string().min(1)`, so a ceiling written on one of them would
 * have been a ceiling on one of four.
 *
 * AND IT IS ENFORCED, NOT ONLY STATED: oRPC validates every answer against it.
 * With the parse-side bound removed, every `/import` search answered 500
 * (measured under CNCORE-165) -- one Provider's name taking the page down for
 * every other Provider on it. That is the right failure for what it now means.
 * `cmppManifest` bounds the name before any code here sees it, so a name past
 * this ceiling can only be a bug in THIS APP, and a bug should surface as a 500
 * with its stack in the log (ADR-0125) rather than as a page quietly flooded.
 * And it is in the OpenAPI document, which `route.test.ts` asserts (CNCORE-212).
 */
const declaredName = z.string().min(1).max(REASON_MAX_LENGTH);

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
    const { manifest, record } = await askingTheProvider(async () => {
      // The manifest first, for the provider's OWN name. A source answers "who
      // said this", and `provider-wiki` answers it where `http://127.0.0.1:39481`
      // shows a reader a deployment detail.
      const manifest = await client.manifest();
      return { manifest, record: await client.lookup(recordId) };
    });
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
 * What one provider answers when asked to browse: whether it OFFERS the
 * operation at all, and what it held at that id if it does.
 *
 * TWO QUESTIONS AND NOT ONE, because ADR-0033 makes them separate facts. A
 * provider may decline `browse` and still be well-formed, which is not the same
 * as holding nothing at an id -- and a caller that could not tell them apart
 * would report a provider that does not do this as a provider whose id was
 * wrong.
 */
type BrowseAttempt =
  | { manifest: CmppManifest; offered: false }
  | { manifest: CmppManifest; offered: true; browsed: CmppBrowse | null };

/**
 * The CMPP preamble every browse begins with: read the manifest, and let its
 * `operations` decide whether to ask at all.
 *
 * ONE COPY BECAUSE THE TWO CALLERS MUST NOT DRIFT. `browseIntoCatalogue` below
 * performs a browse and `provider.container` reads what one would do, and the
 * page offers its button on the strength of the second -- so a precondition
 * that got stricter in one and not the other would put a button in front of an
 * owner that the import then refuses, which is the exact defect CNCORE-92 was
 * filed to remove. Sharing the check is what makes the page's answer a
 * prediction rather than a guess.
 *
 * IT DOES NOT DECIDE WHAT TO DO ABOUT EITHER ANSWER, which is why it returns
 * them rather than throwing: one caller raises a declared error and the other
 * prints a sentence, and that difference is the whole distance between them.
 */
async function browseIfOffered(
  client: ProviderClient,
  containerId: string,
): Promise<BrowseAttempt> {
  // THE MANIFEST FIRST, for the provider's OWN name as much as for its
  // operations. A source answers "who said this", and `provider-wiki` answers
  // it where `http://127.0.0.1:39481` shows a reader a deployment detail.
  const manifest = await client.manifest();
  if (!manifest.operations.includes("browse")) return { manifest, offered: false };
  return { manifest, offered: true, browsed: await client.browse(containerId) };
}

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
 * THE CONTAINER IS NAMED BY THE OWNER, by the provider's own id: picked from
 * what `provider.containers` offers since CNCORE-187, or typed where a provider
 * declines that operation. Either way it arrives here as an id, exactly as a
 * record id reaches `import`, so a container picked from the list lands what
 * one named by hand lands -- see ADR-0033's as-built sections, which carry the
 * decision rather than leaving it to be rediscovered.
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
    const attempt = await askingTheProvider(() => browseIfOffered(client, containerId));
    if (!attempt.offered) {
      // THE NAME ARRIVES BOUNDED, by `cmppManifest` where the manifest is read
      // (CNCORE-165). This line bounded it itself until then, which was right
      // and was one of four sites: the same name reached `providerFrom` and
      // `provider.search` raw. The prose around it is fixed-length and cannot
      // be cut.
      throw new BrowseNotOffered(
        `${attempt.manifest.name} declares no browse; it was not asked for one.`,
      );
    }
    const browsed = attempt.browsed;
    if (!browsed) return null;

    return await importBrowsedContainer(db, {
      provider: providerFrom(baseUrl, attempt.manifest),
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
   * provider ever wrote: one the owner also placed somewhere, or put in a Group,
   * survives, untitled, because either is the owner's claim and a provider's
   * licence ending has no bearing on it.
   */
  items: z.number().int().nonnegative(),
  /**
   * And how many of the provider's items THOSE are: the ones that stay, stripped
   * of what it said about them (CNCORE-69).
   *
   * A COUNT OF REMOVALS DESCRIBES HALF OF WHAT A PURGE DOES. Without this, a
   * preview answers "1 item" about a provider that touched five and reads as the
   * whole answer -- and the surviving four turn up untitled on a page the owner
   * did not expect to change. ADR-0046 names this outcome as the one the delete
   * performs on its own to anything somebody else claims.
   *
   * DECLARED HERE OR IT IS DROPPED IN SILENCE. A zod object strips what it does
   * not name, so a field the traversal computes and this schema omits leaves the
   * procedure quietly answering without it -- which is how the page that reads it
   * found this line missing.
   */
  keptItems: z.number().int().nonnegative(),
  /*
   * HELD TO THE TYPE THE TRAVERSAL RETURNS, so the next count cannot be dropped
   * the way this one was. A zod object strips what it does not name and both
   * procedures declare `Promise<PurgedProvider>`, so a field added to the
   * traversal and forgotten here type-checked, ran, and answered without it --
   * found by a page that read it rather than by anything nearer. `satisfies`
   * makes that a compile error: a schema missing a field no longer produces a
   * `PurgedProvider`.
   */
}) satisfies z.ZodType<PurgedProvider>;

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

/**
 * ONE CONTAINER OF A RUN, as a caller reads it back.
 *
 * A UNION RATHER THAN NULLABLE FIELDS, because the three outcomes carry
 * different things: what landed says what it wrote, what refused says why, and
 * what has not been asked for yet says neither. It is migration 18's two
 * equivalence checks in the shape a caller holds them.
 */
const runContainer = z.discriminatedUnion("outcome", [
  z.object({
    /** The Provider's own id, which is what the Owner put in their list (ADR-0033). */
    containerId: z.string().min(1),
    outcome: z.literal("pending"),
  }),
  z.object({
    containerId: z.string().min(1),
    outcome: z.literal("landed"),
    /** How many Placements this Container's browse wrote, its unplaced members included. */
    placements: z.number().int().nonnegative(),
    /** How many values arrived broken and were held apart from the live set (CNCORE-29). */
    quarantinedValues: z.number().int().nonnegative(),
  }),
  z.object({
    containerId: z.string().min(1),
    outcome: z.literal("refused"),
    /** WHOSE SENTENCE, AND THE SENTENCE (ADR-0123). A surface attributes a Provider's and not ours. */
    reason: failureReason,
  }),
]);

/** A run and every Container of it, in the order the Owner listed them. */
const importRunReport = z.object({
  runId: z.uuid(),
  containers: z.array(runContainer),
});

/** The run as the wire carries it: the store's union, renamed to the Owner's word. */
function asReportedContainer(container: RunContainer): z.infer<typeof runContainer> {
  if (container.outcome === "landed") {
    return {
      containerId: container.externalId,
      outcome: "landed",
      placements: container.placements,
      quarantinedValues: container.quarantinedValues,
    };
  }
  if (container.outcome === "refused") {
    return {
      containerId: container.externalId,
      outcome: "refused",
      reason: container.reason,
    };
  }
  return { containerId: container.externalId, outcome: "pending" };
}

/**
 * ONE CONTAINER BROWSED INTO THE CATALOGUE, or the reason it was not.
 *
 * EVERY FAILURE IS AN ANSWER HERE, which is `provider.container`'s posture on
 * the write side and the reason this walk can finish at all. `provider.browse`
 * declares three errors, and an error stops a caller: a list of 465 whose
 * seventh id was deleted last week would end at the seventh. What the Owner
 * needs instead is the other 458 imported and a sentence about the one that was
 * not, which is this ticket's whole "visible rather than silent".
 *
 * A THROW STILL MEANS A FAULT, and that line is deliberately where
 * `ProviderFailed` already draws it: what a Provider did is an answer, and what
 * THIS catalogue failed at -- a write that would not commit -- is not the
 * Provider's to be blamed for and must not be recorded as its refusal.
 */
async function oneContainerIntoTheCatalogue(
  db: Database,
  allowlist: Allowlist,
  { baseUrl, containerId }: BrowseRequest,
): Promise<{ landed: ImportedContainer } | { refused: FailureReason }> {
  try {
    const browsed = await browseIntoCatalogue(db, allowlist, { baseUrl, containerId });
    if (browsed) return { landed: browsed };
    // ADR-0066: an id that addresses nothing is an ANSWER. The sentence is
    // CanonCore's own, because nothing went wrong at the Provider -- attributing
    // it to one would send the Owner to look at a machine that is working.
    return {
      refused: {
        wrote: "canoncore",
        text: `That Provider holds no Container at ${bounded(containerId)}.`,
      },
    };
  } catch (error) {
    if (error instanceof ProviderFailed) return { refused: error.reason };
    // ADR-0033 makes declining `browse` well-formed, so this is not the Provider
    // being broken. The sentence is ours, and it already carries the Provider's
    // own bounded name.
    if (error instanceof BrowseNotOffered) {
      return { refused: { wrote: "canoncore", text: bounded(error.message) } };
    }
    throw error;
  }
}

/**
 * ONE PAGE OF WHAT A PROVIDER LISTED, walked by the provider's own id for the
 * container a page ended on (ADR-0119) -- or, stepping back, began on
 * (CNCORE-174).
 *
 * THE WALK IS THIS APP'S BECAUSE THE PROVIDER'S ANSWER IS WHOLE. `containers`
 * carries no cursor (ADR-0033 under CNCORE-185), so every page is cut from one
 * answer, in the provider's own order. A cursor naming nothing it listed names
 * no position, so the walk starts over, which is ADR-0119's answer for a row
 * that is gone. A step back that reaches the start answers the first page
 * whole rather than the few rows short of it, as the Listings do.
 *
 * EACH ID ONCE, THE FIRST COPY STANDING, because the cursor is an id and
 * nothing in CMPP promises a provider names each container once. With a repeat,
 * `Next` from a page ending on the second copy found the first and served that
 * page again, forever (found by review of CNCORE-187). A container offered twice
 * is no more pickable than one offered once.
 */
function aPageOf<Listed extends { id: string }>(
  answered: Listed[],
  { limit, after, before }: { limit: number; after?: string; before?: string },
) {
  const seen = new Set<string>();
  const listed = answered.filter(({ id }) => !seen.has(id) && seen.add(id));
  const afterAt = after === undefined ? -1 : listed.findIndex(({ id }) => id === after);
  const beforeAt = before === undefined ? -1 : listed.findIndex(({ id }) => id === before);
  const start = afterAt >= 0 ? afterAt + 1 : beforeAt >= 0 ? Math.max(0, beforeAt - limit) : 0;
  const page = listed.slice(start, start + limit);
  return {
    page,
    total: listed.length,
    continuesAfter: start + limit < listed.length ? (page.at(-1)?.id ?? null) : null,
    continuesBefore: start > 0 ? (page[0]?.id ?? null) : null,
  };
}

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
   * NO REQUEST LEAVES THE APP. It reads this instance's own settings, which the
   * owner edits at `/settings` and `createContext` reads per request -- so the
   * answer changes with the configuration rather than with a restart.
   */
  allowlisted: openProcedure.output(z.object({ any: z.boolean() })).handler(async ({ context }) => {
    const { allowlist } = await context.providerSettings();
    return { any: allowsAnything(allowlist) };
  }),

  /**
   * WHICH PROVIDERS THIS INSTANCE SEARCHES, so a surface can say "none" rather
   * than show an empty result.
   *
   * THE SECOND HALF OF THE SAME SILENCE `allowlisted` ABOVE NAMES. An instance
   * reaches no provider either because nothing is allowlisted or because nothing
   * is named, and the two have different remedies -- the allowlist and the
   * providers beside it, both on `/settings` -- so one answer could not tell an
   * owner which of them to go and change.
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
   * NO REQUEST LEAVES THE APP. It reads this instance's own settings, so it
   * answers for a provider that is switched off exactly as for one that is
   * running.
   */
  configured: openProcedure
    .output(z.object({ providers: z.array(z.url()) }))
    .handler(async ({ context }) => {
      const { urls } = await context.providerSettings();
      return { providers: urls };
    }),

  /**
   * WHICH OF ONE PROVIDER'S RECORDS THIS CATALOGUE ALREADY HOLDS, for ids the
   * owner names rather than for candidates a search found.
   *
   * `search` ANSWERS THIS ALREADY FOR WHAT IT FOUND, and this exists for the case
   * it cannot reach: a CONTAINER id, which the owner names -- picked from
   * `provider.containers` since CNCORE-187, or typed where a provider declines
   * that operation (ADR-0033). A surface showing the one they named has no
   * search answer to read the Item out of.
   *
   * NO REQUEST LEAVES THE APP. `baseUrl` is an IDENTITY here rather than an
   * address, exactly as it is for `purge`: the rows are this catalogue's, and the
   * question is about what was imported rather than about what the provider says
   * now. So the allowlist has no say and a provider that is switched off answers
   * the same as one that is running.
   */
  held: openProcedure
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
   * Searches EVERY configured provider at once -- or, within a Group, every one
   * that Group asks (ADR-0025, CNCORE-182) -- and answers what each of them
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
   * (ADR-0031) and there is no registry, so the set comes from the settings,
   * read per request. Taking it as input would make every caller name the
   * providers, and a caller that named one would get one answer and no way to
   * know it had missed the other. A GROUP NARROWS THE SET RATHER THAN NAMING
   * ONE, for the same reason: it is the Owner's standing choice, read from the
   * catalogue, and never a list the caller supplies.
   */
  search: openProcedure
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
        /**
         * THE GROUP THE OWNER IS SEARCHING WITHIN (ADR-0025, CNCORE-182),
         * which decides who is asked: the Providers it asks, and no others.
         * Absent is every configured Provider, which is searching across
         * everything.
         *
         * A STRING RATHER THAN A `z.uuid()`, for the reason `listingInput`
         * gives for the same parameter: a Group that names nothing asks
         * nobody, and that is the answer rather than a BAD_REQUEST.
         */
        group: z.string().optional(),
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
              name: declaredName,
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
        failed: z.array(z.object({ baseUrl: z.url(), reason: failureReason })),
      }),
    )
    .handler(async ({ input, context }) => {
      // NO DECLARED ERROR FOR A REFUSAL HERE, WHICH IS THE OPPOSITE OF `import`
      // BELOW AND IS NOT AN OVERSIGHT. A refusal reaches one provider's turn and
      // is caught there, so it arrives as that provider's `failed` entry beside a
      // provider that answered -- the fan-out's whole purpose. Raising it as the
      // SEARCH's error would throw away every other provider's answers because
      // one URL was not allowlisted.
      const { allowlist, urls } = await context.providerSettings();
      const { answered, failed } = await searchProviders(
        {
          baseUrls:
            input.group === undefined ? urls : await theProvidersAsked(context, input.group),
          allowlist,
        },
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
        // BOUNDED AND ATTRIBUTED RATHER THAN THE RAW MESSAGE (ADR-0123). An
        // `Error` does not serialise across the wire, and the message alone let
        // the provider choose how much of the owner's page it filled -- a
        // refused body is one zod issue per bad field, so 200 malformed records
        // is a reason no page can show. `reasonFor` caps it and says whose
        // sentence it is, which is what keeps ADR-0034's refusal -- the one
        // naming the setting to fix -- readable as CanonCore's own.
        failed: failed.map(({ baseUrl, reason }) => ({ baseUrl, reason: reasonFor(reason) })),
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
  import: ownerProcedure
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
      PROVIDER_REFUSED: providerRefused,
      NO_SUCH_RECORD: {
        message: "The provider holds no record at that id.",
        /**
         * `404`, AND THE STATUS IS WHAT MAKES THE DECLARATION REACH ANYONE
         * (CNCORE-152). Declaring the code is half of it: oRPC gives a code of
         * our own `status: 500` -- `fallbackORPCErrorStatus` is
         * `status ?? COMMON_ORPC_ERROR_DEFS[code]?.status ?? 500`, and this code
         * is not a common def -- so `answer.ts` rethrows it as a fault and the
         * Server Action answers the bare `Internal Server Error`. The Take
         * button is rendered for EVERY search candidate, so a record the
         * provider drops between the search that drew the row and the POST that
         * presses it hit exactly that until this line existed.
         *
         * BELOW 500 BECAUSE THIS IS AN ANSWER RATHER THAN A FAULT, which is
         * ADR-0123's reasoning for `424` one code over and holds unchanged here:
         * a 5xx in this app means a genuine fault, logged with its stack
         * (ADR-0125), and a provider that simply holds nothing at an id is not
         * one. ADR-0066 already makes an id that addresses nothing an ANSWER,
         * and `provider.container` answers the same thing at 200 on the read
         * side -- this is that position held on the write side, where a write
         * that wrote nothing must not report success.
         *
         * RFC 9110's OWN WORDS FOR IT, read at 15.5.5: 404 "indicates that the
         * origin server did not find a current representation for the target
         * resource or is not willing to disclose that one exists". The record is
         * the resource and the provider is the origin server for it. `410` is
         * the one that record prefers where the condition "is likely to be
         * permanent", and nothing here knows that: a wiki page deleted today can
         * be restored tomorrow, so 404 is the honest one of the two.
         */
        status: 404,
      },
    })
    .handler(async ({ input, context, errors }) => {
      try {
        const { allowlist } = await context.providerSettings();
        const imported = await importRecordFromProvider(context.db, allowlist, input);
        if (!imported) throw errors.NO_SUCH_RECORD();
        return imported;
      } catch (error) {
        // A FAILED PROVIDER IS AN ANSWER, NOT A CRASH. The owner typed this URL,
        // so a UI has to be able to put the reason in front of them -- and an
        // undeclared throw is a 500 no caller can narrow on, which is the same
        // defect CNCORE-14 fixed for a malformed item id.
        //
        // EVERYTHING THE PROVIDER FAILED AT, rather than the one class foreseen.
        // This narrowed to `OutboundRefused` until CNCORE-149, so a provider
        // ANSWERING a non-2xx -- an expired credential, which CNCORE-100 makes
        // the ordinary failure of a live provider -- fell past it and was the
        // 500 this catch exists to remove. What decides it now is WHERE the
        // throw happened rather than what class it was, because the failures a
        // provider can produce have no class in common.
        if (error instanceof ProviderFailed) {
          throw errors.PROVIDER_REFUSED({ data: error.reason });
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
   *
   * AND THE OWNER'S DESPITE BEING A READ, WHICH IS THE ONE OF THOSE ON THIS
   * SURFACE (ADR-0131, CNCORE-154). It answers by running `browse` -- the SAME
   * work the `ownerProcedure` below does, at a third party -- and CNCORE-151
   * raised that operation's cap to 60s because the largest timeline on
   * tardis.wiki needs 25.7s. Open, that let anyone who could reach the instance
   * hold a server-side browse for a minute a call, with nothing rate-limiting it
   * and two concurrent large browses roughly doubling each other.
   *
   * `provider.search` REACHES PROVIDERS TOO AND IS STILL OPEN, which is the
   * boundary rather than an oversight. ADR-0130 caps a provider by the KIND of
   * question, and `browse` is the only operation on the 60-second `patient`
   * cap: `search` is `brief` -- ten seconds -- and measured at 0.25s against
   * the live wiki. Both procedures ask the manifest first and serially, so the
   * worst case is the SUM rather than the larger cap: up to 70s here (10 + 60)
   * against up to 20s there (10 + 10). It is also ADR-0044's demo being
   * something a visitor can look around at all. If `search` ever moves to
   * `patient`, ADR-0131's rule catches it and it moves behind this door too.
   *
   * WHICH IS A DIFFERENT QUESTION FROM WHETHER IT WRITES, and that is why the
   * answer is not CNCORE-109's. That ticket put everything that CHANGES the
   * catalogue behind the session; this changes nothing and is still the
   * Owner's, because what it spends is this instance's standing at a provider
   * rather than its own rows.
   */
  container: ownerProcedure
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
          providerName: declaredName,
          /** The container's own title, which is what the owner cannot see today. */
          title: z.string().min(1),
          /**
           * HOW MANY PLACEMENTS A BROWSE WOULD WRITE, which is what pressing the
           * button costs. One call writes a container's worth of placements --
           * that is why `browse` exists (ADR-0033) -- and this is the owner's
           * only description of it beforehand.
           *
           * THE ONES THE ORDERING CANNOT POSITION ARE COUNTED TOO, because they
           * are placements with no position rather than non-members, and
           * `importBrowsedContainer` writes them exactly as it writes the rest.
           * For the wiki that is about a sixth of a category.
           */
          placements: z.number().int().nonnegative(),
        }),
        /**
         * THE PROVIDER WAS ASKED AND HOLDS NOTHING THERE, which ADR-0066 makes
         * an answer rather than a failure: an id that cannot BE an identity
         * addresses nothing, exactly as one nobody minted does.
         */
        z.object({
          answer: z.literal("no-such-container"),
          providerName: declaredName,
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
          providerName: declaredName,
        }),
        /**
         * NOTHING USABLE CAME BACK, so there is no name to attribute this to --
         * reading the provider's own name is one of the things that failed,
         * exactly as in `search`'s `failed` list.
         *
         * THREE THINGS ARE IN HERE, not two: a URL ADR-0034 refused before a
         * socket opened, a provider that never answered, and a provider that
         * ANSWERED BADLY -- a non-2xx status, or a body `packages/providers`
         * refuses to parse. The last is why the page's copy for this does not
         * say "could not be reached": that provider was reached.
         *
         * THE REASON IS THE SENTENCE THE OWNER ACTS ON, and it is what keeps the
         * three apart, because the three have different remedies.
         */
        z.object({
          answer: z.literal("unreachable"),
          reason: failureReason,
        }),
      ]),
    )
    .handler(async ({ input, context }) => {
      const { allowlist } = await context.providerSettings();
      const client = createProviderClient({ baseUrl: input.baseUrl, allowlist });
      try {
        // THE SAME PREAMBLE `browseIntoCatalogue` RUNS, which is what makes this
        // a prediction of the button rather than a second opinion about it.
        const attempt = await browseIfOffered(client, input.containerId);
        const providerName = attempt.manifest.name;
        if (!attempt.offered) return { answer: "browse-not-offered" as const, providerName };
        if (!attempt.browsed) return { answer: "no-such-container" as const, providerName };
        return {
          answer: "container" as const,
          providerName,
          title: attempt.browsed.container.title,
          placements: attempt.browsed.ordering.length + attempt.browsed.unplaced.length,
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
        // BOUNDED AND ATTRIBUTED, by the one rule `provider.search`'s `failed`
        // list takes (ADR-0123). The two carried this field independently --
        // CNCORE-68 and CNCORE-92 -- and each mapped its own catch, which is how
        // one defect came to have two sites.
        return { answer: "unreachable" as const, reason: reasonFor(error) };
      } finally {
        // Two undici agents and therefore two connection pools, as everywhere
        // else on this path.
        await client.close();
      }
    }),

  /**
   * THE CONTAINERS ONE PROVIDER HOLDS, so the Owner picks one rather than
   * typing an id the provider never showed them (CNCORE-187).
   *
   * THE READ THE `containers` OPERATION WAS DECLARED FOR (ADR-0033 under
   * CNCORE-185): `browse` takes a container's own id and `search` answers
   * stories, so until this nothing in the product could say which containers
   * there are.
   *
   * A UNION RATHER THAN DECLARED ERRORS, for `provider.container`'s reason: the
   * page is being READ, and each outcome is a sentence it prints.
   *
   * OPEN, WHICH IS ADR-0131's RULE APPLIED RATHER THAN SKIPPED. A read is the
   * Owner's when it spends a third party's time, and the line is the `patient`
   * cap. This one is `brief`: `provider-wiki` answered all 465 of its timelines
   * in 0.26s to first byte on 2026-09-19, beside a search's 0.25s. So it is
   * `provider.search`'s case, and a visitor to ADR-0044's demo is shown what a
   * provider holds exactly as they are shown what it matched.
   */
  containers: openProcedure
    .input(
      z.object({
        /** A CONFIG URL, travelling ADR-0034's allowlist, as `browse`'s does. */
        baseUrl: z.url(),
        /** How many to answer with: fewer than a Listing's page, never more. */
        limit: z.number().int().positive().max(A_PAGE).default(A_PAGE),
        /** The provider's id for the last container the page before showed. */
        after: aCursor,
        /** The provider's id for the first container the page after showed. */
        before: aCursor,
      }),
    )
    .output(
      z.discriminatedUnion("answer", [
        z.object({
          answer: z.literal("containers"),
          /** The name the provider gives itself, off its manifest. */
          providerName: declaredName,
          containers: z.array(
            z.object({
              /** The provider's own id for it, the one `browse` takes. */
              containerId: z.string().min(1),
              title: z.string().min(1),
              /** The PROVIDER'S word for what it is -- `timeline`, `collection`. */
              kind: z.string().min(1),
              /** The Item this container is already held as, or `null` (ADR-0026). */
              itemId: z.uuid().nullable(),
            }),
          ),
          /** How many the provider holds altogether, which a page may not show. */
          total: z.number().int().nonnegative(),
          /** The last container this page shows where more follow it, or `null` (ADR-0119). */
          continuesAfter: z.string().nullable(),
          /** The first container this page shows where more come before it, or `null`. */
          continuesBefore: z.string().nullable(),
        }),
        /**
         * THE PROVIDER DOES NOT DO THIS, which ADR-0033 makes well-formed: the
         * operation is optional and declared, as `browse` is. It is NOT a
         * provider holding none, which would be `containers` with nothing in
         * it -- the two must never read alike, and it is the Owner's story 60.
         */
        z.object({
          answer: z.literal("containers-not-offered"),
          providerName: declaredName,
        }),
        /**
         * NOTHING USABLE CAME BACK, which is `provider.container`'s third answer
         * for the same three things -- a URL ADR-0034 refused, a provider that
         * never answered, one that answered badly -- and ADR-0033 saw it live: a
         * lapsed Credential is a `503` naming `/unlock`. Reading it as an empty
         * list would tell the Owner their provider holds nothing.
         */
        z.object({
          answer: z.literal("unreachable"),
          reason: failureReason,
        }),
      ]),
    )
    .handler(async ({ input, context }) => {
      const { allowlist } = await context.providerSettings();
      const client = createProviderClient({ baseUrl: input.baseUrl, allowlist });
      let said: { manifest: CmppManifest; containers: CmppRecord[] | null };
      try {
        said = await askingTheProvider(async () => {
          // THE MANIFEST FIRST, and it decides whether to ask at all: a
          // provider that declines is never asked, which is the optionality
          // honoured rather than an optimisation (ADR-0033).
          const manifest = await client.manifest();
          if (!manifest.operations.includes("containers")) return { manifest, containers: null };
          return { manifest, containers: (await client.containers()).containers };
        });
      } catch (error) {
        // EVERY FAILURE ASKING IS AN ANSWER, bounded and attributed (ADR-0123).
        // The catalogue's own read below is outside this, so a failed query is
        // never reported as something the provider did.
        if (error instanceof ProviderFailed) {
          return { answer: "unreachable" as const, reason: error.reason };
        }
        throw error;
      } finally {
        await client.close();
      }

      const providerName = said.manifest.name;
      if (said.containers === null) {
        return { answer: "containers-not-offered" as const, providerName };
      }
      const { page, total, continuesAfter, continuesBefore } = aPageOf(said.containers, input);
      const held = await findItemsProvided(context.db, {
        identity: input.baseUrl,
        externalIds: page.map(({ id }) => id),
      });
      return {
        answer: "containers" as const,
        providerName,
        containers: page.map(({ id, title, kind }) => ({
          containerId: id,
          title,
          kind,
          itemId: held.get(id) ?? null,
        })),
        total,
        continuesAfter,
        continuesBefore,
      };
    }),

  /**
   * THE CONTAINER ONE RECORD NAMES, so a record found by SEARCHING reaches it
   * without the Owner typing an id (CNCORE-238).
   *
   * ONE LOOKUP, AND ONLY WHEN THE OWNER ASKS. A search cannot carry this:
   * `provider-tmdb` fills `series_id` on a lookup and a browse and never on a
   * search -- `searchResultToRecord` hardcodes `null` at `46a1189` -- because
   * TMDB's multi-search carries no collection and filling one would cost a
   * REQUEST PER RESULT. So the read is one record's, taken on the Owner's own
   * click, and a search still costs one request per Provider.
   *
   * IT ANSWERS AN ID, NOT A BROWSE. What comes back is the `series_id` a browse
   * takes, and the page leads to the same `?provider=&container=` address a
   * Container picked from `containers` reaches -- so the preview stays one
   * procedure with one gate rather than being reimplemented behind this one.
   *
   * OPEN, WHICH IS ADR-0131's RULE APPLIED RATHER THAN SKIPPED. A read is the
   * Owner's when it spends a third party's time, and the line that record draws
   * is the `patient` cap: `browse` is the only operation on it. A `lookup` is
   * `brief` (ADR-0130), so this is `provider.search`'s case and not
   * `provider.container`'s -- the same ten-second ceiling, one record rather
   * than a whole container's ordering. What stays behind the Owner is the
   * PREVIEW this leads to, which is the browse, and that is ADR-0131 untouched.
   *
   * NO `lookup-not-offered` ARM, because there is no such answer to give.
   * `CONTEXT.md` makes `lookup` required of every provider and ADR-0033 makes
   * `browse` the one a provider may decline -- so the arm `container` needs has
   * nothing to stand for here, and inventing one would describe a provider CMPP
   * does not permit.
   */
  containerOf: openProcedure
    .input(
      z.object({
        /** A CONFIG URL, travelling ADR-0034's allowlist, as `import`'s does. */
        baseUrl: z.url(),
        /** The provider's own id for the record, the one `lookup` takes. */
        recordId: z.string().min(1),
      }),
    )
    /*
     * A UNION RATHER THAN DECLARED ERRORS, for `provider.container`'s reason:
     * the caller is a page being READ, and every one of these is a sentence it
     * prints rather than a fault it recovers from.
     */
    .output(
      z.discriminatedUnion("answer", [
        z.object({
          answer: z.literal("container"),
          /** The name the provider gives itself, off its manifest. */
          providerName: declaredName,
          /** The record the Owner asked about, so the page can name it back. */
          recordTitle: z.string().min(1),
          /**
           * THE ID A BROWSE TAKES, which is the whole of what the Owner could
           * not see. `series` is a NAME and a name can be renamed out from
           * under an import, which is why ADR-0033 carries the id at all.
           */
          containerId: z.string().min(1),
          /**
           * THE CONTAINER'S NAME, AND NULLABLE BECAUSE THE TWO FIELDS ARE
           * INDEPENDENT. A provider may send `series_id` with no `series` and
           * still be well-formed, so the page needs a way to render a link it
           * has no name for rather than a blank one.
           */
          containerTitle: z.string().min(1).nullable(),
        }),
        /**
         * THE PROVIDER NAMES NO CONTAINER FOR THIS RECORD, which is an ANSWER
         * about the source rather than a failure. `provider-wiki` sends no
         * `series_id` at all -- a story sits in many timelines at once -- so
         * this is the ordinary answer there rather than the exceptional one.
         */
        z.object({
          answer: z.literal("no-container"),
          providerName: declaredName,
          recordTitle: z.string().min(1),
        }),
        /**
         * THE PROVIDER HOLDS NOTHING AT THAT ID, which ADR-0066 makes an answer
         * rather than a failure, exactly as `provider.container` does for a
         * container id nobody minted.
         */
        z.object({
          answer: z.literal("no-such-record"),
          providerName: declaredName,
        }),
        /**
         * NOTHING USABLE CAME BACK, so there is no name to attribute it to --
         * reading the provider's own name is one of the things that failed.
         * The three things in here are `provider.container`'s three, and they
         * stay apart by what the reason SAYS (ADR-0123).
         */
        z.object({
          answer: z.literal("unreachable"),
          reason: failureReason,
        }),
      ]),
    )
    .handler(async ({ input, context }) => {
      const { allowlist } = await context.providerSettings();
      const client = createProviderClient({ baseUrl: input.baseUrl, allowlist });
      try {
        /*
         * THE MANIFEST FIRST AND SERIALLY, which is the shape every procedure
         * on this router takes and what makes ADR-0131's sum honest: two
         * `brief` operations, so up to 20s, which is `provider.search`'s figure
         * rather than `provider.container`'s 70.
         *
         * NOT THROUGH `askingTheProvider`, AND THAT IS ADR-0123 RATHER THAN A
         * SHORTCUT. That helper raises `ProviderFailed(reasonFor(error))`,
         * which carries the reason as a VALUE and leaves no `cause` -- so
         * `reasonFor` called on the wrapper walks a chain that stops at the
         * wrapper, finds no `OutboundRefused`, and attributes CanonCore's own
         * refusal to the provider. Measured here: wrapped, ADR-0034's "is on no
         * allowlisted CIDR" sentence came back `wrote: "provider"`. The helper
         * is for the two procedures that THROW a declared error; this one
         * answers, exactly as `provider.container` does, and catches the raw
         * error for the same reason.
         */
        const manifest = await client.manifest();
        const record = await client.lookup(input.recordId);
        const providerName = manifest.name;
        if (!record) return { answer: "no-such-record" as const, providerName };
        /*
         * AN EMPTY ID NAMES NO CONTAINER, AND `null` IS NOT THE ONLY SPELLING OF
         * ABSENT. `cmppRecord` holds `series_id` to `z.string().nullable()` with
         * NO `.min(1)`, so `""` is a well-formed CMPP answer -- it parses clean,
         * passes a `=== null` guard, and lands on an output schema demanding
         * `.min(1)`. THAT FAILS OUTSIDE THE `try`, because oRPC validates what
         * the handler RETURNED: the one thing this union exists to prevent -- a
         * provider taking `/import` down with a 500 -- done by an empty string.
         *
         * ADR-0066 IS WHY IT IS THIS ANSWER RATHER THAN A FOURTH ARM: an id that
         * cannot BE an identity addresses nothing, exactly as one nobody minted
         * does. There is no container to reach, which is what `no-container`
         * says.
         */
        if (!record.series_id) {
          return { answer: "no-container" as const, providerName, recordTitle: record.title };
        }
        return {
          answer: "container" as const,
          providerName,
          recordTitle: record.title,
          containerId: record.series_id,
          /*
           * AND A NAME NOBODY CAN READ IS NOT A NAME. The two fields are
           * independent -- an id with no name is well-formed -- so `""` joins
           * `null` here rather than reaching the same `.min(1)` refusal one
           * field over. The page falls back to naming the thing instead.
           */
          containerTitle: record.series || null,
        };
      } catch (error) {
        // BOUNDED AND ATTRIBUTED, by the one rule `provider.search`'s `failed`
        // list and `provider.container` both take (ADR-0123).
        return { answer: "unreachable" as const, reason: reasonFor(error) };
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
   * IT TAKES THE CONTAINER'S ID FROM THE OWNER, who names it exactly as they
   * name a record for `import`: picked from what `provider.containers` offers
   * since CNCORE-187, or typed where a provider declines that operation.
   */
  browse: ownerProcedure
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
         * Every placement written, container-side. The placement id is here for
         * the same reason `?via=` carries one (ADR-0066): it names the ordering
         * a reader would arrive through, and it is an address rather than an
         * internal id.
         */
        placements: z.array(z.object({ itemId: z.uuid(), placementId: z.uuid() })),
        /**
         * How many values across the whole browse were held apart, the
         * container's own included (CNCORE-29).
         *
         * THE BULK PATH IS WHY THIS FIELD EXISTS. One call writes a container's
         * worth of dates, so a bad source fills the catalogue rather than a row
         * of it -- and sixty stories' worth of quarantined dates reported as a
         * plain success is the "silently" this ticket refuses.
         */
        quarantinedValues: z.number().int().nonnegative(),
      }),
    )
    .errors({
      PROVIDER_REFUSED: providerRefused,
      BROWSE_NOT_OFFERED: {
        message: "That provider does not offer browse, so it was not asked for one.",
        /**
         * `422` RATHER THAN THE `404` ITS TWO NEIGHBOURS TAKE, because this is
         * not a missing thing (CNCORE-152). A 404 here would tell the owner the
         * container is not there, and this procedure has no idea whether it is:
         * nothing was ever asked about it. ADR-0033 makes `browse` the operation
         * a provider may DECLINE, so a provider offering only `search` and
         * `lookup` is well-formed and complete -- what is absent is the
         * operation, not the container, and those have different remedies. The
         * owner's is to import the records one at a time; the other's is to
         * check the id.
         *
         * AND NOT `501`, WHICH IS THE CLOSER WORDING AND STILL WRONG TWICE OVER.
         * RFC 9110 15.6.2 reads "the server does not support the functionality
         * required to fulfill the request", which is nearly this sentence -- but
         * it is a 5xx, so `answer.ts` rethrows it and the owner gets the bare
         * `Internal Server Error` this ticket exists to remove, and `/api/rpc`
         * logs a stack for it (ADR-0125) as though CanonCore were broken. Its
         * second sentence rules it out independently of that: 501 "is the
         * appropriate response when the server does not recognize the request
         * method", and THIS server implements browse perfectly well. The
         * provider does not. `405` is out on the record's own terms too, since
         * it "MUST generate an Allow header field", and the POST that carried
         * this really is allowed.
         *
         * WHAT 422 SAYS, AT 15.5.21: the server "understands the content type of
         * the request content ... and the syntax of the request content is
         * correct, but it was unable to process the contained instructions".
         * That is this exactly. The instruction is "browse this container at
         * this provider", the request carrying it is entirely well-formed, and
         * the reason it cannot be carried out is a property of the provider it
         * names. Mapping an ABSENT UPSTREAM CAPABILITY onto that sentence is
         * CanonCore's reading rather than RFC 9110's example, which is
         * semantically erroneous XML; the registry offers no closer 4xx, and
         * oRPC carries the same status under its own `UNPROCESSABLE_CONTENT`.
         */
        status: 422,
      },
      NO_SUCH_CONTAINER: {
        message: "The provider holds no container at that id.",
        /**
         * `404`, FOR THE REASON `import`'s `NO_SUCH_RECORD` GIVES IN FULL. The
         * same sentence one noun over: the provider was asked and holds nothing
         * at that id, which ADR-0066 makes an answer rather than a failure and
         * `provider.container` answers at 200 on the read side.
         *
         * WRITTEN OUT RATHER THAN SHARED WITH IT, because the two differ in the
         * only field a shared declaration would have to fix -- the message names
         * the container where the other names the record -- and a helper taking
         * one noun would be indirection standing in for one word.
         */
        status: 404,
      },
    })
    .handler(async ({ input, context, errors }) => {
      try {
        const { allowlist } = await context.providerSettings();
        const browsed = await browseIntoCatalogue(context.db, allowlist, input);
        if (!browsed) throw errors.NO_SUCH_CONTAINER();
        return browsed;
      } catch (error) {
        // EVERYTHING THE PROVIDER FAILED AT, as in `import` above and for the
        // reason given there: this narrowed to `OutboundRefused` until
        // CNCORE-149, so a provider that ANSWERED a non-2xx fell past it as a
        // 500. The two write procedures had the identical catch and therefore
        // the identical hole.
        if (error instanceof ProviderFailed) {
          throw errors.PROVIDER_REFUSED({ data: error.reason });
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
  purge: ownerProcedure
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
   *
   * AND IT IS THE OWNER'S, WHICH AN EARLIER DRAFT OF CNCORE-109 GOT WRONG BY
   * READING THE NAME. A preview is not a read: it IS the delete, run in a
   * transaction it then rolls back, so it takes the work and the WRITE LOCKS of
   * a real purge -- `purge.ts` says so in those words, and the guarantee this
   * procedure exists to give depends on it. Left open, any caller could make
   * this instance execute the whole traversal, repeatedly, and lock the rows an
   * import was queued behind. The rows are identical to the ones `purge` would
   * delete, so the door in front of them is the same door.
   */
  previewPurge: ownerProcedure
    .input(purgeTarget)
    .output(purgeCounts)
    .handler(async ({ input, context }): Promise<PurgedProvider> => {
      return previewProviderPurge(context.db, { identity: input.baseUrl });
    }),

  /**
   * Opens -- or carries on -- a walk over a list of Container ids at one
   * Provider (CNCORE-166).
   *
   * IMPORTING A CORPUS IS 465 FORM SUBMISSIONS OTHERWISE. `browse` takes ONE
   * container id (ADR-0033), so the ids are supplied -- and supplying them one at
   * a time, 465 times, is what this replaces. `provider.containers` answers
   * "which Containers do you have" since CNCORE-187, for the Owner to pick ONE
   * on `/import`; a run does not ask it, and its list is still the Owner's own.
   *
   * IT WRITES THE LIST DOWN AND ASKS THE PROVIDER NOTHING. The walk is
   * `importNextContainer` below, one Container a call, and the split is what
   * makes a five-and-a-half-hour import possible at all: no single request waits
   * on more than one browse, and where the walk has got to is a row rather than
   * something held in a caller's memory.
   *
   * HANDING OVER THE SAME LIST AGAIN CARRIES ON RATHER THAN STARTING OVER, which
   * is what makes the Owner's own command the whole of the interface: they type
   * it again and it resumes. A run is still walking while a Container of it has
   * not LANDED, so what a lapsed Credential refused is asked for again (ADR-0122)
   * -- and a list whose every Container landed opens a fresh run, which is how a
   * re-import refreshes rather than doing nothing.
   *
   * THE OWNER'S, BECAUSE THE WALK IT OPENS SPENDS A THIRD PARTY'S TIME
   * (ADR-0131) and because everything that changes the catalogue is
   * (CNCORE-109).
   */
  beginImportRun: ownerProcedure
    .input(
      z.object({
        /** A CONFIG URL, travelling ADR-0034's allowlist as `browse`'s does. */
        baseUrl: z.url(),
        /**
         * The Provider's own ids for the Containers, in the order they are to be
         * imported.
         *
         * AT LEAST ONE, because a run over nothing is a row nobody asked for.
         */
        containerIds: z.array(z.string().min(1)).min(1),
      }),
    )
    .output(importRunReport)
    .handler(async ({ input, context }) => {
      const run = await beginImportRun(context.db, {
        providerIdentity: input.baseUrl,
        containerIds: input.containerIds,
      });
      return { runId: run.id, containers: run.containers.map(asReportedContainer) };
    }),

  /**
   * Browses the next Container of a run into the catalogue, and answers what
   * came of it.
   *
   * ONE CONTAINER A CALL, AND THAT IS THE TICKET'S "one at a time" HELD BY THE
   * SHAPE RATHER THAN BY A CONVENTION. A caller has nothing to parallelise: this
   * answers the Container it did, and which one is next is a question only the
   * run can answer once this one is recorded. The reason is measured --
   * `provider-wiki` is one Node process, and two concurrent browses of the
   * largest Ordering took 49.1s each against 25.5s alone (2026-09-13) -- so
   * parallelism here would be slower as well as ruder.
   *
   * IT TAKES NO PROVIDER, which is the other half of that. The run knows which
   * Provider it is at; a caller free to name one could walk a list of one
   * Provider's ids at another, and an external id means nothing outside the
   * namespace that minted it (ADR-0078).
   *
   * A REFUSAL IS AN ANSWER AND THE WALK GOES ON. `provider.browse` declares three
   * errors because a caller pressing a button needs to be told which of them it
   * hit; a walk of 465 needs the other 464 imported, and the refusal written
   * down where the run reports it.
   */
  importNextContainer: ownerProcedure
    .input(z.object({ runId: z.uuid() }))
    .output(
      z.discriminatedUnion("answer", [
        z.object({
          answer: z.literal("landed"),
          /** The Provider's own id, as the Owner listed it. */
          containerId: z.string().min(1),
          /** The Container as this catalogue now holds it. */
          itemId: z.uuid(),
          placements: z.number().int().nonnegative(),
          quarantinedValues: z.number().int().nonnegative(),
          /** How many Containers are still to be asked for after this one. */
          remaining: z.number().int().nonnegative(),
        }),
        z.object({
          answer: z.literal("refused"),
          containerId: z.string().min(1),
          reason: failureReason,
          remaining: z.number().int().nonnegative(),
        }),
        /** Every Container has been asked for. The run is what reports. */
        z.object({ answer: z.literal("done") }),
      ]),
    )
    .handler(async ({ input, context }) => {
      const next = await nextPendingContainer(context.db, input.runId);
      if (!next) return { answer: "done" as const };

      const { allowlist } = await context.providerSettings();
      const outcome = await oneContainerIntoTheCatalogue(context.db, allowlist, {
        baseUrl: next.providerIdentity,
        containerId: next.externalId,
      });
      const remaining = next.pending - 1;

      if ("refused" in outcome) {
        await recordContainerRefused(context.db, {
          runId: input.runId,
          externalId: next.externalId,
          reason: outcome.refused,
        });
        return {
          answer: "refused" as const,
          containerId: next.externalId,
          reason: outcome.refused,
          remaining,
        };
      }

      await recordContainerLanded(context.db, {
        runId: input.runId,
        externalId: next.externalId,
        placements: outcome.landed.placements.length,
        quarantinedValues: outcome.landed.quarantinedValues,
      });
      return {
        answer: "landed" as const,
        containerId: next.externalId,
        itemId: outcome.landed.containerId,
        placements: outcome.landed.placements.length,
        quarantinedValues: outcome.landed.quarantinedValues,
        remaining,
      };
    }),

  /**
   * What a run did: every Container of it, in the Owner's order, with what
   * landed and what refused.
   *
   * READ BACK RATHER THAN ONLY STREAMED, because a walk of five and a half hours
   * is one nobody watches to the end. "Which of my 465 refused, and why" is a
   * question asked once, afterwards -- and a caller that had to accumulate it
   * from every step would lose the lot to a closed terminal.
   *
   * NO REQUEST LEAVES THE APP. It reads this instance's own rows, so it answers
   * for a Provider that is switched off exactly as for one that is running.
   */
  readImportRun: ownerProcedure
    .input(z.object({ runId: z.uuid() }))
    .output(importRunReport)
    .handler(async ({ input, context }) => {
      const run = await readImportRun(context.db, input.runId);
      return { runId: run.id, containers: run.containers.map(asReportedContainer) };
    }),
};
